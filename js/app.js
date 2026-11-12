/* =========================================================
   PokeLearn · 主控制器
   界面全英文；中文科目内容保留中文（拼音/汉字）
   ========================================================= */
const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));

Store.load();

const state = {
  subject:null, lessonId:null, questions:[], idx:0,
  correct:0, total:0, selectedPokemon:null, reviewDone:false
};

/* ---------- 屏幕切换 ---------- */
function show(id){
  $$('.screen').forEach(s=>s.classList.add('hidden'));
  $('#keyboard').classList.add('hidden');
  $('#'+id).classList.remove('hidden');
  $('#topbar').classList.toggle('hidden', id==='screen-home');
  if(id==='screen-home') renderHome();
  if(id==='screen-parent') renderParent();
}

function setTopTitle(t){ $('#topbarTitle').textContent = t; }

/* ---------- 语音：优先播放本地高清录音，浏览器 TTS 只作兜底 ---------- */
/* 浏览器自带 TTS 在 iPad 上语速放慢后会含糊；英文词库全部预生成了清晰音频 */
const PREFERRED_VOICES = [
  'Google US English','Microsoft Aria Online (Natural) - English (United States)',
  'Samantha (Enhanced)','Ava (Enhanced)','Allison (Enhanced)',
  'Samantha','Karen','Daniel','Google UK English Female'
];
let _cachedVoice=null, _voicesLoaded=false;
function bestVoice(){
  if(!('speechSynthesis' in window)) return null;
  if(_cachedVoice) return _cachedVoice;
  const vs=speechSynthesis.getVoices()||[];
  _voicesLoaded = vs.length>0;
  for(const name of PREFERRED_VOICES){
    const v=vs.find(x=>x.name===name && /^en/i.test(x.lang));
    if(v){ _cachedVoice=v; return v; }
  }
  const en=vs.find(x=>/^en[-_]US/i.test(x.lang)) || vs.find(x=>/^en/i.test(x.lang));
  _cachedVoice=en||null;
  return _cachedVoice;
}
if('speechSynthesis' in window){
  speechSynthesis.onvoiceschanged=()=>{ _cachedVoice=null; bestVoice(); };
}
function speak(text,lang){
  if(!('speechSynthesis' in window)) return;
  try{
    const u=new SpeechSynthesisUtterance(text);
    u.lang=lang||'en-US';
    u.rate=0.88; u.pitch=1.0;        // 0.7 太慢会拖音含糊，0.88 更清楚
    const v=bestVoice(); if(v && /^en/i.test(lang||'en-US')) u.voice=v;
    speechSynthesis.cancel(); speechSynthesis.speak(u);
  }catch(e){}
}

/* 首次触摸解锁 iOS Safari 的音频播放权限（自动读题需要在手势之外播放） */
document.addEventListener('pointerdown', ()=>{
  try{
    const a=new Audio();
    a.src='data:audio/mp4;base64,';
    a.play().catch(()=>{});
  }catch(e){}
}, {once:true, passive:true});

