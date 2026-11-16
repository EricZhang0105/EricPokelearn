/* =========================================================
   PokeLearn · Phonics 发音辨析题库（v32）
   ---------------------------------------------------------
   旧题问「cat 的首字母是什么」——看着单词就有答案，毫无意义。
   新题真正考察拼读：
     A 型：cat 里的 a 发什么音？（听音 + 选音标/代表词）
     B 型：哪个词里的 a 和 cat 的 a 发音一样？（判断同音）
     C 型：哪个词含有 /æ/ 这个音？（听音选词）
   答对后给出中文解题思路，重点讲清「短元音 vs 长元音 magic e」
   等规则，直接回应 cat / cake 里 a 发音不同的疑问。

   本文件挂全局 window.PHONIC，供 data.js / question-bank.js /
   question-engine.js 三处调用。加载顺序：data.js 之后、引擎之前。
   ========================================================= */
(function(global){
'use strict';

/* 音表：每个音 = 音标 + 英文音名 + 中文讲解 + 代表词 + 易混音 */
const S = {
  'a-short':{ipa:'/æ/', name:'short a', word:'apple', zh:'短音 a',
    why:'单词 cat 里的字母 a 发<b>短音 /æ/</b>：嘴巴张大、"æ" 一下就收住，和 <b>apple</b> 里的 a 一样。它和 <b>cake</b> 里的 a 不一样——cake 结尾有个不发音的 <b>e</b>（叫 magic e 神奇 e），它把 a 拉成了长音 <b>/eɪ/</b>（a 念自己的名字）。所以 cat 读 /kæt/，cake 读 /keɪk/。',
    say:'Cat, apple. Short a, ae. Cake is different: long a, magic e.', mix:['a-long','e-short','ar']},
  'a-long':{ipa:'/eɪ/', name:'long a', word:'cake', zh:'长音 a（magic e）',
    why:'cake 里的 a 发<b>长音 /eɪ/</b>，也就是字母 a 自己的名字。秘密是结尾那个<b>不发音的 e</b>（magic e 神奇 e）：它不读作音，却让前面的 a 变长。对比 <b>cat</b>：没有 e，a 就发短音 /æ/。所以 cake /keɪk/、cat /kæt/。同样规则：name、game、bike、kite。',
    say:'Cake, long a, ay. The silent e at the end makes a say its name. Cat has no e, so short a.', mix:['a-short','ai','e-long']},
  'e-short':{ipa:'/e/', name:'short e', word:'egg', zh:'短音 e',
    why:'bed、pen、egg 里的 e 都发<b>短音 /e/</b>：嘴巴半开，时间短，像 <b>egg</b> 的 e。别和 a 的短音 /æ/ 搞混——/æ/ 嘴巴张得更大（cat），/e/ 嘴巴小一些（bed）。',
    say:'Bed, pen, egg. Short e, eh. Mouth a little smaller than short a.', mix:['a-short','i-short','e-long']},
  'e-long':{ipa:'/iː/', name:'long e', word:'bee', zh:'长音 e',
    why:'bee、tree、see 里的 ee 发<b>长音 /iː/</b>：嘴角向两边拉开，声音拖长 "eeee"。它和短音 e（bed 的 /e/）完全不同：bed 短促，bee 拉长。',
    say:'Bee, tree, see. Long e, ee. Stretch it: eeee.', mix:['e-short','i-short','a-long']},
  'i-short':{ipa:'/ɪ/', name:'short i', word:'pig', zh:'短音 i',
    why:'pig、sit、big 里的 i 发<b>短音 /ɪ/</b>：嘴巴放松、很短的 "i"，像 <b>pig</b>。它和长音 i /aɪ/（bike 的 i，念字母名字）不同。',
    say:'Pig, sit, big. Short i, ih. Bike is long i, eye.', mix:['i-long','e-short','a-short']},
  'i-long':{ipa:'/aɪ/', name:'long i', word:'bike', zh:'长音 i（magic e）',
    why:'bike、kite、time 里的 i 发<b>长音 /aɪ/</b>，也就是字母 i 自己的名字。又是结尾那个<b>不发音的 e</b>（magic e）在帮忙，把 i 拉长了。对比 pig：没有 e，i 发短音 /ɪ/。',
    say:'Bike, kite, time. Long i, eye. The silent e makes i say its name. Pig is short i.', mix:['i-short','a-long','e-long']},
  'o-short':{ipa:'/ɒ/', name:'short o', word:'box', zh:'短音 o',
    why:'dog、box、top 里的 o 发<b>短音 /o/</b>：嘴巴圆圆地张开，声音短，像 <b>box</b> 的 o。它和长音 o /oʊ/（nose 的 o，念字母名字）不同。',
    say:'Dog, box, top. Short o, oh. Nose is long o.', mix:['o-long','u-short','ar']},
  'o-long':{ipa:'/oʊ/', name:'long o', word:'nose', zh:'长音 o（magic e）',
    why:'nose、home、rose 里的 o 发<b>长音 /oʊ/</b>，也就是字母 o 自己的名字。结尾的<b>不发音 e</b>（magic e）把 o 拉长了。对比 box：没有 e，o 发短音 /o/。',
    say:'Nose, home, rose. Long o, oh. The silent e helps. Box is short o.', mix:['o-short','oa','u-long']},
  'u-short':{ipa:'/ʌ/', name:'short u', word:'cup', zh:'短音 u',
    why:'cup、sun、bus 里的 u 发<b>短音 /ʌ/</b>：嘴巴自然张开、很短的 "uh"，像 <b>cup</b> 的 u。它和长音 u /juː/（cute 的 u）不同。',
    say:'Cup, sun, bus. Short u, uh. Cute is long u.', mix:['u-long','o-short','a-short']},
  'u-long':{ipa:'/juː/', name:'long u', word:'cute', zh:'长音 u（magic e）',
    why:'cute、tube 里的 u 发<b>长音 /juː/</b>，接近字母 u 自己的名字。还是结尾那个<b>不发音 e</b>（magic e）把 u 拉长。对比 cup：没有 e，u 发短音 /ʌ/。',
    say:'Cute, tube. Long u, you. The silent e helps. Cup is short u.', mix:['u-short','o-long']},
  'ar':{ipa:'/ɑː/', name:'ar', word:'car', zh:'ar 组合',
    why:'car、star、far 里的 <b>ar</b> 一起发 /ɑː/：字母 r 改变了 a 的音，嘴巴张大拖长 "ar"，像 <b>car</b>。所以这里的 a 既不是 cat 的短音，也不是 cake 的长音，而是 ar 特有的音。',
    say:'Car, star, far. Ar says ah. The r changes the a.', mix:['a-short','a-long','or']},
  'or':{ipa:'/ɔː/', name:'or', word:'for', zh:'or 组合',
    why:'for、horse、corn 里的 <b>or</b> 一起发 /ɔː/：嘴巴圆圆地拖长 "or"，像 <b>for</b>。字母 r 改变了 o 的音。',
    say:'For, horse, corn. Or says or. The r changes the o.', mix:['o-short','o-long','ar']},
  'er':{ipa:'/ɜː/', name:'er / ir / ur', word:'bird', zh:'er/ir/ur 组合',
    why:'bird 里的 <b>ir</b>、girl 的 ir、nurse 的 <b>ur</b>、her 的 <b>er</b>，都发同一个音 /ɜː/：嘴巴微微张开、声音平平地拖长 "er"。这三种拼写读音一样，要一起记。',
    say:'Bird, girl, nurse, her. Ir, ur, er all say er.', mix:['e-short','ar','or']},
  'ee':{ipa:'/iː/', name:'ee / ea', word:'tree', zh:'ee 组合',
    why:'see、tree、bee 里的 <b>ee</b> 发长音 /iː/：嘴角拉开、拖长 "eeee"。（sea、read 里的 ea 也常发这个音。）两个元音走在一起，通常第一个"发长音、第二个不说话"。',
    say:'See, tree, bee. Ee says ee, long and stretchy.', mix:['e-short','i-short','e-long']},
  'ai':{ipa:'/eɪ/', name:'ai / ay', word:'rain', zh:'ai 组合',
    why:'rain、train、wait 里的 <b>ai</b> 发 /eɪ/（和 cake 的 a 一样念名字）。day、play 里的 <b>ay</b> 也是这个音。口诀："两个元音一起，第一个说自己的名字，第二个不说话。"',
    say:'Rain, train, wait. Ai says ay, like cake. Day and play too.', mix:['a-short','a-long','ee']},
  'oa':{ipa:'/oʊ/', name:'oa', word:'boat', zh:'oa 组合',
    why:'boat、coat、goat 里的 <b>oa</b> 发 /oʊ/（和 nose 的 o 一样念名字）。两个元音一起，o 说自己的名字、a 不说话。',
    say:'Boat, coat, goat. Oa says oh, like nose.', mix:['o-short','o-long','oo']},
  'oo':{ipa:'/uː/', name:'oo', word:'moon', zh:'oo 组合',
    why:'moon、food、zoo 里的 <b>oo</b> 发长音 /uː/：嘴巴撅圆、拖长 "oo"。（注意 book 里的 oo 是短音，是例外。）',
    say:'Moon, food, zoo. Oo says oo, long. Book is the short one.', mix:['o-short','o-long','u-short']},
  'ou':{ipa:'/aʊ/', name:'ou / ow', word:'house', zh:'ou 组合',
    why:'house、mouse、cloud 里的 <b>ou</b> 发 /aʊ/：从 "a" 滑到 "u"，像 <b>house</b>。cow、how 里的 <b>ow</b> 也是这个音。',
    say:'House, mouse, cloud. Ou says ow. Cow and how too.', mix:['o-short','o-long','u-short']},
  'sh':{ipa:'/ʃ/', name:'sh', word:'ship', zh:'sh 组合',
    why:'<b>s 和 h 手拉手</b>变成一个新音 /ʃ/：嘴唇噘起、"嘘——"，像 <b>ship</b>、fish、shop。单独的 s 发 /s/（sun），不一样哦。',
    say:'Ship, fish, shop. Sh says shhh. S alone says s, like sun.', mix:['ch','th']},
  'ch':{ipa:'/tʃ/', name:'ch', word:'chair', zh:'ch 组合',
    why:'<b>c 和 h 手拉手</b>变成 /tʃ/：像打喷嚏前的 "ch"，像 <b>chair</b>、cheese、lunch。它比 sh 多了一个短短的 "t" 起头。',
    say:'Chair, cheese, lunch. Ch says ch. Sh is softer.', mix:['sh','th']},
  'th':{ipa:'/θ/', name:'th', word:'three', zh:'th 组合',
    why:'<b>t 和 h 手拉手</b>变成 /θ/：舌尖轻轻放在上下牙中间吹气，像 <b>three</b>、think、bath。（this 里的 th 是带声的另一个音。）',
    say:'Three, think, bath. Tongue between the teeth: th.', mix:['sh','ch']},
  'wh':{ipa:'/w/', name:'wh', word:'white', zh:'wh 组合',
    why:'<b>w 和 h 手拉手</b>通常还是发 /w/：嘴巴撅圆、很快放开，像 <b>white</b>、what、where。',
    say:'White, what, where. Wh says w.', mix:['sh','ch']},
};

/* 词表：[单词, 目标字母位置] —— 位置从 0 开始。
   每音 10+ 个真实例词，三型合计 700+ 道，连续 30+ 套不重复。
   复合音（sh/ch/th/wh/ee/ai/oa/oo/ou/ar/or/er）位置指向字母组合的开头。 */
const WORDS = {
  'a-short':[['cat',1],['hat',1],['map',1],['bag',1],['fan',1],['cap',1],['dad',1],['sad',1],['apple',0],['ant',0],['jam',1],['ham',1],['van',1],['man',1],['pan',1],['ran',1],['gas',1],['flag',2]],
  'a-long':[['cake',1],['name',1],['game',1],['face',1],['gate',1],['late',1],['tape',1],['grape',2],['plane',2],['brave',2],['made',2],['shade',2],['chase',2],['tale',1]],
  'e-short':[['bed',1],['pen',1],['net',1],['red',1],['hen',1],['egg',0],['ten',1],['leg',1],['pet',1],['web',1],['wet',1],['vet',1],['jet',1],['get',1],['set',1],['bell',1]],
  'e-long':[['bee',1],['see',1],['tree',2],['green',2],['sleep',2],['me',0],['he',0],['she',1],['we',0],['be',0],['these',2],['theme',2],['Pete',2]],
  'i-short':[['pig',1],['sit',1],['big',1],['fish',1],['pin',1],['win',1],['lip',1],['hip',1],['rim',1],['rib',1],['hid',1],['lid',1],['kid',1],['tip',1],['wig',1],['fig',1]],
  'i-long':[['bike',1],['kite',1],['time',1],['nine',1],['like',1],['ride',1],['hide',1],['side',1],['wide',1],['mine',1],['fine',1],['line',1],['shine',2],['white',1]],
  'o-short':[['dog',1],['box',1],['top',1],['hot',1],['fox',1],['mop',1],['hop',1],['pop',1],['pot',1],['cot',1],['dot',1],['got',1],['lot',1],['rob',1],['cob',1]],
  'o-long':[['nose',1],['home',1],['rose',1],['note',1],['hole',1],['rope',1],['hope',1],['cone',1],['bone',1],['stone',2],['those',2],['vote',1],['joke',1]],
  'u-short':[['cup',1],['bus',1],['sun',1],['bug',1],['run',1],['duck',1],['nut',1],['hut',1],['cut',1],['but',1],['pup',1],['cub',1],['tub',1],['mud',1],['bud',1]],
  'u-long':[['cute',1],['tube',1],['use',1],['mule',1],['rule',1],['June',1],['rude',1],['flute',2],['prune',2],['huge',1]],
  'ar':[['car',1],['star',1],['far',1],['arm',1],['art',1],['cart',1],['part',1],['hard',1],['card',1],['park',1],['bark',1],['dark',1]],
  'or':[['for',1],['horse',2],['corn',2],['born',2],['horn',2],['short',2],['sort',2],['port',2],['cork',2],['storm',2],['more',1],['north',2]],
  'er':[['bird',1],['girl',1],['nurse',2],['her',0],['fir',0],['fur',0],['sir',0],['stir',1],['turn',1],['burn',1],['hurt',1],['curl',1],['shirt',2],['third',2]],
  'ee':[['see',1],['tree',2],['bee',1],['green',2],['sleep',2],['feel',1],['keep',1],['deep',1],['free',1],['sweet',2],['three',2],['week',1],['feed',1],['seed',1]],
  'ai':[['rain',1],['train',2],['wait',2],['tail',2],['mail',1],['sail',1],['pain',1],['main',1],['snail',2],['paint',2],['day',1],['play',1],['say',1],['way',1]],
  'oa':[['boat',1],['coat',1],['goat',1],['road',1],['soap',1],['toast',2],['coast',2],['loaf',1],['roast',2]],
  'oo':[['moon',1],['food',1],['zoo',1],['room',1],['spoon',2],['cool',1],['pool',1],['tool',1],['soon',1],['noon',1]],
  'ou':[['house',2],['mouse',2],['cloud',2],['out',1],['cow',1],['how',1],['now',1],['down',1],['town',1],['brown',2],['crown',2]],
  'sh':[['ship',0],['fish',2],['shop',0],['dish',2],['wish',2],['wash',1],['brush',3],['she',0],['shell',0],['sheep',0],['shirt',0]],
  'ch':[['chair',0],['cheese',0],['lunch',3],['much',2],['such',2],['rich',2],['chat',0],['chin',0],['chip',0],['chick',0],['bench',3]],
  'th':[['three',0],['think',0],['bath',3],['thank',0],['thick',0],['thin',0],['mouth',3],['tooth',3],['path',3],['math',2],['thorn',0]],
  'wh':[['white',0],['what',0],['where',0],['when',0],['which',0],['why',0],['whale',0],['wheel',0],['whip',0]],
};

const KEYS = Object.keys(S);
function hn(s){let h=0; s=String(s||''); for(let i=0;i<s.length;i++){h=(h*31+s.charCodeAt(i))>>>0;} return h;}
function shuffle(a){a=a.slice(); for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];} return a;}

