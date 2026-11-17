# -*- coding: utf-8 -*-
"""生成 26 个英文字母【名称】发音（美式），存 audio/ipa/letter_A..Z.m4a。

用户 2026-11-17 要求：Sound Chart 第③部分字母卡要点一下读字母名（A="ei"、B="bi"…），
不是读音素（旧版 A→/æ//eɪ/）。音色锁定全 App 同一把女声 en-US-JennyNeural。

文本用 edge-tts 对单字母的标准美音读法；Z 用 "Z" 会读美音 /ziː/（zee），正确。
"""
import asyncio, os, subprocess, sys
import edge_tts
import imageio_ffmpeg

VOICE = 'en-US-JennyNeural'
SR, BR = 44100, '96k'
FF = imageio_ffmpeg.get_ffmpeg_exe()
OUT = r'D:/WorkBuddy-workspace/趣味学习/audio/ipa'
FORCE = '--force' in sys.argv

# 字母 → (文本, 说明)。直接给大写字母，edge-tts 读字母名。
# 个别字母加句号确保读字母名而非单词。
LETTERS = {}
for ch in 'ABCDEFGHIJKLMNOPQRSTUVWXYZ':
    LETTERS[ch] = ch + '.'

TRIM = ("silenceremove=start_periods=1:start_duration=0.02:start_threshold=-45dB:detection=peak,"
        "areverse,"
        "silenceremove=start_periods=1:start_duration=0.02:start_threshold=-45dB:detection=peak,"
        "areverse,"
        "adelay=delays=40:all=1,apad=pad_dur=0.05")

async def synth(ch, text, sem):
    out = os.path.join(OUT, 'letter_%s.m4a' % ch)
    if not FORCE and os.path.exists(out) and os.path.getsize(out) > 1200:
        return 'skip'
    async with sem:
        for attempt in range(3):
            try:
                buf = bytearray()
                async for c in edge_tts.Communicate(text, VOICE, rate='-15%').stream():
                    if c.get('type') == 'audio' and c.get('data'):
                        buf += c['data']
                if len(buf) < 800:
                    raise RuntimeError('too small')
                p = subprocess.run([FF,'-y','-v','error','-i','pipe:0',
                    '-af', TRIM + ',loudnorm=I=-16:TP=-1.5:LRA=11',
                    '-ac','1','-ar',str(SR),'-c:a','aac','-b:a',BR,out],
                    input=bytes(buf), capture_output=True, timeout=120)
                if p.returncode != 0:
                    raise RuntimeError(p.stderr.decode('utf8','ignore')[:150])
                return 'ok'
            except Exception as e:
                if attempt == 2:
                    print('FAIL', ch, str(e)[:120]); return 'fail'
                await asyncio.sleep(1 + attempt)

async def main():
    os.makedirs(OUT, exist_ok=True)
    sem = asyncio.Semaphore(5)
    res = await asyncio.gather(*[synth(ch, t, sem) for ch, t in LETTERS.items()])
    print('ok', res.count('ok'), 'skip', res.count('skip'), 'fail', res.count('fail'))

if __name__ == '__main__':
    asyncio.run(main())
