// Casas de subúrbio (estilo das referências: revestimento colorido, acabamento branco, varanda com colunas e guarda-corpo,
// telhado de duas águas, chaminé, água-furtada, garagem) com interior completo (banheiro, quarto, sala, cozinha com mesa)
// e o hospital de 2 andares (térreo + 1º andar com escada), recepção curva, quartos com macas e biombos.
// Tudo em coordenadas locais: frente da casa = +Z (porta), depois girado por b.rot e levado para o mundo.
import { MeshBuilder, M, hex, shade } from '../engine/mesh.js';
import { rng, mat4 } from '../engine/math.js';
import { furniture } from './props.js';
import { ladderSpec, ladderMesh } from './town.js';

const STONE = 0.93, WOOD = 0.63, FAB = 0.83, MET = 0.5;
// paletas tiradas da folha de casas (revestimento, acabamento, telhado)
const SIDING = [0x8a8c8e, 0x9a4a3a, 0xc8c47a, 0xd8a094, 0x4a5658, 0x7a8c74, 0x3e4a3c, 0x9a9c9e, 0xe0d2a8, 0x485a7a, 0xd0b45a, 0x7a9ab4, 0xe8e6e0, 0x8a3a2a, 0x6a7a8a, 0xb8c4a0];
const ROOFS = [0x6a6458, 0x4a4c50, 0x6e6a3a, 0x7a7a7e, 0x5a4a3e, 0x8a4a4a, 0x5e6266];
const SHUT = [0x2a2a2a, 0x8a2020, 0x2a4a8a, 0x3a4a3a];
const DOORS = [0x8a5a2a, 0xa86a34, 0x6a3a22, 0xe8e6e0, 0x3a5a3a, 0x8a2a20];

// ---------------- plano da casa (barato: usado na geração do mundo para os pontos de loot) ----------------
export function suburbPlan(b) {
  const r = rng((b.seed || 1) * 13 + 5); const W = b.w, D = b.d, hw = W / 2, hd = D / 2, sx = b.mirror || 1; const X = (u) => u * sx;
  const zMid = hd - D * 0.48, uBath = -hw + Math.min(3.0, W * 0.29), uBed = uBath + 1.45, uSplit = uBed + 0.45, zBath = -hd + Math.min(3.0, D * 0.33);
  const P = []; const add = (k, u, z, f = 0, loot = null, o = {}) => P.push({ k, u: X(u), v: z, f: sx < 0 ? -f : f, loot, y0: 0.23, ...o });
  const walls = [];
  const wall = (u0, z0, u1, z1, holes = []) => walls.push({ u0: X(u0), z0, u1: X(u1), z1, holes: holes.map((h) => ({ ...h, c: (u0 === u1 ? h.c : X(h.c)) })), flip: sx < 0 && u0 !== u1 });
  // paredes internas
  wall(uBed, zMid, hw, zMid); // quarto | cozinha
  wall(uBed, -hd, uBed, zMid, [{ c: zMid - 0.85, w: 0.95, door: true }]); // corredor → quarto
  wall(uBath, -hd, uBath, zBath); // banheiro | corredor
  wall(-hw, zBath, uBath, zBath, [{ c: uBath - 0.75, w: 0.9, door: true }]); // banheiro → sala
  wall(uSplit, zMid, uSplit, zMid + Math.min(1.5, D * 0.16)); // meia-parede entre sala e cozinha
  // ---- quarto: cama de casal com criados-mudos, quadro, tapete, guarda-roupa
  const bc = (uBed + hw) / 2; const bedSide = r() < 0.5;
  add('rug2', bc, -hd + 1.5, 0); add('dbed', bc, -hd + 1.12, 0); add('night', bc - 1.2, -hd + 0.3, 0, 'night'); add('night', bc + 1.2, -hd + 0.3, 0, r() < 0.5 ? 'night' : null); add('painting', bc, -hd + 0.14, 0);
  if (bedSide) add('wardrobe', hw - 0.33, zMid - 0.95, -Math.PI / 2, 'wardrobe'); else add('wardrobe', uBed + 0.95, zMid - 0.34, Math.PI, 'wardrobe');
  // ---- banheiro: box de vidro, vaso, pia com espelho
  add('shower', -hw + 0.6, -hd + 0.6, 0); add('toilet', uBath - 0.42, -hd + 0.38, 0); add('vanity', -hw + 0.3, zBath - 0.75, Math.PI / 2, 'medcab');
  // ---- sala: TV na parede, sofá de frente, mesinha, tapete, poltrona, planta, estante
  const zL = (zBath + hd) / 2 + 0.25; const tvLeft = r() < 0.75;
  if (tvLeft) { add('tvstand', -hw + 0.26, zL, Math.PI / 2, 'shelf'); add('rug', -hw + 1.9, zL, Math.PI / 2); add('ctable', -hw + 1.7, zL, Math.PI / 2); add('sofa2', -hw + 2.85, zL, -Math.PI / 2); add('armchair', -hw + 1.3, zBath + 0.75, Math.PI * 0.8); }
  else { add('tvstand', -hw + 2.0, zBath + 0.26, 0, 'shelf'); add('rug', -hw + 2.0, zBath + 1.9, 0); add('ctable', -hw + 2.0, zBath + 1.7, 0); add('sofa2', -hw + 2.0, zBath + 2.95, Math.PI); add('armchair', -hw + 0.6, zBath + 1.6, Math.PI / 2); }
  add('plant', -hw + 0.4, hd - 0.4, 0); if (r() < 0.6) add('plant', uSplit - 0.35, zMid + 0.45, 0);
  // ---- cozinha: bancada em L com pia, armários altos, geladeira, fogão, mesa redonda com 4 cadeiras
  const kL = hw - 0.85 - (uSplit + 0.3); add('counter', uSplit + 0.3 + kL / 2, zMid + 0.33, 0, 'kcab', { len: kL }); add('sink', uSplit + 0.3 + kL * 0.4, zMid + 0.33, 0); add('wallcab', uSplit + 0.3 + kL / 2, zMid + 0.18, 0, null, { len: kL });
  add('fridge', hw - 0.42, zMid + 0.42, 0, 'fridge'); add('stove', hw - 0.33, zMid + 1.65, -Math.PI / 2); add('counter', hw - 0.33, zMid + 2.55, -Math.PI / 2, null, { len: 1.1 });
  add('rtable', (uSplit + hw) / 2 + 0.2, hd - 1.85, r() * 0.8);
  // janelas e portas externas (u ao longo da parede; sx aplicado)
  const win = (wallId, c, w = 1.2, y0 = 0.9, y1 = 2.2) => ({ wall: wallId, c: wallId === 'F' || wallId === 'B' ? X(c) : c, w, y0, y1 });
  const ext = [win('F', -hw + 1.7), win('F', (uSplit + hw) / 2 + 0.9), win('B', bc, 1.3, 1.15), win('B', -hw + 1.4, 0.6, 1.65, 2.2), { wall: 'B', c: X((uBath + uBed) / 2), w: 0.95, y0: 0, y1: 2.2, door: true },
    { wall: 'F', c: X(uSplit - 0.8), w: 1.05, y0: 0, y1: 2.25, door: true, front: true }];
  const sideL = sx > 0 ? 'L' : 'R', sideR = sx > 0 ? 'R' : 'L';
  ext.push(win(sideL, (zBath + hd) / 2 + 0.3, 1.3), win(sideR, (-hd + zMid) / 2, 1.2)); if (!b.garage) ext.push(win(sideR, hd - 1.2, 1.1));
  return { P, walls, ext, zMid, zBath, uBath, uBed, uSplit, sx };
}

