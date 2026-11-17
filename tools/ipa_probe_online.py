# -*- coding: utf-8 -*-
"""探测 Hamburg 大学 English Explorations 音素录音：确认是单音素还是整词。

输出：每个音素的时长、有声占比、首尾静音、峰值、RMS。
"""
import io, os, re, json, html, urllib.request, subprocess, tempfile
import numpy as np
import imageio_ffmpeg

FF = imageio_ffmpeg.get_ffmpeg_exe()
UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36'
PAGE = 'https://englishexplorations.check.uni-hamburg.de/?p=3185'
OUT = r'D:/WorkBuddy-workspace/_ipa_src'


def http(url, timeout=40):
    rq = urllib.request.Request(url, headers={'User-Agent': UA})
    return urllib.request.urlopen(rq, timeout=timeout).read()


def parse_rows():
    t = http(PAGE).decode('utf-8', 'ignore')
    rows = re.findall(r'<tr[^>]*>(.*?)</tr>', t, re.S)
    out = []
    for r in rows:
        if 'uploads' not in r:
            continue
        cells = re.findall(r'<t[dh][^>]*>(.*?)</t[dh]>', r, re.S)
        if len(cells) < 3:
            continue
        sym = html.unescape(re.sub(r'<[^>]+>', '', cells[0])).strip()
        urls = []
        for c in cells:
            for u in re.findall(r'(https://[^"\'\s<]+\.mp3)', c):
                if u not in urls:
                    urls.append(u)
        if sym and urls:
            out.append({'sym': sym, 'urls': urls})
    return out


def wav_of(url):
    raw = http(url)
    tmp = tempfile.mktemp(suffix='.mp3')
    io.open(tmp, 'wb').write(raw)
    w = tempfile.mktemp(suffix='.wav')
    subprocess.run([FF, '-y', '-loglevel', 'error', '-i', tmp, '-ac', '1', '-ar', '22050', w], check=True)
    d = io.open(w, 'rb').read()
    os.unlink(tmp); os.unlink(w)
    # 解析 16bit mono wav
    i = d.find(b'data')
    pcm = np.frombuffer(d[i + 8:], dtype='<i2').astype(np.float32) / 32768.0
    return pcm, 22050


def stats(pcm, sr):
    if pcm.size == 0:
        return {}
    frame = int(sr * 0.01)
    n = pcm.size // frame
    env = np.sqrt((pcm[:n * frame].reshape(n, frame) ** 2).mean(axis=1))
    peak = float(np.abs(pcm).max())
    thr = max(0.02, peak * 0.10)
    on = env > thr
    voiced = float(on.mean())
    idx = np.where(on)[0]
    speech = (idx[-1] - idx[0] + 1) * 0.01 if idx.size else 0.0
    lead = idx[0] * 0.01 if idx.size else 0.0
    tail = (n - idx[-1]) * 0.01 if idx.size else 0.0
    return dict(dur=round(pcm.size / sr, 3), speech=round(speech, 3), voiced=round(voiced, 2),
                lead=round(lead, 3), tail=round(tail, 3), peak=round(peak, 3))


def main():
    if not os.path.isdir(OUT):
        os.makedirs(OUT)
    rows = parse_rows()
    print('rows', len(rows))
    res = []
    for r in rows:
        sym = r['sym']
        for tag, u in zip(['am', 'ir'], r['urls'][:2]):
            name = sym.strip('/').replace('\u02b0', '') + '_' + tag
            try:
                pcm, sr = wav_of(u)
                st = stats(pcm, sr)
                st.update(sym=sym, tag=tag, url=u, name=name)
                res.append(st)
                print('%-6s %-3s %s' % (sym, tag, st))
            except Exception as e:
                print('ERR', sym, tag, type(e).__name__, str(e)[:80])
    io.open(os.path.join(OUT, 'probe.json'), 'w', encoding='utf-8').write(json.dumps(res, ensure_ascii=False, indent=1))


main()
