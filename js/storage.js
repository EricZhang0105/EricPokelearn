/* =========================================================
   存档层 v4：所有进度存于 localStorage
   save = {
     schema: 5,
     pokemon: { id: {energy, stage, branch, deadUntil} },  // stage 显式记录；deadUntil=昏睡到哪天
     lessonDone, mistakes, attempts, settings, lastSession, currentSession
   }
   每答对一题 +2 能量、答错 −2；每阶 100 点。
   能量扣到负数：已进化的退化一阶（负余额结转）；未进化过的直接昏倒（死亡），
   deadUntil 记到第二天，到点自动复活（0 能量、第 1 阶）。
   旧存档（schema 3，60 点/阶）会在 load() 时自动按比例折算能量，学习统计/错题保留。
   ========================================================= */
const SAVE_KEY = 'pokeLearnSave_v1';   // 保持原 key，做原地迁移，不丢历史数据
const OLD_ENERGY_PER_STAGE = 60;       // v3 存档的每阶能量，用于折算到 v4（100 点/阶）

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
    const prevSchema = Number(this.data.schema)||0;
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
                   branch: Number.isInteger(o.branch) ? o.branch : null,
                   deadUntil: (typeof o.deadUntil==='string' && o.deadUntil) ? o.deadUntil : null };
      }else{
        // 旧版：阶段由总能量推算，可能已经跳级 → 归零重新逐级累计
        p[pk.id]={ energy: Math.min(Math.max(0,Number(o.energy)||0), ENERGY_PER_STAGE-1),
                   stage:0, branch:null, deadUntil:null };
      }
    });
    this.data.pokemon = p;
    // ---- schema 4：每阶 60 → 100 点，按比例折算已攒能量，进度不倒退 ----
    if(prevSchema < 4){
      Object.keys(p).forEach(id=>{
        const m=p[id];
        if(m && m.stage < this.maxStage(id)){
          m.energy = Math.min(ENERGY_PER_STAGE-1,
            Math.round((Number(m.energy)||0) * ENERGY_PER_STAGE / OLD_ENERGY_PER_STAGE));
        }
      });
    }
    this.data.schema = 5;
    return this.data;
  },
  freshMon(){ return { energy:0, stage:0, branch:null, deadUntil:null }; },
  tomorrowStr(){
    const d=new Date(); d.setDate(d.getDate()+1);
    return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  },
  sanitizeSettings(s){
    s = s && typeof s==='object' ? s : {};
    return { autoread: s.autoread!==false, sound: s.sound!==false,
             zhread: s.zhread!==false, mic: s.mic!==false };
  },
  /* 导入存档前的结构校验与修补 */
  sanitize(d){
    if(!d || typeof d!=='object') return null;
    const src=d.pokemon||{}, p={};
    const prevSchema = Number(d.schema)||0;
    POKEMON.forEach(pk=>{
      const o=src[pk.id];
      p[pk.id] = (o && typeof o==='object')
        ? { energy:Math.min(ENERGY_PER_STAGE-1, Math.max(0,Number(o.energy)||0)),
            stage:Math.max(0,Math.min(Number(o.stage)||0, pk.stages.length-1)),
            branch:Number.isInteger(o.branch)?o.branch:null,
            deadUntil:(typeof o.deadUntil==='string' && o.deadUntil) ? o.deadUntil : null }
        : this.freshMon();
    });
    // 导入的是 v3 存档（60 点/阶）→ 折算成 100 点/阶
    if(prevSchema < 4){
      Object.keys(p).forEach(id=>{
        const m=p[id];
        if(m && m.stage < this.maxStage(id)){
          m.energy = Math.min(ENERGY_PER_STAGE-1,
            Math.round(m.energy * ENERGY_PER_STAGE / OLD_ENERGY_PER_STAGE));
        }
      });
    }
    return {
      schema:5, pokemon:p,
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
    return { schema:5, pokemon:p, lessonDone:{}, mistakes:[], attempts:[], books:{},
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
    const m=this.data.pokemon[id];
    // 昨天昏倒的宝可梦，今天到点自动复活：满血、回到第 1 阶
    if(m.deadUntil && m.deadUntil<=todayStr()){
      m.deadUntil=null; m.energy=0; m.stage=0; m.branch=null;
      this.save();
    }
    return m;
  },
  maxStage(id){
    const pk=POKEMON.find(p=>p.id===id);
    return pk ? pk.stages.length-1 : 0;
  },
  getEnergy(id){ return this.ensureMon(id).energy||0; },

  /* 加/扣能量（答对 +2 / 答错 −2）。
   * 返回 {evolved, devolved, died, from, to}：
   * - 能量攒满 100 → 进化一阶
   * - 能量扣成负数：已进化的退化一阶（负余额结转到上一阶，如 -2 → 98/100）；
   *                 从未进化过（第 1 阶）的直接昏倒，第二天才能再选；
   * - 已是最终形态：免疫（能量恒为 MAX），不会退化也不会昏倒；
   * - 已经昏倒的：本日忽略一切能量变化。 */
  addEnergy(id,amt){
    const m=this.ensureMon(id);
    const res={evolved:false,devolved:false,died:false,from:m.stage,to:m.stage};
    if(m.deadUntil){ this.save(); return res; }        // 昏睡中：不结算
    const max=this.maxStage(id);
    if(m.stage>=max){ m.energy=0; this.save(); return res; }  // 最终形态：MAX，免疫
    res.from=m.stage;
    m.energy += amt;
    if(m.energy >= ENERGY_PER_STAGE){
      m.energy -= ENERGY_PER_STAGE;
      m.stage  = Math.min(m.stage+1, max);
      m.branch = null;
      res.evolved = true;
    }
    if(m.energy < 0){
      if(m.stage>0){                                    // 退化一阶，负余额结转
        m.stage  = m.stage-1;
        m.energy = ENERGY_PER_STAGE + m.energy;         // 例：-2 → 98/100
        m.branch = null;
        res.devolved = true;
      }else{                                            // 从未进化过 → 昏倒
        m.energy=0;
        m.deadUntil = this.tomorrowStr();
        res.died = true;
      }
    }
    res.to=m.stage;
    this.save();
    return res;
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
    const nextStage = Math.min(stage+1, pk.stages.length-1);
    const curOptions  = isBranchStage(pk,stage) ? branchOptions(pk,stage) : null;
    const nextOptions = (!maxed && isBranchStage(pk,nextStage)) ? branchOptions(pk,nextStage) : null;
    return { pk, stage, branch, form:formOf(pk,stage,branch),
             intoStage, need:ENERGY_PER_STAGE, maxed,
             progress: maxed ? 1 : m.energy/ENERGY_PER_STAGE,
             dead: !!m.deadUntil, deadUntil: m.deadUntil||null,
             isBranch:isBranchStage(pk,stage),
             curOptions, nextOptions,
             branchCount:(curOptions||nextOptions||[]).length,
             chainBranch:chainBranchCount(pk) };
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
