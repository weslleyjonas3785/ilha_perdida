// Personagem humano 3D: esqueleto (rig) de 19 ossos, malha com pesos suavizados nas articulações
// e biblioteca de animações esqueléticas (keyframes gerados a partir de poses-chave).
import { MeshBuilder, hex, shade } from '../engine/mesh.js';
import { Skeleton, bakeClip, maskFrom } from '../engine/skeleton.js';
import { mat4, quat } from '../engine/math.js';

const B = (name, parent, pos) => ({ name, parent, pos });
export function makeHumanSkeleton() {
  const bones = [
    B('hips', -1, [0, 0.98, 0]), B('spine', 0, [0, 0.12, 0]), B('chest', 1, [0, 0.2, 0]), B('neck', 2, [0, 0.2, 0]), B('head', 3, [0, 0.09, 0]),
    B('shoulderL', 2, [0.07, 0.15, 0]), B('upperArmL', 5, [0.12, 0, 0]), B('foreArmL', 6, [0, -0.28, 0]), B('handL', 7, [0, -0.25, 0]),
    B('shoulderR', 2, [-0.07, 0.15, 0]), B('upperArmR', 9, [-0.12, 0, 0]), B('foreArmR', 10, [0, -0.28, 0]), B('handR', 11, [0, -0.25, 0]),
    B('thighL', 0, [0.1, -0.04, 0]), B('shinL', 13, [0, -0.44, 0]), B('footL', 14, [0, -0.43, 0]),
    B('thighR', 0, [-0.1, -0.04, 0]), B('shinR', 16, [0, -0.44, 0]), B('footR', 17, [0, -0.43, 0]),
  ];
  return new Skeleton(bones);
}

function restWorld(skel) {
  const w = []; for (let i = 0; i < skel.bones.length; i++) { const b = skel.bones[i]; const p = b.parent >= 0 ? w[b.parent] : [0, 0, 0]; w[i] = [p[0] + b.pos[0], p[1] + b.pos[1], p[2] + b.pos[2]]; } return w;
}
function alignY(from, to) { // matriz que leva o eixo +Y de 'from' até 'to'
  const d = [to[0] - from[0], to[1] - from[1], to[2] - from[2]]; const len = Math.hypot(...d); const n = d.map((x) => x / len);
  const y = [0, 1, 0]; const dot = n[1];
  let q;
  if (dot < -0.9999) q = [1, 0, 0, 0]; else { const ax = [y[1] * n[2] - y[2] * n[1], y[2] * n[0] - y[0] * n[2], y[0] * n[1] - y[1] * n[0]]; q = quat.normalize([ax[0], ax[1], ax[2], 1 + dot]); }
  return { m: mat4.fromTRS(mat4.create(), from, q, [1, 1, 1]), len };
}

export function buildHumanMesh(skel, style = {}) {
  const st = Object.assign({ skin: hex(0xc99a7a), shirt: hex(0x4f6b48), pants: hex(0x3d3b36), boots: hex(0x3b2a1e), hair: hex(0x2b1d14), backpack: true, belt: hex(0x5a4128), eyes: hex(0x1a1a1a), torn: false, bulk: 1 }, style);
  const mb = new MeshBuilder({ skinned: true }); const W = restWorld(skel); const I = skel.index;
  const blendFn = (bA, bB, a, b) => (p) => { // mistura linear entre ossos ao longo de Y
    const t = Math.min(1, Math.max(0, (p[1] - a) / (b - a))); return { j: [bA, bB], w: [1 - t, t] };
  };
  // Membros: cilindro entre articulações, peso misturado com o pai perto da junta
  const limb = (bone, parent, from, to, r0, r1, col, seg = 8, blend = 0.18, sx = 1, sz = 1) => {
    const { m, len } = alignY(from, to);
    const ms = mat4.mul(mat4.create(), m, mat4.fromTRS(mat4.create(), [0, 0, 0], [0, 0, 0, 1], [sx, 1, sz]));
    const dir = [(to[0] - from[0]) / len, (to[1] - from[1]) / len, (to[2] - from[2]) / len];
    mb.weightFn = (p) => { const t = ((p[0] - from[0]) * dir[0] + (p[1] - from[1]) * dir[1] + (p[2] - from[2]) * dir[2]) / len;
      if (parent >= 0 && t < blend) { const k = 0.5 + 0.5 * (t / blend); return { j: [bone, parent], w: [k, 1 - k] }; } return { j: [bone], w: [1] }; };
    mb.cylinder(ms, r0, r1, len, seg, col, true);
    mb.weightFn = null;
  };
  const bk = st.bulk;
  // --- tronco (pesos misturados hips→spine→chest) ---
  const yH = W[0][1], yS = W[1][1], yC = W[2][1], yN = W[3][1];
  mb.weightFn = blendFn(I.hips, I.spine, yH + 0.02, yS + 0.06);
  mb.cylinder(mat4.fromTRS(mat4.create(), [0, yH - 0.1, 0], [0, 0, 0, 1], [1.25 * bk, 1, 0.8 * bk]), 0.13, 0.135, 0.2, 10, st.pants);
  mb.weightFn = blendFn(I.spine, I.chest, yS + 0.08, yC + 0.05);
  mb.cylinder(mat4.fromTRS(mat4.create(), [0, yH + 0.06, 0], [0, 0, 0, 1], [1.2 * bk, 1, 0.78 * bk]), 0.135, 0.15, yC - yH, 10, st.shirt);
  mb.weightFn = blendFn(I.chest, I.neck, yN - 0.02, yN + 0.04);
  mb.cylinder(mat4.fromTRS(mat4.create(), [0, yC - 0.02, 0], [0, 0, 0, 1], [1.3 * bk, 1, 0.8 * bk]), 0.155, 0.12, yN - yC + 0.02, 10, st.shirt);
  // cinto
  mb.setBone(I.hips); mb.cylinder(mat4.fromTRS(mat4.create(), [0, yH + 0.06, 0], [0, 0, 0, 1], [1.27 * bk, 1, 0.82 * bk]), 0.138, 0.138, 0.04, 10, st.belt, false);
  // pescoço e cabeça
  limb(I.neck, I.chest, [0, yN - 0.02, 0], [0, W[4][1] + 0.02, 0], 0.05, 0.048, st.skin, 8, 0.3);
  mb.setBone(I.head);
  const hy = W[4][1] + 0.11;
  mb.sphere(mat4.fromTRS(mat4.create(), [0, hy, 0.005], [0, 0, 0, 1], [0.95, 1.12, 1]), 0.105, 12, 9, st.skin);
  if (st.hair) mb.sphere(mat4.fromTRS(mat4.create(), [0, hy + 0.03, -0.018], [0, 0, 0, 1], [1.0, 0.95, 1.05]), 0.108, 12, 8, st.hair);
  mb.box(mat4.compose([0.035, hy + 0.005, 0.095]), 0.022, 0.014, 0.01, st.eyes); mb.box(mat4.compose([-0.035, hy + 0.005, 0.095]), 0.022, 0.014, 0.01, st.eyes);
  mb.box(mat4.compose([0, hy - 0.025, 0.1], 0, 1, 0.3), 0.022, 0.04, 0.025, shade(st.skin, 0.92));
  mb.box(mat4.compose([0.098, hy, 0]), 0.02, 0.04, 0.03, shade(st.skin, 0.9)); mb.box(mat4.compose([-0.098, hy, 0]), 0.02, 0.04, 0.03, shade(st.skin, 0.9));
  if (st.mouth) mb.box(mat4.compose([0, hy - 0.06, 0.09]), 0.05, 0.012, 0.01, st.mouth);
  // braços
  for (const s of ['L', 'R']) {
    const sh = W[I['upperArm' + s]], el = W[I['foreArm' + s]], wr = W[I['hand' + s]];
    mb.setBone(I['shoulder' + s]); mb.sphere(mat4.compose([sh[0] * 0.96, sh[1] - 0.01, 0]), 0.062 * bk, 8, 6, st.shirt);
    limb(I['upperArm' + s], I['shoulder' + s], [sh[0], sh[1] - 0.01, 0], el, 0.055 * bk, 0.047 * bk, st.torn ? st.skin : st.shirt, 8, 0.15);
    limb(I['foreArm' + s], I['upperArm' + s], [el[0], el[1] + 0.02, 0], wr, 0.045 * bk, 0.036 * bk, st.sleeves ? st.shirt : st.skin, 8, 0.2);
    mb.setBone(I['hand' + s]);
    mb.box(mat4.compose([wr[0], wr[1] - 0.06, 0.005]), 0.06, 0.11, 0.075, st.skin);
    mb.box(mat4.compose([wr[0] + (s === 'L' ? -0.03 : 0.03), wr[1] - 0.05, 0.035], 0, 1, -0.3), 0.025, 0.06, 0.025, st.skin);
    if (st.claws) mb.box(mat4.compose([wr[0], wr[1] - 0.13, 0.01]), 0.06, 0.04, 0.06, hex(0x2a2a20));
  }
  // pernas
  for (const s of ['L', 'R']) {
    const hp = W[I['thigh' + s]], kn = W[I['shin' + s]], an = W[I['foot' + s]];
    limb(I['thigh' + s], I.hips, [hp[0], hp[1] + 0.04, 0], kn, 0.085 * bk, 0.062 * bk, st.pants, 9, 0.12);
    limb(I['shin' + s], I['thigh' + s], [kn[0], kn[1] + 0.02, 0], [an[0], an[1] + 0.02, 0], 0.06 * bk, 0.045 * bk, st.torn ? st.skin : st.pants, 9, 0.15);
    mb.setBone(I['shin' + s]); if (!st.torn) mb.cylinder(mat4.compose([an[0], an[1] - 0.02, 0]), 0.055, 0.058, 0.13, 8, st.boots);
    mb.setBone(I['foot' + s]);
    mb.box(mat4.compose([an[0], an[1] - 0.05, 0.05]), 0.1, 0.075, 0.24, st.torn ? shade(st.skin, 0.8) : st.boots);
    mb.box(mat4.compose([an[0], an[1] - 0.085, 0.05]), 0.105, 0.015, 0.245, shade(st.boots, 0.6));
  }
  // mochila
  if (st.backpack) {
    mb.setBone(I.chest);
    mb.box(mat4.compose([0, yC + 0.02, -0.17]), 0.3, 0.4, 0.15, hex(0x5b4a2f));
    mb.box(mat4.compose([0, yC - 0.12, -0.25]), 0.26, 0.14, 0.06, hex(0x4a3c26));
    mb.cylinder(mat4.compose([0.16, yC + 0.25, -0.18], 0, 1, 0, Math.PI / 2), 0.065, 0.065, 0.32, 8, hex(0x6e5a3c));
    mb.box(mat4.compose([0.09, yC + 0.05, 0.11]), 0.035, 0.38, 0.02, hex(0x3a2f1e)); mb.box(mat4.compose([-0.09, yC + 0.05, 0.11]), 0.035, 0.38, 0.02, hex(0x3a2f1e));
  }
  return mb.build();
}

