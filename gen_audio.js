/* 生成 App 用到的全部音频（本地预录，iPad 上无需依赖系统 TTS）
 *   1) 英文词库/句子/分级读物：清晰女声，另给拼写词生成慢速版
 *   2) 每只宝可梦专属音色的鼓励语：不同底嗓 + 变调，完成课程时播放
 * 运行： node gen_audio.js     （已生成的会跳过，可重复运行）
 * 依赖： macOS say / afconvert + tools/pitch_wav.py
 * 产物： audio/words/*.m4a, audio/cheer/*.m4a, js/audio-map.js
 */
const fs=require('fs'), path=require('path'), vm=require('vm'), crypto=require('crypto');
const {execFileSync}=require('child_process');

const ROOT=__dirname;
const WORDS=path.join(ROOT,'audio','words');
const CHEER=path.join(ROOT,'audio','cheer');
const TMP='/tmp/pokelearn-tts';
const PY='/Users/eric.zhang/.workbuddy/binaries/python/envs/default/bin/python';
const PITCH=path.join(ROOT,'tools','pitch_wav.py');
const WORD_VOICE='Flo (英语（美国）)';      // Apple 新一代 en-US 语音，咬字清楚
const CHEER_VOICES=['Samantha','Kathy','Fred','Ralph','Junior','Albert',
  'Eddy (英语（美国）)','Flo (英语（美国）)','Reed (英语（美国）)',
  'Rocko (英语（美国）)','Sandy (英语（美国）)','Shelley (英语（美国）)'];
const PHRASES=['Good job!','Well done!','Congratulations!','Cheers!','You did it!'];

[WORDS,CHEER,TMP].forEach(d=>fs.mkdirSync(d,{recursive:true}));

/* 读取课程词库与图库 */
const ctx={console}; ctx.globalThis=ctx; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT,'js','pokemon.js'),'utf8')+
  '\n'+fs.readFileSync(path.join(ROOT,'js','data.js'),'utf8')+
  '\n;globalThis.__X={POKEMON,SIGHT,CVC,PHON,READS,READERS};',ctx);
const {POKEMON,SIGHT,CVC,PHON,READS,READERS}=ctx.__X;

const tasks=[]; const AUDIO_MAP={}; const CHEER_MAP={};
function hash(s){ return crypto.createHash('md5').update(s).digest('hex').slice(0,10); }
function addWord(text, rate, key){
  const k=key||String(text).trim().toLowerCase();
  const f='w_'+hash(k)+'.m4a';
  AUDIO_MAP[k]='audio/words/'+f;
  tasks.push({out:path.join(WORDS,f), text:String(text), voice:WORD_VOICE, rate, pitch:1});
}
function addCheer(id, voice, pitch, phrase, i){
  const f=id+'_'+i+'.m4a';
  (CHEER_MAP[id]=CHEER_MAP[id]||[]).push('audio/cheer/'+f);
  tasks.push({out:path.join(CHEER,f), text:phrase, voice, rate:175, pitch});
}

/* --- 英文课程内容 --- */
const uniq=new Set();
[...SIGHT, ...CVC, ...PHON.map(p=>p.w)].forEach(w=>{
  if(uniq.has(w)) return; uniq.add(w);
  addWord(w,145);
  addWord(w,100,w+'::slow');        // 拼写题的慢速版
});
READS.forEach(r=>addWord(r.s,145));
READERS.forEach(r=>addWord(r.passage,150));

/* --- 每只宝可梦的专属鼓励语音色 --- */
POKEMON.forEach(pk=>{
  const n=[...pk.id].reduce((a,c)=>a+c.charCodeAt(0),0);
  const voice=CHEER_VOICES[n%CHEER_VOICES.length];
  const pitch=1.06+(n%9)*0.065;            // 1.06 ~ 1.58，大小朋友都能听出区别
  PHRASES.forEach((p,i)=>addCheer(pk.id,voice,pitch,p,i));
});

console.log(`待生成 ${tasks.length} 段音频（${uniq.size} 个词、${POKEMON.length} 只宝可梦 × ${PHRASES.length} 句）`);

let done=0, skip=0, fail=[];
for(const t of tasks){
  if(fs.existsSync(t.out) && fs.statSync(t.out).size>1000){ skip++; continue; }
  const base=path.join(TMP,hash(t.out+t.text+t.pitch));
  const wav=base+'.wav', shifted=base+'_p.wav';
  try{
    execFileSync('/usr/bin/say',['-v',t.voice,'-r',String(t.rate),
      '--file-format=WAVE','--data-format=LEI16@22050','-o',wav,t.text],{stdio:'ignore'});
    let input=wav;
    if(t.pitch!==1){
      execFileSync(PY,[PITCH,wav,shifted,String(t.pitch)],{stdio:'ignore'});
      input=shifted;
    }
    execFileSync('/usr/bin/afconvert',[input,'-f','m4af','-d','aac','-b','48000','-o',t.out],{stdio:'ignore'});
    done++;
  }catch(e){ fail.push(t.out+': '+e.message.split('\n')[0]); }
  if((done+skip)%50===0) console.log(`  进度 ${done+skip}/${tasks.length}`);
}
console.log(`完成：新生成 ${done}，跳过 ${skip}，失败 ${fail.length}`);
if(fail.length) console.log(fail.slice(0,10).join('\n'));

/* 输出映射表 */
const js='/* 由 gen_audio.js 自动生成，勿手工编辑 */\n'+
  'const AUDIO_MAP = '+JSON.stringify(AUDIO_MAP,null,2)+';\n'+
  'const CHEER_MAP = '+JSON.stringify(CHEER_MAP,null,2)+';\n';
fs.writeFileSync(path.join(ROOT,'js','audio-map.js'),js);
const size=(d)=>fs.readdirSync(d).reduce((s,f)=>s+fs.statSync(path.join(d,f)).size,0);
console.log(`音频体积：单词 ${(size(WORDS)/1024/1024).toFixed(2)} MB，鼓励语 ${(size(CHEER)/1024/1024).toFixed(2)} MB`);
