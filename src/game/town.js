// Cidades e estradas: ruas com asfalto, calçada, meio-fio, faixa tracejada e faixa de pedestre; cruzamentos; cercas de
// madeira dos lotes; árvores de quintal; caixa d'água; pilha de pneus; igreja, loja e oficina (fachadas e letreiros);
// faixas das estradas (asfalto ou terra) que acompanham o terreno; guard-rail das pontes; e as cachoeiras
// (lâmina d'água, lago de cima e o riacho que o alimenta).
import { MeshBuilder, M, hex, shade } from '../engine/mesh.js';
import { rng } from '../engine/math.js';

export const PITCH = 44, CW = 7, SWK = 2, HC = CW / 2 + SWK; // quadra (eixo a eixo), pista, calçada, meia faixa total da rua
const ASPH = hex(0x3a3b3d), WHITE = hex(0xe9e7df), CURB = hex(0xbdb9ae), SIDE = hex(0xa8a49a), JOINT = hex(0x8e8a80), DIRT = hex(0x8a6c4a), WOODC = hex(0x76502f);
const STONE = 0.93, WOOD = 0.63, MET = 0.5, POLY = 0.86;
const B = (mb, x, y, z, sx, sy, sz, c, f = STONE) => { mb.setColor(c, f); mb.box(M(x, y + sy / 2, z), sx, sy, sz, c); };
// triângulo virado para cima (corrige a ordem dos vértices)
function upTri(mb, a, b, c, col) { const cy = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]); const n = [0, 1, 0]; const i = mb.vert(a, n, col), j = mb.vert(b, n, col), k = mb.vert(c, n, col); if (cy >= 0) mb.tri(i, j, k); else mb.tri(i, k, j); }
function upQuad(mb, a, b, c, d, col) { upTri(mb, a, b, c, col); upTri(mb, a, c, d, col); }

