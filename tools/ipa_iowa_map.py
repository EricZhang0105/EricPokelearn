# -*- coding: utf-8 -*-
"""从 Iowa 的 main.js 里提取 音素 → folderName 映射（含英语专用表）。"""
import io, re

h = io.open('D:/WorkBuddy-workspace/_ipa_src/iowa_main.js', encoding='utf-8').read()

# 找出 English 的 phonemeList
m = re.search(r'phonemeList:\[([^\]]*)\]', h)
print('phonemeList:', m.group(1) if m else 'none')

pairs = set()
for mm in re.finditer(r'\{[^{}]{0,260}?folderName:"([a-z\-() ]+)"[^{}]{0,260}?\}', h):
    blk = mm.group(0)
    ipa = re.search(r'ipa:"([^"]*)"', blk)
    lab = re.search(r'(?:voice|manner):"([^"]*)"', blk)
    pairs.add((ipa.group(1) if ipa else '?', mm.group(1), lab.group(1) if lab else ''))

for ipa, folder, lab in sorted(pairs, key=lambda x: x[1]):
    print('%-14s %-22s %s' % (folder, ipa, lab))
print('total', len(pairs))
