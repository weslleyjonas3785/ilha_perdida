// Criaturas: fauna (cervo, javali) e androides inimigos com IA (patrulha, detecção, perseguição,
// corpo a corpo, tiro, investida, voo com mergulho, sentinelas de alarme, dano e morte) + população dia/noite.
import { Skeleton, bakeClip, Animator } from '../engine/skeleton.js';
import { MeshBuilder, M, hex, shade } from '../engine/mesh.js';
import { mat4, quat, clamp, dampAngle, angleDiff, rng } from '../engine/math.js';
import { kf, makeHumanSkeleton, buildHumanClips } from './humanoid.js';
import { ROBOT_STYLES, withPal, palSt, buildTigerMesh, buildMechaMesh, buildRobotHumanMesh, buildRobotQuadMesh, makeBugSkeleton, buildBugMesh, buildBugClips, makeBirdSkeleton, buildBirdMesh, buildBirdClips } from './androids.js';
import { WATER } from './world.js';
import { makeChibiSkeleton, buildChibiMesh } from './chibi.js';
import { NPC_LOOKS } from './npcs.js';
import { makeDeerSkeleton, makeBoarSkeleton, buildDeerMesh, buildBoarMesh, facetize, makeCowSkeleton, buildCowMesh, COW_COATS, makeChickenSkeleton, buildChickenMesh, buildChickenClips } from './fauna.js';

const QB = (name, parent, pos) => ({ name, parent, pos });
export function makeQuadSkeleton() {
  return new Skeleton([
    QB('pelvis', -1, [0, 0.74, -0.38]), QB('spine', 0, [0, 0.02, 0.38]), QB('chest', 1, [0, 0.0, 0.34]), QB('neck', 2, [0, 0.1, 0.2]), QB('head', 3, [0, 0.14, 0.16]), QB('tail', 0, [0, 0.06, -0.12]),
    QB('upFL', 2, [0.13, -0.08, 0.02]), QB('loFL', 6, [0, -0.32, 0]), QB('pawFL', 7, [0, -0.3, 0]),
    QB('upFR', 2, [-0.13, -0.08, 0.02]), QB('loFR', 9, [0, -0.32, 0]), QB('pawFR', 10, [0, -0.3, 0]),
    QB('upBL', 0, [0.13, -0.06, 0]), QB('loBL', 12, [0, -0.33, 0]), QB('pawBL', 13, [0, -0.3, 0]),
    QB('upBR', 0, [-0.13, -0.06, 0]), QB('loBR', 15, [0, -0.33, 0]), QB('pawBR', 16, [0, -0.3, 0]),
  ]);
}
function rw(sk) { const w = []; sk.bones.forEach((b, i) => { const p = b.parent >= 0 ? w[b.parent] : [0, 0, 0]; w[i] = [p[0] + b.pos[0], p[1] + b.pos[1], p[2] + b.pos[2]]; }); return w; }
export function buildQuadMesh(sk, style) {
  const mb = new MeshBuilder({ skinned: true }); const W = rw(sk), I = sk.index; const c = style.body, d = style.dark, b = style.belly;
  const zP = W[0][2], zC = W[2][2];
  mb.weightFn = (p) => { const t = clamp((p[2] - zP + 0.1) / (zC - zP + 0.2), 0, 1); return t < 0.5 ? { j: [I.pelvis, I.spine], w: [1 - t * 2, t * 2] } : { j: [I.spine, I.chest], w: [2 - t * 2, t * 2 - 1] }; };
  mb.sphere(mat4.fromTRS(mat4.create(), [0, W[1][1] + 0.02, (zP + zC) / 2], [0, 0, 0, 1], [0.22 * style.bulk, 0.24 * style.bulk, 0.55]), 1, 12, 8, c);
  mb.sphere(mat4.fromTRS(mat4.create(), [0, W[1][1] - 0.08, (zP + zC) / 2 + 0.05], [0, 0, 0, 1], [0.17 * style.bulk, 0.15, 0.42]), 1, 10, 6, b);
  mb.setBone(I.chest); mb.sphere(mat4.fromTRS(mat4.create(), [0, W[2][1] + 0.02, zC], [0, 0, 0, 1], [0.21 * style.bulk, 0.25 * style.bulk, 0.22]), 1, 10, 7, style.mane || c);
  mb.setBone(I.neck); mb.cylinder(mat4.fromTRS(mat4.create(), [0, W[3][1] - 0.08, W[3][2] - 0.05], quat.fromEuler(0.9, 0, 0), [1, 1, 1]), 0.12 * style.bulk, 0.09, 0.32 * style.neck, 8, style.mane || c);
  mb.setBone(I.head); const hp = W[4];
  mb.sphere(mat4.fromTRS(mat4.create(), [0, hp[1] + 0.02, hp[2] + 0.04], [0, 0, 0, 1], [0.1, 0.1, 0.13]), 1, 9, 6, c);
  mb.cylinder(mat4.fromTRS(mat4.create(), [0, hp[1] - 0.01, hp[2] + 0.1], quat.fromEuler(Math.PI / 2, 0, 0), [1, 1, 0.8]), 0.065, style.snoutTip, style.snout, 7, d);
  mb.box(M(0, hp[1] - 0.03, hp[2] + 0.1 + style.snout), 0.04, 0.035, 0.03, hex(0x111111));
  for (const s of [-1, 1]) { mb.box(M(s * 0.05, hp[1] + 0.06, hp[2] + 0.12), 0.025, 0.02, 0.01, style.eye || hex(0x111111));
    mb.cylinder(M(s * 0.06, hp[1] + 0.08, hp[2] - 0.0, 0, 1, 0, -s * 0.3), style.ear, 0.0, style.earH, 4, d); }
  if (style.antlers) for (const s of [-1, 1]) { const m0 = M(s * 0.05, hp[1] + 0.1, hp[2] - 0.02, 0, 1, -0.3, -s * 0.5); mb.cylinder(m0, 0.018, 0.01, 0.38, 4, hex(0xd8c8a0)); mb.cylinder(mat4.mul(mat4.create(), m0, M(0, 0.2, 0, 0, 1, 0.9, s * 0.4)), 0.012, 0.006, 0.18, 4, hex(0xd8c8a0)); }
  if (style.tusks) for (const s of [-1, 1]) mb.cylinder(M(s * 0.05, hp[1] - 0.04, hp[2] + 0.18, 0, 1, -0.6, 0), 0.012, 0.0, 0.1, 4, hex(0xeeeedd));
  mb.setBone(I.tail); mb.cylinder(mat4.fromTRS(mat4.create(), [0, W[5][1], W[5][2]], quat.fromEuler(-2.2, 0, 0), [1, 1, 1]), style.tailR, 0.02, style.tail, 6, style.tailC || c);
  for (const L of ['FL', 'FR', 'BL', 'BR']) {
    const u = W[I['up' + L]], l = W[I['lo' + L]], p = W[I['paw' + L]]; const fr = L[0] === 'F';
    mb.setBone(I['up' + L]); mb.cylinder(mat4.fromTRS(mat4.create(), [u[0], u[1] + 0.06, u[2]], quat.fromEuler(Math.PI, 0, 0), [1, 1, 1]), (fr ? 0.07 : 0.085) * style.bulk, 0.045, u[1] - l[1] + 0.06, 7, c);
    mb.weightFn = (q) => { const t = clamp((l[1] - q[1]) / 0.08, 0, 1); return { j: [I['lo' + L], I['up' + L]], w: [0.5 + t * 0.5, 0.5 - t * 0.5] }; };
    mb.cylinder(mat4.fromTRS(mat4.create(), [l[0], l[1], l[2]], quat.fromEuler(Math.PI, 0, 0), [1, 1, 1]), 0.042, 0.03, l[1] - p[1], 6, d); mb.weightFn = null;
    mb.setBone(I['paw' + L]); mb.box(M(p[0], p[1] - 0.02, p[2] + 0.03), 0.065, 0.05, 0.1, style.hoof || d);
  }
  return mb.build();
}
function quadGait(ph, o) {
  const w = ph * Math.PI * 2; const s = Math.sin(w), c = Math.cos(w); const s2 = Math.sin(w + o.lag), c2 = Math.cos(w + o.lag);
  const leg = (sn, cs) => [-sn * o.stride, Math.max(0, cs) * o.knee];
  const [fl, flk] = leg(s, c), [br, brk] = leg(o.gallop ? s2 : s, o.gallop ? c2 : c), [fr, frk] = leg(o.gallop ? Math.sin(w + 0.3) : -s, o.gallop ? Math.cos(w + 0.3) : -c), [bl, blk] = leg(o.gallop ? Math.sin(w + o.lag + 0.3) : -s, o.gallop ? Math.cos(w + o.lag + 0.3) : -c);
  return { root: [0, o.bob * Math.cos(2 * w), 0], bones: {
    pelvis: [o.gallop ? 0.12 * s : 0, 0, 0.03 * s], spine: [o.gallop ? -0.08 * c : 0, 0.04 * s, 0], chest: [o.gallop ? -0.1 * s : 0, 0, 0], neck: [o.neck + 0.06 * c, 0, 0], head: [o.head - 0.05 * c, 0, 0], tail: [0.2 * s, 0.3 * c, 0],
    upFL: [fl, 0, 0], loFL: [-flk * 0.4, 0, 0], pawFL: [flk * 0.6, 0, 0], upFR: [fr, 0, 0], loFR: [-frk * 0.4, 0, 0], pawFR: [frk * 0.6, 0, 0],
    upBL: [bl, 0, 0], loBL: [blk, 0, 0], pawBL: [-blk * 0.5, 0, 0], upBR: [br, 0, 0], loBR: [brk, 0, 0], pawBR: [-brk * 0.5, 0, 0] } };
}
export function buildQuadClips(sk) {
  const C = {}; const mk = (n, d, fn, o) => (C[n] = bakeClip(sk, n, d, fn, o));
  mk('idle', 3, (ph) => { const s = Math.sin(ph * 6.283); return { root: [0, 0.006 * s, 0], bones: { neck: [0.05 * s, 0, 0], head: [-0.05 * s, 0.25 * Math.sin(ph * 6.283 * 0.5 + 1), 0], tail: [0.1, 0.25 * Math.sin(ph * 6.283 * 2), 0], chest: [0.02 * s, 0, 0] } }; });
  mk('graze', 3.5, (ph) => { const dn = kf(ph, [[0, 0], [0.2, 1], [0.8, 1], [1, 0]]); return { bones: { neck: [0.9 * dn, 0, 0], head: [0.5 * dn + 0.05 * Math.sin(ph * 30) * dn, 0, 0], upFL: [-0.1 * dn, 0, 0], upFR: [-0.1 * dn, 0, 0], tail: [0.1, 0.2 * Math.sin(ph * 20), 0] } }; });
  mk('walk', 1.1, (ph) => quadGait(ph, { stride: 0.38, knee: 0.6, bob: 0.015, neck: 0.05, head: -0.05, lag: 0, gallop: false }));
  mk('run', 0.5, (ph) => quadGait(ph, { stride: 0.75, knee: 1.0, bob: 0.05, neck: 0.25, head: -0.15, lag: 2.6, gallop: true }));
  mk('attack', 0.8, (ph) => { const p = kf(ph, [[0, 0], [0.35, -1], [0.55, 1], [0.75, 0.8], [1, 0]]);
    return { root: [0, 0.12 * Math.max(0, p), 0.35 * Math.max(0, p)], bones: { pelvis: [0.15 * Math.max(0, -p) - 0.15 * Math.max(0, p), 0, 0], neck: [0.3 * Math.max(0, -p) - 0.2 * Math.max(0, p), 0, 0], head: [0.4 * Math.max(0, -p) - 0.4 * Math.max(0, p), 0, 0],
      upFL: [-0.6 * Math.max(0, p) + 0.3 * Math.max(0, -p), 0, 0], upFR: [-0.6 * Math.max(0, p) + 0.3 * Math.max(0, -p), 0, 0], loFL: [-0.4 * Math.max(0, p), 0, 0], loFR: [-0.4 * Math.max(0, p), 0, 0],
      upBL: [0.4 * Math.max(0, p) - 0.3 * Math.max(0, -p), 0, 0], upBR: [0.4 * Math.max(0, p) - 0.3 * Math.max(0, -p), 0, 0], loBL: [0.5 * Math.max(0, -p), 0, 0], loBR: [0.5 * Math.max(0, -p), 0, 0], tail: [0.6, 0, 0] } }; }, { loop: false, events: [{ t: 0.55, name: 'hit' }] });
  mk('hit', 0.4, (ph) => { const d = kf(ph, [[0, 0], [0.2, 1], [1, 0]]); return { root: [0, 0, -0.1 * d], bones: { pelvis: [0, 0, 0.15 * d], neck: [-0.4 * d, 0.3 * d, 0], head: [-0.3 * d, 0, 0] } }; }, { loop: false });
  mk('die', 1.2, (ph) => { const d = kf(ph, [[0, 0], [0.6, 1], [0.8, 0.95], [1, 1]]);
    return { root: [0, -0.5 * d, 0], bones: { pelvis: [0, 0, 1.45 * d], neck: [0.2 * d, 0, -0.3 * d], head: [0.2 * d, 0, 0], upFL: [-0.3 * d, 0, 0], upBL: [0.3 * d, 0, 0], upFR: [-0.5 * d, 0, -0.2 * d], upBR: [0.4 * d, 0, 0.2 * d], tail: [0, 0, 0] } }; }, { loop: false });
  // rugido: ergue a cabeça e sacode; evento 'fire' (míssil do chifre)
  mk('roar', 1.3, (ph) => { const u = kf(ph, [[0, 0], [0.25, 1], [0.7, 1], [1, 0]]); const sh = Math.sin(ph * 40) * 0.06 * u;
    return { root: [0, 0.05 * u, -0.06 * u], bones: { pelvis: [-0.12 * u, 0, 0], chest: [-0.15 * u, 0, 0], neck: [-0.55 * u, sh, 0], head: [-0.35 * u + sh, 0, sh], upFL: [-0.25 * u, 0, 0], upFR: [-0.25 * u, 0, 0], tail: [0.8 * u, 0, 0] } }; }, { loop: false, events: [{ t: 0.72, name: 'fire' }] });
  return C;
}


