/* =========================================================
   PokeLearn · 主控制器
   界面全英文；中文科目内容保留中文（拼音/汉字）
   ========================================================= */
const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));

Store.load();
/* 家长录音降噪力度：Eric 2026-11-17 试听后定档 = 强力 strong */
try{ window.POKELEARN_DENOISE_LEVEL = localStorage.getItem('pokelearn-denoise-level') || 'strong'; }catch(e){ window.POKELEARN_DENOISE_LEVEL = 'strong'; }
/* 家长真人录制的拼读题库：异步从 IndexedDB 加载（加载完前 c-blend 用预录兜底） */
if(typeof ParentBlendBank!=='undefined') ParentBlendBank.init();
/* 题库自动扩容：把上次自动生成、已存进存档的新短文注册回阅读题库 */
if(typeof QEngine!=='undefined' && QEngine.bootExtraPassages) QEngine.bootExtraPassages();

const state = {
  subject:null, lessonId:null, questions:[], idx:0,
  correct:0, total:0, selectedPokemon:null, reviewDone:false
};

/* ---------- 屏幕切换 ---------- */
/* 悬浮错题本按钮在哪些界面出现：首页 / 课程列表 / 书架 / 阅读记录。
 * 上课、结果页、绘本阅读器、家长端、错题本本身不显示，免得挡住题目和按钮。 */
const FAB_SCREENS=['screen-home','screen-subject','screen-library','screen-reading-log'];
function show(id){
  $$('.screen').forEach(s=>s.classList.add('hidden'));
  $('#keyboard').classList.add('hidden');
  $('#'+id).classList.remove('hidden');
  $('#topbar').classList.toggle('hidden', id==='screen-home');
  $('#backBtn').classList.toggle('hidden', id==='screen-home');
  updateMistakeFab(FAB_SCREENS.includes(id));
  if(id==='screen-home') renderHome();
  if(id==='screen-parent') renderParent();
  if(id==='screen-library') renderLibrary();
}

/* 悬浮错题本：有错题时红底感叹号 + 数字；没有错题时变绿勾，喷火龙照样在 */
function updateMistakeFab(visible){
  const fab=$('#mistakeFab'); if(!fab) return;
  const n=Store.allMistakes().length;
  if(typeof visible==='boolean') fab.classList.toggle('hidden', !visible);
  fab.classList.toggle('ok', n===0);
  $('#fabAlertMark').textContent = n ? '!' : '✓';
  const cnt=$('#fabCount');
  cnt.textContent = n;
  cnt.classList.toggle('hidden', n===0);
  fab.title = n ? `${n} mistake${n>1?'s':''} to review` : 'No mistakes — great job!';
}


/* ---------- 返回上一级菜单 ----------
 * 每个界面都有「← Back」，回到它上一层菜单，而不是只能跳回首页：
 *   课程列表 → 首页；上课中 → 课程列表（会先确认，免得丢本次题目）；
 *   结果页 → 课程列表；绘本阅读器 / 阅读记录 → 书架；书架 / 错题本 / 家长端 → 首页。 */
function currentScreen(){
  const el=$$('.screen').find(s=>!s.classList.contains('hidden'));
  return el ? el.id : 'screen-home';
}
function goBack(){
  const cur=currentScreen();
  if(cur==='screen-lesson'){
    const inLesson = state.idx < state.total;
    if(inLesson && !confirm('Leave this lesson? The questions in this lesson will not be saved.')) return;
    cancelSpeech();
    state.pendingExplain=false;
    state.explainToken=(state.explainToken||0)+1;   // 作废「讲解读完切题」的定时器
    if(state.subject) openSubject(state.subject); else show('screen-home');
    return;
  }
  if(cur==='screen-reader'){ reader.book=null; show('screen-library'); return; }
  if(cur==='screen-ref'){ if(state.subject) openSubject(state.subject); else show('screen-home'); return; }
  if(cur==='screen-result' || cur==='screen-subject'){
    if(cur==='screen-result' && state.subject) openSubject(state.subject);
    else show('screen-home');
    return;
  }
  const map={ 'screen-mistakes':'screen-home', 'screen-parent':'screen-home',
              'screen-library':'screen-home', 'screen-reading-log':'screen-library' };
  show(map[cur] || 'screen-home');
}

function setTopTitle(t){ $('#topbarTitle').textContent = t; }

/* ==================== 语音规范（全 App 唯一出口） ====================
   全程序只有两把嗓子，任何模块都不许再引入第三种：
   · 英文 = 一把美式神经女声（en-US-JennyNeural）。audio/words 里 600+ 段录音全部由它录制，
     覆盖词库 / 短文 / 理解题 / 语法 / 造句 / 数字词 / 数数题 / 鼓励语。
     数学算式是运行时随机生成的，朗读时拆成「7 / plus / 5 / equals what」四段拼起来，
     用的还是同一批录音 → 数学题也不会突然换人。
   · 中文 = Ting-Ting（婷婷），audio/zh 280+ 段录音同一把嗓子。
   只有极少数「运行时才生成的自由句子」（数学应用题故事、周更新增短文、
   解题思路提示）没有录音，这时才回落到系统 TTS，并强制锁在同一族女声上。
   硬规则（2026-11-16 定，新增模块必须遵守）：
   1) 不准为不同角色 / 宝可梦做变声或变调；鼓励语统一用 CHEER_LINES + speak()。
   2) 不准在别处 new SpeechSynthesisUtterance，一律走 speak() / playSpeak()。
   3) 新增英文内容先跑 tools/voice_manifest.js + tools/tts_build.py 补录音；
      补不上也没关系，TTS 兜底仍是女声，但绝不允许写死别的音色。
   4) 要换音色只有一条路：整库重录（tts_build.py --force）+ 同步改 EN_VOICE_PREF。
      只改一边 = 必然出现两种声音。
   ==================================================================== */
const EN_VOICE_PREF = [
  /* 设备端兜底也优先「更自然的新一代女声」 */
  'Ava (Premium)', 'Ava (Enhanced)', 'Ava',
  'Samantha (Premium)', 'Samantha (Enhanced)', 'Samantha',
  'Google US English', 'Microsoft Aria Online (Natural) - English (United States)',
  'Microsoft Aria - English (United States)',
  /* 设备只装了英式/澳式/其他英语时，优先这些女声（新加坡 iPad 常是 en-GB，
     旧名单只有美式女声，匹配不到就退到系统默认的 Daniel —— 男声，这正是
     「同一个 App 两种声音」的来源之一） */
  'Kate (Enhanced)', 'Kate', 'Serena (Enhanced)', 'Serena', 'Stephanie', 'Moira', 'Tessa',
  'Karen (Enhanced)', 'Karen', 'Fiona', 'Martha', 'Allison (Enhanced)', 'Allison',
  'Google UK English Female', 'Zira', 'Hazel'
];
const ZH_VOICE_PREF = ['Ting-Ting (Premium)','Ting-Ting (Enhanced)','Ting-Ting','Tingting',
  'Meijia','Google 普通话','Microsoft Huihui','Microsoft Yaoyao'];
/* 女声白名单 / 男声黑名单：设备命名千奇百怪，靠这两张表兜住「绝不出现男声」 */
const EN_FEMALE_RE = /samantha|kate|serena|stephanie|moira|tessa|karen|fiona|martha|ava|allison|susan|zira|hazel|aria|jenny|michelle|sonia|libby|natasha|clara|emily|olivia|amelie|female/i;
const EN_MALE_RE   = /\bdaniel\b|\balex\b|oliver|arthur|aaron|\bfred\b|\btom\b|gordon|\blee\b|rishi|malcolm|david|\bmark\b|james|george|\bguy\b|ryan|\bmale\b|junior|ralph|albert|reed|rocko|eddy|diego|jorge|juan|carlos|luca|thomas/i;
const ZH_MALE_RE   = /yunxi|yunjian|yunyang|yunxia|kangkang|liang|yao|\bmale\b/i;
const CHEER_LINES = ['Good job!','Well done!','You did it!','Great work!','Almost perfect!'];
let _enVoice=undefined, _zhVoice=undefined; // undefined=还没挑；null=确认没有可用声音
function pickVoice(vs, pref, langRe, maleRe){
  if(!vs || !vs.length) return undefined;          // 声音列表还没加载完，等下次
  for(const name of pref){ const v=vs.find(x=>x.name===name && langRe.test(x.lang)); if(v) return v; }
  const pool=vs.filter(x=>langRe.test(x.lang));
  if(!pool.length) return null;
  /* 兜底顺序：英文→女声白名单（美式优先）；中文→排除男声。绝不返回系统默认男声 */
  const female=pool.filter(x=>!maleRe.test(x.name));
  if(langRe.source==='^en'){
    return female.find(x=>EN_FEMALE_RE.test(x.name) && /^en[-_]US/i.test(x.lang))
        || female.find(x=>EN_FEMALE_RE.test(x.name))
        || female[0] || null;
  }
  const good=female.find(x=>/ting|huihui|yaoyao|xiaoxiao|meijia|female/i.test(x.name));
  return good || female[0] || null;
}
function refreshVoices(){
  if(!('speechSynthesis' in window)) return;
  const vs=speechSynthesis.getVoices()||[];
  if(!vs.length) return;
  if(_enVoice===undefined) _enVoice=pickVoice(vs,EN_VOICE_PREF,/^en/i,EN_MALE_RE)||null;
  if(_zhVoice===undefined) _zhVoice=pickVoice(vs,ZH_VOICE_PREF,/^zh/i,ZH_MALE_RE)||null;
}
function bestVoice(){ if(_enVoice===undefined) refreshVoices(); return _enVoice===undefined?null:_enVoice; }
function zhVoice(){   if(_zhVoice===undefined) refreshVoices(); return _zhVoice===undefined?null:_zhVoice; }
if('speechSynthesis' in window){
  try{ speechSynthesis.addEventListener('voiceschanged',refreshVoices); }catch(e){}
  refreshVoices();
  /* iOS 的声音列表是异步回来的，多探几次确保第一句就用对嗓子 */
  setTimeout(refreshVoices,300); setTimeout(refreshVoices,1200);
}
/* 全程序唯一 TTS 出口：锁定声音，统一语速/音高/音量。
   onEnd 只在「这句话确实读完」时触发（部分浏览器不派 onend，用按时长估算的保险计时兜底）。
   读完后才切下一题 —— 数学解题思路很长，固定 3 秒定时器会把它和下一题的读题撞在一起。 */
let _ttsToken=0;
function ttsSpeak(text, lang, onEnd){
  if(!('speechSynthesis' in window)){ if(onEnd) setTimeout(onEnd,50); return; }
  const t=String(text==null?'':text);
  if(!t.trim()){ if(onEnd) setTimeout(onEnd,50); return; }
  const zh=/^zh/i.test(lang||'');
  const my=++_ttsToken;
  let finished=false;
  const done=()=>{ if(finished||my!==_ttsToken) return; finished=true; if(onEnd) onEnd(); };
  const play=()=>{
    if(my!==_ttsToken) return;
    try{
      speechSynthesis.cancel();
      const u=new SpeechSynthesisUtterance(t);
      const v=zh?zhVoice():bestVoice();
      /* lang 必须和所选声音一致，否则 iOS 会把 utterance 丢回系统默认（可能是男声） */
      u.lang=(v && v.lang) ? v.lang : (zh?'zh-CN':'en-US');
      const long=t.length>90;                 // 长句（短文/故事）再放慢一点，咬字更清
      u.rate=zh?0.82:(long?0.80:0.86);
      u.pitch=1; u.volume=1;
      if(v) u.voice=v;
      u.onend=done; u.onerror=done;
      /* 保险：Safari 偶尔吞 onend。按词数估一个上限，读完就不重复触发（done 里有去重） */
      if(onEnd) setTimeout(done, 2200 + t.split(/\s+/).length*520 + t.length*(zh?150:35));
      /* iOS：cancel() 与 speak() 挤在同一个事件循环里会被吞掉，隔一帧再播 */
      setTimeout(()=>{ if(my===_ttsToken){ try{ speechSynthesis.speak(u); }catch(e){ done(); } } },20);
    }catch(e){ done(); }
  };
  if(zh?zhVoice():bestVoice()){ play(); return; }
  /* 声音还没加载出来：等一次 voiceschanged（最多 600ms），再照常播 */
  let fired=false;
  const go=()=>{ if(fired) return; fired=true; refreshVoices(); play(); };
  try{ speechSynthesis.addEventListener('voiceschanged',go,{once:true}); }catch(e){}
  setTimeout(go,600);
}
function speak(text,lang,onEnd){ ttsSpeak(text,lang,onEnd); }
/* 切题 / 退出课程时把上一段声音彻底掐掉，连它挂着的回调一起作废 */
function cancelSpeech(){
  ++_ttsToken; ++_audioToken; ++_autoSpeakToken;
  try{ if('speechSynthesis' in window) speechSynthesis.cancel(); }catch(e){}
  try{ if(_audio){ _audio.onended=null; _audio.onerror=null; _audio.pause(); } }catch(e){}
}
/* 家长端自检用：显示当前锁定的两把嗓子，方便确认设备有没有装到高清女声 */
function voiceLabel(){
  if(!('speechSynthesis' in window)) return 'This browser has no speech synthesis';
  const en=bestVoice(), zh=zhVoice();
  if(!en && !zh) return 'voices not loaded yet — open any question, then come back';
  const nm=v=>v?(v.name+' · '+v.lang):'—';
  const hi=(en && /premium|enhanced|natural/i.test(en.name));
  /* 全 App 英文按美音：设备若只有英式/澳式女声，会退到那一把（宁可口音偏也不能出男声），
     这里明确告诉家长「这台设备没有美式女声」，方便去设置里补装。 */
  const usEn=(en && /^en[-_]US/i.test(en.lang||''));
  const tip=(!en || usEn)
    ? (hi?'':'  ·  tip: Settings › Accessibility › Spoken Content › English (US) → download Ava / Samantha Enhanced for even clearer audio')
    : '  ·  this device has no American voice — add Settings › Accessibility › Spoken Content › English (US) → Ava / Samantha Enhanced';
  return 'EN '+nm(en)+'  /  中文 '+nm(zh)+tip;
}

/* 首次触摸解锁 iOS Safari 的音频播放权限（自动读题需要在手势之外播放） */
document.addEventListener('pointerdown', ()=>{
  try{
    const a=new Audio();
    a.src='data:audio/mp4;base64,';
    a.play().catch(()=>{});
    // iOS Safari 的语音合成必须在首次用户手势里触发过一次，
    // 否则自动读题（setTimeout 里调用）会被系统静音
    if('speechSynthesis' in window){
      const warm=new SpeechSynthesisUtterance(' ');
      const v=bestVoice();                       // 预热的也是锁定女声，别让默认男声先出声
      if(v){ warm.voice=v; warm.lang=v.lang; }
      warm.volume=0; warm.rate=1.5;
      speechSynthesis.speak(warm);
    }
  }catch(e){}
}, {once:true, passive:true});

/* 本地音频播放：AUDIO_MAP 由 js/audio-map.js 提供（CHEER_MAP 已废弃，恒为空） */
let _audio=null, _audioToken=0;
function playClip(url, onEnd, onFail){
  if(!url) return false;
  try{
    if(!_audio) _audio=new Audio();
    const my=++_audioToken;
    _audio.pause();
    _audio.src=url;
    _audio.currentTime=0;
    _audio.onended=()=>{ if(my===_audioToken && onEnd) onEnd(); };
    /* 录音文件缺失 / 被浏览器拦截时不能再静音：交给系统语音兜底 */
    _audio.onerror=()=>{ if(my===_audioToken && onFail) onFail(); };
    _audio.play().catch(()=>{
      if(my!==_audioToken) return;
      if(onFail) onFail(); else if(onEnd) onEnd();
    });
    return true;
  }catch(e){ return false; }
}
function clipFor(text){
  if(typeof AUDIO_MAP==='undefined') return null;
  const k=String(text||'').trim().toLowerCase();
  return AUDIO_MAP[k] || null;
}
/* 数学算式拆段：数字词与 plus / minus / equals what 都是同一把女声录的，
   拼起来读整道题 → 数学题也不会突然换成系统语音的那把嗓子。
   （题面的算式是随机生成的，不可能逐题预录，所以拆成「7 / plus / 5 / equals what」四段） */
const NUM_ONES=['zero','one','two','three','four','five','six','seven','eight','nine','ten',
  'eleven','twelve','thirteen','fourteen','fifteen','sixteen','seventeen','eighteen','nineteen'];
const NUM_TENS=['','','twenty','thirty','forty','fifty','sixty','seventy','eighty','ninety'];
function numWord(n){
  n=Math.floor(Number(n));
  if(!isFinite(n) || n<0) return null;
  if(n<20) return NUM_ONES[n];
  if(n<100){ const t=Math.floor(n/10), r=n%10; return NUM_TENS[t]+(r?' '+NUM_ONES[r]:''); }
  if(n<1000){ const h=Math.floor(n/100), r=n%100;
    return NUM_ONES[h]+' hundred'+(r?' and '+numWord(r):''); }
  return null;
}
function mathSteps(text){
  /* 支持三种写法：
       7 plus 5 equals what?   数学题的提问式
       7 plus 5 equals         只读到「等于」，留给孩子说出答案
       7 plus 5 equals 12      汇总页的完整口诀，把结果也读出来 */
  const m=/^(\d{1,3})\s+(plus|minus)\s+(\d{1,3})\s+equals(?:\s+(what|\d{1,3}))?\s*\??$/i.exec(String(text||'').trim());
  if(!m) return null;
  const arg=String(m[4]||'').toLowerCase();
  const parts=[numWord(m[1]), m[2].toLowerCase(), numWord(m[3]), arg==='what' ? 'equals what' : 'equals'];
  if(arg && arg!=='what') parts.push(numWord(arg));
  const steps=[];
  for(const p of parts){
    if(!p) return null;
    const u=clipFor(p);
    if(!u) return null;                    // 缺任何一段就整句交给 TTS，别读半句
    /* 段间间隔 70ms：单词录音已裁掉首尾静音（tools/trim_silence.py），
       留太长会听成一句一顿；70ms 接近自然连读的停顿。 */
    steps.push({clip:u, text:p, lang:'en-US', gap:70});
  }
  return steps;
}
/* 读题：优先播放题目自带的本地录音（中文拼音），其次查英文词库，
   最后才用浏览器 TTS。任何一环失败都会回退到 TTS，绝不出现「没声音」。
   拼读题带 seq（韵母 → 韵母带调 → 声母 → 整体拼读）时按顺序逐段播放，
   每段都是「本地录音优先，缺了就 TTS 兜底」，段间留 0.4 秒让孩子跟读。 */
