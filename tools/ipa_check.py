# -*- coding: utf-8 -*-
"""校验 44 个音素片段切得对不对。

听不到声音的时候，用两个硬指标判断：
  1) 清/浊 —— 清辅音（p t k f θ s ʃ h tʃ）几乎无周期性，浊辅音和元音有稳定基频。
     切错段最常见的表现就是「清辅音的浊音率很高」（说明切到后面的元音了）。
  2) 共振峰 —— 元音的 F1/F2 有公认区间，切到别的元音会直接越界。

用法：python tools/ipa_check.py
"""
import os, re, subprocess, sys, tempfile
import numpy as np
import parselmouth
import imageio_ffmpeg

FF = imageio_ffmpeg.get_ffmpeg_exe()
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIR = os.path.join(ROOT, 'audio', 'ipa')
TMP = tempfile.mkdtemp(prefix='ipa_check_')

VOICELESS = {'c_p', 'c_t', 'c_k', 'c_f', 'c_th', 'c_s', 'c_sh', 'c_h', 'c_ch'}
# 女声元音 F1/F2 参考区间（Hz，宽区间，只用来抓明显切错）
VREF = {
    'v_ih': (330, 600, 1800, 2700), 'v_e': (450, 750, 1700, 2500),
    'v_ae': (650, 1000, 1500, 2200), 'v_uh': (550, 850, 1100, 1700),
    'v_o': (450, 750, 750, 1150), 'v_uu': (300, 550, 850, 1400),
    'v_schwa': (400, 700, 1200, 1900), 'v_ii': (200, 450, 2200, 3100),
    'v_aa': (650, 1050, 950, 1500), 'v_aw': (350, 700, 650, 1050),
    'v_oo': (200, 450, 650, 1150), 'v_er': (400, 700, 1200, 1800),
}


def to_wav(src):
    dst = os.path.join(TMP, os.path.basename(src) + '.wav')
    subprocess.run([FF, '-y', '-v', 'quiet', '-i', src, '-ac', '1', '-ar', '44100', dst], check=True)
    return dst


def analyse(p):
    snd = parselmouth.Sound(to_wav(p))
    d = snd.get_total_duration()
    x = np.array(snd.values[0], dtype=np.float32)
    peak = float(np.max(np.abs(x))) if x.size else 0.0
    # 浊音率
    try:
        pp = snd.to_pitch(time_step=0.01, pitch_floor=90, pitch_ceiling=600)
        f0 = pp.selected_array['frequency']
        voiced = float(np.mean(f0 > 0)) if f0.size else 0.0
        f0med = float(np.median(f0[f0 > 0])) if np.any(f0 > 0) else 0.0
    except Exception:
        voiced, f0med = 0.0, 0.0
    # 共振峰（取中间 40% 的中位数）
    f1 = f2 = 0.0
    try:
        fm = snd.to_formant_burg(max_number_of_formants=5.0, maximum_formant=5500.0)
        n = len(fm.xs())
        lo, hi = int(n * 0.3), int(n * 0.7)
        a1, a2 = [], []
        for i in range(lo, hi):
            t = fm.xs()[i]
            a, b = fm.get_value_at_time(1, t), fm.get_value_at_time(2, t)
            if a and a == a:
                a1.append(a)
            if b and b == b:
                a2.append(b)
        f1 = float(np.median(a1)) if a1 else 0.0
        f2 = float(np.median(a2)) if a2 else 0.0
    except Exception:
        pass
    return d, peak, voiced, f0med, f1, f2


def main():
    files = sorted(f for f in os.listdir(DIR) if f.endswith('.m4a'))
    if not files:
        print('没有音频，先跑 tools/ipa_build.py')
        return 1
    bad = []
    print(f'{"key":9s} {"秒":>5s} {"峰值":>5s} {"浊音率":>6s} {"F0":>5s} {"F1":>5s} {"F2":>5s}  判断')
    for f in files:
        key = f[:-4]
        p = os.path.join(DIR, f)
        d, peak, voiced, f0, f1, f2 = analyse(p)
        flag = 'ok'
        if d < 0.05:
            flag = '太短'
        elif peak < 0.05:
            flag = '几乎无声'
        if key in VOICELESS and voiced > 0.35:
            flag = f'清辅音却有大段浊音({voiced:.2f})'
        if key not in VOICELESS and key.startswith('c_') and voiced < 0.30:
            flag = f'浊辅音却几乎无浊音({voiced:.2f})'
        if key.startswith('v_') and voiced < 0.55:
            flag = f'元音浊音率偏低({voiced:.2f})'
        if key in VREF:
            lo1, hi1, lo2, hi2 = VREF[key]
            if not (lo1 <= f1 <= hi1):
                flag = f'F1={f1:.0f} 越界[{lo1},{hi1}]'
            elif not (lo2 <= f2 <= hi2):
                flag = f'F2={f2:.0f} 越界[{lo2},{hi2}]'
        if flag != 'ok':
            bad.append((key, flag))
        print(f'{key:9s} {d:5.2f} {peak:5.2f} {voiced:6.2f} {f0:5.0f} {f1:5.0f} {f2:5.0f}  {flag}')

    print(f'\n共 {len(files)} 段，可疑 {len(bad)} 段')
    for k, v in bad:
        print('  !', k, v)
    return 0


sys.exit(main())
