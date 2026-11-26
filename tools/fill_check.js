/* v82 凑十 / 破十「手绘作业本填空」回归测试
 *   node tools/fill_check.js
 *
 * 校验：
 *   1) fill 结构严格照手绘图：SVG 连线 + 方框，凑十从第二个数分叉、破十从第一个数分叉
 *   2) 下方常驻 0–10 数字条（11 个数字 + 清空键），每个 slot 的候选都是 0–10
 *   3) 答案框可连点两次输入两位数（1 → 7 = 17），其余框只收一位
 *   4) app.js 渲染分支 / bindFill 接线、CSS 连线与触摸目标
 *   5) 用假 DOM 真跑 bindFill：答对计分、答错写回正确答案、填完锁定
 */
const fs=require('fs'), path=require('path'), vm=require('vm');
const R=path.resolve(__dirname,'..');
const F=rel=>fs.readFileSync(path.join(R,rel),'utf8');
let pass=0,fail=0;
const ok=(n,c,extra)=>{ if(c){pass++;console.log('  PASS',n);}else{fail++;console.log('  FAIL',n,extra===undefined?'':extra);} };
const hasCJK=s=>/[\u3400-\u9fff]/.test(String(s||''));
const DIGITS=Array.from({length:11},(_,i)=>String(i));

/* ---- VM 加载依赖链 ---- */
const ctx={console,Math,JSON,Date,Set,Map,Array,Object,String,Number,
  setTimeout,clearTimeout,localStorage:{getItem:()=>null,setItem:()=>{},removeItem:()=>{}},
  document:{querySelectorAll:()=>[]},navigator:{userAgent:'node'}};
ctx.globalThis=ctx;ctx.window=ctx;vm.createContext(ctx);
for(const f of ['js/pokemon.js','js/zh-phonics.js','js/phonics-sounds.js','js/math-v2.js','js/data.js']){
  vm.runInContext(F(f),ctx,{filename:f});
}
const genCpaAdd=vm.runInContext('genCpaAdd',ctx);
const genCpaSub=vm.runInContext('genCpaSub',ctx);
const make10Parts=vm.runInContext('make10Parts',ctx);
const break10Parts=vm.runInContext('break10Parts',ctx);
const make10Solution=vm.runInContext('make10Solution',ctx);
const subtractSolution=vm.runInContext('subtractSolution',ctx);

console.log('\n=== 1. 手绘样式结构 ===');
const add=genCpaAdd(1)[0], sub=genCpaSub(1)[0];
ok('凑十题有 SVG 连线层与五等分算式',/class="fs-lines"/.test(add.fill.html)
  &&/class="fs-eq"/.test(add.fill.html)&&/class="fs-stage"/.test(add.fill.html));
ok('破十题有 SVG 连线层与五等分算式',/class="fs-lines"/.test(sub.fill.html)
  &&/class="fs-eq"/.test(sub.fill.html)&&/class="fs-stage"/.test(sub.fill.html));
ok('凑十：从第二个数(50%)分叉 + 第一个数(10%)竖线连到 10',
  /M50 15 L31 45 M50 15 L72 45/.test(add.fill.html)
  &&/M10 15 L10 82/.test(add.fill.html)&&/M10 58 L31 58/.test(add.fill.html));
ok('破十：从第一个数(10%)分叉 + 10 横连减数 + 零头加回来',
  /M10 15 L25 45 M10 15 L52 45/.test(sub.fill.html)
  &&/M52 45 L88 45 M88 45 L88 62/.test(sub.fill.html)
  &&/M25 55 L25 82 M25 82 L52 82/.test(sub.fill.html));
ok('运算符 + / − 画在连线上',add.fill.html.includes('>+</span>')
  &&sub.fill.html.includes('>−</span>')&&sub.fill.html.includes('>+</span>'));
