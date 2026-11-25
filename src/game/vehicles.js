// Veículos restauráveis: picape, sedã, hatch (RET), SUV e moto. No mapa ficam sem pneus e sem motor (a moto é só o chassi);
// o jogador monta no local (E → menu do veículo, arrastando peças), abastece com o galão e dirige.
import { MeshBuilder, M, hex, shade } from '../engine/mesh.js';
import { mat4, quat, clamp, damp, angleDiff } from '../engine/math.js';
import { ITEMS } from './items.js';
import { WATER } from './world.js';

export const VCOLORS = [0x2a90d8, 0x4caf3a, 0xf0b820, 0xe0302a];
export const VCOLOR_NAMES = ['azul', 'verde', 'amarela', 'vermelha'];
export const VTYPES = {
  pickup: { name: 'Picape', L: 5.2, W: 1.86, wr: 0.4, clear: 0.42, belt: 1.14, roof: 1.86, cab: [-1.0, 1.0], hood: [1.05, 2.5], bed: [-2.5, -1.05], wf: 1.7, wb: -1.62, max: 24, acc: 6.5, tank: 65, km: 380, wheels: 4, tire: 'tire', engine: 'engine' },
  sedan: { name: 'Sedã', L: 4.4, W: 1.76, wr: 0.34, clear: 0.32, belt: 0.98, roof: 1.44, cab: [-1.3, 0.68], hood: [0.72, 2.14], trunk: true, wf: 1.38, wb: -1.34, max: 27, acc: 7.5, tank: 45, km: 430, wheels: 4, tire: 'tire', engine: 'engine' },
  hatch: { name: 'Hatch', L: 3.95, W: 1.72, wr: 0.33, clear: 0.32, belt: 0.98, roof: 1.5, cab: [-1.8, 0.56], hood: [0.62, 1.92], wf: 1.24, wb: -1.24, max: 26, acc: 7.8, tank: 40, km: 460, wheels: 4, tire: 'tire', engine: 'engine' },
  suv: { name: 'SUV', L: 4.6, W: 1.88, wr: 0.4, clear: 0.42, belt: 1.14, roof: 1.88, cab: [-2.22, 0.56], hood: [0.62, 2.24], rack: true, wf: 1.45, wb: -1.45, max: 24, acc: 6.8, tank: 60, km: 360, wheels: 4, tire: 'tire', engine: 'engine' },
  moto: { name: 'Moto', L: 2.1, W: 0.7, wr: 0.31, clear: 0.3, wf: 0.72, wb: -0.72, max: 30, acc: 9, tank: 12, km: 700, wheels: 2, tire: 'mototire', engine: 'motoengine', moto: true },
};
export const vName = (v) => `${VTYPES[v.type].name} ${VCOLOR_NAMES[v.color] || ''}`.trim();
const ST = 0.93, MT = 0.5, RB = 0.7, FB = 0.83, PL = 0.86;

