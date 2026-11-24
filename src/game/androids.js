// Androides no estilo da folha de referência: metal grafite facetado (low-poly nítido), frisos dourados
// luminosos, olhos âmbar/vermelhos. Rigs: humanoide, quadrúpede, artrópode (com cauda opcional) e ave.
import { Skeleton, bakeClip } from '../engine/skeleton.js';
import { MeshBuilder, M, hex, shade } from '../engine/mesh.js';
import { mat4, quat } from '../engine/math.js';
import { kf } from './humanoid.js';

export const METAL = 0.5, GLOW = 0.02; // codificados no alfa da cor do vértice (ver shader)
const TAU = Math.PI * 2;
// Paleta da folha de referência
export const PAL = { body: hex(0x232529), plate: hex(0x30333a), dark: hex(0x141517), gold: hex(0xa8782a), trim: hex(0x4a3008), amber: hex(0xffa21c), red: hex(0xff3418), steel: hex(0x6d7178) };

// Construtor facetado: caixas chanfradas (bordas cortadas em facetas) e poucos lados nas peças redondas
class FacetBuilder extends MeshBuilder {
  box(m, sx, sy, sz, c) { return Math.min(sx, sy, sz) < 0.025 ? super.box(m, sx, sy, sz, c) : this.roundBox(m, sx, sy, sz, c, Math.min(sx, sy, sz) * 0.16, 2); }
  sphere(m, r, ws = 8, hs = 6, c, sy = 1) { return super.sphere(m, r, Math.max(6, Math.min(ws, 10)), Math.max(4, Math.min(hs, 7)), c, sy); }
  cylinder(m, r0, r1, h, seg = 6, c, caps = true, wob = null) { return super.cylinder(m, r0, r1, h, Math.max(5, Math.min(seg, 8)), c, caps, wob); }
}
const B = (name, parent, pos) => ({ name, parent, pos });
function restWorld(sk) { const w = []; sk.bones.forEach((b, i) => { const p = b.parent >= 0 ? w[b.parent] : [0, 0, 0]; w[i] = [p[0] + b.pos[0], p[1] + b.pos[1], p[2] + b.pos[2]]; }); return w; }
function seg(mb, a, b, r0, r1, sides, col) {
  const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]; const len = Math.hypot(...d) || 1e-3; const n = d.map((v) => v / len);
  const q = n[1] < -0.9999 ? [1, 0, 0, 0] : quat.normalize([n[2], 0, -n[0], 1 + n[1]]);
  mb.cylinder(mat4.fromTRS(mat4.create(), a, q, [1, 1, 1]), r0, r1, len, sides, col, true);
}
// peça em caixa entre dois pontos (membros blindados)
function slab(mb, a, b, w, d, col, twist = 0) {
  const v = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]; const len = Math.hypot(...v) || 1e-3; const n = v.map((x) => x / len);
  const q = n[1] < -0.9999 ? [1, 0, 0, 0] : quat.normalize([n[2], 0, -n[0], 1 + n[1]]);
  const m = mat4.fromTRS(mat4.create(), [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], quat.mul(q, quat.fromEuler(0, twist, 0)), [1, 1, 1]);
  mb.box(m, w, len, d, col);
}
const metal = (mb) => { mb.flex = METAL; };
const glow = (mb) => { mb.flex = GLOW; };
// friso dourado luminoso (fino)
function trim(mb, m, sx, sy, sz) { const f = mb.flex; mb.flex = GLOW; MeshBuilder.prototype.box.call(mb, m, sx, sy, sz, PAL.trim); mb.flex = f; }
function ring(mb, p, r, axis = 'y', w = 0.02, col = PAL.gold) {
  const R = axis === 'x' ? M(p[0], p[1], p[2], 0, 1, 0, Math.PI / 2) : axis === 'z' ? M(p[0], p[1], p[2], 0, 1, Math.PI / 2) : M(p[0], p[1], p[2]);
  mb.cylinder(mat4.mul(mat4.create(), R, M(0, -w / 2, 0)), r, r, w, 8, col, true);
}

