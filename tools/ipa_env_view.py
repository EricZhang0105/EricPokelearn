# -*- coding: utf-8 -*-
"""把 m4a 的能量包络画成字符图，用来肉眼确认「是不是单音、有没有多余音节」"""
import io, os, subprocess, tempfile, sys
import numpy as np
import imageio_ffmpeg

FF = imageio_ffmpeg.get_ffmpeg_exe()
SR = 22050
D = r'D:/WorkBuddy-workspace/趣味学习/audio/ipa'


def env_of(path):
    w = tempfile.mktemp(suffix='.wav')
    subprocess.run([FF, '-y', '-loglevel', 'error', '-i', path, '-ac', '1', '-ar', str(SR), w], check=True)
    d = io.open(w, 'rb').read(); os.unlink(w)
    i = d.find(b'data')
    pcm = np.frombuffer(d[i + 8:], dtype='<i2').astype(np.float32) / 32768.0
    fr = int(SR * 0.02)
    n = pcm.size // fr
    env = np.sqrt((pcm[:n * fr].reshape(n, fr) ** 2).mean(axis=1) + 1e-12)
    db = 20 * np.log10(env + 1e-9)
    return db, pcm.size / SR


for name in sys.argv[1:]:
    p = os.path.join(D, name + '.m4a')
    db, dur = env_of(p)
    print('== %-10s %.2fs  frames %d' % (name, dur, db.size))
    for k, v in enumerate(db):
        bar = int(max(0, (v + 60)) / 60 * 48)
        print('  %5.2f %6.1f %s' % (k * 0.02, v, '#' * bar))
