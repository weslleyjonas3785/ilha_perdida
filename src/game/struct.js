// Construção por projeto (estilo base de sobrevivência):
// • "Projeto" na mão + segurar o botão direito → roda com as peças (fundação, fundação triangular, parede, meia parede,
//   parede com porta, escada, escada vertical, telhado, rampa, telhado com alçapão, telhado triangular). Escolhe soltando
//   o botão em cima da peça; a prévia encaixa sozinha (bordas das fundações/telhados, topo das paredes) e o botão esquerdo
//   constrói — o personagem abre o projeto nas mãos e a peça vai subindo.
// • "Martelo de madeira" na mão: botão esquerdo olhando para a peça → repara (gasta material do nível dela);
//   segurar o direito → roda "Upar / Mudar posição / Demolir". Demolir devolve metade do material do nível atual.
//   Níveis: Projeto (galhos) → Madeira → Pedra → Metal.
// • Só se constrói dentro da área de uma Bandeira de território do próprio dono (raio 32 m). Peças sem apoio caem.
import { MeshBuilder, M, hex, shade } from '../engine/mesh.js';
import { mat4, quat } from '../engine/math.js';
import { PIECES } from './items.js';

export const CELL = 3, WALL_H = 3, FLAG_R = 32, FLAG_GAP = 70;
const TRI_IN = Math.sqrt(3) / 2, TRI_CR = Math.sqrt(3);
export const TIERS = [
  { id: 0, name: 'Projeto (galhos)', short: 'Galhos', cost: { wood: 2 }, hp: 60, col: 0xc8a466 },
  { id: 1, name: 'Madeira', short: 'Madeira', cost: { wood: 6 }, hp: 260, col: 0x8a5a32 },
  { id: 2, name: 'Pedra', short: 'Pedra', cost: { stone: 8 }, hp: 520, col: 0x8e8b84 }, // o dobro da madeira
  { id: 3, name: 'Metal', short: 'Metal', cost: { scrap: 5 }, hp: 1100, col: 0x6c737a },
];
// peças do projeto (ordem da roda)
export const STYPES = {
  s_found: { name: 'Fundação', icon: '⬛', kind: 'floor', shape: 'sq', mul: 1 },
  s_tfound: { name: 'Fundação triangular', icon: '🔺', kind: 'floor', shape: 'tri', mul: 0.5 },
  s_wall: { name: 'Parede', icon: '🧱', kind: 'wall', h: 3, mul: 1 },
  s_halfwall: { name: 'Meia parede', icon: '▬', kind: 'wall', h: 1.5, mul: 0.5 },
  s_doorway: { name: 'Parede com porta', icon: '🚪', kind: 'wall', h: 3, mul: 1, door: true, extra: { fiber: 2 } },
  s_stairs: { name: 'Escada', icon: '🪜', kind: 'cell', mul: 1.5 },
  s_ladder: { name: 'Escada vertical', icon: '🪜', kind: 'ladder', fixed: { wood: 3, fiber: 1 } },
  s_roof: { name: 'Telhado', icon: '⬜', kind: 'ceil', shape: 'sq', mul: 1 },
  s_ramp: { name: 'Rampa', icon: '◢', kind: 'cell', mul: 1 },
  s_hatch: { name: 'Telhado com alçapão', icon: '🔳', kind: 'ceil', shape: 'sq', mul: 1, hatch: true, extra: { fiber: 1 } },
  s_troof: { name: 'Telhado triangular', icon: '🔻', kind: 'ceil', shape: 'tri', mul: 0.5 },
};
export const isStruct = (t) => !!STYPES[t];
// dano de explosão nas peças por nível [galhos, madeira, pedra, metal]
const BLAST = { c4: [Infinity, Infinity, 360, 370], rocket: [240, 200, 130, 80], grenade: [150, 120, 55, 25] };
// combinações que podem se encostar (o encaixe já impede duas peças no mesmo lugar)
const compat = (a, b) => { const A = STYPES[a].kind, B = STYPES[b].kind; if (A === 'ladder' || B === 'ladder') return true; const pa = A === 'floor' || A === 'ceil', pb = B === 'floor' || B === 'ceil'; if (pa && pb) return true; if (A === 'wall' || B === 'wall') return true; if ((A === 'cell' && pb) || (B === 'cell' && pa)) return true; return false; };
const plat = (t) => STYPES[t] && (STYPES[t].kind === 'floor' || STYPES[t].kind === 'ceil');
export function costOf(type, tier) {
  const d = STYPES[type]; if (d.fixed) return { ...d.fixed }; const out = {};
  for (const [k, n] of Object.entries(TIERS[tier].cost)) out[k] = Math.max(1, Math.ceil(n * d.mul));
  if (tier === 0 && d.extra) for (const [k, n] of Object.entries(d.extra)) out[k] = (out[k] || 0) + n;
  return out;
}
export const maxHp = (type, tier) => Math.round(TIERS[STYPES[type].fixed ? 1 : tier].hp * (STYPES[type].mul && STYPES[type].mul < 1 ? 0.75 : 1));

// bordas de uma peça de piso (quadrada: 4, triangular: 3): ponto médio, normal para fora, ângulo
const A_SQ = [0, Math.PI / 2, Math.PI, -Math.PI / 2], A_TRI = [Math.PI, Math.PI / 3, -Math.PI / 3];
export function edges(p) {
  const tri = STYPES[p.type].shape === 'tri'; const r = tri ? TRI_IN : 1.5;
  return (tri ? A_TRI : A_SQ).map((a) => { const g = p.rot + a, nx = Math.sin(g), nz = Math.cos(g); return { mx: p.x + nx * r, mz: p.z + nz * r, nx, nz, ang: g }; });
}
const inr = (shape) => (shape === 'tri' ? TRI_IN : 1.5);
const L = (x, z, rot) => (lx, lz) => [x + lx * Math.cos(rot) + lz * Math.sin(rot), z - lx * Math.sin(rot) + lz * Math.cos(rot)];

// ---------- colisores ----------
export function structShapes(type, x, y, z, rot) {
  const W = L(x, z, rot); const box = (lx, lz, hx, hz, y0, y1, extra = {}) => { const [px, pz] = W(lx, lz); return { type: 'box', x: px, z: pz, hx, hz, rot, y0: y + y0, y1: y + y1, ...extra }; };
  const triSlices = (y0, y1) => { const out = [], N = 5, z0 = -TRI_IN, z1 = TRI_CR; for (let k = 0; k < N; k++) { const a = z0 + (z1 - z0) * k / N, b = z0 + (z1 - z0) * (k + 1) / N, m = (a + b) / 2; const hw = 1.5 * (TRI_CR - m) / (TRI_CR + TRI_IN); out.push(box(0, m, Math.max(0.08, hw), (b - a) / 2, y0, y1, { platform: true })); } return out; };
  switch (type) {
    case 's_found': return [box(0, 0, 1.5, 1.5, -3, 0, { platform: true })];
    case 's_tfound': return triSlices(-3, 0);
    case 's_wall': return [box(0, 0, 1.5, 0.15, 0, 3, { noClimb: true })];
    case 's_halfwall': return [box(0, 0, 1.5, 0.15, 0, 1.5)];
    case 's_doorway': return [box(-1.05, 0, 0.45, 0.15, 0, 3, { noClimb: true }), box(1.05, 0, 0.45, 0.15, 0, 3, { noClimb: true }), box(0, 0, 0.6, 0.15, 2.2, 3), box(0, 0, 0.6, 0.06, 0, 2.2, { leaf: true, noClimb: true })];
    case 's_roof': return [box(0, 0, 1.5, 1.5, -0.25, 0, { platform: true })];
    case 's_hatch': return [box(0, 1.05, 1.5, 0.45, -0.25, 0, { platform: true }), box(0, -1.05, 1.5, 0.45, -0.25, 0, { platform: true }), box(1.05, 0, 0.45, 0.6, -0.25, 0, { platform: true }), box(-1.05, 0, 0.45, 0.6, -0.25, 0, { platform: true }), box(0, 0, 0.6, 0.6, -0.2, 0, { leaf: true, platform: true })];
    case 's_troof': return triSlices(-0.25, 0);
    case 's_stairs': { const out = []; for (let k = 0; k < 12; k++) out.push(box(0, -1.5 + 0.125 + k * 0.25, 0.7, 0.125, 0, (k + 1) * 0.25)); return out; }
    case 's_ramp': { const out = []; for (let k = 0; k < 20; k++) out.push(box(0, -1.5 + 0.075 + k * 0.15, 1.5, 0.075, 0, (k + 1) * 0.15)); return out; }
    case 's_ladder': return [];
    case 'flag': return [{ type: 'cyl', x, z, r: 0.22, y0: y - 0.1, y1: y + 2.0 }];
  }
  return [];
}

