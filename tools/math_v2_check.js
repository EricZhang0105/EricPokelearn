/* v70 数学新题专项校验：CPA + 逻辑/空间/专注力 + 圈选/连线 */
const fs=require('fs');
const vm=require('vm');
const path=require('path');
const ROOT=path.resolve(__dirname,'..');
let pass=0,fail=0;
const ok=(n,c,extra)=>{ if(c){pass++;console.log('  PASS',n);}else{fail++;console.log('  FAIL',n,extra||'');} };

/* ---- 在 VM 里加载依赖链：pokemon → math-v2 → data ---- */
function F(rel){ return fs.readFileSync(path.join(ROOT,rel),'utf8'); }
const ctx={ console, Math, JSON, Date, Set, Map, Array, Object, String, Number,
  document:{ querySelectorAll:()=>[] }, window:{}, module:undefined };
vm.createContext(ctx);
for(const f of ['js/pokemon.js','js/zh-phonics.js','js/phonics-sounds.js','js/math-v2.js','js/data.js']){
  try{ vm.runInContext(F(f),ctx,{filename:f}); }catch(e){ console.log('LOAD ERR',f,e.message); process.exit(1); }
}
const MATH_V2=vm.runInContext('MATH_V2',ctx);
const MATH=vm.runInContext('MATH',ctx);
const gen={
  genCpaAdd:vm.runInContext('genCpaAdd',ctx),
  genCpaSub:vm.runInContext('genCpaSub',ctx),
  genDoubles:vm.runInContext('genDoubles',ctx),
  genWordPlus:vm.runInContext('genWordPlus',ctx),
  genLogic:vm.runInContext('genLogic',ctx),
  genSpace:vm.runInContext('genSpace',ctx),
  genFocus:vm.runInContext('genFocus',ctx),
  genMatch:vm.runInContext('genMatch',ctx),
};
const CJK=/[\u3400-\u9fff]/;
const hasCJK=s=>CJK.test(String(s||''));

console.log('\n=== 1. 课程注册 ===');
ok('MATH_V2 有 8 门课', MATH_V2.length===8, 'got '+MATH_V2.length);
ok('MATH 已合并（>18 课）', MATH.length>=18, 'got '+MATH.length);
const ids=MATH_V2.map(l=>l.id);
ok('课程 id 全部唯一', new Set(ids).size===ids.length);
ok('新 id 不与旧课冲突', MATH_V2.every(l=>MATH.filter(x=>x.id===l.id).length===1));
ok('每门课都有 make()', MATH_V2.every(l=>typeof l.make==='function'));
ok('每门课都标 noPool', MATH_V2.every(l=>l.noPool===true));
ok('全英文 desc', MATH_V2.every(l=>!hasCJK(l.desc)));
ok('全英文 title', MATH_V2.every(l=>!hasCJK(l.title)));

console.log('\n=== 2. 题目生成：结构 / 可序列化 / 全英文 ===');
function scan(label, arr, validator){
  ok(label+' 生成够量(>=12)', arr.length>=12, 'got '+arr.length);
  arr.forEach((q,i)=>{ validator(q,i,label); });
}
function common(q,i,label){
  ok(label+'#'+i+' 可 JSON 序列化', (()=>{try{JSON.stringify(q);return true;}catch(e){return false;}})());
  ok(label+'#'+i+' prompt 英文', !hasCJK(q.prompt));
  ok(label+'#'+i+' explain 英文', !hasCJK(q.explain));
  ok(label+'#'+i+' speak.lang=en-US', q.speak && q.speak.lang==='en-US');
  ok(label+'#'+i+' type 有效', ['choice','circle','match'].includes(q.type));
}
const sets={};
for(const k of Object.keys(gen)){ sets[k]=gen[k](14); }

