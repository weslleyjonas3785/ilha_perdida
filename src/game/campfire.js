// Fogueira com inventário: combustível (lenha, galhos, carvão…), grelha com 4 espaços para assar e sobras (carvão e cinza).
// Lenha queimada vira carvão; carvão queimado vira cinza. A comida fica assando na grelha (aparece fora do menu): crua → assada
// (som de assado) → queimada se demorar a tirar. Dá para pegar a comida só mirando nela na fogueira.
// Todas as transferências movem exatamente o que coube no destino (sem duplicar nem sumir itens).
import { ITEMS, RECIPES } from './items.js';
import { MeshBuilder, M, hex } from '../engine/mesh.js';
import { mat4 } from '../engine/math.js';

export const FUEL = { wood: { t: 60, out: 'charcoal' }, charcoal: { t: 100, out: 'ash' }, stick: { t: 18 }, leaf: { t: 5 }, fiber: { t: 5 } };
export const COOK_T = 25, BURN_T = 50, FUEL_SLOTS = 3, COOK_SLOTS = 4, OUT_SLOTS = 3, FUEL_STACK = 20;
// o que assa (receitas de fogueira com 1 ingrediente) e o que queima depois de pronto
export const COOK = {}; for (const r of RECIPES) { if (r.station !== 'fire') continue; const k = Object.keys(r.cost); if (k.length === 1 && r.cost[k[0]] === 1 && r.n === 1) COOK[k[0]] = r.out; }
export const BURN = { cooked_cow: 'burnt_cow', cooked_boar: 'burnt_boar', cooked_chicken: 'burnt_chicken', cooked_deer: 'burnt_deer', cooked_human: 'burnt_human', cookedmeat: 'burnt_meat' };
export const isCookRecipe = (r) => r.station === 'fire' && COOK[Object.keys(r.cost)[0]] === r.out && Object.keys(r.cost).length === 1;
export const canGrill = (id) => !!(COOK[id] || BURN[id] || ITEMS[id] && ITEMS[id].burnt);

export function fireData(p) {
  if (!p.data || !Array.isArray(p.data.cook)) p.data = { fuel: [{ id: 'stick', qty: 2 }, null, null], cook: Array(COOK_SLOTS).fill(null), out: Array(OUT_SLOTS).fill(null), burn: 0, burnId: null };
  const d = p.data; d.fuel.length = FUEL_SLOTS; d.cook.length = COOK_SLOTS; d.out.length = OUT_SLOTS; for (const a of [d.fuel, d.cook, d.out]) for (let i = 0; i < a.length; i++) if (a[i] === undefined || (a[i] && !ITEMS[a[i].id])) a[i] = null;
  return d;
}
const fuelLeft = (d) => d.fuel.some((s) => s && s.qty > 0);
// cor da comida na grelha
function foodTint(id) { const it = ITEMS[id] || {}; if (it.burnt) return [0.22, 0.12, 0.08, 1]; if (BURN[id] || id === 'water') return id === 'cooked_chicken' ? [0.95, 0.6, 0.32, 1] : [0.62, 0.3, 0.14, 1];
  return { meat_chicken: [1.0, 0.62, 0.55, 1], dirtywater: [0.45, 0.5, 0.4, 1] }[id] || [0.85, 0.16, 0.16, 1]; }
export const foodPos = (p, k) => { const o = [[-0.17, -0.1], [0.17, -0.1], [-0.17, 0.12], [0.17, 0.12]][k]; const c = Math.cos(p.rot), s = Math.sin(p.rot); return [p.x + o[0] * c + o[1] * s, p.y + 0.56, p.z - o[0] * s + o[1] * c]; };

