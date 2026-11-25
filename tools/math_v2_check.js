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
const make10Solution=vm.runInContext('make10Solution',ctx);
const subtractSolution=vm.runInContext('subtractSolution',ctx);
const gen={
  genCpaAdd:vm.runInContext('genCpaAdd',ctx),
  genCpaSub:vm.runInContext('genCpaSub',ctx),
  genDoubles:vm.runInContext('genDoubles',ctx),
  genWordPlus:vm.runInContext('genWordPlus',ctx),
  genLogic:vm.runInContext('genLogic',ctx),
  genSpace:vm.runInContext('genSpace',ctx),
  genFocus:vm.runInContext('genFocus',ctx),
  genMatch:vm.runInContext('genMatch',ctx),
  genPattern:vm.runInContext('genPattern',ctx),
  genCompare:vm.runInContext('genCompare',ctx),
  genOrdinal:vm.runInContext('genOrdinal',ctx),
  genMoney:vm.runInContext('genMoney',ctx),
  genTime:vm.runInContext('genTime',ctx),
};
const CJK=/[\u3400-\u9fff]/;
const hasCJK=s=>CJK.test(String(s||''));

console.log('\n=== 1. 课程注册 ===');
ok('MATH_V2 有 14 门课（8旧+5新+money/time+综合训练）', MATH_V2.length===14, 'got '+MATH_V2.length);
ok('MATH 已合并（>19 课）', MATH.length>=19, 'got '+MATH.length);
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
  /* v76 · 凑十法解题图：拆小数→凑十→合并，全英文 */
  ok(l+'#'+i+' 有 solutionHtml', !!q.solutionHtml);
  ok(l+'#'+i+' solutionHtml 全英文', !hasCJK(q.solutionHtml));
  ok(l+'#'+i+' solutionHtml 含凑十三要素',
    /sol-bond/.test(q.solutionHtml)&&/sol-need/.test(q.solutionHtml)
    &&/sol-left/.test(q.solutionHtml)&&/sol-ten/.test(q.solutionHtml));
});
scan('CPA减法', sets.genCpaSub, (q,i,l)=>{
  common(q,i,l);
  ok(l+'#'+i+' answer 在 options', q.options.includes(String(q.answer)));
  ok(l+'#'+i+' answer>0', Number(q.answer)>0, 'ans='+q.answer);
  /* v77 · 减法破十解题图：拆减数→退回十→再减，全英文 */
  ok(l+'#'+i+' 有 solutionHtml', !!q.solutionHtml);
  ok(l+'#'+i+' solutionHtml 全英文', !hasCJK(q.solutionHtml));
  ok(l+'#'+i+' solutionHtml 含破十三要素',
    /sol-sub/.test(q.solutionHtml)&&/sol-bond/.test(q.solutionHtml)
    &&/sol-need/.test(q.solutionHtml)&&/sol-left/.test(q.solutionHtml)
    &&/sol-ten/.test(q.solutionHtml));
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
/* v79 · 钱 / 时间应用题 */
scan('钱的问题', sets.genMoney, (q,i,l)=>{
  common(q,i,l);
  ok(l+'#'+i+' prompt=Money Problem', q.prompt==='Money Problem');
  ok(l+'#'+i+' sub 英文', !hasCJK(q.sub));
  ok(l+'#'+i+' visual 英文', q.visual && !hasCJK(q.visual));
  ok(l+'#'+i+' 题干含美元', /\$/.test(q.sub));
  ok(l+'#'+i+' answer 为正整数', Number.isInteger(Number(q.answer)) && Number(q.answer)>0, 'ans='+q.answer);
  ok(l+'#'+i+' answer 在 options', q.options.includes(String(q.answer)));
});
scan('时间问题', sets.genTime, (q,i,l)=>{
  common(q,i,l);
  ok(l+'#'+i+' prompt=Time Problem', q.prompt==='Time Problem');
  ok(l+'#'+i+' sub 英文', !hasCJK(q.sub));
  ok(l+'#'+i+' visual 英文', q.visual && !hasCJK(q.visual));
  ok(l+'#'+i+' 题干含 o\'clock', /o'clock/.test(q.sub));
  ok(l+'#'+i+' answer 1~12', Number(q.answer)>=1 && Number(q.answer)<=12, 'ans='+q.answer);
  ok(l+'#'+i+' answer 在 options', q.options.includes(String(q.answer)));
});
scan('逻辑推理', sets.genLogic, (q,i,l)=>{
  common(q,i,l);
  // v74 四类：choice(找规律) 或 circle(传递/排除/赛跑)
  ok(l+'#'+i+' type 合法', ['circle','choice'].includes(q.type), 'type='+q.type);
  if(q.type==='choice'){
    ok(l+'#'+i+' answer 在 options', q.options.includes(q.answer), 'ans='+q.answer);
    ok(l+'#'+i+' 找规律有题干序列', /❓|\?/.test(q.sub||''));
  }else{
    const keys=q.items.map(x=>x.key);
    ok(l+'#'+i+' answer 在 items', keys.includes(q.answer), 'ans='+q.answer);
    ok(l+'#'+i+' sub 含推理线索', /taller|shortest|biggest|faster|slower|not the/.test(q.sub));
    ok(l+'#'+i+' 宝可梦互不重复', new Set(keys).size===keys.length);
  }
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
scan('找规律', sets.genPattern, (q,i,l)=>{
  common(q,i,l);
  ok(l+'#'+i+' type=choice', q.type==='choice');
  ok(l+'#'+i+' answer 在 options', q.options.includes(q.answer), 'ans='+q.answer);
  ok(l+'#'+i+' 有序列题干', /❓/.test(q.sub));
});
scan('比大小', sets.genCompare, (q,i,l)=>{
  common(q,i,l);
  ok(l+'#'+i+' type=choice', q.type==='choice');
  ok(l+'#'+i+' answer 在 options', q.options.includes(q.answer), 'ans='+q.answer);
  ok(l+'#'+i+' 选项恰为两数', q.options.length===2);
});
scan('序数', sets.genOrdinal, (q,i,l)=>{
  common(q,i,l);
  ok(l+'#'+i+' type=circle', q.type==='circle');
  const keys=q.items.map(x=>x.key);
  ok(l+'#'+i+' answer 在 items', keys.includes(q.answer), 'ans='+q.answer);
  ok(l+'#'+i+' 宝可梦互不重复', new Set(keys.map(k=>k.replace(/_\d+$/,''))).size===keys.length);
});

/* v74 多模式覆盖：摇足够多次，确认逻辑/空间/连线的新子类都真的会出现 */
console.log('\n=== 2b. v74 新子类覆盖 ===');
{
  const logicBig=gen.genLogic(120), spaceBig=gen.genSpace(120), matchBig=gen.genMatch(120);
  ok('逻辑含 choice 找规律', logicBig.some(q=>q.type==='choice'));
  ok('逻辑含传递 taller', logicBig.some(q=>/taller|shortest/.test(q.sub||'')));
  ok('逻辑含排除 not the biggest', logicBig.some(q=>/not the biggest/.test(q.sub||'')));
  ok('逻辑含赛跑 faster/slower', logicBig.some(q=>/faster|slower/.test(q.sub||'')));
  ok('空间含相邻 next to', spaceBig.some(q=>/next to/.test(q.prompt||'')));
  ok('空间含两端 first and the last', spaceBig.some(q=>/first and the last/.test(q.prompt||'')));
  ok('空间含之间 between', spaceBig.some(q=>/between/.test(q.prompt||'')));
  ok('空间含镜像 mirror', spaceBig.some(q=>/mirror/i.test(q.prompt||'')));
  ok('连线含图形计数 group', matchBig.some(q=>/group to its number/.test(q.prompt||'')));
  ok('连线含数字分解 total', matchBig.some(q=>/sum to its total/.test(q.prompt||'')));
}

/* v78 · 从右往左的顺序题：确认真的出现，且答案确实指向从右数第 k 只 */
console.log('\n=== 2c. v78 从右数覆盖与答案正确性 ===');
{
  const ordBig=gen.genOrdinal(300), focBig=gen.genFocus(300);
  const ordRight=ordBig.filter(q=>/from the right/.test(q.prompt||''));
  const focRight=focBig.filter(q=>/from the right/.test(q.prompt||''));
  ok('序数含从右数题', ordRight.length>0, 'count='+ordRight.length);
  ok('专注力含从右数题', focRight.length>0, 'count='+focRight.length);
  ok('序数含从左数题（双向并存）', ordBig.some(q=>/from the left/.test(q.prompt||'')));
  ok('专注力含从左数题（双向并存）', focBig.some(q=>/from the left/.test(q.prompt||'')));
  const ansOK=(q)=>{
    const k=parseInt((String(q.prompt||'').match(/(\d+)(st|nd|rd|th)/)||[])[1]);
    const count=(q.items||[]).length;
    return !!(k&&count) && q.answer===q.items[count-k].key;
  };
  ok('序数从右数答案正确', ordRight.every(ansOK), 'checked='+ordRight.length);
  ok('专注力从右数答案正确', focRight.every(ansOK), 'checked='+focRight.length);
}

/* v79 · 钱/时间覆盖：5 种模式都真实出现，Eric 举例能算出正确答案 */
console.log('\n=== 2d. v79 钱/时间覆盖 ===');
{
  const moneyBig=gen.genMoney(250), timeBig=gen.genTime(250);
  ok('钱题含找零场景', moneyBig.some(q=>/change/.test(q.sub)));
  ok('钱题含花钱剩余场景', moneyBig.some(q=>/is left/.test(q.sub)));
  ok('钱题含还差多少场景', moneyBig.some(q=>/more money/.test(q.sub)));
  ok('钱题含总价场景', moneyBig.some(q=>/altogether/.test(q.sub)||/in all/.test(q.sub)));
  ok('时间题含醒来几小时场景', timeBig.some(q=>/been awake/.test(q.sub)));
  ok('时间题含经过几小时场景', timeBig.some(q=>/How many hours did it take/.test(q.sub)));
  ok('时间题含几小时后场景', timeBig.some(q=>/will it be in/.test(q.sub)));
  ok('时间题含几小时前场景', timeBig.some(q=>/hours ago/.test(q.sub)));
  /* 题目文字里的数字与答案要对得上（找零：pay − cost = ans） */
  const changeQ=moneyBig.find(q=>/pays with a \$(\d+)/.test(q.sub));
  if(changeQ){
    const pay=Number((changeQ.sub.match(/pays with a \$(\d+)/)||[])[1]);
    const cost=Number((changeQ.sub.match(/for \$(\d+)/)||[])[1]);
    ok('找零题 pay−cost=ans', pay-cost===Number(changeQ.answer), pay+'-'+cost+'='+changeQ.answer);
  }else ok('找零题 pay−cost=ans', false, 'no change question found');
  const awakeQ=timeBig.find(q=>/been awake/.test(q.sub));
  if(awakeQ){
    const now=Number((awakeQ.sub.match(/It is (\d+) o'clock/)||[])[1]);
    const woke=Number((awakeQ.sub.match(/woke up at (\d+) o'clock/)||[])[1]);
    ok('醒来题 now−woke=ans', now-woke===Number(awakeQ.answer), now+'-'+woke+'='+awakeQ.answer);
  }else ok('醒来题 now−woke=ans', false, 'no awake question found');
}

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
ok('sw 版本 v80', /pokelearn-v80/.test(sw));
ok('cloud 版本 v80', /v80 · 2026-11-25/.test(cc));
ok('引擎有 noPool 短路', /lesson\.noPool/.test(qe));
ok('app 有 circle 渲染分支', /q\.type==='circle'/.test(app));
ok('app 有 match 渲染分支', /q\.type==='match'/.test(app));
ok('app 绑定 circle', /bindCircle\(q,item\)/.test(app));
ok('app 绑定 match', /bindMatch\(q,item\)/.test(app));
ok('app 定义 bindCircle', /function bindCircle/.test(app));
ok('app 定义 bindMatch', /function bindMatch/.test(app));
ok('data 合并 MATH_V2', /MATH\.push\(\.\.\.MATH_V2\)/.test(F('js/data.js')));

console.log('\n=== 5. v76 · 解题图 + 手动翻页接线 ===');
ok('CPA 题带 solutionHtml', make10Solution!==undefined && /sol-card/.test(make10Solution(8,7)));
ok('解题图 8+7 拆成 2+5 得 15', (()=>{
  const h=make10Solution(8,7);
  return /sol-need">2</.test(h)&&/sol-left">5</.test(h)&&/sol-ten">10</.test(h)&&/sol-ans">15</.test(h);
})());
ok('解题图数学正确（遍历）', (()=>{
  for(let a=6;a<=9;a++)for(let b=2;b<=8;b++){
    const big=Math.max(a,b),small=Math.min(a,b),need=10-big,left=small-need;
    if(need<=0||left<=0) continue;
    const h=make10Solution(a,b);
    if(!new RegExp('sol-need">'+need).test(h)||!new RegExp('sol-left">'+left).test(h)
       ||!new RegExp('sol-ans">'+(a+b)).test(h)) return false;
  }
  return true;
})());
ok('减法题带 solutionHtml', subtractSolution!==undefined && /sol-sub/.test(subtractSolution(16,9)));
ok('解题图 16−9 拆成 6+3 得 7', (()=>{
  const h=subtractSolution(16,9);
  return h.includes('16 = 10 + 6')&&/sol-need">6</.test(h)&&/sol-left">3</.test(h)
    &&/sol-ten">10</.test(h)&&/sol-ans">7</.test(h)
    &&h.includes('16 − 6')&&h.includes('10 − 3');
})());
ok('减法解题图数学正确（遍历）', (()=>{
  for(let a=11;a<=18;a++)for(let take=a-9;take<=9;take++){
    const back=a-10,left=take-back;
    if(left<=0||back<=0) continue;
    const h=subtractSolution(a,take);
    if(!new RegExp('sol-need">'+back).test(h)||!new RegExp('sol-left">'+left).test(h)
       ||!new RegExp('sol-ans">'+(a-take)).test(h)) return false;
  }
  return true;
})());
ok('app 有翻页导航按钮', /navPrev/.test(app)&&/navNext/.test(app));
ok('app 定义 gotoQuestion', /function gotoQuestion/.test(app));
ok('gotoQuestion 真正移动 idx 指针', /const target=state\.idx\+delta;[\s\S]{0,160}state\.idx=target/.test(app));
ok('app 有作答快照还原', /state\.snap\[state\.idx\]/.test(app));
ok('app 有 settled 防重复结算', /state\.settled\[state\.idx\]/.test(app));
ok('showFeedback 不再自动跳题', !/if\(good && autoNext\)/.test(app) && !/setTimeout\(nextQuestion/.test(app));
ok('onCorrect onend 不再跳题', !/state\.pendingExplain=false;\s*nextQuestion\(\)/.test(app));
ok('CSS 有解题图样式', /\.sol-card\{/.test(F('css/styles.css')));
ok('CSS 有翻页按钮样式', /\.q-nav\{/.test(F('css/styles.css')));
console.log('\n=== 6. v79 钱/时间接线 ===');
const v2src=F('js/math-v2.js'), cssv=F('css/styles.css');
ok('课程注册 m-money', /id:'m-money'/.test(v2src));
ok('课程注册 m-time', /id:'m-time'/.test(v2src));
ok('综合题组含 money/time', /id:'money',\s*make:genMoney/.test(v2src) && /id:'time',\s*make:genTime/.test(v2src));
ok('m-combo 描述含 money·time', /money · time/.test(v2src));
ok('CSS 有钱/时间 chip 样式', /\.money-chip[^{}]*\{/.test(cssv) && /\.time-chip[^{}]*\{/.test(cssv));
const noComments=(F('js/app.js')+F('index.html')).replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/[^\n]*/g,'');
ok('无 controllerchange reload（剥离注释后）', !/controllerchange[\s\S]{0,120}location\.reload/.test(noComments));

console.log('\n========== 结果: '+pass+' PASS / '+fail+' FAIL ==========');
process.exit(fail?1:0);
