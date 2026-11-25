// Geração do mundo (ilha de ~10 km): terreno procedural com montanhas, rios, lagos e praias; várias cidades,
// vilarejos, indústrias e bases militares ligados por estradas; cavernas e distribuição de recursos.
// O terreno fino (3 m) é gerado por blocos de 192 m sob demanda; um grid grosso (24 m) cobre a ilha inteira
// para o horizonte e para o mapa. Objetos (árvores, rochas, etc.) são gerados por bloco de forma determinística.
import { makeNoise, rng, smoothstep, lerp, clamp } from '../engine/math.js';
import { hex } from '../engine/mesh.js';
import { MAP } from './mapdata.js';
import { interiorLoot } from './interiors.js';
import { suburbPlan } from './houses.js';
import { PITCH, HC, ladderWorld } from './town.js';

export const CELL = 3, TC = 64, TILE = TC * CELL, TILES = 54, SIZE = TILE * TILES, HALF = SIZE / 2, WATER = 0;
const digKey = (gi, gj) => gj * (TC * TILES + 1) + gi;
export const CC = 24, NC = SIZE / CC + 1; // grid grosso
export const ISL = 4700; // raio médio da ilha
export const WALL = 5050; // parede invisível nos limites do mapa
const dec = (b) => Uint8Array.from(atob(b), (c) => c.charCodeAt(0));
const CH = {}; for (const k of ['land', 'snow', 'desert', 'swamp', 'rock', 'peak', 'mesa']) CH[k] = dec(MAP[k]);
export const RUINS = { x: 0, z: 0, r: 120 }; // cidade inicial (preenchida na geração)
const FC = 256, FN = Math.ceil(SIZE / FC); // índice espacial de feições
const VL = 46; // meia rua principal dos vilarejos

