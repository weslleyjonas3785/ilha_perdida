// Forno de pedra: minério + combustível → lingotes. Acende como a fogueira; cada minério leva SMELT_T segundos
// no fogo e vira o lingote do metal. Sucata também derrete (3 sucatas → 1 lingote de ferro).
import { ITEMS } from './items.js';

export const SMELT = { ore_iron: { out: 'iron', n: 1 }, ore_copper: { out: 'ingot_copper', n: 1 }, ore_silver: { out: 'ingot_silver', n: 1 }, ore_gold: { out: 'ingot_gold', n: 1 }, scrap: { out: 'iron', n: 1, need: 3 } };
export const SMELT_T = 12; const FUEL = { wood: { t: 50, out: 'charcoal' }, charcoal: { t: 90 }, stick: { t: 15 }, log: { t: 140, out: 'charcoal' } };
const N_FUEL = 2, N_ORE = 4, N_OUT = 4, STACK = 30;

export function furnaceData(p) {
  if (!p.data || !Array.isArray(p.data.ore)) p.data = { fuel: Array(N_FUEL).fill(null), ore: Array(N_ORE).fill(null), out: Array(N_OUT).fill(null), burn: 0, prog: 0 };
  const d = p.data; for (const a of [d.fuel, d.ore, d.out]) for (let i = 0; i < a.length; i++) if (a[i] === undefined || (a[i] && !ITEMS[a[i].id])) a[i] = null; return d;
}
const add = (arr, id, n) => { let left = n; for (const s of arr) if (s && s.id === id && left > 0) { const k = Math.min(left, STACK - s.qty); s.qty += k; left -= k; } for (let i = 0; i < arr.length && left > 0; i++) if (!arr[i]) { const k = Math.min(left, STACK); arr[i] = { id, qty: k }; left -= k; } return n - left; };

