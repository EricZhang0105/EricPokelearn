/* =========================================================
   阅读理解题库（独立文件，方便每周自动上新）
   ---------------------------------------------------------
   结构：{ id, title, visual, level, text, qs:[...] }
     level 1 = 短句（12–22 词，一句一件事）
     level 2 = 小段落（26–42 词，4–5 句）
     level 3 = 完整故事（48–80 词，6–8 句）
   每题 qs：
     选择题 { q, o:[...], a }         ← 3 个选项，a 必须在 o 里
     短答题 { q, short:true, a, accept:[...], hint }
   qid 由代码自动生成（passageId#序号），孩子的"答对过"记录靠它，
   所以**加新短文时不要改动已有短文的 id 和题目顺序**。
   ========================================================= */

const READ_PASSAGES = [
  /* ---------------- Level 1 · 短句 ---------------- */
  { id:'rp-cat', level:1, title:'Sam and the Cat', visual:'🐱',
    text:'Sam has a red cat. The cat sits on a mat. Sam pats the cat. The cat is happy.',
    qs:[
      {q:'What color is the cat?', o:['red','blue','green'], a:'red'},
      {q:'Where does the cat sit?', o:['on a mat','on a bed','in a box'], a:'on a mat'},
      {q:'What does Sam do?', o:['pats the cat','feeds the cat','walks the cat'], a:'pats the cat'},
      {q:'Is the cat sad?', o:['Yes','No'], a:'No'},
      {q:'How does the cat feel?', short:true, a:'happy', accept:['happy','glad'], hint:'h _ _ _ _'}
    ]},
  { id:'rp-dog', level:1, title:"Ben's Dog", visual:'🐶',
    text:'Ben has a big dog. The dog can run fast. The dog can jump high. Ben loves his dog.',
    qs:[
      {q:'What does Ben have?', o:['a dog','a cat','a fish'], a:'a dog'},
      {q:'Can the dog jump?', o:['Yes','No'], a:'Yes'},
      {q:'What can the dog do?', o:['run and jump','sleep all day','sit and cry'], a:'run and jump'},
      {q:'Is the dog small?', o:['Yes','No'], a:'No'},
      {q:'Ben has a big ___.', short:true, a:'dog', accept:['dog'], hint:'d _ _'}
    ]},
  { id:'rp-sun', level:1, title:'The Big Sun', visual:'☀️',
    text:'The sun is big. The sun is hot. We can see the sun in the day. We play in the sun.',
    qs:[
      {q:'Is the sun hot?', o:['Yes','No'], a:'Yes'},
      {q:'When can we see the sun?', o:['in the day','at night','in the rain'], a:'in the day'},
      {q:'Is the sun small?', o:['Yes','No'], a:'No'},
      {q:'What do we do in the sun?', o:['We play','We sleep','We cry'], a:'We play'},
      {q:'The sun is big and ___.', short:true, a:'hot', accept:['hot'], hint:'h _ _'}
    ]},
  { id:'rp-park', level:1, title:'At the Park', visual:'🌳',
    text:'We go to the park. I see a red ball. Tom kicks the ball. We are happy at the park.',
    qs:[
      {q:'Where do we go?', o:['the park','the school','the shop'], a:'the park'},
      {q:'What color is the ball?', o:['red','yellow','black'], a:'red'},
      {q:'What does Tom do?', o:['kicks the ball','eats the ball','sleeps on the ball'], a:'kicks the ball'},
      {q:'Are we happy at the park?', o:['Yes','No'], a:'Yes'},
      {q:'I see a ___ ball.', short:true, a:'red', accept:['red'], hint:'r _ _'}
    ]},

  /* ---------------- Level 2 · 小段落 ---------------- */
  { id:'rp-cake', level:2, title:"Mum's Cake", visual:'🎂',
    text:'Mum has a big cake. The cake is on the table. It is for Sam. Sam eats the cake with a spoon. The cake is sweet. Sam says, Thank you, Mum!',
    qs:[
      {q:'What does Mum have?', o:['a cake','a cat','a sun'], a:'a cake'},
      {q:'Where is the cake?', o:['on the table','in a box','under the bed'], a:'on the table'},
      {q:'Who eats the cake?', o:['Sam','Ben','Mum'], a:'Sam'},
      {q:'What does Sam use to eat?', o:['a spoon','a fork','a cup'], a:'a spoon'},
      {q:'The cake is ___.', short:true, a:'sweet', accept:['sweet'], hint:'s _ _ _ _'}
    ]},
  { id:'rp-bird', level:2, title:'The Little Bird', visual:'🐦',
    text:'A bird is in the tree. The bird is blue. It has a small beak. The bird can fly. It can sing too. I like the blue bird.',
    qs:[
      {q:'Where is the bird?', o:['in the tree','in a box','on a mat'], a:'in the tree'},
      {q:'What color is the bird?', o:['blue','red','green'], a:'blue'},
      {q:'What can the bird do?', o:['fly and sing','run and jump','swim and hop'], a:'fly and sing'},
      {q:'Do I like the bird?', o:['Yes','No'], a:'Yes'},
      {q:'The bird is ___.', short:true, a:'blue', accept:['blue'], hint:'b _ _ _'}
    ]},
  { id:'rp-rain', level:2, title:'A Rainy Day', visual:'🌧️',
    text:'It is raining today. I have a big umbrella. I put on my red boots. I jump in the water. Splash! Then I go home and drink hot milk.',
    qs:[
      {q:'What is the weather?', o:['raining','sunny','snowy'], a:'raining'},
      {q:'What do I have?', o:['an umbrella','a ball','a hat'], a:'an umbrella'},
      {q:'What color are my boots?', o:['red','blue','black'], a:'red'},
      {q:'What do I drink at home?', o:['hot milk','cold juice','water'], a:'hot milk'},
      {q:'I have a big ___.', short:true, a:'umbrella', accept:['umbrella'], hint:'u _ _ _ _ _ _ _'}
    ]},
  { id:'rp-toys', level:2, title:'My Toy Box', visual:'🧸',
    text:'I have a toy box. In the box I see a red car and a blue ball. My sister has a doll. We play with our toys. My toys are fun.',
    qs:[
      {q:'What do I have?', o:['a toy box','a book','a cup'], a:'a toy box'},
      {q:'What color is the car?', o:['red','blue','yellow'], a:'red'},
      {q:'Who has a doll?', o:['my sister','my brother','my mum'], a:'my sister'},
      {q:'Are the toys fun?', o:['Yes','No'], a:'Yes'},
      {q:'My toys are ___.', short:true, a:'fun', accept:['fun'], hint:'f _ _'}
    ]},
  { id:'rp-school', level:2, title:'My School Bag', visual:'🎒',
    text:'This is my school bag. It is blue and big. In it I have two books, a red pencil and a small box. I go to school by bus. I like my bag.',
    qs:[
      {q:'What color is the bag?', o:['blue','red','green'], a:'blue'},
      {q:'How many books are in the bag?', o:['two','three','one'], a:'two'},
      {q:'What else is in the bag?', o:['a red pencil','a doll','a ball'], a:'a red pencil'},
      {q:'How do I go to school?', o:['by bus','by car','by bike'], a:'by bus'},
      {q:'My bag is ___ and big.', short:true, a:'blue', accept:['blue'], hint:'b _ _ _'}
    ]},
  { id:'rp-garden', level:2, title:"Grandma's Garden", visual:'🌷',
    text:'Grandma has a small garden. In the garden there are red flowers and a big tree. A cat sleeps under the tree. Grandma waters the flowers every day. I help her. The garden is pretty.',
    qs:[
      {q:'Who has a garden?', o:['Grandma','Mum','Ben'], a:'Grandma'},
      {q:'What is in the garden?', o:['red flowers','a pool','a car'], a:'red flowers'},
      {q:'Where does the cat sleep?', o:['under the tree','in a box','on the bed'], a:'under the tree'},
      {q:'Who helps Grandma?', o:['I do','Mum','Ben'], a:'I do'},
      {q:'Grandma ___ the flowers every day.', short:true, a:'waters', accept:['waters','water'], hint:'w _ _ _ _ _'}
    ]},
  { id:'rp-bus', level:2, title:'The Bus Ride', visual:'🚌',
    text:'I go on the bus with Dad. The bus is yellow. I sit by the window. I see shops, cars and a big park. The bus stops near my school. I say thank you to the driver.',
    qs:[
      {q:'Who do I go with?', o:['Dad','Mum','Grandma'], a:'Dad'},
      {q:'What color is the bus?', o:['yellow','red','blue'], a:'yellow'},
      {q:'Where do I sit?', o:['by the window','at the back','near the door'], a:'by the window'},
      {q:'What do I see from the bus?', o:['shops and cars','a zoo','the sea'], a:'shops and cars'},
      {q:'I say ___ to the driver.', short:true, a:'thank you', accept:['thank you','thanks'], hint:'t h _ _ _   y _ _'}
    ]},
  { id:'rp-puppy', level:2, title:'My New Puppy', visual:'🐕',
    text:'I have a new puppy. His name is Max. He is brown and small. Max likes to run in the park. He can jump and play with a ball. At night he sleeps in a box. I love Max.',
    qs:[
      {q:"What is the puppy's name?", o:['Max','Tom','Sam'], a:'Max'},
      {q:'What color is Max?', o:['brown','black','white'], a:'brown'},
      {q:'What does Max like to do?', o:['run in the park','sleep all day','swim in the sea'], a:'run in the park'},
      {q:'Where does Max sleep at night?', o:['in a box','on the bed','in the garden'], a:'in a box'},
      {q:'Max is brown and ___.', short:true, a:'small', accept:['small'], hint:'s _ _ _ _'}
    ]},

  /* ---------------- Level 3 · 完整故事 ---------------- */
  { id:'rp-zoo', level:3, title:'A Day at the Zoo', visual:'🦁',
    text:'On Saturday, Ben and his mum go to the zoo. First they see two big elephants. The elephants have long noses and small eyes. Next they see monkeys. The monkeys jump from tree to tree and eat bananas. Ben laughs at them. At last they see a white tiger. It is sleeping in the sun. Ben is tired but very happy.',
    qs:[
      {q:'When do Ben and his mum go to the zoo?', o:['on Saturday','on Sunday','at night'], a:'on Saturday'},
      {q:'What do the elephants look like?', o:['long noses and small eyes','short legs and big ears','long tails'], a:'long noses and small eyes'},
      {q:'What do the monkeys eat?', o:['bananas','apples','bread'], a:'bananas'},
      {q:'What is the tiger doing?', o:['sleeping in the sun','running fast','eating meat'], a:'sleeping in the sun'},
      {q:'Ben is tired but very ___.', short:true, a:'happy', accept:['happy'], hint:'h _ _ _ _'}
    ]},
  { id:'rp-market', level:3, title:'Mum and the Market', visual:'🥬',
    text:'Every Sunday, Mum goes to the market near our flat. She buys fish, eggs and green vegetables. The fish is fresh and the eggs are big. I carry the small bag and Mum carries the big one. Sometimes she buys me a bun. It is warm and soft. We walk home together and talk about the week.',
    qs:[
      {q:'When does Mum go to the market?', o:['every Sunday','every Monday','on Friday'], a:'every Sunday'},
      {q:'What does she buy?', o:['fish, eggs and vegetables','cake and milk','rice and shoes'], a:'fish, eggs and vegetables'},
      {q:'What do I carry?', o:['the small bag','the big bag','nothing'], a:'the small bag'},
      {q:'What does Mum sometimes buy for me?', o:['a bun','a toy','a book'], a:'a bun'},
      {q:'The bun is warm and ___.', short:true, a:'soft', accept:['soft'], hint:'s _ _ _'}
    ]},
  { id:'rp-beach', level:3, title:'A Trip to the Beach', visual:'🏖️',
    text:'Last Sunday my family went to the beach. The sand was warm and the sea was blue. Dad and I built a big sand house. My little sister looked for pretty shells. She found six shells and put them in her bag. Then the wind came and the sand house fell down. We laughed and built it again.',
    qs:[
      {q:'When did the family go to the beach?', o:['last Sunday','last Friday','this morning'], a:'last Sunday'},
      {q:'What did Dad and I build?', o:['a sand house','a boat','a kite'], a:'a sand house'},
      {q:'How many shells did my sister find?', o:['six','three','ten'], a:'six'},
      {q:'What made the sand house fall down?', o:['the wind','the rain','my sister'], a:'the wind'},
      {q:'The sea was ___.', short:true, a:'blue', accept:['blue'], hint:'b _ _ _'}
    ]},
  { id:'rp-lost', level:3, title:'The Lost Cat', visual:'😿',
    text:'One morning Lily could not find her cat in the house. She looked under the bed, behind the door and in the garden. She was sad. Then she heard a small sound near the tree. Her cat was up in the tree and could not come down. Dad put a ladder under the tree and helped the cat down. Lily held her cat and said, Do not run away again!',
    qs:[
      {q:'Whose cat was lost?', o:["Lily's", "Ben's", "Mum's"], a:"Lily's"},
      {q:'Where did Lily look first?', o:['under the bed and in the garden','in the school','at the market'], a:'under the bed and in the garden'},
      {q:'Where was the cat?', o:['up in the tree','under the bed','on the roof'], a:'up in the tree'},
      {q:'Who helped the cat come down?', o:['Dad','Mum','Lily'], a:'Dad'},
      {q:'Dad put a ___ under the tree.', short:true, a:'ladder', accept:['ladder'], hint:'l _ _ _ _ _'}
    ]},
  { id:'rp-rainbow', level:3, title:'After the Rain', visual:'🌈',
    text:'It rained all morning, so we stayed in the flat. We drew pictures and played with blocks. In the afternoon the sun came out. The road was wet and the air was cool. Mum opened the window and said, Look! There was a big rainbow in the sky with seven colours. We ran down to the garden to see it better. It was the best part of the day.',
    qs:[
      {q:'Why did we stay in the flat?', o:['it was raining','it was too hot','it was night'], a:'it was raining'},
      {q:'What did we do inside?', o:['drew pictures and played with blocks','watched TV','slept all day'], a:'drew pictures and played with blocks'},
      {q:'When did the sun come out?', o:['in the afternoon','in the morning','at night'], a:'in the afternoon'},
      {q:'What was in the sky?', o:['a rainbow','a big bird','a plane'], a:'a rainbow'},
      {q:'The rainbow had ___ colours.', short:true, a:'seven', accept:['seven','7'], hint:'s _ _ _ _'}
    ]},
  { id:'rp-birthday', level:3, title:"Ben's Birthday", visual:'🎈',
    text:"Today is Ben's birthday. He is six years old. His friends come to his house with small gifts. Mum makes a big cake with six candles. Ben closes his eyes and makes a wish, then he blows out all the candles. Everyone eats cake and plays games in the garden. Ben says it is the best birthday ever.",
    qs:[
      {q:'How old is Ben today?', o:['six','five','seven'], a:'six'},
      {q:'Who makes the cake?', o:['Mum','Dad','Grandma'], a:'Mum'},
      {q:'How many candles are on the cake?', o:['six','five','ten'], a:'six'},
      {q:'What does Ben do before he blows out the candles?', o:['makes a wish','eats cake','opens gifts'], a:'makes a wish'},
      {q:'Ben is ___ years old.', short:true, a:'six', accept:['six','6'], hint:'s _ _'}
    ]},
  { id:'rp-farm', level:3, title:'On the Farm', visual:'🐄',
    text:'My uncle has a small farm. There are cows, goats and many chickens on it. Every morning he gets up early and gives food to the animals. I like the little chicks best because they follow their mother everywhere. In the afternoon we collect eggs from the hens. Then we sit under a tree and drink cold water. The farm is quiet and green.',
    qs:[
      {q:"Whose farm is it?", o:["my uncle's","my father's","my friend's"], a:"my uncle's"},
      {q:'What animals are on the farm?', o:['cows, goats and chickens','dogs and cats','lions and tigers'], a:'cows, goats and chickens'},
      {q:'Which animals do I like best?', o:['the little chicks','the cows','the goats'], a:'the little chicks'},
      {q:'What do we do in the afternoon?', o:['collect eggs','sleep','read books'], a:'collect eggs'},
      {q:'The farm is quiet and ___.', short:true, a:'green', accept:['green'], hint:'g _ _ _ _'}
    ]},
  { id:'rp-library', level:3, title:'The New Library', visual:'📚',
    text:'A new library opened near our block last week. It has many books for children. There are big picture books, small story books and books about animals. The librarian is kind and helps us find what we want. Every Saturday morning I go there with my sister. We sit on a soft mat, read for one hour and then borrow two books to read at home.',
    qs:[
      {q:'When did the new library open?', o:['last week','last month','yesterday'], a:'last week'},
      {q:'Where is the library?', o:['near our block','near the school','in the park'], a:'near our block'},
      {q:'Who helps us find books?', o:['the librarian','my sister','my mum'], a:'the librarian'},
      {q:'How many books can we borrow?', o:['two','three','one'], a:'two'},
      {q:'We read for one ___.', short:true, a:'hour', accept:['hour'], hint:'h _ _ _'}
    ]},
];