// ---------- trecho de rua entre dois cruzamentos (eixo local X, comprimento L) ----------
export function streetMesh(p) {
  const mb = new MeshBuilder(); const L = p.L, toxic = p.toxic; const asph = toxic ? hex(0x45443f) : ASPH;
  B(mb, 0, -0.1, 0, L + 0.02, 0.16, CW, asph);
  for (const s of [-1, 1]) { B(mb, 0, -0.1, s * (CW / 2 + SWK / 2 + 0.08), L + 0.02, 0.24, SWK - 0.16, SIDE); B(mb, 0, -0.1, s * (CW / 2 + 0.08), L + 0.02, 0.25, 0.16, CURB);
    for (let x = -L / 2 + 2; x < L / 2 - 0.5; x += 2) B(mb, x, 0.14, s * (CW / 2 + SWK / 2 + 0.08), 0.04, 0.004, SWK - 0.2, JOINT); }
  mb.setColor(WHITE, STONE); const fade = toxic ? 0.55 : 1;
  for (let x = -L / 2 + 4.5; x < L / 2 - 4; x += 5.5) B(mb, x, 0.06, 0, 2.6, 0.006, 0.14, shade(WHITE, fade));
  for (const [on, sx] of [[p.zA, -1], [p.zB, 1]]) if (on) for (let k = 0; k < 6; k++) B(mb, sx * (L / 2 - 1.7), 0.06, -CW / 2 + 0.6 + k * 1.16, 2.4, 0.006, 0.55, shade(WHITE, fade));
  return mb.build();
}
// ---------- cruzamento (quadrado de HC×2); braços: [+x, -x, +z, -z] ----------
export function crossMesh(p) {
  const mb = new MeshBuilder(); const a = p.arms, asph = p.toxic ? hex(0x45443f) : ASPH;
  B(mb, 0, -0.1, 0, CW + 0.02, 0.16, CW + 0.02, asph);
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  dirs.forEach(([dx, dz], k) => { const cx = dx * (CW / 2 + SWK / 2), cz = dz * (CW / 2 + SWK / 2); const sx = dx ? SWK : CW, sz = dx ? CW : SWK;
    if (a[k]) B(mb, cx, -0.1, cz, sx + 0.02, 0.16, sz + 0.02, asph);
    else { B(mb, cx, -0.1, cz, sx, 0.24, sz, SIDE); B(mb, dx * (CW / 2 + 0.08), -0.1, dz * (CW / 2 + 0.08), dx ? 0.16 : CW, 0.25, dx ? CW : 0.16, CURB); } });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) B(mb, sx * (CW / 2 + SWK / 2), -0.1, sz * (CW / 2 + SWK / 2), SWK, 0.24, SWK, SIDE);
  return mb.build();
}
// ---------- cerca de madeira (eixo local X) ----------
export function fenceMesh(len, toxic) {
  const mb = new MeshBuilder(); const c = toxic ? hex(0x5e4a38) : WOODC; const n = Math.max(1, Math.ceil(len / 2.4));
  for (let k = 0; k <= n; k++) B(mb, -len / 2 + k * len / n, -0.2, 0, 0.13, 1.32, 0.13, shade(c, 0.85), WOOD);
  for (const y of [0.42, 0.86]) B(mb, 0, y, 0, len, 0.1, 0.05, c, WOOD);
  return mb.build();
}
// ---------- árvores de quintal (copa arredondada low-poly, pinheiro ou seca) ----------
export function yardTreeMesh(seed, kind) {
  const mb = new MeshBuilder(); const r = rng(seed * 13 + 1); const trunk = hex(0x5a4030);
  if (kind === 'pine') { mb.setColor(trunk, WOOD); mb.cylinder(M(), 0.2, 0.15, 1.6, 6, trunk); const g = shade(hex(0x3a6a34), 0.85 + r() * 0.3);
    for (let k = 0; k < 4; k++) { mb.setColor(shade(g, 1 + k * 0.05), 0.83); mb.cylinder(M(0, 1.1 + k * 1.15, 0, r() * 3), 1.9 - k * 0.38, 0.05, 1.9, 7, shade(g, 1 + k * 0.05)); } return mb.build(); }
  if (kind === 'dead') { mb.setColor(hex(0x4a3c30), WOOD); mb.cylinder(M(), 0.2, 0.12, 4.0, 6, hex(0x4a3c30)); for (let k = 0; k < 4; k++) mb.cylinder(M(0, 2 + k * 0.5, 0, k * 1.7, 1, 0.9, 0), 0.08, 0.03, 1.4, 4, hex(0x4a3c30)); return mb.build(); }
  mb.setColor(trunk, WOOD); mb.cylinder(M(), 0.22, 0.16, 2.2, 6, trunk); const g = [hex(0x4f8a3a), hex(0x5e9440), hex(0x3f7434), hex(0x6a9a3c)][Math.floor(r() * 4)];
  const blobs = [[0, 3.1, 0, 1.7], [0.8, 2.6, 0.3, 1.2], [-0.7, 2.7, -0.4, 1.25], [0.1, 3.9, 0.2, 1.1]];
  for (const [x, y, z, s] of blobs) { const c = shade(g, 0.88 + r() * 0.25); mb.setColor(c, 0.83); mb.sphere(M(x, y, z, r() * 6), s, 6, 4, c); }
  return mb.build();
}
// ---------- caixa d'água (torre) ----------
export function waterTowerMesh() {
  const mb = new MeshBuilder(); const leg = hex(0x5c3f2c), tank = hex(0xd9d6cf), roof = hex(0x8e8a84);
  for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) { mb.setColor(leg, WOOD); mb.box(M(sx * 2.0, 6, sz * 2.0, 0, 1, sz * 0.06, -sx * 0.06), 0.3, 12, 0.3, leg); }
  for (let k = 0; k < 4; k++) for (const s of [-1, 1]) { const y = 1.5 + k * 2.8, w = 4.4 - k * 0.3; B(mb, 0, y, s * (w / 2), w, 0.15, 0.15, shade(leg, 0.9), WOOD); B(mb, s * (w / 2), y, 0, 0.15, 0.15, w, shade(leg, 0.9), WOOD);
    mb.setColor(shade(leg, 0.8), WOOD); mb.box(M(0, y + 1.4, s * (w / 2), 0, 1, 0, 0.55 * (k % 2 ? 1 : -1)), w * 1.1, 0.08, 0.08, shade(leg, 0.8)); }
  B(mb, 0, 11.9, 0, 5.6, 0.25, 5.6, shade(leg, 0.85), WOOD);
  mb.setColor(tank, MET); mb.cylinder(M(0, 12.1, 0), 3.0, 3.0, 4.2, 18, tank); for (let k = 1; k < 4; k++) { mb.setColor(shade(tank, 0.82), MET); mb.cylinder(M(0, 12.1 + k * 1.05, 0), 3.04, 3.04, 0.08, 18, shade(tank, 0.82)); }
  mb.setColor(roof, MET); mb.cylinder(M(0, 16.3, 0), 3.25, 0.25, 1.7, 18, roof); mb.cylinder(M(0, 18.0, 0), 0.1, 0.1, 0.8, 5, roof);
  for (let k = 0; k < 16; k++) B(mb, 2.35, 0.3 + k * 0.75, 2.35, 0.5, 0.05, 0.05, hex(0x6a6a6a), MET);
  return mb.build();
}
export function tiresMesh(seed) { const mb = new MeshBuilder(); const r = rng(seed); const n = 3 + Math.floor(r() * 3); mb.setColor(hex(0x1c1c1e), 0.7);
  for (let k = 0; k < n; k++) mb.cylinder(M((r() - 0.5) * 0.08, k * 0.24, (r() - 0.5) * 0.08), 0.38, 0.38, 0.23, 12, hex(0x1c1c1e)); mb.setColor(hex(0x2a2a2c), 0.7); mb.cylinder(M(0, n * 0.24, 0), 0.2, 0.2, 0.01, 10, hex(0x0c0c0c)); return mb.build(); }

