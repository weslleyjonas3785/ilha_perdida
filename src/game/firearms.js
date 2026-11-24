// Sistema de armas de fogo: mirar sobre o ombro (botão direito), disparo hitscan a partir da mira
// com dispersão, recuo de câmera, dano por região do corpo (cabeça/tronco/membros), queda de dano
// com a distância, recarga com animação e eventos sonoros, impactos por superfície, ruído que atrai inimigos.
import { mat4, quat, clamp } from '../engine/math.js';
import { GRIPS } from './gunrig.js';
import { ITEMS } from './items.js';
import { GUNS, SCOPES } from './weapons.js';

const REGION = (name) => /head|skull|visor/i.test(name) ? 'head' : /neck/i.test(name) ? 'neck' : /hips|spine|chest|body|torso|abd|thorax|pelvis|root/i.test(name) ? 'torso' : 'limb';
const MULT = { head: 2.4, neck: 1.6, torso: 1.0, limb: 0.65 };

export class Firearms {
  constructor(game) {
    this.g = game; this.mags = {}; this.reloading = null; this.cool = 0; this.bloom = 0; this.aimT = 0; this.aiming = false;
    this.flash = 0; this.hitMark = 0; this.hitKill = false; this.lastHitRegion = null; this.recoilV = 0; this.shots = 0;
  }
  get gunId() { const h = this.g.equip.hand; return h && GUNS[h] ? h : null; }
  get gun() { const id = this.gunId; return id ? GUNS[id] : null; }
  mag(id = this.gunId) { if (!id) return 0; if (GUNS[id].direct) return this.g.inv.count(GUNS[id].ammo); if (this.mags[id] === undefined) this.mags[id] = 0; return this.mags[id]; }
  reserve(id = this.gunId) { return id ? this.g.inv.count(GUNS[id].ammo) : 0; }
  save() { return { ...this.mags, _gl: GUNS.gl ? GUNS.gl.ammo : undefined }; }
  load(m) { this.mags = m && typeof m === 'object' ? { ...m } : {}; this.reloading = null; if (GUNS.gl) GUNS.gl.ammo = this.mags._gl && ITEMS[this.mags._gl] ? this.mags._gl : 'gren_he'; delete this.mags._gl; }
  // T: troca o tipo de munição (lança-granadas); a granada carregada volta para a mochila
  cycleAmmo() { const g = this.g, gun = this.gun, id = this.gunId; if (!gun || !gun.ammoTypes) return; const L = gun.ammoTypes; let k = L.indexOf(gun.ammo);
    for (let n = 1; n <= L.length; n++) { const nx = L[(k + n) % L.length]; if (g.inv.count(nx) > 0 || n === L.length) { k = (k + n) % L.length; break; } }
    const nx = L[k]; if (nx === gun.ammo && this.mag(id) > 0) { g.ui.toast(`Só tem ${ITEMS[nx].name}`, 'info'); return; }
    if (this.mag(id) > 0) { g.inv.add(gun.ammo, this.mag(id)); this.mags[id] = 0; } gun.ammo = nx; this.reloading = null; g.audio.play('click'); g.ui.toast(`Munição: ${ITEMS[nx].name}`, 'info'); if (g.inv.count(nx) > 0) setTimeout(() => this.reload(), 0); }