/* 本地音频播放：AUDIO_MAP / CHEER_MAP 由 js/audio-map.js 提供 */
let _audio=null, _audioToken=0;
function playClip(url, onEnd){
  if(!url) return false;
  try{
    if(!_audio) _audio=new Audio();
    const my=++_audioToken;
    _audio.pause();
    _audio.src=url;
    _audio.currentTime=0;
    _audio.onended=()=>{ if(my===_audioToken && onEnd) onEnd(); };
    _audio.play().catch(()=>{ if(onEnd) onEnd(); });
    return true;
  }catch(e){ return false; }
}
function clipFor(text){
  if(typeof AUDIO_MAP==='undefined') return null;
  const k=String(text||'').trim().toLowerCase();
  return AUDIO_MAP[k] || null;
}
/* 读题：优先播放题目自带的本地录音（中文拼音），其次查英文词库，最后才用浏览器 TTS */
function playSpeak(s, onEnd){
  if(!s) return;
  if(s.clip && playClip(s.clip,onEnd)) return;
  const url=clipFor(s.text);
  const slowUrl=clipFor(s.text+'::slow');
  const target=(s.slow && slowUrl) ? slowUrl : url;
  if(target && playClip(target,onEnd)) return;
  speak(s.text, s.lang);
  if(onEnd) setTimeout(onEnd, 1200);
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
function playCheer(id){
  if(!Store.getSetting('sound')) return;
  const list=(typeof CHEER_MAP!=='undefined' && CHEER_MAP[id]) || [];
  const url=list.length ? list[Math.floor(Math.random()*list.length)] : null;
  pokeCry(id||'pikachu');
  setTimeout(()=>{
    if(url) playClip(url);
    else speak('Well done!', 'en-US');
  }, 330);
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
function sfx(kind){
  if(!Store.getSetting('sound')) return;
  try{
    if(!_actx) _actx=new (window.AudioContext||window.webkitAudioContext)();
    if(_actx.state==='suspended') _actx.resume();
    if(kind==='good'){ tone(523,0,0.12); tone(659,0.10,0.12); tone(784,0.20,0.18); }
    else if(kind==='bad'){ tone(220,0,0.15,'triangle',0.10); tone(180,0.12,0.2,'triangle',0.10); }
    else if(kind==='evolve'){ [523,659,784,1047].forEach((f,i)=>tone(f,i*0.12,0.22)); }
  }catch(e){}
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
  const ms=Store.allMistakes();
  $('#mistakeSummary').textContent = ms.length
    ? `${ms.length} mistake${ms.length>1?'s':''} to review 💪`
    : 'No mistakes yet — great job!';
  $('#openMistakesBtn').classList.toggle('hidden', ms.length===0);
  updateStorageUI();
}

function renderCollection(){
  const box=$('#pokeCollection'); box.innerHTML='';
  POKEMON.forEach(pk=>{
    const info=Store.stageInfo(pk.id);
    const st=info.form;
    const chip=document.createElement('div');
    chip.className='poke-chip';
    chip.innerHTML=`<div class="face">${pokeImgTag(st,'chip-img')}</div>
      <div class="nm">${st.name}</div>
      <div class="cn">${st.cn}</div>
      <div class="ebar"><i style="width:${Math.round(info.progress*100)}%"></i></div>
      <div class="est">${info.maxed?'🏆 MAX!':`Lv${info.stage+1} · ${Math.round(info.intoStage)}/${info.need}`}</div>`;
    box.appendChild(chip);
  });
  bindPokeImages(box);
}

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
    card.innerHTML=`<div class="lc-emoji">${les.emoji}</div>
      <div class="lc-body"><div class="lc-title">${les.title} ${lvl}</div>
      <div class="lc-desc">${les.desc}</div></div>
      <div class="lc-done">${done?'✅':''}</div>`;
    card.onclick=()=>startLesson(subject,les.id);
    list.appendChild(card);
  });
  show('screen-subject');
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
    opt.className='poke-opt'; opt.dataset.id=pk.id;
    opt.dataset.search=(pk.name+' '+pk.cn+' '+st.name+' '+st.cn).toLowerCase();
    opt.innerHTML=`<div class="face">${pokeImgTag(st,'opt-img')}</div>
      <div class="nm">${st.name}</div>
      <div class="cn">${st.cn}</div>
      <div class="stage">${info.maxed?'MAX!':`⚡ ${Math.round(info.intoStage)}/${info.need} · Stage ${info.stage+1}/${pk.stages.length}`}</div>`;
    opt.onclick=()=>{
      $$('#pokePicker .poke-opt, #branchPicker .poke-opt').forEach(o=>o.classList.remove('sel'));
      opt.classList.add('sel');
      $('#confirmPokemonBtn').disabled=false;
    };
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
  const sel=$('.poke-opt.sel'); if(!sel) return;
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
$('#openMistakesBtn').onclick=()=>openMistakes();
$('#evolveCloseBtn').onclick=()=>{ $('#evolveModal').classList.add('hidden'); showResult(); };
$('#parentBtn').onclick=()=>show('screen-parent');

/* ---------- 开始一次学习会话 ---------- */
function beginSession(subject,lessonId){
  // 先取上一节课错题用于复习，再开启新会话
  const review=Store.lastSessionMistakes().map(m=>({q:m.q,ref:m,isReview:true}));
  Store.rotateSession();

  const lesson=CURRICULUM[subject].lessons.find(l=>l.id===lessonId);
  const fresh=lesson.make().map(q=>({q,isReview:false}));
  state.questions=[...review,...fresh];
  state.idx=0; state.correct=0;
  state.total=state.questions.length;
  state.subject=subject; state.lessonId=lessonId; state.reviewDone=false;

  updateCompanion();
  show('screen-lesson');
  renderQuestion();
}

/* ---------- 顶部伙伴徽章 ---------- */
function updateCompanion(){
  const info=Store.stageInfo(state.selectedPokemon);
  const st=info.form;
  const badge=$('#companionBadge');
  badge.innerHTML=`${pokeImgTag(st,'badge-img')}<span class="cname">${st.name}</span>
    <span class="mini-energy">Lv${info.stage+1} ${info.maxed?'MAX':`⚡${Math.round(info.intoStage)}/${info.need}`}</span>`;
  bindPokeImages(badge);
}

/* ---------- 语音输入：切题时必须先停掉上一题的麦克风 ---------- */
let _stopSpeechInput=null;
function stopSpeechInput(){
  if(_stopSpeechInput){ try{ _stopSpeechInput(); }catch(e){} _stopSpeechInput=null; }
}