/* ---------------- 题目 ID + 分级信息 ---------------- */
READ_PASSAGES.forEach(p=>{
  if(!p.level) p.level=1;
  p.qs.forEach((x,i)=>{ if(!x.qid) x.qid = p.id+'#'+(i+1); });
});

const READ_LEVEL_INFO = {
  1:{ label:'Short sentences 短句',  min:10, max:24 },
  2:{ label:'Short stories 小段落',  min:24, max:44 },
  3:{ label:'Long stories 完整故事', min:44, max:90 },
};
function readWordCount(t){ return String(t||'').trim().split(/\s+/).filter(Boolean).length; }

/* 读到第几级：按"已答对的阅读题数"往上走（短句 → 小段落 → 完整故事）
   L1 共 20 题，L2 共 40 题，L3 共 40 题：先把短句读熟，再读长文。 */
function readLevelFor(doneCount){
  if(doneCount < 16) return 1;
  if(doneCount < 48) return 2;
  return 3;
}
function readLevelCounts(doneIds){
  const done=new Set(doneIds||[]);
  const out={1:{total:0,done:0},2:{total:0,done:0},3:{total:0,done:0}};
  READ_PASSAGES.forEach(p=>{
    p.qs.forEach(x=>{
      out[p.level].total++;
      if(done.has(x.qid)) out[p.level].done++;
    });
  });
  return out;
}
function readStats(doneIds){
  const byLevel=readLevelCounts(doneIds);
  const total=Object.keys(byLevel).reduce((n,k)=>n+byLevel[k].total,0);
  const done=Object.keys(byLevel).reduce((n,k)=>n+byLevel[k].done,0);
  return { total, done, byLevel, level: readLevelFor(done), passages: READ_PASSAGES.length };
}

