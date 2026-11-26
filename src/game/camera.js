// Câmera em terceira pessoa: órbita 360°, pitch limitado, zoom, suavização sem tremor
// e colisão com terreno, árvores, paredes e cavernas (aproxima automaticamente).
import { clamp, damp } from '../engine/math.js';

export class ThirdPersonCamera {
  constructor() {
    this.yaw = Math.PI; this.pitch = 0.25; this.dist = 4.2; this.targetDist = 4.2; this.curDist = 4.2;
    this.pivot = null; this.eye = [0, 5, -5]; this.target = [0, 0, 0]; this.fov = 62 * Math.PI / 180; this.shoulder = 0.45; this.shake = 0; this.aimT = 0; this.baseFov = 62 * Math.PI / 180; this.side = 1; this.sideCur = 1; this.aimZoom = 0.73; this.scopeT = 0;
  }
  input(dx, dy, wheel, sens = 1, invertY = false) {
    // sensibilidade moderada + limite contra saltos bruscos do mouse
    // sem teto baixo por quadro: com FPS baixo o movimento de um quadro é grande e antes ficava "preso" (a câmera não acompanhava o mouse)
    dx = clamp(dx, -4000, 4000); dy = clamp(dy, -1500, 1500);
    const z = this.fov / this.baseFov; dx *= z; dy *= z; // com luneta a mira fica mais fina
    this.yaw -= dx * 0.0014 * sens; this.pitch += dy * 0.0012 * sens * (invertY ? -1 : 1);
    this.pitch = clamp(this.pitch, -1.15, 1.2);
    if (wheel) this.targetDist = clamp(this.targetDist + wheel * 0.6, 1.6, 10);
  }
  update(dt, player, physics) {
    const p = player.pos; const h = player.swimming ? 1.55 : player.crouch ? 1.15 : player.dead ? 0.6 : 1.62;
    const want = [p[0], p[1] + h, p[2]];
    if (!this.pivot) this.pivot = want.slice();
    // suavização do pivô (vertical mais suave que horizontal para degraus)
    this.pivot[0] = damp(this.pivot[0], want[0], 25, dt); this.pivot[2] = damp(this.pivot[2], want[2], 25, dt); this.pivot[1] = damp(this.pivot[1], want[1], 12, dt);
    const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    const dir = [-Math.sin(this.yaw) * cp, sp, -Math.cos(this.yaw) * cp]; // da cabeça para a câmera
    const right = [-Math.cos(this.yaw), 0, Math.sin(this.yaw)];
    // mira sobre o ombro: aproxima, desloca para a direita e fecha o campo de visão
    const a = this.aimT * this.aimT * (3 - 2 * this.aimT);
    this.fov = this.baseFov * (1 - (1 - this.aimZoom) * a);
    this.sideCur = damp(this.sideCur, this.side, 9, dt); // troca de ombro suave (tecla Q)
    const tDist = this.targetDist + (Math.min(this.targetDist, 2.0) - this.targetDist) * a;
    const sh = (this.shoulder * clamp(this.curDist / 4, 0.3, 1) * (1 - a) + 0.78 * a) * this.sideCur;
    // pivô deslocado sobre o ombro, verificando colisão lateral
    const base = this.pivot.slice();
    const side = [base[0] + right[0] * sh, base[1], base[2] + right[2] * sh];
    const sf = physics.rayFree(base, side, 0.22, player.inCave);
    const piv = [base[0] + right[0] * sh * sf, base[1], base[2] + right[2] * sh * sf];
    const desired = [piv[0] + dir[0] * tDist, piv[1] + dir[1] * tDist, piv[2] + dir[2] * tDist];
    const free = physics.rayFree(piv, desired, 0.25, player.inCave) * tDist;
    const allowed = Math.max(0.35, free - 0.1);
    // aproxima instantaneamente ao colidir, afasta suavemente
    if (allowed < this.curDist) this.curDist = allowed; else this.curDist = damp(this.curDist, allowed, a > 0.01 ? 14 : 4, dt);
    this.eye = [piv[0] + dir[0] * this.curDist, piv[1] + dir[1] * this.curDist, piv[2] + dir[2] * this.curDist];
    this.target = [piv[0] - dir[0] * 4, piv[1] - dir[1] * 4, piv[2] - dir[2] * 4];
    // não deixa a câmera afundar na água quando o jogador está na superfície
    if (piv[1] > 0.1 && this.eye[1] < 0.35) this.eye[1] = 0.35;
    if (this.shake > 0) { this.shake = Math.max(0, this.shake - dt * 2.5); const s = this.shake * 0.12; this.eye[0] += (Math.random() - 0.5) * s; this.eye[1] += (Math.random() - 0.5) * s; }
    // personagem fica translúcido quando a câmera chega muito perto (evita "entrar" no modelo)
    player.alpha = clamp((this.curDist - 0.55) / 0.9, 0.12, 1);
    // luneta: a câmera vai para o olho do personagem (visão pela mira) e o modelo some da tela
    if (this.forceFP) this.scopeT = 1; // (depuração/inspeção: visão pelos olhos do personagem)
    if (this.scopeT > 0) { const s = this.scopeT * this.scopeT * (3 - 2 * this.scopeT); const fw = [-dir[0], -dir[1], -dir[2]];
      const he = [p[0] + fw[0] * 0.3, p[1] + h + 0.02 + fw[1] * 0.3, p[2] + fw[2] * 0.3];
      for (let k = 0; k < 3; k++) this.eye[k] += (he[k] - this.eye[k]) * s;
      this.target = [this.eye[0] + fw[0] * 4, this.eye[1] + fw[1] * 4, this.eye[2] + fw[2] * 4];
      if (s > 0.5) player.alpha = 0; }
  }
  forward() { return [Math.sin(this.yaw), Math.cos(this.yaw)]; }
}
