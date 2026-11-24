// Modelos 3D das armas de fogo (geometria procedural detalhada, materiais PBR por faixa de alfa):
// cano ao longo de +Z, empunhadura descendo em -Y a partir da origem (ponto da mão).
import { MeshBuilder, M, hex, shade } from '../engine/mesh.js';
import { harpoonGunMesh } from './machines.js';

const MET = 0.5, WOOD = 0.63, POLY = 0.86; // faixas de material (metal, madeira, polímero ~ tecido/borracha fosco)
const RX = Math.PI / 2; // cilindros (eixo Y) deitados ao longo de +Z

// Cada arma usa uma munição própria; o dano cresce com o calibre. 'scopes' = lunetas que encaixam no trilho.
// speed = velocidade na boca do cano (m/s, escala de jogo): quanto maior, menor a queda pela gravidade.
export const GUNS = {
  bow: { ammo: 'arrow', direct: true, mag: 1, dmg: 46, rate: 0.9, auto: false, pellets: 1, spread: 0.003, hipSpread: 0.035, recoil: 0.01, range: 140, projectile: true, speed: 52, sound: 'bowShot', muzzle: [0, 0.02, 0.12], hold: 'pistol', falloff: 999, silent: true },
  // pistolas (não aceitam luneta)
  // lança-granadas improvisado (só fabricação): tiro único em arco; munição escolhida com T
  gl: { model: 'gl', ammo: 'gren_he', ammoTypes: ['gren_he', 'gren_gas', 'gren_smoke'], mag: 1, dmg: 0, rate: 0.9, auto: false, pellets: 1, spread: 0.004, hipSpread: 0.03, recoil: 0.12, range: 140, speed: 34, reload: 1.7, sound: 'glShot', muzzle: [0, 0.05, 0.62], hold: 'rifle', falloff: 999, boom: 'grenade', grav: 1 },
  // lança-foguetes (zona tóxica): foguete quase reto com rastro de fumaça
  rpg: { model: 'rpg', ammo: 'rocket', mag: 1, dmg: 0, rate: 1.2, auto: false, pellets: 1, spread: 0.002, hipSpread: 0.02, recoil: 0.16, range: 300, speed: 62, reload: 3.0, sound: 'rpgShot', muzzle: [0, 0.07, 0.8], hold: 'rifle', falloff: 999, boom: 'rocket', grav: 0.12 },
  // arpão-gancho (só impressora 3D): cada munição = 3 disparos; gruda e puxa o jogador
  harpoon: { model: 'harpoon', ammo: 'harpoonammo', mag: 3, perItem: 3, dmg: 45, rate: 0.7, auto: false, pellets: 1, spread: 0.002, hipSpread: 0.02, recoil: 0.03, range: 40, speed: 70, reload: 1.6, sound: 'harpoon', muzzle: [0, 0.04, 0.31], hold: 'pistol', grapple: true, falloff: 999 },
  pistol35: { model: 'pistol', ammo: 'ammo35', mag: 15, dmg: 22, rate: 0.13, auto: false, pellets: 1, spread: 0.011, hipSpread: 0.045, recoil: 0.032, range: 90, speed: 180, drag: 0.013, reload: 1.3, sound: 'pistol', pitch: 1.12, muzzle: [0, 0.075, 0.18], hold: 'pistol', falloff: 30, look: { len: 0.88, steel: 0xa9adb3, poly: 0x2a2b2e } },
  pistol: { model: 'pistol', ammo: 'ammo42', mag: 12, dmg: 30, rate: 0.17, auto: false, pellets: 1, spread: 0.010, hipSpread: 0.045, recoil: 0.045, range: 110, speed: 198, drag: 0.012, reload: 1.5, sound: 'pistol', muzzle: [0, 0.075, 0.2], hold: 'pistol', falloff: 40 },
  pistol65: { model: 'pistol', ammo: 'ammo65', mag: 7, dmg: 50, rate: 0.42, auto: false, pellets: 1, spread: 0.009, hipSpread: 0.05, recoil: 0.095, range: 130, speed: 225, drag: 0.011, reload: 1.9, sound: 'pistol', pitch: 0.88, muzzle: [0, 0.08, 0.26], hold: 'pistol', falloff: 45, look: { len: 1.3, scale: 1.12, steel: 0x6a5a3e, poly: 0x3a2a1c } },
  // escopeta (munição própria, não aceita luneta)
  shotgun: { model: 'shotgun', ammo: 'shells', mag: 6, dmg: 15, rate: 0.85, auto: false, pellets: 9, spread: 0.055, hipSpread: 0.075, recoil: 0.11, range: 45, speed: 171, drag: 0.03, reload: 0.55, perShell: true, sound: 'shotgun', muzzle: [0, 0.075, 0.78], hold: 'rifle', falloff: 14 },
  // fuzis de assalto (aceitam a luneta 4x)
  rifle540: { model: 'rifle', ammo: 'ammo540', mag: 30, dmg: 28, rate: 0.085, auto: true, pellets: 1, spread: 0.006, hipSpread: 0.05, recoil: 0.026, range: 240, speed: 360, drag: 0.0065, reload: 2.2, sound: 'rifle', pitch: 1.06, muzzle: [0, 0.07, 0.69], hold: 'rifle', falloff: 110, scopes: ['scope4'], look: { len: 0.95, poly: 0x8a7552 } },
  rifle: { model: 'rifle', ammo: 'ammo555', mag: 30, dmg: 34, rate: 0.095, auto: true, pellets: 1, spread: 0.006, hipSpread: 0.05, recoil: 0.03, range: 260, speed: 378, drag: 0.006, reload: 2.3, sound: 'rifle', muzzle: [0, 0.07, 0.72], hold: 'rifle', falloff: 120, scopes: ['scope4'] },
  rifle577: { model: 'rifle', ammo: 'ammo577', mag: 25, dmg: 41, rate: 0.11, auto: true, pellets: 1, spread: 0.0055, hipSpread: 0.055, recoil: 0.038, range: 290, speed: 405, drag: 0.0055, reload: 2.5, sound: 'rifle', pitch: 0.93, muzzle: [0, 0.07, 0.78], hold: 'rifle', falloff: 135, scopes: ['scope4'], look: { len: 1.08, poly: 0x48502f } },
  // fuzis de precisão (aceitam lunetas 4x e 8x)
  sniper745: { model: 'sniper', ammo: 'ammo745', mag: 5, dmg: 74, rate: 1.1, auto: false, pellets: 1, spread: 0.0009, hipSpread: 0.06, recoil: 0.08, range: 650, speed: 540, drag: 0.0022, reload: 2.6, sound: 'sniper', pitch: 1.06, muzzle: [0, 0.07, 0.92], hold: 'rifle', falloff: 380, bolt: true, scopes: ['scope4', 'scope8'], look: { len: 0.95, wood: 0x26272a } },
  sniper: { model: 'sniper', ammo: 'ammo769', mag: 5, dmg: 88, rate: 1.25, auto: false, pellets: 1, spread: 0.0008, hipSpread: 0.06, recoil: 0.09, range: 700, speed: 576, drag: 0.002, reload: 2.8, sound: 'sniper', muzzle: [0, 0.07, 0.95], hold: 'rifle', falloff: 400, bolt: true, scopes: ['scope4', 'scope8'] },
  sniper790: { model: 'sniper', ammo: 'ammo790', mag: 4, dmg: 108, rate: 1.5, auto: false, pellets: 1, spread: 0.0007, hipSpread: 0.065, recoil: 0.12, range: 800, speed: 621, drag: 0.0018, reload: 3.1, sound: 'sniper', pitch: 0.92, muzzle: [0, 0.07, 1.05], hold: 'rifle', falloff: 450, bolt: true, scopes: ['scope4', 'scope8'], look: { len: 1.1, wood: 0x5a5e3a } },
};
// lunetas: ampliação padrão e faixa ajustável pela roda do mouse
export const SCOPES = { scope4: { mag: 4, min: 3, max: 5 }, scope8: { mag: 8, min: 6, max: 10 } };
// posição do centro da luneta sobre o trilho de cada modelo
export const SCOPE_MOUNT = { rifle: [0, 0.128, 0.06], sniper: [0, 0.13, 0.06] };

