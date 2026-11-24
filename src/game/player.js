// Controlador do personagem: física (gravidade, pulo, colisão, degraus, escalada, natação),
// estados de animação com crossfade e ações (coletar, cortar, minerar, atacar, defender).
import { Animator } from '../engine/skeleton.js';
import { mat4, quat, clamp, dampAngle, angleDiff } from '../engine/math.js';
import { WATER } from './world.js';
import { GunRig } from './gunrig.js';

const RAD = 0.34, H_STAND = 1.8, H_CROUCH = 1.2, STEP = 0.5, GRAV = 22;
export class Player {
  constructor(game, assets) {
    this.game = game; this.assets = assets; this.rig = null;
    this.anim = new Animator(assets.skel); this.clips = assets.clips; this.anim.play(this.clips.idle, 0);
    this.pos = [0, 0, 0]; this.vel = [0, 0, 0]; this.yaw = 0; this.onGround = true; this.crouch = false; this.swimming = false;
    this.airTime = 0; this.jumpTime = 0; this.climb = null; this.dead = false; this.sleeping = false; this.locked = 0; this.moveSlow = 1;
    this.stats = { hp: 100, hunger: 100, thirst: 100, energy: 100, stamina: 100 }; this.staminaLock = false; this.staminaDelay = 0;
    this.blocking = false; this.attackCd = 0; this.punchAlt = false; this.speed = 0; this.lastYaw = 0; this.turnTimer = 0; this.hurtFlash = 0;
    this.model = mat4.create(); this.toolModel = mat4.create(); this.dust = []; this.alpha = 1; this.inCave = null; this.lastGroundY = 0; this.footPhase = 0;
  }
  setAssets(a) { this.assets = a; this.clips = a.clips; this.anim = new Animator(a.skel); this.anim.play(a.clips.idle, 0); }
  get height() { return this.crouch ? H_CROUCH : H_STAND; }
  setPosition(x, y, z) { this.pos = [x, y, z]; this.vel = [0, 0, 0]; }

