// Ciclo de dia/noite (sol e lua), clima dinâmico (limpo, nublado, neblina, chuva, tempestade) e partículas.
import { clamp, lerp, smoothstep } from '../engine/math.js';

const lerp3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const WEATHERS = {
  limpo: { cloud: 0.05, fog: 0.0, rain: 0, wind: 0.6, label: 'Céu limpo' },
  nublado: { cloud: 0.7, fog: 0.15, rain: 0, wind: 1.0, label: 'Nublado' },
  neblina: { cloud: 0.5, fog: 1.0, rain: 0, wind: 0.3, label: 'Neblina' },
  chuva: { cloud: 0.9, fog: 0.4, rain: 0.7, wind: 1.6, label: 'Chuva' },
  tempestade: { cloud: 1.0, fog: 0.5, rain: 1.0, wind: 2.6, label: 'Tempestade' },
};
export class Environment {
  constructor(game) {
    this.game = game; this.dayLength = 960; // segundos reais por dia
    this.time = 0.3; this.day = 1; this.weather = 'limpo'; this.next = 'limpo'; this.blend = 1; this.weatherT = 240;
    this.cur = { ...WEATHERS.limpo }; this.flash = 0; this.thunderT = 8; this.wet = 0; this.elapsed = 0;
  }
  get hours() { return (this.time * 24) % 24; }
  get isNight() { const h = this.hours; return h < 5.5 || h > 19.5; }
  get label() { return WEATHERS[this.next].label; }
  setWeather(w) { if (WEATHERS[w]) { this.next = w; this.blend = 0; } }
  update(dt) {
    this.elapsed += dt;
    // dia de 40 min reais (6h–18h) e noite de 15 min reais (18h–6h)
    { const isDay = this.time > 0.25 && this.time < 0.75; this.time += dt / (isDay ? 4800 : 1800); } if (this.time >= 1) { this.time -= 1; this.day++; this.game.onNewDay && this.game.onNewDay(); }
    this.weatherT -= dt;
    if (this.weatherT <= 0) {
      const r = Math.random(); const opts = r < 0.36 ? 'limpo' : r < 0.55 ? 'nublado' : r < 0.65 ? 'neblina' : r < 0.9 ? 'chuva' : 'tempestade';
      this.weather = this.next; this.next = opts; this.blend = 0; this.weatherT = 150 + Math.random() * 240;
    }
    this.blend = Math.min(1, this.blend + dt / 25);
    const T = WEATHERS[this.next]; for (const k of ['cloud', 'fog', 'rain', 'wind']) this.cur[k] = lerp(this.cur[k], T[k], 1 - Math.exp(-dt / 8));
    this.wet = clamp(this.wet + (this.cur.rain > 0.2 ? dt / 30 : -dt / 90), 0, 1);
    if (this.next === 'tempestade' && this.cur.rain > 0.6) { this.thunderT -= dt; if (this.thunderT <= 0) { this.thunderT = 6 + Math.random() * 14; this.flash = 1; this.game.audio.play('thunder', { delay: 0.3 + Math.random() * 1.5, vol: 0.8 }); } }
    this.flash = Math.max(0, this.flash - dt * 3.5);
  }
  apply(r, playerPos, inCave) {
    const e = r.env; const ang = (this.time - 0.25) * Math.PI * 2;
    const sun = [Math.cos(ang) * 0.85, Math.sin(ang), 0.35]; const l = Math.hypot(...sun); e.sunDir = sun.map((v) => v / l);
    e.moonDir = e.sunDir.map((v) => -v); e.moonDir[2] = 0.35;
    const sh = e.sunDir[1];
    const day = smoothstep(-0.12, 0.2, sh); const dusk = smoothstep(0.35, 0.0, Math.abs(sh)) * smoothstep(-0.25, 0.0, sh);
    e.night = 1 - smoothstep(-0.2, 0.05, sh);
    const cl = this.cur.cloud, fogA = this.cur.fog;
    const sunCol = lerp3([1.0, 0.95, 0.85], [1.0, 0.55, 0.28], dusk);
    const sunI = day * (1 - cl * 0.7) * 2.6;
    const moonI = e.night * (1 - cl * 0.6) * 0.035; // noite muito escura: precisa de tocha, lanterna ou visão noturna
    e.sunCol = sh > 0.05 ? sunCol.map((v) => v * sunI) : [0.55 * moonI, 0.65 * moonI, 1.0 * moonI];
    const skyDay = lerp3([0.25, 0.48, 0.85], [0.5, 0.55, 0.6], cl), skyNight = [0.003, 0.005, 0.014];
    e.zenith = lerp3(skyNight, skyDay, day);
    const horDay = lerp3(lerp3([0.72, 0.82, 0.92], [1.0, 0.6, 0.38], dusk), [0.62, 0.64, 0.66], cl);
    e.horizon = lerp3([0.01, 0.014, 0.028], horDay, day);
    const amb = lerp(0.12, 0.75, day) * (1 - cl * 0.25);
    e.ambSky = lerp3([0.004, 0.006, 0.011], [0.55 * amb + 0.05, 0.62 * amb + 0.05, 0.78 * amb + 0.07], day);
    if (day < 0.5) e.ambSky = lerp3([0.004, 0.006, 0.011], e.ambSky, day * 2);
    e.ambGround = e.ambSky.map((v, i) => v * [0.55, 0.5, 0.4][i]);
    e.fogCol = lerp3(e.horizon, [0.55 * day + 0.04, 0.58 * day + 0.045, 0.6 * day + 0.06], fogA * 0.8);
    e.fogDensity = (0.0028 + fogA * 0.014 + this.cur.rain * 0.004) * (this.game.settings.viewDist === 'curta' ? 1.6 : 1);
    e.fogAmt = fogA * 0.9; e.cloud = cl; e.wind = 0.6 + this.cur.wind; e.wet = this.wet; e.rain = this.cur.rain;
    e.flash = this.flash; e.time = this.elapsed;
    // dispersão solar na névoa/céu (linear) e altura da névoa
    const warm = lerp3([1.0, 0.82, 0.62], [1.0, 0.5, 0.22], dusk);
    e.scatterCol = warm.map((v) => v * (0.25 + 0.6 * dusk) * day * (1 - cl * 0.6));
    e.fogHeight = 6 + fogA * 25;
    // névoa tóxica da Cidade Morta: verde-amarelada e densa dentro; vista de fora como um paredão esverdeado
    { const g = this.game, cp = g.renderer.camPos || g.player.pos; const tox = g.world.toxicAt ? g.world.toxicAt(cp[0], cp[2]) : 0; this.toxic = lerp(this.toxic || 0, tox, 0.05);
      const t = this.toxic; if (t > 0.01) { const tc = [0.42 * day + 0.06, 0.5 * day + 0.08, 0.16 * day + 0.03]; e.fogCol = lerp3(e.fogCol, tc, Math.min(1, t * 1.4)); e.horizon = lerp3(e.horizon, tc, t); e.zenith = lerp3(e.zenith, tc, t * 0.6); e.fogDensity = Math.max(e.fogDensity, lerp(e.fogDensity, 0.03, Math.min(1, t * 1.2))); e.fogHeight = lerp(e.fogHeight, 60, t); e.fogAmt = Math.max(e.fogAmt, t); e.sunCol = e.sunCol.map((v) => v * (1 - t * 0.45)); } }
    const nv = this.game.nvgOn ? 1 : 0; r.exposure = (nv ? (inCave ? 7 : lerp(1.2, 7, e.night)) : 1);
    if (nv) e.ambSky = e.ambSky.map((v) => v + 0.02), e.ambGround = e.ambSky.map((v, i) => v * [0.55, 0.5, 0.4][i]);
    if (inCave) { const k = 0.25; e.ambSky = e.ambSky.map((v) => v * k + 0.012); e.ambGround = e.ambGround.map((v) => v * k + 0.01); e.sunCol = e.sunCol.map((v) => v * 0.15); }
    // relâmpago ilumina tudo
    if (this.flash > 0) { e.ambSky = e.ambSky.map((v) => v + this.flash * 0.6); }
  }
  serialize() { return { time: this.time, day: this.day, weather: this.next, weatherT: this.weatherT }; }
  load(s) { if (!s) return; this.time = s.time; this.day = s.day; this.next = this.weather = s.weather in WEATHERS ? s.weather : 'limpo'; this.weatherT = s.weatherT || 200; Object.assign(this.cur, WEATHERS[this.next]); }
}

