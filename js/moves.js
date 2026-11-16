/* =========================================================
   PokeLearn · 宝可梦专属绝招库
   ---------------------------------------------------------
   每只宝可梦按官方设定配一个「招牌绝招」：
   - name   : 招式中文名（图鉴/动画里的真实招式）
   - en     : 英文名
   - type   : 属性 → 决定特效颜色/粒子/音效（见 MOVES.typeFx）
   - desc   : 给孩子看的一句中文说明
   属性特效由 app.js 的 showSkillFx + css/styles.css 渲染，
   音效由 WebAudio 按 type 合成（无需额外音频文件）。
   ========================================================= */
(function(global){
'use strict';

/* 按进化链 id → 招牌绝招（取自官方招式/动画必杀技） */
const MOVES = {
  // ---- 关都 ----
  bulbasaur:{name:'飞叶快刀',en:'Razor Leaf',type:'grass',desc:'卷起锋利的叶子，唰唰唰地飞出去！'},
  charmander:{name:'喷射火焰',en:'Flamethrower',type:'fire',desc:'喷出一道炽热的火焰，轰！'},
  squirtle:{name:'水炮',en:'Hydro Pump',type:'water',desc:'喷出高压水柱，哗啦——！'},
  caterpie:{name:'吐丝',en:'String Shot',type:'bug',desc:'吐出黏黏的丝，把对手缠住！'},
  pidgey:{name:'燕返',en:'Aerial Ace',type:'flying',desc:'像风一样俯冲下来！'},
  rattata:{name:'撞击',en:'Tackle',type:'normal',desc:'鼓足力气猛地撞过去！'},
  ekans:{name:'溶解液',en:'Acid',type:'poison',desc:'喷出强腐蚀性的液体！'},
  pikachu:{name:'十万伏特',en:'Thunderbolt',type:'electric',desc:'放出强大的电击，噼里啪啦！'},
  sandshrew:{name:'挖洞',en:'Dig',type:'ground',desc:'钻进地里，从下方突袭！'},
  cleffa:{name:'月光',en:'Moonlight',type:'fairy',desc:'借来月光，恢复精神！'},
  vulpix:{name:'火焰旋涡',en:'Flame Wheel',type:'fire',desc:'被火焰包裹，冲向对手！'},
  jigglypuff:{name:'唱歌',en:'Sing',type:'sound',desc:'唱起摇篮曲，把对手哄睡着～'},
  zubat:{name:'超音波',en:'Supersonic',type:'sound',desc:'发出高频音波，让对手头晕！'},
  oddish:{name:'寄生种子',en:'Leech Seed',type:'grass',desc:'撒下种子，悄悄吸取能量！'},
  diglett:{name:'挖洞',en:'Dig',type:'ground',desc:'在地下飞快穿梭，从脚下冒出来！'},
  meowth:{name:'抓击',en:'Scratch',type:'normal',desc:'伸出利爪，唰唰两下！'},
  psyduck:{name:'念力',en:'Confusion',type:'psychic',desc:'头痛欲裂时爆发的神秘力量！'},
  growlithe:{name:'喷射火焰',en:'Flamethrower',type:'fire',desc:'喷出灼热火焰，气势十足！'},
  poliwag:{name:'水炮',en:'Hydro Pump',type:'water',desc:'鼓起腮帮子喷出大水柱！'},
  abra:{name:'念力',en:'Confusion',type:'psychic',desc:'不用动手，用意念把对手举起！'},
  machop:{name:'臂力锤',en:'Hammer Arm',type:'fighting',desc:'抡起强壮手臂，重重一砸！'},
  geodude:{name:'岩崩',en:'Rock Slide',type:'rock',desc:'推下大石头，轰隆隆砸下来！'},
  ponyta:{name:'烈焰冲锋',en:'Flame Charge',type:'fire',desc:'身披火焰，全速冲刺！'},
  magnemite:{name:'十万伏特',en:'Thunderbolt',type:'electric',desc:'放出噼啪作响的电击！'},
  shellder:{name:'冰冻光束',en:'Ice Beam',type:'ice',desc:'射出冰冷光线，把对手冻住！'},
  gastly:{name:'暗影球',en:'Shadow Ball',type:'ghost',desc:'抛出黑紫色的怨念之球！'},
  koffing:{name:'毒瓦斯',en:'Smog',type:'poison',desc:'喷出一团有毒的烟雾！'},
  horsea:{name:'水炮',en:'Hydro Pump',type:'water',desc:'从口中喷出强劲水流！'},
  magikarp:{name:'跃起',en:'Splash',type:'water',desc:'用力跳起来，啪嗒一声！（虽然没什么用）'},
  eevee:{name:'撞击',en:'Tackle',type:'normal',desc:'鼓起勇气，整个身子撞过去！'},
  porygon:{name:'三重攻击',en:'Tri Attack',type:'normal',desc:'同时射出三道不同颜色的光束！'},
  dratini:{name:'龙息',en:'Dragon Breath',type:'dragon',desc:'喷出灼热的龙之吐息！'},
  snorlax:{name:'泰山压顶',en:'Body Slam',type:'normal',desc:'整个身子压下来，砰！'},
  togepi:{name:'神秘守护',en:'Safeguard',type:'fairy',desc:'撑起一层闪闪发光的保护罩！'},
  happiny:{name:'治愈愿望',en:'Healing Wish',type:'fairy',desc:'发出温柔的粉色光芒！'},
  // ---- 城都 ----
  chikorita:{name:'飞叶快刀',en:'Razor Leaf',type:'grass',desc:'甩出一片片锋利叶子！'},
  cyndaquil:{name:'喷射火焰',en:'Flamethrower',type:'fire',desc:'背上的火焰喷涌而出！'},
  totodile:{name:'水炮',en:'Hydro Pump',type:'water',desc:'大嘴喷出强劲水柱！'},
  mareep:{name:'十万伏特',en:'Thunderbolt',type:'electric',desc:'羊毛里放出噼啪电光！'},
  azurill:{name:'水炮',en:'Hydro Pump',type:'water',desc:'甩起尾巴弹出大水珠！'},
  wynaut:{name:'镜面反射',en:'Mirror Coat',type:'psychic',desc:'把攻击光镜面一样反弹回去！'},
  larvitar:{name:'岩崩',en:'Rock Slide',type:'rock',desc:'掀起大量碎石砸下来！'},
  // ---- 丰缘 ----
  treecko:{name:'树叶',en:'Leafage',type:'grass',desc:'挥出一片飞舞的叶子！'},
  torchic:{name:'火焰拳',en:'Fire Punch',type:'fire',desc:'用燃烧的拳头出击！'},
  mudkip:{name:'泥巴射击',en:'Mud Shot',type:'ground',desc:'甩出一团泥巴！'},
  ralts:{name:'精神强念',en:'Psychic',type:'psychic',desc:'用强大的念力举起对手！'},
  beldum:{name:'彗星拳',en:'Meteor Mash',type:'steel',desc:'用钢铁般的拳头，像流星一样砸下！'},
  bagon:{name:'龙息',en:'Dragon Breath',type:'dragon',desc:'喷出炙热的龙之吐息！'},
  // ---- 神奥 ----
  turtwig:{name:'飞叶快刀',en:'Razor Leaf',type:'grass',desc:'甩出锋利的叶子！'},
  chimchar:{name:'火焰拳',en:'Fire Punch',type:'fire',desc:'燃起火焰的拳头，砰！'},
  piplup:{name:'泡泡',en:'Bubble',type:'water',desc:'吹出一串泡泡，噗噜噜！'},
  shinx:{name:'电光石火',en:'Spark',type:'electric',desc:'身体带电，猛地撞过去！'},
  gible:{name:'龙爪',en:'Dragon Claw',type:'dragon',desc:'挥出锋利的龙之利爪！'},
  lucario:{name:'波导弹',en:'Aura Sphere',type:'fighting',desc:'凝聚能量，射出波动之球！'},
  // ---- 卡洛斯 ----
  chespin:{name:'坚果炮',en:'Nut Slam',type:'grass',desc:'把硬硬的坚果砸出去！'},
  fennekin:{name:'火焰旋涡',en:'Flame Wheel',type:'fire',desc:'卷起火焰冲向对手！'},
  froakie:{name:'水炮',en:'Hydro Pump',type:'water',desc:'喷出高压水柱！'},
  // ---- 阿罗拉 ----
  rowlet:{name:'飞叶快刀',en:'Razor Leaf',type:'grass',desc:'射出锋利叶片！'},
  litten:{name:'火焰旋涡',en:'Flame Wheel',type:'fire',desc:'全身裹住火焰冲过去！'},
  popplio:{name:'泡泡',en:'Bubble',type:'water',desc:'吹出好多闪亮的泡泡！'},
  // ---- 伽勒尔 ----
  grookey:{name:'树枝冲击',en:'Branch Poke',type:'grass',desc:'用树枝戳一下，啪！'},
  scorbunny:{name:'火焰拳',en:'Fire Punch',type:'fire',desc:'踢出燃烧的一脚！'},
  sobble:{name:'水枪',en:'Water Gun',type:'water',desc:'喷出一股水柱！'}
};

/* 属性 → 特效配置：颜色、粒子 emoji、爆发字、音效类型 */
const typeFx = {
  fire:     {c1:'#ff7a18',c2:'#ffd93d', particles:'🔥🔥🔥', word:'BURN!',  sfx:'fire'},
  water:    {c1:'#3da5ff',c2:'#9ee7ff', particles:'💧💦💧', word:'SPLASH!',sfx:'water'},
  electric: {c1:'#ffe14d',c2:'#fff9b0', particles:'⚡⚡⚡', word:'ZAP!',   sfx:'electric'},
  grass:    {c1:'#5cc93a',c2:'#c8f56a', particles:'🍃🌿🍃', word:'LEAF!',  sfx:'grass'},
  ice:      {c1:'#7fdfff',c2:'#e6fbff', particles:'❄️🧊❄️', word:'FREEZE!',sfx:'ice'},
  psychic:  {c1:'#ff6fb5',c2:'#ffd0ea', particles:'✨💫✨', word:'PSYCHIC!',sfx:'psychic'},
  fighting: {c1:'#ff6a3d',c2:'#ffd2a8', particles:'🥊💥🥊', word:'PUNCH!', sfx:'fight'},
  dragon:   {c1:'#8a5cff',c2:'#d9b8ff', particles:'🐉💠🐉', word:'DRAGON!',sfx:'dragon'},
  ghost:    {c1:'#7b4bd6',c2:'#c9a6ff', particles:'👻🟣👻', word:'SHADOW!',sfx:'ghost'},
  poison:   {c1:'#9b3fd6',c2:'#d9a6ff', particles:'☁️💜☁️', word:'TOXIC!', sfx:'ghost'},
  ground:   {c1:'#c98c4a',c2:'#f0c98a', particles:'🪨💨🪨', word:'RUMBLE!',sfx:'rock'},
  rock:     {c1:'#a08b6a',c2:'#e0cdb0', particles:'🗿🪨🗿', word:'CRASH!', sfx:'rock'},
  bug:      {c1:'#8dc65a',c2:'#d6f59e', particles:'🦋🍃🦋', word:'SWARM!', sfx:'grass'},
  flying:   {c1:'#9ec9ff',c2:'#e6f2ff', particles:'🌀🕊️🌀', word:'GUST!',  sfx:'wind'},
  normal:   {c1:'#b9b0a0',c2:'#efe9df', particles:'⭐💥⭐', word:'SMASH!', sfx:'normal'},
  sound:    {c1:'#f06fb5',c2:'#ffd0ea', particles:'🎵🎶🎵', word:'SING!',  sfx:'sound'},
  steel:    {c1:'#9fb3c8',c2:'#e6eef7', particles:'⚙️💠⚙️', word:'STEEL!', sfx:'fight'},
  fairy:    {c1:'#ff9ad5',c2:'#ffe3f5', particles:'✨🎀✨', word:'SHINE!', sfx:'psychic'}
};
/* 取某只宝可梦的绝招，未登记的给一个默认（保险） */
function moveFor(id){
  return MOVES[id] || {name:'必杀技',en:'Super Move',type:'normal',desc:'释放必杀技！'};
}
function fxFor(type){ return typeFx[type] || typeFx.normal; }

global.MOVES={list:MOVES, typeFx, moveFor, fxFor};
})(typeof window!=='undefined'?window:globalThis);
