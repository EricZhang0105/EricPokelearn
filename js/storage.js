/* =========================================================
   存档层 v4：所有进度存于 localStorage
   save = {
     schema: 6,
     pokemon: { id: {energy, stage, branch, deadUntil} },  // stage 显式记录；deadUntil=昏睡到哪天
     lessonDone, mistakes, attempts, settings, lastSession, currentSession,
     readDone: { 'rp-cat#1': 时间戳 }   // 阅读理解里已经答对过的题，不再重复出现
   }
   每答对一题 +2 能量、答错 −2；每阶 100 点。
   能量扣到负数：已进化的退化一阶（负余额结转）；未进化过的直接昏倒（死亡），
   deadUntil 记到第二天，到点自动复活（0 能量、第 1 阶）。
   旧存档（schema 3，60 点/阶）会在 load() 时自动按比例折算能量，学习统计/错题保留。
   ========================================================= */
const SAVE_KEY = 'pokeLearnSave_v1';   // 保持原 key，做原地迁移，不丢历史数据
const OLD_ENERGY_PER_STAGE = 60;       // v3 存档的每阶能量，用于折算到 v4（100 点/阶）

/* ---------- 跨版本进度存档 ----------
 * 主存档（SAVE_KEY）会被版本升级时的 schema 迁移动到；这两份"保险"不会：
 *   ARCHIVE_KEY    : 首页「💾 保存进度」按钮写的存档（家长/小朋友主动存）
 *   AUTOBACKUP_KEY : 自动备份，只在进度创出新高时更新，永远保留最高进度
 * 两份存档都用「阶段 stage + 百分比 pct」记录，不依赖每阶多少能量，
 * 所以以后把 100 改成别的数字、或者加新宝可梦，都能按比例接回原来的进度。 */