export function gunMesh(gid) {
  const G = GUNS[gid] || {}, V = G.look || {}; const id = G.model || gid;
  if (id === 'harpoon') return harpoonGunMesh();
  if (id === 'gl') { // lança-granadas de sucata: coronha de vergalhão, corpo de chapa com trapos camuflados, cano largo, guarda-mão de madeira
    const mb = new MeshBuilder(); const rust = hex(0x6a4a34), rustD = hex(0x4a3426), steel = hex(0x5a5a58), camo = hex(0x5a5e40), camoL = hex(0x7a7a56), wood = hex(0x7a5232), wire = hex(0xb0b0a8);
    const B = (x, y, z, sx, sy, sz, c, f = MET) => { mb.setColor(c, f); mb.box(M(x, y, z), sx, sy, sz, c); }, Cz = (x, y, z, r0, r1, l, c, f = MET, n = 12) => { mb.setColor(c, f); mb.cylinder(M(x, y, z, 0, 1, RX), r0, r1, l, n, c); };
    Cz(0, 0.06, 0.1, 0.075, 0.075, 0.55, steel); Cz(0, 0.06, 0.62, 0.068, 0.068, 0.04, rustD); Cz(0, 0.06, 0.625, 0.055, 0.055, 0.045, hex(0x111111)); // cano
    B(0, 0.05, -0.02, 0.11, 0.15, 0.24, rust); B(0.058, 0.07, -0.02, 0.01, 0.08, 0.12, rustD); for (const z of [-0.1, 0.06]) { mb.setColor(steel, MET); mb.cylinder(M(0.06, 0.1, z, 0, 1, 0, Math.PI / 2), 0.012, 0.012, 0.02, 6, steel); }
    for (const [z, l] of [[0.0, 0.16], [0.34, 0.14], [0.5, 0.06]]) { B(0, 0.06, z, 0.165, 0.165, l, camo, POLY); for (let k = 0; k < 4; k++) B((k - 1.5) * 0.04, -0.035 - (k % 2) * 0.03, z + (k - 1.5) * 0.02, 0.03, 0.06 + (k % 3) * 0.02, 0.03, camoL, POLY); }
    for (const z of [0.3, 0.38, 0.5]) { mb.setColor(wire, MET); mb.cylinder(M(0, 0.06, z, 0, 1, RX), 0.087, 0.087, 0.008, 10, wire); }
    B(0, -0.035, 0.36, 0.06, 0.05, 0.22, wood, WOOD); B(0, -0.11, 0.38, 0.05, 0.12, 0.05, camo, POLY); // guarda-mão e empunhadura da frente
    mb.setColor(camo, POLY); mb.roundBox(M(0, -0.07, -0.05, 0, 1, -0.25), 0.04, 0.12, 0.055, camo, 0.01, 1); B(0, -0.02, 0.02, 0.006, 0.05, 0.08, wire); // empunhadura e guarda-mato de arame
    mb.setColor(rustD, MET); for (const s of [-1, 1]) mb.cylinder(M(0, 0.04 + s * 0.035, -0.16, 0, 1, RX), 0.01, 0.01, 0.32, 6, rustD); B(0, 0.04, -0.43, 0.03, 0.14, 0.025, rustD); B(0, 0.04, -0.33, 0.05, 0.12, 0.08, camo, POLY); // coronha de vergalhão
    mb.setColor(wire, MET); mb.cylinder(M(0, 0.15, 0.0, 0, 1, 0, Math.PI / 2), 0.006, 0.006, 0.06, 5, wire); for (const z of [-0.04, 0.05]) mb.cylinder(M(0, 0.13, z), 0.006, 0.006, 0.08, 5, wire); // alça de arame
    return mb.build(); }
  if (id === 'rpg') { // lança-foguetes: tubo verde-oliva com ogiva na boca, mira e duas empunhaduras
    const mb = new MeshBuilder(); const ol = hex(0x4e5634), olD = hex(0x3a4026), blk = hex(0x1e1f20), war = hex(0x5e6640);
    mb.setColor(ol, POLY); mb.cylinder(M(0, 0.06, -0.38, 0, 1, RX), 0.05, 0.05, 1.08, 14, ol); mb.setColor(olD, POLY); mb.cylinder(M(0, 0.06, -0.42, 0, 1, RX), 0.065, 0.055, 0.12, 14, olD); mb.cylinder(M(0, 0.06, 0.62, 0, 1, RX), 0.055, 0.06, 0.08, 14, olD);
    mb.setColor(war, MET); mb.cylinder(M(0, 0.06, 0.7, 0, 1, RX), 0.035, 0.07, 0.1, 12, war); mb.cylinder(M(0, 0.06, 0.8, 0, 1, RX), 0.07, 0.0, 0.18, 12, war); mb.setColor(hex(0xc8b060), MET); mb.cylinder(M(0, 0.06, 0.975, 0, 1, RX), 0.012, 0.0, 0.05, 6, hex(0xc8b060));
    mb.setColor(blk, POLY); mb.roundBox(M(0, -0.04, 0.0, 0, 1, -0.2), 0.035, 0.12, 0.05, blk, 0.01, 1); mb.roundBox(M(0, -0.04, 0.22), 0.035, 0.11, 0.045, blk, 0.01, 1); mb.box(M(0, 0.0, 0.05), 0.04, 0.04, 0.12, blk);
    mb.setColor(blk, MET); mb.box(M(-0.06, 0.12, 0.14), 0.02, 0.07, 0.05, blk); mb.box(M(-0.06, 0.16, 0.14), 0.035, 0.03, 0.08, blk);
    return mb.build(); }
  const mb = new MeshBuilder();
  const blk = hex(V.poly ?? 0x1d1e20), steel = hex(V.steel ?? 0x34373b), dark = hex(0x16171a), wood = hex(V.wood ?? 0x6b4226), brass = hex(0xb08a3e);
  const C = (c, f) => mb.setColor(c, f);
  if (id === 'pistol') {
    C(blk, POLY); mb.roundBox(M(0, -0.06, -0.01, 0, 1, -0.22), 0.032, 0.11, 0.05, blk, 0.008, 2); // empunhadura inclinada
    for (let i = 0; i < 5; i++) mb.box(M(0, -0.03 - i * 0.02, -0.038, 0, 1, -0.22), 0.034, 0.006, 0.006, dark); // ranhuras
    mb.roundBox(M(0, 0.03, 0.06, 0), 0.03, 0.035, 0.17, blk, 0.006, 2); // armação
    mb.roundBox(M(0, -0.005, 0.035, 0), 0.012, 0.03, 0.05, blk, 0.004, 1); // guarda-mato
    C(steel, MET); mb.roundBox(M(0, 0.062, 0.075, 0), 0.032, 0.032, 0.21, steel, 0.005, 2); // ferrolho
    for (let i = 0; i < 6; i++) mb.box(M(0, 0.064, -0.01 + i * 0.008), 0.034, 0.026, 0.003, dark); // serrilha
    mb.cylinder(M(0, 0.06, 0.17, 0, 1, RX), 0.008, 0.008, 0.015, 10, dark); // boca do cano
    mb.box(M(0, 0.082, 0.16), 0.004, 0.008, 0.006, steel); mb.box(M(0, 0.082, -0.015), 0.016, 0.008, 0.006, steel); // miras
    mb.box(M(0, 0.0, 0.03), 0.004, 0.018, 0.004, steel); // gatilho
  } else if (id === 'rifle') {
    C(blk, POLY);
    mb.roundBox(M(0, -0.07, -0.02, 0, 1, -0.3), 0.03, 0.11, 0.045, blk, 0.008, 2); // punho
    C(steel, MET); mb.roundBox(M(0, 0.035, 0.07, 0), 0.05, 0.075, 0.3, steel, 0.008, 2); // caixa da culatra
    mb.box(M(0, 0.078, 0.07), 0.024, 0.012, 0.3, dark); for (let i = 0; i < 14; i++) mb.box(M(0, 0.086, -0.06 + i * 0.02), 0.026, 0.006, 0.01, steel); // trilho
    mb.box(M(0, 0.1, -0.06), 0.03, 0.026, 0.02, dark); mb.box(M(0, 0.116, -0.06), 0.008, 0.012, 0.006, steel); // alça de mira (sem luneta)
    C(blk, POLY); mb.roundBox(M(0, 0.04, 0.33, 0), 0.052, 0.06, 0.24, blk, 0.012, 2); // guarda-mão
    for (let i = 0; i < 6; i++) mb.box(M(0.027, 0.04, 0.25 + i * 0.03), 0.004, 0.025, 0.012, dark), mb.box(M(-0.027, 0.04, 0.25 + i * 0.03), 0.004, 0.025, 0.012, dark);
    C(steel, MET); mb.cylinder(M(0, 0.05, 0.45, 0, 1, RX), 0.011, 0.011, 0.22, 10, steel); // cano
    mb.cylinder(M(0, 0.05, 0.66, 0, 1, RX), 0.016, 0.016, 0.06, 10, dark); // freio de boca
    for (let i = 0; i < 3; i++) mb.box(M(0, 0.064, 0.675 + i * 0.015), 0.034, 0.006, 0.006, steel);
    mb.box(M(0, 0.1, 0.43), 0.012, 0.05, 0.012, dark); // massa de mira
    C(blk, POLY); // carregador curvo
    for (let i = 0; i < 4; i++) mb.roundBox(M(0, -0.03 - i * 0.042, 0.11 + i * 0.012, 0, 1, 0.12 + i * 0.06), 0.03, 0.046, 0.075, blk, 0.005, 1);
    mb.roundBox(M(0, 0.03, -0.13), 0.042, 0.055, 0.12, blk, 0.01, 2); // tubo da coronha
    mb.roundBox(M(0, 0.0, -0.27, 0, 1, -0.1), 0.044, 0.13, 0.16, blk, 0.012, 2); // coronha
    mb.roundBox(M(0, -0.005, -0.355, 0, 1, -0.1), 0.046, 0.14, 0.02, dark, 0.006, 1); // soleira
    C(steel, MET); mb.box(M(0.028, 0.05, 0.02), 0.006, 0.02, 0.04, steel); // alavanca do ferrolho
    mb.box(M(0, -0.005, 0.0), 0.004, 0.02, 0.004, steel);
  } else if (id === 'shotgun') {
    C(wood, WOOD);
    mb.roundBox(M(0, -0.02, -0.25, 0, 1, -0.18), 0.045, 0.1, 0.32, wood, 0.012, 2); // coronha
    mb.roundBox(M(0, -0.055, -0.04, 0, 1, -0.4), 0.034, 0.1, 0.05, wood, 0.01, 2); // punho
    C(steel, MET); mb.roundBox(M(0, 0.03, 0.08, 0), 0.046, 0.065, 0.24, steel, 0.008, 2); // caixa
    mb.cylinder(M(0, 0.052, 0.18, 0, 1, RX), 0.014, 0.014, 0.62, 12, steel); // cano
    mb.cylinder(M(0, 0.018, 0.18, 0, 1, RX), 0.012, 0.012, 0.5, 12, dark); // tubo do carregador
    mb.cylinder(M(0, 0.052, 0.79, 0, 1, RX), 0.016, 0.016, 0.01, 12, dark);
    mb.box(M(0, 0.07, 0.78), 0.008, 0.008, 0.008, brass); // mira de latão
    C(wood, WOOD); mb.cylinder(M(0, 0.022, 0.36, 0, 1, RX), 0.026, 0.026, 0.17, 12, wood); // telha (bomba)
    for (let i = 0; i < 7; i++) mb.cylinder(M(0, 0.022, 0.37 + i * 0.022, 0, 1, RX), 0.0275, 0.0275, 0.006, 12, shade(wood, 0.7));
    C(steel, MET); mb.box(M(0, -0.005, 0.0), 0.004, 0.02, 0.004, steel);
  }
  else if (id === 'sniper') {
    // fuzil de precisão por ferrolho 7.62: coronha de madeira, cano longo flutuante, luneta com ajustes
    C(wood, WOOD); mb.roundBox(M(0, 0.0, -0.22, 0, 1, -0.12), 0.05, 0.13, 0.36, wood, 0.014, 2); mb.roundBox(M(0, -0.05, -0.02, 0, 1, -0.45), 0.034, 0.1, 0.05, wood, 0.01, 2);
    mb.roundBox(M(0, 0.02, 0.24), 0.056, 0.06, 0.5, wood, 0.012, 2);
    C(steel, MET); mb.roundBox(M(0, 0.06, 0.04), 0.044, 0.05, 0.26, steel, 0.008, 2); mb.cylinder(M(0, 0.065, 0.16, 0, 1, RX), 0.013, 0.011, 0.82, 12, steel);
    mb.cylinder(M(0, 0.065, 0.96, 0, 1, RX), 0.018, 0.018, 0.05, 12, dark); mb.cylinder(M(0.035, 0.07, -0.03, 0, 1, 0, Math.PI / 2), 0.006, 0.006, 0.05, 6, steel); mb.sphere(M(0.06, 0.07, -0.03), 0.012, 8, 6, steel);
    C(dark, MET); for (const z of [-0.02, 0.14]) mb.box(M(0, 0.09, z), 0.03, 0.012, 0.02, dark); mb.box(M(0, 0.088, 0.06), 0.018, 0.006, 0.26, dark); // bases do trilho
    mb.box(M(0, 0.09, 0.93), 0.006, 0.03, 0.006, dark); // massa de mira
    C(blk, POLY); mb.roundBox(M(0, -0.04, 0.08), 0.03, 0.07, 0.06, blk, 0.006, 1);
  }
  else if (id === 'bow') {
    // arco recurvo de madeira: duas lâminas curvas, empunhadura enrolada e corda
    const w = hex(0x7a5232), grip = hex(0x3c2b1e), str = hex(0xd8d2c0);
    const P = (t) => { const a = t * 1.15; return [0, Math.sin(a) * 0.62, 0.02 - (1 - Math.cos(a)) * 0.24 + Math.max(0, Math.abs(t) - 0.85) * 0.12]; };
    C(w, WOOD); for (let i = -10; i < 10; i++) { const a = P(i / 10), b = P((i + 1) / 10); const len = Math.hypot(b[1] - a[1], b[2] - a[2]); const ang = Math.atan2(b[2] - a[2], b[1] - a[1]); const r = 0.017 * (1 - Math.abs(i / 10) * 0.5);
      mb.cylinder(M(0, a[1], a[2], 0, 1, ang), r, r * 0.93, len + 0.002, 8, w); }
    C(grip, 0.7); mb.cylinder(M(0, -0.06, 0.02), 0.022, 0.022, 0.12, 10, grip);
    C(str, POLY); const tip = P(1), bot = P(-1); mb.cylinder(M(0, bot[1], bot[2]), 0.0025, 0.0025, tip[1] - bot[1], 4, str);
  }
  const d = mb.build();
  if (V.len || V.scale) { const L = V.len || 1, S = V.scale || 1; for (let i = 0; i < d.pos.length; i += 3) { d.pos[i] *= S; d.pos[i + 1] *= S; let zz = d.pos[i + 2] * S; if (zz > 0.1 * S) zz = 0.1 * S + (zz - 0.1 * S) * L; d.pos[i + 2] = zz; } }
  return d;
}

