// Modelos low-poly da base: Territoritek (estaca de território que dispara uma luz para o céu), baús (madeira,
// madeira e ferro, ferro), trancas (madeira, ferro, ouro) e o armário de manutenção.
import { MeshBuilder, M, hex, shade } from '../engine/mesh.js';

const MET = 0.5, WOOD = 0.63, POLY = 0.86, GLOW = 0.02, PAINT = 0.7;
const seg = (mb, a, b, w, col) => { const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], L = Math.hypot(dx, dy, dz); mb.box(M((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2, Math.atan2(dx, dz), 1, -Math.atan2(dy, Math.hypot(dx, dz))), w, w, L, col); };
const rnd = (s) => () => (s = (s * 16807) % 2147483647) / 2147483647;

// ---------- Territoritek ----------
const RUSTY = 0x7a766c, PLATE = 0x8e8a80, RUST = 0x8a5634, DK = 0x2c2e30;
// base de terra + estaca-broca + haste blindada com pedal e cabos (fica parada; a cabeça sobe ao abrir)
export function tkBaseMesh() {
  const mb = new MeshBuilder(); const r = rnd(11); const dirt = hex(0x7a6650), peb = hex(0xa89a84), st = hex(RUSTY), pl = hex(PLATE), ru = hex(RUST), dk = hex(DK);
  mb.setColor(dirt, POLY); mb.cylinder(M(0, -0.02, 0), 0.62, 0.66, 0.07, 9, dirt);
  mb.setColor(peb, POLY); for (let i = 0; i < 22; i++) { const a = r() * 6.28, d = 0.15 + r() * 0.45, s = 0.015 + r() * 0.03; mb.box(M(Math.cos(a) * d, 0.06, Math.sin(a) * d, r() * 3), s * 2, s, s * 1.6, shade(peb, 0.8 + r() * 0.4)); }
  mb.setColor(hex(0x9a9a7a), POLY); mb.roundBox(M(-0.32, 0.1, 0.18), 0.16, 0.1, 0.13, hex(0x9a9a7a), 0.03, 1); mb.roundBox(M(0.3, 0.09, 0.28), 0.12, 0.08, 0.1, hex(0x9aa07a), 0.03, 1);
  mb.setColor(hex(0x6a8a48), POLY); for (const [x, z] of [[-0.4, -0.15], [0.42, -0.05]]) for (let i = 0; i < 3; i++) mb.box(M(x + i * 0.025, 0.17, z, i, 1, 0.3 * (i - 1)), 0.012, 0.24, 0.012, hex(0x6a8a48));
  // broca enterrada (só a parte de cima aparece) com anéis da rosca
  mb.setColor(dk, PAINT); mb.cylinder(M(0, 0.02, 0), 0.05, 0.075, 0.3, 8, dk); for (let i = 0; i < 4; i++) mb.cylinder(M(0, 0.05 + i * 0.06, 0), 0.085 - i * 0.004, 0.085 - i * 0.004, 0.02, 8, shade(dk, 1.3));
  mb.setColor(st, PAINT); mb.cylinder(M(0, 0.32, 0), 0.075, 0.06, 0.2, 8, st);
  // haste blindada com placas rebitadas
  mb.setColor(st, PAINT); mb.box(M(0, 0.9, 0), 0.13, 0.95, 0.13, st);
  mb.setColor(pl, PAINT); for (const [y, h, z] of [[0.68, 0.24, 1], [0.98, 0.22, 1], [0.84, 0.3, -1]]) { mb.roundBox(M(0, y, z * 0.075), 0.17, h, 0.03, pl, 0.008, 1); mb.setColor(ru, PAINT); for (const sx of [-1, 1]) for (const sy of [-1, 1]) mb.box(M(sx * 0.065, y + sy * h * 0.38, z * 0.093), 0.014, 0.014, 0.008, ru); mb.setColor(pl, PAINT); }
  mb.setColor(dk, PAINT); mb.box(M(0, 1.38, 0), 0.1, 0.06, 0.1, dk); mb.setColor(st, PAINT); mb.cylinder(M(0, 1.36, 0), 0.075, 0.075, 0.1, 10, st);
  // pedal
  mb.setColor(dk, PAINT); mb.box(M(0.13, 0.16, 0.0), 0.12, 0.05, 0.05, dk); mb.setColor(pl, PAINT); mb.box(M(0.22, 0.19, 0.0), 0.12, 0.02, 0.1, pl); mb.setColor(dk, PAINT); for (let i = 0; i < 4; i++) mb.box(M(0.22, 0.205, -0.035 + i * 0.024), 0.1, 0.006, 0.006, dk);
  // cabos azuis e tubo lateral
  mb.setColor(hex(0x5a8ad0), 0.4); const c1 = [[0.07, 1.3, 0.05], [0.12, 1.1, 0.07], [0.1, 0.8, 0.08], [0.08, 0.55, 0.06]]; for (let i = 0; i < c1.length - 1; i++) seg(mb, c1[i], c1[i + 1], 0.018, hex(0x5a8ad0));
  mb.setColor(hex(0xd8d040), GLOW); mb.box(M(0.085, 0.62, 0.075), 0.012, 0.04, 0.012, hex(0xd8d040));
  return mb.build();
}
// cabeça blindada (casulo octogonal com placas, faixas amarelas acesas, painel solar e câmera); origem no pescoço
export function tkHeadMesh() {
  const mb = new MeshBuilder(); const st = hex(RUSTY), pl = hex(PLATE), ru = hex(RUST), dk = hex(DK), yel = hex(0xe8e040);
  mb.setColor(st, PAINT); mb.cylinder(M(0, 0.0, 0), 0.22, 0.3, 0.14, 8, st); mb.cylinder(M(0, 0.14, 0), 0.3, 0.33, 0.3, 8, st); mb.cylinder(M(0, 0.44, 0), 0.33, 0.3, 0.06, 8, shade(st, 1.08));
  for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4 + Math.PI / 8; mb.setColor(k % 3 === 1 ? ru : pl, PAINT); mb.roundBox(M(Math.sin(a) * 0.32, 0.27, Math.cos(a) * 0.32, a), 0.2, 0.22, 0.04, k % 3 === 1 ? shade(ru, 1.1) : pl, 0.012, 1);
    mb.setColor(ru, PAINT); for (const sy of [-1, 1]) mb.box(M(Math.sin(a) * 0.345, 0.27 + sy * 0.085, Math.cos(a) * 0.345, a), 0.014, 0.014, 0.008, ru); }
  mb.setColor(yel, GLOW); for (const a of [0.4, 2.4, 4.3]) { mb.box(M(Math.sin(a) * 0.3, 0.05, Math.cos(a) * 0.3, a), 0.16, 0.02, 0.02, yel); mb.box(M(Math.sin(a + 1) * 0.335, 0.27, Math.cos(a + 1) * 0.335, a + 1), 0.015, 0.14, 0.015, yel); }
  // aro da lente
  mb.setColor(pl, PAINT); mb.cylinder(M(0, 0.47, 0), 0.27, 0.26, 0.05, 10, pl); mb.setColor(dk, PAINT); mb.cylinder(M(0, 0.49, 0), 0.22, 0.22, 0.02, 10, dk);
  mb.setColor(hex(0x9ad8f0), GLOW); mb.cylinder(M(0, 0.48, 0), 0.2, 0.15, 0.06, 8, hex(0x9ad8f0)); // vidro azul (aceso)
  // painel solar e câmera/antena
  mb.setColor(dk, PAINT); seg(mb, [0.3, 0.2, 0.05], [0.42, 0.25, 0.05], 0.03, dk); mb.setColor(pl, PAINT); mb.box(M(0.44, 0.27, 0.05, 0, 1, 0, -0.3), 0.02, 0.3, 0.2, pl);
  mb.setColor(hex(0x2c4f9a), 0.5); mb.box(M(0.455, 0.27, 0.05, 0, 1, 0, -0.3), 0.005, 0.27, 0.17, hex(0x2c4f9a)); mb.setColor(hex(0xb8c8e0), 0.5); for (let i = -1; i <= 1; i++) mb.box(M(0.459, 0.27 + i * 0.08, 0.05, 0, 1, 0, -0.3), 0.003, 0.006, 0.17, hex(0xb8c8e0));
  mb.setColor(st, PAINT); mb.box(M(0.3, 0.5, -0.12), 0.05, 0.12, 0.05, st); mb.box(M(0.3, 0.6, -0.12), 0.08, 0.06, 0.1, pl); mb.setColor(dk, PAINT); mb.cylinder(M(0.3, 0.6, -0.06, 0, 1, Math.PI / 2), 0.02, 0.02, 0.02, 8, dk);
  // canos curvos até a haste
  mb.setColor(st, PAINT); seg(mb, [-0.15, 0.02, 0.18], [-0.08, -0.12, 0.06], 0.04, st); seg(mb, [0.18, 0.02, -0.15], [0.07, -0.13, -0.06], 0.04, st);
  return mb.build();
}
// tampa da lente (fechada enquanto não arma) e feixe de luz (cilindro aberto, aceso)
export function tkLidMesh() { const mb = new MeshBuilder(); const pl = hex(PLATE), ru = hex(RUST); mb.setColor(pl, MET); mb.cylinder(M(0, 0, 0), 0.27, 0.25, 0.04, 8, pl); mb.setColor(ru, MET); for (let k = 0; k < 4; k++) mb.box(M(0, 0.042, 0, k * Math.PI / 4), 0.5, 0.01, 0.03, ru); return mb.build(); }
export function beamMesh() { const mb = new MeshBuilder(); const c = hex(0xbfe8ff); mb.setColor(c, GLOW); mb.cylinder(M(0, 0, 0), 1, 0.7, 1, 12, c, false); return mb.build(); }

