// Streaming do mundo grande: carrega/descarrega por blocos de 192 m o terreno fino (com níveis de detalhe),
// os objetos (árvores, rochas, arbustos, coletáveis, colmeias) com seus colisores, e os assentamentos
// (prédios, carros e adereços mesclados por sítio). Longe do jogador o horizonte usa o grid grosso.
import { MeshBuilder } from '../engine/mesh.js';
import { mat4 } from '../engine/math.js';
import { TILES, TILE, TC, CELL, HALF, NC, CC } from './world.js';
import * as P from './props.js';

const R_OBJ = 2, R_OBJ_OUT = 3, R_FINE = 3, R_FINE_OUT = 4, FAR = 1650, SITE_IN = 520, SITE_OUT = 680;
const HT_N = 512, HT_CELL = 6;

export function appendRaw(mb, d, m) {
  const base = mb.pos.length / 3;
  for (let i = 0; i < d.pos.length; i += 3) { let p = [d.pos[i], d.pos[i + 1], d.pos[i + 2]], n = [d.nrm[i], d.nrm[i + 1], d.nrm[i + 2]]; if (m) { p = mat4.transformPoint(m, p); n = mat4.transformDir(m, n); }
    mb.pos.push(p[0], p[1], p[2]); mb.nrm.push(n[0], n[1], n[2]); mb.uv.push(0, 0); }
  for (let i = 0; i < d.col.length; i++) mb.col.push(d.col[i]);
  for (const i of d.idx) mb.idx.push(i + base);
}

