/* =========================================================
   小布学习乐园 · 课程数据层 v3
   - 宝可梦图库 / 进化常量见 js/pokemon.js（本文件之前加载）
   - CURRICULUM：数学(按 MOE K1 分阶) / 英文(含分级读物) / 中文(拼音)
   - 题目对象均为纯数据，可序列化存入错题本：
     { type:'choice'|'type'|'build'|'passage', prompt, sub, visual, speak,
       options:[], answer, tiles:[], explain }
   ========================================================= */

/* ---------------- 工具函数 ---------------- */
function ri(min,max){ return Math.floor(Math.random()*(max-min+1))+min; }
function pick(arr){ return arr[ri(0,arr.length-1)]; }
function shuffle(a){ a=a.slice(); for(let i=a.length-1;i>0;i--){const j=ri(0,i);[a[i],a[j]]=[a[j],a[i]];} return a; }
function numOptions(answer,min,max){
  const s=new Set([answer]);
  while(s.size<4){ const d=answer+ri(-3,3); if(d>=min&&d<=max&&d!==answer&&!s.has(d)) s.add(d); }
  return shuffle([...s]).map(String);
}
function tenFrame(n){
  let h='<div class="q-visual" style="font-size:0">';
  for(let i=0;i<10;i++){
    h+=`<span style="display:inline-block;width:34px;height:34px;margin:3px;border-radius:8px;
        background:${i<n?'#FFB15C':'#EFE3CC'};box-shadow:inset 0 0 0 2px #fff;"></span>`;
  }
  h+='</div>';
  return h;
}
function emojiGroup(n,emoji){
  return '<div class="q-visual">'+emoji.repeat(n)+'</div>';
}

/* =========================================================
   数学 · 新加坡 MOE 大纲（全英文，20以内）
   Level 1 = N2/K1 起步 · Level 2 = K1 · Level 3 = K1/K2
   ========================================================= */
