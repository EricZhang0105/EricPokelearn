/* PokeLearn 本地服务器
 * 用途：用 http:// 打开应用，localStorage 才会稳定持久化（file:// 下 iOS Safari 会丢）。
 *       若部署到 https（如 GitHub Pages），还能把应用装到 iPad 主屏离线使用。
 * 运行： node serve.js       然后浏览器打开 http://localhost:8000
 *       iPad 同 WiFi：浏览器打开 http://<电脑IP>:8000
 */
const http = require('http');
const fs   = require('fs');
const path = require('path');
const os   = require('os');

const ROOT = __dirname;
const PORT = process.env.PORT || 8000;

const MIME = {
  '.html':'text/html; charset=utf-8',
  '.js':'text/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8',
  '.json':'application/json; charset=utf-8',
  '.webmanifest':'application/manifest+json; charset=utf-8',
  '.png':'image/png', '.jpg':'image/jpeg', '.svg':'image/svg+xml',
  '.ico':'image/x-icon', '.woff2':'font/woff2'
};

const server = http.createServer((req, res) => {
  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath === '/') urlPath = '/index.html';
  // 防目录穿越
  const filePath = path.join(ROOT, path.normalize(urlPath).replace(/^(\.\.[/\\])+/, ''));
  if (!filePath.startsWith(ROOT)) { res.writeHead(403); res.end('Forbidden'); return; }

  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream',
                         'Cache-Control': 'no-cache' });
    res.end(data);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  const nets = os.networkInterfaces();
  const ips = [];
  for (const k in nets) for (const n of nets[k])
    if (n.family === 'IPv4' && !n.internal) ips.push(n.address);
  console.log('PokeLearn running:');
  console.log('  Local:   http://localhost:' + PORT);
  ips.forEach(ip => console.log('  iPad:    http://' + ip + ':' + PORT + '  (same WiFi)'));
  console.log('\nPress Ctrl+C to stop.');
});