// ---------- malhas por nível ----------
function prism(mb, pts, y0, y1, c) { // polígono convexo extrudado (pts no sentido anti-horário visto de cima)
  const n = pts.length; const top = [], bot = [];
  for (const [x, z] of pts) { top.push(mb.vert([x, y1, z], [0, 1, 0], c)); bot.push(mb.vert([x, y0, z], [0, -1, 0], c)); }
  for (let i = 1; i < n - 1; i++) { mb.tri(top[0], top[i + 1], top[i]); mb.tri(bot[0], bot[i], bot[i + 1]); }
  for (let i = 0; i < n; i++) { const a = pts[i], b = pts[(i + 1) % n]; const ex = b[0] - a[0], ez = b[1] - a[1], l = Math.hypot(ex, ez) || 1; const nrm = [ez / l, 0, -ex / l];
    const v0 = mb.vert([a[0], y0, a[1]], nrm, c), v1 = mb.vert([b[0], y0, b[1]], nrm, c), v2 = mb.vert([b[0], y1, b[1]], nrm, c), v3 = mb.vert([a[0], y1, a[1]], nrm, c); mb.tri(v0, v2, v1); mb.tri(v0, v3, v2); }
}
const TRI_PTS = [[-1.5, -TRI_IN], [0, TRI_CR], [1.5, -TRI_IN]];
const SQ_PTS = [[-1.5, -1.5], [-1.5, 1.5], [1.5, 1.5], [1.5, -1.5]];
const ROUGH = [0.9, 0.85, 0.95, 0.45];
// painel vertical (parede) com o acabamento do nível nas duas faces
function wallPanel(mb, tier, cx, w, y0, y1, t, c) {
  const S = (col) => mb.setColor(col, ROUGH[tier]); S(c); mb.box(M(cx, (y0 + y1) / 2, 0), w, y1 - y0, t, c);
  const dk = shade(c, 0.72), lt = shade(c, 1.15), h = y1 - y0;
  for (const sd of [-1, 1]) { const zf = sd * (t / 2 + 0.006);
    if (tier === 0) { S(dk); for (const lx of [-w / 2 + 0.06, w / 2 - 0.06]) mb.box(M(cx + lx, (y0 + y1) / 2, zf), 0.08, h, 0.02, dk); mb.box(M(cx, y1 - 0.06, zf), w, 0.08, 0.02, dk); mb.box(M(cx, y0 + 0.06, zf), w, 0.08, 0.02, dk);
      const ang = Math.atan2(h, w); for (const s2 of [-1, 1]) mb.box(mat4.mul(mat4.create(), M(cx, (y0 + y1) / 2, zf), M(0, 0, 0, 0, 1, 0, s2 * ang)), Math.hypot(w, h) * 0.95, 0.06, 0.02, dk); }
    else if (tier === 1) { S(dk); const n = Math.max(2, Math.round(w / 0.3)); for (let k = 1; k < n; k++) mb.box(M(cx - w / 2 + k * w / n, (y0 + y1) / 2, zf), 0.025, h, 0.012, dk); S(lt); mb.box(M(cx, y0 + h * 0.3, zf * 1.01), w, 0.12, 0.03, shade(c, 0.85)); mb.box(M(cx, y0 + h * 0.75, zf * 1.01), w, 0.12, 0.03, shade(c, 0.85)); }
    else if (tier === 2) { S(dk); const rows = Math.max(2, Math.round(h / 0.38)); for (let k = 1; k < rows; k++) mb.box(M(cx, y0 + k * h / rows, zf), w, 0.03, 0.012, dk);
      for (let k = 0; k < rows; k++) { const off = k % 2 ? 0.3 : 0; for (let x = -w / 2 + 0.6 + off; x < w / 2 - 0.05; x += 0.6) mb.box(M(cx + x, y0 + (k + 0.5) * h / rows, zf), 0.03, h / rows, 0.012, dk); } }
    else { S(lt); const n = Math.max(2, Math.round(h / 0.75)); for (let k = 0; k <= n; k++) mb.box(M(cx, y0 + 0.05 + k * (h - 0.1) / n, zf), w, 0.06, 0.03, lt); S(dk); for (let k = 0; k <= n; k++) for (const lx of [-w / 2 + 0.1, w / 2 - 0.1]) mb.box(M(cx + lx, y0 + 0.05 + k * (h - 0.1) / n, zf * 1.02), 0.035, 0.035, 0.035, dk); } }
}
// acabamento de cima dos pisos
function floorTop(mb, tier, pts, y, c, hole) {
  const dk = shade(c, 0.72); mb.setColor(dk, ROUGH[tier]); const tri = pts.length === 3;
  const inside = (x, z) => { if (hole && Math.abs(x) < 0.62 && Math.abs(z) < 0.62) return false; if (!tri) return Math.abs(x) < 1.48 && Math.abs(z) < 1.48; return z > -TRI_IN + 0.02 && Math.abs(x) < 1.5 * (TRI_CR - z) / (TRI_CR + TRI_IN) - 0.02; };
  const lines = (along) => { for (let k = -1.2; k <= 1.21; k += tier === 1 ? 0.3 : tier === 2 ? 0.6 : 0.75) { const seg = []; for (let s = -1.5; s <= 1.5; s += 0.1) { const [x, z] = along ? [s, k] : [k, s]; if (inside(x, z)) seg.push(s); }
      if (seg.length < 2) continue; const a = seg[0], b = seg[seg.length - 1]; const m = (a + b) / 2; mb.box(M(along ? m : k, y + 0.006, along ? k : m), along ? b - a : 0.025, 0.012, along ? 0.025 : b - a, dk); } };
  if (tier === 0) { lines(true); } else if (tier === 1) lines(false); else { lines(true); lines(false); }
}
export function structMesh(type, tier) {
  const mb = new MeshBuilder(); const c = hex(TIERS[tier].col); const S = (col) => mb.setColor(col, ROUGH[tier]); const dk = shade(c, 0.7);
  switch (type) {
    case 's_found': S(c); prism(mb, SQ_PTS, -0.32, 0, c); S(shade(c, 0.78)); prism(mb, [[-1.42, -1.42], [-1.42, 1.42], [1.42, 1.42], [1.42, -1.42]], -3, -0.32, shade(c, 0.78)); floorTop(mb, tier, SQ_PTS, 0, c); break;
    case 's_tfound': S(c); prism(mb, TRI_PTS, -0.32, 0, c); S(shade(c, 0.78)); prism(mb, TRI_PTS.map(([x, z]) => [x * 0.94, z * 0.94]), -3, -0.32, shade(c, 0.78)); floorTop(mb, tier, TRI_PTS, 0, c); break;
    case 's_wall': wallPanel(mb, tier, 0, 3, 0, 3, 0.3, c); break;
    case 's_halfwall': wallPanel(mb, tier, 0, 3, 0, 1.5, 0.3, c); break;
    case 's_doorway': wallPanel(mb, tier, -1.05, 0.9, 0, 3, 0.3, c); wallPanel(mb, tier, 1.05, 0.9, 0, 3, 0.3, c); wallPanel(mb, tier, 0, 1.2, 2.2, 3, 0.3, c); break;
    case 's_roof': S(c); prism(mb, SQ_PTS, -0.25, 0, c); floorTop(mb, tier, SQ_PTS, 0, c); S(dk); for (const z of [-0.75, 0.75]) mb.box(M(0, -0.29, z), 2.9, 0.08, 0.12, dk); break;
    case 's_troof': S(c); prism(mb, TRI_PTS, -0.25, 0, c); floorTop(mb, tier, TRI_PTS, 0, c); break;
    case 's_hatch': S(c); for (const [x, z, w, d] of [[0, 1.05, 3, 0.9], [0, -1.05, 3, 0.9], [1.05, 0, 0.9, 1.2], [-1.05, 0, 0.9, 1.2]]) prism(mb, [[x - w / 2, z - d / 2], [x - w / 2, z + d / 2], [x + w / 2, z + d / 2], [x + w / 2, z - d / 2]], -0.25, 0, c); floorTop(mb, tier, SQ_PTS, 0, c, true);
      S(dk); for (const [x, z, w, d] of [[0, 0.62, 1.28, 0.05], [0, -0.62, 1.28, 0.05], [0.62, 0, 0.05, 1.28], [-0.62, 0, 0.05, 1.28]]) mb.box(M(x, 0.02, z), w, 0.05, d, dk); break;
    case 's_stairs': { S(c); for (let k = 0; k < 12; k++) { mb.box(M(0, (k + 1) * 0.25 - 0.06, -1.5 + 0.125 + k * 0.25), 1.4, 0.12, 0.25, c); } S(dk); for (const sx of [-0.72, 0.72]) { const len = Math.hypot(3, 3); mb.box(mat4.mul(mat4.create(), M(sx, 1.4, 0), M(0, 0, 0, 0, 1, -Math.PI / 4, 0)), 0.08, 0.3, len, dk); } S(shade(c, 0.85)); for (let k = 0; k < 12; k += 3) mb.box(M(0, (k + 1) * 0.125, -1.5 + 0.125 + k * 0.25), 1.36, (k + 1) * 0.25 - 0.12, 0.08, shade(c, 0.85)); break; }
    case 's_ramp': { S(c); const ang = Math.atan2(3, 3), len = Math.hypot(3, 3); mb.box(mat4.mul(mat4.create(), M(0, 1.5 - 0.1, 0), M(0, 0, 0, 0, 1, -ang, 0)), 3, 0.2, len, c); S(dk); for (let k = 1; k < 8; k++) { const t = k / 8; mb.box(mat4.mul(mat4.create(), M(0, t * 3 + 0.005, -1.5 + t * 3), M(0, 0, 0, 0, 1, -ang, 0)), 2.95, 0.02, 0.05, dk); } prism(mb, [[-1.5, 1.5], [1.5, 1.5], [1.5, 1.35], [-1.5, 1.35]], 0, 3, dk); break; }
    case 's_ladder': { const wd = hex(0x7a5634); mb.setColor(wd, 0.8); for (const sx of [-0.25, 0.25]) mb.box(M(sx, 1.5, 0), 0.06, 3, 0.06, wd); for (let k = 0; k < 10; k++) mb.box(M(0, 0.25 + k * 0.29, 0), 0.5, 0.04, 0.05, shade(wd, 0.85)); break; }
  }
  return mb.build();
}
export function flagMesh(col = 0xc0302a) {
  const mb = new MeshBuilder(); const wd = hex(0x5a4430), cl = hex(col), st = hex(0x8a8a88);
  mb.setColor(st, 0.6); mb.cylinder(M(0, 0, 0), 0.32, 0.28, 0.25, 10, st); mb.setColor(wd, 0.8); mb.cylinder(M(0, 0.2, 0), 0.06, 0.05, 4.0, 8, wd); mb.sphere(M(0, 4.22, 0), 0.08, 8, 6, hex(0xd0b040));
  mb.setColor(cl, 0.85); for (let k = 0; k < 6; k++) { const x = 0.06 + k * 0.2; mb.box(M(x + 0.1, 3.6 + Math.sin(k * 1.1) * 0.05, Math.sin(k * 0.9) * 0.06), 0.2, 0.75, 0.02, k % 2 ? cl : shade(cl, 0.85)); }
  mb.setColor(hex(0xf0e0b0), 0.85); mb.box(M(0.65, 3.6, 0.015), 0.3, 0.3, 0.02, hex(0xf0e0b0));
  return mb.build();
}
// projeto aberto nas mãos (folha azul) e itens de mão
export function blueprintSheetMesh() { const mb = new MeshBuilder(); const b = hex(0x2a5aa8), l = hex(0x9ac0f0); mb.setColor(b, 0.9); mb.box(M(0, 0, 0), 0.95, 0.62, 0.012, b); mb.setColor(l, 0.9);
  for (let k = -2; k <= 2; k++) { mb.box(M(k * 0.16, 0, 0.008), 0.008, 0.5, 0.004, l); mb.box(M(0, k * 0.1, 0.008), 0.8, 0.008, 0.004, l); } mb.box(M(-0.1, 0.05, 0.01), 0.35, 0.22, 0.004, shade(l, 1.1)); return mb.build(); }
