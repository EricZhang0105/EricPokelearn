# -*- coding: utf-8 -*-
"""把视频帧拼成联系表：每帧裁出右上角音标符号 + 底部例词，标注帧号(≈时间)。"""
from PIL import Image, ImageDraw
import os, glob

D = r'D:/WorkBuddy-workspace/_ipa_src/bframes'
fs = sorted(glob.glob(D + '/b_*.jpg'))
# 每帧 320x180；裁上半部靠右的音标 + 底部例词条，简化：直接缩放整帧到 320x180
tw, th = 320, 180
cols = 4
per_sheet = 16   # 4x4
for s in range(0, len(fs), per_sheet):
    chunk = fs[s:s+per_sheet]
    rows = (len(chunk) + cols - 1) // cols
    sheet = Image.new('RGB', (cols*tw, rows*(th+22)), 'white')
    dr = ImageDraw.Draw(sheet)
    for i, f in enumerate(chunk):
        im = Image.open(f).convert('RGB').resize((tw, th))
        x = (i % cols) * tw
        y = (i // cols) * (th+22)
        sheet.paste(im, (x, y+22))
        idx = int(os.path.basename(f).split('_')[1].split('.')[0])
        t = (idx-1)*2
        dr.text((x+4, y+4), 'F%02d t=%ds' % (idx, t), fill='red')
    out = r'D:/WorkBuddy-workspace/_ipa_src/sheet_%02d.jpg' % (s//per_sheet)
    sheet.save(out, quality=85)
    print(out)
