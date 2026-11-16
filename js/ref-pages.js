/* =========================================================
   PokeLearn · 三个「汇总页」（只读参考版块）
   ---------------------------------------------------------
   这三页不是刷题课，是「看一眼就想起全部」的挂图：
     zh-map      汉语拼音全景：声母 / 韵母 / 整体认读音节 / 四声
     ipa-chart   英语音标全景：20 元音 + 24 辅音 + 字母 A–Z
     math-facts  10 以内：数字拆分 / 加法表 / 减法表
   点任意一格都会朗读（全部走 app.js 唯一语音出口）。

   语言规则（项目硬规则）：
     · 中文页 → 中文
     · 英文页 / 数学页 → 全英文（这两个科目不许出现中文）
   音频：
     · 中文走 audio/zh（fin2_* 为本页新增的韵母呼读音）
     · 英文走 audio/words（例词已并入 tools/voice_manifest.js）
   ========================================================= */
(function(global){
'use strict';

/* =========================================================
   一、汉语拼音全景
   ========================================================= */
/* 声母：按「发音部位」分组，顺序与小学拼音教学图一致。
   21 个辅音声母 + y / w（半元音、隔音字母，常归入起首功能）。 */
const ZH_INITIAL_GROUPS=[
  {name:'双唇音', items:[['b','玻'],['p','坡'],['m','摸']]},
  {name:'唇齿音', items:[['f','佛']]},
  {name:'舌尖中音', items:[['d','得'],['t','特'],['n','讷'],['l','勒']]},
  {name:'舌根音', items:[['g','哥'],['k','科'],['h','喝']]},
  {name:'舌面音', items:[['j','基'],['q','欺'],['x','希']]},
  {name:'翘舌音（舌尖后）', items:[['zh','知'],['ch','吃'],['sh','诗'],['r','日']]},
  {name:'平舌音（舌尖前）', items:[['z','资'],['c','次'],['s','思']]},
  {name:'半元音 / 隔音字母', items:[['y','衣'],['w','乌']], note:'拼音体系里常与声母一起起首'},
];

/* 韵母：严格按人教版《汉语拼音》韵母表 24 个
   （单 6 + 复 8 + 特殊 er 1 + 前鼻 5 + 后鼻 4）。
   —— 2026-11-16 修正：上一版按「汉语拼音方案 35 韵母」把 ia / ua / uo / iao /
      iou / uai / uei / iong 也当成复韵母列了出来，那些是介音拼合，不是小学韵母表
      的条目；ui / iu 才是 uei / iou 的省写形式。已全部删除，补回 ui / iu / er。
   呼读音用汉字标（a 读「啊」、ai 读「哀」），和声母的教法一致。
   ong 没有零声母音节，例字取近似音「翁」；er 是特殊韵母，不与声母相拼
   （这些是教学惯例，不是随手编的）。
   音频 key 统一走 fin2_<韵母>，与题库用的 final_* 分开，互不影响。 */
const ZH_FINAL_GROUPS=[
  {name:'单韵母（6）', items:[['a','啊'],['o','喔'],['e','鹅'],['i','衣'],['u','乌'],['ü','迂']]},
  {name:'复韵母（8）', items:[['ai','哀'],['ei','诶'],['ui','威'],['ao','熬'],
    ['ou','欧'],['iu','优'],['ie','耶'],['üe','约']]},
  {name:'特殊韵母（1）', items:[['er','儿']], note:'不与声母相拼，自成音节'},
  {name:'前鼻韵母（5）', items:[['an','安'],['en','恩'],['in','因'],['un','温'],['ün','晕']]},
  {name:'后鼻韵母（4）', items:[['ang','肮'],['eng','鞥'],['ing','英'],['ong','翁']],
    note:'ong 没有零声母音节，例字取近似音'},
];

/* 整体认读音节 16 个：看到就读，不用拼 */
const ZH_WHOLE_LIST=['zhi','chi','shi','ri','zi','ci','si','yi','wu','yu','ye','yue','yuan','yin','yun','ying'];
const ZH_WHOLE_HZ={zhi:'知',chi:'吃',shi:'狮',ri:'日',zi:'字',ci:'刺',si:'丝',yi:'衣',wu:'乌',yu:'鱼',
  ye:'叶',yue:'月',yuan:'圆',yin:'音',yun:'云',ying:'鹰'};

/* 四声：调号 + 调型 + 例字（用 m 组，孩子最容易听出区别） */
const ZH_TONE_CARDS=[
  {tone:1, mark:'—', py:'mā', hz:'妈', name:'第一声 · 阴平', shape:'高平调，又高又平'},
  {tone:2, mark:'/', py:'má', hz:'麻', name:'第二声 · 阳平', shape:'中升调，往上扬'},
  {tone:3, mark:'∨', py:'mǎ', hz:'马', name:'第三声 · 上声', shape:'降升调，先降再拐上去'},
  {tone:4, mark:'\\', py:'mà', hz:'骂', name:'第四声 · 去声', shape:'全降调，一路往下'},
];

/* 韵母音频 key：ü 在文件名里换成 v（ü→v、üe→ve、ün→vn），
   避免中文/变音符文件名在不同系统、不同服务器上的编码问题。
   页面上仍然显示 ü。 */
function fin2Key(p){ return String(p).replace(/ü/g,'v'); }

/* ---------- 渲染 ---------- */
function zhTile(p,hz,kind,key){
  return `<button class="rf-tile" data-say="${hz}" data-clip="${kind}" data-key="${key||p}">
    <span class="rf-letter">${p}</span><span class="rf-hz">${hz}</span></button>`;
}
function renderZhMap(){
  const sec=(title,sub,body)=>`<section class="rf-sec">
    <h3 class="rf-h3">${title}<span class="rf-count">${sub}</span></h3>${body}</section>`;

  const ini=ZH_INITIAL_GROUPS.map(g=>`<div class="rf-group">
      <div class="rf-gname">${g.name}${g.note?`<span class="rf-note">${g.note}</span>`:''}</div>
      <div class="rf-row">${g.items.map(([p,hz])=>zhTile(p,hz,'initial')).join('')}</div>
    </div>`).join('');

  const fin=ZH_FINAL_GROUPS.map(g=>`<div class="rf-group">
      <div class="rf-gname">${g.name}${g.note?`<span class="rf-note">${g.note}</span>`:''}</div>
      <div class="rf-row">${g.items.map(([p,hz])=>zhTile(p,hz,'fin2',fin2Key(p))).join('')}</div>
    </div>`).join('');

  const whole=`<div class="rf-row rf-row-whole">${ZH_WHOLE_LIST.map(p=>zhTile(p,ZH_WHOLE_HZ[p],'whole')).join('')}</div>`;

  const tones=`<div class="rf-tone-grid">${ZH_TONE_CARDS.map(t=>`
      <button class="rf-tone-card" data-say="${t.hz}" data-clip="tone" data-key="ma_${t.tone}">
        <div class="rf-tone-mark">${t.mark}</div>
        <div class="rf-tone-py">${t.py}</div>
        <div class="rf-tone-name">${t.name}</div>
        <div class="rf-tone-shape">${t.shape}</div>
      </button>`).join('')}
    </div>
    <div class="rf-tip">
      <b>轻声</b>不标调号，读得又轻又短，例如「ma」在「妈妈 māma」里的第二个 ma。<br>
      <b>标调口诀</b>：有 a 找 a，没 a 找 o、e，i、u 并列标在后。
    </div>`;

  return sec('① 声母','21 个辅音声母 + y / w',ini)
       + sec('② 韵母','24 个 · 单 6 / 复 8 / 特殊 1 / 前鼻 5 / 后鼻 4',fin)
       + sec('③ 整体认读音节','16 个 · 不用拼，直接读',whole)
       + sec('④ 四声调','4 个基本声调 + 轻声',tones);
}

/* =========================================================
   二、英语音标全景（American English / General American，21 元音 + 24 辅音）
   ---------------------------------------------------------
   全 App 英文一律按美音：符号用美式 GA 写法，录音用同一把美式女声。
   美式和英式 RP 的差别（孩子会看到的对照）：
     /ɒ/ → /ɑ/   hot、dog      /əʊ/ → /oʊ/  nose
     /ɜː/ → /ɝ/   her           /ɑː/ → /ɑr/  car
     /ɔː/ 并入 /ɑ/（saw）        /ɪə/ → /ɪr/  here
                                 /eə/ → /ɛr/  hair
                                 /ʊə/ → /ʊr/  tour
   另有美音独有的非重读卷舌 /ɚ/（teacher）。
   注：本库女声是 cot-caught 合并的美式口音，saw 与 hot 元音相同，
       所以只列一格 /ɑ/，不单列 /ɔ/ —— 免得两格听起来一样却标不同符号。
   每个音：音标 + 例词 + 规则提示（全英文）。点格子读音素本身，不是读例词。
   ========================================================= */
const IPA_VOWELS=[
  {g:'Short vowels', items:[
    {ipa:'/ɪ/', k:'v_ih', w:['sit','pig','big'], rule:'The i in sit. Short and relaxed: "ih".'},
    {ipa:'/ɛ/', k:'v_e', w:['bed','pen','egg'], rule:'The e in bed. Small mouth: "eh".'},
    {ipa:'/æ/', k:'v_ae', w:['cat','hat','bag'], rule:'The a in cat. Open your mouth wide.'},
    {ipa:'/ʌ/', k:'v_uh', w:['cup','sun','bus'], rule:'The u in cup. Short and relaxed: "uh".'},
    {ipa:'/ɑ/', k:'v_o', w:['hot','dog','saw'], rule:'The o in hot, the aw in saw. Open mouth, short "ah".'},
    {ipa:'/ʊ/', k:'v_uu', w:['book','look','good'], rule:'The oo in book. Short and soft.'},
    {ipa:'/ə/', k:'v_schwa', w:['about','banana','sofa'], rule:'The weak a in about. Very light "uh".'},
  ]},
  {g:'Long & tense vowels', items:[
    {ipa:'/i/', k:'v_ii', w:['see','tree','bee'], rule:'The ee in see. Long smile: "eeee".'},
    {ipa:'/u/', k:'v_oo', w:['moon','food','zoo'], rule:'The oo in moon. Round lips, hold it.'},
    {ipa:'/ɝ/', k:'v_er', w:['her','bird','nurse'], rule:'The er in her. Curl the tongue while you say "uh".'},
    {ipa:'/ɚ/', k:'v_schwa_r', w:['teacher','water','doctor'], rule:'The weak er at the end of teacher. A soft curled "er".'},
  ]},
  {g:'Diphthongs', items:[
    {ipa:'/eɪ/', k:'v_ei', w:['cake','name','rain'], rule:'The a in cake, ai in rain. Say the letter name A.'},
    {ipa:'/aɪ/', k:'v_ai', w:['bike','kite','time'], rule:'The i in bike. Say the letter name I.'},
    {ipa:'/ɔɪ/', k:'v_oi', w:['boy','toy','coin'], rule:'The oi in boy. Slide from o to i.'},
    {ipa:'/aʊ/', k:'v_au', w:['house','mouse','cow'], rule:'The ou in house, ow in cow. Slide a to u.'},
    {ipa:'/oʊ/', k:'v_ou', w:['nose','home','boat'], rule:'The o in nose, oa in boat. Say the letter name O.'},
  ]},
  {g:'R-colored vowels', items:[
    {ipa:'/ɑr/', k:'v_aar', w:['car','star','far'], rule:'The ar in car. Open "ah", then curl into r.'},
    {ipa:'/ɔr/', k:'v_awr', w:['for','horse','corn'], rule:'The or in for. Round "aw", then curl into r.'},
    {ipa:'/ɪr/', k:'v_ie', w:['here','ear','near'], rule:'The ear in here. Slide i into a curled r.'},
    {ipa:'/ɛr/', k:'v_ea', w:['hair','chair','bear'], rule:'The air in hair. Slide e into a curled r.'},
    {ipa:'/ʊr/', k:'v_ue', w:['tour','poor','sure'], rule:'The ure in tour. Slide u into a curled r.'},
  ]},
];
const IPA_CONSONANTS=[
  {g:'Plosives', items:[
    {ipa:'/p/', k:'c_p', w:['pen','pig','top'], rule:'The p in pen. No voice, a puff of air.'},
    {ipa:'/b/', k:'c_b', w:['bag','bed','book'], rule:'The b in bag. Same as p, but with your voice.'},
    {ipa:'/t/', k:'c_t', w:['ten','top','cat'], rule:'The t in ten. No voice.'},
    {ipa:'/d/', k:'c_d', w:['dog','dad','red'], rule:'The d in dog. Same as t, but with your voice.'},
    {ipa:'/k/', k:'c_k', w:['kite','cat','key'], rule:'The k in kite, c in cat. Back of the mouth.'},
    {ipa:'/g/', k:'c_g', w:['go','game','big'], rule:'The g in go. Same as k, but with your voice.'},
  ]},
  {g:'Fricatives', items:[
    {ipa:'/f/', k:'c_f', w:['fish','fan','off'], rule:'The f in fish. Teeth on lip, no voice.'},
    {ipa:'/v/', k:'c_v', w:['van','very','five'], rule:'The v in van. Same as f, but with your voice.'},
    {ipa:'/θ/', k:'c_th', w:['three','think','bath'], rule:'The th in three. Tongue between the teeth, no voice.'},
    {ipa:'/ð/', k:'c_dh', w:['this','that','mother'], rule:'The th in this. Same, but with your voice.'},
    {ipa:'/s/', k:'c_s', w:['sun','sit','bus'], rule:'The s in sun. A snake sound.'},
    {ipa:'/z/', k:'c_z', w:['zoo','zip','nose'], rule:'The z in zoo. A bee sound, with your voice.'},
    {ipa:'/ʃ/', k:'c_sh', w:['ship','fish','shop'], rule:'The sh in ship. "shh", no voice.'},
    {ipa:'/ʒ/', k:'c_zh', w:['measure','vision','usual'], rule:'The s in measure. Same as sh, with your voice.'},
    {ipa:'/h/', k:'c_h', w:['hat','hot','hello'], rule:'The h in hat. Just breathe out.'},
  ]},
  {g:'Affricates', items:[
    {ipa:'/tʃ/', k:'c_ch', w:['chair','cheese','lunch'], rule:'The ch in chair. A t plus sh.'},
    {ipa:'/dʒ/', k:'c_j', w:['jam','jump','bridge'], rule:'The j in jam. A ch with your voice.'},
  ]},
  {g:'Nasals', items:[
    {ipa:'/m/', k:'c_m', w:['man','mom','home'], rule:'The m in man. Lips closed, sound through the nose.'},
    {ipa:'/n/', k:'c_n', w:['net','nine','sun'], rule:'The n in net. Tongue up, sound through the nose.'},
    {ipa:'/ŋ/', k:'c_ng', w:['sing','long','ring'], rule:'The ng in sing. Back of the mouth, through the nose.'},
  ]},
  {g:'Approximants', items:[
    {ipa:'/l/', k:'c_l', w:['leg','lion','ball'], rule:'The l in leg. Tongue touches the top.'},
    {ipa:'/r/', k:'c_r', w:['red','run','car'], rule:'The r in red. Curl the tongue, do not touch.'},
    {ipa:'/w/', k:'c_w', w:['wet','water','white'], rule:'The w in wet. Round your lips and let go.'},
    {ipa:'/j/', k:'c_y', w:['yes','yellow','you'], rule:'The y in yes. A quick "y".'},
  ]},
];
/* 字母表：每个字母最常见的读音（美式符号，对应截图里 A a / B b … 那一列）
   k = 这个字母要播的音素 key（点字母读的是音素，不是例词 apple / bag） */
const LETTERS=[
  {l:'A a', s:'/æ/ /eɪ/', w:'apple', k:['v_ae','v_ei']},
  {l:'B b', s:'/b/',      w:'bag',   k:['c_b']},
  {l:'C c', s:'/k/ /s/',  w:'cat',   k:['c_k','c_s']},
  {l:'D d', s:'/d/',      w:'dog',   k:['c_d']},
  {l:'E e', s:'/ɛ/ /i/',  w:'egg',   k:['v_e','v_ii']},
  {l:'F f', s:'/f/',      w:'fish',  k:['c_f']},
  {l:'G g', s:'/g/ /dʒ/', w:'go',    k:['c_g','c_j']},
  {l:'H h', s:'/h/',      w:'hat',   k:['c_h']},
  {l:'I i', s:'/ɪ/ /aɪ/', w:'pig',   k:['v_ih','v_ai']},
  {l:'J j', s:'/dʒ/',     w:'jam',   k:['c_j']},
  {l:'K k', s:'/k/',      w:'kite',  k:['c_k']},
  {l:'L l', s:'/l/',      w:'leg',   k:['c_l']},
  {l:'M m', s:'/m/',      w:'man',   k:['c_m']},
  {l:'N n', s:'/n/',      w:'net',   k:['c_n']},
  {l:'O o', s:'/ɑ/ /oʊ/', w:'dog',   k:['v_o','v_ou']},
  {l:'P p', s:'/p/',      w:'pen',   k:['c_p']},
  {l:'Q q', s:'/k/ /w/',  w:'queen', k:['c_k','c_w']},
  {l:'R r', s:'/r/',      w:'red',   k:['c_r']},
  {l:'S s', s:'/s/ /z/',  w:'sun',   k:['c_s','c_z']},
  {l:'T t', s:'/t/',      w:'ten',   k:['c_t']},
  {l:'U u', s:'/ʌ/ /ju/', w:'cup',   k:['v_uh','c_y','v_oo']},
  {l:'V v', s:'/v/',      w:'van',   k:['c_v']},
  {l:'W w', s:'/w/',      w:'wet',   k:['c_w']},
  {l:'X x', s:'/ks/',     w:'box',   k:['c_k','c_s']},
  {l:'Y y', s:'/j/ /aɪ/', w:'yes',   k:['c_y','v_ai']},
  {l:'Z z', s:'/z/',      w:'zoo',   k:['c_z']},
];

/* 录音加载失败时的兜底念法：读「音」本身，绝不读例词。
   例词只是卡片上给孩子看的拼写示范，点下去听到的必须是音素。 */
const IPA_SAY={
  v_ih:'ih', v_e:'eh', v_ae:'aah', v_uh:'uh', v_o:'ah', v_uu:'oo', v_schwa:'uh',
  v_ii:'ee', v_oo:'oo', v_er:'er', v_schwa_r:'er',
  v_ei:'ay', v_ai:'eye', v_oi:'oy', v_au:'ow', v_ou:'oh',
  v_aar:'ar', v_awr:'or', v_ie:'eer', v_ea:'air', v_ue:'oor',
  c_p:'puh', c_b:'buh', c_t:'tuh', c_d:'duh', c_k:'kuh', c_g:'guh',
  c_ch:'chuh', c_j:'juh', c_w:'wuh', c_y:'yuh', c_dh:'thuh',
  c_f:'fff', c_v:'vvv', c_th:'thhh', c_s:'sss', c_z:'zzz',
  c_sh:'shhh', c_zh:'zhh', c_h:'hhh',
  c_m:'mmm', c_n:'nnn', c_ng:'ng', c_l:'lll', c_r:'rrr',
};

/* 音素音频的版本参数统一从 js/ipa-audio-list.js 取（IPA_AUDIO_VER），
   换素材时只改 tools/ipa_build.py 里的 AUDIO_VER，页面不用跟着改。 */
const IPAQ = (typeof IPA_AUDIO_VER !== 'undefined' && IPA_AUDIO_VER) ? IPA_AUDIO_VER : 'a=3';
function ipaTile(it){
  /* 点格子读音素本身（audio/ipa/<key>.m4a，美式女声单独录的 45 个音素），
     不是读例词。data-say 也只是录音失败时的兜底念法（IPA_SAY），同样不是例词。 */
  const say=IPA_SAY[it.k] || it.w[0];
  return `<button class="rf-ipa" data-clipurl="audio/ipa/${it.k}.m4a?${IPAQ}" data-say="${say}">
    <span class="rf-ipa-sym">${it.ipa}</span>
    <span class="rf-ipa-words">${it.w.join(' · ')}</span>
    <span class="rf-ipa-rule">${it.rule}</span>
  </button>`;
}
function renderIpa(){
  const sec=(title,sub,body)=>`<section class="rf-sec">
    <h3 class="rf-h3">${title}<span class="rf-count">${sub}</span></h3>${body}</section>`;
  const grp=(list)=>list.map(g=>`<div class="rf-group">
      <div class="rf-gname">${g.g}</div>
      <div class="rf-ipa-grid">${g.items.map(ipaTile).join('')}</div>
    </div>`).join('');
  /* 字母卡：点一下只读音素（A a → /æ/ 再 /eɪ/），不读 apple。
     data-clipurls 用 | 分隔多个音素，播放器按顺序放。 */
  const letters=`<div class="rf-let-grid">${LETTERS.map(it=>`
      <button class="rf-let" data-clipurls="${it.k.map(k=>`audio/ipa/${k}.m4a?${IPAQ}`).join('|')}" data-say="${it.l.split(' ')[0]}">
        <span class="rf-let-l">${it.l}</span>
        <span class="rf-let-s">${it.s}</span>
        <span class="rf-let-w">${it.w}</span>
      </button>`).join('')}</div>`;
  return sec('① Vowels','21 vowels',grp(IPA_VOWELS))
       + sec('② Consonants','24 consonants',grp(IPA_CONSONANTS))
       + sec('③ Letters &amp; sounds','26 letters · tap to hear the sounds',letters);
}

/* =========================================================
   三、10 以内加减与拆分
   ---------------------------------------------------------
   1) Number bonds 数的分成：2–10 各一行
   2) Addition 加法表：按「和」分组 2–10
   3) Subtraction 减法表：按「被减数」分组 2–10
   点任意算式朗读（数字词 + plus/minus/equals 预录音频拼接，同一把女声）
   ========================================================= */
function renderMathFacts(){
  const sec=(title,sub,body)=>`<section class="rf-sec">
    <h3 class="rf-h3">${title}<span class="rf-count">${sub}</span></h3>${body}</section>`;

  /* 数的分成 */
  const bonds=[];
  for(let n=2;n<=10;n++){
    const pairs=[];
    for(let a=1;a<n;a++) pairs.push(`<button class="rf-fact bond" data-say="${a} plus ${n-a} equals ${n}">${a}+${n-a}</button>`);
    bonds.push(`<div class="rf-bond-row">
      <div class="rf-bond-whole">${n}</div>
      <div class="rf-bond-pairs">${pairs.join('')}</div>
    </div>`);
  }

  /* 加法表：按和分组 */
  const add=[];
  for(let s=2;s<=10;s++){
    const cells=[];
    for(let a=1;a<s;a++) cells.push(`<button class="rf-fact" data-say="${a} plus ${s-a} equals ${s}">${a}+${s-a}=${s}</button>`);
    add.push(`<div class="rf-bond-row">
      <div class="rf-bond-whole">${s}</div>
      <div class="rf-bond-pairs">${cells.join('')}</div>
    </div>`);
  }

  /* 减法表：按被减数分组 */
  const sub=[];
  for(let n=2;n<=10;n++){
    const cells=[];
    for(let b=1;b<n;b++) cells.push(`<button class="rf-fact" data-say="${n} minus ${b} equals ${n-b}">${n}-${b}=${n-b}</button>`);
    sub.push(`<div class="rf-bond-row">
      <div class="rf-bond-whole">${n}</div>
      <div class="rf-bond-pairs">${cells.join('')}</div>
    </div>`);
  }

  return sec('① Number bonds','2 – 10',
      `<p class="rf-lead">Two parts make one whole. Tap a pair to hear it.</p>${bonds.join('')}`)
    + sec('② Addition','sums to 10',
      `<p class="rf-lead">Start with 1+1=2. Each row adds up to the big number.</p>${add.join('')}`)
    + sec('③ Subtraction','within 10',
      `<p class="rf-lead">Take one part away and see what is left.</p>${sub.join('')}`);
}

/* =========================================================
   页面注册表
   ========================================================= */
const REF_PAGES={
  'zh-map':{
    title:'拼音全景 Pinyin Map', emoji:'🗺️', subject:'chinese', lang:'zh-CN',
    hint:'点任意一格听读音 · 声母 23 · 韵母 24 · 整体认读 16 · 四声 4',
    render:renderZhMap,
  },
  'ipa-chart':{
    title:'Sound Chart 音标全景', emoji:'🎵', subject:'english', lang:'en-US',
    hint:'Tap any sound to hear it · 21 vowels + 24 consonants + 26 letters',
    render:renderIpa,
  },
  'math-facts':{
    title:'Facts Chart 10 以内', emoji:'📊', subject:'math', lang:'en-US',
    hint:'Tap any fact to hear it · bonds · addition · subtraction',
    render:renderMathFacts,
  },
};

/* ---------- 需要补录的音频（供 tools/*manifest.js 读取） ---------- */
/* 中文：韵母呼读音（fin2_<韵母>） */
const REF_ZH_FIN2=[];
ZH_FINAL_GROUPS.forEach(g=>g.items.forEach(([p,hz])=>REF_ZH_FIN2.push({key:fin2Key(p),hz})));
/* 英文：音标例词 + 字母例词 */
const REF_EN_WORDS=(function(){
  const set=new Set();
  IPA_VOWELS.concat(IPA_CONSONANTS).forEach(g=>g.items.forEach(it=>it.w.forEach(w=>set.add(w))));
  LETTERS.forEach(it=>set.add(it.w));
  return Array.from(set);
})();

global.REF_PAGES=REF_PAGES;
global.REF_ZH_FIN2=REF_ZH_FIN2;
global.REF_EN_WORDS=REF_EN_WORDS;
})(typeof window!=='undefined'?window:globalThis);
