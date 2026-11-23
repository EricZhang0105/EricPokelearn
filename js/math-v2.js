/* =========================================================
   PokeLearn · math-v2.js · v71
   新加坡 CPA 教学法 + 高效心算 + 逻辑/空间/专注力训练
   - 视觉组件返回纯 HTML 字符串，题目为纯数据，可序列化进错题本
   - 两种新触屏交互：circle（点图圈选，支持多选）/ match（点击连线配对）
   - 加载顺序：pokemon.js → math-v2.js → data.js（本文件不依赖 data.js 顶层，
     但题目生成函数运行时会用到 mathTip/MATH_PETS 等全局，均在 make() 时才调用）
   所有给孩子看的文字一律英文。
   ========================================================= */

/* ---------------- 序数（1st / 2nd / 3rd ...） ---------------- */
function ord(n){
  n=Number(n)||0;
  const mod100=n%100;
  if(mod100>=11 && mod100<=13) return n+'th';
  const last=n%10;
  return n+({1:'st',2:'nd',3:'rd'}[last]||'th');
}

/* ---------------- CPA 视觉：十格框（ten-frame） ----------------
   两行五列。opts.b>0 时前 n 个蓝点、接着 b 个橙点（加法）；
   opts.remove>0 时末尾若干点划 ✕（减法）。 */
function tenFrame(n,opts){
  opts=opts||{};
  const a=Math.max(0,Number(n)||0), b=Math.max(0,Number(opts.b)||0);
  const rem=Math.max(0,Number(opts.remove)||0);
  const total=Math.min(10,a+b);
  let cells='';
  for(let i=0;i<10;i++){
    let cls='tf-cell', dot='';
    if(i<total){
      const gone = rem>0 && i>=total-rem;
      if(gone){ cls+=' tf-gone'; dot='<span class="tf-dot">✕</span>'; }
      else if(b>0 && i>=a){ cls+=' tf-b'; dot='<span class="tf-dot"></span>'; }
      else { cls+=' tf-a'; dot='<span class="tf-dot"></span>'; }
    }
    cells+='<span class="'+cls+'">'+dot+'</span>';
  }
  return '<div class="ten-frame">'+cells+'</div>';
}

/* ---------------- CPA 视觉：条形图（bar model, part-whole） ----------------
   parts 为各段数值，按占比画不同颜色段。opts.whole 会给总量加一条括号，
   但若该题答案就是总量，请勿传 whole，避免泄题。 */
function barModel(parts,opts){
  opts=opts||{};
  parts=(parts||[]).map(Number);
  const total=parts.reduce((s,x)=>s+x,0)||1;
  let segs='';
  parts.forEach((v,i)=>{
    segs+='<span class="bar-seg bs'+(i%4)+'" style="width:'+(v/total*100)+'%">'
      +'<span class="bar-num">'+v+'</span></span>';
  });
  return '<div class="bar-model">'
    +(opts.whole?'<div class="bar-whole">'+opts.whole+'</div>':'')
    +'<div class="bar-track">'+segs+'</div></div>';
}

/* ---------------- 一排宝可梦（赛跑 / 排队 / 找不同） ----------------
   items: [{id,key,name,pos}]  pos 为可选位置标记（如 '1st'）。 */
function petRow(items,opts){
  opts=opts||{};
  return (opts.title?'<div class="row-title">'+opts.title+'</div>':'')
    +'<div class="pet-row">'+items.map(it=>
      '<div class="pet-card" data-key="'+(it.key||('pk'+it.id))+'">'
      +'<img src="'+pokeImg(it.id)+'" alt="'+it.name+'" loading="lazy">'
      +(it.pos?'<div class="pet-pos">'+it.pos+'</div>':'')
      +'<div class="pet-name">'+it.name+'</div>'
      +'</div>').join('')+'</div>';
}

/* ---------------- 题目生成：CPA 加法（Make-10 专项） ----------------
   Concrete(十格框圆点) → Pictorial(条形图) → Abstract(算式) 同屏呈现。 */
