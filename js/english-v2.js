/* =========================================================
   PokeLearn · english-v2.js · v74
   英语题库加深 + 综合题组（参考学而思少儿英语能力分级）
   - 新增题型：词汇分类 / 反义词 / 方位介词 / 押韵 / 逻辑排序
   - 综合题组 English Mixed Review：复用已有所有英语版块的 make()
   - 所有给孩子看的文字一律英文；题目纯数据、可序列化进错题本
   加载顺序：pokemon → data → english-v2.js → question-bank → ... → question-engine
   （生成器运行时用到全局 ri/pick/shuffle/pokeImg，均在 make() 时才调用）
   ========================================================= */

/* ---------------- 词汇分类（Word Groups · circle） ----------------
   参考学而思「词汇归类」：圈出所有同类词（水果/动物/颜色/食物/交通）。 */
/* 每组内的词互不重叠，也避开跨类歧义：
   - orange 既是水果又是颜色 → 只留在 fruit，colour 用 brown；
   - fish 既可当动物又可当食物 → 只作干扰项风险高，改用 bear；
   - mouse 同时是电脑词 → 不用。确保 5 岁孩子只有一个正确答案。 */
const EG_GROUPS={
  fruit:   ['apple','banana','orange','grape','mango','peach','melon','strawberry'],
  animal:  ['cat','dog','bird','frog','duck','tiger','rabbit','bear'],
  colour:  ['red','blue','green','yellow','purple','pink','brown','black'],
  food:    ['bread','cake','rice','soup','pizza','salad','milk','cheese'],
  transport:['bus','car','train','boat','bike','plane','ship','taxi']
};
const EG_LABEL={fruit:'fruits',animal:'animals',colour:'colours',food:'foods',transport:'vehicles'};
function genWordGroup(n){
  const out=[];
  const keys=Object.keys(EG_GROUPS);
  for(let i=0;i<n;i++){
    const target=pick(keys);
    const others=shuffle(keys.filter(k=>k!==target));
    const inGroup=shuffle(EG_GROUPS[target]).slice(0,ri(2,3));
    const outGroup=[];
    others.forEach(k=>{
      shuffle(EG_GROUPS[k]).slice(0,1).forEach(w=>outGroup.push(w));
    });
    const words=shuffle(inGroup.concat(outGroup));
    const items=words.map((w,k)=>({key:'wg'+i+'_'+k,label:w}));
    const ansKeys=items.filter(it=>inGroup.includes(it.label)).map(it=>it.key);
    const label=EG_LABEL[target];
    out.push({type:'circle',prompt:'Circle all the '+label+'.',multi:true,
      sub:'Touch every word that is a '+target+'. Do not miss any!',
      items,answer:ansKeys.slice().sort().join(','),
      speak:{text:'Circle all the '+label+'.',lang:'en-US'},
      explain:inGroup.join(', ')+' are '+label+'. You found them all!',
      answerSpeak:{text:inGroup.join(', ')+' are '+label+'.',lang:'en-US'},
      tag:'vocab'});
  }
  return out;
}

/* ---------------- 反义词（Opposites · choice / match） ---------------- */
const EG_OPPOSITES=[
  ['big','small'],['hot','cold'],['happy','sad'],['fast','slow'],
  ['tall','short'],['up','down'],['in','out'],['open','close'],
  ['day','night'],['new','old'],['long','short'],['loud','quiet'],
  ['clean','dirty'],['full','empty'],['high','low'],['near','far']
];
function genOpposite(n){
  const out=[];
  for(let i=0;i<n;i++){
    const p=pick(EG_OPPOSITES);
    const askFirst=Math.random()<0.5;
    const word=askFirst?p[0]:p[1], answer=askFirst?p[1]:p[0];
    const pool=[];
    EG_OPPOSITES.forEach(x=>x.forEach(w=>{ if(w!==word&&w!==answer&&pool.indexOf(w)<0) pool.push(w); }));
    out.push({type:'choice',prompt:'What is the opposite?',sub:'"'+word+'"',
      speak:{text:word,lang:'en-US'},
      options:shuffle([answer].concat(shuffle(pool).slice(0,3))),answer,
      explain:'The opposite of "'+word+'" is "'+answer+'".',
      answerSpeak:{text:'The opposite of '+word+' is '+answer+'.',lang:'en-US'},
      tag:'opposite'});
  }
  return out;
}

/* ---------------- 方位介词（Prepositions · circle 图卡） ----------------
   用一排场景 emoji + 文字；学而思低龄常考 in/on/under/next to。 */
