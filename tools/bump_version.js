#!/usr/bin/env node
/* 升 Service Worker 缓存版本 + package.json 版本。
   每次云端上新后必须调用：iPad 主屏书签重开时会清掉旧缓存、拿到新题库。 */
const fs=require('fs'), path=require('path');
const ROOT=path.resolve(__dirname,'..');
const swPath=path.join(ROOT,'sw.js'), pjPath=path.join(ROOT,'package.json');
let sw=fs.readFileSync(swPath,'utf8');
const m=sw.match(/pokelearn-v(\d+)/);
if(!m) throw new Error('sw.js 里找不到 pokelearn-vN');
const from=Number(m[1]), to=from+1;
sw=sw.replace('pokelearn-v'+from,'pokelearn-v'+to);
sw=sw.replace(/缓存策略（v\d+）/, '缓存策略（v'+to+'）');
fs.writeFileSync(swPath,sw,'utf8');
let pj=fs.readFileSync(pjPath,'utf8');
pj=pj.replace(/"version":\s*"\d+\.0\.0"/, '"version": "'+to+'.0.0"');
fs.writeFileSync(pjPath,pj,'utf8');
console.log(`版本 v${from} → v${to}`);