const STYLES = {
  deer: { body: hex(0x9a6a40), dark: hex(0x5a3e26), belly: hex(0xe0d4c0), bulk: 0.85, neck: 1.5, snout: 0.13, snoutTip: 0.04, ear: 0.045, earH: 0.14, tail: 0.12, tailR: 0.05, tailC: hex(0xf0f0f0), antlers: true, hoof: hex(0x222222) },
  boar: { body: hex(0x4a3a2c), dark: hex(0x2a2018), belly: hex(0x5a4a3a), mane: hex(0x3a2c20), bulk: 1.3, neck: 0.6, snout: 0.15, snoutTip: 0.06, ear: 0.04, earH: 0.08, tail: 0.18, tailR: 0.025, tusks: true, hoof: hex(0x1a1a1a) },
};
const R_LOOT = (a) => a; // legibilidade
export const DEFS = {
  // fauna (fonte de carne)
  deer: { name: 'Cervo', hp: 30, dmg: 0, walk: 1.3, run: 7.6, detect: 15, range: 0, flee: true, rig: 'quad', scale: 1.0, radius: 0.5, loot: [['meat_deer', 2, 3], ['leather', 1, 2]] },
  cow: { name: 'Vaca', hp: 70, dmg: 0, walk: 0.9, run: 4.6, detect: 9, range: 0, flee: true, rig: 'quad', scale: 1.0, radius: 0.7, noDesert: true, loot: [['meat_cow', 4, 6], ['leather', 2, 3]] },
  chicken: { name: 'Galinha', hp: 8, dmg: 0, walk: 0.8, run: 4.2, detect: 7, range: 0, flee: true, rig: 'bird', scale: 1.0, radius: 0.22, noDesert: true, small: true, loot: [['meat_chicken', 1, 1], ['fiber', 1, 2]] },
  boar: { name: 'Javali', hp: 55, dmg: 12, walk: 1.1, run: 5.3, detect: 10, range: 1.6, retaliate: true, rig: 'quad', scale: 1.0, radius: 0.55, loot: [['meat_boar', 2, 4], ['leather', 1, 1]] },
  // androides humanoides
  soldier: { name: 'Androide soldado', robot: true, hostile: true, ai: 'ranged', tactical: true, mag: 6, reloadT: 2.2, hp: 60, dmg: 8, walk: 1.4, run: 3.9, detect: 32, range: 1.6, rig: 'human', scale: 1.0, radius: 0.38, attack: 'punch', shoot: { min: 4, max: 24, cd: 1.8, dmg: 9, speed: 95, y: 1.35 }, loot: R_LOOT([['scrap', 1, 3], ['circuit', 0, 1], ['ammo555', 6, 18]]), lootChance: [['rifle', 0.12], ['rifle540', 0.06], ['medkit', 0.1]] },
  hunter: { name: 'Androide caçador', robot: true, hostile: true, ai: 'melee', hp: 85, dmg: 14, walk: 1.5, run: 5.1, detect: 26, range: 1.8, rig: 'human', scale: 1.05, radius: 0.38, attack: 'claw', shoot: { min: 6, max: 20, cd: 2.4, dmg: 8, speed: 96, y: 1.35 }, loot: [['scrap', 2, 3], ['circuit', 0, 1]] },
  mecha: { name: 'Mecha de combate', robot: true, hostile: true, ai: 'melee', gatling: true, heavyArmor: true, noRoar: true, blindBack: true, fov: 1.95, gunRange: 48, hp: 600, dmg: 40, walk: 1.5, run: 2.6, detect: 46, range: 2.2, rig: 'human', scale: 2.9, radius: 1.3, attack: 'punch', attackSpeed: 0.6, leash: 90, loot: [['scrap', 10, 16], ['core', 2, 3], ['circuit', 3, 5], ['gunparts', 2, 4]] },
  heavy: { name: 'Gorila de combate', robot: true, hostile: true, ai: 'melee', hp: 260, dmg: 30, walk: 1.2, run: 4.2, detect: 26, range: 2.5, rig: 'human', scale: 1.55, radius: 0.7, attack: 'punch', attackSpeed: 0.75, charge: 9, hearMul: 1.3, loot: [['scrap', 4, 6], ['core', 1, 1], ['circuit', 1, 2]] },
  // quadrúpedes
  rhino: { name: 'Rinoceronte blindado', robot: true, hostile: true, ai: 'melee', missile: true, hp: 260, dmg: 26, walk: 1.2, run: 5.0, detect: 22, range: 2.3, rig: 'quad', scale: 1.95, radius: 0.9, charge: 11, loot: [['scrap', 4, 6], ['core', 1, 1]] },
  tiger: { name: 'Tigre-canhão', robot: true, hostile: true, ai: 'melee', gatling: true, leap: true, leapSpeed: 11, hearMul: 1.6, hp: 140, dmg: 18, walk: 1.6, run: 6.8, detect: 28, range: 2.0, rig: 'quad', scale: 1.45, radius: 0.6, loot: [['scrap', 3, 5], ['circuit', 1, 2]] },
  // insetos e aracnídeos
  spider: { ambush: true, name: 'Aranha mecânica', robot: true, hostile: true, ai: 'melee', hp: 40, dmg: 9, walk: 1.8, run: 6.0, detect: 20, range: 1.5, rig: 'bug', scale: 1.0, radius: 0.5, loot: [['scrap', 1, 2]] },
  tick: { name: 'Aranha-radar', robot: true, hostile: true, ai: 'sentinel', hp: 35, dmg: 6, walk: 1.4, run: 4.6, detect: 30, range: 1.4, rig: 'bug', scale: 1.0, radius: 0.45, loot: [['circuit', 1, 2], ['scrap', 0, 1]] },
  ant: { name: 'Formiga perfuradora', robot: true, hostile: true, ai: 'melee', drill: true, hp: 55, dmg: 11, walk: 1.6, run: 5.2, detect: 18, range: 1.7, rig: 'bug', scale: 1.15, radius: 0.5, loot: [['scrap', 1, 2]] },
  beetle: { name: 'Besouro-aríete', robot: true, hostile: true, ai: 'melee', hp: 130, dmg: 18, walk: 1.2, run: 4.0, detect: 20, range: 2.0, rig: 'bug', scale: 1.5, radius: 0.75, charge: 10, loot: [['scrap', 3, 4], ['core', 0, 1]] },
  scorpion: { name: 'Escorpião mecânico', robot: true, hostile: true, ai: 'melee', poison: 9, hp: 75, dmg: 14, walk: 1.5, run: 5.2, detect: 20, range: 1.9, rig: 'bug', scale: 1.3, radius: 0.55, loot: [['scrap', 2, 3], ['circuit', 0, 1]] },
  hauler: { name: 'Robô transportador industrial', robot: true, hostile: false, retaliate: true, ai: 'melee', hp: 420, dmg: 30, walk: 1.0, run: 3.4, detect: 12, range: 2.6, rig: 'bug', scale: 2.0, radius: 1.3, charge: 7, loot: [['scrap', 8, 12], ['core', 1, 2], ['circuit', 2, 3], ['cloth', 1, 3]] },
  drone: { name: 'Drone de vigilância', robot: true, hostile: true, ai: 'sentinel', flyerSentinel: true, hp: 30, dmg: 0, walk: 2.2, run: 5.5, detect: 34, range: 0, rig: 'bug', scale: 1.0, radius: 0.4, alt: 6.0, shoot: { min: 4, max: 26, cd: 2.6, dmg: 6, speed: 102, y: 0.1, burst: 2 }, loot: [['circuit', 1, 2], ['scrap', 1, 2]] },
  spidertank: { name: 'Aranha-tanque', robot: true, hostile: true, ai: 'ranged', hp: 220, dmg: 16, walk: 1.1, run: 3.2, detect: 30, range: 2.2, rig: 'bug', scale: 1.25, radius: 0.95, shoot: { min: 6, max: 28, cd: 2.2, dmg: 14, speed: 95, y: 1.25 }, loot: [['scrap', 4, 6], ['core', 1, 1], ['circuit', 1, 2]] },
  fly: { name: 'Libélula de ataque', robot: true, hostile: true, ai: 'flyer', hp: 20, dmg: 6, walk: 3.0, run: 6.5, detect: 22, range: 1.2, rig: 'bug', scale: 0.8, radius: 0.35, alt: 2.4, loot: [['circuit', 0, 1], ['scrap', 0, 1]] },
  wasp: { name: 'Abelha cibernética', robot: true, hostile: true, ai: 'flyer', bee: true, hp: 14, dmg: 5, walk: 3.0, run: 8.5, detect: 24, range: 1.0, rig: 'bug', scale: 0.55, radius: 0.25, alt: 3.0, loot: [['scrap', 1, 1], ['circuit', 0, 1]] },
  butterfly: { name: 'Borboleta solar', robot: true, hostile: true, ai: 'sentinel', flyerSentinel: true, hp: 40, dmg: 0, walk: 1.6, run: 3.6, detect: 30, range: 0, rig: 'bug', scale: 1.0, radius: 0.9, alt: 3.5, loot: [['solarpanel', 2, 4], ['circuit', 0, 1]] },
  // humanos (NPCs): saqueadores dos acampamentos e soldados das bases militares
  bandit: { name: 'Saqueador', human: true, hostile: true, ai: 'npc', hp: 100, dmg: 12, walk: 1.4, run: 5.0, detect: 38, range: 1.7, rig: 'human', scale: 1.0, radius: 0.36, loot: [] },
  avatar: { name: 'Jogador', human: true, hostile: false, ai: 'net', hp: 100, dmg: 0, walk: 1.4, run: 5, detect: 0, range: 0, rig: 'human', scale: 1.0, radius: 0.36, loot: [] },
  porter: { name: 'Carregador', human: true, hostile: true, ai: 'npc', hp: 160, dmg: 0, walk: 1.3, run: 4.4, detect: 40, range: 1.7, rig: 'human', scale: 1.0, radius: 0.42, loot: [] },
  milsoldier: { name: 'Soldado', human: true, hostile: true, ai: 'npc', hp: 140, dmg: 12, walk: 1.4, run: 4.8, detect: 55, range: 1.7, rig: 'human', scale: 1.0, radius: 0.36, loot: [] },
  // aves
  raven: { name: 'Corvo mecânico', robot: true, hostile: false, retaliate: true, ai: 'flyer', hp: 35, dmg: 9, walk: 3.5, run: 8.5, detect: 28, range: 1.3, rig: 'bird', scale: 1.0, radius: 0.45, alt: 5.0, loot: [['scrap', 1, 2]] },
  eagle: { name: 'Águia de aço', robot: true, hostile: false, retaliate: true, ai: 'flyer', hp: 70, dmg: 15, walk: 4.0, run: 10, detect: 34, range: 1.6, rig: 'bird', scale: 1.6, radius: 0.6, alt: 7.0, loot: [['scrap', 2, 3], ['circuit', 1, 1]] },
};
const FLYERS = new Set(['drone', 'fly', 'wasp', 'butterfly', 'raven', 'eagle']);