// ---------- Utilitários de autoria ----------
const ease = (t) => t * t * (3 - 2 * t);
// kf(ph, [[t,v],...]) interpola valores com easing
export function kf(ph, keys) {
  if (ph <= keys[0][0]) return keys[0][1];
  for (let i = 0; i < keys.length - 1; i++) { const [t0, v0] = keys[i], [t1, v1] = keys[i + 1]; if (ph <= t1) { const f = ease((ph - t0) / (t1 - t0)); return v0 + (v1 - v0) * f; } }
  return keys[keys.length - 1][1];
}
const TAU = Math.PI * 2;

function gait(ph, o) { // ciclo de locomoção parametrizado
  const w = ph * TAU, sw = Math.sin(w), cw = Math.cos(w);
  const kneeL = o.knee0 + o.knee * Math.max(0, cw), kneeR = o.knee0 + o.knee * Math.max(0, -cw);
  return {
    root: [0, o.drop + o.bob * Math.cos(2 * w), 0],
    bones: {
      hips: [o.hipX || 0, sw * o.hipTwist, 0], spine: [o.lean, -sw * o.twist, 0], chest: [o.lean * 0.4, -sw * o.twist * 0.6, 0], head: [-o.lean * 1.1, sw * o.twist * 0.8, 0],
      thighL: [o.thigh0 - sw * o.stride, 0, 0.02], shinL: [kneeL, 0, 0], footL: [-(o.thigh0 - sw * o.stride) * 0.3 - kneeL * 0.45 + o.foot0, 0, 0],
      thighR: [o.thigh0 + sw * o.stride, 0, -0.02], shinR: [kneeR, 0, 0], footR: [-(o.thigh0 + sw * o.stride) * 0.3 - kneeR * 0.45 + o.foot0, 0, 0],
      upperArmL: [sw * o.arm + o.arm0, 0, 0.12], foreArmL: [o.elbow - Math.max(0, -sw) * o.elbowSwing, 0, 0],
      upperArmR: [-sw * o.arm + o.arm0, 0, -0.12], foreArmR: [o.elbow - Math.max(0, sw) * o.elbowSwing, 0, 0],
    },
  };
}

