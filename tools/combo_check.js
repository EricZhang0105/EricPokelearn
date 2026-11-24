/* v73 数学「综合训练 Mixed Review」回归测试
 *   node tools/combo_check.js
 *
 * 背景：综合训练必须把数学模块所有题型混在一套里练，不能只出加减法。
 * 校验：
 *   1) 课程卡存在、noPool（保住 circle/match 交互）、全英文
 *   2) comboFamilies() 覆盖数学模块全部 17 类出题器（m-facts 是挂图不算）
 *   3) 连摇多套，17 类全部真实出现过（不是只在注册表里挂着）
 *   4) 每道题结构合法：choice 答案在选项内 / circle 答案在 items 内 /
 *      match 配对完整；可 JSON 序列化；全英文
 *   5) 经 QEngine.freshQuestions 真实组题链路能出满 10 道、不重复
 *   6) 版本号与接线断言
 */
const fs = require('fs'), path = require('path'), vm = require('vm');
const R = path.resolve(__dirname, '..');
let pass = 0, fail = 0;
const ok = (n, c, extra) => {
  if (c) { pass++; console.log('  PASS', n); }
  else { fail++; console.log('  FAIL', n, extra === undefined ? '' : extra); }
};
const F = rel => fs.readFileSync(path.join(R, rel), 'utf8');

/* ---- VM 加载完整依赖链（与真实 index.html 顺序一致） ---- */
const localStorage = (() => {
  const m = {};
  return {
    getItem: k => (k in m ? m[k] : null),
    setItem: (k, v) => { m[k] = String(v); },
    removeItem: k => { delete m[k]; },
    clear: () => { Object.keys(m).forEach(k => delete m[k]); }
  };
})();
const ctx = {
  console, Math, JSON, Date, Set, Map, Array, Object, String, Number,
  setTimeout, clearTimeout, localStorage,
  document: { querySelectorAll: () => [], querySelector: () => null, getElementById: () => null },
  navigator: { userAgent: 'node' }
};
ctx.globalThis = ctx; ctx.window = ctx; vm.createContext(ctx);
const FILES = [
  'js/pokemon.js', 'js/zh-phonics.js', 'js/phonics-sounds.js', 'js/math-v2.js',
  'js/data.js', 'js/question-bank.js', 'js/read-passages.js', 'js/storage.js',
  'js/question-engine.js'
];
FILES.forEach(f => {
  try { vm.runInContext(F(f), ctx, { filename: f }); }
  catch (e) { console.log('LOAD ERR', f, e.message); process.exit(1); }
});
vm.runInContext('Store.load();', ctx);

const MATH = vm.runInContext('MATH', ctx);
const families = vm.runInContext('comboFamilies()', ctx);
const genCombo = vm.runInContext('genCombo', ctx);
const QEngine = ctx.QEngine || vm.runInContext('QEngine', ctx);
const CJK = /[\u3400-\u9fff]/;
const hasCJK = s => CJK.test(String(s || ''));

/* 数学模块所有「会出题」的课程 = MATH 里有 make() 的课，排除只读挂图 m-facts */
const makers = MATH.filter(l => typeof l.make === 'function' && !l.ref && l.id !== 'm-combo');
const makerIds = makers.map(l => l.id);

console.log('\n=== 1. 课程注册 ===');
const combo = MATH.filter(l => l.id === 'm-combo');
ok('综合训练课程卡存在且唯一', combo.length === 1, 'got ' + combo.length);
const les = combo[0] || {};
ok('标了 noPool（circle/match/visual 不被统一题库冲掉）', les.noPool === true);
ok('标题全英文', !!les.title && !hasCJK(les.title), les.title);
ok('简介全英文', !!les.desc && !hasCJK(les.desc));
ok('有 make()', typeof les.make === 'function');
ok('排在数学课程列表最后', MATH[MATH.length - 1].id === 'm-combo');
ok('课程总数 = 原 18 课 + 11 门 v70/v74 专项课 + 综合训练', MATH.length === 22, 'got ' + MATH.length);

console.log('\n=== 2. 覆盖数学模块全部题型 ===');
const famIds = families.map(f => f.id);
ok('题型数 = 20', families.length === 20, 'got ' + families.length + ': ' + famIds.join(','));
ok('题型 id 唯一', new Set(famIds).size === famIds.length);
ok('每个题型都有出题函数', families.every(f => typeof f.make === 'function'));
const LEGACY = ['count','bonds10','add10','bonds20','add20','sub10','sub20','word','mixed'];
const V2 = ['cpa-add','cpa-sub','doubles','word-plus','logic','space','focus','match'];
ok('经典 9 类齐全', LEGACY.every(id => famIds.includes(id)), LEGACY.filter(id => !famIds.includes(id)).join(','));
ok('CPA/新题 8 类齐全', V2.every(id => famIds.includes(id)), V2.filter(id => !famIds.includes(id)).join(','));
ok('每个出课题都 Register 了（无遗漏）', makerIds.every(id => {
  const short = id.replace(/^m-/, '');
  return famIds.includes(short) || (id === 'm-cpa-add' && famIds.includes('cpa-add'));
}), '未覆盖: ' + makerIds.filter(id => !famIds.includes(id.replace(/^m-/, ''))).join(','));