export class Furnaces {
  constructor(game) { this.g = game; this.cur = null; this.el = null; }
  put(p, slotIdx) { const g = this.g, d = furnaceData(p), s = g.inv.slots[slotIdx]; if (!s) return 0; const id = s.id; let k = 0;
    if (FUEL[id]) k = add(d.fuel, id, s.qty); else if (SMELT[id]) k = add(d.ore, id, s.qty); else { g.ui.toast('No forno vai minério (ou sucata) e combustível: lenha, carvão, galhos', 'warn'); return 0; }
    if (k) { g.inv.takeSlot(slotIdx, k); g.audio.play('pickup'); } else g.ui.toast('Os espaços do forno estão cheios', 'warn'); return k; }
  take(p, area, i) { const g = this.g, d = furnaceData(p), s = d[area][i]; if (!s) return 0; const k = g.inv.add(s.id, s.qty); if (k <= 0) { g.ui.toast('Mochila cheia', 'warn'); return 0; } s.qty -= k; if (s.qty <= 0) d[area][i] = null; g.audio.play('pickup'); return k; }
  setLit(p, on) { const g = this.g, d = furnaceData(p); if (on && !p.lit) { if (!d.fuel.some(Boolean) && !(d.burn > 0)) { g.ui.toast('Coloque combustível (lenha, carvão ou galhos) para acender', 'warn'); return; } p.lit = true; g.audio.play('fireLight'); } else if (!on) p.lit = false; }
  update(dt) { const g = this.g; for (const p of g.build.pieces) { if (p.type !== 'furnace' || !p.lit) continue; const d = furnaceData(p);
      if (d.burn <= 0) { const i = d.fuel.findIndex(Boolean); if (i < 0) { p.lit = false; continue; } const f = d.fuel[i], F = FUEL[f.id]; d.burn = F.t; d.burnOut = F.out || null; f.qty--; if (f.qty <= 0) d.fuel[i] = null; }
      d.burn -= dt; if (d.burn <= 0 && d.burnOut) { add(d.out, d.burnOut, 1); d.burnOut = null; }
      const oi = d.ore.findIndex((s) => s && s.qty >= (SMELT[s.id].need || 1)); if (oi < 0) { d.prog = 0; continue; }
      d.prog += dt; if (d.prog >= SMELT_T) { const s = d.ore[oi], S = SMELT[s.id]; if (add(d.out, S.out, S.n) === S.n) { s.qty -= S.need || 1; if (s.qty <= 0) d.ore[oi] = null; d.prog = 0; if (Math.hypot(p.x - g.player.pos[0], p.z - g.player.pos[2]) < 12) g.audio.play('craft', { vol: 0.5 }); } else d.prog = SMELT_T; } }
    if (this.cur && this.el && !this.el.classList.contains('hidden')) this.render(); }
  // fumaça na chaminé e luz da boca
  lights(L, eye) { for (const p of this.g.build.pieces) if (p.type === 'furnace' && p.lit) { const d = Math.hypot(p.x - eye[0], p.z - eye[2]); if (d > 90) continue; const c = Math.cos(p.rot), s = Math.sin(p.rot); L.push({ pos: [p.x + 0.8 * s, p.y + 0.4, p.z + 0.8 * c], range: 7, col: [2.6, 1.3, 0.5], d }); } }
  particles(r, t) { for (const p of this.g.build.pieces) if (p.type === 'furnace' && p.lit) for (let k = 0; k < 5; k++) { const ph = (t * 0.35 + k / 5) % 1; r.particle(p.x + Math.sin(k * 2 + t) * 0.15 * ph, p.y + 1.95 + ph * 2.6, p.z + ph * 0.5, 0.15 + ph * 0.7, 0.55, 0.55, 0.57, 0.42 * Math.sin(Math.PI * ph)); } }
  // ---------- painel ----------
  open(p) { const g = this.g; g.ui.openPanel('furnace'); this.cur = p; if (!this.el) { const el = document.createElement('div'); el.id = 'furnacePanel'; el.className = 'panel hidden'; el.innerHTML = `<div class="phead"><h2>🔥 Forno</h2><button class="close" data-close>✕</button></div><div class="pbody fur"></div>`; (document.getElementById('invPanel').parentElement || document.body).appendChild(el); el.querySelector('[data-close]').onclick = () => g.ui.closePanels(); this.el = el; }
    this.el.classList.remove('hidden'); this.render(true); }
  close() { this.cur = null; if (this.el) this.el.classList.add('hidden'); }
  render(force) { const g = this.g, p = this.cur, U = g.ui; if (!p) return; const d = furnaceData(p); const sig = JSON.stringify([d.fuel, d.ore, d.out, p.lit, Math.floor(d.prog), g.inv.serialize()]); if (!force && sig === this._sig) return; this._sig = sig;
    const slot = (s, area, i) => `<div class="slot fs" data-a="${area}" data-i="${i}" title="${s ? ITEMS[s.id].name : ''}">${s ? U._icon(s.id) + `<span class="q">${s.qty > 1 ? s.qty : ''}</span>` : ''}</div>`;
    const inv = g.inv.slots.map((s, i) => (s && (FUEL[s.id] || SMELT[s.id]) ? `<div class="slot fi" data-k="${i}" title="${ITEMS[s.id].name} — clique para pôr no forno">${U._icon(s.id)}<span class="q">${s.qty > 1 ? s.qty : ''}</span></div>` : '')).join('');
    const b = this.el.querySelector('.pbody'); b.innerHTML = `<div class="fireTop"><button class="itb wide fl">${p.lit ? '🔥 Apagar' : 'Acender'}</button><div class="fireBurn"><i style="width:${Math.min(100, d.prog / SMELT_T * 100)}%"></i></div><span class="muted">${p.lit ? 'derretendo…' : 'apagado'}</span></div>
      <h3>Combustível <span class="muted">(lenha, carvão, galhos)</span></h3><div class="grid fslots">${d.fuel.map((s, i) => slot(s, 'fuel', i)).join('')}</div>
      <h3>Minério <span class="muted">(ferro, cobre, prata, ouro — ou 3 sucatas)</span></h3><div class="grid fslots">${d.ore.map((s, i) => slot(s, 'ore', i)).join('')}</div>
      <h3>Lingotes</h3><div class="grid fslots">${d.out.map((s, i) => slot(s, 'out', i)).join('')}</div>
      <h3>Sua mochila <span class="muted">— clique num minério ou combustível para colocar</span></h3><div class="grid fslots">${inv || '<span class="muted">Nada que vá no forno.</span>'}</div>`;
    b.querySelector('.fl').onclick = () => { this.setLit(p, !p.lit); this.render(true); };
    b.querySelectorAll('.fs').forEach((el) => { el.onclick = () => { this.take(p, el.dataset.a, +el.dataset.i); this.render(true); }; });
    b.querySelectorAll('.fi').forEach((el) => { el.onclick = () => { this.put(p, +el.dataset.k); this.render(true); }; }); }
}