export function buildHumanClips(skel, variant = 'player') {
  const C = {}; const mk = (n, d, fn, o) => (C[n] = bakeClip(skel, n, d, fn, o));
  const mut = variant === 'mutant';
  mk('idle', 3.2, (ph) => { const b = Math.sin(ph * TAU), b2 = Math.sin(ph * TAU * 2);
    return { root: [0, -0.005 * (1 + b2), 0], bones: { spine: [0.02 + 0.015 * b + (mut ? 0.3 : 0), 0.02 * b, 0], chest: [0.01 * b2, 0, 0], head: [-0.02 * b + (mut ? -0.25 : 0), 0.08 * Math.sin(ph * TAU + 1), 0.02 * b],
      upperArmL: [0.03 * b + (mut ? -0.3 : 0), 0, 0.1 + 0.015 * b2], foreArmL: [-0.15 - (mut ? 0.4 : 0), 0, 0], upperArmR: [-0.03 * b + (mut ? -0.3 : 0), 0, -0.1 - 0.015 * b2], foreArmR: [-0.15 - (mut ? 0.4 : 0), 0, 0],
      thighL: [0.02, 0, 0.04], thighR: [-0.03, 0, -0.04], shinL: [0.04, 0, 0], shinR: [0.06, 0, 0] } }; });
  mk('walk', 1.05, (ph) => gait(ph, { stride: 0.42, knee: 0.75, knee0: 0.08, thigh0: 0, foot0: 0, bob: 0.018, drop: -0.012, lean: 0.04 + (mut ? 0.35 : 0), twist: 0.08, hipTwist: 0.06, arm: 0.32, arm0: mut ? -0.35 : 0, elbow: mut ? -0.7 : -0.2, elbowSwing: 0.2 }));
  mk('run', 0.72, (ph) => gait(ph, { stride: 0.7, knee: 1.35, knee0: 0.25, thigh0: -0.12, foot0: 0.05, bob: 0.04, drop: -0.04, lean: 0.16 + (mut ? 0.3 : 0), twist: 0.15, hipTwist: 0.1, arm: 0.65, arm0: mut ? -0.5 : 0, elbow: -1.2, elbowSwing: 0.4 }));
  mk('sprint', 0.56, (ph) => gait(ph, { stride: 0.95, knee: 1.7, knee0: 0.35, thigh0: -0.2, foot0: 0.1, bob: 0.055, drop: -0.07, lean: 0.32, twist: 0.2, hipTwist: 0.12, arm: 0.95, arm0: -0.05, elbow: -1.45, elbowSwing: 0.4 }));
  const crouchBase = { root: [0, -0.42, 0.02], bones: {} };
  mk('crouchIdle', 2.6, (ph) => { const b = Math.sin(ph * TAU);
    return { root: [0, -0.42 + 0.004 * b, 0], bones: { hips: [0.15, 0, 0], spine: [0.35 + 0.01 * b, 0, 0], chest: [0.1, 0, 0], head: [-0.5, 0.05 * b, 0],
      thighL: [-1.25, 0, 0.12], shinL: [2.05, 0, 0], footL: [-0.85, 0, 0], thighR: [-1.0, 0, -0.12], shinR: [1.85, 0, 0], footR: [-0.95, 0, 0],
      upperArmL: [-0.45, 0, 0.12], foreArmL: [-0.8, 0, 0], upperArmR: [-0.45, 0, -0.12], foreArmR: [-0.8, 0, 0] } }; });
  void crouchBase;
  // carrinho (escorregar): quadril baixo, tronco para trás, perna da frente esticada, a de trás dobrada, braços equilibrando
  mk('slide', 0.6, (ph) => { const b = Math.sin(ph * TAU) * 0.03;
    return { root: [0, -0.62, -0.05], bones: { hips: [-0.42, 0.15, 0], spine: [-0.18 + b, 0, 0], chest: [-0.05, 0, 0], neck: [0.2, 0, 0], head: [0.35, -0.12, 0],
      thighL: [-1.25, 0, 0.18], shinL: [0.2, 0, 0], footL: [0.15, 0, 0], thighR: [-0.05, 0, -0.3], shinR: [2.05, 0, 0], footR: [-0.5, 0, 0],
      upperArmL: [0.25, 0, 2.15 + b], foreArmL: [0, 0, 0.6], handL: [0, 0, 0.25], upperArmR: [0.25, 0, -2.15 - b], foreArmR: [0, 0, -0.6], handR: [0, 0, -0.25] } }; });
  mk('crouchWalk', 1.2, (ph) => { const w = ph * TAU, s = Math.sin(w), c = Math.cos(w);
    return { root: [0, -0.4 + 0.015 * Math.cos(2 * w), 0], bones: { hips: [0.15, s * 0.06, 0], spine: [0.4, -s * 0.06, 0], chest: [0.1, 0, 0], head: [-0.55, 0, 0],
      thighL: [-1.1 - s * 0.35, 0, 0.1], shinL: [1.75 + Math.max(0, c) * 0.4, 0, 0], footL: [-0.7 + s * 0.2, 0, 0],
      thighR: [-1.1 + s * 0.35, 0, -0.1], shinR: [1.75 + Math.max(0, -c) * 0.4, 0, 0], footR: [-0.7 - s * 0.2, 0, 0],
      upperArmL: [-0.35 + s * 0.2, 0, 0.15], foreArmL: [-0.9, 0, 0], upperArmR: [-0.35 - s * 0.2, 0, -0.15], foreArmR: [-0.9, 0, 0] } }; });
  mk('turn', 0.6, (ph) => { const w = ph * TAU, s = Math.sin(w);
    return { root: [0, -0.01, 0], bones: { thighL: [-Math.max(0, s) * 0.35, 0, 0.05], shinL: [Math.max(0, s) * 0.6, 0, 0], thighR: [-Math.max(0, -s) * 0.35, 0, -0.05], shinR: [Math.max(0, -s) * 0.6, 0, 0],
      upperArmL: [0, 0, 0.12], upperArmR: [0, 0, -0.12], foreArmL: [-0.2, 0, 0], foreArmR: [-0.2, 0, 0], spine: [0.03, 0, 0] } }; });
  mk('jump', 0.3, (ph) => ({ root: [0, kf(ph, [[0, -0.15], [0.5, 0.02], [1, 0.05]]), 0], bones: {
    spine: [kf(ph, [[0, 0.25], [1, 0.05]]), 0, 0], thighL: [kf(ph, [[0, -0.6], [1, -0.5]]), 0, 0.05], shinL: [kf(ph, [[0, 1.0], [1, 0.9]]), 0, 0], thighR: [kf(ph, [[0, -0.6], [1, 0.15]]), 0, -0.05], shinR: [kf(ph, [[0, 1.0], [1, 0.3]]), 0, 0],
    upperArmL: [kf(ph, [[0, 0.5], [1, -1.2]]), 0, 0.3], upperArmR: [kf(ph, [[0, 0.5], [1, -1.0]]), 0, -0.3], foreArmL: [-0.5, 0, 0], foreArmR: [-0.5, 0, 0] } }), { loop: false });
  mk('fall', 0.9, (ph) => { const s = Math.sin(ph * TAU);
    return { root: [0, 0, 0], bones: { spine: [0.08, 0, 0], head: [-0.1, 0, 0], thighL: [-0.55 + s * 0.12, 0, 0.08], shinL: [0.85, 0, 0], thighR: [-0.15 - s * 0.12, 0, -0.08], shinR: [0.5, 0, 0],
      upperArmL: [-0.4 + s * 0.15, 0, 0.75 + s * 0.1], upperArmR: [-0.4 - s * 0.15, 0, -0.75 - s * 0.1], foreArmL: [-0.5, 0, 0], foreArmR: [-0.5, 0, 0], footL: [0.2, 0, 0], footR: [0.2, 0, 0] } }; });
  mk('land', 0.4, (ph) => { const d = kf(ph, [[0, 0], [0.25, 1], [1, 0]]);
    return { root: [0, -0.28 * d, 0], bones: { spine: [0.35 * d, 0, 0], head: [-0.2 * d, 0, 0], thighL: [-0.9 * d, 0, 0.1], shinL: [1.5 * d, 0, 0], footL: [-0.6 * d, 0, 0], thighR: [-0.9 * d, 0, -0.1], shinR: [1.5 * d, 0, 0], footR: [-0.6 * d, 0, 0],
      upperArmL: [-0.3 * d, 0, 0.3 * d + 0.1], upperArmR: [-0.3 * d, 0, -0.3 * d - 0.1], foreArmL: [-0.4 * d, 0, 0], foreArmR: [-0.4 * d, 0, 0] } }; }, { loop: false });
  mk('swim', 1.3, (ph) => { const w = ph * TAU, s = Math.sin(w), c = Math.cos(w); const k = Math.sin(w * 2);
    return { root: [0, -0.1, 0], bones: { hips: [1.25, 0, 0], spine: [0.05, 0, 0], chest: [-0.1, 0, 0], head: [-0.9, 0, 0],
      upperArmL: [-2.6 + 0.6 * Math.max(0, s), 0, 0.2 + 1.1 * Math.max(0, s)], foreArmL: [-0.2 - 0.9 * Math.max(0, c), 0, 0], upperArmR: [-2.6 + 0.6 * Math.max(0, s), 0, -0.2 - 1.1 * Math.max(0, s)], foreArmR: [-0.2 - 0.9 * Math.max(0, c), 0, 0],
      thighL: [0.1 + 0.3 * k, 0, 0.15], shinL: [0.3 + 0.3 * Math.max(0, k), 0, 0], thighR: [0.1 - 0.3 * k, 0, -0.15], shinR: [0.3 + 0.3 * Math.max(0, -k), 0, 0], footL: [0.6, 0, 0], footR: [0.6, 0, 0] } }; });
  mk('swimIdle', 2.0, (ph) => { const s = Math.sin(ph * TAU);
    return { root: [0, -0.15 + 0.02 * s, 0], bones: { hips: [0.35, 0, 0], spine: [0.05, 0, 0], head: [-0.35, 0, 0],
      upperArmL: [-1.2, 0, 0.9 + 0.3 * s], foreArmL: [-0.4, 0, 0], upperArmR: [-1.2, 0, -0.9 - 0.3 * s], foreArmR: [-0.4, 0, 0],
      thighL: [-0.3 + 0.3 * s, 0, 0.1], shinL: [0.6, 0, 0], thighR: [-0.3 - 0.3 * s, 0, -0.1], shinR: [0.6, 0, 0] } }; });
  mk('climb', 0.75, (ph) => ({ root: [0, kf(ph, [[0, -0.2], [0.5, -0.35], [1, 0]]), 0], bones: {
    spine: [kf(ph, [[0, 0.3], [0.5, 0.6], [1, 0.1]]), 0, 0], head: [-0.4, 0, 0],
    upperArmL: [kf(ph, [[0, -2.5], [0.45, -1.6], [1, -0.3]]), 0, 0.2], foreArmL: [kf(ph, [[0, -0.3], [0.45, -1.4], [1, -0.2]]), 0, 0],
    upperArmR: [kf(ph, [[0, -2.5], [0.45, -1.6], [1, -0.3]]), 0, -0.2], foreArmR: [kf(ph, [[0, -0.3], [0.45, -1.4], [1, -0.2]]), 0, 0],
    thighL: [kf(ph, [[0, -0.2], [0.5, -1.4], [1, -0.1]]), 0, 0], shinL: [kf(ph, [[0, 0.3], [0.5, 1.8], [1, 0.2]]), 0, 0],
    thighR: [kf(ph, [[0, 0.2], [0.6, -0.5], [1, 0]]), 0, 0], shinR: [kf(ph, [[0, 0.4], [0.6, 1.2], [1, 0.1]]), 0, 0] } }), { loop: false });
  // escada vertical: braços e pernas alternados (o tempo anda conforme o personagem sobe/desce)
  mk('ladder', 1.0, (ph) => { const a = kf(ph, [[0, 0], [0.5, 1], [1, 0]]), b = 1 - a; return { root: [0, 0, 0], bones: { spine: [0.12, 0, 0], head: [-0.25, 0, 0],
    upperArmL: [-2.0 - 0.7 * a, 0, 0.15], foreArmL: [-0.4 - 0.7 * b, 0, 0], upperArmR: [-2.0 - 0.7 * b, 0, -0.15], foreArmR: [-0.4 - 0.7 * a, 0, 0],
    thighL: [-0.3 - 0.8 * b, 0, 0.05], shinL: [0.4 + 1.0 * b, 0, 0], thighR: [-0.3 - 0.8 * a, 0, -0.05], shinR: [0.4 + 1.0 * a, 0, 0], footL: [0.3, 0, 0], footR: [0.3, 0, 0] } }; });
  // arremesso de granada por cima do ombro (evento 'release' quando solta)
  mk('throw', 0.8, (ph) => { const u = kf(ph, [[0, 0], [0.35, 1], [0.55, -0.5], [0.75, -0.6], [1, 0]]); const tw = kf(ph, [[0, 0], [0.35, -0.5], [0.55, 0.45], [1, 0]]);
    return { bones: { spine: [0.05 + Math.max(0, -u) * 0.25, tw, 0], chest: [0, tw * 0.5, 0], head: [0, -tw * 0.8, 0],
      upperArmR: [-0.5 - 2.3 * Math.max(0, u) - 1.1 * Math.max(0, -u), 0, -0.2], foreArmR: [-1.6 * Math.max(0, u) - 0.15, 0, 0],
      upperArmL: [-1.0 - 0.4 * Math.max(0, u), 0, 0.3], foreArmL: [-0.6, 0, 0] } }; }, { loop: false, events: [{ t: 0.52, name: 'release' }] });
  // construindo: abre o projeto com as duas mãos na frente do peito (como na referência) e olha para ele
  mk('blueprint', 1.5, (ph) => { const d = kf(ph, [[0, 0], [0.15, 1], [0.85, 1], [1, 0]]); const s = Math.sin(ph * TAU * 2) * 0.04 * d;
    return { bones: { spine: [0.06 * d, 0, 0], head: [0.32 * d + s, 0, 0], neck: [0.1 * d, 0, 0],
      upperArmL: [-1.1 * d, 0, 0.32 * d + 0.1 * (1 - d)], foreArmL: [-0.45 * d, 0, 0], handL: [0, 0, -0.3 * d],
      upperArmR: [-1.1 * d, 0, -0.32 * d - 0.1 * (1 - d)], foreArmR: [-0.45 * d, 0, 0], handR: [0, 0, 0.3 * d] } }; }, { loop: false });
  // granada: braço erguido para trás na posição de arremesso enquanto o botão está apertado
  mk('throwHold', 1.6, (ph) => { const b = Math.sin(ph * TAU) * 0.03; return { bones: { spine: [0.05, -0.5, 0], chest: [0, -0.25, 0], head: [0, 0.4, 0],
      upperArmR: [-2.8 + b, 0, -0.2], foreArmR: [-1.75 - b, 0, 0], upperArmL: [-1.4, 0, 0.3], foreArmL: [-0.6, 0, 0] } }; });
  // soltar: o braço vem de trás para frente e a granada sai da mão
  mk('throwGo', 0.5, (ph) => { const u = kf(ph, [[0, 1], [0.3, -0.5], [0.6, -0.6], [1, 0]]); const tw = kf(ph, [[0, -0.5], [0.3, 0.45], [1, 0]]);
    return { bones: { spine: [0.05 + Math.max(0, -u) * 0.25, tw, 0], chest: [0, tw * 0.5, 0], head: [0, -tw * 0.8, 0],
      upperArmR: [-0.5 - 2.3 * Math.max(0, u) - 1.1 * Math.max(0, -u), 0, -0.2], foreArmR: [-1.6 * Math.max(0, u) - 0.15, 0, 0],
      upperArmL: [-1.0 - 0.4 * Math.max(0, u), 0, 0.3], foreArmL: [-0.6, 0, 0] } }; }, { loop: false, events: [{ t: 0.28, name: 'release' }] });
  mk('pickup', 0.85, (ph) => { const d = kf(ph, [[0, 0], [0.45, 1], [0.6, 1], [1, 0]]);
    return { root: [0, -0.3 * d, 0], bones: { spine: [0.6 * d, 0, 0], chest: [0.25 * d, 0, 0], head: [-0.3 * d, 0, 0],
      thighL: [-0.9 * d, 0, 0.1], shinL: [1.4 * d, 0, 0], footL: [-0.5 * d, 0, 0], thighR: [-0.4 * d, 0, -0.1], shinR: [0.9 * d, 0, 0], footR: [-0.5 * d, 0, 0],
      upperArmR: [-1.0 * d, 0, -0.15], foreArmR: [-0.3 * d, 0, 0], upperArmL: [-0.3 * d, 0, 0.2], foreArmL: [-0.4 * d, 0, 0] } }; }, { loop: false, events: [{ t: 0.5, name: 'grab' }] });
  mk('use', 1.0, (ph) => { const d = kf(ph, [[0, 0], [0.35, 1], [0.75, 1], [1, 0]]);
    return { bones: { upperArmR: [-1.2 * d, 0.4 * d, -0.1], foreArmR: [-1.8 * d, 0, 0], head: [0.15 * d, 0, 0], upperArmL: [-0.2 * d, 0, 0.12], foreArmL: [-0.3 * d, 0, 0] } }; }, { loop: false, events: [{ t: 0.55, name: 'apply' }] });
  // consumir: comer (mordidas), beber (inclina a cabeça), frasco de remédio (desrosqueia, despeja na mão, leva à boca, rosqueia) e cartela (destaca e joga na boca)
  const toMouth = (d) => ({ upperArmR: [-1.25 * d, 0.45 * d, -0.1], foreArmR: [-1.85 * d, 0, 0] });
  mk('eat', 2.2, (ph) => { const d = kf(ph, [[0, 0], [0.12, 1], [0.92, 1], [1, 0]]); const chew = Math.max(0, Math.sin(ph * 3 * TAU)) * 0.25 * d;
    return { bones: { ...toMouth(d * (1 - chew)), head: [0.12 * d + chew * 0.2, 0, 0], upperArmL: [-0.4 * d, 0, 0.1], foreArmL: [-0.9 * d, 0, 0] } }; }, { loop: false, events: [{ t: 0.2, name: 'bite' }, { t: 0.5, name: 'bite' }, { t: 0.78, name: 'bite' }, { t: 0.85, name: 'apply' }] });
  // ler um livro: segura aberto na frente do peito, cabeça baixa, a mão direita vira as páginas
  mk('read', 5.2, (ph) => { const d = kf(ph, [[0, 0], [0.07, 1], [0.94, 1], [1, 0]]); const pg = Math.max(0, Math.sin(ph * 4 * TAU - 1.2)) ** 3 * d;
    return { bones: { upperArmR: [-0.85 * d, 0.32 * d, -0.05], foreArmR: [-1.25 * d, -0.45 * pg, 0.25 * pg], upperArmL: [-0.85 * d, -0.32 * d, 0.05], foreArmL: [-1.25 * d, 0, 0], head: [0.42 * d, 0.05 * Math.sin(ph * 9) * d, 0], neck: [0.12 * d, 0, 0] } }; },
    { loop: false, events: [{ t: 0.22, name: 'page' }, { t: 0.47, name: 'page' }, { t: 0.72, name: 'page' }, { t: 0.97, name: 'done' }] });
  // sentado no carro / pilotando a moto (quadril no banco, braços no volante/guidão)
  mk('sit', 2.0, (ph) => { const b = Math.sin(ph * TAU) * 0.02; return { root: [0, -0.42, 0], bones: { thighL: [-1.45, 0, 0.08], thighR: [-1.45, 0, -0.08], shinL: [1.5, 0, 0], shinR: [1.5, 0, 0], footL: [-0.1, 0, 0], footR: [-0.1, 0, 0],
    spine: [0.05 + b, 0, 0], upperArmL: [-0.95, -0.15, 0.1], upperArmR: [-0.95, 0.15, -0.1], foreArmL: [-0.55, 0, 0], foreArmR: [-0.55, 0, 0] } }; });
  mk('ride', 2.0, (ph) => { const b = Math.sin(ph * TAU) * 0.02; return { root: [0, -0.06, -0.05], bones: { thighL: [-1.1, 0, 0.3], thighR: [-1.1, 0, -0.3], shinL: [1.45, 0, 0], shinR: [1.45, 0, 0], footL: [-0.3, 0, 0], footR: [-0.3, 0, 0],
    spine: [0.38 + b, 0, 0], chest: [0.1, 0, 0], head: [-0.35, 0, 0], upperArmL: [-1.15, -0.35, 0.25], upperArmR: [-1.15, 0.35, -0.25], foreArmL: [-0.35, 0, 0], foreArmR: [-0.35, 0, 0] } }; });
  // moto parada ou em curva fechada: um pé no chão equilibrando (L = esquerdo, R = direito); o corpo inclina para o lado do pé
  for (const [nm, sd] of [['rideFootL', 1], ['rideFootR', -1]]) mk(nm, 2.0, (ph) => { const b = Math.sin(ph * TAU) * 0.015; const L = sd > 0;
    return { root: [0, -0.06, -0.05], bones: { thighL: L ? [-0.25, 0, 0.42] : [-1.1, 0, 0.3], thighR: L ? [-1.1, 0, -0.3] : [-0.25, 0, -0.42], shinL: L ? [0.12, 0, 0] : [1.45, 0, 0], shinR: L ? [1.45, 0, 0] : [0.12, 0, 0], footL: L ? [0.1, 0, 0] : [-0.3, 0, 0], footR: L ? [-0.3, 0, 0] : [0.1, 0, 0],
      spine: [0.34 + b, 0, 0.08 * sd], chest: [0.1, 0, 0], head: [-0.3, 0, 0], upperArmL: [-1.15, -0.35, 0.25], upperArmR: [-1.15, 0.35, -0.25], foreArmL: [-0.35, 0, 0], foreArmR: [-0.35, 0, 0] } }; });
  // entrar/sair do carro: abaixa e passa a perna para dentro
  mk('carIn', 0.9, (ph) => { const k = Math.sin(Math.min(1, ph) * Math.PI / 2); return { root: [0, -0.42 * k, 0], bones: { thighL: [-1.45 * k, 0, 0.08], thighR: [-1.45 * k, 0, -0.08], shinL: [1.5 * k, 0, 0], shinR: [1.5 * k, 0, 0], spine: [0.25 * Math.sin(ph * Math.PI), 0, 0], upperArmL: [-0.6 * k, -0.15, 0.1], upperArmR: [-0.95 * k, 0.15, -0.1] } }; });
  // despejar/encher o galão: segura com as duas mãos e inclina
  mk('pour', 3.0, (ph) => { const d = kf(ph, [[0, 0], [0.12, 1], [0.9, 1], [1, 0]]); const w = Math.sin(ph * TAU * 3) * 0.05 * d;
    return { bones: { spine: [0.3 * d, 0, 0], upperArmR: [-0.75 * d, 0.25 * d, -0.1], foreArmR: [-0.7 * d + w, 0, 0], upperArmL: [-0.85 * d, -0.45 * d, 0.1], foreArmL: [-1.1 * d, 0, 0], handR: [0.6 * d, 0, 0], head: [0.3 * d, 0, 0] } }; }, { loop: false });
  mk('drink', 2.0, (ph) => { const d = kf(ph, [[0, 0], [0.15, 1], [0.85, 1], [1, 0]]);
    return { bones: { upperArmR: [-1.6 * d, 0.35 * d, -0.1], foreArmR: [-1.5 * d, 0, 0], head: [-0.45 * d, 0, 0], neck: [-0.15 * d, 0, 0], upperArmL: [-0.15 * d, 0, 0.1] } }; }, { loop: false, events: [{ t: 0.3, name: 'gulp' }, { t: 0.5, name: 'gulp' }, { t: 0.7, name: 'gulp' }, { t: 0.8, name: 'apply' }] });
  mk('pillBottle', 3.6, (ph) => { const front = kf(ph, [[0, 0], [0.06, 1], [0.32, 1], [0.38, 0.6], [0.6, 0.6], [0.66, 1], [0.92, 1], [1, 0]]); const tw = (ph < 0.3 || (ph > 0.66 && ph < 0.9)) ? Math.sin(ph * 40) * 0.35 : 0; const mouth = kf(ph, [[0, 0], [0.38, 0], [0.47, 1], [0.58, 1], [0.64, 0]]);
    const tilt = kf(ph, [[0, 0], [0.28, 0], [0.32, 1], [0.37, 0]]);
    return { bones: { upperArmL: [-0.9 * front, 0.2 * front, 0.15], foreArmL: [-1.4 * front, 0, -0.3 * tilt], handL: [0, 0, 0.9 * tilt], upperArmR: [-0.85 * front * (1 - mouth) - 1.25 * mouth, 0.45 * mouth - 0.15 * front * (1 - mouth), -0.1], foreArmR: [-1.4 * front * (1 - mouth) - 1.85 * mouth, tw, 0], head: [0.25 * front * (1 - mouth) - 0.15 * mouth, 0, 0] } }; },
    { loop: false, events: [{ t: 0.05, name: 'unscrew' }, { t: 0.31, name: 'shake' }, { t: 0.53, name: 'swallow' }, { t: 0.55, name: 'apply' }, { t: 0.7, name: 'screw' }] });
  mk('blister', 2.2, (ph) => { const front = kf(ph, [[0, 0], [0.1, 1], [0.35, 1], [0.42, 0.5], [0.85, 0.5], [1, 0]]); const mouth = kf(ph, [[0, 0], [0.35, 0], [0.48, 1], [0.62, 1], [0.72, 0]]);
    return { bones: { upperArmL: [-0.85 * front, 0.2 * front, 0.15], foreArmL: [-1.4 * front, 0, 0], upperArmR: [-0.8 * front * (1 - mouth) - 1.3 * mouth, 0.45 * mouth - 0.2 * front * (1 - mouth), -0.1], foreArmR: [-1.4 * front * (1 - mouth) - 1.85 * mouth, 0, 0], head: [0.25 * front * (1 - mouth) - 0.3 * mouth, 0, 0] } }; },
    { loop: false, events: [{ t: 0.25, name: 'pop' }, { t: 0.55, name: 'swallow' }, { t: 0.57, name: 'apply' }] });
  // ferramentas: corte horizontal-diagonal com duas mãos
  mk('chop', 0.95, (ph) => { const u = kf(ph, [[0, 0], [0.4, 1], [0.55, -0.2], [0.7, -0.3], [1, 0]]); const tw = kf(ph, [[0, 0], [0.4, -0.55], [0.55, 0.35], [0.75, 0.3], [1, 0]]);
    return { bones: { spine: [0.1 + Math.max(0, -u) * 0.3, tw, 0], chest: [0, tw * 0.5, 0], head: [0, -tw * 0.9, 0],
      upperArmR: [-0.6 - 1.4 * Math.max(0, u) - Math.max(0, -u) * 0.8, 0, -0.35 - 0.6 * Math.max(0, u)], foreArmR: [-1.2 * Math.max(0, u) - 0.25, 0, 0],
      upperArmL: [-0.7 - 1.1 * Math.max(0, u) - Math.max(0, -u) * 0.8, 0, 0.2 - 0.6 * Math.max(0, u)], foreArmL: [-1.0 * Math.max(0, u) - 0.5, 0, 0], handR: [0, 0, 0] } }; }, { loop: false, events: [{ t: 0.53, name: 'hit' }] });
  mk('mine', 1.05, (ph) => { const u = kf(ph, [[0, 0], [0.45, 1], [0.6, -0.4], [0.75, -0.45], [1, 0]]);
    return { root: [0, -0.06 * Math.max(0, -u), 0], bones: { spine: [-0.15 * Math.max(0, u) + 0.45 * Math.max(0, -u), 0, 0], head: [0.1 * Math.max(0, u), 0, 0],
      upperArmR: [-0.4 - 2.4 * Math.max(0, u) - 0.6 * Math.max(0, -u), 0, -0.15], foreArmR: [-0.9 * Math.max(0, u) - 0.2, 0, 0],
      upperArmL: [-0.5 - 2.2 * Math.max(0, u) - 0.6 * Math.max(0, -u), 0, 0.2], foreArmL: [-0.9 * Math.max(0, u) - 0.4, 0, 0],
      thighL: [-0.2 * Math.max(0, -u), 0, 0.05], shinL: [0.3 * Math.max(0, -u), 0, 0], thighR: [0.1, 0, -0.05] } }; }, { loop: false, events: [{ t: 0.58, name: 'hit' }] });
  mk('punch', 0.55, (ph) => { const p = kf(ph, [[0, 0], [0.25, -0.3], [0.45, 1], [0.65, 1], [1, 0]]);
    return { bones: { spine: [0.08, 0.35 * Math.max(0, p) - 0.15 * Math.max(0, -p), 0], chest: [0, 0.2 * p, 0], head: [0, -0.4 * p, 0],
      upperArmR: [-0.5 - 1.05 * Math.max(0, p), -0.3 * Math.max(0, p), -0.25], foreArmR: [-1.6 + 1.4 * Math.max(0, p), 0, 0],
      upperArmL: [-0.9, 0, 0.3], foreArmL: [-1.8, 0, 0] } }; }, { loop: false, events: [{ t: 0.45, name: 'hit' }] });
  mk('punchL', 0.55, (ph) => { const p = kf(ph, [[0, 0], [0.25, -0.3], [0.45, 1], [0.65, 1], [1, 0]]);
    return { bones: { spine: [0.08, -0.35 * Math.max(0, p), 0], chest: [0, -0.2 * p, 0], head: [0, 0.4 * p, 0],
      upperArmL: [-0.5 - 1.05 * Math.max(0, p), 0.3 * Math.max(0, p), 0.25], foreArmL: [-1.6 + 1.4 * Math.max(0, p), 0, 0],
      upperArmR: [-0.9, 0, -0.3], foreArmR: [-1.8, 0, 0] } }; }, { loop: false, events: [{ t: 0.45, name: 'hit' }] });
  mk('thrust', 0.7, (ph) => { const p = kf(ph, [[0, 0], [0.3, -0.6], [0.5, 1], [0.7, 1], [1, 0]]);
    return { root: [0, 0, 0.05 * p], bones: { spine: [0.1 + 0.15 * Math.max(0, p), -0.3 * Math.max(0, -p) + 0.2 * Math.max(0, p), 0],
      upperArmR: [-0.6 - 0.6 * Math.max(0, p) + 0.3 * Math.max(0, -p), 0, -0.2], foreArmR: [-1.1 + 0.9 * Math.max(0, p), 0, 0],
      upperArmL: [-0.9 - 0.4 * Math.max(0, p), 0, 0.25], foreArmL: [-1.0 + 0.4 * Math.max(0, p), 0, 0],
      thighL: [-0.4 * Math.max(0, p), 0, 0.05], shinL: [0.3 * Math.max(0, p), 0, 0], thighR: [0.25 * Math.max(0, p), 0, -0.05] } }; }, { loop: false, events: [{ t: 0.48, name: 'hit' }] });
  mk('block', 0.8, (ph) => { const s = Math.sin(ph * TAU) * 0.02;
    return { bones: { spine: [0.12 + s, 0, 0], head: [0.05, 0, 0], upperArmL: [-1.3, 0.4, 0.5], foreArmL: [-1.9, 0, 0], upperArmR: [-1.3, -0.4, -0.5], foreArmR: [-1.9, 0, 0] } }; });
  mk('cough', 1.1, (ph) => { const d = kf(ph, [[0, 0], [0.12, 1], [0.85, 1], [1, 0]]); const k = Math.max(0, Math.sin(ph * Math.PI * 6)) * d;
    return { bones: { spine: [0.18 * k + 0.08 * d, 0, 0], chest: [0.15 * k, 0, 0], head: [0.25 * k + 0.1 * d, 0, 0], upperArmL: [-0.9 * d, 0, 0.3 * d], foreArmL: [-1.6 * d, 0, 0] } }; }, { loop: false });
  mk('hit', 0.4, (ph) => { const d = kf(ph, [[0, 0], [0.2, 1], [1, 0]]);
    return { bones: { spine: [-0.3 * d, 0.15 * d, 0], chest: [-0.15 * d, 0, 0], head: [-0.35 * d, 0.2 * d, 0], upperArmL: [-0.4 * d, 0, 0.5 * d + 0.1], upperArmR: [-0.4 * d, 0, -0.5 * d - 0.1] } }; }, { loop: false });
  mk('die', 1.5, (ph) => { const d = kf(ph, [[0, 0], [0.25, 0.25], [0.75, 1], [0.85, 0.97], [1, 1]]);
    return { root: [0, -0.84 * d, -0.35 * d], bones: { hips: [-1.52 * d, 0, 0], spine: [-0.1 * d, 0, 0], head: [-0.2 * d, 0.4 * d, 0],
      thighL: [-0.25 * d, 0, 0.15 * d], shinL: [0.3 * d, 0, 0], thighR: [0.05 * d, 0, -0.1 * d], shinR: [0.1 * d, 0, 0],
      upperArmL: [-0.4 * d, 0, 1.2 * d], foreArmL: [-0.3 * d, 0, 0], upperArmR: [-0.6 * d, 0, -1.0 * d], foreArmR: [-0.5 * d, 0, 0] } }; }, { loop: false });
  // desmaio: cai de peito no chão (rosto virado de lado, braços à frente); finalizado: no chão de bruços, mexe os braços e para
  const prone = (d, armL = 0, armR = 0) => ({ root: [0, -0.86 * d, 0.42 * d], bones: { hips: [1.5 * d, 0, 0], spine: [0.02 * d, 0, 0], chest: [-0.04 * d, 0, 0], head: [-0.35 * d, 0.95 * d, 0.1 * d],
    upperArmL: [-2.3 * d + armL, 0, 0.55 * d + armL * 0.5], foreArmL: [-0.9 * d, 0, 0], upperArmR: [-1.0 * d - armR * 0.6, 0, -0.75 * d - armR * 0.4], foreArmR: [-0.5 * d, 0, 0],
    thighL: [0.12 * d, 0, 0.12 * d], shinL: [0.55 * d, 0, 0], footL: [0.6 * d, 0, 0], thighR: [-0.05 * d, 0, -0.08 * d], shinR: [0.2 * d, 0, 0], footR: [0.7 * d, 0, 0] } });
  mk('faint', 1.3, (ph) => prone(kf(ph, [[0, 0], [0.2, 0.15], [0.6, 1], [0.7, 0.96], [1, 1]])), { loop: false });
  mk('finish', 3.2, (ph) => { const live = Math.max(0, 1 - ph / 0.75); const a = Math.sin(ph * 38) * 0.55 * live, b = Math.sin(ph * 31 + 1.3) * 0.5 * live; return prone(1, a, b); }, { loop: false });
  // carregador: curvado sob o peso, mãos segurando as alças no peito, passos curtos e joelhos dobrados
  // segurando forte as alças do mochilão na frente do peito (cotovelos colados no corpo, mãos fechadas nas alças, tremendo com o peso)
  let _sk = 0; const strap = (p) => { _sk += 1; const tr = Math.sin(_sk * 2.7) * 0.025; Object.assign(p.bones, { upperArmL: [0.5 + tr, 0.1, 0.2], foreArmL: [-2.75 - tr, -0.35, 0], handL: [0.5, 0, 0], upperArmR: [0.5 - tr, -0.1, -0.2], foreArmR: [-2.75 + tr, 0.35, 0], handR: [0.5, 0, 0] }); return p; };
  mk('carryWalk', 1.25, (ph) => strap(gait(ph, { stride: 0.3, knee: 0.75, knee0: 0.3, thigh0: -0.18, foot0: 0.05, bob: 0.025, drop: -0.08, lean: 0.5, twist: 0.05, hipTwist: 0.05, arm: 0, arm0: 0, elbow: 0, elbowSwing: 0 })));
  mk('carryRun', 0.85, (ph) => strap(gait(ph, { stride: 0.55, knee: 1.2, knee0: 0.35, thigh0: -0.25, foot0: 0.08, bob: 0.045, drop: -0.1, lean: 0.62, twist: 0.08, hipTwist: 0.08, arm: 0, arm0: 0, elbow: 0, elbowSwing: 0 })));
  mk('carryIdle', 3, (ph) => { const b = Math.sin(ph * TAU); return strap({ root: [0, -0.08 + 0.006 * b, 0], bones: { hips: [0, 0, 0], spine: [0.48 + 0.02 * b, 0, 0], chest: [0.18, 0, 0], head: [-0.5, 0.05 * b, 0], thighL: [-0.2, 0, 0.05], shinL: [0.35, 0, 0], footL: [-0.1, 0, 0], thighR: [-0.15, 0, -0.05], shinR: [0.3, 0, 0], footR: [-0.1, 0, 0] } }); });
  // vômito: curvado, mãos nos joelhos, convulsões
  mk('vomit', 2.4, (ph) => { const d = kf(ph, [[0, 0], [0.15, 1], [0.85, 1], [1, 0]]); const k = Math.max(0, Math.sin(ph * Math.PI * 7)) * d;
    return { root: [0, -0.12 * d, 0], bones: { spine: [0.55 * d + 0.12 * k, 0, 0], chest: [0.25 * d + 0.1 * k, 0, 0], head: [0.35 * d + 0.25 * k, 0, 0], thighL: [-0.35 * d, 0, 0.05], shinL: [0.55 * d, 0, 0], thighR: [-0.35 * d, 0, -0.05], shinR: [0.55 * d, 0, 0],
      upperArmL: [-0.75 * d, 0, 0.25 * d], foreArmL: [-0.35 * d, 0, 0], upperArmR: [-0.75 * d, 0, -0.25 * d], foreArmR: [-0.35 * d, 0, 0] } }; }, { loop: false, events: [{ t: 0.3, name: 'spew' }, { t: 0.6, name: 'spew' }] });
  mk('sleep', 2, () => ({ root: [0, -0.84, 0], bones: { hips: [-1.55, 0, 0.1], head: [0, 0.5, 0], upperArmL: [-0.2, 0, 0.3], upperArmR: [-2.6, 0, -0.3], foreArmR: [-1.5, 0, 0], thighL: [-0.3, 0, 0.1], shinL: [0.5, 0, 0] } }));
  // garra (inimigo)
  mk('claw', 0.85, (ph) => { const u = kf(ph, [[0, 0], [0.4, 1], [0.55, -0.5], [0.75, -0.5], [1, 0]]);
    return { root: [0, 0, 0.12 * Math.max(0, -u)], bones: { spine: [0.35 + 0.3 * Math.max(0, -u) - 0.2 * Math.max(0, u), 0, 0],
      upperArmR: [-0.6 - 1.9 * Math.max(0, u) + 0.2 * Math.max(0, -u), 0, -0.3 - 0.4 * Math.max(0, u)], foreArmR: [-0.9 * Math.max(0, u) - 0.3, 0, 0],
      upperArmL: [-0.6 - 1.9 * Math.max(0, u) + 0.2 * Math.max(0, -u), 0, 0.3 + 0.4 * Math.max(0, u)], foreArmL: [-0.9 * Math.max(0, u) - 0.3, 0, 0], head: [-0.3, 0, 0] } }; }, { loop: false, events: [{ t: 0.5, name: 'hit' }] });
  // mira e disparo com fuzil (androide soldado)
  mk('aim', 1.6, (ph) => { const b = Math.sin(ph * TAU) * 0.015;
    return { bones: { spine: [0.05, -0.25, 0], chest: [0, -0.15, 0], head: [0, 0.35, 0], upperArmR: [-1.45 + b, 0.15, -0.1], foreArmR: [-0.1, 0, 0], handR: [0, 0, 0], upperArmL: [-1.25 + b, 0.55, 0.15], foreArmL: [-0.7, 0, 0] } }; });
  mk('shoot', 0.45, (ph) => { const r = kf(ph, [[0, 0], [0.12, 1], [1, 0]]);
    return { bones: { spine: [0.05 - 0.08 * r, -0.25, 0], chest: [-0.05 * r, -0.15, 0], head: [0, 0.35, 0], upperArmR: [-1.45 - 0.25 * r, 0.15, -0.1], foreArmR: [-0.1 - 0.2 * r, 0, 0], upperArmL: [-1.25 - 0.2 * r, 0.55, 0.15], foreArmL: [-0.7, 0, 0] } }; }, { loop: false, events: [{ t: 0.08, name: 'fire' }] });
  // ---- armas de fogo (jogador): posturas de segurar/mirar e recargas ----
  mk('rifleHold', 2.4, (ph) => { const b = Math.sin(ph * TAU) * 0.012;
    return { bones: { spine: [0.04 + b, -0.12, 0], chest: [0, -0.08, 0], head: [0, 0.18, 0], upperArmR: [-0.55 + b, 0.2, -0.32], foreArmR: [-1.25, 0, 0], handR: [0.15, 0, 0.2],
      upperArmL: [-0.95, 0.65, 0.35], foreArmL: [-1.05, 0, 0], handL: [0, 0, 0] } }; });
  mk('rifleAim', 1.8, (ph) => { const b = Math.sin(ph * TAU) * 0.008;
    return { bones: { spine: [0.04, -0.12, 0], chest: [0, -0.06, 0], head: [0.04, 0.16, 0], upperArmR: [-1.4 + b, 0.15, -0.3], foreArmR: [-0.5, 0, 0], handR: [0.4, 0, 0.1],
      upperArmL: [-1.3 + b, 0.62, 0.2], foreArmL: [-0.45, 0, 0], handL: [0, 0, 0] } }; });
  mk('pistolHold', 2.4, (ph) => { const b = Math.sin(ph * TAU) * 0.012;
    return { bones: { spine: [0.03 + b, 0, 0], upperArmR: [-0.45 + b, 0.1, -0.1], foreArmR: [-0.9, 0, 0], handR: [0.5, 0, 0], upperArmL: [-0.35, -0.2, 0.12], foreArmL: [-0.9, 0, 0] } }; });
  mk('pistolAim', 1.8, (ph) => { const b = Math.sin(ph * TAU) * 0.008;
    return { bones: { spine: [0.04, 0, 0], head: [0.05, 0, 0], upperArmR: [-1.5 + b, 0.3, -0.05], foreArmR: [-0.1, 0, 0], handR: [0.1, 0, 0],
      upperArmL: [-1.35 + b, -0.45, 0.12], foreArmL: [-0.35, 0, 0], handL: [0, 0, 0] } }; });
  mk('reloadRifle', 2.0, (ph) => { const d = kf(ph, [[0, 0], [0.15, 1], [0.85, 1], [1, 0]]); const m = kf(ph, [[0, 0], [0.2, 0], [0.38, 1], [0.55, 1], [0.7, 0.2], [0.85, 0], [1, 0]]);
    return { bones: { spine: [0.08 + 0.08 * d, -0.12, 0], chest: [0.05 * d, -0.08, 0], head: [0.35 * d, 0.1, 0], upperArmR: [-0.75 - 0.15 * d, 0.2, -0.35], foreArmR: [-1.2, 0, 0], handR: [0.15 + 0.4 * d, 0, 0.2],
      upperArmL: [-0.95 + 0.6 * m, 0.65 - 0.4 * m, 0.35 + 0.15 * m], foreArmL: [-1.05 - 0.4 * m, 0, 0] } }; }, { loop: false, events: [{ t: 0.25, name: 'magOut' }, { t: 0.68, name: 'magIn' }, { t: 0.85, name: 'bolt' }] });
  mk('reloadPistol', 1.5, (ph) => { const d = kf(ph, [[0, 0], [0.15, 1], [0.85, 1], [1, 0]]); const m = kf(ph, [[0, 0], [0.2, 0], [0.4, 1], [0.55, 1], [0.72, 0], [1, 0]]);
    return { bones: { spine: [0.05, 0, 0], head: [0.35 * d, 0, 0], upperArmR: [-0.8 * d - 0.3, 0.1, -0.1], foreArmR: [-1.2 * d - 0.3, 0, 0], handR: [0.4, 0, 0],
      upperArmL: [-0.4 - 0.5 * d + 0.5 * m, -0.2, 0.12 + 0.2 * m], foreArmL: [-1.1 * d - 0.3, 0, 0] } }; }, { loop: false, events: [{ t: 0.25, name: 'magOut' }, { t: 0.7, name: 'magIn' }, { t: 0.82, name: 'bolt' }] });
  mk('loadShell', 0.55, (ph) => { const m = kf(ph, [[0, 0], [0.35, 1], [0.7, 0.3], [1, 0]]);
    return { bones: { spine: [0.08, -0.12, 0], head: [0.25, 0.1, 0], upperArmR: [-0.75, 0.2, -0.35], foreArmR: [-1.2, 0, 0], handR: [0.5, 0, 0.2], upperArmL: [-0.95 + 0.5 * m, 0.65 - 0.3 * m, 0.35], foreArmL: [-1.05 - 0.5 * m, 0, 0] } }; }, { loop: false, events: [{ t: 0.6, name: 'magIn' }] });
  C.masks = { upper: maskFrom(skel, 'spine'), arms: new Set([...maskFrom(skel, 'shoulderL'), ...maskFrom(skel, 'shoulderR')]) };
  return C;
}
