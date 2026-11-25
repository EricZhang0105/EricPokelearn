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

/* ---------------- v76 · 凑十法解题图（Make-10 solution） ----------------
   按 Eric 手绘思路：8+7 → 因为 8 比 7 大，留大数 8，把小数 7 拆成
   「凑十的数 + 剩下的数」(7 = 2 + 5)，先 8+2=10，再 10+5=15。
   返回纯 HTML，答对后显示在题目下方，孩子看图即可理解拆/合关系。 */
function make10Solution(a,b){
  const big=Math.max(a,b), small=Math.min(a,b);
  const need=10-big, left=small-need;          // 把小数拆成 need + left
  const ans=a+b;
  return '<div class="sol-card">'
    +'<div class="sol-title">🧠 Let\'s make 10!</div>'
    +'<div class="sol-why">'+big+' is bigger than '+small+', so keep '+big+' and split '+small+'.</div>'
    // number bond：小数拆成 need + left
    +'<div class="sol-bond">'
      +'<div class="sol-bond-top">'+small+'</div>'
      +'<div class="sol-bond-arms"><i></i><i></i></div>'
      +'<div class="sol-bond-parts"><span class="sol-need">'+need+'</span><span class="sol-left">'+left+'</span></div>'
    +'</div>'
    // 两步算式：大数 + need = 10 → 10 + left = 答案
    +'<div class="sol-steps">'
      +'<div class="sol-step"><span class="sol-eq">'+big+' + '+need+'</span><span class="sol-arrow">=</span>'
        +'<span class="sol-ten">10</span></div>'
      +'<div class="sol-step"><span class="sol-eq">10 + '+left+'</span><span class="sol-arrow">=</span>'
        +'<span class="sol-ans">'+ans+'</span></div>'
    +'</div>'
    +'<div class="sol-note">'+big+' + '+small+' = '+ans+' ✓</div>'
  +'</div>';
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
      solutionHtml:make10Solution(a,b), tag:'cpa'});
  }
  return out;
}

/* ---------------- v77 · 减法破十法解题图（Subtract by splitting to 10） ----------------
   按 Eric 手绘思路：16−9 → 因为 16 = 10 + 6，把 9 拆成 6 + 3，
   先 16−6=10，再 10−3=7。拆分的是"减数"，让被减数先退回 10 再减剩下的。
   返回纯 HTML，答对后显示在题目下方，孩子看图即可理解拆/减关系。 */
function subtractSolution(a,take){
  const back=a-10;                 // 被减数里"满十之外的零头"，如 16 → 6
  const left=take-back;            // 减数拆开后剩下的部分，如 9 = 6 + 3 → 3
  const ans=a-take;
  return '<div class="sol-card sol-sub">'
    +'<div class="sol-title">🧠 Subtract through 10!</div>'
    +'<div class="sol-why">'+a+' = 10 + '+back+', so split '+take+' into '+back+' + '+left+'.</div>'
    // number bond：减数拆成 back + left
    +'<div class="sol-bond">'
      +'<div class="sol-bond-top">'+take+'</div>'
      +'<div class="sol-bond-arms"><i></i><i></i></div>'
      +'<div class="sol-bond-parts"><span class="sol-need">'+back+'</span><span class="sol-left">'+left+'</span></div>'
    +'</div>'
    // 两步算式：被减数 − back = 10 → 10 − left = 答案
    +'<div class="sol-steps">'
      +'<div class="sol-step"><span class="sol-eq">'+a+' − '+back+'</span><span class="sol-arrow">=</span>'
        +'<span class="sol-ten">10</span></div>'
      +'<div class="sol-step"><span class="sol-eq">10 − '+left+'</span><span class="sol-arrow">=</span>'
        +'<span class="sol-ans">'+ans+'</span></div>'
    +'</div>'
    +'<div class="sol-note">'+a+' − '+take+' = '+ans+' ✓</div>'
  +'</div>';
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
      solutionHtml:subtractSolution(a,take), tag:'cpa'});
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

