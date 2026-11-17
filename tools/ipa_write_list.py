# -*- coding: utf-8 -*-
"""ipa_write_list.py —— 由 audio/ipa 目录生成 js/ipa-audio-list.js（供 Service Worker 预缓存）。

顺序固定为「21 元音 + 24 辅音」，与 js/ref-pages.js 里的音标表一致。
改素材后把 VER 改一下（a=N），页面会自动换 URL 参数，顶掉设备上的旧音频。
"""
import io, os

VER = 'a=9'
OUT = r'D:/WorkBuddy-workspace/趣味学习/js/ipa-audio-list.js'
D = r'D:/WorkBuddy-workspace/趣味学习/audio/ipa'

VOWELS = ['v_ih', 'v_e', 'v_ae', 'v_uh', 'v_o', 'v_uu', 'v_schwa', 'v_ii', 'v_oo', 'v_er',
          'v_schwa_r', 'v_ei', 'v_ai', 'v_oi', 'v_au', 'v_ou', 'v_aar', 'v_awr', 'v_ie',
          'v_ea', 'v_ue']
CONS = ['c_p', 'c_b', 'c_t', 'c_d', 'c_k', 'c_g', 'c_ch', 'c_j', 'c_w', 'c_y', 'c_f', 'c_v',
        'c_th', 'c_dh', 'c_s', 'c_z', 'c_sh', 'c_zh', 'c_h', 'c_m', 'c_n', 'c_ng', 'c_l', 'c_r']
KEYS = VOWELS + CONS

HEAD = '''/* 由 tools/ipa_write_list.py 自动生成，勿手工编辑
 * 英语 45 音素（美式）发音片段 —— 全部取自**标准美音真人录音**，未做合成：
 *   · 43 个音素：B 站「48个英语音标标准美音发音」BV1sb411L78w 里的标准美音外教录音
 *     （tools/bili_extract.py 按音标逐段切出，每个音标读两遍取第 1 遍）
 *   · /ɚ/ /ɔr/ 视频无对应：保留 Wikimedia Commons 单音节录音（er / or）
 *   · 26 个字母名（letter_A..Z）：全 App 同一把 Jenny 女声合成的美式字母名
 *     （tools/letters_build.py）—— 第③部分字母卡点一下读字母名，不读音素。
 * 处理只做：去首尾静音、按有效段响度归一（-17dBFS）、转 AAC。不改音高、不变速、不拼接。
 * Service Worker 安装时预缓存，保证离线也能点音标听发音。 */
'''

lines = [HEAD.rstrip('\n'), 'const IPA_AUDIO_VER = "%s";' % VER, 'const IPA_AUDIO_LIST = [']
items = []
for k in KEYS:
    p = os.path.join(D, k + '.m4a')
    if not os.path.exists(p):
        raise SystemExit('missing ' + p)
    items.append('  "audio/ipa/%s.m4a?%s"' % (k, VER))
# 26 个字母名音频也要预缓存（第③部分字母卡用）
for ch in 'ABCDEFGHIJKLMNOPQRSTUVWXYZ':
    p = os.path.join(D, 'letter_' + ch + '.m4a')
    if not os.path.exists(p):
        raise SystemExit('missing ' + p)
    items.append('  "audio/ipa/letter_%s.m4a?%s"' % (ch, VER))
lines.append(',\n'.join(items))
lines.append('];')
lines.append('if (typeof self !== "undefined") { self.IPA_AUDIO_LIST = IPA_AUDIO_LIST; '
             'self.IPA_AUDIO_VER = IPA_AUDIO_VER; }')
io.open(OUT, 'w', encoding='utf-8', newline='\n').write('\n'.join(lines) + '\n')
print('wrote', OUT, len(KEYS), 'entries, ver', VER)
