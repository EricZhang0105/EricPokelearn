# -*- coding: utf-8 -*-
"""英语音标发音库生成器（44 个 RP 音素，单一英式女声 en-GB-SoniaNeural）。

为什么不用 TTS 直接读音标：
  edge-tts 的免费端点不接受 SSML <phoneme alphabet="ipa">（实测 NoAudioReceived），
  把 /ɪ/ 这样的符号交给 TTS 只会念成一段乱码。
  所以做法是：合成一个「目标音素在最前面」的单词，再从音频里把目标段切出来。

为什么用英式女声而不是 Jenny（全 App 其余英文都是 en-US-JennyNeural）：
  音标表是英式 RP 44 音素，/ɒ/（dog）、/əʊ/（nose）、/ɪə/（here）、/eə/（hair）、
  /ʊə/（tour）这几个音在美音里根本不存在——用美音读 dog 会变成 "dahg"，
  和卡片上印的 /ɒ/ 直接对不上。音标示范是独立的教学场景，用一把固定的英式女声，
  仍然满足「不换人、不出男声」的要求，同时保证音标念对。

切法（和中文 zh_tts_build.py 的 vowel_onset 同一套思路）：
  - 元音：找能量最高的连续段（元音核），按短/长元音目标时长取中心或循环延长
  - 辅音 onset：取词首到元音起点后 35ms —— 教学上读 /b/ 本来就是「b + 极短元音起音」
  - /ŋ/（词尾）：取元音结束到最后一个有声点（不能取到文件尾，尾部静音会把片段拉到 1s+）

每个音素都会做淡入淡出、峰值归一，另有 tools/ipa_check.py 做声学自检。

用法：
    python tools/ipa_build.py            # 只补缺失
    python tools/ipa_build.py --force    # 全部重做
"""
import asyncio, json, os, subprocess, sys, tempfile, wave
import numpy as np
import parselmouth
import edge_tts
import imageio_ffmpeg

VOICE = 'en-GB-SoniaNeural'      # 英式女声：与 RP 音标表一致
RATE = '-8%'                     # 与词库一致，孩子听着是同一档语速
SR, BR = 44100, '96k'
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'audio', 'ipa')
LISTJS = os.path.join(ROOT, 'js', 'ipa-audio-list.js')
FF = imageio_ffmpeg.get_ffmpeg_exe()
TMP = tempfile.mkdtemp(prefix='ipa_build_')
FORCE = '--force' in sys.argv

# key, IPA, 源词, 模式
#   vowel      元音核（单音节词，取能量最高的连续段）
#   head_vowel 词首弱元音（about 的 /ə/，取第一个有声段）
#   onset      词首辅音（取词首到元音起点后 50ms）
#   tail       词尾辅音（sing 的 /ŋ/）
SPEC = [
    # ---- 短元音 ----
    ('v_ih', 'ɪ', 'sit', 'vowel', 0.34),
    ('v_e', 'e', 'bed', 'vowel', 0.32),
    ('v_ae', 'æ', 'cat', 'vowel', 0.36),
    ('v_uh', 'ʌ', 'cup', 'vowel', 0.32),
    ('v_o', 'ɒ', 'dog', 'vowel', 0.34),
    ('v_uu', 'ʊ', 'book', 'vowel', 0.30),
    ('v_schwa', 'ə', 'about', 'head_vowel', 0.20),
    # ---- 长元音 ----
    ('v_ii', 'iː', 'see', 'vowel', 0.55),
    ('v_aa', 'ɑː', 'car', 'vowel', 0.55),
    ('v_aw', 'ɔː', 'for', 'vowel', 0.55),
    ('v_oo', 'uː', 'moon', 'vowel', 0.55),
    ('v_er', 'ɜː', 'bird', 'vowel', 0.55),
    # ---- 双元音 ----
    ('v_ei', 'eɪ', 'cake', 'vowel', 0.50),
    ('v_ai', 'aɪ', 'bike', 'vowel', 0.50),
    ('v_oi', 'ɔɪ', 'boy', 'vowel', 0.50),
    ('v_au', 'aʊ', 'house', 'vowel', 0.50),
    ('v_ou', 'əʊ', 'nose', 'vowel', 0.50),
    ('v_ie', 'ɪə', 'here', 'vowel', 0.52),
    ('v_ea', 'eə', 'hair', 'vowel', 0.52),
    ('v_ue', 'ʊə', 'tour', 'vowel', 0.52),
    # ---- 辅音 ----
    ('c_p', 'p', 'pen', 'onset', 0.20),
    ('c_b', 'b', 'bag', 'onset', 0.16),
    ('c_t', 't', 'ten', 'onset', 0.20),
    ('c_d', 'd', 'dog', 'onset', 0.14),
    ('c_k', 'k', 'kite', 'onset', 0.20),
    ('c_g', 'g', 'go', 'onset', 0.14),
    ('c_f', 'f', 'fish', 'onset', 0.22),
    ('c_v', 'v', 'van', 'onset', 0.16),
    ('c_th', 'θ', 'thin', 'onset', 0.22),
    ('c_dh', 'ð', 'this', 'onset', 0.14),
    ('c_s', 's', 'sun', 'onset', 0.24),
    ('c_z', 'z', 'zoo', 'onset', 0.16),
    ('c_sh', 'ʃ', 'ship', 'onset', 0.24),
    ('c_zh', 'ʒ', 'genre', 'onset', 0.18),
    ('c_h', 'h', 'hat', 'onset', 0.18),
    ('c_ch', 'tʃ', 'chair', 'onset', 0.22),
    ('c_j', 'dʒ', 'jam', 'onset', 0.16),
    ('c_m', 'm', 'man', 'onset', 0.16),
    ('c_n', 'n', 'net', 'onset', 0.14),
    ('c_ng', 'ŋ', 'sing', 'tail', 0.24),
    ('c_l', 'l', 'leg', 'onset', 0.16),
    ('c_r', 'r', 'red', 'onset', 0.16),
    ('c_w', 'w', 'wet', 'onset', 0.14),
    ('c_y', 'j', 'yes', 'onset', 0.16),
]


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


