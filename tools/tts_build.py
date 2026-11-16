"""英文语音库生成器（跨平台，Windows/macOS 都能跑）

用法：
    python tools/tts_build.py            # 只补缺失的
    python tools/tts_build.py --force    # 全部重录（换音色/改参数后用）

流程：读 tools/voice_manifest.json（由 tools/voice_manifest.js 生成）
   → edge-tts（微软神经女声）合成 mp3
   → ffmpeg 统一响度并转成 44.1kHz / 96kbps 单声道 AAC(m4a)
   → 写 js/audio-map.js（URL 带 ?a=N 版本参数，顶掉设备旧缓存）

⚠️ 音色唯一性（2026-11-16 起强制执行）
   整个 App 的英文朗读只能用 VOICE 这一把女声。禁止为不同角色换音色或变调——
   上一版给 63 只宝可梦配了 12 种底嗓 + 1.06~1.58 倍变调，实测基频跨 74~400Hz、
   高频能量低到 0.01%，孩子听到的就是「一句话一个声音、有的听不清」。
   要换音色，必须整库重录（--force），并同步修改 js/app.js 的 EN_VOICE_PREF，
   让「没录音时走 TTS」的音色与录音一致。
"""
import asyncio, json, os, subprocess, sys, shutil
import edge_tts
import imageio_ffmpeg

VOICE = "en-US-JennyNeural"          # 唯一英文女声：清晰、自然、亲和
RATE_NORMAL = "-8%"                  # 比默认稍慢，给 5 岁孩子留反应时间
RATE_LONG = "-12%"                   # 长句/短文再慢一点
RATE_SLOW = "-22%"                   # 拼写题的慢速版
SR, BR = 44100, "96k"
AUDIO_VER = "a=3"                    # 改录音就 +1
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MANIFEST = os.path.join(ROOT, "tools", "voice_manifest.json")
OUTDIR = os.path.join(ROOT, "audio", "words")
MAPJS = os.path.join(ROOT, "js", "audio-map.js")
FF = imageio_ffmpeg.get_ffmpeg_exe()

FORCE = "--force" in sys.argv


def rate_of(item):
    if item["rate"] == "slow":
        return RATE_SLOW
    return RATE_LONG if len(item["text"]) > 90 else RATE_NORMAL


async def synth(item, sem, stats):
    out = os.path.join(OUTDIR, item["file"])
    if not FORCE and os.path.exists(out) and os.path.getsize(out) > 1200:
        stats["skip"] += 1
        return
    async with sem:
        for attempt in range(3):
            try:
                # 内存管道：mp3 直接喂给 ffmpeg，不落临时文件（避免触发批量删除保护）
                buf = bytearray()
                async for chunk in edge_tts.Communicate(item["text"], VOICE, rate=rate_of(item)).stream():
                    if chunk.get("type") == "audio" and chunk.get("data"):
                        buf += chunk["data"]
                if len(buf) < 1000:
                    raise RuntimeError("audio too small")
                p = subprocess.run(
                    [FF, "-y", "-v", "error", "-i", "pipe:0",
                     "-af", "loudnorm=I=-16:TP=-1.5:LRA=11",
                     "-ac", "1", "-ar", str(SR), "-c:a", "aac", "-b:a", BR, out],
                    input=bytes(buf), capture_output=True, timeout=180)
                if p.returncode != 0:
                    raise RuntimeError(p.stderr.decode("utf8", "ignore")[:200])
                stats["ok"] += 1
                break
            except Exception as e:
                if attempt == 2:
                    stats["fail"].append(f'{item["key"]}: {type(e).__name__} {str(e)[:120]}')
                else:
                    await asyncio.sleep(1.5 * (attempt + 1))


async def main():
    os.makedirs(OUTDIR, exist_ok=True)
    man = json.load(open(MANIFEST, encoding="utf8"))
    items = man["items"]
    stats = {"ok": 0, "skip": 0, "fail": []}
    sem = asyncio.Semaphore(6)
    await asyncio.gather(*(synth(it, sem, stats) for it in items))

    # 映射表（孤儿文件清理放在 tools/prune_audio.js，避免碰到批量删除保护）
    mp = {}
    for it in items:
        mp[it["key"]] = "audio/words/" + it["file"] + "?" + AUDIO_VER
    keep = {it["file"] for it in items}

    body = ("/* 由 tools/tts_build.py 自动生成，勿手工编辑\n"
            f" * 唯一女声 {VOICE}；URL 带 ?{AUDIO_VER} 版本参数用于顶掉设备旧缓存。\n"
            " * CHEER_MAP 恒为空：鼓励语也走同一把女声（CHEER_LINES → speak()）。 */\n"
            "const AUDIO_MAP = " + json.dumps(mp, ensure_ascii=False, indent=2) + ";\n"
            "const CHEER_MAP = {};\n")
    open(MAPJS, "w", encoding="utf8").write(body)

    total = sum(os.path.getsize(os.path.join(OUTDIR, f)) for f in os.listdir(OUTDIR))
    print(f"新录 {stats['ok']}，跳过 {stats['skip']}，失败 {len(stats['fail'])}")
    print(f"映射 {len(mp)} 条，音频体积 {total/1024/1024:.2f} MB")
    for f in stats["fail"][:10]:
        print("  失败:", f)


asyncio.run(main())