export function blueprintRollMesh() { const mb = new MeshBuilder(); const b = hex(0x2a5aa8); mb.setColor(b, 0.9); mb.cylinder(M(0, -0.12, 0), 0.04, 0.04, 0.5, 10, b); mb.setColor(hex(0xc8b080), 0.9); mb.cylinder(M(0, 0.1, 0), 0.042, 0.042, 0.03, 10, hex(0xc8b080)); return mb.build(); }
export function hammerMesh() { const mb = new MeshBuilder(); const wd = hex(0x8a6038), hd = hex(0x6a4a2c); mb.setColor(wd, 0.8); mb.cylinder(M(0, -0.05, 0), 0.022, 0.02, 0.42, 8, wd); mb.setColor(hd, 0.8); mb.roundBox(M(0, 0.38, 0), 0.075, 0.075, 0.2, hd, 0.012, 1); mb.setColor(hex(0x4a3420), 0.9); mb.cylinder(M(0, 0.0, 0), 0.026, 0.026, 0.1, 8, hex(0x4a3420)); return mb.build(); }

// ---------- sistema ----------
export class StructSystem {
  constructor(game) { this.g = game; this.mode = null; this.ghost = null; this.rot = 0; this.meshes = {}; this.radial = null; this.target = null; this.grow = new Map(); }
  mesh(type, tier) { const k = type + tier; return this.meshes[k] || (this.meshes[k] = this.g.renderer.createMesh(structMesh(type, tier))); }
  myId() { const g = this.g; return g.net ? g.net.pid() : 'me'; }
  flags() { return this.g.build.pieces.filter((p) => p.type === 'flag'); }
  // área de construção: bandeira do próprio dono
  ownFlagAt(x, z) { const me = this.myId(); return this.flags().find((f) => (f.data && f.data.owner) === me && Math.hypot(f.x - x, f.z - z) <= FLAG_R && (!f.data.dep || f.data.dep === 'done')); }
  foreignFlagNear(x, z, r) { const me = this.myId(); return this.flags().find((f) => (f.data && f.data.owner) !== me && Math.hypot(f.x - x, f.z - z) <= r); }
  structs() { return this.g.build.pieces.filter((p) => STYPES[p.type]); }

  // ---------- entrada (chamada quando o projeto ou o martelo está na mão) ----------
  input(act, dt) {
    const g = this.g, P = g.player, hand = g.equip.hand, I = g.input;
    const rightHeld = (g.input.enabled && I.mouse.right) || I.btn('block');
    if (rightHeld && !this.radial && !P.anim.busy) this.openRadial(hand === 'blueprint' ? 'build' : 'hammer');
    if (this.radial) { this.radial.vx += I.mouse.dx; this.radial.vy += I.mouse.dy; const R = this.radial; const m = Math.hypot(R.vx, R.vy); if (m > 160) { R.vx *= 160 / m; R.vy *= 160 / m; }
      R.sel = m > 28 ? Math.floor(((Math.atan2(R.vx, -R.vy) + Math.PI * 2 + Math.PI / R.opts.length) % (Math.PI * 2)) / (Math.PI * 2 / R.opts.length)) : -1; g.ui.radial && g.ui.radial(R);
      if (!rightHeld) this.closeRadial(true); return; }
    if (hand === 'blueprint') this._buildInput(act, dt); else this._hammerInput(act, dt);
  }
  openRadial(kind) {
    const g = this.g; let opts;
    if (kind === 'build') opts = Object.entries(STYPES).map(([id, d]) => ({ id, label: d.name, icon: d.icon, sub: Object.entries(costOf(id, 0)).map(([k, n]) => `${n} ${k === 'wood' ? 'madeira' : k === 'fiber' ? 'fibra' : k}`).join(' + ') }));
    else { const t = this.aimPiece(); if (!t) { g.ui.toast('Olhe para uma construção para ver as opções do martelo', 'info'); this.radial = null; this._needRelease = true; return; } this.target = t; const d = t.data || {}; const nt = d.tier + 1;
      if (t.type === 'flag') opts = [{ id: 'demo', label: 'Demolir', icon: '✖', sub: 'devolve metade' }]; else opts = [{ id: 'up', label: nt <= 3 && !STYPES[t.type].fixed ? `Upar → ${TIERS[nt].short}` : 'Nível máximo', icon: '⬆', sub: nt <= 3 && !STYPES[t.type].fixed ? this._costTxt(costOf(t.type, nt)) : '' }, { id: 'rot', label: 'Mudar posição', icon: '↻', sub: '' }, { id: 'demo', label: 'Demolir', icon: '✖', sub: 'devolve metade' }]; }
    if (this._needRelease) return;
    this.radial = { kind, opts, sel: -1, vx: 0, vy: 0 }; g.ui.radial && g.ui.radial(this.radial);
  }
  closeRadial(apply) {
    const g = this.g, R = this.radial; this.radial = null; g.ui.radial && g.ui.radial(null); if (!apply || !R || R.sel < 0) return; const o = R.opts[R.sel];
    if (R.kind === 'build') { this.mode = o.id; this.rot = 0; g.ui.toast(`${STYPES[o.id].icon} ${STYPES[o.id].name}: mire e clique para construir (Espaço ou R gira)`, 'info'); }
    else { const t = this.target; if (!t || !g.build.pieces.includes(t)) return; if (o.id === 'up') this.upgrade(t); else if (o.id === 'rot') this.rotate(t); else this.demolish(t); }
  }
  _costTxt(c) { const N = { wood: 'madeira', stone: 'pedra', scrap: 'sucata', fiber: 'fibra' }; return Object.entries(c).map(([k, n]) => `${n} ${N[k] || k}`).join(' + '); }
  _hint(html) { const el = document.getElementById('buildHint'); if (!el) return; if (!html) { if (this._hintOn) { el.classList.add('hidden'); this._hintOn = false; } return; } el.classList.remove('hidden'); el.innerHTML = html; this._hintOn = true; }
  cancel() { this.mode = null; this.ghost = null; if (this.radial) this.closeRadial(false); this.g.ui.buildStatus && this.g.ui.buildStatus(null); }
  update(dt) { // fora do input: animação das peças subindo e soltar o botão
    this._hpBar(dt); this._debUpdate(dt);
    for (const [p, t] of this.grow) { const n = t + dt / 1.4; if (n >= 1) this.grow.delete(p); else this.grow.set(p, n); }
    const g = this.g; if (!(g.input.mouse.right) && !g.input.btn('block')) this._needRelease = false;
    if (this.radial && (g.ui.anyOpen || !['blueprint', 'hammer'].includes(g.equip.hand))) this.closeRadial(false);
    if (this.mode && g.equip.hand !== 'blueprint') this.cancel();
    if (this._hintOn && g.equip.hand !== 'hammer' && !this.mode) this._hint(null);
    if (!this.mode && g.equip.hand === 'blueprint' && !this.radial) this._hint('<div>📜 <b>Projeto</b></div><div class="muted">Segure o botão direito para escolher a peça a construir</div>');
  }

