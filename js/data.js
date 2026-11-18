/* =========================================================
   PokeLearn · 课程数据层 v3
   - 宝可梦图库 / 进化常量见 js/pokemon.js（本文件之前加载）
   - CURRICULUM：数学(按 MOE K1 分阶) / 英文(含分级读物) / 中文(拼音)
   - 题目对象均为纯数据，可序列化存入错题本：
     { type:'choice'|'type'|'build'|'passage', prompt, sub, visual, speak,
       options:[], answer, tiles:[], explain }
   ========================================================= */

/* ---------------- 工具函数 ---------------- */
/* 数学难度：由 js/question-engine.js 按累计答对数设置（1–5）。
   数字上限随难度放大，题目空间随之变大 —— 这就是数学的「自动扩容」。 */
let MATH_LEVEL = 1;
function setMathLevel(n){ MATH_LEVEL = Math.max(1, Math.min(5, Number(n)||1)); }
function mCap(base, step){ return base + (MATH_LEVEL-1)*step; }
function ri(min,max){ return Math.floor(Math.random()*(max-min+1))+min; }
function pick(arr){ return arr[ri(0,arr.length-1)]; }
function shuffle(a){ a=a.slice(); for(let i=a.length-1;i>0;i--){const j=ri(0,i);[a[i],a[j]]=[a[j],a[i]];} return a; }
function numOptions(answer,min,max){
  const s=new Set([Number(answer)]);
  let guard=0;
  while(s.size<4 && guard++<80){
    const d=Number(answer)+ri(-3,3);
    if(d>=min&&d<=max&&d!==Number(answer)&&!s.has(d)) s.add(d);
  }
  /* 边界值（例如答案正好等于 max，附近凑不满 4 个不同数）必须能兜底退出，
     旧版在这里会无限循环，导致整节课白屏卡死。先取离答案最近的数字。 */
  for(let k=1;k<=12&&s.size<4;k++){
    [Number(answer)-k,Number(answer)+k].forEach(d=>{
      if(d>=min&&d<=max&&!s.has(d)&&s.size<4) s.add(d);
    });
  }
  for(let d=min;d<=max&&s.size<4;d++) if(!s.has(d)) s.add(d);
  let v=Number(answer)+1;
  while(s.size<4){ if(!s.has(v)) s.add(v); v++; }
  return shuffle([...s]).map(String);
}
/* =========================================================
   数学图形：全部使用本地官方宝可梦精灵图（v26）
   - 4 + 3 → 「4 只皮卡丘 + 3 只皮卡丘」
   - 减法只画被减数 a 只，末尾 b 只变灰划 ✕，绝不把答案画出来
   - petKey 会进入 QEngine 的题目指纹，换一只宝可梦算一道新题
   ========================================================= */
const MATH_PETS = [
  {id:25,  name:'Pikachu',    cn:'皮卡丘'},
  {id:1,   name:'Bulbasaur',  cn:'妙蛙种子'},
  {id:4,   name:'Charmander', cn:'小火龙'},
  {id:7,   name:'Squirtle',   cn:'杰尼龟'},
  {id:39,  name:'Jigglypuff', cn:'胖丁'},
  {id:52,  name:'Meowth',     cn:'喵喵'},
  {id:54,  name:'Psyduck',    cn:'可达鸭'},
  {id:133, name:'Eevee',      cn:'伊布'},
  {id:172, name:'Pichu',      cn:'皮丘'},
  {id:173, name:'Cleffa',     cn:'皮宝宝'},
  {id:16,  name:'Pidgey',     cn:'波波'},
  {id:143, name:'Snorlax',    cn:'卡比兽'}
];
function mathPet(){ return pick(MATH_PETS); }
function petKey(pet){ return 'pk'+(pet && pet.id ? pet.id : 25); }
function petGroup(n, pet, opts){
  opts=opts||{}; pet=pet||MATH_PETS[0];
  const removed=Number(opts.removed)||0;
  const tint=opts.tint||'';
  const dense = n>30 ? ' pet-dense' : (n>14 ? ' pet-mid' : '');
  let cells='';
  for(let i=0;i<n;i++){
    const gone = removed>0 && i>=n-removed;
    cells+='<span class="pet-cell'+(gone?' pet-gone':'')+'">'
      +'<img class="pet-img" src="'+pokeImg(pet.id)+'" alt="'+pet.name+'" loading="lazy">'
      +(gone?'<span class="pet-cross">✕</span>':'')
      +'</span>';
  }
  return '<div class="pet-grid '+tint+dense+'" data-pet="'+pet.id+'">'+cells+'</div>';
}
/* 一组算式对应一幅图：加法左右两组，减法一组里划掉末尾若干个 */
function petVisual(a,b,op,pet){
  if(op==='+') return petGroup(a,pet,{tint:'pet-part-a'})
    +'<div class="pet-op">+</div>'+petGroup(b,pet,{tint:'pet-part-b'});
  return petGroup(a,pet,{removed:b,tint:'pet-part-a'})
    +'<div class="pet-op pet-minus">− '+b+' ✕</div>';
}
/* 兼容旧调用：万一还有代码走老函数，也一律落到宝可梦图 */
function blocks(n,opts){ return petGroup(n,MATH_PETS[0],{removed:(opts&&opts.removed)||0}); }
function emojiGroup(n){ return petGroup(n,MATH_PETS[0]); }

/* ---------- 数学解题思路（新加坡 CPA / Number Bonds / Make-10 思维） ----------
   答对后作为 explain 展示，并由 answerSpeak 用英文朗读——和英文模块的
   「答对 → 讲思路」一致，让小朋友更快形成快捷心算思维。 */
