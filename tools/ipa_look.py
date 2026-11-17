# -*- coding: utf-8 -*-
"""打印 8 个 Commons 辅音音源的完整分段结构，判断该用 main 还是 onset。"""
import io, os, sys, math
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ipa_fetch_online as F

KEYS = ['c_th', 'c_dh', 'c_sh', 'c_zh', 'c_ch', 'c_j', 'c_w', 'c_y', 'c_b', 'c_d', 'c_g',
        'c_p', 'c_t', 'c_k']

for k in KEYS:
    sym, kind, src, mode = F.PLAN[k]
    b, url = F.get(k, src)
    pcm = F.decode(b)
    db, hf, per, hop = F.frame_feats(pcm)
    thr = max(-58.0, db.max() - 30.0)
    segs = F.segs_of(db > thr, hop)
    print('== %-6s %-3s %-6s total=%.2fs segs=%d' % (k, sym, kind, pcm.size / F.SR, len(segs)))
    for a, c in segs:
        d = (c - a) * hop
        if d < 0.04:
            continue
        print('    [%.2f-%.2f] %.2fs hf=%.2f per=%.2f' %
              (a * hop, c * hop, d, float(np.mean(hf[a:c + 1])), float(np.mean(per[a:c + 1]))))
