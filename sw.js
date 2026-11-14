/* PokeLearn service worker — offline-capable PWA
 * 缓存策略（v17）：
 * - HTML / JS / CSS / manifest：网络优先，断网回退缓存 → 改版后孩子设备立刻拿到新版本
 * - 图片（精灵图、图标）：缓存优先 → 秒开且省流量
 * - 中文音频：安装时预缓存（157 段 / 3.7MB，Tingting 高清语音，含四声示范音），第一次打开就能离线听
 * 改了静态文件后请把 CACHE 里的版本号 +1，强制刷新图片缓存。
 */
const CACHE = 'pokelearn-v17';
const SHELL = [
  './',
  './index.html',
  './css/styles.css',
  './js/pokemon.js',
  './js/zh-phonics.js',
  './js/data.js',
  './js/read-passages.js',
  './js/books.js',
  './js/storage.js',
  './js/audio-map.js',
  './js/zh-audio-list.js',
  './js/app.js',
  './audio/sfx/rocket_line.m4a',
  './manifest.webmanifest'
];
try { importScripts('./js/zh-audio-list.js'); } catch (e) {}
const ZH_AUDIO_FILES = self.ZH_AUDIO_LIST || [];
const IMG_EXT = /\.(png|jpe?g|svg|webp|gif)$/i;

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(async c => {
      try { await c.addAll(SHELL); } catch (err) {}
      // 逐条写入，单条失败不影响其余音频
      await Promise.all(ZH_AUDIO_FILES.map(p => c.add('./' + p).catch(() => {})));
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;   // 精灵图已本地化，跨域请求基本不再出现

  // 图片：缓存优先（内容不变，改版靠版本号清理）
  if (IMG_EXT.test(url.pathname)) {
    e.respondWith(
      caches.match(req).then(r =>
        r || fetch(req).then(res => {
          if(res && res.status===200){
            const cp = res.clone();
            caches.open(CACHE).then(c => c.put(req, cp)).catch(()=>{});
          }
          return res;
        })
      )
    );
    return;
  }

  // 其余（HTML/JS/CSS/音频/manifest）：网络优先，断网回退缓存
  e.respondWith(
    fetch(req).then(res => {
      // 音频可能返回 206 分片，不写缓存避免损坏
      if(res && res.status===200 && res.ok){
        const cp = res.clone();
        caches.open(CACHE).then(c => c.put(req, cp)).catch(()=>{});
      }
      return res;
    }).catch(() => caches.match(req).then(r => r || caches.match('./index.html')))
  );
});
