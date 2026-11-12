/* =========================================================
   汉语拼音 · 认读 / 拼读数据层 v4
   - 声母、韵母用「呼读音」汉字做发音示范（b 读「玻」、a 读「啊」），
     这是小学拼音教学的标准读法，比让 TTS 念英文字母名准确得多。
   - alias 是语音识别结果的同音字白名单：识别器不会输出拼音字母，
     而是输出它「听成」的汉字（如读 b 常出「波 / 播 / bo」），
     所以判音时把结果归一化后按白名单匹配。
   - ZH_BLENDS 只收录真实存在、且有常用汉字的音节，
     保证拼读题不会拼出「ge + i = gei」以外的假拼音。
   本文件被 data.js、gen_zh_audio.js、Node 单测共用。
   ========================================================= */

/* ---------------- 声母（23 个） ---------------- */
const ZH_INITIALS = [
  {p:'b',  hz:'玻', alias:['b','bo','玻','波','播','拨','伯','铂']},
  {p:'p',  hz:'坡', alias:['p','po','坡','泼','颇','婆','破了']},
  {p:'m',  hz:'摸', alias:['m','mo','摸','摩','磨','末','默']},
  {p:'f',  hz:'佛', alias:['f','fo','佛','服','福','夫','扶']},
  {p:'d',  hz:'得', alias:['d','de','得','的','德','地']},
  {p:'t',  hz:'特', alias:['t','te','特','忑','踢','提']},
  {p:'n',  hz:'讷', alias:['n','ne','呢','讷','呐','那','拿']},
  {p:'l',  hz:'勒', alias:['l','le','勒','乐','了','啦','拉']},
  {p:'g',  hz:'哥', alias:['g','ge','哥','歌','戈','割','个']},
  {p:'k',  hz:'科', alias:['k','ke','科','棵','颗','可','课']},
  {p:'h',  hz:'喝', alias:['h','he','喝','和','河','何','贺']},
  {p:'j',  hz:'基', alias:['j','ji','基','鸡','机','几','记']},
  {p:'q',  hz:'欺', alias:['q','qi','欺','七','气','骑','起']},
  {p:'x',  hz:'希', alias:['x','xi','希','西','吸','洗','喜']},
  {p:'zh', hz:'知', alias:['zh','zhi','知','之','只','直','纸']},
  {p:'ch', hz:'吃', alias:['ch','chi','吃','迟','尺','池','赤']},
  {p:'sh', hz:'诗', alias:['sh','shi','诗','师','十','是','时']},
  {p:'r',  hz:'日', alias:['r','ri','日','入','如','热']},
  {p:'z',  hz:'资', alias:['z','zi','资','子','字','紫','自']},
  {p:'c',  hz:'次', alias:['c','ci','次','词','此','刺','瓷']},
  {p:'s',  hz:'思', alias:['s','si','思','四','丝','死','司']},
  {p:'y',  hz:'衣', alias:['y','yi','衣','一','医','依','已']},
  {p:'w',  hz:'乌', alias:['w','wu','乌','屋','五','无','舞']},
];

/* ---------------- 韵母（15 个，与原课程一致） ---------------- */
const ZH_FINALS = [
  {p:'a',   hz:'啊', alias:['a','啊','阿','吖','阿姨']},
  {p:'o',   hz:'喔', alias:['o','喔','哦','噢','偶']},
  {p:'e',   hz:'鹅', alias:['e','鹅','额','俄','饿','恶']},
  {p:'i',   hz:'衣', alias:['i','yi','衣','一','医','依']},
  {p:'u',   hz:'乌', alias:['u','wu','乌','屋','五','无']},
  {p:'ai',  hz:'哀', alias:['ai','哀','爱','矮','唉','艾']},
  {p:'ei',  hz:'诶', alias:['ei','诶','欸','喂','为','位']},
  {p:'ao',  hz:'熬', alias:['ao','熬','凹','奥','傲','袄']},
  {p:'ou',  hz:'欧', alias:['ou','欧','偶','呕','藕']},
  {p:'an',  hz:'安', alias:['an','安','按','岸','案','暗']},
  {p:'en',  hz:'恩', alias:['en','恩','嗯','摁']},
  {p:'ang', hz:'昂', alias:['ang','昂','肮','盎']},
  {p:'eng', hz:'鞥', alias:['eng','鞥','嗯','冷','灯','哼','eng']},
  {p:'ing', hz:'英', alias:['ing','英','鹰','应','樱','赢']},
  {p:'ong', hz:'翁', alias:['ong','翁','嗡','瓮','红','东']},
];

