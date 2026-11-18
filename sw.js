/* PokeLearn service worker — offline-capable PWA
 * 缓存策略（v66）：
 * - HTML / JS / CSS / manifest：网络优先，断网回退缓存 → 改版后孩子设备立刻拿到新版本
 * - 图片（精灵图、图标）：缓存优先 → 秒开且省流量
 * - 中文音频：安装时预缓存（173 段 / 3.7MB，Tingting 高清语音，含四声示范音），第一次打开就能离线听
 * 改了静态文件后请把 CACHE 里的版本号 +1，强制刷新图片缓存。
 * v66（2026-11-18）：
 *   四声辨调音频 tone_<base>_<t> 单独升 a=9（其余中文仍 a=8）。旧音频由 edge-tts
 *   裸读单字、句尾掉 50-70Hz：一声「屋」听成降调、三声「晚」偏平像一声。已用
 *   tools/zh_tone_fix.py 以 Praat PSOLA 按目标调型重塑全部 32 段（报告 zh_tone_report.json），
 *   Praat 复核 32/32 达标。独立版本号使 iPad 只重新缓存这 32 段。
 * v65（2026-11-18）：
 *   Sight Words 选项显示「英文 + 中文」（cat 猫），仅显示层，判题/语音仍用英文原词。
 * v53（2026-11-17）：
 *   1) 第③部分字母卡改为读【字母名】（A=ei、B=bi…），不再是音素；26 段 letter_A..Z 由
 *      全 App 同一把 Jenny 女声合成（tools/letters_build.py），音视频版本 a=9。
 *   2) 中文拼读第4步改为「声母拉长 + 带调韵母」的拼读过渡音 py_<syl>（tools/zh_pinyin_blend.py），
 *      让孩子听到 h~~~~áng 的拼读过程；63 段已加入预缓存，中文音频 a=5。
 *   3) háng 题的示范字「行」是多音字被 TTS 读成 xíng → 改用读音明确的「航」并已重录。
 * v52（2026-11-17）：
 *   音标 audio/ipa 换 a=8：按用户指定参考 B 站「48个英语音标标准美音发音」BV1sb411L78w，
 *   43 个音素改用视频里的标准美音外教真人录音（每音标读两遍取第 1 遍），同一发音人、
 *   音色一致。此前 Commons 音节虽是真人但拼读口音/音节感仍不被认可。/ɚ/ /ɔr/ 视频无，
 *   保留 Commons。只去静音+响度归一，不改音高/不变速/不拼接。②③连带修好。
 * v50（2026-11-17）：
 *   1) 数学/语法答题讲解改为「读完再切下一题」，不再用固定 3 秒定时器 ——
 *      长句会和下一题自动读题叠在一起；切题/退出课程时统一取消上一段语音。
 *   2) 伊布改为独立的能量石顺序进化链（9 阶），每满 100 能量按 水→雷→火→日→月→叶→冰→仙
 *      顺序变身、变过的不重复；家族图鉴单独展示整条路线，首页形象同步更新。
 *   3) 音标 audio/ipa 换 a=6：θ ð ʃ ʒ tʃ dʒ w j 原先截到了「辅音+a」里的元音，
 *      现在改取录音开头 140–180ms 的纯辅音段（实测 ʃ/tʃ 高频能量 0.87/0.89）。
 * v49（2026-11-16 音标改用公开真人录音，停止自合成）：
 *   前几版用 TTS 自制音素（放慢 / 拉伸 / 拼接 / 加「uh」尾音），实机仍听不清：
 *   短元音含糊、长元音拖成平音、辅音干脆读错。这一版彻底不再合成，改为抓取
 *   公开免费的真人孤立音素录音直接配对（audio/ipa 换 a=5）：
 *   - 元音 / 单音节：Wikimedia Commons 的孤立 IPA 音素录音；
 *   - /ɝ/ /eɪ/ /oʊ/ /ɔɪ/ 与塞音：University of Iowa「Sounds of Speech」美音孤立音素；
 *   - /θ ð ʃ ʒ tʃ dʒ w j/：从 Commons「辅音 + 元音」录音里截元音前的辅音段。
 *   只做去静音 / 取有效段 / 响度归一 / 转 AAC，不改音高、不变速、不拼接、不循环。
 *   同时把音标卡与字母卡的 data-say 全部清空：录音失败时保持安静，
 *   不再退回设备 TTS 去念 "zhh" / "ng" 这类拼法（设备念出来就是乱码音）。
 * v48（2026-11-16 音标「听不清 / 太急促」+ 自动保存跳首页）：
 *   1) 音素片段整体放慢加长（audio/ipa 换 a=4）：合成语速 -8% → -18%、元音 -25%，
 *      塞音从 0.14–0.22s 拉到 0.34–0.40s，擦音 / 鼻音 0.44–0.55s，元音 0.45–0.60s，
 *      每段前后再留 70ms / 100ms 静音 —— 上一版片尾贴边，听着「刚一响就没了」；
 *      响度 -20 → -18dBFS。
 *   2) 字母卡（A a / B b …）以前点下去读的是 apple / bag 这类例词，
 *      现在读该字母的音素（A a → /æ/ /eɪ/），与上面的音标格一致；
 *      音素格录音失败时的兜底也改成读「念法」而不是例词。
 *   3) 去掉 controllerchange 自动 location.reload()：
 *      以前切回前台碰上发版，孩子答到一半会被刷回首页。
 *      现在只更新缓存，下次打开即最新（HTML/JS 本来就走网络优先）。
 * v47（2026-11-16 音标发音可听性重做，audio/ipa 换 a=3）：
 *   上一版辅音是「词首到元音起音后 35ms」切出来的，实测 /b/ 55ms、/d/ 65ms、
 *   /m/ 55ms、/f/ 105ms 且前面还有 66ms 静音 —— 在 iPad 上就是「读不出来 / 卡住」。
 *   这次按音的物理性质分三类重做：持续音（擦音 / 鼻音 / 近音）让 TTS 直接拉长，
 *   塞音 / 塞擦音 / 半元音用「辅音 + 极短元音」（buh / duh / guh …），
 *   元音从真实单词切、必要时 WSOLA 拉伸（不循环拼接，避免接缝抖动）；
 *   全部按 RMS 归一到 -20dBFS，首尾静音清干净，最短 0.13s。
 * v46（2026-11-16 英文全美音）：
 *   1) 音标库换成美式 GA：45 个音素（21 元音 + 24 辅音），/ɒ/→/ɑ/、/əʊ/→/oʊ/、
 *      /ɜː/→/ɝ/、/ɑː/→/ɑr/、/ɪə/→/ɪr/、/eə/→/ɛr/、/ʊə/→/ʊr/，新增 /ɚ/；
 *      录音从英式女声换成与全 App 同一把 en-US-JennyNeural；
 *   2) 英文用词统一美式：mom / color / favorite / apartment / vacation；
 *      改动的句子重新录音（615 段词库重建成新清单）。
 * v45（2026-11-16 音标发音 + 语速修复）：
 *   1) 英语音素单独录了发音（audio/ipa/*.m4a），
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
const CACHE = 'pokelearn-v66';
const SHELL = [
  './',
  './index.html',
  './css/styles.css',
  './js/pokemon.js',
  './js/zh-phonics.js',
  './js/phonics-sounds.js',
  './js/ref-pages.js',
  './js/data.js',
  './js/audio-denoise.js',
  './js/parent-blend.js',
  './js/blend-cloud.js',
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