// =====================================================================
// HUMANOIDES — soldado (arma no antebraço), caçador (fuzil) e titã-gorila
// =====================================================================
export function withPal(pal, fn) { if (!pal) return fn(); const o = { ...PAL }; [PAL.body, PAL.plate, PAL.gold, PAL.trim] = pal.map((h) => hex(h)); try { return fn(); } finally { Object.assign(PAL, o); } }
export function palSt(R) { if (!R.pal) return R.st || {}; const [b, p, g, t] = R.pal.map((h) => hex(h)); return { ...(R.st || {}), body: b, plate: p, gold: g, trim: t }; }
export function buildRobotHumanMesh(sk, st) {
  const oldG = PAL.gold, oldT = PAL.trim; if (st.gold) PAL.gold = st.gold; if (st.trim) PAL.trim = st.trim;
  try { return buildRobotHumanMesh0(sk, st); } finally { PAL.gold = oldG; PAL.trim = oldT; }
}
function buildRobotHumanMesh0(sk, st) {
  const mb = new FacetBuilder({ skinned: true }); const W = restWorld(sk), I = sk.index; const k = st.bulk || 1;
  const body = st.body || PAL.body, plate = st.plate || PAL.plate, dark = PAL.dark, gold = PAL.gold, eye = st.eye || PAL.amber;
  const part = (bone, fn) => { mb.setBone(I[bone]); metal(mb); fn(); };
  const yH = W[I.hips][1], yS = W[I.spine][1], yC = W[I.chest][1], yN = W[I.neck][1], yHd = W[I.head][1];
  part('hips', () => { mb.box(M(0, yH - 0.03, 0), 0.34 * k, 0.17, 0.22 * k, body); mb.box(M(0, yH - 0.1, 0.09 * k), 0.16 * k, 0.14, 0.07, plate); trim(mb, M(0, yH + 0.05, 0.112 * k), 0.3 * k, 0.012, 0.006);
    for (const s of [-1, 1]) mb.box(M(s * 0.15 * k, yH - 0.08, 0, 0, 1, 0, s * 0.15), 0.06, 0.16, 0.18 * k, plate); });
  part('spine', () => { for (let i = 0; i < 3; i++) { mb.box(M(0, yS + 0.0 + i * 0.065, 0.02), (0.22 - i * 0.005) * k * (st.belly || 1), 0.055, 0.17 * k, i % 2 ? plate : body); }
    mb.box(M(0, yS + 0.06, -0.08 * k), 0.07, 0.2, 0.06, dark); trim(mb, M(0, yS + 0.06, 0.107 * k), 0.012, 0.17, 0.006); });
  part('chest', () => {
    for (const s of [-1, 1]) mb.box(M(s * 0.09 * k, yC + 0.11, 0.035 * k, s * 0.12, 1, 0.08), 0.19 * k, 0.24, 0.2 * k, plate);
    mb.box(M(0, yC + 0.1, -0.03), 0.4 * k, 0.26, 0.2 * k, body); mb.box(M(0, yC + 0.12, -0.12 * k), 0.34 * k, 0.24, 0.07, plate);
    for (let v = 0; v < 4; v++) mb.box(M(0, yC + 0.05 + v * 0.05, -0.16 * k), 0.06, 0.03, 0.03, dark); // espinha
    trim(mb, M(0, yC + 0.1, 0.14 * k), 0.012, 0.2, 0.006); for (const s of [-1, 1]) trim(mb, M(s * 0.12 * k, yC + 0.0, 0.13 * k, 0, 1, 0, s * 0.5), 0.1 * k, 0.01, 0.006);
    if (st.chestLight) { glow(mb); mb.box(M(0, yC + 0.08, 0.145 * k), 0.05, 0.16, 0.02, st.chestLight); metal(mb); }
    if (st.backpack) { mb.box(M(0, yC + 0.09, -0.21 * k), 0.34 * k, 0.3, 0.14, body); for (const s of [-1, 1]) mb.cylinder(M(s * 0.11 * k, yC + 0.22, -0.25 * k), 0.045, 0.04, 0.2, 6, gold); }
    for (const s of [-1, 1]) { const ps = st.pads || 1; mb.box(M(s * 0.25 * k, yC + 0.2, 0, 0, 1, 0, s * -0.25), 0.17 * k * ps, 0.12 * ps, 0.22 * k * ps, plate); trim(mb, M(s * 0.25 * k, yC + 0.2 + 0.06 * ps, 0.11 * k * ps, 0, 1, 0, s * -0.25), 0.15 * k * ps, 0.01, 0.006); }
  });
  if (st.shoulderDisc || st.shoulderLight) part('chest', () => { for (const s of [-1, 1]) { const x = s * 0.33 * k, y = yC + 0.16;
      if (st.shoulderDisc) { mb.cylinder(M(x, y, 0, 0, 1, 0, Math.PI / 2), 0.17 * k, 0.17 * k, 0.07, 10, plate); mb.cylinder(M(x + s * 0.04, y, 0, 0, 1, 0, Math.PI / 2), 0.1 * k, 0.1 * k, 0.04, 10, st.body || PAL.body);
        glow(mb); ring(mb, [x + s * 0.045, y, 0], 0.13 * k, 'x', 0.02, eye); metal(mb); }
      if (st.shoulderLight) { glow(mb); mb.box(M(s * 0.27 * k, yC + 0.2, 0.07, 0, 1, 0, s * -0.25), 0.05, 0.025, 0.06, eye); mb.box(M(s * 0.3 * k, yC + 0.12, -0.02), 0.012, 0.06, 0.04, eye); metal(mb); } } });
  part('neck', () => { mb.cylinder(M(0, yN - 0.02, 0), 0.05 * k, 0.045 * k, 0.12, 6, dark); for (const s of [-1, 1]) seg(mb, [s * 0.035 * k, yN - 0.02, -0.03], [s * 0.03 * k, yN + 0.1, -0.02], 0.01, 0.01, 5, gold); });
  part('head', () => {
    const hy = yHd + 0.1;
    if (st.head === 'skull') { mb.box(M(0, hy + 0.02, -0.01), 0.16, 0.19, 0.19, body); mb.box(M(0, hy - 0.075, 0.035), 0.12, 0.07, 0.12, plate); mb.box(M(0, hy + 0.1, -0.01), 0.14, 0.04, 0.17, plate);
      for (const s of [-1, 1]) mb.box(M(s * 0.075, hy - 0.01, 0.02), 0.03, 0.1, 0.14, plate); trim(mb, M(0, hy + 0.08, 0.087), 0.1, 0.01, 0.006); glow(mb); for (const s of [-1, 1]) mb.box(M(s * 0.04, hy + 0.025, 0.093), 0.035, 0.022, 0.012, eye); }
    else if (st.head === 'helmet') { // capacete tático: casco arredondado, viseira vermelha em fenda, protetores laterais
      mb.box(M(0, hy + 0.01, -0.01), 0.2, 0.2, 0.22, body); mb.box(M(0, hy + 0.11, -0.02), 0.18, 0.06, 0.2, plate); mb.box(M(0, hy - 0.07, 0.06), 0.15, 0.08, 0.1, plate);
      mb.box(M(0, hy + 0.06, 0.1), 0.19, 0.05, 0.04, plate); for (const s of [-1, 1]) { mb.cylinder(M(s * 0.105, hy + 0.0, 0.0, 0, 1, 0, Math.PI / 2), 0.06, 0.06, 0.04, 8, plate); mb.box(M(s * 0.09, hy - 0.05, 0.05), 0.03, 0.1, 0.1, body); }
      glow(mb); mb.box(M(0, hy + 0.02, 0.112), 0.15, 0.026, 0.012, eye); for (const s of [-1, 1]) mb.box(M(s * 0.05, hy + 0.0, 0.11), 0.03, 0.012, 0.01, eye); }
    else if (st.head === 'visor') { mb.box(M(0, hy, -0.01), 0.19, 0.21, 0.21, body); mb.box(M(0, hy + 0.1, -0.02), 0.17, 0.05, 0.19, plate); mb.box(M(0, hy - 0.08, 0.05), 0.14, 0.06, 0.11, plate);
      glow(mb); mb.box(M(0, hy + 0.02, 0.102), 0.15, 0.03, 0.012, eye); }
    else { // gorila: crânio baixo, testa saliente e focinho
      mb.box(M(0, hy - 0.04, 0.02), 0.2, 0.17, 0.2, body); mb.box(M(0, hy + 0.04, 0.09), 0.2, 0.05, 0.08, plate); mb.box(M(0, hy - 0.1, 0.11), 0.15, 0.08, 0.1, plate); mb.box(M(0, hy + 0.06, -0.04), 0.14, 0.08, 0.14, plate);
      glow(mb); for (const s of [-1, 1]) mb.box(M(s * 0.05, hy, 0.13), 0.035, 0.02, 0.012, eye); }
  });
  for (const s of ['L', 'R']) {
    const sg = s === 'L' ? 1 : -1; const sh = W[I['upperArm' + s]], el = W[I['foreArm' + s]], wr = W[I['hand' + s]]; const g = st.gauntlet || 1;
    part('shoulder' + s, () => { mb.sphere(M(sh[0], sh[1], 0), 0.07 * k, 8, 6, dark); });
    part('upperArm' + s, () => { slab(mb, [sh[0], sh[1] - 0.03, 0], [el[0], el[1] + 0.03, 0], 0.11 * k * (st.armBulk || 1), 0.11 * k * (st.armBulk || 1), body); mb.box(M(sh[0] + sg * 0.05 * k, (sh[1] + el[1]) / 2, 0), 0.03, 0.18, 0.09 * k, plate);
      ring(mb, [el[0], el[1] + 0.01, 0], 0.05 * k * (st.armBulk || 1), 'x', 0.11 * k, gold); });
    part('foreArm' + s, () => { slab(mb, [el[0], el[1] - 0.02, 0], [wr[0], wr[1] + 0.02, 0], 0.11 * k * g, 0.12 * k * g, plate); mb.box(M(wr[0] + sg * 0.03 * k, (el[1] + wr[1]) / 2, -0.04 * k * g), 0.06 * g, 0.18, 0.04, body);
      trim(mb, M(wr[0] + sg * 0.056 * k * g, (el[1] + wr[1]) / 2, 0), 0.006, 0.16, 0.01);
      if (st.blades) mb.box(M(wr[0] + sg * 0.06, (el[1] + wr[1]) / 2 - 0.05, 0.02), 0.012, 0.42, 0.05, PAL.steel); });
    part('hand' + s, () => { mb.box(M(wr[0], wr[1] - 0.06 * g, 0.01), 0.075 * k * g, 0.11 * g, 0.09 * k * g, dark); for (let f = 0; f < 4; f++) mb.box(M(wr[0], wr[1] - 0.13 * g, -0.027 * g + f * 0.019 * g), 0.05 * g, 0.06 * g, 0.016 * g, body); });
  }
  for (const s of ['L', 'R']) {
    const sg = s === 'L' ? 1 : -1; const hp = W[I['thigh' + s]], kn = W[I['shin' + s]], an = W[I['foot' + s]]; const lb = st.legBulk || 1;
    part('thigh' + s, () => { slab(mb, [hp[0], hp[1] + 0.02, 0], [kn[0], kn[1] + 0.04, 0], 0.13 * k * lb, 0.14 * k * lb, body); mb.box(M(hp[0] + sg * 0.06 * k, (hp[1] + kn[1]) / 2, 0.02), 0.035, 0.24, 0.1 * k, plate); trim(mb, M(hp[0], (hp[1] + kn[1]) / 2, 0.072 * k * lb), 0.01, 0.2, 0.006); });
    part('shin' + s, () => { mb.box(M(kn[0], kn[1], 0.05 * k), 0.11 * k * lb, 0.11, 0.07, plate); ring(mb, [kn[0], kn[1], 0], 0.055 * k * lb, 'x', 0.12 * k * lb, PAL.gold);
      slab(mb, [kn[0], kn[1] - 0.03, 0], [an[0], an[1] + 0.04, 0], 0.1 * k * lb, 0.11 * k * lb, body); mb.box(M(an[0], (kn[1] + an[1]) / 2, 0.055 * k * lb), 0.09 * k * lb, 0.3, 0.04, plate); });
    part('foot' + s, () => { mb.box(M(an[0], an[1] - 0.045, 0.045), 0.12 * k * lb, 0.08, 0.26 * k * lb, dark); mb.box(M(an[0], an[1] - 0.02, 0.15 * k * lb), 0.11 * k * lb, 0.06, 0.07, plate); });
  }
  // arma no antebraço direito (soldado): em repouso aponta para baixo, ao mirar aponta para frente
  if (st.armGun) { const el = W[I.foreArmR], wr = W[I.handR]; mb.setBone(I.foreArmR); metal(mb);
    mb.box(M(wr[0] - 0.08, (el[1] + wr[1]) / 2 - 0.04, 0.02), 0.09, 0.32, 0.12, body); for (let b = 0; b < 3; b++) mb.cylinder(M(wr[0] - 0.08 + (b - 1) * 0.025, wr[1] - 0.02, 0.03, 0, 1, Math.PI), 0.016, 0.016, 0.3, 6, PAL.steel);
    ring(mb, [wr[0] - 0.08, wr[1] - 0.08, 0.03], 0.05, 'y', 0.03, PAL.gold); trim(mb, M(wr[0] - 0.08, (el[1] + wr[1]) / 2, 0.085), 0.05, 0.2, 0.006); }
  if (st.smg) { const wr = W[I.handR]; mb.setBone(I.handR); metal(mb); const x = wr[0], y = wr[1];
    mb.box(M(x, y - 0.1, 0.06), 0.045, 0.1, 0.06, PAL.dark); // empunhadura
    mb.box(M(x, y - 0.24, 0.1), 0.06, 0.36, 0.09, st.body || PAL.body); mb.box(M(x, y - 0.24, 0.155), 0.04, 0.3, 0.02, PAL.dark); // caixa e trilho
    mb.box(M(x, y - 0.22, 0.02), 0.04, 0.08, 0.1, PAL.dark); // carregador
    mb.cylinder(M(x, y - 0.42, 0.1, 0, 1, Math.PI), 0.024, 0.024, 0.2, 8, PAL.steel); mb.cylinder(M(x, y - 0.6, 0.1, 0, 1, Math.PI), 0.016, 0.016, 0.1, 6, PAL.dark);
    mb.box(M(x, y + 0.05, 0.1), 0.04, 0.2, 0.05, PAL.dark); glow(mb); mb.box(M(x + 0.032, y - 0.26, 0.1), 0.006, 0.08, 0.012, eye); metal(mb); }
  if (st.rifle) { const wr = W[I.handR]; mb.setBone(I.handR); metal(mb);
    mb.box(M(wr[0], wr[1] - 0.35, 0.03), 0.06, 0.6, 0.1, body); mb.box(M(wr[0], wr[1] - 0.12, -0.04), 0.05, 0.18, 0.08, dark); mb.box(M(wr[0], wr[1] - 0.28, 0.1), 0.04, 0.16, 0.07, plate);
    mb.cylinder(M(wr[0], wr[1] - 0.64, 0.04, 0, 1, Math.PI), 0.02, 0.02, 0.26, 6, PAL.steel); trim(mb, M(wr[0], wr[1] - 0.4, 0.082), 0.03, 0.2, 0.006); }
  if (st.cannon) { const el = W[I.foreArmR], wr = W[I.handR]; mb.setBone(I.foreArmR); metal(mb);
    mb.box(M(wr[0] - 0.02, (el[1] + wr[1]) / 2 - 0.05, 0.02), 0.17, 0.36, 0.17, body); mb.cylinder(M(wr[0] - 0.02, wr[1] - 0.04, 0.02, 0, 1, Math.PI), 0.065, 0.055, 0.24, 8, dark);
    glow(mb); mb.box(M(wr[0] - 0.02, (el[1] + wr[1]) / 2, 0.11), 0.07, 0.14, 0.012, eye); }
  return mb.build();
}