/* ---------------- 整体认读音节（16 个） ----------------
 * 这些音节「不用拼，直接读」，是小学拼音教学里单独列出来的一组：
 * zhi chi shi ri zi ci si yi wu yu ye yue yuan yin yun ying。
 * 用常用字做示范音（zhi → 「知」），判音仍走同音字白名单。 */
const ZH_WHOLES = [
  {p:'zhi',  hz:'知', word:'知道', alias:['zhi','知','只','之','织','直','纸','汁']},
  {p:'chi',  hz:'吃', word:'吃饭', alias:['chi','吃','尺','池','迟','翅','持']},
  {p:'shi',  hz:'狮', word:'狮子', alias:['shi','狮','诗','十','是','时','石','师']},
  {p:'ri',   hz:'日', word:'日出', alias:['ri','日','入','如','热','肉']},
  {p:'zi',   hz:'字', word:'汉字', alias:['zi','字','子','紫','自','资','姿']},
  {p:'ci',   hz:'刺', word:'刺猬', alias:['ci','刺','次','词','此','瓷','慈']},
  {p:'si',   hz:'丝', word:'丝瓜', alias:['si','丝','四','思','司','死','寺']},
  {p:'yi',   hz:'衣', word:'衣服', alias:['yi','衣','一','医','依','椅','已']},
  {p:'wu',   hz:'乌', word:'乌鸦', alias:['wu','乌','屋','五','无','舞','雾']},
  {p:'yu',   hz:'鱼', word:'金鱼', alias:['yu','鱼','雨','玉','语','与','羽']},
  {p:'ye',   hz:'叶', word:'树叶', alias:['ye','叶','夜','爷','也','野','业']},
  {p:'yue',  hz:'月', word:'月亮', alias:['yue','月','乐','越','阅','岳']},
  {p:'yuan', hz:'圆', word:'圆圈', alias:['yuan','圆','元','远','园','原','愿']},
  {p:'yin',  hz:'音', word:'声音', alias:['yin','音','因','银','引','饮','印']},
  {p:'yun',  hz:'云', word:'白云', alias:['yun','云','运','允','晕','韵']},
  {p:'ying', hz:'鹰', word:'老鹰', alias:['ying','鹰','英','影','应','赢','樱']},
];

/* ---------------- 拼读音节库（全部为真实音节 + 常用汉字） ----------------
 * ini + fin = syl；hz 用于示范音，word 用于举例加深印象。
 * tone = 示范字的声调（1–4；0 = 轻声，不标调号）。
 * 题目显示时由 zhToneMark() 给韵母和整个音节补上调号：
 *    b + ā = bā，这样孩子拼读时能看清「这个韵母是第几声」。
 * 注意：音频文件名仍用无调号 syl（audio/zh/blend_<syl>.m4a），
 * 录音本身读的是汉字，声调已经正确。 */