const EG_PREP=[
  {word:'on',   clue:'The cat is ___ the box.', emoji:'🐱📦', ask:'Where is the cat?'},
  {word:'under',clue:'The dog is ___ the table.', emoji:'🐶🪑', ask:'Where is the dog?'},
  {word:'in',   clue:'The bird is ___ the cage.', emoji:'🐦🪟', ask:'Where is the bird?'},
  {word:'next to',clue:'The fish is ___ the bowl.', emoji:'🐠🥣', ask:'Where is the fish?'},
  {word:'on',   clue:'The book is ___ the desk.', emoji:'📖🪑', ask:'Where is the book?'},
  {word:'in',   clue:'The milk is ___ the fridge.', emoji:'🥛🧊', ask:'Where is the milk?'},
  {word:'under',clue:'The ball is ___ the bed.', emoji:'⚽🛏️', ask:'Where is the ball?'},
  {word:'next to',clue:'The tree is ___ the house.', emoji:'🌳🏠', ask:'Where is the tree?'},
  {word:'on',   clue:'The apple is ___ the plate.', emoji:'🍎🍽️', ask:'Where is the apple?'},
  {word:'in',   clue:'The toy is ___ the box.', emoji:'🧸📦', ask:'Where is the toy?'},
  {word:'under',clue:'The cat is ___ the chair.', emoji:'🐱🪑', ask:'Where is the cat?'},
  {word:'next to',clue:'The dog is ___ the kid.', emoji:'🐶🧒', ask:'Where is the dog?'}
];
function genPreposition(n){
  const out=[];
  const options=['in','on','under','next to'];
  for(let i=0;i<n;i++){
    const p=pick(EG_PREP);
    out.push({type:'choice',prompt:p.ask,sub:p.emoji+'  '+p.clue,
      speak:{text:p.clue.replace('___','blank'),lang:'en-US'},
      options:shuffle(options.slice()),answer:p.word,
      explain:'Use "'+p.word+'" here: '+p.clue.replace('___',p.word),
      answerSpeak:{text:'The answer is '+p.word+'.',lang:'en-US'},
      tag:'preposition'});
  }
  return out;
}

/* ---------------- 押韵（Rhyming Words · choice） ----------------
   参考学而思自然拼读的 rhyme 意识训练。 */
const EG_RHYMES=[
  ['cat','hat'],['dog','frog'],['sun','fun'],['cake','lake'],
  ['bee','tree'],['book','look'],['star','car'],['fish','dish'],
  ['ball','wall'],['mouse','house'],['boat','goat'],['rain','train']
];
function genRhyme(n){
  const out=[];
  const pool=[];
  EG_RHYMES.forEach(x=>x.forEach(w=>{ if(pool.indexOf(w)<0) pool.push(w); }));
  for(let i=0;i<n;i++){
    const p=pick(EG_RHYMES);
    const askFirst=Math.random()<0.5;
    const word=askFirst?p[0]:p[1], answer=askFirst?p[1]:p[0];
    const distract=shuffle(pool.filter(w=>w!==word&&w!==answer)).slice(0,3);
    out.push({type:'choice',prompt:'Which word rhymes with it?',sub:'"'+word+'"',
      speak:{text:word,lang:'en-US'},
      options:shuffle([answer].concat(distract)),answer,
      explain:'"'+word+'" rhymes with "'+answer+'". They sound the same at the end.',
      answerSpeak:{text:word+' rhymes with '+answer+'.',lang:'en-US'},
      tag:'rhyme'});
  }
  return out;
}

/* ---------------- 逻辑排序（Story Order · circle） ----------------
   先 / 然后 / 最后：一排不重复宝可梦，问谁先到 / 谁最后到。 */
function genStoryOrder(n){
  const out=[];
  for(let i=0;i<n;i++){
    const count=ri(4,5);
    const line=shuffle(MATH_PETS).slice(0,count).map((p,k)=>({
      id:p.id,key:petKey(p)+'_'+k,name:p.name,pos:ord(k+1)}));
    const askFirst=Math.random()<0.5;
    const who=askFirst?line[0]:line[count-1];
    out.push({type:'circle',prompt:askFirst?'Who arrived first?':'Who arrived last?',
      sub:'The friends ran a race. Look at the picture from left to right.',
      visual:petRow(line,{title:'The race finish'}),
      items:line.map(it=>({key:it.key,label:it.name,img:pokeImg(it.id),pos:it.pos})),
      answer:who.key,multi:false,
      speak:{text:askFirst?'Who arrived first?':'Who arrived last?',lang:'en-US'},
      explain:who.name+(askFirst?' arrived first.':' arrived last.'),
      answerSpeak:{text:who.name+(askFirst?' was first.':' was last.'),lang:'en-US'},
      tag:'order'});
  }
  return out;
}

