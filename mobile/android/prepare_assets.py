#!/usr/bin/env python3
"""把 PokeLearn 静态版打包成 Android WebView 可用的离线 assets。"""
import os, re, shutil, sys

BASE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(BASE, '..', '..'))
MIRROR = os.path.abspath(os.path.join(ROOT, '..', 'PokeLearnCloud'))
WWW = os.path.join(BASE, 'assets', 'www')
SKIP = {'DEPLOY.txt', '.DS_Store'}

SW_STUB = """<script>
/* Android offline build: all assets are served locally by the WebView. */
try{Object.defineProperty(navigator,'serviceWorker',{configurable:true,value:{register:function(){return Promise.reject(new Error('offline'))},getRegistration:function(){return Promise.resolve(null)},getRegistrations:function(){return Promise.resolve([])}}});}catch(e){}
</script>
"""

if os.path.isdir(WWW):
    shutil.rmtree(WWW)
os.makedirs(WWW)
count = 0
for name in sorted(os.listdir(MIRROR)):
    if name in SKIP or name.startswith('.'):
        continue
    src = os.path.join(MIRROR, name)
    dst = os.path.join(WWW, name)
    if os.path.isdir(src):
        shutil.copytree(src, dst, ignore=shutil.ignore_patterns(*SKIP))
        count += sum(len(f) for _, _, f in os.walk(dst))
    else:
        shutil.copy2(src, dst)
        count += 1

# 离线版不需要 Service Worker：资源由 WebView 直接从 assets 返回
idx = os.path.join(WWW, 'index.html')
html = open(idx, encoding='utf-8').read()
html, n = re.subn(r"<script>\s*if\('serviceWorker' in navigator\)\{[\s\S]*?</script>", '', html)
html = html.replace('<head>', '<head>\n  ' + SW_STUB.strip(), 1)
open(idx, 'w', encoding='utf-8').write(html)

# 启动图标（目录由脚本自建，不必提交到仓库）
icon_dir = os.path.join(BASE, 'res', 'mipmap-xxxhdpi')
os.makedirs(icon_dir, exist_ok=True)
shutil.copy2(os.path.join(ROOT, 'icon-192.png'),
             os.path.join(icon_dir, 'ic_launcher.png'))
size = sum(os.path.getsize(os.path.join(d, f))
           for d, _, fs in os.walk(WWW) for f in fs)
print('离线资源文件数:', count, '| 合计 %.1f MB' % (size / 1048576))
print('SW 注册块已移除:', n, '| Android stub 已注入:', SW_STUB.strip()[:30] in html)
