/* 英文泛读扩容冒烟测试：QEngine.makeStory 必须产出结构不同的文章，且无中文 */
const fs = require('fs'), path = require('path'), vm = require('vm');
const R = path.resolve(__dirname, '..');
const FILES = ['js/pokemon.js', 'js/zh-phonics.js', 'js/data.js', 'js/question-engine.js'];

let src = FILES.map(f => fs.readFileSync(path.join(R, f), 'utf8')).join('\n;\n');
src += `
;globalThis.__probe = (function(){
  const out=[];
  for(let i=0;i<24;i++){ out.push(QEngine.makeStory(2, 'seed'+i)); }
  return out;
})();
`;
const ctx = { console, Math, JSON, Date, setTimeout, module: { exports: {} } };
ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(src, ctx, { filename: 'en-bundle.js' });

const stories = ctx.__probe;
const titles = stories.map(s => s.title);
const uniq = new Set(titles);
console.log('生成 24 篇，标题去重:', uniq.size);
console.log('标题样本:', [...uniq].join(' | '));

const ZH = /[\u4e00-\u9fff]/;
let zhLeak = 0, qErr = 0, shortN = 0;
stories.forEach((s, i) => {
  /* 题目字段是 q（题干）/ a（答案）/ o（选项），简答题用 short 标记 */
  const blob = [s.title, s.text, ...(s.qs || []).flatMap(q => [q.q, q.a, q.hint, ...(q.o || [])])]
    .filter(x => typeof x === 'string').join('\n');
  if (ZH.test(blob)) { zhLeak++; console.log(`#${i} 含中文:`, s.title); }
  (s.qs || []).forEach((q, k) => {
    if (!q.q || q.a === undefined || q.a === null) { qErr++; console.log(`#${i} 第${k + 1}题结构异常`); }
    if (q.short) { shortN++; return; }
    if (!Array.isArray(q.o) || !q.o.includes(q.a)) { qErr++; console.log(`#${i} 第${k + 1}题答案不在选项里:`, q.a, q.o); }
  });
});

const heads = stories.map(s => s.text.split(/(?<=[.!?])\s/)[0]);
const headU = new Set(heads).size;
console.log('首句去重:', headU, '/ 24');
console.log(`中文泄漏 ${zhLeak} / 题目异常 ${qErr} / 简答题 ${shortN}`);
console.log(zhLeak === 0 && qErr === 0 && headU >= 20 ? '冒烟测试通过 ✓' : '冒烟测试失败 ✗');

console.log('\n--- 样例 ---');
[0, 1].forEach(i => {
  console.log(`[${stories[i].title}] ${stories[i].text}`);
  (stories[i].qs || []).forEach(q => console.log('  Q:', q.q, '| A:', q.a));
  console.log('');
});
