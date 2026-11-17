# -*- coding: utf-8 -*-
"""检测中文拼读关键音频的基频(F0)轨迹，判断声调是否正确。
一声=高平、二声=升、三声=降升、四声=降。"""
import io, os, subprocess, tempfile, math
import numpy as np
import imageio_ffmpeg
FF = imageio_ffmpeg.get_ffmpeg_exe()
D = r'D:/WorkBuddy-workspace/趣味学习/audio/zh'

def decode(path):
    w = tempfile.mktemp(suffix='.wav')
    subprocess.run([FF,'-y','-loglevel','error','-i',path,'-vn','-ac','1','-ar','16000','-acodec','pcm_s16le',w],check=True)
    d = io.open(w,'rb').read(); os.unlink(w)
    return np.frombuffer(d[d.find(b'data')+8:],dtype='<i2').astype(np.float32)/32768.0, 16000

def f0_track(pcm, sr, fmin=80, fmax=400, hop=0.02, win=0.05):
    h=int(sr*hop); w=int(sr*win)
    n=max(1,(pcm.size-w)//h+1)
    out=[]
    lo=int(sr/fmax); hi=int(sr/fmin)
    for i in range(n):
        s=pcm[i*h:i*h+w].copy()
        rms=float(np.sqrt((s**2).mean()))
        if rms<0.02: out.append(0); continue
        s-=s.mean()
        ac=np.correlate(s,s,'full')[w-1:]
        ac=ac[:hi+1]
        if ac[lo:hi].size==0: out.append(0); continue
        k=lo+int(np.argmax(ac[lo:hi]))
        out.append(sr/k if k>0 else 0)
    return np.array(out)

def slope(f0):
    v=f0[f0>0]
    if len(v)<4: return 0,0,0
    # 取前 70% 有效帧做线性斜率（避开句尾掉音）
    m=max(4,int(len(v)*0.7)); v=v[:m]
    x=np.arange(len(v))
    sl=float(np.polyfit(x,v,1)[0])
    return sl, float(v[0]), float(v[-1])

NAMES={'final_u':'一声? 应为高平','tonefin_u_1':'一声 高平','tonefin_u_2':'二声 升',
 'tonefin_u_3':'三声 降升','tonefin_u_4':'四声 降','initial_b':'声母玻 平',
 'syl_bu':'四声 不 降','blend_bu':'四声 不+不要'}

for k in ['final_u','tonefin_u_1','tonefin_u_2','tonefin_u_3','tonefin_u_4','initial_b','syl_bu','blend_bu']:
    p=os.path.join(D,k+'.m4a')
    if not os.path.exists(p):
        print('%-14s MISSING'%k); continue
    pcm,sr=decode(p)
    f0=f0_track(pcm,sr)
    sl,a,b=slope(f0)
    print('%-14s dur=%.2fs F0首%.0f→尾%.0f 斜率=%+.2f/帧  [%s]'%(k,pcm.size/sr,a,b,sl,NAMES.get(k,'')))
