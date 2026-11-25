/* v79 错题本「连续复习 + 翻页导航」回归测试
 *   node tools/mistake_review_check.js
 *
 * v76/v77 起 showFeedback 从 6 参数重构成 (good, explain)：
 *   - 不再开自动跳题定时器，答完由孩子自己用「上一题 / 下一题」翻页
 *   - gotoQuestion(delta) 统一切题；nextQuestion() 只是兼容旧调用的别名
 * 本脚本按 v79 真实实现断言：
 *   1) startPractice 把全部错题装入队列，点击那道排最前，total=队列长度
 *   2) 队列元素都带 isReview/ref，复习模式标记开启，重复题不会被塞两次
 *   3) showFeedback 两参数：对错文案 + 讲解 + 解题图 + 快照
 *   4) 翻页按钮 onclick 分别调用 gotoQuestion(-1)/(1)，末题显示 Finish、首题禁用上一题
 *   5) nextQuestion 兼容旧调用、不再有自动跳题定时器、beginSession 重置复习标记
 */
const fs = require('fs'), path = require('path'), vm = require('vm');
const R = path.resolve(__dirname, '..');
const appSrc = fs.readFileSync(path.join(R, 'js/app.js'), 'utf8');

function grab(sig) {
  const m = appSrc.match(sig);
  if (!m) { console.error('  ✗ app.js 找不到函数: ' + sig); process.exit(1); }
  return m[0];
}
const startPracticeSrc = grab(/function startPractice\(startM\)\{[\s\S]*?\n\}/);
const showFeedbackSrc  = grab(/function showFeedback\(good,explain\)\{[\s\S]*?\n\}/);
const gotoQuestionSrc  = grab(/function gotoQuestion\(delta\)\{[\s\S]*?\n\}/);

let fail = 0;
const ok = (cond, msg) => { if (cond) console.log('  ✓ ' + msg); else { fail++; console.log('  ✗ ' + msg); } };

/* ---------- 1) 用假的 Store / state / DOM 跑 startPractice ---------- */
const M = (prompt, subject, ts) => ({ q: { prompt, answer: 'x' }, subject, lessonId: 'l1', ts, userAnswer: 'y' });
const mistakes = [M('q-old', 'en', 1), M('q-mid', 'math', 2), M('q-new', 'en', 3)];
const state = {};
const calls = { shown: false, screen: '', speechCancelled: false };
const ctx = {
  console, Math, JSON, state,
  Store: { allMistakes: () => mistakes.slice() },
  POKEMON: [{ id: 'pk' }],
  cancelSpeech: () => { calls.speechCancelled = true; },
  updateCompanion: () => {},
  show: id => { calls.screen = id; },
  renderQuestion: () => { calls.shown = true; }
};
ctx.globalThis = ctx; vm.createContext(ctx);
vm.runInContext(startPracticeSrc + '\n;globalThis.startPractice=startPractice;', ctx, { filename: 'startPractice.js' });

console.log('【1】startPractice 连续复习队列');
ctx.startPractice(mistakes[0]); // 点击最旧那道（列表第一项）
ok(state.total === 3, `total=3（写死 1 的旧 bug 已修，实际 ${state.total}）`);
ok(state.questions.length === 3, `全部 3 道错题都进了队列（实际 ${state.questions.length}）`);
ok(state.questions[0].ref === mistakes[0], '点击的那道排在队列最前');
ok(state.questions[0].q.prompt === 'q-old' && state.questions[1].q.prompt === 'q-new' && state.questions[2].q.prompt === 'q-mid',
   '其余按错题本列表顺序跟上（最新在前），与界面一致');
ok(state.questions.every(x => x.isReview === true && x.ref), '队列每项都带 isReview + ref（答对能正确移除错题）');
ok(state.mistakeReviewSession === true, '复习模式标记开启');
ok(state.idx === 0 && state.correct === 0 && calls.shown && calls.screen === 'screen-lesson', '从第一题开始渲染答题页');
ok(calls.speechCancelled && state.pendingExplain === false, '切复习前掐掉残留讲解语音');
ok(state.snap && Object.keys(state.snap).length === 0, 'v76 作答快照已初始化为空');

ctx.startPractice(mistakes[1]);
ok(state.questions[0].ref === mistakes[1] && state.questions.length === 3,
   '点中间那道也打头，且不会发生重复入队');

