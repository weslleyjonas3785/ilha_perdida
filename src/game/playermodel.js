// Personagem jogável (UNIT-7): anatomia com superfícies suaves (tronco, pernas e cabeça modelados por anéis),
// rosto com olhos, nariz, boca e orelhas, cabelo em mechas, moletom com capuz e zíper, calça, botas
// e dois braços robóticos detalhados com luzes ciano. "UNIT-7" nas costas.
import { MeshBuilder, M, hex, shade } from '../engine/mesh.js';
class PBuilder extends MeshBuilder { box(m, sx, sy, sz, c) { return Math.min(sx, sy, sz) < 0.015 ? super.box(m, sx, sy, sz, c) : this.roundBox(m, sx, sy, sz, c, null, 2); } }
import { mat4, quat, rng } from '../engine/math.js';
import { METAL, GLOW } from './androids.js';

function restWorld(sk) { const w = []; sk.bones.forEach((b, i) => { const p = b.parent >= 0 ? w[b.parent] : [0, 0, 0]; w[i] = [p[0] + b.pos[0], p[1] + b.pos[1], p[2] + b.pos[2]]; }); return w; }
function seg(mb, a, b, r0, r1, sides, col, caps = true) {
  const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]; const len = Math.hypot(...d) || 1e-3; const n = d.map((v) => v / len);
  const q = n[1] < -0.9999 ? [1, 0, 0, 0] : quat.normalize([n[2], 0, -n[0], 1 + n[1]]);
  mb.cylinder(mat4.fromTRS(mat4.create(), a, q, [1, 1, 1]), r0, r1, len, sides, col, caps);
}
const FONT = { U: ['101', '101', '101', '101', '111'], N: ['101', '111', '111', '111', '101'], I: ['111', '010', '010', '010', '111'], T: ['111', '010', '010', '010', '010'], '-': ['000', '000', '111', '000', '000'], 7: ['111', '001', '010', '010', '010'] };
// pesos interpolados ao longo de Y entre ossos com centros conhecidos
const chainWeights = (chain) => (p) => {
  const y = p[1]; if (y <= chain[0][1]) return { j: [chain[0][0]], w: [1] };
  for (let i = 0; i < chain.length - 1; i++) { const [b0, y0] = chain[i], [b1, y1] = chain[i + 1]; if (y <= y1) { const t = (y - y0) / (y1 - y0); const s = t * t * (3 - 2 * t); return { j: [b0, b1], w: [1 - s, s] }; } }
  return { j: [chain[chain.length - 1][0]], w: [1] };
};