function genCpaAdd(n){
  const out=[];
  for(let i=0;i<n;i++){
    const a=ri(6,9), need=10-a, extra=ri(1,Math.max(1,8-need)), b=need+extra;
    const ans=a+b, pet=mathPet();
    const visual='<div class="cpa-wrap">'
      +'<div class="cpa-label">① See it · ten-frame</div>'
      +tenFrame(a,{b:b})
      +'<div class="cpa-label">② Model it · number bonds</div>'
      +barModel([a,b])
      +'<div class="cpa-eq">'+a+' + '+b+' = ?</div></div>';
    out.push({type:'choice',prompt:'Add with Make-10',sub:'', visual, petKey:petKey(pet),
      speak:{text:a+' plus '+b+' equals what?',lang:'en-US'},
      options:numOptions(ans,10,20), answer:String(ans),
      explain:mathTip('+',a,b,ans), answerSpeak:mathTipSpeak(mathTip('+',a,b,ans)),
      tag:'cpa'});
  }
  return out;
}

/* ---------------- 题目生成：CPA 减法（Think-addition / 退位） ---------------- */
function genCpaSub(n){
  const out=[];
  for(let i=0;i<n;i++){
    const a=ri(11,18), back=a-10, b=ri(Math.min(9,back)+0,9);
    // 保证 b>back（需要退位过十），b<=9 且 <a
    const bb=Math.max(b,back+1);
    const take=Math.min(9,bb), ans=a-take, pet=mathPet();
    const visual='<div class="cpa-wrap">'
      +'<div class="cpa-label">① See it · two ten-frames</div>'
      +tenFrame(10)+tenFrame(a-10,{remove:Math.max(0,take-(a-10))})
      +'<div class="cpa-label">② Model it · whole and parts</div>'
      +barModel([ans,take])
      +'<div class="cpa-eq">'+a+' − '+take+' = ?</div></div>';
    out.push({type:'choice',prompt:'Subtract · back through 10',sub:'', visual, petKey:petKey(pet),
      speak:{text:a+' minus '+take+' equals what?',lang:'en-US'},
      options:numOptions(ans,1,18), answer:String(ans),
      explain:mathTip('-',a,take,ans), answerSpeak:mathTipSpeak(mathTip('-',a,take,ans)),
      tag:'cpa'});
  }
  return out;
}

/* ---------------- 题目生成：Doubles & Near-Doubles ---------------- */
function genDoubles(n){
  const out=[];
  for(let i=0;i<n;i++){
    const near=Math.random()<0.5, x=ri(2,9);
    const a=near?x:x, b=near?x+1:x, ans=a+b, pet=mathPet();
    const tip=near
      ? 'Near double: '+x+' + '+x+' = '+(2*x)+', plus 1 more = '+ans+'. Quick trick!'
      : 'Double: '+x+' + '+x+' = '+ans+'. Two of the same is easy to remember!';
    out.push({type:'choice',prompt:near?'Near doubles':'Doubles',sub:a+' + '+b+' = ?',
      visual:petVisual(a,b,'+',pet), petKey:petKey(pet),
      speak:{text:a+' plus '+b+' equals what?',lang:'en-US'},
      options:numOptions(ans,4,20), answer:String(ans),
      explain:tip, answerSpeak:mathTipSpeak(tip), tag:'mental'});
  }
  return out;
}

/* ---------------- 题目生成：进阶全英文应用题（比较 / 两步 / more-fewer） ---------------- */
function genWordPlus(n){
  const out=[];
  const NAMES=['Sam','Lily','Tom','May','Ben','Ann','Ken','Zoe','Mia','Tim'];
  for(let i=0;i<n;i++){
    const pet=mathPet(), name=pick(NAMES), friend=pick(NAMES.filter(x=>x!==name));
    const mode=ri(0,3);
    let sub,ans,explain,visual;
    if(mode===0){ // how many more (comparison)
      const big=ri(6,14), small=ri(2,big-2);
      sub=name+' has '+big+' '+pet.name+'. '+friend+' has '+small+' '+pet.name+'. How many more '+pet.name+' does '+name+' have?';
      ans=big-small; visual=barModel([small,ans],{});
      explain=big+' − '+small+' = '+ans+'. '+name+' has '+ans+' more.';
    }else if(mode===1){ // altogether (two groups)
      const a=ri(3,11), b=ri(3,11);
      sub=name+' has '+a+' '+pet.name+'. '+friend+' has '+b+' '+pet.name+'. How many '+pet.name+' altogether?';
      ans=a+b; visual=barModel([a,b]);
      explain=a+' + '+b+' = '+ans+' in all.';
    }else if(mode===2){ // two-step: give away then get more
      const a=ri(10,18), give=ri(2,7), get=ri(2,8);
      sub=name+' had '+a+' '+pet.name+'. '+name+' gave '+give+' away, then got '+get+' more. How many '+pet.name+' now?';
      ans=a-give+get; visual=petVisual(a,give,'-',pet);
      explain=a+' − '+give+' = '+(a-give)+', then + '+get+' = '+ans+'. Two steps!';
    }else{ // fewer left
      const a=ri(8,16), b=ri(2,7);
      sub='There were '+a+' '+pet.name+' in the garden. '+b+' flew away. How many '+pet.name+' are left?';
      ans=a-b; visual=petVisual(a,b,'-',pet);
      explain=a+' − '+b+' = '+ans+' left.';
    }
    out.push({type:'choice',prompt:'Read and solve',sub,visual,petKey:petKey(pet),
      speak:{text:sub,lang:'en-US'},
      options:numOptions(ans,Math.max(0,ans-4),ans+4), answer:String(ans),
      explain, answerSpeak:mathTipSpeak(explain), tag:'word'});
  }
  return out;
}