/* 每个音的基础难度 1–5，供难度渐进排序 */
const TIER={'a-short':1,'e-short':1,'i-short':1,'o-short':1,'u-short':1,
  'sh':2,'ch':2,'th':2,'wh':2,'e-long':2,
  'a-long':3,'i-long':3,'o-long':3,'u-long':3,
  'ee':3,'ai':3,'oa':3,'oo':3,'ar':3,'or':3,'ou':4,'er':4};
/* 取干扰音：必须音标与正确答案不同（否则两个选项同音，孩子无所适从），
   优先用标注的易混音，不够再按全局补齐。 */
function mixSounds(key){
  const myIpa=S[key].ipa, cand=[];
  (S[key].mix||[]).forEach(k=>{if(S[k]&&S[k].ipa!==myIpa&&cand.indexOf(k)<0)cand.push(k);});
  for(const k of KEYS){ if(cand.length>=3)break; if(k!==key&&S[k].ipa!==myIpa&&cand.indexOf(k)<0)cand.push(k); }
  return cand.slice(0,3);
}
/* 高亮目标字母：把第 pos 个字符包上 <b> */
function mark(word,pos){
  const grp=/^(sh|ch|th|wh|ee|ea|ai|ay|oa|oo|ou|ow|ar|or|er|ir|ur|ck)$/;
  if(pos+1<word.length && grp.test(word.slice(pos,pos+2)))
    return word.slice(0,pos)+'<b>'+word.slice(pos,pos+2)+'</b>'+word.slice(pos+2);
  return word.slice(0,pos)+'<b>'+word[pos]+'</b>'+word.slice(pos+1);
}
/* 目标字母/字母组合的显示名 */
function letterOf(word,pos){
  const grp=/^(sh|ch|th|wh|ee|ea|ai|ay|oa|oo|ou|ow|ar|or|er|ir|ur|ck)$/;
  if(pos+1<word.length && grp.test(word.slice(pos,pos+2))) return word.slice(pos,pos+2);
  return word[pos];
}
function opt(sk){ return S[sk].ipa+' '+S[sk].word; }
function base(key,word,pos,type,seed){
  const s=S[key];
  return {
    type:'choice', kind:'phonics', soundKey:key,
    speak:{text:word,lang:'en-US',forceAuto:true},
    answerSpeak:{text:s.say,lang:'en-US'},
    explain:`<b>${s.zh} ${s.ipa}</b><br>${s.why}`,
    feedbackDelay:9000,
    qid:'ph'+type+'-'+key+'-'+word+'-'+(type==='C'?s.ipa.replace(/[^\w]/g,''):'')
  };
}

