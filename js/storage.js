/* =========================================================
   存档层 v3：所有进度存于 localStorage
   save = {
     schema: 3,
     pokemon: { id: {energy, stage, branch} },  // stage 显式记录，一课最多升一阶
     lessonDone, mistakes, attempts, settings, lastSession, currentSession
   }
   旧存档（只有 energy）会在 load() 时自动迁移，学习统计/错题保留，
   进化进度从第一阶重新累计（修掉旧版一次性跳到最终形态的问题）。
   ========================================================= */
const SAVE_KEY = 'pokeLearnSave_v1';   // 保持原 key，做原地迁移，不丢历史数据

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
    this.data.lessonDone = this.data.lessonDone || {};
    this.data.mistakes   = this.data.mistakes   || [];
    this.data.attempts   = this.data.attempts   || [];
    this.data.books      = (this.data.books && typeof this.data.books==='object') ? this.data.books : {};
    this.data.settings   = this.sanitizeSettings(this.data.settings);
    this.data.currentSession = this.data.currentSession || Date.now();

    // ---- 迁移：把旧的 {energy} 升级成 {energy, stage, branch} ----
    const old = this.data.pokemon || {};
    const p = {};
    POKEMON.forEach(pk=>{
      const o = old[pk.id];
      if(!o || typeof o!=='object'){ p[pk.id]=this.freshMon(); return; }
      if(typeof o.stage==='number'){
        p[pk.id]={ energy: Math.max(0,Number(o.energy)||0),
                   stage: Math.max(0,Math.min(o.stage, pk.stages.length-1)),
                   branch: Number.isInteger(o.branch) ? o.branch : null };
      }else{
        // 旧版：阶段由总能量推算，可能已经跳级 → 归零重新逐级累计
        p[pk.id]={ energy: Math.min(Math.max(0,Number(o.energy)||0), ENERGY_PER_STAGE-1),
                   stage:0, branch:null };
      }
    });
    this.data.pokemon = p;
    this.data.schema = 3;
    return this.data;
  },
  freshMon(){ return { energy:0, stage:0, branch:null }; },
  sanitizeSettings(s){
    s = s && typeof s==='object' ? s : {};
    return { autoread: s.autoread!==false, sound: s.sound!==false,
             zhread: s.zhread!==false, mic: s.mic!==false };
  },
  /* 导入存档前的结构校验与修补 */
  sanitize(d){
    if(!d || typeof d!=='object') return null;
    const src=d.pokemon||{}, p={};
    POKEMON.forEach(pk=>{
      const o=src[pk.id];
      p[pk.id] = (o && typeof o==='object')
        ? { energy:Math.max(0,Number(o.energy)||0),
            stage:Math.max(0,Math.min(Number(o.stage)||0, pk.stages.length-1)),
            branch:Number.isInteger(o.branch)?o.branch:null }
        : this.freshMon();
    });
    return {
      schema:3, pokemon:p,
      lessonDone: (d.lessonDone && typeof d.lessonDone==='object') ? d.lessonDone : {},
      mistakes: Array.isArray(d.mistakes) ? d.mistakes.filter(m=>m && m.q && m.subject) : [],
      attempts: Array.isArray(d.attempts) ? d.attempts.filter(a=>a && a.date) : [],
      books: this.sanitizeBooks(d.books),
      settings: this.sanitizeSettings(d.settings),
      lastSession: d.lastSession||null,
      currentSession: d.currentSession||Date.now()
    };
  },
  sanitizeBooks(b){
    const out={};
    if(!b || typeof b!=='object') return out;
    Object.keys(b).forEach(id=>{
      const r=b[id];
      if(!r || typeof r!=='object') return;
      out[id]={ read: !!r.read,
                times: Math.max(0, Number(r.times)||0),
                page: Math.max(0, Number(r.page)||0),
                pages: Math.max(0, Number(r.pages)||0),
                last: typeof r.last==='string' ? r.last : '',
                totalPages: Math.max(0, Number(r.totalPages)||0) };
    });
    return out;
  },
  fresh(){
    const p={}; POKEMON.forEach(pk=>p[pk.id]=this.freshMon());
    return { schema:3, pokemon:p, lessonDone:{}, mistakes:[], attempts:[], books:{},
             settings:{ autoread:true, sound:true, zhread:true, mic:true },
             lastSession:null, currentSession:Date.now() };
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

  /* ---------------- 宝可梦能量与进化 ---------------- */
  ensureMon(id){
    if(!this.data.pokemon[id]) this.data.pokemon[id]=this.freshMon();
    return this.data.pokemon[id];
  },
  maxStage(id){
    const pk=POKEMON.find(p=>p.id===id);
    return pk ? pk.stages.length-1 : 0;
  },
  getEnergy(id){ return this.ensureMon(id).energy||0; },

  /* 加能量。返回 {evolved, from, to, needsBranch}
   * 关键：无论一次加多少能量，最多只升 1 阶，绝不跳级。 */
  addEnergy(id,amt){
    const m=this.ensureMon(id);
    const max=this.maxStage(id);
    const from=m.stage;
    let evolved=false, needsBranch=false;
    if(m.stage>=max){
      m.energy=0;                     // 已满级，能量条固定为 MAX
    }else{
      m.energy += amt;
      if(m.energy >= ENERGY_PER_STAGE){
        m.energy = Math.max(0, m.energy - ENERGY_PER_STAGE);
        m.stage  = Math.min(m.stage+1, max);   // ← 一次只 +1
        m.branch = null;
        evolved  = true;
        needsBranch = isBranchStage(POKEMON.find(p=>p.id===id), m.stage);
      }
    }
    this.save();
    return { evolved, from, to:m.stage, needsBranch };
  },
  /* 选择分支进化形态（伊布等） */
  setBranch(id,idx){
    const m=this.ensureMon(id);
    const pk=POKEMON.find(p=>p.id===id);
    if(!pk || !isBranchStage(pk,m.stage)) return false;
    const opts=branchOptions(pk,m.stage);
    m.branch=Math.max(0,Math.min(idx,opts.length-1));
    this.save();
    return true;
  },
  stageInfo(id){
    const pk=POKEMON.find(p=>p.id===id) || POKEMON[0];
    const m=this.ensureMon(id);
    const stage=Math.max(0,Math.min(m.stage, pk.stages.length-1));
    const branch=m.branch;
    const maxed = stage===pk.stages.length-1;
    const intoStage = maxed ? ENERGY_PER_STAGE : m.energy;
    return { pk, stage, branch, form:formOf(pk,stage,branch),
             intoStage, need:ENERGY_PER_STAGE, maxed,
             progress: maxed ? 1 : m.energy/ENERGY_PER_STAGE,
             isBranch:isBranchStage(pk,stage) };
  },

  markLesson(subject,lessonId){
    this.data.lessonDone[subject+':'+lessonId]=true; this.save();
  },
  isLessonDone(subject,lessonId){
    return !!this.data.lessonDone[subject+':'+lessonId];
  },

  /* ---------------- 绘本阅读记录 ----------------
     books = { bookId: {read, times, page, pages, last, totalPages} }
     read    : 是否读完过（书架上的"已读"标记）
     times   : 读完次数（重复读会累加，用于星星）
     page    : 上次读到第几页（0 基），下次继续读
     last    : 最后一次阅读日期 YYYY-MM-DD                     */
  bookRec(id){ return this.data.books[id] || null; },
  isBookRead(id){ const r=this.data.books[id]; return !!(r && r.read); },
  bookPage(id){ const r=this.data.books[id]; return r ? (r.page||0) : 0; },
  bookTimes(id){ const r=this.data.books[id]; return r ? (r.times||0) : 0; },

  /* 翻页时记录进度（不标记已读） */
  touchBook(id, page, totalPages){
    const r=this.data.books[id] || (this.data.books[id]={read:false,times:0,page:0,pages:0,last:'',totalPages:0});
    r.page = Math.max(0, page|0);
    if(totalPages) r.pages = totalPages;
    r.last = todayStr();
    this.save();
  },
  /* 读完一本：点亮已读 + 累加次数 + 页数统计 */
  markBookRead(id, totalPages){
    const r=this.data.books[id] || (this.data.books[id]={read:false,times:0,page:0,pages:0,last:'',totalPages:0});
    if(!r.read) r.read = true;
    r.times = (r.times||0) + 1;
    r.last = todayStr();
    if(totalPages){
      r.pages = totalPages;
      r.totalPages = Math.max(r.totalPages||0, totalPages);
    }
    this.save();
    return r;
  },
  unmarkBookRead(id){
    const r=this.data.books[id]; if(!r) return;
    r.read=false; r.times=0; this.save();
  },
  /* 阅读统计：按语言 / 级别汇总，以及最近读过的书 */
  bookStats(allBooks){
    const recs=this.data.books||{};
    const list=(allBooks||[]).filter(b=>recs[b.id] && recs[b.id].read);
    const byLang={}, byLevel={};
    list.forEach(b=>{
      byLang[b.lang]=(byLang[b.lang]||0)+1;
      byLevel[b.level]=(byLevel[b.level]||0)+1;
    });
    const finishes=list.reduce((n,b)=>n+(recs[b.id].times||0),0);
    const pages=list.reduce((n,b)=>n+(recs[b.id].pages||b.pages.length),0);
    const recent=list.filter(b=>recs[b.id].last)
      .sort((a,b)=>(recs[b.id].last||'').localeCompare(recs[a.id].last||''));
    // 最近 7 天读完的
    const days=[]; const today=new Date();
    for(let i=0;i<7;i++){
      const d=new Date(today); d.setDate(today.getDate()-i);
      days.push(d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'));
    }
    const week=list.filter(b=>days.includes(recs[b.id].last)).length;
    const inProgress=Object.keys(recs).filter(id=>!recs[id].read && recs[id].page>0).length;
    return { read:list.length, byLang, byLevel, finishes, pages, week, inProgress, recent, recs };
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
  lastSessionMistakes(){
    const ls=this.data.lastSession;
    if(!ls) return [];
    return this.data.mistakes.filter(m=>m.session===ls);
  },
  mistakesBySubject(subject){
    return this.data.mistakes.filter(m=>m.subject===subject);
  },
  allMistakes(){ return this.data.mistakes; },

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
  mistakeTrends(){
    const map={};
    this.data.mistakes.forEach(m=>{ map[m.subject]=(map[m.subject]||0)+1; });
    return Object.keys(CURRICULUM).map(k=>({ subject:k, label:CURRICULUM[k].label, count:map[k]||0 }));
  },
  overallStats(){
    const totalQ=this.data.attempts.reduce((s,a)=>s+a.total,0);
    const totalC=this.data.attempts.reduce((s,a)=>s+a.correct,0);
    const lessons=Object.keys(this.data.lessonDone).length;
    return { totalQ, totalC,
      accuracy: totalQ ? Math.round(totalC/totalQ*100) : 0,
      lessons, mistakes:this.data.mistakes.length };
  },
  resetAll(){
    const settings=this.data.settings;
    this.data = this.fresh();
    this.data.settings = settings || this.data.settings;
    this.save();
  },
  exportSave(){ return JSON.stringify(this.data, null, 2); },
  importSave(text){
    let d=null;
    try{ d=JSON.parse(text); }catch(e){ return false; }
    const clean=this.sanitize(d);
    if(!clean) return false;
    this.data=clean;
    this.save();
    return true;
  },
  getSetting(k){ return this.data.settings ? this.data.settings[k]!==false : true; },
  setSetting(k,v){ this.data.settings[k]=v; this.save(); }
};