// ---------- letreiros com letras de blocos ----------
const FONT = { A: '01110,10001,10001,11111,10001,10001,10001', C: '01111,10000,10000,10000,10000,10000,01111', E: '11111,10000,10000,11110,10000,10000,11111', G: '01111,10000,10000,10011,10001,10001,01111',
  I: '11111,00100,00100,00100,00100,00100,11111', J: '00111,00010,00010,00010,00010,10010,01100', L: '10000,10000,10000,10000,10000,10000,11111', M: '10001,11011,10101,10101,10001,10001,10001',
  O: '01110,10001,10001,10001,10001,10001,01110', R: '11110,10001,10001,11110,10100,10010,10001', S: '01111,10000,10000,01110,00001,00001,11110', T: '11111,00100,00100,00100,00100,00100,00100', P: '11110,10001,10001,11110,10000,10000,10000' };
// texto centrado em (cx, cy) no plano z = zf (virado para +Z), altura total h
export function signText(mb, text, cx, cy, zf, h, col) {
  const px = h / 7, adv = px * 6, w0 = text.length * adv - px; mb.setColor(col, 0.02);
  [...text].forEach((ch, i) => { const g = FONT[ch]; if (!g) return; const rows = g.split(','); const x0 = cx - w0 / 2 + i * adv;
    rows.forEach((row, ry) => { for (let rx = 0; rx < 5; rx++) if (row[rx] === '1') mb.box(M(x0 + rx * px + px / 2, cy + h / 2 - ry * px - px / 2, zf), px * 1.02, px * 1.02, 0.05, col); }); });
}
// fachada extra dos prédios especiais (coordenadas locais do prédio, frente +Z); devolve colisores locais extras
export function facadeExtras(mb, b, FH) {
  const W = b.w, D = b.d, hd = D / 2, r = rng(b.seed * 3 + 1); const out = [];
  if (b.style === 'shop') { // toldo listrado vermelho/branco + letreiro "LOJA"
    const yA = 2.7; for (let k = 0; k < Math.round(W / 0.8); k++) { const c = k % 2 ? hex(0xf2efe8) : hex(0xc8302a); mb.setColor(c, 0.83); mb.box(M(-W / 2 + 0.4 + k * 0.8, yA, hd + 0.75, 0, 1, -0.35, 0), 0.8, 0.06, 1.6, c); }
    B(mb, 0, FH * b.floors - 0.2, hd + 0.12, W * 0.55, 1.3, 0.16, hex(0xc8302a)); signText(mb, 'LOJA', 0, FH * b.floors + 0.45, hd + 0.22, 0.85, hex(0xffffff));
    B(mb, 0, 0.9, hd + 0.17, W * 0.62, 1.3, 0.04, hex(0x24303a), MET); }
  else if (b.style === 'garage') { // portões de enrolar + letreiro "GARAGEM"
    B(mb, 0, FH - 0.55, hd + 0.12, W - 0.4, 1.2, 0.16, hex(0x2a4a9a)); signText(mb, 'GARAGEM', 0, FH - 0.55 + 0.6, hd + 0.22, 0.75, hex(0xffffff));
    for (const s of [-1, 1]) { const x = s * W * 0.28; B(mb, x, 0.05, hd + 0.16, W * 0.3, 2.9, 0.06, hex(0x9aa0a6), MET); for (let k = 0; k < 9; k++) B(mb, x, 0.2 + k * 0.32, hd + 0.2, W * 0.3, 0.03, 0.03, hex(0x6a7076), MET); } }
  else if (b.style === 'church') { // fachada na parede +X: torre com sino, agulha e cruz; porta de madeira
    const T = 3.4, tx = W / 2 - T / 2 - 0.2, H0 = FH * b.floors; B(mb, tx, H0 - 0.3, 0, T, 5.8, T, hex(0xe8e4da)); B(mb, tx, H0 + 5.5, 0, T + 0.3, 0.25, T + 0.3, hex(0xd6d2c8));
    for (const [dx, dz] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) B(mb, tx + dx * (T / 2 + 0.01), H0 + 3.3, dz * (T / 2 + 0.01), dx ? 0.04 : 1.0, 1.6, dx ? 1.0 : 0.04, hex(0x2a2622));
    mb.setColor(hex(0x2e2c2e), STONE); mb.cylinder(M(tx, H0 + 5.75, 0, Math.PI / 4), T * 0.74, 0.05, 4.2, 4, hex(0x2e2c2e));
    B(mb, tx, H0 + 9.9, 0, 0.16, 1.6, 0.16, hex(0xe0e0e0), MET); B(mb, tx, H0 + 10.85, 0, 0.16, 0.16, 0.9, hex(0xe0e0e0), MET);
    B(mb, W / 2 + 0.5, 2.55, 0, 1.0, 0.12, 2.2, hex(0xd6d2c8)); }
  return out;
}

