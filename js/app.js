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

/* ---------- 语音朗读 ---------- */
function speak(text,lang){
  if(!('speechSynthesis' in window)) return;
  try{
    const u=new SpeechSynthesisUtterance(text);
    u.lang=lang||'en-US'; u.rate=0.7; u.pitch=1.05;   // 放慢语速，更适合 5 岁小朋友
    speechSynthesis.cancel(); speechSynthesis.speak(u);
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
  const t=$('#toast'); if(!t) return;
  t.textContent = Store.available ? '💾 Progress saved!' : '⚠️ Open via the app to save';
  t.classList.remove('hidden'); t.classList.add('show');
  clearTimeout(flashSaved._t);
  flashSaved._t=setTimeout(()=>{ t.classList.remove('show'); t.classList.add('hidden'); }, 1700);
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
    const st=info.pk.stages[info.stage];
    const chip=document.createElement('div');
    chip.className='poke-chip';
    chip.innerHTML=`<div class="face">${pokeImgTag(st,'chip-img')}</div>
      <div class="nm">${st.name}</div>
      <div class="ebar"><i style="width:${Math.round(info.progress*100)}%"></i></div>
      <div class="est">${info.maxed?'MAX!':Math.round(info.intoStage)+'/'+info.need+' energy'}</div>`;
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
  POKEMON.forEach(pk=>{
    const info=Store.stageInfo(pk.id);
    const st=info.pk.stages[info.stage];
    const opt=document.createElement('div');
    opt.className='poke-opt'; opt.dataset.id=pk.id;
    opt.innerHTML=`<div class="face">${pokeImgTag(st,'opt-img')}</div>
      <div class="nm">${pk.name}</div>
      <div class="stage">Now: ${st.name} · ${Math.round(info.intoStage)}/${info.need}</div>`;
    opt.onclick=()=>{
      $$('.poke-opt').forEach(o=>o.classList.remove('sel'));
      opt.classList.add('sel');
      $('#confirmPokemonBtn').disabled=false;
    };
    picker.appendChild(opt);
  });
  $('#confirmPokemonBtn').disabled=true;
  $('#pokemonModal').classList.remove('hidden');
  bindPokeImages(picker);
}

$('#confirmPokemonBtn').onclick=()=>{
  const sel=$('.poke-opt.sel'); if(!sel) return;
  state.selectedPokemon=sel.dataset.id;
  $('#pokemonModal').classList.add('hidden');
  beginSession(pendingLesson.subject,pendingLesson.lessonId);
};
$('#homeBtn').onclick=()=>show('screen-home');
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
  const st=info.pk.stages[info.stage];
  const badge=$('#companionBadge');
  badge.innerHTML=`${pokeImgTag(st,'badge-img')}<span class="cname">${st.name}</span>
    <span class="mini-energy">⚡${Math.round(info.intoStage)}/${info.need}</span>`;
  bindPokeImages(badge);
}

/* ---------- 渲染题目 ---------- */
function renderQuestion(){
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
  } else if(q.speak){
    h+=`<button class="speak-btn" id="speakBtn">🔊 Listen</button>`;
  }

  if(q.type==='choice'){
    h+=`<div class="option-grid" id="optGrid">`;
    q.options.forEach(o=>{ h+=`<button class="option-btn" data-v="${o}">${o}</button>`; });
    h+=`</div>`;
  } else if(q.type==='type'){
    h+=`<div class="type-area">
      <input class="type-input" id="typeInput" inputmode="text" autocomplete="off" />
      <div><button class="check-btn" id="checkBtn">Check ✓</button></div>
    </div>`;
  } else if(q.type==='build'){
    h+=`<div class="build-answer" id="buildAnswer"></div>
      <div class="build-pool" id="buildPool"></div>`;
  }
  area.innerHTML=h;

  if(q.type==='passage'){
    $('#passageNext').onclick=()=>nextQuestion();
    if(q.speak) $('#speakBtn').onclick=()=>speak(q.speak.text,q.speak.lang);
    if(q.speak) setTimeout(()=>speak(q.speak.text,q.speak.lang), 500);
  } else if(q.speak){
    $('#speakBtn').onclick=()=>speak(q.speak.text,q.speak.lang);
  }

  if(q.type==='choice') bindChoice(q,item);
  else if(q.type==='type') bindType(q,item);
  else if(q.type==='build') bindBuild(q,item);
}

/* ---------- 选择题 ---------- */
function bindChoice(q,item){
  let answered=false;
  $$('#optGrid .option-btn').forEach(btn=>{
    btn.onclick=()=>{
      if(answered) return; answered=true;
      const val=btn.dataset.v;
      const correct = val===q.answer;
      $$('#optGrid .option-btn').forEach(b=>{
        b.disabled=true;
        if(b.dataset.v===q.answer) b.classList.add('correct');
      });
      if(correct){
        btn.classList.add('correct'); state.correct++; onCorrect(item);
        showFeedback(true,q.explain,true);
      }else{
        btn.classList.add('wrong');
        showFeedback(false, q.explain, false, ()=>recordWrong(item,val,q));
      }
    };
  });
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
      $('#checkBtn').disabled=true; input.disabled=true; hideKeyboard();
      showFeedback(true,q.explain,true);
    }else{
      input.disabled=true; hideKeyboard();
      showFeedback(false,`Spell it: ${q.answer}`,false,()=>recordWrong(item,val,q));
    }
  };
}