// =====================================================================
// QUADRÚPEDES — tigre-canhão e rinoceronte (esqueleto quadrúpede)
// =====================================================================
export function buildRobotQuadMesh(sk, st) {
  const mb = new FacetBuilder({ skinned: true }); const W = restWorld(sk), I = sk.index; const k = st.bulk;
  const body = PAL.body, plate = PAL.plate, dark = PAL.dark, gold = PAL.gold;
  const part = (b, fn) => { mb.setBone(I[b]); metal(mb); fn(); };
  const P = W[I.pelvis], S = W[I.spine], C = W[I.chest], Hd = W[I.head], N = W[I.neck];
  part('pelvis', () => { mb.box(M(0, P[1] + 0.02, P[2] + 0.02), 0.3 * k, 0.28 * k, 0.34, body); mb.box(M(0, P[1] + 0.15 * k, P[2]), 0.26 * k, 0.07, 0.32, plate);
    for (const s of [-1, 1]) { mb.box(M(s * 0.15 * k, P[1] + 0.02, P[2] + 0.02), 0.04, 0.24 * k, 0.3, plate); trim(mb, M(s * 0.172 * k, P[1] + 0.02, P[2] + 0.02), 0.006, 0.18 * k, 0.012); } });
  part('spine', () => { mb.box(M(0, S[1] + 0.0, S[2] + 0.02), 0.27 * k, 0.24 * k, 0.36, dark);
    for (let i = 0; i < 3; i++) { mb.box(M(0, S[1] + 0.13 * k, S[2] - 0.11 + i * 0.11), 0.26 * k, 0.05, 0.1, plate); trim(mb, M(0, S[1] + 0.157 * k, S[2] - 0.11 + i * 0.11 + 0.045), 0.2 * k, 0.006, 0.01); }
    for (const s of [-1, 1]) mb.box(M(s * 0.14 * k, S[1], S[2]), 0.04, 0.2 * k, 0.32, plate); });
  part('chest', () => { mb.box(M(0, C[1] + 0.02, C[2]), 0.34 * k, 0.34 * k, 0.32, body); mb.box(M(0, C[1] - 0.1 * k, C[2] + 0.12), 0.26 * k, 0.16, 0.13, plate);
    for (const s of [-1, 1]) { mb.box(M(s * 0.17 * k, C[1] + 0.03, C[2]), 0.05, 0.26 * k, 0.26, plate); trim(mb, M(s * 0.197 * k, C[1] + 0.03, C[2] + 0.06), 0.006, 0.2 * k, 0.01); }
    if (st.turret) { const ty = C[1] + 0.2 * k; mb.box(M(0, ty, C[2] - 0.06), 0.22, 0.1, 0.28, dark); mb.box(M(0, ty + 0.09, C[2] - 0.04), 0.17, 0.12, 0.2, plate); ring(mb, [0, ty + 0.04, C[2] - 0.05], 0.12, 'y', 0.03, gold); } });
  part('neck', () => { slab(mb, [0, N[1] - 0.06, N[2] - 0.1], [0, Hd[1] - 0.04, Hd[2] - 0.04], 0.24 * k, 0.2 * k, dark); mb.box(M(0, N[1] + 0.06, N[2] - 0.02), 0.2 * k, 0.06, 0.2, plate); });
  part('head', () => {
    const hy = Hd[1] + 0.02, hz = Hd[2] + 0.06;
    if (st.horn) { // rinoceronte: cabeça longa, chifre grande e chifre menor
      mb.box(M(0, hy - 0.02, hz + 0.04), 0.22 * k, 0.2 * k, 0.32, body); mb.box(M(0, hy - 0.07, hz + 0.24), 0.17 * k, 0.13, 0.17, plate); mb.box(M(0, hy + 0.08, hz - 0.04), 0.18 * k, 0.06, 0.2, plate);
      mb.cylinder(M(0, hy + 0.0, hz + 0.3, 0, 1, -1.05), 0.07, 0.0, 0.36, 5, gold); mb.cylinder(M(0, hy + 0.07, hz + 0.1, 0, 1, -0.6), 0.045, 0.0, 0.17, 5, gold);
      for (const s of [-1, 1]) mb.cylinder(M(s * 0.09, hy + 0.1, hz - 0.1, 0, 1, 0, s * -0.3), 0.035, 0.005, 0.1, 4, plate); trim(mb, M(0, hy + 0.115, hz + 0.0), 0.12, 0.006, 0.12); }
    else { // tigre: focinho facetado, orelhas, mandíbula
      mb.box(M(0, hy, hz), 0.22 * k, 0.17 * k, 0.26, body); mb.box(M(0, hy - 0.04, hz + 0.17), 0.15 * k, 0.1, 0.14, plate); mb.box(M(0, hy - 0.1, hz + 0.12), 0.13, 0.05, 0.14, dark);
      for (const s of [-1, 1]) { mb.cylinder(M(s * 0.08, hy + 0.08, hz - 0.05, 0, 1, 0, s * -0.25), 0.045, 0.0, 0.1, 4, plate); mb.box(M(s * 0.1 * k, hy - 0.02, hz + 0.02), 0.03, 0.12, 0.2, plate); }
      trim(mb, M(0, hy + 0.088 * k, hz + 0.05), 0.006, 0.006, 0.18); }
    glow(mb); for (const s of [-1, 1]) mb.box(M(s * 0.065 * k, hy + 0.035, hz + (st.horn ? 0.17 : 0.13)), 0.04, 0.022, 0.014, st.eye || PAL.amber);
  });
  part('tail', () => { const T = W[I.tail]; let p0 = [0, T[1], T[2]]; for (let i = 0; i < 6; i++) { const p1 = [0, p0[1] + (st.horn ? 0.03 - i * 0.012 : 0.01 + i * 0.02), p0[2] - 0.09]; seg(mb, p0, p1, 0.04 - i * 0.004, 0.035 - i * 0.004, 6, i % 2 ? gold : body); p0 = p1; } });
  for (const L of ['FL', 'FR', 'BL', 'BR']) {
    const u = W[I['up' + L]], l = W[I['lo' + L]], p = W[I['paw' + L]]; const fr = L[0] === 'F';
    part('up' + L, () => { slab(mb, [u[0], u[1] + 0.06, u[2]], l, (fr ? 0.14 : 0.17) * k, 0.15 * k, body); mb.box(M(u[0] * 1.2, u[1] - 0.08, u[2]), 0.04, 0.18, 0.14, plate); trim(mb, M(u[0] * 1.32, u[1] - 0.08, u[2]), 0.006, 0.14, 0.01); });
    part('lo' + L, () => { ring(mb, l, 0.06 * k, 'x', 0.1 * k, gold); slab(mb, l, [p[0], p[1] + 0.02, p[2]], 0.08 * k, 0.09 * k, plate); });
    part('paw' + L, () => { mb.box(M(p[0], p[1] - 0.03, p[2] + 0.03), 0.11 * k, 0.07, 0.15, dark); for (const t of [-1, 0, 1]) mb.cylinder(M(p[0] + t * 0.03 * k, p[1] - 0.05, p[2] + 0.11, 0, 1, Math.PI / 2), 0.012, 0.0, 0.05, 4, gold); });
  }
  return mb.build();
}

