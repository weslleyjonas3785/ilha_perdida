// Explosões e fumaça em low-poly (como as referências): bola de fogo facetada, estilhaços de fogo em ponta saindo
// para os lados, brasas e pedaços de terra voando, e fumaça escura em bolas que sobe e cresce.
// • frag (granada de fragmentação): explosão média e rápida, clarão forte.
// • c4: a mais forte — bola de fogo enorme, coluna de fumaça alta, chamas que ficam queimando no chão.
// • smoke (granada de fumaça): nuvem densa e baixa (≈3 m de altura) de bolas cinza que cobre a área onde caiu (≈8 m) e esconde o que está dentro (15 s).
import { MeshBuilder, M } from '../engine/mesh.js';
import { mat4 } from '../engine/math.js';

const R = Math.random, W = [1, 1, 1];
const rng = (seed) => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
const lerp = (a, b, t) => a + (b - a) * t, clamp01 = (t) => Math.max(0, Math.min(1, t));
const FIRE = [[1, 0.9, 0.2], [1, 0.72, 0.08], [1, 0.5, 0.06], [0.95, 0.3, 0.04], [0.85, 0.16, 0.03]];
// matriz que aponta o eixo Y da peça na direção d (comprimento len, largura w)
function aim(p, d, len, w) {
  const l = Math.hypot(d[0], d[1], d[2]) || 1, y = [d[0] / l, d[1] / l, d[2] / l]; const up = Math.abs(y[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
  let x = [up[1] * y[2] - up[2] * y[1], up[2] * y[0] - up[0] * y[2], up[0] * y[1] - up[1] * y[0]]; const xl = Math.hypot(...x) || 1; x = x.map((v) => v / xl);
  const z = [x[1] * y[2] - x[2] * y[1], x[2] * y[0] - x[0] * y[2], x[0] * y[1] - x[1] * y[0]];
  return new Float32Array([x[0] * w, x[1] * w, x[2] * w, 0, y[0] * len, y[1] * len, y[2] * len, 0, z[0] * w, z[1] * w, z[2] * w, 0, p[0], p[1], p[2], 1]);
}

export class Blasts {
  constructor(game) { this.g = game; this.list = []; this.clouds = []; }
  _meshes() {
    if (this.m) return this.m; const r = this.g.renderer, mk = (f, mat) => { const mb = new MeshBuilder(); mb.setColor(W, mat); f(mb); return r.createMesh(mb.build()); };
    const ball = (mb, s) => mb.rock(M(0, 0, 0), 1, 1, 0.14, W, rng(s)), spike = (mb) => mb.cylinder(M(0, 0, 0), 0.5, 0, 1, 4, W), chunk = (mb) => mb.rock(M(0, 0, 0), 1, 0, 0.3, W, rng(3));
    // fogo: material que brilha sozinho (a cor/brilho vem do tint); fumaça e terra: material comum
    this.m = { fball: mk((mb) => ball(mb, 7), 0.0), fball2: mk((mb) => ball(mb, 19), 0.0), spike: mk(spike, 0.0), fchunk: mk(chunk, 0.0),
      ball: mk((mb) => ball(mb, 7), 0.95), ball2: mk((mb) => ball(mb, 19), 0.95), chunk: mk(chunk, 0.95) }; return this.m;
  }
  // ---------- explosão ----------
  boom(kind, p) {
    const big = kind === 'c4', S = big ? 5.2 : 1.5; const e = { kind, p: p.slice(), t: 0, dur: big ? 7 : 3.2, parts: [] };
    const add = (o) => e.parts.push(o);
    // bola de fogo (núcleo)
    for (let k = 0; k < (big ? 22 : 7); k++) { const a = R() * 6.283, u = R() * 0.9, d = R() * 1.1 * S; add({ type: 'core', mesh: R() < 0.5 ? 'ball' : 'ball2', o: [Math.cos(a) * d * (1 - u * 0.5), 0.3 * S + u * 1.3 * S, Math.sin(a) * d * (1 - u * 0.5)], r: (0.9 + R() * 0.9) * S, life: (0.6 + R() * 0.4) * (big ? 1.8 : 1), c: FIRE[k % 4 === 0 ? 0 : 1 + Math.floor(R() * 3)], spin: R() * 6 }); }
    // estilhaços de fogo em ponta (mais para os lados, alguns para cima)
    for (let k = 0; k < (big ? 34 : 20); k++) { const a = R() * 6.283, el = (R() < 0.75 ? R() * 0.5 : 0.5 + R() * 0.9); const dir = [Math.cos(a) * Math.cos(el), Math.sin(el), Math.sin(a) * Math.cos(el)];
      add({ type: 'spike', dir, len: (1.6 + R() * 2.4) * S * (el > 0.8 ? 0.8 : 1), w: (0.35 + R() * 0.45) * S, life: (0.45 + R() * 0.35) * (big ? 1.7 : 1), c: FIRE[1 + Math.floor(R() * 4)], off: 0.2 * S }); }
    // brasas e pedaços de terra/pedra voando
    for (let k = 0; k < (big ? 80 : 34); k++) { const a = R() * 6.283, el = 0.15 + R() * 1.2, sp = (7 + R() * 14) * (big ? 1.4 : 1); const hot = R() < 0.6;
      add({ type: 'bit', p: [p[0], p[1] + 0.4, p[2]], v: [Math.cos(a) * Math.cos(el) * sp, Math.sin(el) * sp, Math.sin(a) * Math.cos(el) * sp], r: (hot ? 0.06 + R() * 0.12 : 0.1 + R() * 0.22) * (big ? 1.4 : 1), life: 1.1 + R() * 1.4, hot, c: hot ? FIRE[Math.floor(R() * 3)] : [0.28 + R() * 0.1, 0.22, 0.17], spin: R() * 6, ws: R() * 9 }); }
    // fumaça escura subindo
    for (let k = 0; k < (big ? 60 : 26); k++) { const a = R() * 6.283, d = R() * 1.5 * S; add({ type: 'smoke', o: [Math.cos(a) * d, 0.5 * S + R() * 1.6 * S, Math.sin(a) * d], up: (1.0 + R() * 2.4) * (big ? 3.2 : 1), drift: [(R() - 0.5) * 1.2, (R() - 0.5) * 1.2], r0: 0.35 * S, r1: (0.7 + R() * 0.9) * S, delay: 0.08 + R() * 0.25, life: (2.2 + R() * 1.6) * (big ? 1.6 : 1), g: 0.12 + R() * 0.22, spin: R() * 6, mesh: R() < 0.5 ? 'ball' : 'ball2' }); }
    // C4: chamas que ficam queimando no chão
    if (big) for (let k = 0; k < 12; k++) { const a = R() * 6.283, d = 1 + R() * 5; add({ type: 'flame', o: [Math.cos(a) * d, 0, Math.sin(a) * d], r: 0.5 + R() * 0.8, delay: 0.3 + R() * 0.4, life: 3 + R() * 2.5, ph: R() * 6 }); }
    this.list.push(e); return e;
  }
  // ---------- nuvem da granada de fumaça ----------
  smokeCloud(p, o = {}) { const c = { p: p.slice(), t: 0, dur: o.dur || 15, R: o.R || 11, balls: [] };
    for (let k = 0; k < 70; k++) { const a = R() * 6.283, d = Math.sqrt(R()), h = R(); c.balls.push({ a, d, h, s: 0.55 + R() * 0.6, g: 0.26 + R() * 0.16, spin: R() * 6, wob: R() * 6, mesh: R() < 0.5 ? 'ball' : 'ball2', delay: d * 1.4 + R() * 0.4 }); }
    this.clouds.push(c); return c; }
  // raio atual da nuvem (para a visão dos robôs/NPCs) e densidade no ponto (0..1)
  cloudR(c) { const t = c.t; return c.R * clamp01(t / 2.6) * (t > c.dur - 2 ? Math.max(0.4, (c.dur - t) / 2) : 1); }
  densityAt(x, y, z) { let d = 0; for (const c of this.clouds) { const r = this.cloudR(c); if (r < 1) continue; const q = Math.hypot(x - c.p[0], z - c.p[2]); const hy = y - c.p[1]; if (hy < -1 || hy > 3.4) continue; d = Math.max(d, clamp01((r - q) / 2.2) * (c.t > c.dur - 2 ? (c.dur - c.t) / 2 : 1)); } return d; }
  update(dt) {
    const w = this.g.world;
    for (const e of this.list) { e.t += dt; for (const b of e.parts) if (b.type === 'bit') { b.v[1] -= 18 * dt; b.p[0] += b.v[0] * dt; b.p[1] += b.v[1] * dt; b.p[2] += b.v[2] * dt; const h = w.height(b.p[0], b.p[2]); if (b.p[1] < h + b.r) { b.p[1] = h + b.r; b.v[1] *= -0.25; b.v[0] *= 0.5; b.v[2] *= 0.5; } } }
    this.list = this.list.filter((e) => e.t < e.dur);
    for (const c of this.clouds) c.t += dt; this.clouds = this.clouds.filter((c) => c.t < c.dur);
  }
  render(items) {
    if (!this.list.length && !this.clouds.length) return; const m = this._meshes();
    for (const e of this.list) { const t = e.t, P = e.p;
      for (const b of e.parts) {
        if (b.type === 'core') { const k = t / b.life; if (k >= 1) continue; const s = b.r * (k < 0.18 ? Math.pow(k / 0.18, 0.5) : 1 - (k - 0.18) / 0.82 * 0.55); const heat = 1 - k; const c = [lerp(b.c[0], 0.5, k * 0.6), lerp(b.c[1], 0.15, k), lerp(b.c[2], 0.05, k)];
          const br = 0.1 + heat * 0.2; items.push({ mesh: m['f' + b.mesh], model: mat4.compose([P[0] + b.o[0] * (0.6 + k), P[1] + b.o[1] + k * 0.8, P[2] + b.o[2] * (0.6 + k)], b.spin + t, s), tint: [c[0] * br, c[1] * br, c[2] * br, 1], shadow: false, fogMul: 0.25, alpha: k > 0.7 ? Math.max(0.05, (1 - k) / 0.3) : 1 }); }
        else if (b.type === 'spike') { const k = t / b.life; if (k >= 1) continue; const L = b.len * (k < 0.2 ? k / 0.2 : 1 + (k - 0.2) * 0.4), wd = b.w * (1 - k * 0.6); const o = [P[0] + b.dir[0] * b.off, P[1] + 0.3 + b.dir[1] * b.off, P[2] + b.dir[2] * b.off];
          items.push({ mesh: m.spike, model: aim(o, b.dir, L, wd), tint: [b.c[0] * (0.1 + 0.2 * (1 - k)), b.c[1] * (0.1 + 0.2 * (1 - k)), b.c[2] * (0.1 + 0.2 * (1 - k)), 1], shadow: false, fogMul: 0.25, alpha: k > 0.6 ? Math.max(0.05, (1 - k) / 0.4) : 1 }); }
        else if (b.type === 'bit') { const k = t / b.life; if (k >= 1) continue; const hk = b.hot ? 0.08 + 0.25 * (1 - k) : 1; items.push({ mesh: b.hot ? m.fchunk : m.chunk, model: mat4.compose(b.p, b.spin + t * b.ws, b.r, t * b.ws * 0.7), tint: [b.c[0] * hk, b.c[1] * hk, b.c[2] * hk, 1], shadow: false, fogMul: b.hot ? 0.3 : 1 }); }
        else if (b.type === 'smoke') { const tt = t - b.delay; if (tt <= 0) continue; const k = tt / b.life; if (k >= 1) continue; const s = lerp(b.r0, b.r1, Math.pow(k, 0.5)); const y = b.o[1] + b.up * tt * (1 - k * 0.4);
          const glow = Math.max(0, 1 - tt * 2.2); const g = b.g;
          items.push({ mesh: m[b.mesh], model: mat4.compose([P[0] + b.o[0] + b.drift[0] * tt, P[1] + y, P[2] + b.o[2] + b.drift[1] * tt], b.spin + tt * 0.3, s), tint: [g * 0.45 + glow * 0.5, g * 0.45 + glow * 0.2, g * 0.45 + glow * 0.05, 1], emissive: glow * 0.4, shadow: false, alpha: Math.min(1, (1 - k) * 2.5) }); }
        else if (b.type === 'flame') { const tt = t - b.delay; if (tt <= 0 || tt > b.life) continue; const k = tt / b.life; const fl = 0.75 + 0.25 * Math.sin(t * 17 + b.ph) + 0.1 * Math.sin(t * 31 + b.ph * 2); const s = b.r * fl * (k > 0.7 ? (1 - k) / 0.3 : Math.min(1, tt * 4));
          const h = this.g.world.height(P[0] + b.o[0], P[2] + b.o[2]);
          items.push({ mesh: m.spike, model: aim([P[0] + b.o[0], h, P[2] + b.o[2]], [Math.sin(t * 3 + b.ph) * 0.15, 1, Math.cos(t * 2.5 + b.ph) * 0.15], s * 2.6, s * 1.3), tint: [0.27, 0.1 + fl * 0.05, 0.012, 1], shadow: false, fogMul: 0.3 });
          items.push({ mesh: m.fball, model: mat4.compose([P[0] + b.o[0], h + s * 0.35, P[2] + b.o[2]], t + b.ph, s * 0.7), tint: [0.3, 0.17, 0.02, 1], shadow: false, fogMul: 0.3 }); }
      }
    }
    for (const c of this.clouds) { const r = this.cloudR(c), fade = c.t > c.dur - 2 ? (c.dur - c.t) / 2 : 1;
      for (const b of c.balls) { const tt = c.t - b.delay * 0.4; if (tt <= 0) continue; const d = b.d * r, x = c.p[0] + Math.cos(b.a + c.t * 0.02) * d, z = c.p[2] + Math.sin(b.a + c.t * 0.02) * d; const hmax = 2.0 * (1 - b.d * 0.45); // nuvem baixa: cobre a área onde caiu, na altura de uma pessoa
        const y = c.p[1] + 0.2 + b.h * hmax + Math.sin(c.t * 0.6 + b.wob) * 0.15; const s = Math.max(0.3, (1.15 + r * 0.06) * b.s * (1.1 - b.d * 0.35) * Math.min(1, tt * 1.5));
        items.push({ mesh: this.m ? this.m[b.mesh] : m.ball, model: mat4.compose([x, y, z], b.spin + c.t * 0.05, s), tint: [b.g * 0.72, b.g * 0.72, b.g * 0.75, 1], shadow: false, alpha: Math.min(0.97, 0.97 * fade), fogMul: 0.35 }); } }
  }
}