  // Chamado a cada quadro. Retorna true quando a arma consumiu a entrada (sem ataque corpo a corpo/bloqueio).
  update(dt, act, blocked) {
    const g = this.g, P = g.player, gun = this.gun, id = this.gunId;
    this.cool = Math.max(0, this.cool - dt); this.flash = Math.max(0, this.flash - dt); this.hitMark = Math.max(0, this.hitMark - dt);
    this.bloom = Math.max(0, this.bloom - dt * 2.2);
    const canUse = gun && !P.dead && !P.swimming && !P.climb && !P.sleeping && !g.build.mode;
    this.aiming = !!(canUse && !blocked && act.block && !P.sprinting);
    this.aimT = clamp(this.aimT + (this.aiming ? dt / 0.16 : -dt / 0.2), 0, 1);
    // luneta encaixada: abre a mira enquanto o botão direito está segurado; a roda ajusta a ampliação
    const sc = gun && g.attach && g.attach[id] && SCOPES[g.attach[id]]; this.scope = sc ? g.attach[id] : null; this.scopes = this.scopes || {};
    if (sc) { let m = this.scopes[id] ?? sc.mag; if (this.aiming && this.aimT > 0.5 && g.input.mouse.wheel) m = clamp(m - Math.sign(g.input.mouse.wheel) * 0.5, sc.min, sc.max); this.scopes[id] = Math.min(sc.max, Math.max(sc.min, m)); this.magX = this.scopes[id]; }
    this.scoped = !!sc && this.aimT > 0.05;
    P.aiming = this.aiming; g.cam.aimZoom = sc ? 1 / this.magX : gun && gun.hold === 'rifle' ? 0.7 : 0.78; g.cam.scopeT = sc ? this.aimT : 0;
    // postura da arma (camada sobre a locomoção)
    const C = P.clips;
    if (canUse && C.rifleHold) { const rifle = gun.hold === 'rifle'; P.anim.setOverlay(this.aiming ? (rifle ? C.rifleAim : C.pistolAim) : (rifle ? C.rifleHold : C.pistolHold), C.masks.upper, 0.14); }
    else if (g.equip.hand === 'geiger' && C.pistolHold && !P.dead && !P.swimming && !P.climb && !P.sleeping && !g.build.mode) { const pt = !!(act.block && !blocked && !P.sprinting); P.aiming = pt; P.anim.setOverlay(pt ? C.pistolAim : C.pistolHold, C.masks.upper, 0.18); } // contador Geiger apontado como uma pistola
    else P.anim.setOverlay(null, null, 0.2);
    // inclinação do tronco acompanhando a mira (para cima/baixo) e recuo visual
    this.recoilV = Math.max(0, this.recoilV - dt * 6);
    const I = P.assets.skel.index;
    const GR = canUse && !gun.direct && GRIPS[gun.model]; const rifleCls = GR && GR.cls === 'rifle';
    if (canUse && I.spine !== undefined) { const pk = g.cam.pitch * 0.3 * this.aimT; const tw = rifleCls ? -0.38 - 0.12 * this.aimT : 0; // postura de lado (ombro esquerdo à frente) com fuzis
      P.anim.extra.set(I.spine, quat.fromEuler(pk, tw * 0.4, 0)); P.anim.extra.set(I.chest, quat.fromEuler(pk - this.recoilV * 0.15, tw * 0.6, 0)); if (I.neck !== undefined) P.anim.extra.set(I.neck, quat.fromEuler(rifleCls ? 0.14 * this.aimT : 0, -tw * 0.85, rifleCls ? -0.16 * this.aimT : 0)); } // fuzil: cabeça encosta na coronha para mirar
    else if (I.spine !== undefined) { P.anim.extra.delete(I.spine); P.anim.extra.delete(I.chest); if (I.neck !== undefined) P.anim.extra.delete(I.neck); }
    // empunhadura por IK (mãos presas no punho e no guarda-mão) + fase da recarga
    if (P.rig) { const a = P.anim.action, C2 = P.clips; let reload = null;
      if (this.reloading && a && (a.clip === C2.reloadRifle || a.clip === C2.reloadPistol || a.clip === C2.loadShell)) reload = { ph: Math.min(1, a.time / a.clip.duration), kind: gun.perShell ? 'shell' : gun.perItem ? 'harpoon' : 'mag' };
      const busyOther = a && !reload && !a.ending; P.rig.set({ active: !!GR && !busyOther && !P.swimming && !P.climb && !P.dead && !P.sleeping, model: gun && gun.model, aimT: this.aimT, pitch: g.cam.pitch, recoil: this.recoilV, sprint: P.sprinting && !this.aiming, reload }); }
    // arpão-gancho: testa se o ponto sob a mira está ao alcance (mira verde) ou não (vermelha)
    this.grappleOK = false; this.grappleDist = 0;
    if (canUse && gun.grapple) { const o = this._aimOrigin(), d = this._rayDir(); this._dryTrace = true; const h = this._worldTrace(o, d, gun.range); this._dryTrace = false; this.grappleOK = !!h; this.grappleDist = h ? h.t : 0; }
    if (!canUse) { if (this.reloading) this.reloading = null; return false; }
    if (blocked) return true;
    if (act.reload) this.reload(); if (act.ammoNext) this.cycleAmmo();
    const trig = gun.auto ? act.useHeld : act.use;
    if (trig && gun.grapple && g.grapple.busy) { if (act.use) g.grapple.release(); }
    else if (trig && !this.reloading && this.cool <= 0) {
      if (this.mag(id) <= 0) { if (act.use) { g.audio.play('dryfire'); if (this.reserve(id) > 0) this.reload(); else g.ui.toast(`Sem munição (${ITEMS[gun.ammo].name})`, 'warn'); } this.cool = 0.25; }
      else this.fire();
    }
    if (!act.useHeld) this.shots = 0;
    return true;
  }

