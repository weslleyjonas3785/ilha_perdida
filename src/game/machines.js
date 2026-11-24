// Modelos low-poly das máquinas: arpão-gancho, impressora 3D, painel elétrico, placa solar,
// turbina eólica, roda d'água, bateria e segmentos de fio. Paleta azul/laranja/cinza das referências.
import { MeshBuilder, M, hex, shade } from '../engine/mesh.js';
import { mat4 as MAT4B } from '../engine/math.js';

const MET = 0.5, WOOD = 0.63, POLY = 0.86, RUB = 0.7, GLOW = 0.02;
const RX = Math.PI / 2;
const BLUE = hex(0x2f62b8), ORANGE = hex(0xd4703a), GRAY = hex(0x5c6068), DARK = hex(0x2a2c31), ROPE = hex(0xd9b23e), STEEL = hex(0x8c9097);

// ---------- arpão-gancho (eixo da arma: +Z para frente, empunhadura na origem) ----------
export function harpoonGunMesh() {
  const mb = new MeshBuilder(); const C = (c, f) => mb.setColor(c, f);
  // empunhadura azul com placa cinza facetada
  C(BLUE, POLY); mb.roundBox(M(0, -0.07, -0.02, 0, 1, -0.2), 0.045, 0.13, 0.06, BLUE, 0.01, 1);
  C(GRAY, MET); for (const sx of [-1, 1]) mb.box(M(sx * 0.024, -0.07, -0.02, 0, 1, -0.2), 0.004, 0.1, 0.045, GRAY);
  C(DARK, MET); mb.box(M(0, -0.14, -0.035, 0, 1, -0.2), 0.05, 0.02, 0.07, DARK);
  // guarda-mato e gatilho
  C(GRAY, MET); mb.box(M(0, -0.025, 0.06), 0.012, 0.012, 0.09, GRAY); mb.box(M(0, -0.005, 0.105), 0.012, 0.04, 0.012, GRAY); C(DARK, MET); mb.box(M(0, -0.002, 0.045), 0.008, 0.03, 0.01, DARK);
  // corpo azul
  C(BLUE, POLY); mb.roundBox(M(0, 0.04, 0.08), 0.07, 0.075, 0.3, BLUE, 0.012, 1);
  C(DARK, MET); mb.box(M(0, 0.0, 0.08), 0.072, 0.012, 0.3, DARK); // trilho inferior
  for (let i = 0; i < 3; i++) mb.box(M(0.037, 0.04, 0.0 + i * 0.02), 0.004, 0.03, 0.008, DARK); // aletas laterais
  for (let i = 0; i < 3; i++) mb.box(M(-0.037, 0.04, 0.0 + i * 0.02), 0.004, 0.03, 0.008, DARK);
  // luva laranja e placa lateral
  C(ORANGE, POLY); mb.roundBox(M(0, 0.04, 0.215), 0.08, 0.085, 0.06, ORANGE, 0.008, 1); mb.box(M(0.04, 0.03, 0.15), 0.01, 0.055, 0.05, ORANGE);
  C(DARK, MET); mb.box(M(0.046, 0.035, 0.15, 0, 1, 0, 0.5), 0.004, 0.03, 0.008, DARK);
  // boca octogonal cinza
  C(GRAY, MET); mb.cylinder(M(0, 0.04, 0.245, 0, 1, RX), 0.05, 0.05, 0.06, 8, GRAY); C(DARK, MET); mb.cylinder(M(0, 0.04, 0.3, 0, 1, RX), 0.028, 0.028, 0.004, 8, DARK);
  // mira traseira
  C(DARK, MET); mb.box(M(0, 0.088, 0.17), 0.01, 0.02, 0.012, DARK); mb.box(M(-0.008, 0.1, 0.17), 0.004, 0.014, 0.012, DARK); mb.box(M(0.008, 0.1, 0.17), 0.004, 0.014, 0.012, DARK);
  // carretel de corda com manivela
  C(GRAY, MET); for (const sx of [-1, 1]) mb.cylinder(M(sx * 0.03, 0.115, -0.03, 0, 1, 0, RX * sx), 0.05, 0.05, 0.012, 8, GRAY);
  C(ROPE, POLY); mb.cylinder(M(-0.026, 0.115, -0.03, 0, 1, 0, -RX), 0.035, 0.035, 0.052, 10, ROPE);
  C(DARK, MET); mb.box(M(0, 0.075, -0.03), 0.02, 0.03, 0.03, DARK); mb.cylinder(M(0.04, 0.115, -0.03, 0, 1, 0, -RX), 0.008, 0.008, 0.04, 6, DARK); mb.box(M(0.08, 0.14, -0.03), 0.01, 0.06, 0.012, DARK); mb.box(M(0.08, 0.17, -0.015), 0.012, 0.012, 0.035, GRAY);
  // corda do carretel até a frente
  C(ROPE, POLY); mb.box(M(0, 0.098, 0.1, 0, 1, 0.12), 0.008, 0.008, 0.26, ROPE);
  return mb.build();
}
// arpão carregado / disparado: haste de -0 a +L em Z com ponta farpada; origem na base
export function harpoonBoltMesh() {
  const mb = new MeshBuilder(); const C = (c, f) => mb.setColor(c, f);
  C(STEEL, MET); mb.cylinder(M(0, 0, 0, 0, 1, RX), 0.011, 0.011, 0.36, 6, STEEL);
  // ponta: cone + duas farpas
  mb.cylinder(M(0, 0, 0.36, 0, 1, RX), 0.022, 0.0, 0.07, 4, STEEL);
  for (const sx of [-1, 1]) mb.box(M(sx * 0.03, 0, 0.385, sx * 0.7), 0.008, 0.012, 0.07, STEEL);
  C(ROPE, POLY); for (let i = 0; i < 3; i++) mb.cylinder(M(0, 0, 0.24 + i * 0.016, 0, 1, RX), 0.016, 0.016, 0.01, 8, ROPE);
  return mb.build();
}
// segmento genérico (corda/fio): cilindro de raio 1 e comprimento 1 ao longo de +Z
export function segMesh(color = ROPE) { const mb = new MeshBuilder(); mb.setColor(color, POLY); mb.cylinder(M(0, 0, 0, 0, 1, RX), 1, 1, 1, 6, color, false); return mb.build(); }

