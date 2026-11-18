/* v67 错题本「连续复习 + 下一道按钮」回归测试
 *   node tools/mistake_review_check.js
 * 断言：
 *   1) startPractice 把全部错题装入队列，点击那道排最前，total=队列长度（不再是 1）
 *   2) 队列元素都带 isReview/ref，复习模式标记开启，重复题不会被塞两次
 *   3) showFeedback 在复习模式答错时按钮显示「下一道」，普通模式仍显示 Continue/Keep going
 *   4) 答对仍走自动 nextQuestion（复习模式不阻断原有自动流程）
 *   5) beginSession 里重置复习标记，避免污染正常上课
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
const showFeedbackSrc  = grab(/function showFeedback\(good,explain,autoNext,onWrong,stay,delay\)\{[\s\S]*?\n\}/);

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
// 错题本列表是最新在前（openMistakes 里 reverse 过），点最旧那道打头后，其余应是 q-new→q-mid
ok(state.questions[0].q.prompt === 'q-old' && state.questions[1].q.prompt === 'q-new' && state.questions[2].q.prompt === 'q-mid',
   '其余按错题本列表顺序跟上（最新在前），与界面一致');
ok(state.questions.every(x => x.isReview === true && x.ref), '队列每项都带 isReview + ref（答对能正确移除错题）');
ok(state.mistakeReviewSession === true, '复习模式标记开启');
ok(state.idx === 0 && state.correct === 0 && calls.shown && calls.screen === 'screen-lesson', '从第一题开始渲染答题页');
ok(calls.speechCancelled && state.pendingExplain === false, '切复习前掐掉残留讲解语音');

// 点击中间那道，验证依旧打头且不重复
ctx.startPractice(mistakes[1]);
ok(state.questions[0].ref === mistakes[1] && state.questions.length === 3,
   '点中间那道也打头，且不会发生重复入队');

/* ---------- 2) 用假 DOM 跑 showFeedback 的按钮文案 ---------- */
console.log('【2】showFeedback 按钮文案');
function makeBtn() { return { className: '', style: {}, textContent: '', onclick: null, noBtn: false }; }
let lastBtn;
const fb = { children: [], appendChild(b) { this.children.push(b); }, className: '', innerHTML: '' };
const ctx2 = {
  console, state, setTimeout,
  // 只捕获 button，忽略 showFeedback 里 appendChild 的 <br>
  document: { createElement: tag => { const b = makeBtn(); if (tag === 'button') lastBtn = b; return b; } },
  $: sel => sel === '#feedback' ? (fb.children = [], fb) : null
};
ctx2.globalThis = ctx2; vm.createContext(ctx2);
vm.runInContext(showFeedbackSrc + '\n;globalThis.showFeedback=showFeedback;', ctx2, { filename: 'showFeedback.js' });

state.mistakeReviewSession = true;
ctx2.showFeedback(false, '', false, null, false, 0);
ok(lastBtn && lastBtn.textContent === '下一道 ➡️', `复习模式答错：按钮显示「下一道」（实际 ${lastBtn && lastBtn.textContent}）`);
let advanced = false;
ctx2.nextQuestion = () => { advanced = true; };
lastBtn.onclick();
ok(advanced, '点「下一道」会调用 nextQuestion 进入下一题');

state.mistakeReviewSession = false;
ctx2.showFeedback(false, '', false, null, false, 0);
ok(lastBtn.textContent === 'Continue ➡️', '普通课程答错：按钮仍是 Continue ➡️（未被污染）');
ctx2.showFeedback(false, '', false, null, true, 0);
ok(lastBtn.textContent === 'Keep going', '普通课程 stay 场景：按钮仍是 Keep going');

/* ---------- 3) 答对自动进下一题 + beginSession 重置 ---------- */
console.log('【3】答对流程与状态重置');
ok(/setTimeout\(nextQuestion, delay\|\|950\)/.test(showFeedbackSrc), '答对仍走自动 nextQuestion（复习模式不打断）');
ok(/state\.mistakeReviewSession=false/.test(appSrc), 'beginSession 里重置复习标记，正常上课不显示「下一道」');
ok(!/state\.total=1/.test(startPracticeSrc), '源码里不再写死 total=1');

console.log(fail ? `\n✗ ${fail} 项失败` : '\n✓ 全部通过');
process.exit(fail ? 1 : 0);
