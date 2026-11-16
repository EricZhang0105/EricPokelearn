/* 汇总页回归测试（拼音全景 / 音标全景 / 10 以内口诀）
 *   node tools/ref_check.js
 *
 * 断言：
 *   1) 三个 ref 课程卡都挂在 CURRICULUM 里，ref id 与 REF_PAGES 对得上
 *   2) 拼音页每一个格子都有预录音频（audio/zh/<kind>_<key>.m4a 存在）
 *   3) 音标页每一个例词都在 AUDIO_MAP 里（同一把女声的本地录音）
 *   4) 数学口诀的每个词（数字词 + plus/minus/equals）都有录音 → 能拆段朗读
 *   5) 英文页 / 数学页不出现中文字符（项目硬规则）
 */
const fs = require('fs'), path = require('path'), vm = require('vm');
const R = path.resolve(__dirname, '..');
const FILES = ['js/pokemon.js', 'js/zh-phonics.js', 'js/ref-pages.js', 'js/data.js', 'js/audio-map.js'];

let src = 'function ri(){return 0} function pick(a){return a[0]} function shuffle(a){return a.slice()}\n'
  + FILES.map(f => fs.readFileSync(path.join(R, f), 'utf8')).join('\n;\n');
src += '\n;globalThis.__X={CURRICULUM,REF_PAGES,AUDIO_MAP,REF_ZH_FIN2,REF_EN_WORDS};';
const ctx = { console, Math, JSON, Date, module: { exports: {} } };
ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(src, ctx, { filename: 'ref-bundle.js' });
const { CURRICULUM, REF_PAGES, AUDIO_MAP } = ctx.__X;

let fail = 0;
const bad = m => { fail++; console.log('  ✗ ' + m); };

/* ---- 1. 课程卡 ---- */
console.log('== 课程卡 ==');
const want = { math: 'math-facts', english: 'ipa-chart', chinese: 'zh-map' };
Object.keys(want).forEach(sub => {
  const les = (CURRICULUM[sub].lessons || []).find(x => x.ref === want[sub]);
  if (!les) return bad(`${sub} 缺少 ref=${want[sub]} 的课程卡`);
  if (!REF_PAGES[les.ref]) return bad(`${sub} 的 ref=${les.ref} 在 REF_PAGES 里找不到`);
  console.log(`  ✓ ${sub} → ${les.id} ${les.title}`);
});

/* ---- 2. 拼音音频 ---- */
console.log('== 拼音全景 ==');
const zhHtml = REF_PAGES['zh-map'].render();
const tiles = [...zhHtml.matchAll(/data-say="([^"]*)"\s+data-clip="([^"]*)"\s+data-key="([^"]*)"/g)];
console.log(`  格子 ${tiles.length} 个`);
const seenClip = new Set();
tiles.forEach(([, say, kind, key]) => {
  const file = `audio/zh/${kind}_${key}.m4a`;
  seenClip.add(kind);
  if (!fs.existsSync(path.join(R, file))) bad(`缺音频 ${file}（${say}）`);
});
console.log(`  用到的音频类型：${[...seenClip].join(' / ')}`);
/* 四声卡片 key 形如 ma_1 */
[...zhHtml.matchAll(/data-clip="tone" data-key="([^"]*)"/g)].forEach(([, key]) => {
  const file = `audio/zh/tone_${key}.m4a`;
  if (!fs.existsSync(path.join(R, file))) bad(`缺音频 ${file}`);
});

/* ---- 3. 音标发音（点音标读的是音素本身，不是例词） ---- */
console.log('== 音标全景 ==');
const ipaHtml = REF_PAGES['ipa-chart'].render();
const ipaClips = [...new Set([...ipaHtml.matchAll(/data-clipurl="([^"]*)"/g)].map(m => m[1]))];
console.log(`  音素格子 ${ipaClips.length} 个`);
if (ipaClips.length !== 44) bad(`音素格子应为 44 个，实际 ${ipaClips.length} 个`);
const missClip = ipaClips.filter(u => !fs.existsSync(path.join(R, u.split('?')[0])));
if (missClip.length) bad(`缺音素录音：${missClip.slice(0, 5).join(', ')}`);
else console.log(`  44 段音素录音全部就位`);
/* 音素音频文件名必须和卡片上的 key 对应（防止改表时漏了某一条） */
const keySet = new Set(ipaClips.map(u => (u.match(/audio\/ipa\/([^.]+)\.m4a/) || [])[1]));
const listSrc = fs.readFileSync(path.join(R, 'js/ipa-audio-list.js'), 'utf8');
const specKeys = [...listSrc.matchAll(/audio\/ipa\/([^.]+)\.m4a/g)].map(m => m[1]);
const missKey = specKeys.filter(k => !keySet.has(k));
if (missKey.length) bad(`这些音素在页面上没有对应格子：${missKey.join(', ')}`);
else console.log(`  44 个音素 key 与页面一一对应`);

/* 字母表仍然读例词，这部分要有本地录音 */
const letterSays = [...new Set([...ipaHtml.matchAll(/data-say="([^"]*)"/g)].map(m => m[1]))]
  .filter(w => ![...ipaClips].some(u => u.includes(w)));
const shownSays = [...ipaHtml.matchAll(/data-say="([^"]*)"/g)].map(m => m[1]);
const missWord = [...new Set(shownSays)].filter(w => !AUDIO_MAP[String(w).toLowerCase()]);
if (missWord.length) bad(`字母卡例词没有本地录音：${missWord.join(', ')}`);
else console.log(`  字母卡例词 ${new Set(shownSays).size} 个全部有本地录音`);

/* ---- 4. 数学口诀 ---- */
console.log('== 10 以内口诀 ==');
const mathHtml = REF_PAGES['math-facts'].render();
const facts = [...mathHtml.matchAll(/data-say="([^"]*)"/g)].map(m => m[1]);
console.log(`  算式 ${facts.length} 道`);
const WANT = /^(\d{1,3}) (plus|minus) (\d{1,3}) equals (\d{1,3})$/;
facts.forEach(t => { if (!WANT.test(t)) bad(`算式格式不对：${t}`); });
const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
const needTok = new Set([...ONES, 'plus', 'minus', 'equals']);
const noTok = [...needTok].filter(t => !AUDIO_MAP[t]);
if (noTok.length) bad(`这些朗读片段缺录音：${noTok.join(', ')}`);
else console.log(`  朗读片段 ${needTok.size} 个齐全（数字词 + plus/minus/equals）`);

/* ---- 5. 语言规则 ---- */
console.log('== 语言规则 ==');
const ZH = /[\u4e00-\u9fff]/;
['ipa-chart', 'math-facts'].forEach(k => {
  const h = REF_PAGES[k].render();
  if (ZH.test(h)) bad(`${k} 出现中文（英文/数学科目必须全英文）`);
  else console.log(`  ✓ ${k} 无中文`);
});
if (!ZH.test(zhHtml)) bad('zh-map 没有中文（异常）');

console.log(fail === 0 ? '\n全部通过 ✓' : `\n失败 ${fail} 项 ✗`);
process.exit(fail ? 1 : 0);