scan('CPA加法', sets.genCpaAdd, (q,i,l)=>{
  common(q,i,l);
  ok(l+'#'+i+' answer 在 options', q.options.includes(String(q.answer)));
  ok(l+'#'+i+' visual 有十格框+条形图', /ten-frame/.test(q.visual)&&/bar-model/.test(q.visual));
});
scan('CPA减法', sets.genCpaSub, (q,i,l)=>{
  common(q,i,l);
  ok(l+'#'+i+' answer 在 options', q.options.includes(String(q.answer)));
  ok(l+'#'+i+' answer>0', Number(q.answer)>0, 'ans='+q.answer);
});
scan('Doubles', sets.genDoubles, (q,i,l)=>{
  common(q,i,l);
  ok(l+'#'+i+' answer 在 options', q.options.includes(String(q.answer)));
});
scan('进阶应用题', sets.genWordPlus, (q,i,l)=>{
  common(q,i,l);
  ok(l+'#'+i+' sub 英文', !hasCJK(q.sub));
  ok(l+'#'+i+' answer 在 options', q.options.includes(String(q.answer)));
});
scan('逻辑赛跑', sets.genLogic, (q,i,l)=>{
  common(q,i,l);
  ok(l+'#'+i+' type=circle', q.type==='circle');
  const keys=q.items.map(x=>x.key);
  ok(l+'#'+i+' answer 在 items', keys.includes(q.answer), 'ans='+q.answer);
  ok(l+'#'+i+' sub 含比较线索', /faster|slower/.test(q.sub));
  ok(l+'#'+i+' items 英文', q.items.every(x=>!hasCJK(x.label)));
});
scan('空间排队', sets.genSpace, (q,i,l)=>{
  common(q,i,l);
  ok(l+'#'+i+' type=circle', q.type==='circle');
  const keys=q.items.map(x=>x.key);
  const ans=q.answer.split(',');
  ok(l+'#'+i+' answer 在 items', ans.every(a=>keys.includes(a)), 'ans='+q.answer);
  ok(l+'#'+i+' 位置标记存在', q.items.every(x=>x.pos));
});
scan('专注力', sets.genFocus, (q,i,l)=>{
  common(q,i,l);
  ok(l+'#'+i+' type=circle', q.type==='circle');
  const keys=q.items.map(x=>x.key);
  const ans=q.answer.split(',');
  ok(l+'#'+i+' answer 在 items', ans.every(a=>keys.includes(a)), 'ans='+q.answer);
  ok(l+'#'+i+' items>=5', q.items.length>=5);
  // 核心回归：同一题里出现的宝可梦 id 必须互不相同（去掉 _序号 后缀后比对）
  const ids=q.items.map(x=>String(x.key).replace(/_\d+$/,''));
  ok(l+'#'+i+' 宝可梦互不重复', new Set(ids).size===ids.length, 'ids='+ids.join(','));
  ok(l+'#'+i+' item key 唯一', new Set(keys).size===keys.length);
  if(/Circle all the/.test(q.prompt))
    ok(l+'#'+i+' 首字母题至少2只匹配', ans.length>=2, 'ans='+q.answer);
});
scan('连线配对', sets.genMatch, (q,i,l)=>{
  common(q,i,l);
  ok(l+'#'+i+' type=match', q.type==='match');
  ok(l+'#'+i+' 左3项', (q.left||[]).length===3);
  ok(l+'#'+i+' 右3项', (q.right||[]).length===3);
  const lids=q.left.map(x=>x.id), rids=q.right.map(x=>x.id);
  ok(l+'#'+i+' pairs 指向存在的右项', Object.values(q.pairs).every(r=>rids.includes(r)));
  ok(l+'#'+i+' pairs 覆盖所有左项', Object.keys(q.pairs).every(x=>lids.includes(x))&&Object.keys(q.pairs).length===3);
  ok(l+'#'+i+' answer=排序数字组合', /^\d+(, \d+)*$/.test(q.answer), 'ans='+q.answer);
  ok(l+'#'+i+' 右项 label 英文数字', q.right.every(x=>/^\d+$/.test(x.label)));
});

console.log('\n=== 3. 真实取题能力（模拟 noPool 摇多次累积，凑够 10 道不重复）===');
function normRaw(q){
  const strip=s=>String(s||'').replace(/<[^>]*>/g,'');
  return [q.type||'',strip(q.prompt),strip(q.sub),String(q.answer||''),
    (q.tiles||[]).slice().sort().join(' '),strip(q.title),strip(q.text),strip(q.visual)].join('~');
}
for(const k of Object.keys(gen)){
  const seen=new Set();
  for(let round=0;round<12;round++) gen[k](14).forEach(q=>seen.add(normRaw(q)));
  ok(k+' 累积唯一题>=10', seen.size>=10, 'uniq='+seen.size);
}

console.log('\n=== 4. 接线静态断言 ===');
const app=F('js/app.js'), idx=F('index.html'), sw=F('sw.js'), qe=F('js/question-engine.js'), cc=F('js/cloud-config.js');
ok('index 加载 math-v2.js 且在 data.js 前', idx.indexOf('js/math-v2.js')>0 && idx.indexOf('js/math-v2.js')<idx.indexOf('js/data.js'));
ok('sw 预缓存 math-v2.js', /'\.\/js\/math-v2\.js'/.test(sw));
ok('sw 版本 v71', /pokelearn-v71/.test(sw));
ok('cloud 版本 v71', /v71 · 2026-11-23/.test(cc));
ok('引擎有 noPool 短路', /lesson\.noPool/.test(qe));
ok('app 有 circle 渲染分支', /q\.type==='circle'/.test(app));
ok('app 有 match 渲染分支', /q\.type==='match'/.test(app));
ok('app 绑定 circle', /bindCircle\(q,item\)/.test(app));
ok('app 绑定 match', /bindMatch\(q,item\)/.test(app));
ok('app 定义 bindCircle', /function bindCircle/.test(app));
ok('app 定义 bindMatch', /function bindMatch/.test(app));
ok('data 合并 MATH_V2', /MATH\.push\(\.\.\.MATH_V2\)/.test(F('js/data.js')));
const noComments=(F('js/app.js')+F('index.html')).replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/[^\n]*/g,'');
ok('无 controllerchange reload（剥离注释后）', !/controllerchange[\s\S]{0,120}location\.reload/.test(noComments));

console.log('\n========== 结果: '+pass+' PASS / '+fail+' FAIL ==========');
process.exit(fail?1:0);