/* ---------- 句子建构题 ---------- */
function bindBuild(q,item){
  const pool=$('#buildPool'); const answer=$('#buildAnswer');
  let chosen=[];
  const render=()=>{
    pool.innerHTML='';
    q.tiles.filter(t=>!chosen.includes(t)).forEach(t=>{
      const b=document.createElement('button'); b.className='tile'; b.textContent=t;
      b.onclick=()=>{ chosen.push(t); render(); };
      pool.appendChild(b);
    });
    answer.innerHTML='';
    chosen.forEach((t,i)=>{
      const b=document.createElement('button'); b.className='tile'; b.textContent=t;
      b.onclick=()=>{ chosen.splice(i,1); render(); };
      answer.appendChild(b);
    });
    if(!answer.querySelector('.check-build')){
      const c=document.createElement('button'); c.className='check-btn check-build'; c.textContent='Check ✓';
      c.onclick=()=>{
        const joined=chosen.join(' ');
        const correct = joined===q.answer;
        if(correct){
          state.correct++; onCorrect(item); c.disabled=true;
          showFeedback(true,'Great! Sentence complete!',true);
        }else{
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
function showFeedback(good,explain,autoNext,onWrong,stay){
  const fb=$('#feedback');
  fb.className='feedback '+(good?'good':'bad');
  fb.innerHTML = (good?'🎉 Awesome!':'💡 Try again') + (explain?`<br><span style="font-size:15px">${explain}</span>`:'');
  if(good && autoNext){
    setTimeout(nextQuestion, 950);
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
  const before=Store.stageInfo(state.selectedPokemon).stage;
  Store.markLesson(state.subject,state.lessonId);
  Store.addEnergy(state.selectedPokemon,ENERGY_PER_LESSON);
  // 统计（仅计有答案的题，排除朗读 passage）
  const graded=state.questions.filter(x=>x.q.type!=='passage').length;
  Store.recordAttempt(state.subject, state.correct, graded);
  const after=Store.stageInfo(state.selectedPokemon);
  updateCompanion();
  flashSaved();
  if(after.stage>before){
    showEvolve(state.selectedPokemon,after.stage);
  }else{
    showResult();
  }
}

function showEvolve(id,stage){
  const pk=POKEMON.find(p=>p.id===id);
  const st=pk.stages[stage];
  const prev=pk.stages[stage-1];
  $('#evolveTitle').textContent=`${pk.name} evolved!`;
  $('#evolveStage').innerHTML=`${pokeImgTag(prev,'evo-img')} ➜ ${pokeImgTag(st,'evo-img')}
    <br><b>${prev.name} → ${st.name}</b>`;
  $('#evolveModal').classList.remove('hidden');
  bindPokeImages($('#evolveStage'));
}

function showResult(){
  const graded=state.questions.filter(x=>x.q.type!=='passage').length;
  const score=state.correct, total=graded;
  const pct= total? Math.round(score/total*100) : 100;
  const msg = pct===100?'Perfect! All correct!':pct>=70?'Great job! Keep it up!':'Practice makes perfect!';
  const info=Store.stageInfo(state.selectedPokemon);
  const st=info.pk.stages[info.stage];
  $('#progressFill').style.width='100%';
  $('#resultArea').innerHTML=`
    <h2>🎉 Lesson Complete!</h2>
    <div class="result-score">${score}/${total}</div>
    <div class="result-msg">${msg}</div>
    <div class="result-poke">${pokeImgTag(st,'result-img')}</div>
    <div class="result-msg">${st.name} gained ⚡${ENERGY_PER_LESSON} energy<br>
      ${info.maxed?'Already at final form!':'Energy '+Math.round(info.intoStage)+'/'+info.need+' — almost evolving!'}</div>
    <div class="result-actions">
      <button class="btn-primary" id="moreBtn">More questions 🔄</button>
      <button class="btn-secondary" id="againBtn">Another lesson</button>
      <button class="btn-secondary" id="mistakeBtn2">Mistake book</button>
      <button class="btn-secondary" id="homeBtn2">Home</button>
    </div>`;
  show('screen-result');
  bindPokeImages($('#resultArea'));
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
      <button class="btn-secondary" id="parentHomeBtn">← Back to Home</button>
      <button class="btn-danger" id="resetBtn">Reset all data</button>
    </div>`;

  $('#parentHomeBtn').onclick=()=>show('screen-home');
  $('#resetBtn').onclick=()=>{
    if(confirm('Reset ALL progress (Pokémon, mistakes, stats)? This cannot be undone.')){
      Store.resetAll();
      renderParent();
    }
  };
}

/* ---------- 启动 ---------- */
show('screen-home');
