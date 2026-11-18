/* v68 Sight Words「英文 + 中文」显示回归测试
 *   node tools/sight_zh_check.js
 * 要点（v68 修正）：真实出题扩容走 question-bank.js 的 WORDS 词表（271 词），
 *   不是 question-engine.js 的 WORDS_L1-L3。v65 版测试用错词表，才漏掉 201 个词没翻译。
 *   本测试以 question-bank.js 的 wordPool 为准 + 派生词形，逐一验证都有中文。
 * 断言：
 *   1) EN_ZH 覆盖 question-bank wordPool(0..3) 全部词（含派生词形回溯词根）
 *   2) sightLabel/sightZh 仅在 e-sight 生效，派生词能回溯词根翻译
 *   3) 判题数据不被显示层污染：data-v/词表仍是纯英文
 */
const fs = require('fs'), path = require('path'), vm = require('vm');
const R = path.resolve(__dirname, '..');

/* ---------- 用 VM 加载真实词表与 EN_ZH ---------- */
const stub = 'function ri(){return 0} function pick(a){return a[0]} function shuffle(a){return a.slice()}\n';
const ctx = { console, Math, JSON, Date, setTimeout, clearTimeout,
  localStorage: { getItem:()=>null, setItem:()=>{}, removeItem:()=>{}, clear:()=>{} } };
ctx.globalThis = ctx; ctx.window = undefined; vm.createContext(ctx);
const FILES = ['js/pokemon.js', 'js/zh-phonics.js', 'js/ref-pages.js', 'js/data.js', 'js/audio-map.js', 'js/question-bank.js'];
vm.runInContext(
  stub + FILES.map(f => fs.readFileSync(path.join(R, f), 'utf8')).join('\n;\n') + '\n;\n' +
  'globalThis.__D={EN_ZH,wordPool:Bank._internal.wordPool,wordCount:Bank.wordCount,SIGHT,CVC};',
  ctx, { filename: 'sight-bundle.js' });
const { EN_ZH, wordPool, wordCount } = ctx.__D;
const WORDS = wordPool(0);   // wordPool(0) 即 WORDS 基础表

// 把 app.js 的 sightZh + sightLabel 抽出来，在带 state 的上下文里跑
const appSrc = fs.readFileSync(path.join(R, 'js/app.js'), 'utf8');
const fnMatch = appSrc.match(/function sightZh\(word\)\{[\s\S]*?\n\}\nfunction sightLabel\(o\)\{[\s\S]*?\n\}/);
if (!fnMatch) { console.error('  ✗ app.js 里找不到 sightZh/sightLabel'); process.exit(1); }
const appCtx = { console, Math, String, EN_ZH, state: { lessonId: 'e-sight' } };
vm.createContext(appCtx);
vm.runInContext(fnMatch[0] + '\n;globalThis.sightLabel=sightLabel;globalThis.sightZh=sightZh;', appCtx, { filename: 'sightLabel.js' });
const sightLabel = appCtx.sightLabel, sightZh = appCtx.sightZh;

let fail = 0;
const ok = (cond, msg) => { if (cond) console.log('  ✓ ' + msg); else { fail++; console.log('  ✗ ' + msg); } };

console.log('【1】EN_ZH 覆盖真实出题词表 question-bank.js wordPool（关键！v65 测错了词表）');
const pool = [...new Set([].concat(...[0,1,2,3].map(s => wordPool(s))))];
const missing = pool.filter(w => !sightZh(w));
ok(pool.length > 250, `真实词表规模 ${pool.length} 词（含派生），不再是旧的 100 词自测`);
ok(missing.length === 0, `全部 ${pool.length} 词都有中文（缺失 ${missing.length}: ${missing.slice(0,25).join(',')||'无'}）`);
ok(WORDS.filter(w=>sightZh(w)).length === WORDS.length, `WORDS 基础表 ${WORDS.length} 词全有中文`);

console.log('【2】sightLabel 显示与派生词回溯');
appCtx.state.lessonId = 'e-sight';
ok(/cat/.test(sightLabel('cat')) && /猫/.test(sightLabel('cat')), 'e-sight: cat → 含「猫」');
ok(/电脑/.test(sightLabel('computer')), 'e-sight: computer → 含「电脑」（v65 遗漏的那批词）');
ok(/三明治/.test(sightLabel('sandwich')), 'e-sight: sandwich → 含「三明治」');
ok(/book/.test(sightLabel('books')) && /书/.test(sightLabel('books')), '派生 books → book「书」');
ok(/走/.test(sightLabel('walking')), '派生 walking → walk「走」');
ok(/开心/.test(sightLabel('unhappy')), '派生 unhappy → happy「开心」');
ok(/公共汽车/.test(sightLabel('buses')), '派生 buses → bus「公共汽车」');
appCtx.state.lessonId = 'e-grammar';
ok(sightLabel('cat') === 'cat' && sightLabel('computer') === 'computer', '非 e-sight 课：原样返回，不污染语法/阅读题');

console.log('【3】判题数据不被显示层改动');
ok(/data-v="\$\{o\}"/.test(appSrc), '主渲染按钮 data-v 仍绑定英文原词 o');
ok(String(WORDS).indexOf('猫') === -1, 'WORDS 词表本身仍是纯英文，未被中文污染');
ok(Object.keys(EN_ZH).every(k => EN_ZH[k]), 'EN_ZH 无空值（每个键都有对应中文）');

console.log(fail ? `\n✗ ${fail} 项失败` : '\n✓ 全部通过');
process.exit(fail ? 1 : 0);