// ---------------- plano do hospital (2 andares) ----------------
export function hospitalPlan(b) {
  const r = rng((b.seed || 1) * 17 + 3); const W = b.w, D = b.d, hw = W / 2, hd = D / 2; const FH = 4.0; const P = [], walls = [];
  const add = (k, u, z, f = 0, loot = null, o = {}) => P.push({ k, u, v: z, f, loot, ...o, y0: (o.y0 || 0) + 0.03 });
  const lob = 4.6; // meia largura do saguão
  const stair = { u0: -2.7, u1: 2.6, z0: -hd + 0.25, z1: -hd + 1.65, steps: 16 };
  for (let fl = 0; fl < 2; fl++) { const y0 = fl * FH;
    // paredes das alas (porta no corredor do saguão) e divisória frente/fundo de cada ala
    for (const s of [-1, 1]) { walls.push({ u0: s * lob, z0: -hd, u1: s * lob, z1: hd, y0, holes: [{ c: 2.2, w: 1.3, door: true }, { c: -hd + 3.6, w: 1.3, door: true }] });
      walls.push({ u0: s * lob, z0: 0.2, u1: s * hw, z1: 0.2, y0, holes: [] }); }
    // quartos: macas com biombos ao longo da parede externa (ordem e armários mudam por quarto)
    for (const s of [-1, 1]) for (const zz of [-1, 1]) {
      const zc = zz > 0 ? (0.2 + hd) / 2 : (-hd + 0.2) / 2, uc = s * (lob + hw) / 2, depth = hd - 0.2; const exam = fl === 0 && s > 0 && zz > 0 && r() < 0.6;
      if (exam) { add('exam', uc, zc, s > 0 ? -Math.PI / 2 : Math.PI / 2, null, { y0 }); add('screen', uc - s * 1.3, zc, 0, null, { y0 }); add('desk', uc, zc + zz * (depth / 2 - 0.6), zz > 0 ? Math.PI : 0, null, { y0 }); add('medcabinet', s * (hw - 0.3), zc - zz * 2.6, -s * Math.PI / 2, 'hospital', { y0 }); continue; }
      const n = 3, layout = r(); const along = layout < 0.6; // macas encostadas na parede externa (along) ou na parede do fundo
      for (let i = 0; i < n; i++) {
        if (along) { const z = zc + (i - 1) * 2.35; add('hbed', s * (hw - 1.15), z, s > 0 ? -Math.PI / 2 : Math.PI / 2, null, { y0 }); if (i < n - 1) add('screen', s * (hw - 1.15), z + 1.17, Math.PI / 2, null, { y0 }); if (r() < 0.5) add('drip', s * (hw - 0.4), z + 0.7, 0, null, { y0 }); }
        else { const u = uc + (i - 1) * 1.9 * s; const zw = zz > 0 ? hd - 1.15 : -hd + 1.15; add('hbed', u, zw, zz > 0 ? Math.PI : 0, null, { y0 }); if (i < n - 1) add('screen', u + 0.95 * s, zw, 0, null, { y0, rot90: true }); if (r() < 0.5) add('drip', u + 0.6, zw - zz * 0.6, 0, null, { y0 }); }
      }
      const cabZ = zc + (r() - 0.5) * 2.5; add('medcabinet', s * (lob + 0.3), along ? cabZ : zc - zz * 1.5, s * Math.PI / 2, 'hospital', { y0 });
      if (r() < 0.6) add('chair', uc - s * 0.4, zc - zz * (depth / 2 - 0.7), r() * 6, null, { y0 });
      if (r() < 0.5) add('cart', s * (lob + 1.0), zc + zz * (depth / 2 - 0.6), 0, 'hospital', { y0 });
    }
    // saguão: recepção curva, cadeiras azuis, sofás, plantas (no 1º andar vira posto de enfermagem + enfermaria)
    add('reception', 0, fl ? 0.6 : 1.2, 0, 'medcab', { y0 });
    if (fl === 0) { for (const s of [-1, 1]) { add('chairs3', s * 3.1, hd - 3.2, Math.PI, null, { y0 }); add('chairs3', s * (lob - 0.45), -1.6, -s * Math.PI / 2, null, { y0 }); add('hsofa', s * (lob - 0.6), hd - 1.4, -s * Math.PI / 2, null, { y0 }); add('plant', s * (lob - 0.45), hd - 0.45, 0, null, { y0 }); }
      add('bookcase', -lob + 0.3, -3.4, Math.PI / 2, 'medcab', { y0 }); }
    else { for (const s of [-1, 1]) { add('hbed', s * 2.6, hd - 2.0, Math.PI, null, { y0 }); add('screen', s * 1.5, hd - 2.0, Math.PI / 2, null, { y0 }); add('chairs3', s * (lob - 0.45), -0.8, -s * Math.PI / 2, null, { y0 }); }
      add('medcabinet', lob - 0.3, -3.0, -Math.PI / 2, 'hospital', { y0 }); add('plant', -lob + 0.45, hd - 0.45, 0, null, { y0 }); }
  }
  return { P, walls, stair, lob, FH };
}

// ---------------- utilitários de malha ----------------
function makeKit(b) {
  const mb = new MeshBuilder(); const colliders = [], glass = [], doors = [], wins = []; const cr = Math.cos(b.rot), sr = Math.sin(b.rot);
  const toW = (lx, lz) => [b.x + lx * cr + lz * sr, b.z - lx * sr + lz * cr];
  const box = (x, y, z, sx, sy, sz, c, f = STONE) => { mb.setColor(c, f); mb.box(M(x, y + sy / 2, z), sx, sy, sz, c); };
  const col = (x, z, y0, y1, hx, hz, extra = {}) => { const [wx, wz] = toW(x, z); colliders.push({ type: 'box', x: wx, z: wz, y0: b.y + y0, y1: b.y + y1, hx, hz, rot: b.rot, ...extra }); };
  // parede reta (eixo x ou z) com vãos {c, w, y0, y1, door, glass}; duas camadas: externa (cor) e interna (branca)
  const wall = (u0, z0, u1, z1, yb, h, holes, cOut, cIn, T = 0.22, opts = {}) => {
    const ax = z0 === z1; const L = ax ? Math.abs(u1 - u0) : Math.abs(z1 - z0); const s0 = ax ? Math.min(u0, u1) : Math.min(z0, z1); const fixed = ax ? z0 : u0;
    const outN = opts.outN || 0; // lado de fora: +1/-1 (normal); 0 = parede interna (mesma cor)
    const piece = (a, bb, y0, y1, collide = true) => { if (bb - a < 0.01 || y1 - y0 < 0.01) return; const c = (a + bb) / 2, len = bb - a;
      if (outN && cOut) { const o = outN * T * 0.25; const px = ax ? c : fixed + o, pz = ax ? fixed + o : c; box(px, yb + y0, pz, ax ? len : T / 2, y1 - y0, ax ? T / 2 : len, cOut, opts.fOut ?? FAB);
        const qx = ax ? c : fixed - o, qz = ax ? fixed - o : c; box(qx, yb + y0, qz, ax ? len : T / 2, y1 - y0, ax ? T / 2 : len, cIn, 0.86); }
      else box(ax ? c : fixed, yb + y0, ax ? fixed : c, ax ? len : T, y1 - y0, ax ? T : len, cIn, 0.86);
      if (collide) col(ax ? c : fixed, ax ? fixed : c, yb + y0 - (y0 === 0 ? 1 : 0), yb + y1, (ax ? len : T) / 2 + 0.02, (ax ? T : len) / 2 + 0.02, opts.colExtra || {}); };
    const hs = [...holes].map((q) => ({ ...q, a: q.c - q.w / 2 - s0, b: q.c + q.w / 2 - s0 })).filter((q) => q.a > 0.05 && q.b < L - 0.05).sort((p, q) => p.a - q.a);
    let at = 0; const S = (v) => s0 + v;
    for (const q of hs) { piece(S(at), S(q.a), 0, h); piece(S(q.a), S(q.b), q.y1, h); if (q.y0 > 0) piece(S(q.a), S(q.b), 0, q.y0, true); at = q.b; }
    piece(S(at), S(L), 0, h);
    return hs.map((q) => ({ ...q, c: S((q.a + q.b) / 2), ax, fixed }));
  };
  return { mb, colliders, glass, doors, wins, toW, box, col, wall };
}
function finish(kit, b) {
  const data = kit.mb.build(); const m = mat4.compose([b.x, b.y, b.z], b.rot); const pos = data.pos, nrm = data.nrm;
  for (let i = 0; i < pos.length; i += 3) { const p = mat4.transformPoint(m, [pos[i], pos[i + 1], pos[i + 2]]); pos[i] = p[0]; pos[i + 1] = p[1]; pos[i + 2] = p[2];
    const n = mat4.transformDir(m, [nrm[i], nrm[i + 1], nrm[i + 2]]); nrm[i] = n[0]; nrm[i + 1] = n[1]; nrm[i + 2] = n[2]; }
  // portas que abrem: dobradiça no mundo, giro fechado/aberto no mundo
  const doors = kit.doors.map((d) => { const [x, z] = kit.toW(d.lx, d.lz); return { x, z, y: b.y + d.y, w: d.w, h: d.h, yawC: b.rot + d.yawC, yawO: b.rot + d.yawO, color: d.color }; });
  return { data, colliders: kit.colliders, glass: kit.glass, doors, wins: kit.wins };
}
// folha de porta (para a malha dinâmica): origem na dobradiça, estende +x
export function doorLeafMesh(color) { const mb = new MeshBuilder(); mb.setColor(color, WOOD); mb.box(M(0.5, 1.075, 0), 1.0, 2.15, 0.05, color); mb.setColor(shade(color, 0.8), WOOD);
  for (const y of [0.55, 1.55]) mb.box(M(0.5, y, 0), 0.7, 0.7, 0.07, shade(color, 0.85)); mb.setColor(hex(0xc8a848), MET); for (const s of [-1, 1]) mb.box(M(0.88, 1.0, s * 0.05), 0.04, 0.12, 0.05, hex(0xc8a848)); return mb.build(); }