// =====================================================================
// ARTRÓPODES — abelhas, aranhas, formigas, besouro-hércules, escorpião, aranha-tanque, libélulas
// =====================================================================
export function makeBugSkeleton(p) {
  const bones = [B('body', -1, [0, p.h, 0]), B('head', 0, [0, 0.02, p.len * 0.5]), B('abdomen', 0, [0, 0.03, -p.len * 0.42])];
  const n = p.legs / 2;
  for (let i = 0; i < n; i++) { const z = p.len * 0.3 - (n > 1 ? (i / (n - 1)) * p.len * 0.6 : 0);
    for (const s of [1, -1]) { const S = s > 0 ? 'L' : 'R'; bones.push(B(`${S}${i}a`, 0, [s * p.side, 0, z])); bones.push(B(`${S}${i}b`, bones.length - 1, [s * p.l1 * 0.8, p.l1 * 0.6, 0])); } }
  for (let k = 0; k < p.wings; k++) for (const s of [1, -1]) bones.push(B(`w${s > 0 ? 'L' : 'R'}${k}`, 0, [s * 0.05, p.wingY, p.len * 0.12 - k * p.len * 0.22]));
  if (p.tail) { let parent = 2; const segL = p.tailSeg; bones.push(B('tail0', parent, [0, 0.02, -p.abd * 1.7])); for (let i = 1; i < p.tail; i++) bones.push(B('tail' + i, bones.length - 1, [0, 0, -segL])); }
  const sk = new Skeleton(bones); sk.bug = p; return sk;
}
export function buildBugMesh(sk, p, st) {
  const mb = new FacetBuilder({ skinned: true }); const W = restWorld(sk), I = sk.index; const n = p.legs / 2;
  const body = PAL.body, plate = PAL.plate, dark = PAL.dark, gold = PAL.gold, eye = st.eye || PAL.amber;
  // tórax
  mb.setBone(I.body); metal(mb);
  if (st.tank) { // aranha mutante: tórax pequeno, abdômen enorme listrado com fiandeira, cachos de olhos e presas (a caixa das costas é desenhada à parte)
    mb.box(M(0, p.h, p.len * 0.12), p.bw * 1.6, p.bh * 1.8, p.len * 0.55, body); mb.box(M(0, p.h + p.bh * 0.85, p.len * 0.1), p.bw * 1.3, p.bh * 0.4, p.len * 0.45, plate);
    const az = -p.len * 0.55, ay = p.h + 0.18; mb.sphere(M(0, ay, az, 0, [1.05, 0.95, 1.45]), 0.42, 12, 9, body);
    for (let k = 0; k < 5; k++) { const z = az + 0.42 - k * 0.2; const rr = Math.sqrt(Math.max(0, 1 - Math.pow((z - az) / (0.42 * 1.45), 2))) * 0.42; if (rr < 0.05) continue; mb.cylinder(M(0, ay, z, 0, 1, Math.PI / 2), rr * 1.06, rr * 1.06, 0.06, 12, k % 2 ? gold : plate); }
    glow(mb); for (let k = 0; k < 6; k++) { const a = k * 1.047; mb.sphere(M(Math.cos(a) * 0.14, ay + 0.38, az + Math.sin(a) * 0.2), 0.035, 6, 4, PAL.trim); } metal(mb);
    mb.cylinder(M(0, ay - 0.05, az - 0.58, 0, 1, -Math.PI / 2), 0.09, 0.02, 0.18, 8, dark); // fiandeira (atira teia pela traseira)
    const hz2 = p.len * 0.45; glow(mb); for (let k = 0; k < 8; k++) { const ex = (k % 4 - 1.5) * 0.055, ey = p.h + 0.06 + Math.floor(k / 4) * 0.06; mb.sphere(M(ex, ey, hz2 + 0.02), k < 4 ? 0.03 : 0.022, 6, 4, eye); } metal(mb);
    for (const sx of [-1, 1]) { mb.cylinder(M(sx * 0.06, p.h - 0.05, hz2 + 0.02, 0, 1, Math.PI * 0.62), 0.03, 0.005, 0.2, 5, gold); }

  } else {
    mb.sphere(M(0, p.h, 0, 0, [p.bw, p.bh, p.len * 0.42]), 1, 8, 6, body);
    mb.box(M(0, p.h + p.bh * 0.75, 0), p.bw * 1.3, p.bh * 0.35, p.len * 0.6, plate); trim(mb, M(0, p.h + p.bh * 0.93, 0), 0.012, 0.006, p.len * 0.5);
  }
  if (st.dish) { for (const s of [-1, 1]) { const dx = s * p.bw * 0.6; mb.cylinder(M(dx, p.h + p.bh * 0.8, -0.02), 0.018, 0.018, 0.3, 5, dark);
      mb.cylinder(M(dx, p.h + p.bh * 0.8 + 0.36, 0, 0, 1, -0.6, s * 0.4), 0.2, 0.035, 0.07, 8, plate); ring(mb, [dx, p.h + p.bh * 0.8 + 0.37, 0], 0.2, 'y', 0.012, gold);
      glow(mb); mb.sphere(M(dx, p.h + p.bh * 0.8 + 0.4, 0.04), 0.025, 6, 4, eye); metal(mb); }
    for (const s of [-1, 1]) mb.box(M(s * p.bw * 1.05, p.h + 0.05, p.len * 0.25, 0, 1, 0, s * 0.4), 0.18, 0.05, 0.1, plate); } // pinças curtas de caranguejo
  if (st.shell) { for (const s of [-1, 1]) { mb.box(M(s * p.bw * 0.48, p.h + p.bh * 0.6, -p.len * 0.08, 0, 1, 0, s * 0.35), p.bw * 0.95, 0.06, p.len * 1.05, plate); trim(mb, M(s * p.bw * 0.05, p.h + p.bh * 0.85, -p.len * 0.08), 0.008, 0.006, p.len * 0.95); } }
  if (st.cargo) { // transportador industrial: contêiner com nervuras, faixas de alerta e luzes
    const cy = p.h + p.bh * 1.2 + 0.28; mb.box(M(0, cy, -0.02), p.bw * 2.3, 0.56, p.len * 1.15, PAL.plate);
    for (let k = 0; k < 7; k++) mb.box(M(0, cy, -p.len * 0.5 + k * p.len * 0.16), p.bw * 2.36, 0.5, 0.025, PAL.body);
    glow(mb); for (const sx of [-1, 1]) mb.box(M(sx * p.bw * 1.18, cy - 0.2, -0.02), 0.01, 0.05, p.len * 1.05, PAL.amber); mb.box(M(0, cy + 0.3, p.len * 0.5), 0.12, 0.05, 0.05, PAL.amber); metal(mb);
    mb.box(M(0, cy + 0.32, -0.02), p.bw * 1.6, 0.06, p.len * 0.9, PAL.dark); }
  if (st.drone) { // drone: quatro braços com rotores carenados, câmera de vigilância e antena
    for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) { const ax = sx * 0.3, az = sz * 0.26;
      seg(mb, [0, p.h + 0.02, 0], [ax, p.h + 0.05, az], 0.025, 0.02, 6, PAL.body); mb.cylinder(M(ax, p.h + 0.02, az), 0.15, 0.15, 0.05, 14, PAL.dark, false);
      ring(mb, [ax, p.h + 0.05, az], 0.15, 'y', 0.025, gold); mb.cylinder(M(ax, p.h + 0.05, az), 0.025, 0.025, 0.04, 8, PAL.steel || plate); mb.box(M(ax, p.h + 0.075, az, sx * sz * 0.6), 0.27, 0.006, 0.03, PAL.dark); }
    mb.sphere(M(0, p.h - 0.07, 0.1), 0.065, 8, 6, PAL.dark); glow(mb); mb.sphere(M(0, p.h - 0.08, 0.16), 0.025, 6, 4, PAL.red); metal(mb);
    mb.cylinder(M(0.05, p.h + 0.07, -0.12), 0.008, 0.004, 0.22, 5, PAL.dark); }
  // cabeça
  mb.setBone(I.head); metal(mb); const hz = W[I.head][2];
  if (!st.tank) mb.sphere(M(0, p.h + 0.02, hz + p.head * 0.3, 0, [1, 0.85, 1]), p.head, 8, 6, dark);
  if (st.horn) { // chifre de besouro-hércules: curva para cima e para frente
    let a = [0, p.h + 0.05, hz + p.head * 0.7]; const pts = [[0, 0.1, 0.18], [0, 0.18, 0.14], [0, 0.2, 0.04], [0, 0.14, -0.06], [0, 0.06, -0.08]];
    pts.forEach((d, i) => { const b = [a[0] + d[0] * p.head * 4, a[1] + d[1] * p.head * 3.2, a[2] + d[2] * p.head * 3.6]; seg(mb, a, b, p.head * (0.32 - i * 0.05), p.head * (0.28 - i * 0.05), 6, i % 2 ? body : plate); a = b; });
    mb.cylinder(M(0, p.h + p.head * 0.9, hz, 0, 1, -0.5), p.head * 0.3, 0.01, p.head * 1.6, 5, plate); }
  if (st.drill) { // broca rotativa na cabeça (formiga perfuradora)
    const z0 = hz + p.head * 0.9; mb.cylinder(M(0, p.h + 0.01, z0, 0, 1, Math.PI / 2), p.head * 0.42, p.head * 0.38, p.head * 0.35, 10, plate);
    mb.cylinder(M(0, p.h + 0.01, z0 + p.head * 0.35, 0, 1, Math.PI / 2), p.head * 0.36, 0.004, p.head * 1.9, 10, PAL.steel || plate);
    for (let k = 0; k < 6; k++) { const t = k / 6, rr = p.head * 0.36 * (1 - t) + 0.006; ring(mb, [0, p.h + 0.01, z0 + p.head * (0.45 + t * 1.6)], rr, 'z', p.head * 0.08, k % 2 ? gold : dark); } }
  if (st.mandibles) for (const s of [-1, 1]) mb.cylinder(M(s * p.head * 0.45, p.h - 0.02, hz + p.head * 1.0, 0, 1, -1.3, s * 0.5), p.head * 0.18, 0.005, p.head * 0.9, 4, gold);
  if (st.antennae) for (const s of [-1, 1]) mb.cylinder(M(s * p.head * 0.3, p.h + p.head * 0.6, hz + p.head * 0.6, 0, 1, -0.7, -s * 0.5), 0.012, 0.006, p.head * 3, 4, dark);
  if (st.claws) for (const s of [-1, 1]) { // pinças do escorpião
    const a = [s * p.head * 0.7, p.h, hz], e = [s * p.head * 2.6, p.h + 0.03, hz + p.head * 2.2], c = [s * p.head * 2.2, p.h + 0.04, hz + p.head * 4.0];
    slab(mb, a, e, p.head * 0.45, p.head * 0.4, body); ring(mb, e, p.head * 0.28, 'y', p.head * 0.3, gold); slab(mb, e, c, p.head * 0.75, p.head * 0.55, plate);
    seg(mb, c, [c[0] - s * p.head * 0.35, c[1], c[2] + p.head * 1.4], p.head * 0.22, 0.01, 5, dark); seg(mb, c, [c[0] + s * p.head * 0.3, c[1], c[2] + p.head * 1.3], p.head * 0.2, 0.01, 5, gold); }
  glow(mb); const ne = st.eyes ?? 2;
  for (let e = 0; e < ne; e++) { const s = e % 2 ? -1 : 1, row = Math.floor(e / 2); const ex = s * p.head * (0.42 - row * 0.14), ey = p.h + 0.04 + row * p.head * 0.32, ez = hz + p.head * (1.0 - row * 0.14);
    if (st.bigEyes) mb.sphere(M(ex * 1.15, ey + p.head * 0.1, ez - p.head * 0.15), p.head * 0.42, 6, 4, eye); else mb.box(M(ex, ey, ez), p.head * 0.24, p.head * 0.16, p.head * 0.08, eye); }
  // abdômen
  mb.setBone(I.abdomen); metal(mb); const az = W[I.abdomen][2];
  if (st.longAbd) { for (let r2 = 0; r2 < 8; r2++) { const z = az - p.abd * (0.2 + r2 * 0.75); mb.box(M(0, p.h + 0.02, z), p.abd * (0.85 - r2 * 0.05), p.abd * (0.8 - r2 * 0.05), p.abd * 0.7, r2 % 2 ? body : plate); if (r2 % 2 === 0) trim(mb, M(0, p.h + 0.02 + p.abd * 0.4, z), p.abd * 0.4, 0.006, p.abd * 0.4); } }
  else if (!st.tank) {
    mb.sphere(M(0, p.h + 0.04, az - p.abd * 0.8, 0, [p.abdW || 1, 0.85, 1.3]), p.abd, 8, 6, body);
    const nr = st.stripes ? 4 : 2; for (let r2 = 0; r2 < nr; r2++) { const z = az - p.abd * (0.25 + r2 * (1.2 / nr)); const rr = p.abd * Math.sin(Math.PI * (0.25 + r2 * (1.2 / nr)) / 1.6) * 0.98 + 0.01;
      if (st.stripes) { glow(mb); mb.cylinder(M(0, p.h + 0.04, z, 0, 1, Math.PI / 2), rr * (p.abdW || 1), rr * (p.abdW || 1), p.abd * 0.12, 8, PAL.trim, false); metal(mb); }
      else mb.box(M(0, p.h + 0.04 + rr * 0.8, z), rr * 0.9, 0.04, p.abd * 0.3, plate); }
    if (st.abdGlow) { glow(mb); mb.box(M(0, p.h + p.abd * 0.82, az - p.abd * 0.8), p.abd * 0.35, 0.02, p.abd * 0.6, st.abdGlow); metal(mb); }
  }
  if (st.stinger) mb.cylinder(M(0, p.h, az - p.abd * 2.0, 0, 1, -Math.PI / 2), p.abd * 0.22, 0.0, p.abd * 0.8, 5, gold);
  // cauda articulada (escorpião)
  if (p.tail) for (let i = 0; i < p.tail; i++) { const tb = W[I['tail' + i]]; mb.setBone(I['tail' + i]); metal(mb); const r = p.abd * (0.5 - i * 0.06);
    slab(mb, tb, [tb[0], tb[1], tb[2] - p.tailSeg], r * 1.5, r * 1.3, i % 2 ? plate : body); trim(mb, M(tb[0], tb[1] + r * 0.66, tb[2] - p.tailSeg / 2), 0.01, 0.006, p.tailSeg * 0.7);
    if (i === p.tail - 1) { mb.sphere(M(tb[0], tb[1], tb[2] - p.tailSeg - r * 0.6), r * 1.1, 8, 6, plate); mb.cylinder(M(tb[0], tb[1] - r * 0.3, tb[2] - p.tailSeg - r * 1.2, 0, 1, -2.4), r * 0.4, 0.0, r * 2.4, 5, gold); glow(mb); mb.sphere(M(tb[0], tb[1] + r * 0.6, tb[2] - p.tailSeg - r * 0.6), r * 0.35, 5, 4, eye); metal(mb); } }
  // pernas: coxa e tíbia blindadas, articulações douradas
  for (let i = 0; i < n; i++) for (const s of [1, -1]) {
    const S = s > 0 ? 'L' : 'R'; const hip = W[I[`${S}${i}a`]], knee = W[I[`${S}${i}b`]]; const front = (n - 1) / 2 - i;
    const foot = [knee[0] + s * p.l2 * 0.45, 0.0, knee[2] + front * p.l2 * 0.18];
    mb.setBone(I[`${S}${i}a`]); metal(mb); slab(mb, hip, knee, p.legR * 2.2, p.legR * 2.0, body); mb.sphere(M(...knee), p.legR * 1.4, 6, 4, gold);
    mb.setBone(I[`${S}${i}b`]); metal(mb); const mid = [(knee[0] + foot[0]) / 2, (knee[1] + foot[1]) / 2, (knee[2] + foot[2]) / 2];
    slab(mb, knee, mid, p.legR * 1.9, p.legR * 1.7, plate); ring(mb, mid, p.legR * 1.1, 'y', p.legR * 0.8, gold); seg(mb, mid, foot, p.legR * 0.85, p.legR * 0.3, 5, dark);
  }
  if (st.solar) { solarWings(mb, sk, p, st, W, I); if (st.antennaeGlow !== false) { mb.setBone(I.head); const hz = W[I.head][2]; for (const s of [-1, 1]) { const a = [s * 0.05, p.h + p.head * 0.7, hz + p.head * 0.6], b = [s * 0.16, p.h + p.head * 3.2, hz + p.head * 1.6];
      metal(mb); seg(mb, a, b, 0.012, 0.008, 5, PAL.dark); glow(mb); mb.sphere(M(...b), 0.035, 6, 4, st.eye); metal(mb); } } return mb.build(); }
  // asas: membrana escura translúcida com nervuras douradas (ou azul iridescente nas libélulas)
  for (let k = 0; k < p.wings; k++) for (const s of [1, -1]) {
    const S = s > 0 ? 'L' : 'R'; const wb = W[I[`w${S}${k}`]]; mb.setBone(I[`w${S}${k}`]); metal(mb);
    const L = p.wingL * (k ? 0.85 : 1), Wd = p.wingW * (k ? 0.85 : 1); const cx = wb[0] + s * L / 2, cz = wb[2] - Wd * 0.25;
    MeshBuilder.prototype.box.call(mb, M(cx, wb[1], cz, s * 0.12), L, 0.008, Wd, st.wing || hex(0x3a3830));
    glow(mb); const vc = st.wingVein || PAL.trim;
    MeshBuilder.prototype.box.call(mb, M(cx, wb[1] + 0.006, cz + Wd * 0.35, s * 0.12), L * 0.98, 0.006, 0.012, vc);
    for (let v = 0; v < 4; v++) MeshBuilder.prototype.box.call(mb, M(wb[0] + s * L * (0.2 + v * 0.2), wb[1] + 0.006, cz, s * (0.12 + v * 0.06)), 0.008, 0.006, Wd * 0.85, vc);
    MeshBuilder.prototype.box.call(mb, M(cx, wb[1] + 0.006, cz - Wd * 0.05, s * 0.12), L * 0.8, 0.006, 0.008, vc); metal(mb);
  }
  return mb.build();
}
// Asas de painel solar (borboleta solar): contorno de asa real, moldura cinza, células azuis com grade
// branca e cantos luminosos; frente e verso (as asas são vistas dos dois lados)
const WING_UP = [[0.05, 0.0], [0.28, 0.42], [0.62, 0.62], [0.98, 0.66], [1.0, 0.34], [0.72, 0.02], [0.32, -0.12]];
const WING_LO = [[0.05, -0.02], [0.4, 0.0], [0.72, -0.18], [0.72, -0.5], [0.42, -0.62], [0.16, -0.36]];
function solarWings(mb, sk, p, st, W, I) {
  const cell = hex(0x2a56c0), cellD = hex(0x1d3f94), frame = hex(0x6a6e78), grid = hex(0xc8d8f0), glowC = st.eye;
  for (let k = 0; k < 2; k++) for (const s of [1, -1]) {
    const S = s > 0 ? 'L' : 'R'; const wb = W[I[`w${S}${k}`]]; mb.setBone(I[`w${S}${k}`]);
    const L = p.wingL * (k ? 0.82 : 1), Wd = p.wingW * (k ? 0.85 : 1); const outline = (k ? WING_LO : WING_UP).map(([u, v]) => [wb[0] + s * u * L, wb[2] + v * Wd + (k ? -0.04 : 0.06)]);
    const y = wb[1]; const c = outline.reduce((a, q) => [a[0] + q[0] / outline.length, a[1] + q[1] / outline.length], [0, 0]);
    // painel (frente e verso)
    mb.flex = 0.875; for (const side of [1, -1]) { const ctr = mb.vert([c[0], y + side * 0.006, c[1]], [0, side, 0], cell);
      const ids = outline.map(([x, z], i) => mb.vert([x, y + side * 0.006, z], [0, side, 0], i % 2 ? cell : cellD));
      for (let i = 0; i < ids.length; i++) { const a = ids[i], b = ids[(i + 1) % ids.length]; if ((side > 0) === (s > 0)) mb.tri(ctr, b, a); else mb.tri(ctr, a, b); } }
    // grade das células: linhas da raiz até a borda e anéis concêntricos
    glow(mb); const lineAt = (a, b, w, col) => { const dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz); MeshBuilder.prototype.box.call(mb, M((a[0] + b[0]) / 2, y, (a[1] + b[1]) / 2, Math.atan2(dx, dz)), w, 0.016, len, col); };
    mb.flex = 0.5; const root = outline[0];
    for (let i = 1; i < outline.length - 1; i++) lineAt(root, outline[i], 0.008, grid);
    for (const f of [0.35, 0.68]) for (let i = 1; i < outline.length - 1; i++) { const a = outline[i], b = outline[i + 1]; lineAt([root[0] + (a[0] - root[0]) * f, root[1] + (a[1] - root[1]) * f], [root[0] + (b[0] - root[0]) * f, root[1] + (b[1] - root[1]) * f], 0.008, grid); }
    // moldura e cantos luminosos
    metal(mb); for (let i = 0; i < outline.length; i++) lineAt(outline[i], outline[(i + 1) % outline.length], 0.035, frame);
    glow(mb); for (const i of [2, 3]) { const q = outline[i]; mb.sphere(M(q[0], y, q[1]), 0.025, 5, 3, glowC); } metal(mb);
  }
}
function bugPose(sk, p, ph, o) {
  const n = p.legs / 2, bones = {};
  for (let i = 0; i < n; i++) for (const s of [1, -1]) {
    const S = s > 0 ? 'L' : 'R'; const off = ((i + (s < 0 ? 1 : 0)) % 2) * 0.5; const w = (ph + off) * TAU;
    const swing = -s * Math.sin(w) * o.A, lift = Math.max(0, Math.cos(w)) * o.B;
    bones[`${S}${i}a`] = [0, swing, s * (lift + (o.legUp || 0))]; bones[`${S}${i}b`] = [0, 0, -s * (lift * 0.4 + (o.curl || 0))];
  }
  for (let k = 0; k < p.wings; k++) { const f = o.flap ? Math.sin(ph * TAU * o.flap + k * 0.7) * o.flapA : 0;
    bones[`wL${k}`] = [0, o.flap ? 0 : -0.9 - k * 0.15, f + (o.flap ? 0.1 : -0.15)]; bones[`wR${k}`] = [0, o.flap ? 0 : 0.9 + k * 0.15, -f - (o.flap ? 0.1 : -0.15)]; }
  if (p.tail) for (let i = 0; i < p.tail; i++) bones['tail' + i] = [(i === 0 ? 0.45 : 0.66) * (o.tailCurl ?? 0.62) / 0.62 + (o.tailWave || 0) * Math.sin(ph * TAU + i), 0, 0];
  bones.body = [o.pitch || 0, 0, o.roll || 0]; bones.head = [o.headX || 0, o.headY || 0, 0]; bones.abdomen = [o.abdX || 0, 0, 0];
  return { root: [0, o.y || 0, o.z || 0], bones };
}
export function buildBugClips(sk, p, flyer) {
  const C = {}; const mk = (n, d, fn, op) => (C[n] = bakeClip(sk, n, d, fn, op));
  const wf = p.flapRate || 6;
  if (flyer) {
    mk('idle', 1, (ph) => bugPose(sk, p, ph, { A: 0.05, B: 0, legUp: -0.5, curl: 0.4, flap: wf, flapA: p.flapA || 0.9, y: 0.04 * Math.sin(ph * TAU), pitch: 0.05 }));
    mk('walk', 1, (ph) => bugPose(sk, p, ph, { A: 0.05, B: 0, legUp: -0.6, curl: 0.4, flap: wf, flapA: p.flapA || 0.9, pitch: 0.15 }));
    mk('run', 1, (ph) => bugPose(sk, p, ph, { A: 0.05, B: 0, legUp: -0.7, curl: 0.5, flap: wf * 1.4, flapA: p.flapA || 0.9, pitch: 0.3 }));
    mk('attack', 0.7, (ph) => bugPose(sk, p, ph, { A: 0, B: 0, legUp: kf(ph, [[0, -0.6], [0.5, 0.3], [1, -0.6]]), curl: 0.2, flap: wf * 0.7, flapA: p.flapA || 0.9, pitch: kf(ph, [[0, 0.2], [0.5, -0.4], [1, 0.2]]), abdX: kf(ph, [[0, 0], [0.5, 0.9], [1, 0]]) }), { loop: false, events: [{ t: 0.5, name: 'hit' }] });
    mk('hit', 0.35, (ph) => bugPose(sk, p, ph, { A: 0, B: 0, legUp: -0.5, flap: wf, flapA: 0.4, roll: 0.5 * Math.sin(ph * Math.PI) }), { loop: false });
    mk('die', 1.0, (ph) => bugPose(sk, p, 0, { A: 0, B: 0, legUp: 0.6 * ph, curl: 0.9 * ph, flap: 0, flapA: 0, roll: 2.9 * kf(ph, [[0, 0], [1, 1]]), y: p.bh * 0.3 * ph }), { loop: false });
  } else {
    mk('idle', 2.2, (ph) => bugPose(sk, p, ph, { A: 0.03, B: 0.04, y: 0.01 * Math.sin(ph * TAU), headY: 0.15 * Math.sin(ph * TAU), tailWave: 0.05 }));
    mk('walk', 0.75, (ph) => bugPose(sk, p, ph, { A: 0.32, B: 0.35, y: 0.012 * Math.cos(ph * TAU * 2), tailWave: 0.06 }));
    mk('run', 0.42, (ph) => bugPose(sk, p, ph, { A: 0.45, B: 0.5, y: 0.02 * Math.cos(ph * TAU * 2), pitch: 0.06, tailWave: 0.08 }));
    mk('attack', 0.75, (ph) => { const u = kf(ph, [[0, 0], [0.4, 1], [0.55, -0.6], [0.75, -0.5], [1, 0]]);
      const o = bugPose(sk, p, 0, { A: 0, B: 0, pitch: -0.35 * Math.max(0, u) + 0.2 * Math.max(0, -u), y: 0.08 * Math.max(0, u), z: 0.2 * Math.max(0, -u), headX: 0.3 * Math.max(0, -u), tailCurl: 0.62 + 0.25 * Math.max(0, u) - 0.15 * Math.max(0, -u) });
      for (const s of ['L', 'R']) { const sg = s === 'L' ? 1 : -1; o.bones[`${s}0a`] = [0, -sg * 0.4 * Math.max(0, -u), sg * (0.9 * Math.max(0, u))]; o.bones[`${s}0b`] = [0, 0, -sg * 0.6 * Math.max(0, u)]; }
      if (p.tail) o.bones['tail' + (p.tail - 1)] = [0.62 + 1.0 * Math.max(0, -u), 0, 0]; // ferroada
      return o; }, { loop: false, events: [{ t: 0.52, name: 'hit' }] });
    mk('hit', 0.35, (ph) => bugPose(sk, p, ph, { A: 0, B: 0.2, roll: 0.25 * Math.sin(ph * Math.PI), pitch: 0.15 * Math.sin(ph * Math.PI) }), { loop: false });
    mk('die', 1.0, (ph) => { const d = kf(ph, [[0, 0], [0.6, 1], [1, 1]]); return bugPose(sk, p, 0, { A: 0, B: 0, legUp: 0.5 * d, curl: 1.0 * d, roll: (p.tail || p.legs > 6 && p.bw > 0.4 ? 0.4 : 2.9) * d, y: p.bh * 0.4 * d, tailCurl: 0.62 - 0.5 * d }); }, { loop: false });
  }
  for (const k of ['walk', 'run']) C[k + 'Fly'] = C[k];
  return C;
}

