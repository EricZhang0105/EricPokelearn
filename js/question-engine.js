/* =========================================================
   统一出题引擎 v2（v30）
   ---------------------------------------------------------
   1) 出现过的题绝不再出现：所有题在组题时盖上一个稳定 qid，
      指纹只取题目本质（题干/答案/排序后的词块），忽略随机选项、
      词块顺序、配图用哪只宝可梦。展示即记入 qSeen，组题时过滤。
   2) 每节课一个 ≥200 道确定性题的大题库（js/question-bank.js）；
      库存见底时 spread 逐轮放大参数空间自动造新题，qid 保证不与历史重复。
      阅读理解则由短文生成器现场写新短文并持久化进 extraPassages。
   3) 一点一点变难：每答对 8 题升一级（1–5），候选题按 tier 与当前
      难度贴近程度排序，数字范围 / 词长 / 句长 / 短文长度同步上升。
   ---------------------------------------------------------
   加载顺序：storage.js / read-passages.js / question-bank.js 之后，app.js 之前。
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
/* 稳定指纹（v30 重写）
   ---------------------------------------------------------
   旧实现的两个致命问题，正是「More questions 又出刚答过的题」的根因：
   1) 把 (q.tiles||[]).join(' ') 原样写进指纹，而句子建构题的 tiles 是
      每次 shuffle 的 → 同一道 "I see a dog." 每套都是不同的指纹，qSeen 完全失效。
   2) 把宠物 id（petKey）写进指纹 → "3 + 4 = ?" 换一只宝可梦就算新题，
      孩子看到题干一模一样，自然觉得重复。
   现在：指纹只取题目本质（题型/题干/答案/词块排序后），随机选项、词块顺序、
   配图用哪只宝可梦一律不参与；所有题在组题时注入稳定 qid（见 normalizeQid）。 */
/* 题目对象是缓存复用的，指纹只算一次挂在对象上（不可枚举 → 不进存档）。
   数学题的 visual 是几十张宝可梦图的 HTML，不缓存会拖慢每次组题。 */
function setHidden(q,k,v){
  try{ Object.defineProperty(q,k,{value:v,enumerable:false,configurable:true}); }
  catch(e){ q[k]=v; }
  return v;
}
function normRaw(q){
  if(q.__nr!==undefined) return q.__nr;
  return setHidden(q,'__nr',[q.type||'', stripTags(q.prompt), stripTags(q.sub),
    String(q.answer||''),(q.tiles||[]).slice().sort().join(' '),
    stripTags(q.title), stripTags(q.text),
    stripTags(q.visual).replace(/[✕]/g,'')].join('~'));
}
/* 旧版指纹：仅用于兼容已经存进 qSeen 的老存档，不参与新题判定 */
function legacyKey(q){
  if(!q || q.type==='passage') return null;
  if(q.__lk!==undefined) return q.__lk;
  const raw=[q.type||'', stripTags(q.prompt), stripTags(q.sub), String(q.answer||''),
             (q.tiles||[]).join(' '), stripTags(q.title), stripTags(q.text),
             stripTags(q.visual).replace(/[✕]/g,'')].join('~');
  return setHidden(q,'__lk','h'+hash32(raw + (q.petKey ? '|pet:'+q.petKey : '')));
}
function qKey(q){
  if(!q) return null;
  if(q.type==='passage') return null;          // 短文卡是阅读素材，不参与去重
  if(q.qid) return String(q.qid);             // 阅读题 / 题库题：稳定 qid
  return 'h'+hash32(normRaw(q));
}
/* 内容指纹：只认「孩子看到的题干与答案」。
   哪怕两道题来自不同题库、qid 不同，只要内容一样也视为同一道，
   彻底杜绝「换个 ID 又把刚做过的题端上来」。 */
function contentKey(q){
  if(!q) return null;
  if(q.__ck!==undefined) return q.__ck;
  return setHidden(q,'__ck','n:'+hash32(normRaw(q)));
}
/* 组题时给每道题盖上稳定 qid：题库题已经有，老题库（lesson.make）现补。
   阅读题的 qid 关联 readDone，必须原样保留。 */
