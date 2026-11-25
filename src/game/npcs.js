// NPCs humanos: saqueadores em acampamentos espalhados pela ilha e soldados nas bases militares (fora da zona tóxica).
// Eles são criaturas (usam o mesmo sistema de dano, colisão e corpos), mas com IA própria: enxergam o jogador e os robôs,
// gritam quando avistam alguém, atiram (fuzil, pistola, escopeta) ou partem para cima (faca, machado, porrete), ouvem
// barulhos, ficam cegos com a granada de luz e não enxergam através da fumaça. Robôs e humanos brigam entre si.
import { mat4, quat, angleDiff, dampAngle, clamp } from '../engine/math.js';
import { WATER } from './world.js';
import { GUNS } from './weapons.js';

// visuais (paleta do personagem chibi): civis e militares das referências
export const NPC_LOOKS = {
  porter: [{ hair: 0x2a1a10, hairStyle: 'curto', jacket: 0x55603e, shirt: 0x4a5436, pants: 0x4e5636, shoes: 0x3a2c22, vestCol: 0x3c4428, hatKind: 'helmet', humanArms: true }],
  bandit: [
    { hair: 0x4a2a16, hairStyle: 'curto', jacket: 0xb02a26, shirt: 0xe2ddd0, pants: 0x3a5a8a, shoes: 0x5a3a22, humanArms: true }, // camisa xadrez vermelha e jeans
    { hair: 0x6a3a1e, hairStyle: 'longo', jacket: 0x55524c, shirt: 0x55524c, pants: 0x5a6a3a, shoes: 0x1e1e20, humanArms: true }, // regata cinza e calça cargo
    { hair: 0x2a1a10, hairStyle: 'curto', jacket: 0x4e5e3a, shirt: 0xd8d8d0, pants: 0x2a2c34, shoes: 0x24221e, humanArms: true }, // jaqueta verde
    { hair: 0x9a9a96, hairStyle: 'curto', jacket: 0xd8d4c8, shirt: 0xd8d4c8, pants: 0x6a4a2a, shoes: 0x4a3020, hatKind: 'straw', humanArms: true }, // velho de chapéu
  ],
  milsoldier: [
    { hair: 0x2a1a10, hairStyle: 'curto', jacket: 0x4e5a36, shirt: 0x4e5a36, pants: 0x4a5634, shoes: 0x24221e, vestCol: 0x3e4a2e, hatKind: 'helmet', humanArms: true }, // camuflado verde
    { hair: 0x1a1a1a, hairStyle: 'curto', jacket: 0x2a3450, shirt: 0x2a3450, pants: 0x262e44, shoes: 0x18181a, vestCol: 0x1e2436, hatKind: 'helmet', humanArms: true }, // tático azul
    { hair: 0x3a2a1a, hairStyle: 'curto', jacket: 0xb09a70, shirt: 0xb09a70, pants: 0xa08a62, shoes: 0x6a4a2a, vestCol: 0x8a7450, hatKind: 'helmet', humanArms: true }, // deserto
    { hair: 0x2a1a10, hairStyle: 'curto', jacket: 0x5a6a3a, shirt: 0x5a6a3a, pants: 0x4e5e34, shoes: 0x24221e, vestCol: 0x2e3424, humanArms: true }, // boina / mata
  ],
};
// armas: dano, cadência, alcance; corpo-a-corpo (melee) ou de fogo
const W = {
  rifle: { gun: true, dmg: 9, cd: 0.16, burst: 4, pause: 1.6, range: 45, acc: 0.55, sound: 'rifle', ammo: 'ammo555' },
  pistol: { gun: true, dmg: 8, cd: 0.7, burst: 1, pause: 0.9, range: 28, acc: 0.45, sound: 'pistol', ammo: 'ammo42' },
  shotgun: { gun: true, dmg: 22, cd: 1.2, burst: 1, pause: 1.2, range: 16, acc: 0.65, sound: 'shotgun', ammo: 'shells' },
  knife: { melee: true, dmg: 14, cd: 0.9, reach: 1.6 }, axe: { melee: true, dmg: 20, cd: 1.3, reach: 1.9 }, club: { melee: true, dmg: 15, cd: 1.1, reach: 1.8 },
};
const ITEM_OF = { rifle: 'rifle', pistol: 'pistol', shotgun: 'shotgun', knife: 'knife', axe: 'axe', club: null };