// ---------- impressora 3D (~1 m) ----------
export function printerMesh() {
  const mb = new MeshBuilder(); const C = (c, f) => mb.setColor(c, f);
  C(BLUE, POLY); mb.roundBox(M(0, 0.12, 0), 0.92, 0.24, 0.72, BLUE, 0.03, 1); mb.box(M(0, 0.06, 0.39), 0.8, 0.12, 0.06, shade(BLUE, 0.9));
  C(DARK, MET); mb.box(M(-0.15, 0.13, 0.365), 0.18, 0.09, 0.01, DARK); C(hex(0x48c8f0), GLOW); for (let i = 0; i < 6; i++) mb.box(M(-0.21 + i * 0.024, 0.13 + Math.sin(i * 1.7) * 0.02, 0.371), 0.012, 0.012, 0.004, hex(0x48c8f0));
  C(ORANGE, POLY); mb.box(M(0.0, 0.15, 0.365), 0.03, 0.02, 0.01, ORANGE); mb.box(M(0.0, 0.11, 0.365), 0.03, 0.02, 0.01, ORANGE);
  // colunas azuis e blocos laranja nos cantos
  for (const sx of [-1, 1]) { C(BLUE, POLY); mb.box(M(sx * 0.42, 0.62, -0.18), 0.09, 0.8, 0.12, BLUE); C(ORANGE, POLY); mb.box(M(sx * 0.42, 1.04, -0.18), 0.13, 0.06, 0.16, ORANGE); mb.box(M(sx * 0.42, 0.27, -0.18), 0.13, 0.06, 0.16, ORANGE);
    C(STEEL, MET); mb.cylinder(M(sx * 0.42, 0.27, -0.05), 0.012, 0.012, 0.77, 6, STEEL); C(DARK, MET); mb.cylinder(M(sx * 0.42, 0.24, -0.05), 0.022, 0.022, 0.06, 6, DARK); }
  C(BLUE, POLY); mb.box(M(0, 1.0, -0.18), 0.92, 0.07, 0.1, BLUE);
  // mesa aquecida (laranja clara) sobre trilhos
  C(STEEL, MET); for (const sx of [-1, 1]) mb.cylinder(M(sx * 0.2, 0.26, -0.3, 0, 1, RX), 0.01, 0.01, 0.6, 6, STEEL);
  C(hex(0xe9a27a), 0.6); mb.box(M(0, 0.31, 0.02), 0.56, 0.025, 0.5, hex(0xe9a27a));
  // carretel de filamento no topo
  C(GRAY, MET); for (const sx of [-1, 1]) mb.cylinder(M(sx * 0.055, 1.18, -0.18, 0, 1, 0, -RX), 0.12, 0.12, 0.015, 8, GRAY); C(ORANGE, POLY); mb.cylinder(M(-0.05, 1.18, -0.18, 0, 1, 0, -RX), 0.085, 0.085, 0.1, 12, ORANGE);
  C(BLUE, POLY); mb.box(M(0, 1.09, -0.18), 0.05, 0.12, 0.05, BLUE);
  return mb.build();
}
// cabeçote móvel com os trilhos horizontais (sobe/desce junto)
export function printerHeadMesh() {
  const mb = new MeshBuilder(); const C = (c, f) => mb.setColor(c, f);
  C(STEEL, MET); for (const dy of [-0.025, 0.025]) mb.cylinder(M(-0.42, dy, -0.05, 0, 1, 0, -RX), 0.009, 0.009, 0.84, 6, STEEL);
  for (const sx of [-1, 1]) { C(ORANGE, POLY); mb.box(M(sx * 0.42, 0, -0.05), 0.1, 0.1, 0.1, ORANGE); }
  return mb.build();
}
export function printerNozzleMesh() { const mb = new MeshBuilder(); mb.setColor(ORANGE, POLY); mb.roundBox(M(0, 0, -0.03), 0.1, 0.11, 0.1, ORANGE, 0.015, 1); mb.setColor(DARK, MET); mb.box(M(0.03, 0.06, -0.06), 0.03, 0.04, 0.03, DARK); mb.cylinder(M(0, -0.09, -0.03), 0.004, 0.018, 0.035, 6, DARK); return mb.build(); }
export function printObjMesh() { const mb = new MeshBuilder(); const c = hex(0xe08a5a); mb.setColor(c, 0.6); mb.cylinder(M(0, 0, 0), 0.09, 0.0, 0.12, 4, c); return mb.build(); }

