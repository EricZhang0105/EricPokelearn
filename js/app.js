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
    if(state.subject) openSubject(state.subject); else show('screen-home');
    return;
  }
  if(cur==='screen-reader'){ reader.book=null; show('screen-library'); return; }
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
    /* 必杀技：蓄力低鸣 → 高频光束 + 噪声爆发 */
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
  const a=Store.manualArchive();
  const b=Store.backupArchive();
  if(a){
    info.textContent=`存档：${fmtArchiveTime(a.savedAt)} · 已进化 ${a.evolved||0} 只 / 累计 ${a.stages||0} 阶`;
    loadBtn.classList.remove('hidden');
  }else{
    info.textContent = b
      ? `还没有手动存档（自动备份：已进化 ${b.evolved||0} 只）`
      : '点「保存进度」把现在的进化进度存下来，换版本也不怕';
    loadBtn.classList.add('hidden');
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
  if(loadBtn) loadBtn.onclick=()=>{
    const a=Store.manualArchive();
    if(!a){ toastMsg('还没有存档'); return; }
    if(!confirm(`读取 ${fmtArchiveTime(a.savedAt)} 保存的进度？\n（已进化 ${a.evolved||0} 只 / 累计 ${a.stages||0} 阶，只会往前接，不会倒退）`)) return;
    const r=Store.applyArchive(a);
    updateCompanion(); renderHome();
    toastMsg(r ? `📂 已读取存档（${r.upgraded} 只更新）` : '当前进度已经比存档更靠前了');
  };
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
    // 有多选一分支的（伊布 8 种、臭臭花 2 种…）在头像上直接标出来，点开能看全部形态
    const badge = info.chainBranch>1
      ? `<div class="chip-branch">🧬 ×${info.chainBranch}</div>` : '';
    chip.innerHTML=`<div class="face">${pokeImgTag(st,'chip-img')}</div>
      <div class="nm">${st.name}</div>
      <div class="cn">${st.cn}</div>
      <div class="ebar"><i style="width:${Math.round(info.progress*100)}%"></i></div>
      <div class="est">${info.maxed?'🏆 MAX!':`Lv${info.stage+1} · ${Math.round(info.intoStage)}/${info.need}`}</div>${badge}`;
    chip.title=`看 ${pk.cn} 的进化家族`;
    chip.onclick=()=>openFamily(pk.id);
    box.appendChild(chip);
  });
  bindPokeImages(box);
}

/* ---------- 进化家族图鉴 ----------
   伊布这类「2 阶但有 8 种形态」的宝可梦，光看 Lv1/Lv2 会以为只有 2 个等级，
   所以点首页头像可以打开完整家族：每个阶段、每种分支形态、进化条件都列出来；
   如果已经到了分支阶，还能点别的形态直接换过去（8 种都能试）。 */