// ---------- baús (frente = +Z; tranca em [0, 0.47, 0.3]) ----------
export const CHEST_LOCK = [0, 0.46, 0.3];
export function chestMesh(kind = 'wood') {
  const mb = new MeshBuilder(); const W = 0.88, D = 0.56, Hb = 0.42; const wood = hex(kind === 'iron' ? 0x8a8780 : 0x9a7a4e), woodD = shade(wood, 0.78), iron = hex(kind === 'iron' ? 0x5a5754 : 0x4a4644), stud = hex(0x7a7672);
  const F = kind === 'iron' ? PAINT : WOOD;
  // corpo: tábuas horizontais (ou chapas)
  for (let i = 0; i < 3; i++) { const c = i % 2 ? wood : shade(wood, 0.92); mb.setColor(c, F); mb.box(M(0, 0.07 + i * 0.135 + 0.0675, 0), W, 0.13, D, c); }
  mb.setColor(woodD, F); mb.box(M(0, 0.03, 0), W + 0.02, 0.06, D + 0.02, woodD);
  // tampa abaulada em 3 degraus
  for (let i = 0; i < 3; i++) { const t = i / 2; mb.setColor(i % 2 ? wood : shade(wood, 0.95), F); mb.box(M(0, Hb + 0.05 + i * 0.055, 0), W - 0.01, 0.06, D * (1 - t * 0.35), i % 2 ? wood : shade(wood, 0.95)); }
  mb.setColor(woodD, F); mb.box(M(0, Hb + 0.012, 0), W + 0.025, 0.03, D + 0.025, woodD);
  // ferragens
  mb.setColor(iron, MET);
  const corner = (sx, sz, y0, h) => { mb.box(M(sx * (W / 2 + 0.006), y0 + h / 2, sz * (D / 2 - 0.05), 0), 0.014, h, 0.1, iron); mb.box(M(sx * (W / 2 - 0.05), y0 + h / 2, sz * (D / 2 + 0.006)), 0.1, h, 0.014, iron); };
  if (kind === 'wood') { for (const sx of [-1, 1]) for (const sz of [-1, 1]) { corner(sx, sz, 0.0, 0.12); corner(sx, sz, Hb - 0.08, 0.14); } }
  else {
    const bands = kind === 'iron' ? [-0.3, -0.12, 0.12, 0.3] : [-0.3, 0.3];
    for (const bx of bands) { mb.box(M(bx * W / 0.88, Hb / 2 + 0.02, D / 2 + 0.008), 0.06, Hb, 0.014, iron); mb.box(M(bx * W / 0.88, Hb / 2 + 0.02, -D / 2 - 0.008), 0.06, Hb, 0.014, iron); for (let i = 0; i < 3; i++) mb.box(M(bx * W / 0.88, Hb + 0.07 + i * 0.055, 0), 0.065, 0.065, D * (1 - i * 0.17) + 0.01, iron); }
    for (const y of [0.04, Hb - 0.02]) { mb.box(M(0, y, D / 2 + 0.01), W + 0.03, 0.05, 0.014, iron); mb.box(M(0, y, -D / 2 - 0.01), W + 0.03, 0.05, 0.014, iron); for (const sx of [-1, 1]) mb.box(M(sx * (W / 2 + 0.01), y, 0), 0.014, 0.05, D + 0.03, iron); }
    if (kind === 'wi') for (const sx of [-1, 1]) { seg(mb, [sx * 0.22 - 0.16, 0.08, D / 2 + 0.012], [sx * 0.22 + 0.16, Hb - 0.04, D / 2 + 0.012], 0.04, iron); seg(mb, [sx * 0.22 + 0.16, 0.08, D / 2 + 0.012], [sx * 0.22 - 0.16, Hb - 0.04, D / 2 + 0.012], 0.04, iron);
      seg(mb, [sx * (W / 2 + 0.012), 0.08, -0.18], [sx * (W / 2 + 0.012), Hb - 0.04, 0.18], 0.04, iron); seg(mb, [sx * (W / 2 + 0.012), 0.08, 0.18], [sx * (W / 2 + 0.012), Hb - 0.04, -0.18], 0.04, iron); }
    if (kind === 'iron') { for (const sx of [-1, 1]) { mb.box(M(sx * (W / 2 + 0.03), 0.25, 0), 0.02, 0.06, 0.16, iron); mb.box(M(sx * (W / 2 + 0.015), 0.25, 0), 0.03, 0.1, 0.03, iron); } }
    mb.setColor(stud, MET); for (const bx of bands) for (let i = 0; i < 3; i++) mb.box(M(bx * W / 0.88, 0.1 + i * 0.13, D / 2 + 0.017), 0.018, 0.018, 0.008, stud);
  }
  // fecho (aldrava) onde a tranca encaixa
  mb.setColor(iron, MET); mb.box(M(0, Hb + 0.02, D / 2 + 0.014), 0.09, 0.14, 0.016, iron); mb.box(M(0, Hb - 0.08, D / 2 + 0.02), 0.06, 0.05, 0.02, shade(iron, 0.8));
  return mb.build();
}

