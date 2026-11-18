/* v69 英文造句（Writing / Sentence Building）语料回归测试
 *   node tools/writing_check.js
 *
 * 背景（为什么必须有这个测试）：
 *   v68 及以前，question-bank.js 的造句生成器把 268 个词「整池」当宾语，
 *   再随机配 like/see/read，于是造出 "I read a hat." "I read a red." 这类
 *   语义不通的病句（red / hot / run 是形容词、动词，根本不是能"读"的东西）。
 *
 * 校验方式：按 qid 里的句型编号「逐句型精确解析」，而不是笼统地看句子像不像：
 *   1) 宾语必须是该动词白名单里的名词（形容词/动词绝不许当宾语）
 *   2) 冠词与紧随其后的词首音必须匹配（a/an），形容词插进来后也要重算
 *   3) 主谓一致：三单主语 → -s/-es 或 has；其他人称 → 原形
 *   4) 句中主语必须小写（专有名词除外），过去式句尾必须是时间状语
 * 另外校验 data.js 手写 BUILD 题库（tiles/answer 一致性、长度、悬空形容词）。
 */
const fs = require('fs'), path = require('path'), vm = require('vm');
const R = path.resolve(__dirname, '..');

const stub = 'function ri(){return 0} function pick(a){return a[0]} function shuffle(a){return a.slice()}\n';
const ctx = { console, Math, JSON, Date, setTimeout, clearTimeout,
  localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {}, clear: () => {} } };
ctx.globalThis = ctx; vm.createContext(ctx);
const FILES = ['js/pokemon.js', 'js/zh-phonics.js', 'js/ref-pages.js', 'js/data.js', 'js/audio-map.js', 'js/question-bank.js'];
vm.runInContext(
  stub + FILES.map(f => fs.readFileSync(path.join(R, f), 'utf8')).join('\n;\n') + '\n;\n' +
  'globalThis.__X={Bank,BUILD,BO:Bank._internal};', ctx, { filename: 'writing-bundle.js' });

const { Bank, BUILD } = ctx.__X;
const { BO_OBJ, BO_VERB, BO_SUBJ, BO_PLACE, BO_TIME, BO_ADJ } = ctx.__X.BO;

let fail = 0;
const ok = (cond, msg) => { if (cond) console.log('  ✓ ' + msg); else { fail++; console.log('  ✗ ' + msg); } };

/* ---------- 白名单 ---------- */
const OBJ_OK = new Set();                          // 合法 "det noun"
Object.keys(BO_OBJ).forEach(v => BO_OBJ[v].forEach(([d, n]) => OBJ_OK.add(d + ' ' + n)));
const NOUN_OK = new Set();                         // 合法名词本身
Object.keys(BO_OBJ).forEach(v => BO_OBJ[v].forEach(([d, n]) => NOUN_OK.add(n)));
const VERB_OWNER = {};                             // 各种动词形态 → {base, kind}
Object.keys(BO_VERB).forEach(b => {
  const set = (form, kind) => { if (!VERB_OWNER[form] || VERB_OWNER[form].kind !== 'base') VERB_OWNER[form] = { base: b, kind }; };
  set(b, 'base');                                  // read 的原形与过去式同形 → 先占住 base
  set(BO_VERB[b].s, 'third');
  set(BO_VERB[b].p, 'past');
});
const SUBJ_MAP = {};
BO_SUBJ.forEach(s => { SUBJ_MAP[s.t] = s; SUBJ_MAP[s.lc] = s; });
const SUBJ_TOKENS = Object.keys(SUBJ_MAP).sort((a, b) => b.length - a.length);
const PLACE = new Set(BO_PLACE), TIME = new Set(BO_TIME), ADJ = new Set(BO_ADJ);
const isVowel = w => /^[aeiou]/i.test(w);
const artOk = (det, word) => det === 'a' ? !isVowel(word) : det === 'an' ? isVowel(word) : det === 'the';

/* 从 tile 序列里认出主语（可能是 1 个或 2 个 token） */
function readSubj(t, at) {
  for (const key of SUBJ_TOKENS) {
    const kt = key.split(' ');
    if (kt.every((x, i) => t[at + i] === x)) return { s: SUBJ_MAP[key], len: kt.length };
  }
  return null;
}
/* 动词形态与主语是否匹配 */
const PAST_FORMS = new Set(Object.keys(BO_VERB).map(b => BO_VERB[b].p));
function verbOk(verb, subj, tense) {
  const info = VERB_OWNER[verb];
  if (!info) return `未知动词 ${verb}`;
  if (tense === 'past') return PAST_FORMS.has(verb) ? null : `${verb} 不是过去式`;
  /* read 的原形与过去式同形：现在时句型里它就是原形，不用报错 */
  if (info.kind === 'past' && !(verb in BO_VERB)) return `${verb} 是过去式，不该出现在现在时句型`;
  const want = subj.p3 ? 'third' : 'base';
  const actual = info.kind;
  if (actual === want) return null;
  if (actual === 'past' && verb in BO_VERB) return null;      // read：原形同形
  return `${subj.t} + ${verb}（需要 ${want}）主谓不一致`;
}

