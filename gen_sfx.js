/* 生成特殊剧情音效音频（本地预录，离线可用）
 *   - rocket_line.m4a：火箭队台词「哼哼哼……我们还会回来的！」
 *     用 Tingting 录制，再降调 0.85 变成反派低音，退化/死亡动画时播放。
 * 运行： node gen_sfx.js [--force]
 * 依赖： macOS say / afconvert + tools/pitch_wav.py
 * 产物： audio/sfx/rocket_line.m4a
 */
const fs=require('fs'), path=require('path'), crypto=require('crypto');
const {execFileSync}=require('child_process');

const ROOT=__dirname;
const OUT=path.join(ROOT,'audio','sfx');
const TMP='/tmp/pokelearn-sfx';
const PY='/Users/eric.zhang/.workbuddy/binaries/python/envs/default/bin/python';
const PITCH=path.join(ROOT,'tools','pitch_wav.py');
const SR=44100, BR=96000, RATE=150;
const FORCE=process.argv.includes('--force');

fs.mkdirSync(OUT,{recursive:true}); fs.mkdirSync(TMP,{recursive:true});

/* 峰值归一化 + 裁首尾静音（与 gen_zh_audio.js 同款） */
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
  let peak=0;
  for(let i=0;i<n;i++){ const a=Math.abs(buf.readInt16LE(dataOff+i*2)); if(a>peak) peak=a; }
  if(!peak) return;
  const thr=peak*0.01;
  let a=0, b=n-1;
  while(a<n && Math.abs(buf.readInt16LE(dataOff+a*2))<thr) a++;
  while(b>a && Math.abs(buf.readInt16LE(dataOff+b*2))<thr) b--;
  const pad=Math.round(SR*0.02);
  a=Math.max(0,a-pad); b=Math.min(n-1,b+pad);
  const gain=0.89*32767/peak;
  const out=Buffer.alloc((b-a+1)*2);
  for(let i=a;i<=b;i++){
    let v=Math.round(buf.readInt16LE(dataOff+i*2)*gain);
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

const out=path.join(OUT,'rocket_line.m4a');
if(!FORCE && fs.existsSync(out) && fs.statSync(out).size>1000){
  console.log('rocket_line.m4a 已存在，跳过（--force 重做）');
  process.exit(0);
}
const wav=path.join(TMP,'rocket.wav');
execFileSync('/usr/bin/say',['-v','Tingting','-r',String(RATE),
  '--file-format=WAVE','--data-format=LEI16@'+SR,'-o',wav,
  '哼哼哼……我们还会回来的！'],{stdio:'ignore'});
masterWav(wav);
/* 降调 0.82 → 反派低音 */
const wav2=path.join(TMP,'rocket_low.wav');
execFileSync(PY,[PITCH,wav,wav2,'0.82']);
execFileSync('/usr/bin/afconvert',[wav2,'-f','m4af','-d','aac','-b',String(BR),'-o',out],{stdio:'ignore'});
console.log('生成完成：'+out+' ('+Math.round(fs.statSync(out).size/1024)+' KB)');
