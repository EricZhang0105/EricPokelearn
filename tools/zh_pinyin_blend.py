# -*- coding: utf-8 -*-
"""生成中文拼读第4步的「拼读过渡音」py_<syl>.m4a。

Eric 2026-11-17 指定（板书规则：ang → áng → h~áng → háng）：
「声母发音拉长一些，然后加上带声调的韵母」—— h~~~~áng 连读，
让孩子听到「拼」的过程，末尾再由 data.js 接第5步完整音节 háng。

方案（v2，2026-11-17 二次修复：解决「含糊 + 卡段」）：
- 旧方案从 initial_h（呼读音"he"含元音 e）+ tonefin 拼接：元音被 atempo
  拉长发闷，且 e→a 跳变 = 含糊 + 断开。
- 新方案直接从**完整清晰音节 syl_<syl>** 构造：
  1) 用 ZCR 找元音起点，之前是纯声母起音（擦音/送气音是纯气流噪声）；
  2) 取起音里能量平稳的核心噪声段，用波形重复(overlap-add)平滑拉长到
     ~0.36s（纯噪声重复无金属音，实测振幅平滑度远优于 atempo）；
  3) 20ms 交叉淡化接回原音节的带调韵母部分。
  全程同一把女声、同一音节内部拼接 -> 音色一致、无元音跳变、无静音断音。
- 短塞音/鼻音（b/d/g/l/m/n，起音<0.08s，没有可拉长的持续气流）不重复，
  直接用完整音节 syl_<syl>（避免把 40ms 爆破音拉成金属音）。

用法：
  python tools/zh_pinyin_blend.py hang        # 只做一个（原型）
  python tools/zh_pinyin_blend.py             # 全部 63 个
"""
import os, sys, subprocess, wave, tempfile
import numpy as np
import imageio_ffmpeg
import re

FF = imageio_ffmpeg.get_ffmpeg_exe()
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ZH = os.path.join(ROOT, 'audio', 'zh')
SR = 44100
TARGET_ONSET = 0.36   # 送气/擦音声母气流拉长目标时长（秒）
LONG_INI = set('hkpt')  # 起音有纯气流可拉长的声母

# syl -> (ini, fin, tone) 映射
src = open(os.path.join(ROOT, 'js', 'zh-phonics.js'), encoding='utf-8').read()
ROWS = [(m.group(3), m.group(1), m.group(2), int(m.group(4)))
        for m in re.finditer(
            r"\{ini:'([^']+)',fin:'([^']+)',\s*syl:'([^']+)',\s*tone:(\d+)", src)]
BY_SYLL = {syl: (ini, fin, tone) for syl, ini, fin, tone in ROWS}


def decode(path):
    tf = tempfile.mktemp(suffix='.wav')
    subprocess.run([FF, '-y', '-v', 'quiet', '-i', path, '-ac', '1', '-ar', str(SR), tf], check=True)
    w = wave.open(tf, 'rb')
    x = np.frombuffer(w.readframes(w.getnframes()), dtype='<i2').astype(np.float32) / 32768
    w.close(); os.remove(tf)
    return x


def trim_sil(x, thr=0.03):
    """裁掉首尾静音"""
    w = int(SR * 0.005); n = len(x) // w
    if n < 2: return x
    env = np.array([np.sqrt((x[i*w:i*w+w]**2).mean()) for i in range(n)])
    if env.max() == 0: return x
    idx = np.where(env > thr * env.max())[0]
    return x[idx[0]*w:(idx[-1]+1)*w] if len(idx) else x


