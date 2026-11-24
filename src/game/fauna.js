// Fauna fiel às referências (estilo low-poly facetado, nítido): cervo com galhada e javali com crina.
// Cada espécie tem esqueleto próprio (proporções reais) e malha esculpida por seções (lofts) com
// pesos de pele por osso; no fim a malha é "facetada" (normais por face + leve variação de tom).
import { Skeleton } from '../engine/skeleton.js';
import { MeshBuilder, M, hex, shade } from '../engine/mesh.js';
import { rng, clamp } from '../engine/math.js';

const QB = (name, parent, pos) => ({ name, parent, pos });
function quadSkel(o) {
  return new Skeleton([
    QB('pelvis', -1, o.pelvis), QB('spine', 0, o.spine), QB('chest', 1, o.chest), QB('neck', 2, o.neck), QB('head', 3, o.head), QB('tail', 0, o.tail),
    QB('upFL', 2, [o.fx, o.fy, 0.02]), QB('loFL', 6, [0, -o.fl1, 0]), QB('pawFL', 7, [0, -o.fl2, 0]),
    QB('upFR', 2, [-o.fx, o.fy, 0.02]), QB('loFR', 9, [0, -o.fl1, 0]), QB('pawFR', 10, [0, -o.fl2, 0]),
    QB('upBL', 0, [o.bx, o.by, 0]), QB('loBL', 12, [0, -o.bl1, 0]), QB('pawBL', 13, [0, -o.bl2, 0]),
    QB('upBR', 0, [-o.bx, o.by, 0]), QB('loBR', 15, [0, -o.bl1, 0]), QB('pawBR', 16, [0, -o.bl2, 0]),
  ]);
}
export const makeDeerSkeleton = () => quadSkel({ pelvis: [0, 0.98, -0.4], spine: [0, 0.02, 0.4], chest: [0, 0, 0.38], neck: [0, 0.14, 0.16], head: [0, 0.4, 0.14], tail: [0, 0.08, -0.12],
  fx: 0.12, fy: -0.12, fl1: 0.42, fl2: 0.44, bx: 0.12, by: -0.08, bl1: 0.44, bl2: 0.44 });
export const makeBoarSkeleton = () => quadSkel({ pelvis: [0, 0.62, -0.42], spine: [0, 0.06, 0.42], chest: [0, 0.06, 0.36], neck: [0, -0.02, 0.16], head: [0, -0.06, 0.18], tail: [0, 0.06, -0.14],
  fx: 0.13, fy: -0.14, fl1: 0.28, fl2: 0.32, bx: 0.13, by: -0.06, bl1: 0.26, bl2: 0.28 });

function rest(sk) { const w = []; sk.bones.forEach((b, i) => { const p = b.parent >= 0 ? w[b.parent] : [0, 0, 0]; w[i] = [p[0] + b.pos[0], p[1] + b.pos[1], p[2] + b.pos[2]]; }); return w; }
const nrm = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