// =====================================================================
// AVES (corvo e águia mecânicos) — mesmo acabamento
// =====================================================================
export function makeBirdSkeleton() {
  return new Skeleton([B('body', -1, [0, 0.42, 0]), B('neck', 0, [0, 0.08, 0.22]), B('head', 1, [0, 0.1, 0.08]), B('tail', 0, [0, 0.02, -0.26]),
    B('wL1', 0, [0.12, 0.08, 0.04]), B('wL2', 4, [0.42, 0, 0]), B('wR1', 0, [-0.12, 0.08, 0.04]), B('wR2', 6, [-0.42, 0, 0]), B('legL', 0, [0.07, -0.1, 0.02]), B('legR', 0, [-0.07, -0.1, 0.02])]);
}
export function buildBirdMesh(sk, st) {
  const mb = new FacetBuilder({ skinned: true }); const W = restWorld(sk), I = sk.index; const body = PAL.body, plate = PAL.plate, dark = PAL.dark, gold = PAL.gold;
  mb.setBone(I.body); metal(mb);
  mb.sphere(M(0, 0.42, 0, 0, [0.15, 0.14, 0.3]), 1, 8, 6, body); mb.box(M(0, 0.38, 0.12, 0, 1, 0.3), 0.18, 0.12, 0.16, plate);
  for (let i = 0; i < 4; i++) { mb.box(M(0, 0.52, 0.12 - i * 0.1, 0, 1, 0.1), 0.2 - i * 0.02, 0.035, 0.09, i % 2 ? dark : plate); trim(mb, M(0, 0.54, 0.16 - i * 0.1), 0.15 - i * 0.02, 0.006, 0.008); }
  mb.setBone(I.neck); metal(mb); seg(mb, [0, 0.46, 0.2], [0, 0.58, 0.3], 0.07, 0.055, 6, dark);
  mb.setBone(I.head); metal(mb); const h = W[I.head];
  mb.box(M(0, h[1] + 0.02, h[2] + 0.02), 0.11, 0.1, 0.13, body); mb.cylinder(M(0, h[1] + 0.01, h[2] + 0.08, 0, 1, Math.PI / 2 + 0.25), 0.04, 0.0, st.beak, 5, gold);
  glow(mb); for (const s of [-1, 1]) mb.box(M(s * 0.055, h[1] + 0.04, h[2] + 0.05), 0.02, 0.025, 0.03, st.eye || PAL.amber);
  mb.setBone(I.tail); metal(mb); for (let i = 0; i < 5; i++) mb.box(M((i - 2) * 0.035, 0.44, -0.42, (i - 2) * 0.12), 0.04, 0.015, 0.26, i % 2 ? dark : body);
  for (const s of [1, -1]) {
    const S = s > 0 ? 'L' : 'R'; const w1 = W[I[`w${S}1`]], w2 = W[I[`w${S}2`]];
    mb.setBone(I[`w${S}1`]); metal(mb); mb.box(M(w1[0] + s * 0.21, w1[1], w1[2], 0), 0.42, 0.045, 0.1, dark); trim(mb, M(w1[0] + s * 0.21, w1[1] + 0.026, w1[2] + 0.04), 0.38, 0.006, 0.01);
    for (let f = 0; f < 5; f++) mb.box(M(w1[0] + s * (0.06 + f * 0.08), w1[1] - 0.005, w1[2] - 0.12, s * 0.05), 0.07, 0.02, 0.26 + f * 0.01, f % 2 ? body : plate);
    mb.setBone(I[`w${S}2`]); metal(mb); mb.box(M(w2[0] + s * 0.22, w2[1], w2[2], 0), 0.44, 0.035, 0.07, dark);
    for (let f = 0; f < 6; f++) mb.box(M(w2[0] + s * (0.05 + f * 0.08), w2[1] - 0.005, w2[2] - 0.13 - f * 0.012, s * (0.08 + f * 0.05)), 0.065, 0.018, 0.3 + f * 0.03, f % 2 ? body : plate);
    mb.setBone(I[`leg${S}`]); metal(mb); const l = W[I[`leg${S}`]];
    seg(mb, l, [l[0], l[1] - 0.22, l[2] + 0.02], 0.025, 0.018, 5, dark); for (let t = -1; t <= 1; t++) seg(mb, [l[0], l[1] - 0.22, l[2] + 0.02], [l[0] + t * 0.04, l[1] - 0.26, l[2] + 0.1], 0.012, 0.004, 4, gold);
  }
  return mb.build();
}
export function buildBirdClips(sk) {
  const C = {}; const mk = (n, d, fn, o) => (C[n] = bakeClip(sk, n, d, fn, o));
  const flap = (ph, a, rate = 1) => { const w = ph * TAU * rate; const f = Math.sin(w), f2 = Math.sin(w - 0.7);
    return { root: [0, 0.05 * -f, 0], bones: { wL1: [0, 0, a * f + 0.05], wL2: [0, 0, a * 0.6 * f2], wR1: [0, 0, -a * f - 0.05], wR2: [0, 0, -a * 0.6 * f2], body: [0.05, 0, 0], legL: [0.9, 0, 0], legR: [0.9, 0, 0], tail: [0.05 * f, 0, 0], head: [-0.05, 0, 0] } }; };
  mk('idle', 2.0, (ph) => { const p = flap(ph, 0.12); p.bones.wL1[2] += 0.12; p.bones.wR1[2] -= 0.12; return p; });
  mk('walk', 0.7, (ph) => flap(ph, 0.75));
  mk('run', 0.45, (ph) => flap(ph, 0.85));
  mk('attack', 0.8, (ph) => { const t = kf(ph, [[0, 0], [0.45, 1], [0.7, 1], [1, 0]]);
    return { bones: { wL1: [0, 1.1 * t, 0.2], wR1: [0, -1.1 * t, -0.2], wL2: [0, 0.4 * t, 0], wR2: [0, -0.4 * t, 0], body: [0.4 * t, 0, 0], legL: [0.9 - 2.0 * t, 0, 0], legR: [0.9 - 2.0 * t, 0, 0], head: [-0.3 * t, 0, 0] } }; }, { loop: false, events: [{ t: 0.6, name: 'hit' }] });
  mk('hit', 0.35, (ph) => { const d = Math.sin(ph * Math.PI); return { bones: { body: [0, 0, 0.6 * d], wL1: [0, 0, -0.4 * d], wR1: [0, 0, 0.4 * d] } }; }, { loop: false });
  mk('die', 1.0, (ph) => ({ root: [0, -0.3 * ph, 0], bones: { body: [0, 0, 1.4 * ph], wL1: [0, 0.3, -0.3 * ph], wR1: [0, -0.3, 1.2 * ph], wL2: [0, 0, -0.5 * ph], wR2: [0, 0, 0.6 * ph], head: [0.6 * ph, 0, 0], legL: [0.9, 0, 0], legR: [0.9, 0, 0] } }), { loop: false });
  return C;
}