// ---------------- malhas ----------------
function boxB(mb, x, y0, z, sx, sy, sz, c, f = PL) { mb.setColor(c, f); mb.box(M(x, y0 + sy / 2, z), sx, sy, sz, c); }
// carroceria sem capô (o capô é desenhado à parte: só aparece com o motor instalado)
export function carBodyMesh(type, colorIdx) {
  const T = VTYPES[type], mb = new MeshBuilder(); const C = hex(VCOLORS[colorIdx] || VCOLORS[0]), Cd = shade(C, 0.82), DK = hex(0x2c2e32), BK = hex(0x18191b), GL = hex(0x1c2630), LT = hex(0xf2f0e6), RD = hex(0xc02018), GY = hex(0x6a6e74);
  const { L, W, clear: c0, belt, roof, cab } = T; const hw = W / 2, hl = L / 2; const B = (x, y0, z, sx, sy, sz, c, f) => boxB(mb, x, y0, z, sx, sy, sz, c, f);
  // assoalho, saias e para-choques escuros
  B(0, c0, 0, W - 0.12, 0.14, L - 0.3, BK, RB);
  for (const s of [-1, 1]) B(s * (hw - 0.02), c0 + 0.08, 0, 0.06, 0.18, L - 0.9, DK, RB);
  B(0, c0 + 0.02, hl - 0.08, W + 0.04, 0.26, 0.22, DK, RB); B(0, c0 + 0.02, -hl + 0.08, W + 0.04, 0.26, 0.22, DK, RB);
  // laterais e pontas na cor do carro
  for (const s of [-1, 1]) { B(s * (hw - 0.05), c0 + 0.24, 0, 0.08, belt - c0 - 0.24, L - 0.32, C);
    // vincos de porta e maçanetas
    const doors = type === 'pickup' ? [cab[0] + 0.05, (cab[0] + cab[1]) / 2, cab[1] + 0.1] : [cab[0] + (type === 'hatch' ? 0.55 : 0.2), (cab[0] + cab[1]) / 2 - 0.1, cab[1] + 0.12];
    for (const z of doors) B(s * (hw - 0.005), c0 + 0.3, z, 0.012, belt - c0 - 0.34, 0.015, Cd);
    for (const z of [doors[0] + 0.35, doors[1] + 0.35]) B(s * (hw + 0.005), belt - 0.22, z, 0.02, 0.04, 0.14, DK, MT);
    // para-lamas escuros (alargadores) sobre as rodas + disco de freio (aparece sem roda)
    for (const z of [T.wf, T.wb]) { B(s * (hw + 0.01), c0 + T.wr * 0.95, z, 0.06, 0.12, T.wr * 2 + 0.3, DK, RB); for (const dz of [-1, 1]) B(s * (hw + 0.01), c0 + 0.05, z + dz * (T.wr + 0.12), 0.06, T.wr * 0.95, 0.08, DK, RB);
      B(s * (hw - 0.2), T.wr - 0.14, z, 0.06, 0.28, 0.28, GY, MT); B(s * (hw - 0.28), c0 + 0.05, z, 0.12, T.wr * 0.9, T.wr * 1.6, BK, RB); }
    // retrovisor
    B(s * (hw + 0.1), belt + 0.04, cab[1] - 0.4, 0.14, 0.12, 0.08, C); }
  // frente: grade, faróis; traseira: lanternas
  B(0, c0 + 0.24, hl - 0.1, W - 0.1, belt - c0 - 0.26, 0.16, C); B(0, c0 + 0.32, hl - 0.005, W * 0.46, 0.24, 0.02, BK, MT);
  for (let k = 0; k < 3; k++) B(0, c0 + 0.36 + k * 0.07, hl + 0.005, W * 0.42, 0.02, 0.01, GY, MT);
  for (const s of [-1, 1]) { B(s * (hw - 0.28), c0 + 0.38, hl, 0.36, 0.16, 0.03, LT, MT); B(s * (hw - 0.12), c0 + 0.3, hl + 0.01, 0.1, 0.06, 0.02, hex(0xf0a020), MT);
    B(s * (hw - 0.2), c0 + 0.42, -hl + 0.005, 0.26, 0.14, 0.03, RD, MT); }
  B(0, c0 + 0.24, -hl + 0.1, W - 0.1, belt - c0 - 0.26, 0.16, C);
  // cofre do motor (escuro) e parede corta-fogo
  B(0, c0 + 0.14, (T.hood[0] + hl - 0.2) / 2, W - 0.26, belt - c0 - 0.3, hl - 0.2 - T.hood[0], hex(0x141516), RB);
  B(0, c0 + 0.14, T.hood[0] - 0.02, W - 0.2, belt - c0 - 0.1, 0.06, BK, RB);
  // corpo sob a cabine (fechado) e porta-malas / caçamba
  const zr0 = T.bed ? T.bed[1] + 0.05 : -hl + 0.2; B(0, c0 + 0.14, (zr0 + T.hood[0]) / 2, W - 0.2, belt - c0 - 0.14, T.hood[0] - zr0, C);
  if (T.bed) { B(0, c0 + 0.14, (T.bed[0] + T.bed[1]) / 2, W - 0.2, 0.3, T.bed[1] - T.bed[0], BK, RB); for (const s of [-1, 1]) B(s * (hw - 0.12), c0 + 0.44, (T.bed[0] + T.bed[1]) / 2, 0.06, belt - c0 - 0.44, T.bed[1] - T.bed[0], DK, RB); B(0, belt - 0.03, T.bed[0] + 0.05, W - 0.08, 0.05, 0.12, C); for (const s of [-1, 1]) B(s * (hw - 0.04), belt - 0.03, (T.bed[0] + T.bed[1]) / 2, 0.1, 0.05, T.bed[1] - T.bed[0], C); }
  else B(0, belt - 0.06, (cab[0] - hl) / 2 + 0.1, W - 0.1, 0.06, -hl - cab[0] + 0.2, C);
  // cabine na cor do carro com vidros escuros: para-brisa e vidro traseiro inclinados, janelas laterais com colunas
  const zf = cab[1], zb = cab[0], rk = 0.55, cw = W - 0.16, rb = type === 'sedan' ? 0.5 : 0.12, h = roof - belt;
  B(0, belt, (zb + rb + zf - rk) / 2, cw, h, zf - rk - zb - rb, C); // bloco central
  const slab = (z0, z1, front) => { const run = Math.abs(z1 - z0), len = Math.hypot(run, h), ang = Math.atan2(h, run) * (front ? 1 : -1); const zc = (z0 + z1) / 2;
    mb.setColor(C, PL); mb.box(M(0, belt + h / 2, zc, 0, 1, ang), cw, 0.06, len, C); mb.setColor(GL, MT); mb.box(M(0, belt + h / 2, zc, 0, 1, ang), cw - 0.22, 0.075, len - 0.18, GL);
    // preenche o triângulo abaixo do vidro (lateral da cabine)
    mb.setColor(C, PL); for (const sd of [-1, 1]) { const x = sd * cw / 2, zl = front ? Math.max(z0, z1) : Math.min(z0, z1), zh = front ? Math.min(z0, z1) : Math.max(z0, z1); const a0 = mb.vert([x, belt, zl], [sd, 0, 0], C), a1 = mb.vert([x, belt, zh], [sd, 0, 0], C), a2 = mb.vert([x, roof, zh], [sd, 0, 0], C);
      const b0 = mb.vert([x, belt, zl], [-sd, 0, 0], C), b1 = mb.vert([x, belt, zh], [-sd, 0, 0], C), b2 = mb.vert([x, roof, zh], [-sd, 0, 0], C); mb.tri(a0, a1, a2); mb.tri(b0, b2, b1); } };
  slab(zf + 0.02, zf - rk, true); if (type === 'sedan') slab(zb, zb + rb, false); else { B(0, belt + 0.1, zb + 0.03, cw - 0.24, h - 0.22, 0.04, GL, MT); }
  B(0, roof - 0.05, (zb + rb * 0.6 + zf - rk * 0.6) / 2, cw - 0.02, 0.06, zf - rk * 0.6 - zb - rb * 0.6, C); // teto
  // janelas laterais (escuras) separadas pelas colunas
  const wz0 = zb + rb + 0.1, wz1 = zf - rk - 0.04; const cols = type === 'pickup' ? [(wz0 + wz1) / 2] : type === 'sedan' ? [(wz0 + wz1) / 2 + 0.1] : [(wz0 + wz1) / 2 + 0.15, wz0 + 0.45];
  for (const sd of [-1, 1]) { const x = sd * (cw / 2 + 0.006); B(x, belt + 0.07, (wz0 + wz1) / 2, 0.02, h - 0.2, wz1 - wz0, GL, MT); for (const z of cols) B(x + sd * 0.004, belt + 0.05, z, 0.02, h - 0.14, 0.1, C); B(x, belt - 0.01, (zb + zf) / 2, 0.03, 0.05, zf - zb, Cd); }
  if (T.rack) { for (const s of [-1, 1]) { B(s * (cw / 2 - 0.12), roof + 0.02, (zb + zf) / 2, 0.05, 0.06, zf - zb - 0.6, BK, MT); for (const z of [zb + 0.4, zf - 0.6]) B(s * (cw / 2 - 0.12), roof, z, 0.05, 0.04, 0.05, BK, MT); }
    for (const z of [zb + 0.6, (zb + zf) / 2, zf - 0.8]) B(0, roof + 0.05, z, cw - 0.2, 0.03, 0.04, BK, MT); }
  return mb.build();
}
export function carHoodMesh(type, colorIdx) { const T = VTYPES[type], mb = new MeshBuilder(); const C = hex(VCOLORS[colorIdx] || VCOLORS[0]); const z0 = T.hood[0], z1 = T.L / 2 - 0.05;
  mb.setColor(C, PL); mb.box(M(0, T.belt - 0.03, (z0 + z1) / 2, 0, 1, 0.04), T.W - 0.08, 0.06, z1 - z0, C); mb.setColor(shade(C, 0.82), PL); mb.box(M(0, T.belt + 0.005, (z0 + z1) / 2, 0, 1, 0.04), 0.4, 0.015, z1 - z0 - 0.2, shade(C, 0.82)); return mb.build(); }
