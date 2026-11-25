// Modelos 3D procedurais do cenário, ferramentas e construções (malhas reais, com faces e normais).
import { MeshBuilder, M, hex, shade } from '../engine/mesh.js';
import { rng, mat4 } from '../engine/math.js';
import { interiorLayout } from './interiors.js';
import { suburbHouseMesh, hospitalMesh } from './houses.js';
import { facadeExtras, ladderSpec, ladderMesh } from './town.js';

import { ATLAS, UV_SOLID } from './textures.js';
const leafCol = (base) => (y, r) => shade(base, 0.8 + r() * 0.35 + y * 0.015);
const nrm = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
// normal "esférica" da copa: ilumina a folhagem como um volume macio e não como planos soltos
const sphereN = (c, up = 0.45) => (p) => nrm([p[0] - c[0], p[1] - c[1] + up, p[2] - c[2]]);
const W = [1, 1, 1];
function vb() { const mb = new MeshBuilder(); mb.uvSolid = UV_SOLID; return mb; }
// cartão de folhas centrado em 'p', orientação aleatória
function leafCard(mb, p, size, r, region, c, nFn, aspect = 1) {
  const yaw = r() * Math.PI * 2, pitch = (r() - 0.5) * 1.4, roll = (r() - 0.5) * 0.6;
  const u0 = [Math.cos(yaw), 0, Math.sin(yaw)], f = [-Math.sin(yaw), 0, Math.cos(yaw)];
  let v = [f[0] * Math.sin(pitch), Math.cos(pitch), f[2] * Math.sin(pitch)];
  const u = [u0[0] * Math.cos(roll) + v[0] * Math.sin(roll), u0[1] * Math.cos(roll) + v[1] * Math.sin(roll), u0[2] * Math.cos(roll) + v[2] * Math.sin(roll)];
  v = [v[0] * Math.cos(roll) - u0[0] * Math.sin(roll), v[1] * Math.cos(roll) - u0[1] * Math.sin(roll), v[2] * Math.cos(roll) - u0[2] * Math.sin(roll)];
  const hw = size / 2, hh = size * aspect / 2;
  const P = (a, b) => [p[0] + u[0] * a + v[0] * b, p[1] + u[1] * a + v[1] * b, p[2] + u[2] * a + v[2] * b];
  mb.quadUV([P(-hw, -hh), P(hw, -hh), P(hw, hh), P(-hw, hh)], region, c, nFn);
}
// copa: cartões distribuídos em elipsoides; interior mais escuro (oclusão da própria copa)
function canopy(mb, r, blobs, region, cards, size, center, tint = W) {
  const nFn = sphereN(center);
  for (const [x, y, z, s] of blobs) {
    const n = Math.round(cards * s * s / 4);
    for (let i = 0; i < n; i++) {
      const a = r() * Math.PI * 2, e = Math.acos(1 - 2 * r()), d = Math.cbrt(r()) * s;
      const p = [x + Math.sin(e) * Math.cos(a) * d, y + Math.cos(e) * d * 0.75, z + Math.sin(e) * Math.sin(a) * d];
      const out = Math.min(1, Math.hypot(p[0] - center[0], (p[1] - center[1]) * 1.3, p[2] - center[2]) / (s + 1.2));
      const k = (0.5 + 0.55 * out) * (0.9 + r() * 0.2);
      mb.flex = 1; leafCard(mb, p, size * (0.8 + r() * 0.45), r, region, [tint[0] * k, tint[1] * k, tint[2] * k], nFn);
    }
  }
}
function branches(mb, r, n, y0, y1, len, rad, col) {
  mb.setColor(col, 0.15);
  for (let i = 0; i < n; i++) { const a = i * 2.39996 + r(), y = y0 + (y1 - y0) * (i / Math.max(1, n - 1));
    mb.cylinder(M(0, y, 0, -a, 1, 0, 0.75 + r() * 0.5), rad, rad * 0.35, len * (0.8 + r() * 0.4), 5, col, false); }
}

export function treeMesh(type, seed = 1, lod = false) {
  if (type === 'cactus') return cactusMesh(seed);
  const mb = vb(); const r = rng(seed);
  const bark = hex(0x5b4330), barkD = hex(0x45331f);
  const q = lod ? 0.28 : 1; // densidade de cartões
  if (type === 'oak') {
    mb.setColor(bark, 0.1); mb.cylinder(M(), 0.36, 0.22, 4.8, lod ? 6 : 12, bark, false, (a, t) => 1 + 0.1 * Math.sin(a * 3 + t * 4) + (t < 0.15 ? (0.15 - t) * 1.6 : 0));
    if (!lod) branches(mb, r, 6, 3.2, 4.6, 2.4, 0.13, barkD);
    const blobs = [[0, 6.8, 0, 2.7], [1.7, 5.9, 0.6, 2.1], [-1.6, 6.0, -0.4, 2.2], [0.3, 5.7, -1.7, 2.0], [-0.4, 5.8, 1.7, 2.0], [0.6, 8.0, 0.3, 1.8]];
    canopy(mb, r, blobs, ATLAS.oak, 15 * q, lod ? 3.4 : 2.3, [0, 6.4, 0]);
  } else if (type === 'pine') {
    mb.setColor(barkD, 0.1); mb.cylinder(M(), 0.34, 0.06, 12, lod ? 5 : 10, barkD, false, (a, t) => 1 + 0.05 * Math.sin(a * 5 + t * 9));
    const tiers = lod ? 4 : 9;
    for (let i = 0; i < tiers; i++) {
      const t = i / (tiers - 1), y = 2.6 + t * 8.6, len = 3.0 * (1 - t) + 0.6; const nb = lod ? 4 : 6 + (i % 2);
      for (let k = 0; k < nb; k++) {
        const a = (k / nb) * Math.PI * 2 + i * 0.7 + r() * 0.3; const k2 = 0.75 + r() * 0.3;
        mb.flex = 1; mb.card(M(0, y, 0, a, 1, Math.PI / 2 + 0.25 + t * 0.2, 0), len * 0.75, len, ATLAS.pine, [k2 * (0.75 + 0.3 * t), k2 * (0.8 + 0.3 * t), k2 * (0.75 + 0.3 * t)], (p) => nrm([p[0], 0.9, p[2]]), lod ? 1 : 2, -len * 0.18);
      }
    }
    for (let k = 0; k < 3; k++) { mb.flex = 1; mb.card(M(0, 10.6, 0, k * 1.05), 0.9, 1.8, ATLAS.pine, W, (p) => nrm([p[0], 1, p[2]])); }
  } else if (type === 'birch') {
    const w = hex(0xd9d4c5); mb.setColor(w, 0.1); mb.cylinder(M(), 0.22, 0.13, 7.8, lod ? 5 : 10, w, false);
    if (!lod) for (let i = 0; i < 12; i++) { mb.setColor(hex(0x2a2a28), 0.1); mb.box(M(0, 0.5 + i * 0.6 + r() * 0.2, 0, r() * 6.28), 0.45 - i * 0.015, 0.03 + r() * 0.03, 0.12, hex(0x2a2a28)); }
    if (!lod) branches(mb, r, 5, 4.5, 6.8, 1.6, 0.07, w);
    canopy(mb, r, [[0, 7.6, 0, 1.8], [0.9, 6.5, 0.3, 1.5], [-0.8, 6.6, -0.4, 1.5], [0.2, 5.6, 0.9, 1.3], [-0.2, 5.5, -1.0, 1.3]], ATLAS.birch, 18 * q, lod ? 2.8 : 1.8, [0, 6.6, 0]);
  } else if (type === 'dead') {
    const c = hex(0x6a5f52); mb.setColor(c, 0.1); mb.cylinder(M(), 0.35, 0.12, 6.5, 8, c, false, (a) => 1 + 0.15 * Math.sin(a * 4));
    for (let i = 0; i < 6; i++) { const a = r() * 6.28; mb.cylinder(M(0, 2.5 + i * 0.7, 0, a, 1, 0, 0.9 + r() * 0.4), 0.09, 0.02, 1.6 + r(), 5, c, false); }
  } else if (type === 'palm') {
    const c = hex(0x8a7352); let x = 0, y = 0, lean = 0;
    for (let i = 0; i < 7; i++) { mb.setColor(c, 0.1); mb.cylinder(M(x, y, 0, 0, 1, 0, -lean), 0.24 - i * 0.015, 0.22 - i * 0.015, 1.1, 8, shade(c, i % 2 ? 0.9 : 1.05), false); x += Math.sin(lean) * 1.1; y += Math.cos(lean) * 1.05; lean += 0.05; }
    for (let i = 0; i < 11; i++) { const a = (i / 11) * Math.PI * 2 + r() * 0.2; mb.flex = 1;
      mb.card(M(x, y + 0.1, 0, a, 1, Math.PI / 2 - 0.5 + r() * 0.3, 0), 1.3, 3.4, ATLAS.palm, W, (p) => nrm([p[0] - x, 1.2, p[2]]), 4, -1.6); }
    mb.setColor(hex(0x5a4a2a), 0.1); mb.sphere(M(x, y - 0.1, 0), 0.3, 6, 4, hex(0x5a4a2a));
  }
  return mb.build();
}
export function treeLodMesh(type, seed = 1) { return type === 'palm' ? treeMesh(type, seed) : treeMesh(type, seed, true); }
export const TREE_INFO = { oak: { r: 0.36, h: 9 }, pine: { r: 0.34, h: 12 }, birch: { r: 0.24, h: 9 }, dead: { r: 0.36, h: 7 }, palm: { r: 0.26, h: 8 }, cactus: { r: 0.3, h: 4 } };

export function stumpMesh() { const mb = new MeshBuilder(); mb.flex = 0.63; mb.cylinder(M(), 0.44, 0.4, 0.55, 9, hex(0x5b4330)); mb.cylinder(M(0, 0.55, 0), 0.38, 0.38, 0.01, 9, hex(0xc9a776)); return mb.build(); }
export function logMesh() { const mb = new MeshBuilder(); mb.flex = 0.63; const m = M(-1.2, 0.28, 0, 0, 1, 0, -Math.PI / 2); mb.cylinder(m, 0.28, 0.26, 2.4, 9, hex(0x5b4330)); return mb.build(); }
export function fallingTreeMesh(type, seed) { return treeMesh(type, seed); }

export function rockMesh(seed, rich = false) {
  // rocha natural com material de pedra (alfa 0.93): musgo no topo, veios de minério nas ricas
  const mb = new MeshBuilder(); const r = rng(seed); const g = hex(0x8a857c), gD = hex(0x6e6a62), moss = hex(0x56693a), ore = hex(0xb07a3a); mb.flex = 0.93;
  const col = (y, dir, rr) => { const top = Math.max(0, dir[1]); const n = rr(); let c = shade(n < 0.5 ? g : gD, 0.85 + n * 0.3);
    if (top > 0.55 && rr() < 0.75) c = shade(moss, 0.85 + rr() * 0.3); else if (rich && rr() < 0.18) c = shade(ore, 0.9 + rr() * 0.2); return c; };
  mb.rockSmooth(M(0, 0.42, 0, 0, [1.3, 0.85, 1.05]), 1, 3, 0.42, g, r, col, 0.42);
  mb.rockSmooth(M(0.85, 0.2, 0.45, r() * 6), 0.42, 2, 0.4, g, r, col, 0.3);
  mb.rockSmooth(M(-0.6, 0.12, -0.55, r() * 6), 0.26, 2, 0.4, g, r, col, 0.3);
  return mb.build();
}
export function bushMesh(berries, seed = 5) {
  const mb = vb(); const r = rng(seed);
  canopy(mb, r, [[0, 0.55, 0, 0.75], [0.5, 0.45, 0.2, 0.6], [-0.45, 0.45, -0.1, 0.6], [0.1, 0.4, -0.5, 0.55], [-0.1, 0.45, 0.5, 0.55]], ATLAS.oak, 30, 0.9, [0, 0.3, 0], [0.9, 0.95, 0.85]);
  for (let i = 0; i < 6; i++) { mb.flex = 0.6; mb.card(M((r() - 0.5) * 0.6, 0, (r() - 0.5) * 0.6, r() * 6.28, 1, (r() - 0.5) * 0.5), 1.0, 0.9, ATLAS.fern, W, () => [0, 1, 0]); }
  if (berries) { const c = hex(0xc0242c); for (let i = 0; i < 18; i++) { const a = r() * 6.28, h = 0.3 + r() * 0.6, d = 0.55 + r() * 0.25; mb.flex = 0.3; mb.sphere(M(Math.cos(a) * d, h, Math.sin(a) * d), 0.06, 6, 5, i % 3 ? c : hex(0x6a1830)); } }
  return mb.build();
}
export function pickupMesh(kind) {
  const mb = new MeshBuilder(); const r = rng(kind.length * 31);
  if (kind === 'stick') { mb.cylinder(M(-0.45, 0.05, 0, 0, 1, 0, -Math.PI / 2), 0.035, 0.025, 0.9, 5, hex(0x6b4f33)); mb.cylinder(M(0.1, 0.05, 0, 0.6, 1, 0, -Math.PI / 2), 0.02, 0.012, 0.3, 4, hex(0x6b4f33)); }
  else if (kind === 'stone') { mb.flex = 0.93; mb.rockSmooth(M(0, 0.07, 0, 0, [1.2, 0.7, 1]), 0.14, 2, 0.4, hex(0x8a857c), r, null, 0.3); mb.rockSmooth(M(0.18, 0.04, 0.1), 0.08, 1, 0.4, hex(0x77726a), r, null, 0.3); }
  else if (kind === 'fiber') { mb.flex = 1; for (let i = 0; i < 9; i++) { const a = r() * 6.28; mb.blade(M(Math.cos(a) * 0.08, 0, Math.sin(a) * 0.08, a, 1, (r() - 0.5) * 0.4), 0.08, 0.7 + r() * 0.5, hex(0x8a9a3e), hex(0xc8c070)); } }
  else if (kind === 'mushroom') { for (let i = 0; i < 3; i++) { const x = (i - 1) * 0.12, s = 1 - i * 0.2; mb.cylinder(M(x, 0, i * 0.05), 0.025 * s, 0.02 * s, 0.14 * s, 6, hex(0xe8e0cc)); mb.sphere(M(x, 0.14 * s, i * 0.05), 0.07 * s, 8, 5, hex(0xb5452a), 0.55); } }
  else if (kind === 'crystal') { for (let i = 0; i < 5; i++) { const a = i * 1.3; mb.cylinder(M(Math.cos(a) * 0.12, 0, Math.sin(a) * 0.12, a, 1, Math.cos(a) * 0.4, Math.sin(a) * 0.4), 0.07, 0.0, 0.5 + r() * 0.3, 5, hex(0x7ad8ff)); } }
  else if (kind === 'bag') { mb.sphere(M(0, 0.2, 0, 0, [1, 0.8, 0.9]), 0.25, 8, 6, hex(0x7a6440)); mb.cylinder(M(0, 0.35, 0), 0.08, 0.05, 0.12, 6, hex(0x5a4a30)); }
  else if (kind === 'meat') { mb.sphere(M(0, 0.1, 0, 0, [1.4, 0.6, 1]), 0.14, 7, 5, hex(0xa83a3a)); mb.cylinder(M(0.15, 0.08, 0, 0, 1, 0, -Math.PI / 2), 0.025, 0.025, 0.2, 5, hex(0xeae0d0)); }
  return mb.build();
}
export function grassMesh(seed = 1) {
  const mb = vb(); const r = rng(seed);
  for (let i = 0; i < 3; i++) { const k = 0.85 + r() * 0.25; mb.flex = 1; mb.card(M((r() - 0.5) * 0.2, 0, (r() - 0.5) * 0.2, i * 1.05 + r() * 0.3, 1, (r() - 0.5) * 0.2), 0.9, 0.55 + r() * 0.15, ATLAS.grass, [k, k, k], () => [0, 1, 0]); }
  return mb.build();
}
export function flowerMesh(seed = 2) {
  const mb = vb(); const r = rng(seed);
  for (let i = 0; i < 2; i++) { mb.flex = 1; mb.card(M(0, 0, 0, i * 1.57 + r() * 0.3), 0.8, 0.55, ATLAS.flowers, W, () => [0, 1, 0]); }
  return mb.build();
}
export function crateMesh() {
  const mb = new MeshBuilder(); mb.flex = 0.63; const w = hex(0x6a5a3a), d = hex(0x4a3c26);
  mb.box(M(0, 0.4, 0), 1.0, 0.8, 0.7, w);
  for (const y of [0.05, 0.75]) { mb.box(M(0, y, 0.355), 1.04, 0.1, 0.03, d); mb.box(M(0, y, -0.355), 1.04, 0.1, 0.03, d); }
  mb.box(M(0.5, 0.4, 0), 0.03, 0.8, 0.74, d); mb.box(M(-0.5, 0.4, 0), 0.03, 0.8, 0.74, d);
  mb.box(M(0, 0.4, 0.36, 0, 1, 0, 0.67), 1.2, 0.08, 0.02, d);
  mb.flex = 0.5; mb.box(M(0, 0.81, 0), 0.4, 0.02, 0.15, hex(0xc0a050));
  return mb.build();
}