const ZH_BLENDS = [
  {ini:'b',fin:'a',  syl:'ba',   tone:1, hz:'八', word:'八个'},
  {ini:'b',fin:'o',  syl:'bo',   tone:1, hz:'波', word:'波浪'},
  {ini:'b',fin:'i',  syl:'bi',   tone:3, hz:'笔', word:'铅笔'},
  {ini:'b',fin:'u',  syl:'bu',   tone:4, hz:'不', word:'不要'},
  {ini:'b',fin:'an', syl:'ban',  tone:1, hz:'班', word:'班级'},
  {ini:'b',fin:'en', syl:'ben',  tone:3, hz:'本', word:'书本'},
  {ini:'b',fin:'ang',syl:'bang', tone:1, hz:'帮', word:'帮忙'},
  {ini:'p',fin:'a',  syl:'pa',   tone:1, hz:'趴', word:'趴下'},
  {ini:'p',fin:'o',  syl:'po',   tone:1, hz:'坡', word:'山坡'},
  {ini:'p',fin:'i',  syl:'pi',   tone:2, hz:'皮', word:'皮球'},
  {ini:'p',fin:'u',  syl:'pu',   tone:1, hz:'铺', word:'铺路'},
  {ini:'p',fin:'an', syl:'pan',  tone:2, hz:'盘', word:'盘子'},
  {ini:'p',fin:'en', syl:'pen',  tone:2, hz:'盆', word:'花盆'},
  {ini:'p',fin:'ang',syl:'pang', tone:2, hz:'旁', word:'旁边'},
  {ini:'m',fin:'a',  syl:'ma',   tone:1, hz:'妈', word:'妈妈'},
  {ini:'m',fin:'o',  syl:'mo',   tone:1, hz:'摸', word:'摸一摸'},
  {ini:'m',fin:'e',  syl:'me',   tone:0, hz:'么', word:'什么'},
  {ini:'m',fin:'i',  syl:'mi',   tone:3, hz:'米', word:'大米'},
  {ini:'m',fin:'u',  syl:'mu',   tone:4, hz:'木', word:'木头'},
  {ini:'m',fin:'an', syl:'man',  tone:4, hz:'慢', word:'慢慢走'},
  {ini:'m',fin:'en', syl:'men',  tone:2, hz:'门', word:'大门'},
  {ini:'m',fin:'ang',syl:'mang', tone:2, hz:'忙', word:'很忙'},
  {ini:'d',fin:'a',  syl:'da',   tone:4, hz:'大', word:'大小'},
  {ini:'d',fin:'e',  syl:'de',   tone:0, hz:'的', word:'我的'},
  {ini:'d',fin:'i',  syl:'di',   tone:4, hz:'弟', word:'弟弟'},
  {ini:'d',fin:'u',  syl:'du',   tone:2, hz:'读', word:'读书'},
  {ini:'d',fin:'an', syl:'dan',  tone:1, hz:'单', word:'单独'},
  {ini:'d',fin:'ang',syl:'dang', tone:1, hz:'当', word:'当然'},
  {ini:'t',fin:'a',  syl:'ta',   tone:1, hz:'他', word:'他们'},
  {ini:'t',fin:'e',  syl:'te',   tone:4, hz:'特', word:'特别'},
  {ini:'t',fin:'i',  syl:'ti',   tone:1, hz:'踢', word:'踢球'},
  {ini:'t',fin:'u',  syl:'tu',   tone:4, hz:'兔', word:'兔子'},
  {ini:'t',fin:'an', syl:'tan',  tone:2, hz:'谈', word:'谈话'},
  {ini:'t',fin:'ang',syl:'tang', tone:1, hz:'汤', word:'喝汤'},
  {ini:'n',fin:'a',  syl:'na',   tone:2, hz:'拿', word:'拿走'},
  {ini:'n',fin:'e',  syl:'ne',   tone:0, hz:'呢', word:'好呢'},
  {ini:'n',fin:'i',  syl:'ni',   tone:3, hz:'你', word:'你好'},
  {ini:'n',fin:'u',  syl:'nu',   tone:3, hz:'努', word:'努力'},
  {ini:'n',fin:'an', syl:'nan',  tone:2, hz:'南', word:'南方'},
  {ini:'l',fin:'a',  syl:'la',   tone:1, hz:'拉', word:'拉手'},
  {ini:'l',fin:'e',  syl:'le',   tone:4, hz:'乐', word:'快乐'},
  {ini:'l',fin:'i',  syl:'li',   tone:3, hz:'里', word:'里面'},
  {ini:'l',fin:'u',  syl:'lu',   tone:4, hz:'路', word:'马路'},
  {ini:'l',fin:'an', syl:'lan',  tone:2, hz:'蓝', word:'蓝天'},
  {ini:'l',fin:'ang',syl:'lang', tone:2, hz:'狼', word:'大灰狼'},
  {ini:'g',fin:'a',  syl:'ga',   tone:1, hz:'嘎', word:'嘎嘎叫'},
  {ini:'g',fin:'e',  syl:'ge',   tone:1, hz:'哥', word:'哥哥'},
  {ini:'g',fin:'u',  syl:'gu',   tone:1, hz:'姑', word:'姑姑'},
  {ini:'g',fin:'an', syl:'gan',  tone:1, hz:'干', word:'干净'},
  {ini:'g',fin:'en', syl:'gen',  tone:1, hz:'根', word:'树根'},
  {ini:'g',fin:'ang',syl:'gang', tone:1, hz:'钢', word:'钢笔'},
  {ini:'k',fin:'a',  syl:'ka',   tone:1, hz:'咖', word:'咖啡'},
  {ini:'k',fin:'e',  syl:'ke',   tone:1, hz:'科', word:'科学'},
  {ini:'k',fin:'u',  syl:'ku',   tone:1, hz:'哭', word:'哭泣'},
  {ini:'k',fin:'an', syl:'kan',  tone:4, hz:'看', word:'看见'},
  {ini:'k',fin:'en', syl:'ken',  tone:3, hz:'肯', word:'肯定'},
  {ini:'k',fin:'ang',syl:'kang', tone:1, hz:'康', word:'健康'},
  {ini:'h',fin:'a',  syl:'ha',   tone:1, hz:'哈', word:'哈哈笑'},
  {ini:'h',fin:'e',  syl:'he',   tone:1, hz:'喝', word:'喝水'},
  {ini:'h',fin:'u',  syl:'hu',   tone:3, hz:'虎', word:'老虎'},
  {ini:'h',fin:'an', syl:'han',  tone:3, hz:'喊', word:'大喊'},
  {ini:'h',fin:'en', syl:'hen',  tone:3, hz:'很', word:'很好'},
  {ini:'h',fin:'ang',syl:'hang', tone:2, hz:'行', word:'银行'},
];