export const LOOK_DEFAULT = { name: 'Sobrevivente', hair: 0x3b2417, hairStyle: 'espetado', jacket: 0x3b3c42, shirt: 0xb8b8ba, pants: 0x2b2b30, shoes: 0x2a2a2e };
export const HAIR_STYLES = { espetado: 'Espetado', curto: 'Curto', longo: 'Longo', moicano: 'Moicano' };
export function buildPlayerMesh(skel, look = {}) {
  const L = { ...LOOK_DEFAULT, ...look };
  const mb = new PBuilder({ skinned: true }); const W = restWorld(skel), I = skel.index; const r = rng(77);
  const skin = hex(0xd9a684), skinD = hex(0xc08a6a), lip = hex(0xb7766a), hair = hex(L.hair), hood = hex(L.jacket), hoodD = shade(hood, 0.72), pants = hex(L.pants), pantsD = shade(pants, 0.75), shirt = hex(L.shirt), shirtD = shade(shirt, 0.8);
  const boots = hex(L.shoes), sole = hex(0xb4b4b6), white = hex(0xd8d8d8), metal = hex(0x4a4d55), metalD = hex(0x23252a), metalM = hex(0x5c6068), cyan = hex(0x2aa8ff), gold = hex(0xd9a441); void gold;
  const yHd = W[I.head][1];
  mb.flex = 1;
  // ================= tronco (moletom) =================
  mb.weightFn = chainWeights([[I.hips, 0.95], [I.spine, 1.12], [I.chest, 1.33], [I.neck, 1.52]]);
  const back = (a) => 1 - 0.1 * Math.max(0, -Math.cos(a)) ** 2; // costas um pouco mais retas
  mb.loft([
    { y: 0.86, rx: 0.155, rz: 0.104, col: pants }, { y: 0.915, rx: 0.16, rz: 0.108, col: pants },
    { y: 0.92, rx: 0.172, rz: 0.118, col: hoodD }, { y: 0.965, rx: 0.172, rz: 0.118, col: hoodD },
    { y: 0.97, rx: 0.166, rz: 0.113, col: hood }, { y: 1.04, rx: 0.158, rz: 0.108 }, { y: 1.12, rx: 0.16, rz: 0.11 },
    { y: 1.22, rx: 0.175, rz: 0.12, cz: 0.008 }, { y: 1.31, rx: 0.19, rz: 0.128, cz: 0.012 }, { y: 1.39, rx: 0.198, rz: 0.122, cz: 0.008 },
    { y: 1.44, rx: 0.186, rz: 0.106 }, { y: 1.48, rx: 0.14, rz: 0.088 }, { y: 1.51, rx: 0.075, rz: 0.066 },
  ].map((g) => ({ ...g, prof: back })), 22, hood);
  mb.weightFn = null; mb.setBone(I.spine);
  // cinto
  mb.loft([{ y: 0.9, rx: 0.165, rz: 0.112, col: hex(0x1c1c1e) }, { y: 0.935, rx: 0.165, rz: 0.112, col: hex(0x1c1c1e) }], 22, hex(0x1c1c1e), false, false);
  mb.flex = METAL; mb.box(M(0, 0.918, 0.112), 0.05, 0.03, 0.01, hex(0x9a9ca2)); mb.flex = 1;
  mb.setBone(I.chest);
  // jaqueta aberta: camiseta clara por baixo, com gola em V, e as bordas (lapelas) da jaqueta
  const front = [[0.97, 0.115], [1.04, 0.11], [1.12, 0.112], [1.22, 0.13], [1.31, 0.142], [1.39, 0.132], [1.44, 0.108]];
  for (let i = 0; i < front.length - 1; i++) { const [y0, z0] = front[i], [y1, z1] = front[i + 1]; const ym = (y0 + y1) / 2, zm = (z0 + z1) / 2 + 0.003; const w = 0.12 - Math.max(0, ym - 1.3) * 0.5;
    const tilt = Math.atan2(z1 - z0, y1 - y0); mb.box(M(0, ym, zm, 0, 1, tilt), w, y1 - y0 + 0.004, 0.006, ym > 1.36 ? shirtD : shirt);
    for (const sd of [-1, 1]) mb.box(M(sd * (w / 2 + 0.012), ym, zm + 0.004, 0, 1, tilt), 0.026, y1 - y0 + 0.004, 0.012, hoodD); }
  mb.box(M(0, 1.36, 0.141, 0, 1, -0.2), 0.03, 0.05, 0.006, skin); // decote
  for (const sd of [-1, 1]) { mb.box(M(sd * 0.11, 1.02, 0.1, sd * 0.25), 0.07, 0.012, 0.03, hoodD); } // bolsos laterais
  // capuz caído nas costas
  mb.sphere(mat4.fromTRS(mat4.create(), [0, 1.44, -0.115], quat.fromEuler(-0.35, 0, 0), [0.95, 0.62, 0.42]), 0.13, 16, 10, hood);
  mb.loft([{ y: 1.47, rx: 0.098, rz: 0.088, col: hoodD }, { y: 1.53, rx: 0.092, rz: 0.084, col: hoodD }], 18, hoodD, false, false);
  // ================= pescoço e cabeça =================
  mb.weightFn = chainWeights([[I.chest, 1.47], [I.neck, 1.52], [I.head, 1.6]]);
  mb.loft([{ y: 1.47, rx: 0.056, rz: 0.058 }, { y: 1.55, rx: 0.05, rz: 0.054, cz: 0.005 }, { y: 1.62, rx: 0.048, rz: 0.05 }], 14, skin, false, false);
  mb.weightFn = null; mb.setBone(I.head);
  const H = [[1.583, 0.026, 0.03, 0.058], [1.598, 0.048, 0.05, 0.05], [1.62, 0.066, 0.075, 0.026], [1.65, 0.075, 0.09, 0.015], [1.68, 0.082, 0.097, 0.01], [1.715, 0.086, 0.1, 0.005],
    [1.745, 0.087, 0.1, 0], [1.775, 0.084, 0.097, -0.005], [1.8, 0.075, 0.088, -0.01], [1.825, 0.056, 0.069, -0.015], [1.843, 0.03, 0.038, -0.018], [1.85, 0.006, 0.006, -0.02]];
  mb.loft(H.map(([y, rx, rz, cz]) => ({ y, rx, rz, cz })), 22, skin);
  // olhos
  for (const s of [-1, 1]) {
    mb.sphere(mat4.fromTRS(mat4.create(), [s * 0.034, 1.717, 0.091], [0, 0, 0, 1], [1, 0.75, 0.6]), 0.0145, 10, 7, white);
    mb.sphere(M(s * 0.034, 1.717, 0.0985), 0.0082, 8, 6, hex(0x4a3020)); mb.sphere(M(s * 0.034, 1.717, 0.1035), 0.0042, 6, 4, hex(0x0c0806));
    mb.box(M(s * 0.036, 1.7285, 0.098, 0, 1, 0.25), 0.032, 0.006, 0.012, skinD); // pálpebra
    mb.box(M(s * 0.038, 1.744, 0.1, 0, 1, 0.2, s * 0.12), 0.036, 0.008, 0.012, hair); // sobrancelha
    mb.sphere(mat4.fromTRS(mat4.create(), [s * 0.087, 1.712, -0.006], [0, 0, 0, 1], [0.35, 1, 0.75]), 0.026, 10, 7, skinD); // orelha
  }
  seg(mb, [0, 1.722, 0.1], [0, 1.69, 0.118], 0.011, 0.016, 8, skin); mb.sphere(mat4.fromTRS(mat4.create(), [0, 1.688, 0.112], [0, 0, 0, 1], [1.4, 0.8, 1]), 0.013, 8, 6, skin); // nariz
  mb.sphere(mat4.fromTRS(mat4.create(), [0, 1.652, 0.094], [0, 0, 0, 1], [1.9, 0.5, 0.7]), 0.014, 10, 6, lip); // boca
  // cabelo: calota + mechas bagunçadas
  mb.sphere(mat4.fromTRS(mat4.create(), [0, 1.775, -0.012], [0, 0, 0, 1], [0.97, 0.82, 1.06]), 0.098, 16, 10, hair);
  const st = L.hairStyle;
  const strand = (base, tip, r0) => seg(mb, base, tip, r0, 0.003, 6, shade(hair, 0.8 + r() * 0.35));
  if (st === 'moicano') { mb.sphere(mat4.fromTRS(mat4.create(), [0, 1.775, -0.012], [0, 0, 0, 1], [0.995, 0.83, 1.07]), 0.098, 16, 10, shade(skin, 0.92));
    for (let i = 0; i < 9; i++) { const zz = 0.07 - i * 0.022; strand([0, 1.84 - Math.abs(zz) * 0.3, zz], [0, 1.93 - Math.abs(zz) * 0.5, zz - 0.02], 0.026); } }
  else {
    const n = st === 'curto' ? 22 : 34, L0 = st === 'curto' ? 0.025 : 0.05;
    for (let i = 0; i < n; i++) {
      const a = r() * Math.PI * 2, el = (st === 'longo' ? -0.2 : 0.25) + r() * 1.1; const dx = Math.cos(a) * Math.cos(el), dz = Math.sin(a) * Math.cos(el), dy = Math.sin(el);
      if (dz > 0.45 && dy < 0.75) continue; // rosto livre
      const base = [dx * 0.08, 1.78 + dy * 0.06, -0.012 + dz * 0.088]; const len = L0 + r() * L0;
      if (st === 'longo') { if (dz > 0.3) continue; strand(base, [base[0] * 1.25, base[1] - 0.12 - r() * 0.06, base[2] * 1.15 - 0.02], 0.026); continue; }
      strand(base, [base[0] + dx * len + (r() - 0.5) * 0.03, base[1] + dy * len * 0.6 + 0.015, base[2] + dz * len - 0.025 * (dz < 0 ? 0 : 1)], 0.024 + r() * 0.012);
    }
    for (let i = 0; i < 7; i++) { const x = -0.065 + i * 0.022; strand([x, 1.81, 0.06], [x + (r() - 0.5) * 0.04, (st === 'curto' ? 1.79 : 1.765) + r() * 0.015, 0.108], 0.018); } // franja
  }
  // ================= braços robóticos =================
  for (const s of ['L', 'R']) {
    const sg = s === 'L' ? 1 : -1; const sh = W[I['upperArm' + s]], el = W[I['foreArm' + s]], wr = W[I['hand' + s]];
    mb.setBone(I['shoulder' + s]); mb.flex = METAL;
    mb.sphere(M(sh[0] - sg * 0.012, sh[1] + 0.004, 0), 0.07, 14, 10, metalD);
    mb.sphere(mat4.fromTRS(mat4.create(), [sh[0] + sg * 0.008, sh[1] + 0.035, 0], quat.fromEuler(0, 0, sg * -0.35), [1.05, 0.55, 1.0]), 0.07, 14, 9, metal); // ombreira
    mb.flex = GLOW; mb.cylinder(M(sh[0] + sg * 0.072, sh[1] - 0.005, 0, 0, 1, 0, -sg * Math.PI / 2), 0.03, 0.03, 0.008, 16, cyan, true); mb.flex = METAL;
    mb.cylinder(M(sh[0] + sg * 0.07, sh[1] - 0.005, 0, 0, 1, 0, -sg * Math.PI / 2), 0.042, 0.042, 0.006, 16, metalM, true);
    mb.setBone(I['upperArm' + s]); mb.flex = METAL;
    seg(mb, [sh[0], sh[1] - 0.03, 0], [el[0], el[1] + 0.02, 0], 0.032, 0.03, 10, metalD);
    seg(mb, [sh[0], sh[1] - 0.06, 0.004], [el[0], el[1] + 0.045, 0.004], 0.05, 0.043, 14, metal);
    mb.box(M(sh[0] + sg * 0.04, (sh[1] + el[1]) / 2 + 0.01, 0), 0.022, 0.15, 0.07, metalM);
    mb.flex = GLOW; for (const dz of [-0.022, 0.022]) mb.box(M(sh[0] + sg * 0.052, (sh[1] + el[1]) / 2 + 0.01, dz), 0.005, 0.11, 0.007, cyan); mb.flex = METAL;
    seg(mb, [sh[0] - sg * 0.01, sh[1] - 0.07, -0.045], [el[0] - sg * 0.01, el[1] + 0.04, -0.045], 0.011, 0.011, 8, metalM); // pistão
    seg(mb, [sh[0] - sg * 0.01, sh[1] - 0.16, -0.045], [el[0] - sg * 0.01, el[1] + 0.03, -0.045], 0.007, 0.007, 8, white);
    seg(mb, [sh[0] - sg * 0.025, sh[1] - 0.03, -0.055], [el[0] - sg * 0.02, el[1] + 0.01, -0.06], 0.007, 0.007, 6, metalD); // cabo
    mb.sphere(M(el[0], el[1], 0), 0.042, 12, 8, metalD); mb.cylinder(M(el[0] + sg * 0.04, el[1], 0, 0, 1, 0, -sg * Math.PI / 2), 0.03, 0.03, 0.012, 14, metalM, true);
    mb.setBone(I['foreArm' + s]); mb.flex = METAL;
    seg(mb, [el[0], el[1] - 0.02, 0], [wr[0], wr[1] + 0.02, 0], 0.03, 0.026, 10, metalD);
    seg(mb, [el[0], el[1] - 0.04, 0.002], [wr[0], wr[1] + 0.035, 0.002], 0.05, 0.038, 14, metal);
    mb.box(M(wr[0] + sg * 0.012, (el[1] + wr[1]) / 2 + 0.01, -0.038), 0.07, 0.14, 0.022, metalM);
    mb.flex = GLOW; mb.box(M(wr[0] + sg * 0.012, (el[1] + wr[1]) / 2 + 0.01, -0.0505), 0.036, 0.095, 0.004, cyan);
    for (let k = 0; k < 3; k++) mb.box(M(wr[0] + sg * 0.046, el[1] - 0.07 - k * 0.035, 0.0), 0.004, 0.016, 0.04, cyan); mb.flex = METAL;
    mb.cylinder(M(wr[0], wr[1] + 0.005, 0), 0.036, 0.036, 0.02, 14, metalM, true); // pulso
    mb.setBone(I['hand' + s]); mb.flex = METAL;
    mb.box(M(wr[0], wr[1] - 0.052, 0.004), 0.055, 0.075, 0.072, metalD); mb.box(M(wr[0] + sg * 0.012, wr[1] - 0.05, 0.004), 0.012, 0.06, 0.06, metal);
    for (let f = 0; f < 4; f++) { const fz = -0.026 + f * 0.0175, x0 = wr[0] - sg * 0.002;
      const p0 = [x0, wr[1] - 0.09, fz], p1 = [x0, wr[1] - 0.125, fz + 0.004], p2 = [x0 - sg * 0.004, wr[1] - 0.152, fz + 0.01];
      mb.sphere(M(...p0), 0.009, 8, 5, metalM); seg(mb, p0, p1, 0.008, 0.007, 8, metal); mb.sphere(M(...p1), 0.0075, 8, 5, metalD); seg(mb, p1, p2, 0.0068, 0.0055, 8, metal); }
    const t0 = [wr[0] - sg * 0.022, wr[1] - 0.05, 0.036], t1 = [wr[0] - sg * 0.03, wr[1] - 0.085, 0.055], t2 = [wr[0] - sg * 0.03, wr[1] - 0.11, 0.065];
    mb.sphere(M(...t0), 0.01, 8, 5, metalM); seg(mb, t0, t1, 0.009, 0.008, 8, metal); seg(mb, t1, t2, 0.0075, 0.006, 8, metal);
  }

  // ================= pernas: calça e botas =================
  mb.flex = 1;
  for (const s of ['L', 'R']) {
    const x = W[I['thigh' + s]][0]; const an = W[I['foot' + s]];
    mb.weightFn = chainWeights([[I['shin' + s], 0.5], [I['thigh' + s], 0.6], [I['thigh' + s], 0.86], [I.hips, 0.96]]);
    mb.loft([[0.17, 0.047, 0.05, 0], [0.26, 0.05, 0.052, -0.004], [0.38, 0.062, 0.064, -0.01], [0.48, 0.058, 0.062, -0.004], [0.56, 0.06, 0.064, 0.004],
      [0.66, 0.076, 0.079, 0.004], [0.8, 0.09, 0.094, 0], [0.93, 0.095, 0.098, -0.004], [0.96, 0.07, 0.07, 0]].map(([y, rx, rz, cz]) => ({ y, rx, rz, cz, cx: x, col: y < 0.2 ? pantsD : pants })), 16, pants);
    mb.weightFn = null;
    // botas
    mb.setBone(I['shin' + s]);
    mb.loft([{ y: an[1] - 0.05, rx: 0.058, rz: 0.066, cx: x, cz: 0.0 }, { y: an[1] + 0.04, rx: 0.055, rz: 0.058, cx: x }, { y: an[1] + 0.13, rx: 0.06, rz: 0.06, cx: x }, { y: an[1] + 0.145, rx: 0.066, rz: 0.066, cx: x, col: shade(boots, 0.8) }], 14, boots);
    mb.setBone(I['foot' + s]);
    mb.loft([{ y: an[1] - 0.09, rx: 0.055, rz: 0.13, cx: x, cz: 0.045, col: sole }, { y: an[1] - 0.075, rx: 0.056, rz: 0.13, cx: x, cz: 0.045 }, { y: an[1] - 0.03, rx: 0.052, rz: 0.12, cx: x, cz: 0.04 }, { y: an[1] - 0.005, rx: 0.035, rz: 0.08, cx: x, cz: 0.02 }], 16, boots);
    for (let k = 0; k < 3; k++) mb.box(M(x, an[1] + 0.03 + k * 0.03, 0.055 - k * 0.004, 0, 1, -0.3), 0.04, 0.006, 0.01, shade(boots, 0.6)); // cadarços
    mb.weightFn = null; mb.setBone(I['thigh' + s]); const sx = Math.sign(x); mb.box(M(x + sx * 0.085, 0.66, 0.005), 0.025, 0.12, 0.1, pantsD); mb.box(M(x + sx * 0.098, 0.715, 0.005), 0.012, 0.025, 0.105, shade(pants, 0.6)); // bolso cargo
  }
  // materiais: pele (subsuperfície), moletom/calça (tecido), botas (couro)
  const SKIN = 0.76, FAB = 0.83, LEA = 0.7;
  mb.tagMaterials([[skin, SKIN], [skinD, SKIN], [lip, SKIN], [hood, FAB], [hoodD, FAB], [pants, FAB], [pantsD, FAB], [shirt, FAB], [shirtD, FAB], [white, FAB], [shade(white, 0.75), FAB], [boots, LEA], [shade(boots, 0.6), LEA]], 0.12);
  const d = mb.build();
  // proporções do personagem de referência: cabeça e cabelo um pouco maiores (estilo estilizado)
  const hb = I.head, piv = [0, 1.585, 0.01], K = 1.18;
  for (let v = 0; v < d.pos.length / 3; v++) if (d.joints[v * 4] === hb && d.weights[v * 4] > 0.99) for (let c = 0; c < 3; c++) d.pos[v * 3 + c] = piv[c] + (d.pos[v * 3 + c] - piv[c]) * K;
  return d;
}