def voiced_spans(env, ratio=0.5, min_len=0.05, hop=0.01):
    """能量高于峰值 ratio 的连续段（元音核比鼻音/擦音高 10dB 以上，0.5 能分开）"""
    if env.size == 0:
        return []
    thr = float(env.max()) * ratio
    spans, st = [], None
    for i, v in enumerate(env):
        if v >= thr and st is None:
            st = i
        elif v < thr and st is not None:
            if (i - st) * hop >= min_len:
                spans.append((st * hop, i * hop))
            st = None
    if st is not None and (len(env) - st) * hop >= min_len:
        spans.append((st * hop, len(env) * hop))
    return spans


def loop_to(x, sr, target, fade=0.03):
    """不足目标时长时，用尾部与头部交叉淡化循环延长（保持音高与共振峰不变）"""
    n = int(target * sr)
    if len(x) >= n:
        return x
    f = max(1, int(fade * sr))
    out = x.copy()
    seg = x[-f:] if len(x) > f else x
    guard = 0
    while len(out) < n and guard < 200:
        head = out[-f:]
        tail = seg[:f]
        w = np.linspace(0, 1, f, dtype=np.float32)
        out = np.concatenate([out[:-f], head * (1 - w) + tail * w, seg[f:]] if len(seg) > f else [out, seg])
        guard += 1
    return out[:n]


