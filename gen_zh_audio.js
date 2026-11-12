/* 生成中文拼音模块的本地音频（不依赖设备 TTS，iPad 上读音一致、离线可听）
 *   1) 声母 / 韵母：呼读音汉字读两遍（b → 「玻，玻」）
 *   2) 拼读练习：声母 → 韵母 → 合起来 → 例词，四段播报
 *   3) 汉字配对：单字读两遍
 *   4) 声调练习：8 组音节 × 4 声，单音字读两遍（孩子靠听辨调，不显示调号）
 * 运行： node gen_zh_audio.js   （已生成的会跳过，可重复运行）
 * 依赖： macOS say / afconvert
 * 产物： audio/zh/*.m4a, js/zh-audio-list.js
 */
const fs=require('fs'), path=require('path'), vm=require('vm'), crypto=require('crypto');
const {execFileSync}=require('child_process');

const ROOT=__dirname;
const OUT=path.join(ROOT,'audio','zh');
const TMP='/tmp/pokelearn-zh-tts';
const VOICE='Flo (中文（中国大陆）)';   // Apple 新一代普通话女声，咬字比 Tingting 更完整
const RATE=125;                         // 稍慢，5 岁小朋友听得清
fs.mkdirSync(OUT,{recursive:true}); fs.mkdirSync(TMP,{recursive:true});

/* 读取拼音表与汉字表 */
const ctx={console}; ctx.globalThis=ctx; vm.createContext(ctx);
vm.runInContext(
  'function ri(){return 0} function pick(a){return a[0]} function shuffle(a){return a.slice()}\n'+
  fs.readFileSync(path.join(ROOT,'js','zh-phonics.js'),'utf8')+'\n'+
  fs.readFileSync(path.join(ROOT,'js','data.js'),'utf8')+'\n'+
  ';globalThis.__X={ZH_INITIALS,ZH_FINALS,ZH_BLENDS,ZH_TONES,CHARS,zhInitial,zhFinal};',ctx);
const {ZH_INITIALS,ZH_FINALS,ZH_BLENDS,ZH_TONES,CHARS,zhInitial,zhFinal}=ctx.__X;

const tasks=[];
function add(kind,key,text){
  const f=kind+'_'+key+'.m4a';
  const rel='audio/zh/'+f;
  tasks.push({out:path.join(OUT,f), rel, text});
}

/* --- 声母 / 韵母示范音 --- */
ZH_INITIALS.forEach(t=>add('initial',t.p,`${t.hz}，${t.hz}。`));
ZH_FINALS.forEach(t=>add('final',t.p,`${t.hz}，${t.hz}。`));

/* --- 拼读播报：玻，啊，八。八个。 --- */
ZH_BLENDS.forEach(it=>{
  const i=zhInitial(it.ini), f=zhFinal(it.fin);
  const a=i?i.hz:it.ini, b=f?f.hz:it.fin;
  add('blend',it.syl,`${a}，${b}，${it.hz}。${it.word}。`);
});

/* --- 汉字读音 --- */
CHARS.forEach((ch,i)=>add('char',i,`${ch.c}，${ch.c}。`));

/* --- 声调示范音：同一个音节的四个声调，只录单音字，不加提示语 --- */
ZH_TONES.forEach(g=>g.hz.forEach((hz,i)=>add('tone',g.base+'_'+(i+1),`${hz}，${hz}。`)));

console.log(`待生成 ${tasks.length} 段中文音频：${ZH_INITIALS.length} 声母 / ${ZH_FINALS.length} 韵母 / ${ZH_BLENDS.length} 拼读 / ${CHARS.length} 汉字 / ${ZH_TONES.length*4} 声调`);

let done=0,skip=0; const fail=[];
for(const t of tasks){
  if(fs.existsSync(t.out) && fs.statSync(t.out).size>1000){ skip++; continue; }
  const wav=path.join(TMP,crypto.createHash('md5').update(t.rel).digest('hex').slice(0,10)+'.wav');
  try{
    execFileSync('/usr/bin/say',['-v',VOICE,'-r',String(RATE),
      '--file-format=WAVE','--data-format=LEI16@22050','-o',wav,t.text],{stdio:'ignore'});
    execFileSync('/usr/bin/afconvert',[wav,'-f','m4af','-d','aac','-b','64000','-o',t.out],{stdio:'ignore'});
    done++;
  }catch(e){ fail.push(t.rel+': '+e.message.split('\n')[0]); }
  if((done+skip)%25===0) console.log(`  进度 ${done+skip}/${tasks.length}`);
}
console.log(`完成：新生成 ${done}，跳过 ${skip}，失败 ${fail.length}`);
if(fail.length) console.log(fail.slice(0,10).join('\n'));

/* 输出清单供 Service Worker 预缓存（importScripts 读取） */
const list=tasks.map(t=>t.rel);
/* 用 self.xxx 属性赋值，不要用 const：importScripts 与 sw.js 共享全局词法环境，
   同名 const/let 会抛 "already been declared"，导致预缓存清单读不到。 */
fs.writeFileSync(path.join(ROOT,'js','zh-audio-list.js'),
  '/* 由 gen_zh_audio.js 自动生成，勿手工编辑 */\n'+
  'self.ZH_AUDIO_LIST = '+JSON.stringify(list,null,2)+';\n');
const bytes=fs.readdirSync(OUT).reduce((s,f)=>s+fs.statSync(path.join(OUT,f)).size,0);
console.log(`中文音频体积：${(bytes/1024/1024).toFixed(2)} MB，共 ${list.length} 段`);
