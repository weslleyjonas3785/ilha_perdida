// Pescaria: vara de pesca com isca na ponta (minhoca ou isca artificial), lançamento na água, boia, fisgada e briga com o peixe
// (barra de tensão: segurar o botão puxa a linha; se esticar demais, arrebenta). Cada peixe rende filés (Robalo 3, Carpa 2, Acará 1).
import { MeshBuilder, M, hex, shade } from '../engine/mesh.js';
import { mat4 } from '../engine/math.js';
import { ITEMS } from './items.js';
import { WATER } from './world.js';

const WOOD = 0.63, MET = 0.5, POLY = 0.86;
export const ROD_TIP = 1.98;
export const FISH = {
  fish_bass: { str: 1.0, speed: 0.11 },
  fish_koi: { str: 0.72, speed: 0.15 },
  fish_angel: { str: 0.45, speed: 0.2 },
};
export const BAITS = ['bait_worm', 'bait_lure'];

// ---------- modelos ----------
export function rodMesh() {
  const mb = new MeshBuilder(); const wood = hex(0x9a6a3c), woodD = hex(0x7a5030), iron = hex(0x55524e), line = hex(0xd8d2c0);
  mb.setColor(wood, WOOD);
  mb.cylinder(M(0, -0.32, 0), 0.03, 0.034, 0.5, 7, wood); // cabo
  mb.setColor(woodD, WOOD); mb.cylinder(M(0, 0.16, 0), 0.038, 0.038, 0.09, 7, woodD); // anel
  mb.setColor(wood, WOOD); mb.cylinder(M(0, 0.25, 0), 0.024, 0.007, ROD_TIP - 0.25, 7, wood); // vara
  mb.setColor(iron, MET);
  mb.cylinder(M(0.06, -0.08, 0, 0, 1, 0, Math.PI / 2), 0.05, 0.05, 0.04, 9, iron); // carretilha
  mb.cylinder(M(0.1, -0.08, 0, 0, 1, 0, Math.PI / 2), 0.012, 0.012, 0.03, 6, iron); mb.box(M(0.118, -0.05, 0), 0.012, 0.07, 0.012, iron);
  for (const [y, r] of [[0.6, 0.02], [1.05, 0.016], [1.5, 0.013], [ROD_TIP - 0.04, 0.012]]) { mb.box(M(0.024, y, 0), 0.022, 0.012, r * 2, iron); }
  mb.setColor(line, POLY); mb.cylinder(M(0.04, -0.06, 0, 0, 1, 0, -0.012), 0.0025, 0.0025, ROD_TIP - 0.02, 3, line, false);
  return mb.build();
}
export function lineMesh() { const mb = new MeshBuilder(); const c = hex(0xe8e2d0); mb.setColor(c, POLY); mb.cylinder(M(0, 0, 0), 1, 1, 1, 4, c, false); return mb.build(); }
export function bobberMesh() { const mb = new MeshBuilder(); const r = hex(0xd8302a), w = hex(0xf2efe6); mb.setColor(r, POLY); mb.cylinder(M(0, -0.04, 0), 0.012, 0.04, 0.04, 8, r); mb.setColor(w, POLY); mb.cylinder(M(0, 0, 0), 0.04, 0.012, 0.045, 8, w); mb.cylinder(M(0, 0.045, 0), 0.004, 0.004, 0.05, 4, w); return mb.build(); }
export function sinkerMesh() { const mb = new MeshBuilder(); const c = hex(0x9a958a), k = hex(0xb0aaa0); mb.setColor(c, MET); mb.cylinder(M(0, -0.03, 0), 0.006, 0.016, 0.03, 6, c); mb.cylinder(M(0, 0, 0), 0.016, 0.006, 0.03, 6, c); mb.setColor(k, MET); mb.cylinder(M(0, -0.09, 0), 0.0025, 0.0025, 0.06, 3, k); return mb.build(); }
// minhoca: gomos em S pendurados no anzol (ponta em y=0, pendurada para baixo)
export function wormMesh() {
  const mb = new MeshBuilder(); const c = hex(0xb06a52), d = shade(c, 0.82); const pts = []; for (let i = 0; i <= 14; i++) { const t = i / 14; pts.push([Math.sin(t * 7.5) * 0.035 * (0.4 + t), -t * 0.2, Math.cos(t * 5) * 0.008]); }
  for (let i = 0; i < pts.length - 1; i++) { const a = pts[i], b = pts[i + 1]; const dx = b[0] - a[0], dy = b[1] - a[1]; const len = Math.hypot(dx, dy); const ang = Math.atan2(dx, -dy); const col = i % 2 ? d : c; mb.setColor(col, POLY);
    mb.cylinder(M(a[0], a[1], a[2], 0, 1, 0, Math.PI + ang), 0.011 - i * 0.0003, 0.011 - (i + 1) * 0.0003, len + 0.004, 6, col); }
  return mb.build();
}
// isca artificial: peixinho de metal listrado com garatéias
export function lureMesh() {
  const mb = new MeshBuilder(); const s = hex(0xc8ccd2), b = hex(0x2a3c8a), r = hex(0xc82a2a), k = hex(0x8a8a8a);
  mb.setColor(s, MET); mb.roundBox(M(0, -0.06, 0, 0, [1, 1, 1], 0, 0), 0.018, 0.11, 0.032, s, 0.009, 2);
  mb.setColor(b, POLY); for (let i = 0; i < 4; i++) mb.box(M(0, -0.03 - i * 0.022, 0), 0.02, 0.008, 0.034, b);
  mb.setColor(r, POLY); mb.box(M(0, -0.018, 0.012), 0.02, 0.016, 0.012, r);
  mb.setColor(k, MET); for (const y of [-0.08, -0.12]) { mb.cylinder(M(0, y, 0.018, 0, 1, Math.PI / 2), 0.002, 0.002, 0.03, 3, k); mb.box(M(0, y - 0.008, 0.048), 0.012, 0.016, 0.004, k); }
  return mb.build();
}
// peixes (frente = +Z, comprimento ~0.5 m para o robalo)
export function fishMesh(id) {
  const mb = new MeshBuilder();
  if (id === 'fish_bass') {
    const body = hex(0x6f6e3a), belly = hex(0xc8c08a), dark = hex(0x3a3a22), fin = hex(0x7a6a3a);
    mb.setColor(body, POLY); mb.roundBox(M(0, 0, 0), 0.13, 0.17, 0.42, body, 0.06, 2); mb.roundBox(M(0, -0.01, 0.2), 0.11, 0.13, 0.12, body, 0.05, 2);
    mb.setColor(belly, POLY); mb.roundBox(M(0, -0.05, 0.02), 0.11, 0.08, 0.36, belly, 0.04, 2);
    mb.setColor(dark, POLY); for (let i = 0; i < 6; i++) mb.box(M(0, 0.0, -0.15 + i * 0.06), 0.134, 0.03, 0.04, dark);
    mb.setColor(fin, POLY); mb.box(M(0, 0.0, -0.27, 0, [1, 1, 1]), 0.02, 0.2, 0.1, fin); mb.box(M(0, 0.11, -0.02, 0, 1, 0.25), 0.015, 0.07, 0.22, fin); mb.box(M(0, -0.09, -0.08), 0.015, 0.05, 0.08, fin);
    for (const sx of [-1, 1]) { mb.setColor(fin, POLY); mb.box(M(sx * 0.07, -0.04, 0.1, sx * 0.5), 0.01, 0.04, 0.07, fin); mb.setColor(hex(0x111111), 0.1); mb.box(M(sx * 0.058, 0.03, 0.2), 0.012, 0.025, 0.025, hex(0x111111)); }
  } else if (id === 'fish_koi') {
    const w = hex(0xf0ece4), o = hex(0xe8622a), k = hex(0x2a2826);
    mb.setColor(w, POLY); mb.roundBox(M(0, 0, 0), 0.1, 0.12, 0.36, w, 0.05, 2); mb.roundBox(M(0, -0.005, 0.16), 0.085, 0.095, 0.1, w, 0.04, 2);
    mb.setColor(o, POLY); mb.box(M(0, 0.02, 0.1), 0.104, 0.09, 0.07, o); mb.box(M(0, 0.01, -0.06), 0.104, 0.1, 0.06, o); mb.box(M(0, 0.02, -0.15), 0.06, 0.06, 0.04, o);
    mb.setColor(k, POLY); mb.box(M(0, 0.03, 0.03), 0.105, 0.08, 0.035, k); mb.box(M(0, 0.03, -0.11), 0.105, 0.07, 0.03, k);
    mb.setColor(w, POLY); mb.box(M(0, 0.03, -0.26), 0.012, 0.18, 0.12, w); mb.box(M(0, 0.08, -0.02), 0.012, 0.05, 0.16, w);
    for (const sx of [-1, 1]) { mb.box(M(sx * 0.06, -0.05, 0.08, sx * 0.6), 0.008, 0.03, 0.08, w); mb.setColor(hex(0x111111), 0.1); mb.box(M(sx * 0.045, 0.02, 0.18), 0.01, 0.02, 0.02, hex(0x111111)); mb.setColor(w, POLY); mb.cylinder(M(sx * 0.02, -0.03, 0.21, 0, 1, 1.2), 0.004, 0.002, 0.05, 3, w); }
  } else {
    const s = hex(0xc8ccd8), b = hex(0x2e3a78);
    mb.setColor(s, POLY); mb.roundBox(M(0, 0, 0), 0.035, 0.16, 0.16, s, 0.03, 2);
    mb.setColor(b, POLY); for (const z of [-0.04, 0.02, 0.07]) mb.box(M(0, 0, z), 0.037, 0.16, 0.022, b);
    mb.box(M(0, 0.16, -0.05, 0, 1, -0.5), 0.01, 0.2, 0.06, b); mb.box(M(0, -0.16, -0.05, 0, 1, 0.5), 0.01, 0.2, 0.06, b); mb.box(M(0, 0, -0.12), 0.01, 0.12, 0.07, b);
    for (const sx of [-1, 1]) { mb.setColor(hex(0x111111), 0.1); mb.box(M(sx * 0.018, 0.02, 0.06), 0.006, 0.018, 0.018, hex(0x111111)); }
  }
  return mb.build();
}