/* ---------------- 题目生成：逻辑推理（v74 · 4 类） ----------------
   参考学而思一年级「逻辑推理」：传递关系 / 排除法 / 赛跑比较 / 找规律。
   例句中英文均为按 5 岁水平改写，非学而思官方原题。
   所有 emoji/数字题不含 CJK，圈选题一排宝可梦互不重复。 */
function genLogic(n){
  const out=[];
  for(let i=0;i<n;i++){
    const mode=ri(0,3);
    if(mode===2){
      /* ③ 找规律：形状/颜色/数字序列，问下一个 */
      const PATS=[
        {seq:['🔴','🔵','🔴','🔵','🔴'],next:'🔵',why:'Red, blue, red, blue. The colours take turns.'},
        {seq:['⭐','⭐','🌙','⭐','⭐'],next:'🌙',why:'Two stars, then a moon. The pattern repeats.'},
        {seq:['🔺','🟨','🔺','🟨','🔺'],next:'🟨',why:'Triangle, square, triangle, square. Take turns.'},
        {seq:['1','2','3','4','5'],next:'6',why:'The numbers go up by one each time.'},
        {seq:['🍎','🍌','🍎','🍌','🍎'],next:'🍌',why:'Apple, banana, apple, banana. Take turns.'},
        {seq:['2','4','6','8','10'],next:'12',why:'Count up by two each time.'}
      ];
      const p=pick(PATS);
      const pool=[p.next,'🔴','🔵','⭐','🌙','🔺','🟨','🍎','🍌','3','6','7','9','11']
        .filter(x=>x!==p.next);
      const opts=shuffle([p.next,...shuffle(pool).slice(0,3)]);
      out.push({type:'choice',prompt:'What comes next?',sub:p.seq.join('  ')+'  ❓',
        speak:{text:'What comes next? '+p.seq.join(', '),lang:'en-US'},
        options:opts,answer:p.next,explain:p.why,
        answerSpeak:mathTipSpeak(p.why),tag:'logic'});
      continue;
    }
    const pool=shuffle(MATH_PETS).slice(0,mode===0?3:ri(3,4));
    const shown=shuffle(pool.slice());
    let question,sub,ansPet,explain;
    if(mode===0){
      /* ① 传递关系：A taller than B, B taller than C */
      const rank=shuffle(pool.slice());       // rank[0] 最高
      const conds=[
        rank[0].name+' is taller than '+rank[1].name+'.',
        rank[1].name+' is taller than '+rank[2].name+'.'
      ];
      const askTallest=Math.random()<0.5;
      ansPet=askTallest?rank[0]:rank[2];
      question=askTallest?'Who is the tallest?':'Who is the shortest?';
      sub=shuffle(conds).join(' ');
      explain=ansPet.name+' is '+(askTallest?'the tallest':'the shortest')+'. '+conds.join(' ');
    }else if(mode===1){
      /* ② 排除法：谁不是最大 → 剩下那只 */
      const biggest=pool[0];
      const conds=[pool[1].name+' is not the biggest.',
                   pool[2].name+' is not the biggest.'];
      ansPet=biggest;
      question='Who is the biggest?';
      sub=conds.join(' ');
      explain=biggest.name+' is the biggest. The others are not. '+conds.join(' ');
    }else{
      /* ③ 赛跑比较（保留经典） */
      const rank=shuffle(pool.slice());
      const conds=[];
      for(let k=0;k<rank.length-1;k++){
        const fast=rank[k], slow=rank[k+1];
        conds.push(Math.random()<0.5
          ? fast.name+' is faster than '+slow.name+'.'
          : slow.name+' is slower than '+fast.name+'.');
      }
      const askFastest=Math.random()<0.6;
      ansPet=askFastest?rank[0]:rank[rank.length-1];
      question=askFastest?'Who runs the fastest?':'Who runs the slowest?';
      sub=shuffle(conds).join(' ');
      explain=ansPet.name+' is '+(askFastest?'the fastest':'the slowest')+'. '+conds.join(' ');
    }
    out.push({type:'circle',prompt:question,sub,
      visual:petRow(shown.map(p=>({id:p.id,key:petKey(p),name:p.name})),{title:'Use the clues'}),
      items:shown.map(p=>({key:petKey(p),label:p.name,img:pokeImg(p.id)})),
      answer:petKey(ansPet),
      speak:{text:sub+' '+question,lang:'en-US'},
      explain, answerSpeak:mathTipSpeak(ansPet.name+' is the answer. '+explain),
      tag:'logic'});
  }
  return out;
}

