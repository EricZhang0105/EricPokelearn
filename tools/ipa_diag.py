# -*- coding: utf-8 -*-
"""诊断当前 audio/ipa/*.m4a 的实际声学内容：分段 / 每段时长 / 频谱质心 / 周期性。
质心高 + 周期性低 = 清辅音/摩擦音；质心低 + 周期性高 = 元音（说明截到了 uh，读错了）。"""
import io, os, sys, numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ipa_fetch_online as F

AUD = r'D:/WorkBuddy-workspace/趣味学习/audio/ipa'

def analyze(key):
    path = os.path.join(AUD, key + '.m4a')
    if not os.path.exists(path):
        return key, 'MISSING'
    pcm = F.decode(io.open(path, 'rb').read())
    db, hf, per, hop = F.frame_feats(pcm)
    thr = max(-58.0, float(db.max()) - 30.0)
    on = db > thr
    segs = [s for s in F.segs_of(on, hop) if (s[1]-s[0])*hop >= 0.04]
    parts = []
    for a, b in segs:
        d = (b-a)*hop
        c = float(hf[a:b+1].mean())
        p = float(per[a:b+1].mean())
        # 判读：元音 = 低质心且高周期性
        tag = 'VOWEL?' if (c < 0.30 and p > 0.55) else ('cons' if c > 0.30 else '?')
        parts.append('%.2fs/c%.2f/p%.2f/%s' % (d, c, p, tag))
    return key, '%.2fs segs=%d | %s' % (pcm.size/F.SR, len(segs), ' '.join(parts))

if __name__ == '__main__':
    keys = sys.argv[1:]
    if not keys:
        keys = [k for k in F.PLAN if k.startswith('c_')]
    for k in keys:
        kk, info = analyze(k)
        print('%-8s %s' % (kk, info))