// tubo por anéis elípticos ao longo de uma curva (centro c, raios rx lateral / ry vertical)
function tube(mb, rings, seg, colFn, caps = [true, true]) {
  const base = mb.pos.length / 3; const n = rings.length;
  for (let i = 0; i < n; i++) {
    const r = rings[i]; const a = rings[Math.max(0, i - 1)].c, b = rings[Math.min(n - 1, i + 1)].c; const t = nrm([b[0] - a[0], b[1] - a[1], b[2] - a[2]]);
    let side = cross([0, 1, 0], t); if (Math.hypot(...side) < 0.2) side = [1, 0, 0]; side = nrm(side); const up = nrm(cross(t, side));
    for (let j = 0; j < seg; j++) { const th = (j / seg) * Math.PI * 2 + (r.twist || 0); const cs = Math.cos(th), sn = Math.sin(th); const k = r.prof ? r.prof(th) : 1;
      const p = [r.c[0] + side[0] * cs * r.rx * k + up[0] * sn * r.ry * k, r.c[1] + side[1] * cs * r.rx * k + up[1] * sn * r.ry * k, r.c[2] + side[2] * cs * r.rx * k + up[2] * sn * r.ry * k];
      mb.vert(p, [0, 1, 0], colFn(p, r, cs, sn, i)); }
  }
  for (let i = 0; i < n - 1; i++) for (let j = 0; j < seg; j++) { const a = base + i * seg + j, b = base + i * seg + (j + 1) % seg, c = a + seg, d = b + seg; mb.tri(a, b, c); mb.tri(b, d, c); }
  const cap = (i, flip) => { const r = rings[i]; const c = mb.vert(r.c.slice(), [0, 1, 0], colFn(r.c, r, 0, 0, i)); for (let j = 0; j < seg; j++) { const a = base + i * seg + j, b = base + i * seg + (j + 1) % seg; if (flip) mb.tri(c, a, b); else mb.tri(c, b, a); } };
  if (caps[0]) cap(0, false); if (caps[1]) cap(n - 1, true);
}
// Faceta a malha: vértices por triângulo, normal da face e tom levemente variado por face (visual low-poly nítido)
export function facetize(d, seed = 1, vary = 0.07) {
  const r = rng(seed); const T = d.idx.length; const sk = !!d.joints;
  const pos = new Float32Array(T * 3), nr = new Float32Array(T * 3), col = new Float32Array(T * 4), jo = sk ? new Float32Array(T * 4) : null, we = sk ? new Float32Array(T * 4) : null; const idx = new Uint32Array(T);
  for (let t = 0; t < T; t += 3) {
    const ia = d.idx[t], ib = d.idx[t + 1], ic = d.idx[t + 2]; const P = (i) => [d.pos[i * 3], d.pos[i * 3 + 1], d.pos[i * 3 + 2]];
    const A = P(ia), B = P(ib), C = P(ic); const n = nrm(cross([B[0] - A[0], B[1] - A[1], B[2] - A[2]], [C[0] - A[0], C[1] - A[1], C[2] - A[2]])); const k = 1 + (r() - 0.5) * 2 * vary;
    [ia, ib, ic].forEach((v, q) => { const o = t + q; pos.set(P(v), o * 3); nr.set(n, o * 3);
      col.set([Math.min(1, d.col[v * 4] * k), Math.min(1, d.col[v * 4 + 1] * k), Math.min(1, d.col[v * 4 + 2] * k), d.col[v * 4 + 3]], o * 4);
      if (sk) { jo.set(d.joints.subarray(v * 4, v * 4 + 4), o * 4); we.set(d.weights.subarray(v * 4, v * 4 + 4), o * 4); } idx[o] = o; });
  }
  const out = { pos, nrm: nr, col, idx }; if (sk) { out.joints = jo; out.weights = we; } return out;
}
// pesos: corpo distribuído entre pelve/coluna/peito pelo eixo Z
const bodyW = (I, zP, zC) => (p) => { const t = clamp((p[2] - zP + 0.08) / (zC - zP + 0.16), 0, 1); return t < 0.5 ? { j: [I.pelvis, I.spine], w: [1 - t * 2, t * 2] } : { j: [I.spine, I.chest], w: [2 - t * 2, t * 2 - 1] }; };
const legW = (I, L, yKnee) => (p) => { const t = clamp((yKnee + 0.05 - p[1]) / 0.1, 0, 1); return { j: [I['lo' + L], I['up' + L]], w: [t, 1 - t] }; };
const FUR = 0.83; // material: pelo (faixa de tecido = brilho de borda suave, sem reflexo especular forte)

