// Multiplayer por IP (rede local / VPN tipo Radmin): o dono roda o server.js, que serve o jogo e liga os jogadores.
// O navegador do dono é a "autoridade": simula robôs, NPCs e animais e manda para os outros; cada jogador manda a
// própria posição/animação, tiros e o que mudou no mundo (construções, fogueiras, baús, loot no chão, árvores, caixas).
// • Jogadores: avatares (mesmo personagem chibi, com a aparência de cada um), nome em cima, tiros e dano entre jogadores.
// • Criaturas: o dono manda as que estão perto de cada jogador; o dano que os outros causam vai para o dono.
// • Mundo: sincronizado por diferenças (peças com id único, loot no chão, árvores/pedras/caixas/portas).
import { mat4, quat } from '../engine/math.js';
import { ITEMS } from './items.js';

const PS_HZ = 12, CS_HZ = 8, DIFF_HZ = 3, ENV_T = 4;
export const MP_PORT = 8790;
const isGunClip = (n) => n && /rifle|pistol/i.test(n);

export class Net {
  constructor(game) { this.g = game; this.mode = null; this.ws = null; this.id = 0; this.peers = new Map(); this.t = 0; this.tPS = 0; this.tCS = 0; this.tDiff = 0; this.tEnv = 0; this.lastPieces = new Map(); this.lastDrops = new Map(); this.lastMods = {}; this.proxies = new Map(); this.pendingMods = null; this.inbox = []; this.worldName = ''; }
  get active() { return !!this.mode; }
  get host() { return this.mode === 'host'; }
  get client() { return this.mode === 'client'; }
  pid() { const s = this.g.settings; if (!s.pid) { s.pid = 'p' + Math.random().toString(36).slice(2, 10); this.g._saveJSON && this.g._saveJSON('ilha_settings', s); } return s.pid; }
  wsURL(hostport) { return `ws://${hostport}/mp`; }
  status(msg, kind = 'info') { this.g.ui.toast(msg, kind); const el = document.getElementById('mpStatus'); if (el) el.textContent = msg.replace(/<[^>]+>/g, ''); }