function playSpeak(s, onEnd){
  if(!s) return;
  /* 数学算式自动拆成预录片段，避免和词库/短文的声音不是同一个人 */
  if(!Array.isArray(s.seq) && s.text){
    const ms=mathSteps(s.text);
    if(ms){ playSpeak({seq:ms, lang:s.lang}, onEnd); return; }
  }
  if(Array.isArray(s.seq) && s.seq.length){
    const lang=s.lang||'zh-CN';
    let i=0;
    const next=()=>{
      if(i>=s.seq.length){ if(onEnd) onEnd(); return; }
      const st=s.seq[i++];
      const stepDone=()=>setTimeout(next, st.gap!=null?st.gap:400);
      const fail=()=>{
        /* TTS 兜底也要等这段读完再进下一段，不然拼音四步会叠在一起 */
        if(st.text) speak(st.text, st.lang||lang, ()=>setTimeout(next, st.gap!=null?st.gap:120));
        else setTimeout(next, 100);
      };
      if(st.clip && playClip(st.clip,stepDone,fail)) return;
      if(st.text){ fail(); return; }
      stepDone();
    };
    next();
    return;
  }
  let fellBack=false;
  const fallback=()=>{
    if(fellBack) return; fellBack=true;
    /* 只有确实有兜底文本才出声。音素格故意把 data-say 留空：
       宁可安静，也不要让设备 TTS 把 "zhh" / "ng" 这类拼法念成乱七八糟的音。 */
    if(s.text){ speak(s.text, s.lang, onEnd ? ()=>setTimeout(onEnd,120) : null); return; }
    if(onEnd) setTimeout(onEnd, 200);
  };
  if(s.clip && playClip(s.clip,onEnd,fallback)) return;
  const url=clipFor(s.text);
  const slowUrl=clipFor(s.text+'::slow');
  const target=(s.slow && slowUrl) ? slowUrl : url;
  if(target && playClip(target,onEnd,fallback)) return;
  fallback();
}
/* ---------- 进题自动播报 ----------
   用令牌把「上一题遗留的延迟播放」挡掉，避免串题；
   forceAuto 的题型（语法 / 句子建构）不受设置开关影响，进题必读。 */
let _autoSpeakToken=0;
function autoSpeak(q,force){
  const s=q && q.speak;
  if(!s) return;
  const should=force || s.forceAuto ||
    (s.autoplay ? Store.getSetting('zhread') : Store.getSetting('autoread'));
  if(!should) return;
  const my=++_autoSpeakToken;
  setTimeout(()=>{ if(my===_autoSpeakToken) playSpeak(s); }, 400);
}
/* 完成课程：先来一声该宝可梦的叫声，再用它的专属音色说鼓励语 */
function pokeCry(id){
  if(!Store.getSetting('sound')) return;
  const key=String(id||'pikachu');        // 允许未选伙伴时调用
  const n=[...key].reduce((a,c)=>a+c.charCodeAt(0),0);
  const base=440 + (n%9)*55;
  try{
    if(!_actx) _actx=new (window.AudioContext||window.webkitAudioContext)();
    if(_actx.state==='suspended') _actx.resume();
    const c=_actx, o=c.createOscillator(), g=c.createGain();
    o.type='triangle';
    o.frequency.setValueAtTime(base, c.currentTime);
    o.frequency.exponentialRampToValueAtTime(base*1.7, c.currentTime+0.10);
    o.frequency.exponentialRampToValueAtTime(base*1.15, c.currentTime+0.26);
    g.gain.setValueAtTime(0.0001,c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.14,c.currentTime+0.03);
    g.gain.exponentialRampToValueAtTime(0.0001,c.currentTime+0.32);
    o.connect(g).connect(c.destination);
    o.start(); o.stop(c.currentTime+0.34);
  }catch(e){}
}
/* 完成课程：宝可梦叫声（区分角色）+ 统一女声鼓励语
   旧版给 63 只宝可梦各录了一套「不同底嗓 + 变调」的鼓励语（男声 Fred/Ralph/
   Albert/Reed/Rocko 都在里面，音高 1.06–1.58 倍），这就是「一句话一个声音、
   有的还发闷」的来源。现在鼓励语只由 ttsSpeak 用锁定女声说，角色差异交给叫声。 */
function playCheer(id){
  if(!Store.getSetting('sound')) return;
  pokeCry(id||'pikachu');
  setTimeout(()=>{ speak(pick(CHEER_LINES), 'en-US'); }, 330);
}

/* ---------- 轻量音效（WebAudio 合成，无需音频文件） ---------- */
let _actx=null;
function tone(freq,t0,dur,type,vol){
  const c=_actx, o=c.createOscillator(), g=c.createGain();
  o.type=type||'sine'; o.frequency.value=freq;
  g.gain.setValueAtTime(0.0001,c.currentTime+t0);
  g.gain.exponentialRampToValueAtTime(vol||0.18,c.currentTime+t0+0.02);
  g.gain.exponentialRampToValueAtTime(0.0001,c.currentTime+t0+dur);
  o.connect(g).connect(c.destination);
  o.start(c.currentTime+t0); o.stop(c.currentTime+t0+dur+0.05);
}
/* 噪声爆发（水电火等属性共用）：duration 秒，指数衰减的伪随机噪声 */
function noiseBurst(t0, dur, vol, filterType, filterFreq){
  const c=_actx;
  const len=Math.max(1,Math.floor(c.sampleRate*dur));
  const buf=c.createBuffer(1,len,c.sampleRate);
  const d=buf.getChannelData(0);
  for(let i=0;i<len;i++) d[i]=(Math.random()*2-1)*Math.pow(1-i/len,1.6);
  const s=c.createBufferSource(); s.buffer=buf;
  let node=s;
  if(filterType && c.createBiquadFilter){
    const f=c.createBiquadFilter(); f.type=filterType; f.frequency.value=filterFreq||1000;
    s.connect(f); node=f;
  }
  const g=c.createGain();
  g.gain.setValueAtTime(0.0001,c.currentTime+t0);
  g.gain.exponentialRampToValueAtTime(vol||0.12,c.currentTime+t0+Math.min(0.05,dur*0.2));
  g.gain.exponentialRampToValueAtTime(0.0001,c.currentTime+t0+dur);
  node.connect(g).connect(c.destination);
  s.start(c.currentTime+t0);
}
/* 滑音（蓄力→爆发）：从 f0 扫到 f1 */
function sweep(t0,dur,f0,f1,type,vol){
  const c=_actx,t=c.currentTime+t0,o=c.createOscillator(),g=c.createGain();
  o.type=type||'sawtooth';
  o.frequency.setValueAtTime(f0,t);
  o.frequency.exponentialRampToValueAtTime(f1,t+dur);
  g.gain.setValueAtTime(0.0001,t);
  g.gain.exponentialRampToValueAtTime(vol||0.14,t+0.06);
  g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
  o.connect(g).connect(c.destination); o.start(t); o.stop(t+dur+0.03);
}
/* 按属性合成绝招音效：每类音色/节奏都不同 */
function moveSfx(type){
  const t=0;
  switch(type){
    case 'fire':    sweep(t,0.5,180,900,'sawtooth',0.13); noiseBurst(0.35,0.5,0.13,'lowpass',1400); break;
    case 'water':   sweep(t,0.35,700,180,'sine',0.14); noiseBurst(0.2,0.55,0.14,'lowpass',900); tone(300,0.5,0.3,'sine',0.08); break;
    case 'electric':[0,0.08,0.16,0.26].forEach((d,i)=>noiseBurst(d,0.10,0.13,'highpass',2500));
                    tone(1200,0.1,0.08,'square',0.06); tone(1600,0.28,0.1,'square',0.06); break;
    case 'grass':   sweep(t,0.4,300,1200,'triangle',0.12); noiseBurst(0.25,0.35,0.10,'bandpass',2000); break;
    case 'ice':     [1400,1800,2200,2600].forEach((f,i)=>tone(f,i*0.07,0.22,'sine',0.09)); noiseBurst(0.2,0.4,0.08,'highpass',3000); break;
    case 'psychic': sweep(t,0.6,260,1500,'sine',0.10); [784,988,1319].forEach((f,i)=>tone(f,0.35+i*0.06,0.4,'sine',0.07)); break;
    case 'fighting':noiseBurst(0.0,0.12,0.18,'lowpass',600); noiseBurst(0.28,0.14,0.18,'lowpass',600); tone(120,0.3,0.2,'square',0.12); break;
    case 'dragon':  sweep(t,0.7,120,700,'sawtooth',0.12); [392,466,587,784].forEach((f,i)=>tone(f,0.3+i*0.08,0.35,'triangle',0.08)); break;
    case 'ghost':   sweep(t,0.7,600,140,'sine',0.11); noiseBurst(0.15,0.6,0.10,'lowpass',700); break;
    case 'ground':
    case 'rock':    noiseBurst(0.0,0.25,0.16,'lowpass',400); noiseBurst(0.3,0.3,0.16,'lowpass',350); tone(90,0.25,0.35,'triangle',0.14); break;
    case 'bug':     sweep(t,0.45,500,1400,'triangle',0.10); noiseBurst(0.1,0.4,0.08,'bandpass',2500); break;
    case 'flying':  sweep(t,0.5,300,1100,'sine',0.10); noiseBurst(0.15,0.5,0.11,'bandpass',800); break;
    case 'sound':   [659,784,988,784,1047].forEach((f,i)=>tone(f,i*0.11,0.22,'sine',0.10)); break;
    case 'steel':   [900,1200].forEach((f,i)=>tone(f,i*0.12,0.3,'square',0.07)); noiseBurst(0.1,0.35,0.10,'highpass',2000); break;
    case 'fairy':   [1047,1319,1568,2093].forEach((f,i)=>tone(f,i*0.08,0.3,'sine',0.08)); break;
    default:        sweep(t,0.55,160,1400,'sawtooth',0.13); noiseBurst(0.55,0.45,0.12,'lowpass',1200);
  }
}
function sfx(kind, type){
  if(!Store.getSetting('sound')) return;
  try{
    if(!_actx) _actx=new (window.AudioContext||window.webkitAudioContext)();
    if(_actx.state==='suspended') _actx.resume();
    if(kind==='good'){ tone(523,0,0.12); tone(659,0.10,0.12); tone(784,0.20,0.18); }
    else if(kind==='bad'){ tone(220,0,0.15,'triangle',0.10); tone(180,0.12,0.2,'triangle',0.10); }
    else if(kind==='evolve'){ [523,659,784,1047].forEach((f,i)=>tone(f,i*0.12,0.22)); }
    /* 进化动画：第一段充能上行 + 第二段登场和弦 */
    else if(kind==='evolveCharge'){
      [392,494,587,698,880].forEach((f,i)=>tone(f,i*0.13,0.20,'sine',0.13));
      tone(1760,0.62,0.5,'triangle',0.05);
    }
    else if(kind==='evolveUp'){
      [523,659,784,1047,1319].forEach((f,i)=>tone(f,i*0.10,0.30,'sine',0.15));
      tone(2093,0.48,0.6,'triangle',0.07);
    }
    /* 被击败：下行音阶 + 闷响 */
    else if(kind==='defeat'){
      [523,440,349,262,196].forEach((f,i)=>tone(f,i*0.16,0.26,'triangle',0.14));
      tone(98,0.82,0.4,'sawtooth',0.10);
    }
    /* 专属绝招：按属性播放不同音色/节奏 */
    else if(kind==='move'){ moveSfx(type||'normal'); }
    /* 必杀技（旧版兼容）：蓄力低鸣 → 高频光束 + 噪声爆发 */
    else if(kind==='skill'){
      const c=_actx, t=c.currentTime;
      const o=c.createOscillator(), g=c.createGain();
      o.type='sawtooth';
      o.frequency.setValueAtTime(160,t);
      o.frequency.exponentialRampToValueAtTime(1400,t+0.55);
      g.gain.setValueAtTime(0.0001,t);
      g.gain.exponentialRampToValueAtTime(0.14,t+0.10);
      g.gain.exponentialRampToValueAtTime(0.0001,t+0.6);
      o.connect(g).connect(c.destination);
      o.start(t); o.stop(t+0.65);
      const len=Math.floor(c.sampleRate*0.45);
      const buf=c.createBuffer(1,len,c.sampleRate);
      const d=buf.getChannelData(0);
      for(let i=0;i<len;i++) d[i]=(Math.random()*2-1)*Math.pow(1-i/len,2);
      const s=c.createBufferSource(); s.buffer=buf;
      const g2=c.createGain(); g2.gain.setValueAtTime(0.12,t+0.55);
      s.connect(g2).connect(c.destination);
      s.start(t+0.55);
      tone(1047,0.55,0.35,'square',0.06);
    }
  }catch(e){}
}

/* ---------- 进化进度存档（跨版本） ----------
 * 首页「💾 保存进度」写一份独立于 schema 的存档；
 * 以后每个版本启动时，如果主存档被升级/清缓存冲空了，会自动接回这份存档。 */
