/* =========================================================
   BlendCloud — 家长拼读录音的跨设备云同步
   ---------------------------------------------------------
   录音本体仍在 IndexedDB（ParentBlendBank），云端表
   pokelearn_blends（owner-only RLS）按「每音节一行 base64」镜像：
     · 保存录音后自动 pushOne 上传（失败静默，不影响本地使用）
     · 登录后 / 家长手动点「☁️ 同步」时 pull：
       云端有而本机没有（或云端更新）→ 下载写入本机；
       本机比云端新（本机重录过）→ 上传覆盖云端
     · 冲突规则 = ts 新者胜，双向同步，永不倒退
     · 删除录音时同步删云端行
     · 增量去重：本地 ledger 记录每段「已确认同步的 ts」，
       未变化的录音下次同步直接剔除，不重复上传/下载
     · 提速：一次请求批量拉取全部云端行，替代逐段 N+1 查询
   依赖：CloudSync.client()（cloud-sync.js 暴露）、ParentBlendBank。
   未登录 / GitHub Pages / 本地版自动降级为纯本机，不报错。
   ========================================================= */
const BlendCloud = {
  busy:false,
  lastError:'',
  lastSyncAt:0,
  SYNC_LEDGER_KEY:'pokelearn.blend.synced.v1',

  /* ---------- 依赖 ---------- */
  client(){
    try{ return (typeof CloudSync!=='undefined' && CloudSync.client) ? CloudSync.client() : null; }
    catch(e){ return null; }
  },
  _db(){
    const c=this.client();
    return (c && c.cloud && c.cloud.database) ? c.cloud.database : null;
  },
  signedIn(){
    const c=this.client();
    return !!(c && c.session && c.cloud);
  },

  /* ---------- 本地「已同步指纹」ledger ----------
     { syl: 最近一次确认同步到云端的 ts }。ts 变化 = 重新录过 = 需要再同步。
     存 localStorage（体积极小），不可用则退化为「本次会话内」记录。 */
  _ls(){
    try{ return (typeof localStorage!=='undefined') ? localStorage : null; }catch(e){ return null; }
  },
  _ledger(){
    const ls=this._ls(); if(!ls) return this._memLedger||(this._memLedger={});
    try{ return JSON.parse(ls.getItem(this.SYNC_LEDGER_KEY)||'{}')||{}; }catch(e){ return {}; }
  },
  _ledgerGet(syl){ const l=this._ledger(); return l[syl]; },
  _ledgerSet(syl, ts){
    const ls=this._ls();
    if(!ls){ const l=this._ledger(); if(l[syl]!==ts){ l[syl]=ts; } return; }
    try{
      const l=this._ledger();
      if(l[syl]===ts) return;
      l[syl]=ts; ls.setItem(this.SYNC_LEDGER_KEY, JSON.stringify(l));
    }catch(e){}
  },
  _ledgerDel(syl){
    const ls=this._ls();
    if(!ls){ const l=this._ledger(); delete l[syl]; return; }
    try{ const l=this._ledger(); delete l[syl]; ls.setItem(this.SYNC_LEDGER_KEY, JSON.stringify(l)); }catch(e){}
  },
  clearLedger(){
    const ls=this._ls();
    if(ls){ try{ ls.removeItem(this.SYNC_LEDGER_KEY); }catch(e){} }
    this._memLedger={};
  },

  /* ---------- base64 <-> Blob（浏览器与 Node 22 通用） ---------- */
  async blobToB64(blob){
    const buf=new Uint8Array(await blob.arrayBuffer());
    let s='';
    const CH=0x8000;
    for(let i=0;i<buf.length;i+=CH)
      s+=String.fromCharCode.apply(null, buf.subarray(i, Math.min(i+CH, buf.length)));
    return btoa(s);
  },
  b64ToBlob(b64,mime){
    try{
      const bin=atob(b64||'');
      const bytes=new Uint8Array(bin.length);
      for(let i=0;i<bin.length;i++) bytes[i]=bin.charCodeAt(i);
      return new Blob([bytes],{type:mime||'audio/mp4'});
    }catch(e){ return null; }
  },

  /* ---------- 上传一段（knownId 已知时省去一次 select 往返） ---------- */
  async _upsert(syl, m, knownId){
    const db=this._db();
    if(!db || !m) return false;
    let blob;
    try{ blob=await (await fetch(m.url)).blob(); }
    catch(e){ return false; }
    if(!blob || !blob.size) return false;
    const b64=await this.blobToB64(blob);
    const ts=m.ts||Date.now();
    const row={ syl, mime:blob.type||'audio/mp4', dur:m.dur||0, ts, data_b64:b64 };
    let id=knownId;
    if(id===undefined){
      const exist=await db.from('pokelearn_blends').select('id').eq('syl',syl).maybeSingle();
      if(exist.error) return false;
      id=(exist.data && exist.data.id);
    }
    let r;
    if(id){
      r=await db.from('pokelearn_blends')
        .update(Object.assign({}, row, {updated_at:new Date().toISOString()}))
        .eq('syl',syl).select('id');
      if(!r.error && Array.isArray(r.data) && r.data.length===0) return false;
    }else{
      const c=this.client();
      const u=(c && c.session && c.session.user) || {};
      r=await db.from('pokelearn_blends')
        .insert(Object.assign({}, row, {owner_name:u.name||u.email||null})).select('id');
    }
    return !r.error;
  },

  /* ---------- 上传单题（保存录音后调用；已同步且未变化则剔除） ---------- */
  async pushOne(syl){
    const pb=(typeof ParentBlendBank!=='undefined')?ParentBlendBank:null;
    const db=this._db();
    if(!pb || !pb.has(syl) || !db) return {ok:false, reason:'unavailable'};
    const m=pb.meta(syl);
    if(!m) return {ok:false, reason:'unavailable'};
    const ts=m.ts||0;
    if(this._ledgerGet(syl)===ts) return {ok:true, skipped:true};  // 这段已是最新，别重复传
    const ok=await this._upsert(syl, m, undefined);
    if(ok){ this._ledgerSet(syl, ts); return {ok:true}; }
    return {ok:false, reason:'upload failed'};
  },

  /* ---------- 删除云端行 ---------- */
  async removeRemote(syl){
    const db=this._db();
    if(!db) return {ok:false, reason:'unavailable'};
    const r=await db.from('pokelearn_blends').delete().eq('syl',syl).select('syl');
    this._ledgerDel(syl);
    if(r.error) return {ok:false, reason:r.error.message};
    return {ok:true, removed:Array.isArray(r.data)?r.data.length:0};
  },

  /* ---------- 只读同步状态（刷新按钮用，不改动任何数据） ---------- */
  async status(){
    if(!this.signedIn()) return {ok:false, reason:'signed-out'};
    const db=this._db();
    const pb=(typeof ParentBlendBank!=='undefined')?ParentBlendBank:null;
    if(!db || !pb || !pb.ready) return {ok:false, reason:'unavailable'};
    try{
      const res=await db.from('pokelearn_blends').select('syl,ts');
      if(res.error) throw new Error(res.error.message||'读取同步状态失败');
      const rows=res.data||[];
      const remoteTs={};
      rows.forEach(r=>{ if(r && r.syl) remoteTs[r.syl]=r.ts||0; });
      let synced=0, toPush=0;
      pb.list().forEach(syl=>{
        const m=pb.meta(syl); const ts=(m&&m.ts)||0;
        if((remoteTs[syl]||0)>=ts) synced++; else toPush++;
      });
      let toPull=0;
      rows.forEach(r=>{
        if(!r || !r.syl) return;
        const m=pb.meta(r.syl);
        if(!m || (m.ts||0)<(r.ts||0)) toPull++;
      });
      return {ok:true, local:pb.count(), remote:rows.length,
              synced, toPush, toPull, lastSyncAt:this.lastSyncAt};
    }catch(e){ return {ok:false, reason:e.message||'读取同步状态失败'}; }
  },

  /* ---------- 全量同步（双向，ts 新者胜；批量拉取 + 增量去重） ---------- */
  async syncAll(opts){
    opts=opts||{};
    if(this.busy) return {ok:false, reason:'busy'};
    if(!this.signedIn()) return {ok:false, reason:'signed-out'};
    const db=this._db();
    const pb=(typeof ParentBlendBank!=='undefined')?ParentBlendBank:null;
    if(!db || !pb || !pb.ready) return {ok:false, reason:'unavailable'};
    this.busy=true; this.lastError='';
    try{
      /* 一次请求把云端全部行（含 base64）拉下来，避免原来的逐段 N+1 查询。
         录音段数越多，相比逐段请求提速越明显。 */
      const all=await db.from('pokelearn_blends').select('syl,mime,dur,ts,data_b64,id');
      if(all.error) throw new Error(all.error.message||'读取云端录音失败');
      const rows=all.data||[];
      const remoteTs={}, remoteId={};
      rows.forEach(r=>{
        if(!r || !r.syl) return;
        remoteTs[r.syl]=r.ts||0;
        if(r.id) remoteId[r.syl]=r.id;
      });

      let pulled=0, pushed=0, skipped=0, failed=0;
      // ① 云端有而本机旧/无 → 下载（base64 已在内存，无需二次请求）
      for(const r of rows){
        const syl=r.syl; if(!syl) continue;
        const m=pb.meta(syl);
        if(m && (m.ts||0)>=(r.ts||0)){ skipped++; continue; }   // 本机已是最新，剔除
        if(!r.data_b64){ failed++; continue; }
        const blob=this.b64ToBlob(r.data_b64, r.mime);
        if(!blob){ failed++; continue; }
        await pb.save(syl, blob, {dur:r.dur||0, ts:r.ts||0});
        this._ledgerSet(syl, r.ts||0);
        pulled++;
        if(typeof opts.onProgress==='function') opts.onProgress('pull', pulled);
      }
      // ② 本机有而云端旧/无 → 上传（复用已拉的云端 id，省去 select 往返）
      for(const syl of pb.list()){
        const m=pb.meta(syl); if(!m) continue;
        const ts=m.ts||0;
        // 增量去重：ledger 记录的 ts 没变且云端已是该版本 → 不再重复上传
        if(this._ledgerGet(syl)===ts && (remoteTs[syl]||0)>=ts){ skipped++; continue; }
        if((remoteTs[syl]||0)>=ts){ this._ledgerSet(syl, ts); skipped++; continue; }
        const ok=await this._upsert(syl, m, remoteId[syl]);
        if(ok){ this._ledgerSet(syl, ts); pushed++;
          if(typeof opts.onProgress==='function') opts.onProgress('push', pushed);
        }else failed++;
      }
      this.lastSyncAt=Date.now();
      return {ok:true, pulled, pushed, skipped, failed, remote:rows.length, local:pb.count()};
    }catch(e){
      this.lastError=e.message||'同步失败';
      return {ok:false, reason:this.lastError};
    }finally{ this.busy=false; }
  },

  /* 登录后静默后台同步（不弹提示，出错只记 lastError） */
  pullQuiet(){
    if(!this.signedIn() || this.busy) return Promise.resolve(null);
    return this.syncAll();
  }
};

/* cloud-sync 登录成功后调用这个钩子 */
window.__blendCloudPull=()=>{ BlendCloud.pullQuiet().catch(()=>{}); };

if(typeof module!=='undefined' && module.exports){
  module.exports={BlendCloud};
}
