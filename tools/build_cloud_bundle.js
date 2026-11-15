#!/usr/bin/env node
/* =========================================================
   生成「云同步版」发布镜像
   ---------------------------------------------------------
   GitHub Pages 版跑在 github.io，云服务按 Origin 精确校验，
   所以账号登录只能在 app.workbuddy.host 的云同步版里用。
   仓库根目录含 desktop/（Electron 依赖 + 安装包，1.7G），
   不能整体上传；这里只挑 PWA 真正需要的静态文件做一份干净镜像。

   用法：
     node tools/build_cloud_bundle.js [目标目录]
   默认目标：与仓库同级的 PokeLearnCloud/

   每次改完网页内容，先跑这个脚本，再用发布能力重新发布目标目录，
   并复用 applicationId 保持域名不变（换域名会让云登录失效）。
   ========================================================= */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const OUT = path.resolve(process.argv[2] || path.join(ROOT, '..', 'PokeLearnCloud'));

const FILES = [
  'index.html', 'sw.js', 'manifest.webmanifest',
  'icon-180.png', 'icon-192.png', 'icon-512.png'
];
const DIRS = ['css', 'js', 'img', 'audio'];

fs.mkdirSync(OUT, { recursive: true });
// 清掉上一次的旧镜像，避免删掉的题库文件残留在云端
for (const name of fs.readdirSync(OUT)) {
  if (name === '.git' || name === '.workbuddy') continue;
  fs.rmSync(path.join(OUT, name), { recursive: true, force: true });
}

function copyDir(rel) {
  const src = path.join(ROOT, rel), dst = path.join(OUT, rel);
  fs.mkdirSync(dst, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    if (e.name.startsWith('.')) continue;
    const s = path.join(src, e.name), d = path.join(dst, e.name);
    if (e.isDirectory()) copyDir(path.join(rel, e.name));
    else fs.copyFileSync(s, d);
  }
}

FILES.forEach(f => fs.copyFileSync(path.join(ROOT, f), path.join(OUT, f)));
DIRS.forEach(copyDir);

// 静态托管不需要 Node 服务器；放一份说明，防止有人把整仓再传一遍
fs.writeFileSync(path.join(OUT, 'DEPLOY.txt'),
  'PokeLearn 云同步版静态镜像\n由 tools/build_cloud_bundle.js 生成，请勿手工编辑。\n' +
  '发布时复用 applicationId，保持 app.workbuddy.host 域名不变。\n', 'utf8');

function size(dir) {
  let n = 0;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    n += e.isDirectory() ? size(p) : fs.statSync(p).size;
  }
  return n;
}
console.log(`云同步版镜像：${OUT}`);
console.log(`包含 ${FILES.length} 个入口文件 + ${DIRS.join('/')} 目录，合计 ${(size(OUT) / 1048576).toFixed(1)} MB`);
