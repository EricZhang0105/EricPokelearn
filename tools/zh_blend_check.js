/* 中文拼读冒烟测试：c-blend 的 seq 必须全是预录 clip、文件存在、相邻不重复
   （有声调 = 四步；轻声不标调 = 三步） */
const fs = require('fs'), path = require('path'), vm = require('vm');
const R = path.resolve(__dirname, '..');
const FILES = ['js/pokemon.js', 'js/zh-phonics.js', 'js/data.js'];

let src = FILES.map(f => fs.readFileSync(path.join(R, f), 'utf8')).join('\n;\n');
src += `
;globalThis.__probe = (function(){
  const les = (CURRICULUM.chinese.lessons||[]).find(x=>x.id==='c-blend');
  if(!les) return { les:null, items:[] };
  /* 跑 30 套，覆盖到 63 个音节（含轻声），不只抽 10 道 */
  const items=[]; for(let r=0;r<30;r++) items.push.apply(items, les.make());
  return { les: les, items: items };
})();
`;

const ctx = { console, Math, JSON, Date, setTimeout, module: { exports: {} } };
ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(src, ctx, { filename: 'zh-bundle.js' });

const probe = ctx.__probe;
if (!probe.les) { console.log('FAIL 找不到 c-blend 课程'); process.exit(1); }
const items = probe.items;
console.log('出题数量:', items.length);

let bad = 0, missing = 0, notClip = 0, dup = 0;
const seen = new Set();
items.forEach((q, i) => {
  const seq = q.speak && q.speak.seq;
  /* 有声调 → 四步（韵母/带调韵母/声母/音节）；轻声不标调 → 三步（韵母/声母/音节） */
  if (!Array.isArray(seq) || (seq.length !== 4 && seq.length !== 3)) {
    bad++; console.log(`#${i} seq 段数异常(${seq && seq.length}):`, JSON.stringify(q.speak)); return;
  }
  seq.forEach((s, k) => {
    if (!s.clip) { notClip++; console.log(`#${i} 第${k + 1}段无 clip -> text=${s.text}`); return; }
    if (k > 0 && s.clip === seq[k - 1].clip) { dup++; console.log(`#${i} 第${k}段与上一段同一音频（重复读）: ${s.clip}`); }
    seen.add(s.clip);
    const p = path.join(R, s.clip.split('?')[0]);
    if (!fs.existsSync(p)) { missing++; console.log(`#${i} 第${k + 1}段缺文件 ${s.clip}`); }
  });
  /* 第 2 段：四步时必须是 tonefin（真·带调韵母），三步时必须是 initial */
  const s2 = (seq[1].clip || '');
  if (seq.length === 4 && !/\/tonefin_/.test(s2)) { bad++; console.log(`#${i} 四步第2段不是 tonefin: ${s2}`); }
  if (seq.length === 3 && !/\/initial_/.test(s2)) { bad++; console.log(`#${i} 三步第2段不是 initial: ${s2}`); }
  /* 最后一段必须是 syl（只读音节），不能是 blend（会读声母/例词，泄题） */
  const sLast = (seq[seq.length - 1].clip || '');
  if (!/\/syl_/.test(sLast)) { bad++; console.log(`#${i} 末段不是 syl: ${sLast}`); }
});

console.log('涉及音频文件:', seen.size);
console.log(`异常题 ${bad} / 无clip段 ${notClip} / 缺文件 ${missing} / 相邻重复 ${dup}`);
console.log(bad === 0 && notClip === 0 && missing === 0 && dup === 0 ? '冒烟测试通过 ✓' : '冒烟测试失败 ✗');

if (items[0]) {
  console.log('\n样例:', items[0].prompt);
  console.log(items[0].sub);
  console.log(JSON.stringify(items[0].speak.seq, null, 1));
}
