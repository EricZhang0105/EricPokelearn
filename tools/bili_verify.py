# -*- coding: utf-8 -*-
"""声学验证：确认从视频切出的音素是真的对应音标发音，不是字母名/例词。"""
import wave, numpy as np, os, json, subprocess
import imageio_ffmpeg
FF=imageio_ffmpeg.get_ffmpeg_exe()
D=r'D:/WorkBuddy-workspace/趣味学习/audio/ipa'

def dec_m4a(p):
    import tempfile
    tf=tempfile.mktemp(suffix='.wav')
    subprocess.run([FF,'-y','-loglevel','error','-i',p,'-ac','1','-ar','22050',tf],check=True)
    w=wave.open(tf,'rb'); sr=w.getframerate()
    x=np.frombuffer(w.readframes(w.getnframes()),dtype='<i2').astype(np.float32)/32768
    w.close()
    try: os.remove(tf)
    except: pass
    return x,sr

def feats(x,sr):
    hop=int(sr*0.01); win=int(sr*0.03)
    n=(x.size-win)//hop+1
    rms=np.array([np.sqrt((x[i*hop:i*hop+win]**2).mean()) for i in range(n)])
    db=20*np.log10(rms+1e-9)
    on=db>max(db.max()-28,-48)
    centers=[]
    for i in range(n):
        seg=x[i*hop:i*hop+win]
        if seg.size<win: seg=np.pad(seg,(0,win-seg.size))
        S=np.abs(np.fft.rfft(seg*np.hanning(win)))
        f=np.fft.rfftfreq(win,1/sr)
        if S.sum()>1e-6: centers.append((S*f).sum()/S.sum())
    c=np.array(centers)
    # F0 周期性（自相关）
    per=0
    for i in range(0,n,3):
        seg=x[i*hop:i*hop+int(sr*0.04)]
        if seg.size<int(sr*0.04): continue
        seg=np.pad(seg,(0,int(sr*0.04)-seg.size))
        ac=np.correlate(seg,seg,'full')[len(seg)-1:]
        lo=int(sr/300); hi=int(sr/70)
        if hi<len(ac): per=max(per, ac[lo:hi].max()/(ac[0]+1e-9))
    return len(x)/sr, (c.mean() if len(c) else 0), per, on.sum()*0.01

keys=['c_p','c_b','c_t','c_d','c_k','c_g','c_f','c_v','c_s','c_z','c_th','c_dh',
      'c_sh','c_zh','c_ch','c_j','c_h','c_m','c_n','c_ng','c_l','c_r','c_w','c_y',
      'v_ih','v_ii','v_e','v_ae','v_o','v_uu','v_oo','v_er','v_ei','v_ou']
print('%-10s %5s %7s %6s %6s' % ('key','dur','centHz','per','voice'))
for k in keys:
    p=os.path.join(D,k+'.m4a')
    if not os.path.exists(p): continue
    x,sr=dec_m4a(p)
    dur,c,per,voice=feats(x,sr)
    print('%-10s %5.2f %7.0f %6.2f %6.2f' % (k,dur,c,per,voice))
