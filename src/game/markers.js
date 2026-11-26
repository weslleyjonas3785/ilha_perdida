// Marcações no mundo: pings do botão do meio (scroll) do mouse — até 3, clicar de novo em cima de um tira ele —
// e o marcador azul "BASE" em cima de cada Territoritek seu (na tela, na bússola e no mapa).
const MAX_PINGS = 3;
const fmtD = (d) => (d >= 1000 ? (d / 1000).toFixed(d >= 10000 ? 0 : 1).replace('.', ',') + ' km' : Math.round(d) + ' m');

export class Markers {
  constructor(game) { this.g = game; this.pings = []; this.els = new Map(); }
  get layer() { return this.g.map && this.g.map.layer; }
  reset() { this.pings = []; this._sync(); }
  save() { return this.pings.map((p) => [Math.round(p.x * 10) / 10, Math.round(p.y * 10) / 10, Math.round(p.z * 10) / 10]); }
  load(a) { this.pings = (a || []).slice(0, MAX_PINGS).filter((p) => p.length === 3).map(([x, y, z]) => ({ x, y, z })); }
  // bases: Territoritek já armado do jogador
  bases() { const g = this.g, me = g.territory ? g.territory.me() : null; const out = [];
    for (const p of g.build.pieces) if (p.type === 'flag' && p.data && p.data.dep === 'done' && (!p.data.owner || p.data.owner === me)) out.push({ x: p.x, y: p.y + 3.4, z: p.z, base: true, p });
    return out; }
  // botão do meio: marca onde está olhando; se mirar em cima de uma marca, tira ela
  ping() {
    const g = this.g, F = g.guns, cam = g.cam; const o = F._aimOrigin ? F._aimOrigin() : cam.eye.slice(); const d = F._rayDir ? F._rayDir() : norm([cam.target[0] - cam.eye[0], cam.target[1] - cam.eye[1], cam.target[2] - cam.eye[2]]);
    // mirando numa marca existente (perto do centro da tela)? remove
    const W = innerWidth, H = innerHeight; let rm = -1, bd = 46; this.pings.forEach((p, i) => { const s = this.project(p.x, p.y, p.z); if (s && !s.behind) { const dd = Math.hypot(s.x - W / 2, s.y - H / 2); if (dd < bd) { bd = dd; rm = i; } } });
    F._dryTrace = true; const hit = F._worldTrace(o, d, 600); F._dryTrace = false;
    if (rm < 0 && hit) this.pings.forEach((p, i) => { if (rm < 0 && Math.hypot(p.x - hit.p[0], p.y - hit.p[1], p.z - hit.p[2]) < 2.5) rm = i; });
    if (rm >= 0) { this.pings.splice(rm, 1); g.audio.play('ui'); this._sync(); return 'removed'; }
    if (!hit) { g.ui.toast('Longe demais para marcar', 'info'); return null; }
    if (this.pings.length >= MAX_PINGS) { this.pings.shift(); g.ui.toast(`Só dá para ter ${MAX_PINGS} marcações — a mais antiga saiu`, 'info'); }
    this.pings.push({ x: hit.p[0], y: hit.p[1], z: hit.p[2], t: performance.now() }); g.audio.play('ping'); this._sync(); return 'added';
  }
  project(x, y, z) { const VP = this.g.renderer.viewProj; if (!VP) return null; const W = innerWidth, H = innerHeight;
    const cx = VP[0] * x + VP[4] * y + VP[8] * z + VP[12], cy = VP[1] * x + VP[5] * y + VP[9] * z + VP[13], cw = VP[3] * x + VP[7] * y + VP[11] * z + VP[15];
    if (cw <= 0.1) return { x: W / 2 - Math.sign(cx || 1) * W, y: H / 2, behind: true }; return { x: (cx / cw * 0.5 + 0.5) * W, y: (1 - (cy / cw * 0.5 + 0.5)) * H }; }
  all() { return [...this.pings.map((p, i) => ({ ...p, key: 'p' + i, n: i + 1 })), ...this.bases().map((b, i) => ({ ...b, key: 'b' + i }))]; }
  _el(key, base) { let e = this.els.get(key); if (e) return e; const L = this.layer; if (!L) return null;
    const d = document.createElement('div'); d.className = base ? 'wmark basemk' : 'wmark pingmk'; d.innerHTML = base ? '<i></i><b>BASE</b><span></span>' : '<i></i><b></b><span></span>'; L.appendChild(d);
    const cm = document.createElement('span'); cm.className = base ? 'm wm cbase' : 'm wm cping'; cm.textContent = base ? 'BASE' : '◆'; this.g.ui.strip.appendChild(cm); e = { d, cm }; this.els.set(key, e); return e; }
  _sync() { const keep = new Set(this.all().map((m) => m.key)); for (const [k, e] of this.els) if (!keep.has(k)) { e.d.remove(); e.cm.remove(); this.els.delete(k); } }
  update(act) {
    const g = this.g; if (act && act.ping && g.state === 'playing' && !g.ui.anyOpen && !g.player.dead) this.ping();
    const P = g.player.pos, W = innerWidth, H = innerHeight; const list = this.all(); const sig = list.map((m) => m.key).join(','); if (sig !== this._sig) { this._sig = sig; this._sync(); }
    for (const m of list) { const e = this._el(m.key, m.base); if (!e) continue; const d = Math.hypot(m.x - P[0], m.z - P[2]); const s = this.project(m.x, m.y + (m.base ? 0 : 0.6), m.z);
      let sx = s ? s.x : -100, sy = s ? s.y : -100, edge = !s || s.behind; if (sx < 30 || sx > W - 30 || sy < 60 || sy > H - 90) edge = true; sx = Math.min(W - 30, Math.max(30, sx)); sy = Math.min(H - 90, Math.max(60, sy));
      e.d.style.transform = `translate(${sx}px, ${sy}px)`; e.d.classList.toggle('edge', edge); e.d.classList.toggle('near', !m.base && d < 4); e.d.querySelector('span').textContent = fmtD(d); if (!m.base) e.d.querySelector('b').textContent = m.n;
      const a = Math.atan2(m.x - P[0], -(m.z - P[2])) * 180 / Math.PI; e.cm.style.left = (((a % 360) + 360) % 360 + 360) * g.ui.pxPerDeg + 'px'; }
  }
  // mapa: bases em azul e pings em amarelo
  drawMap(c, toScreen) { for (const b of this.bases()) { const [x, y] = toScreen(b.x, b.z); c.fillStyle = '#3d8bff'; c.strokeStyle = '#04122a'; c.lineWidth = 2; c.beginPath(); c.arc(x, y, 7, 0, Math.PI * 2); c.fill(); c.stroke(); c.font = '700 11px Barlow, sans-serif'; c.textAlign = 'center'; c.fillStyle = '#9cc4ff'; c.fillText('BASE', x, y - 11); }
    this.pings.forEach((p, i) => { const [x, y] = toScreen(p.x, p.z); c.fillStyle = '#ffd23a'; c.strokeStyle = '#000'; c.lineWidth = 2; c.save(); c.translate(x, y); c.rotate(Math.PI / 4); c.fillRect(-5, -5, 10, 10); c.strokeRect(-5, -5, 10, 10); c.restore(); c.fillStyle = '#000'; c.font = '700 9px sans-serif'; c.textAlign = 'center'; c.fillText(i + 1, x, y + 3); }); }
}
function norm(v) { const l = Math.hypot(...v) || 1; return v.map((x) => x / l); }
