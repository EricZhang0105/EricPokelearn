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

/* ---------------- 拼读音节库（全部为真实音节 + 常用汉字） ---------------- */
/* ini + fin = syl；hz 用于示范音，word 用于举例加深印象 */
const ZH_BLENDS = [
  {ini:'b',fin:'a',  syl:'ba',   hz:'八', word:'八个'},
  {ini:'b',fin:'o',  syl:'bo',   hz:'波', word:'波浪'},
  {ini:'b',fin:'i',  syl:'bi',   hz:'笔', word:'铅笔'},
  {ini:'b',fin:'u',  syl:'bu',   hz:'不', word:'不要'},
  {ini:'b',fin:'an', syl:'ban',  hz:'班', word:'班级'},
  {ini:'b',fin:'en', syl:'ben',  hz:'本', word:'书本'},
  {ini:'b',fin:'ang',syl:'bang', hz:'帮', word:'帮忙'},
  {ini:'p',fin:'a',  syl:'pa',   hz:'趴', word:'趴下'},
  {ini:'p',fin:'o',  syl:'po',   hz:'坡', word:'山坡'},
  {ini:'p',fin:'i',  syl:'pi',   hz:'皮', word:'皮球'},
  {ini:'p',fin:'u',  syl:'pu',   hz:'铺', word:'铺路'},
  {ini:'p',fin:'an', syl:'pan',  hz:'盘', word:'盘子'},
  {ini:'p',fin:'en', syl:'pen',  hz:'盆', word:'花盆'},
  {ini:'p',fin:'ang',syl:'pang', hz:'旁', word:'旁边'},
  {ini:'m',fin:'a',  syl:'ma',   hz:'妈', word:'妈妈'},
  {ini:'m',fin:'o',  syl:'mo',   hz:'摸', word:'摸一摸'},
  {ini:'m',fin:'e',  syl:'me',   hz:'么', word:'什么'},
  {ini:'m',fin:'i',  syl:'mi',   hz:'米', word:'大米'},
  {ini:'m',fin:'u',  syl:'mu',   hz:'木', word:'木头'},
  {ini:'m',fin:'an', syl:'man',  hz:'慢', word:'慢慢走'},
  {ini:'m',fin:'en', syl:'men',  hz:'门', word:'大门'},
  {ini:'m',fin:'ang',syl:'mang', hz:'忙', word:'很忙'},
  {ini:'d',fin:'a',  syl:'da',   hz:'大', word:'大小'},
  {ini:'d',fin:'e',  syl:'de',   hz:'的', word:'我的'},
  {ini:'d',fin:'i',  syl:'di',   hz:'弟', word:'弟弟'},
  {ini:'d',fin:'u',  syl:'du',   hz:'读', word:'读书'},
  {ini:'d',fin:'an', syl:'dan',  hz:'单', word:'单独'},
  {ini:'d',fin:'ang',syl:'dang', hz:'当', word:'当然'},
  {ini:'t',fin:'a',  syl:'ta',   hz:'他', word:'他们'},
  {ini:'t',fin:'e',  syl:'te',   hz:'特', word:'特别'},
  {ini:'t',fin:'i',  syl:'ti',   hz:'踢', word:'踢球'},
  {ini:'t',fin:'u',  syl:'tu',   hz:'兔', word:'兔子'},
  {ini:'t',fin:'an', syl:'tan',  hz:'谈', word:'谈话'},
  {ini:'t',fin:'ang',syl:'tang', hz:'汤', word:'喝汤'},
  {ini:'n',fin:'a',  syl:'na',   hz:'拿', word:'拿走'},
  {ini:'n',fin:'e',  syl:'ne',   hz:'呢', word:'好呢'},
  {ini:'n',fin:'i',  syl:'ni',   hz:'你', word:'你好'},
  {ini:'n',fin:'u',  syl:'nu',   hz:'努', word:'努力'},
  {ini:'n',fin:'an', syl:'nan',  hz:'南', word:'南方'},
  {ini:'l',fin:'a',  syl:'la',   hz:'拉', word:'拉手'},
  {ini:'l',fin:'e',  syl:'le',   hz:'乐', word:'快乐'},
  {ini:'l',fin:'i',  syl:'li',   hz:'里', word:'里面'},
  {ini:'l',fin:'u',  syl:'lu',   hz:'路', word:'马路'},
  {ini:'l',fin:'an', syl:'lan',  hz:'蓝', word:'蓝天'},
  {ini:'l',fin:'ang',syl:'lang', hz:'狼', word:'大灰狼'},
  {ini:'g',fin:'a',  syl:'ga',   hz:'嘎', word:'嘎嘎叫'},
  {ini:'g',fin:'e',  syl:'ge',   hz:'哥', word:'哥哥'},
  {ini:'g',fin:'u',  syl:'gu',   hz:'姑', word:'姑姑'},
  {ini:'g',fin:'an', syl:'gan',  hz:'干', word:'干净'},
  {ini:'g',fin:'en', syl:'gen',  hz:'根', word:'树根'},
  {ini:'g',fin:'ang',syl:'gang', hz:'钢', word:'钢笔'},
  {ini:'k',fin:'a',  syl:'ka',   hz:'咖', word:'咖啡'},
  {ini:'k',fin:'e',  syl:'ke',   hz:'科', word:'科学'},
  {ini:'k',fin:'u',  syl:'ku',   hz:'哭', word:'哭泣'},
  {ini:'k',fin:'an', syl:'kan',  hz:'看', word:'看见'},
  {ini:'k',fin:'en', syl:'ken',  hz:'肯', word:'肯定'},
  {ini:'k',fin:'ang',syl:'kang', hz:'康', word:'健康'},
  {ini:'h',fin:'a',  syl:'ha',   hz:'哈', word:'哈哈笑'},
  {ini:'h',fin:'e',  syl:'he',   hz:'喝', word:'喝水'},
  {ini:'h',fin:'u',  syl:'hu',   hz:'虎', word:'老虎'},
  {ini:'h',fin:'an', syl:'han',  hz:'喊', word:'大喊'},
  {ini:'h',fin:'en', syl:'hen',  hz:'很', word:'很好'},
  {ini:'h',fin:'ang',syl:'hang', hz:'行', word:'银行'},
];

/* ---------------- 工具 ---------------- */
function zhClip(kind, key){ return 'audio/zh/'+kind+'_'+key+'.m4a'; }
function zhInitial(p){ return ZH_INITIALS.find(x=>x.p===p); }
function zhFinal(p){ return ZH_FINALS.find(x=>x.p===p); }

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
  module.exports={ZH_INITIALS,ZH_FINALS,ZH_BLENDS,zhClip,zhInitial,zhFinal,
                  zhBlendDecoys,zhNormalize,zhHit,zhJudge};
}
