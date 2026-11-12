/* 生成中文拼音模块的本地音频（不依赖设备 TTS，iPad 上读音一致、离线可听）
 *   1) 声母 / 韵母：呼读音汉字读两遍（b → 「玻，玻」）
 *   2) 整体认读音节：16 个，示范字读两遍（zhi → 「知，知」）
 *   3) 拼读练习：声母 → 韵母 → 合起来 → 例词，四段播报
 *   4) 汉字配对：单字读两遍
 *   5) 声调练习：8 组音节 × 4 声，单音字读两遍（孩子靠听辨调，不显示调号）
 * 运行： node gen_zh_audio.js [--force]   （默认跳过已生成，--force 全量重做）
 * 依赖： macOS say / afconvert
 * 产物： audio/zh/*.m4a, js/zh-audio-list.js
 *
 * v7 音频质量修订（此前"含糊不清"的根因）：
 *   - 旧版用 Flo 语音：实测 1–3kHz 能量仅 0.30%，中高频几乎被削平 → 听感发闷
 *   - 旧版 afconvert 请求 64kbps，实际只编出 17kbps @22050Hz → 辅音细节丢失
 *   现改为 Tingting（播音腔、中高频完整）、44.1kHz、96kbps，
 *   并在字与字之间插入停顿，最后按峰值归一化，保证每段音量一致。
 */
const fs=require('fs'), path=require('path'), vm=require('vm'), crypto=require('crypto');
const {execFileSync}=require('child_process');

const ROOT=__dirname;
const OUT=path.join(ROOT,'audio','zh');
const TMP='/tmp/pokelearn-zh-tts';
const VOICE='Tingting';   // 普通话播音女声：实测 1–3kHz 能量 16.8%，咬字比 Flo 清楚得多
const RATE=100;           // Tingting 的最低有效语速（再低会被钳制），配合字间停顿使用
const SR=44100;           // 44.1kHz：保留 8kHz 以上齿音/塞擦音细节
const BR=96000;           // AAC 96kbps，实测输出 ~73kbps（旧版仅 17kbps）
const FORCE=process.argv.includes('--force');
fs.mkdirSync(OUT,{recursive:true}); fs.mkdirSync(TMP,{recursive:true});

/* 读取拼音表与汉字表 */
const ctx={console}; ctx.globalThis=ctx; vm.createContext(ctx);
vm.runInContext(
  'function ri(){return 0} function pick(a){return a[0]} function shuffle(a){return a.slice()}\n'+
  fs.readFileSync(path.join(ROOT,'js','zh-phonics.js'),'utf8')+'\n'+
  fs.readFileSync(path.join(ROOT,'js','data.js'),'utf8')+'\n'+
  ';globalThis.__X={ZH_INITIALS,ZH_FINALS,ZH_WHOLES,ZH_BLENDS,ZH_TONES,CHARS,zhInitial,zhFinal};',ctx);
const {ZH_INITIALS,ZH_FINALS,ZH_WHOLES,ZH_BLENDS,ZH_TONES,CHARS,zhInitial,zhFinal}=ctx.__X;

const tasks=[];
function add(kind,key,text){
  const f=kind+'_'+key+'.m4a';
  const rel='audio/zh/'+f;
  tasks.push({out:path.join(OUT,f), rel, text});
}

/* --- 声母 / 韵母示范音 --- */
ZH_INITIALS.forEach(t=>add('initial',t.p,`${t.hz}[[slnc 520]]${t.hz}。`));
ZH_FINALS.forEach(t=>add('final',t.p,`${t.hz}[[slnc 520]]${t.hz}。`));

/* --- 整体认读音节示范音（共 16 个，读两遍） --- */
ZH_WHOLES.forEach(t=>add('whole',t.p,`${t.hz}[[slnc 520]]${t.hz}。`));

/* --- 拼读播报：玻，啊，八。八个。 --- */
ZH_BLENDS.forEach(it=>{
  const i=zhInitial(it.ini), f=zhFinal(it.fin);
  const a=i?i.hz:it.ini, b=f?f.hz:it.fin;
  add('blend',it.syl,`${a}[[slnc 330]]${b}[[slnc 330]]${it.hz}。[[slnc 380]]${it.word}。`);
});