/* ---------------- 题目生成：逻辑 · 赛跑比较（谁最快 / 最慢） ----------------
   用真实全序生成自洽的比较链；faster/slower 表述随机切换但方向一致。
   visual 只展示"选手"横排（顺序打乱，不泄露名次），孩子据文字推理后圈选。 */
function genLogic(n){
  const out=[];
  for(let i=0;i<n;i++){
    const count=ri(3,4);
    const pool=shuffle(MATH_PETS).slice(0,count);
    const rank=shuffle(pool.slice());          // rank[0] 最快
    const shown=shuffle(pool.slice());         // 展示顺序打乱
    const conds=[];
    for(let k=0;k<rank.length-1;k++){
      const fast=rank[k], slow=rank[k+1];
      conds.push(Math.random()<0.5
        ? fast.name+' is faster than '+slow.name+'.'
        : slow.name+' is slower than '+fast.name+'.');
    }
    const askFastest=Math.random()<0.6;
    const ansPet=askFastest?rank[0]:rank[rank.length-1];
    const question=askFastest?'Who runs the fastest?':'Who runs the slowest?';
    const sub=shuffle(conds).join(' ');
    out.push({type:'circle',prompt:question,sub,
      visual:petRow(shown.map(p=>({id:p.id,key:petKey(p),name:p.name})),{title:'The runners'}),
      items:shown.map(p=>({key:petKey(p),label:p.name,img:pokeImg(p.id)})),
      answer:petKey(ansPet),
      speak:{text:sub+' '+question,lang:'en-US'},
      explain:ansPet.name+' is '+(askFastest?'the fastest':'the slowest')+'. '+conds.join(' '),
      answerSpeak:mathTipSpeak(ansPet.name+' is the answer. '+conds.join(' ')),
      tag:'logic'});
  }
  return out;
}

/* ---------------- 题目生成：空间 · 排队位置（含 battle 双选） ---------------- */
function genSpace(n){
  const out=[];
  for(let i=0;i<n;i++){
    const count=ri(5,6);
    const line=shuffle(MATH_PETS).slice(0,count).map((p,idx)=>({
      id:p.id,key:petKey(p),name:p.name,pos:ord(idx+1)}));
    const mode=ri(0,2);
    let question,keys=[],sub,explain,multi=false;
    if(mode===0){
      const k=ri(1,count), who=line[k-1];
      question='Who is '+ord(k)+' in the line?';
      keys=[who.key];
      sub='The Pokémon stand in a line from left to right. Look at the picture.';
      explain=who.name+' is '+ord(k)+' from the left.';
    }else if(mode===1){
      const k=ri(1,count), who=line[count-k];
      question='Who is '+ord(k)+' from the back?';
      keys=[who.key];
      sub='The Pokémon stand in a line. The back is on the right.';
      explain=count+' in line. '+ord(k)+' from the back is '+who.name+'.';
    }else{
      // 从头数第 a 只 与 从尾数第 b 只 battle，圈出两只
      let a,b,p1,p2,guard=0;
      do{
        a=ri(1,count); b=ri(1,count);
        p1=line[a-1]; p2=line[count-b];
      }while(p1.key===p2.key && guard++<30);
      question=ord(a)+' from the front battles '+ord(b)+' from the back. Circle the two that battle!';
      keys=[p1.key,p2.key]; multi=true;
      sub='The front is on the left, the back is on the right. Find both Pokémon.';
      explain=p1.name+' and '+p2.name+' battle. '+ord(a)+' from the front is '+p1.name+'; '+ord(b)+' from the back is '+p2.name+'.';
    }
    out.push({type:'circle',prompt:question,sub,
      visual:petRow(line,{title:'Standing in a line'}),
      items:line.map(it=>({key:it.key,label:it.name,img:pokeImg(it.id),pos:it.pos})),
      answer:keys.sort().join(','), multi,
      speak:{text:sub+' '+question,lang:'en-US'},
      explain, answerSpeak:mathTipSpeak(explain), tag:'space'});
  }
  return out;
}

