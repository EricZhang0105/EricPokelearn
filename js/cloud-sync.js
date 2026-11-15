/* =========================================================
   账号登录 + 跨设备进度同步（v20）
   ---------------------------------------------------------
   · 邮箱验证码登录/注册（Email OTP）或「使用 WorkBuddy 登录」
   · 登录后自动把本地进度上传到云端；换设备登录同一账号自动拉回
   · 两端进度按「更高的一方 + 记录并集」合并，绝不倒退
   · 云端表 pokelearn_saves 有 owner_id DEFAULT auth.uid() + RLS，
     前端从不传 owner_id，一个账号只能读写自己的那一行
   ---------------------------------------------------------
   注意：云服务按 Origin 精确校验，只有发布在云同步版域名下才可用。
   GitHub Pages / 本地 / 桌面版会明确提示，不做假的「已同步」。
   ========================================================= */
(function(){
'use strict';
const CFG = (typeof CLOUD_CONFIG!=='undefined') ? CLOUD_CONFIG : null;
const ON_CLOUD_HOST = location.hostname.endsWith('app.workbuddy.host');
let cloud=null, session=null, pendingOtp=null, pushTimer=null, suppressPush=false, busy=false;
let lastSyncAt=0, lastError='';

function $(s){ return document.querySelector(s); }
function toast(m){ if(typeof window.toastMsg==='function') window.toastMsg(m); }
function esc(s){ return String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function when(ts){ if(!ts) return '尚未同步'; const d=new Date(ts);
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')
    +' '+String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0'); }

/* ---------------- 界面 ---------------- */
function buildUI(){
  if($('#cloudModal')) return;
  const bar=$('.archive-bar');
  if(bar){
    const b=document.createElement('button');
    b.className='btn-load'; b.id='cloudOpenBtn'; b.textContent='☁️ 账号同步';
    bar.appendChild(b);
    b.onclick=openModal;
  }
  const m=document.createElement('div');
  m.id='cloudModal'; m.className='modal hidden';
  m.innerHTML=`<div class="modal-card cloud-card">
    <button class="modal-x" id="cloudCloseBtn" aria-label="关闭">✕</button>
    <h2>☁️ 账号同步</h2>
    <div class="cloud-note">用一个账号登录，iPad、电脑、手机上的进化进度会自动打通。</div>
    <div id="cloudBody"></div>
  </div>`;
  document.body.appendChild(m);
  $('#cloudCloseBtn').onclick=()=>m.classList.add('hidden');
  m.onclick=e=>{ if(e.target===m) m.classList.add('hidden'); };
  render();
}
function openModal(){ render(); $('#cloudModal').classList.remove('hidden'); }
function setBody(html){ const b=$('#cloudBody'); if(b) b.innerHTML=html; }

function render(){
  const b=$('#cloudBody');
  if(!b) return;
  const btn=$('#cloudOpenBtn');
  if(btn) btn.textContent = session ? '☁️ 已登录' : '☁️ 账号同步';
  if(!ON_CLOUD_HOST){
    setBody(`<div class="cloud-warn">当前是本地 / GitHub Pages 版，只能使用本机存档。<br>
      请使用 <b>云同步版链接</b> 打开再登录，账号进度才能在多台设备之间同步。</div>
      <div class="cloud-tip">已有进度可先在「👨‍👩‍👧 Parents → Export save file」导出，
      再在云同步版里导入一次即可接续。</div>
      ${lastError?'<div class="cloud-err">'+esc(lastError)+'</div>':''}`);
    return;
  }
  if(!cloud){
    setBody('<div class="cloud-warn">云同步组件加载失败，请检查网络后重新打开页面。本地存档不受影响。</div>');
    return;
  }
  if(session){
    const u=session.user||{};
    const name=u.name||u.email||'已登录账号';
    setBody(`<div class="cloud-user">✅ ${esc(name)}</div>
      <div class="cloud-tip">上次同步：${when(lastSyncAt)}</div>
      <div class="cloud-actions">
        <button class="btn-save" id="cloudSyncNow">🔄 立即同步</button>
        <button class="btn-load" id="cloudLogout">退出登录</button>
      </div>
      ${lastError?'<div class="cloud-err">'+esc(lastError)+'</div>':''}
      <div class="cloud-tip">答题后会自动上传进度；打开页面时自动拉取云端存档并合并，
        两边都不会倒退。云端数据按账号隔离，别人看不到。</div>`);
    const s=$('#cloudSyncNow'); if(s) s.onclick=()=>syncNow(true);
    const o=$('#cloudLogout'); if(o) o.onclick=async()=>{
      await cloud.auth.signOut(); session=null; lastSyncAt=0; render(); toast('已退出登录');
    };
    return;
  }
  setBody(`<div class="cloud-tabs">
      <label class="cloud-label">邮箱</label>
      <input id="cloudEmail" class="cloud-input" type="email" placeholder="you@example.com" autocomplete="email">
      <div class="cloud-actions">
        <button class="btn-load" id="cloudSendCode" type="button">发送验证码</button>
      </div>
      <label class="cloud-label">验证码</label>
      <input id="cloudCode" class="cloud-input" inputmode="numeric" placeholder="邮箱里收到的 6 位数字" autocomplete="one-time-code">
      <div class="cloud-actions">
        <button class="btn-save" id="cloudVerify" type="button">登录 / 注册</button>
      </div>
      <div class="cloud-or">或</div>
      <button class="btn-load cloud-wb" id="cloudWorkBuddy">使用 WorkBuddy 登录</button>
      ${lastError?'<div class="cloud-err">'+esc(lastError)+'</div>':''}
      <div class="cloud-tip">没有账号也能直接登录：输入邮箱收验证码即可自动创建。
        同一个账号在任何设备登录都会取回同一份进度。</div>
    </div>`);
  $('#cloudSendCode').onclick=sendCode;
  $('#cloudVerify').onclick=verifyCode;
  $('#cloudWorkBuddy').onclick=workBuddyLogin;
}

/* ---------------- 登录 ---------------- */
function fail(msg){ lastError=msg; render(); }
async function sendCode(){
  if(busy) return;
  const email=String($('#cloudEmail').value||'').trim();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){ fail('请输入正确的邮箱地址'); return; }
  busy=true; lastError='';
  try{
    const r=await cloud.auth.sendOtp({email});
    if(r.error){ fail(r.error.message||'验证码发送失败，请稍后再试'); return; }
    pendingOtp={ email, verificationId:r.data.verificationId, isExistingUser:r.data.isExistingUser };
    toast('📮 验证码已发送，请查收邮箱');
    const el=$('#cloudCode'); if(el) el.focus();
  }catch(e){ fail('网络异常，验证码未发送'); }
  finally{ busy=false; }
}
async function verifyCode(){
  if(busy) return;
  const token=String($('#cloudCode').value||'').trim();
  if(!pendingOtp){ fail('请先点击「发送验证码」'); return; }
  if(!token){ fail('请输入邮箱里收到的验证码'); return; }
  const email=String($('#cloudEmail').value||'').trim();
  if(email!==pendingOtp.email){ fail('邮箱改过了，请重新获取验证码'); return; }
  busy=true;
  try{
    const r=await cloud.auth.verifyOtp({
      email:pendingOtp.email, verificationId:pendingOtp.verificationId,
      isExistingUser:pendingOtp.isExistingUser, token
    });
    if(r.error){ fail(r.error.message||'验证码不正确，请重试（不用重新发送）'); return; }
    pendingOtp=null; lastError='';
    session=r.data || (await cloud.auth.getSession()).data;
    render(); await afterLogin(true);
  }catch(e){ fail('网络异常，请重试'); }
  finally{ busy=false; }
}
async function workBuddyLogin(){
  if(busy) return;
  busy=true; lastError='';
  try{
    const back=new URL(location.href);
    back.pathname='/';
    ['code','state','provider'].forEach(k=>back.searchParams.delete(k));
    const r=await cloud.auth.signInWithOAuth({provider:'workbuddy',redirectTo:back.toString()});
    if(r.error){ fail(r.error.message||'暂时无法使用 WorkBuddy 登录'); return; }
    location.assign(r.data.url);          // 必须同标签页跳转，PKCE verifier 存在 sessionStorage
  }catch(e){ fail('网络异常，请重试'); }
  finally{ busy=false; }
}

/* 启动时的 OAuth 回调分发（必须在任何登录判断之前） */
async function restoreAuth(){
  const u=new URL(location.href);
  if(!u.searchParams.has('code') && !u.searchParams.has('error')){
    const r=await cloud.auth.getSession();
    session=r.error?null:r.data; render();
    if(session) await afterLogin(false);
    return;
  }
  const provider=u.searchParams.get('provider');
  if(provider!=='workbuddy'){ fail('授权回调缺少有效的登录方式，请重新登录'); return; }
  const fn=cloud.auth.handleWorkBuddyCallback;
  if(typeof fn!=='function'){ fail('SDK 版本不支持此登录方式'); return; }
  const r=await fn.call(cloud.auth);
  if(r.error){ fail(r.error.message||'登录未完成，请重试'); return; }
  if(r.data){
    ['code','state','provider'].forEach(k=>u.searchParams.delete(k));
    history.replaceState(null,'',`${u.pathname}${u.search}${u.hash}`);
    session=r.data; render(); await afterLogin(true);
    openModal();
  }else{
    const s=await cloud.auth.getSession(); session=s.error?null:s.data; render();
    if(session) await afterLogin(false);
  }
}

/* ---------------- 同步 ---------------- */
async function sessionGate(){
  const r=await cloud.auth.getSession();
  if(r.error || !r.data){ session=null; render(); return null; }
  session=r.data; return session;
}
async function pull(){
  const {data,error}=await cloud.database.from('pokelearn_saves')
    .select('save_json,updated_at').maybeSingle();
  if(error){ throw new Error(error.message||'读取云端存档失败'); }
  if(!data || !data.save_json) return {found:false};
  let remote=null;
  try{ remote=JSON.parse(data.save_json); }catch(e){ return {found:false}; }
  const merged=Store.mergeSave(remote);
  lastSyncAt=Date.now();
  return {found:true, merged};
}
async function push(){
  if(!(await sessionGate())) return;
  const json=JSON.stringify(Store.data);
  const name=(session.user && (session.user.name||session.user.email)) || null;
  const {data:rows,error:readErr}=await cloud.database.from('pokelearn_saves')
    .select('id').maybeSingle();
  if(readErr) throw new Error(readErr.message||'云端存档读取失败');
  let r;
  if(rows && rows.id){
    r=await cloud.database.from('pokelearn_saves')
      .update({save_json:json, updated_at:new Date().toISOString()})
      .eq('id',rows.id).select('id');
    if(!r.error && Array.isArray(r.data) && r.data.length===0)
      throw new Error('这条存档不属于当前账号');
  }else{
    r=await cloud.database.from('pokelearn_saves')
      .insert({save_json:json, owner_name:name, updated_at:new Date().toISOString()})
      .select('id');
  }
  if(r.error) throw new Error(r.error.message||'上传失败');
  lastSyncAt=Date.now();
}
async function syncNow(manual){
  if(!ON_CLOUD_HOST || !cloud || busy) return;
  busy=true; lastError='';
  try{
    if(!(await sessionGate())){ if(manual) fail('请先登录'); return; }
    await pull();                       // 先拉云端并合并
    await push();                       // 再把合并结果写回
    if(typeof window.renderHome==='function') window.renderHome();
    if(typeof window.updateCompanion==='function') window.updateCompanion();
    render();
    if(manual) toast('✅ 进度已同步');
  }catch(e){
    fail(e.message||'同步失败，请稍后再试');
    if(manual) toast('❌ '+(e.message||'同步失败'));
  }finally{ busy=false; }
}
async function afterLogin(showModal){
  await syncNow(false);
  if(showModal) toast('☁️ 已登录，进度自动同步');
}
function schedulePush(){
  if(suppressPush || !ON_CLOUD_HOST || !cloud || !session) return;
  clearTimeout(pushTimer);
  pushTimer=setTimeout(()=>{ push().catch(e=>{ lastError=e.message||'自动同步失败'; }); },5000);
}

/* ---------------- 启动 ---------------- */
function startCloud(){
  try{
    cloud=WorkBuddyCloud.createWorkBuddyCloud({
      endpoint:CFG.endpoint,
      oauthRelayBaseUrl:CFG.oauthRelayBaseUrl,
      publishableKey:CFG.publishableKey
    });
  }catch(e){ lastError='云服务初始化失败'; render(); return; }
  if(cloud.auth.onAuthStateChange){
    cloud.auth.onAuthStateChange((ev,s)=>{
      session=s||null;
      if(ev==='SIGNED_OUT'){ lastSyncAt=0; }
      render();
    });
  }
  window.__onCloudSave=schedulePush;     // storage.save() 会调用它（节流 5 秒）
  restoreAuth().catch(e=>{ fail('登录状态恢复失败：'+(e.message||'网络异常')); });
}
function boot(){
  buildUI();
  if(!CFG || !ON_CLOUD_HOST){ render(); return; }   // 本地版不加载云 SDK，零网络开销
  if(typeof WorkBuddyCloud!=='undefined'){ startCloud(); return; }
  // 动态加载 CDN SDK：加载失败也只是云同步不可用，本地存档照常工作、页面不阻塞
  const sc=document.createElement('script');
  sc.src='https://cdn.jsdelivr.net/npm/@tencent-ai/workbuddy-cloud-sdk@dev/lib/index.global.js';
  sc.onload=()=>{
    if(typeof WorkBuddyCloud!=='undefined') startCloud();
    else { lastError='云同步组件加载失败'; render(); }
  };
  sc.onerror=()=>{ lastError='云同步组件加载失败，请检查网络'; render(); };
  document.head.appendChild(sc);
}

if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot);
else boot();

window.CloudSync={ syncNow, openModal, status:()=>({onCloudHost:ON_CLOUD_HOST, signedIn:!!session, lastSyncAt}) };
})();
