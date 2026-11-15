#!/usr/bin/env node
/* =========================================================
   云端每周上新（GitHub Actions 调用，完全离线可跑、不依赖 AI / 密钥）
   ---------------------------------------------------------
   每次生成：
     · 5 篇英文阅读短文（L1×2 / L2×2 / L3×1，长度逐级递增）
     · 5 本绘本（中文 / English 混合，K1/K2/P1/P2 分档）
   只追加、绝不改动已有内容（qid / id 顺序敏感，孩子答题记录靠它命中）。
   用「ISO 周编号」做 seed，同一周重跑幂等；生成后自动跑两道校验。
   用法：node tools/weekly_release.js
   ========================================================= */
const fs=require('fs'), path=require('path'), {execFileSync}=require('child_process');
const ROOT=path.resolve(__dirname,'..');
const READ_FILE=path.join(ROOT,'js/read-passages.js');
const BOOK_FILE=path.join(ROOT,'js/books.js');

/* ---------- 确定性随机（同一周结果一致） ---------- */
function weekTag(d){
  const dt=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate()));
  const day=dt.getUTCDay()||7;
  dt.setUTCDate(dt.getUTCDate()+4-day);
  const y0=new Date(Date.UTC(dt.getUTCFullYear(),0,1));
  const wk=Math.ceil((((dt-y0)/86400000)+1)/7);
  return dt.getUTCFullYear()+'w'+String(wk).padStart(2,'0');
}
const TAG=weekTag(new Date());
let SEED=0;
for(const c of TAG) SEED=(SEED*31+c.charCodeAt(0))>>>0;
function rnd(){ SEED=(SEED*1664525+1013904223)>>>0; return SEED/4294967296; }
function ri(a,b){ return a+Math.floor(rnd()*(b-a+1)); }
function pick(a){ return a[ri(0,a.length-1)]; }

/* ---------- 1. 阅读短文 ---------- */
const NAMES=['Sam','Lily','Tom','May','Ben','Ann','Ken','Zoe','Mia','Tim','Ella','Leo','Jack','Sue','Max','Amy','Nina','Rex','Ivy','Owen'];
const PETS=[['cat','🐱'],['dog','🐶'],['bird','🐦'],['fish','🐟'],['rabbit','🐰'],['duck','🦆'],['frog','🐸']];
const COLORS=['red','blue','green','yellow','pink','black','white'];
const PLACES=['park','garden','school','shop','farm','beach','library'];
const THINGS=['a big tree','a small ball','a red bus','a blue kite','a yellow flower','a little frog'];
const FEELS=['happy','glad','excited','proud'];
const DAYS=['On Monday','One morning','After school','At the weekend','In the afternoon'];

function story(level, idx){
  const n=pick(NAMES), pet=pick(PETS), color=pick(COLORS), place=pick(PLACES);
  const thing=pick(THINGS), feel=pick(FEELS), day=pick(DAYS);
  const s=[];
  if(level===1){
    s.push(`${n} has a ${color} ${pet[0]}.`);
    s.push(`The ${pet[0]} is small and soft.`);
    s.push(`${n} can play with the ${pet[0]}.`);
    s.push(`${n} is ${feel}.`);
  }else if(level===2){
    s.push(`${day}, ${n} and the ${color} ${pet[0]} go to the ${place}.`);
    s.push(`The ${pet[0]} runs fast on the path.`);
    s.push(`They see ${thing} near the gate.`);
    s.push(`${n} looks at it and smiles.`);
    s.push(`"What a nice day!" says ${n}.`);
  }else{
    s.push(`${day}, ${n} takes the ${color} ${pet[0]} to the ${place}.`);
    s.push(`The sky is blue and the air is warm.`);
    s.push(`Soon they find ${thing} beside the big tree.`);
    s.push(`The ${pet[0]} wants to play, but ${n} wants to look at the map first.`);
    s.push(`They walk a long way and stop near a little shop.`);
    s.push(`${n} buys a cold drink and shares it with a friend.`);
    s.push(`When the sun goes down, they walk home together.`);
    s.push(`"We will come back next week," says ${n}.`);
  }
  const text=s.join(' ');
  const qs=[
    {q:`What does ${n} have?`,o:[`a ${color} ${pet[0]}`,'a big bus','a toy box'],a:`a ${color} ${pet[0]}`},
    {q:`What color is the ${pet[0]}?`,o:[color,pick(COLORS.filter(x=>x!==color)),'purple'],a:color},
    {q:`Where do they go?`,o:[`the ${place}`,'the zoo','the market'],a:`the ${place}`},
    {q:`Is ${n} ${feel}?`,o:['Yes','No'],a:'Yes'},
    {q:`${n} has a ___ ${pet[0]}.`,short:true,a:color,accept:[color],hint:color[0]+' _ _ _'}
  ];
  return {id:`rp-${TAG}-${idx}`,level,
    title:`${n} and the ${pet[0][0].toUpperCase()+pet[0].slice(1)}`,
    visual:pet[1],text,qs};
}

/* ---------- 2. 绘本 ---------- */
const BGS=['day','night','sea','room','rain','snow','forest','garden'];
const SHAPES_OK=['tree','apple','ball','book','bird','sun','star','cloud','rainbow','kite',
  'flower','seed','sprout','plant','leaf','house','castle','boat','car','cake','box','hat',
  'umbrella','pan','drum','banana','watermelon','grapes','bug','cat','dog','rabbit','bear',
  'duck','fish','child','moon','seaweed'];
