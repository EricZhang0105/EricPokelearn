/* 走路草 / 蚊香蝌蚪 / 拉鲁拉丝「伊布式顺序进化」回归测试
 *   node tools/seq_evolution_check.js
 * 断言：
 *   1) 三只都标记为顺序链（方块 🪨），各自 4 阶、无多选一分支
 *   2) 形态顺序 = 官方进化链，每满 100 能量按顺序进化一阶
 *   3) 变过的形态不重复、答错不退化、最终形态免疫
 *   4) 首页形象随 form.imgId 变化
 *   5) 旧存档 stage=2 + branch(0/1) 无损迁移到顺序链 stage=2/3
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
  + '\n;globalThis.__X={POKEMON,Store,formOf,isSequentialChain,ENERGY_PER_STAGE};',
  ctx, { filename: 'seq-bundle.js' });
const { Store, formOf, isSequentialChain, ENERGY_PER_STAGE } = ctx.__X;

const SPECS = [
  { id:'oddish',  cn:'走路草',   chain:['Oddish','Gloom','Vileplume','Bellossom'], imgs:[43,44,45,182] },
  { id:'poliwag', cn:'蚊香蝌蚪', chain:['Poliwag','Poliwhirl','Poliwrath','Politoed'], imgs:[60,61,62,186] },
  { id:'ralts',   cn:'拉鲁拉丝', chain:['Ralts','Kirlia','Gardevoir','Gallade'], imgs:[280,281,282,475] },
];

let fail = 0;
const ok = (cond, msg) => { if (cond) console.log('  ✓ ' + msg); else { fail++; console.log('  ✗ ' + msg); } };

localStorage.clear(); Store.load();   // 初始化主存档

SPECS.forEach(spec=>{
  console.log(`\n== ${spec.cn} (${spec.id}) ==`);
  const pk = Store.stageInfo(spec.id).pk;
  ok(isSequentialChain(pk), `${spec.cn}标记为顺序链（🪨）`);
  ok(pk.stages.length===4, '进化链为 4 阶');
  ok(pk.stages.every(s=>!Array.isArray(s)), '每一阶都是单一形态，无多选一分支');
  ok(pk.stages.map(s=>s.name).join(',')===spec.chain.join(','), `形态顺序 = ${spec.chain.join('→')}`);

  // 顺序进化：每 100 能量进化一阶，一直走到最终形态
  localStorage.clear(); Store.load();
  const seen=[];
  for(let i=0;i<300;i++){
    const r=Store.addEnergy(spec.id, 2);
    if(r.evolved) seen.push(Store.stageInfo(spec.id).form.name);
  }
  ok(seen.length===3, `恰好进化 3 次到最终形态，实际 ${seen.length}`);
  ok(new Set(seen).size===3, '3 次变身形态不重复');
  ok(Store.stageInfo(spec.id).form.name===spec.chain[3], `最终形态 = ${spec.chain[3]}`);
  ok(Store.stageInfo(spec.id).stage===3, 'stage 到达 3');
  const before=Store.stageInfo(spec.id).form.imgId;
  Store.addEnergy(spec.id,100);
  ok(Store.stageInfo(spec.id).form.imgId===before, '最终形态能量免疫');
  ok(Store.stageInfo(spec.id).form.imgId===spec.imgs[3], `首页最终形象 imgId=${spec.imgs[3]}`);

  // 答错不退化（和伊布一样不回头）
  localStorage.clear(); Store.load();
  for(let i=0;i<50;i++) Store.addEnergy(spec.id,2); // stage=1
  const st1=Store.stageInfo(spec.id).stage;
  for(let i=0;i<10;i++) Store.addEnergy(spec.id,-2);
  ok(Store.stageInfo(spec.id).stage===st1, '答错不会退化回头');
});

console.log('\n== 旧存档迁移（branch → 顺序链）==');
[0,1].forEach(branch=>{
  mem['pokeLearnSave_v1']=JSON.stringify({
    schema:7, pokemon:{ ralts:{ energy:20, stage:2, branch, deadUntil:null } }
  });
  Store.load();
  ok(Store.stageInfo('ralts').stage===2+branch, `旧 stage=2/branch=${branch} → 顺序链 stage=${2+branch}`);
  ok(Store.stageInfo('ralts').form.name===SPECS[2].chain[2+branch],
     `旧形态无损迁移为 ${SPECS[2].chain[2+branch]}`);
});

console.log(fail===0 ? '\n全部通过 ✓' : `\n失败 ${fail} 项 ✗`);
process.exit(fail?1:0);