function mathTip(op,x,y,ans){
  x=Number(x)||0; y=Number(y)||0; ans=Number(ans)||0;
  if(op==='bonds')
    return `Part-part-whole: ${x} and ${y} are the parts, ${ans} is the whole. ${x} + ${y} = ${ans}.`;
  if(op==='+'){
    if(ans<=10){
      const seq=[]; for(let n=x+1;n<=ans;n++) seq.push(n);
      if(seq.length>0 && seq.length<=5)
        return `Count on: start from ${x}, count ${y} more — ${seq.join(', ')}. ${x} + ${y} = ${ans}.`;
      return `Start from ${x} and count ${y} more. ${x} + ${y} = ${ans}.`;
    }
    const big=Math.max(x,y), need=10-big, left=ans-10;
    if(need>0 && left>=0)
      return `Make 10 first: ${big} + ${need} = 10, then 10 + ${left} = ${ans}. Quick trick!`;
    return `${x} + ${y} = ${ans}.`;
  }
  if(op==='-'){
    if(x<=10)
      return `Think addition: ${ans} and ${y} make ${x} — ${ans} + ${y} = ${x}. So ${x} − ${y} = ${ans}.`;
    const back=x-10;
    if(y>back)
      return `Back to 10 first: ${x} − ${back} = 10, then 10 − ${y-back} = ${ans}. Quick trick!`;
    return `Count back from ${x}, ${y} steps. ${x} − ${y} = ${ans}.`;
  }
  return `${x} ${op} ${y} = ${ans}.`;
}
function mathTipSpeak(t){ return {text:t, lang:'en-US'}; }

/* =========================================================
   数学 · 新加坡 MOE 大纲（全英文，20以内）
   Level 1 = N2/K1 起步 · Level 2 = K1 · Level 3 = K1/K2
   ========================================================= */