/* ---------------- 声调标注（题目/选项显示用） ----------------
 * 小学标准标调规则：
 *   1) 有 a 就标 a；没有 a 有 o 就标 o；没有 o 有 e 就标 e
 *   2) 都没有时，iu / ui 标在后一个元音上
 *   3) 只剩一个元音，就标它
 * tone=0 表示轻声 → 不标调号（原样返回） */
const ZH_TONE_MARKS={
  a:['ā','á','ǎ','à'], o:['ō','ó','ǒ','ò'], e:['ē','é','ě','è'],
  i:['ī','í','ǐ','ì'], u:['ū','ú','ǔ','ù'], 'ü':['ǖ','ǘ','ǚ','ǜ']
};
function zhToneMark(syl,tone){
  syl=String(syl||''); tone=Number(tone)||0;
  if(tone<1 || tone>4 || !syl) return syl;
  let idx=-1;
  for(const v of ['a','o','e']){ const i=syl.indexOf(v); if(i>=0){ idx=i; break; } }
  if(idx<0){
    const vs=[...syl].map((c,i)=>/[iuü]/.test(c)?i:-1).filter(i=>i>=0);
    if(!vs.length) return syl;
    idx = vs.length>1 ? vs[vs.length-1] : vs[0];
  }
  const marks=ZH_TONE_MARKS[syl[idx]];
  return marks ? syl.slice(0,idx)+marks[tone-1]+syl.slice(idx+1) : syl;
}
function zhToneName(t){ return (t>=1&&t<=4) ? ['第一声','第二声','第三声','第四声'][t-1] : '轻声'; }
function zhBlendBySyl(syl){ return ZH_BLENDS.find(x=>x.syl===syl); }
/* 带调号的干扰项（拼读题选项统一显示声调） */
function zhBlendDecoysToned(item){
  return zhBlendDecoys(item).map(s=>{
    const d=zhBlendBySyl(s);
    return zhToneMark(s, d ? d.tone : 0);
  });
}


/* ---------------- 四声辨调题库（8 组 × 4 声） ----------------
 * 每组是同一个音节的四个声调，用「单音常用字」录制，
 * 避免 TTS 把孤立拼音字母念成英文字母名、或多音字变调。
 * py = 带调号拼音（答对后才显示），hz = 录音用的字，word = 例词（讲解用）。
 * 题目只给孩子听声音 + 看无调号音节，答案必须靠听辨出来。 */