export function wheelMesh(r = 0.35, w = 0.24) { const mb = new MeshBuilder(); const RZ = Math.PI / 2; const t = hex(0x1c1c1e), rim = hex(0x8a8e94), hub = hex(0x4a4e54);
  mb.setColor(t, RB); mb.cylinder(M(-w / 2, 0, 0, 0, 1, 0, -RZ), r, r, w, 14, t); mb.setColor(rim, MT); mb.cylinder(M(-w / 2 - 0.004, 0, 0, 0, 1, 0, -RZ), r * 0.62, r * 0.62, w + 0.008, 10, rim);
  mb.setColor(hub, MT); mb.cylinder(M(-w / 2 - 0.01, 0, 0, 0, 1, 0, -RZ), r * 0.2, r * 0.2, w + 0.02, 8, hub); for (let k = 0; k < 5; k++) { const a = k * 1.2566; mb.box(M(w / 2 + 0.002, Math.sin(a) * r * 0.36, Math.cos(a) * r * 0.36, 0, 1, a), 0.012, r * 0.4, 0.06, hub); mb.box(M(-w / 2 - 0.002, Math.sin(a) * r * 0.36, Math.cos(a) * r * 0.36, 0, 1, a), 0.012, r * 0.4, 0.06, hub); }
  return mb.build(); }