// registra uma porta articulada num vão: dobradiça na ponta inicial; abre girando para o lado 'into' (+1/-1 da normal)
function hingeDoor(kit, q, yb, into, color) { const ax = q.ax; const s0 = q.c - q.w / 2; const lx = ax ? s0 : q.fixed, lz = ax ? q.fixed : s0;
  const yawC = ax ? 0 : -Math.PI / 2; const yawO = ax ? (into > 0 ? -Math.PI / 2 : Math.PI / 2) : (into > 0 ? 0 : Math.PI);
  kit.doors.push({ lx, lz, y: yb, w: q.w - 0.04, h: 2.15, yawC, yawO, color }); }
// moldura branca + vidro (+ venezianas) de uma janela numa parede externa
// vão de janela (para pular por ela com Espaço): centro, normal, peitoril e topo no mundo
function addWin(kit, b, ax, c, fixed, y0, y1, w) { const p0 = kit.toW(...(ax ? [c, fixed] : [fixed, c])), p1 = kit.toW(...(ax ? [c, fixed + 1] : [fixed + 1, c])); kit.wins.push({ x: p0[0], z: p0[1], nx: p1[0] - p0[0], nz: p1[1] - p0[1], y0: b.y + y0, y1: b.y + y1, w }); }
function windowTrim(kit, q, yb, outN, trim, shutter, b, glassOk) {
  const { box } = kit; const ax = q.ax, o = outN * 0.13; const y0 = yb + q.y0, y1 = yb + q.y1, h = y1 - y0, w = q.w;
  const at = (a, d = 0) => (ax ? [q.c + a, q.fixed + o + d] : [q.fixed + o + d, q.c + a]);
  const bx = (a, y, sw, sh, sd, c, f = STONE, d = 0) => { const [x, z] = at(a, d); box(x, y, z, ax ? sw : sd, sh, ax ? sd : sw, c, f); };
  bx(0, y1, w + 0.24, 0.12, 0.08, trim); bx(0, y0 - 0.1, w + 0.3, 0.1, 0.14, trim); for (const s of [-1, 1]) bx(s * (w / 2 + 0.05), y0, 0.1, h, 0.08, trim);
  if (!q.door) { bx(0, y0, 0.05, h, 0.05, trim, STONE, -outN * 0.05); if (h > 0.9) bx(0, y0 + h * 0.5, w, 0.05, 0.05, trim, STONE, -outN * 0.05);
    if (shutter) for (const s of [-1, 1]) { bx(s * (w / 2 + 0.32), y0, 0.42, h, 0.05, shutter, WOOD, 0.02); for (let k = 1; k < 5; k++) bx(s * (w / 2 + 0.32), y0 + h * k / 5, 0.36, 0.025, 0.06, shade(shutter, 0.7), WOOD, 0.03); }
    addWin(kit, b, ax, q.c, q.fixed, y0, y1, w);
    if (glassOk) { const [gx, gz] = kit.toW(...(ax ? [q.c, q.fixed] : [q.fixed, q.c])); kit.glass.push({ x: gx, z: gz, y: b.y + (y0 + y1) / 2, w, h, rot: b.rot + (ax ? 0 : Math.PI / 2) }); }
    else { const [x, z] = at(0, -outN * 0.09); box(x, y0, z, ax ? w : 0.02, h, ax ? 0.02 : w, hex(0x1a2026), MET); } }
}
function poly(mb, pts, n, c) { mb.setColor(c, FAB); const id = pts.map((p) => mb.vert(p, n, c)); const id2 = pts.map((p) => mb.vert(p, [-n[0], -n[1], -n[2]], c));
  for (let i = 1; i < pts.length - 1; i++) { mb.tri(id[0], id[i], id[i + 1]); mb.tri(id2[0], id2[i + 1], id2[i]); } }
// telhado de duas águas (cumeeira ao longo de x) cobrindo [x0,x1]×[z0,z1] a partir de yb
function gable(kit, x0, x1, z0, z1, yb, pitch, tile, wallC, trim, ridgeZ = true) {
  const { mb, box } = kit; const W = x1 - x0, D = z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  if (!ridgeZ) { // cumeeira ao longo de z: troca os eixos girando 90°
    const half = W / 2 + 0.45, rise = half * Math.tan(pitch);
    for (const sg of [-1, 1]) { mb.setColor(tile, STONE); mb.box(M(cx + sg * half / 2, yb + rise / 2 + 0.06, cz, 0, 1, 0, -sg * pitch), half / Math.cos(pitch) + 0.12, 0.14, D + 0.7, tile); mb.setColor(trim, STONE); mb.box(M(cx + sg * (half - 0.02), yb - 0.02, cz), 0.08, 0.2, D + 0.72, trim); }
    for (const sz of [-1, 1]) { const z = cz + sz * D / 2; const g = rise * 0.45 / half; poly(mb, [[x0, yb, z], [x1, yb, z], [x1, yb + g, z], [cx, yb + rise, z], [x0, yb + g, z]], [0, 0, sz], wallC);
      const L = Math.hypot(half, rise) + 0.1; for (const sg of [-1, 1]) { mb.setColor(trim, STONE); mb.box(M(cx + sg * half / 2, yb + rise / 2 + 0.02, z + sz * 0.36, 0, 1, 0, -sg * pitch), L, 0.18, 0.06, trim); } }
    box(cx, yb + rise, cz, 0.16, 0.1, D + 0.75, shade(tile, 0.8)); return rise;
  }
  const half = D / 2 + 0.45, rise = half * Math.tan(pitch);
  for (const sg of [-1, 1]) { mb.setColor(tile, STONE); mb.box(M(cx, yb + rise / 2 + 0.06, cz + sg * half / 2, 0, 1, sg * pitch), W + 0.7, 0.14, half / Math.cos(pitch) + 0.12, tile);
    for (let k = 1; k < 7; k++) { mb.setColor(shade(tile, 0.82), STONE); mb.box(M(cx, yb + rise * (1 - k / 7) + 0.14, cz + sg * half * k / 7, 0, 1, sg * pitch), W + 0.72, 0.025, 0.04, shade(tile, 0.82)); }
    mb.setColor(trim, STONE); mb.box(M(cx, yb - 0.02, cz + sg * (half - 0.02)), W + 0.72, 0.2, 0.08, trim); }
  for (const sx of [-1, 1]) { const x = cx + sx * W / 2; const g = rise * 0.45 / half; poly(mb, [[x, yb, z0], [x, yb, z1], [x, yb + g, z1], [x, yb + rise, cz], [x, yb + g, z0]], [sx, 0, 0], wallC);
    const L = Math.hypot(half, rise) + 0.1; for (const sg of [-1, 1]) { mb.setColor(trim, STONE); mb.box(M(x + sx * 0.36, yb + rise / 2 + 0.02, cz + sg * half / 2, 0, 1, sg * pitch), 0.06, 0.18, L, trim); } }
  box(cx, yb + rise, cz, W + 0.75, 0.1, 0.16, shade(tile, 0.8)); return rise;
}

