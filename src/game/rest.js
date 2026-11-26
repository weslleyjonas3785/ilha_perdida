// Cama, dormir, renascer e choque.
// - Cama (construída): deitar define o ponto de surgimento ("Ponto de surgimento estabelecido").
// - Depois das 20:00 dá para dormir em qualquer cama (sua ou das casas) e amanhece. No multiplayer só amanhece quando
//   todos os jogadores online estão deitados: aparece o contador "3/8"; com todos deitados a tela escurece e o dia nasce.
// - Choque (barra escondida): tiro de calibre alto ou no peito derruba mesmo com muita vida — tela preta, 10 s depois
//   os olhos abrem devagar e o personagem está agachado. Se alguém te finalizar desmaiado: "Você foi finalizado".
// - Ao morrer, abre o mapa para escolher renascer na cama ou num lugar aleatório.
import { interiorBeds } from './interiors.js';

const SLEEP_FROM = 20, SLEEP_TO = 6;
export class Rest {
  constructor(game) { this.g = game; this.sleepers = new Set(); this._n = 0; this._tot = 1; this.hud = null; }
  canSleepNow() { const h = this.g.env.hours; return h >= SLEEP_FROM || h < SLEEP_TO; }
  // camas das casas perto (móveis 'bed', 'dbed' e macas de hospital)
  houseBeds(p, R = 12) { const w = this.g.world, out = []; if (!w._bIdx) return out; const seen = new Set();
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) { const L = w._bIdx.get((Math.floor(p[0] / 32) + i) + ',' + (Math.floor(p[2] / 32) + j)); if (!L) continue;
      for (const b of L) { if (seen.has(b) || !b.furnish) continue; seen.add(b); if (Math.hypot(b.x - p[0], b.z - p[2]) > R + 20) continue; if (!b._beds) b._beds = interiorBeds(b); for (const q of b._beds) if (Math.hypot(q.x - p[0], q.z - p[2]) < R && Math.abs(q.y - p[1]) < 2.5) out.push(q); } }
    return out; }
  // deitar: cama própria marca o renascimento; de noite dorme
  lie(bed) {
    const g = this.g, P = g.player; if (P.dead || P.sleeping) return;
    if (bed.piece) { g.home = [bed.x, bed.y, bed.z]; g.homeBed = [+bed.x.toFixed(2), +bed.z.toFixed(2)]; g.ui.toast('🛏 Ponto de surgimento estabelecido', 'ok'); g.audio.play('cloth'); g.saveGame && g.saveGame(false); }
    if (!this.canSleepNow()) { if (!bed.piece) g.ui.toast('Só dá para dormir depois das 20:00', 'info'); else g.ui.toast('🛏 Ponto de surgimento estabelecido — dormir só depois das 20:00', 'ok'); return; }
    if (g.creatures.list.some((c) => !c.dead && (c.def.hostile || c.angry > 0) && Math.hypot(c.pos[0] - P.pos[0], c.pos[2] - P.pos[2]) < 25)) { g.ui.toast('Não dá para dormir com inimigos por perto!', 'warn'); return; }
    // deita de costas na cama, cabeça na cabeceira
    P.bed = bed; P.sleeping = true; P.crouch = false; P.vel = [0, 0, 0]; P.setPosition(bed.x, bed.y + 0.5, bed.z); P.yaw = bed.rot; P.anim.play(P.clips.sleep, 0.5); g.audio.play('sleep');
    if (g.net && g.net.active && g.net.peers.size) { g.net.send({ to: 'all', t: 'sleep', on: 1 }); if (g.net.host) this.sleepers.add('host'); this._showHud(); this._check(); }
    else this._sleepSolo();
  }
  getUp() { const g = this.g, P = g.player; if (!P.sleeping || !P.bed) return; const b = P.bed; P.bed = null; g.wake(); const s = b.rot; P.setPosition(b.x + Math.cos(s) * 1.2, b.y + 0.05, b.z - Math.sin(s) * 1.2); g.unstuckIfNeeded && g.unstuckIfNeeded();
    if (g.net && g.net.active) { g.net.send({ to: 'all', t: 'sleep', on: 0 }); if (g.net.host) { this.sleepers.delete('host'); this._check(); } } this._hideHud(); }
  _sleepSolo() { const g = this.g, P = g.player; g.input.enabled = false; document.getElementById('fade').classList.add('on'); setTimeout(() => this._morning(true), 1600); }
  // amanhece: necessidades e vida, inimigos perto somem, todos acordam
  _morning(local) { const g = this.g, P = g.player, h = g.env.hours; const hoursToMorning = ((30 - h) % 24) || 8; const frac = hoursToMorning / 24; const st = P.stats;
    if (P.sleeping) { st.hunger = Math.max(5, st.hunger - 35 * frac * 2); st.thirst = Math.max(5, st.thirst - 45 * frac * 2); st.energy = 100; st.hp = Math.min(100, st.hp + 30); st.stamina = 100; }
    if (local) { g.env.time = 6 / 24 + 0.002; if (h > SLEEP_TO) g.env.day++; g.onNewDay(); for (const c of [...g.creatures.list]) if (['tiger', 'rhino', 'eagle'].includes(c.kind) || (c.def.hostile && !g.world.inRuins(c.pos[0], c.pos[2]) && Math.hypot(c.pos[0] - P.pos[0], c.pos[2] - P.pos[2]) < 60)) g.creatures.remove(c); }
    if (P.sleeping) { const b = P.bed; P.bed = null; g.wake(); if (b) P.setPosition(b.x + Math.cos(b.rot) * 1.2, b.y + 0.05, b.z - Math.sin(b.rot) * 1.2); } this._hideHud(); this.sleepers.clear();
    g.saveGame && g.saveGame(false); g.ui.toast(`☀ Dia ${g.env.day} — o dia amanheceu`, 'ok'); }
  // multiplayer
  onNet(o) { const g = this.g, N = g.net; if (o.t === 'sleep' && N.host) { if (o.on) this.sleepers.add(o.from); else this.sleepers.delete(o.from); this._check(); }
    else if (o.t === 'sleepN') { this._n = o.n; this._tot = o.tot; this._showHud(); }
    else if (o.t === 'dawn') { document.getElementById('fade').classList.add('on'); setTimeout(() => { document.getElementById('fade').classList.remove('on'); this._morning(false); }, 1600); } }
  _check() { const g = this.g, N = g.net; if (!N || !N.host) return; for (const id of [...this.sleepers]) if (id !== 'host' && !N.peers.has(id)) this.sleepers.delete(id);
    const tot = N.peers.size + 1, n = this.sleepers.size; this._n = n; this._tot = tot; N.send({ to: 'all', t: 'sleepN', n, tot }); if (g.player.sleeping) this._showHud();
    if (n >= tot && n > 0) { N.send({ to: 'all', t: 'dawn' }); document.getElementById('fade').classList.add('on'); setTimeout(() => { document.getElementById('fade').classList.remove('on'); this._morning(true); N.tEnv = 99; }, 1600); } }
  _showHud() { if (!this.g.player.sleeping) return; let h = document.getElementById('sleepHud'); if (!h) { h = document.createElement('div'); h.id = 'sleepHud'; document.getElementById('hud').appendChild(h); }
    h.innerHTML = `😴 Dormindo <b>${this._n}/${this._tot}</b><small>o dia só nasce quando todos estiverem deitados · Espaço/E levanta</small>`; h.classList.remove('hidden'); }
  _hideHud() { const h = document.getElementById('sleepHud'); if (h) h.classList.add('hidden'); }

  // ---------- choque (barra escondida) ----------
  shockHit(n, o) { const g = this.g, P = g.player; if (!o || !o.shot || P.dead || P.fainted > 0) return false;
    const cal = o.cal || n; const add = n * 2.2 * (o.chest ? 2.0 : 1) * (cal >= 25 ? 1.6 : 1) + (cal >= 40 ? 40 : 0); P.shock = (P.shock || 0) + add;
    if (P.shock >= 100 && P.stats.hp - n > 0) { P.shock = 0; P.stats.hp -= n; g._lastCause = 'choque'; g.audio.play('groan', { big: true, f0: g.look && g.look.voice ? g.look.voice : 150 }); this.knockOut(); return true; }
    return false; }
  decay(dt) { const P = this.g.player; if (P.shock > 0) P.shock = Math.max(0, P.shock - dt * 14); }
  knockOut() { const g = this.g; g.faintPlayer(10, '💫 O choque do tiro te apagou!'); const f = document.getElementById('fade'); f.classList.add('on', 'ko'); }
  // acordando do desmaio: olhos abrindo devagar e agachado
  wakeEyes() { const g = this.g, P = g.player; P.crouch = true; const f = document.getElementById('fade'); f.classList.remove('ko'); let e = document.getElementById('eyelids'); if (!e) { e = document.createElement('div'); e.id = 'eyelids'; e.innerHTML = '<i></i><i></i>'; document.body.appendChild(e); }
    e.classList.remove('open'); void e.offsetWidth; e.classList.add('open'); setTimeout(() => e.classList.remove('open'), 2600); }

  // ---------- morte: escolher onde renascer no mapa ----------
  isHome(p) { const h = this.g.homeBed; return !!h && Array.isArray(h) && Math.abs(p.x - h[0]) < 0.3 && Math.abs(p.z - h[1]) < 0.3; }
  bedAlive() { const g = this.g; if (!g.home) return false; if (!Array.isArray(g.homeBed)) return true; return g.build.pieces.some((p) => ['bed', 'tent', 'shelter'].includes(p.type) && this.isHome(p)); }
  deathChoice(finished, cause) {
    const g = this.g; const fade = document.getElementById('fade'); fade.classList.add('on', 'ko'); let t = document.getElementById('finText'); if (!t) { t = document.createElement('div'); t.id = 'finText'; document.body.appendChild(t); }
    t.innerHTML = finished ? 'Você foi finalizado' : 'Você morreu'; t.className = 'show';
    setTimeout(() => { t.className = ''; fade.classList.remove('ko'); if (g.state === 'dead') this.openSpawnMap(finished, cause); }, finished ? 2600 : 1800);
  }
  openSpawnMap(finished, cause) {
    const g = this.g, M = g.map; g.ui.open = 'map'; M.open(); M.draw(); const panel = M.panel; panel.classList.add('spawnMode'); let bar = document.getElementById('spawnBar'); if (!bar) { bar = document.createElement('div'); bar.id = 'spawnBar'; panel.appendChild(bar); }
    const bedOk = this.bedAlive(); bar.innerHTML = `<h3>${finished ? 'Você foi finalizado' : 'Você morreu'}</h3><p class="muted">${cause || ''}</p><p>Escolha onde renascer:</p><div class="acts"><button data-sp="bed" ${bedOk ? '' : 'disabled title="Você não tem cama (deite numa cama sua para marcar)"'}>🛏 Na minha cama</button><button data-sp="rand">🎲 Lugar aleatório</button><button data-sp="load" class="n">Carregar salvamento</button></div>`;
    bar.querySelector('[data-sp=bed]').onclick = () => this.pick('bed'); bar.querySelector('[data-sp=rand]').onclick = () => this.pick('rand'); bar.querySelector('[data-sp=load]').onclick = () => { this.closeSpawnMap(); g.continueGame(); };
    if (g.home && bedOk) { M.view.cx = g.home[0]; M.view.cz = g.home[2]; M.draw(); }
    clearInterval(this._mapIv); this._mapIv = setInterval(() => { if (!M.panel.classList.contains('spawnMode')) return clearInterval(this._mapIv); M.draw(); }, 300);
  }
  closeSpawnMap() { const g = this.g, M = g.map; if (g.ui.open === 'map') g.ui.open = null; M.panel.classList.remove('spawnMode'); M.panel.classList.add('hidden'); const bar = document.getElementById('spawnBar'); if (bar) bar.remove(); document.getElementById('fade').classList.remove('on', 'ko'); }
  pick(where) { const g = this.g; this.closeSpawnMap(); g.respawn(where === 'bed' && this.bedAlive() ? 'bed' : 'rand'); }
}
