/* ⚠️ 已由 tools/tts_build.py 取代（2026-11-16）—— 保留仅作历史参考。
 *    现在的语音库是「跨平台单女声」生成：node tools/voice_manifest.js 出清单 →
 *    python tools/tts_build.py [--force] 录音 → 自动写 js/audio-map.js。
 *    新脚本用 edge-tts 的 en-US-JennyNeural，Windows/macOS 都能跑，且已覆盖
 *    阅读理解 / 分级读物 / 数字词 / 数数题 / 鼓励语（515 段，单一女声）。
 *    本文件依赖 macOS 的 say + afconvert，只能在 Mac 上跑，请勿再用于发版。
 *
 * 原用途（历史）：生成 App 用到的全部音频（本地预录，iPad 上无需依赖系统 TTS）
 *   1) 英文词库/句子/阅读短文：Samantha 清晰女声，另给拼写词生成慢速版
 *   2) 宝可梦鼓励语：已废弃（2026-11-16 统一女声），改由 app.js 用锁定女声 TTS 朗读
 */
const fs=require('fs'), path=require('path'), vm=require('vm'), crypto=require('crypto');
const {execFileSync}=require('child_process');

const ROOT=__dirname;
const WORDS=path.join(ROOT,'audio','words');
const CHEER=path.join(ROOT,'audio','cheer');
const TMP='/tmp/pokelearn-tts';
const PY='/Users/eric.zhang/.workbuddy/binaries/python/envs/default/bin/python';
const PITCH=path.join(ROOT,'tools','pitch_wav.py');
const WORD_VOICE='Samantha';           // 美音播音女声：5–8kHz 能量 2.39%，咬字最清楚
const SR=44100, BR=96000;
const RATE=135, RATE_SLOW=95;          // 比旧版 145/100 稍慢，给 5 岁孩子留反应时间
const FORCE=process.argv.includes('--force');
const FORCE_CHEER=process.argv.includes('--force-cheer');
const CHEER_VOICES=['Samantha','Kathy','Fred','Ralph','Junior','Albert',
  'Eddy (英语（美国）)','Flo (英语（美国）)','Reed (英语（美国）)',
  'Rocko (英语（美国）)','Sandy (英语（美国）)','Shelley (英语（美国）)'];
const PHRASES=['Good job!','Well done!','Congratulations!','Cheers!','You did it!'];

[WORDS,CHEER,TMP].forEach(d=>fs.mkdirSync(d,{recursive:true}));

/* 读取课程词库与图库 */
const ctx={console}; ctx.globalThis=ctx; vm.createContext(ctx);
vm.runInContext('function ri(){return 0} function pick(a){return a[0]} function shuffle(a){return a.slice()}\n'+
  fs.readFileSync(path.join(ROOT,'js','zh-phonics.js'),'utf8')+'\n'+
  fs.readFileSync(path.join(ROOT,'js','pokemon.js'),'utf8')+'\n'+
  fs.readFileSync(path.join(ROOT,'js','data.js'),'utf8')+
  '\n;globalThis.__X={POKEMON,SIGHT,CVC,PHON,BUILD,READ_PASSAGES,READERS,GRAMMAR_ITEMS};',ctx);
const {POKEMON,SIGHT,CVC,PHON,BUILD,READ_PASSAGES,READERS,GRAMMAR_ITEMS}=ctx.__X;

const tasks=[]; const AUDIO_MAP={}; const CHEER_MAP={};
function hash(s){ return crypto.createHash('md5').update(s).digest('hex').slice(0,10); }
function addWord(text, rate, key){
  const k=key||String(text).trim().toLowerCase();
  const f='w_'+hash(k)+'.m4a';
  AUDIO_MAP[k]='audio/words/'+f+'?a=2';   // ?a=N：改录音后就 +1，顶掉设备上的旧缓存
  tasks.push({out:path.join(WORDS,f), text:String(text), voice:WORD_VOICE, rate, pitch:1});
}
function addCheer(id, voice, pitch, phrase, i){
  const f=id+'_'+i+'.m4a';
  (CHEER_MAP[id]=CHEER_MAP[id]||[]).push('audio/cheer/'+f);
  tasks.push({out:path.join(CHEER,f), text:phrase, voice, rate:175, pitch, cheer:true});
}