// ---------- faixa de estrada (asfalto ou terra) acompanhando o terreno; p.s = [[x, z, tx, tz, s], ...] ----------
export function roadStripMesh(p, world) {
  const mb = new MeshBuilder(); const hw = p.w / 2, dirt = p.surf === 'dirt', S = p.s; const H = (x, z) => world.height0(x, z);
  const rows = S.map(([x, z, tx, tz]) => { const nx = -tz, nz = tx; const L = [x + nx * hw, z + nz * hw], R = [x - nx * hw, z - nz * hw]; return { x, z, nx, nz, L: [L[0], H(L[0], L[1]) + 0.1, L[1]], C: [x, H(x, z) + 0.1, z], R: [R[0], H(R[0], R[1]) + 0.1, R[1]] }; });
  const r = rng(Math.floor(S[0][0] * 7 + S[0][1] * 13) >>> 0);
  for (let k = 0; k < rows.length - 1; k++) { const a = rows[k], b = rows[k + 1]; const c = dirt ? shade(DIRT, 0.9 + r() * 0.15) : shade(p.toxic ? hex(0x45443f) : ASPH, 0.96 + r() * 0.06);
    mb.setColor(c, dirt ? 0.93 : STONE); upQuad(mb, a.L, b.L, b.C, a.C, c); upQuad(mb, a.C, b.C, b.R, a.R, c); }
  if (!dirt) { const lineQ = (off, wdt, c, keep) => { for (let k = 0; k < rows.length - 1; k++) { if (keep && !keep(S[k][4], S[k + 1][4])) continue; const a = rows[k], b = rows[k + 1];
        const P = (q, o) => { const t = (o - -hw) / (2 * hw); const y = o > 0 ? q.C[1] + (q.L[1] - q.C[1]) * (o / hw) : q.C[1] + (q.R[1] - q.C[1]) * (-o / hw); return [q.x + q.nx * o, y + 0.012, q.z + q.nz * o]; };
        mb.setColor(c, STONE); upQuad(mb, P(a, off - wdt / 2), P(b, off - wdt / 2), P(b, off + wdt / 2), P(a, off + wdt / 2), c); } };
    lineQ(0, 0.14, p.hwy ? hex(0xe8c440) : WHITE, (s0) => (s0 % 9) < 3.6);
    if (p.hwy) for (const s of [-1, 1]) lineQ(s * (hw - 0.35), 0.13, WHITE, null); }
  return mb.build();
}
// guard-rail das pontes/aterros sobre a água (pontos em mundo: a → b)
export function railMesh(p, world) {
  const mb = new MeshBuilder(); const [ax, az] = p.a, [bx, bz] = p.b; const L = Math.hypot(bx - ax, bz - az); const n = Math.max(1, Math.ceil(L / 2)); const steel = hex(0xa8acb0), post = hex(0x5a5e62);
  const pts = []; for (let k = 0; k <= n; k++) { const t = k / n, x = ax + (bx - ax) * t, z = az + (bz - az) * t; pts.push([x, world.height0(x, z), z]); }
  for (const q of pts) { mb.setColor(post, MET); mb.box(M(q[0], q[1] + 0.45, q[2]), 0.14, 1.0, 0.14, post); }
  const yaw = Math.atan2(bx - ax, bz - az);
  for (let k = 0; k < n; k++) { const a = pts[k], b = pts[k + 1]; const len = Math.hypot(b[0] - a[0], b[2] - a[2]), pitch = Math.atan2(b[1] - a[1], len);
    mb.setColor(steel, MET); mb.box(M((a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + 0.78, (a[2] + b[2]) / 2, yaw, 1, -pitch, 0), 0.06, 0.3, len + 0.05, steel); }
  return mb.build();
}
// ---------- cachoeira: lâmina (lábio → poço), lago de cima e o riacho ----------
export function fallMeshes(f) {
  const out = {}; const wc = hex(0x3d7f96), foam = hex(0xe8f4f8);
  { const mb = new MeshBuilder(); const N = 14, wid = f.width; const ux = f.ux, uz = f.uz, px = -uz, pz = ux; const top = f.ws, bot = 0.15; // lâmina curva: sai do lábio e cai até o poço
    const P = (t, s) => { const y = top + (bot - top) * t; const out2 = 0.6 + 2.2 * t * t; return [f.x + ux * out2 + px * s, y, f.z + uz * out2 + pz * s]; };
    for (let k = 0; k < N; k++) { const t0 = k / N, t1 = (k + 1) / N; for (let j = 0; j < 4; j++) { const s0 = -wid / 2 + j * wid / 4, s1 = s0 + wid / 4; const c = shade(k % 2 ? hex(0xb4d6e2) : hex(0x9cc6d8), 0.92 + 0.1 * Math.sin(j * 2.1 + k));
        const a = P(t0, s0), b = P(t0, s1), cc = P(t1, s1), d = P(t1, s0); const n = [ux, 0.3, uz]; mb.setColor(c, 0.02); const i0 = mb.vert(a, n, c), i1 = mb.vert(b, n, c), i2 = mb.vert(cc, n, c), i3 = mb.vert(d, n, c); mb.tri(i0, i1, i2); mb.tri(i0, i2, i3); } }
    out.sheet = mb.build(); }
  { const mb = new MeshBuilder(); const n = [0, 1, 0]; mb.setColor(wc, 0.02); const c = mb.vert([f.px, f.ws, f.pz], n, wc); const K = 20; const ring = [];
    for (let k = 0; k < K; k++) { const a = k / K * 6.2832; ring.push(mb.vert([f.px + Math.cos(a) * (f.pr + 1.2), f.ws, f.pz + Math.sin(a) * (f.pr + 1.2)], n, wc)); }
    for (let k = 0; k < K; k++) mb.tri(c, ring[(k + 1) % K], ring[k]);
    // canal do lago até o lábio
    const ux = f.ux, uz = f.uz, px = -uz, pz = ux; const q = (t, s) => [f.px + (f.x - f.px) * t + px * s, f.ws, f.pz + (f.z - f.pz) * t + pz * s];
    upQuad(mb, q(0, -1.9), q(1.02, -1.9), q(1.02, 1.9), q(0, 1.9), wc);
    // riacho que desce até o lago
    const st = f.stream; for (let k = 0; k < st.length - 1; k++) { const [x0, z0, y0] = st[k], [x1, z1, y1] = st[k + 1]; const dx = x1 - x0, dz = z1 - z0, l = Math.hypot(dx, dz) || 1; const nx = -dz / l * 1.6, nz = dx / l * 1.6;
      upQuad(mb, [x0 + nx, y0, z0 + nz], [x1 + nx, y1, z1 + nz], [x1 - nx, y1, z1 - nz], [x0 - nx, y0, z0 - nz], shade(wc, 1.05)); }
    out.pond = mb.build(); }
  return out;
}

// ---------- escada vertical na lateral (+X) de hospitais, prédios e laboratórios ----------
export const LADDER_STYLES = new Set(['hospital2', 'apartment', 'lab']);
export function ladderSpec(b) {
  if (!LADDER_STYLES.has(b.style) || (b.decay || 0) > 0.3) return null;
  const hosp = b.style === 'hospital2'; const top = hosp ? 8.65 : b.floors * 4.0; const wallX = b.w / 2 + (hosp ? 0.15 : 0.15);
  return { lx: wallX + 0.06, lz: -b.d * 0.22, top, exitLx: b.w / 2 - 1.3, hosp };
}
export function ladderMesh(mb, L) { // em coordenadas locais do prédio
  const c = hex(0x8a8e92); mb.setColor(c, MET); const x = L.lx + 0.1;
  for (const s of [-0.24, 0.24]) mb.box(M(x, (L.top + 1.0) / 2, L.lz + s), 0.06, L.top + 1.0, 0.06, c);
  for (let y = 0.3; y < L.top + 0.9; y += 0.32) mb.box(M(x, y, L.lz), 0.04, 0.04, 0.5, shade(c, 0.85));
  for (let y = 1.2; y < L.top - 0.5; y += 2.4) mb.box(M(L.lx + 0.04, y, L.lz), 0.12, 0.05, 0.6, shade(c, 0.7));
}
export function ladderWorld(b) { const L = ladderSpec(b); if (!L) return null; const cr = Math.cos(b.rot), sr = Math.sin(b.rot); const W = (lx, lz) => [b.x + lx * cr + lz * sr, b.z - lx * sr + lz * cr];
  const [x, z] = W(L.lx + 0.55, L.lz), [ex, ez] = W(L.exitLx, L.lz); return { x, z, nx: cr, nz: -sr, y0: b.y, y1: b.y + L.top, ex, ez, b }; }
