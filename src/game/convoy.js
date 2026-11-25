// Comboio: um carregador com uma carga enorme nas costas, escoltado por 15 soldados armados, andando pelas estradas até uma
// base militar. Se alguém atira (ou é visto), os soldados procuram e caçam o atirador; o carregador foge correndo com a carga
// e alguns guarda-costas e some quando ninguém está por perto. Detectam armadilhas de granada no caminho: param, recuam,
// um soldado vai agachado desarmar e o comboio segue. Na base entram no alojamento e somem sem ninguém ver.
import { MeshBuilder, M, hex, shade } from '../engine/mesh.js';
import { mat4, clamp, angleDiff } from '../engine/math.js';
import { segDist } from './world.js';

// formação: [à frente (m), lateral (m)] em relação ao carregador
const SLOTS = [[11, -1.2], [11, 1.2], [8, -2.6], [8, 2.6], [4, -3.6], [4, 3.6], [0, -4.2], [0, 4.2], [-4, -3.6], [-4, 3.6], [-8, -2.6], [-8, 2.6], [-11, -1.2], [-11, 1.2], [-14, 0]];
export const ESCORTS = SLOTS.length; // 15

export function porterLoadMesh() {
  // Mochilão de expedição enorme, encaixado nas costas (coordenadas do corpo em pé: cintura 1,0 m, ombros 1,45 m, costas em z = -0,14).
  // O mesh é preso ao osso do peito (origem em y = 1,30), por isso tudo é deslocado em -1,30 no final.
  const mb = new MeshBuilder(); const ol = hex(0x4e5634), olD = hex(0x3c4428), olL = hex(0x5e6842), strap = hex(0x2e3222), metal = hex(0x7a7c80), roll = hex(0x6a5a3a), tan = hex(0x8a7a52);
  const Y = -1.30, Z0 = -0.15; // frente do mochilão encostada nas costas
  const B = (x, y, z, w, h, d, c, r = 0.05) => { mb.setColor(c, 0.85); mb.roundBox(M(x, y + Y, z), w, h, d, c, r, 1); };
  // corpo principal: da cintura até a altura dos ombros (não passa da nuca)
  B(0, 1.24, Z0 - 0.24, 0.6, 0.72, 0.46, ol, 0.08);
  // tampa superior com bolso e cintas
  B(0, 1.62, Z0 - 0.25, 0.58, 0.1, 0.44, olD, 0.05);
  // bolso frontal grande e dois bolsos menores
  B(0, 1.14, Z0 - 0.5, 0.42, 0.38, 0.1, olL, 0.04); B(0, 1.42, Z0 - 0.49, 0.32, 0.16, 0.08, olD, 0.03);
  // bolsos laterais
  for (const sx of [-1, 1]) { B(sx * 0.34, 1.14, Z0 - 0.24, 0.1, 0.42, 0.32, olL, 0.04); B(sx * 0.34, 1.42, Z0 - 0.24, 0.08, 0.16, 0.26, olD, 0.03); }
  // saco de dormir enrolado embaixo e barraca em cima
  mb.setColor(roll, 0.85); mb.cylinder(M(0.33, 0.84 + Y, Z0 - 0.26, 0, 1, 0, Math.PI / 2), 0.13, 0.13, 0.66, 10, roll);
  mb.setColor(tan, 0.85); mb.cylinder(M(0.31, 1.74 + Y, Z0 - 0.26, 0, 1, 0, Math.PI / 2), 0.09, 0.09, 0.62, 10, tan);
  // cintas de compressão (atravessam o corpo e prendem os rolos)
  mb.setColor(strap, 0.8); for (const y of [1.0, 1.3]) for (const sx of [-1, 1]) mb.box(M(sx * 0.355, y + Y, Z0 - 0.24, 0, 1, 0, 0), 0.012, 0.04, 0.48, strap);
  for (const sx of [-0.18, 0.18]) { mb.box(M(sx, 0.84 + Y, Z0 - 0.26), 0.04, 0.28, 0.28, strap); mb.box(M(sx, 1.74 + Y, Z0 - 0.26), 0.04, 0.2, 0.2, strap); mb.box(M(sx, 1.25 + Y, Z0 - 0.5), 0.04, 0.8, 0.012, strap); }
  // armação de metal saindo nas laterais
  mb.setColor(metal, 0.5); for (const sx of [-1, 1]) { mb.box(M(sx * 0.3, 1.25 + Y, Z0 - 0.015), 0.025, 1.0, 0.025, metal); } mb.box(M(0, 1.72 + Y, Z0 - 0.015), 0.62, 0.025, 0.025, metal);
  // alças passando por cima dos ombros até o peito e barrigueira na cintura
  mb.setColor(strap, 0.8); for (const sx of [-1, 1]) { mb.box(M(sx * 0.12, 1.5 + Y, -0.04), 0.07, 0.04, 0.24, strap); mb.box(M(sx * 0.12, 1.32 + Y, 0.125), 0.07, 0.34, 0.03, strap); mb.box(M(sx * 0.12, 1.32 + Y, Z0 + 0.01), 0.07, 0.36, 0.03, strap); }
  mb.box(M(0, 1.36 + Y, 0.14), 0.24, 0.03, 0.02, strap);
  for (const sx of [-1, 1]) mb.box(M(sx * 0.19, 1.0 + Y, -0.02), 0.04, 0.08, 0.26, strap);
  // cantil e panela pendurados
  mb.setColor(metal, 0.5); mb.cylinder(M(0.42, 1.0 + Y, Z0 - 0.3), 0.05, 0.05, 0.16, 8, metal); mb.cylinder(M(-0.42, 1.05 + Y, Z0 - 0.3, 0, 1, 0, Math.PI / 2), 0.08, 0.08, 0.06, 10, shade(metal, 0.8));
  return mb.build();
}

