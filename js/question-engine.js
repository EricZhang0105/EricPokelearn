/* =========================================================
   统一出题引擎 v1（v19）
   ---------------------------------------------------------
   1) 出现过的题不再出现：每道题算一个稳定指纹（忽略选项顺序/图形），
      展示即记入存档 qSeen；组题时过滤。做错的题走错题本复习通道。
   2) 题库不够自动扩容：数学参数空间随难度放大；英文/中文用变体生成器
      造新题；阅读理解用模板生成新短文并持久化（存档里 extraPassages）。
   3) 一点一点变难：按每课累计答对题数算 difficulty 1–5，
      数字范围 / 词长 / 句子长度 / 短文长度逐级提升。
   ---------------------------------------------------------
   本文件必须在 js/storage.js、js/read-passages.js 之后，js/app.js 之前加载。
   ========================================================= */
(function(global){
'use strict';

/* ---------------- 稳定指纹 ---------------- */
function hash32(s){
  let h=0x811c9dc5;
  for(let i=0;i<s.length;i++){ h ^= s.charCodeAt(i); h=(h*0x01000193)>>>0; }
  return h.toString(36);
}
function stripTags(s){ return String(s||'').replace(/<[^>]*>/g,'').replace(/\s+/g,' ').trim(); }
/* 指纹只取"题干+答案+素材"，不取 options / visual / 随机干扰项，
   否则同一个单词换一组干扰项就会被当成新题（正是小朋友看到的重复）。 */
function qKey(q){
  if(!q) return null;
  if(q.type==='passage') return null;          // 短文卡是阅读素材，不参与去重
  if(q.qid) return String(q.qid);             // 阅读理解题：稳定 qid
  const raw=[q.type||'', stripTags(q.prompt), stripTags(q.sub), String(q.answer||''),
             (q.tiles||[]).join(' '), stripTags(q.title), stripTags(q.text),
             /* 数数/方块题的图形是题目本体：同样 5 个 🍎 和 5 个 ⭐ 是两道不同的题；
                visual 里没有随机干扰项，纳入指纹不会造成误判 */
             stripTags(q.visual).replace(/[✕]/g,'')].join('~');
  return 'h'+hash32(raw);
}

/* ---------------- 存档里的记录 ----------------
   qSeen     : { 指纹: 展示时间戳 }              —— 所有出过的题
   qMastered : { lessonId: 累计答对数 }          —— 用来推难度
   extraPassages : [ 自动生成的短文 ]            —— 题库真的变大且跟着存档走
   qGrown    : { lessonId: 已扩容次数 }          —— 统计用
------------------------------------------------ */
const MAX_SEEN = 6000;
function D(){
  if(typeof Store==='undefined' || !Store.data) return null;
  const d=Store.data;
  if(!d.qSeen || typeof d.qSeen!=='object') d.qSeen={};
  if(!d.qMastered || typeof d.qMastered!=='object') d.qMastered={};
  if(!d.qGrown || typeof d.qGrown!=='object') d.qGrown={};
  if(!Array.isArray(d.extraPassages)) d.extraPassages=[];
  return d;
}
function seenKeys(){ const d=D(); return d?Object.keys(d.qSeen):[]; }
function isSeen(key){ const d=D(); return !!(key && d && d.qSeen[key]); }
function markShown(q){
  const d=D(); if(!d) return false;
  const k=qKey(q); if(!k || d.qSeen[k]) return false;
  d.qSeen[k]=Date.now();
  const ks=Object.keys(d.qSeen);
  if(ks.length>MAX_SEEN){                    // 只留最近的，防止存档无限膨胀
    ks.sort((a,b)=>(d.qSeen[a]||0)-(d.qSeen[b]||0));
    ks.slice(0,ks.length-MAX_SEEN).forEach(x=>delete d.qSeen[x]);
  }
  return true;
}
function markMastered(lessonId){
  const d=D(); if(!d) return;
  d.qMastered[lessonId]=(Number(d.qMastered[lessonId])||0)+1;
}
function masteredOf(lessonId){ const d=D(); return d?(Number(d.qMastered[lessonId])||0):0; }
/* 每答对 12 题升一级，1→5 级；阅读课额外受 READ_LEVEL 影响 */
function difficultyFor(lessonId){
  const m=masteredOf(lessonId);
  return Math.max(1, Math.min(5, 1+Math.floor(m/12)));
}
const DIFF_LABEL={1:'入门',2:'进阶',3:'熟练',4:'挑战',5:'高手'};

/* ---------------- 工具 ---------------- */
function ri(a,b){ return Math.floor(Math.random()*(b-a+1))+a; }
function pick(a){ return a[ri(0,a.length-1)]; }
function shuffle(a){ a=a.slice(); for(let i=a.length-1;i>0;i--){const j=ri(0,i);[a[i],a[j]]=[a[j],a[i]];} return a; }
function numOptions(ans,min,max){
  const s=new Set([ans]); let g=0;
  while(s.size<4 && g++<60){ const d=ans+ri(-4,4); if(d>=min&&d<=max&&d!==ans) s.add(d); }
  while(s.size<4){ s.add(Math.max(min,ans+(s.size-1)+1)); }
  return shuffle([...s]).map(String);
}
function save(){ if(typeof Store!=='undefined' && Store.data && Store.save) Store.save(); }

/* =========================================================
   自动扩容 A：数学 —— 数字范围随难度放大，天然无限
   ========================================================= */
function mathExpand(lessonId, level, need, spread){
  /* spread：同一课连续扩容时逐轮放大数字范围。
     原本固定 cap=20 时，原题库和扩容题共用同一批 ~90 个 (a,b) 组合，
     刷完后再扩容只是重摇旧组合 → 会摇出 0 道新题。逐轮放大后空间持续变新，
     也正好实现「题库越往后题目越难」。 */
  const cap = 20 + (level-1)*10 + (Number(spread)||0)*15;
  const out=[]; let guard=0;
  const add=(o)=>out.push(o);
  while(out.length<need && guard++<need*12){
    let a,b,ans,sub,prompt,explain;
    if(lessonId==='m-count'){
      const n=ri(1,cap); const e=pick(['🍎','⭐','🐟','🚗','🌸','🍌','🎈','🐣']);
      add({type:'choice',prompt:'How many?',
        visual:'<div class="q-visual">'+e.repeat(n)+'</div>',
        speak:{text:`Count the ${e}. How many?`,lang:'en-US'},
        options:numOptions(n,1,cap),answer:String(n),explain:`There are ${n} ${e}.`});
      continue;
    }
    if(lessonId==='m-bonds10'||lessonId==='m-bonds20'){
      a=ri(2,Math.max(3,Math.floor(cap/2))); b=ri(1,Math.max(2,cap-a)); ans=a+b;
      sub=`${a} + ${b} = ?`; prompt='Add the two parts'; explain=`${a} + ${b} = ${ans}.`;
    }else if(lessonId==='m-sub10'||lessonId==='m-sub20'){
      a=ri(Math.max(3,Math.floor(cap/3)),cap); b=ri(1,Math.max(1,a-1)); ans=a-b;
      sub=`${a} − ${b} = ?`; prompt='How many are left?'; explain=`${a} − ${b} = ${ans}.`;
    }else if(lessonId==='m-word'){
      const names=['Sam','Lily','Tom','May','Ben','Ann','Ken','Zoe','Mia','Tim','Ella','Leo','Jack','Sue','Max','Amy'];
      const goods=[['🍎','apples'],['🍪','cookies'],['🚗','cars'],['🐟','fish'],['⚽','balls'],['🌸','flowers'],['📚','books'],['🎈','balloons']];
      const n=pick(names), g=pick(goods);
      const plus=Math.random()<0.5;
      if(plus){ a=ri(2,Math.max(3,cap-2)); b=ri(1,Math.max(1,cap-a)); ans=a+b;
        sub=`${n} has ${a} ${g[0]}. ${n} gets ${b} more. How many ${g[1]} now?`;
      }else{ a=ri(Math.max(5,Math.floor(cap/2)),cap); b=ri(1,Math.max(1,a-2)); ans=a-b;
        sub=`${n} has ${a} ${g[0]}. ${n} gives ${b} away. How many ${g[1]} left?`;
      }
      prompt='Read the story'; explain=`${a} ${plus?'+':'−'} ${b} = ${ans}.`;
    }else{
      const plus=Math.random()<0.5;
      if(plus){ a=ri(1,cap-1); b=ri(1,Math.max(1,cap-a)); ans=a+b; sub=`${a} + ${b} = ?`; }
      else{ a=ri(Math.max(4,Math.floor(cap/2)),cap); b=ri(1,Math.max(1,a-1)); ans=a-b; sub=`${a} − ${b} = ?`; }
      prompt= lessonId==='m-add20'?'Add with Make-10 thinking':'Solve it';
      explain=`${a} ${plus?'+':'−'} ${b} = ${ans}.`;
    }
    add({type:'choice',prompt,sub,
      speak:{text:sub.replace('+','plus').replace('−','minus').replace('= ?','equals what?').replace(/\?/g,''),lang:'en-US'},
      options:numOptions(ans,0,cap*2),answer:String(ans),explain});
  }
  return out;
}

/* =========================================================
   自动扩容 B：英文词库（新词 + 变体题型）
   ========================================================= */
/* 常用 sight / CVC / 长词，按难度分档；没有本地录音时自动用设备语音朗读 */
const WORDS_L1=['I','see','my','we','go','to','the','a','and','is','it','in','on','up','at','me','you','he','she','has','can','like','play','run','sun','fun','big','red','hot','cat','dog','pen','cup','bus','box','hat','map','bag','bed','pig','fox','mum','dad'];
const WORDS_L2=['book','ball','fish','bird','cake','milk','rain','park','tree','ship','shop','duck','frog','jump','help','read','sing','walk','blue','green','yellow','small','happy','water','table','chair','house','school','friend','apple','orange'];
const WORDS_L3=['garden','market','birthday','rainbow','library','umbrella','morning','evening','together','because','favourite','picture','yellow','purple','animal','bicycle','teacher','playground','delicious','exciting','yesterday','tomorrow'];
function wordPool(level){
  let w=WORDS_L1.slice();
  if(level>=2) w=w.concat(WORDS_L2);
  if(level>=3) w=w.concat(WORDS_L3);
  if(typeof SIGHT!=='undefined') w=w.concat(SIGHT.filter(x=>x&&x.length<9));
  if(typeof CVC!=='undefined') w=w.concat(CVC);
  return [...new Set(w)];
}
function englishExpand(lessonId, level, need){
  // 扩容时不受当前难度限制：把所有分级词都拿出来造新题，难度由题目本身体现
  const pool=shuffle(wordPool(5)); const out=[];
  for(const w of pool){
    if(out.length>=need) break;
    if(lessonId==='e-spell'){
      out.push({type:'type',prompt:'Listen and spell the word 🔊',
        sub:'(Tap 🔊, then spell with the keyboard)',speak:{text:w,lang:'en-US'},
        answer:w,explain:`Spell: ${w.split('').join('-')}.`});
    }else if(lessonId==='e-phonics'){
      const first=w[0];
      const decoys=shuffle('bcdfghjklmnprstw'.split('').filter(x=>x!==first)).slice(0,2);
      out.push({type:'choice',prompt:'Which letter starts this word?',
        sub:`"${w}" — what is the first letter?`,
        speak:{text:w,lang:'en-US'},options:shuffle([first,...decoys]),answer:first,
        explain:`"${w}" starts with "${first}".`});
    }else if(lessonId==='e-sight'){
      const decoys=shuffle(pool.filter(x=>x!==w)).slice(0,2);
      out.push({type:'choice',prompt:'Listen, then tap the word 👂',
        sub:'(Tap 🔊 and choose the word you hear)',
        speak:{text:w,lang:'en-US'},options:shuffle([w,...decoys]),answer:w,
        explain:`The word is "${w}".`});
    }else if(lessonId==='e-build'){
      const subjects=['I','We','They','My friend','The children'];
      const verbs=['like','see','have','want','read','make'];
      const objs=shuffle(pool.filter(x=>x.length<8)).slice(0,6);
      const s=pick(subjects), v=pick(verbs), o=pick(objs);
      const tiles=[s,v,'a',o,'.'];
      out.push({type:'build',prompt:'Tap the words in order to build a sentence',
        sub:'Put the words in the right order',tiles:shuffle(tiles),answer:tiles.join(' '),
        speak:{text:tiles.join(' ').replace(/ \./g,'.'),lang:'en-US'}});
    }else if(lessonId==='e-grammar'){
      // 参数化：主语 × 句型，一次能造出 60+ 道互不相同的语法题
      const T=[
        {s:'___ has a dog.',o:['He','They','We'],a:'He',why:'单数用 He has'},
        {s:'There ___ two cats.',o:['is','are','am'],a:'are',why:'复数用 are'},
        {s:'I ___ a book.',o:['have','has','having'],a:'have',why:'I 后面用 have'},
        {s:'The ball is ___ the box.',o:['in','of','by'],a:'in',why:'在盒子里用 in'},
        {s:'___ apple is red.',o:['A','An','The'],a:'An',why:'元音开头用 An'},
        {s:'She ___ to school.',o:['go','goes','going'],a:'goes',why:'第三人称单数加 es'},
        {s:'We ___ happy.',o:['is','are','am'],a:'are',why:'We 后面用 are'},
        {s:'___ is your name?',o:['What','Who','Where'],a:'What',why:'问名字用 What'},
      ];
      const SUBJ=['I','You','We','They','He','She','My dad','The cat','The dogs','Tom and Ben'];
      const NOUNS=['book','ball','cake','kite','fish','hat','cup','bag'];
      const extra=[
        ...SUBJ.map(x=>({s:`${x} ___ happy.`,o:['am','is','are'],
          a:['I'].includes(x)?'am':['He','She','My dad','The cat'].includes(x)?'is':'are',
          why:x+' 后面用对应的 be 动词'})),
        ...SUBJ.map(x=>({s:`${x} ___ a ${pick(NOUNS)}.`,o:['have','has','having'],
          a:['He','She','My dad','The cat'].includes(x)?'has':'have',
          why:'第三人称单数用 has'})),
        ...NOUNS.map(n=>({s:`I can see two ___.`,o:[n+'s',n,n+'es'],a:n+'s',why:'两个以上用复数'})),
      ];
      T.concat(extra).forEach(t=>{
        if(out.length>=need) return;
        const full=t.s.replace('___',t.a);
        out.push({type:'choice',prompt:'Choose the correct word',
          sub:`<span class="gram-sent">${t.s.replace('___','<b>___</b>')}</span>`,
          speak:{text:full,lang:'en-US'},options:shuffle(t.o),answer:t.a,
          explain:`${full} — ${t.why}`});
      });
    }else{
      // 分级读物 / 其他：听音选词（复用词库）
      const decoys=shuffle(pool.filter(x=>x!==w)).slice(0,2);
      out.push({type:'choice',prompt:'Which word do you hear?',sub:'Tap 🔊, then choose',
        speak:{text:w,lang:'en-US'},options:shuffle([w,...decoys]),answer:w,
        explain:`The word is "${w}".`});
    }
  }
  return out;
}

/* =========================================================
   自动扩容 C：中文 —— 反向/变体问法，语音全部复用已有高质量录音
   ========================================================= */
function chineseExpand(lessonId, level, need){
  const out=[];
  const ini=(typeof ZH_INITIALS!=='undefined')?ZH_INITIALS:[];
  const fin=(typeof ZH_FINALS!=='undefined')?ZH_FINALS:[];
  const who=(typeof ZH_WHOLES!=='undefined')?ZH_WHOLES:[];
  const ble=(typeof ZH_BLENDS!=='undefined')?ZH_BLENDS:[];
  const chars=(typeof CHARS!=='undefined')?CHARS:[];
  const zcl=(typeof zhClip==='function')?zhClip:null;
  const toneCl=(typeof zhToneClip==='function')?zhToneClip:null;
  const toneMark=(typeof zhToneMark==='function')?zhToneMark:(s)=>s;

  if(lessonId==='c-initial'||lessonId==='c-final'||lessonId==='c-whole'){
    const list = lessonId==='c-initial'?ini : lessonId==='c-final'?fin : who;
    const kind = lessonId==='c-initial'?'initial':lessonId==='c-final'?'final':'whole';
    shuffle(list).forEach(t=>{
      if(out.length>=need) return;
      const decoys=shuffle(list.filter(x=>x.p!==t.p)).slice(0,2).map(x=>x.hz);
      out.push({type:'choice',canSpeak:true,kind,target:t.p,
        prompt:'🔊 听一听，这个音是哪个字？',
        sub:'点 🔊 再听一次，然后选出正确的示范字',
        speak:{text:t.hz,lang:'zh-CN',clip:zcl?zcl(kind,t.p):null,autoplay:true},
        options:shuffle([t.hz,...decoys]),answer:t.hz,
        hint:'先点 🔊 听一听，再对着 🎤 大声读出来',
        explain:`「${t.hz}」就是 ${t.p} 的示范音。`});
    });
  }else if(lessonId==='c-blend'){
    shuffle(ble).forEach(it=>{
      if(out.length>=need*2) return;
      const sylT=toneMark(it.syl,it.tone), finT=toneMark(it.fin,it.tone);
      // 变体 1：听音节，选声母
      out.push({type:'choice',prompt:`🔊 听一听：${sylT} 的声母是？`,
        sub:'点 🔊 再听一次，选出开头的声母',
        speak:{text:it.hz,lang:'zh-CN',clip:zcl?zcl('blend',it.syl):null,autoplay:true},
        options:shuffle([it.ini,...shuffle(ini.filter(x=>x.p!==it.ini)).slice(0,2).map(x=>x.p)]),
        answer:it.ini,explain:`${sylT} 的声母是 ${it.ini}。例如「${it.word}」。`});
      // 变体 2：听音节，选带调韵母
      if(out.length<need*2){
        out.push({type:'choice',prompt:`🔊 听一听：${sylT} 的韵母是？`,
          sub:'注意听声调，选出带调号的韵母',
          speak:{text:it.hz,lang:'zh-CN',clip:zcl?zcl('blend',it.syl):null,autoplay:true},
          options:shuffle([finT,...shuffle(fin.filter(x=>x.p!==it.fin)).slice(0,2)
            .map(x=>toneMark(x.p,it.tone))]),
          answer:finT,explain:`${it.ini} + ${finT} = ${sylT}。`});
      }
    });
  }else if(lessonId==='c-char'){
    shuffle(chars.map((c,i)=>Object.assign({},c,{i}))).forEach(ch=>{
      if(out.length>=need) return;
      const decoys=shuffle(chars.filter(x=>x.c!==ch.c)).slice(0,2).map(x=>x.c);
      out.push({type:'choice',prompt:'🔊 听一听，这是哪个字？',
        sub:'点 🔊 再听一次，然后选出正确的汉字',
        speak:{text:ch.c,lang:'zh-CN',clip:zcl?zcl('char',ch.i):null,autoplay:true},
        options:shuffle([ch.c,...decoys]),answer:ch.c,
        explain:`「${ch.c}」读 ${ch.p}。`});
    });
  }else if(lessonId==='c-tone'){
    const names=['第一声','第二声','第三声','第四声'];
    const T=(typeof ZH_TONES!=='undefined')?ZH_TONES:[];
    shuffle(T).forEach(g=>{
      for(let t=1;t<=4;t++){
        if(out.length>=need) return;
        const py=g.py[t-1];
        out.push({type:'choice',prompt:`看拼音，选出「${g.hz[t-1]}」的声调`,
          sub:`<span class="tone-base">${py}</span><div class="tone-tip">点 🔊 听一听再选</div>`,
          speak:{text:g.hz[t-1],lang:'zh-CN',clip:toneCl?toneCl(g.base,t):null,autoplay:true},
          options:names,optionMarks:['—','↗','∨','↘'],answer:names[t-1],
          explain:`「${g.hz[t-1]}」${py} 是${names[t-1]}。`});
      }
    });
  }
  // 通用拓展：用已有高质量录音的拼读音节，造「听音节选声母 / 韵母 / 声调 / 示范字」
  // 四种题型 × 56 个音节 = 200+ 道新题，中文字库再也不会两套就刷完。
  if(out.length<need && ble.length && zcl){
    const toneName=(typeof zhToneName==='function')?zhToneName:(t)=>'第'+t+'声';
    const names=['第一声','第二声','第三声','第四声'];
    shuffle(ble).forEach(it=>{
      const clip=zcl('blend',it.syl);
      const iniOpts=shuffle([it.ini,...shuffle(ini.filter(x=>x.p!==it.ini)).slice(0,2).map(x=>x.p)]);
      const finOpts=shuffle([it.fin,...shuffle(fin.filter(x=>x.p!==it.fin)).slice(0,2).map(x=>x.p)]);
      const hzOpts=shuffle([it.hz,...shuffle(ble.filter(x=>x.hz!==it.hz)).slice(0,2).map(x=>x.hz)]);
      const variants=[
        {prompt:`🔊 听一听，${it.syl} 的声母是？`,sub:'选出开头的声母',options:iniOpts,answer:it.ini,
         explain:`${it.syl} 的声母是 ${it.ini}。`},
        {prompt:`🔊 听一听，${it.syl} 的韵母是？`,sub:'选出后面的韵母',options:finOpts,answer:it.fin,
         explain:`${it.syl} 的韵母是 ${it.fin}。`},
        {prompt:`🔊 听一听，${it.syl} 是第几声？`,sub:'一声平、二声扬、三声拐、四声降',
         options:names,answer:names[(it.tone||1)-1],
         explain:`${it.syl} 是${toneName(it.tone||1)}。`},
        {prompt:`🔊 听一听，这是哪个字？`,sub:`音节 ${it.syl} · 选出对应的汉字`,
         options:hzOpts,answer:it.hz,explain:`${it.syl} 可以写作「${it.hz}」，例如「${it.word}」。`},
      ];
      shuffle(variants).forEach(v=>{
        if(out.length>=need) return;
        out.push({type:'choice',prompt:v.prompt,sub:v.sub,
          speak:{text:it.hz,lang:'zh-CN',clip,autoplay:true},
          options:v.options,answer:v.answer,explain:v.explain});
      });
    });
  }
  return out.slice(0,Math.max(need,40));
}

/* =========================================================
   自动扩容 D：阅读理解 —— 程序化生成新短文（越往后越长）
   生成结果写进存档，题库是真的变大，并且跟着云同步一起走
   ========================================================= */
const STORY_NAMES=['Sam','Lily','Tom','May','Ben','Ann','Ken','Zoe','Mia','Tim','Ella','Leo','Jack','Sue','Max','Amy','Nina','Rex'];
const STORY_PETS=[['cat','🐱'],['dog','🐶'],['bird','🐦'],['fish','🐟'],['rabbit','🐰'],['duck','🦆']];
const STORY_COLORS=['red','blue','green','yellow','pink','black','white'];
const STORY_PLACES=['park','garden','school','shop','farm','beach','library'];
const STORY_THINGS=['a big tree','a small ball','a red bus','a blue kite','a little frog','a yellow flower'];
const STORY_FEEL=['happy','glad','excited','proud'];
function makeStory(level, seed){
  const n=pick(STORY_NAMES), pet=pick(STORY_PETS), color=pick(STORY_COLORS);
  const place=pick(STORY_PLACES), thing=pick(STORY_THINGS), feel=pick(STORY_FEEL);
  const s=[];
  s.push(`${n} has a ${color} ${pet[0]}.`);
  s.push(`The ${pet[0]} likes to sit in the sun.`);
  s.push(`${n} can play with the ${pet[0]}.`);
  s.push(`${n} is ${feel}.`);
  if(level>=2){
    s.push(`One day ${n} and the ${pet[0]} go to the ${place}.`);
    s.push(`They see ${thing} there.`);
  }
  if(level>=3){
    s.push(`"Look at that!" says ${n}.`);
    s.push(`The ${pet[0]} runs to it and comes back with a big smile.`);
    s.push(`They stay at the ${place} until the sun goes down.`);
    s.push(`It is the best day for ${n} and the ${pet[0]}.`);
  }
  const text=s.join(' ');
  const qs=[
    {q:`What does ${n} have?`,o:[`a ${color} ${pet[0]}`,'a big bus','a toy box'],a:`a ${color} ${pet[0]}`},
    {q:`What color is the ${pet[0]}?`,o:[color,pick(STORY_COLORS.filter(x=>x!==color)),'purple'],a:color},
    {q:`Where does the ${pet[0]} like to sit?`,o:['in the sun','in a box','on a bed'],a:'in the sun'},
    {q:`Is ${n} ${feel}?`,o:['Yes','No'],a:'Yes'},
  ];
  if(level>=2){
    qs.push({q:`Where do they go?`,o:[`the ${place}`,'the zoo','the market'],a:`the ${place}`});
    qs.push({q:`What do they see there?`,o:[thing,'a big cake','a red hat'],a:thing});
  }
  const shortQ=level>=3
    ? {q:`${n} has a ___ ${pet[0]}.`,short:true,a:color,accept:[color],hint:color[0]+' _ _ _'}
    : {q:`${n} has a ___ ${pet[0]}.`,short:true,a:color,accept:[color],hint:color[0]+' _ _ _'};
  // 4 选择 + 1 简答；level 越高选择题越多，难度一点点上来
  const chosen=shuffle(qs).slice(0,4);
  const all=shuffle(chosen.concat([shortQ]));
  return {id:'rp-auto-'+hash32(text).slice(0,10),level,
    title:`${n} and the ${pet[0][0].toUpperCase()+pet[0].slice(1)}`,
    visual:pet[1],text,qs:all};
}
function growPassages(level, count){
  const d=D(); if(!d || typeof READ_PASSAGES==='undefined') return [];
  const seen=new Set(READ_PASSAGES.map(p=>p.id));
  const made=[]; let guard=0;
  while(made.length<count && guard++<count*40){
    const st=makeStory(level, guard);
    if(seen.has(st.id)) continue;
    seen.add(st.id);
    // 每篇固定 5 题（4 选择 + 1 简答），qid 按 qs 顺序生成且永不改变
    const fixed=[...st.qs.filter(x=>!x.short).slice(0,4), ...st.qs.filter(x=>x.short).slice(0,1)];
    st.qs=fixed;
    st.qs.forEach((x,i)=>{ x.qid=st.id+'#'+(i+1); });
    READ_PASSAGES.push(st);
    d.extraPassages.push({id:st.id,level:st.level,title:st.title,visual:st.visual,text:st.text,qs:st.qs});
    if(d.extraPassages.length>240) d.extraPassages.shift();   // 存档体积封顶
    made.push(st);
  }
  if(made.length){ const dd=D(); dd.qGrown['e-read']=(Number(dd.qGrown['e-read'])||0)+made.length; save(); }
  return made;
}
/* 把一篇短文转成「短文卡 + 题目」的题目块（扩容题也要能直接用） */
function passageBlock(p){
  const out=[{type:'passage',title:p.title,text:p.text,visual:p.visual,level:p.level,
              speak:{text:p.text,lang:'en-US'}}];
  p.qs.forEach(x=>{
    if(x.short){
      out.push({type:'type',short:true,prompt:'Short answer',sub:x.q,hint:x.hint,
        accept:x.accept,qid:x.qid,speak:{text:x.q,lang:'en-US'},answer:x.a,
        explain:`Answer: ${x.a}.`});
    }else{
      out.push({type:'choice',prompt:'Question',sub:x.q,qid:x.qid,
        speak:{text:x.q,lang:'en-US'},options:shuffle(x.o),answer:x.a,
        explain:`Answer: ${x.a}.`});
    }
  });
  return out;
}
/* 开机把存档里自动生成的短文注册回题库（幂等） */
function bootExtraPassages(){
  const d=D(); if(!d || typeof READ_PASSAGES==='undefined') return 0;
  const have=new Set(READ_PASSAGES.map(p=>p.id));
  let n=0;
  d.extraPassages.forEach(p=>{
    if(!p || !p.id || have.has(p.id) || !Array.isArray(p.qs)) return;
    p.qs.forEach((x,i)=>{ if(!x.qid) x.qid=p.id+'#'+(i+1); });
    READ_PASSAGES.push(p); have.add(p.id); n++;
  });
  return n;
}

/* =========================================================
   组题：反复摇 → 过滤 seen → 不够就扩容 → 再不够按最久未见兜底
   ========================================================= */
function expandFor(lessonId, level, need, missing, spread){
  if(lessonId.startsWith('m-')) return mathExpand(lessonId,level,need,spread);
  if(lessonId.startsWith('c-')) return chineseExpand(lessonId,level,need);
  if(lessonId==='e-read' || lessonId.startsWith('r-')){
    // 阅读/分级读物刷完 → 现场生成新短文（越往后越长），直接把题目块交给组题流程
    const fresh=growPassages(Math.max(1,Math.min(3,level)),Math.max(1,Math.ceil((missing||5)/5)));
    const out=[];
    fresh.forEach(p=>passageBlock(p).forEach(q=>out.push(q)));
    return out;
  }
  return englishExpand(lessonId,level,need);
}
function freshQuestions(lesson,lessonId,slots,opts){
  const level=difficultyFor(lessonId);
  opts=Object.assign({},opts||{},{level});
  // 数学：把难度写回生成器的数字范围
  if(typeof setMathLevel==='function' && lessonId.startsWith('m-')) setMathLevel(level);
  // 阅读：出过（不只答对）的题也不再出现
  if(lessonId==='e-read'){
    const seenQids=seenKeys().filter(k=>k.indexOf('#')>0);
    opts.doneIds=[...new Set((opts.doneIds||[]).concat(seenQids))];
    if(typeof readLevelFor==='function'){
      opts.level=Math.max(opts.level||1, readLevelFor(opts.doneIds.length));
    }
  }
  const picked=[], local=new Set();
  const take=(raw)=>{
    let n=0;
    (raw||[]).forEach(q=>{
      if(picked.length>=slots) return;
      if(q.type==='passage'){
        // 短文卡是素材：不跨套去重，但同一套里只放一次（否则一篇文章会刷屏）
        const pk='P:'+hash32(stripTags(q.title)+stripTags(q.text));
        if(local.has(pk)) return;
        local.add(pk); picked.push(q); return;
      }
      const k=qKey(q);
      if(!k || isSeen(k) || local.has(k)) return;
      local.add(k); picked.push(q); n++;
    });
    return n;
  };
  // 第一轮：正常题库反复摇，最多 12 次
  for(let i=0;i<12 && picked.length<slots;i++){
    take(lesson.make(slots,opts));
  }
  // 第二轮：题库见底 → 自动扩容（真的增加新题），可连续扩几轮；
  // 每轮把 spread 加大，数学参数空间随轮次变宽，保证不会在同一批旧组合里空转。
  let grown=0;
  for(let round=0; round<5 && picked.length<slots; round++){
    const batch=expandFor(lessonId,level,Math.max(40,slots*5),slots-picked.length,round);
    if(!batch || !batch.length) continue;
    const n=take(batch);
    if(n){
      grown+=n;
      const d=D(); if(d) d.qGrown[lessonId]=(Number(d.qGrown[lessonId])||0)+1;
    }
  }
  if(grown && typeof toastMsg==='function'){
    toastMsg(`📚 题库自动上新 ${grown} 道题 · 难度 ${DIFF_LABEL[level]}`);
  }
  // 第三轮：极端兜底。旧实现取「全局最久未见」的指纹，那些指纹多半属于别的课，
  // 本课摇出来的题一个都不在白名单里 → 会返回 0 题（空套题）。
  // 现在改为：从本课反复摇出候选 + 再扩一轮更大范围的新题，
  // 按「没出过优先、其次最久未见」排序补齐，保证永远凑满一套。
  if(picked.length<slots){
    const d=D(), cand=[], once=new Set();
    const collect=(arr)=>(arr||[]).forEach(q=>{
      if(!q || q.type==='passage') return;
      const k=qKey(q);
      if(!k || local.has(k) || once.has(k)) return;
      once.add(k); cand.push({q,k,t:(d&&d.qSeen[k])||0});
    });
    for(let i=0;i<20;i++) collect(lesson.make(slots,opts));
    if(lessonId!=='e-read' && !lessonId.startsWith('r-')){
      collect(expandFor(lessonId,level,Math.max(80,slots*8),slots-picked.length,6));
    }
    cand.sort((a,b)=>a.t-b.t);        // t=0 表示从未出现，最优先
    cand.forEach(x=>{
      if(picked.length>=slots) return;
      local.add(x.k); picked.push(x.q);
    });
  }
  return {items:picked.slice(0,slots).map(q=>({q,isReview:false})), level, grown};
}

/* ---------------- 统计（课程卡显示） ---------------- */
function stats(lessonId){
  const d=D();
  const all=seenKeys();
  return { seen:all.length, mastered:masteredOf(lessonId),
           level:difficultyFor(lessonId), label:DIFF_LABEL[difficultyFor(lessonId)],
           grown:(d&&Number(d.qGrown[lessonId]))||0,
           extraPassages:(d&&d.extraPassages.length)||0 };
}

global.QEngine={ qKey,markShown,markMastered,isSeen,seenKeys,difficultyFor,
                 difficultyLabel:DIFF_LABEL,freshQuestions,stats,
                 growPassages,bootExtraPassages,makeStory,
                 /* 供 Node 回归测试 */
                 _internal:{hash32,mathExpand,englishExpand,chineseExpand,wordPool} };
})(typeof window!=='undefined'?window:globalThis);