const MATH = [
  { id:'m-count', level:1, title:'Counting 1–10', emoji:'🔢',
    desc:'Count objects and recognise numbers (MOE N2)',
    make(){
      const out=[];
      for(let i=0;i<8;i++){
        const n=ri(1,10), e=pick(['🍎','⭐','🐟','🚗','🌸']);
        out.push({type:'choice', prompt:`How many?`, visual:emojiGroup(n,e),
          speak:{text:`Count the ${e}. How many?`,lang:'en-US'},
          options:numOptions(n,1,10), answer:String(n), explain:`There are ${n} ${e}.`});
      }
      return out;
    }},

  { id:'m-bonds10', level:1, title:'Number Bonds to 10', emoji:'🧩',
    desc:'Part–Whole: ways to make 10 (MOE N2/K1)',
    make(){
      const out=[];
      for(let i=0;i<8;i++){
        const w=ri(4,10), p1=ri(1,w-1), p2=w-p1;
        const miss=Math.random()<0.5?p1:p2, shown=miss===p1?p2:p1;
        out.push({type:'choice', prompt:`What is the missing part?`, sub:`${w} = ${shown} + ?`,
          speak:{text:`${w} equals ${shown} plus what?`,lang:'en-US'},
          options:numOptions(miss,1,9), answer:String(miss), explain:`${w} = ${p1} + ${p2}.`});
      }
      return out;
    }},

  { id:'m-add10', level:1, title:'Addition within 10', emoji:'➕',
    desc:'Add by combining (MOE K1)',
    make(){
      const out=[];
      for(let i=0;i<8;i++){
        let a=ri(1,9), b=ri(1,9-a); const ans=a+b;
        out.push({type:'choice', prompt:`How many in all?`,
          visual:emojiGroup(a,'🍎')+`<div class="q-sub">+</div>`+emojiGroup(b,'🍎'),
          speak:{text:`${a} plus ${b} equals what?`,lang:'en-US'},
          options:numOptions(ans,2,10), answer:String(ans), explain:`${a} + ${b} = ${ans}.`});
      }
      return out;
    }},

  { id:'m-bonds20', level:2, title:'Number Bonds to 20', emoji:'🧩',
    desc:'Split 20 into two parts (MOE K1)',
    make(){
      const out=[];
      for(let i=0;i<8;i++){
        const w=ri(11,20), p1=ri(1,w-1), p2=w-p1;
        const miss=Math.random()<0.5?p1:p2, shown=miss===p1?p2:p1;
        out.push({type:'choice', prompt:`Find the missing part`, sub:`${w} = ${shown} + ?`,
          speak:{text:`${w} equals ${shown} plus what?`,lang:'en-US'},
          options:numOptions(miss,1,19), answer:String(miss), explain:`${w} = ${p1} + ${p2}.`});
      }
      return out;
    }},

  { id:'m-add20', level:2, title:'Addition within 20 (Make 10)', emoji:'🚀',
    desc:'Make-10 strategy (MOE K1)',
    make(){
      const out=[];
      for(let i=0;i<8;i++){
        const a=ri(8,19); let b=ri(1,Math.min(20-a,9)); if(a+b>20) b=20-a;
        const ans=a+b, need=10-a, left=b-need;
        out.push({type:'choice', prompt:`Add with Make-10 thinking`, sub:`${a} + ${b} = ?`,
          visual:tenFrame(a)+`<div class="q-sub">+ ${b} more</div>`+tenFrame(ans),
          speak:{text:`${a} plus ${b} equals what?`,lang:'en-US'},
          options:numOptions(ans,11,20), answer:String(ans),
          explain:`Make 10: ${a}+${need}=10, then 10+${left}=${ans}. So ${a}+${b}=${ans}.`});
      }
      return out;
    }},

  { id:'m-sub10', level:2, title:'Subtraction within 10', emoji:'➖',
    desc:'Take away and find the rest (MOE K1)',
    make(){
      const out=[];
      for(let i=0;i<8;i++){
        const a=ri(2,10), b=ri(1,a-1); const ans=a-b;
        out.push({type:'choice', prompt:`How many are left?`,
          visual:emojiGroup(a,'⭐')+`<div class="q-sub">take away ${b}</div>`+emojiGroup(a-b,'⭐'),
          speak:{text:`${a} minus ${b} equals what?`,lang:'en-US'},
          options:numOptions(ans,0,9), answer:String(ans), explain:`${a} − ${b} = ${ans}.`});
      }
      return out;
    }},

  { id:'m-sub20', level:3, title:'Subtraction within 20', emoji:'➖',
    desc:'Subtract within 20 (MOE K1/K2)',
    make(){
      const out=[];
      for(let i=0;i<8;i++){
        const a=ri(11,20), b=ri(1,a-1); const ans=a-b;
        out.push({type:'choice', prompt:`How many are left?`, sub:`${a} − ${b} = ?`,
          visual:tenFrame(a)+`<div class="q-sub">− ${b}</div>`+tenFrame(ans),
          speak:{text:`${a} minus ${b} equals what?`,lang:'en-US'},
          options:numOptions(ans,1,19), answer:String(ans), explain:`${a} − ${b} = ${ans}.`});
      }
      return out;
    }},

  { id:'m-word', level:3, title:'Math Word Problems', emoji:'📖',
    desc:'Read a story and write the number sentence (MOE K1/K2)',
    make(){
      const tpl=[
        {e:'🍎',subj:'Sam',v:'apples',a:ri(2,6),b:ri(2,6),op:'+'},
        {e:'🍪',subj:'Lily',v:'cookies',a:ri(3,8),b:ri(1,4),op:'+'},
        {e:'🚗',subj:'Tom',v:'cars',a:ri(5,10),b:ri(1,4),op:'-'},
        {e:'🐟',subj:'May',v:'fish',a:ri(6,12),b:ri(1,5),op:'-'},
        {e:'⚽',subj:'Ben',v:'balls',a:ri(4,9),b:ri(2,5),op:'+'},
      ];
      const out=[];
      for(let i=0;i<8;i++){
        const t=pick(tpl); let ans,q;
        if(t.op==='+'){ ans=t.a+t.b; q=`${t.subj} has ${t.a} ${t.e}. ${t.subj} gets ${t.b} more. How many ${t.v} now?`; }
        else { ans=t.a-t.b; q=`${t.subj} has ${t.a} ${t.e}. ${t.subj} gives ${t.b} away. How many ${t.v} left?`; }
        out.push({type:'choice', prompt:`Read the story`, sub:q,
          speak:{text:q,lang:'en-US'},
          options:numOptions(ans,Math.max(0,ans-3),ans+3), answer:String(ans),
          explain:`${t.op==='+'?t.a+' + '+t.b:t.a+' − '+t.b} = ${ans}.`});
      }
      return out;
    }},

  { id:'m-mixed', level:3, title:'Mixed Practice', emoji:'🎯',
    desc:'Mix of add and subtract within 20',
    make(){
      const out=[];
      for(let i=0;i<8;i++){
        const op=Math.random()<0.5?'+':'-'; let a,b,ans;
        if(op==='+'){ a=ri(1,15); b=ri(1,Math.min(20-a,15)); ans=a+b; }
        else { a=ri(6,20); b=ri(1,a-1); ans=a-b; }
        out.push({type:'choice', prompt:`Solve it`, sub:`${a} ${op} ${b} = ?`,
          speak:{text:`${a} ${op==='+'?'plus':'minus'} ${b} equals what?`,lang:'en-US'},
          options:numOptions(ans,Math.max(0,ans-3),ans+3), answer:String(ans),
          explain:`${a} ${op} ${b} = ${ans}.`});
      }
      return out;
    }},
];