// ---------- trancas (cadeados) ----------
export function lockMesh(kind = 'wood') {
  const mb = new MeshBuilder(); const C = { wood: [0x8a5a32, 0x5a5856], iron: [0x7a7c80, 0x5e6064], gold: [0xd8a828, 0xb88a18] }[kind] || [0x8a5a32, 0x5a5856]; const body = hex(C[0]), trim = hex(C[1]), dk = hex(0x101010); const F = kind === 'wood' ? WOOD : MET;
  // argola (arco) e corpo; origem no centro do corpo, frente = +Z
  mb.setColor(kind === 'gold' ? body : hex(0x6a6c70), MET); for (const sx of [-1, 1]) mb.box(M(sx * 0.03, 0.065, 0), 0.016, 0.06, 0.016, kind === 'gold' ? body : hex(0x6a6c70)); mb.box(M(0, 0.1, 0), 0.076, 0.016, 0.016, kind === 'gold' ? body : hex(0x6a6c70));
  mb.setColor(body, F); mb.roundBox(M(0, 0, 0), 0.1, 0.09, 0.04, body, kind === 'wood' ? 0.004 : 0.012, 1);
  mb.setColor(trim, MET); if (kind === 'wood') { for (const y of [-0.025, 0.025]) mb.box(M(0, y, 0.021), 0.104, 0.014, 0.006, trim); }
  mb.roundBox(M(0, -0.004, 0.022), 0.04, 0.055, 0.008, trim, 0.004, 1); mb.setColor(dk, POLY); mb.box(M(0, 0.0, 0.027), 0.012, 0.012, 0.004, dk); mb.box(M(0, -0.013, 0.027), 0.006, 0.016, 0.004, dk);
  if (kind !== 'wood') { mb.setColor(trim, MET); for (const sx of [-1, 1]) for (const sy of [-1, 1]) mb.box(M(sx * 0.038, sy * 0.03, 0.022), 0.012, 0.012, 0.006, trim); }
  return mb.build();
}