export class Campfires {
  constructor(game) { this.g = game; this.sizzleT = 0; }
  // adiciona ao vetor de espaços (pilhas do mesmo item até o limite); devolve quanto coube
  _addTo(arr, id, n, max) { let left = n; for (const s of arr) if (s && s.id === id && left > 0) { const k = Math.min(left, max - s.qty); s.qty += k; left -= k; } for (let i = 0; i < arr.length && left > 0; i++) if (!arr[i]) { const k = Math.min(left, max); arr[i] = { id, qty: k }; left -= k; } return n - left; }
  // mochila → fogueira (combustível ou grelha); devolve quantos foram
  putFromInv(p, slotIdx) { const g = this.g, d = fireData(p), s = g.inv.slots[slotIdx]; if (!s) return 0; const id = s.id;
    if (FUEL[id]) { const k = this._addTo(d.fuel, id, s.qty, FUEL_STACK); if (k) g.inv.takeSlot(slotIdx, k); else g.ui.toast('Os espaços de combustível estão cheios', 'warn'); return k; }
    if (canGrill(id)) { let k = 0; for (let i = 0; i < COOK_SLOTS && k < s.qty; i++) if (!d.cook[i]) { d.cook[i] = { id, t: 0 }; k++; } if (k) g.inv.takeSlot(slotIdx, k); else g.ui.toast('A grelha está cheia', 'warn'); return k; }
    g.ui.toast('Isso não vai na fogueira (combustível: lenha, galhos, folhas, carvão; grelha: carnes e água suja)', 'warn'); return 0; }
  // fogueira → mochila; area: 'fuel' | 'cook' | 'out'
  take(p, area, i) { const g = this.g, d = fireData(p), arr = d[area], s = arr[i]; if (!s) return 0; const q = area === 'cook' ? 1 : s.qty; const k = g.inv.add(s.id, q);
    if (k <= 0) { g.ui.toast('Mochila cheia', 'warn'); return 0; } if (area === 'cook') arr[i] = null; else { s.qty -= k; if (s.qty <= 0) arr[i] = null; } g.audio.play('pickup'); return k; }
  setLit(p, on) { const g = this.g, d = fireData(p); if (on && !p.lit) { if (!fuelLeft(d) && !(d.burn > 0)) { g.ui.toast('Coloque combustível (lenha, galhos, folhas ou carvão) para acender', 'warn'); return false; } p.lit = true; g.audio.play('fireLight'); }
    else if (!on && p.lit) { p.lit = false; g.audio.play('splash'); } return true; }
  update(dt) {
    const g = this.g, P = g.player; this.sizzleT -= dt; let sizzle = null; if (g.netClient) return; // no multiplayer quem queima a lenha e assa é o mundo do dono (evita duplicar)
    for (const p of g.build.pieces) { if (p.type !== 'campfire') continue; const d = fireData(p); if (!p.lit) continue;
      // combustível
      if (!(d.burn > 0)) { const s = d.fuel.find((q) => q && q.qty > 0); if (!s) { p.lit = false; d.burnId = null; if (Math.hypot(p.x - P.pos[0], p.z - P.pos[2]) < 20) g.ui.toast('🔥 A fogueira apagou: acabou o combustível', 'info'); continue; }
        s.qty--; d.burn = FUEL[s.id].t; d.burnId = s.id; if (s.qty <= 0) d.fuel[d.fuel.indexOf(s)] = null; }
      d.burn -= dt; if (d.burn <= 0) { const o = FUEL[d.burnId] && FUEL[d.burnId].out; if (o) this._addTo(d.out, o, 1, ITEMS[o].stack || 30); d.burn = 0; d.burnId = null; }
      // grelha
      for (let i = 0; i < COOK_SLOTS; i++) { const c = d.cook[i]; if (!c) continue; const to = COOK[c.id] || BURN[c.id]; if (!to) continue; c.t += dt; const need = COOK[c.id] ? COOK_T : BURN_T;
        if (c.t >= need) { const was = c.id; c.id = to; c.t = 0; const fp = foodPos(p, i); if (COOK[was]) { g.audio.play('cooked', { at: fp, max: 30 }); } else g.audio.play('sizzle', { at: fp, max: 25, vol: 1.2 }); }
        if (!sizzle || Math.hypot(p.x - P.pos[0], p.z - P.pos[2]) < Math.hypot(sizzle.x - P.pos[0], sizzle.z - P.pos[2])) sizzle = p; } }
    if (sizzle && this.sizzleT <= 0) { this.sizzleT = 1.4 + Math.random() * 0.8; g.audio.play('sizzle', { at: [sizzle.x, sizzle.y + 0.5, sizzle.z], max: 22, vol: 0.8, noNoise: true }); }
  }
  render(items) {
    const g = this.g, r = g.renderer; if (!this.meshes) { const steak = new MeshBuilder(); steak.setColor([1, 1, 1], 0.86); steak.roundBox(M(0, 0.025, 0), 0.2, 0.05, 0.13, [1, 1, 1], 0.02, 1); steak.roundBox(M(0.07, 0.03, 0.03), 0.07, 0.04, 0.07, [1, 1, 1], 0.02, 1);
        const grill = new MeshBuilder(); const st = hex(0x3a3c40); grill.setColor(st, 0.5); for (let k = 0; k < 7; k++) grill.box(M(0, 0.5, -0.2 + k * 0.066), 0.62, 0.018, 0.018, st); for (const sx of [-0.31, 0.31]) grill.box(M(sx, 0.5, 0), 0.02, 0.02, 0.46, st); for (const [sx, sz] of [[-0.3, -0.22], [0.3, -0.22], [-0.3, 0.22], [0.3, 0.22]]) grill.box(M(sx, 0.25, sz), 0.025, 0.5, 0.025, st);
        this.meshes = { steak: r.createMesh(steak.build()), grill: r.createMesh(grill.build()) }; }
    const eye = g.cam.eye; for (const p of g.build.pieces) { if (p.type !== 'campfire' || !p.data || !Array.isArray(p.data.cook) || !p.data.cook.some(Boolean)) continue; if (Math.hypot(p.x - eye[0], p.z - eye[2]) > 80) continue;
      items.push({ mesh: this.meshes.grill, model: mat4.compose([p.x, p.y, p.z], p.rot), sphere: [p.x, p.y + 0.5, p.z, 1] });
      p.data.cook.forEach((c, k) => { if (!c) return; const fp = foodPos(p, k); items.push({ mesh: this.meshes.steak, model: mat4.compose(fp, p.rot + k * 0.7, 1), tint: foodTint(c.id), sphere: [fp[0], fp[1], fp[2], 0.3] });
        if (p.lit && (COOK[c.id] || BURN[c.id]) && Math.random() < 0.12) g.fx.burst([fp[0], fp[1] + 0.05, fp[2]], 1, [0.55, 0.55, 0.55], 0.4, 1.2, 0.04, -0.6); }); }
  }
}