// ---------- painel elétrico ----------
export function panelMesh() {
  const mb = new MeshBuilder(); const C = (c, f) => mb.setColor(c, f);
  C(GRAY, MET); mb.box(M(0, 0.6, -0.12), 0.1, 1.2, 0.08, GRAY); mb.box(M(0, 0.02, -0.12), 0.4, 0.04, 0.3, DARK);
  C(BLUE, POLY); mb.roundBox(M(0, 1.3, 0), 0.6, 0.7, 0.24, BLUE, 0.02, 1); C(shade(BLUE, 0.85), POLY); mb.box(M(0, 1.3, 0.122), 0.52, 0.6, 0.01, shade(BLUE, 0.85));
  C(DARK, MET); mb.box(M(0, 1.42, 0.13), 0.4, 0.18, 0.01, DARK);
  for (let i = 0; i < 4; i++) { C(i < 2 ? hex(0x4be06a) : hex(0xf0b030), GLOW); mb.box(M(-0.15 + i * 0.1, 1.42, 0.136), 0.04, 0.04, 0.006, i < 2 ? hex(0x4be06a) : hex(0xf0b030)); }
  C(ORANGE, POLY); for (let i = 0; i < 5; i++) mb.box(M(-0.2 + i * 0.1, 1.18, 0.136), 0.05, 0.1, 0.012, ORANGE);
  C(hex(0xf2c018), POLY); mb.box(M(0, 1.6, 0.13), 0.12, 0.08, 0.01, hex(0xf2c018)); C(DARK, MET); mb.cylinder(M(0, 0.95, 0), 0.04, 0.04, 0.12, 6, DARK);
  return mb.build();
}
// ---------- placa solar ----------
export function solarMesh() {
  const mb = new MeshBuilder(); const C = (c, f) => mb.setColor(c, f);
  C(GRAY, MET); for (const sx of [-1, 1]) { mb.box(M(sx * 0.55, 0.45, 0.25), 0.05, 0.9, 0.05, GRAY); mb.box(M(sx * 0.55, 0.75, -0.25), 0.05, 1.5, 0.05, GRAY); }
  const tilt = 0.55; C(GRAY, MET); mb.box(M(0, 1.05, 0, 0, 1, -tilt), 1.4, 0.04, 1.0, GRAY);
  C(hex(0x1c2c58), 0.45); mb.box(M(0, 1.075, 0, 0, 1, -tilt), 1.32, 0.02, 0.92, hex(0x1c2c58));
  C(hex(0x8aa0c8), MET); for (let i = -2; i <= 2; i++) mb.box(M(i * 0.26, 1.088, 0, 0, 1, -tilt), 0.01, 0.006, 0.92, hex(0x8aa0c8)); for (let j = -1; j <= 1; j++) mb.box(M(0, 1.088 + Math.sin(tilt) * j * 0.3, j * 0.3 * Math.cos(tilt), 0, 1, -tilt), 1.32, 0.006, 0.01, hex(0x8aa0c8));
  C(DARK, MET); mb.box(M(0, 0.35, 0.3), 0.18, 0.14, 0.08, DARK);
  return mb.build();
}
// ---------- turbina eólica: torre + rotor (rotor separado gira em Z) ----------
export function windTowerMesh() {
  const mb = new MeshBuilder(); const C = (c, f) => mb.setColor(c, f);
  C(DARK, MET); mb.box(M(0, 0.08, 0), 1.0, 0.16, 1.0, DARK);
  C(hex(0xd8dade), MET); mb.cylinder(M(0, 0.16), 0.2, 0.09, 6.0, 8, hex(0xd8dade));
  C(ORANGE, POLY); for (const y of [1.5, 3.2, 4.8]) mb.cylinder(M(0, y), 0.16 - y * 0.012, 0.16 - y * 0.012, 0.12, 8, ORANGE);
  C(BLUE, POLY); mb.roundBox(M(0, 6.25, -0.15), 0.32, 0.32, 0.9, BLUE, 0.06, 1); C(DARK, MET); mb.box(M(0, 6.3, -0.65), 0.02, 0.4, 0.3, DARK);
  return mb.build();
}
export function windRotorMesh() {
  const mb = new MeshBuilder(); const C = (c, f) => mb.setColor(c, f); const W = hex(0xeceef0);
  C(ORANGE, POLY); mb.cylinder(M(0, 0, 0, 0, 1, RX), 0.14, 0.04, 0.22, 8, ORANGE);
  C(W, POLY); for (let k = 0; k < 3; k++) { const a = k * 2.094; mb.roundBox(M(Math.sin(a) * 1.05, Math.cos(a) * 1.05, 0.05, 0, 1, 0, -a), 0.16, 2.0, 0.03, W, 0.01, 1); }
  return mb.build();
}
// ---------- roda d'água: suporte + roda (gira em X) ----------
export function wheelFrameMesh() {
  const mb = new MeshBuilder(); const C = (c, f) => mb.setColor(c, f); const wd = hex(0x7a5634);
  C(wd, WOOD); for (const sx of [-1, 1]) { mb.box(M(sx * 0.75, 0.8, -0.5, 0, 1, 0.35), 0.12, 1.8, 0.12, wd); mb.box(M(sx * 0.75, 0.8, 0.5, 0, 1, -0.35), 0.12, 1.8, 0.12, wd); mb.box(M(sx * 0.75, 0.15, 0), 0.14, 0.12, 1.5, wd); }
  C(GRAY, MET); mb.cylinder(M(-0.85, 1.55, 0, 0, 1, 0, -RX), 0.06, 0.06, 1.7, 8, GRAY);
  C(BLUE, POLY); mb.roundBox(M(0.98, 1.55, 0), 0.3, 0.34, 0.34, BLUE, 0.04, 1);
  return mb.build();
}
export function wheelMesh() {
  const mb = new MeshBuilder(); const C = (c, f) => mb.setColor(c, f); const wd = hex(0x8a6440), wd2 = hex(0x6a4a2c);
  const R = 1.3, n = 12;
  for (const sx of [-0.55, 0.55]) { C(wd2, WOOD); for (let i = 0; i < n; i++) { const a = i / n * 6.283, a2 = (i + 1) / n * 6.283; const mz = Math.cos((a + a2) / 2) * R, my = Math.sin((a + a2) / 2) * R; mb.box(M(sx, my, mz, 0, 1, -(a + a2) / 2), 0.08, 0.1, 2 * R * Math.sin(Math.PI / n) + 0.04, wd2); }
    for (let i = 0; i < 6; i++) { const a = i / 6 * 6.283; mb.box(M(sx, Math.sin(a) * R / 2, Math.cos(a) * R / 2, 0, 1, -a), 0.06, 0.06, R, wd2); } }
  C(wd, WOOD); for (let i = 0; i < n; i++) { const a = i / n * 6.283; mb.box(M(0, Math.sin(a) * (R + 0.08), Math.cos(a) * (R + 0.08), 0, 1, -a), 1.2, 0.36, 0.05, wd); }
  C(GRAY, MET); mb.cylinder(M(-0.65, 0, 0, 0, 1, 0, -RX), 0.15, 0.15, 1.3, 8, GRAY);
  return mb.build();
}
// ---------- bateria ----------
export function batteryMesh() {
  const mb = new MeshBuilder(); const C = (c, f) => mb.setColor(c, f);
  C(DARK, POLY); mb.roundBox(M(0, 0.28, 0), 0.56, 0.56, 0.4, DARK, 0.03, 1); C(hex(0xf2c018), POLY); mb.box(M(0, 0.4, 0.202), 0.57, 0.08, 0.01, hex(0xf2c018));
  C(GRAY, MET); mb.box(M(0, 0.57, 0), 0.5, 0.02, 0.34, GRAY); C(hex(0xd03030), MET); mb.cylinder(M(-0.15, 0.58), 0.04, 0.04, 0.05, 8, hex(0xd03030)); C(DARK, MET); mb.cylinder(M(0.15, 0.58), 0.04, 0.04, 0.05, 8, DARK);
  C(BLUE, POLY); mb.box(M(0, 0.2, 0.205), 0.3, 0.14, 0.01, BLUE);
  return mb.build();
}
// barrinha luminosa de carga (escala em X conforme a carga)
export function barMesh() { const mb = new MeshBuilder(); const c = hex(0x5cf07a); mb.setColor(c, GLOW); mb.box(M(0.5, 0, 0), 1, 1, 1, c); return mb.build(); }

