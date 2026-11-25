// Painel do dono do mundo (Ctrl + Shift + F1). Só aparece para quem criou o mundo: no jogo solo sempre, no
// multiplayer só para o dono (o navegador que hospeda). Tem:
// • DROPAR: todos os itens do jogo e também NPCs, robôs e animais — escolhe o que, a quantidade e onde (aos pés,
//   onde está mirando ou perto de um jogador). Lista para dropar várias coisas de uma vez.
// • MODO DEUS: imortalidade, vitalidade infinita, durabilidade infinita, invisibilidade, munição infinita, um tiro mata,
//   voar pelo mapa, esqueletos com nome/ID dos jogadores (e das criaturas), itens no mapa, regeneração, proteção
//   ambiental e teleporte clicando no mapa.
// • JOGADORES (ir até / trazer), MUNDO (hora, clima, inimigos, loot), SISTEMA (desempenho) e CONSOLE (comandos).
import { ITEMS } from './items.js';
import { DEFS } from './creatures.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export const GOD = [
  ['immortal', 'Imortalidade', 'Não perde vida, não desmaia e não morre'],
  ['vital', 'Vitalidade infinita', 'Fome, sede, energia e fôlego sempre cheios'],
  ['dur', 'Durabilidade infinita', 'Roupas, mochila e ferramentas não gastam'],
  ['invis', 'Invisibilidade', 'Robôs, NPCs e animais não te enxergam'],
  ['ammo', 'Munição infinita', 'O pente não esvazia'],
  ['onehit', 'Um tiro mata', 'Qualquer dano seu mata a criatura na hora'],
  ['fly', 'Voar pelo mapa', 'WASD + câmera; Espaço sobe, C desce, Shift acelera'],
  ['esp', 'Esqueletos dos jogadores', 'Vê o esqueleto, o nome e o ID dos jogadores através das paredes'],
  ['espc', 'Esqueletos das criaturas', 'Mesmo para NPCs, robôs e animais por perto'],
  ['items', 'Itens no mapa', 'Loot no chão, caixas, carros e baús aparecem no mapa'],
  ['regen', 'Regeneração rápida', 'Vida volta rápido e as doenças somem'],
  ['env', 'Proteção ambiental', 'Sem frio, calor, névoa tóxica ou radiação'],
];
// categorias do DROPAR
const CATS = [
  ['guns', 'Armas de fogo', (it) => it.type === 'tool' && it.tool === 'gun'],
  ['melee', 'Armas brancas e ferramentas', (it) => it.type === 'tool' && !['gun', 'grenade', 'c4'].includes(it.tool)],
  ['explo', 'Granadas e explosivos', (it) => it.type === 'tool' && ['grenade', 'c4'].includes(it.tool)],
  ['ammo', 'Munição', (it) => it.type === 'ammo'],
  ['attach', 'Acessórios de arma', (it) => it.type === 'attachment'],
  ['med', 'Saúde', (it) => it.type === 'medical'],
  ['food', 'Comida e bebida', (it) => it.type === 'food' || it.type === 'drink'],
  ['cloth', 'Roupas e mochilas', (it) => ['clothing', 'backpack', 'suit'].includes(it.type)],
  ['res', 'Materiais', (it) => it.type === 'resource' || it.type === 'part'],
  ['misc', 'Máquinas, livros e outros', (it) => ['machine', 'book', 'misc'].includes(it.type)],
  ['npc', 'NPCs', null, (d) => d.ai === 'npc'],
  ['robot', 'Robôs', null, (d) => d.robot],
  ['animal', 'Animais', null, (d) => !d.robot && !d.human],
];

