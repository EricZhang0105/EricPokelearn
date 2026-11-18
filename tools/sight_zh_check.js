/* v65 Sight Words「英文 + 中文」显示回归测试
 *   node tools/sight_zh_check.js
 * 断言：
 *   1) EN_ZH 覆盖所有可能成为 sight 选项的英文词（SIGHT/CVC/WORDS_L1-L3 去重）
 *   2) sightLabel() 仅在 e-sight 课给英文加中文，其它课/题型逐字不变
 *   3) 判题无关：题目 answer/options 仍是纯英文，中文只出现在显示 label 里
 */
const fs = require('fs'), path = require('path'), vm = require('vm');
const R = path.resolve(__dirname, '..');

const ctx = {
  console, Math, JSON, Date, setTimeout, clearTimeout,
  localStorage: { getItem:()=>null, setItem:()=>{}, removeItem:()=>{}, clear:()=>{} }
};
ctx.globalThis = ctx; ctx.window = undefined;
vm.createContext(ctx);
// data.js 提供 SIGHT/CVC/EN_ZH；question-engine.js 提供 WORDS_L1-L3 + wordPool
// 按项目惯例补齐 data.js 依赖的 zh-phonics.js 与工具桩函数
const FILES = ['js/pokemon.js', 'js/zh-phonics.js', 'js/ref-pages.js', 'js/data.js', 'js/audio-map.js', 'js/question-engine.js'];
const stub = 'function ri(){return 0} function pick(a){return a[0]} function shuffle(a){return a.slice()}\n';
vm.runInContext(
  stub + FILES.map(f => fs.readFileSync(path.join(R, f), 'utf8')).join('\n;\n') + '\n;\n' +
  'globalThis.__D={SIGHT,CVC,EN_ZH,wordPool:QEngine._internal.wordPool};',
  ctx, { filename: 'sight-bundle.js' });
// app.js 里的 sightLabel 依赖全局 state，单独把它抽出来在带 state 的上下文里跑
const { SIGHT, CVC, EN_ZH, wordPool } = ctx.__D;
const appSrc = fs.readFileSync(path.join(R, 'js/app.js'), 'utf8');
const fnMatch = appSrc.match(/function sightLabel\(o\)\{[\s\S]*?\n\}/);
if (!fnMatch) { console.error('  ✗ app.js 里找不到 sightLabel()'); process.exit(1); }
const appCtx = { console, Math, JSON, String, EN_ZH, state: { lessonId: 'e-sight' } };
vm.createContext(appCtx);
vm.runInContext(fnMatch[0] + '\n;globalThis.sightLabel=sightLabel;', appCtx, { filename: 'sightLabel.js' });
const sightLabel = appCtx.sightLabel;

let fail = 0;
const ok = (cond, msg) => { if (cond) console.log('  ✓ ' + msg); else { fail++; console.log('  ✗ ' + msg); } };

console.log('【1】EN_ZH 覆盖所有 sight 选项词');
const poolWords = [...new Set(wordPool(5))];   // = WORDS_L1+L2+L3 + SIGHT + CVC 去重
const allWords = [...new Set([...SIGHT, ...CVC, ...poolWords])];
const missing = allWords.filter(w => !EN_ZH[String(w).toLowerCase()]);
ok(missing.length === 0, `所有可能选项词 ${allWords.length} 个全部有中文（缺失: ${missing.join(',') || '无'}）`);
const poolMissing = poolWords.filter(w => !EN_ZH[String(w).toLowerCase()]);
ok(poolMissing.length === 0, `wordPool(5) ${poolWords.length} 词全部有中文（缺失: ${poolMissing.join(',') || '无'}）`);

console.log('【2】sightLabel 仅在 e-sight 生效');
appCtx.state.lessonId = 'e-sight';
ok(/cat/.test(sightLabel('cat')) && /猫/.test(sightLabel('cat')), 'e-sight: cat → 含「猫」');
ok(sightLabel('I') === sightLabel('I') && /我/.test(sightLabel('I')), 'e-sight: I → 含「我」（大小写归一）');
ok(/公共汽车/.test(sightLabel('bus')), 'e-sight: bus → 含「公共汽车」');
appCtx.state.lessonId = 'e-grammar';
ok(sightLabel('cat') === 'cat', '非 e-sight 课: cat 原样返回，不污染语法/阅读题');
appCtx.state.lessonId = 'e-phonics';
ok(sightLabel('sun') === 'sun', '非 e-sight 课: sun 原样返回');

console.log('【3】判题数据不被显示层改动');
ok(/data-v="\$\{o\}"/.test(appSrc), '主渲染按钮 data-v 仍绑定英文原词 o');
ok(String(SIGHT).indexOf('猫') === -1, 'SIGHT 词表本身仍是纯英文，未被中文污染');
ok(Object.keys(EN_ZH).every(k => EN_ZH[k]), 'EN_ZH 无空值（每个键都有对应中文）');

console.log(fail ? `\n✗ ${fail} 项失败` : '\n✓ 全部通过');
process.exit(fail ? 1 : 0);
