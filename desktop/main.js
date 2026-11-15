/* PokeLearn 离线桌面版主进程
 * 用 Node 内置 http 在 127.0.0.1 随机端口起一个静态服务器，服务项目根目录的全部静态资源，
 * 再让 BrowserWindow 通过 http:// 打开：localStorage 与 Service Worker 在 file:// 下不可靠。
 * 所有资源随安装包分发，无需联网即可使用。
 */
const { app, BrowserWindow } = require('electron');
const http = require('http');
const fs = require('fs');
const path = require('path');

// 打包后静态资源由 extraResources 放到 resources/app-static/，开发时直接用项目根目录。
const ROOT = app.isPackaged
  ? path.join(process.resourcesPath, 'app-static')
  : path.join(__dirname, '..');

const WINDOW_TITLE = 'PokeLearn';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.m4a': 'audio/mp4',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg'
};

function createStaticServer() {
  return http.createServer((req, res) => {
    let urlPath;
    try {
      urlPath = decodeURIComponent(req.url.split('?')[0]);
    } catch (e) {
      res.writeHead(400);
      res.end('Bad request');
      return;
    }
    if (urlPath === '/') urlPath = '/index.html';

    const filePath = path.join(ROOT, path.normalize(urlPath).replace(/^(\.\.[/\\])+/, ''));
    // 防目录穿越：所有请求都必须落在 ROOT 内
    if (filePath !== ROOT && !filePath.startsWith(ROOT + path.sep)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }

    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }
      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, {
        'Content-Type': MIME[ext] || 'application/octet-stream',
        'Cache-Control': 'no-cache'
      });
      res.end(data);
    });
  });
}

function createWindow(port) {
  const win = new BrowserWindow({
    width: 1180,
    height: 820,
    title: WINDOW_TITLE,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });
  // 页面的 <title> 会覆盖窗口标题，拦截以保持中文标题
  win.on('page-title-updated', (e) => {
    e.preventDefault();
    win.setTitle(WINDOW_TITLE);
  });
  win.loadURL(`http://127.0.0.1:${port}/index.html`);
}

let serverPort = null;

app.whenReady().then(() => {
  const server = createStaticServer();
  // 端口 0 = 由系统分配随机可用端口，避免与其它本地服务冲突
  server.listen(0, '127.0.0.1', () => {
    serverPort = server.address().port;
    createWindow(serverPort);
  });
});

app.on('activate', () => {
  if (serverPort !== null && BrowserWindow.getAllWindows().length === 0) {
    createWindow(serverPort);
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
