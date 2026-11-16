/* 英文泛读扩容冒烟测试：makeStory 必须产出结构不同的文章，且无中文 */
const fs = require('fs'), path = require('path'), vm = require('vm');
const R = path.resolve(__dirname, '..');
const FILES = ['js/pokemon.js', 'js/zh-phonics.js', 'js/data.js', 'js/question-engine.js'];

let src = FILES.map(f => fs.readFileSync(path.join(R, f), 'utf8')).join('\n;\n');
src += `
;globalThis.__probe = (function(){
  const out=[];
  for(let i=0;i<24;i++){ out.push(makeStory(2, 'seed'+i)); }
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
let zhLeak = 0, qErr = 0;
stories.forEach((s, i) => {
  const blob = [s.title, s.text, ...(s.qs || []).flatMap(q => [q.prompt, q.sub, q.answer, q.explain, ...(q.options || [])])]
    .filter(x => typeof x === 'string').join('\n');
  if (ZH.test(blob)) { zhLeak++; console.log(`#${i} 含中文:`, s.title); }
  (s.qs || []).forEach((q, k) => {
    if (!q.prompt || q.answer === undefined || q.answer === null) { qErr++; console.log(`#${i} 第${k + 1}题结构异常`); }
    if (q.options && !q.options.includes(q.answer)) { qErr++; console.log(`#${i} 第${k + 1}题答案不在选项里:`, q.answer, q.options); }
  });
});

// 文章首句去重，判断是否换皮
const heads = stories.map(s => s.text.split(/(?<=[.!?])\s/)[0]);
console.log('首句去重:', new Set(heads).size, '/ 24');
console.log(`中文泄漏 ${zhLeak} / 题目异常 ${qErr}`);
console.log(zhLeak === 0 && qErr === 0 ? '冒烟测试通过 ✓' : '冒烟测试失败 ✗');

console.log('\n--- 样例 ---');
[0, 1].forEach(i => {
  console.log(`[${stories[i].title}] ${stories[i].text}`);
  (stories[i].qs || []).forEach(q => console.log('  Q:', q.prompt, '| A:', q.answer));
  console.log('');
});