function openFamily(id){
  const pk=POKEMON.find(p=>p.id===id); if(!pk) return;
  const info=Store.stageInfo(id);
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
function makeFresh(lesson, lessonId, slots){
  let best=null, bestSig='';
  for(let i=0;i<8;i++){
    const raw=(lesson.make ? (lesson.make(slots)||[]) : []);
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
  const slots=Math.max(0, QUESTIONS_PER_SET-mistakes.length);
  let fresh=makeFresh(lesson, lessonId, slots);
  // 阅读这类"整篇短文"放不满剩余名额时，干脆全部用新题（复习题下次再复习）
  if(fresh.length + mistakes.length < QUESTIONS_PER_SET){
    fresh=makeFresh(lesson, lessonId, QUESTIONS_PER_SET);
  }
  // 新题在前，复习题垫底：点「More questions」第一眼看到的永远是新鲜题。
  // 新题放不满（比如阅读要整篇放，剩余名额不够一篇）时用复习题补足到 10。
  const pool=mistakes.map(m=>({q:m.q,ref:m,isReview:true}));
  const review=pool.slice(0, Math.max(0, QUESTIONS_PER_SET-fresh.length));
  state.questions=[...fresh,...review];
  state.idx=0; state.correct=0;
  state.total=state.questions.length;
  state.subject=subject; state.lessonId=lessonId; state.reviewDone=false;
  state.animQueue=[];          // 本套题里发生的进化/退化/死亡动画，在题目切换时播放
  state.delta=0;               // 本套题净能量变化，用于结果页展示

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
        ? `<span class="tone-mark">${q.optionMarks[i]}</span><span class="tone-name">${o}</span>` : o;
      h+=`<button class="option-btn" data-v="${o}">${label}</button>`;
    });
    h+=`</div>`;
    if(q.canSpeak && Store.getSetting('mic'))
      h+=`<button class="btn-link" id="speakModeBtn">🎤 我来读（读出${zhKindLabel(q.kind)}，读对才过关）</button>`;
  } else if(q.type==='type'){
    h+=`<div class="type-area">
      ${q.hint?`<div class="type-hint">💡 ${q.hint}</div>`:''}
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
         ? `<span class="tone-mark">${cq.optionMarks[i]}</span><span class="tone-name">${o}</span>` : o;
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
/* 答案归一化：忽略大小写、句点、多余空格，短答可配多个可接受写法 */
function normAnswer(s){
  return String(s||'').toLowerCase().trim()
    .replace(/[.,!?;:'"’“”]/g,'').replace(/\s+/g,' ');
}
function bindType(q,item){
  const input=$('#typeInput');
  buildKeyboard(input);
  input.focus();
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
  awardEnergy(ENERGY_PER_ANSWER);
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
  stg.className='fx-stage'; stg.innerHTML=html; cap.innerHTML=caption;
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
        fxShow(`<div class="fx-sprite fx-born">${pokeImgTag(st,'fx-img')}</div><div class="fx-burst">✨✨✨</div>`,
          `<b class="fx-title">${prev.name} → ${st.name}</b><br><span class="muted">${prev.cn} → ${st.cn}</span>`,
          'fx-evo',2600,onDone);
        sfx('evolveUp');
      });
    sfx('evolveCharge');
  };
  if(isBranchStage(pk, toStage) && Store.stageInfo(id).branch==null){
    showBranchPicker(id, toStage, proceed);   // 选完形态再播进化动画
  }else proceed();
}

/* 被击败：退化一阶 / 昏倒（死亡）→ 火箭队「我们还会回来的！」 */
function showDefeatFx(id, type, onDone){
  const pk=POKEMON.find(p=>p.id===id);
  const info=Store.stageInfo(id);
  const st=info.form;
  const cap = type==='die'
    ? `💀 <b class="fx-title">${st.name} fainted…</b><br><span class="muted">${st.cn} 昏倒了！明天再来选它，它会满血复活</span>`
    : `💥 <b class="fx-title">${st.name} was defeated!</b><br><span class="muted">${st.cn} 被击败，退化回第 ${info.stage+1} 阶（Lv${info.stage+1}）</span>`;
  fxShow(`<div class="fx-sprite fx-fall">${pokeImgTag(st,'fx-img')}</div><div class="fx-smoke">💨💨</div>`,
    cap,'fx-defeat',4300,onDone);
  sfx('defeat');
  setTimeout(()=>playClip(SFX_CLIP.rocket), 700);   // 先听击败音，再放火箭队台词
}

/* 全对奖励：宝可梦释放技能 */
function showSkillFx(id, onDone){
  const info=Store.stageInfo(id);
  const st=info.form;
  fxShow(`<div class="fx-sprite fx-charge">${pokeImgTag(st,'fx-img')}</div>
      <div class="fx-beam"></div><div class="fx-burst">💥💥💥</div>`,
    `⚡ <b class="fx-title">${st.name} used a super move!</b> ⚡<br><span class="muted">10 题全对！释放必杀技！</span>`,
    'fx-skill',2600,onDone);
  sfx('skill');
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

/* =========================================================
   绘本库（Picture Books）
   中文 / English 双库 · K1/K2/P1/P2 分档 · 每周一自动上新 5 本
   阅读记录存在 Store.data.books
   ========================================================= */
const libState = { lang:'zh', level:'all' };
let reader = { book:null, page:0 };

/* 朗读整句：中文优先 zh-CN 语音，英文用已选好的清晰语音 */
function sayText(text, lang){
  if(!('speechSynthesis' in window) || !text) return;
  try{
    speechSynthesis.cancel();
    const u=new SpeechSynthesisUtterance(text);
    u.lang = lang || 'en-US';
    u.rate = /^zh/i.test(u.lang) ? 0.86 : 0.82;
    u.pitch = 1.05;
    const vs = speechSynthesis.getVoices() || [];
    if(/^zh/i.test(u.lang)){
      const v = vs.find(x=>/^zh[-_]CN/i.test(x.lang)) || vs.find(x=>/^zh/i.test(x.lang));
      if(v) u.voice=v;
    }else{
      const v=bestVoice(); if(v) u.voice=v;
    }
    speechSynthesis.speak(u);
  }catch(e){}
}

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
