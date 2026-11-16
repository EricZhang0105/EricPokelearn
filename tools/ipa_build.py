# -*- coding: utf-8 -*-
"""英语音标发音库生成器（美式 GA，45 个音素，与全 App 同一把美式女声 en-US-JennyNeural）。

为什么不用 TTS 直接读音标：
  edge-tts 的免费端点不接受 SSML <phoneme alphabet="ipa">（实测 NoAudioReceived），
  把 /ɪ/ 这样的符号交给 TTS 只会念成一段乱码。

为什么不再「从单词里切辅音」（2026-11-16 第二次重做）：
  上一版对辅音用的是 onset 切法 —— 取词首到元音起点后 35ms。
  实测出来的片长：/b/ 55ms、/d/ 65ms、/m/ 55ms、/f/ 105ms 且前面还有 66ms 静音。
  55ms 的爆破音本来就只是「一声咔」，再加上 20ms 淡出，能量几乎被抹平；
  iPad 上听起来就是「读不出来 / 卡住的拖长音」。这不是播放器的问题，是素材本身不可听。
  纯爆破音（/p t k b d g/）在物理上也无法单独拉长 —— 它只有一二十毫秒的冲激。

现在的做法（按音的物理性质分三类）：
  1) 持续音（擦音 / 鼻音 / 近音 /h/）：让 TTS 直接发「sss」「mmm」「lll」这类延长写法，
     取最长的一段，补到 0.44–0.55s。这类音本来就能单独发，效果最干净。
  2) 塞音 / 塞擦音 / 半元音（/p b t d k g tʃ dʒ w j/）：用 TTS 的「辅音 + 短元音」
     写法（buh / duh / guh / puh / tuh / kuh / chuh / juh / wuh / yuh），
     截到 0.34–0.44s。这就是课堂里念字母音的方式（「b 说 buh」）。
  3) 元音：仍然从真实单词里切元音核（能保证是自然共振峰），
     再用 WSOLA 拉到 0.34s；卷舌元音用 r_tail 把 r 过渡带上。

语速：合成用 -18%（元音 -25%），比词库慢一档 —— 单念一个音必须留够时间才听得清。
缓冲：每段前后各补 70ms / 100ms 静音，声音不贴边，听感才不急促。

响度：原来按峰值归一，擦音峰值高、RMS 低 → 在 iPad 上明显比元音小声。
现在改成按 RMS 归一到同一档（-18 dBFS），并限制峰值不超过 -1 dBFS。

用法：
    python tools/ipa_build.py            # 只补缺失
    python tools/ipa_build.py --force    # 全部重做
"""
import asyncio, glob, os, subprocess, sys, tempfile, wave
import numpy as np
import parselmouth
import edge_tts
import imageio_ffmpeg

VOICE = 'en-US-JennyNeural'      # 美式女声：和其余 600+ 段英文录音同一把嗓子
RATE = '-18%'                    # 音素示范比词库更慢：单词里是连着说的，单念一个音要留够时间
                                 # 才听得清（Eric 反馈「太急促，听不清」就是这个原因）
RATE_VOWEL = '-25%'              # 元音再慢一档：真实单词里的短元音只有 0.1s，
                                 # 慢 25% 能把它拉到 0.2s 以上，且是自然发音不是拼接

# 每段声音前后各留一小段静音。片段贴边播放时，iPad 上听感是「刚一响就没了」；
# 留 70ms 起手、100ms 收尾，孩子听到的是一个从容的单音，而不是被打断的咔哒。
PAD_PRE, PAD_POST = 0.07, 0.10
SR, BR = 44100, '96k'
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'audio', 'ipa')
LISTJS = os.path.join(ROOT, 'js', 'ipa-audio-list.js')
AUDIO_VER = 'a=4'                # 换素材必须升版本，否则 iPad 还是旧缓存
FF = imageio_ffmpeg.get_ffmpeg_exe()
TMP = tempfile.mkdtemp(prefix='ipa_build_')
FORCE = '--force' in sys.argv

