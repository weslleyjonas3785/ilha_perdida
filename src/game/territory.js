// Território e base: Territoritek (é fincado no chão, abre, arma e dispara uma luz bem alta que marca a área de construção),
// baús por material, trancas (madeira/ferro/ouro) que encaixam em portas, baús e armários, e o armário de manutenção que
// consome material para manter as construções de pé (sem material elas vão perdendo vida até cair).
import { mat4, quat } from '../engine/math.js';
import { ITEMS, PIECES, Inventory } from './items.js';
import { STYPES, TIERS, FLAG_R, costOf, maxHp } from './struct.js';
import * as BM from './basemeshes.js';

export const LOCKS = { lock_wood: { kind: 'wood', name: 'Tranca de madeira', hp: 150 }, lock_iron: { kind: 'iron', name: 'Tranca de ferro', hp: 450 }, lock_gold: { kind: 'gold', name: 'Tranca de ouro', hp: 1000 } };
export const CHESTS = { chest: { kind: 'wood', hp: 400, cap: 16 }, chest_wi: { kind: 'wi', hp: 1400, cap: 24 }, chest_iron: { kind: 'iron', hp: 3200, cap: 32 } };
export const isChest = (t) => !!CHESTS[t];
export const isContainer = (t) => !!CHESTS[t] || t === 'cabinet';
const LOCKABLE = (t) => isContainer(t) || t === 'door' || t === 's_doorway' || t === 's_hatch';
export const CABINET_OK = ['wood', 'stone', 'scrap', 'iron'];
const UPKEEP = 0.25; // fração do custo de cada peça gasta por dia
const DECAY_H = 0.07; // vida perdida por hora do jogo sem manutenção
// dano das explosões nos baús e trancas
const BOOM = { c4: 1500, rocket: 420, grenade: 110 };

export class Territory {
  constructor(game) { this.g = game; this.t = 0; this.aim = null; this._warnT = 0; }
  me() { return this.g.struct ? this.g.struct.myId() : 'me'; }
  cap(p) { if (p.type === 'trunk') return this.g.trunkSlots(p.veh); return p.type === 'cabinet' ? 8 : (CHESTS[p.type] || CHESTS.chest).cap; }
  deployed(f) { const d = f.data || {}; return !d.dep || d.dep === 'done'; }

  // ---------- Territoritek ----------
  onPlaced(p) { const g = this.g; if (p.type === 'flag') { p.data.dep = 'drop'; p.data.depT = 0; p.data.grace = g.env.elapsed + g.env.dayLength * 0.5; g.player.doAction('pickup', null); g.audio.play('build', { at: [p.x, p.y, p.z] }); g.ui.toast('📡 Territoritek fincado — afaste-se para ele armar', 'info'); }
    if (isContainer(p.type)) { p.data = p.data || {}; p.data.owner = this.me(); if (CHESTS[p.type]) p.data.hp = CHESTS[p.type].hp; } }
  _deploy(p, dt) { const g = this.g, d = p.data; d.depT = (d.depT || 0) + dt; const at = [p.x, p.y + 1.6, p.z]; const P = g.player;
    if (d.dep === 'drop' && d.depT > 0.9) { d.dep = 'wait'; d.depT = 0; }
    else if (d.dep === 'wait' && (Math.hypot(P.pos[0] - p.x, P.pos[2] - p.z) > 3 || d.depT > 8)) { d.dep = 'open'; d.depT = 0; g.audio.play('armando_bastao', { at, max: 80 }); }
    else if (d.dep === 'open' && d.depT > 5.6) { d.dep = 'fire'; d.depT = 0; g.audio.play('disparo', { at, max: 400, vol: 1.2 }); g.fx.burst([p.x, p.y + 2.1, p.z], 24, [6, 8, 9], 6, 0.4, 0.06, -3); }
    else if (d.dep === 'fire' && d.depT > 4) { d.dep = 'done'; delete d.depT; if (d.owner === this.me()) g.ui.toast(`📡 Território marcado: raio de ${FLAG_R} m. Agora dá para construir a base, bancadas e baús aqui.`, 'ok'); } }

