// Rede elétrica: fios de cobre ligando aparelhos, painel elétrico como centro da rede, fontes de energia
// (placa solar, turbina eólica, roda d'água), baterias que guardam energia e a impressora 3D que consome.
// Uma rede só funciona se tiver um painel. Energia em joules (W × s).
import { mat4 } from '../engine/math.js';
import { PIECES, ITEMS } from './items.js';
import * as MX from './machines.js';

export const WIRE_MAX = 30, WIRE_PER = 5, BATT_CAP = 6000, PRINT_W = 60;
// receitas da impressora 3D: filamento + materiais, tempo em segundos
export const PRINTS = [
  { id: 'gunparts', out: 'gunparts', n: 1, cost: { filament: 2 }, time: 25 },
  { id: 'harpoon', out: 'harpoon', n: 1, cost: { filament: 4, gunparts: 2, scrap: 4, circuit: 2, iron: 2 }, time: 45 },
  { id: 'geiger', out: 'geiger', n: 1, cost: { filament: 2, circuit: 2, scrap: 3, crystal: 1 }, time: 35 },
  { id: 'scope4', out: 'scope4', n: 1, cost: { filament: 2, gunparts: 1, circuit: 1 }, time: 30 },
  { id: 'scope8', out: 'scope8', n: 1, cost: { filament: 3, gunparts: 1, circuit: 2, crystal: 1 }, time: 40 },
];
const MAXLINK = { printer: 2, panel: 10, solar: 3, wind: 3, waterwheel: 3, battery: 4 };
// ponto onde o fio encosta em cada aparelho (coordenadas locais)
const ANCHOR = { printer: [0.42, 0.18, -0.32], panel: [0, 0.95, 0], solar: [0.2, 0.4, 0.24], wind: [0, 0.25, 0.4], waterwheel: [0.98, 1.4, 0.18], battery: [0.15, 0.62, 0] };
let UID = 1;

export class PowerSystem {
  constructor(game) {
    this.g = game; this.nets = []; this.dirty = true; this.wiring = null; const r = game.renderer;
    this.mesh = { head: r.createMesh(MX.printerHeadMesh()), nozzle: r.createMesh(MX.printerNozzleMesh()), obj: r.createMesh(MX.printObjMesh()), rotor: r.createMesh(MX.windRotorMesh()), wheel: r.createMesh(MX.wheelMesh()), wire: r.createMesh(MX.segMesh([0.09, 0.07, 0.05])), bar: r.createMesh(MX.barMesh()) };
  }
  static isPower(p) { return !!(PIECES[p.type] && PIECES[p.type].power); }
  // dados persistentes do aparelho
  init(p) { if (!PowerSystem.isPower(p)) return; const d = p.data = p.data || {}; d.uid = d.uid || `${Date.now().toString(36)}${(UID++).toString(36)}${Math.floor(Math.random() * 1e4)}`; d.links = d.links || [];
    if (p.type === 'battery') d.charge = d.charge || 0; if (p.type === 'printer') { d.filament = d.filament || 0; d.tray = d.tray || []; d.job = d.job || null; } p.rotA = 0; this.dirty = true; }
  byUid(uid) { return this.g.build.pieces.find((q) => q.data && q.data.uid === uid); }
  pieces() { return this.g.build.pieces.filter((p) => PowerSystem.isPower(p)); }
  anchor(p) { const a = ANCHOR[p.type] || [0, 0.5, 0]; return mat4.transformPoint(p.model, a); }
  dist(a, b) { const pa = this.anchor(a), pb = this.anchor(b); return Math.hypot(pa[0] - pb[0], pa[1] - pb[1], pa[2] - pb[2]); }
  wiresFor(a, b) { return Math.max(1, Math.ceil(this.dist(a, b) / WIRE_PER)); }