// ---------- Ruínas ----------
export function buildingMesh(b) {
  if (b.style === 'suburb') return suburbHouseMesh(b); if (b.style === 'hospital2') return hospitalMesh(b);
  const mb = new MeshBuilder(); const r = rng(b.seed); const colliders = []; const glass = [];
  const STY = { house: [hex(0xc9b896), hex(0xd2c3a3), hex(0xb9a888), hex(0xcfc0a0), hex(0xa8b4a0), hex(0xc8a890), hex(0xb0b8c0), hex(0xe0d8c8)], apartment: [hex(0xa8a296), hex(0xb89a82), hex(0x9aa0a4), hex(0xc0b4a0)], warehouse: [hex(0x7f8a90), hex(0x8a8f86)], barracks: [hex(0x6b6a50), hex(0x75735a)], bunker: [hex(0x8a8a86)], office: [hex(0xa29c90)], hospital: [hex(0xe8e6e0), hex(0xdcdad4)], pharmacy: [hex(0xe4e2da), hex(0xd8dcd0)], lab: [hex(0xd0d2d4), hex(0xc4c8cc)], hangar: [hex(0x5d6248), hex(0x6a6e54)], shop: [hex(0xd8c9a8), hex(0xcdbb98), hex(0xe2d6bc)], garage: [hex(0xc8ccd0), hex(0xb8bec4)], church: [hex(0xeeebe4), hex(0xe6e2d8)] };
  if (b.style === 'apartment') STY.apartment.push(hex(0xa8402e), hex(0x9a3a2a), hex(0x4a5e8a), hex(0x52668e));
  const pal = STY[b.style] || [hex(0x9a958a), hex(0xa89a80), hex(0x8a8a88), hex(0x9a8a78)]; const base = pal[Math.floor(r() * pal.length)];
  mb.flex = b.style === 'warehouse' || b.style === 'hangar' ? 0.5 : 0.93; // galpão: metal corrugado; demais: alvenaria/concreto
  // pé-direito alto (4 m) para a câmera em terceira pessoa caber dentro das construções
  const FH = b.style === 'warehouse' || b.style === 'hangar' ? 4.6 : 4.0, T = 0.3; const trimC = [hex(0xe8e4dc), hex(0x6a4a32), hex(0x3a3c3e)][Math.floor(r() * 3)]; const W = b.w, D = b.d; const tops = [];
  const cr = Math.cos(b.rot), sr = Math.sin(b.rot);
  const toW = (lx, lz) => [b.x + lx * cr + lz * sr, b.z - lx * sr + lz * cr];
  const panel = (lx, ly, lz, sx, sy, sz, c) => { mb.box(M(lx, ly + sy / 2, lz), sx, sy, sz, c); };
  // fundação
  panel(0, -0.6, 0, W + 0.4, 0.8, D + 0.4, shade(base, 0.7));
  const walls = [{ cx: 0, cz: D / 2, len: W, axis: 'x' }, { cx: 0, cz: -D / 2, len: W, axis: 'x' }, { cx: W / 2, cz: 0, len: D, axis: 'z' }, { cx: -W / 2, cz: 0, len: D, axis: 'z' }];
  const doorWall0 = Math.floor(r() * 4); const doorWall = b.doorWall ?? doorWall0;
  walls.forEach((wl, wi) => {
    const bays = Math.max(2, Math.round(wl.len / 3)); const bl = wl.len / bays; const doorBay = Math.floor(bays / 2);
    for (let k = 0; k < bays; k++) {
      const off = -wl.len / 2 + bl * (k + 0.5);
      const lx = wl.axis === 'x' ? off : wl.cx, lz = wl.axis === 'x' ? wl.cz : off;
      const sx = wl.axis === 'x' ? bl : T, sz = wl.axis === 'x' ? T : bl;
      // paredes sempre inteiras até o teto (o prédio tem estrutura; a decadência fica só na cor/sujeira)
      const hTop = b.floors * FH; r(); r();
      tops.push(hTop);
      const c = shade(base, 0.88 + r() * 0.2);
      const isDoor = wi === doorWall && k === doorBay;
      for (let f = 0; f < b.floors; f++) {
        const y0 = f * FH; if (y0 >= hTop) break; const yTop = Math.min(hTop, y0 + FH);
        const seg = (a, h, cc = c) => { if (h <= 0.02) return; const s0 = Math.max(a, y0), s1 = Math.min(a + h, yTop); if (s1 > s0) panel(lx, s0, lz, sx, s1 - s0, sz, cc); };
        const winW = bl * 0.45;
        if (isDoor && f === 0) {
          const side = (bl - 1.6) / 2; const so = (bl - side) / 2;
          const sp = (d) => { const ox = wl.axis === 'x' ? d : 0, oz = wl.axis === 'x' ? 0 : d; const ssx = wl.axis === 'x' ? side : T, ssz = wl.axis === 'x' ? T : side; mb.box(M(lx + ox, y0 + (yTop - y0) / 2, lz + oz), ssx, yTop - y0, ssz, c); };
          sp(so); sp(-so); seg(y0 + 2.4, FH - 2.4);
        } else {
          seg(y0, 0.95); seg(y0 + 2.3, FH - 2.3);
          // pilares laterais da janela
          const pw = (bl - winW) / 2, po = (bl - pw) / 2;
          for (const d of [po, -po]) { const ox = wl.axis === 'x' ? d : 0, oz = wl.axis === 'x' ? 0 : d; const s0 = y0 + 0.95, s1 = Math.min(yTop, y0 + 2.3);
            if (s1 > s0) mb.box(M(lx + ox, (s0 + s1) / 2, lz + oz), wl.axis === 'x' ? pw : T, s1 - s0, wl.axis === 'x' ? T : pw, c); }
          if (yTop > y0 + 2.3 && b.decay < 0.3) { // batente, verga e peitoril
            const ax = wl.axis === 'x'; const nz = (ax ? Math.sign(wl.cz) : Math.sign(wl.cx)) * (T / 2 + 0.03); const ox2 = ax ? 0 : nz, oz2 = ax ? nz : 0;
            mb.box(M(lx + ox2, y0 + 0.92, lz + oz2), ax ? winW + 0.2 : 0.1, 0.07, ax ? 0.1 : winW + 0.2, trimC);
            mb.box(M(lx + ox2 * 0.6, y0 + 2.32, lz + oz2 * 0.6), ax ? winW + 0.1 : 0.06, 0.08, ax ? 0.06 : winW + 0.1, trimC);
            for (const d of [winW / 2, -winW / 2]) mb.box(M(lx + (ax ? d : ox2 * 0.6), y0 + 1.62, lz + (ax ? oz2 * 0.6 : d)), 0.06, 1.36, 0.06, trimC);
            mb.box(M(lx + (ax ? 0 : ox2 * 0.6), y0 + 1.62, lz + (ax ? oz2 * 0.6 : 0)), ax ? 0.04 : 0.05, 1.36, ax ? 0.05 : 0.04, trimC);
            if (b.decay < 0.2 && r() < 0.65) { const [gx, gz] = toW(lx, lz); glass.push({ x: gx, z: gz, y: b.y + y0 + 1.62, w: winW, h: 1.36, rot: b.rot + (ax ? 0 : Math.PI / 2) }); } }
        }
      }
      // colisores (portas ficam livres)
      const [wx, wz] = toW(lx, lz);
      if (isDoor) {
        const side = (bl - 1.6) / 2; const so = (bl - side) / 2;
        for (const d of [so, -so]) { const [cx, cz] = toW(wl.axis === 'x' ? lx + d : lx, wl.axis === 'x' ? lz : lz + d);
          colliders.push({ type: 'box', x: cx, z: cz, y0: b.y - 1, y1: b.y + hTop, hx: (wl.axis === 'x' ? side : T) / 2 + 0.02, hz: (wl.axis === 'x' ? T : side) / 2 + 0.02, rot: b.rot }); }
        if (hTop > 2.4) colliders.push({ type: 'box', x: wx, z: wz, y0: b.y + 2.4, y1: b.y + hTop, hx: sx / 2, hz: sz / 2, rot: b.rot });
      } else if (hTop > 0.05) {
        // parede com janela: pilares + peitoril + verga por andar; o vão fica livre (tiros passam)
        const winW = bl * 0.45, pw = (bl - winW) / 2, po = (bl - pw) / 2, ax = wl.axis === 'x';
        for (const d of [po, -po]) { const [cx, cz] = toW(ax ? lx + d : lx, ax ? lz : lz + d); colliders.push({ type: 'box', x: cx, z: cz, y0: b.y - 1, y1: b.y + hTop, hx: (ax ? pw : T) / 2 + 0.02, hz: (ax ? T : pw) / 2 + 0.02, rot: b.rot }); }
        for (let f = 0; f < b.floors; f++) { const y0 = f * FH; if (y0 >= hTop) break; const top = Math.min(hTop, y0 + FH);
          colliders.push({ type: 'box', x: wx, z: wz, y0: b.y + (f ? y0 : -1), y1: b.y + Math.min(top, y0 + 0.95), hx: (ax ? winW : T) / 2 + 0.02, hz: (ax ? T : winW) / 2 + 0.02, rot: b.rot, sill: true });
          if (top > y0 + 2.3) colliders.push({ type: 'box', x: wx, z: wz, y0: b.y + y0 + 2.3, y1: b.y + top, hx: (ax ? winW : T) / 2 + 0.02, hz: (ax ? T : winW) / 2 + 0.02, rot: b.rot });
          else if (top > y0 + 0.95) colliders.push({ type: 'box', x: wx, z: wz, y0: b.y + y0 + 0.95, y1: b.y + top, hx: (ax ? winW : T) / 2 + 0.02, hz: (ax ? T : winW) / 2 + 0.02, rot: b.rot }); }
      }
    }
  });
  // lajes
  for (let f = 1; f <= b.floors; f++) {
    const y = f * FH; const holes = r() < b.decay + 0.2;
    const roofF = f === b.floors; // a laje do teto é sempre inteira (e dá para andar em cima); as de entre andares podem ter buracos
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) { if (!roofF && holes && r() < 0.45) continue; if (roofF) r();
      panel((i - 0.5) * W / 2, y - (roofF ? 0.35 : 0.25), (j - 0.5) * D / 2, W / 2 + (roofF ? 0.02 : 0), roofF ? 0.35 : 0.25, D / 2 + (roofF ? 0.02 : 0), shade(base, 0.75));
      const [qx, qz] = toW((i - 0.5) * W / 2, (j - 0.5) * D / 2); colliders.push({ type: 'box', x: qx, z: qz, y0: b.y + y - 0.3, y1: b.y + y, hx: W / 4, hz: D / 4, rot: b.rot, camOnly: !roofF || b.roof === 'gable', platform: roofF && b.roof !== 'gable' }); }
  }
  if (b.roof === 'gable') { // telhado de duas águas com oitões
    const th = 0.55, half = D / 2 + 0.5, rise = half * Math.tan(th), yb = b.floors * FH; mb.flex = 0.93; const tile = [hex(0x8a3f2a), hex(0x6e4a36), hex(0x5a5a5e)][Math.floor(r() * 3)];
    for (const sgn of [-1, 1]) { mb.box(M(0, yb + rise / 2 + 0.05, sgn * half / 2, 0, 1, sgn * th), W + 0.8, 0.14, half / Math.cos(th) + 0.1, tile);
      for (let k = 0; k < 6; k++) mb.box(M(0, yb + rise * (1 - (k + 0.5) / 6) + 0.14, sgn * half * (k + 0.5) / 6, 0, 1, sgn * th), W + 0.84, 0.03, 0.05, shade(tile, 0.75)); }
    for (const sx of [-1, 1]) { const x = sx * W / 2; const a = mb.vert([x, yb, -D / 2], [sx, 0, 0], base), bb = mb.vert([x, yb, D / 2], [sx, 0, 0], base), c = mb.vert([x, yb + rise, 0], [sx, 0, 0], base); if (sx > 0) mb.tri(a, c, bb); else mb.tri(a, bb, c); }
    mb.flex = 0.93; }
  else if (b.style !== 'warehouse' && b.style !== 'hangar') { const yt = b.floors * FH; // teto plano: platibanda, laje com acabamento e casa de máquinas/caixa d'água
    if (b.floors >= 2 || W * D > 90) { const cc = shade(base, 0.82); const hw = Math.min(2.6, W * 0.22), hd = Math.min(2.4, D * 0.22); const hx0 = -W / 2 + hw / 2 + 1.0, hz0 = -D / 2 + hd / 2 + 1.0;
      panel(hx0, yt, hz0, hw, 2.3, hd, cc); panel(hx0, yt + 2.3, hz0, hw + 0.25, 0.15, hd + 0.25, shade(cc, 0.8)); mb.box(M(hx0 + hw / 2 + 0.02, yt + 1.0, hz0), 0.05, 2.0, 0.9, hex(0x4a4a48));
      const [hwx, hwz] = toW(hx0, hz0); colliders.push({ type: 'box', x: hwx, z: hwz, y0: b.y + yt, y1: b.y + yt + 2.45, hx: hw / 2, hz: hd / 2, rot: b.rot });
      const tx = W / 2 - 1.6, tz = D / 2 - 1.6; for (const [px, pz] of [[-0.6, -0.6], [0.6, -0.6], [-0.6, 0.6], [0.6, 0.6]]) mb.box(M(tx + px, yt + 0.55, tz + pz), 0.1, 1.1, 0.1, hex(0x5a5a58));
      mb.cylinder(M(tx, yt + 1.1, tz), 0.85, 0.85, 1.3, 12, hex(0x3a5a8a)); const [twx, twz] = toW(tx, tz); colliders.push({ type: 'cyl', x: twx, z: twz, r: 0.9, y0: b.y + yt, y1: b.y + yt + 2.4 });
      if (W > 9) { mb.box(M(0, yt + 0.4, -D / 2 + 1.4), 1.2, 0.8, 0.9, hex(0x9a9c9e)); mb.box(M(0, yt + 0.4, -D / 2 + 1.84), 0.9, 0.6, 0.02, hex(0x3a3c3e)); } }
    for (const [cx, cz, sx2, sz2] of [[0, D / 2, W + 0.3, 0.25], [0, -D / 2, W + 0.3, 0.25], [W / 2, 0, 0.25, D], [-W / 2, 0, 0.25, D]]) {
      const [px, pz] = toW(cx, cz); colliders.push({ type: 'box', x: px, z: pz, y0: b.y + yt, y1: b.y + yt + 0.9, hx: sx2 / 2, hz: sz2 / 2, rot: b.rot, noClimb: true }); }
    const yt0 = yt; for (const [cx, cz, sx2, sz2] of [[0, D / 2, W + 0.3, 0.25], [0, -D / 2, W + 0.3, 0.25], [W / 2, 0, 0.25, D], [-W / 2, 0, 0.25, D]]) panel(cx, yt, cz, sx2, 0.9, sz2, shade(base, 0.9)); panel(0, yt - 0.02, 0, W + 0.35, 0.08, D + 0.35, trimC); }
  else if (b.style === 'warehouse') { mb.flex = 0.5; for (let k = 0; k < 8; k++) mb.box(M(-W / 2 + (k + 0.5) * W / 8, b.floors * FH + 0.05, 0), 0.12, 0.2, D + 0.3, shade(base, 0.7)); }
  mb.flex = 0.93;
  panel(0, 0, 0, W - 0.2, 0.12, D - 0.2, hex(0x6a645a));
  colliders.push({ type: 'box', x: b.x, z: b.z, y0: b.y - 1, y1: b.y + 0.12, hx: W / 2 - 0.1, hz: D / 2 - 0.1, rot: b.rot, platform: true });
  // entulho interno
  const nRub = Math.round(b.decay * 8); for (let i = 0; i < nRub; i++) mb.rock(M((r() - 0.5) * (W - 3), 0.1, (r() - 0.5) * (D - 3), r() * 6, [1, 0.5, 1]), 0.35 + r() * 0.4, 0, 0.5, shade(base, 0.8), r);
  // móveis do interior (sala, cozinha, quarto / hospital / farmácia / laboratório) + paredes divisórias
  const lay = interiorLayout({ ...b, doorWall });
  if (lay) { const { F, P: pcs, walls: pw } = lay;
    for (const w of pw) { const [ax0, az0] = F.L(w.u0, w.v0), [ax1, az1] = F.L(w.u1, w.v1); const len = Math.hypot(ax1 - ax0, az1 - az0); if (len < 0.2) continue; const cx = (ax0 + ax1) / 2, cz = (az0 + az1) / 2, along = Math.abs(ax1 - ax0) > Math.abs(az1 - az0);
      mb.setColor(shade(base, 1.08), 0.93); mb.box(M(cx, 1.42, cz), along ? len : 0.14, 2.6, along ? 0.14 : len, shade(base, 1.08)); const [wx, wz] = toW(cx, cz);
      colliders.push({ type: 'box', x: wx, z: wz, y0: b.y, y1: b.y + 2.72, hx: (along ? len : 0.14) / 2, hz: (along ? 0.14 : len) / 2, rot: b.rot }); }
    for (const p of pcs) { if (p.k === 'ratsuit') continue; const [lx, lz] = F.L(p.u, p.v); const T = M(lx, 0.12, lz, F.yaw + p.f); const box = furniture(mb, p, T, r);
      if (box) { const [wx, wz] = toW(lx, lz); const ang = F.yaw + p.f; const swap = Math.abs(Math.sin(ang)) > 0.7; colliders.push({ type: 'box', x: wx, z: wz, y0: b.y, y1: b.y + 0.12 + box[1], hx: (swap ? box[2] : box[0]) / 2, hz: (swap ? box[0] : box[2]) / 2, rot: b.rot }); } }
    mb.flex = 0.93; }
  // placas: cruz vermelha (hospital), cruz verde (farmácia), faixa de risco biológico (laboratório)
  if (['hospital', 'pharmacy', 'lab'].includes(b.style)) { const dwl = walls[doorWall], ax = dwl.axis === 'x'; const nz = (ax ? Math.sign(dwl.cz) : Math.sign(dwl.cx)) * (T / 2 + 0.06); const sx0 = ax ? 0 : dwl.cx + nz, sz0 = ax ? dwl.cz + nz : 0; const yS = Math.min(b.floors * FH - 0.9, 3.3);
    const cross = (c, s) => { mb.setColor(c, 0.02); mb.box(M(sx0, yS, sz0), ax ? s : 0.08, s * 0.32, ax ? 0.08 : s, c); mb.box(M(sx0, yS, sz0), ax ? s * 0.32 : 0.08, s, ax ? 0.08 : s * 0.32, c); };
    if (b.style === 'hospital') { cross(hex(0xff2a2a), 2.0); mb.setColor(hex(0xb02020), 0.93); const yb = 0.95; mb.box(M(sx0 * (ax ? 1 : 0.995), yb, sz0 * (ax ? 0.995 : 1)), ax ? W : 0.05, 0.25, ax ? 0.05 : D, hex(0xb02020)); }
    else if (b.style === 'pharmacy') cross(hex(0x22d05a), 1.3);
    else { const yb = b.floors * FH - 0.6; for (let k = 0; k < 16; k++) { const t = -0.5 + (k + 0.5) / 16; mb.setColor(k % 2 ? hex(0x1a1a1a) : hex(0xf0c419), 0.93); mb.box(M(ax ? t * W : sx0, yb, ax ? sz0 : t * D), ax ? W / 16 : 0.06, 0.35, ax ? 0.06 : D / 16, k % 2 ? hex(0x1a1a1a) : hex(0xf0c419)); }
      mb.setColor(hex(0xf0c419), 0.93); mb.box(M(sx0, 3.0, sz0), ax ? 1.1 : 0.06, 1.1, ax ? 0.06 : 1.1, hex(0xf0c419)); mb.setColor(hex(0x111111), 0.93); for (let k = 0; k < 3; k++) { const a = k * 2.094 + Math.PI / 2; mb.box(M(sx0 + (ax ? Math.cos(a) * 0.22 : 0), 3.0 + Math.sin(a) * 0.22, sz0 + (ax ? 0 : Math.cos(a) * 0.22)), ax ? 0.2 : 0.07, 0.2, ax ? 0.07 : 0.2, hex(0x111111)); } }
    mb.flex = 0.93; }
  if (b.style === 'shop' || b.style === 'garage' || b.style === 'church') for (const [lx, lz, hx, hz, top] of facadeExtras(mb, b, FH)) { const [wx, wz] = toW(lx, lz); colliders.push({ type: 'box', x: wx, z: wz, y0: b.y - 1, y1: b.y + top, hx, hz, rot: b.rot }); }
  { const LS = ladderSpec(b); if (LS) { ladderMesh(mb, LS); colliders.push({ type: 'box', x: b.x, z: b.z, y0: b.y + LS.top - 0.3, y1: b.y + LS.top, hx: W / 2, hz: D / 2, rot: b.rot, platform: true }); } }
  if (b.style === 'apartment' && b.decay < 0.3) { // sacadas com guarda-corpo na frente dos prédios
    const dwl = walls[doorWall], ax = dwl.axis === 'x'; const sg = ax ? Math.sign(dwl.cz) : Math.sign(dwl.cx); const L = ax ? W : D; const n = Math.max(1, Math.floor(L / 4.5));
    for (let f = 1; f < b.floors; f++) for (let k = 0; k < n; k++) { if (tops[0] < (f + 1) * FH - 0.5) continue; const c = -L / 2 + (k + 0.5) * L / n; const o = (ax ? D : W) / 2 + 0.65; const px = ax ? c : sg * o, pz = ax ? sg * o : c;
      mb.setColor(shade(base, 0.8), 0.93); mb.box(M(px, f * FH + 0.05, pz), ax ? 2.4 : 1.3, 0.16, ax ? 1.3 : 2.4, shade(base, 0.8)); mb.setColor(hex(0x2a2a2a), 0.5);
      mb.box(M(px + (ax ? 0 : sg * 0.62), f * FH + 0.6, pz + (ax ? sg * 0.62 : 0)), ax ? 2.4 : 0.05, 0.9, ax ? 0.05 : 2.4, hex(0x2a2a2a)); } }
  const data = mb.build();
  // transformar para o mundo
  const m = mat4.compose([b.x, b.y, b.z], b.rot);
  const pos = data.pos, nrm = data.nrm;
  for (let i = 0; i < pos.length; i += 3) { const p = mat4.transformPoint(m, [pos[i], pos[i + 1], pos[i + 2]]); pos[i] = p[0]; pos[i + 1] = p[1]; pos[i + 2] = p[2];
    const n = mat4.transformDir(m, [nrm[i], nrm[i + 1], nrm[i + 2]]); nrm[i] = n[0]; nrm[i + 1] = n[1]; nrm[i + 2] = n[2]; }
  return { data, colliders, glass };
}
// ---------- objetos dos sítios (vilarejo, indústria, base militar) ----------
export function siteMesh(kind, o) {
  const mb = new MeshBuilder(); const r = rng(o.seed || 1); const concrete = hex(0x8c8a84), steel = hex(0x5d6266), olive = hex(0x5a5c3e), rust = hex(0x7a4a2e);
  const ST = (c) => mb.setColor(c, 0.93), MT = (c) => mb.setColor(c, 0.5), WD = (c) => mb.setColor(c, 0.63), FB = (c) => mb.setColor(c, 0.83);
  if (kind === 'well') { ST(concrete); mb.cylinder(M(0, -0.3, 0), 1.0, 1.0, 1.1, 16, hex(0x8a8070)); mb.cylinder(M(0, 0.75, 0), 0.82, 0.82, 0.05, 16, hex(0x1a2228)); WD(hex(0x5a4430));
    for (const s of [-1, 1]) mb.box(M(s * 0.9, 1.5, 0), 0.12, 1.6, 0.12, hex(0x5a4430)); mb.box(M(0, 2.3, 0), 2.0, 0.12, 0.12, hex(0x5a4430)); mb.cylinder(M(0, 1.5, 0), 0.01, 0.01, 0.8, 4, hex(0x8a7a5a)); }
  else if (kind === 'tank') { MT(steel); const R = 3.0 * o.s, H = 7 * o.s; mb.cylinder(M(), R, R, H, 24, hex(0xa0a4a6)); mb.cylinder(M(0, H, 0), R, R * 0.3, 1.1, 24, hex(0x8a8e90));
    for (let k = 1; k < 4; k++) mb.cylinder(M(0, k * H / 4, 0), R + 0.04, R + 0.04, 0.12, 24, hex(0x6d7276));
    for (let k = 0; k < 10; k++) { const a = k * 0.25; mb.box(M(Math.cos(a) * (R + 0.35), k * 0.7 + 0.35, Math.sin(a) * (R + 0.35), -a), 0.9, 0.06, 0.5, steel); }
    mb.setColor(rust, 0.5); mb.box(M(R * 0.7, 0.4, R * 0.7), 0.8, 0.8, 0.8, rust); }
  else if (kind === 'chimney') { ST(hex(0x8a5a44)); mb.cylinder(M(), 1.5, 0.9, 24, 18, hex(0x8a5a44)); for (let k = 1; k < 8; k++) mb.cylinder(M(0, k * 3, 0), 1.5 - k * 0.075 + 0.05, 1.5 - k * 0.075 + 0.05, 0.25, 18, hex(0x6e463a));
    mb.cylinder(M(0, 22.5, 0), 1.0, 1.0, 1.5, 18, hex(0xd0cdc5)); mb.cylinder(M(0, 23.9, 0), 0.7, 0.7, 0.2, 18, hex(0x1a1a1a)); }
  else if (kind === 'container') { const cols = [hex(0x8a3a2a), hex(0x2a5a8a), hex(0x3a7a4a), hex(0xa07a2a), hex(0x6a6e72)]; const c = cols[(o.hue || 0) % cols.length]; MT(c);
    for (let lv = 0; lv < (o.stack || 1); lv++) { const y = lv * 2.6; mb.box(M(0, y + 1.3, 0), 6.0, 2.55, 2.4, shade(c, lv ? 0.9 : 1));
      for (let k = 0; k < 14; k++) mb.box(M(-2.8 + k * 0.43, y + 1.3, 1.22), 0.12, 2.3, 0.04, shade(c, 0.8)), mb.box(M(-2.8 + k * 0.43, y + 1.3, -1.22), 0.12, 2.3, 0.04, shade(c, 0.8));
      mb.box(M(3.02, y + 1.3, 0), 0.06, 2.4, 2.3, shade(c, 0.85)); for (const s of [-0.5, 0.5]) mb.box(M(3.07, y + 1.3, s), 0.05, 2.3, 0.04, steel); } }
  else if (kind === 'gate') { MT(steel); for (const sx of [-1, 1]) { mb.box(M(sx * 3.4, 1.5, 0), 0.5, 3.0, 0.5, hex(0x5a5c48)); }
    mb.setColor(hex(0xd8d8d0), 0.5); mb.box(M(0, 1.05, 0.0), 6.2, 0.14, 0.14, hex(0xd8d8d0)); for (let k = 0; k < 6; k++) { mb.setColor(hex(0xc02020), 0.5); mb.box(M(-2.6 + k * 1.05, 1.05, 0.0), 0.45, 0.15, 0.15, hex(0xc02020)); }
    mb.setColor(hex(0xf0c419), 0.93); mb.box(M(0, 3.2, 0), 7.4, 0.5, 0.2, hex(0xf0c419)); for (let k = 0; k < 8; k++) { mb.setColor(hex(0x1a1a1a), 0.93); mb.box(M(-3.3 + k * 0.95, 3.2, 0.11, 0, 1, 0, 0.6), 0.25, 0.5, 0.02, hex(0x1a1a1a)); } }
  else if (kind === 'booth') { ST(hex(0x6a6c54)); mb.box(M(0, 1.3, 0), 2.4, 2.6, 2.4, hex(0x6a6c54)); mb.setColor(hex(0x8ab0c0), 0.5); for (const s of [-1, 1]) mb.box(M(s * 1.21, 1.6, 0), 0.02, 0.9, 1.6, hex(0x8ab0c0)); mb.box(M(0, 1.6, 1.21), 1.6, 0.9, 0.02, hex(0x8ab0c0));
    ST(hex(0x4a4c3c)); mb.box(M(0, 2.75, 0), 2.8, 0.2, 2.8, hex(0x4a4c3c)); }
  else if (kind === 'hut') { // cabana de madeira (troncos, telhado de duas águas, porta e janelinha) — 3,6 × 3,2 m
    const lg = hex(0x6a4c30), lgD = hex(0x4e3622), rf = hex(0x4a3a2a), W = 3.6, D = 3.2, H = 2.2; WD(lg);
    const logX = (y, z, len, rr, c) => mb.cylinder(M(-len / 2, y, z, 0, 1, 0, -Math.PI / 2), rr, rr, len, 7, c), logZ = (x, y, len, rr, c) => mb.cylinder(M(x, y, -len / 2, 0, 1, Math.PI / 2, 0), rr, rr, len, 7, c);
    for (let k = 0; k < 8; k++) { const y = 0.14 + k * 0.27, c = k % 2 ? lg : lgD; logX(y, D / 2, W + 0.3, 0.14, c); logX(y + 0.13, -D / 2, W + 0.3, 0.14, c); for (const s of [-1, 1]) logZ(s * W / 2, y + 0.06, D + 0.3, 0.14, c); }
    for (const s of [-1, 1]) for (let k = 0; k < 4; k++) logZ(s * W / 2, H + 0.12 + k * 0.24, (D + 0.3) * (1 - (k + 0.5) / 4.4), 0.12, lgD);
    WD(rf); for (const s of [-1, 1]) mb.box(mat4.mul(mat4.create(), M(0, H + 0.62, s * D * 0.29), M(0, 0, 0, 0, 1, s * 0.55, 0)), W + 0.8, 0.08, D * 0.68, rf);
    mb.box(M(0, H + 1.12, 0), W + 0.85, 0.12, 0.14, lgD);
    WD(hex(0x3a2a1a)); mb.box(M(0.6, 0.9, D / 2 + 0.16), 0.85, 1.75, 0.06, hex(0x3a2a1a)); MT(hex(0x8a8a80)); mb.box(M(0.3, 0.95, D / 2 + 0.2), 0.05, 0.05, 0.05, hex(0x8a8a80));
    mb.setColor(hex(0x101418), 0.4); mb.box(M(-0.9, 1.25, D / 2 + 0.16), 0.6, 0.45, 0.04, hex(0x101418)); WD(lgD); mb.box(M(-0.9, 1.0, D / 2 + 0.2), 0.75, 0.06, 0.12, lgD);
    WD(hex(0x5a4a3a)); mb.box(M(0, 0.03, D / 2 + 0.55), 1.6, 0.06, 0.6, hex(0x5a4a3a)); }
  else if (kind === 'tent') { const olive2 = o.civ ? [hex(0x3a5a8a), hex(0x8a5a2a), hex(0x6a6a3a), hex(0x8a3a2a)][Math.floor(r() * 4)] : olive; FB(olive2); const W = 5.0, L = 4.6, H = 2.3; for (const s of [-1, 1]) mb.box(M(s * W / 4, H / 2, 0, 0, 1, 0, s * -0.86), Math.hypot(W / 2, H) + 0.1, 0.06, L, shade(olive2, s > 0 ? 1 : 0.88));
    { const z = -L / 2; const a = mb.vert([-W / 2, 0, z], [0, 0, -1], olive2), bb = mb.vert([W / 2, 0, z], [0, 0, -1], olive2), c = mb.vert([0, H, z], [0, 0, -1], olive2); mb.tri(a, c, bb); }
    { const z = L / 2, n = [0, 0, 1], V = (x, y) => mb.vert([x, y, z], n, olive2); const A = V(-W / 2, 0), B = V(-0.55, 0), C = V(-0.55, 1.7), D = V(0.55, 1.7), E = V(0.55, 0), F = V(W / 2, 0), T = V(0, H); // frente com abertura para entrar
      mb.tri(A, B, C); mb.tri(A, C, T); mb.tri(C, D, T); mb.tri(D, F, T); mb.tri(E, F, D); } WD(hex(0x5a4430)); mb.box(M(0, H + 0.02, 0), 0.08, 0.08, L + 0.3, hex(0x5a4430)); }
  else if (kind === 'barrel') { const c = [hex(0xd0a020), hex(0x3a6a3a), hex(0x8a3a2a)][Math.floor(r() * 3)]; MT(c); mb.cylinder(M(), 0.32, 0.32, 0.9, 14, c); for (const y of [0.25, 0.65]) mb.cylinder(M(0, y, 0), 0.335, 0.335, 0.04, 14, shade(c, 0.7));
    mb.setColor(hex(0x111111), 0.02); for (let k = 0; k < 3; k++) { const a = k * 2.094; mb.box(M(Math.cos(a) * 0.07, 0.55 + Math.sin(a) * 0.07, 0.33), 0.07, 0.07, 0.01, hex(0x111111)); } }
  else if (kind === 'fence') { const L = o.len || 10; MT(steel); for (const s of [-0.5, 0.5]) mb.cylinder(M(s * L, 0, 0), 0.05, 0.05, 2.6, 6, steel);
    mb.setColor(hex(0x8a8e90), 0.5); for (let k = 0; k < 9; k++) mb.box(M(0, 0.25 + k * 0.27, 0), L, 0.015, 0.015, hex(0x8a8e90)); for (let k = 0; k < Math.floor(L / 0.3); k++) mb.box(M(-L / 2 + k * 0.3, 1.3, 0), 0.012, 2.3, 0.012, hex(0x8a8e90));
    for (let k = 0; k < 3; k++) mb.cylinder(M(0, 2.65 + k * 0.12, 0, 0, 1, 0, Math.PI / 2), 0.07, 0.07, L, 6, hex(0x9a9ea0)); }
  else if (kind === 'tower') { WD(hex(0x5a4a36)); for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) mb.box(M(sx * 1.4, 3, sz * 1.4), 0.22, 6, 0.22, hex(0x5a4a36));
    for (let k = 0; k < 3; k++) for (const s of [-1, 1]) mb.box(M(0, 1.5 + k * 1.6, s * 1.4, 0, 1, 0, 0.6 * (k % 2 ? 1 : -1)), 3.2, 0.1, 0.1, hex(0x4a3a2a));
    mb.box(M(0, 6.1, 0), 3.6, 0.2, 3.6, hex(0x5a4a36)); ST(olive); for (const s of [-1, 1]) { mb.box(M(s * 1.75, 6.75, 0), 0.12, 1.1, 3.6, olive); mb.box(M(0, 6.75, s * 1.75), 3.6, 1.1, 0.12, olive); }
    WD(hex(0x5a4a36)); for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) mb.box(M(sx * 1.7, 8.0, sz * 1.7), 0.12, 1.5, 0.12, hex(0x5a4a36)); MT(hex(0x4a4e44)); mb.box(M(0, 8.8, 0), 4.2, 0.12, 4.2, hex(0x4a4e44));
    mb.setColor(hex(0xfff2c0), 0.02); mb.box(M(1.6, 7.4, 1.6), 0.25, 0.2, 0.25, hex(0xfff2c0)); }
  else if (kind === 'sandbag') { FB(hex(0x8a7a58)); for (let row = 0; row < 3; row++) for (let k = 0; k < 4 - (row % 2); k++) mb.sphere(M(-1.05 + k * 0.7 + (row % 2) * 0.35, 0.18 + row * 0.3, 0, r() * 0.2, [1, 0.45, 0.6]), 0.42, 8, 5, shade(hex(0x8a7a58), 0.85 + r() * 0.25)); }
  return mb.build();
}
// ---------- carros abandonados (4 modelos, avarias sorteadas pela semente) ----------
export const CAR_TYPES = ['sedan', 'hatch', 'pickup', 'van'];
export function carSpec(seed) {
  const r = rng(seed * 7 + 3); const type = CAR_TYPES[Math.floor(r() * 4)];
  const L = type === 'van' ? 4.9 : type === 'pickup' ? 5.1 : type === 'hatch' ? 3.9 : 4.5;
  return { type, L, W: type === 'van' ? 1.9 : 1.78, H: type === 'van' ? 2.05 : 1.45 };
}
// lanterna solar (ferramenta de mão): corpo metálico, placa solar no dorso e lente luminosa
export function solarLampMesh() {
  const mb = new MeshBuilder(); mb.setColor(hex(0x3a3d42), 0.5); mb.cylinder(M(0, -0.02, 0), 0.03, 0.03, 0.2, 10, hex(0x3a3d42));
  mb.cylinder(M(0, 0.18, 0), 0.03, 0.045, 0.06, 10, hex(0x4a4d52)); mb.setColor(hex(0x1f3a7a), 0.5); mb.box(M(0, 0.08, -0.032), 0.04, 0.14, 0.006, hex(0x1f3a7a));
  mb.setColor(hex(0xe8f4ff), 0.02); mb.cylinder(M(0, 0.24, 0), 0.04, 0.04, 0.008, 10, hex(0xe8f4ff)); return mb.build();
}
export function carMesh(seed) {
  const mb = new MeshBuilder(); const r = rng(seed); const sp = carSpec(seed); const { type, L, W } = sp;
  const PAINTS = [0x7a2e26, 0x2e4660, 0x8a8c86, 0xc8c2b0, 0x3d5236, 0x9a7a3a, 0x232528, 0x5a6a78, 0x6e3a52];
  const burnt = r() < 0.18; const paint = burnt ? hex(0x2a2522) : shade(hex(PAINTS[Math.floor(r() * PAINTS.length)]), 0.85 + r() * 0.2);
  const rust = hex(0x7a4424), rustD = hex(0x4e2a16), dark = hex(0x18191b), rubber = hex(0x1c1c1d), chrome = hex(0xb8bcc0), glass = hex(0x22313a), seat = [hex(0x3a3330), hex(0x2c3138), hex(0x5a4a3a)][Math.floor(r() * 3)];
  // rodas: 0 = boa, 1 = murcha, 2 = faltando (o carro arria naquele canto)
  const wheels = [[L * 0.32, W / 2], [L * 0.32, -W / 2], [-L * 0.3, W / 2], [-L * 0.3, -W / 2]].map(([x, z]) => ({ x, z, st: burnt ? 2 : r() < 0.25 ? 1 : r() < 0.08 ? 2 : 0 }));
  const drop = wheels.map((w) => (w.st === 1 ? 0.1 : w.st === 2 ? 0.27 : 0));
  const pitch = ((drop[0] + drop[1]) - (drop[2] + drop[3])) / 2 / (L * 0.62), roll = ((drop[0] + drop[2]) - (drop[1] + drop[3])) / 2 / W;
  const lift = -(drop[0] + drop[1] + drop[2] + drop[3]) / 4;
  const BM = M(0, lift, 0, 0, 1, roll, pitch); // carroceria inclinada pelas rodas
  const T = (x, y, z, ry = 0, s = 1, rx = 0, rz = 0) => mat4.mul(mat4.create(), BM, M(x, y, z, ry, s, rx, rz));
  const P = (c) => mb.setColor(c, 0.5), RB = (c) => mb.setColor(c, 0.7), FB = (c) => mb.setColor(c, 0.83), D = (c) => mb.setColor(c, 1);
  const by = 0.62, bh = 0.6, top = by + bh / 2; // corpo inferior
  // ---- carroceria
  P(paint); mb.roundBox(T(0, by, 0), L, bh, W, paint, 0.14, 2);
  if (type === 'van') { mb.roundBox(T(-0.35, 1.38, 0), L - 0.7, 1.15, W - 0.04, paint, 0.16, 2); }
  else if (type === 'pickup') { mb.roundBox(T(0.55, top + 0.05, 0), L * 0.38, 0.12, W - 0.05, paint, 0.05, 1);
    for (const sz of [-1, 1]) mb.roundBox(T(-L * 0.27, top + 0.27, sz * (W / 2 - 0.05)), L * 0.42, 0.42, 0.08, paint, 0.03, 1); mb.roundBox(T(-L / 2 + 0.06, top + 0.27, 0), 0.08, 0.42, W - 0.05, paint, 0.03, 1);
    D(dark); mb.box(T(-L * 0.27, top + 0.08, 0), L * 0.42, 0.04, W - 0.2, dark); }
  else { P(paint); mb.roundBox(T(L * 0.3, top + 0.04, 0), L * 0.36, 0.1, W - 0.06, paint, 0.05, 1); mb.roundBox(T(type === 'hatch' ? -L * 0.42 : -L * 0.38, top + 0.06, 0), type === 'hatch' ? 0.3 : L * 0.2, 0.14, W - 0.06, paint, 0.05, 1); }
  // ---- cabine: colunas, teto, vidros (alguns estilhaçados)
  const cab = type === 'van' ? null : type === 'pickup' ? { x0: L * 0.08, x1: -L * 0.06 - 0.45, h: 0.62 } : { x0: L * 0.12, x1: type === 'hatch' ? -L * 0.47 : -L * 0.27, h: 0.6 };
  const win = (m, sx, sy, sz) => { if (burnt || r() < 0.3) { D(glass); if (!burnt && r() < 0.6) for (let k = 0; k < 3; k++) mb.box(mat4.mul(mat4.create(), m, M((r() - 0.5) * sx * 0.7, -sy * 0.35 + r() * 0.1, 0, 0, 1, 0, 0, r() * 3)), sx * 0.2, sy * 0.25, sz, glass); return; } D(glass); mb.box(m, sx, sy, sz, glass); };
  if (cab) {
    const y0 = top, y1 = top + cab.h, xr0 = cab.x0 - 0.45, xr1 = cab.x1 + (type === 'hatch' ? 0.12 : 0.35); const cx = (xr0 + xr1) / 2, rl = xr0 - xr1;
    P(paint); mb.roundBox(T(cx, y1, 0), rl, 0.07, W - 0.18, paint, 0.03, 1);
    for (const sz of [-1, 1]) {
      const zz = sz * (W / 2 - 0.12);
      mb.box(T((cab.x0 + xr0) / 2, (y0 + y1) / 2, zz, 0, 1, 0, Math.atan2(cab.x0 - xr0, cab.h)), 0.07, Math.hypot(cab.x0 - xr0, cab.h), 0.07, paint); // coluna A
      mb.box(T(cx, (y0 + y1) / 2, zz), 0.08, cab.h, 0.07, paint); // coluna B
      mb.box(T((cab.x1 + xr1) / 2, (y0 + y1) / 2, zz, 0, 1, 0, -Math.atan2(xr1 - cab.x1, cab.h)), 0.1, Math.hypot(xr1 - cab.x1, cab.h), 0.07, paint); // coluna C
      win(T((cab.x0 + cx) / 2 - 0.1, (y0 + y1) / 2, sz * (W / 2 - 0.115)), (cab.x0 - cx) * 0.8, cab.h * 0.8, 0.02);
      win(T((cx + cab.x1) / 2 + 0.05, (y0 + y1) / 2, sz * (W / 2 - 0.115)), (cx - cab.x1) * 0.75, cab.h * 0.8, 0.02);
    }
    win(T((cab.x0 + xr0) / 2, (y0 + y1) / 2, 0, 0, 1, 0, Math.atan2(cab.x0 - xr0, cab.h)), 0.02, Math.hypot(cab.x0 - xr0, cab.h) * 0.92, W - 0.3); // para-brisa
    win(T((cab.x1 + xr1) / 2, (y0 + y1) / 2, 0, 0, 1, 0, -Math.atan2(xr1 - cab.x1, cab.h)), 0.02, Math.hypot(xr1 - cab.x1, cab.h) * 0.9, W - 0.3);
    // interior: bancos, volante, painel
    FB(burnt ? hex(0x1a1716) : seat); for (const sz of [-1, 1]) { mb.roundBox(T(cx + 0.25, top + 0.12, sz * 0.4), 0.5, 0.14, 0.5, seat, 0.05, 1); mb.roundBox(T(cx + 0.02, top + 0.4, sz * 0.4, 0, 1, 0, 0.25), 0.12, 0.55, 0.48, seat, 0.05, 1); }
    if (type !== 'pickup') mb.roundBox(T(xr1 + 0.35, top + 0.15, 0), 0.5, 0.2, W - 0.35, seat, 0.05, 1);
    D(dark); mb.box(T(xr0 - 0.05, top + 0.12, 0), 0.35, 0.18, W - 0.3, dark); mb.cylinder(T(xr0 - 0.25, top + 0.32, 0.4, 0, 1, 0, Math.PI / 2 - 0.4), 0.17, 0.17, 0.03, 12, dark);
  } else { // van: para-brisa e janelas laterais
    win(T(L / 2 - 0.62, 1.42, 0, 0, 1, 0, 0.35), 0.02, 0.8, W - 0.3);
    for (const sz of [-1, 1]) win(T(L / 2 - 1.05, 1.5, sz * (W / 2)), 0.7, 0.55, 0.02);
    P(shade(paint, 0.85)); for (const sz of [-1, 1]) mb.box(T(-0.6, 1.3, sz * (W / 2 + 0.005)), 1.4, 1.0, 0.01, shade(paint, 0.85)); // porta de correr
  }
  // ---- frente e traseira
  const fx = L / 2;
  D(dark); mb.roundBox(T(fx + 0.02, by + 0.08, 0), 0.06, 0.24, W * 0.55, dark, 0.02, 1); for (let k = 0; k < 4; k++) mb.box(T(fx + 0.05, by + 0.0 + k * 0.055, 0), 0.02, 0.012, W * 0.53, chrome);
  for (const sz of [-1, 1]) { if (burnt || r() < 0.35) { D(dark); mb.box(T(fx + 0.01, by + 0.12, sz * (W / 2 - 0.25)), 0.04, 0.14, 0.32, dark); } else { mb.setColor(hex(0xd8dcd0), 0.2); mb.roundBox(T(fx, by + 0.12, sz * (W / 2 - 0.25)), 0.06, 0.15, 0.34, hex(0xd8dcd0), 0.03, 1); }
    mb.setColor(burnt ? dark : hex(0x6a1612), 1); mb.roundBox(T(-fx, by + 0.15, sz * (W / 2 - 0.2)), 0.05, 0.16, 0.26, burnt ? dark : hex(0x6a1612), 0.02, 1); }
  for (const x of [fx + 0.06, -fx - 0.06]) { P(r() < 0.5 && !burnt ? chrome : dark); mb.roundBox(T(x, by - 0.18, 0), 0.14, 0.16, W + 0.04, r() < 0.5 && !burnt ? chrome : dark, 0.05, 1); }
  if (!burnt && r() < 0.5) { D(hex(0xdedede)); mb.box(T(-fx - 0.04, by - 0.05, 0), 0.02, 0.11, 0.42, hex(0xdedede)); D(dark); for (let k = 0; k < 5; k++) mb.box(T(-fx - 0.05, by - 0.05, -0.15 + k * 0.075), 0.01, 0.05, 0.04, dark); } // placa
  // capô aberto, porta aberta
  if (cab && !burnt && r() < 0.18) { P(paint); mb.roundBox(T(fx - 0.2, top + 0.55, 0, 0, 1, 0, 1.05), L * 0.34, 0.05, W - 0.1, paint, 0.03, 1); D(dark); mb.box(T(L * 0.3, top - 0.08, 0), L * 0.28, 0.12, W - 0.4, dark); }
  for (const sz of [-1, 1]) { const open = cab && !burnt && r() < 0.15; const zz = sz * (W / 2 + 0.005);
    if (open) { P(paint); mb.roundBox(T(cab.x0 - 0.2 - 0.45, by + 0.15, zz + sz * 0.42, sz * 1.0), 0.95, 0.75, 0.06, paint, 0.03, 1); }
    else { D(dark); mb.box(T((cab ? cab.x0 - 0.05 : fx - 0.9), by + 0.05, zz), 0.012, bh * 0.85, 0.012, dark); mb.box(T((cab ? cab.x1 + 0.2 : -0.6), by + 0.05, zz), 0.012, bh * 0.85, 0.012, dark); mb.box(T(cab ? (cab.x0 + cab.x1) / 2 : 0, by + 0.05, zz), 0.012, bh * 0.85, 0.012, dark);
      P(chrome); mb.box(T((cab ? cab.x0 : fx - 0.6) - 0.35, by + 0.18, zz + sz * 0.01), 0.14, 0.025, 0.02, chrome); }
    P(dark); mb.roundBox(T((cab ? cab.x0 : fx - 0.6) + 0.02, top + 0.12, sz * (W / 2 + 0.1)), 0.08, 0.1, 0.16, dark, 0.03, 1); } // espelhos
  // ---- rodas: pneu, aro, cubo; murcha ou ausente
  for (const w of wheels) { const zz = w.z + (w.z > 0 ? -0.12 : 0.12) * 0; const sgn = Math.sign(w.z);
    D(dark); mb.cylinder(T(w.x, 0.36 + lift * 0, w.z - sgn * 0.08, 0, 1, Math.PI / 2), 0.44, 0.44, 0.2, 14, dark); // caixa de roda
    if (w.st === 2) { P(hex(0x5a4a40)); mb.cylinder(T(w.x, 0.27, w.z - sgn * 0.02, 0, 1, Math.PI / 2), 0.15, 0.15, 0.06, 12, hex(0x5a4a40)); continue; }
    const flat = w.st === 1; RB(rubber); mb.cylinder(M(w.x, flat ? 0.28 : 0.34, zz - sgn * 0.11, 0, [1, flat ? 0.78 : 1, 1], Math.PI / 2), 0.34, 0.34, 0.22, 16, rubber);
    P(burnt ? rustD : chrome); mb.cylinder(M(w.x, flat ? 0.28 : 0.34, zz + sgn * 0.005, 0, 1, Math.PI / 2), 0.2, 0.2, 0.03, 12, burnt ? rustD : shade(chrome, 0.8));
    D(dark); for (let k = 0; k < 5; k++) mb.box(M(w.x + Math.cos(k * 1.257) * 0.12, (flat ? 0.28 : 0.34) + Math.sin(k * 1.257) * 0.12, zz + sgn * 0.022), 0.05, 0.05, 0.01, dark); }
  // ---- ferrugem, sujeira e fuligem
  mb.setColor(rust, 0.5); const nr = burnt ? 14 : 3 + Math.floor(r() * 6);
  for (let k = 0; k < nr; k++) { const sz = r() < 0.5 ? 1 : -1; const c = shade(r() < 0.5 ? rust : rustD, 0.8 + r() * 0.3); mb.roundBox(T((r() - 0.5) * L * 0.9, by - 0.15 + r() * 0.4, sz * (W / 2 + 0.006)), 0.15 + r() * 0.5, 0.08 + r() * 0.25, 0.01, c, 0.004, 1); }
  for (let k = 0; k < (burnt ? 8 : 3); k++) mb.roundBox(T((r() - 0.5) * L * 0.6, top + (cab ? 0.06 : 0.03) + 0.01 + (cab && r() < 0.4 ? cab.h : 0), (r() - 0.5) * W * 0.5), 0.2 + r() * 0.5, 0.01, 0.2 + r() * 0.4, shade(rust, 0.7 + r() * 0.3), 0.003, 1);
  mb.setColor(hex(0x4a4036), 1); for (const sz of [-1, 1]) mb.box(T(0, by - 0.24, sz * (W / 2 + 0.004)), L * 0.95, 0.1, 0.008, hex(0x4a4036)); // barro na saia
  return mb.build();
}
export function lampMesh(bent) {
  const mb = new MeshBuilder(); mb.flex = 0.5; const g = hex(0x4a4c4e);
  mb.cylinder(M(0, 0, 0, 0, 1, 0, bent), 0.12, 0.08, 6, 7, g);
  const tx = -Math.sin(bent) * 6, ty = Math.cos(bent) * 6;
  mb.box(M(tx + 0.6, ty, 0, 0, 1, 0, bent), 1.4, 0.1, 0.12, g); mb.box(M(tx + 1.2, ty - 0.15, 0, 0, 1, 0, bent), 0.5, 0.18, 0.3, hex(0x3a3c3e));
  return mb.build();
}
export function rubbleMesh(seed) {
  const mb = new MeshBuilder(); mb.flex = 0.93; const r = rng(seed); const c = hex(0x8a857a);
  for (let i = 0; i < 5; i++) { const x = (r() - 0.5) * 1.6, z = (r() - 0.5) * 1.6; if (r() < 0.5) mb.box(M(x, 0.15, z, r() * 3, 1, r() * 0.4, r() * 0.4), 0.3 + r() * 0.9, 0.2 + r() * 0.3, 0.3 + r() * 0.6, shade(c, 0.8 + r() * 0.3)); else mb.rock(M(x, 0.1, z, 0, [1, 0.6, 1]), 0.2 + r() * 0.3, 0, 0.5, shade(c, 0.85), r); }
  mb.cylinder(M(0, 0.2, 0, r() * 3, 1, 0, Math.PI / 2 - 0.2), 0.03, 0.03, 1.4, 4, hex(0x6a4a3a));
  return mb.build();
}