// =====================================================================
// Catálogo (baseado na folha de referência)
// =====================================================================
export const ROBOT_STYLES = {
  soldier: { pal: [0x3d4a2c, 0x56663c, 0x2a2f22, 0xb02010], rig: 'human', st: { head: 'helmet', smg: true, shoulderLight: true, eye: hex(0xff1414), body: hex(0x26272c), plate: hex(0x40424a), gold: hex(0x1c1d21), trim: hex(0x6a1008), pads: 1.15 } },
  hunter: { pal: [0x8a7350, 0xa88f62, 0x3a2f20, 0xff7a1a], rig: 'human', st: { head: 'visor', rifle: true, blades: true, pads: 1.1, eye: PAL.amber } },
  heavy: { pal: [0x4a1a1a, 0x6e2626, 0x1a1a1a, 0xff4a1a], rig: 'human', st: { head: 'gorilla', bulk: 1.5, armBulk: 1.5, gauntlet: 2.0, pads: 1.25, legBulk: 0.85, belly: 1.2, chestLight: hex(0xff1414), shoulderDisc: true, eye: hex(0xff1414), body: hex(0x232328), plate: hex(0x3e3f46), gold: hex(0x1a1a1e), trim: hex(0x7a1208) } },
  rhino: { pal: [0x2c3e56, 0x48607e, 0x1c2430, 0x3ab0ff], rig: 'quad', st: { bulk: 1.55, horn: true } },
  tiger: { pal: [0xb8601a, 0xd8802a, 0x1a1a1a, 0xffd040], rig: 'quad', st: { bulk: 1.0, turret: true } },
  spider: { pal: [0x3a1e4a, 0x6a2e8a, 0x9ae030, 0x9ae030], rig: 'bug', p: { legs: 8, h: 0.42, len: 0.55, bw: 0.24, bh: 0.17, side: 0.14, l1: 0.42, l2: 0.6, legR: 0.03, head: 0.13, abd: 0.27, wings: 0, abdW: 1.1 }, st: { eye: PAL.red, eyes: 6, mandibles: true, abdGlow: PAL.trim } },
  tick: { pal: [0x1e4a4a, 0x2e6a6a, 0xc8c8c8, 0x40fff0], rig: 'bug', p: { legs: 8, h: 0.34, len: 0.5, bw: 0.32, bh: 0.17, side: 0.16, l1: 0.3, l2: 0.42, legR: 0.028, head: 0.11, abd: 0.24, wings: 0, abdW: 1.2 }, st: { eye: PAL.amber, eyes: 4, dish: true } },
  spidertank: { pal: [0x5a1a7a, 0x22c08a, 0xff3fa0, 0xb4ff20], rig: 'bug', p: { legs: 8, h: 0.62, len: 0.95, bw: 0.42, bh: 0.2, side: 0.3, l1: 0.55, l2: 0.85, legR: 0.055, head: 0.16, abd: 0.3, wings: 0 }, st: { tank: true, eye: PAL.amber } },
  ant: { pal: [0x6e2a14, 0x8e3a1e, 0x2a1a10, 0xffa040], rig: 'bug', p: { legs: 6, h: 0.42, len: 0.55, bw: 0.15, bh: 0.13, side: 0.12, l1: 0.36, l2: 0.56, legR: 0.026, head: 0.17, abd: 0.3, wings: 0, abdW: 0.85 }, st: { eye: PAL.amber, eyes: 2, mandibles: true, antennae: true, drill: true } },
  beetle: { pal: [0x1e4a2a, 0x2e6e3e, 0xb8a040, 0x60ff80], rig: 'bug', p: { legs: 6, h: 0.34, len: 0.75, bw: 0.36, bh: 0.22, side: 0.17, l1: 0.26, l2: 0.42, legR: 0.04, head: 0.15, abd: 0.36, wings: 0, abdW: 1.2 }, st: { eye: PAL.amber, eyes: 2, horn: true, shell: true } },
  hauler: { pal: [0xc8641a, 0xe08030, 0x2a2a2a, 0xffe040], rig: 'bug', p: { legs: 6, h: 0.62, len: 1.0, bw: 0.42, bh: 0.2, side: 0.3, l1: 0.5, l2: 0.8, legR: 0.06, head: 0.15, abd: 0.25, wings: 0 }, st: { tank: false, cargo: true, eye: PAL.amber, eyes: 2 } },
  drone: { pal: [0xb8bcc4, 0xd8dce4, 0x2a2c30, 0xff2020], rig: 'bug', flyer: true, p: { legs: 4, h: 0.16, len: 0.28, bw: 0.13, bh: 0.07, side: 0.08, l1: 0.08, l2: 0.12, legR: 0.008, head: 0.05, abd: 0.05, wings: 0 }, st: { drone: true, eye: PAL.red, eyes: 0 } },
  scorpion: { pal: [0x9a8450, 0xb89e60, 0x1a1a1a, 0xff6020], rig: 'bug', p: { legs: 8, h: 0.3, len: 0.6, bw: 0.2, bh: 0.12, side: 0.13, l1: 0.3, l2: 0.42, legR: 0.026, head: 0.12, abd: 0.22, wings: 0, abdW: 1.0, tail: 5, tailSeg: 0.21 }, st: { eye: PAL.amber, eyes: 4 } },
  fly: { pal: [0x1a5a4a, 0x2a7a64, 0x9ad0ff, 0x40ffd0], rig: 'bug', flyer: true, p: { legs: 6, h: 0.18, len: 0.32, bw: 0.1, bh: 0.09, side: 0.06, l1: 0.15, l2: 0.22, legR: 0.01, head: 0.1, abd: 0.07, wings: 2, wingY: 0.25, wingL: 0.62, wingW: 0.13, flapRate: 9, flapA: 0.6 }, st: { eye: PAL.amber, eyes: 2, bigEyes: true, longAbd: true, wing: hex(0x2a3e66), wingVein: hex(0x2a5aa0) } },
  butterfly: { pal: [0x1a2e6a, 0x2a4a9a, 0xd8b040, 0x60c0ff], rig: 'bug', flyer: true, p: { legs: 6, h: 0.3, len: 0.62, bw: 0.13, bh: 0.12, side: 0.09, l1: 0.2, l2: 0.3, legR: 0.016, head: 0.15, abd: 0.12, wings: 2, wingY: 0.1, wingL: 1.15, wingW: 0.72, flapRate: 2.6, flapA: 0.75 }, st: { eye: hex(0x40d8ff), eyes: 2, bigEyes: true, longAbd: true, solar: true } },
  wasp: { pal: [0xd8b018, 0xf0d030, 0x1a1a1a, 0xff8010], rig: 'bug', flyer: true, p: { legs: 6, h: 0.22, len: 0.36, bw: 0.11, bh: 0.1, side: 0.06, l1: 0.18, l2: 0.27, legR: 0.012, head: 0.09, abd: 0.18, wings: 2, wingY: 0.3, wingL: 0.5, wingW: 0.15, flapRate: 10, flapA: 0.7, abdW: 0.85 }, st: { eye: PAL.amber, eyes: 2, bigEyes: true, stinger: true, stripes: true, antennae: true, wing: hex(0x34322c) } },
  raven: { pal: [0x1a1a24, 0x2a2a3a, 0x6a3a9a, 0xff2020], rig: 'bird', st: { beak: 0.16, eye: PAL.red } },
  eagle: { pal: [0x5a3e24, 0x7a5634, 0xd8a840, 0xffc040], rig: 'bird', st: { beak: 0.13, eye: PAL.amber } },
};

