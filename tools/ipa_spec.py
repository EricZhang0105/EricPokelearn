# -*- coding: utf-8 -*-
"""按段算 频谱质心 / 主峰频率 / 谐波性，区分「摩擦音」和「元音」。"""
import os, sys
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ipa_fetch_online as F

KEYS = ['c_th', 'c_dh', 'c_sh', 'c_zh', 'c_ch', 'c_j', 'c_w', 'c_y']


def desc(pcm, sr=F.SR):
    if pcm.size < 1024:
        return (0, 0)
    w = np.hanning(pcm.size)
    S = np.abs(np.fft.rfft(pcm * w))
    f = np.fft.rfftfreq(pcm.size, 1 / sr)
    S = S / (S.sum() + 1e-12)
    cen = float((f * S).sum())
    # 平滑后找主峰（避开直流）
    k = max(1, int(0.00012 * sr))
    sm = np.convolve(S, np.ones(k) / k, mode='same')
    peak = float(f[np.argmax(sm[10:]) + 10])
    return cen, peak


for k in KEYS:
    sym, kind, src, mode = F.PLAN[k]
    b, url = F.get(k, src)
    pcm = F.decode(b)
    db, hf, per, hop = F.frame_feats(pcm)
    segs = F.segs_of(db > max(-58.0, db.max() - 30.0), hop)
    print('== %-5s %s' % (k, sym))
    for a, c in segs:
        d = (c - a) * hop
        if d < 0.10:
            continue
        s, e = int(a * hop * F.SR), min(pcm.size, int((c + 1) * hop * F.SR))
        ch = pcm[s:e]
        cen, pk = desc(ch)
        cen0, pk0 = desc(ch[:int(0.12 * F.SR)]) if ch.size > int(0.12 * F.SR) else (cen, pk)
        print('   %.2fs  centroid=%4.0fHz peak=%4.0fHz | first120ms centroid=%4.0fHz peak=%4.0fHz'
              % (d, cen, pk, cen0, pk0))
