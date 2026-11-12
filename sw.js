/* PokeLearn service worker — offline-capable PWA
 * 缓存策略（v2）：
 * - HTML / JS / CSS / manifest：网络优先，断网回退缓存 → 改版后孩子设备立刻拿到新版本
 * - 图片（精灵图、图标）：缓存优先 → 秒开且省流量
 * 改了静态文件后请把 CACHE 里的版本号 +1，强制刷新图片缓存。
 */
const CACHE = 'pokelearn-v3';
const SHELL = [
  './',
  './index.html',
  './css/styles.css',
  './js/pokemon.js',
  './js/data.js',
  './js/storage.js',
  './js/audio-map.js',
  './js/app.js',
  './manifest.webmanifest'
];
const IMG_EXT = /\.(png|jpe?g|svg|webp|gif)$/i;

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(SHELL).catch(() => {})).then(() => self.skipWaiting())
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