// ---------- Tigre-canhão (referência): pantera blindada preta com placas laranja, olhos vermelhos, boca aberta com presas,
// cauda segmentada laranja/preta e suporte com DUAS metralhadoras giratórias nas costas (os canos giram à parte) ----------
export function buildTigerMesh(sk) {
  const mb = new MeshBuilder({ skinned: true }); const I = sk.index; const W = []; sk.bones.forEach((b, i) => { const p = b.parent >= 0 ? W[b.parent] : [0, 0, 0]; W[i] = [p[0] + b.pos[0], p[1] + b.pos[1], p[2] + b.pos[2]]; });
  const OR = hex(0xf0861c), ORd = hex(0xc8650e), BK = hex(0x242426), GR = hex(0x4a4c52), RED = hex(0xff3420), WH = hex(0xe9e6e0), SIL = hex(0xb9bec4), MOUTH = hex(0x8a1410);
  const S = (c, f) => mb.setColor(c, f); const ARM = 0.55, BOD = 0.62, GL = 0.02;
  const grow = (v0, c, k) => { for (let v = v0; v < mb.pos.length; v += 3) for (let a = 0; a < 3; a++) mb.pos[v + a] = c[a] + (mb.pos[v + a] - c[a]) * (Array.isArray(k) ? k[a] : k); };
  // ---- tronco: pélvis / dorso / peito (preto) com placas laranja angulosas
  const vT = mb.pos.length; mb.setBone(I.pelvis); S(BK, BOD); mb.roundBox(M(0, 0.74, -0.42), 0.36, 0.3, 0.36, BK, 0.06, 1);
  S(OR, ARM); for (const s of [-1, 1]) { mb.box(M(s * 0.19, 0.78, -0.42, 0, 1, 0, s * 0.18), 0.06, 0.24, 0.3, OR); mb.box(M(s * 0.15, 0.89, -0.46, 0, 1, 0, s * 0.5), 0.12, 0.05, 0.22, BK); }
  S(OR, ARM); mb.box(M(0, 0.9, -0.36, 0.1), 0.22, 0.05, 0.16, OR);
  mb.setBone(I.spine); S(BK, BOD); mb.roundBox(M(0, 0.76, -0.05), 0.38, 0.3, 0.46, BK, 0.06, 1); S(GR, BOD); mb.box(M(0, 0.6, -0.05), 0.26, 0.06, 0.42, GR);
  S(OR, ARM); for (const s of [-1, 1]) { mb.box(M(s * 0.2, 0.78, 0.04, 0, 1, 0, s * 0.12), 0.05, 0.22, 0.2, OR); mb.box(M(s * 0.2, 0.76, -0.2, 0, 1, 0, s * 0.12), 0.05, 0.18, 0.14, ORd); mb.box(M(s * 0.12, 0.92, -0.08, 0, 1, 0, s * 0.45), 0.16, 0.04, 0.3, OR); }
  mb.setBone(I.chest); S(BK, BOD); mb.roundBox(M(0, 0.78, 0.3), 0.42, 0.36, 0.36, BK, 0.07, 1); S(GR, BOD); mb.box(M(0, 0.6, 0.32), 0.28, 0.08, 0.3, GR);
  // ombreiras grandes
  S(OR, ARM); for (const s of [-1, 1]) { mb.roundBox(M(s * 0.22, 0.8, 0.36, 0, 1, 0, s * 0.15), 0.08, 0.3, 0.32, OR, 0.03, 1); mb.box(M(s * 0.24, 0.84, 0.36, 0, 1, 0, s * 0.15), 0.03, 0.1, 0.34, BK); S(OR, ARM); }
  // suporte das metralhadoras nas costas: base preta, laterais laranja, faixa vermelha luminosa
  S(BK, ARM); mb.box(M(0, 0.99, 0.14), 0.3, 0.1, 0.3, BK); mb.box(M(0, 1.06, 0.12), 0.48, 0.06, 0.14, GR);
  for (const s of [-1, 1]) { S(OR, ARM); mb.box(M(s * 0.2, 1.06, 0.16), 0.1, 0.12, 0.2, OR); S(BK, ARM); mb.box(M(s * 0.2, 1.1, 0.2), 0.1, 0.06, 0.26, BK); }
  S(RED, GL); mb.box(M(0, 1.0, 0.295), 0.16, 0.03, 0.01, RED); mb.box(M(0, 1.04, -0.01), 0.12, 0.02, 0.01, RED);
  grow(vT, [0, 0.8, 0], [1.3, 1.12, 1]);
  // ---- pescoço e cabeça
  mb.setBone(I.neck); S(BK, BOD); mb.roundBox(M(0, 0.88, 0.54), 0.26, 0.24, 0.24, BK, 0.05, 1); S(OR, ARM); mb.box(M(0, 0.98, 0.54, -0.3), 0.22, 0.05, 0.2, OR);
  mb.setBone(I.head); const hy = 1.0, hz = 0.72; const vHead = mb.pos.length;
  S(OR, ARM); mb.roundBox(M(0, hy + 0.02, hz), 0.3, 0.2, 0.26, OR, 0.05, 1); // crânio
  S(BK, ARM); for (const s of [-1, 1]) { mb.box(M(s * 0.11, hy + 0.11, hz + 0.02, 0, 1, 0, s * 0.3), 0.05, 0.02, 0.18, BK); mb.box(M(s * 0.155, hy + 0.0, hz - 0.02, 0, 1, 0, s * 0.2), 0.012, 0.12, 0.05, BK); mb.box(M(s * 0.155, hy + 0.04, hz + 0.08), 0.012, 0.04, 0.08, BK); }
  mb.box(M(0, hy + 0.12, hz - 0.04), 0.04, 0.02, 0.14, BK);
  S(OR, ARM); for (const s of [-1, 1]) { mb.box(M(s * 0.1, hy + 0.15, hz - 0.08, -0.2, 1, 0, s * 0.3), 0.08, 0.08, 0.04, OR); S(BK, ARM); mb.box(M(s * 0.1, hy + 0.15, hz - 0.065, -0.2, 1, 0, s * 0.3), 0.04, 0.05, 0.02, BK); S(OR, ARM); } // orelhas
  S(RED, GL); for (const s of [-1, 1]) mb.box(M(s * 0.085, hy + 0.06, hz + 0.13, 0, 1, 0, s * -0.25), 0.07, 0.025, 0.02, RED); // olhos
  S(WH, ARM); mb.roundBox(M(0, hy - 0.03, hz + 0.17), 0.18, 0.09, 0.14, WH, 0.03, 1); S(BK, ARM); mb.box(M(0, hy + 0.01, hz + 0.245), 0.06, 0.04, 0.03, BK); // focinho e nariz
  // mandíbula aberta com boca vermelha e presas
  S(MOUTH, 0.7); mb.box(M(0, hy - 0.09, hz + 0.1), 0.15, 0.06, 0.18, MOUTH);
  S(OR, ARM); mb.box(M(0, hy - 0.16, hz + 0.12, 0.35), 0.17, 0.05, 0.2, OR); S(WH, ARM); mb.box(M(0, hy - 0.17, hz + 0.2, 0.35), 0.13, 0.03, 0.06, WH);
  S(WH, 0.5); for (const s of [-1, 1]) { mb.cylinder(M(s * 0.06, hy - 0.06, hz + 0.21, 0, 1, Math.PI), 0.018, 0.002, 0.08, 5, WH); mb.cylinder(M(s * 0.055, hy - 0.15, hz + 0.21), 0.014, 0.002, 0.06, 5, WH); for (let k = 0; k < 2; k++) mb.cylinder(M(s * (0.02 + k * 0.02), hy - 0.07, hz + 0.23, 0, 1, Math.PI), 0.008, 0.001, 0.03, 4, WH); }
  grow(vHead, [0, hy - 0.04, hz - 0.08], 1.4);
  // ---- pernas: coxas laranja, canelas pretas com placa laranja, patas pretas com garras prateadas
  for (const L of ['FL', 'FR', 'BL', 'BR']) { const u = W[I['up' + L]], l = W[I['lo' + L]], p = W[I['paw' + L]]; const sx = Math.sign(u[0]) || 1; const x = u[0] + sx * 0.04; const fr = L[0] === 'F';
    const vLeg = mb.pos.length; mb.setBone(I['up' + L]); S(BK, BOD); mb.roundBox(M(x, (u[1] + l[1]) / 2, u[2] + (fr ? 0.01 : -0.02)), 0.12, u[1] - l[1] + 0.08, 0.16, BK, 0.03, 1); S(OR, ARM); mb.roundBox(M(x + sx * 0.04, (u[1] + l[1]) / 2 + 0.03, u[2] + (fr ? 0.03 : -0.03), 0, 1, 0, sx * 0.1), 0.05, (u[1] - l[1]) * 0.8, 0.17, fr ? OR : ORd, 0.02, 1);
    S(GR, ARM); mb.cylinder(M(x + sx * 0.065, l[1] + 0.02, l[2], 0, 1, 0, Math.PI / 2), 0.04, 0.04, 0.02, 8, GR); S(RED, GL); mb.cylinder(M(x + sx * 0.077, l[1] + 0.02, l[2], 0, 1, 0, Math.PI / 2), 0.015, 0.015, 0.005, 6, RED);
    mb.setBone(I['lo' + L]); S(BK, BOD); mb.roundBox(M(x, (l[1] + p[1]) / 2 + 0.02, l[2] + (fr ? 0.02 : -0.03)), 0.09, l[1] - p[1] + 0.02, 0.11, BK, 0.02, 1); S(OR, ARM); mb.box(M(x, (l[1] + p[1]) / 2 + 0.03, l[2] + (fr ? 0.075 : 0.02)), 0.08, (l[1] - p[1]) * 0.55, 0.03, OR);
    mb.setBone(I['paw' + L]); S(BK, BOD); mb.roundBox(M(x, p[1] + 0.03, p[2] + 0.05), 0.13, 0.07, 0.17, BK, 0.02, 1); S(OR, ARM); mb.box(M(x, p[1] + 0.07, p[2] + 0.07), 0.1, 0.02, 0.09, OR);
    S(SIL, 0.5); for (let k = 0; k < 4; k++) mb.cylinder(M(x - 0.045 + k * 0.03, p[1] + 0.025, p[2] + 0.14, 0, 1, Math.PI / 2 - 0.4), 0.013, 0.001, 0.07, 4, SIL);
    grow(vLeg, [x, 0, u[2]], [1.45, 1, 1.35]); }
  // ---- cauda segmentada (laranja/preto), subindo na ponta
  mb.setBone(I.tail); { const t0 = W[I.tail]; for (let k = 0; k < 11; k++) { const z = t0[2] - 0.05 - k * 0.075, y = t0[1] - 0.02 - Math.sin(k * 0.22) * 0.05 + Math.max(0, k - 6) * 0.035; const r = 0.06 - k * 0.0035; S(k % 2 ? BK : OR, ARM); mb.box(M(0, y, z, -0.15 + k * 0.03), r * 2, r * 2, 0.07, k % 2 ? BK : OR); }
    S(BK, ARM); mb.cylinder(M(0, t0[1] + 0.12, t0[2] - 0.9, -1.2), 0.03, 0.0, 0.12, 5, BK); }
  return mb.build();
}
// metralhadora do tigre (giram): canos pretos com cinta laranja e boca vermelha
export function tigerGatlingMesh() {
  const mb = new MeshBuilder(); const BK = hex(0x1e1e20), OR = hex(0xf0861c), RED = hex(0xff3420), GR = hex(0x4a4c52); mb.flex = 0.5;
  for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; mb.setColor(BK, 0.5); mb.cylinder(M(Math.cos(a) * 0.05, Math.sin(a) * 0.05, 0, 0, 1, Math.PI / 2), 0.019, 0.019, 0.56, 6, BK); }
  mb.setColor(GR, 0.5); for (const z of [0.1, 0.34, 0.52]) mb.cylinder(M(0, 0, z, 0, 1, Math.PI / 2), 0.08, 0.08, 0.03, 8, GR);
  mb.setColor(OR, 0.55); mb.cylinder(M(0, 0, -0.04, 0, 1, Math.PI / 2), 0.085, 0.085, 0.1, 8, OR); mb.setColor(BK, 0.5); mb.cylinder(M(0, 0, -0.16, 0, 1, Math.PI / 2), 0.09, 0.09, 0.14, 8, BK);
  mb.setColor(RED, 0.02); mb.cylinder(M(0, 0, 0.56, 0, 1, Math.PI / 2), 0.03, 0.03, 0.01, 8, RED); mb.box(M(0, 0.088, -0.1), 0.06, 0.012, 0.08, RED);
  return mb.build();
}