// ---------- armário de manutenção (frente = +Z; tranca entre as portas) ----------
export const CABINET_LOCK = [0, 1.02, 0.29];
export function cabinetMesh() {
  const mb = new MeshBuilder(); const wd = hex(0xa26a36), wdD = shade(wd, 0.78), wdL = shade(wd, 1.12), ir = hex(0x5e5e62), gold = hex(0xd8b040); const W = 1.0, D = 0.5, H = 1.7;
  mb.setColor(wd, WOOD); mb.box(M(0, 0.28 + (H - 0.28) / 2, 0), W, H - 0.28, D, wd); // corpo
  mb.setColor(wdD, WOOD); for (const sx of [-1, 1]) mb.box(M(sx * (W / 2 - 0.02), 0.28 + (H - 0.28) / 2, D / 2 + 0.01), 0.06, H - 0.28, 0.03, wdD);
  mb.setColor(wdL, WOOD); mb.box(M(0, H + 0.03, 0.01), W + 0.12, 0.07, D + 0.1, wdL); mb.box(M(0, 0.62, 0.02), W + 0.04, 0.05, D + 0.05, wdL);
  // portas com almofada, dobradiças e puxadores de ferro
  for (const sx of [-1, 1]) { const cx = sx * 0.235; mb.setColor(wd, WOOD); mb.box(M(cx, 1.17, D / 2 + 0.02), 0.44, 1.0, 0.03, shade(wd, 1.04)); mb.setColor(wdD, WOOD); mb.box(M(cx, 1.17, D / 2 + 0.036), 0.36, 0.9, 0.006, wdD); mb.setColor(wd, WOOD); mb.box(M(cx, 1.17, D / 2 + 0.04), 0.32, 0.86, 0.006, shade(wd, 1.06));
    mb.setColor(ir, MET); for (const y of [0.78, 1.56]) { mb.box(M(sx * 0.4, y, D / 2 + 0.045), 0.14, 0.04, 0.012, ir); mb.box(M(sx * 0.44, y, D / 2 + 0.05), 0.03, 0.06, 0.012, ir); }
    mb.box(M(sx * 0.1, 1.02, D / 2 + 0.05), 0.16, 0.035, 0.012, ir); mb.box(M(sx * 0.04, 1.02, D / 2 + 0.06), 0.03, 0.14, 0.02, ir);
    mb.setColor(wd, WOOD); mb.box(M(cx, 0.45, D / 2 + 0.02), 0.42, 0.24, 0.03, shade(wd, 0.98)); mb.setColor(ir, MET); mb.box(M(cx, 0.45, D / 2 + 0.045), 0.14, 0.03, 0.02, ir); }
  mb.setColor(wdD, WOOD); mb.box(M(0, 0.31, 0.01), W, 0.06, D + 0.02, wdD);
  mb.setColor(ir, MET); for (const sx of [-1, 1]) for (const sz of [-1, 1]) mb.roundBox(M(sx * 0.44, 0.14, sz * 0.2), 0.12, 0.28, 0.12, ir, 0.02, 1);
  // emblema com pedra dourada no topo
  mb.setColor(ir, MET); mb.roundBox(M(0, H + 0.14, D / 2 + 0.02), 0.22, 0.2, 0.06, ir, 0.02, 1); for (const sx of [-1, 1]) mb.box(M(sx * 0.15, H + 0.1, D / 2 + 0.02, 0, 1, 0, sx * 0.4), 0.14, 0.05, 0.05, ir);
  mb.setColor(gold, 0.3); mb.roundBox(M(0, H + 0.14, D / 2 + 0.055), 0.09, 0.09, 0.03, gold, 0.015, 1);
  return mb.build();
}

// ---------- marcação do território no chão (anel que acompanha o relevo) ----------
// hf(x, z) → altura do terreno; coordenadas locais ao Territoritek (y relativo a y0)
export function ringMesh(hf, x0, y0, z0, R, w, col) {
  const mb = new MeshBuilder(); const c = hex(col); mb.setColor(c, GLOW); const N = 160, up = [0, 1, 0];
  let prev = null;
  for (let i = 0; i <= N; i++) { const a = i / N * Math.PI * 2, cs = Math.cos(a), sn = Math.sin(a); const pts = [];
    for (const r of [R - w / 2, R + w / 2]) { const x = cs * r, z = sn * r; pts.push(mb.vert([x, hf(x0 + x, z0 + z) - y0 + 0.07, z], up)); }
    if (prev) { mb.tri(prev[0], pts[0], pts[1]); mb.tri(prev[0], pts[1], prev[1]); }
    prev = pts; }
  return mb.build();
}

