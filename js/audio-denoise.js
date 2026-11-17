/* =========================================================
   AudioDenoise — 浏览器本地录音降噪（无后端、无外部依赖）
   ---------------------------------------------------------
   家长录完一段「四步连读」后，点保存时在本机对录音做降噪：
     1. 单声道化
     2. 分帧 FFT → 谱减法去稳态底噪（空调/风扇/电流嗡嗡）
     3. 带通（80Hz–7.5kHz）去低频隆隆 + 高频嘶声
     4. 频域增益时间平滑，避免音乐噪声/断音
     5. overlap-add 重建 → 峰值归一 → 首尾淡入淡出
     6. 编码 WAV blob 返回（各族浏览器可decode/播放）

   设计红线（吸取历史教训）：
     · 只做谱减，不做波形重复/循环 → 杜绝蜂鸣/电流声
     · 保守参数 + beta 软地板 → 不把语音削出断音
     · 任何异常都抛出，由调用方降级用原始录音

   对外接口：const AudioDenoise
     denoise(blob, level) -> Promise<Blob>   level: gentle|normal|strong
     LEVELS               各档参数（测试页可调）
   ========================================================= */
const AudioDenoise = (() => {
  const LEVELS = {
    gentle: { alpha: 1.0, beta: 0.20, smooth: 0.45, lowHz: 70,  highHz: 8500 },
    normal: { alpha: 1.6, beta: 0.12, smooth: 0.55, lowHz: 85,  highHz: 7500 },
    strong: { alpha: 2.3, beta: 0.06, smooth: 0.62, lowHz: 100, highHz: 6500 }
  };

  // 迭代版 radix-2 Cooley-Tukey FFT，in-place
  function fft(re, im, inverse) {
    const n = re.length;
    for (let i = 1, j = 0; i < n; i++) {
      let bit = n >> 1;
      for (; j & bit; bit >>= 1) j ^= bit;
      j ^= bit;
      if (i < j) {
        let t = re[i]; re[i] = re[j]; re[j] = t;
        t = im[i]; im[i] = im[j]; im[j] = t;
      }
    }
    for (let len = 2; len <= n; len <<= 1) {
      const ang = 2 * Math.PI / len * (inverse ? 1 : -1);
      const wr = Math.cos(ang), wi = Math.sin(ang);
      for (let i = 0; i < n; i += len) {
        let ur = 1, ui = 0;
        const half = len >> 1;
        for (let k = 0; k < half; k++) {
          const a = i + k, b = a + half;
          const vr = re[b] * ur - im[b] * ui;
          const vi = re[b] * ui + im[b] * ur;
          re[b] = re[a] - vr; im[b] = im[a] - vi;
          re[a] += vr;        im[a] += vi;
          const nur = ur * wr - ui * wi;
          ui = ur * wi + ui * wr;
          ur = nur;
        }
      }
    }
    if (inverse) {
      for (let i = 0; i < n; i++) { re[i] /= n; im[i] /= n; }
    }
  }

  function downmixMono(audioBuf) {
    const ch = audioBuf.numberOfChannels, len = audioBuf.length;
    const out = new Float32Array(len);
    if (ch === 1) { out.set(audioBuf.getChannelData(0)); return out; }
    for (let c = 0; c < ch; c++) {
      const d = audioBuf.getChannelData(c);
      for (let i = 0; i < len; i++) out[i] += d[i] / ch;
    }
    return out;
  }

  // 核心：对单声道 PCM 做谱减降噪，返回 Float32Array
  function denoisePCM(pcm, sr, P) {
    const N = 1024, HOP = 256, HALF = N >> 1;
    if (pcm.length < N * 2) return pcm; // 太短，不处理

    const frames = Math.floor((pcm.length - N) / HOP) + 1;
    const win = new Float64Array(N);
    for (let i = 0; i < N; i++) win[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (N - 1)); // Hann

    // 分析：存每帧复数谱(re/im) + 幅度谱 + 能量
    const reAll = new Float32Array(frames * N);
    const imAll = new Float32Array(frames * N);
    const magAll = new Float32Array(frames * (HALF + 1));
    const energy = new Float64Array(frames);

    for (let f = 0; f < frames; f++) {
      const off = f * HOP;
      const re = new Float64Array(N), im = new Float64Array(N);
      for (let i = 0; i < N; i++) re[i] = pcm[off + i] * win[i];
      fft(re, im, false);
      const rb = f * N, mb = f * (HALF + 1);
      let e = 0;
      for (let k = 0; k <= HALF; k++) {
        const r = re[k], m = im[k];
        const mag = Math.sqrt(r * r + m * m);
        reAll[rb + k] = r; imAll[rb + k] = m; magAll[mb + k] = mag;
        e += mag * mag;
      }
      energy[f] = e;
    }

    // 噪声谱 = 能量最低 25% 帧的平均幅度谱
    const order = Array.from({ length: frames }, (_, i) => i).sort((a, b) => energy[a] - energy[b]);
    const qn = Math.max(1, Math.floor(frames * 0.25));
    const noise = new Float64Array(HALF + 1);
    for (let q = 0; q < qn; q++) {
      const mb = order[q] * (HALF + 1);
      for (let k = 0; k <= HALF; k++) noise[k] += magAll[mb + k] / qn;
    }

    // 带通 bin 范围
    const binHz = sr / N;
    const lowBin = Math.max(1, Math.floor(P.lowHz / binHz));
    const highBin = Math.min(HALF, Math.ceil(P.highHz / binHz));

    // 谱减 + 平滑 + IFFT + overlap-add
    const out = new Float64Array(pcm.length + N + HOP);
    const norm = new Float64Array(HALF + 1).fill(1); // 上一帧增益
    for (let f = 0; f < frames; f++) {
      const mb = f * (HALF + 1), rb = f * N;
      for (let k = 0; k <= HALF; k++) {
        const mag = magAll[mb + k];
        let g;
        if (k < lowBin || k > highBin) {
          g = 0; // 带外直接切掉
        } else {
          const sub = mag - P.alpha * noise[k];
          const target = Math.max(sub, P.beta * mag) / (mag + 1e-9); // 谱减 + beta 软地板
          g = norm[k] * (1 - P.smooth) + target * P.smooth;           // 时间平滑
          if (g > 1) g = 1;
          if (g < 0) g = 0;
          norm[k] = g;
        }
        reAll[rb + k] *= g;
        imAll[rb + k] *= g;
        if (k > 0 && k < HALF) { // 镜像 bin（共轭对称）
          const mk = N - k;
          reAll[rb + mk] *= g;
          imAll[rb + mk] *= g;
        }
      }
      const ire = new Float64Array(N), iim = new Float64Array(N);
      for (let k = 0; k < N; k++) { ire[k] = reAll[rb + k]; iim[k] = imAll[rb + k]; }
      fft(ire, iim, true);
      const off = f * HOP;
      for (let i = 0; i < N; i++) out[off + i] += ire[i] * win[i];
    }

    // 峰值归一 + 首尾淡入淡出（防爆音）
    let peak = 0;
    for (let i = 0; i < pcm.length; i++) { const a = Math.abs(out[i]); if (a > peak) peak = a; }
    const scale = peak > 1e-6 ? 0.92 / peak : 1;
    const res = new Float32Array(pcm.length);
    const fade = Math.min(240, Math.floor(sr * 0.008));
    for (let i = 0; i < pcm.length; i++) {
      let v = out[i] * scale;
      if (i < fade) v *= i / fade;
      const tail = pcm.length - 1 - i;
      if (tail < fade) v *= tail / fade;
      res[i] = Math.max(-1, Math.min(1, v));
    }
    return res;
  }

  function encodeWav(samples, sr) {
    const buf = new ArrayBuffer(44 + samples.length * 2);
    const dv = new DataView(buf);
    const put = (o, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
    put(0, 'RIFF'); dv.setUint32(4, 36 + samples.length * 2, true);
    put(8, 'WAVE'); put(12, 'fmt '); dv.setUint32(16, 16, true);
    dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
    dv.setUint32(24, sr, true); dv.setUint32(28, sr * 2, true);
    dv.setUint16(32, 2, true); dv.setUint16(34, 16, true);
    put(36, 'data'); dv.setUint32(40, samples.length * 2, true);
    let o = 44;
    for (let i = 0; i < samples.length; i++, o += 2) {
      const s = Math.max(-1, Math.min(1, samples[i]));
      dv.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }
    return new Blob([buf], { type: 'audio/wav' });
  }

  function decode(audioCtx, arrayBuffer) {
    return new Promise((resolve, reject) => {
      let p;
      try { p = audioCtx.decodeAudioData(arrayBuffer, resolve, reject); }
      catch (e) { reject(e); return; }
      if (p && typeof p.then === 'function') p.then(resolve, reject);
    });
  }

  async function denoise(blob, level) {
    const P = LEVELS[level] || LEVELS.normal;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) throw new Error('no AudioContext');
    const ctx = new AC();
    try {
      const ab = await blob.arrayBuffer();
      const audioBuf = await decode(ctx, ab);
      const pcm = downmixMono(audioBuf);
      const out = denoisePCM(pcm, audioBuf.sampleRate, P);
      return encodeWav(out, audioBuf.sampleRate);
    } finally {
      try { ctx.close(); } catch (e) {}
    }
  }

  return { denoise, LEVELS, _fft: fft, _denoisePCM: denoisePCM, _encodeWav: encodeWav };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { AudioDenoise };
}