// Lunetas: 4x compacta (corpo curto e grosso, tampa de borracha) e 8x longa (objetiva larga, torres e para-sol).
export function scopeMesh(kind) {
  const mb = new MeshBuilder(); const blk = hex(0x1b1c1e), dk = hex(0x101112), gr = hex(0x3a3d42), glass = hex(0x3f8fbf), rub = hex(0x222222);
  mb.setColor(blk, MET);
  if (kind === 'scope4') {
    mb.cylinder(M(0, 0, -0.07, 0, 1, RX), 0.026, 0.026, 0.14, 16, blk); mb.cylinder(M(0, 0, 0.07, 0, 1, RX), 0.026, 0.032, 0.03, 16, blk); mb.cylinder(M(0, 0, 0.1, 0, 1, RX), 0.032, 0.032, 0.03, 16, gr);
    mb.cylinder(M(0, 0, -0.1, 0, 1, RX), 0.03, 0.026, 0.03, 16, rub); mb.box(M(0, 0.03, 0.0), 0.022, 0.012, 0.03, gr); mb.box(M(0, -0.028, 0), 0.03, 0.02, 0.1, dk);
    mb.setColor(glass, MET); mb.cylinder(M(0, 0, 0.128, 0, 1, RX), 0.027, 0.027, 0.003, 16, glass);
  } else {
    mb.cylinder(M(0, 0, -0.14, 0, 1, RX), 0.02, 0.02, 0.24, 16, gr); mb.cylinder(M(0, 0, 0.1, 0, 1, RX), 0.02, 0.034, 0.06, 16, gr); mb.cylinder(M(0, 0, 0.16, 0, 1, RX), 0.034, 0.034, 0.07, 16, blk); mb.cylinder(M(0, 0, 0.23, 0, 1, RX), 0.036, 0.036, 0.06, 16, dk); // para-sol
    mb.cylinder(M(0, 0, -0.2, 0, 1, RX), 0.026, 0.02, 0.06, 16, rub); mb.cylinder(M(0, 0.02, 0.0), 0.014, 0.014, 0.03, 10, blk); mb.cylinder(M(0.02, 0, 0.0, 0, 1, 0, -Math.PI / 2), 0.014, 0.014, 0.03, 10, blk);
    mb.box(M(0, -0.026, -0.06), 0.03, 0.018, 0.024, dk); mb.box(M(0, -0.026, 0.07), 0.03, 0.018, 0.024, dk);
    mb.setColor(glass, MET); mb.cylinder(M(0, 0, 0.29, 0, 1, RX), 0.033, 0.033, 0.003, 16, glass);
  }
  return mb.build();
}

// Flecha (projétil e flecha cravada): haste ao longo de +Z, ponta de pedra, penas
export function arrowMesh() {
  const mb = new MeshBuilder();
  mb.setColor(hex(0x8a6a44), WOOD); mb.cylinder(M(0, 0, -0.38, 0, 1, RX), 0.006, 0.006, 0.74, 6, hex(0x8a6a44));
  mb.setColor(hex(0x6e6a62), 0.93); mb.cylinder(M(0, 0, 0.36, 0, 1, RX), 0.016, 0.0, 0.07, 6, hex(0x6e6a62));
  mb.setColor(hex(0xc8c0b0), POLY); for (let k = 0; k < 3; k++) mb.box(M(0, 0, -0.32, 0, 1, 0, k * 2.094), 0.002, 0.03, 0.09, hex(0xc8c0b0));
  return mb.build();
}

// Carregador solto (usado na animação de recarga / item no chão)
export function magMesh() { const mb = new MeshBuilder(); mb.setColor(hex(0x1d1e20), POLY); mb.roundBox(M(0, 0, 0), 0.03, 0.15, 0.07, hex(0x1d1e20), 0.005, 1); return mb.build(); }
