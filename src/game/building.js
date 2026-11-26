// Sistema de construção: prévia transparente, encaixe em grade (pisos/paredes/portas), validação
// de espaço/terreno/recursos, colisores reais e interação com as peças construídas.
import { PIECES, ITEMS , SKILL_OF } from './items.js';
import { pieceMesh } from './props.js';
import { mat4, quat } from '../engine/math.js';
import { WATER } from './world.js';
import * as MX from './machines.js';
import { structShapes, STYPES, FLAG_GAP } from './struct.js';
import * as BM from './basemeshes.js';
import { isContainer, CHESTS } from './territory.js';
const MACHINE_MESH = { printer: MX.printerMesh, panel: MX.panelMesh, solar: MX.solarMesh, wind: MX.windTowerMesh, waterwheel: MX.wheelFrameMesh, battery: MX.batteryMesh };

const G = 3;
let PID = 1;
export class BuildSystem {
  constructor(game) {
    this.game = game; this.pieces = []; this.meshes = {}; this.mode = null; this.rotStep = 0; this.ghost = null;
    for (const t of ['campfire', 'tent', 'shelter', 'wall', 'floor', 'bench', 'door', 'planter', 'collector', 'composter', 'gtrap']) this.meshes[t] = game.renderer.createMesh(pieceMesh(t === 'door' ? 'doorframe' : t));
    // baús, armário e Territoritek: o desenho fica no sistema de território (aqui só para a prévia)
    for (const [t, k] of Object.entries(CHESTS)) this.meshes[t] = game.renderer.createMesh(BM.chestMesh(k.kind)); this.meshes.cabinet = game.renderer.createMesh(BM.cabinetMesh()); this.meshes.flag = game.renderer.createMesh(BM.tkBaseMesh()); this.meshes.bed = game.renderer.createMesh(BM.bedMesh()); this.meshes.bench = game.renderer.createMesh(BM.benchCommonMesh()); this.meshes.bench_mech = game.renderer.createMesh(BM.benchMechMesh()); this.meshes.bench_guns = game.renderer.createMesh(BM.benchGunsMesh()); this.meshes.furnace = game.renderer.createMesh(BM.furnaceMesh());
    this.doorLeaf = game.renderer.createMesh(pieceMesh('door'));
    for (const [t, fn] of Object.entries(MACHINE_MESH)) this.meshes[t] = game.renderer.createMesh(fn());
  }
  start(type) { if (!PIECES[type]) return; if (!this.game.hasSkillFor(type)) { this.game.ui.toast(`🔒 Precisa da habilidade ${this.game.skillName(SKILL_OF[type])} — encontre e leia o livro`, 'warn'); return; } this.mode = type; this.rotStep = 0; this.game.ui.setBuildMode(type); }
  cancel() { this.mode = null; this.ghost = null; this.game.ui.setBuildMode(null); }
  findAt(x, z, type, tol = 0.3) { return this.pieces.find((p) => (!type || p.type === type) && Math.abs(p.x - x) < tol && Math.abs(p.z - z) < tol); }
  _floorAtCell(cx, cz) { return this.pieces.find((p) => p.type === 'floor' && Math.abs(p.x - cx) < 0.2 && Math.abs(p.z - cz) < 0.2); }