// ---------- cama de casal de madeira (do desenho): cabeceira com emblema, colchão, travesseiros azuis, criado-mudo com abajur ----------
// local: largura em X (1,7 m), comprimento em Z (2,2 m); cabeceira em −Z, pés em +Z; origem no chão, no centro
export function bedMesh() {
  const mb = new MeshBuilder(); const W = hex(0x9a6436), WD = hex(0x7c4e2a), WL = hex(0xb07844), IRON = hex(0x5f6166), GOLD = hex(0xc9a24a), MAT = hex(0xe9e1cc), SHEET = hex(0xf1ebdc), BLUE = hex(0x4f7f95);
  const hx = 0.82, hz = 1.08; const C = (c, f) => mb.setColor(c, f);
  // estrado e laterais
  C(W, WOOD); for (const s of [-1, 1]) mb.roundBox(M(s * hx, 0.24, 0), 0.08, 0.2, hz * 2 - 0.1, W, 0.02, 1); mb.roundBox(M(0, 0.18, 0), hx * 2, 0.08, hz * 2 - 0.1, WD, 0.01, 1);
  // pés (postes grossos com ponteira de ferro embaixo)
  for (const [x, z, h] of [[-hx, -hz, 1.28], [hx, -hz, 1.28], [-hx, hz, 0.76], [hx, hz, 0.76]]) { C(W, WOOD); mb.roundBox(M(x, 0.1, z), 0.14, h - 0.1, 0.14, W, 0.025, 1); mb.roundBox(M(x, h - 0.02, z), 0.17, 0.06, 0.17, WL, 0.02, 1); C(IRON, MET); mb.roundBox(M(x, 0, z), 0.16, 0.11, 0.16, IRON, 0.02, 1); }
  // cabeceira: dois painéis + emblema de ferro com pedra dourada
  C(W, WOOD); mb.roundBox(M(0, 0.42, -hz), hx * 2 - 0.1, 0.72, 0.07, W, 0.02, 1); mb.roundBox(M(0, 1.14, -hz), hx * 2 - 0.06, 0.1, 0.1, WL, 0.02, 1);
  C(WL, WOOD); for (const s of [-1, 1]) mb.roundBox(M(s * 0.38, 0.52, -hz + 0.04), 0.66, 0.5, 0.03, WL, 0.015, 1);
  C(IRON, MET); mb.cylinder(M(0, 1.02, -hz + 0.02, 0, 1, Math.PI / 2), 0.11, 0.11, 0.05, 6, IRON); C(GOLD, MET); mb.cylinder(M(0, 1.02, -hz + 0.05, 0, 1, Math.PI / 2), 0.05, 0.05, 0.03, 6, GOLD);
  // peseira com dois painéis
  C(W, WOOD); mb.roundBox(M(0, 0.3, hz), hx * 2 - 0.1, 0.42, 0.07, W, 0.02, 1); C(WL, WOOD); for (const s of [-1, 1]) mb.roundBox(M(s * 0.38, 0.34, hz + 0.04), 0.66, 0.3, 0.03, WL, 0.015, 1);
  // colchão, lençol dobrado e travesseiros azuis
  C(MAT, POLY); mb.roundBox(M(0, 0.32, 0.02), hx * 2 - 0.12, 0.16, hz * 2 - 0.16, MAT, 0.05, 2); C(SHEET, POLY); mb.roundBox(M(0, 0.45, 0.25), hx * 2 - 0.1, 0.05, hz * 2 - 0.62, SHEET, 0.02, 1); mb.roundBox(M(0, 0.47, -0.18), hx * 2 - 0.08, 0.06, 0.16, SHEET, 0.03, 1);
  C(BLUE, POLY); for (const s of [-1, 1]) mb.roundBox(M(s * 0.38, 0.5, -hz + 0.28, 0, 1, -0.25), 0.6, 0.13, 0.3, BLUE, 0.06, 2);
  // criado-mudo com abajur ao lado da cabeceira
  const nx = hx + 0.42, nz = -hz + 0.18; C(W, WOOD); mb.roundBox(M(nx, 0, nz), 0.5, 0.5, 0.42, W, 0.02, 1); C(WL, WOOD); mb.box(M(nx, 0.2, nz + 0.21), 0.42, 0.18, 0.02, WL); C(IRON, MET); mb.box(M(nx, 0.29, nz + 0.225), 0.08, 0.02, 0.02, IRON);
  C(hex(0x46484c), MET); mb.cylinder(M(nx, 0.5, nz), 0.07, 0.08, 0.03, 8, hex(0x46484c)); mb.cylinder(M(nx, 0.53, nz), 0.012, 0.012, 0.22, 6, hex(0x46484c));
  C(hex(0xe8dcc0), GLOW); mb.cylinder(M(nx, 0.72, nz), 0.13, 0.07, 0.15, 8, hex(0xe8dcc0));
  return mb.build();
}

