// Arpão-gancho: o arpão voa com a corda presa; se cravar no terreno/objeto dentro do alcance,
// a corda recolhe e puxa o jogador até o ponto. Acertar uma criatura causa dano e solta.
// Clique de novo (ou pule) para soltar durante o puxão.
import { mat4 } from '../engine/math.js';
import { harpoonBoltMesh, spearBoltMesh, segMesh } from './machines.js';

const PULL = 21, FLY = 70;
export class Grapple {
  constructor(game) { this.g = game; this.hook = null; const r = game.renderer; this.boltMesh = r.createMesh(harpoonBoltMesh()); this.spearMesh = r.createMesh(spearBoltMesh()); this.ropeMesh = r.createMesh(segMesh([0.85, 0.7, 0.24])); }
  get busy() { return !!this.hook; }
  fire(origin, dir, muzzle, gun) {
    this.hook = { p: muzzle.slice(), o: origin.slice(), d: dir.slice(), t: 0, range: gun.range, dmg: gun.dmg, state: 'fly', traveled: 0 };
  }
  release(msg) { const P = this.g.player; if (P.grapple) { P.grapple = null; P.endGrapple && P.endGrapple(); } this.hook = null; if (msg) this.g.ui.toast(msg, 'info'); }
  update(dt) {
    const h = this.hook; if (!h) return; const g = this.g, P = g.player;
    if (P.dead || P.swimming || (g.equip.hand !== 'harpoon' && !P.hang)) return this.release();
    if (h.state === 'fly') {
      // o arpão segue a linha da mira a partir da câmera; o desenho sai da boca do arpão
      const step = FLY * dt; const hit = g.guns.trace([h.o[0] + h.d[0] * h.traveled, h.o[1] + h.d[1] * h.traveled, h.o[2] + h.d[2] * h.traveled], h.d, step + 0.05);
      h.traveled += step; h.p = [h.o[0] + h.d[0] * h.traveled, h.o[1] + h.d[1] * h.traveled, h.o[2] + h.d[2] * h.traveled];
      if (hit && hit.c) { g.creatures.damage(hit.c, h.dmg * (hit.region === 'head' ? 1.8 : 1), Math.atan2(h.d[0], h.d[2]), hit.region); g.guns.hitMark = 0.18; g.guns.hitKill = hit.c.dead; g.audio.play('hitmark'); g.fx.burst(hit.p, 8, [0.5, 0.06, 0.04], 2, 0.5, 0.04); return this.release(); }
      if (hit) { h.p = hit.p; h.state = 'stuck'; g.guns._impact(hit); g.audio.play('hookHit'); P.grapple = { p: hit.p.slice(), t: 0, d: h.d.slice(), col: hit.col || null }; P.grapple.ledge = P.findLedge(hit.p, h.d, hit.col); P.startGrapple && P.startGrapple(); g.audio.play('reel'); return; }
      if (h.traveled >= h.range) { g.audio.play('dryfire'); return this.release('O gancho não alcançou — corda curta demais (40 m)'); }
    } else if (h.state === 'stuck') {
      if (!P.grapple) return this.release(); h.t += dt; if (Math.floor(h.t * 8) !== Math.floor((h.t - dt) * 8)) g.audio.play('reel', { vol: 0.5 });
    }
  }
  render(items) {
    const g = this.g, P = g.player; if (g.equip.hand !== 'harpoon' || P.sleeping || P.swimming) return; const gun = g.guns.gun; if (!gun || !gun.grapple) return;
    const mz = mat4.transformPoint(P.toolModel, [0, 0.016, 0.2]);
    if (this.hook) { const h = this.hook, d = h.state === 'fly' ? h.d : norm([h.p[0] - mz[0], h.p[1] - mz[1], h.p[2] - mz[2]]);
      const hd = Math.hypot(d[0], d[2]); const base = [h.p[0] - d[0] * 0.15, h.p[1] - d[1] * 0.15, h.p[2] - d[2] * 0.15];
      items.push({ mesh: this.boltMesh, model: mat4.compose(base, Math.atan2(d[0], d[2]), 1, -Math.atan2(d[1], hd)), sphere: [h.p[0], h.p[1], h.p[2], 1] });
      const v = [base[0] - mz[0], base[1] - mz[1], base[2] - mz[2]], L = Math.hypot(...v), lh = Math.hypot(v[0], v[2]);
      if (L > 0.05) items.push({ mesh: this.ropeMesh, model: mat4.compose(mz, Math.atan2(v[0], v[2]), [0.008, 0.008, L], -Math.atan2(v[1], lh)), sphere: [(mz[0] + base[0]) / 2, (mz[1] + base[1]) / 2, (mz[2] + base[2]) / 2, L / 2 + 1], shadow: false });
    } else if (g.guns.mag('harpoon') > 0) items.push({ smooth: true, mesh: this.boltMesh, model: mat4.mul(mat4.create(), P.toolModel, mat4.compose([0, 0.06, 0.09], 0)), sphere: [P.pos[0], P.pos[1] + 1, P.pos[2], 2] });
  }
}
function norm(v) { const l = Math.hypot(...v) || 1; return v.map((x) => x / l); }