const ZH_TONES = [
  {base:'ma',   py:['mā','má','mǎ','mà'],       hz:['妈','麻','马','骂'], word:['妈妈','麻花','小马','骂人']},
  {base:'ba',   py:['bā','bá','bǎ','bà'],       hz:['八','拔','把','爸'], word:['八个','拔草','把手','爸爸']},
  {base:'yi',   py:['yī','yí','yǐ','yì'],       hz:['衣','姨','椅','意'], word:['衣服','阿姨','椅子','主意']},
  {base:'wu',   py:['wū','wú','wǔ','wù'],       hz:['屋','无','五','雾'], word:['屋子','无声','五个','大雾']},
  {base:'hu',   py:['hū','hú','hǔ','hù'],       hz:['呼','湖','虎','户'], word:['呼吸','湖水','老虎','窗户']},
  {base:'xi',   py:['xī','xí','xǐ','xì'],       hz:['西','习','洗','细'], word:['西瓜','学习','洗手','细心']},
  {base:'wan',  py:['wān','wán','wǎn','wàn'],   hz:['弯','完','晚','万'], word:['弯腰','完成','晚上','一万']},
  {base:'tang', py:['tāng','táng','tǎng','tàng'], hz:['汤','糖','躺','烫'], word:['喝汤','糖果','躺下','烫伤']},
];
function zhToneClip(base,t){ return zhClip('tone', base+'_'+t); }

/* ---------------- 工具 ---------------- */
function zhClip(kind, key){ return 'audio/zh/'+kind+'_'+key+'.m4a'; }
function zhInitial(p){ return ZH_INITIALS.find(x=>x.p===p); }
function zhFinal(p){ return ZH_FINALS.find(x=>x.p===p); }
function zhWhole(p){ return ZH_WHOLES.find(x=>x.p===p); }

/* 拼读题的两个干扰项：改声母或改韵母，且必须是库里真实存在的音节 */
function zhBlendDecoys(item){
  const sameIni = ZH_BLENDS.filter(x=>x.ini===item.ini && x.syl!==item.syl).map(x=>x.syl);
  const sameFin = ZH_BLENDS.filter(x=>x.fin===item.fin && x.syl!==item.syl).map(x=>x.syl);
  const out=[];
  const a=sameIni.length?pick(sameIni):pick(sameFin);
  if(a && !out.includes(a)) out.push(a);
  const others=[...sameFin,...sameIni].filter(x=>!out.includes(x) && x!==item.syl);
  if(others.length){ const b=pick(others); if(!out.includes(b)) out.push(b); }
  while(out.length<2){
    const c=pick(ZH_BLENDS).syl;
    if(c!==item.syl && !out.includes(c)) out.push(c);
  }
  return out.slice(0,2);
}

/* 语音识别结果归一化：去标点/空格/大小写，保留汉字与拼音字母 */
function zhNormalize(s){
  return String(s||'').toLowerCase()
    .replace(/[\s，。！？、,.!?;；:："'“”‘’()（）\-—_]/g,'')
    .trim();
}
/* 单条转写是否命中某个音的白名单。
 * ASCII 别名（b / bo / zh）必须完全相等，否则 "ba" 会误命中 "a"；
 * 汉字别名允许包含，兼容识别器多吐出的字。 */
function zhHit(t, aliases){
  return aliases.some(a=> /^[a-z]+$/.test(a) ? t===a : t.indexOf(a)>=0);
}
/* 判定一次跟读：ok=读对了 / wrong=明显读成别的音 / 否则=没听清，可重读
 * transcripts 为识别器返回的多个候选（maxAlternatives）。 */
function zhJudge(transcripts, target, pool){
  const list=(transcripts||[]).map(zhNormalize).filter(Boolean);
  const heard=list.join(' / ');
  let ok=false, wrong=false;
  for(const t of list){
    if(zhHit(t,target.alias)){ ok=true; continue; }
    for(const other of pool){
      if(other.p===target.p) continue;
      if(zhHit(t,other.alias)){ wrong=true; break; }
    }
  }
  return { ok, wrong, heard:heard||'(没听清)' };
}

/* Node 环境导出（浏览器里这些是全局 const，不受影响） */
if(typeof module!=='undefined' && module.exports){
  module.exports={ZH_INITIALS,ZH_FINALS,ZH_WHOLES,ZH_BLENDS,ZH_TONES,zhClip,zhToneClip,
                  zhInitial,zhFinal,zhWhole,zhBlendDecoys,zhNormalize,zhHit,zhJudge,
                  zhToneMark,zhToneName,zhBlendBySyl,zhBlendDecoysToned,ZH_TONE_MARKS};
}
