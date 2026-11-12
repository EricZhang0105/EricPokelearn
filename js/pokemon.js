/* =========================================================
   宝可梦图库 · v3
   - 每只都是完整的官方进化链（影视 / 图鉴设定）
   - stages[i] 可以是单个形态，也可以是「分支形态数组」
     例：伊布 stages[1] 是 8 种伊布进化；臭臭花、奇鲁莉安也有分支
   - 分支由小朋友在进化那一刻自己选，选完写入存档
   ========================================================= */

const ENERGY_PER_STAGE = 60;    // 每阶所需能量（3 课进化一次，5 岁小朋友不用等太久）
const ENERGY_PER_LESSON = 20;   // 每完成一课获得能量

/* 官方高清精灵图（已本地化，见 img/pokemon/） */
function pokeImg(id){ return 'img/pokemon/'+id+'.webp'; }

/* evo = 官方进化条件（石頭 / 亲密度 / 时间…），只用于给孩子看的说明 */
const S = (name,cn,emoji,imgId,evo)=>({name,cn,emoji,imgId,evo});
const C = (id,name,cn,color,emoji,stages)=>({id,name,cn,color,emoji,stages});

/* 分支形态：伊布 8 种进化（官方：全部由「进化石 / 亲密度 + 时间 / 地点 / 妖精招」决定） */
const EEVEELUTIONS = [
  S('Vaporeon','水伊布','💧',134,'水之石'),
  S('Jolteon','雷伊布','⚡',135,'雷之石'),
  S('Flareon','火伊布','🔥',136,'火之石'),
  S('Espeon','太阳伊布','☀️',196,'白天 · 高亲密度'),
  S('Umbreon','月亮伊布','🌙',197,'夜晚 · 高亲密度'),
  S('Leafeon','叶伊布','🍃',470,'苔藓岩石'),
  S('Glaceon','冰伊布','❄️',471,'冰之石'),
  S('Sylveon','仙子伊布','🎀',700,'妖精招 + 高亲密度')
];