const MATH = [
  /* 汇总页（只读挂图）：ref 字段让课程列表直接打开 chart，不走「选宝可梦 → 答题」 */
  { id:'m-facts', ref:'math-facts', title:'Facts Chart', emoji:'📊',
    desc:'Number bonds · addition · subtraction within 10 (tap to hear)' },

  { id:'m-count', level:1, title:'Counting 1–10', emoji:'🔢',
    desc:'Count objects and recognise numbers (MOE N2)',
    make(){
      const out=[];
      for(let i=0;i<10;i++){
        const n=ri(1,mCap(10,6)), pet=mathPet();
        out.push({type:'choice', prompt:`How many?`, visual:petGroup(n,pet), petKey:petKey(pet),
          speak:{text:`Count the ${pet.name}. How many?`,lang:'en-US'},
          options:numOptions(n,1,mCap(10,6)), answer:String(n),
          explain:`There are ${n} ${pet.name}. Touch each one as you count: 1, 2, …, ${n}.`,
          answerSpeak:mathTipSpeak(`There are ${n} ${pet.name}. Count one by one: 1, 2, up to ${n}.`)});
      }
      return out;
    }},

  { id:'m-bonds10', level:1, title:'Number Bonds to 10', emoji:'🧩',
    desc:'Two parts make the whole: 8 + 1 = ? (MOE N2/K1)',
    make(){
      const out=[];
      for(let i=0;i<10;i++){
        const p1=ri(2,mCap(8,4)), p2=ri(2,mCap(10,6)-p1), w=p1+p2;   // 两个部分都在 2–8，整句写成 8 + 1 = ?
        const pet=mathPet();
        out.push({type:'choice', prompt:`Add the two parts`, sub:`${p1} + ${p2} = ?`,
          visual:petVisual(p1,p2,'+',pet), petKey:petKey(pet),
          speak:{text:`${p1} plus ${p2} equals what?`,lang:'en-US'},
          options:numOptions(w,2,mCap(10,6)), answer:String(w),
          explain:mathTip('bonds',p1,p2,w), answerSpeak:mathTipSpeak(mathTip('bonds',p1,p2,w))});
      }
      return out;
    }},

  { id:'m-add10', level:1, title:'Addition within 10', emoji:'➕',
    desc:'Add by combining (MOE K1)',
    make(){
      const out=[];
      for(let i=0;i<10;i++){
        let a=ri(1,mCap(9,5)), b=ri(1,mCap(9,5)-a); const ans=a+b;
        const pet=mathPet();
        out.push({type:'choice', prompt:`How many in all?`, sub:`${a} + ${b} = ?`,
          visual:petVisual(a,b,'+',pet), petKey:petKey(pet),
          speak:{text:`${a} plus ${b} equals what?`,lang:'en-US'},
          options:numOptions(ans,2,mCap(10,6)), answer:String(ans),
          explain:mathTip('+',a,b,ans), answerSpeak:mathTipSpeak(mathTip('+',a,b,ans))});
      }
      return out;
    }},

  { id:'m-bonds20', level:2, title:'Number Bonds to 20', emoji:'🧩',
    desc:'Two parts make the whole: 12 + 5 = ? (MOE K1)',
    make(){
      const out=[];
      for(let i=0;i<10;i++){
        let p1,p2,guard=0;                            // 两部分都在 2–10，合起来 11–20
        do{ p1=ri(2,mCap(10,5)); p2=ri(2,mCap(10,5)); }while(p1+p2<11 && guard++<50);
        const w=p1+p2; const pet=mathPet();
        out.push({type:'choice', prompt:`Add the two parts`, sub:`${p1} + ${p2} = ?`,
          visual:petVisual(p1,p2,'+',pet), petKey:petKey(pet),
          speak:{text:`${p1} plus ${p2} equals what?`,lang:'en-US'},
          options:numOptions(w,9,mCap(20,8)), answer:String(w),
          explain:mathTip('+',p1,p2,w), answerSpeak:mathTipSpeak(mathTip('+',p1,p2,w))});
      }
      return out;
    }},

  { id:'m-add20', level:2, title:'Addition within 20 (Make 10)', emoji:'🚀',
    desc:'Make-10 strategy (MOE K1)',
    make(){
      const out=[];
      for(let i=0;i<10;i++){
        const a=ri(8,9), b=ri(11-a,9);          // 保证 a+b>10 且 ≤18，Make-10 才成立
        const ans=a+b, need=10-a, left=b-need, pet=mathPet();
        out.push({type:'choice', prompt:`Add with Make-10 thinking`, sub:`${a} + ${b} = ?`,
          visual:petVisual(a,b,'+',pet), petKey:petKey(pet),
          speak:{text:`${a} plus ${b} equals what?`,lang:'en-US'},
          options:numOptions(ans,11,18), answer:String(ans),
          explain:mathTip('+',a,b,ans), answerSpeak:mathTipSpeak(mathTip('+',a,b,ans))});
      }
      return out;
    }},

  { id:'m-sub10', level:2, title:'Subtraction within 10', emoji:'➖',
    desc:'Take away and find the rest (MOE K1)',
    make(){
      const out=[];
      for(let i=0;i<10;i++){
        const a=ri(2,mCap(10,6)), b=ri(1,a-1); const ans=a-b, pet=mathPet();
        out.push({type:'choice', prompt:`How many are left?`, sub:`${a} − ${b} = ?`,
          visual:petVisual(a,b,'-',pet), petKey:petKey(pet),
          speak:{text:`${a} minus ${b} equals what?`,lang:'en-US'},
          options:numOptions(ans,0,mCap(9,6)), answer:String(ans),
          explain:mathTip('-',a,b,ans), answerSpeak:mathTipSpeak(mathTip('-',a,b,ans))});
      }
      return out;
    }},

  { id:'m-sub20', level:3, title:'Subtraction within 20', emoji:'➖',
    desc:'Subtract within 20 (MOE K1/K2)',
    make(){
      const out=[];
      for(let i=0;i<10;i++){
        const a=ri(11,mCap(20,8)), b=ri(1,Math.min(9,a-2)); const ans=a-b, pet=mathPet();
        out.push({type:'choice', prompt:`How many are left?`, sub:`${a} − ${b} = ?`,
          visual:petVisual(a,b,'-',pet), petKey:petKey(pet),
          speak:{text:`${a} minus ${b} equals what?`,lang:'en-US'},
          options:numOptions(ans,1,mCap(19,8)), answer:String(ans),
          explain:mathTip('-',a,b,ans), answerSpeak:mathTipSpeak(mathTip('-',a,b,ans))});
      }
      return out;
    }},

  { id:'m-word', level:3, title:'Math Word Problems', emoji:'📖',
    desc:'Read a story and work out the answer (MOE K1/K2)',
    make(){
      /* 一套题 = 8 个故事。为避免「同一套题里出现重复题目」：
         1) 8 个角色/物品互不相同（shuffle 后取 8 个）
         2) 加、减各 4 个句式，句式也互不相同
         3) 角色 × 句式 一一配对 → 8 道题的题干必然两两不同 */
      /* 12 个小朋友各配一只宝可梦：题干用宝可梦名字，配图用同一只精灵。
         宝可梦名称复数不加 s（官方用法），所以 v 直接用名字。 */
      const NAMES=['Sam','Lily','Tom','May','Ben','Ann','Ken','Zoe','Mia','Tim','Ella','Leo'];
      const CAST=NAMES.map((n,i)=>({n, pet:MATH_PETS[i], v:MATH_PETS[i].name}));
      const ADD=[
        t=>`${t.n} has ${t.a} ${t.pet.name}. ${t.n} gets ${t.b} more. How many ${t.v} now?`,
        t=>`${t.n} has ${t.a} ${t.pet.name}. Grandma gives ${t.b} more. How many ${t.v} does ${t.n} have?`,
        t=>`${t.n} finds ${t.b} ${t.pet.name}. ${t.n} already has ${t.a} ${t.pet.name}. How many ${t.v} in all?`,
        t=>`${t.n} has ${t.a} ${t.pet.name}. ${t.n} buys ${t.b} more. How many ${t.v} in all?`,
        t=>`There are ${t.a} ${t.pet.name} on the table. Mom puts ${t.b} more there. How many ${t.v} on the table?`,
        t=>`${t.n} has ${t.a} ${t.pet.name} in a box. ${t.n} puts ${t.b} more in. How many ${t.v} in the box?`,
      ];
      const SUB=[
        t=>`${t.n} has ${t.a} ${t.pet.name}. ${t.n} gives ${t.b} away. How many ${t.v} left?`,
        t=>`${t.n} has ${t.a} ${t.pet.name}. ${t.n} takes ${t.b} out. How many ${t.v} left?`,
        t=>`${t.n} has ${t.a} ${t.pet.name} on the table. ${t.b} of them fall down. How many ${t.v} are still on the table?`,
        t=>`${t.n} has ${t.a} ${t.pet.name}. ${t.n} gives ${t.b} to a friend. How many ${t.v} left?`,
        t=>`${t.n} has ${t.a} ${t.pet.name} in a bag. ${t.b} of them are lost. How many ${t.v} are in the bag?`,
        t=>`${t.n} has ${t.a} ${t.pet.name}. Mom takes ${t.b} away. How many ${t.v} left?`,
      ];
      const people = shuffle(CAST).slice(0,10);
      const kinds  = shuffle([
        ...shuffle(ADD).slice(0,5).map(f=>({op:'+',f})),
        ...shuffle(SUB).slice(0,5).map(f=>({op:'-',f}))
      ]);
      return kinds.map((k,i)=>{
        const p=people[i]; let a,b;
        if(k.op==='+'){ a=ri(2,mCap(9,5)); b=ri(1,Math.min(8,mCap(18,8)-a)); }
        else          { a=ri(5,mCap(18,8)); b=ri(1,Math.min(5,a-2)); }
        const ans = k.op==='+' ? a+b : a-b;
        const q   = k.f({n:p.n,pet:p.pet,v:p.v,a,b});
        return {type:'choice', prompt:`Read the story`, sub:q,
          visual:petVisual(a,b,k.op,p.pet), petKey:petKey(p.pet),
          speak:{text:q,lang:'en-US'},
          options:numOptions(ans,Math.max(0,ans-3),ans+3), answer:String(ans),
          explain:mathTip(k.op,a,b,ans), answerSpeak:mathTipSpeak(mathTip(k.op,a,b,ans))};
      });
    }},

  { id:'m-mixed', level:3, title:'Mixed Practice', emoji:'🎯',
    desc:'Mix of add and subtract within 20',
    make(){
      const out=[];
      for(let i=0;i<10;i++){
        const op=Math.random()<0.5?'+':'-'; let a,b,ans;
        if(op==='+'){ a=ri(1,mCap(15,6)); b=ri(1,Math.min(mCap(20,8)-a,15)); ans=a+b; }
        else { a=ri(6,mCap(20,8)); b=ri(1,a-1); ans=a-b; }
        const pet=mathPet();
        out.push({type:'choice', prompt:`Solve it`, sub:`${a} ${op} ${b} = ?`,
          visual:petVisual(a,b,op,pet), petKey:petKey(pet),
          speak:{text:`${a} ${op==='+'?'plus':'minus'} ${b} equals what?`,lang:'en-US'},
          options:numOptions(ans,Math.max(0,ans-3),ans+3), answer:String(ans),
          explain:mathTip(op,a,b,ans), answerSpeak:mathTipSpeak(mathTip(op,a,b,ans))});
      }
      return out;
    }},
];