/* ---------------- 题目生成：空间位置（v74 · 6 类） ----------------
   参考学而思一年级「位置与顺序 / 方位」：从左数、从右数、相邻、两端、
   之间、镜像翻转。一排宝可梦互不重复，全英文。 */
function genSpace(n){
  const out=[];
  for(let i=0;i<n;i++){
    const count=ri(5,6);
    const line=shuffle(MATH_PETS).slice(0,count).map((p,idx)=>({
      id:p.id,key:petKey(p),name:p.name,pos:ord(idx+1)}));
    const mode=ri(0,5);
    let question,keys=[],sub,explain,multi=false;
    if(mode===0){
      // 从左数第 k 只
      const k=ri(1,count), who=line[k-1];
      question='Who is '+ord(k)+' in the line?';
      keys=[who.key];
      sub='The Pokémon stand in a line from left to right. Look at the picture.';
      explain=who.name+' is '+ord(k)+' from the left.';
    }else if(mode===1){
      // 从右数（从后数）第 k 只
      const k=ri(1,count), who=line[count-k];
      question='Who is '+ord(k)+' from the right?';
      keys=[who.key];
      sub='The Pokémon stand in a line. The right end is the back.';
      explain=count+' in line. '+ord(k)+' from the right is '+who.name+'.';
    }else if(mode===2){
      // 相邻：谁挨着 X（左右两只，多选）
      const k=ri(1,count-2);
      const mid=line[k], left=line[k-1], right=line[k+1];
      question='Who is next to '+mid.name+'? Circle both!';
      keys=[left.key,right.key]; multi=true;
      sub=mid.name+' stands in the middle. Find the friends on both sides.';
      explain=left.name+' and '+right.name+' are next to '+mid.name+'. One on the left, one on the right.';
    }else if(mode===3){
      // 两端：圈出最左和最右两只
      keys=[line[0].key,line[count-1].key]; multi=true;
      question='Circle the first and the last in the line.';
      sub='Look at the two ends of the line. Touch both.';
      explain=line[0].name+' is first (left end) and '+line[count-1].name+' is last (right end).';
    }else if(mode===4){
      // 之间：谁在 X 和 Y 中间
      const k=ri(1,count-2);
      const left=line[k-1], mid=line[k], right=line[k+1];
      question='Who is between '+left.name+' and '+right.name+'?';
      keys=[mid.key];
      sub='Look at these three friends standing together.';
      explain=mid.name+' stands between '+left.name+' and '+right.name+'.';
    }else{
      // 镜像翻转：镜子里的第 k 只 = 原队列从右数第 k 只
      const k=ri(1,count);
      const who=line[count-k];
      question='In the mirror, who is '+ord(k)+' from the left?';
      keys=[who.key];
      sub='The mirror flips the line. Count from the left in the mirror.';
      explain='The mirror flips left and right. '+ord(k)+' from the left in the mirror is '+who.name+'.';
    }
    out.push({type:'circle',prompt:question,sub,
      visual:petRow(line,{title:'Standing in a line'}),
      items:line.map(it=>({key:it.key,label:it.name,img:pokeImg(it.id),pos:it.pos})),
      answer:keys.slice().sort().join(','), multi,
      speak:{text:sub+' '+question,lang:'en-US'},
      explain, answerSpeak:mathTipSpeak(explain), tag:'space'});
  }
  return out;
}

/* ---------------- 题目生成：专注力 · Look Carefully ----------------
   硬规则：同一题里出现的所有宝可梦必须互不相同 —— 从 12 只 MATH_PETS 里
   shuffle 后取 5~7 只，不再靠"重复同一只"来做找不同/圈同类。
   四种专注力维度（v78 起左右双向）：
     ① Find by name   —— 听名字，在一排各不相同的宝可梦里视觉扫描找出那只
     ② Find by initial—— 看名字首字母，圈出所有匹配的（multi）
     ③ Count from left—— 从左数第 k 只
     ④ Count from right—— 从右数第 k 只（从右端倒着数，强化专注力）
   key 仍带 '_'+k 后缀，保证 DOM 与判分唯一。 */