/* ---------------- 拼一套阅读题 ----------------
 * 一套 10 步：短文卡 + 3 选择题 + 1 短答，两篇凑满。
 * 规则：
 *   1) 答对过的题（存进存档的 readDone）不再出现，整篇都答对过的短文直接跳过；
 *   2) 先读本级没读过的短文，本级读完了自动升级 → 文章越来越长；
 *   3) 全部答对时退回"复习"模式，用读得最久的那两篇再读一次，不会空题。
 */
let _readRecent=[];
function _readRecentLoad(){
  try{ const a=JSON.parse(localStorage.getItem('pokeLearnReadRecent')||'[]');
       return Array.isArray(a) ? a.filter(x=>typeof x==='string') : []; }
  catch(e){ return []; }
}
function _readRecentSave(ids){
  try{ localStorage.setItem('pokeLearnReadRecent', JSON.stringify(ids)); }catch(e){}
}
function readSet(limit, opts){
  limit = limit || 10;
  opts = opts || {};
  let done = opts.doneIds;
  if(!done && typeof Store!=='undefined' && Store.readDoneIds) done = Store.readDoneIds();
  const doneSet = new Set(done||[]);
  const level = opts.level || readLevelFor(doneSet.size);
  if(!_readRecent.length) _readRecent=_readRecentLoad();

  // 候选顺序：本级没读过 → 本级读过 → 上一级 → 再上一级（保证永远有内容）
  const order=[level, level+1, level-1, 3, 2, 1].filter((l,i,a)=>l>=1&&l<=3&&a.indexOf(l)===i);
  const pool=[]; const seen=new Set();
  order.forEach(lv=>{
    const inLv=READ_PASSAGES.filter(p=>p.level===lv);
    const fresh=shuffle(inLv.filter(p=>!_readRecent.includes(p.id)));
    const old  =shuffle(inLv.filter(p=> _readRecent.includes(p.id)));
    [...fresh,...old].forEach(p=>{ if(!seen.has(p.id)){ seen.add(p.id); pool.push(p); } });
  });

  const out=[], used=[];
  for(const p of pool){
    if(out.length>=limit) break;
    const freshQ=p.qs.filter(x=>!doneSet.has(x.qid));
    if(!freshQ.length) continue;                       // 整篇都答对过 → 跳过
    const picked=[...shuffle(freshQ.filter(x=>!x.short)).slice(0,3),
                  ...freshQ.filter(x=>x.short).slice(0,1)];
    const block=[{type:'passage', title:p.title, text:p.text, visual:p.visual, level:p.level,
      speak:{text:p.text,lang:'en-US'}}];
    picked.forEach(x=>{
      if(x.short){
        block.push({type:'type', short:true, prompt:'Short answer', sub:x.q, hint:x.hint,
          accept:x.accept, qid:x.qid, speak:{text:x.q,lang:'en-US'}, answer:x.a,
          explain:`Answer: ${x.a}.`});
      }else{
        block.push({type:'choice', prompt:'Question', sub:x.q, qid:x.qid,
          speak:{text:x.q,lang:'en-US'}, options:shuffle(x.o), answer:x.a,
          explain:`Answer: ${x.a}.`});
      }
    });
    if(out.length + block.length <= limit){            // 放得下：整篇
      block.forEach(q=>out.push(q)); used.push(p.id);
    }else{                                             // 放不下：短文卡 + 少量题
      const room=limit-out.length;
      if(room>=2){
        out.push(block[0]);
        block.slice(1, room).forEach(q=>out.push(q));
        used.push(p.id);
      }
      break;
    }
  }

  // 兜底：全部答对过（题库被刷完）→ 用最久没读的两篇再来一次，标记为复习
  if(!out.length){
    const old=READ_PASSAGES.slice().sort((a,b)=>{
      const ia=_readRecent.indexOf(a.id), ib=_readRecent.indexOf(b.id);
      return (ib<0?-1:ib)-(ia<0?-1:ia);
    }).slice(0,2);
    old.forEach(p=>{
      out.push({type:'passage', title:p.title, text:p.text, visual:p.visual, level:p.level,
        speak:{text:p.text,lang:'en-US'}});
      const picked=[...p.qs.filter(x=>!x.short).slice(0,3), ...p.qs.filter(x=>x.short).slice(0,1)];
      picked.forEach(x=>{
        if(x.short){
          out.push({type:'type', short:true, prompt:'Short answer', sub:x.q, hint:x.hint,
            accept:x.accept, qid:x.qid, review:true,
            speak:{text:x.q,lang:'en-US'}, answer:x.a, explain:`Answer: ${x.a}.`});
        }else{
          out.push({type:'choice', prompt:'Question', sub:x.q, qid:x.qid, review:true,
            speak:{text:x.q,lang:'en-US'}, options:shuffle(x.o), answer:x.a,
            explain:`Answer: ${x.a}.`});
        }
      });
    });
  }

  if(used.length){
    _readRecent = used.concat(_readRecent.filter(id=>!used.includes(id))).slice(0,6);
    _readRecentSave(_readRecent);
  }
  return out;
}