/* =========================================================
   英文 · 全英文（阅读 / 拼写 / 写作 / 分级读物）
   ========================================================= */
const SIGHT=['the','a','I','you','he','she','we','to','and','is','it','in','on','at','can','see','look','go','big','red','blue','cat','dog','sun','run','hot','cup','book','ball','tree'];
/* v65：Sight Words 选项「英文 + 中文」释义表。仅用于显示层，答案/判题/语音仍用英文原词。
   键统一小写；覆盖 SIGHT/CVC/WORDS_L1-L3 全部可能成为 sight 选项的单词，
   这样每个选项都带中文，孩子不会靠「谁有中文」猜出答案。 */
const EN_ZH={
  /* SIGHT */
  the:'这个', a:'一个', i:'我', you:'你', he:'他', she:'她', we:'我们', to:'到/向',
  and:'和', is:'是', it:'它', in:'在…里', on:'在…上', at:'在', can:'能/会', see:'看见',
  look:'看', go:'去', big:'大的', red:'红色的', blue:'蓝色的', cat:'猫', dog:'狗',
  sun:'太阳', run:'跑', hot:'热的', cup:'杯子', book:'书', ball:'球', tree:'树',
  /* CVC 补充 */
  pig:'猪', hat:'帽子', bug:'虫子', pen:'钢笔', top:'顶部', map:'地图', fox:'狐狸',
  bus:'公共汽车', box:'盒子', leg:'腿', sit:'坐',
  /* WORDS_L1 补充 */
  my:'我的', up:'向上', me:'我', has:'有', like:'喜欢', play:'玩', fun:'有趣的',
  bag:'书包', bed:'床', mom:'妈妈', dad:'爸爸',
  /* WORDS_L2 补充 */
  fish:'鱼', bird:'鸟', cake:'蛋糕', milk:'牛奶', rain:'雨', park:'公园', ship:'轮船',
  shop:'商店', duck:'鸭子', frog:'青蛙', jump:'跳', help:'帮助', read:'读', sing:'唱歌',
  walk:'走路', green:'绿色的', yellow:'黄色的', small:'小的', happy:'开心的', water:'水',
  table:'桌子', chair:'椅子', house:'房子', school:'学校', friend:'朋友', apple:'苹果',
  orange:'橙子',
  /* WORDS_L3 补充 */
  garden:'花园', market:'市场', birthday:'生日', rainbow:'彩虹', library:'图书馆',
  umbrella:'雨伞', morning:'早晨', evening:'傍晚', together:'一起', because:'因为',
  favorite:'最喜欢的', picture:'图画', purple:'紫色的', animal:'动物', bicycle:'自行车',
  teacher:'老师', playground:'操场', delicious:'美味的', exciting:'令人兴奋的',
  yesterday:'昨天', tomorrow:'明天'
};
/* 阅读理解题库在 js/read-passages.js（独立文件，每周自动上新） */
const CVC=['cat','dog','sun','pig','cup','hat','bug','pen','top','map','fox','bus','red','box','leg','sit','hot','run'];
const PHON=[
  {w:'cat',e:'🐱',a:'c'},{w:'dog',e:'🐶',a:'d'},{w:'sun',e:'☀️',a:'s'},
  {w:'pig',e:'🐷',a:'p'},{w:'bug',e:'🐛',a:'b'},{w:'top',e:'🔝',a:'t'},
  {w:'hat',e:'🎩',a:'h'},{w:'fan',e:'🌀',a:'f'},{w:'leg',e:'🦵',a:'l'},
  {w:'rat',e:'🐀',a:'r'},{w:'map',e:'🗺️',a:'m'},{w:'net',e:'🕸️',a:'n'},
];
const BUILD=[
  {tiles:['I','see','a','dog','.'],a:'I see a dog .'},
  {tiles:['The','cat','is','red','.'],a:'The cat is red .'},
  {tiles:['We','go','to','school','.'],a:'We go to school .'},
  {tiles:['I','like','my','book','.'],a:'I like my book .'},
  {tiles:['The','sun','is','hot','.'],a:'The sun is hot .'},
  {tiles:['The','dog','can','run','.'],a:'The dog can run .'},
  {tiles:['Look','at','the','sun','.'],a:'Look at the sun .'},
  {tiles:['She','has','a','ball','.'],a:'She has a ball .'},
  {tiles:['We','are','happy','.'],a:'We are happy .'},
  {tiles:['I','can','see','a','bird','.'],a:'I can see a bird .'},
];

