/* =========================================================
   存档层：所有进度存于 localStorage
   save = {
     pokemon: { id: {energy} },          // 每个宝可梦能量
     lessonDone: { subjectId+lessonId: true },
     mistakes: [ {subject, lessonId, q, userAnswer, ts, session} ],
     attempts: [ {date, subject, correct, total} ],   // 家长端统计
     lastSession: number,                // 上一次会话ID
     currentSession: number              // 本次会话ID
   }
   ========================================================= */
const SAVE_KEY = 'pokeLearnSave_v1';

/* 探测 localStorage 是否可用（file:// 下 iOS Safari 经常不可用） */
function testStorage(){
  try{
    const k='__pl_probe__';
    localStorage.setItem(k,'1'); localStorage.removeItem(k);
    return true;
  }catch(e){ return false; }
}

function todayStr(){
  const d=new Date();
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}

const Store = {
  data:null, available:true, lastSaved:null,
  load(){
    this.available = testStorage();
    try{ this.data = JSON.parse(localStorage.getItem(SAVE_KEY)) || null; }catch(e){ this.data=null; }
    if(!this.data) this.data = this.fresh();
    // 保证结构完整
    this.data.pokemon = this.data.pokemon || {};
    this.data.lessonDone = this.data.lessonDone || {};
    this.data.mistakes = this.data.mistakes || [];
    this.data.attempts = this.data.attempts || [];
    this.data.settings = this.sanitizeSettings(this.data.settings);
    this.data.currentSession = this.data.currentSession || Date.now();
    return this.data;
  },
  sanitizeSettings(s){
    s = s && typeof s==='object' ? s : {};
    return { autoread: s.autoread!==false, sound: s.sound!==false };
  },
  /* 导入存档前的结构校验与修补（导入文件可能是旧版/手工编辑过） */
  sanitize(d){
    if(!d || typeof d!=='object') return null;
    const p={}; POKEMON.forEach(pk=>p[pk.id]={energy: Math.max(0, Number(d.pokemon&&d.pokemon[pk.id]&&d.pokemon[pk.id].energy)||0)});
    return {
      pokemon: p,
      lessonDone: (d.lessonDone && typeof d.lessonDone==='object') ? d.lessonDone : {},
      mistakes: Array.isArray(d.mistakes) ? d.mistakes.filter(m=>m && m.q && m.subject) : [],
      attempts: Array.isArray(d.attempts) ? d.attempts.filter(a=>a && a.date) : [],
      settings: this.sanitizeSettings(d.settings),
      lastSession: d.lastSession||null,
      currentSession: d.currentSession||Date.now()
    };
  },
  fresh(){
    const p={}; POKEMON.forEach(pk=>p[pk.id]={energy:0});
    return { pokemon:p, lessonDone:{}, mistakes:[], attempts:[],
             settings:{ autoread:true, sound:true }, lastSession:null, currentSession:Date.now() };
  },
  save(){
    try{
      localStorage.setItem(SAVE_KEY, JSON.stringify(this.data));
      this.lastSaved = Date.now(); this.available = true;
      if(typeof window!=='undefined' && window.__onSaved) window.__onSaved(true, this.lastSaved);
    }catch(e){
      this.available = false;
      if(typeof window!=='undefined' && window.__onSaved) window.__onSaved(false, null);
    }
  },

  // 宝可梦能量与进化
  getEnergy(id){ return (this.data.pokemon[id]||{energy:0}).energy || 0; },
  addEnergy(id,amt){
    if(!this.data.pokemon[id]) this.data.pokemon[id]={energy:0};
    this.data.pokemon[id].energy += amt;
    this.save();
  },
  // 计算阶段与到下阶进度
  stageInfo(id){
    const pk = POKEMON.find(p=>p.id===id);
    const energy = this.getEnergy(id);
    let stage = Math.floor(energy / ENERGY_PER_STAGE);
    if(stage > pk.stages.length-1) stage = pk.stages.length-1;
    const intoStage = energy - stage*ENERGY_PER_STAGE;
    const justEvolved = stage>0 && intoStage < ENERGY_PER_LESSON; // 刚跨过门槛
    return { pk, stage, intoStage, need:ENERGY_PER_STAGE,
             progress: intoStage/ENERGY_PER_STAGE, justEvolved,
             maxed: stage===pk.stages.length-1 && intoStage>=ENERGY_PER_STAGE };
  },

  markLesson(subject,lessonId){
    this.data.lessonDone[subject+':'+lessonId]=true; this.save();
  },
  isLessonDone(subject,lessonId){
    return !!this.data.lessonDone[subject+':'+lessonId];
  },

  // 错题
  addMistake(subject,lessonId,q,userAnswer){
    this.data.mistakes.push({subject,lessonId,q,userAnswer,ts:Date.now(),session:this.data.currentSession});
    this.save();
  },
  removeMistake(m){
    this.data.mistakes = this.data.mistakes.filter(x=>x!==m);
    this.save();
  },
  // 上一节课（上一会话）的错题，用于课前复习
  lastSessionMistakes(){
    const ls=this.data.lastSession;
    if(!ls) return [];
    return this.data.mistakes.filter(m=>m.session===ls);
  },
  mistakesBySubject(subject){
    return this.data.mistakes.filter(m=>m.subject===subject);
  },
  allMistakes(){ return this.data.mistakes; },

  // 会话切换：开新会话时把当前设为 last
  rotateSession(){
    this.data.lastSession = this.data.currentSession;
    this.data.currentSession = Date.now();
    this.save();
  },

  /* ---------------- 家长端统计 ---------------- */
  recordAttempt(subject, correct, total){
    this.data.attempts.push({ date: todayStr(), subject, correct, total });
    this.save();
  },
  // 最近 days 天，每日正确率与题量
  dailyStats(days){
    days = days || 14;
    const map={};
    this.data.attempts.forEach(a=>{
      const r=map[a.date]||(map[a.date]={correct:0,total:0});
      r.correct+=a.correct; r.total+=a.total;
    });
    const out=[]; const today=new Date();
    for(let i=days-1;i>=0;i--){
      const d=new Date(today); d.setDate(today.getDate()-i);
      const y=d.getFullYear(), m=String(d.getMonth()+1).padStart(2,'0'), day=String(d.getDate()).padStart(2,'0');
      const k=y+'-'+m+'-'+day;
      const rec=map[k];
      out.push({ date:k, correct:rec?rec.correct:0, total:rec?rec.total:0,
        accuracy: rec&&rec.total ? Math.round(rec.correct/rec.total*100) : 0, has:!!rec });
    }
    return out;
  },
  // 各科目当前错题数（趋势）
  mistakeTrends(){
    const map={};
    this.data.mistakes.forEach(m=>{ map[m.subject]=(map[m.subject]||0)+1; });
    return Object.keys(CURRICULUM).map(k=>({ subject:k, label:CURRICULUM[k].label, count:map[k]||0 }));
  },
  // 总览
  overallStats(){
    const totalQ=this.data.attempts.reduce((s,a)=>s+a.total,0);
    const totalC=this.data.attempts.reduce((s,a)=>s+a.correct,0);
    const lessons=Object.keys(this.data.lessonDone).length;
    return { totalQ, totalC,
      accuracy: totalQ ? Math.round(totalC/totalQ*100) : 0,
      lessons, mistakes:this.data.mistakes.length };
  },
  // 家长端：清空所有数据（谨慎）
  resetAll(){
    const settings=this.data.settings;
    this.data = this.fresh();
    this.data.settings = settings || this.data.settings;
    this.save();
  },
  // 家长端：导出存档为可下载的 JSON（换设备 / 备份）
  exportSave(){
    return JSON.stringify(this.data, null, 2);
  },
  // 家长端：从 JSON 文本恢复存档，成功返回 true
  importSave(text){
    let d=null;
    try{ d=JSON.parse(text); }catch(e){ return false; }
    const clean=this.sanitize(d);
    if(!clean) return false;
    this.data=clean;
    this.save();
    return true;
  },
  // 设置项
  getSetting(k){ return this.data.settings ? this.data.settings[k]!==false : true; },
  setSetting(k,v){ this.data.settings[k]=v; this.save(); }
};
