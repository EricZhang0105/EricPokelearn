/* =========================================================
   PokeLearn · 绘本库（Picture Book Library）
   ---------------------------------------------------------
   1) 插画引擎：纯内联 SVG，无外部图片依赖，离线可用、体积极小
   2) 绘本数据：中文 / English 两库，K1 / K2 / P1 / P2 四档
   3) 上新机制：按数组顺序每 5 本为一周，从 BOOK_RELEASE.start 起
      每周一自动解锁下一批 5 本；旧绘本永不下架，持续累积
   ========================================================= */

/* ---------------- 分级 ---------------- */
const BOOK_LEVELS = [
  { id:'k1', label:'K1', cn:'幼儿园低班', age:'4–5 岁', color:'#FF8A3D' },
  { id:'k2', label:'K2', cn:'幼儿园高班', age:'5–6 岁', color:'#3DA5FF' },
  { id:'p1', label:'P1', cn:'小学一年级', age:'6–7 岁', color:'#7A6EF0' },
  { id:'p2', label:'P2', cn:'小学二年级', age:'7–8 岁', color:'#46C98B' }
];
const BOOK_LANGS = [
  { id:'zh', label:'中文绘本', flag:'🇨🇳', color:'#FF5C8A' },
  { id:'en', label:'English', flag:'🔤', color:'#3DA5FF' }
];

/* 第一批绘本上线的那个周一；之后每周一自动 +5 本
   （起始周已往前推，让书架一开始就有积累；新书按周一批批放出） */
const BOOK_RELEASE = { start:'2026-10-12', perWeek:5 };

/* =========================================================
   一、SVG 插画引擎
   viewBox 400 × 260，地平线 y=210
   ========================================================= */
const ART_W = 400, ART_H = 260, GROUND = 210;

const SKY_KEYS = { sun:1, moon:1, star:1, cloud:1, bird:1, kite:1, rainbow:1 };

const ITEM_SCALE = {
  tree:1.35, house:1.35, castle:1.3, car:1.1, boat:1.05, rainbow:1.5,
  apple:0.78, banana:0.78, watermelon:0.8, grapes:0.78, flower:0.75,
  ball:0.8, seed:0.7, leaf:0.7, bug:0.7, box:0.85, hat:0.8, cake:0.9,
  book:0.8, umbrella:0.95, pan:0.95, drum:0.95, cat:1, dog:1, rabbit:1, bear:1, duck:1,
  bird:0.9, fish:0.95, child:1, sprout:0.85, plant:0.85, seaweed:0.9,
  moon:1, sun:1, star:1, cloud:1, kite:1
};