export class Admin {
  constructor(game) {
    this.g = game; this.on = Object.fromEntries(GOD.map(([k]) => [k, false])); this.isOpen = false; this.tab = 'drop'; this.page = 'geral';
    this.cat = 'guns'; this.sel = null; this.qty = 1; this.dest = 'me'; this.cart = []; this.tpMode = false; this.search = ''; this.log = [];
    window.addEventListener('keydown', (e) => { if (e.code === 'F1' && e.ctrlKey && e.shiftKey) { e.preventDefault(); e.stopPropagation(); this.toggle(); } else if (e.code === 'F1') e.preventDefault(); }, true);
  }
  // só o dono do mundo: jogo solo ou quem hospeda (amigos conectados não têm o painel)
  allowed() { const N = this.g.net; return this.g.state !== 'menu' && this.g.state !== 'loading' && !(N && N.client); }
  get any() { return Object.values(this.on).some(Boolean); }
  toggle() { if (this.isOpen) this.close(); else this.open(); }
  open() {
    const g = this.g; if (!this.allowed()) return; this._build(); g.ui.closePanels(true); if (g.state === 'paused') g.resume(); g.ui.open = 'admin'; g.input.exitLock(); this.isOpen = true; $('adminPanel').classList.remove('hidden'); this.render(); g.audio.play('click');
  }
  close(silent) { if (!this.isOpen) return; this.isOpen = false; this.tpMode = false; const el = $('adminPanel'); if (el) el.classList.add('hidden'); if (this.g.ui.open === 'admin') { this.g.ui.open = null; if (!silent) this.g.onPanelClosed && this.g.onPanelClosed(); } }

  // ---------- montagem da tela ----------
  _build() {
    if ($('adminPanel')) return; const el = document.createElement('div'); el.id = 'adminPanel'; el.className = 'hidden';
    el.innerHTML = `<div class="adm"><div class="admHead"><div><b>ILHA PERDIDA — PAINEL DO DONO</b> <span id="admId"></span></div><div class="admSt">🌐 STATUS DO MUNDO: <span id="admStatus"></span></div><button class="admX" data-x="1">✕</button></div>
      <div class="admBody"><div class="admSide">${[['geral', 'DADOS GERAIS'], ['players', 'JOGADORES'], ['world', 'MUNDO'], ['system', 'SISTEMA'], ['console', 'CONSOLE'], ['exit', 'SAIR']].map(([k, n]) => `<button data-page="${k}">${n}</button>`).join('')}</div>
      <div class="admMain" id="admMain"></div></div></div>`;
    document.body.appendChild(el);
    el.addEventListener('click', (e) => this._click(e)); el.addEventListener('input', (e) => this._input(e)); el.addEventListener('change', (e) => this._input(e));
    el.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter' && e.target.id === 'admCmd') { this.run(e.target.value); e.target.value = ''; } if (e.key === 'Escape') this.close(); });
    el.addEventListener('keyup', (e) => e.stopPropagation());
    const cv = document.createElement('canvas'); cv.id = 'espCanvas'; document.body.appendChild(cv); this.esp = cv;
  }
  _click(e) {
    const b = e.target.closest('[data-page],[data-tab],[data-god],[data-act],[data-item],[data-x],[data-rm]'); if (!b) return; const d = b.dataset; this.g.audio.play('click', { vol: 0.5 });
    if (d.x) return this.close();
    if (d.page) { if (d.page === 'exit') return this.close(); this.page = d.page; return this.render(); }
    if (d.tab) { this.tab = d.tab; return this.render(); }
    if (d.god) { this.set(d.god, !this.on[d.god]); return this.render(); }
    if (d.item) { this.sel = d.item; return this.render(); }
    if (d.rm !== undefined) { this.cart.splice(+d.rm, 1); return this.render(); }
    const a = d.act, arg = d.arg;
    if (a === 'drop') { if (!this.sel) return this.say('Escolha um item da lista'); this.drop(this.sel, this.qty, this.dest); }
    if (a === 'add') { if (!this.sel) return this.say('Escolha um item da lista'); const ex = this.cart.find((c) => c.id === this.sel); if (ex) ex.n += this.qty; else this.cart.push({ id: this.sel, n: this.qty }); }
    if (a === 'dropall') { if (!this.cart.length) return this.say('A lista está vazia'); for (const c of this.cart) this.drop(c.id, c.n, this.dest, true); this.say(`📦 ${this.cart.length} coisa(s) dropada(s)`); this.cart = []; }
    if (a === 'clear') this.cart = [];
    if (a === 'godoff') { for (const k of Object.keys(this.on)) this.set(k, false); this.say('Modo deus desativado'); }
    if (a === 'reset') this.resetStats();
    if (a === 'tp') { this.close(true); this.g.ui.openPanel('map'); this.tpMode = true; this.g.ui.toast('🗺 Clique no mapa para onde quer ir (teleporte do modo deus)', 'info'); return; }
    if (a === 'goto') this.gotoPlayer(+arg); if (a === 'bring') this.bringPlayer(+arg);
    if (a === 'time') { this.g.env.time = +arg; this.say('Hora alterada'); } if (a === 'day') { this.g.env.day++; this.say('Dia +1'); }
    if (a === 'weather') { this.g.env.setWeather(arg); this.say('Clima: ' + arg); }
    if (a === 'kill') this.killNear(+arg); if (a === 'convoy') { const cv = this.g.convoys && this.g.convoys.spawn({ force: true }); this.say(cv ? '🚚 Comboio chamado numa estrada perto' : 'Nenhuma estrada perto para o comboio'); }
    if (a === 'loot') this.respawnLoot(); if (a === 'save') { this.g.saveGame(true); } if (a === 'heal') this.resetStats();
    this.render();
  }
  _input(e) { const t = e.target; if (t.id === 'admCat') { this.cat = t.value; this.sel = null; this.render(); } if (t.id === 'admQty' || t.id === 'admQtyN') { this.qty = Math.max(1, Math.min(999, Math.round(+t.value || 1))); const o = t.id === 'admQty' ? $('admQtyN') : $('admQty'); if (o) o.value = this.qty; }
    if (t.id === 'admDest') this.dest = t.value; if (t.id === 'admSearch') { this.search = t.value; this._renderList(); } if (t.id === 'admTime' && e.type === 'change') { this.g.env.time = +t.value; } }
  say(msg) { this.g.ui.toast(msg, 'ok'); this.log.unshift(msg); this.log.length = Math.min(this.log.length, 40); const el = $('admLog'); if (el) el.innerHTML = this.log.map(esc).join('<br>'); }