// rota pela malha viária: de (estrada a, posição sa) até o portão (s = 0) do ramal da base
export function roadRoute(world, a, sa, base) {
  const R = world.roads; const br = R.find((r) => r.site === base.id && r.kind === 'branch'); if (!br) return null;
  const up = (rid, s) => { const out = [[rid, s]]; let r = R[rid]; let guard = 0; while (r.joinRoad !== undefined && guard++ < 20) { out.push([r.joinRoad, r.joinS]); r = R[r.joinRoad]; } return out; };
  const UA = up(a, sa), UB = up(br.id, 0); let ia = -1, ib = -1; for (let i = 0; i < UA.length && ia < 0; i++) { const j = UB.findIndex((q) => q[0] === UA[i][0]); if (j >= 0) { ia = i; ib = j; } } if (ia < 0) return null;
  const pts = []; const walk = (rid, s0, s1) => { const r = R[rid]; const n = Math.max(1, Math.ceil(Math.abs(s1 - s0) / 5)); for (let k = 0; k <= n; k++) pts.push(r.at(s0 + (s1 - s0) * k / n)); };
  for (let k = 0; k < ia; k++) walk(UA[k][0], UA[k][1], R[UA[k][0]].L);
  walk(UA[ia][0], UA[ia][1], UB[ib][1]);
  for (let k = ib - 1; k >= 0; k--) walk(UB[k][0], R[UB[k][0]].L, UB[k][1]);
  const P = [pts[0]]; for (const q of pts) if (Math.hypot(q[0] - P[P.length - 1][0], q[1] - P[P.length - 1][1]) > 0.5) P.push(q); return P;
}

