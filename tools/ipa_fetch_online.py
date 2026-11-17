# -*- coding: utf-8 -*-
"""ipa_fetch_online.py —— 从公开免费音源抓取 45 个美式音素的真人录音并直接配对。

音源（全部真人录音，不合成、不变调）：
  1) University of Iowa "Sounds of Speech"（American English）孤立音素视频音轨
     https://soundsofspeech.uiowa.edu/assets/phonemes/<folder>/examples/sound.mp4
  2) Wikimedia Commons 孤立 IPA 元音录音 / 单音节录音（字母名、感叹词）
     https://commons.wikimedia.org

截取策略：
  mode='main'  取能量最强、时长足够的一段 —— 爱荷华孤立音素、Commons 单元音
  mode='onset' 取「元音起点之前」的辅音段 —— Commons 的 θ ð ʃ ʒ tʃ dʒ w j
               （这些文件是 /θa/ 音节，直接取首段会拿到元音 a）

输出：audio/ipa/<key>.m4a  +  report.json
"""
import io, os, sys, json, math, time, wave, subprocess, tempfile, urllib.request, urllib.parse as up
import numpy as np
import imageio_ffmpeg

FF = imageio_ffmpeg.get_ffmpeg_exe()
UA = 'PokeLearnAudio/2.1 (offline kids learning app; eric.zhangjihuan@gmail.com)'
SR = 44100
OUTDIR = r'D:/WorkBuddy-workspace/趣味学习/audio/ipa'
CACHE = r'D:/WorkBuddy-workspace/_ipa_src/dl'
REPORT = r'D:/WorkBuddy-workspace/_ipa_src/report.json'
DELAY = 0.8

PLAN = {
    'v_ih': ('ɪ', 'vowel', 'commons:Near-close near-front unrounded vowel.ogg', 'main'),
    'v_e': ('ɛ', 'vowel', 'commons:Open-mid front unrounded vowel.ogg', 'main'),
    'v_ae': ('æ', 'vowel', 'commons:Near-open front unrounded vowel.ogg', 'main'),
    'v_uh': ('ʌ', 'vowel', 'commons:Open-mid back unrounded vowel.ogg', 'main'),
    'v_o': ('ɑ', 'vowel', 'commons:Open back unrounded vowel.ogg', 'main'),
    'v_uu': ('ʊ', 'vowel', 'commons:Near-close near-back rounded vowel.ogg', 'main'),
    'v_schwa': ('ə', 'vowel', 'commons:Mid-central vowel.ogg', 'main'),
    'v_ii': ('i', 'vowel', 'commons:Close front unrounded vowel.ogg', 'main'),
    'v_oo': ('u', 'vowel', 'commons:Close back rounded vowel.ogg', 'main'),
    'v_er': ('ɝ', 'rhotic', 'iowa:er-sound', 'main'),
    'v_schwa_r': ('ɚ', 'rhotic', 'commons:En-us-er.ogg', 'main'),
    'v_ei': ('eɪ', 'diph', 'iowa:long-e-sound', 'main'),
    'v_ou': ('oʊ', 'diph', 'iowa:long-o-sound', 'main'),
    'v_oi': ('ɔɪ', 'diph', 'iowa:oi-sound', 'main'),
    'v_ai': ('aɪ', 'diph', 'commons:En-us-eye.ogg', 'main'),
    'v_au': ('aʊ', 'diph', 'commons:En-us-ow.ogg', 'main'),
    'v_aar': ('ɑr', 'rhotic', 'commons:En-us-are.ogg', 'main'),
    'v_awr': ('ɔr', 'rhotic', 'commons:En-us-or.ogg', 'main'),
    'v_ie': ('ɪr', 'rhotic', 'commons:En-us-ear.ogg', 'main'),
    'v_ea': ('ɛr', 'rhotic', 'commons:En-us-air.ogg', 'main'),
    'v_ue': ('ʊr', 'rhotic', 'commons:En-us-our.ogg', 'main'),
    'c_p': ('p', 'stop', 'commons:Voiceless bilabial plosive.ogg', 'syll'),
    'c_b': ('b', 'stop', 'commons:Voiced bilabial plosive.ogg', 'syll'),
    'c_t': ('t', 'stop', 'commons:Voiceless alveolar plosive.ogg', 'syll'),
    'c_d': ('d', 'stop', 'commons:Voiced alveolar plosive.ogg', 'syll'),
    'c_k': ('k', 'stop', 'commons:Voiceless velar plosive.ogg', 'syll'),
    'c_g': ('g', 'stop', 'commons:Voiced velar plosive.ogg', 'syll'),
    'c_f': ('f', 'fric', 'commons:Voiceless labiodental fricative.ogg', 'syll'),
    'c_v': ('v', 'fric', 'commons:Voiced labiodental fricative.ogg', 'syll'),
    'c_s': ('s', 'fric', 'commons:Voiceless alveolar sibilant.ogg', 'syll'),
    'c_z': ('z', 'fric', 'commons:Voiced alveolar sibilant.ogg', 'syll'),
    'c_h': ('h', 'fric', 'commons:Voiceless glottal fricative.ogg', 'syll'),
    'c_m': ('m', 'nasal', 'commons:Bilabial nasal.ogg', 'syll'),
    'c_n': ('n', 'nasal', 'commons:Alveolar nasal.ogg', 'syll'),
    'c_ng': ('ng', 'nasal', 'commons:Velar nasal.ogg', 'syll'),
    'c_l': ('l', 'liq', 'commons:Alveolar lateral approximant.ogg', 'syll'),
    'c_r': ('r', 'liq', 'commons:Alveolar approximant.ogg', 'syll'),
    'c_th': ('th', 'fric', 'commons:Voiceless dental fricative.ogg', 'syll'),
    'c_dh': ('dh', 'fric', 'commons:Voiced dental fricative.ogg', 'syll'),
    'c_sh': ('sh', 'fric', 'commons:Voiceless palato-alveolar sibilant.ogg', 'syll'),
    'c_zh': ('zh', 'fric', 'commons:Voiced palato-alveolar sibilant.ogg', 'syll'),
    'c_ch': ('ch', 'affr', 'commons:Voiceless palato-alveolar affricate.ogg', 'syll'),
    'c_j': ('j', 'affr', 'commons:Voiced palato-alveolar affricate.ogg', 'syll'),
    'c_w': ('w', 'glide', 'commons:Voiced labio-velar approximant.ogg', 'syll'),
    'c_y': ('y', 'glide', 'commons:Palatal approximant.ogg', 'syll'),
}