const ARCHIVE_KEY    = 'pokeLearnProgressArchive_v1';
const AUTOBACKUP_KEY = 'pokeLearnProgressBackup_v1';
const ARCHIVE_VERSION = 1;

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
    let raw=null;
    try{ raw = localStorage.getItem(SAVE_KEY); }catch(e){ raw=null; }
    try{ this.data = raw ? JSON.parse(raw) : null; }catch(e){ this.data=null; }
    if(!this.data && raw){
      // 存档损坏：先把原始字符串另存一份，别让下一次 save() 直接把它冲掉
      try{ localStorage.setItem(SAVE_KEY+'_corrupt_'+Date.now(), raw); }catch(e){}
    }
    if(!this.data) this.data = this.fresh();
    const prevSchema = Number(this.data.schema)||0;
    this.data.lessonDone = this.data.lessonDone || {};
    this.data.mistakes   = this.data.mistakes   || [];
    this.data.attempts   = this.data.attempts   || [];
    this.data.books      = (this.data.books && typeof this.data.books==='object') ? this.data.books : {};
    this.data.readDone   = (this.data.readDone && typeof this.data.readDone==='object') ? this.data.readDone : {};
    this.data.settings   = this.sanitizeSettings(this.data.settings);
    this.data.currentSession = this.data.currentSession || Date.now();

    // ---- 迁移：把旧的 {energy} 升级成 {energy, stage, branch} ----
    const old = this.data.pokemon || {};
    const p = {};
    POKEMON.forEach(pk=>{
      const o = old[pk.id];
      if(!o || typeof o!=='object'){ p[pk.id]=this.freshMon(); return; }
      // stage 可能被存成字符串（旧存档/手改），先转数字再判断，别一看到不是 number 就归零
      const stRaw = (o.stage===null || o.stage===undefined || o.stage==='') ? null : Number(o.stage);
      if(stRaw!==null && isFinite(stRaw)){
        p[pk.id]={ energy: Math.max(0, Math.min(ENERGY_PER_STAGE-1, Number(o.energy)||0)),
                   stage: Math.max(0, Math.min(Math.round(stRaw), pk.stages.length-1)),
                   branch: Number.isInteger(o.branch) ? o.branch : null,
                   deadUntil: (typeof o.deadUntil==='string' && o.deadUntil) ? o.deadUntil : null };
      }else{
        // 更旧的版本：阶段由总能量推算，可能已经跳级 → 归零重新逐级累计
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
    this.data.schema = 6;
    // 版本升级 / 缓存被清后主存档变空时，自动接回进度存档，不用重头再来
    this.migrateGuard();
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
      schema:6, pokemon:p,
      lessonDone: (d.lessonDone && typeof d.lessonDone==='object') ? d.lessonDone : {},
      mistakes: Array.isArray(d.mistakes) ? d.mistakes.filter(m=>m && m.q && m.subject) : [],
      attempts: Array.isArray(d.attempts) ? d.attempts.filter(a=>a && a.date) : [],
      books: this.sanitizeBooks(d.books),
      readDone: this.sanitizeReadDone(d.readDone),
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
  sanitizeReadDone(m){
    const out={};
    if(!m || typeof m!=='object') return out;
    Object.keys(m).forEach(k=>{
      if(typeof k!=='string' || !k) return;
      out[k]= Math.max(0, Number(m[k])||1);
    });
    return out;
  },
  fresh(){
    const p={}; POKEMON.forEach(pk=>p[pk.id]=this.freshMon());
    return { schema:6, pokemon:p, lessonDone:{}, mistakes:[], attempts:[], books:{}, readDone:{},
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
    // 顺手维护自动备份（进度创新高才写，且 6 秒内最多写一次，不拖慢答题）
    this.autoArchive();
  },

  /* ---------------- 跨版本进度存档 ----------------
   * 存的不是"当前能量"，而是每个宝可梦的 阶段 + 进度百分比 + 形态，
   * 所以以后改每阶所需能量、加新宝可梦、改 schema，都不会把进度清零。 */
  buildArchive(){
    const pokemon={};
    let stages=0, evolved=0;
    Object.keys(this.data.pokemon||{}).forEach(id=>{
      const m=this.data.pokemon[id]||{};
      const stage=Math.max(0, Number(m.stage)||0);
      pokemon[id]={ stage,
                    pct: Math.max(0, Math.min(1, (Number(m.energy)||0)/ENERGY_PER_STAGE)),
                    energy: Math.max(0, Number(m.energy)||0),
                    branch: Number.isInteger(m.branch) ? m.branch : null,
                    deadUntil: m.deadUntil || null };
      stages+=stage; if(stage>0) evolved++;
    });
    return { v:ARCHIVE_VERSION, savedAt:Date.now(), perStage:ENERGY_PER_STAGE,
             stages, evolved, pokemon,
             lessonDone: this.data.lessonDone||{}, books: this.data.books||{},
             readDone: this.data.readDone||{} };
  },
  readArchive(key){
    if(!this.available) return null;
    try{
      const a=JSON.parse(localStorage.getItem(key)||'null');
      if(!a || typeof a!=='object' || !a.pokemon || typeof a.pokemon!=='object') return null;
      return a;
    }catch(e){ return null; }
  },
  writeArchive(key){
    if(!this.available) return null;
    const a=this.buildArchive();
    try{ localStorage.setItem(key, JSON.stringify(a)); }catch(e){ return null; }
    return a;
  },
  /* 存档"进度分数"：阶段权重远大于能量，用来判断哪份存档更靠前 */
  scoreOf(a){
    if(!a || !a.pokemon) return -1;
    let s=0;
    Object.keys(a.pokemon).forEach(id=>{
      const m=a.pokemon[id]||{};
      s += (Number(m.stage)||0)*1000 + (Number(m.energy)||0);
    });
    // 阅读答对的题也算进度：只读绘本/做阅读、还没进化过的孩子，进度同样不会被清掉
    s += Object.keys(a.readDone||{}).length;
    return s;
  },
  saveArchive(){ return this.writeArchive(ARCHIVE_KEY); },      // 首页按钮：手动存档
  manualArchive(){ return this.readArchive(ARCHIVE_KEY); },
  backupArchive(){ return this.readArchive(AUTOBACKUP_KEY); },
  autoArchive(force){
    if(!this.available || !this.data) return null;
    const cur=this.scoreOf(this.buildArchive());
    if(cur<=0) return null;                                     // 全新存档不占用备份
    const prev=this.readArchive(AUTOBACKUP_KEY);
    if(prev && this.scoreOf(prev) >= cur) return null;           // 没超过历史最高，保留原备份
    const now=Date.now();
    if(!force && now-(this._autoAt||0) < 6000) return null;
    this._autoAt=now;
    return this.writeArchive(AUTOBACKUP_KEY);
  },
  /* 把一份存档接回主存档：阶段取较高的、能量取较高的，课程/绘本记录取并集 */
  applyArchive(a){
    if(!a || !a.pokemon) return null;
    const perOld=Number(a.perStage)||ENERGY_PER_STAGE;
    let upgraded=0, evolved=0, stages=0;
    Object.keys(a.pokemon).forEach(id=>{
      if(!POKEMON.find(p=>p.id===id)) return;
      const s=a.pokemon[id]||{}, max=this.maxStage(id);
      const stage=Math.max(0, Math.min(Number(s.stage)||0, max));
      let energy = (s.pct!==null && s.pct!==undefined)
        ? Math.round(Number(s.pct)*ENERGY_PER_STAGE)                 // 能量体系变了也能按比例接回
        : Math.round((Number(s.energy)||0)*ENERGY_PER_STAGE/perOld);
      energy=Math.max(0, Math.min(ENERGY_PER_STAGE-1, energy));
      if(stage>=max) energy=Math.min(energy, ENERGY_PER_STAGE-1);
      const cur=this.data.pokemon[id] || this.freshMon();
      if(stage>cur.stage || (stage===cur.stage && energy>cur.energy)){
        this.data.pokemon[id]={ stage, energy,
          branch: Number.isInteger(s.branch) ? s.branch : (cur.branch||null),
          deadUntil: s.deadUntil || null };
        upgraded++;
      }
      if(stage>0) evolved++;
      stages+=Math.max(cur.stage||0, stage);
    });
    const ld=a.lessonDone||{};
    Object.keys(ld).forEach(k=>{ if(ld[k]) this.data.lessonDone[k]=true; });
    const rd=a.readDone||{};
    Object.keys(rd).forEach(k=>{
      if(!this.data.readDone[k]) this.data.readDone[k]=Number(rd[k])||1;
    });
    const bk=a.books||{};
    Object.keys(bk).forEach(id=>{
      const r=bk[id]; if(!r || typeof r!=='object') return;
      const cur=this.data.books[id];
      if(!cur || (r.read && !cur.read) || (r.times||0)>(cur.times||0)){
        this.data.books[id]=this.sanitizeBooks({[id]:r})[id];
      }
    });
    this.save();
    return { upgraded, evolved, stages, savedAt:a.savedAt||null };
  },
  /* 启动守卫：如果主存档被版本升级/清缓存冲成空白，自动用最好的那份存档接回来 */
  migrateGuard(){
    if(!this.available || !this.data) return null;
    const ld=this.data.lessonDone||{};
    const anyLesson=Object.keys(ld).length>0;
    const p=this.data.pokemon||{};
    const anyMon=Object.keys(p).some(id=>((p[id].stage||0)>0 || (p[id].energy||0)>0));
    if(anyLesson || anyMon){ this.autoArchive(); return null; }    // 进度还在，什么都不用做
    // 主存档是空的 → 找一份有内容的存档（自动备份优先，其次手动存档）
    const backup=this.readArchive(AUTOBACKUP_KEY);
    const manual=this.readArchive(ARCHIVE_KEY);
    const best=(backup && this.scoreOf(backup)>=this.scoreOf(manual)) ? backup : manual;
    if(!best || this.scoreOf(best)<=0) return null;
    const r=this.applyArchive(best);
    if(r){ this.__restored=r; }
    return r;
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

  /* ---------------- 阅读理解：已答对的题不再出现 ----------------
     readDone = { 'rp-cat#1': 时间戳 }，题目用稳定 qid 标识 */
  readDoneIds(){ return (this.data && this.data.readDone) ? Object.keys(this.data.readDone) : []; },
  readDoneCount(){ return this.readDoneIds().length; },
  isReadDone(qid){ return !!(qid && this.data && this.data.readDone && this.data.readDone[qid]); },
  markReadDone(qid, when){
    if(!qid || !this.data) return false;
    if(!this.data.readDone) this.data.readDone={};
    if(this.data.readDone[qid]) return false;      // 已经记过，不重复写
    this.data.readDone[qid] = when || Date.now();
    this.save();
    return true;
  },
  clearReadDone(){
    this.data.readDone={}; this.save();
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
    // 家长端「重置」是有意清空：连进度存档一起清掉，否则下次开机会被自动恢复回来
    try{ localStorage.removeItem(ARCHIVE_KEY); localStorage.removeItem(AUTOBACKUP_KEY); }catch(e){}
    this.data = this.fresh();
    this.data.settings = settings || this.data.settings;
    this._autoAt=0;
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
