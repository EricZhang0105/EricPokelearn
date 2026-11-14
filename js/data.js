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
/* 方块组：按数值精确渲染 n 个方块，每行最多 10 个（十进位直觉）。
   removed = 末尾要"拿走"的个数 → 画成灰底 ✕，让孩子看见被减掉的部分。
   注意：绝不把剩余数量也画出来，否则等于直接给答案。 */
function blocks(n,{color='#FFB15C',removed=0}={}){
  let cells='';
  for(let i=0;i<n;i++){
    const gone = removed>0 && i>=n-removed;
    cells+=`<span class="blk${gone?' blk-gone':''}" style="--blk:${color}">${gone?'✕':''}</span>`;
  }
  return `<div class="q-visual blk-grid">${cells}</div>`;
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
      for(let i=0;i<10;i++){
        const n=ri(1,10), e=pick(['🍎','⭐','🐟','🚗','🌸']);
        out.push({type:'choice', prompt:`How many?`, visual:emojiGroup(n,e),
          speak:{text:`Count the ${e}. How many?`,lang:'en-US'},
          options:numOptions(n,1,10), answer:String(n), explain:`There are ${n} ${e}.`});
      }
      return out;
    }},

  { id:'m-bonds10', level:1, title:'Number Bonds to 10', emoji:'🧩',
    desc:'Two parts make the whole: 8 + 1 = ? (MOE N2/K1)',
    make(){
      const out=[];
      for(let i=0;i<10;i++){
        const p1=ri(2,8), p2=ri(2,10-p1), w=p1+p2;   // 两个部分都在 2–8，整句写成 8 + 1 = ?
        out.push({type:'choice', prompt:`Add the two parts`, sub:`${p1} + ${p2} = ?`,
          speak:{text:`${p1} plus ${p2} equals what?`,lang:'en-US'},
          options:numOptions(w,2,10), answer:String(w), explain:`${p1} + ${p2} = ${w}.`});
      }
      return out;
    }},

  { id:'m-add10', level:1, title:'Addition within 10', emoji:'➕',
    desc:'Add by combining (MOE K1)',
    make(){
      const out=[];
      for(let i=0;i<10;i++){
        let a=ri(1,9), b=ri(1,9-a); const ans=a+b;
        out.push({type:'choice', prompt:`How many in all?`,
          visual:emojiGroup(a,'🍎')+`<div class="q-sub">+</div>`+emojiGroup(b,'🍎'),
          speak:{text:`${a} plus ${b} equals what?`,lang:'en-US'},
          options:numOptions(ans,2,10), answer:String(ans), explain:`${a} + ${b} = ${ans}.`});
      }
      return out;
    }},

  { id:'m-bonds20', level:2, title:'Number Bonds to 20', emoji:'🧩',
    desc:'Two parts make the whole: 12 + 5 = ? (MOE K1)',
    make(){
      const out=[];
      for(let i=0;i<10;i++){
        let p1,p2,guard=0;                            // 两部分都在 2–10，合起来 11–20
        do{ p1=ri(2,10); p2=ri(2,10); }while(p1+p2<11 && guard++<50);
        const w=p1+p2;
        out.push({type:'choice', prompt:`Add the two parts`, sub:`${p1} + ${p2} = ?`,
          speak:{text:`${p1} plus ${p2} equals what?`,lang:'en-US'},
          options:numOptions(w,9,20), answer:String(w), explain:`${p1} + ${p2} = ${w}.`});
      }
      return out;
    }},

  { id:'m-add20', level:2, title:'Addition within 20 (Make 10)', emoji:'🚀',
    desc:'Make-10 strategy (MOE K1)',
    make(){
      const out=[];
      for(let i=0;i<10;i++){
        const a=ri(8,9), b=ri(11-a,9);          // 保证 a+b>10 且 ≤18，Make-10 才成立
        const ans=a+b, need=10-a, left=b-need;
        out.push({type:'choice', prompt:`Add with Make-10 thinking`, sub:`${a} + ${b} = ?`,
          visual:blocks(a)+`<div class="q-sub">+ ${b} more</div>`+blocks(b,{color:'#7BC6F5'}),
          speak:{text:`${a} plus ${b} equals what?`,lang:'en-US'},
          options:numOptions(ans,11,18), answer:String(ans),
          explain:`Make 10: ${a}+${need}=10, then 10+${left}=${ans}. So ${a}+${b}=${ans}.`});
      }
      return out;
    }},

  { id:'m-sub10', level:2, title:'Subtraction within 10', emoji:'➖',
    desc:'Take away and find the rest (MOE K1)',
    make(){
      const out=[];
      for(let i=0;i<10;i++){
        const a=ri(2,10), b=ri(1,a-1); const ans=a-b;
        out.push({type:'choice', prompt:`How many are left?`, sub:`${a} − ${b} = ?`,
          visual:blocks(a,{removed:b})+`<div class="q-sub">take away ${b} ✕</div>`,
          speak:{text:`${a} minus ${b} equals what?`,lang:'en-US'},
          options:numOptions(ans,0,9), answer:String(ans), explain:`${a} − ${b} = ${ans}.`});
      }
      return out;
    }},

  { id:'m-sub20', level:3, title:'Subtraction within 20', emoji:'➖',
    desc:'Subtract within 20 (MOE K1/K2)',
    make(){
      const out=[];
      for(let i=0;i<10;i++){
        const a=ri(11,20), b=ri(1,Math.min(9,a-2)); const ans=a-b;
        out.push({type:'choice', prompt:`How many are left?`, sub:`${a} − ${b} = ?`,
          visual:blocks(a,{removed:b})+`<div class="q-sub">− ${b} take away ✕</div>`,
          speak:{text:`${a} minus ${b} equals what?`,lang:'en-US'},
          options:numOptions(ans,1,19), answer:String(ans), explain:`${a} − ${b} = ${ans}.`});
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
      const CAST=[
        {n:'Sam', e:'🍎', v:'apples'},   {n:'Lily',e:'🍪', v:'cookies'},
        {n:'Tom', e:'🚗', v:'cars'},     {n:'May', e:'🐟', v:'fish'},
        {n:'Ben', e:'⚽', v:'balls'},    {n:'Ann', e:'🌸', v:'flowers'},
        {n:'Ken', e:'📚', v:'books'},    {n:'Zoe', e:'🐰', v:'rabbits'},
        {n:'Mia', e:'🍌', v:'bananas'},  {n:'Tim', e:'🎈', v:'balloons'},
        {n:'Ella',e:'🐤', v:'chicks'},   {n:'Leo', e:'🚌', v:'toy buses'},
      ];
      const ADD=[
        t=>`${t.n} has ${t.a} ${t.e}. ${t.n} gets ${t.b} more. How many ${t.v} now?`,
        t=>`${t.n} has ${t.a} ${t.e}. Grandma gives ${t.b} more. How many ${t.v} does ${t.n} have?`,
        t=>`${t.n} finds ${t.b} ${t.e}. ${t.n} already has ${t.a} ${t.e}. How many ${t.v} in all?`,
        t=>`${t.n} has ${t.a} ${t.e}. ${t.n} buys ${t.b} more. How many ${t.v} in all?`,
        t=>`There are ${t.a} ${t.e} on the table. Mom puts ${t.b} more there. How many ${t.v} on the table?`,
        t=>`${t.n} has ${t.a} ${t.e} in a box. ${t.n} puts ${t.b} more in. How many ${t.v} in the box?`,
      ];
      const SUB=[
        t=>`${t.n} has ${t.a} ${t.e}. ${t.n} gives ${t.b} away. How many ${t.v} left?`,
        t=>`${t.n} has ${t.a} ${t.e}. ${t.n} takes ${t.b} out. How many ${t.v} left?`,
        t=>`${t.n} has ${t.a} ${t.e} on the table. ${t.b} of them fall down. How many ${t.v} are still on the table?`,
        t=>`${t.n} has ${t.a} ${t.e}. ${t.n} gives ${t.b} to a friend. How many ${t.v} left?`,
        t=>`${t.n} has ${t.a} ${t.e} in a bag. ${t.b} of them are lost. How many ${t.v} are in the bag?`,
        t=>`${t.n} has ${t.a} ${t.e}. Mom takes ${t.b} away. How many ${t.v} left?`,
      ];
      const people = shuffle(CAST).slice(0,10);
      const kinds  = shuffle([
        ...shuffle(ADD).slice(0,5).map(f=>({op:'+',f})),
        ...shuffle(SUB).slice(0,5).map(f=>({op:'-',f}))
      ]);
      return kinds.map((k,i)=>{
        const p=people[i]; let a,b;
        if(k.op==='+'){ a=ri(2,9); b=ri(1,Math.min(8,18-a)); }
        else          { a=ri(5,18); b=ri(1,Math.min(5,a-2)); }
        const ans = k.op==='+' ? a+b : a-b;
        const q   = k.f({n:p.n,e:p.e,v:p.v,a,b});
        return {type:'choice', prompt:`Read the story`, sub:q,
          speak:{text:q,lang:'en-US'},
          options:numOptions(ans,Math.max(0,ans-3),ans+3), answer:String(ans),
          explain:`${a} ${k.op} ${b} = ${ans}.`};
      });
    }},

  { id:'m-mixed', level:3, title:'Mixed Practice', emoji:'🎯',
    desc:'Mix of add and subtract within 20',
    make(){
      const out=[];
      for(let i=0;i<10;i++){
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
  {s:'I see ___ apple.',            o:['a','an'],        a:'an',   why:'an 用在元音音素前：an apple'},
  {s:'The cats ___ sleeping.',      o:['is','are'],      a:'are',  why:'cats 是复数，用 are'},
  {s:'One cat, two ___.',           o:['cat','cats'],    a:'cats', why:'两个以上名词要加 -s'},
  {s:'The ball is ___ the box.',    o:['in','on'],       a:'in',   why:'在盒子里面用 in'},
  {s:'Tom is a boy. ___ is happy.', o:['He','She'],      a:'He',   why:'男孩用 He，女孩用 She'},
  {s:'She ___ reading a book.',     o:['is','are'],      a:'is',   why:'She 是单数，用 is'},
  {s:'He ___ to school every day.', o:['go','goes'],     a:'goes', why:'第三人称单数动词加 -es'},
  {s:'___ is your name?',           o:['What','Who'],    a:'What', why:'问名字用 What is your name?'},
  {s:'The dog ___ a tail.',         o:['has','have'],    a:'has',  why:'单数主语用 has'},
  {s:'I ___ a pencil.',             o:['has','have'],    a:'have', why:'I / you / 复数用 have'},
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
          speak:{text:b.a.replace(/ \./g,'.'),lang:'en-US'}});
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
          speak:{text:full,lang:'en-US'}, options:shuffle(g.o), answer:g.a,
          explain:`${full} — ${g.why}`};
      });
    }},


  { id:'e-phonics', title:'Phonics Review', emoji:'🔡',
    desc:'Listen to the word and pick its first letter',
    make(){
      const out=[];
      shuffle(PHON).slice(0,10).forEach(p=>{
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
        if(qa.short){
          items.push({type:'type', short:true, prompt:'Short answer', sub:qa.q,
            hint:qa.hint, accept:qa.accept,
            speak:{text:qa.q,lang:'en-US'}, answer:qa.a, explain:`Answer: ${qa.a}.`});
        }else{
          items.push({type:'choice', prompt:`Question`, sub:qa.q,
            speak:{text:qa.q,lang:'en-US'}, options:shuffle(qa.o), answer:qa.a,
            explain:`Answer: ${qa.a}.`});
        }
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
    desc:'声母+韵母（带声调），带语音播报：听 → 跟读 → 选音节',
    make(){
      return shuffle(ZH_BLENDS).slice(0,10).map(it=>{
        const finT = zhToneMark(it.fin, it.tone);   // 韵母带调号，拼读时看得清是第几声
        const sylT = zhToneMark(it.syl, it.tone);   // 拼出来的音节同样带调号
        const tName = zhToneName(it.tone);
        return {
          type:'choice', prompt:`拼一拼：${it.ini} + ${finT} = ?`,
          sub:`🔊 仔细听：声母 → 韵母（${tName}）→ 合起来怎么读`,
          speak:{ text:`${it.ini}，${finT}，${sylT}`, lang:'zh-CN',
                  clip:zhClip('blend',it.syl), autoplay:true },
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
