// Geração do mundo (ilha de ~10 km): terreno procedural com montanhas, rios, lagos e praias; várias cidades,
// vilarejos, indústrias e bases militares ligados por estradas; cavernas e distribuição de recursos.
// O terreno fino (3 m) é gerado por blocos de 192 m sob demanda; um grid grosso (24 m) cobre a ilha inteira
// para o horizonte e para o mapa. Objetos (árvores, rochas, etc.) são gerados por bloco de forma determinística.
import { makeNoise, rng, smoothstep, lerp, clamp } from '../engine/math.js';
import { hex } from '../engine/mesh.js';
import { MAP } from './mapdata.js';
import { interiorLoot } from './interiors.js';

export const CELL = 3, TC = 64, TILE = TC * CELL, TILES = 54, SIZE = TILE * TILES, HALF = SIZE / 2, WATER = 0;
const digKey = (gi, gj) => gj * (TC * TILES + 1) + gi;
export const CC = 24, NC = SIZE / CC + 1; // grid grosso
export const ISL = 4700; // raio médio da ilha
export const WALL = 5050; // parede invisível nos limites do mapa
const dec = (b) => Uint8Array.from(atob(b), (c) => c.charCodeAt(0));
const CH = {}; for (const k of ['land', 'snow', 'desert', 'swamp', 'rock', 'peak', 'mesa']) CH[k] = dec(MAP[k]);
export const RUINS = { x: 0, z: 0, r: 120 }; // cidade inicial (preenchida na geração)
const FC = 256, FN = Math.ceil(SIZE / FC); // índice espacial de feições