/* 按句型精确校验一句（tiles 含句号） */
function checkFamily(fam, t) {
  const words = t.slice(0, -1);                     // 去掉句号
  if (t[t.length - 1] !== '.') return '句尾缺句号';
  const err = [];

  if (fam === 5) {
    if (words[0] !== 'Every' || words[1] !== 'day') return '句型 5 必须以 "Every day" 开头';
    const r = readSubj(words, 2);
    if (!r) return '句型 5 找不到主语';
    const lower = r.s.lc, shown = words.slice(2, 2 + r.len).join(' ');
    if (shown !== lower) err.push(`句中主语大小写不对: "${shown}"（应为 "${lower}"）`);
    const tail = words.slice(2 + r.len);
    return finish(err, tail, r.s, 5);
  }

  const r = readSubj(words, 0);
  if (!r) return '句首找不到主语';
  const tail = words.slice(r.len);
  if (fam === 6) {                                  // 主语 + V + N and V2 + N2
    const andAt = tail.indexOf('and');
    if (andAt < 0) return '句型 6 缺 and';
    const left = tail.slice(0, andAt), right = tail.slice(andAt + 1);
    err.push(...checkVON(left, r.s));
    err.push(...checkVON(right, r.s, true));
    const v2 = right[0];
    if (v2 === 'have' || v2 === 'has' || v2 === 'want' || v2 === 'wants') err.push(`并列句第二动词不该是 ${v2}`);
    return err.length ? err.join('；') : null;
  }
  if (fam === 4) {                                  // 主语 + 过去式 + N + 时间状语
    const time = [];
    let body = tail.slice();
    // 时间状语最长 2 词
    for (const n of [2, 1]) {
      const cand = body.slice(body.length - n).join(' ');
      if (TIME.has(cand)) { time.push(cand); body = body.slice(0, body.length - n); break; }
    }
    if (!time.length) err.push('过去式句型缺时间状语');
    err.push(...checkVON(body, r.s, false, 'past'));
    return err.filter(Boolean).join('；') || null;
  }
  return finish(err, tail, r.s, fam);
}
/* 句型 1/2/3/5 的动词短语 + 可选地点 */
function finish(err, tail, subj, fam) {
  const place = [];
  let body = tail.slice();
  for (const n of [3, 2]) {                         // "in the park" 三词
    const cand = body.slice(body.length - n).join(' ');
    if (PLACE.has(cand)) { place.push(cand); body = body.slice(0, body.length - n); break; }
  }
  err.push(...checkVON(body, subj, false, 'present', fam === 3));
  return err.filter(Boolean).join('；') || null;
}
/* 动词 + 冠词 + [形容词] + 名词
   allowAdj=true 仅用于句型 3（a + 形容词 + 名词 是它的正常结构） */
function checkVON(part, subj, isSecond, tense, allowAdj) {
  const err = [];
  if (part.length < 3) { err.push(`动词短语过短: ${part.join(' ')}`); return err; }
  const verb = part[0];
  const ve = verbOk(verb, subj, tense || 'present');
  if (ve) err.push(ve);
  const det = part[1];
  let i = 2, adj = null;
  if (ADJ.has(part[i])) { adj = part[i]; i++; }
  const noun = part[i];
  if (!noun) err.push('缺名词');
  else {
    // 白名单按原始冠词登记；句型 3 会把 a/an 按形容词重算，所以这里按名词本身比对
    const inList = OBJ_OK.has(det + ' ' + noun) || OBJ_OK.has('a ' + noun) ||
                   OBJ_OK.has('an ' + noun) || OBJ_OK.has('the ' + noun);
    if (!inList) err.push(`宾语不在白名单: ${det} ${noun}`);
    if (adj && !allowAdj) err.push(`句型不该插入形容词 "a ${adj} ${noun}"`);
    if (adj && !artOk(det, adj)) err.push(`形容词冠词错误: ${det} ${adj}`);
    if (!adj && (det === 'a' || det === 'an') && !artOk(det, noun)) err.push(`冠词与名词首音不符: ${det} ${noun}`);
  }
  if (part.length > i + 1) err.push(`多余的词: ${part.slice(i + 1).join(' ')}`);
  return err;
}

