/* v81 凑十 / 破十「方框填空」回归测试
 *   node tools/fill_check.js
 *
 * 校验：
 *   1) genCpaAdd / genCpaSub 产出的 fill 结构与手绘解题逻辑一致
 *      （凑十拆小数 → 9+1=10；破十拆被减数 → 13=3+10, 10−5=5, 3+5=8）
 *   2) 每个空格的候选数字含正确答案，答案可 JSON 序列化，文案全英文
 *   3) app.js 真把 fill.html 渲染成可点方框，并走 bindFill 判分（不是老选项按钮）
 *   4) 用假 DOM 真跑 bindFill：填满后 Check 判对；填错时写回正确答案并计入错题
 *   5) CSS 触摸目标与选中/对错样式齐全
 */
const fs=require('fs'), path=require('path'), vm=require('vm');
const R=path.resolve(__dirname,'..');
const F=rel=>fs.readFileSync(path.join(R,rel),'utf8');
let pass=0,fail=0;
const ok=(n,c,extra)=>{ if(c){pass++;console.log('  PASS',n);}else{fail++;console.log('  FAIL',n,extra===undefined?'':extra);} };
const CJK=/[\u3400-\u9fff]/;
const hasCJK=s=>CJK.test(String(s||''));

/* ---- 加载数学模块（math-v2.js 顶层声明，VM 里可直接取函数） ---- */
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
const subtractSolution=vm.runInContext('subtractSolution',ctx);
const make10Solution=vm.runInContext('make10Solution',ctx);

