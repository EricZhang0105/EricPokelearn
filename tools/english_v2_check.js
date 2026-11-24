/* v74 英语加深 + 综合题组专项校验：词汇分类/反义词/介词/押韵/序数 + English Mixed Review */
const fs=require('fs');
const vm=require('vm');
const path=require('path');
const ROOT=path.resolve(__dirname,'..');
let pass=0,fail=0;
const ok=(n,c,extra)=>{ if(c){pass++;console.log('  PASS',n);}else{fail++;console.log('  FAIL',n,extra||'');} };

function F(rel){ return fs.readFileSync(path.join(ROOT,rel),'utf8'); }
const ctx={ console,Math,JSON,Date,Set,Map,Array,Object,String,Number,
  document:{ querySelectorAll:()=>[] }, window:{},
  localStorage:{ getItem:()=>null, setItem:()=>{} }, module:undefined };
vm.createContext(ctx);
for(const f of ['js/pokemon.js','js/zh-phonics.js','js/phonics-sounds.js',
                'js/math-v2.js','js/data.js','js/english-v2.js']){
  try{ vm.runInContext(F(f),ctx,{filename:f}); }
  catch(e){ console.log('LOAD ERR',f,e.message); process.exit(1); }
}
const EV2=vm.runInContext('ENGLISH_V2',ctx);
const EN=vm.runInContext('ENGLISH',ctx);
const gen={
  genWordGroup:vm.runInContext('genWordGroup',ctx),
  genOpposite:vm.runInContext('genOpposite',ctx),
  genPreposition:vm.runInContext('genPreposition',ctx),
  genRhyme:vm.runInContext('genRhyme',ctx),
  genStoryOrder:vm.runInContext('genStoryOrder',ctx),
  genEnglishCombo:vm.runInContext('genEnglishCombo',ctx),
};
const CJK=/[\u3400-\u9fff]/;
const hasCJK=s=>CJK.test(String(s||''));

console.log('\n=== 1. 课程注册 ===');
ok('ENGLISH_V2 有 6 门课', EV2.length===6, 'got '+EV2.length);
ok('ENGLISH 已合并（>=12）', EN.length>=12, 'got '+EN.length);
const ids=EV2.map(l=>l.id);
ok('课程 id 全部唯一', new Set(ids).size===ids.length);
ok('新 id 不与旧课冲突', EV2.every(l=>EN.filter(x=>x.id===l.id).length===1));
ok('每门课都有 make()', EV2.every(l=>typeof l.make==='function'));
ok('每门课都标 noPool', EV2.every(l=>l.noPool===true));
ok('全英文 desc', EV2.every(l=>!hasCJK(l.desc)));
ok('全英文 title', EV2.every(l=>!hasCJK(l.title)));

console.log('\n=== 2. 题目生成：结构 / 可序列化 / 全英文 ===');
function scan(label,arr,validator){
  ok(label+' 生成够量(>=12)',arr.length>=12,'got '+arr.length);
  arr.forEach((q,i)=>validator(q,i,label));
}
function common(q,i,l){
  ok(l+'#'+i+' 可 JSON 序列化',(()=>{try{JSON.stringify(q);return true;}catch(e){return false;}})());
  ok(l+'#'+i+' prompt 英文',!hasCJK(q.prompt));
  ok(l+'#'+i+' explain 英文',!hasCJK(q.explain));
  ok(l+'#'+i+' speak.lang=en-US',q.speak&&q.speak.lang==='en-US');
}
const sets={};
for(const k of Object.keys(gen)){ sets[k]=gen[k](14); }