/* ---------- 1. 题库造句：按句型逐句校验 ---------- */
console.log('【1】Sentence Building 题库逐句校验（搭配 / 冠词 / 主谓一致 / 句型）');
const bank = Bank.build('e-build', 3, 0);
ok(bank.length >= 900, `题库规模 ${bank.length} 句（≥900）`);
ok(new Set(bank.map(q => q.qid)).size === bank.length, `qid 无重复（${bank.length}）`);

const bad = [];
bank.forEach(q => {
  const fam = Number(String(q.qid).split('_')[0].replace('w', ''));
  const t = q.answer.trim().split(/\s+/);
  const err = checkFamily(fam, t);
  if (err) bad.push({ fam, err, s: q.answer });
});
ok(bad.length === 0, `全部 ${bank.length} 句通过校验（失败 ${bad.length}）`);
bad.slice(0, 15).forEach(b => console.log(`      ✗ 句型${b.fam} ${b.err} → "${b.s}"`));

/* ---------- 2. 病句黑名单 ---------- */
console.log('【2】v68 病句不再出现（"I read a hat." / "I read a red." 一类）');
const allText = bank.map(q => q.answer).join(' | ');
const hanging = [];
const adjAlt = Array.from(ADJ).join('|');
bank.forEach(q => {
  // 冠词 + 形容词 + 句号 = 悬空形容词（"I read a red ."）
  if (new RegExp(`\\b(?:a|an)\\s+(?:${adjAlt})\\s+\\.`).test(q.answer)) hanging.push(q.answer);
});
ok(hanging.length === 0, `没有「a/an + 形容词 + 句号」的悬空宾语（${hanging.length}）`);
if (hanging.length) console.log('      例：' + hanging.slice(0, 8).join(' / '));

const adjAsNoun = [];
bank.forEach(q => {
  const m = q.answer.match(/\b(?:a|an)\s+([a-z]+)/g) || [];
  m.forEach(seg => {
    const w = seg.split(/\s+/)[1];
    // 冠词后的第一个词若是形容词，则必须再跟名词；否则就是拿形容词当名词用
    if (ADJ.has(w) && !new RegExp(`\\b${seg}\\s+[a-z]+`).test(q.answer)) adjAsNoun.push(q.answer);
  });
});
ok(adjAsNoun.length === 0, `没有拿形容词当名词用（${adjAsNoun.length}）`);
['I read a hat', 'I read a red', 'I see a hot', 'We read a run'].forEach(s => {
  const hit = new RegExp(`\\b${s}\\b(?!\\s+[a-z])`, 'i').test(allText);
  ok(!hit, `不含已知病句 "${s}"`);
});
/* 形容词/动词不允许出现在名词位 */
const notNoun = [];
bank.forEach(q => {
  const t = q.answer.trim().split(/\s+/).slice(0, -1);
  const fam = Number(String(q.qid).split('_')[0].replace('w', ''));
  const rest = fam === 5 ? t.slice(2) : t;
  const r = fam === 5 ? readSubj(t, 2) : readSubj(t, 0);
  if (!r) return;
  const body = rest.slice(r.len);
  const noun = body[body.length - 1];
  const isPlaceTail = PLACE.has(body.slice(-3).join(' ')) || PLACE.has(body.slice(-2).join(' ')) ||
                      TIME.has(body.slice(-2).join(' ')) || TIME.has(body.slice(-1).join(' '));
  const cand = isPlaceTail ? null : noun;
  if (cand && !NOUN_OK.has(cand) && !ADJ.has(cand)) notNoun.push(q.answer);
});
ok(notNoun.length === 0, `名词位都是真实名词（异常 ${notNoun.length}）`);

/* ---------- 3. 句型多样性 / 难度分层 ---------- */
console.log('【3】句型多样性与难度分层');
const famCount = {};
bank.forEach(q => { const f = String(q.qid).split('_')[0]; famCount[f] = (famCount[f] || 0) + 1; });
[1, 2, 3, 4, 5, 6].forEach(f => ok((famCount['w' + f] || 0) > 40, `句型 ${f} 有 ${famCount['w' + f] || 0} 句`));
const tiers = [1, 2, 3, 4, 5].map(t => bank.filter(q => q.tier === t).length);
ok(tiers.every(n => n > 60), `五个难度档都有充足题量：${tiers.join(' / ')}`);
ok(bank.filter(q => q.tier >= 4).length >= 200, `G3-4 以上难度（tier 4-5）${bank.filter(q => q.tier >= 4).length} 句`);

/* ---------- 4. 确定性 / 扩容 ---------- */
console.log('【4】确定性（同参数同题）与扩容');
const again = Bank.build('e-build', 3, 0);
ok(again.length === bank.length && again.every((q, i) => q.qid === bank[i].qid), '同一参数生成完全一致的题库');
ok(Bank.build('e-build', 3, 2).length >= bank.length, 'spread=2 时题量不减少（可继续扩容）');