  // ---------- trancas ----------
  lockOf(p) { return p && p.data && p.data.lock; }
  canOpen(p) { const L = this.lockOf(p); if (!L) return true; const me = this.me(); return L.owner === me || (L.auth || []).includes(me); }
  // abre se tiver acesso; trancado: pede a senha
  access(p, then) { const g = this.g, L = this.lockOf(p); if (this.canOpen(p)) return then();
    if (!L.code) { g.ui.toast(`🔒 Trancado (${LOCKS[L.id].name}) — só o dono abre. Dá para arrombar atirando na tranca ou com explosivo.`, 'warn'); g.audio.play('error'); return; }
    this.askCode(`🔒 ${LOCKS[L.id].name}. Digite a senha:`, (code) => { if (code === L.code) { (L.auth = L.auth || []).push(this.me()); g.audio.play('click'); g.ui.toast('🔓 Senha certa', 'ok'); then(); } else { g.ui.toast('Senha errada', 'warn'); g.audio.play('error'); } }); }
  askCode(text, done, opts = {}) { document.querySelector('.askbox')?.remove(); const d = document.createElement('div'); d.className = 'askbox'; d.innerHTML = `<div class="askin"><p>${text}</p><input class="codeIn" type="password" inputmode="numeric" maxlength="6" placeholder="••••" autocomplete="off"><div class="acts">${opts.skip ? `<button class="s">${opts.skip}</button>` : ''}<button class="y">${opts.ok || 'Abrir'}</button><button class="n">Cancelar</button></div></div>`;
    document.body.appendChild(d); const inp = d.querySelector('input'); const close = () => { d.remove(); }; this.g.input && this.g.input.exitLock && this.g.input.exitLock(); setTimeout(() => inp.focus(), 30);
    const ok = () => { const v = inp.value.trim(); close(); done(v); }; d.querySelector('.y').onclick = ok; inp.onkeydown = (e) => { e.stopPropagation(); if (e.key === 'Enter') ok(); if (e.key === 'Escape') close(); };
    d.querySelector('.n').onclick = close; const s = d.querySelector('.s'); if (s) s.onclick = () => { close(); done(''); }; return d; }
  // matriz do ponto onde a tranca fica (acompanha a folha da porta)
  isVeh(p) { return !!(p && (p.veh || (this.g.vehicles && this.g.vehicles.list.includes(p)))); }
  lockModel(p) { if (this.isVeh(p)) return this.g.vehicles.lockModel(p.veh || p); const base = p.model || mat4.fromTRS(mat4.create(), [p.x, p.y, p.z], quat.fromEuler(0, p.rot, 0), [1, 1, 1]); const T = (x, y, z, ry = 0) => mat4.fromTRS(mat4.create(), [x, y, z], quat.fromEuler(0, ry, 0), [1, 1, 1]);
    if (isChest(p.type)) return mat4.mul(mat4.create(), base, T(...BM.CHEST_LOCK)); if (p.type === 'cabinet') return mat4.mul(mat4.create(), base, T(...BM.CABINET_LOCK));
    const a = p.openAng || 0;
    if (p.type === 's_doorway') { const m = mat4.mul(mat4.create(), base, T(-0.6, 0, 0, -a)); mat4.mul(m, m, T(0.6, 0, 0)); return mat4.mul(m, m, T(0.36, 1.0, 0.075)); }
    if (p.type === 'door') { const m = mat4.mul(mat4.create(), base, T(-0.52, 0, 0, -a)); mat4.mul(m, m, T(0.52, 0, 0)); return mat4.mul(m, m, T(0.3, 1.0, 0.09)); }
    if (p.type === 's_hatch') { const m = mat4.mul(mat4.create(), base, mat4.fromTRS(mat4.create(), [0, 0, -0.6], quat.fromEuler(-(a * 1.05), 0, 0), [1, 1, 1])); return mat4.mul(m, m, mat4.fromTRS(mat4.create(), [0, 0.05, 1.05], quat.fromEuler(-Math.PI / 2, 0, 0), [1, 1, 1])); }
    return base; }
  lockPos(p) { const m = this.lockModel(p); return [m[12], m[13], m[14]]; }
  // com a tranca na mão: mira numa porta/baú/armário a até 3 m
  _aim() { const g = this.g, e = g.cam.eye, t = g.cam.target; let d = [t[0] - e[0], t[1] - e[1], t[2] - e[2]]; const l = Math.hypot(...d); d = d.map((x) => x / l); const P = g.player; let best = null, bs = 1e9;
    for (const p of g.build.pieces) { if (!LOCKABLE(p.type) || Math.hypot(p.x - P.pos[0], p.z - P.pos[2]) > 4) continue; const q = this.lockPos(p); const v = [q[0] - e[0], q[1] - e[1], q[2] - e[2]]; const tt = v[0] * d[0] + v[1] * d[1] + v[2] * d[2]; if (tt < 0) continue;
      const off = Math.hypot(v[0] - d[0] * tt, v[1] - d[1] * tt, v[2] - d[2] * tt); const dist = Math.hypot(q[0] - P.pos[0], q[1] - P.pos[1] - 1, q[2] - P.pos[2]); if (dist > 3 || off > 0.9) continue; const sc = off + dist * 0.15; if (sc < bs) { bs = sc; best = p; } }
    return best; }
  lockHand(act) { const g = this.g, id = g.equip.hand; let p = this._aim(); if (!p && !g.vehicles.driving) { const v = g.vehicles.near(g.player.pos, 3.2); if (v) p = v; } this.aim = p ? { p, id } : null; const L = p && this.lockOf(p);
    this._hint(p ? (L ? (L.owner === this.me() ? '🔓 Clique: tirar a tranca' : '🔒 Já tem tranca') : `🔒 Clique: colocar a ${LOCKS[id].name} em ${this.isVeh(p) ? g.vehicles.name(p) : PIECES[p.type].name}`) : `🔒 Mire numa porta, baú, armário ou veículo para colocar a ${LOCKS[id].name}`);
    if (!act.use) return; if (!p) { g.ui.toast('Mire numa porta, baú ou armário (até 3 m) para colocar a tranca', 'warn'); return; }
    if (L) { if (L.owner !== this.me()) return g.ui.toast('Essa tranca não é sua', 'warn'); this.removeLock(p); return; }
    if (g.inv.count(id) < 1) return; const place = (code) => { if (!g.inv.remove(id, 1)) return; p.data = p.data || {}; p.data.lock = { id, kind: LOCKS[id].kind, hp: LOCKS[id].hp, owner: this.me(), code: code || null, auth: [] };
      if (p.open && (p.type === 'door' || p.type === 's_doorway' || p.type === 's_hatch')) g.build.toggleDoor(p); g.audio.play('magIn'); g.audio.play('click'); g.player.doAction('pickup', null);
      g.ui.toast(`🔒 ${LOCKS[id].name} colocada${code ? ' com senha' : ' (só você abre)'}`, 'ok'); if (g.inv.count(id) <= 0 && g.equip.hand === id) g.equip.hand = null; if (!this.isVeh(p)) g.net && g.net.onBuild && g.net.onBuild('data', p); };
    this.askCode(`🔒 ${LOCKS[id].name}: crie uma senha (números) para amigos abrirem, ou tranque só para você.`, place, { ok: 'Trancar com senha', skip: 'Só eu abro' }); }
  _hint(t) { let el = document.getElementById('tkHint'); if (!t) { if (el) el.style.display = 'none'; return; } if (!el) { el = document.createElement('div'); el.id = 'tkHint'; document.body.appendChild(el); } el.style.display = 'block'; if (el.textContent !== t) el.textContent = t; }
  removeLock(p) { const g = this.g, L = this.lockOf(p); if (!L) return; delete p.data.lock; if (L.hp >= LOCKS[L.id].hp * 0.5) { if (g.inv.add(L.id, 1) < 1) g.dropItem(L.id, 1, [p.x, p.y + 0.5, p.z]); } g.audio.play('click'); g.ui.toast(`🔓 ${LOCKS[L.id].name} retirada`, 'ok'); if (!this.isVeh(p)) g.net && g.net.onBuild && g.net.onBuild('data', p); }
  // tiro: se acertar perto da tranca, ela vai se desgastando (madeira < ferro < ouro); o baú em si aguenta tiro
  shot(p, dmg, at) { const L = this.lockOf(p); if (!L || !at) return false; const q = this.lockPos(p); if (Math.hypot(q[0] - at[0], q[1] - at[1], q[2] - at[2]) > 0.32) return false; this.damageLock(p, dmg, at); return true; }
  damageLock(p, dmg, at) { const g = this.g, L = this.lockOf(p); if (!L) return; L.hp -= dmg; g.fx.burst(at || this.lockPos(p), 8, L.kind === 'gold' ? [5, 4, 1] : [3, 2.4, 1.2], 4, 0.25, 0.02, 6); g.audio.play('impactMetal', { at: at || this.lockPos(p), vol: 0.8 });
    if (L.hp <= 0) { delete p.data.lock; g.audio.play('glass', { at: this.lockPos(p) }); g.fx.burst(this.lockPos(p), 16, [0.4, 0.38, 0.36], 3, 0.6, 0.04); g.ui.toast(`💥 ${LOCKS[L.id].name} arrombada!`, 'ok'); }
    else this._lockHp = { p, t: 2.5 }; g.net && g.net.onBuild && g.net.onBuild('data', p); }
  // explosões: trancas e baús perdem vida; baú destruído espalha o que tinha dentro no chão
  blast(p0, R, kind) { const g = this.g, D = BOOM[kind] || 120;
    for (const p of [...g.build.pieces]) { const d = Math.hypot(p.x - p0[0], p.y + 0.4 - p0[1], p.z - p0[2]); if (d > R + 1) continue; const f = kind === 'c4' ? (d < 3 ? 1 : Math.max(0.15, 1 - (d - 3) / Math.max(1, R - 3))) : 1 - Math.min(1, d / (R + 1));
      if (this.lockOf(p)) this.damageLock(p, D * f * 1.2, this.lockPos(p));
      if (isChest(p.type)) { p.data = p.data || {}; if (p.data.hp === undefined) p.data.hp = CHESTS[p.type].hp; p.data.hp -= D * f; if (p.data.hp <= 0) this.breakChest(p); } } }
  breakChest(p) { const g = this.g; const items = (p.items || []).filter((s) => s && s[1] > 0).map((s) => [s[0], s[1]]); p.items = []; g.build.remove(p, false);
    if (items.length) g.drops.push({ items, x: p.x, y: p.y, z: p.z, rot: p.rot, box: true });
    g.fx.burst([p.x, p.y + 0.4, p.z], 30, [0.5, 0.4, 0.3], 4, 1, 0.08); g.audio.play('treefall', { at: [p.x, p.y, p.z], vol: 0.4 }); g.ui.toast(`💥 ${PIECES[p.type].name} destruído — o loot caiu no chão`, 'ok'); g.net && g.net.onBuild && g.net.onBuild('del', p); }

