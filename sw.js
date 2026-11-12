/* PokeLearn service worker — offline-capable PWA */
const CACHE = 'pokelearn-v1';
const SHELL = [
  './',
  './index.html',
  './css/styles.css',
  './js/data.js',
  './js/storage.js',
  './js/app.js',
  './manifest.webmanifest'
];

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

  // 同源静态资源：缓存优先，回退网络并写入缓存
  if (url.origin === self.location.origin) {
    e.respondWith(
      caches.match(req).then(r =>
        r || fetch(req).then(res => {
          const cp = res.clone();
          caches.open(CACHE).then(c => c.put(req, cp));
          return res;
        }).catch(() => caches.match('./index.html'))
      )
    );
    return;
  }

  // 跨域：PokeAPI 官方精灵图 —— 运行时缓存（首访后离线可用）
  if (url.hostname.endsWith('raw.githubusercontent.com') ||
      url.hostname.endsWith('githubusercontent.com')) {
    e.respondWith(
      caches.match(req).then(r =>
        r || fetch(req).then(res => {
          const cp = res.clone();
          caches.open(CACHE).then(c => c.put(req, cp));
          return res;
        }).catch(() => new Response('', { status: 404 }))
      )
    );
    return;
  }
});
