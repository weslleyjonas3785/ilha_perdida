// Granadas de mão: fragmentação, luz (flash), fumaça e barulhenta (buzina).
// F puxa o pino (na mão ativa em 5 s); segurar o botão esquerdo mostra a barra de força (verde perto, amarelo meio, vermelho longe)
// com o marcador preto indo e voltando — soltar arremessa com a força marcada. Depois de jogada: fragmentação 5 s, luz 3 s, fumaça 3 s, barulhenta 3 s.
// Fragmentação: explosão com dano pela distância (mata ou fere jogador, NPCs e robôs). Luz: cega por 4 s (tela branca + zumbido; NPCs
// cobrem o rosto com o braço; robôs perdem o alvo). Fumaça: nuvem que cresce aos poucos e bloqueia a visão (robôs não veem quem está
// dentro; NPCs ficam em alerta e só atiram se virem). Barulhenta: buzina alta — robôs vão até ela atirando para destruí-la e os NPCs
// que estão na direção veem quem jogou e vão atrás.
import { MeshBuilder, M, hex, shade } from '../engine/mesh.js';
import { mat4 } from '../engine/math.js';

export const GREN = {
  hg_frag: { name: 'Granada de fragmentação', fuse: 5, color: 0x4a5236 }, hg_flash: { name: 'Granada de luz (flash)', fuse: 3, color: 0xb8bcc0 },
  hg_smoke: { name: 'Granada de fumaça', fuse: 3, color: 0x6a9ac0 }, hg_horn: { name: 'Granada barulhenta', fuse: 3, color: 0x6a7040 },
};
export const HAND_FUSE = 5;

export function grenadeMesh(id) {
  const mb = new MeshBuilder(); const c = hex(GREN[id].color), steel = hex(0x8a8e92), dark = hex(0x2a2c2e);
  if (id === 'hg_frag') { mb.setColor(c, 0.86); for (let k = 0; k < 5; k++) mb.cylinder(M(0, 0.01 + k * 0.022, 0), 0.034 + Math.sin((k + 0.5) / 5 * Math.PI) * 0.012, 0.034 + Math.sin((k + 1) / 5 * Math.PI) * 0.012, 0.021, 8, shade(c, k % 2 ? 0.85 : 1)); }
  else if (id === 'hg_flash') { mb.setColor(c, 0.5); mb.cylinder(M(0, 0, 0), 0.03, 0.03, 0.11, 8, c); mb.setColor(dark, 0.5); for (const y of [0.035, 0.07]) mb.cylinder(M(0, y, 0), 0.031, 0.031, 0.012, 8, dark); }
  else if (id === 'hg_smoke') { mb.setColor(c, 0.86); mb.cylinder(M(0, 0, 0), 0.034, 0.034, 0.11, 10, c); mb.setColor(shade(c, 0.7), 0.86); for (let k = 0; k < 4; k++) mb.cylinder(M(0, 0.015 + k * 0.025, 0), 0.036, 0.036, 0.006, 10, shade(c, 0.7)); }
  else { mb.setColor(c, 0.86); mb.cylinder(M(0, 0, 0), 0.035, 0.03, 0.09, 8, c); mb.setColor(hex(0xc03020), 0.5); mb.cylinder(M(0.04, 0.115, 0, 0, 1, 0, -Math.PI / 2), 0.012, 0.035, 0.07, 10, hex(0xc03020)); mb.box(M(0, 0.105, 0), 0.06, 0.018, 0.018, steel); }
  mb.setColor(steel, 0.5); mb.cylinder(M(0, 0.1, 0), 0.014, 0.014, 0.025, 6, steel); mb.box(M(0.022, 0.08, 0, 0, 1, 0, 0.25), 0.012, 0.07, 0.016, steel); mb.cylinder(M(-0.024, 0.115, 0, 0, 1, Math.PI / 2, 0), 0.014, 0.014, 0.004, 8, steel);
  return mb.build();
}