function segDist(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az; const t = clamp(((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz || 1), 0, 1);
  return [Math.hypot(px - ax - dx * t, pz - az - dz * t), t];
}
const CITY_NAMES = ['Porto Cinza']; // a cidade inicial; as demais têm região própria em _findSites
const VILLAGE_NAMES = ['Pedra Alta', 'do Moinho', 'Três Pinheiros', 'Boa Vista', 'das Flores', 'Rio Seco', 'São Bento', 'Lagoa Azul', 'Campo Verde', 'Serra Baixa'];
const IND_NAMES = ['Siderúrgica Norte', 'Fábrica Têxtil', 'Refinaria Leste', 'Complexo Químico'];
const MIL_NAMES = ['Base militar Alfa', 'Base militar Bravo', 'Base militar Charlie', 'Base militar Delta'];
const LAB_NAMES = ['Laboratório Ômega', 'Laboratório Gênesis', 'Laboratório Fênix', 'Laboratório Aurora'];
export const TOXIC = { x: 1083, z: 1790, r: 640, city: 250 }; // a maior cidade, tomada pela névoa tóxica

export class World {
  constructor(seed = 1337) {
    this.seed = seed; this.noise = makeNoise(seed); this.rand = rng(seed + 7);
    this.fidx = Array.from({ length: FN * FN }, () => ({ mtn: [], riv: [], lakes: [], sites: [], roads: [], caves: [] }));
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
    this.lakes = MAP.lakes.map(([x, z, r]) => ({ x, z, r: Math.max(40, r * 0.85) })); for (const l of this.lakes) this._idx('lakes', l, l.x - l.r * 1.6 - 30, l.z - l.r * 1.6 - 30, l.x + l.r * 1.6 + 30, l.z + l.r * 1.6 + 30);
  }
  riverDist(x, z) {
    let best = 1e4, bt = 0;
    for (const s of this._fcell(x, z).riv) { const [d, t] = segDist(x, z, s[0], s[1], s[2], s[3]); if (d < best) { best = d; bt = s[4] + (s[5] - s[4]) * t; } }
    return [best, bt];
  }
  inLake(x, z, pad = 0) { for (const l of this._fcell(x, z).lakes) if (Math.hypot(l.x - x, l.z - z) < l.r + pad) return l; return null; }
  baseHeight(x, z, noRoads = false) {
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
    if (F.riv.length) { const [rd, rt] = this.riverDist(x + n.fbm(x / 60, z / 60, 2) * 10, z); const w = 12 + rt * 14;
      h = lerp(h, Math.min(h, -2.4 - rt * 1.5), smoothstep(w * 1.2, w * 0.45, rd)); h = lerp(h, Math.min(h, 1.5 + rd * 0.08), smoothstep(w * 3.2, w * 1.2, rd) * 0.75); }
    for (const l of F.lakes) { const ld = Math.hypot(x - l.x, z - l.z) + n.fbm(x / 25, z / 25, 2) * 10; h = lerp(h, Math.min(h, -3.8), smoothstep(l.r, l.r * 0.55, ld)); h = lerp(h, Math.min(h, 1.2), smoothstep(l.r * 1.5, l.r, ld) * 0.6); }
    for (const st of F.sites) { const f = smoothstep(st.r + 34, st.r - 4, Math.hypot(x - st.x, z - st.z)); if (f > 0) h = lerp(h, st.y + n.fbm(x / 40, z / 40, 2) * (st.kind === 'city' ? 0.5 : 0.3), f); }
    if (!noRoads) for (const s of F.roads) { const w = s[4]; const [dd, t] = segDist(x, z, s[0], s[1], s[2], s[3]); if (dd < w + 7 && s[5]) { const pr = s[5], f = t * (pr.length - 1), i = Math.min(pr.length - 2, Math.floor(f)); const yc = pr[i] + (pr[i + 1] - pr[i]) * (f - i);
      h = lerp(h, yc, smoothstep(w + 7, w * 0.55, dd)); } }
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
    const free = (x, z, rad, sep, riverOk) => Math.hypot(x - TOXIC.x, z - TOXIC.z) > TOXIC.r + rad + 120 && !out.some((o) => Math.hypot(o.x - x, o.z - z) < o.r + rad + (o.kind === 'city' || sep > 600 ? sep : 380)) && (riverOk || this.riverDist(x, z)[0] > rad + 30) && !this.inLake(x, z, rad * 1.6 + 25) && !this.caves.some((c) => Math.hypot(c.x - x, c.z - z) < c.R + rad + 40);
    const place = (kind, name, rad, sep, tx, tz, spread, o = {}) => {
      let best = null;
      for (let k = 0; k < (o.pred ? 2600 : 900); k++) {
        let x, z; if (tx !== undefined) { const a = k * 2.39996, d = Math.sqrt(k) * spread; x = tx + Math.cos(a) * d; z = tz + Math.sin(a) * d; }
        else { x = MAP.x0 + r() * -2 * MAP.x0; z = MAP.z0 + r() * -2 * MAP.z0; }
        if (this.ch('land', x, z) < rad + (o.minLand ?? 120) || this.ch('peak', x, z) > 0.2 || (kind === 'city' && !o.pred && (this.ch('snow', x, z) > 0.3 || this.ch('swamp', x, z) > 0.3))) continue;
        if (o.pred && !o.pred(x, z, rad)) continue; if (!free(x, z, rad, sep, o.riverOk)) continue; const f = flatAt(x, z, rad); if (!f) continue; const score = f.v + (tx !== undefined ? Math.hypot(x - tx, z - tz) * 0.05 : 0);
        if (!best || score < best.score) best = { x, z, y: f.y, score }; if (best.score < 25 || (tx === undefined && k > 60 && best.score < 80)) break;
      }
      if (best) out.push({ kind, name, x: best.x, z: best.z, y: Math.max(4, best.y), r: rad, rot: r() * Math.PI });
      return best;
    };
    // cidade inicial: perto da costa sudoeste
    // cidade inicial: península sudoeste do mapa
    const sx = (440 - 661) * (SIZE / 1322), sz = (955 - 595) * (SIZE / 1322);
    place('city', CITY_NAMES[0], 120, 1500, sx, sz, 14);
    { const c = out[0]; let best = null; for (let k = 0; k < 32; k++) { const a = k / 32 * 6.283; for (let d = 100; d < 2500; d += 25) if (this.baseHeight(c.x + Math.cos(a) * d, c.z + Math.sin(a) * d) < 0.3) { if (!best || d < best[1]) best = [a, d]; break; } }
      this.startDir = best ? [Math.cos(best[0]), Math.sin(best[0])] : [0, 1]; this.coastStart = best ? best[1] : 0; }
    // a maior cidade do jogo: zona tóxica (posição fixa, marcada no mapa)
    out.push({ kind: 'city', toxic: true, name: 'Cidade Central', x: TOXIC.x, z: TOXIC.z, y: Math.max(6, Math.min(30, this.baseHeight(TOXIC.x, TOXIC.z))), r: TOXIC.city, rot: 0.18 });
    { const tc = out[out.length - 1], a = 2.2, d = TOXIC.city * 0.58; out.push({ kind: 'military', toxic: true, name: 'Base Militar Central', x: tc.x + Math.cos(a) * d, z: tc.z + Math.sin(a) * d, y: tc.y, r: 62, rot: 0.18 }); } // base militar dentro da névoa (lança-foguetes)
    // cidades com região própria (o nome combina com o lugar); se a região não existir, cai no lugar mais parecido
    { const ch = (k) => (x, z) => this.ch(k, x, z); const coast = (x, z, rad) => { for (let q = 0; q < 12; q++) { const a = q * 0.5236; if (this.baseHeight(x + Math.cos(a) * (rad + 160), z + Math.sin(a) * (rad + 160)) < 0.3) return true; } return false; };
      const R = (x, z) => this.riverDist(x, z)[0]; const C = [
        ['Norte Frio', 85, { pred: (x, z) => ch('snow')(x, z) > 0.55 }], ['Valeseca', 90, { pred: (x, z) => ch('desert')(x, z) > 0.6 }], ['Brejo Fundo', 75, { pred: (x, z) => ch('swamp')(x, z) > 0.5 }],
        ['Cabo Torto', 70, { pred: coast, minLand: 20 }], ['Ponte Velha', 80, { pred: (x, z, rad) => R(x, z) < rad * 0.45, riverOk: true }], ['Três Rios', 85, { pred: (x, z, rad) => R(x, z) < rad + 140 && R(x, z) > rad * 0.6, riverOk: true }],
        ['Pedra Branca', 80, { pred: (x, z) => this.ch('rock', x, z) > 0.25 || this.ch('mesa', x, z) > 0.3 }], ['Serra Negra', 75, { pred: (x, z) => this.biome(x, z) === 'forest' && this.forestDensity(x, z) > 0.45 && this.baseHeight(x, z) > 12 }],
        ['Morro do Ferro', 110, { pred: (x, z) => this.baseHeight(x, z) > 22 && this.biome(x, z) !== 'snow' }], ['Cruz Alta', 105, { pred: (x, z) => Math.hypot(x, z) < 2600 }],
        ['Nova Aurora', 120, { pred: (x, z) => this.biome(x, z) === 'forest' }], ['Santa Cruz do Sul', 100, { pred: (x, z) => this.biome(x, z) === 'forest' && this.forestDensity(x, z) < 0.35 }], ['Vila Esperança', 70, {}]];
      for (const [nm, rad, o] of C) { const sep = rad >= 100 ? 1000 : 700; if (!place('city', nm, rad, sep, undefined, undefined, 0, o)) { const o2 = { ...o, pred: undefined }; if (!place('city', nm, rad * 0.85, sep * 0.8, undefined, undefined, 0, o2)) place('city', nm, rad * 0.7, 450, undefined, undefined, 0, { minLand: 60, riverOk: o.riverOk }); } } }
    // laboratórios (onde ficam as roupas R.A.T): um perto da zona tóxica, fora da névoa
    { const a = 2.4; place('lab', LAB_NAMES[0], 45, 300, TOXIC.x + Math.cos(a) * (TOXIC.r + 380), TOXIC.z + Math.sin(a) * (TOXIC.r + 380), 12); }
    for (let k = 1; k < LAB_NAMES.length; k++) place('lab', LAB_NAMES[k], 45, 500);
    // sítios menores: um de cada perto da cidade inicial, o resto espalhado
    const c0 = out[0]; const near = (a, d) => [c0.x + Math.cos(a) * d, c0.z + Math.sin(a) * d]; const ia = Math.atan2(-c0.z, -c0.x);
    { const [x, z] = near(ia + 0.9, 520); place('village', 'Vilarejo ' + VILLAGE_NAMES[0], 42, 300, x, z, 10); }
    { const [x, z] = near(ia - 0.7, 600); place('industry', IND_NAMES[0], 55, 300, x, z, 10); }
    { const [x, z] = near(ia + 0.1, 1100); place('military', MIL_NAMES[0], 115, 450, x, z, 12); }
    for (let k = 1; k < VILLAGE_NAMES.length; k++) place('village', 'Vilarejo ' + VILLAGE_NAMES[k], 42, 300);
    for (let k = 1; k < IND_NAMES.length; k++) place('industry', IND_NAMES[k], 55, 300);
    for (let k = 1; k < MIL_NAMES.length; k++) place('military', MIL_NAMES[k], 115, 600);
    this.sites = out; Object.assign(RUINS, { x: c0.x, z: c0.z, r: c0.r, y: c0.y });
    out.forEach((s, i) => { s.id = i; this._idx('sites', s, s.x - s.r - 50, s.z - s.r - 50, s.x + s.r + 50, s.z + s.r + 50); });
  }
  // rede de estradas: árvore geradora mínima entre os assentamentos + atalhos, ruas em grade nas cidades
  _genRoadNet() {
    const S = this.sites, r = rng(this.seed + 31); const segs = [];
    const cost = (a, b) => { const L = Math.hypot(b.x - a.x, b.z - a.z); let pen = 0; const n = Math.max(2, Math.floor(L / 120));
      for (let k = 1; k < n; k++) { const t = k / n; const h = this.baseHeight(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t, true); if (h < 0.8) pen += 1.6; else if (h > 50) pen += (h - 50) / 25; } return L * (1 + pen / n * 2.5); };
    const edges = []; const inT = new Set([0]); const C = new Map(); const ck = (i, j) => (i < j ? i * 999 + j : j * 999 + i);
    const gc = (i, j) => { const k = ck(i, j); if (!C.has(k)) C.set(k, cost(S[i], S[j])); return C.get(k); };
    const cand = S.map((a, i) => S.map((b, j) => [j, Math.hypot(a.x - b.x, a.z - b.z)]).filter(([j]) => j !== i).sort((p, q) => p[1] - q[1]).slice(0, 6).map(([j]) => j));
    while (inT.size < S.length) { let best = null;
      for (const i of inT) for (const j of cand[i]) if (!inT.has(j)) { const c = gc(i, j); if (!best || c < best[2]) best = [i, j, c]; }
      if (!best) { for (let j = 0; j < S.length; j++) if (!inT.has(j)) { let bi = 0, bd = 1e9; for (const i of inT) { const d = Math.hypot(S[i].x - S[j].x, S[i].z - S[j].z); if (d < bd) { bd = d; bi = i; } } best = [bi, j, bd]; break; } }
      inT.add(best[1]); edges.push([best[0], best[1]]); }
    for (let i = 0; i < S.length; i++) if (S[i].kind === 'city') for (const j of cand[i].slice(0, 2)) if (!edges.some(([a, b]) => ck(a, b) === ck(i, j))) edges.push([i, j]);
    // anel rodoviário principal (asfalto) ligando as cidades em volta do centro do mapa; as demais ligações são "veias"
    { const cs = S.map((c, i) => [c, i]).filter(([c]) => c.kind === 'city').sort((p, q) => Math.atan2(p[0].z, p[0].x) - Math.atan2(q[0].z, q[0].x)); this.ringEdges = new Set();
      for (let k = 0; k < cs.length; k++) { const i = cs[k][1], j = cs[(k + 1) % cs.length][1]; const L = Math.hypot(S[i].x - S[j].x, S[i].z - S[j].z); if (gc(i, j) > L * 1.9) continue;
        this.ringEdges.add(ck(i, j)); if (!edges.some(([a, b]) => ck(a, b) === ck(i, j))) edges.push([i, j]); } }
    this.roadEdges = edges;
    for (const [i, j] of edges) {
      const a = S[i], b = S[j]; const big = (c) => c.kind === 'city' && (c.r >= 100 || c.toxic); const w = this.ringEdges.has(ck(i, j)) ? 7 : (a.kind === 'village' || b.kind === 'village' || !(big(a) || big(b))) ? 4.5 : 6.5; /* asfalto (≥6) ou terra (4.5) */ const L = Math.hypot(b.x - a.x, b.z - a.z); const n = Math.max(1, Math.round(L / 320));
      const px = -(b.z - a.z) / L, pz = (b.x - a.x) / L; const pts = [[a.x, a.z]];
      for (let k = 1; k < n; k++) { const t = k / n, o = (r() - 0.5) * Math.min(140, L * 0.08); pts.push([a.x + (b.x - a.x) * t + px * o, a.z + (b.z - a.z) * t + pz * o]); }
      pts.push([b.x, b.z]);
      for (let k = 0; k < pts.length - 1; k++) segs.push([pts[k][0], pts[k][1], pts[k + 1][0], pts[k + 1][1], w, null, 'road']);
    }
    // ruas das cidades (quadras de 28 m)
    for (const c of S) if (c.kind === 'city') { const cr = Math.cos(c.rot), sr = Math.sin(c.rot); const W = (lx, lz) => [c.x + lx * cr - lz * sr, c.z + lx * sr + lz * cr]; const K = Math.ceil(c.r / 28);
      for (let k = -K; k < K; k++) { const q = (k + 0.5) * 28; const e = Math.sqrt(Math.max(0, c.r * c.r - q * q)) - 4; if (e < 10) continue;
        const [ax, az] = W(q, -e), [bx, bz] = W(q, e), [cx, cz] = W(-e, q), [dx, dz] = W(e, q); segs.push([ax, az, bx, bz, 6, null, 'street'], [cx, cz, dx, dz, 6, null, 'street']); } }
    // perfil de altura suavizado ao longo de cada trecho
    for (const s of segs) { const L = Math.hypot(s[2] - s[0], s[3] - s[1]); const n = Math.max(2, Math.ceil(L / 12) + 1); let pr = new Float32Array(n);
      for (let k = 0; k < n; k++) { const t = k / (n - 1); pr[k] = Math.max(1.5, this.baseHeight(s[0] + (s[2] - s[0]) * t, s[1] + (s[3] - s[1]) * t, true)); }
      for (let it = 0; it < 4; it++) { const q = pr.slice(); for (let k = 1; k < n - 1; k++) pr[k] = (q[k - 1] + q[k] * 2 + q[k + 1]) / 4; }
      s[5] = pr; this._idxSeg('roads', s, s[4] + 10); }
    this.roadSegs = segs;
  }
  onRoad(x, z, pad = 0.5) { for (const s of this._fcell(x, z).roads) if (segDist(x, z, s[0], s[1], s[2], s[3])[0] < s[4] / 2 + pad) return true; return false; }
  siteAt(x, z, pad = 0) { for (const st of this._fcell(x, z).sites) if (Math.hypot(x - st.x, z - st.z) < st.r + pad) return st; return null; }
  // névoa tóxica: 0 fora, 1 no miolo
  toxicAt(x, z) { const d = Math.hypot(x - TOXIC.x, z - TOXIC.z); return d > TOXIC.r ? 0 : smoothstep(TOXIC.r, TOXIC.r - 140, d); }
  cityAt(x, z, pad = 0) { const s = this.siteAt(x, z, pad); return s && s.kind === 'city' ? s : null; }
  nearestSite(x, z, kind) { let b = null, bd = 1e9; for (const s of this.sites) { if (kind && s.kind !== kind) continue; const d = Math.hypot(s.x - x, s.z - z) - s.r; if (d < bd) { bd = d; b = s; } } return b ? [b, bd] : [null, 1e9]; }

  // ---------- cores ----------
  _color(x, z, h) {
    const n = this.noise, F = this._fcell(x, z); const P = this._pal || (this._pal = { sand: hex(0xd8c69a), wetSand: hex(0xa8946a), grass1: hex(0x5d8a3a), grass2: hex(0x7a9a40), forest: hex(0x4a6a2c), dirt: hex(0x7a6448), rock: hex(0x7d776e), snow: hex(0xeef2f5), ruin: hex(0x8a8270), mud: hex(0x5a4a36), vil: hex(0x6e604a), ind: hex(0x55524c), mil: hex(0x5d5a48), asph: hex(0x3e3d3c), gravel: hex(0x6a5a44), cave: hex(0x4a453f), dry: hex(0x9a9a4a), swamp: hex(0x4c5a2c), dsand: hex(0xd9a25a), dsand2: hex(0xc98a48), mesaC: hex(0x9a5634), snowB: hex(0xc9d6e2) });
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
    for (const st of F.sites) { const d = Math.hypot(x - st.x, z - st.z); if (st.kind === 'city') { c = mixc(c, P.ruin, smoothstep(st.r + 10, st.r - 20, d) * 0.75); continue; }
      const col = st.kind === 'village' ? P.vil : st.kind === 'industry' ? P.ind : P.mil; c = mixc(c, col, smoothstep(st.r + 8, st.r - 10, d) * (0.6 + 0.2 * n.noise(x * 0.2, z * 0.2))); }
    for (const s of F.roads) { const w = s[4]; const [d] = segDist(x, z, s[0], s[1], s[2], s[3]); if (d < w + 2) c = mixc(c, w > 5 ? P.asph : P.gravel, (1 - smoothstep(w * 0.5 - 0.5, w * 0.5 + 1.5, d)) * (0.8 + 0.2 * n.noise(x * 0.4, z * 0.4))); }
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
      if (this.inRuins(px, pz)) { if (rr[0] < 0.012 && !this.bldAt(px, pz)) trees.push({ type: 'dead', x: px, y: h, z: pz, s: 0.8 + rr[1] * 0.5, rot: rr[2] * 6.28, id: id(nt++) }); continue; }
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
    // baldes de malha por célula de 128 m (cidades grandes não viram uma malha só)
    const cellKey = (o) => `site:${o.siteId}:${Math.floor(o.x / 128)}:${Math.floor(o.z / 128)}`;
    let ci = 0; for (const p of props) { if (p.kind === 'car') { p.id = ci++; p.loot = p.loot ?? (r() < 0.4); } if (!p.site) { const [ti, tj] = this.tileAt(p.x, p.z); p.bucket = 'road:' + (tj * TILES + ti); } else p.bucket = cellKey(p); }
    for (const b of B) b.bucket = cellKey(b);
    for (const c of this.crateSpots) { if (!c.yFix) c.y = this.height0(c.x, c.z); if (this.toxicAt(c.x, c.z) > 0) c.toxic = true; }
    this.buildings = B; this.props = props;
    this._bIdx = new Map(); for (const b of B) { const R = Math.max(b.w, b.d) / 2 + 8; for (let i = Math.floor((b.x - R) / 32); i <= Math.floor((b.x + R) / 32); i++) for (let j = Math.floor((b.z - R) / 32); j <= Math.floor((b.z + R) / 32); j++) { const k = i + ',' + j; if (!this._bIdx.has(k)) this._bIdx.set(k, []); this._bIdx.get(k).push(b); } }
  }
  _genCity(r, C, B, props) {
    // cidade: ruas em grade (quadras de 28 m), casas e sobrados quase inteiros, prédios no centro
    const rot = C.rot, cr = Math.cos(rot), sr = Math.sin(rot); const W = (lx, lz) => [C.x + lx * cr - lz * sr, C.z + lx * sr + lz * cr];
    const PITCH = 28, K = Math.ceil(C.r / PITCH); const inCity = (lx, lz, pad = 0) => Math.hypot(lx, lz) < C.r - pad; const y = (x, z) => this.height0(x, z);
    const dry = (x, z) => this.riverDist(x, z)[0] > 14 && !this.inLake(x, z, 6); const sid = C.id;
    const tox = !!C.toxic; const centerR = tox ? 95 : 40; const lotsAll = [];
    for (let gx = -K; gx <= K; gx++) for (let gz = -K; gz <= K; gz++) { const bx = gx * PITCH, bz = gz * PITCH; if (inCity(bx, bz, 12)) lotsAll.push([bx, bz, Math.hypot(bx, bz)]); }
    // lotes especiais: hospital perto do centro, farmácias no meio do caminho
    const byD = [...lotsAll].sort((p, q) => p[2] - q[2]); const hosp = byD.find((p) => p[2] > 20); const ring = byD.filter((p) => Math.abs(p[2] - C.r * 0.45) < 30); const pharm = [ring[0], ring[Math.floor(ring.length / 2)]].filter(Boolean);
    const addB = (bb) => { bb.doorWall = Math.floor(r() * 4); bb.siteId = sid; if (tox) bb.toxic = true; B.push(bb);
      for (const sp of interiorLoot(bb)) { if (sp.special) this.specials.push({ id: this.specials.length, kind: sp.special, x: sp.x, z: sp.z, y: sp.y, rot: sp.rot, taken: false, regrowAt: 0 }); else this.crateSpots.push({ x: sp.x, z: sp.z, y: sp.y, yFix: true, rot: sp.rot, furn: sp.kind, site: sp.kind, toxic: tox, siteId: sid }); } };
    const tmil = tox ? this.sites.find((s) => s.kind === 'military' && s.toxic) : null;
    for (const [bx, bz, dist] of lotsAll) {
      const [hx, hz] = W(bx, bz); if (tmil && Math.hypot(hx - tmil.x, hz - tmil.z) < tmil.r + 16) continue;
      // rotação do prédio para a frente (+Z local) apontar para a direção (dx, dz) do referencial da cidade
      const face = (dx, dz) => { const wx = dx * cr - dz * sr, wz = dx * sr + dz * cr; return Math.atan2(wx, wz); };
      const DIRS = [[0, 1], [0, -1], [1, 0], [-1, 0]];
      if (hosp && bx === hosp[0] && bz === hosp[1]) { const [ddx, ddz] = DIRS[Math.floor(r() * 4)]; const off = 10.6 - 2.9 - 8; const [hx2, hz2] = W(bx + ddx * off, bz + ddz * off); if (dry(hx2, hz2)) addB({ x: hx2, z: hz2, y: y(hx2, hz2), w: 22, d: 16, floors: 2, rot: face(ddx, ddz), seed: Math.floor(r() * 1e6), decay: tox ? 0.14 : 0.03, style: 'hospital2', furnish: true }); continue; }
      if (pharm.some((p) => p[0] === bx && p[1] === bz)) { if (dry(hx, hz)) addB({ x: hx, z: hz, y: y(hx, hz), w: 9, d: 9, floors: 1, rot, seed: Math.floor(r() * 1e6), decay: tox ? 0.1 : 0.02, style: 'pharmacy', furnish: true }); continue; }
      const center = dist < centerR; if (tox && !center && r() < 0.3) { r(); continue; } // lotes vazios na cidade grande
      if (!center) { // bairro: casas de subúrbio viradas para a rua, cores e plantas variadas
        const [ddx, ddz] = DIRS[Math.floor(r() * 4)]; const px = ddz, pz = -ddx; const pair = r() < 0.45; const units = pair ? [-1, 1] : [0];
        for (const l of units) { const garage = !pair && r() < 0.7 ? (r() < 0.5 ? 1 : -1) : 0; const w = pair ? 9 + Math.floor(r() * 2) * 0.5 : 9.5 + Math.floor(r() * 3) * 0.5, d = 8.5 + Math.floor(r() * 2) * 0.5; const porch = r() < 0.7;
          const front = 10.4, depth = front - (porch ? 1.9 : 0.4) - d / 2; const mirror = r() < 0.5 ? 1 : -1; const lat = pair ? l * 5.3 : (garage ? -garage * mirror * 2.7 : (r() - 0.5) * 2);
          const lx = bx + ddx * depth + px * lat, lz = bz + ddz * depth + pz * lat; const [x, z] = W(lx, lz); if (!dry(x, z)) continue;
          addB({ x, z, y: y(x, z), w, d, floors: r() < 0.4 ? 2 : 1, rot: face(ddx, ddz), seed: Math.floor(r() * 1e6), decay: tox ? 0.15 + r() * 0.2 : 0.02 + r() * 0.06, style: 'suburb', garage, porch, mirror, doors: r() < 0.6, color: Math.floor(r() * 16), drive: front + 1.5 - depth - d / 2 - (porch ? 1.9 : 0) + 1.0, furnish: true }); }
        continue; }
      const two = !center && r() < 0.45; const lots = two ? [-1, 1] : [0];
      for (const l of lots) {
        const w = two ? 8 + Math.floor(r() * 2) : 9 + Math.floor(r() * 4), d = 8 + Math.floor(r() * 4);
        const lx = bx + l * 5.5 + (r() - 0.5) * 2, lz = bz + (r() - 0.5) * 3; const [x, z] = W(lx, lz); if (!dry(x, z)) continue;
        const floors = center ? 2 + Math.floor(r() * (tox ? 3 : 2)) : r() < 0.6 ? 1 : 2; const style = center ? 'apartment' : 'house';
        const roof = !center && r() < 0.65 ? 'gable' : null; const turn = two ? Math.PI / 2 : (r() < 0.5 ? 0 : Math.PI / 2);
        addB({ x, z, y: y(x, z), w, d, floors, rot: rot + turn, seed: Math.floor(r() * 1e6), decay: tox ? 0.06 + r() * 0.2 : 0.02 + r() * (center ? 0.12 : 0.08), style, roof, furnish: true });
      }
    }
    const nC = Math.round(34 * (C.r / 110) ** 2);
    for (let k = 0; k < nC; k++) { const along = r() < 0.5; const c = (Math.floor(r() * 2 * K) - K + 0.5) * PITCH; const t = (r() - 0.5) * 2 * (C.r - 14); const lane = (r() < 0.5 ? -1 : 1) * (1.6 + r() * 0.6);
      const lx = along ? c + lane : t, lz = along ? t : c + lane; const rr = [r(), r(), r(), r(), r()]; if (!inCity(lx, lz, 10)) continue; const [x, z] = W(lx, lz); if (!dry(x, z)) continue;
      props.push({ kind: 'car', x, z, y: y(x, z), rot: rot + (along ? Math.PI / 2 : 0) + (rr[0] < 0.5 ? Math.PI : 0) + (rr[1] - 0.5) * (rr[2] < 0.25 ? 1.4 : 0.25), seed: Math.floor(rr[3] * 1e6), loot: rr[4] < 0.45, site: 'ruins', siteId: sid }); }
    for (let k = 0; k < Math.round(28 * C.r / 110); k++) { const along = k % 2 === 0; const c = (Math.floor(r() * 2 * K) - K + 0.5) * PITCH; const t = (r() - 0.5) * 2 * (C.r - 16); const lx = along ? c + 4 : t, lz = along ? t : c + 4; const bent = r() < 0.15 ? (r() - 0.5) * 0.7 : 0; if (!inCity(lx, lz, 10)) continue;
      const [x, z] = W(lx, lz); props.push({ kind: 'lamp', x, z, y: y(x, z), rot: rot + (along ? Math.PI / 2 : 0), bent, site: 'ruins', siteId: sid }); }
    for (let k = 0; k < 14; k++) { const a = r() * 6.28, d = r() * C.r; const x = C.x + Math.cos(a) * d, z = C.z + Math.sin(a) * d;
      props.push({ kind: 'rubble', x, z, y: y(x, z), rot: r() * 6.28, s: 0.4 + r() * 0.6, seed: Math.floor(r() * 1e6), site: 'ruins', siteId: sid }); }
    for (let k = 0; k < 6; k++) { const a = r() * 6.28, d = r() * C.r * 0.8; this.crateSpots.push({ x: C.x + Math.cos(a) * d, z: C.z + Math.sin(a) * d, y: 0, rot: r() * 6.28, site: 'ruins', siteId: sid }); }
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
    if (st.kind === 'village') { // casas térreas com telhado de duas águas ao redor de uma praça
      for (let k = 0; k < 9; k++) { const a = (k / 9) * Math.PI * 2 + r() * 0.2, d = 18 + r() * 12; const lx = Math.cos(a) * d, lz = Math.sin(a) * d;
        add(lx, lz, 7 + Math.floor(r() * 3), 6 + Math.floor(r() * 3), 1, { roof: 'gable', turn: -a + Math.PI / 2, decay: 0.05, style: 'house' }); if (r() < 0.8) crate(lx * 0.92, lz * 0.92); }
      prop('well', 0, 0); for (let k = 0; k < 4; k++) prop('lamp', Math.cos(k * 1.57) * 9, Math.sin(k * 1.57) * 9, { bent: 0 });
      for (let k = 0; k < 3; k++) prop('car', (r() - 0.5) * 20, (r() - 0.5) * 20, { turn: r() * 6 });
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
