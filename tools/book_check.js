/* 绘本库完整性校验
 * 用法：node tools/book_check.js
 * 新增绘本（手动或每周自动化）后跑一遍，全部 OK 才能发布。
 * 校验项：
 *   1) id 唯一、命名规范 zh|en-级别-短横线slug
 *   2) lang / level 合法；标题、tag 存在
 *   3) 每本页数 5–8 页；每页有正文和插画
 *   4) 插画：背景与图形键都必须存在；单页图形 ≤5 个
 *   5) 上新分组：BOOK_RELEASE.perWeek=5，能整除或余数 <5（余数会并入下一批）
 *   6) SVG 渲染冒烟：每本第一页能产出非空 <svg>
 */
const fs = require('fs'), path = require('path'), vm = require('vm');

const ROOT = path.join(__dirname, '..');
const ctx = { console }; ctx.globalThis = ctx; vm.createContext(ctx);
vm.runInContext(
  fs.readFileSync(path.join(ROOT, 'js', 'books.js'), 'utf8') +
  ';globalThis.__X={BOOKS,SHAPES,BOOK_LEVELS,BOOK_RELEASE,bookArt,currentBookWeek,availableBooks};', ctx);
const { BOOKS, SHAPES, BOOK_LEVELS, BOOK_RELEASE, bookArt, currentBookWeek, availableBooks } = ctx.__X;

const BGS = new Set(['day', 'night', 'sea', 'room', 'rain', 'snow', 'forest', 'garden']);
const LEVELS = new Set(BOOK_LEVELS.map(l => l.id));
let bad = 0;
const err = m => { bad++; console.log('  ✗ ' + m); };

const ids = new Set();
for (const b of BOOKS) {
  const tag = `[${b.id || '(无id)'}]`;
  if (!b.id) { err(tag + ' 缺 id'); continue; }
  if (ids.has(b.id)) err(tag + ' id 重复');
  ids.add(b.id);
  if (!/^(zh|en)-(k1|k2|p1|p2)-[a-z0-9-]+$/.test(b.id)) err(tag + ' id 命名不规范（应为 zh|en-级别-slug）');
  if (!['zh', 'en'].includes(b.lang)) err(tag + ' lang 必须是 zh/en');
  if (!LEVELS.has(b.level)) err(tag + ' level 必须是 k1/k2/p1/p2');
  if (!b.title || !b.titleEn) err(tag + ' 缺标题');
  if (!Array.isArray(b.pages) || b.pages.length < 5 || b.pages.length > 8) err(tag + ` 页数 ${b.pages && b.pages.length} 不在 5–8`);
  (b.pages || []).forEach((p, i) => {
    if (!p || !p.t || !String(p.t).trim()) err(tag + ` 第 ${i + 1} 页缺正文`);
    const spec = p && p.art;
    if (!spec) { err(tag + ` 第 ${i + 1} 页缺插画`); return; }
    const bar = String(spec).indexOf('|');
    const bg = bar < 0 ? String(spec).trim() : String(spec).slice(0, bar).trim();
    const items = bar < 0 ? [] : String(spec).slice(bar + 1).split(',').map(s => s.trim()).filter(Boolean);
    if (!BGS.has(bg)) err(tag + ` 第 ${i + 1} 页未知背景 ${bg}`);
    if (items.length > 5) err(tag + ` 第 ${i + 1} 页图形过多（${items.length} > 5）`);
    items.forEach(k => { if (!SHAPES[k]) err(tag + ` 第 ${i + 1} 页未知图形 ${k}`); });
  });
  const svg = bookArt(b.pages[0] && b.pages[0].art);
  if (!svg.startsWith('<svg') || svg.length < 300) err(tag + ' 封面 SVG 渲染异常');
}

const per = BOOK_RELEASE.perWeek;
const rem = BOOKS.length % per;
if (rem !== 0) console.log(`  ⚠ 共 ${BOOKS.length} 本，除以每周 ${per} 本余 ${rem}（余数会随下一批一起放出，可接受）`);

const wk = currentBookWeek();
const avail = availableBooks().length;
console.log(`\n共 ${BOOKS.length} 本（中文 ${BOOKS.filter(b => b.lang === 'zh').length} / 英文 ${BOOKS.filter(b => b.lang === 'en').length}）`);
console.log(`当前第 ${wk} 周，已解锁 ${avail} 本，下一批将于再过 ${7 - (Math.floor((Date.now() - new Date(BOOK_RELEASE.start)) / 86400000) % 7)} 天或自动化补书后放出`);
console.log(bad ? `\n✗ ${bad} 处问题，禁止发布` : '\n✅ 绘本库校验全部通过');
process.exit(bad ? 1 : 0);
