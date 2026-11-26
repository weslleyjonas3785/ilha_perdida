// Personagem principal no estilo da arte de referência, em tamanho adulto: visual low-poly facetado, cabelo castanho em mechas espetadas, olhos grandes e sobrancelhas marcadas,
// jaqueta escura aberta com capuz sobre camiseta cinza clara, braços robóticos com luzes azuis,
// calça cargo escura e tênis robustos de sola clara.
import { MeshBuilder, M, hex, shade } from '../engine/mesh.js';
import { quat, mat4, rng } from '../engine/math.js';
import { Skeleton } from '../engine/skeleton.js';
import { facetize } from './fauna.js';

export const LOOK_DEFAULT = { name: 'Sobrevivente', hair: 0x3b2417, hairStyle: 'espetado', jacket: 0x34353b, shirt: 0xb4b4b8, pants: 0x29292e, shoes: 0x2a2a2e };
export const HAIR_STYLES = { espetado: 'Espetado', curto: 'Curto', longo: 'Longo', moicano: 'Moicano' };
const SKIN = 0.76, FAB = 0.83, MET = 0.5, RUB = 0.7, GLOW = 0.02;
const B = (name, parent, pos) => ({ name, parent, pos });

// esqueleto adulto (~1,80 m) com os mesmos ossos do humano (as animações servem)
export function makeChibiSkeleton() {
  return new Skeleton([
    B('hips', -1, [0, 0.98, 0]), B('spine', 0, [0, 0.12, 0]), B('chest', 1, [0, 0.2, 0]), B('neck', 2, [0, 0.2, 0]), B('head', 3, [0, 0.07, 0]),
    B('shoulderL', 2, [0.08, 0.15, 0]), B('upperArmL', 5, [0.145, 0, 0]), B('foreArmL', 6, [0, -0.28, 0]), B('handL', 7, [0, -0.25, 0]),
    B('shoulderR', 2, [-0.08, 0.15, 0]), B('upperArmR', 9, [-0.145, 0, 0]), B('foreArmR', 10, [0, -0.28, 0]), B('handR', 11, [0, -0.25, 0]),
    B('thighL', 0, [0.1, -0.04, 0]), B('shinL', 13, [0, -0.44, 0]), B('footL', 14, [0, -0.43, 0]),
    B('thighR', 0, [-0.1, -0.04, 0]), B('shinR', 16, [0, -0.44, 0]), B('footR', 17, [0, -0.43, 0]),
  ]);
}
const alignTo = (from, dir) => { const l = Math.hypot(...dir) || 1; const n = dir.map((v) => v / l); const q = n[1] < -0.9999 ? [1, 0, 0, 0] : quat.normalize([n[2], 0, -n[0], 1 + n[1]]); return mat4.fromTRS(mat4.create(), from, q, [1, 1, 1]); };

