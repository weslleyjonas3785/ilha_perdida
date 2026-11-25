// Interface: HUD, inventário, fabricação, equipamento, construção, baú, menus e configurações.
import * as VEHMOD from './vehicles.js';
import { ITEMS, RECIPES, PIECES, costText, Inventory, itemSize, CLOTH_SLOTS, LARGE, SKILLS, SKILL_OF } from './items.js';
import { PRINTS, WIRE_MAX, BATT_CAP } from './power.js';
import * as FIRE from './campfire.js';

const $ = (id) => document.getElementById(id);
export class UI {
  constructor(game) {
    this.game = game; this.sel = null; this.open = null; this.hudT = 0;
    this.touchZone = $('touchZone'); this.joy = $('joy'); this.joyKnob = $('joyKnob'); this.touchButtons = [...document.querySelectorAll('.tbtn')];
    this.bars = {}; for (const b of document.querySelectorAll('.bar')) this.bars[b.dataset.k] = { el: b, fill: b.querySelector('.fill'), val: b.querySelector('b') };
    // bússola
    const strip = $('compassStrip'); const labels = { 0: 'N', 45: 'NE', 90: 'L', 135: 'SE', 180: 'S', 225: 'SO', 270: 'O', 315: 'NO' };
    this.pxPerDeg = 3; let html = '';
    for (let d = -360; d <= 720; d += 15) { const n = ((d % 360) + 360) % 360; const l = labels[n]; html += `<span class="${l && l.length === 1 ? 'c' : ''}" style="left:${(d + 360) * this.pxPerDeg}px">${l || '·'}</span>`; }
    strip.innerHTML = html + '<span class="m" id="homeMark" style="display:none">⌂</span>'; this.strip = strip;
    // barra rápida
    const hb = $('hotbar'); this.hslots = [];
    for (let i = 0; i < 8; i++) { const d = document.createElement('div'); d.className = 'hslot' + (i === 2 || i === 3 ? ' gapL' : '') + (i < 2 ? ' big' : i === 2 ? ' side' : ''); d.innerHTML = `<span class="k">${i + 1}</span><span class="ic"></span><span class="q"></span>`; d.onclick = () => { game.audio.init(); game.hotbar(i); }; hb.appendChild(d); this.hslots.push(d); }
    // painéis
    for (const b of document.querySelectorAll('[data-close]')) b.onclick = () => this.closePanels();
    for (const t of document.querySelectorAll('.tabs button')) t.onclick = () => this.tab(t.dataset.tab);
    $('btnNew').onclick = () => { this.click(); game.openCreator(); };
    this._bindCreator();
    $('btnContinue').onclick = () => { this.click(); game.continueGame(); };
    $('btnSettings').onclick = $('btnSettings2').onclick = () => { this.click(); this.showSettings(); };
    $('btnControls').onclick = $('btnControls2').onclick = () => { this.click(); this.menuStack('controlsPanel'); };
    $('btnQuit').onclick = () => { this.click(); game.quit(); };
    $('btnBackFromQuit').onclick = () => this.showMain();
    $('btnResume').onclick = () => { this.click(); game.resume(); };
    $('btnMulti').onclick = () => { this.click(); this.showMulti(); };
    $('btnOpenWorld').onclick = () => { this.click(); this.showMulti(true); };
    $('mpFind').onclick = () => { this.click(); this.mpFind(); };
    $('mpJoin').onclick = () => { this.click(); this.mpJoin(); };
    $('mpHost').onclick = () => { this.click(); this.mpHost(); };
    $('btnSave').onclick = () => { this.click(); game.saveGame(true); this.updatePauseInfo(); };
    $('btnUnstuck').onclick = () => { this.click(); game.unstuck(); game.resume(); };
    $('btnToMenu').onclick = () => { this.click(); game.saveGame(false); game.toMenu(); };
    $('btnRespawn').onclick = () => { this.click(); game.respawn(); };
    $('btnLoadLast').onclick = () => { this.click(); game.continueGame(); };
    $('btnDeathMenu').onclick = () => { this.click(); game.toMenu(); };
    for (const b of document.querySelectorAll('[data-back]')) b.onclick = () => { this.click(); this.back(); };
    this._bindSettings();
  }
  _bindCreator() {
    const g = this.game; const P = { hair: [0x3b2417, 0x120f0e, 0x6b4426, 0xc9a25a, 0x8a2a1c, 0x9aa0a8, 0x2a63c8, 0xd94a8a], jacket: [0x3b3c42, 0x1c1d20, 0x5b3b2a, 0x3b4a2c, 0x2a3f6a, 0x7a1f1f, 0xb8b6ae], shirt: [0xb8b8ba, 0xece9e2, 0x3a3a3c, 0xc9a85a, 0x5d7e9a, 0x9a4a3a], pants: [0x2b2b30, 0x4a3a2e, 0x3d4a2e, 0x2a3550, 0x6a6a6e], shoes: [0x2a2a2e, 0xe0e0e0, 0x6b4a33, 0xa83a2a] };
    const hexs = (n) => '#' + n.toString(16).padStart(6, '0');
    for (const [k, list] of Object.entries(P)) { const box = $('cc' + k[0].toUpperCase() + k.slice(1)); for (const c of list) { const b = document.createElement('button'); b.style.background = hexs(c); b.dataset.v = c; b.title = hexs(c); b.onclick = () => { g.look[k] = c; g.applyLook(); this.syncCreator(); }; box.appendChild(b); } }
    for (const [k, label] of Object.entries(g.constructor.HAIR_STYLES || {})) { const b = document.createElement('button'); b.textContent = label; b.dataset.v = k; b.onclick = () => { g.look.hairStyle = k; g.applyLook(); this.syncCreator(); }; $('ccHairStyle').appendChild(b); }
    $('ccName').addEventListener('input', () => { g.look.name = $('ccName').value.trim() || 'Sobrevivente'; });
    $('btnCreateStart').onclick = () => { this.click(); g.look.name = $('ccName').value.trim() || 'Sobrevivente'; $('createPanel').classList.add('hidden'); g.newGame(); };
    $('btnCreateBack').onclick = () => { this.click(); $('createPanel').classList.add('hidden'); g.toMenu(); };
  }
  syncCreator() { const L = this.game.look; for (const k of ['hair', 'jacket', 'shirt', 'pants', 'shoes']) for (const b of $('cc' + k[0].toUpperCase() + k.slice(1)).children) b.classList.toggle('on', +b.dataset.v === L[k]);
    for (const b of $('ccHairStyle').children) b.classList.toggle('on', b.dataset.v === L.hairStyle); $('ccName').value = L.name; }
  showCreator() { this.hideMenus(); $('hud').classList.add('hidden'); $('createPanel').classList.remove('hidden'); this.syncCreator(); }
  click() { this.game.audio.init(); this.game.audio.play('ui'); }
  // ---------- Menus ----------
  hideMenus() { for (const id of ['mainMenu', 'pauseMenu', 'settingsPanel', 'controlsPanel', 'multiPanel', 'deathScreen', 'quitScreen', 'loading']) $(id).classList.add('hidden'); }
  showMain() {
    this.hideMenus(); this.closePanels(true); $('hud').classList.add('hidden'); $('mainMenu').classList.remove('hidden'); this.prev = 'mainMenu';
    const info = this.game.saveInfo(); $('btnContinue').disabled = !info;
    $('saveInfo').textContent = info ? `Salvamento: Dia ${info.day} · ${new Date(info.at).toLocaleString('pt-BR')}` : (this.game.storageOk ? 'Nenhum jogo salvo ainda.' : 'Armazenamento local indisponível: o progresso não poderá ser salvo neste navegador.');
  }
  showPause() { this.hideMenus(); this.closePanels(true); $('pauseMenu').classList.remove('hidden'); this.prev = 'pauseMenu'; this.updatePauseInfo(); }
  updatePauseInfo() { const i = this.game.saveInfo(); $('pauseInfo').textContent = i ? `Último salvamento: ${new Date(i.at).toLocaleTimeString('pt-BR')} (salvamento automático a cada 60 s)` : ''; }
  // ---------- multiplayer ----------
  mpServed() { return location.protocol === 'http:' && !!location.port; }
  async showMulti(fromPause) { const g = this.game, N = g.net; this.menuStack('multiPanel'); $('mpName').value = (g.look && g.look.name) || 'Sobrevivente'; $('mpWorld').value = $('mpWorld').value || `Mundo de ${(g.look && g.look.name) || 'Sobrevivente'}`;
    $('mpStatus').textContent = N.active ? (N.host ? `Hospedando "${N.worldName}" — ${1 + N.peers.size} jogador(es)` : `Conectado a "${N.worldName}"`) : '';
    let served = false; if (this.mpServed()) { try { const r = await fetch('/mp/info', { cache: 'no-store' }); const j = await r.json(); served = j.game === 'ilha_perdida'; } catch (e) { served = false; } }
    const local = ['localhost', '127.0.0.1'].includes(location.hostname);
    $('mpHost').disabled = !(served && local) || N.active; $('mpHostInfo').innerHTML = N.host ? '✔ Seu mundo está aberto.' : served && local ? `Servidor ligado ✔ — os amigos usam o IP deste PC na VPN (aparece na janela preta do servidor).${fromPause ? '' : ' Vai abrir o seu jogo salvo (ou um novo).'}` : 'Para hospedar: baixe o jogo, dê dois cliques em <b>Hospedar mundo.bat</b> (precisa do Node.js) e jogue pela janela que ele abrir.';
    if (location.hash.startsWith('#mp=')) { const ip = decodeURIComponent(location.hash.slice(4)); $('mpIp').value = ip; history.replaceState(null, '', location.pathname + location.search); this.mpFind(); } }
  _mpAddr() { let ip = $('mpIp').value.trim().replace(/^https?:\/\//, '').replace(/\/.*$/, ''); if (!ip) return null; if (!/:\d+$/.test(ip)) ip += ':8790'; return ip; }
  async mpFind() { const g = this.game, addr = this._mpAddr(); if (!addr) return this.toast('Digite o IP do dono do mundo', 'warn'); const nm = $('mpName').value.trim(); if (nm) g.look.name = nm;
    // páginas https (GitHub Pages) não podem falar com http: vai para o jogo servido pelo próprio dono
    if (location.protocol === 'https:' || (location.host !== addr && !this.mpServed())) { $('mpStatus').textContent = 'Abrindo o jogo pelo servidor do dono…'; location.href = `http://${addr}/#mp=${encodeURIComponent(addr)}`; return; }
    $('mpStatus').textContent = 'Procurando…'; $('mpFound').classList.add('hidden'); $('mpJoin').classList.add('hidden');
    try { const r = await fetch(`http://${addr}/mp/info`, { cache: 'no-store' }); const j = await r.json(); if (j.game !== 'ilha_perdida') throw new Error();
      if (!j.open) { $('mpStatus').textContent = 'Achei o servidor, mas o dono ainda não abriu o mundo.'; return; }
      $('mpFound').classList.remove('hidden'); $('mpFound').innerHTML = `<b>🌍 ${j.name}</b><br>${j.players} jogador${j.players > 1 ? 'es' : ''}: ${j.names.join(', ')}${j.pass ? '<br>🔒 Precisa de senha' : '<br>🔓 Sem senha'}`;
      $('mpPassRow').classList.toggle('hidden', !j.pass); $('mpJoin').classList.remove('hidden'); $('mpStatus').textContent = j.pass ? 'Digite a senha e clique em Entrar.' : 'Mundo encontrado — clique em Entrar.'; this._mpFoundAddr = addr; }
    catch (e) { $('mpStatus').textContent = 'Não achei nenhum mundo nesse IP. Confira o IP da VPN, se o servidor está aberto e se o Firewall permitiu.'; } }
  async mpJoin() { const g = this.game, addr = this._mpFoundAddr || this._mpAddr(); const nm = $('mpName').value.trim(); if (nm) g.look.name = nm; $('mpStatus').textContent = 'Conectando…';
    try { if (g.state === 'playing' || g.state === 'paused') g.saveGameIfAny(); await g.net.join(addr, $('mpPass').value); this.hideMenus(); } catch (e) { $('mpStatus').textContent = e.message; } }
  async mpHost() { const g = this.game; $('mpStatus').textContent = 'Abrindo o mundo…';
    try { if (g.state === 'menu') { if (g.saveInfo()) g.continueGame(); else { g.newGame(); } } await g.net.startHost($('mpWorld').value.trim() || 'Mundo', $('mpWorldPass').value); this.hideMenus(); if (g.state === 'paused') g.resume(); else this.showHUD && this.showHUD(); } catch (e) { $('mpStatus').textContent = e.message; } }
  menuStack(id) { const cur = ['mainMenu', 'pauseMenu'].find((m) => !$(m).classList.contains('hidden')); if (cur) this.prev = cur; this.hideMenus(); $(id).classList.remove('hidden'); }
  back() { this.hideMenus(); $(this.prev || 'mainMenu').classList.remove('hidden'); if (this.prev === 'mainMenu') this.showMain(); }
  showDeath(cause) { this.hideMenus(); this.closePanels(true); $('deathScreen').classList.remove('hidden'); $('deathCause').textContent = cause; $('btnLoadLast').disabled = !this.game.saveInfo(); }
  showQuit() { this.hideMenus(); $('hud').classList.add('hidden'); $('quitScreen').classList.remove('hidden'); }
  showHUD() { this.hideMenus(); $('hud').classList.remove('hidden'); $('pname').textContent = this.game.look ? this.game.look.name : ''; }
  loading(p, text) { $('loading').classList.remove('hidden'); $('lfill').style.width = Math.round(p * 100) + '%'; if (text) $('ltext').textContent = text; }
  error(msg) { $('errorBox').classList.remove('hidden'); $('errorText').textContent = msg; $('loading').classList.add('hidden'); }
  showSettings() { this._loadSettings(); this.menuStack('settingsPanel'); }
  _bindSettings() {
    const g = this.game, s = () => g.settings;
    const bind = (id, key, conv = (v) => v, prop = 'value') => { $(id).addEventListener('input', () => { s()[key] = conv($(id)[prop]); g.applySettings(); }); };
    bind('setMaster', 'master', Number); bind('setSfx', 'sfx', Number); bind('setAmb', 'ambient', Number); bind('setMusic', 'music', Number); bind('setSens', 'sens', Number);
    bind('setInvert', 'invertY', Boolean, 'checked'); bind('setShadows', 'shadows', Boolean, 'checked'); bind('setGrass', 'grass', Number); bind('setView', 'viewDist'); bind('setRes', 'res', Number); bind('setDiff', 'enemyMul', Number);
    const custom = () => { s().quality = 'custom'; $('setQuality').value = 'custom'; };
    for (const [id, key, cv, pr] of [['setSsao', 'ssao', Boolean, 'checked'], ['setBloom', 'bloom', Boolean, 'checked'], ['setFxaa', 'fxaa', Boolean, 'checked'], ['setDetail', 'detail', Number, 'value']]) $(id).addEventListener('change', () => { s()[key] = cv($(id)[pr]); custom(); g.applySettings(); });
    for (const id of ['setShadows', 'setGrass', 'setRes']) $(id).addEventListener('change', custom);
    $('setQuality').addEventListener('change', () => { const q = $('setQuality').value; if (q !== 'custom') { g.applyQuality(q); this._loadSettings(); } });
    for (const id of ['setInvert', 'setShadows', 'setGrass', 'setView', 'setRes', 'setDiff']) $(id).addEventListener('change', () => $(id).dispatchEvent(new Event('input')));
  }
  _loadSettings() { const s = this.game.settings; $('setMaster').value = s.master; $('setSfx').value = s.sfx; $('setAmb').value = s.ambient; $('setMusic').value = s.music; $('setSens').value = s.sens;
    $('setInvert').checked = s.invertY; $('setShadows').checked = s.shadows; $('setGrass').value = String(s.grass); $('setView').value = s.viewDist; $('setRes').value = String(s.res); $('setDiff').value = String(s.enemyMul);
    $('setQuality').value = s.quality || 'custom'; $('setSsao').checked = !!s.ssao; $('setBloom').checked = !!s.bloom; $('setFxaa').checked = !!s.fxaa; $('setDetail').value = String(s.detail ?? 1); }

  // ---------- HUD ----------
  // feed de mortes no canto superior direito
  feed(html) { let box = $('killfeed'); if (!box) { box = document.createElement('div'); box.id = 'killfeed'; document.getElementById('hud').appendChild(box); } const t = document.createElement('div'); t.className = 'kf'; t.innerHTML = '💀 ' + html; box.appendChild(t); while (box.children.length > 5) box.firstChild.remove(); setTimeout(() => t.classList.add('out'), 9000); setTimeout(() => t.remove(), 9600); }
  // aviso grande de perigo no centro
  danger(msg) { let d = $('dangerMsg'); if (!d) { d = document.createElement('div'); d.id = 'dangerMsg'; document.getElementById('hud').appendChild(d); } d.textContent = msg; d.classList.remove('show'); void d.offsetWidth; d.classList.add('show'); }
  // granada de luz: branco total e clareando no último segundo e meio
  // granada de luz (como no CS): tela toda branca; ao voltar, o branco vai sumindo e a imagem fica turva até normalizar
  flash(t) { const el = this._flashEl || (this._flashEl = document.getElementById('flashOv')); if (!el) return; const o = t <= 0 ? 0 : t >= 2.2 ? 1 : Math.pow(t / 2.2, 1.6); const bl = t <= 0 ? 0 : Math.min(10, t * 3.2);
    const key = o.toFixed(3) + '|' + bl.toFixed(1); if (el._k === key) return; el._k = key; el.style.opacity = o.toFixed(3); const cv = this._cv || (this._cv = document.querySelector('canvas')); if (cv) cv.style.filter = bl > 0.05 ? `blur(${bl.toFixed(1)}px) brightness(${(1 + o * 0.6).toFixed(2)})` : ''; }
  toast(msg, type = 'info') {
    const t = document.createElement('div'); t.className = 'toast ' + type; t.innerHTML = msg; const box = $('toasts'); box.appendChild(t);
    while (box.children.length > 6) box.firstChild.remove();
    setTimeout(() => t.classList.add('out'), 2600); setTimeout(() => t.remove(), 3100);
  }
  prompt(html) { const p = $('prompt'); if (!html) { if (!p.classList.contains('hidden')) p.classList.add('hidden'); return; } if (p._h !== html) { p.innerHTML = html; p._h = html; } p.classList.remove('hidden'); }
  update(dt) {
    const g = this.game, P = g.player, st = P.stats;
    this.hudT -= dt; if (this.hudT > 0) return; this.hudT = 0.1;
    if (this.open === 'power') this.renderPower();
    for (const k of ['hp', 'hunger', 'thirst', 'energy', 'stamina']) { const b = this.bars[k]; const v = Math.max(0, st[k]); b.fill.style.width = v + '%'; b.val.textContent = Math.round(v); b.el.classList.toggle('low', v < 20); }
    const e = g.env; const h = e.hours; $('clockDay').textContent = 'Dia ' + e.day; $('clockTime').textContent = String(Math.floor(h)).padStart(2, '0') + ':' + String(Math.floor((h % 1) * 60)).padStart(2, '0'); $('clockWeather').textContent = (e.isNight ? '☾ ' : '☀ ') + e.label;
    const deg = ((-g.cam.yaw * 180 / Math.PI) % 360 + 360 + 180) % 360; // 0 = norte (−Z)
    this.strip.style.transform = `translateX(${(this.strip.parentElement.clientWidth / 2) - (deg + 360) * this.pxPerDeg}px)`;
    const hm = $('homeMark'); if (g.home) { const a = Math.atan2(g.home[0] - P.pos[0], -(g.home[2] - P.pos[2])) * 180 / Math.PI; const hd = ((a % 360) + 360) % 360; hm.style.display = ''; hm.style.left = (hd + 360) * this.pxPerDeg + 'px'; } else hm.style.display = 'none';
    for (let i = 0; i < 8; i++) { const id = g.quick[i], n = id ? g.inv.count(id) : 0, s = id ? { id, qty: n } : null, el = this.hslots[i]; const ic = el.querySelector('.ic'); const key = id ? id + (n ? '' : '0') : ''; if (ic.dataset.k !== key) { ic.innerHTML = id ? this._icon(id) : ''; ic.dataset.k = key; } el.classList.toggle('empty', !!id && !n); el.querySelector('.q').textContent = n > 1 ? n : ''; el.classList.toggle('eq', !!id && g.equip.hand === id); el.title = s ? ITEMS[s.id].name : ''; }
    const hand = g.equip.hand; if (this._handK !== hand) { this._handK = hand; $('handIcon').innerHTML = hand ? this._icon(hand) : '✊'; } $('handName').textContent = hand ? (hand === 'jerrycan' ? `${ITEMS[hand].name} (${g.jerryFuel.toFixed(1)}/${g.vehicles.jerryCap()} L)` : ITEMS[hand].name) : 'Mãos';
    if (!g.vehicles.driving && !$('driveHud').classList.contains('hidden')) $('driveHud').classList.add('hidden');
    // munição, retícula (abre com a dispersão) e marcador de acerto
    const F = g.guns, gun = F && F.gun; const am = $('ammo'); am.classList.toggle('hidden', !gun);
    if (gun) { const m = F.mag(), rs = F.reserve(); $('ammoMag').textContent = F.reloading ? '↻' : m; $('ammoRes').textContent = gun.direct ? 'flechas' : rs; am.classList.toggle('direct', !!gun.direct); am.classList.toggle('low', !F.reloading && m <= Math.ceil(gun.mag * 0.25)); am.classList.toggle('reload', !!F.reloading); }
    // luneta: as marcas de compensação são calculadas pela queda real da bala a 100/200/300/400 m
    const scoped = !!(gun && F.scope && F.aimT > 0.9); const so = $('scope'); so.classList.toggle('hidden', !scoped); document.body.classList.toggle('scoped', scoped);
    if (scoped) { so.classList.toggle('s4', F.scope === 'scope4'); so.classList.toggle('s8', F.scope === 'scope8'); $('scopeMag').textContent = F.magX.toFixed(1).replace('.', ',') + 'x';
      for (let k = 1; k <= 4; k++) { const t = k * 100 / gun.speed, drop = 0.5 * 9.8 * t * t; so.style.setProperty('--m' + k, (Math.tan(Math.atan(drop / (k * 100))) / Math.tan(g.cam.fov / 2) * window.innerHeight / 2).toFixed(1) + 'px'); } }
    const ret = $('reticle'); ret.classList.toggle('hidden', !gun || scoped); { const gr = !!(gun && gun.grapple), ok = gr && F.grappleOK; ret.classList.toggle('gok', ok); ret.classList.toggle('gno', gr && !ok); $('crosshair').classList.toggle('gok', ok); $('crosshair').classList.toggle('gno', gr && !ok); const gd = $('grapDist'); gd.className = (!gr || g.grapple.busy ? 'hidden ' : '') + (ok ? 'gok' : 'gno'); if (gr) { gd.textContent = ok ? `${F.grappleDist.toFixed(0)} m` : 'fora de alcance'; } } $('crosshair').style.opacity = gun ? 0.9 : '';
    if (gun) { const sp = (F.aiming ? gun.spread : gun.hipSpread) * (1 + F.bloom * 2.2); const px = Math.max(3, Math.tan(sp) / Math.tan(g.cam.fov / 2) * window.innerHeight / 2); ret.style.setProperty('--s', px.toFixed(1) + 'px'); }
    const hk = $('hitmark'); hk.classList.toggle('hidden', !(F && F.hitMark > 0)); if (F && F.hitMark > 0) { hk.classList.toggle('kill', F.hitKill); hk.classList.toggle('head', !F.hitKill && F.lastHitRegion === 'head'); hk.style.opacity = Math.min(1, F.hitMark / 0.1); }
    $('vignette').style.opacity = st.hp < 25 ? 0.9 : st.energy < 15 ? 0.6 : g.player.inCave ? 0.4 : 0;
    $('hurt').style.opacity = Math.min(1, P.hurtFlash * 2.5 + (st.hp < 15 ? 0.25 : 0));
    $('caveTag').classList.toggle('hidden', !P.inCave);
    // estado: temperatura corporal, sangramento, veneno, molhado
    const tC = st.temp ?? 37; const tags = [];
    tags.push(`<span class="st ${tC < 35.5 ? 'bad cold' : tC > 38.8 ? 'bad hot' : ''}">🌡 ${tC.toFixed(1)}°C</span>`);
    if (st.bleed > 0) tags.push('<span class="st bad">🩸 Sangrando</span>'); if (st.poison > 0) tags.push('<span class="st bad">🧪 Envenenado</span>'); if (st.kuru) tags.push('<span class="st bad">🧠 Kuru</span>'); if (st.burntSick) tags.push('<span class="st bad">🤢 Enjoado</span>'); if (g.player.fainted > 0) tags.push('<span class="st bad">💫 Desmaiado</span>');
    if ((st.wet || 0) > 25) tags.push('<span class="st">💧 Molhado</span>');
    { let seen = false, hunted = false; for (const c of g.creatures.list) { if (c.dead || !(c.def.hostile || c.angry > 0)) continue; if (Math.abs(c.pos[0] - P.pos[0]) > 60 || Math.abs(c.pos[2] - P.pos[2]) > 60) continue; if ((c.seenT ?? 99) < 0.3 && c.state !== 'wander') seen = true; else if (c.state === 'chase' || c.state === 'search') hunted = true; }
      if (seen) tags.push('<span class="st bad">👁 Visto</span>'); else if (hunted) tags.push('<span class="st">❓ Procurando você</span>'); else if (P.crouch) tags.push('<span class="st ok">🥷 Furtivo</span>'); }
    if (g.equip.suit === 'ratsuit') tags.push('<span class="st suit">☣ R.A.T</span>'); { const tx = g.world.toxicAt(P.pos[0], P.pos[2]); if (tx > 0) tags.push(`<span class="st bad">☣ Zona tóxica ${Math.round(tx * 100)}%</span>`); }
    { const nc = g.inv.contaminated(); if (nc) tags.push(`<span class="st bad">☢ ${nc} item(ns) contaminado(s)</span>`); }
    // contador Geiger na mão: mostrador + barra da leitura na direção apontada
    { const G = g.geiger, on = G && G.active, el = $('geigerHud'); el.classList.toggle('hidden', !on);
      if (on) { const r = G.reading; $('ghFill').style.width = (r * 100).toFixed(1) + '%'; $('ghNeedle').style.transform = `rotate(${(-60 + r * 120).toFixed(1)}deg)`; $('ghVal').textContent = (r * 10).toFixed(2).replace('.', ',') + ' mSv/h';
        const [lb, cl] = G.label(); const lab = $('ghLabel'); lab.textContent = lb; lab.className = cl; el.dataset.lvl = cl; const src = G.raw > 0.02 ? G.src : 'Nenhuma radiação nessa direção'; if (src !== this._ghSrc) { this._ghSrc = src; $('ghSrc').textContent = src; } } }
    // barra e contagem de radiação acima das barras
    { const rad = st.rad || 0, ex = g.radExposed, rh = $('radHud'); const show = ex || rad > 0.3; rh.classList.toggle('hidden', !show);
      if (show) { rh.querySelector('.rfill').style.width = rad.toFixed(1) + '%'; $('radPct').textContent = Math.floor(rad) + '%'; const cont = rad >= 50; rh.classList.toggle('cont', cont); rh.classList.toggle('exp', !!ex);
        const mmss = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
        const info = cont ? `CONTAMINADO — tome o remédio antirradiação · morte em ${mmss((100 - rad) / (0.11 + (g.radRate || 0)))}` : ex ? `Exposto! Saia da área em ${mmss((50 - rad) / Math.max(1e-4, g.radRate))}` : 'Fora da área — a radiação está baixando';
        if (info !== this._radInfo) { this._radInfo = info; $('radInfo').textContent = info; } } }
    // símbolos das doenças acima das barras (cor = comprimido que cura)
    const C = [['poison', '☠', 'green', 'Toxinas / veneno / enjoo — comprimido verde'], ['fever', '🌡', 'orange', 'Febre / inflamação — comprimido laranja'], ['fatigue', '⚡', 'yellow', 'Fadiga / fraqueza — comprimido amarelo'], ['hypo', '❄', 'blue', 'Hipotermia — comprimido azul'], ['breath', '🫁', 'blue', 'Falta de ar — comprimido azul'], ['rad', '☢', 'white', 'Radiação — remédio antirradiação (frasco branco)'], ['bleed', '🩸', 'red', 'Sangramento — bandagem']];
    const ch = C.filter(([k]) => (k === 'rad' ? (st.rad || 0) >= 50 : (st[k] || 0) > 0.5)).map(([k, ic, col, tip]) => `<span class="cond ${col}" title="${tip}">${ic}${k === 'rad' ? `<small>${Math.round(st.rad)}</small>` : ''}</span>`).join('');
    if (ch !== this._cdHtml) { this._cdHtml = ch; $('conds').innerHTML = ch; }
    const html = tags.join(''); if (html !== this._stHtml) { this._stHtml = html; $('status').innerHTML = html; }
    for (const el of [...$('dmgDir').children]) { const t = (+el.dataset.t) - 1 / 60; el.dataset.t = t; el.style.opacity = Math.max(0, t); if (t <= 0) el.remove(); }
  }
  // indicador de direção do dano (ângulo relativo à câmera)
  damageFrom(rel) { const box = $('dmgDir'); if (!box) return; const el = document.createElement('i'); el.dataset.t = 1.2; el.style.transform = `rotate(${(-rel * 180 / Math.PI).toFixed(1)}deg)`; box.appendChild(el); if (box.children.length > 6) box.firstChild.remove(); }
  setBuildMode(type) {
    document.body.classList.toggle('building', !!type); $('buildHint').classList.toggle('hidden', !type);
    if (type) this.closePanels();
  }
  buildStatus(gh) {
    if (!gh) { $('buildHint').classList.add('hidden'); document.body.classList.remove('building'); return; }
    if (gh.struct) { $('buildHint').classList.remove('hidden'); document.body.classList.add('building');
      $('buildHint').innerHTML = `<div>${PIECES[gh.type].icon} <b>${PIECES[gh.type].name}</b> — ${costText(this.game.structCost(gh.type), this.game.inv)}</div><div class="st ${gh.valid ? 'ok' : 'no'}">${gh.valid ? 'Posição válida — clique para construir' : gh.reason}</div><div class="muted">Clique: construir · R/roda: girar · segure o botão direito: trocar peça · troque o item da mão para sair</div>`; return; }
    const d = PIECES[gh.type];
    $('buildHint').innerHTML = `<div>${d.icon} <b>${d.name}</b> — ${costText(d.cost, this.game.inv)}</div><div class="st ${gh.valid ? 'ok' : 'no'}">${gh.valid ? 'Posição válida' : gh.reason}</div><div class="muted">Clique/F: construir · R/roda: girar · X: desmontar · Esc/clique dir.: sair</div>`;
  }

  // ---------- Painéis ----------
  get anyOpen() { return !!this.open; }
  openPanel(name, opts = {}) {
    this.closePanels(true); this.open = name; this.game.input.exitLock();
    if (name === 'inv') { $('invPanel').classList.remove('hidden'); this.tab(opts.tab || 'inv'); }
    if (name === 'build') { $('buildPanel').classList.remove('hidden'); this.renderBuild(); }
    if (name === 'chest') { this.chest = opts.piece; $('chestPanel').classList.remove('hidden'); this.renderChest(); }
    if (name === 'fire') { this.fire = opts.piece; $('firePanel').classList.remove('hidden'); this.renderFire(); }
    if (name === 'power') { this.power = opts.piece; this._pwSig = null; $('powerPanel').classList.remove('hidden'); this.renderPower(); }
    if (name === 'map') this.game.map.open();
    if (name === 'vehicle') { this.veh = opts.v; this.veh._wasComplete = this.game.vehicles.complete(opts.v); $('vehiclePanel').classList.remove('hidden'); this.renderVehicle(); }
  }
  closePanels(silent) { if (this.game.admin && this.game.admin.isOpen) this.game.admin.close(true); for (const id of ['invPanel', 'buildPanel', 'chestPanel', 'firePanel', 'powerPanel', 'vehiclePanel']) $(id).classList.add('hidden'); if (this.veh) { const g = this.game, v = this.veh; this.veh = null; if (!v._wasComplete && g.vehicles.complete(v)) { g.audio.play('craft'); g.ui.toast(`🚗 Veículo montado! Abasteça com o galão e aperte E para dirigir.`, 'ok'); } } this.power = null; if (this.game.map) this.game.map.close(); const was = this.open; this.open = null; this.sel = null; this.chest = null; if (was && !silent) this.game.onPanelClosed(); }
  tab(t) { for (const b of document.querySelectorAll('.tabs button')) b.classList.toggle('on', b.dataset.tab === t); for (const p of document.querySelectorAll('#invPanel .pane')) p.classList.toggle('on', p.dataset.pane === t); this.curTab = t; this.refresh(); }
  refresh() { if (this.open === 'inv') { if (this.curTab === 'inv') this.renderInv(); if (this.curTab === 'craft') this.renderCraft(); if (this.curTab === 'equip') this.renderEquip(); if (this.curTab === 'skills') this.renderSkills(); } if (this.open === 'chest') this.renderChest(); if (this.open === 'build') this.renderBuild(); if (this.open === 'power') this.renderPower(true); }
  // caixa de pergunta Sim/Não dentro do jogo
  ask(text, yes, no) { document.querySelector('.askbox')?.remove(); const d = document.createElement('div'); d.className = 'askbox'; d.innerHTML = `<div class="askin"><p>${text}</p><div class="acts"><button class="y">Sim</button><button class="n">Não</button></div></div>`;
    document.body.appendChild(d); const close = () => d.remove(); d.querySelector('.y').onclick = () => { close(); yes && yes(); this.refresh(); }; d.querySelector('.n').onclick = () => { close(); no && no(); }; return d; }
  askAttachCell(i) { const g = this.game; if (g.equip.nvgCell != null) return this.toast('O óculos já tem bateria. Clique direito nele para tirar a atual.', 'warn'); this.ask('🔋 Anexar esta bateria ao óculos de visão noturna?', () => g.attachCell(i)); }
  askRemoveCell() { const g = this.game, c = g.equip.nvgCell; if (c == null) return this.toast('O óculos está sem bateria', 'info'); const pct = Math.round(c / 900 * 100);
    this.ask(c > 0 ? `Tirar a bateria do óculos? Ela ainda tem ${pct}% de carga${pct < 98 ? ' (uma bateria usada não volta a carregar)' : ''}.` : '🪫 A bateria acabou. Tirar a bateria do óculos?', () => g.removeCell()); }
  _icon(id) { const it = ITEMS[id]; if (id === 'nvg' && !(this.game.equip.nvgCell > 0)) return `<img class="iimg" draggable="false" src="assets/icons/nvg_off.png" alt="">`; return it.img ? `<img class="iimg" draggable="false" src="assets/icons/${it.img}.png" alt="">` : `<span class="iemo">${it.icon}</span>`; }
  _slotEl(s, i, onClick, sel) { const d = document.createElement('div'); d.className = 'slot' + (sel ? ' sel' : '') + (s && s.rad ? ' rad' : ''); d.innerHTML = s ? `${this._icon(s.id)}<span class="q">${s.qty > 1 ? s.qty : ''}</span>` : ''; if (s) d.title = ITEMS[s.id].name + (s.rad ? ' (contaminado)' : ''); d.onclick = onClick; return d; }
  // inventário em grade: bolsos + mochila; cada item ocupa células conforme o tamanho
  renderInv() {
    const g = this.game, inv = g.inv, C = 46;
    // boneco com os espaços de roupa ao redor (chapéu, camisa, colete, luvas, calça, sapatos) + R.A.T, mochila, mão e 2 armas nas costas
    const ec = $('equipCol'); ec.innerHTML = '<h3 class="hbtitle">Equipamento</h3>'; const doll = document.createElement('div'); doll.className = 'doll';
    const SN = { hat: ['Chapéu', '🧢'], shirt: ['Camisa', '👕'], vest: ['Colete', '🦺'], gloves: ['Luvas', '🧤'], pants: ['Calça', '👖'], shoes: ['Sapatos', '👟'], suit: ['Roupa R.A.T', '☣'], back: ['Mochila', '🎒'], hand: ['Mão', '✊'], backA: ['Costas (dir.)', '🎽'], backB: ['Costas (esq.)', '🎽'] };
    const eslot = (k, area) => { const id = g.equip[k]; const d = document.createElement('div'); d.className = 'eqs' + (id ? ' on' : '') + (k === 'suit' && id ? ' rat' : ''); d.dataset.eq = k; d.style.gridArea = area;
      const it = id && ITEMS[id]; const max = it && it.dur, cur = g.equip.dur && g.equip.dur[k]; const durBar = k === 'hat' && id === 'nvg' ? `<div class="dur nv"><i style="width:${Math.max(0, Math.min(100, (g.equip.nvgCell || 0) / 9))}%"></i></div>` : max && max < 9000 && cur !== undefined ? `<div class="dur"><i style="width:${Math.max(0, Math.min(100, cur / max * 100)).toFixed(0)}%"></i></div>` : '';
      d.innerHTML = `<small>${SN[k][0]}</small><div class="ic">${id ? this._icon(id) : `<span class="muted">${SN[k][1]}</span>`}</div>${durBar}`; d.title = id ? `${it.name}${it.pockets ? ` · ${it.pockets[0] * it.pockets[1]} bolsos` : ''}${it.armor ? ` · proteção ${Math.round(it.armor * 100)}%` : ''} — ${k === 'backA' || k === 'backB' ? 'clique: segurar na mão · clique direito: guardar no inventário' : k === 'hand' ? 'clique para guardar' : 'clique para tirar'}` : `${SN[k][0]}: vazio`;
      if (id) { d.onclick = () => { if (k === 'backA' || k === 'backB') { g.equip.hand = g.equip.hand === id ? null : id; g.audio.play('pickup'); } else g.unequip(k); this.refresh(); }; d.oncontextmenu = (e) => { e.preventDefault(); if (k === 'hat' && id === 'nvg') return this.askRemoveCell(); g.unequip(k); this.refresh(); }; }
      if ((CLOTH_SLOTS.includes(k) || k === 'back') && g.equip.suit) d.classList.add('off'); doll.appendChild(d); };
    doll.innerHTML = `<svg class="sil" viewBox="0 0 60 120"><circle cx="30" cy="13" r="10"/><rect x="17" y="25" width="26" height="38" rx="8"/><rect x="6" y="27" width="9" height="34" rx="4"/><rect x="45" y="27" width="9" height="34" rx="4"/><rect x="18" y="62" width="10" height="50" rx="4"/><rect x="32" y="62" width="10" height="50" rx="4"/></svg>`;
    eslot('hat', 'a'); eslot('shirt', 'b'); eslot('pants', 'c'); eslot('vest', 'd'); eslot('gloves', 'e'); eslot('shoes', 'f'); eslot('suit', 'g'); eslot('back', 'h'); eslot('hand', 'i'); eslot('backA', 'j'); eslot('backB', 'k');
    ec.appendChild(doll); { const av = g.armorVal(), wv = g.warmVal(); const p2 = document.createElement('div'); p2.className = 'muted dollinfo'; p2.textContent = `Proteção ${Math.round(av * 100)}% · Aquecimento ${wv.toFixed(1)}`; ec.appendChild(p2); }
    // barra rápida
    const hb = $('invHotbar'); hb.innerHTML = '';
    g.quick.forEach((id, k) => { const d = document.createElement('div'); d.className = 'slot qs' + (id && g.equip.hand === id ? ' eq' : '') + (k === 2 || k === 3 ? ' gapL' : ''); d.dataset.quick = k; const n = id ? g.inv.count(id) : 0;
      d.innerHTML = `<span class="k">${k + 1}</span>` + (id ? `${this._icon(id)}<span class="q">${n > 1 ? n : n === 0 ? '0' : ''}</span>` : ''); if (id && !n) d.classList.add('empty'); d.title = id ? ITEMS[id].name + ' (clique para desassociar)' : (k < 2 ? 'Arma grande (fuzil, escopeta, machado, picareta…)' : k === 2 ? 'Pistola ou faca' : 'Outros itens');
      d.onclick = () => { if (id) { g.quick[k] = null; this.renderInv(); } }; hb.appendChild(d); });
    // grades
    const box = $('invGrids'); box.innerHTML = ''; this.multi = this.multi || new Set();
    { const tb = document.createElement('div'); tb.className = 'invtools'; const nSel = this.multi.size;
      tb.innerHTML = `<button class="itb" data-a="org" title="O — organizar tudo">O</button><span class="muted">${nSel ? `${nSel} selecionado(s) · SHIFT+clique seleciona` : 'SHIFT+clique seleciona vários · arraste para fora para largar'}</span><button class="itb drop" data-a="drop" title="Largar ${nSel ? 'os selecionados' : 'tudo'} no chão">⬇</button>`;
      tb.querySelector('[data-a=org]').onclick = () => { const o = g.inv.organize(); if (o.length) g.dropNear(o.map((e) => [e.id, e.qty])); this.multi.clear(); g.audio.play('ui'); this.renderInv(); };
      tb.querySelector('[data-a=drop]').onclick = (ev) => { const btn = ev.currentTarget; if (!btn.classList.contains('arm')) { btn.classList.add('arm'); btn.textContent = 'Confirmar ⬇'; setTimeout(() => { btn.classList.remove('arm'); btn.textContent = '⬇'; }, 2500); return; } this.dropMany(); };
      box.appendChild(tb); }
    inv.conts.forEach((c, ci) => { const wrap = document.createElement('div'); wrap.className = 'gwrap'; wrap.innerHTML = `<h3 class="hbtitle">${c.name} <span class="muted">${c.w}×${c.h}</span></h3>`;
      const gr = document.createElement('div'); gr.className = 'igrid'; gr.style.width = c.w * C + 'px'; gr.style.height = c.h * C + 'px'; gr.dataset.cont = ci; gr.style.setProperty('--c', C + 'px');
      for (const [i, e] of inv.items.entries()) { if (e.c !== ci) continue; const [w, h] = inv.dims(e); const el = document.createElement('div'); el.className = 'gitem' + (this.sel === i ? ' sel' : '') + (e.rad ? ' rad' : '') + (g.equip.hand === e.id ? ' eq' : '');
        el.style.left = e.x * C + 'px'; el.style.top = e.y * C + 'px'; el.style.width = w * C - 2 + 'px'; el.style.height = h * C - 2 + 'px'; el.dataset.idx = i;
        el.innerHTML = `<div class="gimg${e.rot ? ' rot' : ''}" style="--w:${w * C}px;--h:${h * C}px">${this._icon(e.id)}</div><span class="q">${e.qty > 1 ? e.qty : ''}</span>${e.rad ? '<span class="radb">☢</span>' : ''}`;
        el.title = ITEMS[e.id].name + (e.rad ? ' — contaminado por radiação' : ''); if (this.multi.has(i)) el.classList.add('msel'); el.onclick = (ev) => { if (ev.shiftKey) { if (this.multi.has(i)) this.multi.delete(i); else this.multi.add(i); this.renderInv(); return; } this.sel = this.sel === i ? null : i; this.renderInv(); }; if (e.id === 'nvg') el.oncontextmenu = (ev) => { ev.preventDefault(); this.askRemoveCell(); }; if (ITEMS[e.id].type === 'book') el.oncontextmenu = (ev) => { ev.preventDefault(); const known = g.skills.has(ITEMS[e.id].skill); this.ctxMenu(ev, [[known ? '📖 Ler (já sabe)' : '📖 Ler', () => g.readBook(i)], ['Descartar', () => { g.dropFromSlot(i, 1); this.sel = null; }]]); }; this._dragItem(el, i); gr.appendChild(el); }
      wrap.appendChild(gr); box.appendChild(wrap); });
    { const kg = g.carryKg ?? inv.kg(); $('invCap').classList.toggle('heavy', kg > 25); }
    $('invCap').textContent = `Peso: ${(g.carryKg ?? inv.kg()).toFixed(1)} kg${(g.carryKg ?? 0) > 25 ? ' (pesado: você fica mais lento)' : ' / 25 kg sem perder velocidade'} · Ocupado: ${inv.used()}/${inv.size} células${inv.contaminated() ? ` · ☢ ${inv.contaminated()} item(ns) contaminado(s): lave num rio com sabonete líquido` : ''} · arraste para mover · ESPAÇO (ou R) gira ao arrastar`;
    const det = $('invDetail'); const s = this.sel !== null ? inv.slots[this.sel] : null;
    if (!s) { det.innerHTML = '<p class="muted">Clique num item para ver as ações. Arraste itens dentro da grade para organizar, ou para a barra rápida (1–6) para usar pela tecla.</p>'; return; }
    const it = ITEMS[s.id]; const idx = this.sel; const [w, h] = inv.dims(s);
    det.innerHTML = `<div class="dico">${this._icon(s.id)}</div><h3>${it.name}</h3><p>${it.desc}</p><p class="muted">Quantidade: ${s.qty} · ocupa ${w}×${h}${s.rad ? ' · <b class="radt">☢ contaminado</b>' : ''}</p><div class="acts"></div>`;
    const acts = det.querySelector('.acts'); const add = (label, fn) => { const b = document.createElement('button'); b.textContent = label; b.onclick = () => { fn(); this.refresh(); }; acts.appendChild(b); };
    if (it.type === 'food') add('Comer', () => g.consume(idx)); if (it.type === 'drink') add('Beber', () => g.consume(idx)); if (it.type === 'medical') add(it.pill ? 'Tomar comprimido' : it.bottle ? 'Tomar remédio' : 'Usar', () => g.consume(idx));
    if (it.type === 'tool') add(g.equip.hand === s.id ? 'Guardar da mão' : 'Empunhar', () => (g.equip.hand === s.id ? g.unequip('hand') : g.equipFromSlot(idx)));
    if (it.place && PIECES[it.place]) add(`Posicionar ${PIECES[it.place].name.toLowerCase()}`, () => { if (!g.inv.has(PIECES[it.place].cost)) return this.toast(`Precisa de: ${Object.entries(PIECES[it.place].cost).map(([k, n]) => n + '× ' + ITEMS[k].name).join(', ')}`, 'warn'); this.closePanels(true); g.build.start(it.place); g.onPanelClosed(); });
    if (it.slot || it.type === 'backpack' || it.type === 'suit') add(it.type === 'backpack' ? 'Equipar mochila' : 'Vestir', () => g.equipFromSlot(idx)); if (LARGE.has(s.id)) add('Pôr nas costas', () => g.invToBack(idx, !g.equip.backA ? 'backA' : 'backB')); if (it.type === 'attachment') add('Encaixar na arma da mão', () => g.attachScope(idx));
    if (s.id === 'nvg') { if (g.equip.nvgCell != null) add('Tirar bateria', () => this.askRemoveCell()); }
    if (it.type === 'book') add(g.skills.has(it.skill) ? '📖 Ler (já sabe)' : '📖 Ler', () => g.readBook(idx));
    if (s.id === 'nvcell' && (g.equip.hat === 'nvg' || g.countAll('nvg') > 0)) add('Anexar ao óculos', () => this.askAttachCell(idx));
    if (['tool', 'food', 'drink', 'medical'].includes(it.type)) add(g.quick.includes(s.id) ? `Na barra (tecla ${g.quick.indexOf(s.id) + 1})` : 'Pôr na barra rápida', () => g.bindQuick(s.id));
    add('Descartar 1', () => { g.dropFromSlot(idx, 1); this.sel = null; }); if (s.qty > 1) add('Descartar tudo', () => { g.dropFromSlot(idx, s.qty); this.sel = null; });
    if (s.qty > 1) add('Dividir', () => { if (!inv.split(idx)) this.toast('Sem espaço para dividir', 'warn'); });
  }
  // larga no chão os itens selecionados (SHIFT) ou, sem seleção, tudo
  dropMany() { const g = this.game; const idx = this.multi && this.multi.size ? [...this.multi] : g.inv.items.map((_, k) => k); const list = idx.map((k) => g.inv.items[k]).filter(Boolean);
    for (const e of list) { const k = g.inv.items.indexOf(e); if (k >= 0) g.dropFromSlot(k, e.qty); } this.multi.clear(); this.sel = null; g.audio.play('drop'); this.refresh(); }
  // arrastar item na grade (com R para girar) ou para a barra rápida / equipamento
  _dragItem(el, i) {
    el.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return; const g = this.game, inv = g.inv, e0 = inv.items[i]; if (!e0) return; const start = [e.clientX, e.clientY]; let ghost = null, rot = e0.rot ? 1 : 0; const C = 46;
      const r0 = el.getBoundingClientRect(); const off = [start[0] - r0.left, start[1] - r0.top];
      const key = (ev) => { if (ghost && (ev.key === 'r' || ev.key === 'R' || ev.code === 'Space')) { ev.preventDefault(); rot = rot ? 0 : 1; const [w, h] = itemSize(e0.id); const [ww, hh] = rot ? [h, w] : [w, h]; ghost.style.width = ww * C - 2 + 'px'; ghost.style.height = hh * C - 2 + 'px'; } };
      const move = (ev) => { if (!ghost && Math.hypot(ev.clientX - start[0], ev.clientY - start[1]) > 6) { ghost = el.cloneNode(true); ghost.classList.add('ghost', 'gghost'); document.body.appendChild(ghost); el.classList.add('dragging'); window.addEventListener('keydown', key); }
        if (ghost) { ghost.style.left = ev.clientX - Math.min(off[0], 20) + 'px'; ghost.style.top = ev.clientY - Math.min(off[1], 20) + 'px'; } };
      const up = (ev) => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('keydown', key);
        if (!ghost) return; ghost.remove(); el.classList.remove('dragging'); this._justDragged = true; setTimeout(() => (this._justDragged = false), 0);
        const t = document.elementFromPoint(ev.clientX, ev.clientY); const q = t && t.closest && t.closest('[data-quick]'), gr = t && t.closest && t.closest('[data-cont]'), eq = t && t.closest && t.closest('[data-eq]');
        const inPanel = t && t.closest && t.closest('#invPanel, #chestPanel');
        if (q) { g.bindQuick(e0.id, +q.dataset.quick); g.audio.play('ui'); }
        else if (e0.id === 'nvcell' && ((eq && eq.dataset.eq === 'hat' && g.equip.hat === 'nvg') || (t.closest('.gitem') && inv.items[+t.closest('.gitem').dataset.idx]?.id === 'nvg'))) this.askAttachCell(i);
        else if (eq) { const k = eq.dataset.eq, it0 = ITEMS[e0.id], ty = it0.type; if (k === 'backA' || k === 'backB') g.invToBack(i, k); else if ((k === 'hand' && ty === 'tool') || (it0.slot && it0.slot === k) || (k === 'back' && ty === 'backpack') || (k === 'suit' && ty === 'suit')) g.equipFromSlot(i); else this.toast('Esse item não vai nesse espaço', 'warn'); }
        else if (!inPanel) { if (this.multi.has(i) && this.multi.size > 1) this.dropMany(); else { g.dropFromSlot(i, e0.qty); this.multi.clear(); } this.sel = null; }
        else if (gr) { const rc = gr.getBoundingClientRect(); const x = Math.floor((ev.clientX - Math.min(off[0], 20) - rc.left + C / 2) / C), y = Math.floor((ev.clientY - Math.min(off[1], 20) - rc.top + C / 2) / C);
          if (inv.moveTo(i, +gr.dataset.cont, x, y, rot)) { g.audio.play('ui'); this.sel = null; } else this.toast('Não cabe aí', 'warn'); }
        this.renderInv(); };
      window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
    });
    el.addEventListener('click', (e) => { if (this._justDragged) e.stopImmediatePropagation(); }, true);
  }
  renderCraft() {
    const g = this.game, list = $('craftList'); list.innerHTML = '';
    const bench = g.nearPiece('bench', 3.5), fire = g.nearPiece('campfire', 3, (p) => p.lit);
    $('craftStation').innerHTML = `Estações próximas: ${bench ? '🛠️ Bancada ✔' : '🛠️ Bancada ✘'} · ${fire ? '🔥 Fogueira acesa ✔' : '🔥 Fogueira acesa ✘'}`;
    // estações de trabalho: fogueira e bancada podem ser construídas direto daqui
    const head = (t) => { const h = document.createElement('div'); h.className = 'craftHead'; h.textContent = t; list.appendChild(h); };
    head('Estações (posicionar no chão)');
    for (const type of ['campfire', 'bench']) {
      const pc = PIECES[type]; const skOk = g.hasSkillFor(type); const can = skOk && g.inv.has(pc.cost); const el = document.createElement('div'); el.className = 'recipe' + (skOk ? '' : ' locked noskill');
      el.innerHTML = `<div class="ic">${pc.icon}</div><div><div class="nm">${pc.name}</div><div class="muted">${pc.desc}${type === 'bench' ? ' Necessária para receitas marcadas com "requer bancada".' : ' Acenda-a para cozinhar.'}</div><div class="cost">${costText(pc.cost, g.inv)}</div></div>`;
      const b = document.createElement('button'); b.textContent = 'Construir'; b.disabled = !can; b.dataset.piece = type; b.onclick = () => { this.closePanels(true); g.build.start(type); g.onPanelClosed(); }; el.appendChild(b); list.appendChild(el);
    }
    head('Itens');
    for (const r of RECIPES) { if (FIRE.isCookRecipe(r)) continue; // assar é na grelha da fogueira (E na fogueira)
      const it = ITEMS[r.out]; const sk = SKILL_OF[r.id], skOk = g.hasSkillFor(r.id); const stOk = !r.station || (r.station === 'bench' && bench) || (r.station === 'fire' && fire); const can = skOk && stOk && g.inv.has(r.cost);
      const d = document.createElement('div'); d.className = 'recipe' + (stOk && skOk ? '' : ' locked') + (skOk ? '' : ' noskill');
      d.innerHTML = `<div class="ic">${this._icon(r.out)}</div><div><div class="nm">${it.name}${r.station ? ` <span class="muted">· requer ${r.station === 'bench' ? 'bancada' : 'fogueira acesa'}</span>` : ''}</div><div class="muted">${it.desc}</div>${skOk ? '' : `<div class="lk">🔒 Precisa da habilidade ${g.skillName(sk)}</div>`}<div class="cost">${costText(r.cost, g.inv)}</div></div>`;
      const b = document.createElement('button'); b.textContent = !skOk ? '🔒' : r.station === 'fire' ? 'Cozinhar' : 'Fabricar'; b.disabled = !can; b.dataset.recipe = r.id; b.onclick = () => { g.craft(r); this.refresh(); }; d.appendChild(b); list.appendChild(d);
    }
  }
  // menu do veículo: arraste as peças do inventário para os encaixes (pneus, motor, câmbio)
  renderVehicle() { const g = this.game, v = this.veh; if (!v) return; const VS = g.vehicles, VEH = VEHMOD; const T = VEH.VTYPES[v.type]; $('vehTitle').textContent = `${T.moto ? '🏍' : '🚗'} ${VEH.vName(v)}`;
    const body = $('vehBody'); const skill = g.skills.has('mecanica'); const slots = []; for (let i = 0; i < T.wheels; i++) slots.push({ key: 'wheels', i, item: T.tire, on: v.wheels > i, label: T.moto ? (i ? 'Pneu traseiro' : 'Pneu dianteiro') : ['Pneu diant. esq.', 'Pneu diant. dir.', 'Pneu tras. esq.', 'Pneu tras. dir.'][i] });
    slots.push({ key: 'engine', item: T.engine, on: v.engine, label: T.moto ? 'Motor de moto' : 'Motor' }); slots.push({ key: 'gear', item: 'gearbox', on: v.gear, label: 'Câmbio (engrenagens)' });
    const need = VS.missing(v); const pct = Math.round(v.fuel / T.tank * 100);
    body.innerHTML = `<div class="vehwrap"><div><div class="vstat">${need.length ? `Faltam: <b>${need.join(', ')}</b>` : '<b class="ok">✔ Completo — saia do menu, abasteça e aperte E para dirigir</b>'}</div>${skill ? '' : '<div class="lk">🔒 Precisa da habilidade Mecânica para instalar peças (leia o livro)</div>'}
      <div class="vslots ${T.moto ? 'moto' : 'car'}">${slots.map((s, k) => `<div class="vslot ${s.on ? 'on' : ''} ${s.key}" data-vs="${k}" title="${s.label}"><div class="vi">${s.on ? ITEMS[s.item].icon : '➕'}</div><small>${s.label}</small></div>`).join('')}</div>
      <div class="vfuel">⛽ Combustível: ${v.fuel.toFixed(1)} / ${T.tank} L<div class="fb"><i style="width:${pct}%"></i></div></div></div>
      <div><h3 class="hbtitle">Suas peças <span class="muted">— arraste até o encaixe (ou clique)</span></h3><div class="vparts"></div><p class="muted">Clique com o botão direito num encaixe preenchido para tirar a peça.</p></div></div>`;
    const parts = body.querySelector('.vparts'); const ids = [T.tire, T.engine, 'gearbox']; let any = false;
    for (const id of ids) { const n = g.inv.count(id); if (!n) continue; any = true; const d = document.createElement('div'); d.className = 'vpart'; d.dataset.id = id; d.innerHTML = `<div class="vi">${ITEMS[id].icon}</div><div>${ITEMS[id].name}<br><span class="muted">× ${n}</span></div>`; parts.appendChild(d);
      d.addEventListener('pointerdown', (e) => { if (e.button !== 0) return; const gh = d.cloneNode(true); gh.classList.add('vghost'); document.body.appendChild(gh); const mv = (ev) => { gh.style.left = ev.clientX - 30 + 'px'; gh.style.top = ev.clientY - 20 + 'px'; }; mv(e);
        const up = (ev) => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); gh.remove(); const t = document.elementFromPoint(ev.clientX, ev.clientY); const sl = t && t.closest && t.closest('[data-vs]');
          if (sl) this._vInstall(slots[+sl.dataset.vs], id); else if (Math.hypot(ev.clientX - e.clientX, ev.clientY - e.clientY) < 6) { const s = slots.find((q) => !q.on && q.item === id); if (s) this._vInstall(s, id); } };
        window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up); }); }
    if (!any) parts.innerHTML = `<p class="muted">Você não tem peças para este veículo. Procure ${T.moto ? 'pneus de moto, motor de moto e câmbio' : 'pneus e motor'} em indústrias, carros abandonados, vilarejos, bases militares e na lojinha dos postos.</p>`;
    body.querySelectorAll('[data-vs]').forEach((el) => { const s = slots[+el.dataset.vs]; el.onclick = () => { if (!s.on && g.inv.count(s.item)) this._vInstall(s, s.item); };
      el.oncontextmenu = (e) => { e.preventDefault(); if (!s.on) return; if (s.key === 'wheels' && s.i !== v.wheels - 1) return this.toast('Tire primeiro o último pneu colocado', 'info'); if (g.inv.add(s.item, 1) < 1) return this.toast('Inventário cheio', 'warn'); if (s.key === 'wheels') v.wheels--; else v[s.key] = false; g.audio.play('cloth'); this.renderVehicle(); }; }); }
  _vInstall(s, id) { const g = this.game, v = this.veh; if (!v || s.on) return; if (s.item !== id) return this.toast('Essa peça não vai nesse encaixe', 'warn'); if (!g.skills.has('mecanica')) return this.toast('🔒 Precisa da habilidade Mecânica (encontre e leia o livro)', 'warn');
    if (g.inv.count(id) < 1) return; if (s.key === 'wheels' && s.i !== v.wheels) { s = { ...s, i: v.wheels }; } g.inv.remove(id, 1); if (s.key === 'wheels') v.wheels++; else v[s.key] = true; g.audio.play('craft'); this.renderVehicle(); }
  // roda de opções do projeto/martelo
  radial(R) { const el = this._rdEl || (this._rdEl = $('radial')); if (!el) return; if (!R) { el.classList.add('hidden'); this._rdKey = null; return; } el.classList.remove('hidden');
    const key = R.kind + R.opts.map((o) => o.id + o.label).join('|'); if (this._rdKey !== key) { this._rdKey = key; el.querySelectorAll('.ro').forEach((n) => n.remove()); const n = R.opts.length, rr = n > 6 ? 165 : 130;
      R.opts.forEach((o, i) => { const a = i / n * Math.PI * 2; const d = document.createElement('div'); d.className = 'ro'; d.style.left = (220 + Math.sin(a) * rr) + 'px'; d.style.top = (220 - Math.cos(a) * rr) + 'px'; d.innerHTML = `<b>${o.icon}</b>${o.label}`; el.appendChild(d); }); }
    el.querySelectorAll('.ro').forEach((n, i) => n.classList.toggle('on', i === R.sel)); const o = R.opts[R.sel]; el.querySelector('.rc').innerHTML = o ? `${o.label}${o.sub ? `<small>${o.sub}</small>` : ''}` : (R.kind === 'build' ? 'Mova o mouse até a peça e solte o botão' : 'Mova o mouse e solte'); }
  // barra de força do arremesso: gradiente verde→amarelo→vermelho com o marcador preto; mostra o tempo do pino
  throwBar(pw, fuse) { const el = this._tbEl || (this._tbEl = $('throwBar')); if (!el) return; if (pw === null || pw === undefined) { if (!el.classList.contains('hidden')) el.classList.add('hidden'); return; }
    el.classList.remove('hidden'); el.querySelector('.tbm').style.left = (pw * 100).toFixed(1) + '%'; const z = pw < 1 / 3 ? 'Perto' : pw < 2 / 3 ? 'Médio' : 'Longe';
    el.querySelector('.tbl').textContent = `💣 ${Math.max(0, fuse).toFixed(1).replace('.', ',')} s · ${z}`; }
  fuelBars(o) { const el = $('fuelBars'); if (!o) { el.classList.add('hidden'); return; } el.classList.remove('hidden'); el.querySelector('.fbl').textContent = o.label; el.querySelector('.c').style.width = (o.canMax ? Math.min(100, o.can / o.canMax * 100) : 0) + '%'; el.querySelector('.cv').textContent = `${o.can.toFixed(1)}/${o.canMax} L`;
    el.querySelector('.t').style.width = Math.min(100, o.tank / o.tankMax * 100) + '%'; el.querySelector('.tv').textContent = `${o.tank.toFixed(1)} L`; el.querySelector('.tl').textContent = o.tankLabel; }
  driveHud(v, T) { const el = $('driveHud'); el.classList.remove('hidden'); el.querySelector('.spd').textContent = Math.round(Math.abs(v.speed) * 3.6); el.querySelector('i').style.width = (v.fuel / T.tank * 100).toFixed(1) + '%'; el.querySelector('.nm').textContent = `⛽ ${v.fuel.toFixed(1)} L · E para sair`; }
  renderSkills() { const g = this.game, box = $('skillList'); box.innerHTML = '';
    for (const s of SKILLS) { const on = g.skills.has(s.id); const unl = [...RECIPES.filter((r) => SKILL_OF[r.id] === s.id).map((r) => ITEMS[r.out].name), ...Object.keys(PIECES).filter((k) => SKILL_OF[k] === s.id).map((k) => PIECES[k].name)];
      const d = document.createElement('div'); d.className = 'skill' + (on ? ' on' : ''); d.innerHTML = `<img class="bk" src="assets/icons/book_${s.id}.png" draggable="false" alt=""><div><div class="nm">${s.name} ${on ? '<span class="ok">✔ liberada</span>' : '<span class="lk">🔒 encontre o livro</span>'}</div><div class="muted">${s.desc}</div>${unl.length ? `<div class="unl">Libera: ${unl.join(', ')}</div>` : ''}<div class="where">📍 ${s.where}</div></div>`; box.appendChild(d); } }
  readProgress(p) { const el = $('readRing'); if (p === null || p === undefined) { el.classList.add('hidden'); return; } el.classList.remove('hidden'); el.querySelector('.rr').style.setProperty('--p', (p * 100).toFixed(1) + '%'); el.querySelector('.rrtx').textContent = p >= 1 ? 'Concluído!' : `Lendo… ${Math.round(p * 100)}%`; }
  ctxMenu(ev, entries) { document.querySelector('.ctxm')?.remove(); const m = document.createElement('div'); m.className = 'ctxm'; m.style.left = ev.clientX + 'px'; m.style.top = ev.clientY + 'px';
    for (const [label, fn] of entries) { const b = document.createElement('button'); b.textContent = label; b.onclick = (e) => { e.stopPropagation(); m.remove(); fn(); this.refresh(); }; m.appendChild(b); }
    document.body.appendChild(m); setTimeout(() => window.addEventListener('pointerdown', function off(e) { if (!m.contains(e.target)) { m.remove(); window.removeEventListener('pointerdown', off, true); } }, true), 0); }
  renderEquip() { const g = this.game, box = $('equipSlots'); box.innerHTML = ''; const st = g.player.stats; const prot = g.equip.suit ? 'Protegido da névoa tóxica e da radiação (R.A.T).' : 'Sem proteção contra a névoa tóxica.';
    const arm = g.armorVal(); box.innerHTML = `<div class="eslot wide"><small>Proteção</small><div>${Math.round(arm * 100)}% de redução de dano</div><div class="muted">${prot}</div><div class="muted">Radiação no corpo: ${Math.round(st.rad || 0)}%</div></div>`; }
  // painel de aparelho elétrico: rede, conexões, fios e (na impressora) filamento e impressões
  renderPower(force) {
    const g = this.game, p = this.power; if (!p || !g.build.pieces.includes(p)) return this.closePanels(true); const PW = g.power; const net = PW.netOf(p); const d = p.data;
    const W = (x) => `${Math.round(x)} W`, kj = (x) => `${(x / 1000).toFixed(1)} kJ`;
    const sig = JSON.stringify([d.links, d.filament, d.tray, d.job && Math.floor(d.job.t), d.charge && Math.floor(d.charge / 50), net && [net.hub, Math.round(net.gen), net.use, Math.floor(net.stored / 50), net.ok], Math.round(p.out || 0), g.inv.count('copperwire'), g.inv.count('filament'), p.powered]);
    if (!force && sig === this._pwSig) return; this._pwSig = sig;
    $('powerTitle').textContent = `${PIECES[p.type].icon} ${PIECES[p.type].name}`;
    const net0 = !d.links.length ? '<span class="no">Desconectado — puxe um fio de cobre até um painel elétrico.</span>' : !net.hub ? '<span class="no">Rede sem painel elétrico — ligue a rede a um painel.</span>' : `<span class="ok">Rede ligada</span> · gerando <b>${W(net.gen)}</b> · consumo <b>${W(net.use)}</b>${net.cap ? ` · baterias <b>${Math.round(net.stored / net.cap * 100)}%</b> (${kj(net.stored)} de ${kj(net.cap)})` : ' · sem bateria'}`;
    let h = `<div class="pwbox"><div>${net0}</div>`;
    if (PIECES[p.type].power === 'gen') { const why = p.type === 'solar' && (p.out || 0) < 3 ? ' (sem sol agora)' : p.type === 'waterwheel' && !d.water ? ' (sem água corrente por perto)' : ''; h += `<div>Produzindo agora: <b>${W(p.out || 0)}</b>${why}</div>`; }
    if (p.type === 'battery') h += `<div>Carga: <b>${Math.round(d.charge / BATT_CAP * 100)}%</b> (${kj(d.charge)} de ${kj(BATT_CAP)})</div><div class="pbar"><i style="width:${(d.charge / BATT_CAP * 100).toFixed(1)}%"></i></div>`;
    h += `</div><h3 class="hbtitle">Conexões (fio de cobre)</h3><div class="pwlinks">`;
    for (const u of d.links) { const o = PW.byUid(u); if (!o) continue; h += `<div class="pwl">${PIECES[o.type].icon} ${PIECES[o.type].name} <span class="muted">${PW.dist(p, o).toFixed(1)} m</span><button data-unlink="${u}">Desconectar</button></div>`; }
    if (!d.links.length) h += '<div class="muted">Nenhuma ligação.</div>';
    h += `</div><div class="acts"><button id="pwWire" ${g.inv.count('copperwire') ? '' : 'disabled'}>〰️ Puxar fio daqui (${g.inv.count('copperwire')} fio(s) na mochila · 1 fio a cada 5 m · máx ${WIRE_MAX} m)</button></div>`;
    if (p.type === 'printer') {
      const j = d.job; h += `<h3 class="hbtitle">Impressora 3D</h3><div class="pwbox"><div>Filamento carregado: <b>${d.filament}</b>/20 <span class="muted">(${g.inv.count('filament')} na mochila)</span></div><div class="acts"><button data-fil="1">Colocar 1 filamento</button><button data-fil="20">Colocar todos</button></div>`;
      if (j) h += `<div>${j.t >= 0 && p.powered ? '🖨️ Imprimindo' : '⏸️ Pausada — sem energia'} <b>${ITEMS[j.out].name}</b> · ${Math.floor(j.t)}/${j.time} s</div><div class="pbar"><i style="width:${(j.t / j.time * 100).toFixed(1)}%"></i></div>`;
      if (d.tray.length) h += `<div>Pronto na bandeja: ${d.tray.map(([id, n]) => `${ITEMS[id].icon} ${n}× ${ITEMS[id].name}`).join(', ')}</div><div class="acts"><button id="pwTake">Retirar peças</button></div>`;
      h += `</div><div class="list cards">`;
      for (const r of PRINTS) { const it = ITEMS[r.out], why = PW.canPrint(p, r); const cost = Object.entries(r.cost).map(([id, n]) => { const have = id === 'filament' ? d.filament : g.inv.count(id); return `<span class="${have >= n ? 'ok' : 'no'}">${ITEMS[id].icon} ${have}/${n} ${ITEMS[id].name}${id === 'filament' ? ' (na impressora)' : ''}</span>`; }).join(' ');
        h += `<div class="recipe"><div class="ic">${this._icon(r.out)}</div><div><div class="nm">${it.name} <span class="muted">· ${r.time} s · 60 W</span></div><div class="muted">${it.desc}</div><div class="cost">${cost}</div></div><button data-print="${r.id}" ${why ? `disabled title="${why}"` : ''}>Imprimir</button></div>`; }
      h += '</div>';
    }
    const body = $('powerBody'); body.innerHTML = h;
    for (const b of body.querySelectorAll('[data-unlink]')) b.onclick = () => { PW.disconnect(p, b.dataset.unlink); this.renderPower(true); };
    const wb = $('pwWire'); if (wb) wb.onclick = () => PW.startWire(p);
    for (const b of body.querySelectorAll('[data-fil]')) b.onclick = () => { PW.loadFilament(p, +b.dataset.fil); this.renderPower(true); };
    const tb = $('pwTake'); if (tb) tb.onclick = () => { PW.takeTray(p); this.renderPower(true); };
    for (const b of body.querySelectorAll('[data-print]')) b.onclick = () => { PW.print(p, PRINTS.find((r) => r.id === b.dataset.print)); this.renderPower(true); };
  }
  renderBuild() {
    const g = this.game, list = $('buildList'); list.innerHTML = '';
    for (const [type, d] of Object.entries(PIECES)) { if (d.hidden || d.legacy) continue;
      const skOk = g.hasSkillFor(type); const can = skOk && g.inv.has(d.cost); const el = document.createElement('div'); el.className = 'recipe' + (skOk ? '' : ' locked noskill');
      el.innerHTML = `<div class="ic">${d.icon}</div><div><div class="nm">${d.name}</div><div class="muted">${d.desc}</div>${skOk ? '' : `<div class="lk">🔒 Precisa da habilidade ${g.skillName(SKILL_OF[type])}</div>`}<div class="cost">${costText(d.cost, g.inv)}</div></div>`;
      const b = document.createElement('button'); b.textContent = 'Posicionar'; b.disabled = !can; b.dataset.piece = type; b.onclick = () => { this.closePanels(true); g.build.start(type); g.onPanelClosed(); }; el.appendChild(b); list.appendChild(el);
    }
  }
  // fogueira: combustível, grelha (com barra de assar), sobras e a mochila
  renderFire() {
    const g = this.game, p = this.fire; if (!p || !g.build.pieces.includes(p)) { this.fire = null; return; } const d = FIRE.fireData(p);
    const lit = $('fireLit'); lit.textContent = p.lit ? '🔥 Apagar' : '🔥 Acender'; lit.onclick = () => { g.fires.setLit(p, !p.lit); this.renderFire(); };
    const tot = d.burnId ? FIRE.FUEL[d.burnId].t : 1; $('fireBurn').firstElementChild.style.width = (p.lit && d.burnId ? Math.max(0, d.burn / tot) * 100 : 0).toFixed(1) + '%';
    const fill = (el, arr, area) => { el.innerHTML = ''; arr.forEach((s, i) => { const v = s ? { id: s.id, qty: s.qty || 1 } : null; const sl = this._slotEl(v, -1, () => { if (!s) return; g.fires.take(p, area, i); this.renderFire(); });
        if (area === 'cook' && s) { const raw = !!FIRE.COOK[s.id], ck = !!FIRE.BURN[s.id], bt = ITEMS[s.id].burnt; const f = raw ? s.t / FIRE.COOK_T : ck ? s.t / FIRE.BURN_T : 1; const b = document.createElement('div'); b.className = 'cookbar' + (raw ? '' : bt ? ' burnt' : ' done'); b.innerHTML = `<i style="width:${(Math.min(1, f) * 100).toFixed(0)}%"></i>`; sl.style.position = 'relative'; sl.appendChild(b); sl.title = ITEMS[s.id].name + (raw ? ' — assando' : ck ? ' — pronta (vai queimar se ficar)' : ''); }
        el.appendChild(sl); }); };
    fill($('fireFuel'), d.fuel, 'fuel'); fill($('fireCook'), d.cook, 'cook'); fill($('fireOut'), d.out, 'out');
    const ig = $('fireInv'); ig.innerHTML = ''; g.inv.slots.forEach((s, i) => ig.appendChild(this._slotEl(s, i, () => { if (!s) return; if (g.fires.putFromInv(p, i)) g.audio.play('pickup'); this.renderFire(); })));
    this._fireSig = JSON.stringify([p.lit, d.fuel, d.cook.map((c) => c && c.id), d.out]);
  }
  renderChest() {
    const g = this.game, p = this.chest; if (!p) return; const box = new Inventory(16); box.load(p.items);
    const cg = $('chestGrid'), ig = $('chestInv'); cg.innerHTML = ''; ig.innerHTML = '';
    this.cmulti = this.cmulti || new Set(); this.imulti = this.imulti || new Set(); this.xferDir = this.xferDir || 'up';
    { let tb = $('chestTools'); if (!tb) { tb = document.createElement('div'); tb.id = 'chestTools'; tb.className = 'invtools'; cg.parentNode.insertBefore(tb, cg); }
      const up = this.xferDir === 'up'; const nSel = up ? this.imulti.size : this.cmulti.size;
      tb.innerHTML = `<button class="itb" data-a="org" title="O — organizar meu inventário">O</button><button class="itb xfer ${up ? 'up' : 'down'}" data-a="xfer" title="${up ? 'Colocar no baú' : 'Pegar do baú'} ${nSel ? 'os selecionados' : 'tudo'}">${up ? '⬆' : '⬇'}</button><span class="muted">${up ? `Vermelha: ${nSel ? 'selecionados' : 'tudo'} da mochila → baú` : `Azul: ${nSel ? 'selecionados' : 'tudo'} do baú → mochila`} · SHIFT+clique seleciona</span>`;
      tb.querySelector('[data-a=org]').onclick = () => { g.inv.organize(); g.audio.play('ui'); this.renderChest(); };
      tb.querySelector('[data-a=xfer]').onclick = () => { if (this.xferDir === 'up') { const idx = this.imulti.size ? [...this.imulti] : g.inv.slots.map((_, k) => k); const list = idx.map((k) => g.inv.slots[k]).filter(Boolean); let full = false;
          for (const s of list) { const k = box.add(s.id, s.qty, { rad: s.rad }); if (k < s.qty) full = true; const at = g.inv.slots.indexOf(s); if (at >= 0 && k) g.inv.takeSlot(at, k); } if (full) this.toast('Baú cheio', 'warn'); }
        else { const idx = this.cmulti.size ? [...this.cmulti] : box.slots.map((_, k) => k); let full = false; for (const k of idx) { const s = box.slots[k]; if (!s) continue; const n = g.inv.add(s.id, s.qty, { rad: s.rad }); if (n < s.qty) full = true; box.takeSlot(k, n); } if (full) this.toast('Mochila cheia', 'warn'); }
        p.items = box.serialize(); this.imulti.clear(); this.cmulti.clear(); this.xferDir = this.xferDir === 'up' ? 'down' : 'up'; g.audio.play('pickup'); this.renderChest(); }; }
    box.slots.forEach((s, i) => cg.appendChild(this._slotEl(s, -1, (ev) => { if (ev && ev.shiftKey) { if (this.cmulti.has(i)) this.cmulti.delete(i); else this.cmulti.add(i); this.renderChest(); return; } if (!s) return; const k = g.inv.add(s.id, s.qty, { rad: s.rad }); if (k < s.qty) this.toast('Mochila cheia', 'warn'); box.takeSlot(i, k); p.items = box.serialize(); g.audio.play('pickup'); this.renderChest(); })));
    g.inv.slots.forEach((s, i) => ig.appendChild(this._slotEl(s, i, (ev) => { if (ev && ev.shiftKey) { if (this.imulti.has(i)) this.imulti.delete(i); else this.imulti.add(i); this.renderChest(); return; } if (!s) return; const k = box.add(s.id, s.qty, { rad: s.rad }); if (k < s.qty) this.toast('Baú cheio', 'warn'); g.inv.takeSlot(i, k); p.items = box.serialize(); g.audio.play('pickup'); this.renderChest(); })));
    [...cg.children].forEach((el, k) => el.classList.toggle('sel', this.cmulti.has(k))); [...ig.children].forEach((el, k) => el.classList.toggle('sel', this.imulti.has(k)));
  }
}
