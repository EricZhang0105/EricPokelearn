# -*- coding: utf-8 -*-
"""分析 Hamburg 音素文件的分段结构：每段的时长、谱质心、周期性（判断是纯音还是带元音）"""
import io, os, re, json, html, urllib.request, subprocess, tempfile
import numpy as np
import imageio_ffmpeg

FF = imageio_ffmpeg.get_ffmpeg_exe()
UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36'
CACHE = r'D:/WorkBuddy-workspace/_ipa_src/cache'
SR = 22050

TARGETS = {
    'p': 'https://englishexplorations.check.uni-hamburg.de/wp-content/uploads/2019/07/p.mp3',
    't': 'https://englishexplorations.check.uni-hamburg.de/wp-content/uploads/2019/07/t.mp3',
    'k': 'https://englishexplorations.check.uni-hamburg.de/wp-content/uploads/2019/07/k.mp3',
    's': 'https://englishexplorations.check.uni-hamburg.de/wp-content/uploads/2019/07/s.mp3',
    'm': 'https://englishexplorations.check.uni-hamburg.de/wp-content/uploads/2019/07/m.mp3',
    'i': 'https://englishexplorations.check.uni-hamburg.de/wp-content/uploads/2019/07/i.mp3',
    'ae': 'https://englishexplorations.check.uni-hamburg.de/wp-content/uploads/2019/07/ae.mp3',
    'ei': 'https://englishexplorations.check.uni-hamburg.de/wp-content/uploads/2019/07/ei.mp3',
    'oi': 'https://englishexplorations.check.uni-hamburg.de/wp-content/uploads/2019/07/oi.mp3',
    'arrr': 'https://englishexplorations.check.uni-hamburg.de/wp-content/uploads/2019/04/arrr.mp3',
    'urn': 'https://englishexplorations.check.uni-hamburg.de/wp-content/uploads/2019/04/urn.mp3',
    'sh': 'https://englishexplorations.check.uni-hamburg.de/wp-content/uploads/2019/07/sh.mp3',
}


def get_pcm(url):
    if not os.path.isdir(CACHE):
        os.makedirs(CACHE)
    mp3 = os.path.join(CACHE, url.rsplit('/', 1)[-1])
    if not os.path.exists(mp3):
        rq = urllib.request.Request(url, headers={'User-Agent': UA})
        io.open(mp3, 'wb').write(urllib.request.urlopen(rq, timeout=40).read())
    w = mp3 + '.wav'
    if not os.path.exists(w):
        subprocess.run([FF, '-y', '-loglevel', 'error', '-i', mp3, '-ac', '1', '-ar', str(SR), w], check=True)
    d = io.open(w, 'rb').read()
    i = d.find(b'data')
    return np.frombuffer(d[i + 8:], dtype='<i2').astype(np.float32) / 32768.0


def analyze(pcm):
    frame = int(SR * 0.01)
    n = pcm.size // frame
    fr = pcm[:n * frame].reshape(n, frame)
    env = np.sqrt((fr ** 2).mean(axis=1))
    peak = float(np.abs(pcm).max())
    thr = max(0.012, peak * 0.06)
    on = env > thr
    # 连通段（允许 3 帧空隙）
    segs = []
    i = 0
    while i < n:
        if on[i]:
            j = i
            gap = 0
            k = i
            while k < n:
                if on[k]:
                    j = k
                    gap = 0
                else:
                    gap += 1
                    if gap > 5:
                        break
                k += 1
            segs.append((i, j))
            i = k
        else:
            i += 1
    out = []
    for (a, b) in segs:
        if b - a < 3:
            continue
        seg = fr[a:b + 1].reshape(-1)
        dur = (b - a + 1) * 0.01
        S = np.abs(np.fft.rfft(seg * np.hanning(seg.size)))
        f = np.fft.rfftfreq(seg.size, 1.0 / SR)
        cen = float((S * f).sum() / (S.sum() + 1e-9))
        # 周期性：自相关峰值（延时 60-400Hz 基频）
        x = seg - seg.mean()
        ac = np.correlate(x, x, 'full')[x.size - 1:]
        lo, hi = int(SR / 400), int(SR / 60)
        pv = float(ac[lo:hi].max() / (ac[0] + 1e-9)) if hi <= ac.size else 0.0
        rms = float(np.sqrt((seg ** 2).mean()))
        out.append(dict(start=round(a * 0.01, 2), dur=round(dur, 2), cen=round(cen),
                        per=round(pv, 2), rms=round(rms, 3)))
    return out


for name, u in TARGETS.items():
    pcm = get_pcm(u)
    segs = analyze(pcm)
    print('%-5s total %.2fs segs %d' % (name, pcm.size / SR, len(segs)))
    for s in segs:
        print('     ', s)