console.log('\n=== 1. 凑十填空 ===');
let addOk=true,addN=0;
for(let r=0;r<160;r++){
  const q=genCpaAdd(14)[0];
  const f=q.fill;
  if(!f||f.kind!=='add'){addOk=false;break;}
  const e=f.expect;
  // 从 solutionHtml 反推本题的 big/small/need/left（生成器不暴露 a/b）
  const h=q.solutionHtml;
  const need=Number((h.match(/sol-need">(\d+)</)||[])[1]);
  const left=Number((h.match(/sol-left">(\d+)</)||[])[1]);
  const ans=Number((h.match(/sol-ans">(\d+)</)||[])[1]);
  const big=Number((h.match(/sol-eq">(\d+) \+ /)||[])[1]);
  if(!(need>0&&left>0&&big+need===10&&need+left+big===ans)){addOk=false;break;}
  if(e.need!==String(need)||e.left!==String(left)||e.ans!==String(ans)){addOk=false;break;}
  if(!q.options.includes(String(ans))){addOk=false;break;}
  if(['need','left','ans'].some(k=>{
    const list=f.options[k]||[];
    return list.length<2||list.length>3||!list.includes(String(e[k]))
      ||new Set(list).size!==list.length||!list.every(v=>/^\d+$/.test(v));
  })){addOk=false;break;}
  const slots=(f.html.match(/data-slot="([a-z]+)"/g)||[]);
  if(slots.filter(x=>x==='data-slot="need"').length!==2
     ||slots.filter(x=>x==='data-slot="left"').length!==2
     ||slots.filter(x=>x==='data-slot="ans"').length!==2){addOk=false;break;}
  if(hasCJK(f.html)){addOk=false;break;}
  addN++;
}
ok('160 道凑十题 fill 结构 / 算式 / 候选全正确',addOk&&addN===160,'n='+addN);
ok('两数相同时不说“8 is bigger than 8”',(()=>{
  const h=make10Solution(8,8);
  return h.includes('Both numbers are 8')&&!h.includes('8 is bigger than 8');
})());
ok('凑十填空有作业本式方框与拆数图',(()=>{
  const f=genCpaAdd(1)[0].fill;
  return /id="fillCard"/.test(f.html)&&/fs-eq/.test(f.html)&&/fs-bond-wrap/.test(f.html)
    &&/fs-step/.test(f.html)&&/class="fs-btn"/.test(f.html);
})());
ok('凑十拆分满足 big+need=10、small=need+left',(()=>{
  for(let a=6;a<=9;a++)for(let need=10-a;need<=8;need++){
    const b=need+(8-need),p=make10Parts(a,b);
    if(p.big+p.need!==10||p.need+p.left!==p.small||p.big+p.small!==p.ans) return false;
  }
  return true;
})());

console.log('\n=== 2. 破十填空 ===');
let subOk=true,subN=0;
for(let r=0;r<160;r++){
  const q=genCpaSub(14)[0], f=q.fill;
  if(!f||f.kind!=='sub'){subOk=false;break;}
  const h=q.solutionHtml;
  const ones=Number((h.match(/sol-need">(\d+)</)||[])[1]);
  const rest=Number((h.match(/sol-ten">(\d+)</)||[])[1]);
  const ans=Number((h.match(/sol-ans">(\d+)</)||[])[1]);
  const a=Number((h.match(/(\d+) = \d+ \+ 10/)||[])[1]);
  const take=Number((h.match(/10 − (\d+)/)||[])[1]);
  const p=break10Parts(a,take);
  if(p.ones!==ones||p.rest!==rest||p.ans!==ans||ones+rest!==ans){subOk=false;break;}
  const e=f.expect;
  if(e.ones!==String(ones)||e.rest!==String(rest)||e.ans!==String(ans)){subOk=false;break;}
  if(!q.options.includes(String(ans))){subOk=false;break;}
  if(['ones','rest','ans'].some(k=>{
    const list=f.options[k]||[];
    return list.length<2||list.length>3||!list.includes(String(e[k]));
  })){subOk=false;break;}
  const slots=(f.html.match(/data-slot="([a-z]+)"/g)||[]);
  if(slots.filter(x=>x==='data-slot="ones"').length!==2
     ||slots.filter(x=>x==='data-slot="rest"').length!==2
     ||slots.filter(x=>x==='data-slot="ans"').length!==2){subOk=false;break;}
  if(hasCJK(f.html)){subOk=false;break;}
  subN++;
}
ok('160 道破十题 fill 结构 / 算式 / 候选全正确',subOk&&subN===160,'n='+subN);
ok('破十填空按用户手绘：拆被减数 + 10−减数 + 零头相加',(()=>{
  const f=genCpaSub(1)[0].fill;
  return /id="fillCard"/.test(f.html)&&/class="fill-card fill-sub"/.test(f.html)
    &&/fs-ten">10</.test(f.html)&&/10 − /.test(f.html);
})());
ok('13−5 的填空预期值 = 3 / 5 / 8',(()=>{
  const p=break10Parts(13,5);
  return p.ones===3&&p.rest===5&&p.ans===8&&subtractSolution(13,5).includes('3 + 5');
})());
ok('fill 对象可 JSON 序列化',(()=>{
  try{ JSON.stringify([genCpaAdd(1)[0],genCpaSub(1)[0]]); return true; }catch(e){ return false; }
})());

console.log('\n=== 3. app.js 渲染与判题接线 ===');
const app=F('js/app.js');
ok('渲染分支优先识别 q.fill.html',/if\(q\.fill && q\.fill\.html\)\{[\s\S]{0,300}id="fillPicker"/.test(app));
ok('渲染 Check 按钮且初始 disabled',/id="fillCheck" disabled>/.test(app));
ok('choice 题按 fill 走 bindFill',/if\(q\.fill && q\.fill\.html\)\{\s*bindFill\(q,item\);/.test(app));
ok('bindFill 按 data-slot 找方框',/querySelectorAll\('\.fs-btn'\)/.test(app));
ok('候选数字来自 q.fill.options',/\(opts\[active\]\|\|\[\]\)/.test(app));
ok('填满才启用 Check',/btn\.disabled=!allFilled\(\)/.test(app));
ok('判错时写回正确答案',/c\.classList\.add\('wrong'\);[\s\S]{0,80}c\.textContent=want/.test(app));
ok('判分沿用 onCorrect / recordWrong / showFeedback',/onCorrect\(item\)/.test(app)
  &&/recordWrong\(item,Object\.keys\(got\)/.test(app)&&/showFeedback\(true,q\.explain\)/.test(app));
ok('CSS 有填充方框 / 候选区 / 选中与对错样式',(()=>{
  const css=F('css/styles.css');
  return /\.fs-btn\{/.test(css)&&/\.fs-btn\.active\{/.test(css)&&/\.fs-btn\.correct\{/.test(css)
    &&/\.fs-btn\.wrong\{/.test(css)&&/\.fill-picker\{/.test(css)&&/\.fill-num\{/.test(css);
})());
ok('触摸目标 ≥46px（iPad 防点偏）',/\.fs-btn\{[\s\S]{0,320}min-height:52px/.test(F('css/styles.css')));

console.log('\n=== 4. 真跑 bindFill：答对 / 答错 ===');
const src=app.match(/function bindFill\(q,item\)\{[\s\S]*?\n\}/);
ok('能抽到 bindFill 函数源码',!!src);
if(src){
  const mkClass=()=>{
    const s=new Set();
    return {add:(...n)=>n.forEach(x=>s.add(x)),remove:(...n)=>n.forEach(x=>s.delete(x)),
      toggle:(n,on)=>{ if(on===undefined){s.has(n)?s.delete(n):s.add(n);}else{on?s.add(n):s.delete(n);} },
      contains:n=>s.has(n)};
  };
  function runCase(q,pickWrong){
    const keys=Object.keys(q.fill.expect);
    const cells=keys.concat(keys).map(slot=>({
      dataset:{slot},textContent:'?',disabled:false,style:{},onclick:null,classList:mkClass()}));
    const picker={
      innerHTML:'',_html:null,_chips:[],
      querySelectorAll(){
        /* 真实 DOM 里同一批按钮对象是稳定的：innerHTML 没变就返回同一组，
           否则 bindFill 刚绑的 onclick 会在下次查询时丢失。 */
        if(this._html!==this.innerHTML){
          this._html=this.innerHTML;this._chips=[];
          const re=/data-v="([^"]*)"/g;let m;
          while((m=re.exec(this.innerHTML))){
            this._chips.push({dataset:{v:m[1]},onclick:null,classList:mkClass()});
          }
        }
        return this._chips;
      }
    };
    const btn={disabled:true,onclick:null};
    const state={idx:0,settled:{},correct:0};
    const calls={onCorrect:0,fbGood:0,bad:0,wrongUser:'',explain:''};
    const c={
      console,Math,JSON,Date,Set,Map,Array,Object,String,Number,
      state,
      $:sel=>({'#fillCard':{querySelectorAll:()=>cells},'#fillPicker':picker,'#fillCheck':btn})[sel]||null,
      onCorrect:()=>{calls.onCorrect++;},
      recordWrong:(item,v)=>{calls.wrongUser=String(v);},
      sfx:()=>{},
      showFeedback:(good,explain)=>{ if(good)calls.fbGood++;else{calls.bad++;calls.explain=explain||'';} }
    };
    c.globalThis=c;vm.createContext(c);
    vm.runInContext(src[0]+'\n;globalThis.bindFill=bindFill;',c,{filename:'bindFill.js'});
    c.bindFill(q,{q});
    const first=btn.disabled;
    const choose=(slot,val)=>{
      const cell=cells.find(x=>x.dataset.slot===slot&&x.classList.contains('filled')===false);
      cell.onclick();
      const chip=picker.querySelectorAll().find(x=>x.dataset.v===String(val));
      if(!chip) throw new Error('no chip '+slot+'='+val+' in '+picker.innerHTML);
      chip.onclick();
    };
    const e=q.fill.expect;
    const wrongAns=q.fill.options.ans.find(v=>v!==String(e.ans));
    choose(keys[0],pickWrong?wrongAns:e.ans);
    choose(keys[1],e[keys[1]]);
    choose(keys[2],e[keys[2]]);
    const ready=btn.disabled;
    btn.onclick();
    return {cells,picker,btn,state,calls,first,ready};
  }

  const qAdd=genCpaAdd(1)[0], qSub=genCpaSub(1)[0];
  [['凑十',qAdd],['破十',qSub]].forEach(([name,q])=>{
    const A=runCase(q,false);
    ok(name+'：未填满时 Check 禁用',A.first===true&&A.ready===false);
    ok(name+'：填对后判对、计分、写快照',A.calls.onCorrect===1&&A.calls.fbGood===1
      &&A.calls.bad===0&&A.state.correct===1&&A.state.settled[0].correct===true);
    ok(name+'：同一 slot 两处方框同步填值',A.cells.filter(c=>c.dataset.slot==='ans')
      .every(c=>c.textContent===q.fill.expect.ans));
    const B=runCase(q,true);
    ok(name+'：填错时判错、写回正确答案、记入错题',B.calls.bad===1&&B.calls.onCorrect===0
      &&B.state.settled[0].correct===false&&/ans=/.test(B.calls.wrongUser)
      &&B.cells.find(c=>c.dataset.slot==='ans').textContent===q.fill.expect.ans);
    ok(name+'：判完锁定方框与候选区',B.btn.disabled===true&&B.cells.every(c=>c.disabled===true)
      &&B.picker.innerHTML==='' );
  });
}

console.log('\n========== 结果: '+pass+' PASS / '+fail+' FAIL ==========');
process.exit(fail?1:0);