// ---------- contador Geiger de mão (eixo da arma: +Z para frente; a mão segura a alça do tubo) ----------
const YEL = hex(0xf0b414), BLK = hex(0x2b2a28), ALU = hex(0xc9c5bc);
export function geigerMesh() {
  const mb = new MeshBuilder(); const C = (c, f) => mb.setColor(c, f);
  // caixa amarela abaixo da mão
  C(YEL, POLY); mb.roundBox(M(0, -0.085, 0.05), 0.13, 0.1, 0.2, YEL, 0.012, 1); C(BLK, RUB); for (const sx of [-1, 1]) for (const sz of [-1, 1]) mb.box(M(sx * 0.05, -0.138, 0.05 + sz * 0.08), 0.02, 0.008, 0.02, BLK);
  C(BLK, MET); mb.box(M(0.066, -0.085, 0.07), 0.004, 0.035, 0.07, BLK); C(hex(0xd8d4c8), MET); mb.box(M(0.069, -0.08, 0.07), 0.002, 0.012, 0.05, hex(0xd8d4c8)); C(hex(0xc03028), GLOW); mb.box(M(0.069, -0.095, 0.07), 0.002, 0.004, 0.05, hex(0xc03028));
  C(ALU, MET); mb.box(M(-0.068, -0.08, 0.01), 0.008, 0.04, 0.03, ALU);
  // mostrador redondo na traseira de cima (voltado para o jogador)
  C(BLK, RUB); mb.cylinder(M(0, -0.03, -0.035, 0, 1, -0.6), 0.045, 0.045, 0.012, 12, BLK); C(hex(0xefe9d8), 0.6); mb.cylinder(M(0, -0.028, -0.031, 0, 1, -0.6), 0.036, 0.036, 0.012, 12, hex(0xefe9d8));
  C(hex(0xc03028), GLOW); for (let i = 0; i < 3; i++) { const a = 0.55 + i * 0.12; mb.box(M(Math.sin(a) * 0.028, -0.017 + Math.cos(a) * 0.028 * Math.cos(0.6), -0.03 - Math.cos(a) * 0.028 * Math.sin(0.6), 0, 1, -0.6, -a), 0.004, 0.008, 0.002, hex(0xc03028)); }
  // suportes e tubo-sonda sobre a caixa (alça)
  C(BLK, RUB); for (const z of [0.0, 0.11]) mb.cylinder(M(0, -0.04, z), 0.012, 0.012, 0.035, 6, BLK);
  C(ALU, MET); mb.cylinder(M(0, 0, -0.04, 0, 1, RX), 0.022, 0.022, 0.2, 8, ALU); mb.box(M(0.026, -0.012, 0.06), 0.008, 0.02, 0.18, ALU);
  C(BLK, RUB); mb.cylinder(M(0, 0, 0.16, 0, 1, RX), 0.03, 0.026, 0.06, 8, BLK); mb.cylinder(M(0, 0, -0.08, 0, 1, RX), 0.026, 0.03, 0.045, 8, BLK);
  // cabo da sonda descendo até a caixa
  C(BLK, RUB); mb.box(M(0, -0.03, -0.095, 0, 1, 0.5), 0.008, 0.008, 0.06, BLK);
  return mb.build();
}
// ponteiro do mostrador (gira em torno do eixo do mostrador)
export function geigerNeedleMesh() { const mb = new MeshBuilder(); mb.setColor(hex(0x151515), 0.5); mb.box(M(0, 0.015, 0.0), 0.003, 0.03, 0.002, hex(0x151515)); return mb.build(); }