// Mesmo visual da arte (low-poly facetado, cabelo espetado, jaqueta aberta, braços robóticos azuis, cargo e tênis),
// em proporções de adulto.
export function buildChibiMesh(skel, look = {}) {
  const L = { ...LOOK_DEFAULT, ...look }; const I = skel.index; const r = rng(7);
  const mb = new MeshBuilder({ skinned: true });
  const skin = hex(0xe2ae88), skinD = hex(0xc98e6c), hair = hex(L.hair), hairD = shade(hair, 0.72), jacket = hex(L.jacket), jacketD = shade(jacket, 0.7), jacketL = shade(jacket, 1.25);
  const shirt = hex(L.shirt), shirtD = shade(shirt, 0.82), pants = hex(L.pants), pantsD = shade(pants, 0.72), shoe = hex(L.shoes), sole = hex(0xc4c4c6), metal = hex(0x4a4d55), metalD = hex(0x26282d), metalL = hex(0x7a7e88), blue = hex(0x2aa8ff), blueD = hex(0x1d4a6e), eyeC = hex(0x1c1410), white = hex(0xf2f2f2), belt = hex(0x1a1a1c), buckle = hex(0x9ea0a6);
  const S = (c, f) => mb.setColor(c, f);
  const spike = (base, dir, len, rad, c, seg = 4) => { S(c, FAB); mb.cylinder(alignTo(base, dir), rad, 0.002, len, seg, c); };
  if (L.suit === 'ratsuit') { ratBody(mb, I); return finish(mb, I); }
  if (L.pack) packMesh(mb, I, L.pack);
  if (L.vestCol) { mb.setBone(I.chest); const vc = hex(L.vestCol); S(vc, L.vestMetal ? MET : FAB); mb.roundBox(M(0, 1.33, 0.01), 0.45, 0.3, 0.27, vc, 0.06, 1); S(shade(vc, 0.75), FAB); for (const sx of [-1, 1]) mb.box(M(sx * 0.11, 1.3, 0.143), 0.13, 0.14, 0.02, shade(vc, 0.75)); for (const sx of [-1, 1]) mb.box(M(sx * 0.12, 1.47, 0), 0.07, 0.03, 0.3, shade(vc, 0.8)); }
  if (L.hatKind === 'nvg') { mb.setBone(I.head); const hy2 = 1.69, bk = hex(0x26272b), bkL = hex(0x3a3c42), gr = hex(0x3cff50);
    S(bk, RUB); mb.roundBox(M(0, hy2 + 0.035, -0.005), 0.225, 0.04, 0.245, bk, 0.015, 1); mb.box(M(0, hy2 + 0.115, -0.01), 0.04, 0.02, 0.22, bk); // tiras
    S(bkL, MET); mb.roundBox(M(0, hy2 + 0.03, 0.15), 0.17, 0.08, 0.07, bkL, 0.015, 1); mb.box(M(0, hy2 + 0.085, 0.14), 0.05, 0.035, 0.05, bk);
    for (const sd of [-1, 1]) { S(bk, MET); mb.cylinder(M(sd * 0.048, hy2 + 0.02, 0.2, 0, 1, Math.PI / 2), 0.033, 0.03, 0.06, 8, bk); S(gr, L.nvgLit ? GLOW : FAB); mb.cylinder(M(sd * 0.048, hy2 + 0.02, 0.232, 0, 1, Math.PI / 2), 0.024, 0.024, 0.006, 8, L.nvgLit ? gr : hex(0x1c3a20)); }
    S(gr, L.nvgCell ? GLOW : FAB); mb.box(M(0, hy2 + 0.068, 0.186), 0.04, 0.01, 0.005, L.nvgCell ? gr : hex(0x1c2a1e)); }
  else if (L.hatKind) { mb.setBone(I.head); const hy2 = 1.69; if (L.hatKind === 'helmet') { const hc = hex(0x4a5432); S(hc, MET); mb.roundBox(M(0, hy2 + 0.1, -0.005), 0.25, 0.14, 0.26, hc, 0.07, 2); mb.box(M(0, hy2 + 0.04, 0.0), 0.27, 0.03, 0.28, shade(hc, 0.8)); } else { const st = hex(0xd8c078); S(st, FAB); mb.cylinder(M(0, hy2 + 0.09), 0.25, 0.25, 0.02, 14, st); mb.cylinder(M(0, hy2 + 0.1), 0.12, 0.1, 0.1, 12, st); S(hex(0x8a3020), FAB); mb.cylinder(M(0, hy2 + 0.115), 0.122, 0.122, 0.025, 12, hex(0x8a3020)); } }

  // ---------- quadril e cinto ----------
  mb.setBone(I.hips);
  S(pants, FAB); mb.roundBox(M(0, 0.93, 0), 0.34, 0.16, 0.21, pants, 0.05);
  S(belt, RUB); mb.box(M(0, 1.005, 0), 0.35, 0.04, 0.215, belt); S(buckle, MET); mb.box(M(0, 1.005, 0.109), 0.055, 0.035, 0.008, buckle);
  // ---------- tronco: jaqueta aberta com capuz, camiseta clara em V ----------
  mb.setBone(I.spine);
  S(jacket, FAB); mb.roundBox(M(0, 1.15, 0), 0.36, 0.26, 0.22, jacket, 0.06);
  for (const sd of [-1, 1]) { mb.roundBox(M(sd * 0.13, 1.04, 0.01), 0.12, 0.09, 0.23, jacket, 0.03); S(jacketD, FAB); mb.box(M(sd * 0.12, 1.1, 0.113), 0.07, 0.014, 0.012, jacketD); S(jacket, FAB); }
  mb.setBone(I.chest);
  S(jacket, FAB); mb.roundBox(M(0, 1.37, 0), 0.42, 0.26, 0.235, jacket, 0.07);
  S(shirt, FAB); mb.box(M(0, 1.26, 0.113), 0.14, 0.42, 0.012, shirt); S(shirtD, FAB); mb.box(M(0, 1.455, 0.115), 0.08, 0.05, 0.01, shirtD);
  S(skin, SKIN); mb.box(M(0, 1.46, 0.118), 0.05, 0.04, 0.008, skin);
  for (const sd of [-1, 1]) { S(jacketL, FAB); mb.box(M(sd * 0.084, 1.32, 0.121, 0, 1, 0, sd * 0.05), 0.04, 0.32, 0.02, jacketL);
    S(jacketD, FAB); mb.box(M(sd * 0.075, 1.475, 0.08, 0, 1, -0.4, sd * 0.4), 0.06, 0.06, 0.035, jacketD); }
  S(jacketD, FAB); mb.roundBox(M(0, 1.47, -0.11), 0.27, 0.11, 0.1, jacketD, 0.04); mb.roundBox(M(0, 1.41, -0.14), 0.2, 0.09, 0.045, jacket, 0.02); // capuz caído
  // ---------- pescoço e cabeça ----------
  mb.setBone(I.neck); S(skinD, SKIN); mb.cylinder(M(0, 1.47), 0.05, 0.052, 0.13, 8, skinD);
  mb.setBone(I.head);
  const hy = 1.69;
  S(skin, SKIN); mb.roundBox(M(0, hy, 0.01), 0.2, 0.22, 0.22, skin, 0.06, 2);
  mb.roundBox(M(0, hy - 0.085, 0.035), 0.15, 0.08, 0.16, skin, 0.04, 2); // queixo e mandíbula
  for (const sd of [-1, 1]) mb.roundBox(M(sd * 0.102, hy - 0.01, 0.0), 0.022, 0.05, 0.04, skinD, 0.01, 1);
  const fz = 0.121;
  for (const sd of [-1, 1]) { const ex = sd * 0.043;
    S(white, SKIN); mb.box(M(ex, hy + 0.005, fz), 0.046, 0.04, 0.005, white);
    S(eyeC, SKIN); mb.box(M(ex - sd * 0.003, hy + 0.001, fz + 0.003), 0.03, 0.038, 0.005, eyeC);
    S(white, SKIN); mb.box(M(ex - sd * 0.008 + 0.004, hy + 0.012, fz + 0.006), 0.008, 0.008, 0.003, white);
    S(hairD, FAB); mb.box(M(ex + sd * 0.003, hy + 0.04, fz + 0.004, 0, 1, 0, -sd * 0.2), 0.055, 0.016, 0.012, hairD); }
  S(skinD, SKIN); mb.box(M(0, hy - 0.03, fz + 0.008), 0.018, 0.035, 0.016, skinD);
  S(shade(skinD, 0.75), SKIN); mb.box(M(0, hy - 0.075, fz - 0.002), 0.035, 0.008, 0.008, shade(skinD, 0.75));
  // cabelo em blocos espetados com franja
  const st = L.hairStyle; const big = st === 'curto' ? 0.55 : 1;
  if (st !== 'moicano') { S(hair, FAB); mb.roundBox(M(0, hy + 0.07, -0.02), 0.225, 0.13, 0.235, hair, 0.05, 2); mb.roundBox(M(0, hy + 0.005, -0.065), 0.215, 0.15, 0.12, hair, 0.04, 2);
    for (const sd of [-1, 1]) mb.roundBox(M(sd * 0.1, hy + 0.035, 0.03), 0.026, 0.08, 0.1, hair, 0.012, 1); }
  else { S(hair, FAB); mb.roundBox(M(0, hy + 0.1, -0.02), 0.07, 0.09, 0.22, hair, 0.03, 2); }
  if (st === 'espetado' || st === 'curto') for (let i = 0; i < 26; i++) { const a = r() * Math.PI * 2, el = 0.15 + r() * 1.25; const dx = Math.cos(a) * Math.cos(el), dz = Math.sin(a) * Math.cos(el) - 0.25, dy = Math.sin(el);
    if (dz > 0.35 && dy < 0.6) continue; const base = [dx * 0.075, hy + 0.08 + dy * 0.04, -0.02 + dz * 0.075];
    spike(base, [dx * 0.8, dy + 0.35, dz * 0.8 - 0.35], (0.05 + r() * 0.05) * big, (0.03 + r() * 0.013) * (0.8 + big * 0.2), r() < 0.3 ? hairD : hair); }
  if (st === 'moicano') for (let i = 0; i < 7; i++) { const z = 0.08 - i * 0.028; spike([0, hy + 0.13 - Math.abs(z) * 0.2, z], [0, 1, -0.5], 0.07, 0.028, hair); }
  if (st === 'longo') { for (let i = 0; i < 9; i++) { const x = -0.1 + i * 0.025; spike([x, hy + 0.05, -0.08 - Math.abs(x) * 0.2], [x * 0.8, -1, -0.25], 0.15 + r() * 0.04, 0.034, i % 3 ? hair : hairD); }
    for (const sd of [-1, 1]) spike([sd * 0.095, hy + 0.05, 0.04], [sd * 0.25, -1, 0.1], 0.12, 0.028, hair); }
  if (st !== 'moicano') for (let i = 0; i < 6; i++) { const x = -0.075 + i * 0.03; spike([x, hy + 0.115, 0.075], [x * 1.4 + (r() - 0.5) * 0.4, -0.7, 1.0], (st === 'curto' ? 0.04 : 0.07) + r() * 0.02, 0.026, i % 2 ? hair : hairD); }
  // ---------- braços: manga curta da jaqueta + braço robótico com luzes azuis ----------
  for (const sd of ['L', 'R']) { const x = sd === 'L' ? 0.225 : -0.225, o = sd === 'L' ? 1 : -1;
    mb.setBone(I['shoulder' + sd]); S(jacket, FAB); mb.roundBox(M(x - o * 0.025, 1.44, 0), 0.14, 0.12, 0.15, jacket, 0.05);
    mb.setBone(I['upperArm' + sd]); S(jacket, FAB); mb.cylinder(M(x, 1.31), 0.064, 0.07, 0.13, 8, jacket); S(jacketD, FAB); mb.cylinder(M(x, 1.305), 0.066, 0.066, 0.014, 8, jacketD);
    if (L.humanArms) { // NPCs: braço humano com manga comprida e mão de pele (só o jogador tem braço robótico)
      S(jacket, FAB); mb.cylinder(M(x, 1.18), 0.058, 0.064, 0.14, 8, jacket); mb.setBone(I['foreArm' + sd]); mb.sphere(M(x, 1.17), 0.058, 8, 6, jacket); mb.cylinder(M(x, 0.95), 0.05, 0.057, 0.22, 8, jacket);
      S(jacketD, FAB); mb.cylinder(M(x, 0.945), 0.054, 0.054, 0.02, 8, jacketD); S(skinD, SKIN); mb.cylinder(M(x, 0.915), 0.038, 0.04, 0.035, 8, skinD);
      mb.setBone(I['hand' + sd]); S(skin, SKIN); mb.roundBox(M(x, 0.87, 0.005), 0.07, 0.07, 0.042, skin, 0.014);
      for (let f = 0; f < 4; f++) { const fx = x - 0.025 + f * 0.017; mb.box(M(fx, 0.815, 0.01), 0.014, 0.05, 0.015, skin); mb.box(M(fx, 0.783, 0.011), 0.013, 0.022, 0.014, skinD); }
      mb.box(M(x - o * 0.038, 0.86, 0.02, 0, 1, 0, o * 0.5), 0.016, 0.045, 0.016, skin); continue; }
    S(metal, MET); mb.cylinder(M(x, 1.18), 0.046, 0.052, 0.13, 8, metal); S(blueD, MET); mb.box(M(x + o * 0.048, 1.24, 0), 0.008, 0.07, 0.016, blueD);
    mb.setBone(I['foreArm' + sd]); S(metalD, MET); mb.sphere(M(x, 1.17), 0.054, 8, 6, metalD); S(blueD, MET); mb.cylinder(M(x, 1.162), 0.056, 0.056, 0.012, 10, blueD);
    S(metal, MET); mb.roundBox(M(x, 1.03, 0), 0.1, 0.22, 0.105, metal, 0.028); S(metalD, MET); mb.box(M(x, 1.08, 0.054), 0.075, 0.01, 0.006, metalD); mb.box(M(x, 0.99, 0.054), 0.075, 0.01, 0.006, metalD);
    S(blueD, MET); mb.box(M(x + o * 0.051, 1.03, 0), 0.006, 0.14, 0.022, blueD); mb.box(M(x, 1.05, -0.054), 0.03, 0.09, 0.004, blueD);
    S(metalL, MET); mb.cylinder(M(x, 0.915), 0.041, 0.041, 0.022, 8, metalL);
    mb.setBone(I['hand' + sd]); S(metalD, MET); mb.roundBox(M(x, 0.87, 0.005), 0.075, 0.075, 0.045, metalD, 0.012);
    for (let f = 0; f < 4; f++) { const fx = x - 0.027 + f * 0.018; mb.box(M(fx, 0.81, 0.01), 0.015, 0.055, 0.016, metal); mb.box(M(fx, 0.775, 0.012), 0.014, 0.024, 0.015, metalD); }
    mb.box(M(x - o * 0.04, 0.86, 0.02, 0, 1, 0, o * 0.5), 0.017, 0.05, 0.017, metal); }
  // ---------- pernas: calça cargo larga, bolsos, joelheira e tênis de sola clara ----------
  for (const sd of ['L', 'R']) { const x = sd === 'L' ? 0.1 : -0.1, o = sd === 'L' ? 1 : -1;
    mb.setBone(I['thigh' + sd]); S(pants, FAB); mb.cylinder(M(x, 0.5), 0.074, 0.09, 0.44, 8, pants);
    S(pantsD, FAB); mb.roundBox(M(x + o * 0.082, 0.7, 0.005), 0.035, 0.13, 0.11, pantsD, 0.012); mb.box(M(x + o * 0.098, 0.76, 0.005), 0.014, 0.026, 0.114, shade(pants, 0.55));
    mb.setBone(I['shin' + sd]); S(pantsD, FAB); mb.roundBox(M(x, 0.5, 0.012), 0.155, 0.09, 0.16, pantsD, 0.035); S(pants, FAB); mb.cylinder(M(x, 0.1), 0.066, 0.074, 0.4, 8, pants);
    S(pantsD, FAB); mb.roundBox(M(x - o * 0.064, 0.3, 0), 0.03, 0.1, 0.085, pantsD, 0.01); mb.cylinder(M(x, 0.095), 0.074, 0.074, 0.03, 8, pantsD);
    mb.setBone(I['foot' + sd]); if (L.barefoot) { S(skin, SKIN); mb.roundBox(M(x, 0.05, 0.05), 0.1, 0.07, 0.24, skin, 0.03); for (let k = 0; k < 4; k++) mb.roundBox(M(x - 0.03 + k * 0.02, 0.03, 0.17), 0.016, 0.025, 0.03, skinD, 0.006); continue; }
    S(shoe, RUB); mb.roundBox(M(x, 0.065, 0.04), 0.12, 0.09, 0.27, shoe, 0.035);
    S(sole, RUB); mb.roundBox(M(x, 0.018, 0.04), 0.127, 0.036, 0.28, sole, 0.012); mb.roundBox(M(x, 0.055, 0.165), 0.105, 0.045, 0.03, sole, 0.01);
    S(shade(shoe, 1.6), RUB); for (let k = 0; k < 3; k++) mb.box(M(x, 0.105 - k * 0.006, 0.06 + k * 0.03), 0.07, 0.008, 0.012, shade(shoe, 1.6)); }
  return finish(mb, I);
}
function finish(mb, I) { const d = mb.build(); const piv = [0, 1.56, 0], K = 1.1; // cabeça um pouco marcada, como na arte, sem ficar infantil
  for (let v = 0; v < d.pos.length / 3; v++) if (d.joints[v * 4] === I.head) for (let c = 0; c < 3; c++) d.pos[v * 3 + c] = piv[c] + (d.pos[v * 3 + c] - piv[c]) * K;
  return facetize(d, 3, 0.05); }
