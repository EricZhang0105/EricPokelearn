"""中文拼音语音库生成器（Windows 版，替代只能在 macOS 上跑的 gen_zh_audio.js）

为什么要重写（2026-11-16）：
  · 旧库每段都录「两遍」（「玻，玻」）→ 四步拼读里每一步都被念两次
  · 旧库没有「带调韵母」录音 → 第四声只能交给设备 TTS，设备忽略调号 → 第四声读成第一声
  · 旧库的拼读音节把声母/韵母也念出来 → 题库「听一听 bù 的声母是？」等于直接读答案

硬性规则：
  1) 全库只用一把普通话女声（VOICE），禁止变声/变调
  2) 每段只读一遍
  3) 带调韵母单独录音；一声用「取平直段 + 整段循环延长」做成真正的平调
     （TTS 单独读纯元音会自然下坠，和四声几乎一样 → 必须处理）

用法：
  python tools/zh_tts_build.py             # 只补缺的
  python tools/zh_tts_build.py --force     # 全量重录（换音色后必须）
  python tools/zh_tts_build.py --verify    # 只做校验，不录音
产物： audio/zh/*.m4a, js/zh-audio-list.js, tools/zh_build_report.json
"""
import asyncio, json, os, shutil, subprocess, sys, tempfile, wave
import numpy as np
import imageio_ffmpeg
import edge_tts
import parselmouth

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'audio', 'zh')
LIST_JS = os.path.join(ROOT, 'js', 'zh-audio-list.js')
REPORT = os.path.join(ROOT, 'tools', 'zh_build_report.json')
MANIFEST = os.path.join(ROOT, 'tools', 'zh_manifest.json')

VOICE = 'zh-CN-XiaoxiaoNeural'   # 唯一音色：普通话女声
SR = 44100
BR = '96k'
AUDIO_VER = 'a=3'                # 换音色/重录后必须 +1，顶掉设备上的旧音频缓存
FORCE = '--force' in sys.argv
VERIFY_ONLY = '--verify' in sys.argv

FF = imageio_ffmpeg.get_ffmpeg_exe()
items = json.load(open(MANIFEST, encoding='utf-8'))['items']


def run(args):
    p = subprocess.run(args, capture_output=True)
    if p.returncode != 0:
        raise RuntimeError(p.stderr.decode('utf8', 'ignore')[:300])


def to_wav(src, dst):
    run([FF, '-y', '-v', 'quiet', '-i', src, '-ac', '1', '-ar', str(SR), dst])


def encode(wav, dst):
    run([FF, '-y', '-v', 'quiet', '-i', wav, '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11',
         '-ac', '1', '-ar', str(SR), '-c:a', 'aac', '-b:a', BR, dst])


def load(p):
    snd = parselmouth.Sound(p)
    return np.array(snd.values[0], dtype=np.float32), int(snd.sampling_frequency)


def save(x, sr, p):
    x = np.clip(np.asarray(x, dtype=np.float32), -1, 1)
    with wave.open(p, 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr)
        w.writeframes((x * 32767).astype(np.int16).tobytes())


_ANALYSE_DIR = tempfile.mkdtemp(prefix='zh_analyse_')
_cnt = [0]


def as_wav(p):
    """m4a 需要先解码成 wav 才能做声学分析（临时文件放独立目录，不污染 audio/zh）"""
    if p.lower().endswith('.wav'):
        return p
    _cnt[0] += 1
    tmp = os.path.join(_ANALYSE_DIR, f'{_cnt[0]}.wav')
    to_wav(p, tmp)
    return tmp


def voice_segments(p):
    """返回有声段列表（秒），用于确认「每段只读一遍」"""
    p = as_wav(p)
    x, sr = load(p)
    n = int(sr * 0.01)
    env = np.array([np.sqrt(np.mean(x[i:i + n] ** 2)) for i in range(0, max(1, len(x) - n), n)])
    thr = env.max() * 0.03
    segs, st = [], None
    for i, v in enumerate(env):
        if v >= thr and st is None:
            st = i
        elif v < thr and st is not None:
            if (i - st) * 0.01 >= 0.05:
                segs.append((st * 0.01, i * 0.01))
            st = None
    if st is not None and (len(env) - st) * 0.01 >= 0.05:
        segs.append((st * 0.01, len(env) * 0.01))
    return segs


def pitch_contour(p):
    p = as_wav(p)
    snd = parselmouth.Sound(p)
    try:
        pp = snd.to_pitch(time_step=0.01, pitch_floor=100, pitch_ceiling=560)
    except Exception:
        return None
    f0 = pp.selected_array['frequency']
    f0 = f0[f0 > 0]
    if len(f0) < 6:
        return None
    core = f0[int(len(f0) * .12):int(len(f0) * .9)]
    tr = np.array_split(core, 3)
    return 12 * np.log2(np.array([m.mean() for m in tr]) / 100)


