# -*- coding: utf-8 -*-
"""校验 45 段音素片段「能不能听清」。

2026-11-16 第二次重做后，除了原来的清浊/共振峰，还要盯住「可听性」——
上一版就是栽在这里：/b/ 只有 55ms、/f/ 前面 66ms 静音，iPad 上听着像卡住。

四个硬指标：
  1) 时长       < 0.12s 直接判废（那么短只能是咔哒声）
  2) 响度       RMS 必须落在 -30 ~ -14 dBFS（擦音原来峰值归一，实际小 10dB）
  3) 首尾静音   首 > 30ms / 尾 > 60ms 判废（开头一段空白听着就是「没读出来」）
  4) 内部断音   中间出现 > 40ms 的能量塌陷 → 听感是「卡一下」
  5) 类别声学   清擦音无浊音、浊擦音有浊音、鼻音/近音高浊音、/s/ 高频重心高

用法：python tools/ipa_check.py
"""
import os, subprocess, sys, tempfile
import numpy as np
import parselmouth
import imageio_ffmpeg

FF = imageio_ffmpeg.get_ffmpeg_exe()
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIR = os.path.join(ROOT, 'audio', 'ipa')
TMP = tempfile.mkdtemp(prefix='ipa_check_')

PURE_VOICELESS = {'c_f', 'c_th', 'c_s', 'c_sh', 'c_h'}      # 纯清擦音：不该有周期性
VOICED_FRIC = {'c_v', 'c_z', 'c_zh'}                        # 浊擦音：必须有周期性
SONORANT = {'c_m', 'c_n', 'c_ng', 'c_l', 'c_r'}             # 鼻音/近音：全程浊
CV_STOP = {'c_p', 'c_b', 'c_t', 'c_d', 'c_k', 'c_g',
           'c_ch', 'c_j', 'c_w', 'c_y', 'c_dh'}             # 辅音 + 极短元音

# 女声元音 F1/F2 参考区间（Hz，美式 GA，宽区间，只用来抓明显切错）
VREF = {
    'v_ih': (300, 700, 1850, 2900), 'v_e': (450, 850, 1750, 2600),
    'v_ae': (650, 1100, 1550, 2400), 'v_uh': (550, 950, 1100, 1800),
    'v_o': (650, 1100, 900, 1500), 'v_uu': (300, 650, 850, 1650),
    'v_schwa': (350, 800, 1150, 2100), 'v_ii': (200, 500, 2200, 3300),
    'v_oo': (200, 620, 900, 1900),   # 这把女声的 GOOSE 前化（F2 实测 ~1700），/ʊ/ 只有 ~1040，两者仍分得开
    'v_er': (380, 750, 1050, 1850), 'v_schwa_r': (380, 750, 1000, 1850),
}


def to_wav(src):
    dst = os.path.join(TMP, os.path.basename(src) + '.wav')
    subprocess.run([FF, '-y', '-v', 'quiet', '-i', src, '-ac', '1', '-ar', '44100', dst], check=True)
    return dst


