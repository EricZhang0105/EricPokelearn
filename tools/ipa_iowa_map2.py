# -*- coding: utf-8 -*-
import io, re

h = io.open('D:/WorkBuddy-workspace/_ipa_src/iowa_main.js', encoding='utf-8').read()
for mm in re.finditer(r'folderName:"-sound"', h):
    i = mm.start()
    print('---', i)
    print(h[max(0, i - 220):i + 160].replace('\n', ' '))