def cut(x, sr, mode, target):
    env = envelope(x, sr)
    spans = voiced_spans(env, 0.45, 0.04)
    if not spans:
        return None, 'no-voiced-span'
    if mode == 'head_vowel':
        # /ə/ 比后面的重读元音低 10dB 以上，阈值一高就会跳过它、抓到 /aʊ/。
        # 做法：只看词首 0.32s 这段窗口（里面只有 /ə/ 和后面 /b/ 的爆破），取最长的一段。
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
                    segs.append((st * 0.01, i * 0.01))
                st = None
        if st is not None and (len(envw) - st) * 0.01 >= 0.03:
            segs.append((st * 0.01, len(envw) * 0.01))
        if not segs:
            return None, 'no-head-span'
        a, b = max(segs, key=lambda s: s[1] - s[0])
        a = max(0.0, a - 0.03)
    elif mode == 'vowel':
        a, b = max(spans, key=lambda s: s[1] - s[0])
        a = a + 0.015                     # 跳过起始过渡
        b = b - 0.015                     # 跳过收尾过渡
    elif mode == 'onset':
        a = 0.0
        b = spans[0][0] + 0.035            # 辅音 + 元音起音 35ms（再多就听成 "puh" 了）
    elif mode == 'tail':
        # 元音结束 → 最后一个有声点。鼻音（/ŋ/）能量只有元音的一半，进不了 spans，
        # 所以终点要用低阈值重新找；取文件尾会把尾部静音一起带进来（曾切出 1.16s）
        vowel = max(spans, key=lambda s: s[1])
        nz = np.where(env > env.max() * 0.03)[0]
        end = (nz[-1] + 1) * 0.01 if nz.size else len(x) / sr
        a = vowel[1] - 0.02
        b = min(end, len(x) / sr)
    else:
        return None, 'bad-mode'

    i0, i1 = int(a * sr), int(b * sr)
    i0, i1 = max(0, i0), min(len(x), i1)
    if i1 - i0 < int(0.02 * sr):
        return None, 'too-short-span'
    seg = x[i0:i1].copy()

    if mode in ('vowel', 'head_vowel'):
        if len(seg) > int(target * sr):
            # 长了取中心（保留稳态部分）
            mid = len(seg) // 2
            half = int(target * sr) // 2
            seg = seg[max(0, mid - half): min(len(seg), mid + half)]
        else:
            seg = loop_to(seg, sr, target)

    # 淡入淡出，避免切点爆音
    fi, fo = int(0.006 * sr), int(0.02 * sr)
    if len(seg) > fi + fo:
        seg[:fi] *= np.linspace(0, 1, fi, dtype=np.float32)
        seg[-fo:] *= np.linspace(1, 0, fo, dtype=np.float32)
    return seg, 'ok'


def normalize(x, peak_db=-6.0, max_gain_db=18.0):
    pk = float(np.max(np.abs(x))) if x.size else 0.0
    if pk <= 1e-6:
        return x
    gain = min(10 ** (peak_db / 20) / pk, 10 ** (max_gain_db / 20))
    return np.clip(x * gain, -1, 1)


async def synth(text):
    buf = bytearray()
    async for ch in edge_tts.Communicate(text, VOICE, rate=RATE).stream():
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
    done, fail, notes = 0, [], []
    for key, ipa, word, mode, target in SPEC:
        dst = os.path.join(OUT, key + '.m4a')
        if not FORCE and os.path.exists(dst) and os.path.getsize(dst) > 1200:
            continue
        try:
            for attempt in range(3):
                try:
                    buf = await synth(word)
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
            # 词首静音先削掉，onset 模式才能从真正的起音开始切
            env0 = envelope(x, sr)
            nz = np.where(env0 > env0.max() * 0.02)[0]
            if nz.size:
                x = x[max(0, int(nz[0] * 0.01 * sr) - int(0.01 * sr)):]
            seg, why = cut(x, sr, mode, target)
            if seg is None:
                fail.append(f'{key}({ipa}) {word}: {why}')
                continue
            seg = normalize(seg)
            outw = os.path.join(TMP, key + '_out.wav')
            save(seg, sr, outw)
            encode(outw, dst)
            done += 1
            notes.append((key, ipa, word, mode, round(len(seg) / sr, 3)))
        except Exception as e:
            fail.append(f'{key}({ipa}) {word}: {type(e).__name__} {str(e)[:100]}')

    # 预缓存清单：和中文音频同样玩法，装 PWA 时就落盘，离线也能点名
    items = [k for k, *_ in SPEC if os.path.exists(os.path.join(OUT, k + '.m4a'))]
    js = ('/* 由 tools/ipa_build.py 自动生成，勿手工编辑\n'
          ' * 英语 44 音素发音片段（同一把女声 en-US-JennyNeural）。\n'
          ' * Service Worker 安装时预缓存，保证离线也能点音标听发音。 */\n'
          'const IPA_AUDIO_VER = "a=1";\n'
          'const IPA_AUDIO_LIST = [\n'
          + ',\n'.join(f'  "audio/ipa/{k}.m4a?a=1"' for k in items)
          + '\n];\n'
          'if (typeof self !== "undefined") { self.IPA_AUDIO_LIST = IPA_AUDIO_LIST; self.IPA_AUDIO_VER = IPA_AUDIO_VER; }\n')
    open(LISTJS, 'w', encoding='utf8').write(js)

    print(f'新生成 {done} 段，失败 {len(fail)}')
    print(f'清单 {len(items)} 条 → js/ipa-audio-list.js')
    for n in notes[:6]:
        print('  ', n)
    for f in fail[:12]:
        print('  FAIL', f)


asyncio.run(main())