  // ---------- fios ----------
  startWire(p) {
    const g = this.g; if (g.inv.count('copperwire') < 1) return g.ui.toast('Precisa de fio de cobre (fabrique na bancada: circuito + sucata)', 'warn');
    if (p.data.links.length >= MAXLINK[p.type]) return g.ui.toast(`${PIECES[p.type].name} já tem o máximo de ligações`, 'warn');
    this.wiring = { from: p }; g.ui.closePanels(true); g.onPanelClosed && g.onPanelClosed(); g.audio.play('cloth');
    g.ui.toast(`〰️ Puxando fio de ${PIECES[p.type].name}. Leve até outro aparelho e aperte E (até ${WIRE_MAX} m). X cancela.`, 'info');
  }
  cancelWire(msg) { if (!this.wiring) return; this.wiring = null; if (msg) this.g.ui.toast(msg, 'warn'); }
  connect(a, b) {
    const g = this.g; if (a === b) return false;
    if (a.data.links.includes(b.data.uid)) { g.ui.toast('Esses aparelhos já estão ligados', 'warn'); return false; }
    if (b.data.links.length >= MAXLINK[b.type]) { g.ui.toast(`${PIECES[b.type].name} já tem o máximo de ligações`, 'warn'); return false; }
    const d = this.dist(a, b); if (d > WIRE_MAX) { g.ui.toast(`Longe demais: ${d.toFixed(0)} m (máx ${WIRE_MAX} m)`, 'warn'); return false; }
    const n = this.wiresFor(a, b); if (g.inv.count('copperwire') < n) { g.ui.toast(`Precisa de ${n} fio(s) de cobre para ${d.toFixed(0)} m`, 'warn'); return false; }
    g.inv.remove('copperwire', n); a.data.links.push(b.data.uid); b.data.links.push(a.data.uid); this.dirty = true; g.audio.play('build');
    const net = this.netOf(a); const hint = !net || !net.hub ? ' — ainda falta ligar um painel elétrico na rede' : '';
    g.ui.toast(`🔌 ${PIECES[a.type].name} ligado a ${PIECES[b.type].name} (${n} fio${n > 1 ? 's' : ''})${hint}`, hint ? 'info' : 'ok'); return true;
  }
  disconnect(a, uid) { const b = this.byUid(uid); a.data.links = a.data.links.filter((u) => u !== uid); if (b) b.data.links = b.data.links.filter((u) => u !== a.data.uid); this.dirty = true; const n = b ? this.wiresFor(a, b) : 1; this.g.give('copperwire', Math.ceil(n / 2)); }
  // ao desmontar um aparelho: solta os fios e devolve o que estava dentro
  onRemove(p) { if (!p.data) return; for (const uid of [...p.data.links]) this.disconnect(p, uid);
    if (p.type === 'printer') { const g = this.g; if (p.data.filament) g.dropItem('filament', p.data.filament, [p.x, p.y + 0.3, p.z]); for (const [id, n] of p.data.tray || []) g.dropItem(id, n, [p.x, p.y + 0.3, p.z]); if (p.data.job) for (const [id, n] of Object.entries(p.data.job.cost)) if (id !== 'filament') g.dropItem(id, n, [p.x, p.y + 0.3, p.z]); }
    if (this.wiring && this.wiring.from === p) this.wiring = null; this.dirty = true; }