  // ---------- prévia e encaixe ----------
  _ray() { const g = this.g, c = g.cam; const e = c.eye, t = c.target; const d = [t[0] - e[0], t[1] - e[1], t[2] - e[2]]; const l = Math.hypot(...d) || 1; return { o: e.slice(), d: d.map((v) => v / l) }; }
  _rayDist(ray, p) { const v = [p[0] - ray.o[0], p[1] - ray.o[1], p[2] - ray.o[2]]; const t = v[0] * ray.d[0] + v[1] * ray.d[1] + v[2] * ray.d[2]; if (t < 0) return [1e9, t]; const q = [ray.o[0] + ray.d[0] * t - p[0], ray.o[1] + ray.d[1] * t - p[1], ray.o[2] + ray.d[2] * t - p[2]]; return [Math.hypot(...q), t]; }
  // distância até onde a mira bate (terreno ou construção) — encaixes atrás disso não contam
  _hitT(ray) { const g = this.g, w = g.world; const S = this.structs().filter((p) => Math.hypot(p.x - ray.o[0], p.z - ray.o[2]) < 18);
    for (let t = 0.5; t < 14; t += 0.12) { const q = [ray.o[0] + ray.d[0] * t, ray.o[1] + ray.d[1] * t, ray.o[2] + ray.d[2] * t]; if (q[1] < w.height(q[0], q[2])) return t;
      for (const p of S) for (const c of p.colliders) if (!c.ghost && q[1] > c.y0 && q[1] < c.y1 && g.physics.insideXZ(c, q[0], q[2], 0)) return t; }
    return 1e9; }
  occupied(type, x, y, z, rot) { const k = STYPES[type].kind; return this.structs().find((q) => { const kq = STYPES[q.type].kind; const same = (k === kq) || (plat(type) && plat(q.type)); if (!same || Math.abs(q.y - y) > 0.3 || Math.hypot(q.x - x, q.z - z) > 0.35) return false; if (k === 'ladder') return Math.abs(Math.sin(q.rot - rot)) < 0.3; return true; }); }
  candidates(type) {
    const d = STYPES[type], out = [], near = this.structs().filter((q) => Math.hypot(q.x - this.g.player.pos[0], q.z - this.g.player.pos[2]) < 16);
    if (d.kind === 'floor' || d.kind === 'ceil') {
      for (const q of near) { if (!plat(q.type)) continue; const sameLevelOk = d.kind === 'floor' ? STYPES[q.type].kind === 'floor' : STYPES[q.type].kind === 'ceil';
        if (sameLevelOk) for (const e of edges(q)) { const r = inr(d.shape); out.push({ x: e.mx + e.nx * r, z: e.mz + e.nz * r, y: q.y, rot: Math.atan2(e.nx, e.nz), sup: q }); }
        if (d.kind === 'ceil' && STYPES[q.type].shape === d.shape) out.push({ x: q.x, z: q.z, y: q.y + WALL_H, rot: q.rot, sup: q, above: true }); }
    } else if (d.kind === 'wall') { for (const q of near) if (plat(q.type)) for (const e of edges(q)) out.push({ x: e.mx, z: e.mz, y: q.y, rot: e.ang, sup: q }); }
    else if (d.kind === 'cell') { for (const q of near) if (plat(q.type) && STYPES[q.type].shape === 'sq') for (let k = 0; k < 4; k++) out.push({ x: q.x, z: q.z, y: q.y, rot: q.rot + (k + this.rot) * Math.PI / 2, sup: q, k }); }
    else if (d.kind === 'ladder') { for (const q of near) { const s = STYPES[q.type]; if (s.kind === 'wall' && !s.door) for (const sd of [1, -1]) { const nx = Math.sin(q.rot) * sd, nz = Math.cos(q.rot) * sd; out.push({ x: q.x + nx * 0.2, z: q.z + nz * 0.2, y: q.y, rot: Math.atan2(nx, nz), sup: q, h: s.h }); }
      if (s.hatch) { const nx = Math.sin(q.rot), nz = Math.cos(q.rot); out.push({ x: q.x - nx * 0.5, z: q.z - nz * 0.5, y: q.y - WALL_H, rot: Math.atan2(nx, nz), sup: q, h: WALL_H, hatch: true }); } } }
    return out;
  }
  _buildInput(act, dt) {
    const g = this.g, P = g.player, type = this.mode; if (!type) { this.ghost = null; if (act.use && !this._hint) { this._hint = true; g.ui.toast('Segure o botão direito com o projeto na mão para escolher a peça', 'info'); } return; }
    if (act.rotate) this.rot++; if (g.input.mouse.wheel && g.input.locked) { this.rot += g.input.mouse.wheel > 0 ? 1 : -1; g.input.mouse.wheel = 0; }
    const d = STYPES[type], ray = this._ray(); let best = null, bs = 1.9; const tHit = this._hitT(ray);
    for (const c of this.candidates(type)) { if (d.kind === 'cell' && c.k !== 0) continue; const anchor = [c.x, c.y + (d.kind === 'wall' ? 1.4 : d.kind === 'ladder' ? 1.5 : d.kind === 'cell' ? 1.0 : 0), c.z]; const [dist, t] = this._rayDist(ray, anchor); if (t > 11 || t > tHit + (d.kind === 'ceil' ? 2.4 : 1.6)) continue; if (dist < bs && !this.occupied(type, c.x, c.y, c.z, c.rot)) { bs = dist; best = c; } }
    let reason = null;
    if (!best && d.kind === 'floor') { // fundação solta no terreno
      const f = g.cam.forward(); const x = P.pos[0] + f[0] * 4.2, z = P.pos[2] + f[1] * 4.2, rot = Math.round((g.cam.yaw + this.rot * Math.PI / 4) / (Math.PI / 12)) * Math.PI / 12; const w = g.world;
      const pts = (d.shape === 'tri' ? TRI_PTS : SQ_PTS).concat([[0, 0]]).map(([lx, lz]) => L(x, z, rot)(lx * 0.95, lz * 0.95)); let hmin = 1e9, hmax = -1e9; for (const [px, pz] of pts) { const h = w.height(px, pz); hmin = Math.min(hmin, h); hmax = Math.max(hmax, h); }
      best = { x, z, y: hmax + 0.25, rot, free: true }; if (hmax - hmin > 2.4) reason = 'Terreno muito inclinado'; if (hmin < 0.3) reason = 'Não pode construir na água';
      if (!reason) for (const s of structShapes(type, x, best.y, z, rot)) { const hit = g.physics.overlaps({ ...s, hx: s.hx * 0.95, hz: s.hz * 0.95, y0: hmin + 0.1 }, (c) => c.dyn || c.isPlayer || (c.piece && plat(c.piece.type))); if (hit) { reason = 'Sem espaço (obstáculo)'; break; } } }
    if (!best) { this.ghost = null; g.ui.buildStatus && g.ui.buildStatus({ type, reason: d.kind === 'wall' ? 'Mire na borda de uma fundação ou telhado' : d.kind === 'ceil' ? 'Mire em cima das paredes ou na borda de outro telhado' : d.kind === 'ladder' ? 'Mire numa parede ou alçapão' : 'Mire numa fundação ou telhado', valid: false, struct: true }); return; }
    if (!reason && !this.ownFlagAt(best.x, best.z)) reason = this.flags().length ? 'Fora da área da sua bandeira' : 'Coloque uma Bandeira de território primeiro';
    if (!reason && Math.hypot(best.x - P.pos[0], best.z - P.pos[2]) > 9) reason = 'Longe demais';
    if (!reason && !best.free && d.kind !== 'ladder') for (const s of structShapes(type, best.x, best.y, best.z, best.rot)) { if (s.leaf) continue; const sh = { ...s, hx: s.hx ? s.hx * 0.9 : s.hx, hz: s.hz ? s.hz * 0.9 : s.hz, y0: s.y0 + 0.08, y1: s.y1 - 0.08 };
      const hit = g.physics.overlaps(sh, (c) => c.dyn || c.isPlayer || (c.piece && STYPES[c.piece.type] && compat(type, c.piece.type))); if (hit) { this._lastHit = hit; reason = 'Sem espaço'; break; }
      if (sh.type === 'box' && g.physics.insideXZ({ ...sh, cos: Math.cos(sh.rot), sin: Math.sin(sh.rot) }, P.pos[0], P.pos[2], 0.36) && sh.y1 > P.pos[1] + 0.1 && sh.y0 < P.pos[1] + 1.8) { reason = 'Você está no caminho'; break; } }
    const cost = costOf(type, 0), afford = g.inv.has(cost);
    this.ghost = { type, x: best.x, y: best.y, z: best.z, rot: best.rot, valid: !reason && afford, reason: reason || (afford ? null : 'Recursos insuficientes: ' + this._costTxt(cost)), struct: true, h: best.h, hatch: best.hatch, free: !!best.free };
    g.ui.buildStatus && g.ui.buildStatus(this.ghost);
    if (act.use) this.place();
  }
  place() {
    const g = this.g, gh = this.ghost, P = g.player; if (!gh) return; if (!gh.valid) { g.ui.toast(gh.reason, 'warn'); g.audio.play('error'); return; } if (P.anim.busy) return;
    const cost = costOf(gh.type, 0); if (!g.inv.pay(cost)) { g.ui.toast('Recursos insuficientes', 'warn'); return; }
    const p = g.build.add({ type: gh.type, x: gh.x, y: gh.y, z: gh.z, rot: gh.rot, data: { tier: 0, hp: maxHp(gh.type, 0), owner: this.myId(), h: gh.h, hatchLadder: !!gh.hatch, spent: cost } });
    this.grow.set(p, 0); this.onAdded(p);
    P.doAction(P.clips.blueprint ? 'blueprint' : 'use', null, { speed: 1, faceCam: true }); g.audio.play('build'); g.fx.burst([gh.x, gh.y + 0.3, gh.z], 20, [0.55, 0.45, 0.32], 2.5, 0.8, 0.08); g.noise && g.noise(P.pos, 25, 'construção');
    g.stats.built++; g.net && g.net.onBuild && g.net.onBuild('add', p);
  }
  // escadas verticais entram na lista de escadas do mundo (subir/descer com E, igual às dos prédios)
  onAdded(p) { if (p.type !== 's_ladder') return; const w = this.g.world; const d = p.data || {}; const nx = Math.sin(p.rot), nz = Math.cos(p.rot); const h = d.h || WALL_H;
    const L = d.hatchLadder ? { x: p.x, z: p.z, nx: -nx, nz: -nz, y0: p.y, y1: p.y + h, ex: p.x + nx * 1.4, ez: p.z + nz * 1.4, piece: p } : { x: p.x + nx * 0.35, z: p.z + nz * 0.35, nx, nz, y0: p.y, y1: p.y + h, ex: p.x - nx * 1.0, ez: p.z - nz * 1.0, piece: p };
    p._ladder = L; w.ladders.push(L); }
  onRemoved(p) { this.grow.delete(p); if (p._ladder) { const w = this.g.world, i = w.ladders.indexOf(p._ladder); if (i >= 0) w.ladders.splice(i, 1); if (this.g.player.ladder === p._ladder) this.g.player.ladder = null; } }