// ---------- tiro: rastro de fogo (feixe) e projétil ----------
// rastro: de z=0 (cauda fina) a z=1 (cabeça larga), raio 1 na cabeça; escalado por [r, r, comprimento]
export function streakMesh() { const mb = new MeshBuilder(); const c = [1, 1, 1]; mb.setColor(c, POLY); mb.cylinder(M(0, 0, 0, 0, 1, RX), 0.08, 1, 0.82, 8, c, false); mb.cylinder(M(0, 0, 0.82, 0, 1, RX), 1, 0.55, 0.18, 8, c, true); return mb.build(); }
// projétil de latão (ponta ogival para +Z, base na origem), ~3 cm
export function bulletMesh() { const mb = new MeshBuilder(); const b = hex(0xd8a640); mb.setColor(b, MET); mb.cylinder(M(0, 0, -0.018, 0, 1, RX), 0.0045, 0.0045, 0.014, 8, b); mb.cylinder(M(0, 0, -0.004, 0, 1, RX), 0.0045, 0.0005, 0.016, 8, hex(0xe8c070)); return mb.build(); }
// cartucho de escopeta (na mão durante a recarga)
export function shellMesh() { const mb = new MeshBuilder(); const r = hex(0xb02a22), b = hex(0xd8a640); mb.setColor(r, POLY); mb.cylinder(M(0, 0, -0.03, 0, 1, RX), 0.011, 0.011, 0.05, 8, r); mb.setColor(b, MET); mb.cylinder(M(0, 0, -0.04, 0, 1, RX), 0.0118, 0.0118, 0.013, 8, b); return mb.build(); }