// ---------- Caverna ----------
export function caveMesh(c, seed) {
  const mb = new MeshBuilder(); mb.flex = 0.93; const r = rng(seed); const rockC = hex(0x6a645c);
  const RS = 20, AS = 36; const pts = [];
  const radius = (th, ph) => c.R * (1 + 0.08 * Math.sin(ph * 5 + seed) + 0.06 * Math.sin(th * 7 + ph * 3)) ;
  for (let i = 0; i <= RS; i++) { pts[i] = []; const th = (i / RS) * Math.PI / 2;
    for (let j = 0; j <= AS; j++) { const ph = (j / AS) * Math.PI * 2; const rr = radius(th, ph);
      pts[i][j] = [c.x + Math.sin(th) * Math.cos(ph) * rr, c.y - 0.6 + Math.cos(th) * c.H + (i === RS ? -1.2 : 0), c.z + Math.sin(th) * Math.sin(ph) * rr]; } }
  const inEnt = (th, ph) => { let d = Math.abs(((ph - c.ent) % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI); const hy = Math.cos(th); return d < c.entHalf && hy < 0.62; };
  for (let i = 0; i < RS; i++) for (let j = 0; j < AS; j++) {
    const th = ((i + 0.5) / RS) * Math.PI / 2, ph = ((j + 0.5) / AS) * Math.PI * 2; if (inEnt(th, ph)) continue;
    const col = shade(rockC, 0.75 + r() * 0.35);
    mb.flatTri(pts[i][j], pts[i + 1][j], pts[i][j + 1], col); mb.flatTri(pts[i][j + 1], pts[i + 1][j], pts[i + 1][j + 1], col);
  }
  // rochas externas que integram a caverna à montanha
  for (let k = 0; k < 16; k++) { const ph = r() * Math.PI * 2; if (Math.abs(((ph - c.ent) % 6.283 + 9.42) % 6.283 - 3.14) < c.entHalf + 0.15) continue;
    mb.rockSmooth(M(c.x + Math.cos(ph) * (c.R + 1.5), c.y + 1 + r() * 4, c.z + Math.sin(ph) * (c.R + 1.5), r() * 6, [1, 0.8, 1]), 2.5 + r() * 2.5, 2, 0.45, rockC, r, (y, d) => shade(d[1] > 0.6 && r() < 0.5 ? hex(0x56693a) : rockC, 0.7 + r() * 0.4)); }
  // arco de entrada
  const ex = Math.cos(c.ent), ez = Math.sin(c.ent);
  for (const s of [-1, 1]) { const a = c.ent + s * (c.entHalf + 0.05); mb.rock(M(c.x + Math.cos(a) * c.R, c.y + 1.5, c.z + Math.sin(a) * c.R, 0, [0.8, 1.6, 0.8]), 1.6, 1, 0.3, rockC, r, () => shade(rockC, 0.7 + r() * 0.3)); }
  mb.rock(M(c.x + ex * c.R * 0.92, c.y + c.H * 0.68, c.z + ez * c.R * 0.92, 0, [2.4, 0.7, 1.2]), 2.2, 1, 0.3, rockC, r, () => shade(rockC, 0.7 + r() * 0.3));
  // estalactites e estalagmites
  for (let k = 0; k < 14; k++) { const a = r() * 6.28, d = r() * c.R * 0.7; const x = c.x + Math.cos(a) * d, z = c.z + Math.sin(a) * d;
    const top = c.y - 0.6 + Math.sqrt(Math.max(0, 1 - (d / c.R) ** 2)) * c.H;
    mb.cylinder(M(x, top, z, 0, 1, Math.PI), 0.35 + r() * 0.3, 0.02, 0.8 + r() * 1.6, 6, shade(rockC, 0.9)); }
  return mb.build();
}

// ---------- Ferramentas (empunhadura na origem, cabo ao longo de +Y) ----------
export function toolMesh(id) {
  const mb = new MeshBuilder(); const wood = hex(0x7a5a38), stone = hex(0x8a857c), fiber = hex(0xb5a46a), metal = hex(0x9aa0a6);
  switch (id) {
    case 'axe': mb.cylinder(M(0, -0.12, 0), 0.022, 0.02, 0.72, 6, wood); mb.box(M(0.07, 0.5, 0, 0, 1, 0, 0), 0.16, 0.11, 0.05, stone); mb.box(M(0.15, 0.5, 0), 0.04, 0.16, 0.035, shade(stone, 1.1)); mb.box(M(0, 0.5, 0), 0.05, 0.12, 0.055, fiber); break;
    case 'scrapaxe': mb.cylinder(M(0, -0.12, 0), 0.024, 0.022, 0.76, 6, wood); mb.box(M(0.09, 0.52, 0), 0.2, 0.18, 0.02, metal); mb.box(M(0.19, 0.52, 0), 0.03, 0.24, 0.015, shade(metal, 1.25)); mb.box(M(0, 0.52, 0), 0.05, 0.14, 0.05, hex(0x444444)); break;
    case 'pickaxe': mb.cylinder(M(0, -0.12, 0), 0.022, 0.02, 0.74, 6, wood); mb.cylinder(M(0, 0.52, 0, 0, 1, 0, Math.PI / 2), 0.035, 0.008, 0.28, 5, stone); mb.cylinder(M(0, 0.52, 0, 0, 1, 0, -Math.PI / 2), 0.035, 0.008, 0.28, 5, stone); mb.box(M(0, 0.52, 0), 0.06, 0.08, 0.06, fiber); break;
    case 'spear': mb.cylinder(M(0, -0.7, 0), 0.02, 0.018, 1.95, 6, wood); mb.cylinder(M(0, 1.25, 0), 0.035, 0.0, 0.22, 5, stone); mb.box(M(0, 1.22, 0), 0.05, 0.06, 0.05, fiber); break;
    case 'scrapspear': mb.cylinder(M(0, -0.7, 0), 0.022, 0.02, 1.95, 6, wood); mb.cylinder(M(0, 1.25, 0, 0, [1, 1, 0.4]), 0.05, 0.0, 0.3, 4, metal); mb.box(M(0, 1.22, 0), 0.05, 0.07, 0.05, hex(0x444444)); break;
    case 'shockspear': mb.cylinder(M(0, -0.7, 0), 0.024, 0.022, 1.95, 6, hex(0x3a3d42)); mb.box(M(0, 1.15, 0), 0.07, 0.12, 0.07, hex(0x6a6a6a)); mb.flex = 0.02; mb.cylinder(M(0, 1.2, 0, 0, [1, 1, 0.5]), 0.05, 0.0, 0.34, 4, hex(0x60d8ff)); mb.box(M(0, 0.9, 0), 0.04, 0.2, 0.045, hex(0x60d8ff)); mb.flex = 1; break;
    case 'knife': mb.cylinder(M(0, -0.06, 0), 0.02, 0.018, 0.15, 6, wood); mb.box(M(0, 0.1, 0), 0.05, 0.025, 0.045, fiber); mb.box(M(0, 0.21, 0, 0, [1, 1, 1]), 0.012, 0.2, 0.04, stone); mb.cylinder(M(0, 0.31, 0, 0, [0.3, 1, 1]), 0.035, 0.0, 0.06, 4, stone); break;
    case 'scrapknife': mb.cylinder(M(0, -0.06, 0), 0.02, 0.019, 0.16, 6, hex(0x3a3d42)); mb.box(M(0, 0.1, 0), 0.07, 0.02, 0.03, metal); mb.box(M(0, 0.22, 0.004), 0.006, 0.22, 0.045, shade(metal, 1.25)); mb.cylinder(M(0, 0.33, 0.004, 0, [0.17, 1, 1]), 0.036, 0.0, 0.07, 4, shade(metal, 1.25)); break;
    case 'torch': mb.cylinder(M(0, -0.15, 0), 0.025, 0.03, 0.6, 6, wood); mb.cylinder(M(0, 0.4, 0), 0.05, 0.06, 0.12, 6, hex(0x3a2a1a)); break;
    default: mb.box(M(0, 0.1, 0), 0.1, 0.1, 0.1, hex(0xffffff));
  }
  mb.tagMaterials([[wood, 0.63], [stone, 0.93], [shade(stone, 1.1), 0.93], [metal, 0.5], [shade(metal, 1.25), 0.5], [hex(0x444444), 0.5], [hex(0x6a6a6a), 0.5], [hex(0x3a3d42), 0.5], [fiber, 0.83], [hex(0x3a2a1a), 0.83]], 0.06);
  return mb.build();
}

// ---------- Construções ----------
export function pieceMesh(type) {
  const mb = new MeshBuilder(); const r = rng(type.length * 17);
  const wood = hex(0x8a6a44), woodD = hex(0x6a4e30), leaf = hex(0x5a7a34), stone = hex(0x8a857c), cloth = hex(0x8a7a5a);
  switch (type) {
    case 'campfire':
      for (let i = 0; i < 9; i++) { const a = (i / 9) * 6.28; mb.rock(M(Math.cos(a) * 0.6, 0.08, Math.sin(a) * 0.6, 0, [1, 0.7, 1]), 0.17, 0, 0.4, stone, r); }
      for (let i = 0; i < 5; i++) { const a = i * 1.257 + 0.4; mb.cylinder(M(Math.cos(a) * 0.48, 0.02, Math.sin(a) * 0.48, -a, 1, 0, 1.0), 0.06, 0.04, 0.62, 6, woodD); }
      mb.cylinder(M(0, 0.01, 0), 0.42, 0.42, 0.02, 10, hex(0x2a2522), false); break;
    case 'tent':
      for (const s of [-1, 1]) mb.box(mat4.mul(mat4.create(), M(s * 0.55, 0.68, 0), M(0, 0, 0, 0, 1, 0, s * 0.68)), 0.06, 1.75, 2.4, cloth);
      mb.box(M(0, 1.38, 0), 0.08, 0.08, 2.6, woodD);
      for (const z of [-1.25, 1.25]) for (const s of [-1, 1]) mb.box(mat4.mul(mat4.create(), M(s * 0.5, 0.68, z), M(0, 0, 0, 0, 1, 0, s * 0.68)), 0.05, 1.7, 0.05, woodD);
      mb.box(M(0, 0.02, 0), 1.6, 0.04, 2.3, hex(0x5a4a34)); mb.box(M(0, 0.7, -1.18), 0.04, 1.2, 0.02, hex(0x6a5a40)); break;
    case 'shelter':
      for (const [x, z, h] of [[-1.4, -1.4, 2.6], [1.4, -1.4, 2.6], [-1.4, 1.4, 1.4], [1.4, 1.4, 1.4]]) mb.cylinder(M(x, 0, z), 0.09, 0.08, h, 6, woodD);
      mb.box(mat4.mul(mat4.create(), M(0, 2.05, 0), M(0, 0, 0, 0, 1, -0.4)), 3.2, 0.12, 3.25, leaf);
      for (let i = 0; i < 6; i++) mb.box(mat4.mul(mat4.create(), M(0, 2.15, -1.3 + i * 0.52), M(0, 0, 0, 0, 1, -0.4)), 3.3, 0.06, 0.12, shade(leaf, 0.85));
      for (let i = 0; i < 6; i++) mb.cylinder(M(-1.5, 0.15 + i * 0.42, -1.45, 0, 1, 0, -Math.PI / 2), 0.1, 0.1, 3.0, 6, i % 2 ? wood : woodD);
      mb.box(M(0, 0.05, -0.5), 1.0, 0.1, 2.0, leaf); break;
    case 'wall':
      for (let i = 0; i < 6; i++) mb.cylinder(M(-1.5, 0.23 + i * 0.44, 0, 0, 1, 0, -Math.PI / 2), 0.23, 0.22, 3.0, 7, i % 2 ? wood : shade(wood, 0.9));
      mb.box(M(-1.45, 1.35, 0.25), 0.08, 2.7, 0.08, woodD); mb.box(M(1.45, 1.35, 0.25), 0.08, 2.7, 0.08, woodD); break;
    case 'floor':
      for (let i = 0; i < 7; i++) mb.box(M(-1.5 + 0.215 + i * 0.43, 0.15, 0), 0.41, 0.1, 3.0, i % 2 ? wood : shade(wood, 0.92));
      mb.box(M(0, 0.05, -1.3), 3.0, 0.12, 0.15, woodD); mb.box(M(0, 0.05, 1.3), 3.0, 0.12, 0.15, woodD);
      for (const [x, z] of [[-1.35, -1.35], [1.35, -1.35], [-1.35, 1.35], [1.35, 1.35]]) mb.cylinder(M(x, -3, z), 0.13, 0.13, 3.05, 6, woodD); break;
    case 'doorframe':
      for (const x of [-1.05, 1.05]) mb.box(M(x, 1.35, 0), 0.9, 2.7, 0.4, wood);
      for (const x of [-0.58, 0.58]) mb.box(M(x, 1.15, 0), 0.12, 2.3, 0.44, woodD);
      mb.box(M(0, 2.5, 0), 1.3, 0.4, 0.4, wood); break;
    case 'door':
      for (let i = 0; i < 5; i++) mb.box(M(0.52 - 0.105 - i * 0.21, 1.1, 0), 0.2, 2.2, 0.08, i % 2 ? wood : shade(wood, 0.9));
      mb.box(M(0.52 - 0.52, 0.5, 0.05), 1.0, 0.12, 0.04, woodD); mb.box(M(0, 1.7, 0.05), 1.0, 0.12, 0.04, woodD); mb.box(M(-0.4 + 0.4, 1.0, 0.09), 0.06, 0.12, 0.06, hex(0x333333)); break;
    case 'gtrap': { // duas estacas, fio esticado e a granada presa numa delas
      mb.flex = 0.63; for (const sx of [-1.2, 1.2]) mb.cylinder(M(sx, -0.05, 0), 0.03, 0.02, 0.4, 5, woodD); mb.flex = 0.5; mb.box(M(0, 0.12, 0), 2.4, 0.008, 0.008, hex(0xb8b4a8));
      mb.flex = 0.86; for (let k = 0; k < 4; k++) mb.cylinder(M(-1.12, 0.06 + k * 0.022, 0.05), 0.033 + Math.sin((k + 0.5) / 4 * Math.PI) * 0.01, 0.033 + Math.sin((k + 1) / 4 * Math.PI) * 0.01, 0.021, 8, hex(0x4a5236)); mb.flex = 0.5; mb.cylinder(M(-1.12, 0.15, 0.05), 0.012, 0.012, 0.03, 6, hex(0x8a8e92)); break; }
    case 'chest':
      mb.box(M(0, 0.32, 0), 1.0, 0.55, 0.6, wood); mb.box(M(0, 0.66, 0), 1.04, 0.14, 0.64, shade(wood, 0.9));
      for (const x of [-0.42, 0.42]) mb.box(M(x, 0.4, 0), 0.06, 0.74, 0.66, hex(0x3a3a3a)); mb.box(M(0, 0.55, 0.32), 0.12, 0.14, 0.03, hex(0xb59a3a)); break;
    case 'collector': { // coletor de chuva: barril azul, funil de lona preso em 4 varas, visor de nível na lateral
      const blue = hex(0x2a5a9a); mb.flex = 0.86; mb.cylinder(M(0, 0, 0), 0.45, 0.45, 1.0, 14, blue); for (const y of [0.2, 0.8]) mb.cylinder(M(0, y, 0), 0.465, 0.465, 0.05, 14, shade(blue, 0.8));
      mb.flex = 0.63; for (const [x, z] of [[0.62, 0.62], [-0.62, 0.62], [0.62, -0.62], [-0.62, -0.62]]) mb.cylinder(M(x, 0, z), 0.04, 0.035, 1.45, 5, woodD);
      mb.flex = 0.83; mb.cylinder(M(0, 1.0, 0), 0.22, 0.88, 0.38, 12, hex(0x4a6a8a), false);
      mb.flex = 0.5; mb.box(M(0, 0.5, 0.465), 0.09, 0.82, 0.02, hex(0x1a1e22)); break; }
    case 'composter': { // composteira: caixa de ripas com o composto escuro dentro
      mb.flex = 0.63; for (let k = 0; k < 5; k++) { const y = 0.12 + k * 0.2; for (const z of [-0.52, 0.52]) mb.box(M(0, y, z), 1.5, 0.14, 0.06, k % 2 ? wood : woodD); for (const x of [-0.72, 0.72]) mb.box(M(x, y, 0), 0.06, 0.14, 1.08, k % 2 ? woodD : wood); }
      for (const [x, z] of [[0.72, 0.52], [-0.72, 0.52], [0.72, -0.52], [-0.72, -0.52]]) mb.box(M(x, 0.5, z), 0.1, 1.05, 0.1, woodD);
      mb.flex = 0.93; mb.box(M(0, 0.45, 0), 1.36, 0.06, 0.98, hex(0x3a2a1c)); for (let i = 0; i < 7; i++) mb.rock(M(-0.45 + (i % 4) * 0.3, 0.5, -0.25 + Math.floor(i / 4) * 0.5), 0.14, 0, 0.4, [hex(0x4a3424), hex(0x5a6a2a), hex(0x6a4a2a)][i % 3], r); break; }
    case 'planter': { // canteiro: caixa de tábuas com terra e mudas
      mb.box(M(0, 0.2, 0), 1.9, 0.4, 1.2, wood); for (const z of [-0.6, 0.6]) mb.box(M(0, 0.22, z), 1.94, 0.44, 0.06, woodD); for (const x of [-0.95, 0.95]) mb.box(M(x, 0.22, 0), 0.06, 0.44, 1.24, woodD);
      mb.box(M(0, 0.41, 0), 1.78, 0.04, 1.08, hex(0x4a3424)); for (let i = 0; i < 6; i++) { const x = -0.6 + (i % 3) * 0.6, z = i < 3 ? -0.25 : 0.25; for (let k = 0; k < 4; k++) { const a = k * 1.6 + i; mb.box(M(x + Math.cos(a) * 0.05, 0.52, z + Math.sin(a) * 0.05, a, 1, 0.5), 0.1, 0.2, 0.02, leaf); }
        mb.box(M(x + 0.06, 0.6, z), 0.05, 0.05, 0.05, hex(0x3a3a8a)); } break; }
    case 'bench':
      mb.box(M(0, 0.92, 0), 1.9, 0.1, 0.95, wood);
      for (const [x, z] of [[-0.85, -0.38], [0.85, -0.38], [-0.85, 0.38], [0.85, 0.38]]) mb.box(M(x, 0.45, z), 0.1, 0.9, 0.1, woodD);
      mb.box(M(0, 0.3, 0), 1.7, 0.06, 0.8, shade(wood, 0.85));
      mb.box(M(-0.5, 1.0, 0.1, 0.3), 0.5, 0.05, 0.12, hex(0x9aa0a6)); mb.cylinder(M(0.4, 0.97, -0.1, 0, 1, 0, Math.PI / 2), 0.025, 0.025, 0.3, 5, woodD); mb.box(M(0.55, 0.99, -0.1), 0.08, 0.06, 0.12, hex(0x666666));
      mb.rock(M(0.2, 1.02, 0.25), 0.1, 0, 0.3, stone, r); break;
  }
  return mb.build();
}

// Colmeia robótica (pendurada no galho): favos hexagonais de metal com células âmbar luminosas
export function hiveMesh() {
  // colmeia cibernética (referência): esfera de favos laranja, placas blindadas cinza rebitadas, frestas laranja luminosas,
  // antena com luz no topo, galho atravessando, mel escorrendo e grande entrada hexagonal
  const mb = new MeshBuilder(); const OR = hex(0xf08a18), ORd = hex(0xc0600c), ORl = hex(0xffb040), PL = hex(0x4a4d52), PLd = hex(0x33363a), RIV = hex(0x9aa0a6), HON = hex(0xffa818), BR = hex(0x5a3d26), BRd = hex(0x3e2a1a), BK = hex(0x1a1410);
  const C = [0, -0.42, 0], R = 0.4, Ry = 0.44; const toZ = M(0, 0, 0, 0, 1, Math.PI / 2);
  const at = (th, ph, rOff = 0) => { const n = [Math.cos(ph) * Math.sin(th), Math.sin(ph), Math.cos(ph) * Math.cos(th)]; return { n, p: [C[0] + n[0] * (R + rOff), C[1] + n[1] * (Ry + rOff), C[2] + n[2] * (R + rOff)], ry: Math.atan2(n[0], n[2]), rx: -Math.asin(n[1]) }; };
  // núcleo de favos
  mb.setColor(ORd, 0.86); mb.sphere(M(C[0], C[1], C[2], 0, [R, Ry, R]), 1, 12, 9, ORd);
  for (let j = -4; j <= 4; j++) { const ph = j * 0.33; const n = Math.max(3, Math.round(16 * Math.cos(ph))); for (let i = 0; i < n; i++) { const th = (i + (j & 1) * 0.5) / n * Math.PI * 2; const q = at(th, ph, 0.005);
    mb.setColor((i + j) % 3 ? OR : ORl, 0.86); mb.cylinder(mat4.mul(mat4.create(), M(q.p[0], q.p[1], q.p[2], q.ry, 1, q.rx), toZ), 0.062, 0.05, 0.025, 6, (i + j) % 3 ? OR : ORl); } }
  // placas blindadas com rebites (deixam faixas de favo à mostra)
  const plates = [[0.4, 0.55], [1.5, 0.7], [2.7, 0.45], [3.9, 0.6], [5.1, 0.5], [0.9, -0.5], [2.1, -0.6], [3.3, -0.45], [4.5, -0.65], [5.6, -0.4], [0.2, 0.05], [2.4, 0.1], [4.4, -0.05]];
  for (const [th, ph] of plates) { const q = at(th, ph, 0.03); const w = 0.26 - Math.abs(ph) * 0.06;
    mb.setColor(PL, 0.5); mb.roundBox(M(q.p[0], q.p[1], q.p[2], q.ry, 1, q.rx), w, 0.16, 0.035, PL, 0.015, 1);
    mb.setColor(PLd, 0.5); mb.box(M(q.p[0], q.p[1], q.p[2], q.ry, 1, q.rx), w * 0.7, 0.02, 0.045, PLd);
    mb.setColor(RIV, 0.5); for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const o = at(th + dx * w * 0.42 / R, ph + dy * 0.06 / Ry, 0.05); mb.box(M(o.p[0], o.p[1], o.p[2], o.ry, 1, o.rx), 0.015, 0.015, 0.012, RIV); }
    mb.setColor(ORl, 0.02); if ((th * 10 | 0) % 2) mb.box(M(q.p[0], q.p[1] - 0.05, q.p[2], q.ry, 1, q.rx), w * 0.5, 0.012, 0.05, ORl); }
  // aros metálicos no topo e na base
  mb.setColor(PLd, 0.5); mb.cylinder(M(0, C[1] + Ry - 0.03, 0), 0.2, 0.24, 0.07, 10, PLd); mb.cylinder(M(0, C[1] - Ry + 0.02, 0), 0.22, 0.14, 0.07, 10, PLd);
  mb.setColor(RIV, 0.5); for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; mb.box(M(Math.cos(a) * 0.23, C[1] + Ry - 0.03, Math.sin(a) * 0.23), 0.02, 0.02, 0.02, RIV); }
  // entrada hexagonal grande (frente +Z) com aro metálico e interior escuro
  { const q = at(0, -0.12, 0.02); mb.setColor(PL, 0.5); mb.cylinder(mat4.mul(mat4.create(), M(q.p[0], q.p[1], q.p[2], q.ry, 1, q.rx), toZ), 0.15, 0.15, 0.06, 6, PL);
    mb.setColor(BK, 0.9); const q2 = at(0, -0.12, 0.045); mb.cylinder(mat4.mul(mat4.create(), M(q2.p[0], q2.p[1], q2.p[2], q2.ry, 1, q2.rx), toZ), 0.11, 0.11, 0.02, 6, BK);
    mb.setColor(ORl, 0.02); const q3 = at(0, -0.12, 0.035); mb.cylinder(mat4.mul(mat4.create(), M(q3.p[0], q3.p[1], q3.p[2], q3.ry, 1, q3.rx), toZ), 0.125, 0.125, 0.012, 6, ORl); }
  // antena com luz
  mb.setColor(PLd, 0.5); mb.cylinder(M(0, C[1] + Ry + 0.02, 0), 0.06, 0.08, 0.06, 8, PLd); mb.setColor(RIV, 0.5); mb.cylinder(M(0.03, C[1] + Ry + 0.2, 0.0, 0, 1, 0, -0.1), 0.012, 0.012, 0.34, 6, RIV);
  mb.setColor(ORl, 0.02); mb.sphere(M(0.05, C[1] + Ry + 0.38, 0), 0.035, 6, 4, ORl);
  // galho atravessando o topo (ao longo de X) com folhinhas
  mb.setColor(BR, 0.63); mb.cylinder(M(0, C[1] + Ry - 0.04, 0, 0, 1, 0, Math.PI / 2), 0.05, 0.04, 1.6, 7, BR); mb.setColor(BRd, 0.63);
  for (const s of [-1, 1]) mb.cylinder(M(s * 0.55, C[1] + Ry + 0.04, 0.05, 0.4, 1, 0, s * 0.9), 0.02, 0.012, 0.25, 5, BRd);
  // mel escorrendo (gotas alongadas)
  mb.setColor(HON, 0.02); for (const [th, len] of [[0.9, 0.12], [2.3, 0.2], [3.6, 0.1], [4.8, 0.17], [5.7, 0.13], [0.35, 0.09]]) { const q = at(th, -0.75, 0.0);
    mb.cylinder(M(q.p[0], q.p[1] - len / 2, q.p[2]), 0.018, 0.012, len, 6, HON); mb.sphere(M(q.p[0], q.p[1] - len, q.p[2]), 0.022, 6, 4, HON); }
  { const q = at(0, -0.3, 0.02); mb.setColor(HON, 0.02); mb.cylinder(M(q.p[0], q.p[1] - 0.06, q.p[2] + 0.01), 0.02, 0.012, 0.12, 6, HON); }
  return mb.build();
}
// Míssil (ao longo de +Y): corpo, ogiva, aletas e chama
export function missileMesh() {
  const mb = new MeshBuilder(); const body = hex(0x8a8e92), red = hex(0xa8301c);
  mb.flex = 0.5; mb.cylinder(M(0, -0.3, 0), 0.06, 0.06, 0.48, 10, body); mb.cylinder(M(0, 0.18, 0), 0.06, 0.0, 0.18, 10, red);
  for (let i = 0; i < 4; i++) mb.box(M(Math.cos(i * 1.571) * 0.07, -0.24, Math.sin(i * 1.571) * 0.07, -i * 1.571), 0.08, 0.12, 0.01, hex(0x4a4e52));
  mb.flex = 0.02; mb.cylinder(M(0, -0.38, 0), 0.03, 0.05, 0.08, 8, hex(0xffa040));
  return mb.build();
}
// Metralhadora giratória (6 canos em volta do eixo +Z) do tigre
export function gatlingMesh() {
  const mb = new MeshBuilder(); const dark = hex(0x3a3d42), steel = hex(0x8a9098); mb.flex = 0.5;
  for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; mb.cylinder(M(Math.cos(a) * 0.045, Math.sin(a) * 0.045, 0, 0, 1, Math.PI / 2), 0.017, 0.017, 0.5, 8, steel); }
  for (const z of [0.06, 0.3, 0.48]) mb.cylinder(M(0, 0, z, 0, 1, Math.PI / 2), 0.07, 0.07, 0.025, 12, dark);
  mb.cylinder(M(0, 0, -0.06, 0, 1, Math.PI / 2), 0.075, 0.075, 0.12, 12, dark);
  return mb.build();
}

