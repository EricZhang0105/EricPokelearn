"""把 PNG 精灵图转换成体积更小的 WebP（256px, quality 82）。
用法: python tools/make_webp.py <input.png> <output.webp>
"""
import sys
from PIL import Image

src, dst = sys.argv[1], sys.argv[2]
im = Image.open(src).convert("RGBA")
im.thumbnail((256, 256), Image.LANCZOS)
im.save(dst, "WEBP", quality=82, method=5)
