// Helicóptero militar (estilo "Huey" verde-oliva, número 07): passa pelo céu de tempos em tempos, com o som do rotor
// em estéreo (dá para saber de onde vem). Se avista o jogador (a céu aberto, sem fumaça, perto), faz a volta e fica
// circulando em cima com a porta lateral aberta: dois atiradores disparam rajadas. Esconder-se (teto, mata, fumaça)
// faz ele perder o alvo e ir embora. Matar o piloto (tiro pelo vidro da cabine, ou foguete) faz o helicóptero girar,
// cair pegando fogo, explodir e espalhar várias caixas militares com loot em volta dos destroços.
import { MeshBuilder, M, hex, shade } from '../engine/mesh.js';
import { mat4, clamp, angleDiff } from '../engine/math.js';
import { rollLoot } from './loot.js';

const OL = 0x4e5634, OLD = 0x3c4428, OLL = 0x5f6a40, BLK = 0x1c1d1f, GLASS = 0x2a3a44, WHITE = 0xd8d8d0;
const RX = Math.PI / 2;
// pontos locais (x = lado esquerdo, y = cima, z = frente)
export const PILOT = [-0.5, 1.55, 2.55], PILOT_R = 0.5; // piloto no banco direito, atrás do vidro
const GUNNERS = [[0.95, 1.15, 0.9], [0.95, 1.15, -0.4]]; // atiradores sentados na porta esquerda
const ROTOR = [0, 3.35, -0.1], TAILROT = [-0.42, 2.75, -9.2];