function fmtArchiveTime(ts){
  const d=new Date(ts||Date.now());
  const p=n=>String(n).padStart(2,'0');
  return `${p(d.getMonth()+1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
function updateArchiveUI(){
  const info=$('#archiveInfo'), loadBtn=$('#loadArchiveBtn');
  if(!info) return;
  /* 「读取存档」从打开软件起就一直在，不随有没有存档而隐藏：
     登录云同步版时还能选「其他设备最后一次存档」。 */
  if(loadBtn) loadBtn.classList.remove('hidden');
  const a=Store.manualArchive();
  const b=Store.backupArchive();
  const cs=(typeof CloudSync!=='undefined' && CloudSync.status) ? CloudSync.status() : null;
  if(a){
    info.textContent=`本机存档：${fmtArchiveTime(a.savedAt)} · 已进化 ${a.evolved||0} 只 / 累计 ${a.stages||0} 阶`
      + (cs && cs.signedIn ? '（登录后点「读取存档」可选云端版本）' : '');
  }else if(cs && cs.signedIn){
    info.textContent='☁️ 已登录：点「读取存档」选本机存档，或其他设备最后一次同步的云端进度';
  }else{
    info.textContent = b
      ? `还没有手动存档（自动备份：已进化 ${b.evolved||0} 只）`
      : '点「保存进度」存一份；点「读取存档」从存档接回进度';
  }
}
function bindArchiveButtons(){
  const saveBtn=$('#saveArchiveBtn'), loadBtn=$('#loadArchiveBtn');
  if(saveBtn) saveBtn.onclick=()=>{
    const a=Store.saveArchive();
    if(!a){ toastMsg('⚠️ 这个页面不能保存，请从主屏图标打开'); return; }
    updateArchiveUI(); sfx('good');
    toastMsg(`💾 进度已存档：${a.evolved} 只宝可梦 · ${a.stages} 阶`);
  };
  if(loadBtn) loadBtn.onclick=()=>openLoadArchivePicker();
}

/* ---------- 读取存档：本机存档 + （登录后）云端存档 二选一 ---------- */
async function openLoadArchivePicker(){
  const local=Store.manualArchive();
  const backup=Store.backupArchive();
  const cs=(typeof CloudSync!=='undefined' && CloudSync.status) ? CloudSync.status() : null;

  /* 云端摘要需要异步读取，先探测；失败就只给本机选项，不阻塞 */
  let cloud=null;
  if(cs && cs.signedIn && typeof CloudSync.peekRemoteArchive==='function'){
    try{ cloud=await CloudSync.peekRemoteArchive(); }catch(e){ cloud=null; }
  }

  const opts=[];
  if(local) opts.push({kind:'manual', a:local,
    label:`本机存档 · ${fmtArchiveTime(local.savedAt)}`,
    detail:`已进化 ${local.evolved||0} 只 / 累计 ${local.stages||0} 阶`});
  if(cloud && cloud.found){
    const when=cloud.updatedAt ? fmtArchiveTime(new Date(cloud.updatedAt).getTime()) : '最近';
    opts.push({kind:'cloud', c:cloud,
      label:`☁️ 云端存档 · ${when}`,
      detail:`其他设备最后一次同步 · 已进化 ${cloud.evolved||0} 只 / 累计 ${cloud.stages||0} 阶`});
  }
  if(!opts.length && backup){
    opts.push({kind:'backup', a:backup,
      label:`自动备份 · ${fmtArchiveTime(backup.savedAt)}`,
      detail:`已进化 ${backup.evolved||0} 只 / 累计 ${backup.stages||0} 阶`});
  }
  if(!opts.length){
    toastMsg('还没有存档：先在别的设备登录同一账号同步一次，或点「保存进度」存一份');
    return;
  }

  const apply=(opt)=>{
    if(opt.kind==='cloud'){
      if(!confirm(`读取云端（其他设备最后一次）的进度？\n${opt.detail}\n只会往前接，不会让本机进度倒退。`)) return;
      /* 云端存档是完整 Schema 存档，用云端拉取合并（取更高 + 记录并集），不倒退 */
      if(typeof CloudSync!=='undefined' && CloudSync.syncNow) CloudSync.syncNow(true);
      return;
    }
    const a=opt.a;
    if(!confirm(`读取 ${opt.label} 保存的进度？\n（${opt.detail}，只会往前接，不会倒退）`)) return;
    const r=Store.applyArchive(a);
    updateCompanion(); renderHome();
    toastMsg(r ? `📂 已读取存档（${r.upgraded} 只更新）` : '当前进度已经比存档更靠前了');
  };

  if(opts.length===1){ apply(opts[0]); return; }

  /* 多个来源 → 弹选择器 */
  let m=$('#loadArchiveModal');
  if(!m){
    m=document.createElement('div');
    m.id='loadArchiveModal'; m.className='modal hidden';
    m.innerHTML='<div class="modal-card"><button class="modal-x" id="loadArchiveX" aria-label="关闭">✕</button>'
      +'<h2>📂 读取存档</h2><p class="muted">选择要读取的存档，进度只会往前接、不会倒退。</p>'
      +'<div id="loadArchiveChoices"></div></div>';
    document.body.appendChild(m);
    $('#loadArchiveX').onclick=()=>m.classList.add('hidden');
    m.onclick=e=>{ if(e.target===m) m.classList.add('hidden'); };
  }
  const box=$('#loadArchiveChoices');
  box.innerHTML=opts.map((o,i)=>`<button class="btn-load load-choice" data-i="${i}" style="display:block;width:100%;margin:10px 0;text-align:left;white-space:normal;line-height:1.5">`
    +`<b>${o.label}</b><br><span class="muted" style="font-size:13px">${o.detail}</span></button>`).join('');
  box.querySelectorAll('.load-choice').forEach(b=>{
    b.onclick=()=>{ m.classList.add('hidden'); apply(opts[Number(b.dataset.i)]); };
  });
  m.classList.remove('hidden');
}

/* ---------- 存档状态提示 ---------- */
function updateStorageUI(){
  const warn=$('#storageWarn');
  if(warn) warn.classList.toggle('hidden', Store.available);
  const st=$('#saveStatus');
  if(st){
    if(Store.available){
      st.textContent = Store.lastSaved
        ? '💾 Saved '+new Date(Store.lastSaved).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})
        : '💾 Progress auto-saves';
    }else{
      st.textContent = '⚠️ Saving is OFF on this page';
    }
  }
}
function flashSaved(){
  toastMsg(Store.available ? '💾 Progress saved!' : '⚠️ Open via the app to save');
}
function toastMsg(msg){
  const t=$('#toast'); if(!t) return;
  t.textContent = msg;
  t.classList.remove('hidden'); t.classList.add('show');
  clearTimeout(toastMsg._t);
  toastMsg._t=setTimeout(()=>{ t.classList.remove('show'); t.classList.add('hidden'); }, 2200);
}
window.__onSaved = updateStorageUI;

/* ---------- 宝可梦图像（官方图 + emoji 兜底） ---------- */
function pokeImgTag(st, cls){
  return `<img class="poke-img ${cls||''}" src="${pokeImg(st.imgId)}" data-emoji="${st.emoji}" alt="${st.name}">`;
}
function bindPokeImages(root){
  (root||document).querySelectorAll('img.poke-img').forEach(img=>{
    img.onerror=()=>{
      const s=document.createElement('span');
      s.className='poke-emoji-fallback';
      s.textContent=img.dataset.emoji;
      img.replaceWith(s);
    };
  });
}

/* ---------- 首页 ---------- */
function renderHome(){
  renderCollection();
  updateMistakeFab();
  // 绘本库入口：顺手显示阅读进度
  const libSub = $('#libraryEntry .subject-sub');
  if(libSub && typeof availableBooks==='function'){
    const avail = availableBooks();
    const st = Store.bookStats(BOOKS);
    libSub.textContent = `已读 ${st.read} / ${avail.length} 本 · 每周一上新 5 本`;
  }
  updateStorageUI();
  updateArchiveUI();
}

function renderCollection(){
  const box=$('#pokeCollection'); box.innerHTML='';
  POKEMON.forEach(pk=>{
    const info=Store.stageInfo(pk.id);
    const st=info.form;
    const chip=document.createElement('div');
    chip.className='poke-chip';
    /* 伊布是「按顺序拿石头」的独立路线，用石头图标区分；其它多选一分支仍用 🧬 */
    const badge = info.chainBranch>1
      ? `<div class="chip-branch">${info.sequential?'🪨':'🧬'} ×${info.chainBranch}</div>` : '';
    chip.innerHTML=`<div class="face">${pokeImgTag(st,'chip-img')}</div>
      <div class="nm">${st.name}</div>
      <div class="cn">${st.cn}</div>
      <div class="ebar"><i style="width:${Math.round(info.progress*100)}%"></i></div>
      <div class="est">${info.maxed?'🏆 MAX!':`Lv${info.stage+1} · ${Math.round(info.intoStage)}/${info.need}`}</div>${badge}`;
    chip.title=info.sequential?`看 ${pk.cn} 的能量石进化路线`:`看 ${pk.cn} 的进化家族`;
    chip.onclick=()=>openFamily(pk.id);
    box.appendChild(chip);
  });
  bindPokeImages(box);
}

/* ---------- 伊布专属：能量石顺序进化路线 ----------
   和其他宝可梦的「一次进化 + 多选一」完全不同：
   伊布每攒满 100 能量按固定顺序拿一颗石头，变成下一种形态；变过的不会再出现。
   整条路线一次铺开给孩子看，已经走过的打勾，当前的高亮，后面的上锁。 */
function renderSequentialFamily(pk,info){
  const chain=pk.stages;                       // 顺序链的每一阶（伊布 9 阶、走路草/蚊香蝌蚪/拉鲁拉丝 4 阶）
  const stones=chain.length-1;
  $('#familyTitle').textContent=`${pk.emoji} ${pk.cn} · ${pk.name}`;
  $('#familyHint').innerHTML=`<b>${pk.cn}有自己的能量石路线</b> 🪨<br>
    每攒满 <b>${ENERGY_PER_STAGE}</b> 点能量就得到下一颗石头、按固定顺序变身；变过的形态不会再出现。`;
  let h='<div class="fam-seq">';
  chain.forEach((f,i)=>{
    const done=i<info.stage, cur=i===info.stage, locked=i>info.stage;
    const tag = cur ? '<div class="fam-tag now">⭐ 现在这个</div>'
              : done ? '<div class="fam-tag ok">✔ 已获得</div>'
              : '<div class="fam-tag lock">🔒 还没拿到石头</div>';
    h+=`<div class="fam-seq-node ${cur?'is-cur':''} ${done?'owned':''} ${locked?'locked':''}">
        <div class="fam-seq-no">${i===0?'START':'STONE '+i}</div>
        <div class="fam-face">${pokeImgTag(f,'fam-img')}</div>
        <div class="fam-nm">${f.name}</div>
        <div class="fam-cn">${f.cn}</div>
        <div class="fam-evo">${i===0?'最初形态':(f.evo||'按顺序进化')}</div>
        ${tag}
      </div>`;
    if(i<chain.length-1) h+='<div class="fam-seq-arrow">➜</div>';
  });
  h+='</div>';
  h+=`<div class="fam-foot">${info.maxed
      ? `🏆 ${stones} 颗能量石全收集齐啦！${pk.cn}已经走完整条路线～`
      : `答对 +${ENERGY_PER_ANSWER} ⚡ / 答错 −${ENERGY_PER_ANSWER} ⚡ · 再攒 <b>${Math.max(0,info.need-info.intoStage)}</b> 点能量就能拿到第 ${info.stage+1} 颗石头<br>
         ${pk.cn}不会退化，已经变过的形态不会重复出现`}</div>`;
  $('#familyBody').innerHTML=h;
  bindPokeImages($('#familyBody'));
  $('#familyModal').classList.remove('hidden');
}

/* ---------- 进化家族图鉴 ----------
   伊布这类「2 阶但有 8 种形态」的宝可梦，光看 Lv1/Lv2 会以为只有 2 个等级，
   所以点首页头像可以打开完整家族：每个阶段、每种分支形态、进化条件都列出来；
   如果已经到了分支阶，还能点别的形态直接换过去（8 种都能试）。 */
function openFamily(id){
  const pk=POKEMON.find(p=>p.id===id); if(!pk) return;
  const info=Store.stageInfo(id);
  if(info.sequential){ renderSequentialFamily(pk,info); return; }
  const bIdx=branchStages(pk);
  const multi=bIdx.length ? branchOptions(pk,bIdx[0]).length : 0;
  const branchStageNo=bIdx.length ? bIdx[0]+1 : 0;

  $('#familyTitle').textContent=`${pk.emoji} ${pk.cn} · ${pk.name}`;
  $('#familyHint').innerHTML = multi>1
    ? `${pk.cn} 只有 <b>1 次</b>进化，但第 ${branchStageNo} 阶可以变成 <b>${multi} 种</b>不同的样子（官方设定）✨`
    : `一共 ${pk.stages.length} 个阶段 · 每 ${ENERGY_PER_STAGE} 点能量进化一次 ⚡`;

  let h='';
  pk.stages.forEach((s,si)=>{
    const forms=Array.isArray(s)?s:[s];
    const label = si===0 ? '第 1 阶 · 最初形态'
                : (si===pk.stages.length-1 ? `第 ${si+1} 阶 · 最终形态` : `第 ${si+1} 阶`);
    const note = (Array.isArray(s)&&forms.length>1)
      ? `<span class="fam-branch-note">选 1 种 · 共 ${forms.length} 种</span>` : '';
    h+=`<div class="fam-stage ${si===info.stage?'cur':''}">
      <div class="fam-stage-head">
        <span class="fam-stage-name">${label}</span>${note}
        ${si===info.stage?'<span class="fam-now">现在</span>':''}
      </div>
      <div class="fam-forms">`;
    forms.forEach((f,fi)=>{
      const owned = si<info.stage;
      const isCur = si===info.stage;
      const sel   = isCur && !!Array.isArray(s) && (info.branch||0)===fi;
      const canPick = isCur && !!Array.isArray(s);
      const tag = sel ? '<div class="fam-tag now">✔ 现在这个</div>'
                : owned ? '<div class="fam-tag ok">✔ 曾经拥有</div>'
                : canPick ? '<div class="fam-tag pick">点它换形态</div>'
                : si>info.stage ? '<div class="fam-tag lock">🔒 还没到</div>' : '';
      h+=`<div class="fam-card ${isCur?'is-cur':''} ${sel?'sel':''} ${owned?'owned':''} ${si>info.stage?'locked':''}"
             ${canPick?`data-branch="${fi}"`:''}>
        <div class="fam-face">${pokeImgTag(f,'fam-img')}</div>
        <div class="fam-nm">${f.name}</div>
        <div class="fam-cn">${f.cn}</div>
        ${f.evo?`<div class="fam-evo">${f.evo}</div>`:''}
        ${tag}
      </div>`;
    });
    h+='</div></div>';
  });
  h+=`<div class="fam-foot">${info.maxed
        ? '🏆 已经到最终形态了！换个伙伴继续收集吧～'
        : `答对 +${ENERGY_PER_ANSWER} ⚡ / 答错 −${ENERGY_PER_ANSWER} ⚡ · 攒满 ${ENERGY_PER_STAGE} 点进化一阶<br>
           全对一套 10 题最多 +${ENERGY_PER_ANSWER*10} ⚡，再努力 <b>${Math.ceil((info.need-info.intoStage)/(ENERGY_PER_ANSWER*10))}</b> 套全对就能进化 ⚡`}</div>`;

  $('#familyBody').innerHTML=h;
  bindPokeImages($('#familyBody'));

  // 已到分支阶：点另一种形态即可立刻换过去（伊布 8 种都能收集）
  $$('#familyBody .fam-card[data-branch]').forEach(c=>{
    c.onclick=()=>{
      const fi=Number(c.dataset.branch);
      if(fi===(info.branch||0)) return;
      const f=branchOptions(pk,info.stage)[fi];
      if(!confirm(`让 ${pk.cn} 变成「${f.cn}」吗？`)) return;
      Store.setBranch(id,fi);
      updateCompanion();
      toastMsg(`✨ ${pk.cn} 变成了 ${f.cn}！`);
      openFamily(id);
    };
  });
  $('#familyModal').classList.remove('hidden');
}
$('#familyCloseBtn').onclick=()=>$('#familyModal').classList.add('hidden');

/* ---------- 科目列表（修复：点击科目卡片） ---------- */
$$('.subject-card').forEach(c=>{
  c.onclick=()=>openSubject(c.dataset.subject);
});
function openSubject(subject){
  state.subject=subject;
  const cur=CURRICULUM[subject];
  setTopTitle(cur.label);
  $('#subjectTitle').textContent=cur.label;
  $('#subjectHint').textContent = subject==='english'
    ? 'All-English: Read · Spell · Write'
    : subject==='math' ? 'All-English · Singapore Math thinking (within 20)'
    : '汉语拼音 · 汉字 (Pinyin & Characters)';
  const list=$('#lessonList'); list.innerHTML='';
  cur.lessons.forEach(les=>{
    const done=Store.isLessonDone(subject,les.id);
    const card=document.createElement('div');
    card.className='lesson-card '+subject;
    const lvl = les.level ? `<span class="level-badge">${LEVEL_LABEL[les.level]}</span>` : '';
    const isZhSubject = subject==='chinese';
    let desc=les.desc;
    /* 汇总页（ref 卡片）：只读挂图，不参与答题统计，也不显示难度/已做 */
    if(les.ref){
      card.classList.add('ref-card');
      card.innerHTML=`<div class="lc-emoji">${les.emoji}</div>
        <div class="lc-body"><div class="lc-title">${les.title}</div>
        <div class="lc-desc">${desc}</div></div>
        <div class="lc-done ref-open">📖</div>`;
      card.onclick=()=>openRef(subject,les.ref);
      list.appendChild(card);
      return;
    }
    if(les.id==='e-read' && typeof readStats==='function'){
      const rs=readStats(Store.readDoneIds());
      const lv=(READ_LEVEL_INFO[rs.level]&&(READ_LEVEL_INFO[rs.level].en||READ_LEVEL_INFO[rs.level].label))||'';
      desc=`${rs.done}/${rs.total} correct · Level ${rs.level} (${lv}) · 5 new stories every week`;
    }
    if(typeof QEngine!=='undefined' && QEngine.stats){
      const qs=QEngine.stats(les.id);
      if(isZhSubject){
        desc+=` · 难度 ${qs.level}/5 ${qs.label} · 已做 ${qs.seen} 题`;
        if(qs.grown) desc+=` · 题库自动扩充 ${qs.grown} 次`;
      }else{
        desc+=` · Level ${qs.level}/5 ${qs.labelEn||''} · ${qs.seen} questions done`;
        if(qs.grown) desc+=` · ${qs.grown} auto-added`;
      }
    }
    card.innerHTML=`<div class="lc-emoji">${les.emoji}</div>
      <div class="lc-body"><div class="lc-title">${les.title} ${lvl}</div>
      <div class="lc-desc">${desc}</div></div>
      <div class="lc-done">${done?'✅':''}</div>`;
    card.onclick=()=>startLesson(subject,les.id);
    list.appendChild(card);
  });
  show('screen-subject');
}

/* ---------- 汇总页（只读挂图） ----------
 * 课程列表里的 ref 卡片点开后直接进这里，不选宝可梦、不答题、不记进度。
 * 页面内容由 js/ref-pages.js 提供（REF_PAGES[refId].render()）。
 * 点任意格子朗读：中文走预录 audio/zh，英文走 audio/words（同一把女声）。 */
function openRef(subject, refId){
  const def = (typeof REF_PAGES!=='undefined') ? REF_PAGES[refId] : null;
  if(!def){ toastMsg('Chart not found'); return; }
  state.subject = subject || def.subject || state.subject;
  setTopTitle(def.title);
  $('#refTitle').textContent = def.title;
  $('#refHint').textContent = def.hint || '';
  const body = $('#refBody');
  body.className = 'ref-body ' + (state.subject || def.subject || '');
  body.innerHTML = def.render();
  body.dataset.lang = def.lang || 'en-US';
  bindRefTaps(body);
  show('screen-ref');
  body.scrollTop = 0;
  window.scrollTo(0,0);
}
/* 事件委托：所有带 data-say 的格子共用一套朗读逻辑 */
function bindRefTaps(root){
  if(root.dataset.bound) return;
  root.dataset.bound='1';
  root.addEventListener('click', ev=>{
    const el = ev.target.closest('[data-say]');
    if(!el) return;
    el.classList.remove('tap'); void el.offsetWidth; el.classList.add('tap');
    const lang = root.dataset.lang || 'en-US';
    const text = el.dataset.say;
    /* data-clipurls：一个格子要连读多个音素（字母卡 A a → /æ/ 再 /eɪ/），| 分隔 */
    const urls = el.dataset.clipurls;
    if(urls){
      const seq = urls.split('|').filter(Boolean).map(u=>({clip:u, text:'', lang, gap:180}));
      if(seq.length && typeof playSpeak==='function'){ playSpeak({seq, lang}); return; }
    }
    const kind = el.dataset.clip, key = el.dataset.key;
    /* data-clipurl：整条 URL 已经写好（英语音素 audio/ipa/<key>.m4a）
       data-clip + data-key：中文音频按 zhClip(kind,key) 拼 */
    let clip = el.dataset.clipurl || null;
    if(!clip && kind && typeof zhClip==='function') clip = zhClip(kind, key);
    if(typeof playSpeak==='function') playSpeak({ clip, text, lang });
    else speak(text, lang);
  });
}

/* ---------- 宝可梦选择 ---------- */
let pendingLesson=null;
function startLesson(subject,lessonId){
  pendingLesson={subject,lessonId};
  openPokemonModal();
}

function openPokemonModal(){
  const picker=$('#pokePicker'); picker.innerHTML='';
  $('#pokeSearch').value='';
  POKEMON.forEach(pk=>{
    const info=Store.stageInfo(pk.id);
    const st=info.form;
    const opt=document.createElement('div');
    opt.className='poke-opt'+(info.dead?' dead':''); opt.dataset.id=pk.id;
    opt.dataset.search=(pk.name+' '+pk.cn+' '+st.name+' '+st.cn).toLowerCase();
    const bn = info.chainBranch>1 ? ` · ${info.chainBranch} 形态` : '';
    const statLine = info.dead
      ? `💤 Fainted · 复活于 ${info.deadUntil}`
      : (info.maxed?`MAX!${bn}`:`⚡ ${Math.round(info.intoStage)}/${info.need} · Stage ${info.stage+1}/${pk.stages.length}${bn}`);
    opt.innerHTML=`<div class="face">${pokeImgTag(st,'opt-img')}</div>
      <div class="nm">${st.name}</div>
      <div class="cn">${st.cn}</div>
      <div class="stage">${statLine}</div>`;
    if(info.dead){
      // 昨天昏倒的宝可梦今天还不能选，明早自动复活
      opt.onclick=()=>{ sfx('bad'); };
    }else{
      opt.onclick=()=>{
        $$('#pokePicker .poke-opt, #branchPicker .poke-opt').forEach(o=>o.classList.remove('sel'));
        opt.classList.add('sel');
        $('#confirmPokemonBtn').disabled=false;
      };
    }
    picker.appendChild(opt);
  });
  $('#confirmPokemonBtn').disabled=true;
  $('#pokemonModal').classList.remove('hidden');
  bindPokeImages(picker);
}
function filterPicker(q){
  const k=q.trim().toLowerCase();
  $$('#pokePicker .poke-opt').forEach(o=>o.classList.toggle('filtered', k && !o.dataset.search.includes(k)));
}
$('#pokeSearch').oninput=e=>filterPicker(e.target.value);

$('#confirmPokemonBtn').onclick=()=>{
  const sel=$('#pokePicker .poke-opt.sel'); if(!sel) return;
  state.selectedPokemon=sel.dataset.id;
  $('#pokemonModal').classList.add('hidden');
  beginSession(pendingLesson.subject,pendingLesson.lessonId);
};
$('#homeBtn').onclick=()=>{
  // 课程做一半离开会丢本次进度，先跟小朋友确认一下
  const inLesson = !$('#screen-lesson').classList.contains('hidden') && state.idx < state.total;
  if(inLesson && !confirm('Leave this lesson? The questions in this lesson will not be saved.')) return;
  show('screen-home');
};
$('#backBtn').onclick=goBack;

/* 选宝可梦弹窗可以取消：点「✖ 取消」或点弹窗外面的空白处都能退出，
   退出后仍停在课程列表，不会误入课程。 */
function closePokemonPicker(){
  $('#pokemonModal').classList.add('hidden');
  pendingLesson=null;
}
$('#cancelPickBtn').onclick=closePokemonPicker;
$('#pokemonModal').addEventListener('click',e=>{
  if(e.target.id==='pokemonModal') closePokemonPicker();
});
$('#mistakeFab').onclick=()=>openMistakes();
$('#parentBtn').onclick=()=>show('screen-parent');
bindArchiveButtons();
/* 上一版启动时主存档被冲空、已从进度存档自动接回 → 告诉家长一声 */
if(Store.__restored){
  setTimeout(()=>toastMsg(`📂 已自动恢复进化进度（${Store.__restored.evolved} 只宝可梦）`), 900);
  Store.__restored=null;
}

/* ---------- 开始一次学习会话 ----------
 * 每套题固定 10 道：新题排前面，上一节课的错题复习垫底（答对也加能量）。
 * 「More questions」必须真的换一批新题：生成后跟上一套对比内容签名，
 * 撞了（题库小、随机恰好一样）就重摇，最多 8 次。 */
const QUESTIONS_PER_SET=10;
const _lastSetSig={};          // lessonId -> 上一套题的内容签名
function setSignature(items){
  return items.map(it=>{
    const q=it.q||{};
    if(q.type==='passage') return 'P:'+(q.title||'')+'|'+(q.text||'');
    return [q.prompt||'', q.sub||'', q.answer||''].join('~');
  }).join('||');
}
/* 阅读理解的生成选项：已答对的题（不再出现）+ 当前级别（文章逐渐变长） */
function readOpts(){
  const doneIds = Store.readDoneIds();
  return { doneIds, level: (typeof readLevelFor==='function' ? readLevelFor(doneIds.length) : 1) };
}
function makeFresh(lesson, lessonId, slots, opts){
  let best=null, bestSig='';
  for(let i=0;i<8;i++){
    const raw=(lesson.make ? (lesson.make(slots, opts)||[]) : []);
    const items=raw.slice(0, slots).map(q=>({q, isReview:false}));
    const sig=setSignature(items);
    best=items; bestSig=sig;
    if(sig !== _lastSetSig[lessonId]) break;   // 和上一套不同 → 就用它
  }
  _lastSetSig[lessonId]=bestSig;
  return best || [];
}
function beginSession(subject,lessonId){
  const mistakes=Store.lastSessionMistakes();
  Store.rotateSession();

  const lesson=CURRICULUM[subject].lessons.find(l=>l.id===lessonId);
  // 阅读理解要按"已答对的题"过滤 + 按级别选文章（越读越长）
  const opts = readOpts();
  const slots=Math.max(0, QUESTIONS_PER_SET-mistakes.length);
  const useEngine = (typeof QEngine!=='undefined' && QEngine.freshQuestions);
  const build=(n)=> useEngine
    ? QEngine.freshQuestions(lesson, lessonId, n, opts).items
    : makeFresh(lesson, lessonId, n, opts);
  let fresh=build(slots);
  // 阅读这类"整篇短文"放不满剩余名额时，干脆全部用新题（复习题下次再复习）
  if(fresh.length + mistakes.length < QUESTIONS_PER_SET){
    fresh=build(QUESTIONS_PER_SET);
  }
  // 新题在前，复习题垫底：点「More questions」第一眼看到的永远是新鲜题。
  // 新题放不满（比如阅读要整篇放，剩余名额不够一篇）时用复习题补足到 10。
  const pool=mistakes.map(m=>({q:m.q,ref:m,isReview:true}));
  const review=pool.slice(0, Math.max(0, QUESTIONS_PER_SET-fresh.length));
  state.questions=[...fresh,...review];
  state.idx=0; state.correct=0;
  state.total=state.questions.length;
  state.subject=subject; state.lessonId=lessonId; state.reviewDone=false;
  state.mistakeReviewSession=false;   // 正常上课：反馈按钮用标准文案，不显示「下一道」
  state.animQueue=[];          // 本套题里发生的进化/退化/死亡动画，在题目切换时播放
  state.delta=0;               // 本套题净能量变化，用于结果页展示
  cancelSpeech();              // 上一节课的讲解/读题一律停掉
  state.pendingExplain=false;
  state.explainToken=(state.explainToken||0)+1;

  updateCompanion();
  show('screen-lesson');
  renderQuestion();
}

/* ---------- 顶部伙伴徽章 ---------- */
function updateCompanion(){
  const info=Store.stageInfo(state.selectedPokemon);
  const st=info.form;
  const badge=$('#companionBadge');
  const energyTxt = info.dead ? '💤 昏睡了' : (info.maxed?'MAX':`⚡${Math.round(info.intoStage)}/${info.need}`);
  badge.innerHTML=`${pokeImgTag(st,'badge-img'+(info.dead?' img-dead':''))}<span class="cname">${st.name}${info.dead?' 💤':''}</span>
    <span class="mini-energy">Lv${info.stage+1} ${energyTxt}</span>`;
  bindPokeImages(badge);
}

/* ---------- 语音输入：切题时必须先停掉上一题的麦克风 ---------- */
let _stopSpeechInput=null;
function stopSpeechInput(){
  if(_stopSpeechInput){ try{ _stopSpeechInput(); }catch(e){} _stopSpeechInput=null; }
}

/* v65 Sight Words 选项标签：英文 + 中文释义，仅用于「看」，不参与判题。
   判题/语音/去重全部依赖 data-v 与 answer 里的英文原词，因此只在这里改显示文本，
   data-v 仍写 o。只有 e-sight 课才翻译，其它题型像素级不变。
   v68：题库扩容会派生 books/walking/unhappy 等词形，先查原词再回溯词根。 */
function sightZh(word){
  if(typeof EN_ZH==='undefined') return null;
  const s=String(word).toLowerCase();
  if(EN_ZH[s]) return EN_ZH[s];
  // 按派生规则还原词根（question-bank.js extraWords 用的是 s/ing/ed/er/un/y）
  const stems=[];
  if(/ies$/.test(s)) stems.push(s.slice(0,-3)+'y');          // countries → country
  if(/es$/.test(s))  stems.push(s.slice(0,-2), s.slice(0,-1));// boxes → box, watches → watch
  if(/s$/.test(s))   stems.push(s.slice(0,-1));              // books → book
  if(/ing$/.test(s)) stems.push(s.slice(0,-3), s.slice(0,-2));// walking → walk, making → make
  if(/ed$/.test(s))  stems.push(s.slice(0,-2), s.slice(0,-1));// wanted → want, liked → like
  if(/er$/.test(s))  stems.push(s.slice(0,-2), s.slice(0,-1));// teacher → teach, bigger → big
  if(/^un/.test(s))  stems.push(s.slice(2));                 // unhappy → happy
  if(/y$/.test(s))   stems.push(s.slice(0,-1));              // rainy → rain
  for(const st of stems){ if(EN_ZH[st]) return EN_ZH[st]; }
  return null;
}
function sightLabel(o){
  if(state.lessonId!=='e-sight') return o;
  const zh=sightZh(o);
  return zh ? `${o} <span class="opt-zh">${zh}</span>` : o;
}

/* ---------- 渲染题目 ---------- */
function renderQuestion(){
  stopSpeechInput();
  cancelSpeech();                // 掐掉上一题残留的讲解/读题声音与回调
  ++_autoSpeakToken;             // 作废上一题尚未触发的自动播报定时器
  state.pendingExplain=false;    // 讲解已结束（或被打断），不再等它切题
  state.explainToken=(state.explainToken||0)+1;
  hideKeyboard();               // 切到下一题先把屏幕键盘收起，非打字题不会残留
  const item=state.questions[state.idx];
  const q=item.q;
  // 出现过的题记入存档，之后组题时直接跳过（做错的题仍会走错题本复习）
  if(!item.isReview && typeof QEngine!=='undefined' && QEngine.markShown(q)){
    Store.save();
  }
  $('#reviewTag').classList.toggle('hidden', !item.isReview);
  const pct=Math.round((state.idx)/state.total*100);
  $('#progressFill').style.width=pct+'%';
  $('#progressText').textContent=`${state.idx+1} / ${state.total}`;
  $('#feedback').className='feedback hidden';

  const area=$('#questionArea');
  // 复习题里的阅读题（以及被截断到名额里的阅读题）：把对应短文一起显示出来，
  // 否则只剩一道题没法回答
  let passageRef=null;
  if(q.type!=='passage' && q.sub && (q.needPassage || item.isReview) && typeof READ_PASSAGES!=='undefined'){
    passageRef=READ_PASSAGES.find(p=>p.qs.some(x=>x.q===q.sub)) || null;
  }
  let h = passageRef
    ? `<div class="passage-card passage-mini"><div class="passage-title">📖 ${passageRef.title}</div>
       <div class="passage-text">${passageRef.text}</div></div>`
    : '';
  // 阅读短文题没有 prompt 字段，别渲染出 "undefined"
  h += (q.type==='passage' || !q.prompt) ? '' : `<div class="q-prompt">${q.prompt}</div>`;
  if(q.sub && q.type!=='passage') h+=`<div class="q-sub">${q.sub}</div>`;
  if(q.visual) h+=`<div class="q-visual">${q.visual}</div>`;

  if(q.type==='passage'){
    h+=`<div class="passage-card"><div class="passage-title">📖 ${q.title}</div>
        <div class="passage-text">${q.text}</div></div>`;
    if(q.speak) h+=`<button class="speak-btn" id="speakBtn">🔊 Read to me</button>`;
    h+=`<button class="btn-primary" id="passageNext">I read it! ➡️</button>`;
  } else if(q.speak && q.type!=='speak'){
    h+=`<button class="speak-btn" id="speakBtn">🔊 Listen</button>`;
    // 拼写题额外给一个「慢速 + 重复」按钮，初学者听得更准
    if(q.type==='type' && clipFor(q.speak.text+'::slow'))
      h+=`<button class="speak-btn" id="slowBtn">🐢 Slow &amp; repeat</button>`;
  }

  if(q.type==='choice'){
    h+=`<div class="option-grid ${q.tone?'tone-grid':''}" id="optGrid">`;
    q.options.forEach((o,i)=>{
      const label = q.tone && q.optionMarks
        ? `<span class="tone-mark">${q.optionMarks[i]}</span><span class="tone-name">${o}</span>` : sightLabel(o);
      h+=`<button class="option-btn" data-v="${o}">${label}</button>`;
    });
    h+=`</div>`;
    if(q.canSpeak && Store.getSetting('mic'))
      h+=`<button class="btn-link" id="speakModeBtn">🎤 我来读（读出${zhKindLabel(q.kind)}，读对才过关）</button>`;
  } else if(q.type==='type'){
    h+=`<div class="type-area">
      ${q.hint?`<div class="type-hint">💡 ${q.hint}</div>`:''}
      <input class="type-input" id="typeInput" inputmode="text" autocomplete="off"
             enterkeyhint="done" autocapitalize="off" autocorrect="off" spellcheck="false" />
      <div class="type-actions">
        <button class="check-btn" id="checkBtn">Check ✓</button>
        <button class="kb-toggle" id="kbToggleBtn" type="button">⌨️ 收起键盘</button>
      </div>
      <div class="type-tip">按 Enter / 回车 也能提交 ⏎</div>
    </div>`;
  } else if(q.type==='build'){
    h+=`<div class="build-answer" id="buildAnswer"></div>
      <div class="build-pool" id="buildPool"></div>`;
  } else if(q.type==='speak'){
    h+=`<div class="speak-card">
      <div class="speak-hint">${q.hint||'大声读出来吧！'}</div>
      <div class="speak-actions">
        <button class="btn-secondary" id="demoBtn">🔊 听示范</button>
        <button class="btn-primary" id="micBtn">🎤 我来读</button>
      </div>
      <div class="mic-status" id="micStatus">读对了才过关哦 ⭐</div>
      <div class="replay-box hidden" id="replayBox"></div>
      <button class="btn-link" id="choiceModeBtn">🎧 改回「听音选一选」（推荐）</button>
    </div>`;
  }
  area.innerHTML=h;

  if(q.type==='passage'){
    $('#passageNext').onclick=()=>nextQuestion();
    if(q.speak) $('#speakBtn').onclick=()=>playSpeak(q.speak);
    if(q.speak) autoSpeak(q,true);          // 短文卡进题即朗读（原行为）
  } else if(q.type==='speak'){
    $('#demoBtn').onclick=()=>playSpeak(q.speak);
  } else if(q.speak){
    $('#speakBtn').onclick=()=>playSpeak(q.speak);
    const slowBtn=$('#slowBtn');
    if(slowBtn) slowBtn.onclick=()=>{
      const s=Object.assign({}, q.speak, {slow:true});
      playSpeak(s, ()=>setTimeout(()=>playSpeak(s), 400));
    };
    // 中文拼读题走独立开关；语法 / 句子建构题带 forceAuto，进题必读
    autoSpeak(q);
  }

  if(q.type==='choice'){
    bindChoice(q,item);
    const sm=$('#speakModeBtn');
    if(sm) sm.onclick=()=>showSpeakMode(q,item);
  }
  else if(q.type==='type') bindType(q,item);
  else if(q.type==='build') bindBuild(q,item);
  else if(q.type==='speak') bindSpeak(q,item);
}

/* ---------- 选择题 ---------- */
function bindChoice(q,item){
  let answered=false;
  $$('#optGrid .option-btn').forEach(btn=>{
    btn.onclick=()=>{
      if(answered) return; answered=true;
      // 一旦作答就锁定模式，避免和自动跳下一题的定时器打架
      const sm=$('#speakModeBtn'); if(sm) sm.disabled=true;
      const val=btn.dataset.v;
      const correct = val===q.answer;
      $$('#optGrid .option-btn').forEach(b=>{
        b.disabled=true;
        if(b.dataset.v===q.answer) b.classList.add('correct');
      });
      if(correct){
        btn.classList.add('correct'); state.correct++; onCorrect(item);
        sfx('good');
        // 语法题答对后要念完整句 / 发音辨析题要读解题思路，
        // 留足时间再切下一题，避免语音或中文讲解被下一题的自动读题打断
        showFeedback(true,q.explain,true,null,false,
          q.feedbackDelay || (q.answerSpeak?3000:950));
      }else{
        btn.classList.add('wrong');
        sfx('bad');
        showFeedback(false, q.explain, false, ()=>recordWrong(item,val,q));
      }
    };
  });
}

/* ---------- 认读课的两种模式：默认听音选一选，「我来读」是备用入口 ----------
 * 同一道题可在两种模式间来回切换，共用 target / speak / explain，
 * 切换不重开题目、不改进度、不重复计分；旧存档里的 speak 错题也能自动降级。
 */
function zhKindLabel(kind){
  return kind==='initial' ? '声母' : kind==='final' ? '韵母' : '整体认读音节';
}
function zhKindPool(kind){
  if(kind==='initial') return ZH_INITIALS;
  if(kind==='whole')   return ZH_WHOLES;
  return ZH_FINALS;
}
function asChoice(q){
  if(q.type==='choice') return Object.assign({},q,{canSpeak:true});
  return Object.assign({},q,{
    type:'choice', canSpeak:true,
    prompt:`🔊 听一听，选出这个${zhKindLabel(q.kind)}`,
    sub:'点 🔊 可以再听一次，然后选出正确的拼音',
    options:q.options||q.fallbackOptions||[], answer:q.target
  });
}
function asSpeak(q){
  if(q.type==='speak') return q;
  return Object.assign({},q,{
    type:'speak',
    prompt:`读出这个${zhKindLabel(q.kind)} 🎤`,
    sub:`<span class="phonic-big">${q.target}</span>`,
    hint:q.hint||'先点 🔊 听一听，再对着 🎤 大声读出来',
    fallbackOptions:q.options||q.fallbackOptions||[]
  });
}
function choiceCardHTML(cq){
  let h=`<div class="q-prompt">${cq.prompt}</div><div class="q-sub">${cq.sub}</div>`;
  if(cq.speak) h+=`<button class="speak-btn" id="speakBtn">🔊 Listen</button>`;
  h+=`<div class="option-grid ${cq.tone?'tone-grid':''}" id="optGrid">`+
     cq.options.map((o,i)=>{
       const label=(cq.tone && cq.optionMarks)
         ? `<span class="tone-mark">${cq.optionMarks[i]}</span><span class="tone-name">${o}</span>` : sightLabel(o);
       return `<button class="option-btn" data-v="${o}">${label}</button>`;
     }).join('')+`</div>`;
  if(cq.canSpeak && Store.getSetting('mic'))
    h+=`<button class="btn-link" id="speakModeBtn">🎤 我来读（读出${zhKindLabel(cq.kind)}，读对才过关）</button>`;
  return h;
}
function speakCardHTML(sq){
  return `<div class="q-prompt">${sq.prompt}</div>
    <div class="q-sub">${sq.sub}</div>
    <div class="speak-card">
      <div class="speak-hint">${sq.hint||'大声读出来吧！'}</div>
      <div class="speak-actions">
        <button class="btn-secondary" id="demoBtn">🔊 听示范</button>
        <button class="btn-primary" id="micBtn">🎤 我来读</button>
      </div>
      <div class="mic-status" id="micStatus">读对了才过关哦 ⭐</div>
      <div class="replay-box hidden" id="replayBox"></div>
      <button class="btn-link" id="choiceModeBtn">🎧 改回「听音选一选」（推荐）</button>
    </div>`;
}
function clearFeedback(){
  const fb=$('#feedback'); fb.className='feedback hidden'; fb.innerHTML='';
}
function showChoiceMode(q,item,replay){
  stopSpeechInput(); clearFeedback();
  const cq=asChoice(q);
  $('#questionArea').innerHTML=choiceCardHTML(cq);
  const sb=$('#speakBtn'); if(sb) sb.onclick=()=>playSpeak(cq.speak);
  const sm=$('#speakModeBtn'); if(sm) sm.onclick=()=>showSpeakMode(cq,item);
  bindChoice(cq,item);
  if(replay!==false && cq.speak) setTimeout(()=>playSpeak(cq.speak), 300);
}
function showSpeakMode(q,item){
  stopSpeechInput(); clearFeedback();
  const sq=asSpeak(q);
  $('#questionArea').innerHTML=speakCardHTML(sq);
  const db=$('#demoBtn'); if(db) db.onclick=()=>playSpeak(sq.speak);
  bindSpeak(sq,item);
}

/* ---------- 语音跟读题（声母 / 韵母认读，作为备用模式） ----------
 * 三条路径按设备能力自动切换，保证孩子不会被卡住：
 *  A 浏览器语音识别可用 → 真正判音，读对才过关（HTTPS + 联网，Chrome 系）
 *  B 识别不可用但能录音 → 录音回放 + 家长确认（iPad Safari 常见）
 *  C 完全不支持 / 家长关闭 → 听音选一选（默认模式，离线可用）
 * 匹配逻辑见 js/zh-phonics.js 的 zhJudge（同音字白名单）。
 */
const SR_CLASS = window.SpeechRecognition || window.webkitSpeechRecognition;

function bindSpeak(q,item){
  const status=$('#micStatus'), micBtn=$('#micBtn');
  const pool=zhKindPool(q.kind);
  const target=pool.find(x=>x.p===q.target) || pool[0];
  let done=false, tries=0, silent=0, useRecorder=!SR_CLASS;
  let rec=null, recorder=null, stream=null, replayUrl=null;

  function setStatus(msg,cls){ status.textContent=msg; status.className='mic-status '+(cls||''); }
  function highlightFallback(){
    const b=$('#choiceModeBtn'); if(!b) return;
    b.classList.add('primary');
    b.textContent='🎧 改回「听音选一选」（推荐）';
  }
  function cleanup(){
    if(rec){ try{ rec.onresult=null; rec.onend=null; rec.onerror=null; rec.abort(); }catch(e){} rec=null; }
    if(recorder){ try{ recorder.onstop=null; if(recorder.state==='recording') recorder.stop(); }catch(e){} recorder=null; }
    if(stream){ try{ stream.getTracks().forEach(t=>t.stop()); }catch(e){} stream=null; }
    if(replayUrl){ try{ URL.revokeObjectURL(replayUrl); }catch(e){} replayUrl=null; }
    if(micBtn) micBtn.disabled=false;
  }
  _stopSpeechInput=cleanup;

  function pass(){
    if(done) return; done=true;
    cleanup(); _stopSpeechInput=null;
    const buddy=(Store.stageInfo(state.selectedPokemon)||{}).form;
    setStatus(`🎉 读对啦！${buddy?buddy.name+' 为你欢呼！':'太棒了！'}`,'ok');
    state.correct++; onCorrect(item); sfx('good');
    // 即时鼓励：不等到课程结束，读对这一刻就让所选宝可梦叫一声
    setTimeout(()=>pokeCry(state.selectedPokemon), 170);
    showFeedback(true, q.explain, true, null, false,
      (item.q && item.q.answerSpeak) ? 3000 : 1500);  // 有完整句播报时多留时间
  }
  function retry(msg){
    tries++; setStatus(msg,'bad');
    if(tries>=3) highlightFallback();
  }

  /* C：切回默认模式「听音选一选」 */
  function switchToChoice(){
    if(done) return;
    cleanup(); _stopSpeechInput=null;
    showChoiceMode(q,item,true);
  }

  /* A：语音识别判音 */
  function startRecognition(){
    if(done) return;
    let got=false;
    try{
      rec=new SR_CLASS();
      rec.lang='zh-CN'; rec.continuous=false;
      rec.interimResults=false; rec.maxAlternatives=5;
      rec.onstart=()=>setStatus('🎧 我在听… 大声读出来！','listening');
      rec.onresult=e=>{
        got=true; silent=0;
        const alts=[];
        for(let i=e.resultIndex||0;i<e.results.length;i++){
          const r=e.results[i];
          for(let j=0;j<r.length;j++) alts.push(r[j].transcript);
        }
        const v=zhJudge(alts,target,pool);
        if(v.ok){ pass(); return; }
        retry(v.wrong ? `听到「${v.heard}」，再读一次～` : `没听清（${v.heard}），再读一次～`);
      };
      rec.onerror=e=>{
        got=true;
        const k=e.error||'';
        if(k==='not-allowed'||k==='service-not-allowed'){
          setStatus('🎙️ 麦克风没开：请家长允许后重试，或改回「听音选一选」','bad'); highlightFallback();
        }else if(k==='network'){
          setStatus('🌐 语音识别需要联网，可改回「听音选一选」','bad'); highlightFallback();
        }else if(k!=='aborted'){ retry('没听清，再读一次～'); }
      };
      rec.onend=()=>{
        rec=null;
        if(micBtn){ micBtn.disabled=false; micBtn.textContent='🎤 我再读一次'; }
        if(done) return;
        if(!got){
          silent++;
          if(silent>=2){
            useRecorder=true;
            setStatus('这台设备的语音识别不可用，已切换「录音回放 + 家长确认」','bad');
            if(micBtn) micBtn.textContent='🎤 我来读（录音）';
            highlightFallback();
          }else setStatus('没有收到声音，再试一次～','bad');
        }
      };
      rec.start();
      if(micBtn){ micBtn.disabled=true; micBtn.textContent='🎧 正在听…'; }
    }catch(err){
      rec=null; useRecorder=true;
      setStatus('语音识别启动失败，改用录音回放','bad');
      startRecorder();
    }
  }

  /* B：录音回放 + 家长确认 */
  async function startRecorder(){
    if(done) return;
    const md=navigator.mediaDevices;
    if(!md || !md.getUserMedia || !window.MediaRecorder){
      setStatus('这台设备不能录音，请改回「听音选一选」','bad'); highlightFallback(); return;
    }
    try{
      stream=await md.getUserMedia({audio:true});
      recorder=new MediaRecorder(stream);
      const chunks=[];
      recorder.ondataavailable=e=>{ if(e.data && e.data.size) chunks.push(e.data); };
      recorder.onstop=()=>{
        try{ stream && stream.getTracks().forEach(t=>t.stop()); }catch(e){}
        stream=null; recorder=null;
        if(micBtn){ micBtn.disabled=false; micBtn.textContent='🎤 再读一次'; }
        if(done) return;
        if(!chunks.length){ setStatus('没录到声音，再读一次～','bad'); return; }
        const blob=new Blob(chunks,{type:'audio/webm'});
        if(replayUrl) URL.revokeObjectURL(replayUrl);
        replayUrl=URL.createObjectURL(blob);
        setStatus('🔊 听听自己读的，再请家长确认 ✓','ok');
        const box=$('#replayBox'); if(!box) return;
        box.classList.remove('hidden');
        box.innerHTML=`<button class="btn-secondary" id="replayBtn">▶️ 回放我的声音</button>
          <button class="btn-primary" id="parentOkBtn">✅ 家长确认：读对了</button>`;
        $('#replayBtn').onclick=()=>{ const a=new Audio(replayUrl); a.play().catch(()=>{}); };
        $('#parentOkBtn').onclick=()=>pass();
      };
      recorder.start();
      setStatus('🎙️ 录音中… 现在大声读（约 2 秒）','listening');
      if(micBtn){ micBtn.disabled=true; micBtn.textContent='🎙️ 录音中…'; }
      setTimeout(()=>{ try{ if(recorder && recorder.state==='recording') recorder.stop(); }catch(e){} }, 2200);
    }catch(err){
      setStatus('麦克风打不开：请家长检查权限，或改回「听音选一选」','bad');
      highlightFallback();
      if(micBtn) micBtn.disabled=false;
    }
  }

  /* 家长端关掉了麦克风 → 直接走 C */
  if(!Store.getSetting('mic')){ switchToChoice(); return; }
  if(useRecorder){
    setStatus('这台设备用「录音回放 + 家长确认」','');
    if(micBtn) micBtn.textContent='🎤 我来读（录音）';
  }
  micBtn.onclick=()=> useRecorder ? startRecorder() : startRecognition();
  $('#choiceModeBtn').onclick=()=>switchToChoice();
}

/* ---------- 打字题 ---------- */
/* 答案归一化：忽略大小写、句点、多余空格，短答可配多个可接受写法 */
function normAnswer(s){
  return String(s||'').toLowerCase().trim()
    .replace(/[.,!?;:'"’“”]/g,'').replace(/\s+/g,' ');
}
function bindType(q,item){
  const input=$('#typeInput');
  buildKeyboard(input);
  // 触屏设备不自动聚焦，避免 iPad 同时弹出「系统软键盘 + 屏幕键盘」两层
  const coarse = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
  const focusInput=()=>{ try{ input.focus({preventScroll:true}); }catch(e){ input.focus(); } };
  if(!coarse) focusInput();

  const submit=()=>{
    const b=$('#checkBtn');
    if(b && !b.disabled && input.value.trim()) b.click();
  };
  /* 回车 / Enter（含外接键盘与系统软键盘的 Done）提交 Check。
     isComposing / keyCode 229 是输入法组字状态，避免拼音选字时误提交。 */
  input.addEventListener('keydown', e=>{
    if(e.isComposing || e.keyCode===229) return;
    if(e.key==='Enter' || e.keyCode===13){ e.preventDefault(); submit(); }
  });
  /* 题目区也有一个收起 / 展开开关，键盘挡住 Check 时随时可收起 */
  const toggle=$('#kbToggleBtn');
  if(toggle) toggle.onclick=()=>{
    const kb=$('#keyboard');
    if(kb.classList.contains('hidden')){ buildKeyboard(input); if(!coarse) focusInput(); }
    else { hideKeyboard(); input.blur(); }
    updateKbToggle();
  };

  $('#checkBtn').onclick=()=>{
    const val=input.value.trim();
    if(!val) return;
    const pool=(q.accept&&q.accept.length?q.accept:[q.answer]).map(normAnswer);
    const correct = pool.includes(normAnswer(val));
    if(correct){
      state.correct++; onCorrect(item);
      sfx('good');
      $('#checkBtn').disabled=true; input.disabled=true; hideKeyboard();
      showFeedback(true,q.explain,true);
    }else{
      sfx('bad');
      input.disabled=true; hideKeyboard();
      const lead=q.short?'Answer':'Spell it';
      showFeedback(false,`${lead}: ${q.answer}`,false,()=>recordWrong(item,val,q));
    }
  };
}

/* ---------- 句子建构题 ---------- */
/* 用下标跟踪所选词块：句子里出现重复单词（如两个 the）时不会互相干扰 */
function bindBuild(q,item){
  const pool=$('#buildPool'); const answer=$('#buildAnswer');
  let chosen=[];   // 存 q.tiles 的下标
  const render=()=>{
    const used=new Set(chosen);
    pool.innerHTML='';
    q.tiles.forEach((t,i)=>{
      if(used.has(i)) return;
      const b=document.createElement('button'); b.className='tile'; b.textContent=t;
      b.onclick=()=>{ chosen.push(i); render(); };
      pool.appendChild(b);
    });
    answer.innerHTML='';
    chosen.forEach((idx,pos)=>{
      const b=document.createElement('button'); b.className='tile'; b.textContent=q.tiles[idx];
      b.onclick=()=>{ chosen.splice(pos,1); render(); };
      answer.appendChild(b);
    });
    if(!answer.querySelector('.check-build')){
      const c=document.createElement('button'); c.className='check-btn check-build'; c.textContent='Check ✓';
      c.onclick=()=>{
        const joined=chosen.map(i=>q.tiles[i]).join(' ');
        const correct = joined===q.answer;
        if(correct){
          state.correct++; onCorrect(item); c.disabled=true;
          sfx('good');
          // 拼对后把完整句子读给孩子听，读完再进下一题（不打断朗读）
          const said=q.speak?q.speak.text:joined.replace(/ \./g,'.');
          showFeedback(true,`✅ ${said}`,false);
          let moved=false, guard=null;
          const go=()=>{ if(moved) return; moved=true; if(guard) clearTimeout(guard); nextQuestion(); };
          guard=setTimeout(go, 4200);                    // 音频缺失/被拦截时的兜底
          if(q.speak) playSpeak(q.speak, ()=>setTimeout(go, 350));
          else setTimeout(go, 1600);
        }else{
          sfx('bad');
          showFeedback(false,'Try the right order again~',false,()=>recordWrong(item,joined,q),true);
        }
      };
      answer.appendChild(c);
    }
  };
  render();
}

/* ---------- 屏幕键盘 ---------- */
let kbInput=null;
function buildKeyboard(input){
  kbInput=input;
  const kb=$('#keyboard'); kb.innerHTML=''; kb.classList.remove('hidden');
  document.body.classList.add('kb-open');   // 给题目区留出底部空间，Check 不会被盖住
  /* 顶部工具条：随时收起键盘 + 回车提交；键盘展开时这两个键永远可见 */
  const bar=document.createElement('div'); bar.className='kb-bar';
  const done=document.createElement('button');
  done.className='key kb-done'; done.type='button'; done.textContent='⌨️ 收起键盘';
  done.onclick=()=>{ hideKeyboard(); if(input) input.blur(); updateKbToggle(); };
  const enter=document.createElement('button');
  enter.className='key kb-enter'; enter.type='button'; enter.textContent='⏎ 提交 Check';
  enter.onclick=()=>{
    const b=$('#checkBtn');
    if(b && !b.disabled && input && input.value.trim()) b.click();
  };
  bar.appendChild(done); bar.appendChild(enter); kb.appendChild(bar);

  const rows=['qwertyuiop','asdfghjkl','zxcvbnm'];
  rows.forEach(r=>{
    r.split('').forEach(ch=>{
      const k=document.createElement('button'); k.className='key'; k.textContent=ch;
      k.onclick=()=>{ input.value+=ch; };
      kb.appendChild(k);
    });
    kb.appendChild(spacer());
  });
  const bk=document.createElement('button'); bk.className='key wide'; bk.textContent='⌫';
  bk.onclick=()=>{ input.value=input.value.slice(0,-1); };
  kb.appendChild(bk);
  const cl=document.createElement('button'); cl.className='key wide'; cl.textContent='Clear';
  cl.onclick=()=>{ input.value=''; };
  kb.appendChild(cl);
  function spacer(){ const s=document.createElement('div'); s.style.width='100%'; s.style.height='1px'; return s; }
  updateKbToggle();
}
function hideKeyboard(){
  const kb=$('#keyboard'); if(kb) kb.classList.add('hidden');
  document.body.classList.remove('kb-open');
  updateKbToggle();
}
/* 题目区的开关按钮状态：展开 / 收起 / 本题已作答则隐藏 */
function updateKbToggle(){
  const b=$('#kbToggleBtn'); if(!b) return;
  const kb=$('#keyboard');
  const open=!!(kb && !kb.classList.contains('hidden'));
  b.classList.toggle('hidden', !!(kbInput && kbInput.disabled));
  b.textContent = open ? '⌨️ 收起键盘' : '⌨️ 打开键盘';
  b.setAttribute('aria-expanded', open?'true':'false');
}
/* 外接键盘的 Enter：焦点不在输入框（例如刚点过屏幕键盘的字母）时也能提交 */
document.addEventListener('keydown', e=>{
  if(e.key!=='Enter' || e.isComposing || e.keyCode===229) return;
  const it=state.questions && state.questions[state.idx];
  if(!it || !it.q || it.q.type!=='type') return;
  const input=$('#typeInput');
  if(!input || input.disabled || document.activeElement===input) return;
  const b=$('#checkBtn');
  if(b && !b.disabled && input.value.trim()){ e.preventDefault(); b.click(); }
});

/* 答对（含复习题）时处理错题本：复习题答对即从错题本移除 */
function onCorrect(item){
  if(item.isReview && item.ref) Store.removeMistake(item.ref);
  // 每答对一题累进一点难度（复习题不算，避免刷难度）
  if(!item.isReview && typeof QEngine!=='undefined') QEngine.markMastered(state.lessonId);
  // 阅读理解：答对过的题记进存档，以后组题时跳过（不会重复出现）
  const qid = item.q && item.q.qid;
  /* 只有阅读理解题（qid 形如 rp-xxx#1）进 readDone；v30 起所有题都有 qid，
     若不限定会把数学/中文题混进阅读进度里。其它题统一由 QEngine.qSeen 去重。 */
  if(qid && String(qid).indexOf('#')>0 && Store.markReadDone(qid)
     && !item.isReview && state.lessonId==='e-read'){
    const st = readStats(Store.readDoneIds());
    if(st.done===st.total) toastMsg('🏆 所有阅读题都答对啦！每周一还会上新 5 篇');
  }
  awardEnergy(ENERGY_PER_ANSWER);
  /* 语法题 / 数学题答对后自动播报完整句或解题思路（晚于答对音效，避免被盖住）。
     关键：讲解读完才允许切下一题。以前用固定 3 秒定时器，遇到长句会和下一题
     的自动读题叠在一起，孩子只能听到两团糊在一起的声音。
     句子建构题（build）自己有「读完再切题」的流程，不要再插一段。 */
  const full = item && item.q && item.q.answerSpeak;
  if(full && item.q.type!=='build'){
    const my=(state.explainToken=(state.explainToken||0)+1);
    state.pendingExplain=true;
    /* 超时保险：音频彻底加载失败/浏览器吞掉 onend 时也要往前走，不能卡死在反馈页 */
    const guard=setTimeout(()=>{
      if(my!==state.explainToken || !state.pendingExplain) return;
      state.pendingExplain=false; nextQuestion();
    }, 16000);
    setTimeout(()=>{
      if(my!==state.explainToken) return;
      playSpeak(full, ()=>{
        clearTimeout(guard);
        if(my!==state.explainToken || !state.pendingExplain) return;
        state.pendingExplain=false;
        nextQuestion();
      });
    }, 260);
  }
}
/* 每道题的能量结算：答对 +2 / 答错 −2。
 * 进化/退化/死亡动画先排进队列，在切题（或课程结束）时播放，不打断答题节奏。 */
function awardEnergy(delta){
  const id=state.selectedPokemon; if(!id) return;
  const res=Store.addEnergy(id,delta);
  state.delta=(state.delta||0)+delta;
  state.animQueue=state.animQueue||[];
  if(res.evolved)  state.animQueue.push({type:'evolve', to:res.to});
  if(res.devolved) state.animQueue.push({type:'devolve', from:res.from, to:res.to});
  if(res.died)     state.animQueue.push({type:'die'});
  if(res.evolved||res.devolved||res.died) updateCompanion();
}

/* ---------- 反馈 & 流程 ---------- */
function showFeedback(good,explain,autoNext,onWrong,stay,delay){
  const fb=$('#feedback');
  fb.className='feedback '+(good?'good':'bad');
  fb.innerHTML = (good?'🎉 Awesome!':'💡 Try again') + (explain?`<br><span style="font-size:15px">${explain}</span>`:'');
  if(good && autoNext){
    /* 有解题思路语音时由 onCorrect 的 onend 负责切题，这里不能再开定时器 */
    if(!state.pendingExplain) setTimeout(nextQuestion, delay||950);
  }else if(!good){
    const btn=document.createElement('button');
    btn.className='btn-secondary'; btn.style.marginTop='10px';
    // 错题复习：答错后按钮明确写「下一道」，点了直接进队列下一题，不用退出重进
    btn.textContent= state.mistakeReviewSession ? '下一道 ➡️' : (stay?'Keep going':'Continue ➡️');
    btn.onclick=()=>{ if(onWrong) onWrong(); nextQuestion(); };
    fb.appendChild(document.createElement('br'));
    fb.appendChild(btn);
  }
}

function recordWrong(item,userAnswer,q){
  awardEnergy(-ENERGY_PER_ANSWER);
  if(item.isReview){
    // 复习题答错：保留错题（不动）
  }else{
    Store.addMistake(state.subject,state.lessonId,q,userAnswer);
  }
}

function nextQuestion(){
  state.idx++;
  if(state.idx>=state.total){ finishLesson(); return; }
  // 答题过程中攒下的进化/退化/死亡动画：切题前先播完
  if(state.animQueue && state.animQueue.length){
    const ev=state.animQueue.shift();
    const go=()=>renderQuestion();
    if(ev.type==='evolve') showEvolveFx(state.selectedPokemon, ev.to, go);
    else showDefeatFx(state.selectedPokemon, ev.type, go);
    return;
  }
  renderQuestion();
}

/* ---------- 结束课程 ----------
 * 流程：先放本套题里攒下的进化/退化/死亡动画（通常已在切题时播完），
 * 全对的话播放宝可梦释放技能动画，最后进入结果页。 */
function finishLesson(){
  cancelSpeech();
  state.pendingExplain=false;
  state.explainToken=(state.explainToken||0)+1;
  const id=state.selectedPokemon;
  Store.markLesson(state.subject,state.lessonId);
  const graded=state.questions.filter(x=>x.q.type!=='passage').length;
  Store.recordAttempt(state.subject, state.correct, graded);
  updateCompanion();
  flashSaved();
  const steps=[];
  (state.animQueue||[]).forEach(ev=>{
    steps.push(cb=>{
      if(ev.type==='evolve') showEvolveFx(id, ev.to, cb);
      else showDefeatFx(id, ev.type, cb);
    });
  });
  state.animQueue=[];
  const perfect = graded>0 && state.correct===graded;
  if(perfect) steps.push(cb=>showSkillFx(id, cb));
  const run=()=>{ const next=steps.shift(); if(next) next(run); else showResult(); };
  run();
}

/* 分支进化：伊布 8 种、臭臭花 2 种、奇鲁莉安 2 种 */
function showBranchPicker(id, stage, done){
  const pk=POKEMON.find(p=>p.id===id);
  const opts=branchOptions(pk,stage);
  const multi = opts.length>3;
  $('#branchHint').innerHTML = multi
    ? `${pk.cn} 可以变成 <b>${opts.length} 种</b>不同的样子！选一个吧 ✨<br>
       <span class="muted">选完也能在首页点头像看全家福、随时换另一种</span>`
    : `${pk.cn} 有 ${opts.length} 条进化路线，选一个吧！ ✨`;
  const box=$('#branchPicker'); box.innerHTML='';
  opts.forEach((f,idx)=>{
    const o=document.createElement('div');
    o.className='poke-opt'; o.dataset.idx=idx;
    o.innerHTML=`<div class="face">${pokeImgTag(f,'opt-img')}</div>
      <div class="nm">${f.name}</div><div class="cn">${f.cn}</div>
      ${f.evo?`<div class="stage">${f.evo}</div>`:''}`;
    o.onclick=()=>{
      $$('#branchPicker .poke-opt').forEach(x=>x.classList.remove('sel'));
      o.classList.add('sel');
      $('#confirmBranchBtn').disabled=false;
    };
    box.appendChild(o);
  });
  $('#confirmBranchBtn').disabled=true;
  $('#branchModal').classList.remove('hidden');
  bindPokeImages(box);
  $('#confirmBranchBtn').onclick=()=>{
    const sel=$('#branchPicker .poke-opt.sel'); if(!sel) return;
    Store.setBranch(id, Number(sel.dataset.idx));
    $('#branchModal').classList.add('hidden');
    updateCompanion();
    done();
  };
}

/* ---------- 全屏剧情动画（进化 / 被击败 / 技能） ----------
 * 共用一个 #fxOverlay；点击任意处可跳过。 */
const SFX_CLIP={ rocket:'audio/sfx/rocket_line.m4a' };   // 火箭队台词（gen_sfx.js 生成）
let _fxDone=null;
function fxShow(html,caption,cls,dur,onDone){
  const ov=$('#fxOverlay'), stg=$('#fxStage'), cap=$('#fxCaption');
  stg.className='fx-stage'; stg.style.cssText=''; stg.innerHTML=html; cap.innerHTML=caption;
  ov.classList.remove('hidden');
  ov.classList.remove('fx-evo','fx-defeat','fx-skill');
  ov.classList.add(cls);
  bindPokeImages(stg);
  let done=false;
  const finish=()=>{ if(done) return; done=true; _fxDone=null; ov.onclick=null;
    ov.classList.add('hidden'); ov.classList.remove('fx-evo','fx-defeat','fx-skill');
    stg.innerHTML=''; if(onDone) onDone(); };
  _fxDone=finish; ov.onclick=()=>finish();
  setTimeout(finish,dur);
}

/* 进化：白光闪烁 → 新形态登场。分支阶（伊布等）先选形态再播动画 */
function showEvolveFx(id, toStage, onDone){
  const pk=POKEMON.find(p=>p.id===id);
  const proceed=()=>{
    const info=Store.stageInfo(id);
    const st=info.form;
    const prev=formOf(pk, toStage-1, null);
    // 第一段：旧形态白光闪烁（点击可跳过 → 直接进第二段）
    fxShow(`<div class="fx-sprite fx-flash">${pokeImgTag(prev,'fx-img')}</div>`,
      `✨⚡ ✨⚡ ✨<br><span class="muted">什么在发光…</span>`,'fx-evo',1500,()=>{
        // 第二段：新形态诞生
        const stone = (pk && isSequentialChain(pk) && st.evo)
          ? `<br><span class="muted">🪨 ${st.evo}</span>` : '';
        fxShow(`<div class="fx-sprite fx-born">${pokeImgTag(st,'fx-img')}</div><div class="fx-burst">✨✨✨</div>`,
          `<b class="fx-title">${prev.name} → ${st.name}</b><br><span class="muted">${prev.cn} → ${st.cn}</span>${stone}`,
          'fx-evo',2600,onDone);
        sfx('evolveUp');
      });
    sfx('evolveCharge');
  };
  if(isBranchStage(pk, toStage) && Store.stageInfo(id).branch==null){
    showBranchPicker(id, toStage, proceed);   // 选完形态再播进化动画
  }else proceed();
}

/* 被击败：退化一阶 / 昏倒（死亡）→ 火箭队英文原版战败台词
   "Looks like Team Rocket's blasting off again!"（gen_sfx.js 高清英文配音） */
const TEAM_ROCKET_LINE = "Looks like Team Rocket's blasting off again!";
function showDefeatFx(id, type, onDone){
  const pk=POKEMON.find(p=>p.id===id);
  const info=Store.stageInfo(id);
  const st=info.form;
  const cap = (type==='die'
    ? `💀 <b class="fx-title">${st.name} fainted…</b><br><span class="muted">${st.cn} 昏倒了！明天再来选它，它会满血复活</span>`
    : `💥 <b class="fx-title">${st.name} was defeated!</b><br><span class="muted">${st.cn} 被击败，退化回第 ${info.stage+1} 阶（Lv${info.stage+1}）</span>`)
    + `<br><span class="muted">🚀 "${TEAM_ROCKET_LINE}"</span>`;
  fxShow(`<div class="fx-sprite fx-fall">${pokeImgTag(st,'fx-img')}</div><div class="fx-smoke">💨💨</div>`,
    cap,'fx-defeat',4300,onDone);
  sfx('defeat');
  setTimeout(()=>playClip(SFX_CLIP.rocket), 700);   // 先听击败音，再放火箭队台词
}

/* 全对奖励：宝可梦释放「专属绝招」（按官方设定的招式 + 属性特效） */
function showSkillFx(id, onDone){
  const info=Store.stageInfo(id);
  const st=info.form;
  const mv=(typeof MOVES!=='undefined') ? MOVES.moveFor(id) : {name:'Super Move',en:'Super Move',type:'normal',desc:'释放必杀技！'};
  const fx=(typeof MOVES!=='undefined') ? MOVES.fxFor(mv.type) : {c1:'#b9b0a0',c2:'#efe9df',particles:'⭐💥⭐',word:'SMASH!',sfx:'normal'};
  const style=`--fx-c1:${fx.c1};--fx-c2:${fx.c2};`;
  const beam=`<div class="fx-beam fx-beam-${mv.type}"></div>`;
  const particles=`<div class="fx-burst fx-burst-${mv.type}">${fx.particles}</div>`;
  const word=`<div class="fx-move-word fx-word-${mv.type}">${fx.word}</div>`;
  fxShow(`<div class="fx-sprite fx-charge">${pokeImgTag(st,'fx-img')}</div>
      ${beam}${word}${particles}`,
    `<b class="fx-title" style="color:${fx.c2}">${st.name} used ${mv.en}!</b><br>
     <span class="muted">✦ ${mv.name} ✦ ${mv.desc}</span>`,
    'fx-skill',3000,onDone);
  // 把属性色注入舞台，供 CSS 变量 --fx-c1/--fx-c2 使用（含背景染色）
  const stg=$('#fxStage');
  if(stg) stg.style.cssText=style + `background:radial-gradient(circle at 50% 45%,${fx.c1}33 0%,#08101a 72%);`;
  sfx('move', fx.sfx);   // 按属性播放不同音效
}

function showResult(){
  const graded=state.questions.filter(x=>x.q.type!=='passage').length;
  const score=state.correct, total=graded;
  const pct= total? Math.round(score/total*100) : 100;
  const msg = pct===100?'Perfect! All correct!':pct>=70?'Great job! Keep it up!':'Practice makes perfect!';
  const info=Store.stageInfo(state.selectedPokemon);
  const st=info.form;
  const branchTip = info.chainBranch>1 ? ` · 可变成 ${info.chainBranch} 种形态` : '';
  const d=state.delta||0;
  const energyLine = info.dead
    ? `💀 ${st.name} fainted this lesson… 明天复活，满血回归！`
    : `${st.name} energy ⚡ ${d>=0?'+':''}${d} (答对 +${ENERGY_PER_ANSWER} / 答错 −${ENERGY_PER_ANSWER})<br>
      ${info.maxed?`🏆 MAX! Final form reached!${branchTip}`:`Lv${info.stage+1} · Energy ${Math.round(info.intoStage)}/${info.need} — keep going!${branchTip}`}`;
  $('#progressFill').style.width='100%';
  $('#resultArea').innerHTML=`
    <h2>🎉 Lesson Complete!</h2>
    <div class="result-score">${score}/${total}</div>
    <div class="result-msg">${msg}</div>
    <div class="result-poke">${pokeImgTag(st,'result-img'+(info.dead?' result-dead':''))}</div>
    <div class="result-msg">${energyLine}</div>
    <div class="result-actions">
      <button class="btn-primary" id="moreBtn">More questions 🔄</button>
      <button class="btn-secondary" id="againBtn">Another lesson</button>
      <button class="btn-secondary" id="mistakeBtn2">Mistake book</button>
      <button class="btn-secondary" id="homeBtn2">Home</button>
    </div>`;
  show('screen-result');
  bindPokeImages($('#resultArea'));
  playCheer(state.selectedPokemon);          // 所选宝可梦专属音色的鼓励语
  $('#moreBtn').onclick=()=>beginSession(state.subject,state.lessonId); // 同宝可梦、同课，刷新新题
  $('#againBtn').onclick=()=>openSubject(state.subject);
  $('#mistakeBtn2').onclick=()=>openMistakes();
  $('#homeBtn2').onclick=()=>show('screen-home');
}

/* ---------- 错题本 ---------- */
function openMistakes(){
  setTopTitle('Mistake Book');
  const list=$('#mistakeList'); list.innerHTML='';
  const ms=Store.allMistakes().slice().reverse();
  if(!ms.length){ list.innerHTML='<p class="muted">No mistakes yet 🎉</p>'; }
  ms.forEach(m=>{
    const q=m.q;
    const item=document.createElement('div');
    item.className='mistake-item';
    const subjName = CURRICULUM[m.subject]?CURRICULUM[m.subject].label:m.subject;
    item.innerHTML=`
      <div class="mi-head"><span>${subjName}</span><span>${new Date(m.ts).toLocaleDateString()}</span></div>
      <div class="mi-q">${q.prompt}</div>
      <div class="mi-a">Your answer: <span class="no">${m.userAnswer||'(empty)'}</span> ｜ Correct: <span class="ok">${q.answer}</span></div>
      <div class="mi-actions"><button class="btn-secondary practiceBtn">Practice again</button></div>`;
    item.querySelector('.practiceBtn').onclick=()=>{ startPractice(m); };
    list.appendChild(item);
  });
  show('screen-mistakes');
}

/* 错题本「Practice again」：把当前所有错题排成一个连续复习队列。
 * 之前每次只装 1 道（total=1），答完就进结果页，孩子得退出→回首页→重进错题本再选题。
 * 现在答完一道直接进下一道（答错有「下一道」按钮、答对自动），错题全复习完才回结果页。
 * 注意：答对的复习题会被 onCorrect 从错题本移除，但那是另一份数组引用，
 *       不影响这里已快照的 state.questions，队列能完整走完。 */
function startPractice(startM){
  const all=Store.allMistakes().slice().reverse();   // 与错题本列表同序（最新在前）
  const picked=all.findIndex(x=>x===startM);
  // 以点击的那道打头，其余按列表顺序跟上；跨科目错题也照常复习（不需要同课上下文）
  const ordered = picked>=0 ? [startM, ...all.filter(x=>x!==startM)] : all;
  state.subject=startM.subject; state.lessonId=startM.lessonId;
  state.selectedPokemon = state.selectedPokemon || POKEMON[0].id;
  state.questions=ordered.map(x=>({q:x.q,ref:x,isReview:true}));
  state.idx=0; state.correct=0; state.total=state.questions.length;
  state.mistakeReviewSession=true;    // 反馈区据此显示「下一道」按钮
  state.animQueue=[]; state.delta=0;  // 错题复习不涉及进化动画/能量结算展示
  cancelSpeech();
  state.pendingExplain=false;
  state.explainToken=(state.explainToken||0)+1;
  updateCompanion();
  show('screen-lesson');
  renderQuestion();
}

/* ---------- 家长端 ---------- */
/* =========================================================
   家长真人录音题库（🎙️ 拼读题库）
   每个汉字录一段「四步连读」真人音频；只有录过的字才进小朋友题库。
   录音存 ParentBlendBank（IndexedDB），不进主存档/云同步。
   ========================================================= */
let blendRecorder=null, blendStream=null, blendChunks=[], blendActiveSyl=null, blendTimer=null;

function renderBlendLib(){
  const stat=$('#blendStat'), lib=$('#blendLib');
  if(!stat || !lib) return;
  const pb=(typeof ParentBlendBank!=='undefined')?ParentBlendBank:null;
  if(!pb){ stat.textContent='录音组件未加载'; return; }
  const done=pb.count(), total=(typeof ZH_BLENDS!=='undefined')?ZH_BLENDS.length:63;
  stat.innerHTML=`<div style="font-size:14px;margin:6px 0 12px">
    已录制 <b style="color:#1e8e5a">${done}</b> / ${total} 字　
    <span style="color:#888">${done===0?'（未录音时小朋友端沿用预录合成音）':pb.available?'':'⚠️ 本机存储不可用'}</span></div>
    <div style="height:8px;background:#e8edf3;border-radius:6px;overflow:hidden">
      <div style="height:100%;width:${Math.round(done/total*100)}%;background:#1e8e5a"></div></div>`;

  lib.innerHTML=ZH_BLENDS.map(it=>{
    const on=pb.has(it.syl);
    const p=zhToneMark(it.syl,it.tone);
    const hint=`${it.fin} → ${zhToneMark(it.fin,it.tone)} → ${it.ini}~${zhToneMark(it.fin,it.tone)} → ${p}`;
    return `<div class="blend-item ${on?'done':''}" data-syl="${it.syl}">
      <div class="blend-hz"><span class="blend-big">${it.hz}</span><span class="blend-py">${p}</span></div>
      <div class="blend-hint">${hint}</div>
      <div class="blend-acts">
        ${on?`<button class="blend-btn play" data-act="play" data-syl="${it.syl}">▶️ 试听</button>`:''}
        <button class="blend-btn rec" data-act="rec" data-syl="${it.syl}">${on?'🎙️ 重录':'🎙️ 录制'}</button>
        ${on?`<button class="blend-btn del" data-act="del" data-syl="${it.syl}">🗑️</button>`:''}
      </div>
      <div class="blend-status"></div>
    </div>`;
  }).join('');

  lib.querySelectorAll('.blend-btn').forEach(b=>{
    b.onclick=()=>{
      const syl=b.dataset.syl, act=b.dataset.act;
      if(act==='rec') blendRecord(syl);
      else if(act==='play') blendPlay(syl);
      else if(act==='del') blendDelete(syl);
    };
  });
}

/* 底部「同步录音到云端」旁的同步状态：读云端只读统计，显示已同步/待同步段数。
   manual=true 表示用户主动点「🔄 刷新」，会给完成提示。 */
async function renderBlendSyncStatus(manual){
  const el=$('#blendSyncStatus');
  if(!el) return;
  if(typeof BlendCloud==='undefined'){ el.textContent='云同步组件未加载'; return; }
  if(!BlendCloud.signedIn()){
    el.innerHTML='☁️ 未登录。点右上角 <b>👤</b> 登录同一账号后，即可在多台 iPad / 手机间共享家长录音。';
    return;
  }
  el.textContent='🔄 正在读取云端同步状态…';
  const r=await BlendCloud.status();
  if(!r || !r.ok){
    el.textContent='⚠️ 同步状态读取失败：'+((r&&r.reason)||'网络异常');
    if(manual) toastMsg('🔄 刷新失败：'+((r&&r.reason)||'网络异常'));
    return;
  }
  const t=r.lastSyncAt ? new Date(r.lastSyncAt).toLocaleString() : '尚未同步';
  el.innerHTML=`本机录音 <b>${r.local}</b> 段 · 云端 <b>${r.remote}</b> 段 · `
    +`已同步 <b style="color:#1e8e5a">${r.synced}</b> 段 · `
    +`待上传 <b style="color:#d07a00">${r.toPush}</b> 段 · 待下载 <b style="color:#d07a00">${r.toPull}</b> 段<br>`
    +`<span style="font-size:12px;color:#7a8fa3">上次同步：${t}${r.toPush||r.toPull?' · 点「同步录音到云端」完成同步':''}</span>`;
  if(manual) toastMsg(`🔄 已同步 ${r.synced} 段，待上传 ${r.toPush} 段、待下载 ${r.toPull} 段`);
}

function blendItem(syl){ return document.querySelector('#blendLib .blend-item[data-syl="'+syl+'"]'); }
function blendSay(syl,msg){ const el=blendItem(syl); const s=el&&el.querySelector('.blend-status'); if(s) s.textContent=msg||''; }

function blendPlay(syl){
  const url=(typeof ParentBlendBank!=='undefined')?ParentBlendBank.url(syl):null;
  if(!url){ toastMsg('还没有录音'); return; }
  const a=new Audio(url);
  a.play().then(()=>blendSay(syl,'🔊 播放中…')).catch(()=>blendSay(syl,'播放失败'));
  a.onended=()=>blendSay(syl,'');
}

async function blendRecord(syl){
  const pb=(typeof ParentBlendBank!=='undefined')?ParentBlendBank:null;
  if(!pb) return;
  // 同一时间只能录一段
  if(blendRecorder && blendRecorder.state==='recording'){ blendStop(); return; }
  const md=navigator.mediaDevices;
  if(!md || !md.getUserMedia || !window.MediaRecorder){ toastMsg('这台设备不支持录音'); return; }
  try{
    blendStream=await md.getUserMedia({audio:true});
    const mime=(typeof parentBlendMime==='function')?parentBlendMime():'';
    const opts=mime?{mimeType:mime}:undefined;
    blendChunks=[]; blendActiveSyl=syl;
    blendRecorder=new MediaRecorder(blendStream, opts);
    blendRecorder.ondataavailable=e=>{ if(e.data && e.data.size) blendChunks.push(e.data); };
    blendRecorder.onstop=()=>{
      try{ blendStream && blendStream.getTracks().forEach(t=>t.stop()); }catch(e){}
      blendStream=null;
      if(blendTimer){ clearTimeout(blendTimer); blendTimer=null; }
      const chunks=blendChunks, s=blendActiveSyl;
      blendRecorder=null; blendActiveSyl=null; blendChunks=[];
      if(!chunks.length){ blendSay(s,'没录到声音'); return; }
      const blob=new Blob(chunks,{type:(mime||'audio/webm')});
      // 试听 + 保存/重录
      const url=URL.createObjectURL(blob);
      const a=new Audio(url);
      blendSay(s,'录好了，点试听 → 满意点 ✅保存');
      const row=blendItem(s); if(!row){ URL.revokeObjectURL(url); return; }
      const acts=row.querySelector('.blend-acts');
      acts.innerHTML=`<button class="blend-btn play" id="bprev">▶️ 原音</button>
        <button class="blend-btn play" id="bden">🎧 降噪试听</button>
        <button class="blend-btn save" id="bsave">✅ 保存</button>
        <button class="blend-btn del" id="bcancel">✖ 取消</button>`;
      $('#bprev').onclick=()=>a.play().catch(()=>{});
      let denCache=null; // 降噪结果缓存，试听/保存复用，不重复处理
      const denLevel=()=>window.POKELEARN_DENOISE_LEVEL||'normal';
      $('#bden').onclick=async()=>{
        const db=$('#bden');
        if(denCache){ try{ new Audio(URL.createObjectURL(denCache)).play(); }catch(e){} return; }
        if(typeof AudioDenoise==='undefined'){ blendSay(s,'降噪组件未加载'); return; }
        db.disabled=true; db.textContent='⏳ 处理中…';
        try{
          denCache=await AudioDenoise.denoise(blob,denLevel());
          const dp=new Audio(URL.createObjectURL(denCache));
          dp.onended=()=>blendSay(s,'🎧 上面是降噪后 · 满意请点保存');
          await dp.play();
        }catch(e){ blendSay(s,'降噪失败：'+e.message); }
        db.disabled=false; db.textContent='🎧 降噪试听';
      };
      $('#bcancel').onclick=()=>{ URL.revokeObjectURL(url); renderBlendLib(); };
      $('#bsave').onclick=async()=>{
        const btn=$('#bsave'); btn.disabled=true; btn.textContent='⏳ 降噪中…';
        let use=blob, denoised=false;
        try{
          if(!denCache && typeof AudioDenoise!=='undefined'){
            try{ denCache=await AudioDenoise.denoise(blob,denLevel()); }
            catch(de){ console.warn('降噪失败，降级用原音',de); }
          }
          if(denCache){ use=denCache; denoised=true; }
          await pb.save(s,use,{dur:0,denoised});
          renderBlendLib();
          toastMsg(denoised?'✅ 已降噪保存，小朋友端可用了':'✅ 已保存（原音），小朋友端可用了');
          /* 登录状态下自动同步到云端（跨设备共享），失败不影响本地使用 */
          if(typeof BlendCloud!=='undefined'){
            BlendCloud.pushOne(s).then(r=>{
              if(r && r.ok) toastMsg('☁️ 已同步到云端，其他设备登录同一账号可用');
              else if(r && r.reason!=='unavailable') toastMsg('☁️ 云端同步失败：'+(r.reason||'')+'（录音仍在本机可用）');
            }).catch(()=>{});
          }
        }catch(e){ blendSay(s,'保存失败：'+e.message); btn.disabled=false; btn.textContent='✅ 保存'; }
      };
    };
    blendRecorder.start();
    blendSay(syl,'🎙️ 录音中… 现在读四步连读（最多12秒，再点一次结束）');
    const btn=blendItem(syl).querySelector('[data-act="rec"]');
    if(btn) btn.textContent='⏹ 结束录音';
    blendTimer=setTimeout(()=>{ if(blendRecorder && blendRecorder.state==='recording') blendStop(); }, 12000);
  }catch(e){
    blendSay(syl,'麦克风打不开：'+e.message);
    try{ blendStream && blendStream.getTracks().forEach(t=>t.stop()); }catch(_){}
    blendStream=null; blendRecorder=null;
  }
}

function blendStop(){
  if(blendRecorder && blendRecorder.state==='recording') blendRecorder.stop();
}

async function blendDelete(syl){
  if(!confirm('删除「'+syl+'」的录音？该字会退出小朋友拼读题库（云端备份也一并删除）。')) return;
  const pb=(typeof ParentBlendBank!=='undefined')?ParentBlendBank:null;
  if(!pb) return;
  try{
    await pb.remove(syl);
    if(typeof BlendCloud!=='undefined') BlendCloud.removeRemote(syl).catch(()=>{});
    renderBlendLib(); toastMsg('🗑️ 已删除');
  }
  catch(e){ toastMsg('删除失败：'+e.message); }
}

function renderParent(){
  setTopTitle('Parents');
  const ov=Store.overallStats();
  const days=Store.dailyStats(7);
  const trends=Store.mistakeTrends();

  // 每日正确率柱状图（最近 7 天）
  let bars='';
  days.forEach(d=>{
    const h=Math.max(4, d.accuracy); // 最少 4% 高度可见
    const dim = d.has ? '' : ' dim';
    bars+=`<div class="bar-col${dim}">
      <div class="bar-wrap"><div class="bar" style="height:${h}%"></div>
        <div class="bar-val">${d.has?d.accuracy+'%':'·'}</div></div>
      <div class="bar-label">${d.date.slice(5)}</div></div>`;
  });

  // 错题趋势
  let tr='';
  const maxC=Math.max(1, ...trends.map(t=>t.count));
  trends.forEach(t=>{
    const w=Math.round(t.count/maxC*100);
    tr+=`<div class="tr-row"><div class="tr-name">${t.label}</div>
      <div class="tr-track"><div class="tr-fill" style="width:${t.count?Math.max(8,w):0}%"></div></div>
      <div class="tr-count">${t.count}</div></div>`;
  });

  $('#parentArea').innerHTML=`
    <h2>👨‍👩‍👧 Parents Dashboard</h2>
    <div class="stat-grid">
      <div class="stat-card"><div class="stat-num">${ov.lessons}</div><div class="stat-lbl">Lessons done</div></div>
      <div class="stat-card"><div class="stat-num">${ov.accuracy}%</div><div class="stat-lbl">Overall accuracy</div></div>
      <div class="stat-card"><div class="stat-num">${ov.totalQ}</div><div class="stat-lbl">Questions answered</div></div>
      <div class="stat-card"><div class="stat-num">${ov.mistakes}</div><div class="stat-lbl">Mistakes to review</div></div>
    </div>

    <div class="parent-block">
      <h3>Daily Accuracy (last 7 days)</h3>
      <div class="bar-chart">${bars}</div>
    </div>

    <div class="parent-block">
      <h3>Mistake Trends by Subject</h3>
      ${tr}
    </div>

    <div class="parent-block" id="blendBlock">
      <h3>🎙️ 拼读题库（家长真人录音）</h3>
      <p class="muted" style="font-size:13px;line-height:1.6">给每个字录一段<b>真人四步连读</b>：韵母 → 带调韵母 → 声母拉长连读 → 完整音节（像老师那样一口气拼出来）。<b>只有录过的字才会出现在小朋友的拼读练习里</b>。<br>☁️ <b>跨设备共享</b>：登录账号后，保存的录音会自动传到云端；在另一台 iPad / 手机上用<b>同一个账号</b>登录，点下面的「☁️ 同步录音到云端」即可把录音拉过来。未登录时录音只存本机。</p>
      <div id="blendStat" class="blend-stat"></div>
      <div id="blendLib" class="blend-lib"></div>
      <div style="margin-top:10px;display:flex;gap:10px;flex-wrap:wrap">
        <button class="btn-secondary" id="blendSyncBtn">☁️ 同步录音到云端</button>
        <button class="btn-load" id="blendRefreshBtn">🔄 刷新同步状态</button>
        <button class="btn-danger" id="blendClearBtn">🗑️ 清空全部录音</button>
      </div>
      <div id="blendSyncStatus" class="blend-sync-status" style="font-size:13px;line-height:1.6;margin-top:10px;padding:10px 12px;background:#f4f8fc;border-radius:10px;color:#33506b"></div>
    </div>

    <div class="parent-block">
      <h3>Settings</h3>
      <label class="setting-row"><input type="checkbox" id="optAutoread" ${Store.getSetting('autoread')?'checked':''}/> 🔊 Auto read questions aloud（自动读题，使用高清录音）</label>
      <label class="setting-row"><input type="checkbox" id="optSound" ${Store.getSetting('sound')?'checked':''}/> 🔔 Sound effects &amp; Pokémon cheers（音效 + 宝可梦鼓励语）</label>
      <label class="setting-row"><input type="checkbox" id="optZhread" ${Store.getSetting('zhread')?'checked':''}/> 🧩 中文自动播报（认读 / 拼读 / 声调，进题就念一遍）</label>
      <label class="setting-row"><input type="checkbox" id="optMic" ${Store.getSetting('mic')?'checked':''}/> 🎤 显示「我来读」跟读入口（认读课默认听音选一选）</label>
      <p class="muted" style="font-size:13px;line-height:1.5">声母 / 韵母认读默认用「听音选一选」，点题目下方的「🎤 我来读」才切到跟读判音，读对时宝可梦会叫一声为孩子欢呼（跟「🔔 音效」开关联动）。关闭本开关会隐藏「我来读」入口，整节课只做听音选一选。语音识别需 Chrome/Edge + 联网；iPad 不支持时会自动降级为「录音回放 + 家长确认」。</p>
    </div>

    <div class="parent-block">
      <h3>Backup &amp; Restore</h3>
      <p class="muted">进度存在这台设备上。换 iPad / 手机前，先在这里导出存档，再到新设备导入。</p>
      <div class="backup-row">
        <button class="btn-secondary" id="exportBtn">⬇️ Export save file</button>
        <button class="btn-secondary" id="importBtn">⬆️ Import save file</button>
      </div>
      <input type="file" id="importFile" accept=".json,application/json" class="hidden"/>
    </div>

    <div class="parent-block">
      <button class="btn-secondary" id="parentHomeBtn">← Back to Home</button>
      <button class="btn-danger" id="resetBtn">Reset all data</button>
    </div>
    <p class="muted" style="text-align:center;font-size:12px;margin:6px 0 18px">
      Build ${(typeof POKELEARN_BUILD!=='undefined')?POKELEARN_BUILD:'dev'}<br/>
      <span style="font-size:11px">Voice — ${voiceLabel()}</span></p>`;

  $('#parentHomeBtn').onclick=()=>show('screen-home');
  // 家长真人录音题库
  renderBlendLib();
  $('#blendClearBtn').onclick=()=>{
    if(confirm('清空所有已录制的拼读？小朋友端的拼读题会随之变回预录合成音，云端备份也会一并删除。此操作不可撤销。')){
      const pb=ParentBlendBank;
      const all=pb.list().slice();
      pb.clear().then(()=>{
        if(typeof BlendCloud!=='undefined'){
          all.forEach(s=>BlendCloud.removeRemote(s).catch(()=>{}));
          BlendCloud.clearLedger();          // 清掉同步指纹，避免下次同步误判为「已同步」
        }
        renderBlendLib(); renderBlendSyncStatus();
      });
    }
  };
  renderBlendSyncStatus();                 // 一进家长页就显示当前同步状态
  $('#blendRefreshBtn').onclick=async()=>{
    if(typeof BlendCloud==='undefined'){ toastMsg('云同步组件未加载'); return; }
    if(!BlendCloud.signedIn()){
      toastMsg('请先登录账号（点右上角 👤）');
      if(typeof CloudSync!=='undefined' && CloudSync.openModal) CloudSync.openModal();
      return;
    }
    await renderBlendSyncStatus(true);
  };
  $('#blendSyncBtn').onclick=async()=>{
    const btn=$('#blendSyncBtn');
    if(typeof BlendCloud==='undefined'){ toastMsg('云同步组件未加载'); return; }
    if(!BlendCloud.signedIn()){
      toastMsg('请先登录账号（点右上角 👤）');
      if(typeof CloudSync!=='undefined' && CloudSync.openModal) CloudSync.openModal();
      return;
    }
    btn.disabled=true; btn.textContent='⏳ 同步中…';
    const r=await BlendCloud.syncAll({
      onProgress:(phase,n)=>{ btn.textContent=`⏳ ${phase==='pull'?'拉取':'上传'} ${n} 段…`; }
    });
    btn.disabled=false; btn.textContent='☁️ 同步录音到云端';
    renderBlendLib(); renderBlendSyncStatus();
    if(r && r.ok){
      const skipped=r.skipped||0;
      toastMsg(`☁️ 同步完成：拉取 ${r.pulled} 段、上传 ${r.pushed} 段`
        + (skipped?`（已同步 ${skipped} 段自动跳过）`:'') + (r.failed?`（失败 ${r.failed}）`:''));
    }else{
      toastMsg('☁️ 同步失败：'+((r&&r.reason)||'网络异常'));
    }
  };
  $('#optAutoread').onchange=e=>Store.setSetting('autoread', e.target.checked);
  $('#optSound').onchange=e=>Store.setSetting('sound', e.target.checked);
  $('#optZhread').onchange=e=>Store.setSetting('zhread', e.target.checked);
  $('#optMic').onchange=e=>Store.setSetting('mic', e.target.checked);

  // 导出：存档下载为 JSON 文件
  $('#exportBtn').onclick=()=>{
    try{
      const blob=new Blob([Store.exportSave()],{type:'application/json'});
      const a=document.createElement('a');
      a.href=URL.createObjectURL(blob);
      a.download='pokelearn-save-'+todayStr()+'.json';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(()=>URL.revokeObjectURL(a.href), 2000);
      toastMsg('⬇️ Save file downloaded');
    }catch(e){ toastMsg('Export failed: '+e.message); }
  };

  // 导入：读取 JSON 文件并恢复（覆盖当前进度，导入前二次确认）
  $('#importBtn').onclick=()=>$('#importFile').click();
  $('#importFile').onchange=e=>{
    const f=e.target.files[0]; if(!f) return;
    const reader=new FileReader();
    reader.onload=()=>{
      if(confirm('Import this save? Current progress on this device will be REPLACED.')){
        const ok=Store.importSave(String(reader.result));
        toastMsg(ok ? '✅ Save imported!' : '❌ Not a valid save file');
        renderParent();
      }
      e.target.value='';
    };
    reader.readAsText(f);
  };

  $('#resetBtn').onclick=()=>{
    if(confirm('Reset ALL progress (Pokémon, mistakes, stats)? This cannot be undone.')){
      Store.resetAll();
      renderParent();
    }
  };
}

/* =========================================================
   绘本库（Picture Books）
   中文 / English 双库 · K1/K2/P1/P2 分档 · 每周一自动上新 5 本
   阅读记录存在 Store.data.books
   ========================================================= */
const libState = { lang:'zh', level:'all' };
let reader = { book:null, page:0 };

/* 朗读整句：统一走 ttsSpeak，保证与读题同一把嗓子、同一套参数 */
function sayText(text, lang){ ttsSpeak(text, lang); }

function levelInfo(id){ return BOOK_LEVELS.find(l=>l.id===id) || { label:id, color:'#7A6EF0' }; }

function openLibrary(){
  setTopTitle('📚 Picture Books');
  show('screen-library');
}

function renderLibrary(){
  const avail = availableBooks();
  const langBooks = avail.filter(b=>b.lang===libState.lang);
  const shown = langBooks.filter(b=>libState.level==='all' || b.level===libState.level);
  const recs = Store.data.books || {};

  // 顶部一句话：本周新书 + 总进度
  const stats = Store.bookStats(BOOKS);
  const newIds = thisWeekBooks().map(b=>b.id);
  $('#libSub').textContent =
    `本周上新 5 本 · 已读 ${stats.read} / ${avail.length} 本 · 下周一 ${nextBookUnlockDate()} 再上新`;

  // 语言切换
  $('#libTabs').innerHTML = BOOK_LANGS.map(l=>{
    const cnt = avail.filter(b=>b.lang===l.id).length;
    const read = avail.filter(b=>b.lang===l.id && recs[b.id] && recs[b.id].read).length;
    return `<button class="lib-tab ${libState.lang===l.id?'active':''}" data-lang="${l.id}">
      <span class="lt-flag">${l.flag}</span><span class="lt-name">${l.label}</span>
      <span class="lt-cnt">${read}/${cnt}</span></button>`;
  }).join('');

  // 级别筛选
  const levels = [{id:'all', label:'全部'}].concat(
    BOOK_LEVELS.filter(l=>langBooks.some(b=>b.level===l.id)).map(l=>({ id:l.id, label:`${l.label} · ${l.cn}` })));
  $('#libLevels').innerHTML = levels.map(l=>{
    const n = l.id==='all' ? langBooks.length : langBooks.filter(b=>b.level===l.id).length;
    return `<button class="lib-chip ${libState.level===l.id?'active':''}" data-level="${l.id}">${l.label} <b>${n}</b></button>`;
  }).join('');

  // 书架
  const grid=$('#bookGrid');
  if(!shown.length){
    grid.innerHTML = `<div class="book-empty">这一档还没有绘本，换个级别看看吧 📚</div>`;
  }else{
    // 新书排前面
    const ordered = shown.slice().sort((a,b)=>{
      const na=newIds.includes(a.id)?1:0, nb=newIds.includes(b.id)?1:0;
      if(na!==nb) return nb-na;
      const ra=(recs[a.id]&&recs[a.id].read)?1:0, rb=(recs[b.id]&&recs[b.id].read)?1:0;
      return ra-rb;
    });
    grid.innerHTML = ordered.map(b=>{
      const r = recs[b.id] || null;
      const lv = levelInfo(b.level);
      const isNew = newIds.includes(b.id);
      const times = r ? (r.times||0) : 0;
      const partial = r && !r.read && r.page>0 ? `<div class="bc-progress"><i style="width:${Math.round((r.page+1)/b.pages.length*100)}%"></i></div>` : '';
      return `<div class="book-card" data-id="${b.id}">
        <div class="book-cover">
          ${bookArt(b.pages[0].art)}
          ${r && r.read ? '<span class="bc-read">✓ 已读</span>' : ''}
          ${isNew ? '<span class="bc-new">NEW</span>' : ''}
          ${times>1 ? `<span class="bc-stars">${'⭐'.repeat(Math.min(times,3))}</span>` : ''}
        </div>
        <div class="book-info">
          <div class="book-title">${b.title}</div>
          <div class="book-sub"><span class="book-lv" style="background:${lv.color}">${lv.label}</span>
            ${b.pages.length} 页${b.lang==='zh'?'':''}${r&&!r.read&&r.page>0?` · 读到第 ${r.page+1} 页`:''}</div>
          ${partial}
        </div>
      </div>`;
    }).join('');
    $$('#bookGrid .book-card').forEach(c=>{ c.onclick=()=>openBook(c.dataset.id); });
  }

  // 底部
  $('#libFooter').innerHTML = `
    <div class="lf-note">📅 每周一自动上新 5 本，旧绘本一直保留在书架上。</div>
    <button class="btn-secondary" id="openLogBtn">📖 阅读记录 Reading Log</button>`;
  $('#openLogBtn').onclick=()=>{ setTopTitle('📖 Reading Log'); show('screen-reading-log'); renderReadingLog(); };

  $$('#libTabs .lib-tab').forEach(t=>{
    t.onclick=()=>{ libState.lang=t.dataset.lang; libState.level='all'; renderLibrary(); };
  });
  $$('#libLevels .lib-chip').forEach(c=>{
    c.onclick=()=>{ libState.level=c.dataset.level; renderLibrary(); };
  });
}

/* ---------------- 阅读器 ---------------- */
function openBook(id){
  const b = BOOKS.find(x=>x.id===id);
  if(!b) return;
  reader.book=b;
  const p = Math.min(Store.bookPage(id), b.pages.length-1);
  reader.page = Math.max(0, p);
  setTopTitle(b.title);
  show('screen-reader');
  renderReaderPage(true);
}

function renderReaderPage(firstTime){
  const b=reader.book; if(!b) return;
  const pg=b.pages[reader.page];
  $('#readerTitle').textContent = b.title;
  $('#readerMeta').textContent = `${levelInfo(b.level).label} · ${b.titleEn||''}`;
  const r=Store.bookRec(b.id);
  $('#readerBadge').innerHTML = r && r.read ? `<span class="rb-read">✓ 已读 ${r.times>1?'×'+r.times:''}</span>` : '';
  $('#readerArt').innerHTML = bookArt(pg.art);
  $('#readerText').textContent = pg.t;
  $('#readerText').className = 'reader-text ' + (b.lang==='zh' ? 'zh' : 'en') +
    (pg.t.length>46 ? ' small' : '');

  $('#readerDots').innerHTML = b.pages.map((_,i)=>
    `<span class="dot ${i===reader.page?'on':''}"></span>`).join('');

  $('#prevPage').disabled = reader.page===0;
  const last = reader.page === b.pages.length-1;
  $('#nextPage').classList.toggle('hidden', last);
  $('#finishBook').classList.toggle('hidden', !last);

  Store.touchBook(b.id, reader.page, b.pages.length);

  if(Store.getSetting('autoread')){
    setTimeout(()=>{ if(reader.book===b && reader.page===b.pages.indexOf(pg)) sayText(pg.t, b.lang==='zh'?'zh-CN':'en-US'); }, firstTime?260:120);
  }
}

function turnPage(delta){
  const b=reader.book; if(!b) return;
  const next = reader.page + delta;
  if(next<0 || next>=b.pages.length) return;
  reader.page=next;
  renderReaderPage(false);
}

function finishBook(){
  const b=reader.book; if(!b) return;
  const before = Store.isBookRead(b.id);
  Store.markBookRead(b.id, b.pages.length);
  const times = Store.bookTimes(b.id);
  if(Store.getSetting('sound')) sfx('good');
  toastMsg(before ? `🎉 又读了一遍！第 ${times} 次读完「${b.title}」` : `🎉 读完啦！「${b.title}」已点亮已读`);
  setTimeout(()=>{ reader.book=null; show('screen-library'); }, 900);
}

$('#readerBack').onclick=()=>{ reader.book=null; show('screen-library'); };
$('#prevPage').onclick=()=>turnPage(-1);
$('#nextPage').onclick=()=>turnPage(1);
$('#finishBook').onclick=()=>finishBook();
$('#readAloud').onclick=()=>{
  const b=reader.book; if(!b) return;
  sayText(b.pages[reader.page].t, b.lang==='zh'?'zh-CN':'en-US');
};
document.addEventListener('keydown', e=>{
  if($('#screen-reader').classList.contains('hidden')) return;
  if(e.key==='ArrowRight') turnPage(1);
  if(e.key==='ArrowLeft') turnPage(-1);
});
/* 手指左右滑动翻页（iPad 上最自然） */
(function bindSwipe(){
  const el=$('#reader'); let x0=null, y0=null;
  el.addEventListener('touchstart', e=>{ const t=e.changedTouches[0]; x0=t.clientX; y0=t.clientY; }, {passive:true});
  el.addEventListener('touchend', e=>{
    if(x0===null) return;
    const t=e.changedTouches[0];
    const dx=t.clientX-x0, dy=t.clientY-y0;
    if(Math.abs(dx)>50 && Math.abs(dx)>Math.abs(dy)) turnPage(dx<0?1:-1);
    x0=null; y0=null;
  }, {passive:true});
})();

/* ---------------- 阅读记录 ---------------- */
function renderReadingLog(){
  const avail = availableBooks();
  const st = Store.bookStats(BOOKS);
  const readIds = st.recent.map(b=>b.id);
  const inProg = avail.filter(b=>{
    const r=st.recs[b.id];
    return r && !r.read && r.page>0;
  });

  const statCards = [
    ['已读绘本','📚',st.read],
    ['本周读完','📅',st.week],
    ['累计阅读','🔁',st.finishes+' 次'],
    ['读过的页','📄',st.pages]
  ].map(([lbl,ico,val])=>`<div class="stat-card"><div class="stat-num">${val}</div>
      <div class="stat-lbl">${ico} ${lbl}</div></div>`).join('');

  const langRows = BOOK_LANGS.map(l=>{
    const total = avail.filter(b=>b.lang===l.id).length;
    const read = avail.filter(b=>b.lang===l.id && st.recs[b.id] && st.recs[b.id].read).length;
    const pct = total ? Math.round(read/total*100) : 0;
    return `<div class="tr-row"><div class="tr-name">${l.flag} ${l.label}</div>
      <div class="tr-track"><div class="tr-fill" style="width:${pct}%"></div></div>
      <div class="tr-count">${read}/${total}</div></div>`;
  }).join('');

  const levelRows = BOOK_LEVELS.map(l=>{
    const total = avail.filter(b=>b.level===l.id).length;
    if(!total) return '';
    const read = avail.filter(b=>b.level===l.id && st.recs[b.id] && st.recs[b.id].read).length;
    const pct = Math.round(read/total*100);
    return `<div class="tr-row"><div class="tr-name">${l.label} ${l.cn}</div>
      <div class="tr-track"><div class="tr-fill" style="width:${pct}%;background:linear-gradient(90deg,${l.color},${l.color}cc)"></div></div>
      <div class="tr-count">${read}/${total}</div></div>`;
  }).join('');

  const recentHtml = readIds.length ? st.recent.map(b=>{
    const r=st.recs[b.id], lv=levelInfo(b.level);
    const stars='⭐'.repeat(Math.min(r.times||1,5));
    return `<div class="log-book" data-id="${b.id}">
      <div class="lb-cover">${bookArt(b.pages[0].art)}</div>
      <div class="lb-body">
        <div class="lb-title">${b.title} <span class="book-lv" style="background:${lv.color}">${lv.label}</span></div>
        <div class="lb-meta">${r.times||1} 次 · 最近 ${r.last||'—'} · ${stars}</div>
      </div>
      <button class="btn-secondary lb-btn">再读一遍</button>
    </div>`;
  }).join('') : `<p class="muted">还没有读完的绘本，去书架上挑一本吧 📚</p>`;

  const progHtml = inProg.length ? `<div class="parent-block"><h3>继续读（读了一半）</h3>`+
    inProg.map(b=>{
      const r=st.recs[b.id];
      return `<div class="log-book" data-id="${b.id}">
        <div class="lb-cover">${bookArt(b.pages[0].art)}</div>
        <div class="lb-body"><div class="lb-title">${b.title}</div>
          <div class="lb-meta">读到第 ${r.page+1} / ${b.pages.length} 页</div></div>
        <button class="btn-secondary lb-btn">继续读</button></div>`;
    }).join('')+`</div>` : '';

  const unread = avail.filter(b=>!(st.recs[b.id] && st.recs[b.id].read)).length;

  $('#readingLog').innerHTML = `
    <div class="stat-grid">${statCards}</div>
    <div class="parent-block"><h3>中文 / English</h3>${langRows}</div>
    <div class="parent-block"><h3>按级别</h3>${levelRows}</div>
    ${progHtml}
    <div class="parent-block"><h3>读过的绘本（${st.read} 本）</h3>${recentHtml}</div>
    <div class="lib-footer">
      <div class="lf-note">还有 ${unread} 本没读 · 每周一自动上新 5 本</div>
      <button class="btn-secondary" id="logBackBtn">← 返回书架</button>
    </div>`;

  $$('#readingLog .log-book').forEach(el=>{
    el.querySelector('.lb-btn').onclick=()=>openBook(el.dataset.id);
  });
  $('#logBackBtn').onclick=()=>show('screen-library');
}

$('#libraryEntry').onclick=()=>openLibrary();

/* ---------- 启动 ---------- */
show('screen-home');

/* 深链接：#library / #reading-log / #book/<id> 可直接打开对应页面
   （iPad 主屏也可以单独放一个「绘本库」快捷方式） */
(function bootRoute(){
  const h=(location.hash||'').replace(/^#\/?/,'');
  if(h.indexOf('library')===0){
    const lg=h.split('/')[1];
    if(lg==='en'||lg==='zh') libState.lang=lg;
    openLibrary();
  }
  else if(h==='reading-log'){ setTopTitle('📖 Reading Log'); show('screen-reading-log'); renderReadingLog(); }
  else if(h.indexOf('book/')===0) openBook(h.slice(5));
})();