  reload() {
    const g = this.g, P = g.player, id = this.gunId, gun = this.gun; if (!gun || this.reloading) return;
    if (gun.direct) return; // o arco puxa a flecha direto da mochila
    if (gun.perItem && this.mag(id) > 0) { g.ui.toast(`Ainda restam ${this.mag(id)} disparo(s) no arpão`, 'info'); return; }
    if (this.mag(id) >= gun.mag) return; if (this.reserve(id) <= 0) { g.ui.toast(`Sem ${ITEMS[gun.ammo].name} na mochila`, 'warn'); return; }
    if (P.anim.busy) P.anim.stopAction(0.05);
    const C = P.clips; const clip = gun.perShell ? C.loadShell : gun.hold === 'rifle' ? C.reloadRifle : C.reloadPistol;
    this.reloading = { id };
    const finish = () => {
      if (!this.reloading || this.reloading.id !== id || this.gunId !== id) { this.reloading = null; return; }
      if (gun.perItem) { if (this.reserve(id) > 0) { g.inv.remove(gun.ammo, 1); this.mags[id] = gun.perItem; } this.reloading = null; return; }
      const need = gun.perShell ? 1 : gun.mag - this.mag(id); const got = Math.min(need, this.reserve(id));
      if (got > 0) { g.inv.remove(gun.ammo, got); this.mags[id] = this.mag(id) + got; }
      this.reloading = null;
      if (gun.perShell && this.mag(id) < gun.mag && this.reserve(id) > 0 && this.gunId === id) setTimeout(() => this.reload(), 0);
      else if (gun.perShell) { g.audio.play('pump'); P.rig && P.rig.pump(); }
    };
    const speed = clip.duration / gun.reload;
    P.anim.playAction(clip, { mask: C.masks.arms ? new Set([...C.masks.arms, I_(P, 'chest'), I_(P, 'spine'), I_(P, 'head'), I_(P, 'neck')]) : C.masks.upper, speed, fadeIn: 0.1, fadeOut: 0.18,
      onEvent: (n) => { if (n === 'magOut') { g.audio.play('magOut'); P.rig && P.rig.dropMag(); } if (n === 'magIn') { g.audio.play('magIn'); if (gun.perShell) finish(); } if (n === 'bolt') { g.audio.play('bolt'); if (!gun.perShell) finish(); } },
      onEnd: () => { if (this.reloading && this.reloading.id === id) finish(); } });
    P.fullBodyAction = false; P.faceCam = false;
  }

  _aimOrigin() { const P = this.g.player, e = this.g.cam.eye, d = this._rayDir(); const piv = [P.pos[0], P.pos[1] + 1.5, P.pos[2]]; const t0 = Math.max(0, (piv[0] - e[0]) * d[0] + (piv[1] - e[1]) * d[1] + (piv[2] - e[2]) * d[2]); return [e[0] + d[0] * t0, e[1] + d[1] * t0, e[2] + d[2] * t0]; }
  _rayDir() { const c = this.g.cam; const d = [c.target[0] - c.eye[0], c.target[1] - c.eye[1], c.target[2] - c.eye[2]]; const l = Math.hypot(...d); return d.map((x) => x / l); }
  muzzle() { const gun = this.gun; return mat4.transformPoint(this.g.player.toolModel, gun ? gun.muzzle : [0, 0, 0.5]); }