/* =========================================================
   英文 · 全英文（阅读 / 拼写 / 写作 / 分级读物）
   ========================================================= */
const SIGHT=['the','a','I','you','he','she','we','to','and','is','it','in','on','at','can','see','look','go','big','red','blue','cat','dog','sun','run','hot','cup','book','ball','tree'];
const READS=[
  {s:'The cat is red.',q:'Is the cat red?',o:['Yes','No'],a:'Yes'},
  {s:'I see a big dog.',q:'What do I see?',o:['a dog','a cat','a sun'],a:'a dog'},
  {s:'The sun is hot.',q:'Is the sun cold?',o:['Yes','No'],a:'No'},
  {s:'We go to the park.',q:'Where do we go?',o:['park','school','home'],a:'park'},
  {s:'The ball is blue.',q:'What color is the ball?',o:['blue','red','green'],a:'blue'},
  {s:'Mom has a book.',q:'What does Mom have?',o:['a book','a ball','a dog'],a:'a book'},
  {s:'The dog can run.',q:'What can the dog do?',o:['run','sleep','fly'],a:'run'},
  {s:'I like my cup.',q:'What do I like?',o:['my cup','my book','my dog'],a:'my cup'},
];
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
];

/* 分级读物（原创可解码读物，按 Level 分级） */
const READERS=[
  { id:'r-samcat', level:1, title:'Sam and the Cat', emoji:'🐱',
    desc:'Level 1 · short decodable sentences',
    passage:`Sam has a cat. The cat is red. Sam can pat the cat. The cat is fun!`,
    visual:'🐱🔴',
    qa:[ {q:'What pet does Sam have?',o:['a cat','a dog','a sun'],a:'a cat'},
          {q:'Is the cat red?',o:['Yes','No'],a:'Yes'} ] },
  { id:'r-sun', level:1, title:'The Big Sun', emoji:'☀️',
    desc:'Level 1 · sight words + CVC',
    passage:`The sun is hot. The sun is big. We like the sun. The sun is up.`,
    visual:'☀️',
    qa:[ {q:'Is the sun hot?',o:['Yes','No'],a:'Yes'},
          {q:'Is the sun small?',o:['Yes','No'],a:'No'} ] },
  { id:'r-dog', level:2, title:"Ben's Dog", emoji:'🐶',
    desc:'Level 2 · simple story',
    passage:`Ben has a big dog. The dog can run. The dog can jump. Ben likes his dog.`,
    visual:'🐶',
    qa:[ {q:'What does Ben have?',o:['a dog','a cat','a sun'],a:'a dog'},
          {q:'Can the dog jump?',o:['Yes','No'],a:'Yes'} ] },
  { id:'r-rain', level:2, title:'A Rainy Day', emoji:'🌧️',
    desc:'Level 2 · everyday words',
    passage:`It is raining. Mom has an umbrella. We sit and read a book. We are happy.`,
    visual:'🌧️☂️📖',
    qa:[ {q:'What does Mom have?',o:['an umbrella','a dog','a ball'],a:'an umbrella'},
          {q:'Is it raining?',o:['Yes','No'],a:'Yes'} ] },
  { id:'r-park', level:3, title:'At the Park', emoji:'🏞️',
    desc:'Level 3 · short paragraph',
    passage:`We go to the park. I see a red ball. Tom can kick the ball. We are happy at the park.`,
    visual:'🏞️🔴⚽',
    qa:[ {q:'Where do we go?',o:['the park','the school','the home'],a:'the park'},
          {q:'What color is the ball?',o:['red','blue','green'],a:'red'} ] },
];

