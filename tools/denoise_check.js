/* 降噪算法单测（Node，纯算法，不依赖浏览器） */
const { AudioDenoise } = require('../js/audio-denoise.js');
const A = AudioDenoise;
let pass = 0, fail = 0;
const ok = (name, cond, extra) => { if (cond) { pass++; console.log('  PASS', name); } else { fail++; console.log('  FAIL', name, extra || ''); } };

const SR = 16000, N = SR * 2; // 2秒

// 构造：0-0.5s 纯噪声（当作静音底噪），0.5-2s 语音段(220Hz+440Hz谐波)叠噪声 + 60Hz嗡嗡
function rms(a, s, e) { let x = 0; for (let i = s; i < e; i++) x += a[i] * a[i]; return Math.sqrt(x / (e - s)); }
let seed = 12345;
const rand = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff * 2 - 1; };
const clean = new Float32Array(N);
const noisy = new Float32Array(N);
for (let i = 0; i < N; i++) {
  const t = i / SR;
  const voice = t > 0.5 ? (0.5 * Math.sin(2 * Math.PI * 220 * t) + 0.25 * Math.sin(2 * Math.PI * 440 * t)) : 0;
  clean[i] = voice;
  const noise = 0.08 * rand() + 0.05 * Math.sin(2 * Math.PI * 60 * t); // 白噪 + 工频嗡嗡
  noisy[i] = Math.max(-1, Math.min(1, voice + noise));
}

// FFT 正确性：正弦 -> 频谱峰值在对应 bin
{
  const nre = new Float64Array(64), nim = new Float64Array(64);
  for (let i = 0; i < 64; i++) nre[i] = Math.sin(2 * Math.PI * 8 * i / 64);
  A._fft(nre, nim, false);
  let maxK = 0, maxV = -1;
  for (let k = 0; k < 32; k++) { const m = Math.hypot(nre[k], nim[k]); if (m > maxV) { maxV = m; maxK = k; } }
  ok('FFT 峰值定位正确 (bin8)', maxK === 8, 'got bin ' + maxK);
}

for (const level of ['gentle', 'normal', 'strong']) {
  const out = A._denoisePCM(noisy, SR, A.LEVELS[level]);
  ok(level + ': 输出长度不变', out.length === N);
  let nan = false; for (let i = 0; i < out.length; i++) if (!isFinite(out[i])) { nan = true; break; }
  ok(level + ': 无 NaN/Inf', !nan);
  const inNoise = rms(noisy, 0, SR * 0.45);
  const outNoise = rms(out, 0, SR * 0.45);
  ok(level + ': 静音段底噪下降', outNoise < inNoise * 0.7, `in=${inNoise.toFixed(3)} out=${outNoise.toFixed(3)}`);
  const inVoice = rms(noisy, SR * 0.7, SR * 1.9);
  const outVoice = rms(out, SR * 0.7, SR * 1.9);
  ok(level + ': 语音段保留', outVoice > rms(clean, SR * 0.7, SR * 1.9) * 0.35, `outVoice=${outVoice.toFixed(3)}`);
  // 无直流漂移/爆音：相邻样本跳变不应过大
  let maxJump = 0; for (let i = 1; i < out.length; i++) { const d = Math.abs(out[i] - out[i - 1]); if (d > maxJump) maxJump = d; }
  ok(level + ': 无爆音跳变', maxJump < 0.6, 'maxJump=' + maxJump.toFixed(3));
}

// WAV 编码头正确
{
  const wav = A._encodeWav(new Float32Array(100), SR);
  ok('WAV 编码返回 Blob', wav && wav.type === 'audio/wav' && wav.size === 44 + 200, 'size=' + (wav && wav.size));
}

console.log(`\n${pass} pass / ${fail} fail`);
process.exit(fail ? 1 : 0);