function normalizeQid(q,lessonId){
  if(!q || q.type==='passage') return q;
  const cur=String(q.qid||'');
  if(cur.indexOf('#')>0) return q;   // 阅读题 qid 关联 readDone / 短文，必须原样保留
  /* 其余一律按「题目本质」重算：手写题库与统一题库里内容相同的题，
     会拿到同一个 qid，只可能出现一次（这正是 More questions 不重复的关键）。 */
  q.qid='b:'+lessonId+':'+hash32(normRaw(q));
  return q;
}

/* ---------------- 存档里的记录 ----------------
   qSeen     : { 指纹: 展示时间戳 }              —— 所有出过的题
   qMastered : { lessonId: 累计答对数 }          —— 用来推难度
   extraPassages : [ 自动生成的短文 ]            —— 题库真的变大且跟着存档走
   qGrown    : { lessonId: 已扩容次数 }          —— 统计用
------------------------------------------------ */
const MAX_SEEN = 60000;   // 已出过的题指纹上限（提高 5 倍：刷再多题也不会因裁剪而把答对过的题重新端上来）
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
/* 新题指纹 + 旧版指纹双查：既保证新体系精确去重，也兼容老存档 */
function isSeenQ(q){
  const d=D(); if(!d || !q) return false;
  const k=qKey(q); if(k && d.qSeen[k]) return true;
  const c=contentKey(q); if(c && d.qSeen[c]) return true;  // 同内容不同 ID 也拦住
  const old=legacyKey(q); return !!(old && old!==k && d.qSeen[old]);
}
function markShown(q){
  const d=D(); if(!d) return false;
  const k=qKey(q); if(!k || d.qSeen[k]) return false;
  const now=Date.now(), old=legacyKey(q), c=contentKey(q);
  d.qSeen[k]=now;
  if(c && !d.qSeen[c]) d.qSeen[c]=now;                     // 内容指纹
  if(old && old!==k && !d.qSeen[old]) d.qSeen[old]=now;   // 兼容旧指纹
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
/* 每答对 16 题升一级，1→5 级（约 6 套题升一档，难度一点点上来）；
   阅读课额外受 READ_LEVEL 影响 */
function difficultyFor(lessonId){
  const m=masteredOf(lessonId);
  return Math.max(1, Math.min(5, 1+Math.floor(m/16)));
}
const DIFF_LABEL={1:'入门',2:'进阶',3:'熟练',4:'挑战',5:'高手'};
/* 英文/数学科目全英文：题库扩容提示用这一套（中文科目仍用上面的中文标签） */
const DIFF_LABEL_EN={1:'Starter',2:'Growing',3:'Confident',4:'Challenging',5:'Expert'};

/* ---------------- 工具 ---------------- */
function ri(a,b){ return Math.floor(Math.random()*(b-a+1))+a; }
function pick(a){ return a[ri(0,a.length-1)]; }
function shuffle(a){ a=a.slice(); for(let i=a.length-1;i>0;i--){const j=ri(0,i);[a[i],a[j]]=[a[j],a[i]];} return a; }
function numOptions(ans,min,max){
  const s=new Set([String(ans)]); let g=0;
  while(s.size<4 && g++<60){ const d=Number(ans)+ri(-4,4); if(d>=min&&d<=max) s.add(String(d)); }
  for(let k=1;k<=20&&s.size<4;k++){
    s.add(String(Number(ans)-k)); if(s.size<4) s.add(String(Number(ans)+k));
  }
  let v=Number(ans)+1;
  while(s.size<4){ s.add(String(v)); v++; }   // v 严格递增，必定收敛
  return shuffle([...s]);
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
    let pet=null, visual='', pkey='';
    if(lessonId==='m-count'){
      const n=ri(1,cap); pet=mathPet();
      add({type:'choice',prompt:'How many?',
        visual:petGroup(n,pet), petKey:petKey(pet),
        speak:{text:`Count the ${pet.name}. How many?`,lang:'en-US'},
        options:numOptions(n,1,cap),answer:String(n),
        explain:`There are ${n} ${pet.name}.`});
      continue;
    }
    if(lessonId==='m-bonds10'||lessonId==='m-bonds20'){
      a=ri(2,Math.max(3,Math.floor(cap/2))); b=ri(1,Math.max(2,cap-a)); ans=a+b;
      sub=`${a} + ${b} = ?`; prompt='Add the two parts'; explain=`${a} + ${b} = ${ans}.`;
      pet=mathPet(); visual=petVisual(a,b,'+',pet); pkey=petKey(pet);
    }else if(lessonId==='m-sub10'||lessonId==='m-sub20'){
      a=ri(Math.max(3,Math.floor(cap/3)),cap); b=ri(1,Math.max(1,a-1)); ans=a-b;
      sub=`${a} − ${b} = ?`; prompt='How many are left?'; explain=`${a} − ${b} = ${ans}.`;
      pet=mathPet(); visual=petVisual(a,b,'-',pet); pkey=petKey(pet);
    }else if(lessonId==='m-word'){
      const names=['Sam','Lily','Tom','May','Ben','Ann','Ken','Zoe','Mia','Tim','Ella','Leo','Jack','Sue','Max','Amy'];
      const n=pick(names); pet=pick(MATH_PETS);
      const plus=Math.random()<0.5;
      if(plus){ a=ri(2,Math.max(3,cap-2)); b=ri(1,Math.max(1,cap-a)); ans=a+b;
        sub=`${n} has ${a} ${pet.name}. ${n} gets ${b} more. How many ${pet.name} now?`;
      }else{ a=ri(Math.max(5,Math.floor(cap/2)),cap); b=ri(1,Math.max(1,a-2)); ans=a-b;
        sub=`${n} has ${a} ${pet.name}. ${n} gives ${b} away. How many ${pet.name} left?`;
      }
      prompt='Read the story'; explain=`${a} ${plus?'+':'−'} ${b} = ${ans}.`;
      visual=petVisual(a,b,plus?'+':'-',pet); pkey=petKey(pet);
    }else{
      const plus=Math.random()<0.5;
      if(plus){ a=ri(1,cap-1); b=ri(1,Math.max(1,cap-a)); ans=a+b; sub=`${a} + ${b} = ?`; }
      else{ a=ri(Math.max(4,Math.floor(cap/2)),cap); b=ri(1,Math.max(1,a-1)); ans=a-b; sub=`${a} − ${b} = ?`; }
      prompt= lessonId==='m-add20'?'Add with Make-10 thinking':'Solve it';
      explain=`${a} ${plus?'+':'−'} ${b} = ${ans}.`;
      pet=mathPet(); visual=petVisual(a,b,plus?'+':'-',pet); pkey=petKey(pet);
    }
    add({type:'choice',prompt,sub,visual,petKey:pkey,
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
  // v32 发音辨析：扩容直接取 PHONIC 全量题集，不再造「问首字母」旧题
  if(lessonId==='e-phonics' && typeof PHONIC!=='undefined'){
    return PHONIC.fullSet().slice(0,Math.max(need,50));
  }
  // 扩容时不受当前难度限制：把所有分级词都拿出来造新题，难度由题目本身体现
  const pool=shuffle(wordPool(5)); const out=[];
  for(const w of pool){
    if(out.length>=need) break;
    if(lessonId==='e-spell'){
      out.push({type:'type',prompt:'Listen and spell the word 🔊',
        sub:'(Tap 🔊, then spell with the keyboard)',speak:{text:w,lang:'en-US'},
        answer:w,explain:`Spell: ${w.split('').join('-')}.`});
    }else if(lessonId==='e-phonics'){
      // PHONIC 未加载时的兜底，也应是读音题而非「问首字母」；通常上面已提前返回
      continue;
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
        speak:{text:tiles.join(' ').replace(/ \./g,'.'),lang:'en-US',forceAuto:true}});
    }else if(lessonId==='e-grammar'){
      // 参数化：主语 × 句型，一次能造出 60+ 道互不相同的语法题
      const T=[
        {s:'___ has a dog.',o:['He','They','We'],a:'He',why:'One person takes "He has".'},
        {s:'There ___ two cats.',o:['is','are','am'],a:'are',why:'Two cats is plural, so we use "are".'},
        {s:'I ___ a book.',o:['have','has','having'],a:'have',why:'Use "have" with I.'},
        {s:'The ball is ___ the box.',o:['in','of','by'],a:'in',why:'Use "in" for something inside the box.'},
        {s:'___ apple is red.',o:['A','An','The'],a:'An',why:'Use "An" before a vowel sound.'},
        {s:'She ___ to school.',o:['go','goes','going'],a:'goes',why:'With she we add -es: she goes.'},
        {s:'We ___ happy.',o:['is','are','am'],a:'are',why:'Use "are" with we.'},
        {s:'___ is your name?',o:['What','Who','Where'],a:'What',why:'We ask a name with "What".'},
      ];
      const SUBJ=['I','You','We','They','He','She','My dad','The cat','The dogs','Tom and Ben'];
      const NOUNS=['book','ball','cake','kite','fish','hat','cup','bag'];
      const extra=[
        ...SUBJ.map(x=>({s:`${x} ___ happy.`,o:['am','is','are'],
          a:['I'].includes(x)?'am':['He','She','My dad','The cat'].includes(x)?'is':'are',
          why:`Use the be verb that matches "${x}".`})),
        ...SUBJ.map(x=>({s:`${x} ___ a ${pick(NOUNS)}.`,o:['have','has','having'],
          a:['He','She','My dad','The cat'].includes(x)?'has':'have',
          why:'One person or animal takes "has"; more than one takes "have".'})),
        ...NOUNS.map(n=>({s:`I can see two ___.`,o:[n+'s',n,n+'es'],a:n+'s',why:'Add -s for more than one.'})),
      ];
      T.concat(extra).forEach(t=>{
        if(out.length>=need) return;
        const full=t.s.replace('___',t.a);
        out.push({type:'choice',prompt:'Choose the correct word',
          sub:`<span class="gram-sent">${t.s.replace('___','<b>___</b>')}</span>`,
          speak:{text:t.s.replace('___','blank'),lang:'en-US',forceAuto:true},
          answerSpeak:{text:full,lang:'en-US'},
          options:shuffle(t.o),answer:t.a,
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
    if(d.extraPassages.length>1200) d.extraPassages.shift();  // 存档体积封顶（提高：可长期积累新题不重复）
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
   阅读题库：确保「没做过的题」始终 ≥200 道，用完自动写新短文进存档
   ========================================================= */
function freshPassageCount(doneIds){
  if(typeof READ_PASSAGES==='undefined') return 0;
  const done=new Set(doneIds||[]);
  return READ_PASSAGES.reduce((n,p)=>n+(p.qs||[]).filter(x=>!done.has(x.qid)).length,0);
}
function ensurePassagePool(level,minFresh,doneIds){
  if(typeof growPassages!=='function') return 0;
  const lv=[1,2,3].filter(x=>x<=Math.max(1,Math.min(3,level)));
  let have=freshPassageCount(doneIds), made=0, guard=0;
  while(have<minFresh && guard++<10){
    const need=Math.min(45,Math.ceil((minFresh-have)/5));
    /* 混合难度生成：短句 → 小段落 → 长故事，越读越长 */
    const useLv=lv[guard%lv.length]||1;
    const fresh=growPassages(useLv,need);
    if(!fresh.length) break;
    fresh.forEach(p=>{ made++; have+=(p.qs||[]).filter(x=>!(doneIds||[]).includes(x.qid)).length; });
  }
  return made;
}

/* =========================================================
   组题 v30：手写题库 + 确定性大题库 → 严格去重 → 按难度抽取 → 自动扩容
   ========================================================= */
function expandFor(lessonId, level, need, missing, spread){
  if(lessonId.startsWith('m-')) return mathExpand(lessonId,level,need,spread);
  if(lessonId.startsWith('c-')) return chineseExpand(lessonId,level,need);
  if(lessonId==='e-read' || lessonId.startsWith('r-')){
    const fresh=growPassages(Math.max(1,Math.min(3,level)),Math.max(1,Math.ceil((missing||5)/5)));
    const out=[];
    fresh.forEach(p=>passageBlock(p).forEach(q=>out.push(q)));
    return out;
  }
  return englishExpand(lessonId,level,need);
}
/* 按难度给候选题打分：tier 越接近当前 level 越靠前，
   超过 level+1 的题先压后（难度一点点上来，不会一进门就是超纲题）。 */
function byDifficulty(bank,level){
  return bank.map(q=>{
    const t=Number(q.tier)||1, gap=t-level;
    /* 低于当前难度的题压后（简单题做完就别再回头刷），
       超纲两档以上的题也压后，保证「先熟练本级，再上难度」。 */
    const score=(gap>1?100:0)+(gap<0?60+(-gap)*8:gap*10)+Math.random()*9;
    return {q,score};
  }).sort((a,b)=>a.score-b.score).map(x=>x.q);
}
function freshQuestions(lesson,lessonId,slots,opts){
  const level=difficultyFor(lessonId);
  opts=Object.assign({},opts||{},{level});
  const isRead=lessonId==='e-read' || lessonId.indexOf('r-')===0;
  // 数学：把难度写回生成器的数字范围
  if(typeof setMathLevel==='function' && lessonId.indexOf('m-')===0) setMathLevel(level);
  // 阅读：出过（不只答对）的题也不再出现；题库常备 ≥200 道没做过的题
  if(isRead){
    const seenQids=seenKeys().filter(k=>k.indexOf('#')>0);
    opts.doneIds=Array.from(new Set((opts.doneIds||[]).concat(seenQids)));
    if(typeof readLevelFor==='function'){
      opts.level=Math.max(opts.level||1, readLevelFor(opts.doneIds.length));
    }
    ensurePassagePool(opts.level,240,opts.doneIds);
  }

  const picked=[], local=new Set(), localNorm=new Set();
  /* Phonics：同一套里尽量覆盖不同的音。旧实现按难度排序后同一个音
     (如 a-short) 连出多题，孩子看着就像重复。这里在合并各题源时再做
     一次「音」去重：每个 soundKey 一套里最多先出一题，库存不够才回退。 */
  const isPhonics = lessonId==='e-phonics';
  const usedSound=new Set();
  const take=(raw)=>{
    let n=0;
    (raw||[]).forEach(q=>{
      if(!q || picked.length>=slots) return;
      if(q.type==='passage'){
        // 短文卡是素材：不跨套去重，但同一套里只放一次（否则一篇文章会刷屏）
        const pk='P:'+hash32(stripTags(q.title)+stripTags(q.text));
        if(local.has(pk)) return;
        local.add(pk); picked.push(q); return;
      }
      normalizeQid(q,lessonId);
      const k=qKey(q), nr=contentKey(q);
      if(!k || isSeenQ(q) || local.has(k) || localNorm.has(nr)) return;
      if(isPhonics && q.soundKey){
        if(usedSound.has(q.soundKey)) return;   // 这个音本套已出过
        usedSound.add(q.soundKey);
      }
      local.add(k); localNorm.add(nr); picked.push(q); n++;
    });
    return n;
  };

  // 第一轮：保留手写题库的精选题（摇 3 次）
  for(let i=0;i<3 && picked.length<slots;i++) take(lesson.make(slots,opts));

  // 第二轮：统一题库（每课 ≥200 道确定性题）按难度抽取；
  // spread 逐轮放大参数空间 → 库存见底时自动造出「以前从没出过」的新题。
  let grown=0;
  for(let round=0; round<8 && picked.length<slots; round++){
    let bank=[];
    if(isRead){
      if(round>0) ensurePassagePool(opts.level,240+(round*20),opts.doneIds);
      const done=new Set(opts.doneIds||[]);
      const pool=(typeof READ_PASSAGES!=='undefined')?READ_PASSAGES:[];
      pool.filter(p=>(p.qs||[]).some(x=>!done.has(x.qid)))
        .forEach(p=>passageBlock(p).forEach(q=>bank.push(q)));
    }else if(typeof Bank!=='undefined' && Bank.build){
      bank=Bank.build(lessonId,level,round);
    }
    const n=take(byDifficulty(bank,level));
    if(n){
      grown+=n;
      const d=D(); if(d) d.qGrown[lessonId]=(Number(d.qGrown[lessonId])||0)+1;
    }
    // 题库文件缺失时的纯扩容兜底（老生成器）
    if(!n && !isRead){
      const n2=take(expandFor(lessonId,level,Math.max(60,slots*8),slots-picked.length,round+2));
      if(n2) grown+=n2;
    }
  }
  if(grown && typeof toastMsg==='function'){
    const zhLesson=/^c-/.test(String(lessonId||''));
    toastMsg(zhLesson
      ? `📚 题库自动上新 ${grown} 道题 · 难度 ${DIFF_LABEL[level]}`
      : `📚 ${grown} new questions added · Level ${DIFF_LABEL_EN[level]||level}`);
  }

  // 第三轮：极端兜底 —— 只用「从未出现过」的题补齐，绝不把做过的题再端上来。
  if(picked.length<slots){
    const cand=[], once=new Set();
    const collect=(arr)=>(arr||[]).forEach(q=>{
      if(!q || q.type==='passage') return;
      normalizeQid(q,lessonId);
      const k=qKey(q), nr=contentKey(q);
      if(!k || local.has(k) || once.has(k) || localNorm.has(nr) || isSeenQ(q)) return;
      once.add(k); cand.push({q,nr});
    });
    for(let i=0;i<12;i++) collect(lesson.make(slots,opts));
    if(!isRead){
      for(let s=8;s<14;s++) collect(
        (typeof Bank!=='undefined'&&Bank.build)?Bank.build(lessonId,level,s):expandFor(lessonId,level,120,slots,s));
    }else{
      ensurePassagePool(opts.level,300,opts.doneIds);
      if(typeof READ_PASSAGES!=='undefined') READ_PASSAGES.forEach(p=>collect(passageBlock(p)));
    }
    cand.forEach(x=>{
      if(picked.length>=slots) return;
      if(isPhonics && x.q.soundKey){
        if(usedSound.has(x.q.soundKey)) return;   // 兜底也保持音不重复
        usedSound.add(x.q.soundKey);
      }
      local.add(qKey(x.q)); localNorm.add(x.nr); picked.push(x.q);
    });
  }
  /* Phonics 兜底：音不够时放宽「音去重」，但仍必须是没出现过的新题，
     宁可同一音换个词/换题型，也不能把做过的题或题数不足交给孩子。 */
  if(isPhonics && picked.length<slots){
    const cand=[], once=new Set();
    const collect=(arr)=>(arr||[]).forEach(q=>{
      if(!q || q.type==='passage') return;
      normalizeQid(q,lessonId);
      const k=qKey(q), nr=contentKey(q);
      if(!k || local.has(k) || once.has(k) || localNorm.has(nr) || isSeenQ(q)) return;
      once.add(k); cand.push({q,nr});
    });
    for(let i=0;i<16;i++) collect(lesson.make(slots,opts));
    for(let s=6;s<16;s++) collect((typeof Bank!=='undefined'&&Bank.build)?Bank.build(lessonId,level,s):[]);
    cand.forEach(x=>{
      if(picked.length>=slots) return;
      local.add(qKey(x.q)); localNorm.add(x.nr); picked.push(x.q);
    });
  }
  return {items:picked.slice(0,slots).map(q=>({q,isReview:false})), level, grown,
          bankSize:(typeof Bank!=='undefined'&&Bank.capacity&&!isRead)
            ?Bank.capacity(lessonId,level,0).count:freshPassageCount(opts.doneIds)};
}

/* ---------------- 统计（课程卡显示） ---------------- */
function stats(lessonId){
  const d=D();
  const all=seenKeys();
  const isRead=lessonId==='e-read'||lessonId.indexOf('r-')===0;
  const bank=(typeof Bank!=='undefined'&&Bank.capacity&&!isRead)
    ? Bank.capacity(lessonId,difficultyFor(lessonId),0).count
    : freshPassageCount(all.filter(k=>k.indexOf('#')>0));
  return { seen:all.length, mastered:masteredOf(lessonId),
           level:difficultyFor(lessonId), label:DIFF_LABEL[difficultyFor(lessonId)],
           labelEn:DIFF_LABEL_EN[difficultyFor(lessonId)],
           grown:(d&&Number(d.qGrown[lessonId]))||0,
           bank, extraPassages:(d&&d.extraPassages.length)||0 };
}

global.QEngine={ qKey,markShown,markMastered,isSeen,isSeenQ,normalizeQid,seenKeys,
                 difficultyFor,difficultyLabel:DIFF_LABEL,difficultyLabelEn:DIFF_LABEL_EN,freshQuestions,stats,
                 growPassages,bootExtraPassages,makeStory,ensurePassagePool,
                 /* 供 Node 回归测试 */
                 _internal:{hash32,normRaw,legacyKey,mathExpand,englishExpand,
                            chineseExpand,wordPool,byDifficulty} };
})(typeof window!=='undefined'?window:globalThis);