// ---------- bancadas (do desenho): comum (madeira + pés de metal), mecânica (metal, painel de ferramentas, compressor), armas (painel com fuzis, morsa) ----------
// local: comprimento em X (~1,9 m), fundo em Z (~0,95 m), frente em +Z; tampo a ~0,95 m
const legs = (mb, w, d, h, col, t = 0.07) => { for (const [x, z] of [[-w, -d], [w, -d], [-w, d], [w, d]]) mb.box(M(x, h / 2, z), t, h, t, col); };
export function benchCommonMesh() {
  const mb = new MeshBuilder(); const WD = hex(0xa0703e), WL = hex(0xb98450), ST = hex(0x77797e), DK = hex(0x3a3c40), C = (c, f) => mb.setColor(c, f);
  C(ST, PAINT); legs(mb, 0.86, 0.4, 0.9, ST); mb.box(M(0, 0.28, -0.4), 1.72, 0.05, 0.05, ST); mb.box(M(0, 0.28, 0.4), 1.72, 0.05, 0.05, ST); for (const s of [-1, 1]) mb.box(M(s * 0.86, 0.28, 0), 0.05, 0.05, 0.8, ST);
  C(WD, WOOD); for (let i = 0; i < 5; i++) mb.roundBox(M(0, 0.9, -0.38 + i * 0.19), 1.92, 0.08, 0.18, i % 2 ? WL : WD, 0.012, 1);
  // martelo, chave, serrote, rolo de fio e luminária
  C(hex(0x7a5530), WOOD); mb.box(M(-0.62, 0.97, 0.12, 0.35), 0.36, 0.03, 0.04, hex(0x7a5530)); C(DK, MET); mb.box(M(-0.78, 0.98, 0.06, 0.35), 0.08, 0.05, 0.12, DK);
  C(hex(0x9a9ea4), MET); mb.box(M(-0.2, 0.955, 0.18, -0.3), 0.32, 0.012, 0.04, hex(0x9a9ea4)); mb.box(M(0.32, 0.955, 0.15, 0.45), 0.42, 0.006, 0.12, hex(0xb8bcc0)); C(hex(0x2a2a2a), POLY); mb.box(M(0.5, 0.96, 0.3, 0.45), 0.1, 0.03, 0.08, hex(0x2a2a2a));
  C(hex(0x55585c), MET); mb.cylinder(M(0.05, 0.95, -0.2), 0.11, 0.11, 0.05, 10, hex(0x55585c)); C(hex(0x3a3c40), MET); mb.cylinder(M(0.05, 0.952, -0.2), 0.06, 0.06, 0.05, 8, hex(0x3a3c40));
  C(ST, PAINT); mb.cylinder(M(0.55, 0.94, -0.3), 0.1, 0.11, 0.03, 8, ST); seg(mb, [0.55, 0.96, -0.3], [0.6, 1.36, -0.32], 0.025, ST); seg(mb, [0.6, 1.36, -0.32], [0.38, 1.52, -0.2], 0.022, ST); mb.cylinder(M(0.33, 1.44, -0.18, 0, 1, 0.9), 0.04, 0.1, 0.13, 7, ST);
  return mb.build(); }
export function benchMechMesh() {
  const mb = new MeshBuilder(); const ST = hex(0x8d9095), SD = hex(0x6c6f74), DK = hex(0x2e3034), OR = hex(0xd6762a), RD = hex(0xb02a2a), C = (c, f) => mb.setColor(c, f);
  C(SD, PAINT); legs(mb, 0.86, 0.38, 0.92, SD, 0.09); C(ST, PAINT); mb.roundBox(M(0, 0.88, 0), 1.9, 0.1, 0.9, ST, 0.015, 1); mb.box(M(0, 0.7, 0.44), 1.86, 0.2, 0.03, SD);
  for (let i = 0; i < 6; i++) mb.cylinder(M(-0.8 + i * 0.32, 0.79, 0.455, 0, 1, Math.PI / 2), 0.012, 0.012, 0.01, 6, DK);
  // painel perfurado com ferramentas
  C(SD, PAINT); mb.box(M(0, 0.98, -0.42), 1.8, 0.9, 0.04, SD); C(DK, MET); for (let i = 0; i < 14; i++) for (let j = 0; j < 6; j++) mb.box(M(-0.78 + i * 0.12, 1.08 + j * 0.12, -0.398), 0.015, 0.015, 0.004, DK);
  C(hex(0xa8acb2), MET); for (let i = 0; i < 4; i++) mb.box(M(-0.7 + i * 0.16, 1.45, -0.39, 0, 1, 0, 0.1), 0.04, 0.38 - i * 0.04, 0.012, hex(0xa8acb2));
  for (let i = 0; i < 4; i++) { C(hex(0xa8acb2), MET); mb.box(M(0.05 + i * 0.1, 1.5, -0.39), 0.012, 0.22, 0.012, hex(0xa8acb2)); C(i % 2 ? OR : DK, POLY); mb.box(M(0.05 + i * 0.1, 1.36, -0.39), 0.03, 0.1, 0.03, i % 2 ? OR : DK); }
  // chaves inglesas e multímetro na bancada, porcas
  C(hex(0xa8acb2), MET); mb.box(M(-0.4, 0.95, 0.1, 0.2), 0.5, 0.02, 0.06, hex(0xa8acb2)); mb.box(M(-0.5, 0.95, -0.15, -0.1), 0.42, 0.02, 0.05, hex(0xa8acb2));
  C(OR, POLY); mb.roundBox(M(0.55, 0.94, -0.18), 0.14, 0.05, 0.2, OR, 0.01, 1); C(DK, POLY); mb.box(M(0.55, 0.97, -0.2), 0.1, 0.01, 0.08, DK); C(RD, POLY); seg(mb, [0.5, 0.94, -0.08], [0.25, 0.94, 0.1], 0.008, RD);
  C(hex(0x9a9ea4), MET); for (let i = 0; i < 6; i++) mb.cylinder(M(0.05 + (i % 3) * 0.09, 0.935, 0.1 + Math.floor(i / 3) * 0.08), 0.022, 0.022, 0.02, 6, hex(0x9a9ea4));
  C(hex(0x9a9ea4), MET); mb.cylinder(M(0.3, 0.94, -0.22), 0.05, 0.06, 0.12, 8, hex(0x9a9ea4)); seg(mb, [0.33, 1.05, -0.22], [0.42, 1.12, -0.12], 0.008, hex(0x9a9ea4));
  // compressor de ar embaixo
  C(hex(0x9ca0a6), MET); mb.cylinder(M(-0.25, 0.25, 0, 0, 1, 0, Math.PI / 2), 0.17, 0.17, 0.5, 10, hex(0x9ca0a6)); C(DK, MET); mb.roundBox(M(-0.25, 0.42, 0), 0.24, 0.14, 0.2, DK, 0.02, 1);
  C(DK, POLY); for (const x of [-0.45, -0.05]) mb.cylinder(M(x, 0.06, 0.12, 0, 1, 0, Math.PI / 2), 0.06, 0.06, 0.04, 8, DK);
  return mb.build(); }
