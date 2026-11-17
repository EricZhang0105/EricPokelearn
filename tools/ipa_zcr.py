# -*- coding: utf-8 -*-
"""对候选音源按段计算 零交叉率 / 频谱平坦度，客观判断哪一段是辅音、哪一段是元音。"""
import io, os, sys, math
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ipa_fetch_online as F

KEYS = ['c_th', 'c_dh', 'c_sh', 'c_zh', 'c_ch', 'c_j', 'c_w', 'c_y',
        'c_b', 'c_d', 'c_g', 'c_p', 'c_t', 'c_k']


def feats(pcm, sr=F.SR):
    n = pcm.size
    if n < 512:
        return 0, 0, 0
    zcr = float(np.mean(np.abs(np.diff(np.sign(pcm))) > 0))
    w = np.hanning(min(n, 4096))
    s = pcm[:w.size] * w
    S = np.abs(np.fft.rfft(s)) + 1e-12
    P = S / S.sum()
    flat = float(np.exp(np.mean(np.log(P))))
    hf = float(S[np.fft.rfftfreq(w.size, 1 / sr) > 2500].sum() / S.sum())
    return zcr, flat, hf


for k in KEYS:
    sym, kind, src, mode = F.PLAN[k]
    b, url = F.get(k, src)
    pcm = F.decode(b)
    db, hf, per, hop = F.frame_feats(pcm)
    segs = F.segs_of(db > max(-58.0, db.max() - 30.0), hop)
    print('== %-6s %-3s %-5s total=%.2fs' % (k, sym, kind, pcm.size / F.SR))
    for a, c in segs:
        d = (c - a) * hop
        if d < 0.05:
            continue
        s, e = int(a * hop * F.SR), min(pcm.size, int((c + 1) * hop * F.SR))
        chunk = pcm[s:e]
        z, fl, h = feats(chunk)
        # 每个片段再取前 100ms（辅音/过渡通常在音节开头）
        z0, fl0, h0 = feats(chunk[:int(0.10 * F.SR)]) if chunk.size > int(0.10 * F.SR) else (z, fl, h)
        print('   %.2f-%.2f %.2fs  all zcr=%.3f flat=%.3f hf=%.2f | first100ms zcr=%.3f flat=%.3f hf=%.2f'
              % (a * hop, c * hop, d, z, fl, h, z0, fl0, h0))