export function buildCreatureAssets(renderer) {
  const qs = makeQuadSkeleton(); const qc = buildQuadClips(qs);
  const hs = makeHumanSkeleton(); const hc = buildHumanClips(hs, 'player');
  const bs = makeBirdSkeleton(); const bc = buildBirdClips(bs);
  const rigs = {}, meshes = {};
  { const ds = makeDeerSkeleton(), bs = makeBoarSkeleton(); rigs.deer = { skel: ds, clips: buildQuadClips(ds) }; rigs.boar = { skel: bs, clips: buildQuadClips(bs) }; }
  meshes.deer = renderer.createMesh(buildDeerMesh(rigs.deer.skel)); meshes.boar = renderer.createMesh(buildBoarMesh(rigs.boar.skel));
  { const cs = makeCowSkeleton(); rigs.cow = { skel: cs, clips: buildQuadClips(cs) }; meshes.cowV = COW_COATS.map((ct) => renderer.createMesh(buildCowMesh(cs, ct))); meshes.cow = meshes.cowV[0];
    const ks = makeChickenSkeleton(); rigs.chicken = { skel: ks, clips: buildChickenClips(ks) }; meshes.chickenV = [renderer.createMesh(buildChickenMesh(ks, false)), renderer.createMesh(buildChickenMesh(ks, false)), renderer.createMesh(buildChickenMesh(ks, true))]; meshes.chicken = meshes.chickenV[0]; }
  for (const [k, R] of Object.entries(ROBOT_STYLES)) {
    if (R.rig === 'human') { rigs[k] = { skel: hs, clips: hc }; meshes[k] = renderer.createMesh(withPal(R.pal, () => buildRobotHumanMesh(hs, palSt(R)))); }
    else if (R.rig === 'quad') { rigs[k] = { skel: qs, clips: qc }; meshes[k] = renderer.createMesh(k === 'tiger' ? facetize(buildTigerMesh(qs), 41, 0.05) : withPal(R.pal, () => buildRobotQuadMesh(qs, R.st))); }
    else if (R.rig === 'bird') { rigs[k] = { skel: bs, clips: bc }; meshes[k] = renderer.createMesh(withPal(R.pal, () => buildBirdMesh(bs, R.st))); }
    else { const sk = makeBugSkeleton(R.p); rigs[k] = { skel: sk, clips: buildBugClips(sk, R.p, !!R.flyer) }; meshes[k] = renderer.createMesh(withPal(R.pal, () => buildBugMesh(sk, R.p, R.st))); }
  }
  rigs.mecha = { skel: hs, clips: hc }; meshes.mecha = renderer.createMesh(buildMechaMesh(hs));
  { const cs = makeChibiSkeleton(), cc = buildHumanClips(cs, 'player'); for (const k of ['bandit', 'milsoldier', 'porter']) { rigs[k] = { skel: cs, clips: cc }; meshes[k + 'V'] = NPC_LOOKS[k].map((L) => renderer.createMesh(buildChibiMesh(cs, { name: '', ...L }))); meshes[k] = meshes[k + 'V'][0]; } }
  return { rigs, meshes };
}

let UID = 1;
export class Creature {
  constructor(kind, x, y, z, assets) {
    this.uid = UID++; this.kind = kind; this.def = DEFS[kind]; this.hp = this.def.hp; this.pos = [x, y, z]; this.home = [x, z]; this.yaw = Math.random() * 6.28;
    const rig = assets.rigs[kind]; this.clips = rig.clips; this.skel = rig.skel; this.flyer = FLYERS.has(kind);
    this.anim = new Animator(rig.skel); this.anim.play(this.clips.idle, 0); this.anim.states[0].time = Math.random() * 2;
    this.mesh = assets.meshes[kind]; const mv = assets.meshes[kind + 'V']; if (mv) { this.variant = Math.floor(Math.random() * mv.length); this.mesh = mv[this.variant]; } this.model = mat4.create(); this.state = 'wander'; this.timer = Math.random() * 3; this.goal = null; this.speed = 0;
    this.dead = false; this.deadTime = 0; this.looted = false; this.attackCd = 0; this.shootCd = 1 + Math.random() * 2; this.chargeCd = 2; this.diveCd = 2 + Math.random() * 2;
    this.alertT = 0; this.alerted = 0; this.angry = 0; this.vy = 0; this.alarmCd = 0; this.strafe = Math.random() < 0.5 ? 1 : -1;
    const s = this.def.scale; this.collider = { type: 'cyl', x, z, r: this.def.radius, y0: y, y1: y + 1.5 * s, dyn: true, creature: this };
    this.soundT = 3 + Math.random() * 8; this.missileCd = 0; this.gunCd = 0; this.heat = 0; this.spinSpeed = 0; this.spinAng = 0; this.overheated = false; this.hive = null;
    if (kind === 'rhino') { this.anim.extra.set(rig.skel.index.neck, quat.fromEuler(0.75, 0, 0)); this.anim.extra.set(rig.skel.index.head, quat.fromEuler(0.25, 0, 0)); }
    if (kind === 'tiger') this.anim.extra.set(rig.skel.index.neck, quat.fromEuler(0.35, 0, 0));
    if (kind === 'heavy') { const I = rig.skel.index, X = this.anim.extra; // postura de gorila: tronco inclinado, cabeça erguida, braços longos apoiados nos punhos
      X.set(I.spine, quat.fromEuler(0.5, 0, 0)); X.set(I.chest, quat.fromEuler(0.28, 0, 0)); X.set(I.neck, quat.fromEuler(-0.3, 0, 0)); X.set(I.head, quat.fromEuler(-0.55, 0, 0));
      X.set(I.upperArmL, quat.fromEuler(0.35, 0, 0.32)); X.set(I.upperArmR, quat.fromEuler(0.35, 0, -0.32)); X.set(I.foreArmL, quat.fromEuler(-0.25, 0, 0)); X.set(I.foreArmR, quat.fromEuler(-0.25, 0, 0));
      X.set(I.thighL, quat.fromEuler(-0.3, 0, 0.08)); X.set(I.thighR, quat.fromEuler(-0.3, 0, -0.08)); X.set(I.shinL, quat.fromEuler(0.38, 0, 0)); X.set(I.shinR, quat.fromEuler(0.38, 0, 0)); }
  }
}