export function buildDeerMesh(sk) {
  const mb = new MeshBuilder({ skinned: true }); const W = rest(sk), I = sk.index; const r = rng(77);
  const coat = hex(0x8a5332), coatD = hex(0x6e4128), cream = hex(0xe2d0b4), white = hex(0xf0e8dc), hoof = hex(0x231c18), nose = hex(0x1e1a18), antler = hex(0x6a4a30), antlerT = hex(0xc8b090);
  mb.flex = FUR; const zP = W[0][2], zC = W[2][2];
  // tronco: garupa → peito, ventre e peito claros
  mb.weightFn = bodyW(I, zP, zC);
  tube(mb, [{ c: [0, 1.0, -0.68], rx: 0.08, ry: 0.09 }, { c: [0, 1.01, -0.58], rx: 0.2, ry: 0.22 }, { c: [0, 0.99, -0.36], rx: 0.235, ry: 0.27 }, { c: [0, 0.96, -0.08], rx: 0.235, ry: 0.28 },
    { c: [0, 0.98, 0.2], rx: 0.23, ry: 0.29 }, { c: [0, 1.03, 0.42], rx: 0.2, ry: 0.28 }, { c: [0, 1.1, 0.54], rx: 0.15, ry: 0.22 }], 10,
    (p, rr, cs, sn) => (sn < -0.55 ? cream : p[2] < -0.5 && sn < 0.2 ? white : shade(coat, 0.95 + 0.1 * sn)));
  // manchas claras no dorso (como na referência)
  for (let k = 0; k < 22; k++) { const z = -0.46 + r() * 0.7, s = r() < 0.5 ? -1 : 1, th = 0.35 + r() * 0.9; const ry = 0.24, rx = 0.2; const y = 0.98 + Math.sin(th) * ry, x = s * Math.cos(th) * rx;
    mb.box(M(x * 1.02, y, z, 0, 1, 0, s * (Math.PI / 2 - th)), 0.012, 0.035, 0.035, white); }
  // pescoço erguido (garganta creme), com pesos peito → pescoço → cabeça
  mb.weightFn = (p) => { const t = clamp((p[1] - 1.08) / 0.45, 0, 1); return t < 0.5 ? { j: [I.chest, I.neck], w: [1 - t * 2, t * 2] } : { j: [I.neck, I.head], w: [2 - t * 2, t * 2 - 1] }; };
  tube(mb, [{ c: [0, 1.1, 0.5], rx: 0.15, ry: 0.19 }, { c: [0, 1.28, 0.6], rx: 0.12, ry: 0.15 }, { c: [0, 1.45, 0.67], rx: 0.1, ry: 0.12 }, { c: [0, 1.57, 0.7], rx: 0.09, ry: 0.1 }], 8,
    (p, rr, cs, sn) => (sn < -0.2 ? cream : coat), [false, false]);
  // cabeça: crânio → focinho, focinho escuro, olhos, orelhas
  mb.weightFn = null; mb.setBone(I.head); mb.flex = FUR;
  tube(mb, [{ c: [0, 1.6, 0.63], rx: 0.075, ry: 0.075 }, { c: [0, 1.62, 0.71], rx: 0.095, ry: 0.1 }, { c: [0, 1.58, 0.82], rx: 0.078, ry: 0.088 }, { c: [0, 1.53, 0.93], rx: 0.055, ry: 0.062 }, { c: [0, 1.51, 1.0], rx: 0.038, ry: 0.044 }], 8,
    (p, rr, cs, sn) => (sn < -0.4 ? cream : coatD));
  mb.box(M(0, 1.515, 1.02), 0.06, 0.045, 0.03, nose);
  for (const s of [-1, 1]) {
    mb.setColor(hex(0x0c0a08), 0.3); mb.box(M(s * 0.088, 1.635, 0.77, s * 0.3), 0.012, 0.026, 0.034, hex(0x0c0a08)); mb.setColor(cream, FUR); mb.box(M(s * 0.085, 1.605, 0.77), 0.012, 0.014, 0.036, cream);
    mb.flex = FUR; tube(mb, [{ c: [s * 0.07, 1.68, 0.66], rx: 0.035, ry: 0.014 }, { c: [s * 0.16, 1.72, 0.63], rx: 0.055, ry: 0.018 }, { c: [s * 0.25, 1.75, 0.6], rx: 0.022, ry: 0.01 }], 5, (p, rr, cs, sn) => (Math.abs(sn) < 0.3 && cs > 0 ? cream : coatD));
  }
  // galhada: haste principal curvada para trás/fora com pontas para a frente
  mb.flex = 0.63;
  for (const s of [-1, 1]) {
    const pts = [[s * 0.05, 1.7, 0.67], [s * 0.15, 1.86, 0.62], [s * 0.27, 2.02, 0.56], [s * 0.36, 2.18, 0.5], [s * 0.4, 2.34, 0.48], [s * 0.4, 2.46, 0.5]];
    tube(mb, pts.map((c, i) => ({ c, rx: 0.048 - i * 0.007, ry: 0.048 - i * 0.007 })), 6, (p) => (p[1] > 2.3 ? antlerT : antler));
    const tine = (from, dir, len, rad0) => { const rad = rad0 * 1.6; const to = [from[0] + dir[0] * len, from[1] + dir[1] * len, from[2] + dir[2] * len]; tube(mb, [{ c: from, rx: rad, ry: rad }, { c: [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2 + 0.01, (from[2] + to[2]) / 2], rx: rad * 0.7, ry: rad * 0.7 }, { c: to, rx: 0.004, ry: 0.004 }], 4, () => antlerT, [false, false]); };
    tine(pts[0], nrm([s * 0.1, 0.35, 1]), 0.18, 0.018); tine(pts[1], nrm([s * 0.15, 0.6, 1]), 0.24, 0.017); tine(pts[2], nrm([-s * 0.05, 1, 0.45]), 0.26, 0.016); tine(pts[3], nrm([s * 0.6, 0.8, 0.2]), 0.2, 0.014); tine(pts[3], nrm([-s * 0.25, 1, 0.3]), 0.2, 0.013); tine(pts[4], nrm([s * 0.3, 0.9, -0.3]), 0.14, 0.011);
  }
  // cauda curta (lado de baixo branco)
  mb.setBone(I.tail); mb.flex = FUR; tube(mb, [{ c: [0, 1.04, -0.64], rx: 0.045, ry: 0.03 }, { c: [0, 0.98, -0.72], rx: 0.04, ry: 0.025 }, { c: [0, 0.9, -0.74], rx: 0.015, ry: 0.012 }], 6, (p, rr, cs, sn) => (sn < 0 ? white : coat));
  // pernas finas e cascos escuros
  for (const L of ['FL', 'FR', 'BL', 'BR']) {
    const u = W[I['up' + L]], l = W[I['lo' + L]], p = W[I['paw' + L]]; const fr = L[0] === 'F'; const x = u[0];
    mb.weightFn = legW(I, L, l[1]); mb.flex = FUR;
    const thigh = fr ? 0.075 : 0.1;
    tube(mb, [{ c: [x * 0.9, u[1] + 0.1, u[2] + (fr ? 0.02 : 0)], rx: thigh, ry: thigh * 1.3 }, { c: [x, (u[1] + l[1]) / 2, u[2] + (fr ? 0 : -0.04)], rx: 0.05, ry: 0.06 }, { c: [x, l[1], l[2] + (fr ? 0 : -0.05)], rx: 0.035, ry: 0.04 },
      { c: [x, (l[1] + p[1]) / 2 + 0.04, l[2] + (fr ? 0 : -0.02)], rx: 0.026, ry: 0.03 }, { c: [x, p[1] + 0.06, p[2] + 0.01], rx: 0.024, ry: 0.026 }], 6, (q) => (q[1] < p[1] + 0.3 && !fr ? coatD : coat), [false, false]);
    mb.weightFn = null; mb.setBone(I['paw' + L]); mb.flex = 0.7; tube(mb, [{ c: [x, p[1] + 0.06, p[2] + 0.01], rx: 0.026, ry: 0.028 }, { c: [x, p[1] + 0.005, p[2] + 0.025], rx: 0.03, ry: 0.034 }], 6, () => hoof);
  }
  return facetize(mb.build(), 11, 0.06);
}