  // ---------- redes ----------
  rebuild() {
    this.dirty = false; this.nets = []; const all = this.pieces(); const seen = new Set();
    for (const p of all) { if (seen.has(p)) continue; const net = { list: [], hub: false, gen: 0, use: 0, stored: 0, cap: 0, ok: false }; const q = [p]; seen.add(p);
      while (q.length) { const c = q.pop(); net.list.push(c); c.net = net; if (c.type === 'panel') net.hub = true; for (const u of c.data.links) { const o = this.byUid(u); if (o && !seen.has(o)) { seen.add(o); q.push(o); } } }
      this.nets.push(net); }
  }
  netOf(p) { if (this.dirty) this.rebuild(); return p.net || null; }
  output(p) {
    const g = this.g, env = g.env, e = g.renderer.env; const cur = env.cur || {};
    if (p.type === 'solar') { const day = Math.max(0, Math.min(1, (e.sunDir ? e.sunDir[1] : 0.5) * 2.2)); return 60 * day * (1 - (cur.cloud || 0) * 0.75) * (1 - (cur.rain || 0) * 0.3); }
    if (p.type === 'wind') return Math.min(120, 22 + 42 * (cur.wind || 0.5));
    if (p.type === 'waterwheel') return p.data.water ? 90 : 0;
    return 0;
  }
  update(dt) {
    if (this.dirty) this.rebuild(); const g = this.g;
    for (const net of this.nets) {
      let gen = 0, use = 0, stored = 0, cap = 0; const bats = [], printing = [];
      for (const p of net.list) { const o = this.output(p); p.out = o; gen += o; if (p.type === 'battery') { bats.push(p); stored += p.data.charge; cap += BATT_CAP; } if (p.type === 'printer' && p.data.job) { printing.push(p); use += PRINT_W; } }
      net.gen = net.hub ? gen : 0; net.use = use; net.cap = cap;
      let ok = net.hub && (gen >= use || stored > 0);
      if (net.hub) { let rest = (gen - use) * dt; // sobra carrega as baterias; falta descarrega
        for (const b of bats) { if (rest > 0) { const k = Math.min(rest, BATT_CAP - b.data.charge); b.data.charge += k; rest -= k; } else if (rest < 0) { const k = Math.min(-rest, b.data.charge); b.data.charge -= k; rest += k; } }
        if (rest < -1e-6) ok = false; }
      net.stored = bats.reduce((a, b) => a + b.data.charge, 0); net.ok = ok;
      for (const p of printing) { p.powered = ok; if (!ok) continue; const j = p.data.job; j.t += dt; if (j.t >= j.time) this._finish(p); }
      for (const p of net.list) if (p.type !== 'printer') p.powered = net.hub;
    }
    // rotores giram conforme a geração
    for (const p of this.pieces()) { if (p.type === 'wind') p.rotA = (p.rotA || 0) + dt * (0.6 + (g.env.cur.wind || 0.5) * 2.2); if (p.type === 'waterwheel' && p.data.water) p.rotA = (p.rotA || 0) + dt * 1.1; }
    // fio sendo puxado: arrebenta se o jogador se afastar demais
    if (this.wiring) { const a = this.anchor(this.wiring.from), P = g.player.pos; if (Math.hypot(a[0] - P[0], a[2] - P[2]) > WIRE_MAX + 3) this.cancelWire(`O fio não alcança mais de ${WIRE_MAX} m — ligação cancelada`); }
  }

  // ---------- impressora 3D ----------
  loadFilament(p, n) { const g = this.g; const k = Math.min(n, g.inv.count('filament'), 20 - p.data.filament); if (k <= 0) return g.ui.toast(p.data.filament >= 20 ? 'A impressora já está cheia de filamento' : 'Sem filamento na mochila', 'warn'); g.inv.remove('filament', k); p.data.filament += k; g.audio.play('pickup'); }
  canPrint(p, r) { const g = this.g; if (p.data.job) return 'Imprimindo…'; if (p.data.filament < (r.cost.filament || 0)) return 'Falta filamento na impressora'; for (const [id, n] of Object.entries(r.cost)) if (id !== 'filament' && g.inv.count(id) < n) return `Falta ${ITEMS[id].name}`; return null; }
  print(p, r) {
    const g = this.g; const why = this.canPrint(p, r); if (why) return g.ui.toast(why, 'warn');
    p.data.filament -= r.cost.filament || 0; for (const [id, n] of Object.entries(r.cost)) if (id !== 'filament') g.inv.remove(id, n);
    p.data.job = { id: r.id, out: r.out, n: r.n, t: 0, time: r.time, cost: r.cost }; g.audio.play('build');
    const net = this.netOf(p); g.ui.toast(net && net.hub ? `🖨️ Imprimindo ${ITEMS[r.out].name} (${r.time} s)` : '🖨️ Trabalho na fila — a impressora está sem energia (ligue-a a um painel com fonte)', net && net.hub ? 'ok' : 'warn');
  }
  _finish(p) { const g = this.g, j = p.data.job; p.data.job = null; const t = p.data.tray.find((x) => x[0] === j.out); if (t) t[1] += j.n; else p.data.tray.push([j.out, j.n]);
    if (Math.hypot(p.x - g.player.pos[0], p.z - g.player.pos[2]) < 40) { g.audio.play('craft'); g.ui.toast(`🖨️ Impressão pronta: ${ITEMS[j.out].name}. Retire na impressora.`, 'ok'); } }
  takeTray(p) { const g = this.g; const left = []; for (const [id, n] of p.data.tray) { const k = g.inv.add(id, n); if (k) g.ui.toast(`+${k} ${ITEMS[id].icon} ${ITEMS[id].name}`, 'ok'); if (k < n) left.push([id, n - k]); } p.data.tray = left; if (left.length) g.ui.toast('Inventário cheio', 'warn'); g.audio.play('pickup'); }