ok('每个方框只有一个 data-slot（连线代替重复方框）',(()=>{
  const a=(add.fill.html.match(/data-slot="/g)||[]).length;
  const s=(sub.fill.html.match(/data-slot="/g)||[]).length;
  return a===3&&s===3;
})());
ok('答案框 data-max=2，拆数框不限定',/data-slot="ans"[^>]*data-max="2"/.test(add.fill.html)
  &&/data-slot="need"[^>]*aria-label/.test(add.fill.html)
  &&/data-slot="rest"[^>]*aria-label/.test(sub.fill.html));
ok('解题文案全英文',!hasCJK(add.fill.html)&&!hasCJK(sub.fill.html));

console.log('\n=== 2. 固定 0–10 数字条 ===');
function barVals(html){
  return (html.match(/class="fill-num[^"]*" data-v="([^"]*)"/g)||[])
    .map(x=>x.match(/data-v="([^"]*)"/)[1]);
}
ok('凑十数字条 = 0..10 + 清空键',JSON.stringify(barVals(add.fill.html))===JSON.stringify(DIGITS.concat([''])));
ok('破十数字条 = 0..10 + 清空键',JSON.stringify(barVals(sub.fill.html))===JSON.stringify(DIGITS.concat([''])));
ok('每个 slot 的候选都是完整 0..10',[add.fill,sub.fill].every(f=>
  Object.keys(f.expect).every(k=>JSON.stringify(f.options[k])===JSON.stringify(DIGITS))));
ok('hint 文案说明两步思路',/fs-hintline/.test(add.fill.html)&&/fs-hintline/.test(sub.fill.html));

console.log('\n=== 3. 算法与答案一致性 ===');
let addOk=true,subOk=true;
for(let r=0;r<160;r++){
  const a=genCpaAdd(14)[0], h=a.solutionHtml;
  const need=Number((h.match(/sol-need">(\d+)</)||[])[1]);
  const left=Number((h.match(/sol-left">(\d+)</)||[])[1]);
  const ans=Number((h.match(/sol-ans">(\d+)</)||[])[1]);
  const big=Number((h.match(/sol-eq">(\d+) \+ /)||[])[1]);
  const p=make10Parts(big,need+left);
  if(!(need>0&&left>0&&big+need===10&&need+left+big===ans
       &&a.fill.expect.need===String(need)&&a.fill.expect.left===String(left)
       &&a.fill.expect.ans===String(ans))) addOk=false;
  const b=genCpaSub(14)[0], s=b.solutionHtml;
  const ones=Number((s.match(/sol-need">(\d+)</)||[])[1]);
  const rest=Number((s.match(/sol-ten">(\d+)</)||[])[1]);
  const an=Number((s.match(/sol-ans">(\d+)</)||[])[1]);
  const whole=Number((s.match(/(\d+) = \d+ \+ 10/)||[])[1]);
  const take=Number((s.match(/10 − (\d+)/)||[])[1]);
  const q=break10Parts(whole,take);
  if(!(q.ones===ones&&q.rest===rest&&q.ans===an&&ones+rest===an
       &&b.fill.expect.ones===String(ones)&&b.fill.expect.rest===String(rest)
       &&b.fill.expect.ans===String(an))) subOk=false;
}
ok('160 道凑十：填空预期 = 解题图 = 算式',addOk);
ok('160 道破十：填空预期 = 解题图 = 算式',subOk);
ok('13−5 = 3 + 10 → 10−5=5 → 3+5=8',(()=>{
  const p=break10Parts(13,5);
  return p.ones===3&&p.rest===5&&p.ans===8&&subtractSolution(13,5).includes('3 + 5');
})());
ok('两数相同时不说“8 is bigger than 8”',(()=>{
  const h=make10Solution(8,8);
  return h.includes('Both numbers are 8')&&!h.includes('8 is bigger than 8');
})());
ok('fill 可 JSON 序列化',(()=>{try{JSON.stringify([add,sub]);return true;}catch(e){return false;}})());

console.log('\n=== 4. app / CSS 接线 ===');
const app=F('js/app.js'), css=F('css/styles.css');
ok('渲染分支把 0–10 数字条随 fill.html 一起输出',/if\(q\.fill && q\.fill\.html\)\{\s*\/\*[\s\S]{0,120}h\+=q\.fill\.html/.test(app));
ok('choice 题按 fill 走 bindFill',/if\(q\.fill && q\.fill\.html\)\{\s*bindFill\(q,item\);/.test(app));
ok('bindFill 从数字条读 .fill-num',/bar\.querySelectorAll\('\.fill-num'\)/.test(app));
ok('两位数用 values[active]+=v 拼接',/maxOf\[active\]>1[\s\S]{0,160}values\[active\]\+=v/.test(app));
ok('填满才启用 Check',/btn\.disabled=!allFilled\(\)/.test(app));
ok('判错写回正确答案',/c\.classList\.add\('wrong'\);[\s\S]{0,80}c\.textContent=want/.test(app));
ok('CSS 有 SVG 连线 / 方框 / 0–10 数字条样式',/\.fs-lines path\{/.test(css)
  &&/\.fs-sign\{/.test(css)&&/\.fs-stage\{/.test(css)&&/\.fill-picker\{/.test(css)
  &&/\.fill-num\{/.test(css));
ok('方框触摸目标 ≥52px',/\.fs-btn\{[\s\S]{0,260}min-height:52px/.test(css));

console.log('\n=== 5. 真跑 bindFill：答对 / 答错 ===');
const src=app.match(/function bindFill\(q,item\)\{[\s\S]*?\n\}/);
ok('能抽到 bindFill 函数源码',!!src);
if(src){
  function el(dataset,cls){
    const s=new Set(String(cls||'').split(/\s+/).filter(Boolean));
    return {dataset,textContent:'?',disabled:false,style:{},onclick:null,
      classList:{add:(...n)=>n.forEach(x=>s.add(x)),remove:(...n)=>n.forEach(x=>s.delete(x)),
        toggle:(n,on)=>{if(on===undefined){s.has(n)?s.delete(n):s.add(n);}else{on?s.add(n):s.delete(n);}},
        contains:n=>s.has(n)}};
  }
  function runCase(q,pickWrong){
    const cells=[],digits=[];
    let m,re=/<button type="button" class="([^"]*fs-btn[^"]*)" data-slot="([^"]+)"([^>]*)>/g;
    while((m=re.exec(q.fill.html))){
      const mx=m[3].match(/data-max="(\d+)"/);
      cells.push(el({slot:m[2],...(mx?{max:mx[1]}:{})},m[1]));
    }
    re=/<button type="button" class="([^"]*fill-num[^"]*)" data-v="([^"]*)">/g;
    while((m=re.exec(q.fill.html))) digits.push(el({v:m[2]},m[1]));
    const card={querySelectorAll:sel=>sel==='.fs-btn'?cells:[]};
    const bar={querySelectorAll:sel=>sel==='.fill-num'?digits:[]};
    const btn={disabled:true,onclick:null};
    const state={idx:0,settled:{},correct:0};
    const calls={onCorrect:0,fbGood:0,bad:0,wrongUser:''};
    const c={console,Math,JSON,Date,Set,Map,Array,Object,String,Number,state,
      $:sel=>({'#fillCard':card,'#fillPicker':bar,'#fillCheck':btn})[sel]||null,
      onCorrect:()=>{calls.onCorrect++;},
      recordWrong:(item,v)=>{calls.wrongUser=String(v);},
      sfx:()=>{},
      showFeedback:good=>{if(good)calls.fbGood++;else calls.bad++;}
    };
    c.globalThis=c;vm.createContext(c);
    vm.runInContext(src[0]+'\n;globalThis.bindFill=bindFill;',c,{filename:'bindFill.js'});
    c.bindFill(q,{q});
    const first=btn.disabled;
    const choose=(slot,vals)=>{
      cells.find(x=>x.dataset.slot===slot).onclick();
      vals.forEach(v=>digits.find(x=>x.dataset.v===String(v)).onclick());
    };
    const e=q.fill.expect, keys=Object.keys(e);
    const ansVals=e.ans.length===2?[e.ans[0],e.ans[1]]:[e.ans];
    choose(keys[0],ansVals);
    choose(keys[1],[pickWrong?String((Number(e[keys[1]])+1)%10):e[keys[1]]]);
    choose(keys[2],[e[keys[2]]]);
    const ready=btn.disabled;
    btn.onclick();
    return {cells,digits,btn,state,calls,first,ready,expect:e};
  }

  [['凑十',add],['破十',sub]].forEach(([name,q])=>{
    const A=runCase(q,false);
    ok(name+'：未填满时 Check 禁用',A.first===true&&A.ready===false);
    ok(name+'：连点数字输入正确两位数并完成判对',A.calls.onCorrect===1&&A.calls.fbGood===1
      &&A.calls.bad===0&&A.state.correct===1&&A.state.settled[0].correct===true);
    ok(name+'：答案框显示完整答案',A.cells.find(c=>c.dataset.slot==='ans').textContent===A.expect.ans);
    const B=runCase(q,true);
    ok(name+'：填错判错并写回正确答案、记入错题',B.calls.bad===1&&B.calls.onCorrect===0
      &&B.state.settled[0].correct===false&&/=/.test(B.calls.wrongUser)
      &&B.cells.find(c=>c.dataset.slot==='ans').textContent===B.expect.ans);
    ok(name+'：判完锁定方框与数字条',B.btn.disabled===true&&B.cells.every(c=>c.disabled)
      &&B.digits.every(d=>d.disabled));
  });
}

console.log('\n========== 结果: '+pass+' PASS / '+fail+' FAIL ==========');
process.exit(fail?1:0);
