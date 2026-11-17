/* =========================================================
   ParentBlendBank — 家长真人录制的拼读题库
   ---------------------------------------------------------
   家长在「Parents → 🎙️ 拼读题库」按题目汉字录一段 4 步连读：
     韵母 → 带调韵母 → 声母拉长连读 → 完整音节
   每段一整题，存 IndexedDB（Blob），不进 localStorage 存档、
   不随云同步上传（音频太大）。小朋友 c-blend 只出「已录制」的题，
   播放直接读内存里的 blob URL（playSpeak 的 s.clip 单段路径）。

   对外接口（全局 const ParentBlendBank）：
     init()              异步打开 DB、加载全部录音到内存 map
     ready               bool，init 完成
     has(syl)            该题是否已录制（同步，供 data.js 出题过滤）
     url(syl)            该录音的 blob URL（同步，供 speak.clip）
     count()             已录制题数
     list()              已录制音节数组
     save(syl,blob,meta) 保存/覆盖一题
     remove(syl)         删除一题
     clear()             清空全部
   ========================================================= */
const ParentBlendBank = {
  DB_NAME:'pokelearn-parent-blend',
  STORE:'clips',
  VERSION:1,
  db:null,
  map:{},        // syl -> { url, dur, ts }（url = URL.createObjectURL(blob)）
  ready:false,
  available:true,

  _open(){
    return new Promise((resolve,reject)=>{
      if(!('indexedDB' in window)){ reject(new Error('no indexedDB')); return; }
      let req;
      try{ req=indexedDB.open(this.DB_NAME,this.VERSION); }
      catch(e){ reject(e); return; }
      req.onupgradeneeded=()=>{
        const db=req.result;
        if(!db.objectStoreNames.contains(this.STORE)) db.createObjectStore(this.STORE,{keyPath:'syl'});
      };
      req.onsuccess=()=>resolve(req.result);
      req.onerror=()=>reject(req.error||new Error('open failed'));
    });
  },

  async init(){
    try{
      this.db=await this._open();
      await new Promise((resolve,reject)=>{
        const tx=this.db.transaction(this.STORE,'readonly');
        const req=tx.objectStore(this.STORE).getAll();
        req.onsuccess=()=>{
          (req.result||[]).forEach(r=>{
            if(r && r.syl && r.blob){
              const url=URL.createObjectURL(r.blob);
              this.map[r.syl]={ url, dur:r.dur||0, ts:r.ts||Date.now() };
            }
          });
          resolve();
        };
        req.onerror=()=>reject(req.error||new Error('load failed'));
      });
      this.ready=true; this.available=true;
    }catch(e){
      // 降级：内存模式（录制仍然可用，但刷新后丢失）
      this.ready=true; this.available=false;
      try{ if(typeof toastMsg==='function') toastMsg('⚠️ 本机存储不可用，录音刷新后会丢失'); }catch(_){}
    }
    return this.ready;
  },

  has(syl){ return !!(syl && this.map[syl]); },
  url(syl){ return this.has(syl) ? this.map[syl].url : null; },
  count(){ return Object.keys(this.map).length; },
  list(){ return Object.keys(this.map); },
  meta(syl){ return this.map[syl]||null; },

  async save(syl,blob,meta){
    meta=meta||{};
    if(this.has(syl)){ try{ URL.revokeObjectURL(this.map[syl].url); }catch(e){} }
    /* ts 优先用调用方给的（云端下载要保留云端时间戳，冲突按新者胜） */
    const rec={ syl, blob, dur:meta.dur||0, ts:meta.ts||Date.now(), mime:blob.type||'audio/webm' };
    if(this.db){
      await new Promise((resolve,reject)=>{
        const tx=this.db.transaction(this.STORE,'readwrite');
        tx.objectStore(this.STORE).put(rec);
        tx.oncomplete=()=>resolve();
        tx.onerror=()=>reject(tx.error||new Error('save failed'));
      });
    }
    this.map[syl]={ url:URL.createObjectURL(blob), dur:rec.dur, ts:rec.ts };
    return true;
  },

  async remove(syl){
    if(this.db){
      await new Promise((resolve,reject)=>{
        const tx=this.db.transaction(this.STORE,'readwrite');
        tx.objectStore(this.STORE).delete(syl);
        tx.oncomplete=()=>resolve();
        tx.onerror=()=>reject(tx.error||new Error('delete failed'));
      });
    }
    if(this.has(syl)){ try{ URL.revokeObjectURL(this.map[syl].url); }catch(e){} }
    delete this.map[syl];
    return true;
  },

  async clear(){
    if(this.db){
      await new Promise((resolve,reject)=>{
        const tx=this.db.transaction(this.STORE,'readwrite');
        tx.objectStore(this.STORE).clear();
        tx.oncomplete=()=>resolve();
        tx.onerror=()=>reject(tx.error||new Error('clear failed'));
      });
    }
    Object.keys(this.map).forEach(s=>{ try{ URL.revokeObjectURL(this.map[s].url); }catch(e){} });
    this.map={};
    return true;
  }
};

/* 家长录音时优先选 iPad Safari 支持的 mp4，其次 Chrome 的 webm/opus */
function parentBlendMime(){
  if(!window.MediaRecorder) return '';
  const cands=['audio/mp4','audio/webm;codecs=opus','audio/webm'];
  for(const m of cands){ try{ if(MediaRecorder.isTypeSupported(m)) return m; }catch(e){} }
  return '';
}

if(typeof module!=='undefined' && module.exports){
  module.exports={ParentBlendBank,parentBlendMime};
}