// moto: chassi (quadro, garfo, tanque, carenagens, banco) — rodas e motor à parte
export function motoBodyMesh(colorIdx) { const mb = new MeshBuilder(); const C = hex(VCOLORS[colorIdx] || VCOLORS[3]), FR = hex(0x3a3c40), BK = hex(0x1c1d20), SL = hex(0xc8ccd0);
  const tube = (a, b, r, c, f = MT) => { const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]; const L = Math.hypot(...d); const ry = Math.atan2(d[0], d[2]), rx = -Math.asin(d[1] / L); mb.setColor(c, f); mb.box(mat4.mul(mat4.create(), M((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2, ry, 1, rx), M(0, 0, 0)), r * 2, r * 2, L, c); };
  // quadro em treliça
  const head = [0, 1.0, 0.52], piv = [0, 0.46, -0.22];
  for (const s of [-1, 1]) { tube([s * 0.05, 1.0, 0.5], [s * 0.12, 0.88, 0.0], 0.03, FR); tube([s * 0.12, 0.88, 0.0], [s * 0.1, 0.5, -0.2], 0.035, FR); tube([s * 0.12, 0.88, 0.0], [s * 0.1, 0.9, -0.75], 0.025, FR); tube([s * 0.1, 0.5, -0.2], [s * 0.1, 0.9, -0.62], 0.022, FR);
    tube([s * 0.05, 0.95, 0.48], [s * 0.1, 0.42, 0.1], 0.03, FR); tube([s * 0.1, 0.42, 0.1], [s * 0.1, 0.4, -0.2], 0.03, FR);
    // braço oscilante até o eixo traseiro e garfo dianteiro até o eixo da frente
    tube([s * 0.12, 0.46, -0.22], [s * 0.12, 0.31, -0.72], 0.035, FR); tube([s * 0.09, 1.08, 0.56], [s * 0.09, 0.31, 0.74], 0.03, SL); tube([s * 0.09, 0.98, 0.585], [s * 0.09, 0.6, 0.68], 0.042, FR); }
  void head; void piv;
  // tanque e carenagens laterais (cor), farol (prata), para-lama dianteiro
  mb.setColor(C, PL); mb.roundBox(M(0, 0.98, 0.2), 0.34, 0.24, 0.5, C, 0.06, 1); mb.roundBox(M(0, 0.74, 0.32, 0, 1, -0.4), 0.3, 0.26, 0.14, C, 0.03, 1);
  for (const s of [-1, 1]) { mb.setColor(C, PL); mb.roundBox(M(s * 0.16, 0.88, 0.32, 0, 1, 0.3), 0.04, 0.24, 0.36, C, 0.02, 1); mb.roundBox(M(s * 0.14, 0.88, -0.6, 0, 1, -0.35), 0.06, 0.12, 0.5, C, 0.02, 1); }
  mb.setColor(C, PL); mb.roundBox(M(0, 1.14, 0.62, 0, 1, 0.5), 0.24, 0.28, 0.1, C, 0.03, 1); mb.setColor(SL, MT); mb.roundBox(M(0, 1.12, 0.67, 0, 1, 0.5), 0.17, 0.17, 0.04, SL, 0.02, 1); mb.setColor(BK, MT); mb.box(M(0, 1.3, 0.6, 0, 1, 0.4), 0.18, 0.1, 0.03, BK);
  mb.setColor(C, PL); mb.roundBox(M(0, 0.68, 0.82, 0, 1, -0.3), 0.14, 0.04, 0.42, C, 0.02, 1);
  // banco preto, rabeta, alça e para-lama traseiro
  mb.setColor(BK, FB); mb.roundBox(M(0, 0.96, -0.32, 0, 1, -0.05), 0.26, 0.08, 0.62, BK, 0.03, 1); mb.setColor(C, PL); mb.roundBox(M(0, 0.98, -0.78, 0, 1, -0.25), 0.2, 0.08, 0.3, C, 0.02, 1);
  for (const s of [-1, 1]) tube([s * 0.13, 1.02, -0.6], [s * 0.13, 1.06, -0.9], 0.015, FR); tube([-0.13, 1.06, -0.9], [0.13, 1.06, -0.9], 0.015, FR); mb.setColor(BK, RB); mb.box(M(0, 0.7, -1.0, 0, 1, 0.6), 0.12, 0.02, 0.3, BK);
  // guidão e manoplas
  tube([-0.36, 1.2, 0.5], [0.36, 1.2, 0.5], 0.016, SL); for (const s of [-1, 1]) tube([s * 0.3, 1.2, 0.5], [s * 0.4, 1.2, 0.5], 0.024, BK, RB);
  return mb.build(); }
export function motoEngineMesh() { const mb = new MeshBuilder(); const D = hex(0x3a3c40), F = hex(0x6a6e74), SL = hex(0xb8bcc0); mb.setColor(D, MT); mb.roundBox(M(0, 0.48, 0.08), 0.26, 0.3, 0.38, D, 0.03, 1);
  mb.setColor(F, MT); for (let k = 0; k < 5; k++) mb.box(M(0, 0.68 + k * 0.035, 0.18, 0, 1, -0.3), 0.3, 0.012, 0.2, F); mb.setColor(SL, MT); mb.cylinder(M(0.12, 0.42, -0.1, 0, 1, Math.PI / 2 + 0.15), 0.035, 0.035, 0.85, 8, SL); mb.cylinder(M(0.14, 0.52, -0.92, 0, 1, Math.PI / 2 + 0.25), 0.055, 0.045, 0.3, 8, SL); return mb.build(); }
