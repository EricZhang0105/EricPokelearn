# -*- coding: utf-8 -*-
"""对音频每个发声段的中点抽一帧，拼联系表，用于人工读出每段对应的音标符号。"""
import wave, numpy as np, subprocess, os, json
import imageio_ffmpeg
from PIL import Image, ImageDraw

WAV = r'D:/WorkBuddy-workspace/_ipa_src/bili.wav'
VID = r'D:/WorkBuddy-workspace/_ipa_src/bili_video.mp4'
OUT = r'D:/WorkBuddy-workspace/_ipa_src/segframes'
os.makedirs(OUT, exist_ok=True)
ff = imageio_ffmpeg.get_ffmpeg_exe()

w = wave.open(WAV, 'rb')
sr = w.getframerate()
d = np.frombuffer(w.readframes(w.getnframes()), dtype='<i2').astype(np.float32) / 32768
hop = int(sr * 0.02); win = int(sr * 0.04)
n = (d.size - win) // hop + 1
rms = np.array([np.sqrt((d[i*hop:i*hop+win] ** 2).mean()) for i in range(n)])
db = 20 * np.log10(rms + 1e-9)
thr = max(db.max() - 34, -48)
on = db > thr
idx = np.where(on)[0]
segs = []
if len(idx):
    a = p = idx[0]
    for k in idx[1:]:
        if (k - p) * (hop / sr) >= 0.28:
            segs.append((a * hop / sr, p * hop / sr)); a = k
        p = k
    segs.append((a * hop / sr, p * hop / sr))

json.dump(segs, open(r'D:/WorkBuddy-workspace/_ipa_src/segs.json', 'w'))
print('segments', len(segs))

# 每段中点抽帧
frames = []
for i, (t0, t1) in enumerate(segs):
    mid = (t0 + t1) / 2
    fp = os.path.join(OUT, 's_%03d.jpg' % (i+1))
    subprocess.run([ff, '-y', '-loglevel', 'error', '-ss', '%.2f' % mid, '-i', VID,
                    '-frames:v', '1', '-q:v', '3', fp], check=True)
    frames.append((i+1, t0, t1, fp))

# 拼联系表，每帧裁右上音标区 + 底部例词条
tw, th = 300, 170
cols, per = 4, 16
for s in range(0, len(frames), per):
    chunk = frames[s:s+per]
    rows = (len(chunk) + cols - 1) // cols
    sheet = Image.new('RGB', (cols*tw, rows*(th+22)), 'white')
    dr = ImageDraw.Draw(sheet)
    for i, (num, t0, t1, fp) in enumerate(chunk):
        im = Image.open(fp).convert('RGB')
        # 裁右上音标区(约 x 60%-100%, y 0-55%) + 底部文字(y 82%-100%) 拼一起
        W, H = im.size
        ipa = im.crop((int(W*0.62), 0, W, int(H*0.55)))
        bot = im.crop((0, int(H*0.80), W, H))
        card = Image.new('RGB', (tw, th), 'white')
        card.paste(ipa.resize((int(tw*0.42), int(th*0.78))), (int(tw*0.55), 4))
        card.paste(bot.resize((tw, int(th*0.22))), (0, int(th*0.78)))
        x = (i % cols) * tw; y = (i // cols) * (th+22)
        sheet.paste(card, (x, y+22))
        dr.text((x+3, y+3), 'S%02d %.1f-%.1f' % (num, t0, t1), fill='red')
    out = r'D:/WorkBuddy-workspace/_ipa_src/map_%02d.jpg' % (s//per)
    sheet.save(out, quality=88)
    print(out)