function genFocus(n){
  const out=[];
  for(let i=0;i<n;i++){
    const mode=ri(0,3);
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
    }else if(mode===2){
      // ③ 从左数第 k 只
      const k=ri(2,count-1);
      keys=[petKey(seq[k-1])+'_'+(k-1)];
      question='Circle the '+ord(k)+' one from the left.';
      sub='Count from the left. Which one is '+ord(k)+'?';
      explain='The '+ord(k)+' one from the left is '+seq[k-1].name+'.';
    }else{
      // ④ v78 从右数第 k 只（新增 · 专注力）：图上不标左序号，
      //    孩子必须从右端倒着数，训练方向与专注。
      const k=ri(2,count-1);
      const idx=count-k;               // 从右数第 k = 从左数第 count-k+1（0-based 为 count-k）
      keys=[petKey(seq[idx])+'_'+idx];
      question='Circle the '+ord(k)+' one from the right.';
      sub='Count from the RIGHT. Which one is '+ord(k)+'?';
      explain='The '+ord(k)+' one from the right is '+seq[idx].name+'.';
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

/* ---------------- 题目生成：连线配对（v74 · 4 类） ----------------
   ① ten-frame ↔ 数字  ② 算式 ↔ 答案
   ③ 图形个数 ↔ 数字  ④ 数字分解(part) ↔ 总数(whole)
   left: [{id,html}]  right: [{id,label}]
   pairs: {leftId:rightId}  answer: 排序后数字组合（判分实际走 q.pairs）。 */
function genMatch(n){
  const out=[];
  const PAIRS=3;
  const GLYPHS=['⭐','🔵','🍎','🔺','🌙'];
  for(let i=0;i<n;i++){
    const mode=ri(0,3);
    const vals=[];
    // 生成 PAIRS 个互不相同的目标值
    while(vals.length<PAIRS){
      const v=mode===1?ri(4,15):mode===3?ri(6,15):ri(2,9);
      if(!vals.includes(v)) vals.push(v);
    }
    const rightVals=shuffle(vals.slice());
    const glyph=mode===2?pick(GLYPHS):null;
    const left=vals.map((v,k)=>{
      let html;
      if(mode===0) html=tenFrame(v);
      else if(mode===1) html='<span class="match-eq">'+(v-1)+' + 1 = ?</span>';
      else if(mode===2) html='<span class="match-eq">'+glyph.repeat(v)+'</span>';
      else { const part=ri(1,v-1); html='<span class="match-eq">'+part+' + '+(v-part)+' = ?</span>'; }
      return {id:'L'+k,html};
    });
    const right=rightVals.map((v,k)=>({id:'R'+k,label:String(v)}));
    const pairs={}; vals.forEach((v,k)=>{ pairs['L'+k]='R'+rightVals.indexOf(v); });
    const answer=vals.slice().sort((x,y)=>x-y).join(', ');
    const M=[
      {q:'Match each ten-frame to its number',s:'Count the dots. Draw a line to the right number.'},
      {q:'Match each sum to its answer',s:'Work out each sum. Draw a line to the answer.'},
      {q:'Match the group to its number',s:'Count the shapes. Draw a line to the right number.'},
      {q:'Match the sum to its total',s:'Add the two parts. Draw a line to the total.'}
    ][mode];
    out.push({type:'match',prompt:M.q,sub:M.s,visual:'',left,right,pairs,answer,
      answerKey:vals.join(','),
      speak:{text:M.q+' '+M.s,lang:'en-US'},
      explain:vals.map(v=>String(v)).join(', ')+'. Match them all!',
      answerSpeak:mathTipSpeak('Well done! You matched every pair.'),
      tag:'match'});
  }
  return out;
}

/* ---------------- v74 新题型 ①：找规律（Pattern Detective） ----------------
   颜色/形状/数字序列问下一个，干扰项从别序列借，保证只有一个正确。 */
function genPattern(n){
  const out=[];
  const PATS=[
    {seq:['🔴','🔵','🔴','🔵','🔴'],next:'🔵',why:'Red, blue, red, blue. The colours take turns.'},
    {seq:['⭐','⭐','🌙','⭐','⭐'],next:'🌙',why:'Two stars then a moon. The pattern repeats.'},
    {seq:['🔺','🟨','🟩','🔺','🟨'],next:'🟩',why:'Three shapes in order, then start again.'},
    {seq:['🍎','🍌','🍇','🍎','🍌'],next:'🍇',why:'Apple, banana, grape, then start again.'},
    {seq:['1','2','3','4','5'],next:'6',why:'The numbers go up by one each time.'},
    {seq:['2','4','6','8'],next:'10',why:'Count up by two each time.'},
    {seq:['10','9','8','7'],next:'6',why:'The numbers go down by one each time.'},
    {seq:['🔴','🔴','🔵','🔴','🔴'],next:'🔵',why:'Two red, one blue. The pattern repeats.'},
    {seq:['🔵','🟡','🟡','🔵','🟡'],next:'🟡',why:'One blue, two yellow. The pattern repeats.'},
    {seq:['🌙','⭐','🌙','⭐','🌙'],next:'⭐',why:'Moon, star, moon, star. Take turns.'},
    {seq:['🍓','🍓','🍋','🍓','🍓'],next:'🍋',why:'Two strawberries then a lemon. Repeats.'},
    {seq:['3','5','7','9','11'],next:'13',why:'Odd numbers, counting up by two.'},
    {seq:['20','18','16','14'],next:'12',why:'Count down by two each time.'},
    {seq:['🔺','🔺','🔵','🔵','🔺'],next:'🔺',why:'Two triangles, two circles. Repeats.'},
    {seq:['🐱','🐶','🐱','🐶','🐱'],next:'🐶',why:'Cat, dog, cat, dog. Take turns.'},
    {seq:['1','3','5','7','9'],next:'11',why:'The numbers go up by two each time.'}
  ];
  const ALL=['🔴','🔵','🟡','⭐','🌙','🔺','🟨','🟩','🍎','🍌','🍇','🍓','🍋','🐱','🐶',
    '1','2','3','4','5','6','7','8','9','10','11','12','13','14'];
  for(let i=0;i<n;i++){
    const p=pick(PATS);
    const distract=shuffle(ALL.filter(x=>x!==p.next&&p.seq.indexOf(x)<0)).slice(0,3);
    out.push({type:'choice',prompt:'What comes next?',sub:p.seq.join('  ')+'  ❓',
      speak:{text:'What comes next? '+p.seq.join(', '),lang:'en-US'},
      options:shuffle([p.next].concat(distract)),answer:p.next,
      explain:p.why,answerSpeak:mathTipSpeak(p.why),tag:'pattern'});
  }
  return out;
}

/* ---------------- v74 新题型 ②：比大小（Compare Numbers） ----------------
   圈出较大/较小的数；偶尔相等用 choice 的 = 判定，避免无解。 */
function genCompare(n){
  const out=[];
  for(let i=0;i<n;i++){
    const askBig=Math.random()<0.5;
    let a=ri(1,20), b=ri(1,20);
    if(a===b) b=a===20?a-1:a+1;             // 本题只比大小，先排除相等
    const big=Math.max(a,b), small=Math.min(a,b);
    const answer=askBig?big:small;
    const pet=mathPet();
    out.push({type:'choice',prompt:askBig?'Which number is bigger?':'Which number is smaller?',
      sub:a+'   vs   '+b, visual:petVisual(a,b,'+',pet),petKey:petKey(pet),
      speak:{text:'Which number is '+(askBig?'bigger':'smaller')+'? '+a+' or '+b+'?',lang:'en-US'},
      options:shuffle([String(a),String(b)]),answer:String(answer),
      explain:big+' is bigger than '+small+'. '+small+' is smaller than '+big+'.',
      answerSpeak:mathTipSpeak(big+' is bigger; '+small+' is smaller.'),tag:'compare'});
  }
  return out;
}

/* ---------------- v74 新题型 ③：序数 / 排序（First, Second, Third） ----------------
   一排互不相同的宝可梦，问从左数第 k 只是谁（与 space 区别在于强调序数词与前后衔接）。 */
/* ---------------- v78 · 序数：从左 / 从右双向（考察专注力） ----------------
   原来只会「从左数第 k」和「k 后面是谁」，方向单一。新增「从右数第 k」，
   图上 pos 标号仍是从左的 1st/2nd…，孩子必须自己从右端重新数——
   正好训练专注力与左右方向的转换。 */
function genOrdinal(n){
  const out=[];
  for(let i=0;i<n;i++){
    const count=ri(4,6);
    const line=shuffle(MATH_PETS).slice(0,count).map((p,idx)=>({
      id:p.id,key:petKey(p)+'_'+idx,name:p.name,pos:ord(idx+1)}));
    const mode=ri(0,2);
    let question,sub,explain,answerKey;
    if(mode===0){
      // 从左数第 k
      const k=ri(1,count), who=line[k-1];
      question='Who is '+ord(k)+' from the left?';
      sub='Count from the LEFT. The first one is at the left end.';
      explain=who.name+' is '+ord(k)+' from the left.';
      answerKey=who.key;
    }else if(mode===1){
      // 从右数第 k（新增 · 专注力）
      const k=ri(1,count), who=line[count-k];
      question='Who is '+ord(k)+' from the right?';
      sub='Count from the RIGHT. The first one is at the right end.';
      explain='Counting from the right, '+ord(k)+' is '+who.name+'.';
      answerKey=who.key;
    }else{
      // 从左数，谁紧跟在第 k 个后面
      const k=ri(1,count-1), who=line[k];
      question='Who comes right after '+ord(k)+' from the left?';
      sub=ord(k)+', then who? Count from the left.';
      explain=who.name+' comes right after '+ord(k)+'.';
      answerKey=who.key;
    }
    out.push({type:'circle',prompt:question,sub,
      visual:petRow(line,{title:'Standing in a line'}),
      items:line.map(it=>({key:it.key,label:it.name,img:pokeImg(it.id),pos:it.pos})),
      answer:answerKey,multi:false,
      speak:{text:sub+' '+question,lang:'en-US'},
      explain, answerSpeak:mathTipSpeak(explain),tag:'ordinal'});
  }
  return out;
}

/* =========================================================
   综合训练（Mixed Review）：一套里把数学模块所有题型都过一遍
   ---------------------------------------------------------
   数学模块共有 20 类出题器（m-facts 是只读挂图，不算题型）：
     经典 9 类 —— count / bonds10 / add10 / bonds20 / add20 /
                 sub10 / sub20 / word / mixed
     CPA/新题 8 类 —— cpa-add / cpa-sub / doubles / word-plus /
                     logic / space / focus / match
     v74 新增 3 类 —— pattern / compare / ordinal
   每一类都直接复用原课程的 make()，不再重写一份出题逻辑 ——
   以后任何一门课调整题目，综合训练自动跟着更新。
   一套只有 10 道题，装不下 20 类，所以「打乱题型顺序 → 每类先出 1 道」，
   保证一套里尽量多不同题型，连做几套必然覆盖全部 20 类。
   ========================================================= */
function comboFamilies(){
  const legacyMaker=(id)=>{
    if(typeof MATH==='undefined' || !Array.isArray(MATH)) return null;
    const les=MATH.find(l=>l.id===id);
    return les && typeof les.make==='function' ? les.make : null;
  };
  return [
    {id:'count',     make:legacyMaker('m-count')},
    {id:'bonds10',   make:legacyMaker('m-bonds10')},
    {id:'add10',     make:legacyMaker('m-add10')},
    {id:'bonds20',   make:legacyMaker('m-bonds20')},
    {id:'add20',     make:legacyMaker('m-add20')},
    {id:'sub10',     make:legacyMaker('m-sub10')},
    {id:'sub20',     make:legacyMaker('m-sub20')},
    {id:'word',      make:legacyMaker('m-word')},
    {id:'mixed',     make:legacyMaker('m-mixed')},
    {id:'cpa-add',   make:genCpaAdd},
    {id:'cpa-sub',   make:genCpaSub},
    {id:'doubles',   make:genDoubles},
    {id:'word-plus', make:genWordPlus},
    {id:'logic',     make:genLogic},
    {id:'space',     make:genSpace},
    {id:'focus',     make:genFocus},
    {id:'match',     make:genMatch},
    {id:'pattern',   make:genPattern},
    {id:'compare',   make:genCompare},
    {id:'ordinal',   make:genOrdinal},
  ].filter(f=>typeof f.make==='function');
}
function genCombo(n, opts){
  n=Math.max(1, Number(n)||10);
  const fams=shuffle(comboFamilies());
  const out=[];
  /* 最早一轮就每类各出一道（题型尽量分散），某类万一摇空了再下一轮换一批。 */
  for(let pass=0; pass<5 && out.length<n; pass++){
    for(const f of fams){
      if(out.length>=n) break;
      let batch=[];
      try{ batch=f.make(2)||[]; }catch(e){ batch=[]; }
      if(!batch.length) continue;
      const q=batch[ri(0,batch.length-1)];
      if(!q) continue;
      /* src 只用于测试/统计「这道题来自哪个题型」，不参与渲染与去重指纹。 */
      q.src=f.id;
      out.push(q);
    }
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
  { id:'m-logic', level:2, title:'Logic · Think & Deduce', emoji:'🏁',
    desc:'Taller chains, elimination, who is faster, what comes next', noPool:true,
    make(slots){ return genLogic(Math.max(14,slots||10)); } },
  { id:'m-space', level:2, title:'Space · Position & Direction', emoji:'📍',
    desc:'First, last, next to, between, from the right, mirror flip', noPool:true,
    make(slots){ return genSpace(Math.max(14,slots||10)); } },
  { id:'m-focus', level:1, title:'Look Carefully', emoji:'🔍',
    desc:'Find the different one · circle all · count position', noPool:true,
    make(slots){ return genFocus(Math.max(14,slots||10)); } },
  { id:'m-match', level:1, title:'Match the Pairs', emoji:'🔗',
    desc:'Draw lines: ten-frame, sums, groups, number bonds', noPool:true,
    make(slots){ return genMatch(Math.max(12,slots||10)); } },

  /* v74 新增题型：找规律 / 比大小 / 序数——参考学而思一年级常考类型 */
  { id:'m-pattern', level:2, title:'Pattern Detective', emoji:'🔁',
    desc:'What comes next? colours, shapes and number patterns', noPool:true,
    make(slots){ return genPattern(Math.max(14,slots||10)); } },
  { id:'m-compare', level:1, title:'Compare Numbers', emoji:'⚖️',
    desc:'Greater than, less than, equal — circle the bigger one', noPool:true,
    make(slots){ return genCompare(Math.max(14,slots||10)); } },
  { id:'m-ordinal', level:2, title:'First, Second, Third', emoji:'🥇',
    desc:'Order and ordinals: who is first, next and last', noPool:true,
    make(slots){ return genOrdinal(Math.max(14,slots||10)); } },

  /* 综合训练：数学模块全部题型混着练（每套打乱出题顺序，尽量覆盖不同类型） */
  { id:'m-combo', level:3, title:'Mixed Review · All Skills', emoji:'🏆',
    desc:'One set, every math skill: count · bonds · add · subtract · stories · CPA · doubles · logic · space · focus · match',
    noPool:true,
    make(slots){ return genCombo(Math.max(10,slots||10)); } },
];

if(typeof module!=='undefined' && module.exports){
  module.exports={ tenFrame, barModel, petRow, ord, make10Solution, subtractSolution,
    genCpaAdd, genCpaSub, genDoubles, genWordPlus, genLogic, genSpace, genFocus, genMatch,
    genPattern, genCompare, genOrdinal,
    comboFamilies, genCombo, MATH_V2 };
}