export class WorldStream {
  constructor(game) {
    this.g = game; this.fine = new Map(); this.coarse = new Map(); this.objs = new Map(); this.buckets = new Map(); this.queue = []; this.center = null; this.htCenter = null;
    const w = game.world; this.byBucket = new Map();
    const put = (k, o, key) => { let b = this.byBucket.get(k); if (!b) this.byBucket.set(k, (b = { buildings: [], props: [] })); b[key].push(o); };
    for (const b of w.buildings) put(b.bucket, b, 'buildings'); for (const p of w.props) put(p.bucket, p, 'props');
    // centro e raio de cada balde de assentamento (carregado por distância)
    this.bucketInfo = []; for (const [k, v] of this.byBucket) { if (k.startsWith('road:')) continue; const all = [...v.buildings, ...v.props]; let cx = 0, cz = 0; for (const o of all) { cx += o.x; cz += o.z; } cx /= all.length; cz /= all.length; let rr = 0; for (const o of all) rr = Math.max(rr, Math.hypot(o.x - cx, o.z - cz) + Math.max(o.w || 4, o.d || 4) * 0.7); let y = 0; for (const o of all) y += o.y; this.bucketInfo.push({ key: k, x: cx, z: cz, r: rr + 4, y: y / all.length }); }
    this.stats = { loads: 0, unloads: 0, ms: 0 };
  }
  // ---------- atualização ----------
  update(pos, budgetMs = 6) {
    { const w = this.g.world; if (w.dirtyTiles && w.dirtyTiles.size) { for (const k of w.dirtyTiles) { const f = this.fine.get(k); if (!f) continue; for (const m of f.lods) if (m) this.g.renderer.disposeMesh(m); f.lods = [null, null, null]; const t = f.t; f.sphere = [f.cx, (t.miny + t.maxy) / 2, f.cz, Math.hypot(TILE * 0.71, (t.maxy - t.miny) / 2)]; } w.dirtyTiles.clear(); this._htDirty = true; } }
    const w = this.g.world; w.tick++;
    const [ti, tj] = w.tileAt(pos[0], pos[2]); const jump = !this.center || Math.hypot(pos[0] - this.center[0], pos[2] - this.center[1]) > 260;
    if (jump || this._lastT !== tj * TILES + ti || this._siteCheck-- <= 0) { this._plan(pos, ti, tj); this._lastT = tj * TILES + ti; this._siteCheck = 30; }
    this.center = [pos[0], pos[2]];
    const t0 = performance.now(); let n = 0;
    while (this.queue.length) { const job = this.queue.shift(); job(); n++; if (!jump && performance.now() - t0 > budgetMs) break; }
    if (n) this.stats.ms = performance.now() - t0;
    if (jump || !this.htCenter) this._heightTex(pos, true);
    else if (this._htJob) this._htJob();
    else if (Math.hypot(pos[0] - this.htCenter[0], pos[2] - this.htCenter[1]) > 400 || (this._htDirty && !this.queue.length)) this._heightTex(pos, false);
  }
  flush(pos) { this.center = null; this.update(pos); }
  _plan(pos, ti, tj) {
    const w = this.g.world; const jobs = [];
    // objetos dos blocos
    for (const [k, o] of this.objs) if (Math.max(Math.abs(o.ti - ti), Math.abs(o.tj - tj)) > R_OBJ_OUT) this._unloadObjs(k);
    for (let j = tj - R_OBJ; j <= tj + R_OBJ; j++) for (let i = ti - R_OBJ; i <= ti + R_OBJ; i++) { if (i < 0 || j < 0 || i >= TILES || j >= TILES) continue; const k = j * TILES + i;
      if (!this.objs.has(k)) jobs.push([Math.max(Math.abs(i - ti), Math.abs(j - tj)) * 2, () => { if (!this.objs.has(k)) this._loadObjs(k, i, j); }]); }
    // terreno fino
    for (const [k, f] of this.fine) if (Math.max(Math.abs(f.ti - ti), Math.abs(f.tj - tj)) > R_FINE_OUT) this._unloadFine(k);
    for (let j = tj - R_FINE; j <= tj + R_FINE; j++) for (let i = ti - R_FINE; i <= ti + R_FINE; i++) { if (i < 0 || j < 0 || i >= TILES || j >= TILES) continue; const k = j * TILES + i;
      if (!this.fine.has(k)) jobs.push([Math.max(Math.abs(i - ti), Math.abs(j - tj)) * 2 + 1, () => { if (!this.fine.has(k)) this._loadFine(k, i, j); }]); }
    // assentamentos
    for (const bi of this.bucketInfo) { const d = Math.hypot(bi.x - pos[0], bi.z - pos[2]) - bi.r; const key = bi.key;
      if (d > SITE_OUT && this.buckets.has(key)) this._unloadBucket(key);
      else if (d < SITE_IN && !this.buckets.has(key)) jobs.push([d < 120 ? 0 : 3 + d / 200, () => { if (!this.buckets.has(key)) this._loadBucket(key, bi); }]); }
    // libera horizontes distantes
    for (const [k, c] of this.coarse) if (Math.hypot(c.sphere[0] - pos[0], c.sphere[2] - pos[2]) > FAR + 700) { this.g.renderer.disposeMesh(c.mesh); this.coarse.delete(k); }
    jobs.sort((a, b) => a[0] - b[0]); this.queue = jobs.map((j) => j[1]);
  }
  // ---------- terreno ----------
  _loadFine(k, ti, tj) {
    const w = this.g.world; const t = w.tile(ti, tj); t.pin++;
    const cx = t.x0 + TILE / 2, cz = t.z0 + TILE / 2;
    this.fine.set(k, { ti, tj, t, lods: [null, null, null], cx, cz, sphere: [cx, (t.miny + t.maxy) / 2, cz, Math.hypot(TILE * 0.71, (t.maxy - t.miny) / 2)] }); this._htDirty = true;
  }
  _unloadFine(k) { const f = this.fine.get(k); if (!f) return; for (const m of f.lods) if (m) this.g.renderer.disposeMesh(m); f.t.pin--; this.fine.delete(k); }
  _fineMesh(f, lod) {
    if (f.lods[lod]) return f.lods[lod];
    const t = f.t, step = [1, 2, 4][lod], n = TC / step, Pn = TC + 1; const pos = [], nrm = [], col = [], idx = [];
    const push = (i, j, dy = 0) => { const k = j * Pn + i; pos.push(t.x0 + i * CELL, t.H[k] + dy, t.z0 + j * CELL); nrm.push(t.Nm[k * 3], t.Nm[k * 3 + 1], t.Nm[k * 3 + 2]); col.push(t.Co[k * 3], t.Co[k * 3 + 1], t.Co[k * 3 + 2], 1); return pos.length / 3 - 1; };
    for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) push(i * step, j * step);
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const a = j * (n + 1) + i, b = a + 1, c = a + n + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
    skirts(n, (i, j) => j * (n + 1) + i, (i, j) => push(i * step, j * step, lod ? -4 : -2.5), idx);
    return (f.lods[lod] = this.g.renderer.createMesh({ pos: new Float32Array(pos), nrm: new Float32Array(nrm), col: new Float32Array(col), idx }));
  }
  _coarseMesh(k, ti, tj) {
    let c = this.coarse.get(k); if (c) return c; const w = this.g.world, H = w.coarse, C = w.coarseCol; const s = TILE / CC, i0 = ti * s, j0 = tj * s;
    const pos = [], nrm = [], col = [], idx = []; let mn = 1e9, mx = -1e9;
    const push = (i, j, dy = 0) => { const gi = i0 + i, gj = j0 + j, q = gj * NC + gi; const h = H[q]; const hl = H[gj * NC + Math.max(0, gi - 1)], hr = H[gj * NC + Math.min(NC - 1, gi + 1)], hd = H[Math.max(0, gj - 1) * NC + gi], hu = H[Math.min(NC - 1, gj + 1) * NC + gi];
      let nx = hl - hr, ny = 2 * CC, nz = hd - hu; const l = Math.hypot(nx, ny, nz); pos.push(-HALF + gi * CC, h + dy, -HALF + gj * CC); nrm.push(nx / l, ny / l, nz / l); col.push(C[q * 3], C[q * 3 + 1], C[q * 3 + 2], 1); mn = Math.min(mn, h); mx = Math.max(mx, h); return pos.length / 3 - 1; };
    for (let j = 0; j <= s; j++) for (let i = 0; i <= s; i++) push(i, j);
    for (let j = 0; j < s; j++) for (let i = 0; i < s; i++) { const a = j * (s + 1) + i, b = a + 1, cc = a + s + 1, d = cc + 1; idx.push(a, cc, b, b, cc, d); }
    skirts(s, (i, j) => j * (s + 1) + i, (i, j) => push(i, j, -10), idx);
    const cx = -HALF + (ti + 0.5) * TILE, cz = -HALF + (tj + 0.5) * TILE;
    c = { mesh: this.g.renderer.createMesh({ pos: new Float32Array(pos), nrm: new Float32Array(nrm), col: new Float32Array(col), idx }), sphere: [cx, (mn + mx) / 2, cz, Math.hypot(TILE * 0.71, (mx - mn) / 2 + 10)] };
    this.coarse.set(k, c); return c;
  }
  terrainItems(items, eye, maxD) {
    const w = this.g.world; const [ti, tj] = w.tileAt(eye[0], eye[2]); const R = Math.ceil(FAR / TILE);
    for (let j = tj - R; j <= tj + R; j++) for (let i = ti - R; i <= ti + R; i++) { if (i < 0 || j < 0 || i >= TILES || j >= TILES) continue; const k = j * TILES + i;
      const cx = -HALF + (i + 0.5) * TILE, cz = -HALF + (j + 0.5) * TILE; const d = Math.max(0, Math.hypot(cx - eye[0], cz - eye[2]) - TILE * 0.5); if (d > FAR) continue;
      const f = this.fine.get(k);
      if (f && d < maxD) { const lod = d < 110 ? 0 : d < 260 ? 1 : 2; items.push({ mesh: this._fineMesh(f, lod), terrain: true, sphere: f.sphere }); }
      else { if (w.coarse[(j * (TILE / CC)) * NC + i * (TILE / CC)] < -17.5 && w.coarse[((j + 1) * (TILE / CC)) * NC + (i + 1) * (TILE / CC)] < -17.5 && d > 300) continue; // mar aberto
        const c = this._coarseMesh(k, i, j); items.push({ mesh: c.mesh, terrain: true, sphere: c.sphere, shadow: false }); }
    }
  }
  // textura de altura local para a água (profundidade, espuma na costa)
  _heightTex(pos, sync) {
    const w = this.g.world, r = this.g.renderer; const cx = Math.round(pos[0] / 48) * 48, cz = Math.round(pos[2] / 48) * 48; const x0 = cx - (HT_N / 2) * HT_CELL, z0 = cz - (HT_N / 2) * HT_CELL;
    const h = new Float32Array(HT_N * HT_N); let row = 0; this._htDirty = false;
    const job = () => { const end = sync ? HT_N : Math.min(HT_N, row + 48); for (; row < end; row++) for (let i = 0; i < HT_N; i++) h[row * HT_N + i] = w.heightFast(x0 + i * HT_CELL, z0 + row * HT_CELL);
      if (row >= HT_N) { r.createHeightTexture(h, HT_N); r.hInfo = [x0, z0, HT_N * HT_CELL, 0]; this.htCenter = [cx, cz]; this._htJob = null; } };
    this._htJob = job; if (sync) job();
  }
  // ---------- objetos ----------
  _loadObjs(k, ti, tj) {
    const g = this.g, w = g.world, ph = g.physics, G = g.groups; const t = w.tile(ti, tj); t.pin++;
    const d = w.scatterTile(ti, tj); const M = w.mods;
    for (const o of d.trees) { if (M.trees.has(o.id)) { o.felled = true; o.regrowAt = M.trees.get(o.id); M.trees.delete(o.id); } if (M.treeHp.has(o.id)) { o.hp = M.treeHp.get(o.id); M.treeHp.delete(o.id); }
      const info = P.TREE_INFO[o.type]; G[o.type].add(o); G.stump.add(o); o.collider = ph.add({ type: 'cyl', x: o.x, z: o.z, r: info.r * o.s + 0.05, y0: o.y - 1, y1: o.y + info.h * o.s, tree: o, noClimb: true, ghost: o.felled }); w.trees.push(o); }
    d.rocks.forEach((o, i) => { if (M.rocks.has(o.id)) { o.mined = true; o.regrowAt = M.rocks.get(o.id); M.rocks.delete(o.id); }
      (o.rich ? G.rich : G.rock[i % 3]).add(o); o.collider = ph.add({ type: 'cyl', x: o.x, z: o.z, r: 1.05 * o.s, y0: o.y - 1, y1: o.y + 1.2 * o.s, rock: o, ghost: o.mined }); w.rocks.push(o); });
    for (const o of d.bushes) { if (M.bushes.has(o.id)) { o.berries = false; o.regrowAt = M.bushes.get(o.id); M.bushes.delete(o.id); } G.bushB.add(o); G.bushE.add(o); w.bushes.push(o); }
    for (const o of d.pickups) { if (M.pickups.has(o.id)) { o.taken = true; o.regrowAt = M.pickups.get(o.id); M.pickups.delete(o.id); } G[o.kind].add(o); w.pickups.push(o); }
    for (const o of d.hives) { if (M.hives.has(o.id)) { o.honey = false; o.regrowAt = M.hives.get(o.id); M.hives.delete(o.id); } w.hives.push(o); }
    this.objs.set(k, { ti, tj, t, d }); this.stats.loads++;
    const bk = 'road:' + k; if (this.byBucket.has(bk)) this._loadBucket(bk, null);
  }
  _unloadObjs(k) {
    const o = this.objs.get(k); if (!o) return; const g = this.g, w = g.world, ph = g.physics, G = g.groups, M = w.mods, d = o.d;
    for (const t of d.trees) { if (t.felled) M.trees.set(t.id, t.regrowAt); else if (t.hp < (t.type === 'pine' ? 5 : 6)) M.treeHp.set(t.id, t.hp); G[t.type].remove(t); G.stump.remove(t); ph.remove(t.collider); }
    for (const r of d.rocks) { if (r.mined) M.rocks.set(r.id, r.regrowAt); (r._grp || G.rich).remove(r); ph.remove(r.collider); }
    for (const b of d.bushes) { if (!b.berries) M.bushes.set(b.id, b.regrowAt); G.bushB.remove(b); G.bushE.remove(b); }
    for (const p of d.pickups) { if (p.taken) M.pickups.set(p.id, p.regrowAt); G[p.kind].remove(p); }
    for (const h of d.hives) if (!h.honey) M.hives.set(h.id, h.regrowAt);
    const gone = (arr, list) => { const s = new Set(list); return arr.filter((x) => !s.has(x)); };
    w.trees = gone(w.trees, d.trees); w.rocks = gone(w.rocks, d.rocks); w.bushes = gone(w.bushes, d.bushes); w.pickups = gone(w.pickups, d.pickups); w.hives = gone(w.hives, d.hives);
    o.t.pin--; this.objs.delete(k); this.stats.unloads++;
    const bk = 'road:' + k; if (this.buckets.has(bk)) this._unloadBucket(bk);
  }
  // reaplica o estado salvo aos objetos já carregados (após carregar um jogo)
  reapply() { const keys = [...this.objs.keys()]; for (const k of keys) this._unloadObjs(k); for (const k of keys) { const ti = k % TILES, tj = Math.floor(k / TILES); this._loadObjs(k, ti, tj); } }
  forEachLoaded(fn) { for (const o of this.objs.values()) fn(o.d); }
  // ---------- assentamentos (malhas mescladas + colisores) ----------
  _loadBucket(key, site) {
    const g = this.g, ph = g.physics, r = g.renderer; const src = this.byBucket.get(key); if (!src) { this.buckets.set(key, { mesh: null, colliders: [] }); return; }
    const mb = new MeshBuilder(); const cols = []; const add = (c) => { cols.push(ph.add(c)); };
    const glass = [], doors = []; for (const b of src.buildings) { const { data, colliders, glass: gl, doors: dl } = P.buildingMesh(b); appendRaw(mb, data); for (const c of colliders) add(c);
      for (const d of dl || []) { d.id = `${key}:d${doors.length}`; d.open = g.openDoors.has(d.id); const cc = (yaw) => ({ type: 'box', x: d.x + Math.cos(yaw) * d.w / 2, z: d.z - Math.sin(yaw) * d.w / 2, hx: d.w / 2, hz: 0.05, rot: yaw, y0: d.y, y1: d.y + d.h, hdoor: d });
        d.colC = ph.add({ ...cc(d.yawC), ghost: d.open }); d.colO = ph.add({ ...cc(d.yawO), ghost: !d.open }); cols.push(d.colC, d.colO); d.ang = d.open ? 1 : 0; doors.push(d); }
      for (const gp of gl || []) { gp.id = `${key}:${glass.length}`; gp.broken = g.brokenGlass.has(gp.id); if (!gp.broken) { gp.col = ph.add({ type: 'box', x: gp.x, z: gp.z, hx: gp.w / 2, hz: 0.04, rot: gp.rot, y0: gp.y - gp.h / 2, y1: gp.y + gp.h / 2, glass: gp }); cols.push(gp.col); } glass.push(gp); } }
    for (const p of src.props) {
      const m = mat4.compose([p.x, p.y, p.z], p.rot); const box = (hx, hz, h, extra = {}) => add({ type: 'box', x: p.x, z: p.z, hx, hz, rot: p.rot, y0: p.y - 0.5, y1: p.y + h, ...extra });
      if (['well', 'tank', 'chimney', 'container', 'fence', 'tower', 'sandbag', 'gate', 'booth', 'tent', 'barrel'].includes(p.kind)) { appendRaw(mb, P.siteMesh(p.kind, p), m);
        if (p.kind === 'well') add({ type: 'cyl', x: p.x, z: p.z, r: 1.05, y0: p.y - 0.5, y1: p.y + 0.8 });
        else if (p.kind === 'tank') add({ type: 'cyl', x: p.x, z: p.z, r: 3.05 * p.s, y0: p.y - 0.5, y1: p.y + 8 * p.s, noClimb: true });
        else if (p.kind === 'chimney') add({ type: 'cyl', x: p.x, z: p.z, r: 1.5, y0: p.y - 0.5, y1: p.y + 24, noClimb: true });
        else if (p.kind === 'container') box(3.0, 1.22, 2.6 * (p.stack || 1));
        else if (p.kind === 'fence') box((p.len || 10) / 2, 0.1, 2.9, { noClimb: true });
        else if (p.kind === 'tower') box(1.55, 1.55, 6.2, { noClimb: true });
        else if (p.kind === 'sandbag') box(1.4, 0.45, 0.95);
        else if (p.kind === 'booth') box(1.3, 1.3, 2.8);
        else if (p.kind === 'tent') { const c = Math.cos(p.rot), s2 = Math.sin(p.rot); for (const sd of [-1, 1]) add({ type: 'box', x: p.x + c * sd * 2.25, z: p.z - s2 * sd * 2.25, hx: 0.25, hz: 2.3, rot: p.rot, y0: p.y - 0.5, y1: p.y + 1.1 }); add({ type: 'box', x: p.x, z: p.z, hx: 0.3, hz: 2.3, rot: p.rot, y0: p.y + 2.0, y1: p.y + 2.4 }); }
        else if (p.kind === 'barrel') add({ type: 'cyl', x: p.x, z: p.z, r: 0.32, y0: p.y - 0.5, y1: p.y + 0.9 });
        else if (p.kind === 'gate') { for (const s2 of [-1, 1]) add({ type: 'cyl', x: p.x + Math.cos(p.rot) * s2 * 3.4, z: p.z - Math.sin(p.rot) * s2 * 3.4, r: 0.25, y0: p.y - 0.5, y1: p.y + 3 }); }
        continue; }
      if (p.kind === 'car') { const cs = P.carSpec(p.seed); appendRaw(mb, P.carMesh(p.seed), m); box(cs.L / 2 + 0.05, cs.W / 2 + 0.08, cs.H, { car: p }); }
      else if (p.kind === 'lamp') { appendRaw(mb, P.lampMesh(p.bent), m); add({ type: 'cyl', x: p.x, z: p.z, r: 0.16, y0: p.y - 0.5, y1: p.y + 5.8, noClimb: true }); }
      else if (p.kind === 'rubble') { appendRaw(mb, P.rubbleMesh(p.seed), mat4.compose([p.x, p.y, p.z], p.rot, p.s)); add({ type: 'cyl', x: p.x, z: p.z, r: 0.75 * p.s, y0: p.y - 0.5, y1: p.y + 0.42 * p.s }); }
    }
    let sphere; if (site) sphere = [site.x, site.y + 6, site.z, site.r + 12];
    else { let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9, y = 0; for (const p of src.props) { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); z0 = Math.min(z0, p.z); z1 = Math.max(z1, p.z); y = p.y; } sphere = [(x0 + x1) / 2, y, (z0 + z1) / 2, Math.hypot(x1 - x0, z1 - z0) / 2 + 8]; }
    this.buckets.set(key, { mesh: mb.idx.length ? r.createMesh(mb.build()) : null, colliders: cols, sphere, glass, doors });
  }
  _unloadBucket(key) { const b = this.buckets.get(key); if (!b) return; if (b.mesh) this.g.renderer.disposeMesh(b.mesh); for (const c of b.colliders) this.g.physics.remove(c); this.buckets.delete(key); }
  siteItems(items) { for (const b of this.buckets.values()) if (b.mesh) items.push({ mesh: b.mesh, sphere: b.sphere }); }
}
// saias nas bordas de cada bloco (escondem frestas entre níveis de detalhe vizinhos)
function skirts(n, at, low, idx) {
  const edge = (list) => { for (let k = 0; k < list.length - 1; k++) { const [i0, j0] = list[k], [i1, j1] = list[k + 1]; const a = at(i0, j0), b = at(i1, j1), a2 = low(i0, j0), b2 = low(i1, j1); idx.push(a, b, a2, b, b2, a2, a, a2, b, b, a2, b2); } };
  const L = [...Array(n + 1).keys()]; edge(L.map((i) => [i, 0])); edge(L.map((i) => [i, n])); edge(L.map((j) => [0, j])); edge(L.map((j) => [n, j]));
}