/* =========================================================
   确定性枚举：先把所有「音 × 词 × 题型」全部列出来，再稳定打乱。
   - 每题 qid 由 题型+音+词 决定，跨套稳定，QEngine 可精确去重。
   - 单词总数远超 200，A/B/C 三型合计 600+，题库天然充足。
   - 选项顺序随机（不影响 qid），干扰项音标必不同于答案。
   ========================================================= */
function _allQuestions(){
  const all=[];
  KEYS.forEach(key=>{
    const s=S[key], list=WORDS[key]||[], mixes=mixSounds(key);
    list.forEach(([word,pos])=>{
      const L=letterOf(word,pos);
      /* ---- A 型：给出一个词并高亮字母，问它发什么音 ---- */
      {
        const q=base(key,word,pos,'A');
        q.prompt=`What sound does the <b>${L}</b> in "${word}" make?`;
        q.sub=`🔤 ${mark(word,pos)} &nbsp;—&nbsp; 听一听，加粗部分的发音`;
        q.options=shuffle([opt(key),opt(mixes[0]),opt(mixes[1]),opt(mixes[2])]);
        q.answer=opt(key);
        q.qid='phA-'+key+'-'+word+'-'+pos;
        q.tier=Math.max(1,Math.min(5,TIER[key]||2));
        all.push(q);
      }
      /* ---- B 型：哪个词里的目标字母和例词发音一样 ---- */
      if(list.length>=2){
        const same=list.filter(x=>x[0]!==word);
        const right=same[0][0];
        const wrong=shuffle(mixes.map(k=>S[k].word)).slice(0,3);
        const q=base(key,word,pos,'B');
        q.prompt=`Which word has the SAME sound as <b>${L}</b> in "${word}"?`;
        q.sub=`🔤 ${mark(word,pos)} &nbsp;→&nbsp; ${s.ipa}`;
        q.options=shuffle([right].concat(wrong));
        q.answer=right;
        q.explain=`<b>它们读音一样！</b><br>${word} 和 <b>${right}</b> 里的 "${L}" 都发 ${s.ipa}。<br>${s.why}`;
        q.say=`${word} and ${right} have the same sound. ${s.say}`;
        q.answerSpeak={text:q.say,lang:'en-US'};
        q.qid='phB-'+key+'-'+word+'-'+pos;
        q.tier=Math.max(1,Math.min(5,(TIER[key]||2)));
        all.push(q);
      }
    });
    /* ---- C 型：听音标对应代表词，选出含有该音的单词 ---- */
    list.forEach(([word,pos])=>{
      const q=base(key,word,pos,'C');
      q.prompt=`Which word has the "${s.ipa}" sound?`;
      q.sub=`👂 听一听，哪个词含有 <b>${s.ipa}</b> 这个音？`;
      q.speak={text:word,lang:'en-US',forceAuto:true};
      q.options=shuffle([word].concat(mixes.map(k=>S[k].word)).slice(0,4));
      q.answer=word;
      q.qid='phC-'+key+'-'+word+'-'+pos;
      q.tier=Math.max(1,Math.min(5,(TIER[key]||2)+1));
      all.push(q);
    });
  });
  return all;
}
let _ALL=null;
function all(){ if(!_ALL) _ALL=_allQuestions(); return _ALL; }
/* 稳定打乱（按 qid 做键，跨设备一致，便于去重排序） */
function stableShuffle(arr,seed){
  const a=arr.slice();
  a.forEach((x,i)=>{ x._s=hn((seed||'')+x.qid)+ (x.qid.length*2654435761>>>0)*0.000001; });
  a.sort((p,q)=>p._s-q._s);
  a.forEach(x=>{ delete x._s; });
  return a;
}
/* 生成一套题：核心是「一套 n 题尽量覆盖 n 个不同的音」。
   旧实现按 tier 排序后从同一个音里连取多题 → 一套里 a/e/i 反复出现，
   孩子看着就像重复题。现在按「音」分组轮转：贴近当前难度的音优先，
   每个音一套里最多出一题，音内 A/B/C 三型随机。 */