  // ---------- conexão ----------
  _open(hostport, hello) {
    return new Promise((res, rej) => { let ws; try { ws = new WebSocket(this.wsURL(hostport)); } catch (e) { rej(e); return; } this.ws = ws; let done = false;
      ws.onopen = () => ws.send(JSON.stringify(hello));
      ws.onmessage = (ev) => { let o; try { o = JSON.parse(ev.data); } catch (e) { return; } if (!done) { if (o.t === 'welcome') { done = true; this.id = o.id; res(o); return; } if (o.t === 'denied') { done = true; rej(new Error(o.why)); ws.close(); return; } } this.inbox.push(o); };
      ws.onclose = () => { if (!done) { done = true; rej(new Error('Não foi possível conectar. Confira o IP, se o servidor está aberto e o Firewall.')); return; } this._closed(); };
      ws.onerror = () => {}; setTimeout(() => { if (!done) { done = true; try { ws.close(); } catch (e) { /* ok */ } rej(new Error('Tempo esgotado — o mundo não respondeu nesse IP.')); } }, 8000); });
  }
  send(o) { if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(o)); }
  async startHost(name, pass) {
    const g = this.g; await this._open(location.host, { t: 'hello', role: 'host', name: g.look?.name || 'Dono', pid: this.pid(), world: { name, pass } });
    this.mode = 'host'; this.worldName = name; this._resetSync(); this.status(`🌐 Mundo "${name}" aberto para amigos — eles usam o seu IP da VPN`, 'ok'); this._badge();
  }
  async join(hostport, pass) {
    const g = this.g; const o = await this._open(hostport, { t: 'hello', role: 'join', name: g.look?.name || 'Jogador', pass, pid: this.pid(), look: g.look });
    this.mode = 'client'; this.worldName = o.world || ''; this.hostport = hostport; this.status(`🌐 Conectado a "${this.worldName}" — carregando o mundo…`, 'ok'); this._badge();
  }
  leave() { if (this.ws) { try { this.ws.close(); } catch (e) { /* ok */ } } this._closed(true); }
  _closed(quiet) { const was = this.mode; if (!was) return; this.mode = null; this.ws = null; for (const p of this.peers.values()) this._removeAvatar(p); this.peers.clear(); for (const c of this.proxies.values()) this.g.creatures.remove(c); this.proxies.clear(); this._badge(); this._tags();
    const g = this.g; if (was === 'client') { g._mpRestore && g._mpRestore(); if (!quiet) { g.toMenu(); g.ui.toast('🌐 A conexão com o mundo caiu (o dono saiu ou a internet/VPN caiu)', 'warn'); } } else if (!quiet) g.ui.toast('🌐 Servidor do mundo desligado', 'warn'); }
  _badge() { let el = document.getElementById('mpBadge'); if (!el) { el = document.createElement('div'); el.id = 'mpBadge'; document.body.appendChild(el); } el.classList.toggle('hidden', !this.mode); if (this.mode) el.textContent = `🌐 ${this.host ? 'Hospedando' : 'Online'} · ${1 + this.peers.size} jogador${this.peers.size ? 'es' : ''}`; }

  // ---------- laço ----------
  update(dt) {
    if (!this.mode) return; this.t += dt; const msgs = this.inbox; this.inbox = []; for (const o of msgs) { try { this._on(o); } catch (e) { console.error('mp', o.t, e); } }
    if (this.client && !this.ready) return;
    this.tPS -= dt; if (this.tPS <= 0) { this.tPS = 1 / PS_HZ; this._sendPS(); }
    this.tDiff -= dt; if (this.tDiff <= 0) { this.tDiff = 1 / DIFF_HZ; this._diff(); }
    if (this.host) { this.tCS -= dt; if (this.tCS <= 0 && this.peers.size) { this.tCS = 1 / CS_HZ; this._sendCS(); } this.tEnv -= dt; if (this.tEnv <= 0) { this.tEnv = ENV_T; this.send({ to: 'all', t: 'env', env: this.g.env.serialize() }); } this._hostPopulate(dt); }
    if (this.pendingMods && (this._modT = (this._modT || 0) - dt) <= 0) { this._applyModsNow(); }
    for (const p of this.peers.values()) this._stepAvatar(p, dt); this._tags();
  }
  _on(o) {
    const g = this.g;
    switch (o.t) {
      case 'join': { // (só o dono recebe) alguém entrou: manda o mundo
        const p = this._peer(o.from, o.name, o.pid, o.look); this.send({ to: o.from, t: 'snap', ...this._snapshot(), you: o.from }); this.status(`🌐 ${p.name} entrou no mundo`, 'ok'); this._badge(); break; }
      case 'snap': this._applySnap(o); break;
      case 'leave': { const p = this.peers.get(o.from); if (p) { this.status(`🌐 ${p.name} saiu`, 'info'); this._removeAvatar(p); this.peers.delete(o.from); } this._badge(); break; }
      case 'hostgone': this._closed(); break;
      case 'ps': { let p = this.peers.get(o.from); if (!p) p = this._peer(o.from, o.name || '?', o.pid, o.look); if (o.look) { p.look = o.look; p.lookKey = null; } p.st = o; p.name = o.name || p.name; if (!p.av) this._makeAvatar(p); break; }
      case 'cs': if (this.client) this._applyCS(o); break;
      case 'env': if (this.client) { g.env.load(o.env); } break;
      case 'hit': if (o.to === this.id) this._takeHit(o); break;
      case 'chit': if (this.host) { const c = g.creatures.list.find((q) => q.uid === o.nid); if (c && !c.dead) { const P0 = g.player; const pr = this.peers.get(o.from); c.lastHitBy = o.from; g.creatures.damage(c, o.dmg, o.yaw, o.kind); if (pr && c.npc && !c.dead) { c.target = 'player'; c.netTarget = o.from; } void P0; } } break;
      case 'cloot': if (this.host) { const c = g.creatures.list.find((q) => q.uid === o.nid); if (c) { if (o.butch) { g.creatures.remove(c); break; } if (o.searched) { c.searched = true; if (c.loadout) { c.loadout.weapon = []; c.loadout.misc = []; } } else c.looted = true; } } break;
      case 'shot': this._remoteShot(o); break;
      case 'noise': if (this.host) { const pr = this.peers.get(o.from); const P0 = g.player; const px = pr && this.proxyFor(pr); if (px) g.player = px; try { g.noise(o.p, o.r, o.k); } finally { g.player = P0; } } break;
      case 'vc': if (g.voice) g.voice.onRemote(o); break;
      case 'sleep': case 'sleepN': case 'dawn': if (g.rest) g.rest.onNet(o); break;
      case 'boom': g.explode(o.p, null, { ...o.o, fxOnly: true }); break;
      case 'pc': this._applyPieces(o); break;
      case 'dr': this._applyDrops(o); break;
      case 'wm': this._applyMods(o); break;
      case 'admtp': if (this.client && o.from === 1 && Array.isArray(o.p)) { const P = g.player; g.stream.flush(o.p); P.setPosition(o.p[0], Math.max(g.world.height(o.p[0], o.p[2]), o.p[1]) + 0.1, o.p[2]); g.ui.toast('🌀 O dono do mundo te trouxe até ele', 'info'); } break;
    }
  }
  _peer(id, name, pid, look) { let p = this.peers.get(id); if (!p) { p = { id, name, pid, look, st: null, av: null }; this.peers.set(id, p); } else { p.name = name || p.name; if (look) p.look = look; } return p; }

  // ---------- jogadores (avatares) ----------
  _sendPS() {
    const g = this.g, P = g.player, A = P.anim; const st = A.states[A.states.length - 1]; const act = A.action && !A.action.ending ? A.action.clip.name : null; const ov = A.overlays && A.overlays.length ? A.overlays[A.overlays.length - 1] : null;
    const o = { to: 'all', t: 'ps', name: g.look?.name || 'Jogador', pid: this.pid(), p: P.pos.map((v) => +v.toFixed(2)), y: +P.yaw.toFixed(3), b: st ? st.clip.name : 'idle', a: act, ov: ov && ov.target === 1 ? ov.clip.name : null, h: g.equip.hand || null, d: P.dead ? 1 : 0, f: P.fainted > 0 ? 1 : 0, cr: P.crouch ? 1 : 0, dr: g.vehicles.driving ? 1 : 0 };
    const lk = JSON.stringify(g.look || {}); if (lk !== this._lookSent || (this._lookT = (this._lookT || 0) - 1 / PS_HZ) <= 0) { o.look = g.look; this._lookSent = lk; this._lookT = 5; }
    this.send(o);
  }
  _makeAvatar(p) {
    const g = this.g, CM = g.creatures; const A = CM.assets; if (!A.rigs.avatar) { A.rigs.avatar = { skel: g.playerAssets.skel, clips: g.playerAssets.clips }; A.meshes.avatar = g.playerAssets.mesh; }
    const s = p.st; const pos = s ? s.p : g.player.pos; const c = CM.addNet('avatar', pos[0], pos[1], pos[2]); c.avatar = true; c.peer = p.id; c.net = true; c.hp = 100; p.av = c; this._lookAvatar(p); return c;
  }
  _lookAvatar(p) { const g = this.g, c = p.av; if (!c || !p.look) return; const key = JSON.stringify(p.look); if (p.lookKey === key) return; p.lookKey = key; try { c.mesh = g.renderer.createMesh(g.buildAvatarMesh(p.look)); } catch (e) { console.warn(e); } }
  _removeAvatar(p) { if (p.av) { this.g.creatures.remove(p.av); p.av = null; } const t = document.getElementById('tag' + p.id); if (t) t.remove(); }
  _stepAvatar(p, dt) {
    const c = p.av, s = p.st; if (!c || !s) return; this._lookAvatar(p); const C = c.clips;
    const k = Math.min(1, dt * 12); const dx = s.p[0] - c.pos[0], dz = s.p[2] - c.pos[2]; if (Math.hypot(dx, dz) > 12) { c.pos[0] = s.p[0]; c.pos[1] = s.p[1]; c.pos[2] = s.p[2]; } else { c.pos[0] += dx * k; c.pos[1] += (s.p[1] - c.pos[1]) * k; c.pos[2] += dz * k; }
    let dy = s.y - c.yaw; while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2; c.yaw += dy * k; c.collider.x = c.pos[0]; c.collider.z = c.pos[2]; c.collider.y0 = c.pos[1]; c.collider.y1 = c.pos[1] + 1.75;
    const wasDead = c.dead; c.dead = !!s.d; c.collider.ghost = c.dead; c.hidden = !!s.dr;
    if (c.dead && !wasDead) c.anim.play(C.die || C.idle, 0.15); else if (!c.dead) { const want = C[s.b] || C.idle; if (c._b !== s.b) { c._b = s.b; c.anim.play(want, 0.18); }
      if (s.a && s.a !== c._a && C[s.a]) c.anim.playAction(C[s.a], { mask: C.masks && C.masks.upper, fadeIn: 0.08, fadeOut: 0.15 }); c._a = s.a;
      const ov = s.ov && C[s.ov] ? C[s.ov] : null; if (c.anim.setOverlay) c.anim.setOverlay(ov, C.masks && C.masks.upper, 0.15); }
    c.anim.update(dt); this.g.creatures._matrices(c);
  }
  // nomes em cima dos jogadores
  _tags() {
    let box = document.getElementById('nameTags'); if (!box) { box = document.createElement('div'); box.id = 'nameTags'; document.body.appendChild(box); } if (!this.mode) { box.innerHTML = ''; return; }
    const r = this.g.renderer, VP = r.viewProj, cv = r.canvas; const W = cv.clientWidth, H = cv.clientHeight;
    for (const p of this.peers.values()) { const c = p.av; let el = document.getElementById('tag' + p.id); if (!c) { if (el) el.remove(); continue; } if (!el) { el = document.createElement('div'); el.id = 'tag' + p.id; el.className = 'ntag'; box.appendChild(el); }
      const x = c.pos[0], y = c.pos[1] + 2.25, z = c.pos[2]; const cx = VP[0] * x + VP[4] * y + VP[8] * z + VP[12], cy = VP[1] * x + VP[5] * y + VP[9] * z + VP[13], cw = VP[3] * x + VP[7] * y + VP[11] * z + VP[15];
      const d = Math.hypot(x - this.g.player.pos[0], z - this.g.player.pos[2]); if (cw <= 0.1 || d > 160 || c.hidden) { el.style.display = 'none'; continue; } el.style.display = '';
      el.style.left = ((cx / cw) * 0.5 + 0.5) * W + 'px'; el.style.top = (1 - ((cy / cw) * 0.5 + 0.5)) * H + 'px'; el.textContent = (c.dead ? '☠ ' : '') + p.name; el.style.opacity = d > 60 ? 0.6 : 1; }
  }
  // dano que eu recebi de outro jogador (ou de uma criatura do mundo do dono)
  _takeHit(o) { const g = this.g, P = g.player; if (P.dead) return; const src = { pos: o.sp || P.pos, def: { name: o.src || 'Jogador' }, netPeer: o.from };
    if (o.melee) g.playerHit(o.dmg, src, {}); else g.playerHit(o.dmg, src, { ranged: !!o.ranged, shot: !!o.shot }); }
  sendHitTo(peerId, dmg, opt = {}, src = null) { this.send({ to: peerId, t: 'hit', dmg: +dmg.toFixed(1), ranged: !!opt.ranged, shot: !!opt.shot, melee: !!opt.melee, src: src && src.def ? src.def.name : (this.g.look?.name || 'Jogador'), sp: src && src.pos ? src.pos.map((v) => +v.toFixed(2)) : null }); }
  _remoteShot(o) { const g = this.g; const p = this.peers.get(o.from); const at = p && p.av ? [p.av.pos[0], p.av.pos[1] + 1.4, p.av.pos[2]] : o.o; g.audio.play(o.snd || 'rifle', { at, max: 260 }); if (o.o && o.d) { const end = [o.o[0] + o.d[0] * 60, o.o[1] + o.d[1] * 60, o.o[2] + o.d[2] * 60]; g.fx.tracer && g.fx.tracer(o.o, end); g.gunLight = { pos: at, t: 0.05 }; } }
  onShot(origin, dir, sound) { if (this.mode) this.send({ to: 'all', t: 'shot', o: origin.map((v) => +v.toFixed(2)), d: dir.map((v) => +v.toFixed(3)), snd: sound }); }
  onBoom(p, o) { if (this.mode) this.send({ to: 'all', t: 'boom', p: p.map((v) => +v.toFixed(2)), o: { r: o.r, kind: o.kind, vis: o.vis, crater: o.crater, flash: o.flash } }); }

  // ---------- dano em criaturas/avatares que não são meus ----------
  onDamage(c, dmg, yaw, kind) {
    const g = this.g; if (c.avatar) { this.sendHitTo(c.peer, dmg, { ranged: kind !== 'melee', shot: kind === 'bullet' || kind === undefined }); g.fx.burst([c.pos[0], c.pos[1] + 1.2, c.pos[2]], 8, [0.6, 0.05, 0.05], 2, 0.4, 0.05); return; }
    if (c.netProxy) { this.send({ t: 'chit', nid: c.nid, dmg: +dmg.toFixed(1), yaw: +(yaw || 0).toFixed(2), kind }); g.fx.burst([c.pos[0], c.pos[1] + 0.9 * c.def.scale, c.pos[2]], 6, c.def.robot ? [1, 0.8, 0.3] : [0.6, 0.05, 0.05], 2, 0.3, 0.04); }
  }
  onLoot(c, butch, searched) { if (this.client && c.netProxy) this.send({ t: 'cloot', nid: c.nid, butch: !!butch, searched: !!searched }); }

  // ---------- criaturas (dono → outros) ----------
  minDist(p) { let d = Math.hypot(p[0] - this.g.player.pos[0], p[2] - this.g.player.pos[2]); for (const q of this.peers.values()) if (q.st) d = Math.min(d, Math.hypot(p[0] - q.st.p[0], p[2] - q.st.p[2])); return d; }
  proxyFor(peer) { const s = peer.st; if (!s) return null; const pr = peer.proxy || (peer.proxy = { remote: true, id: peer.id, pos: [0, 0, 0], vel: [0, 0, 0], yaw: 0, crouch: false, dead: false, sleeping: false, sprinting: false, inCave: null, seat: null, fainted: 0, onGround: true, speed: 0, stats: { hp: 100 }, push() {} });
    pr.pos[0] = s.p[0]; pr.pos[1] = s.p[1]; pr.pos[2] = s.p[2]; pr.yaw = s.y; pr.crouch = !!s.cr; pr.dead = !!s.d || !!s.f; pr.seat = s.dr ? { hidden: false } : null; return pr; }
  // alvo mais perto para a IA do dono (o próprio dono ou um jogador conectado)
  nearestTarget(c) { const g = this.g; let best = g.player, bd = g.player.dead ? 1e9 : Math.hypot(c.pos[0] - g.player.pos[0], c.pos[2] - g.player.pos[2]);
    if (c.netTarget) { const pr = this.peers.get(c.netTarget); if (pr && pr.st && !pr.st.d) { const x = this.proxyFor(pr); if (x) return x; } else c.netTarget = null; }
    for (const p of this.peers.values()) { if (!p.st || p.st.d) continue; const d = Math.hypot(c.pos[0] - p.st.p[0], c.pos[2] - p.st.p[2]); if (d < bd - 0.5) { bd = d; best = this.proxyFor(p) || best; } }
    return best; }
  _hostPopulate(dt) { const g = this.g; for (const p of this.peers.values()) { if (!p.st) continue; const pr = this.proxyFor(p); const P0 = g.player; const t0 = g.creatures.spawnT, n0 = g.npcs.timer;
      g.creatures.spawnT = p.spawnT ?? 1; g.npcs.timer = p.npcT ?? 1; g.player = pr; try { g.creatures.populate(dt); g.npcs.populate(dt); } finally { p.spawnT = g.creatures.spawnT; p.npcT = g.npcs.timer; g.player = P0; g.creatures.spawnT = t0; g.npcs.timer = n0; } } }
  _sendCS() {
    const g = this.g, list = []; const near = (c) => { for (const p of this.peers.values()) if (p.st && Math.hypot(c.pos[0] - p.st.p[0], c.pos[2] - p.st.p[2]) < 230) return true; return false; };
    for (const c of g.creatures.list) { if (c.net || !near(c)) continue; const A = c.anim; const st = A.states[A.states.length - 1]; const act = A.action && !A.action.ending ? A.action.clip.name : '';
      list.push([c.uid, c.kind, c.variant || 0, +c.pos[0].toFixed(2), +c.pos[1].toFixed(2), +c.pos[2].toFixed(2), +c.yaw.toFixed(2), st ? st.clip.name : 'idle', act, c.dead ? 1 : 0, +(c.hp / c.def.hp).toFixed(2), c.weapon || '', c.deathClip ? c.deathClip.name : '', (c.looted ? 1 : 0) | (c.searched ? 4 : 0), c.target ? 1 : 0, c.state === 'firing' || c.state === 'attack' ? 1 : 0]); }
    this.send({ to: 'all', t: 'cs', l: list });
  }
  _applyCS(o) {
    const g = this.g, CM = g.creatures, seen = new Set();
    for (const r of o.l) { const [nid, kind, variant, x, y, z, yaw, clip, act, dead, hpf, weapon, dclip, flags, tgt] = r; seen.add(nid); let c = this.proxies.get(nid);
      if (!c) { c = CM.addNet(kind, x, y, z); if (!c) continue; c.net = true; c.netProxy = true; c.nid = nid; const mv = CM.assets.meshes[kind + 'V']; if (mv) { c.variant = variant; c.mesh = mv[variant] || c.mesh; } c.yaw = yaw; if (c.def.ai === 'npc' || c.def.human) { c.npc = !!(weapon || c.def.ai === 'npc'); } this.proxies.set(nid, c); }
      c.net_t = [x, y, z, yaw]; c.weapon = weapon || null; c.W = weapon ? { gun: ['rifle', 'pistol', 'shotgun'].includes(weapon) } : null; c.target = tgt ? 'player' : null; c.looted = !!(flags & 1); if (flags & 4) c.searched = true; if (c.npc && c.weapon && !c.loadout && g.npcs._loadout) { try { c.loadout = g.npcs._loadout(c, kind); } catch (e) { c.loadout = { weapon: [], clothes: [], misc: [] }; } } c.hp = hpf * c.def.hp;
      const C = c.clips; if (dead && !c.dead) { c.dead = true; c.collider.ghost = true; c.deadTime = 0; const dc = C[dclip] || C.die; if (dc) { c.deathClip = dc; c.anim.play(dc, 0.1); } }
      else if (!dead) { c.dead = false; c.collider.ghost = false; if (c._b !== clip && C[clip]) { c._b = clip; c.anim.play(C[clip], 0.18); } if (act && act !== c._a && C[act]) c.anim.playAction(C[act], { mask: (C.masks && /shoot|aim|throw|punch|block/i.test(act)) ? C.masks.upper : null, fadeIn: 0.06, fadeOut: 0.12 }); c._a = act; } }
    for (const [nid, c] of this.proxies) if (!seen.has(nid)) { CM.remove(c); this.proxies.delete(nid); }
  }
  stepProxy(c, dt) { // chamada pelo CreatureManager no lugar da IA
    if (c.avatar) return; const t = c.net_t; if (t) { const k = Math.min(1, dt * 10); const dx = t[0] - c.pos[0], dz = t[2] - c.pos[2]; if (Math.hypot(dx, dz) > 10) { c.pos[0] = t[0]; c.pos[2] = t[2]; c.pos[1] = t[1]; } else { c.pos[0] += dx * k; c.pos[1] += (t[1] - c.pos[1]) * k; c.pos[2] += dz * k; }
      let dy = t[3] - c.yaw; while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2; c.yaw += dy * k; }
    if (c.dead) c.deadTime += dt; c.collider.x = c.pos[0]; c.collider.z = c.pos[2]; c.collider.y0 = c.pos[1]; c.collider.y1 = c.pos[1] + 1.5 * c.def.scale; c.anim.update(dt); this.g.creatures._matrices(c);
  }

  // ---------- mundo: fotografia inicial + diferenças ----------
  _snapshot() { const g = this.g; return { world: g._worldState(), pieces: g.build.serialize(), drops: g.drops.map((d) => this._dropRec(d)), logs: g.logs.map((l) => [l.x, l.y, l.z, l.rot]), env: g.env.serialize(), host: { pos: g.player.pos, name: g.look?.name }, peers: [...this.peers.values()].map((p) => ({ id: p.id, name: p.name, look: p.look })) }; }
  _applySnap(o) {
    const g = this.g; this.ready = false; g._mpEnterClient(o); this._resetSync(); for (const pr of o.peers || []) if (pr.id !== this.id) this._peer(pr.id, pr.name, null, pr.look);
    this.ready = true; this.status(`🌐 Você entrou em "${this.worldName}"`, 'ok'); this._badge();
  }
  _resetSync() { const g = this.g; this.lastPieces = new Map(g.build.pieces.map((p) => [this._uid(p), this._pieceHash(p)])); this.lastDrops = new Map(g.drops.map((d) => [this._duid(d), this._dropHash(d)])); this.lastMods = this._modSets(); }
  _uid(p) { if (!p.uid) p.uid = this.pid() + ':' + (p.id || 0) + ':' + Math.floor(Math.random() * 1e6).toString(36); return p.uid; }
  _duid(d) { if (!d.uid) d.uid = this.pid() + ':d' + Math.floor(Math.random() * 1e9).toString(36); return d.uid; }
  _pieceRec(p) { return { uid: this._uid(p), type: p.type, x: +p.x.toFixed(3), y: +p.y.toFixed(3), z: +p.z.toFixed(3), rot: +p.rot.toFixed(4), lit: p.lit, open: p.open, items: p.items, data: p.data || undefined }; }
  _pieceHash(p) { return JSON.stringify([p.type, +p.x.toFixed(3), +p.y.toFixed(3), +p.z.toFixed(3), +p.rot.toFixed(4), !!p.lit, !!p.open, p.items || null, p.data || null]); }
  _dropRec(d) { return { uid: this._duid(d), items: d.items, x: d.x, y: d.y, z: d.z, look: d.look, rot: d.rot }; }
  _dropHash(d) { return JSON.stringify([d.items, +d.x.toFixed(2), +d.z.toFixed(2)]); }
  _modSets() { const st = this.g._worldState(); const out = {}; for (const k of ['trees', 'rocks', 'bushes', 'pickups', 'hives', 'crates', 'specials', 'cars']) out[k] = new Map((st[k] || []).map(([id, v]) => [id, v])); out.openDoors = new Set(st.openDoors || []); return out; }
  _diff() {
    const g = this.g; // construções
    const cur = new Map(); const set = []; for (const p of g.build.pieces) { const u = this._uid(p), h = this._pieceHash(p); cur.set(u, h); if (this.lastPieces.get(u) !== h) set.push(this._pieceRec(p)); }
    const del = [...this.lastPieces.keys()].filter((u) => !cur.has(u)); this.lastPieces = cur; if (set.length || del.length) this.send({ to: 'all', t: 'pc', set, del });
    // loot no chão
    const curD = new Map(); const dset = []; for (const d of g.drops) { const u = this._duid(d), h = this._dropHash(d); curD.set(u, h); if (this.lastDrops.get(u) !== h) dset.push(this._dropRec(d)); }
    const ddel = [...this.lastDrops.keys()].filter((u) => !curD.has(u)); this.lastDrops = curD; if (dset.length || ddel.length) this.send({ to: 'all', t: 'dr', set: dset, del: ddel });
    // árvores, pedras, arbustos, caixas, portas
    const M = this._modSets(), add = {}, L = this.lastMods; let any = false;
    for (const k of Object.keys(M)) { if (k === 'openDoors') continue; const a = []; for (const [id, v] of M[k]) if (!L[k] || !L[k].has(id)) a.push([id, v]); if (a.length) { add[k] = a; any = true; } }
    const dOpen = [...M.openDoors].filter((id) => !L.openDoors || !L.openDoors.has(id)), dClose = L.openDoors ? [...L.openDoors].filter((id) => !M.openDoors.has(id)) : [];
    this.lastMods = M; if (any || dOpen.length || dClose.length) this.send({ to: 'all', t: 'wm', add, open: dOpen, close: dClose });
  }
  _applyPieces(o) { const g = this.g, B = g.build; const byU = new Map(B.pieces.map((p) => [this._uid(p), p]));
    for (const r of o.set || []) { const p = byU.get(r.uid); this.lastPieces.set(r.uid, null);
      if (p && p.type === r.type && Math.abs(p.x - r.x) < 1e-3 && Math.abs(p.z - r.z) < 1e-3 && Math.abs(p.y - r.y) < 1e-3 && Math.abs(p.rot - r.rot) < 1e-4) { // só o estado mudou
        p.lit = r.lit; if (!!p.open !== !!r.open) B.toggleDoor(p); p.items = r.items || p.items; if (r.data) { if (p.data && typeof p.data === 'object') { for (const k of Object.keys(p.data)) if (!(k in r.data)) delete p.data[k]; Object.assign(p.data, r.data); } else p.data = r.data; } }
      else { if (p) B.remove(p, false); const np = B.add(r); np.uid = r.uid; if (g.struct && g.struct.grow && np.type.startsWith('s_') && !p) g.struct.grow.set(np, 0); }
      const q = B.pieces.find((x) => x.uid === r.uid); if (q) this.lastPieces.set(r.uid, this._pieceHash(q)); }
    for (const u of o.del || []) { const p = byU.get(u); if (p) B.remove(p, false); this.lastPieces.delete(u); }
    g.struct && g.struct.collapse && 0; }
  _applyDrops(o) { const g = this.g; const byU = new Map(g.drops.map((d) => [this._duid(d), d]));
    for (const r of o.set || []) { let d = byU.get(r.uid); const items = (r.items || []).filter((it) => ITEMS[it[0]]); if (d) { d.items = items; d.x = r.x; d.y = r.y; d.z = r.z; } else { d = { items, x: r.x, y: r.y, z: r.z, look: r.look, rot: r.rot, uid: r.uid }; g.drops.push(d); } this.lastDrops.set(r.uid, this._dropHash(d)); }
    for (const u of o.del || []) { const d = byU.get(u); if (d) g.drops.splice(g.drops.indexOf(d), 1); this.lastDrops.delete(u); } }
  _applyMods(o) { // junta e aplica de uma vez (recarregar os objetos do terreno é pesado)
    const P = this.pendingMods || (this.pendingMods = { add: {}, open: new Set(), close: new Set() }); for (const [k, a] of Object.entries(o.add || {})) (P.add[k] = P.add[k] || []).push(...a);
    for (const id of o.open || []) { P.open.add(id); P.close.delete(id); } for (const id of o.close || []) { P.close.add(id); P.open.delete(id); } this._modT = 0.6; }
  _applyModsNow() {
    const g = this.g, w = g.world, P = this.pendingMods; this.pendingMods = null; if (!P) return; let reload = false;
    for (const k of ['trees', 'rocks', 'bushes', 'pickups', 'hives']) for (const [id, v] of P.add[k] || []) { w.mods[k].set(id, v); reload = true; if (this.lastMods[k]) this.lastMods[k].set(id, v); }
    const C = new Map(w.crates.map((c) => [c.id, c])); for (const [id, v] of P.add.crates || []) { const c = C.get(id); if (c) { c.looted = true; c.regrowAt = v; } if (this.lastMods.crates) this.lastMods.crates.set(id, v); }
    for (const [id, v] of P.add.specials || []) { const s = w.specials[id]; if (s && !s.taken) { s.taken = true; s.regrowAt = v; g.groups.ratfold && g.groups.ratfold.dirty(s); } if (this.lastMods.specials) this.lastMods.specials.set(id, v); }
    const CA = new Map(w.props.filter((q) => q.kind === 'car').map((q) => [q.id, q])); for (const [id, v] of P.add.cars || []) { const c = CA.get(id); if (c) { c.looted = true; c.regrowAt = v; } if (this.lastMods.cars) this.lastMods.cars.set(id, v); }
    for (const id of P.open) { g.openDoors.add(id); this.lastMods.openDoors && this.lastMods.openDoors.add(id); } for (const id of P.close) { g.openDoors.delete(id); this.lastMods.openDoors && this.lastMods.openDoors.delete(id); }
    if (P.open.size || P.close.size) g.stream.forEachDoor ? g.stream.forEachDoor((d) => { const want = g.openDoors.has(d.id); if (d.open !== want) { d.open = want; d.colC.ghost = want; d.colO.ghost = !want; } }) : 0;
    if (reload) { if (g.player.chopping) g.player.chopping = null; g.stream.reapply(); }
    if (reload) this.lastMods = this._modSets();
  }
}
