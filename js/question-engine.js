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
const WORDS_L1=['I','see','my','we','go','to','the','a','and','is','it','in','on','up','at','me','you','he','she','has','can','like','play','run','sun','fun','big','red','hot','cat','dog','pen','cup','bus','box','hat','map','bag','bed','pig','fox','mom','dad'];
const WORDS_L2=['book','ball','fish','bird','cake','milk','rain','park','tree','ship','shop','duck','frog','jump','help','read','sing','walk','blue','green','yellow','small','happy','water','table','chair','house','school','friend','apple','orange'];
const WORDS_L3=['garden','market','birthday','rainbow','library','umbrella','morning','evening','together','because','favorite','picture','yellow','purple','animal','bicycle','teacher','playground','delicious','exciting','yesterday','tomorrow'];
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
      /* v69：这里以前是「随机主语 + 随机动词 + a + 随机词」，
         宾语取自 268 词整池（含 red/hot/run 等），于是造出
         "I read a hat." "I read a red." 这类病句。
         造句必须用「动词-名词白名单」，统一交给 Bank 的语料生成器。 */
      if(typeof Bank!=='undefined' && Bank.build){
        return Bank.build('e-build', level, 2).slice(0, need);
      }
      return [];
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

  if(lessonId==='c-word'){
    /* v69 词语专项：扩容也必须出「词语题」，绝不能退回拼音题 —— 那与本课目标不符 */
    if(typeof Bank!=='undefined' && Bank.build) return Bank.build('c-word',level,2).slice(0,need);
    return out;
  }
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
        speak:{text:it.hz,lang:'zh-CN',clip:zcl?zcl('syl',it.syl):null,autoplay:true},
        options:shuffle([it.ini,...shuffle(ini.filter(x=>x.p!==it.ini)).slice(0,2).map(x=>x.p)]),
        answer:it.ini,explain:`${sylT} 的声母是 ${it.ini}。例如「${it.word}」。`});
      // 变体 2：听音节，选带调韵母
      if(out.length<need*2){
        out.push({type:'choice',prompt:`🔊 听一听：${sylT} 的韵母是？`,
          sub:'注意听声调，选出带调号的韵母',
          speak:{text:it.hz,lang:'zh-CN',clip:zcl?zcl('syl',it.syl):null,autoplay:true},
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
      const clip=zcl('syl',it.syl);
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

   ⚠️ 2026-11-16 重写：旧版只有「<人名> has a <颜色> <宠物>」一个模板，
      换上十次也只是换了人名和颜色 —— 孩子一眼看出是同一篇。
      现在改为 12 个结构完全不同的故事（找东西 / 做饭 / 下雨 / 风筝 / 看病 /
      种种子 / 坐车 / 新同学 / 买菜 / 洗车 / 海边 / 图书馆），
      每个模板的句子结构和提问方式都不一样（when / why / how many / 先后顺序 / 推断）。
   ========================================================= */
const ST_NAMES=['Mia','Kai','Mei','Jun','Asha','Ravi','Nina','Tim','Lily','Sam','Ben','Tom','May','Zoe','Ella','Leo','Amy','Max','Ann','Ken','Sue','Ivy','Wen','Hana'];
const ST_FEEL=['happy','glad','proud','excited','tired but happy'];
const hintOf=w=>{ const s=String(w||''); return s[0]+' '+Array(Math.max(2,s.length-1)).fill('_').join(' '); };
const stPick=(a)=>pick(a);

const STORY_TEMPLATES=[
  /* 1. 找东西（顺序 + 排除） */
  {id:'lost', visual:'🧦',
   make(level){
     const n=stPick(ST_NAMES), obj=stPick(['hat','sock','cap','scarf','book']);
     const at=stPick(['on the chair','behind the door','on the sofa','in the bag']);
     const s=[`${n} cannot find the ${obj}.`,`${n} looks under the bed.`,`It is not there.`,`Dad finds it ${at}.`];
     if(level>=2) s.push(`${n} is happy again.`);
     if(level>=3) s.push(`"Thank you, Dad!" says ${n}.`,`${n} puts it on and runs to the door.`);
     return {title:`Where Is the ${obj[0].toUpperCase()+obj.slice(1)}?`, text:s.join(' '), qs:[
       {q:`What is ${n} looking for?`,o:[`the ${obj}`,'a ball','a pen'],a:`the ${obj}`,lv:1},
       {q:`Where does ${n} look first?`,o:['under the bed','in the box','in the garden'],a:'under the bed',lv:1},
       {q:'Who finds it?',o:['Dad','Mom',n],a:'Dad',lv:1},
       {q:`Where was the ${obj}?`,o:[at,'in the box','on the bed'],a:at,lv:1},
       {q:`How does ${n} feel at the end?`,o:['happy','sad','angry'],a:'happy',lv:2},
       {q:`${n} looks for a ___.`,short:true,a:obj,accept:[obj],hint:hintOf(obj),lv:1}
     ]};
   }},
  /* 2. 一起做饭（步骤顺序） */
  {id:'cook', visual:'🥞',
   make(level){
     const n=stPick(ST_NAMES), who=stPick(['Mom','Dad','Grandma']);
     const food=stPick(['pancakes','soup','noodles']), what=stPick(['eggs and milk','carrots and rice','tomatoes and salt']);
     const s=[`${who} and ${n} make ${food}.`,`${n} washes ${what}.`,`${who} cooks them in a hot pan.`,`The kitchen smells good.`];
     if(level>=2) s.push(`${n} puts some on a plate for ${who}.`);
     if(level>=3) s.push(`They sit at the table and eat together.`,`"This is the best ${food[0]==='s'?'soup':'meal'}," says ${n}.`);
     return {title:`Making ${food[0].toUpperCase()+food.slice(1)}`, text:s.join(' '), qs:[
       {q:`Who makes ${food} with ${n}?`,o:[who,'the teacher','a friend'],a:who,lv:1},
       {q:'What does '+n+' wash?',o:[what,'the plates','the cups'],a:what,lv:1},
       {q:'Where does '+who+' cook?',o:['in a hot pan','in a cup','in a bag'],a:'in a hot pan',lv:1},
       {q:`How does the ${food} smell?`,o:['good','bad','cold'],a:'good',lv:1},
       {q:'What happens first?',o:[`${n} washes ${what}`,`${n} eats the ${food}`,`${n} sits down`],a:`${n} washes ${what}`,lv:2},
       {q:`${n} washes ___.`,short:true,a:what.split(' ')[0],accept:[what.split(' ')[0],what],hint:hintOf(what.split(' ')[0]),lv:1}
     ]};
   }},
  /* 3. 下雨天（因果） */
  {id:'rain', visual:'🌧️',
   make(level){
     const n=stPick(ST_NAMES), color=stPick(['red','blue','yellow']);
     const s=[`It rains all morning.`,`${n} puts on ${color} boots.`,`${n} jumps in a puddle.`,`Splash!`];
     if(level>=2) s.push(`Then the sun comes out.`);
     if(level>=3) s.push(`${n} looks up and sees a big rainbow in the sky.`,`"I love rainy days," says ${n}.`);
     return {title:'A Rainy Morning', text:s.join(' '), qs:[
       {q:'What is the weather like?',o:['raining','sunny','snowy'],a:'raining',lv:1},
       {q:`What color are ${n}'s boots?`,o:[color,'black','green'],a:color,lv:1},
       {q:'What does '+n+' jump in?',o:['a puddle','a box','a car'],a:'a puddle',lv:1},
       {q:'Why does '+n+' wear boots?',o:['it is raining','it is hot','it is night'],a:'it is raining',lv:2},
       {q:'What comes out after the rain?',o:['the sun','the moon','a bus'],a:'the sun',lv:2},
       {q:`${n} puts on ___ boots.`,short:true,a:color,accept:[color],hint:hintOf(color),lv:1}
     ]};
   }},
  /* 4. 放风筝（问题—解决） */
  {id:'kite', visual:'🪁',
   make(level){
     const n=stPick(ST_NAMES), color=stPick(['red','blue','green']), who=stPick(['Dad','Mom','Grandpa']);
     const s=[`${n} flies a ${color} kite.`,`The wind is strong.`,`The kite goes up, up, up.`,`Then the string breaks!`];
     if(level>=2) s.push(`The kite falls into a tree.`);
     if(level>=3) s.push(`${n} is sad.`,`${who} climbs up and gets the kite down.`,`"Let us fly it again," says ${n}.`);
     return {title:'The Kite in the Tree', text:s.join(' '), qs:[
       {q:'What does '+n+' fly?',o:[`a ${color} kite`,'a plane','a ball'],a:`a ${color} kite`,lv:1},
       {q:'What breaks?',o:['the string','the tree','the kite'],a:'the string',lv:1},
       {q:'Where does the kite fall?',o:['into a tree','into the sea','into a box'],a:'into a tree',lv:2},
       {q:'Who gets the kite down?',o:[who,n,'a friend'],a:who,lv:2},
       {q:`Why does the kite go up high?`,o:['the wind is strong','it is very big',`${n} runs fast`],a:'the wind is strong',lv:2},
       {q:`The kite is ___.`,short:true,a:color,accept:[color],hint:hintOf(color),lv:1}
     ]};
   }},
  /* 5. 生病看医生（时间线） */
  {id:'sick', visual:'🩺',
   make(level){
     const n=stPick(ST_NAMES), day=stPick(['Monday','Tuesday','Wednesday']), back=stPick(['Thursday','Friday']);
     const s=[`On ${day}, ${n} feels hot.`,`${n}'s head hurts.`,`Mom takes ${n} to the doctor.`,`The doctor says, "Rest and drink water."`];
     if(level>=2) s.push(`${n} stays in bed and reads a book.`);
     if(level>=3) s.push(`On ${back} ${n} feels much better.`,`${n} goes back to school with a big smile.`);
     return {title:'A Day at the Doctor', text:s.join(' '), qs:[
       {q:'How does '+n+' feel?',o:['hot and tired','cold and hungry','happy'],a:'hot and tired',lv:1},
       {q:'Who takes '+n+' to the doctor?',o:['Mom','Dad','the teacher'],a:'Mom',lv:1},
       {q:'What does the doctor say?',o:['rest and drink water','run and jump','eat sweets'],a:'rest and drink water',lv:1},
       {q:'When does '+n+' go back to school?',o:[`on ${back}`,`on ${day}`,'on Sunday'],a:`on ${back}`,lv:2},
       {q:'What does '+n+' do in bed?',o:['reads a book','plays a game','washes the car'],a:'reads a book',lv:2},
       {q:`${n}'s ___ hurts.`,short:true,a:'head',accept:['head'],hint:hintOf('head'),lv:1}
     ]};
   }},
  /* 6. 种种子（耐心 / 观察） */
  {id:'seed', visual:'🌱',
   make(level){
     const n=stPick(ST_NAMES), color=stPick(['yellow','red','pink']), when=stPick(['March','April','May']);
     const s=[`In ${when}, ${n} plants a seed.`,`${n} waters it every morning.`,`Nothing happens for many days.`,`Then a green shoot comes up.`];
     if(level>=2) s.push(`The shoot grows two small leaves.`);
     if(level>=3) s.push(`"Be patient," says the teacher.`,`By June the plant has a ${color} flower on top.`,`The whole class comes to see it.`);
     return {title:'The Little Seed', text:s.join(' '), qs:[
       {q:'When does '+n+' plant the seed?',o:[`in ${when}`,'in June','in December'],a:`in ${when}`,lv:2},
       {q:'What does '+n+' do every morning?',o:['waters the seed','sings to the seed','moves the pot'],a:'waters the seed',lv:1},
       {q:'What comes up first?',o:['a green shoot','a flower','a leaf'],a:'a green shoot',lv:2},
       {q:`What color is the flower?`,o:[color,'blue','white'],a:color,lv:2},
       {q:'Why must '+n+' wait?',o:['plants grow slowly','it is raining','the pot is big'],a:'plants grow slowly',lv:3},
       {q:`${n} waters the seed every ___.`,short:true,a:'morning',accept:['morning'],hint:hintOf('morning'),lv:1}
     ]};
   }},
  /* 7. 坐车去奶奶家（路线 / 数量） */
  {id:'trip', visual:'🚇',
   make(level){
     const n=stPick(ST_NAMES), how=stPick(['train','bus','MRT']), stops=stPick(['two','three','four']);
     const s=[`${n} goes to Grandma's apartment by ${how}.`,`The ${how} is long and fast.`,`${n} looks at the map.`,`It is ${stops} stops.`];
     if(level>=2) s.push(`Grandma waits at the gate with a smile.`);
     if(level>=3) s.push(`They walk up the stairs together.`,`Grandma has hot soup and ${n}'s favorite cake.`,`"Come again next week," she says.`);
     return {title:`A Ride to Grandma's`, text:s.join(' '), qs:[
       {q:'How does '+n+' go to Grandma\'s apartment?',o:[`by ${how}`,'by bike','by boat'],a:`by ${how}`,lv:1},
       {q:'How many stops is it?',o:[stops,'ten','one'],a:stops,lv:1},
       {q:'What does '+n+' look at?',o:['the map','the sea','the sky'],a:'the map',lv:1},
       {q:'Who waits at the gate?',o:['Grandma','Dad','a friend'],a:'Grandma',lv:1},
       {q:'What does Grandma have for '+n+'?',o:['hot soup and cake','rice and fish','milk and bread'],a:'hot soup and cake',lv:3},
       {q:`The ${how} is long and ___.`,short:true,a:'fast',accept:['fast'],hint:hintOf('fast'),lv:1}
     ]};
   }},
  /* 8. 新同学（友谊 / 为什么） */
  {id:'friend', visual:'🤝',
   make(level){
     const name=stPick(ST_NAMES), toy=stPick(['ball','book','kite']);
     const s=[`A new pupil comes to my class today.`,`The new pupil's name is ${name}.`,`${name} sits next to me.`,`At break ${name} has no one to play with.`];
     if(level>=2) s.push(`I share my ${toy} with ${name}.`);
     if(level>=3) s.push(`Now we play together every day.`,`${name} says I am a good friend.`,`I am glad ${name} came to our class.`);
     return {title:'My New Friend', text:s.join(' '), qs:[
       {q:'Who comes to my class?',o:['a new pupil','a new teacher','my cousin'],a:'a new pupil',lv:1},
       {q:'Where does '+name+' sit?',o:['next to me','at the back','near the door'],a:'next to me',lv:1},
       {q:'Why does '+name+' have no one to play with?',o:[`${name} is new`,`${name} is tired`,`${name} is at home`],a:`${name} is new`,lv:2},
       {q:'What do I share?',o:[`my ${toy}`,'my lunch','my shoes'],a:`my ${toy}`,lv:1},
       {q:'How do we feel now?',o:['happy together','angry','sad'],a:'happy together',lv:3},
       {q:`${name} is my new ___.`,short:true,a:'friend',accept:['friend'],hint:hintOf('friend'),lv:1}
     ]};
   }},
  /* 9. 跟妈妈买菜（细节 / 重量） */
  {id:'market', visual:'🥬',
   make(level){
     const n=stPick(ST_NAMES), buys=stPick(['fish and eggs','rice and beans','apples and pears']), extra=stPick(['a bun','a mango','a small cake']);
     const s=[`${n} and Mom go to the market.`,`Mom buys ${buys}.`,`${n} carries the small bag.`,`The bag is heavy.`];
     if(level>=2) s.push(`Mom buys ${n} ${extra}.`);
     if(level>=3) s.push(`${extra[0].toUpperCase()+extra.slice(1)} is warm and soft.`,`They walk home and talk about the week.`,`"Next time I will carry the big bag," says ${n}.`);
     return {title:'At the Market', text:s.join(' '), qs:[
       {q:'Where do they go?',o:['the market','the school','the beach'],a:'the market',lv:1},
       {q:'What does Mom buy?',o:[buys,'a toy','a hat'],a:buys,lv:1},
       {q:'What does '+n+' carry?',o:['the small bag','the big bag','nothing'],a:'the small bag',lv:1},
       {q:'How does the bag feel?',o:['heavy','light','cold'],a:'heavy',lv:2},
       {q:'What does Mom buy for '+n+'?',o:[extra,'a book','a ball'],a:extra,lv:2},
       {q:`${n} carries the small ___.`,short:true,a:'bag',accept:['bag'],hint:hintOf('bag'),lv:1}
     ]};
   }},
  /* 10. 帮爸爸洗车（合作 / 结果） */
  {id:'car', visual:'🚗',
   make(level){
     const n=stPick(ST_NAMES), color=stPick(['red','blue','yellow']), who=stPick(['Dad','Mom','Grandpa']);
     const s=[`${who} washes the car.`,`${n} helps with a ${color} cloth.`,`The car is very dirty.`,`They wash the wheels and the windows.`];
     if(level>=2) s.push(`Now the car is clean and bright.`);
     if(level>=3) s.push(`${who} says, "Good job!"`,`${n} puts the cloth in the sun to dry.`,`Next week they will wash it again.`);
     return {title:'Washing the Car', text:s.join(' '), qs:[
       {q:'Who washes the car?',o:[who,'the teacher',n],a:who,lv:1},
       {q:'What does '+n+' use?',o:[`a ${color} cloth`,'a brush','a cup'],a:`a ${color} cloth`,lv:1},
       {q:'What do they wash?',o:['the wheels and windows','the seats','the toys'],a:'the wheels and windows',lv:1},
       {q:'How is the car at the end?',o:['clean and bright','dirty and wet','old and slow'],a:'clean and bright',lv:2},
       {q:'What will they do next week?',o:['wash the car again','buy a new car','go to the beach'],a:'wash the car again',lv:3},
       {q:`The cloth is ___.`,short:true,a:color,accept:[color],hint:hintOf(color),lv:1}
     ]};
   }},
  /* 11. 海边（意外—重来） */
  {id:'beach', visual:'🏖️',
   make(level){
     const n=stPick(ST_NAMES), shells=stPick(['four','five','six']), who=stPick(['Dad','Mom','Grandpa']);
     const s=[`${n} and ${who} go to the beach.`,`They build a big sand house.`,`${n} finds ${shells} shells.`,`The wind blows the house down.`];
     if(level>=2) s.push(`They laugh and build it again.`);
     if(level>=3) s.push(`The sea is blue and the sand is warm.`,`${n} puts the shells in a bag to take home.`,`"This was the best day," says ${n}.`);
     return {title:'A Day at the Beach', text:s.join(' '), qs:[
       {q:'Who goes to the beach with '+n+'?',o:[who,'a teacher','a doctor'],a:who,lv:1},
       {q:'What do they build?',o:['a sand house','a boat','a kite'],a:'a sand house',lv:1},
       {q:'How many shells does '+n+' find?',o:[shells,'ten','two'],a:shells,lv:1},
       {q:'What blows the house down?',o:['the wind','the rain',n],a:'the wind',lv:2},
       {q:'What do they do after the house falls?',o:['build it again','go home','cry'],a:'build it again',lv:2},
       {q:`${n} finds ___ shells.`,short:true,a:shells,accept:[shells],hint:hintOf(shells),lv:1}
     ]};
   }},
  /* 12. 图书馆（规则 / 时间） */
  {id:'library', visual:'📚',
   make(level){
     const n=stPick(ST_NAMES), books=stPick(['two','three']), topic=stPick(['animals','trains','the sea']);
     const s=[`On Saturday ${n} goes to the library.`,`${n} looks for books about ${topic}.`,`The librarian helps ${n} find them.`,`${n} sits on a soft mat and reads.`];
     if(level>=2) s.push(`${n} borrows ${books} books to read at home.`);
     if(level>=3) s.push(`"Please bring them back in two weeks," says the librarian.`,`${n} puts the books in a bag and walks home slowly.`,`${n} cannot wait to read them all.`);
     return {title:'At the Library', text:s.join(' '), qs:[
       {q:'When does '+n+' go to the library?',o:['on Saturday','on Monday','at night'],a:'on Saturday',lv:1},
       {q:'What are the books about?',o:[topic,'cars','food'],a:topic,lv:1},
       {q:'Who helps '+n+'?',o:['the librarian','Mom','a friend'],a:'the librarian',lv:1},
       {q:'How many books does '+n+' borrow?',o:[books,'ten','one'],a:books,lv:2},
       {q:'When must the books go back?',o:['in two weeks','tomorrow','in a year'],a:'in two weeks',lv:3},
       {q:`${n} sits on a soft ___.`,short:true,a:'mat',accept:['mat'],hint:hintOf('mat'),lv:1}
     ]};
   }},
];
/* 保留旧词表名，供其它模块/存档兼容引用 */
const STORY_NAMES=ST_NAMES, STORY_PETS=[['cat','🐱'],['dog','🐶']], STORY_COLORS=['red','blue','green'],
      STORY_PLACES=['park','garden','school'], STORY_THINGS=['a big tree','a small ball'], STORY_FEEL=ST_FEEL;

function makeStory(level, seed){
  level=Math.max(1,Math.min(3,Number(level)||1));
  /* 优先用「本次会话里最少用过的模板」，避免连续两篇撞同一套结构 */
  let t=stPick(STORY_TEMPLATES);
  try{
    _storyUse=_storyUse||{};
    const min=Math.min(...STORY_TEMPLATES.map(x=>_storyUse[x.id]||0));
    const pool=STORY_TEMPLATES.filter(x=>(_storyUse[x.id]||0)<=min);
    t=stPick(pool.length?pool:STORY_TEMPLATES);
    _storyUse[t.id]=(_storyUse[t.id]||0)+1;
  }catch(e){}
  const built=t.make(level);
  const text=built.text;
  /* 只保留本级可用题目：3–4 道选择 + 1 道简答，问法随模板不同而不同 */
  const usable=(built.qs||[]).filter(x=>(x.lv||1)<=level);
  const choice=shuffle(usable.filter(x=>!x.short)).slice(0,4);
  const short=usable.filter(x=>x.short).slice(0,1);
  const qs=shuffle(choice.concat(short));
  return {id:'rp-auto-'+hash32(text).slice(0,10), level,
    title:built.title, visual:t.visual||'📖', text, qs};
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

  /* 家长真人录制题库模式：c-blend 只出家长已录制的题（data.js 已按录音池出题），
     绝不能再走下面的统一题库/自动扩容——那些变体题用的是合成音，会混进来。
     宁可题少（录几题出几题），也不破坏「只出真人录音题」的约定。 */
  const parentBlendMode = lessonId==='c-blend'
    && typeof ParentBlendBank!=='undefined' && ParentBlendBank.ready && ParentBlendBank.count()>0;
  if(parentBlendMode){
    return {items:picked.slice(0,slots).map(q=>({q,isReview:false})), level, grown:0,
            bankSize:picked.length};
  }

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