export function buildBoarMesh(sk) {
  const mb = new MeshBuilder({ skinned: true }); const W = rest(sk), I = sk.index; const r = rng(91);
  const coat = hex(0x6b4a3c), coatL = hex(0x7d5848), coatD = hex(0x4e362c), mane = hex(0x2a1e18), hoof = hex(0x1d1714), tusk = hex(0xe6dccb), snout = hex(0x4a3028);
  mb.flex = FUR; const zP = W[0][2], zC = W[2][2];
  // tronco atarracado com cernelha alta
  mb.weightFn = bodyW(I, zP, zC);
  tube(mb, [{ c: [0, 0.62, -0.66], rx: 0.09, ry: 0.1 }, { c: [0, 0.65, -0.56], rx: 0.21, ry: 0.22 }, { c: [0, 0.67, -0.32], rx: 0.26, ry: 0.28 }, { c: [0, 0.7, -0.02], rx: 0.28, ry: 0.32 },
    { c: [0, 0.74, 0.24], rx: 0.28, ry: 0.36 }, { c: [0, 0.74, 0.42], rx: 0.25, ry: 0.33 }, { c: [0, 0.71, 0.54], rx: 0.21, ry: 0.27 }], 10,
    (p, rr, cs, sn) => shade(sn > 0.5 ? coatD : sn < -0.5 ? coatL : coat, 0.94 + r() * 0.12));
  // cabeça em cunha: testa larga → focinho
  mb.weightFn = (p) => { const t = clamp((p[2] - 0.5) / 0.2, 0, 1); return { j: [I.neck, I.head], w: [1 - t, t] }; };
  tube(mb, [{ c: [0, 0.71, 0.52], rx: 0.2, ry: 0.25 }, { c: [0, 0.69, 0.66], rx: 0.17, ry: 0.2 }, { c: [0, 0.62, 0.8], rx: 0.11, ry: 0.13 }, { c: [0, 0.57, 0.9], rx: 0.075, ry: 0.085 }, { c: [0, 0.56, 0.96], rx: 0.07, ry: 0.075 }], 9,
    (p, rr, cs, sn) => shade(sn > 0.4 ? coatD : coat, 0.95 + r() * 0.1), [false, false]);
  mb.weightFn = null; mb.setBone(I.head);
  mb.setColor(snout, 0.7); mb.cylinder(M(0, 0.56, 0.955, 0, 1, Math.PI / 2), 0.072, 0.07, 0.035, 9, snout); mb.setColor(hex(0x140e0c), 0.7); for (const s of [-1, 1]) mb.box(M(s * 0.025, 0.565, 0.993), 0.018, 0.026, 0.01, hex(0x140e0c));
  for (const s of [-1, 1]) {
    // presas curvas para cima e para fora
    mb.flex = 0.55; tube(mb, [{ c: [s * 0.075, 0.54, 0.88], rx: 0.02, ry: 0.024 }, { c: [s * 0.11, 0.57, 0.92], rx: 0.016, ry: 0.018 }, { c: [s * 0.135, 0.62, 0.93], rx: 0.01, ry: 0.012 }, { c: [s * 0.14, 0.67, 0.91], rx: 0.003, ry: 0.003 }], 5, () => tusk, [true, false]);
    // olhos e sobrancelha
    mb.setColor(hex(0x0c0908), 0.3); mb.box(M(s * 0.115, 0.71, 0.73, s * 0.4), 0.012, 0.022, 0.03, hex(0x0c0908)); mb.setColor(coatD, FUR); mb.box(M(s * 0.11, 0.74, 0.73, s * 0.4, 1, 0, s * 0.3), 0.03, 0.02, 0.06, coatD);
    // orelhas pontudas
    mb.flex = FUR; tube(mb, [{ c: [s * 0.1, 0.84, 0.6], rx: 0.045, ry: 0.02 }, { c: [s * 0.14, 0.92, 0.58], rx: 0.03, ry: 0.014 }, { c: [s * 0.16, 0.99, 0.56], rx: 0.004, ry: 0.004 }], 5, (p, rr, cs) => (cs > 0.3 ? hex(0x8a6252) : coatD), [true, false]);
  }
  // crina de espinhos escuros da testa até o meio do dorso
  mb.flex = FUR;
  for (let k = 0; k < 26; k++) { const t = k / 25; const z = 0.66 - t * 0.85; const env = Math.sin(Math.min(1, t * 1.4) * Math.PI) * 0.85 + 0.15; const yb = z > 0.45 ? 0.86 - (z - 0.45) * 0.6 : z > 0 ? 1.02 + (0.45 - z) * 0.1 - 0.0 : 0.99 + z * 0.4;
    mb.weightFn = z > 0.5 ? null : bodyW(I, zP, zC); if (z > 0.5) mb.setBone(I.head);
    for (const s of [-1, 0, 1]) { if (s && r() < 0.35) continue; const h = (0.12 + r() * 0.1) * env; const lean = -0.5 - r() * 0.3;
      tube(mb, [{ c: [s * 0.04, yb - 0.02, z], rx: 0.035, ry: 0.03 }, { c: [s * 0.06 + (r() - 0.5) * 0.03, yb + h, z + Math.sin(lean) * h], rx: 0.003, ry: 0.003 }], 4, () => shade(mane, 0.85 + r() * 0.3), [false, false]); } }
  // cauda fina com tufo
  mb.weightFn = null; mb.setBone(I.tail); tube(mb, [{ c: [0, 0.66, -0.64], rx: 0.025, ry: 0.025 }, { c: [0, 0.6, -0.74], rx: 0.015, ry: 0.015 }, { c: [0, 0.52, -0.8], rx: 0.012, ry: 0.012 }], 5, () => coat, [false, false]);
  tube(mb, [{ c: [0, 0.53, -0.8], rx: 0.03, ry: 0.02 }, { c: [0, 0.45, -0.84], rx: 0.004, ry: 0.004 }], 5, () => mane, [false, false]);
  // pernas curtas e fortes, cascos escuros
  for (const L of ['FL', 'FR', 'BL', 'BR']) {
    const u = W[I['up' + L]], l = W[I['lo' + L]], p = W[I['paw' + L]]; const fr = L[0] === 'F'; const x = u[0] * 1.05;
    mb.weightFn = legW(I, L, l[1]); mb.flex = FUR;
    tube(mb, [{ c: [x * 0.85, u[1] + 0.12, u[2]], rx: fr ? 0.1 : 0.12, ry: 0.14 }, { c: [x, (u[1] + l[1]) / 2, u[2] - (fr ? 0 : 0.03)], rx: 0.065, ry: 0.075 }, { c: [x, l[1], l[2] - (fr ? 0 : 0.04)], rx: 0.045, ry: 0.05 },
      { c: [x, p[1] + 0.06, p[2]], rx: 0.035, ry: 0.038 }], 7, (q) => (q[1] < l[1] + 0.02 ? coatD : coat), [false, false]);
    mb.weightFn = null; mb.setBone(I['paw' + L]); mb.flex = 0.7; tube(mb, [{ c: [x, p[1] + 0.06, p[2]], rx: 0.036, ry: 0.038 }, { c: [x, p[1] + 0.005, p[2] + 0.03], rx: 0.042, ry: 0.045 }], 6, () => hoof);
  }
  return facetize(mb.build(), 23, 0.07);
}

