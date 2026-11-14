#!/usr/bin/env node
/* 每周上新：把一批新短文追加进 js/read-passages.js
 * 用法：node tools/add_reading.js new_passages.json
 *
 * JSON 结构（数组，可一次 5 篇）：
 * [
 *   { "id":"rp-week17-1", "level":3, "title":"...", "visual":"🚲",
 *     "text":"...",
 *     "qs":[
 *       {"q":"...","o":["...","...","..."],"a":"..."},
 *       { ...,"short":true,"a":"...","accept":["..."],"hint":"..." } ] }
 * ]
 *
 * 规则：只追加、不改旧内容；id / qid 不能和已有重复；追加后自动跑一遍 read_check。
 * 旧短文的 id 和题目顺序不要动 —— 孩子的"已答对"记录靠 qid 命中。
 */
const fs=require('fs'), path=require('path'), {execFileSync}=require('child_process');
const root=path.resolve(__dirname,'..');
const target=path.join(root,'js/read-passages.js');

const LEVEL_RANGE={1:[10,24],2:[24,44],3:[44,90]};
const wc=t=>String(t||'').trim().split(/\s+/).filter(Boolean).length;

function fail(msg){ console.error('❌ '+msg); process.exit(1); }

const src=process.argv[2];
if(!src) fail('缺少参数：node tools/add_reading.js <new_passages.json>');
const raw=fs.readFileSync(path.isAbsolute(src)?src:path.join(process.cwd(),src),'utf8');
let list;
try{ list=JSON.parse(raw); }catch(e){ fail('JSON 解析失败：'+e.message); }
if(!Array.isArray(list) || !list.length) fail('JSON 必须是数组且至少 1 篇');

// ---- 读出已有 id / qid ----
const file=fs.readFileSync(target,'utf8');
const existIds=new Set([...file.matchAll(/\bid:'([^']+)'/g)].map(m=>m[1]));
const existQids=new Set([...file.matchAll(/\bqid:'([^']+)'/g)].map(m=>m[1]));
// 自动生成的 qid（passageId#n）也要算进去
[...existIds].forEach(id=>{
  const n=(file.match(new RegExp(`id:'${id}'`))||[]).length;
  if(n) for(let i=1;i<=6;i++) existQids.add(`${id}#${i}`);
});

const errs=[];
list.forEach((p,i)=>{
  const tag=p.id||('第'+(i+1)+'篇');
  if(!p.id) errs.push(tag+' 缺 id');
  else if(!/^rp-[a-z0-9-]+$/.test(p.id)) errs.push(tag+' id 建议用 rp-小写字母-数字');
  else if(existIds.has(p.id)) errs.push(tag+' id 已存在');
  if(![1,2,3].includes(p.level)) errs.push(tag+' level 必须是 1/2/3');
  if(!p.title) errs.push(tag+' 缺 title');
  if(!p.visual) errs.push(tag+' 缺 visual（一个 emoji）');
  const n=wc(p.text);
  if(!p.text || n<5) errs.push(tag+' 缺 text');
  else if(LEVEL_RANGE[p.level] && (n<LEVEL_RANGE[p.level][0]-4 || n>LEVEL_RANGE[p.level][1]+8))
    errs.push(`${tag} 词数 ${n} 不在 L${p.level} 建议区间 ${LEVEL_RANGE[p.level].join('–')}`);
  const qs=p.qs||[];
  if(qs.length<4 || qs.length>6) errs.push(tag+' 题目数应为 4–6');
  const ch=qs.filter(x=>!x.short), sh=qs.filter(x=>x.short);
  if(ch.length<3) errs.push(tag+' 至少 3 道选择题');
  if(sh.length!==1) errs.push(tag+' 短答题要 1 道');
  qs.forEach((x,j)=>{
    if(!x.q) errs.push(`${tag} 第${j+1}题缺题干`);
    if(x.short){
      if(!x.a) errs.push(`${tag} 第${j+1}题短答缺答案`);
      if(!Array.isArray(x.accept) || !x.accept.includes(x.a)) errs.push(`${tag} 第${j+1}题 accept 必须含答案`);
      if(!x.hint) errs.push(`${tag} 第${j+1}题短答缺 hint`);
    }else{
      if(!Array.isArray(x.o) || x.o.length<2) errs.push(`${tag} 第${j+1}题选项不足`);
      else if(!x.o.includes(x.a)) errs.push(`${tag} 第${j+1}题答案不在选项里`);
      else if(new Set(x.o).size!==x.o.length) errs.push(`${tag} 第${j+1}题选项重复`);
    }
  });
  qs.forEach((x,j)=>{
    const qid=`${p.id}#${j+1}`;
    if(existQids.has(qid)) errs.push('qid 冲突：'+qid);
  });
});
if(errs.length){
  console.error('❌ 校验失败：');
  errs.forEach(e=>console.error('  - '+e));
  process.exit(1);
}

// ---- 序列化成 JS 字面量（2 空格缩进，保持可读）----
function toJs(p){
  const body=JSON.stringify(p,null,2).split('\n').join('\n  ');
  return '  '+body+',\n';
}
const block=list.map(toJs).join('');

// ---- 插到 READ_PASSAGES 数组结尾（第一个顶格 "];" 之前）----
const startIdx=file.indexOf('const READ_PASSAGES = [');
if(startIdx<0) fail('在 read-passages.js 里找不到 READ_PASSAGES 数组');
const closeIdx=file.indexOf('\n];', startIdx);
if(closeIdx<0) fail('找不到 READ_PASSAGES 的结尾 "];"');
const out=file.slice(0,closeIdx+1)+block+file.slice(closeIdx+1);
fs.writeFileSync(target,out,'utf8');

console.log(`已追加 ${list.length} 篇：`+list.map(p=>p.id).join(', '));
try{
  execFileSync(process.execPath,[path.join(root,'tools/read_check.js')],{stdio:'inherit'});
}catch(e){
  console.error('⚠️ 追加完成但 read_check 未通过，请修正后再提交');
  process.exit(1);
}
