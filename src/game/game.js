// Núcleo do jogo: inicialização, laço principal, renderização do mundo, interação, sobrevivência,
// combate, coleta, regeneração do mundo e salvamento.
import { Renderer } from '../engine/renderer.js';
import { MeshBuilder } from '../engine/mesh.js';
import { mat4, quat, clamp, rng, angleDiff } from '../engine/math.js';
import { World, WATER, RUINS, TOXIC } from './world.js';
import { WorldStream } from './stream.js';
import { rollLoot, FURN_NAMES } from './loot.js';
import { PowerSystem, PRINTS } from './power.js';
import { Grapple } from './grapple.js';
import { Geiger } from './geiger.js';
import { geigerMesh } from './machines.js';
import * as MXS from './machines.js';
import * as HOUSES from './houses.js';
import * as VEH from './vehicles.js';
import * as TOWN from './town.js';
import * as FIRE from './campfire.js';
import { Convoys, porterLoadMesh } from './convoy.js';
import { segDist as segDistG } from './world.js';
import { NPCManager } from './npcs.js';
import { Grenades, grenadeMesh, GREN } from './grenades.js';
import { M as MM, hex as HX } from '../engine/mesh.js';
import { tigerGatlingMesh as TIGERGUN } from './androids.js';
import * as MECHA from './androids.js';
const NVG_CAP = 900; // ~15 min de uso por bateria
import { WorldMap } from './map.js';
import { Physics } from './physics.js';
import { Input } from './input.js';
import { ThirdPersonCamera } from './camera.js';
import { Player } from './player.js';
import { makeHumanSkeleton, buildHumanClips } from './humanoid.js';
import { buildChibiMesh as buildPlayerMesh, makeChibiSkeleton, LOOK_DEFAULT, HAIR_STYLES } from './chibi.js';
import * as P from './props.js';
import { makeFoliageAtlas } from './textures.js';
import { Firearms } from './firearms.js';
import { gunMesh, GUNS, arrowMesh, scopeMesh, SCOPES, SCOPE_MOUNT, magMesh, attSlots, fits, silencerMesh, silMount, magFor } from './weapons.js';
import { SKILLS, SKILL_OF, quickClass, slotClass } from './items.js';
import { ITEMS, Inventory, RECIPES, GridInventory, PACKS, POCKETS, PIECES, itemKg, CARRY_KG, MAX_KG, CLOTH_SLOTS, SLOT_NAMES, LARGE } from './items.js';
import { BuildSystem } from './building.js';
import { CreatureManager, buildCreatureAssets } from './creatures.js';
import { Environment, FX } from './environment.js';
import { GameAudio } from './audio.js';
import { SmokeSignals } from './smoke.js';
import { Admin } from './admin.js';
import { Helis } from './heli.js';
import { Fishing, rodMesh } from './fishing.js';
import { Territory, LOCKS, isContainer, CHESTS } from './territory.js';
const CHESTS_HP = Object.fromEntries(Object.entries(CHESTS).map(([k, v]) => [k, v.hp]));
import { TouchControls } from './touch.js';
import { Voice } from './voice.js';
import { Blasts } from './blasts.js';
import * as STR from './struct.js';
import { Net } from './net.js';
import { UI } from './ui.js';
import { loadModelOverride } from '../engine/gltf.js';

const SAVE_KEY = 'ilhaperdida_save_v1', SET_KEY = 'ilhaperdida_settings_v1';
const CELL = 64;
const PISTOLS = ['pistol35', 'pistol', 'pistol65'], RIFLES = ['rifle540', 'rifle', 'rifle577'], SNIPERS = ['sniper745', 'sniper', 'sniper790'];
const pick3 = (a) => a[Math.floor(Math.random() * a.length)];
const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));

class InstGroup {
  constructor(game, mesh, opts = {}) { this.game = game; this.mesh = mesh; this.opts = opts; this.cells = new Map(); }
  key(x, z) { return Math.floor(x / CELL) + ',' + Math.floor(z / CELL); }
  add(o) { const k = this.key(o.x, o.z); let c = this.cells.get(k); if (!c) this.cells.set(k, (c = { objs: [], dirty: true, batch: null, cx: (Math.floor(o.x / CELL) + 0.5) * CELL, cz: (Math.floor(o.z / CELL) + 0.5) * CELL })); c.objs.push(o); o._grp = this; (o._cells || (o._cells = new Map())).set(this, c); c.dirty = true; }
  remove(o) { const c = o._cells && o._cells.get(this); if (!c) return; const i = c.objs.indexOf(o); if (i >= 0) c.objs.splice(i, 1); o._cells.delete(this); c.dirty = true;
    if (!c.objs.length) { const r = this.game.renderer; r.disposeBatch(c.batch); r.disposeBatch(c.lod); this.cells.delete(this.key(o.x, o.z)); } }
  // cada objeto guarda a célula de CADA grupo (árvore e toco compartilham o mesmo objeto)
  dirty(o) { const c = o._cells && o._cells.get(this); if (c) c.dirty = true; }
  render(items, cam, maxDist) {
    for (const c of this.cells.values()) {
      if (Math.hypot(c.cx - cam[0], c.cz - cam[2]) > maxDist + CELL * 0.71) continue;
      if (c.dirty) {
        const vis = c.objs.filter((o) => this.opts.show(o)); const m = new Float32Array(vis.length * 16), col = new Float32Array(vis.length * 4); const tmp = mat4.create();
        vis.forEach((o, i) => { mat4.fromTRS(tmp, [o.x, o.y + (this.opts.yOff || 0), o.z], quat.fromEuler(o.rx || 0, o.rot || 0, 0), [o.s || 1, (o.s || 1) * (o.sy || 1), o.s || 1]); m.set(tmp, i * 16); const t = this.opts.tint ? this.opts.tint(o) : null; col.set(t || [1, 1, 1, 1], i * 4); });
        if (c.batch) c.batch.update(m, col); else c.batch = this.game.renderer.createInstanced(this.mesh, m, col);
        if (this.opts.lod) { if (c.lod) c.lod.update(m, col); else c.lod = this.game.renderer.createInstanced(this.opts.lod, m, col); }
        c.dirty = false;
      }
      const far = this.opts.lod && Math.hypot(c.cx - cam[0], c.cz - cam[2]) > (this.opts.lodDist || 80);
      items.push({ batch: far ? c.lod : c.batch, wind: this.opts.wind, shadow: this.opts.shadow, emissive: this.opts.emissive, doubleSided: this.opts.doubleSided, tex: this.opts.tex, alphaTest: !!this.opts.tex });
    }
  }
}

// raio (m) em que robôs, animais e NPCs ouvem cada som feito pelo jogador
const NOISE_R = { step: 9, jump: 6, land: 10, groan: 20, hurt: 14, cough: 16, swapWeapon: 9, ladder: 10, ladderSlide: 14, door: 12, drink: 6, gulp: 6, eat: 6, bite: 6, pickup: 4, swing: 5, chop: 26, mine: 26, treefall: 45, rockbreak: 30, build: 20, craft: 6, wash: 8, splash: 10, swim: 6, punch: 8, pour: 6, engineStart: 50, glass: 28, unscrew: 3, pillShake: 4, swallow: 3, cloth: 3, page: 2, magOut: 6, magIn: 6, bolt: 8, pump: 10, dryfire: 4, fireLight: 6, death: 20, climb: 6, butcher: 10 };
export class Game {
  static HAIR_STYLES = HAIR_STYLES;
  constructor(canvas) {
    this.canvas = canvas; this.state = 'loading'; this.storageOk = true;
    const mobile = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    const defaults = { master: 0.8, sfx: 0.9, ambient: 0.7, music: 0.35, sens: 1, invertY: false, shadows: true, grass: mobile ? 0.5 : 1, viewDist: mobile ? 'curta' : 'normal', res: mobile ? 0.75 : 1, enemyMul: 1, autoRes: false, v: 2, quality: mobile ? 'baixa' : 'alta', ssao: !mobile, bloom: true, fxaa: true, detail: mobile ? 0.6 : 1 };
    const saved = this._loadJSON(SET_KEY) || {}; if (!(saved.v >= 2)) { delete saved.res; delete saved.autoRes; } // migração: resolução cheia, nítida
    this.settings = Object.assign(defaults, saved); this.settings.v = 2;
    this.renderer = new Renderer(canvas); this.audio = new GameAudio(); { const A = this.audio, orig = A.play.bind(A); A.play = (name, o = {}) => { const res = orig(name, o); const R = NOISE_R[name]; if (R && !o.at && !o.noNoise && this.player && !this.player.dead && this.state === 'playing') this.noise(this.player.pos, name === 'step' ? R * (o.vol ?? 1) : R, name === 'step' ? 'passo' : name); return res; }; } this.audio.listener = () => this.cam ? { eye: this.cam.eye, yaw: Math.atan2(this.cam.target[0] - this.cam.eye[0], this.cam.target[2] - this.cam.eye[2]) } : null; this.ui = new UI(this); this.input = new Input(canvas, this.ui); this.touchUI = new TouchControls(this); this.voice = new Voice(this);
    this.cam = new ThirdPersonCamera(); this.env = new Environment(this); this.fx = new FX(this);
    this.guns = new Firearms(this); this.npcs = new NPCManager(this); this.fires = new FIRE.Campfires(this); this.convoys = new Convoys(this); this.helis = new Helis(this); this.territory = new Territory(this); this.fishing = new Fishing(this); this.grenades = new Grenades(this); this.smoke = new SmokeSignals(this); this.admin = new Admin(this); this.blasts = new Blasts(this); this.struct = new STR.StructSystem(this); this.net = new Net(this); this.inv = new GridInventory(); this._bigPockets = typeof window !== 'undefined' && !!window.__TEST_BIG_POCKETS; this.quick = Array(8).fill(null); this.inv.onChange = () => { this.syncHand && this.equip && this.syncHand(); if (this.ui.open) this.ui.refresh(); }; this.inv.onAdd = (id) => { this._autoQuick(id); this._toBack && this._toBack(id); };
    this.equip = this.freshEquip(); this._applyBack(); this.attach = {}; this.home = null; this.drops = []; this.logs = []; this.falling = []; this.projectiles = []; this.arrows = []; this.clouds = []; this.stats = { built: 0, kills: 0 };
    this.lastFire = [0, 0]; this.saveT = 60; this.grassCells = new Map(); this.menuT = 0; this.playTime = 0;
    this.input.wantLock = true;
    // Esc solta o mouse no navegador: pausa automaticamente para não deixar o jogo sem controle
    this.input.onUnlock = () => { if (this.state === 'playing' && !this.ui.anyOpen && !this.build.mode && !this.player.sleeping) this.pause(); };
    window.addEventListener('resize', () => this.renderer.resize());
    const persist = () => { if (this.state === 'playing' || this.state === 'paused') this.saveGame(false); };
    document.addEventListener('visibilitychange', () => { if (document.hidden) { persist(); if (this.state === 'playing') this.pause(); } });
    window.addEventListener('pagehide', persist); window.addEventListener('beforeunload', persist);
  }
  _loadJSON(k) { try { const s = localStorage.getItem(k); return s ? JSON.parse(s) : null; } catch (e) { this.storageOk = false; return null; } }
  _saveJSON(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { this.storageOk = false; return false; } }

  async init() {
    const r = this.renderer, ui = this.ui;
    const step = async (p, t) => { ui.loading(p, t); await nextFrame(); };
    await step(0.05, 'Gerando terreno da ilha…');
    this.world = new World(1337); const w = this.world; this.physics = new Physics(w); this.vehicles = new VEH.VehicleSystem(this); this.jerryFuel = 0;
    await step(0.25, 'Distribuindo florestas, rochas e cidades…');
    r.createWaterMesh(3000, 240, WATER);
    await step(0.4, 'Modelando personagem e animações…');
    const skel = makeChibiSkeleton(); const clips = buildHumanClips(skel, 'player');
    this.look = { ...LOOK_DEFAULT, ...(this._loadJSON(SAVE_KEY)?.look || {}) };
    this.playerAssets = { skel, clips, mesh: r.createMesh(buildPlayerMesh(skel, this.look)) };
    await loadModelOverride(this, 'assets/models/models.json').catch(() => null);
    this.creatureAssets = buildCreatureAssets(r);
    this.tools = {}; for (const t of ['axe', 'scrapaxe', 'pickaxe', 'spear', 'scrapspear', 'shockspear', 'torch', 'knife', 'scrapknife']) this.tools[t] = r.createMesh(P.toolMesh(t)); this.tools.jerrycan = r.createMesh(VEH.jerrycanMesh()); this.tools.blueprint = r.createMesh(STR.blueprintRollMesh()); this.tools.hammer = r.createMesh(STR.hammerMesh()); this._sheetMesh = r.createMesh(STR.blueprintSheetMesh()); for (const id of Object.keys(GREN)) this.tools[id] = r.createMesh(grenadeMesh(id));
    for (const t of Object.keys(GUNS)) this.tools[t] = r.createMesh(gunMesh(t)); this.scopeMeshes = { scope4: r.createMesh(scopeMesh('scope4')), scope8: r.createMesh(scopeMesh('scope8')) }; this.tools.solarlamp = r.createMesh(P.solarLampMesh()); this.tools.fishing_rod = r.createMesh(rodMesh()); this.tools.geiger = r.createMesh(geigerMesh()); this.tools.c4 = r.createMesh(MXS.c4Mesh()); this.arrowMesh = r.createMesh(arrowMesh());
    await step(0.55, 'Construindo cenário…');
    this._buildScenery();
    await step(0.8, 'Preparando sistemas…');
    this.map = new WorldMap(this);
    this.brokenGlass = new Set(); this.openDoors = new Set(); this.graves = []; this.blockedTrees = new Set(); this.c4s = []; this.webs = []; this.cocoons = []; this.player = new Player(this, this.playerAssets); this.power = new PowerSystem(this); this.grapple = new Grapple(this); this.geiger = new Geiger(this); this.toxicZone = TOXIC; this.build = new BuildSystem(this); this.creatures = new CreatureManager(this, this.creatureAssets);
    this.applySettings();
    this.stream.flush([w.spawn.x, w.spawn.y, w.spawn.z]);
    this.resetWorld(); this.player.setPosition(w.spawn.x, w.spawn.y, w.spawn.z);
    await step(1, 'Pronto');
    this.state = 'menu'; ui.showMain(); if (typeof location !== 'undefined' && (location.hash.startsWith('#mp=') || /[?&]host=1/.test(location.search))) setTimeout(() => ui.showMulti(), 50);
    this.last = performance.now(); requestAnimationFrame((t) => this.frame(t));
  }

  _buildScenery() {
    const r = this.renderer, w = this.world, ph = this.physics;
    this.groups = {};
    this.foliageTex = r.createTexture(makeFoliageAtlas()); const ft = this.foliageTex;
    for (const t of ['oak', 'pine', 'birch', 'dead', 'palm']) this.groups[t] = new InstGroup(this, r.createMesh(P.treeMesh(t, t.length * 7)), { wind: true, tex: ft, doubleSided: true, show: (o) => !o.felled, lod: t === 'palm' ? null : r.createMesh(P.treeLodMesh(t, t.length * 7)), lodDist: 70 });
    this.groups.cactus = new InstGroup(this, r.createMesh(P.cactusMesh(3)), { show: (o) => !o.felled });
    this.groups.stump = new InstGroup(this, r.createMesh(P.stumpMesh()), { show: (o) => o.felled });
    const rockMeshes = [11, 23, 37].map((s) => r.createMesh(P.rockMesh(s))); const richMesh = r.createMesh(P.rockMesh(91, true));
    this.groups.rock = rockMeshes.map((m) => new InstGroup(this, m, { show: (o) => !o.mined }));
    this.groups.rich = new InstGroup(this, richMesh, { show: (o) => !o.mined });
    this.groups.bushB = new InstGroup(this, r.createMesh(P.bushMesh(true, 5)), { wind: true, tex: ft, doubleSided: true, show: (o) => o.berries });
    this.groups.bushE = new InstGroup(this, r.createMesh(P.bushMesh(false, 5)), { wind: true, tex: ft, doubleSided: true, show: (o) => !o.berries });
    for (const k of ['stick', 'stone', 'fiber', 'mushroom', 'crystal']) this.groups[k] = new InstGroup(this, r.createMesh(P.pickupMesh(k)), { show: (o) => !o.taken, wind: k === 'fiber', shadow: k === 'fiber' ? false : undefined, emissive: k === 'crystal' ? 0.35 : 0, doubleSided: k === 'fiber' });
    this.groups.crate = new InstGroup(this, r.createMesh(P.crateMesh()), { show: () => true, tint: (o) => (o.looted ? [0.55, 0.5, 0.45, 1] : null) });
    this.groups.milcrate = new InstGroup(this, r.createMesh(P.milCrateMesh()), { show: () => true, tint: (o) => (o.looted ? [0.6, 0.6, 0.55, 1] : null) });
    this.groups.ratfold = new InstGroup(this, r.createMesh(P.ratFoldedMesh()), { show: (o) => !o.taken });
    for (const c of w.crates) {
      if (c.furn) { c.collider = ph.add({ type: 'cyl', x: c.x, z: c.z, r: 0.45, y0: c.y - 0.2, y1: c.y + 1.2, crate: c, ghost: true }); continue; } // móvel: o colisor real é o do próprio móvel
      if (c.kind === 'milcrate') { this.groups.milcrate.add(c); c.collider = ph.add({ type: 'box', x: c.x, z: c.z, hx: 0.82, hz: 0.47, rot: c.rot, y0: c.y - 0.5, y1: c.y + 1.05, crate: c }); continue; }
      this.groups.crate.add(c); c.collider = ph.add({ type: 'box', x: c.x, z: c.z, hx: 0.5, hz: 0.35, rot: c.rot, y0: c.y - 0.5, y1: c.y + 0.8, crate: c }); }
    for (const o of w.specials) { o.s = 1; this.groups.ratfold.add(o); }
    this.stream = new WorldStream(this);
    this.caveMeshes = w.caves.map((c) => ({ mesh: r.createMesh(P.caveMesh(c, 77 + c.id)), c }));
    this.logMesh = r.createMesh(P.logMesh()); this.hiveMesh = r.createMesh(P.hiveMesh()); this.missileMesh = r.createMesh(P.missileMesh()); this.gatlingMesh = r.createMesh(P.gatlingMesh()); this.bagMesh = r.createMesh(P.pickupMesh('bag')); this.meatMesh = r.createMesh(P.pickupMesh('meat'));
    this.treeMeshes = {}; for (const t of ['oak', 'pine', 'birch', 'dead', 'palm', 'cactus']) this.treeMeshes[t] = this.groups[t].mesh;
    this.grassMesh = r.createMesh(P.grassMesh(3)); this.flowerMesh = r.createMesh(P.flowerMesh(4));
  }

  // predefinições de qualidade gráfica
  applyQuality(q) {
    const P = { baixa: { shadows: false, ssao: false, bloom: false, fxaa: true, detail: 0, grass: 0.5, res: 0.75, viewDist: 'curta' }, media: { shadows: true, ssao: false, bloom: true, fxaa: true, detail: 0.6, grass: 1, res: 1, viewDist: 'normal' },
      alta: { shadows: true, ssao: true, bloom: true, fxaa: true, detail: 1, grass: 1, res: 1, viewDist: 'normal' }, ultra: { shadows: true, ssao: true, bloom: true, fxaa: true, detail: 1, grass: 1.6, res: 1.5, viewDist: 'normal' } }[q];
    if (!P) return; Object.assign(this.settings, P, { quality: q }); this.applySettings();
  }
  applySettings() {
    const s = this.settings; this._saveJSON(SET_KEY, s);
    Object.assign(this.audio.vol, { master: s.master, sfx: s.sfx, ambient: s.ambient, music: s.music }); this.audio.musicOn = s.music > 0.01; this.audio.applyVolumes();
    this.input.sens = s.sens; this.input.invertY = s.invertY; this.renderer.shadowsEnabled = s.shadows;
    this.renderer.post = { ssao: !!s.ssao, bloom: !!s.bloom, fxaa: !!s.fxaa }; this.renderer.detail = s.detail ?? 1; if (s.camSide === -1 || s.camSide === 1) this.cam.side = this.cam.sideCur = s.camSide;
    this.renderer.pixelRatio = Math.min(window.devicePixelRatio || 1, 2) * s.res; this.renderer.resize();
    if (this._grassDensity !== s.grass) { for (const c of this.grassCells.values()) c.dead = true; this.grassCells.clear(); this._grassDensity = s.grass; }
  }

  // ---------- Estado do mundo ----------
  resetWorld() {
    const w = this.world; if (this.vehicles) { if (this.vehicles.driving) this.vehicles.exit(); this.vehicles.reset(); } this.jerryFuel = 0; this._xfer = null;
    for (const t of w.trees) { t.felled = false; t.hp = t.type === 'pine' ? 5 : 6; t.regrowAt = 0; t.collider.ghost = false; }
    for (const o of w.rocks) { o.mined = false; o.hp = o.rich ? 10 : 6; o.regrowAt = 0; o.collider.ghost = false; }
    for (const b of w.bushes) { b.berries = true; b.regrowAt = 0; b.leafT = 0; }
    for (const p of w.pickups) { p.taken = false; p.regrowAt = 0; }
    for (const c of w.crates) { c.looted = false; c.regrowAt = 0; } for (const o of w.specials) { o.taken = false; o.regrowAt = 0; this.groups.ratfold && this.groups.ratfold.dirty(o); }
    for (const q of w.props) if (q.kind === 'car') { q.looted = false; q.regrowAt = 0; }
    for (const hv of w.hives) { hv.honey = true; hv.regrowAt = 0; hv.angry = 0; hv.killed = 0; }
    for (const m of Object.values(w.mods)) m.clear(); w.loadDigs([]);
    if (this.power) { this.power.wiring = null; this.power.dirty = true; } if (this.grapple) this.grapple.hook = null;
    this._dirtyAll(); this.drops = []; this.logs = []; this.falling = []; this.projectiles = []; this.arrows = []; this.clouds = []; if (this.guns) this.guns.load({});
    if (this.build) this.build.load([]);
    if (this.creatures) for (const c of [...this.creatures.list]) this.creatures.remove(c);
    if (this.helis) this.helis.clear();
  }
  _dirtyAll() { for (const g of Object.values(this.groups)) for (const gg of (Array.isArray(g) ? g : [g])) for (const c of gg.cells.values()) c.dirty = true; }
  newGame() {
    this.audio.init(); this.resetWorld(); this.equip = this.freshEquip(); this._applyBack(); this.inv.load([]); this.quick = Array(8).fill(null); this.map.load([]); this.attach = {}; this.home = null; this.stats = { built: 0, kills: 0 };
    const sp = typeof window !== 'undefined' && window.__TEST_FIXED_SPAWN ? { ...this.world.spawn, biome: 'forest' } : this.world.randomSpawn(); this.spawnAt = sp; this._clearSpawnArea(sp); this.player.setPosition(sp.x, this.world.height(sp.x, sp.z), sp.z); this.freshBody(); Object.assign(this.player.stats, { hunger: 85, thirst: 80, energy: 90 });
    this.player.revive(); this.player.yaw = Math.PI * 0.9; this.cam.yaw = this.player.yaw; this.cam.pivot = null; this.cam.pitch = 0.22;
    this.env.time = 0.3; this.env.day = 1; this.env.setWeather('limpo'); this.env.cur.rain = 0; this.env.cur.fog = 0; this.env.cur.cloud = 0.05; this.env.weatherT = 300; this.playTime = 0;
    this.skills = new Set(); this._initBooks(null); this.give('book_carpintaria', 1);
    this.start(); this.saveGame(false);
    setTimeout(() => this.ui.toast('📖 Você tem um <b>Livro de Carpintaria</b>: abra o inventário (Tab), clique com o botão direito nele e escolha <b>Ler</b>.', 'info'), 6000);
    this.ui.toast({ forest: 'Você acordou no meio da floresta…', desert: 'Você acordou no deserto, sob o sol forte…', snow: 'Você acordou na neve. Procure abrigo e fogo!', swamp: 'Você acordou num pântano úmido…' }[this.spawnAt.biome] || 'Você acordou num lugar desconhecido…', 'info');
    setTimeout(() => this.ui.toast('Colete <b>galhos, pedras e fibras</b> (E) e fabrique um <b>machado</b> (Tab → Fabricação).', 'info'), 2500);
  }
  continueGame() { this.audio.init(); const s = this._loadJSON(SAVE_KEY); if (!s) { this.ui.toast('Nenhum salvamento encontrado', 'warn'); return; } try { this.applySave(s); } catch (e) { console.error(e); this.ui.toast('Salvamento corrompido — iniciando novo jogo', 'warn'); this.newGame(); return; } this.start(); this.ui.toast('Jogo carregado', 'ok'); }
  start() { this.input.wantLock = true; this.state = 'playing'; this.ui.showHUD(); this.ui.closePanels(true); this.build.cancel(); this.input.enabled = true; this.saveT = 60; }
  pause() { if (this.state !== 'playing') return; this.state = 'paused'; this.input.exitLock(); this.ui.showPause(); }
  resume() { this.state = 'playing'; this.ui.showHUD(); }
  toMenu() { if (this.net && this.net.active) this.net.leave(); this.state = 'menu'; this.input.exitLock(); this.ui.showMain(); }
  quit() { this.saveGameIfAny(); this.state = 'menu'; this.ui.showQuit(); }
  saveGameIfAny() { if (this.playTime > 0) this.saveGame(false); }
  saveInfo() { const s = this._loadJSON(SAVE_KEY); return s ? { day: s.env.day, at: s.at } : null; }
  unstuck() {
    const p = this.player.pos; const w = this.world;
    for (let r = 1; r < 30; r += 1) for (let a = 0; a < 12; a++) { const x = p[0] + Math.cos(a * 0.52) * r, z = p[2] + Math.sin(a * 0.52) * r; const h = w.height(x, z);
      if (h < 0.5 || w.normal(x, z)[1] < 0.8) continue; if (this.physics.query(x, z, 1).some((c) => !c.ghost && !c.camOnly && this.physics.insideXZ(c, x, z, 0.6))) continue;
      this.player.setPosition(x, h + 0.05, z); this.player.swimming = false; this.ui.toast('Personagem reposicionado', 'ok'); return; }
  }

  saveGame(manual) {
    if (this.netClient) { this._mpSavePlayer(); if (manual) this.ui.toast('💾 Seu personagem foi salvo (o mundo é salvo pelo dono)', 'ok'); return true; }
    if (!this.player || this.state === 'loading' || this.state === 'menu' && !manual) return;
    if (this.player.dead) return;
    const w = this.world, P = this.player;
    const s = { v: 2, at: Date.now(), seed: w.seed, size: 10368,
      player: { pos: P.pos.map((v) => +v.toFixed(3)), yaw: +P.yaw.toFixed(3), stats: { ...P.stats }, crouch: P.crouch },
      veh: this.vehicles.serialize(), jerryFuel: this.jerryFuel, skills: [...this.skills], books: (this.books || []).map((b) => [b.skill, b.spot, b.taken ? 1 : 0, b.regrowAt]),
      inv: this.inv.serialize(), quick: this.quick, equip: { ...this.equip, debugHand: undefined }, attach: this.attach, look: this.look, home: this.home, marks: this.map.save(), env: this.env.serialize(), stats: this.stats, mags: this.guns.save(), cam: [this.cam.yaw, this.cam.pitch, this.cam.targetDist],
      world: this._worldState(),
      pieces: this.build.serialize(), drops: this.drops.map((d) => ({ items: d.items, x: d.x, y: d.y, z: d.z })), logs: this.logs.map((l) => [l.x, l.y, l.z, l.rot]), playTime: this.playTime };
    const ok = this._saveJSON(SAVE_KEY, s);
    if (manual) this.ui.toast(ok ? '💾 Jogo salvo' : 'Não foi possível salvar (armazenamento bloqueado)', ok ? 'ok' : 'warn');
    return ok;
  }
  _worldState() {
    const w = this.world, M = w.mods;
    const st = { trees: [...M.trees], treeHp: [...M.treeHp], rocks: [...M.rocks], bushes: [...M.bushes], pickups: [...M.pickups], hives: [...M.hives] };
    for (const t of w.trees) { if (t.felled) st.trees.push([t.id, t.regrowAt]); else if (t.hp < (t.type === 'pine' ? 5 : 6)) st.treeHp.push([t.id, t.hp]); }
    for (const o of w.rocks) if (o.mined) st.rocks.push([o.id, o.regrowAt]);
    for (const o of w.bushes) if (!o.berries) st.bushes.push([o.id, o.regrowAt]);
    for (const o of w.pickups) if (o.taken) st.pickups.push([o.id, o.regrowAt]);
    for (const o of w.hives) if (!o.honey) st.hives.push([o.id, o.regrowAt]);
    st.digs = [...w.digs]; st.crates = w.crates.filter((c) => c.looted).map((c) => [c.id, c.regrowAt]); st.blockedTrees = [...this.blockedTrees]; st.graves = this.graves.map((q) => [q.x, q.y, q.z, q.rot, q.name]); st.brokenGlass = [...this.brokenGlass]; st.openDoors = [...this.openDoors]; st.specials = w.specials.filter((o) => o.taken).map((o) => [o.id, o.regrowAt]); st.cars = w.props.filter((q) => q.kind === 'car' && q.looted).map((q) => [q.id, q.regrowAt]);
    return st;
  }
  applySave(s) {
    this.resetWorld(); const w = this.world;
    const old = !(s.v >= 2); // salvamentos do mapa antigo (960 m): o mundo mudou, mantém só o personagem
    if (!old) { const M = w.mods; for (const k of ['trees', 'treeHp', 'rocks', 'bushes', 'pickups', 'hives']) for (const [id, v] of s.world[k] || []) M[k].set(id, v); w.loadDigs(s.world.digs); for (const k of [...this.grassCells.keys()]) { const [a, b] = k.split(',').map(Number); this._dropGrass(a * 16 + 8, b * 16 + 8, 1); } this.stream.reapply();
      this.blockedTrees = new Set(s.world.blockedTrees || []); this.graves = (s.world.graves || []).map(([x, y, z, rot, name]) => ({ x, y, z, rot, name })); this.openDoors = new Set(s.world.openDoors || []); this.brokenGlass = new Set(s.world.brokenGlass || []);
      const C = new Map(w.crates.map((o) => [o.id, o])); for (const [id, at] of s.world.crates || []) { const o = C.get(id); if (o) { o.looted = true; o.regrowAt = at; } }
      for (const [id, at] of s.world.specials || []) { const o = w.specials[id]; if (o) { o.taken = true; o.regrowAt = at; this.groups.ratfold.dirty(o); } }
      const CA = new Map(w.props.filter((q) => q.kind === 'car').map((q) => [q.id, q])); for (const [id, at] of s.world.cars || []) { const o = CA.get(id); if (o) { o.looted = true; o.regrowAt = at; } } }
    else { s.player.pos = [w.spawn.x, w.spawn.y, w.spawn.z]; s.drops = []; s.logs = []; s.pieces = []; s.home = null; }
    this._dirtyAll();
    this.build.load(s.pieces || []);
    this.drops = (s.drops || []).map((d) => ({ ...d, items: d.items.filter((it) => ITEMS[it[0]]) }));
    this.logs = (s.logs || []).map(([x, y, z, rot]) => ({ x, y, z, rot }));
    const AL = { backpack: 'pack_small', milpack: 'pack_large' }; const back0 = AL[s.equip?.back] || s.equip?.back;
    { const E = this.freshEquip(), se = s.equip || {}; E.back = ITEMS[back0] ? back0 : null; E.suit = se.suit === 'ratsuit' ? 'ratsuit' : null; for (const k of [...CLOTH_SLOTS, 'backA', 'backB']) if (se[k] !== undefined) E[k] = ITEMS[se[k]] ? se[k] : null; if (se.body && ITEMS[se.body] && ITEMS[se.body].slot) E[ITEMS[se.body].slot] = se.body; E.dur = se.dur || {}; if (!E.shoes && !se._shoesGiven) E.shoes = 'tenis'; if (E.shoes === 'rags_shoes' && !se._tenis) { E.shoes = 'tenis'; delete E.dur.shoes; } E._shoesGiven = true; E._tenis = true; this.equip = E; } this._noBack = true; this._applyBack(); this.inv.load(s.inv); this._noBack = false;
    if (s.equip?.hand && ITEMS[s.equip.hand]) { if (this.countAll(s.equip.hand) <= 0) this.inv.add(s.equip.hand, 1); this.equip.hand = s.equip.hand; }
    this.quick = Array(8).fill(null); if (Array.isArray(s.quick)) { if (s.quick.length === 8) s.quick.forEach((q, k) => { if (ITEMS[q] && quickClass(q) === slotClass(k)) this.quick[k] = q; }); else for (const q of s.quick) if (ITEMS[q]) this.bindQuick(q); } else for (const e of this.inv.slots) this._autoQuick(e.id);
    this.syncHand(); if (this.vehicles.driving) this.vehicles.exit(); this.vehicles.load(s.veh); this.jerryFuel = s.jerryFuel || 0;
    if (s.look) { this.look = { ...LOOK_DEFAULT, ...s.look }; this.applyLook(); }
    this.attach = {}; for (const [k, v] of Object.entries(s.attach || {})) { if (!GUNS[k]) continue; if (typeof v === 'string') { if (ITEMS[v]) this.attach[k] = { scope: v }; } else if (v && typeof v === 'object') { const o = {}; for (const sl of ['scope', 'mag', 'sil']) if (v[sl] === null) o[sl] = null; else if (v[sl] && ITEMS[v[sl]]) o[sl] = v[sl]; this.attach[k] = o; } }
    this.skills = new Set(s.skills || (s.v >= 2 ? [] : [])); if (!s.skills) this.skills.add('carpintaria'); this._initBooks(s.books);
    this.map.load(s.marks); this.home = s.home || null; this.stats = s.stats || { built: 0, kills: 0 }; this.guns.load(s.mags); this.env.load(s.env); this.playTime = s.playTime || 0;
    const P = this.player; P.revive(); this.stream.flush(s.player.pos); P.setPosition(...s.player.pos); P.yaw = s.player.yaw; this.freshBody(); Object.assign(P.stats, s.player.stats); P.crouch = !!s.player.crouch; P.stats.hp = Math.max(P.stats.hp, 1);
    if (s.cam) { this.cam.yaw = s.cam[0]; this.cam.pitch = s.cam[1]; this.cam.targetDist = s.cam[2]; } this.cam.pivot = null;
    // segurança: se o salvamento colocou o jogador dentro de algo, reposiciona
    const g = this.world.height(P.pos[0], P.pos[2]); if (P.pos[1] < g - 0.5) P.pos[1] = g;
  }