// cacto do deserto: tronco com gomos e dois braços
export function cactusMesh(seed = 1) {
  const mb = new MeshBuilder(); const g = hex(0x4f7d3a), gd = hex(0x3d6530), fl = hex(0xe8c84a); mb.flex = 0.83;
  const ribbed = (m, r, h) => { mb.cylinder(m, r, r * 0.92, h, 10, g); for (let k = 0; k < 8; k++) { const a = k / 8 * 6.283; mb.box(mat4.mul(mat4.create(), m, M(Math.cos(a) * r * 0.95, h / 2, Math.sin(a) * r * 0.95, -a)), 0.03, h * 0.96, 0.03, gd); } mb.sphere(mat4.mul(mat4.create(), m, M(0, h, 0)), r * 0.92, 10, 6, g); };
  ribbed(M(0, 0, 0), 0.26, 3.6);
  ribbed(M(0.24, 1.3, 0, 0, 1, 0, -Math.PI / 2), 0.15, 0.45); ribbed(M(0.62, 1.3, 0), 0.15, 1.2);
  ribbed(M(-0.24, 1.9, 0, 0, 1, 0, Math.PI / 2), 0.13, 0.35); ribbed(M(-0.55, 1.9, 0), 0.13, 0.9);
  mb.sphere(M(0, 3.85, 0), 0.08, 8, 5, fl);
  return mb.build();
}

