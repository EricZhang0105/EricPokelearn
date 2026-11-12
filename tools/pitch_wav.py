"""改写 WAV 头里的采样率，让同一段语音以更高音调播放（宝可梦专属音色）。
用法: python tools/pitch_wav.py <in.wav> <out.wav> <factor>
"""
import sys, wave

src, dst, factor = sys.argv[1], sys.argv[2], float(sys.argv[3])
with wave.open(src, 'rb') as r:
    frames = r.readframes(r.getnframes())
    ch, sw, rate = r.getnchannels(), r.getsampwidth(), r.getframerate()
with wave.open(dst, 'wb') as w:
    w.setnchannels(ch)
    w.setsampwidth(sw)
    w.setframerate(int(rate * factor))
    w.writeframes(frames)
