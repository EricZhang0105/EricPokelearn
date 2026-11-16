/* 生成三张汇总页的静态预览（把 css/styles.css 内联进来）
 *   node tools/ref_preview.js
 * 产物：D:/WorkBuddy-workspace/_pk_preview/ref-pages.html
 * 用途：不进 App 也能一眼看排版（真机效果与 App 内一致，用的是同一份 CSS）
 */
const fs = require('fs'), path = require('path'), vm = require('vm');
const R = path.resolve(__dirname, '..');
const OUT_DIR = 'D:/WorkBuddy-workspace/_pk_preview';
const OUT = path.join(OUT_DIR, 'ref-pages.html');

const FILES = ['js/zh-phonics.js', 'js/ref-pages.js'];
let src = 'function ri(){return 0} function pick(a){return a[0]} function shuffle(a){return a.slice()}\n'
  + FILES.map(f => fs.readFileSync(path.join(R, f), 'utf8')).join('\n;\n');
src += '\n;globalThis.__X={REF_PAGES};';
const ctx = { console, Math, JSON, Date };
ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(src, ctx, { filename: 'p.js' });
const { REF_PAGES } = ctx.__X;
const css = fs.readFileSync(path.join(R, 'css/styles.css'), 'utf8');

const PAGES = [
  ['zh-map', 'chinese', 'zoe'],
  ['ipa-chart', 'english', 'zoe'],
  ['math-facts', 'math', 'dee'],
];
const tabs = PAGES.map(([k, , who], i) =>
  `<button class="pv-tab${i === 0 ? ' on' : ''}" data-i="${i}">${REF_PAGES[k].title}</button>`).join('');
const panels = PAGES.map(([k, cls], i) => `
<div class="pv-panel${i === 0 ? ' on' : ''}" data-i="${i}">
  <div class="ref-head"><h2>${REF_PAGES[k].title}</h2><p class="muted">${REF_PAGES[k].hint}</p></div>
  <div class="ref-body ${cls}">${REF_PAGES[k].render()}</div>
</div>`).join('');

const html = `<!DOCTYPE html><html lang="zh"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>汇总页预览 · PokeLearn</title>
<style>${css}
/* 预览页自己的外壳，不影响 App */
.pv-wrap{max-width:960px;margin:0 auto;padding:18px 16px 80px;}
.pv-tabs{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px;position:sticky;top:0;z-index:9;
  padding:10px 0;background:linear-gradient(180deg,#FFF7E6 70%,rgba(255,247,230,0));}
.pv-tab{border:2px solid #FFE0BE;background:#fff;border-radius:14px;padding:9px 14px;
  font-family:inherit;font-size:14px;font-weight:800;color:#8A4B00;cursor:pointer;}
.pv-tab.on{background:linear-gradient(135deg,#FFD9A3,#FFB870);border-color:#FF9E45;}
.pv-panel{display:none;} .pv-panel.on{display:block;}
.pv-foot{margin-top:22px;font-size:12px;color:#B6AEA0;text-align:center;}
</style></head><body>
<div class="pv-wrap">
  <div class="pv-tabs">${tabs}</div>
  ${panels}
  <div class="pv-foot">Preview only · same CSS as the app · 点格子会放大一下（真机上同时朗读）</div>
</div>
<script>
document.querySelectorAll('.pv-tab').forEach(b=>b.onclick=()=>{
  document.querySelectorAll('.pv-tab').forEach(x=>x.classList.toggle('on',x===b));
  document.querySelectorAll('.pv-panel').forEach(p=>p.classList.toggle('on',p.dataset.i===b.dataset.i));
});
document.querySelectorAll('[data-say]').forEach(el=>el.onclick=()=>{
  el.classList.remove('tap'); void el.offsetWidth; el.classList.add('tap');
});
</script>
</body></html>`;

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(OUT, html, 'utf8');
console.log('written', OUT, (html.length / 1024).toFixed(1) + ' KB');
