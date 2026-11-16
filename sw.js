/* PokeLearn service worker — offline-capable PWA
 * 缓存策略（v40）：
 * - HTML / JS / CSS / manifest：网络优先，断网回退缓存 → 改版后孩子设备立刻拿到新版本
 * - 图片（精灵图、图标）：缓存优先 → 秒开且省流量
 * - 中文音频：安装时预缓存（173 段 / 3.7MB，Tingting 高清语音，含四声示范音），第一次打开就能离线听
 * 改了静态文件后请把 CACHE 里的版本号 +1，强制刷新图片缓存。
 * v45（2026-11-16 音标发音 + 语速修复）：
 *   1) 英语 44 音素单独录了发音（audio/ipa/*.m4a，英式女声 en-GB-SoniaNeural），
 *      点音标卡读的是音素本身，不再读例词；
 *   2) 英文词库 615 段全部裁掉首尾静音（最长一段 1.5s→0.43s），
 *      数学算式拼接朗读从 8.7 秒回到 3 秒，恢复正常语速。
 * v44（2026-11-16 拼音表按人教版 24 韵母修正 + 声母/韵母去句尾降调）
 * v41（2026-11-16 阅读题库重写）：周更模板短文（w46/w47）全部重写为不同主题与题型。
 * v43（2026-11-16 汇总页）：新增 js/ref-pages.js（拼音全景 / 音标全景 / 10 以内口诀），
 *   中文新增 29 段 fin2_* 韵母呼读音，英文本地词库补 81 个音标例词。
 * v40（2026-11-16 语音统一）：所有音频 URL 带 ?a=2 版本参数，旧缓存（Flo 时代发闷的
 *   录音 + 63 只宝可梦的多音色鼓励语）不会再被复用；鼓励语改为统一女声 TTS。
 */
const CACHE = 'pokelearn-v45';
const SHELL = [
  './',
  './index.html',
  './css/styles.css',
  './js/pokemon.js',
  './js/zh-phonics.js',
  './js/phonics-sounds.js',
  './js/ref-pages.js',
  './js/data.js',
  './js/question-bank.js',
  './js/question-engine.js',
  './js/read-passages.js',
  './js/books.js',
  './js/moves.js',
  './js/storage.js',
  './js/audio-map.js',
  './js/zh-audio-list.js',
  './js/ipa-audio-list.js',
  './js/app.js',
  './js/cloud-config.js',
  './js/cloud-sync.js',
  './audio/sfx/rocket_line.m4a',
  './manifest.webmanifest'
];
try { importScripts('./js/zh-audio-list.js'); } catch (e) {}
try { importScripts('./js/ipa-audio-list.js'); } catch (e) {}
const ZH_AUDIO_FILES = self.ZH_AUDIO_LIST || [];
const IPA_AUDIO_FILES = self.IPA_AUDIO_LIST || [];
const IMG_EXT = /\.(png|jpe?g|svg|webp|gif)$/i;

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(async c => {
      try { await c.addAll(SHELL); } catch (err) {}
      // 逐条写入，单条失败不影响其余音频
      await Promise.all(ZH_AUDIO_FILES.map(p => c.add('./' + p).catch(() => {})));
      await Promise.all(IPA_AUDIO_FILES.map(p => c.add('./' + p).catch(() => {})));
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