  update(dt, act) {
    if (!this.mode) return;
    const g = this.game, P = g.player, cam = g.cam; const type = this.mode, def = PIECES[type];
    if (act.rotate) this.rotStep++;
    if (g.input.mouse.wheel && g.input.locked) { this.rotStep += g.input.mouse.wheel > 0 ? 1 : -1; g.input.mouse.wheel = 0; }
    const f = cam.forward(); const dist = def.snap === 'cell' ? 3.2 : def.snap === 'edge' ? 2.6 : 2.4;
    let tx = P.pos[0] + f[0] * dist, tz = P.pos[2] + f[1] * dist;
    let x = tx, z = tz, rot = P.yaw + this.rotStep * Math.PI / 8, y; let reason = null;
    const w = g.world;
    if (def.snap === 'cell') {
      x = Math.floor(tx / G) * G + G / 2; z = Math.floor(tz / G) * G + G / 2; rot = 0;
      let hmax = -1e9, hmin = 1e9; for (const [dx, dz] of [[-1.4, -1.4], [1.4, -1.4], [-1.4, 1.4], [1.4, 1.4], [0, 0]]) { const h = w.height(x + dx, z + dz); hmax = Math.max(hmax, h); hmin = Math.min(hmin, h); }
      y = hmax + 0.02;
      for (const [dx, dz] of [[G, 0], [-G, 0], [0, G], [0, -G]]) { const n = this._floorAtCell(x + dx, z + dz); if (n && n.y >= hmax - 0.05 && n.y - hmax < 1.5) { y = n.y; break; } }
      if (y - hmin > 2.9) reason = 'Desnível grande demais';
      if (hmin < WATER - 0.6) reason = 'Água profunda';
    } else if (def.snap === 'edge') {
      const along = (Math.round(this.rotStep) % 2 === 0) === (Math.abs(f[0]) < Math.abs(f[1]));
      // parede ao longo de X (rot 0) quando olhando para Z, e vice-versa; R alterna
      if (along) { x = Math.floor(tx / G) * G + G / 2; z = Math.round(tz / G) * G; rot = 0; }
      else { x = Math.round(tx / G) * G; z = Math.floor(tz / G) * G + G / 2; rot = Math.PI / 2; }
      const ends = rot === 0 ? [[x - 1.4, z], [x + 1.4, z], [x, z]] : [[x, z - 1.4], [x, z + 1.4], [x, z]];
      let hmin = 1e9, hmax = -1e9; for (const [ex, ez] of ends) { const h = w.height(ex, ez); hmin = Math.min(hmin, h); hmax = Math.max(hmax, h); }
      y = hmin - 0.05;
      const cells = rot === 0 ? [[x, z + G / 2], [x, z - G / 2]] : [[x + G / 2, z], [x - G / 2, z]];
      let fl = null; for (const [cx, cz] of cells) { const n = this._floorAtCell(cx, cz); if (n && (!fl || n.y > fl.y)) fl = n; }
      if (fl) y = fl.y + 0.2; else if (hmax - hmin > 1.2) reason = 'Terreno muito inclinado';
      if (!fl && hmin < WATER) reason = 'Não pode construir na água';
    } else {
      const [gy] = g.physics.ground(x, z, 0.2, P.pos[1] + 0.6, 0.6); y = gy;
      const sh = def.shape; const ext = sh.type === 'cyl' ? [[sh.r, 0], [-sh.r, 0], [0, sh.r], [0, -sh.r]] : [[sh.hx, sh.hz], [-sh.hx, sh.hz], [sh.hx, -sh.hz], [-sh.hx, -sh.hz]];
      const c = Math.cos(rot), s = Math.sin(rot); let hmin = 1e9, hmax = -1e9;
      for (const [lx, lz] of ext) { const px = x + lx * c + lz * s, pz = z - lx * s + lz * c; const [h] = g.physics.ground(px, pz, 0.1, y + 0.6, 0.8); hmin = Math.min(hmin, h); hmax = Math.max(hmax, h); }
      if (hmax - hmin > 0.95) reason = 'Terreno muito inclinado';
      if (w.height(x, z) < WATER + 0.15 && y < WATER + 0.2) reason = 'Não pode construir na água';
      if (w.caveAt(x, z) && type !== 'campfire' && !isContainer(type)) reason = 'Pouco espaço na caverna';
    }
    let water = false; if (type === 'waterwheel' && !reason) { for (let a = 0; a < 16 && !water; a++) for (const d of [1.6, 2.4, 3.4]) { const xx = x + Math.cos(a * 0.39) * d, zz = z + Math.sin(a * 0.39) * d; if (w.height(xx, zz) < WATER - 0.2 && !w.isSalt(xx, zz)) { water = true; break; } } if (!water) reason = 'A roda d’água precisa ficar na beira de um rio ou lago de água doce'; }
    const shapes = this._shapes(type, x, y, z, rot);
    if (!reason) for (const s of shapes) {
      const hit = g.physics.overlaps(s, (c) => c.piece && ((def.snap === 'edge' && c.piece.type === 'floor') || (type === 'floor' && (c.piece.type === 'wall' || c.piece.type === 'door'))) || c.dyn || c.isPlayer);
      if (hit) { reason = hit.piece ? 'Sobreposição com construção' : 'Sem espaço (obstáculo)'; break; }
      if (g.physics.insideXZ(s.type === 'box' ? { ...s, cos: Math.cos(s.rot), sin: Math.sin(s.rot) } : s, P.pos[0], P.pos[2], 0.36) && s.y1 > P.pos[1] + 0.1 && s.y0 < P.pos[1] + 1.8) { reason = 'Você está no caminho'; break; }
    }
    if (!reason && Math.hypot(x - P.pos[0], z - P.pos[2]) > 6) reason = 'Longe demais';
    if (!reason && type === 'flag' && g.struct && g.struct.foreignFlagNear(x, z, FLAG_GAP)) reason = 'Perto demais do território de outro jogador';
    if (!reason && (type === 'bench' || type === 'bench_mech' || type === 'bench_guns' || isContainer(type)) && g.struct && !g.struct.ownFlagAt(x, z)) reason = g.struct.flags().length ? 'Fora do seu território (Territoritek)' : 'Coloque um Territoritek primeiro (marca o território)';
    if (!reason && type === 'cabinet' && g.territory) { const f = g.struct.ownFlagAt(x, z); if (f && g.territory.cabinetFor(f)) reason = 'Esse território já tem um armário'; }
    const afford = g.inv.has(def.cost);
    this.ghost = { type, x, y, z, rot, water, valid: !reason && afford, reason: reason || (afford ? null : 'Recursos insuficientes') };
    g.ui.buildStatus(this.ghost);
    if (act.use && this.ghost) this.place();
    if (act.demolish) this.demolishAim();
  }
  place() {
    const gh = this.ghost, g = this.game; if (!gh) return;
    if (!gh.valid) { g.ui.toast(gh.reason, 'warn'); g.audio.play('error'); return; }
    const def = PIECES[gh.type]; if (!g.inv.pay(def.cost)) { g.ui.toast('Recursos insuficientes', 'warn'); return; }
    const np = this.add({ type: gh.type, x: gh.x, y: gh.y, z: gh.z, rot: gh.rot, data: gh.type === 'flag' ? { owner: g.struct ? g.struct.myId() : 'me' } : gh.type === 'planter' ? { grow: g._clock() + 0.25 } : gh.type === 'collector' ? { water: 0 } : gh.type === 'composter' ? { dirt: 0, food: 0 } : undefined }); if (g.territory) g.territory.onPlaced(np); { const R = 2.4; for (const t of g.world.trees) if (t.felled && Math.hypot(t.x - gh.x, t.z - gh.z) < R) g.blockedTrees.add(t.id); } // árvore cortada aqui não renasce if (np.data && gh.type === 'waterwheel') np.data.water = gh.water;
    if (def.power) g.ui.toast(def.power === 'hub' ? 'Ligue aparelhos e fontes ao painel com fio de cobre (E no aparelho → Puxar fio)' : 'Ligue com fio de cobre a um painel elétrico (E no aparelho → Puxar fio)', 'info');
    g.audio.play('build'); g.fx.burst([gh.x, gh.y + 0.3, gh.z], 18, [0.55, 0.42, 0.28], 2.5, 0.7, 0.07);
    g.ui.toast(`${def.icon} ${def.name} construído`, 'ok'); g.stats.built++;
    if (!g.inv.has(def.cost)) this.cancel();
  }
  _shapes(type, x, y, z, rot) {
    if (STYPES[type] || type === 'flag') return structShapes(type, x, y, z, rot);
    const c = Math.cos(rot), s = Math.sin(rot); const L = (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c];
    const box = (lx, lz, hx, hz, y0, y1, extra = {}) => { const [px, pz] = L(lx, lz); return { type: 'box', x: px, z: pz, hx, hz, rot, y0: y + y0, y1: y + y1, ...extra }; };
    switch (type) {
      case 'campfire': return [{ type: 'cyl', x, z, r: 0.72, y0: y - 0.1, y1: y + 0.32 }];
      case 'tent': return [box(0, 0, 0.95, 1.3, -0.1, 1.42, { noClimb: true })];
      case 'bed': return [box(0, 0.05, 0.86, 1.1, -0.1, 0.5), box(0, -1.08, 0.88, 0.07, 0.5, 1.28, { noClimb: true }), box(0, 1.08, 0.88, 0.07, 0.5, 0.76), box(1.24, -0.9, 0.25, 0.21, -0.1, 0.55)];
      case 'shelter': return [box(0, -1.45, 1.55, 0.18, -0.1, 2.6, { noClimb: true }), box(0, 0, 1.6, 1.65, 1.75, 2.9, { camOnly: true }), ...[[-1.4, 1.4], [1.4, 1.4]].map(([lx, lz]) => { const [px, pz] = L(lx, lz); return { type: 'cyl', x: px, z: pz, r: 0.13, y0: y, y1: y + 1.4 }; })];
      case 'wall': return [box(0, 0, 1.5, 0.25, -0.05, 2.7, { noClimb: true })];
      case 'floor': return [box(0, 0, 1.5, 1.5, -3, 0.2, { platform: true })];
      case 'door': return [box(-1.05, 0, 0.45, 0.22, -0.05, 2.7, { noClimb: true }), box(1.05, 0, 0.45, 0.22, -0.05, 2.7, { noClimb: true }), box(0, 0, 0.65, 0.22, 2.3, 2.7), box(0, 0, 0.6, 0.1, 0, 2.25, { leaf: true, noClimb: true })];
      case 'chest': case 'chest_wi': case 'chest_iron': return [box(0, 0, 0.45, 0.29, -0.05, 0.66)];
      case 'cabinet': return [box(0, 0, 0.55, 0.3, -0.05, 1.8)];
      case 'gtrap': return [box(0, 0, 1.2, 0.1, -0.05, 0.3, { ghost: true, noClimb: true })];
      case 'bench': case 'bench_mech': case 'bench_guns': return [box(0, 0, 0.95, 0.48, -0.05, 1.0)];
      case 'furnace': return [{ type: 'cyl', x, z, r: 0.85, y0: y - 0.1, y1: y + 1.9 }, box(0.95, 0.15, 0.24, 0.24, -0.1, 0.55)];
      case 'planter': return [box(0, 0, 0.95, 0.6, -0.05, 0.45)];
      case 'collector': return [box(-0.02, 0.06, 0.62, 0.42, -0.1, 1.24)];
      case 'composter': return [box(0, 0, 0.77, 0.57, -0.05, 1.0)];
      case 'printer': return [box(0, 0, 0.48, 0.38, -0.05, 1.05)];
      case 'panel': return [box(0, 0, 0.32, 0.18, -0.05, 1.7)];
      case 'solar': return [box(-0.85, -0.1, 0.14, 0.14, -0.05, 2.25), box(0.2, 0.05, 0.28, 0.2, -0.05, 0.55), box(1.05, 0.05, 0.4, 0.18, -0.05, 0.42)];
      case 'wind': return [{ type: 'cyl', x, z, r: 0.35, y0: y - 0.1, y1: y + 6.2 }];
      case 'waterwheel': return [box(0, 0, 0.85, 1.45, -0.05, 2.9)];
      case 'battery': return [box(0, 0, 0.3, 0.22, -0.05, 0.6)];
    }
    return [];
  }
  add(p) {
    const g = this.game; const piece = { id: PID++, uid: p.uid, type: p.type, x: p.x, y: p.y, z: p.z, rot: p.rot, lit: p.lit ?? (p.type === 'campfire'), open: !!p.open, items: p.items || null, openAng: p.open ? 1.6 : 0, data: p.data ? JSON.parse(JSON.stringify(p.data)) : null };
    if (isContainer(piece.type) && !piece.items) piece.items = [];
    piece.model = mat4.fromTRS(mat4.create(), [p.x, p.y, p.z], quat.fromEuler(0, p.rot, 0), [1, 1, 1]);
    piece.colliders = this._shapes(piece.type, p.x, p.y, p.z, p.rot).map((s) => { s.piece = piece; if (s.leaf && piece.open) s.ghost = true; return g.physics.add(s); });
    this.pieces.push(piece); if (g.power) g.power.init(piece); if (g.struct) g.struct.onAdded(piece); return piece;
  }
  remove(piece, refund = true) {
    const g = this.game; if (!this.pieces.includes(piece)) return; if (g.struct) g.struct.onRemoved(piece); if (refund && g.power && piece.data && PIECES[piece.type].power) g.power.onRemove(piece); for (const c of piece.colliders) g.physics.remove(c); this.pieces.splice(this.pieces.indexOf(piece), 1); if (g.power) g.power.dirty = true;
    if (refund && piece.type === 'campfire' && piece.data && Array.isArray(piece.data.cook)) { const d = piece.data; for (const s of [...d.fuel, ...d.out]) if (s && s.qty > 0) g.dropItem(s.id, s.qty, [piece.x, piece.y, piece.z]); for (const c of d.cook) if (c) g.dropItem(c.id, 1, [piece.x, piece.y, piece.z]); piece.data = null; }
    if (refund) { for (const [id, n] of Object.entries(PIECES[piece.type].cost)) { const k = Math.ceil(n / 2); const added = g.inv.add(id, k); if (added < k) g.dropItem(id, k - added, [piece.x, piece.y, piece.z]); } }
    if (piece.items) for (const s of piece.items) if (s) g.dropItem(s[0], s[1], [piece.x, piece.y + 0.3, piece.z]);
  }
  demolishAim() {
    const g = this.game, P = g.player; const f = g.cam.forward(); let best = null, bd = 4;
    for (const p of this.pieces) { const dx = p.x - P.pos[0], dz = p.z - P.pos[2]; const d = Math.hypot(dx, dz); if (d > 5) continue; const dot = (dx * f[0] + dz * f[1]) / (d || 1); const score = d - dot * 2; if (dot > 0.3 && score < bd) { bd = score; best = p; } }
    if (best) { this.remove(best); g.audio.play('build'); g.ui.toast(`${PIECES[best.type].name} desmontado (50% devolvido)`, 'ok'); } else g.ui.toast('Mire em uma construção para desmontar', 'warn');
  }
  toggleDoor(p) { p.open = !p.open; for (const c of p.colliders) if (c.leaf) c.ghost = p.open; this.game.audio.play('door');
    if (!p.open) { const P = this.game.player; for (const c of p.colliders) if (c.leaf && this.game.physics.insideXZ(c, P.pos[0], P.pos[2], 0.36)) { p.open = true; c.ghost = true; this.game.ui.toast('Saia da porta para fechá-la', 'warn'); } } }
  update2(dt) { for (const p of this.pieces) if (p.type === 'door' || p.type === 's_doorway' || p.type === 's_hatch') { const t = p.open ? 1.6 : 0; p.openAng += (t - p.openAng) * Math.min(1, dt * 6); } }
  renderItems(items) {
    const g = this.game, r = g.renderer;
    for (const p of this.pieces) {
      if (!r.visible(p.x, p.y + 1, p.z, 4) && g.renderer.shadowsEnabled === false) continue;
      if (!this.meshes[p.type] || isContainer(p.type) || p.type === 'flag') continue; items.push({ mesh: this.meshes[p.type], model: p.model, sphere: [p.x, p.y + 1, p.z, 4] });
      if (p.type === 'door') { const m = mat4.mul(mat4.create(), p.model, mat4.fromTRS(mat4.create(), [-0.52, 0, 0], quat.fromEuler(0, -p.openAng, 0), [1, 1, 1])); mat4.mul(m, m, mat4.fromTRS(mat4.create(), [0.52, 0, 0], [0, 0, 0, 1], [1, 1, 1])); items.push({ mesh: this.doorLeaf, model: m, sphere: [p.x, p.y + 1, p.z, 3] }); }
    }
    if (this.mode && this.ghost) {
      const gh = this.ghost; const m = mat4.fromTRS(mat4.create(), [gh.x, gh.y, gh.z], quat.fromEuler(0, gh.rot, 0), [1, 1, 1]);
      const tint = gh.valid ? [0.5, 1.4, 0.6, 1] : [1.6, 0.4, 0.35, 1];
      items.push({ mesh: this.meshes[gh.type], model: m, alpha: 0.45, tint, shadow: false, cull: false, emissive: 0.08 });
      if (gh.type === 'door') items.push({ mesh: this.doorLeaf, model: m, alpha: 0.45, tint, shadow: false, cull: false });
    }
  }
  serialize() { return this.pieces.map((p) => ({ uid: p.uid, type: p.type, x: +p.x.toFixed(3), y: +p.y.toFixed(3), z: +p.z.toFixed(3), rot: +p.rot.toFixed(4), lit: p.lit, open: p.open, items: p.items, data: p.data || undefined })); }
  load(arr) { for (const p of [...this.pieces]) this.remove(p, false); for (const p of arr || []) if (PIECES[p.type]) { if (p.data && p.data.owner === 'me' && this.game.net) p.data.owner = this.game.net.pid(); if (p.items) p.items = p.items.filter((s) => !s || ITEMS[s[0]]); this.add(p); } }
}