// matriz que estica um cilindro unitário (eixo +Y, base na origem) de a até b com raio r
function segModel(a, b, r) {
  const Y = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]; const L = Math.hypot(Y[0], Y[1], Y[2]) || 1e-4; const n = [Y[0] / L, Y[1] / L, Y[2] / L];
  const up = Math.abs(n[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0]; let X = [n[1] * up[2] - n[2] * up[1], n[2] * up[0] - n[0] * up[2], n[0] * up[1] - n[1] * up[0]]; const xl = Math.hypot(X[0], X[1], X[2]); X = X.map((v) => v / xl);
  const Z = [X[1] * n[2] - X[2] * n[1], X[2] * n[0] - X[0] * n[2], X[0] * n[1] - X[1] * n[0]];
  const m = mat4.create(); m.set([X[0] * r, X[1] * r, X[2] * r, 0, Y[0], Y[1], Y[2], 0, Z[0] * r, Z[1] * r, Z[2] * r, 0, a[0], a[1], a[2], 1]); return m;
}

export class Fishing {
  constructor(g) { this.g = g; this.st = 'idle'; this.t = 0; this.bob = null; this.fish = null; this.T = 0; this.prog = 0; this.m = null; this.el = null; }
  bait() { const g = this.g, e = g.equip; if (e.bait && g.inv.count(e.bait) > 0) return e.bait; for (const b of BAITS) if (g.inv.count(b) > 0) { e.bait = b; return b; } return null; }
  cycleBait() { const g = this.g, have = BAITS.filter((b) => g.inv.count(b) > 0); if (!have.length) return g.ui.toast('🪱 Sem isca: tire minhocas da terra com a faca (olhando para o chão), ou fabrique uma isca artificial', 'warn'); const i = have.indexOf(g.equip.bait); g.equip.bait = have[(i + 1) % have.length]; g.audio.play('click'); g.ui.toast(`🎣 Isca: ${ITEMS[g.equip.bait].name}`, 'info'); }
  // ponto da água para onde a câmera aponta
  aimPoint() { const g = this.g, c = g.cam, P = g.player.pos; const e = c.eye, t = c.target; let d = [t[0] - e[0], t[1] - e[1], t[2] - e[2]]; const l = Math.hypot(...d); d = d.map((v) => v / l);
    let p = null; if (d[1] < -0.02) { const k = (WATER - e[1]) / d[1]; p = [e[0] + d[0] * k, WATER, e[2] + d[2] * k]; }
    const fx = Math.sin(g.cam.yaw), fz = Math.cos(g.cam.yaw);
    if (!p || Math.hypot(p[0] - P[0], p[2] - P[2]) > 22) { const fwd = [d[0], d[2]]; const fl = Math.hypot(...fwd) || 1; const dir = fl > 0.1 ? [fwd[0] / fl, fwd[1] / fl] : [fx, fz]; p = [P[0] + dir[0] * 16, WATER, P[2] + dir[1] * 16]; }
    const dist = Math.hypot(p[0] - P[0], p[2] - P[2]); if (dist < 2.5) return null;
    return g.world.height(p[0], p[2]) < WATER - 0.35 ? p : null; }
  fresh(p) { const w = this.g.world; return !!(w.inLake && w.inLake(p[0], p[2])) || (w.riverDist && w.riverDist(p[0], p[2])[0] < 20); }
  pickFish(p, bait) { const fresh = this.fresh(p); const W = fresh ? { fish_koi: 0.5, fish_bass: 0.3, fish_angel: 0.2 } : { fish_bass: 0.45, fish_angel: 0.55, fish_koi: 0 };
    if (bait === 'bait_lure') { W.fish_bass *= 2.2; W.fish_angel *= 0.6; } let s = 0; for (const k in W) s += W[k]; let r = Math.random() * s; for (const k in W) { r -= W[k]; if (r <= 0) return k; } return 'fish_bass'; }
  reset(msg, kind = 'info') { this.st = 'idle'; this.t = 0; this.bob = null; this.fish = null; this.T = 0; this.prog = 0; if (msg) this.g.ui.toast(msg, kind); this._ui(); }
  tip() { return mat4.transformPoint(this.g.player.toolModel, [0, ROD_TIP, 0]); }
  update(dt, act) {
    const g = this.g, P = g.player; const holding = g.equip.hand === 'fishing_rod' && !P.dead && !P.swimming && !g.vehicles.driving && g.state === 'playing';
    if (!holding) { if (this.st !== 'idle') this.reset(this.st === 'reel' ? '🐟 Você largou a vara — o peixe escapou' : null); this._ui(); return; }
    const blocked = g.ui.anyOpen || !!document.querySelector('.askbox');
    this.pose();
    this.t += dt; const S = this.st;
    if (!blocked && act.reload && S === 'idle') this.cycleBait();
    if (!blocked && act.cancel && S !== 'idle' && S !== 'caught') { g.audio.play('click'); return this.reset(S === 'reel' ? '🐟 Você soltou a linha — o peixe foi embora' : '🎣 Linha recolhida'); }
    if (this.bob && Math.hypot(this.bob.p[0] - P.pos[0], this.bob.p[2] - P.pos[2]) > 30) return this.reset('🎣 Você se afastou demais — a linha foi recolhida');
    if (S === 'idle') { if (!blocked && act.use) this.cast(); }
    else if (S === 'cast') { const k = Math.min(1, this.t / 0.75), a = this.bob.from, b = this.bob.to; this.bob.p = [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k + Math.sin(k * Math.PI) * 3, a[2] + (b[2] - a[2]) * k];
      if (k >= 1) { this.st = 'wait'; this.t = 0; this.bob.p = b.slice(); g.audio.play('splash', { at: b, vol: 0.5 }); g.fx && g.fx.burst([b[0], WATER + 0.05, b[2]], 10, [1.6, 1.8, 2], 1.6, 0.5, 0.04, 6); this.biteAt = this._biteDelay(); } }
    else if (S === 'wait') { this.bob.dip = this.t > this.biteAt - 1.2 && Math.sin(this.t * 19) > 0.7 ? 0.03 : 0;
      if (this.t >= this.biteAt) { this.st = 'bite'; this.t = 0; this.fish = this.pickFish(this.bob.p, this.bait()); g.audio.play('splash', { at: this.bob.p, vol: 0.7 }); g.fx && g.fx.burst([this.bob.p[0], WATER + 0.05, this.bob.p[2]], 14, [1.6, 1.8, 2], 2, 0.5, 0.04, 6); }
      else if (!blocked && act.use) { this.reset('🎣 Cedo demais — linha recolhida. Espere a boia afundar!'); } }
    else if (S === 'bite') { this.bob.dip = 0.12;
      if (!blocked && act.use) { this.st = 'reel'; this.t = 0; this.T = 0.35; this.prog = 0.25; this.bob.dip = 0.06; this.from = this.bob.p.slice(); g.audio.play('swing', { vol: 0.6 }); P.doAction('chop', null); }
      else if (this.t > 1.15) { const b = this.bait(); if (b === 'bait_worm' && Math.random() < 0.4) { g.inv.remove('bait_worm', 1); this.st = 'wait'; this.t = 0; this.biteAt = this._biteDelay(); this.fish = null; this.bob.dip = 0; g.ui.toast('🪱 O peixe comeu a minhoca e fugiu — lance de novo', 'warn'); return this.reset(); } this.st = 'wait'; this.t = 0; this.biteAt = this._biteDelay(); this.fish = null; this.bob.dip = 0; g.ui.toast('🐟 Escapou! Clique logo que a boia afundar', 'info'); } }
    else if (S === 'reel') { const F = FISH[this.fish]; const pull = (0.5 + 0.5 * Math.sin(this.t * 2.3 + Math.sin(this.t * 0.7) * 3)) * F.str;
      const held = !blocked && act.useHeld; if (held) { this.T += (0.32 + pull * 0.62) * dt; this.prog += F.speed * 1.6 * dt * (this.T < 0.85 ? 1 : 0.4); this._clk = (this._clk || 0) - dt; if (this._clk <= 0) { this._clk = 0.11; g.audio.play('reelin'); } }
      else { this.T -= (0.55 - pull * 0.2) * dt; this.prog -= (0.02 + pull * 0.05) * dt; }
      this.T = Math.max(0, this.T);
      // a boia vem em direção ao jogador conforme puxa, balançando para os lados
      const fr = this.from, to = P.pos; const k = Math.min(1, Math.max(0, (this.prog - 0.25) / 0.75)); const side = Math.sin(this.t * 1.7) * 1.2 * (1 - k);
      let x = fr[0] + (to[0] - fr[0]) * k * 0.85, z = fr[2] + (to[2] - fr[2]) * k * 0.85; const dx = to[0] - fr[0], dz = to[2] - fr[2], dl = Math.hypot(dx, dz) || 1; x += -dz / dl * side; z += dx / dl * side;
      if (g.world.height(x, z) < WATER - 0.2) this.bob.p = [x, WATER, z];
      if (Math.random() < dt * 1.5) g.fx && g.fx.burst([this.bob.p[0], WATER + 0.05, this.bob.p[2]], 6, [1.6, 1.8, 2], 1.5, 0.4, 0.035, 6);
      if (this.T >= 1) { const b = this.bait(); if (b) g.inv.remove(b, 1); g.audio.play('snap'); return this.reset(`💥 A linha arrebentou! Você perdeu a ${b ? ITEMS[b].name.toLowerCase() : 'isca'}`, 'warn'); }
      if (this.prog <= 0) return this.reset('🐟 O peixe escapou — puxe com mais firmeza', 'info');
      if (this.prog >= 1) { const id = this.fish, b = this.bait(); if (b === 'bait_worm') g.inv.remove('bait_worm', 1); this.st = 'caught'; this.t = 0; this.caughtFrom = this.bob.p.slice(); g.audio.play('splash', { at: this.bob.p, vol: 0.8 }); g.give(id, 1); g.ui.toast(`🎣 Você pescou: ${ITEMS[id].icon} ${ITEMS[id].name}! (rende ${ITEMS[id].fish} filé${ITEMS[id].fish > 1 ? 's' : ''} — clique nele com uma faca)`, 'ok'); } }
    else if (S === 'caught') { if (this.t > 1.3) this.reset(); }
    this._ui();
  }
  // segura a vara apontada para a frente e para cima (fora da animação de lançar)
  pose() { const P = this.g.player, A = P.anim; if (A.action && !A.action.ending) return; const hi = P.assets.skel.index.handR; if (hi === undefined || !A.world || !A.world[hi]) return;
    const hw = mat4.mul(mat4.create(), P.model, A.world[hi]); const hp = [hw[12], hw[13], hw[14]];
    const tilt = this.st === 'reel' ? 0.55 - Math.min(1, this.T) * 0.25 + Math.sin(this.t * 17) * 0.03 * this.T : this.st === 'bite' ? 0.75 + Math.sin(this.t * 30) * 0.05 : 0.9;
    P.toolModel.set(mat4.mul(mat4.create(), mat4.compose(hp, P.yaw), mat4.compose([0, 0, 0], 0, 1, tilt))); }
  _biteDelay() { return this.bait() === 'bait_lure' ? 6 + Math.random() * 8 : 3 + Math.random() * 6; }
  cast() { const g = this.g, P = g.player; const b = this.bait(); if (!b) return g.ui.toast('🪱 Sem isca! Tire minhocas da terra com a faca (olhando para o chão) ou fabrique uma isca artificial', 'warn');
    const p = this.aimPoint(); if (!p) return g.ui.toast('🎣 Mire na água funda (até 22 m)', 'warn');
    if (!P.doAction('chop', null)) return; g.audio.play('swing', { vol: 0.7 }); this.st = 'cast'; this.t = 0; this.bob = { from: this.tip(), to: p, p: this.tip(), dip: 0 }; }
  _ui() { const g = this.g; if (!this.el) { if (typeof document === 'undefined') return; this.el = document.createElement('div'); this.el.id = 'fishUi'; document.body.appendChild(this.el); }
    const on = g.equip.hand === 'fishing_rod' && g.state === 'playing' && !g.ui.anyOpen; if (!on) { this.el.style.display = 'none'; return; } this.el.style.display = 'block';
    const b = this.bait(); const bn = b ? `${ITEMS[b].icon} ${ITEMS[b].name} ×${g.inv.count(b)}` : '🪱 sem isca';
    const S = this.st; let h;
    if (S === 'idle') h = `🎣 Clique: lançar na água · R: trocar isca <span class="bt">${bn}</span>`;
    else if (S === 'cast' || S === 'wait') h = `🎣 Esperando o peixe morder… (botão direito: recolher) <span class="bt">${bn}</span>`;
    else if (S === 'bite') h = `<b class="now">❗ FISGOU! Clique agora!</b>`;
    else if (S === 'reel') { const T = Math.min(1, this.T), pr = Math.max(0, Math.min(1, this.prog)); h = `🐟 Segure o botão para puxar · solte se a linha esticar<div class="fb"><span>Tensão</span><div class="bar"><i style="width:${T * 100}%;background:${T > 0.85 ? '#e04a3a' : T > 0.6 ? '#e0b03a' : '#4ac07a'}"></i></div></div><div class="fb"><span>Peixe</span><div class="bar"><i style="width:${pr * 100}%;background:#5aa8e8"></i></div></div>`; }
    else h = `🎣 Pegou!`;
    if (this._h !== h) { this._h = h; this.el.innerHTML = h; } }
  // ---------- desenho ----------
  render(items) {
    const g = this.g, P = g.player; if (g.equip.hand !== 'fishing_rod' || P.dead || P.swimming || g.menuMode) return; const r = g.renderer;
    if (!this.m) { this.m = { line: r.createMesh(lineMesh()), bob: r.createMesh(bobberMesh()), sink: r.createMesh(sinkerMesh()), worm: r.createMesh(wormMesh()), lure: r.createMesh(lureMesh()), fish: {} }; for (const k of Object.keys(FISH)) this.m.fish[k] = r.createMesh(fishMesh(k)); }
    const m = this.m, tip = this.tip(), sph = [tip[0], tip[1], tip[2], 30]; const L = (a, b) => items.push({ mesh: m.line, model: segModel(a, b, 0.004), shadow: false, sphere: sph });
    const T = (p, ry = 0, s = 1, rx = 0, rz = 0) => mat4.compose(p, ry, s, rx, rz);
    const bait = this.bait(); const S = this.st;
    if (S === 'idle' || (S === 'caught' && this.t > 0.9)) { // isca pendurada na ponta
      const sw = Math.sin((g.env.elapsed || 0) * 2.2) * 0.03; const end = [tip[0] + sw, tip[1] - 0.38, tip[2]]; L(tip, end);
      items.push({ mesh: m.sink, model: T([tip[0] + sw * 0.6, tip[1] - 0.22, tip[2]]), sphere: sph });
      if (bait) items.push({ mesh: bait === 'bait_lure' ? m.lure : m.worm, model: T(end, g.cam.yaw), sphere: sph });
      return; }
    if (S === 'caught') { const k = Math.min(1, this.t / 0.9); const a = this.caughtFrom; const p = [a[0] + (tip[0] - a[0]) * k, WATER + Math.sin(k * Math.PI) * 2.5 + (tip[1] - 0.5 - WATER) * k, a[2] + (tip[2] - a[2]) * k]; L(tip, p);
      items.push({ mesh: m.fish[this.fish], model: T([p[0], p[1] - 0.2, p[2]], g.cam.yaw + Math.sin(this.t * 25) * 0.4, 1, Math.PI / 2), sphere: [p[0], p[1], p[2], 1] }); return; }
    if (!this.bob) return; const bp = this.bob.p; const bob = S === 'cast' ? bp : [bp[0], WATER - (this.bob.dip || 0) + Math.sin(this.t * 3) * 0.012, bp[2]];
    // linha com barriga (2 trechos) até a boia
    const mid = [(tip[0] + bob[0]) / 2, Math.max(WATER + 0.05, (tip[1] + bob[1]) / 2 - (S === 'reel' ? 0.1 * (1 - this.T) : 0.6)), (tip[2] + bob[2]) / 2]; L(tip, mid); L(mid, bob);
    items.push({ mesh: m.bob, model: T(bob, 0, 1.3, S === 'reel' ? Math.sin(this.t * 6) * 0.4 : 0), sphere: [bob[0], bob[1], bob[2], 1] });
    if (S === 'reel' && this.fish && Math.sin(this.t * 1.3) > 0.6) items.push({ mesh: m.fish[this.fish], model: T([bob[0], WATER - 0.12, bob[2]], this.t * 2, 1, 0, Math.sin(this.t * 9) * 0.3), sphere: [bob[0], bob[1], bob[2], 1] });
  }
}
