# -*- coding: utf-8 -*-
"""分析 B 站「48个英语音标标准美音发音」音频的分段结构。"""
import wave, numpy as np

WAV = r'D:/WorkBuddy-workspace/_ipa_src/bili.wav'
w = wave.open(WAV, 'rb')
sr = w.getframerate()
d = np.frombuffer(w.readframes(w.getnframes()), dtype='<i2').astype(np.float32) / 32768
dur = d.size / sr

hop = int(sr * 0.02)   # 20ms
win = int(sr * 0.04)   # 40ms
n = (d.size - win) // hop + 1
rms = np.array([np.sqrt((d[i*hop:i*hop+win] ** 2).mean()) for i in range(n)])
db = 20 * np.log10(rms + 1e-9)

# 阈值：峰值以下 34dB
thr = max(db.max() - 34, -48)
on = db > thr

# 合并间隙 < 0.25s 的段（同一音标念多遍算一段）
idx = np.where(on)[0]
segs = []
if len(idx):
    a = p = idx[0]
    for k in idx[1:]:
        gap = (k - p) * (hop / sr)
        if gap >= 0.28:
            segs.append((a, p))
            a = k
        p = k
    segs.append((a, p))

print('dur %.1fs  peak %.1fdB  thr %.1fdB  segments %d' % (dur, db.max(), thr, len(segs)))
for i, (a, b) in enumerate(segs):
    t0 = a * hop / sr
    t1 = b * hop / sr
    # 段内再次细分（看有没有念多遍）
    sub = []
    ii = np.where(on[a:b+1])[0]
    if len(ii):
        aa = pp = ii[0]
        for k in ii[1:]:
            if (k - pp) * (hop / sr) >= 0.18:
                sub.append(((aa+pp)*hop/sr/2 + a*hop/sr/2, (pp)*hop/sr)); aa = k
            pp = k
    print('%2d  %6.2f - %6.2f  dur=%4.2fs' % (i+1, t0, t1, t1-t0))
