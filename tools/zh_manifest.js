/* 生成中文语音清单（供 tools/zh_tts_build.py 录音）
 *   node tools/zh_manifest.js > tools/zh_manifest.json
 *
 * 与 gen_zh_audio.js 的区别：
 *   1) 每段只读「一遍」（旧库是读两遍 —— 拼读四步里每一步都被念两次）
 *   2) 新增 tonefin_<韵母>_<声调>：把「带调韵母」单独录音（旧库缺失，只能走设备 TTS，
 *      设备会忽略调号 → 第四声被读成第一声）
 *   3) 新增 syl_<音节>：只读音节本身，给四步拼读的最后一步用
 *   4) blend_<音节> 改为「音节。例词。」：旧版是「声母，韵母，音节。例词。」，
 *      念出了声母/韵母 → 题库里「听一听 bù 的声母是？」等于把答案直接读出来
 *
 * 音色唯一性：只允许一把女声（见 zh_tts_build.py 的 VOICE）。
 */
const fs=require('fs'), path=require('path'), vm=require('vm');
const ROOT=path.join(__dirname,'..');
const J=f=>path.join(ROOT,'js',f);

const ctx={console}; ctx.globalThis=ctx; vm.createContext(ctx);
let src='function ri(){return 0} function pick(a){return a[0]} function shuffle(a){return a.slice()}\n';
for(const f of ['zh-phonics.js','data.js']) src+='\n'+fs.readFileSync(J(f),'utf8');
vm.runInContext(src+';globalThis.__X={ZH_INITIALS,ZH_FINALS,ZH_WHOLES,ZH_BLENDS,ZH_TONES,CHARS,zhToneMark};',ctx);
const {ZH_INITIALS,ZH_FINALS,ZH_WHOLES,ZH_BLENDS,ZH_TONES,CHARS,zhToneMark}=ctx.__X;

/* 带调韵母的朗读写法：i、u 用零声母拼写（yī / wū），其它直接写带调韵母。
 * 实测引擎拒绝孤立的 "ù"，但接受 "wù"；而 w/y 是零声母滑音，读音与韵母本身一致。 */
const ZERO_INITIAL={
  i:['yī','yí','yǐ','yì'],
  u:['wū','wú','wǔ','wù'],
  ü:['yū','yú','yǔ','yù'],
};

const tasks=[]; const seen=new Set();
function add(kind,key,text,extra){
  const id=`${kind}_${key}`;
  if(seen.has(id)) return;
  seen.add(id);
  tasks.push(Object.assign({id,kind,key,text,file:`${kind}_${key}.m4a`},extra||{}));
}

/* 声母 / 韵母 / 整体认读：呼读音，只读一遍 */
ZH_INITIALS.forEach(t=>add('initial',t.p,`${t.hz}。`));
ZH_FINALS.forEach(t=>add('final',t.p,`${t.hz}。`));
ZH_WHOLES.forEach(t=>add('whole',t.p,`${t.hz}。`));

/* 拼读：音节。例词。 */
ZH_BLENDS.forEach(it=>add('blend',it.syl,`${it.hz}。${it.word}。`));
/* 只读音节（拼读第四步） */
ZH_BLENDS.forEach(it=>add('syl',it.syl,`${it.hz}。`));

/* 汉字 */
CHARS.forEach((ch,i)=>add('char',String(i),`${ch.c}。`));

/* 四声辨调（8 组 × 4 声）：只读一遍 */
ZH_TONES.forEach(g=>g.hz.forEach((hz,i)=>add('tone',g.base+'_'+(i+1),`${hz}。`)));

/* 带调韵母：按题库实际用到的「韵母 × 声调」组合生成 */
const need=new Map();
ZH_BLENDS.forEach(it=>{
  const t=Number(it.tone)||0;
  if(t<1||t>4) return;                     // 轻声不标调，直接复用韵母呼读音
  const k=it.fin+'|'+t;
  if(!need.has(k)) need.set(k,{fin:it.fin,tone:t});
});
/* 引擎对「单独读的 en」完全不分调（ēn/én/ěn 三条曲线一样），
   改为从真实字里切掉声母，只留带调韵母。 */
const DERIVED={ en:['奔','门','本','笨'] };
need.forEach(({fin,tone})=>{
  if(DERIVED[fin]){
    add('tonefin',fin+'_'+tone,DERIVED[fin][tone-1],{fin,tone,cut:true});
    return;
  }
  const zi=ZERO_INITIAL[fin];
  const text=zi ? zi[tone-1] : zhToneMark(fin,tone);
  add('tonefin',fin+'_'+tone,text,{fin,tone,flat:(tone===1)});
});

console.log(JSON.stringify({
  voiceNote:'单一普通话女声，禁止变声/变调；每段只读一遍',
  count:tasks.length,
  items:tasks
},null,1));
