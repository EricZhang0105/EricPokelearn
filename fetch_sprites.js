/* 一次性工具：把 PokeAPI 官方精灵图下载到本地 img/pokemon/
 * 为什么要本地化：原来直接引用 raw.githubusercontent.com（美国源），
 * 新加坡/国内网络时快时慢，iPad 首次离线打开全靠缓存。
 * 本地化后：App 完全自包含，断网也稳。
 *
 * 运行： node fetch_sprites.js     （重复运行会跳过已存在的图）
 * 下载后自动用 macOS sips 压到 320px，控制仓库体积。
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const SRC = path.join(__dirname, 'js', 'data.js');
const OUT = path.join(__dirname, 'img', 'pokemon');
const BASE = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/';

fs.mkdirSync(OUT, { recursive: true });

const src = fs.readFileSync(SRC, 'utf8');
const ids = [...new Set([...src.matchAll(/imgId:(\d+)/g)].map(m => m[1]))].map(Number).sort((a, b) => a - b);
console.log(`发现 ${ids.length} 张精灵图需要本地化`);

(async () => {
  let ok = 0, skip = 0, fail = [];
  for (const id of ids) {
    const file = path.join(OUT, `${id}.png`);
    if (fs.existsSync(file) && fs.statSync(file).size > 1000) { skip++; continue; }
    try {
      const res = await fetch(BASE + id + '.png');
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const buf = Buffer.from(await res.arrayBuffer());
      fs.writeFileSync(file, buf);
      // 压缩到 320px，儿童界面足够清晰
      try { execSync(`sips -Z 320 "${file}" >/dev/null 2>&1`); } catch (e) {}
      ok++;
      process.stdout.write(`✓ ${id} `);
    } catch (e) {
      fail.push(id);
      process.stdout.write(`✗ ${id}(${e.message}) `);
    }
  }
  console.log(`\n完成：新下载 ${ok}，已存在跳过 ${skip}，失败 ${fail.length}${fail.length ? ' -> ' + fail.join(',') : ''}`);
  const total = fs.readdirSync(OUT).reduce((s, f) => s + fs.statSync(path.join(OUT, f)).size, 0);
  console.log(`img/pokemon/ 总大小：${(total / 1024 / 1024).toFixed(1)} MB`);
})();