/* --- 汉字读音 --- */
CHARS.forEach((ch,i)=>add('char',i,`${ch.c}[[slnc 500]]${ch.c}。`));

/* --- 声调示范音：同一个音节的四个声调，只录单音字，不加提示语 --- */
ZH_TONES.forEach(g=>g.hz.forEach((hz,i)=>add('tone',g.base+'_'+(i+1),`${hz}[[slnc 520]]${hz}。`)));

console.log(`待生成 ${tasks.length} 段中文音频：${ZH_INITIALS.length} 声母 / ${ZH_FINALS.length} 韵母 / ${ZH_WHOLES.length} 整体认读 / ${ZH_BLENDS.length} 拼读 / ${CHARS.length} 汉字 / ${ZH_TONES.length*4} 声调`);

/* 峰值归一化 + 裁掉首尾静音：让 157 段音量一致，也避免开头半秒没声音 */
function masterWav(file){
  const buf=fs.readFileSync(file);
  if(buf.toString('ascii',0,4)!=='RIFF') return;
  let off=12, dataOff=-1, dataLen=0;
  while(off+8<=buf.length){
    const id=buf.toString('ascii',off,off+4), sz=buf.readUInt32LE(off+4);
    if(id==='data'){ dataOff=off+8; dataLen=sz; break; }
    off+=8+sz+(sz%2);
  }
  if(dataOff<0) return;
  const n=Math.min(dataLen, buf.length-dataOff)>>1;
  const s=new Int16Array(n);
  let peak=0;
  for(let i=0;i<n;i++){ const v=buf.readInt16LE(dataOff+i*2); s[i]=v; const a=Math.abs(v); if(a>peak) peak=a; }
  if(!peak) return;
  const thr=peak*0.01;                       // 低能量视为静音
  let a=0, b=n-1;
  while(a<n && Math.abs(s[a])<thr) a++;
  while(b>a && Math.abs(s[b])<thr) b--;
  const pad=Math.round(SR*0.02);
  a=Math.max(0,a-pad); b=Math.min(n-1,b+pad);
  const target=0.89*32767;                   // 峰值 -1dBFS，留余量防削波
  const gain=target/peak;
  const out=Buffer.alloc((b-a+1)*2);
  for(let i=a;i<=b;i++){
    let v=Math.round(s[i]*gain);
    if(v>32767) v=32767; if(v<-32768) v=-32768;
    out.writeInt16LE(v,(i-a)*2);
  }
  const hdr=Buffer.alloc(44);
  hdr.write('RIFF',0); hdr.writeUInt32LE(36+out.length,4); hdr.write('WAVE',8);
  hdr.write('fmt ',12); hdr.writeUInt32LE(16,16); hdr.writeUInt16LE(1,20); hdr.writeUInt16LE(1,22);
  hdr.writeUInt32LE(SR,24); hdr.writeUInt32LE(SR*2,28); hdr.writeUInt16LE(2,32); hdr.writeUInt16LE(16,34);
  hdr.write('data',36); hdr.writeUInt32LE(out.length,40);
  fs.writeFileSync(file, Buffer.concat([hdr,out]));
}

let done=0,skip=0; const fail=[];
for(const t of tasks){
  if(!FORCE && fs.existsSync(t.out) && fs.statSync(t.out).size>1000){ skip++; continue; }
  const wav=path.join(TMP,crypto.createHash('md5').update(t.rel).digest('hex').slice(0,10)+'.wav');
  try{
    execFileSync('/usr/bin/say',['-v',VOICE,'-r',String(RATE),
      '--file-format=WAVE','--data-format=LEI16@'+SR,'-o',wav,t.text],{stdio:'ignore'});
    masterWav(wav);
    execFileSync('/usr/bin/afconvert',[wav,'-f','m4af','-d','aac','-b',String(BR),'-o',t.out],{stdio:'ignore'});
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
