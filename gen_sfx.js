/* 生成特殊剧情音效音频（本地预录，离线可用）
 *   - rocket_line.m4a：火箭队战败台词（v26 起改用英文原版）
 *     "Looks like Team Rocket's blasting off again!"
 *     —— 英文动画里火箭队被打飞时的经典台词，对应中文「我们还会回来的」。
 *     用清晰度最高的 Samantha 录制，44.1kHz / AAC 160k，不做降调
 *     （旧版降调 0.82 会把 2–5kHz 辅音一起压掉，正是「含糊」的来源）。
 *     退化 / 昏倒动画时播放（js/app.js showDefeatFx）。
 *
 *   ★ 如有授权的动画原声：把文件命名为 rocket_original.m4a 放进 audio/sfx/，
 *     再跑 `node gen_sfx.js --force`，脚本会直接采用原声，不再生成 TTS。
 *
 * 运行： node gen_sfx.js [--force]
 * 依赖： macOS say / afconvert
 * 产物： audio/sfx/rocket_line.m4a
 */
const fs=require('fs'), path=require('path');
const {execFileSync}=require('child_process');

const ROOT=__dirname;
const OUT=path.join(ROOT,'audio','sfx');
const TMP='/tmp/pokelearn-sfx';
const SR=44100, BR=160000, RATE=145;
const FORCE=process.argv.includes('--force');
const LINE="Looks like Team Rocket's blasting off again!";

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
  const pad=Math.round(SR*0.06);          // 前后留气口，避免被截断感
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
const original=path.join(OUT,'rocket_original.m4a');
if(fs.existsSync(original) && fs.statSync(original).size>1000){
  fs.copyFileSync(original,out);
  console.log('使用授权原声 rocket_original.m4a → rocket_line.m4a ('+Math.round(fs.statSync(out).size/1024)+' KB)');
  process.exit(0);
}
if(!FORCE && fs.existsSync(out) && fs.statSync(out).size>1000){
  console.log('rocket_line.m4a 已存在，跳过（--force 重做）');
  process.exit(0);
}
const wav=path.join(TMP,'rocket.wav');
execFileSync('/usr/bin/say',['-v','Samantha','-r',String(RATE),
  '--file-format=WAVE','--data-format=LEI16@'+SR,'-o',wav,LINE],{stdio:'ignore'});
masterWav(wav);
execFileSync('/usr/bin/afconvert',[wav,'-f','m4af','-d','aac','-b',String(BR),'-o',out],{stdio:'ignore'});
console.log('生成完成：'+out+' ('+Math.round(fs.statSync(out).size/1024)+' KB)');
console.log('台词：'+LINE);