const SHAPES = {
  /* ---- 天空 ---- */
  sun:(x,y,s)=>`<g transform="translate(${x},${y}) scale(${s})">
      <circle r="27" fill="#FFCE4A"/><circle r="20" fill="#FFDA6B"/>
      ${Array.from({length:8},(_,i)=>{const a=i*Math.PI/4;
        return `<line x1="${(Math.cos(a)*34).toFixed(1)}" y1="${(Math.sin(a)*34).toFixed(1)}"
          x2="${(Math.cos(a)*44).toFixed(1)}" y2="${(Math.sin(a)*44).toFixed(1)}"
          stroke="#FFCE4A" stroke-width="5" stroke-linecap="round"/>`;}).join('')}
    </g>`,
  moon:(x,y,s)=>`<g transform="translate(${x},${y}) scale(${s})">
      <path d="M10,-28 A28,28 0 1,0 10,28 A22,22 0 1,1 10,-28 Z" fill="#FFF0BF"/>
      <circle cx="-4" cy="-6" r="4" fill="#F3DFA0" opacity=".7"/>
      <circle cx="2" cy="10" r="3" fill="#F3DFA0" opacity=".7"/>
    </g>`,
  star:(x,y,s)=>`<g transform="translate(${x},${y}) scale(${s})">
      <polygon points="0,-13 4,-4 13,-4 6,2 8,11 0,6 -8,11 -6,2 -13,-4 -4,-4" fill="#FFE066"/>
    </g>`,
  cloud:(x,y,s)=>`<g transform="translate(${x},${y}) scale(${s})" opacity=".95">
      <ellipse cx="-16" cy="2" rx="18" ry="14" fill="#fff"/>
      <ellipse cx="4" cy="-4" rx="22" ry="18" fill="#fff"/>
      <ellipse cx="24" cy="4" rx="15" ry="12" fill="#fff"/>
      <rect x="-16" y="2" width="40" height="14" rx="7" fill="#fff"/>
    </g>`,
  rainbow:(x,y,s)=>`<g transform="translate(${x},${y}) scale(${s})" fill="none" stroke-linecap="round">
      <path d="M-90,30 A90,90 0 0,1 90,30" stroke="#FF7A7A" stroke-width="9"/>
      <path d="M-78,30 A78,78 0 0,1 78,30" stroke="#FFC15E" stroke-width="9"/>
      <path d="M-66,30 A66,66 0 0,1 66,30" stroke="#8FE08F" stroke-width="9"/>
      <path d="M-54,30 A54,54 0 0,1 54,30" stroke="#7EC8FF" stroke-width="9"/>
      <path d="M-42,30 A42,42 0 0,1 42,30" stroke="#B79BFF" stroke-width="9"/>
    </g>`,
  kite:(x,y,s)=>`<g transform="translate(${x},${y}) scale(${s})">
      <polygon points="0,-26 20,0 0,30 -20,0" fill="#FF6B6B"/>
      <line x1="0" y1="-26" x2="0" y2="30" stroke="#fff" stroke-width="2" opacity=".8"/>
      <line x1="-20" y1="0" x2="20" y2="0" stroke="#fff" stroke-width="2" opacity=".8"/>
      <path d="M0,30 q10,14 -4,22 q12,6 2,20" stroke="#FF9A9A" stroke-width="3" fill="none"/>
    </g>`,

  /* ---- 自然 ---- */
  tree:(x,y,s)=>`<g transform="translate(${x},${y}) scale(${s})">
      <rect x="-9" y="-46" width="18" height="48" rx="6" fill="#B57A46"/>
      <circle cx="0" cy="-72" r="40" fill="#5FC46E"/>
      <circle cx="-26" cy="-56" r="26" fill="#71D07E"/>
      <circle cx="26" cy="-56" r="26" fill="#4FB761"/>
      <circle cx="0" cy="-88" r="24" fill="#7BD98A"/>
    </g>`,
  flower:(x,y,s)=>`<g transform="translate(${x},${y}) scale(${s})">
      <path d="M0,0 L0,-26" stroke="#4FAE5A" stroke-width="4" stroke-linecap="round"/>
      <path d="M0,-14 q-12,-6 -14,4 q12,4 14,-4" fill="#6FCB78"/>
      ${[0,72,144,216,288].map(d=>{
        const a=d*Math.PI/180;
        return `<circle cx="${(Math.cos(a)*11).toFixed(1)}" cy="${(-30+Math.sin(a)*11).toFixed(1)}" r="9" fill="#FF9AC0"/>`;
      }).join('')}
      <circle cx="0" cy="-30" r="7" fill="#FFD34E"/>
    </g>`,
  seed:(x,y,s)=>`<g transform="translate(${x},${y}) scale(${s})">
      <ellipse cx="0" cy="-8" rx="10" ry="13" fill="#A9724A"/>
      <ellipse cx="-3" cy="-11" rx="3" ry="5" fill="#C99567"/>
    </g>`,
  sprout:(x,y,s)=>`<g transform="translate(${x},${y}) scale(${s})">
      <path d="M0,0 L0,-30" stroke="#5FBF6B" stroke-width="5" stroke-linecap="round"/>
      <path d="M0,-24 q-16,-14 -24,-2 q12,12 24,2" fill="#6FD07C"/>
      <path d="M0,-18 q16,-14 24,-2 q-12,12 -24,2" fill="#58BE68"/>
    </g>`,
  plant:(x,y,s)=>`<g transform="translate(${x},${y}) scale(${s})">
      <path d="M0,0 L0,-42" stroke="#4FAE5A" stroke-width="5" stroke-linecap="round"/>
      <path d="M0,-16 q-18,-8 -22,4 q16,8 22,-4" fill="#6FCB78"/>
      <path d="M0,-26 q18,-8 22,4 q-16,8 -22,-4" fill="#57B968"/>
      <path d="M0,-40 q-14,-10 -20,-2 q12,10 20,2" fill="#7BD98A"/>
    </g>`,
  leaf:(x,y,s)=>`<g transform="translate(${x},${y}) scale(${s})">
      <path d="M0,0 q-14,-16 0,-30 q14,14 0,30" fill="#E5A93D"/>
      <path d="M0,0 L0,-28" stroke="#C98B2A" stroke-width="2"/>
    </g>`,
  seaweed:(x,y,s)=>`<g transform="translate(${x},${y}) scale(${s})" stroke="#3FA86B" stroke-width="7"
      fill="none" stroke-linecap="round">
      <path d="M-10,0 q10,-18 -2,-34 q-12,-16 2,-30"/>
      <path d="M10,0 q-10,-16 2,-30 q12,-14 -2,-26"/>
    </g>`,

  /* ---- 建筑与物品 ---- */
  house:(x,y,s)=>`<g transform="translate(${x},${y}) scale(${s})">
      <rect x="-46" y="-56" width="92" height="58" fill="#FFE0B2"/>
      <polygon points="-56,-56 0,-96 56,-56" fill="#E2603F"/>
      <rect x="-12" y="-30" width="24" height="32" rx="3" fill="#B5723F"/>
      <rect x="-38" y="-44" width="20" height="18" rx="3" fill="#8FD3F4"/>
      <rect x="18" y="-44" width="20" height="18" rx="3" fill="#8FD3F4"/>
      <circle cx="38" cy="-84" r="5" fill="#FFF3C4"/>
    </g>`,
  castle:(x,y,s)=>`<g transform="translate(${x},${y}) scale(${s})">
      <rect x="-44" y="-52" width="88" height="54" fill="#F3D9A4"/>
      <rect x="-44" y="-64" width="88" height="14" fill="#E4C489"/>
      <rect x="-38" y="-86" width="20" height="26" fill="#F3D9A4"/>
      <rect x="18" y="-86" width="20" height="26" fill="#F3D9A4"/>
      <polygon points="-38,-86 -28,-104 -18,-86" fill="#E2603F"/>
      <polygon points="18,-86 28,-104 38,-86" fill="#E2603F"/>
      <rect x="-10" y="-30" width="20" height="32" rx="9" fill="#B5723F"/>
    </g>`,
  boat:(x,y,s)=>`<g transform="translate(${x},${y}) scale(${s})">
      <path d="M-56,0 q56,20 112,0 l-10,-14 h-92 z" fill="#E2603F"/>
      <rect x="-4" y="-70" width="5" height="58" fill="#B5723F"/>
      <path d="M1,-66 l42,44 h-42 z" fill="#FFF6E0"/>
      <path d="M-6,-60 l-26,38 h26 z" fill="#FFD9A8"/>
    </g>`,
  car:(x,y,s)=>`<g transform="translate(${x},${y}) scale(${s})">
      <rect x="-52" y="-38" width="104" height="30" rx="12" fill="#5AA9F0"/>
      <path d="M-28,-38 q10,-22 28,-22 q18,0 26,22 z" fill="#8FC7F7"/>
      <circle cx="-28" cy="-6" r="12" fill="#3B3B3B"/><circle cx="-28" cy="-6" r="5" fill="#CFCFCF"/>
      <circle cx="30" cy="-6" r="12" fill="#3B3B3B"/><circle cx="30" cy="-6" r="5" fill="#CFCFCF"/>
      <rect x="44" y="-32" width="8" height="6" rx="3" fill="#FFE066"/>
    </g>`,
  cake:(x,y,s)=>`<g transform="translate(${x},${y}) scale(${s})">
      <ellipse cx="0" cy="0" rx="40" ry="7" fill="#EADFD0"/>
      <rect x="-34" y="-26" width="68" height="26" rx="6" fill="#FFC7DA"/>
      <rect x="-28" y="-44" width="56" height="20" rx="6" fill="#FFE1EC"/>
      <path d="M-34,-26 q34,10 68,0" fill="none" stroke="#FF9AC0" stroke-width="5"/>
      <rect x="-2" y="-62" width="4" height="18" fill="#7EC8FF"/>
      <path d="M0,-64 q6,-10 0,-14 q-6,4 0,14" fill="#FFB43D"/>
      ${[-20,0,20].map(x=>`<circle cx="${x}" cy="-32" r="3" fill="#FF6B9A"/>`).join('')}
    </g>`,
  ball:(x,y,s)=>`<g transform="translate(${x},${y}) scale(${s})">
      <circle cx="0" cy="-20" r="20" fill="#FF6B6B"/>
      <path d="M-20,-20 q20,-14 40,0 q-20,14 -40,0" fill="#FFE1E1"/>
      <circle cx="0" cy="-20" r="20" fill="none" stroke="#E14C4C" stroke-width="2"/>
    </g>`,
  box:(x,y,s)=>`<g transform="translate(${x},${y}) scale(${s})">
      <rect x="-24" y="-30" width="48" height="30" fill="#D9A96C"/>
      <rect x="-26" y="-36" width="52" height="8" fill="#E8BE84"/>
      <line x1="0" y1="-36" x2="0" y2="0" stroke="#C08F55" stroke-width="3"/>
    </g>`,
  hat:(x,y,s)=>`<g transform="translate(${x},${y}) scale(${s})">
      <ellipse cx="0" cy="-4" rx="30" ry="8" fill="#E14C4C"/>
      <path d="M-16,-4 q0,-26 16,-26 q16,0 16,26 z" fill="#FF6B6B"/>
      <rect x="-16" y="-10" width="32" height="6" fill="#FFE1E1"/>
    </g>`,
  umbrella:(x,y,s)=>`<g transform="translate(${x},${y}) scale(${s})">
      <path d="M-42,-34 q42,-46 84,0 q-21,-10 -42,0 q-21,-10 -42,0 z" fill="#FF7A9A"/>
      <line x1="0" y1="-34" x2="0" y2="6" stroke="#8A6A3A" stroke-width="4"/>
      <path d="M0,6 q10,0 10,-10" stroke="#8A6A3A" stroke-width="4" fill="none" stroke-linecap="round"/>
    </g>`,
  book:(x,y,s)=>`<g transform="translate(${x},${y}) scale(${s})">
      <rect x="-26" y="-32" width="52" height="32" rx="4" fill="#5AA9F0"/>
      <rect x="-26" y="-32" width="10" height="32" fill="#3D8FD8"/>
      <rect x="-12" y="-26" width="32" height="4" fill="#fff" opacity=".85"/>
      <rect x="-12" y="-18" width="22" height="4" fill="#fff" opacity=".6"/>
    </g>`,
  pan:(x,y,s)=>`<g transform="translate(${x},${y}) scale(${s})">
      <rect x="-30" y="-14" width="44" height="10" rx="5" fill="#7E8C99"/>
      <ellipse cx="-6" cy="-9" rx="26" ry="8" fill="#A9B6C1"/>
      <rect x="12" y="-18" width="34" height="7" rx="3.5" fill="#5C6670"/>
    </g>`,
  drum:(x,y,s)=>`<g transform="translate(${x},${y}) scale(${s})">
      <rect x="-24" y="-40" width="48" height="40" rx="6" fill="#E2603F"/>
      <ellipse cx="0" cy="-40" rx="24" ry="9" fill="#FFE9C7"/>
      <ellipse cx="0" cy="-40" rx="24" ry="9" fill="none" stroke="#C24E30" stroke-width="3"/>
      <path d="M-14,-20 l28,0 M-14,-8 l28,0" stroke="#FFE9C7" stroke-width="3"/>
    </g>`,
  apple:(x,y,s)=>`<g transform="translate(${x},${y}) scale(${s})">
      <circle cx="0" cy="-18" r="17" fill="#E14C4C"/>
      <path d="M0,-34 q2,-8 10,-10" stroke="#7A5230" stroke-width="3" fill="none"/>
      <path d="M2,-40 q12,-8 16,2 q-12,8 -16,-2" fill="#5FC46E"/>
    </g>`,
  banana:(x,y,s)=>`<g transform="translate(${x},${y}) scale(${s})">
      <path d="M-20,-30 q6,26 30,24 q14,-2 8,-8 q-26,2 -30,-20 z" fill="#FFD93D"/>
      <path d="M-20,-30 q6,26 30,24" fill="none" stroke="#E8B81F" stroke-width="2"/>
    </g>`,
  watermelon:(x,y,s)=>`<g transform="translate(${x},${y}) scale(${s})">
      <path d="M-26,-6 a26,26 0 0,0 52,0 z" fill="#EF5B5B"/>
      <path d="M-26,-6 a26,26 0 0,0 52,0" fill="none" stroke="#5FC46E" stroke-width="6"/>
      <circle cx="-10" cy="-8" r="2.6" fill="#3B2B20"/>
      <circle cx="4" cy="-12" r="2.6" fill="#3B2B20"/>
      <circle cx="14" cy="-6" r="2.6" fill="#3B2B20"/>
    </g>`,
  grapes:(x,y,s)=>`<g transform="translate(${x},${y}) scale(${s})">
      ${[[-10,-10],[6,-12],[-16,-22],[0,-24],[14,-24],[-8,-34],[8,-36]].map(([cx,cy])=>
        `<circle cx="${cx}" cy="${cy}" r="8" fill="#9B6BD6"/>`).join('')}
      <path d="M0,-42 q6,-10 16,-10" stroke="#5FA84A" stroke-width="3" fill="none"/>
    </g>`,
  bug:(x,y,s)=>`<g transform="translate(${x},${y}) scale(${s})">
      <ellipse cx="0" cy="-8" rx="12" ry="9" fill="#6B4A2F"/>
      <circle cx="-12" cy="-12" r="6" fill="#4A3220"/>
      <path d="M-16,-18 l-6,-8 M-8,-20 l-2,-10 M0,-8 l-10,6 M0,-8 l10,6" stroke="#4A3220" stroke-width="2"/>
    </g>`,

  /* ---- 动物 ---- */
  cat:(x,y,s)=>`<g transform="translate(${x},${y}) scale(${s})">
      <path d="M30,-40 q28,-14 20,16" fill="none" stroke="#F2A45C" stroke-width="11" stroke-linecap="round"/>
      <ellipse cx="0" cy="-28" rx="34" ry="28" fill="#F2A45C"/>
      <circle cx="-14" cy="-70" r="26" fill="#F7B472"/>
      <path d="M-34,-86 l-3,-22 20,12 z" fill="#F7B472"/>
      <path d="M4,-86 l3,-22 -20,12 z" fill="#F7B472"/>
      <circle cx="-22" cy="-72" r="3.4" fill="#3B2B20"/>
      <circle cx="-6" cy="-72" r="3.4" fill="#3B2B20"/>
      <path d="M-16,-62 q2.5,4 5,0" fill="none" stroke="#3B2B20" stroke-width="2.4" stroke-linecap="round"/>
      <line x1="-26" y1="-64" x2="-42" y2="-68" stroke="#C98B4A" stroke-width="1.6"/>
      <line x1="-26" y1="-60" x2="-42" y2="-58" stroke="#C98B4A" stroke-width="1.6"/>
      <ellipse cx="-24" cy="-40" rx="12" ry="9" fill="#FFD9B0" opacity=".55"/>
    </g>`,
  dog:(x,y,s)=>`<g transform="translate(${x},${y}) scale(${s})">
      <path d="M32,-38 q26,-16 18,10" fill="none" stroke="#C98A57" stroke-width="10" stroke-linecap="round"/>
      <ellipse cx="0" cy="-28" rx="32" ry="26" fill="#C98A57"/>
      <circle cx="-14" cy="-66" r="24" fill="#E0A46C"/>
      <ellipse cx="-32" cy="-64" rx="9" ry="17" fill="#A96F42" transform="rotate(-12 -32 -64)"/>
      <ellipse cx="-2" cy="-62" rx="13" ry="10" fill="#F3D3B0"/>
      <circle cx="-20" cy="-68" r="3.2" fill="#3B2B20"/>
      <circle cx="-8" cy="-68" r="3.2" fill="#3B2B20"/>
      <ellipse cx="-6" cy="-60" rx="5" ry="4" fill="#3B2B20"/>
      <path d="M-6,-56 q0,6 -6,8" stroke="#A96F42" stroke-width="2" fill="none"/>
    </g>`,
  rabbit:(x,y,s)=>`<g transform="translate(${x},${y}) scale(${s})">
      <ellipse cx="0" cy="-24" rx="26" ry="23" fill="#F7F4EF"/>
      <circle cx="-6" cy="-58" r="20" fill="#FFFFFF"/>
      <ellipse cx="-14" cy="-92" rx="7" ry="22" fill="#FFFFFF"/>
      <ellipse cx="-14" cy="-92" rx="3" ry="15" fill="#FFC6D8"/>
      <ellipse cx="2" cy="-94" rx="7" ry="21" fill="#FFFFFF"/>
      <ellipse cx="2" cy="-94" rx="3" ry="14" fill="#FFC6D8"/>
      <circle cx="-13" cy="-60" r="2.8" fill="#3B2B20"/>
      <circle cx="1" cy="-60" r="2.8" fill="#3B2B20"/>
      <path d="M-8,-53 q2,3 4,0" stroke="#E58AA8" stroke-width="2" fill="none"/>
      <circle cx="20" cy="-18" r="6" fill="#F1EDE4"/>
    </g>`,
  bear:(x,y,s)=>`<g transform="translate(${x},${y}) scale(${s})">
      <ellipse cx="0" cy="-30" rx="32" ry="27" fill="#C08F63"/>
      <circle cx="-14" cy="-70" r="23" fill="#D2A377"/>
      <circle cx="-32" cy="-86" r="9" fill="#D2A377"/>
      <circle cx="2" cy="-88" r="9" fill="#D2A377"/>
      <ellipse cx="-14" cy="-64" rx="11" ry="8" fill="#F0D7B4"/>
      <circle cx="-20" cy="-72" r="2.8" fill="#3B2B20"/>
      <circle cx="-6" cy="-72" r="2.8" fill="#3B2B20"/>
      <ellipse cx="-14" cy="-64" rx="4" ry="3" fill="#3B2B20"/>
      <ellipse cx="-26" cy="-34" rx="11" ry="8" fill="#E3CBA8" opacity=".6"/>
    </g>`,
  duck:(x,y,s)=>`<g transform="translate(${x},${y}) scale(${s})">
      <ellipse cx="4" cy="-20" rx="30" ry="19" fill="#FFD93D"/>
      <path d="M-8,-18 q14,-6 20,4 q-14,8 -20,-4" fill="#F0C42A"/>
      <circle cx="-18" cy="-48" r="16" fill="#FFE066"/>
      <path d="M-32,-46 l-16,4 l16,6 z" fill="#FF9A3D"/>
      <circle cx="-22" cy="-52" r="2.6" fill="#3B2B20"/>
      <path d="M-2,-4 l0,4 M12,-4 l0,4" stroke="#FF9A3D" stroke-width="3"/>
    </g>`,
  bird:(x,y,s)=>`<g transform="translate(${x},${y}) scale(${s})">
      <ellipse cx="0" cy="-18" rx="22" ry="16" fill="#5BB8F0"/>
      <circle cx="-16" cy="-38" r="12" fill="#7ECBF7"/>
      <path d="M-27,-38 l-12,4 l12,5 z" fill="#FFB43D"/>
      <circle cx="-19" cy="-40" r="2.4" fill="#2A3B4A"/>
      <path d="M-2,-24 q14,-6 16,4 q-12,6 -16,-4" fill="#3D9CD8"/>
      <path d="M-6,-2 l-4,4 M4,-2 l4,4" stroke="#FFB43D" stroke-width="2.4"/>
    </g>`,
  fish:(x,y,s)=>`<g transform="translate(${x},${y}) scale(${s})">
      <ellipse cx="0" cy="-34" rx="32" ry="21" fill="#FF9A5C"/>
      <path d="M30,-34 l20,-14 v28 z" fill="#F5873F"/>
      <path d="M-6,-52 q12,-14 22,-4 q-10,10 -22,4" fill="#FFB47F"/>
      <circle cx="-18" cy="-38" r="3.4" fill="#3B2B20"/>
      <path d="M-14,-26 q10,4 18,0" stroke="#F5873F" stroke-width="2" fill="none"/>
    </g>`,
  child:(x,y,s)=>`<g transform="translate(${x},${y}) scale(${s})">
      <path d="M-8,0 l0,-26 M8,0 l0,-26" stroke="#5B6BB5" stroke-width="9" stroke-linecap="round"/>
      <rect x="-16" y="-58" width="32" height="34" rx="12" fill="#6BA8FF"/>
      <path d="M-16,-50 l-12,16 M16,-50 l12,16" stroke="#6BA8FF" stroke-width="8" stroke-linecap="round"/>
      <circle cx="0" cy="-72" r="17" fill="#FFD9B0"/>
      <path d="M-17,-76 q4,-20 17,-20 q13,0 17,20 q-17,-8 -34,0" fill="#4A3A2A"/>
      <circle cx="-6" cy="-72" r="2.4" fill="#3B2B20"/>
      <circle cx="6" cy="-72" r="2.4" fill="#3B2B20"/>
      <path d="M-4,-65 q4,4 8,0" stroke="#C9755A" stroke-width="2" fill="none"/>
    </g>`
};