// ---------- túmulo e mochila caída (morte do jogador) ----------
export function tombMesh() {
  const mb = new MeshBuilder(); const C = (c, f) => mb.setColor(c, f); const st = hex(0x8c8a84), dirt = hex(0x5a4632), wd = hex(0x6e4e30);
  C(dirt, 0.93); mb.roundBox(M(0, 0.06, -0.55), 0.8, 0.16, 1.7, dirt, 0.06, 1);
  C(st, 0.93); mb.roundBox(M(0, 0.42, 0.42), 0.62, 0.84, 0.14, st, 0.08, 2); mb.box(M(0, 0.03, 0.42), 0.74, 0.08, 0.26, shade(st, 0.85));
  C(hex(0x55534e), 0.93); mb.box(M(0, 0.58, 0.492), 0.05, 0.3, 0.006, hex(0x55534e)); mb.box(M(0, 0.62, 0.492), 0.2, 0.05, 0.006, hex(0x55534e));
  C(wd, WOOD); for (let i = 0; i < 4; i++) mb.cylinder(M(-0.25 + i * 0.17, 0.12, -0.9 + (i % 2) * 0.5, 0, 1, Math.PI / 2, i), 0.025, 0.025, 0.18, 5, hex(0xd8c040));
  return mb.build();
}
// mochila caída no chão (cor pelo tipo)
export function groundPackMesh(color) {
  const mb = new MeshBuilder(); const c = color || hex(0x6e6a48); const K = hex(0x2a2a2e);
  mb.setColor(c, POLY); mb.roundBox(M(0, 0.17, 0, 0, 1, -1.35), 0.42, 0.55, 0.26, c, 0.07, 2); mb.setColor(shade(c, 0.9), POLY); mb.roundBox(M(0, 0.3, 0.14, 0, 1, -1.35), 0.32, 0.22, 0.1, shade(c, 0.9), 0.04, 1);
  mb.setColor(K, RUB); for (const sx of [-1, 1]) mb.box(M(sx * 0.11, 0.06, -0.08, 0, 1, -1.35), 0.05, 0.5, 0.03, K);
  return mb.build();
}
// vidro de janela: caixa unitária (escalada por instância)
export function paneMesh() { const mb = new MeshBuilder(); const c = hex(0xbfe0f0); mb.setColor(c, 0.3); mb.box(M(0, 0, 0), 1, 1, 1, c); return mb.build(); }
// C4: bloco de explosivo com cronômetro
export function c4Mesh() {
  const mb = new MeshBuilder(); const C = (c, f) => mb.setColor(c, f); const clay = hex(0xd8d0b0), blk = hex(0x1e1e20), red = hex(0xd02020), grn = hex(0x30e060);
  C(clay, 0.85); for (let i = 0; i < 3; i++) mb.roundBox(M(-0.07 + i * 0.07, 0.025, 0), 0.065, 0.05, 0.16, clay, 0.01, 1);
  C(blk, RUB); mb.box(M(0, 0.025, -0.03), 0.23, 0.055, 0.02, blk); mb.box(M(0, 0.025, 0.05), 0.23, 0.055, 0.02, blk);
  C(blk, MET); mb.box(M(0, 0.065, 0.0), 0.11, 0.03, 0.07, blk); C(red, GLOW); mb.box(M(-0.03, 0.082, 0.0), 0.035, 0.004, 0.02, red); C(grn, GLOW); mb.box(M(0.03, 0.082, 0.0), 0.012, 0.004, 0.012, grn);
  C(red, POLY); mb.cylinder(M(0.04, 0.06, -0.03, 0, 1, Math.PI / 2, 0.6), 0.004, 0.004, 0.09, 4, red); C(hex(0x2060d0), POLY); mb.cylinder(M(-0.04, 0.06, -0.03, 0, 1, Math.PI / 2, -0.6), 0.004, 0.004, 0.09, 4, hex(0x2060d0));
  return mb.build();
}

