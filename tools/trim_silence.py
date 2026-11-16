# -*- coding: utf-8 -*-
"""英文语音库：裁掉每段录音首尾的静音。

为什么需要：
  edge-tts 输出的 mp3 头尾各带 0.2s / 0.9s 静音，tts_build.py 早期没做裁剪，
  于是「three」这种单词音频长 1.51s，实际发音只有 0.38s。
  数学算式是「数字词 + plus/minus/equals」逐段拼接播放，5 段就白等 5.6 秒静音，
  听起来像 0.5 倍速。裁掉首尾静音后 0.43s，恢复正常语速。

只裁首尾，不动句中的停顿（silenceremove start_periods=1 + areverse 各一次）。
裁完补 40ms 头部、50ms 尾部余量，避免起音被切掉产生爆音。

用法：
    python tools/trim_silence.py            # 处理全部
    python tools/trim_silence.py --dry      # 只统计，不改文件
    python tools/trim_silence.py --limit 10 # 只处理前 10 个（试跑）
"""
import os, re, subprocess, sys
import imageio_ffmpeg

FF = imageio_ffmpeg.get_ffmpeg_exe()
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIRS = [os.path.join(ROOT, 'audio', 'words')]
SR, BR = 44100, '96k'

# 只裁首尾：开头连续静音删一段 → 反转 → 再删一段 → 反转回来
FILTER = (
    'silenceremove=start_periods=1:start_duration=0.02:start_threshold=-45dB:detection=peak,'
    'areverse,'
    'silenceremove=start_periods=1:start_duration=0.02:start_threshold=-45dB:detection=peak,'
    'areverse,'
    'adelay=delays=40:all=1,apad=pad_dur=0.05'
)

DRY = '--dry' in sys.argv
LIMIT = None
if '--limit' in sys.argv:
    LIMIT = int(sys.argv[sys.argv.index('--limit') + 1])


def dur(path):
    r = subprocess.run([FF, '-i', path], capture_output=True, text=True, errors='ignore')
    m = re.search(r'Duration: (\d+):(\d+):([\d.]+)', r.stderr)
    if not m:
        return None
    h, mi, s = m.groups()
    return int(h) * 3600 + int(mi) * 60 + float(s)


def main():
    files = []
    for d in DIRS:
        if not os.path.isdir(d):
            continue
        for f in sorted(os.listdir(d)):
            if f.endswith('.m4a'):
                files.append(os.path.join(d, f))
    if LIMIT:
        files = files[:LIMIT]

    before = after = 0.0
    changed = skipped = failed = 0
    for i, p in enumerate(files, 1):
        d0 = dur(p)
        if d0 is None:
            failed += 1
            continue
        before += d0
        if DRY:
            after += d0
            continue
        tmp = p + '.trim.m4a'
        try:
            r = subprocess.run(
                [FF, '-y', '-v', 'error', '-i', p, '-af', FILTER,
                 '-ac', '1', '-ar', str(SR), '-c:a', 'aac', '-b:a', BR, tmp],
                capture_output=True, timeout=120)
            if r.returncode != 0 or not os.path.exists(tmp) or os.path.getsize(tmp) < 800:
                if os.path.exists(tmp):
                    os.remove(tmp)
                failed += 1
                after += d0
                continue
            d1 = dur(tmp)
            # 裁完不足 120ms 视为异常（可能整段都是静音），保留原文件
            if not d1 or d1 < 0.12:
                os.remove(tmp)
                skipped += 1
                after += d0
                continue
            os.replace(tmp, p)
            after += d1
            changed += 1
        except Exception as e:
            if os.path.exists(tmp):
                try:
                    os.remove(tmp)
                except Exception:
                    pass
            failed += 1
            after += d0
        if i % 100 == 0:
            print(f'  ...{i}/{len(files)}')

    print(f'\n文件 {len(files)} 个：裁剪 {changed}，异常保留 {skipped}，失败 {failed}')
    print(f'总时长 {before:.1f}s → {after:.1f}s（省 {before - after:.1f}s）')
    print('注意：文件内容变了，必须把 tools/tts_build.py 的 AUDIO_VER +1 并重新生成 audio-map.js')


main()
