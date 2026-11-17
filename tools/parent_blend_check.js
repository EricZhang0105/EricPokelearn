/* 家长真人录音题库回归测试（Node）
   验证：① 未录音时 c-blend 用合成音全 63 池；② 录了若干字后只出已录题、clip=真人 URL；
        ③ question-engine 家长模式下跳过扩容；④ ParentBlendBank has/count/url 逻辑。 */
const fs=require('fs'), vm=require('vm'), path=require('path');
const ROOT=path.join(__dirname,'..');
const read=f=>fs.readFileSync(path.join(ROOT,f),'utf8');

// 最小全局环境
const ctx={
  console, Math, JSON, Date, Object, Array, String, Number, Boolean, Set, Map,
  URL:{ createObjectURL:()=> 'blob:test', revokeObjectURL:()=>{} },
  window:{ MediaRecorder:function(){} },
  setTimeout, clearTimeout,
  navigator:{},
  indexedDB:undefined,
};
ctx.globalThis=ctx;
vm.createContext(ctx);

// 依赖：zh-phonics（题库 + zhToneMark 等），parent-blend，data
vm.runInContext(read('js/zh-phonics.js'),ctx);
vm.runInContext(read('js/parent-blend.js'),ctx);
vm.runInContext(read('js/data.js'),ctx);

const pb=vm.runInContext('ParentBlendBank',ctx);
const CHINESE=vm.runInContext('CHINESE',ctx);
const cblend=CHINESE.find(l=>l.id==='c-blend');

let pass=0, fail=0;
function ok(name,cond){ if(cond){pass++; console.log('  ✓',name);} else{fail++; console.log('  ✗',name);} }

console.log('== ① ParentBlendBank 逻辑 ==');
pb.map={ syl_bu_dummy:1 }; // 占位，下面用真实 syl
pb.map={};
ok('初始 count=0', pb.count()===0);
pb.map['bu']={url:'blob:bu'};
pb.map['hang']={url:'blob:hang'};
ok('count=2', pb.count()===2);
ok('has(bu)=true', pb.has('bu')===true);
ok('has(ba)=false', pb.has('ba')===false);
ok('url(bu)=blob:bu', pb.url('bu')==='blob:bu');

console.log('== ② data.js c-blend 出题 ==');
// 未 ready → 合成音模式，全部来自 ZH_BLENDS
pb.ready=false;
let q1=cblend.make(10);
ok('合成模式出题数=10', q1.length===10);
ok('合成模式用 seq（4步）', Array.isArray(q1[0].speak.seq));
ok('合成模式 clip 是本地音频路径', /audio\/zh\//.test(q1[0].speak.seq[0].clip));

// ready + 2 题录制 → 只出这 2 题，clip=真人 URL，无 seq
pb.ready=true;
let q2=cblend.make(10);
ok('家长模式出题数=已录题数(2)', q2.length===2);
ok('家长模式只用已录音节', q2.every(q=>{
  const s=q.options.find(x=>x); // 答案为 sylT
  return q.speak.clip && (q.speak.clip==='blob:bu'||q.speak.clip==='blob:hang');
}));
ok('家长模式无 seq', q2.every(q=>!q.speak.seq));
ok('家长模式 prompt 仍带拼音', q2.every(q=>/拼一拼/.test(q.prompt)));

console.log('== ③ question-engine 家长模式跳过扩容 ==');
// 加载 question-engine 需要 D()/Store 等桩
ctx.D=()=>({qSeen:{},qMastered:{},qGrown:{},extraPassages:[]});
ctx.seenKeys=()=>[];
ctx.hash32=s=>{let h=0;for(const c of String(s))h=(h*31+c.charCodeAt(0))|0;return h;};
ctx.difficultyFor=()=>1;
ctx.normalizeQid=()=>{};
ctx.qKey=q=>'k'+(q._id||Math.random());
ctx.contentKey=q=>'c'+(q._id||Math.random());
ctx.isSeenQ=()=>false;
ctx.DIFF_LABEL={1:'L1'}; ctx.DIFF_LABEL_EN={1:'L1'};
ctx.toastMsg=()=>{};
ctx.Bank={ capacity:()=>({count:0}), build:()=>[] };
ctx.expandFor=()=>[];
ctx.freshPassageCount=()=>0;
ctx.ensurePassagePool=()=>{};
// 用真 question-engine 覆盖上面的桩函数
vm.runInContext(read('js/question-engine.js'),ctx);
const QE=(ctx.window&&ctx.window.QEngine)||ctx.QEngine;
if(QE && QE.freshQuestions){
  const lesson={ id:'c-blend', make:cblend.make };
  const r=QE.freshQuestions(lesson,'c-blend',10,{});
  ok('家长模式引擎只返回已录题', r.items.length===2);
  ok('家长模式 grown=0（无扩容）', r.grown===0);
  ok('家长模式 bankSize=已录题数', r.bankSize===2);
}else{
  fail++; console.log('  ✗ question-engine 未导出 QEngine');
}

console.log('\n结果：'+pass+' 通过 / '+fail+' 失败');
process.exit(fail?1:0);