  fire() {
    const g = this.g, P = g.player, id = this.gunId, gun = this.gun, cam = g.cam;
    if (gun.direct) g.inv.remove(gun.ammo, 1); else this.mags[id] = this.mag(id) - 1; this.cool = gun.rate; this.shots++;
    const moving = Math.hypot(P.vel[0], P.vel[2]);
    const spread = (this.aiming ? gun.spread : gun.hipSpread) * (1 + this.bloom * 2.2 + moving * 0.12 + (P.crouch ? -0.35 : 0) + (P.onGround ? 0 : 1.5));
    const dir0 = this._rayDir();
    // origem: ponto do raio da câmera mais próximo do ombro (evita acertar obstáculos atrás do jogador)
    const piv = [P.pos[0], P.pos[1] + 1.5, P.pos[2]]; const e = cam.eye;
    const t0 = Math.max(0, (piv[0] - e[0]) * dir0[0] + (piv[1] - e[1]) * dir0[1] + (piv[2] - e[2]) * dir0[2]);
    const origin = [e[0] + dir0[0] * t0, e[1] + dir0[1] * t0, e[2] + dir0[2] * t0];
    const mz = this.muzzle();
    if (gun.grapple) { g.grapple.fire(origin, dir0, mz, gun); g.audio.play('harpoon'); cam.pitch = clamp(cam.pitch - gun.recoil, -1.15, 1.2); this.recoilV = Math.min(1.5, this.recoilV + 0.3); return; }
    // balística: cada bala/flecha é um projétil físico. Sai da boca do cano rumo ao ponto sob a mira
    // e cai com a gravidade: de longe é preciso mirar acima do alvo (calibres mais rápidos caem menos)
    for (let k = 0; k < gun.pellets; k++) {
      // o projétil segue a linha da mira (sem paralaxe entre cano e câmera); só a gravidade o desvia
      const d = jitter(dir0, spread);
      g.spawnShot(origin, d.map((x) => x * gun.speed), { dmg: gun.dmg, arrow: !!gun.direct, drag: gun.drag || 0, falloff: gun.falloff, range: gun.range, tracer: !gun.direct && !gun.boom && k < 3, from: mz, boom: gun.boom, btype: gun.ammo, grav: gun.grav });
    }
    if (gun.boom) { this.flash = 0.08; g.gunLight = { pos: mz, t: 0.08 }; g.fx.burst(mz, 14, [0.6, 0.6, 0.6], 1.6, 1.0, 0.12, -0.6); g.fx.burst(mz, 8, [6, 3.5, 1.2], 2.5, 0.08, 0.08, 0);
      if (gun.boom === 'rocket') { const P0 = g.player.pos, f = [Math.sin(g.player.yaw), Math.cos(g.player.yaw)]; g.fx.burst([P0[0] - f[0] * 1.2, P0[1] + 1.4, P0[2] - f[1] * 1.2], 22, [0.7, 0.7, 0.7], 3, 1.2, 0.18, -0.5); }
      g.audio.play(gun.sound, { vol: 1 }); cam.pitch = clamp(cam.pitch - gun.recoil, -1.15, 1.2); cam.shake = Math.max(cam.shake, 0.3); this.recoilV = Math.min(1.5, this.recoilV + gun.recoil * 10); g.creatures.hearShot && g.creatures.hearShot(P.pos, 90); return; }
    if (gun.projectile) { g.audio.play(gun.sound); this.bloom = Math.min(1.5, this.bloom + 0.3); cam.pitch = clamp(cam.pitch - gun.recoil, -1.15, 1.2); this.recoilV = Math.min(1.5, this.recoilV + 0.15); return; }
    // efeitos: clarão na boca do cano, luz, fumaça, cápsula, som, recuo
    this.flash = 0.06; g.gunLight = { pos: mz, t: 0.06 };
    g.fx.burst(mz, 5, [7, 4.5, 1.8], 1.5, 0.05, 0.07, 0); g.fx.burst(mz, 3, [0.5, 0.5, 0.5], 0.6, 0.6, 0.06, -0.6);
    g.audio.play(gun.sound, { vol: 1, rate: gun.pitch || 1 }); if (!gun.perShell) g.audio.play('shell', { vol: 0.6 });
    if (this.g.player.rig) this.g.player.rig.onShot(gun, gun.model);
    if (gun.perShell) setTimeout(() => this.g.audio.play('pump'), 380);
    if (gun.bolt) setTimeout(() => this.g.audio.play('bolt'), 450);
    const kick = gun.recoil * (this.aiming ? 0.8 : 1) * (P.crouch ? 0.75 : 1) * (1 + Math.min(this.shots, 8) * 0.06);
    cam.pitch = clamp(cam.pitch - kick, -1.15, 1.2); cam.yaw += (Math.random() - 0.5) * kick * 0.6;
    cam.shake = Math.max(cam.shake, gun.pellets > 1 ? 0.35 : 0.12); this.recoilV = Math.min(1.5, this.recoilV + gun.recoil * 12);
    this.bloom = Math.min(1.5, this.bloom + (gun.auto ? 0.18 : 0.35));
    // o barulho do tiro atrai androides num raio grande
    g.creatures.hearShot && g.creatures.hearShot(P.pos, gun.pellets > 1 ? 70 : gun.bolt ? 140 : 85);
  }

