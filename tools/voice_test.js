/* 选声规则回归测试：验证「任何设备环境下都只出女声」
 *   node tools/voice_test.js
 *
 * 背景：新加坡 iPad 常是 en-GB，系统只有一个女声 + 一个男声（Daniel）。
 * 旧逻辑只认美式女声，匹配不到就退回系统默认 → 男声，孩子听到的就是「两种声音」。
 * 这个测试把这几种设备声音列表都跑一遍，任何人改动选声逻辑都要先过它。
 */
const fs=require('fs'), path=require('path'), vm=require('vm');
const ROOT=path.join(__dirname,'..');
const src=fs.readFileSync(path.join(ROOT,'js','app.js'),'utf8');
const a=src.indexOf('const EN_VOICE_PREF');
const b=src.indexOf("function speak(text,lang){ ttsSpeak(text,lang); }");
if(a<0||b<0) throw new Error('app.js 里找不到语音规范代码块');
const block=src.slice(a,b);

function makeCtx(voices){
  const spoken=[];
  const ctx={console, setTimeout:f=>f(), String, RegExp};
  ctx.window=ctx;
  ctx.speechSynthesis={ getVoices:()=>voices, addEventListener(){}, cancel(){}, speak:u=>spoken.push(u) };
  ctx.SpeechSynthesisUtterance=function(t){ this.text=t; };
  ctx.globalThis=ctx;
  vm.createContext(ctx);
  vm.runInContext(block+'\n;globalThis.__T={bestVoice,zhVoice,ttsSpeak,refreshVoices};',ctx);
  return {T:ctx.__T, spoken};
}

const MALE=/daniel|alex|fred|ralph|albert|reed|rocko|yunxi|yunjian|yunyang/i;
const cases=[
  {name:'新加坡 iPad（只有英式：Daniel 男 + Moira 女）',
   voices:[{name:'Daniel',lang:'en-GB'},{name:'Moira',lang:'en-GB'},{name:'Ting-Ting',lang:'zh-CN'}],
   expect:/Moira/},
  {name:'装了增强版 Samantha 的美式设备',
   voices:[{name:'Samantha',lang:'en-US'},{name:'Samantha (Enhanced)',lang:'en-US'},{name:'Daniel',lang:'en-GB'},{name:'Ting-Ting',lang:'zh-CN'}],
   expect:/Enhanced|Premium/},
  {name:'只有男声（理想：宁可不选，也不出男声）',
   voices:[{name:'Daniel',lang:'en-GB'},{name:'Ting-Ting',lang:'zh-CN'}],
   expect:null},
  {name:'美式默认套装（含男声 Alex）',
   voices:[{name:'Alex',lang:'en-US'},{name:'Samantha',lang:'en-US'},{name:'Ting-Ting',lang:'zh-CN'}],
   expect:/Samantha/},
  {name:'Chrome 桌面',
   voices:[{name:'Google US English',lang:'en-US'},{name:'Google 普通话（中国大陆）',lang:'zh-CN'}],
   expect:/Google US English/},
  {name:'中文只有云希（男）+ 云扬（男）+ 婷婷（女）',
   voices:[{name:'Samantha',lang:'en-US'},{name:'Yunxi',lang:'zh-CN'},{name:'Yunyang',lang:'zh-CN'},{name:'Ting-Ting',lang:'zh-CN'}],
   expect:/Samantha/, zhExpect:/Ting-Ting/}
];

let fail=0;
for(const c of cases){
  const {T}=makeCtx(c.voices);
  const en=T.bestVoice(), zh=T.zhVoice();
  const enName=en?en.name:'(none)', zhName=zh?zh.name:'(none)';
  const okEn=c.expect?c.expect.test(enName):enName==='(none)';
  const okZh=c.zhExpect?c.zhExpect.test(zhName):!MALE.test(zhName);
  const badM=!!(en&&MALE.test(en.name))||!!(zh&&MALE.test(zh.name));
  const ok=okEn&&okZh&&!badM;
  if(!ok) fail++;
  console.log(`${ok?'✓':'✗'} ${c.name}\n    EN → ${enName}   中文 → ${zhName}`);
}
console.log(fail?`\n${fail} 个用例失败`:'\n全部通过：任何环境下都不会出现男声');
process.exit(fail?1:0);