function artBg(kind){
  const defs = `<defs>
    <linearGradient id="skyDay" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#CFEFFF"/><stop offset="1" stop-color="#EAF9FF"/></linearGradient>
    <linearGradient id="skyNight" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#1E2A5A"/><stop offset="1" stop-color="#46538F"/></linearGradient>
    <linearGradient id="skyRain" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#B9C9D8"/><stop offset="1" stop-color="#DDE7EF"/></linearGradient>
  </defs>`;

  if(kind==='night'){
    let stars='';
    const pts=[[40,44],[92,30],[150,54],[210,26],[268,48],[330,32],[372,62],[64,84],[240,74],[300,88]];
    pts.forEach(([x,y],i)=>{ stars+=`<circle cx="${x}" cy="${y}" r="${i%3===0?2:1.4}" fill="#FFF8D8" opacity=".9"/>`; });
    return defs+`<rect width="400" height="260" fill="url(#skyNight)"/>${stars}
      <path d="M0,206 q100,-28 200,-6 q100,22 200,-4 v64 H0 z" fill="#2B3668"/>
      <path d="M0,222 q120,-16 220,2 q90,16 180,-2 v38 H0 z" fill="#20294F"/>`;
  }
  if(kind==='sea'){
    return defs+`<rect width="400" height="260" fill="url(#skyDay)"/>
      <rect y="168" width="400" height="92" fill="#6FD3EC"/>
      <path d="M0,168 q26,-9 52,0 q26,9 52,0 q26,-9 52,0 q26,9 52,0 q26,-9 52,0 q26,9 52,0 q26,-9 52,0 v10 H0 z" fill="#8FE0F4"/>
      <path d="M0,206 q30,-8 60,0 q30,8 60,0 q30,-8 60,0 q30,8 60,0 q30,-8 60,0 q30,8 40,0 v60 H0 z" fill="#57C3E3" opacity=".75"/>`;
  }
  if(kind==='room'){
    return defs+`<rect width="400" height="260" fill="#FFE9C9"/>
      <rect y="196" width="400" height="64" fill="#EBC79B"/>
      <rect y="192" width="400" height="6" fill="#D9AF7C"/>
      <rect x="286" y="34" width="78" height="66" rx="6" fill="#8FD3F4" stroke="#fff" stroke-width="6"/>
      <line x1="325" y1="34" x2="325" y2="100" stroke="#fff" stroke-width="5"/>
      <line x1="286" y1="67" x2="364" y2="67" stroke="#fff" stroke-width="5"/>`;
  }
  if(kind==='rain'){
    let rain='';
    for(let i=0;i<26;i++){
      const x=(i*37)%400, y=20+((i*53)%150);
      rain+=`<line x1="${x}" y1="${y}" x2="${x-6}" y2="${y+16}" stroke="#9FB8CE" stroke-width="2.4" opacity=".7"/>`;
    }
    return defs+`<rect width="400" height="260" fill="url(#skyRain)"/>${rain}
      <rect y="204" width="400" height="56" fill="#A8D5A2"/>
      <ellipse cx="120" cy="228" rx="46" ry="9" fill="#8FC9E0" opacity=".8"/>
      <ellipse cx="300" cy="240" rx="36" ry="7" fill="#8FC9E0" opacity=".8"/>`;
  }
  if(kind==='snow'){
    let flakes='';
    for(let i=0;i<24;i++){
      const x=(i*61)%400, y=16+((i*47)%170);
      flakes+=`<circle cx="${x}" cy="${y}" r="${i%2?2:2.8}" fill="#fff" opacity=".9"/>`;
    }
    return defs+`<rect width="400" height="260" fill="#E6F2FF"/>${flakes}
      <path d="M0,204 q100,-26 200,-4 q100,22 200,-6 v66 H0 z" fill="#FFFFFF"/>
      <path d="M0,228 q120,-14 220,4 q90,14 180,-4 v32 H0 z" fill="#F2FAFF"/>`;
  }
  if(kind==='forest'){
    return defs+`<rect width="400" height="260" fill="#DCF3E2"/>
      <circle cx="60" cy="150" r="46" fill="#A8DDB2" opacity=".7"/>
      <circle cx="180" cy="140" r="54" fill="#A8DDB2" opacity=".6"/>
      <circle cx="320" cy="152" r="44" fill="#A8DDB2" opacity=".7"/>
      <path d="M0,200 q100,-22 200,-2 q100,20 200,-6 v68 H0 z" fill="#8FD06F"/>
      <path d="M0,224 q120,-16 220,0 q90,14 180,-2 v38 H0 z" fill="#79BF5B"/>`;
  }
  if(kind==='garden'){
    return defs+`<rect width="400" height="260" fill="url(#skyDay)"/>
      <path d="M0,196 q100,-24 200,-4 q100,20 200,-6 v74 H0 z" fill="#B7E884"/>
      <path d="M0,220 q120,-12 220,4 q90,12 180,-4 v40 H0 z" fill="#9FDB6B"/>
      ${[[46,206],[92,214],[330,212],[368,204]].map(([x,y])=>
        `<circle cx="${x}" cy="${y}" r="4" fill="#fff" opacity=".8"/>`).join('')}`;
  }
  /* day 默认 */
  return defs+`<rect width="400" height="260" fill="url(#skyDay)"/>
    <path d="M0,200 q100,-26 200,-6 q100,22 200,-8 v74 H0 z" fill="#A8E063"/>
    <path d="M0,222 q120,-14 220,2 q90,14 180,-4 v40 H0 z" fill="#8CD24C"/>`;
}

