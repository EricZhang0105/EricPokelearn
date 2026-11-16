/* 清理 audio/words 里不再被 AUDIO_MAP 引用的孤儿音频
 *   node tools/prune_audio.js          只报告
 *   node tools/prune_audio.js --delete 真删
 */
const fs=require('fs'), path=require('path');
const ROOT=path.join(__dirname,'..');
const W=path.join(ROOT,'audio','words');
const src=fs.readFileSync(path.join(ROOT,'js','audio-map.js'),'utf8');
const i=src.indexOf('const AUDIO_MAP = ');
const map=JSON.parse(src.slice(i+17, src.indexOf(';',i)));
const keep=new Set(Object.values(map).map(u=>u.split('?')[0].split('/').pop()));
const orphans=fs.readdirSync(W).filter(f=>f.endsWith('.m4a')&&!keep.has(f));
const bytes=orphans.reduce((s,f)=>s+fs.statSync(path.join(W,f)).size,0);
console.log(`孤儿音频 ${orphans.length} 个 / ${(bytes/1024).toFixed(0)} KB`);
if(process.argv.includes('--delete')){
  orphans.forEach(f=>fs.unlinkSync(path.join(W,f)));
  console.log('已删除');
} else if(orphans.length){
  console.log('样例:', orphans.slice(0,5).join(', '), '（加 --delete 执行删除）');
}