/* =========================================================
   英语综合题组（English Mixed Review）：复用已有所有英语版块
   ---------------------------------------------------------
   覆盖 sight / spell / grammar / build / phonics / read + v74 新题型
   （vocab / opposite / preposition / rhyme / order）。每类直接复用
   原课程 make()，以后任何一门课调整题目，综合训练自动跟着更新。
   passage 阅读按整套只放一个块，避免刷屏。
   ========================================================= */
function englishFamilies(){
  const legacyMaker=(id)=>{
    if(typeof ENGLISH==='undefined' || !Array.isArray(ENGLISH)) return null;
    const les=ENGLISH.find(l=>l.id===id);
    return les && typeof les.make==='function' ? les.make : null;
  };
  return [
    {id:'sight',      make:legacyMaker('e-sight')},
    {id:'spell',      make:legacyMaker('e-spell')},
    {id:'grammar',    make:legacyMaker('e-grammar')},
    {id:'build',      make:legacyMaker('e-build')},
    {id:'phonics',    make:legacyMaker('e-phonics')},
    {id:'read',       make:legacyMaker('e-read')},
    {id:'vocab',      make:genWordGroup},
    {id:'opposite',   make:genOpposite},
    {id:'preposition',make:genPreposition},
    {id:'rhyme',      make:genRhyme},
    {id:'order',      make:genStoryOrder},
  ].filter(f=>typeof f.make==='function');
}
function genEnglishCombo(n, opts){
  n=Math.max(1,Number(n)||10);
  opts=opts||{};
  const fams=shuffle(englishFamilies());
  const out=[]; let passageCount=0;
  for(let pass=0;pass<6 && out.length<n;pass++){
    for(const f of fams){
      if(out.length>=n) break;
      let batch=[];
      try{ batch=f.make(4,opts)||[]; }catch(e){ batch=[]; }
      if(!batch.length) continue;
      const q=batch[ri(0,batch.length-1)];
      if(!q) continue;
      if(q.type==='passage'){ if(passageCount>=1) continue; passageCount++; }
      q.src=f.id;
      out.push(q);
    }
  }
  return out;
}

/* ---------------- 课程注册：追加到 ENGLISH 数组末尾（由 data.js 之后的合并接入） ---------------- */
const ENGLISH_V2=[
  { id:'e-vocab', level:2, title:'Word Groups', emoji:'🗂️',
    desc:'Circle all the fruits, animals, colours and more', noPool:true,
    make(slots){ return genWordGroup(Math.max(14,slots||10)); } },
  { id:'e-opposite', level:2, title:'Opposites', emoji:'↔️',
    desc:'Big or small? Hot or cold? Find the opposite', noPool:true,
    make(slots){ return genOpposite(Math.max(14,slots||10)); } },
  { id:'e-preposition', level:2, title:'Where Is It?', emoji:'📍',
    desc:'In, on, under, next to — choose the right word', noPool:true,
    make(slots){ return genPreposition(Math.max(14,slots||10)); } },
  { id:'e-rhyme', level:2, title:'Rhyming Words', emoji:'🎵',
    desc:'Which word sounds the same at the end?', noPool:true,
    make(slots){ return genRhyme(Math.max(14,slots||10)); } },
  { id:'e-order', level:2, title:'First & Last', emoji:'🥇',
    desc:'Who arrived first? Who arrived last?', noPool:true,
    make(slots){ return genStoryOrder(Math.max(14,slots||10)); } },
  { id:'e-combo', level:3, title:'Mixed Review · All Skills', emoji:'🏆',
    desc:'One set, every English skill: sight words · spelling · grammar · sentences · phonics · reading · vocab · opposites · rhymes',
    noPool:true,
    make(slots,opts){ return genEnglishCombo(Math.max(12,slots||10),opts); } },
];

/* 合并进 ENGLISH（本文件在 data.js 之后加载，直接 push） */
if(typeof ENGLISH!=='undefined' && Array.isArray(ENGLISH)){
  ENGLISH.push(...ENGLISH_V2);
}

if(typeof module!=='undefined' && module.exports){
  module.exports={ genWordGroup,genOpposite,genPreposition,genRhyme,genStoryOrder,
    englishFamilies,genEnglishCombo,ENGLISH_V2 };
}