def analyse(p):
    snd = parselmouth.Sound(to_wav(p))
    d = snd.get_total_duration()
    x = np.array(snd.values[0], dtype=np.float32)
    sr = int(snd.sampling_frequency)
    rms = float(np.sqrt(np.mean(x ** 2))) if x.size else 0.0
    rms_db = 20 * np.log10(max(rms, 1e-9))
    peak = float(np.max(np.abs(x))) if x.size else 0.0

    hop = int(sr * 0.01)
    n = max(1, len(x) // hop)
    env = np.array([np.sqrt(np.mean(x[i * hop:(i + 1) * hop] ** 2)) for i in range(n)], dtype=np.float32)
    live = np.where(env > max(env.max() * 0.05, 1e-4))[0]
    lead = live[0] * 0.01 if live.size else d
    tail = d - (live[-1] + 1) * 0.01 if live.size else d
    # 内部断音：有声段之间最长的一段低谷
    gap = 0.0
    if live.size:
        runs, prev = [], live[0]
        for i in live[1:]:
            if i - prev > 1:
                runs.append((prev, i))
            prev = i
        gap = max([(b - a) * 0.01 for a, b in runs], default=0.0)

    try:
        pp = snd.to_pitch(time_step=0.01, pitch_floor=90, pitch_ceiling=600)
        f0 = pp.selected_array['frequency']
        voiced = float(np.mean(f0 > 0)) if f0.size else 0.0
    except Exception:
        voiced = 0.0
    # 谐噪比：擦音是噪音，Praat 的基频跟踪会把噪音误判成「有浊音」（/f/ 实测报 1.00），
    # 只有 HNR 能把清擦音（8–11dB）和浊擦音/鼻音（13–18dB）分开
    try:
        h = snd.to_harmonicity_cc(time_step=0.005, minimum_pitch=60.0)
        hv = h.values[0]
        hv = hv[np.isfinite(hv)]
        hnr = float(np.median(hv)) if hv.size else 0.0
    except Exception:
        hnr = 0.0

    f1 = f2 = 0.0
    try:
        fm = snd.to_formant_burg(max_number_of_formants=5.0, maximum_formant=5500.0)
        xs = fm.xs()
        lo, hi = int(len(xs) * 0.3), int(len(xs) * 0.7)
        a1, a2 = [], []
        for i in range(lo, hi):
            t = xs[i]
            a, b = fm.get_value_at_time(1, t), fm.get_value_at_time(2, t)
            if a and a == a:
                a1.append(a)
            if b and b == b:
                a2.append(b)
        f1 = float(np.median(a1)) if a1 else 0.0
        f2 = float(np.median(a2)) if a2 else 0.0
    except Exception:
        pass

    # 频谱重心：/s/ /ʃ/ 这类擦音的能量集中在高频
    w = x * np.hanning(len(x))
    sp = np.abs(np.fft.rfft(w))
    fr = np.fft.rfftfreq(len(x), 1 / sr)
    cen = float(np.sum(fr * sp) / (np.sum(sp) + 1e-9))
    return dict(d=d, rms_db=rms_db, peak=peak, lead=lead, tail=tail, gap=gap,
                voiced=voiced, hnr=hnr, f1=f1, f2=f2, cen=cen)


def main():
    files = sorted(f for f in os.listdir(DIR) if f.endswith('.m4a'))
    if not files:
        print('没有音频，先跑 tools/ipa_build.py')
        return 1
    bad = []
    print(f'{"key":10s}{"秒":>5s}{"dBFS":>7s}{"首静":>6s}{"尾静":>6s}{"断音":>6s}{"浊":>5s}{"HNR":>6s}{"重心":>6s}  判断')
    for f in files:
        key = f[:-4]
        a = analyse(os.path.join(DIR, f))
        flag = 'ok'
        if a['d'] < 0.12:
            flag = f'太短({a["d"]*1000:.0f}ms)'
        elif a['rms_db'] < -30:
            flag = f'太小声({a["rms_db"]:.0f}dBFS)'
        elif a['lead'] > 0.03:
            flag = f'开头静音{a["lead"]*1000:.0f}ms'
        elif a['tail'] > 0.06:
            flag = f'结尾静音{a["tail"]*1000:.0f}ms'
        elif a['gap'] > 0.04:
            flag = f'中间断音{a["gap"]*1000:.0f}ms'

        if flag == 'ok':
            # 清擦音 HNR 实测 7.6–11.0，浊擦音 13–17，12.5 是能分开的那条线
            if key in PURE_VOICELESS and a['hnr'] > 12.5:
                flag = f'清擦音却有谐波结构(HNR {a["hnr"]:.1f})'
            elif key in VOICED_FRIC and a['hnr'] < 12.0:
                flag = f'浊擦音几乎没有谐波(HNR {a["hnr"]:.1f})'
            elif key in SONORANT and (a['hnr'] < 12.5 or a['voiced'] < 0.70):
                flag = f'鼻音/近音不够浊(HNR {a["hnr"]:.1f} 浊率 {a["voiced"]:.2f})'
            elif key in CV_STOP and a['voiced'] < 0.25:
                flag = f'几乎无元音起音({a["voiced"]:.2f})'
        if flag == 'ok' and key in ('c_s', 'c_sh') and a['cen'] < 2200:
            flag = f'擦音重心偏低({a["cen"]:.0f}Hz)'
        if flag == 'ok' and key in ('c_m', 'c_n') and a['cen'] > 2200:
            flag = f'鼻音重心偏高({a["cen"]:.0f}Hz)'
        if flag == 'ok' and key in VREF:
            lo1, hi1, lo2, hi2 = VREF[key]
            if not (lo1 <= a['f1'] <= hi1):
                flag = f'F1={a["f1"]:.0f} 越界[{lo1},{hi1}]'
            elif not (lo2 <= a['f2'] <= hi2):
                flag = f'F2={a["f2"]:.0f} 越界[{lo2},{hi2}]'
        if flag == 'ok' and key.startswith('v_') and a['voiced'] < 0.55:
            flag = f'元音浊音率偏低({a["voiced"]:.2f})'

        if flag != 'ok':
            bad.append((key, flag))
        print(f'{key:10s}{a["d"]:5.2f}{a["rms_db"]:7.1f}{a["lead"]*1000:6.0f}{a["tail"]*1000:6.0f}'
              f'{a["gap"]*1000:6.0f}{a["voiced"]:5.2f}{a["hnr"]:6.1f}{a["cen"]:6.0f}  {flag}')

    print(f'\n共 {len(files)} 段，可疑 {len(bad)} 段')
    for k, v in bad:
        print('  !', k, v)
    return 0


sys.exit(main())