  // ---------- Laço principal ----------
  // Avança a simulação sem renderizar (usado pelos testes automatizados)
  debugStep(n = 1, dt = 1 / 30) { for (let i = 0; i < n; i++) { if (this.state === 'playing') this.update(dt); else if (this.state === 'dead') { this.player.update(dt, {}, this.cam.yaw); this.creatures.update(dt); } if (this.net.active) this.net.update(dt); this.input.endFrame(); } }
  frame(t) {
    requestAnimationFrame((tt) => this.frame(tt)); if (this.touchUI) this.touchUI.tick();
    let dt = (t - this.last) / 1000; this.last = t; if (!(dt > 0)) dt = 0.016; dt = Math.min(dt, 0.05);
    const tf0 = performance.now();
    try {
      this.frameCount = (this.frameCount || 0) + 1; this.simTime = (this.simTime || 0) + dt;
      if (this.state === "playing") this.update(dt);
      else if (this.state === 'paused' && this.net.active) { this._idleUpd = true; try { this.update(dt); } finally { this._idleUpd = false; } }
      if (this.net.active) this.net.update(dt);
      else if (this.state === 'menu') this._menuCamera(dt);
      else if (this.state === 'create') this._createCamera(dt);
      else if (this.state === 'dead') { this.player.update(dt, {}, this.cam.yaw); this.cam.update(dt, this.player, this.physics); this.creatures.update(dt); this.env.update(dt); }
      this.render(dt); this._lootMarks(dt); this.frameMs = performance.now() - tf0; this.maxFrameMs = Math.max(this.maxFrameMs || 0, this.frameMs);
    } catch (e) { console.error(e); if (!this._errShown) { this._errShown = true; this.ui.toast('Erro: ' + e.message, 'warn'); } }
    this.input.endFrame();
  }
  // criação de personagem: o personagem aparece de frente na praia; arrastar gira
  // carrega o lugar e tira criaturas por perto, para não nascer no meio de um ataque
  _clearSpawnArea(sp) { this.stream.flush([sp.x, sp.y, sp.z]); if (this.creatures) for (const c of [...this.creatures.list]) if (Math.hypot(c.pos[0] - sp.x, c.pos[2] - sp.z) < 60) this.creatures.remove(c);
    for (let k = 0; k < 30; k++) { const blocked = this.physics.query(sp.x, sp.z, 1.5).some((c) => !c.ghost && !c.platform && this.physics.insideXZ(c, sp.x, sp.z, 0.6)); if (!blocked) break; sp.x += (Math.random() - 0.5) * 6; sp.z += (Math.random() - 0.5) * 6; }
    sp.y = this.world.height(sp.x, sp.z); }
  openCreator() { this.audio.init(); const w = this.world, sp = w.spawn; this.stream.flush([sp.x, sp.y, sp.z]); this.resetWorld(); const P = this.player; P.revive(); P.setPosition(sp.x, sp.y, sp.z); P.yaw = 0; this.creatorYaw = 0.35;
    this.look = { ...LOOK_DEFAULT, ...this.look }; this.applyLook(); this.state = 'create'; this.input.exitLock(); this.input.wantLock = false; this.ui.showCreator(); }
  // aparência das roupas vestidas (cores, chapéu/capacete, colete, descalço)
  clothLook() { const e = this.equip || {}, o = {}; const C = { shirt: [0xb89a6a, 0x6e5a3a], parka: [0x3a5a3a, 0x5a6a4a], milshirt: [0x4e5a36, 0x5e6a42] }; if (C[e.shirt]) { o.shirt = C[e.shirt][0]; o.jacket = C[e.shirt][1]; }
    const PC = { pants: 0x5a4632, milpants: 0x4a5634 }; if (PC[e.pants]) o.pants = PC[e.pants]; const SC = { rags_shoes: 0x4a3a2e, fibershoes: 0xa89060, leatherboots: 0x5a3a22, milboots: 0x24221e }; if (!e.shoes) o.barefoot = true; else if (SC[e.shoes]) o.shoes = SC[e.shoes];
    const VC = { barkarmor: [0x6a4a2c, 0], scraparmor: [0x7a7e84, 1], vest: [0x3e4a2e, 0], clothvest: [0x9a8460, 0] }; if (VC[e.vest]) { o.vestCol = VC[e.vest][0]; o.vestMetal = !!VC[e.vest][1]; } if (e.hat) o.hatKind = e.hat === 'milhelmet' ? 'helmet' : e.hat === 'nvg' ? 'nvg' : 'straw'; if (e.hat === 'nvg') { o.nvgLit = !!this.nvgOn; o.nvgCell = (e.nvgCell || 0) > 0; } return o; }
  applyLook() { const r = this.renderer, old = this.playerAssets.mesh; const L = { ...this.look, ...this.clothLook(), suit: this.equip && this.equip.suit, pack: this.equip && !this.equip.suit ? this.equip.back : null }; const key = JSON.stringify(L); if (key === this._lookKey && old) return; this._lookKey = key; this.playerAssets.mesh = r.createMesh(buildPlayerMesh(this.playerAssets.skel, L)); if (old && old !== this.playerAssets.mesh) r.disposeMesh(old); }
  _createCamera(dt) {
    const P = this.player, inp = this.input; if (inp.mouse.left || inp.touchActive) this.creatorYaw += inp.mouse.dx * 0.01; else this.creatorYaw += dt * 0.25;
    P.yaw = this.creatorYaw; P.vel = [0, 0, 0]; P.anim.play(P.clips.idle, 0.2); P.anim.update(dt); P._matrices();
    const fx = Math.sin(0), fz = Math.cos(0); const c = [P.pos[0], P.pos[1] + 1.1, P.pos[2]]; this.cam.eye = [c[0] - 0.7 + fx * 3.2, c[1] + 0.2, c[2] + fz * 3.2]; this.cam.target = [c[0] - 0.7, c[1] - 0.05, c[2]];
    this.env.update(dt * 0.2); this.menuMode = false; this.creating = true;
  }
  _menuCamera(dt) {
    this.menuT += dt * 0.03; const w = this.world, sp = w.spawn; const c = [sp.x + (RUINS.x - sp.x) * 0.3, 0, sp.z + (RUINS.z - sp.z) * 0.3];
    const ex = c[0] + Math.cos(this.menuT) * 140, ez = c[2] + Math.sin(this.menuT) * 140; const ey = Math.max(w.height(ex, ez) + 18, 30);
    this.cam.eye = [ex, ey, ez]; this.cam.target = [c[0], w.height(c[0], c[2]) + 8, c[2]];
    this.env.update(dt * 0.2); this.menuMode = true;
  }
  update(dt) {
    if (this.bloodPools) for (const b of this.bloodPools) b.t += dt;
    const inp = this.input, ui = this.ui, P = this.player; this.menuMode = false; this.playTime += dt; this.stream.update(P.pos, 2);
    const act = this._idleUpd ? { mx: 0, mz: 0, analog: 0, slot: 0 } : inp.actions();
    if (act.pause) { if (this.build.mode) this.build.cancel(); else if (ui.anyOpen) ui.closePanels(); else { this.pause(); return; } }
    if (act.mic) this.voice.toggle(); this.voice.update(dt);
    if (act.map) { if (ui.open === 'map') ui.closePanels(); else ui.openPanel('map'); }
    if (act.nvg) this.toggleNvg();
    if (act.inventory) { if (ui.open === 'inv') ui.closePanels(); else if (!P.dead) ui.openPanel('inv', { tab: 'inv' }); }
    if (act.equipment) { if (ui.open === 'inv' && ui.curTab === 'equip') ui.closePanels(); else ui.openPanel('inv', { tab: 'equip' }); }
    if (act.build) { if (this.build.mode) this.build.cancel(); else if (ui.open === 'build') ui.closePanels(); else ui.openPanel('build'); }
    const driving = !!this.vehicles.driving; const blocked = ui.anyOpen || driving || this.player.fainted > 0;
    if (!ui.anyOpen && !this.struct.radial && !this._idleUpd) this.cam.input(inp.mouse.dx, inp.mouse.dy, (this.build.mode && inp.locked) || (this.guns.scope && this.guns.aimT > 0.3) ? 0 : inp.mouse.wheel, inp.sens, inp.invertY);
    const pa = blocked ? { mx: 0, mz: 0, analog: 0 } : act; if (driving && !ui.anyOpen) this.vehicles.update(dt, act);
    if (this._xfer) this._updateXfer(dt);
    if (act.shoulder && !blocked) { this.cam.side *= -1; this.settings.camSide = this.cam.side; this._saveJSON(SET_KEY, this.settings); }
    const gunUsed = this.guns.update(dt, act, blocked || this.build.mode);
    if (!blocked) {
      if (act.slot) this.hotbar(act.slot - 1); if (act.unequip) this.unequip('hand');
      if (this.build.mode) { if (act.cancel && !act.pause) this.build.cancel(); else this.build.update(dt, act); }
      else {
        if (gunUsed) P.setBlocking(false);
        else if (this.equip.hand === 'c4') { P.setBlocking(false); if (act.use) this.placeC4(); }
        else if (LOCKS[this.equip.hand] || this.equip.hand === 'fishing_rod') { P.setBlocking(false); } // tranca na mão: o sistema de território cuida do clique
        else if (this.equip.hand && ITEMS[this.equip.hand] && ITEMS[this.equip.hand].tool === 'grenade') { P.setBlocking(false); this.grenades.input(act, dt); }
        else if (this.equip.hand === 'blueprint' || this.equip.hand === 'hammer') { P.setBlocking(false); this.struct.input(act, dt); }
        else { const cb = this.canBlock(); if (act.block && !cb && !this._blockHint && this.equip.hand !== 'geiger') { this._blockHint = true; this.ui.toast('Para defender com o botão direito, segure uma arma branca (faca, machado, picareta ou lança)', 'info'); } P.setBlocking(!!act.block && !P.dead && cb); if (act.use) this.useAction(); }
        if (act.interact) this.interact();
        if (act.demolish && this.power.wiring) this.power.cancelWire('Ligação de fio cancelada');
      }
    } else P.setBlocking(false);
    this.syncHand(); P.torchLit = this.equip.hand === 'torch' || this.equip.hand === 'solarlamp';
    // ao defender, vira para o inimigo mais próximo (trava suave)
    P.blockFace = null; if (P.blocking) { let bd = 5; for (const c of this.creatures.list) { if (c.dead || !(c.def.hostile || c.angry > 0)) continue; const d = Math.hypot(c.pos[0] - P.pos[0], c.pos[2] - P.pos[2]); if (d < bd) { bd = d; P.blockFace = Math.atan2(c.pos[0] - P.pos[0], c.pos[2] - P.pos[2]); } } }
    P.update(dt, pa, this.cam.yaw);
    this.cam.aimT = this.guns.aimT; this.cam.update(dt, P, this.physics);
    { const st = this.world.siteAt(P.pos[0], P.pos[2]); const k = st ? st.kind : null; if (k !== this._siteK) { this._siteK = k; if (st) this.ui.toast(`📍 ${st.name}`, 'info'); } }
    this.env.update(dt); this.helis.update(dt); this.creatures.update(dt); this.npcs.update(dt); this.grenades.update(dt); this.blasts.update(dt); this.smoke.update(dt); this.admin.tick(dt); this.struct.update(dt); this.territory.update(dt, act); this.fishing.update(dt, act); this.fires.update(dt); this.convoys.update(dt); this._trapTick(dt); if (this.ui.open === 'fire' && this.ui.fire) { this._fireUiT = (this._fireUiT || 0) - dt; if (this._fireUiT <= 0) { this._fireUiT = 0.25; this.ui.renderFire(); } } this._updateButcher(dt); this.ui.flash && this.ui.flash(this.grenades.flashT); this._smokeOv(); this.build.update2(dt); this.power.update(dt); this.grapple.update(dt); this.geiger.update(dt);
    if (this._reading) { this._reading.t += dt; this.ui.readProgress(Math.min(1, this._reading.t / this._reading.T)); if (this.player.dead) this._reading = null; }
    this._updateClouds(dt); this._survival(dt); this._updateFalling(dt); this._updateProjectiles(dt); this._updateArrows(dt); this._updateC4(dt); this._updateWebs(dt); this._interactPrompt();
    this.saveT -= dt; if (this.saveT <= 0) { this.saveT = 60; this.saveGame(false); }
    ui.update(dt); this.map.updateHUD(); if (ui.open === 'map' && (this._mapT = (this._mapT || 0) - dt) < 0) { this._mapT = 0.25; this.map.draw(); }
  }
  // ---------- Sobrevivência ----------
  // doenças e condições: febre (orange), fadiga (yellow), hipotermia / falta de ar (blue), radiação (frasco branco), névoa tóxica
  _conditions(dt, s, P) {
    const w = this.world, suit = this.equip.suit === 'ratsuit'; const tox = w.toxicAt(P.pos[0], P.pos[2]);
    // ---- radiação ----
    // Dentro da zona sem a R.A.T a dose sobe até 50% em 5 minutos (no miolo). Ao chegar em 50% você fica
    // CONTAMINADO: a dose continua subindo mesmo fora da área e, sem o remédio antirradiação, mata em 100%.
    this._sickTick(dt, s);
    const RAD_LIMIT = 50, ZONE_T = 300; const nc = this.inv.contaminated();
    let rate = 0; if (tox > 0 && !suit) rate += tox * RAD_LIMIT / ZONE_T; if (nc && !suit) rate += Math.min(0.12, nc * 0.01);
    this.radRate = rate; this.radExposed = rate > 0;
    if (tox > 0 && !suit) { if (tox > 0.3) this.addStatus('breath', tox * 1.5 * dt);
      this._coughT = (this._coughT ?? 2) - dt; if (this._coughT <= 0) { this._coughT = 2.5 + Math.random() * 4 - tox * 1.5; this.audio.play('cough', { vol: 0.8 }); this.cam.shake = Math.max(this.cam.shake, 0.12); }
      if (!this._toxWarn) { this._toxWarn = true; this.ui.danger && this.ui.danger('⚠ PERIGO: ÁREA TÓXICA'); this.ui.toast('☢️ Você está sendo exposto à radiação! Você começa a tossir — saia em até 5 minutos ou vai ficar INFECTADO. Vista a roupa R.A.T.', 'warn'); } } else if (tox <= 0) this._toxWarn = false;
    const r0 = s.rad || 0; let r = r0 + rate * dt;
    if (r >= RAD_LIMIT) r += 0.11 * dt; // contaminado: progride sozinho (≈7,5 min de 50% a 100%)
    else if (rate <= 0) r = Math.max(0, r - 0.05 * dt); // abaixo do limite e longe da fonte: o corpo elimina devagar
    s.rad = Math.min(100, r);
    if (r0 < RAD_LIMIT && s.rad >= RAD_LIMIT) { this.ui.toast('☢️ INFECTADO pela névoa tóxica (5 min sem a roupa)! Tome o remédio antirradiação (frasco branco) ou você vai morrer.', 'warn'); this.audio.play('alarm', { vol: 0.5 }); }
    if (s.rad >= 75) this.damage(0.06 * dt, 'radiação', true);
    if (s.rad >= 100) { this.damage(9999, 'radiação'); }
    this.audio.setGeiger && this.audio.setGeiger(this.radExposed ? Math.min(1, 0.35 + rate * 2.2) : 0);
    // febre e inflamação: sangramento sem tratar ou muito tempo molhado no frio
    if (s.bleed > 0) s.infect = (s.infect || 0) + dt * 0.5; else s.infect = Math.max(0, (s.infect || 0) - dt * 0.05);
    if ((s.wet || 0) > 60 && (s.temp ?? 37) < 36.2) s.infect = (s.infect || 0) + dt * 0.15;
    if ((s.infect || 0) > 30 && !(s.fever > 0)) this.addStatus('fever', 40);
    if (s.fever > 0) { s.fever = Math.min(100, s.fever + dt * 0.08); s.energy = Math.max(0, s.energy - dt * 0.12); s.thirst = Math.max(0, s.thirst - dt * 0.06); if (s.fever > 60) this.damage(0.05 * dt, 'febre', true); }
    // fadiga e fraqueza: energia ou fome muito baixas
    if ((s.energy < 12 || s.hunger < 8) && !(s.fatigue > 0)) this.addStatus('fatigue', 30);
    if (s.fatigue > 0) { if (s.energy > 50 && s.hunger > 40) s.fatigue = Math.max(0, s.fatigue - dt * 0.15); else s.fatigue = Math.min(100, s.fatigue + dt * 0.05); s.stamina = Math.min(s.stamina, 100 - s.fatigue * 0.5); }
    // hipotermia: corpo abaixo de 35,2 °C
    if ((s.temp ?? 37) < 35.2) this.addStatus('hypo', dt * 3); else if (s.hypo > 0 && (s.temp ?? 37) > 36.3) s.hypo = Math.max(0, s.hypo - dt * 0.5);
    if (s.hypo > 0) { s.stamina = Math.max(0, s.stamina - dt * 1.2); }
    // falta de ar: some aos poucos fora da névoa
    if (s.breath > 0) { if (tox <= 0 || suit) s.breath = Math.max(0, s.breath - dt * 0.25); s.stamina = Math.min(s.stamina, 100 - s.breath * 0.6); }
  }
  addStatus(kind, amt) {
    const s = this.player.stats; const had = (s[kind] || 0) > 0.5; s[kind] = Math.min(kind === 'rad' ? 100 : 90, (s[kind] || 0) + amt); if (!had && s[kind] <= 0.5) return;
    if (!had) this.ui.toast({ bleed: '🩸 Você está sangrando! Use uma bandagem.', poison: '🤢 Intoxicado! Tome um comprimido verde.', fever: '🌡️ Febre e inflamação! Tome um comprimido laranja.', fatigue: '⚡ Fadiga e fraqueza! Tome um comprimido amarelo.', hypo: '❄️ Hipotermia! Aqueça-se ou tome um comprimido azul.', breath: '🫁 Falta de ar! Tome um comprimido azul.', rad: '☢️ Você absorveu radiação.' }[kind] || '', 'warn');
  }
  // temperatura ambiente (°C) no local do jogador
  ambientTemp() {
    const P = this.player, e = this.env; const h = e.hours; const dayCurve = Math.cos(((h - 14) / 24) * Math.PI * 2); // máx às 14h
    let t = 15 + dayCurve * 8 - ((e.cur && e.cur.rain) || 0) * 5 - Math.max(0, P.pos[1] - 25) * 0.08;
    if (P.inCave) t = 13; if (P.swimming) t -= 6;
    if (this.nearFire(P.pos[0], P.pos[2], 4.5)) t += 18 * (1 - Math.hypot(this.lastFire[0] - P.pos[0], this.lastFire[1] - P.pos[2]) / 5);
    if (this.nearPiece && (this.nearPiece('shelter', 2.2) || this.nearPiece('tent', 1.6))) t += 5;
    return t;
  }
  _survival(dt) {
    const P = this.player, s = P.stats, L = this.env.dayLength; if (P.dead) return;
    // roupas se desgastam com o tempo (a roupa inicial dura ~1h30 de jogo; feitas ~3h; militares ~6h)
    if (!P.dead) for (const sl of ['shirt', 'pants', 'vest', 'hat']) { const id = this.equip[sl]; if (!id || id === 'nvg') continue; const it = ITEMS[id]; const life = it.life || (it.mil ? 21600 : sl === 'vest' && it.armor ? 0 : 10800); if (life) this.wear(sl, dt * (it.dur || 1000) / life * (P.sleeping ? 0.5 : 1) * (P.swimming ? 2 : 1)); }
    { const hs = P.onGround && !P.swimming ? Math.hypot(P.vel[0], P.vel[2]) * dt : 0; if (hs > 0) { if (this.equip.shoes) this.wear('shoes', hs * (P.sprinting ? 1.5 : 1)); else { this._bareM = (this._bareM || 0) + hs; if (this._bareM > 45) { this._bareM = 0; if (Math.random() < (this.world.biome(P.pos[0], P.pos[2]) === 'desert' ? 0.35 : 0.22)) { this.addStatus('bleed', 4); this.ui.toast('🩸 Você machucou o pé andando descalço! Faça sapatos de fibra.', 'warn'); } } } } }
    const sprint = P.sprinting ? 1.7 : 1; const sleepMul = P.sleeping ? 0.3 : 1; const desert = this.world.biome(P.pos[0], P.pos[2]) === 'desert' ? (this.equip.hat === 'hat' ? 1.3 : 1.7) : 1;
    let kg = this.inv.kg() + (this.equip.back ? itemKg(this.equip.back) : 0); for (const k of [...CLOTH_SLOTS, 'backA', 'backB']) if (this.equip[k]) kg += itemKg(this.equip[k]); this.carryKg = kg; P.weightMul = kg <= CARRY_KG ? 1 : Math.max(0.45, 1 - (kg - CARRY_KG) / (MAX_KG - CARRY_KG) * 0.55);
    s.hunger = Math.max(0, s.hunger - (100 / (L * 1.15)) * dt * sprint * sleepMul);
    s.thirst = Math.max(0, s.thirst - (100 / (L * 0.8)) * dt * (P.sprinting ? 2.8 : 1) * desert * sleepMul);
    s.energy = Math.max(0, s.energy - (100 / (L * 1.4)) * dt * (P.sprinting ? 1.4 : 1));
    if (s.hunger <= 0) this.damage(0.45 * dt, 'fome', true); if (s.thirst <= 0) this.damage(0.7 * dt, 'sede', true);
    // ferimentos: sangramento e veneno
    if (s.bleed > 0) { this.damage(0.55 * dt * Math.min(2, 0.5 + s.bleed / 20), 'sangramento', true); s.bleed = Math.max(0, s.bleed - dt * 0.08); if (Math.random() < dt * 3) this.fx.burst([P.pos[0], P.pos[1] + 0.9, P.pos[2]], 2, [0.45, 0.02, 0.02], 0.6, 0.6, 0.03); }
    if (s.poison > 0) { this.damage(0.8 * dt, 'veneno', true); s.poison = Math.max(0, s.poison - dt * 0.35); s.stamina = Math.max(0, s.stamina - 3 * dt); }
    this._conditions(dt, s, P); if (this.nvgOn && this.equip.hat !== 'nvg') this.toggleNvg(false);
    if (this.nvgOn) { this.equip.nvgCell = Math.max(0, (this.equip.nvgCell || 0) - dt); if (this.equip.nvgCell <= 0) { this.toggleNvg(false); this.ui.toast('🪫 A bateria do óculos acabou — a luz verde apagou', 'warn'); } }
    if (this.equip.nvgCell != null && this.equip.hat !== 'nvg' && this.countAll('nvg') < 1) this.equip.nvgCell = null;
    // molhado (chuva/natação) e temperatura corporal
    this._updateFarm(dt);
    const rainV = (this.env.cur && this.env.cur.rain) || 0; const rainHere = rainV > 0.2 && !P.inCave && !(this.nearPiece && this.nearPiece('shelter', 2.2));
    s.wet = Math.max(0, Math.min(100, (s.wet || 0) + (P.swimming ? 40 : rainHere ? 4 * rainV : -(this.nearFire(P.pos[0], P.pos[2], 4.5) ? 6 : 1.2)) * dt));
    const amb = this.ambientTemp() - (s.wet || 0) * 0.08; const warm = this.warmVal();
    const target = 37 + Math.max(-6, Math.min(3, (amb + warm - 16) * 0.12)) + (P.sprinting ? 0.6 : 0);
    s.temp = (s.temp ?? 37) + (target - (s.temp ?? 37)) * Math.min(1, dt / 40);
    if (s.temp < 35) { this.damage(0.25 * dt * (35 - s.temp + 0.5), 'hipotermia', true); s.energy = Math.max(0, s.energy - dt * 0.05); }
    if (s.temp > 39.2) s.thirst = Math.max(0, s.thirst - dt * 0.15);
    if (s.temp < 35.6 && !this._coldWarn) { this._coldWarn = true; this.ui.toast('🥶 Você está com frio. Aqueça-se numa fogueira ou vista roupas quentes.', 'warn'); } if (s.temp > 36.3) this._coldWarn = false;
    if (s.hunger > 45 && s.thirst > 45 && s.hp < 100) s.hp = Math.min(100, s.hp + (s.hunger > 75 && s.thirst > 75 ? 0.5 : 0.22) * dt);
    if (s.energy <= 0 && Math.random() < dt * 0.05) this.ui.toast('Você está exausto. Durma numa barraca ou abrigo.', 'warn');
    // queimadura na fogueira
    for (const p of this.build.pieces) if (p.type === 'campfire' && p.lit && Math.hypot(p.x - P.pos[0], p.z - P.pos[2]) < 0.65 && Math.abs(p.y - P.pos[1]) < 0.6) this.damage(8 * dt, 'queimaduras', true);
    // avisos
    this._warnT = (this._warnT || 0) - dt;
    if (this._warnT <= 0) { if (s.thirst < 20) { this.ui.toast('Você está com muita sede! Beba água (E perto de rio/lago).', 'warn'); this._warnT = 25; } else if (s.hunger < 20) { this.ui.toast('Você está faminto! Coma algo.', 'warn'); this._warnT = 25; } }
  }
  damage(n, cause, silent, o) {
    if (this.admin && this.admin.on.immortal && cause !== 'admin') return; // modo deus
    const P = this.player; if (P.dead || n <= 0) return;
    // desmaiado e atingido de novo: é finalizado (mexe os braços no chão e fica uma poça de sangue)
    if (P.fainted > 0 && !silent) { P.stats.hp = 0; this._lastCause = cause; this.playerDie(cause, true); return; }
    // um tiro que tira 70% da vida total (sem matar) derruba: desmaia de peito no chão
    if (o && o.shot && n >= 70 && P.stats.hp - n > 0 && !(P.fainted > 0)) { P.stats.hp -= n; this._lastCause = cause; this.audio.play('groan', { big: true, f0: this.look && this.look.voice ? this.look.voice : 150 }); this.faintPlayer(22, '💫 O tiro te derrubou — você desmaiou!'); return; }
    P.stats.hp -= n; this._lastCause = cause;
    if (!silent) { P.hitReact(); this.audio.play('hurt'); this.cam.shake = Math.min(1, n / 15); }
    // gemido de dor a cada dano (pequenos danos contínuos — sangramento, fome, frio — gemem com menos frequência)
    { const now = this.env.elapsed, gap = n >= 4 && !silent ? 0.45 : 2.6; if (!(now - (this._groanT ?? -99) < gap) && P.stats.hp > 0) { this._groanT = now; this.audio.play('groan', { big: n >= 15, f0: this.look && this.look.voice ? this.look.voice : 150 }); } }
    if (P.stats.hp <= 0) this.playerDie(cause);
  }
  // defesa (botão direito) só com armas brancas; tiros e explosões não podem ser defendidos
  canBlock() { const h = this.equip.hand && ITEMS[this.equip.hand]; return !!(h && ['knife', 'axe', 'pickaxe', 'spear'].includes(h.tool)); }
  playerHit(dmg, src, opt) {
    const P = this.player; if (P.remote) { this.net.sendHitTo(P.id, dmg, opt || {}, src); return; } if (P.dead || P.sleeping) return;
    if (src && src.pos) this.ui.damageFrom && this.ui.damageFrom(Math.atan2(src.pos[0] - P.pos[0], src.pos[2] - P.pos[2]) - this.cam.yaw);
    if (P.sleeping) this.wake();
    let d = dmg * (this.settings.enemyMul >= 1.5 ? 1.3 : this.settings.enemyMul < 1 ? 0.7 : 1);
    { const av = this.armorVal(); if (av) d *= 1 - av * (opt && opt.pierce ? 0.3 : 1); if (this.equip.vest || this.equip.shirt) this.wear(this.equip.vest ? 'vest' : 'shirt', d * 0.5); }
    if (P.blocking && this.canBlock() && !(opt && opt.ranged) && src && src.pos) { const toSrc = Math.atan2(src.pos[0] - P.pos[0], src.pos[2] - P.pos[2]); if (Math.abs(angleDiff(P.yaw, toSrc)) < 1.6 && P.stats.stamina > 8) { const kn = ITEMS[this.equip.hand].tool === 'knife'; d *= kn ? 0.3 : 0.15; P.stats.stamina -= kn ? 14 : 10; if (!src.dead && src.def && !src.def.boss) { src.attackCd = Math.max(src.attackCd || 0, 1.0); src.knock = 0.25; } /* atacante perde o ritmo */ this.audio.play('block'); this.fx.burst(P.handWorldPos(), 8, [1, 0.85, 0.5], 3, 0.25, 0.04); this.damage(d, src.def.name, true); P.hurtFlash = 0.1; return; } }
    // golpe que passou pela defesa: ferimentos fortes podem sangrar
    if (d >= 12 && Math.random() < 0.3 + d / 80) this.addStatus('bleed', 6 + d * 0.4);
    this.fx.burst([P.pos[0], P.pos[1] + 1.2, P.pos[2]], 10, [0.6, 0.05, 0.05], 2.5, 0.5);
    this.damage(d, src.def ? `atacado por ${src.def.name.toLowerCase()}` : 'ataque', false, { shot: !!(opt && opt.ranged) });
    return true;
  }
  // óculos de visão noturna (N): imagem verde e clara no escuro
  // óculos de visão noturna: vestido no lugar do chapéu, com bateria de célula (segundos de uso restantes em equip.nvgCell)
  attachCell(i) { const s = this.inv.slots[i]; if (!s || s.id !== 'nvcell') return false; if (this.countAll('nvg') < 1 && this.equip.hat !== 'nvg') return false;
    if (this.equip.nvgCell != null) { this.ui.toast('O óculos já tem bateria. Clique direito nele para tirar a atual.', 'warn'); return false; }
    this.inv.takeSlot(i, 1); this.equip.nvgCell = NVG_CAP; this.audio.play('click'); this.audio.play('nvgOn', { vol: 0.5 }); this.ui.toast('🔋 Bateria anexada ao óculos de visão noturna', 'ok'); this.applyLook(); return true; }
  removeCell() { const c = this.equip.nvgCell; if (c == null) return false; if (this.nvgOn) this.toggleNvg(false); this.equip.nvgCell = null; const id = c >= NVG_CAP * 0.98 ? 'nvcell' : 'nvcell_dead';
    if (this.inv.add(id, 1) < 1) this.dropNear([[id, 1]]); this.audio.play('click'); this.ui.toast(id === 'nvcell' ? '🔋 Bateria retirada' : '🪫 Bateria descarregada retirada do óculos', 'info'); this.applyLook(); return true; }
  toggleNvg(force) { const on = force ?? !this.nvgOn; if (on && this.equip.hat !== 'nvg') { this.ui.toast(this.countAll('nvg') > 0 ? 'Vista o óculos de visão noturna (espaço do chapéu) para usar' : 'Você não tem óculos de visão noturna', 'warn'); return; }
    if (on && !(this.equip.nvgCell > 0)) { this.ui.toast(this.equip.nvgCell == null ? 'O óculos está sem bateria — arraste uma bateria de célula sobre ele' : '🪫 A bateria do óculos acabou — clique direito nele para tirá-la', 'warn'); this.audio.play('click'); return; } this.nvgOn = on; if (on) { this._bloomWas = this.renderer.post.bloom; this.renderer.post.bloom = false; } else if (this._bloomWas !== undefined) this.renderer.post.bloom = this._bloomWas; const c = this.renderer.canvas; c.style.filter = on ? 'grayscale(1) sepia(1) hue-rotate(60deg) saturate(2.2) contrast(1.1) brightness(0.95)' : ''; this.audio.play(on ? 'nvgOn' : 'click'); this.ui.toast(on ? '🥽 Visão noturna ligada (N)' : 'Visão noturna desligada', 'info'); this.applyLook(); }
  // vidro de janela: quebra com tiro (som + cacos) e libera a passagem
  breakGlass(gp, p) { if (!gp || gp.broken) return; gp.broken = true; this.brokenGlass.add(gp.id); if (gp.col) { this.physics.remove(gp.col); gp.col = null; } const d = Math.hypot(gp.x - this.player.pos[0], gp.z - this.player.pos[2]);
    this.audio.play('glass', { vol: Math.max(0.15, 1 - d / 60) }); const c = p || [gp.x, gp.y, gp.z]; for (let i = 0; i < 18; i++) this.fx.parts.push({ p: [c[0] + (Math.random() - 0.5) * gp.w * 0.8, c[1] + (Math.random() - 0.5) * gp.h * 0.8, c[2] + (Math.random() - 0.5) * gp.w * 0.8], v: [(Math.random() - 0.5) * 3, Math.random() * 1.5, (Math.random() - 0.5) * 3], life: 0.9, max: 0.9, col: [0.75, 0.9, 1.0], size: 0.035, grav: 9 }); }
  // ---------- teias da aranha: espalhadas nas árvores perto dela; quem encosta fica preso e ela vem atacar ----------
  _makeWebs(c) { c.websMade = true; const w = this.world; const o = c.origin || [c.pos[0], c.pos[2]]; const trees = w.trees.filter((t) => !t.felled && Math.hypot(t.x - o[0], t.z - o[1]) < 28).slice(0, 9); let n = 0;
    for (const t of trees) { const a = Math.random() * 6.283; this.webs.push({ x: t.x + Math.cos(a) * 0.75, y: t.y + 1.0 + Math.random() * 0.8, z: t.z + Math.sin(a) * 0.75, rot: a + Math.PI / 2, s: 1.1 + Math.random() * 0.6, owner: c }); n++; }
    for (; n < 6; n++) { const a = Math.random() * 6.283, r = 5 + Math.random() * 14; const x = o[0] + Math.cos(a) * r, z = o[1] + Math.sin(a) * r; this.webs.push({ x, y: w.height(x, z) + 0.9, z, rot: Math.random() * 6.283, s: 1 + Math.random() * 0.5, owner: c }); } }
  _updateWebs(dt) { const P = this.player; if (P.webbed > 0) P.webbed -= dt;
    for (const c of this.creatures.list) if (c.kind === 'spidertank' && !c.dead && !c.websMade && c.origin) this._makeWebs(c);
    this.webs = this.webs.filter((wb) => !(wb.owner && !this.creatures.list.includes(wb.owner) && Math.hypot(wb.x - P.pos[0], wb.z - P.pos[2]) > 200));
    for (const wb of this.webs) { const r = 0.9 * wb.s;
      if (!P.dead && Math.abs(wb.x - P.pos[0]) < r && Math.abs(wb.z - P.pos[2]) < r && P.pos[1] < wb.y + r && P.pos[1] + 1.7 > wb.y - r) { P.webbed = Math.max(P.webbed || 0, 2.5); if (!wb.touched || this.env.elapsed - wb.touched > 4) { wb.touched = this.env.elapsed; this.audio.play('webHit'); this.ui.toast('🕸 Você encostou numa teia — a aranha sentiu!', 'warn'); const o = wb.owner; if (o && !o.dead) { o.lastSeen = [wb.x, wb.z]; o.state = 'chase'; o.alerted = 10; o.seenT = 0; } } }
      for (const c of this.creatures.list) { if (c.dead || c.def.robot || c.def.hostile === undefined && false) continue; if (c.def.robot) continue; if (Math.abs(wb.x - c.pos[0]) < r && Math.abs(wb.z - c.pos[2]) < r) { // animal preso vira casulo
          this.cocoons.push({ x: c.pos[0], y: c.pos[1], z: c.pos[2], rot: c.yaw }); this.creatures.remove(c); const o = wb.owner; if (o && !o.dead) { o.lastSeen = [wb.x, wb.z]; o.state = 'chase'; o.alerted = 6; } break; } } } }
  // ---------- C4 ----------
  c4Aim() { const P = this.player, e = this.cam.eye, t = this.cam.target; let d = [t[0] - e[0], t[1] - e[1], t[2] - e[2]]; const l = Math.hypot(...d); d = d.map((x) => x / l);
    const piv = [P.pos[0], P.pos[1] + 1.2, P.pos[2]]; const t0 = Math.max(0, (piv[0] - e[0]) * d[0] + (piv[1] - e[1]) * d[1] + (piv[2] - e[2]) * d[2]) - 0.6; const o = [e[0] + d[0] * t0, e[1] + d[1] * t0, e[2] + d[2] * t0];
    this.guns._dryTrace = true; const h = this.guns.trace(o, d, 6); this.guns._dryTrace = false;
    if (h && Math.hypot(h.p[0] - piv[0], h.p[1] - piv[1], h.p[2] - piv[2]) <= 3.5) return { ok: true, p: h.p, c: h.c || null, piece: h.col && h.col.piece, yaw: Math.atan2(d[0], d[2]) };
    const p = h ? h.p : [o[0] + d[0] * 3, o[1] + d[1] * 3, o[2] + d[2] * 3]; return { ok: false, p, yaw: Math.atan2(d[0], d[2]) }; }
  placeC4() { if (this.player.anim.busy || this.inv.count('c4') < 1) return; const a = this.c4Aim(); if (!a.ok) { this.ui.toast('Longe demais para colocar o C4 (máx 3,5 m)', 'warn'); this.audio.play('error'); return; }
    this.player.doAction('pickup', null); this.inv.remove('c4', 1); const b = { p: a.p.slice(), yaw: a.yaw, t: 4, beep: 0 }; if (a.c) { b.c = a.c; b.off = [a.p[0] - a.c.pos[0], a.p[1] - a.c.pos[1], a.p[2] - a.c.pos[2]]; }
    this.c4s.push(b); this.audio.play('c4arm'); this.ui.toast(a.c ? `🧨 C4 grudado em ${a.c.def.name}! 4 s — afaste-se` : '🧨 C4 armado: 4 s — afaste-se!', 'warn'); }
  _updateC4(dt) { for (const b of this.c4s) { if (b.c) { if (b.c.dead && b.c.deadTime > 0.1) { b.c = null; } else if (b.c) { b.p = [b.c.pos[0] + b.off[0], b.c.pos[1] + b.off[1], b.c.pos[2] + b.off[2]]; } }
      b.t -= dt; b.beep -= dt; if (b.beep <= 0) { b.beep = Math.max(0.1, b.t / 5); this.audio.play('beep', { at: b.p, max: 40 }); } if (b.t <= 0) { b.done = true; this.bigExplosion(b.p); } } this.c4s = this.c4s.filter((b) => !b.done); }
  // C4: a mais forte — 20 m: mata bichos e robôs (menos os muito resistentes), derruba árvores, quebra rochas, cava cratera e destrói construções de madeira
  bigExplosion(p) { const P = this.player; this.explode(p, null, { r: 20, dmg: 1500, playerDmg: 280, pr: 16, kind: 'c4', cause: 'explosão de C4', vis: 'c4', crater: [7.5, 2.4], wreck: 20 });
    for (const b of this.stream.buckets.values()) if (b.glass) for (const gp of b.glass) if (!gp.broken && Math.hypot(gp.x - p[0], gp.y - p[1], gp.z - p[2]) < 30) this.breakGlass(gp);
    this.cam.shake = Math.max(this.cam.shake, Math.max(0.3, 1.4 - Math.hypot(P.pos[0] - p[0], P.pos[2] - p[2]) / 30)); }
  playerDie(cause, finished) {
    const P = this.player; P.stats.hp = 0; P.die(finished); document.getElementById('fade').classList.remove('on'); if (finished) this.addBloodPool(P.pos[0], P.pos[2], P.yaw); this.state = 'dead'; this.build.cancel(); this.ui.closePanels(true); this.input.exitLock(); this.audio.play('death');
    // itens ficam numa mochila no local da morte
    const deadPack = this.equip.back; const items = this.inv.items.map((e) => (e.rad ? [e.id, e.qty, 1] : [e.id, e.qty])); for (const k of ['back', 'suit', 'backA', 'backB', ...CLOTH_SLOTS]) if (this.equip[k] && !String(this.equip[k]).startsWith('rags_')) items.push([this.equip[k], 1]); this.equip = this.freshEquip(); this._applyBack(); this.applyLook(); this.quick = Array(8).fill(null);
    { const gy = this.world.height(P.pos[0], P.pos[2]); const rot = P.yaw; this.graves.push({ x: P.pos[0] - Math.sin(rot) * 0.9, y: gy, z: P.pos[2] - Math.cos(rot) * 0.9, rot, name: (this.look && this.look.name) || '' });
      if (items.length) { this.drops.push({ items, x: P.pos[0], y: gy, z: P.pos[2], death: true, pack: deadPack || 'pack_impro', rot: rot + 0.6 }); this.inv.load([]); } }
    if (/aranha|teia/i.test(String(cause)) || P.webbed > 0) this.cocoons.push({ x: P.pos[0], y: P.pos[1], z: P.pos[2], rot: P.yaw, player: true });
    this.deathPos = P.pos.slice(); { const nm = (this.look && this.look.name) || 'Sobrevivente'; const c = String(cause || 'causa desconhecida').replace(/^atacado por /, ''); this.ui.feed && this.ui.feed(`<b>${nm}</b> foi morto por <b>${c}</b>`); }
    setTimeout(() => { if (this.state === 'dead') this.ui.showDeath(`Causa: ${cause}. ${items.length ? 'Sua mochila ficou no local da morte.' : ''}`); }, 2200);
  }
  // corpo zerado: vida e necessidades cheias, sem sangramento, veneno, frio, molhado ou qualquer efeito
  freshBody() { const P = this.player; P.stats = { hp: 100, hunger: 100, thirst: 100, energy: 100, stamina: 100, temp: 37, wet: 0 }; P.staminaLock = false; P.staminaDelay = 0; P.hurtFlash = 0;
    P.slide = null; P.crouch = false; P.climb = null; P.dust = []; P.vel = [0, 0, 0]; P.grapple = null; if (this.grapple) this.grapple.hook = null; this._coldWarn = false; }
  respawn() {
    const P = this.player; let sp = this.home; if (!sp) { const q = this.world.randomSpawn(); this._clearSpawnArea(q); sp = [q.x, this.world.height(q.x, q.z), q.z]; }
    P.revive(); P.setPosition(sp[0], this.world.height(sp[0], sp[2]) + 0.05, sp[2] + (this.home ? 1.8 : 0)); this.unstuckIfNeeded();
    this.freshBody(); this.cam.pivot = null;
    this.start(); this.ui.toast(this.home ? 'Você renasceu na sua base, novo em folha' : 'Você renasceu em outro lugar, novo em folha', 'info');
    if (this.deathPos) this.ui.toast('Recupere sua mochila no local da morte (marcada no chão)', 'info');
    this.saveGame(false);
  }
  unstuckIfNeeded() { const p = this.player.pos; if (this.physics.query(p[0], p[2], 1).some((c) => !c.ghost && !c.camOnly && !c.platform && c.y1 > p[1] + 0.5 && this.physics.insideXZ(c, p[0], p[2], 0.35))) this.unstuck(); }