const POKEMON = [
  /* ---------- 关都 Kanto ---------- */
  C('bulbasaur','Bulbasaur','妙蛙种子','#6FCF57','🌱',[
    S('Bulbasaur','妙蛙种子','🌱',1), S('Ivysaur','妙蛙草','🌿',2), S('Venusaur','妙蛙花','🌳',3)]),
  C('charmander','Charmander','小火龙','#FF7B29','🔥',[
    S('Charmander','小火龙','🔥',4), S('Charmeleon','火恐龙','🌟',5), S('Charizard','喷火龙','🐉',6)]),
  C('squirtle','Squirtle','杰尼龟','#3DA5FF','💧',[
    S('Squirtle','杰尼龟','💧',7), S('Wartortle','卡咪龟','🐢',8), S('Blastoise','水箭龟','🌊',9)]),
  C('caterpie','Caterpie','绿毛虫','#8DC65A','🐛',[
    S('Caterpie','绿毛虫','🐛',10), S('Metapod','铁甲蛹','🛡️',11), S('Butterfree','巴大蝶','🦋',12)]),
  C('pidgey','Pidgey','波波','#C6A97B','🕊️',[
    S('Pidgey','波波','🕊️',16), S('Pidgeotto','比比鸟','🦅',17), S('Pidgeot','大比鸟','🪽',18)]),
  C('rattata','Rattata','小拉达','#B49B84','🐭',[
    S('Rattata','小拉达','🐭',19), S('Raticate','拉达','🐀',20)]),
  /* ★ 阿柏怪（动画里火箭队詹姆斯的爱宠） */
  C('ekans','Ekans','阿柏蛇','#9B7FD4','🐍',[
    S('Ekans','阿柏蛇','🐍',23), S('Arbok','阿柏怪','🐍',24)]),
  C('pikachu','Pikachu','皮卡丘','#FFD93D','⚡',[
    S('Pichu','皮丘','⚡',172), S('Pikachu','皮卡丘','⚡',25), S('Raichu','雷丘','🔋',26)]),
  C('sandshrew','Sandshrew','穿山鼠','#D8B271','🦔',[
    S('Sandshrew','穿山鼠','🦔',27), S('Sandslash','穿山王','⚔️',28)]),
  C('cleffa','Cleffa','皮宝宝','#F2B6CF','⭐',[
    S('Cleffa','皮宝宝','⭐',173), S('Clefairy','皮皮','🌙',35), S('Clefable','皮可西','✨',36)]),
  C('vulpix','Vulpix','六尾','#FF9E62','🦊',[
    S('Vulpix','六尾','🦊',37), S('Ninetales','九尾','🦊',38)]),
  C('jigglypuff','Jigglypuff','胖丁','#FFB6D5','🎈',[
    S('Igglybuff','宝宝丁','🎀',174), S('Jigglypuff','胖丁','🎈',39), S('Wigglytuff','胖可丁','🌸',40)]),
  C('zubat','Zubat','超音蝠','#8E8BC4','🦇',[
    S('Zubat','超音蝠','🦇',41), S('Golbat','大嘴蝠','🦇',42), S('Crobat','叉字蝠','💜',169)]),
  C('oddish','Oddish','走路草','#79C77A','🌱',[
    S('Oddish','走路草','🌱',43), S('Gloom','臭臭花','🌼',44),
    [S('Vileplume','霸王花','🌺',45,'叶之石'), S('Bellossom','美丽花','💃',182,'日之石')]]),
  C('diglett','Diglett','地鼠','#C69B6D','🕳️',[
    S('Diglett','地鼠','🕳️',50), S('Dugtrio','三地鼠','🕳️',51)]),
  /* ★ 喵喵（火箭队那只） */
  C('meowth','Meowth','喵喵','#E8C46A','🐱',[
    S('Meowth','喵喵','🐱',52), S('Persian','猫老大','💰',53)]),
  C('psyduck','Psyduck','可达鸭','#FFC94D','🦆',[
    S('Psyduck','可达鸭','🦆',54), S('Golduck','哥达鸭','🐧',55)]),
  C('growlithe','Growlithe','卡蒂狗','#F3974C','🐶',[
    S('Growlithe','卡蒂狗','🐶',58), S('Arcanine','风速狗','🔥',59)]),
  C('poliwag','Poliwag','蚊香蝌蚪','#6FA8DC','💧',[
    S('Poliwag','蚊香蝌蚪','💧',60), S('Poliwhirl','蚊香君','🌀',61),
    [S('Poliwrath','蚊香泳士','🥊',62,'水之石'), S('Politoed','蚊香蛙皇','👑',186,'王者之证')]]),
  C('abra','Abra','凯西','#E3B36B','🧘',[
    S('Abra','凯西','🧘',63), S('Kadabra','勇基拉','🥄',64), S('Alakazam','胡地','🔮',65)]),
  C('machop','Machop','腕力','#C98C6B','💪',[
    S('Machop','腕力','💪',66), S('Machoke','豪力','🦾',67), S('Machamp','怪力','🏋️',68)]),
  C('geodude','Geodude','小拳石','#A89A7C','🪨',[
    S('Geodude','小拳石','🪨',74), S('Graveler','隆隆石','⛰️',75), S('Golem','隆隆岩','🗿',76)]),
  C('ponyta','Ponyta','小火马','#FFAE7B','🐴',[
    S('Ponyta','小火马','🐴',77), S('Rapidash','烈焰马','🔥',78)]),
  C('magnemite','Magnemite','小磁怪','#B7C6D6','🧲',[
    S('Magnemite','小磁怪','🧲',81), S('Magneton','三合一磁怪','🧲',82), S('Magnezone','自爆磁怪','⚙️',462)]),
  C('shellder','Shellder','大舌贝','#8FD3E8','🐚',[
    S('Shellder','大舌贝','🐚',90), S('Cloyster','刺甲贝','🛡️',91)]),
  C('gastly','Gastly','鬼斯','#9B6BD6','👻',[
    S('Gastly','鬼斯','👻',92), S('Haunter','鬼斯通','💜',93), S('Gengar','耿鬼','🟣',94)]),
  C('koffing','Koffing','瓦斯弹','#A98BD6','💨',[
    S('Koffing','瓦斯弹','💨',109), S('Weezing','双弹瓦斯','☁️',110)]),
  C('horsea','Horsea','墨海马','#6FA8DC','🌊',[
    S('Horsea','墨海马','🌊',116), S('Seadra','海刺龙','🐉',117), S('Kingdra','刺龙王','👑',230)]),
  C('magikarp','Magikarp','鲤鱼王','#F19A5C','🐟',[
    S('Magikarp','鲤鱼王','🐟',129), S('Gyarados','暴鲤龙','🐲',130)]),
  /* ★ 伊布：8 种分支进化，进化那一刻由小朋友选 */
  C('eevee','Eevee','伊布','#C9A66B','⭐',[
    S('Eevee','伊布','⭐',133), EEVEELUTIONS]),
  C('porygon','Porygon','多边兽','#E28AA8','💠',[
    S('Porygon','多边兽','💠',137), S('Porygon2','多边兽Ⅱ','🔷',233), S('Porygon-Z','多边兽Ｚ','🟣',474)]),
  C('dratini','Dratini','迷你龙','#F2A65A','🐉',[
    S('Dratini','迷你龙','🐉',147), S('Dragonair','哈克龙','💎',148), S('Dragonite','快龙','🐲',149)]),
  C('snorlax','Snorlax','卡比兽','#B7A98C','😴',[
    S('Munchlax','小卡比兽','🍯',446), S('Snorlax','卡比兽','😴',143)]),
  C('togepi','Togepi','波克比','#FFE08A','🥚',[
    S('Togepi','波克比','🥚',175), S('Togetic','波克基古','🌟',176), S('Togekiss','波克基斯','💫',468)]),
  C('happiny','Happiny','小福蛋','#F6B6C8','🥚',[
    S('Happiny','小福蛋','🥚',440), S('Chansey','吉利蛋','💗',113), S('Blissey','幸福蛋','🤍',242)]),

  /* ---------- 城都 Johto ---------- */
  C('chikorita','Chikorita','菊草叶','#8DC65A','🍃',[
    S('Chikorita','菊草叶','🍃',152), S('Bayleef','月桂叶','🌿',153), S('Meganium','大竺葵','🌸',154)]),
  C('cyndaquil','Cyndaquil','火球鼠','#F3974C','🔥',[
    S('Cyndaquil','火球鼠','🔥',155), S('Quilava','火岩鼠','🌋',156), S('Typhlosion','火爆兽','🔥',157)]),
  C('totodile','Totodile','小锯鳄','#5FA8D6','🐊',[
    S('Totodile','小锯鳄','🐊',158), S('Croconaw','蓝鳄','🦷',159), S('Feraligatr','大力鳄','🌊',160)]),
  C('mareep','Mareep','咩利羊','#E8D17A','🐑',[
    S('Mareep','咩利羊','🐑',179), S('Flaaffy','绵绵','⚡',180), S('Ampharos','电龙','💡',181)]),
  C('azurill','Azurill','露力丽','#8FD3E8','💧',[
    S('Azurill','露力丽','💧',298), S('Marill','玛力露','💦',183), S('Azumarill','玛力露丽','🌊',184)]),
  /* ★ 索南斯（ソーナンス / 果然翁，火箭队武藏的爱宠） */
  C('wynaut','Wynaut','小果然','#6FC5C9','🟦',[
    S('Wynaut','小果然','🟦',360), S('Wobbuffet','果然翁 · 索南斯','🙆',202)]),
  C('larvitar','Larvitar','幼基拉斯','#8FB36B','🦖',[
    S('Larvitar','幼基拉斯','🦖',246), S('Pupitar','沙基拉斯','🛡️',247), S('Tyranitar','班基拉斯','⛰️',248)]),

  /* ---------- 丰缘 Hoenn ---------- */
  C('treecko','Treecko','木守宫','#5DBB63','🦎',[
    S('Treecko','木守宫','🦎',252), S('Grovyle','森林蜥蜴','🌿',253), S('Sceptile','蜥蜴王','🌳',254)]),
  C('torchic','Torchic','火稚鸡','#FF9E62','🐤',[
    S('Torchic','火稚鸡','🐤',255), S('Combusken','力壮鸡','🥊',256), S('Blaziken','火焰鸡','🔥',257)]),
  C('mudkip','Mudkip','水跃鱼','#5FA8D6','💧',[
    S('Mudkip','水跃鱼','💧',258), S('Marshtomp','沼跃鱼','🌊',259), S('Swampert','巨沼怪','🏞️',260)]),
  C('ralts','Ralts','拉鲁拉丝','#A7D7C5','🌸',[
    S('Ralts','拉鲁拉丝','🌸',280), S('Kirlia','奇鲁莉安','💃',281),
    [S('Gardevoir','沙奈朵','✨',282,'等级 30'), S('Gallade','艾路雷朵','⚔️',475,'觉醒之石（雄性）')]]),
  C('beldum','Beldum','铁哑铃','#8FA8BF','🔩',[
    S('Beldum','铁哑铃','🔩',374), S('Metang','金属怪','⚙️',375), S('Metagross','巨金怪','🤖',376)]),
  C('bagon','Bagon','宝贝龙','#7BA7D0','🐲',[
    S('Bagon','宝贝龙','🐲',371), S('Shelgon','甲壳龙','🛡️',372), S('Salamence','暴飞龙','🐉',373)]),

  /* ---------- 神奥 Sinnoh ---------- */
  C('turtwig','Turtwig','草苗龟','#8BC34A','🌱',[
    S('Turtwig','草苗龟','🌱',387), S('Grotle','树林龟','🌿',388), S('Torterra','土台龟','🌳',389)]),
  C('chimchar','Chimchar','小火焰猴','#E8773A','🔥',[
    S('Chimchar','小火焰猴','🔥',390), S('Monferno','猛火猴','🔥',391), S('Infernape','烈焰猴','🐵',392)]),
  C('piplup','Piplup','波加曼','#2E9BD6','🐧',[
    S('Piplup','波加曼','🐧',393), S('Prinplup','双刃丸','💧',394), S('Empoleon','帝王拿波','⚓',395)]),
  C('shinx','Shinx','小猫怪','#5C8FD6','⚡',[
    S('Shinx','小猫怪','⚡',403), S('Luxio','勒克猫','🔋',404), S('Luxray','伦琴猫','👁️',405)]),
  C('gible','Gible','圆陆鲨','#4FA3D1','🦈',[
    S('Gible','圆陆鲨','🦈',443), S('Gabite','尖牙陆鲨','🌊',444), S('Garchomp','烈咬陆鲨','🗡️',445)]),
  C('lucario','Lucario','路卡利欧','#3A6EA5','🥊',[
    S('Riolu','利欧路','🥋',447), S('Lucario','路卡利欧','🥊',448)]),

  /* ---------- 卡洛斯 Kalos ---------- */
  C('chespin','Chespin','哈力栗','#9BB96A','🌰',[
    S('Chespin','哈力栗','🌰',650), S('Quilladin','胖胖哈力','🛡️',651), S('Chesnaught','布里卡隆','🌳',652)]),
  C('fennekin','Fennekin','火狐狸','#F2A05A','🦊',[
    S('Fennekin','火狐狸','🦊',653), S('Braixen','长尾火狐','🔥',654), S('Delphox','妖火红狐','🔮',655)]),
  C('froakie','Froakie','呱呱泡蛙','#5FA8D6','🐸',[
    S('Froakie','呱呱泡蛙','🐸',656), S('Frogadier','呱头蛙','💧',657), S('Greninja','甲贺忍蛙','🥷',658)]),

  /* ---------- 阿罗拉 Alola ---------- */
  C('rowlet','Rowlet','木木枭','#8DC65A','🦉',[
    S('Rowlet','木木枭','🦉',722), S('Dartrix','投羽枭','🏹',723), S('Decidueye','狙射树枭','🦉',724)]),
  C('litten','Litten','火斑喵','#E8773A','🐱',[
    S('Litten','火斑喵','🐱',725), S('Torracat','炎热喵','🔥',726), S('Incineroar','炽焰咆哮虎','🐯',727)]),
  C('popplio','Popplio','球球海狮','#6FC5C9','🦭',[
    S('Popplio','球球海狮','🦭',728), S('Brionne','花漾海狮','🎵',729), S('Primarina','西狮海壬','🌊',730)]),

  /* ---------- 伽勒尔 Galar ---------- */
  C('grookey','Grookey','敲音猴','#5DBB63','🐵',[
    S('Grookey','敲音猴','🐵',810), S('Thwackey','啪咚猴','🥁',811), S('Rillaboom','轰擂金刚猩','🥁',812)]),
  C('scorbunny','Scorbunny','炎兔儿','#F3974C','🐰',[
    S('Scorbunny','炎兔儿','🐰',813), S('Raboot','腾蹴小将','⚽',814), S('Cinderace','闪焰王牌','🔥',815)]),
  C('sobble','Sobble','泪眼蜥','#6FA8DC','🦎',[
    S('Sobble','泪眼蜥','🦎',816), S('Drizzile','变涩蜥','💧',817), S('Inteleon','千面避役','🕵️',818)]),
];

/* 取某一阶的形态（考虑分支） */
function formOf(pk, stage, branch){
  const s = pk.stages[Math.max(0, Math.min(stage, pk.stages.length-1))];
  if(!Array.isArray(s)) return s;
  return s[Math.max(0, Math.min(branch||0, s.length-1))];
}
/* 这一阶是否有多个可选进化形态 */
function isBranchStage(pk, stage){ return Array.isArray(pk.stages[stage]); }
function branchOptions(pk, stage){ return isBranchStage(pk,stage) ? pk.stages[stage] : []; }
/* 这条进化链里哪些阶是「多选一」的分支阶 */
function branchStages(pk){ return pk.stages.map((s,i)=>Array.isArray(s)?i:-1).filter(i=>i>=0); }
/* 整条链里最多的分支形态数（伊布 8、臭臭花 2…），用于头像角标 */
function chainBranchCount(pk){
  return branchStages(pk).reduce((m,i)=>Math.max(m, branchOptions(pk,i).length), 0);
}
