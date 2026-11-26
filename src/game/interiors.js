// Layout dos interiores (sem malha): casas com sala, cozinha e quarto; hospitais, farmácias e laboratórios.
// Usado pelo gerador do mundo (pontos de loot nos móveis) e por props.js (desenho dos móveis e colisores).
// Coordenadas "da porta": u = lateral, v = profundidade (+v aponta para a parede da porta).
import { rng } from '../engine/math.js';
import { suburbPlan, hospitalPlan } from './houses.js';

// converte (u, v) do referencial da porta para o local do prédio (lx, lz) e o giro dos móveis
export function doorFrame(b) {
  const dw = b.doorWall ?? 0; const Wu = dw < 2 ? b.w : b.d, Dv = dw < 2 ? b.d : b.w;
  const L = [(u, v) => [u, v], (u, v) => [-u, -v], (u, v) => [v, -u], (u, v) => [-v, u]][dw];
  const yaw = [0, Math.PI, Math.PI / 2, -Math.PI / 2][dw]; // giro que leva +v (frente) para a direção da porta
  return { dw, Wu, Dv, L, yaw };
}
// peça: { k: tipo, u, v, f: giro extra (rad), loot?: tipo de loot }
export function interiorLayout(b) {
  if (!b.furnish) return null;
  if (b.style === 'suburb' || b.style === 'hospital2') { const pl = b.style === 'suburb' ? suburbPlan(b) : hospitalPlan(b); return { F: { L: (u, v) => [u, v], yaw: 0 }, P: pl.P, walls: [] }; }
  const F = doorFrame(b); const r = rng((b.seed || 1) * 31 + 7); const hu = F.Wu / 2 - 0.2, hv = F.Dv / 2 - 0.2; const P = []; const walls = [];
  const add = (k, u, v, f = 0, loot = null, extra = {}) => P.push({ k, u, v, f, loot, ...extra });
  const st = b.style;
  if (st === 'hospital') {
    const n = Math.max(2, Math.floor((F.Wu - 3) / 2.4)); for (let i = 0; i < n; i++) { const u = -hu + 1.4 + i * 2.4; add('hbed', u, -hv + 1.2, 0); add('hbed', u, hv - 3.2, Math.PI); if (i % 2 === 0) add('drip', u + 0.75, -hv + 0.5, 0); }
    add('desk', 0, hv - 1.6, Math.PI); for (const [u, v, f] of [[-hu + 0.3, -1, Math.PI / 2], [hu - 0.3, -1, -Math.PI / 2], [-hu + 0.3, 1.5, Math.PI / 2], [hu - 0.3, 1.5, -Math.PI / 2]]) add('medcabinet', u, v, f, 'hospital');
    return { F, P, walls };
  }
  if (st === 'pharmacy') {
    add('counter', 0, hv - 1.8, Math.PI); for (let i = 0; i < 2; i++) add('shelf2', -hu + 1.2 + i * (hu - 0.8), -0.5, 0, 'pharmacy'); add('shelfwall', 0, -hv + 0.25, 0, 'pharmacy'); add('medcabinet', hu - 0.3, -hv + 1.5, -Math.PI / 2, 'pharmacy');
    return { F, P, walls };
  }
  if (st === 'shop') { // loja: balcão no fundo, gôndolas no meio e prateleira na parede
    add('counter', hu - 1.6, hv - 1.8, Math.PI, null, { len: 2.4 }); for (let i = 0; i < 2; i++) add('shelf2', -hu + 2.0 + i * 3.4, -0.6, 0, 'shop'); add('shelfwall', -hu / 3, -hv + 0.25, 0, 'shop'); add('fridge', hu - 0.42, -hv + 0.42, 0, 'fridge');
    return { F, P, walls };
  }
  if (st === 'garage') { // oficina: bancada de ferramentas, estantes de peças, pneus e tambores
    add('workbench', -hu + 1.4, -hv + 0.45, 0, 'garage'); add('shelf', hu - 0.25, -hv + 1.6, -Math.PI / 2, 'garage'); add('shelf', hu - 0.25, -hv + 3.0, -Math.PI / 2, 'garage'); add('tirerack', -hu + 0.5, 0.2, Math.PI / 2, 'garage'); add('drums', 1.2, -hv + 0.6, 0);
    return { F, P, walls };
  }
  if (st === 'church') { // igreja: fileiras de bancos e o altar no fundo
    for (let i = 0; i < 5; i++) for (const s of [-1, 1]) add('pew', s * (hu * 0.45 + 0.1), -hv + 3.2 + i * 1.5, Math.PI); add('altar', 0, -hv + 1.0, 0, 'church'); add('lamp', -hu + 0.4, -hv + 0.4, 0); add('lamp', hu - 0.4, -hv + 0.4, 0);
    return { F, P, walls };
  }
  if (st === 'barracks') { // quartel: beliches e armários militares nas duas paredes
    const n = Math.max(2, Math.floor((F.Wu - 2) / 2.2)); for (let i = 0; i < n; i++) { const u = -hu + 1.2 + i * 2.2; add('bed', u, -hv + 1.08, 0); add('wardrobe', u + 0.95, -hv + 0.3, 0, i % 2 ? 'locker' : null); if (i < n - 1) add('bed', u, hv - 1.5, Math.PI); }
    add('wardrobe', hu - 0.32, 0, -Math.PI / 2, 'locker'); add('desk', -hu + 0.9, 0.2, Math.PI / 2); return { F, P, walls };
  }
  if (st === 'lab') {
    for (let i = 0; i < 3; i++) add('labbench', -hu + 1.6 + i * ((F.Wu - 3.2) / 2), -0.6, 0, i === 1 ? null : 'lab');
    add('labcabinet', -hu + 0.3, -hv + 1.4, Math.PI / 2, 'lab'); add('labcabinet', hu - 0.3, -hv + 1.4, -Math.PI / 2, 'lab'); add('fumehood', 0, -hv + 0.45, 0, 'lab');
    add('ratsuit', -hu + 1.6 + (F.Wu - 3.2) / 2, -0.6, r() * 0.6 - 0.3, null, { onTable: true }); // a roupa R.A.T dobrada sobre a bancada do meio
    return { F, P, walls };
  }
  // casa / apartamento: parede divisória entre a sala (frente) e o fundo (quarto | cozinha)
  const vA = -hv * 0.12, gap = 1.15;
  walls.push({ u0: -hu - 0.2, v0: vA, u1: -hu / 2 - gap / 2, v1: vA }, { u0: -hu / 2 + gap / 2, v0: vA, u1: hu / 2 - gap / 2, v1: vA }, { u0: hu / 2 + gap / 2, v0: vA, u1: hu + 0.2, v1: vA }, { u0: 0, v0: -hv - 0.2, u1: 0, v1: vA });
  // cozinha (fundo, lado +u)
  const kL = hu - 0.95; add('counter', 0.25 + (kL - 0.25) / 2, -hv + 0.33, 0, 'kcab', { len: kL - 0.25 }); add('stove', 0.65, -hv + 0.33, 0); add('sink', 0.25 + (kL - 0.25) * 0.7, -hv + 0.33, 0);
  add('wallcab', 0.25 + (kL - 0.25) / 2, -hv + 0.18, 0, null, { len: kL - 0.25 }); add('fridge', hu - 0.42, -hv + 0.42, 0, 'fridge');
  const tv = (vA + (-hv + 0.9)) / 2; if (vA - (-hv) > 3) add('dtable', hu / 2, tv + 0.15, 0);
  // quarto (fundo, lado -u)
  add('bed', -hu / 2 - 0.15, -hv + 1.08, 0); add('night', -hu / 2 + 1.05, -hv + 0.3, 0, 'night'); add('wardrobe', -hu + 0.32, vA - 0.95, Math.PI / 2, 'wardrobe'); add('medbox', -0.12, -hv / 2 - 0.3, -Math.PI / 2, 'medcab');
  // sala (frente)
  const vm = (vA + hv) / 2; add('rug', -hu / 2 + 0.6, vm, 0); add('sofa', -hu + 0.5, vm, Math.PI / 2); add('ctable', -hu + 1.75, vm, 0); add('tvstand', hu - 0.3, vm, -Math.PI / 2); add('shelf', hu * 0.2, vA + 0.22, 0, 'shelf');
  if (r() < 0.6) add('lamp', -hu + 0.35, hv - 0.35, 0);
  return { F, P, walls };
}
// pontos de loot dos móveis em coordenadas de mundo
export function interiorLoot(b) {
  const lay = interiorLayout(b); if (!lay) return []; const { F, P } = lay; const cr = Math.cos(b.rot), sr = Math.sin(b.rot); const out = [];
  for (const p of P) { if (!p.loot && p.k !== 'ratsuit') continue; const [lx, lz] = F.L(p.u, p.v); const x = b.x + lx * cr + lz * sr, z = b.z - lx * sr + lz * cr; out.push({ kind: p.loot, special: p.k === 'ratsuit' ? 'ratsuit' : null, x, z, y: b.y + (p.y0 || 0) + (p.onTable ? 0.98 : 0.12), rot: b.rot + F.yaw + p.f }); }
  return out;
}
// camas dos interiores (casas, apartamentos, hospitais) em coordenadas de mundo — dá para dormir nelas depois das 20:00
export function interiorBeds(b) {
  const lay = interiorLayout(b); if (!lay) return []; const { F, P } = lay; const cr = Math.cos(b.rot), sr = Math.sin(b.rot); const out = [];
  for (const p of P) { if (p.k !== 'bed' && p.k !== 'dbed' && p.k !== 'hbed') continue; const [lx, lz] = F.L(p.u, p.v); out.push({ x: b.x + lx * cr + lz * sr, z: b.z - lx * sr + lz * cr, y: b.y + (p.y0 || 0) + 0.03, rot: b.rot + (F.yaw || 0) + (p.f || 0), house: true }); }
  return out;
}