export class CreatureManager {
  constructor(game, assets) { this.game = game; this.assets = assets; this.list = []; this.spawnT = 0; this.r = rng(4242); this.alarmToastT = 0; }
  spawnNear(kind, cx, cz, rmin, rmax) {
    const g = this.game, w = g.world;
    for (let k = 0; k < 20; k++) {
      const a = this.r() * 6.283, d = rmin + this.r() * (rmax - rmin); const x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d; const h = w.height(x, z);
      if (h < 1.5 || Math.abs(x) > 5050 || Math.abs(z) > 5050) continue;
      if (['deer', 'boar', 'cow', 'chicken'].includes(kind) && w.biome(x, z) === 'desert') continue;
      if (!DEFS[kind].robot && !this.force && w.toxicAt(x, z) > 0) continue; // zona tóxica: só robôs e sentinelas (nada de animais ou NPCs)
      if (!FLYERS.has(kind)) { if (w.normal(x, z)[1] < 0.75) continue; if (g.physics.query(x, z, 1.5).some((c) => g.physics.insideXZ(c, x, z, DEFS[kind].radius + 0.5))) continue; }
      if (g.nearBase(x, z, 25) && DEFS[kind].hostile) continue;
      const c = new Creature(kind, x, h, z, this.assets); if (c.flyer) c.pos[1] = h + (c.def.alt || 4);
      this.list.push(c); g.physics.dynamic.push(c.collider); return c;
    }
    return null;
  }
  // criatura controlada pela rede (avatar de outro jogador ou cópia de criatura do dono)
  // criatura num ponto exato (tripulação do helicóptero)
  spawnAt(kind, x, y, z) { if (!this.assets.rigs[kind] || !DEFS[kind]) return null; const c = new Creature(kind, x, y, z, this.assets); this.list.push(c); this.game.physics.dynamic.push(c.collider); return c; }
  addNet(kind, x, y, z) { if (!this.assets.rigs[kind] || !DEFS[kind]) return null; const c = new Creature(kind, x, y, z, this.assets); c.net = true; this.list.push(c); this.game.physics.dynamic.push(c.collider); return c; }
  remove(c) { const i = this.list.indexOf(c); if (i >= 0) this.list.splice(i, 1); const j = this.game.physics.dynamic.indexOf(c.collider); if (j >= 0) this.game.physics.dynamic.splice(j, 1); }
  populate(dt) {
    const g = this.game, p = g.player.pos; this.spawnT -= dt; if (this.spawnT > 0) return; this.spawnT = 2.5;
    const night = g.env.isNight; const counts = {}; let hostile = 0;
    for (const c of [...this.list]) { if (c.net) continue; const d = g.net && g.net.host && g.net.peers.size ? g.net.minDist(c.pos) : Math.hypot(c.pos[0] - p[0], c.pos[2] - p[2]);
      if (c.mount) continue;
      if (d > (c.npc ? 360 : c.garrison !== undefined ? 280 : 200) || (c.dead && c.deadTime > (c.npc ? 900 : 150))) { this.remove(c); continue; }
      if (!c.dead && !c.def.robot && !c.avatar && !c.adminSpawn && !c.convoy && d > 35 && g.world.toxicAt(c.pos[0], c.pos[2]) > 0) { this.remove(c); continue; } // bicho/NPC que entrou na névoa some (longe da vista)
      if (!c.dead && d < 160 && !c.hive && !c.npc) { counts[c.kind] = (counts[c.kind] || 0) + 1; if (c.def.hostile && c.kind !== 'butterfly') hostile++; } }
    const city = g.world.cityAt(p[0], p[2], 60), ruinsNear = !!city; const caveNear = g.world.caves.find((c) => Math.hypot(c.x - p[0], c.z - p[2]) < 70);
    const mul = g.settings.enemyMul; const target = Math.round((night ? 8 : 5) * mul + (ruinsNear ? 2 : 0) + (g.world.toxicAt(p[0], p[2]) > 0 ? 3 : 0));
    // fauna
    if ((counts.deer || 0) < (night ? 1 : 4)) this.spawnNear('deer', p[0], p[2], 50, 130);
    if ((counts.boar || 0) < 2) this.spawnNear('boar', p[0], p[2], 50, 130);
    if ((counts.cow || 0) < (night ? 1 : 2)) this.spawnNear('cow', p[0], p[2], 50, 130);
    if ((counts.chicken || 0) < 3) { const ch = this.spawnNear('chicken', p[0], p[2], 45, 120); if (ch) for (let k = 0; k < 2; k++) { const c2 = this.spawnNear('chicken', ch.pos[0], ch.pos[2], 1.5, 5); if (c2) c2.home = ch.home.slice(); } }
    // borboletas solares: raras, grupos de ~3 em qualquer região (menos água), depois demoram a reaparecer
    this.bflyT = (this.bflyT ?? 90 + this.r() * 120) - 2.5;
    if (this.bflyT <= 0 && !night && !(counts.butterfly > 0)) { this.bflyT = 300 + this.r() * 300;
      const lead = this.spawnNear('butterfly', p[0], p[2], 60, 130); if (lead) { lead.bfly = true; for (let k = 0; k < 2; k++) { const b = this.spawnNear('butterfly', lead.pos[0], lead.pos[2], 2, 8); if (b) b.home = lead.home.slice(); } } }
    // mechas: um por base militar, guardando o pátio (reaparece 3 dias depois de destruído)
    for (const st of g.world.sites) { if (st.kind !== 'military' || Math.hypot(st.x - p[0], st.z - p[2]) > st.r + 200 || (st.mechaRespawn || 0) > g.env.day) continue;
      const want = st.toxic ? 3 : 1; let have = this.list.filter((c) => c.kind === 'mecha' && c.siteId === st.id && !c.dead).length;
      for (; have < want; have++) { const c = this.spawnNear('mecha', st.x, st.z, 4, Math.max(8, st.r * (st.toxic ? 0.7 : 0.45))); if (c) { c.siteId = st.id; c.home = [c.pos[0], c.pos[2]]; c.origin = c.home.slice(); } else break; }
      // base militar da zona tóxica: guarnição de robôs
      if (st.toxic && Math.hypot(st.x - p[0], st.z - p[2]) < 170) { const pool = ['soldier', 'soldier', 'soldier', 'heavy', 'hunter', 'spidertank', 'drone']; if (st.garDay !== undefined && g.env.day >= st.garDay + 2) { st.garDead = 0; st.garDay = undefined; } let n = this.list.filter((c) => c.garrison === st.id && !c.dead).length;
        for (; n < 14 - (st.garDead || 0); n++) { const c = this.spawnNear(pool[Math.floor(this.r() * pool.length)], st.x, st.z, 6, st.r * 0.85); if (!c) break; c.garrison = st.id; c.home = [c.pos[0], c.pos[2]]; c.origin = c.home.slice(); } } }
    if (hostile >= target) return;
    const caps = { hauler: 1, drone: 2, soldier: 6, hunter: 4, heavy: 1, spidertank: 1, scorpion: 3, rhino: 1, tiger: 2, eagle: 2, beetle: 2, tick: 2, butterfly: 2 };
    let pool, area = 'player';
    const site = g.world.sites.find((q) => q.kind !== 'city' && Math.hypot(q.x - p[0], q.z - p[2]) < q.r + 90);
    const tox = g.world.toxicAt(p[0], p[2]) > 0;
    if (tox) { pool = ['soldier', 'soldier', 'heavy', 'spidertank', 'tick', 'tick', 'drone', 'spider', 'scorpion']; area = 'toxic'; } // Cidade Morta: androides armados e máquinas mutantes
    else if (site && site.kind === 'military') return; // base militar: só os soldados humanos (NPCs) e o mecha sentinela
    else if (site && site.kind === 'industry' && this.r() < 0.8) { pool = ['hauler', 'ant', 'ant', 'drone', 'spidertank', 'soldier', 'beetle']; area = 'site'; }
    else if (site && site.kind === 'village' && this.r() < 0.6) { pool = ['hunter', 'soldier', 'spider', 'drone', 'tiger']; area = 'site'; }
    else if (ruinsNear && (g.world.inRuins(p[0], p[2]) || this.r() < 0.7)) { pool = ['soldier', 'soldier', 'soldier', 'hunter', 'hunter', 'heavy']; area = 'ruins'; } // cidades: só humanoides armados
    else if (caveNear && this.r() < 0.6) { pool = ['spider', 'spider', 'ant', 'tick', 'scorpion']; area = 'cave'; }
    else if (night && this.r() < 0.65) pool = ['hunter', 'tiger', 'rhino', 'eagle', 'spider', 'soldier', 'fly', 'spidertank', 'scorpion'];
    else pool = ['spider', 'ant', 'beetle', 'tiger', 'rhino', 'fly', 'raven', 'spider', 'ant', 'scorpion', 'spidertank', 'drone', 'hauler'];
    let kind = null; for (let t = 0; t < 6; t++) { const k = pool[Math.floor(this.r() * pool.length)]; if ((counts[k] || 0) < (caps[k] || 4)) { kind = k; break; } }
    if (!kind) return;
    if (area === 'toxic') this.spawnNear(kind, p[0], p[2], 45, 110);
    else if (area === 'ruins') this.spawnNear(kind, city.x, city.z, 10, city.r * 0.7);
    else if (area === 'site') this.spawnNear(kind, site.x, site.z, 4, site.r + 20);
    else if (area === 'cave') this.spawnNear(kind, caveNear.x, caveNear.z, 4, 30);
    else { const a = this.spawnNear(kind, p[0], p[2], 55, 120); if (a && (kind === 'spider' || kind === 'ant' || kind === 'fly') && this.r() < 0.5) this.spawnNear(kind, a.pos[0], a.pos[2], 2, 6); }
  }
  update(dt) {
    const g = this.game; const N = g.net && g.net.active ? g.net : null; if (!g.netClient) this.populate(dt); this.updateHives(dt); this.alarmToastT -= dt;
    const P0 = g.player, multi = N && N.host && N.peers.size;
    for (const c of this.list) {
      if (c.net) { if (N) N.stepProxy(c, dt); continue; } if (g.netClient) continue;
      if (c.mount) { g.helis.crewStep(c, dt); c.anim.update(dt); this._matrices(c); g.helis.crewModel(c); if (c.npc) g.npcs.rigStep(c, dt); continue; } // tripulação do helicóptero
      const d = multi ? N.minDist(c.pos) : Math.hypot(c.pos[0] - g.player.pos[0], c.pos[2] - g.player.pos[2]);
      if (d > (c.convoy ? 260 : 130) && !c.dead) { this._matrices(c); continue; } // LOD de IA: congela longe (o comboio continua andando)
      if (multi && !c.dead) { const T = N.nearestTarget(c); g.player = T; try { this._think(c, dt, Math.hypot(c.pos[0] - T.pos[0], c.pos[2] - T.pos[2])); c.anim.update(dt); } finally { g.player = P0; } } // eventos da animação (golpe) também acertam o alvo certo
      else { this._think(c, dt, d); c.anim.update(dt); } this._matrices(c); if (c.npc) g.npcs.rigStep(c, dt);
    }
  }
  // tiros fazem barulho: androides hostis no raio vão investigar/atacar; fauna foge
  hearShot(pos, radius) {
    for (const c of this.list) { if (c.dead) continue; const d = Math.hypot(c.pos[0] - pos[0], c.pos[2] - pos[2]); if (d > radius) continue;
      if (c.def.flee) { c.state = 'flee'; c.timer = 8; continue; }
      if (c.def.robot && (c.def.hostile || c.angry > 0) && !c.hive) { c.alerted = Math.max(c.alerted || 0, 10); c.heard = pos.slice(); if (c.state === 'wander' || c.state === 'guard') c.state = c.def.ai === 'sentinel' ? 'alarm' : 'chase'; }
    }
  }
  alarm(src) {
    const g = this.game; let n = 0;
    for (const c of this.list) if (c !== src && !c.dead && c.def.robot && Math.hypot(c.pos[0] - src.pos[0], c.pos[2] - src.pos[2]) < 70) { c.alerted = 12; if (c.state === 'wander') c.state = c.def.ai === 'sentinel' ? 'alarm' : 'chase'; n++; }
    g.audio.play('alarm', { vol: 0.8, at: src.pos });
    if (this.alarmToastT <= 0 && !g.player.remote) { this.alarmToastT = 20; g.ui.toast(`⚠ ${src.def.name} detectou você e alertou ${n} androide${n === 1 ? '' : 's'}!`, 'warn'); }
  }
  _think(c, dt, dist) {
    const g = this.game, P = g.player, def = c.def, C = c.clips, w = g.world;
    const gh = w.height(c.pos[0], c.pos[2]);
    if (c.dead) {
      c.deadTime += dt; c.collider.ghost = true;
      if (c.flyer && c.pos[1] > gh + 0.01) { c.vy -= 20 * dt; c.pos[1] = Math.max(gh, c.pos[1] + c.vy * dt); if (c.pos[1] <= gh) { g.fx.burst([c.pos[0], gh + 0.3, c.pos[2]], 14, [0.6, 0.6, 0.6], 3, 0.5, 0.05); } }
      if (def.human && c.deadTime < 0.1 && !c.deathClip) c.anim.play(C.die, 0.1);
      if (c.def.robot && c.deadTime < 3 && Math.random() < dt * 6) g.fx.burst([c.pos[0], c.pos[1] + 0.6 * def.scale, c.pos[2]], 3, [1, 0.8, 0.3], 3, 0.25, 0.03);
      return;
    }
    if (def.ai === 'npc') { if (g.npcs) g.npcs.think(c, dt, dist); return; }
    c.attackCd = Math.max(0, c.attackCd - dt); c.leapCd = (c.leapCd || 0) - dt; c.coverCd = (c.coverCd || 0) - dt; c.shootCd -= dt; c.missileCd -= dt; c.gunCd -= dt; c.chargeCd -= dt; c.diveCd -= dt; c.timer -= dt; c.soundT -= dt; c.alarmCd -= dt;
    c.alerted = Math.max(0, c.alerted - dt); c.angry = Math.max(0, c.angry - dt);
    const pp = P.pos; const toP = Math.atan2(pp[0] - c.pos[0], pp[2] - c.pos[2]);
    const night = g.env.isNight;
    let detect = def.detect * (P.crouch ? 0.45 : 1) * (night && def.robot ? 1.15 : night ? 0.7 : 1) * (P.sprinting ? 1.3 : 1);
    if (P.inCave && !w.caveAt(c.pos[0], c.pos[2])) detect *= 0.5;
    if (!c.origin) c.origin = [c.pos[0], c.pos[2]];
    // visão: cone à frente + linha de visão livre (paredes, árvores e rochas escondem); de muito perto sente o jogador
    let canSee = !P.dead && !P.sleeping && !P.invis && dist < detect;
    if (canSee && (dist > 2.2 || (def.blindBack && P.crouch)) && !c.hive) { const fov = def.fov || (def.robot ? 1.15 : 1.35); const engaged = (c.state === 'chase' || c.state === 'attack' || c.state === 'firing') && (c.seenT || 0) < 1.2;
      if (!engaged && Math.abs(angleDiff(c.yaw, toP)) > fov) canSee = false;
      else { c.losT2 = (c.losT2 || 0) - dt; if (c.losT2 <= 0) { c.losT2 = 0.2 + Math.random() * 0.1; c.losOK = this._los(c); } if (c.losOK === false) canSee = false; } }
    if (canSee) { c.lastSeen = [pp[0], pp[2]]; c.seenT = 0; } else c.seenT = (c.seenT || 0) + dt;
    const aware = canSee || (c.alerted > 0 && !P.dead && c.state !== 'wander' && c.state !== 'search' && c.state !== 'return' && (c.seenT || 0) < 0.6);
    const hostileNow = def.hostile || c.angry > 0;
    let moveSpeed = 0, faceYaw = null, targetAlt = c.flyer ? gh + (def.alt || 4) + Math.sin(g.env.elapsed * 1.3 + c.uid) * 0.4 : null;
    // audição: correr faz barulho, agachado é silencioso
    const hearR = def.robot ? (P.sprinting ? 24 : Math.hypot(P.vel[0], P.vel[2]) > 2.5 ? 11 : P.crouch ? 0 : 5) * (def.hearMul || 1) : 0;
    if (hostileNow && !c.hive && !P.dead && !P.invis && dist < hearR && (c.state === 'wander' || c.state === 'search' || c.state === 'return') && !(def.ambush && c.state === 'ambush')) { c.alerted = Math.max(c.alerted, 5); c.lastSeen = [pp[0], pp[2]]; if (c.state !== 'search') { c.state = 'chase'; c.alertT = 0; } else c.timer = Math.max(c.timer, 5); }
    // emboscada (aranhas): ficam imóveis e escondidas até o jogador chegar muito perto
    if (def.ambush && c.state === 'wander' && !aware && Math.random() < dt * 0.15) { c.state = 'ambush'; c.timer = 25 + Math.random() * 20; }
    // abelhas detectam movimento perto da colmeia
    if (c.hive && c.state === 'guard' && !P.dead && Math.hypot(pp[0] - c.hive.x, pp[2] - c.hive.z) < 6.5 && P.onGround && (P.sprinting || (P.speed > 4 && !P.crouch)) && !c.hive.calm) { c.hive.angry = 20; }
    // transições
    if (def.flee && canSee && c.state !== 'flee') { c.state = 'flee'; c.timer = 6; g.audio.play('animal', { vol: 0.5 }); }
    else if (def.ai === 'sentinel' && canSee && c.state === 'wander') { c.state = 'alarm'; c.alarmCd = 0; }
    else if (c.hive && c.state !== 'guard' && !(c.hive.angry > 0) && !c.dead) { c.state = 'guard'; }
    else if ((def.missile || def.gatling) && !def.noRoar && aware && c.state === 'wander') { this._roar(c); }
    else if (hostileNow && def.ai !== 'sentinel' && !c.hive && canSee && (c.state === 'wander' || c.state === 'search' || c.state === 'return')) { c.state = 'chase'; c.alertT = 0; if (def.robot) g.audio.play('servo', { vol: clamp(1 - dist / 40, 0.15, 1) }); }
    if (c.soundT <= 0) { c.soundT = 5 + Math.random() * 9; if (dist < 40 && def.robot) g.audio.play(c.kind === 'hauler' ? 'engine' : c.flyer && c.kind !== 'raven' && c.kind !== 'eagle' ? 'buzz' : 'servo', { vol: clamp(1 - dist / 40, 0.08, 0.6) }); }
    if (c.hive && c.hive.angry > 0 && (c.state === 'guard' || c.state === 'wander')) { c.state = 'chase'; c.alerted = 30; }
    // os que só revidam (pássaros, javali, transportador) se acalmam quando a raiva passa
    if (def.retaliate && !hostileNow && !c.hive && ['chase', 'attack', 'roar', 'dive'].includes(c.state)) { c.state = 'wander'; c.alerted = 0; }
    if (def.shoot && def.rig === 'human' && c.clips.rifleAim) { const want = c.dead ? null : (c.state === 'chase' || c.state === 'attack' || c.state === 'cover') && canSee ? c.clips.rifleAim : c.clips.rifleHold; if (c._ov !== want) { c._ov = want; c.anim.setOverlay(want, want ? c.clips.masks.upper : null, 0.2); } }
    // arma giratória: velocidade de giro e resfriamento
    if (c.kind === 'mecha') { const f = c.state === 'firing'; if (c._wasFiring && !f && !c.dead) g.audio.play('spindown', { at: c.pos, max: 80 }); c._wasFiring = f; c.engaged = !c.dead && (canSee || ((c.state === 'chase' || c.state === 'spinup' || c.state === 'firing' || c.state === 'attack') && (c.seenT || 0) < 3)); }
    if (def.gatling) { const spinning = c.state === 'spinup' || c.state === 'firing'; c.spinSpeed += ((spinning ? 34 : 0) - c.spinSpeed) * Math.min(1, dt * (spinning ? 1.6 : 0.8)); c.spinAng += c.spinSpeed * dt;
      if (c.state !== 'firing') { c.heat = Math.max(0, c.heat - dt * 0.12); if (c.overheated && c.heat < 0.15) c.overheated = false; } }
    // granada barulhenta: corre até a sirene (a não ser que esteja vendo o jogador de perto)
    if (c.hornT > 0 && c.hornGoal && !(canSee && dist < 18)) { c.hornT -= dt; const hx = c.hornGoal[0] - c.pos[0], hz = c.hornGoal[1] - c.pos[2], hd = Math.hypot(hx, hz); faceYaw = Math.atan2(hx, hz); moveSpeed = hd > 11 ? def.run : 0; if (c.hornT <= 0) { c.state = 'search'; c.lastSeen = c.hornGoal.slice(); c.timer = 8; c.hornGoal = null; } c.state = c.state === 'firing' ? 'chase' : c.state; }
    else switch (c.state) {
      case 'roar': faceYaw = toP; if (c.timer <= 0) { if (def.gatling && !c.overheated) { c.state = 'spinup'; c.timer = 1.1; g.audio.play('spinup', { vol: clamp(1.3 - dist / 40, 0.3, 1) }); } else c.state = 'chase'; } break;
      case 'spinup': faceYaw = toP; if (c.timer <= 0) { c.state = 'firing'; c.fireT = 0; c.losT = 0; } break;
      case 'firing': {
        faceYaw = toP; c.fireT -= dt; c.heat = Math.min(1, c.heat + dt / 2.8);
        if (!this._los(c)) c.losT += dt; else c.losT = 0;
        if (c.fireT <= 0 && Math.abs(angleDiff(c.yaw, toP)) < 0.5) { c.fireT = 0.085; this._gunShot(c); }
        if (c.heat >= 1) { c.state = 'chase'; c.overheated = true; c.gunCd = 6; g.audio.play('steam', { vol: clamp(1.3 - dist / 40, 0.3, 1) }); g.fx.burst(this.gunMuzzle(c), 20, [0.75, 0.75, 0.78], 1.5, 1.2, 0.09, -1); }
        else if (c.losT > 1.2 || dist > (def.gunRange ? def.gunRange + 6 : 32) || P.dead) { c.state = 'chase'; c.gunCd = c.kind === 'mecha' ? 1.6 : 3; }
        break; }
      case 'guard': { // abelhas: patrulham em volta da colmeia
        const hv = c.hive; const a = g.env.elapsed * 0.9 + c.uid * 1.7; const rr = 1.6 + (c.uid % 3) * 0.8;
        const gx = hv.x + Math.cos(a) * rr, gz = hv.z + Math.sin(a) * rr; faceYaw = Math.atan2(gx - c.pos[0], gz - c.pos[2]); moveSpeed = Math.min(def.walk, Math.hypot(gx - c.pos[0], gz - c.pos[2]) * 2 + 0.6);
        targetAlt = hv.y + 0.3 + Math.sin(a * 1.7) * 0.6; break; }
      case 'wander':
        if (!c.goal || c.timer <= 0) {
          if (Math.random() < 0.4 && !c.flyer) { c.goal = null; c.timer = 2 + Math.random() * 4; c.grazing = (c.kind === 'deer' || c.kind === 'cow' || c.kind === 'chicken') && Math.random() < 0.6; }
          else { const a = Math.random() * 6.283, r = 4 + Math.random() * (c.flyer ? 25 : 14); c.goal = [c.home[0] + Math.cos(a) * r, c.home[1] + Math.sin(a) * r]; c.timer = 8; c.grazing = false; }
        }
        if (c.goal) { const dx = c.goal[0] - c.pos[0], dz = c.goal[1] - c.pos[2]; if (Math.hypot(dx, dz) < 1) c.goal = null; else { faceYaw = Math.atan2(dx, dz); moveSpeed = def.walk; } }
        break;
      case 'flee': {
        faceYaw = toP + Math.PI; moveSpeed = def.run; if (c.timer <= 0 && (dist > detect * 1.4 || !canSee)) { c.state = 'wander'; c.home = [c.pos[0], c.pos[2]]; c.goal = null; }
        if (c.timer <= -12) { c.state = 'wander'; c.home = [c.pos[0], c.pos[2]]; }
        break; }
      case 'alarm': // sentinelas: mantêm distância e chamam reforços
        if (!canSee) { c.alertT += dt; if (c.alertT > 8) { c.state = 'wander'; c.alertT = 0; } } else c.alertT = 0;
        if (c.alarmCd <= 0 && canSee) { c.alarmCd = 6; this.alarm(c); }
        if (dist < 9) { faceYaw = toP + Math.PI; moveSpeed = def.run; } else if (dist > 16) { faceYaw = toP; moveSpeed = def.walk; } else { faceYaw = toP + Math.PI / 2 * c.strafe; moveSpeed = def.walk * 0.6; }
        if (c.flyer) targetAlt = gh + (def.alt || 4) + 2;
        if (def.dmg > 0 && dist < def.range && c.attackCd <= 0) { c.state = 'attack'; this._attack(c); }
        if (def.shoot && canSee && c.shootCd <= 0 && dist > def.shoot.min && dist < def.shoot.max && this._los(c)) this._shoot(c);
        break;
      case 'search': { // procura em volta da última posição onde viu/ouviu o jogador
        if (canSee && hostileNow) { c.state = 'chase'; break; }
        if (!c.goal || Math.hypot(c.goal[0] - c.pos[0], c.goal[1] - c.pos[2]) < 1.2) { const a = Math.random() * 6.283, rr = 2 + Math.random() * 7; const b0 = c.lastSeen || [c.pos[0], c.pos[2]]; c.goal = [b0[0] + Math.cos(a) * rr, b0[1] + Math.sin(a) * rr]; }
        faceYaw = Math.atan2(c.goal[0] - c.pos[0], c.goal[1] - c.pos[2]) + Math.sin(g.env.elapsed * 1.7 + c.uid) * 0.5; moveSpeed = def.walk * 1.1;
        if (c.timer <= 0) { c.state = 'return'; c.goal = null; c.lastSeen = null; } break; }
      case 'return': { // desistiu: volta para o ponto de origem
        if (canSee && hostileNow) { c.state = 'chase'; break; } const o = c.origin; const dd = Math.hypot(o[0] - c.pos[0], o[1] - c.pos[2]);
        if (dd < 3) { c.state = 'wander'; c.home = [o[0], o[1]]; c.goal = null; c.alerted = 0; break; } faceYaw = Math.atan2(o[0] - c.pos[0], o[1] - c.pos[2]); moveSpeed = def.walk * 1.2; break; }
      case 'chase': {
        if (P.dead) { c.state = 'return'; c.goal = null; break; }
        // longe demais da origem ou do jogador: perde de vista e volta
        if (!c.hive && (Math.hypot(c.pos[0] - c.origin[0], c.pos[2] - c.origin[1]) > (def.leash || 130) || dist > Math.max(60, detect * 3))) { c.state = 'return'; c.alerted = 0; c.goal = null; break; }
        if (!canSee && !c.flyer) { // vai até a última posição em que viu o jogador
          const L = c.lastSeen; if (!L) { c.state = 'search'; c.timer = 8; break; } const dl = Math.hypot(L[0] - c.pos[0], L[1] - c.pos[2]);
          if (c.progD === undefined || dl < c.progD - 0.5) { c.progD = dl; c.progT = 0; } else c.progT = (c.progT || 0) + dt; // sem progresso (bloqueado): passa a procurar
          if (dl < 1.8 || c.seenT > 25 || c.progT > 3) { c.state = 'search'; c.timer = 8 + Math.random() * 5; c.goal = null; c.progD = undefined; break; }
          faceYaw = Math.atan2(L[0] - c.pos[0], L[1] - c.pos[2]); moveSpeed = def.run * 0.85; break; }
        c.alertT = 0;
        faceYaw = toP;
        if (c.flyer) { // órbita e mergulho
          const orbit = 6 + (def.alt || 4) * 0.4; const tang = toP + Math.PI + 1.1 * c.strafe; const ox = pp[0] + Math.sin(tang) * orbit, oz = pp[2] + Math.cos(tang) * orbit;
          faceYaw = Math.atan2(ox - c.pos[0], oz - c.pos[2]); moveSpeed = Math.min(def.run, Math.hypot(ox - c.pos[0], oz - c.pos[2]) * 1.5 + def.walk);
          targetAlt = Math.max(gh, pp[1]) + (def.alt || 4) * 0.8;
          if (c.diveCd <= 0 && dist < 16) { c.state = 'dive'; c.timer = 2.6; c.hitDone = false; this._playAttackAnim(c); }
          break;
        }
        if (c.hive && !(c.hive.angry > 0)) { c.state = 'guard'; break; }
        if (def.missile && c.missileCd <= 0 && dist > 9 && dist < 40 && this._los(c)) { this._roar(c); break; }
        if (c.kind === 'mecha' && c.missileCd <= 0 && dist > 10 && dist < 70 && this._los(c)) this._mechaMissiles(c);
        if (def.gatling && !c.overheated && c.gunCd <= 0 && dist > (c.kind === 'mecha' ? 4 : 7) && dist < (def.gunRange || 26) && this._los(c)) { c.state = 'spinup'; c.timer = 1.0; g.audio.play('spinup', { vol: clamp(1.3 - dist / 40, 0.3, 1) }); break; }
        const shoot = def.shoot;
        if (c.kind === 'spidertank') { if (canSee && shoot && dist > 4 && dist < shoot.max && c.shootCd <= 0 && !(c.webAim > 0)) c.webAim = 1.6; if (c.webAim > 0) { c.webAim -= dt; faceYaw = toP + Math.PI; moveSpeed = def.walk * 0.3; if (Math.abs(angleDiff(c.yaw, toP + Math.PI)) < 0.35) { this._web(c); c.webAim = 0; } else if (c.webAim <= 0) c.shootCd = 1; } } // vira a traseira e atira teia
        else if (shoot && dist > shoot.min && dist < shoot.max && c.shootCd <= 0 && this._los(c)) { this._shoot(c); }
        if (def.leap && (c.leapCd || 0) <= 0 && dist > 3.5 && dist < 9 && Math.abs(pp[1] - c.pos[1]) < 2 && this._los(c) && (!def.gatling || c.overheated || c.gunCd > 0)) { c.state = 'leap'; c.leapYaw = toP; c.vy = 5.2; c.hitDone = false; g.audio.play('tigerRoar', { vol: clamp(1.2 - dist / 30, 0.3, 1) }); break; }
        if (def.tactical && c.hp < def.hp * 0.45 && (c.coverCd || 0) <= 0 && !c.usedCover) { c.usedCover = true; this._takeCover(c, false); break; }
        if (def.charge && c.chargeCd <= 0 && dist > 5 && dist < 18 && this._los(c) && this._chargeClear(c, toP, dist)) { c.charges = (c.charges || 0) + 1; c.state = 'charge'; c.timer = 2.4; c.chargeYaw = toP; c.hitDone = false; g.audio.play('servo', { vol: 1 }); g.cam.shake = Math.max(g.cam.shake, 0.15); break; }
        if (def.ai === 'ranged' && dist > def.range + 0.6) { // mantém distância de tiro e se move lateralmente
          if (dist > 15) moveSpeed = def.run; else if (dist < 6) { faceYaw = toP + Math.PI; moveSpeed = def.walk * 1.4; } else { faceYaw = toP + Math.PI / 2 * c.strafe; moveSpeed = def.walk; if (Math.random() < dt * 0.3) c.strafe *= -1; }
          if (C.aim && !c.anim.busy && dist < shoot.max) c.anim.playAction(C.aim, { mask: C.masks.upper, fadeIn: 0.2, fadeOut: 0.2 });
          c.aimYaw = toP;
        } else if (c.kind === 'mecha') moveSpeed = dist > 18 ? def.walk : dist < 4 ? def.walk : 0;
        else moveSpeed = dist > 6 ? def.run : Math.max(def.walk * 1.4, def.run * 0.7);
        if (dist < def.range * def.scale ** 0.3 && c.attackCd <= 0) { c.state = 'attack'; this._attack(c); }
        break; }
      case 'attack': faceYaw = toP; if (!c.anim.busy || (c.anim.action && c.anim.action.clip === C.aim)) c.state = 'chase'; break;
      case 'charge': {
        faceYaw = c.chargeYaw; moveSpeed = def.charge;
        const before = [c.pos[0], c.pos[2]];
        if (!c.hitDone && dist < def.radius * def.scale + 0.9 && Math.abs(pp[1] - c.pos[1]) < 1.5) { c.hitDone = true; g.playerHit(def.dmg * 1.3, c); g.knockback(c.chargeYaw, 9); }
        c._chargeCheck = before; this._smash(c);
        if (c.timer <= 0 || (dist > 6 && Math.abs(angleDiff(c.chargeYaw, toP)) > 2.2 && c.timer < 1.6)) { c.state = 'chase'; c.chargeCd = 6 + Math.random() * 3; }
        break; }
      case 'stun': if (c.timer <= 0) c.state = 'chase'; break;
      case 'ambush': { // parada, rente ao chão; ataca de surpresa com um salto
        moveSpeed = 0; c.hidden = true;
        if (!P.dead && dist < 6.5 && !P.sleeping) { c.hidden = false; c.state = 'leap'; c.timer = 0.9; c.leapYaw = toP; c.vy = 5.5; c.hitDone = false; g.audio.play('servo', { vol: 1 }); }
        else if (c.timer <= 0) { c.hidden = false; c.state = 'wander'; }
        break; }
      case 'leap': { // salto de ataque (tigre/aranha)
        faceYaw = c.leapYaw; moveSpeed = (def.leapSpeed || def.run * 1.7); c.vy -= 16 * dt; c.pos[1] += c.vy * dt; c.airborne = true;
        if (!c.hitDone && dist < def.radius * def.scale + 1.1 && Math.abs(pp[1] + 0.8 - c.pos[1]) < 1.6) { c.hitDone = true; if (g.playerHit(def.dmg * 1.5, c)) { g.knockback(c.leapYaw, 6); g.addStatus && g.addStatus('bleed', 12); } }
        if (c.vy < 0 && c.pos[1] <= gh) { c.pos[1] = gh; c.airborne = false; c.state = 'chase'; c.leapCd = 4 + Math.random() * 3; }
        break; }
      case 'cover': { // soldado: corre para trás de um obstáculo, recarrega e volta ao combate
        c.reloadLeft -= dt; const cp = c.coverPt;
        if (cp) { const dx = cp[0] - c.pos[0], dz = cp[1] - c.pos[2]; const d = Math.hypot(dx, dz); if (d > 0.7) { faceYaw = Math.atan2(dx, dz); moveSpeed = def.run; } else { faceYaw = toP; c.inCover = true; } }
        if (c.reloadLeft <= 0 && !c.reloaded) { c.reloaded = true; c.ammo = def.mag; c.reloads = (c.reloads || 0) + 1; g.audio.play('magIn', { vol: clamp(1 - dist / 30, 0.1, 0.8) }); }
        if (c.reloaded && (c.inCover || !cp) && c.timer <= 0) { c.state = 'chase'; c.inCover = false; c.coverCd = 6; }
        break; }
      case 'dive': {
        const tx = pp[0], tz = pp[2], ty = pp[1] + 0.7; const dx = tx - c.pos[0], dz = tz - c.pos[2], dy = ty - c.pos[1]; const dd = Math.hypot(dx, dy, dz);
        faceYaw = Math.atan2(dx, dz); const sp = def.run * 1.25; moveSpeed = sp * Math.hypot(dx, dz) / Math.max(dd, 0.01); c.pos[1] += (dy / Math.max(dd, 0.01)) * sp * dt; targetAlt = null;
        if (!c.hitDone && dd < def.range + def.radius) { c.hitDone = true; g.playerHit(def.dmg, c); }
        if (c.hitDone || c.timer <= 0) { c.state = 'climb'; c.timer = 1.4; c.diveCd = 3 + Math.random() * 3; c.strafe *= -1; }
        break; }
      case 'climb': faceYaw = toP + Math.PI * 0.7 * c.strafe; moveSpeed = def.run * 0.8; if (c.timer <= 0) c.state = aware ? 'chase' : 'wander'; break;
      case 'hurt': if (!c.anim.busy) c.state = hostileNow ? 'chase' : def.flee ? 'flee' : 'wander'; break;
    }
    if (faceYaw !== null) c.yaw = dampAngle(c.yaw, faceYaw, c.state === 'attack' ? 8 : c.state === 'charge' ? 3 : 6, dt);
    if (['attack', 'hurt', 'stun', 'roar', 'spinup', 'firing'].includes(c.state)) moveSpeed = c.flyer ? def.walk * 0.3 : 0;
    // ----- locomoção -----
    if (c.flyer) {
      c.pos[0] += Math.sin(c.yaw) * moveSpeed * dt; c.pos[2] += Math.cos(c.yaw) * moveSpeed * dt;
      if (targetAlt !== null) c.pos[1] += (targetAlt - c.pos[1]) * Math.min(1, 2.2 * dt);
      const floor = w.height(c.pos[0], c.pos[2]) + 0.35; if (c.pos[1] < floor) c.pos[1] = floor;
      if (g.world.heightFast(c.pos[0] + Math.sin(c.yaw) * 6, c.pos[2] + Math.cos(c.yaw) * 6) < -12) c.yaw += Math.PI; // não voa para o mar aberto
    } else {
      if (moveSpeed > 0) {
        let yaw = c.state === 'charge' ? c.chargeYaw : c.yaw; const blocked = (yw) => { const x = c.pos[0] + Math.sin(yw) * 1.4 * def.scale, z = c.pos[2] + Math.cos(yw) * 1.4 * def.scale; if (w.height(x, z) < WATER + 0.4) return true;
          if (w.normal(x, z)[1] < 0.6) return true; for (const k of g.physics.query(x, z, 1)) if (!k.dyn && !k.ghost && !k.camOnly && k.y1 > c.pos[1] + 0.6 && k.y0 < c.pos[1] + 1.2 && g.physics.insideXZ(k, x, z, def.radius * 0.8)) return true; return false; };
        if (c.state === 'charge') { if (blocked(yaw)) { c.state = 'stun'; c.timer = 1.6; c.chargeCd = 7; g.audio.play('rockbreak', { vol: 0.6 }); g.fx.burst([c.pos[0] + Math.sin(yaw) * def.radius * def.scale, c.pos[1] + 0.8, c.pos[2] + Math.cos(yaw) * def.radius * def.scale], 16, [1, 0.8, 0.4], 4, 0.4, 0.04); moveSpeed = 0; } }
        else if (blocked(yaw)) { let found = false; for (const off of [0.6, -0.6, 1.2, -1.2, 1.9, -1.9]) if (!blocked(yaw + off)) { yaw += off; found = true; break; } if (!found) moveSpeed = 0; c.yaw = dampAngle(c.yaw, yaw, 10, dt); }
        c._mv = [Math.sin(yaw) * moveSpeed * dt, Math.cos(yaw) * moveSpeed * dt];
      }
      const r = Math.max(def.radius, (c.flyer ? 0.2 : 0.3) * def.scale); c.collider.ghost = true; { const mv = c._mv || [0, 0]; c._mv = null; const n = Math.min(8, Math.max(1, Math.ceil(Math.hypot(mv[0], mv[1]) / 0.12))); for (let k = 0; k < n; k++) { c.pos[0] += mv[0] / n; c.pos[2] += mv[1] / n; g.physics.resolve(c.pos, r, 1.3, 0.6); } } c.collider.ghost = false;
      if (!c.airborne) { const [gy] = g.physics.ground(c.pos[0], c.pos[2], r * 0.5, c.pos[1] + 0.3, 0.6); c.pos[1] += (gy - c.pos[1]) * Math.min(1, 15 * dt); }
    }
    // não atravessa o jogador
    const dpx = c.pos[0] - pp[0], dpz = c.pos[2] - pp[2], dp = Math.hypot(dpx, dpz), minD = def.radius + 0.36;
    if (dp < minD && dp > 1e-3 && !P.dead && (!c.flyer || Math.abs(c.pos[1] - pp[1]) < 1.6)) { c.pos[0] += dpx / dp * (minD - dp); c.pos[2] += dpz / dp * (minD - dp); }
    c.speed = moveSpeed;
    c.collider.x = c.pos[0]; c.collider.z = c.pos[2]; c.collider.y0 = c.pos[1]; c.collider.y1 = c.pos[1] + 1.5 * def.scale;
    // animação base
    let clip = C.idle, sp = 1;
    const rigH = def.rig === 'human';
    // passos robóticos (som posicional/estéreo)
    if (c.kind === 'mecha' && moveSpeed > 0.3 && dist < 90) { c.stepT = (c.stepT || 0) - dt * (moveSpeed / 1.5); if (c.stepT <= 0) { c.stepT = 0.85; g.audio.play('mechastep', { at: [c.pos[0], c.pos[1], c.pos[2]], max: 90, vol: 1 }); if (dist < 25) g.cam.shake = Math.max(g.cam.shake, 0.18 * (1 - dist / 25)); } }
    else if (def.robot && !c.flyer && moveSpeed > 0.3 && dist < 32) { c.stepT = (c.stepT || 0) - dt * (moveSpeed / 1.6); if (c.stepT <= 0) { c.stepT = 0.42; g.audio.play('robotStep', { at: [c.pos[0], c.pos[1], c.pos[2]], vol: Math.min(1, 0.35 + def.scale * 0.35), max: 32 }); } }
    if (c.flyer) { clip = moveSpeed > def.walk * 1.3 ? C.run : moveSpeed > 0.2 ? C.walk : C.idle; }
    else if (moveSpeed > def.walk * 1.5) { clip = C.run; sp = moveSpeed / (rigH ? 4.3 : def.rig === 'bug' ? 3.5 * def.scale : def.run * 0.85) / (rigH ? def.scale : 1); }
    else if (moveSpeed > 0.1) { clip = C.walk; sp = moveSpeed / (rigH ? 1.75 * def.scale : def.rig === 'bug' ? 1.2 * def.scale : def.walk); }
    else if (c.grazing && C.graze) clip = C.graze;
    if (c.state === 'charge') sp *= 1.4;
    c.anim.play(clip, 0.25, Math.max(0.3, Math.min(sp, 2.5)));
  }
  _roar(c) {
    const g = this.game, P = g.player, C = c.clips, def = c.def; const d = Math.hypot(c.pos[0] - P.pos[0], c.pos[2] - P.pos[2]);
    c.state = 'roar'; c.timer = 1.35; c.alertT = 0; c.alerted = Math.max(c.alerted, 8);
    g.audio.play(c.kind === 'rhino' ? 'rhinoRoar' : 'tigerRoar', { vol: clamp(1.4 - d / 50, 0.35, 1) }); g.cam.shake = Math.max(g.cam.shake, clamp(0.5 - d / 60, 0, 0.4));
    c.anim.playAction(C.roar, { fadeIn: 0.1, fadeOut: 0.2, onEvent: (n) => { if (n === 'fire' && def.missile && !c.dead) { this._missile(c); c.missileCd = 11 + Math.random() * 4; } } });
  }
  _boneP(c, bone, local) { return mat4.transformPoint(mat4.mul(mat4.create(), c.model, c.anim.world[c.skel.index[bone]]), local); }
  hornTip(c) { return this._boneP(c, 'head', [0, 0.08, 0.42]); }
  gunMuzzle(c) { if (c.kind === 'mecha') { c._gs = -(c._gs || 1); return this._boneP(c, 'chest', [c._gs * 0.6, -0.1, 1.06]); } return this._boneP(c, 'chest', [0, 0.32, 0.5]); }
  mechaLamp(c) { return mat4.mul(mat4.create(), mat4.mul(mat4.create(), c.model, c.anim.world[c.skel.index.chest]), mat4.fromTRS(mat4.create(), [0, 0.08, 0.33], [0, 0, 0, 1], [1.3, 1.3, 1.3])); }
  // mecha: dois mísseis, um de cada casulo dos ombros
  _mechaMissiles(c) { const g = this.game, P = g.player; c.missileCd = 9 + Math.random() * 4; for (const s of [-1, 1]) setTimeout(() => { if (c.dead || P.dead) return; const from = this._boneP(c, 'chest', [s * 0.5, 0.44, 0.24]); g.spawnMissile(from, [P.pos[0], P.pos[1] + 1.0, P.pos[2]], c); g.fx.burst(from, 16, [1, 0.6, 0.2], 3, 0.4, 0.06); g.audio.play('missileLaunch', { at: from, max: 90 }); }, s < 0 ? 0 : 350); }
  gunMatrix(c, side = 0) { const m = mat4.mul(mat4.create(), c.model, c.anim.world[c.skel.index.chest]); const off = c.kind === 'tiger' ? [side * 0.26, 0.4, 0.24] : c.kind === 'mecha' ? [side * 0.6, -0.1, 0.32] : [0, 0.32, 0.03]; return mat4.mul(m, m, mat4.fromTRS(mat4.create(), off, quat.fromEuler(0, 0, c.spinAng * (side < 0 ? -1 : 1)), [1, 1, 1])); }
  _missile(c) {
    const g = this.game, P = g.player; const from = this.hornTip(c);
    g.spawnMissile(from, [P.pos[0], P.pos[1] + 1.0, P.pos[2]], c);
    g.fx.burst(from, 18, [1, 0.6, 0.2], 3, 0.4, 0.06); g.audio.play('missileLaunch', { vol: clamp(1.3 - Math.hypot(c.pos[0] - P.pos[0], c.pos[2] - P.pos[2]) / 50, 0.3, 1) });
  }
  _gunShot(c) {
    const g = this.game, P = g.player; const m = this.gunMuzzle(c); const d = Math.hypot(P.pos[0] - m[0], P.pos[2] - m[2]); const spread = 0.6 + d * 0.06;
    const tgt = [P.pos[0] + (Math.random() - 0.5) * spread, P.pos[1] + 1.0 + (Math.random() - 0.5) * spread * 0.6, P.pos[2] + (Math.random() - 0.5) * spread];
    g.spawnProjectile(m, tgt, 125, 3, c, true); g.fx.burst(m, 3, [6, 4, 1.6], 2, 0.06, 0.05); g.audio.play('minigun', { vol: clamp(1.2 - d / 45, 0.25, 1) });
  }
  // colmeias: abelhas nascem por colmeia e defendem quando o jogador chega perto ou pega o mel
  updateHives(dt) {
    const g = this.game, P = g.player.pos, day = g.env.day;
    for (const hv of g.world.hives) {
      const d = Math.hypot(hv.x - P[0], hv.z - P[2]);
      if (hv.killedDay !== day) { hv.killedDay = day; hv.killed = 0; }
      if (d < 80) { const alive = this.list.filter((c) => c.hive === hv && !c.dead).length; const want = 4 - alive - hv.killed;
        for (let k = 0; k < want; k++) { const c = this.spawnNear('wasp', hv.x, hv.z, 0.5, 2.5); if (c) { c.hive = hv; c.state = 'guard'; c.pos[1] = hv.y; c.home = [hv.x, hv.z]; } } }
      const smoke = g.equip.hand === 'torch' && !g.player.swimming; hv.calm = smoke && d < 14;
      if (hv.robbed > 0) hv.robbed -= dt; if (smoke && d < 14 && !(hv.robbed > 0) && hv.angry > 0) hv.angry = Math.max(0, hv.angry - dt * 8);
      if (smoke && d < 14 && !hv.torchTip) { hv.torchTip = true; g.ui.toast('🔥 A fumaça da tocha acalma as abelhas cibernéticas… até você pegar o mel.', 'info'); }
      if (!g.player.dead && d < 5.5 && Math.abs(P[1] - hv.y) < 7 && !smoke) { if (!(hv.angry > 0)) g.ui.toast('🐝 Você chegou perto demais da colmeia! As abelhas cibernéticas atacam!', 'warn'); hv.angry = Math.max(hv.angry || 0, 18); }
      else if (d < 14 && !(hv.angry > 0) && !hv.warned) { hv.warned = true; g.ui.toast('🐝 Colmeia de abelhas cibernéticas por perto. Elas atacam se você se aproximar ou pegar o mel — uma tocha na mão as acalma.', 'info'); }
      if (hv.angry > 0 && (d > 22 || g.player.dead)) hv.angry = Math.max(0, hv.angry - dt * 3);
      if (d > 40) { hv.warned = false; hv.torchTip = false; }
    }
  }
  _los(c) { const g = this.game, P = g.player; const from = [c.pos[0], c.pos[1] + 1.2 * c.def.scale, c.pos[2]], to = [P.pos[0], P.pos[1] + 1.2, P.pos[2]]; return g.physics.rayFree(from, to, 0.02, null) > 0.97 && !(g.smokeBlocks && g.smokeBlocks(from, to)); }
  // teia pela fiandeira (traseira): quem é atingido fica lento
  _web(c) { const g = this.game, P = g.player, def = c.def; c.shootCd = (def.shoot.cd || 2.5) + Math.random(); const back = [-Math.sin(c.yaw), -Math.cos(c.yaw)];
    const from = [c.pos[0] + back[0] * 1.2 * def.scale, c.pos[1] + 0.55 * def.scale, c.pos[2] + back[1] * 1.2 * def.scale]; const tgt = [P.pos[0] + (Math.random() - 0.5) * 0.8, P.pos[1] + 1.0, P.pos[2] + (Math.random() - 0.5) * 0.8];
    g.spawnProjectile(from, tgt, 38, 2, c); g.projectiles[g.projectiles.length - 1].web = true; g.audio.play('webShot', { at: from, max: 50 }); }
  _shoot(c) {
    const g = this.game, def = c.def, C = c.clips, P = g.player; const sh = def.shoot; c.shootCd = sh.cd + Math.random() * 0.8;
    if (def.tactical) { if (c.ammo === undefined) c.ammo = def.mag; c.ammo--; if (c.ammo <= 0) setTimeout(() => { if (!c.dead) this._takeCover(c, true); }, 450); }
    const n = sh.burst || 1;
    const fire = (k) => {
      if (c.dead) return; const fwd = [Math.sin(c.yaw), Math.cos(c.yaw)];
      const muzzle = def.rig === 'human' ? [c.pos[0] + fwd[0] * 0.75 - fwd[1] * 0.1, c.pos[1] + sh.y * def.scale, c.pos[2] + fwd[1] * 0.75 + fwd[0] * 0.1] : [c.pos[0] + fwd[0] * 0.5 * def.scale + (k % 2 ? 0.07 : -0.07), c.pos[1] + sh.y * def.scale, c.pos[2] + fwd[1] * 0.5 * def.scale];
      const lead = Math.hypot(P.pos[0] - muzzle[0], P.pos[2] - muzzle[2]) / sh.speed * 0.6;
      const dd = Math.hypot(P.pos[0] - muzzle[0], P.pos[2] - muzzle[2]); const sp = 0.6 + dd * 0.045 + (P.crouch ? 0.2 : 0) + (Math.hypot(P.vel[0], P.vel[2]) > 4 ? 0.4 : 0); const tgt = [P.pos[0] + P.vel[0] * lead + (Math.random() - 0.5) * sp, P.pos[1] + 1.15 + (Math.random() - 0.5) * sp * 0.6, P.pos[2] + P.vel[2] * lead + (Math.random() - 0.5) * sp];
      g.spawnProjectile(muzzle, tgt, sh.speed, sh.dmg, c); const hum = c.def.rig === 'human'; g.fx.burst(muzzle, 6, hum ? [6, 4, 1.6] : [1, 0.4, 0.2], 2, 0.08, 0.05); g.audio.play(hum ? 'rifle' : 'laser', { at: muzzle, max: hum ? 160 : 60, vol: hum ? 0.85 : 1 });
    };
    if (def.rig === 'human') { c.anim.playAction(C.shoot, { mask: C.masks.upper, fadeIn: 0.05, fadeOut: 0.15, onEvent: (e) => { if (e === 'fire') fire(0); } }); }
    else for (let k = 0; k < n; k++) setTimeout(() => fire(k), k * 180);
  }
  _playAttackAnim(c, onHit) {
    const C = c.clips, def = c.def; const clip = def.rig === 'human' ? (C[def.attack] || C.claw) : C.attack;
    c.anim.playAction(clip, { mask: def.rig === 'human' ? C.masks.upper : null, speed: def.attackSpeed || 1, fadeIn: 0.08, fadeOut: 0.2, onEvent: (n) => { if (n === 'hit' && onHit) onHit(); } });
  }
  // procura cobertura: ponto atrás de árvore/rocha/parede em relação ao jogador
  _takeCover(c, reload) {
    const g = this.game, P = g.player, ph = g.physics; let best = null, bs = Infinity;
    for (const k of ph.query(c.pos[0], c.pos[2], 14)) {
      if (k.ghost || k.dyn || k.camOnly || k.y1 - k.y0 < 1.2) continue; const kr = k.type === 'cyl' ? k.r : Math.max(k.hx, k.hz);
      const ax = k.x - P.pos[0], az = k.z - P.pos[2], al = Math.hypot(ax, az) || 1; const pt = [k.x + ax / al * (kr + 0.9), k.z + az / al * (kr + 0.9)];
      const dme = Math.hypot(pt[0] - c.pos[0], pt[1] - c.pos[2]), dp = Math.hypot(pt[0] - P.pos[0], pt[1] - P.pos[2]); if (dp < 6 || dme > 16) continue;
      const sc = dme + (dp < 10 ? 6 : 0); if (sc < bs) { bs = sc; best = pt; }
    }
    if (!best) { const a = Math.atan2(c.pos[0] - P.pos[0], c.pos[2] - P.pos[2]); best = [c.pos[0] + Math.sin(a) * 8, c.pos[2] + Math.cos(a) * 8]; }
    c.state = 'cover'; c.coverPt = best; c.inCover = false; c.timer = 1.5 + Math.random();
    c.reloaded = !reload; c.reloadLeft = reload ? c.def.reloadT : 0;
    if (reload) { g.audio.play('magOut', { vol: clamp(1 - Math.hypot(c.pos[0] - P.pos[0], c.pos[2] - P.pos[2]) / 30, 0.1, 0.8) }); if (c.clips.reloadRifle) c.anim.playAction(c.clips.reloadRifle, { mask: c.clips.masks.upper, speed: c.clips.reloadRifle.duration / c.def.reloadT, fadeIn: 0.1, fadeOut: 0.2 }); }
  }
  // só investe com caminho livre de rochas e prédios (árvores e construções ele derruba)
  _chargeClear(c, yaw, dist) {
    const g = this.game, r = c.def.radius * c.def.scale * 0.8, sx = Math.sin(yaw), sz = Math.cos(yaw);
    for (let t = 1.5; t < dist; t += 1) { const x = c.pos[0] + sx * t, z = c.pos[2] + sz * t;
      if (g.world.height(x, z) < WATER + 0.4) return false;
      for (const k of g.physics.query(x, z, r + 0.5)) { if (k.ghost || k.dyn || k.camOnly || k.tree || k.piece) continue; if (k.y1 < c.pos[1] + 0.5 || k.y0 > c.pos[1] + 1.5) continue; if (g.physics.insideXZ(k, x, z, r)) return false; } }
    return true;
  }
  // investida: derruba árvores e destrói construções no caminho
  _smash(c) {
    const g = this.game; const r = c.def.radius * c.def.scale + 0.6; const fx = Math.sin(c.yaw), fz = Math.cos(c.yaw);
    const px = c.pos[0] + fx * r * 0.8, pz = c.pos[2] + fz * r * 0.8;
    for (const k of g.physics.query(px, pz, r)) {
      if (k.ghost || k.dyn || !g.physics.insideXZ(k, px, pz, r * 0.6)) continue;
      if (k.tree && !k.tree.felled) { g._fellTree(k.tree, c.yaw); g.cam.shake = Math.max(g.cam.shake, 0.3); g.audio.play('rockbreak', { vol: 0.8 }); }
      else if (k.piece && g.build.pieces.includes(k.piece)) { const pc = k.piece; g.build.remove(pc, false); g.fx.burst([pc.x, pc.y + 1, pc.z], 30, [0.5, 0.38, 0.25], 5, 0.9, 0.08); g.audio.play('rockbreak', { vol: 1 }); g.ui.toast(`💥 ${c.def.name} destruiu sua construção!`, 'warn'); }
    }
  }
  _attack(c) {
    const g = this.game; c.attackCd = 1.3 + Math.random() * 0.6 / (c.def.attackSpeed || 1);
    g.audio.play(c.def.robot ? 'servo' : 'growl', { vol: 0.7 });
    this._playAttackAnim(c, () => {
      if (c.dead) return; const P = g.player; const d = Math.hypot(c.pos[0] - P.pos[0], c.pos[2] - P.pos[2]);
      const ang = Math.abs(angleDiff(c.yaw, Math.atan2(P.pos[0] - c.pos[0], P.pos[2] - c.pos[2])));
      if (d < c.def.range * Math.max(1, c.def.scale * 0.8) + 0.6 && ang < 1.1 && Math.abs(P.pos[1] - c.pos[1]) < 1.8 && this._los(c)) { const landed = g.playerHit(c.def.dmg, c, c.def.drill ? { pierce: true } : null); if (c.def.scale > 1.4) g.knockback(c.yaw, 5); if (landed && g.addStatus) { if (c.def.poison && Math.random() < 0.6) g.addStatus('poison', c.def.poison); if (c.def.drill || c.kind === 'tiger' || c.kind === 'hunter') g.addStatus('bleed', c.def.drill ? 14 : 8); } }
      else g.audio.play('swing');
    });
  }
  damage(c, dmg, fromYaw, kind) {
    if (c.net) { if (this.game.net) this.game.net.onDamage(c, dmg, fromYaw, kind); return; }
    if (c.dead) return; const g = this.game;
    if (c.def.heavyArmor) { // mecha: só C4 (3), foguete (2) ou granada de fragmentação (14) o derrubam
      const per = { c4: c.def.hp / 3 + 0.5, rocket: c.def.hp / 2 + 0.5, grenade: c.def.hp / 14 + 0.05 }[kind] || 0;
      if (!per) { g.fx.burst([c.pos[0], c.pos[1] + 2.5, c.pos[2]], 6, [3, 2.2, 1], 4, 0.2, 0.03, 6); g.audio.play('metalHit', { at: c.pos, vol: 0.6 }); if (!this._armorTip || g.env.elapsed - this._armorTip > 8) { this._armorTip = g.env.elapsed; g.ui.toast('🛡 Blindagem pesada! Só C4 (3), lança-foguetes (2) ou lança-granadas (14) derrubam o mecha.', 'warn'); }
        if (c.state === 'wander' || c.state === 'search' || c.state === 'return') { c.state = 'chase'; c.lastSeen = [g.player.pos[0], g.player.pos[2]]; } return; }
      dmg = per; }
    // humano desmaiado levando mais dano: é finalizado (bruços, mexe os braços, poça de sangue)
    if (c.npc && c.fainted > 0) { c.hp = 0; c.fainted = 0; c.dead = true; c.anim.action = null; c.deathClip = c.clips.finish; c.anim.play(c.clips.finish, 0.05); c.deadTime = 0; c.vy = 0; g.audio.play('hit', { at: c.pos }); g.audio.play('enemyDie', { vol: 0.9 }); g.addBloodPool && g.addBloodPool(c.pos[0], c.pos[2], c.yaw); g.onCreatureKilled(c); return; }
    if (c.convoy && g.convoys) g.convoys.onHurt(c);
    c.hp -= dmg; g.audio.play(c.def.robot ? 'metalHit' : 'hit', c.npc ? { at: c.pos } : undefined);
    // tiro que tira 70% da vida total sem matar: desmaia de peito no chão
    if (c.npc && !c.mount && c.hp > 0 && dmg >= c.def.hp * 0.7) { c.fainted = 20 + Math.random() * 10; c.target = null; c.anim.action = null; c.anim.play(c.clips.faint, 0.1); g.audio.play('groan', { at: c.pos, f0: c.voice || 150 }); g.fx.burst([c.pos[0], c.pos[1] + 0.8, c.pos[2]], 14, [0.6, 0.05, 0.05], 3, 0.6); return; }
    if (c.npc && kind !== 'robot' && kind !== 'npc' && c.hp > 0) { c.target = 'player'; c.lostT = 0; if ((c.shoutCd || 0) <= 0) { c.shoutCd = 5; g.audio.play('groan', { at: c.pos, f0: c.voice || 150 }); } }
    const hp = [c.pos[0], c.pos[1] + 0.8 * c.def.scale, c.pos[2]];
    if (c.def.robot) { g.fx.burst(hp, 12, [1, 0.75, 0.3], 4, 0.35, 0.04); g.fx.burst(hp, 6, [0.35, 0.35, 0.38], 2, 0.6, 0.06); } else g.fx.burst(hp, 14, [0.6, 0.05, 0.05], 3, 0.6);
    const kb = 0.35 / Math.max(1, c.def.scale); c.pos[0] += Math.sin(fromYaw) * kb; c.pos[2] += Math.cos(fromYaw) * kb;
    c.alerted = 10;
    if (c.hp <= 0) { c.dead = true; c.anim.action = null; c.anim.play(c.clips.die, 0.1); c.deadTime = 0; c.vy = 0; g.audio.play(c.def.robot ? 'robotDie' : 'enemyDie', { vol: 0.9 }); if (c.hive) { c.hive.killed = (c.hive.killed || 0) + 1; c.hive.angry = Math.max(c.hive.angry || 0, 15); } g.onCreatureKilled(c); return; }
    if (c.def.retaliate) { c.angry = 25; if (c.def.ai === 'flyer') for (const o of this.list) if (o !== c && o.kind === c.kind && !o.dead && Math.hypot(o.pos[0] - c.pos[0], o.pos[2] - c.pos[2]) < 45) o.angry = 20; } // o bando revida junto
    if (c.npc) { if (c.hp > 0 && (!c.anim.busy)) c.anim.playAction(c.clips.hit, { mask: c.clips.masks.upper, fadeIn: 0.04, fadeOut: 0.15 }); return; }
    if (['charge', 'firing', 'spinup', 'roar'].includes(c.state)) return; // ações pesadas não são interrompidas
    if (!c.anim.busy || (c.anim.action && c.anim.action.clip === c.clips.aim)) c.anim.playAction(c.clips.hit, { mask: c.def.rig === 'human' ? c.clips.masks.upper : null, fadeIn: 0.04, fadeOut: 0.15 });
    if (c.state === 'dive') { c.state = 'climb'; c.timer = 1.2; c.diveCd = 3; }
    else if (c.def.ai === 'sentinel') c.state = 'alarm';
    else { c.state = c.def.flee ? 'flee' : 'chase'; c.timer = c.def.flee ? 8 : 6; }
  }
  _matrices(c) { mat4.fromTRS(c.model, c.hidden ? [c.pos[0], c.pos[1] - 0.14 * c.def.scale, c.pos[2]] : c.pos, quat.fromEuler(0, c.yaw, 0), [c.def.scale, c.def.scale, c.def.scale]); }
}
