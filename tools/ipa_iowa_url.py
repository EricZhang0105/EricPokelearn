# -*- coding: utf-8 -*-
import io, re

h = io.open('D:/WorkBuddy-workspace/_ipa_src/iowa_main.js', encoding='utf-8').read()
for mm in re.finditer(r'phonemes', h):
    i = mm.start()
    print('---', i, h[max(0, i - 200):i + 200].replace('\n', ' '))