  // ---------- martelo ----------
  aimPiece(maxD = 6) { const g = this.g, ray = this._ray(); const cand = g.build.pieces.filter((p) => (STYPES[p.type] || p.type === 'flag') && Math.hypot(p.x - ray.o[0], p.z - ray.o[2]) < maxD + 6); if (!cand.length) return null;
    const startT = Math.max(0, Math.hypot(g.player.pos[0] - ray.o[0], g.player.pos[2] - ray.o[2]) - 0.6);
    for (let t = startT; t < startT + maxD; t += 0.08) { const q = [ray.o[0] + ray.d[0] * t, ray.o[1] + ray.d[1] * t, ray.o[2] + ray.d[2] * t];
      for (const p of cand) for (const c of p.colliders) { if (q[1] < c.y0 - 0.05 || q[1] > c.y1 + 0.05) continue; if (g.physics.insideXZ(c, q[0], q[2], 0.04)) return p; }
      if (STYPES.s_ladder) for (const p of cand) if (p.type === 's_ladder' && Math.hypot(q[0] - p.x, q[2] - p.z) < 0.35 && q[1] > p.y && q[1] < p.y + 3) return p; }
    return null; }
  _hammerInput(act) {
    const g = this.g, P = g.player; const t = this.aimPiece(); this.target = t;
    if (t && t.type !== 'flag') { const d = t.data || {}; const mx = maxHp(t.type, d.tier || 0); this._hint(`<div>${STYPES[t.type].icon} <b>${STYPES[t.type].name}</b> — ${TIERS[d.tier || 0].name}</div><div class="st ${d.hp < mx - 0.5 ? 'no' : 'ok'}">Vida: ${Math.round(d.hp)}/${mx}</div><div class="muted">Clique: reparar · segure o botão direito: Upar / Mudar posição / Demolir</div>`); }
    else if (t) this._hint(`<div>🚩 <b>Bandeira de território</b></div><div class="muted">Segure o botão direito: Demolir</div>`); else this._hint(null);
    if (act.use && !P.anim.busy) { if (!t) { g.ui.toast('Mire em uma construção para reparar', 'info'); return; } this.repair(t); }
  }
  ownerOk(p) { const d = p.data || {}; if (d.owner && d.owner !== this.myId()) { this.g.ui.toast('Essa construção é de outro jogador', 'warn'); return false; } return true; }
  repair(p) { const g = this.g, P = g.player; if (p.type === 'flag') { g.ui.toast('A bandeira não precisa de reparo', 'info'); return; } const d = p.data; const mx = maxHp(p.type, d.tier);
    if (d.hp >= mx - 0.5) { g.ui.toast(`${STYPES[p.type].name} já está inteira (${Math.round(d.hp)}/${mx})`, 'info'); return; }
    const full = costOf(p.type, d.tier), frac = (mx - d.hp) / mx; const need = {}; for (const [k, n] of Object.entries(full)) need[k] = Math.max(1, Math.ceil(n * frac));
    if (!g.inv.has(need)) { g.ui.toast(`Para reparar precisa de: ${this._costTxt(need)}`, 'warn'); g.audio.play('error'); return; }
    g.inv.pay(need); P.doAction('chop', (n) => { if (n !== 'hit') return; d.hp = mx; g.audio.play('build'); g.fx.burst([p.x, p.y + 1.2, p.z], 10, [0.6, 0.5, 0.35], 2, 0.5, 0.05); g.ui.toast(`🔨 ${STYPES[p.type].name} reparada`, 'ok'); g.net && g.net.onBuild && g.net.onBuild('data', p); }, { faceCam: true, cost: 3 }); }
  upgrade(p) { const g = this.g, P = g.player; if (!this.ownerOk(p)) return; if (p.type === 'flag') return; const d = p.data, nt = d.tier + 1;
    if (STYPES[p.type].fixed || nt > 3) { g.ui.toast('Essa peça já está no nível máximo', 'info'); return; }
    const c = costOf(p.type, nt); if (!g.inv.has(c)) { g.ui.toast(`Para upar para ${TIERS[nt].name} precisa de: ${this._costTxt(c)}`, 'warn'); g.audio.play('error'); return; }
    g.inv.pay(c); d.tier = nt; d.hp = maxHp(p.type, nt); d.spent = c; this.grow.set(p, 0.35);
    P.doAction('chop', null, { faceCam: true, cost: 3 }); g.audio.play('build'); g.fx.burst([p.x, p.y + 1.2, p.z], 24, nt === 2 ? [0.6, 0.6, 0.6] : nt === 3 ? [0.7, 0.72, 0.75] : [0.55, 0.42, 0.28], 3, 0.8, 0.08);
    g.ui.toast(`⬆ ${STYPES[p.type].name}: ${TIERS[nt].name}`, 'ok'); g.net && g.net.onBuild && g.net.onBuild('data', p); }
  rotate(p) { const g = this.g; if (!this.ownerOk(p)) return; const k = STYPES[p.type] ? STYPES[p.type].kind : 'flag';
    let nr = null; if (k === 'wall') nr = p.rot + Math.PI; else if (k === 'cell') nr = p.rot + Math.PI / 2; else if (k === 'floor' && !this._hasNeighbors(p)) nr = p.rot + (STYPES[p.type].shape === 'tri' ? Math.PI / 3 : Math.PI / 4);
    if (nr === null) { g.ui.toast(k === 'ladder' ? 'A escada vertical não gira' : 'Essa peça já está encaixada — não dá para girar', 'info'); return; }
    const np = this.replace(p, { rot: nr }); g.audio.play('build'); g.ui.toast('↻ Posição alterada', 'ok'); g.net && g.net.onBuild && g.net.onBuild('rot', np, p.id); }
  _hasNeighbors(p) { return this.structs().some((q) => q !== p && Math.hypot(q.x - p.x, q.z - p.z) < 3.2 && Math.abs(q.y - p.y) < 3.2); }
  replace(p, ch) { const g = this.g, B = g.build; const o = { type: p.type, x: p.x, y: p.y, z: p.z, rot: p.rot, open: p.open, data: p.data, ...ch }; this.onRemoved(p); B.remove(p, false); const np = B.add(o); np.id = p.id; this.onAdded(np); return np; }
  demolish(p) { const g = this.g; if (!this.ownerOk(p)) return; const d = p.data || {}; const spent = p.type === 'flag' ? PIECES.flag.cost : costOf(p.type, d.tier || 0);
    this.onRemoved(p); g.build.remove(p, false); for (const [k, n] of Object.entries(spent)) { const h = Math.ceil(n / 2); const a = g.inv.add(k, h); if (a < h) g.dropItem(k, h - a, [p.x, p.y + 0.5, p.z]); }
    g.audio.play('build'); g.fx.burst([p.x, p.y + 1, p.z], 26, [0.5, 0.42, 0.32], 3.5, 0.9, 0.1); g.ui.toast(`✖ ${p.type === 'flag' ? 'Bandeira' : STYPES[p.type].name} demolida — voltou metade do material`, 'ok');
    g.net && g.net.onBuild && g.net.onBuild('del', p); this.collapse(); }
  // peças sem apoio caem: fundações apoiam paredes e escadas; paredes apoiam telhados; telhados apoiam telhados vizinhos e paredes
  supported() {
    const S = this.structs(), ok = new Set(); const near = (a, b, t = 0.35) => Math.hypot(a[0] - b[0], a[1] - b[1]) < t;
    for (const p of S) if (STYPES[p.type].kind === 'floor') ok.add(p);
    let changed = true, guard = 0; while (changed && guard++ < 60) { changed = false;
      for (const p of S) { if (ok.has(p)) continue; const k = STYPES[p.type].kind; let sup = false;
        if (k === 'wall') sup = S.some((q) => ok.has(q) && plat(q.type) && Math.abs(q.y - p.y) < 0.3 && edges(q).some((e) => near([e.mx, e.mz], [p.x, p.z])));
        else if (k === 'cell') sup = S.some((q) => ok.has(q) && plat(q.type) && Math.abs(q.y - p.y) < 0.3 && near([q.x, q.z], [p.x, p.z]));
        else if (k === 'ladder') sup = S.some((q) => ok.has(q) && Math.hypot(q.x - p.x, q.z - p.z) < 1.2 && (STYPES[q.type].kind === 'wall' || STYPES[q.type].hatch));
        else if (k === 'ceil') { const E = edges(p); sup = S.some((q) => ok.has(q) && ((STYPES[q.type].kind === 'wall' && Math.abs(q.y + STYPES[q.type].h - p.y) < 0.3 && E.some((e) => near([e.mx, e.mz], [q.x, q.z]))) || (STYPES[q.type].kind === 'ceil' && Math.abs(q.y - p.y) < 0.3 && edges(q).some((e) => E.some((f) => near([e.mx, e.mz], [f.mx, f.mz]))))));
          if (!sup) sup = S.some((q) => ok.has(q) && STYPES[q.type].kind === 'cell' && Math.abs(q.y + WALL_H - p.y) < 0.3 && Math.hypot(q.x - p.x, q.z - p.z) < 1.6); }
        if (sup) { ok.add(p); changed = true; } } }
    return ok;
  }
  collapse() { const g = this.g; const ok = this.supported(); const fall = this.structs().filter((p) => !ok.has(p)); for (const p of fall) { this.onRemoved(p); g.build.remove(p, false); this.debris(p); g.fx.burst([p.x, p.y + 1, p.z], 18, [0.45, 0.4, 0.32], 3, 1.0, 0.1); g.net && g.net.onBuild && g.net.onBuild('del', p); }
    if (fall.length) { g.ui.toast(`${fall.length} peça${fall.length > 1 ? 's' : ''} sem apoio caíram`, 'warn'); } }
  // explosões danificam construções. Por nível [galhos, madeira, pedra, metal]:
  //  C4: galhos/madeira caem na hora em todo o raio (20 m); pedra perde 360 (2 C4); metal perde 370 (aguenta 2, cai na 3ª).
  //  Foguete, granada de fragmentação e do lança-granadas: dano bom na madeira, pouco na pedra e quase nada no metal.
  blast(p0, R, dmg, kind) { const g = this.g; let hit = false; const T = BLAST[kind] || null;
    for (const p of [...this.structs()]) { const d = Math.hypot(p.x - p0[0], p.y + 1 - p0[1], p.z - p0[2]); if (d > R + 1.5) continue; const D = p.data; const tier = STYPES[p.type].fixed ? 1 : (D.tier || 0); let dd;
      if (T) { const f = kind === 'c4' ? (d < 6 ? 1 : Math.max(0.4, 1 - (d - 6) / Math.max(1, R - 6) * 0.6)) : 1 - Math.min(1, d / (R + 1.5)) * 0.6; dd = T[tier] === Infinity ? Infinity : T[tier] * f; }
      else { const k = [1, 0.8, 0.45, 0.28][tier]; dd = dmg * 4 * k * (1 - Math.min(1, d / (R + 1.5)) * 0.6); }
      D.hp -= dd; hit = true; this.showHp(p);
      if (D.hp <= 0) this._break(p); else g.net && g.net.onBuild && g.net.onBuild('data', p); }
    // C4 arranca a folha da porta das paredes com porta próximas: ela cai no chão (para o lado contrário da explosão),
    // a tranca vai junto e o vão fica aberto para sempre (mesmo que a parede aguente)
    if (kind === 'c4') for (const p of [...this.structs()]) { if (p.type !== 's_doorway' || !p.data || p.data.blown || !g.build.pieces.includes(p)) continue; if (Math.hypot(p.x - p0[0], p.y + 1 - p0[1], p.z - p0[2]) > 5) continue;
      const side = Math.sign((p0[0] - p.x) * Math.sin(p.rot) + (p0[2] - p.z) * Math.cos(p.rot)) || 1; this.blowDoor(p, side); hit = true; g.net && g.net.onBuild && g.net.onBuild('data', p); }
    // C4 leva junto tudo o que foi construído no raio (bancadas, baús, fogueiras, máquinas…)
    if (kind === 'c4') for (const q of [...g.build.pieces]) { if (STYPES[q.type] || ['flag', 'chest', 'chest_wi', 'chest_iron', 'cabinet'].includes(q.type) || Math.hypot(q.x - p0[0], q.z - p0[2]) > R || Math.abs(q.y - p0[1]) > 8) continue; g.build.remove(q, false); g.fx.burst([q.x, q.y + 0.6, q.z], 20, [0.45, 0.4, 0.32], 4, 1, 0.1); g.net && g.net.onBuild && g.net.onBuild('del', q); hit = true; }
    if (hit) this.collapse(); }
  blowDoor(p, side) { const g = this.g, D = p.data; D.blown = side; delete D.lock; p.open = false; p._blowT = performance.now(); for (const c of p.colliders || []) if (c.leaf) c.ghost = true;
    const n = [Math.sin(p.rot) * -side, Math.cos(p.rot) * -side]; g.fx.burst([p.x + n[0] * 0.6, p.y + 1.1, p.z + n[1] * 0.6], 26, [0.35, 0.3, 0.26], 6, 1.2, 0.1); g.fx.burst([p.x, p.y + 1.2, p.z], 14, [1, 0.6, 0.25], 5, 0.4, 0.05); g.audio.play('ferro', { at: [p.x, p.y + 1, p.z], vol: 0.7 }); }
  // destroços quando a peça quebra: madeira = troncos que rolam (som de toras), pedra = blocos que caem (som de pedras),
  // metal = chapas retorcidas (som de ferro). Ficam ~12 s no chão e afundam.
  debris(p) { const g = this.g, d = p.data || {}, st = STYPES[p.type]; if (!st) return; const tier = st.fixed ? 1 : (d.tier || 0); const kind = tier >= 3 ? 'metal' : tier === 2 ? 'stone' : 'wood';
    const L = this.deb || (this.deb = []); if (L.length > 160) L.splice(0, L.length - 160); const wall = st.kind === 'wall', h = st.h || 3, c = Math.cos(p.rot), sn = Math.sin(p.rot);
    const nx = sn, nz = c, ax = c, az = -sn; // normal da parede e direção ao longo dela
    const add = (o) => L.push({ t: 0, life: 11 + Math.random() * 4, spin: 0, roll: 0, rx: 0, rz: 0, ...o });
    const n = kind === 'wood' ? (wall ? Math.max(2, Math.round(h / 0.6)) : 4) : kind === 'stone' ? (wall ? 9 : 7) : 4;
    for (let i = 0; i < n; i++) { const sd = Math.random() < 0.5 ? -1 : 1, along = (Math.random() - 0.5) * (wall ? 2.4 : 2.4), up = wall ? 0.3 + (i + 0.5) / n * (h - 0.4) : 0.2;
      const x = p.x + ax * along + (wall ? 0 : (Math.random() - 0.5) * 2.4) * nx, z = p.z + az * along + (wall ? 0 : (Math.random() - 0.5) * 2.4) * nz, sp = 1.2 + Math.random() * 2.6;
      if (kind === 'wood') add({ kind, x: p.x + ax * (Math.random() - 0.5) * 0.3, y: p.y + up, z: p.z + az * (Math.random() - 0.5) * 0.3, yaw: p.rot + (Math.random() - 0.5) * 0.4, vx: nx * sd * sp, vz: nz * sd * sp, vy: 0.5 + Math.random() * 2, len: tier === 0 ? 2.6 : 2.9, r: tier === 0 ? 0.08 : 0.15, tier });
      else add({ kind, x, y: p.y + up, z, yaw: Math.random() * 6.28, vx: nx * sd * sp + (Math.random() - 0.5) * 1.5, vz: nz * sd * sp + (Math.random() - 0.5) * 1.5, vy: 1 + Math.random() * 2.5, sc: kind === 'stone' ? 0.6 + Math.random() * 0.7 : 0.8 + Math.random() * 0.4, w: (Math.random() - 0.5) * 6, rx: Math.random() * 3, rz: Math.random() * 3 }); }
    const now = performance.now(), k = 'sndT_' + kind; if (!this[k] || now - this[k] > 350) { this[k] = now; g.audio.play(kind === 'wood' ? 'toras' : kind === 'stone' ? 'pedras_caindo' : 'ferro', { at: [p.x, p.y + 1, p.z], vol: 1, max: 120 }); } }
  _debUpdate(dt) { const L = this.deb; if (!L || !L.length) return; const ph = this.g.physics;
    for (let i = L.length - 1; i >= 0; i--) { const o = L[i]; o.t += dt; if (o.t > o.life + 1.5) { L.splice(i, 1); continue; }
      const [gy] = ph.ground(o.x, o.z, 0.1, o.y + 0.4, 0.6); const rad = o.kind === 'wood' ? o.r : o.kind === 'stone' ? 0.2 * o.sc : 0.05; o.vy -= 9.8 * dt; o.x += o.vx * dt; o.z += o.vz * dt; o.y += o.vy * dt;
      if (o.y < gy + rad) { o.y = gy + rad; if (o.vy < -2) o.vy *= -0.25; else o.vy = 0; const fr = o.kind === 'wood' ? 0.55 : o.kind === 'stone' ? 3.5 : 5; const sp = Math.hypot(o.vx, o.vz); const ns = Math.max(0, sp - fr * dt); if (sp > 1e-4) { o.vx *= ns / sp; o.vz *= ns / sp; }
        // tronco no chão rola morro abaixo
        if (o.kind === 'wood') { const e = 0.6, sx = this.g.world.height(o.x + e, o.z) - this.g.world.height(o.x - e, o.z), sz = this.g.world.height(o.x, o.z + e) - this.g.world.height(o.x, o.z - e); const nx = Math.sin(o.yaw), nz = Math.cos(o.yaw); const sl = -(sx * nx + sz * nz) / (2 * e); o.vx += nx * sl * 6 * dt; o.vz += nz * sl * 6 * dt; }
        o.w *= Math.max(0, 1 - dt * 4); }
      if (o.kind === 'wood') { const nx = Math.sin(o.yaw), nz = Math.cos(o.yaw); o.roll += (o.vx * nx + o.vz * nz) * dt / o.r; } else { o.rx += (o.w || 0) * dt; o.rz += (o.w || 0) * 0.7 * dt; }
      if (o.t > o.life) o.y -= dt * 0.4; } }
  _debMeshes() { if (this.debM) return this.debM; const R = this.g.renderer; const log = (r, bark) => { const mb = new MeshBuilder(); mb.setColor(hex(bark), 0.85); mb.cylinder(M(-1.45, 0, 0, 0, 1, 0, -Math.PI / 2), r, r * 0.92, 2.9, 7, hex(bark)); mb.setColor(hex(0xc8a070), 0.85); return R.createMesh(mb.build()); };
    const stone = (() => { const mb = new MeshBuilder(); mb.setColor(hex(0x8e8b84), 0.95); mb.roundBox(M(0, 0, 0), 0.5, 0.34, 0.42, hex(0x8e8b84), 0.06, 1); mb.setColor(hex(0x7a776f), 0.95); mb.box(M(0.1, 0.12, 0.05, 0.4), 0.3, 0.16, 0.26, hex(0x7a776f)); return R.createMesh(mb.build()); })();
    const plate = (() => { const mb = new MeshBuilder(); const c = hex(0x6c737a); mb.setColor(c, 0.5); mb.box(M(-0.4, 0, 0, 0, 1, 0, 0.25), 0.85, 0.05, 0.9, c); mb.box(M(0.38, 0.12, 0, 0, 1, 0, -0.45), 0.8, 0.05, 0.9, shade(c, 0.85)); mb.box(M(0, -0.02, 0.48, 0.3), 1.4, 0.06, 0.08, shade(c, 0.7)); return R.createMesh(mb.build()); })();
    return (this.debM = { log: log(0.15, 0x6a4a2c), stick: log(0.08, 0x8a6a40), stone, plate }); }
  _debRender(items) { const L = this.deb; if (!L || !L.length) return; const D = this._debMeshes();
    for (const o of L) { let m; if (o.kind === 'wood') { m = mat4.fromTRS(mat4.create(), [o.x, o.y, o.z], quat.fromEuler(0, o.yaw, 0), [1, 1, 1]); mat4.mul(m, m, mat4.fromTRS(mat4.create(), [0, 0, 0], quat.fromEuler(o.roll, 0, 0), [1, 1, 1])); items.push({ mesh: o.tier === 0 ? D.stick : D.log, model: m, sphere: [o.x, o.y, o.z, 1.6] }); }
      else { m = mat4.fromTRS(mat4.create(), [o.x, o.y, o.z], quat.fromEuler(o.rx, o.yaw, o.rz), [o.sc, o.sc, o.sc]); items.push({ mesh: o.kind === 'stone' ? D.stone : D.plate, model: m, sphere: [o.x, o.y, o.z, 1] }); } } }
  // tiro em construção: aguenta muitos (madeira ~30 tiros de fuzil); pedra e metal quase não sentem
  shot(p, dmg, at) { const g = this.g; if (!STYPES[p.type] || !p.data) return; const D = p.data, tier = STYPES[p.type].fixed ? 1 : (D.tier || 0); D.hp -= dmg * [0.35, 0.28, 0.08, 0.03][tier]; this.showHp(p);
    if (at) g.fx.burst(at, 5, tier >= 2 ? [0.6, 0.6, 0.6] : [0.6, 0.45, 0.3], 2.5, 0.35, 0.04);
    if (D.hp <= 0) { this._break(p); this.collapse(); } else { this._netT = (this._netT || 0); if (g.net && g.net.onBuild && performance.now() - this._netT > 300) { this._netT = performance.now(); g.net.onBuild('data', p); } } }
  _break(p) { const g = this.g; this.onRemoved(p); g.build.remove(p, false); g.fx.burst([p.x, p.y + 1, p.z], 30, [0.45, 0.4, 0.32], 4, 1.1, 0.12); this.debris(p); g.net && g.net.onBuild && g.net.onBuild('del', p); if (this.hpT && this.hpT.p === p) this.hpT = null; }
  // barra de vida da peça atingida (some depois de alguns segundos)
  showHp(p) { this.hpT = { p, t: 3.5 }; }
  _hpBar(dt) {
    const g = this.g; let el = document.getElementById('pieceHp'); const H = this.hpT; if (H) H.t -= dt;
    if (!H || H.t <= 0 || !g.build.pieces.includes(H.p) || g.ui.anyOpen) { if (el) el.style.display = 'none'; if (H && H.t <= 0) this.hpT = null; return; }
    if (!el) { el = document.createElement('div'); el.id = 'pieceHp'; el.innerHTML = '<div class="nm"></div><div class="bar"><i></i></div>'; document.body.appendChild(el); }
    const p = H.p, D = p.data, tier = D.tier || 0, mx = maxHp(p.type, tier); const k = Math.max(0, D.hp) / mx; const h = STYPES[p.type].kind === 'wall' ? (STYPES[p.type].h || 3) + 0.4 : 1.4;
    const VP = g.renderer.viewProj, x = p.x, y = p.y + h, z = p.z; const cx = VP[0] * x + VP[4] * y + VP[8] * z + VP[12], cy = VP[1] * x + VP[5] * y + VP[9] * z + VP[13], cw = VP[3] * x + VP[7] * y + VP[11] * z + VP[15];
    if (cw <= 0.1) { el.style.display = 'none'; return; } const W = window.innerWidth, Hh = window.innerHeight; el.style.display = 'block'; el.style.left = (((cx / cw) * 0.5 + 0.5) * W) + 'px'; el.style.top = ((1 - ((cy / cw) * 0.5 + 0.5)) * Hh) + 'px'; el.style.opacity = Math.min(1, H.t / 0.6).toFixed(2);
    el.querySelector('.nm').textContent = `${STYPES[p.type].name} (${TIERS[STYPES[p.type].fixed ? 1 : tier].short}) ${Math.max(0, Math.round(D.hp))}/${mx}`; const b = el.querySelector('i'); b.style.width = (k * 100).toFixed(1) + '%'; b.style.background = k > 0.6 ? '#4ad66a' : k > 0.3 ? '#e8c440' : '#e84a3a'; }