// ---------- Mecha de combate (bípede pesado): pernas blindadas com pés de garra, tronco largo, casulos de mísseis nos ombros,
// duas metralhadoras giratórias nos braços (desenhadas à parte) e um farol no peito (luz muda de cor) ----------
export function buildMechaMesh(sk) {
  // mecha da referência: casco blindado largo cinza-escuro, casulos de mísseis nos ombros, metralhadoras giratórias nos braços (à parte),
  // pernas grossas com joelheiras e pistões, pés largos com faixas de risco, luzes laranja, cabos pendurados e farol no peito
  const mb = new MeshBuilder({ skinned: true }); const I = sk.index; const S = (c, f) => mb.setColor(c, f);
  const BD = hex(0x3c424a), DK = hex(0x24272c), LT = hex(0x5c646e), PL = hex(0x4a5059), OR = hex(0xff8a1c), YL = hex(0xd8a520), CB = hex(0x15171a); const A = 0.5, G = 0.02;
  for (const s of [-1, 1]) { const L = s > 0 ? 'L' : 'R', x = s * 0.15;
    // pé largo com dedos e faixas de risco
    mb.setBone(I['foot' + L]); S(DK, A); mb.roundBox(M(x, 0.05, 0.06), 0.34, 0.11, 0.46, DK, 0.025, 1); S(PL, A); mb.box(M(x, 0.12, 0.02), 0.26, 0.05, 0.28, PL);
    for (const k of [-1, 0, 1]) { S(DK, A); mb.roundBox(M(x + k * 0.1, 0.04, 0.33, 0.2), 0.08, 0.07, 0.14, DK, 0.01, 1); } S(DK, A); mb.box(M(x, 0.05, -0.2), 0.18, 0.08, 0.12, DK);
    for (let k = 0; k < 6; k++) { S(k % 2 ? CB : YL, A); mb.box(M(x - 0.11 + k * 0.044, 0.152, 0.12, 0, 1, 0, 0.55), 0.03, 0.006, 0.14, k % 2 ? CB : YL); }
    // canela: blindagem frontal, pistão traseiro, luz laranja
    mb.setBone(I['shin' + L]); S(BD, A); mb.roundBox(M(x, 0.32, 0.0), 0.24, 0.46, 0.28, BD, 0.03, 1); S(LT, A); mb.roundBox(M(x, 0.36, 0.15), 0.2, 0.36, 0.04, LT, 0.01, 1);
    S(DK, A); mb.cylinder(M(x, 0.1, -0.16), 0.035, 0.035, 0.44, 8, DK); S(LT, A); mb.cylinder(M(x, 0.3, -0.16), 0.05, 0.05, 0.14, 8, LT); S(OR, G); mb.box(M(x + s * 0.123, 0.4, 0.05), 0.01, 0.12, 0.04, OR);
    S(DK, A); mb.roundBox(M(x, 0.54, 0.12), 0.22, 0.16, 0.12, DK, 0.03, 1); // joelheira
    S(DK, A); mb.cylinder(M(x - 0.14, 0.52, 0, 0, 1, 0, Math.PI / 2), 0.09, 0.09, 0.28, 12, DK);
    // coxa
    mb.setBone(I['thigh' + L]); S(BD, A); mb.roundBox(M(x, 0.74, 0.0), 0.26, 0.42, 0.32, BD, 0.03, 1); S(PL, A); mb.box(M(x + s * 0.13, 0.74, 0), 0.03, 0.32, 0.22, PL); S(LT, A); mb.box(M(x, 0.78, 0.165), 0.18, 0.26, 0.03, LT);
    S(DK, A); mb.cylinder(M(x - 0.15, 0.94, 0, 0, 1, 0, Math.PI / 2), 0.1, 0.1, 0.3, 12, DK); }
  mb.setBone(I.hips); S(DK, A); mb.roundBox(M(0, 0.96, 0), 0.5, 0.2, 0.36, DK, 0.03, 1); S(BD, A); mb.box(M(0, 0.96, 0.19), 0.3, 0.14, 0.03, BD);
  S(CB, 0.7); for (const [x, z, h] of [[-0.06, 0.08, 0.7], [0.02, 0.1, 0.64], [0.08, 0.06, 0.72], [-0.12, 0.02, 0.6]]) mb.cylinder(M(x, 0.95 - h, z), 0.014, 0.014, h, 5, CB); // cabos pendurados
  mb.setBone(I.spine); S(DK, A); mb.roundBox(M(0, 1.12, 0), 0.4, 0.2, 0.32, DK, 0.03, 1);
  mb.setBone(I.chest);
  // casco: bloco largo com placas, grade frontal e farol
  S(BD, A); mb.roundBox(M(0, 1.36, 0), 0.82, 0.52, 0.6, BD, 0.05, 1); S(PL, A); mb.roundBox(M(0, 1.62, -0.02), 0.6, 0.12, 0.5, PL, 0.03, 1);
  S(LT, A); mb.box(M(0, 1.38, 0.305), 0.44, 0.34, 0.02, LT); S(DK, A); for (let k = 0; k < 5; k++) mb.box(M(-0.24 + k * 0.12, 1.14, 0.305), 0.08, 0.06, 0.02, DK);
  for (const s of [-1, 1]) { S(DK, A); mb.box(M(s * 0.3, 1.38, 0.31), 0.1, 0.36, 0.03, DK); S(OR, G); mb.box(M(s * 0.3, 1.46, 0.325), 0.04, 0.12, 0.01, OR); }
  S(YL, A); mb.box(M(0.14, 1.52, 0.316), 0.06, 0.06, 0.005, YL); S(CB, A); mb.box(M(0.14, 1.52, 0.319), 0.022, 0.022, 0.004, CB);
  S(DK, A); mb.cylinder(M(0, 1.38, 0.3, 0, 1, Math.PI / 2), 0.09, 0.09, 0.05, 12, DK); // carcaça do farol (a lente é desenhada à parte)
  // mochila de energia nas costas com luzes laranja
  S(DK, A); mb.roundBox(M(0, 1.38, -0.34), 0.56, 0.4, 0.12, DK, 0.03, 1); S(OR, G); for (const x of [-0.16, 0.16]) mb.box(M(x, 1.38, -0.405), 0.07, 0.16, 0.01, OR);
  S(LT, A); for (const x of [-0.24, 0.24]) mb.cylinder(M(x, 1.55, -0.34), 0.04, 0.04, 0.22, 8, LT);
  // cabeça-sensor baixa e larga
  S(DK, A); mb.roundBox(M(0, 1.72, 0.12), 0.26, 0.14, 0.26, DK, 0.02, 1); S(OR, G); mb.box(M(0, 1.73, 0.252), 0.16, 0.03, 0.01, OR);
  for (const s of [-1, 1]) { const x = s * 0.5;
    // ombreira + casulo de mísseis (3×2 tubos com pontas laranja)
    S(BD, A); mb.roundBox(M(x, 1.44, 0), 0.26, 0.32, 0.4, BD, 0.04, 1); S(LT, A); mb.box(M(x + s * 0.135, 1.44, 0), 0.02, 0.24, 0.32, LT);
    S(DK, A); mb.roundBox(M(x, 1.74, 0.02), 0.32, 0.22, 0.42, DK, 0.03, 1); S(PL, A); mb.box(M(x, 1.86, 0.02), 0.28, 0.03, 0.38, PL);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) { const dx = (i - 1) * 0.09, dy = (j - 0.5) * 0.09; S(CB, A); mb.cylinder(M(x + dx, 1.74 + dy, 0.2, 0, 1, Math.PI / 2), 0.034, 0.034, 0.05, 8, CB); S(OR, G); mb.cylinder(M(x + dx, 1.74 + dy, 0.22, 0, 1, Math.PI / 2), 0.02, 0.02, 0.01, 6, OR); }
    S(OR, G); mb.box(M(x + s * 0.165, 1.74, 0.1), 0.01, 0.05, 0.12, OR);
    // braço/suporte das metralhadoras com luz redonda
    S(DK, A); mb.roundBox(M(s * 0.6, 1.2, 0.02), 0.2, 0.3, 0.3, DK, 0.03, 1); S(LT, A); mb.cylinder(M(s * 0.6, 1.2, 0.17, 0, 1, Math.PI / 2), 0.08, 0.08, 0.02, 12, LT); S(OR, G); mb.cylinder(M(s * 0.6, 1.2, 0.185, 0, 1, Math.PI / 2), 0.045, 0.045, 0.01, 10, OR); }
  return mb.build();
}
export function mechaGunMesh() { // metralhadora giratória do mecha (cano ao longo de +Z)
  const mb = new MeshBuilder(); const DK = hex(0x23262b), BD = hex(0x3a3f46), OR = hex(0xff8a1c); mb.flex = 0.5;
  for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; mb.setColor(DK, 0.5); mb.cylinder(M(Math.cos(a) * 0.058, Math.sin(a) * 0.058, 0, 0, 1, Math.PI / 2), 0.02, 0.02, 0.72, 6, DK); }
  mb.setColor(BD, 0.5); for (const z of [0.14, 0.42, 0.66]) mb.cylinder(M(0, 0, z, 0, 1, Math.PI / 2), 0.09, 0.09, 0.035, 10, BD); mb.cylinder(M(0, 0, -0.14, 0, 1, Math.PI / 2), 0.105, 0.105, 0.24, 10, BD);
  mb.setColor(OR, 0.02); mb.box(M(0, 0.085, -0.04), 0.03, 0.01, 0.1, OR); return mb.build(); }
export function mechaLampMesh() { const mb = new MeshBuilder(); mb.setColor(hex(0xffffff), 0.02); mb.cylinder(M(0, 0, 0, 0, 1, Math.PI / 2), 0.062, 0.062, 0.012, 12, hex(0xffffff)); return mb.build(); }