/* ---------------- 题目生成：专注力 · Look Carefully ----------------
   硬规则：同一题里出现的所有宝可梦必须互不相同 —— 从 12 只 MATH_PETS 里
   shuffle 后取 5~7 只，不再靠"重复同一只"来做找不同/圈同类。
   三种专注力维度改为：
     ① Find by name   —— 听名字，在一排各不相同的宝可梦里视觉扫描找出那只
     ② Find by initial—— 看名字首字母，圈出所有匹配的（multi）
     ③ Count position —— 从左数第 k 只
   key 仍带 '_'+k 后缀，保证 DOM 与判分唯一。 */
function genFocus(n){
  const out=[];
  for(let i=0;i<n;i++){
    const mode=ri(0,2);
    const count=ri(5,7);
    // 一排互不相同的宝可梦（MATH_PETS 有 12 只，够抽 5~7 只不重复）
    let seq=shuffle(MATH_PETS).slice(0,count);
    let question,sub,explain,keys=[],multi=false;
    if(mode===0){
      // ① 按名字找：语音念出名字，孩子在各不相同的一排里视觉扫描
      const target=pick(seq);
      keys=[petKey(target)+'_'+seq.indexOf(target)];
      question='Circle '+target.name+'.';
      sub='Listen and look carefully. Find '+target.name+' in the line.';
      explain=target.name+' is the one to circle. Great looking!';
    }else if(mode===1){
      // ② 按名字首字母找：先锁定一个能凑出 2+ 只的字母组（P/C/S），
      //    保证真的是"圈出所有"而不是退化成单选一只。
      const groups={};
      MATH_PETS.forEach(p=>{ const c=p.name.charAt(0).toUpperCase(); (groups[c]=groups[c]||[]).push(p); });
      const usable=Object.keys(groups).filter(c=>groups[c].length>=2);
      const letter=pick(usable);
      const want=ri(2,Math.min(3,groups[letter].length));
      const hits=shuffle(groups[letter]).slice(0,want);
      const others=shuffle(MATH_PETS.filter(p=>p.name.charAt(0).toUpperCase()!==letter)).slice(0,count-want);
      seq=shuffle(hits.concat(others));   // 两组不相交，拼起来仍然互不重复
      keys=seq.map((p,k)=>p.name.charAt(0).toUpperCase()===letter?petKey(p)+'_'+k:null).filter(Boolean);
      multi=true;
      question='Circle all the Pokémon starting with '+letter+'.';
      sub='Look at the names. Touch every Pokémon that starts with '+letter+'. Do not miss any!';
      explain=letter+': '+hits.map(p=>p.name).join(', ')+'. You found them all!';
    }else{
      // ③ 从左数第 k 只
      const k=ri(2,count-1);
      keys=[petKey(seq[k-1])+'_'+(k-1)];
      question='Circle the '+ord(k)+' one from the left.';
      sub='Count from the left. Which one is '+ord(k)+'?';
      explain='The '+ord(k)+' one from the left is '+seq[k-1].name+'.';
    }
    const items=seq.map((p,k)=>({key:petKey(p)+'_'+k,label:p.name,img:pokeImg(p.id)}));
    const visual=petRow(seq.map((p,k)=>({id:p.id,key:petKey(p)+'_'+k,name:p.name})),{title:'Look at these Pokémon'});
    out.push({type:'circle',prompt:question,sub,visual,items,
      answer:keys.slice().sort().join(','),multi,
      speak:{text:question+' '+sub,lang:'en-US'},
      explain, answerSpeak:mathTipSpeak(explain), tag:'focus'});
  }
  return out;
}

/* ---------------- 题目生成：连线配对（数量↔数字 / 算式↔答案） ----------------
   left: [{id,html}]  right: [{id,label}]
   pairs: {leftId:rightId}  answer: 'L0=R1,L1=R0,...'（排序后序列化，用于判分与去重） */