  // ---------- Itens ----------
  // A mão usa o item que está no espaço selecionado da barra rápida (1–6); o item continua no espaço.
  syncHand() { const e = this.equip; if (e.hand && !e.debugHand && this.countAll(e.hand) <= 0) e.hand = null; }
  freshEquip() { return { hand: null, back: null, suit: null, backA: null, backB: null, hat: null, shirt: 'rags_shirt', vest: null, gloves: null, pants: 'rags_pants', shoes: 'tenis', dur: {}, _shoesGiven: true, _tenis: true }; }
  // quantidade de um item contando as armas nas costas
  countAll(id) { return this.inv.count(id) + (this.equip.backA === id ? 1 : 0) + (this.equip.backB === id ? 1 : 0); }
  // armas grandes (arco, fuzis, escopeta, sniper, machado, picareta, lança) vão direto para os 2 espaços das costas
  // armas grandes vão direto para as costas (se houver lado livre); devolve quantas foram
  _backFirst(id, n) { let k = 0; while (k < n && LARGE.has(id) && this.equip && !this._noBack && (!this.equip.backA || !this.equip.backB)) { const s = !this.equip.backA ? 'backA' : 'backB'; this.equip[s] = id; k++; this._autoQuick(id); this.ui.toast(`🎽 ${ITEMS[id].name} foi direto para as costas (${s === 'backA' ? 'lado direito' : 'lado esquerdo'})`, 'info'); } return k; }
  _toBack(id) { if (this._noBack || !LARGE.has(id) || !this.equip) return; const k = !this.equip.backA ? 'backA' : !this.equip.backB ? 'backB' : null; if (!k) return; if (this.inv.remove(id, 1)) { this.equip[k] = id; this.ui.toast(`🎽 ${ITEMS[id].name} foi para as costas (${k === 'backA' ? 'lado direito' : 'lado esquerdo'})`, 'info'); } }
  backToInv(k) { const id = this.equip[k]; if (!id) return; this._noBack = true; const n = this.inv.add(id, 1); this._noBack = false; if (n < 1) return this.ui.toast('Sem espaço no inventário', 'warn'); if (this.equip.hand === id && this.countAll(id) <= 0) this.equip.hand = null; this.equip[k] = null; this.audio.play('cloth'); }
  invToBack(i, k) { const s = this.inv.slots[i]; if (!s || !LARGE.has(s.id)) return this.ui.toast('Só armas grandes vão nas costas (arco, fuzil, escopeta, sniper, machado, picareta, lança)', 'warn'); if (this.equip[k]) { this.backToInv(k); if (this.equip[k]) return; } this.inv.takeSlot(i, 1); this.equip[k] = s.id; this.audio.play('cloth'); }
  armorVal() { let a = 0; for (const k of CLOTH_SLOTS) if (this.equip[k]) a += ITEMS[this.equip[k]].armor || 0; if (this.equip.suit) a += ITEMS.ratsuit.armor || 0; return Math.min(0.75, a); }
  warmVal() { let w = 0; for (const k of CLOTH_SLOTS) if (this.equip[k]) w += ITEMS[this.equip[k]].warm || 0; if (this.equip.suit) w += ITEMS.ratsuit.warm || 0; return w; }
  // desgaste das roupas (luvas por golpe, sapatos por metro andado); quando acaba, a peça se destrói
  wear(slot, amt) { const id = this.equip[slot]; if (!id) return; const max = ITEMS[id].dur || 1000; const d = (this.equip.dur[slot] ?? max) - amt; this.equip.dur[slot] = d;
    if (d <= 0) { this.equip[slot] = null; delete this.equip.dur[slot]; this._applyBack(); this.applyLook(); this.audio.play('cloth'); this.ui.toast(`🧵 ${ITEMS[id].name} se desgastou e rasgou`, 'warn'); } else if (d < max * 0.15 && !this.equip.dur['_w' + slot]) { this.equip.dur['_w' + slot] = 1; this.ui.toast(`⚠ ${ITEMS[id].name} quase rasgando`, 'warn'); } }
  // mãos: sem luvas, cortar/minerar/socar pode machucar e sangrar
  _handWear() { if (this.equip.gloves) return this.wear('gloves', 1); if (Math.random() < 0.1) { this.addStatus('bleed', 4); this.ui.toast('🩸 Sem luvas, suas mãos se machucaram! Faça luvas de fibra.', 'warn'); } }
  wearCloth(i) { const s = this.inv.slots[i]; if (!s) return; const it = ITEMS[s.id]; const k = it.slot; if (!k) return; if (this.equip.suit) return this.ui.toast('Tire a roupa R.A.T antes de vestir outra roupa', 'warn');
    const prev = this.equip[k], pdur = this.equip.dur[k]; this.inv.takeSlot(i, 1); this.equip[k] = null; this._applyBack(); this.equip[k] = s.id; this.equip.dur[k] = it.dur; delete this.equip.dur['_w' + k]; this._applyBack(); this.applyLook();
    if (prev) { this._noBack = true; if (this.inv.add(prev, 1) < 1) this.dropNear([[prev, 1]]); this._noBack = false; } void pdur; this.audio.play('cloth'); this.ui.toast(`${it.icon} ${it.name} vestido${it.pockets ? ` (+${it.pockets[0] * it.pockets[1]} bolsos)` : ''}`, 'ok'); }
  // barra rápida: 6 atalhos que apontam para tipos de item (arraste do inventário para associar)
  // barra rápida (8): 1 e 2 armas grandes (fuzis, escopetas, machados, picaretas, lanças, arco); 3 pistola ou faca; 4–8 o resto
  bindQuick(id, k) { if (!ITEMS[id]) return false; const q = this.quick, c = quickClass(id); if (k !== undefined && slotClass(k) !== c) { this.ui.toast(c === 'big' ? 'Armas grandes vão nos espaços 1 e 2' : c === 'side' ? 'Pistola ou faca vai no espaço 3' : 'Esse item vai nos espaços 4 a 8', 'warn'); return false; }
    const old = q.indexOf(id); if (k === undefined) { if (old >= 0) return true; k = q.findIndex((x, i) => !x && slotClass(i) === c); if (k < 0) { if (c === 'misc') return false; k = q.findIndex((x, i) => slotClass(i) === c); } } if (old >= 0) q[old] = null; q[k] = id; return true; }
  _autoQuick(id) { const t = ITEMS[id].type; if (!['tool', 'food', 'drink', 'medical'].includes(t) || this.quick.includes(id)) return; const c = quickClass(id); if (!this.quick.some((x, i) => !x && slotClass(i) === c)) return; if (c === 'misc' && t !== 'tool' && this.quick.slice(3).filter(Boolean).length >= 3) return; this.bindQuick(id); }
  hotbar(k) {
    const id = this.quick[k];
    if (!id || this.countAll(id) <= 0) { if (this.equip.hand) { this.equip.hand = null; this.audio.play('pickup'); } return; }
    if (this.inv.count(id) <= 0) { if (this.equip.hand === id) { this.equip.hand = null; this.audio.play('pickup'); return; } this.equip.hand = id; this.equip.debugHand = false; this.audio.play('pickup'); this.ui.toast(`${ITEMS[id].icon} ${ITEMS[id].name} na mão (das costas)`, 'ok'); return; }
    const i = this.inv.slots.findIndex((e) => e.id === id); const it = ITEMS[id];
    if (it.type === 'tool') { this.equip.debugHand = false; this.equip.hand = this.equip.hand === id ? null : id; this.audio.play('pickup'); if (this.equip.hand) this.ui.toast(`${it.icon} ${it.name} na mão`, 'ok'); }
    else this.useSlot(i);
  }
  useSlot(i) { const s = this.inv.slots[i]; if (!s) return; const it = ITEMS[s.id];
    if (it.type === 'tool') { this.equip.debugHand = false; this.equip.hand = this.equip.hand === s.id ? null : s.id; this.audio.play('pickup'); }
    else if (['armor', 'backpack', 'suit'].includes(it.type)) this.equipFromSlot(i);
    else if (it.type === 'attachment') this.attachItem(i);
    else if (['food', 'drink', 'medical'].includes(it.type)) this.consume(i); }
  // acessórios por arma: { scope, mag, sil }. Pente ausente da chave = o pente original da arma (vem encaixado); null = retirado
  att(gun) { return (this.attach[gun] = this.attach[gun] || {}); }
  // arma sem pente encaixado: modelo sem o carregador
  _gunMeshFor(id) { if (!GUNS[id] || this.hasMag(id) || !['rifle', 'sniper'].includes(GUNS[id].model)) return this.tools[id]; this._noMagM = this._noMagM || {}; return this._noMagM[id] || (this._noMagM[id] = this.renderer.createMesh(gunMesh(id, { noMag: true }))); }
  attOf(gun, slot) { const a = this.attach[gun] || {}; if (slot === 'mag') { if (!attSlots(gun).includes('mag')) return null; return a.mag === undefined ? magFor(gun) : a.mag; } return a[slot] || null; }
  hasMag(gun) { return !attSlots(gun).includes('mag') || !!this.attOf(gun, 'mag'); }
  // encaixa o acessório do espaço i do inventário na arma (padrão: a da mão)
  attachItem(i, gun = this.equip.hand) {
    const s = this.inv.slots[i]; if (!s || ITEMS[s.id].type !== 'attachment') return false; const G = gun && GUNS[gun];
    if (!G) { this.ui.toast('Empunhe a arma (ou use Verificar com o botão direito nela) para encaixar', 'warn'); return false; }
    const slot = fits(gun, s.id); if (!slot) { this.ui.toast(`${ITEMS[gun].name} não aceita ${ITEMS[s.id].name}`, 'warn'); return false; }
    const prev = this.attOf(gun, slot); if (slot === 'mag' && prev) this._unloadMag(gun);
    this.inv.takeSlot(i, 1); this.att(gun)[slot] = s.id; if (prev && this.inv.add(prev, 1) < 1) this.dropNear([[prev, 1]]); this.audio.play('magIn');
    this.ui.toast(`${ITEMS[s.id].name} encaixado no ${ITEMS[gun].name}${slot === 'scope' ? '. Segure o botão direito para mirar; roda ajusta o zoom.' : slot === 'mag' ? ' (vazio: recarregue com R)' : ''}`, 'ok'); return true;
  }
  attachScope(i) { return this.attachItem(i); }
  // tira o acessório: volta para o inventário (o pente devolve as balas que estavam nele)
  detachAtt(gun, slot) { const id = this.attOf(gun, slot); if (!id) return false; if (this.inv.room(id) <= 0) { this.ui.toast('Inventário cheio', 'warn'); return false; }
    if (slot === 'mag') this._unloadMag(gun); this.inv.add(id, 1); this.att(gun)[slot] = null; if (slot !== 'mag') delete this.att(gun)[slot]; this.audio.play(slot === 'mag' ? 'magOut' : 'pickup'); this.ui.toast(`${ITEMS[id].name} retirado`, 'ok'); return true; }
  detachScope(gun) { return this.detachAtt(gun, 'scope'); }
  _unloadMag(gun) { const n = this.guns.mags[gun] || 0; if (n > 0) { const G = GUNS[gun]; const k = this.inv.add(G.ammo, n); if (k < n) this.dropNear([[G.ammo, n - k]]); } this.guns.mags[gun] = 0; if (this.guns.reloading && this.guns.reloading.id === gun) this.guns.reloading = null; }
  // deixa itens no chão ao lado do jogador (um saco de itens)
  dropNear(list, label) { if (!list.length) return; const P = this.player, a = P.yaw + Math.PI / 2; const x = P.pos[0] + Math.sin(a) * 0.9, z = P.pos[2] + Math.cos(a) * 0.9; const [gy] = this.physics.ground(x, z, 0.2, P.pos[1] + 0.5, 0.6);
    this.drops.push({ items: list.map((o) => (Array.isArray(o) ? o : o.rad ? [o.id, o.qty, 1] : [o.id, o.qty])), x, y: gy, z, bag: true }); if (label) this.ui.toast(label, 'warn'); }
  equipFromSlot(i) {
    const s = this.inv.slots[i]; if (!s) return; const it = ITEMS[s.id];
    if (it.slot) return this.wearCloth(i);
    if (it.type === 'backpack') { if (this.equip.suit) return this.ui.toast('A roupa R.A.T já tem mochila própria', 'warn'); const prev = this.equip.back; this.inv.takeSlot(i, 1); this.equip.back = s.id; this._applyBack(); if (prev && this.inv.add(prev, 1) < 1) this.dropNear([[prev, 1]]); this.audio.play('cloth'); this.ui.toast(`${it.name}: ${ITEMS[s.id].slots} espaços`, 'ok'); return; }
    if (it.type === 'suit') return this.wearSuit(i);
    if (it.type === 'tool') { this.equip.debugHand = false; this.equip.hand = s.id; this.audio.play('pickup'); this.ui.toast(`${it.icon} ${it.name} na mão`, 'ok'); }
  }
  // roupa R.A.T: as outras roupas e a mochila (com o que tinha dentro) caem no chão perto do jogador
  wearSuit(i) {
    const s = this.inv.slots[i]; if (!s || this.equip.suit) return; this.inv.takeSlot(i, 1); const fall = [];
    for (const k of CLOTH_SLOTS) if (this.equip[k]) { for (const o of this.inv.clearContainer(k)) fall.push(o.rad ? [o.id, o.qty, 1] : [o.id, o.qty]); fall.push([this.equip[k], 1]); this.equip[k] = null; }
    if (this.equip.back) { for (const o of this.inv.clearContainer('pack')) fall.push(o.rad ? [o.id, o.qty, 1] : [o.id, o.qty]); fall.push([this.equip.back, 1]); this.equip.back = null; }
    this.equip.suit = 'ratsuit'; this._applyBack(); this.applyLook(); this.audio.play('cloth');
    if (fall.length) this.dropNear(fall); this.ui.toast(`☣️ Roupa R.A.T vestida${fall.length ? ' — a roupa e a mochila ficaram no chão ao seu lado' : ''}. Protegido da névoa tóxica e da radiação.`, 'ok');
  }
  removeSuit() { if (!this.equip.suit) return; this.equip.suit = null; this._applyBack(); this.applyLook(); if (this.inv.add('ratsuit', 1) < 1) this.dropNear([['ratsuit', 1]]); this.audio.play('cloth'); this.ui.toast('Roupa R.A.T removida', 'info'); }
  // grade do inventário: bolsos + mochila (ou a mochila da R.A.T); o que não couber cai no chão
  _applyBack() {
    const list = [{ key: 'pockets', name: 'Inventário', w: POCKETS[0] * (this._bigPockets ? 2 : 1), h: POCKETS[1] * (this._bigPockets ? 2 : 1) }];
    for (const k of CLOTH_SLOTS) { const id = this.equip[k], pk = id && ITEMS[id].pockets; if (pk) list.push({ key: k, name: `${ITEMS[id].name}`, w: pk[0], h: pk[1] }); }
    const pk = this.equip.suit || this.equip.back; if (pk && PACKS[pk]) list.push({ key: 'pack', name: ITEMS[pk].name, w: PACKS[pk][0], h: PACKS[pk][1] });
    if (this.playerAssets && this.playerAssets.skel) this.applyLook();
    const same = this.inv.conts.length === list.length && this.inv.conts.every((c, k) => c.key === list[k].key && c.w === list[k].w && c.h === list[k].h); if (same) return;
    const over = this.inv.setContainers(list); this.syncHand();
    if (over.length) this.dropNear(over, 'Itens que não couberam foram deixados no chão');
  }
  unequip(slot) {
    if (slot === 'hand') { this.equip.hand = null; this.equip.debugHand = false; this.audio.play('pickup'); return; }
    if (slot === 'suit') return this.removeSuit();
    if (slot === 'backA' || slot === 'backB') return this.backToInv(slot);
    const id = this.equip[slot]; if (!id) return;
    if (CLOTH_SLOTS.includes(slot)) { this.equip[slot] = null; delete this.equip.dur[slot]; this._applyBack(); this.applyLook(); this._noBack = true; if (this.inv.add(id, 1) < 1) this.dropNear([[id, 1]], 'Sem espaço: a roupa ficou no chão'); this._noBack = false; this.audio.play('cloth'); return; }
    if (slot === 'back') { this.equip.back = null; this._applyBack(); if (this.inv.add(id, 1) < 1) this.dropNear([[id, 1]], 'Sem espaço: a mochila ficou no chão'); this.audio.play('cloth'); return; }
    if (this.inv.add(id, 1) < 1) { this.ui.toast('Inventário cheio', 'warn'); return; } this.equip[slot] = null; this.audio.play('cloth');
  }
  // usado pelos testes: põe a ferramenta na mão (mesmo sem espaço no inventário)
  debugEquip(id) { if (!id) { this.equip.hand = null; this.equip.debugHand = false; return; } if (this.inv.count(id) <= 0) this.inv.add(id, 1); this.equip.hand = id; this.equip.debugHand = this.inv.count(id) <= 0; }
  // comer, beber e tomar remédio com animação e som (frasco: desrosqueia, despeja, engole, rosqueia; cartela: destaca e engole)
  consume(i) {
    const s = this.inv.slots[i]; if (!s) return; const it = ITEMS[s.id]; const P = this.player, st = P.stats;
    const overfull = it.type === 'food' && st.hunger >= 99; let after = null; // comer de barriga cheia: vomita e desmaia
    if (it.type === 'drink' && st.thirst > 97) return this.ui.toast('Você não está com sede', 'info');
    const cures = (it.cure || []).some((k) => (st[k] || 0) > 0.5); if (it.type === 'medical' && !cures && !(it.heal && st.hp < 100) && !(it.energy && st.energy < 95)) return this.ui.toast(it.pill || it.bottle ? 'Você não precisa desse remédio agora' : 'Vida já está cheia', 'info');
    if (P.anim.action && P.anim.action.clip === P.clips.cough) P.anim.action = null; // tossir não impede de tomar o remédio
    if (P.anim.busy || this._consuming) return;
    const id = s.id, rad = !!s.rad; this.inv.takeSlot(i, 1);
    const clip = it.type === 'drink' ? 'drink' : it.type === 'food' ? 'eat' : it.bottle ? 'pillBottle' : it.pill ? 'blister' : 'use';
    P.prop = clip === 'drink' ? 'bottle' : clip === 'eat' ? (id === 'canned' ? 'can' : 'food') : clip === 'pillBottle' ? 'pillbottle' : clip === 'blister' ? 'blister:' + id : null; this._consuming = true;
    const ok = P.doAction(clip, (n) => {
      if (n === 'bite') this.audio.play('bite'); else if (n === 'gulp') this.audio.play('gulp'); else if (n === 'unscrew' || n === 'screw') this.audio.play('unscrew'); else if (n === 'shake') this.audio.play('pillShake'); else if (n === 'pop') this.audio.play('blister'); else if (n === 'swallow') this.audio.play('swallow');
      if (n !== 'apply') return;
      if (it.type === 'food') {
        if (it.human && !st.kuru) { st.kuru = 1; this.ui.toast('🧠 Você contraiu KURU por comer carne humana: tremores, a mira não fica firme e agora só carne humana para no estômago.', 'warn'); }
        else if (st.kuru && !it.human) { after = () => this.vomit('🤢 Com kuru o corpo não aceita outra comida — você vomitou (perdeu metade da fome e da sede).'); return; }
        if (overfull) after = () => this.vomit('🤢 Você comeu demais e vomitou…', () => this.faintPlayer(10, '💫 Você desmaiou de tanto comer'));
        if (it.burnt && !st.burntSick) st.burntSick = this._clock() + 10 / 1440;
      }
      if (it.food) st.hunger = Math.min(100, st.hunger + it.food); if (it.water) st.thirst = Math.min(100, st.thirst + it.water); if (it.heal) st.hp = Math.min(100, st.hp + it.heal); if (it.energy) st.energy = Math.min(100, st.energy + it.energy);
      if (it.cure) for (const k of it.cure) if ((st[k] || 0) > 0) { if (k === 'rad') { st.rad = Math.max(0, st.rad - 60); if (st.rad > 0) { this.ui.toast(st.rad >= 50 ? `☢️ Radiação reduzida para ${Math.round(st.rad)}% — ainda contaminado, tome mais um` : `☢️ Contaminação curada (${Math.round(st.rad)}% restante, o corpo elimina o resto)`, st.rad >= 50 ? 'warn' : 'ok'); continue; } } else st[k] = 0; if (k === 'fever') st.infect = 0; if (k === 'hypo') st.temp = Math.max(st.temp ?? 37, 36.6);
        this.ui.toast({ bleed: '🩸 Sangramento estancado', poison: '🤢 Intoxicação curada', tox: '🤢 Toxinas eliminadas', fever: '🌡️ Febre curada', fatigue: '⚡ Fadiga curada', hypo: '❄️ Hipotermia curada', breath: '🫁 Respiração normal', rad: '☢️ Radiação eliminada' }[k] || 'Curado', 'ok'); }
      if (it.cure && it.cure.includes('hypo')) { st.breath = 0; st.temp = Math.max(st.temp ?? 37, 36.6); }
      if (rad) { this.addStatus('rad', 15); this.ui.toast('☢️ Você consumiu algo contaminado!', 'warn'); }
      if (it.risk && Math.random() < it.risk) { this.addStatus('poison', 25); st.thirst = Math.max(0, st.thirst - 10); this.ui.toast(it.riskMsg || '🤢 Intoxicação! Asse a carne na fogueira.', 'warn'); }
    }, { onEnd: () => { this._consuming = false; if (after) { const f = after; after = null; setTimeout(() => f(), 0); } } });
    if (!ok) { this._consuming = false; P.prop = null; this.inv.add(id, 1, { rad }); return; }
    this.ui.toast(`${it.icon} ${it.type === 'drink' ? 'Bebendo' : it.type === 'food' ? 'Comendo' : 'Tomando'} ${it.name}…`, 'info');
  }
  dropFromSlot(i, qty) {
    const t = this.inv.takeSlot(i, qty); if (!t) return; const P = this.player; const f = [Math.sin(P.yaw), Math.cos(P.yaw)];
    this.dropItem(t.id, t.qty, [P.pos[0] + f[0] * 0.8, P.pos[1], P.pos[2] + f[1] * 0.8]); this.ui.toast(`Descartou ${t.qty}× ${ITEMS[t.id].name}`, 'info');
  }
  dropItem(id, qty, p) {
    const near = this.drops.find((d) => Math.hypot(d.x - p[0], d.z - p[2]) < 1.2 && !d.death);
    const [gy] = this.physics.ground(p[0], p[2], 0.2, p[1] + 0.5, 0.6);
    if (near) { const e = near.items.find((it) => it[0] === id); if (e) e[1] += qty; else near.items.push([id, qty]); } else this.drops.push({ items: [[id, qty]], x: p[0], y: gy, z: p[2] });
  }
  craft(r) {
    if (!this.hasSkillFor(r.id)) return this.ui.toast(`🔒 Precisa da habilidade ${this.skillName(SKILL_OF[r.id])} — encontre o livro`, 'warn');
    if (!this.inv.has(r.cost)) return this.ui.toast('Materiais insuficientes', 'warn');
    if (r.station === 'bench' && !this.nearPiece('bench', 3.5)) return this.ui.toast('Precisa estar perto de uma bancada', 'warn');
    if (r.station === 'fire' && !this.nearPiece('campfire', 3, (p) => p.lit)) return this.ui.toast('Precisa estar perto de uma fogueira acesa', 'warn');
    if (this.inv.room(r.out) < r.n && !(LARGE.has(r.out) && (!this.equip.backA || !this.equip.backB))) { // tenta liberar espaço com os ingredientes
      const tmp = new GridInventory(); tmp.conts = this.inv.conts; tmp.load(this.inv.serialize()); tmp.pay(r.cost); if (tmp.room(r.out) < r.n) return this.ui.toast('Inventário cheio', 'warn'); }
    this.inv.pay(r.cost); if (LARGE.has(r.out)) this.give(r.out, r.n); else this.inv.add(r.out, r.n); this.audio.play(r.station === 'fire' ? 'fireLight' : 'craft'); this.ui.toast(`${ITEMS[r.out].icon} ${ITEMS[r.out].name} ${r.station === 'fire' ? 'pronto' : 'fabricado'}`, 'ok');
    if (['tool', 'armor', 'food', 'drink', 'medical'].includes(ITEMS[r.out].type) && !this._hintCraft) { this._hintCraft = true; this.ui.toast('O item foi para o inventário. Arraste-o para a barra rápida (1–6) e aperte a tecla para usar.', 'info'); }
  }
  // tudo que é pego dentro da zona tóxica fica contaminado por radiação
  giveLoot(list, at) { let got = 0; for (const [id, q] of list) if (q > 0) { this.give(id, q, undefined, at); got++; } return got; }
  // mochila achada sem nenhuma nas costas: veste direto (não precisa caber nos bolsos)
  // mochila coletada: veste sozinha se não tiver nenhuma ou se ela for maior que a atual (a antiga vai para o inventário/chão)
  _autoWear(id) { const it = ITEMS[id]; if (it.type !== 'backpack' || this.equip.suit) return false; const cur = this.equip.back; if (cur && (ITEMS[cur].slots || 0) >= (it.slots || 0)) return false;
    this.equip.back = id; this._applyBack(); if (cur) { this._noBack = true; if (this.inv.add(cur, 1) < 1) this.dropNear([[cur, 1]], `${ITEMS[cur].name} ficou no chão (sem espaço)`); this._noBack = false; }
    this.audio.play('cloth'); this.ui.toast(`🎒 ${it.name} vestida: ${it.slots} espaços${cur ? ` (era ${ITEMS[cur].name}, ${ITEMS[cur].slots})` : ''}`, 'ok'); return true; }
  betterPack(id) { const it = ITEMS[id]; if (!it || it.type !== 'backpack' || this.equip.suit) return false; const cur = this.equip.back; return !cur || (ITEMS[cur].slots || 0) < (it.slots || 0); }
  // objeto cortante (faca, machado, lança): na mão, nas costas ou no inventário
  // colhendo fibras do chão às vezes aparece uma minhoca (isca de pesca)
  _worm() { if (Math.random() < 0.3 && this.inv.room('bait_worm') > 0) { this.give('bait_worm', 1, true); this.ui.toast('🪱 Achou uma minhoca na terra (isca de pesca)', 'info'); } }
  // corta o peixe do espaço i em filés com algo afiado
  fillet(i) { const s = this.inv.slots[i]; if (!s || !ITEMS[s.id].fish) return false; const b = this.blade(); if (!b) { this.ui.toast('Precisa de uma faca (ou machado) para tirar os filés', 'warn'); return false; }
    const it = ITEMS[s.id], n = it.fish; this.inv.takeSlot(i, 1); const k = this.inv.add('fish_fillet', n); if (k < n) this.dropNear([['fish_fillet', n - k]]); this.audio.play('swing', { vol: 0.5 }); this.audio.play('eat', { vol: 0.3 }); this.ui.toast(`🔪 ${it.name} cortado: +${n} ${ITEMS.fish_fillet.name}${n > 1 ? 's' : ''}`, 'ok'); return true; }
  blade() { for (const id of ['knife', 'scrapknife', 'axe', 'scrapaxe', 'shockspear', 'spear', 'scrapspear']) if (this.countAll(id) > 0) return id; return null; }
  // retalhos que uma roupa rende (menos se estiver gasta)
  ragsOf(id) { const it = ITEMS[id]; if (!it || it.type !== 'clothing' || /armor|helmet|boots|nvg|rat/.test(id) || it.slot === 'shoes' && id !== 'fibershoes') return 0; const base = { shirt: 3, pants: 3, vest: 2, hat: 1, gloves: 1, shoes: 1 }[it.slot] || 2; return base + (/^mil|parka/.test(id) ? 1 : 0); }
  // corta a roupa do espaço i da mochila em retalhos (pano)
  cutCloth(i) { const s = this.inv.slots[i]; if (!s) return false; const n = this.ragsOf(s.id), b = this.blade(); if (!n) { this.ui.toast('Isso não dá para cortar em retalhos', 'warn'); return false; } if (!b) { this.ui.toast('Precisa de um objeto cortante (faca ou machado)', 'warn'); return false; }
    const name = ITEMS[s.id].name; this.inv.takeSlot(i, 1); const k = this.inv.add('cloth', n); if (k < n) this.dropNear([['cloth', n - k]]); this.audio.play('cloth'); this.audio.play('swing', { vol: 0.5 }); this.ui.toast(`✂ ${name} cortada com ${ITEMS[b].name}: +${n} 🧵 Pano (retalhos)`, 'ok'); return true; }
  // aparelhos que aceitam a bateria (célula): hoje o óculos de visão noturna (na cabeça ou na mochila)
  cellTargets() { const out = []; if (this.equip.hat === 'nvg') out.push({ label: '🥽 Óculos de visão noturna (na cabeça)', id: 'nvg', on: true, has: this.equip.nvgCell != null }); else if (this.countAll('nvg') > 0) out.push({ label: '🥽 Óculos de visão noturna (na mochila)', id: 'nvg', on: false, has: this.equip.nvgCell != null }); return out; }
  give(id, qty, label, at) {
    const p = at ? [at.x ?? at[0], 0, at.z ?? at[2]] : this.player.pos; const rad = this.world.toxicAt(p[0], p[2]) > 0.15 || (at && at.toxic);
    if (this._autoWear(id)) { qty--; if (!qty) return 1; }
    // armas grandes vão direto para as costas, mesmo sem espaço no inventário
    while (qty > 0 && LARGE.has(id) && this.equip && !this._noBack && (!this.equip.backA || !this.equip.backB)) { const k = !this.equip.backA ? 'backA' : 'backB'; this.equip[k] = id; qty--; this._autoQuick(id); this.ui.toast(`🎽 ${ITEMS[id].name} foi para as costas (${k === 'backA' ? 'lado direito' : 'lado esquerdo'})`, 'info'); }
    if (!qty) return 1;
    const n = this.inv.add(id, qty, { rad }); if (n < qty) { this.dropItem(id, qty - n, this.player.pos); this.ui.toast(`Inventário cheio — ${qty - n}× ${ITEMS[id].name} caiu no chão`, 'warn'); }
    if (n > 0 && label !== false) this.ui.toast(`+${n} ${ITEMS[id].icon} ${ITEMS[id].name}${rad ? ' ☢ contaminado' : ''}`, rad ? 'warn' : 'ok'); return n;
  }
  nearPiece(type, d, filt) { const p = this.player.pos; return this.build.pieces.find((q) => q.type === type && Math.hypot(q.x - p[0], q.z - p[2]) < d && (!filt || filt(q))); }
  nearFire(x, z, d) { for (const q of this.build.pieces) if (q.type === 'campfire' && q.lit && Math.hypot(q.x - x, q.z - z) < d) { this.lastFire = [q.x, q.z]; return true; } return false; }
  nearBase(x, z, d) { return this.build.pieces.some((q) => (q.type === 'tent' || q.type === 'shelter') && Math.hypot(q.x - x, q.z - z) < d); }
  surfaceAt(p) {
    if (this.player.platform && this.player.platform.piece) return 'wood';
    const h = this.world.height(p[0], p[2]); if (h < WATER + 0.1) return 'water'; if (this.world.inRuins(p[0], p[2]) || this.player.inCave) return 'stone';
    if (h < 2.8) return 'sand'; if (h > 74) return 'snow'; if (this.world.normal(p[0], p[2])[1] < 0.75) return 'stone'; return 'grass';
  }

