#!/usr/bin/env python3
"""生成 iPhone / iPad 主屏幕图标描述文件（Apple Web Clip, .mobileconfig）。

iOS 不允许普通设备安装未签名 .ipa，因此用 Apple 官方支持的 Web Clip：
Safari 下载 -> 设置 -> 已下载描述文件 -> 安装，主屏幕出现全屏 App 图标。
描述文件未签名仍可安装，安装时会出现「未签名」提示。
"""
import base64
import os
import uuid

BASE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(BASE, '..', '..'))
WORKSPACE = os.path.abspath(os.path.join(ROOT, '..'))
OUT = os.path.join(WORKSPACE, 'PokeLearnInstallers', 'mobile')
ICON = os.path.join(ROOT, 'icon-180.png')

CLOUD_URL = 'https://wbapp-ig9wrpabw0v66x4kzqyd6s.app.workbuddy.host/?sharecode=BC3RN7J6A4'
WEB_URL = 'https://ericzhang0105.github.io/EricPokelearn/'


def mobileconfig(label, url, ident):
    inner = str(uuid.uuid4()).upper()
    outer = str(uuid.uuid4()).upper()
    raw = base64.b64encode(open(ICON, 'rb').read()).decode()
    chunks = '\n'.join('\t\t\t\t' + raw[i:i + 64] for i in range(0, len(raw), 64))
    return f'''<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
\t<key>PayloadContent</key>
\t<array>
\t\t<dict>
\t\t\t<key>PayloadContent</key>
\t\t\t<dict>
\t\t\t\t<key>FullScreen</key>
\t\t\t\t<true/>
\t\t\t\t<key>Icon</key>
\t\t\t\t<data>
{chunks}
\t\t\t\t</data>
\t\t\t\t<key>IsRemovable</key>
\t\t\t\t<true/>
\t\t\t\t<key>Label</key>
\t\t\t\t<string>{label}</string>
\t\t\t\t<key>Precomposed</key>
\t\t\t\t<true/>
\t\t\t\t<key>URL</key>
\t\t\t\t<string>{url}</string>
\t\t\t</dict>
\t\t\t<key>PayloadDescription</key>
\t\t\t<string>在主屏幕添加 PokeLearn 儿童学习应用图标，全屏运行、离线可用。</string>
\t\t\t<key>PayloadDisplayName</key>
\t\t\t<string>{label}</string>
\t\t\t<key>PayloadIdentifier</key>
\t\t\t<string>{ident}.webclip</string>
\t\t\t<key>PayloadOrganization</key>
\t\t\t<string>PokeLearn</string>
\t\t\t<key>PayloadType</key>
\t\t\t<string>com.apple.webClip.managed</string>
\t\t\t<key>PayloadUUID</key>
\t\t\t<string>{inner}</string>
\t\t\t<key>PayloadVersion</key>
\t\t\t<integer>1</integer>
\t\t</dict>
\t</array>
\t<key>PayloadDescription</key>
\t<string>PokeLearn 学习应用主屏幕图标（Web Clip）。</string>
\t<key>PayloadDisplayName</key>
\t<string>{label}</string>
\t<key>PayloadIdentifier</key>
\t<string>{ident}</string>
\t<key>PayloadOrganization</key>
\t<string>PokeLearn</string>
\t<key>PayloadRemovalDisallowed</key>
\t<false/>
\t<key>PayloadType</key>
\t<string>Configuration</string>
\t<key>PayloadUUID</key>
\t<string>{outer}</string>
\t<key>PayloadVersion</key>
\t<integer>1</integer>
</dict>
</plist>
'''


ITEMS = [
    ('小布学习乐园', CLOUD_URL, 'com.ericzhang.pokelearn.cloud',
     ['PokeLearn-iPhone-iPad-Cloud.mobileconfig', 'PokeLearn-iPhone-iPad-云同步版.mobileconfig']),
    ('小布学习乐园·网页版', WEB_URL, 'com.ericzhang.pokelearn.web',
     ['PokeLearn-iPhone-iPad-Web.mobileconfig', 'PokeLearn-iPhone-iPad-网页版.mobileconfig']),
]

os.makedirs(OUT, exist_ok=True)
for label, url, ident, names in ITEMS:
    text = mobileconfig(label, url, ident)
    for name in names:
        p = os.path.join(OUT, name)
        with open(p, 'w', encoding='utf-8') as f:
            f.write(text)
        print('生成', name, os.path.getsize(p), 'bytes')