// ---------- aranha: caixa das costas (cai ao morrer), teia, casulo ----------
export function spiderBoxMesh() { const mb = new MeshBuilder(); const C = (c, f) => mb.setColor(c, f); const b = hex(0x3a3d22), y = hex(0xf2c018), k = hex(0x161616);
  C(b, MET); mb.roundBox(M(0, 0.13, 0), 0.38, 0.26, 0.32, b, 0.03, 1); C(y, POLY); for (let i = 0; i < 4; i++) mb.box(M(-0.14 + i * 0.09, 0.13, 0.162, 0, 1, 0, 0.6), 0.04, 0.3, 0.005, y); C(k, MET); mb.box(M(0, 0.27, 0), 0.3, 0.025, 0.25, k); mb.box(M(0.19, 0.13, 0), 0.02, 0.05, 0.12, k); return mb.build(); }
export function webMesh() { const mb = new MeshBuilder(); const w = hex(0xeef2f4); mb.setColor(w, 0.02);
  const R = 1.0; for (let i = 0; i < 10; i++) { const a = i / 10 * 6.283; mb.box(M(Math.cos(a) * R / 2, Math.sin(a) * R / 2, 0, 0, 1, 0, a), R, 0.008, 0.004, w); }
  for (let k = 1; k <= 6; k++) { const rr = R * k / 6.5; for (let i = 0; i < 10; i++) { const a0 = i / 10 * 6.283, a1 = (i + 1) / 10 * 6.283; const x0 = Math.cos(a0) * rr, y0 = Math.sin(a0) * rr, x1 = Math.cos(a1) * rr, y1 = Math.sin(a1) * rr; const L = Math.hypot(x1 - x0, y1 - y0);
    mb.box(M((x0 + x1) / 2, (y0 + y1) / 2, 0, 0, 1, 0, Math.atan2(y1 - y0, x1 - x0)), L, 0.006, 0.004, w); } }
  return mb.build(); }
export function cocoonMesh() { const mb = new MeshBuilder(); const w = hex(0xe8e6dc), w2 = hex(0xc8c4b4); mb.setColor(w, 0.83); mb.sphere(M(0, 0.32, 0, 0, [0.42, 0.42, 1]), 0.9, 10, 8, w);
  mb.setColor(w2, 0.83); for (let i = 0; i < 7; i++) mb.cylinder(M(0, 0.32, -0.75 + i * 0.25, 0, 1, Math.PI / 2), 0.4 - Math.abs(i - 3) * 0.06, 0.4 - Math.abs(i - 3) * 0.06, 0.03, 10, w2); return mb.build(); }