// ---------- Vaca (low-poly, estilo da referência): tronco retangular, manchas, focinho rosa, chifres bege, úbere ----------
export const makeCowSkeleton = () => quadSkel({ pelvis: [0, 1.05, -0.5], spine: [0, 0.02, 0.48], chest: [0, 0, 0.46], neck: [0, 0.04, 0.22], head: [0, 0.02, 0.26], tail: [0, 0.14, -0.2],
  fx: 0.2, fy: -0.2, fl1: 0.4, fl2: 0.42, bx: 0.2, by: -0.14, bl1: 0.44, bl2: 0.44 });
export const COW_COATS = [
  { base: 0xf2f0ea, spot: 0x1c1c1e }, // holandesa preta e branca
  { base: 0xf2ece2, spot: 0x7a3e1c }, // malhada marrom
  { base: 0x2a2624, spot: 0xe8e4dc }, // preta com manchas brancas
  { base: 0xc8935a, spot: 0xf0e8da }, // caramelo
];
export function buildCowMesh(sk, coat = COW_COATS[0]) {
  const mb = new MeshBuilder({ skinned: true }); const W = rest(sk), I = sk.index;
  const B = hex(coat.base), Sp = hex(coat.spot), PINK = hex(0xf0a0a8), PINKd = hex(0xd0707c), HORN = hex(0xe6d6b0), HOOF = hex(0x3a3330), EYE = hex(0x111111);
  const spots = (p) => { const n = Math.sin(p[0] * 7.1 + p[2] * 3.3) + Math.sin(p[2] * 5.7 - p[1] * 4.1 + 1.3) + Math.sin(p[0] * 3.9 + p[1] * 6.2 + p[2] * 2.1 + 2.7); return n > 0.9 ? Sp : B; };
  const zP = W[0][2], zC = W[2][2]; mb.flex = FUR;
  // tronco: caixa larga, poucos segmentos (facetado)
  mb.weightFn = bodyW(I, zP, zC);
  tube(mb, [{ c: [0, 1.08, -0.78], rx: 0.2, ry: 0.22 }, { c: [0, 1.06, -0.7], rx: 0.33, ry: 0.32 }, { c: [0, 1.04, -0.4], rx: 0.37, ry: 0.36 }, { c: [0, 1.0, 0.0], rx: 0.38, ry: 0.38 },
    { c: [0, 1.02, 0.32], rx: 0.37, ry: 0.37 }, { c: [0, 1.06, 0.5], rx: 0.32, ry: 0.34 }, { c: [0, 1.08, 0.6], rx: 0.22, ry: 0.26 }], 6, (p) => spots(p));
  // pescoço e cabeça
  mb.weightFn = (p) => { const t = clamp((p[2] - 0.6) / 0.25, 0, 1); return { j: [I.neck, I.head], w: [1 - t, t] }; };
  tube(mb, [{ c: [0, 1.1, 0.55], rx: 0.2, ry: 0.24 }, { c: [0, 1.16, 0.72], rx: 0.17, ry: 0.2 }, { c: [0, 1.18, 0.84], rx: 0.17, ry: 0.18 }], 6, (p) => spots(p), [false, false]);
  mb.weightFn = null; mb.setBone(I.head); const hy = 1.14, hz = 0.95;
  mb.setColor(B, FUR); mb.roundBox(M(0, hy + 0.04, hz), 0.28, 0.26, 0.26, B, 0.04, 1);
  mb.setColor(Sp, FUR); for (const s of [-1, 1]) mb.box(M(s * 0.1, hy + 0.08, hz + 0.02), 0.1, 0.16, 0.2, Sp); // manchas ao redor dos olhos
  mb.setColor(B, FUR); mb.roundBox(M(0, hy - 0.06, hz + 0.16), 0.24, 0.2, 0.18, B, 0.03, 1);
  mb.setColor(PINK, 0.86); mb.roundBox(M(0, hy - 0.1, hz + 0.27), 0.26, 0.15, 0.08, PINK, 0.03, 1); mb.setColor(PINKd, 0.86); for (const s of [-1, 1]) mb.box(M(s * 0.06, hy - 0.08, hz + 0.31), 0.04, 0.035, 0.01, PINKd);
  mb.setColor(EYE, 0.3); for (const s of [-1, 1]) mb.box(M(s * 0.142, hy + 0.08, hz + 0.08), 0.01, 0.04, 0.04, EYE);
  for (const s of [-1, 1]) { mb.setColor(Sp, FUR); mb.box(M(s * 0.2, hy + 0.08, hz - 0.06, 0, 1, 0, s * -0.4), 0.14, 0.05, 0.08, Sp); mb.setColor(PINK, FUR); mb.box(M(s * 0.2, hy + 0.08, hz - 0.035, 0, 1, 0, s * -0.4), 0.11, 0.03, 0.02, PINK); // orelhas
    mb.setColor(HORN, 0.55); tube(mb, [{ c: [s * 0.1, hy + 0.16, hz - 0.06], rx: 0.03, ry: 0.03 }, { c: [s * 0.17, hy + 0.2, hz - 0.06], rx: 0.022, ry: 0.022 }, { c: [s * 0.21, hy + 0.27, hz - 0.03], rx: 0.004, ry: 0.004 }], 5, () => HORN, [true, false]); }
  mb.setColor(Sp, FUR); mb.box(M(0, hy + 0.17, hz - 0.03), 0.12, 0.04, 0.1, Sp); // topete
  // úbere e tetas
  mb.setBone(I.pelvis); mb.setColor(PINK, 0.86); mb.roundBox(M(0, 0.68, -0.42), 0.24, 0.14, 0.26, PINK, 0.05, 1);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) mb.cylinder(M(sx * 0.06, 0.58, -0.42 + sz * 0.07), 0.02, 0.016, 0.06, 5, PINKd);
  // cauda com tufo
  mb.setBone(I.tail); mb.setColor(B, FUR); { const t = W[I.tail]; tube(mb, [{ c: [0, t[1], t[2] - 0.02], rx: 0.03, ry: 0.03 }, { c: [0, t[1] - 0.3, t[2] - 0.08], rx: 0.02, ry: 0.02 }, { c: [0, t[1] - 0.55, t[2] - 0.08], rx: 0.018, ry: 0.018 }], 5, () => B, [false, false]);
    tube(mb, [{ c: [0, t[1] - 0.52, t[2] - 0.08], rx: 0.045, ry: 0.045 }, { c: [0, t[1] - 0.7, t[2] - 0.08], rx: 0.01, ry: 0.01 }], 5, () => Sp, [false, true]); }
  // pernas retas com cascos
  for (const L of ['FL', 'FR', 'BL', 'BR']) { const u = W[I['up' + L]], l = W[I['lo' + L]], p = W[I['paw' + L]]; const x = u[0] * 1.05;
    mb.weightFn = legW(I, L, l[1]); mb.flex = FUR;
    tube(mb, [{ c: [x * 0.9, u[1] + 0.12, u[2]], rx: 0.12, ry: 0.15 }, { c: [x, l[1], l[2]], rx: 0.075, ry: 0.08 }, { c: [x, p[1] + 0.08, p[2]], rx: 0.06, ry: 0.065 }], 6, (q) => spots([q[0] * 2, q[1], q[2] + 3]), [false, false]);
    mb.weightFn = null; mb.setBone(I['paw' + L]); mb.setColor(HOOF, 0.7); mb.roundBox(M(x, p[1] + 0.04, p[2] + 0.01), 0.13, 0.09, 0.14, HOOF, 0.02, 1); }
  return facetize(mb.build(), 57, 0.05);
}