/* 语法：常见结构，每题一个知识点，答对后播报完整句子 */
const GRAMMAR_ITEMS=[
  {s:'I see ___ apple.',            o:['a','an'],        a:'an',   why:'Use "an" before a vowel sound: an apple.'},
  {s:'The cats ___ sleeping.',      o:['is','are'],      a:'are',  why:'"Cats" is plural, so we use "are".'},
  {s:'One cat, two ___.',           o:['cat','cats'],    a:'cats', why:'Add -s when there is more than one: two cats.'},
  {s:'The ball is ___ the box.',    o:['in','on'],       a:'in',   why:'Use "in" when something is inside the box.'},
  {s:'Tom is a boy. ___ is happy.', o:['He','She'],      a:'He',   why:'Use "He" for a boy and "She" for a girl.'},
  {s:'She ___ reading a book.',     o:['is','are'],      a:'is',   why:'"She" is one person, so we use "is".'},
  {s:'He ___ to school every day.', o:['go','goes'],     a:'goes', why:'With he, she or it we add -es: he goes.'},
  {s:'___ is your name?',           o:['What','Who'],    a:'What', why:'We ask a name with "What is your name?"'},
  {s:'The dog ___ a tail.',         o:['has','have'],    a:'has',  why:'One dog is singular, so we use "has".'},
  {s:'I ___ a pencil.',             o:['has','have'],    a:'have', why:'Use "have" with I, you, we and they.'},
];

/* 分级读物（原创可解码读物，按 Level 分级；每本 10 道理解题，凑满一套 10 题） */
const READERS=[
  { id:'r-samcat', level:1, title:'Sam and the Cat', emoji:'🐱',
    desc:'Level 1 · short decodable sentences',
    passage:`Sam has a cat. The cat is red. Sam can pat the cat. The cat is fun!`,
    visual:'🐱🔴',
    qa:[
      {q:'What pet does Sam have?',o:['a cat','a dog','a sun'],a:'a cat'},
      {q:'Is the cat red?',o:['Yes','No'],a:'Yes'},
      {q:'Is the cat blue?',o:['Yes','No'],a:'No'},
      {q:'Who has a cat?',o:['Sam','Ben','Tom'],a:'Sam'},
      {q:'What does Sam do?',o:['pats the cat','eats the cat','walks the cat'],a:'pats the cat'},
      {q:'Is the cat fun?',o:['Yes','No'],a:'Yes'},
      {q:'What color is the cat?',o:['red','blue','green'],a:'red'},
      {q:'Can Sam pat the cat?',o:['Yes','No'],a:'Yes'},
      {q:'Does Sam have a dog?',o:['Yes','No'],a:'No'},
      {q:'The cat is ___.',short:true,a:'fun',accept:['fun'],hint:'f _ _'}
    ] },
  { id:'r-sun', level:1, title:'The Big Sun', emoji:'☀️',
    desc:'Level 1 · sight words + CVC',
    passage:`The sun is hot. The sun is big. We like the sun. The sun is up.`,
    visual:'☀️',
    qa:[
      {q:'Is the sun hot?',o:['Yes','No'],a:'Yes'},
      {q:'Is the sun small?',o:['Yes','No'],a:'No'},
      {q:'Is the sun big?',o:['Yes','No'],a:'Yes'},
      {q:'Do we like the sun?',o:['Yes','No'],a:'Yes'},
      {q:'What do we like?',o:['the sun','the rain','the cat'],a:'the sun'},
      {q:'Is the sun cold?',o:['Yes','No'],a:'No'},
      {q:'Where is the sun?',o:['up','down','in a box'],a:'up'},
      {q:'The sun is hot and ___.',o:['big','small','sad'],a:'big'},
      {q:'Is the sun up?',o:['Yes','No'],a:'Yes'},
      {q:'We like the ___.',short:true,a:'sun',accept:['sun'],hint:'s _ _'}
    ] },
  { id:'r-dog', level:2, title:"Ben's Dog", emoji:'🐶',
    desc:'Level 2 · simple story',
    passage:`Ben has a big dog. The dog can run. The dog can jump. Ben likes his dog.`,
    visual:'🐶',
    qa:[
      {q:'What does Ben have?',o:['a dog','a cat','a sun'],a:'a dog'},
      {q:'Can the dog jump?',o:['Yes','No'],a:'Yes'},
      {q:'Who has a dog?',o:['Ben','Sam','Tom'],a:'Ben'},
      {q:'Is the dog big?',o:['Yes','No'],a:'Yes'},
      {q:'What can the dog do?',o:['run and jump','fly','swim'],a:'run and jump'},
      {q:'Does Ben like his dog?',o:['Yes','No'],a:'Yes'},
      {q:'Is the dog small?',o:['Yes','No'],a:'No'},
      {q:'Who likes the dog?',o:['Ben','Tom','The cat'],a:'Ben'},
      {q:'Can the dog run?',o:['Yes','No'],a:'Yes'},
      {q:'Ben has a big ___.',short:true,a:'dog',accept:['dog'],hint:'d _ _'}
    ] },
  { id:'r-rain', level:2, title:'A Rainy Day', emoji:'🌧️',
    desc:'Level 2 · everyday words',
    passage:`It is raining. Mom has an umbrella. We sit and read a book. We are happy.`,
    visual:'🌧️☂️📖',
    qa:[
      {q:'What does Mom have?',o:['an umbrella','a dog','a ball'],a:'an umbrella'},
      {q:'Is it raining?',o:['Yes','No'],a:'Yes'},
      {q:'Is it sunny?',o:['Yes','No'],a:'No'},
      {q:'Who has an umbrella?',o:['Mom','Ben','Sam'],a:'Mom'},
      {q:'What do we do?',o:['sit and read','run and jump','swim'],a:'sit and read'},
      {q:'What do we read?',o:['a book','a ball','a cat'],a:'a book'},
      {q:'Are we sad?',o:['Yes','No'],a:'No'},
      {q:'Are we happy?',o:['Yes','No'],a:'Yes'},
      {q:'What is the weather?',o:['raining','snowing','sunny'],a:'raining'},
      {q:'We read a ___.',short:true,a:'book',accept:['book'],hint:'b _ _ _'}
    ] },
  { id:'r-park', level:3, title:'At the Park', emoji:'🏞️',
    desc:'Level 3 · short paragraph',
    passage:`We go to the park. I see a red ball. Tom can kick the ball. We are happy at the park.`,
    visual:'🏞️🔴⚽',
    qa:[
      {q:'Where do we go?',o:['the park','the school','the home'],a:'the park'},
      {q:'What color is the ball?',o:['red','blue','green'],a:'red'},
      {q:'Who can kick the ball?',o:['Tom','Ben','Mom'],a:'Tom'},
      {q:'Is the ball blue?',o:['Yes','No'],a:'No'},
      {q:'What do I see?',o:['a red ball','a cat','a big sun'],a:'a red ball'},
      {q:'Are we happy?',o:['Yes','No'],a:'Yes'},
      {q:'Where are we happy?',o:['at the park','at school','in the rain'],a:'at the park'},
      {q:'Can Tom kick the ball?',o:['Yes','No'],a:'Yes'},
      {q:'Do we go to the park?',o:['Yes','No'],a:'Yes'},
      {q:'I see a ___ ball.',short:true,a:'red',accept:['red'],hint:'r _ _'}
    ] },
];

