# -*- coding: utf-8 -*-
"""四声辨调音频调型修复（v66）
=====================================================================
问题：audio/zh/tone_<base>_<t>.m4a 由 edge-tts 读单字 "${hz}。" 生成，
      但 zh_tts_build.py 的 flatten_trend()/make_level() 只作用于
      声母/韵母/tonefin，四声辨调的 tone_* 用了裸 TTS 输出。
      edge-tts 读单音节必掉 50-70Hz：一声(屋 wū)末尾掉成降调、听感像三四声；
      三声(晚 wǎn)降升幅度被压到 2 半音、听感偏平像一声。

修复：用 Praat PSOLA 按目标声调重塑 F0 曲线，保留时长/音色/字本体。
      一声=高平、二声=升、三声=降升、四声=降；锚点取该字自身中位音高，
      因此不改动整体音高（仍锁定 zh-CN-XiaoxiaoNeural 一把女声）。

用法：
  python tools/zh_tone_fix.py            # 修复并写回（自动备份原文件）
  python tools/zh_tone_fix.py --verify   # 只校验当前调型，不改文件
依赖： pip install praat-parselmouth imageio-ffmpeg numpy
"""
import os, sys, io, json, shutil, subprocess, tempfile
import numpy as np
import imageio_ffmpeg, parselmouth
from parselmouth.praat import call

FF = imageio_ffmpeg.get_ffmpeg_exe()
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D = os.path.join(ROOT, 'audio', 'zh')
BAK = os.path.join(D, '_bak_tone_v8')
REPORT = os.path.join(ROOT, 'tools', 'zh_tone_report.json')
VERIFY = '--verify' in sys.argv

# 与 ZH_TONES 一致：base -> 四声示范字
GROUPS = {
    'ma':   ['妈','麻','马','骂'],
    'ba':   ['八','拔','把','爸'],
    'yi':   ['衣','姨','椅','意'],
    'wu':   ['屋','无','五','雾'],
    'hu':   ['呼','湖','虎','户'],
    'xi':   ['西','习','洗','细'],
    'wan':  ['弯','完','晚','万'],
    'tang': ['汤','糖','躺','烫'],
}
# 目标调型（相对中位音高的半音，起点/中点/终点）。
# 一声抬高 +2 半音更"高平"；三声尾只回到接近起点（不冲太高），中间压低形成明显降升。
SHAPES = {
    1: [2.0, 2.0, 2.0],
    2: [-3.5, 0.0, 3.5],
    3: [0.0, -5.0, -0.5],
    4: [3.0, 0.0, -4.5],
}

# ---------- F0 提取（纯 numpy 自相关，跨环境一致） ----------
def decode(path):
    w = tempfile.mktemp(suffix='.wav')
    subprocess.run([FF,'-y','-loglevel','error','-i',path,'-vn','-ac','1','-ar','16000',
                    '-acodec','pcm_s16le',w], check=True)
    d = io.open(w,'rb').read(); os.unlink(w)
    return np.frombuffer(d[d.find(b'data')+8:], dtype='<i2').astype(np.float32)/32768.0, 16000

