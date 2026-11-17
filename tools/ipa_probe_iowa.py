# -*- coding: utf-8 -*-
"""探测 Iowa Sounds of Speech 的孤立音素视频（sound.mp4）是否可下载。"""
import urllib.request, re, json, os, io

UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36'
BASE = 'https://soundsofspeech.uiowa.edu'
CACHE = r'D:/WorkBuddy-workspace/_ipa_src/cache'


def get(u, t=45):
    rq = urllib.request.Request(u, headers={'User-Agent': UA})
    r = urllib.request.urlopen(rq, timeout=t)
    return r.status, r.headers.get('Content-Type'), r.read()


def main():
    _, _, js = get(BASE + '/main-JLEEMS5I.js', 90)
    t = js.decode('utf-8', 'ignore')
    # 抓 foldername 映射
    pairs = re.findall(r'(\{commonName:"[^"]*",ipa:"[^"]*",folderName:"[^"]*")', t)
    seen = {}
    for p in pairs:
        ipa = re.search(r'ipa:"([^"]*)"', p).group(1)
        folder = re.search(r'folderName:"([^"]*)"', p).group(1)
        if ipa not in seen:
            seen[ipa] = folder
    print('phoneme entries', len(seen))
    for k, v in seen.items():
        print('  %-6s -> %r' % (k, v))

    print()
    print('=== probe sound.mp4 ===')
    cands = ['p-sound'] + [v for v in seen.values() if v] + \
            ['ar-sound', 'or-sound', 'ear-sound', 'air-sound', 'ure-sound',
             'er-sound', 'th-sound', 'dh-sound', 'sh-sound', 'zh-sound', 'jh-sound']
    if not os.path.isdir(CACHE):
        os.makedirs(CACHE)
    ok = []
    for c in dict.fromkeys(cands):
        u = '%s/assets/phonemes/%s/examples/sound.mp4' % (BASE, c)
        try:
            st, ct, b = get(u, 60)
            print('%-12s %s %s %d' % (c, st, ct, len(b)))
            if ct and 'video' in ct or (len(b) > 2000 and b[4:8] == b'ftyp'):
                io.open(os.path.join(CACHE, c + '.mp4'), 'wb').write(b)
                ok.append(c)
        except Exception as e:
            print('%-12s ERR %s' % (c, str(e)[:60]))
    io.open(os.path.join(CACHE, 'ok.json'), 'w', encoding='utf-8').write(json.dumps(ok, indent=1))


main()
