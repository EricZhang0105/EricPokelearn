/* 中文拼读冒烟测试：c-blend 四段 seq 必须全是预录 clip 且文件存在 */
const fs = require('fs'), path = require('path'), vm = require('vm');
const R = path.resolve(__dirname, '..');
const FILES = ['js/pokemon.js', 'js/zh-phonics.js', 'js/data.js'];

let src = FILES.map(f => fs.readFileSync(path.join(R, f), 'utf8')).join('\n;\n');
src += `
;globalThis.__probe = (function(){
  const les = (CURRICULUM.chinese.lessons||[]).find(x=>x.id==='c-blend');
  return { les: les, items: les ? les.make() : [] };
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

let bad = 0, missing = 0, notClip = 0;
const seen = new Set();
items.forEach((q, i) => {
  const seq = q.speak && q.speak.seq;
  if (!Array.isArray(seq) || seq.length !== 4) { bad++; console.log(`#${i} seq 不是四段:`, JSON.stringify(q.speak)); return; }
  seq.forEach((s, k) => {
    if (!s.clip) { notClip++; console.log(`#${i} 第${k + 1}段无 clip -> text=${s.text}`); return; }
    seen.add(s.clip);
    const p = path.join(R, s.clip.split('?')[0]);
    if (!fs.existsSync(p)) { missing++; console.log(`#${i} 第${k + 1}段缺文件 ${s.clip}`); }
  });
  // 第 2 段必须是 tonefin（有调）或退化为 final（轻声）
  const s2 = seq[1].clip || '';
  if (!/tonefin_/.test(s2) && !/final_/.test(s2)) console.log(`#${i} 第2段异常 ${s2}`);
  // 第 4 段必须是 syl，不能是 blend（blend 会泄题读声母/例词）
  const s4 = seq[3].clip || '';
  if (!/syl_/.test(s4)) { bad++; console.log(`#${i} 第4段不是 syl: ${s4}`); }
});

console.log('涉及音频文件:', seen.size);
console.log(`异常题 ${bad} / 无clip段 ${notClip} / 缺文件 ${missing}`);
console.log(bad === 0 && notClip === 0 && missing === 0 ? '冒烟测试通过 ✓' : '冒烟测试失败 ✗');

if (items[0]) {
  console.log('\n样例:', items[0].prompt);
  console.log(items[0].sub);
  console.log(JSON.stringify(items[0].speak.seq, null, 1));
}