  // ---------- desenho ----------
  modelOf(p) { const t = this.grow.get(p); const base = mat4.fromTRS(mat4.create(), [p.x, p.y, p.z], quat.fromEuler(0, p.rot, 0), [1, 1, 1]); if (t === undefined) return base;
    const k = STYPES[p.type].kind; const e = 1 - Math.pow(1 - t, 3); if (k === 'floor') return mat4.fromTRS(mat4.create(), [p.x, p.y - (1 - e) * 1.2, p.z], quat.fromEuler(0, p.rot, 0), [1, 1, 1]); return mat4.mul(mat4.create(), base, mat4.fromTRS(mat4.create(), [0, k === 'ceil' ? -(1 - e) * 0.25 : 0, 0], [0, 0, 0, 1], [1, Math.max(0.02, e), 1])); }
  render(items, eye) { this._debRender(items);
    const g = this.g, B = g.build; if (!this.flagM) { this.flagM = g.renderer.createMesh(flagMesh()); this.flagF = g.renderer.createMesh(flagMesh(0x2a6ac0)); this.leafM = g.renderer.createMesh((() => { const mb = new MeshBuilder(); const c = hex(0x6a4a2c); mb.setColor(c, 0.8); mb.box(M(0, 1.1, 0), 1.18, 2.18, 0.08, c); mb.setColor(hex(0x2a2a2a), 0.5); mb.box(M(0.45, 1.1, 0.06), 0.06, 0.06, 0.05, hex(0x2a2a2a)); return mb.build(); })()); this.lidM = g.renderer.createMesh((() => { const mb = new MeshBuilder(); const c = hex(0x6a4a2c); mb.setColor(c, 0.8); mb.box(M(0, -0.06, 0.6), 1.18, 0.1, 1.18, c); mb.setColor(hex(0x3a3a3a), 0.5); mb.box(M(0, 0.0, 1.05), 0.3, 0.04, 0.06, hex(0x3a3a3a)); return mb.build(); })()); }
    const me = this.myId();
    for (const p of B.pieces) {
      if (p.type === 'flag') continue; // Territoritek: desenhado pelo sistema de território
      if (!STYPES[p.type]) continue; const d = p.data || {}; const dist = Math.hypot(p.x - eye[0], p.z - eye[2]); if (dist > 400) continue;
      let m = this.modelOf(p); const dmg = d.hp !== undefined ? d.hp / maxHp(p.type, d.tier || 0) : 1; if ((d.tier || 0) >= 3 && !STYPES[p.type].fixed && dmg < 0.97) { const k = 1 - dmg, sg = (p.id || 0) % 2 ? 1 : -1; m = mat4.mul(mat4.create(), m, mat4.fromTRS(mat4.create(), [0, 0, 0], quat.fromEuler(sg * k * 0.22, sg * k * 0.12, k * 0.16), [1, 1 - k * 0.1, 1])); } // metal amassado: vai retorcendo com o dano items.push({ mesh: this.mesh(p.type, d.tier || 0), model: m, sphere: [p.x, p.y + 1, p.z, 3], tint: dmg < 0.5 ? [0.75 + dmg * 0.5, 0.7 + dmg * 0.5, 0.65 + dmg * 0.5, 1] : undefined });
      if (p.type === 's_doorway' && d.blown) { for (const c of p.colliders || []) if (c.leaf && !c.ghost) c.ghost = true; // folha arrancada pela C4: caída e torta no chão
        const k = p._blowT ? Math.min(1, (performance.now() - p._blowT) / 650) : 1, f = k * k, sd = d.blown; const lm = mat4.mul(mat4.create(), m, mat4.fromTRS(mat4.create(), [0.12 * sd * f, 0.1 * f, -sd * (0.15 + 0.4 * f)], quat.fromEuler(-sd * f * 1.36, 0.35 * f * sd, 0.2 * f), [1, 1, 1]));
        items.push({ mesh: this.leafM, model: lm, sphere: [p.x, p.y + 1, p.z, 3], tint: [0.45, 0.4, 0.36, 1] }); continue; }
      if (p.type === 's_doorway') { const a = p.openAng || 0; const lm = mat4.mul(mat4.create(), m, mat4.fromTRS(mat4.create(), [-0.6, 0, 0], quat.fromEuler(0, -a, 0), [1, 1, 1])); mat4.mul(lm, lm, mat4.fromTRS(mat4.create(), [0.6, 0, 0], [0, 0, 0, 1], [1, 1, 1])); items.push({ mesh: this.leafM, model: lm, sphere: [p.x, p.y + 1, p.z, 2] }); }
      if (p.type === 's_hatch') { const a = (p.openAng || 0) * 1.05; const lm = mat4.mul(mat4.create(), m, mat4.fromTRS(mat4.create(), [0, 0, -0.6], quat.fromEuler(-a, 0, 0), [1, 1, 1])); items.push({ mesh: this.lidM, model: lm, sphere: [p.x, p.y, p.z, 2] }); }
    }
    // prévia
    const gh = this.ghost; if (this.mode && gh && g.equip.hand === 'blueprint') { const m = mat4.fromTRS(mat4.create(), [gh.x, gh.y, gh.z], quat.fromEuler(0, gh.rot, 0), [1, 1, 1]); items.push({ mesh: this.mesh(gh.type, 0), model: m, alpha: 0.45, tint: gh.valid ? [0.45, 1.5, 0.6, 1] : [1.7, 0.4, 0.35, 1], shadow: false, sphere: [gh.x, gh.y, gh.z, 3] }); }
    // limite da área da bandeira (estacas) com o projeto na mão
    if (g.equip.hand === 'blueprint' || g.equip.hand === 'hammer' || (g.build.mode === 'flag')) { if (!this.postM) { const mb = new MeshBuilder(); const c = hex(0xffd040); mb.setColor(c, 0.5); mb.box(M(0, 0.6, 0), 0.12, 1.2, 0.12, c); this.postM = g.renderer.createMesh(mb.build()); }
      const P = g.player; for (const f of this.flags()) { if (Math.hypot(f.x - P.pos[0], f.z - P.pos[2]) > FLAG_R + 40) continue; const own = (f.data && f.data.owner) === me; for (let k = 0; k < 48; k++) { const a = k / 48 * Math.PI * 2, x = f.x + Math.cos(a) * FLAG_R, z = f.z + Math.sin(a) * FLAG_R, y = g.world.height(x, z); items.push({ mesh: this.postM, model: mat4.fromTRS(mat4.create(), [x, y, z], [0, 0, 0, 1], [1, 1, 1]), tint: own ? [0.6, 1.4, 0.6, 1] : [1.6, 0.5, 0.4, 1], emissive: 0.4, shadow: false, alpha: 0.75, sphere: [x, y, z, 1] }); } } }
  }
}