  // ---------- Interação ----------
  _targets() {
    const P = this.player, p = P.pos, w = this.world; const f = [Math.sin(this.cam.yaw), Math.cos(this.cam.yaw)]; const fy = [Math.sin(P.yaw), Math.cos(P.yaw)];
    let best = null, bestS = 1e9, tool = null, toolS = 1e9;
    const score = (x, z, maxD, y) => { const dx = x - p[0], dz = z - p[2]; const d = Math.hypot(dx, dz); if (d > maxD) return null; if (y !== undefined && Math.abs(y - p[1]) > 2.2) return null;
      const dot = d < 0.6 ? 1 : (dx * f[0] + dz * f[1]) / d; const dot2 = d < 0.6 ? 1 : (dx * fy[0] + dz * fy[1]) / d; const fd = Math.max(dot, dot2); if (fd < 0.2) return null; return d - fd * 1.2; };
    const consider = (o, kind, x, z, maxD, y) => { const s = score(x, z, maxD, y); if (s !== null && s < bestS) { bestS = s; best = { o, kind }; } };
    for (const c of this.physics.query(p[0], p[2], 3.5)) {
      if (c.tree && !c.tree.felled) { const s = score(c.x, c.z, 1.6 + c.r); if (s !== null && s < toolS) { toolS = s; tool = { o: c.tree, kind: 'tree' }; } }
      if (c.rock && !c.rock.mined) { const s = score(c.x, c.z, 1.5 + c.r, c.rock.y); if (s !== null && s < toolS) { toolS = s; tool = { o: c.rock, kind: 'rock' }; } }
      if (c.crate && !c.crate.looted) consider(c.crate, 'crate', c.x, c.z, 2.0, c.crate.y);
      if (c.car && c.car.loot && !c.car.looted) consider(c.car, 'car', c.x, c.z, Math.max(c.hx, c.hz) + 1.4, c.car.y);
      if (c.car && this.equip.hand === 'jerrycan' && !c.car.fuelTaken) consider(c.car, 'carfuel', c.x, c.z, Math.max(c.hx, c.hz) + 1.4, c.car.y);
      if (c.hdoor && !c.ghost) consider(c.hdoor, 'hdoor', c.x, c.z, 1.9, c.hdoor.y);
    }
    for (const k of ['stick', 'stone', 'fiber', 'mushroom', 'crystal']) for (const c of near(this.groups[k], p, 3)) if (!c.taken) consider(c, 'pickup', c.x, c.z, 2.0, c.y);
    for (const c of near(this.groups.bushB, p, 3)) consider(c, 'bush', c.x, c.z, 2.1, c.y);
    for (const d of this.drops) consider(d, 'drop', d.x, d.z, 2.0, d.y);
    for (const o of this.world.specials) if (!o.taken && Math.abs(o.x - p[0]) < 3 && Math.abs(o.z - p[2]) < 3) consider(o, 'special', o.x, o.z, 2.0, o.y);
    { const v = this.vehicles.near(p, 2.6); if (v) { const s = this.vehicles.near(p, 2.6) ? 0.5 : 9; if (s < bestS) { bestS = s; best = { o: v, kind: 'vehicle' }; } } const q = this.vehicles.nearPump(p); if (q) consider(q, 'pump', q.x, q.z, 2.2, q.y); }
    for (const b of this.books || []) if (!b.taken && Math.abs(b.x - p[0]) < 3 && Math.abs(b.z - p[2]) < 3) { const sc = score(b.x, b.z, 2.0, b.y); if (sc !== null && sc - 1.5 < bestS) { bestS = sc - 1.5; best = { o: b, kind: 'book' }; } }
    for (const hv of this.world.hives) if (hv.honey && Math.abs(hv.x - p[0]) < 4 && Math.abs(hv.z - p[2]) < 4 && hv.y - p[1] < 5) consider(hv, 'hive', hv.x, hv.z, 2.6);
    for (const l of this.logs) { consider(l, 'log', l.x, l.z, 2.4, l.y); const s = score(l.x, l.z, 2.4, l.y); if (s !== null && s < toolS) { toolS = s; tool = { o: l, kind: 'log' }; } }
    for (const a of this.arrows) if (a.stuck && a.arrow) consider(a, 'arrow', a.p[0], a.p[2], 2.2, a.p[1]);
    for (const c of this.creatures.list) if (c.dead && !c.looted) consider(c, 'corpse', c.pos[0], c.pos[2], 2.4, c.pos[1]);
    for (const q of this.build.pieces) if ((['campfire', 'tent', 'shelter', 'door', 'chest', 'chest_wi', 'chest_iron', 'cabinet', 'bench', 'collector', 'composter', 'planter', 's_doorway', 's_hatch', 'flag'].includes(q.type) || q.data) && !(STR.STYPES[q.type] && q.type !== 's_doorway' && q.type !== 's_hatch')) consider(q, 'piece', q.x, q.z, q.type === 'shelter' || q.type === 'waterwheel' ? 3 : 2.4, q.y);
    if (!P.ladder) { const L = w.ladderNear(p[0], p[2], p[1], 1.5); if (L && Math.abs(p[1] - L.y0) < 1.2) { if (0.2 < bestS) { bestS = 0.2; best = { o: L, kind: 'ladder' }; } }
      else for (const L2 of w.ladders) if (Math.hypot(L2.ex - p[0], L2.ez - p[2]) < 1.6 && Math.abs(p[1] - L2.y1) < 0.8) { if (0.2 < bestS) { bestS = 0.2; best = { o: L2, kind: 'ladder', top: true }; } break; } }
    // água à frente
    if (p[1] < WATER + 2.4) for (const d of [0.4, 1.0, 1.6, 2.2]) { const x = p[0] + fy[0] * d, z = p[2] + fy[1] * d; if (w.height(x, z) < WATER - 0.15) { const s = d * 0.5 - 0.9; if (s < bestS) { bestS = s; best = { kind: 'water', salt: w.isSalt(x, z) }; } break; } }
    if (!best && P.swimming) best = { kind: 'water', salt: w.isSalt(p[0], p[2]) };
    if (!best) for (const d of [0.6, 1.3, 2.0]) { const x = p[0] + fy[0] * d, z = p[2] + fy[1] * d; const wy = w.pondWater(x, z); if (wy !== null && Math.abs(wy - p[1]) < 2.2) { best = { kind: 'water', salt: false, pond: true }; break; } }
    // comida na grelha da fogueira: pega mirando nela (a mira tem prioridade sobre a fogueira)
    { const e = this.cam.eye, tg = this.cam.target; const fw = [tg[0] - e[0], tg[1] - e[1], tg[2] - e[2]]; const fl = Math.hypot(...fw) || 1; let bestA = 0.13;
      for (const q of this.build.pieces) { if (q.type !== 'campfire' || !q.data || !Array.isArray(q.data.cook) || Math.hypot(q.x - p[0], q.z - p[2]) > 2.6) continue;
        q.data.cook.forEach((c, k) => { if (!c) return; const fp = FIRE.foodPos(q, k); const v = [fp[0] - e[0], fp[1] - e[1], fp[2] - e[2]]; const vl = Math.hypot(...v) || 1; const a = Math.acos(clamp((v[0] * fw[0] + v[1] * fw[1] + v[2] * fw[2]) / (vl * fl), -1, 1)); if (a < bestA) { bestA = a; best = { o: q, k, kind: 'firefood' }; } }); } }
    return { best, tool };
  }
  _interactPrompt() {
    if (this.build.mode || this.ui.anyOpen || this.player.dead || this.player.fainted > 0) { this.ui.prompt(null); return; }
    const { best, tool } = this._targets(); this._cur = best; this._curTool = tool;
    const k = (key, txt, sub = '') => `<kbd>${this.input.touchActive ? (key === 'E' ? '✋' : '⚔') : key}</kbd>${txt}${sub ? `<span class="sub">${sub}</span>` : ''}`;
    const parts = [];
    if (best) {
      const o = best.o; let t = '';
      switch (best.kind) {
        case 'pickup': t = { stick: 'Coletar galho', stone: 'Pegar pedra', fiber: 'Colher fibra vegetal', mushroom: 'Colher cogumelo', crystal: 'Pegar cristal' }[o.kind]; break;
        case 'bush': t = o.berries ? 'Colher frutas e folhas' : (o.leafT > this.env.elapsed ? '' : 'Colher folhas'); break;
        case 'hive': t = 'Coletar mel'; parts.push(this.equip.hand === 'torch' ? '<span class="sub">🔥 abelhas calmas — mas vão atacar quando você pegar</span>' : '<span class="sub">⚠ as abelhas vão atacar · segure uma tocha para acalmá-las</span>'); break;
        case 'crate': t = o.furn ? FURN_NAMES[o.furn] || 'Revistar' : o.kind === 'milcrate' ? 'Abrir caixa militar' : o.kind === 'tentbox' ? FURN_NAMES.tentbox : 'Vasculhar caixa'; break; case 'special': t = 'Pegar Roupa R.A.T (dobrada)'; break; case 'book': t = `Pegar Livro de ${this.skillName(o.skill)}`; parts.push('<span class="sub">📖 livro raro</span>'); break; case 'car': t = 'Revistar carro'; break; case 'drop': t = o.death ? 'Recuperar mochila (túmulo)' : o.box ? 'Lootear caixa da aranha' : 'Pegar itens'; break; case 'log': t = 'Coletar tronco'; break; case 'arrow': t = 'Recolher flecha'; break;
        case 'corpse': if (o.npc) { const blade = this.equip.hand && ['knife', 'axe'].includes(ITEMS[this.equip.hand].tool); t = blade ? 'Picotar o corpo' : 'Revistar o corpo'; parts.push(`<span class="sub">${blade ? 'segure E: sobra a mochila, roupas, armas, carne e ossos' : 'pega a arma e a munição · com faca ou machado na mão dá para picotar'}</span>`); } else t = o.def.robot ? 'Desmontar androide' : 'Coletar carne'; break;
        case 'water': t = best.salt ? 'Beber água do mar (salgada!)' : 'Beber água contaminada'; if (!best.salt) parts.push(`<span class="sub">⚠ toda água natural é contaminada: pode dar infecção — ferva na fogueira</span>`, k('F', 'Encher garrafa', '(água suja)')); if (!best.salt && this.inv.contaminated()) t = this.inv.count('soap') > 0 ? `Lavar ${this.inv.contaminated()} item(ns) contaminado(s) (gasta 1 sabonete)` : t + ' · ☢ precisa de sabonete líquido para lavar a radiação'; break;
        case 'hdoor': t = o.open ? 'Fechar porta' : 'Abrir porta'; break;
        case 'ladder': t = best.top ? 'Descer a escada' : 'Subir a escada'; parts.push('<span class="sub">W/S sobe e desce · Shift rápido (escorrega na descida) · Espaço solta</span>'); break;
        case 'vehicle': { const VS = this.vehicles, T = VEH.VTYPES[o.type], nm = VEH.vName(o), pct = Math.round(o.fuel / T.tank * 100);
          if (this.equip.hand === 'jerrycan') { const cap = VS.jerryCap(); if (this.jerryFuel > 0.2 && o.fuel < T.tank - 0.3) t = `Abastecer ${nm}`; else if (o.fuel > 0.2 && this.jerryFuel < cap - 0.2) t = `Retirar combustível de ${nm}`; else t = o.fuel >= T.tank - 0.3 ? 'Tanque cheio' : 'Galão vazio';
            parts.push(`<span class="sub">⛽ galão ${this.jerryFuel.toFixed(1)}/${cap} L · tanque ${pct}%</span>`); if (o.fuel > 0.2 && this.jerryFuel < cap - 0.2 && t.startsWith('Abastecer')) parts.push(k('F', 'Retirar combustível')); }
          else if (VS.complete(o)) { t = `Dirigir ${nm}`; parts.push(`<span class="sub">⛽ ${pct}%</span>`); }
          else { t = `Montar ${nm}`; parts.push(`<span class="sub">faltam: ${VS.missing(o).join(', ')}</span>`); } break; }
        case 'pump': t = this.equip.hand === 'jerrycan' ? `Encher o galão na bomba` : 'Bomba de combustível'; parts.push(`<span class="sub">${this.equip.hand === 'jerrycan' ? `⛽ bomba ${Math.round(o.fuel)} L · galão ${this.jerryFuel.toFixed(1)}/${this.vehicles.jerryCap()} L` : 'segure um galão na mão para encher'}</span>`); break;
        case 'carfuel': t = 'Retirar combustível do carro abandonado'; break;
        case 'piece': t = o.type === 'planter' ? this._planterText(o, parts, k) : o.type === 'collector' ? this._collectorText(o, parts) : o.type === 'composter' ? this._composterText(o, parts) : { campfire: o.lit ? 'Apagar fogueira' : 'Acender fogueira', tent: 'Dormir / definir base', shelter: 'Dormir / definir base', door: o.open ? 'Fechar porta' : 'Abrir porta', s_doorway: o.open ? 'Fechar porta' : 'Abrir porta', s_hatch: o.open ? 'Fechar alçapão' : 'Abrir alçapão', flag: (o.data && o.data.owner === this.struct.myId()) ? 'Seu Territoritek (raio 32 m)' : 'Territoritek de outro jogador', chest: 'Abrir baú', chest_wi: 'Abrir baú', chest_iron: 'Abrir baú', cabinet: 'Abrir armário de manutenção', bench: 'Usar bancada' }[o.type] || (this.power.wiring && o.data ? (this.power.wiring.from === o ? 'Cancelar fio' : `Conectar fio aqui (${this.power.wiresFor(this.power.wiring.from, o)} fio(s) de cobre)`) : o.type === 'printer' ? 'Usar impressora 3D' : `Ver ${PIECES[o.type].name.toLowerCase()}`);
          { const L = this.territory.lockOf(o); if (L) { t = `🔒 ${t}`; parts.push(`<span class="sub">${LOCKS[L.id].name}${this.territory.canOpen(o) ? '' : ' — trancado'}</span>`); } if (isContainer(o.type) && o.data && o.data.hp !== undefined && CHESTS_HP[o.type] && o.data.hp < CHESTS_HP[o.type]) parts.push(`<span class="sub">Vida ${Math.round(o.data.hp)}/${CHESTS_HP[o.type]}</span>`); }
          if (o.type === 'campfire') { const d = FIRE.fireData(o); const nf = d.fuel.reduce((a, q) => a + (q ? q.qty : 0), 0), nc = d.cook.filter(Boolean).length; t = 'Abrir fogueira'; parts.push(`<span class="sub">${o.lit ? '🔥 acesa' : 'apagada'} · combustível: ${nf} · na grelha: ${nc}</span>`); } break;
        case 'firefood': { const c = o.data.cook[best.k]; if (!c) break; const it = ITEMS[c.id]; const raw = !!FIRE.COOK[c.id], cooked = !!FIRE.BURN[c.id]; t = `Pegar ${it.name}`;
          parts.push(`<span class="sub">${raw ? (o.lit ? `assando ${Math.floor(c.t / FIRE.COOK_T * 100)}%` : 'crua (fogueira apagada)') : cooked ? (o.lit ? '✔ pronta — tire antes que queime!' : '✔ pronta') : it.burnt ? '⚠ queimada' : 'pronto'}</span>`); break; }
      }
      if (t) parts.unshift(k('E', t));
    }
    if (tool) {
      const h = this.equip.hand ? ITEMS[this.equip.hand] : null;
      if (tool.kind === 'log') parts.push(h && h.tool === 'axe' ? k('F', 'Cortar tronco', '(galhos e fibra)') : k('F', 'Cortar tronco', '(precisa de machado)'));
      if (tool.kind === 'tree') parts.push(h && h.tool === 'axe' ? k('F', 'Cortar árvore') : k('F', 'Cortar árvore', '(precisa de machado)'));
      if (tool.kind === 'rock') parts.push(h && (h.tool === 'pickaxe' || h.mine) ? k('F', 'Minerar rocha') : k('F', 'Minerar', '(precisa de picareta)'));
    }
    else if (this.equip.hand && ITEMS[this.equip.hand].tool === 'knife' && this.wormSpot()) { const ws = this.wormSpot(); parts.push(ws.ok ? k('F', 'Tirar minhocas', '(cavar a terra com a faca)') : `<span class="sub">🪱 ${ws.why}</span>`); }
    else if (this.equip.hand && ITEMS[this.equip.hand].tool === 'pickaxe' && this.player.onGround && !this.player.swimming) { const v = this.digTarget(); parts.push(k('F', 'Cavar o chão', v.d > 0 ? `(buraco ${v.d.toFixed(1)} m · máx. 6 m)` : '(areia · buraco para base subterrânea)')); }
    this.ui.prompt(parts.join('&nbsp;&nbsp;&nbsp;'));
  }
  interact() {
    const t = this._cur; const P = this.player; if (!t || P.dead) return;
    const o = t.o; const w = this.world;
    const face = (x, z) => { P.yaw = Math.atan2(x - P.pos[0], z - P.pos[2]); };
    const pick = (fn, x, z) => { if (P.anim.busy || P.swimming) { if (P.swimming) fn(); return; } if (x !== undefined) face(x, z); P.doAction('pickup', (n) => { if (n === 'grab') fn(); }, { faceCam: false }); };
    const day = this.env.day;
    switch (t.kind) {
      case 'pickup': pick(() => { if (o.taken) return; const map = { stick: ['stick', 1 + (Math.random() < 0.4)], stone: ['stone', 1], fiber: ['fiber', 3], mushroom: ['mushroom', 1], crystal: ['crystal', 1] }; const [id, n] = map[o.kind];
        if (this.inv.room(id) < 1) return this.ui.toast('Inventário cheio', 'warn'); this.give(id, n); if (o.kind === 'fiber' && Math.random() < 0.4) this.give('leaf', 1); if (o.kind === 'fiber') this._worm();
        o.taken = true; o.regrowAt = day + (o.kind === 'crystal' ? 4 : 1); o._grp.dirty(o); this.audio.play('pickup'); }, o.x, o.z); break;
      case 'bush': if (!o.berries && o.leafT > this.env.elapsed) return; pick(() => {
        if (o.berries) { this.give('berry', 2 + Math.floor(Math.random() * 3)); this.give('leaf', 2); o.berries = false; o.regrowAt = day + 1; o.leafT = this.env.elapsed + 90; this.groups.bushB.dirty(o); this.groups.bushE.dirty(o); }
        else { this.give('leaf', 2); this.give('fiber', 2); o.leafT = this.env.elapsed + 90; }
        this.audio.play('pickup'); }, o.x, o.z); break;
      case 'hive': pick(() => { if (!o.honey) return; o.honey = false; o.regrowAt = day + 2; o.angry = 30; o.robbed = 40; this.give('honey', 2 + Math.floor(Math.random() * 2)); this.audio.play('alarm', { vol: 0.6 }); this.ui.toast('🐝 As abelhas robóticas estão furiosas! Corra!', 'warn'); }, o.x, o.z); break;
      case 'car': pick(() => { if (o.looted) return; o.looted = true; o.regrowAt = day + 4; const got = this.giveLoot(rollLoot('car', Math.random, { toxic: this.world.toxicAt(o.x, o.z) > 0 }), o); if (!got) this.give('scrap', 1); this.audio.play('metalHit', { vol: 0.5 }); this.ui.toast('🚗 Carro revistado', 'ok'); }, o.x, o.z); break;
      case 'crate': pick(() => { if (o.looted) return; o.looted = true; o.regrowAt = day + (o.furn ? 4 : 3); if (!o.furn) (o.kind === 'milcrate' ? this.groups.milcrate : this.groups.crate).dirty(o);
        const kind = o.furn || (o.kind === 'milcrate' ? 'milcrate' : o.kind === 'tentbox' ? 'tentbox' : o.site === 'lab' ? 'lab_crate' : o.site || 'ruins'); const got = this.giveLoot(rollLoot(kind, Math.random, { toxic: o.toxic || this.world.toxicAt(o.x, o.z) > 0 }), o);
        if (!got) this.ui.toast(o.furn ? 'Vazio' : 'Caixa vazia', 'info'); this.audio.play(o.furn === 'fridge' || o.furn === 'wardrobe' ? 'door' : 'pickup'); }, o.x, o.z); break;
      case 'book': pick(() => { if (o.taken) return; const id = 'book_' + o.skill; if (this.inv.add(id, 1) < 1) return this.ui.toast('Inventário cheio', 'warn'); o.taken = true; o.regrowAt = day + 15; this.audio.play('pickup'); this.ui.toast(`📕 Você achou o <b>Livro de ${this.skillName(o.skill)}</b>! Leia no inventário (botão direito → Ler).`, 'ok'); }, o.x, o.z); break;
      case 'special': pick(() => { if (o.taken) return; if (this.inv.room('ratsuit') < 1) return this.ui.toast('Inventário cheio', 'warn'); o.taken = true; o.regrowAt = day + 7; this.groups.ratfold.dirty(o); this.give('ratsuit', 1); this.audio.play('cloth'); this.ui.toast('☣️ Roupa R.A.T encontrada! Vista-a para entrar na zona tóxica.', 'ok'); }, o.x, o.z); break;
      case 'drop': pick(() => { const i = this.drops.indexOf(o); if (i < 0) return; const left = [];
        for (let [id, n, rad] of o.items) { if (this._autoWear(id) && !--n) continue; const kb = this._backFirst(id, n); n -= kb; if (!n) continue; const k = this.inv.add(id, n, { rad: !!rad || this.world.toxicAt(o.x, o.z) > 0.2 }); if (k) this.ui.toast(`+${k} ${ITEMS[id].icon} ${ITEMS[id].name}${rad ? ' ☢' : ''}`, 'ok'); if (k < n) left.push(rad ? [id, n - k, 1] : [id, n - k]); }
        if (left.length) { o.items = left; this.ui.toast('Inventário cheio — alguns itens ficaram', 'warn'); } else { this.drops.splice(i, 1); if (o.death) this.deathPos = null; } this.audio.play('pickup'); }, o.x, o.z); break;
      case 'arrow': pick(() => { const i = this.arrows.indexOf(o); if (i < 0) return; this.arrows.splice(i, 1); this.give('arrow', 1); this.audio.play('pickup'); }, o.p[0], o.p[2]); break;
      case 'log': pick(() => { const i = this.logs.indexOf(o); if (i < 0) return; if (this.inv.room('wood') < 1) return this.ui.toast('Inventário cheio', 'warn'); this.logs.splice(i, 1); this.give('wood', 4); if (Math.random() < 0.5) this.give('stick', 1); this.audio.play('pickup'); }, o.x, o.z); break;
      case 'corpse': if (o.npc) { this._useHumanCorpse(o); break; } pick(() => { if (o.looted) return; o.looted = true; this.net.onLoot(o); for (const [id, a, b] of o.def.loot) { const n = a + Math.floor(Math.random() * (b - a + 1)); if (n > 0) this.give(id, n); } for (const [id, p] of o.def.lootChance || []) if (Math.random() < p) this.give(id, 1); if (o.extraLoot) for (const [id, n] of o.extraLoot) this.give(id, n); this.audio.play('pickup'); }, o.pos[0], o.pos[2]); break;
      case 'firefood': { if (P.anim.busy) return; const fo = o, k = t.k; P.doAction('pickup', (n) => { if (n !== 'grab') return; const c = fo.data && fo.data.cook[k]; if (!c) return; const nm = ITEMS[c.id].name; if (this.fires.take(fo, 'cook', k)) this.ui.toast(`🍖 Pegou ${nm}`, 'ok'); }); break; }
      case 'water': {
        const st = P.stats;
        if (!t.salt && this.inv.contaminated() && this.inv.count('soap') > 0) { if (P.anim.busy) return; P.doAction('pickup', (n) => { if (n !== 'grab') return; this.inv.remove('soap', 1); const k = this.inv.decontaminate(); this.audio.play('wash'); this.audio.play('splash'); this.ui.toast(`🧼 ${k} item(ns) lavado(s) — radiação removida`, 'ok'); }); return; }
        if (t.salt) { st.thirst = Math.max(0, st.thirst - 4); if (Math.random() < 0.3) this.addStatus('poison', 10); this.ui.toast('Água salgada não mata a sede! Procure rios e lagos (e ferva a água).', 'warn'); this.audio.play('drink'); return; }
        pick(() => { st.thirst = Math.min(100, st.thirst + 25); this.audio.play('drink'); if (Math.random() < 0.45) { this.addStatus('poison', 18); this.ui.toast('🤢 A água estava contaminada — infecção intestinal! Ferva a água na fogueira ou junte água da chuva.', 'warn'); } else this.ui.toast('💧 Você bebeu água contaminada (+25 sede) — dessa vez não fez mal', 'info'); }); break; }
      case 'piece': this._usePiece(o); break;
      case 'hdoor': this.toggleHouseDoor(o); break;
      case 'ladder': if (P.anim.busy) return; if (t.top) P.setPosition(o.x, o.y1 - 1.3, o.z); P.grabLadder(o); break;
      case 'vehicle': { const VS = this.vehicles, T = VEH.VTYPES[o.type]; if (this.equip.hand === 'jerrycan') { if (this.jerryFuel > 0.2 && o.fuel < T.tank - 0.3) this._startXfer('fill', o); else if (o.fuel > 0.2 && this.jerryFuel < VS.jerryCap() - 0.2) this._startXfer('siphon', o); else this.ui.toast(o.fuel >= T.tank - 0.3 ? 'O tanque já está cheio' : 'O galão está vazio', 'info'); break; }
        if (VS.complete(o)) VS.enter(o); else this.ui.openPanel('vehicle', { v: o }); break; }
      case 'pump': if (this.equip.hand !== 'jerrycan') { this.ui.toast(this.countAll('jerrycan') ? 'Pegue o galão na mão (barra rápida) para encher' : 'Você precisa de um galão de combustível', 'warn'); break; } this._startXfer('pump', o); break;
      case 'carfuel': this._startXfer('car', o); break;
    }
  }
  // ---------- habilidades e livros ----------
  hasSkillFor(key) { const s = SKILL_OF[key]; return !s || (this.skills && this.skills.has(s)); }
  skillName(id) { const s = SKILLS.find((q) => q.id === id); return s ? s.name : id; }
  // onde cada livro pode aparecer (pontos de móveis/caixas do local de origem)
  _bookSpots(skill) { const w = this.world; const site = (c) => (c.siteId !== undefined ? w.sites[c.siteId] : null); const K = (c) => site(c)?.kind;
    const f = { carpintaria: (c) => K(c) === 'village' || c.furn === 'shelf', medicina: (c) => c.furn === 'hospital', engenharia: (c) => K(c) === 'industry' || K(c) === 'military', mecanica: (c) => K(c) === 'industry',
      eletrica: (c) => K(c) === 'industry' || c.furn === 'shelf', agricultura: (c) => K(c) === 'village' || c.furn === 'kcab', metalurgia: (c) => K(c) === 'industry' || K(c) === 'military', costura: (c) => c.furn === 'wardrobe', eletronica: (c) => K(c) === 'lab' || c.furn === 'milcontainer' }[skill];
    const out = []; w.crateSpots.forEach((c, i) => { if (f && f(c) && !c.toxic) out.push(i); }); return out; }
  _placeBook(b, avoidSite) { const cand = this._bookSpots(b.skill); const sp = this.world.crateSpots; let pool = cand.filter((i) => sp[i].siteId !== avoidSite && !(this.books || []).some((o) => o !== b && !o.taken && sp[o.spot] && sp[o.spot].siteId === sp[i].siteId)); if (!pool.length) pool = cand;
    b.spot = pool.length ? pool[Math.floor(Math.random() * pool.length)] : -1; this._bookPos(b); }
  _bookPos(b) { const c = this.world.crateSpots[b.spot]; if (!c) { b.x = 1e9; return; } const fw = [Math.sin(c.rot), Math.cos(c.rot)]; b.x = c.x + fw[0] * 0.55; b.z = c.z + fw[1] * 0.55; b.y = (c.yFix ? c.y : this.world.height(c.x, c.z)) - 0.08; b.rot = c.rot + 0.4; }
  _initBooks(saved) { this.books = SKILLS.map((s) => ({ skill: s.id, spot: -1, taken: false, regrowAt: 0 }));
    if (saved) for (const [sk, spot, taken, at] of saved) { const b = this.books.find((q) => q.skill === sk); if (b) { b.spot = spot; b.taken = !!taken; b.regrowAt = at; this._bookPos(b); } }
    for (const b of this.books) if (b.spot < 0) this._placeBook(b); }
  _updateBooks() { const day = this.env.day; for (const b of this.books || []) if (b.taken && day >= b.regrowAt) { const old = this.world.crateSpots[b.spot]; b.taken = false; this._placeBook(b, old && old.siteId); } }
  readBook(i) { const s = this.inv.slots[i]; if (!s) return; const it = ITEMS[s.id]; if (it.type !== 'book') return; const P = this.player;
    if (this.skills.has(it.skill)) return this.ui.toast(`Você já sabe ${this.skillName(it.skill)}.`, 'info');
    if (P.dead || P.swimming || P.anim.busy || this._reading) return; this.ui.closePanels(true); this.onPanelClosed && this.onPanelClosed();
    const id = s.id; const T = 5.2; this._reading = { id, skill: it.skill, t: 0, T }; P.prop = 'book:' + it.skill;
    const ok = P.doAction('read', (n) => { if (n === 'page') this.audio.play('page'); }, { onEnd: () => { const R = this._reading; this._reading = null; P.prop = null; this.ui.readProgress(null); if (!R) return;
        if (R.t < R.T * 0.9) { this.ui.toast('Leitura interrompida', 'warn'); return; }
        if (this.inv.count(R.id) < 1) return; this.inv.remove(R.id, 1); this.skills.add(R.skill); this.audio.play('skill', { vol: 0.9 }); this.ui.toast(`📖 Habilidade desbloqueada: <b>${this.skillName(R.skill)}</b>`, 'ok'); this.saveGame(false); } });
    if (!ok) { this._reading = null; P.prop = null; } }
  // canteiro elevado: frutas crescem em ~1/4 de dia (dia+noite = 55 min reais)
  _clock() { return this.env.day + this.env.time; }
  // ---------- combustível: abastecer, retirar (veículos e carros abandonados) e encher nas bombas ----------
  _jerryF() { const P = this.player, v = this.vehicles.near(P.pos, 2.6), cap = this.vehicles.jerryCap();
    if (v && this.vehicles.complete(v) && !this._xfer && this.equip.hand !== 'jerrycan') return this.ui.openPanel('vehicle', { v });
    if (v && v.fuel > 0.2 && this.jerryFuel < cap - 0.2) return this._startXfer('siphon', v);
    const q = this.vehicles.nearPump(P.pos); if (q) return this._startXfer('pump', q);
    for (const c of this.physics.query(P.pos[0], P.pos[2], 3)) if (c.car && !c.car.fuelTaken && this.physics.insideXZ(c, P.pos[0], P.pos[2], 1.5)) return this._startXfer('car', c.car);
    this.ui.toast(v ? (v.fuel <= 0.2 ? 'Esse veículo está sem combustível' : 'O galão já está cheio') : 'Chegue perto de um veículo ou de uma bomba de combustível', 'info'); }
  _startXfer(kind, o) { const P = this.player, VS = this.vehicles, cap = VS.jerryCap(); if (this._xfer || P.anim.busy) return; if (!this.countAll('jerrycan')) return this.ui.toast('Você precisa de um galão de combustível', 'warn');
    let amt = 0, tank = 0, tankMax = 0, label = '';
    if (kind === 'fill') { const T = VEH.VTYPES[o.type]; amt = Math.min(this.jerryFuel, T.tank - o.fuel); tank = o.fuel; tankMax = T.tank; label = `Abastecendo ${VEH.vName(o)}`; }
    else if (kind === 'siphon') { const T = VEH.VTYPES[o.type]; amt = Math.min(cap - this.jerryFuel, o.fuel * (0.35 + Math.random() * 0.65)); tank = o.fuel; tankMax = T.tank; label = `Retirando combustível de ${VEH.vName(o)}`; }
    else if (kind === 'pump') { amt = Math.min(o.fuel, cap - this.jerryFuel); tank = o.fuel; tankMax = Math.max(o.fuel, 300); label = 'Enchendo o galão na bomba'; if (o.fuel < 0.5) return this.ui.toast('⛽ A bomba está seca', 'warn'); }
    else if (kind === 'car') { o.fuelTaken = true; const got = Math.random() < 0.3 ? 0 : 1 + Math.random() * 9; amt = Math.min(cap - this.jerryFuel, got); tank = got; tankMax = 50; label = 'Retirando combustível do carro abandonado'; if (amt <= 0.05) { this.audio.play('click'); return this.ui.toast('O tanque desse carro está seco', 'info'); } }
    if (amt <= 0.05) return this.ui.toast(kind === 'fill' ? 'Nada para abastecer' : 'O galão já está cheio', 'info');
    const T = Math.min(6, 2.2 + amt * 0.18); this._xfer = { kind, o, amt, done: 0, T, t: 0, tank, tankMax, label };
    P.doAction('pour', null, { speed: 3.0 / T, onEnd: () => { const X = this._xfer; if (X) this._finishXfer(X); } });
    this.audio.play('pour', { at: P.pos }); }
  _updateXfer(dt) { const X = this._xfer; X.t += dt; const k = Math.min(1, X.t / X.T); const want = X.amt * k, d = want - X.done; X.done = want; this._applyXfer(X, d);
    const cap = this.vehicles.jerryCap(); const tk = X.kind === 'fill' ? X.o.fuel : X.kind === 'siphon' ? X.o.fuel : X.kind === 'pump' ? X.o.fuel : Math.max(0, X.tank - X.done);
    this.ui.fuelBars({ label: X.label, can: this.jerryFuel, canMax: cap, tank: tk, tankMax: X.tankMax, tankLabel: X.kind === 'pump' ? 'Bomba' : 'Tanque' }); if (Math.random() < dt * 3) this.audio.play('pour', { at: this.player.pos, vol: 0.5 });
    if (k >= 1 || this.player.dead) this._finishXfer(X); }
  _applyXfer(X, d) { if (d <= 0) return; if (X.kind === 'fill') { this.jerryFuel -= d; X.o.fuel += d; } else if (X.kind === 'siphon' || X.kind === 'pump') { this.jerryFuel += d; X.o.fuel -= d; } else this.jerryFuel += d; }
  _finishXfer(X) { if (this._xfer !== X) return; this._applyXfer(X, X.amt - X.done); X.done = X.amt; this._xfer = null; this.ui.fuelBars(null); this.jerryFuel = Math.max(0, Math.min(this.jerryFuel, this.vehicles.jerryCap()));
    const L = X.amt.toFixed(1); this.ui.toast(X.kind === 'fill' ? `⛽ +${L} L no ${VEH.vName(X.o)}` : `⛽ +${L} L no galão (${this.jerryFuel.toFixed(1)} L)`, 'ok'); }
  // portas das casas: abre/fecha com E (não fecha em cima do jogador)
  toggleHouseDoor(d) { const P = this.player; const want = !d.open;
    if (!want && this.physics.insideXZ(d.colC, P.pos[0], P.pos[2], 0.36)) { this.ui.toast('Saia da frente da porta para fechar', 'info'); return; }
    if (want && this.physics.insideXZ(d.colO, P.pos[0], P.pos[2], 0.36)) { this.ui.toast('Saia da frente da porta para abrir', 'info'); return; }
    d.open = want; d.colC.ghost = want; d.colO.ghost = !want; if (want) this.openDoors.add(d.id); else this.openDoors.delete(d.id); this.audio.play('door', { at: [d.x, d.y + 1, d.z] }); }
  _usePiece(p) {
    if (p.data && PIECES[p.type].power) { const W = this.power.wiring; if (W) { if (W.from === p) this.power.cancelWire('Ligação de fio cancelada'); else if (this.power.connect(W.from, p)) this.power.wiring = null; return; } this.ui.openPanel('power', { piece: p }); this.audio.play('door', { vol: 0.4 }); return; }
    switch (p.type) {
      case 'campfire': FIRE.fireData(p); this.ui.openPanel('fire', { piece: p }); this.audio.play('cloth', { vol: 0.5 }); break;
      case 'door': case 's_doorway': case 's_hatch': if (p.open) this.build.toggleDoor(p); else this.territory.access(p, () => this.build.toggleDoor(p)); break;
      case 'flag': { const r = this.territory.daysLeft(p); this.ui.toast(`📡 Territoritek: área de construção de 32 m. ${r.cab ? (Object.keys(r.need).length ? `Manutenção: ${isFinite(r.days) ? r.days.toFixed(1) + ' dia(s)' : 'ok'}` : 'Sem construções para manter') : 'Sem Armário de manutenção: as construções vão perder vida'}`, 'info'); break; }
      case 'planter': this._usePlanter(p); break;
      case 'collector': this._useCollector(p); break;
      case 'composter': this._useComposter(p); break;
      case 'chest': case 'chest_wi': case 'chest_iron': case 'cabinet': this.territory.access(p, () => { this.ui.openPanel('chest', { piece: p }); this.audio.play('door'); }); break;
      case 'bench': this.ui.openPanel('inv', { tab: 'craft' }); break;
      case 'tent': case 'shelter': this.sleep(p); break;
    }
  }
  // ---------- barulho: robôs e NPCs no raio ouvem e vão ver (src = quem fez o barulho, se não foi o jogador) ----------
  noise(pos, radius, kind, src) { if (this.netClient) { if (radius >= 8 && this.net.active) { const t = this.env.elapsed; if (radius >= 30 || !this._nzT || t - this._nzT > 0.5) { this._nzT = t; this.net.send({ t: 'noise', p: pos.map((v) => +v.toFixed(1)), r: radius, k: kind }); } } return; } if (!src || src === 'horn') this.creatures.hearShot(pos, radius * (kind === 'passo' ? 1 : 0.9)); this.npcs.hear(pos, radius); if (radius >= 40 && this.convoys && (!src || !src.convoy)) this.convoys.hear(pos, radius); }
  // ---------- corpo de NPC: revistar (arma e munição) ou picotar com faca/machado (sobram mochila, roupas, armas, carne e ossos) ----------
  _useHumanCorpse(c) { const P = this.player, blade = this.equip.hand && ['knife', 'axe'].includes(ITEMS[this.equip.hand].tool);
    if (!blade) { if (c.searched) { this.ui.toast('Você já revistou esse corpo — com faca ou machado dá para picotar', 'info'); return; } P.doAction('pickup', (n) => { if (n !== 'grab') return; c.searched = true; this.net.onLoot(c, false, true); const L = c.loadout || {}; let got = 0; for (const [id, q] of [...(L.weapon || []), ...(L.misc || [])]) { if (!ITEMS[id]) continue; const kb = this._backFirst(id, q); const k = kb < q ? this.inv.add(id, q - kb) : 0; if (kb + k < q) this.dropNear([[id, q - kb - k]]); got += kb + k > 0 ? 1 : 0; } if (L.weapon) L.weapon = []; if (L.misc) L.misc = []; this.audio.play('pickup'); this.ui.toast(got ? '🔎 Corpo revistado' : 'Nada de útil', 'ok'); }); return; }
    if (this._butcher) return; this._butcher = { c, t: 0, T: 6, hit: 0 }; this.ui.toast('🔪 Picotando o corpo… (fique perto)', 'info'); }
  _updateButcher(dt) { const B = this._butcher; if (!B) return; const P = this.player, c = B.c;
    if (P.dead || !this.creatures.list.includes(c) || Math.hypot(c.pos[0] - P.pos[0], c.pos[2] - P.pos[2]) > 3 || !(this.equip.hand && ['knife', 'axe'].includes(ITEMS[this.equip.hand].tool))) { this._butcher = null; this.ui.readProgress(null); return; }
    B.t += dt; P.yaw = Math.atan2(c.pos[0] - P.pos[0], c.pos[2] - P.pos[2]); if (!P.anim.busy) P.doAction(ITEMS[this.equip.hand].tool === 'axe' ? 'chop' : 'thrust', (n) => { if (n === 'hit') { this.audio.play('butcher', { at: c.pos }); this.fx.burst([c.pos[0], c.pos[1] + 0.3, c.pos[2]], 16, [0.55, 0.04, 0.04], 2.5, 0.6, 0.05); this.noise(P.pos, 8, 'picotar'); } }, { faceCam: false, cost: 0 });
    this.ui.readProgress(Math.min(1, B.t / B.T), 'Picotando'); if (B.t < B.T) return;
    this._butcher = null; this.ui.readProgress(null); const L = c.loadout || { weapon: [], clothes: [], misc: [] }; const gy = this.world.height(c.pos[0], c.pos[2]); const at = (k) => { const a = c.yaw + k * 1.25; return [c.pos[0] + Math.sin(a) * 0.7, gy, c.pos[2] + Math.cos(a) * 0.7]; };
    const drop = (items, k, look) => { items = items.filter(([id]) => ITEMS[id]); if (!items.length) return; const [x, y, z] = at(k); this.drops.push({ items, x, y, z, look, rot: Math.random() * 6 }); };
    if (L.pack) drop([[L.pack, 1], ...(L.misc || [])], 0, 'pack'); else drop(L.misc || [], 0, 'bag'); drop(L.clothes || [], 1, 'cloth'); drop(L.weapon || [], 2, 'weapon'); drop([['meat_human', 3 + Math.floor(Math.random() * 3)]], 3, 'meat'); drop([['bone', 2 + Math.floor(Math.random() * 3)]], 4, 'bone');
    this.net.onLoot(c, true); this.creatures.remove(c); this.audio.play('butcher'); this.ui.toast('🥩 Corpo picotado: mochila, roupas, armas, carne e ossos ficaram no chão', 'ok'); }
  // armadilha de granada: quem passar pelo fio (jogador, NPC ou bicho do chão) detona 1 s depois
  _trapTick(dt) { const P = this.player; for (const p of [...this.build.pieces]) { if (p.type !== 'gtrap') continue; p.age = (p.age || 0) + dt;
      if (p.fuse !== undefined) { p.fuse -= dt; if (p.fuse <= 0) { this.build.remove(p, false); this.explode([p.x, p.y + 0.2, p.z], null, { r: 9, dmg: 150, playerDmg: 100, pr: 8, kind: 'grenade', cause: 'armadilha de granada', vis: 'frag', crater: [4.5, 0.9], flash: 1 }); this.noise([p.x, p.y, p.z], 120, 'explosão'); } continue; }
      if (p.age < 3) continue; const c = Math.cos(p.rot), sn = Math.sin(p.rot); const ax = p.x - 1.2 * c, az = p.z + 1.2 * sn, bx = p.x + 1.2 * c, bz = p.z - 1.2 * sn;
      const hit = (q, r) => { const [d] = segDistG(q[0], q[2], ax, az, bx, bz); return d < r && Math.abs(q[1] - p.y) < 1.2; };
      let trig = !P.dead && hit(P.pos, 0.45); if (!trig) for (const cr of this.creatures.list) if (!cr.dead && !cr.flyer && !cr.def.flyer && hit(cr.pos, (cr.def.radius || 0.4) + 0.1)) { trig = true; break; }
      if (trig) { p.fuse = 1.0; this.audio.play('pin', { at: [p.x, p.y, p.z], max: 30 }); } } }
  // ---------- desmaio, vômito, kuru e comida queimada ----------
  faintPlayer(t, msg) { const P = this.player; if (P.dead) return; if (this.vehicles.driving) this.vehicles.exit && this.vehicles.exit(); this.build.cancel(); this.ui.closePanels(true); this._butcher = null; this._reading = null; this.grenades && (this.grenades.held = null, this.grenades.charge = null);
    P.faint(t); document.getElementById('fade').classList.add('on'); this.ui.toast(msg || '💫 Você desmaiou', 'warn'); this.noise(P.pos, 8, 'queda'); }
  addBloodPool(x, z, yaw) { if (!this.bloodPools) this.bloodPools = []; this.bloodPools.push({ x, z, y: this.world.height(x, z), yaw: yaw || 0, t: 0 }); if (this.bloodPools.length > 40) this.bloodPools.shift(); }
  _renderBlood(items) { const L = this.bloodPools; if (!L || !L.length) return; const r = this.renderer;
    if (!this._bloodMesh) { const mb = new MeshBuilder(); const c = HX(0x420505); mb.setColor(c, 0.2); const n = [0, 1, 0]; const ctr = mb.vert([0, 0, 0], n, c); const K = 24, ring = []; for (let k = 0; k < K; k++) { const a = k / K * 6.2832, rr = 0.85 + 0.12 * Math.sin(a * 3 + 0.7) + 0.07 * Math.cos(a * 5 + 1.9); ring.push(mb.vert([Math.cos(a) * rr, 0, Math.sin(a) * rr * 1.3], n, c)); } for (let k = 0; k < K; k++) mb.tri(ctr, ring[(k + 1) % K], ring[k]); this._bloodMesh = r.createMesh(mb.build()); }
    for (const b of L) { const g = Math.min(1, Math.max(0, b.t - 0.8) / 16); const sc = 0.06 + 1.24 * Math.sqrt(g); items.push({ mesh: this._bloodMesh, model: mat4.compose([b.x, b.y + 0.035, b.z], b.yaw, [sc, 1, sc]), shadow: false, sphere: [b.x, b.y, b.z, 2] }); } }
  onWake() { document.getElementById('fade').classList.remove('on'); this.ui.toast('😵 Você acordou', 'info'); }
  // vomita: perde metade da fome e da sede
  vomit(reason, then) { const P = this.player, st = P.stats; if (P.dead) return; st.hunger = Math.floor(st.hunger * 0.5); st.thirst = Math.floor(st.thirst * 0.5); this.audio.play('vomit'); this.noise(P.pos, 14, 'vomito');
    if (reason) this.ui.toast(reason, 'warn'); P.anim.action = null; P.prop = null;
    const spew = () => { const hp = P.handWorldPos ? P.pos : P.pos; const f = [Math.sin(P.yaw), Math.cos(P.yaw)]; this.fx.burst([P.pos[0] + f[0] * 0.45, P.pos[1] + 1.25, P.pos[2] + f[1] * 0.45], 22, [0.45, 0.42, 0.12], 2.2, 0.9, 0.06, -2); void hp; };
    const ok = P.doAction('vomit', (n) => { if (n === 'spew') spew(); }, { onEnd: () => { if (then) then(); } }); if (!ok) { spew(); if (then) then(); } }
  _sickTick(dt, st) {
    // comida queimada: uns 10 minutos (do jogo) depois começa a vomitar
    if (st.burntSick && this._clock() >= st.burntSick) { st.burntSick = 0; this.addStatus('poison', 30); this.vomit('🤢 A carne queimada te fez mal — você está vomitando!'); st.sickVomits = 2; st.sickNext = this._clock() + 3 / 1440; }
    if (st.sickVomits > 0 && this._clock() >= (st.sickNext || 0) && !this.player.anim.busy) { st.sickVomits--; st.sickNext = this._clock() + 3 / 1440; this.vomit('🤢 Vomitando de novo…'); }
    // kuru: tremores e a mira dá trancos para cima e para os lados
    if (st.kuru && !this.player.dead) { const t = this.env.elapsed; const gun = this.equip.hand && GUNS[this.equip.hand]; const k = gun ? (this.guns.aiming ? 1 : 0.6) : 0.25;
      this.cam.yaw += (Math.sin(t * 13.1) * 0.0016 + Math.sin(t * 7.3) * 0.001) * k; this.cam.pitch += Math.sin(t * 11.7 + 1) * 0.0012 * k;
      this._kuruT = (this._kuruT ?? 2) - dt; if (this._kuruT <= 0) { this._kuruT = 1.5 + Math.random() * 3; if (gun) { this.cam.pitch = clamp(this.cam.pitch - (0.05 + Math.random() * 0.08), -1.15, 1.2); this.cam.yaw += (Math.random() - 0.5) * 0.12; this.guns.recoilV = Math.min(1.5, (this.guns.recoilV || 0) + 0.5); } } } }
  // ---------- canteiro, coletor de chuva e composteira ----------
  _hrs(dc) { const h = Math.max(0, dc) * 24; return h >= 1 ? `${Math.ceil(h)} h` : `${Math.max(1, Math.ceil(h * 60))} min`; }
  _planterText(o, parts, k) { const d = o.data || (o.data = { grow: this._clock() + 0.25 }); const left = d.grow - this._clock();
    if (left <= 0) { if (d.fert) parts.push(`<span class="sub">🌿 adubado: colheita farta (${d.fert}×)</span>`); return 'Colher frutas'; }
    if (!d.fert && this.inv.count('adubo') > 0) { parts.push(`<span class="sub">crescendo · faltam ~${this._hrs(left)} do jogo</span>`); return 'Adubar o canteiro (1 adubo)'; }
    parts.push(`<span class="sub">${d.fert ? '🌿 adubado · ' : 'sem adubo · '}faltam ~${this._hrs(left)} do jogo</span>`); return 'Canteiro crescendo'; }
  _usePlanter(p) { const d = p.data || (p.data = { grow: this._clock() + 0.25 }); const now = this._clock();
    if (now >= d.grow) { const n = d.fert ? 6 + Math.floor(Math.random() * 4) : 3 + Math.floor(Math.random() * 3); this.give('berry', n); if (Math.random() < (d.fert ? 0.6 : 0.35)) this.give('mushroom', 1); if (d.fert) d.fert--; d.grow = now + (d.fert ? 0.125 : 0.25); this.audio.play('pickup'); this.ui.toast(`🫐 Colheu ${n} frutas do canteiro${d.fert ? ` (adubo: mais ${d.fert} colheita${d.fert > 1 ? 's' : ''})` : ''}`, 'ok'); return; }
    if (!d.fert && this.inv.count('adubo') > 0) { this.inv.remove('adubo', 1); d.fert = 3; d.grow = now + (d.grow - now) / 2; this.audio.play('pickup'); this.fx.burst([p.x, p.y + 0.5, p.z], 14, [0.35, 0.28, 0.16], 1.5, 0.6, 0.06); this.ui.toast('🌿 Canteiro adubado: cresce no dobro da velocidade e rende mais nas próximas 3 colheitas', 'ok'); return; }
    this.ui.toast(`🌱 Ainda crescendo: faltam ~${this._hrs(d.grow - now)} do jogo${d.fert ? '' : ' · use adubo da composteira para acelerar'}`, 'info'); }
  _collectorText(o, parts) { const wv = (o.data && o.data.water) || 0; parts.push(`<span class="sub">💧 ${wv.toFixed(1)}/10 garrafas · ${this.env.cur.rain > 0.2 ? 'chovendo: enchendo' : 'enche quando chove'}</span>`); return wv >= 1 ? 'Pegar água da chuva (potável)' : 'Coletor de chuva'; }
  _useCollector(p) { const d = p.data || (p.data = { water: 0 }); const n = Math.min(Math.floor(d.water), this.inv.room('water')); if (n < 1) { this.ui.toast(d.water >= 1 ? 'Inventário cheio' : '🛢️ O coletor ainda está vazio — espere a chuva', 'info'); return; }
    d.water -= n; this.give('water', n); this.audio.play('drink', { vol: 0.5 }); this.ui.toast(`💧 Encheu ${n} garrafa${n > 1 ? 's' : ''} com água da chuva`, 'ok'); }
  static COMPOST = 0.35; // duração da compostagem (dias do jogo)
  _composterText(o, parts) { const d = o.data || (o.data = { dirt: 0, food: 0 });
    if (d.start === undefined) { parts.push(`<span class="sub">🟤 terra ${d.dirt}/10 · 🍎 comida ${d.food}/10</span>`); return 'Colocar terra e comida'; }
    const f = (this._clock() - d.start) / Game.COMPOST; if (f >= 1) return 'Pegar adubo ✔'; parts.push(`<span class="sub">compostando ${Math.floor(f * 100)}% · falta ~${this._hrs(d.start + Game.COMPOST - this._clock())} do jogo</span>`); return 'Composteira trabalhando'; }
  _useComposter(p) { const d = p.data || (p.data = { dirt: 0, food: 0 }); const inv = this.inv;
    if (d.start !== undefined) { if (this._clock() < d.start + Game.COMPOST) { this.ui.toast('♻️ A compostagem ainda não terminou', 'info'); return; } if (inv.room('adubo') < 1) { this.ui.toast('Inventário cheio', 'warn'); return; } this.give('adubo', 5); p.data = { dirt: 0, food: 0 }; this.audio.play('pickup'); this.ui.toast('🌿 5 adubos prontos! Use nos canteiros (E no canteiro).', 'ok'); return; }
    let put = 0; const nd = Math.min(10 - d.dirt, inv.count('dirt')); if (nd > 0) { inv.remove('dirt', nd); d.dirt += nd; put += nd; }
    const foods = Object.keys(ITEMS).filter((id) => ITEMS[id].type === 'food' && id !== 'canned'); for (const id of foods) { const n = Math.min(10 - d.food, inv.count(id)); if (n > 0) { inv.remove(id, n); d.food += n; put += n; } }
    if (!put) { this.ui.toast(`Precisa de terra (cave com a picareta) e comida: terra ${d.dirt}/10 · comida ${d.food}/10`, 'warn'); return; }
    this.audio.play('pickup'); if (d.dirt >= 10 && d.food >= 10) { d.start = this._clock(); this.ui.toast('♻️ Composteira cheia — a compostagem começou!', 'ok'); } else this.ui.toast(`♻️ Terra ${d.dirt}/10 · comida ${d.food}/10`, 'info'); }
  _updateFarm(dt) { const rain = this.env.cur.rain || 0; if (rain < 0.2) return; for (const p of this.build.pieces) if (p.type === 'collector') { const d = p.data || (p.data = { water: 0 }); if (this.world.bldAt(p.x, p.z) || this.world.caveAt(p.x, p.z)) continue; d.water = Math.min(10, d.water + rain * 0.055 * dt); } }
  sleep(p) {
    const P = this.player;
    this.home = [p.x, p.y, p.z];
    if (this.creatures.list.some((c) => !c.dead && (c.def.hostile || c.angry > 0) && Math.hypot(c.pos[0] - P.pos[0], c.pos[2] - P.pos[2]) < 25)) { this.ui.toast('Ponto de renascimento definido. Não dá para dormir com inimigos por perto!', 'warn'); return; }
    const h = this.env.hours; if (!(this.env.isNight || h > 18) && P.stats.energy > 60) { this.ui.toast('🏕️ Base definida (renascimento). Só dá para dormir à noite ou cansado.', 'info'); this.saveGame(false); return; }
    P.sleeping = true; P.anim.play(P.clips.sleep, 0.5); this.input.enabled = false; document.getElementById('fade').classList.add('on'); this.audio.play('sleep');
    setTimeout(() => {
      const hoursToMorning = ((30 - h) % 24) || 8; const frac = hoursToMorning / 24; const st = P.stats;
      st.hunger = Math.max(5, st.hunger - 35 * frac * 2); st.thirst = Math.max(5, st.thirst - 45 * frac * 2); st.energy = 100; st.hp = Math.min(100, st.hp + 30); st.stamina = 100;
      this.env.time = 6 / 24 + 0.002; if (h > 6) this.env.day++; this.onNewDay();
      for (const c of [...this.creatures.list]) if (['tiger', 'rhino', 'eagle'].includes(c.kind) || (c.def.hostile && !this.world.inRuins(c.pos[0], c.pos[2]) && Math.hypot(c.pos[0] - P.pos[0], c.pos[2] - P.pos[2]) < 60)) this.creatures.remove(c);
      this.wake(); this.saveGame(false); this.ui.toast(`☀ Dia ${this.env.day} — você acordou descansado`, 'ok');
    }, 1600);
  }
  wake() { const P = this.player; P.sleeping = false; P.anim.play(P.clips.idle, 0.4); this.input.enabled = true; document.getElementById('fade').classList.remove('on'); }
  onNewDay() {
    const d = this.env.day, w = this.world, P = this.player.pos;
    const away = (o) => Math.hypot(o.x - P[0], o.z - P[2]) > 25;
    for (const t of w.trees) if (t.felled && t.regrowAt && d >= t.regrowAt && away(t) && !this.blockedTrees.has(t.id) && !this.physics.overlaps({ type: 'cyl', x: t.x, z: t.z, r: 0.6, y0: t.y, y1: t.y + 2 }, (c) => c === t.collider || !c.piece)) { t.felled = false; t.hp = 6; t.collider.ghost = false; this.groups[t.type].dirty(t); this.groups.stump.dirty(t); }
    for (const o of w.rocks) if (o.mined && d >= o.regrowAt && away(o) && !this.physics.overlaps({ type: 'cyl', x: o.x, z: o.z, r: o.s, y0: o.y, y1: o.y + 1 }, (c) => c === o.collider || !c.piece)) { o.mined = false; o.hp = o.rich ? 10 : 6; o.collider.ghost = false; o._grp.dirty(o); }
    for (const b of w.bushes) if (!b.berries && d >= b.regrowAt) { b.berries = true; this.groups.bushB.dirty(b); this.groups.bushE.dirty(b); }
    for (const p of w.pickups) if (p.taken && d >= p.regrowAt && away(p)) { p.taken = false; p._grp.dirty(p); }
    for (const c of w.crates) if (c.looted && d >= c.regrowAt) { c.looted = false; if (!c.furn) (c.kind === 'milcrate' ? this.groups.milcrate : this.groups.crate).dirty(c); }
    for (const o of w.specials) if (o.taken && d >= o.regrowAt) { o.taken = false; this.groups.ratfold.dirty(o); }
    this._updateBooks();
    for (const q of w.props) if (q.kind === 'car' && q.looted && d >= q.regrowAt) q.looted = false;
    for (const hv of w.hives) if (!hv.honey && d >= hv.regrowAt) hv.honey = true;
  }