// ---------- Galinha e galo (rig de ave, andam no chão) ----------
const GB = (name, parent, pos) => ({ name, parent, pos });
export function makeChickenSkeleton() {
  return new Skeleton([GB('body', -1, [0, 0.3, 0]), GB('neck', 0, [0, 0.08, 0.1]), GB('head', 1, [0, 0.1, 0.03]), GB('tail', 0, [0, 0.06, -0.14]),
    GB('wL1', 0, [0.1, 0.03, 0]), GB('wL2', 4, [0.02, 0, -0.08]), GB('wR1', 0, [-0.1, 0.03, 0]), GB('wR2', 6, [-0.02, 0, -0.08]), GB('legL', 0, [0.05, -0.06, 0.01]), GB('legR', 0, [-0.05, -0.06, 0.01])]);
}
export function buildChickenMesh(sk, rooster = false) {
  const mb = new MeshBuilder({ skinned: true }); const W = rest(sk), I = sk.index;
  const body = hex(rooster ? 0xe84a14 : 0xa8642e), bodyL = hex(rooster ? 0xf08a2a : 0xc4814a), neckC = hex(rooster ? 0xffa21e : 0xb87440), belly = hex(rooster ? 0x1e1e22 : 0x8a5226),
    tailC = hex(rooster ? 0x1a4a4e : 0x6a3a1c), tailL = hex(rooster ? 0x2a6a6a : 0x7c4a26), RED = hex(0xe0201a), BEAK = hex(0xf0b030), LEG = hex(0xf0b030), EYE = hex(0x111111);
  mb.flex = FUR; mb.setBone(I.body);
  tube(mb, [{ c: [0, 0.36, -0.13], rx: 0.06, ry: 0.07 }, { c: [0, 0.32, -0.08], rx: 0.11, ry: 0.11 }, { c: [0, 0.3, 0.02], rx: 0.12, ry: 0.12 }, { c: [0, 0.33, 0.1], rx: 0.1, ry: 0.11 }, { c: [0, 0.37, 0.13], rx: 0.07, ry: 0.08 }], 6,
    (p, rr, cs, sn) => (sn < -0.4 ? belly : cs > 0.5 || cs < -0.5 ? bodyL : body));
  // asas dobradas
  for (const s of [-1, 1]) { mb.setBone(I[s > 0 ? 'wL1' : 'wR1']); mb.setColor(bodyL, FUR); mb.roundBox(M(s * 0.115, 0.32, -0.01, 0.15), 0.035, 0.1, 0.16, bodyL, 0.02, 1); mb.setColor(rooster ? tailC : body, FUR); mb.box(M(s * 0.12, 0.28, -0.08, 0.3), 0.03, 0.06, 0.08, rooster ? tailC : body); }
  // cauda (galo: penas longas curvas em leque, verde-azuladas)
  mb.setBone(I.tail); const nT = rooster ? 7 : 4;
  for (let k = 0; k < nT; k++) { const a = (k / (nT - 1) - 0.5) * (rooster ? 0.9 : 0.6); const len = rooster ? 0.26 + Math.sin((k / (nT - 1)) * Math.PI) * 0.1 : 0.12; const c = k % 2 ? tailL : tailC;
    tube(mb, [{ c: [Math.sin(a) * 0.03, 0.38, -0.12], rx: 0.03, ry: 0.012 }, { c: [Math.sin(a) * 0.08, 0.38 + len * 0.7, -0.12 - len * 0.45], rx: 0.03, ry: 0.01 }, { c: [Math.sin(a) * 0.1, 0.38 + len * 0.6, -0.12 - len * 0.85], rx: 0.005, ry: 0.005 }], 4, () => c, [false, false]); }
  // pescoço (galo: penas alaranjadas)
  mb.setBone(I.neck); tube(mb, [{ c: [0, 0.36, 0.1], rx: 0.075, ry: 0.07 }, { c: [0, 0.44, 0.13], rx: 0.06, ry: 0.06 }, { c: [0, 0.5, 0.135], rx: 0.05, ry: 0.05 }], 6, () => neckC, [false, false]);
  // cabeça, bico, crista e barbela
  mb.setBone(I.head); const h = W[I.head];
  mb.setColor(neckC, FUR); mb.roundBox(M(0, h[1], h[2] + 0.01), 0.075, 0.07, 0.08, neckC, 0.02, 1);
  mb.setColor(BEAK, 0.55); mb.cylinder(M(0, h[1] - 0.005, h[2] + 0.06, 0, 1, Math.PI / 2), 0.016, 0.002, 0.05, 4, BEAK);
  mb.setColor(EYE, 0.3); for (const s of [-1, 1]) mb.box(M(s * 0.038, h[1] + 0.01, h[2] + 0.02), 0.006, 0.014, 0.014, EYE);
  mb.setColor(RED, 0.86); const cn = rooster ? 4 : 2, ch = rooster ? 0.05 : 0.025;
  for (let k = 0; k < cn; k++) mb.box(M(0, h[1] + 0.04 + ch * 0.4, h[2] + 0.035 - k * 0.022), 0.012, ch * (k === 1 ? 1.1 : 0.8), 0.024, RED);
  mb.box(M(0, h[1] - 0.04, h[2] + 0.04), 0.01, rooster ? 0.04 : 0.02, 0.022, RED); for (const s of [-1, 1]) mb.box(M(s * 0.035, h[1] - 0.005, h[2] + 0.0), 0.005, 0.02, 0.018, RED);
  // pernas finas amarelas com dedos
  for (const [s, bn] of [[1, 'legL'], [-1, 'legR']]) { mb.setBone(I[bn]); mb.setColor(LEG, 0.7); const x = s * 0.05;
    mb.setColor(body, FUR); mb.roundBox(M(x, 0.2, 0.0), 0.06, 0.07, 0.07, body, 0.02, 1); mb.setColor(LEG, 0.7);
    mb.cylinder(M(x, 0.08, 0.01), 0.011, 0.011, 0.17, 5, LEG); for (const a of [-0.5, 0, 0.5]) mb.box(M(x + Math.sin(a) * 0.025, 0.006, 0.01 + Math.cos(a) * 0.025, a), 0.008, 0.008, 0.05, LEG); mb.box(M(x, 0.006, -0.015), 0.008, 0.008, 0.03, LEG); }
  return facetize(mb.build(), rooster ? 61 : 63, 0.06);
}
import { bakeClip } from '../engine/skeleton.js';
export function buildChickenClips(sk) {
  const C = {}; const mk = (n, d, fn, o) => (C[n] = bakeClip(sk, n, d, fn, o)); const T = Math.PI * 2;
  const peck = (ph) => { const p = Math.max(0, Math.sin(ph * T * 3)); return p * p; };
  mk('idle', 2.4, (ph) => { const b = Math.sin(ph * T); return { root: [0, 0.003 * b, 0], bones: { neck: [0.1 * b, 0.4 * Math.sin(ph * T * 2), 0], head: [-0.1 * b, 0.3 * Math.sin(ph * T * 3 + 1), 0], tail: [0.05 * b, 0, 0] } }; });
  mk('graze', 1.6, (ph) => { const p = peck(ph); return { bones: { body: [0.35, 0, 0], neck: [0.9 * p + 0.2, 0, 0], head: [0.4 * p, 0, 0], legL: [-0.35, 0, 0], legR: [-0.35, 0, 0], tail: [-0.2, 0, 0] } }; });
  const gait = (ph, a, bob) => { const s = Math.sin(ph * T); const hb = Math.sin(ph * T * 2);
    return { root: [0, bob * Math.abs(Math.cos(ph * T)), 0], bones: { legL: [a * s, 0, 0], legR: [-a * s, 0, 0], body: [0.1, 0, 0.06 * s], neck: [0.25 * hb, 0, 0], head: [-0.25 * hb, 0, 0], wL1: [0, 0, 0.1 * Math.max(0, hb)], wR1: [0, 0, -0.1 * Math.max(0, hb)] } }; };
  mk('walk', 0.6, (ph) => gait(ph, 0.6, 0.012));
  mk('run', 0.32, (ph) => { const p = gait(ph, 0.9, 0.03); const f = Math.sin(ph * T * 2); p.bones.body[0] = 0.35; p.bones.wL1 = [0, 0, 0.5 + 0.5 * f]; p.bones.wR1 = [0, 0, -0.5 - 0.5 * f]; return p; });
  mk('attack', 0.6, (ph) => { const p = Math.sin(Math.min(1, ph * 1.6) * Math.PI); return { root: [0, 0.05 * p, 0.05 * p], bones: { body: [0.3 * p, 0, 0], neck: [1.0 * p, 0, 0], head: [0.4 * p, 0, 0], wL1: [0, 0, 0.8 * p], wR1: [0, 0, -0.8 * p] } }; }, { loop: false });
  mk('hit', 0.35, (ph) => { const d = Math.sin(ph * Math.PI); return { root: [0, 0.06 * d, 0], bones: { body: [-0.3 * d, 0, 0.3 * d], wL1: [0, 0, 0.9 * d], wR1: [0, 0, -0.9 * d] } }; }, { loop: false });
  mk('die', 0.9, (ph) => { const d = Math.min(1, ph * 1.3); return { root: [0, -0.17 * d, 0], bones: { body: [0, 0, 1.5 * d], neck: [0.6 * d, 0, 0.4 * d], head: [0.4 * d, 0, 0], legL: [-0.6 * d, 0, 0], legR: [0.4 * d, 0, 0], wL1: [0, 0, 0.6 * d] } }; }, { loop: false });
  return C;
}
