/* 生成「英文语音清单」：把所有需要朗读的英文文本枚举成 JSON，供 tools/tts_build.py 录音。
 *   node tools/voice_manifest.js > tools/voice_manifest.json
 *
 * 清单来源与 app 运行时一致：data.js（sight/CVC/phonics/句子/语法/分级读物）
 * + read-passages.js（阅读理解，周更会追加）。
 * 另外补三类「动态文本」需要的碎片：
 *   · 数字词 0–150   → 数学题「7 plus 5 equals what?」拆成 4 段拼接
 *   · plus / minus / equals / equals what? → 同上
 *   · Count the <宝可梦>. How many? → 数数题
 *
 * ⚠️ 音色唯一性：本清单只允许用「一把」女声录（见 tts_build.py 的 VOICE）。
 *    新增英文内容后重跑这两个脚本即可补录；不允许为不同角色换音色。
 */
const fs=require('fs'), path=require('path'), vm=require('vm'), crypto=require('crypto');
const ROOT=path.join(__dirname,'..');
const J=f=>path.join(ROOT,'js',f);

const ctx={console}; ctx.globalThis=ctx; vm.createContext(ctx);
let src='function ri(){return 0} function pick(a){return a[0]} function shuffle(a){return a.slice()}\n';
for(const f of ['zh-phonics.js','pokemon.js','ref-pages.js','data.js','read-passages.js']) src+='\n'+fs.readFileSync(J(f),'utf8');
vm.runInContext(src+'\n;globalThis.__X={SIGHT,CVC,PHON,BUILD,READ_PASSAGES,READERS,GRAMMAR_ITEMS,MATH_PETS,REF_EN_WORDS};',ctx);
const {SIGHT,CVC,PHON,BUILD,READ_PASSAGES,READERS,GRAMMAR_ITEMS,MATH_PETS,REF_EN_WORDS}=ctx.__X;

const out=[]; const seen=new Set();
const hash=s=>crypto.createHash('md5').update(s).digest('hex').slice(0,10);
function add(text, slow){
  const t=String(text).trim();
  if(!t) return;
  const key=t.toLowerCase();
  if(!seen.has(key)){ seen.add(key); out.push({key, text:t, rate:'normal', file:'w_'+hash(key)+'.m4a'}); }
  if(slow){
    const sk=key+'::slow';
    if(!seen.has(sk)){ seen.add(sk); out.push({key:sk, text:t, rate:'slow', file:'w_'+hash(sk)+'.m4a'}); }
  }
}
/* 单词（另出慢速版给拼写题） */
[...SIGHT,...CVC,...PHON.map(p=>p.w)].forEach(w=>add(w,true));
/* 音标全景页的例词（js/ref-pages.js）：44 个音素 + 26 个字母各一个例词，
   不补录的话点音标只能走设备 TTS，音色会和全库不一致。 */
(REF_EN_WORDS||[]).forEach(w=>add(w));
/* 阅读理解 */
READ_PASSAGES.forEach(p=>{ add(p.text); (p.qs||[]).forEach(x=>add(x.q)); });
/* 分级读物 */
READERS.forEach(r=>{ add(r.passage); (r.qa||[]).forEach(qa=>add(qa.q)); });
/* 句子建构 / 语法 */
BUILD.forEach(b=>add(b.a.replace(/ \./g,'.')));
GRAMMAR_ITEMS.forEach(g=>add(g.s.replace('___',g.a)));
/* 数学：数字词 + 连接词 + 数数题 */
const ONES=['zero','one','two','three','four','five','six','seven','eight','nine','ten',
  'eleven','twelve','thirteen','fourteen','fifteen','sixteen','seventeen','eighteen','nineteen'];
function numWord(n){
  if(n<20) return ONES[n];
  const tens=['','','twenty','thirty','forty','fifty','sixty','seventy','eighty','ninety'];
  if(n<100){ const t=Math.floor(n/10), r=n%10; return tens[t]+(r?' '+ONES[r]:''); }
  const h=Math.floor(n/100), r=n%100;
  return ONES[h]+' hundred'+(r?' and '+numWord(r):'');
}
for(let n=0;n<=150;n++) add(numWord(n));
['plus','minus','equals','equals what','How many','Count the'].forEach(w=>add(w));
(MATH_PETS||[]).forEach(p=>add('Count the '+p.name+'. How many?'));
/* 鼓励语（完成课程时播放，同样只用这把女声） */
['Good job!','Well done!','You did it!','Great work!','Almost perfect!','Well done','Good job'].forEach(p=>add(p));

console.log(JSON.stringify({voiceNote:'单一女声，禁止变声/变调', count:out.length, items:out},null,1));