  // ---------- desenho: partes móveis e fios ----------
  render(items) {
    const g = this.g; const eye = g.renderer.camPos || g.player.pos; const tmp = mat4.create();
    for (const p of this.pieces()) {
      if (Math.hypot(p.x - eye[0], p.z - eye[2]) > 150) continue; const sph = [p.x, p.y + 1, p.z, 4];
      if (p.type === 'printer') { const j = p.data.job, f = j ? j.t / j.time : p.data.tray.length ? 1 : 0, on = j && p.powered, t = g.env.elapsed;
        const hy = 0.42 + f * 0.25, hx = on ? Math.sin(t * 5.3) * 0.18 : 0, hz = on ? Math.cos(t * 3.7) * 0.12 : 0;
        items.push({ mesh: this.mesh.head, model: mat4.mul(mat4.create(), p.model, mat4.compose([0, hy, 0], 0)), sphere: sph });
        items.push({ mesh: this.mesh.nozzle, model: mat4.mul(mat4.create(), p.model, mat4.compose([hx, hy + 0.0, hz], 0)), sphere: sph, emissive: on ? 0.15 : 0 });
        if (f > 0.02) items.push({ mesh: this.mesh.obj, model: mat4.mul(mat4.create(), p.model, mat4.compose([0, 0.325, 0.02], 0, [1, Math.max(0.05, f), 1])), sphere: sph }); }
      if (p.type === 'wind') items.push({ mesh: this.mesh.rotor, model: mat4.mul(mat4.create(), p.model, mat4.compose([0, 6.3, 0.34], 0, 1, 0, p.rotA || 0)), sphere: [p.x, p.y + 6, p.z, 3] });
      if (p.type === 'waterwheel') items.push({ mesh: this.mesh.wheel, model: mat4.mul(mat4.create(), p.model, mat4.compose([0, 1.55, 0], 0, 1, p.rotA || 0)), sphere: [p.x, p.y + 1.5, p.z, 2.5] });
      if (p.type === 'battery') { const f = p.data.charge / BATT_CAP; if (f > 0.01) items.push({ mesh: this.mesh.bar, model: mat4.mul(mat4.create(), p.model, mat4.compose([-0.14, 0.2, 0.212], 0, [0.28 * f, 0.1, 0.01])), sphere: sph, emissive: 0.6, tint: f < 0.2 ? [2, 0.5, 0.4, 1] : null }); }
    }
    // fios entre aparelhos (catenária simples)
    const done = new Set();
    for (const p of this.pieces()) for (const u of p.data.links) { const k = p.data.uid < u ? p.data.uid + u : u + p.data.uid; if (done.has(k)) continue; done.add(k); const o = this.byUid(u); if (!o) continue;
      const a = this.anchor(p), b = this.anchor(o); if (Math.min(Math.hypot(a[0] - eye[0], a[2] - eye[2]), Math.hypot(b[0] - eye[0], b[2] - eye[2])) > 120) continue; this._wire(items, a, b, 0.016); }
    if (this.wiring) { const a = this.anchor(this.wiring.from), h = g.player.handWorldPos(); this._wire(items, a, h, 0.016, 0.4); }
    void tmp;
  }
  _wire(items, a, b, r, sagK = 1) {
    const L = Math.hypot(b[0] - a[0], b[2] - a[2]); const sag = Math.min(1.6, L * 0.06) * sagK; const N = Math.max(2, Math.min(10, Math.ceil(L / 2)));
    let prev = a; for (let i = 1; i <= N; i++) { const t = i / N; const p = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - sag * 4 * t * (1 - t), a[2] + (b[2] - a[2]) * t];
      const d = [p[0] - prev[0], p[1] - prev[1], p[2] - prev[2]], len = Math.hypot(...d), h = Math.hypot(d[0], d[2]);
      items.push({ mesh: this.mesh.wire, model: mat4.compose(prev, Math.atan2(d[0], d[2]), [r, r, len], -Math.atan2(d[1], h)), sphere: [p[0], p[1], p[2], len + 1], shadow: false }); prev = p; }
  }

  serializePiece(p) { if (!p.data) return undefined; const d = { ...p.data }; if (d.job) d.job = { ...d.job }; return d; }
}
