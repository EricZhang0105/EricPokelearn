/* 一次性工具：把 PokeAPI 官方精灵图下载到本地 img/pokemon/（WebP）
 * 本地化后 App 完全自包含，断网 / 新加坡网络都稳。
 * 运行： node fetch_sprites.js     （已存在的会自动跳过）
 * 依赖： tools/make_webp.py + Pillow（受管 venv）
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execFileSync } = require('child_process');

const SRC   = path.join(__dirname, 'js', 'pokemon.js');
const OUT   = path.join(__dirname, 'img', 'pokemon');
const PY    = '/Users/eric.zhang/.workbuddy/binaries/python/envs/default/bin/python';
const CONV  = path.join(__dirname, 'tools', 'make_webp.py');
const BASE  = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/';

fs.mkdirSync(OUT, { recursive: true });

/* 直接执行图库文件，收集所有形态（含分支）的官方图 ID */
const ctx = { console }; ctx.globalThis = ctx; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(SRC,'utf8') + '\n;globalThis.__PK=POKEMON;', ctx);
const ids = [...new Set(ctx.__PK.flatMap(pk =>
  pk.stages.flatMap(s => Array.isArray(s) ? s.map(f=>f.imgId) : [s.imgId])
))].sort((a,b)=>a-b);
console.log(`发现 ${ctx.__PK.length} 条进化链 / ${ids.length} 张精灵图`);

function toWebp(png, webp){
  execFileSync(PY, [CONV, png, webp], { stdio:'ignore' });
  // 保留 PNG（避免批量删除触发文件保护）；转换完可用 tools 里的一次性清理移走
}

(async () => {
  let ok=0, skip=0; const fail=[];
  for(const id of ids){
    const webp = path.join(OUT, `${id}.webp`);
    const png  = path.join(OUT, `${id}.png`);
    if(fs.existsSync(webp) && fs.statSync(webp).size>500){ skip++; continue; }
    try{
      if(fs.existsSync(png) && fs.statSync(png).size>1000){
        toWebp(png, webp);                       // 复用已有 PNG
      }else{
        const res = await fetch(BASE+id+'.png');
        if(!res.ok) throw new Error('HTTP '+res.status);
        fs.writeFileSync(png, Buffer.from(await res.arrayBuffer()));
        toWebp(png, webp);
      }
      ok++;
    }catch(e){ fail.push(id+':'+e.message); }
  }
  console.log(`完成：新生成 ${ok}，跳过 ${skip}，失败 ${fail.length}`);
  if(fail.length) console.log(fail.join('\n'));
  const files=fs.readdirSync(OUT);
  const total=files.reduce((s,f)=>s+fs.statSync(path.join(OUT,f)).size,0);
  console.log(`共 ${files.length} 个文件，总大小 ${(total/1024/1024).toFixed(2)} MB`);
})();