const ENGLISH=[
  { id:'e-sight', title:'Sight Words', emoji:'👀',
    desc:'See a word and read it (listen & choose)',
    make(){
      const out=[];
      for(let i=0;i<8;i++){
        const w=pick(SIGHT);
        const opts=shuffle([w,...shuffle(SIGHT.filter(x=>x!==w)).slice(0,2)]);
        out.push({type:'choice', prompt:`Listen, then tap the word 👂`,
          sub:`(Tap 🔊 and choose the word you hear)`,
          speak:{text:w,lang:'en-US'}, options:shuffle(opts), answer:w, explain:`The word is "${w}".`});
      }
      return out;
    }},

  { id:'e-read', title:'Reading & Understanding', emoji:'📚',
    desc:'Read the sentence and answer (all English)',
    make(){
      const out=[];
      shuffle(READS).slice(0,8).forEach(r=>{
        out.push({type:'choice', prompt:`Read the sentence, then answer`, sub:`"${r.s}"`,
          speak:{text:r.s,lang:'en-US'}, options:shuffle(r.o), answer:r.a, explain:`"${r.s}" → ${r.a}.`});
      });
      return out;
    }},

  { id:'e-spell', title:'Spelling (Listen & Type)', emoji:'✍️',
    desc:'Hear the word and spell it',
    make(){
      const out=[];
      shuffle(CVC).slice(0,8).forEach(w=>{
        out.push({type:'type', prompt:`Listen and spell the word 🔊`,
          sub:`(Tap 🔊, then spell with the keyboard)`, speak:{text:w,lang:'en-US'},
          answer:w, explain:`Spell: ${w.split('').join('-')}.`});
      });
      return out;
    }},

  { id:'e-build', title:'Sentence Building (Writing)', emoji:'🧱',
    desc:'Tap words in order to make a sentence',
    make(){
      const out=[];
      shuffle(BUILD).slice(0,6).forEach(b=>{
        out.push({type:'build', prompt:`Tap the words in order to build a sentence`,
          sub:`Put the words in the right order`, tiles:shuffle(b.tiles), answer:b.a});
      });
      return out;
    }},

  { id:'e-phonics', title:'Phonics Review', emoji:'🔡',
    desc:'Listen to the word and pick its first letter',
    make(){
      const out=[];
      shuffle(PHON).slice(0,8).forEach(p=>{
        const opts=shuffle([p.a,...shuffle('bcdfghjklmnprst'.split('').filter(x=>x!==p.a)).slice(0,2)]);
        out.push({type:'choice', prompt:`Which letter starts this word?`,
          visual:`<div class="q-visual">${p.e}</div>`, sub:`"${p.w}" — what is the first letter?`,
          speak:{text:p.w,lang:'en-US'}, options:shuffle(opts), answer:p.a, explain:`"${p.w}" starts with "${p.a}".`});
      });
      return out;
    }},

  /* 分级读物（每课 = 一段朗读 + 理解题） */
  ...READERS.map(r=>({
    id:r.id, level:r.level, title:r.title, emoji:r.emoji, desc:r.desc,
    make(){
      const items=[{type:'passage', title:r.title, text:r.passage, visual:r.visual,
        speak:{text:r.passage,lang:'en-US'}}];
      r.qa.forEach(qa=>{
        items.push({type:'choice', prompt:`Question`, sub:qa.q,
          speak:{text:qa.q,lang:'en-US'}, options:shuffle(qa.o), answer:qa.a, explain:`Answer: ${qa.a}.`});
      });
      return items;
    }
  })),
];