function parseArt(spec){
  if(!spec) return { bg:'day', items:[] };
  const bar = String(spec).indexOf('|');
  const bg = bar<0 ? String(spec).trim() : String(spec).slice(0,bar).trim();
  const rest = bar<0 ? '' : String(spec).slice(bar+1);
  const items = rest.split(',').map(s=>s.trim()).filter(Boolean);
  return { bg: bg || 'day', items };
}

const SKY_SLOTS = [[322,74],[78,66],[200,48],[286,112],[112,108],[352,120],[40,110]];

/* 生成一张插图 SVG */
function bookArt(spec){
  const { bg, items } = parseArt(spec);
  const sky = [], ground = [];
  items.forEach(k=>(SKY_KEYS[k] ? sky : ground).push(k));

  let out = artBg(bg);

  // 天空元素：从后往前铺，避免挡住地面主体
  sky.slice().reverse().forEach(()=>{});
  sky.forEach((k,i)=>{
    const fn = SHAPES[k]; if(!fn) return;
    let [x,y] = SKY_SLOTS[i % SKY_SLOTS.length];
    if(k==='star'){ x = 40 + ((i*67)%320); y = 26 + ((i*37)%70); }
    if(k==='cloud'){ y = 46 + ((i%2)*18); }
    if(k==='bird'){ y = 100 + ((i%2)*14); }
    const s = ITEM_SCALE[k] || 1;
    out += fn(x,y,s);
  });

  // 地面元素：沿地平线均匀排开
  const n = ground.length;
  ground.forEach((k,i)=>{
    const fn = SHAPES[k]; if(!fn) return;
    const x = n===1 ? 200 : 62 + (276 * (i/(n-1)));
    const s = ITEM_SCALE[k] || 1;
    const jitter = (i%2 ? 6 : 0);            // 轻微错位，避免一排太呆板
    out += fn(x, GROUND + jitter, s);
  });

  return `<svg class="book-svg" viewBox="0 0 ${ART_W} ${ART_H}" preserveAspectRatio="xMidYMid slice"
    role="img" aria-hidden="true">${out}</svg>`;
}