/* ---------- 渲染题目 ---------- */
function renderQuestion(){
  stopSpeechInput();
  const item=state.questions[state.idx];
  const q=item.q;
  $('#reviewTag').classList.toggle('hidden', !item.isReview);
  const pct=Math.round((state.idx)/state.total*100);
  $('#progressFill').style.width=pct+'%';
  $('#progressText').textContent=`${state.idx+1} / ${state.total}`;
  $('#feedback').className='feedback hidden';

  const area=$('#questionArea');
  let h=`<div class="q-prompt">${q.prompt}</div>`;
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
        ? `<span class="tone-mark">${q.optionMarks[i]}</span><span class="tone-name">${o}</span>` : o;
      h+=`<button class="option-btn" data-v="${o}">${label}</button>`;
    });
    h+=`</div>`;
    if(q.canSpeak && Store.getSetting('mic'))
      h+=`<button class="btn-link" id="speakModeBtn">🎤 我来读（读出声母/韵母，读对才过关）</button>`;
  } else if(q.type==='type'){
    h+=`<div class="type-area">
      <input class="type-input" id="typeInput" inputmode="text" autocomplete="off" />
      <div><button class="check-btn" id="checkBtn">Check ✓</button></div>
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
    if(q.speak) setTimeout(()=>playSpeak(q.speak), 500);
  } else if(q.type==='speak'){
    $('#demoBtn').onclick=()=>playSpeak(q.speak);
  } else if(q.speak){
    $('#speakBtn').onclick=()=>playSpeak(q.speak);
    const slowBtn=$('#slowBtn');
    if(slowBtn) slowBtn.onclick=()=>{
      const s=Object.assign({}, q.speak, {slow:true});
      playSpeak(s, ()=>setTimeout(()=>playSpeak(s), 400));
    };
    // 中文拼读题独立开关（默认开）：声母→韵母→音节 自动播报
    const shouldAuto = q.speak.autoplay ? Store.getSetting('zhread') : Store.getSetting('autoread');
    if(shouldAuto) setTimeout(()=>playSpeak(q.speak), 400);
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
        showFeedback(true,q.explain,true);
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
function asChoice(q){
  if(q.type==='choice') return Object.assign({},q,{canSpeak:true});
  return Object.assign({},q,{
    type:'choice', canSpeak:true,
    prompt:`🔊 听一听，选出这个${q.kind==='initial'?'声母':'韵母'}`,
    sub:'点 🔊 可以再听一次，然后选出正确的拼音',
    options:q.options||q.fallbackOptions||[], answer:q.target
  });
}
function asSpeak(q){
  if(q.type==='speak') return q;
  return Object.assign({},q,{
    type:'speak',
    prompt:`读出这个${q.kind==='initial'?'声母':'韵母'} 🎤`,
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
         ? `<span class="tone-mark">${cq.optionMarks[i]}</span><span class="tone-name">${o}</span>` : o;
       return `<button class="option-btn" data-v="${o}">${label}</button>`;
     }).join('')+`</div>`;
  if(cq.canSpeak && Store.getSetting('mic'))
    h+=`<button class="btn-link" id="speakModeBtn">🎤 我来读（读出声母/韵母，读对才过关）</button>`;
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
  const pool=(typeof ZH_INITIALS!=='undefined' && q.kind==='initial') ? ZH_INITIALS : ZH_FINALS;
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
    showFeedback(true, q.explain, true, null, false, 1500);  // 多留点时间看清欢呼提示
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
function bindType(q,item){
  const input=$('#typeInput');
  buildKeyboard(input);
  input.focus();
  $('#checkBtn').onclick=()=>{
    const val=input.value.trim().toLowerCase();
    if(!val) return;
    const correct = val===q.answer.toLowerCase();
    if(correct){
      state.correct++; onCorrect(item);
      sfx('good');
      $('#checkBtn').disabled=true; input.disabled=true; hideKeyboard();
      showFeedback(true,q.explain,true);
    }else{
      sfx('bad');
      input.disabled=true; hideKeyboard();
      showFeedback(false,`Spell it: ${q.answer}`,false,()=>recordWrong(item,val,q));
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
          showFeedback(true,'Great! Sentence complete!',true);
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
function buildKeyboard(input){
  const kb=$('#keyboard'); kb.innerHTML=''; kb.classList.remove('hidden');
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
}
function hideKeyboard(){ $('#keyboard').classList.add('hidden'); }

/* 答对（含复习题）时处理错题本：复习题答对即从错题本移除 */
function onCorrect(item){
  if(item.isReview && item.ref) Store.removeMistake(item.ref);
}

/* ---------- 反馈 & 流程 ---------- */
function showFeedback(good,explain,autoNext,onWrong,stay,delay){
  const fb=$('#feedback');
  fb.className='feedback '+(good?'good':'bad');
  fb.innerHTML = (good?'🎉 Awesome!':'💡 Try again') + (explain?`<br><span style="font-size:15px">${explain}</span>`:'');
  if(good && autoNext){
    setTimeout(nextQuestion, delay||950);
  }else if(!good){
    const btn=document.createElement('button');
    btn.className='btn-secondary'; btn.style.marginTop='10px';
    btn.textContent= stay?'Keep going':'Continue ➡️';
    btn.onclick=()=>{ if(onWrong) onWrong(); nextQuestion(); };
    fb.appendChild(document.createElement('br'));
    fb.appendChild(btn);
  }
}

function recordWrong(item,userAnswer,q){
  if(item.isReview){
    // 复习题答错：保留错题（不动）
  }else{
    Store.addMistake(state.subject,state.lessonId,q,userAnswer);
  }
}

function nextQuestion(){
  state.idx++;
  if(state.idx>=state.total){ finishLesson(); return; }
  renderQuestion();
}

/* ---------- 结束课程 ---------- */
function finishLesson(){
  const id=state.selectedPokemon;
  Store.markLesson(state.subject,state.lessonId);
  // 一课只加一次能量，Store 保证最多升 1 阶
  const evo=Store.addEnergy(id, ENERGY_PER_LESSON);
  const graded=state.questions.filter(x=>x.q.type!=='passage').length;
  Store.recordAttempt(state.subject, state.correct, graded);
  updateCompanion();
  flashSaved();
  if(evo.needsBranch){
    showBranchPicker(id, evo.to, ()=>showEvolve(id, evo.to));
  }else if(evo.evolved){
    showEvolve(id, evo.to);
  }else{
    showResult();
  }
}

/* 分支进化：伊布 8 种、臭臭花 2 种、奇鲁莉安 2 种 */
function showBranchPicker(id, stage, done){
  const pk=POKEMON.find(p=>p.id===id);
  const opts=branchOptions(pk,stage);
  $('#branchHint').textContent=`${pk.cn} 可以进化成不同的样子，选一个吧！ ✨`;
  const box=$('#branchPicker'); box.innerHTML='';
  opts.forEach((f,idx)=>{
    const o=document.createElement('div');
    o.className='poke-opt'; o.dataset.idx=idx;
    o.innerHTML=`<div class="face">${pokeImgTag(f,'opt-img')}</div>
      <div class="nm">${f.name}</div><div class="cn">${f.cn}</div>`;
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

function showEvolve(id,stage){
  const pk=POKEMON.find(p=>p.id===id);
  const info=Store.stageInfo(id);
  const st=info.form;
  const prev=formOf(pk, stage-1, null);
  $('#evolveTitle').textContent=`${pk.name} evolved! (Stage ${stage+1}/${pk.stages.length})`;
  $('#evolveStage').innerHTML=`${pokeImgTag(prev,'evo-img')} ➜ ${pokeImgTag(st,'evo-img')}
    <br><b>${prev.name} → ${st.name}</b><br><span class="muted">${prev.cn} → ${st.cn}</span>`;
  $('#evolveModal').classList.remove('hidden');
  bindPokeImages($('#evolveStage'));
  sfx('evolve');
}

function showResult(){
  const graded=state.questions.filter(x=>x.q.type!=='passage').length;
  const score=state.correct, total=graded;
  const pct= total? Math.round(score/total*100) : 100;
  const msg = pct===100?'Perfect! All correct!':pct>=70?'Great job! Keep it up!':'Practice makes perfect!';
  const info=Store.stageInfo(state.selectedPokemon);
  const st=info.form;
  $('#progressFill').style.width='100%';
  $('#resultArea').innerHTML=`
    <h2>🎉 Lesson Complete!</h2>
    <div class="result-score">${score}/${total}</div>
    <div class="result-msg">${msg}</div>
    <div class="result-poke">${pokeImgTag(st,'result-img')}</div>
    <div class="result-msg">${st.name} gained ⚡${ENERGY_PER_LESSON} energy<br>
      ${info.maxed?'🏆 MAX! Final form reached!':`Stage ${info.stage+1}/${info.pk.stages.length} · Energy ${Math.round(info.intoStage)}/${info.need} — keep going!`}</div>
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

function startPractice(m){
  state.subject=m.subject; state.lessonId=m.lessonId;
  state.selectedPokemon = state.selectedPokemon || POKEMON[0].id;
  state.questions=[{q:m.q,ref:m,isReview:true}];
  state.idx=0; state.correct=0; state.total=1;
  updateCompanion();
  show('screen-lesson');
  renderQuestion();
}

/* ---------- 家长端 ---------- */
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
    </div>`;

  $('#parentHomeBtn').onclick=()=>show('screen-home');
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

/* ---------- 启动 ---------- */
show('screen-home');
