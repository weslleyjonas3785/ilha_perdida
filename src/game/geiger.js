// Contador Geiger de mão: mede a radiação que vem da direção para onde o jogador aponta (câmera).
// Fontes: névoa da zona tóxica ao longo da linha, itens contaminados no chão, caixas/móveis da zona
// tóxica ainda não revistados e a própria mochila contaminada. Leitura 0..1 (≈ 0–10 mSv/h no mostrador).
import { mat4 } from '../engine/math.js';
import { geigerNeedleMesh } from './machines.js';

export class Geiger {
  constructor(game) { this.g = game; this.reading = 0; this.raw = 0; this.src = ''; this.t = 0; this.needle = game.renderer.createMesh(geigerNeedleMesh()); }
  get active() { const g = this.g; return g.equip.hand === 'geiger' && !g.player.dead && !g.player.sleeping; }
  measure() {
    const g = this.g, w = g.world, P = g.player, e = g.cam.eye, tg = g.cam.target; const p0 = [P.pos[0], P.pos[1] + 1.3, P.pos[2]];
    let d = [tg[0] - e[0], tg[1] - e[1], tg[2] - e[2]]; const l = Math.hypot(...d) || 1; d = d.map((x) => x / l);
    const focus = g.input && g.input.mouse && g.input.mouse.right ? 1.25 : 1; let best = 0, src = '';
    // zona tóxica: amostras ao longo da direção apontada (mais fraco com a distância) + onde você está
    const here = w.toxicAt(p0[0], p0[2]); if (here > 0) { best = here * 0.85; src = 'Zona tóxica (você está dentro)'; }
    const T = w.constructor.TOXIC || g.toxicZone; for (let t = 6; t <= 320; t += 8) { const x = p0[0] + d[0] * t, z = p0[2] + d[2] * t; const tx = w.toxicAt(x, z); const inside = tx > 0 || (T && Math.hypot(x - T.x, z - T.z) < T.r); const v = (inside ? Math.max(0.35, tx) : 0) * Math.max(0, 1 - t / 360) * focus; if (v > best) { best = v; src = `Zona tóxica a ~${Math.round(t)} m nessa direção`; } }
    // objetos contaminados num cone à frente
    const cone = (x, y, z, str, range, label) => { const v = [x - p0[0], y - p0[1], z - p0[2]], dist = Math.hypot(...v); if (dist > range || dist < 0.01) return; const c = (v[0] * d[0] + v[1] * d[1] + v[2] * d[2]) / dist; if (c < 0.82) return;
      const k = str * (1 - dist / range) * ((c - 0.82) / 0.18) * focus; if (k > best) { best = k; src = `${label} a ${dist.toFixed(1)} m`; } };
    for (const dr of g.drops) { const n = dr.items.reduce((a, it) => a + (it[2] ? 1 : 0), 0); if (n) cone(dr.x, dr.y + 0.3, dr.z, Math.min(1, 0.45 + n * 0.12), 22, 'Itens contaminados'); }
    for (const c of w.crates) if (c.toxic && !c.looted && Math.abs(c.x - p0[0]) < 22 && Math.abs(c.z - p0[2]) < 22) cone(c.x, c.y + 0.6, c.z, 0.6, 20, 'Objeto contaminado');
    for (const o of w.specials || []) if (!o.taken && w.toxicAt(o.x, o.z) > 0 && Math.abs(o.x - p0[0]) < 22 && Math.abs(o.z - p0[2]) < 22) cone(o.x, o.y + 0.5, o.z, 0.5, 20, 'Objeto contaminado');
    // mochila contaminada: leitura de fundo
    const nc = g.inv.contaminated(); if (nc) { const k = Math.min(0.5, 0.12 + nc * 0.04); if (k > best) { best = k; src = `Sua mochila (${nc} item(ns) contaminado(s))`; } }
    // o corpo contaminado também acusa um pouco
    const rad = P.stats.rad || 0; if (rad >= 50 && 0.18 > best) { best = 0.18; src = 'Seu corpo (contaminado)'; }
    return [Math.min(1, best), src];
  }
  update(dt) {
    if (!this.active) { this.reading = Math.max(0, this.reading - dt * 2); return; }
    this.t -= dt; if (this.t <= 0) { this.t = 0.1; [this.raw, this.src] = this.measure(); }
    // ponteiro oscila como num aparelho real
    const jitter = this.raw > 0.02 ? (Math.random() - 0.5) * 0.06 * (0.3 + this.raw) : 0;
    this.reading += (this.raw + jitter - this.reading) * Math.min(1, dt * 5); this.reading = Math.max(0, Math.min(1, this.reading));
    // estalos proporcionais à leitura (sem exposição real o som do arquivo fica para a radiação de verdade)
    if (this.reading > 0.03 && Math.random() < dt * (2 + this.reading * 30)) this.g.audio.play('geiger', { n: 1 + Math.floor(this.reading * 4), vol: 0.5 + this.reading * 0.6 });
  }
  label() { const r = this.reading; return r < 0.05 ? ['Seguro', 'ok'] : r < 0.25 ? ['Baixo', 'low'] : r < 0.55 ? ['Alto', 'mid'] : ['PERIGO', 'bad']; }
  render(items) {
    const g = this.g, P = g.player; if (!this.active || P.swimming || !g.tools.geiger) return;
    const a = -1.0 + this.reading * 2.0; // −57° a +57°
    const m = mat4.mul(mat4.create(), P.toolModel, mat4.compose([0, -0.022, -0.026], 0, 1, -0.6, -a));
    items.push({ smooth: true, mesh: this.needle, model: m, sphere: [P.pos[0], P.pos[1] + 1, P.pos[2], 2] });
  }
}
