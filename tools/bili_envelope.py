# -*- coding: utf-8 -*-
"""画几个代表段的 ASCII 能量包络，判断视频读的是纯音标还是例词三连。"""
import wave, numpy as np, json
WAV = r'D:/WorkBuddy-workspace/_ipa_src/bili.wav'
w = wave.open(WAV, 'rb'); sr = w.getframerate()
d = np.frombuffer(w.readframes(w.getnframes()), dtype='<i2').astype(np.float32)/32768

def env(t0, t1, label):
    a, b = int(t0*sr), int(t1*sr)
    x = d[a:b]
    hop = int(sr*0.02); win = int(sr*0.04)
    n = (x.size-win)//hop+1
    r = np.array([np.sqrt((x[i*hop:i*hop+win]**2).mean()) for i in range(n)])
    db = 20*np.log10(r+1e-9)
    print('\n==',label,'%.1f-%.1f'%(t0,t1))
    for i in range(0,n,1):
        v = db[i]
        bar = '#'*max(0,int((v+55)/2.5))
        print('%5.2f %6.1f %s'%(t0+i*0.02, v, bar))

segs = json.load(open(r'D:/WorkBuddy-workspace/_ipa_src/segs.json'))
# 扩到段前后各 0.5s 看停顿
for si, name in [(0,'S01 p 第1遍'),(16,'S17 f 第1遍'),(18,'S19 v 第1遍'),(24,'S25 s 第1遍')]:
    t0,t1 = segs[si]
    env(t0-0.4, t1+0.6, name)