const ZH_ITEMS=[['小猫','cat'],['小狗','dog'],['气球','ball'],['大树','tree'],['花朵','flower'],
  ['小鸟','bird'],['小鱼','fish'],['小兔','rabbit'],['云朵','cloud'],['太阳','sun'],['雨伞','umbrella']];
function bookPages(lang, level, seedShift){
  const bg=pick(BGS);
  const art=(items)=>bg+'|'+[...new Set(items.filter(Boolean))].slice(0,4).join(',');
  if(lang==='zh'){
    const zi=pick(ZH_ITEMS), zj=pick(ZH_ITEMS.filter(x=>x[0]!==zi[0]));
    const A=zi[1], B=zj[1];
    const base=[
      (seedShift%2?'小兔子':'小猫')+'醒来了。今天要去外面玩。',
      `它看见了${zi[0]}，还有${zj[0]}。`,
      '风轻轻吹过来，天气真好。',
      '它和小伙伴一起走呀走。',
      '太阳快下山了，该回家啦。',
      '“明天再来玩吧！”它开心地说。'
    ];
    return base.slice(0, level==='k1'?5:6).map((t,i)=>[t,art([A,B,'child',i%2?'sun':'cloud'])]);
  }
  const A=pick(SHAPES_OK), B=pick(SHAPES_OK.filter(x=>x!==A));
  const n=pick(NAMES);
  const base=[
    `${n} wakes up early. It is a bright day.`,
    `${n} can see a ${A} and a ${B}.`,
    `The ${A} is big. The ${B} is small.`,
    `${n} and a friend walk to the ${pick(PLACES)}.`,
    `They play together until the sun goes down.`,
    `"See you tomorrow!" says ${n}.`
  ];
  return base.slice(0, level==='k1'?5:6).map((t,i)=>[t,art([A,B,'child',i%2?'sun':'tree'])]);
}
function newBooks(){
  const specs=[
    {lang:'zh',level:'k1',tag:'生活 · 重复句'},
    {lang:'en',level:'k1',tag:'Sight words · CVC'},
    {lang:'zh',level:'k2',tag:'自然 · 观察'},
    {lang:'en',level:'p1',tag:'Short sentences'},
    {lang:'zh',level:'p2',tag:'友谊 · 小故事'},
  ];
  return specs.map((sp,i)=>{
    const pages=bookPages(sp.lang,sp.level,i);
    const title=sp.lang==='zh'
      ? `${pick(['小兔子的','小猫的','小熊的','小朋友的'])}${pick(['新朋友','一天','小发现','礼物','旅行'])}`
      : `${pick(NAMES)}'s ${pick(['Big Day','Little Friend','New Ball','Sunny Walk','Small Gift'])}`;
    return { id:`${sp.lang}-${sp.level}-${TAG}-${i+1}`, lang:sp.lang, level:sp.level,
      title, titleEn:sp.lang==='zh'?`Week ${TAG} · ${i+1}`:`第 ${TAG} 周 · ${i+1}`,
      tag:sp.tag, pages };
  });
}
function toJs(o){ return '  '+JSON.stringify(o,null,2).split('\n').join('\n  ')+',\n'; }

/* ---------- 执行 ---------- */
function already(){
  /* 只看周标签本身，不假设引号风格：add_reading.js 写入的是 JSON 双引号，
     早期版本用 id:'...' 单引号，两种都要能命中，否则同周重跑会重复追加并撞 ID。 */
  const r=fs.readFileSync(READ_FILE,'utf8');
  return r.indexOf(`rp-${TAG}-`)>=0;
}
if(already()){
  console.log(`本周 ${TAG} 已上新，跳过（幂等）`);
  process.exit(0);
}

// 1) 追加 5 篇短文（复用 add_reading.js 的完整校验）
const stories=[story(1,1),story(1,2),story(2,3),story(2,4),story(3,5)];
const tmp=path.join(require('os').tmpdir(),`pokelearn_week_${TAG}.json`);
fs.writeFileSync(tmp,JSON.stringify(stories,null,2),'utf8');
execFileSync(process.execPath,[path.join(ROOT,'tools/add_reading.js'),tmp],{stdio:'inherit'});

// 2) 追加 5 本绘本（插到 RAW_BOOKS 数组结尾）
const bf=fs.readFileSync(BOOK_FILE,'utf8');
const start=bf.indexOf('const RAW_BOOKS = [');
if(start<0) throw new Error('找不到 RAW_BOOKS');
const close=bf.indexOf('\n];',start);
if(close<0) throw new Error('找不到 RAW_BOOKS 结尾');
const block=newBooks().map(toJs).join('');
let head=bf.slice(0,close+1);
head=head.replace(/\}(\s*)$/, '},$1');     // 上一个对象补逗号
fs.writeFileSync(BOOK_FILE, head+'\n  /* ---------- 云端周更 '+TAG+' ---------- */\n'+block+bf.slice(close+1),'utf8');

// 3) 双校验
execFileSync(process.execPath,[path.join(ROOT,'tools/read_check.js')],{stdio:'inherit'});
execFileSync(process.execPath,[path.join(ROOT,'tools/book_check.js')],{stdio:'inherit'});

// 4) bump 缓存版本（sw.js / package.json），让 iPad 上自动拿到新内容
execFileSync(process.execPath,[path.join(ROOT,'tools/bump_version.js')],{stdio:'inherit'});
fs.unlinkSync(tmp);
console.log(`☁️ ${TAG} 云端上新完成：+5 篇短文 / +5 本绘本`);
