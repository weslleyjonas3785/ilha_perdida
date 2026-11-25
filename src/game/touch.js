// Controles de celular: o jogo detecta que foi aberto num celular/tablet e mostra o joystick e os botões na tela
// (no computador não aparecem). Pede tela cheia e trava na horizontal quando o navegador deixa; em pé, mostra o aviso
// para girar. A engrenagem ⚙ abre o modo de edição: arrastar cada botão, mudar o tamanho de todos ou de um só e a
// transparência (fica salvo no aparelho).
import { GUNS } from './weapons.js';
const KEY = 'ilha_touch_layout_v1';
// posição padrão: centro em fração da tela (x, y) e escala
export const TOUCH_DEFAULT = {
  joy: [0.12, 0.72, 1], inventory: [0.05, 0.44, 0.9], attack: [0.17, 0.42, 1.15], pin: [0.28, 0.36, 0.85],
  block: [0.79, 0.5, 1], jump: [0.91, 0.5, 1], interact: [0.79, 0.73, 1], crouch: [0.91, 0.73, 1], reload: [0.9, 0.93, 0.9], slide: [0.79, 0.93, 0.9],
  sprint: [0.68, 0.82, 0.95], shoulder: [0.68, 0.6, 0.85], unequip: [0.5, 0.68, 0.8],
  mic: [0.68, 0.2, 0.8], map: [0.8, 0.2, 0.8], build: [0.86, 0.2, 0.8], pause: [0.92, 0.2, 0.8], gear: [0.74, 0.2, 0.8], rotate: [0.6, 0.86, 0.9], cancel: [0.6, 0.66, 0.9],
};
const NAMES = { joy: 'Joystick', inventory: 'Mochila', attack: 'Atirar', pin: 'Pino', block: 'Mirar', jump: 'Pular', interact: 'Usar', crouch: 'Agachar', slide: 'Deslizar', reload: 'Recarregar', sprint: 'Correr', shoulder: 'Ombro', unequip: 'Mãos', mic: 'Voz', map: 'Mapa', build: 'Construir', pause: 'Pausa', gear: 'Engrenagem', rotate: 'Girar', cancel: 'Sair' };
export function isMobileDevice() {
  if (typeof window === 'undefined') return false; if (window.__FORCE_MOBILE) return true; if (window.__TEST_RES && !window.__FORCE_MOBILE) return false;
  const ua = navigator.userAgent || ''; const uaMobile = /Android|iPhone|iPad|iPod|Mobile|Silk|Kindle|Opera Mini|IEMobile/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches; return uaMobile || (coarse && navigator.maxTouchPoints > 0 && !window.matchMedia('(hover: hover)').matches);
}
export class TouchControls {
  constructor(game) {
    this.g = game; this.on = isMobileDevice(); this.edit = false; this.sel = null; this.layout = this._load();
    if (!this.on) return;
    document.body.classList.add('mobile', 'touch'); game.input.touchActive = true; game.input.mobile = true;
    this.els = [...document.querySelectorAll('#mobile .tctl')]; this.apply();
    window.addEventListener('resize', () => { this.apply(); this._orient(); }); window.addEventListener('orientationchange', () => setTimeout(() => { this.apply(); this._orient(); }, 200));
    // primeiro toque: tela cheia + horizontal (Android); no iPhone fica o aviso para girar
    const first = () => { this.fullscreen(); }; document.addEventListener('touchend', first, { passive: true });
    const $ = (id) => document.getElementById(id);
    // engrenagem → menu → "Modificar controles": tela com todos os botões para mover/redimensionar; só grava ao Salvar
    $('tGear').addEventListener('click', (e) => { e.stopPropagation(); if (this.edit) return; this.menu(!this.menuOpen); });
    $('tMenuClose').onclick = () => this.menu(false);
    $('tModify').onclick = () => { this.menu(false, true); this.setEdit(true); };
    $('tSave').onclick = () => { this.save(); this.setEdit(false); this.g.ui.toast('🎮 Controles salvos', 'ok'); };
    $('tCancel').onclick = () => { this.layout = JSON.parse(this._snap); this.apply(); this.setEdit(false); };
    $('tReset').onclick = () => { this.layout = { pos: {}, all: 1, alpha: 0.85 }; this.apply(); this._syncPanel(); };
    $('tSizeAll').oninput = (e) => { this.layout.all = +e.target.value; this.apply(); };
    const one = (v) => { if (!this.sel) return; const p = this._get(this.sel); this.layout.pos[this.sel] = [p[0], p[1], Math.min(2.2, Math.max(0.5, +v))]; this.apply(); this._syncPanel(); };
    $('tSizeOne').oninput = (e) => one(e.target.value); $('tMinus').onclick = () => this.sel && one(this._get(this.sel)[2] - 0.1); $('tPlus').onclick = () => this.sel && one(this._get(this.sel)[2] + 0.1);
    $('tAlpha').oninput = (e) => { this.layout.alpha = +e.target.value; this.apply(); };
    for (const el of this.els) this._dragEdit(el);
    // o painel de edição pode ser arrastado pelo título (para não ficar em cima de algum botão)
    { const pn = $('tEdit'), hd = pn.querySelector('.tEditHead'); let st = null; const mv = (x, y) => { if (!st) return; pn.style.left = Math.max(0, Math.min(innerWidth - pn.offsetWidth, st.l + x - st.x)) + 'px'; pn.style.top = Math.max(0, Math.min(innerHeight - 40, st.t + y - st.y)) + 'px'; pn.style.transform = 'none'; };
      const dn = (x, y) => { const r = pn.getBoundingClientRect(); st = { x, y, l: r.left, t: r.top }; };
      hd.addEventListener('touchstart', (e) => { const t = e.changedTouches[0]; dn(t.clientX, t.clientY); e.preventDefault(); }, { passive: false }); hd.addEventListener('touchmove', (e) => { const t = e.changedTouches[0]; mv(t.clientX, t.clientY); e.preventDefault(); }, { passive: false }); hd.addEventListener('touchend', () => { st = null; });
      hd.addEventListener('mousedown', (e) => { dn(e.clientX, e.clientY); const m = (ev) => mv(ev.clientX, ev.clientY), u = () => { st = null; window.removeEventListener('mousemove', m); window.removeEventListener('mouseup', u); }; window.addEventListener('mousemove', m); window.addEventListener('mouseup', u); }); }
    this._orient();
  }
  _load() { let L = null; try { L = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { /* sem armazenamento */ } return L && typeof L === 'object' ? { pos: L.pos || {}, all: L.all || 1, alpha: L.alpha || 0.85 } : { pos: {}, all: 1, alpha: 0.85 }; }
  save() { try { localStorage.setItem(KEY, JSON.stringify(this.layout)); } catch (e) { /* sem armazenamento */ } }
  _get(id) { return this.layout.pos[id] || TOUCH_DEFAULT[id] || [0.5, 0.5, 1]; }
  // posiciona cada controle (centro em fração da tela; escala individual × geral)
  apply() { const W = window.innerWidth, H = window.innerHeight, base = Math.min(1.25, Math.max(0.7, Math.min(W, H) / 400));
    for (const el of this.els) { const id = el.dataset.id, p = this._get(id); const sc = p[2] * this.layout.all * base; el.style.left = (p[0] * W) + 'px'; el.style.top = (p[1] * H) + 'px'; el.style.transform = `translate(-50%,-50%) scale(${sc.toFixed(3)})`; el.dataset.sc = sc; el.classList.toggle('tsel', this.edit && this.sel === id); }
    document.getElementById('mobile').style.setProperty('--talpha', this.layout.alpha); }
  _orient() { const port = window.innerHeight > window.innerWidth * 1.05; document.body.classList.toggle('portrait', this.on && port); }
  fullscreen() { if (window.__TEST_RES) return; const d = document.documentElement; try { if (!document.fullscreenElement && d.requestFullscreen) d.requestFullscreen({ navigationUI: 'hide' }).then(() => this._lock()).catch(() => this._lock()); else this._lock(); } catch (e) { this._lock(); } }
  _lock() { try { const o = screen.orientation; if (o && o.lock) o.lock('landscape').catch(() => {}); } catch (e) { /* não suportado */ } }
  // menu da engrenagem (o jogo fica parado enquanto ele ou a edição estão abertos)
  menu(v, keep) { this.menuOpen = v; document.getElementById('tMenu').classList.toggle('hidden', !v); if (!keep) this._freeze(v); }
  _freeze(v) { const g = this.g; if (v) { if (g.state === 'playing') { this._froze = true; g.state = 'paused'; } g.input.enabled = false; } else { if (this._froze) { this._froze = false; if (g.state === 'paused') g.state = 'playing'; } g.input.enabled = true; } }
  setEdit(v) { if (v) this._snap = JSON.stringify(this.layout); this.edit = v; document.body.classList.toggle('tedit', v); document.getElementById('tEdit').classList.toggle('hidden', !v); if (!v) this.sel = null; this._freeze(v); this._syncPanel(); this.apply(); }
  _syncPanel() { const $ = (id) => document.getElementById(id); $('tSizeAll').value = this.layout.all; $('tAlpha').value = this.layout.alpha; $('tSelName').textContent = this.sel ? (NAMES[this.sel] || this.sel) : '(toque num botão)'; $('tSizeOne').value = this.sel ? this._get(this.sel)[2] : 1; $('tSizeOne').disabled = !this.sel; }
  // modo edição: arrastar o controle (o botão não funciona enquanto edita)
  _dragEdit(el) {
    const id = el.dataset.id; let st = null;
    const down = (x, y, e) => { if (!this.edit || id === 'gear') return false; e.preventDefault(); e.stopPropagation(); this.sel = id; const p = this._get(id); st = { x, y, p: p.slice() }; this._syncPanel(); this.apply(); return true; };
    const move = (x, y) => { if (!st) return; const W = window.innerWidth, H = window.innerHeight; const nx = Math.min(0.98, Math.max(0.02, st.p[0] + (x - st.x) / W)), ny = Math.min(0.98, Math.max(0.02, st.p[1] + (y - st.y) / H)); this.layout.pos[id] = [nx, ny, st.p[2]]; this.apply(); };
    const up = () => { st = null; };
    el.addEventListener('touchstart', (e) => { const t = e.changedTouches[0]; down(t.clientX, t.clientY, e); }, { capture: true, passive: false });
    el.addEventListener('touchmove', (e) => { if (!st) return; const t = e.changedTouches[0]; move(t.clientX, t.clientY); e.preventDefault(); e.stopPropagation(); }, { capture: true, passive: false });
    el.addEventListener('touchend', up, true); el.addEventListener('touchcancel', up, true);
    el.addEventListener('mousedown', (e) => { if (down(e.clientX, e.clientY, e)) { const mm = (ev) => move(ev.clientX, ev.clientY); const mu = () => { up(); window.removeEventListener('mousemove', mm); window.removeEventListener('mouseup', mu); }; window.addEventListener('mousemove', mm); window.addEventListener('mouseup', mu); } }, true);
  }
  // a cada quadro: mostra os controles só durante o jogo (some nos menus e painéis)
  tick() { if (!this.on) return; const g = this.g; const panel = !!document.querySelector('.panel:not(.hidden)'); const show = (g.state === 'playing' || this._froze) && !panel && !g.menuMode;
    if (show !== this._show) { this._show = show; document.body.classList.toggle('tplay', show); }
    const inp = g.input, T = inp.touch; document.body.classList.toggle('sprintOn', !!T.sprintOn || !!T.autoRun || !!T.runLock); document.body.classList.toggle('runNear', !!T.runNear && !T.runLock); document.body.classList.toggle('runLock', !!(T.runLock || T.autoRun));
    // com arma de fogo na mão (e nada para pegar/usar por perto) o botão USAR vira ATIRAR
    const h = g.equip && g.equip.hand; const gunUse = !!(h && GUNS[h]) && !g._cur && !(g.build && g.build.mode); if (gunUse !== this._gunUse) { this._gunUse = gunUse; document.body.classList.toggle('gunUse', gunUse); } }
}
