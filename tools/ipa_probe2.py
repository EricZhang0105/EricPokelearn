# -*- coding: utf-8 -*-
"""探测 Iowa Sounds of Speech 里这些音素的孤立录音是否存在，并给出时长。"""
import io, os, sys, json, subprocess, tempfile, urllib.request, urllib.error
import numpy as np
import imageio_ffmpeg

FF = imageio_ffmpeg.get_ffmpeg_exe()
UA = 'PokeLearnAudio/2.1 (offline kids learning app; eric.zhangjihuan@gmail.com)'
SR = 22050

CAND = [
    'p-sound', 'b-sound', 't-sound', 'd-sound', 'k-sound', 'g-sound',
    'f-sound', 'v-sound', 's-sound', 'z-sound', 'h-sound',
    'm-sound', 'n-sound', 'ng-sound', 'l-sound', 'r-sound',
    'sh-sound', 'zh-sound', 'ch-sound', 'j-sound', 'w-sound', 'y-sound',
    'th-sound', 'dh-sound', 'voiceless-th-sound', 'voiced-th-sound',
    'th(as in think)-sound', 'th(as in this)-sound',
]


def get(url):
    rq = urllib.request.Request(url, headers={'User-Agent': UA})
    return urllib.request.urlopen(rq, timeout=40).read()


def dur_of(b):
    tmp = tempfile.mktemp(suffix='.mp4'); io.open(tmp, 'wb').write(b)
    w = tempfile.mktemp(suffix='.wav')
    subprocess.run([FF, '-y', '-loglevel', 'error', '-i', tmp, '-vn', '-ac', '1',
                    '-ar', str(SR), '-acodec', 'pcm_s16le', w], check=True)
    d = io.open(w, 'rb').read(); os.unlink(tmp); os.unlink(w)
    pcm = np.frombuffer(d[d.find(b'data') + 8:], dtype='<i2').astype(np.float32) / 32768.0
    # 有效发声时长
    n = int(SR * 0.02)
    k = pcm.size // n
    if k == 0:
        return pcm.size / SR, 0.0
    rms = np.sqrt((pcm[:k * n].reshape(k, n) ** 2).mean(axis=1))
    on = rms > max(rms.max() * 0.03, 1e-4)
    return pcm.size / SR, float(on.sum() * 0.02)


for c in CAND:
    u = 'https://soundsofspeech.uiowa.edu/assets/phonemes/%s/examples/sound.mp4' % c
    try:
        b = get(u)
        if b[4:8] != b'ftyp':
            print('%-26s no-mp4 %d bytes' % (c, len(b))); continue
        d, on = dur_of(b)
        print('%-26s OK  dur=%.2fs voiced=%.2fs %dKB' % (c, d, on, len(b) // 1024))
    except urllib.error.HTTPError as e:
        print('%-26s HTTP %s' % (c, e.code))
    except Exception as e:
        print('%-26s ERR %s' % (c, str(e)[:60]))