// símbolo de risco biológico (três crescentes + anel) num plano voltado para a normal dada
function biohazard(mb, c, n, size) { const blk = hex(0x111111); mb.setColor(blk, 0.02); const up = Math.abs(n[1]) > 0.9 ? [0, 0, 1] : [0, 1, 0]; const t = [up[1] * n[2] - up[2] * n[1], up[2] * n[0] - up[0] * n[2], up[0] * n[1] - up[1] * n[0]]; const b = [n[1] * t[2] - n[2] * t[1], n[2] * t[0] - n[0] * t[2], n[0] * t[1] - n[1] * t[0]];
  const at = (u, v, o = 0.004) => [c[0] + t[0] * u + b[0] * v + n[0] * o, c[1] + t[1] * u + b[1] * v + n[1] * o, c[2] + t[2] * u + b[2] * v + n[2] * o];
  const yaw = Math.atan2(n[0], n[2]); for (let k = 0; k < 3; k++) { const a = k * 2.094 + Math.PI / 2; for (let j = 0; j < 5; j++) { const aa = a - 0.9 + j * 0.45; const p = at(Math.cos(a) * size * 0.45 + Math.cos(aa) * size * 0.28, Math.sin(a) * size * 0.45 + Math.sin(aa) * size * 0.28); mb.box(M(p[0], p[1], p[2], yaw), size * 0.14, size * 0.14, 0.006, blk); } }
  for (let j = 0; j < 10; j++) { const a = j / 10 * 6.283; const p = at(Math.cos(a) * size * 0.3, Math.sin(a) * size * 0.3); mb.box(M(p[0], p[1], p[2], yaw), size * 0.1, size * 0.1, 0.006, blk); } }