  // Raio contra criaturas (esferas por osso, região do corpo) e contra o mundo (terreno/colisores)
  trace(o, d, range) {
    const g = this.g; let best = null;
    const w = this._worldTrace(o, d, range); if (w) best = w;
    const maxT = best ? best.t : range; const tmp = mat4.create();
    for (const c of g.creatures.list) {
      if (c.dead) continue; const sc = c.def.scale; const cx = c.pos[0] - o[0], cy = c.pos[1] + sc * 0.9 - o[1], cz = c.pos[2] - o[2];
      const tc = cx * d[0] + cy * d[1] + cz * d[2]; if (tc < 0 || tc > maxT + 3) continue;
      const br = 1.8 * sc + (c.def.radius || 0.5); const dx = cx - d[0] * tc, dy = cy - d[1] * tc, dz = cz - d[2] * tc; if (dx * dx + dy * dy + dz * dz > br * br) continue;
      const bones = c.skel.bones; const rad = Math.max(0.09, (c.def.radius || 0.4) * 0.55) * Math.min(1.6, sc);
      for (let i = 0; i < bones.length; i++) {
        // zonas de acerto: cabeça centrada no crânio (acima do osso), pescoço estreito, tronco largo, membros finos
        const reg = REGION(bones[i].name); mat4.mul(tmp, c.model, c.anim.world[i]);
        const up = reg === 'head' ? rad * 0.5 : 0; const bx = tmp[12] + tmp[4] * up - o[0], by = tmp[13] + tmp[5] * up - o[1], bz = tmp[14] + tmp[6] * up - o[2];
        const r = reg === 'head' ? rad * 0.95 : reg === 'neck' ? rad * 0.5 : reg === 'limb' ? rad * 0.8 : rad * 1.15;
        const tb = bx * d[0] + by * d[1] + bz * d[2]; if (tb < 0) continue;
        const ex = bx - d[0] * tb, ey = by - d[1] * tb, ez = bz - d[2] * tb; const d2 = ex * ex + ey * ey + ez * ez; if (d2 > r * r) continue;
        const th = tb - Math.sqrt(r * r - d2); if (th < (best ? best.t : range)) best = { t: th, p: [o[0] + d[0] * th, o[1] + d[1] * th, o[2] + d[2] * th], c, region: reg };
      }
    }
    return best;
  }
  _worldTrace(o, d, range) {
    const g = this.g, ph = g.physics, w = g.world, step = 0.2, inCave = g.player.inCave;
    for (let t = step; t <= range; t += step) {
      const x = o[0] + d[0] * t, y = o[1] + d[1] * t, z = o[2] + d[2] * t;
      if (y < w.height(x, z)) { let a = t - step, b = t; for (let k = 0; k < 6; k++) { const m = (a + b) / 2; if (o[1] + d[1] * m < w.height(o[0] + d[0] * m, o[2] + d[2] * m)) b = m; else a = m; } return { t: b, p: [o[0] + d[0] * b, o[1] + d[1] * b, o[2] + d[2] * b], surf: w.caveAt(x, z) ? 'stone' : g.surfaceAt([x, y, z]) }; }
      for (const c of ph.query(x, z, 0.3)) {
        if (c.ghost || c.dyn || c.creature || c.player) continue; if (y < c.y0 || y > c.y1) continue; if (!ph.insideXZ(c, x, z, 0)) continue;
        if (c.glass) { if (!this._dryTrace) g.breakGlass(c.glass, [x, y, z]); continue; } // vidro quebra e a bala segue
        return { t, p: [x, y, z], col: c, surf: c.tree ? 'wood' : c.rock ? 'stone' : c.piece ? (c.piece.type === 'wall' || c.piece.type === 'door' || c.piece.type === 'floor' || c.piece.type === 'chest' ? 'wood' : 'stone') : 'metal' };
      }
      if (inCave && ph.pointBlocked(x, y, z, 0, inCave)) return { t, p: [x, y, z], surf: 'stone' };
    }
    return null;
  }
  _impact(h) {
    const g = this.g, s = h.surf; const vol = clamp(1 - Math.hypot(h.p[0] - g.player.pos[0], h.p[2] - g.player.pos[2]) / 60, 0.15, 1);
    if (s === 'wood') { g.fx.burst(h.p, 8, [0.55, 0.4, 0.25], 2.5, 0.6, 0.03); g.audio.play('impactWood', { vol }); }
    else if (s === 'metal') { g.fx.burst(h.p, 8, [3, 2.2, 1], 5, 0.2, 0.02, 6); g.fx.burst(h.p, 3, [0.4, 0.4, 0.42], 1, 0.6, 0.05, -0.5); g.audio.play('impactMetal', { vol }); }
    else if (s === 'stone') { g.fx.burst(h.p, 8, [0.6, 0.58, 0.55], 3, 0.5, 0.035); g.fx.burst(h.p, 3, [2.5, 2, 1.2], 4, 0.12, 0.02, 6); g.audio.play('impactMetal', { vol: vol * 0.5 }); }
    else { g.fx.burst(h.p, 10, [0.42, 0.34, 0.24], 2.5, 0.7, 0.04); g.fx.burst(h.p, 4, [0.5, 0.45, 0.38], 0.8, 1.0, 0.09, -0.3); g.audio.play('impactDirt', { vol }); }
    // árvores e rochas recebem dano leve de tiro (não derruba, mas marca)
  }
}

function I_(P, name) { return P.assets.skel.index[name]; }
function jitter(d, s) {
  if (s <= 0) return d; const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * s;
  // base ortonormal
  const up = Math.abs(d[1]) < 0.95 ? [0, 1, 0] : [1, 0, 0];
  let u = [d[1] * up[2] - d[2] * up[1], d[2] * up[0] - d[0] * up[2], d[0] * up[1] - d[1] * up[0]]; const ul = Math.hypot(...u); u = u.map((x) => x / ul);
  const v = [d[1] * u[2] - d[2] * u[1], d[2] * u[0] - d[0] * u[2], d[0] * u[1] - d[1] * u[0]];
  const o = [d[0] + (u[0] * Math.cos(a) + v[0] * Math.sin(a)) * r, d[1] + (u[1] * Math.cos(a) + v[1] * Math.sin(a)) * r, d[2] + (u[2] * Math.cos(a) + v[2] * Math.sin(a)) * r];
  const l = Math.hypot(...o); return o.map((x) => x / l);
}
