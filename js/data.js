/* =========================================================
   小布学习乐园 · 数据层 v2
   - POKEMON：真实宝可梦图库（官方精灵图 + 进化链）
   - CURRICULUM：数学(按 MOE K1 分阶) / 英文(含分级读物) / 中文(拼音)
   题目对象均为纯数据，可序列化存入错题本：
   { type:'choice'|'type'|'build'|'passage', prompt, sub, visual, speak,
     options:[], answer, tiles:[], explain }
   ========================================================= */

const ENERGY_PER_STAGE = 100;   // 每阶所需能量
const ENERGY_PER_LESSON = 20;   // 每完成一课获得能量

/* 官方高清精灵图（PokeAPI，离线可缓存） */
function pokeImg(id){
  return 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/'+id+'.png';
}

/* ---------------- 宝可梦库（可自由增删） ---------------- */
const POKEMON = [
  { id:'bulbasaur', name:'Bulbasaur', color:'#6FCF57',
    stages:[{name:'Bulbasaur',emoji:'🌱',imgId:1},{name:'Ivysaur',emoji:'🌿',imgId:2},{name:'Venusaur',emoji:'🌳',imgId:3}] },
  { id:'charmander', name:'Charmander', color:'#FF7B29',
    stages:[{name:'Charmander',emoji:'🔥',imgId:4},{name:'Charmeleon',emoji:'🌟',imgId:5},{name:'Charizard',emoji:'🐉',imgId:6}] },
  { id:'squirtle', name:'Squirtle', color:'#3DA5FF',
    stages:[{name:'Squirtle',emoji:'💧',imgId:7},{name:'Wartortle',emoji:'🐢',imgId:8},{name:'Blastoise',emoji:'🌊',imgId:9}] },
  { id:'pikachu', name:'Pikachu', color:'#FFD93D',
    stages:[{name:'Pikachu',emoji:'⚡',imgId:25},{name:'Raichu',emoji:'🔋',imgId:26}] },
  { id:'jigglypuff', name:'Jigglypuff', color:'#FFB6D5',
    stages:[{name:'Jigglypuff',emoji:'🎈',imgId:39},{name:'Wigglytuff',emoji:'🌸',imgId:40}] },
  { id:'psyduck', name:'Psyduck', color:'#FFC94D',
    stages:[{name:'Psyduck',emoji:'🦆',imgId:54},{name:'Golduck',emoji:'🐧',imgId:55}] },
  { id:'snorlax', name:'Snorlax', color:'#B7A98C',
    stages:[{name:'Snorlax',emoji:'😴',imgId:143}] },
  { id:'lapras', name:'Lapras', color:'#8FD3E8',
    stages:[{name:'Lapras',emoji:'🐢',imgId:131}] },
  { id:'eevee', name:'Eevee', color:'#C9A66B',
    stages:[{name:'Eevee',emoji:'⭐',imgId:133},{name:'Sylveon',emoji:'🌸',imgId:700}] },
  { id:'mewtwo', name:'Mewtwo', color:'#B06BD6',
    stages:[{name:'Mewtwo',emoji:'🌀',imgId:150}] },
  { id:'mew', name:'Mew', color:'#F2B5E0',
    stages:[{name:'Mew',emoji:'✨',imgId:151}] },
  { id:'gastly', name:'Gastly', color:'#9B6BD6',
    stages:[{name:'Gastly',emoji:'👻',imgId:92},{name:'Haunter',emoji:'💜',imgId:93},{name:'Gengar',emoji:'🟣',imgId:94}] },
  { id:'dratini', name:'Dratini', color:'#F2A65A',
    stages:[{name:'Dratini',emoji:'🐉',imgId:147},{name:'Dragonair',emoji:'💎',imgId:148},{name:'Dragonite',emoji:'🐲',imgId:149}] },
  { id:'gible', name:'Gible', color:'#4FA3D1',
    stages:[{name:'Gible',emoji:'🦈',imgId:443},{name:'Gabite',emoji:'🌊',imgId:444},{name:'Garchomp',emoji:'🗡️',imgId:445}] },
  { id:'togepi', name:'Togepi', color:'#FFE08A',
    stages:[{name:'Togepi',emoji:'🥚',imgId:175},{name:'Togetic',emoji:'🌟',imgId:176},{name:'Togekiss',emoji:'💫',imgId:468}] },
  { id:'lucario', name:'Lucario', color:'#3A6EA5',
    stages:[{name:'Lucario',emoji:'🥊',imgId:448}] },
  { id:'rayquaza', name:'Rayquaza', color:'#2FBF71',    stages:[{name:'Rayquaza',emoji:'🐉',imgId:384}] },
  { id:'turtwig', name:'Turtwig', color:'#8BC34A',
    stages:[{name:'Turtwig',emoji:'🌱',imgId:387},{name:'Grotle',emoji:'🌿',imgId:388},{name:'Torterra',emoji:'🌳',imgId:389}] },
  { id:'piplup', name:'Piplup', color:'#2E9BD6',
    stages:[{name:'Piplup',emoji:'🐧',imgId:393},{name:'Prinplup',emoji:'💧',imgId:394},{name:'Empoleon',emoji:'⚓',imgId:395}] },
  { id:'chimchar', name:'Chimchar', color:'#E8773A',
    stages:[{name:'Chimchar',emoji:'🔥',imgId:390},{name:'Monferno',emoji:'🔥',imgId:391},{name:'Infernape',emoji:'🐵',imgId:392}] },
  { id:'grookey', name:'Grookey', color:'#5DBB63',
    stages:[{name:'Grookey',emoji:'🐵',imgId:810},{name:'Thwackey',emoji:'🌿',imgId:811},{name:'Rillaboom',emoji:'🥁',imgId:812}] },
];

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
const TONE_MARK={1:'ā',2:'á',3:'ǎ',4:'à'};
const VOWELS=['a','o','e','i','u'];
const INITIALS=['b','p','m','f','d','t','n','l','g','k','h','j','q','x','zh','ch','sh','r','z','c','s','y','w'];
const FINALS=['a','o','e','i','u','ai','ei','ao','ou','an','en','ang','eng','ing','ong'];
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
    desc:'认声调：一声平、二声扬、三声拐、四声降',
    make(){
      const out=[];
      for(let i=0;i<8;i++){
        const v=pick(VOWELS), t=ri(1,4);
        out.push({type:'choice', prompt:`这个拼音是第几声？`,
          sub:`<span style="font-size:54px;font-weight:800">${TONE_MARK[t]+v}</span>`,
          options:['第一声','第二声','第三声','第四声'], answer:['第一声','第二声','第三声','第四声'][t-1],
          explain:`${TONE_MARK[t]+v} 是${['一','二','三','四'][t-1]}声。`});
      }
      return out;
    }},

  { id:'c-initial', title:'Initials 声母认读', emoji:'🔤',
    desc:'认识声母 b p m f d t n l …',
    make(){
      const out=[];
      for(let i=0;i<8;i++){
        const t=pick(INITIALS);
        const decoys=shuffle(INITIALS.filter(x=>x!==t)).slice(0,2);
        out.push({type:'choice', prompt:`请圈出声母：${t}`, sub:`下面哪个和上面一样？`,
          options:shuffle([t,...decoys]), answer:t, explain:`声母 ${t} 要认得它的形状。`});
      }
      return out;
    }},

  { id:'c-final', title:'Finals 韵母认读', emoji:'🔡',
    desc:'认识韵母 a o e i u ai ei ao …',
    make(){
      const out=[];
      for(let i=0;i<8;i++){
        const t=pick(FINALS);
        const decoys=shuffle(FINALS.filter(x=>x!==t)).slice(0,2);
        out.push({type:'choice', prompt:`请圈出韵母：${t}`, sub:`下面哪个和上面一样？`,
          options:shuffle([t,...decoys]), answer:t, explain:`韵母 ${t} 要读得响亮。`});
      }
      return out;
    }},

  { id:'c-blend', title:'Blending 拼读练习', emoji:'🧩',
    desc:'声母+韵母，拼出一个音节',
    make(){
      const out=[];
      for(let i=0;i<8;i++){
        const ini=pick(['b','p','m','d','t','n','l','g','k','h']);
        const fin=pick(['a','o','e','i','u','an','en','ang']);
        const syl=ini+fin;
        const d1=(ini==='b'?'p':ini==='p'?'b':pick(['b','p','m']))+fin;
        const d2=ini+(fin==='a'?'o':fin==='o'?'a':pick(['a','o','e']));
        out.push({type:'choice', prompt:`拼一拼：${ini} + ${fin} = ?`, sub:`把声母和韵母连起来读`,
          options:shuffle([syl,d1,d2]), answer:syl, explain:`${ini} + ${fin} = ${syl}。`});
      }
      return out;
    }},

  { id:'c-char', title:'Characters 汉字拼音配对', emoji:'🇨🇳',
    desc:'给认识的汉字找正确的拼音',
    make(){
      const out=[];
      shuffle(CHARS).slice(0,8).forEach(ch=>{
        const decoys=shuffle(CHARS.filter(x=>x!==ch)).slice(0,2).map(x=>x.p);
        out.push({type:'choice', prompt:`这个字的拼音是？`,
          sub:`<span style="font-size:54px;font-weight:800">${ch.c}</span>`,
          speak:{text:ch.c,lang:'zh-CN'}, options:shuffle([ch.p,...decoys]), answer:ch.p,
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