const ENGLISH=[
  /* 汇总页：全部 45 个美式音素（21 元音 + 24 辅音）+ 字母 A–Z（点读音素本身） */
  { id:'e-ipa', ref:'ipa-chart', title:'Sound Chart', emoji:'🎵',
    desc:'All 45 American phonemes — 21 vowels & 24 consonants · tap any sound to hear it' },

  { id:'e-sight', title:'Sight Words', emoji:'👀',
    desc:'See a word and read it (listen & choose)',
    make(){
      const out=[];
      for(let i=0;i<10;i++){
        const w=pick(SIGHT);
        const opts=shuffle([w,...shuffle(SIGHT.filter(x=>x!==w)).slice(0,2)]);
        out.push({type:'choice', prompt:`Listen, then tap the word 👂`,
          sub:`(Tap 🔊 and choose the word you hear)`,
          speak:{text:w,lang:'en-US'}, options:shuffle(opts), answer:w, explain:`The word is "${w}".`});
      }
      return out;
    }},

  { id:'e-spell', title:'Spelling (Listen & Type)', emoji:'✍️',
    desc:'Hear the word and spell it',
    make(){
      const out=[];
      shuffle(CVC).slice(0,10).forEach(w=>{
        out.push({type:'type', prompt:`Listen and spell the word 🔊`,
          sub:`(Tap 🔊, then spell with the keyboard)`, speak:{text:w,lang:'en-US'},
          answer:w, explain:`Spell: ${w.split('').join('-')}.`});
      });
      return out;
    }},

  /* 阅读理解：2 篇短文 × (读 + 3 选择 + 1 短答) = 10 步，放在拼写之后 */
  { id:'e-read', title:'Reading & Understanding', emoji:'📚',
    desc:'Read a story, then answer questions · new stories every week',
    make(limit, opts){ return readSet(limit || 10, opts); }},

  { id:'e-build', title:'Sentence Building (Writing)', emoji:'🧱',
    desc:'Tap words in order to make a sentence',
    make(){
      const out=[];
      shuffle(BUILD).slice(0,10).forEach(b=>{
        out.push({type:'build', prompt:`Tap the words in order to build a sentence`,
          sub:`Put the words in the right order`, tiles:shuffle(b.tiles), answer:b.a,
          /* 句子建构题进题必读（不依赖「自动朗读」开关），答对后在 bindBuild 里再读完整句 */
          speak:{text:b.a.replace(/ \./g,'.'),lang:'en-US',forceAuto:true}});
      });
      return out;
    }},

  /* 语法：a/an、单复数、be 动词、介词、代词、三单，各一题 */
  { id:'e-grammar', title:'Grammar Basics', emoji:'🔧',
    desc:'Pick the word that fits: a/an, is/are, plurals, in/on',
    make(){
      return GRAMMAR_ITEMS.map(g=>{
        const full=g.s.replace('___',g.a);
        return {type:'choice', prompt:`Choose the correct word`,
          sub:`<span class="gram-sent">${g.s.replace('___','<b>___</b>')}</span>`,
          speak:{text:g.s.replace('___','blank'),lang:'en-US',forceAuto:true},
          answerSpeak:{text:full,lang:'en-US'},
          options:shuffle(g.o), answer:g.a,
          explain:`${full} — ${g.why}`};
      });
    }},


  { id:'e-phonics', title:'Phonics Review', emoji:'🔡',
    desc:'Listen and find the letter sound',
    make(n,opts){
      if(typeof PHONIC!=='undefined')
        return PHONIC.make(n||10, (opts&&opts.level)||1, (opts&&opts.spread)||0);
      /* 兜底：PHONIC 未加载时仍给「发音辨析」而非旧的首字母题 */
      const out=[];
      shuffle(PHON).slice(0,10).forEach(p=>{
        out.push({type:'choice', prompt:`Which letter starts this word?`,
          visual:`<div class="q-visual">${p.e}</div>`, sub:`"${p.w}" — what is the first letter?`,
          speak:{text:p.w,lang:'en-US'}, options:shuffle([p.a,...shuffle('bcdfghjklmnprst'.split('').filter(x=>x!==p.a)).slice(0,2)]), answer:p.a, explain:`"${p.w}" starts with "${p.a}".`});
      });
      return out;
    }},

  /* 分级读物不再单列课程卡片：5 篇全部归入 Reading & Understanding (e-read)。
     它们在 read-passages.js 里以 rp-reader-* 注册进同一套阅读题库，
     统一走读题去重（答对过的 qid 永不再出现），避免"每个类型下又冒出 5 篇"。 */
];

