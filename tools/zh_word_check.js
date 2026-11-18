/* v69 中文词语专项（c-word）回归测试
 *   node tools/zh_word_check.js
 *
 * 中文难度上台阶靠这一课：反义词 / 近义词 / 量词 / 同音字 / 成语。
 * 这些都是「文字题」，最怕的是**答案本身错**（量词配错、成语填错字），
 * 所以本测试除了结构校验，还逐条核对答案与选项、并检查重复题。
 *
 * 断言：
 *   1) CHINESE 里有 c-word 课程卡，make() 能出满 10 题
 *   2) 题库 ≥200 道确定性题，qid 唯一，答案必在选项里
 *   3) 题型完整：反义 / 近义 / 量词 / 同音字 / 成语 都能抽到
 *   4) 难度随 level 上升（低 level 以反义词为主，高 level 出现成语）
 *   5) 题干里的空格都能被答案填上（不残留「（ ）」）
 */
const fs = require('fs'), path = require('path'), vm = require('vm');
const R = path.resolve(__dirname, '..');

const stub = 'function ri(a,b){return a} function pick(a){return a[0]} function shuffle(a){return a.slice()}\n';
const ctx = { console, Math, JSON, Date, setTimeout, clearTimeout,
  localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {}, clear: () => {} } };
ctx.globalThis = ctx; vm.createContext(ctx);
['js/pokemon.js', 'js/zh-phonics.js', 'js/ref-pages.js', 'js/data.js', 'js/audio-map.js', 'js/question-bank.js']
  .forEach(f => vm.runInContext(fs.readFileSync(path.join(R, f), 'utf8'), ctx));

const CURR = vm.runInContext('CHINESE', ctx);
const BANK = vm.runInContext('Bank.build("c-word",3,0)', ctx);
const ZH_OPP = vm.runInContext('ZH_OPP', ctx);
const ZH_SYN = vm.runInContext('ZH_SYN', ctx);
const ZH_MEASURE = vm.runInContext('ZH_MEASURE', ctx);
const ZH_HOMO = vm.runInContext('ZH_HOMO', ctx);
const ZH_IDIOM = vm.runInContext('ZH_IDIOM', ctx);

let fail = 0;
const ok = (cond, msg) => { if (cond) console.log('  ✓ ' + msg); else { fail++; console.log('  ✗ ' + msg); } };
const plain = s => String(s).replace(/<[^>]+>/g, '');

console.log('【1】课程卡与出题');
const lesson = CURR.find(l => l.id === 'c-word');
ok(!!lesson, 'CHINESE 里有 c-word 课程卡');
ok(lesson && typeof lesson.make === 'function', 'c-word 有 make()');
const set = lesson ? lesson.make(10, { level: 4 }) : [];
ok(set.length === 10, `make(10, level4) 出 ${set.length} 题`);
ok(set.every(q => q.type === 'choice' && q.answer && Array.isArray(q.options)), '每题都有选项与答案');
ok(set.every(q => q.options.includes(q.answer)), '每题答案都在选项里');
ok(set.every(q => q.speak && q.speak.lang === 'zh-CN'), '每题都带中文朗读');

console.log('【2】题库规模与确定性');
ok(BANK.length >= 200, `确定性题库 ${BANK.length} 道（≥200）`);
ok(new Set(BANK.map(q => q.qid)).size === BANK.length, 'qid 无重复');
ok(BANK.every(q => q.options.includes(q.answer)), '答案必在选项里');
ok(BANK.every(q => new Set(q.options).size === q.options.length), '同一题的选项不重复');
const dupContent = BANK.length - new Set(BANK.map(q => plain(q.sub) + '|' + q.answer)).size;
ok(dupContent === 0, `没有「同题面同答案」的重复题（${dupContent}）`);

console.log('【3】五类题型齐全');
const kinds = { opp: 0, syn: 0, measure: 0, homo: 0, idiom: 0 };
BANK.forEach(q => {
  const p = q.prompt;
  if (p.includes('相反')) kinds.opp++;
  else if (p.includes('接近')) kinds.syn++;
  else if (p.includes('量词')) kinds.measure++;
  else if (p.includes('正确的字')) kinds.homo++;
  else if (p.includes('成语')) kinds.idiom++;
});
Object.keys(kinds).forEach(k => ok(kinds[k] > 10, `题型 ${k} 有 ${kinds[k]} 道`));

console.log('【4】难度随 level 上升');
const typeCount = (lv) => {
  const arr = lesson.make(10, { level: lv });
  const hard = arr.filter(q => /正确的字|成语/.test(q.prompt)).length;
  return { arr, hard };
};
const lv1 = typeCount(1), lv5 = typeCount(5);
ok(lv1.hard === 0, `level1 不出现同音字/成语（${lv1.hard}）`);
ok(lv5.hard >= 3, `level5 同音字/成语占 ${lv5.hard}/10`);

console.log('【5】题干空格可被答案填上');
const leftovers = [];
BANK.forEach(q => {
  const s = plain(q.sub);
  if (!/[（(]\s*[)）]/.test(s)) return;              // 没有空格的题（如反义词）跳过
  const filled = s.replace(/[（(]\s*[)）]/, q.answer);
  if (/[（(]\s*[)）]/.test(filled)) leftovers.push(plain(q.sub));
});
ok(leftovers.length === 0, `所有填空题都能被答案填满（残留 ${leftovers.length}）`);

console.log('【6】语料自身一致性');
ok(ZH_OPP.every(p => p.length === 2 && p[0] !== p[1]), `反义词 ${ZH_OPP.length} 组，两侧不重复`);
ok(new Set(ZH_OPP.map(p => p[0])).size === ZH_OPP.length, '反义词题面不重复');
ok(ZH_SYN.every(p => p.length === 2 && p[0] !== p[1]), `近义词 ${ZH_SYN.length} 组`);
ok(ZH_MEASURE.every(m => m.o.includes(m.a) && m.o.length === 3), `量词 ${ZH_MEASURE.length} 条，答案都在候选中`);
ok(new Set(ZH_MEASURE.map(m => m.n)).size === ZH_MEASURE.length, '量词名词不重复');
ok(ZH_HOMO.every(h => h.o.includes(h.a) && h.s.includes('（ ）')), `同音字 ${ZH_HOMO.length} 条格式正确`);
ok(ZH_IDIOM.every(d => d.o.includes(d.a) && d.s.includes('（ ）')), `成语 ${ZH_IDIOM.length} 条格式正确`);
ok(new Set(ZH_IDIOM.map(d => d.s)).size === ZH_IDIOM.length, '成语题面不重复');

console.log(fail ? `\n✗ ${fail} 项失败` : '\n✅ 中文词语题库全部通过');
process.exit(fail ? 1 : 0);