# 每类截取后的目标时长上限（秒）
CAP = {'vowel': 0.95, 'diph': 0.95, 'rhotic': 0.85, 'stop': 0.50, 'affr': 0.45,
       'fric': 0.85, 'nasal': 0.80, 'liq': 0.80, 'glide': 0.40}
# Commons 的 θ ð ʃ ʒ tʃ dʒ w j 录的是「辅音 + a」的音节（常读两遍）。
# 实测第一个 120ms 的频谱质心明显高（ʃ 4948Hz / tʃ 4824Hz / dʒ 3762Hz），
# 之后掉到 700–800Hz 就是元音 a。所以直接取第一个发声段开头的辅音，
# 不再靠「高频占比」往前倒推 —— 那条启发式在 w / j 这类低高频滑音上会失败，
# 截出来全是元音，孩子听到的是完全不对的音。
HEAD = {'fric': 0.16, 'affr': 0.15, 'glide': 0.14}
MAXLEN = 1.10


def http(url, timeout=90, tries=5):
    last = None
    for i in range(tries):
        try:
            rq = urllib.request.Request(url, headers={'User-Agent': UA})
            b = urllib.request.urlopen(rq, timeout=timeout).read()
            time.sleep(DELAY)
            return b
        except Exception as e:
            last = e
            if getattr(e, 'code', None) in (429, 503) or 'timed out' in str(e):
                time.sleep(3 * (i + 1)); continue
            raise
    raise last


def source_bytes(src):
    kind, ref = src.split(':', 1)
    if kind == 'iowa':
        u = 'https://soundsofspeech.uiowa.edu/assets/phonemes/%s/examples/sound.mp4' % ref
        b = http(u)
        if b[4:8] != b'ftyp':
            raise RuntimeError('iowa miss ' + ref)
        return b, u
    if kind == 'commons':
        q = ('https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo'
             '&iiprop=url&titles=')
        d = json.loads(http(q + up.quote('File:' + ref)).decode('utf-8'))
        for pid, pg in d['query']['pages'].items():
            if 'missing' in pg:
                raise RuntimeError('commons miss ' + ref)
            return http(pg['imageinfo'][0]['url'].split('?')[0]), 'File:' + ref
    raise RuntimeError('bad src ' + src)


def get(key, src):
    os.makedirs(CACHE, exist_ok=True)
    cp, mp = os.path.join(CACHE, key + '.bin'), os.path.join(CACHE, key + '.src')
    if os.path.exists(cp) and os.path.exists(mp):
        return io.open(cp, 'rb').read(), io.open(mp, encoding='utf-8').read()
    b, u = source_bytes(src)
    io.open(cp, 'wb').write(b)
    io.open(mp, 'w', encoding='utf-8').write(u)
    return b, u