  update(dt, act, camYaw) { this._dt = dt;
    const g = this.game, ph = g.physics, w = g.world, st = this.stats;
    this.attackCd = Math.max(0, this.attackCd - dt); this.locked = Math.max(0, this.locked - dt); this.hurtFlash = Math.max(0, this.hurtFlash - dt);
    if (this.dead) { this._physicsStep(dt, 0, 0, 0); this.anim.update(dt); this._matrices(); return; }
    if (this.sleeping) { this.anim.update(dt); this._matrices(); return; }

    // ----- escalada em andamento -----
    if (this.climb) {
      const c = this.climb; c.t += dt / c.dur; const t = Math.min(1, c.t);
      const up = clamp(t / 0.55, 0, 1), fw = clamp((t - 0.35) / 0.65, 0, 1);
      this.pos[1] = c.from[1] + (c.to[1] - c.from[1]) * (1 - (1 - up) * (1 - up));
      this.pos[0] = c.from[0] + (c.to[0] - c.from[0]) * fw; this.pos[2] = c.from[2] + (c.to[2] - c.from[2]) * fw;
      if (t >= 1) { this.climb = null; this.vel = [0, 0, 0]; this.onGround = true; }
      this.anim.update(dt); this._matrices(); return;
    }

    // ----- puxado pelo arpão-gancho -----
    if (this.grapple) { this._grappleStep(dt, act); this.anim.update(dt); this._matrices(); return; }
    // ----- entrada de movimento relativa à câmera -----
    const fx = Math.sin(camYaw), fz = Math.cos(camYaw); const rx = -fz, rz = fx;
    let wx = fx * act.mz + rx * act.mx, wz = fz * act.mz + rz * act.mx; const wl = Math.hypot(wx, wz);
    if (wl > 1) { wx /= wl; wz /= wl; }
    const moving = wl > 0.05 && this.locked <= 0;

    // carrinho: correndo (Shift) e apertando C, escorrega no chão. No plano dura pouco; em descida continua enquanto a ladeira empurrar.
    const hsNow = Math.hypot(this.vel[0], this.vel[2]);
    if (act.crouch && !this.slide && this.onGround && !this.swimming && !this.climb && act.sprint && hsNow > 5.2 && !this.anim.busy) {
      const d = [this.vel[0] / hsNow, this.vel[2] / hsNow]; this.slide = { dir: d, s: Math.max(hsNow, 7.2) + 1.8, t: 0, air: 0, lastSprint: !!act.sprint }; this.crouch = true; st.stamina = Math.max(0, st.stamina - 6); g.audio.play('land', { vol: 0.5 });
    } else if (act.crouch && !this.swimming && !this.slide) { if (this.crouch) { if (this._canStand()) this.crouch = false; } else this.crouch = true; }
    if (this.slide) return this._slideStep(dt, act);

    const wantSprint = act.sprint && moving && !this.staminaLock && !this.crouch && !this.blocking && !this.aiming && (this.anim.action ? false : true);
    let speed = (this.swimming ? (wantSprint ? 3.4 : 2.1) : this.crouch ? 1.7 : this.blocking ? 1.6 : (act.walk || act.analog < 0.55) ? 1.9 : wantSprint ? 6.9 : 4.3) * (this.weightMul || 1) * (this.webbed > 0 ? 0.35 : 1);
    const lowEnergy = st.energy < 15 ? 0.75 : 1; speed *= lowEnergy * this.moveSlow;
    if (this.anim.busy && !this.swimming) speed *= this.fullBodyAction ? 0 : 0.5;
    if (this.aiming && !this.swimming) speed = Math.min(speed, this.crouch ? 1.4 : 2.2);
    if (!moving) speed = 0;
    this.sprinting = wantSprint && speed > 5;

    // estamina
    let drain = 0; if (this.sprinting) drain = 14; if (this.swimming) drain = wantSprint ? 11 : (moving ? 2.5 : 1.5);
    if (drain > 0) { st.stamina -= drain * dt; this.staminaDelay = 0.9; } else { this.staminaDelay -= dt; if (this.staminaDelay <= 0) st.stamina += (st.energy < 15 ? 9 : 20) * dt; }
    const maxSt = st.energy < 25 ? 60 : 100; st.stamina = clamp(st.stamina, 0, maxSt);
    if (st.stamina <= 0) { this.staminaLock = true; if (this.swimming) this.game.damage(4 * dt, 'afogamento', true); }
    if (this.staminaLock && st.stamina > 25) this.staminaLock = false;

    // orientação do personagem
    const combatFace = (this.anim.busy && this.faceCam) || this.aiming;
    if (combatFace) this.yaw = dampAngle(this.yaw, camYaw, this.aiming ? 22 : 14, dt);
    else if (moving && speed > 0) this.yaw = dampAngle(this.yaw, Math.atan2(wx, wz), this.swimming ? 5 : 11, dt);
    else if (this.blocking) this.yaw = dampAngle(this.yaw, this.blockFace ?? camYaw, 10, dt);

    // pulo / escalada
    if (act.jump && this.onGround && !this.swimming && !this.anim.busy && this.locked <= 0) {
      if (this.crouch) { if (this._canStand()) this.crouch = false; }
      else if (!this._tryClimb()) {
        if (st.stamina >= 8) { this.vel[1] = 7.4; this.onGround = false; this.jumpTime = 0.32; st.stamina -= 8; this.staminaDelay = 0.9; this.anim.play(this.clips.jump, 0.08, 1, true); g.audio.play('jump'); }
      }
      if (this.climb) { this.anim.update(dt); this._matrices(); return; }
    }
    this._physicsStep(dt, wx * speed, wz * speed, speed);
    this._animate(dt);
    this.anim.update(dt); this._matrices();
  }