def vowel_start(a):
    """用能量+过零率找元音起点：能量达峰值30%且ZCR降到<0.06(浊音)的第一帧"""
    fl = int(SR * 0.01); env = []; zcs = []
    for i in range(len(a) // fl):
        s = a[i*fl:(i+1)*fl]
        env.append(np.sqrt((s**2).mean()))
        zcs.append(np.mean(np.diff(np.sign(s)) != 0))
    env = np.array(env); zcs = np.array(zcs); pk = env.max() or 1
    for i in range(len(env)):
        if env[i] > 0.3*pk and zcs[i] < 0.06 and env[i] > 0.05:
            return i * fl
    return int(0.1 * SR)


def core_noise(x):
    """取起音里能量最平稳的核心段（>=60%峰值的最长连续区）"""
    w = int(SR * 0.005); n = len(x) // w
    if n < 2: return x
    env = np.array([np.sqrt((x[i*w:i*w+w]**2).mean()) for i in range(n)])
    hi = np.where(env >= 0.6 * env.max())[0]
    return x[hi[0]*w:(hi[-1]+1)*w] if len(hi) >= 2 else x


def repeat_stretch(x, target, seed=0):
    """拉长纯气流噪声到 target 秒：随机循环移位重复 + overlap-add。
    关键（v3，2026-11-17）：完全复制同一段 core 会产生强周期性
    （实测相关 0.829，19.5ms 周期 = 51Hz 音高 = 电流声/蜂鸣）。
    每次重复前做随机循环移位 + 轻微增益扰动，把周期性打破到 0.135
    （自然 h 参考 0.175），同时保持恒幅、频谱包络不变、时长精确。"""
    core = core_noise(x)
    if len(core) < int(SR * 0.015):
        core = trim_sil(x, thr=0.25)
    rng = np.random.default_rng(seed)
    out = core.copy()
    step = max(1, int(len(core) * 0.8))
    n = min(int(SR * 0.004), step)
    fade = np.linspace(0, 1, n)
    guard = 0
    while len(out)/SR < target and guard < 400:
        guard += 1
        seg = core[:step].copy()
        shift = int(rng.integers(0, max(1, len(seg))))
        seg = np.roll(seg, shift)          # 随机相位 -> 打破周期性(去电流声)
        seg *= rng.uniform(0.92, 1.08)     # 轻微增益起伏 -> 更像自然气流
        if len(seg) >= 2*n:
            seg[:n] *= fade
            seg[-n:] *= fade[::-1]
        m = min(n, len(out), len(seg))
        out[-m:] = out[-m:] * (1 - fade[-m:]) + seg[:m] * fade[-m:]
        out = np.concatenate([out, seg[m:]])
    return out[:int(target * SR)]


def crossfade(a, b, n):
    n = min(n, len(a), len(b))
    if n <= 0: return np.concatenate([a, b])
    fade = np.linspace(0, 1, n)
    return np.concatenate([a[:-n], a[-n:]*(1-fade) + b[:n]*fade, b[n:]])


def make(syl):
    info = BY_SYLL.get(syl)
    if not info:
        return False, 'no syllabus info'
    ini, fin, tone = info
    syl_p = os.path.join(ZH, 'syl_%s.m4a' % syl)
    if not os.path.exists(syl_p):
        return False, '%s missing' % syl_p

    a = decode(syl_p)
    if ini in LONG_INI:
        vi = vowel_start(a)
        onset = trim_sil(a[:vi])
        vowel = a[vi:]
        if len(onset)/SR >= 0.05:
            # seed 由音节名派生 -> 每次重制同一音节结果一致，可复现
            seed = sum(ord(c) for c in syl)
            onset_s = repeat_stretch(onset, TARGET_ONSET, seed=seed)
            out = crossfade(onset_s, vowel, int(SR * 0.02))
        else:
            out = a  # 起音太短，忽略
    else:
        # 塞音/鼻音无持续气流，直接用完整音节（不硬拉，避免金属音）
        out = a

    # 首尾淡入淡出：开头 12ms 淡入消除「电流声」的起始 click
    # （旧版 6ms 时开头 2ms 仍有 0.0486 突变，自然 h 仅 0.0032）
    fi = int(SR * 0.012)
    out[:fi] *= np.linspace(0, 1, fi)
    out[-fi:] *= np.linspace(1, 0, fi)

    dst = os.path.join(ZH, 'py_%s.m4a' % syl)
    tf = tempfile.mktemp(suffix='.wav')
    with wave.open(tf, 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((np.clip(out, -1, 1) * 32767).astype('<i2').tobytes())
    subprocess.run([FF, '-y', '-v', 'quiet', '-i', tf,
                    '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11',
                    '-ac', '1', '-ar', str(SR), '-c:a', 'aac', '-b:a', '96k', dst], check=True)
    os.remove(tf)
    tag = '拉长' if (ini in LONG_INI and len(trim_sil(a[:vowel_start(a)]))/SR >= 0.05) else '原音节'
    return True, '%.2fs %s ini=%s' % (len(out)/SR, tag, ini)


if __name__ == '__main__':
    only = sys.argv[1:]
    todo = [syl for syl, _, _, _ in ROWS if (not only or syl in only)]
    ok = fail = 0
    for syl in todo:
        good, msg = make(syl)
        if good: ok += 1; print('%-6s %s' % (syl, msg))
        else: fail += 1; print('FAIL %-6s %s' % (syl, msg))
    print('\nOK %d FAIL %d' % (ok, fail))
