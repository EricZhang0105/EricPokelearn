# -*- coding: utf-8 -*-
"""把英文内容里的英式用词统一成美式（一次性迁移脚本）。

改的是给孩子看的英文：阅读短文、题库词表、音标例词。
audio-map.js 不在这里改 —— 它是 tools/tts_build.py 生成物，跑一遍补录就会重建。

用法：python tools/us_spelling.py [--dry]
"""
import io, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FILES = ['js/read-passages.js', 'js/question-engine.js', 'js/question-bank.js',
         'js/data.js', 'js/ref-pages.js', 'js/phonics-sounds.js']

# 保持大小写：先长后短，避免 colours 被 colour 先吃掉
RULES = [
    (r'\bcolours\b', 'colors'), (r'\bColours\b', 'Colors'),
    (r'\bcolour\b', 'color'), (r'\bColour\b', 'Color'),
    (r'\bfavourite\b', 'favorite'), (r'\bFavourite\b', 'Favorite'),
    (r'\bmaths\b', 'math'), (r'\bMaths\b', 'Math'),
    (r'\bflats\b', 'apartments'), (r'\bflat\b', 'apartment'),
    (r'\bMum\b', 'Mom'), (r'\bmum\b', 'mom'),
    (r'\bholiday\b', 'vacation'), (r'\bHoliday\b', 'Vacation'),
    (r'\bjumper\b', 'sweater'), (r'\bbiscuit\b', 'cookie'), (r'\bbiscuits\b', 'cookies'),
    (r'\bqueue\b', 'line'), (r'\blorry\b', 'truck'),
    (r'\bautumn\b', 'fall'), (r'\bpyjamas\b', 'pajamas'),
    (r'\btrousers\b', 'pants'), (r'\bplaster\b', 'band-aid'),
]
DRY = '--dry' in sys.argv


def main():
    total = 0
    for rel in FILES:
        p = os.path.join(ROOT, rel)
        if not os.path.exists(p):
            continue
        src = io.open(p, encoding='utf8').read()
        out = src
        hits = []
        for pat, rep in RULES:
            out, n = re.subn(pat, rep, out)
            if n:
                hits.append(f'{pat}→{rep} ×{n}')
        if out != src:
            total += sum(int(h.split('×')[1]) for h in hits)
            print(f'{rel}: ' + ', '.join(hits))
            if not DRY:
                io.open(p, 'w', encoding='utf8', newline='').write(out)
    print(f'\n共替换 {total} 处' + ('（dry run，未写入）' if DRY else ''))


main()
