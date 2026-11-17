# -*- coding: utf-8 -*-
"""测试页专用：用统一女声 XiaoxiaoNeural 慢速朗读单字，模拟真人「声母拉长直接连带调韵母」的第③步连读。
不做任何 DSP 波形加工（不重复/不拼接/不变调），只靠 TTS 语速把声母气流自然拉长。
产物仅供 test_blend.html 试听对比，不被 App 引用。
"""
import asyncio, os, subprocess
import edge_tts, imageio_ffmpeg

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'audio', 'zh')
FF = imageio_ffmpeg.get_ffmpeg_exe()
VOICE = 'zh-CN-XiaoxiaoNeural'   # 全 App 唯一女声
# 语速候选：越慢声母气流越长，越接近真人「h~~~~áng」
RATES = [('35', '-35%'), ('50', '-50%'), ('65', '-65%')]
TEXT = '航'   # háng，与真人视频同一个字

SIL = ('silenceremove=start_periods=1:start_duration=0.03:start_threshold=-45dB:'
       'stop_periods=-1:stop_duration=0.12:stop_threshold=-45dB,'
       'loudnorm=I=-16:TP=-1.5:LRA=11')

async def one(tag, rate):
    mp3 = os.path.join(OUT, f'test_hang_r{tag}.mp3')
    m4a = os.path.join(OUT, f'test_hang_r{tag}.m4a')
    await edge_tts.Communicate(TEXT, VOICE, rate=rate).save(mp3)
    subprocess.run([FF, '-y', '-v', 'quiet', '-i', mp3, '-af', SIL,
                    '-ac', '1', '-ar', '44100', '-c:a', 'aac', '-b:a', '96k', m4a], check=True)
    os.remove(mp3)
    print(tag, rate, os.path.getsize(m4a), 'bytes')

async def one_word(syl, text, tag, rate):
    mp3 = os.path.join(OUT, f'test_{syl}_r{tag}.mp3')
    m4a = os.path.join(OUT, f'test_{syl}_r{tag}.m4a')
    await edge_tts.Communicate(text, VOICE, rate=rate).save(mp3)
    subprocess.run([FF, '-y', '-v', 'quiet', '-i', mp3, '-af', SIL,
                    '-ac', '1', '-ar', '44100', '-c:a', 'aac', '-b:a', '96k', m4a], check=True)
    os.remove(mp3)
    print(syl, tag, rate, os.path.getsize(m4a), 'bytes')

async def main():
    import sys
    words = {'hang': '航', 'bu': '不', 'ma': '妈', 'hao': '好'}
    if len(sys.argv) >= 3:
        words = {sys.argv[1]: sys.argv[2]}
    for syl, text in words.items():
        for tag, rate in RATES:
            await one_word(syl, text, tag, rate)

asyncio.run(main())