// Roupa R.A.T vestida: traje amarelo selado, capuz com visor, máscara de gás com filtros, cinto, luvas e botas pretas e mochila preta com faixa amarela
function ratBody(mb, I) {
  const Y = hex(0xf2b705), Yd = hex(0xd99d00), K = hex(0x1e1f22), G = hex(0x3a3c40), V = hex(0x2a2f3c), Bk = hex(0x6a6c70); const S = (c, f) => mb.setColor(c, f);
  mb.setBone(I.hips); S(Y, FAB); mb.roundBox(M(0, 0.93, 0), 0.38, 0.2, 0.25, Y, 0.06, 2); S(K, RUB); mb.box(M(0, 1.0, 0), 0.4, 0.05, 0.26, K); S(Bk, MET); mb.box(M(0, 1.0, 0.132), 0.07, 0.045, 0.01, Bk); S(K, MET); mb.box(M(0, 1.0, 0.136), 0.04, 0.02, 0.008, K);
  mb.setBone(I.spine); S(Y, FAB); mb.roundBox(M(0, 1.16, 0), 0.4, 0.26, 0.26, Y, 0.08, 2);
  mb.setBone(I.chest); S(Y, FAB); mb.roundBox(M(0, 1.37, 0), 0.47, 0.27, 0.27, Y, 0.09, 2); S(Yd, FAB); mb.box(M(0, 1.3, 0.136), 0.012, 0.32, 0.01, Yd);
  biohazard(mb, [0.11, 1.4, 0.137], [0, 0, 1], 0.1);
  for (const sx of [-1, 1]) { S(K, RUB); mb.box(M(sx * 0.12, 1.36, 0.125, 0, 1, 0, sx * 0.08), 0.05, 0.36, 0.03, K); mb.box(M(sx * 0.12, 1.47, -0.02), 0.05, 0.03, 0.3, K); }
  // mochila preta com faixa amarela
  S(K, RUB); mb.roundBox(M(0, 1.3, -0.21), 0.36, 0.42, 0.17, K, 0.05, 1); S(Y, FAB); mb.box(M(0, 1.24, -0.296), 0.37, 0.07, 0.01, Y); S(G, RUB); mb.roundBox(M(0, 1.14, -0.3), 0.18, 0.12, 0.03, G, 0.01, 1);
  mb.setBone(I.neck); S(Y, FAB); mb.cylinder(M(0, 1.47), 0.09, 0.1, 0.14, 10, Y);
  mb.setBone(I.head); const hy = 1.69; S(Y, FAB); mb.roundBox(M(0, hy + 0.01, -0.01), 0.28, 0.32, 0.29, Y, 0.1, 2); mb.roundBox(M(0, hy - 0.1, 0), 0.26, 0.12, 0.26, Y, 0.06, 2);
  S(V, MET); mb.roundBox(M(0, hy + 0.02, 0.125), 0.19, 0.16, 0.05, V, 0.035, 2); S(hex(0x8a9ab8), MET); mb.box(M(-0.04, hy + 0.06, 0.152), 0.05, 0.02, 0.005, hex(0x8a9ab8));
  S(G, RUB); mb.roundBox(M(0, hy - 0.07, 0.13), 0.14, 0.09, 0.07, G, 0.025, 1); S(K, RUB); mb.cylinder(M(0, hy - 0.08, 0.16, 0, 1, Math.PI / 2), 0.035, 0.035, 0.03, 10, K);
  for (const sx of [-1, 1]) { S(K, RUB); mb.cylinder(M(sx * 0.085, hy - 0.08, 0.15, 0, 1, Math.PI / 2, sx * 0.6), 0.04, 0.04, 0.06, 10, K); S(G, RUB); mb.cylinder(M(sx * 0.11, hy - 0.08, 0.17, 0, 1, Math.PI / 2, sx * 0.6), 0.03, 0.03, 0.01, 10, G); }
  for (const sd of ['L', 'R']) { const x = sd === 'L' ? 0.235 : -0.235, o = sd === 'L' ? 1 : -1;
    mb.setBone(I['shoulder' + sd]); S(Y, FAB); mb.roundBox(M(x - o * 0.025, 1.44, 0), 0.16, 0.14, 0.17, Y, 0.06, 1);
    mb.setBone(I['upperArm' + sd]); S(Y, FAB); mb.cylinder(M(x, 1.17), 0.07, 0.085, 0.28, 10, Y); biohazard(mb, [x + o * 0.085, 1.3, 0], [o, 0, 0], 0.08);
    mb.setBone(I['foreArm' + sd]); S(Y, FAB); mb.cylinder(M(x, 0.93), 0.068, 0.072, 0.25, 10, Y); S(K, RUB); mb.cylinder(M(x, 0.91), 0.075, 0.075, 0.05, 10, K);
    mb.setBone(I['hand' + sd]); S(K, RUB); mb.roundBox(M(x, 0.85, 0.005), 0.085, 0.1, 0.06, K, 0.02, 1); for (let f = 0; f < 4; f++) mb.roundBox(M(x - 0.03 + f * 0.02, 0.79, 0.012), 0.018, 0.06, 0.02, K, 0.006, 1); mb.roundBox(M(x - o * 0.045, 0.85, 0.025), 0.02, 0.05, 0.02, K, 0.006, 1); }
  for (const sd of ['L', 'R']) { const x = sd === 'L' ? 0.1 : -0.1;
    mb.setBone(I['thigh' + sd]); S(Y, FAB); mb.cylinder(M(x, 0.5), 0.085, 0.1, 0.45, 10, Y);
    mb.setBone(I['shin' + sd]); S(Y, FAB); mb.cylinder(M(x, 0.14), 0.085, 0.09, 0.38, 10, Y); S(K, RUB); mb.roundBox(M(x, 0.16, 0.01), 0.18, 0.2, 0.2, K, 0.03, 1);
    mb.setBone(I['foot' + sd]); S(K, RUB); mb.roundBox(M(x, 0.06, 0.04), 0.14, 0.12, 0.29, K, 0.03, 1); mb.box(M(x, 0.012, 0.04), 0.15, 0.025, 0.3, hex(0x101010)); }
}
// mochilas nas costas (osso do peito)
function packMesh(mb, I, id) {
  mb.setBone(I.chest); const K = hex(0x2a2a2e), Kg = hex(0x45474c), S = (c, f) => mb.setColor(c, f); const z0 = -0.14;
  const straps = () => { S(K, RUB); for (const sx of [-1, 1]) { mb.box(M(sx * 0.1, 1.33, 0.118), 0.045, 0.34, 0.02, K); mb.box(M(sx * 0.1, 1.48, -0.01), 0.045, 0.03, 0.26, K); } };
  if (id === 'pack_impro') { const cl = hex(0x6e6a48), wd = hex(0x6a4a2c), rope = hex(0xc8a878); S(cl, FAB); mb.roundBox(M(0, 1.28, z0 - 0.1), 0.32, 0.38, 0.2, cl, 0.08, 2); mb.roundBox(M(0, 1.44, z0 - 0.1), 0.26, 0.08, 0.17, shade(cl, 0.85), 0.04, 1);
    S(wd, 0.63); for (const sx of [-1, 1]) mb.cylinder(M(sx * 0.17, 1.04, z0 - 0.04), 0.018, 0.016, 0.55, 6, wd); S(rope, FAB); for (const y of [1.2, 1.38]) mb.box(M(0, y, z0 - 0.1), 0.36, 0.03, 0.22, rope);
    S(hex(0x7a3a2a), FAB); mb.box(M(0.08, 1.16, z0 - 0.2), 0.1, 0.09, 0.01, hex(0x7a3a2a)); S(cl, FAB); for (const sx of [-1, 1]) mb.box(M(sx * 0.1, 1.33, 0.118), 0.045, 0.34, 0.02, cl); return; }
  const P = { pack_small: [hex(0x3aa52a), 0.3, 0.32, 0.16], pack_medium: [hex(0x1f6fd6), 0.34, 0.4, 0.19], pack_large: [hex(0xd2282a), 0.4, 0.5, 0.22], pack_climb: [hex(0xf06a10), 0.36, 0.62, 0.22] }[id]; if (!P) return;
  const [c, w, h, d] = P; const yc = 1.3 - (h - 0.32) * 0.35, zc = z0 - d / 2;
  S(c, FAB); mb.roundBox(M(0, yc, zc), w, h, d, c, 0.05, 2); S(shade(c, 1.12), FAB); mb.roundBox(M(0, yc + h / 2 - 0.04, zc), w * 0.96, 0.08, d * 1.02, shade(c, 1.12), 0.03, 1); // tampa
  S(K, RUB); mb.box(M(0, yc - h * 0.05, zc - d / 2 - 0.005), w * 0.8, h * 0.08, 0.01, K); S(c, FAB); mb.roundBox(M(0, yc - h * 0.22, zc - d / 2 - 0.04), w * 0.62, h * 0.3, 0.08, shade(c, 0.92), 0.03, 1);
  S(hex(0xb8b8b8), MET); mb.box(M(0, yc - h * 0.2, zc - d / 2 - 0.082), w * 0.25, 0.035, 0.005, hex(0xb8b8b8));
  S(K, RUB); for (const sx of [-0.25, 0.25]) { mb.box(M(sx * w, yc + h * 0.1, zc - d / 2 - 0.006), 0.025, h * 0.7, 0.012, K); S(Kg, MET); mb.box(M(sx * w, yc + h * 0.32, zc - d / 2 - 0.012), 0.035, 0.03, 0.01, Kg); S(K, RUB); }
  if (id === 'pack_large' || id === 'pack_climb') for (const sx of [-1, 1]) { S(id === 'pack_climb' ? hex(0xf8c020) : shade(c, 0.9), FAB); mb.roundBox(M(sx * (w / 2 + 0.035), yc - h * 0.05, zc), 0.07, h * 0.5, d * 0.7, id === 'pack_climb' ? hex(0xf8c020) : shade(c, 0.9), 0.025, 1); }
  if (id === 'pack_climb') { const rope = hex(0xf2c018); S(rope, FAB); for (let k = 0; k < 5; k++) mb.cylinder(M(w / 2 + 0.07, yc + 0.02 - 0.18 + k * 0.08, zc, 0, 1, Math.PI / 2), 0.1 - k * 0.004, 0.1 - k * 0.004, 0.03, 12, k % 2 ? rope : shade(rope, 0.85));
    S(hex(0xf06a10), FAB); mb.cylinder(M(w / 2 + 0.04, yc - h / 2 - 0.06, zc + 0.01, 0, 1, 0, Math.PI / 2), 0.08, 0.08, w + 0.08, 12, hex(0xe25a0a)); S(K, RUB); for (const sx of [-0.3, 0.3]) { mb.cylinder(M(sx * w + 0.015, yc - h / 2 - 0.06, zc + 0.01, 0, 1, 0, Math.PI / 2), 0.083, 0.083, 0.03, 12, K); mb.box(M(sx * w, yc - h / 2 + 0.01, zc - d / 2 + 0.02), 0.025, 0.1, 0.01, K); }
    S(hex(0xc8ccd0), MET); mb.roundBox(M(w * 0.15, yc + h * 0.15, zc - d / 2 - 0.02), 0.03, 0.08, 0.012, hex(0xc8ccd0), 0.006, 1); }
  straps();
}