  _slideStep(dt, act) {
    const g = this.game, w = g.world, p = this.pos, S = this.slide; S.t += dt;
    // inclinação do terreno ao longo da direção do escorregão
    const e = 1.2, gx = (w.height(p[0] + e, p[2]) - w.height(p[0] - e, p[2])) / (2 * e), gz = (w.height(p[0], p[2] + e) - w.height(p[0], p[2] - e)) / (2 * e);
    const along = -(S.dir[0] * gx + S.dir[1] * gz); const slope = along / Math.sqrt(1 + gx * gx + gz * gz); // >0 = descida
    S.s += (9.8 * slope * 1.3 - 4.6) * dt; S.s = Math.min(S.s, 19);
    // em descida a direção puxa para o lado que desce
    const gl = Math.hypot(gx, gz); if (gl > 0.05) { const k = Math.min(1, gl * 1.6 * dt); S.dir[0] -= gx / gl * k; S.dir[1] -= gz / gl * k; const l = Math.hypot(S.dir[0], S.dir[1]); S.dir[0] /= l; S.dir[1] /= l; }
    this.yaw = dampAngle(this.yaw, Math.atan2(S.dir[0], S.dir[1]), 8, dt);
    const v = this.vel; v[0] = S.dir[0] * S.s; v[2] = S.dir[1] * S.s; const before = [p[0], p[2]];
    this._physicsStep(dt, v[0], v[2], S.s);
    const moved = Math.hypot(p[0] - before[0], p[2] - before[1]) / Math.max(dt, 1e-4); if (moved < S.s * 0.5 && S.t > 0.05) S.s = moved; // bateu em algo
    S.air = this.onGround ? 0 : S.air + dt;
    const sprintTap = !!act.sprint && !S.lastSprint && S.t > 0.1; S.lastSprint = !!act.sprint; const toRun = sprintTap && this._canStand();
    const end = S.s < 2.6 || S.air > 0.35 || this.swimming || (act.jump && S.t > 0.15) || S.t > 12 || toRun;
    if (toRun) { this.slide = null; this.crouch = false; this.sprinting = true; const sp = Math.max(S.s, 6); this.vel[0] = S.dir[0] * sp; this.vel[2] = S.dir[1] * sp; this.anim.play(this.clips.run || this.clips.walk, 0.12); return; }
    if (end) { this.slide = null; if (this._canStand()) this.crouch = false; if (act.jump && this.onGround && this.crouch === false) { this.vel[1] = 6.5; this.onGround = false; this.jumpTime = 0.3; } }
    if (this.slide) { const sp = Math.min(1, S.s / 9); this._dustAcc = (this._dustAcc || 0) + dt * 14 * sp;
      while (this._dustAcc > 1) { this._dustAcc--; const n = 2 + Math.floor(Math.random() * 3); // tufos em rajadas, como na arte
        for (let q = 0; q < n; q++) { const side = (Math.random() - 0.5) * 0.6, back = 0.15 + Math.random() * 0.35; this.dust.push({ p: [p[0] - S.dir[0] * back + S.dir[1] * side, p[1] + 0.05 + Math.random() * 0.12, p[2] - S.dir[1] * back - S.dir[0] * side], v: [-S.dir[0] * S.s * 0.12 + (Math.random() - 0.5) * 1.2, 0.6 + Math.random() * 1.1, -S.dir[1] * S.s * 0.12 + (Math.random() - 0.5) * 1.2], t: 0, life: 0.28 + Math.random() * 0.32, s0: 0.2 + Math.random() * 0.22, g: 0.82 + Math.random() * 0.14, debris: false }); }
        for (let q = 0; q < 2; q++) this.dust.push({ p: [p[0] + (Math.random() - 0.5) * 0.3, p[1] + 0.05, p[2] + (Math.random() - 0.5) * 0.3], v: [-S.dir[0] * S.s * 0.25 + (Math.random() - 0.5) * 2, 1.5 + Math.random() * 2, -S.dir[1] * S.s * 0.25 + (Math.random() - 0.5) * 2], t: 0, life: 0.5 + Math.random() * 0.3, s0: 0.03, debris: true }); } }
    this._animate(dt); this.anim.update(dt); this._matrices();
  }
  // poeira do carrinho: nuvens que crescem, sobem um pouco e somem; pedrinhas saltando
  drawDust(r, dt) {
    const D = this.dust; for (let i = D.length - 1; i >= 0; i--) { const d = D[i]; d.t += dt; if (d.t > d.life) { D.splice(i, 1); continue; } const k = d.t / d.life;
      d.v[1] -= (d.debris ? 6 : 0.6) * dt; const drag = d.debris ? 0.4 : 2.2; for (let c = 0; c < 3; c++) { d.v[c] *= Math.exp(-drag * dt); d.p[c] += d.v[c] * dt; } if (d.debris && d.p[1] < this.game.world.height(d.p[0], d.p[2])) d.v[1] = Math.abs(d.v[1]) * 0.3;
      if (d.debris) r.particle(d.p[0], d.p[1], d.p[2], 0.035, 0.32, 0.28, 0.24, 1 - k);
      else { const sz = d.s0 + Math.sqrt(k) * 0.6, a = 0.85 * (1 - k * k) * Math.min(1, d.t * 12); r.particle(d.p[0], d.p[1] + k * 0.25, d.p[2], sz, 0.9 * d.g, 0.8 * d.g, 0.7 * d.g, a); } }
  }
  _canStand() { const p = this.pos; for (const c of this.game.physics.query(p[0], p[2], 1)) { if (c.ghost || c.camOnly) continue; if (c.y0 > p[1] + H_CROUCH && c.y0 < p[1] + H_STAND && this.game.physics.insideXZ(c, p[0], p[2], RAD)) return false; } return true; }