# key, IPA, TTS 文本, 模式, 目标时长
#   sustain    持续音：取最长一段，按目标时长居中截取（可循环延长）
#   cv         辅音 + 极短元音：从起音切到元音起点后 0.12s
#   vowel      元音核（真实单词，能量最高段）
#   head_vowel 词首弱元音（about 的 /ə/）
#   r_tail     元音 + 卷舌过渡
#   tail       词尾鼻音（sing 的 /ŋ/）
SPEC = [
    # ---- 短元音 ----
    ('v_ih', 'ɪ', 'sit', 'vowel', 0.40),
    ('v_e', 'ɛ', 'bed', 'vowel', 0.38),
    ('v_ae', 'æ', 'cat', 'vowel', 0.44),
    ('v_uh', 'ʌ', 'bus', 'vowel', 0.38),
    ('v_o', 'ɑ', 'hot', 'vowel', 0.40),
    ('v_uu', 'ʊ', 'book', 'vowel', 0.36),
    ('v_schwa', 'ə', 'sofa', 'final_vowel', 0.44),
    # ---- 长元音 / 紧元音 ----
    ('v_ii', 'i', 'see', 'vowel', 0.56),
    ('v_oo', 'u', 'boot', 'vowel', 0.56),   # 不用 moon：词首 /m/ 是浊鼻音，会被当成元音核切走
    # 没有单独的 /ɔ/：本库女声 cot-caught 合并，saw 与 hot 实测同一个 /ɑ/
    # ---- 卷舌元音 ----
    ('v_er', 'ɝ', 'her', 'r_tail', 0.56),
    ('v_schwa_r', 'ɚ', 'teacher', 'r_tail', 0.44),
    # ---- 双元音 ----
    ('v_ei', 'eɪ', 'cake', 'vowel', 0.58),
    ('v_ai', 'aɪ', 'bike', 'vowel', 0.58),
    ('v_oi', 'ɔɪ', 'boy', 'vowel', 0.58),
    ('v_au', 'aʊ', 'house', 'vowel', 0.58),
    ('v_ou', 'oʊ', 'nose', 'vowel', 0.58),
    ('v_aar', 'ɑr', 'car', 'r_tail', 0.62),
    ('v_awr', 'ɔr', 'for', 'r_tail', 0.62),
    ('v_ie', 'ɪr', 'here', 'r_tail', 0.60),
    ('v_ea', 'ɛr', 'hair', 'r_tail', 0.60),
    ('v_ue', 'ʊr', 'tour', 'r_tail', 0.60),
    # ---- 塞音：辅音 + 短元音（课堂念法 buh / duh …）----
    # 0.34s：元音部分够长，孩子能听出是「buh」而不是一声咔
    ('c_p', 'p', 'puh', 'cv', 0.40),
    ('c_b', 'b', 'buh', 'cv', 0.40),
    ('c_t', 't', 'tuh', 'cv', 0.40),
    ('c_d', 'd', 'duh', 'cv', 0.40),
    ('c_k', 'k', 'kuh', 'cv', 0.40),
    ('c_g', 'g', 'guh', 'cv', 0.40),
    # ---- 塞擦音 ----
    ('c_ch', 'tʃ', 'chuh', 'cv', 0.44),
    ('c_j', 'dʒ', 'juh', 'cv', 0.44),
    # ---- 半元音 ----
    ('c_w', 'w', 'wuh', 'cv', 0.40),
    ('c_y', 'j', 'yuh', 'cv', 0.40),
    # ---- 擦音：持续音（TTS 的延长写法，能真的拉出气流）----
    ('c_f', 'f', 'ffff', 'sustain', 0.48),
    ('c_v', 'v', 'vvv', 'sustain', 0.48),
    ('c_th', 'θ', 'thhh', 'sustain', 0.46),
    ('c_dh', 'ð', 'the', 'cv', 0.40),        # 「the」开头就是 /ð/，元音是弱读央元音
    ('c_s', 's', 'sss', 'sustain', 0.50),
    ('c_z', 'z', 'zzz', 'sustain', 0.50),
    ('c_sh', 'ʃ', 'shhh', 'sustain', 0.50),
    ('c_zh', 'ʒ', 'zhh', 'sustain', 0.46),
    ('c_h', 'h', 'hhh', 'sustain', 0.44),
    # ---- 鼻音 / 近音 ----
    ('c_m', 'm', 'mmm', 'sustain', 0.50),
    ('c_n', 'n', 'nnn', 'sustain', 0.50),
    ('c_ng', 'ŋ', 'sing', 'tail', 0.44),
    ('c_l', 'l', 'lll', 'sustain', 0.48),
    ('c_r', 'r', 'rrr', 'sustain', 0.48),
]