function make(n, level, spread){
  n=n||10; level=level||1;
  const pool=all();
  // 按 soundKey 分桶
  const byKey={};
  pool.forEach(q=>{ (byKey[q.soundKey]=byKey[q.soundKey]||[]).push(q); });
  // 音的出场顺序：贴近当前 level 的优先；超纲两档以上的压后；同档随机
  const keyOrder=Object.keys(byKey).map(k=>{
    const t=TIER[k]||2;
    return {k, score:(t>level+1?100:0)+Math.abs(t-level)*10+Math.random()*8};
  }).sort((a,b)=>a.score-b.score).map(x=>x.k);
  keyOrder.forEach(k=>{ byKey[k]=shuffle(byKey[k]); });
  // 轮转：第一轮每个音各出一题（保证音不重复），不够再进第二轮换题型
  const out=[], usedSound=new Set();
  for(let round=0; out.length<n && round<n+3; round++){
    for(const k of keyOrder){
      if(out.length>=n) break;
      if(!byKey[k].length) continue;
      if(round===0 && usedSound.has(k)) continue;
      let q=byKey[k].shift();
      // 第二轮起，优先换个题型（A/B/C），同一音不同问法也更新鲜
      if(round>0){
        const lastType=out.length?out[out.length-1].qid[2]:'';
        const alt=byKey[k].findIndex(x=>x.qid[2]!==lastType);
        if(alt>0){ const pick=byKey[k].splice(alt,1)[0]; byKey[k].unshift(q); q=pick; }
      }
      out.push(q); usedSound.add(k);
    }
  }
  return out.slice(0,n);
}
function capacity(level,spread){ const c=all().length; return {count:c,unique:c}; }

/* 全量题集：供统一题库 Bank 建立 ≥200 道的确定性题库 */
function fullSet(){ return all().map(q=>Object.assign({},q)); }
global.PHONIC={ make, capacity, fullSet, sounds:S, words:WORDS, keys:KEYS };
})(typeof window!=='undefined'?window:globalThis);