export function benchGunsMesh() {
  const mb = new MeshBuilder(); const ST = hex(0x6e7177), SD = hex(0x55585d), WD = hex(0x5e4632), DK = hex(0x25272a), Y = hex(0xd8b33a), C = (c, f) => mb.setColor(c, f);
  C(SD, PAINT); legs(mb, 0.88, 0.4, 0.92, SD, 0.1); C(WD, WOOD); for (let i = 0; i < 4; i++) mb.box(M(0, 0.3, -0.33 + i * 0.22), 1.72, 0.04, 0.2, WD);
  C(ST, PAINT); mb.roundBox(M(0, 0.86, 0), 1.94, 0.12, 0.94, ST, 0.015, 1); C(WD, WOOD); mb.box(M(0, 0.925, 0), 1.84, 0.02, 0.84, WD); C(SD, PAINT); mb.box(M(0, 0.74, 0.46), 1.8, 0.16, 0.03, SD);
  // painel com dois fuzis pendurados
  C(ST, PAINT); mb.box(M(0, 0.98, -0.43), 1.86, 0.95, 0.05, ST); C(hex(0x8a8d92), MET); mb.box(M(0, 0.98, -0.405), 1.7, 0.85, 0.01, hex(0x8a8d92));
  C(DK, MET); for (const y of [1.6, 1.25]) { mb.box(M(0.05, y, -0.39), 0.9, 0.06, 0.03, DK); mb.box(M(-0.45, y - 0.04, -0.39), 0.28, 0.1, 0.03, DK); mb.box(M(0.12, y - 0.1, -0.39, 0, 1, 0, 0.1), 0.05, 0.16, 0.03, DK); mb.box(M(-0.05, y - 0.08, -0.39), 0.06, 0.12, 0.03, DK); mb.box(M(0.55, y, -0.39), 0.3, 0.025, 0.02, DK); }
  // peças, pentes, frascos de óleo e morsa
  C(DK, MET); mb.box(M(-0.35, 0.95, 0.1, 0.3), 0.3, 0.04, 0.05, DK); mb.box(M(0.0, 0.95, -0.05), 0.06, 0.04, 0.16, DK); mb.box(M(0.15, 0.95, 0.15, -0.4), 0.06, 0.04, 0.14, DK); mb.box(M(0.25, 0.97, 0.02), 0.25, 0.06, 0.06, DK);
  C(hex(0xb08a5a), WOOD); mb.box(M(-0.15, 0.95, 0.15), 0.18, 0.05, 0.06, hex(0xb08a5a));
  for (const [x, z] of [[-0.85, -0.25], [0.6, -0.2]]) { C(Y, POLY); mb.cylinder(M(x, 0.935, z), 0.035, 0.035, 0.12, 8, Y); C(hex(0xb02a2a), POLY); mb.cylinder(M(x, 1.055, z), 0.01, 0.018, 0.04, 6, hex(0xb02a2a)); }
  C(SD, PAINT); mb.roundBox(M(0.78, 0.97, 0.2), 0.12, 0.1, 0.2, SD, 0.015, 1); mb.box(M(0.78, 1.06, 0.2), 0.2, 0.05, 0.06, ST); mb.cylinder(M(0.78, 1.0, 0.36, 0, 1, Math.PI / 2), 0.012, 0.012, 0.14, 6, ST);
  return mb.build(); }