export function jerrycanMesh() { const mb = new MeshBuilder(); const R = hex(0xb02218); mb.setColor(R, PL); mb.roundBox(M(0, -0.22, 0), 0.32, 0.42, 0.14, R, 0.02, 1); mb.setColor(shade(R, 0.8), PL); mb.box(M(0, -0.22, 0.075), 0.2, 0.3, 0.01, shade(R, 0.8)); mb.box(M(0, -0.22, -0.075), 0.2, 0.3, 0.01, shade(R, 0.8));
  mb.setColor(hex(0x2a2a2a), MT); mb.box(M(0, 0.02, 0), 0.16, 0.04, 0.05, hex(0x2a2a2a)); mb.cylinder(M(0.12, -0.02, 0, 0, 1, 0, -0.5), 0.025, 0.025, 0.1, 8, hex(0x3a3a3a)); return mb.build(); }
// posto de combustível (frente +Z para a estrada): cobertura com colunas, 2 bombas, lojinha e placa
export function gasStationMesh() { const mb = new MeshBuilder(); const W = hex(0xeeeeec), R = hex(0xd02a20), G = hex(0x8a8e92), DK = hex(0x22252a), GL = hex(0x1c2630), Y = hex(0xf0c020); const B = (x, y0, z, sx, sy, sz, c, f) => boxB(mb, x, y0, z, sx, sy, sz, c, f);
  B(0, -0.4, 1, 13, 0.5, 11, hex(0x9a988f), ST); // pátio de concreto
  for (const [x, z] of [[-4.5, 3.5], [4.5, 3.5], [-4.5, -1.5], [4.5, -1.5]]) { B(x, 0.1, z, 0.35, 4.6, 0.35, W); B(x, 0.1, z, 0.45, 0.4, 0.45, R); }
  B(0, 4.7, 1, 11.5, 0.6, 7.5, W); B(0, 4.6, 1, 11.6, 0.25, 7.6, R); B(0, 5.3, 1, 11.4, 0.08, 7.4, G, MT);
  for (const z of [1]) for (const x of [-2, 2]) { B(x, 0.1, z, 1.3, 0.3, 2.6, hex(0xd8d4ca), ST); B(x, 0.4, z, 0.7, 1.6, 0.45, R); B(x, 1.4, z + 0.235, 0.5, 0.35, 0.02, DK, MT); B(x, 1.48, z + 0.245, 0.4, 0.12, 0.01, hex(0x5ad05a), MT); B(x + 0.28, 0.9, z + 0.2, 0.06, 0.4, 0.06, DK, RB); B(x, 2.0, z, 0.72, 0.18, 0.47, W); }
  // lojinha
  B(0, 0.1, -6.5, 8, 3.4, 5, W); B(0, 3.5, -6.5, 8.3, 0.3, 5.3, R); B(0, 0.1, -3.99, 2.2, 2.4, 0.04, GL, MT); for (const x of [-2.6, 2.6]) B(x, 0.9, -3.99, 1.8, 1.4, 0.04, GL, MT); B(0, 2.65, -3.97, 3.6, 0.6, 0.04, Y, PL);
  // placa alta com preços
  B(5.8, 0, 5.6, 0.3, 6.5, 0.3, G, MT); B(5.8, 6.4, 5.6, 1.8, 2.2, 0.3, R); B(5.8, 7.9, 5.75, 1.4, 0.4, 0.02, W); for (let k = 0; k < 3; k++) B(5.8, 6.7 + k * 0.4, 5.76, 1.2, 0.28, 0.02, DK, MT);
  return mb.build(); }
export const GAS_PUMPS = [[-2, 1.45], [2, 1.45]]; // pontos locais das bombas (lado da frente)
export function gasStationColliders(p) { const c = Math.cos(p.rot), s = Math.sin(p.rot); const L = (lx, lz) => [p.x + lx * c + lz * s, p.z - lx * s + lz * c]; const out = [];
  const box = (lx, lz, hx, hz, h) => { const [x, z] = L(lx, lz); out.push({ type: 'box', x, z, hx, hz, rot: p.rot, y0: p.y - 0.5, y1: p.y + h }); };
  for (const [x, z] of [[-4.5, 3.5], [4.5, 3.5], [-4.5, -1.5], [4.5, -1.5]]) box(x, z, 0.2, 0.2, 4.7); for (const x of [-2, 2]) box(x, 1, 0.36, 0.25, 2.2); box(0, -6.5, 4, 2.5, 3.8); box(5.8, 5.6, 0.2, 0.2, 7); return out; }

