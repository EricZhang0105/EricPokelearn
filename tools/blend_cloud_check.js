/* blend-cloud 校验：base64 往返 + 未登录降级 + 静态接线断言 */
const fs=require('fs'), vm=require('vm'), path=require('path');
const ROOT=path.join(__dirname,'..');
let pass=0, fail=0;
const ok=(name,cond)=>{ if(cond){pass++; console.log('PASS',name);} else {fail++; console.log('FAIL',name);} };

/* ---------- VM 环境 ---------- */
const ctx={
  window:{}, console, atob, btoa,
  Blob: class { constructor(parts,opts){ this._parts=parts||[]; this.type=(opts&&opts.type)||''; this.size=this._parts.reduce((n,p)=>n+(p.length||p.byteLength||0),0); }
    async arrayBuffer(){ const bufs=[]; for(const p of this._parts){ if(typeof p==='string'){ const u=new Uint8Array(p.length); for(let i=0;i<p.length;i++)u[i]=p.charCodeAt(i)&0xff; bufs.push(u);} else bufs.push(new Uint8Array(p)); } const total=bufs.reduce((n,b)=>n+b.length,0); const out=new Uint8Array(total); let o=0; for(const b of bufs){ out.set(b,o); o+=b.length; } return out.buffer; } },
  fetch: async ()=>{ throw new Error('no fetch in test'); },
  URL:{ createObjectURL:()=>('blob:test'), revokeObjectURL:()=>{} },
  ParentBlendBank:{ ready:true, available:true, map:{}, has(s){return !!this.map[s];}, meta(s){return this.map[s]||null;}, list(){return Object.keys(this.map);},
    async save(syl,blob,meta){ this.map[syl]={url:'blob:'+syl,dur:(meta&&meta.dur)||0,ts:(meta&&meta.ts)||0,blobRef:blob}; return true; },
    async remove(syl){ delete this.map[syl]; return true; } },
  CloudSync:{ client:()=>({ cloud:{ database:{} }, session:null }) },
};
ctx.globalThis=ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT,'js','blend-cloud.js'),'utf8'),ctx,{filename:'blend-cloud.js'});
const BlendCloud=vm.runInContext('BlendCloud',ctx);

(async()=>{
  /* ---------- ① base64 往返（含 >127 的字节，验证无损） ---------- */
  const bytes=new Uint8Array(4096);
  for(let i=0;i<bytes.length;i++) bytes[i]=(i*37+11)&0xff;
  const blob=new ctx.Blob([bytes],{type:'audio/mp4'});
  const b64=await BlendCloud.blobToB64(blob);
  ok('blobToB64 返回非空字符串', typeof b64==='string' && b64.length>0);
  const back=BlendCloud.b64ToBlob(b64,'audio/mp4');
  ok('b64ToBlob 重建成功', !!back && back.type==='audio/mp4');
  const rb=new Uint8Array(await back.arrayBuffer());
  let same=rb.length===bytes.length;
  for(let i=0;i<bytes.length && same;i++) if(rb[i]!==bytes[i]) same=false;
  ok('4096 字节二进制往返无损', same);

  /* ---------- ② 非法 base64 安全失败 ---------- */
  ok('非法 base64 返回 null', BlendCloud.b64ToBlob('!!!not-base64!!!','audio/mp4')===null);

  /* ---------- ③ 未登录降级 ---------- */
  const r1=await BlendCloud.syncAll();
  ok('未登录 syncAll 返回 signed-out', r1 && r1.ok===false && r1.reason==='signed-out');
  const r2=await BlendCloud.pullQuiet();
  ok('未登录 pullQuiet 返回 null（不报错）', r2===null);

  /* ---------- ④ 静态接线断言 ---------- */
  const app=fs.readFileSync(path.join(ROOT,'js','app.js'),'utf8');
  const cs=fs.readFileSync(path.join(ROOT,'js','cloud-sync.js'),'utf8');
  const pb=fs.readFileSync(path.join(ROOT,'js','parent-blend.js'),'utf8');
  const idx=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
  const sw=fs.readFileSync(path.join(ROOT,'sw.js'),'utf8');
  const cc=fs.readFileSync(path.join(ROOT,'js','cloud-config.js'),'utf8');

  ok('保存后自动 pushOne', /pushOne\(s\)\.then/.test(app));
  ok('删除时 removeRemote', /blendDelete[\s\S]{0,600}removeRemote\(syl\)/.test(app));
  ok('清空时逐题 removeRemote', /all\.forEach\(s=>BlendCloud\.removeRemote\(s\)/.test(app));
  ok('家长页有同步按钮 blendSyncBtn', /id="blendSyncBtn"/.test(app));
  ok('同步按钮走 syncAll', /BlendCloud\.syncAll\(/.test(app));
  ok('未登录同步提示登录', /请先登录账号/.test(app));
  ok('cloud-sync 暴露 client()', /client:\(\)=>\(\{ cloud, session/.test(cs));
  ok('cloud-sync 登录后调 __blendCloudPull', /__blendCloudPull/.test(cs));
  ok('parent-blend 保存尊重 meta.ts', /ts:meta\.ts\|\|Date\.now\(\)/.test(pb));
  ok('index.html 加载 blend-cloud.js', /js\/blend-cloud\.js/.test(idx));
  ok('blend-cloud 在 parent-blend 之后加载', idx.indexOf('blend-cloud.js')>idx.indexOf('parent-blend.js'));
  ok('sw.js 预缓存 blend-cloud.js', /'\.\/js\/blend-cloud\.js'/.test(sw));
  ok('sw 版本 v69', /pokelearn-v69/.test(sw));
  ok('cloud-config 版本 v69', /v69 · 2026-11-18/.test(cc));
  ok('新增刷新同步状态按钮 blendRefreshBtn', /id="blendRefreshBtn"/.test(app));
  ok('刷新按钮走只读 status()', /BlendCloud\.status\(\)/.test(app));
  ok('同步按钮带 onProgress 进度回调', /onProgress/.test(app));
  ok('完成时展示已同步剔除数', /r\.skipped/.test(app));

  console.log(`\n${pass} pass, ${fail} fail`);
  process.exit(fail?1:0);
})();