// ---------------- móveis novos (os antigos vêm de props.furniture) ----------------
function fur(kit, p, r) {
  const { mb } = kit; const T = M(p.u, (p.y0 || 0) + 0.12, p.v, p.f);
  const B = (x, y, z, sx, sy, sz, c, f = WOOD, rb = 0) => { mb.setColor(c, f); const m = mat4.mul(mat4.create(), T, M(x, y, z)); if (rb) mb.roundBox(m, sx, sy, sz, c, rb, 1); else mb.box(m, sx, sy, sz, c); };
  const C = (x, y, z, rad, h, c, f = MET, seg = 10) => { mb.setColor(c, f); mb.cylinder(mat4.mul(mat4.create(), T, M(x, y, z)), rad, rad, h, seg, c); };
  const wood = [hex(0x6e4a2e), hex(0x8a5e3a), hex(0x5a3a24)][Math.floor(r() * 3)], white = hex(0xeeece6), steel = hex(0xa0a6ac), dark = hex(0x26282c);
  switch (p.k) {
    case 'dbed': { const duv = hex(0xf2f0ea), acc = [hex(0xb02a2a), hex(0x2a5a8a), hex(0x8a6a2a)][Math.floor(r() * 3)];
      B(0, 0.2, 0, 1.75, 0.32, 2.1, wood); B(0, 0.75, -1.02, 1.8, 1.1, 0.1, wood); B(0, 0.48, 0.03, 1.66, 0.2, 2.0, duv, FAB, 0.06); B(0, 0.6, 0.35, 1.7, 0.08, 1.35, shade(duv, 0.97), FAB, 0.04);
      for (const s of [-1, 1]) B(s * 0.42, 0.66, -0.75, 0.7, 0.16, 0.36, duv, FAB, 0.07); B(0, 0.7, -0.55, 0.36, 0.22, 0.12, acc, FAB, 0.05); B(0, 0.62, 0.95, 1.7, 0.04, 0.12, acc, FAB); return [1.75, 0.7, 2.1]; }
    case 'rug2': B(0, 0.005, 0, 2.6, 0.02, 2.6, hex(0xc8b894), FAB); return null;
    case 'painting': { const cs = [hex(0xc86a3a), hex(0x8a4a2a), hex(0xe8b070)]; B(0, 1.55, 0, 1.3, 0.62, 0.04, dark, WOOD); for (let k = 0; k < 3; k++) B(0, 1.6 + k * 0.15, 0.022, 1.18, 0.16, 0.01, cs[k], FAB); return null; }
    case 'shower': { const gl = hex(0xbcd2da); B(0, 0, 0, 1.0, 0.08, 1.0, white, MET); for (const [x, z, sx, sz] of [[0.5, 0, 0.03, 1.0], [0, 0.5, 1.0, 0.03]]) B(x, 0.08, z, sx, 1.95, sz, gl, MET); B(-0.44, 1.75, -0.3, 0.06, 0.3, 0.06, steel, MET); B(-0.35, 1.98, -0.3, 0.22, 0.04, 0.18, steel, MET); return null; }
    case 'toilet': B(0, 0, 0.05, 0.38, 0.4, 0.5, white, MET, 0.06); B(0, 0.4, 0.08, 0.42, 0.05, 0.5, white, MET, 0.03); B(0, 0.4, -0.2, 0.42, 0.45, 0.18, white, MET, 0.03); return null;
    case 'vanity': B(0, 0, 0, 0.95, 0.82, 0.5, wood); B(0, 0.82, 0, 1.0, 0.05, 0.54, white, STONE); B(0, 0.84, 0.04, 0.45, 0.03, 0.32, hex(0xd8dcde), MET); C(0, 0.86, -0.18, 0.02, 0.2, steel); B(0, 1.25, -0.24, 0.8, 0.75, 0.03, hex(0x9ab8c4), MET); return [0.95, 0.9, 0.5];
    case 'sofa2': { const fab = [hex(0xa82a2a), hex(0x7a8a9a), hex(0x4a5a7a), hex(0x8a6a4a), hex(0x5a6a4a)][Math.floor(r() * 5)];
      B(0, 0.12, 0, 2.1, 0.3, 0.9, fab, FAB, 0.06); for (const s of [-1, 0, 1]) B(s * 0.66, 0.42, 0.08, 0.64, 0.14, 0.7, shade(fab, 1.06), FAB, 0.05); B(0, 0.42, -0.33, 2.1, 0.55, 0.24, fab, FAB, 0.08);
      for (const s of [-1, 1]) B(s * 1.0, 0.12, 0, 0.18, 0.55, 0.9, shade(fab, 0.9), FAB, 0.06); B(0.6, 0.55, -0.15, 0.35, 0.3, 0.12, hex(0xeee8dc), FAB, 0.05); return [2.1, 0.8, 0.9]; }
    case 'armchair': { const c = hex(0xeae2d2); B(0, 0.1, 0, 0.8, 0.32, 0.78, c, FAB, 0.1); B(0, 0.42, -0.3, 0.8, 0.45, 0.2, c, FAB, 0.1); for (const s of [-1, 1]) B(s * 0.36, 0.3, 0, 0.14, 0.32, 0.72, c, FAB, 0.06); for (const [x, z] of [[0.3, 0.3], [-0.3, 0.3], [0.3, -0.3], [-0.3, -0.3]]) B(x, 0, z, 0.05, 0.12, 0.05, wood); return [0.8, 0.8, 0.8]; }
    case 'plant': C(0, 0, 0, 0.18, 0.35, hex(0xe8e4dc), STONE); mb.setColor(hex(0x3a7a32), FAB); for (let k = 0; k < 9; k++) { const a = k * 2.4, h = 0.5 + r() * 0.5; mb.box(mat4.mul(mat4.create(), T, M(Math.cos(a) * 0.14, 0.35 + h / 2, Math.sin(a) * 0.14, a, 1, 0.5)), 0.12, h, 0.03, k % 2 ? hex(0x3a7a32) : hex(0x4e9a3e)); } return null;
    case 'rtable': { C(0, 0.72, 0, 0.6, 0.05, wood, WOOD, 16); C(0, 0, 0, 0.08, 0.72, wood, WOOD); C(0, 0, 0, 0.28, 0.04, wood, WOOD); C(0, 0.77, 0, 0.16, 0.06, hex(0xd8d0b8), STONE);
      for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + 0.4; const cx = Math.cos(a) * 0.85, cz = Math.sin(a) * 0.85; const m0 = mat4.mul(mat4.create(), T, M(cx, 0, cz, -a + Math.PI / 2));
        const BB = (x, y, z, sx, sy, sz, c, f = WOOD) => { mb.setColor(c, f); mb.box(mat4.mul(mat4.create(), m0, M(x, y + sy / 2, z)), sx, sy, sz, c); };
        BB(0, 0.44, 0, 0.42, 0.05, 0.42, wood); BB(0, 0.49, 0.03, 0.4, 0.05, 0.36, hex(0xe8e0d0), FAB); BB(0, 0.49, 0.2, 0.42, 0.45, 0.04, wood); for (const [x, z] of [[0.17, 0.17], [-0.17, 0.17], [0.17, -0.17], [-0.17, -0.17]]) BB(x, 0, z, 0.04, 0.44, 0.04, wood); }
      return [1.25, 0.8, 1.25]; }
    // ---- hospital
    case 'screen': { const g = hex(0x3e7a4a); const n = 3; for (let k = 0; k < n; k++) { const x = (k - 1) * 0.62; const m = p.rot90 ? [0, x] : [x, 0];
        B(m[0], 0.15, m[1], p.rot90 ? 0.03 : 0.58, 1.55, p.rot90 ? 0.58 : 0.03, g, FAB); } for (const s of [-1, 1]) { const m = p.rot90 ? [0, s * 0.95] : [s * 0.95, 0]; C(m[0], 0, m[1], 0.018, 1.8, steel); } return null; }
    case 'exam': B(0, 0, 0, 0.7, 0.75, 1.9, steel, MET); B(0, 0.75, 0, 0.72, 0.12, 1.95, hex(0x5a8aa8), FAB, 0.03); B(0, 0.87, -0.7, 0.72, 0.18, 0.5, hex(0x5a8aa8), FAB, 0.03); C(0.6, 0, 0.4, 0.02, 1.7, steel); B(0.6, 1.7, 0.4, 0.5, 0.06, 0.4, steel, MET); return [0.75, 1.0, 1.95];
    case 'chair': B(0, 0.42, 0, 0.46, 0.06, 0.46, hex(0x3a5a9a), FAB); B(0, 0.48, -0.21, 0.46, 0.45, 0.05, hex(0x3a5a9a), FAB); for (const [x, z] of [[0.19, 0.19], [-0.19, 0.19], [0.19, -0.19], [-0.19, -0.19]]) B(x, 0, z, 0.035, 0.42, 0.035, steel, MET); return null;
    case 'chairs3': { const bl = hex(0x3a52a8); B(0, 0.36, 0, 1.9, 0.05, 0.12, steel, MET); for (const s of [-1, 1]) B(s * 0.85, 0, 0, 0.06, 0.38, 0.5, steel, MET); for (let k = -1; k <= 1; k++) { B(k * 0.62, 0.4, 0.02, 0.56, 0.08, 0.5, bl, FAB, 0.03); B(k * 0.62, 0.47, -0.22, 0.56, 0.48, 0.07, bl, FAB, 0.03); } return [1.9, 0.9, 0.55]; }
    case 'hsofa': { const c = hex(0xd8806a); B(0, 0.1, 0, 1.8, 0.35, 0.85, c, FAB, 0.06); B(0, 0.45, -0.3, 1.8, 0.45, 0.24, c, FAB, 0.06); for (const s of [-1, 1]) B(s * 0.84, 0.1, 0, 0.16, 0.55, 0.85, shade(c, 0.9), FAB, 0.05); return [1.8, 0.9, 0.85]; }
    case 'cart': B(0, 0.12, 0, 0.7, 0.75, 0.45, hex(0x5a7ab8), MET, 0.02); for (let k = 0; k < 3; k++) B(0, 0.3 + k * 0.22, 0.23, 0.62, 0.015, 0.01, hex(0xe8e8e8), MET); for (const [x, z] of [[0.3, 0.18], [-0.3, 0.18], [0.3, -0.18], [-0.3, -0.18]]) C(x, 0, z, 0.04, 0.12, dark); return [0.7, 0.9, 0.45];
    case 'bookcase': B(0, 0, 0, 1.4, 1.1, 0.4, white, STONE); for (let k = 0; k < 2; k++) for (let j = 0; j < 6; j++) B(-0.55 + j * 0.22, 0.15 + k * 0.5, 0.05, 0.16, 0.32, 0.22, [hex(0xd84a3a), hex(0x3a8ad8), hex(0x5ab84a), hex(0xf0c040)][(j + k) % 4], FAB); return [1.4, 1.1, 0.4];
    case 'reception': { const top = hex(0xf2d4c4), body = hex(0xe8c4b2); const R = 2.2, n = 9; for (let k = 0; k < n; k++) { const a0 = Math.PI * (0.05 + 0.9 * k / n), a1 = Math.PI * (0.05 + 0.9 * (k + 1) / n), am = (a0 + a1) / 2;
        const L = 2 * R * Math.sin((a1 - a0) / 2) + 0.05; const x = Math.cos(am) * R, z = Math.sin(am) * R; const m0 = mat4.mul(mat4.create(), T, M(x, 0, z, -am + Math.PI / 2));
        mb.setColor(body, STONE); mb.box(mat4.mul(mat4.create(), m0, M(0, 0.5, 0)), L, 1.0, 0.5, body); mb.setColor(top, STONE); mb.box(mat4.mul(mat4.create(), m0, M(0, 1.02, 0.08)), L + 0.02, 0.06, 0.7, top);
        if (k % 3 === 1) { mb.setColor(dark, MET); mb.box(mat4.mul(mat4.create(), m0, M(0, 1.25, -0.12)), 0.5, 0.32, 0.04, dark); } if (k % 4 === 0) { mb.setColor(hex(0x4aa84a), FAB); mb.box(mat4.mul(mat4.create(), m0, M(0.2, 1.1, 0.1)), 0.12, 0.12, 0.12, hex(0x4aa84a)); } }
      return null; }
  }
  return furniture(mb, p, T, r);
}
function placeFurniture(kit, list, r) {
  for (const p of list) { const box = fur(kit, p, r); if (!box) continue; const s = Math.abs(Math.sin(p.f)) > 0.7; kit.col(p.u, p.v, (p.y0 || 0) + 0.12, (p.y0 || 0) + 0.12 + box[1], (s ? box[2] : box[0]) / 2, (s ? box[0] : box[2]) / 2); }
}