export class Grenades {
  constructor(game) { this.g = game; this.list = []; this.held = null; this.charge = null; this.waitRelease = false; this._hintT = 0; this.flashT = 0; this.meshes = {}; }
  // F puxa o pino; segurar o botão esquerdo enche a barra de força (o marcador vai e volta); soltar arremessa
  pull(id) {
    const g = this.g, P = g.player; if (P.dead || P.anim.busy || g.inv.count(id) <= 0) return;
    this.held = { id, t: HAND_FUSE }; this.charge = null; this.waitRelease = true; g.audio.play('pin', { vol: 0.9 }); g.noise && g.noise(P.pos, 4, 'pino');
    P.doAction('use', null, { speed: 1.6 }); g.ui.toast(`📌 Pino puxado — ${GREN[id].name}: segure o botão esquerdo para a força e solte para jogar (5 s!)`, 'warn');
  }
  // força: 0 = perto (verde) … 0,5 = meio (amarelo) … 1 = longe (vermelho); enche e seca a cada 1,6 s
  power() { if (!this.charge) return 0; const T = 1.6, x = (this.charge.t % T) / T; return x < 0.5 ? x * 2 : 2 - x * 2; }
  input(act, dt) {
    const g = this.g, P = g.player, id = g.equip.hand; if (P.dead || P.fainted > 0) { this.charge = null; return; }
    const mine = this.held && this.held.id === id;
    if (!act.throwHeld) this.waitRelease = false;
    if ((act.pin || (act.touchUse && !mine)) && !mine) { this.pull(id); return; }
    if (act.pin && mine && !this.charge) g.ui.toast('O pino já foi puxado — segure o botão esquerdo e solte para jogar', 'info');
    if (!mine) { if (act.use && !act.pin && !this._hintT) { this._hintT = 2; g.ui.toast('Aperte F para puxar o pino da granada', 'info'); } return; }
    if (act.throwHeld && !this.waitRelease && !this.charge && !P.anim.busy) this.charge = { t: 0 };
    if (this.charge) { if (act.throwHeld) this.charge.t += dt; else { const pw = this.power(); this.charge = null; this.lastPower = pw; P.anim.setOverlay(null, null, 0.05); if (!P.doAction(P.clips.throwGo ? 'throwGo' : 'throw', (n) => { if (n === 'release') this._throw(pw); }, { faceCam: true, speed: 1 })) this._throw(pw); } }
  }
  use(id) { if (!this.held || this.held.id !== id) this.pull(id); else this._throw(0.5); } // compatibilidade (testes antigos)
  _throw(pw = 0.5) {
    const g = this.g, P = g.player, h = this.held; if (!h) return; this.held = null; this.charge = null; if (g.inv.count(h.id) <= 0) return; g.inv.remove(h.id, 1);
    const f = g.cam.forward3 ? g.cam.forward3() : null; const yaw = g.cam.yaw, pit = g.cam.pitch; const dir = f || [Math.sin(yaw) * Math.cos(-pit), Math.sin(-pit) + 0.25, Math.cos(yaw) * Math.cos(-pit)];
    const hp = P.handWorldPos(); const sp = 5 + pw * 21; const l = Math.hypot(...dir) || 1; const v = [dir[0] / l * sp, dir[1] / l * sp + 1.5 + pw * 2.5, dir[2] / l * sp];
    this.list.push({ id: h.id, p: [hp[0], hp[1] + 0.1, hp[2]], v, fuse: GREN[h.id].fuse, spin: 0, rest: false, thrower: 'player', yaw: P.yaw, power: pw });
    g.audio.play('swing', { vol: 0.4 + pw * 0.4 }); if (g.inv.count(h.id) <= 0 && g.equip.hand === h.id) g.equip.hand = null;
  }
  update(dt) {
    const g = this.g, w = g.world, P = g.player; this.flashT = Math.max(0, this.flashT - dt); this._hintT = Math.max(0, this._hintT - dt);
    if (this.charge && (!this.held || g.equip.hand !== this.held.id || g.ui.anyOpen || P.dead || P.fainted > 0 || g.vehicles.driving)) this.charge = null;
    g.ui.throwBar && g.ui.throwBar(this.charge ? this.power() : null, this.held ? this.held.t : 0);
    if (this.held) { this.held.t -= dt; if (g.equip.hand !== this.held.id || P.dead) { if (P.dead || g.inv.count(this.held.id) <= 0) this.held = null; }
      if (this.held && this.held.t <= 0) { const id = this.held.id; this.held = null; g.inv.remove(id, 1); if (g.inv.count(id) <= 0 && g.equip.hand === id) g.equip.hand = null; const hp = P.handWorldPos(); this._activate({ id, p: hp, thrower: 'player', inHand: true }); } }
    for (const n of this.list) {
      if (!n.rest) { n.v[1] -= 9.8 * dt; const np = [n.p[0] + n.v[0] * dt, n.p[1] + n.v[1] * dt, n.p[2] + n.v[2] * dt];
        const free = g.physics.rayFree(n.p, np, 0.05); if (free < 0.99) { n.v[0] *= -0.35; n.v[2] *= -0.35; np[0] = n.p[0]; np[2] = n.p[2]; g.audio.play('metalHit', { at: n.p, vol: 0.25 }); }
        const gy = w.height(np[0], np[2]); if (np[1] < gy + 0.05) { np[1] = gy + 0.05; if (Math.abs(n.v[1]) > 1.5) g.audio.play('metalHit', { at: np, vol: 0.2 }); n.v[1] = Math.abs(n.v[1]) * 0.3; n.v[0] *= 0.55; n.v[2] *= 0.55; if (Math.hypot(n.v[0], n.v[1], n.v[2]) < 0.6) n.rest = true; }
        n.p = np; n.spin += dt * 9; }
      n.fuse -= dt; if (n.fuse <= 0 && !n.done) { n.done = true; this._activate(n); }
      if (n.horn) this._hornTick(n, dt);
      if (n.smoke) { n.smoke.r = g.blasts.cloudR(n.smoke.vis) * 0.95; n.smoke.p = [n.p[0], n.p[1], n.p[2]]; }
    }
    this.list = this.list.filter((n) => !(n.done && !n.horn && !n.smokeT) && !(n.smokeT && (n.smokeT -= dt) <= 0) && !(n.horn && n.horn.over));
  }
  _activate(n) {
    const g = this.g, P = g.player, p = [n.p[0], n.p[1] + 0.1, n.p[2]], CM = g.creatures;
    if (n.id === 'hg_frag') { g.explode(p, null, { r: 9, dmg: 150, playerDmg: 100, pr: 8, kind: 'grenade', cause: 'granada de fragmentação', vis: 'frag', crater: [4.5, 0.9], flash: 1 }); g.noise && g.noise(p, 120, 'explosão'); n.done = true; return; }
    if (n.id === 'hg_flash') { g.audio.play('flashbang', { at: p, vol: 1 }); g.fx.burst(p, 30, [6, 6, 6], 6, 0.25, 0.08, 0); g.blastLight = { pos: p.slice(), t: 0.5, big: true }; g.noise && g.noise(p, 90, 'flash');
      const dP = Math.hypot(P.pos[0] - p[0], P.pos[2] - p[2]); const los = g.physics.rayFree([P.pos[0], P.pos[1] + 1.6, P.pos[2]], p, 0.05) > 0.95; const look = Math.abs(((Math.atan2(p[0] - P.pos[0], p[2] - P.pos[2]) - g.cam.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI) < 1.4;
      if (!P.dead && los && ((dP < 4) || (dP < 22 && look))) { this.flashT = 7; g.audio.play('tinnitus', { vol: 0.9 }); g.audio.play('tinnitus', { vol: 0.5, rate: 0.98 }); g.ui.toast('😵 Cegado pela granada de luz!', 'warn'); }
      for (const c of CM.list) { if (c.dead) continue; const d = Math.hypot(c.pos[0] - p[0], c.pos[2] - p[2]); if (d > 20) continue; if (g.physics.rayFree([c.pos[0], c.pos[1] + 1.4, c.pos[2]], p, 0.05) < 0.95) continue; if (c.npc) g.npcs.blind(c, 4); else if (c.def.robot) { c.blindT = 4; c.alerted = 0; if (['chase', 'attack', 'firing'].includes(c.state)) c.state = 'search'; } }
      n.done = true; return; }
    if (n.id === 'hg_smoke') { g.audio.play('smokegren', { at: p, vol: 1 }); const vis = g.blasts.smokeCloud([p[0], g.world.height(p[0], p[2]), p[2]], { dur: 15, R: 8 }); const cl = { p, r: 0.5, t: 15, max: 15, kind: 'smoke', emit: 1e9, noFx: true, vis }; g.clouds.push(cl); n.smoke = cl; n.smokeT = 15; n.done = true; g.npcs && g.npcs.hear(p, 35); return; }
    if (n.id === 'hg_horn') { n.horn = { t: 7, fade: 2.2, hp: 8, shotCd: 0, bombCd: 1.2 }; n.hornV = g.audio.voice ? g.audio.voice('barulhenta', { at: p, vol: 1.2, max: 170 }) : null; if (!n.hornV) g.audio.play('horn', { at: p, vol: 1, max: 140 });
      g.noise && g.noise(p, 110, 'buzina', 'horn'); this._hornCall(n, true); n.done = true; }
  }
  // NPCs ouvem a sirene: quem não viu você vai procurar no barulho; dos que já tinham te visto, só alguns vão até a granada
  _hornCall(n, first) {
    const g = this.g, P = g.player, p = n.p;
    for (const c of g.creatures.list) { if (!c.npc || c.dead || c.convoy || Math.hypot(c.pos[0] - p[0], c.pos[2] - p[2]) > 110) continue; if (c._hornFrom === n) continue; c._hornFrom = n;
      const sawYou = c.target === 'player' && (c.lostT || 0) < 6; const seesThrower = first && n.thrower === 'player' && g.npcs._visible(c, P.pos, 90, null);
      if (sawYou || seesThrower) { if (Math.random() < 0.4) { c.target = null; c.state = 'search'; c.lastSeen = [p[0], p[2]]; c.timer = 14; c.hornGo = true; } else { c.target = 'player'; c.lostT = 0; c.hornGo = false; } }
      else { c.state = 'search'; c.lastSeen = [p[0] + (Math.random() - 0.5) * 6, p[2] + (Math.random() - 0.5) * 6]; c.timer = 14; c.alertT = 14; c.hornGo = true; } }
  }
  // robôs correm até a sirene e atiram nela; as sentinelas jogam bombas nela. Toca 7 s e vai abaixando até parar
  _hornTick(n, dt) {
    const g = this.g, CM = g.creatures, H = n.horn; H.shotCd -= dt; H.bombCd -= dt;
    if (H.t > 0) { H.t -= dt; if (H.t <= 0) H.fadeT = H.fade; } else { H.fadeT -= dt; }
    if (n.hornV) { n.hornV.mul = H.t > 0 ? 1 : Math.max(0, H.fadeT / H.fade); n.hornV.update(); if (H.t <= 0 && H.fadeT <= 0) { n.hornV.stop(0.2); n.hornV = null; } }
    if (H.t <= 0) { if (H.fadeT <= 0) H.over = true; return; }
    this._hcT = (this._hcT || 0) - dt; if (this._hcT <= 0) { this._hcT = 1; this._hornCall(n, false); }
    for (const c of CM.list) { if (c.dead || !c.def.robot || !c.def.hostile) continue; const d = Math.hypot(c.pos[0] - n.p[0], c.pos[2] - n.p[2]); if (d > 85) continue;
      c.hornT = 1.2; c.hornGoal = [n.p[0], n.p[2]]; const sentinel = c.def.ai === 'sentinel' || c.kind === 'mecha';
      if (sentinel && d < 45 && H.bombCd <= 0) { H.bombCd = 1.6 + Math.random(); this._robotBomb(c, n.p); }
      if (d <= 13 && H.shotCd <= 0) { H.shotCd = 0.6; const from = [c.pos[0], c.pos[1] + 1.2 * c.def.scale, c.pos[2]]; g.fx.tracer(from, n.p); g.audio.play(c.def.gatling ? 'minigun' : 'laser', { at: c.pos, vol: 0.7 }); g.fx.burst(n.p, 6, [3, 2, 1], 3, 0.2, 0.03); if (--H.hp <= 0) { H.t = 0; H.fadeT = 0.3; g.audio.play('metalHit', { at: n.p }); g.fx.burst(n.p, 14, [0.5, 0.5, 0.4], 4, 0.4, 0.05); } } }
  }
  // bomba jogada por sentinela/mecha (arco até o alvo)
  _robotBomb(c, to) {
    const from = [c.pos[0], c.pos[1] + 1.6 * (c.def.scale || 1), c.pos[2]]; const dx = to[0] - from[0], dz = to[2] - from[2], d = Math.hypot(dx, dz) || 1; const T = Math.max(0.8, d / 16); const dy = to[1] - from[1];
    this.list.push({ id: 'hg_frag', p: from, v: [dx / T, dy / T + 0.5 * 9.8 * T, dz / T], fuse: T + 0.6, spin: 0, rest: false, thrower: 'robot', src: c });
    this.g.audio.play('swing', { at: c.pos, vol: 0.8 }); this.bombs = (this.bombs || 0) + 1;
  }
  render(items) {
    const g = this.g, r = g.renderer; for (const id of Object.keys(GREN)) if (!this.meshes[id]) this.meshes[id] = r.createMesh(grenadeMesh(id));
    for (const n of this.list) { if (n.horn && n.horn.over) continue; items.push({ mesh: this.meshes[n.id], model: mat4.compose(n.p, n.spin, 1.6, n.rest ? Math.PI / 2 : n.spin * 0.7), sphere: [n.p[0], n.p[1], n.p[2], 0.5] }); }
  }
}