// ---------- móveis (referencial do móvel: frente para +z, centro no chão) ----------
// devolve o tamanho da caixa de colisão [x, y, z] (ou null)
export function furniture(mb, p, T, r) {
  const B = (x, y, z, sx, sy, sz, c, f = 0.63, rb = 0) => { mb.setColor(c, f); const m = mat4.mul(mat4.create(), T, M(x, y, z)); if (rb) mb.roundBox(m, sx, sy, sz, c, rb, 1); else mb.box(m, sx, sy, sz, c); };
  const C = (x, y, z, rad, h, c, f = 0.5, seg = 10) => { mb.setColor(c, f); mb.cylinder(mat4.mul(mat4.create(), T, M(x, y, z)), rad, rad, h, seg, c); };
  const wood = [hex(0x7a5a3c), hex(0x9a7a56), hex(0x5e4630)][Math.floor(r() * 3)], white = hex(0xe8e6e0), dark = hex(0x232325), steel = hex(0x9aa0a6), fab = [hex(0x6a7a8a), hex(0x8a5a4a), hex(0x5a6a4a), hex(0x8a8a7a)][Math.floor(r() * 4)];
  switch (p.k) {
    case 'counter': { const L = p.len || 2.4; B(0, 0.43, 0, L, 0.86, 0.6, p.loot === 'kcab' ? white : wood); B(0, 0.88, 0.02, L + 0.04, 0.05, 0.64, hex(0x5a5650), 0.93); for (let k = 0; k < Math.round(L / 0.6); k++) B(-L / 2 + 0.3 + k * 0.6, 0.45, 0.302, 0.02, 0.7, 0.01, hex(0x8a8a8a), 0.5); return [L, 0.92, 0.6]; }
    case 'stove': B(0, 0.45, 0.01, 0.6, 0.9, 0.6, white, 0.5); B(0, 0.905, 0.01, 0.58, 0.02, 0.58, dark, 0.5); for (const [x, z] of [[-0.14, -0.12], [0.14, -0.12], [-0.14, 0.12], [0.14, 0.12]]) C(x, 0.915, z, 0.08, 0.01, hex(0x3a3a3a)); B(0, 0.45, 0.305, 0.45, 0.35, 0.01, hex(0x1a1a1a), 0.5); return null;
    case 'sink': B(0, 0.9, 0.02, 0.55, 0.04, 0.42, steel, 0.5); C(0, 0.92, -0.17, 0.02, 0.28, steel); B(0, 1.19, -0.08, 0.03, 0.03, 0.2, steel, 0.5); return null;
    case 'wallcab': { const L = p.len || 2.4; B(0, 1.85, 0, L, 0.6, 0.35, white); return null; }
    case 'fridge': B(0, 0.98, 0, 0.75, 1.95, 0.7, hex(0xf2f2f0), 0.5, 0.04); B(0, 1.3, 0.352, 0.74, 0.012, 0.01, hex(0xb0b0b0), 0.5); B(0.3, 1.0, 0.37, 0.03, 0.4, 0.04, steel, 0.5); B(0.3, 1.55, 0.37, 0.03, 0.3, 0.04, steel, 0.5); return [0.75, 1.95, 0.7];
    case 'dtable': B(0, 0.74, 0, 1.2, 0.05, 0.8, wood); for (const [x, z] of [[0.52, 0.32], [-0.52, 0.32], [0.52, -0.32], [-0.52, -0.32]]) B(x, 0.36, z, 0.06, 0.72, 0.06, wood);
      for (const s2 of [-1, 1]) { B(s2 * 0.85, 0.46, 0, 0.42, 0.05, 0.42, wood); B(s2 * 1.05, 0.75, 0, 0.05, 0.6, 0.42, wood); for (const [x, z] of [[0.17, 0.17], [-0.17, 0.17], [0.17, -0.17], [-0.17, -0.17]]) B(s2 * 0.85 + x, 0.22, z, 0.04, 0.44, 0.04, wood); } return [1.2, 0.78, 0.8];
    case 'bed': B(0, 0.22, 0, 1.6, 0.3, 2.0, wood); B(0, 0.45, 0.02, 1.52, 0.18, 1.94, hex(0xe8e4dc), 0.83, 0.05); B(0, 0.56, 0.35, 1.54, 0.06, 1.3, fab, 0.83, 0.03); for (const s2 of [-1, 1]) B(s2 * 0.38, 0.6, -0.72, 0.6, 0.12, 0.35, hex(0xf4f2ec), 0.83, 0.05); B(0, 0.62, -0.98, 1.64, 1.0, 0.08, wood); return [1.6, 0.62, 2.0];
    case 'night': B(0, 0.28, 0, 0.5, 0.56, 0.45, wood); B(0, 0.4, 0.226, 0.4, 0.12, 0.01, shade(wood, 0.7)); C(0.08, 0.56, -0.05, 0.05, 0.25, hex(0x8a8a8a)); B(0.08, 0.86, -0.05, 0.22, 0.16, 0.22, hex(0xf0e6c8), 0.02); return [0.5, 0.56, 0.45];
    case 'wardrobe': B(0, 1.05, 0, 1.4, 2.1, 0.6, wood, 0.63, 0.02); B(0, 1.05, 0.302, 0.012, 1.95, 0.01, shade(wood, 0.6)); for (const s2 of [-1, 1]) B(s2 * 0.08, 1.1, 0.32, 0.03, 0.22, 0.03, steel, 0.5); return [1.4, 2.1, 0.6];
    case 'medbox': B(0, 1.45, 0, 0.5, 0.6, 0.18, white, 0.5); B(0, 1.45, 0.092, 0.44, 0.54, 0.01, hex(0x9ab8c8), 0.5); B(0, 1.62, 0.1, 0.12, 0.04, 0.01, hex(0xd02020), 0.02); B(0, 1.62, 0.1, 0.04, 0.12, 0.01, hex(0xd02020), 0.02); return null;
    case 'rug': B(0, 0.01, 0, 2.2, 0.02, 1.6, [hex(0x8a3a2a), hex(0x3a5a7a), hex(0x7a6a3a)][Math.floor(r() * 3)], 0.83); return null;
    case 'sofa': B(0, 0.24, 0.05, 2.0, 0.36, 0.85, fab, 0.83, 0.06); B(0, 0.62, -0.32, 2.0, 0.62, 0.22, fab, 0.83, 0.06); for (const s2 of [-1, 1]) B(s2 * 0.92, 0.45, 0.02, 0.18, 0.5, 0.88, shade(fab, 0.9), 0.83, 0.05); for (const s2 of [-0.45, 0.45]) B(s2, 0.46, 0.08, 0.85, 0.1, 0.7, shade(fab, 1.1), 0.83, 0.04); return [2.0, 0.9, 0.9];
    case 'ctable': B(0, 0.4, 0, 1.0, 0.05, 0.55, wood); for (const [x, z] of [[0.44, 0.22], [-0.44, 0.22], [0.44, -0.22], [-0.44, -0.22]]) B(x, 0.19, z, 0.05, 0.38, 0.05, wood); return [1.0, 0.43, 0.55];
    case 'tvstand': B(0, 0.25, 0, 1.4, 0.5, 0.45, wood); B(0, 0.86, -0.05, 1.12, 0.66, 0.06, dark, 0.5); B(0, 0.86, -0.015, 1.04, 0.58, 0.01, hex(0x111418), 0.5); B(0, 0.53, -0.05, 0.3, 0.06, 0.2, dark, 0.5); return [1.4, 1.2, 0.45];
    case 'shelf': B(0, 0.95, 0, 1.0, 1.9, 0.35, wood); for (let k = 0; k < 4; k++) { B(0, 0.25 + k * 0.45, 0.02, 0.92, 0.03, 0.32, shade(wood, 0.8)); let x = -0.42; while (x < 0.4) { const w = 0.05 + r() * 0.05, h = 0.25 + r() * 0.12; B(x + w / 2, 0.27 + k * 0.45 + h / 2, 0.03, w, h, 0.24, [hex(0x8a2a2a), hex(0x2a4a7a), hex(0x3a6a3a), hex(0xc8b080), hex(0x5a3a6a)][Math.floor(r() * 5)], 0.83); x += w + 0.01; } } return [1.0, 1.9, 0.35];
    case 'lamp': C(0, 0, 0, 0.14, 0.03, dark); C(0, 0.03, 0, 0.02, 1.5, dark); mb.setColor(hex(0xf2e6c4), 0.02); mb.cylinder(mat4.mul(mat4.create(), T, M(0, 1.45, 0)), 0.22, 0.14, 0.3, 10, hex(0xf2e6c4)); return null;
    case 'hbed': B(0, 0.45, 0, 0.95, 0.1, 2.0, steel, 0.5); B(0, 0.58, 0, 0.9, 0.16, 1.95, hex(0xf2f4f6), 0.83, 0.04); for (const z of [-0.95, 0.95]) for (const x of [-0.42, 0.42]) C(x, 0, z, 0.03, 0.5, steel); B(0, 0.85, -0.97, 0.95, 0.6, 0.05, steel, 0.5); for (const s2 of [-1, 1]) B(s2 * 0.5, 0.78, 0.2, 0.03, 0.18, 1.1, steel, 0.5); B(0, 0.68, -0.7, 0.6, 0.1, 0.3, white, 0.83, 0.04); return [0.95, 0.9, 2.0];
    case 'drip': C(0, 0, 0, 0.2, 0.03, steel); C(0, 0, 0, 0.02, 1.8, steel); B(0, 1.65, 0.05, 0.12, 0.18, 0.04, hex(0xcfe8f0), 0.5); return null;
    case 'desk': B(0, 0.5, 0, 2.2, 1.0, 0.7, white, 0.93); B(0, 1.02, 0, 2.3, 0.05, 0.8, hex(0x6a8aa0), 0.5); B(0.5, 1.2, -0.1, 0.5, 0.32, 0.04, dark, 0.5); return [2.2, 1.05, 0.7];
    case 'medcabinet': B(0, 0.95, 0, 1.0, 1.9, 0.42, white, 0.5); B(0, 1.25, 0.212, 0.92, 1.1, 0.01, hex(0xa8c8d8), 0.5); for (let k = 0; k < 3; k++) for (let j = 0; j < 4; j++) B(-0.33 + j * 0.22, 0.85 + k * 0.34, 0.1, 0.14, 0.18, 0.12, [hex(0xffffff), hex(0xe8a040), hex(0x60b060), hex(0x5080d0)][(k + j) % 4], 0.83); B(0, 1.92, 0.22, 0.2, 0.06, 0.01, hex(0xd02020), 0.02); B(0, 1.92, 0.22, 0.06, 0.2, 0.01, hex(0xd02020), 0.02); return [1.0, 1.9, 0.42];
    case 'shelf2': B(0, 0.8, 0, 2.4, 1.6, 0.6, white, 0.5); for (let k = 0; k < 4; k++) for (let j = 0; j < 8; j++) for (const zz of [-0.22, 0.22]) B(-1.05 + j * 0.3, 0.32 + k * 0.38, zz, 0.2, 0.2, 0.14, [hex(0xffffff), hex(0xe86a40), hex(0x60c060), hex(0x5080d0), hex(0xf0d040)][(k * 3 + j) % 5], 0.83); return [2.4, 1.6, 0.6];
    case 'shelfwall': { const L = 3.2; B(0, 1.0, 0, L, 2.0, 0.4, white, 0.5); for (let k = 0; k < 5; k++) for (let j = 0; j < 11; j++) B(-L / 2 + 0.2 + j * 0.28, 0.3 + k * 0.38, 0.08, 0.18, 0.2, 0.16, [hex(0xffffff), hex(0xe86a40), hex(0x60c060), hex(0x5080d0), hex(0xf0d040)][(k + j) % 5], 0.83); return [L, 2.0, 0.4]; }
    case 'labbench': B(0, 0.45, 0, 2.4, 0.9, 0.9, hex(0xd8dadc), 0.5); B(0, 0.92, 0, 2.5, 0.05, 1.0, hex(0x1e2022), 0.93); for (let k = 0; k < 4; k++) { const x = -0.9 + k * 0.45; C(x, 0.95, 0.2, 0.05, 0.16, [hex(0x60e0a0), hex(0x60a0f0), hex(0xf0e060), hex(0xe06060)][k], 0.02, 8); } B(0.6, 1.1, -0.25, 0.5, 0.35, 0.35, hex(0x9aa0a6), 0.5); return [2.4, 1.0, 0.9];
    case 'labcabinet': B(0, 1.0, 0, 1.0, 2.0, 0.5, hex(0x8a9096), 0.5); B(0, 1.0, 0.252, 0.012, 1.85, 0.01, hex(0x3a3a3a)); for (let k = 0; k < 6; k++) B(-0.45 + k * 0.18, 1.85, 0.255, 0.09, 0.14, 0.01, k % 2 ? hex(0x111111) : hex(0xf0c419), 0.93); return [1.0, 2.0, 0.5];
    case 'workbench': B(0, 0.45, 0, 2.6, 0.9, 0.8, hex(0x6a4a30)); B(0, 0.92, 0, 2.7, 0.06, 0.86, hex(0x3a3a3c), 0.5); B(0, 1.5, -0.38, 2.6, 1.1, 0.04, hex(0x8a8070)); for (let k = 0; k < 6; k++) B(-1.0 + k * 0.4, 1.4 + (k % 2) * 0.2, -0.34, 0.06, 0.32, 0.04, [steel, hex(0xc03020), hex(0xe0b020)][k % 3], 0.5); B(0.8, 1.02, 0.1, 0.4, 0.14, 0.24, hex(0xc03020), 0.5); return [2.6, 0.95, 0.8];
    case 'tirerack': B(0, 0.9, 0, 2.4, 1.8, 0.5, hex(0x4a4c50), 0.5); for (let k = 0; k < 2; k++) for (let j = 0; j < 4; j++) { mb.setColor(hex(0x1c1c1e), 0.7); mb.cylinder(mat4.mul(mat4.create(), T, M(-0.9 + j * 0.6, 0.35 + k * 0.85, 0, 0, 1, Math.PI / 2)), 0.32, 0.32, 0.22, 10, hex(0x1c1c1e)); } return [2.4, 1.8, 0.5];
    case 'drums': for (const [x, z, c] of [[-0.35, 0, hex(0xc03020)], [0.35, 0, hex(0x2a5a9a)], [0, 0.55, hex(0x3a6a3a)]]) C(x, 0, z, 0.3, 0.88, c, 0.5, 12); return [1.2, 0.9, 1.0];
    case 'pew': B(0, 0.42, 0, 2.6, 0.08, 0.45, wood); B(0, 0.78, -0.2, 2.6, 0.6, 0.06, wood); for (const s of [-1, 1]) B(s * 1.25, 0.42, 0, 0.08, 0.84, 0.5, shade(wood, 0.8)); return [2.6, 0.9, 0.5];
    case 'altar': B(0, 0.5, 0, 2.0, 1.0, 0.9, hex(0xe8e4da), 0.93); B(0, 1.01, 0, 2.1, 0.04, 1.0, hex(0xc8a848), 0.83); B(0, 1.6, -0.3, 0.08, 1.0, 0.08, hex(0xc8a848), 0.5); B(0, 1.85, -0.3, 0.5, 0.08, 0.08, hex(0xc8a848), 0.5); for (const s of [-1, 1]) C(s * 0.7, 1.03, 0.1, 0.04, 0.3, hex(0xf4ecd8), 0.02, 6); return [2.0, 1.05, 0.9];
    case 'fumehood': B(0, 1.1, 0, 1.5, 2.2, 0.8, hex(0xc8ccd0), 0.5); B(0, 1.3, 0.402, 1.3, 0.8, 0.01, hex(0x9ab8c8), 0.5); B(0, 0.9, 0.2, 1.4, 0.04, 0.5, hex(0x1e2022), 0.93); return [1.5, 2.2, 0.8];
  }
  return null;
}
// roupa R.A.T dobrada (como é encontrada): traje amarelo dobrado com cinto e a máscara de gás em cima
export function ratFoldedMesh() {
  const mb = new MeshBuilder(); const y = hex(0xf2b705), yd = hex(0xd29a00), blk = hex(0x1e1f22), gr = hex(0x3a3c40), visor = hex(0x2a2e3a), buck = hex(0x6a6c70);
  mb.setColor(y, 0.83); mb.roundBox(M(0, 0.07, 0), 0.62, 0.14, 0.44, y, 0.05, 1); mb.roundBox(M(0, 0.17, -0.02), 0.58, 0.1, 0.4, yd, 0.04, 1); mb.roundBox(M(0, 0.25, -0.14), 0.32, 0.12, 0.2, y, 0.06, 1); // capuz
  mb.setColor(blk, 0.7); mb.box(M(0, 0.12, 0.08), 0.66, 0.05, 0.06, blk); for (const s of [-1, 1]) mb.box(M(s * 0.18, 0.14, 0), 0.05, 0.05, 0.47, blk);
  mb.setColor(buck, 0.5); mb.box(M(0, 0.12, 0.115), 0.08, 0.06, 0.01, buck);
  mb.setColor(visor, 0.5); mb.roundBox(M(0, 0.3, -0.08), 0.22, 0.06, 0.12, visor, 0.02, 1);
  mb.setColor(gr, 0.7); mb.cylinder(M(0, 0.3, -0.0, 0, 1, Math.PI / 2), 0.045, 0.045, 0.06, 10, gr); for (const s of [-1, 1]) mb.cylinder(M(s * 0.08, 0.29, 0.01, 0, 1, Math.PI / 2, s * 0.4), 0.04, 0.04, 0.05, 10, blk);
  mb.setColor(hex(0x111111), 0.02); for (let k = 0; k < 3; k++) { const a = k * 2.094; mb.box(M(0.16 + Math.cos(a) * 0.03, 0.223, 0.05 + Math.sin(a) * 0.03), 0.03, 0.005, 0.03, hex(0x111111)); }
  return mb.build();
}
// caixa militar grande (verde-oliva, com faixas e estêncil)
export function milCrateMesh() {
  const mb = new MeshBuilder(); const o = hex(0x4e5432), od = hex(0x3a3f26), st = hex(0x8a8e90);
  mb.setColor(o, 0.63); mb.roundBox(M(0, 0.5, 0), 1.6, 1.0, 0.9, o, 0.04, 1); mb.setColor(od, 0.63); for (const x of [-0.6, 0.6]) mb.box(M(x, 0.5, 0), 0.08, 1.02, 0.92, od);
  mb.box(M(0, 1.01, 0), 1.62, 0.04, 0.92, od); mb.setColor(st, 0.5); for (const x of [-0.35, 0.35]) mb.box(M(x, 0.75, 0.455), 0.12, 0.1, 0.02, st);
  mb.setColor(hex(0xd8d4b0), 0.83); mb.box(M(0, 0.45, 0.452), 0.5, 0.12, 0.01, hex(0xd8d4b0)); return mb.build();
}