// Sistema de partículas leve (CPU), renderizado como billboards instanciados
export class FX {
  constructor(game) { this.game = game; this.parts = []; this.rainSeed = 0; }
  burst(p, n, col, speed = 2, life = 0.8, size = 0.06, grav = 9) {
    for (let i = 0; i < n; i++) { const a = Math.random() * 6.283, u = Math.random() * 2 - 1, s = speed * (0.4 + Math.random() * 0.8);
      this.parts.push({ p: p.slice(), v: [Math.cos(a) * Math.sqrt(1 - u * u) * s, Math.abs(u) * s + 1, Math.sin(a) * Math.sqrt(1 - u * u) * s], life, max: life, col, size, grav }); }
  }
  // traçante: linha luminosa curta da boca do cano até o impacto
  tracer(a, b) {
    const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]; const l = Math.hypot(...d); const n = Math.min(60, Math.ceil(l / 0.5)); const off = Math.random() * 0.5;
    for (let i = 0; i < n; i++) { const t = Math.min(1, (i + off) / n); this.parts.push({ p: [a[0] + d[0] * t, a[1] + d[1] * t, a[2] + d[2] * t], v: [0, 0, 0], life: 0.035 + t * 0.03, max: 0.065, col: [4, 3.2, 1.6], size: 0.016, grav: 0 }); }
  }
  fire(p, intensity = 1) {
    if (Math.random() < 0.9 * intensity) this.parts.push({ p: [p[0] + (Math.random() - 0.5) * 0.4, p[1] + 0.1, p[2] + (Math.random() - 0.5) * 0.4], v: [(Math.random() - 0.5) * 0.3, 1.2 + Math.random(), (Math.random() - 0.5) * 0.3], life: 0.7, max: 0.7, col: [1, 0.55, 0.15], size: 0.22 * intensity, grav: -0.5, fire: true });
    if (Math.random() < 0.25 * intensity) this.parts.push({ p: [p[0], p[1] + 0.7, p[2]], v: [(Math.random() - 0.5) * 0.4, 1.0, (Math.random() - 0.5) * 0.4], life: 2.2, max: 2.2, col: [0.55, 0.55, 0.55], size: 0.35, grav: -0.2, smoke: true });
  }
  // paredão de névoa tóxica: nuvens verdes grandes na borda da Cidade Morta, visíveis de longe e por dentro
  toxicHaze(dt, camPos, T, h0) {
    // paredão fixo de nuvens ao redor da borda (sempre visível de fora, acima das árvores)
    { const r = this.game.renderer, dx0 = camPos[0] - T.x, dz0 = camPos[2] - T.z, d0 = Math.hypot(dx0, dz0); const night = this.game.renderer.env.night || 0, k = 1 - night * 0.8;
      if (d0 > T.r - 80 && d0 < T.r + 2500) { const tt = this.elapsed || 0; for (let i = 0; i < 96; i++) { const a = i / 96 * 6.283 + Math.sin(i * 7.1) * 0.02; const x = T.x + Math.cos(a) * (T.r - 40), z = T.z + Math.sin(a) * (T.r - 40);
        const ex = x - camPos[0], ez = z - camPos[2], dd = Math.hypot(ex, ez); if (d0 > T.r + 50 && dd > Math.sqrt(Math.max(0, d0 * d0 - T.r * T.r)) + 120) continue; // metade de trás do círculo
        const gy = Math.max(0, this.game.world.height(x, z)); const K = dd > 780 ? 780 / dd : 1; // longe demais: aproxima ao longo do raio e reduz o tamanho (mesmo tamanho na tela) para não cortar no plano distante
        for (let l = 0; l < 3; l++) { const sz = (70 + l * 25 + Math.sin(tt * 0.1 + i) * 8) * K, py = gy + 20 + l * 45; r.particle(camPos[0] + ex * K, camPos[1] + (py - camPos[1]) * K, camPos[2] + ez * K, sz, 0.6 * k, 0.8 * k, 0.32 * k, 0.5 - l * 0.1); } } } }
    const dx = camPos[0] - T.x, dz = camPos[2] - T.z, d = Math.hypot(dx, dz); if (d > T.r + 900) return; const n = Math.min(40, Math.ceil(dt * 120)); const base = Math.atan2(dz, dx);
    for (let i = 0; i < n; i++) { if (this.parts.length > 2600) break; const inside = d < T.r - 60; const a = inside ? Math.random() * 6.283 : base + (Math.random() - 0.5) * Math.min(2.4, 900 / Math.max(80, d - T.r + 200));
      const rr = inside ? 20 + Math.random() * 110 : T.r - 30 + Math.random() * 80; const x = inside ? camPos[0] + Math.cos(a) * rr : T.x + Math.cos(a) * rr, z = inside ? camPos[2] + Math.sin(a) * rr : T.z + Math.sin(a) * rr;
      const y = (h0 ? h0(x, z) : 0) + 2 + Math.random() * (inside ? 18 : 55); const life = 6 + Math.random() * 5;
      this.parts.push({ p: [x, y, z], v: [(Math.random() - 0.5) * 0.6, 0.15, (Math.random() - 0.5) * 0.6], life, max: life, col: [0.72, 0.8, 0.4], size: inside ? 6 + Math.random() * 6 : 16 + Math.random() * 18, grav: 0, haze: true }); }
  }
  update(dt, r, camPos, rain, night) {
    const out = [];
    for (const q of this.parts) {
      q.life -= dt; if (q.life <= 0) continue; q.v[1] -= q.grav * dt; q.p[0] += q.v[0] * dt; q.p[1] += q.v[1] * dt; q.p[2] += q.v[2] * dt; out.push(q);
      const t = q.life / q.max;
      if (q.fire) r.particle(q.p[0], q.p[1], q.p[2], q.size * (0.5 + t), 1.5 + t, 0.6 * t + 0.3, 0.1, t);
      else if (q.haze) { const k = 1 - night * 0.8; r.particle(q.p[0], q.p[1], q.p[2], q.size, q.col[0] * k, q.col[1] * k, q.col[2] * k, Math.sin(Math.PI * t) * 0.32); }
      else if (q.smoke) r.particle(q.p[0], q.p[1], q.p[2], q.size * (2 - t), q.col[0] * (1 - night * 0.8), q.col[1] * (1 - night * 0.8), q.col[2] * (1 - night * 0.8), t * 0.18);
      else r.particle(q.p[0], q.p[1], q.p[2], q.size, q.col[0], q.col[1], q.col[2], Math.min(1, t * 2));
    }
    this.parts = out.length > 2500 ? out.slice(-2500) : out;
    // chuva ao redor da câmera
    if (rain > 0.03) {
      const n = Math.floor(rain * 1400); const t = this.game.env.elapsed; const b = 1 - night * 0.7;
      for (let i = 0; i < n; i++) {
        const hx = Math.sin(i * 12.9898) * 43758.5453, hz = Math.sin(i * 78.233) * 12345.678; const fx = hx - Math.floor(hx), fz = hz - Math.floor(hz);
        const x = camPos[0] + (fx - 0.5) * 36, z = camPos[2] + (fz - 0.5) * 36; const sp = 14 + fx * 4;
        const y = camPos[1] + 14 - ((t * sp + fz * 30) % 28);
        if (y < this.game.world.height(x, z)) continue;
        if (this.game.world.caveAt(x, z)) continue;
        r.particle(x, y, z, 0.018, 0.75 * b, 0.8 * b, 0.9 * b, 0.55, 22);
      }
      // respingos no chão
      const fr = Math.floor(t * 9); const ns = Math.floor(rain * 160);
      for (let i = 0; i < ns; i++) { const hx = Math.sin(i * 91.7 + fr * 3.17) * 43758.5453, hz = Math.sin(i * 47.3 + fr * 1.71) * 24634.6345; const fx = hx - Math.floor(hx), fz = hz - Math.floor(hz);
        const x = camPos[0] + (fx - 0.5) * 30, z = camPos[2] + (fz - 0.5) * 30; const gy = Math.max(this.game.world.height(x, z), 0); if (this.game.world.caveAt(x, z)) continue;
        r.particle(x, gy + 0.05, z, 0.05 + fx * 0.04, 0.8 * b, 0.85 * b, 0.95 * b, 0.35); }
    }
  }
}