export class NPCManager {
  constructor(game) { this.g = game; this.timer = 0; this.blindFx = 0; }
  // ---------- aparecimento: acampamentos e bases militares perto do jogador ----------
  populate(dt) {
    if (this.g.netClient) return;
    const g = this.g, w = g.world, p = g.player.pos, CM = g.creatures; this.timer -= dt; if (this.timer > 0) return; this.timer = 2;
    const groups = [];
    for (const c of w.camps) groups.push({ key: 'c' + c.id, x: c.x, z: c.z, r: 14, n: c.n, kind: 'bandit', home: c });
    // bases militares: uns 30 soldados armados (mais o mecha sentinela, nas criaturas); a base da zona tóxica é só de robôs
    for (const st of w.sites) if (st.kind === 'military' && !st.toxic) groups.push({ key: 'm' + st.id, x: st.x, z: st.z, r: st.r * 0.8, n: 30, kind: 'milsoldier', home: st, far: 200 });
    // patrulhas militares (4 soldados) em algumas cidades, rodando pelas ruas
    for (const st of w.sites) if (st.kind === 'city' && !st.toxic && st.N && (st.id * 7 + 3) % 10 < 5) groups.push({ key: 'p' + st.id, x: st.x, z: st.z, r: 6, n: 4, kind: 'milsoldier', home: st, far: 170, patrol: true });
    for (const G of groups) { const d = Math.hypot(G.x - p[0], G.z - p[2]); if (d > (G.far || 175)) continue; const H = G.home;
      if ((H.npcRespawn || 0) > g.env.day) continue; if (H.npcRespawn && H.npcRespawn <= g.env.day) { H.npcRespawn = 0; H.npcDead = 0; }
      const alive = CM.list.filter((c) => c.group === G.key && !c.dead).length; const want = G.n - (H.npcDead || 0); if (alive >= want) continue;
      let route = null, lead = null; if (G.patrol) { route = this.cityRoute(H); lead = CM.list.find((c) => c.group === G.key && !c.dead && c.patrolLead) || null; }
      for (let k = alive; k < want; k++) { const sp = route ? (lead ? [lead.pos[0], lead.pos[2]] : route[0]) : [G.x, G.z]; const c = CM.spawnNear(G.kind, sp[0], sp[1], route ? 1 : 2, route ? 5 : G.r); if (!c) continue; c.group = G.key; c.home = [G.x, G.z]; c.homeR = G.r; this._setup(c, G.kind);
        if (route) { c.patrol = route; c.pi = 0; if (!lead) { lead = c; c.patrolLead = true; } else { c.leader = lead; c.slot = [[-1.6, -2], [1.6, -2], [0, -4]][(k - 1) % 3]; } c.homeR = 0; } } }
  }
  // rota de patrulha numa cidade: volta pela 2ª rua de dentro da grade (quadrado), no sentido horário
  cityRoute(st) { if (st._route) return st._route; const w = this.g.world, P = 44, q = st.half - P * (st.N > 6 ? 2 : 1); const pts = [[-q, -q], [q, -q], [q, q], [-q, q]].map(([a, b]) => w.cityW(st, a, b)); return (st._route = pts); }
  _setup(c, kind) {
    const r = Math.random(); c.looks = NPC_LOOKS[kind]; c.variant = c.variant ?? 0;
    if (kind === 'milsoldier' || kind === 'porter') c.weapon = r < 0.8 ? 'rifle' : r < 0.9 ? 'shotgun' : 'pistol';
    else c.weapon = r < 0.25 ? 'pistol' : r < 0.4 ? 'shotgun' : r < 0.55 ? 'rifle' : r < 0.72 ? 'knife' : r < 0.87 ? 'axe' : 'club';
    c.W = W[c.weapon]; c.burst = 0; c.fireCd = 1 + Math.random(); c.voice = 130 + Math.random() * 90; c.state = 'wander'; c.timer = Math.random() * 3; c.npc = true;
    c.loadout = this._loadout(c, kind);
  }
  _loadout(c, kind) { // o que fica no chão quando o corpo é picotado (ou revistado)
    const out = { weapon: [], pack: null, clothes: [], misc: [] }; const it = ITEM_OF[c.weapon]; if (it) out.weapon.push([it, 1]); const w = W[c.weapon]; if (w.ammo) out.weapon.push([w.ammo, 6 + Math.floor(Math.random() * 14)]);
    if (kind === 'milsoldier' || kind === 'porter') { out.clothes.push(['milshirt', 1], ['milpants', 1]); if (Math.random() < 0.5) out.clothes.push(['milboots', 1]); if (Math.random() < 0.4) out.clothes.push(['milhelmet', 1]); if (Math.random() < 0.3) out.clothes.push(['vest', 1]); }
    else { out.clothes.push(['shirt', 1], ['pants', 1]); if (Math.random() < 0.3) out.clothes.push(['leatherboots', 1]); }
    if (Math.random() < 0.55) out.pack = Math.random() < 0.6 ? 'pack_small' : 'pack_medium';
    const R = Math.random; if (R() < 0.5) out.misc.push(['canned', 1]); if (R() < 0.5) out.misc.push(['water', 1]); if (R() < 0.35) out.misc.push(['bandage', 1 + Math.floor(R() * 2)]); if (kind === 'milsoldier' && R() < 0.3) out.misc.push([['gren_he', 'hg_frag', 'hg_flash', 'hg_smoke'][Math.floor(R() * 4)], 1]);
    return out; }
  // ---------- percepção ----------
  _visible(c, tp, maxD, lookYaw) {
    const g = this.g, d = Math.hypot(tp[0] - c.pos[0], tp[2] - c.pos[2]); if (d > maxD) return false;
    if (lookYaw !== null && d > 3 && Math.abs(angleDiff(c.yaw, Math.atan2(tp[0] - c.pos[0], tp[2] - c.pos[2]))) > 1.35) return false;
    if (g.smokeBlocks && g.smokeBlocks([c.pos[0], c.pos[1] + 1.5, c.pos[2]], [tp[0], tp[1] + 1.3, tp[2]])) return false;
    return g.physics.rayFree([c.pos[0], c.pos[1] + 1.55, c.pos[2]], [tp[0], tp[1] + 1.3, tp[2]], 0.05) > 0.97;
  }
  // chamado pelo CreatureManager para cada NPC vivo
  think(c, dt, dist) {
    const g = this.g, P = g.player, CM = g.creatures, C = c.clips, w = g.world, def = c.def; if (!c.W) this._setup(c, c.kind);
    if (c.convoy && g.convoys && !(c.fainted > 0) && g.convoys.think(c, dt, dist)) return;
    // desmaiado: caído de bruços até acordar
    if (c.fainted > 0) { c.fainted -= dt; if (c.fainted <= 0) { c.fainted = 0; c.anim.play(C.idle, 0.6); c.state = 'search'; c.lastSeen = [P.pos[0], P.pos[2]]; c.timer = 10; } c.anim.update && 0; return; }
    c.timer -= dt; c.fireCd -= dt; c.attackCd = Math.max(0, c.attackCd - dt); c.shoutCd = (c.shoutCd || 0) - dt; c.scanT = (c.scanT || 0) - dt;
    // cego pela granada de luz: braço no rosto, parado
    if ((c.blindT || 0) > 0) { c.blindT -= dt; if (!c.anim.action || c.anim.action.clip !== C.block) c.anim.playAction(C.block, { mask: C.masks.upper, fadeIn: 0.08, fadeOut: 0.2 }); this._move(c, dt, 0, null, dist); return; }
    // alvos: jogador e robôs à vista
    const detect = def.detect * (P.crouch ? 0.55 : 1) * (g.env.isNight ? 0.6 : 1);
    if (c.scanT <= 0) { c.scanT = 0.25 + Math.random() * 0.15; const engaged = !!c.target;
      const pv = !P.dead && !P.sleeping && !P.invis && !(P.seat && P.seat.hidden && dist > 6) && this._visible(c, P.pos, engaged ? detect * 1.3 : detect, engaged ? null : c.yaw);
      let best = pv ? { t: 'player', d: dist } : null;
      for (const r of CM.list) { if (r.dead || !r.def.robot || r.def.hostile === false && !(r.angry > 0)) continue; if (r.kind === 'wasp' || r.kind === 'butterfly') continue; const d = Math.hypot(r.pos[0] - c.pos[0], r.pos[2] - c.pos[2]); if (d > 45 || (best && d > best.d)) continue;
        if (this._visible(c, r.pos, 45, engaged ? null : c.yaw)) best = { t: r, d }; }
      if (best) { const first = !c.target; c.target = best.t; c.lostT = 0;
        if (first && c.shoutCd <= 0) { c.shoutCd = 6; g.audio.play('shout', { at: c.pos, f0: c.voice, vol: 1, max: 70 }); this._alertGroup(c, best.t === 'player' ? P.pos : best.t.pos); } }
      else if (c.target) { c.lostT = (c.lostT || 0) + 0.3; if (c.lostT > 1.5) { c.lastSeen = c.target === 'player' ? [P.pos[0], P.pos[2]] : [c.target.pos[0], c.target.pos[2]]; c.target = null; c.state = 'search'; c.timer = 10; } } }
    if (c.target && c.target !== 'player' && c.target.dead) c.target = null;
    if (c.target === 'player' && P.dead) c.target = null;
    let speed = 0, face = null;
    if (c.target) {
      const T = c.target === 'player' ? P.pos : c.target.pos; const d = Math.hypot(T[0] - c.pos[0], T[2] - c.pos[2]); const ang = Math.atan2(T[0] - c.pos[0], T[2] - c.pos[2]); face = ang;
      if (c.W.gun) {
        if (d > c.W.range * 0.8) speed = def.run; else if (d < 6) { speed = -def.walk; } else if (Math.sin(g.env.elapsed * 0.7 + c.uid) > 0.6) speed = 0.01; // pequenas pausas
        if (d < c.W.range && Math.abs(angleDiff(c.yaw, ang)) < 0.35 && c.fireCd <= 0) this._fire(c, T, d);
        c.anim.playAction && (!c.anim.action || c.anim.action.clip !== (c.weapon === 'pistol' ? C.pistolAim : C.rifleAim)) && C.rifleAim && c.anim.playAction(c.weapon === 'pistol' ? C.pistolAim : C.rifleAim, { mask: C.masks.upper, fadeIn: 0.15, fadeOut: 0.2 });
      } else {
        speed = d > c.W.reach ? def.run : 0;
        if (d < c.W.reach + 0.3 && c.attackCd <= 0) { c.attackCd = c.W.cd; const clip = c.weapon === 'knife' ? C.thrust || C.punch : c.weapon === 'axe' ? C.chop : C.punch; c.anim.playAction(clip, { mask: C.masks.upper, fadeIn: 0.05, fadeOut: 0.15 });
          setTimeout(() => { if (c.dead) return; const T2 = c.target === 'player' ? P.pos : c.target && c.target.pos; if (!T2) return; if (Math.hypot(T2[0] - c.pos[0], T2[2] - c.pos[2]) < c.W.reach + 0.5) { if (c.target === 'player') g.playerHit(c.W.dmg, c); else this.hitRobot(c.target, c.W.dmg, c); g.audio.play('hit', { at: c.pos }); } }, 280); }
      }
      c.state = 'chase';
    } else if (c.state === 'search' && c.lastSeen) { const d = Math.hypot(c.lastSeen[0] - c.pos[0], c.lastSeen[1] - c.pos[2]); face = Math.atan2(c.lastSeen[0] - c.pos[0], c.lastSeen[1] - c.pos[2]); speed = d > 2 ? def.walk * 1.8 : 0; if (c.timer <= 0 || d <= 2 && c.timer < 6) { c.state = 'wander'; c.lastSeen = null; } }
    else { // ronda perto do acampamento/base
      if (c.anim.action && (c.anim.action.clip === C.rifleAim || c.anim.action.clip === C.pistolAim)) c.anim.stopAction && c.anim.stopAction(0.3);
      if (c.patrol) { // patrulha: o líder anda pela rota; os outros seguem em formação atrás dele
        if (c.leader && (c.leader.dead || !this.g.creatures.list.includes(c.leader))) { c.leader = null; c.patrolLead = true; }
        if (c.leader) { const L = c.leader, cy = Math.cos(L.yaw), sy = Math.sin(L.yaw); const gx = L.pos[0] + c.slot[0] * cy + c.slot[1] * sy, gz = L.pos[2] - c.slot[0] * sy + c.slot[1] * cy; const d = Math.hypot(gx - c.pos[0], gz - c.pos[2]); if (d > 0.8) { face = Math.atan2(gx - c.pos[0], gz - c.pos[2]); speed = d > 4 ? def.walk * 1.8 : def.walk; } else face = L.yaw; }
        else { const t = c.patrol[c.pi % c.patrol.length]; const d = Math.hypot(t[0] - c.pos[0], t[1] - c.pos[2]); if (d < 3) c.pi++; face = Math.atan2(t[0] - c.pos[0], t[1] - c.pos[2]); speed = def.walk * 0.9; }
        this._move(c, dt, speed, face, dist); return; }
      const H = c.home || c.origin; if (!c.goal || c.timer <= 0) { const a = Math.random() * 6.28, rr = Math.random() * (c.homeR || 12); c.goal = [H[0] + Math.cos(a) * rr, H[1] + Math.sin(a) * rr]; c.timer = 4 + Math.random() * 8; c.idle = Math.random() < 0.45; }
      if (!c.idle) { const d = Math.hypot(c.goal[0] - c.pos[0], c.goal[1] - c.pos[2]); if (d > 1) { face = Math.atan2(c.goal[0] - c.pos[0], c.goal[1] - c.pos[2]); speed = def.walk; } } }
    this._move(c, dt, speed, face, dist);
  }
  _alertGroup(c, at) { for (const o of this.g.creatures.list) if (o !== c && o.npc && !o.dead && !o.target && Math.hypot(o.pos[0] - c.pos[0], o.pos[2] - c.pos[2]) < 45) { o.state = 'search'; o.lastSeen = [at[0], at[2]]; o.timer = 12; } }
  // barulho (passos, tiros, granada barulhenta…): NPCs perto vão ver o que foi
  hear(pos, radius) { for (const o of this.g.creatures.list) if (o.npc && !o.dead && !o.target && Math.hypot(o.pos[0] - pos[0], o.pos[2] - pos[2]) < radius) { o.state = 'search'; o.lastSeen = [pos[0], pos[2]]; o.timer = 10; } }
  blind(c, t) { c.blindT = Math.max(c.blindT || 0, t); c.target = null; c.state = 'search'; c.timer = t + 4; }
  _fire(c, T, d) {
    const g = this.g, P = g.player, Wp = c.W; c.burst++; if (c.burst >= Wp.burst) { c.burst = 0; c.fireCd = Wp.pause + Math.random() * 0.6; } else c.fireCd = Wp.cd;
    const mz = this.muzzle(c); const isP = c.target === 'player'; const moving = isP ? Math.hypot(P.vel[0], P.vel[2]) > 2 : (c.target.speed || 0) > 1;
    let hit = Math.random() < Wp.acc * clamp(1.15 - d / (Wp.range * 1.3), 0.2, 1) * (moving ? 0.7 : 1) * (isP && P.crouch ? 0.8 : 1) * (g.smokeBlocks && g.smokeBlocks(mz, [T[0], T[1] + 1.2, T[2]]) ? 0.1 : 1);
    const aim = [T[0] + (hit ? 0 : (Math.random() - 0.5) * 2.5), T[1] + (isP ? 1.2 : 0.8) + (hit ? 0 : (Math.random() - 0.3) * 1.5), T[2] + (hit ? 0 : (Math.random() - 0.5) * 2.5)];
    g.fx.tracer(mz, aim); g.fx.burst(mz, 3, [3, 2, 1], 1.5, 0.08, 0.03, 0); g.audio.play(Wp.sound, { at: c.pos, vol: 0.9, max: 160 });
    if (g.noise) g.noise(c.pos, 70, 'tiro', c);
    if (hit) { if (isP) g.playerHit(Wp.dmg * (c.weapon === 'shotgun' && d > 9 ? 0.5 : 1), c, { ranged: true }); else this.hitRobot(c.target, Wp.dmg * 1.4, c); }
  }
  muzzle(c) { const I = c.skel.index; const m = mat4.mul(mat4.create(), c.model, c.anim.world[I.handR]); const h = mat4.transformPoint(m, [0, -0.1, 0]); return [h[0] + Math.sin(c.yaw) * 0.6, h[1] + 0.05, h[2] + Math.cos(c.yaw) * 0.6]; }
  hitRobot(r, dmg, src) { const CM = this.g.creatures, st = r.state, ls = r.lastSeen; CM.damage(r, dmg, Math.atan2(r.pos[0] - src.pos[0], r.pos[2] - src.pos[2]), 'npc'); if (!r.dead) { r.state = st === 'wander' || st === 'return' ? 'wander' : st; r.lastSeen = ls; r.npcFoe = src; } }
  // movimento com desvio de obstáculos (mesma lógica das criaturas) e animação de andar/correr
  _move(c, dt, speed, face, dist) {
    const g = this.g, w = g.world, def = c.def, C = c.clips; if (face !== null) c.yaw = dampAngle(c.yaw, face, 7, dt);
    let mv = Math.abs(speed); const back = speed < 0; let yaw = back ? c.yaw + Math.PI : c.yaw;
    if (mv > 0.02) { const blocked = (yw) => { const x = c.pos[0] + Math.sin(yw) * 1.2, z = c.pos[2] + Math.cos(yw) * 1.2; if (w.height(x, z) < WATER + 0.4 || w.normal(x, z)[1] < 0.6) return true; for (const k of g.physics.query(x, z, 1)) if (!k.dyn && !k.ghost && !k.camOnly && k.y1 > c.pos[1] + 0.5 && k.y0 < c.pos[1] + 1.2 && g.physics.insideXZ(k, x, z, def.radius * 0.8)) return true; return false; };
      if (blocked(yaw)) { let ok = false; for (const off of [0.6, -0.6, 1.2, -1.2, 1.9, -1.9]) if (!blocked(yaw + off)) { yaw += off; ok = true; break; } if (!ok) mv = 0; if (face === null) c.yaw = dampAngle(c.yaw, back ? yaw - Math.PI : yaw, 8, dt); }
      c.collider.ghost = true; const n = Math.max(1, Math.ceil(mv * dt / 0.12)); for (let k = 0; k < n; k++) { c.pos[0] += Math.sin(yaw) * mv * dt / n; c.pos[2] += Math.cos(yaw) * mv * dt / n; g.physics.resolve(c.pos, def.radius, 1.3, 0.6); } c.collider.ghost = false; }
    const [gy] = g.physics.ground(c.pos[0], c.pos[2], def.radius * 0.5, c.pos[1] + 0.3, 0.6); c.pos[1] += (gy - c.pos[1]) * Math.min(1, 15 * dt);
    const P = g.player, dpx = c.pos[0] - P.pos[0], dpz = c.pos[2] - P.pos[2], dp = Math.hypot(dpx, dpz), minD = def.radius + 0.36; if (dp < minD && dp > 1e-3) { c.pos[0] += dpx / dp * (minD - dp); c.pos[2] += dpz / dp * (minD - dp); }
    c.speed = mv; c.collider.x = c.pos[0]; c.collider.z = c.pos[2]; c.collider.y0 = c.pos[1]; c.collider.y1 = c.pos[1] + 1.7;
    // passos (som posicional e barulho para os outros)
    if (mv > 0.5 && dist < 40) { c.stepT = (c.stepT || 0) - dt * mv / 1.6; if (c.stepT <= 0) { c.stepT = 0.45; g.audio.play('step', { at: c.pos, surface: 'grass', vol: mv > 3 ? 0.9 : 0.5, max: 30 }); } }
    const clip = mv > def.walk * 1.5 ? C.run : mv > 0.1 ? C.walk : C.idle; const sp = mv > def.walk * 1.5 ? mv / 4.3 : mv > 0.1 ? mv / 1.75 : 1; c.anim.play(clip, 0.25, Math.max(0.3, Math.min(sp, 2)));
  }
  // robôs também atacam os humanos que estão à vista (quando o jogador não está mais perto deles)
  update(dt) {
    if (this.g.netClient) return;
    const g = this.g, CM = g.creatures, P = g.player; this.populate(dt); this._robT = (this._robT || 0) - dt; if (this._robT > 0) return; this._robT = 0.3;
    const npcs = CM.list.filter((c) => c.npc && !c.dead); if (!npcs.length) return;
    for (const r of CM.list) { if (r.dead || !r.def.robot || !r.def.hostile || r.kind === 'wasp' || r.kind === 'butterfly' || r.kind === 'mecha' && r.blind) continue;
      const dP = Math.hypot(r.pos[0] - P.pos[0], r.pos[2] - P.pos[2]); if (dP > 140) continue; let best = r.npcFoe && !r.npcFoe.dead ? r.npcFoe : null, bd = best ? Math.hypot(best.pos[0] - r.pos[0], best.pos[2] - r.pos[2]) : 1e9;
      for (const n of npcs) { const d = Math.hypot(n.pos[0] - r.pos[0], n.pos[2] - r.pos[2]); if (d < bd && d < r.def.detect * 1.2) { best = n; bd = d; } }
      if (!best || (dP < bd && ['chase', 'attack', 'firing', 'spinup'].includes(r.state))) continue;
      if (!this._visible({ pos: r.pos, yaw: r.yaw }, best.pos, r.def.detect * 1.4, null)) continue;
      r.yaw = Math.atan2(best.pos[0] - r.pos[0], best.pos[2] - r.pos[2]); r.npcFoe = best; r.robCd = (r.robCd || 0) - 0.3; if (best.target === null || best.target === undefined) { best.target = r; }
      const ranged = !!(r.def.shoot || r.def.gatling || r.def.missile);
      if (!ranged && bd > r.def.range + 0.5) { r.goal = [best.pos[0], best.pos[2]]; r.state = 'wander'; r.timer = 2; r.idle = false; continue; }
      if (r.robCd > 0) continue; r.robCd = ranged ? 1.1 + Math.random() * 0.8 : 1.2;
      const from = ranged ? [r.pos[0], r.pos[1] + 1.3 * r.def.scale, r.pos[2]] : null; const hit = Math.random() < (ranged ? 0.45 : 0.8);
      if (ranged) { const to = [best.pos[0] + (hit ? 0 : (Math.random() - 0.5) * 2), best.pos[1] + 1.1, best.pos[2] + (hit ? 0 : (Math.random() - 0.5) * 2)]; g.fx.tracer(from, to); g.audio.play(r.def.gatling ? 'minigun' : 'laser', { at: r.pos, vol: 0.7, max: 120 }); }
      if (hit) { const dmg = ranged ? (r.def.shoot ? r.def.shoot.dmg : 10) : r.def.dmg; const st = best.state; CM.damage(best, dmg, Math.atan2(best.pos[0] - r.pos[0], best.pos[2] - r.pos[2]), 'robot'); if (!best.dead) { best.target = r; best.state = st; } } }
  }
  // arma na mão dos NPCs (malha da arma presa à mão direita, apontando para frente)
  render(items, eye, meshFor) {
    for (const c of this.g.creatures.list) { if (!c.npc || c.dead || !c.weapon) continue; if (Math.hypot(c.pos[0] - eye[0], c.pos[2] - eye[2]) > 120) continue;
      const mesh = meshFor(c.weapon); if (!mesh) continue; const I = c.skel.index; const hm = mat4.mul(mat4.create(), c.model, c.anim.world[I.handR]); const hp = mat4.transformPoint(hm, [0, -0.08, 0]);
      let model; if (c.W.gun) { const aiming = !!c.target; model = mat4.compose(hp, c.yaw, 1, aiming ? 0 : 0.9); } else model = mat4.mul(mat4.create(), hm, mat4.fromTRS(mat4.create(), [0, -0.08, 0.015], quat.fromEuler(Math.PI / 2, 0, 0), [1, 1, 1]));
      items.push({ mesh, model, sphere: [c.pos[0], c.pos[1] + 1, c.pos[2], 2] }); }
  }
}