/* =========================================================
   二、绘本内容（每页 = [正文, 插画]）
   顺序决定上新批次：每 5 本一周
   ========================================================= */
const RAW_BOOKS = [

  /* ---------- 第 1 周 ---------- */
  { id:'zh-k1-cat-mom', lang:'zh', level:'k1', title:'小猫找妈妈', titleEn:'Little Cat Finds Mom',
    tag:'亲情 · 重复句', pages:[
    ['小猫醒了。妈妈不见了。','day|house,cat'],
    ['小猫问小鸟：“你看见我妈妈吗？”','day|bird,cat'],
    ['小鸟说：“妈妈在那边。”','day|tree,bird,cat'],
    ['小猫跑过去。妈妈在树下等他。','day|tree,cat,cat'],
    ['小猫说：“妈妈，我找到你了！”','day|tree,cat,cat']
  ]},

  { id:'en-k1-big-red-ball', lang:'en', level:'k1', title:'The Big Red Ball', titleEn:'大红球',
    tag:'CVC · sight words', pages:[
    ['I see a big red ball.','day|child,ball'],
    ['The ball is in the box.','room|ball,box'],
    ['The dog can get the ball.','garden|dog,ball'],
    ['The dog runs with the ball.','garden|dog,ball'],
    ['We play with the ball.','garden|child,dog,ball']
  ]},

  { id:'zh-k2-red-balloon', lang:'zh', level:'k2', title:'小兔子的红气球', titleEn:"Rabbit's Red Balloon",
    tag:'情绪 · 友谊', pages:[
    ['小兔子有一个红气球。','garden|rabbit,ball'],
    ['风一吹，气球飞走了。','garden|rabbit,ball,cloud'],
    ['气球飞到大树上。','garden|tree,ball,rabbit'],
    ['小鸟帮小兔子拿气球。','garden|bird,tree,ball,rabbit'],
    ['气球破了，小兔子哭了。','garden|rabbit,bird'],
    ['小鸟说：“别哭，我送你一朵云。”','garden|cloud,bird,rabbit']
  ]},

  { id:'en-k1-sam-cat', lang:'en', level:'k1', title:'Sam and the Cat', titleEn:'山姆和小猫',
    tag:'CVC · 方位词', pages:[
    ['Sam has a cat.','room|child,cat'],
    ['The cat is on the mat.','room|cat'],
    ['The cat can jump.','room|cat'],
    ['The cat is on the bed.','room|cat'],
    ['Sam hugs the cat.','room|child,cat']
  ]},

  { id:'zh-k1-fruit', lang:'zh', level:'k1', title:'我爱吃水果', titleEn:'I Like Fruit',
    tag:'颜色 · 叠词', pages:[
    ['我喜欢吃苹果。苹果红红的。','day|apple,child'],
    ['我喜欢吃香蕉。香蕉黄黄的。','day|banana,child'],
    ['我喜欢吃西瓜。西瓜甜甜的。','day|watermelon,child'],
    ['我喜欢吃葡萄。葡萄一串一串。','day|grapes,child'],
    ['水果真好吃！','day|apple,banana,watermelon,child']
  ]},

  /* ---------- 第 2 周 ---------- */
  { id:'en-k2-lost-hat', lang:'en', level:'k2', title:'The Lost Hat', titleEn:'帽子不见了',
    tag:'长元音 · 解决问题', pages:[
    ['Meg has a red hat.','day|child,hat'],
    ['The wind takes the hat.','day|child,hat,cloud'],
    ['The hat is in the tree.','day|tree,hat'],
    ['A bird sits on the hat.','day|bird,tree,hat'],
    ['Meg gets a long stick.','day|child,tree,hat'],
    ['Meg has her hat again!','day|child,hat,bird']
  ]},

  { id:'zh-k2-flying-fish', lang:'zh', level:'k2', title:'会飞的鱼', titleEn:'The Fish Who Wanted to Fly',
    tag:'想象 · 回家', pages:[
    ['小鱼住在海里。','sea|fish,fish'],
    ['它想飞到天上去。','sea|fish,cloud'],
    ['它用力跳出水面。','sea|fish'],
    ['它看见了一条大船。','sea|boat,fish'],
    ['它看见了大海鸥。','sea|bird,boat,fish'],
    ['小鱼说：“海里也很好，我回家了。”','sea|fish,fish']
  ]},

  { id:'en-k1-i-can-see', lang:'en', level:'k1', title:'I Can See', titleEn:'我看见了',
    tag:'高频句 · 自然', pages:[
    ['I can see a sun.','day|sun,child'],
    ['I can see a tree.','day|tree,child'],
    ['I can see a bird.','day|bird,tree,child'],
    ['I can see a dog.','garden|dog,child'],
    ['I can see my mom.','day|child,child']
  ]},

  { id:'zh-k1-rain', lang:'zh', level:'k1', title:'下雨了', titleEn:'It Is Raining',
    tag:'拟声词 · 天气', pages:[
    ['天空黑了，要下雨了。','rain|cloud'],
    ['滴答，滴答，下雨了。','rain|cloud,child'],
    ['我打开小雨伞。','rain|umbrella,child'],
    ['小蚂蚁躲到伞下面。','rain|umbrella,child,bug'],
    ['雨停了，太阳出来了。','day|sun,rainbow,child']
  ]},

  { id:'en-k2-six-fish', lang:'en', level:'k2', title:'Six Little Fish', titleEn:'六条小鱼',
    tag:'数数 · 海洋', pages:[
    ['Six little fish swim in the sea.','sea|fish,fish,fish'],
    ['One fish sees a big rock.','sea|fish'],
    ['Two fish see green seaweed.','sea|fish,fish,seaweed'],
    ['Three fish see a boat.','sea|boat,fish,fish'],
    ['The boat goes away.','sea|fish,fish'],
    ['Six little fish swim home.','sea|fish,fish,fish,fish']
  ]},

  /* ---------- 第 3 周 ---------- */
  { id:'zh-k1-birthday', lang:'zh', level:'k1', title:'小熊的生日', titleEn:"Bear's Birthday",
    tag:'社交 · 礼貌用语', pages:[
    ['今天是小熊的生日。','room|cake,bear'],
    ['小兔来了，带来一朵花。','room|cake,bear,rabbit,flower'],
    ['小狗来了，带来一个球。','room|cake,bear,dog,ball'],
    ['大家一起唱生日歌。','room|cake,bear,rabbit,dog'],
    ['小熊说：“谢谢你们！”','room|cake,bear,rabbit,dog']
  ]},

  { id:'en-k1-my-dog-ben', lang:'en', level:'k1', title:'My Dog Ben', titleEn:'我的狗 Ben',
    tag:'CVC · can 句型', pages:[
    ['This is my dog Ben.','garden|dog,child'],
    ['Ben can run fast.','garden|dog'],
    ['Ben can jump high.','garden|dog,ball'],
    ['Ben likes the ball.','garden|dog,ball'],
    ['I love Ben.','garden|child,dog']
  ]},

  { id:'zh-p1-moon-rabbit', lang:'zh', level:'p1', title:'月亮上的兔子', titleEn:'The Rabbit on the Moon',
    tag:'民间故事 · 中秋', pages:[
    ['很久很久以前，月亮上住着一只兔子。','night|moon,rabbit'],
    ['兔子往下面看，看见一个老爷爷。','night|moon,rabbit,star'],
    ['老爷爷没有饭吃。','night|house,child,star'],
    ['兔子想做一点吃的给他。','night|rabbit,moon'],
    ['兔子用月光做了月饼。','night|rabbit,cake'],
    ['老爷爷吃得很开心。','night|child,cake,rabbit'],
    ['每到月圆的时候，我们抬头看看月亮。','night|moon,rabbit,star']
  ]},

  { id:'en-k2-trip-sea', lang:'en', level:'k2', title:'A Trip to the Sea', titleEn:'去海边',
    tag:'叙事顺序 · 家庭', pages:[
    ['We go to the sea in a car.','day|car,child'],
    ['The sand is hot.','sea|sun,child'],
    ['We make a big sand house.','sea|castle,child'],
    ['Dad swims in the water.','sea|child,fish'],
    ['I find a shell.','sea|star,child'],
    ['We go home at night.','night|car,moon']
  ]},

  { id:'zh-k2-seaside', lang:'zh', level:'k2', title:'一起去海边', titleEn:'Let Us Go to the Sea',
    tag:'生活经验 · 家人', pages:[
    ['今天我们去海边。','day|car,child'],
    ['海边有好多沙子。','sea|child,umbrella'],
    ['我堆了一个沙堡。','sea|castle,child'],
    ['爸爸在海里游泳。','sea|child,child,fish'],
    ['我们捡了很多贝壳。','sea|star,star,child'],
    ['太阳下山了，我们回家。','day|car,child,sun']
    ]},

  /* ---------- 第 4 周 ---------- */
  { id:'en-p1-little-seed', lang:'en', level:'p1', title:'The Little Seed', titleEn:'小种子',
    tag:'科学 · 植物生长', pages:[
    ['A little seed sits in the dark soil.','garden|seed'],
    ['Rain falls on the seed.','rain|cloud'],
    ['The sun is warm.','day|sun'],
    ['A small green shoot comes up.','garden|sprout'],
    ['The shoot grows into a plant.','garden|plant'],
    ['A flower opens.','garden|flower'],
    ['The flower makes new seeds.','garden|flower,flower']
  ]},

  { id:'zh-k1-goodnight-dog', lang:'zh', level:'k1', title:'晚安，小狗', titleEn:'Goodnight, Little Dog',
    tag:'睡前 · 仪式感', pages:[
    ['天黑了。小狗要睡觉了。','night|moon,dog'],
    ['小狗说：“月亮，晚安。”','night|moon,star,dog'],
    ['小狗说：“星星，晚安。”','night|star,star,dog'],
    ['妈妈关上了灯。','night|house,moon,dog'],
    ['晚安，小狗。做个好梦。','night|moon,star,dog']
  ]},

  { id:'en-k1-nan-nap', lang:'en', level:'k1', title:'Nan Can Nap', titleEn:'Nan 会打盹',
    tag:'短元音 a · 日常', pages:[
    ['Nan can nap.','room|child'],
    ['Nan naps on the rug.','room|child'],
    ['The cat naps too.','room|child,cat'],
    ['The sun is up.','day|sun,child,cat'],
    ['Nan can run and play!','garden|child,cat,ball']
  ]},

  { id:'zh-p2-seed-journey', lang:'zh', level:'p2', title:'小种子的大旅行', titleEn:'The Seed’s Long Journey',
    tag:'科学 · 因果', pages:[
    ['一颗小种子躺在泥土里。','garden|seed'],
    ['下雨了，种子喝饱了水。','rain|cloud'],
    ['太阳出来了，种子醒了。','day|sun'],
    ['它长出小小的芽。','garden|sprout'],
    ['风把它吹到很远的地方。','day|cloud,sprout'],
    ['它在新的地方住下来。','garden|plant'],
    ['第二年春天，它开出了花。','garden|flower'],
    ['花里又有很多很多小种子。','garden|flower,flower']
  ]},

  { id:'en-p1-new-friend', lang:'en', level:'p1', title:"Ben's New Friend", titleEn:'Ben 的新朋友',
    tag:'社交 · 对话', pages:[
    ['Ben moves to a new house.','day|house,child'],
    ['He has no friends here.','day|child,house'],
    ['A girl kicks a ball to him.','garden|child,ball,child'],
    ['“Do you want to play?” she asks.','garden|child,ball'],
    ['They play until the sun goes down.','garden|child,child,ball,sun'],
    ['“Come back tomorrow,” says Ben.','garden|child,child'],
    ['Ben has a new friend.','garden|child,child,ball']
  ]},

  /* ---------- 第 5 周 ---------- */
  { id:'zh-k1-duck-swim', lang:'zh', level:'k1', title:'小鸭学游泳', titleEn:'Little Duck Learns to Swim',
    tag:'勇气 · 重复句', pages:[
    ['小鸭想去游泳。','day|duck'],
    ['妈妈说：“跟我来。”','day|duck,duck'],
    ['小鸭跳进水里。','sea|duck'],
    ['水花好大呀！','sea|duck,fish'],
    ['小鸭会游泳了！','sea|duck,fish,duck']
  ]},

  { id:'en-p2-moon-rabbit', lang:'en', level:'p2', title:'The Moon Rabbit', titleEn:'月亮上的兔子',
    tag:'民间故事 · 长句', pages:[
    ['Long ago, a rabbit lived on the moon.','night|moon,rabbit'],
    ['The rabbit looked down at the Earth.','night|moon,rabbit,star'],
    ['It saw a poor old man.','night|house,child,star'],
    ['The rabbit wanted to help him.','night|rabbit,moon'],
    ['It made rice cakes with moonlight.','night|rabbit,cake'],
    ['The old man was happy.','night|child,cake,rabbit'],
    ['Every full moon, look up.','night|moon,rabbit,star'],
    ['You may see the rabbit making cakes.','night|moon,rabbit,cake']
  ]},

  { id:'zh-p2-old-tree', lang:'zh', level:'p2', title:'老树和小鸟', titleEn:'The Old Tree and the Bird',
    tag:'四季 · 约定', pages:[
    ['山坡上有一棵老树。','forest|tree'],
    ['春天，一只小鸟飞来。','forest|tree,bird'],
    ['小鸟在树上做了一个窝。','forest|tree,bird'],
    ['夏天，小鸟唱好听的歌。','forest|tree,bird,sun'],
    ['秋天，叶子黄了。','forest|tree,leaf'],
    ['冬天，小鸟要走了。','snow|tree,bird'],
    ['老树说：“明年春天，你要回来。”','snow|tree,bird'],
    ['春天又来了，小鸟回来了。','forest|tree,bird,flower']
  ]},

  { id:'en-p2-kite-away', lang:'en', level:'p2', title:'The Kite That Flew Away', titleEn:'飞走的风筝',
    tag:'冒险 · 因果', pages:[
    ['Mia made a kite with red paper.','garden|child,kite'],
    ['She ran up the hill.','garden|child,kite'],
    ['The wind took the kite high.','day|kite,cloud,child'],
    ['The kite flew over the trees.','day|tree,kite'],
    ['It flew over the river.','day|kite,boat'],
    ['Mia ran after it.','day|child,tree,kite'],
    ['A boy caught the kite.','day|child,child,kite'],
    ['Now they fly the kite together.','day|child,child,kite']
  ]},

  { id:'zh-p2-who-took-moon', lang:'zh', level:'p2', title:'谁偷走了月亮？', titleEn:'Who Took the Moon?',
    tag:'推理 · 对话', pages:[
    ['晚上，月亮不见了。','night|star,star'],
    ['小猫说：“不是我。”','night|cat'],
    ['小狗说：“不是我。”','night|dog'],
    ['小鱼说：“水里也没有。”','sea|fish'],
    ['小鸟飞到天上找。','night|bird,star'],
    ['原来月亮躲在云后面。','night|cloud,moon'],
    ['风一吹，云走了。','night|cloud,moon,star'],
    ['月亮又亮了。','night|moon,star,bird']
  ]},

  /* ---------- 第 6 周（缓冲，供自动化接续） ---------- */
  { id:'en-k1-tap-pan', lang:'en', level:'k1', title:'Tap the Pan', titleEn:'敲敲小锅',
    tag:'short a · 押韵', pages:[
    ['Tap, tap, tap the pan.','room|child,pan'],
    ['Nan can tap the pan.','room|child,pan'],
    ['The cat can tap too.','room|child,cat,pan'],
    ['Tap, tap, tap the drum.','room|child,drum'],
    ['What a happy sound!','room|child,cat,drum']
  ]},

  { id:'zh-k1-ant-rice', lang:'zh', level:'k1', title:'小蚂蚁搬米粒', titleEn:'The Ant and the Rice',
    tag:'合作 · 数量', pages:[
    ['一只小蚂蚁看见一粒米。','garden|bug,seed'],
    ['它搬不动。','garden|bug,seed'],
    ['它去叫来好朋友。','garden|bug,bug,seed'],
    ['两只蚂蚁一起搬。','garden|bug,bug,seed'],
    ['米粒回家了，大家真开心。','garden|bug,bug,house']
  ]},

  { id:'en-k2-snowman', lang:'en', level:'k2', title:'The Snowman', titleEn:'雪人',
    tag:'冬天 · 描述', pages:[
    ['It is snowing. Everything is white.','snow|cloud'],
    ['We make a big snowman.','snow|child,child'],
    ['He has a hat and a long nose.','snow|child,hat'],
    ['The sun comes out.','snow|sun'],
    ['The snowman gets small.','snow|child,child'],
    ['We will make a new one next year.','snow|child,cloud']
  ]},

  { id:'zh-k2-hedgehog-umbrella', lang:'zh', level:'k2', title:'小刺猬的雨伞', titleEn:"Hedgehog's Umbrella",
    tag:'分享 · 天气', pages:[
    ['下雨了，小刺猬撑开一把小伞。','rain|bug,umbrella'],
    ['小兔子跑过来：“我可以躲一下吗？”','rain|rabbit,umbrella'],
    ['小老鼠也跑过来。','rain|bug,rabbit,umbrella'],
    ['伞太小了，大家都淋湿了。','rain|rabbit,bug,child'],
    ['雨停了，太阳出来了。','day|sun,rainbow'],
    ['大家一起晒太阳，真暖和。','day|sun,rabbit,bug']
  ]},

  { id:'en-p1-where-cat', lang:'en', level:'p1', title:'Where Is My Cat?', titleEn:'我的猫在哪里？',
    tag:'问句 · 方位', pages:[
    ['I cannot find my cat.','room|child'],
    ['Is she under the bed?','room|cat'],
    ['Is she in the box?','room|cat,box'],
    ['Is she behind the door?','room|cat'],
    ['I look in the garden.','garden|child,tree'],
    ['She is up in the tree!','garden|tree,cat'],
    ['“Come down, silly cat!”','garden|child,tree,cat']
  ]}
];