def f0_track(pcm, sr, fmin=75, fmax=420, hop=0.01, win=0.04):
    h=int(sr*hop); w=int(sr*win); lo=int(sr/fmax); hi=int(sr/fmin)
    out=[]
    for i in range(max(1,(pcm.size-w)//h+1)):
        s=pcm[i*h:i*h+w].copy()
        if np.sqrt((s**2).mean())<0.025: out.append(0.0); continue
        s-=s.mean()
        ac=np.correlate(s,s,'full')[w-1:]
        ac=ac[:hi+1]
        if ac[lo:hi].size==0: out.append(0.0); continue
        k=lo+int(np.argmax(ac[lo:hi]))
        out.append(sr/k if k>0 else 0.0)
    return np.array(out)

def contour3(pcm, sr):
    """返回 (首,中,尾) 半音相对中位 + 绝对 Hz 三点，用于判定调型。
    用 Praat To Pitch（权威算法）+ 跳变过滤，避免自相关在 PSOLA 起音段把倍频误判成低音。"""
    import tempfile
    w=tempfile.mktemp(suffix='.wav')
    import wave
    with wave.open(w,'wb') as f:
        f.setnchannels(1); f.setsampwidth(2); f.setframerate(sr)
        f.writeframes((np.clip(pcm,-1,1)*32767).astype('<i2').tobytes())
    snd=parselmouth.Sound(w); os.unlink(w)
    pp=snd.to_pitch(time_step=0.01, pitch_floor=75, pitch_ceiling=500)
    f0=np.array([x for x in pp.selected_array['frequency'] if x>0])
    if len(f0)<8: return None
    # 滤掉相邻 >8 半音的倍频跳变
    keep=[0]
    for i in range(1,len(f0)):
        if abs(np.log2(f0[i]/f0[keep[-1]]))<8/12: keep.append(i)
    v=f0[keep]
    n=len(v); e=max(2,int(n*0.12)); core=v[e:n-e]
    if len(core)<4: core=v
    med=float(np.median(core))
    seg=max(2,len(core)//5)
    a=float(np.median(core[:seg]))
    b=float(np.median(core[len(core)//3:2*len(core)//3]))
    c=float(np.median(core[-seg:]))
    st=lambda hz: float(round(12*np.log2(hz/med),1))
    return {'hz':[int(round(a)),int(round(b)),int(round(c))], 'st':[st(a),st(b),st(c)]}

def judge(c, tone):
    """按半音首/中/尾判定调型是否达标。"""
    a,b,cc=c['st']
    if tone==1:  ok = max(a,b,cc)-min(a,b,cc) < 2.5            # 高平
    elif tone==2: ok = cc-a > 2.0                              # 升
    elif tone==3: ok = b < a-1.2 and b < cc-1.2                # 降升(中最低)
    else:         ok = cc-a < -2.0                             # 降
    return bool(ok)

# ---------- PSOLA 按目标调型重塑 ----------
def to_wav(src, dst):
    subprocess.run([FF,'-y','-loglevel','error','-i',src,'-vn','-ac','1','-ar','44100',
                    '-acodec','pcm_s16le',dst], check=True)

def reshape(src_wav, dst_wav, tone):
    snd=parselmouth.Sound(src_wav)
    man=call(snd,'To Manipulation',0.01,75,600)
    pt=call(man,'Extract pitch tier')
    n=int(call(pt,'Get number of points'))
    if n<3: raise RuntimeError('音高点太少')
    ts=[float(call(pt,'Get time from index',i)) for i in range(1,n+1)]
    fs=[float(call(pt,'Get value at index',i)) for i in range(1,n+1)]
    med=float(np.median(fs))
    t0,t1=ts[0],ts[-1]; dur=max(t1-t0,1e-6)
    shape=SHAPES[tone]
    call(pt,'Remove points between', snd.xmin-1, snd.xmax+1)
    # 用足够密的等距点重建曲线；首尾各留一个点贴住原音高的自然起止，避免爆音
    grid=np.linspace(t0,t1,max(16,n))
    for t in grid:
        u=(t-t0)/dur
        if u<0.5: semi=shape[0]+(shape[1]-shape[0])*(u/0.5)
        else:     semi=shape[1]+(shape[2]-shape[1])*((u-0.5)/0.5)
        # 起音/收尾 8% 内平滑回原音高，防止 PSOLA 边界突变
        edge=min(u,1-u)
        if edge<0.08:
            w=edge/0.08
            orig=12*np.log2(max(np.interp(t,ts,fs),1e-3)/med)
            semi=semi*w+orig*(1-w)
        f=med*2**(semi/12)
        call(pt,'Add point',float(t),float(np.clip(f,90,500)))
    call([man,pt],'Replace pitch tier')
    out=call(man,'Get resynthesis (overlap-add)')
    out.save(dst_wav,'WAV')

def encode_m4a(wav, dst):
    subprocess.run([FF,'-y','-loglevel','error','-i',wav,'-vn','-ac','1','-ar','44100',
                    '-b:a','96k','-movflags','+faststart',dst], check=True)

# ---------- 主流程 ----------
def main():
    if not VERIFY and not os.path.isdir(BAK):
        os.makedirs(BAK)
    report=[]
    for base,hzs in GROUPS.items():
        for tone in range(1,5):
            key=f'tone_{base}_{tone}'
            src=os.path.join(D,key+'.m4a')
            if not os.path.exists(src):
                print(f'{key:14s} MISSING'); continue
            before=contour3(*decode(src))
            ok_before=judge(before,tone)
            if VERIFY:
                report.append({'key':key,'hz':hzs[tone-1],'tone':tone,
                               'before':before,'ok':ok_before})
                print(f'{key:14s} {hzs[tone-1]} 第{tone}声  {before["hz"]}Hz '
                      f'{before["st"]}半音  {"OK" if ok_before else "需修"}')
                continue
            # 备份原文件（仅一次）
            bak=os.path.join(BAK,key+'.m4a')
            if not os.path.exists(bak): shutil.copy2(src,bak)
            # 重塑
            wav=tempfile.mktemp(suffix='.wav'); outw=tempfile.mktemp(suffix='.wav')
            to_wav(src,wav); reshape(wav,outw,tone); encode_m4a(outw,src)
            os.unlink(wav); os.unlink(outw)
            after=contour3(*decode(src))
            ok_after=judge(after,tone)
            report.append({'key':key,'hz':hzs[tone-1],'tone':tone,
                           'before':before,'after':after,'ok':ok_after})
            print(f'{key:14s} {hzs[tone-1]} 第{tone}声  '
                  f'{before["hz"]}→{after["hz"]}Hz  '
                  f'{before["st"]}→{after["st"]}半音  '
                  f'{"OK" if ok_after else "**仍需修**"}')
    json.dump(report, open(REPORT,'w',encoding='utf-8'), ensure_ascii=False, indent=1)
    bad=[r for r in report if not r['ok']]
    print(f'\n共 {len(report)} 段；调型不合规 {len(bad)} 段'
          + ('' if not bad else '：'+', '.join(r['key'] for r in bad)))
    print('报告：', REPORT)
    if bad: sys.exit(2)

if __name__=='__main__':
    main()