function genMatch(n){
  const out=[];
  const PAIRS=3;
  for(let i=0;i<n;i++){
    const mode=ri(0,1);
    const vals=[];
    // 生成 3 个互不相同的题面值
    while(vals.length<PAIRS){
      const v=mode===0?ri(2,9):ri(4,15);
      if(!vals.includes(v)) vals.push(v);
    }
    const rightVals=shuffle(vals.slice());
    const left=vals.map((v,k)=>({
      id:'L'+k,
      html: mode===0
        ? tenFrame(v)
        : '<span class="match-eq">'+ri(1,Math.max(1,v-1))+' + '+(v-2)+' = ?</span>'
    }));
    // 算式模式修正：让左式子的答案正好等于 v（用 v-1 + 1 = v）
    if(mode===1) left.forEach((it,k)=>{ it.html='<span class="match-eq">'+(vals[k]-1)+' + 1 = ?</span>'; });
    const right=rightVals.map((v,k)=>({id:'R'+k,label:String(v)}));
    const pairs={}; vals.forEach((v,k)=>{
      pairs['L'+k]='R'+rightVals.indexOf(v);
    });
    // 答案用「排序后的数字组合」：既是对家长可读的答案，又让不同数字组合有不同指纹
    // （判分实际走 q.pairs，不依赖此字段）。rightVals 是vals的乱序，排序后即vals排序。
    const answer=vals.slice().sort((x,y)=>x-y).join(', ');
    const question=mode===0?'Match each ten-frame to its number':'Match each sum to its answer';
    const sub=mode===0?'Count the dots. Draw a line to the right number.':'Work out each sum. Draw a line to the answer.';
    out.push({type:'match',prompt:question,sub,visual:'',left,right,pairs,answer,
      answerKey:vals.join(','),
      speak:{text:question+' '+sub,lang:'en-US'},
      explain:vals.map(v=>String(v)).join(', ')+'. Match them all!',
      answerSpeak:mathTipSpeak('Well done! You matched every pair.'),
      tag:'match'});
  }
  return out;
}

/* ---------------- 课程注册：追加到 MATH 数组末尾（由 data.js 合并） ---------------- */
const MATH_V2 = [
  { id:'m-cpa-add', level:1, title:'CPA · Add with Make-10', emoji:'🧮',
    desc:'See it · model it · solve it (Singapore CPA)', noPool:true,
    make(slots){ return genCpaAdd(Math.max(12,slots||10)); } },
  { id:'m-cpa-sub', level:2, title:'CPA · Subtract', emoji:'🧮',
    desc:'Two ten-frames · back through 10', noPool:true,
    make(slots){ return genCpaSub(Math.max(12,slots||10)); } },
  { id:'m-doubles', level:2, title:'Doubles & Near Doubles', emoji:'⚡',
    desc:'Fast mental tricks: 6+6, 6+7', noPool:true,
    make(slots){ return genDoubles(Math.max(12,slots||10)); } },
  { id:'m-word-plus', level:3, title:'Story Problems · Think', emoji:'📖',
    desc:'Compare · two steps · how many more (all English)', noPool:true,
    make(slots){ return genWordPlus(Math.max(12,slots||10)); } },
  { id:'m-logic', level:2, title:'Logic · Who Is Faster?', emoji:'🏁',
    desc:'Read the clues, circle the fastest or slowest', noPool:true,
    make(slots){ return genLogic(Math.max(14,slots||10)); } },
  { id:'m-space', level:2, title:'Space · In a Line', emoji:'📍',
    desc:'First, last, from the back, who battles whom', noPool:true,
    make(slots){ return genSpace(Math.max(14,slots||10)); } },
  { id:'m-focus', level:1, title:'Look Carefully', emoji:'🔍',
    desc:'Find the different one · circle all · count position', noPool:true,
    make(slots){ return genFocus(Math.max(14,slots||10)); } },
  { id:'m-match', level:1, title:'Match the Pairs', emoji:'🔗',
    desc:'Draw lines: ten-frame ↔ number, sum ↔ answer', noPool:true,
    make(slots){ return genMatch(Math.max(12,slots||10)); } },
];

if(typeof module!=='undefined' && module.exports){
  module.exports={ tenFrame, barModel, petRow, ord,
    genCpaAdd, genCpaSub, genDoubles, genWordPlus, genLogic, genSpace, genFocus, genMatch, MATH_V2 };
}