export class Convoys {
  constructor(game) { this.g = game; this.list = []; this.cool = typeof window !== 'undefined' && window.__TEST_FIXED_SPAWN ? 1e9 : 150; this.timer = 0; this.nextId = 1; } // (nos testes automáticos o comboio só aparece quando chamado)
  // rota → posição e direção em s
  _at(cv, s) { const P = cv.route, C = cv.cum; s = clamp(s, 0, cv.L); let i = 1; while (i < C.length - 1 && C[i] < s) i++; const t = (s - C[i - 1]) / ((C[i] - C[i - 1]) || 1); const a = P[i - 1], b = P[i];
    const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1; return { x: a[0] + dx * t, z: a[1] + dz * t, tx: dx / l, tz: dz / l }; }
  // aparece um comboio na estrada perto do jogador (ou forçado pelos testes)
  spawn(force) {
    const g = this.g, w = g.world, P = g.player, p = P.pos; const bases = w.sites.filter((s) => s.kind === 'military' && !s.toxic); if (!bases.length) return null;
    let best = null; for (const s of w.roadSegs) { if (s[6] !== 'road' || s[8] === undefined) continue; const [d, t] = segDist(p[0], p[2], s[0], s[1], s[2], s[3]); if (d < (best ? best.d : force ? 600 : 260)) best = { d, s, t }; } if (!best) return null;
    const rd = w.roads[best.s[8]]; let sNear = 0; { let acc = 0; for (let i = 0; i < rd.pts.length - 1; i++) { const a = rd.pts[i], b = rd.pts[i + 1]; if (a[0] === best.s[0] && a[1] === best.s[1] && b[0] === best.s[2] && b[1] === best.s[3]) { sNear = acc + Math.hypot(b[0] - a[0], b[1] - a[1]) * best.t; break; } acc += Math.hypot(b[0] - a[0], b[1] - a[1]); } }
    const base = bases.slice().sort((a, b) => Math.hypot(a.x - p[0], a.z - p[2]) - Math.hypot(b.x - p[0], b.z - p[2]))[0];
    let route0 = roadRoute(w, rd.id, sNear, base); if (!route0 || route0.length < 2) return null;
    const dir = Math.hypot(route0[Math.min(3, route0.length - 1)][0] - rd.at(Math.min(rd.L, sNear + 10))[0], route0[Math.min(3, route0.length - 1)][1] - rd.at(Math.min(rd.L, sNear + 10))[1]) < Math.hypot(route0[Math.min(3, route0.length - 1)][0] - rd.at(Math.max(0, sNear - 10))[0], route0[Math.min(3, route0.length - 1)][1] - rd.at(Math.max(0, sNear - 10))[1]) ? 1 : -1;
    const back = force && force.back !== undefined ? force.back : 170; const s0 = clamp(sNear - dir * back, 0, rd.L); const route = roadRoute(w, rd.id, s0, base); if (!route || route.length < 2) return null;
    const cum = [0]; for (let i = 1; i < route.length; i++) cum.push(cum[i - 1] + Math.hypot(route[i][0] - route[i - 1][0], route[i][1] - route[i - 1][1]));
    const cv = { id: this.nextId++, route, cum, L: cum[cum.length - 1], s: 16, state: 'march', base, members: [], porter: null, t: 0, speed: 1.25 };
    // o portão da base fica no fim da rota; depois entram no alojamento
    const bar = w.buildings.filter((b) => b.siteId === base.id && b.style === 'barracks').sort((a, b) => Math.hypot(a.x - base.x, a.z - base.z) - Math.hypot(b.x - base.x, b.z - base.z))[0];
    cv.door = bar ? [bar.x + Math.sin(bar.rot) * (bar.d / 2 + 0.8), bar.z + Math.cos(bar.rot) * (bar.d / 2 + 0.8)] : [base.x, base.z];
    const CM = g.creatures; const put = (c, x, z, yaw) => { c.pos[0] = x; c.pos[2] = z; c.pos[1] = w.height(x, z); c.yaw = yaw; c.collider.x = x; c.collider.z = z; c.collider.y0 = c.pos[1]; c.collider.y1 = c.pos[1] + 1.7; c.origin = [x, z]; c.home = [x, z]; c.homeR = 10; };
    const a0 = this._at(cv, cv.s); const yaw = Math.atan2(a0.tx, a0.tz);
    const por = CM.spawnNear('porter', a0.x, a0.z, 0, 1); if (!por) return null; put(por, a0.x, a0.z, yaw); g.npcs._setup(por, 'porter'); por.weapon = null; por.convoy = cv; por.porter = true; cv.porter = por; cv.members.push(por);
    por.clips = { ...por.clips, walk: por.clips.carryWalk, run: por.clips.carryRun, idle: por.clips.carryIdle };
    SLOTS.forEach(([fa, la], i) => { const q = this._at(cv, cv.s + fa); const x = q.x - q.tz * la, z = q.z + q.tx * la; const c = CM.spawnNear('milsoldier', x, z, 0, 1.2); if (!c) return; put(c, x, z, yaw); c.variant = i % 4; g.npcs._setup(c, 'milsoldier'); c.convoy = cv; c.slot = i; cv.members.push(c); });
    this.list.push(cv); return cv;
  }
  update(dt) {
    if (this.g.netClient) return;
    const g = this.g, P = g.player; this.cool -= dt; this.timer -= dt;
    if (this.timer <= 0) { this.timer = 5; if (!this.list.length && this.cool <= 0 && !P.dead && g.world.toxicAt(P.pos[0], P.pos[2]) <= 0) { if (this.spawn()) this.cool = 480 + Math.random() * 300; else this.cool = 30; } }
    this.list = this.list.filter((cv) => { cv.members = cv.members.filter((c) => !c.dead && g.creatures.list.includes(c)); if (cv.porter && (cv.porter.dead || !g.creatures.list.includes(cv.porter))) cv.porter = null; return cv.members.length > 0 && !cv.done; });
  }
  // alarme: atiraram, alguém foi visto ou ferido
  alert(cv, at, why) { if (cv.state === 'combat') return; const g = this.g; cv.state = 'combat'; cv.alertAt = at ? [at[0], at[2] ?? at[1]] : null; cv.trap = null;
    const esc = cv.members.filter((c) => !c.porter); const guards = esc.slice().sort((a, b) => Math.hypot(a.pos[0] - cv.porter.pos[0], a.pos[2] - cv.porter.pos[2]) - Math.hypot(b.pos[0] - cv.porter.pos[0], b.pos[2] - cv.porter.pos[2])).slice(0, 3);
    for (const c of esc) { if (guards.includes(c) && cv.porter) { c.guard = true; continue; } c.convoyFree = true; c.state = 'search'; c.timer = 25; c.lastSeen = cv.alertAt ? cv.alertAt.slice() : [c.pos[0], c.pos[2]]; c.homeR = 30; }
    if (cv.porter) g.audio.play('shout', { at: cv.porter.pos, f0: 120, vol: 1, max: 90 }); void why; }
  // chamado pelo NPCManager.think: true = o comboio cuidou desse NPC neste quadro
  think(c, dt, dist) {
    const cv = c.convoy; if (!cv || c.convoyFree) return false; const g = this.g, P = g.player, n = g.npcs;
    if (c.porter) return this._porter(cv, c, dt, dist);
    if (c.guard) { const q = cv.porter; if (!q) { c.convoyFree = true; return false; } // guarda-costas: correm junto com o carregador
      if (c.target) return false; const d = Math.hypot(q.pos[0] - c.pos[0], q.pos[2] - c.pos[2]); const side = c.slot % 2 ? 1 : -1; const tx = q.pos[0] - Math.sin(q.yaw) * 2.2 + Math.cos(q.yaw) * side * 1.6, tz = q.pos[2] - Math.cos(q.yaw) * 2.2 - Math.sin(q.yaw) * side * 1.6; const dd = Math.hypot(tx - c.pos[0], tz - c.pos[2]);
      n._move(c, dt, dd > 0.8 ? Math.min(c.def.run, dd * 1.6 + (d > 6 ? 2 : 0)) : 0, dd > 0.8 ? Math.atan2(tx - c.pos[0], tz - c.pos[2]) : q.yaw, dist); return true; }
    // em marcha: percepção própria (jogador à vista dispara o alarme)
    c.scanT = (c.scanT || 0) - dt; if (c.scanT <= 0) { c.scanT = 0.35 + Math.random() * 0.2; const det = c.def.detect * (P.crouch ? 0.5 : 1) * (g.env.isNight ? 0.6 : 1); const dP = Math.hypot(P.pos[0] - c.pos[0], P.pos[2] - c.pos[2]);
      if (!P.dead && !(P.fainted > 0) && !(P.seat && P.seat.hidden && dP > 6) && n._visible(c, P.pos, det * 0.8, c.yaw)) { this.alert(cv, P.pos, 'visto'); c.target = 'player'; c.lostT = 0; return false; } }
    // posição na formação (recuada enquanto desarmam uma armadilha)
    const [fa, la] = SLOTS[c.slot] || [0, 0]; let tgt;
    if (cv.state === 'disarm' && cv.disarmer === c) { tgt = [cv.trap.x, cv.trap.z]; const d = Math.hypot(tgt[0] - c.pos[0], tgt[1] - c.pos[2]);
      if (d > 1.1) { n._move(c, dt, Math.min(c.def.walk * 2.2, d * 1.5 + 0.3), Math.atan2(tgt[0] - c.pos[0], tgt[1] - c.pos[2]), dist); return true; }
      c.anim.play(c.clips.crouchIdle || c.clips.idle, 0.25); c.yaw = Math.atan2(tgt[0] - c.pos[0], tgt[1] - c.pos[2]); cv.dt = (cv.dt || 0) + dt;
      if (cv.dt > 4) { const tr = cv.trap; if (g.build.pieces.includes(tr)) { g.build.remove(tr, false); g.audio.play('trapArm', { at: [tr.x, tr.y, tr.z], max: 40 }); if (Math.hypot(tr.x - P.pos[0], tr.z - P.pos[2]) < 90) g.ui.toast('🪖 Os soldados acharam sua armadilha de granada e desarmaram', 'warn'); }
        cv.trap = null; cv.disarmer = null; cv.dt = 0; cv.state = 'march'; } return true; }
    const back = cv.state === 'halt' || cv.state === 'disarm' ? -7 : 0; const q = this._at(cv, cv.s + fa + back); tgt = [q.x - q.tz * la, q.z + q.tx * la];
    if (cv.state === 'enter') tgt = [cv.door[0] + (c.slot % 3 - 1) * 1.2, cv.door[1] + Math.floor(c.slot / 3) * 0.9];
    const d = Math.hypot(tgt[0] - c.pos[0], tgt[1] - c.pos[2]); const sp = d > 0.6 ? Math.min(c.def.run, d * 0.9 + (cv.state === 'march' ? cv.speed : 0.6)) : 0;
    const face = d > 0.6 ? Math.atan2(tgt[0] - c.pos[0], tgt[1] - c.pos[2]) : cv.state === 'halt' && cv.trap ? Math.atan2(cv.trap.x - c.pos[0], cv.trap.z - c.pos[2]) : Math.atan2(q.tx, q.tz);
    n._move(c, dt, sp, face, dist);
    if (cv.state === 'enter' && d < 2.5) this._vanish(cv, c);
    return true;
  }
  _porter(cv, c, dt, dist) {
    const g = this.g, P = g.player, n = g.npcs; const dP = Math.hypot(P.pos[0] - c.pos[0], P.pos[2] - c.pos[2]);
    if (cv.state === 'combat') { // foge correndo com a carga, longe do jogador; some quando ninguém está perto
      const ax = c.pos[0] - (cv.alertAt ? cv.alertAt[0] : P.pos[0]), az = c.pos[2] - (cv.alertAt ? cv.alertAt[1] : P.pos[2]); let yaw = Math.atan2(ax, az);
      const a = this._at(cv, Math.min(cv.L, cv.s + 30)); const along = Math.atan2(a.x - c.pos[0], a.z - c.pos[2]); if (Math.abs(angleDiff(yaw, along)) < 1.4) { yaw = along; cv.s = Math.min(cv.L, cv.s + c.def.run * dt); }
      n._move(c, dt, c.def.run, yaw, dist);
      if (dP > 90 && !n._visible({ pos: P.pos, yaw: 0 }, c.pos, 200, null)) { for (const q of cv.members) if (q.guard || q === c) g.creatures.remove(q); cv.porter = null; } return true; }
    // em marcha: anda pela estrada no ritmo da escolta
    if (cv.state === 'march') {
      // armadilha de granada na estrada à frente: para, recua e manda um soldado desarmar
      cv.scan = (cv.scan || 0) - dt; if (cv.scan <= 0) { cv.scan = 0.5; for (const pc of g.build.pieces) { if (pc.type !== 'gtrap') continue; for (let k = 0; k <= 24; k += 3) { const q = this._at(cv, cv.s + 12 + k); if (Math.hypot(pc.x - q.x, pc.z - q.z) < 5) { cv.trap = pc; cv.state = 'halt'; cv.ht = 0; break; } } if (cv.trap) break; }
        if (cv.trap) { g.audio.play('shout', { at: c.pos, f0: 140, vol: 0.9, max: 70 }); } }
      let lag = 0; for (const q of cv.members) if (!q.porter && !q.convoyFree && q.slot !== undefined) { const [fa, la] = SLOTS[q.slot]; const s = this._at(cv, cv.s + fa); lag = Math.max(lag, Math.hypot(s.x - s.tz * la - q.pos[0], s.z + s.tx * la - q.pos[2])); }
      if (cv.state === 'march') cv.s = Math.min(cv.L, cv.s + cv.speed * dt * (lag > 7 ? 0.3 : 1)); if (cv.s >= cv.L - 0.5) cv.state = 'enter'; }
    if (cv.state === 'halt') { cv.ht += dt; if (cv.ht > 2.5) { const esc = cv.members.filter((q) => !q.porter && !q.convoyFree); esc.sort((a, b) => Math.hypot(a.pos[0] - cv.trap.x, a.pos[2] - cv.trap.z) - Math.hypot(b.pos[0] - cv.trap.x, b.pos[2] - cv.trap.z)); cv.disarmer = esc[0] || null; cv.dt = 0; cv.state = cv.disarmer ? 'disarm' : 'march'; } }
    let tgt; if (cv.state === 'enter') tgt = cv.door; else { const q = this._at(cv, cv.s + (cv.state === 'halt' || cv.state === 'disarm' ? -7 : 0)); tgt = [q.x, q.z]; }
    const d = Math.hypot(tgt[0] - c.pos[0], tgt[1] - c.pos[2]); n._move(c, dt, d > 0.4 ? Math.min(c.def.run, d * 1.2 + (cv.state === 'march' ? cv.speed * 0.5 : 0)) : 0, d > 0.4 ? Math.atan2(tgt[0] - c.pos[0], tgt[1] - c.pos[2]) : null, dist);
    if (cv.state === 'enter' && d < 2.5) this._vanish(cv, c);
    return true;
  }
  // entram no alojamento e somem (só quando o jogador não está vendo)
  _vanish(cv, c) { const g = this.g, P = g.player; const dP = Math.hypot(P.pos[0] - c.pos[0], P.pos[2] - c.pos[2]); cv.waitT = (cv.waitT || 0) + 0.016;
    const seen = dP < 70 && g.npcs._visible({ pos: P.pos, yaw: g.cam.yaw }, c.pos, 70, null) && Math.abs(angleDiff(g.cam.yaw, Math.atan2(c.pos[0] - P.pos[0], c.pos[2] - P.pos[2]))) < 0.9;
    if (!seen || cv.waitT > 40) { g.creatures.remove(c); if (c === cv.porter) cv.porter = null; } }
  // barulho de tiro/explosão perto do comboio
  hear(pos, r) { for (const cv of this.list) { if (cv.state === 'combat') continue; if (cv.members.some((c) => Math.hypot(c.pos[0] - pos[0], c.pos[2] - pos[2]) < Math.min(r, 110))) this.alert(cv, pos, 'tiro'); } }
  onHurt(c) { if (c.convoy && c.convoy.state !== 'combat') this.alert(c.convoy, this.g.player.pos, 'ferido'); }
  onKilled(c) { const g = this.g; if (!c.porter) return; // a carga do carregador fica no chão
    const items = [['ammo555', 30 + Math.floor(Math.random() * 40)], ['medkit', 2], ['hg_frag', 2], ['hg_flash', 1], ['hg_smoke', 1], ['canned', 4], ['water', 4], ['radpills', 1], ['scope4', 1], ['vest', 1], ['milhelmet', 1], ['gearbox', 1], ['circuit', 3], ['bandage', 4]];
    g.drops.push({ items, x: c.pos[0] + 0.8, y: g.world.height(c.pos[0] + 0.8, c.pos[2]), z: c.pos[2], pack: 'pack_large', rot: c.yaw }); }
  render(items, mesh) { for (const cv of this.list) { const c = cv.porter; if (!c) continue; const I = c.skel.index; const W = mat4.mul(mat4.create(), c.model, c.anim.world[I.chest]);
      const m = W; items.push({ mesh, model: m, sphere: [c.pos[0], c.pos[1] + 1.4, c.pos[2], 2] }); } }
}
