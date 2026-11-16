/* =========================================================
   PokeLearn · 统一题库 v1（v30）
   ---------------------------------------------------------
   目标：每一节课都有一份「确定性、可枚举、≥200 道不重复题」的题库。
   - 确定性：同一道题每次生成的 qid 完全相同（不依赖 Math.random），
     这样 QEngine 才能用 qSeen 精确过滤「已经答过的题」。
   - 自动扩容：spread 每 +1，参数空间继续放大（数字更大 / 词形更多 /
     句型更长 / 音节问法更多），永远能造出没出现过的新题。
   - 难度渐进：每道题带 tier 1–5，数字范围、词长、句子长度随 tier 上升。
   ---------------------------------------------------------
   加载顺序：js/data.js 之后、js/question-engine.js 之前。
   ========================================================= */
(function(global){
'use strict';

/* ---------------- 确定性工具 ---------------- */
function h32(s){
  let h=0x811c9dc5;
  s=String(s||'');
  for(let i=0;i<s.length;i++){ h ^= s.charCodeAt(i); h=(h*0x01000193)>>>0; }
  return h.toString(36);
}
function hn(s){ return parseInt(h32(s),36)||0; }
function uniq(a){ return Array.from(new Set(a)); }
function rot(a,i){ return a[((i%a.length)+a.length)%a.length]; }
function shuffle(a){
  a=a.slice();
  for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; }
  return a;
}
/* 确定性干扰项：同一 seed 永远给出同一组选项 */
function detOpts(ans,pool,seed){
  const others=uniq(pool.filter(x=>String(x)!==String(ans)));
  if(!others.length) return [String(ans)];
  const i=hn(seed)%others.length;
  const out=[];
  [String(ans),String(others[i]),String(others[(i+3)%others.length]),
   String(others[(i+7)%others.length])].forEach(x=>{ if(out.indexOf(x)<0) out.push(x); });
  return shuffle(out.slice(0,3));
}
function tag(q,qid,tier){
  q.qid=qid; q.tier=tier||1;
  if(q.type==='build' && q.speak) q.speak.forceAuto=true;   // 句子建构题：进题必读
  return q;
}
function numOptionsLocal(ans,min,max){
  const s=new Set([String(ans)]); let g=0;
  while(s.size<4 && g++<80){
    const d=Number(ans)+Math.floor(Math.random()*9)-4;
    if(d>=min && d<=max) s.add(String(d));
  }
  for(let k=1;k<=20&&s.size<4;k++){
    s.add(String(Number(ans)-k)); if(s.size<4) s.add(String(Number(ans)+k));
  }
  let v=Number(ans)+1;
  while(s.size<4){ s.add(String(v)); v++; }   // v 严格递增，必定收敛
  return shuffle(Array.from(s));
}

/* =========================================================
   英文词库：230+ 个常用儿童词，按词长自动分 5 个难度档
   ========================================================= */
const WORDS = uniq(`
cat dog sun pig cup hat bug pen top map fox bus red box leg sit hot run big
ball book fish bird cake milk rain tree ship shop duck frog jump help read sing walk
blue green small happy water apple table chair house school friend orange yellow
purple animal bicycle teacher garden market rainbow library umbrella morning evening
picture birthday because together favorite delicious exciting yesterday tomorrow
playground computer elephant dinosaur butterfly sandwich breakfast bedroom football
sunshine painting counting writing reading singing dancing swimming running
adventure calendar chocolate classroom community different discover exercise family
festival geography grandmother helicopter important interesting kangaroo keyboard
language mountain newspaper octopus penguin question remember restaurant science
telescope vegetable waterfall xylophone zebra astronaut basketball brilliant
carnival dolphin envelope fountain galaxy harmony island jellyfish kitchen ladder
magnet needle ocean pencil quarter spaceship triangle universe village window young
zoo balloon camera carrot circle doctor farmer feather flower forest guitar honey
igloo jungle kitten lemon moonlight noodle palace rabbit silver tiger violet
winter watermelon electricity imagination celebration thermometer microscope
photography supermarket engineer wonderful beautiful dangerous comfortable
kilometres mathematics alphabet aquarium barbecue cucumber firefighter hamburger
vacation information invitation magazine necklace paragraph quality yogurt
banana grape peach lemon mango melon cherry strawberry juice bread butter cheese
cookie pizza salad soup rice noodle tomato potato carrot onion shirt shoes socks
dress coat scarf glove jacket pocket button zipper clock watch lamp door floor
wall roof stairs gate fence river lake sea beach hill road bridge tunnel train
ticket ruler eraser crayon paper glue scissors backpack chalk board angry tired
hungry thirsty sleepy brave kind quiet loud fast slow clever gentle shiny
`.trim().split(/\s+/).filter(Boolean));
function wordTier(w){
  const n=w.length;
  return n<=4?1 : n===5?2 : n<=7?3 : n<=9?4 : 5;
}
/* spread 扩容用词：派生词形，答案本身就是新词 → 天然不重复 */
function extraWords(spread){
  if(spread<=0) return [];
  const base=WORDS.filter(w=>/^[a-z]{3,7}$/.test(w)).slice(0,90);
  const forms=[
    w=>w+'s', w=>w+'ing', w=>w+'ed',
    w=>w+'er', w=>'un'+w, w=>w+'y'
  ];
  const out=[];
  for(let r=0;r<Math.min(spread,forms.length);r++){
    base.forEach(w=>{ const x=forms[r](w); if(WORDS.indexOf(x)<0) out.push(x); });
  }
  return uniq(out);
}
function wordPool(spread){ return uniq(WORDS.concat(extraWords(spread))); }

/* =========================================================
   数学题库：数字范围随 tier / spread 放大，天然几百道
   ========================================================= */
const STORY_NAMES=['Sam','Lily','Tom','May','Ben','Ann','Ken','Zoe','Mia','Tim','Ella','Leo','Jack','Sue','Max','Amy'];
const WORD_ADD=[
  t=>`${t.n} has ${t.a} ${t.pet}. ${t.n} gets ${t.b} more. How many ${t.pet} now?`,
  t=>`${t.n} has ${t.a} ${t.pet}. Grandma gives ${t.b} more. How many ${t.pet} does ${t.n} have?`,
  t=>`${t.n} finds ${t.b} ${t.pet}. ${t.n} already has ${t.a} ${t.pet}. How many ${t.pet} in all?`,
  t=>`${t.n} has ${t.a} ${t.pet}. ${t.n} buys ${t.b} more. How many ${t.pet} in all?`,
  t=>`There are ${t.a} ${t.pet} on the table. Mom puts ${t.b} more there. How many ${t.pet} on the table?`,
];
const WORD_SUB=[
  t=>`${t.n} has ${t.a} ${t.pet}. ${t.n} gives ${t.b} away. How many ${t.pet} left?`,
  t=>`${t.n} has ${t.a} ${t.pet}. ${t.n} takes ${t.b} out. How many ${t.pet} left?`,
  t=>`${t.n} has ${t.a} ${t.pet}. ${t.b} of them run away. How many ${t.pet} are still here?`,
  t=>`${t.n} has ${t.a} ${t.pet}. ${t.n} gives ${t.b} to a friend. How many ${t.pet} left?`,
  t=>`${t.n} has ${t.a} ${t.pet} in a bag. ${t.b} of them are lost. How many ${t.pet} are in the bag?`,
];
function mathPetFor(seed){
  if(typeof MATH_PETS==='undefined') return {id:25,name:'Pikachu'};
  return MATH_PETS[hn(seed)%MATH_PETS.length];
}
function speakMath(sub){
  return sub.replace(/\+/g,'plus').replace(/−/g,'minus').replace(/=/g,'equals').replace(/\?/g,'');
}
function mathBank(lessonId,level,spread){
  const out=[];
  /* 答对后的解题思路（Make-10 / 数数 / 想加算减）：与 data.js 课程侧同一套 */
  const tipOf=(op,x,y,ans)=>{
    const t=(typeof mathTip==='function')?mathTip(op,x,y,ans):`${x} ${op} ${y} = ${ans}.`;
    return {explain:t, answerSpeak:{text:t,lang:'en-US'}};
  };
  /* 基础参数空间就要足够宽（≥200 道本质不同的题）；tier 会把大数字题
     排在后面，入门阶段依然只出小数字，难度靠排序一点点上来。 */
  const cap=Math.min(150, 60+level*10+spread*20);
  const maxA=Math.max(6,Math.floor(cap*0.8));
  const pets=(typeof MATH_PETS!=='undefined')?MATH_PETS:[{id:25,name:'Pikachu'}];
  const tierOf=(n)=>Math.max(1,Math.min(5,1+Math.floor(n/Math.max(8,Math.floor(cap/5)))));
  const add=(qid,tier,obj)=>out.push(tag(obj,'b:'+lessonId+':'+qid,tier));

  if(lessonId==='m-count'){
    /* 数的是哪只宝可梦必须写进题干：否则「5 只皮卡丘」和「5 只胖丁」
       题目本质完全一样，会被去重合并，题库也撑不到 200 道。 */
    for(let n=1;n<=cap;n++){
      for(let pi=0;pi<5;pi++){
        const pet=pets[(hn('c'+n)+pi*5)%pets.length];
        const visual=(typeof petGroup==='function')?petGroup(n,pet):'';
        add('n'+n+'p'+pet.id,tierOf(n),{
          type:'choice',prompt:`How many ${pet.name}?`,visual,petKey:'pk'+pet.id,
          speak:{text:`Count the ${pet.name}. How many?`,lang:'en-US'},
          options:numOptionsLocal(n,1,cap+2),answer:String(n),
          explain:`There are ${n} ${pet.name}. Touch each one as you count: 1, 2, …, ${n}.`,
          answerSpeak:{text:`There are ${n} ${pet.name}. Count one by one: 1, 2, up to ${n}.`,lang:'en-US'}
        });
      }
    }
    return out;
  }

  if(lessonId==='m-word'){
    let i=0;
    for(let a=2;a<=maxA && i<600;a++){
      for(let b=1;b<=Math.min(9,a-1) && i<600;b++){
        for(let k=0;k<2;k++){
          const op=k===0?'+':'-';
          const tpl=(op==='+'?WORD_ADD:WORD_SUB)[(a+b+k)%5];
          const name=STORY_NAMES[(a*3+b*7+k)%STORY_NAMES.length];
          const pet=mathPetFor('w'+a+b+k);
          const sub=tpl({n:name,pet:pet.name,a,b});
          const ans=op==='+'?a+b:a-b;
          const visual=(typeof petVisual==='function')?petVisual(a,b,op,pet):'';
          add(op+a+'_'+b+'_'+k,tierOf(a+b),Object.assign({
            type:'choice',prompt:'Read the story',sub,visual,petKey:'pk'+pet.id,
            speak:{text:sub,lang:'en-US'},
            options:numOptionsLocal(ans,0,cap+10),answer:String(ans)
          },tipOf(op,a,b,ans)));
        }
        i++;
      }
    }
    return out.slice(0,600);
  }

  /* 加减 / number bonds / mixed：枚举 (a,b) 组合 */
  const isSub=/sub/.test(lessonId);
  const isBonds=/bonds/.test(lessonId);
  let count=0;
  for(let a=2;a<=maxA && count<600;a++){
    for(let b=1;b<=Math.min(maxA,a) && count<600;b++){
      if(isSub && b>=a) continue;
      if(!isSub && a+b>cap) continue;
      const op=lessonId==='m-mixed' ? ((a+b)%2===0?'+':'-') : (isSub?'-':'+');
      const x=op==='-'?Math.max(a,b):a, y=op==='-'?Math.min(a,b):b;
      if(op==='-' && y>=x) continue;
      const ans=op==='+'?a+b:x-y;
      if(ans<0) continue;
      const pet=mathPetFor(op+a+'_'+b);
      const sub=`${x} ${op==='+'?'+':'−'} ${y} = ?`;
      const visual=(typeof petVisual==='function')?petVisual(x,y,op,pet):'';
      const prompt=isBonds?'Add the two parts':(op==='-'?'How many are left?':'Solve it');
      add(op+x+'_'+y+'k'+(a%3),tierOf(x+y),Object.assign({
        type:'choice',prompt,sub,visual,petKey:'pk'+pet.id,
        speak:{text:speakMath(sub),lang:'en-US'},
        options:numOptionsLocal(ans,0,cap*2),answer:String(ans)
      },tipOf(isBonds&&ans<=10?'bonds':op,x,y,ans)));
      count++;
    }
  }
  return out;
}

/* =========================================================
   英文题库
   ========================================================= */
const SUBJ=['I','We','They','He','She','My friend','The children','My brother'];
const VERBS=['like','see','have','want','read','make','find','watch','draw','help'];
const PLACES=['at school','in the park','at home','after lunch','with my friend','every day'];
function article(w){ return /^[aeiou]/i.test(w)?'an':'a'; }
function buildSentences(spread){
  /* spread 扩容：把派生词也放进宾语池并放宽上限，
     否则前 420 句永远是同一批，题库刷完就再也造不出新句。 */
  const objs=wordPool(spread).filter(w=>w.length<=9).slice(0,110+spread*40);
  const limit=600+spread*300;
  const out=[];
  let i=0;
  for(let s=0;s<SUBJ.length;s++){
    for(let v=0;v<VERBS.length;v++){
      for(let o=0;o<objs.length;o++){
        const w=objs[o], sv=SUBJ[s], vb=VERBS[v];
        /* 主语与动词搭配：三单加 s，避免教错语法 */
        const verb=/^(He|She|My friend|My brother)$/.test(sv) ? vb+'s' : vb;
        const extra=(s+v+o)%4===0 ? PLACES[(s+v+o)%PLACES.length] : '';
        const tiles=[sv,verb,article(w),w].concat(extra?extra.split(' '):[]).concat(['.']);
        const sentence=tiles.join(' ').replace(/ \./g,'.');
        const tier=Math.max(1,Math.min(5,
          1+Math.floor(w.length/3)+(extra?1:0)+(tiles.length>6?1:0)));
        out.push({qid:'s'+s+'v'+v+'o'+o,tier,type:'build',
          prompt:'Tap the words in order to build a sentence',
          sub:'Put the words in the right order',
          tiles:shuffle(tiles),answer:tiles.join(' '),
          /* 答对后的完整句由 bindBuild 统一播报，这里不再放 answerSpeak，
             否则 onCorrect 与 bindBuild 会把同一句念两遍。 */
          speak:{text:sentence,lang:'en-US',forceAuto:true},
          explain:sentence});
        i++;
        if(i>=limit) return out;
      }
    }
  }
  return out;
}
/* 语法模板：每个句型都同时用到主语 s 和名词 n，保证「主语 × 名词 × 句型」
   组合出来的题题题不同；w 是该句型的基础难度档。 */
function grammarTemplates(){
  const third=(s)=>/^(He|She|It|My dad|The cat|My sister|The puppy)$/.test(s);
  const be=(s)=>s==='I'?'am':third(s)?'is':'are';
  return [
    {w:1,f:(s,n)=>({s:`${s} ___ a ${n}.`,o:['have','has','having'],
      a:third(s)?'has':'have',why:'With he, she or it we use "has"; with I, you, we and they we use "have".'})},
    {w:1,f:(s,n)=>({s:`${s} ___ happy with the ${n}.`,o:['am','is','are'],
      a:be(s),why:'The subject picks the be verb: I am, he is, they are.'})},
    {w:2,f:(s,n)=>({s:`${s} puts the ${n} ___ the box.`,o:['in','of','by'],
      a:'in',why:'Use "in" when something is inside the box.'})},
    {w:2,f:(s,n)=>({s:`${s} ___ reading about a ${n}.`,o:['is','are','am'],
      a:be(s),why:'Use am, is or are before an -ing word.'})},
    {w:2,f:(s,n)=>({s:`There ___ a ${n} near ${s}.`,o:['is','are','am'],
      a:'is',why:'One thing takes "There is"; two or more take "There are".'})},
    {w:3,f:(s,n)=>({s:`${s} has two ${n}s. They ___ small.`,o:['is','are','am'],
      a:'are',why:'"They" means more than one, so we use "are".'})},
    {w:3,f:(s,n)=>({s:`${s} ___ a ${n} yesterday.`,o:['have','has','had'],
      a:'had',why:'"Yesterday" is the past, so we use "had".'})},
    {w:3,f:(s,n)=>({s:`${s} wants ___ ${n}.`,o:['a','an','the'],
      a:article(n),why:'Use "an" before a vowel sound.'})},
    {w:4,f:(s,n)=>({s:`${s} likes the ${n}. ___ is fun.`,o:['It','They','He'],
      a:'It',why:'Use "It" for a thing; use "He" or "She" for a person.'})},
    {w:4,f:(s,n)=>({s:`${s} ___ to school with a ${n}.`,o:['go','goes','going'],
      a:third(s)?'goes':'go',why:'With he, she or it we add -es: he goes.'})},
    {w:5,f:(s,n)=>({s:`___ ${n} belongs to ${s}.`,o:['The','A','An'],
      a:'The',why:'Use "The" when we mean one special thing.'})},
    {w:5,f:(s,n)=>({s:`${s} can see a ${n}, can't ___?`,o:['I','you','they'],
      a:'you',why:'After "... can\'t ___?" we say "you".'})},
  ];
}
function englishBank(lessonId,level,spread){
  const pool=wordPool(spread);
  const out=[];
  const add=(qid,tier,obj)=>out.push(tag(obj,'b:'+lessonId+':'+qid,tier));

  if(lessonId==='e-build'){
    return buildSentences(spread);
  }
  if(lessonId==='e-phonics' && typeof global.PHONIC!=='undefined'){
    /* v32：发音辨析题（问字母发音 / 找同音词 / 听音选词），
       每答对给出中文解题思路并朗读规则。题库由 PHONIC 全量枚举提供。 */
    return global.PHONIC.fullSet().map(q=>tag(q,'b:e-phonics:'+q.qid,q.tier));
  }
  if(lessonId==='e-grammar'){
    const T=grammarTemplates();
    const SS=SUBJ.concat(['You','It','My dad','The cat','Tom','The girls',
      'My teacher','Our class','The puppy','My sister','Ben and Tom']);
    const NS0=['book','ball','cake','kite','fish','hat','cup','bag','dog','apple','bird','flower'];
    /* spread 扩容：把更多名词放进句型槽，造出以前从没出过的新句子 */
    const extraN=wordPool(spread).filter(w=>w.length>=3&&w.length<=7&&!/-|s$/.test(w));
    const NS=uniq(NS0.concat(extraN.slice(0,spread*16)));
    /* 每个句型各取一批，保证 tier 1–5 都有充足库存；
       若用全局上限截断，前面的低难度模板会把名额吃光，难度永远升不上去。 */
    const perTemplate=100+spread*40;
    for(let t=0;t<T.length;t++){
      let made=0;
      for(let s=0;s<SS.length&&made<perTemplate;s++){
        for(let n=0;n<NS.length&&made<perTemplate;n++){
          const g=T[t].f(SS[s],NS[n]);
          const full=g.s.replace('___',g.a);
          const tier=Math.max(1,Math.min(5,T[t].w+(wordTier(NS[n])>=4?1:0)));
          add('t'+t+'s'+s+'n'+n,tier,{
            type:'choice',prompt:'Choose the correct word',
            sub:`<span class="gram-sent">${g.s.replace('___','<b>___</b>')}</span>`,
            speak:{text:g.s.replace('___','blank'),lang:'en-US',forceAuto:true},
            answerSpeak:{text:full,lang:'en-US'},
            options:shuffle(g.o),answer:g.a,explain:`${full} — ${g.why}`
          });
          made++;
        }
      }
    }
    return out;
  }

  /* e-sight / e-spell / e-phonics：一词一题，词表随 spread 变大 */
  pool.forEach((w,i)=>{
    const tier=wordTier(w);
    if(lessonId==='e-spell'){
      add('sp'+i,tier,{type:'type',prompt:'Listen and spell the word 🔊',
        sub:'(Tap 🔊, then spell with the keyboard)',
        speak:{text:w,lang:'en-US'},answer:w,
        explain:`Spell: ${w.split('').join('-')}.`});
    }else if(lessonId==='e-phonics'){
      const first=w[0];
      add('ph'+i,tier,{type:'choice',prompt:'Which letter starts this word?',
        sub:`"${w}" — what is the first letter?`,
        speak:{text:w,lang:'en-US'},
        options:detOpts(first,'bcdfghjklmnprstw'.split(''),'ph'+w),answer:first,
        explain:`"${w}" starts with "${first}".`});
      /* 同一词的「尾字母」是另一道本质不同的题 */
      const last=w[w.length-1];
      add('pl'+i,tier,{type:'choice',prompt:'Which letter ends this word?',
        sub:`"${w}" — what is the last letter?`,
        speak:{text:w,lang:'en-US'},
        options:detOpts(last,'abcdefghijklmnopqrstuvwxyz'.split(''),'pl'+w),answer:last,
        explain:`"${w}" ends with "${last}".`});
    }else{
      add('si'+i,tier,{type:'choice',prompt:'Listen, then tap the word 👂',
        sub:'(Tap 🔊 and choose the word you hear)',
        speak:{text:w,lang:'en-US'},
        options:detOpts(w,pool,'si'+w),answer:w,
        explain:`The word is "${w}".`});
    }
  });
  return out;
}

/* =========================================================
   中文题库：以 63 个带录音的音节为核心，交叉多种问法
   ========================================================= */
function zhPool(){
  return {
    ini:(typeof ZH_INITIALS!=='undefined')?ZH_INITIALS:[],
    fin:(typeof ZH_FINALS!=='undefined')?ZH_FINALS:[],
    who:(typeof ZH_WHOLES!=='undefined')?ZH_WHOLES:[],
    ble:(typeof ZH_BLENDS!=='undefined')?ZH_BLENDS:[],
    ton:(typeof ZH_TONES!=='undefined')?ZH_TONES:[],
    ch:(typeof CHARS!=='undefined')?CHARS:[]
  };
}
function zclip(kind,key){
  return (typeof zhClip==='function')?zhClip(kind,key):null;
}
function tclip(base,t){
  return (typeof zhToneClip==='function')?zhToneClip(base,t):null;
}
function tmark(s,t){
  return (typeof zhToneMark==='function')?zhToneMark(s,t):s;
}
function chineseBank(lessonId,level,spread){
  const P=zhPool(), out=[];
  const add=(qid,tier,obj)=>out.push(tag(obj,'b:'+lessonId+':'+qid,tier));
  const names=['第一声','第二声','第三声','第四声'];
  const iniList=P.ini.map(x=>x.p), finList=P.fin.map(x=>x.p), whoList=P.who.map(x=>x.p);
  const hzList=P.ble.map(x=>x.hz);
  const clipOf=(it)=>zclip('syl',it.syl);   // 只读音节本身：不能多读例词，否则「听音节选声母」会泄题
  const base=(it)=>({text:it.hz,lang:'zh-CN',clip:clipOf(it),autoplay:true});

  /* 通用音节变体：7 种问法，每种 63 道 → 441 道，题目本质互不相同 */
  const variants=[
    {k:'ini-hear',tier:1,make:(it)=>({
      prompt:`🔊 听一听，${it.syl} 的声母是？`,sub:'选出开头的声母',
      speak:base(it),options:detOpts(it.ini,iniList,'a'+it.syl),answer:it.ini,
      explain:`${it.syl} 的声母是 ${it.ini}。`})},
    {k:'fin-hear',tier:1,make:(it)=>({
      prompt:`🔊 听一听，${it.syl} 的韵母是？`,sub:'选出后面的韵母',
      speak:base(it),options:detOpts(it.fin,finList,'b'+it.syl),answer:it.fin,
      explain:`${it.syl} 的韵母是 ${it.fin}。`})},
    {k:'tone-hear',tier:2,make:(it)=>({
      prompt:`🔊 听一听，${it.syl} 是第几声？`,sub:'一声平、二声扬、三声拐、四声降',
      speak:base(it),options:names,answer:names[(it.tone||1)-1],
      explain:`${it.syl} 是第${(it.tone||1)}声。`})},
    {k:'hz-hear',tier:2,make:(it)=>({
      prompt:'🔊 听一听，这是哪个字？',sub:`音节 ${it.syl} · 选出对应的汉字`,
      speak:base(it),options:detOpts(it.hz,hzList,'c'+it.syl),answer:it.hz,
      explain:`${it.syl} 可以写作「${it.hz}」，例如「${it.word}」。`})},
    {k:'ini-look',tier:2,make:(it)=>({
      prompt:`看音节 ${it.syl}，它的声母是？`,sub:'不用听，看拼音选一选',
      speak:base(it),options:detOpts(it.ini,iniList,'d'+it.syl),answer:it.ini,
      explain:`${it.ini} + ${it.fin} = ${it.syl}。`})},
    {k:'fin-look',tier:3,make:(it)=>({
      prompt:`看音节 ${it.syl}，它的韵母是？`,sub:'注意最后的字母',
      speak:base(it),options:detOpts(it.fin,finList,'e'+it.syl),answer:it.fin,
      explain:`${it.ini} + ${it.fin} = ${it.syl}。`})},
    {k:'word-clue',tier:3,make:(it)=>({
      prompt:`🔊 「${it.word}」里的「${it.hz}」读什么？`,sub:'选出这个字的音节',
      speak:base(it),options:detOpts(it.syl,P.ble.map(x=>x.syl),'f'+it.syl),answer:it.syl,
      explain:`「${it.hz}」读 ${it.syl}。`})},
  ];
  /* 每课挑 4 种最贴题的问法 + 专项题，保证 ≥200 且不会跨课撞车 */
  const FOCUS={
    'c-initial':['ini-hear','ini-look','hz-hear','word-clue','fin-hear'],
    'c-final':['fin-hear','fin-look','hz-hear','word-clue','ini-look'],
    'c-whole':['hz-hear','word-clue','tone-hear','ini-hear','fin-hear'],
    'c-blend':['ini-hear','fin-hear','tone-hear','hz-hear','ini-look','fin-look'],
    'c-char':['hz-hear','word-clue','fin-hear','ini-hear','tone-hear'],
    'c-tone':['tone-hear','hz-hear','word-clue','ini-hear','fin-hear']
  };
  const chosen=FOCUS[lessonId]||variants.map(v=>v.k);
  const used=variants.filter(v=>chosen.indexOf(v.k)>=0);
  P.ble.forEach((it,i)=>{
    used.forEach(v=>{
      const o=v.make(it); o.type='choice';
      add(v.k+i,Math.max(1,Math.min(5,v.tier+Math.floor(i/25))),o);
    });
  });

  /* 专项题：声母 / 韵母 / 整体认读 / 汉字 / 声调，各带本地高清录音 */
  if(lessonId==='c-initial'||lessonId==='c-final'||lessonId==='c-whole'){
    const list=lessonId==='c-initial'?P.ini:lessonId==='c-final'?P.fin:P.who;
    const kind=lessonId==='c-initial'?'initial':lessonId==='c-final'?'final':'whole';
    list.forEach((t,i)=>{
      add('zh-hear'+i,1,{type:'choice',canSpeak:true,kind,target:t.p,
        prompt:'🔊 听一听，这个音是哪个？',sub:'点 🔊 再听一次，然后选出正确的拼音',
        speak:{text:t.hz,lang:'zh-CN',clip:zclip(kind,t.p),autoplay:true},
        options:detOpts(t.p,(lessonId==='c-initial'?iniList:lessonId==='c-final'?finList:whoList),'z1'+t.p),
        answer:t.p,explain:`「${t.hz}」就是 ${t.p} 的示范音。`});
      add('zh-hz'+i,2,{type:'choice',prompt:`🔊 听一听，${t.p} 的示范字是？`,
        sub:'选出这个音对应的汉字',
        speak:{text:t.hz,lang:'zh-CN',clip:zclip(kind,t.p),autoplay:true},
        options:detOpts(t.hz,list.map(x=>x.hz),'z2'+t.p),answer:t.hz,
        explain:`${t.p} 的示范字是「${t.hz}」。`});
    });
  }
  if(lessonId==='c-char'){
    P.ch.forEach((ch,i)=>{
      add('c-pinyin'+i,2,{type:'choice',prompt:'这个字的拼音是？',
        sub:`<span style="font-size:54px;font-weight:800">${ch.c}</span>`,
        speak:{text:ch.c,lang:'zh-CN',clip:zclip('char',i)},
        options:detOpts(ch.p,P.ch.map(x=>x.p),'cp'+i),answer:ch.p,
        explain:`${ch.c} 读 ${ch.p}。`});
      add('c-hanzi'+i,3,{type:'choice',prompt:`🔊 哪个字读 ${ch.p}？`,
        sub:'听一听，再选出正确的汉字',
        speak:{text:ch.c,lang:'zh-CN',clip:zclip('char',i),autoplay:true},
        options:detOpts(ch.c,P.ch.map(x=>x.c),'ch'+i),answer:ch.c,
        explain:`${ch.p} 写作「${ch.c}」。`});
    });
  }
  if(lessonId==='c-tone'){
    P.ton.forEach((g,gi)=>{
      for(let t=1;t<=4;t++){
        const py=g.py[t-1];
        add('t'+gi+'_'+t,Math.max(1,Math.min(5,1+Math.floor(gi/2))),{
          type:'choice',prompt:`看拼音，选出「${g.hz[t-1]}」的声调`,
          sub:`<span class="tone-base">${py}</span><div class="tone-tip">点 🔊 听一听再选</div>`,
          speak:{text:g.hz[t-1],lang:'zh-CN',clip:tclip(g.base,t),autoplay:true},
          options:names,optionMarks:['—','↗','∨','↘'],answer:names[t-1],
          explain:`「${g.hz[t-1]}」${py} 是${names[t-1]}。`});
        add('th'+gi+'_'+t,2,{type:'choice',prompt:`🔊 听一听，「${g.hz[t-1]}」是第几声？`,
          sub:'一声平、二声扬、三声拐、四声降',
          speak:{text:g.hz[t-1],lang:'zh-CN',clip:tclip(g.base,t),autoplay:true},
          options:names,optionMarks:['—','↗','∨','↘'],answer:names[t-1],
          explain:`「${g.hz[t-1]}」是${names[t-1]}。`});
      }
    });
  }
  /* spread：把剩余问法也放进来，继续产出全新题 */
  if(spread>0){
    const rest=variants.filter(v=>chosen.indexOf(v.k)<0);
    const take=Math.min(rest.length,spread);
    for(let r=0;r<take;r++){
      const v=rest[r];
      P.ble.forEach((it,i)=>{
        const o=v.make(it); o.type='choice';
        add('x'+r+'_'+v.k+i,4,o);
      });
    }
  }
  return out;
}

/* =========================================================
   对外接口
   ========================================================= */
/* 同一组参数只生成一次：每套题都要遍历几百道候选，
   不缓存的话数学题的宝可梦图 HTML 会重复构建，iPad 上会明显卡顿。 */
const _cache=new Map();
function build(lessonId,level,spread){
  level=Math.max(1,Math.min(5,Number(level)||1));
  spread=Math.max(0,Number(spread)||0);
  const ck=lessonId+'|'+level+'|'+spread;
  if(_cache.has(ck)) return _cache.get(ck);
  let out=[];
  try{
    if(lessonId.indexOf('m-')===0) out=mathBank(lessonId,level,spread);
    else if(lessonId.indexOf('c-')===0) out=chineseBank(lessonId,level,spread);
    else if(lessonId==='e-read'||lessonId.indexOf('r-')===0) return [];   // 阅读走短文生成器
    else out=englishBank(lessonId,level,spread);
  }catch(e){
    if(global.console) global.console.warn('[Bank] '+lessonId,e);
    return [];
  }
  if(_cache.size>48) _cache.delete(_cache.keys().next().value);
  _cache.set(ck,out);
  return out;
}
function capacity(lessonId,level,spread){
  const a=build(lessonId,level,spread);
  return {count:a.length,unique:new Set(a.map(q=>q.qid)).size,
          tiers:[1,2,3,4,5].map(t=>a.filter(q=>q.tier===t).length)};
}
global.Bank={build,capacity,wordCount:WORDS.length,
  _internal:{h32,wordPool,mathBank,englishBank,chineseBank}};
})(typeof window!=='undefined'?window:globalThis);
