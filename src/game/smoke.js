// Sinais de fumaça e brilho das fogueiras.
// Toda fogueira acesa solta uma coluna de fumaça alta que passa das árvores e pode ser vista de longe (acampamentos de NPCs
// também). Fogueira feita dentro de construção (embaixo de piso/teto, abrigo ou dentro de um prédio) não solta a coluna.
// À noite a claridade da fogueira é vista de longe (brilho que atravessa a névoa).
import { MeshBuilder, M, hex } from '../engine/mesh.js';
import { mat4 } from '../engine/math.js';

export const SMOKE_H = 55, SMOKE_FAR = 1100, GLOW_FAR = 1400, PUFFS = 22;

export class SmokeSignals {
  constructor(game) { this.g = game; this.t = 0; this.cov = new Map(); }
  // fogueira coberta? (piso/teto em cima, abrigo, ou dentro de prédio) — recalculado a cada 2 s
  covered(p) {
    const now = this.t, c = this.cov.get(p); if (c && now - c.t < 2) return c.v;
    const g = this.g; let v = false;
    for (const q of g.build.pieces) { if (q === p) continue; const dx = q.x - p.x, dz = q.z - p.z, dy = q.y - p.y;
      if (q.type === 'floor' && Math.abs(dx) < 1.7 && Math.abs(dz) < 1.7 && dy > 1.0 && dy < 7) { v = true; break; }
      if (q.type === 'shelter' && Math.hypot(dx, dz) < 1.8) { v = true; break; } }
    if (!v) { const b = g.world.bldAt && g.world.bldAt(p.x, p.z); if (b) { const dx = p.x - b.x, dz = p.z - b.z, cr = Math.cos(b.rot), sr = Math.sin(b.rot); const lx = dx * cr - dz * sr, lz = dx * sr + dz * cr; if (Math.abs(lx) < b.w / 2 - 0.15 && Math.abs(lz) < b.d / 2 - 0.15) v = true; } }
    this.cov.set(p, { t: now, v }); return v;
  }
  sources() {
    const g = this.g, out = [];
    for (const p of g.build.pieces) if (p.type === 'campfire' && p.lit) out.push({ x: p.x, y: p.y, z: p.z, cov: this.covered(p), seed: (p.x * 13.1 + p.z * 7.7) % 1, own: p });
    for (const c of g.world.camps || []) out.push({ x: c.x, y: g.world.height(c.x, c.z), z: c.z, cov: false, seed: (c.id * 0.37) % 1, camp: c });
    return out;
  }
  update(dt) { this.t += dt; if (this.cov.size > 400) this.cov.clear(); }
  render(items, eye) {
    const g = this.g, r = g.renderer, env = g.env;
    if (!this.puff) { const mb = new MeshBuilder(); const c = hex(0x8e8e8a); mb.setColor(c, 1); mb.sphere(M(0, 0, 0), 1, 9, 6, c); mb.sphere(M(0.55, -0.15, 0.3), 0.7, 8, 5, c); mb.sphere(M(-0.5, 0.1, -0.35), 0.75, 8, 5, c); this.puff = r.createMesh(mb.build());
      const mb2 = new MeshBuilder(); const f = hex(0xffa040); mb2.setColor(f, 1); mb2.sphere(M(0, 0, 0), 1, 8, 6, f); this.glow = r.createMesh(mb2.build()); }
    const night = Math.max(r.env.night || 0, env.isNight ? 0.8 : 0); const wind = (env.cur && env.cur.wind) || 0.8; const wa = 0.7; const wx = Math.sin(wa), wz = Math.cos(wa);
    const dark = Math.max(0, Math.min(1, night)); const tone = 1 - dark * 0.8; const tint = [tone, tone, tone * 0.98, 1];
    for (const s of this.sources()) {
      const d = Math.hypot(s.x - eye[0], s.z - eye[2]);
      if (!s.cov && d < SMOKE_FAR) {
        for (let k = 0; k < PUFFS; k++) { const ph = (this.t / 18 + k / PUFFS + s.seed) % 1; const h = ph * SMOKE_H; const drift = Math.pow(ph, 1.6) * (6 + wind * 9);
          const x = s.x + wx * drift + Math.sin(ph * 9 + k) * 0.6, z = s.z + wz * drift + Math.cos(ph * 7 + k) * 0.6, y = s.y + 1 + h;
          const sz = 0.7 + ph * 8.5; const a = 0.75 * Math.min(1, ph * 8) * Math.pow(1 - ph, 0.7) * (d < 6 ? d / 6 : 1) * (d > 300 ? 1.25 : 1);
          const lit = dark > 0.25 ? Math.max(0, 1 - ph * 3.2) * (dark - 0.25) * 1.3 : 0; // à noite a base da fumaça fica alaranjada pela luz do fogo
          if (a < 0.02) continue; items.push({ mesh: this.puff, model: mat4.compose([x, y, z], k, [sz, sz * 0.8, sz]), alpha: Math.min(0.85, a), tint: lit > 0 ? [tone + lit * 1.2, tone + lit * 0.5, tone + lit * 0.15, 1] : tint, emissive: 0.12 * (1 - dark) + lit * 0.9, shadow: false, fogMul: d > 200 ? 0.3 : 0.55, sphere: [x, y, z, sz] }); } }
      // brilho à noite (não aparece perto, onde a luz da fogueira já ilumina)
      if (dark > 0.25 && d > 25 && d < GLOW_FAR) { const sz = 0.7 + d * 0.006; const fl = 0.85 + 0.15 * Math.sin(this.t * 11 + s.seed * 40);
        items.push({ mesh: this.glow, model: mat4.compose([s.x, s.y + 1.2 + Math.min(4, d * 0.004), s.z], 0, sz), alpha: Math.min(0.9, (dark - 0.25) * 1.6) * fl, emissive: 3, shadow: false, fogMul: 0.12, sphere: [s.x, s.y, s.z, sz] }); }
    }
  }
  // luz pontual das fogueiras dos acampamentos perto do jogador (as do jogador já têm luz própria)
  lights(lights, eye, t) { for (const c of this.g.world.camps || []) { const d = Math.hypot(c.x - eye[0], c.z - eye[2]); if (d < 120) { const y = this.g.world.height(c.x, c.z); lights.push({ pos: [c.x, y + 0.8, c.z], range: 14, col: [2.6 * (0.9 + 0.1 * Math.sin(t * 13 + c.id)), 1.3, 0.4], d }); if (d < 70 && this.g.fx.fire) this.g.fx.fire([c.x, y, c.z], 1); } } }
}
