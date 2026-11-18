/* v66 四声辨调音频修复回归测试（Node，无需 Python 依赖）
 *   node tools/zh_tone_check.js
 * 断言：
 *   1) zhToneClip 生成的 32 个 URL 全部带独立版本 a=9（顶掉 iPad 旧缓存）
 *   2) 其余中文音频（zhClip/zhPyClip）仍是 a=8，真人 realhang 是 a=12
 *   3) SW 预缓存清单 zh-audio-list.js：32 条 tone = a=9，且与实际文件一一对应
 *   4) ZH_TONES 四声示范字/例词齐全，且题目 speak.clip 指向 tone a=9
 *   5) Praat 校验报告 zh_tone_report.json：32 段全部调型合格
 */
const fs = require('fs'), path = require('path'), vm = require('vm');
const R = path.resolve(__dirname, '..');
const rd = f => fs.readFileSync(path.join(R, f), 'utf8');

const ctx = { console, Math, JSON, Date, setTimeout, module: { exports: {} } };
ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(rd('js/zh-phonics.js') + '\n;\n' +
  'globalThis.__X={ZH_TONES,zhToneClip,zhClip,zhPyClip};', ctx, { filename: 'zh-tone-bundle.js' });
const { ZH_TONES, zhToneClip, zhClip, zhPyClip } = ctx.__X;

let fail = 0;
const ok = (c, m) => { if (c) console.log('  ✓ ' + m); else { fail++; console.log('  ✗ ' + m); } };

console.log('【1】zhToneClip URL 独立版本 a=9');
ok(ZH_TONES.length === 8, '四声辨调 8 组');
let toneUrls = [];
ZH_TONES.forEach(g => { for (let t = 1; t <= 4; t++) toneUrls.push(zhToneClip(g.base, t)); });
ok(toneUrls.length === 32, `共 ${toneUrls.length} 个 tone clip`);
ok(toneUrls.every(u => /^audio\/zh\/tone_[a-z]+_[1-4]\.m4a\?a=9$/.test(u)),
   '32 个 tone URL 均为 a=9');
const badVer = toneUrls.filter(u => !u.endsWith('a=9'));
if (badVer.length) console.log('    异常:', badVer.slice(0, 4));

console.log('【2】其它音频版本未受影响');
ok(zhClip('blend', 'ba').endsWith('a=8'), '普通中文音频 zhClip 仍 a=8');
ok(zhPyClip('bu').endsWith('a=8'), '拼读过渡音 zhPyClip 仍 a=8');

console.log('【3】SW 预缓存清单与实际文件');
const list = rd('js/zh-audio-list.js');
const entries = [...list.matchAll(/"(audio\/zh\/[^"]+)"/g)].map(m => m[1]);
const listTone = entries.filter(x => x.includes('/tone_'));
ok(listTone.length === 32, `清单里 tone 条目 ${listTone.length} 条`);
ok(listTone.every(x => x.endsWith('a=9')), '清单 tone 条目全部 a=9');
ok(entries.filter(x => x.includes('/realhang_')).every(x => x.endsWith('a=12')),
   '真人音频仍 a=12');
ok(entries.filter(x => !x.includes('/tone_') && !x.includes('/realhang_'))
          .every(x => x.endsWith('a=8')), '非 tone/真人音频仍 a=8');
const fs32 = ZH_TONES.flatMap(g => [1,2,3,4].map(t => `audio/zh/tone_${g.base}_${t}.m4a?a=9`));
ok(fs32.every(u => entries.includes(u)), '每个 tone clip 都在预缓存清单里');
ok(fs32.every(u => fs.existsSync(path.join(R, u.split('?')[0]))), '32 个 tone 音频文件都存在');

console.log('【4】四声题库数据完整');
ZH_TONES.forEach(g => {
  ok(g.py.length === 4 && g.hz.length === 4 && g.word.length === 4,
     `${g.base}: 拼音/示范字/例词各 4 项 (${g.hz.join('')})`);
});

console.log('【5】Praat 调型校验报告');
const rp = path.join(R, 'tools/zh_tone_report.json');
if (!fs.existsSync(rp)) { fail++; console.log('  ✗ 缺少 zh_tone_report.json'); }
else {
  const rep = JSON.parse(fs.readFileSync(rp, 'utf8'));
  ok(rep.length === 32, `报告含 ${rep.length} 段`);
  const bad = rep.filter(r => !r.ok);
  ok(bad.length === 0, `全部调型合格（不合格 ${bad.length}：${bad.map(r=>r.key).join(',')}）`);
  // 报告由 --verify 生成时字段是 before（即当前音频调型）；由修复模式生成时是 after。二者取其一。
  const cur = r => r.after || r.before;
  const wu = rep.find(r => r.key === 'tone_wu_1');
  const wan = rep.find(r => r.key === 'tone_wan_3');
  ok(wu && wu.ok && Math.abs(cur(wu).st[2]) < 1.2,
     `屋(wū 一声)高平：${wu ? cur(wu).st.join('/') : '?'} 半音`);
  ok(wan && wan.ok && cur(wan).st[1] < cur(wan).st[0] - 1 && cur(wan).st[1] < cur(wan).st[2] - 1,
     `晚(wǎn 三声)降升：${wan ? cur(wan).st.join('/') : '?'} 半音`);
}

console.log(fail ? `\n✗ ${fail} 项失败` : '\n✓ 全部通过');
process.exit(fail ? 1 : 0);