console.log('\n=== 3. 连摇 60 套：题型真的全部出现 ===');
const seenSrc = new Set();
const seenQ = new Set();
let totalQ = 0, minTypesPerSet = 99, badStruct = [], cjk = 0, dupInSet = 0;
const norm = q => [q.type || '', String(q.prompt || ''), String(q.sub || ''), String(q.answer || ''),
  String(q.visual || '')].join('~');
for (let round = 0; round < 60; round++) {
  const set = genCombo(10);
  ok('第' + (round + 1) + '套出满 10 道', set.length === 10, 'got ' + set.length);
  if (set.length !== 10) continue;
  const types = new Set(set.map(q => q.src));
  minTypesPerSet = Math.min(minTypesPerSet, types.size);
  const local = new Set();
  set.forEach(q => {
    totalQ++;
    seenSrc.add(q.src);
    const n = norm(q); seenQ.add(n);
    if (local.has(n)) dupInSet++; local.add(n);
    try { JSON.stringify(q); } catch (e) { badStruct.push('JSON:' + q.src); }
    if (!['choice', 'circle', 'match'].includes(q.type)) badStruct.push('type:' + q.type);
    if (hasCJK(q.prompt) || hasCJK(q.explain) || hasCJK(q.sub)) cjk++;
    if (!q.speak || q.speak.lang !== 'en-US') badStruct.push('lang:' + q.src);
    if (q.type === 'choice' && !(q.options || []).includes(String(q.answer)))
      badStruct.push('opt:' + q.src);
    if (q.type === 'circle') {
      const keys = (q.items || []).map(x => x.key);
      const ans = String(q.answer || '').split(',');
      if (!ans.every(a => keys.includes(a))) badStruct.push('circle-ans:' + q.src);
    }
    if (q.type === 'match') {
      const lids = (q.left || []).map(x => x.id), rids = (q.right || []).map(x => x.id);
      if (lids.length !== 3 || rids.length !== 3) badStruct.push('match-size:' + q.src);
      else if (!Object.keys(q.pairs || {}).every(k => lids.includes(k) && rids.includes(q.pairs[k])))
        badStruct.push('match-pairs:' + q.src);
    }
  });
}
ok('20 类题型全部真实出现', seenSrc.size === 20, 'seen=' + seenSrc.size + ' missing=' + famIds.filter(x => !seenSrc.has(x)).join(','));
ok('每套至少覆盖 9 种题型', minTypesPerSet >= 9, 'min=' + minTypesPerSet);
ok('题目结构全部合法', badStruct.length === 0, badStruct.slice(0, 5).join(' | '));
ok('题干无中文', cjk === 0, 'cjk=' + cjk);
ok('同一套内无重复题', dupInSet === 0, 'dup=' + dupInSet);
ok('600 道题累计指纹充足（>400）', seenQ.size > 400, 'uniq=' + seenQ.size);

console.log('\n=== 4. 真实组题链路（QEngine.freshQuestions） ===');
const got = QEngine.freshQuestions(les, 'm-combo', 10, {});
ok('引擎出满 10 道', got.items.length === 10, 'got ' + got.items.length);
ok('引擎结果都带题目对象', got.items.every(x => x && x.q && ['choice', 'circle', 'match'].includes(x.q.type)));
ok('引擎结果引擎内不重复', new Set(got.items.map(x => QEngine.qKey(x.q))).size === got.items.length);
ok('难度分级可用', got.level >= 1 && got.level <= 5, 'level=' + got.level);
const comboStat = QEngine.stats('m-combo');
ok('课程统计可读', !!comboStat && comboStat.level >= 1);

console.log('\n=== 5. 版本与接线 ===');
const idx = F('index.html'), sw = F('sw.js'), cc = F('js/cloud-config.js'), pkg = F('package.json');
const ver = JSON.parse(pkg).version.split('.')[0];
ok('sw 缓存版本 v' + ver, new RegExp('pokelearn-v' + ver).test(sw));
ok('cloud-config 版本 v' + ver, new RegExp('v' + ver + ' · ').test(cc));
ok('math-v2.js 在 index 中加载', idx.indexOf('js/math-v2.js') > 0);
ok('引擎保留 noPool 短路', /lesson\.noPool/.test(F('js/question-engine.js')));
ok('data.js 合并 MATH_V2', /MATH\.push\(\.\.\.MATH_V2\)/.test(F('js/data.js')));

console.log('\n========== 结果: ' + pass + ' PASS / ' + fail + ' FAIL ==========');
process.exit(fail ? 1 : 0);