// ---------- forno de pedra (do desenho): cúpula de pedras com boca de fogo, chaminé e mesinha com lingotes ----------
export function furnaceMesh() {
  const mb = new MeshBuilder(); const r = rnd(77); const G = hex(0x8a8780), GD = hex(0x6c6a64), BASE = hex(0x9a978f), C = (c, f) => mb.setColor(c, f);
  C(BASE, POLY); mb.cylinder(M(0, 0, 0), 1.05, 1.12, 0.1, 12, BASE);
  // cúpula de pedras em anéis (deixa a boca na frente +Z)
  for (let ring = 0; ring < 6; ring++) { const y = 0.15 + ring * 0.24, rr = 0.78 * Math.cos(ring / 6 * 1.35) + 0.08, n = Math.max(5, Math.round(10 - ring)); for (let k = 0; k < n; k++) { const a = k / n * Math.PI * 2 + ring * 0.3; if (ring < 2 && Math.abs(Math.atan2(Math.sin(a), Math.cos(a)) - Math.PI / 2) < 0.5) continue;
      C(r() < 0.5 ? G : GD, POLY); mb.roundBox(M(Math.cos(a) * rr, y, Math.sin(a) * rr, -a), 0.3, 0.24, 0.42 * rr + 0.12, r() < 0.5 ? G : GD, 0.05, 1); } }
  C(GD, POLY); mb.cylinder(M(0, 0.1, 0), 0.62, 0.3, 1.5, 9, GD); // miolo
  // chaminé
  C(G, POLY); mb.cylinder(M(0, 1.55, 0), 0.2, 0.18, 0.35, 7, G); C(hex(0x3a2418), POLY); mb.cylinder(M(0, 1.88, 0), 0.12, 0.12, 0.03, 7, hex(0x3a2418));
  // boca de fogo com arco, lenha e brasas
  C(GD, POLY); mb.roundBox(M(0, 0.12, 0.7), 0.62, 0.08, 0.2, GD, 0.02, 1); for (const s of [-1, 1]) mb.roundBox(M(s * 0.3, 0.12, 0.72), 0.16, 0.5, 0.22, G, 0.04, 1); mb.roundBox(M(0, 0.6, 0.72), 0.72, 0.16, 0.22, G, 0.04, 1);
  C(hex(0x2a1810), POLY); mb.box(M(0, 0.18, 0.55), 0.46, 0.4, 0.06, hex(0x2a1810));
  C(hex(0x6a4428), WOOD); for (let i = 0; i < 4; i++) mb.box(M(-0.12 + i * 0.08, 0.22, 0.62, i * 0.7), 0.06, 0.06, 0.3, hex(0x6a4428));
  C(hex(0xff7a2a), GLOW); for (let i = 0; i < 6; i++) mb.box(M(-0.16 + r() * 0.32, 0.2, 0.6 + r() * 0.1), 0.04, 0.03, 0.04, hex(0xff7a2a));
  // mesinha lateral com lingotes
  C(G, POLY); mb.roundBox(M(0.95, 0.08, 0.15), 0.42, 0.45, 0.42, G, 0.05, 1); for (const [k, c] of [[0, 0xb06a48], [1, 0xc8ccd2], [2, 0x8e9096]]) { C(hex(c), MET); mb.box(M(0.83 + k * 0.12, 0.56, 0.15), 0.1, 0.05, 0.2, hex(c)); }
  return mb.build(); }

// ---------- rochas de minério (do desenho): ferro (cinza com ferrugem), cobre (marrom com verde), prata (cristais prateados), ouro (cristais dourados) ----------
export const ORE_KINDS = ['iron', 'copper', 'silver', 'gold'];
export function oreMesh(kind) {
  const mb = new MeshBuilder(); const r = rnd({ iron: 5, copper: 9, silver: 13, gold: 17 }[kind] || 3); const base = hex(0x8e8c86);
  C0(mb, base); mb.cylinder(M(0, -0.05, 0), 1.0, 1.1, 0.12, 9, base); // laje rachada
  const pal = { iron: [0x6e6e70, 0x5a5a5c, 0x9a5a34], copper: [0x9a5a44, 0x7e4836, 0x3aa07a], silver: [0xc8ccd4, 0xa8aeb8, 0xe8ecf2], gold: [0xe0a848, 0xc88a2a, 0xffd870] }[kind];
  const crystal = kind === 'silver' || kind === 'gold';
  const col = (y, dir, rr) => { const n = rr(); return hex(n < 0.2 ? pal[2] : n < 0.6 ? pal[0] : pal[1]); };
  if (!crystal) { mb.flex = 0.88; mb.rockSmooth(M(0, 0.5, 0, 0, [1.0, 1.2, 0.95]), 0.75, 2, 0.35, hex(pal[0]), r, col, 0.3); mb.rockSmooth(M(0.6, 0.22, 0.35, r() * 6), 0.4, 2, 0.35, hex(pal[1]), r, col, 0.3); mb.rockSmooth(M(-0.55, 0.18, 0.4, r() * 6), 0.32, 2, 0.35, hex(pal[1]), r, col, 0.3); }
  else { for (let i = 0; i < 9; i++) { const a = r() * 6.28, d = i ? 0.2 + r() * 0.45 : 0, h = i ? 0.35 + r() * 0.5 : 1.05; const c = hex(pal[i % 3]); mb.setColor(c, 0.5); mb.cylinder(M(Math.cos(a) * d, 0.02, Math.sin(a) * d, r() * 3, 1, (r() - 0.5) * 0.5, (r() - 0.5) * 0.5), 0.12 + r() * 0.1, 0.03, h, 6, c); } }
  return mb.build(); }
function C0(mb, c) { mb.setColor(c, POLY); }