// linhas de teia enroladas no corpo do jogador (quando a teia acerta)
export function webWrapMesh() {
  const mb = new MeshBuilder(); const w = hex(0xf4f6f8); mb.setColor(w, 0.86); let sd = 7; const r = () => ((sd = (sd * 16807) % 2147483647) / 2147483647);
  const seg = (a, b, th = 0.012) => { const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]; const L = Math.hypot(...d); if (L < 1e-4) return; const ry = Math.atan2(d[0], d[2]), rx = -Math.asin(d[1] / L);
    mb.box(M((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2, ry, 1, rx, 0), th, th, L, w); };
  for (let s = 0; s < 14; s++) { const h = 0.25 + r() * 1.45, tilt = (r() - 0.5) * 0.7, rad = (h > 1.45 ? 0.17 : h > 1.15 ? 0.3 : h < 0.85 ? 0.2 : 0.27) + r() * 0.05, ph = r() * 6.283; let prev = null;
    for (let i = 0; i <= 16; i++) { const t = ph + i / 16 * 6.283; const p = [Math.cos(t) * rad, h + Math.sin(t) * tilt * rad, Math.sin(t) * rad]; if (prev) seg(prev, p, 0.008 + r() * 0.008); prev = p; } }
  for (let k = 0; k < 10; k++) { const a = r() * 6.283, b = a + (r() - 0.5) * 2.5; const y0 = 0.3 + r() * 1.3, y1 = y0 + (r() - 0.5) * 0.9; seg([Math.cos(a) * 0.3, y0, Math.sin(a) * 0.3], [Math.cos(b) * 0.32, y1, Math.sin(b) * 0.32], 0.007); }
  return mb.build();
}
// livros de habilidade (capa colorida, lombada com faixas, páginas e um emblema claro na capa)
export const BOOK_COLORS = { carpintaria: 0xa0522d, medicina: 0xc0302a, engenharia: 0x2a5a9a, mecanica: 0x3a4a3e, eletrica: 0xe09a20, agricultura: 0x4a7a2a, metalurgia: 0x4a4aa8, costura: 0xb83a7a, eletronica: 0x2a7a8a };
export function bookMesh(skill, open = false) {
  const mb = new MeshBuilder(); const c = hex(BOOK_COLORS[skill] || 0x8a5a3a), cd = shade(c, 0.7), pg = hex(0xeee6d0), em = hex(0xf0e8d8), gold = hex(0xc8a050);
  if (!open) { mb.setColor(c, 0.83); mb.box(M(0, 0.05, 0), 0.24, 0.016, 0.32, c); mb.box(M(0, 0.0, 0), 0.24, 0.016, 0.32, c); mb.setColor(pg, 0.83); mb.box(M(0.008, 0.025, 0), 0.225, 0.036, 0.3, pg);
    mb.setColor(cd, 0.83); mb.box(M(-0.118, 0.025, 0), 0.03, 0.068, 0.32, cd); mb.setColor(gold, 0.5); for (const z of [-0.09, 0.09]) mb.box(M(-0.12, 0.025, z), 0.034, 0.07, 0.018, gold);
    mb.setColor(em, 0.83); mb.box(M(0.015, 0.06, 0.02), 0.1, 0.004, 0.1, em); mb.box(M(0.015, 0.06, -0.11), 0.16, 0.004, 0.035, em); return mb.build(); }
  // aberto (na mão): duas metades em V com páginas
  for (const s of [-1, 1]) { const m = M(s * 0.11, 0, 0, 0, 1, 0, -s * 0.25); mb.setColor(c, 0.83); mb.box(MAT4B.mul(MAT4B.create(), m, M(0, -0.012, 0)), 0.23, 0.012, 0.31, c); mb.setColor(pg, 0.83); mb.box(MAT4B.mul(MAT4B.create(), m, M(0, 0.004, 0)), 0.215, 0.02, 0.29, pg);
    mb.setColor(hex(0x6a6458), 0.83); for (let k = 0; k < 6; k++) mb.box(MAT4B.mul(MAT4B.create(), m, M(0, 0.0145, -0.1 + k * 0.04)), 0.16, 0.002, 0.006, hex(0x6a6458)); }
  mb.setColor(cd, 0.83); mb.box(M(0, -0.03, 0), 0.03, 0.03, 0.31, cd); return mb.build();
}

// foguete (ao longo de +Z): ogiva, corpo e aletas; granadas de 40 mm nas três cores
export function rocketMesh() { const mb = new MeshBuilder(); const ol = hex(0x5e6640), d = hex(0x3a4026), fl = hex(0xffa040); const RX = Math.PI / 2;
  mb.setColor(ol, 0.5); mb.cylinder(M(0, 0, -0.3, 0, 1, RX), 0.04, 0.04, 0.35, 10, ol); mb.cylinder(M(0, 0, 0.05, 0, 1, RX), 0.04, 0.07, 0.08, 10, ol); mb.cylinder(M(0, 0, 0.13, 0, 1, RX), 0.07, 0.0, 0.18, 10, ol);
  mb.setColor(d, 0.5); for (let k = 0; k < 4; k++) mb.box(M(Math.cos(k * 1.57) * 0.05, Math.sin(k * 1.57) * 0.05, -0.28, 0, 1, 0, k * 1.57), 0.06, 0.005, 0.1, d);
  mb.setColor(fl, 0.02); mb.cylinder(M(0, 0, -0.42, 0, 1, RX), 0.0, 0.035, 0.12, 8, fl); return mb.build(); }
export function grenadeMesh(t) { const mb = new MeshBuilder(); const RX = Math.PI / 2; const body = hex({ gren_he: 0xd8a820, gren_gas: 0x5a6a3a, gren_smoke: 0x9a9a98 }[t] || 0xd8a820), tip = hex({ gren_he: 0xd87a20, gren_gas: 0x7a7a74, gren_smoke: 0x6a6a68 }[t] || 0xd87a20);
  mb.setColor(body, 0.5); mb.cylinder(M(0, 0, -0.06, 0, 1, RX), 0.022, 0.022, 0.08, 10, body); mb.setColor(tip, 0.5); mb.cylinder(M(0, 0, 0.02, 0, 1, RX), 0.022, 0.008, 0.04, 10, tip); return mb.build(); }
