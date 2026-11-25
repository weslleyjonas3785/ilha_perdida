// Áudio procedural (Web Audio): ambiente, passos por superfície, coleta, combate, clima e música.
// Todos os sons são sintetizados em tempo real — não há arquivos de áudio externos.
export class GameAudio {
  constructor() { this.ctx = null; this.vol = { master: 0.8, sfx: 0.9, music: 0.35, ambient: 0.7 }; this.musicOn = true; this.lastPlay = {}; this.amb = {}; this.nextBird = 0; this.nextCricket = 0; this.nextMusic = 6; this.nextDrip = 0; }
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {}); return; }
    try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { this.ctx = null; return; }
    const c = this.ctx;
    this.master = c.createGain(); this.master.connect(c.destination);
    this.sfx = c.createGain(); this.sfx.connect(this.master); this.music = c.createGain(); this.music.connect(this.master); this.ambG = c.createGain(); this.ambG.connect(this.master);
    const len = c.sampleRate * 2; this.noise = c.createBuffer(1, len, c.sampleRate); const d = this.noise.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    // brown noise para vento
    this.brown = c.createBuffer(1, len, c.sampleRate); const b = this.brown.getChannelData(0); let last = 0; for (let i = 0; i < len; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; b[i] = last * 3.5; }
    this.amb.wind = this._loop(this.brown, 'lowpass', 500); this.amb.rain = this._loop(this.noise, 'highpass', 900); this.amb.fire = this._loop(this.noise, 'bandpass', 600);
    this.amb.water = this._loop(this.noise, 'bandpass', 350);
    this.applyVolumes();
    // sons de tiro gravados (arquivos): pistola, fuzil de assalto, escopeta e fuzil de precisão
    this.samples = {}; this.sampleGain = { pistol: 1.5, rifle: 1.0, shotgun: 0.95, sniper: 1.0, tinnitus: 0.7, smokegren: 1.0 };
    for (const k of ['pistol', 'rifle', 'shotgun', 'sniper', 'skill', 'mechastep', 'spindown', 'tinnitus', 'smokegren']) fetch(`assets/audio/${k}.mp3`).then((r) => r.arrayBuffer()).then((b) => c.decodeAudioData(b)).then((buf) => { this.samples[k] = buf; }).catch(() => {});
  }
  _sample(name, o) { const c = this.ctx, buf = this.samples && this.samples[name]; if (!buf) return false; const s = c.createBufferSource(); s.buffer = buf; s.playbackRate.value = (o.rate || 1) * (0.97 + Math.random() * 0.06);
    const g = c.createGain(); g.gain.value = (o.vol ?? 1) * (this.sampleGain[name] || 1); s.connect(g); g.connect(this.sfx); s.start(); return true; }
  // contador Geiger real (arquivo de áudio) em laço, volume e ritmo conforme a exposição (0 = desligado)
  setGeiger(level) {
    if (!this.ctx || this.ctx.state !== 'running') return; const c = this.ctx;
    if (!this._gBuf && !this._gLoading) { this._gLoading = true; fetch('assets/audio/geiger.mp3').then((r) => r.arrayBuffer()).then((b) => c.decodeAudioData(b)).then((buf) => { this._gBuf = buf; }).catch(() => { this._gFail = true; }); }
    if (level > 0.01 && this._gBuf && !this._gSrc) { const s = c.createBufferSource(); s.buffer = this._gBuf; s.loop = true; const g = c.createGain(); g.gain.value = 0; s.connect(g); g.connect(this.sfx); s.start(0, Math.random() * 8); this._gSrc = s; this._gGain = g; }
    if (this._gSrc) { const t = c.currentTime; this._gGain.gain.setTargetAtTime(Math.min(1, level) * 0.9, t, 0.25); this._gSrc.playbackRate.setTargetAtTime(0.85 + Math.min(1, level) * 0.45, t, 0.4);
      if (level <= 0.01) { this._gOffT = this._gOffT || t; if (t - this._gOffT > 1.5) { try { this._gSrc.stop(); } catch (e) {} this._gSrc = null; this._gOffT = 0; } } else this._gOffT = 0; }
    else if (level > 0.01 && this._gFail && Math.random() < 0.15) this.play('geiger', { n: 2 + Math.floor(level * 5) });
  }
  applyVolumes() { if (!this.ctx) return; this.master.gain.value = this.vol.master; this.sfx.gain.value = this.vol.sfx; this.music.gain.value = this.musicOn ? this.vol.music : 0; this.ambG.gain.value = this.vol.ambient; }
  _loop(buf, type, freq) { const c = this.ctx; const s = c.createBufferSource(); s.buffer = buf; s.loop = true; const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; const g = c.createGain(); g.gain.value = 0; s.connect(f); f.connect(g); g.connect(this.ambG); s.start(); return { s, f, g }; }
  _env(g, t, a, peak, dec) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec); }
  // motor do veículo em laço: dente-de-serra grave + harmônico + ronco filtrado; rotação pela velocidade
  engineStart() { const c = this.ctx; if (!c || this._eng) return; const o1 = c.createOscillator(), o2 = c.createOscillator(), lp = c.createBiquadFilter(), g = c.createGain(); o1.type = 'sawtooth'; o2.type = 'square'; lp.type = 'lowpass'; lp.frequency.value = 420; lp.Q.value = 2;
    g.gain.value = 0; o1.connect(lp); o2.connect(lp); lp.connect(g); g.connect(this.sfx); o1.frequency.value = 42; o2.frequency.value = 21; o1.start(); o2.start(); g.gain.linearRampToValueAtTime(0.07, c.currentTime + 0.6); this._eng = { o1, o2, lp, g }; }
  engineSet(rpm, load) { const e = this._eng; if (!e) return; const t = this.ctx.currentTime, f = 40 + rpm * 120 + load * 8; e.o1.frequency.setTargetAtTime(f, t, 0.12); e.o2.frequency.setTargetAtTime(f * 0.5, t, 0.12); e.lp.frequency.setTargetAtTime(380 + rpm * 900 + load * 300, t, 0.15); e.g.gain.setTargetAtTime(0.05 + rpm * 0.05 + load * 0.03, t, 0.2); }
  engineStop() { const e = this._eng; if (!e) return; const t = this.ctx.currentTime; e.g.gain.setTargetAtTime(0, t, 0.15); e.o1.stop(t + 0.8); e.o2.stop(t + 0.8); this._eng = null; }
  _noise(t, dur, type, freq, q, peak, dest = this.sfx, a = 0.004) {
    const c = this.ctx; const s = c.createBufferSource(); s.buffer = this.noise; const f = c.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    const g = c.createGain(); this._env(g, t, a, peak, dur); s.connect(f); f.connect(g); g.connect(dest); s.start(t, Math.random() * 1.5); s.stop(t + a + dur + 0.05); return f;
  }
  _tone(t, type, f0, f1, dur, peak, dest = this.sfx, a = 0.005) {
    const c = this.ctx; const o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + a + dur);
    const g = c.createGain(); this._env(g, t, a, peak, dur); o.connect(g); g.connect(dest); o.start(t); o.stop(t + a + dur + 0.05); return o;
  }
  // som posicional estéreo: volume pela distância e lado (esquerda/direita) em relação à câmera
  play(name, o = {}) {
    if (o.at && this.ctx && this.ctx.state === 'running' && this.listener) { const L = this.listener(); if (L) { const dx = o.at[0] - L.eye[0], dz = o.at[2] - L.eye[2]; const d = Math.hypot(dx, dz); const max = o.max || 60; if (d > max) return; const fall = Math.pow(1 - d / max, 1.3);
      const ang = Math.atan2(dx, dz) - L.yaw; const pan = this.ctx.createStereoPanner(); pan.pan.value = Math.max(-1, Math.min(1, -Math.sin(ang) * Math.min(1, d / 3))); pan.connect(this.sfx); const saved = this.sfx; this.sfx = pan;
      try { this._play(name, { ...o, at: null, vol: (o.vol ?? 1) * fall }); } finally { this.sfx = saved; } setTimeout(() => { try { pan.disconnect(); } catch (e) {} }, 6000); return; } }
    return this._play(name, o);
  }
  _play(name, o = {}) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    if (this.samples && this.samples[name] && this._sample(name, o)) return;
    const now = this.ctx.currentTime; if (this.lastPlay[name] && now - this.lastPlay[name] < 0.04) return; this.lastPlay[name] = now;
    const t = now + 0.005, v = o.vol ?? 1, R = Math.random;
    switch (name) {
      case 'step': { const s = o.surface || 'grass';
        if (s === 'grass') this._noise(t, 0.09, 'lowpass', 700 + R() * 300, 0.7, 0.18 * v);
        else if (s === 'sand') this._noise(t, 0.12, 'lowpass', 1400, 0.5, 0.12 * v);
        else if (s === 'wood') { this._noise(t, 0.06, 'bandpass', 450, 2, 0.3 * v); this._tone(t, 'sine', 140, 90, 0.07, 0.12 * v); }
        else if (s === 'stone') { this._noise(t, 0.05, 'highpass', 1800, 0.8, 0.12 * v); this._tone(t, 'sine', 110, 80, 0.04, 0.08 * v); }
        else if (s === 'water') { this._noise(t, 0.16, 'bandpass', 1100 + R() * 500, 1.2, 0.2 * v); }
        else if (s === 'snow') this._noise(t, 0.13, 'bandpass', 900, 0.8, 0.15 * v);
        break; }
      case 'jump': this._noise(t, 0.12, 'bandpass', 600, 1, 0.08); break;
      case 'ladder': this._tone(t, 'triangle', 620 + R() * 120, 540, 0.08, 0.1 * v); this._noise(t, 0.05, 'bandpass', 2400, 3, 0.12 * v); break; // degrau de metal
      case 'ladderSlide': this._noise(t, 0.5, 'bandpass', 3200 + R() * 600, 6, 0.16 * v); this._tone(t, 'sawtooth', 900, 700, 0.45, 0.025 * v); break;
      case 'pin': this._tone(t, 'triangle', 2600, 2200, 0.05, 0.12 * v); this._noise(t + 0.06, 0.04, 'highpass', 4000, 1, 0.1 * v); this._tone(t + 0.12, 'square', 1300, 900, 0.04, 0.05 * v); break; // pino puxado + alavanca
      case 'flashbang': this._noise(t, 0.45, 'highpass', 900, 0.5, 1.2 * v, this.sfx, 0.001); this._tone(t, 'sine', 120, 40, 0.4, 0.9 * v); break;
      case 'horn': for (let i = 0; i < 10; i++) { const d = i * 0.6; this._tone(t + d, 'sawtooth', 420, 400, 0.45, 0.22 * v); this._tone(t + d, 'square', 840, 820, 0.45, 0.06 * v); } break; // buzina da granada barulhenta
      case 'shout': { const c = this.ctx, f0 = (o.f0 || 170) * (0.9 + R() * 0.2), dur = 0.5 + R() * 0.2; const src = c.createOscillator(); src.type = 'sawtooth'; src.frequency.setValueAtTime(f0 * 1.3, t); src.frequency.linearRampToValueAtTime(f0 * 1.5, t + 0.12); src.frequency.exponentialRampToValueAtTime(f0, t + dur);
        const out = c.createGain(); out.gain.setValueAtTime(0.0001, t); out.gain.exponentialRampToValueAtTime(0.35 * v, t + 0.03); out.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        const f1 = c.createBiquadFilter(); f1.type = 'bandpass'; f1.frequency.value = 800; f1.Q.value = 4; const f2 = c.createBiquadFilter(); f2.type = 'bandpass'; f2.frequency.value = 1250; f2.Q.value = 5; src.connect(f1); src.connect(f2); f1.connect(out); f2.connect(out); out.connect(this.sfx); src.start(t); src.stop(t + dur + 0.05); break; }
      case 'butcher': this._noise(t, 0.12, 'lowpass', 900, 0.8, 0.35 * v); this._noise(t + 0.05, 0.18, 'bandpass', 500, 2, 0.25 * v); this._tone(t, 'sine', 160, 70, 0.12, 0.2 * v); break;
      case 'swapWeapon': this._noise(t, 0.12, 'bandpass', 1500, 1.5, 0.12 * v); this._tone(t + 0.08, 'square', 700, 500, 0.04, 0.05 * v); break;
      case 'land': this._tone(t, 'sine', 90, 45, 0.15, 0.3 * v); this._noise(t, 0.1, 'lowpass', 500, 0.7, 0.25 * v); break;
      case 'climb': this._noise(t, 0.2, 'lowpass', 900, 0.6, 0.15); this._noise(t + 0.3, 0.1, 'lowpass', 700, 0.6, 0.15); break;
      case 'swing': { const f = this._noise(t, 0.18, 'bandpass', 500, 2, 0.12); f.frequency.exponentialRampToValueAtTime(2500, t + 0.15); break; }
      case 'chop': this._tone(t, 'sine', 210, 95, 0.12, 0.45); this._noise(t, 0.09, 'bandpass', 900, 1.5, 0.4); this._noise(t + 0.02, 0.25, 'lowpass', 400, 0.6, 0.12); break;
      case 'treefall': this._noise(t, 1.6, 'lowpass', 300, 0.5, 0.35, this.sfx, 0.4); this._tone(t + 1.3, 'sine', 70, 35, 0.6, 0.5); this._noise(t + 1.3, 0.5, 'lowpass', 600, 0.6, 0.5); break;
      case 'mine': this._tone(t, 'triangle', 1500 + R() * 300, 1300, 0.18, 0.18); this._tone(t, 'triangle', 2300, 2100, 0.12, 0.1); this._noise(t, 0.06, 'highpass', 2500, 0.7, 0.35); this._noise(t + 0.02, 0.2, 'lowpass', 500, 0.5, 0.15); break;
      case 'rockbreak': this._noise(t, 0.6, 'lowpass', 900, 0.5, 0.5); this._tone(t, 'sine', 120, 40, 0.4, 0.35); break;
      case 'pickup': this._tone(t, 'sine', 520, 880, 0.08, 0.15); this._noise(t, 0.05, 'bandpass', 2000, 1, 0.05); break;
      case 'craft': for (let i = 0; i < 3; i++) { this._noise(t + i * 0.12, 0.06, 'bandpass', 700 + i * 200, 2, 0.25); this._tone(t + i * 0.12, 'sine', 300, 200, 0.05, 0.08); } break;
      case 'build': for (let i = 0; i < 3; i++) { this._tone(t + i * 0.18, 'sine', 180, 90, 0.08, 0.4); this._noise(t + i * 0.18, 0.07, 'bandpass', 1100, 2, 0.3); } break;
      case 'eat': for (let i = 0; i < 4; i++) this._noise(t + i * 0.11, 0.05, 'bandpass', 1800 + R() * 800, 2, 0.15); break;
      case 'bite': for (let i = 0; i < 3; i++) this._noise(t + i * 0.07, 0.045, 'bandpass', 1500 + R() * 1400, 1.5, 0.2 * v); this._tone(t, 'sine', 160, 90, 0.06, 0.1 * v); break;
      case 'gulp': this._tone(t, 'sine', 180, 120, 0.12, 0.28 * v); this._tone(t + 0.05, 'sine', 420, 260, 0.08, 0.1 * v); this._noise(t, 0.1, 'lowpass', 500, 1, 0.12 * v); break;
      case 'unscrew': for (let i = 0; i < 6; i++) this._noise(t + i * 0.055, 0.02, 'highpass', 3500 + R() * 1500, 2, 0.12 * v); this._noise(t + 0.34, 0.05, 'bandpass', 900, 2, 0.15 * v); break;
      case 'pillShake': for (let i = 0; i < 5; i++) this._noise(t + i * 0.05 + R() * 0.02, 0.025, 'bandpass', 4000 + R() * 2000, 4, 0.12 * v); break;
      case 'blister': this._noise(t, 0.05, 'highpass', 2500, 1, 0.35 * v); this._noise(t + 0.03, 0.08, 'bandpass', 5000, 2, 0.2 * v); this._tone(t, 'triangle', 1400, 700, 0.03, 0.12 * v); break;
      case 'vomit': { for (let i = 0; i < 3; i++) { const d = i * 0.45; this._tone(t + d, 'sawtooth', 160 - i * 15, 70, 0.32, 0.18 * v); this._noise(t + d + 0.05, 0.35, 'bandpass', 500, 1.2, 0.35 * v); this._noise(t + d + 0.25, 0.25, 'lowpass', 900, 0.7, 0.25 * v); } break; }
      case 'sizzle': this._noise(t, 0.9, 'highpass', 3500 + R() * 1500, 0.6, 0.09 * v, this.sfx, 0.05); this._noise(t + 0.2, 0.5, 'bandpass', 6000, 2, 0.05 * v); break;
      case 'cooked': this._noise(t, 0.6, 'highpass', 2800, 0.5, 0.2 * v, this.sfx, 0.01); this._tone(t + 0.05, 'sine', 880, 870, 0.12, 0.06 * v); this._tone(t + 0.2, 'sine', 1320, 1310, 0.16, 0.05 * v); break;
      case 'trapArm': this._tone(t, 'square', 1800, 1700, 0.04, 0.05 * v); this._noise(t + 0.05, 0.08, 'highpass', 3000, 1, 0.08 * v); this._tone(t + 0.15, 'triangle', 600, 400, 0.08, 0.08 * v); break;
      case 'swallow': this._tone(t, 'sine', 220, 110, 0.18, 0.22 * v); this._noise(t + 0.02, 0.12, 'lowpass', 400, 1, 0.1 * v); break;
      case 'cloth': for (let i = 0; i < 3; i++) this._noise(t + i * 0.09, 0.12, 'bandpass', 900 + R() * 600, 0.8, 0.12 * v); break;
      case 'wash': for (let i = 0; i < 8; i++) this._noise(t + i * 0.12 + R() * 0.05, 0.15, 'bandpass', 600 + R() * 1200, 0.7, 0.18 * v); break;
      case 'harpoon': this._noise(t, 0.08, 'lowpass', 900, 0.8, 0.6 * v); this._tone(t, 'square', 180, 60, 0.08, 0.18 * v); this._noise(t + 0.02, 0.35, 'bandpass', 1800, 0.6, 0.12 * v); break;
      case 'hookHit': this._tone(t, 'triangle', 900, 500, 0.08, 0.25 * v); this._noise(t, 0.06, 'highpass', 2500, 1, 0.3 * v); break;
      case 'reel': for (let i = 0; i < 4; i++) this._noise(t + i * 0.03, 0.012, 'bandpass', 3200, 4, 0.18 * v); break;
      case 'geiger': for (let i = 0; i < (o.n || 3); i++) this._noise(t + R() * 0.25, 0.006, 'highpass', 3000, 1, 0.2 * v); break;
      case 'drink': for (let i = 0; i < 3; i++) { const os = this._tone(t + i * 0.22, 'sine', 300, 500, 0.12, 0.12); void os; } break;
      case 'punch': this._tone(t, 'sine', 130, 60, 0.1, 0.4); this._noise(t, 0.06, 'lowpass', 1200, 0.7, 0.4); break;
      case 'hit': this._tone(t, 'sine', 160, 70, 0.12, 0.45); this._noise(t, 0.08, 'bandpass', 1500, 1, 0.35); break;
      case 'block': this._noise(t, 0.08, 'bandpass', 2200, 3, 0.35); this._tone(t, 'triangle', 800, 600, 0.1, 0.12); break;
      case 'engineStart': for (let i = 0; i < 4; i++) this._tone(t + i * 0.11, 'sawtooth', 60 + i * 12, 45, 0.09, 0.08 * v); this._noise(t, 0.5, 'lowpass', 500, 1, 0.08 * v); break;
      case 'pour': for (let i = 0; i < 4; i++) this._noise(t + i * 0.07 + R() * 0.03, 0.08, 'bandpass', 700 + R() * 900, 4, 0.06 * v); break;
      case 'groan': { // gemido de dor: voz (dente-de-serra com vibrato) passando por formantes de vogal "a/é", queda de tom
        const c = this.ctx, k = o.big ? 1 : 0.75, f0 = (o.f0 || 150) * (0.92 + R() * 0.16), dur = (o.big ? 0.62 : 0.42) + R() * 0.12;
        const src = c.createOscillator(); src.type = 'sawtooth'; src.frequency.setValueAtTime(f0 * 1.18, t); src.frequency.linearRampToValueAtTime(f0, t + 0.08); src.frequency.exponentialRampToValueAtTime(f0 * 0.72, t + dur);
        const vib = c.createOscillator(); vib.frequency.value = 6 + R() * 2; const vg = c.createGain(); vg.gain.value = f0 * 0.03; vib.connect(vg); vg.connect(src.frequency);
        const out = c.createGain(); out.gain.setValueAtTime(0.0001, t); out.gain.exponentialRampToValueAtTime(0.2 * v * k, t + 0.04); out.gain.setValueAtTime(0.2 * v * k, t + dur * 0.55); out.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        for (const [fq, q, gn] of [[650 + R() * 120, 6, 1], [1150 + R() * 150, 8, 0.55], [2500, 10, 0.18]]) { const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.setValueAtTime(fq, t); bp.frequency.linearRampToValueAtTime(fq * 0.82, t + dur); bp.Q.value = q; const gg = c.createGain(); gg.gain.value = gn; src.connect(bp); bp.connect(gg); gg.connect(out); }
        out.connect(this.sfx); src.start(t); vib.start(t); src.stop(t + dur + 0.05); vib.stop(t + dur + 0.05); this._noise(t, 0.12, 'bandpass', 1800, 1.5, 0.03 * v * k); break; }
      case 'hurt': { const o2 = this._tone(t, 'sawtooth', 220, 130, 0.25, 0.13); void o2; this._noise(t, 0.15, 'bandpass', 900, 3, 0.1); break; }
      case 'growl': { const o1 = this._tone(t, 'sawtooth', 75 + R() * 20, 55, 0.8, 0.16 * v, this.sfx, 0.1); void o1; this._noise(t, 0.7, 'bandpass', 300, 4, 0.12 * v, this.sfx, 0.1); break; }
      case 'screech': this._tone(t, 'sawtooth', 380, 220, 0.4, 0.12 * v); this._noise(t, 0.35, 'bandpass', 1300, 5, 0.12 * v); break;
      case 'howl': { const os = this.ctx.createOscillator(); os.type = 'sine'; const g = this.ctx.createGain(); os.frequency.setValueAtTime(380, t); os.frequency.linearRampToValueAtTime(720, t + 0.6); os.frequency.linearRampToValueAtTime(560, t + 2.2);
        g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.12 * v, t + 0.4); g.gain.linearRampToValueAtTime(0.0001, t + 2.4); os.connect(g); g.connect(this.ambG); os.start(t); os.stop(t + 2.5); break; }
      case 'laser': { const o2 = this._tone(t, 'sawtooth', 1800, 300, 0.18, 0.08 * v); void o2; this._tone(t, 'square', 900, 200, 0.12, 0.04 * v); break; }
      case 'servo': { const o3 = this._tone(t, 'sawtooth', 140 + R() * 60, 260 + R() * 80, 0.35, 0.06 * v, this.sfx, 0.05); void o3; this._noise(t, 0.3, 'bandpass', 2400, 6, 0.04 * v, this.sfx, 0.05); break; }
      case 'buzz': this._tone(t, 'sawtooth', 210 + R() * 40, 235, 0.6, 0.05 * v, this.sfx, 0.1); this._tone(t, 'sawtooth', 420, 440, 0.6, 0.02 * v, this.sfx, 0.1); break;
      case 'alarm': for (let i = 0; i < 3; i++) this._tone(t + i * 0.22, 'square', 1250, 1250, 0.12, 0.05 * v); break;
      case 'metalHit': this._tone(t, 'triangle', 900 + R() * 400, 500, 0.15, 0.18); this._noise(t, 0.08, 'highpass', 3000, 0.7, 0.3); this._tone(t, 'sine', 140, 70, 0.1, 0.25); break;
      case 'robotDie': this._noise(t, 0.6, 'bandpass', 3000, 2, 0.25 * v); this._tone(t, 'sawtooth', 400, 40, 0.9, 0.12 * v); this._noise(t + 0.4, 0.5, 'lowpass', 600, 0.6, 0.35 * v); for (let i = 0; i < 5; i++) this._noise(t + R() * 0.8, 0.03, 'highpass', 4000, 1, 0.12 * v); break;
      case 'rhinoRoar': { // buzina mecânica grave + rangido
        const o1 = this._tone(t, 'sawtooth', 62, 95, 1.1, 0.22 * v, this.sfx, 0.08); void o1; this._tone(t + 0.05, 'square', 93, 140, 1.0, 0.07 * v, this.sfx, 0.1);
        this._noise(t, 1.1, 'bandpass', 380, 3, 0.18 * v, this.sfx, 0.1); this._noise(t + 0.2, 0.6, 'highpass', 3000, 1, 0.05 * v); break; }
      case 'tigerRoar': { const o1 = this._tone(t, 'sawtooth', 180, 70, 1.3, 0.16 * v, this.sfx, 0.12); void o1; this._noise(t, 1.2, 'bandpass', 700, 2.5, 0.24 * v, this.sfx, 0.1); this._noise(t, 1.2, 'lowpass', 300, 0.7, 0.2 * v, this.sfx, 0.15); break; }
      case 'missileLaunch': { const f = this._noise(t, 0.9, 'bandpass', 400, 1.5, 0.35 * v, this.sfx, 0.02); f.frequency.exponentialRampToValueAtTime(2200, t + 0.7); this._tone(t, 'sine', 120, 50, 0.3, 0.3 * v); break; }
      case 'glShot': this._tone(t, 'sine', 120, 45, 0.25, 0.7 * v); this._noise(t, 0.18, 'lowpass', 900, 0.8, 0.6 * v); this._noise(t + 0.02, 0.1, 'bandpass', 2200, 1.5, 0.15 * v); break;
      case 'rpgShot': this._noise(t, 0.35, 'lowpass', 700, 0.7, 0.9 * v); this._tone(t, 'sine', 90, 35, 0.4, 0.6 * v); this._noise(t + 0.05, 1.4, 'bandpass', 1400, 0.6, 0.35 * v); break;
      case 'explosion': this._noise(t, 1.6, 'lowpass', 600, 0.6, 0.9 * v, this.sfx, 0.005); this._tone(t, 'sine', 70, 28, 0.9, 0.7 * v); this._noise(t, 0.25, 'highpass', 1500, 0.6, 0.4 * v); for (let i = 0; i < 6; i++) this._noise(t + 0.2 + R() * 0.8, 0.05, 'bandpass', 2000 + R() * 2000, 2, 0.1 * v); break;
      case 'spinup': { const c = this.ctx; const o = c.createOscillator(); o.type = 'sawtooth'; const g2 = c.createGain(); const f2 = c.createBiquadFilter(); f2.type = 'bandpass'; f2.Q.value = 3;
        o.frequency.setValueAtTime(90, t); o.frequency.exponentialRampToValueAtTime(820, t + 1.0); f2.frequency.setValueAtTime(400, t); f2.frequency.exponentialRampToValueAtTime(2400, t + 1.0);
        g2.gain.setValueAtTime(0.0001, t); g2.gain.exponentialRampToValueAtTime(0.12 * v, t + 0.6); g2.gain.exponentialRampToValueAtTime(0.0001, t + 1.15); o.connect(f2); f2.connect(g2); g2.connect(this.sfx); o.start(t); o.stop(t + 1.2); break; }
      // armas de fogo: estalo supersônico + corpo grave + cauda (eco) — sintetizados
      case 'pistol': this._noise(t, 0.07, 'highpass', 2500, 0.7, 0.55 * v); this._noise(t, 0.22, 'lowpass', 900, 0.8, 0.6 * v, this.sfx, 0.002); this._tone(t, 'sine', 160, 50, 0.16, 0.4 * v); this._noise(t + 0.05, 0.6, 'lowpass', 500, 0.5, 0.12 * v, this.sfx, 0.05); break;
      case 'rifle': this._noise(t, 0.05, 'highpass', 3200, 0.7, 0.7 * v); this._noise(t, 0.3, 'lowpass', 1200, 0.8, 0.7 * v, this.sfx, 0.002); this._tone(t, 'sine', 120, 40, 0.2, 0.5 * v); this._noise(t + 0.06, 0.9, 'lowpass', 420, 0.5, 0.16 * v, this.sfx, 0.06); break;
      case 'sniper': this._noise(t, 0.06, 'highpass', 2600, 0.7, 0.85 * v); this._noise(t, 0.4, 'lowpass', 900, 0.8, 0.9 * v, this.sfx, 0.002); this._tone(t, 'sine', 95, 30, 0.35, 0.6 * v); this._noise(t + 0.1, 1.8, 'lowpass', 300, 0.5, 0.22 * v, this.sfx, 0.1); break;
      case 'shotgun': this._noise(t, 0.08, 'highpass', 1800, 0.6, 0.6 * v); this._noise(t, 0.45, 'lowpass', 700, 0.7, 0.9 * v, this.sfx, 0.002); this._tone(t, 'sine', 90, 32, 0.32, 0.6 * v); this._noise(t + 0.08, 1.2, 'lowpass', 350, 0.5, 0.2 * v, this.sfx, 0.08); break;
      case 'engine': this._tone(t, 'sawtooth', 48 + R() * 6, 44, 1.2, 0.08 * v); this._noise(t, 1.1, 'lowpass', 220, 0.6, 0.12 * v, this.sfx, 0.2); break;
      case 'bowShot': this._tone(t, 'triangle', 180, 110, 0.12, 0.25 * v); this._noise(t, 0.05, 'bandpass', 1400, 2, 0.25 * v); { const f = this._noise(t + 0.02, 0.25, 'bandpass', 900, 1.5, 0.1 * v); f.frequency.exponentialRampToValueAtTime(400, t + 0.25); } break;
      case 'arrowHit': this._noise(t, 0.05, 'bandpass', 900, 2, 0.3 * v); this._tone(t, 'sine', 300, 140, 0.08, 0.12 * v); break;
      case 'dryfire': this._noise(t, 0.03, 'bandpass', 3500, 3, 0.25); break;
      case 'magOut': this._noise(t, 0.05, 'bandpass', 1800, 4, 0.3); this._tone(t, 'square', 900, 600, 0.03, 0.05); break;
      case 'magIn': this._noise(t, 0.04, 'bandpass', 2400, 4, 0.35); this._noise(t + 0.03, 0.05, 'bandpass', 1200, 3, 0.3); this._tone(t + 0.03, 'square', 500, 380, 0.03, 0.06); break;
      case 'bolt': this._noise(t, 0.06, 'bandpass', 2000, 3, 0.35); this._noise(t + 0.12, 0.05, 'bandpass', 2800, 3, 0.35); break;
      case 'pump': this._noise(t, 0.09, 'bandpass', 1300, 2, 0.35); this._noise(t + 0.16, 0.08, 'bandpass', 1700, 2, 0.35); break;
      case 'shell': this._tone(t + 0.25, 'sine', 4200 + R() * 600, 3800, 0.06, 0.05 * v); this._tone(t + 0.38, 'sine', 3900, 3600, 0.05, 0.03 * v); break;
      case 'impactDirt': this._noise(t, 0.08, 'lowpass', 1200, 0.6, 0.18 * v); break;
      case 'impactWood': this._noise(t, 0.06, 'bandpass', 700, 2, 0.25 * v); this._tone(t, 'sine', 220, 120, 0.06, 0.1 * v); break;
      case 'impactMetal': this._tone(t, 'triangle', 2400 + R() * 800, 1800, 0.12, 0.12 * v); this._noise(t, 0.04, 'highpass', 3000, 1, 0.2 * v); break;
      case 'hitmark': this._tone(t, 'square', 1800, 1700, 0.04, 0.05); break;
      case 'minigun': this._noise(t, 0.05, 'bandpass', 1400 + R() * 400, 1.2, 0.28 * v); this._tone(t, 'square', 180, 90, 0.04, 0.06 * v); this._tone(t, 'sawtooth', 820, 800, 0.09, 0.03 * v); break;
      case 'steam': { const f = this._noise(t, 1.6, 'highpass', 4000, 0.7, 0.22 * v, this.sfx, 0.05); f.frequency.exponentialRampToValueAtTime(1500, t + 1.5); this._tone(t, 'sine', 900, 200, 0.6, 0.04 * v); break; }
      case 'animal': this._tone(t, 'triangle', 600, 400, 0.18, 0.06 * v); break;
      case 'enemyDie': this._tone(t, 'sawtooth', 160, 40, 0.9, 0.15 * v); this._noise(t, 0.5, 'lowpass', 400, 0.6, 0.2 * v); break;
      case 'splash': this._noise(t, 0.5, 'bandpass', 900, 0.8, 0.35); this._noise(t, 0.3, 'lowpass', 400, 0.6, 0.3); break;
      case 'swim': this._noise(t, 0.35, 'bandpass', 700 + R() * 300, 0.9, 0.12, this.sfx, 0.08); break;
      case 'robotStep': this._noise(t, 0.05, 'bandpass', 900 + R() * 300, 3, 0.35 * v); this._tone(t, 'square', 140 + R() * 30, 90, 0.05, 0.07 * v); this._tone(t + 0.04, 'sawtooth', 700 + R() * 200, 520, 0.09, 0.03 * v); break;
      case 'webShot': this._noise(t, 0.25, 'bandpass', 2200, 2, 0.35 * v); this._tone(t, 'sine', 600, 180, 0.2, 0.08 * v); break;
      case 'webHit': this._noise(t, 0.18, 'lowpass', 900, 1, 0.4 * v); break;
      case 'beep': this._tone(t, 'square', 2600, 2600, 0.05, 0.12 * v); break;
      case 'c4arm': this._tone(t, 'square', 1200, 1200, 0.06, 0.1 * v); this._tone(t + 0.1, 'square', 1800, 1800, 0.06, 0.1 * v); this._tone(t + 0.2, 'square', 2400, 2400, 0.12, 0.12 * v); break;
      case 'cough': for (let i = 0; i < 3; i++) { const d = i * 0.28 + Math.random() * 0.05; this._noise(t + d, 0.14, 'bandpass', 520 + Math.random() * 200, 1.2, 0.5 * v); this._tone(t + d, 'sawtooth', 190, 120, 0.1, 0.08 * v); } break;
      case 'page': this._noise(t, 0.16, 'bandpass', 2600 + R() * 1200, 0.6, 0.09 * v); this._noise(t + 0.07, 0.1, 'highpass', 3500, 0.7, 0.05 * v); break;
      case 'skill': this._tone(t, 'sine', 660, 990, 0.4, 0.08 * v); break;
      case 'nvgOn': this._tone(t, 'sine', 2400, 5200, 0.35, 0.06 * v); break;
      case 'click': this._tone(t, 'square', 1800, 1200, 0.02, 0.05 * v); break;
      case 'glass': for (let i = 0; i < 9; i++) { const d = Math.random() * 0.25; this._tone(t + d, 'triangle', 2500 + Math.random() * 3500, 1800 + Math.random() * 2000, 0.06 + Math.random() * 0.12, 0.08 * v); } this._noise(t, 0.25, 'highpass', 3000, 0.8, 0.45 * v); break;
      case 'thunder': { const d = o.delay || 0; this._noise(t + d, 3.5, 'lowpass', 180, 0.5, 0.8 * v, this.ambG, 0.05); this._noise(t + d, 0.4, 'lowpass', 1200, 0.5, 0.4 * v, this.ambG, 0.01); break; }
      case 'ui': this._tone(t, 'sine', 900, 1200, 0.04, 0.06); break;
      case 'error': this._tone(t, 'square', 220, 180, 0.12, 0.05); break;
      case 'door': this._noise(t, 0.35, 'bandpass', 400, 6, 0.2); this._tone(t, 'sawtooth', 120, 180, 0.3, 0.03); break;
      case 'fireLight': this._noise(t, 0.6, 'lowpass', 900, 0.5, 0.3, this.sfx, 0.2); break;
      case 'death': this._tone(t, 'sine', 300, 60, 2.0, 0.2, this.music, 0.05); this._tone(t, 'sine', 360, 72, 2.0, 0.12, this.music, 0.05); break;
      case 'sleep': [262, 330, 392].forEach((f, i) => this._tone(t + i * 0.25, 'sine', f, f, 1.2, 0.08, this.music, 0.2)); break;
    }
  }
  // Atualiza camadas ambientais contínuas
  update(dt, e) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const t = this.ctx.currentTime, k = 0.15;
    const set = (n, v, f) => { const a = this.amb[n]; if (!a) return; a.g.gain.setTargetAtTime(v, t, k); if (f) a.f.frequency.setTargetAtTime(f, t, 0.5); };
    set('wind', (0.08 + e.wind * 0.12) * (e.inCave ? 0.3 : 1), 300 + e.wind * 300);
    set('rain', e.rain * 0.22 * (e.inCave ? 0.25 : 1)); set('fire', e.fire * 0.05); set('water', e.water * 0.07);
    if (e.fire > 0.05 && Math.random() < dt * 10 * e.fire) this._noise(t, 0.02, 'highpass', 3000, 1, 0.08 * e.fire, this.ambG);
    // pássaros (dia) e grilos (noite)
    this.nextBird -= dt; if (this.nextBird <= 0) { this.nextBird = 2 + Math.random() * 6; if (e.day > 0.5 && e.rain < 0.3 && !e.inCave) this._bird(); }
    this.nextCricket -= dt; if (this.nextCricket <= 0) { this.nextCricket = 0.4 + Math.random() * 1.2; if (e.day < 0.4 && e.rain < 0.3 && !e.inCave) this._cricket(); }
    if (e.inCave) { this.nextDrip -= dt; if (this.nextDrip <= 0) { this.nextDrip = 1 + Math.random() * 3; this._tone(t, 'sine', 1400 + Math.random() * 600, 600, 0.12, 0.05, this.ambG); } }
    this.nextMusic -= dt; if (this.nextMusic <= 0 && this.musicOn) { this.nextMusic = 28 + Math.random() * 20; this._music(e.day < 0.4); }
  }
  _bird() { const t = this.ctx.currentTime; const base = 2200 + Math.random() * 1800; const n = 2 + Math.floor(Math.random() * 4);
    for (let i = 0; i < n; i++) this._tone(t + i * 0.13, 'sine', base, base * (1.2 + Math.random() * 0.3), 0.07, 0.025, this.ambG, 0.01); }
  _cricket() { const t = this.ctx.currentTime; for (let i = 0; i < 3; i++) this._tone(t + i * 0.05, 'sine', 4300, 4300, 0.03, 0.012, this.ambG, 0.005); }
  _music(night) {
    const t = this.ctx.currentTime; const prog = night ? [[220, 261.6, 329.6], [196, 246.9, 293.7], [174.6, 220, 261.6], [164.8, 207.7, 246.9]] : [[261.6, 329.6, 392], [220, 261.6, 329.6], [174.6, 220, 261.6], [196, 246.9, 293.7]];
    prog.forEach((ch, i) => ch.forEach((f) => { const o = this.ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = f / 2; const g = this.ctx.createGain(); const s = t + i * 3.2;
      g.gain.setValueAtTime(0.0001, s); g.gain.linearRampToValueAtTime(0.035, s + 1.2); g.gain.linearRampToValueAtTime(0.0001, s + 3.8); o.connect(g); g.connect(this.music); o.start(s); o.stop(s + 4); }));
  }
}
