/* 伊布「能量石顺序进化」回归测试
 *   node tools/eevee_check.js
 * 断言：
 *   1) 伊布是独立顺序链（9 阶），不与其他多选一分支共用逻辑
 *   2) 每满 100 能量按顺序拿石头变身，变过的形态不重复
 *   3) 变身之后继续攒能量还能再变；最终形态后免疫
 *   4) 答错不会退化（不回头），首页形象跟 form.imgId 一起变
 *   5) 旧存档 stage=1 + branch=3 能无损迁移到顺序链 stage=4
 */
const fs = require('fs'), path = require('path'), vm = require('vm');
const R = path.resolve(__dirname, '..');

const mem = {};
const localStorage = {
  getItem: k => (k in mem ? mem[k] : null),
  setItem: (k, v) => { mem[k] = String(v); },
  removeItem: k => { delete mem[k]; },
  clear: () => { Object.keys(mem).forEach(k => delete mem[k]); }
};
const ctx = { console, Math, JSON, Date, localStorage, setTimeout, clearTimeout };
ctx.globalThis = ctx; ctx.window = undefined;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(R, 'js/pokemon.js'), 'utf8')
  + '\n;\n' + fs.readFileSync(path.join(R, 'js/storage.js'), 'utf8')
  + '\n;globalThis.__X={POKEMON,Store,EEVEE_CHAIN,EEVEELUTIONS,formOf,isSequentialChain,ENERGY_PER_STAGE};',
  ctx, { filename: 'eevee-bundle.js' });
const { Store, EEVEE_CHAIN, EEVEELUTIONS, formOf, isSequentialChain, ENERGY_PER_STAGE } = ctx.__X;

let fail = 0;
const ok = (cond, msg) => { if (cond) console.log('  ✓ ' + msg); else { fail++; console.log('  ✗ ' + msg); } };

Store.load();
console.log('== 数据定义 ==');
const pk = Store.stageInfo('eevee').pk;
ok(isSequentialChain(pk), '伊布标记为独立顺序链');
ok(pk.stages.length === 9 && EEVEE_CHAIN.length === 9, '伊布链为 9 阶（本体 + 8 形态）');
ok(Store.maxStage('eevee') === 8, 'maxStage = 8');
ok(!Array.isArray(pk.stages[1]), '第 2 阶不再是「多选一」数组');
ok(pk.stages.slice(1).every((s, i) => s === EEVEELUTIONS[i]), '形态顺序 = 水/雷/火/日/月/叶/冰/仙');

console.log('== 顺序进化 ==');
localStorage.clear(); Store.load();
const seen = [];
let evolutions = 0;
for (let i = 0; i < 400; i++) {
  const r = Store.addEnergy('eevee', 2);
  if (r.evolved) {
    evolutions++;
    const f = Store.stageInfo('eevee').form;
    seen.push(f.imgId);
  }
}
ok(evolutions === 8, `400 次答对（800 能量）恰好进化 8 次，实际 ${evolutions}`);
ok(new Set(seen).size === 8, '8 次变身没有重复形态');
ok(Store.stageInfo('eevee').form.name === 'Sylveon', '最终形态是仙子伊布');
ok(Store.stageInfo('eevee').stage === 8, 'stage 到达 8');
const beforeMax = Store.stageInfo('eevee').form.imgId;
Store.addEnergy('eevee', 100);
ok(Store.stageInfo('eevee').form.imgId === beforeMax, '最终形态后能量免疫，不再变化');

console.log('== 形象跟随 ==');
localStorage.clear(); Store.load();
const imgs = [];
for (let i = 0; i < 400; i++) {
  if (Store.addEnergy('eevee', 2).evolved) imgs.push(Store.stageInfo('eevee').form.imgId);
}
ok(imgs[0] === 134 && imgs[1] === 135, '首页形象先变水伊布(134)，再变雷伊布(135)');
ok(new Set(imgs).size === imgs.length, '每次进化首页形象都换成新图');

console.log('== 答错不回头 ==');
localStorage.clear(); Store.load();
for (let i = 0; i < 50; i++) Store.addEnergy('eevee', 2);  // stage=1 水伊布
const st1 = Store.stageInfo('eevee').stage;
for (let i = 0; i < 10; i++) Store.addEnergy('eevee', -2);
ok(Store.stageInfo('eevee').stage === st1, '答错不会退化回伊布（变过的形态不重复出现）');

console.log('== 旧存档迁移 ==');
mem['pokeLearnSave_v1'] = JSON.stringify({
  schema: 7, pokemon: { eevee: { energy: 20, stage: 1, branch: 3, deadUntil: null } }
});
Store.load();
ok(Store.stageInfo('eevee').stage === 4, '旧 stage=1/branch=3 → 顺序链 stage=4');
ok(Store.stageInfo('eevee').form.name === 'Espeon', '旧形态太阳伊布无损迁移');

console.log(fail === 0 ? '\n全部通过 ✓' : `\n失败 ${fail} 项 ✗`);
process.exit(fail ? 1 : 0);