  // ---------- armário de manutenção ----------
  cabinetFor(f) { return this.g.build.pieces.find((p) => p.type === 'cabinet' && Math.hypot(p.x - f.x, p.z - f.z) <= FLAG_R && (!p.data || !f.data || p.data.owner === f.data.owner)); }
  flagFor(x, z, owner) { return this.g.build.pieces.find((f) => f.type === 'flag' && Math.hypot(f.x - x, f.z - z) <= FLAG_R && (!owner || (f.data && f.data.owner) === owner)); }
  structsOf(f) { return this.g.build.pieces.filter((p) => STYPES[p.type] && p.data && Math.hypot(p.x - f.x, p.z - f.z) <= FLAG_R); }
  // gasto por dia de cada material para manter as construções
  upkeep(f) { const need = {}; for (const p of this.structsOf(f)) { const c = costOf(p.type, STYPES[p.type].fixed ? 1 : (p.data.tier || 0)); for (const [k, n] of Object.entries(c)) if (CABINET_OK.includes(k)) need[k] = (need[k] || 0) + n * UPKEEP; } return need; }
  stock(cab, k) { let n = 0; for (const s of cab.items || []) if (s && s[0] === k) n += s[1]; if (k === 'scrap') for (const s of cab.items || []) if (s && s[0] === 'iron') n += s[1] * 2; return n; }
  _take(cab, k, n) { for (const id of k === 'scrap' ? ['scrap', 'iron'] : [k]) for (const s of cab.items || []) { if (!s || s[0] !== id || n <= 0) continue; const per = id === 'iron' && k === 'scrap' ? 2 : 1; const q = Math.min(s[1], Math.ceil(n / per)); s[1] -= q; n -= q * per; } cab.items = (cab.items || []).filter((s) => s && s[1] > 0); return n <= 0; }
  daysLeft(f) { const cab = this.cabinetFor(f); const need = this.upkeep(f); let days = Infinity; for (const [k, n] of Object.entries(need)) days = Math.min(days, cab ? this.stock(cab, k) / n : 0); return { need, days, cab }; }
  _upkeepTick(dt) { const g = this.g; const dayLen = g.env.dayLength; let warn = null;
    for (const f of g.build.pieces) { if (f.type !== 'flag' || !this.deployed(f)) continue; const d = f.data = f.data || {}; if (d.grace === undefined) d.grace = g.env.elapsed + dayLen * 0.5;
      const cab = this.cabinetFor(f); const need = this.upkeep(f); d.debt = d.debt || {}; const lacking = new Set();
      for (const [k, n] of Object.entries(need)) { d.debt[k] = (d.debt[k] || 0) + n * dt / dayLen; if (d.debt[k] >= 1) { const q = Math.floor(d.debt[k]); if (cab && this.stock(cab, k) >= q) { this._take(cab, k, q); d.debt[k] -= q; } else { lacking.add(k); d.debt[k] = Math.min(d.debt[k], 2); } } }
      if (!lacking.size || g.env.elapsed < d.grace) continue;
      for (const p of this.structsOf(f)) { if (!g.build.pieces.includes(p)) continue; const c = costOf(p.type, STYPES[p.type].fixed ? 1 : (p.data.tier || 0)); if (!Object.keys(c).some((k) => lacking.has(k))) continue; const mx = maxHp(p.type, p.data.tier || 0); if (p.data.hp === undefined) p.data.hp = mx;
        p.data.hp -= mx * DECAY_H * dt / (dayLen / 24); if (p.data.hp <= 0) { g.struct._break(p); g.struct.collapse(); } }
      if (d.owner === this.me()) warn = [...lacking]; }
    if (warn && (this._warnT -= dt) <= 0) { this._warnT = 60; const N = { wood: 'madeira', stone: 'pedra', scrap: 'sucata/ferro', iron: 'ferro' }; g.ui.toast(`⚠ Sua base está sem manutenção: coloque ${warn.map((k) => N[k] || k).join(', ')} no Armário — as construções estão perdendo vida`, 'warn'); } }