def trim(p, dst, max_dur):
    x, sr = load(p)
    segs = voice_segments(p)
    if not segs:
        shutil.copy(p, dst)
        return
    a = max(0.0, segs[0][0] - 0.03)
    b = min(len(x) / sr, segs[min(len(segs) - 1, 0)][1] + 0.06, a + max_dur)
    save(x[int(a * sr):int(b * sr)], sr, dst)


def make_level(src, dst, target=0.45):
    """一声：取最长的平直段，按整段循环延长到 target 秒（不动音高/音色）。
    纯元音一般能取到 0.18s 以上的平直段；鼻韵母（en）允许放宽到 ±1.6 半音。"""
    x, sr = load(src)
    snd = parselmouth.Sound(src)
    pp = snd.to_pitch(time_step=0.01, pitch_floor=100, pitch_ceiling=560)
    f0 = pp.selected_array['frequency']
    times = pp.xs()
    voiced = [(t, f) for t, f in zip(times, f0) if f > 0]
    if len(voiced) < 8:
        raise RuntimeError('浊音太少')
    head = float(np.median([f for _, f in voiced[:8]]))
    best = (0, 0)
    for tol, minrun in ((1.0, 5), (1.6, 4), (2.2, 3)):
        ok = [abs(12 * np.log2(f / head)) < tol for _, f in voiced]
        cur, start = 0, 0
        for i, v in enumerate(ok):
            if v:
                if cur == 0:
                    start = i
                cur += 1
                if cur > best[1] - best[0]:
                    best = (start, start + cur)
            else:
                cur = 0
        if best[1] - best[0] >= minrun:
            break
    if best[1] - best[0] < 3:
        raise RuntimeError('找不到平直段')
    t0 = voiced[best[0]][0]
    t1 = voiced[best[1] - 1][0] + 0.012
    seg = x[int(t0 * sr):int(t1 * sr)].copy()
    if len(seg) < int(0.06 * sr):
        raise RuntimeError('平直段太短')
    tn, fade = int(target * sr), int(0.015 * sr)
    out = seg.copy()
    guard = 0
    while len(out) < tn and guard < 300:
        a, b = out[-fade:], seg[:fade]
        w = np.linspace(0, 1, fade, dtype=np.float32)
        out = np.concatenate([out[:-fade], a * (1 - w) + b * w, seg[fade:]])
        guard += 1
    out = out[:tn]
    f = int(0.008 * sr)
    out[:f] *= np.linspace(0, 1, f, dtype=np.float32)
    out[-f:] *= np.linspace(1, 0, f, dtype=np.float32)
    save(out, sr, dst)
    return abs(12 * np.log2(float(np.median(f0[f0 > 0][best[0]:best[1]])) / head))


def vowel_onset(p):
    """按频谱重心突变找韵母起点：鼻音/塞音的声母段重心明显更低"""
    x, sr = load(p)
    win = int(0.01 * sr)
    hop = int(0.005 * sr)
    cs = []
    for i in range(0, len(x) - win, hop):
        fr = x[i:i + win] * np.hanning(win)
        sp = np.abs(np.fft.rfft(fr))
        hz = np.fft.rfftfreq(win, 1 / sr)
        e = sp.sum()
        cs.append((i / sr, (sp * hz).sum() / e if e > 1e-6 else 0, e))
    cs = [c for c in cs if c[2] > 1e-3]
    if not cs:
        return None
    cent = [c[1] for c in cs]
    thr = min(cent) + 0.55 * (max(cent) - min(cent))
    for i, (t, c, e) in enumerate(cs):
        if c > thr and i + 2 < len(cs) and cs[i + 1][1] > thr and cs[i + 2][1] > thr:
            return max(0.0, t - 0.015)
    return None


def cut_initial(src, dst):
    """切掉声母，只留带调韵母（en 这类引擎不辨调的音节用真实字来切）"""
    x, sr = load(src)
    t = vowel_onset(src)
    if t is None:
        raise RuntimeError('找不到韵母起点')
    out = x[int(t * sr):].copy()
    f = int(0.008 * sr)
    out[:f] *= np.linspace(0, 1, f, dtype=np.float32)
    out[-f:] *= np.linspace(1, 0, f, dtype=np.float32)
    save(out, sr, dst)