/* ---------- 2) 用假 DOM 跑 v79 两参数 showFeedback + 翻页按钮 ---------- */
console.log('【2】showFeedback 文案 / 解题图 / 翻页按钮');
const makeEl = tag => ({
  tagName: tag, id: '', className: '', type: '', textContent: '', onclick: null,
  disabled: false, children: [],
  appendChild(c) { this.children.push(c); }
});
const fb = makeEl('div');
const qa = { innerHTML: '<p>question area</p>' };
const created = [];
const gotoCalls = [];
const ctx2 = {
  console, state, setTimeout,
  document: { createElement: tag => { const el = makeEl(tag); created.push(el); return el; } },
  $: sel => sel === '#feedback' ? fb : sel === '#questionArea' ? qa : null,
  gotoQuestion: d => { gotoCalls.push(d); }
};
ctx2.globalThis = ctx2; vm.createContext(ctx2);
vm.runInContext(showFeedbackSrc + '\n;globalThis.showFeedback=showFeedback;', ctx2, { filename: 'showFeedback.js' });
const findBtn = id => created.find(e => e.tagName === 'button' && e.id === id);

state.questions = [{ q: { prompt: 'a', answer: 'x' } }, { q: { prompt: 'b', answer: 'y' } }];
state.idx = 0; state.total = 2; state.snap = {};
state.mistakeReviewSession = true;

// 答错
created.length = 0; gotoCalls.length = 0;
ctx2.showFeedback(false, 'Try harder');
ok(fb.className === 'feedback bad', `答错反馈 bad 样式（实际 ${fb.className}）`);
ok(/💡 Try again/.test(fb.innerHTML), '答错显示 Try again');
ok(/Try harder/.test(fb.innerHTML), '讲解文字进入反馈');
const prev = findBtn('navPrev'), next = findBtn('navNext');
ok(!!prev && prev.textContent === '⬅ 上一题', `有上一题按钮（实际 ${prev && prev.textContent}）`);
ok(!!next && next.textContent === '下一题 ➡', `非末题显示下一题（实际 ${next && next.textContent}）`);
ok(prev.disabled === true, '第一题时上一题按钮禁用');
ok(next.disabled !== true, '非末题时下一题按钮可用');
ok(prev.className.indexOf('q-nav-prev') >= 0 && next.className.indexOf('q-nav-next') >= 0, '翻页按钮样式类正确');
ok(!!state.snap[0] && state.snap[0].fbClass === 'feedback bad', '答完保存了本反馈快照');
prev.onclick(); next.onclick();
ok(gotoCalls.join(',') === '-1,1', `上一题/下一题分别调用 gotoQuestion(-1)/(1)（实际 ${gotoCalls.join(',')}）`);

// 答对 + 解题图（v76/v77 新增）
state.questions[0].q.solutionHtml = '<div class="solution">8 + 7 = 15</div>';
created.length = 0;
ctx2.showFeedback(true, 'Well done');
ok(fb.className === 'feedback good', '答对反馈 good 样式');
ok(/🎉 Awesome!/.test(fb.innerHTML), '答对显示 Awesome');
ok(/class="solution"/.test(fb.innerHTML), '答对时把凑十/破十解题图拼进反馈');

// 末题 Finish
state.idx = 1; created.length = 0;
ctx2.showFeedback(false, '');
ok(findBtn('navNext').textContent === '🏁 Finish', `末题显示 Finish（实际 ${findBtn('navNext').textContent}）`);
ok(findBtn('navPrev').disabled !== true, '非首题时上一题按钮可用');

/* ---------- 3) v76+ 翻页机制 + 状态重置 ---------- */
console.log('【3】翻页机制与状态重置');
ok(/function nextQuestion\(\)\{[\s\S]*?gotoQuestion\(1\)/.test(appSrc), 'nextQuestion 兼容旧调用，统一走 gotoQuestion(1)');
ok(!/setTimeout\(nextQuestion, delay\|\|950\)/.test(appSrc), 'v76 起不再有自动跳题定时器');
ok(/state\.idx=target;/.test(gotoQuestionSrc), 'gotoQuestion 真正移动题目指针');
ok(/function bindNavButtons/.test(appSrc), '快照还原后重新绑定翻页按钮');
ok(/state\.mistakeReviewSession=false/.test(appSrc), 'beginSession 里重置复习标记，正常上课不显示特殊文案');
ok(!/state\.total=1/.test(startPracticeSrc), '源码里不再写死 total=1');

console.log(fail ? `\n✗ ${fail} 项失败` : '\n✓ 全部通过');
process.exit(fail ? 1 : 0);