  update(dt, act) { const g = this.g; this.t += dt;
    for (const p of g.build.pieces) if (p.type === 'flag' && p.data && p.data.dep && p.data.dep !== 'done') this._deploy(p, dt);
    if (LOCKS[g.equip.hand] && g.state === 'playing' && !g.ui.open && !document.querySelector('.askbox')) this.lockHand(act); else { this.aim = null; this._hint(null); }
    if (this._lockHp && (this._lockHp.t -= dt) <= 0) this._lockHp = null;
    if (!g.netClient) { this._acc = (this._acc || 0) + dt; if (this._acc >= 1) { this._upkeepTick(this._acc); this._acc = 0; } } }

  lights(lights, eye) { for (const p of this.g.build.pieces) { if (p.type !== 'flag') continue; const d = p.data || {}; const st = d.dep || 'done'; if (st !== 'fire' || (d.depT || 0) > 3.6) continue; const dd = Math.hypot(p.x - eye[0], p.z - eye[2]); if (dd > 160) continue; const own = (d.owner || this.me()) === this.me(); lights.push({ pos: [p.x, p.y + 2.2, p.z], range: st === 'fire' ? 30 : 9, col: own ? [1.6, 2.4, 3.0] : [3, 1.4, 1], d: dd }); } }
  _ring(p) { this._rings = this._rings || new WeakMap(); let rg = this._rings.get(p); if (!rg) { const r = this.g.renderer, hf = (x, z) => this.g.world.height(x, z);
      rg = { band: r.createMesh(BM.ringMesh(hf, p.x, p.y, p.z, FLAG_R, 0.35, 0xbfe8ff)), soft: r.createMesh(BM.ringMesh(hf, p.x, p.y, p.z, FLAG_R - 1.1, 2.2, 0xbfe8ff)) }; this._rings.set(p, rg); } return rg; }
  render(items, eye) { const g = this.g, r = g.renderer; if (!this.m) { this.m = { base: r.createMesh(BM.tkBaseMesh()), head: r.createMesh(BM.tkHeadMesh()), lid: r.createMesh(BM.tkLidMesh()), beam: r.createMesh(BM.beamMesh()), lock: {}, chest: {}, cab: r.createMesh(BM.cabinetMesh()) }; for (const k of ['wood', 'iron', 'gold']) this.m.lock[k] = r.createMesh(BM.lockMesh(k)); for (const k of ['wood', 'wi', 'iron']) this.m.chest[k] = r.createMesh(BM.chestMesh(k)); }
    const m = this.m, me = this.me(); const T = (x, y, z, ry = 0, s = 1) => mat4.fromTRS(mat4.create(), [x, y, z], quat.fromEuler(0, ry, 0), [s, s, s]);
    for (const p of g.build.pieces) { const dist = Math.hypot(p.x - eye[0], p.z - eye[2]);
      if (p.type === 'flag') { const d = p.data || {}; const st = d.dep || 'done', t = d.depT || 0; let sink = 0, rise = 0, lid = 0, beam = 0;
        if (st === 'drop') { const e = Math.min(1, t / 0.9); sink = 0.55 * (1 - e * e); rise = -0.32; } else if (st === 'wait') rise = -0.32; else if (st === 'open') { rise = -0.32 + 0.32 * Math.min(1, t / 1.3); lid = Math.min(1, Math.max(0, (t - 1.6) / 1.4)); } else { lid = 1; beam = st === 'fire' ? 1 + Math.max(0, 1 - t / 1.6) * 2 : 0; }
        const fade = st === 'fire' ? Math.max(0, Math.min(1, (4 - t) / 1.2)) : 0; // a luz marca a área e depois apaga
        if (dist < 500) { const M0 = mat4.mul(mat4.create(), p.model, T(0, -sink, 0)); items.push({ mesh: m.base, model: M0, sphere: [p.x, p.y + 1, p.z, 2] }); const hm = mat4.mul(mat4.create(), M0, T(0, 1.42 + rise, 0, (st === 'open' ? Math.min(1, t / 1.3) : 1) * 0.6)); items.push({ mesh: m.head, model: hm, sphere: [p.x, p.y + 1.6, p.z, 1] });
          if (lid < 1) items.push({ mesh: m.lid, model: mat4.mul(mat4.create(), hm, T(lid * 0.45, 0.5 + lid * 0.05, 0, lid * 1.2)), sphere: [p.x, p.y + 1.9, p.z, 1] }); }
        if (beam > 0) { const own = (d.owner || me) === me; const top = p.y + 1.42 + 0.5; const H = 260; const w = st === 'fire' ? 0.18 * beam : 0.13; const tint = own ? [0.75, 0.95, 1.1, 1] : [1.1, 0.55, 0.45, 1];
          items.push({ mesh: m.beam, model: mat4.fromTRS(mat4.create(), [p.x, top, p.z], [0, 0, 0, 1], [w, H, w]), alpha: 0.85 * fade, tint, shadow: false, cull: false, fogMul: 0.15, sphere: [p.x, top + H / 2, p.z, H] });
          items.push({ mesh: m.beam, model: mat4.fromTRS(mat4.create(), [p.x, top, p.z], [0, 0, 0, 1], [w * 3.5, H * 0.9, w * 3.5]), alpha: 0.3 * fade, tint, shadow: false, cull: false, fogMul: 0.15, sphere: [p.x, top + H / 2, p.z, H] });}
        if ((st === 'fire' || st === 'done') && dist < 140) { const rg = this._ring(p), own = (d.owner || me) === me; const e = st === 'fire' ? Math.min(1, t / 1.6) : 1; const k = 1 - (1 - e) * (1 - e); const s = Math.max(0.02, k);
          const pulse = st === 'fire' ? 1 : 0.55 + 0.15 * Math.sin((g.env.elapsed || 0) * 2.2); const show = g.build && g.build.mode ? 1 : pulse; const tint = own ? [0.6, 0.95, 1.15, 1] : [1.15, 0.5, 0.4, 1];
          const RM = mat4.fromTRS(mat4.create(), [p.x, p.y + (1 - k) * 0.6, p.z], [0, 0, 0, 1], [s, 1, s]);
          items.push({ mesh: rg.band, model: RM, alpha: 0.8 * show, tint, shadow: false, cull: false, fogMul: 0.4, sphere: [p.x, p.y, p.z, FLAG_R + 2] });
          items.push({ mesh: rg.soft, model: RM, alpha: 0.09 * show, tint, shadow: false, cull: false, fogMul: 0.4, sphere: [p.x, p.y, p.z, FLAG_R + 2] }); }
        continue; }
      if (dist > 200) continue;
      if (isChest(p.type)) items.push({ mesh: m.chest[CHESTS[p.type].kind], model: p.model, sphere: [p.x, p.y + 0.4, p.z, 1] });
      if (p.type === 'cabinet') items.push({ mesh: m.cab, model: p.model, sphere: [p.x, p.y + 0.9, p.z, 1.2] });
      const L = this.lockOf(p); if (L && dist < 80) { const lm = this.lockModel(p); items.push({ mesh: m.lock[L.kind], model: lm, sphere: [lm[12], lm[13], lm[14], 0.3] }); if (p.type === 's_doorway' || p.type === 'door') { const back = mat4.mul(mat4.create(), lm, T(0, 0, p.type === 'door' ? -0.18 : -0.15, Math.PI)); items.push({ mesh: m.lock[L.kind], model: back, sphere: [back[12], back[13], back[14], 0.3] }); } } }
    for (const v of g.vehicles.list) { const L = this.lockOf(v); if (!L || Math.hypot(v.x - eye[0], v.z - eye[2]) > 60) continue; const lm = this.lockModel(v); items.push({ mesh: m.lock[L.kind], model: lm, sphere: [lm[12], lm[13], lm[14], 0.3] }); }
    // prévia da tranca (verde) no lugar onde vai encaixar
    if (this.aim && !this.lockOf(this.aim.p)) { const lm = this.lockModel(this.aim.p); items.push({ mesh: m.lock[LOCKS[this.aim.id].kind], model: lm, alpha: 0.6, tint: [0.6, 1.6, 0.7, 1], emissive: 0.25, shadow: false, sphere: [lm[12], lm[13], lm[14], 0.3] }); }
    this._lockBar(); }
  _lockBar() { let el = document.getElementById('lockHp'); const s = this._lockHp; if (!s || !this.lockOf(s.p)) { if (el) el.style.display = 'none'; return; } if (!el) { el = document.createElement('div'); el.id = 'lockHp'; el.innerHTML = '<span class="nm"></span><div class="bar"><i></i></div>'; document.body.appendChild(el); }
    const L = this.lockOf(s.p), k = Math.max(0, L.hp / LOCKS[L.id].hp); el.style.display = 'block'; el.querySelector('.nm').textContent = `🔒 ${LOCKS[L.id].name} ${Math.round(L.hp)}/${LOCKS[L.id].hp}`; const b = el.querySelector('i'); b.style.width = (k * 100).toFixed(1) + '%'; b.style.background = k > 0.5 ? '#8fd16a' : k > 0.25 ? '#e0b040' : '#e05a4a'; }
}
export { Inventory, TIERS };