/* =========================================================
   中文 · 汉语拼音 + 汉字复习（内容保留中文）
   ========================================================= */
/* 拼音表统一由 js/zh-phonics.js 提供（含呼读音汉字、四声题库与识别白名单） */
const INITIALS=ZH_INITIALS.map(x=>x.p);
const FINALS=ZH_FINALS.map(x=>x.p);
const WHOLES=ZH_WHOLES.map(x=>x.p);
const CHARS=[
  {c:'水',p:'shuǐ'},{c:'火',p:'huǒ'},{c:'山',p:'shān'},{c:'木',p:'mù'},
  {c:'日',p:'rì'},{c:'月',p:'yuè'},{c:'人',p:'rén'},{c:'口',p:'kǒu'},
  {c:'手',p:'shǒu'},{c:'足',p:'zú'},{c:'目',p:'mù'},{c:'耳',p:'ěr'},
  {c:'田',p:'tián'},{c:'土',p:'tǔ'},{c:'上',p:'shàng'},{c:'下',p:'xià'},
  {c:'大',p:'dà'},{c:'小',p:'xiǎo'},{c:'中',p:'zhōng'},{c:'国',p:'guó'},
  {c:'我',p:'wǒ'},{c:'你',p:'nǐ'},{c:'妈',p:'mā'},{c:'爸',p:'bà'},
];

