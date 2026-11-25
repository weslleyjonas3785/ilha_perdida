// Mapa do mundo (tecla M): relevo, rios, estradas, cidades e sítios; zoom e arraste; clique marca um ponto.
// As marcações aparecem no jogo (rótulo com distância na tela e na bússola) e são salvas.
import { NC, CC, HALF, SIZE } from './world.js';

const $ = (id) => document.getElementById(id);
const COLORS = ['#ffcc33', '#4fd1ff', '#ff6b6b', '#7dff7a', '#d38bff', '#ff9f43', '#ffffff', '#ff5fd2'];
export const MAX_MARKS = 8;
const fmtD = (d) => (d >= 1000 ? (d / 1000).toFixed(d >= 10000 ? 0 : 1).replace('.', ',') + ' km' : Math.round(d) + ' m');

export class WorldMap {
  constructor(game) {
    this.g = game; this.marks = []; this.view = null; this.base = null; this.drag = null; this.hover = null;
    const panel = document.createElement('div'); panel.id = 'mapPanel'; panel.className = 'hidden';
    panel.innerHTML = `<canvas id="mapCanvas"></canvas>
      <div class="mapTop"><h2>Mapa da ilha</h2><span id="mapInfo"></span><button class="close" id="mapClose">✕</button></div>
      <div class="mapHelp"><span class="hpc">Clique: marcar ponto · clique na marca ou botão direito: remover · roda: zoom · arrastar: mover · <b>M</b> fecha</span><span class="hmob">Toque: marcar/desmarcar · arraste com um dedo para mover · pinça com dois dedos: zoom</span></div>
      <div class="mapLegend"><span><i class="lg city"></i>Cidade</span><span><i class="lg village"></i>Vilarejo</span><span><i class="lg industry"></i>Indústria</span><span><i class="lg military"></i>Base militar</span><span><i class="lg cave"></i>Caverna</span></div>
      <div class="mapMarks" id="mapMarks"></div>`;
    document.body.appendChild(panel); this.panel = panel; this.cv = $('mapCanvas'); this.ctx = this.cv.getContext('2d');
    const layer = document.createElement('div'); layer.id = 'markLayer'; $('hud').appendChild(layer); this.layer = layer; this.els = [];
    $('mapClose').onclick = () => game.ui.closePanels();
    const cv = this.cv;
    cv.addEventListener('wheel', (e) => { e.preventDefault(); const [wx, wz] = this.toWorld(e.offsetX, e.offsetY); const v = this.view; v.s = Math.min(3, Math.max(this.minS, v.s * (e.deltaY < 0 ? 1.25 : 0.8))); const [sx, sy] = this.toScreen(wx, wz); v.cx += (sx - e.offsetX) / v.s; v.cz += (sy - e.offsetY) / v.s; this.draw(); }, { passive: false });
    cv.addEventListener('mousedown', (e) => { this.drag = { x: e.offsetX, y: e.offsetY, cx: this.view.cx, cz: this.view.cz, moved: false, btn: e.button }; });
    cv.addEventListener('mousemove', (e) => { this.hover = [e.offsetX, e.offsetY]; const d = this.drag; if (d) { const dx = e.offsetX - d.x, dy = e.offsetY - d.y; if (Math.hypot(dx, dy) > 4) d.moved = true; if (d.moved) { this.view.cx = d.cx - dx / this.view.s; this.view.cz = d.cz - dy / this.view.s; } } this.draw(); });
    window.addEventListener('mouseup', (e) => { const d = this.drag; this.drag = null; if (!d || d.moved || this.g.ui.open !== 'map' || e.target !== cv) return; const [wx, wz] = this.toWorld(e.offsetX, e.offsetY); if (d.btn === 2) this.removeNear(e.offsetX, e.offsetY, 1e9); else this.clickAt(wx, wz, e.offsetX, e.offsetY); });
    cv.addEventListener('contextmenu', (e) => e.preventDefault());
    // toque: um dedo arrasta o mapa (toque rápido marca/desmarca), dois dedos em pinça aumentam/diminuem o zoom
    const tp = new Map(); let tg = null; const rel = (t) => { const r = cv.getBoundingClientRect(); return [t.clientX - r.left, t.clientY - r.top]; };
    const pinchInfo = () => { const [a, b] = [...tp.values()]; return { d: Math.hypot(a[0] - b[0], a[1] - b[1]) || 1, m: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] }; };
    const begin = () => { const v = this.view; if (tp.size === 1) { const [p] = [...tp.values()]; tg = { kind: 'pan', x: p[0], y: p[1], cx: v.cx, cz: v.cz, moved: tg ? tg.moved || tg.pinched : false, pinched: tg ? tg.pinched : false }; }
      else if (tp.size >= 2) { const I = pinchInfo(); const [wx, wz] = this.toWorld(I.m[0], I.m[1]); tg = { kind: 'pinch', d0: I.d, s0: v.s, wx, wz, moved: true, pinched: true }; } };
    cv.addEventListener('touchstart', (e) => { e.preventDefault(); for (const t of e.changedTouches) tp.set(t.identifier, rel(t)); if (tp.size === 1 && !tg) tg = null; begin(); }, { passive: false });
    cv.addEventListener('touchmove', (e) => { e.preventDefault(); for (const t of e.changedTouches) if (tp.has(t.identifier)) tp.set(t.identifier, rel(t)); const v = this.view; if (!tg || !v) return;
      if (tg.kind === 'pan' && tp.size === 1) { const [p] = [...tp.values()]; const dx = p[0] - tg.x, dy = p[1] - tg.y; if (Math.hypot(dx, dy) > 8) tg.moved = true; if (tg.moved) { v.cx = tg.cx - dx / v.s; v.cz = tg.cz - dy / v.s; } }
      else if (tg.kind === 'pinch' && tp.size >= 2) { const I = pinchInfo(); v.s = Math.min(3, Math.max(this.minS, tg.s0 * I.d / tg.d0)); // o ponto entre os dedos fica parado e acompanha o movimento
        v.cx = tg.wx - (I.m[0] - this.W / 2) / v.s; v.cz = tg.wz - (I.m[1] - this.H / 2) / v.s; }
      this.draw(); }, { passive: false });
    const tend = (e) => { e.preventDefault(); const last = tp.size === 1 ? [...tp.values()][0] : null; for (const t of e.changedTouches) tp.delete(t.identifier);
      if (tp.size === 0) { const tap = tg && tg.kind === 'pan' && !tg.moved && !tg.pinched; tg = null; if (tap && last && this.g.ui.open === 'map') { const [wx, wz] = this.toWorld(last[0], last[1]); this.clickAt(wx, wz, last[0], last[1]); } }
      else { const keep = tg; begin(); if (tg && keep) { tg.moved = true; tg.pinched = keep.pinched; } } };
    cv.addEventListener('touchend', tend, { passive: false }); cv.addEventListener('touchcancel', tend, { passive: false });
    window.addEventListener('resize', () => { if (this.g.ui.open === 'map') this.open(); });
  }
  // ---------- marcações ----------
  clickAt(wx, wz, sx, sy) { const A = this.g.admin; if (A && A.tpMode) { if (Math.abs(wx) > HALF || Math.abs(wz) > HALF) return; A.tpMode = false; this.g.ui.closePanels(); A.teleport(wx, wz); return; } if (this.removeNear(sx, sy, 12)) return; if (Math.abs(wx) > HALF || Math.abs(wz) > HALF) return;
    if (this.marks.length >= MAX_MARKS) this.marks.shift(); const used = new Set(this.marks.map((m) => m.c)); const c = COLORS.findIndex((_, i) => !used.has(i));
    this.marks.push({ x: Math.round(wx), z: Math.round(wz), c: c < 0 ? 0 : c }); this.g.audio.play('ui'); this.changed(); }
  removeNear(sx, sy, maxPx) { let bi = -1, bd = maxPx; this.marks.forEach((m, i) => { const [x, y] = this.toScreen(m.x, m.z); const d = Math.hypot(x - sx, y - sy); if (d < bd) { bd = d; bi = i; } }); if (bi < 0) return false; this.marks.splice(bi, 1); this.changed(); return true; }
  changed() { this.draw(); this.list(); this._syncEls(); }
  load(arr) { this.marks = (arr || []).filter((m) => Number.isFinite(m.x) && Number.isFinite(m.z)).slice(0, MAX_MARKS).map((m, i) => ({ x: m.x, z: m.z, c: Number.isInteger(m.c) ? m.c : i })); this._syncEls(); }
  save() { return this.marks.map((m) => ({ x: m.x, z: m.z, c: m.c })); }
  list() { const P = this.g.player.pos; $('mapMarks').innerHTML = this.marks.map((m, i) => `<div class="mk"><i style="background:${COLORS[m.c]}"></i>Marca ${i + 1} · ${fmtD(Math.hypot(m.x - P[0], m.z - P[2]))}<button data-i="${i}">✕</button></div>`).join('');
    for (const b of $('mapMarks').querySelectorAll('button')) b.onclick = () => { this.marks.splice(+b.dataset.i, 1); this.changed(); }; }
  // ---------- painel ----------
  open() {
    this.panel.classList.remove('hidden'); const cv = this.cv; const W = cv.clientWidth, H = cv.clientHeight, dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); this.dpr = dpr; this.W = W; this.H = H; this.minS = Math.min(W, H) / SIZE * 0.95;
    if (!this.base) this._buildBase();
    const P = this.g.player.pos; if (!this.view) this.view = { cx: P[0], cz: P[2], s: Math.max(this.minS, 0.22) }; else { this.view.cx = P[0]; this.view.cz = P[2]; }
    this.draw(); this.list();
  }
  close() { this.panel.classList.add('hidden'); this.drag = null; }
  toWorld(sx, sy) { const v = this.view; return [v.cx + (sx - this.W / 2) / v.s, v.cz + (sy - this.H / 2) / v.s]; }
  toScreen(x, z) { const v = this.view; return [this.W / 2 + (x - v.cx) * v.s, this.H / 2 + (z - v.cz) * v.s]; }
  _buildBase() {
    const w = this.g.world, H = w.coarse, C = w.coarseCol; const img = document.createElement('canvas'); img.width = img.height = NC; const x = img.getContext('2d', { willReadFrequently: true }); const id = x.createImageData(NC, NC);
    for (let j = 0; j < NC; j++) for (let i = 0; i < NC; i++) { const k = j * NC + i, h = H[k]; let r, g, b;
      if (h < 0) { const t = Math.min(1, -h / 14); r = 40 - 22 * t; g = 92 - 40 * t; b = 128 - 30 * t; }
      else { const hl = H[j * NC + Math.max(0, i - 1)], hu = H[Math.max(0, j - 1) * NC + i]; const sh = Math.max(0.55, Math.min(1.35, 1 + ((hl - h) + (hu - h)) * 0.035)); r = C[k * 3] * 255 * sh; g = C[k * 3 + 1] * 255 * sh; b = C[k * 3 + 2] * 255 * sh; }
      id.data[k * 4] = r; id.data[k * 4 + 1] = g; id.data[k * 4 + 2] = b; id.data[k * 4 + 3] = 255; }
    x.putImageData(id, 0, 0);
    // camada vetorial em resolução maior: rios e estradas
    const B = 1536, base = document.createElement('canvas'); base.width = base.height = B; const c = base.getContext('2d', { willReadFrequently: true }); c.imageSmoothingEnabled = true; c.drawImage(img, 0, 0, B, B);
    const S = B / SIZE, P = (px, pz) => [(px + HALF) * S, (pz + HALF) * S];
    c.lineCap = 'round'; c.lineJoin = 'round';
    for (const rv of w.rivers) { c.strokeStyle = '#2d6f95'; c.beginPath(); rv.forEach(([px, pz], i) => { const [a, b] = P(px, pz); i ? c.lineTo(a, b) : c.moveTo(a, b); }); c.lineWidth = 3.2; c.stroke(); }
    for (const l of w.lakes) { const [a, b] = P(l.x, l.z); c.fillStyle = '#2d6f95'; c.beginPath(); c.arc(a, b, l.r * S * 0.85, 0, 6.29); c.fill(); }
    for (const f of w.falls || []) { const [a, b] = P(f.px, f.pz); c.fillStyle = '#3d8fb0'; c.beginPath(); c.arc(a, b, 2.2, 0, 6.29); c.fill(); }
    for (const pass of [0, 1]) for (const s of w.roadSegs) { if (s[6] === 'street') continue; const hw = s[4] >= 9, dirt = s[7] === 'dirt'; const [a, b] = P(s[0], s[1]), [d, e] = P(s[2], s[3]); c.beginPath(); c.moveTo(a, b); c.lineTo(d, e);
      if (!pass) { c.strokeStyle = 'rgba(30,26,22,0.85)'; c.lineWidth = hw ? 5.2 : dirt ? 2.4 : 3.6; c.stroke(); }
      else { c.strokeStyle = hw ? '#f0c850' : dirt ? '#b8946a' : '#e8e2d0'; c.lineWidth = hw ? 3.2 : dirt ? 1.1 : 1.9; c.stroke(); } }
    for (const s of w.roadSegs) { if (s[6] !== 'street') continue; const [a, b] = P(s[0], s[1]), [d, e] = P(s[2], s[3]); c.strokeStyle = 'rgba(70,66,60,0.9)'; c.lineWidth = 1; c.beginPath(); c.moveTo(a, b); c.lineTo(d, e); c.stroke(); }
    this.base = base; this.baseS = S;
  }
  draw() {
    if (!this.view || this.g.ui.open !== 'map') return; const c = this.ctx, v = this.view, w = this.g.world, dpr = this.dpr; c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.fillStyle = '#123448'; c.fillRect(0, 0, this.W, this.H);
    const [x0, y0] = this.toScreen(-HALF, -HALF); c.imageSmoothingEnabled = v.s < 0.6; c.drawImage(this.base, x0, y0, SIZE * v.s, SIZE * v.s);
    // grade de 1 km
    c.strokeStyle = 'rgba(255,255,255,0.07)'; c.lineWidth = 1; for (let k = -5; k <= 5; k++) { const [a, b] = this.toScreen(k * 1000, -HALF), [d, e] = this.toScreen(-HALF, k * 1000); c.beginPath(); c.moveTo(a, b); c.lineTo(a, b + SIZE * v.s); c.moveTo(d, e); c.lineTo(d + SIZE * v.s, e); c.stroke(); }
    c.font = '600 12px Barlow, sans-serif'; c.textAlign = 'center';
    for (const cv of w.caves) { const [a, b] = this.toScreen(cv.x, cv.z); c.fillStyle = '#b07cff'; c.beginPath(); c.arc(a, b, 3.5, 0, 6.29); c.fill(); }
    for (const s of w.sites) { const [a, b] = this.toScreen(s.x, s.z); const col = { city: '#ff5a4a', village: '#ffb347', industry: '#c8c8c8', military: '#9bc06a' }[s.kind]; let r0 = 0; const r = Math.max(s.kind === 'city' ? 6 : 4, s.r * v.s);
      if (s.kind === 'city') { // ícone de cidade: casinhas e prédio
        const z = Math.max(7, Math.min(22, s.r * v.s * 0.55)) * (s.toxic ? 1.25 : 1); const big = s.r >= 100 || s.toxic; c.lineWidth = 1.5; c.strokeStyle = 'rgba(0,0,0,0.8)';
        const house = (x, y, k, fill) => { c.fillStyle = fill; c.beginPath(); c.moveTo(x - k, y + k); c.lineTo(x - k, y - k * 0.2); c.lineTo(x, y - k); c.lineTo(x + k, y - k * 0.2); c.lineTo(x + k, y + k); c.closePath(); c.fill(); c.stroke(); };
        if (big) { c.fillStyle = s.toxic ? '#9adf5a' : '#e8e2d0'; c.fillRect(a - z * 0.3, b - z * 1.1, z * 0.6, z * 1.6); c.strokeRect(a - z * 0.3, b - z * 1.1, z * 0.6, z * 1.6); house(a - z * 0.75, b + z * 0.2, z * 0.42, '#f0b860'); house(a + z * 0.75, b + z * 0.25, z * 0.38, '#e86a50'); }
        else { house(a - z * 0.35, b + z * 0.1, z * 0.45, '#f0b860'); house(a + z * 0.4, b + z * 0.2, z * 0.38, '#e86a50'); }
        r0 = z * 1.1; }
      else { c.fillStyle = col + '55'; c.strokeStyle = col; c.lineWidth = 2; c.beginPath(); if (s.kind === 'military') c.rect(a - r, b - r, r * 2, r * 2); else c.arc(a, b, r, 0, 6.29); c.fill(); c.stroke(); }
      if (s.kind === 'city' || v.s > 0.12) { c.font = s.kind === 'city' ? '700 15px Barlow, sans-serif' : '600 12px Barlow, sans-serif'; c.lineWidth = 3; c.strokeStyle = 'rgba(0,0,0,0.75)'; c.strokeText(s.name, a, b - (r0 || r) - 6); c.fillStyle = '#fff'; c.fillText(s.name, a, b - (r0 || r) - 6); } }
    const g = this.g, P = g.player.pos;
    if (g.home) { const [a, b] = this.toScreen(g.home[0], g.home[2]); c.font = '700 16px sans-serif'; c.fillStyle = '#ffd36b'; c.fillText('⌂', a, b + 5); }
    this.marks.forEach((m, i) => { const [a, b] = this.toScreen(m.x, m.z); c.fillStyle = COLORS[m.c]; c.strokeStyle = '#000'; c.lineWidth = 2; c.beginPath(); c.moveTo(a, b); c.lineTo(a - 7, b - 16); c.arc(a, b - 18, 7, Math.PI * 0.85, Math.PI * 0.15); c.closePath(); c.fill(); c.stroke();
      c.fillStyle = '#000'; c.font = '700 10px sans-serif'; c.fillText(String(i + 1), a, b - 14.5);
      c.font = '600 12px Barlow, sans-serif'; c.lineWidth = 3; c.strokeStyle = 'rgba(0,0,0,0.8)'; const t = fmtD(Math.hypot(m.x - P[0], m.z - P[2])); c.strokeText(t, a, b + 14); c.fillStyle = '#fff'; c.fillText(t, a, b + 14); });
    if (g.admin) g.admin.drawMap(c, this);
    // jogador (seta na direção da câmera)
    { const [a, b] = this.toScreen(P[0], P[2]); const yaw = g.cam.yaw; const fx = Math.sin(yaw), fz = Math.cos(yaw); c.save(); c.translate(a, b); c.rotate(Math.atan2(fx, -fz)); c.fillStyle = '#fff'; c.strokeStyle = '#000'; c.lineWidth = 2; c.beginPath(); c.moveTo(0, -11); c.lineTo(7, 8); c.lineTo(0, 4); c.lineTo(-7, 8); c.closePath(); c.fill(); c.stroke(); c.restore(); }
    // escala
    const L = [100, 250, 500, 1000, 2000].find((l) => l * v.s > 70) || 2000; c.fillStyle = '#fff'; c.fillRect(20, this.H - 30, L * v.s, 3); c.font = '600 12px Barlow, sans-serif'; c.textAlign = 'left'; c.fillText(fmtD(L), 20, this.H - 38);
    if (this.hover) { const [hx, hz] = this.toWorld(...this.hover); $('mapInfo').textContent = `Cursor: ${fmtD(Math.hypot(hx - P[0], hz - P[2]))} de você`; }
  }
  // ---------- marcações no jogo ----------
  _syncEls() {
    while (this.els.length < this.marks.length) { const d = document.createElement('div'); d.className = 'wmark'; d.innerHTML = '<i></i><b></b><span></span>'; this.layer.appendChild(d); const cm = document.createElement('span'); cm.className = 'm wm'; this.g.ui.strip.appendChild(cm); this.els.push({ d, cm }); }
    while (this.els.length > this.marks.length) { const e = this.els.pop(); e.d.remove(); e.cm.remove(); }
    this.marks.forEach((m, i) => { const e = this.els[i]; e.d.style.setProperty('--c', COLORS[m.c]); e.d.querySelector('b').textContent = i + 1; e.cm.style.color = COLORS[m.c]; e.cm.textContent = '◆'; });
  }
  updateHUD() {
    if (!this.marks.length) return; const g = this.g, r = g.renderer, P = g.player.pos, VP = r.viewProj; if (!VP) return; const W = window.innerWidth, H = window.innerHeight;
    this.marks.forEach((m, i) => { const e = this.els[i]; if (!e) return; const y = g.world.heightFast(m.x, m.z) + 2; const d = Math.hypot(m.x - P[0], m.z - P[2]);
      const cx = VP[0] * m.x + VP[4] * y + VP[8] * m.z + VP[12], cy = VP[1] * m.x + VP[5] * y + VP[9] * m.z + VP[13], cw = VP[3] * m.x + VP[7] * y + VP[11] * m.z + VP[15];
      let sx, sy, edge = false; if (cw > 0.1) { sx = (cx / cw * 0.5 + 0.5) * W; sy = (1 - (cy / cw * 0.5 + 0.5)) * H; } else { sx = W / 2 - Math.sign(cx || 1) * W; sy = H * 0.5; edge = true; }
      if (sx < 30 || sx > W - 30 || sy < 60 || sy > H - 90) edge = true; sx = Math.min(W - 30, Math.max(30, sx)); sy = Math.min(H - 90, Math.max(60, sy));
      e.d.style.transform = `translate(${sx}px, ${sy}px)`; e.d.classList.toggle('edge', edge); e.d.classList.toggle('near', d < 6); e.d.querySelector('span').textContent = fmtD(d);
      const a = Math.atan2(m.x - P[0], -(m.z - P[2])) * 180 / Math.PI; e.cm.style.left = (((a % 360) + 360) % 360 + 360) * g.ui.pxPerDeg + 'px'; });
  }
}