function digit(mb, ch, x, y, z, sx, c) { // número pintado (7 segmentos) na lateral do cone de cauda
  const S = { 0: 'abcdef', 7: 'abc' }[ch] || ''; const w = 0.42, h = 0.7, t = 0.09; mb.setColor(c, 0.9);
  const seg = { a: [0, h, w, t], b: [w / 2, h * 0.75, t, h / 2], c: [w / 2, h * 0.25, t, h / 2], d: [0, 0, w, t], e: [-w / 2, h * 0.25, t, h / 2], f: [-w / 2, h * 0.75, t, h / 2] };
  for (const k of S) { const [dz, dy, lz, ly] = seg[k]; mb.box(M(x, y + dy, z - dz * sx), 0.02, ly, lz, c); }
}
// corpo (sem rotores). o.broken: sem o cone de cauda (destroços)
export function heliBodyMesh(o = {}) {
  const mb = new MeshBuilder(); const ol = hex(OL), olD = hex(OLD), olL = hex(OLL), blk = hex(BLK), gl = hex(GLASS), wh = hex(WHITE), skin = hex(0xb88a68), uni = hex(0x55603a), hel = hex(0x3d452a);
  const B = (x, y, z, w, h, d, c, f = 0.82, r = 0.12, ry = 0, rx = 0, rz = 0) => { mb.setColor(c, f); mb.roundBox(M(x, y, z, ry, 1, rx, rz), w, h, d, c, r, 1); };
  // cabine montada por partes: vão da porta esquerda aberto (atiradores) e janelas da cabine abertas (o piloto aparece)
  B(0, 0.55, 0.4, 2.5, 0.32, 5.0, olD, 0.82, 0.1); B(0, 2.3, 0.4, 2.5, 0.42, 5.0, ol, 0.82, 0.15); // piso e teto
  B(-1.2, 1.45, -0.25, 0.1, 2.0, 3.7, ol, 0.82, 0.03); B(-1.2, 0.95, 2.25, 0.1, 1.0, 1.3, ol, 0.82, 0.03); // lado direito (baixo na cabine do piloto)
  B(1.2, 1.45, -1.65, 0.1, 2.0, 0.9, ol, 0.82, 0.03); B(1.2, 0.95, 2.25, 0.1, 1.0, 1.3, ol, 0.82, 0.03); B(1.2, 1.45, 1.67, 0.1, 2.0, 0.14, olD, 0.82, 0.02); // lado esquerdo em volta da porta
  B(0, 1.45, -2.05, 2.5, 2.0, 0.1, ol, 0.82, 0.03); // parede de trás
  mb.setColor(olD, 0.5); for (const sx of [-1, 1]) { mb.box(M(sx * 1.2, 1.95, 2.9), 0.09, 1.0, 0.09, olD); mb.box(M(sx * 1.2, 2.05, 2.25), 0.09, 0.07, 1.3, olD); } // colunas das janelas
  const dark = hex(0x17191b); mb.setColor(dark, 0.95); mb.box(M(-1.13, 1.45, -0.25), 0.03, 1.9, 3.6, dark); mb.box(M(0, 1.45, -1.98), 2.3, 1.9, 0.03, dark); mb.box(M(0, 2.07, 0.0), 2.3, 0.03, 4.0, dark); // interior escuro
  mb.setColor(hex(0x2b2d2f), 0.8); mb.box(M(-0.2, 0.95, 0.2), 1.0, 0.5, 2.6, hex(0x2b2d2f)); // banco dos atiradores
  // nariz: parte de baixo sólida, cúpula de vidro com armação
  B(0, 0.95, 3.35, 2.3, 1.0, 1.6, ol, 0.82, 0.3); B(0, 0.95, 4.05, 1.9, 0.8, 0.5, olD, 0.82, 0.25);
  mb.setColor(olD, 0.5); for (const x of [-1.12, 0, 1.12]) mb.box(M(x, 1.9, 3.45, 0, 1, x ? 0.35 : 0.5), 0.07, 1.3, 0.07, olD); mb.box(M(0, 2.45, 3.0), 2.3, 0.08, 0.08, olD); mb.box(M(0, 1.45, 4.0), 2.0, 0.07, 0.07, olD);
  mb.setColor(gl, 0.2); mb.box(M(0, 1.47, 4.02, 0, 1, 0.5), 1.9, 0.02, 0.5, gl);
  // piloto (capacete, rosto, macacão), copiloto vazio e manche
  const [px, py, pz] = PILOT; B(px, py - 0.35, pz - 0.15, 0.55, 0.7, 0.45, uni, 0.9, 0.1); mb.setColor(skin, 0.9); mb.sphere(M(px, py + 0.12, pz), 0.16, 8, 6, skin); mb.setColor(hel, 0.6); mb.sphere(M(px, py + 0.2, pz - 0.02), 0.2, 8, 6, hel); mb.setColor(blk, 0.3); mb.box(M(px, py + 0.12, pz + 0.15), 0.22, 0.07, 0.03, blk);
  mb.setColor(blk, 0.6); mb.box(M(px, py - 0.4, pz + 0.45), 0.05, 0.5, 0.05, blk); B(0, 1.1, 3.6, 1.6, 0.25, 0.4, blk, 0.6, 0.05); B(-px, py - 0.55, pz - 0.2, 0.5, 0.15, 0.45, hex(0x2b2d2f), 0.8, 0.05);
  // atiradores sentados na porta com o fuzil para fora
  for (const [gx, gy, gz] of GUNNERS) { B(gx - 0.25, gy + 0.05, gz, 0.45, 0.65, 0.42, uni, 0.9, 0.1); mb.setColor(skin, 0.9); mb.sphere(M(gx - 0.2, gy + 0.55, gz), 0.15, 8, 6, skin); mb.setColor(hel, 0.6); mb.sphere(M(gx - 0.22, gy + 0.63, gz), 0.19, 8, 6, hel);
    B(gx + 0.2, gy - 0.25, gz, 0.6, 0.2, 0.36, uni, 0.9, 0.08); B(gx + 0.5, gy - 0.6, gz, 0.18, 0.7, 0.18, uni, 0.9, 0.06); B(gx + 0.54, gy - 0.98, gz + 0.06, 0.22, 0.12, 0.3, blk, 0.7, 0.04); // pernas para fora
    mb.setColor(blk, 0.5); mb.box(M(gx + 0.35, gy + 0.2, gz), 0.95, 0.07, 0.07, blk); mb.box(M(gx + 0.15, gy + 0.08, gz), 0.25, 0.18, 0.08, blk); mb.setColor(uni, 0.9); mb.box(M(gx + 0.05, gy + 0.22, gz + 0.12), 0.45, 0.1, 0.1, uni); }
  // motor e carenagem em cima, escape
  B(0, 2.75, -0.5, 1.5, 0.75, 3.2, olL, 0.8, 0.2); B(0, 3.1, -0.2, 0.7, 0.35, 1.2, olD, 0.8, 0.1);
  mb.setColor(blk, 0.5); mb.cylinder(M(0, 2.8, -2.4, 0, 1, -RX), 0.3, 0.26, 0.6, 12, blk); mb.cylinder(M(0, 3.15, -0.1), 0.12, 0.12, 0.25, 8, blk); // escape, mastro
  // patins (esqui) com suportes
  mb.setColor(blk, 0.6); for (const sx of [-1, 1]) { mb.cylinder(M(sx * 1.35, 0.05, -1.9, 0, 1, RX), 0.07, 0.07, 4.6, 8, blk); mb.cylinder(M(sx * 1.35, 0.05, 2.7, 0, 1, RX - 0.6), 0.07, 0.07, 0.45, 8, blk);
    for (const z of [-0.9, 1.6]) mb.box(M(sx * 1.2, 0.3, z, 0, 1, 0, sx * 0.35), 0.08, 0.6, 0.1, blk); }
  if (!o.broken) heliTail(mb, wh);
  // estrela/faixa branca na porta direita e número
  mb.setColor(wh, 0.9); mb.box(M(-1.265, 1.35, -0.6), 0.02, 0.12, 1.3, wh);
  return mb.build();
}
function heliTail(mb, wh, dz = 0) {
  const ol = hex(OL), olD = hex(OLD), blk = hex(BLK); mb.setColor(ol, 0.82);
  mb.cylinder(M(0, 2.05, -9.6 + dz, 0, 1, RX), 0.24, 0.55, 7.6, 12, ol); // cone de cauda
  mb.roundBox(M(0, 2.85, -9.35 + dz, 0, 1, -0.35), 0.14, 1.6, 0.85, olD, 0.06, 1); // deriva
  mb.roundBox(M(0, 2.05, -6.9 + dz), 2.4, 0.08, 0.55, olD, 0.03, 1); // estabilizador
  mb.setColor(blk, 0.6); mb.box(M(0, 2.4, -8.0 + dz), 0.05, 0.05, 2.2, blk); // eixo
  digit(mb, '0', 0.47, 1.75, -4.5 + dz, 1, wh); digit(mb, '7', 0.43, 1.75, -5.2 + dz, 1, wh); digit(mb, '0', -0.47, 1.75, -5.2 + dz, -1, wh); digit(mb, '7', -0.43, 1.75, -4.5 + dz, -1, wh);
}
export function heliTailMesh() { const mb = new MeshBuilder(); heliTail(mb, hex(WHITE), 6); return mb.build(); } // cauda partida (destroços), centrada perto da origem
export function heliDoorMesh() { const mb = new MeshBuilder(); const ol = hex(OL), gl = hex(GLASS); mb.setColor(ol, 0.82); mb.roundBox(M(0, 0, 0), 0.08, 1.75, 2.85, ol, 0.03, 1); mb.setColor(gl, 0.2); mb.box(M(0.045, 0.4, 0.5), 0.02, 0.5, 0.9, gl); return mb.build(); }
export function heliRotorMesh(bent) { // pás do rotor principal (girando em Y)
  const mb = new MeshBuilder(); const blk = hex(0x202224), dk = hex(0x3a3c3e); mb.setColor(dk, 0.5); mb.cylinder(M(0, -0.1, 0), 0.28, 0.2, 0.3, 10, dk);
  mb.setColor(blk, 0.7); for (const s of [-1, 1]) { if (bent) { mb.box(M(s * 2.2, 0, 0), 4.2, 0.06, 0.45, blk); mb.box(M(s * 5.2, -0.5, 0, 0, 1, 0, s * 0.35), 2.2, 0.06, 0.45, blk); } else mb.box(M(s * 3.7, 0, 0), 7.2, 0.06, 0.48, blk); }
  return mb.build(); }