scan('词汇分类',sets.genWordGroup,(q,i,l)=>{
  common(q,i,l);
  ok(l+'#'+i+' type=circle',q.type==='circle');
  ok(l+'#'+i+' multi',q.multi===true);
  const keys=q.items.map(x=>x.key), ans=q.answer.split(',');
  ok(l+'#'+i+' answer 在 items',ans.every(a=>keys.includes(a)),'ans='+q.answer);
  ok(l+'#'+i+' 至少圈2个',ans.length>=2,'ans='+q.answer);
  ok(l+'#'+i+' 未圈满(有干扰项)',ans.length<keys.length,'ans='+q.answer);
  ok(l+'#'+i+' 词全英文',q.items.every(x=>!hasCJK(x.label)));
});
scan('反义词',sets.genOpposite,(q,i,l)=>{
  common(q,i,l);
  ok(l+'#'+i+' type=choice',q.type==='choice');
  ok(l+'#'+i+' answer 在 options',q.options.includes(q.answer),'ans='+q.answer);
  ok(l+'#'+i+' 有 4 选项',q.options.length===4);
});
scan('方位介词',sets.genPreposition,(q,i,l)=>{
  common(q,i,l);
  ok(l+'#'+i+' type=choice',q.type==='choice');
  ok(l+'#'+i+' answer 在选项',q.options.includes(q.answer),'ans='+q.answer);
  ok(l+'#'+i+' 答案是介词',['in','on','under','next to'].includes(q.answer));
});
scan('押韵',sets.genRhyme,(q,i,l)=>{
  common(q,i,l);
  ok(l+'#'+i+' type=choice',q.type==='choice');
  ok(l+'#'+i+' answer 在 options',q.options.includes(q.answer),'ans='+q.answer);
  ok(l+'#'+i+' 4 个选项',new Set(q.options).size===4,'opts='+q.options.join(','));
});
scan('逻辑排序',sets.genStoryOrder,(q,i,l)=>{
  common(q,i,l);
  ok(l+'#'+i+' type=circle',q.type==='circle');
  const keys=q.items.map(x=>x.key);
  ok(l+'#'+i+' answer 在 items',keys.includes(q.answer),'ans='+q.answer);
  ok(l+'#'+i+' 宝可梦互不重复',new Set(keys.map(k=>k.replace(/_\d+$/,''))).size===keys.length);
});
scan('英语综合',sets.genEnglishCombo,(q,i,l)=>{
  ok(l+'#'+i+' 可 JSON 序列化',(()=>{try{JSON.stringify(q);return true;}catch(e){return false;}})());
  ok(l+'#'+i+' type 有效',['choice','type','build','circle','passage','match'].includes(q.type),'type='+q.type);
  ok(l+'#'+i+' 有英文 speak 或 passage',q.type==='passage'||(q.speak&&q.speak.lang==='en-US'));
});

console.log('\n=== 3. 综合题组覆盖所有版块 ===');
{
  const seen=new Set();
  for(let r=0;r<20;r++) gen.genEnglishCombo(20).forEach(q=>{ if(q.src) seen.add(q.src); });
  const expected=['sight','spell','grammar','build','phonics','vocab','opposite','preposition','rhyme','order'];
  expected.forEach(s=>ok('综合覆盖 '+s,seen.has(s)));
  ok('综合覆盖 >=10 个版块',seen.size>=10,'got '+seen.size+' ('+Array.from(seen).join(',')+')');
}

console.log('\n=== 4. 真实取题去重能力 ===');
function normRaw(q){
  const strip=s=>String(s||'').replace(/<[^>]*>/g,'');
  return [q.type||'',strip(q.prompt),strip(q.sub),String(q.answer||''),
    (q.items||[]).map(x=>x.label).join(' '),strip(q.visual)].join('~');
}
for(const k of Object.keys(gen)){
  const seen=new Set();
  for(let round=0;round<12;round++) gen[k](14).forEach(q=>seen.add(normRaw(q)));
  ok(k+' 累积唯一题>=10',seen.size>=10,'uniq='+seen.size);
}

console.log('\n=== 5. 接线静态断言 ===');
const app=F('js/app.js'),idx=F('index.html'),sw=F('sw.js'),qe=F('js/question-engine.js');
ok('index 加载 english-v2.js 且在 data.js 后',
  idx.indexOf('js/english-v2.js')>0 && idx.indexOf('js/english-v2.js')>idx.indexOf('js/data.js'));
ok('sw 预缓存 english-v2.js',/\'\.\/js\/english-v2\.js\'/.test(sw));
ok('引擎有 noPool 短路',/lesson\.noPool/.test(qe));
ok('english-v2 合并进 ENGLISH',/ENGLISH\.push\(\.\.\.ENGLISH_V2\)/.test(F('js/english-v2.js')));
ok('app 有 circle 渲染分支',/q\.type===\'circle\'/.test(app));
ok('app 有 choice 渲染分支',/q\.type===\'choice\'/.test(app));

console.log('\n========== 结果: '+pass+' PASS / '+fail+' FAIL ==========');
process.exit(fail?1:0);