  // ---------- Ferramentas e combate ----------
  useAction() {
    const P = this.player; if (P.dead || P.swimming || P.anim.busy || P.climb || P.attackCd > 0) return;
    { const h0 = this.equip.hand ? ITEMS[this.equip.hand] : null; if (!h0 || ['axe', 'pickaxe', 'knife', 'spear'].includes(h0.tool)) this._handWear(); }
    const hand = this.equip.hand ? ITEMS[this.equip.hand] : null; const tool = this._curTool;
    if (hand && hand.tool === 'jerry') { this._jerryF(); return; }
    if (hand && hand.tool === 'grenade') return;
    if (this._cur && this._cur.kind === 'water' && !(hand && ['axe', 'pickaxe'].includes(hand.tool) && tool)) { if (this._cur.salt) { this.ui.toast('Água do mar não serve — procure rio, lago ou riacho', 'warn'); return; } if (this.inv.room('dirtywater') < 1) { this.ui.toast('Inventário cheio', 'warn'); return; } P.doAction('pickup', (n) => { if (n === 'grab') { this.give('dirtywater', 1); this.audio.play('splash', { vol: 0.5 }); } }); return; }
    if (hand && hand.tool === 'axe' && tool && tool.kind === 'tree') {
      const tr = tool.o; const face = Math.atan2(tr.x - P.pos[0], tr.z - P.pos[2]);
      P.doAction('chop', (n) => { if (n === 'hit') this._chop(tr, hand); }, { faceYaw: face, faceCam: false, cost: 6 }); this.audio.play('swing'); return;
    }
    if (hand && hand.tool === 'axe' && tool && tool.kind === 'log') {
      const lg = tool.o; const face = Math.atan2(lg.x - P.pos[0], lg.z - P.pos[2]);
      P.doAction('chop', (n) => { if (n === 'hit') this._chopLog(lg, hand); }, { faceYaw: face, faceCam: false, cost: 5 }); this.audio.play('swing'); return;
    }
    if (hand && (hand.tool === 'pickaxe' || hand.mine) && tool && tool.kind === 'rock') {
      const rk = tool.o; const face = Math.atan2(rk.x - P.pos[0], rk.z - P.pos[2]);
      P.doAction('mine', (n) => { if (n === 'hit') this._mine(rk, hand); }, { faceYaw: face, faceCam: false, cost: 7 }); return;
    }
    if (hand && hand.tool === 'knife' && !tool) { const ws = this.wormSpot(); if (ws && ws.ok) { P.doAction('chop', (n) => { if (n === 'hit') this.digWorms(ws); }, { faceYaw: Math.atan2(ws.x - P.pos[0], ws.z - P.pos[2]), faceCam: false, cost: 4, speed: 1.1 }); this.audio.play('swing'); return; } }
    const type = !hand ? 'punch' : hand.tool === 'spear' ? 'thrust' : hand.tool === 'axe' || hand.tool === 'knife' ? 'chop' : hand.tool === 'pickaxe' ? 'mine' : 'punch';
    const dmg = hand ? hand.dmg : 6, reach = hand ? hand.reach : 1.5;
    const digHere = hand && hand.tool === 'pickaxe' && !tool && P.onGround ? this.digTarget() : null;
    const ok = P.doAction(type, (n) => { if (n !== 'hit') return; const hitC = this._meleeHit(dmg, reach, type); if (!hitC && digHere) this.dig(digHere, hand);
      if (tool && tool.kind === 'tree' && !hand) { this.audio.play('punch'); if (Math.random() < 0.3) this.give('stick', 1); this.ui.toast('Fabrique um machado para cortar árvores', 'info'); }
      if (tool && tool.kind === 'rock' && !(hand && (hand.tool === 'pickaxe' || hand.mine))) { this.audio.play('mine'); this.ui.toast('Fabrique uma picareta para minerar', 'info'); }
    }, { cost: hand ? (hand.tool === 'knife' ? 5 : 8) : 5, speed: type === 'punch' ? 1.15 : hand && hand.tool === 'knife' ? 1.45 : 1 });
    if (ok) this.audio.play('swing');
  }
  // ---------- Projéteis (tiros de energia dos androides) ----------
  spawnProjectile(from, to, speed, dmg, src, small = false) {
    const d = [to[0] - from[0], to[1] - from[1], to[2] - from[2]]; const l = Math.hypot(...d) || 1;
    this.projectiles.push({ p: from.slice(), v: d.map((x) => (x / l) * speed), dmg, src, life: 2.2, small });
  }
  // míssil teleguiado (rinoceronte): curva suave em direção ao jogador e explode com dano em área
  spawnMissile(from, to, src) {
    const d = [to[0] - from[0], to[1] - from[1] + 2, to[2] - from[2]]; const l = Math.hypot(...d) || 1;
    this.projectiles.push({ p: from.slice(), v: d.map((x) => (x / l) * 13), dmg: 34, src, life: 5, missile: true, age: 0 });
  }
  explode(p, src, o = {}) {
    const P = this.player; if (!o.fxOnly && this.net && this.net.active && !(src && src.netProxy)) this.net.onBoom(p, o); this.audio.play('explosion', { vol: Math.max(0.3, 1 - Math.hypot(p[0] - P.pos[0], p[2] - P.pos[2]) / 60) });
    const big = o.vis === 'c4'; if (o.vis && this.blasts) { this.blasts.boom(o.vis, p); this.fx.burst(p, big ? 40 : 18, [1, 0.7, 0.3], big ? 14 : 9, 0.5, 0.06, 6); } else { this.fx.burst(p, 40, [1, 0.55, 0.15], 7, 0.6, 0.14, 4); this.fx.burst(p, 25, [0.3, 0.3, 0.3], 3, 1.6, 0.25, -1.5); this.fx.burst(p, 16, [0.35, 0.3, 0.25], 5, 1.0, 0.06); }
    if (big) this.audio.play('explosion', { vol: 1 }); const d = Math.hypot(p[0] - P.pos[0], p[1] - (P.pos[1] + 0.9), p[2] - P.pos[2]);
    this.cam.shake = Math.max(this.cam.shake, Math.max(0, (big ? 1.6 : o.vis ? 1.2 : 1) - d / (big ? 70 : o.vis ? 35 : 25)));
    this.blastLight = o.vis ? { pos: [p[0], p[1] + 1.5, p[2]], t: big ? 0.9 : 0.5, max: big ? 0.9 : 0.5, range: big ? 70 : 34, col: big ? [14, 7, 2.2] : [9, 4.8, 1.5] } : { pos: p.slice(), t: 0.35 };
    if (o.flash || big) this.boomFlash(p, big ? 1 : 0.75);
    if (o.crater) this.crater(p, o.crater[0], o.crater[1]);
    if (o.fxOnly) return;
    const pr = o.pr || 4, R = o.r || 3.5; const cover = (q) => { const e = [p[0], p[1] + 0.3, p[2]]; const L = Math.hypot(q[0] - e[0], q[1] - e[1], q[2] - e[2]); return this.physics.rayFree(q, e, 0.02, null) * L < L - 0.8; }; if (!P.dead && d < pr && !cover([P.pos[0], P.pos[1] + 1.0, P.pos[2]])) { if (src) this.playerHit((o.playerDmg || 34) * (1 - d / pr) + 6, src, { ranged: true }); else this.damage((o.playerDmg || 34) * (1 - d / pr) + 6, o.cause || 'explosão de C4'); this.knockback(Math.atan2(P.pos[0] - p[0], P.pos[2] - p[2]), 12 * (1 - d / pr)); }
    for (const c of this.creatures.list) { if (c === src || c.dead) continue; const dc = Math.hypot(c.pos[0] - p[0], c.pos[2] - p[2]); if (dc < R && (o.vis === 'c4' || !cover([c.pos[0], c.pos[1] + 0.6, c.pos[2]]))) this.creatures.damage(c, (o.dmg || 40) * (1 - dc / R * 0.7), Math.atan2(c.pos[0] - p[0], c.pos[2] - p[2]), o.kind); }
    if (this.struct) this.struct.blast(p, R, o.dmg || 40, o.kind);
    if (this.territory) this.territory.blast(p, R, o.kind);
    if (this.helis) this.helis.blast(p, R);
    if (o.wreck) this.wreck(p, o.wreck);
  }
  // lupa em cima dos móveis/caixas/carros que ainda têm loot (some depois de vasculhar)
  _lootMarks(dt) {
    let box = this._lmBox; if (!box) { box = document.createElement('div'); box.id = 'lootMarks'; document.body.appendChild(box); this._lmBox = box; this._lmEls = []; this._lmList = []; this._lmT = 0; }
    const P = this.player, off = this.state !== 'playing' || this.ui.anyOpen || P.dead || this.menuMode;
    if (off) { for (const el of this._lmEls) el.style.display = 'none'; return; }
    this._lmT -= dt; if (this._lmT <= 0) { this._lmT = 0.3; const w = this.world, R = 18, e = this.cam.eye || [P.pos[0], P.pos[1] + 1.6, P.pos[2]], cand = [];
      if (!this._lmCars) this._lmCars = w.props.filter((q) => q.kind === 'car');
      const test = (o, y, kind) => { const d = Math.hypot(o.x - P.pos[0], o.z - P.pos[2]); if (d > R) return; const t = [o.x, y, o.z], L = Math.hypot(t[0] - e[0], t[1] - e[1], t[2] - e[2]); if (this.physics.rayFree(e, t, 0.05) * L < L - 1.6) return; cand.push({ o, y, d, kind }); };
      for (const o of w.crates) { if (o.looted || Math.abs(o.x - P.pos[0]) > R || Math.abs(o.z - P.pos[2]) > R) continue; test(o, (o.y ?? w.height(o.x, o.z)) + (o.furn ? 1.35 : 1.0), 'crate'); }
      for (const o of this._lmCars) { if (o.looted || Math.abs(o.x - P.pos[0]) > R || Math.abs(o.z - P.pos[2]) > R) continue; test(o, (o.y ?? w.height(o.x, o.z)) + 1.9, 'car'); }
      cand.sort((a, b) => a.d - b.d); this._lmList = cand.slice(0, 24); }
    const VP = this.renderer.viewProj, W = window.innerWidth, H = window.innerHeight; let n = 0;
    const svg = '<svg viewBox="0 0 24 24" fill="none" stroke="#ffd66e" stroke-width="2.6" stroke-linecap="round"><circle cx="10" cy="10" r="6.2"/><path d="M14.6 14.6 L20.5 20.5"/></svg>';
    for (const c of this._lmList) { if (c.o.looted) continue; const x = c.o.x, y = c.y, z = c.o.z; const cw = VP[3] * x + VP[7] * y + VP[11] * z + VP[15]; if (cw <= 0.2) continue;
      const sx = ((VP[0] * x + VP[4] * y + VP[8] * z + VP[12]) / cw * 0.5 + 0.5) * W, sy = (1 - ((VP[1] * x + VP[5] * y + VP[9] * z + VP[13]) / cw * 0.5 + 0.5)) * H; if (sx < -40 || sy < -40 || sx > W + 40 || sy > H + 40) continue;
      let el = this._lmEls[n]; if (!el) { el = document.createElement('div'); el.className = 'lm'; el.innerHTML = svg; box.appendChild(el); this._lmEls.push(el); }
      const sz = Math.max(18, Math.min(34, 420 / (c.d + 6))); el.style.display = ''; el.style.left = sx.toFixed(0) + 'px'; el.style.top = sy.toFixed(0) + 'px'; el.style.width = el.style.height = sz.toFixed(0) + 'px'; el.style.opacity = c.d > 14 ? (1 - (c.d - 14) / 4).toFixed(2) : '1'; n++; }
    for (let i = n; i < this._lmEls.length; i++) this._lmEls[i].style.display = 'none';
  }
  // loot no chão perto do jogador (para a área "Próximo" do inventário)
  nearLoot(R = 3.2) { const P = this.player.pos, out = []; const PICK = { stick: 'stick', stone: 'stone', fiber: 'fiber', mushroom: 'mushroom', crystal: 'crystal' }, PN = { fiber: 3 };
    for (const d of this.drops) { if (Math.hypot(d.x - P[0], d.z - P[2]) > R || Math.abs((d.y ?? P[1]) - P[1]) > 2.5) continue; d.items.forEach((it, i) => { if (ITEMS[it[0]]) out.push({ src: 'drop', d, id: it[0], n: it[1], rad: !!it[2], ref: it }); }); }
    for (const o of this.world.pickups) { if (o.taken || Math.abs(o.x - P[0]) > R || Math.abs(o.z - P[2]) > R || Math.hypot(o.x - P[0], o.z - P[2]) > R) continue; const id = PICK[o.kind]; if (id) out.push({ src: 'pick', o, id, n: PN[o.kind] || 1, rad: false }); }
    for (const a of this.arrows) if (a.stuck && Math.hypot(a.p[0] - P[0], a.p[2] - P[2]) < R) out.push({ src: 'arrow', a, id: 'arrow', n: 1, rad: false });
    return out; }
  takeNear(e, quiet) { const it = ITEMS[e.id]; if (!it) return 0;
    if (e.src === 'drop') { const d = e.d, i = d.items.indexOf(e.ref); if (i < 0 || !this.drops.includes(d)) return 0; if (this._autoWear(e.id)) { if (e.n <= 1) { d.items.splice(i, 1); if (!d.items.length) { this.drops.splice(this.drops.indexOf(d), 1); if (d.death) this.deathPos = null; } return 1; } e.ref[1] = e.n -= 1; } const kb = this._backFirst(e.id, e.n); if (kb) { if (kb >= e.n) { d.items.splice(i, 1); if (!d.items.length) { this.drops.splice(this.drops.indexOf(d), 1); if (d.death) this.deathPos = null; } return kb; } e.ref[1] = e.n -= kb; } const k = this.inv.add(e.id, e.n, { rad: e.rad || this.world.toxicAt(d.x, d.z) > 0.2 }); if (!k) { if (!quiet) this.ui.toast('Inventário cheio', 'warn'); return 0; }
      if (k < e.n) e.ref[1] = e.n - k; else d.items.splice(i, 1); if (!d.items.length) { this.drops.splice(this.drops.indexOf(d), 1); if (d.death) this.deathPos = null; } if (!quiet) { this.ui.toast(`+${k} ${it.icon} ${it.name}${e.rad ? ' ☢' : ''}`, 'ok'); this.audio.play('pickup'); } this._autoQuick && this._autoQuick(e.id); return k; }
    if (e.src === 'pick') { const o = e.o; if (o.taken) return 0; if (this.inv.room(e.id) < 1) { if (!quiet) this.ui.toast('Inventário cheio', 'warn'); return 0; } const n = e.id === 'stick' ? 1 + (Math.random() < 0.4) : e.n; this.give(e.id, n, quiet); if (o.kind === 'fiber' && Math.random() < 0.4) this.give('leaf', 1, true); if (o.kind === 'fiber') this._worm();
      o.taken = true; o.regrowAt = this.env.day + (o.kind === 'crystal' ? 4 : 1); if (o._grp) o._grp.dirty(o); if (!quiet) this.audio.play('pickup'); return n; }
    if (e.src === 'arrow') { const i = this.arrows.indexOf(e.a); if (i < 0 || this.inv.room('arrow') < 1) return 0; this.arrows.splice(i, 1); this.give('arrow', 1, quiet); return 1; }
    return 0; }
  // dentro da fumaça densa a tela fica cinza (não dá para ver nada)
  _smokeOv() { const e = this.cam.eye; if (!e || !this.blasts) return; const d = this.blasts.clouds.length ? this.blasts.densityAt(e[0], e[1], e[2]) : 0; let el = this._sov; if (!el) { el = document.createElement('div'); el.id = 'smokeOv'; document.body.appendChild(el); this._sov = el; } const o = (d * 0.94).toFixed(2); if (el._o !== o) { el._o = o; el.style.opacity = o; } }
  // clarão da explosão na tela (quem está olhando, sem nada na frente)
  boomFlash(p, s) { const P = this.player, e = this.cam.eye || [P.pos[0], P.pos[1] + 1.6, P.pos[2]]; const d = Math.hypot(p[0] - e[0], p[2] - e[2]); if (d > 90 * s) return;
    const q = [p[0], p[1] + 1, p[2]]; if (this.physics.rayFree(e, q, 0.05) < 0.9) return; const ang = Math.abs(((Math.atan2(p[0] - e[0], p[2] - e[2]) - this.cam.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI); const look = ang < 0.7 ? 1 : ang < 1.4 ? 0.55 : 0.2;
    const k = Math.min(1, s * look * Math.max(0.15, 1 - d / (90 * s))); let el = document.getElementById('boomOv'); if (!el) { el = document.createElement('div'); el.id = 'boomOv'; document.body.appendChild(el); }
    el.style.transition = 'none'; el.style.opacity = k.toFixed(2); void el.offsetWidth; el.style.transition = `opacity ${(0.35 + s * 0.6).toFixed(2)}s ease-out`; el.style.opacity = '0'; }
  // cratera: o chão afunda em volta da explosão (não mexe em estradas, prédios, construções, água e cavernas)
  crater(p, R, depth) { const w = this.world, C = 3, seen = new Set(), list = []; const n = Math.ceil(R / C) + 1;
    for (let i = -n; i <= n; i++) for (let j = -n; j <= n; j++) { const v = w.digVertex(p[0] + i * C, p[2] + j * C); const key = v.gi + ',' + v.gj; if (seen.has(key)) continue; seen.add(key); const dd = Math.hypot(v.x - p[0], v.z - p[2]); if (dd > R) continue;
      const h = w.height(v.x, v.z); if (h < 0.4 || w.caveAt(v.x, v.z) || (w.onRoad && w.onRoad(v.x, v.z, 2.5)) || (w.bldAt && w.bldAt(v.x, v.z)) || this.build.pieces.some((q) => Math.hypot(q.x - v.x, q.z - v.z) < 3.4)) continue;
      const add = depth * (1 - Math.pow(dd / R, 2)); if (add < 0.08) continue; list.push([v.gi, v.gj, Math.min(6, v.d + add)]); }
    if (!list.length) return; w.setDigs(list); this._dropGrass(p[0], p[2], R + 1); const P = this.player; if (Math.hypot(P.pos[0] - p[0], P.pos[2] - p[2]) < R + 2) P.onGround = false; }
  // C4: derruba árvores e quebra rochas no raio
  wreck(p, R) { const w = this.world; let t = 0, r = 0;
    for (const tr of w.trees) { if (tr.felled || Math.abs(tr.x - p[0]) > R || Math.abs(tr.z - p[2]) > R) continue; const d = Math.hypot(tr.x - p[0], tr.z - p[2]); if (d > R) continue; if (!tr.collider) { tr.felled = true; tr.regrowAt = this.env.day + 3; continue; } this._fellTree(tr, Math.atan2(tr.x - p[0], tr.z - p[2])); t++; }
    for (const o of w.rocks) { if (o.mined || Math.abs(o.x - p[0]) > R || Math.abs(o.z - p[2]) > R || Math.hypot(o.x - p[0], o.z - p[2]) > R * 0.8) continue; o.mined = true; o.regrowAt = this.env.day + 3; if (o.collider) o.collider.ghost = true; if (o._grp) o._grp.dirty(o); this.fx.burst([o.x, o.y + 0.5, o.z], 20, [0.55, 0.53, 0.5], 6, 1.0, 0.1); r++; }
    if (t + r) this.audio.play('rockbreak', { at: p, vol: 0.9 }); }
  structCost(type) { return STR.costOf(type, 0); }
  buildAvatarMesh(look) { return buildPlayerMesh(this.playerAssets.skel, { ...LOOK_DEFAULT, ...look }); }
  // multiplayer: entrar no mundo do dono (fotografia do mundo) — o personagem de cada um fica salvo no próprio navegador
  _mpKey() { return 'ilhaperdida_mp_' + (this.net.worldName || 'mundo').replace(/[^a-z0-9]/gi, '_').slice(0, 30); }
  _mpEnterClient(s) {
    this.audio.init(); this.resetWorld(); const w = this.world; this.netClient = true;
    const M = w.mods; for (const k of ['trees', 'treeHp', 'rocks', 'bushes', 'pickups', 'hives']) for (const [id, v] of (s.world && s.world[k]) || []) M[k].set(id, v); this.stream.reapply();
    this.openDoors = new Set(s.world.openDoors || []); this.brokenGlass = new Set(s.world.brokenGlass || []); this.graves = (s.world.graves || []).map(([x, y, z, rot, name]) => ({ x, y, z, rot, name }));
    const C = new Map(w.crates.map((o) => [o.id, o])); for (const [id, at] of s.world.crates || []) { const o = C.get(id); if (o) { o.looted = true; o.regrowAt = at; } }
    for (const [id, at] of s.world.specials || []) { const o = w.specials[id]; if (o) { o.taken = true; o.regrowAt = at; this.groups.ratfold.dirty(o); } }
    const CA = new Map(w.props.filter((q) => q.kind === 'car').map((q) => [q.id, q])); for (const [id, at] of s.world.cars || []) { const o = CA.get(id); if (o) { o.looted = true; o.regrowAt = at; } }
    this._dirtyAll(); this.build.load(s.pieces || []); (s.pieces || []).forEach((r) => { const p = this.build.pieces.find((q) => Math.abs(q.x - r.x) < 1e-3 && Math.abs(q.z - r.z) < 1e-3 && Math.abs(q.y - r.y) < 1e-3 && q.type === r.type && !q.uid); if (p) p.uid = r.uid; });
    this.drops = (s.drops || []).map((d) => ({ ...d, items: (d.items || []).filter((it) => ITEMS[it[0]]) })); this.logs = (s.logs || []).map(([x, y, z, rot]) => ({ x, y, z, rot })); this.env.load(s.env);
    const mine = this._loadJSON(this._mpKey()); const P = this.player;
    if (mine && mine.inv) { this.inv.load(mine.inv); this.equip = { ...this.freshEquip(), ...mine.equip }; this.quick = mine.quick || Array(8).fill(null); this.stream.flush(mine.pos); P.revive(); P.setPosition(...mine.pos); Object.assign(P.stats, mine.stats || {}); P.stats.hp = Math.max(1, P.stats.hp); }
    else { this.equip = this.freshEquip(); this.inv.load([]); this.quick = Array(8).fill(null); const hp = (s.host && s.host.pos) || [w.spawn.x, w.spawn.y, w.spawn.z]; const x = hp[0] + 3, z = hp[2] + 3; this.stream.flush([x, 0, z]); P.revive(); P.setPosition(x, Math.max(this.world.height(x, z), 0), z); this.freshBody(); Object.assign(P.stats, { hunger: 85, thirst: 80, energy: 90 }); }
    this._applyBack(); this.syncHand(); this.applyLook && this.applyLook(); this.cam.pivot = null; this.playTime = 1; this.start();
  }
  _mpSavePlayer() { const P = this.player; if (!this.netClient || P.dead) return; this._saveJSON(this._mpKey(), { pos: P.pos.map((v) => +v.toFixed(2)), stats: { ...P.stats }, inv: this.inv.serialize(), equip: { ...this.equip, debugHand: undefined }, quick: this.quick }); }
  _mpRestore() { this._mpSavePlayer(); this.netClient = false; this.resetWorld(); }
  // projeto aberto nas mãos durante a animação de construir
  _renderSheet(items) { const P = this.player, A = P.anim.action; if (!A || A.clip !== P.clips.blueprint || A.ending) return; const I = P.assets.skel.index; const W = mat4.mul(mat4.create(), P.model, P.anim.world[I.chest]); const m = mat4.mul(mat4.create(), W, mat4.fromTRS(mat4.create(), [0, 0.02, 0.5], quat.fromEuler(-0.25, 0, 0), [1, 1, 1])); items.push({ mesh: this._sheetMesh, model: m, sphere: [P.pos[0], P.pos[1] + 1.3, P.pos[2], 1.5], doubleSided: true }); }
  _updateProjectiles(dt) {
    const P = this.player; const keep = [];
    for (const b of this.projectiles) {
      b.life -= dt; const steps = Math.max(3, Math.ceil(Math.hypot(...b.v) * dt / 0.3)); let dead = b.life <= 0;
      if (b.missile) {
        b.age += dt; const tgt = [P.pos[0], P.pos[1] + 1.0, P.pos[2]]; const sp = Math.hypot(...b.v); const want = [tgt[0] - b.p[0], tgt[1] - b.p[1], tgt[2] - b.p[2]]; const wl = Math.hypot(...want) || 1;
        const turn = Math.min(1, dt * (b.age > 0.35 ? 1.5 : 0.2)); for (let k = 0; k < 3; k++) b.v[k] += ((want[k] / wl) * sp - b.v[k]) * turn;
        const nl = Math.hypot(...b.v) || 1; for (let k = 0; k < 3; k++) b.v[k] = (b.v[k] / nl) * Math.min(22, sp + dt * 4);
        this.fx.parts.push({ p: b.p.slice(), v: [(Math.random() - 0.5) * 0.3, 0.4, (Math.random() - 0.5) * 0.3], life: 1.1, max: 1.1, col: [0.55, 0.55, 0.55], size: 0.22, grav: -0.3, smoke: true });
        if (dead) { this.explode(b.p, b.src); continue; }
      }
      for (let k = 0; k < steps && !dead; k++) {
        b.p[0] += b.v[0] * dt / steps; b.p[1] += b.v[1] * dt / steps; b.p[2] += b.v[2] * dt / steps;
        if (this.net.host && this.net.peers.size) { let hitAv = null; for (const pr of this.net.peers.values()) { const c = pr.av; if (!c || c.dead) continue; const ay = Math.max(c.pos[1] + 0.2, Math.min(c.pos[1] + 1.7, b.p[1])); if (Math.hypot(b.p[0] - c.pos[0], b.p[1] - ay, b.p[2] - c.pos[2]) < (b.missile ? 0.8 : 0.45)) { hitAv = pr; break; } } if (hitAv) { if (b.missile) this.explode(b.p, b.src); else if (!b.web) this.net.sendHitTo(hitAv.id, b.dmg, { ranged: true, shot: true }, b.src); dead = true; break; } }
        const dy = Math.max(P.pos[1] + 0.2, Math.min(P.pos[1] + 1.7, b.p[1])); const dd = Math.hypot(b.p[0] - P.pos[0], b.p[1] - dy, b.p[2] - P.pos[2]);
        if (!P.dead && dd < (b.missile ? 0.8 : 0.45)) { if (b.missile) this.explode(b.p, b.src); else if (b.web) { P.webbed = Math.max(P.webbed || 0, 4); this.damage(b.dmg, 'teia da aranha', true); this.audio.play('webHit'); if (!this._webT || this.env.elapsed - this._webT > 3) { this._webT = this.env.elapsed; this.ui.toast('🕸 Você foi atingido por teia! Está mais lento.', 'warn'); } } else { const head = b.p[1] - P.pos[1] > (P.crouch ? 1.05 : 1.5); const hm = head ? (this.equip.hat === 'milhelmet' ? 2 : 5) : 1; if (head && this.equip.hat === 'milhelmet') this.wear('hat', 200); this.playerHit(b.dmg * hm, b.src, { ranged: true }); if (head) this.ui.toast(this.equip.hat === 'milhelmet' ? '⛑️ O capacete segurou o tiro na cabeça!' : '💥 Tiro na cabeça!', 'warn'); } dead = true; break; }
        if (b.p[1] < this.world.height(b.p[0], b.p[2])) { dead = true; if (b.missile) this.explode(b.p, b.src); break; }
        { let wall = null; for (const c of this.physics.query(b.p[0], b.p[2], 0.2)) { if (c.ghost || c.dyn || c.creature || c.player || c.camOnly) continue; if (b.p[1] < c.y0 || b.p[1] > c.y1 || !this.physics.insideXZ(c, b.p[0], b.p[2], 0)) continue; if (c.glass) { this.breakGlass(c.glass, b.p.slice()); continue; } wall = c; break; }
          if (wall) { dead = true; if (b.missile) this.explode(b.p, b.src); else this.fx.burst(b.p.slice(), 6, [1, 0.8, 0.4], 2.5, 0.25, 0.03); break; } }
        if (this.physics.pointBlocked(b.p[0], b.p[1], b.p[2], 0.02, null)) { if (b.missile) this.explode(b.p, b.src); else this.fx.burst(b.p, 8, [1, 0.6, 0.25], 2.5, 0.25, 0.04); dead = true; }
      }
      if (!dead) keep.push(b);
    }
    this.projectiles = keep;
  }
  knockback(yaw, force) { const P = this.player; if (P.dead) return; P.vel[0] += Math.sin(yaw) * force; P.vel[2] += Math.cos(yaw) * force; if (!P.swimming) { P.vel[1] = 4; P.onGround = false; P.airTime = 0.3; } }
  // ---------- cavar com a picareta: abre um buraco (até 6 m), dá areia; as paredes ficam com no máximo ~45° (alargue para ir mais fundo) ----------
  // faca na mão + olhando para o chão: cavar a terra para tirar minhocas (não tem na areia da praia, no deserto nem na neve)
  wormSpot() { const P = this.player, w = this.world; if (!P.onGround || P.swimming || P.climb || this.vehicles.driving || (this.cam.pitch || 0) < 0.5) return null;
    const x = P.pos[0] + Math.sin(P.yaw) * 1.1, z = P.pos[2] + Math.cos(P.yaw) * 1.1, h = w.height(x, z); if (h < WATER + 0.05) return null;
    const bio = w.biome(x, z); if (h < 2.8 || bio === 'desert' || bio === 'snow') return null; if (this.inCaveAt && this.inCaveAt(P.pos)) return null;
    const key = Math.floor(x / 4) + ',' + Math.floor(z / 4); this._wormDug = this._wormDug || {}; const day = this.env.elapsed / this.env.dayLength;
    if (this._wormDug[key] && day - this._wormDug[key] < 1) return { ok: false, x, z, key, why: 'já cavou aqui — tente outro lugar' };
    if (this.inv.room('bait_worm') < 1) return { ok: false, x, z, key, why: 'sem espaço para minhocas' };
    return { ok: true, x, z, y: h, key, bio }; }
  digWorms(ws) { const day = this.env.elapsed / this.env.dayLength; this._wormDug = this._wormDug || {}; this._wormDug[ws.key] = day;
    this.fx && this.fx.burst && this.fx.burst([ws.x, ws.y + 0.05, ws.z], 10, [0.32, 0.24, 0.16], 2.2, 0.5, 0.05, 6);
    const rain = this.env.cur.rain > 0.3, n = Math.random() < (ws.bio === 'swamp' || rain ? 0.95 : 0.75) ? 1 + (Math.random() < (rain ? 0.6 : 0.3) ? 1 : 0) + (Math.random() < 0.12 ? 1 : 0) : 0;
    if (!n) { this.ui.toast('Cavou, mas não achou minhoca aqui', 'info'); return 0; }
    const got = this.give('bait_worm', n, true); this.ui.toast(`🪱 Tirou ${n} minhoca${n > 1 ? 's' : ''} da terra (isca de pesca)`, 'info'); return n; }
  digTarget() { const P = this.player, w = this.world; const fx = P.pos[0] + Math.sin(P.yaw) * 1.4, fz = P.pos[2] + Math.cos(P.yaw) * 1.4; const v = w.digVertex(fx, fz); v.h = w.height(v.x, v.z); return v; }
  digBlocked(v) { const w = this.world, R = 3.4; const near = (o) => Math.abs(o.x - v.x) < R && Math.abs(o.z - v.z) < R;
    if (w.trees.some((t) => near(t))) return 'Raízes de árvore aqui — cave mais longe das árvores';
    if (w.rocks.some((o) => near(o) && !o.mined)) return 'Há uma rocha aqui — minere-a primeiro';
    if (this.build.pieces.some((p) => near(p))) return 'Tem uma construção em cima';
    if (w.bushes.some((o) => Math.abs(o.x - v.x) < 2.6 && Math.abs(o.z - v.z) < 2.6)) return 'Tem um arbusto aqui — cave um pouco mais longe';
    if (w.pickups.some((o) => !o.taken && Math.abs(o.x - v.x) < 2.4 && Math.abs(o.z - v.z) < 2.4)) return 'Pegue primeiro o que está no chão aqui';
    if (this.world.cityAt && this.world.cityAt(v.x, v.z, 8)) return 'Chão de cidade é duro demais para cavar';
    if (this.world.onRoad(v.x, v.z, 1.5)) return 'Não dá para cavar a estrada';
    if (this.physics.query(v.x, v.z, 2.5).some((c) => !c.dyn && !c.piece && this.physics.insideXZ(c, v.x, v.z, 2.2))) return 'Tem algo construído aqui';
    if (v.h - 0.5 < WATER + 0.8) return 'Mais fundo a água invadiria o buraco';
    return null; }
  dig(v, hand) { const w = this.world; const why = this.digBlocked(v); if (why) { this.audio.play('mine'); this.ui.toast('⛏ ' + why, 'warn'); return false; }
    const MAX = 6, STEP = 0.5; if (v.d >= MAX) { this.ui.toast('⛏ Fundo máximo do buraco (6 m)', 'info'); return false; }
    let nmin = 1e9; for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) nmin = Math.min(nmin, (w.digs.get((v.gj + b) * (64 * 54 + 1) + v.gi + a) || 0));
    if (v.d + STEP > nmin + 3) { this.audio.play('mine'); this.ui.toast('⛏ Alargue o buraco (cave ao redor) para ir mais fundo', 'warn'); return false; }
    w.setDig(v.gi, v.gj, v.d + STEP); this._dropGrass(v.x, v.z, 4); this.audio.play('mine'); this.fx.burst([v.x, v.h + 0.2, v.z], 18, [0.55, 0.45, 0.3], 3, 0.7, 0.08, -3); this.cam.shake = 0.12;
    const de = w.biome(v.x, v.z) === 'desert'; this.give(de ? 'sand' : 'dirt', de ? 3 : 2); if (Math.random() < (v.d > 2 ? 0.35 : 0.12)) this.give('stone', 1); if (w.toxicAt && w.toxicAt(v.x, v.z) > 0 && Math.random() < 0.2) this.give('scrap', 1);
    this.digCount = (this.digCount || 0) + 1; return true; }
  _meleeHit(dmg, reach, type) {
    const P = this.player; let best = null, bd = 1e9;
    for (const c of this.creatures.list) { if (c.dead) continue; const dx = c.pos[0] - P.pos[0], dz = c.pos[2] - P.pos[2]; const d = Math.hypot(dx, dz) - c.def.radius * c.def.scale;
      if (d > reach || Math.abs(c.pos[1] - P.pos[1]) > 1.8) continue; if (this.physics.rayFree([P.pos[0], P.pos[1] + 1.1, P.pos[2]], [c.pos[0], c.pos[1] + 0.6 * c.def.scale, c.pos[2]], 0.02, null) < 0.97) continue; const ang = Math.abs(angleDiff(P.yaw, Math.atan2(dx, dz))); if (ang > 1.0) continue; if (d < bd) { bd = d; best = c; } }
    if (best) { const crit = P.crouch && best.state === 'wander' ? 2 : 1; this.creatures.damage(best, dmg * crit * (this.admin ? this.admin.dmgMul(best) : 1), P.yaw); if (crit > 1) this.ui.toast('Ataque furtivo! Dano dobrado', 'ok'); this.cam.shake = 0.25; if (type === 'punch') this.audio.play('punch'); }
    return !!best;
  }
  // tronco caído: cada golpe de machado solta lascas; ao final vira galhos e fibra e o tronco some
  _chopLog(l, hand) {
    if (!this.logs.includes(l)) return; l.hp = (l.hp ?? 3) - (hand.chop || 1); this.audio.play('chop');
    this.fx.burst([l.x, l.y + 0.35, l.z], 14, [0.75, 0.6, 0.38], 3, 0.6, 0.05);
    if (l.hp > 0) return;
    this.logs.splice(this.logs.indexOf(l), 1);
    this.fx.burst([l.x, l.y + 0.3, l.z], 30, [0.55, 0.42, 0.28], 4, 0.9, 0.07); this.audio.play('rockbreak', { vol: 0.5 });
    this.give('stick', 3 + Math.floor(Math.random() * 3)); this.give('fiber', 2 + Math.floor(Math.random() * 2));
  }
  // flechas: projéteis com gravidade; cravam no cenário e podem ser recolhidas
  // projéteis do jogador (balas e flechas) com gravidade e arrasto; flechas cravam e podem ser recolhidas
  // feixe de tiro: o rastro some rapidinho quando a bala acerta algo
  _streakEnd(a) { const sp = Math.hypot(...a.v) || 1; (this.streaks = this.streaks || []).push({ p: a.p.slice(), d: a.v.map((x) => x / sp), L: this._streakLen(a), t: 0.07, max: 0.07 }); }
  _streakLen(a) { const sp = Math.hypot(...a.v); return Math.min(a.dist + 0.3, Math.max(2.2, Math.min(9, sp * 0.032))); }
  spawnShot(p, v, o) { if (o.from) o.off = [o.from[0] - p[0], o.from[1] - p[1], o.from[2] - p[2]]; this.arrows.push({ p: p.slice(), v: v.slice(), v0: Math.hypot(...v), dist: 0, life: Math.max(2, (o.range || 200) / Math.hypot(...v) * 2.5), stuck: false, ...o });
    if (this.arrows.length > 160) { const i = this.arrows.findIndex((a) => a.stuck); this.arrows.splice(i >= 0 ? i : 0, 1); } }
  // impacto do foguete / granada
  _boom(a, p) { const q = [p[0], p[1] + 0.1, p[2]];
    if (a.boom === 'rocket') this.explode(q, null, { r: 5.5, dmg: 170, playerDmg: 85, pr: 5, kind: 'rocket', cause: 'foguete', vis: 'frag', crater: [3.5, 0.7], flash: 1 });
    else if (a.btype === 'gren_gas') { this.audio.play('steam', { at: q }); this.fx.burst(q, 18, [0.4, 0.7, 0.2], 3, 0.8, 0.2, -0.5); this.clouds.push({ p: q, r: 5, t: 12, max: 12, kind: 'gas', emit: 0 }); }
    else if (a.btype === 'gren_smoke') { this.audio.play('steam', { at: q }); this.fx.burst(q, 18, [0.7, 0.7, 0.72], 3, 0.8, 0.2, -0.5); this.clouds.push({ p: q, r: 6.5, t: 20, max: 20, kind: 'smoke', emit: 0 }); }
    else this.explode(q, null, { r: 4.5, dmg: 75, playerDmg: 45, pr: 4.2, kind: 'grenade', cause: 'granada', vis: 'frag', crater: [3, 0.5], flash: 1 }); }
  _updateClouds(dt) { const P = this.player; this.clouds = (this.clouds || []).filter((c) => (c.t -= dt) > 0);
    for (const c of this.clouds) { const f = Math.min(1, c.t / 3); c.emit -= dt; if (c.emit <= 0 && !c.noFx) { c.emit = 0.06; for (let k = 0; k < 3; k++) { const a = Math.random() * 6.283, d = Math.sqrt(Math.random()) * c.r * 0.9; const col = c.kind === 'gas' ? [0.42 + Math.random() * 0.1, 0.68, 0.22] : [0.66, 0.66, 0.68];
          this.fx.parts.push({ p: [c.p[0] + Math.cos(a) * d, c.p[1] + Math.random() * 1.6, c.p[2] + Math.sin(a) * d], v: [(Math.random() - 0.5) * 0.4, 0.15, (Math.random() - 0.5) * 0.4], life: 3.2 * f + 0.5, max: 3.2 * f + 0.5, col, size: 1.1 + Math.random() * 0.6, grav: -0.03, smoke: true }); } }
      if (c.kind === 'gas') { if (!P.dead && Math.hypot(P.pos[0] - c.p[0], P.pos[2] - c.p[2]) < c.r && Math.abs(P.pos[1] - c.p[1]) < 3 && !this.equip.suit) { this._gasT = (this._gasT || 0) - dt; if (this._gasT <= 0) { this._gasT = 1; this.damage(5, 'gás tóxico', true); this.audio.play('cough'); this.cam.shake = Math.max(this.cam.shake, 0.15); } }
        for (const k of this.creatures.list) if (!k.dead && !k.def.heavyArmor && Math.hypot(k.pos[0] - c.p[0], k.pos[2] - c.p[2]) < c.r) { k._gasT = (k._gasT || 0) - dt; if (k._gasT <= 0) { k._gasT = 1; this.creatures.damage(k, k.def.robot ? 6 : 12, 0, 'gas'); } } } } }
  // a fumaça bloqueia a visão
  smokeBlocks(a, b) { for (const c of this.clouds || []) { if (c.kind !== 'smoke' || c.t < 1.5) continue; const dx = b[0] - a[0], dz = b[2] - a[2]; const L2 = dx * dx + dz * dz || 1; let t = ((c.p[0] - a[0]) * dx + (c.p[2] - a[2]) * dz) / L2; t = Math.max(0, Math.min(1, t));
      if (Math.hypot(a[0] + dx * t - c.p[0], a[2] + dz * t - c.p[2]) < c.r * 0.8) return true; } return false; }
  spawnArrow(p, v, dmg) { this.spawnShot(p, v, { dmg, arrow: true, range: 140 }); }
  _updateArrows(dt) {
    const keep = [];
    for (const a of this.arrows) {
      if (a.stuck) { a.life -= dt; if (a.life > 0) keep.push(a); continue; }
      a.life -= dt; if (a.life <= 0) { if (a.boom) this._boom(a, a.p); continue; }
      if (a.boom) { const sp = Math.hypot(...a.v) || 1; const back = [a.p[0] - a.v[0] / sp * 0.4, a.p[1] - a.v[1] / sp * 0.4, a.p[2] - a.v[2] / sp * 0.4]; if (a.boom === 'rocket') { this.fx.parts.push({ p: back, v: [(Math.random() - 0.5) * 0.4, 0.3, (Math.random() - 0.5) * 0.4], life: 1.6, max: 1.6, col: [0.62, 0.62, 0.62], size: 0.3, grav: -0.2, smoke: true }); this.fx.burst(back, 2, [6, 3, 0.8], 1, 0.08, 0.06, 0); } else if (Math.random() < 0.5) this.fx.parts.push({ p: back, v: [0, 0.2, 0], life: 0.7, max: 0.7, col: [0.5, 0.5, 0.5], size: 0.1, grav: -0.1, smoke: true }); }
      // integração em subpassos (balas rápidas percorrem vários metros por quadro)
      const steps = Math.max(1, Math.ceil(Math.hypot(...a.v) * dt / 12)); const h = dt / steps; let done = false;
      for (let s = 0; s < steps && !done; s++) {
        a.v[1] -= 9.8 * h * (a.grav ?? 1); if (a.drag) { const k = 1 - a.drag * h * 10; a.v[0] *= k; a.v[1] *= k; a.v[2] *= k; }
        const sp = Math.hypot(...a.v); const L = sp * h; const d = a.v.map((x) => x / sp); const prev = a.p.slice();
        const hit = this.guns.trace(a.p, d, L);
        if (!hit) { a.p = [a.p[0] + a.v[0] * h, a.p[1] + a.v[1] * h, a.p[2] + a.v[2] * h]; a.dist += L; continue; }
        done = true; a.p = hit.p.slice(); a.dist += hit.t; if (a.tracer) this._streakEnd(a);
        if (a.boom) { this._boom(a, hit.p); break; }
        if (hit.heli) { const pil = this.helis.shot(hit.heli, hit.part, a.dmg * (a.arrow ? 0.6 : 1), hit.p); if (pil) { this.guns.hitMark = 0.18; this.guns.hitKill = hit.heli.state === 'fall'; this.guns.lastHitRegion = 'head'; this.audio.play('hitmark'); } break; }
        if (hit.c) {
          let mult = { head: 2.4, neck: 1.8, torso: 1, limb: 0.6 }[hit.region] || 1; const c = hit.c;
          if (hit.region === 'head') mult = a.dmg >= 20 && c.def.hp <= 300 ? 999 : 4; // tiro na cabeça: morte na hora (exceto chefes)
          const fall = a.arrow ? Math.min(1.2, sp / 45) : Math.max(0.35, Math.min(1, sp / a.v0) * (a.dist > a.falloff ? Math.max(0.35, 1 - (a.dist - a.falloff) / (a.range * 1.2)) : 1));
          this.creatures.damage(c, a.dmg * mult * fall * (this.admin ? this.admin.dmgMul(c) : 1), Math.atan2(d[0], d[2]));
          if (a.arrow) this.audio.play('arrowHit'); else if (c.def.robot) this.fx.burst(hit.p, 8, [3, 2.2, 1], 5, 0.25, 0.025, 6); else this.fx.burst(hit.p, 10, [0.55, 0.04, 0.04], 2.5, 0.5, 0.04);
          this.guns.hitMark = 0.18; this.guns.hitKill = c.dead; this.guns.lastHitRegion = hit.region; this.audio.play('hitmark');
          if (a.arrow && Math.random() < 0.5) { const gy = this.world.height(a.p[0], a.p[2]); keep.push({ p: [a.p[0], gy + 0.05, a.p[2]], v: [d[0], -0.3, d[2]], stuck: true, arrow: true, life: 120 }); }
          break;
        }
        if (hit.col && hit.col.piece && this.territory && this.territory.shot(hit.col.piece, a.dmg * (a.arrow ? 0.3 : 1), hit.p)) { /* tiro na tranca */ } else if (hit.col && hit.col.piece && this.struct) this.struct.shot(hit.col.piece, a.dmg * (a.arrow ? 0.4 : 1), hit.p);
        this.guns._impact(hit);
        if (a.arrow) { this.audio.play('arrowHit', { vol: 0.7 }); if (Math.random() < 0.85) { a.stuck = true; a.life = 120; a.v = d; keep.push(a); } }
      }
      if (!done) keep.push(a);
    }
    this.arrows = keep;
  }
  _chop(t, hand) {
    if (t.felled) return; t.hp -= hand.chop; this.audio.play('chop');
    const P = this.player; const hp = [t.x - Math.sin(P.yaw) * 0.3, t.y + 1.1, t.z - Math.cos(P.yaw) * 0.3];
    this.fx.burst(hp, 12, [0.75, 0.6, 0.38], 3, 0.6, 0.05);
    if (Math.random() < 0.35) this.give('stick', 1, true); if (Math.random() < 0.3) this.give('leaf', 1, true);
    if (t.hp <= 0) this._fellTree(t);
  }
  _fellTree(t, dirOverride) {
    const P = this.player; t.felled = true; t.regrowAt = this.env.day + 3; t.collider.ghost = true; this.groups[t.type].dirty(t); this.groups.stump.dirty(t);
    for (const hv of this.world.hives) if (hv.tree === t) { hv.angry = 30; hv.robbed = 40; this.ui.toast('🐝 Você derrubou uma colmeia! As abelhas atacam!', 'warn'); }
    const dir = dirOverride ?? Math.atan2(t.x - P.pos[0], t.z - P.pos[2]); this.falling.push({ t, dir, a: 0, v: 0, time: 0 }); this.audio.play('treefall');
    this.ui.toast('🌲 Madeira! A árvore está caindo', 'info');
  }
  _updateFalling(dt) {
    for (const f of [...this.falling]) {
      f.time += dt; f.v += dt * 2.2 * (0.3 + Math.sin(f.a)); f.a = Math.min(Math.PI / 2 - 0.05, f.a + f.v * dt);
      if (f.a >= Math.PI / 2 - 0.06 && !f.done) {
        f.done = true; this.cam.shake = Math.max(this.cam.shake, 0.4);
        const t = f.t; const n = t.type === 'dead' ? 1 : t.type === 'palm' ? 2 : 3; const len = (P.TREE_INFO[t.type].h * t.s) * 0.75;
        for (let i = 0; i < n; i++) { const d = 1.8 + (i + 0.5) * (len / n) * 0.9; const x = t.x + Math.sin(f.dir) * d, z = t.z + Math.cos(f.dir) * d; this.logs.push({ x, y: this.world.height(x, z), z, rot: f.dir + Math.PI / 2 }); }
        const bx = t.x + Math.sin(f.dir) * len * 0.8, bz = t.z + Math.cos(f.dir) * len * 0.8; this.dropItem('leaf', 2 + Math.floor(Math.random() * 3), [bx, t.y, bz]); this.dropItem('stick', 2, [bx, t.y, bz]);
        this.fx.burst([bx, this.world.height(bx, bz) + 0.5, bz], 30, [0.35, 0.5, 0.25], 4, 1.0, 0.08);
      }
      if (f.time > 3.2) this.falling.splice(this.falling.indexOf(f), 1);
    }
  }
  _mine(o, hand) {
    if (o.mined) return; o.hp -= hand.mine || 1; this.audio.play('mine');
    this.fx.burst([o.x, o.y + 0.8 * o.s, o.z], 10, [0.6, 0.58, 0.55], 3.5, 0.5, 0.05); this.fx.burst([o.x, o.y + 0.9 * o.s, o.z], 4, [1, 0.9, 0.5], 4, 0.2, 0.03);
    this.give('stone', 1 + (Math.random() < 0.5 ? 1 : 0));
    if (o.rich && Math.random() < 0.45) this.give('scrap', 1); if (o.rich && Math.random() < 0.15) this.give('crystal', 1);
    if (o.hp <= 0) { o.mined = true; o.regrowAt = this.env.day + 3; o.collider.ghost = true; o._grp.dirty(o); this.audio.play('rockbreak'); this.fx.burst([o.x, o.y + 0.5, o.z], 30, [0.55, 0.53, 0.5], 4, 0.9, 0.09); this.give('stone', 2); this.ui.toast('🪨 Rocha quebrada', 'info'); }
  }
  onCreatureKilled(c) { if (c.convoy && this.convoys) this.convoys.onKilled(c); if (c.garrison !== undefined) { const st = this.world.sites[c.garrison]; if (st) { st.garDead = (st.garDead || 0) + 1; if (st.garDay === undefined) st.garDay = this.env.day; } } if (c.npc) { const H = c.group && (c.group[0] === 'c' ? this.world.camps[+c.group.slice(1)] : this.world.sites[+c.group.slice(1)]); if (H) { H.npcDead = (H.npcDead || 0) + 1; if (!H.npcRespawn || H.npcRespawn <= this.env.day) H.npcRespawn = this.env.day + 3; } this.stats.kills++; this.ui.toast(`☠ ${c.def.name} abatido. E para revistar — com faca ou machado na mão, E para picotar.`, 'ok'); return; } if (c.kind === 'mecha') { const st = this.world.sites[c.siteId]; if (st) st.mechaRespawn = this.env.day + 3; this.explode([c.pos[0], c.pos[1] + 2, c.pos[2]], c, { r: 6, dmg: 0.01, playerDmg: 30, pr: 5 }); this.ui.toast('💥 Mecha destruído!', 'ok'); this.ui.feed && this.ui.feed(`Mecha de combate foi destruído por ${this.playerName ? this.playerName() : 'você'}`); }
    if (c.def.robot && c.kind !== 'mecha' && this.world.toxicAt(c.pos[0], c.pos[2]) > 0 && Math.random() < 0.12) c.extraLoot = [['rocket', 1]];
 if (c.kind === 'spidertank') { const gy = this.world.height(c.pos[0], c.pos[2]); this.drops.push({ items: rollLoot('milcrate', Math.random, {}).filter(([, q]) => q > 0), x: c.pos[0] + 0.8, y: gy, z: c.pos[2], box: true, rot: c.yaw }); this.ui.toast('📦 A caixa das costas da aranha caiu — dá para lootear!', 'info'); } this.stats.kills++; this.ui.toast(c.def.robot ? `🤖 ${c.def.name} destruído. Pressione E para desmontar (sucata e peças).` : `${c.def.name} abatido. Pressione E para coletar carne.`, 'ok'); }
  onPanelClosed() { if (this.state === 'playing' && !this.input.touchActive) this.input.requestLock(); }

  // ---------- Renderização ----------
  _dropGrass(x, z, R) { const GS = 16, gl = this.renderer.gl; for (let i = Math.floor((x - R) / GS); i <= Math.floor((x + R) / GS); i++) for (let j = Math.floor((z - R) / GS); j <= Math.floor((z + R) / GS); j++) { const k = i + ',' + j, c = this.grassCells.get(k); if (!c) continue; for (const b of [c.g, c.f]) if (b) { gl.deleteBuffer(b.mb); gl.deleteBuffer(b.cb); gl.deleteVertexArray(b.vao); } this.grassCells.delete(k); } }
  _grass(items, cam) {
    if (this.settings.grass <= 0) return; const GS = 16, R = this.settings.viewDist === 'curta' ? 2 : 3; const ci = Math.floor(cam[0] / GS), cj = Math.floor(cam[2] / GS);
    const keep = new Set(); const w = this.world;
    for (let i = ci - R; i <= ci + R; i++) for (let j = cj - R; j <= cj + R; j++) {
      const key = i + ',' + j; keep.add(key); let c = this.grassCells.get(key);
      if (!c) {
        const r = rng((i * 73856093) ^ (j * 19349663)); const n = Math.floor(170 * this.settings.grass); const gm = [], fm = []; const tmp = mat4.create(); const gc = [], fc = [];
        for (let k = 0; k < n; k++) { const x = (i + r()) * GS, z = (j + r()) * GS; const h = w.height(x, z); if (h < 2.6 || h > 68) continue; if (w.normal(x, z)[1] < 0.8) continue;
          if (w.inRuins(x, z) && (r() < 0.75 || w.onRoad(x, z) || this.physics.query(x, z, 0.2).some((k) => k.platform && this.physics.insideXZ(k, x, z, 0)))) continue; if (w.caveAt(x, z) || w.isDug(x, z)) continue; if (w.onRoad(x, z, 0.3) && r() < 0.9) continue; const s = 0.6 + r() * 0.5;
          mat4.fromTRS(tmp, [x, h - 0.03, z], quat.fromEuler(0, r() * 6.28, 0), [s, s * (0.8 + r() * 0.5), s]);
          if (r() < 0.06) { fm.push(...tmp); fc.push(1, 1, 1, 1); } else { gm.push(...tmp); const v = 0.85 + r() * 0.3; gc.push(v, v * (0.95 + r() * 0.1), v * 0.9, 1); } }
        c = { g: gm.length ? this.renderer.createInstanced(this.grassMesh, new Float32Array(gm), new Float32Array(gc)) : null, f: fm.length ? this.renderer.createInstanced(this.flowerMesh, new Float32Array(fm), new Float32Array(fc)) : null };
        this.grassCells.set(key, c);
      }
      const gt = this.foliageTex; if (c.g) items.push({ batch: c.g, wind: true, shadow: false, doubleSided: true, tex: gt, alphaTest: true }); if (c.f) items.push({ batch: c.f, wind: true, shadow: false, doubleSided: true, tex: gt, alphaTest: true });
    }
    if (this.grassCells.size > 120) for (const [k, c] of this.grassCells) if (!keep.has(k)) { const gl = this.renderer.gl; for (const b of [c.g, c.f]) if (b) { gl.deleteBuffer(b.mb); gl.deleteBuffer(b.cb); gl.deleteVertexArray(b.vao); } this.grassCells.delete(k); }
  }
  render(dt) {
    const r = this.renderer, P = this.player, cam = this.cam, items = [];
    r.beginFrame();
    const eye = cam.eye, inCave = !this.menuMode && P.inCave;
    this.env.apply(r, P.pos, inCave);
    r.setCamera(eye, cam.target, cam.fov, 0.1, 1800);
    r.setShadowCenter(this.menuMode ? cam.target : [P.pos[0], P.pos[1], P.pos[2]]);
    const maxD = this.settings.viewDist === 'curta' ? 260 : 520;
    this.stream.update(this.menuMode ? cam.target : P.pos); r.waterOff = [Math.round(eye[0] / 12.5) * 12.5, Math.round(eye[2] / 12.5) * 12.5];
    this.stream.terrainItems(items, eye, maxD);
    const objD = this.settings.viewDist === 'curta' ? 170 : 300;
    for (const [k, g] of Object.entries(this.groups)) { const d = ['stick', 'stone', 'fiber', 'mushroom', 'crystal', 'stump'].includes(k) ? 80 : k.startsWith('bush') ? 140 : objD; for (const gg of (Array.isArray(g) ? g : [g])) gg.render(items, eye, d); }
    this._grass(items, eye);
    this.stream.siteItems(items);
    if (!this.menuMode) { this._renderExtras(items, eye); this._renderBlood(items); }
    for (const c of this.caveMeshes) items.push({ mesh: c.mesh, sphere: [c.c.x, c.c.y + 3, c.c.z, c.c.R + 8], doubleSided: true });
    this.build.renderItems(items); this.power.render(items); this.grapple.render(items); this.geiger.render(items); this.grenades.render(items); this.fires.render(items); this.smoke.render(items, eye); this.blasts.render(items); this.helis.render(items, eye); this.territory.render(items, eye); this.fishing.render(items); this.struct.render(items, eye); this._renderSheet(items); if (!this._porterMesh) this._porterMesh = this.renderer.createMesh(porterLoadMesh()); this.convoys.render(items, this._porterMesh); this.npcs.render(items, eye, (wid) => { const id = { club: 'scrapaxe', knife: 'scrapknife' }[wid] || wid; return this.tools[id]; });
    if (P.rig) { if (!this.rigMeshes) this.rigMeshes = { mag: r.createMesh(magMesh()), shell: r.createMesh(MXS.shellMesh()), bolt: this.grapple.boltMesh }; P.rig.render(items, this.rigMeshes); }
    const I = mat4.create();
    for (const f of this.falling) { const t = f.t; const ax = [Math.cos(f.dir), 0, -Math.sin(f.dir)]; const s = Math.sin(f.a / 2); const q = [ax[0] * s, 0, ax[2] * s, Math.cos(f.a / 2)];
      const m = mat4.fromTRS(mat4.create(), [t.x, t.y + 0.5, t.z], q, [1, 1, 1]); mat4.mul(m, m, mat4.compose([0, -0.5, 0], t.rot, t.s)); items.push({ mesh: this.treeMeshes[t.type], model: m, sphere: [t.x, t.y + 4, t.z, 12], wind: true, tex: this.foliageTex, alphaTest: true, doubleSided: true }); }
    // feixes de tiro (rastro dourado com brilho, como uma bala traçante) + a bala na ponta
    if (!this.streakMesh) { this.streakMesh = r.createMesh(MXS.streakMesh()); this.bulletMesh = r.createMesh(MXS.bulletMesh()); }
    const ex = (r.exposure || 1) < 1.25 ? 1.7 : 1 / (r.exposure || 1); const drawStreak = (head, d, L, k) => { const hd = Math.hypot(d[0], d[2]); const yaw = Math.atan2(d[0], d[2]), pit = -Math.atan2(d[1], hd); const tail = [head[0] - d[0] * L, head[1] - d[1] * L, head[2] - d[2] * L]; const sph = [head[0] - d[0] * L / 2, head[1] - d[1] * L / 2, head[2] - d[2] * L / 2, L / 2 + 0.5];
      items.push({ mesh: this.streakMesh, model: mat4.compose(tail, yaw, [0.045, 0.045, L * 1.05], pit), sphere: sph, alpha: 0.22 * k, tint: [1.6 * ex, 0.62 * ex, 0.15 * ex, 1], emissive: 0.45, shadow: false, cull: false });
      items.push({ mesh: this.streakMesh, model: mat4.compose(tail, yaw, [0.014, 0.014, L], pit), sphere: sph, alpha: 0.95 * k, tint: [2.2 * ex, 1.6 * ex, 0.75 * ex, 1], emissive: 0.5, shadow: false, cull: false });
      if (k > 0.99) items.push({ mesh: this.bulletMesh, model: mat4.compose(head, yaw, 1.6, pit), sphere: [head[0], head[1], head[2], 0.5], emissive: 0.35, shadow: false }); };
    for (const a of this.arrows) { if (a.arrow || a.stuck || !a.tracer) continue; const sp = Math.hypot(...a.v) || 1, d = a.v.map((x) => x / sp); const f = a.off ? Math.max(0, 1 - a.dist / 14) : 0; const head = f ? [a.p[0] + a.off[0] * f, a.p[1] + a.off[1] * f, a.p[2] + a.off[2] * f] : a.p;
      const L = this._streakLen(a); drawStreak(head, d, L, 1); if (Math.random() < 0.6) { const t = Math.random() * L * 0.8; this.fx.parts.push({ p: [head[0] - d[0] * t, head[1] - d[1] * t, head[2] - d[2] * t], v: [(Math.random() - 0.5) * 0.8, (Math.random() - 0.3) * 0.8, (Math.random() - 0.5) * 0.8], life: 0.18, max: 0.18, col: [2.2, 1.2, 0.35], size: 0.01, grav: 2 }); } }
    // tiros dos inimigos: mesmo feixe dourado das balas (sem as luzes vermelhas)
    for (const b of this.projectiles) { if (b.missile) continue; const l = Math.hypot(...b.v) || 1; const d = b.v.map((x) => x / l); const L = Math.min((2.2 - b.life) * l, b.small ? 1.6 : b.web ? 4 : 2.6); if (L > 0.05) { if (b.web) items.push({ mesh: this.streakMesh, model: mat4.compose([b.p[0] - d[0] * L, b.p[1] - d[1] * L, b.p[2] - d[2] * L], Math.atan2(d[0], d[2]), [0.03, 0.03, L], -Math.atan2(d[1], Math.hypot(d[0], d[2]))), sphere: [b.p[0], b.p[1], b.p[2], L], alpha: 0.85, tint: [1.6, 1.6, 1.6, 1], emissive: 0.2, shadow: false }); else drawStreak(b.p, d, L, 1); } }
    if (this.streaks) { this.streaks = this.streaks.filter((s) => (s.t -= dt) > 0); for (const s of this.streaks) drawStreak(s.p, s.d, s.L * (0.4 + 0.6 * s.t / s.max), s.t / s.max * 0.99); }
    { if (!this.boomMeshes) this.boomMeshes = { rocket: r.createMesh(MXS.rocketMesh()), gren_he: r.createMesh(MXS.grenadeMesh('gren_he')), gren_gas: r.createMesh(MXS.grenadeMesh('gren_gas')), gren_smoke: r.createMesh(MXS.grenadeMesh('gren_smoke')) };
      for (const a of this.arrows) { if (!a.boom || a.stuck) continue; const d = a.v, h = Math.hypot(d[0], d[2]); const m = mat4.compose(a.p, Math.atan2(d[0], d[2]), 1, -Math.atan2(d[1], h)); items.push({ mesh: this.boomMeshes[a.boom === 'rocket' ? 'rocket' : a.btype] || this.boomMeshes.gren_he, model: m, sphere: [a.p[0], a.p[1], a.p[2], 0.6], emissive: a.boom === 'rocket' ? 0.4 : 0 }); } }
    for (const a of this.arrows) { if (!a.arrow) continue; const d = a.v, h = Math.hypot(d[0], d[2]); const m = mat4.compose(a.stuck ? [a.p[0] - d[0] * 0.18, a.p[1] - d[1] * 0.18, a.p[2] - d[2] * 0.18] : a.p, Math.atan2(d[0], d[2]), 1, -Math.atan2(d[1], h)); items.push({ mesh: this.arrowMesh, model: m, sphere: [a.p[0], a.p[1], a.p[2], 1] }); }
    for (const l of this.logs) items.push({ mesh: this.logMesh, model: mat4.compose([l.x, l.y, l.z], l.rot), sphere: [l.x, l.y, l.z, 2] });
    if (!this.tombMesh) { this.tombMesh = r.createMesh(MXS.tombMesh()); this.paneMesh = r.createMesh(MXS.paneMesh()); this.gpMesh = {}; const PC = { pack_impro: [0.43, 0.42, 0.28], pack_small: [0.23, 0.65, 0.16], pack_medium: [0.12, 0.44, 0.84], pack_large: [0.82, 0.16, 0.16], pack_climb: [0.94, 0.42, 0.06] }; for (const [k, c] of Object.entries(PC)) this.gpMesh[k] = r.createMesh(MXS.groundPackMesh(c)); }
    for (const d of this.drops) { if (d.box) continue; if (d.death && d.pack && this.gpMesh[d.pack]) { items.push({ mesh: this.gpMesh[d.pack], model: mat4.compose([d.x, d.y, d.z], d.rot || 0, 1), sphere: [d.x, d.y, d.z, 1], emissive: 0.12 + 0.1 * Math.sin(this.env.elapsed * 4) }); continue; }
      items.push({ mesh: this.bagMesh, model: mat4.compose([d.x, d.y, d.z], 0, d.death ? 1.6 : 1), sphere: [d.x, d.y, d.z, 1], emissive: d.death ? 0.25 + 0.15 * Math.sin(this.env.elapsed * 4) : 0 }); }
    if (!this.webMesh) { this.webMesh = r.createMesh(MXS.webMesh()); this.cocoonMesh = r.createMesh(MXS.cocoonMesh()); this.spiderBoxMesh = r.createMesh(MXS.spiderBoxMesh()); }
    for (const wb of this.webs) if (Math.abs(wb.x - eye[0]) < 90 && Math.abs(wb.z - eye[2]) < 90) items.push({ mesh: this.webMesh, model: mat4.compose([wb.x, wb.y, wb.z], wb.rot, wb.s), sphere: [wb.x, wb.y, wb.z, wb.s], alpha: 0.7, shadow: false, cull: false });
    if (this.player.webbed > 0 && !this.player.dead) { if (!this.webWrapMesh) this.webWrapMesh = r.createMesh(MXS.webWrapMesh()); const P = this.player; const s = P.crouch ? 0.8 : 1; items.push({ mesh: this.webWrapMesh, model: mat4.compose([P.pos[0], P.pos[1], P.pos[2]], P.yaw + this.env.elapsed * 0.0, [1, s, 1]), sphere: [P.pos[0], P.pos[1] + 1, P.pos[2], 1.3], alpha: Math.min(0.9, P.webbed * 0.6), shadow: false, cull: false }); }
    // livros de habilidade no mundo e na mão durante a leitura
    { if (!this.bookMeshes) this.bookMeshes = {}; const bm = (k, open) => { const key = k + (open ? ':o' : ''); if (!this.bookMeshes[key]) this.bookMeshes[key] = r.createMesh(MXS.bookMesh(k, open)); return this.bookMeshes[key]; };
      for (const b of this.books || []) { if (b.taken || Math.abs(b.x - eye[0]) > 60 || Math.abs(b.z - eye[2]) > 60) continue; const bob = Math.sin(this.env.elapsed * 2 + b.spot) * 0.03;
        items.push({ mesh: bm(b.skill), model: mat4.compose([b.x, b.y + 0.14 + bob, b.z], b.rot + this.env.elapsed * 0.6, 1.6), sphere: [b.x, b.y + 0.2, b.z, 0.5], emissive: 0.15 + 0.1 * Math.sin(this.env.elapsed * 3) }); }
      if (P.prop && P.prop.startsWith('book:') && !P.dead) { const I = this.playerAssets.skel.index; const hp = (k) => mat4.transformPoint(mat4.mul(mat4.create(), P.model, P.anim.world[I[k]]), [0, 0, 0]); const a = hp('handL'), c = hp('handR');
        const mid = [(a[0] + c[0]) / 2, (a[1] + c[1]) / 2 + 0.06, (a[2] + c[2]) / 2]; items.push({ mesh: bm(P.prop.slice(5), true), model: mat4.compose(mid, P.yaw, 1, -0.75), sphere: [mid[0], mid[1], mid[2], 0.4] }); } }
    this.vehicles.render(items, eye);
    // portas das casas (animadas)
    { if (!this.doorMeshes) this.doorMeshes = new Map(); for (const bk of this.stream.buckets.values()) for (const d of bk.doors || []) { if (Math.abs(d.x - eye[0]) > 70 || Math.abs(d.z - eye[2]) > 70) continue;
        d.ang += ((d.open ? 1 : 0) - d.ang) * Math.min(1, dt * 7); let dy = d.yawO - d.yawC; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); const key = (d.color[0] * 255 | 0) * 65536 + (d.color[1] * 255 | 0) * 256 + (d.color[2] * 255 | 0);
        let m = this.doorMeshes.get(key); if (!m) { m = r.createMesh(HOUSES.doorLeafMesh(d.color)); this.doorMeshes.set(key, m); }
        items.push({ mesh: m, model: mat4.compose([d.x, d.y, d.z], d.yawC + dy * d.ang, [d.w, 1, 1]), sphere: [d.x, d.y + 1, d.z, 1.5] }); } }
    for (const q of this.cocoons) if (Math.abs(q.x - eye[0]) < 120 && Math.abs(q.z - eye[2]) < 120) items.push({ mesh: this.cocoonMesh, model: mat4.compose([q.x, q.y, q.z], q.rot, q.player ? 1.1 : 0.9), sphere: [q.x, q.y + 0.4, q.z, 1.2] });
    for (const c of this.creatures.list) if (c.kind === 'spidertank' && !c.dead && Math.abs(c.pos[0] - eye[0]) < 130) items.push({ mesh: this.spiderBoxMesh, model: mat4.mul(mat4.create(), c.model, mat4.compose([0, 0.98, 0.1], 0)), sphere: [c.pos[0], c.pos[1] + 1.2, c.pos[2], 1] });
    for (const d of this.drops) if (d.box) items.push({ mesh: this.spiderBoxMesh, model: mat4.compose([d.x, d.y, d.z], d.rot || 0, 1.25), sphere: [d.x, d.y, d.z, 1] });
    if (!this.c4Mesh) this.c4Mesh = r.createMesh(MXS.c4Mesh());
    for (const b of this.c4s) items.push({ mesh: this.c4Mesh, model: mat4.compose(b.p, b.yaw || 0, 1.3), sphere: [b.p[0], b.p[1], b.p[2], 0.5], emissive: Math.sin(this.env.elapsed * (12 - b.t)) > 0.6 ? 0.6 : 0.05 });
    if (this.equip.hand === 'c4' && !P.dead && this.state === 'playing') { const a = this.c4Aim(); items.push({ mesh: this.c4Mesh, model: mat4.compose(a.p, a.yaw, 1.3), sphere: [a.p[0], a.p[1], a.p[2], 0.5], alpha: 0.55, tint: a.ok ? [0.3, 2.2, 0.4, 1] : [2.4, 0.25, 0.2, 1], emissive: 0.5, shadow: false }); }
    for (const q of this.graves) if (Math.hypot(q.x - eye[0], q.z - eye[2]) < 150) items.push({ mesh: this.tombMesh, model: mat4.compose([q.x, q.y, q.z], q.rot, 1), sphere: [q.x, q.y + 0.4, q.z, 1.5] });
    for (const b of this.stream.buckets.values()) if (b.glass) for (const gp of b.glass) if (!gp.broken && Math.abs(gp.x - eye[0]) < 90 && Math.abs(gp.z - eye[2]) < 90) items.push({ mesh: this.paneMesh, model: mat4.compose([gp.x, gp.y, gp.z], gp.rot, [gp.w, gp.h, 0.02]), sphere: [gp.x, gp.y, gp.z, gp.w], alpha: 0.3, shadow: false });
    void I;
    // criaturas
    for (const c of this.creatures.list) { const d = Math.hypot(c.pos[0] - eye[0], c.pos[2] - eye[2]); if (d > 130) continue; items.push({ mesh: c.mesh, model: c.model, bones: c.anim.boneMats, sphere: [c.pos[0], c.pos[1] + 1, c.pos[2], 2 * c.def.scale], rim: 0.3 });
      if (c.kind === 'mecha') { if (!this.mechaGun) { this.mechaGun = r.createMesh(MECHA.mechaGunMesh()); this.mechaLampM = r.createMesh(MECHA.mechaLampMesh()); } const h = c.heat;
        for (const sd of [-1, 1]) items.push({ mesh: this.mechaGun, model: this.creatures.gunMatrix(c, sd), sphere: [c.pos[0], c.pos[1] + 3, c.pos[2], 3], smooth: true, tint: [1 + h * 2.6, 1 - h * 0.85, 1 - h * 0.9, 1], emissive: h * h * 1.1 });
        if (!c.dead) { const lm = this.creatures.mechaLamp(c); const red = c.engaged; items.push({ mesh: this.mechaLampM, model: lm, sphere: [c.pos[0], c.pos[1] + 3, c.pos[2], 1], tint: red ? [1, 0.12, 0.08, 1] : [1, 0.85, 0.55, 1], emissive: 1 });
          if (Math.hypot(c.pos[0] - eye[0], c.pos[2] - eye[2]) < 90) { const lp = mat4.transformPoint(lm, [0, 0, 0.3]); this._mechaLights = this._mechaLights || []; this._mechaLights.push({ pos: lp, range: 16, col: red ? [6, 0.4, 0.25] : [4, 3, 1.6] }); } } }
      else if (c.def.gatling && c.kind === 'tiger') { if (!this.tigerGunMesh) this.tigerGunMesh = r.createMesh(TIGERGUN()); const h = c.heat; for (const sd of [-1, 1]) items.push({ mesh: this.tigerGunMesh, model: this.creatures.gunMatrix(c, sd), sphere: [c.pos[0], c.pos[1] + 1.5, c.pos[2], 2], smooth: true, tint: [1 + h * 2.2, 1 - h * 0.85, 1 - h * 0.9, 1], emissive: h * h * 0.9 }); }
      else if (c.def.gatling) { const h = c.heat; items.push({ mesh: this.gatlingMesh, model: this.creatures.gunMatrix(c), sphere: [c.pos[0], c.pos[1] + 1.5, c.pos[2], 2], smooth: true, tint: [1 + h * 2.2, 1 - h * 0.85, 1 - h * 0.9, 1], emissive: h * h * 0.9 }); } }
    // colmeias
    for (const hv of this.world.hives) { const t = hv.tree; hv.y = t.felled ? this.world.height(hv.x, hv.z) + 0.75 : t.y + 3.6 * t.s; if (Math.hypot(hv.x - eye[0], hv.z - eye[2]) > 160) continue; items.push({ mesh: this.hiveMesh, model: mat4.compose([hv.x, hv.y, hv.z], hv.id), sphere: [hv.x, hv.y, hv.z, 1.2], tint: hv.honey ? null : [0.55, 0.5, 0.45, 1] }); }
    // jogador
    if (!this.menuMode) {
      const a = P.alpha;
      P.drawDust(r, dt);
      if (!(P.seat && P.seat.hidden)) items.push({ mesh: this.playerAssets.mesh, model: P.model, bones: P.anim.boneMats, alpha: a < 0.99 ? a : undefined, sphere: [P.pos[0], P.pos[1] + 1, P.pos[2], 2], tex: this.playerAssets.tex, rim: 0.35 });
      // armas nas costas (2 espaços, uma de cada lado, na diagonal)
      if (!P.sleeping && P.anim.world && this.playerAssets.skel.index.chest !== undefined) { const I = this.playerAssets.skel.index; const CW = mat4.mul(mat4.create(), P.model, P.anim.world[I.chest]); let skip = this.equip.hand;
        for (const [k, sx] of [['backA', -1], ['backB', 1]]) { const id = this.equip[k]; if (!id || !this.tools[id]) continue; if (skip === id && this.inv.count(id) <= 0) { skip = null; continue; }
          const gun = !!GUNS[id]; const off = gun ? mat4.compose([sx * 0.07, 0.02, -0.19], Math.PI, 1, -Math.PI / 2 + 0.25, sx * 0.55) : mat4.compose([sx * 0.06, -0.1, -0.2], 0, 1, 0.15, sx * 0.6);
          items.push({ smooth: true, mesh: this.tools[id], model: mat4.mul(mat4.create(), CW, off), alpha: a < 0.99 ? a : undefined, sphere: [P.pos[0], P.pos[1] + 1, P.pos[2], 2.5] }); } }
      if (this.equip.hand && this.tools[this.equip.hand] && !P.sleeping && !P.swimming && !(P.anim.action && P.anim.action.clip === P.clips.blueprint && !P.anim.action.ending)) items.push({ smooth: true, mesh: this._gunMeshFor(this.equip.hand), model: P.toolModel, alpha: a < 0.99 ? a : undefined, sphere: [P.pos[0], P.pos[1] + 1, P.pos[2], 2.5], emissive: this.equip.hand === 'torch' ? 0.0 : 0 });
      if (this.equip.hand && GUNS[this.equip.hand] && !P.sleeping && !P.swimming) { const gid = this.equip.hand, G = GUNS[gid], sc = this.attOf(gid, 'scope'), sl = this.attOf(gid, 'sil'), al = a < 0.99 ? a : undefined, sph = [P.pos[0], P.pos[1] + 1, P.pos[2], 2.5];
        if (sc && this.scopeMeshes[sc]) { const mt = SCOPE_MOUNT[G.model] || [0, 0.13, 0.06]; items.push({ smooth: true, mesh: this.scopeMeshes[sc], model: mat4.mul(mat4.create(), P.toolModel, mat4.compose(mt, 0, (G.look && G.look.scale) || 1)), alpha: al, sphere: sph }); }
        const sm = sl && silMount(gid); if (sm) { this.silMeshes = this.silMeshes || {}; const m = this.silMeshes[sl] || (this.silMeshes[sl] = this.renderer.createMesh(silencerMesh(sl))); items.push({ smooth: true, mesh: m, model: mat4.mul(mat4.create(), P.toolModel, mat4.compose(sm, 0, (G.look && G.look.scale) || 1)), alpha: al, sphere: sph }); } }
    }
    // luzes pontuais: fogueiras, tocha, cristais
    const lights = []; const t = this.env.elapsed; if (!this.menuMode) { this.smoke.lights(lights, eye, t); this.helis.lights(lights, eye); this.territory.lights(lights, eye); }
    for (const p of this.build.pieces) if (p.type === 'campfire' && p.lit) { const d = Math.hypot(p.x - eye[0], p.z - eye[2]); if (d < 120) { lights.push({ pos: [p.x, p.y + 0.8, p.z], range: 14, col: [3.2 * (0.85 + 0.15 * Math.sin(t * 13 + p.x)), 1.5, 0.45], d }); if (d < 70) this.fx.fire([p.x, p.y, p.z], 1); } }
    if (!this.menuMode && this.equip.hand === 'solarlamp' && !P.sleeping) { const hp = P.handWorldPos(); lights.push({ pos: hp, range: 14, col: [2.2, 2.5, 2.9], d: 0 }); }
    if (this._mechaLights) { for (const l of this._mechaLights) lights.push(l); this._mechaLights = null; }
    if (!this.menuMode && this.equip.hand === 'torch' && !P.swimming) { const hp = P.handWorldPos(); lights.push({ pos: hp, range: 12, col: [2.6 * (0.9 + 0.1 * Math.sin(t * 17)), 1.3, 0.4], d: 0 }); if (!P.sleeping) this.fx.fire([hp[0], hp[1] - 0.05, hp[2]], 0.45); }
    if (!this.menuMode) for (const c of this.caveMeshes) { const d = Math.hypot(c.c.x - eye[0], c.c.z - eye[2]); if (d < 40) lights.push({ pos: [c.c.x, c.c.y + 2, c.c.z], range: 13, col: [0.25, 0.6, 0.9], d: d + 5 }); }
    for (const b of this.projectiles) { if (!b.missile) continue; const l = Math.hypot(...b.v) || 1; const n = b.v.map((x) => x / l); const q = n[1] < -0.9999 ? [1, 0, 0, 0] : quat.normalize([n[2], 0, -n[0], 1 + n[1]]);
      items.push({ mesh: this.missileMesh, model: mat4.fromTRS(mat4.create(), b.p, q, [1, 1, 1]), sphere: [b.p[0], b.p[1], b.p[2], 1], smooth: true, shadow: false });
      for (let k = 0; k < 4; k++) r.particle(b.p[0] - n[0] * (0.4 + k * 0.12), b.p[1] - n[1] * (0.4 + k * 0.12), b.p[2] - n[2] * (0.4 + k * 0.12), 0.16 - k * 0.03, 1.4, 0.7 - k * 0.1, 0.2, 1 - k * 0.2);
      lights.push({ pos: b.p.slice(), range: 7, col: [3, 1.4, 0.4], d: Math.hypot(b.p[0] - eye[0], b.p[2] - eye[2]) }); }
    if (this.gunLight && this.gunLight.t > 0) { this.gunLight.t -= dt; lights.push({ pos: this.gunLight.pos, range: 9, col: [7, 4.5, 1.8], d: 0 }); }
    if (this.blastLight && this.blastLight.t > 0) { this.blastLight.t -= dt; const BL = this.blastLight, k = BL.max ? Math.min(1, BL.t / BL.max * 1.6) : 1; lights.push({ pos: BL.pos, range: BL.range || 18, col: (BL.col || [6, 3, 1]).map((v) => v * k), d: 0 }); }
    lights.sort((a, b) => a.d - b.d); r.pointLights = lights.slice(0, 8);
    const night = this.env.isNight ? 1 : 0;
    if (!inCave) this.fx.toxicHaze(dt, eye, TOXIC, (x, z) => this.world.height(x, z));
    this.fx.update(dt, r, eye, inCave ? 0 : this.env.cur.rain, night);
    const under = eye[1] < WATER - 0.05 && this.world.height(eye[0], eye[2]) < WATER;
    r.renderFrame(items, { overlay: under ? [0.05, 0.25, 0.32, 0.55] : null });
    // áudio ambiente
    let fire = 0; for (const l of lights) if (l.col[2] < 0.5) fire = Math.max(fire, clamp(1 - Math.hypot(l.pos[0] - P.pos[0], l.pos[2] - P.pos[2]) / 12, 0, 1));
    const wd = this._waterNear(P.pos);
    this.audio.update(dt, { wind: this.env.cur.wind, rain: this.env.cur.rain, inCave, fire, water: Math.max(wd, this._fallNear || 0), day: 1 - this.renderer.env.night });
    this.fps = this.fps ? this.fps * 0.95 + (1 / Math.max(dt, 0.001)) * 0.05 : 60;
    // resolução dinâmica: reduz a escala de renderização se o desempenho cair muito
    if (this.state === 'playing' && this.settings.autoRes && !navigator.webdriver) { this._perfT = (this._perfT || 0) + dt; this._perfN = (this._perfN || 0) + 1;
      if (this._perfT > 4) { const avg = this._perfN / this._perfT; this._perfT = 0; this._perfN = 0;
        if (avg < 24 && this.settings.res > 0.55) { this.settings.res = Math.round((this.settings.res - 0.15) * 100) / 100; this.applySettings(); this.ui.toast(`Desempenho baixo: resolução ajustada para ${Math.round(this.settings.res * 100)}%`, 'info'); } } }
  }
  // cachoeiras (lâmina, laguinho, riacho, gotas e névoa), barra/✔ da composteira e visor do coletor de chuva
  _renderExtras(items, eye) {
    const r = this.renderer, w = this.world, night = r.env.night || 0, k = 1 - night * 0.75, t = this.env.elapsed;
    if (!this._xm) { const ub = new MeshBuilder(); ub.setColor([1, 1, 1], 0.86); ub.box(MM(), 1, 1, 1, [1, 1, 1]); const ck = new MeshBuilder(); const g = HX(0x2ee06a); ck.setColor(g, 0.02); ck.box(MM(-0.19, -0.06, 0, 0, 1, 0, 0.76), 0.14, 0.36, 0.08, g); ck.box(MM(0.12, 0.07, 0, 0, 1, 0, -0.67), 0.14, 0.68, 0.08, g);
      this._xm = { box: r.createMesh(ub.build()), check: r.createMesh(ck.build()), falls: [] }; }
    const X = this._xm; this._fallNear = 0;
    for (const f of w.falls) { const d = Math.hypot(f.x - eye[0], f.z - eye[2]); if (d > 750) continue; this._fallNear = Math.max(this._fallNear, 1 - d / 70);
      let m = X.falls[f.id]; if (!m) { const fm = TOWN.fallMeshes(f); m = X.falls[f.id] = { sheet: r.createMesh(fm.sheet), pond: r.createMesh(fm.pond) }; }
      items.push({ mesh: m.pond, sphere: [f.px, f.ws, f.pz, 240], alpha: 0.8, shadow: false });
      items.push({ mesh: m.sheet, sphere: [f.x, f.y / 2, f.z, f.y + 8], alpha: 0.62, shadow: false, cull: false });
      if (d < 170) { for (let i = 0; i < 170; i++) { const h1 = Math.sin(i * 12.9898 + f.id * 3.1) * 43758.5453, fr = h1 - Math.floor(h1), h2 = Math.sin(i * 78.233 + f.id) * 12345.678, fp = h2 - Math.floor(h2);
          const u = (t * (0.5 + fr * 0.35) + fp) % 1, sx = (fr - 0.5) * f.width * 1.05, y = f.ws + (0.15 - f.ws) * u, out = 0.75 + 2.2 * u * u;
          r.particle(f.x + f.ux * out - f.uz * sx, y, f.z + f.uz * out + f.ux * sx, 0.05 + u * 0.05, 0.8 * k, 0.88 * k, 0.95 * k, 0.4, 10); }
        for (let i = 0; i < 26; i++) { const h1 = Math.sin(i * 31.7 + f.id) * 9871.3, fr = h1 - Math.floor(h1); const ph = (t * 0.18 + fr) % 1; const a = fr * 6.283, rr = 1 + ph * 3.5;
          r.particle(f.x + f.ux * 3.4 + Math.cos(a) * rr, 0.4 + ph * 3.2, f.z + f.uz * 3.4 + Math.sin(a) * rr, 1.2 + ph * 2.2, 0.85 * k, 0.9 * k, 0.95 * k, 0.16 * (1 - ph)); } } }
    const bb = (x, y, z, sx, sy, sz, tint, em = 0) => { const yaw = Math.atan2(eye[0] - x, eye[2] - z); items.push({ mesh: X.box, model: mat4.compose([x, y, z], yaw, [sx, sy, sz]), tint, emissive: em, shadow: false, sphere: [x, y, z, 1] }); return yaw; };
    for (const p of this.build.pieces) {
      const dd = Math.hypot(p.x - eye[0], p.z - eye[2]); if (dd > 60) continue; const d = p.data || {};
      if (p.type === 'composter') { const y = p.y + 1.55; let f = -1, col;
        if (d.start !== undefined) { f = (this._clock() - d.start) / Game.COMPOST; col = [0.35, 1.3, 0.35, 1]; }
        else if (d.dirt || d.food) { f = (d.dirt + d.food) / 20; col = [1.1, 0.7, 0.3, 1]; }
        if (f >= 1) { const yaw = Math.atan2(eye[0] - p.x, eye[2] - p.z); items.push({ mesh: X.check, model: mat4.compose([p.x, y + 0.2 + Math.sin(t * 2.2) * 0.07, p.z], yaw, 1.7), emissive: 0.9, shadow: false, sphere: [p.x, y, p.z, 1.5] }); }
        else if (f >= 0 && dd < 25) { const yaw = bb(p.x, y, p.z, 1.3, 0.22, 0.03, [0.1, 0.1, 0.1, 1]); const cx = (-0.5 + f / 2) * 1.22; bb(p.x + Math.cos(yaw) * cx + Math.sin(yaw) * 0.025, y, p.z - Math.sin(yaw) * cx + Math.cos(yaw) * 0.025, Math.max(0.01, f * 1.22), 0.15, 0.03, col, 0.6); } }
      if (p.type === 'collector' && (d.water || 0) > 0.02) { const f = Math.min(1, d.water / 10); items.push({ mesh: X.box, model: mat4.mul(mat4.create(), p.model, mat4.compose([0.25, 0.16 + 0.47 * f, 0.468], 0, [0.05, 0.92 * f, 0.012])), tint: [0.3, 0.7, 1.4, 1], emissive: 0.3, shadow: false, sphere: [p.x, p.y + 0.5, p.z, 1] }); }
    }
  }
  _waterNear(p) { this._wnT = (this._wnT || 0) - 1; if (this._wnT > 0) return this._wn || 0; this._wnT = 20; let m = 0; for (let a = 0; a < 8; a++) for (const d of [4, 10]) { const x = p[0] + Math.cos(a * 0.785) * d, z = p[2] + Math.sin(a * 0.785) * d; if (this.world.height(x, z) < WATER - 0.5) m = Math.max(m, 1 - d / 14); } this._wn = m; return m; }
}
function near(group, p, r) { const out = []; for (let i = Math.floor((p[0] - r) / CELL); i <= Math.floor((p[0] + r) / CELL); i++) for (let j = Math.floor((p[2] - r) / CELL); j <= Math.floor((p[2] + r) / CELL); j++) { const c = group.cells.get(i + ',' + j); if (c) for (const o of c.objs) if (Math.abs(o.x - p[0]) < r && Math.abs(o.z - p[2]) < r) out.push(o); } return out; }
