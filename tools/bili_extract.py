# -*- coding: utf-8 -*-
"""从 B 站「48个英语音标标准美音发音」视频切出 App 音素的真人发音。

视频每个音标读两遍，取第 1 遍（奇数段）。段→音标经联系表人工识别确认。
输出 audio/ipa/<key>.m4a，只去静音 + 响度归一，不改音高/不变速/不拼接。
视频没有的 ɚ / ɔr 保留原 Commons 素材，不覆盖。
"""
import wave, numpy as np, subprocess, os, json
import imageio_ffmpeg

FF = imageio_ffmpeg.get_ffmpeg_exe()
WAV = r'D:/WorkBuddy-workspace/_ipa_src/bili.wav'
OUTDIR = r'D:/WorkBuddy-workspace/趣味学习/audio/ipa'
segs = json.load(open(r'D:/WorkBuddy-workspace/_ipa_src/segs.json'))
w = wave.open(WAV, 'rb'); SR = w.getframerate()
d = np.frombuffer(w.readframes(w.getnframes()), dtype='<i2').astype(np.float32)/32768

# 视频段序号(1-based) → App key。只列视频里有的音标（第1遍=奇数段）。
MAP = {
    # 24 辅音
    1:'c_p', 3:'c_b', 5:'c_t', 7:'c_d', 9:'c_ch', 11:'c_j', 13:'c_k', 15:'c_g',
    17:'c_f', 19:'c_v', 21:'c_th', 23:'c_dh', 25:'c_s', 27:'c_z', 29:'c_sh', 31:'c_zh',
    33:'c_h', 35:'c_m', 37:'c_n', 39:'c_ng', 41:'c_l', 43:'c_r', 45:'c_w', 47:'c_y',
    # 元音/双元音/儿化
    49:'v_ei', 51:'v_ai', 53:'v_oi', 55:'v_ou', 57:'v_au',
    59:'v_ie', 61:'v_ea', 63:'v_ue', 67:'v_o', 69:'v_ih', 71:'v_ii',
    73:'v_e', 75:'v_er', 77:'v_ae', 79:'v_aar', 81:'v_uh', 83:'v_o',  # S83=ɑ 与 v_o 同
    85:None, 87:'v_uu', 89:'v_oo', 91:'v_schwa',
}
# 注：S67 符号是 ɑ (father-palm-calm)，S83 也是 ɑ (not-wasp-god)。
# App 只有 v_o=ɑ 一个格子，用 S67（更清晰、开口更大）。故去掉 83 映射。
MAP[83] = None

def save_m4a(pcm, path, target_db=-17.0):
    win = int(SR*0.01)
    n = (pcm.size-win)//win+1
    rms = np.array([np.sqrt((pcm[i*win:i*win+win]**2).mean()) for i in range(n)])
    db = 20*np.log10(rms+1e-9)
    on = np.where(db > max(db.max()-30, -50))[0]
    if len(on)==0: return 0
    a = max(0, (on[0]-2)*win); b = min(pcm.size, (on[-1]+3)*win)
    seg = pcm[a:b]
    r = np.sqrt((seg**2).mean())
    if r>1e-6: seg = seg * (10**(target_db/20))/r
    seg = np.clip(seg, -1, 1)
    pad = int(SR*0.06)
    seg = np.pad(seg, (pad,pad))
    fi = int(SR*0.008); fo = int(SR*0.04)
    seg[:fi] *= np.linspace(0,1,fi); seg[-fo:] *= np.linspace(1,0,fo)
    tw = path+'.wav'
    with wave.open(tw,'wb') as ww:
        ww.setnchannels(1); ww.setsampwidth(2); ww.setframerate(SR)
        ww.writeframes((seg*32767).astype('<i2').tobytes())
    subprocess.run([FF,'-y','-loglevel','error','-i',tw,'-c:a','aac','-b:a','96k',path],check=True)
    os.remove(tw)
    return len(seg)/SR

if __name__=='__main__':
    os.makedirs(OUTDIR, exist_ok=True)
    used={}; report=[]
    for segnum,key in sorted(MAP.items()):
        if not key: continue
        t0,t1 = segs[segnum-1]
        pcm = d[int(t0*SR):int(t1*SR)]
        if pcm.size==0:
            print('SKIP empty',segnum,key); continue
        dur = save_m4a(pcm, os.path.join(OUTDIR,key+'.m4a'))
        used[key]=segnum
        report.append({'key':key,'seg':segnum,'dur':round(dur,2)})
        print('%-12s S%02d  %.2fs' % (key,segnum,dur))
    print('\nused',len(used))
    # App 45 key 全覆盖检查
    ALL=['v_ih','v_e','v_ae','v_uh','v_o','v_uu','v_schwa','v_ii','v_oo','v_er','v_schwa_r',
     'v_ei','v_ou','v_oi','v_ai','v_au','v_aar','v_awr','v_ie','v_ea','v_ue',
     'c_p','c_b','c_t','c_d','c_k','c_g','c_f','c_v','c_s','c_z','c_h','c_m','c_n','c_ng',
     'c_l','c_r','c_th','c_dh','c_sh','c_zh','c_ch','c_j','c_w','c_y']
    print('视频未覆盖(保留原素材):', [k for k in ALL if k not in used])
    json.dump(report, open(r'D:/WorkBuddy-workspace/_ipa_src/bili_report.json','w'))