export function heliDiscMesh() { const mb = new MeshBuilder(); const c = hex(0x2a2c2e); mb.setColor(c, 1); mb.cylinder(M(0, 0, 0), 7.3, 7.3, 0.03, 32, c); return mb.build(); }
export function heliTailRotorMesh() { const mb = new MeshBuilder(); const blk = hex(0x202224); mb.setColor(blk, 0.7); mb.box(M(0, 0, 0), 0.06, 2.4, 0.22, blk); mb.cylinder(M(0, 0, 0, 0, 1, 0, RX), 0.1, 0.1, 0.1, 8, blk); return mb.build(); }

const SPAWN_R = 700, PASS_ALT = 58, CIRCLE_ALT = 30, CIRCLE_R = 30;
export class Helis {
  constructor(game) { this.g = game; this.list = []; this.wrecks = []; this.cool = typeof window !== 'undefined' && window.__TEST_FIXED_SPAWN ? 1e9 : 300 + Math.random() * 180; this.t = 0; }
  _ground(x, z) { const w = this.g.world; return Math.max(w.height(x, z), w.waterLevel ?? -1e9, 0); }
  // novo helicóptero vindo de longe, passando perto do jogador (o: { at: [x,z] ponto de passagem, from: ângulo })
  spawn(o = {}) {
    const g = this.g, P = g.player; const a = o.from ?? Math.random() * Math.PI * 2; const off = o.at ? [o.at[0], o.at[1]] : [P.pos[0] + (Math.random() - 0.5) * 120, P.pos[2] + (Math.random() - 0.5) * 120];
    const sx = off[0] + Math.sin(a) * SPAWN_R, sz = off[1] + Math.cos(a) * SPAWN_R; const ex = off[0] - Math.sin(a) * SPAWN_R, ez = off[1] - Math.cos(a) * SPAWN_R;
    const h = { id: (this._id = (this._id || 0) + 1), pos: [sx, this._ground(sx, sz) + PASS_ALT, sz], yaw: Math.atan2(off[0] - sx, off[1] - sz), pitch: 0, roll: 0, speed: 38, vy: 0, state: 'pass', via: off, exit: [ex, ez], passed: false,
      seen: 0, lost: 0, circT: 0, last: null, door: 0, rotA: 0, spin: 0, pilotHp: 120, gun: GUNNERS.map(() => ({ cd: 1 + Math.random(), n: 0 })), voice: null, life: 0 };
    if (o.state === 'circle') { h.state = 'circle'; h.last = [P.pos[0], P.pos[2]]; }
    this.list.push(h); return h;
  }
  model(h) { return mat4.compose(h.pos, h.yaw, 1, h.pitch, h.roll); }
  local(h, p) { return mat4.transformPoint(this.model(h), p); }
  // o jogador está à vista? (céu aberto, sem fumaça, sem teto/árvore no caminho, dentro do alcance)
  canSee(h, maxD) {
    const g = this.g, P = g.player; if (P.dead || P.hidden || (g.admin && g.admin.on.invis)) return false; const eye = [P.pos[0], P.pos[1] + (P.crouch ? 1.0 : 1.5), P.pos[2]];
    const d = Math.hypot(h.pos[0] - eye[0], h.pos[1] - eye[1], h.pos[2] - eye[2]); if (d > maxD) return false; if (P.inCave) return false;
    const from = [h.pos[0], h.pos[1] + 0.5, h.pos[2]]; const L = d; if (g.physics.rayFree(eye, from, 0.05) * L < L - 2) return false;
    if (g.smokeBlocks && g.smokeBlocks(from, eye)) return false;
    return true;
  }
  update(dt) {
    const g = this.g; this.t += dt; if (g.state !== 'playing' || g.menuMode) { for (const h of this.list) if (h.voice) { h.voice.stop(0.5); h.voice = null; } return; }
    if (!g.netClient) { this.cool -= dt; if (this.cool <= 0 && !this.list.length) { this.spawn(); this.cool = 420 + Math.random() * 300; } }
    for (const h of [...this.list]) this._tick(h, dt);
    for (const w of this.wrecks) this._wreckTick(w, dt);
  }
  _tick(h, dt) {
    const g = this.g, P = g.player; h.life += dt; const pp = [P.pos[0], P.pos[2]];
    // som do rotor (estéreo e com a distância): começa assim que o áudio estiver pronto
    if (!h.voice && g.audio.ctx && g.audio.samples && g.audio.samples.helicoptero) h.voice = g.audio.voice('helicoptero', { at: h.pos, loop: true, max: 900, vol: 1.0 });
    if (h.voice) { h.voice.at = h.pos; h.voice.mul = h.state === 'fall' ? 1.25 : 1; h.voice.update(); }
    const rotSpeed = h.state === 'fall' ? 26 : 38; h.rotA += rotSpeed * dt;
    if (h.state === 'fall') return this._fall(h, dt);
    let want = null, alt = PASS_ALT, speed = 38;
    const dP = Math.hypot(h.pos[0] - pp[0], h.pos[2] - pp[1]);
    if (h.state === 'pass' || h.state === 'leave') {
      const tgt = h.state === 'pass' && !h.passed ? h.via : h.exit; if (h.state === 'pass' && !h.passed && Math.hypot(h.pos[0] - tgt[0], h.pos[2] - tgt[1]) < 40) h.passed = true;
      want = Math.atan2(tgt[0] - h.pos[0], tgt[1] - h.pos[2]);
      if (h.state === 'pass') { const night = g.env && g.env.isNight; const range = (night ? 75 : 170) * (P.crouch ? 0.8 : 1) * (g.equip && g.equip.hand === 'torch' && night ? 2 : 1);
        if (this.canSee(h, range)) { h.seen += dt * (dP < 60 ? 1.6 : 1); if (h.seen > 1.4) this.engage(h); } else h.seen = Math.max(0, h.seen - dt * 0.5); }
      if (Math.hypot(h.pos[0] - h.exit[0], h.pos[2] - h.exit[1]) < 60 || (h.passed && dP > SPAWN_R + 100)) return this.remove(h);
    } else if (h.state === 'circle') {
      h.circT += dt; const vis = this.canSee(h, 160); if (vis) { h.last = pp.slice(); h.lost = 0; } else h.lost += dt;
      const c = h.last; const dx = c[0] - h.pos[0], dz = c[1] - h.pos[2], dc = Math.hypot(dx, dz) || 1; const ux = dx / dc, uz = dz / dc;
      // tangente com o lado esquerdo (porta aberta) virado para o centro; corrige o raio
      const tx = -uz, tz = ux, k = clamp((dc - CIRCLE_R) / 15, -1, 1); want = Math.atan2(tx + ux * k * 1.2, tz + uz * k * 1.2); alt = CIRCLE_ALT; speed = dc > CIRCLE_R + 30 ? 32 : 17;
      h.door = Math.min(1, h.door + dt * 0.6);
      if (vis && h.door > 0.9) this._shoot(h, dt);
      if (h.lost > 14 || h.circT > 100) { h.state = 'leave'; h.speed = 30; const a = Math.atan2(h.pos[0] - c[0], h.pos[2] - c[1]); h.exit = [c[0] + Math.sin(a) * SPAWN_R, c[1] + Math.cos(a) * SPAWN_R]; }
    }
    if (h.state !== 'circle') h.door = Math.max(0, h.door - dt * 0.4);
    // voo: vira com taxa limitada (inclina na curva), acelera, sobe/desce para a altitude acima do terreno
    const dy = angleDiff(h.yaw, want); const turn = clamp(dy, -0.75 * dt, 0.75 * dt); h.yaw += turn; h.roll += (clamp(-dy * 1.2, -0.45, 0.45) - h.roll) * Math.min(1, dt * 2);
    h.speed += clamp(speed - h.speed, -6 * dt, 5 * dt); h.pitch += ((h.speed / 38) * 0.12 - h.pitch) * Math.min(1, dt * 2);
    const fx = Math.sin(h.yaw), fz = Math.cos(h.yaw); h.pos[0] += fx * h.speed * dt; h.pos[2] += fz * h.speed * dt;
    const gy = Math.max(this._ground(h.pos[0], h.pos[2]), this._ground(h.pos[0] + fx * 60, h.pos[2] + fz * 60) - 10); const ty = gy + alt; h.pos[1] += clamp(ty - h.pos[1], -6 * dt, 8 * dt);
  }
  engage(h) { if (h.state === 'circle' || h.state === 'fall') return; const P = this.g.player; h.state = 'circle'; h.last = [P.pos[0], P.pos[2]]; h.lost = 0; h.circT = 0; if (!this.g.netClient) this.g.ui.toast('🚁 O helicóptero te viu! Se esconda (teto, mata fechada ou fumaça)', 'warn'); }
  _shoot(h, dt) {
    const g = this.g, P = g.player; const M0 = this.model(h);
    h.gun.forEach((s, i) => { s.cd -= dt; if (s.cd > 0) return; s.n++; if (s.n >= 6) { s.n = 0; s.cd = 1.1 + Math.random() * 0.9; } else s.cd = 0.11;
      const [gx, gy, gz] = GUNNERS[i]; const mz = mat4.transformPoint(M0, [gx + 0.85, gy + 0.2, gz]); const T = [P.pos[0], P.pos[1] + 1.1, P.pos[2]]; const d = Math.hypot(T[0] - mz[0], T[1] - mz[1], T[2] - mz[2]);
      const moving = Math.hypot(P.vel[0], P.vel[2]) > 2; const hit = Math.random() < 0.2 * clamp(1.3 - d / 90, 0.25, 1) * (moving ? 0.6 : 1) * (P.crouch ? 0.85 : 1) * (g.smokeBlocks && g.smokeBlocks(mz, T) ? 0.05 : 1);
      const aim = hit ? T : [T[0] + (Math.random() - 0.5) * 4, T[1] - 1 + Math.random() * 1.5, T[2] + (Math.random() - 0.5) * 4];
      g.fx.tracer(mz, aim); g.fx.burst(mz, 3, [3, 2, 1], 1.5, 0.08, 0.03, 0); g.audio.play('rifle', { at: mz, vol: 0.85, max: 260 });
      if (hit) g.playerHit(10, { pos: h.pos, heli: true }, { ranged: true }); else if (Math.random() < 0.5) { const gy0 = g.world.height(aim[0], aim[2]); g.fx.burst([aim[0], gy0 + 0.05, aim[2]], 5, [0.42, 0.34, 0.24], 2.5, 0.5, 0.04); } });
  }
  // tiro do jogador: retorna o acerto mais próximo (piloto pelo vidro ou a fuselagem)
  trace(o, d, maxT) {
    let best = null;
    for (const h of this.list) { const cx = h.pos[0] - o[0], cy = h.pos[1] + 1.5 - o[1], cz = h.pos[2] - o[2]; const tc = cx * d[0] + cy * d[1] + cz * d[2]; if (tc < -6 || tc > maxT + 12) continue;
      const ex = cx - d[0] * tc, ey = cy - d[1] * tc, ez = cz - d[2] * tc; if (ex * ex + ey * ey + ez * ez > 12 * 12) continue;
      const inv = mat4.invert(mat4.create(), this.model(h)); const lo = mat4.transformPoint(inv, o); const ld = mat4.transformDir ? mat4.transformDir(inv, d) : null; if (!ld) continue;
      // piloto (esfera) — atrás do vidro: o tiro pela frente/lateral da cabine acerta
      { const px = PILOT[0] - lo[0], py = PILOT[1] - lo[1], pz = PILOT[2] - lo[2]; const tb = px * ld[0] + py * ld[1] + pz * ld[2]; const qx = px - ld[0] * tb, qy = py - ld[1] * tb, qz = pz - ld[2] * tb; const d2 = qx * qx + qy * qy + qz * qz;
        if (tb > 0 && d2 < PILOT_R * PILOT_R) { const t = tb - Math.sqrt(PILOT_R * PILOT_R - d2); if (t < maxT && (!best || t < best.t)) best = { t, p: [o[0] + d[0] * t, o[1] + d[1] * t, o[2] + d[2] * t], heli: h, part: 'pilot' }; } }
      for (const [b0, b1] of [[[-1.3, 0.35, -2.1], [1.3, 2.5, 1.9]], [[-1.15, 0.35, 1.9], [1.15, 1.3, 4.4]], [[-0.8, 2.4, -2.2], [0.8, 3.2, 1.2]], [[-0.5, 1.6, -9.8], [0.5, 2.6, -2.1]], [[-0.15, 2.0, -9.9], [0.15, 3.7, -8.8]]]) {
        let t0 = -1e9, t1 = 1e9, ok = true; for (let k = 0; k < 3; k++) { if (Math.abs(ld[k]) < 1e-6) { if (lo[k] < b0[k] || lo[k] > b1[k]) { ok = false; break; } continue; } let a = (b0[k] - lo[k]) / ld[k], b = (b1[k] - lo[k]) / ld[k]; if (a > b) [a, b] = [b, a]; t0 = Math.max(t0, a); t1 = Math.min(t1, b); if (t0 > t1) { ok = false; break; } }
        if (ok && t1 > 0) { const t = Math.max(0, t0); if (t < maxT && (!best || t < best.t)) best = { t, p: [o[0] + d[0] * t, o[1] + d[1] * t, o[2] + d[2] * t], heli: h, part: 'body' }; } } }
    return best;
  }
  shot(h, part, dmg, p) { const g = this.g; if (h.state === 'fall') return false; if (h.state === 'pass') { h.seen = 99; this.engage(h); }
    if (part === 'pilot') { h.pilotHp -= dmg; g.fx.burst(p, 10, [0.55, 0.04, 0.04], 2.5, 0.5, 0.04); g.audio.play('glass', { at: p }); if (h.pilotHp <= 0) this.down(h); return true; }
    g.fx.burst(p, 8, [3, 2.2, 1], 5, 0.2, 0.02, 6); g.audio.play('impactMetal', { at: p, vol: 0.8 }); return false; }
  // explosão perto (foguete, granada do lança-granadas): derruba
  blast(p, R) { for (const h of this.list) { if (h.state === 'fall') continue; const d = Math.hypot(h.pos[0] - p[0], h.pos[1] + 1.5 - p[1], h.pos[2] - p[2]); if (d < Math.max(5, R + 3)) this.down(h); } }
  down(h) { if (h.state === 'fall') return; h.state = 'fall'; h.pilotHp = 0; h.spin = 0.5; h.vy = 0; this.g.stats && (this.g.stats.helis = (this.g.stats.helis || 0) + 1); if (!this.g.netClient) this.g.ui.toast('🚁🔥 Piloto abatido! O helicóptero está caindo', 'ok'); this.g.audio.play('alarm', { at: h.pos, vol: 0.6 }); }
  _fall(h, dt) {
    const g = this.g; h.spin = Math.min(5.5, h.spin + dt * 2.2); h.yaw += h.spin * dt; h.speed = Math.max(4, h.speed - dt * 6); h.vy -= 7 * dt; h.roll += (0.35 - h.roll) * dt; h.pitch += (0.25 - h.pitch) * dt;
    h.pos[0] += Math.sin(h.yaw * 0.15) * h.speed * dt; h.pos[2] += Math.cos(h.yaw * 0.15) * h.speed * dt; h.pos[1] += h.vy * dt;
    const ex = this.local(h, [0, 2.8, -2.4]); g.fx.parts.push({ p: ex, v: [(Math.random() - 0.5), 1, (Math.random() - 0.5)], life: 2.5, max: 2.5, col: [0.12, 0.12, 0.12], size: 0.9, grav: -0.5, smoke: true }); g.fx.burst(ex, 2, [6, 3, 0.8], 2, 0.25, 0.12, -1); g.fx.fire(ex, 1.4);
    const gy = this._ground(h.pos[0], h.pos[2]); const hitBld = g.physics.pointBlocked && g.physics.pointBlocked(h.pos[0], h.pos[1] + 0.3, h.pos[2], 0);
    if (h.pos[1] <= gy + 0.4 || hitBld) this.crash(h);
  }
  crash(h) {
    const g = this.g; const gy = this.g.world.height(h.pos[0], h.pos[2]); const p = [h.pos[0], Math.max(gy, h.pos[1] - 0.2), h.pos[2]];
    g.explode([p[0], p[1] + 1, p[2]], null, { r: 11, dmg: 320, playerDmg: 130, pr: 12, kind: 'grenade', cause: 'queda do helicóptero', vis: 'c4', crater: [5.5, 1.6], flash: 1 });
    const gy2 = g.world.height(p[0], p[2]); const w = { x: p[0], y: gy2 - 0.25, z: p[2], yaw: h.yaw, burn: 240, t: 0, tail: [p[0] + Math.sin(h.yaw + 2.4) * 7, p[2] + Math.cos(h.yaw + 2.4) * 7, h.yaw + 1.1] };
    w.tail.splice(2, 0, g.world.height(w.tail[0], w.tail[1]));
    w.col = g.physics.add({ type: 'box', x: w.x, z: w.z, hx: 1.3, hz: 2.8, rot: w.yaw, y0: w.y, y1: w.y + 2.9 }); this.wrecks.push(w);
    // caixas militares espalhadas em volta dos destroços
    const n = 6 + Math.floor(Math.random() * 3); for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 + Math.random() * 0.5, r = 5 + Math.random() * 5; const x = p[0] + Math.sin(a) * r, z = p[2] + Math.cos(a) * r;
      const items = rollLoot('milcrate', Math.random, {}).filter(([, q]) => q > 0); if (i === 0) items.push(['rifle', 1], ['ammo555', 60]); if (i === 1) items.push(['mag_fa2', 1], ['sil_rifle', 1]); if (!items.length) items.push(['medkit', 1]);
      g.drops.push({ items, x, y: g.world.height(x, z), z, box: true, rot: Math.random() * 6.28, heli: true }); }
    if (h.voice) h.voice.stop(1.2); this.list.splice(this.list.indexOf(h), 1);
    g.noise && g.noise(p, 200, 'explosão');
    if (!g.netClient) g.ui.toast('💥 O helicóptero caiu! Caixas militares espalhadas perto dos destroços', 'ok');
  }
  _wreckTick(w, dt) { const g = this.g, P = g.player; w.t += dt; if (w.burn <= 0) return; w.burn -= dt; const d = Math.hypot(P.pos[0] - w.x, P.pos[2] - w.z);
    if (d < 180) { const f = Math.min(1, w.burn / 30); g.fx.fire([w.x, w.y + 1.8, w.z], 2.2 * f); g.fx.fire([w.x + Math.sin(w.yaw) * 2, w.y + 1.2, w.z + Math.cos(w.yaw) * 2], 1.5 * f); if (Math.random() < dt * 8) g.fx.parts.push({ p: [w.x, w.y + 3, w.z], v: [(Math.random() - 0.5) * 0.6, 2.2, (Math.random() - 0.5) * 0.6], life: 4, max: 4, col: [0.1, 0.1, 0.1], size: 1.4, grav: -0.4, smoke: true }); }
    if (d < 3.2 && !P.dead && Math.abs(P.pos[1] - w.y) < 3) { w.hurt = (w.hurt || 0) + dt; if (w.hurt > 0.5) { w.hurt = 0; g.damage(5, 'fogo dos destroços'); } } }
  remove(h) { if (h.voice) h.voice.stop(1.5); const i = this.list.indexOf(h); if (i >= 0) this.list.splice(i, 1); }
  clear() { for (const h of this.list) if (h.voice) h.voice.stop(0.2); this.list = []; for (const w of this.wrecks) if (w.col) this.g.physics.remove && this.g.physics.remove(w.col); this.wrecks = []; }
  // fontes de fumaça (coluna preta dos destroços pegando fogo)
  smokeSources() { return this.wrecks.filter((w) => w.burn > 0).map((w) => ({ x: w.x, y: w.y + 1.5, z: w.z, cov: false, seed: (w.x * 0.13) % 1, heli: true })); }
  lights(lights, eye) { for (const w of this.wrecks) if (w.burn > 0 && Math.hypot(w.x - eye[0], w.z - eye[2]) < 140) lights.push({ pos: [w.x, w.y + 2.5, w.z], range: 18, col: [3.4 * (0.85 + 0.15 * Math.sin(this.t * 13)), 1.6, 0.45] }); }
  render(items, eye) {
    const g = this.g, r = g.renderer; if (!this.m) this.m = { body: r.createMesh(heliBodyMesh()), broken: r.createMesh(heliBodyMesh({ broken: true })), tail: r.createMesh(heliTailMesh()), door: r.createMesh(heliDoorMesh()), rotor: r.createMesh(heliRotorMesh()), bent: r.createMesh(heliRotorMesh(true)), disc: r.createMesh(heliDiscMesh()), trot: r.createMesh(heliTailRotorMesh()) };
    const m = this.m;
    for (const h of this.list) { const d = Math.hypot(h.pos[0] - eye[0], h.pos[2] - eye[2]); if (d > 1400) continue; const M0 = this.model(h); const sph = [h.pos[0], h.pos[1] + 1.5, h.pos[2], 11];
      items.push({ mesh: m.body, model: M0, sphere: sph, fogMul: 0.6 });
      items.push({ mesh: m.door, model: mat4.mul(mat4.create(), M0, mat4.compose([1.3, 1.45, 0.2 - h.door * 2.5], 0, 1)), sphere: sph });
      const rm = mat4.mul(mat4.create(), M0, mat4.compose(ROTOR, h.rotA, 1)); items.push({ mesh: m.rotor, model: rm, sphere: sph, fogMul: 0.6 });
      items.push({ mesh: m.disc, model: mat4.mul(mat4.create(), M0, mat4.compose([ROTOR[0], ROTOR[1] + 0.02, ROTOR[2]], 0, 1)), alpha: 0.16, sphere: sph, shadow: false, fogMul: 0.6 });
      items.push({ mesh: m.trot, model: mat4.mul(mat4.create(), M0, mat4.compose(TAILROT, 0, 1, h.rotA * 1.7)), sphere: sph }); }
    for (const w of this.wrecks) { if (Math.hypot(w.x - eye[0], w.z - eye[2]) > 700) continue; const burnt = [0.42, 0.4, 0.37, 1]; const M0 = mat4.compose([w.x, w.y, w.z], w.yaw, 1, 0.06, 0.14); const sph = [w.x, w.y + 1.5, w.z, 8];
      items.push({ mesh: m.broken, model: M0, tint: burnt, sphere: sph }); items.push({ mesh: m.bent, model: mat4.mul(mat4.create(), M0, mat4.compose(ROTOR, 0.7, 1, 0.1)), tint: burnt, sphere: sph });
      items.push({ mesh: m.tail, model: mat4.compose([w.tail[0], w.tail[2] - 1.7, w.tail[1]], w.tail[3], 1, 0.08, 0.5), tint: burnt, sphere: [w.tail[0], w.tail[2], w.tail[1], 6] }); }
  }
}