  _tryClimb() {
    const g = this.game, ph = g.physics; const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw); const p = this.pos;
    for (const d of [0.55, 0.85]) {
      const x = p[0] + fx * d, z = p[2] + fz * d; let top = null;
      for (const c of ph.query(x, z, 0.6)) { if (c.ghost || c.noClimb || c.camOnly) continue; if (!ph.insideXZ(c, x, z, 0.05)) continue; const rel = c.y1 - p[1]; if (rel > 0.45 && rel < 1.65) top = Math.max(top ?? -1e9, c.y1); }
      const th = g.world.height(x, z); const trel = th - p[1]; if (trel > 0.45 && trel < 1.4) top = Math.max(top ?? -1e9, th);
      if (top === null) continue;
      const tx = p[0] + fx * (d + 0.45), tz = p[2] + fz * (d + 0.45);
      const tgt = [tx, top, tz]; const test = tgt.slice(); ph.resolve(test, RAD, H_STAND, 0.05);
      if (Math.hypot(test[0] - tx, test[2] - tz) > 0.05) continue; // sem espaço no topo
      const [gy] = ph.ground(tx, tz, RAD, top + 0.1, 0.2); if (Math.abs(gy - top) > 0.35) continue;
      this.climb = { from: p.slice(), to: [tx, gy, tz], t: 0, dur: 0.75 };
      this.anim.playAction(this.clips.climb, { fadeIn: 0.08, fadeOut: 0.15 }); this.fullBodyAction = true; g.audio.play('climb');
      return true;
    }
    return false;
  }

  startGrapple() { this.crouch = false; this.slide = null; this.onGround = false; this.anim.play(this.clips.fall || this.clips.jump, 0.1); this.grapple.moved = []; }
  endGrapple() { const v = this.vel; v[1] = Math.max(-3, Math.min(5, v[1] + 2.5)); v[0] *= 0.35; v[2] *= 0.35; this.airTime = 0; this.lastGroundY = this.pos[1]; }
  _grappleStep(dt, act) {
    const g = this.game, ph = g.physics, p = this.pos, v = this.vel, G = this.grapple; G.t += dt;
    const tgt = [G.p[0], G.p[1] - 1.0, G.p[2]]; const d = [tgt[0] - p[0], tgt[1] - p[1], tgt[2] - p[2]]; const L = Math.hypot(...d);
    const done = (why) => { this.grapple = null; g.grapple.hook = null; this.endGrapple(); if (why) g.ui.toast(why, 'info'); };
    if (L < 1.3 || G.t > 5 || act.jump) { if (L < 1.3) { v[1] = 4.5; } return done(); }
    const sp = Math.min(21, 8 + G.t * 30); const k = sp / L; v[0] = d[0] * k; v[1] = d[1] * k; v[2] = d[2] * k;
    this.yaw = Math.atan2(d[0], d[2]);
    const before = p.slice(); p[0] += v[0] * dt; p[2] += v[2] * dt; ph.resolve(p, 0.36, this.height, 0.3); p[1] += v[1] * dt;
    const [gy] = ph.ground(p[0], p[2], 0.36, p[1] + 0.3, 0.3); if (p[1] < gy) p[1] = gy;
    // teto
    for (const c of ph.query(p[0], p[2], 1)) if (!c.ghost && !c.camOnly && c.y0 > before[1] + 0.5 && c.y0 < p[1] + this.height && ph.insideXZ(c, p[0], p[2], 0.3)) { p[1] = Math.min(p[1], c.y0 - this.height); }
    const LIM = 5050; p[0] = Math.max(-LIM, Math.min(LIM, p[0])); p[2] = Math.max(-LIM, Math.min(LIM, p[2]));
    // travou num obstáculo: solta
    G.moved.push(Math.hypot(p[0] - before[0], p[1] - before[1], p[2] - before[2]) / Math.max(1e-4, sp * dt)); if (G.moved.length > 12) G.moved.shift();
    if (G.t > 0.4 && G.moved.length >= 12 && G.moved.reduce((a, b) => a + b, 0) / G.moved.length < 0.25) return done('Algo bloqueou o caminho da corda');
    this.onGround = false; this.airTime = 0; this.lastGroundY = p[1]; this.inCave = g.world.caveAt(p[0], p[2]);
  }
  _physicsStep(dt, vx, vz, speed) {
    const g = this.game, ph = g.physics, w = g.world, p = this.pos, v = this.vel;
    const accel = this.onGround || this.swimming ? (speed > 0 ? 14 : 18) : 3.5;
    v[0] += (vx - v[0]) * Math.min(1, accel * dt); v[2] += (vz - v[2]) * Math.min(1, accel * dt);
    const th = w.height(p[0], p[2]); const depth = WATER - th;
    // natação
    if (!this.swimming && depth > 1.35 && p[1] < WATER - 0.9) { this.swimming = true; this.crouch = false; g.audio.play('splash'); }
    if (this.swimming && depth < 1.15) this.swimming = false;
    if (this.swimming) {
      const target = WATER - 1.25; v[1] += ((target - p[1]) * 5 - v[1]) * Math.min(1, 6 * dt);
    } else if (!this.onGround) v[1] -= GRAV * dt;
    // terreno íngreme: desliza
    if (this.onGround && !this.swimming && !this.platform) {
      const n = w.normal(p[0], p[2]);
      if (n[1] < 0.62) { const s = (0.62 - n[1]) * 40; v[0] += n[0] * s * dt; v[2] += n[2] * s * dt; const into = v[0] * n[0] + v[2] * n[2]; if (into < 0) { v[0] -= n[0] * into * 0.8; v[2] -= n[2] * into * 0.8; } }
    }
    const before = [p[0], p[2]];
    { const mv = Math.hypot(v[0], v[2]) * dt, n = Math.min(8, Math.max(1, Math.ceil(mv / 0.12))); for (let k = 0; k < n; k++) { p[0] += v[0] * dt / n; p[2] += v[2] * dt / n; ph.resolve(p, RAD, this.height, this.onGround ? STEP : 0.15); } }
    p[1] += v[1] * dt;
    // limites do mundo
    const LIM = 5050; p[0] = Math.max(-LIM, Math.min(LIM, p[0])); p[2] = Math.max(-LIM, Math.min(LIM, p[2]));
    // chão
    const [gy, plat] = ph.ground(p[0], p[2], RAD, Math.max(p[1], this.lastGroundY), STEP);
    this.platform = plat;
    this.inCave = w.caveAt(p[0], p[2]);
    if (this.swimming) { if (p[1] < gy) p[1] = gy; this.onGround = false; this.airTime = 0; this._unstuck(); return; }
    if (p[1] <= gy + 0.02 || (this.onGround && v[1] <= 0 && p[1] - gy < STEP + 0.05 && p[1] > gy - 0.01)) {
      const impact = -v[1];
      if (!this.onGround && this.airTime > 0.05) this._land(impact);
      // sobe degraus suavemente / acompanha descidas
      if (gy > p[1]) p[1] = Math.min(gy, p[1] + 6 * dt + (gy - p[1]) * 0.5); else p[1] = gy;
      if (p[1] < gy - 0.2) p[1] = gy;
      v[1] = 0; this.onGround = true; this.airTime = 0; this.lastGroundY = p[1];
    } else { this.onGround = false; this.airTime += dt; this.lastGroundY = gy; }
    // cabeça bate em teto
    if (v[1] > 0) for (const c of ph.query(p[0], p[2], 1)) if (!c.ghost && !c.camOnly && c.y0 > p[1] && c.y0 < p[1] + this.height + 0.1 && ph.insideXZ(c, p[0], p[2], RAD * 0.8)) v[1] = 0;
    // anti-travamento: se estiver dentro de algo sólido, procura espaço livre
    this._unstuck();
    this.inCave = w.caveAt(p[0], p[2]);
  }
  _unstuck() {
    const ph = this.game.physics, p = this.pos;
    const inside = () => { for (const c of ph.query(p[0], p[2], 1)) { if (c.ghost || c.platform || c.camOnly) continue; if (c.y1 <= p[1] + STEP || c.y0 >= p[1] + this.height) continue; if (ph.insideXZ(c, p[0], p[2], 0)) return true; } return false; };
    if (!inside()) { this.stuckT = 0; return; }
    this.stuckT = (this.stuckT || 0) + 1; if (this.stuckT < 3) return;
    for (let r = 0.5; r < 6; r += 0.5) for (let a = 0; a < 16; a++) { const x = p[0] + Math.cos(a * 0.39) * r, z = p[2] + Math.sin(a * 0.39) * r; const q = [x, p[1], z];
      const save = p.slice(); p[0] = x; p[2] = z; if (!inside()) { p[1] = Math.max(p[1], this.game.world.height(x, z)); this.stuckT = 0; return; } p[0] = save[0]; p[2] = save[2]; void q; }
  }
  _land(impact) {
    const g = this.game;
    if (impact > 13) { g.damage((impact - 13) * 7, 'queda'); }
    if (impact > 8.5 && !this.anim.busy) { this.anim.playAction(this.clips.land, { fadeIn: 0.05, fadeOut: 0.2 }); this.locked = impact > 11 ? 0.35 : 0.12; this.fullBodyAction = false; }
    g.audio.play('land', { vol: Math.min(1, impact / 10) });
  }
  _animate(dt) {
    const C = this.clips, a = this.anim; const hs = Math.hypot(this.vel[0], this.vel[2]); this.speed = hs;
    if (!a.action) this.fullBodyAction = false;
    let clip, sp = 1;
    if (this.swimming) { clip = hs > 0.4 ? C.swim : C.swimIdle; sp = hs > 2.6 ? 1.4 : 1; }
    else if (!this.onGround && (this.airTime > 0.22 || this.jumpTime > 0)) { this.jumpTime -= dt; clip = this.jumpTime > 0 && this.vel[1] > 0 ? C.jump : C.fall; }
    else if (this.slide && C.slide) { clip = C.slide; sp = 1; }
    else if (this.crouch) { clip = hs > 0.25 ? C.crouchWalk : C.crouchIdle; sp = Math.max(0.6, hs / 1.5); }
    else if (hs < 0.2) {
      const yr = Math.abs(angleDiff(this.lastYaw, this.yaw)) / Math.max(dt, 1e-3);
      this.turnTimer = yr > 1.2 ? 0.35 : this.turnTimer - dt;
      clip = this.turnTimer > 0 ? C.turn : C.idle;
    }
    else if (hs < 2.7) { clip = C.walk; sp = hs / 1.75; }
    else if (hs < 5.4) { clip = C.run; sp = hs / 4.3; }
    else { clip = C.sprint; sp = hs / 6.9; }
    this.lastYaw = this.yaw;
    a.play(clip, clip === C.jump ? 0.08 : 0.22, sp);
    // passos sincronizados ao ciclo
    if (this.onGround && !this.swimming && hs > 0.5) {
      const st = a.states[a.states.length - 1]; if (st) { const phs = (st.time / st.clip.duration) * 2 % 1; if (phs < this.footPhase) this.game.audio.play('step', { surface: this.game.surfaceAt(this.pos), vol: this.crouch ? 0.3 : hs > 5 ? 1 : 0.6 }); this.footPhase = phs; }
    } else if (this.swimming && hs > 0.4) { const st = a.states[a.states.length - 1]; if (st) { const phs = (st.time / st.clip.duration) % 1; if (phs < this.footPhase) this.game.audio.play('swim'); this.footPhase = phs; } }
  }
  // Ações de ferramenta/ataque. type: 'chop'|'mine'|'punch'|'thrust'
  doAction(type, onHit, opts = {}) {
    if (this.anim.busy || this.attackCd > 0 || this.dead || this.swimming || this.climb) return false;
    const C = this.clips; let clip = C[type];
    if (type === 'punch') { clip = this.punchAlt ? C.punchL : C.punch; this.punchAlt = !this.punchAlt; }
    const calm = ['pickup', 'use', 'eat', 'drink', 'pillBottle', 'blister', 'cough', 'read'].includes(type);
    const st = this.stats; if (st.stamina < 5 && !calm) { this.game.ui.toast('Sem fôlego!', 'warn'); return false; }
    if (!calm) { st.stamina -= opts.cost ?? 7; this.staminaDelay = 0.9; }
    const full = type === 'pickup';
    this.fullBodyAction = full; this.faceCam = !full && !calm && opts.faceCam !== false;
    if (opts.faceYaw !== undefined) this.yaw = opts.faceYaw;
    this.anim.playAction(clip, { mask: full ? null : C.masks.upper, speed: opts.speed || 1, fadeIn: 0.08, fadeOut: 0.18,
      onEvent: (n) => onHit && onHit(n), onEnd: () => { this.fullBodyAction = false; this.prop = null; opts.onEnd && opts.onEnd(); } });
    this.attackCd = clip.duration * 0.9 / (opts.speed || 1);
    return true;
  }
  setBlocking(b) {
    if (b && !this.blocking && !this.anim.busy && !this.swimming) { this.blocking = true; this.anim.playAction(this.clips.block, { mask: this.clips.masks.upper, fadeIn: 0.12, fadeOut: 0.15 }); }
    else if (!b && this.blocking) { this.blocking = false; if (this.anim.action && this.anim.action.clip === this.clips.block) this.anim.stopAction(0.15); }
  }
  hitReact() { if (!this.anim.busy) this.anim.playAction(this.clips.hit, { mask: this.clips.masks.upper, fadeIn: 0.04, fadeOut: 0.15 }); this.hurtFlash = 0.35; }
  die() { this.dead = true; this.blocking = false; this.anim.action = null; this.anim.play(this.clips.die, 0.15); this.vel[0] = this.vel[2] = 0; }
  revive() { this.dead = false; this.anim.play(this.clips.idle, 0); this.anim.action = null; }
  _matrices() {
    mat4.fromTRS(this.model, this.pos, quat.fromEuler(0, this.yaw, 0), [1, 1, 1]);
    if (this.assets.offset) mat4.mul(this.model, this.model, this.assets.offset);
    if (!this.rig && this.assets.skel.index.upperArmL !== undefined) this.rig = new GunRig(this);
    if (this.rig && this.rig.apply(this._dt || 1 / 60)) return; // empunhadura de arma por IK
    const hand = this.anim.world[this.assets.skel.index.handR ?? 0];
    const tmp = mat4.mul(mat4.create(), this.model, hand);
    mat4.mul(this.toolModel, tmp, TOOL_OFFSET);
    if (this.assets.toolScale) { const k = this.assets.toolScale; mat4.mul(this.toolModel, this.toolModel, mat4.fromTRS(mat4.create(), [0, 0, 0], [0, 0, 0, 1], [k, k, k])); }
  }
  handWorldPos() { return mat4.transformPoint(this.toolModel, [0, 0.45, 0]); }
}
const TOOL_OFFSET = mat4.fromTRS(mat4.create(), [0, -0.08, 0.015], quat.fromEuler(Math.PI / 2, 0, 0), [1, 1, 1]);