  render() {
    const g = this.g, N = g.net; if (!this.isOpen) return;
    $('admId').textContent = `[ID: ${N ? N.pid() : 'local'}]`; $('admStatus').textContent = N && N.host ? `HOSPEDANDO "${N.worldName}" · ${1 + N.peers.size} jogador(es)` : 'MUNDO LOCAL (solo)';
    for (const b of document.querySelectorAll('.admSide button')) b.classList.toggle('on', b.dataset.page === this.page);
    const M = $('admMain');
    if (this.page === 'geral') M.innerHTML = this._pageGeral();
    else if (this.page === 'players') M.innerHTML = this._pagePlayers();
    else if (this.page === 'world') M.innerHTML = this._pageWorld();
    else if (this.page === 'system') M.innerHTML = this._pageSystem();
    else if (this.page === 'console') { M.innerHTML = `<h3>CONSOLE</h3><input id="admCmd" class="admInp" placeholder="ex.: give rifle_ak 1 · spawn soldier 3 · tp 120 -340 · time 0.5 · god on · heal" autocomplete="off"><div class="admHelp">Comandos: <b>give</b> id qtd · <b>spawn</b> tipo qtd · <b>tp</b> x z · <b>time</b> 0–1 · <b>weather</b> limpo|chuva|tempestade|neblina · <b>god</b> on|off · <b>heal</b> · <b>kill</b> raio · <b>items</b> busca</div><div id="admLog" class="admLog">${this.log.map(esc).join('<br>')}</div>`; setTimeout(() => $('admCmd') && $('admCmd').focus(), 0); }
    if (this.page === 'geral') this._renderList();
  }
  _pageGeral() {
    const godRows = GOD.map(([k, n, tip]) => `<div class="admRow" title="${esc(tip)}"><span>${n}</span><button data-god="${k}" class="admBadge ${this.on[k] ? 'on' : ''}">${this.on[k] ? 'ATIVADO' : 'DESATIVADO'}</button></div>`).join('');
    const peers = this.g.net && this.g.net.host ? [...this.g.net.peers.values()] : [];
    const dest = `<option value="me" ${this.dest === 'me' ? 'selected' : ''}>Aos meus pés</option><option value="aim" ${this.dest === 'aim' ? 'selected' : ''}>Onde estou mirando</option>${peers.map((p) => `<option value="p${p.id}" ${this.dest === 'p' + p.id ? 'selected' : ''}>Perto de ${esc(p.name)} (ID ${p.id})</option>`).join('')}`;
    const cart = this.cart.map((c, i) => `<div class="admCart"><span class="ic">${this._ic(c.id)}</span><span>${esc(this._name(c.id))}</span><b>x${c.n}</b><button data-rm="${i}">✕</button></div>`).join('') || '<div class="muted small">Nada na lista — escolha um item e clique em “Adicionar à lista”.</div>';
    return `<h3>PAINEL DE CONTROLE GERAL</h3><div class="admTabs"><button data-tab="drop" class="drop ${this.tab === 'drop' ? 'on' : ''}">DROPAR</button><button data-tab="god" class="god ${this.tab === 'god' ? 'on' : ''}">MODO DEUS</button></div>
      <div class="admCols"><div class="admCol ${this.tab === 'drop' ? 'act' : ''}"><div class="admSub">ITENS PARA DROPAR</div>
        <div class="admGrid2"><label>Categoria<select id="admCat">${CATS.map(([k, n]) => `<option value="${k}" ${k === this.cat ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
        <label>Quantidade<div class="admQty"><input id="admQty" type="range" min="1" max="100" value="${Math.min(100, this.qty)}"><input id="admQtyN" type="number" min="1" max="999" value="${this.qty}"></div></label>
        <label>Buscar<input id="admSearch" value="${esc(this.search)}" placeholder="nome…" autocomplete="off"></label><label>Destino<select id="admDest">${dest}</select></label></div>
        <div id="admList" class="admList"></div>
        <div class="admSub">LISTA PARA DROPAR</div><div class="admCartBox">${cart}</div>
        <div class="admBtns"><button data-act="drop" class="admB">[DROPAR ITEM]</button><button data-act="add" class="admB">[ADICIONAR À LISTA]</button><button data-act="dropall" class="admB">[DROPAR TUDO]</button><button data-act="clear" class="admB dim">[LIMPAR LISTA]</button></div></div>
      <div class="admCol ${this.tab === 'god' ? 'act' : ''}"><div class="admSub">STATUS MODO DEUS</div>${godRows}
        <div class="admBtns"><button data-act="tp" class="admB blue">[TELEPORTAR PELO MAPA]</button><button data-act="godoff" class="admB blue">[DESATIVAR MODO DEUS]</button><button data-act="reset" class="admB blue">[REDEFINIR ATRIBUTOS]</button></div></div></div>`;
  }
  _renderList() {
    const el = $('admList'); if (!el) return; const C = CATS.find((c) => c[0] === this.cat); const q = this.search.trim().toLowerCase(); let rows = [];
    if (C[2]) rows = Object.entries(ITEMS).filter(([, it]) => C[2](it)).map(([id]) => id); else rows = Object.entries(DEFS).filter(([k, d]) => k !== 'avatar' && C[3](d)).map(([k]) => 'c:' + k);
    if (q) rows = rows.filter((id) => this._name(id).toLowerCase().includes(q) || id.includes(q));
    el.innerHTML = rows.map((id) => `<button data-item="${id}" class="${id === this.sel ? 'on' : ''}"><span class="ic">${this._ic(id)}</span><span>${esc(this._name(id))}</span><small>${id.replace('c:', '')}</small></button>`).join('') || '<div class="muted small">Nada encontrado</div>';
  }
  _name(id) { if (id.startsWith('c:')) { const d = DEFS[id.slice(2)]; return d ? d.name : id; } return ITEMS[id] ? ITEMS[id].name : id; }
  _ic(id) { if (id.startsWith('c:')) { const d = DEFS[id.slice(2)]; return d.ai === 'npc' ? '🧍' : d.robot ? '🤖' : '🐾'; } try { return this.g.ui._icon(id); } catch (e) { return ITEMS[id] ? ITEMS[id].icon : '?'; } }
  _pagePlayers() {
    const g = this.g, N = g.net, P = g.player; const me = `<tr><td>${esc(g.look?.name || 'Você')}</td><td>${N ? (N.host ? 1 : '-') : 'local'}</td><td>${P.pos.map((v) => v.toFixed(0)).join(', ')}</td><td>${Math.round(P.stats.hp)}</td><td>—</td></tr>`;
    const rows = N && N.host ? [...N.peers.values()].map((p) => { const s = p.st; const d = s ? Math.hypot(s.p[0] - P.pos[0], s.p[2] - P.pos[2]) : 0; return `<tr><td>${esc(p.name)}</td><td>${p.id}</td><td>${s ? s.p.map((v) => v.toFixed(0)).join(', ') : '?'} <small>(${d.toFixed(0)} m)</small></td><td>${s && s.d ? '☠' : '—'}</td><td><button data-act="goto" data-arg="${p.id}" class="admB sm">Ir até</button> <button data-act="bring" data-arg="${p.id}" class="admB sm">Trazer</button></td></tr>`; }).join('') : '';
    return `<h3>JOGADORES</h3><table class="admTable"><tr><th>Nome</th><th>ID</th><th>Posição</th><th>Vida</th><th></th></tr>${me}${rows}</table>${N && N.host ? '' : '<div class="muted small">Abra o mundo para amigos (Multiplayer → Hospedar) para ver os outros jogadores aqui.</div>'}`;
  }
  _pageWorld() {
    const e = this.g.env; const W = ['limpo', 'nublado', 'chuva', 'tempestade', 'neblina'];
    return `<h3>MUNDO</h3><div class="admRow"><span>Hora do dia (Dia ${e.day})</span><input id="admTime" type="range" min="0" max="0.999" step="0.01" value="${e.time}"></div>
      <div class="admBtns"><button class="admB" data-act="time" data-arg="0.3">Manhã</button><button class="admB" data-act="time" data-arg="0.5">Meio-dia</button><button class="admB" data-act="time" data-arg="0.78">Pôr do sol</button><button class="admB" data-act="time" data-arg="0.95">Noite</button><button class="admB" data-act="day">Dia +1</button></div>
      <div class="admSub">CLIMA</div><div class="admBtns">${W.map((w) => `<button class="admB" data-act="weather" data-arg="${w}">${w}</button>`).join('')}</div>
      <div class="admSub">INIMIGOS E LOOT</div><div class="admBtns"><button class="admB" data-act="kill" data-arg="80">Matar tudo em 80 m</button><button class="admB" data-act="kill" data-arg="300">Matar tudo em 300 m</button><button class="admB" data-act="convoy">Chamar comboio</button><button class="admB" data-act="loot">Repor loot das caixas</button><button class="admB" data-act="save">Salvar o mundo</button></div>`;
  }
  _pageSystem() {
    const g = this.g; const CL = g.creatures.list; return `<h3>SISTEMA</h3><table class="admTable"><tr><td>FPS</td><td>${Math.round(g.fps || 0)}</td></tr><tr><td>Criaturas carregadas</td><td>${CL.length} (${CL.filter((c) => c.npc).length} NPCs, ${CL.filter((c) => c.def.robot).length} robôs)</td></tr>
      <tr><td>Construções</td><td>${g.build.pieces.length}</td></tr><tr><td>Loot no chão</td><td>${g.drops.length}</td></tr><tr><td>Posição</td><td>${g.player.pos.map((v) => v.toFixed(1)).join(', ')}</td></tr><tr><td>Dia / hora</td><td>${g.env.day} / ${(g.env.time * 24).toFixed(1)} h</td></tr>
      <tr><td>Multiplayer</td><td>${g.net && g.net.active ? (g.net.host ? 'hospedando' : 'conectado') : 'desligado'}</td></tr></table>`;
  }

  // ---------- ações ----------
  set(k, v) { const g = this.g, P = g.player; this.on[k] = v; if (k === 'fly') { P.fly = v; P.vel = [0, 0, 0]; P.airTime = 0; if (!v) { P._flySafe = 2; } } if (k === 'invis') P.invis = v; this._hud(); }
  _hud() { let el = $('godBadge'); if (!el) { el = document.createElement('div'); el.id = 'godBadge'; document.body.appendChild(el); } const on = GOD.filter(([k]) => this.on[k]).map(([, n]) => n); el.classList.toggle('hidden', !on.length); el.textContent = '⚡ MODO DEUS: ' + on.join(' · '); }
  resetStats() { const g = this.g, P = g.player, s = P.stats; Object.assign(s, { hp: 100, hunger: 100, thirst: 100, energy: 100, stamina: 100 }); s.rad = 0; s.temp = 37; s.fever = 0; for (const k of ['kuru', 'burntSick', 'sickVomits', 'poison', 'bleed', 'infection']) { if (k in s) s[k] = 0; } if (g.status) g.status = {}; if (P.fainted > 0) { P.fainted = 0.01; } this.say('❤ Atributos redefinidos (vida, fome, sede, energia, doenças)'); }
  // onde dropar: aos pés, na mira ou perto de outro jogador
  where(dest) {
    const g = this.g, P = g.player; if (dest && dest[0] === 'p') { const pr = g.net && g.net.peers.get(+dest.slice(1)); if (pr && pr.st) return [pr.st.p[0] + 1.5, pr.st.p[1], pr.st.p[2] + 1]; }
    if (dest === 'aim') { const c = g.cam, e = c.eye, t = c.target; let d = [t[0] - e[0], t[1] - e[1], t[2] - e[2]]; const l = Math.hypot(...d) || 1; d = d.map((v) => v / l); const w = g.world;
      for (let s = 2; s < 220; s += 0.5) { const x = e[0] + d[0] * s, y = e[1] + d[1] * s, z = e[2] + d[2] * s; const h = w.height(x, z); if (y <= h + 0.05) return [x, h, z]; if (s > 3 && g.physics.query(x, z, 0.3).some((cl) => !cl.ghost && !cl.camOnly && !cl.isPlayer && y > cl.y0 && y < cl.y1 && g.physics.insideXZ(cl, x, z, 0.05))) return [x - d[0] * 0.6, Math.max(h, y - 0.5), z - d[2] * 0.6]; } }
    const f = [Math.sin(P.yaw), Math.cos(P.yaw)]; return [P.pos[0] + f[0] * 1.2, P.pos[1], P.pos[2] + f[1] * 1.2];
  }
  drop(id, n, dest, quiet) {
    const g = this.g, at = this.where(dest); n = Math.max(1, Math.min(999, n | 0));
    if (id.startsWith('c:')) { const kind = id.slice(2); let k = 0; g.creatures.force = true; try { for (let i = 0; i < Math.min(n, 40); i++) { const c = g.creatures.spawnNear(kind, at[0], at[2], 1.5, 6 + i * 0.5) || g.creatures.spawnNear(kind, at[0], at[2], 3, 16); if (!c) continue; k++; if (DEFS[kind].ai === 'npc' && g.npcs && g.npcs._setup) { try { g.npcs._setup(c, kind); } catch (e) { /* ok */ } c.home = [c.pos[0], c.pos[2]]; c.homeR = 12; } c.adminSpawn = true; } } finally { g.creatures.force = false; }
      if (!quiet) this.say(k ? `🧍 ${k}x ${this._name(id)} criado(s)` : `Não deu para colocar ${this._name(id)} aí (sem espaço)`); return k; }
    if (!ITEMS[id]) return 0; g.dropItem(id, n, at); if (!quiet) this.say(`📦 ${n}x ${ITEMS[id].name} dropado(s)`); return n;
  }
  teleport(x, z) { const g = this.g, w = g.world, P = g.player; if (g.vehicles.driving) g.vehicles.exit(); g.stream.flush([x, 0, z]); const y = Math.max(w.height(x, z), 0) + (this.on.fly ? 3 : 0.2); P.setPosition(x, y, z); P.airTime = 0; P._flySafe = 2; if (!this.on.fly && w.height(x, z) < 0) P.swimming = true; this.say(`🌀 Teleportado para ${x.toFixed(0)}, ${z.toFixed(0)}`); }
  gotoPlayer(id) { const pr = this.g.net && this.g.net.peers.get(id); if (pr && pr.st) this.teleport(pr.st.p[0] + 2, pr.st.p[2] + 2); }
  bringPlayer(id) { const g = this.g, N = g.net; if (!N || !N.host) return; const P = g.player; N.send({ to: id, t: 'admtp', p: [P.pos[0] + 2, P.pos[1], P.pos[2] + 2] }); this.say('Jogador trazido até você'); }
  killNear(r) { const g = this.g, P = g.player; let n = 0; for (const c of [...g.creatures.list]) { if (c.dead || c.net || c.avatar) continue; if (Math.hypot(c.pos[0] - P.pos[0], c.pos[2] - P.pos[2]) > r) continue; g.creatures.damage(c, 1e7, 0, c.def.heavyArmor ? 'c4' : 'bullet'); if (c.def.heavyArmor) for (let i = 0; i < 4 && !c.dead; i++) g.creatures.damage(c, 1e7, 0, 'c4'); n++; } this.say(`💀 ${n} criatura(s) eliminada(s) em ${r} m`); }
  respawnLoot() { const g = this.g, w = g.world; let n = 0; for (const c of w.crates) if (c.looted) { c.looted = false; n++; } for (const q of w.props) if (q.kind === 'car' && q.looted) q.looted = false; g._dirtyAll && g._dirtyAll(); this.say(`🎁 ${n} caixa(s) com loot de novo`); }
  run(line) {
    const g = this.g, a = line.trim().split(/\s+/), c = (a[0] || '').toLowerCase(); if (!c) return; this.say('> ' + line);
    try {
      if (c === 'give' || c === 'drop') { const id = a[1]; if (!ITEMS[id]) return this.say('Item não existe: ' + id); this.drop(id, +a[2] || 1, 'me'); }
      else if (c === 'spawn') { const k = a[1]; if (!DEFS[k] || k === 'avatar') return this.say('Criatura não existe: ' + k + ' (' + Object.keys(DEFS).filter((x) => x !== 'avatar').join(', ') + ')'); this.drop('c:' + k, +a[2] || 1, 'aim'); }
      else if (c === 'tp') { const x = +a[1], z = +a[2]; if (!Number.isFinite(x) || !Number.isFinite(z)) return this.say('Use: tp x z'); this.teleport(x, z); }
      else if (c === 'time') { g.env.time = Math.max(0, Math.min(0.999, +a[1] || 0)); this.say('Hora: ' + (g.env.time * 24).toFixed(1) + ' h'); }
      else if (c === 'weather') { g.env.setWeather(a[1] || 'limpo'); this.say('Clima: ' + (a[1] || 'limpo')); }
      else if (c === 'god') { const v = a[1] !== 'off'; for (const k of ['immortal', 'vital', 'dur', 'ammo', 'regen', 'env']) this.set(k, v); this.say('Modo deus ' + (v ? 'ligado' : 'desligado')); }
      else if (c === 'heal') this.resetStats();
      else if (c === 'kill') this.killNear(+a[1] || 80);
      else if (c === 'items') { const q = (a.slice(1).join(' ') || '').toLowerCase(); this.say(Object.entries(ITEMS).filter(([k, it]) => k.includes(q) || it.name.toLowerCase().includes(q)).slice(0, 30).map(([k, it]) => `${k} (${it.name})`).join(', ') || 'nada'); }
      else this.say('Comando desconhecido: ' + c);
    } catch (e) { this.say('Erro: ' + e.message); }
  }

  // ---------- efeitos por quadro ----------
  tick(dt) {
    const g = this.g, P = g.player, s = P.stats; if (!this.any) { this._espClear(); return; }
    if (this.isOpen && this.page === 'system') { this._sysT = (this._sysT || 0) - dt; if (this._sysT <= 0) { this._sysT = 1; this.render(); } }
    if (this.on.immortal) { s.hp = Math.max(s.hp, 100); if (P.dead && P.revive) { P.revive(); g.ui.hideDeath && g.ui.hideDeath(); } }
    if (this.on.vital) { s.hunger = Math.max(s.hunger, 99); s.thirst = Math.max(s.thirst, 99); s.energy = 100; s.stamina = 100; P.staminaLock = false; }
    if (this.on.regen) { s.hp = Math.min(100, s.hp + 15 * dt); s.fever = 0; if (s.poison) s.poison = 0; if (s.bleed) s.bleed = 0; }
    if (this.on.env) { s.rad = 0; s.temp = 37; if (s.wet) s.wet = 0; }
    if (this.on.dur) { const E = g.equip; if (E.dur) for (const k of Object.keys(E.dur)) { const id = E[k]; if (id && ITEMS[id] && ITEMS[id].dur) E.dur[k] = ITEMS[id].dur; } }
    if (this.on.ammo && g.guns) { const id = g.guns.gunId, gun = g.guns.gun; if (id && gun) { if (gun.direct) { if (g.inv.count(gun.ammo) < 1) g.inv.add(gun.ammo, 1); } else if ((g.guns.mags[id] || 0) < gun.mag) g.guns.mags[id] = gun.mag; } }
    P.invis = this.on.invis; P.fly = this.on.fly;
    this._drawEsp();
  }
  // dano do jogador com "um tiro mata"
  dmgMul(c) { return this.on.onehit && !c.avatar ? 1e6 : 1; }
  // mapa: itens e jogadores
  drawMap(c, map) {
    if (!this.on.items && !this.on.esp && !this.tpMode) return; const g = this.g, w = g.world; c.save();
    if (this.on.items) { const dot = (x, z, col, r) => { const [a, b] = map.toScreen(x, z); if (a < -5 || b < -5 || a > map.W + 5 || b > map.H + 5) return; c.fillStyle = col; c.beginPath(); c.arc(a, b, r, 0, 6.29); c.fill(); };
      for (const k of w.crates) if (!k.looted) dot(k.x, k.z, '#ffcc33', 2.2); for (const q of w.props) if (q.kind === 'car' && !q.looted) dot(q.x, q.z, '#ff8a33', 2.4);
      for (const d of g.drops) dot(d.x, d.z, '#33ff88', 3.2); for (const p of g.build.pieces) if (p.type === 'chest') dot(p.x, p.z, '#33ccff', 3); }
    if (this.on.esp && g.net) for (const p of g.net.peers.values()) { if (!p.st) continue; const [a, b] = map.toScreen(p.st.p[0], p.st.p[2]); c.fillStyle = '#ff4466'; c.beginPath(); c.arc(a, b, 5, 0, 6.29); c.fill(); c.font = '700 11px sans-serif'; c.fillStyle = '#fff'; c.fillText(`${p.name} [${p.id}]`, a, b - 9); }
    if (this.tpMode) { c.fillStyle = 'rgba(80,160,255,0.9)'; c.font = '700 15px sans-serif'; c.textAlign = 'center'; c.fillText('MODO DEUS — clique no mapa para teleportar', map.W / 2, 28); }
    c.restore();
  }
  // esqueletos através das paredes
  _espClear() { if (this.esp && this._espOn) { const x = this.esp.getContext('2d'); x.clearRect(0, 0, this.esp.width, this.esp.height); this._espOn = false; } }
  _drawEsp() {
    const g = this.g; if (!this.esp) this._build(); const cv = this.esp; if (!this.on.esp && !this.on.espc) { this._espClear(); return; }
    const W = window.innerWidth, H = window.innerHeight; if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; } const x = cv.getContext('2d'); x.clearRect(0, 0, W, H); this._espOn = true;
    const VP = g.renderer.viewProj; if (!VP) return; const P = g.player.pos;
    const proj = (p) => { const cx = VP[0] * p[0] + VP[4] * p[1] + VP[8] * p[2] + VP[12], cy = VP[1] * p[0] + VP[5] * p[1] + VP[9] * p[2] + VP[13], cw = VP[3] * p[0] + VP[7] * p[1] + VP[11] * p[2] + VP[15]; if (cw <= 0.1) return null; return [((cx / cw) * 0.5 + 0.5) * W, (1 - ((cy / cw) * 0.5 + 0.5)) * H]; };
    const list = []; if (this.on.esp && g.net) for (const p of g.net.peers.values()) if (p.av) list.push([p.av, `${p.name} · ID ${p.id}`, '#ff4466']);
    if (this.on.espc) for (const c of g.creatures.list) { if (c.avatar || Math.hypot(c.pos[0] - P[0], c.pos[2] - P[2]) > 200) continue; list.push([c, `${c.def.name}${c.dead ? ' (morto)' : ''} · #${c.uid ?? c.nid ?? ''}`, c.def.robot ? '#ffaa33' : c.npc ? '#ffee55' : '#66ddff']); }
    for (const [c, label, col] of list) {
      const sk = c.skel || (c.rig && c.rig.skel); const A = c.anim; if (!A || !A.world) continue; const bones = sk && sk.bones; const pts = [];
      for (let i = 0; i < A.world.length; i++) { const m = A.world[i]; const lx = m[12], ly = m[13], lz = m[14]; const M = c.model; pts.push(proj([M[0] * lx + M[4] * ly + M[8] * lz + M[12], M[1] * lx + M[5] * ly + M[9] * lz + M[13], M[2] * lx + M[6] * ly + M[10] * lz + M[14]])); }
      x.strokeStyle = col; x.lineWidth = 2; x.globalAlpha = 0.95;
      if (bones) for (let i = 0; i < bones.length; i++) { const pa = bones[i].parent; if (pa < 0 || !pts[i] || !pts[pa]) continue; x.beginPath(); x.moveTo(...pts[pa]); x.lineTo(...pts[i]); x.stroke(); }
      for (const p of pts) if (p) { x.fillStyle = col; x.fillRect(p[0] - 1.5, p[1] - 1.5, 3, 3); }
      const top = proj([c.pos[0], c.pos[1] + 2.2 * (c.def.scale || 1), c.pos[2]]); if (top) { const d = Math.hypot(c.pos[0] - P[0], c.pos[2] - P[2]); x.font = '700 12px sans-serif'; x.textAlign = 'center'; x.lineWidth = 3; x.strokeStyle = 'rgba(0,0,0,0.85)'; const t = `${label} · ${d.toFixed(0)} m`; x.strokeText(t, top[0], top[1]); x.fillStyle = col; x.fillText(t, top[0], top[1]); }
    }
    x.globalAlpha = 1;
  }
}