// ---------------- casa de subúrbio ----------------
export function suburbHouseMesh(b) {
  const kit = makeKit(b); const { box, col, wall } = kit; const r = rng(b.seed); const W = b.w, D = b.d, hw = W / 2, hd = D / 2;
  const dim = b.decay > 0.12 ? 0.72 : 1; const sid = shade(hex(SIDING[b.color ?? Math.floor(r() * SIDING.length)]), dim); const trim = shade(hex(0xf2f0ea), dim * 0.98); const roofC = shade(hex(ROOFS[Math.floor(r() * ROOFS.length)]), dim);
  const inner = hex(0xeeeadf), floorW = hex(0xb07a48), floorT = hex(0xdcdad4), brick = hex(0x8a4a36);
  const shutter = r() < 0.4 ? hex(SHUT[Math.floor(r() * SHUT.length)]) : null; const doorC = hex(DOORS[Math.floor(r() * DOORS.length)]); const glassOk = b.decay < 0.12;
  const FL = 0.35, H = 3.3, plan = suburbPlan(b); const two = b.floors > 1; const sx = plan.sx;
  // fundação de tijolo/concreto e pisos (madeira; azulejo no banheiro)
  box(0, -0.8, 0, W + 0.1, 0.8 + FL, D + 0.1, r() < 0.5 ? brick : hex(0x9a968c));
  box(0, FL - 0.02, 0, W - 0.2, 0.04, D - 0.2, floorW, WOOD); { const bu = (-hw + plan.uBath) / 2 * sx; box(bu, FL + 0.003, (-hd + plan.zBath) / 2, Math.abs(plan.uBath + hw) - 0.2, 0.03, plan.zBath + hd - 0.2, floorT, STONE); }
  col(0, 0, -1, FL + 0.02, hw - 0.05, hd - 0.05, { platform: true });
  // paredes externas com janelas e portas (frente +Z)
  const byWall = { F: [], B: [], L: [], R: [] }; for (const e of plan.ext) byWall[e.wall].push(e);
  const yb = FL; const defs = { F: [-hw, hd, hw, hd, 1], B: [-hw, -hd, hw, -hd, -1], L: [-hw, -hd, -hw, hd, -1], R: [hw, -hd, hw, hd, 1] };
  for (const [k, [u0, z0, u1, z1, n]] of Object.entries(defs)) { const hs = wall(u0, z0, u1, z1, yb, H, byWall[k], sid, inner, 0.22, { outN: n });
    for (const q of hs) { windowTrim(kit, q, yb, n, trim, q.front ? null : shutter, b, glassOk && !q.door); if (q.door && b.doors) hingeDoor(kit, q, yb, -n, q.front ? doorC : shade(doorC, 0.9)); } }
  // cantoneiras brancas
  for (const [x, z] of [[-hw, -hd], [hw, -hd], [-hw, hd], [hw, hd]]) box(x, 0, z, 0.26, FL + H * (two ? 2 : 1) + 0.05, 0.26, trim);
  // porta da frente (folha aberta para dentro) e porta dos fundos
  if (!b.doors) for (const e of plan.ext.filter((q) => q.door)) { const zf = e.wall === 'F' ? hd : -hd, s = e.wall === 'F' ? -1 : 1; mb_door(kit, e.c, zf + s * 0.5, yb, e.front ? doorC : shade(doorC, 0.9), s, e.w); }
  // paredes internas
  for (const w of plan.walls) { const hs = wall(w.u0, w.z0, w.u1, w.z1, yb, H - 0.05, w.holes, null, inner, 0.14); for (const q of hs) if (q.door) { const ax = q.ax; if (b.doors) hingeDoor(kit, q, yb, 1, hex(0xe8e2d4)); box(ax ? q.c : q.fixed, yb + 2.2, ax ? q.fixed : q.c, ax ? q.w : 0.16, 0.08, ax ? 0.16 : q.w, hex(0xd8d2c4)); } }
  // teto/laje (só câmera) e 2º andar (fechado, só por fora)
  box(0, yb + H, 0, W, 0.18, D, inner); col(0, 0, yb + H, yb + H + 0.2, hw, hd, { camOnly: true });
  let top = yb + H + 0.18;
  if (two) { const up = { F: [], B: [], L: [], R: [] }; for (const c of [-hw + 1.8, 0, hw - 1.8]) { up.F.push({ c, w: 1.1, y0: 0.9, y1: 2.2 }); up.B.push({ c, w: 1.0, y0: 1.0, y1: 2.1 }); } up.L.push({ c: 0, w: 1.0, y0: 1.0, y1: 2.1 }); up.R.push({ c: 0, w: 1.0, y0: 1.0, y1: 2.1 });
    for (const [k, [u0, z0, u1, z1, n]] of Object.entries(defs)) { const hs = wall(u0, z0, u1, z1, top, H - 0.3, up[k], sid, inner, 0.22, { outN: n }); for (const q of hs) windowTrim(kit, q, top, n, trim, shutter, b, false); }
    box(0, top - 0.12, hd + 0.08, W + 0.3, 0.16, 0.12, trim); top += H - 0.3; }
  // telhado principal + chaminé + água-furtada
  const pitch = 0.5 + r() * 0.2; const rise = gable(kit, -hw, hw, -hd, hd, top, pitch, roofC, sid, trim);
  if (r() < 0.55) { const cxh = (r() < 0.5 ? -1 : 1) * (hw - 0.9); box(cxh, top - 1.2, -hd * 0.35, 0.8, rise + 2.0, 0.8, brick); box(cxh, top + rise + 0.8, -hd * 0.35, 0.9, 0.12, 0.9, shade(brick, 0.8)); }
  if (!two && r() < 0.55) { const n = r() < 0.4 ? 3 : 1; for (let i = 0; i < n; i++) { const ux = n === 1 ? (r() - 0.5) * W * 0.3 : (i - 1) * W * 0.28; const dz = hd * 0.45, dy = top + rise * (1 - (dz + 0.45) / (hd + 0.45)) - 0.1;
      box(ux, dy, dz - 0.3, 1.5, 1.25, 1.2, sid, FAB); box(ux, dy + 0.2, dz + 0.31, 0.9, 0.75, 0.04, hex(0x1a2026), MET); box(ux, dy + 0.15, dz + 0.32, 1.06, 0.08, 0.05, trim); box(ux, dy + 0.95, dz + 0.32, 1.06, 0.08, 0.05, trim);
      gable(kit, ux - 0.75, ux + 0.75, dz - 0.9, dz + 0.3, dy + 1.25, 0.6, roofC, sid, trim, false); } }
  // garagem anexa (porta de madeira com painéis) + entrada de concreto
  if (b.garage) { const g = b.garage * sx, GW = 5.4, GD = Math.min(D, 6.4), gx0 = g > 0 ? hw : -hw - GW, gx1 = gx0 + GW, gz0 = hd - GD, GH = 3.0;
    box((gx0 + gx1) / 2, -0.4, (gz0 + hd) / 2, GW, 0.5, GD, hex(0x9a968c)); col((gx0 + gx1) / 2, (gz0 + hd) / 2, -1, 0.1, GW / 2, GD / 2, { platform: true });
    const ox = g > 0 ? gx1 : gx0; wall(ox, gz0, ox, hd, 0.1, GH, [{ c: (gz0 + hd) / 2, w: 1.0, y0: 1.0, y1: 2.0 }], sid, inner, 0.22, { outN: g }); wall(gx0, gz0, gx1, gz0, 0.1, GH, [], sid, inner, 0.22, { outN: -1 });
    const gd = hex(DOORS[(b.seed >> 3) % 3]); wall(gx0, hd, gx1, hd, 0.1, GH, [], gd, inner, 0.22, { outN: 1, fOut: WOOD });
    for (let k = 0; k < 4; k++) box((gx0 + gx1) / 2, 0.15 + k * 0.62, hd + 0.13, GW - 0.9, 0.04, 0.04, shade(gd, 0.75), WOOD); for (const s of [-1, 0, 1]) box((gx0 + gx1) / 2 + s * 1.15, 0.15, hd + 0.13, 0.04, 2.5, 0.04, shade(gd, 0.75), WOOD);
    for (let k = 0; k < 4; k++) box((gx0 + gx1) / 2 - 1.5 + k, 2.15, hd + 0.14, 0.7, 0.3, 0.03, hex(0x1a2026), MET); box((gx0 + gx1) / 2, 2.75, hd + 0.13, GW - 0.5, 0.12, 0.1, trim);
    box((gx0 + gx1) / 2, 0, gz0 + GD / 2, GW + 0.1, 0.1, GD, hex(0x6a645a)); box((gx0 + gx1) / 2, 0.1 + GH, (gz0 + hd) / 2, GW, 0.12, GD, inner);
    gable(kit, gx0, gx1, gz0, hd, 0.1 + GH + 0.12, 0.42, roofC, sid, trim, false);
    box((gx0 + gx1) / 2, -0.05, hd + (b.drive || 4) / 2, GW - 0.6, 0.1, b.drive || 4, hex(0xb8b4aa)); }
  // varanda: deck, colunas, guarda-corpo branco, degraus e telhadinho
  if (b.porch) { const PD = 1.9; const door = plan.ext.find((q) => q.front); const pw = Math.min(W - 0.6, 5.5 + r() * 2); let pc = door.c + (r() - 0.5) * 1.2; pc = Math.max(-hw + pw / 2 + 0.1, Math.min(hw - pw / 2 - 0.1, pc));
    box(pc, -0.6, hd + PD / 2, pw, 0.6 + FL, PD, hex(0xd8d4cc)); col(pc, hd + PD / 2, -1, FL, pw / 2, PD / 2, { platform: true });
    const sw = 1.6; box(door.c, -0.4, hd + PD + 0.15, sw, 0.63, 0.3, hex(0xd8d4cc)); box(door.c, -0.4, hd + PD + 0.45, sw, 0.52, 0.3, hex(0xcfcbc2));
    const ph = 2.75; const cols = [pc - pw / 2 + 0.15, pc + pw / 2 - 0.15]; if (pw > 4) cols.push(door.c - sw / 2 - 0.1, door.c + sw / 2 + 0.1);
    for (const cx of cols) { box(cx, FL, hd + PD - 0.15, 0.22, ph, 0.22, trim); box(cx, FL, hd + PD - 0.15, 0.3, 0.25, 0.3, trim); col(cx, hd + PD - 0.15, FL, FL + ph, 0.12, 0.12); }
    // guarda-corpo (deixa o vão da escada livre)
    const rail = (a, bb, zz, alongX) => { if (bb - a < 0.2) return; const L = bb - a, c = (a + bb) / 2; box(alongX ? c : zz, FL + 0.88, alongX ? zz : c, alongX ? L : 0.07, 0.07, alongX ? 0.07 : L, trim); box(alongX ? c : zz, FL + 0.08, alongX ? zz : c, alongX ? L : 0.06, 0.06, alongX ? 0.06 : L, trim);
      for (let t = 0.12; t < L; t += 0.17) box(alongX ? a + t : zz, FL + 0.1, alongX ? zz : a + t, 0.035, 0.78, 0.035, trim); col(alongX ? c : zz, alongX ? zz : c, FL, FL + 0.95, alongX ? L / 2 : 0.05, alongX ? 0.05 : L / 2); };
    const zf = hd + PD - 0.15; rail(pc - pw / 2 + 0.15, door.c - sw / 2 - 0.1, zf, true); rail(door.c + sw / 2 + 0.1, pc + pw / 2 - 0.15, zf, true);
    for (const s of [-1, 1]) rail(hd + 0.15, hd + PD - 0.15, pc + s * (pw / 2 - 0.15), false);
    const pr = FL + ph; mb_shed(kit, pc, pw + 0.4, hd, hd + PD + 0.35, pr, roofC, trim); }
  // jardim da frente: calçada da porta até a rua
  { const door = plan.ext.find((q) => q.front); box(door.c, -0.06, hd + 2 + (b.drive || 4) / 2, 1.2, 0.1, (b.drive || 4) + 0.5, hex(0xc0bcb2)); }
  // móveis
  placeFurniture(kit, plan.P, r);
  return finish(kit, b);
}
function mb_door(kit, c, z, yb, colr, s, w) { const { box } = kit; box(c - w / 2 + 0.03, yb, z, 0.05, 2.15, 0.9, colr, WOOD); box(c - w / 2 + 0.03 + 0.04, yb + 1.0, z + 0.3 * s, 0.03, 0.06, 0.08, hex(0xc8a848), MET); }
function mb_shed(kit, cx, w, z0, z1, y, tile, trim) { const { mb, box } = kit; const L = z1 - z0, slope = 0.22; mb.setColor(tile, STONE); mb.box(M(cx, y + 0.35 - L * Math.tan(slope) / 2 + 0.08, (z0 + z1) / 2, 0, 1, slope), w, 0.12, L / Math.cos(slope), tile);
  box(cx, y - 0.12, z1 - 0.3, w, 0.3, 0.1, trim); box(cx, y + 0.1, (z0 + z1) / 2, w - 0.1, 0.05, L - 0.2, trim); }