async def synth(item, sem, stats, tmp):
    dst = os.path.join(OUT, item['file'])
    if not FORCE and os.path.exists(dst) and os.path.getsize(dst) > 1200:
        stats['skip'] += 1
        return
    async with sem:
        raw = os.path.join(tmp, item['id'] + '.mp3')
        wav = os.path.join(tmp, item['id'] + '.wav')
        out_wav = os.path.join(tmp, item['id'] + '_t.wav')
        for attempt in range(3):
            try:
                await edge_tts.Communicate(item['text'], VOICE).save(raw)
                if os.path.getsize(raw) < 500:
                    raise RuntimeError('empty audio')
                to_wav(raw, wav)
                if item.get('cut'):
                    # en 这类「单独读引擎不分调」的韵母：从真实字里切掉声母
                    cut_initial(wav, out_wav)
                elif item['kind'] == 'tonefin' and item.get('tone') == 1:
                    try:
                        make_level(wav, out_wav, 0.45)
                    except Exception as e:
                        stats['level_fallback'].append(f"{item['id']}: {e}")
                        trim(wav, out_wav, 0.6)
                else:
                    trim(wav, out_wav, 0.85 if item['kind'] == 'blend' else 0.7)
                encode(out_wav, dst)
                stats['ok'] += 1
                break
            except Exception as e:
                if attempt == 2:
                    stats['fail'].append(f"{item['id']}: {e}")
                await asyncio.sleep(0.5)


def verify():
    rep = []
    print('== 校验：每段只读一遍 + 带调韵母调型 ==')
    multi, missing, bad_tone = [], [], []
    for it in items:
        p = os.path.join(OUT, it['file'])
        if not os.path.exists(p):
            missing.append(it['id'])
            continue
        segs = voice_segments(p)
        if len(segs) > 2:      # 一句话最多一次微停顿
            multi.append(f"{it['id']}({len(segs)}段)")
        if it['kind'] != 'tonefin':
            continue
        st = pitch_contour(p)
        if st is None:
            bad_tone.append(f"{it['key']}:无浊音")
            continue
        slope = float(st[2] - st[0])
        tone = it['tone']
        if tone == 1:
            ok = abs(slope) < 1.2
        elif tone == 2:
            ok = slope > 1.0
        elif tone == 3:
            ok = st[1] <= min(st[0], st[2]) + 0.5 and slope > -0.8
        else:
            ok = slope < -1.5
        rep.append({'key': it['key'], 'text': it['text'], 'tone': tone,
                    'st': [round(float(x), 2) for x in st], 'slope': round(slope, 2), 'ok': bool(ok)})
        if not ok:
            bad_tone.append(f"{it['key']}({it['text']}) 首尾差{slope:+.2f}")
        print(f"  {it['key']:9s} {it['text']:3s} 声调{tone} {st[0]:+6.2f}{st[1]:+7.2f}{st[2]:+7.2f} "
              f"{slope:+6.2f} {'OK' if ok else '需修'}")
    json.dump(rep, open(REPORT, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(f"\n缺文件 {len(missing)}；读多段（>2）{len(multi)}；调型不合规 {len(bad_tone)}")
    for x in (missing[:6] + multi[:6] + bad_tone[:6]):
        print('  -', x)
    return not (missing or multi or bad_tone)


async def main():
    if not VERIFY_ONLY:
        os.makedirs(OUT, exist_ok=True)
        sem = asyncio.Semaphore(6)
        stats = {'ok': 0, 'skip': 0, 'fail': [], 'level_fallback': []}
        tmp = tempfile.mkdtemp(prefix='zh_tts_')
        await asyncio.gather(*[synth(it, sem, stats, tmp) for it in items])
        shutil.rmtree(tmp, ignore_errors=True)
        print(f"新录 {stats['ok']}，跳过 {stats['skip']}，失败 {len(stats['fail'])}，"
              f"一声回退 {len(stats['level_fallback'])}")
        for x in stats['fail'][:10]:
            print('  FAIL', x)
        for x in stats['level_fallback'][:10]:
            print('  一声未能平直（保留自然版）:', x)

    # 音频清单（Service Worker 预缓存用）
    files = sorted(f for f in os.listdir(OUT) if f.endswith('.m4a'))
    keep = {it['file'] for it in items}
    orphans = [f for f in files if f not in keep]
    lines = ['/* 由 tools/zh_tts_build.py 自动生成，勿手工编辑 */',
             'self.ZH_AUDIO_LIST = [']
    for i, f in enumerate(files):
        comma = ',' if i < len(files) - 1 else ''
        lines.append(f'  "audio/zh/{f}?{AUDIO_VER}"{comma}')
    lines.append('];')
    open(LIST_JS, 'w', encoding='utf-8').write('\n'.join(lines) + '\n')
    total = sum(os.path.getsize(os.path.join(OUT, f)) for f in files) / 1024 / 1024
    print(f'清单 {len(files)} 段 / {total:.2f} MB；孤儿 {len(orphans)} 个' +
          (('：' + ', '.join(orphans[:8])) if orphans else ''))
    ok = verify()
    shutil.rmtree(_ANALYSE_DIR, ignore_errors=True)
    print('\n校验结果：' + ('全部通过 ✓' if ok else '有项目不通过 ✗'))


asyncio.run(main())