/* ---------- 5. data.js 手写 BUILD ---------- */
console.log('【5】data.js 手写 BUILD 题库（含新增 G3-4 句型）');
ok(BUILD.length >= 18, `手写句 ${BUILD.length} 条（≥18）`);
const bBad = [];
const COPULA = /\b(?:is|are|am|was|were|look|looks|feel|feels|seem|seems)\b/;
BUILD.forEach((b, i) => {
  const ans = String(b.a || '');
  if (ans !== b.tiles.join(' ')) bBad.push(`#${i} a ≠ tiles.join(' ')`);
  if (b.tiles[b.tiles.length - 1] !== '.') bBad.push(`#${i} 缺句号 tile`);
  if (b.tiles.length > 11) bBad.push(`#${i} tile 过多 ${b.tiles.length}`);
  // 悬空形容词："a red ." 这类
  if (new RegExp(`\\b(?:a|an)\\s+(?:${Array.from(ADJ).join('|')})\\s*\\.`).test(ans)) {
    bBad.push(`#${i} 悬空宾语 → ${ans}`);
  }
  // 句末裸形容词只允许出现在 be 动词表语里（The cat is red.）
  const body = b.tiles.slice(0, -1);
  const last = body[body.length - 1];
  if (ADJ.has(last) && !COPULA.test(ans)) bBad.push(`#${i} 句末是裸形容词 "${last}" → ${ans}`);
});
ok(bBad.length === 0, `手写句全部合法（问题 ${bBad.length}）`);
bBad.slice(0, 10).forEach(x => console.log('      ✗ ' + x));

/* ---------- 6. 语法题库：冠词 / 主谓一致 / 宾格 / 答案在选项里 ---------- */
console.log('【6】Grammar 题库语言质量（冠词、主谓一致、宾格代词、选项完整性）');
const gram = Bank.build('e-grammar', 3, 0);
ok(gram.length >= 800, `语法题库 ${gram.length} 道（≥800）`);
ok(gram.filter(q => q.tier >= 4).length >= 150, `tier 4-5（G3-4 语法点）${gram.filter(q => q.tier >= 4).length} 道`);

const PLURAL_SUBJ_G = ['We', 'They', 'You', 'The girls', 'Ben and Tom', 'Tom and Ben', 'The children'];
const gErr = [];
gram.forEach(q => {
  const plain = String(q.sub).replace(/<[^>]+>/g, '');
  const filled = plain.replace(/___/g, q.answer);
  // 选项必须含正确答案，且不重复
  if (!q.options || !q.options.includes(q.answer)) gErr.push(`答案不在选项里: ${filled} → ${q.answer}`);
  if (q.options && new Set(q.options).size !== q.options.length) gErr.push(`选项重复: ${filled}`);
  // 冠词与首音
  const arts = filled.match(/\b(a|an)\s+([A-Za-z]+)/g) || [];
  arts.forEach(x => {
    const [, det, w] = x.match(/\b(a|an)\s+([A-Za-z]+)/);
    const vowel = /^[aeiou]/i.test(w);
    if (det === 'a' && vowel) gErr.push(`冠词错: "${x}" → ${filled}`);
    if (det === 'an' && !vowel) gErr.push(`冠词错: "${x}" → ${filled}`);
  });
  // 主谓一致（只看句首主语 + 紧随的动词）
  for (const s of PLURAL_SUBJ_G.concat(['He', 'She', 'It', 'Tom', 'My teacher', 'The cat', 'My dad']).sort((a, b) => b.length - a.length)) {
    if (filled.startsWith(s + ' ')) {
      const rest = filled.slice(s.length + 1);
      const plural = PLURAL_SUBJ_G.includes(s);
      const m = rest.match(/^(\w+)\s/);
      if (m) {
        const v = m[1];
        if (plural && ['has', 'is', 'goes', 'does', 'was'].includes(v)) gErr.push(`复数主语用了三单动词: ${filled}`);
        if (!plural && ['have', 'are', 'go', 'were'].includes(v)) gErr.push(`三单主语用了复数动词: ${filled}`);
      }
      break;
    }
  }
  // 宾格代词
  if (/\b(?:to|with|for|near)\s+(?:She|He|I|They|We)\b/.test(filled)) gErr.push(`介词后用主格代词: ${filled}`);
  // 复数是 -es 规则
  if (/\b(?:two|three)\s+\w+(?:sh|ch|x|ss)s\b/.test(filled)) gErr.push(`复数拼写错误: ${filled}`);
});
ok(gErr.length === 0, `语法题语言质量全部通过（问题 ${gErr.length}）`);
gErr.slice(0, 12).forEach(x => console.log('      ✗ ' + x));

console.log(fail ? `\n✗ ${fail} 项失败` : '\n✅ 造句语料全部通过');
process.exit(fail ? 1 : 0);