/* 规范化：pages 由 [text, art] 转成对象，并补上顺序号 */
const BOOKS = RAW_BOOKS.map((b,i)=>({
  ...b,
  seq:i,
  pages:b.pages.map(([t,art])=>({ t, art })),
  words:b.pages.reduce((n,p)=>n+p[0].replace(/\s+/g,' ').split(' ').length,0)
}));

/* =========================================================
   三、按周解锁
   ========================================================= */
function weekIndexOfBook(seq){ return Math.floor(seq / BOOK_RELEASE.perWeek); }

/* 从起始周一起算，过了几个周一（0 = 起始周） */
function currentBookWeek(){
  const parse = s=>{ const [y,m,d]=s.split('-').map(Number);
    return Date.UTC(y,m-1,d); };
  const start = parse(BOOK_RELEASE.start);
  const now = new Date();
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = Math.floor((today - start) / 86400000);
  return Math.max(0, Math.floor(diff / 7));
}

/* 已解锁（可阅读）的绘本；旧书永远保留 */
function availableBooks(){
  const wk = currentBookWeek();
  return BOOKS.filter(b=>weekIndexOfBook(b.seq) <= wk);
}
/* 下一批解锁的日期（下周一），返回本地日期字符串 */
function nextBookUnlockDate(){
  const wk = currentBookWeek();
  const [y,m,d] = BOOK_RELEASE.start.split('-').map(Number);
  const dt = new Date(y, m-1, d);
  dt.setDate(dt.getDate() + (wk+1)*7);
  return dt.getFullYear()+'-'+String(dt.getMonth()+1).padStart(2,'0')+'-'+String(dt.getDate()).padStart(2,'0');
}
/* 本周上新（当前周次对应的那 5 本） */
function thisWeekBooks(){
  const wk = currentBookWeek();
  return BOOKS.filter(b=>weekIndexOfBook(b.seq) === wk);
}