const CHINESE=[
  /* 汇总页：声母 / 韵母 / 整体认读音节 / 四声调 一页看全（点读音） */
  { id:'c-map', ref:'zh-map', title:'拼音全景 Pinyin Map', emoji:'🗺️',
    desc:'声母 · 韵母 · 整体认读音节 · 四声，点一下听读音' },

  { id:'c-tone', title:'Tone Practice 声调练习', emoji:'🔊',
    desc:'听声音辨声调：一声平、二声扬、三声拐、四声降',
    make(){
      const names=['第一声','第二声','第三声','第四声'];
      const marks=['—','↗','∨','↘'];   // 平 / 扬 / 拐 / 降，图形化更好认
      const combos=[];
      // 先保证四个声调各出一题，再补足 8 题，避免整节课只考一种调
      [1,2,3,4,1,2,3,4,1,2].forEach(t=>combos.push({g:pick(ZH_TONES), t}));
      let guard=0;
      while(combos.length<10 && guard++<300){
        const g=pick(ZH_TONES), t=ri(1,4);
        if(!combos.some(x=>x.g.base===g.base && x.t===t)) combos.push({g,t});
      }
      return shuffle(combos).map(({g,t})=>{
        const hz=g.hz[t-1], py=g.py[t-1];
        return {
          type:'choice', tone:true,
          prompt:'🔊 听一听，这是第几声？',
          sub:`<span class="tone-base">${g.base}</span>
               <div class="tone-tip">点 🔊 可以再听一次 · 一声平、二声扬、三声拐弯、四声降</div>`,
          speak:{ text:hz, lang:'zh-CN', clip:zhToneClip(g.base,t), autoplay:true },
          options:names, optionMarks:marks, answer:names[t-1],
          explain:`「${hz}」${py} 是${['第一','第二','第三','第四'][t-1]}声，例如「${g.word[t-1]}」。`
        };
      });
    }},

  /* 认读课默认「听音选一选」：只播示范音，不显示答案拼音；
   * canSpeak/kind/target/hint 保留，供题目下方「🎤 我来读」切换到跟读模式。 */
  { id:'c-initial', title:'Initials 声母认读', emoji:'🎧',
    desc:'听示范音 → 选声母（也可点「我来读」跟读）',
    make(){
      return shuffle(ZH_INITIALS).slice(0,10).map(t=>({
        type:'choice', canSpeak:true, kind:'initial', target:t.p,
        prompt:'🔊 听一听，选出这个声母',
        sub:'点 🔊 可以再听一次，然后选出正确的拼音',
        speak:{ text:t.hz, lang:'zh-CN', clip:zhClip('initial',t.p), autoplay:true },
        options:shuffle([t.p,...shuffle(INITIALS.filter(x=>x!==t.p)).slice(0,2)]),
        answer:t.p,
        hint:'先点 🔊 听一听，再对着 🎤 大声读出来',
        explain:`声母 ${t.p} 读作「${t.hz}」，要读得又轻又短。`
      }));
    }},

  { id:'c-final', title:'Finals 韵母认读', emoji:'🎧',
    desc:'听示范音 → 选韵母（也可点「我来读」跟读）',
    make(){
      return shuffle(ZH_FINALS).slice(0,10).map(t=>({
        type:'choice', canSpeak:true, kind:'final', target:t.p,
        prompt:'🔊 听一听，选出这个韵母',
        sub:'点 🔊 可以再听一次，然后选出正确的拼音',
        speak:{ text:t.hz, lang:'zh-CN', clip:zhClip('final',t.p), autoplay:true },
        options:shuffle([t.p,...shuffle(FINALS.filter(x=>x!==t.p)).slice(0,2)]),
        answer:t.p,
        hint:'先点 🔊 听一听，再对着 🎤 大声读出来',
        explain:`韵母 ${t.p} 读作「${t.hz}」，要读得响亮。`
      }));
    }},

  { id:'c-whole', title:'Whole Syllables 整体认读音节', emoji:'🔤',
    desc:'16 个「不用拼、直接读」的音节（听音选一选，也可点「我来读」）',
    make(){
      return shuffle(ZH_WHOLES).slice(0,10).map(t=>({
        type:'choice', canSpeak:true, kind:'whole', target:t.p,
        prompt:'🔊 听一听，选出这个整体认读音节',
        sub:'整体认读音节不用拼，看到就能直接读出来',
        speak:{ text:t.hz, lang:'zh-CN', clip:zhClip('whole',t.p), autoplay:true },
        options:shuffle([t.p,...shuffle(WHOLES.filter(x=>x!==t.p)).slice(0,2)]),
        answer:t.p,
        hint:'先点 🔊 听一听，再对着 🎤 大声读出来',
        explain:`${t.p} 是整体认读音节，直接读作「${t.hz}」，例如「${t.word}」。`
      }));
    }},

  { id:'c-blend', title:'Blending 拼读练习', emoji:'🧩',
    desc:'四步拼读法：韵母 → 带调韵母 → 声母拉长音+带调韵母拼读 → 完整音节',
    make(){
      /* 家长真人录制题库：只出「家长已录制」的题，播放真人连读整段。
         家长还没录任何题时，回退到原来的预录合成音，保证课程不会白屏。
         ParentBlendBank 加载完成(ready)且至少录了 1 题 → 进入家长题库模式。 */
      const pb = (typeof ParentBlendBank!=='undefined') ? ParentBlendBank : null;
      const parentMode = pb && pb.ready && pb.count()>0;
      const pool = parentMode
        ? ZH_BLENDS.filter(it=>pb.has(it.syl))
        : ZH_BLENDS;
      return shuffle(pool).slice(0,10).map(it=>{
        const finT = zhToneMark(it.fin, it.tone);   // 韵母带调号，拼读时看得清是第几声
        const sylT = zhToneMark(it.syl, it.tone);   // 拼出来的音节同样带调号
        const tName = zhToneName(it.tone);
        /* 家长已录制的题：整段真人 4 步连读，一个 clip 读完，音色/连读都达标。 */
        if(parentMode && pb.has(it.syl)){
          return {
            type:'choice', prompt:`拼一拼：${it.ini} + ${finT} = ?`,
            sub: `🔊 听真人老师拼读：韵母 ${it.fin} → 带调韵母 ${finT}（${tName}）→ ${it.ini}~${finT} 连读 → 完整读 ${sylT}`,
            speak:{ lang:'zh-CN', autoplay:true, clip:pb.url(it.syl) },
            options:shuffle([sylT,...zhBlendDecoysToned(it)]), answer:sylT,
            explain:`${it.ini} + ${finT} = ${sylT}（${tName}）。例如「${it.word}」的「${it.hz}」。`
          };
        }
        /* 轻声（tone=0）不标调，也就没有「加声调」这一步；轻声仍走三段。 */
        const soft = !(it.tone>=1 && it.tone<=4);
        /* 四步拼读法（Eric 2026-11-17 按视频最终定稿）：
           ① 韵母 → ② 带调韵母 → ③ 声母拉长音+带调韵母一起拼读 → ④ 完整音节。
           第 ③ 步不再单独干读声母，拉长音就含在拼读过渡音里。
           hang 用 Eric 提供的真人视频原声（realhang_*，无合成蜂鸣）；其余题用预录合成音。 */
        const real = it.syl === 'hang';
        const R = n => 'audio/zh/realhang_'+n+'.m4a?a=12';
        const seq = soft ? [
          {clip:zhClip('final',it.fin),   text:it.fin, gap:420},
          {clip:zhClip('initial',it.ini), text:it.ini, gap:420},
          {clip:zhClip('syl',it.syl),     text:sylT}
        ] : real ? [
          {clip:R('1ang'),    text:it.fin, gap:420},
          {clip:R('2ang2'),   text:finT, gap:420},
          {clip:R('4hblend'), text:sylT, gap:150},
          {clip:R('5hang'),   text:sylT}
        ] : [
          {clip:zhClip('final',it.fin),   text:it.fin, gap:420},
          {clip:zhToneFinClip(it.fin,it.tone), text:finT, gap:420},
          {clip:zhPyClip(it.syl),         text:sylT, gap:300},
          {clip:zhClip('syl',it.syl),     text:sylT}
        ];
        return {
          type:'choice', prompt:`拼一拼：${it.ini} + ${finT} = ?`,
          sub: soft
            ? `🔊 听顺序：韵母 ${it.fin} → 声母 ${it.ini} → 拼出来 ${sylT}（${tName}，不标调）`
            : `🔊 听顺序：韵母 ${it.fin} → 带调韵母 ${finT}（${tName}）→ ${it.ini}~${finT} 拼读 → 完整读 ${sylT}`,
          speak:{ lang:'zh-CN', autoplay:true, seq },
          options:shuffle([sylT,...zhBlendDecoysToned(it)]), answer:sylT,
          explain:`${it.ini} + ${finT} = ${sylT}（${tName}）。例如「${it.word}」的「${it.hz}」。`
        };
      });
    }},

  { id:'c-char', title:'Characters 汉字拼音配对', emoji:'🇨🇳',
    desc:'给认识的汉字找正确的拼音',
    make(){
      const out=[];
      shuffle(CHARS.map((c,i)=>Object.assign({},c,{i}))).slice(0,10).forEach(ch=>{
        const decoys=shuffle(CHARS.filter(x=>x.c!==ch.c)).slice(0,2).map(x=>x.p);
        out.push({type:'choice', prompt:`这个字的拼音是？`,
          sub:`<span style="font-size:54px;font-weight:800">${ch.c}</span>`,
          speak:{text:ch.c,lang:'zh-CN',clip:zhClip('char',ch.i)},
          options:shuffle([ch.p,...decoys]), answer:ch.p,
          explain:`${ch.c} 读 ${ch.p}。`});
      });
      return out;
    }},
];

/* ---------------- 汇总 ---------------- */
const CURRICULUM = {
  math:    { key:'math',    label:'Math',    lessons:MATH },
  english: { key:'english', label:'English', lessons:ENGLISH },
  chinese: { key:'chinese', label:'中文 Chinese', lessons:CHINESE },
};

/* 难度阶梯标签（MOE 参考） */
const LEVEL_LABEL = { 1:'Level 1 · N2/K1', 2:'Level 2 · K1', 3:'Level 3 · K1/K2' };
