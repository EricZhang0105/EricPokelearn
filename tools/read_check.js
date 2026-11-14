#!/usr/bin/env node
/* 阅读理解题库校验：node tools/read_check.js
 * 检查项：
 *   1. id 唯一、level 在 1–3
 *   2. 文章长度落在该级别的词数区间内，且 L1 < L2 < L3 平均长度递增
 *   3. 每篇 4–6 题、至少 3 道选择 + 恰好 1 道短答
 *   4. 选择题答案必须在选项里、选项不重复；短答题 accept 必须包含答案
 *   5. qid 全局唯一（答对记录靠它，重复会导致"已答对的题又出现"）
 * 退出码 0 = 全部通过；1 = 有问题（自动化任务里会当成失败）
 */
const fs=require('fs'), path=require('path'), vm=require('vm');
const root=path.resolve(__dirname,'..');
const file=path.join(root,'js/read-passages.js');

function load(){
  const ctx={console,Math,JSON,Date,Set,Array,Object,String,Number,RegExp,
             localStorage:{getItem:()=>null,setItem:()=>{},removeItem:()=>{}},
             window:{}};
  vm.createContext(ctx);
  // readSet 里用到 data.js 的 shuffle，先塞一个同实现的进去
  vm.runInContext('function shuffle(a){a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}',ctx);
  vm.runInContext(fs.readFileSync(file,'utf8'),ctx,{filename:'js/read-passages.js'});
  // const 声明不会挂到 ctx 上，必须在同一个上下文里取出来
  return vm.runInContext('({P:READ_PASSAGES, INFO:READ_LEVEL_INFO, wc:readWordCount})',ctx);
}

function main(){
  const {P, INFO, wc}=load();
  const errs=[], warns=[];

  // 1. id 唯一
  const ids=new Set();
  P.forEach(p=>{
    if(ids.has(p.id)) errs.push(`id 重复：${p.id}`);
    ids.add(p.id);
    if(![1,2,3].includes(p.level)) errs.push(`${p.id} level 非法：${p.level}`);
    if(!p.title) errs.push(`${p.id} 缺 title`);
    if(!p.text) errs.push(`${p.id} 缺 text`);
  });

  // 2. 长度 / 题型
  const byLevel={1:[],2:[],3:[]};
  P.forEach(p=>{
    const n=wc(p.text);
    byLevel[p.level].push(n);
    const r=INFO[p.level];
    if(n<r.min || n>r.max) warns.push(`${p.id}（L${p.level}）词数 ${n} 超出建议 ${r.min}–${r.max}`);
    const ch=p.qs.filter(x=>!x.short), sh=p.qs.filter(x=>x.short);
    if(p.qs.length<4 || p.qs.length>6) errs.push(`${p.id} 题目数 ${p.qs.length}（应为 4–6）`);
    if(ch.length<3) errs.push(`${p.id} 选择题不足 3 道（${ch.length}）`);
    if(sh.length!==1) errs.push(`${p.id} 短答题应为 1 道（实际 ${sh.length}）`);
    ch.forEach((x,i)=>{
      if(!x.q) errs.push(`${p.id} 第 ${i+1} 题缺题干`);
      if(!Array.isArray(x.o) || x.o.length<2) errs.push(`${p.id} 第 ${i+1} 题选项不足：${x.q}`);
      else{
        if(!x.o.includes(x.a)) errs.push(`${p.id} 第 ${i+1} 题答案不在选项里：${x.q}`);
        if(new Set(x.o).size!==x.o.length) errs.push(`${p.id} 第 ${i+1} 题选项重复：${x.q}`);
      }
    });
    sh.forEach(x=>{
      if(!x.q) errs.push(`${p.id} 短答题缺题干`);
      if(!x.a) errs.push(`${p.id} 短答题缺答案：${x.q}`);
      if(!Array.isArray(x.accept) || !x.accept.includes(x.a))
        errs.push(`${p.id} 短答题 accept 必须包含答案：${x.q}`);
      if(!x.hint) warns.push(`${p.id} 短答题缺 hint：${x.q}`);
    });
  });

  // 3. 平均长度必须逐级变长
  const avg=lv=>{const a=byLevel[lv]; return a.length? a.reduce((s,n)=>s+n,0)/a.length : 0;};
  const a1=avg(1), a2=avg(2), a3=avg(3);
  if(!(a1<a2 && a2<a3)) errs.push(`文章长度没有逐级变长：L1=${a1.toFixed(1)} L2=${a2.toFixed(1)} L3=${a3.toFixed(1)}`);

  // 4. qid 唯一
  const qids=new Map();
  P.forEach(p=>p.qs.forEach(x=>{
    if(!x.qid) errs.push(`${p.id} 有题目没有 qid`);
    else if(qids.has(x.qid)) errs.push(`qid 重复：${x.qid}`);
    else qids.set(x.qid,p.id);
  }));

  const totalQ=P.reduce((n,p)=>n+p.qs.length,0);
  console.log(`短文 ${P.length} 篇 / 题目 ${totalQ} 道`);
  [1,2,3].forEach(lv=>{
    const cnt=P.filter(p=>p.level===lv).length;
    const qs=P.filter(p=>p.level===lv).reduce((n,p)=>n+p.qs.length,0);
    console.log(`  L${lv} ${INFO[lv].label}: ${cnt} 篇 / ${qs} 题 · 平均 ${avg(lv).toFixed(1)} 词`);
  });
  if(warns.length){
    console.log(`\n提示 ${warns.length} 条：`);
    warns.slice(0,12).forEach(w=>console.log('  · '+w));
  }
  if(errs.length){
    console.log(`\n❌ 错误 ${errs.length} 条：`);
    errs.slice(0,30).forEach(e=>console.log('  - '+e));
    process.exit(1);
  }
  console.log('\n✅ read_check 全部通过');
}
main();