/* =========================================================
   中文 · 汉语拼音 + 汉字复习（内容保留中文）
   ========================================================= */
/* 拼音表统一由 js/zh-phonics.js 提供（含呼读音汉字、四声题库与识别白名单） */
const INITIALS=ZH_INITIALS.map(x=>x.p);
const FINALS=ZH_FINALS.map(x=>x.p);
const CHARS=[
  {c:'水',p:'shuǐ'},{c:'火',p:'huǒ'},{c:'山',p:'shān'},{c:'木',p:'mù'},
  {c:'日',p:'rì'},{c:'月',p:'yuè'},{c:'人',p:'rén'},{c:'口',p:'kǒu'},
  {c:'手',p:'shǒu'},{c:'足',p:'zú'},{c:'目',p:'mù'},{c:'耳',p:'ěr'},
  {c:'田',p:'tián'},{c:'土',p:'tǔ'},{c:'上',p:'shàng'},{c:'下',p:'xià'},
  {c:'大',p:'dà'},{c:'小',p:'xiǎo'},{c:'中',p:'zhōng'},{c:'国',p:'guó'},
  {c:'我',p:'wǒ'},{c:'你',p:'nǐ'},{c:'妈',p:'mā'},{c:'爸',p:'bà'},
];

const CHINESE=[
  { id:'c-tone', title:'Tone Practice 声调练习', emoji:'🔊',
    desc:'听声音辨声调：一声平、二声扬、三声拐、四声降',
    make(){
      const names=['第一声','第二声','第三声','第四声'];
      const marks=['—','↗','∨','↘'];   // 平 / 扬 / 拐 / 降，图形化更好认
      const combos=[];
      // 先保证四个声调各出一题，再补足 8 题，避免整节课只考一种调
      [1,2,3,4].forEach(t=>combos.push({g:pick(ZH_TONES), t}));
      let guard=0;
      while(combos.length<8 && guard++<200){
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
      return shuffle(ZH_INITIALS).slice(0,8).map(t=>({
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
      return shuffle(ZH_FINALS).slice(0,8).map(t=>({
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

  { id:'c-blend', title:'Blending 拼读练习', emoji:'🧩',
    desc:'声母+韵母，带语音播报：听 → 跟读 → 选音节',
    make(){
      return shuffle(ZH_BLENDS).slice(0,8).map(it=>({
        type:'choice', prompt:`拼一拼：${it.ini} + ${it.fin} = ?`,
        sub:`🔊 仔细听：声母 → 韵母 → 合起来怎么读`,
        speak:{ text:`${it.ini}-${it.fin}-${it.syl}`, lang:'zh-CN',
                clip:zhClip('blend',it.syl), autoplay:true },
        options:shuffle([it.syl,...zhBlendDecoys(it)]), answer:it.syl,
        explain:`${it.ini} + ${it.fin} = ${it.syl}。例如「${it.word}」的「${it.hz}」。`
      }));
    }},

  { id:'c-char', title:'Characters 汉字拼音配对', emoji:'🇨🇳',
    desc:'给认识的汉字找正确的拼音',
    make(){
      const out=[];
      shuffle(CHARS.map((c,i)=>Object.assign({},c,{i}))).slice(0,8).forEach(ch=>{
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