def decode(b):
    tmp = tempfile.mktemp(suffix='.bin'); io.open(tmp, 'wb').write(b)
    w = tempfile.mktemp(suffix='.wav')
    subprocess.run([FF, '-y', '-loglevel', 'error', '-i', tmp, '-vn', '-ac', '1',
                    '-ar', str(SR), '-acodec', 'pcm_s16le', w], check=True)
    d = io.open(w, 'rb').read(); os.unlink(tmp); os.unlink(w)
    return np.frombuffer(d[d.find(b'data') + 8:], dtype='<i2').astype(np.float32) / 32768.0


def frame_feats(pcm, hop=0.01, win=0.04):
    """10ms 跳、40ms 窗：能量 / 高频占比 / 周期性"""
    w = int(SR * win)
    if pcm.size < w:                              # 太短：补零到一窗，避免广播错
        pcm = np.pad(pcm, (0, w - pcm.size))
    h = int(SR * hop)
    n = max(1, (pcm.size - w) // h + 1)
    db = np.zeros(n); hf = np.zeros(n); per = np.zeros(n)
    f = np.fft.rfftfreq(w, 1.0 / SR)
    lo, hi = int(SR / 400), int(SR / 60)
    for k in range(n):
        s = pcm[k * h:k * h + w]
        rms = float(np.sqrt((s ** 2).mean()))
        db[k] = 20 * math.log10(rms + 1e-9)
        if rms < 1e-4:
            continue
        S = np.abs(np.fft.rfft(s * np.hanning(w)))
        hf[k] = S[f > 2500].sum() / (S.sum() + 1e-9)
        x = s - s.mean()
        ac = np.correlate(x, x, 'full')[w - 1:]
        if hi < ac.size and ac[0] > 1e-9:
            per[k] = float(min(1.0, ac[lo:hi].max() / ac[0]))
    return db, hf, per, hop


def segs_of(on, hop, gap=0.10):
    idx = np.where(on)[0]
    if idx.size == 0:
        return []
    out = []; a = idx[0]; p = idx[0]
    for k in idx[1:]:
        if (k - p) * hop >= gap:
            out.append((a, p)); a = k
        p = k
    out.append((a, p))
    return out


def pick(pcm, mode, kind):
    db, hf, per, hop = frame_feats(pcm)
    if db.size < 5:
        return pcm
    thr = max(-58.0, db.max() - 30.0)
    on = db > thr
    if not on.any():
        return pcm
    cap = CAP.get(kind, 0.8)
    if mode == 'syll':
        # Commons 的 IPA 辅音录音把「辅音+弱元音」音节读两遍（p→"puh"、s→"sss"）。
        # 这是课堂标准念法，正确且清晰。取【第一个完整音节】整段播放，
        # 绝不再切音素内部 —— 切了只剩 0.1s 爆破噪音，孩子听到的是"乱读"。
        segs = [s for s in segs_of(on, hop) if (s[1] - s[0]) * hop >= 0.30] \
               or segs_of(on, hop)
        a, b = segs[0]                                  # 第一个够长的发声段
        s = max(0, int(a * hop * SR) - int(0.02 * SR))
        t = min(pcm.size, int((b + 1) * hop * SR) + int(0.03 * SR))
        if (t - s) > 0.80 * SR:                         # 过长的持续音封顶到 0.8s
            t = s + int(0.80 * SR)
        if (t - s) < 0.30 * SR:                         # 兜底最短 0.30s
            t = min(pcm.size, s + int(0.30 * SR))
        return pcm[s:t]
    if mode == 'head':
        segs = [s for s in segs_of(on, hop) if (s[1] - s[0]) * hop >= 0.10] or segs_of(on, hop)
        a, _ = segs[0]
        s = max(0, int(a * hop * SR) - int(0.015 * SR))
        t = min(pcm.size, s + int(HEAD.get(kind, 0.15) * SR) + int(0.02 * SR))
        out = pcm[s:t]
        if out.size > MAXLEN * SR:
            out = out[:int(MAXLEN * SR)]
        return out
    if mode == 'main':
        cand = [s for s in segs_of(on, hop) if (s[1] - s[0]) * hop >= 0.10] or segs_of(on, hop)
        a, b = max(cand, key=lambda s: db[s[0]:s[1] + 1].sum())
        if (b - a) * hop < 0.12:                      # 极短（爆破音）：向前后各补一点
            a = max(0, a - int(0.03 / hop)); b = min(db.size - 1, b + int(0.05 / hop))
        pre, post = 0.03, 0.07
    else:
        # onset：先定位元音段，再往回收「高频占比明显高于元音 / 周期性低」的辅音帧
        segs = [s for s in segs_of(on, hop) if (s[1] - s[0]) * hop >= 0.10] or segs_of(on, hop)
        va, vb = max(segs, key=lambda s: db[s[0]:s[1] + 1].sum())
        vhf = float(np.mean(hf[va:vb + 1]))
        thr_hf = max(0.30, vhf * 1.55)
        j = va                                    # 元音起点
        a = j
        gap = 0
        while a > 0:
            k = a - 1
            if hf[k] >= thr_hf or per[k] < 0.50:
                a = k; gap = 0
            else:
                gap += 1
                if gap > int(0.03 / hop):
                    break
                a = k
        if (j - a) * hop < 0.09:                  # 摩擦太短（w/j 这种滑音）
            a = max(0, j - int(0.16 / hop))
        if (j - a) * hop > cap:
            a = j - int(cap / hop)
        b = j - 1
        pre, post = 0.02, 0.03
    # 时长上限
    if (b - a) * hop > cap:
        b = a + int(cap / hop)
    s = max(0, int(a * hop * SR) - int(pre * SR))
    t = min(pcm.size, int((b + 1) * hop * SR) + int(post * SR))
    if t - s < 0.10 * SR:                        # 兜底：至少 0.10 秒
        t = min(pcm.size, s + int(0.14 * SR))
        s = max(0, t - int(0.14 * SR))
    out = pcm[s:t]
    if out.size > MAXLEN * SR:
        out = out[:int(MAXLEN * SR)]
    return out


def normalize(pcm, target_db=-17.0, ceil=0.92):
    db, hf, per, hop = frame_feats(pcm)
    thr = max(-58.0, db.max() - 30.0)
    h = int(SR * hop); w = int(SR * 0.04)
    n = max(1, (pcm.size - w) // h + 1)
    mask = db > thr
    tot = 0.0; cnt = 0
    for k in range(n):
        if k < mask.size and mask[k]:
            s = pcm[k * h:k * h + w]
            tot += float((s ** 2).sum()); cnt += s.size
    rms = math.sqrt(tot / cnt) if cnt else float(np.sqrt((pcm ** 2).mean() + 1e-12))
    g = 10 ** ((target_db - 20 * math.log10(rms + 1e-9)) / 20)
    out = pcm * g
    pk = float(np.abs(out).max())
    if pk > ceil:
        out *= ceil / pk
    return out


def encode(pcm, path):
    w = tempfile.mktemp(suffix='.wav')
    wf = wave.open(w, 'wb'); wf.setnchannels(1); wf.setsampwidth(2); wf.setframerate(SR)
    wf.writeframes((np.clip(pcm, -1, 1) * 32767).astype('<i2').tobytes()); wf.close()
    os.makedirs(os.path.dirname(path), exist_ok=True)
    subprocess.run([FF, '-y', '-loglevel', 'error', '-i', w, '-c:a', 'aac', '-b:a', '96k',
                    '-ac', '1', '-ar', str(SR), '-movflags', '+faststart', path], check=True)
    os.unlink(w)


def main():
    only = sys.argv[1:] or list(PLAN)
    rep, fail = [], []
    for key in only:
        sym, kind, src, mode = PLAN[key]
        try:
            b, url = get(key, src)
            pcm = pick(decode(b), mode, kind)
            pcm = normalize(pcm)
            out = os.path.join(OUTDIR, key + '.m4a')
            encode(pcm, out)
            db, hf, per, hop = frame_feats(pcm)
            act = db > (db.max() - 25)
            row = dict(key=key, sym=sym, kind=kind, mode=mode, url=url,
                       dur=round(pcm.size / SR, 3),
                       hf=round(float(hf[act].mean()) if act.any() else 0, 2),
                       per=round(float(per[act].mean()) if act.any() else 0, 2),
                       kb=round(os.path.getsize(out) / 1024, 1))
            rep.append(row)
            print('%-10s %-3s %-5s %-6s %.2fs hf=%.2f per=%.2f %4.1fKB' %
                  (key, sym, mode, kind, row['dur'], row['hf'], row['per'], row['kb']))
        except Exception as e:
            fail.append([key, sym, str(e)[:90]])
            print('FAIL %-10s %-3s %s' % (key, sym, str(e)[:90]))
    os.makedirs(os.path.dirname(REPORT), exist_ok=True)
    io.open(REPORT, 'w', encoding='utf-8').write(json.dumps({'ok': rep, 'fail': fail}, ensure_ascii=False, indent=1))
    print('\nOK %d / FAIL %d' % (len(rep), len(fail)))
    for f in fail:
        print('  MISSING', f)


if __name__ == '__main__':
    main()