// ---------------- hospital: térreo + 1º andar com escada ----------------
const FONT = { H: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'], O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'], S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'], I: ['11111', '00100', '00100', '00100', '00100', '00100', '11111'], T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'], L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'] };
export function hospitalMesh(b) {
  const kit = makeKit(b); const { box, col, wall, mb } = kit; const r = rng(b.seed); const W = b.w, D = b.d, hw = W / 2, hd = D / 2; const plan = hospitalPlan(b); const FH = plan.FH, lob = plan.lob;
  const dim = b.decay > 0.12 ? 0.75 : 1; const white = shade(hex(0xeeeeec), dim), teal = hex(0x2c4e52), inner = hex(0xece0b0), band = hex(0x8a9aa4), glassOk = b.decay < 0.12;
  const FL = 0.15; const H2 = FH * 2;
  box(0, -0.8, 0, W + 0.4, 0.8 + FL, D + 0.4, hex(0x9a9890)); col(0, 0, -1, FL, hw, hd, { platform: true });
  box(0, FL - 0.01, 0, lob * 2, 0.02, D - 0.3, hex(0x8cc4a8), STONE); for (const s of [-1, 1]) box(s * (lob + hw) / 2, FL - 0.01, 0, hw - lob - 0.3, 0.02, D - 0.3, hex(0xb4cce0), STONE);
  // paredes externas: janelas nos dois andares; porta dupla larga na frente
  const winsX = (k) => { const out = []; for (let x = -hw + 2.2; x < hw - 1.8; x += 3.0) { if (k === 'F' && Math.abs(x) < 4.4) continue; out.push(x); } return out; };
  const defs = { F: [-hw, hd, hw, hd, 1], B: [-hw, -hd, hw, -hd, -1], L: [-hw, -hd, -hw, hd, -1], R: [hw, -hd, hw, hd, 1] };
  for (const [k, [u0, z0, u1, z1, n]] of Object.entries(defs)) { const ax = z0 === z1; const holes = [];
    const ws = ax ? winsX(k) : [-hd + 2.5, -hd + 5.5, hd - 5.5, hd - 2.5];
    for (let fl = 0; fl < 2; fl++) { const hs = []; for (const c of ws) hs.push({ c, w: 1.6, y0: 1.0, y1: 2.6 }); if (k === 'F' && fl === 0) hs.push({ c: 0, w: 2.6, y0: 0, y1: 2.8, door: true });
      const q = wall(u0, z0, u1, z1, FL + fl * FH, FH, hs, white, inner, 0.3, { outN: n }); for (const h of q) if (!h.door) { const y0 = FL + fl * FH; const at = ax ? [h.c, h.fixed + n * 0.16] : [h.fixed + n * 0.16, h.c];
        box(at[0], y0 + h.y0, at[1], ax ? h.w : 0.04, h.y1 - h.y0, ax ? 0.04 : h.w, hex(0x14181c), MET); box(at[0], y0 + h.y0 + 0.75, at[1], ax ? h.w : 0.06, 0.05, ax ? 0.06 : h.w, hex(0xd0d4d6), MET);
        addWin(kit, b, ax, h.c, h.fixed, y0 + h.y0, y0 + h.y1, h.w);
        if (glassOk) { const [gx, gz] = kit.toW(ax ? h.c : h.fixed, ax ? h.fixed : h.c); kit.glass.push({ x: gx, z: gz, y: b.y + y0 + (h.y0 + h.y1) / 2, w: h.w, h: h.y1 - h.y0, rot: b.rot + (ax ? 0 : Math.PI / 2) }); } } }
    void holes; }
  // faixas verde-petróleo nos andares e no topo; platibanda
  for (const y of [FL + FH - 0.15, FL + H2 - 0.1]) { box(0, y, hd + 0.17, W + 0.1, 0.22, 0.06, teal); box(0, y, -hd - 0.17, W + 0.1, 0.22, 0.06, teal); box(hw + 0.17, y, 0, 0.06, 0.22, D + 0.1, teal); box(-hw - 0.17, y, 0, 0.06, 0.22, D + 0.1, teal); }
  box(0, FL + H2, 0, W + 0.4, 0.5, D + 0.4, white); box(0, FL + H2 + 0.5, 0, W - 0.4, 0.03, D - 0.4, hex(0xc4c6c4)); for (const s of [-1, 1]) { box(0, FL + H2 + 0.5, s * (D / 2 + 0.05), W + 0.5, 0.1, 0.3, teal); box(s * (W / 2 + 0.05), FL + H2 + 0.5, 0, 0.3, 0.1, D + 0.5, teal); } col(0, 0, FL + H2, FL + H2 + 0.5, hw, hd, { platform: true }); { const LS = ladderSpec(b); if (LS) ladderMesh(mb, LS); }
  for (const [x, z] of [[-hw + 3, -hd + 3], [-hw + 6.5, -hd + 2.5], [hw - 3, -hd + 3], [hw - 3.5, hd - 3]]) { box(x, FL + H2 + 0.5, z, 2.0, 0.6, 1.4, hex(0xc8cacc), MET); for (const [dx, dz] of [[-0.45, -0.3], [0.45, -0.3], [-0.45, 0.3], [0.45, 0.3]]) { mb.setColor(hex(0x3a3c40), MET); mb.cylinder(M(x + dx, FL + H2 + 1.1, z + dz), 0.22, 0.22, 0.02, 10, hex(0x3a3c40)); } }
  // torres de vidro dos lados da entrada + marquise com cruz vermelha + letreiro "HOSPITAL"
  for (const s of [-1, 1]) { const tx = s * 3.3; box(tx, FL, hd + 0.5, 1.8, H2 + 0.3, 1.0, hex(0x15191d), MET); col(tx, hd + 0.5, 0, FL + H2, 0.9, 0.5);
    for (let k = 1; k < 8; k++) box(tx, FL + k * H2 / 8, hd + 1.01, 1.82, 0.05, 0.03, hex(0x9aa4aa), MET); for (const dx of [-0.6, 0, 0.6]) box(tx + dx, FL, hd + 1.01, 0.05, H2 + 0.3, 0.03, hex(0x9aa4aa), MET);
    box(tx, FL + H2 + 0.3, hd + 0.6, 2.1, 0.12, 1.3, hex(0x8a9aa0), MET); }
  box(0, FL + 2.95, hd + 1.4, 3.6, 0.45, 2.8, white); for (const s of [-1, 1]) { box(s * 1.6, 0, hd + 2.6, 0.3, FL + 2.95, 0.3, white); col(s * 1.6, hd + 2.6, 0, FL + 2.95, 0.15, 0.15); }
  { const red = hex(0xd02020); box(0, FL + 3.42, hd + 1.9, 1.3, 0.04, 0.4, red); box(0, FL + 3.42, hd + 1.9, 0.4, 0.04, 1.3, red); box(0, FL + 3.0, hd + 2.81, 1.0, 0.32, 0.02, red); box(0, FL + 2.9, hd + 2.81, 0.32, 0.52, 0.02, red); }
  { const word = 'HOSPITAL', px = 0.075, lw = 6 * px; const x0 = -(word.length * lw) / 2 + px / 2; const yT = FL + FH + 2.6;
    for (let i = 0; i < word.length; i++) { const g = FONT[word[i]]; for (let row = 0; row < 7; row++) for (let c = 0; c < 5; c++) if (g[row][c] === '1') box(x0 + i * lw + c * px, yT - row * px, hd + 0.18, px, px, 0.04, hex(0xc81e1e)); } }
  // laje do 1º andar com o vão da escada; escada de 16 degraus; guarda-corpo em volta do vão
  const st = plan.stair; const sl = (x0, x1, z0, z1) => { if (x1 - x0 < 0.05 || z1 - z0 < 0.05) return; box((x0 + x1) / 2, FL + FH - 0.2, (z0 + z1) / 2, x1 - x0, 0.2, z1 - z0, hex(0xd8d4cc)); col((x0 + x1) / 2, (z0 + z1) / 2, FL + FH - 0.2, FL + FH, (x1 - x0) / 2, (z1 - z0) / 2, { platform: true }); };
  sl(-hw, hw, st.z1, hd); sl(-hw, st.u0, -hd, st.z1); sl(st.u1, hw, -hd, st.z1);
  box(0, FL + FH + 0.005, (st.z1 + hd) / 2, lob * 2, 0.02, hd - st.z1 - 0.3, hex(0x8cc4a8)); for (const s of [-1, 1]) box(s * (lob + hw) / 2, FL + FH + 0.005, 0, hw - lob - 0.3, 0.02, D - 0.3, hex(0xb4cce0));
  { const n = st.steps, run = (st.u1 - st.u0) / n, rise = FH / n, sw = st.z1 - st.z0, zc = (st.z0 + st.z1) / 2;
    for (let i = 0; i < n; i++) { const x = st.u0 + (i + 0.5) * run, y1 = FL + (i + 1) * rise; box(x, FL, zc, run + 0.01, y1 - FL, sw, i % 2 ? hex(0xc8c4bc) : hex(0xd2cec6)); col(x, zc, 0, y1, run / 2 + 0.005, sw / 2, { platform: true }); }
    for (let i = 0; i <= n; i += 2) { const x = st.u0 + i * run; box(x, FL + i * rise, st.z1 - 0.05, 0.04, 0.95, 0.04, hex(0x9aa0a6), MET); }
    mb.setColor(hex(0x9aa0a6), MET); const L = Math.hypot(st.u1 - st.u0, FH); mb.box(M((st.u0 + st.u1) / 2, FL + FH / 2 + 0.95, st.z1 - 0.05, 0, 1, 0, Math.atan2(FH, st.u1 - st.u0)), L, 0.05, 0.05, hex(0x9aa0a6));
    // guarda-corpo do vão no andar de cima (lado da frente do vão; deixa a chegada da escada livre)
    const yR = FL + FH; box((st.u0 + st.u1 - 1.2) / 2, yR + 0.95, st.z1 + 0.04, st.u1 - st.u0 - 1.2, 0.06, 0.06, hex(0x9aa0a6), MET); for (let x = st.u0; x < st.u1 - 1.2; x += 0.5) box(x, yR, st.z1 + 0.04, 0.04, 0.95, 0.04, hex(0x9aa0a6), MET);
    col((st.u0 + st.u1 - 1.2) / 2, st.z1 + 0.04, yR, yR + 1.0, (st.u1 - st.u0 - 1.2) / 2, 0.06); box(st.u0 - 0.04, yR, (st.z0 + st.z1) / 2, 0.06, 1.0, sw, hex(0x9aa0a6), MET); col(st.u0 - 0.04, (st.z0 + st.z1) / 2, yR, yR + 1.0, 0.05, sw / 2); }
  // paredes internas (alas) nos dois andares, com faixa cinza embaixo e portas
  for (const w of plan.walls) { const yb = FL + w.y0; const hs = wall(w.u0, w.z0, w.u1, w.z1, yb, FH - 0.2, w.holes, null, inner, 0.16);
    const ax = w.z0 === w.z1, L = ax ? Math.abs(w.u1 - w.u0) : Math.abs(w.z1 - w.z0); for (const s of [-1, 1]) box(ax ? (w.u0 + w.u1) / 2 : w.u0 + s * 0.085, yb, ax ? w.z0 + s * 0.085 : (w.z0 + w.z1) / 2, ax ? L : 0.01, 0.9, ax ? 0.01 : L, band);
    for (const q of hs) if (q.door) { box(ax ? q.c : q.fixed, yb + 2.4, ax ? q.fixed : q.c, ax ? q.w : 0.2, 0.1, ax ? 0.2 : q.w, hex(0xc86a3a)); box(ax ? q.c - q.w / 2 : q.fixed + 0.05, yb, ax ? q.fixed + 0.05 : q.c - q.w / 2, ax ? 0.05 : 0.9, 2.3, ax ? 0.9 : 0.05, hex(0xc86a3a), WOOD); } }
  // colunas do saguão
  for (const s of [-1, 1]) { box(s * 2.6, FL, hd - 4.5, 0.4, FH - 0.2, 0.4, hex(0xe8c890)); col(s * 2.6, hd - 4.5, FL, FL + FH, 0.2, 0.2); }
  // móveis
  placeFurniture(kit, plan.P, r);
  return finish(kit, b);
}