export function segDist(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az; const t = clamp(((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz || 1), 0, 1);
  return [Math.hypot(px - ax - dx * t, pz - az - dz * t), t];
}
const CITY_NAMES = ['Porto Cinza']; // a cidade inicial; as demais têm região própria em _findSites
const VILLAGE_NAMES = ['Pedra Alta', 'do Moinho', 'Três Pinheiros', 'Boa Vista', 'das Flores', 'Rio Seco', 'São Bento', 'Lagoa Azul', 'Campo Verde', 'Serra Baixa'];
const IND_NAMES = ['Siderúrgica Norte', 'Fábrica Têxtil', 'Refinaria Leste', 'Complexo Químico'];
const MIL_NAMES = ['Base militar Alfa', 'Base militar Bravo', 'Base militar Charlie', 'Base militar Delta'];
const LAB_NAMES = ['Laboratório Ômega', 'Laboratório Gênesis', 'Laboratório Fênix', 'Laboratório Aurora'];
export const TOXIC = { x: 1083, z: 1790, r: 640, city: 250 }; // a maior cidade, tomada pela névoa tóxica

// cidade em grade: N×N quadras de PITCH m; half = meia largura até o eixo das ruas externas
function cityShape(st, N) { st.N = N; st.half = N * PITCH / 2; st.cr = Math.cos(st.rot); st.sr = Math.sin(st.rot); st.r = (st.half + HC) * 1.15; st.rb = (st.half + HC + 4) * 1.42; }
class Heap { constructor() { this.k = []; this.p = []; } get size() { return this.k.length; }
  push(k, p) { const K = this.k, P = this.p; let i = K.length; K.push(k); P.push(p); while (i > 0) { const pa = (i - 1) >> 1; if (P[pa] <= p) break; K[i] = K[pa]; P[i] = P[pa]; i = pa; } K[i] = k; P[i] = p; }
  pop() { const K = this.k, P = this.p; const rk = K[0], rp = P[0]; const lk = K.pop(), lp = P.pop(); const n = K.length; if (n) { let i = 0; for (;;) { let c = 2 * i + 1; if (c >= n) break; if (c + 1 < n && P[c + 1] < P[c]) c++; if (P[c] >= lp) break; K[i] = K[c]; P[i] = P[c]; i = c; } K[i] = lk; P[i] = lp; } this.rp = rp; return rk; } }
export class World {
  constructor(seed = 1337) {
    this.seed = seed; this.noise = makeNoise(seed); this.rand = rng(seed + 7);
    this.fidx = Array.from({ length: FN * FN }, () => ({ mtn: [], riv: [], lakes: [], sites: [], roads: [], caves: [], falls: [] }));
    this.caves = []; this.buildings = []; this.sites = []; this.roadSegs = []; this.props = []; this.crateSpots = []; this.specials = [];
    this.tiles = new Map(); this._lt = null; this.tick = 0;
    // objetos atualmente carregados (o streaming adiciona/remove por bloco)
    this.trees = []; this.rocks = []; this.bushes = []; this.pickups = []; this.hives = [];
    this.digs = new Map(); // buracos cavados: índice global do vértice → profundidade (m)
    this.mods = { trees: new Map(), treeHp: new Map(), rocks: new Map(), bushes: new Map(), pickups: new Map(), hives: new Map() };
    const t0 = performance.now();
    this._genFeatures(); this._findCaves(); this._findSites(); this._genRoadNet(); this._genCoarse();
    this.spawn = this._findSpawn();
    this._genSettlements(); this.crates = this.crateSpots.map((t, i) => ({ ...t, id: i, looted: false, regrowAt: 0 }));
    this.genMs = performance.now() - t0;
  }
  // ---------- índice espacial ----------
  _fcell(x, z) { const i = clamp(Math.floor((x + HALF) / FC), 0, FN - 1), j = clamp(Math.floor((z + HALF) / FC), 0, FN - 1); return this.fidx[j * FN + i]; }
  _idx(key, item, x0, z0, x1, z1) {
    const i0 = clamp(Math.floor((x0 + HALF) / FC), 0, FN - 1), i1 = clamp(Math.floor((x1 + HALF) / FC), 0, FN - 1), j0 = clamp(Math.floor((z0 + HALF) / FC), 0, FN - 1), j1 = clamp(Math.floor((z1 + HALF) / FC), 0, FN - 1);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) this.fidx[j * FN + i][key].push(item);
  }
  _idxSeg(key, s, pad) { this._idx(key, s, Math.min(s[0], s[2]) - pad, Math.min(s[1], s[3]) - pad, Math.max(s[0], s[2]) + pad, Math.max(s[1], s[3]) + pad); }

  // ---------- montanhas, rios e lagos ----------
  // amostra bilinear de um canal do mapa de referência (0..1; 'land' = distância à costa em metros)
  ch(k, x, z) {
    const fx = clamp((x - MAP.x0) / MAP.cell, 0, MAP.w - 1.001), fz = clamp((z - MAP.z0) / MAP.cell, 0, MAP.h - 1.001); const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j, A = CH[k], W = MAP.w;
    const val = lerp(lerp(A[j * W + i], A[j * W + i + 1], u), lerp(A[(j + 1) * W + i], A[(j + 1) * W + i + 1], u), v);
    if (k === 'land') { const out = Math.max(0, Math.abs(x) - SIZE / 2 + 400, Math.abs(z) - (MAP.h - 1) * MAP.cell / 2 + 200); return (val - 128) * 8 - out * 3; }
    return val / 255;
  }
  biome(x, z) { const d = this.ch('desert', x, z), s = this.ch('snow', x, z), w = this.ch('swamp', x, z); return s > 0.5 ? 'snow' : d > 0.5 ? 'desert' : w > 0.5 ? 'swamp' : 'forest'; }
  _genFeatures() {
    // montanhas (para as cavernas): picos do canal 'peak' e morros rochosos
    const M = []; const step = 160;
    for (let z = MAP.z0; z < -MAP.z0; z += step) for (let x = MAP.x0; x < -MAP.x0; x += step) { const p = this.ch('peak', x, z), rk = this.ch('rock', x, z); const v = Math.max(p, rk * 0.8); if (v < 0.55) continue;
      if (M.some((m) => Math.hypot(m.x - x, m.z - z) < 600)) continue; M.push({ x, z, r: p > 0.5 ? 520 : 300, h: p > 0.5 ? 150 : 50 }); }
    this.mtn = M; this.startDir = [0, 1];
    this.rivers = MAP.rivers.map((r) => r.map(([x, z]) => [x, z]));
    this.rivers.forEach((pts, ri) => { for (let i = 0; i < pts.length - 1; i++) this._idxSeg('riv', [pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], i / (pts.length - 1), (i + 1) / (pts.length - 1), ri], 260); });
    this.lakes = MAP.lakes.map(([x, z, r]) => ({ x, z, r: Math.max(40, r * 0.85) })); for (const l of this.lakes) this._idxLake(l);
    this.falls = []; this._genHydro();
  }
  _idxLake(l) { this._idx('lakes', l, l.x - l.r * 1.6 - 30, l.z - l.r * 1.6 - 30, l.x + l.r * 1.6 + 30, l.z + l.r * 1.6 + 30); }
  _idxRiver(pts, ri, t0 = 0, t1 = 1) { for (let i = 0; i < pts.length - 1; i++) this._idxSeg('riv', [pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], t0 + (t1 - t0) * i / (pts.length - 1), t0 + (t1 - t0) * (i + 1) / (pts.length - 1), ri], 260); }
  // hidrografia extra: rios que descem dos morros até o mar (ou outro rio), lagos (também onde um rio empoça) e cachoeiras
  _genHydro() {
    const r = rng(this.seed + 55); const H = (x, z) => this.baseHeight(x, z, true); const far = (x, z, d) => Math.hypot(x - TOXIC.x, z - TOXIC.z) > TOXIC.r + d;
    const chaikin = (P, it = 2) => { for (let n = 0; n < it; n++) { const q = [P[0]]; for (let i = 0; i < P.length - 1; i++) { const [a, b] = [P[i], P[i + 1]]; q.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]); } q.push(P[P.length - 1]); P = q; } return P; };
    // 1) rios novos: da nascente nos morros, descendo pelo terreno
    let made = 0;
    for (let att = 0; att < 700 && made < 7; att++) {
      const x = MAP.x0 + r() * -2 * MAP.x0, z = MAP.z0 + r() * -2 * MAP.z0;
      if (this.ch('land', x, z) < 500 || this.ch('desert', x, z) > 0.25 || this.ch('snow', x, z) > 0.35 || this.ch('peak', x, z) > 0.3 || !far(x, z, 250)) continue;
      const h0 = H(x, z); if (h0 < 14 || h0 > 55 || this.riverDist(x, z)[0] < 450) continue;
      const pts = [[x, z]]; let px = x, pz = z, ph = h0, dir = null, end = null;
      for (let k = 0; k < 180; k++) { let best = null;
        for (let a = 0; a < 16; a++) { const ang = a / 16 * 6.2832, dx = Math.cos(ang), dz = Math.sin(ang); const al = dir ? dx * dir[0] + dz * dir[1] : 1; if (al < 0.3) continue; const nx = px + dx * 45, nz = pz + dz * 45; const nh = H(nx, nz); const sc = nh - al * 0.9; if (!best || sc < best.sc) best = { nx, nz, nh, sc, d: [dx, dz] }; }
        if (!best) break; if (best.nh > ph + 0.8) { end = 'lake'; break; }
        pts.push([best.nx, best.nz]); px = best.nx; pz = best.nz; ph = Math.min(ph, best.nh); dir = best.d;
        if (best.nh < 0.3 || this.inLake(px, pz, -8)) { end = 'mar'; break; } if (this.riverDist(px, pz)[0] < 22) { end = 'rio'; break; } if (!far(px, pz, 60)) break; }
      if (!end || pts.length < 16) continue;
      if (end === 'lake') { const l = { x: px, z: pz, r: 55 + r() * 35 }; if (this.inLake(px, pz, l.r * 2) || !far(px, pz, l.r + 100)) continue; this.lakes.push(l); this._idxLake(l); }
      const P = chaikin(pts); const ri = this.rivers.length; this.rivers.push(P); this._idxRiver(P, ri, 0, 0.45); made++; }
    // 2) lagos nas baixadas
    let nl = 0;
    for (let att = 0; att < 900 && nl < 10; att++) { const x = MAP.x0 + r() * -2 * MAP.x0, z = MAP.z0 + r() * -2 * MAP.z0;
      if (this.ch('land', x, z) < 380 || this.biome(x, z) !== 'forest' || !far(x, z, 300)) continue; const h = H(x, z); if (h < 3 || h > 13) continue;
      const rr = 50 + r() * 60; if (this.riverDist(x, z)[0] < rr + 120 || this.inLake(x, z, rr * 2 + 150)) continue;
      let ok = true; for (let q = 0; q < 8; q++) if (H(x + Math.cos(q * 0.785) * rr * 1.6, z + Math.sin(q * 0.785) * rr * 1.6) > 22) ok = false; if (!ok) continue;
      const l = { x, z, r: rr }; this.lakes.push(l); this._idxLake(l); nl++; }
    // 3) cachoeiras: um paredão na beira de um rio; em cima, um laguinho alimentado por um riacho; embaixo, o poço no rio
    const cands = [];
    this.rivers.forEach((pts, ri) => { for (let i = 2; i < pts.length - 2; i += 2) { const [sx, sz] = pts[i]; const tx = pts[i + 1][0] - pts[i - 1][0], tz = pts[i + 1][1] - pts[i - 1][1], L = Math.hypot(tx, tz) || 1; const nx = -tz / L, nz = tx / L;
      if (this.ch('desert', sx, sz) > 0.2 || this.ch('snow', sx, sz) > 0.12 || this.ch('land', sx, sz) < 250 || !far(sx, sz, 200)) continue;
      for (const sd of [-1, 1]) for (let d = 30; d <= 72; d += 6) { const lx = sx + nx * sd * d, lz = sz + nz * sd * d; const hN = this.baseHeight(lx, lz, true, true); if (hN < 9) continue; if (hN > 30) break;
        const hOut = this.baseHeight(lx + nx * sd * 25, lz + nz * sd * 25, true, true); if (hOut < hN - 1.5) break; cands.push({ x: lx, z: lz, y: Math.round(hN), ux: -nx * sd, uz: -nz * sd, sx, sz, d, sc: hN - d * 0.12 + r() * 4 }); break; } } });
    cands.sort((a, b) => b.sc - a.sc);
    for (const c of cands) { if (this.falls.length >= 8) break; if (this.falls.some((f) => Math.hypot(f.x - c.x, f.z - c.z) < 750)) continue; if (this.caves.some((cv) => Math.hypot(cv.x - c.x, cv.z - c.z) < 120)) continue;
      const f = { id: this.falls.length, x: c.x, z: c.z, y: c.y, ws: c.y - 0.3, ux: c.ux, uz: c.uz, pr: 7, width: 4.2 + r() * 1.6, height: c.y };
      f.px = c.x - c.ux * (f.pr + 1.5); f.pz = c.z - c.uz * (f.pr + 1.5);
      // poço embaixo: um braço curto do rio até o pé do paredão
      const fx = c.x + c.ux * 4.5, fz = c.z + c.uz * 4.5; const spur = [[fx, fz], [(fx + c.sx) / 2, (fz + c.sz) / 2], [c.sx, c.sz]]; const ri = this.rivers.length; this.rivers.push(spur); this._idxRiver(spur, ri, 0, 0.08);
      // riacho: sobe a encosta a partir do laguinho (nível da água sempre subindo)
      const st = [[f.px, f.pz, f.ws]]; let dx = -c.ux, dz = -c.uz, x = f.px - c.ux * f.pr, z = f.pz - c.uz * f.pr, ys = f.ws;
      for (let k = 0; k < 22; k++) { let best = null; for (let a = -3; a <= 3; a++) { const ang = Math.atan2(dz, dx) + a * 0.22; const ex = Math.cos(ang), ez = Math.sin(ang); const nh = this.baseHeight(x + ex * 12, z + ez * 12, true, true); if (!best || nh > best.nh) best = { nh, ex, ez }; }
        const ny = best.nh - 0.45; if (ny < ys + 0.12 || ny > f.y + 28) break; x += best.ex * 12; z += best.ez * 12; ys = ny; dx = best.ex; dz = best.ez; st.push([x, z, ys]); }
      f.stream = st.length >= 4 ? st : [];
      let x0 = Math.min(c.x, f.px) - 80, z0 = Math.min(c.z, f.pz) - 80, x1 = Math.max(c.x, f.px) + 80, z1 = Math.max(c.z, f.pz) + 80; for (const [a, b] of f.stream) { x0 = Math.min(x0, a - 10); z0 = Math.min(z0, b - 10); x1 = Math.max(x1, a + 10); z1 = Math.max(z1, b + 10); }
      this.falls.push(f); this._idx('falls', f, x0, z0, x1, z1); }
  }
  // água acima do nível do mar (laguinho e riacho das cachoeiras): devolve a altura da superfície ou null
  pondWater(x, z) { for (const f of this._fcell(x, z).falls) { if (Math.hypot(x - f.px, z - f.pz) < f.pr + 0.8) return f.ws; const st = f.stream; for (let k = 0; k < st.length - 1; k++) { const [d, t] = segDist(x, z, st[k][0], st[k][1], st[k + 1][0], st[k + 1][1]); if (d < 1.5) return st[k][2] + (st[k + 1][2] - st[k][2]) * t; } } return null; }
  _fallH(f, x, z, h) {
    const dx = x - f.x, dz = z - f.z, rad = Math.hypot(dx, dz);
    if (rad < 60) { const s = -(dx * f.ux + dz * f.uz), lat = Math.abs(dx * f.uz - dz * f.ux); const m = smoothstep(60, 34, rad) * smoothstep(17, 9, lat - Math.max(0, s) * 0.35) * smoothstep(-2.2, 0.6, s); if (m > 0) h = lerp(h, Math.max(h, f.y), m); if (s > -0.6 && s < f.pr + 2.5 && lat < 3.4) h = lerp(h, Math.min(h, f.y - 0.75), smoothstep(3.4, 2.0, lat)); }
    const pd = Math.hypot(x - f.px, z - f.pz); if (pd < f.pr + 4) h = lerp(h, Math.min(h, f.y - 1.4), smoothstep(f.pr + 4, f.pr - 0.5, pd));
    const st = f.stream; for (let k = 0; k < st.length - 1; k++) { const [d, t] = segDist(x, z, st[k][0], st[k][1], st[k + 1][0], st[k + 1][1]); if (d < 4) { const ys = st[k][2] + (st[k + 1][2] - st[k][2]) * t; h = lerp(h, Math.min(h, ys - 0.6), smoothstep(4, 1.7, d)); } }
    return h;
  }
  riverDist(x, z) {
    let best = 1e4, bt = 0;
    for (const s of this._fcell(x, z).riv) { const [d, t] = segDist(x, z, s[0], s[1], s[2], s[3]); if (d < best) { best = d; bt = s[4] + (s[5] - s[4]) * t; } }
    return [best, bt];
  }
  inLake(x, z, pad = 0) { for (const l of this._fcell(x, z).lakes) if (Math.hypot(l.x - x, l.z - z) < l.r + pad) return l; return null; }
  baseHeight(x, z, noRoads = false, noRiver = false) {
    const n = this.noise, F = this._fcell(x, z);
    const wx = x + n.fbm(x / 140, z / 140, 3) * 30, wz = z + n.fbm(z / 140 + 9, x / 140, 3) * 30;
    const sdf = this.ch('land', x, z) + n.fbm(x / 160, z / 160, 3) * 45; const island = smoothstep(-25, 30, sdf);
    const sn = this.ch('snow', x, z), de = this.ch('desert', x, z), sw = this.ch('swamp', x, z), rk = this.ch('rock', wx, wz), pk = this.ch('peak', wx, wz), me = this.ch('mesa', wx, wz);
    // relevo base (colinas suaves) + morros rochosos
    let h = 8 + n.fbm(wx / 260, wz / 260, 5) * 14 + n.fbm(x / 55, z / 55, 3) * 2.5 + n.fbm(x / 1400 + 7, z / 1400, 3) * 10;
    h += rk * rk * (n.ridged(wx / 110 + 1.3, wz / 110, 4) * 38 + 14) * (1 - de);
    // neve: planalto frio e cordilheira com picos
    h += sn * (10 + n.fbm(x / 120, z / 120, 3) * 8) + pk * (n.ridged(wx / 230 + 3.7, wz / 230, 5) * 150 + 45);
    // deserto: dunas baixas e mesas em degraus
    if (de > 0) { const dune = 9 + Math.abs(n.fbm(x / 90, z / 70, 3)) * 7 + n.fbm(x / 600, z / 600, 2) * 6; let hd = dune;
      if (me > 0.05) { const m = smoothstep(0.05, 0.4, me) * (34 + n.fbm(x / 80, z / 80, 2) * 10), t = m / 11, k = Math.floor(t); hd += (k + smoothstep(0.7, 1, t - k)) * 11; }
      h = lerp(h, hd, de); }
    // pântano: baixo e plano, encharcado
    h = lerp(h, 2.4 + n.fbm(x / 40, z / 40, 2) * 0.9, sw * 0.9);
    h = Math.max(h, 3.2 + n.fbm(x / 90, z / 90, 2) * 1.0 - sw * 1.2);
    h = lerp(-18, h, island);
    const coast = smoothstep(0.0, 0.5, island) * (1 - smoothstep(55, 150, sdf));
    h = lerp(h, Math.min(h, 1.6 + n.fbm(x / 30, z / 30, 2) * 1.2), coast * 0.85 * (1 - sn * 0.6));
    if (F.riv.length && !noRiver) { const [rd, rt] = this.riverDist(x + n.fbm(x / 60, z / 60, 2) * 10, z); const w = 12 + rt * 14;
      h = lerp(h, Math.min(h, -2.4 - rt * 1.5), smoothstep(w * 1.2, w * 0.45, rd)); h = lerp(h, Math.min(h, 1.5 + rd * 0.08), smoothstep(w * 3.2, w * 1.2, rd) * 0.75); }
    for (const l of F.lakes) { const ld = Math.hypot(x - l.x, z - l.z) + n.fbm(x / 25, z / 25, 2) * 10; h = lerp(h, Math.min(h, -3.8), smoothstep(l.r, l.r * 0.55, ld)); h = lerp(h, Math.min(h, 1.2), smoothstep(l.r * 1.5, l.r, ld) * 0.6); }
    for (const f of F.falls) h = this._fallH(f, x, z, h);
    for (const st of F.sites) { if (st.half) { const dx = x - st.x, dz = z - st.z; const lx = Math.abs(dx * st.cr - dz * st.sr), lz = Math.abs(dx * st.sr + dz * st.cr); if (lx > st.half + 45 || lz > st.half + 45) continue; // cidade: quadrado de cantos arredondados, chão plano
        const d = Math.pow(lx ** 6 + lz ** 6, 1 / 6); const f = smoothstep(st.half + 42, st.half + 9, d); if (f > 0) h = lerp(h, st.y, f); continue; }
      const f = smoothstep(st.r + 34, st.r - 4, Math.hypot(x - st.x, z - st.z)); if (f > 0) h = lerp(h, st.y + n.fbm(x / 40, z / 40, 2) * (st.kind === 'village' ? 0.15 : 0.3), f); }
    if (!noRoads) for (const s of F.roads) { const w = s[4]; const [dd, t] = segDist(x, z, s[0], s[1], s[2], s[3]); if (dd < w + 7 && s[5]) { const pr = s[5], f = t * (pr.length - 1), i = Math.min(pr.length - 2, Math.floor(f)); const yc = pr[i] + (pr[i + 1] - pr[i]) * (f - i);
      h = lerp(h, yc, smoothstep(w + 7, w * 0.5 + 1.5, dd)); } }
    return h;
  }
  height0(x, z) {
    let h = this.baseHeight(x, z);
    for (const c of this._fcell(x, z).caves) { const d = Math.hypot(x - c.x, z - c.z); const f = smoothstep(c.R + 9, c.R - 1, d); h = lerp(h, c.y, f); }
    return h;
  }
  _findCaves() {
    const r = rng(this.seed + 99);
    for (const m of this.mtn.filter((_, i) => i % 3 === 0)) for (const a0 of [r() * 6.28]) {
      let best = null;
      for (let k = 0; k < 50; k++) {
        const a = a0 + (r() - 0.5) * 0.6, rad = m.r * (0.3 + r() * 0.35); const x = m.x + Math.cos(a) * rad, z = m.z + Math.sin(a) * rad; const h = this.baseHeight(x, z);
        if (h < 14 || h > 80) continue; const ex = Math.cos(a), ez = Math.sin(a); const hOut = this.baseHeight(x + ex * 20, z + ez * 20), hIn = this.baseHeight(x - ex * 20, z - ez * 20);
        if (hOut < 0.5) continue; const score = hIn - hOut; if (!best || score > best.score) best = { x, z, h: Math.min(h, hOut + 2), score, ang: Math.atan2(ez, ex) };
      }
      if (best) { const c = { x: best.x, z: best.z, y: best.h, R: 11, H: 7.5, ent: best.ang, entHalf: 0.42, id: this.caves.length }; this.caves.push(c); this._idx('caves', c, c.x - 24, c.z - 24, c.x + 24, c.z + 24); }
    }
  }
  // ---------- assentamentos ----------
  _findSites() {
    const r = rng(this.seed + 21); const out = [];
    const flatAt = (x, z, rad) => { const hc = this.baseHeight(x, z); if (hc < 3.5 || hc > 42) return null; let v = 0, mn = hc;
      for (let q = 0; q < 8; q++) { const hh = this.baseHeight(x + Math.cos(q * 0.785) * rad, z + Math.sin(q * 0.785) * rad); v += (hh - hc) ** 2; mn = Math.min(mn, hh); } return mn < 2.5 ? null : { y: hc, v }; };
    const free = (x, z, rad, sep, riverOk) => Math.hypot(x - TOXIC.x, z - TOXIC.z) > TOXIC.r + rad + 120 && !out.some((o) => Math.hypot(o.x - x, o.z - z) < (o.rb || o.r) + rad + (o.kind === 'city' || sep > 600 ? sep : 380)) && (riverOk || this.riverDist(x, z)[0] > rad + 30) && !this.inLake(x, z, rad * 1.6 + 25) && !this.caves.some((c) => Math.hypot(c.x - x, c.z - z) < c.R + rad + 40) && !this.falls.some((f) => Math.hypot(f.x - x, f.z - z) < rad + 130);
    const place = (kind, name, rad0, sep, tx, tz, spread, o = {}) => {
      let best = null; let N = 0, rad = rad0; if (kind === 'city') { N = o.N || Math.max(2, Math.round(rad0 * 1.65 / PITCH)); rad = (N * PITCH / 2 + 8) * 1.3; } // cidade: N×N quadras
      for (let k = 0; k < (o.pred ? 2600 : 900); k++) {
        let x, z; if (tx !== undefined) { const a = k * 2.39996, d = Math.sqrt(k) * spread; x = tx + Math.cos(a) * d; z = tz + Math.sin(a) * d; }
        else { x = MAP.x0 + r() * -2 * MAP.x0; z = MAP.z0 + r() * -2 * MAP.z0; }
        if (this.ch('land', x, z) < rad + (o.minLand ?? 120) || this.ch('peak', x, z) > 0.2 || (kind === 'city' && !o.pred && (this.ch('snow', x, z) > 0.3 || this.ch('swamp', x, z) > 0.3))) continue;
        if (o.pred && !o.pred(x, z, rad)) continue; if (!free(x, z, rad, sep, o.riverOk)) continue; const f = flatAt(x, z, rad); if (!f) continue; const score = f.v + (tx !== undefined ? Math.hypot(x - tx, z - tz) * 0.05 : 0);
        if (!best || score < best.score) best = { x, z, y: f.y, score }; if (best.score < 25 || (tx === undefined && k > 60 && best.score < 80)) break;
      }
      if (best) { const st = { kind, name, x: best.x, z: best.z, y: Math.max(4, best.y), r: rad, rot: r() * Math.PI }; if (N) cityShape(st, N); out.push(st); }
      return best;
    };
    // cidade inicial: perto da costa sudoeste
    // cidade inicial: península sudoeste do mapa
    const sx = (440 - 661) * (SIZE / 1322), sz = (955 - 595) * (SIZE / 1322);
    place('city', CITY_NAMES[0], 120, 1500, sx, sz, 14, { N: 7 });
    { const c = out[0]; let best = null; for (let k = 0; k < 32; k++) { const a = k / 32 * 6.283; for (let d = 100; d < 2500; d += 25) if (this.baseHeight(c.x + Math.cos(a) * d, c.z + Math.sin(a) * d) < 0.3) { if (!best || d < best[1]) best = [a, d]; break; } }
      this.startDir = best ? [Math.cos(best[0]), Math.sin(best[0])] : [0, 1]; this.coastStart = best ? best[1] : 0; }
    // a maior cidade do jogo: zona tóxica (posição fixa, marcada no mapa)
    { const st = { kind: 'city', toxic: true, name: 'Cidade Central', x: TOXIC.x, z: TOXIC.z, y: Math.max(6, Math.min(30, this.baseHeight(TOXIC.x, TOXIC.z))), r: TOXIC.city, rot: 0.18 }; cityShape(st, 12); out.push(st); }
    { const tc = out[out.length - 1], a = 2.2, d = TOXIC.city * 0.58; out.push({ kind: 'military', toxic: true, name: 'Base Militar Central', x: tc.x + Math.cos(a) * d, z: tc.z + Math.sin(a) * d, y: tc.y, r: 62, rot: 0.18 }); } // base militar dentro da névoa (lança-foguetes)
    // cidades com região própria (o nome combina com o lugar); se a região não existir, cai no lugar mais parecido
    { const ch = (k) => (x, z) => this.ch(k, x, z); const coast = (x, z, rad) => { for (let q = 0; q < 12; q++) { const a = q * 0.5236; if (this.baseHeight(x + Math.cos(a) * (rad + 160), z + Math.sin(a) * (rad + 160)) < 0.3) return true; } return false; };
      const R = (x, z) => this.riverDist(x, z)[0]; const C = [
        ['Norte Frio', 85, { pred: (x, z) => ch('snow')(x, z) > 0.55 }], ['Valeseca', 90, { pred: (x, z) => ch('desert')(x, z) > 0.6 }], ['Brejo Fundo', 75, { pred: (x, z) => ch('swamp')(x, z) > 0.5 }],
        ['Cabo Torto', 70, { pred: coast, minLand: 20 }], ['Ponte Velha', 80, { pred: (x, z, rad) => R(x, z) < rad * 0.45, riverOk: true }], ['Três Rios', 85, { pred: (x, z, rad) => R(x, z) < rad + 140 && R(x, z) > rad * 0.6, riverOk: true }],
        ['Pedra Branca', 80, { pred: (x, z) => this.ch('rock', x, z) > 0.25 || this.ch('mesa', x, z) > 0.3 }], ['Serra Negra', 75, { pred: (x, z) => this.biome(x, z) === 'forest' && this.forestDensity(x, z) > 0.45 && this.baseHeight(x, z) > 12 }],
        ['Morro do Ferro', 110, { pred: (x, z) => this.baseHeight(x, z) > 22 && this.biome(x, z) !== 'snow' }], ['Cruz Alta', 105, { pred: (x, z) => Math.hypot(x, z) < 2600 }],
        ['Nova Aurora', 120, { pred: (x, z) => this.biome(x, z) === 'forest' }], ['Santa Cruz do Sul', 100, { pred: (x, z) => this.biome(x, z) === 'forest' && this.forestDensity(x, z) < 0.35 }], ['Vila Esperança', 70, {}]];
      for (const [nm, rad, o0] of C) { const o = { ...o0, N: rad >= 100 ? 7 : 6 }; const sep = rad >= 100 ? 700 : 500; if (!place('city', nm, rad, sep, undefined, undefined, 0, o)) { const o2 = { ...o, pred: undefined }; if (!place('city', nm, rad * 0.85, sep * 0.8, undefined, undefined, 0, o2)) place('city', nm, rad * 0.7, 400, undefined, undefined, 0, { minLand: 60, riverOk: o.riverOk, N: o.N }); } } }
    // laboratórios (onde ficam as roupas R.A.T): um perto da zona tóxica, fora da névoa
    { const a = 2.4; place('lab', LAB_NAMES[0], 45, 300, TOXIC.x + Math.cos(a) * (TOXIC.r + 380), TOXIC.z + Math.sin(a) * (TOXIC.r + 380), 12); }
    for (let k = 1; k < LAB_NAMES.length; k++) place('lab', LAB_NAMES[k], 45, 500);
    // sítios menores: um de cada perto da cidade inicial, o resto espalhado
    const c0 = out[0]; const near = (a, d) => [c0.x + Math.cos(a) * d, c0.z + Math.sin(a) * d]; const ia = Math.atan2(-c0.z, -c0.x);
    { const [x, z] = near(ia + 0.9, 520); place('village', 'Vilarejo ' + VILLAGE_NAMES[0], 50, 300, x, z, 10); }
    { const [x, z] = near(ia - 0.7, 600); place('industry', IND_NAMES[0], 55, 300, x, z, 10); }
    { const [x, z] = near(ia + 0.1, 1100); place('military', MIL_NAMES[0], 115, 450, x, z, 12); }
    for (let k = 1; k < VILLAGE_NAMES.length; k++) place('village', 'Vilarejo ' + VILLAGE_NAMES[k], 50, 300);
    for (let k = 1; k < IND_NAMES.length; k++) place('industry', IND_NAMES[k], 55, 300);
    for (let k = 1; k < MIL_NAMES.length; k++) place('military', MIL_NAMES[k], 115, 600);
    this.sites = out; Object.assign(RUINS, { x: c0.x, z: c0.z, r: c0.r, y: c0.y });
    out.forEach((s, i) => { s.id = i; const R = (s.rb || s.r) + 50; this._idx('sites', s, s.x - R, s.z - R, s.x + R, s.z + R); });
  }
  // rede de estradas: uma rodovia central de asfalto atravessando a ilha (sul → norte); dela saem ramais de asfalto
  // para as cidades, indústrias e bases, e estradas de terra para os vilarejos (cidades do interior) e laboratórios.
  // Os caminhos são achados por busca de menor custo numa grade de 48 m (evita água, encostas, outros sítios e cachoeiras).
  _genRoadNet() {
    const S = this.sites, segs = [], roads = (this.roads = []);
    const G = 48, GN = Math.floor(SIZE / G) + 1, gc = (i) => -HALF + i * G;
    const HG = new Float32Array(GN * GN), BC = new Float32Array(GN * GN), SC = new Int16Array(GN * GN);
    for (let j = 0; j < GN; j++) for (let i = 0; i < GN; i++) { const x = gc(i), z = gc(j), k = j * GN + i; const h = this.baseHeight(x, z, true); HG[k] = h;
      let c = 1; if (h < 0.6) c += h < -2.5 ? 90 : 14; else if (h > 48) c += (h - 48) / 4; if (this.toxicAt(x, z) > 0) c += 3;
      for (const f of this.falls) if (Math.hypot(f.x - x, f.z - z) < 95) c += 60; for (const cv of this.caves) if (Math.hypot(cv.x - x, cv.z - z) < 45) c += 30;
      const st = this.siteAt(x, z, 20); if (st) SC[k] = st.id + 1; BC[k] = c; }
    const cellOf = (x, z) => [clamp(Math.round((x + HALF) / G), 0, GN - 1), clamp(Math.round((z + HALF) / G), 0, GN - 1)];
    const NB = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
    const net = new Uint8Array(GN * GN), dist = new Float64Array(GN * GN), prev = new Int32Array(GN * GN); const netSegs = [];
    const search = (start, isGoal, own, goalXZ) => {
      dist.fill(Infinity); prev.fill(-1); const hp = new Heap(); const s0 = start[1] * GN + start[0]; dist[s0] = 0; hp.push(s0, 0);
      const heur = goalXZ ? (k) => Math.hypot(gc(k % GN) - goalXZ[0], gc((k / GN) | 0) - goalXZ[1]) : () => 0;
      while (hp.size) { const k = hp.pop(), pri = hp.rp; if (pri > dist[k] + heur(k) + 1e-6) continue;
        if (isGoal(k)) { const path = []; for (let q = k; q >= 0; q = prev[q]) path.push([gc(q % GN), gc((q / GN) | 0)]); return path.reverse(); }
        const i = k % GN, j = (k / GN) | 0;
        for (const [di, dj] of NB) { const ni = i + di, nj = j + dj; if (ni < 0 || nj < 0 || ni >= GN || nj >= GN) continue; const nk = nj * GN + ni; const L = di && dj ? G * 1.4142 : G; const g = (HG[nk] - HG[k]) / L;
          let c = L * ((BC[k] + BC[nk]) * 0.5 + g * g * 260); const sc = SC[nk]; if (sc && sc - 1 !== own) c += L * 30;
          const nd = dist[k] + c; if (nd < dist[nk]) { dist[nk] = nd; prev[nk] = k; hp.push(nk, nd + heur(nk)); } } }
      return null; };
    const rdp = (P, eps) => { if (P.length < 3) return P; let md = 0, mi = 0; const a = P[0], b = P[P.length - 1]; for (let i = 1; i < P.length - 1; i++) { const d = segDist(P[i][0], P[i][1], a[0], a[1], b[0], b[1])[0]; if (d > md) { md = d; mi = i; } } if (md < eps) return [a, b]; return [...rdp(P.slice(0, mi + 1), eps).slice(0, -1), ...rdp(P.slice(mi), eps)]; };
    const chaikin = (P, it = 2) => { for (let n = 0; n < it; n++) { if (P.length < 3) break; const q = [P[0]]; for (let i = 0; i < P.length - 1; i++) { const a = P[i], b = P[i + 1]; if (i > 0) q.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25]); if (i < P.length - 2) q.push([a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]); } q.push(P[P.length - 1]); P = q; } return P; };
    const resample = (P, maxL = 36) => { const q = [P[0]]; for (let i = 0; i < P.length - 1; i++) { const a = P[i], b = P[i + 1]; const L = Math.hypot(b[0] - a[0], b[1] - a[1]); const n = Math.max(1, Math.ceil(L / maxL)); for (let k = 1; k <= n; k++) q.push([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n]); } return q; };
    const markNet = (rd, from = 0) => { const P = rd.pts; let s = 0; for (let i = 0; i < P.length - 1; i++) { const a = P[i], b = P[i + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
        if (i >= from) { netSegs.push([a[0], a[1], b[0], b[1], rd.id, s, L]); for (let t = 0; t <= L; t += 16) { const [ci, cj] = cellOf(a[0] + (b[0] - a[0]) * t / L, a[1] + (b[1] - a[1]) * t / L); net[cj * GN + ci] = 1; } } s += L; } };
    const nearNet = (x, z) => { let best = null; for (const q of netSegs) { const [d, t] = segDist(x, z, q[0], q[1], q[2], q[3]); if (!best || d < best.d) best = { d, x: q[0] + (q[2] - q[0]) * t, z: q[1] + (q[3] - q[1]) * t, road: q[4], s: q[5] + q[6] * t }; } return best; };
    const addRoad = (o) => { o.id = roads.length; roads.push(o); return o; };
    // 1) rodovia central (pontos de passagem de sul a norte; cada trecho pela busca de menor custo)
    const WP = [[520, 3560], [640, 2600], [330, 1650], [380, 430], [330, -1000], [620, -2300], [720, -3560]];
    const snap = ([x, z]) => { for (let rr = 0; rr <= 480; rr += 24) for (let a = 0; a < (rr ? 20 : 1); a++) { const [i, j] = cellOf(x + Math.cos(a / 20 * 6.2832) * rr, z + Math.sin(a / 20 * 6.2832) * rr); const k = j * GN + i; if (BC[k] < 2.5 && !SC[k]) return [i, j]; } return cellOf(x, z); };
    { let path = []; for (let k = 0; k < WP.length - 1; k++) { const a = snap(WP[k]), b = snap(WP[k + 1]); const gk = b[1] * GN + b[0]; const p = search(a, (q) => q === gk, -1, [gc(b[0]), gc(b[1])]); if (p) path = path.concat(k ? p.slice(1) : p); }
      const pts = resample(chaikin(rdp(path, 26), 3)); markNet(addRoad({ pts, w: 10, surf: 'asph', hwy: true, kind: 'hwy' })); }
    // 2) ramais: portões de cada sítio
    const gatesOf = (st) => {
      if (st.kind === 'city') { const h = st.half, c0 = st.N % 2 ? PITCH / 2 : 0; return [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dz]) => { const g = dx ? [dx * h, c0] : [c0, dz * h], o = dx ? [dx * (h + 60), c0] : [c0, dz * (h + 60)]; return { gate: this.cityW(st, g[0], g[1]), stub: this.cityW(st, o[0], o[1]), arm: [dx, dz], local: g }; }); }
      if (st.kind === 'village') { const cr = Math.cos(st.rot), sr = Math.sin(st.rot), Wv = (lx) => [st.x + lx * cr, st.z - lx * sr]; return [1, -1].map((s) => ({ gate: Wv(s * VL), stub: Wv(s * (VL + 26)) })); }
      if (st.kind === 'military' || st.kind === 'lab') { const cr = Math.cos(st.rot), sr = Math.sin(st.rot), P = (lx, lz) => [st.x + lx * cr - lz * sr, st.z + lx * sr + lz * cr]; const R = st.kind === 'military' ? st.r - 4 : st.r - 6, ga = st.kind === 'military' ? 0.5 / 56 * 6.2832 : 6.5 / 24 * 6.2832;
        return [{ gate: P(Math.cos(ga) * R, Math.sin(ga) * R), stub: P(Math.cos(ga) * (R + 32), Math.sin(ga) * (R + 32)) }]; }
      return [0, 1, 2, 3, 4, 5, 6, 7].map((k) => { const a = k * 0.785; return { gate: [st.x + Math.cos(a) * (st.r - 8), st.z + Math.sin(a) * (st.r - 8)], stub: [st.x + Math.cos(a) * (st.r + 26), st.z + Math.sin(a) * (st.r + 26)] }; }); };
    // ruas de terra dos vilarejos
    for (const st of S) if (st.kind === 'village') { const [g1, g2] = gatesOf(st); st.street = addRoad({ pts: resample([g2.gate, g1.gate]), w: 6, surf: 'dirt', kind: 'vstreet', site: st.id, flatY: st.y }).id; }
    const rank = { city: 0, industry: 1, military: 1, lab: 2, village: 3 };
    const order = S.filter((st) => !(st.kind === 'military' && st.toxic)).map((st) => ({ st, d: Math.min(...gatesOf(st).map((g) => nearNet(g.stub[0], g.stub[1]).d)) })).sort((a, b) => rank[a.st.kind] - rank[b.st.kind] || a.d - b.d);
    for (const { st } of order) {
      const gs = gatesOf(st).map((g) => ({ ...g, nd: nearNet(g.stub[0], g.stub[1]).d })).sort((a, b) => a.nd - b.nd); const g = gs[0];
      const p = search(cellOf(g.stub[0], g.stub[1]), (k) => net[k] === 1, st.id, null); if (!p) continue;
      const last = p[p.length - 1]; const J = nearNet(last[0], last[1]);
      let mid = rdp([g.stub, ...p.slice(1, -1), [J.x, J.z]], 22); mid = chaikin(mid, 2);
      const asph = st.kind === 'city' || st.kind === 'industry' || st.kind === 'military';
      const rd = addRoad({ pts: resample([g.gate, ...mid]), w: asph ? 7 : 4.5, surf: asph ? 'asph' : 'dirt', kind: 'branch', site: st.id, startY: st.kind === 'city' || st.kind === 'village' ? st.y : undefined, joinRoad: J.road, joinS: J.s, cityGate: st.kind === 'city' });
      if (st.kind === 'city') { st.gate = { arm: g.arm, local: g.local, road: rd.id }; }
      markNet(rd, 0); if (st.kind === 'village') markNet(roads[st.street]); }
    // 3) perfil de altura suavizado de cada estrada (emendas presas à rua da cidade e à estrada de destino)
    for (const rd of roads) {
      const P = rd.pts, cum = [0]; for (let i = 1; i < P.length; i++) cum.push(cum[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1])); const L = cum[cum.length - 1];
      const n = Math.max(2, Math.ceil(L / 10) + 1), dsp = L / (n - 1); const at = (s) => { let i = 1; while (i < cum.length - 1 && cum[i] < s) i++; const t = (s - cum[i - 1]) / (cum[i] - cum[i - 1] || 1); return [P[i - 1][0] + (P[i][0] - P[i - 1][0]) * t, P[i - 1][1] + (P[i][1] - P[i - 1][1]) * t]; };
      let pr = new Float32Array(n); for (let k = 0; k < n; k++) { const [x, z] = at(k * dsp); pr[k] = rd.flatY ?? Math.max(1.5, this.baseHeight(x, z, true)); }
      if (rd.flatY === undefined) for (let it = 0; it < 6; it++) { const q = pr.slice(); for (let k = 1; k < n - 1; k++) pr[k] = (q[k - 1] + q[k] * 2 + q[k + 1]) / 4; }
      if (rd.startY !== undefined) for (let k = 0; k < n; k++) { const s = k * dsp; if (s > 70) break; pr[k] = lerp(rd.startY, pr[k], smoothstep(rd.cityGate ? 55 : 8, 70, s)); }
      if (rd.joinRoad !== undefined) { const hy = roads[rd.joinRoad].profAt(rd.joinS); for (let k = n - 1; k >= 0; k--) { const s = L - k * dsp; if (s > 60) break; pr[k] = lerp(hy, pr[k], smoothstep(0, 60, s)); } }
      rd.cum = cum; rd.L = L; rd.prof = pr; rd.dsp = dsp; rd.at = at; rd.profAt = (s) => { const f = clamp(s / dsp, 0, n - 1.001), i = Math.floor(f); return pr[i] + (pr[i + 1] - pr[i]) * (f - i); };
      for (let i = 0; i < P.length - 1; i++) { const a = P[i], b = P[i + 1], Ls = cum[i + 1] - cum[i]; const m = Math.max(2, Math.ceil(Ls / 12) + 1); const q = new Float32Array(m); for (let k = 0; k < m; k++) q[k] = rd.profAt(cum[i] + Ls * k / (m - 1));
        segs.push([a[0], a[1], b[0], b[1], rd.w, q, 'road', rd.surf, rd.id]); } }
    // ruas das cidades: grade de N×N quadras (chão plano)
    for (const c of S) if (c.kind === 'city') { const h = c.half; for (let i = 0; i <= c.N; i++) { const q = -h + i * PITCH; const flat = new Float32Array([c.y, c.y]);
      const [ax, az] = this.cityW(c, q, -h), [bx, bz] = this.cityW(c, q, h), [cx, cz] = this.cityW(c, -h, q), [dx, dz] = this.cityW(c, h, q); segs.push([ax, az, bx, bz, 7, flat, 'street', 'asph'], [cx, cz, dx, dz, 7, flat, 'street', 'asph']); } }
    for (const s of segs) this._idxSeg('roads', s, s[4] + 10);
    this.roadSegs = segs;
  }
  onRoad(x, z, pad = 0.5) { for (const s of this._fcell(x, z).roads) if (segDist(x, z, s[0], s[1], s[2], s[3])[0] < s[4] / 2 + pad) return true; return false; }
  siteAt(x, z, pad = 0) { for (const st of this._fcell(x, z).sites) { if (st.half) { const dx = x - st.x, dz = z - st.z; if (Math.abs(dx * st.cr - dz * st.sr) < st.half + HC + 3 + pad && Math.abs(dx * st.sr + dz * st.cr) < st.half + HC + 3 + pad) return st; } else if (Math.hypot(x - st.x, z - st.z) < st.r + pad) return st; } return null; }
  // referencial da cidade (mesma convenção de giro dos prédios): local → mundo e mundo → local
  cityW(c, lx, lz) { return [c.x + lx * c.cr + lz * c.sr, c.z - lx * c.sr + lz * c.cr]; }
  cityL(c, x, z) { const dx = x - c.x, dz = z - c.z; return [dx * c.cr - dz * c.sr, dx * c.sr + dz * c.cr]; }
  // névoa tóxica: 0 fora, 1 no miolo
  toxicAt(x, z) { const d = Math.hypot(x - TOXIC.x, z - TOXIC.z); return d > TOXIC.r ? 0 : smoothstep(TOXIC.r, TOXIC.r - 140, d); }
  cityAt(x, z, pad = 0) { const s = this.siteAt(x, z, pad); return s && s.kind === 'city' ? s : null; }
  nearestSite(x, z, kind) { let b = null, bd = 1e9; for (const s of this.sites) { if (kind && s.kind !== kind) continue; const d = Math.hypot(s.x - x, s.z - z) - s.r; if (d < bd) { bd = d; b = s; } } return b ? [b, bd] : [null, 1e9]; }

  // ---------- cores ----------
  _color(x, z, h) {
    const n = this.noise, F = this._fcell(x, z); const P = this._pal || (this._pal = { sand: hex(0xd8c69a), wetSand: hex(0xa8946a), grass1: hex(0x5d8a3a), grass2: hex(0x7a9a40), forest: hex(0x4a6a2c), dirt: hex(0x7a6448), rock: hex(0x7d776e), snow: hex(0xeef2f5), ruin: hex(0x8a8270), mud: hex(0x5a4a36), vil: hex(0x6e604a), ind: hex(0x55524c), mil: hex(0x5d5a48), asph: hex(0x3e3d3c), gravel: hex(0x6a5a44), cave: hex(0x4a453f), lawn: hex(0x5f9438), lawnT: hex(0x6e6a44), walk: hex(0xa29e94), dry: hex(0x9a9a4a), swamp: hex(0x4c5a2c), dsand: hex(0xd9a25a), dsand2: hex(0xc98a48), mesaC: hex(0x9a5634), snowB: hex(0xc9d6e2) });
    const g = n.fbm(x / 70, z / 70, 3) * 0.5 + 0.5, fd = this.forestDensity(x, z);
    let c = mixc(P.grass1, P.grass2, g); c = mixc(c, P.dry, smoothstep(0.1, 0.45, n.fbm(x / 1100 + 31, z / 1100, 3)) * 0.45); c = mixc(c, P.forest, smoothstep(0.1, 0.5, fd));
    const sn = this.ch('snow', x, z), de = this.ch('desert', x, z), sw = this.ch('swamp', x, z), me = this.ch('mesa', x, z);
    if (sw > 0.01) c = mixc(c, mixc(P.swamp, P.mud, smoothstep(0.3, 0.7, n.fbm(x / 30, z / 30, 2) * 0.5 + 0.5)), sw * 0.85);
    if (de > 0.01) { let dc = mixc(P.dsand, P.dsand2, n.fbm(x / 60, z / 60, 2) * 0.5 + 0.5); dc = mixc(dc, P.mesaC, smoothstep(0.1, 0.4, me) * smoothstep(12, 20, h)); c = mixc(c, dc, de); }
    c = mixc(c, P.dirt, smoothstep(0.62, 0.8, n.fbm(x / 25 + 3, z / 25, 2) * 0.5 + 0.5) * 0.6);
    c = mixc(c, P.rock, smoothstep(42, 66, h) * (1 - de)); c = mixc(c, mixc(P.snowB, P.snow, n.fbm(x / 40, z / 40, 2) * 0.5 + 0.5), Math.max(smoothstep(0.25, 0.6, sn) * smoothstep(1.5, 4, h), smoothstep(105, 125, h + n.fbm(x / 20, z / 20, 2) * 8)));
    const nearRiver = F.riv.length ? this.riverDist(x, z)[0] : 1e4; const fresh = nearRiver < 30 || F.lakes.length > 0;
    c = mixc(c, P.sand, smoothstep(3.0, 1.6, h) * (fresh ? 0.4 : 1)); c = mixc(c, P.mud, smoothstep(3.0, 1.2, h) * (fresh ? 0.6 : 0));
    c = mixc(c, P.wetSand, smoothstep(0.6, -0.5, h));
    for (const st of F.sites) { if (st.half) { const [lx, lz] = this.cityL(st, x, z); const dm = Math.max(Math.abs(lx), Math.abs(lz)); c = mixc(c, st.toxic ? P.lawnT : P.lawn, smoothstep(st.half + 16, st.half + 6, dm) * 0.9); continue; }
      const d = Math.hypot(x - st.x, z - st.z); if (st.kind === 'village') { c = mixc(c, P.lawn, smoothstep(st.r + 8, st.r - 10, d) * 0.7); continue; }
      const col = st.kind === 'industry' ? P.ind : P.mil; c = mixc(c, col, smoothstep(st.r + 8, st.r - 10, d) * (0.6 + 0.2 * n.noise(x * 0.2, z * 0.2))); }
    for (const s of F.roads) { const w = s[4]; const [d] = segDist(x, z, s[0], s[1], s[2], s[3]); if (s[6] === 'street') { if (d < 5.8) c = mixc(c, d < 3.7 ? P.asph : P.walk, 0.95); continue; }
      if (d < w + 2) c = mixc(c, s[7] === 'dirt' ? P.gravel : P.asph, (1 - smoothstep(w * 0.5 - 0.5, w * 0.5 + 1.5, d)) * (0.8 + 0.2 * n.noise(x * 0.4, z * 0.4))); }
    for (const cv of F.caves) { const d = Math.hypot(x - cv.x, z - cv.z); c = mixc(c, P.cave, smoothstep(cv.R + 3, cv.R - 2, d)); }
    return c;
  }
  forestDensity(x, z) { return this.noise.fbm(x / 110 + 40, z / 110, 4) * 0.8 + this.noise.fbm(x / 900 - 17, z / 900, 3) * 0.75 + 0.1; }

  // ---------- grid grosso (horizonte e mapa) ----------
  _genCoarse() {
    const H = (this.coarse = new Float32Array(NC * NC)), Cc = (this.coarseCol = new Float32Array(NC * NC * 3));
    for (let j = 0; j < NC; j++) for (let i = 0; i < NC; i++) H[j * NC + i] = this.baseHeight(-HALF + i * CC, -HALF + j * CC);
    for (let j = 0; j < NC; j++) for (let i = 0; i < NC; i++) { const x = -HALF + i * CC, z = -HALF + j * CC; Cc.set(this._color(x, z, H[j * NC + i]), (j * NC + i) * 3); }
  }
  coarseHeight(x, z) {
    const fx = clamp((x + HALF) / CC, 0, NC - 1.001), fz = clamp((z + HALF) / CC, 0, NC - 1.001); const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j, H = this.coarse;
    return lerp(lerp(H[j * NC + i], H[j * NC + i + 1], u), lerp(H[(j + 1) * NC + i], H[(j + 1) * NC + i + 1], u), v);
  }
  // ---------- blocos finos ----------
  tileAt(x, z) { return [clamp(Math.floor((x + HALF) / TILE), 0, TILES - 1), clamp(Math.floor((z + HALF) / TILE), 0, TILES - 1)]; }
  tile(ti, tj) {
    const k = tj * TILES + ti; let t = this.tiles.get(k); if (t) { t.used = this.tick; return t; }
    const P = TC + 1, E = TC + 3; const x0 = -HALF + ti * TILE, z0 = -HALF + tj * TILE; const ext = new Float32Array(E * E);
    for (let j = 0; j < E; j++) for (let i = 0; i < E; i++) ext[j * E + i] = this.height0(x0 + (i - 1) * CELL, z0 + (j - 1) * CELL);
    const dug = this.digs.size ? new Map() : null; if (dug) for (let j = 0; j < E; j++) for (let i = 0; i < E; i++) { const d = this.digs.get(digKey(ti * TC + i - 1, tj * TC + j - 1)); if (d) { ext[j * E + i] -= d; dug.set(j * E + i, d); } }
    const H = new Float32Array(P * P), Nm = new Float32Array(P * P * 3), Co = new Float32Array(P * P * 3);
    for (let j = 0; j < P; j++) for (let i = 0; i < P; i++) {
      const e = (j + 1) * E + i + 1, h = ext[e]; H[j * P + i] = h; let nx = ext[e - 1] - ext[e + 1], ny = 2 * CELL, nz = ext[e - E] - ext[e + E]; const l = Math.hypot(nx, ny, nz);
      Nm[(j * P + i) * 3] = nx / l; Nm[(j * P + i) * 3 + 1] = ny / l; Nm[(j * P + i) * 3 + 2] = nz / l; Co.set(this._color(x0 + i * CELL, z0 + j * CELL, h), (j * P + i) * 3);
      if (dug) { const d = dug.get(e); if (d) { const de = this.ch('desert', x0 + i * CELL, z0 + j * CELL) > 0.5; const dc = de ? [0.72, 0.6, 0.4] : [0.42, 0.32, 0.22]; const m = Math.min(1, d / 1.2), o = (j * P + i) * 3; for (let a = 0; a < 3; a++) Co[o + a] = Co[o + a] * (1 - m) + dc[a] * m * (1 - Math.min(0.35, d * 0.05)); } }
    }
    let mn = 1e9, mx = -1e9; for (const h of H) { mn = Math.min(mn, h); mx = Math.max(mx, h); }
    t = { ti, tj, k, x0, z0, H, Nm, Co, miny: mn, maxy: mx, pin: 0, used: this.tick }; this.tiles.set(k, t);
    if (this.tiles.size > 220) { const old = [...this.tiles.values()].filter((q) => !q.pin && q !== t).sort((a, b) => a.used - b.used); for (const q of old.slice(0, this.tiles.size - 180)) this.tiles.delete(q.k); if (this._lt && !this.tiles.has(this._lt.k)) this._lt = null; }
    return t;
  }
  // ---------- cavar (picareta): baixa um vértice da grade de 3 m; refaz os blocos tocados ----------
  digVertex(x, z) { const gi = Math.round((x + HALF) / CELL), gj = Math.round((z + HALF) / CELL); return { gi, gj, x: -HALF + gi * CELL, z: -HALF + gj * CELL, d: this.digs.get(digKey(gi, gj)) || 0 }; }
  isDug(x, z) { if (!this.digs.size) return false; const fx = (x + HALF) / CELL, fz = (z + HALF) / CELL, i = Math.floor(fx), j = Math.floor(fz); return !!(this.digs.get(digKey(i, j)) || this.digs.get(digKey(i + 1, j)) || this.digs.get(digKey(i, j + 1)) || this.digs.get(digKey(i + 1, j + 1))); }
  setDig(gi, gj, d) { const k = digKey(gi, gj); if (d > 0) this.digs.set(k, d); else this.digs.delete(k); this._refreshAround(gi, gj); }
  _refreshAround(gi, gj) { const out = new Set(); for (const di of [-1, 0, 1]) for (const dj of [-1, 0, 1]) { const ti = clamp(Math.floor((gi + di) / TC), 0, TILES - 1), tj = clamp(Math.floor((gj + dj) / TC), 0, TILES - 1); out.add(tj * TILES + ti); }
    for (const k of out) this.refreshTile(k); return out; }
  refreshTile(k) { const old = this.tiles.get(k); if (!old) return; this.tiles.delete(k); this._lt = null; const nt = this.tile(k % TILES, Math.floor(k / TILES)); Object.assign(old, { H: nt.H, Nm: nt.Nm, Co: nt.Co, miny: nt.miny, maxy: nt.maxy }); this.tiles.set(k, old); this._lt = null; this.dirtyTiles = (this.dirtyTiles || new Set()).add(k); }
  loadDigs(list) { const prev = [...this.digs.keys()]; this.digs.clear(); for (const [k, d] of list || []) this.digs.set(k, d); for (const k of new Set([...prev, ...this.digs.keys()])) { const W = TC * TILES + 1; this._refreshAround(k % W, Math.floor(k / W)); } }
  hasTile(x, z) { const [ti, tj] = this.tileAt(x, z); return this.tiles.has(tj * TILES + ti); }
  // Altura exata (mesma triangulação da malha fina)
  height(x, z) {
    const fx = clamp((x + HALF) / CELL, 0, TC * TILES - 0.001), fz = clamp((z + HALF) / CELL, 0, TC * TILES - 0.001);
    const gi = Math.floor(fx), gj = Math.floor(fz); const ti = gi >> 6, tj = gj >> 6; let t = this._lt;
    if (!t || t.ti !== ti || t.tj !== tj) { t = this.tiles.get(tj * TILES + ti); if (!t) t = this.tile(ti, tj); this._lt = t; }
    const i = gi - ti * TC, j = gj - tj * TC, u = fx - gi, v = fz - gj, H = t.H, P = TC + 1;
    const h00 = H[j * P + i], h10 = H[j * P + i + 1], h01 = H[(j + 1) * P + i], h11 = H[(j + 1) * P + i + 1];
    if (u + v <= 1) return h00 + (h10 - h00) * u + (h01 - h00) * v;
    return h11 + (h01 - h11) * (1 - u) + (h10 - h11) * (1 - v);
  }
  // altura sem gerar blocos (usa o grid grosso se o bloco não estiver pronto)
  heightFast(x, z) { const [ti, tj] = this.tileAt(x, z); return this.tiles.has(tj * TILES + ti) ? this.height(x, z) : this.coarseHeight(x, z); }
  normal(x, z) { const e = 0.6; const hl = this.height(x - e, z), hr = this.height(x + e, z), hd = this.height(x, z - e), hu = this.height(x, z + e);
    const nx = hl - hr, ny = 2 * e, nz = hd - hu, l = Math.hypot(nx, ny, nz); return [nx / l, ny / l, nz / l]; }
  isSalt(x, z) { return this.riverDist(x, z)[0] > 40 && !this.inLake(x, z, 30); }
  // há construção aqui? (índice simples por célula de 32 m)
  bldAt(x, z) { const L = this._bIdx && this._bIdx.get(Math.floor(x / 32) + ',' + Math.floor(z / 32)); if (!L) return null; for (const b of L) { const dx = x - b.x, dz = z - b.z; const cr = Math.cos(b.rot), sr = Math.sin(b.rot); const lx = dx * cr - dz * sr, lz = dx * sr + dz * cr; const ex = b.w / 2 + (b.garage ? 6 : 1.5), ez = b.d / 2 + (b.porch ? 3 : 1.5); if (Math.abs(lx) < ex && Math.abs(lz) < ez + 1.5) return b; } return null; }
  ladderNear(x, z, y, d = 1.3) { let best = null, bd = d; for (const L of this.ladders) { const dd = Math.hypot(L.x - x, L.z - z); if (dd < bd && y > L.y0 - 1 && y < L.y1 + 0.5) { bd = dd; best = L; } } return best; }
  inRuins(x, z) { return !!this.siteAt(x, z, 9); }
  caveAt(x, z) { for (const c of this._fcell(x, z).caves) if (Math.hypot(x - c.x, z - c.z) < c.R - 0.3) return c; return null; }

  // ---------- objetos de um bloco (determinístico) ----------
  scatterTile(ti, tj) {
    const k = tj * TILES + ti, r = rng((this.seed * 7919 + k * 104729 + 3) >>> 0), n = this.noise; const x0 = -HALF + ti * TILE, z0 = -HALF + tj * TILE;
    const trees = [], rocks = [], bushes = [], pickups = []; let nt = 0, nr = 0, nb = 0, np = 0; const id = (c) => k * 5000 + c;
    const ok = (x, z, minH = 1.2, maxSlope = 0.82) => { const h = this.height(x, z); if (h < minH) return null; if (this.normal(x, z)[1] < maxSlope) return null;
      for (const c of this._fcell(x, z).caves) if (Math.hypot(x - c.x, z - c.z) < c.R + 4) return null; return h; };
    const STEP = TILE / 37;
    for (let a = 0; a < 37; a++) for (let b = 0; b < 37; b++) {
      const px = x0 + (b + 0.5) * STEP + (r() - 0.5) * STEP * 0.9, pz = z0 + (a + 0.5) * STEP + (r() - 0.5) * STEP * 0.9; const rr = [r(), r(), r(), r(), r()];
      const h = ok(px, pz, 1.0); if (h === null) continue;
      if (this.inRuins(px, pz)) continue;
      const fd = this.forestDensity(px, pz); const rd = this.riverDist(px, pz)[0]; const bio = this.biome(px, pz);
      if (bio === 'desert') { if (rr[0] < 0.035 && h > 2.8) trees.push({ type: 'cactus', x: px, y: h, z: pz, s: 0.7 + rr[1] * 0.6, rot: rr[2] * 6.28, id: id(nt++) }); else if (rr[0] < 0.045) trees.push({ type: 'dead', x: px, y: h, z: pz, s: 0.6 + rr[1] * 0.4, rot: rr[2] * 6.28, id: id(nt++) }); continue; }
      if (h < 2.8 && rd > 40 && !this.inLake(px, pz, 30) && bio !== 'snow' && bio !== 'swamp') { if (rr[0] < 0.09) trees.push({ type: 'palm', x: px, y: h, z: pz, s: 0.85 + rr[1] * 0.4, rot: rr[2] * 6.28, id: id(nt++) }); continue; }
      if (h > 95 || this.onRoad(px, pz, 1.5) || (this.spawn && Math.hypot(px - this.spawn.x, pz - this.spawn.z) < 7)) continue;
      const prob = (h > 2.8 || bio === 'swamp' ? clamp((fd + 0.12) * 1.45, 0, 0.7) * (h > 65 ? 0.5 : 1) + 0.03 : 0.0) * (bio === 'snow' ? 0.45 : bio === 'swamp' ? 0.6 : 1);
      if (rr[0] < prob) {
        let type = 'oak'; const tv = n.fbm(px / 50, pz / 50, 2);
        if (bio === 'snow' || h > 40) type = 'pine'; else if (bio === 'swamp') type = rr[3] < 0.45 ? 'dead' : rr[3] < 0.75 ? 'birch' : 'oak'; else if (rd < 35 && rr[3] < 0.5) type = 'birch'; else if (tv > 0.12) type = 'pine'; else if (rr[3] < 0.06) type = 'dead';
        trees.push({ type, x: px, y: h, z: pz, s: (type === 'pine' ? 0.8 : 0.75) + rr[1] * 0.55, rot: rr[2] * 6.28, id: id(nt++) });
      } else if (rr[4] < 0.05 && h > 2.5) bushes.push({ x: px + 1, y: this.height(px + 1, pz), z: pz, s: 0.8 + rr[1] * 0.5, rot: rr[2] * 6.28, berries: true, id: id(nb++) });
    }
    for (let q = 0; q < 50 && rocks.length < 18; q++) { const x = x0 + r() * TILE, z = z0 + r() * TILE, rs = [r(), r(), r(), r()]; const h = ok(x, z, 1.5, 0.6); if (h === null || this.inRuins(x, z) || this.onRoad(x, z, 1)) continue;
      if (rs[0] > (h > 25 ? 1 : 0.35)) continue; rocks.push({ x, y: h, z, s: 0.8 + rs[1] * 1.1, rot: rs[2] * 6.28, seed: Math.floor(rs[3] * 1e6), id: id(nr++) }); }
    for (let q = 0; q < 330; q++) { const x = x0 + r() * TILE, z = z0 + r() * TILE, t = r(), rs = [r(), r()]; const h = ok(x, z, 2.2); if (h === null || h > 90) continue;
      const fd = this.forestDensity(x, z);
      if (this.inRuins(x, z)) { if (t < 0.08) pickups.push({ kind: 'stone', x, y: h, z, rot: rs[0] * 6.28, id: id(np++) }); continue; }
      const bio = this.biome(x, z); if (bio === 'desert' && t > 0.27 && t > 0.4) continue; if (bio === 'swamp' && t > 0.3 && t < 0.5) { pickups.push({ kind: 'fiber', x, y: h, z, rot: rs[0] * 6.28, id: id(np++) }); continue; }
      if (t < 0.05 && bushes.length < 30 && bio !== 'snow') bushes.push({ x, y: h, z, s: 0.8 + rs[1] * 0.5, rot: rs[0] * 6.28, berries: true, id: id(nb++) });
      else if (t < 0.17 && fd > -0.05) pickups.push({ kind: 'stick', x, y: h, z, rot: rs[0] * 6.28, id: id(np++) });
      else if (t < 0.27) pickups.push({ kind: 'stone', x, y: h, z, rot: rs[0] * 6.28, id: id(np++) });
      else if (t < 0.58) pickups.push({ kind: 'fiber', x, y: h, z, rot: rs[0] * 6.28, id: id(np++) });
      else if (t < 0.61 && fd > 0.1) pickups.push({ kind: 'mushroom', x, y: h, z, rot: rs[0] * 6.28, id: id(np++) });
    }
    for (const c of this.caves) { const [ci, cj] = this.tileAt(c.x, c.z); if (ci !== ti || cj !== tj) continue; const rc = rng(c.id * 31 + 5);
      for (let q = 0; q < 7; q++) { const a = rc() * 6.28, d = 2 + rc() * (c.R - 4); const x = c.x + Math.cos(a) * d, z = c.z + Math.sin(a) * d; pickups.push({ kind: q < 4 ? 'mushroom' : 'crystal', x, y: this.height(x, z), z, rot: rc() * 6.28, id: id(np++) }); }
      for (let q = 0; q < 3; q++) { const a = c.ent + Math.PI + (rc() - 0.5) * 2, d = c.R - 3.5; const x = c.x + Math.cos(a) * d, z = c.z + Math.sin(a) * d; rocks.push({ x, y: this.height(x, z), z, s: 1.1, rot: rc() * 6.28, seed: Math.floor(rc() * 1e6), rich: true, id: id(nr++) }); } }
    const T = trees.map((t) => ({ ...t, hp: t.type === 'pine' ? 5 : 6, felled: false, regrowAt: 0 })), R = rocks.map((t) => ({ ...t, hp: t.rich ? 10 : 6, mined: false, regrowAt: 0 }));
    const B = bushes.map((t) => ({ ...t, regrowAt: 0 })), PK = pickups.map((t) => ({ ...t, taken: false, regrowAt: 0 }));
    // colmeia de abelhas robóticas: no máximo uma por bloco, em árvore de folhas largas de floresta densa
    const hives = []; const sp = this.spawn;
    if (r() < 0.4) for (const t of T) { if ((t.type !== 'oak' && t.type !== 'birch') || this.forestDensity(t.x, t.z) < 0.15) continue; if (sp && Math.hypot(t.x - sp.x, t.z - sp.z) < 50) continue;
      const a = r() * 6.28; hives.push({ id: k, tree: t, ox: Math.cos(a) * 1.15 * t.s, oz: Math.sin(a) * 1.15 * t.s, x: t.x + Math.cos(a) * 1.15 * t.s, z: t.z + Math.sin(a) * 1.15 * t.s, y: t.y + 3.6 * t.s, honey: true, regrowAt: 0, angry: 0 }); break; }
    return { trees: T, rocks: R, bushes: B, pickups: PK, hives };
  }
  // ponto de nascimento aleatório em qualquer lugar seguro da ilha (terra firme, fora de água, picos, cidades e cavernas)
  randomSpawn(rand = Math.random) {
    for (let k = 0; k < 4000; k++) {
      const x = MAP.x0 + rand() * -2 * MAP.x0, z = MAP.z0 + rand() * -2 * MAP.z0;
      if (this.ch('land', x, z) < 60 || this.ch('peak', x, z) > 0.15) continue; const h = this.height0(x, z); if (h < 2.2 || h > 40) continue;
      if (this.siteAt(x, z, 25) || this.riverDist(x, z)[0] < 30 || this.inLake(x, z, 25) || this.caves.some((c) => Math.hypot(c.x - x, c.z - z) < 40)) continue;
      const e = 1.5, sl = Math.hypot(this.height0(x + e, z) - this.height0(x - e, z), this.height0(x, z + e) - this.height0(x, z - e)) / (2 * e); if (sl > 0.25) continue;
      return { x, z, y: h, biome: this.biome(x, z) };
    }
    return { ...this.spawn, biome: 'forest' };
  }
  _findSpawn() {
    // praia: segue da cidade inicial em direção ao mar e recua até a areia firme
    const c = RUINS, sd = this.startDir; let best = null;
    for (let a = -12; a <= 12; a++) { const ang = Math.atan2(sd[1], sd[0]) + a * 0.04; const dx = Math.cos(ang), dz = Math.sin(ang); let prev = null;
      for (let d = c.r + 60; d < 3000; d += 4) { const x = c.x + dx * d, z = c.z + dz * d; const h = this.height0(x, z);
        if (h < 0.6) { if (prev) { const s = Math.abs(a) * 10 + prev.d * 0.02; if (!best || s < best.s) best = { ...prev, s }; } break; }
        if (h > 1.9 && h < 4.5 && !this.onRoad(x, z, 3)) { const e = 1.5, sl = Math.hypot(this.height0(x + e, z) - this.height0(x - e, z), this.height0(x, z + e) - this.height0(x, z - e)) / (2 * e); if (sl < 0.2) prev = { x: x - dx * 6, z: z - dz * 6, y: this.height0(x - dx * 6, z - dz * 6), d }; } } }
    return best || { x: c.x, z: c.z + c.r + 20, y: this.height0(c.x, c.z + c.r + 20) };
  }
  _genSettlements() {
    const r = rng(this.seed + 41); const B = []; const props = [];
    for (const c of this.sites) if (c.kind === 'city') this._genCity(r, c, B, props);
    this._genSites(r, B, props);
    for (const s of this.roadSegs) { if (s[6] !== 'road' || s[4] < 4) continue; const [ax, az, bx, bz, w] = s; const L = Math.hypot(bx - ax, bz - az); const yaw = Math.atan2(bx - ax, bz - az);
      for (let t = 30; t < L - 30; t += 70 + r() * 90) { if (r() < 0.45) continue; const f = t / L, side = (r() < 0.5 ? -1 : 1) * (w * 0.25 + r() * 1.2); const x = ax + (bx - ax) * f + Math.cos(yaw) * side, z = az + (bz - az) * f - Math.sin(yaw) * side;
        if (this.siteAt(x, z, 6) || this.height0(x, z) < 1.5) { r(); r(); r(); continue; }
        props.push({ kind: 'car', x, z, y: this.height0(x, z), rot: yaw - Math.PI / 2 + (r() < 0.5 ? Math.PI : 0) + (r() - 0.5) * (r() < 0.3 ? 1.6 : 0.3), seed: Math.floor(r() * 1e6), loot: r() < 0.4 }); } }
    // casas dos vilarejos também mobiliadas; contêineres militares revistáveis
    for (const b of B) if (b.style === 'house' && !b.furnish) { b.furnish = true; b.doorWall = Math.floor(r() * 4); for (const sp of interiorLoot(b)) if (!sp.special) this.crateSpots.push({ x: sp.x, z: sp.z, y: sp.y, yFix: true, rot: sp.rot, furn: sp.kind, site: sp.kind, siteId: b.siteId }); }
    for (const p of props) if (p.kind === 'container' && p.loot) { const ca = Math.cos(p.rot), sa = Math.sin(p.rot); this.crateSpots.push({ x: p.x + ca * 3.4, z: p.z - sa * 3.4, y: 0, rot: p.rot, furn: 'milcontainer', site: 'military', siteId: p.siteId }); }
    // veículos restauráveis: alguns carros das ruas viram veículos (sem pneus e motor) + 1–2 motos (só chassi) por cidade; alguns nas estradas
    { const VT = ['pickup', 'sedan', 'hatch', 'suv']; const vs = []; const take = (p, type) => { const i = props.indexOf(p); if (i >= 0) props.splice(i, 1); vs.push({ id: vs.length, type, color: Math.floor(r() * 4), x: p.x, z: p.z, y: this.height0(p.x, p.z), yaw: p.rot + Math.PI / 2 }); };
      for (const c of this.sites) if (c.kind === 'city') { const cars = props.filter((p) => p.kind === 'car' && p.siteId === c.id); for (let k = 0; k < Math.min(cars.length, c.toxic ? 3 : 6); k++) { const p = cars.splice(Math.floor(r() * cars.length), 1)[0]; take(p, k < (c.r > 100 ? 2 : 1) ? 'moto' : VT[Math.floor(r() * 4)]); } }
      const road = props.filter((p) => p.kind === 'car' && !p.site); for (let k = 0; k < road.length; k += 5) take(road[k], r() < 0.15 ? 'moto' : VT[Math.floor(r() * 4)]);
      this.vehicleSpots = vs; }
    // postos de combustível: um por cidade, à beira do ramal de asfalto logo na saída da cidade, com 2 bombas e uma lojinha
    { this.pumps = []; for (const c of this.sites) { if (c.kind !== 'city' || c.toxic || !c.gate) continue; const rd = this.roads[c.gate.road]; if (!rd || rd.L < 90) continue;
        const s0 = 52, [ax, az] = rd.at(s0), [bx, bz] = rd.at(s0 + 4); const L = Math.hypot(bx - ax, bz - az) || 1;
        const d = [(bx - ax) / L, (bz - az) / L], pp = [-d[1], d[0]]; const side = r() < 0.5 ? 1 : -1, off = rd.w / 2 + 9.5; const x = ax + pp[0] * off * side, z = az + pp[1] * off * side; const y = this.height0(x, z); if (y < 1.5) continue;
        const rot = Math.atan2(-pp[0] * side, -pp[1] * side); props.push({ kind: 'gasstation', x, z, y, rot, seed: Math.floor(r() * 1e6) }); const cr = Math.cos(rot), sr = Math.sin(rot);
        for (const [lx, lz] of [[-2, 1.45 + 1.2], [2, 1.45 + 1.2]]) this.pumps.push({ x: x + lx * cr + lz * sr, z: z - lx * sr + lz * cr, y });
        const sx = x + 3.2 * cr + (-3.4) * sr, sz = z - 3.2 * sr + (-3.4) * cr; this.crateSpots.push({ x: sx, z: sz, y: 0, rot, site: 'gasshop' }); } }
    // faixas das estradas (malha que acompanha o terreno) em pedaços de ~40 m; guard-rail onde a estrada passa sobre a água
    for (const rd of this.roads) { const s0 = rd.cityGate ? HC + 0.2 : 0; let s1 = rd.L; if (rd.joinRoad !== undefined) s1 -= this.roads[rd.joinRoad].w / 2 + 0.3; if (s1 - s0 < 4) continue;
      const n = Math.max(1, Math.round((s1 - s0) / 40)), step = (s1 - s0) / n; const site = rd.kind === 'vstreet' ? this.sites[rd.site] : null;
      for (let k = 0; k < n; k++) { const a = s0 + k * step, b = a + step; const m = Math.max(2, Math.ceil(step / 4)); const S = [];
        for (let q = 0; q <= m; q++) { const sq = a + (b - a) * q / m; const [x, z] = rd.at(sq), [x2, z2] = rd.at(Math.min(rd.L, sq + 1)), [x0, z0] = rd.at(Math.max(0, sq - 1)); const tl = Math.hypot(x2 - x0, z2 - z0) || 1; S.push([x, z, (x2 - x0) / tl, (z2 - z0) / tl, sq]); }
        const [mx, mz] = rd.at((a + b) / 2); const o = { kind: 'strip', x: mx, z: mz, y: rd.profAt((a + b) / 2), rot: 0, s: S, w: rd.w, surf: rd.surf, hwy: !!rd.hwy, toxic: this.toxicAt(mx, mz) > 0.3 }; if (site) { o.site = 'village'; o.siteId = site.id; } props.push(o); }
      let run = null; const runs = []; for (let sq = 0; sq <= rd.L; sq += 4) { const [x, z] = rd.at(sq); const wet = this.baseHeight(x, z, true) < 0.9 && !this.siteAt(x, z, 4); if (wet) { if (!run) run = [sq, sq]; run[1] = sq; } else if (run) { runs.push(run); run = null; } } if (run) runs.push(run);
      for (const [ra, rb] of runs) { const a0 = Math.max(0, ra - 8), b0 = Math.min(rd.L, rb + 8); const n2 = Math.max(1, Math.ceil((b0 - a0) / 12));
        for (let k = 0; k < n2; k++) { const sa = a0 + (b0 - a0) * k / n2, sb = a0 + (b0 - a0) * (k + 1) / n2; const [x0, z0] = rd.at(sa), [x1, z1] = rd.at(sb); const L = Math.hypot(x1 - x0, z1 - z0) || 1; const nx = -(z1 - z0) / L, nz = (x1 - x0) / L;
          for (const sd of [-1, 1]) { const off = rd.w / 2 + 0.35; props.push({ kind: 'rail', a: [x0 + nx * off * sd, z0 + nz * off * sd], b: [x1 + nx * off * sd, z1 + nz * off * sd], x: (x0 + x1) / 2 + nx * off * sd, z: (z0 + z1) / 2 + nz * off * sd, y: rd.profAt((sa + sb) / 2), rot: Math.atan2(-(z1 - z0), x1 - x0), len: L }); } } } }
    // acampamentos de saqueadores (NPCs) em lugares aleatórios: barracas, fogueira, caixas
    { const rc = rng(this.seed + 77); this.camps = []; for (let att = 0; att < 3000 && this.camps.length < 18; att++) { const x = MAP.x0 + rc() * -2 * MAP.x0, z = MAP.z0 + rc() * -2 * MAP.z0; const h = this.baseHeight(x, z);
        if (this.ch('land', x, z) < 200 || h < 3 || h > 45 || this.toxicAt(x, z) > 0 || this.siteAt(x, z, 160) || this.onRoad(x, z, 40) || this.riverDist(x, z)[0] < 40 || this.inLake(x, z, 40) || this.caves.some((c) => Math.hypot(c.x - x, c.z - z) < 80) || this.falls.some((f) => Math.hypot(f.x - x, f.z - z) < 120)) continue;
        if (this.camps.some((c) => Math.hypot(c.x - x, c.z - z) < 700)) continue; let ok = true; for (let q = 0; q < 8; q++) if (Math.abs(this.baseHeight(x + Math.cos(q * 0.785) * 10, z + Math.sin(q * 0.785) * 10) - h) > 1.6) ok = false; if (!ok) continue;
        const id = this.camps.length, camp = { id, x, z, y: h, n: 3 + Math.floor(rc() * 3), name: 'Acampamento' }; this.camps.push(camp); const sid = 'c' + id;
        props.push({ kind: 'campfire', x, z, y: this.height0(x, z), rot: 0, site: 'camp', siteId: sid });
        // cabanas de madeira e uma barraca em volta da fogueira (porta virada para o fogo)
        for (let k = 0; k < 4; k++) { const a = k * 1.571 + rc() * 0.4, d = (k < 3 ? 8.5 : 6.5) + rc() * 1.5; const tx = x + Math.cos(a) * d, tz = z + Math.sin(a) * d; const face = Math.atan2(x - tx, z - tz);
          props.push(k < 3 ? { kind: 'hut', x: tx, z: tz, y: this.height0(tx, tz), rot: face, seed: Math.floor(rc() * 1e6), site: 'camp', siteId: sid } : { kind: 'tent', x: tx, z: tz, y: this.height0(tx, tz), rot: -a + Math.PI / 2, seed: Math.floor(rc() * 1e6), site: 'camp', siteId: sid, civ: true }); }
        for (let k = 0; k < 2; k++) { const a = rc() * 6.28, d = 3 + rc() * 2; this.crateSpots.push({ x: x + Math.cos(a) * d, z: z + Math.sin(a) * d, y: 0, rot: rc() * 6.28, site: 'camp', siteId: sid }); }
        for (let k = 0; k < 3; k++) { const a = rc() * 6.28, d = 9 + rc() * 3; const bx = x + Math.cos(a) * d, bz = z + Math.sin(a) * d; props.push({ kind: 'barrel', x: bx, z: bz, y: this.height0(bx, bz), rot: 0, seed: Math.floor(rc() * 1e6), site: 'camp', siteId: sid }); } } }
    // baldes de malha por célula de 128 m (cidades grandes não viram uma malha só)
    const cellKey = (o) => `site:${o.siteId}:${Math.floor(o.x / 128)}:${Math.floor(o.z / 128)}`;
    let ci = 0; for (const p of props) { if (p.kind === 'car') { p.id = ci++; p.loot = p.loot ?? (r() < 0.4); } if (!p.site) { const [ti, tj] = this.tileAt(p.x, p.z); p.bucket = 'road:' + (tj * TILES + ti); } else p.bucket = cellKey(p); }
    for (const b of B) b.bucket = cellKey(b);
    for (const c of this.crateSpots) { if (!c.yFix) c.y = this.height0(c.x, c.z); if (this.toxicAt(c.x, c.z) > 0) c.toxic = true; }
    this.buildings = B; this.props = props; this.ladders = B.map(ladderWorld).filter(Boolean);
    this._bIdx = new Map(); for (const b of B) { const R = Math.max(b.w, b.d) / 2 + 8; for (let i = Math.floor((b.x - R) / 32); i <= Math.floor((b.x + R) / 32); i++) for (let j = Math.floor((b.z - R) / 32); j <= Math.floor((b.z + R) / 32); j++) { const k = i + ',' + j; if (!this._bIdx.has(k)) this._bIdx.set(k, []); this._bIdx.get(k).push(b); } }
    // veículos encostados em construções ficariam presos: descarta esses pontos
    this.vehicleSpots = (this.vehicleSpots || []).filter((v) => { const f = [Math.sin(v.yaw), Math.cos(v.yaw)]; for (const o of [-2.6, -1.3, 0, 1.3, 2.6]) if (this.bldAt(v.x + f[0] * o, v.z + f[1] * o)) return false; return true; }); this.vehicleSpots.forEach((v, i) => { v.id = i; });
  }
  _addBuilding(bb, B, sid, tox) { bb.doorWall = bb.doorWall ?? 0; bb.siteId = sid; if (tox) bb.toxic = true; B.push(bb);
    for (const sp of interiorLoot(bb)) { if (sp.special) this.specials.push({ id: this.specials.length, kind: sp.special, x: sp.x, z: sp.z, y: sp.y, rot: sp.rot, taken: false, regrowAt: 0 }); else this.crateSpots.push({ x: sp.x, z: sp.z, y: sp.y, yFix: true, rot: sp.rot, furn: sp.kind, site: sp.kind, toxic: tox, siteId: sid }); } }
  // lote de casa (cidade ou vilarejo): 1 casa (com ou sem garagem) ou 2 casas lado a lado, cerca de madeira, árvores no quintal
  // o: { W(lx,lz), rot0, fx, fz (meio da frente), dir (para a rua), lat (lateral), Wd (largura), Dp (fundo), y, sid, site, tox, fences (Set), small }
  _houseLot(r, o, B, props) {
    const { W, rot0, fx, fz, dir, lat, Wd, Dp, y, sid, tox } = o; const phi = dir[1] > 0.5 ? 0 : dir[1] < -0.5 ? Math.PI : dir[0] > 0 ? Math.PI / 2 : -Math.PI / 2; const rot = rot0 + phi;
    const LP = (a, b) => [fx + lat[0] * a - dir[0] * b, fz + lat[1] * a - dir[1] * b]; const WP = (a, b) => { const [lx, lz] = LP(a, b); return W(lx, lz); };
    const sgn = Math.round(Math.cos(phi) * lat[0] - Math.sin(phi) * lat[1]) || 1; const hx = [Math.cos(rot), -Math.sin(rot)];
    const two = (o.dense || r() < (o.small ? 0.15 : 0.4)) && Wd > 30; const units = two ? [-Wd / 4, Wd / 4] : [0]; const spans = []; const set = 3.6;
    const dry = (x, z) => this.riverDist(x, z)[0] > 16 && !this.inLake(x, z, 8);
    for (const a0 of units) {
      const w = (two || o.small ? 8.5 : 9.5) + Math.floor(r() * 3) * 0.5, d = (o.small ? 8 : 8.5) + Math.floor(r() * 3) * 0.5; const porch = r() < 0.75; const mirror = r() < 0.5 ? 1 : -1;
      const garage = two || o.small ? 0 : r() < 0.65 ? (r() < 0.5 ? 1 : -1) : 0; const g = garage * mirror;
      let [x, z] = WP(a0, set + d / 2); x -= hx[0] * g * 2.7; z -= hx[1] * g * 2.7; if (!dry(x, z)) continue;
      const xs = [-w / 2 - (g < 0 ? 5.4 : 0) - g * 2.7, w / 2 + (g > 0 ? 5.4 : 0) - g * 2.7].map((v) => a0 + sgn * v).sort((p, q) => p - q); spans.push(xs);
      this._addBuilding({ x, z, y, w, d, floors: r() < (o.small ? 0.2 : 0.35) ? 2 : 1, rot, seed: Math.floor(r() * 1e6), decay: tox ? 0.15 + r() * 0.2 : 0.02 + r() * 0.06, style: 'suburb', garage, porch, mirror, doors: r() < 0.65, color: Math.floor(r() * 16), drive: set - 0.2, furnish: true }, B, sid, tox); }
    // cercas: frente (com aberturas na frente das casas), laterais e fundo
    const fence = (a0, b0, a1, b1) => { const [x0, z0] = WP(a0, b0), [x1, z1] = WP(a1, b1); const len = Math.hypot(x1 - x0, z1 - z0); if (len < 1.2) return; const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2; const key = Math.round(mx * 2) + ',' + Math.round(mz * 2);
      if (o.fences.has(key)) return; o.fences.add(key); props.push({ kind: 'wfence', x: mx, z: mz, y, rot: Math.atan2(-(z1 - z0), x1 - x0), len, toxic: tox, site: o.site, siteId: sid }); };
    const e = Wd / 2 - 0.3; spans.sort((p, q) => p[0] - q[0]); let at = -e; for (const [s0, s1] of spans) { fence(at, 0.3, s0 - 1.2, 0.3); at = s1 + 1.2; } fence(at, 0.3, e, 0.3);
    fence(-e, 0.3, -e, Dp); fence(e, 0.3, e, Dp); fence(-e, Dp, e, Dp);
    // árvores no quintal (fundo) e às vezes na frente
    const nT = 1 + (r() < 0.6 ? 1 : 0); for (let k = 0; k < nT; k++) { const a = (k ? 1 : -1) * (e - 2.2 - r() * 2.5), b = Dp - 2.2 - r() * 1.2; const [x, z] = WP(a, b); props.push({ kind: 'ytree', x, z, y, rot: r() * 6.28, seed: Math.floor(r() * 1e6), variant: tox ? (r() < 0.7 ? 'dead' : 'oak') : r() < 0.3 ? 'pine' : 'oak', site: o.site, siteId: sid }); }
    if (r() < 0.35 && spans.length) { const sd = r() < 0.5 ? -1 : 1; const a = sd * (e - 1.8); if (!spans.some(([s0, s1]) => a > s0 - 2 && a < s1 + 2)) { const [x, z] = WP(a, 1.9); props.push({ kind: 'ytree', x, z, y, rot: r() * 6.28, seed: Math.floor(r() * 1e6), variant: tox ? 'dead' : 'oak', site: o.site, siteId: sid }); } }
    if (r() < 0.35) { const [x, z] = WP((r() - 0.5) * (Wd - 6), Dp - 1.2); this.crateSpots.push({ x, z, y: 0, rot: r() * 6.28, site: o.site === 'village' ? 'village' : 'ruins', siteId: sid }); }
  }
  _genCity(r, C, B, props) {
    // cidade em grade: N×N quadras de 44 m, ruas de asfalto (7 m) com calçadas e faixas; lotes cercados com casas viradas para a rua;
    // no centro: hospital, igreja, loja, oficina, farmácia, prédios e uma praça com caixa d'água
    const N = C.N, h = C.half, P = PITCH, y = C.y, sid = C.id, tox = !!C.toxic; const W = (lx, lz) => this.cityW(C, lx, lz); const Lq = (i) => -h + i * P;
    const pushP = (o) => props.push({ site: 'ruins', siteId: sid, toxic: tox, y, ...o });
    const tmil = tox ? this.sites.find((s) => s.kind === 'military' && s.toxic) : null; const inMil = (x, z, pad = 0) => !!tmil && Math.hypot(x - tmil.x, z - tmil.z) < tmil.r + pad;
    const gate = C.gate; const armIdx = (a) => (a[0] > 0 ? 0 : a[0] < 0 ? 1 : a[1] > 0 ? 2 : 3);
    for (let i = 0; i <= N; i++) for (let j = 0; j <= N; j++) { const lx = Lq(i), lz = Lq(j); const arms = [i < N, i > 0, j < N, j > 0];
      if (gate && Math.abs(gate.local[0] - lx) < 1 && Math.abs(gate.local[1] - lz) < 1) arms[armIdx(gate.arm)] = true;
      const [x, z] = W(lx, lz); if (inMil(x, z, 4)) continue; pushP({ kind: 'xing', x, z, rot: C.rot, arms }); }
    const lamp = (lx, lz, nx, nz) => { const [x, z] = W(lx, lz); const ax = nx * C.cr + nz * C.sr, az = -nx * C.sr + nz * C.cr; pushP({ kind: 'lamp', x, z, rot: Math.atan2(-az, ax), bent: tox && r() < 0.2 ? (r() - 0.5) * 0.6 : 0 }); };
    const car = (lx, lz, alongX) => { const [x, z] = W(lx, lz); const dv = alongX ? [C.cr, -C.sr] : [C.sr, C.cr]; const s = r() < 0.5 ? 1 : -1; const rr = [r(), r(), r()]; pushP({ kind: 'car', x, z, rot: Math.atan2(-dv[1] * s, dv[0] * s) + (rr[0] < (tox ? 0.3 : 0.1) ? (rr[1] - 0.5) * 1.0 : (rr[1] - 0.5) * 0.08), seed: Math.floor(rr[2] * 1e6), loot: r() < 0.45 }); };
    for (let i = 0; i < N; i++) for (let j = 0; j <= N; j++) for (const ax of [0, 1]) {
      const lx = ax ? Lq(j) : Lq(i) + P / 2, lz = ax ? Lq(i) + P / 2 : Lq(j); const [x, z] = W(lx, lz); if (inMil(x, z, 18)) continue;
      pushP({ kind: 'street', x, z, rot: ax ? C.rot - Math.PI / 2 : C.rot, L: P - 2 * HC, zA: r() < 0.45, zB: r() < 0.45 });
      const sd = (i + j) % 2 ? 1 : -1; const off = (r() - 0.5) * 12; if (ax) lamp(lx + sd * (HC - 0.6), lz + off, -sd, 0); else lamp(lx + off, lz + sd * (HC - 0.6), 0, -sd);
      if (r() < (tox ? 0.5 : 0.32)) { const t = (r() - 0.5) * (P - 2 * HC - 9), lane = (r() < 0.5 ? -1 : 1) * 2.3; if (ax) car(lx + lane, lz + t, false); else car(lx + t, lz + lane, true); } }
    // quadras
    const blocks = []; for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) { const cx = Lq(i) + P / 2, cz = Lq(j) + P / 2; const [wx, wz] = W(cx, cz); if (inMil(wx, wz, 26)) continue; blocks.push({ i, j, cx, cz, d: Math.hypot(cx, cz) + (i * 7 + j * 3) % 5 * 0.01 }); }
    blocks.sort((a, b) => a.d - b.d);
    const spec = tox ? ['hospital', 'pharmapt', 'labs', 'church', 'shopgarage', 'labs', 'pharmapt', 'labs', 'shopgarage', 'hospital'] : N >= 3 ? ['hospital', 'church', 'shopgarage', 'park', 'pharmapt'] : ['church', 'shopgarage'];
    if (!tox && N >= 4) spec.push('apartments', 'shopgarage'); if (!tox && N >= 5) spec.push('apartments', 'pharmapt');
    const fences = new Set(); const D = P / 2 - HC;
    const halves = (bk) => { const zs = (bk.i + bk.j) % 2 === 0; return [-1, 1].map((s) => (zs ? { fx: bk.cx, fz: bk.cz + s * D, dir: [0, s], lat: [1, 0] } : { fx: bk.cx + s * D, fz: bk.cz, dir: [s, 0], lat: [0, 1] })); };
    const place = (hl, style, w, d, floors, extra = {}) => { const phi = hl.dir[1] > 0.5 ? 0 : hl.dir[1] < -0.5 ? Math.PI : hl.dir[0] > 0 ? Math.PI / 2 : -Math.PI / 2; const b = (extra.set ?? 3) + d / 2;
      const [x, z] = W(hl.fx - hl.dir[0] * b, hl.fz - hl.dir[1] * b); this._addBuilding({ x, z, y, w, d, floors, rot: C.rot + phi, seed: Math.floor(r() * 1e6), decay: tox ? 0.08 + r() * 0.15 : 0.02 + r() * 0.04, style, furnish: true, doorWall: 0, ...extra }, B, sid, tox); return [x, z, phi]; };
    const tree = (lx, lz, v) => { const [x, z] = W(lx, lz); pushP({ kind: 'ytree', x, z, rot: r() * 6.28, seed: Math.floor(r() * 1e6), variant: v || (tox ? 'dead' : r() < 0.3 ? 'pine' : 'oak') }); };
    blocks.forEach((bk, n) => { let kind = n < spec.length ? spec[n] : 'res'; if (tox && kind === 'res' && bk.d < P * 2.6) kind = 'apartments'; const hs = halves(bk);
      if (kind === 'hospital') { const hl = hs[1]; place(hl, 'hospital2', 22, 16, 2, { set: 4 }); for (const s of [-1, 1]) tree(bk.cx + hl.dir[0] * -14 + hl.lat[0] * s * 13, bk.cz + hl.dir[1] * -14 + hl.lat[1] * s * 13); return; }
      if (kind === 'church') { const hl = hs[0]; const phi = hl.dir[1] > 0.5 ? 0 : hl.dir[1] < -0.5 ? Math.PI : hl.dir[0] > 0 ? Math.PI / 2 : -Math.PI / 2; const b = 3 + 9; const [x, z] = W(hl.fx - hl.dir[0] * b, hl.fz - hl.dir[1] * b);
        this._addBuilding({ x, z, y, w: 18, d: 11, floors: 1, rot: C.rot + phi - Math.PI / 2, seed: Math.floor(r() * 1e6), decay: tox ? 0.12 : 0.02, style: 'church', roof: 'gable', furnish: true, doorWall: 2 }, B, sid, tox);
        for (const s of [-1, 1]) { tree(bk.cx + hs[1].dir[0] * 9 + hs[1].lat[0] * s * 10, bk.cz + hs[1].dir[1] * 9 + hs[1].lat[1] * s * 10); tree(bk.cx + hl.lat[0] * s * 13, bk.cz + hl.lat[1] * s * 13); } return; }
      if (kind === 'park') { const [x, z] = W(bk.cx, bk.cz); pushP({ kind: 'wtower', x, z, rot: C.rot }); pushP({ kind: 'well', x: W(bk.cx + 9, bk.cz - 7)[0], z: W(bk.cx + 9, bk.cz - 7)[1], rot: C.rot });
        for (let k = 0; k < 7; k++) { const a = k / 7 * 6.28 + r() * 0.4, d = 9 + r() * 5; tree(bk.cx + Math.cos(a) * d, bk.cz + Math.sin(a) * d); } return; }
      if (kind === 'shopgarage') { const [sx, sz, sphi] = place(hs[0], 'shop', 13, 10, 1, { set: 2.5 }); const [gx, gz, gphi] = place(hs[1], 'garage', 15, 11, 1, { set: 3.5 });
        const gf = [Math.sin(C.rot + gphi), Math.cos(C.rot + gphi)], gl = [Math.cos(C.rot + gphi), -Math.sin(C.rot + gphi)];
        for (const s of [-1, 1]) { const tx = gx + gf[0] * 7.2 + gl[0] * s * 7.0, tz = gz + gf[1] * 7.2 + gl[1] * s * 7.0; pushP({ kind: 'tires', x: tx, z: tz, rot: r() * 6, seed: Math.floor(r() * 1e6) }); }
        this.crateSpots.push({ x: gx + gf[0] * 6.6 - gl[0] * 7.5, z: gz + gf[1] * 6.6 - gl[1] * 7.5, y: 0, rot: C.rot + gphi, site: 'garage', siteId: sid }); return; }
      if (kind === 'pharmapt') { place(hs[0], 'pharmacy', 9, 9, 1, { set: 3 }); place(hs[1], 'apartment', 15, 11, tox ? 3 + Math.floor(r() * 2) : 3, { set: 2.5 }); tree(bk.cx + hs[0].lat[0] * 11, bk.cz + hs[0].lat[1] * 11); return; }
      if (kind === 'labs') { for (const hl of hs) place(hl, 'lab', 16, 12, 2, { set: 2.5 }); return; }
      if (kind === 'apartments') { for (const hl of hs) place(hl, 'apartment', 14 + Math.floor(r() * 3), 11, tox ? 3 + Math.floor(r() * 3) : 2 + Math.floor(r() * 2), { set: 2.5 }); return; }
      for (const hl of hs) { if (tox && r() < 0.05) { for (let k = 0; k < 3; k++) { const [x, z] = W(hl.fx - hl.dir[0] * (4 + r() * 10) + hl.lat[0] * (r() - 0.5) * 24, hl.fz - hl.dir[1] * (4 + r() * 10) + hl.lat[1] * (r() - 0.5) * 24); pushP({ kind: 'rubble', x, z, rot: r() * 6.28, s: 0.5 + r() * 0.7, seed: Math.floor(r() * 1e6) }); } continue; }
        this._houseLot(r, { W, rot0: C.rot, fx: hl.fx, fz: hl.fz, dir: hl.dir, lat: hl.lat, Wd: 2 * D, Dp: D, y, sid, site: 'ruins', tox, fences, dense: true }, B, props); } });
    if (tox) for (let k = 0; k < 40; k++) { const t = (r() - 0.5) * 2 * h, q = Lq(Math.floor(r() * (N + 1))); const [x, z] = r() < 0.5 ? W(t, q + (r() - 0.5) * 5) : W(q + (r() - 0.5) * 5, t); if (inMil(x, z, 6)) continue; pushP({ kind: 'rubble', x, z, rot: r() * 6.28, s: 0.4 + r() * 0.6, seed: Math.floor(r() * 1e6) }); }
    for (let k = 0; k < 4; k++) { const q = Lq(Math.floor(r() * (N + 1))), t = (r() - 0.5) * 2 * (h - 8); const [x, z] = r() < 0.5 ? W(t, q + HC - 0.8) : W(q + HC - 0.8, t); this.crateSpots.push({ x, z, y: 0, rot: r() * 6.28, site: 'ruins', siteId: sid }); }
  }
}
World.prototype._genSites = function (r, B, props) {
  for (const st of this.sites) {
    if (st.kind === 'city') continue; const sid = st.id;
    const rot0 = st.rot; const cr = Math.cos(rot0), sr = Math.sin(rot0); const P = (lx, lz) => [st.x + lx * cr - lz * sr, st.z + lx * sr + lz * cr];
    const add = (lx, lz, w, d, floors, extra = {}) => { const [x, z] = P(lx, lz); B.push({ x, z, y: this.height0(x, z), w, d, floors, rot: rot0 + (extra.turn || 0), seed: Math.floor(r() * 1e6), decay: extra.decay ?? 0.08, site: st.kind, siteId: sid, ...extra }); };
    const crate = (lx, lz) => { const [x, z] = P(lx, lz); this.crateSpots.push({ x, z, y: 0, rot: r() * 6.28, site: st.kind, siteId: sid }); };
    const chord = (x0, z0, x1, z1) => -Math.atan2(z1 - z0, x1 - x0) - 2 * rot0; // giro que alinha um segmento local (P gira +rot0, a malha gira −rot)
    const prop = (kind, lx, lz, o = {}) => { const [x, z] = P(lx, lz); props.push({ kind, x, z, y: this.height0(x, z), rot: rot0 + (o.turn || 0), s: o.s || 1, seed: Math.floor(r() * 1e6), site: st.kind, siteId: sid, ...o }); };
    if (st.kind === 'village') { // cidade do interior: rua de terra com casas cercadas dos dois lados, poço e postes
      const cr2 = Math.cos(rot0), sr2 = Math.sin(rot0); const Wv = (lx, lz) => [st.x + lx * cr2 + lz * sr2, st.z - lx * sr2 + lz * cr2]; const fences = new Set();
      for (const s of [-1, 1]) for (const a of [-33, -11, 11, 33]) { if (s > 0 && a === 11) continue; this._houseLot(r, { W: Wv, rot0, fx: a, fz: s * 4.2, dir: [0, -s], lat: [1, 0], Wd: 22, Dp: 17, y: st.y, sid, site: 'village', tox: false, fences, small: true }, B, props); }
      { const [x, z] = Wv(11, 11); props.push({ kind: 'well', x, z, y: st.y, rot: rot0, site: st.kind, siteId: sid }); for (const [a, b] of [[4, 8], [18, 15]]) { const [tx, tz] = Wv(a, b); props.push({ kind: 'ytree', x: tx, z: tz, y: st.y, rot: r() * 6, seed: Math.floor(r() * 1e6), variant: 'oak', site: st.kind, siteId: sid }); } }
      for (let k = 0; k < 4; k++) { const lx = -36 + k * 24, sd = k % 2 ? 1 : -1; const [x, z] = Wv(lx, sd * 3.8); const ax = -sd * sr2, az = -sd * cr2; props.push({ kind: 'lamp', x, z, y: st.y, rot: Math.atan2(-az, ax), bent: 0, site: st.kind, siteId: sid }); }
      for (let k = 0; k < 2; k++) { const [x, z] = Wv(-30 + r() * 60, (r() < 0.5 ? -1 : 1) * 1.8); props.push({ kind: 'car', x, z, y: st.y, rot: rot0 + (r() < 0.5 ? Math.PI : 0) + (r() - 0.5) * 0.2, seed: Math.floor(r() * 1e6), site: st.kind, siteId: sid }); }
    } else if (st.kind === 'industry') { // galpões, tanques, chaminé e contêineres
      add(-16, -12, 22, 14, 2, { style: 'warehouse', decay: 0.15 }); add(16, -14, 18, 12, 2, { style: 'warehouse', decay: 0.2 }); add(-14, 18, 12, 10, 3, { style: 'office' });
      for (let k = 0; k < 3; k++) prop('tank', 14 + k * 7.5, 16, { s: 1 + r() * 0.2 }); prop('chimney', 28, -2);
      for (let k = 0; k < 8; k++) prop('container', -36 + (k % 4) * 3.2, 30 + Math.floor(k / 4) * 7, { turn: Math.PI / 2, stack: r() < 0.4 ? 2 : 1, hue: k });
      for (let k = 0; k < 6; k++) crate((r() - 0.5) * 50, (r() - 0.5) * 50);
      for (let k = 0; k < 4; k++) prop('lamp', -24 + k * 16, 2, { bent: 0 });
    } else if (st.kind === 'military') { // complexo militar cercado, com um único portão: torres, tendas, galpões com caixas e contêineres
      const R = st.r - 4, n = 56, gate = 0; const mil = (lx, lz, extra = {}) => { const [x, z] = P(lx, lz); this.crateSpots.push({ x, z, y: 0, rot: rot0 + (extra.turn || 0), site: 'military', siteId: sid, mil: true, ...extra }); };
      for (let k = 0; k < n; k++) { if (k === gate) continue; const a0 = (k / n) * Math.PI * 2, a1 = ((k + 1) / n) * Math.PI * 2;
        const [x0, z0] = [Math.cos(a0) * R, Math.sin(a0) * R], [x1, z1] = [Math.cos(a1) * R, Math.sin(a1) * R]; prop('fence', (x0 + x1) / 2, (z0 + z1) / 2, { turn: chord(x0, z0, x1, z1), len: Math.hypot(x1 - x0, z1 - z0) + 0.15 }); }
      const ga = (gate + 0.5) / n * Math.PI * 2; { const a0 = gate / n * Math.PI * 2, a1 = (gate + 1) / n * Math.PI * 2; prop('gate', Math.cos(ga) * R, Math.sin(ga) * R, { turn: chord(Math.cos(a0) * R, Math.sin(a0) * R, Math.cos(a1) * R, Math.sin(a1) * R) }); } prop('booth', Math.cos(ga - 0.07) * (R - 5), Math.sin(ga - 0.07) * (R - 5), { turn: -ga });
      this.gates = this.gates || []; { const [gx, gz] = P(Math.cos(ga) * R, Math.sin(ga) * R); this.gates.push({ x: gx, z: gz, site: sid }); }
      for (let k = 0; k < 6; k++) { const a = ga + 0.5 + k * (Math.PI * 2 - 1.0) / 5; prop('tower', Math.cos(a) * (R - 4), Math.sin(a) * (R - 4)); }
      // galpões com caixas militares grandes e contêineres
      const hangars = [[-45, -30], [10, -55], [45, -10]];
      for (const [hx, hz] of hangars) { add(hx, hz, 24, 14, 2, { style: 'hangar', decay: 0.02, open: true });
        for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) mil(hx - 7.5 + i * 5, hz - 3 + j * 6, { kind: 'milcrate' });
        prop('container', hx + 2, hz, { turn: 0, hue: 9, loot: true }); }
      // tendas em fileiras e quartéis
      for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) { prop('tent', -55 + i * 12, 30 + j * 14, { turn: Math.PI / 2 }); mil(-55 + i * 12, 30 + j * 14, { kind: 'tentbox' }); } // tendas abertas com um baú dentro
      for (const bz of [35, 52]) { const [x, z] = P(30, bz); const bb = { x, z, y: this.height0(x, z), w: 16, d: 7, floors: 1, style: 'barracks', decay: 0.04, furnish: true, rot: rot0, seed: Math.floor(r() * 1e6), site: 'military', siteId: sid, doorWall: 0 }; B.push(bb);
        for (const sp of interiorLoot(bb)) this.crateSpots.push({ x: sp.x, z: sp.z, y: sp.y, yFix: true, rot: sp.rot, furn: sp.kind, site: 'military', siteId: sid, mil: true }); } add(-5, 5, 10, 10, 2, { style: 'bunker', decay: 0 });
      for (let k = 0; k < 10; k++) prop('sandbag', Math.cos(ga) * (R - 12) + (k % 5 - 2) * 3, Math.sin(ga) * (R - 12) + Math.floor(k / 5) * 3, { turn: -ga });
      for (let k = 0; k < 6; k++) prop('container', -70 + (k % 3) * 3.4, -70 + Math.floor(k / 3) * 7, { turn: Math.PI / 2, stack: k % 2 ? 2 : 1, hue: 9 + (k % 2), loot: k % 2 === 0 });
      for (let k = 0; k < 6; k++) crate(-10 + (r() - 0.5) * 30, 20 + (r() - 0.5) * 20);
      for (let k = 0; k < 8; k++) prop('lamp', Math.cos(k * 0.785) * 60, Math.sin(k * 0.785) * 60, { bent: 0 });
    } else if (st.kind === 'lab') { // laboratório: prédio principal, depósito, cerca e tambores de resíduos
      const labB = { w: 16, d: 12, floors: 2, style: 'lab', decay: 0.04, furnish: true }; const [x, z] = P(0, 0);
      const bb = { x, z, y: this.height0(x, z), ...labB, rot: rot0, seed: Math.floor(r() * 1e6), site: 'lab', siteId: sid, doorWall: 0 }; B.push(bb);
      for (const sp of interiorLoot(bb)) { if (sp.special) this.specials.push({ id: this.specials.length, kind: sp.special, x: sp.x, z: sp.z, y: sp.y, rot: sp.rot, taken: false, regrowAt: 0 }); else this.crateSpots.push({ x: sp.x, z: sp.z, y: sp.y, yFix: true, rot: sp.rot, furn: sp.kind, site: 'lab', siteId: sid }); }
      add(14, -2, 8, 7, 1, { style: 'warehouse', decay: 0.05 }); for (let k = 0; k < 3; k++) crate(14 + (r() - 0.5) * 4, -2 + (r() - 0.5) * 3);
      prop('container', -14, 6, { turn: Math.PI / 2, hue: 4 }); for (let k = 0; k < 6; k++) prop('barrel', -12 + (k % 3) * 1.1, -8 + Math.floor(k / 3) * 1.1);
      const R = st.r - 6; for (let k = 0; k < 24; k++) { if (k === 6) continue; const a0 = (k / 24) * Math.PI * 2, a1 = ((k + 1) / 24) * Math.PI * 2; const [x0, z0] = [Math.cos(a0) * R, Math.sin(a0) * R], [x1, z1] = [Math.cos(a1) * R, Math.sin(a1) * R];
        prop('fence', (x0 + x1) / 2, (z0 + z1) / 2, { turn: chord(x0, z0, x1, z1), len: Math.hypot(x1 - x0, z1 - z0) + 0.15 }); }
      for (let k = 0; k < 3; k++) prop('lamp', -8 + k * 8, 10, { bent: 0 });
    }
  }
};
function mixc(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