// ---------------- sistema ----------------
export class VehicleSystem {
  constructor(game) { this.g = game; this.list = []; this.driving = null; this.meshes = {}; this.pumps = []; }
  // estado inicial a partir dos pontos do mundo (carros sem pneus e motor; moto só o chassi)
  reset() { const w = this.g.world; this._clearCols(); this.list = (w.vehicleSpots || []).map((s) => this._make(s));
    this.pumps = (w.pumps || []).map((p) => ({ ...p, fuel: 60 + Math.floor(Math.random() * 240) })); this._addCols(); }
  _make(s) { const T = VTYPES[s.type]; return { id: s.id, type: s.type, color: s.color, x: s.x, y: s.y, z: s.z, yaw: s.yaw, pitch: 0, roll: 0, wheels: 0, engine: false, gear: !T.moto, fuel: Math.round(T.tank * (Math.random() < 0.6 ? Math.random() * 0.35 : 0)), speed: 0, steer: 0, spin: 0, siph: false }; }
  serialize() { return { v: this.list.map((v) => [v.id, +v.x.toFixed(2), +v.y.toFixed(2), +v.z.toFixed(2), +v.yaw.toFixed(3), v.wheels, v.engine ? 1 : 0, v.gear ? 1 : 0, +v.fuel.toFixed(1)]), p: this.pumps.map((p) => +p.fuel.toFixed(1)) }; }
  load(st) { this.reset(); if (!st) return; const byId = new Map(this.list.map((v) => [v.id, v]));
    for (const [id, x, y, z, yaw, wh, en, ge, fu] of st.v || []) { const v = byId.get(id); if (!v) continue; Object.assign(v, { x, y, z, yaw, wheels: wh, engine: !!en, gear: !!ge, fuel: fu }); }
    (st.p || []).forEach((f, i) => { if (this.pumps[i]) this.pumps[i].fuel = f; }); this._clearCols(); this._addCols(); }
  complete(v) { const T = VTYPES[v.type]; return v.wheels >= T.wheels && v.engine && v.gear; }
  missing(v) { const T = VTYPES[v.type]; const m = []; if (v.wheels < T.wheels) m.push(`${T.wheels - v.wheels} ${T.moto ? 'pneu(s) de moto' : 'pneu(s)'}`); if (!v.engine) m.push(T.moto ? 'motor de moto' : 'motor'); if (!v.gear) m.push('câmbio'); return m; }
  _col(v) { const T = VTYPES[v.type]; return { type: 'box', x: v.x, z: v.z, hx: T.W / 2 + 0.02, hz: T.L / 2, rot: v.yaw, cos: Math.cos(v.yaw), sin: Math.sin(v.yaw), y0: v.y - 0.3, y1: v.y + (T.roof || 1.2), dyn: true, r: T.L / 2 + 0.3, vehicle: v }; }
  _addCols() { const ph = this.g.physics; for (const v of this.list) { v.col = this._col(v); ph.dynamic.push(v.col); } }
  _clearCols() { const ph = this.g.physics; if (!ph) return; ph.dynamic = ph.dynamic.filter((c) => !c.vehicle); }
  _syncCol(v) { if (!v.col) return; Object.assign(v.col, { x: v.x, z: v.z, rot: v.yaw, cos: Math.cos(v.yaw), sin: Math.sin(v.yaw), y0: v.y - 0.3, y1: v.y + (VTYPES[v.type].roof || 1.2) }); }
  near(p, maxD = 3.6) { let best = null, bd = maxD; for (const v of this.list) { const T = VTYPES[v.type]; const dx = p[0] - v.x, dz = p[2] - v.z; const f = [Math.sin(v.yaw), Math.cos(v.yaw)];
      const lz = dx * f[0] + dz * f[1], lx = dx * f[1] - dz * f[0]; const ex = Math.max(0, Math.abs(lx) - T.W / 2), ez = Math.max(0, Math.abs(lz) - T.L / 2); const d = Math.hypot(ex, ez); if (d < bd && Math.abs(p[1] - v.y) < 2.5) { bd = d; best = v; } } return best; }
  nearPump(p) { for (const q of this.pumps) if (Math.hypot(q.x - p[0], q.z - p[2]) < 2.0 && Math.abs(q.y - p[1]) < 2) return q; return null; }
  // ---------- galão ----------
  jerryCap() { return 20 * this.g.countAll('jerrycan'); }
  // ---------- direção ----------
  enter(v) { const g = this.g, P = g.player, T = VTYPES[v.type]; if (!this.complete(v)) return g.ui.toast(`Faltam peças: ${this.missing(v).join(', ')}`, 'warn');
    if (v.fuel <= 0.05) return g.ui.toast('⛽ Sem combustível — abasteça com o galão (segure o galão e aperte E perto do veículo)', 'warn');
    this.driving = v; v.speed = 0; g.equip.hand = null; P.seat = { v, clip: T.moto ? 'ride' : 'sit', hidden: !T.moto }; g.audio.engineStart(); g.audio.play('engineStart', { at: [v.x, v.y, v.z] });
    g.cam.yaw = v.yaw; this._camDist = g.cam.targetDist; g.cam.targetDist = T.moto ? 5.5 : 7.5; g.ui.toast(`🚗 ${vName(v)} — W/S acelera e freia, A/D vira, Espaço freio de mão, E para sair`, 'info'); }
  exit() { const g = this.g, P = g.player, v = this.driving; if (!v) return; const T = VTYPES[v.type]; this.driving = null; P.seat = null; g.audio.engineStop(); g.cam.targetDist = this._camDist || 4.2;
    const r = [Math.cos(v.yaw), -Math.sin(v.yaw)]; for (const side of [-1, 1, 2]) { const off = side === 2 ? [Math.sin(v.yaw) * -(T.L / 2 + 1), Math.cos(v.yaw) * -(T.L / 2 + 1)] : [r[0] * side * (T.W / 2 + 0.9), r[1] * side * (T.W / 2 + 0.9)];
      const x = v.x + off[0], z = v.z + off[1]; const blocked = g.physics.query(x, z, 0.5).some((c) => !c.dyn && !c.ghost && !c.camOnly && c.y1 > v.y + 0.4 && g.physics.insideXZ(c, x, z, 0.35)); if (!blocked || side === 2) { P.setPosition(x, g.world.height(x, z), z); break; } }
    P.vel = [0, 0, 0]; v.speed = 0; this._syncCol(v); }
  update(dt, act) { const v = this.driving; if (!v) return; const g = this.g, w = g.world, ph = g.physics, T = VTYPES[v.type], inp = g.input;
    if (act.interact) return this.exit();
    let thr = act.mz || 0; if (v.fuel <= 0) { thr = 0; if (!this._noFuelTip) { this._noFuelTip = true; g.ui.toast('⛽ Acabou o combustível!', 'warn'); } } else this._noFuelTip = false;
    const hand = inp.down('Space');
    if (thr > 0) v.speed = Math.min(T.max, v.speed + T.acc * thr * dt * (v.speed < 0 ? 2.2 : 1));
    else if (thr < 0) v.speed = v.speed > 0.4 ? Math.max(0, v.speed - 16 * dt) : Math.max(-6, v.speed - 4 * dt);
    v.speed -= Math.sign(v.speed) * Math.min(Math.abs(v.speed), (0.6 + Math.abs(v.speed) * 0.04 + (hand ? 18 : 0) + (thr === 0 ? 1.4 : 0)) * dt);
    // direção (A/D); vira menos em alta velocidade
    const want = -(act.mx || 0) * (T.moto ? 0.55 : 0.6) * (1 - Math.min(0.6, Math.abs(v.speed) / 45)); v.steer = damp(v.steer, want, 7, dt);
    const wb = T.wf - T.wb; v.yaw += v.speed * Math.tan(v.steer) / wb * dt;
    // movimento com subpassos e colisão (dois círculos: frente e traseira)
    v.col.ghost = true; const P = g.player; const mv = v.speed * dt, n = Math.max(1, Math.ceil(Math.abs(mv) / 0.2)); let bump = 0;
    for (let k = 0; k < n; k++) { const f = [Math.sin(v.yaw), Math.cos(v.yaw)]; v.x += f[0] * mv / n; v.z += f[1] * mv / n; let dx = 0, dz = 0;
      for (const o of T.moto ? [0.55, -0.55] : [T.L * 0.3, 0, -T.L * 0.3]) { const pt = [v.x + f[0] * o, v.y + 0.3, v.z + f[1] * o]; const b = [pt[0], pt[2]]; ph.resolve(pt, T.W / 2 + 0.05, 1.2, 0.55); dx += pt[0] - b[0]; dz += pt[2] - b[1]; }
      if (dx || dz) { v.x += dx; v.z += dz; bump = Math.max(bump, Math.hypot(dx, dz)); } }
    v.col.ghost = false;
    if (bump > 0.03) { if (Math.abs(v.speed) > 7) { g.audio.play('metalHit', { at: [v.x, v.y + 0.5, v.z] }); g.cam.shake = Math.min(0.8, Math.abs(v.speed) / 30); if (Math.abs(v.speed) > 14) g.damage(Math.abs(v.speed) * 0.6, 'acidente de carro'); } v.speed *= -0.25; }
    // chão: altura das 4 rodas → inclinação e rolagem
    const f = [Math.sin(v.yaw), Math.cos(v.yaw)], rr = [Math.cos(v.yaw), -Math.sin(v.yaw)]; const gy = (x, z) => ph.ground(x, z, 0.3, v.y + 0.7, 0.9)[0];
    const hf = gy(v.x + f[0] * T.wf, v.z + f[1] * T.wf), hb = gy(v.x + f[0] * T.wb, v.z + f[1] * T.wb); let hl = hf, hr = hb;
    if (!T.moto) { hl = gy(v.x - rr[0] * T.W / 2, v.z - rr[1] * T.W / 2); hr = gy(v.x + rr[0] * T.W / 2, v.z + rr[1] * T.W / 2); }
    const ty = (hf + hb) / 2; v.y = v.y > ty + 0.05 ? Math.max(ty, v.y - 9 * dt) : ty; v.pitch = damp(v.pitch, -Math.atan2(hf - hb, wb), 10, dt);
    v.roll = T.moto ? damp(v.roll, -v.steer * Math.min(1, Math.abs(v.speed) / 12) * 0.9, 5, dt) : damp(v.roll, Math.atan2(hr - hl, T.W), 10, dt);
    if (w.height(v.x, v.z) < WATER - 0.7) { v.speed *= 0.6; if (!this._waterTip) { this._waterTip = true; g.ui.toast('🌊 Água demais — o veículo atolou', 'warn'); } } else this._waterTip = false;
    // atropelar criaturas
    for (const c of g.creatures.list) { if (c.dead || Math.abs(v.speed) < 4) continue; const d = Math.hypot(c.pos[0] - v.x, c.pos[2] - v.z); if (d < T.L / 2 + c.def.radius * c.def.scale && Math.abs(c.pos[1] - v.y) < 2) { if ((c._runT || 0) > g.env.elapsed) continue; c._runT = g.env.elapsed + 0.8;
        g.creatures.damage(c, Math.abs(v.speed) * (c.def.heavyArmor ? 0 : 6), v.yaw); v.speed *= c.def.scale > 1.5 ? 0.2 : 0.75; g.audio.play('metalHit', { at: c.pos }); } }
    v.fuel = Math.max(0, v.fuel - Math.abs(v.speed) * dt / T.km - (thr ? 0.004 * dt : 0.0015 * dt)); v.spin += v.speed * dt / T.wr; this._syncCol(v);
    // o motorista acompanha o banco; câmera segue atrás quando o mouse fica parado
    const seat = T.moto ? -0.25 : 0; P.pos = [v.x + f[0] * seat, v.y + (T.moto ? 0.0 : 0.05), v.z + f[1] * seat]; P.yaw = v.yaw; P.vel = [0, 0, 0];
    if (Math.abs(inp.mouse.dx) > 1) this._camHold = 1.5; this._camHold = (this._camHold || 0) - dt; if (this._camHold <= 0 && Math.abs(v.speed) > 1) g.cam.yaw += angleDiff(g.cam.yaw, v.yaw + (v.speed < 0 ? Math.PI : 0)) * Math.min(1, dt * 2.2);
    g.audio.engineSet(Math.abs(v.speed) / T.max, thr !== 0 ? 1 : 0.3); g.ui.driveHud && g.ui.driveHud(v, T); }
  // ---------- desenho ----------
  _mesh(key, fn) { if (!this.meshes[key]) this.meshes[key] = this.g.renderer.createMesh(fn()); return this.meshes[key]; }
  render(items, eye) { for (const v of this.list) { if (Math.abs(v.x - eye[0]) > 160 || Math.abs(v.z - eye[2]) > 160) continue; const T = VTYPES[v.type];
      const sink = v.wheels < T.wheels && !T.moto ? -0.18 : 0; const m = mat4.compose([v.x, v.y + sink, v.z], v.yaw, 1, v.pitch, v.roll); const sph = [v.x, v.y + 1, v.z, T.L / 2 + 0.6];
      if (T.moto) { items.push({ mesh: this._mesh('moto' + v.color, () => motoBodyMesh(v.color)), model: m, sphere: sph }); if (v.engine) items.push({ mesh: this._mesh('motoeng', motoEngineMesh), model: m, sphere: sph }); }
      else { items.push({ mesh: this._mesh(v.type + v.color, () => carBodyMesh(v.type, v.color)), model: m, sphere: sph }); if (v.engine) items.push({ mesh: this._mesh('hood' + v.type + v.color, () => carHoodMesh(v.type, v.color)), model: m, sphere: sph }); }
      const wm = this._mesh('wheel' + T.wr, () => wheelMesh(T.wr, T.moto ? 0.12 : 0.24)); const pos = T.moto ? [[0, T.wf], [0, T.wb]] : [[T.W / 2 - 0.12, T.wf], [-(T.W / 2 - 0.12), T.wf], [T.W / 2 - 0.12, T.wb], [-(T.W / 2 - 0.12), T.wb]];
      for (let i = 0; i < Math.min(v.wheels, pos.length); i++) { const [x, z] = pos[i]; const steerA = z > 0 ? v.steer : 0; const loc = mat4.fromTRS(mat4.create(), [x, T.wr - sink, z], quat.fromEuler(x < 0 ? -v.spin : v.spin, steerA + (x < 0 ? Math.PI : 0), 0), [1, 1, 1]);
        items.push({ mesh: wm, model: mat4.mul(mat4.create(), m, loc), sphere: sph }); } }
    // galão na mão durante o abastecimento/enchimento já vem do sistema de ferramentas
  }
}
export function partIsFor(id, v) { const T = VTYPES[v.type]; return id === T.tire ? 'wheels' : id === T.engine ? 'engine' : id === 'gearbox' ? 'gear' : null; }
export { ITEMS };