VOWEL_MODES = ('vowel', 'head_vowel', 'final_vowel', 'r_tail', 'tail')


def stretch(seg, sr, target=0.34, max_rate=2.0):
    """元音太短时用 WSOLA（ffmpeg atempo）拉长到 target，不改音高、没有接缝。
    绝不循环拼接 —— 循环会在接缝造出 20–40ms 的周期抖动，听感就是「卡住拖长」。

    atempo 一次最多只能放慢 2 倍（0.5），而慢速合成后 sit 的 /ɪ/ 只有 0.15s，
    到 0.34s 要 2.3 倍 → 必须分几轮拉，每轮 ≤2 倍，直到够长。"""
    for _ in range(4):
        dur = len(seg) / sr
        if dur >= target * 0.98:
            break
        factor = max(1.0 / max_rate, dur / target)
        a = os.path.join(TMP, '_st_in.wav')
        b = os.path.join(TMP, '_st_out.wav')
        save(seg, sr, a)
        try:
            run([FF, '-y', '-v', 'error', '-i', a, '-filter:a', f'atempo={factor:.3f}',
                 '-ac', '1', '-ar', str(sr), b])
            y, sr2 = load(b)
            if len(y) <= len(seg):
                break
            seg = y
        except Exception:
            break
    return seg


def run(args, **kw):
    p = subprocess.run(args, capture_output=True, **kw)
    if p.returncode != 0:
        raise RuntimeError(p.stderr.decode('utf8', 'ignore')[:300])
    return p


def load(p):
    snd = parselmouth.Sound(p)
    return np.array(snd.values[0], dtype=np.float32), int(snd.sampling_frequency)