/* --- 英文课程内容 --- */
const uniq=new Set();
[...SIGHT, ...CVC, ...PHON.map(p=>p.w)].forEach(w=>{
  if(uniq.has(w)) return; uniq.add(w);
  addWord(w,RATE);
  addWord(w,RATE_SLOW,w+'::slow');        // 拼写题的慢速版
});
/* 阅读理解：短文全文 + 每道题的题干，都要能朗读 */
READ_PASSAGES.forEach(p=>{
  addWord(p.text,RATE);
  p.qs.forEach(x=>addWord(x.q,RATE));
});
/* 分级读物：短文 + 理解题 */
READERS.forEach(r=>{
  addWord(r.passage,RATE);
  r.qa.forEach(qa=>addWord(qa.q,RATE));
});
/* 写作题：拼对后要朗读完整句子（答案里句点前有空格，读的时候去掉） */
BUILD.forEach(b=>addWord(b.a.replace(/ \./g,'.'),RATE));
/* 语法题：朗读填好空之后的完整句子 */
GRAMMAR_ITEMS.forEach(g=>addWord(g.s.replace('___',g.a),RATE));

/* --- 每只宝可梦的专属鼓励语音色 ---
 * 2026-11-16 废弃：沙盒里 63 只宝可梦 × 5 句用了 12 个不同底嗓（含 Fred/Ralph/
 * Albert/Reed/Rocko 等男声）再叠加 1.06–1.58 倍变调，实测基频跨 74–400Hz、
 * 高频能量低到 0.01%（发闷）→ 这正是「一句话一个声音、有的听不清」的根源。
 * 现在鼓励语统一由 app.js 的 ttsSpeak() 用锁定女声朗读（CHEER_LINES），
 * 角色差异只靠 WebAudio 合成的叫声，不再生成任何变声录音。 */
POKEMON.forEach(()=>{});   // 保留占位：不再产出 audio/cheer

console.log(`待生成 ${tasks.length} 段音频（${uniq.size} 个词、${POKEMON.length} 只宝可梦 × ${PHRASES.length} 句）`);

/* 峰值归一化 + 裁掉首尾静音：每段音量一致，开头不拖半秒空白 */
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
  const thr=peak*0.01;
  let a=0, b=n-1;
  while(a<n && Math.abs(s[a])<thr) a++;
  while(b>a && Math.abs(s[b])<thr) b--;
  const pad=Math.round(SR*0.015);
  a=Math.max(0,a-pad); b=Math.min(n-1,b+pad);
  const gain=(0.89*32767)/peak;
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

let done=0, skip=0, fail=[];
for(const t of tasks){
  const exists=fs.existsSync(t.out) && fs.statSync(t.out).size>1000;
  const redo = t.cheer ? FORCE_CHEER : FORCE;
  if(exists && !redo){ skip++; continue; }
  const base=path.join(TMP,hash(t.out+t.text+t.pitch));
  const wav=base+'.wav', shifted=base+'_p.wav';
  try{
    execFileSync('/usr/bin/say',['-v',t.voice,'-r',String(t.rate),
      '--file-format=WAVE','--data-format=LEI16@'+SR,'-o',wav,t.text],{stdio:'ignore'});
    masterWav(wav);
    let input=wav;
    if(t.pitch!==1){
      execFileSync(PY,[PITCH,wav,shifted,String(t.pitch)],{stdio:'ignore'});
      input=shifted;
    }
    execFileSync('/usr/bin/afconvert',[input,'-f','m4af','-d','aac','-b',String(BR),'-o',t.out],{stdio:'ignore'});
    done++;
  }catch(e){ fail.push(t.out+': '+e.message.split('\n')[0]); }
  if((done+skip)%50===0) console.log(`  进度 ${done+skip}/${tasks.length}`);
}
console.log(`完成：新生成 ${done}，跳过 ${skip}，失败 ${fail.length}`);
if(fail.length) console.log(fail.slice(0,10).join('\n'));

/* 清掉不再被引用的旧音频（课程改版后会留下孤儿文件） */
const keep=new Set(Object.values(AUDIO_MAP).map(p=>path.basename(p)));
let cleaned=0;
fs.readdirSync(WORDS).forEach(f=>{
  if(f.endsWith('.m4a') && !keep.has(f)){ fs.unlinkSync(path.join(WORDS,f)); cleaned++; }
});
if(cleaned) console.log(`清理旧音频 ${cleaned} 个`);

/* 输出映射表 */
const js='/* 由 gen_audio.js 自动生成，勿手工编辑 */\n'+
  'const AUDIO_MAP = '+JSON.stringify(AUDIO_MAP,null,2)+';\n'+
  'const CHEER_MAP = '+JSON.stringify(CHEER_MAP,null,2)+';\n';
fs.writeFileSync(path.join(ROOT,'js','audio-map.js'),js);
const size=(d)=>fs.readdirSync(d).reduce((s,f)=>s+fs.statSync(path.join(d,f)).size,0);
console.log(`音频体积：单词 ${(size(WORDS)/1024/1024).toFixed(2)} MB，鼓励语 ${(size(CHEER)/1024/1024).toFixed(2)} MB`);
