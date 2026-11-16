/* 语音一致性审计（新增模块上线前跑一次）
 *   node tools/voice_audit.js
 *
 * 检查三件事：
 *   1) 英文可朗读文本里，有多少已经有预录音频（没有的会走 TTS —— 音色相同，允许，但要心里有数）
 *   2) 代码里有没有绕过 speak() 直接 new SpeechSynthesisUtterance 的地方（违反语音规范）
 *   3) 音频映射表里是否还有指向不存在文件的死链
 *
 * 规范见 js/app.js 顶部「语音规范」注释块：全 App 英文只有一个女声（Samantha 家族），
 * 中文只有一个女声（Ting-Ting）；不许变声、变调、多音色。
 */
const fs=require('fs'), path=require('path'), vm=require('vm');
const ROOT=path.join(__dirname,'..');
const J=f=>path.join(ROOT,'js',f);

const ctx={console}; ctx.globalThis=ctx; vm.createContext(ctx);
const files=['zh-phonics.js','pokemon.js','data.js','read-passages.js'];
let src='function ri(){return 0} function pick(a){return a[0]} function shuffle(a){return a.slice()}\n';
for(const f of files) src+='\n/*== '+f+' ==*/\n'+fs.readFileSync(J(f),'utf8');
try{
  vm.runInContext(src+'\n;globalThis.__X={SIGHT,CVC,PHON,BUILD,READ_PASSAGES,READERS,GRAMMAR_ITEMS,MATH_PETS};',ctx);
}catch(e){ console.log('加载题库失败（不影响下表其余检查）：', e.message); }

const mapSrc=fs.readFileSync(J('audio-map.js'),'utf8');
const iA=mapSrc.indexOf('const AUDIO_MAP = ');
const AUDIO_MAP=JSON.parse(mapSrc.slice(iA+17, mapSrc.indexOf(';',iA)));
const have=new Set(Object.keys(AUDIO_MAP).filter(k=>!k.endsWith('::slow')));

/* 1) 覆盖率 */
const X=ctx.__X||{};
const {SIGHT,CVC,PHON,BUILD,READ_PASSAGES,READERS,GRAMMAR_ITEMS}=X;
const need=new Set();
(SIGHT||[]).concat(CVC||[],(PHON||[]).map(p=>p.w)).forEach(w=>need.add(String(w).trim().toLowerCase()));
(READ_PASSAGES||[]).forEach(p=>{need.add(String(p.text).trim().toLowerCase());
  (p.qs||[]).forEach(x=>need.add(String(x.q).trim().toLowerCase()));});
(READERS||[]).forEach(r=>{need.add(String(r.passage).trim().toLowerCase());
  (r.qa||[]).forEach(qa=>need.add(String(qa.q).trim().toLowerCase()));});
(BUILD||[]).forEach(b=>need.add(b.a.replace(/ \./g,'.').trim().toLowerCase()));
(GRAMMAR_ITEMS||[]).forEach(g=>need.add(g.s.replace('___',g.a).trim().toLowerCase()));
const missing=[...need].filter(k=>!have.has(k));
console.log('英文预录音频覆盖：'+need.size+' 条文本，已录 '+(need.size-missing.length)+
  '，缺 '+(missing.length?missing.length+'（走 TTS，音色相同）':'0'));

/* 2) 绕过 speak() 直接发声的地方 */
const jsFiles=fs.readdirSync(path.join(ROOT,'js')).filter(f=>f.endsWith('.js'));
const violations=[];
for(const f of jsFiles){
  if(f==='app.js') continue;
  const t=fs.readFileSync(J(f),'utf8');
  if(/new\s+SpeechSynthesisUtterance/.test(t)) violations.push(f+' — 直接 new SpeechSynthesisUtterance');
  if(/speechSynthesis\.speak\(/.test(t)) violations.push(f+' — 直接调用 speechSynthesis.speak()');
}
console.log(violations.length ? '⚠️ 违反语音规范的文件：\n  '+violations.join('\n  ')
                              : '语音出口检查：通过（除 app.js 外无模块直接发声）');

/* 3) 死链 */
const deadTemp=Object.entries(AUDIO_MAP).filter(([k,v])=>!fs.existsSync(path.join(ROOT,v.split('?')[0])));
const zhList=(fs.readFileSync(J('zh-audio-list.js'),'utf8').match(/"audio\/zh\/[^"]+"/g)||[]).map(s=>s.replace(/"/g,''));
const zhDead=zhList.filter(p=>!fs.existsSync(path.join(ROOT,p.split('?')[0])));
console.log('音频死链：英文 '+(deadTemp.length?deadTemp.length:'0')+' 个，中文 '+(zhDead.length?zhDead.length:'0')+' 个');
if(deadTemp.length) console.log('  ', deadTemp.slice(0,5).map(x=>x[0]).join(', '));
if(zhDead.length) console.log('  ', zhDead.slice(0,5).join(', '));
if(missing.length) console.log('\n缺录音样例：\n  '+missing.slice(0,8).map(m=>JSON.stringify(m.slice(0,60))).join('\n  '));