def save(x, sr, p):
    x = np.clip(np.asarray(x, dtype=np.float32), -1, 1)
    with wave.open(p, 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes((x * 32767).astype(np.int16).tobytes())


def envelope(x, sr, hop=0.01):
    n = int(sr * hop)
    return np.array([np.sqrt(np.mean(x[i:i + n] ** 2)) for i in range(0, max(1, len(x) - n), n)], dtype=np.float32)


def spans_of(env, ratio, min_len=0.04, hop=0.01, merge=0.0):
    """能量高于峰值 ratio 的连续段。
    擦音比元音低 10–20dB，判擦音时 ratio 要压到 0.10；
    merge 用来把「同一段里的小凹陷」粘回去（TTS 元音内部有重音起伏）。"""
    if env.size == 0:
        return []
    thr = float(env.max()) * ratio
    out, st = [], None
    for i, v in enumerate(env):
        if v >= thr and st is None:
            st = i
        elif v < thr and st is not None:
            if (i - st) * hop >= min_len:
                out.append((st, i))
            st = None
    if st is not None and (len(env) - st) * hop >= min_len:
        out.append((st, len(env)))
    if merge > 0 and len(out) > 1:
        merged = [list(out[0])]
        for a, b in out[1:]:
            if (a - merged[-1][1]) * hop <= merge:
                merged[-1][1] = b
            else:
                merged.append([a, b])
        out = [tuple(x) for x in merged]
    return out


def loop_to(x, sr, target, fade=0.025):
    """不足目标时长时用交叉淡化循环延长（音高与共振峰不变）。只用于稳定的持续音。"""
    n = int(target * sr)
    if len(x) >= n:
        return x
    f = max(8, int(fade * sr))
    if len(x) <= f:
        return x
    out = x.copy()
    seg = x
    guard = 0
    while len(out) < n and guard < 60:
        head = out[-f:]
        tail = seg[:f]
        w = np.linspace(0, 1, f, dtype=np.float32)
        mix = head * (1 - w) + tail * w
        out = np.concatenate([out[:-f], mix, seg[f:f + f]])
        guard += 1
    return out[:n]


def pad(x, sr, pre=PAD_PRE, post=PAD_POST):
    """声音前后各补一段静音。片段贴边播放在 iPad 上听着「刚一响就没了」，
    补上起手与收尾的空白，单音才显得从容、听得清。"""
    a = np.zeros(int(pre * sr), dtype=np.float32)
    b = np.zeros(int(post * sr), dtype=np.float32)
    return np.concatenate([a, x, b])


def fade(x, sr, fi=0.012, fo=0.022):
    n = len(x)
    a, b = int(fi * sr), int(fo * sr)
    if n > a + b + 16:
        x[:a] *= np.linspace(0, 1, a, dtype=np.float32)
        x[-b:] *= np.linspace(1, 0, b, dtype=np.float32)
    elif n > 32:
        k = max(8, n // 8)
        x[:k] *= np.linspace(0, 1, k, dtype=np.float32)
        x[-k:] *= np.linspace(1, 0, k, dtype=np.float32)
    return x


def cut(x, sr, mode, target):
    env = envelope(x, sr)
    if mode == 'sustain':
        # 擦音/鼻音/近音：用低阈值抓最长段（0.10 才能把 /s/ /f/ 一起算进来）
        sp = spans_of(env, 0.10, 0.06)
        if not sp:
            return None, 'no-span'
        a, b = max(sp, key=lambda s: s[1] - s[0])
        seg = x[a * int(0.01 * sr): b * int(0.01 * sr)].copy()
        if len(seg) > int(target * sr):
            mid, half = len(seg) // 2, int(target * sr) // 2
            seg = seg[max(0, mid - half): min(len(seg), mid + half)]
        elif len(seg) < int(target * 0.92 * sr):
            # 只对稳定噪音做延长，交叉淡化要够长（0.05s），
            # 25ms 的短接缝会形成 40Hz 的周期抖动，听感就是「卡卡的」
            seg = loop_to(seg, sr, target, 0.05)
        return seg, 'ok'

    if mode == 'cv':
        # 塞音/塞擦音/半元音：从元音起点前 0.11s 切到后 0.22s。
        #   · 前 0.11s 装的是爆破 + 送气，**不能从 0 开始** ——
        #     /p/ /t/ /k/ 词首有 40–70ms 的闭塞（纯静音），从 0 切等于先给孩子一段空白，
        #     听起来就是「点了没声，然后咔一下」。
        #   · 后 0.22s 的元音要够长：上一版只留 0.13s，孩子听到的是「buh」被掐断，
        #     听感急促。留到 0.22s 才是完整的一个短音节。
        sp = spans_of(env, 0.45, 0.03)
        if not sp:
            return None, 'no-vowel-onset'
        onset = sp[0][0] * 0.01
        a_s = max(0.0, onset - 0.12)
        b_s = min(len(x) / sr, onset + 0.28)
        seg = x[int(a_s * sr):int(b_s * sr)].copy()
        # 切完再清一次首部：/p/ /k/ 前面常剩一段 40–60ms 的闭塞（纯静音），
        # 留着就是「点了先没声」。留 5ms 让爆破不要贴边。
        if seg.size:
            e = envelope(seg, sr)
            live = np.where(e > e.max() * 0.05)[0]
            if live.size:
                i0 = max(0, int(live[0] * 0.01 * sr) - int(0.005 * sr))
                seg = seg[i0:]
        if len(seg) > int(target * sr):
            seg = seg[-int(target * sr):]     # 宁可吃掉一点前段，也要留住元音起音
        if len(seg) < int(0.20 * sr):
            return None, f'cv-too-short({len(seg)/sr:.2f}s)'
        return seg, 'ok'

    # 元音核：阈值压到 0.32 并合并 50ms 内的小凹陷，
    # 否则 TTS 一句里元音自身的重音起伏会把 /ɪ/ 切成好几段（实测只剩 0.06s）
    sp = spans_of(env, 0.32, 0.05, merge=0.05)
    if not sp:
        return None, 'no-voiced-span'
    if mode == 'head_vowel':
        w = max(1, int(0.16 / 0.01))
        envw = env[:w]
        if not envw.size:
            return None, 'no-head-window'
        thr = float(envw.max()) * 0.30
        segs, st = [], None
        for i, v in enumerate(envw):
            if v >= thr and st is None:
                st = i
            elif v < thr and st is not None:
                if (i - st) * 0.01 >= 0.03:
                    segs.append((st, i))
                st = None
        if st is not None and (len(envw) - st) * 0.01 >= 0.03:
            segs.append((st, len(envw)))
        if not segs:
            return None, 'no-head-span'
        a, b = max(segs, key=lambda s: s[1] - s[0])
        a_s, b_s = max(0.0, a * 0.01 - 0.03), b * 0.01
    elif mode == 'vowel':
        a, b = max(sp, key=lambda s: s[1] - s[0])
        a_s, b_s = a * 0.01 + 0.006, b * 0.01 - 0.006
    elif mode == 'r_tail':
        s = max(sp, key=lambda s: s[1])
        a_s = max(0.0, s[0] * 0.01 - 0.035)
        nz = np.where(env > env.max() * 0.04)[0]
        b_s = min((nz[-1] + 1) * 0.01 if nz.size else len(x) / sr, len(x) / sr)
        if b_s - a_s > 0.90:
            b_s = a_s + 0.90
    elif mode == 'final_vowel':
        # 词尾弱读元音（sofa 的 /ə/）：取最后一个元音段，整段保留
        a, b = max(sp, key=lambda s: s[0])
        a_s, b_s = max(0.0, a * 0.01 - 0.02), b * 0.01 + 0.02
    elif mode == 'tail':
        vowel = max(sp, key=lambda s: s[1])
        nz = np.where(env > env.max() * 0.03)[0]
        a_s = vowel[1] * 0.01 - 0.02
        b_s = min((nz[-1] + 1) * 0.01 if nz.size else len(x) / sr, len(x) / sr)
    else:
        return None, 'bad-mode'

    i0, i1 = max(0, int(a_s * sr)), min(len(x), int(b_s * sr))
    if i1 - i0 < int(0.03 * sr):
        return None, 'too-short-span'
    seg = x[i0:i1].copy()
    if len(seg) > int(target * sr):
        if mode == 'r_tail':
            seg = seg[:int(target * sr)]
        else:
            mid, half = len(seg) // 2, int(target * sr) // 2
            seg = seg[max(0, mid - half): min(len(seg), mid + half)]
    elif len(seg) < int(target * sr):
        # 元音**不循环延长**：源词里的元音本来只有 0.2–0.4s，循环会在接缝处
        # 造出 20–40ms 的周期性抖动（共振峰来回跳 100Hz），听感就是「卡住拖长」。
        # 长度不够就让它短一点，短元音本来就该短。只有 < 0.16s 才算素材不合格。
        if len(seg) < int(0.10 * sr):
            return None, f'source-vowel-too-short({len(seg)/sr:.2f}s)'
    return seg, 'ok'


def normalize(x, rms_db=-18.0, ceil_db=-1.0, max_gain_db=24.0):
    """按 RMS 归一到同一档响度。原来按峰值归一：擦音峰值高、RMS 低，
    在 iPad 上明显比元音小声，听起来像「没读出来」。
    -18dBFS 比上一版（-20）再响 2dB：单音本来就短，宁可比单词略亮一点。"""
    rms = float(np.sqrt(np.mean(x ** 2))) if x.size else 0.0
    if rms <= 1e-6:
        return x
    gain = 10 ** (rms_db / 20) / rms
    gain = min(gain, 10 ** (max_gain_db / 20))
    y = x * gain
    pk = float(np.max(np.abs(y))) if y.size else 0.0
    ceil = 10 ** (ceil_db / 20)
    if pk > ceil:
        y *= ceil / pk
    return np.clip(y, -1, 1)


async def synth(text, rate=None):
    buf = bytearray()
    async for ch in edge_tts.Communicate(text, VOICE, rate=rate or RATE).stream():
        if ch.get('type') == 'audio' and ch.get('data'):
            buf += ch['data']
    if len(buf) < 1000:
        raise RuntimeError('audio too small')
    return bytes(buf)


def encode(wav, dst):
    run([FF, '-y', '-v', 'error', '-i', wav, '-ac', '1', '-ar', str(SR),
         '-c:a', 'aac', '-b:a', BR, dst])


async def main():
    os.makedirs(OUT, exist_ok=True)
    keep = {k for k, *_ in SPEC}
    for f in glob.glob(os.path.join(OUT, '*.m4a')):
        if os.path.splitext(os.path.basename(f))[0] not in keep:
            os.remove(f)
            print('  删除过期', os.path.basename(f))
    done, fail, notes = 0, [], []
    for key, ipa, text, mode, target in SPEC:
        dst = os.path.join(OUT, key + '.m4a')
        if not FORCE and os.path.exists(dst) and os.path.getsize(dst) > 1200:
            continue
        try:
            buf = None
            for attempt in range(3):
                try:
                    buf = await synth(text, RATE_VOWEL if mode in VOWEL_MODES else RATE)
                    break
                except Exception:
                    if attempt == 2:
                        raise
                    await asyncio.sleep(1.5 * (attempt + 1))
            src = os.path.join(TMP, key + '.mp3')
            with open(src, 'wb') as f:
                f.write(buf)
            wav = os.path.join(TMP, key + '_in.wav')
            run([FF, '-y', '-v', 'quiet', '-i', src, '-ac', '1', '-ar', str(SR), wav])
            x, sr = load(wav)
            env0 = envelope(x, sr)
            nz = np.where(env0 > env0.max() * 0.02)[0]
            if nz.size:
                x = x[max(0, int(nz[0] * 0.01 * sr) - int(0.01 * sr)):]
            seg, why = cut(x, sr, mode, target)
            if seg is None:
                fail.append(f'{key}({ipa}) {text}: {why}')
                continue
            if mode in VOWEL_MODES:
                seg = stretch(seg, sr, 0.34)
            seg = normalize(seg)
            seg = fade(seg, sr, 0.008, 0.05)
            seg = pad(seg, sr)          # 最后补前后静音，不参与淡入淡出
            outw = os.path.join(TMP, key + '_out.wav')
            save(seg, sr, outw)
            encode(outw, dst)
            done += 1
            notes.append((key, ipa, text, mode, round(len(seg) / sr, 3)))
        except Exception as e:
            fail.append(f'{key}({ipa}) {text}: {type(e).__name__} {str(e)[:100]}')

    items = [k for k, *_ in SPEC if os.path.exists(os.path.join(OUT, k + '.m4a'))]
    js = ('/* 由 tools/ipa_build.py 自动生成，勿手工编辑\n'
          f' * 英语 {len(items)} 音素发音片段（美式 GA，同一把女声 en-US-JennyNeural）。\n'
          ' * Service Worker 安装时预缓存，保证离线也能点音标听发音。 */\n'
          f'const IPA_AUDIO_VER = "{AUDIO_VER}";\n'
          'const IPA_AUDIO_LIST = [\n'
          + ',\n'.join(f'  "audio/ipa/{k}.m4a?{AUDIO_VER}"' for k in items)
          + '\n];\n'
          'if (typeof self !== "undefined") { self.IPA_AUDIO_LIST = IPA_AUDIO_LIST; self.IPA_AUDIO_VER = IPA_AUDIO_VER; }\n')
    open(LISTJS, 'w', encoding='utf8').write(js)

    print(f'新生成 {done} 段，失败 {len(fail)}')
    print(f'清单 {len(items)} 条 → js/ipa-audio-list.js（{AUDIO_VER}）')
    for n in notes[:8]:
        print('  ', n)
    for f in fail[:12]:
        print('  FAIL', f)


if __name__ == '__main__':
    asyncio.run(main())
