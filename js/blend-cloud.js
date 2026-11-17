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
   依赖：CloudSync.client()（cloud-sync.js 暴露）、ParentBlendBank。
   未登录 / GitHub Pages / 本地版自动降级为纯本机，不报错。
   ========================================================= */
const BlendCloud = {
  busy:false,
  lastError:'',
  lastSyncAt:0,

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

  /* ---------- 上传单题 ---------- */
  async pushOne(syl){
    const pb=(typeof ParentBlendBank!=='undefined')?ParentBlendBank:null;
    const db=this._db();
    if(!pb || !pb.has(syl) || !db) return {ok:false, reason:'unavailable'};
    const m=pb.meta(syl);
    let blob;
    try{ blob=await (await fetch(m.url)).blob(); }
    catch(e){ return {ok:false, reason:'blob read failed'}; }
    if(!blob || !blob.size) return {ok:false, reason:'empty blob'};
    const b64=await this.blobToB64(blob);
    const row={ syl, mime:blob.type||'audio/mp4', dur:m.dur||0, ts:m.ts||Date.now(), data_b64:b64 };
    const exist=await db.from('pokelearn_blends').select('id').eq('syl',syl).maybeSingle();
    if(exist.error) return {ok:false, reason:exist.error.message};
    if(exist.data && exist.data.id){
      const r=await db.from('pokelearn_blends')
        .update(Object.assign({}, row, {updated_at:new Date().toISOString()}))
        .eq('syl',syl).select('id');
      if(r.error) return {ok:false, reason:r.error.message};
      if(!Array.isArray(r.data) || r.data.length===0) return {ok:false, reason:'云端行不属于当前账号'};
    }else{
      const c=this.client();
      const u=(c && c.session && c.session.user) || {};
      const name=u.name||u.email||null;
      const r=await db.from('pokelearn_blends')
        .insert(Object.assign({}, row, {owner_name:name})).select('id');
      if(r.error) return {ok:false, reason:r.error.message};
    }
    return {ok:true};
  },

  /* ---------- 删除云端行 ---------- */
  async removeRemote(syl){
    const db=this._db();
    if(!db) return {ok:false, reason:'unavailable'};
    const r=await db.from('pokelearn_blends').delete().eq('syl',syl).select('syl');
    if(r.error) return {ok:false, reason:r.error.message};
    return {ok:true, removed:Array.isArray(r.data)?r.data.length:0};
  },

  /* ---------- 全量同步（双向，ts 新者胜） ---------- */
  async syncAll(){
    if(this.busy) return {ok:false, reason:'busy'};
    if(!this.signedIn()) return {ok:false, reason:'signed-out'};
    const db=this._db();
    const pb=(typeof ParentBlendBank!=='undefined')?ParentBlendBank:null;
    if(!db || !pb || !pb.ready) return {ok:false, reason:'unavailable'};
    this.busy=true; this.lastError='';
    try{
      const meta=await db.from('pokelearn_blends').select('syl,ts,dur');
      if(meta.error) throw new Error(meta.error.message||'读取云端录音失败');
      const rows=meta.data||[];
      const remoteTs={};
      rows.forEach(r=>{ remoteTs[r.syl]=(r.ts||0); });

      let pulled=0, pushed=0, failed=0;
      // ① 云端有而本机旧/无 → 下载
      for(const r of rows){
        const m=pb.meta(r.syl);
        if(m && (m.ts||0) >= (r.ts||0)) continue;             // 本机已是最新的
        const full=await db.from('pokelearn_blends')
          .select('syl,mime,dur,ts,data_b64').eq('syl',r.syl).maybeSingle();
        if(full.error || !full.data || !full.data.data_b64){ failed++; continue; }
        const blob=this.b64ToBlob(full.data.data_b64, full.data.mime);
        if(!blob){ failed++; continue; }
        await pb.save(r.syl, blob, {dur:full.data.dur||0, ts:full.data.ts||0});
        pulled++;
      }
      // ② 本机有而云端旧/无 → 上传
      for(const syl of pb.list()){
        const m=pb.meta(syl);
        if((m.ts||0) <= (remoteTs[syl]||0)) continue;
        const r=await this.pushOne(syl);
        if(r.ok) pushed++; else failed++;
      }
      this.lastSyncAt=Date.now();
      return {ok:true, pulled, pushed, failed, remote:rows.length, local:pb.count()};
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
