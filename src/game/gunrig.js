// Empunhadura das armas por IK: a arma é posicionada no corpo conforme o tipo e o estado (baixa / mirando /
// recarregando) e os dois braços são resolvidos (IK de dois ossos) para que a mão direita fique no punho e a
// esquerda no guarda-mão, na bomba da escopeta, no ferrolho ou no carregador. Assim as mãos nunca "flutuam".
// Espaço do personagem: +Z frente, +X esquerda, +Y cima; espaço da arma: cano em +Z, punho na origem.
import { mat4, quat } from '../engine/math.js';

export const TOOL_OFF = mat4.fromTRS(mat4.create(), [0, -0.08, 0.015], quat.fromEuler(Math.PI / 2, 0, 0), [1, 1, 1]);
const TOOL_INV = mat4.invert(mat4.create(), TOOL_OFF);

// pontos de apoio de cada modelo (espaço da arma)
export const GRIPS = {
  pistol: { cls: 'pistol', cup: true, mag: [0, -0.115, -0.025], slide: [0, 0.066, -0.005] },
  harpoon: { cls: 'pistol', cup: true, load: [0, 0.06, 0.09] },
  rifle: { cls: 'rifle', rail: [0.2, 0.42], railY: 0.0, mag: [0, -0.1, 0.13], bolt: [0.032, 0.05, 0.02], butt: 0.3 },
  shotgun: { cls: 'rifle', rail: [0.3, 0.44], railY: -0.006, port: [0, -0.005, 0.13], butt: 0.32, pump: true },
  gl: { cls: 'rifle', rail: [0.3, 0.5], railY: -0.06, butt: 0.3, load: [0, 0.02, 0.12], launcher: 'shell' },
  rpg: { cls: 'rifle', rail: [0.26, 0.46], railY: -0.06, butt: 0.1, load: [0, 0.03, 0.6], launcher: 'bolt' },
  sniper: { cls: 'rifle', rail: [0.14, 0.44], railY: -0.012, mag: [0, -0.06, 0.08], bolt: [0.062, 0.072, -0.03], butt: 0.32, boltAction: true },
};
const POUCH = [0.13, 1.03, 0.12], QUIVER = [0.17, 1.3, -0.14];
const sm = (t) => t * t * (3 - 2 * t);
const lerp = (a, b, t) => a + (b - a) * t;
const lerp3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], mulS = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], len = (a) => Math.hypot(a[0], a[1], a[2]);
const norm = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const kf = (t, keys) => { if (t <= keys[0][0]) return keys[0][1]; for (let i = 1; i < keys.length; i++) if (t <= keys[i][0]) { const [t0, v0] = keys[i - 1], [t1, v1] = keys[i]; return lerp(v0, v1, sm((t - t0) / (t1 - t0 || 1))); } return keys[keys.length - 1][1]; };
// rotação (matriz 4x4) a partir dos eixos X, Y, Z
const basis = (X, Y, Z, p = [0, 0, 0]) => { const m = mat4.create(); m[0] = X[0]; m[1] = X[1]; m[2] = X[2]; m[4] = Y[0]; m[5] = Y[1]; m[6] = Y[2]; m[8] = Z[0]; m[9] = Z[1]; m[10] = Z[2]; m[12] = p[0]; m[13] = p[1]; m[14] = p[2]; return m; };
const col = (m, i) => [m[i * 4], m[i * 4 + 1], m[i * 4 + 2]];
function m2q(m) { const X = norm(col(m, 0)), Y = norm(col(m, 1)), Z = norm(col(m, 2)); const t = X[0] + Y[1] + Z[2]; let q;
  if (t > 0) { const s = Math.sqrt(t + 1) * 2; q = [(Y[2] - Z[1]) / s, (Z[0] - X[2]) / s, (X[1] - Y[0]) / s, 0.25 * s]; }
  else if (X[0] > Y[1] && X[0] > Z[2]) { const s = Math.sqrt(1 + X[0] - Y[1] - Z[2]) * 2; q = [0.25 * s, (Y[0] + X[1]) / s, (Z[0] + X[2]) / s, (Y[2] - Z[1]) / s]; }
  else if (Y[1] > Z[2]) { const s = Math.sqrt(1 + Y[1] - X[0] - Z[2]) * 2; q = [(Y[0] + X[1]) / s, 0.25 * s, (Z[1] + Y[2]) / s, (Z[0] - X[2]) / s]; }
  else { const s = Math.sqrt(1 + Z[2] - X[0] - Y[1]) * 2; q = [(Z[0] + X[2]) / s, (Z[1] + Y[2]) / s, 0.25 * s, (X[1] - Y[0]) / s]; }
  return quat.normalize(q); }
const rotYXZ = (yaw, pitch, roll) => { const a = mat4.fromTRS(mat4.create(), [0, 0, 0], quat.fromEuler(0, yaw, 0), [1, 1, 1]), b = mat4.fromTRS(mat4.create(), [0, 0, 0], quat.fromEuler(pitch, 0, 0), [1, 1, 1]), c = mat4.fromTRS(mat4.create(), [0, 0, 0], quat.fromEuler(0, 0, roll), [1, 1, 1]); return mat4.mul(mat4.create(), mat4.mul(mat4.create(), a, b), c); };

export class GunRig {
  constructor(player) {
    this.P = player; this.w = 0; this.st = null; this.drops = []; this.carry = null; this.cycle = null; this.G = mat4.create();
    const sk = player.assets.skel, I = sk.index; this.I = I;
    const rw = []; sk.bones.forEach((b, i) => { const p = b.parent >= 0 ? rw[b.parent] : [0, 0, 0]; rw[i] = [p[0] + b.pos[0], p[1] + b.pos[1], p[2] + b.pos[2]]; }); this.rest = rw;
    this.la = len(sk.bones[I.foreArmR].pos); this.lb = len(sk.bones[I.handR].pos);
  }
  // estado vindo do sistema de armas a cada quadro
  set(s) { this.st = s; }
  onShot(gun, model) { const g = GRIPS[model]; if (!g) return; if (g.pump) this.cycle = { kind: 'pump', t: -0.22, dur: 0.42 }; else if (g.boltAction) this.cycle = { kind: 'bolt', t: -0.28, dur: 0.62 }; }
  pump() { this.cycle = { kind: 'pump', t: 0, dur: 0.42 }; }
  dropMag() { const s = this.st; if (!s || !GRIPS[s.model]) return; const gp = GRIPS[s.model]; const at = gp.mag || gp.port; if (!at || gp.port) return;
    const m = mat4.mul(mat4.create(), this.P.model, mat4.mul(mat4.create(), this.G, mat4.compose(at, 0))); this.drops.push({ m, v: [0, -0.5, 0], t: 0, small: s.model === 'pistol', y0: this.P.pos[1] }); }

  // pose da arma no espaço do personagem
  _pose(s, gp) {
    const P = this.P, I = this.I, W = P.anim.world; const ch = [W[I.chest][12], W[I.chest][13], W[I.chest][14]]; const off = sub(ch, this.rest[I.chest]);
    const pitch = s.pitch, aim = s.aimT, hold = 1 - aim; const sprint = s.sprint ? 1 : 0;
    let p, yaw, pit, roll;
    if (gp.cls === 'rifle') {
      // mirando: soleira no ombro direito, cano na linha da mira
      const sh = [W[I.upperArmR][12], W[I.upperArmR][13], W[I.upperArmR][14]]; const piv = sub(add(sh, [0.085, -0.03, 0.05]), off); /* bolsão do ombro direito (acompanha o giro do tronco) */ const pa = Math.max(-1.1, Math.min(1.1, pitch)); const Ra = rotYXZ(0.035, pa, 0);
      const pAim = add(piv, mat4.transformDir(Ra, [0, 0.005, gp.butt]));
      // baixa (pronto baixo): atravessada na frente do corpo, cano para baixo e para a esquerda
      const pHold = [-0.1, 1.13 - sprint * 0.04, 0.26]; const hp = 0.5 + pitch * 0.25 + sprint * 0.25;
      p = lerp3(pHold, pAim, aim); yaw = lerp(0.42 + sprint * 0.15, 0.035, aim); pit = lerp(hp, pa, aim); roll = lerp(0.18, 0, aim);
    } else {
      // pistola: braços estendidos (isósceles) ao mirar; baixa apontando para o chão à frente
      const pv = [0, 1.43, 0.0]; const pa = Math.max(-1.1, Math.min(1.1, pitch)); const base = [-0.035, 1.4, 0.42];
      const pAim = add(pv, mat4.transformDir(rotYXZ(0, pa, 0), sub(base, pv)));
      const pHold = [-0.08, 1.1, 0.3]; p = lerp3(pHold, pAim, aim); yaw = lerp(0.12, 0, aim); pit = lerp(0.8 + pitch * 0.2 + sprint * 0.2, pa, aim); roll = 0;
    }
    // recarga: arma trazida para perto do peito e inclinada para expor o carregador
    const R = s.reload; if (R) { const rw = kf(R.ph, [[0, 0], [0.12, 1], [0.86, 1], [1, 0]]);
      const tgt = gp.cls === 'rifle' ? { p: [-0.06, 1.24, 0.3], yaw: 0.32, pit: 0.1, roll: R.kind === 'shell' ? 1.0 : 0.45 } : { p: [-0.04, 1.27, 0.3], yaw: 0.15, pit: 0.35, roll: -0.35 };
      p = lerp3(p, tgt.p, rw); yaw = lerp(yaw, tgt.yaw, rw); pit = lerp(pit, tgt.pit, rw); roll = lerp(roll, tgt.roll, rw); }
    // ferrolho entre tiros: arma desce um pouco do ombro
    if (this.cycle && this.cycle.kind === 'bolt' && this.cycle.t > 0) { const k = Math.sin(Math.PI * Math.min(1, this.cycle.t / this.cycle.dur)); pit += 0.12 * k; p = add(p, [0.02 * k, -0.04 * k, -0.03 * k]); }
    const Rm = rotYXZ(yaw, pit, roll); const dir = mat4.transformDir(Rm, [0, 0, 1]);
    // recuo
    const rc = Math.min(1, s.recoil || 0); p = sub(p, mulS(dir, rc * 0.045)); const Rk = rc > 0 ? mat4.mul(mat4.create(), Rm, mat4.fromTRS(mat4.create(), [0, 0, 0], quat.fromEuler(-rc * 0.12, 0, 0), [1, 1, 1])) : Rm;
    p = add(p, off); const G = mat4.copy(this.G, Rk); G[12] = p[0]; G[13] = p[1]; G[14] = p[2]; return G;
  }
  // mão esquerda em apoio (espaço da arma): retorna matriz do pulso no espaço do personagem
  _leftOn(G, at, cup) {
    const fd = cup ? norm([-0.55, 0.25, 0.65]) : norm([-1, 0.05, 0.4]); // direção dos dedos envolvendo a arma
    const Y = mulS(fd, -1); let Z = [0, -1, 0]; Z = norm(sub(Z, mulS(Y, dot(Z, Y)))); const X = cross(Y, Z);
    const palm = add(at, cup ? [0.03, -0.045, 0.012] : [0.034, -0.03, 0]); const wrist = sub(palm, mulS(fd, 0.05));
    return mat4.mul(mat4.create(), G, basis(X, Y, Z, wrist));
  }
  // IK de dois ossos; S = ombro (junta do braço), retorna rotações de braço e antebraço no mundo do personagem
  _ik(S, Wt, pole, handM) {
    const a = this.la, b = this.lb; let d = sub(Wt, S); let L = len(d); const dir = norm(d); const reachOK = L <= a + b - 0.002;
    L = Math.max(Math.abs(a - b) + 0.01, Math.min(a + b - 0.002, L)); const W = add(S, mulS(dir, L));
    const cosA = Math.max(-1, Math.min(1, (a * a + L * L - b * b) / (2 * a * L))); const sinA = Math.sqrt(1 - cosA * cosA);
    let n = sub(pole, mulS(dir, dot(pole, dir))); n = len(n) < 1e-4 ? [0, -1, 0] : norm(n);
    const E = add(S, add(mulS(dir, a * cosA), mulS(n, a * sinA)));
    const Yu = norm(sub(S, E)); const f = norm(sub(W, E)); let Zu = sub(f, mulS(Yu, dot(f, Yu))); Zu = len(Zu) < 1e-4 ? norm(cross([1, 0, 0], Yu)) : norm(Zu); const Xu = cross(Yu, Zu);
    const Yf = mulS(f, -1); let Xf = Xu; if (handM) { const hx = norm(col(handM, 0)); const px = norm(sub(hx, mulS(Yf, dot(hx, Yf)))); Xf = norm(lerp3(Xu, px, 0.55)); Xf = norm(sub(Xf, mulS(Yf, dot(Xf, Yf)))); }
    const Zf = cross(Xf, Yf);
    return { Ru: basis(Xu, Yu, Zu), Rf: basis(Xf, Yf, Zf), E, W, reachOK };
  }
  _solveArm(side, wristM, pole, w) {
    const P = this.P, I = this.I, A = P.anim, sk = P.assets.skel; const ua = I['upperArm' + side], fa = I['foreArm' + side], ha = I['hand' + side];
    const S = [A.world[ua][12], A.world[ua][13], A.world[ua][14]]; const Wt = [wristM[12], wristM[13], wristM[14]];
    const r = this._ik(S, Wt, pole, wristM); this['reach' + side] = r.reachOK;
    // mistura com a animação (entrada/saída suave)
    const qU = quat.slerp(m2q(A.world[ua]), m2q(r.Ru), w), qF = quat.slerp(m2q(A.world[fa]), m2q(r.Rf), w), qH = quat.slerp(m2q(A.world[ha]), m2q(wristM), w);
    const E = add(S, quat_rot(qU, sk.bones[fa].pos)), Wp = add(E, quat_rot(qF, sk.bones[ha].pos));
    mat4.fromTRS(A.world[ua], S, qU, [1, 1, 1]); mat4.fromTRS(A.world[fa], E, qF, [1, 1, 1]); mat4.fromTRS(A.world[ha], Wp, qH, [1, 1, 1]);
    const tmp = mat4.create(); for (const bi of [ua, fa, ha]) { mat4.mul(tmp, A.world[bi], sk.invBind.subarray(bi * 16, bi * 16 + 16)); A.boneMats.set(tmp, bi * 16); }
  }
  // trajetória da mão esquerda (recarga): chaves [t, ponto, 'g'|'c'] (g = espaço da arma, c = do personagem)
  _path(keys, ph, G, off) { const pt = (k) => (k[2] === 'c' ? add(k[1], off) : mat4.transformPoint(G, k[1]));
    if (ph <= keys[0][0]) return pt(keys[0]); for (let i = 1; i < keys.length; i++) if (ph <= keys[i][0]) { const t = sm((ph - keys[i - 1][0]) / (keys[i][0] - keys[i - 1][0] || 1)); return lerp3(pt(keys[i - 1]), pt(keys[i]), t); } return pt(keys[keys.length - 1]); }

  // chamado depois da animação: aplica a empunhadura e define toolModel; false = não está segurando arma
  apply(dt) {
    const P = this.P, s = this.st; const on = !!(s && s.active && GRIPS[s.model]);
    this.w = Math.max(0, Math.min(1, this.w + (on ? dt / 0.14 : -dt / 0.14))); this.carry = null;
    for (const d of this.drops) this._dropStep(d, dt); this.drops = this.drops.filter((d) => d.t < 8);
    if (this.cycle) { this.cycle.t += dt; if (this.cycle.t > this.cycle.dur) this.cycle = null; }
    if (this.w <= 0 || !s || !GRIPS[s.model]) return false;
    const gp = GRIPS[s.model], I = this.I, A = P.anim; const G = this._pose(s, gp);
    const off = sub([A.world[I.chest][12], A.world[I.chest][13], A.world[I.chest][14]], this.rest[I.chest]);
    // mão direita no punho (ou no ferrolho entre tiros do fuzil de precisão)
    let HR = mat4.mul(mat4.create(), G, TOOL_INV);
    if (this.cycle && this.cycle.kind === 'bolt' && this.cycle.t > 0 && gp.bolt) { const ph = this.cycle.t / this.cycle.dur, b = gp.bolt;
      const p = this._path([[0, [0, 0, 0]], [0.22, b], [0.38, add(b, [0.01, 0.035, 0])], [0.55, add(b, [0.01, 0.035, -0.07])], [0.7, add(b, [0.01, 0.035, 0])], [0.82, b], [1, [0, 0, 0]]].map((k) => [k[0], k[1], 'g']), ph, G, off);
      const base = [HR[12], HR[13], HR[14]], g0 = mat4.transformPoint(G, [0, 0, 0]); HR = mat4.copy(mat4.create(), HR); const dd = sub(p, g0); HR[12] = base[0] + dd[0]; HR[13] = base[1] + dd[1]; HR[14] = base[2] + dd[2]; }
    // mão esquerda: apoio escolhido pelo alcance (o ponto mais à frente que o braço alcança)
    const SL = [A.world[I.upperArmL][12], A.world[I.upperArmL][13], A.world[I.upperArmL][14]]; const reach = (this.la + this.lb) * 0.9; // cotovelo levemente dobrado
    let HL;
    if (gp.cup) HL = this._leftOn(G, [0, 0, 0], true);
    else { let z = gp.rail[1]; for (; z >= gp.rail[0]; z -= 0.02) { const m = this._leftOn(G, [0, gp.railY, z]); if (len(sub([m[12], m[13], m[14]], SL)) <= reach) break; } z = Math.max(gp.rail[0], z);
      if (this.cycle && this.cycle.kind === 'pump' && this.cycle.t > 0) z -= 0.085 * Math.sin(Math.PI * Math.min(1, this.cycle.t / this.cycle.dur));
      HL = this._leftOn(G, [0, gp.railY, z]); this.railZ = z; }
    const R = s.reload; if (R) { const kp = this._reloadPath(R, gp, G, off, HL); if (kp) { const home = [HL[12], HL[13], HL[14]]; HL = mat4.copy(mat4.create(), HL); HL[12] = kp[0]; HL[13] = kp[1]; HL[14] = kp[2]; void home; } }
    // braços
    const poleR = gp.cls === 'rifle' ? lerp3([-0.75, -0.65, -0.1], [-0.9, -0.4, 0.05], s.aimT) : [-0.55, -0.85, -0.05];
    this._solveArm('R', HR, poleR, this.w); this._solveArm('L', HL, [0.45, -0.9, -0.05], this.w);
    // a arma segue a mão direita (com w=1 é exatamente G)
    const hand = A.world[I.handR]; mat4.mul(P.toolModel, mat4.mul(mat4.create(), P.model, hand), TOOL_OFF);
    if (this.carry) this.carry.world = mat4.mul(mat4.create(), P.model, this.carry.m);
    return true;
  }
  _reloadPath(R, gp, G, off, HL) {
    const ph = R.ph, home = [HL[12], HL[13], HL[14]]; const H = (p) => [p[0], p[1], p[2]]; const rot = mat4.copy(mat4.create(), G); rot[12] = rot[13] = rot[14] = 0;
    const toG = (p) => { const inv = mat4.invert(mat4.create(), G); return mat4.transformPoint(inv, p); }; const homeG = toG(home);
    const hold = (kind, at) => { const m = mat4.copy(mat4.create(), G); const p = mat4.transformPoint(G, at); m[12] = p[0]; m[13] = p[1]; m[14] = p[2]; this.carry = { kind, m }; };
    let keys = null, carryIv = null, carryKind = null;
    if (R.kind === 'shell' && gp.port) { // escopeta: pega um cartucho no cinto e empurra na janela de carga
      const pt = gp.port; keys = [[0, homeG, 'g'], [0.3, POUCH, 'c'], [0.55, add(pt, [0.01, -0.07, -0.01]), 'g'], [0.66, add(pt, [0, -0.015, 0.02]), 'g'], [1, homeG, 'g']]; carryIv = [0.3, 0.64]; carryKind = 'shell';
    } else if (gp.launcher) { // lança-granadas: granada do cinto na culatra; lança-foguetes: foguete das costas pela boca do tubo
      const ld = gp.load, src = gp.launcher === 'shell' ? POUCH : QUIVER; keys = [[0, homeG, 'g'], [0.3, src, 'c'], [0.55, add(ld, [0, 0.06, 0.2]), 'g'], [0.72, add(ld, [0, 0, 0.04]), 'g'], [1, homeG, 'g']]; carryIv = [0.3, 0.72]; carryKind = gp.launcher;
    } else if (R.kind === 'harpoon') { // arpão: puxa um arpão das costas e encaixa pela frente
      const ld = gp.load; keys = [[0, homeG, 'g'], [0.3, QUIVER, 'c'], [0.55, add(ld, [0, 0, 0.2]), 'g'], [0.7, add(ld, [0, 0, 0.04]), 'g'], [1, homeG, 'g']]; carryIv = [0.3, 0.7]; carryKind = 'bolt';
    } else if (gp.cup) { // pistola: solta o carregador, pega outro no cinto, insere no punho e puxa o ferrolho
      const mg = gp.mag, sl = gp.slide; keys = [[0, homeG, 'g'], [0.18, add(mg, [0.05, -0.04, 0]), 'g'], [0.44, POUCH, 'c'], [0.62, add(mg, [0, -0.1, 0]), 'g'], [0.7, mg, 'g'], [0.76, add(sl, [0.04, 0.03, 0.01]), 'g'], [0.8, add(sl, [0.02, 0.02, 0.0]), 'g'], [0.86, add(sl, [0.02, 0.02, -0.07]), 'g'], [1, homeG, 'g']]; carryIv = [0.44, 0.7]; carryKind = 'mag';
    } else { // fuzis: tira o carregador, pega outro no cinto, insere e puxa a alavanca/ferrolho
      const mg = gp.mag, bo = gp.bolt; const k = [[0, homeG, 'g'], [0.13, add(mg, [0.03, -0.02, 0]), 'g'], [0.25, add(mg, [0.03, -0.12, 0]), 'g'], [0.42, POUCH, 'c'], [0.6, add(mg, [0.02, -0.13, 0]), 'g'], [0.68, add(mg, [0.02, -0.01, 0]), 'g']];
      if (gp.boltAction) k.push([0.74, add(bo, [0.03, 0.0, 0]), 'g'], [0.79, add(bo, [0.03, 0.04, 0]), 'g'], [0.85, add(bo, [0.03, 0.04, -0.08]), 'g'], [0.9, add(bo, [0.03, 0.03, 0]), 'g'], [0.93, add(bo, [0.03, 0, 0]), 'g']);
      else k.push([0.76, add(bo, [0.035, 0.0, 0.01]), 'g'], [0.85, add(bo, [0.035, 0.0, -0.06]), 'g']);
      k.push([1, homeG, 'g']); keys = k; carryIv = [0.42, 0.68]; carryKind = 'mag';
    }
    const p = this._path(keys, ph, G, off);
    if (carryIv && ph >= carryIv[0] && ph <= carryIv[1]) { const m = mat4.copy(mat4.create(), G); m[12] = p[0]; m[13] = p[1] - (carryKind === 'mag' ? 0.03 : 0); m[14] = p[2]; this.carry = { kind: carryKind, m, small: gp.cup }; }
    void H; void rot; void hold; return p;
  }
  _dropStep(d, dt) { d.t += dt; if (d.rest) return; d.v[1] -= 9.8 * dt; d.m[13] += d.v[1] * dt; d.m[12] += d.v[0] * dt; d.m[14] += d.v[2] * dt;
    const g = this.P.game, gy = g.physics.ground(d.m[12], d.m[14], 0.05, d.m[13] + 0.3, 0.3)[0]; if (d.m[13] < gy + 0.03) { d.m[13] = gy + 0.03; d.rest = true; if (!d.sounded) { d.sounded = true; g.audio.play('magOut', { vol: 0.35 }); } } }
  render(items, M) {
    const P = this.P; const sph = [P.pos[0], P.pos[1] + 1, P.pos[2], 2];
    if (this.carry && this.carry.world && this.w > 0.5) { const mesh = this.carry.kind === 'mag' ? M.mag : this.carry.kind === 'shell' ? M.shell : (this.st && this.st.model === 'rpg' && M.rbolt) || M.bolt; if (mesh) { const sc = this.carry.kind === 'mag' && this.carry.small ? mat4.fromTRS(mat4.create(), [0, 0, 0], [0, 0, 0, 1], [0.8, 0.65, 0.7]) : mat4.create(); items.push({ smooth: true, mesh, model: mat4.mul(mat4.create(), this.carry.world, sc), sphere: sph }); } }
    for (const d of this.drops) { const sc = d.small ? mat4.fromTRS(mat4.create(), [0, 0, 0], [0, 0, 0, 1], [0.8, 0.65, 0.7]) : mat4.create(); const m = d.rest ? mat4.mul(mat4.create(), d.m, mat4.fromTRS(mat4.create(), [0, 0, 0], quat.fromEuler(0, 0, Math.PI / 2), [1, 1, 1])) : d.m; items.push({ mesh: M.mag, model: mat4.mul(mat4.create(), m, sc), sphere: [d.m[12], d.m[13], d.m[14], 0.5] }); }
  }
}
function quat_rot(q, v) { const [x, y, z, w] = q; const ix = w * v[0] + y * v[2] - z * v[1], iy = w * v[1] + z * v[0] - x * v[2], iz = w * v[2] + x * v[1] - y * v[0], iw = -x * v[0] - y * v[1] - z * v[2];
  return [ix * w + iw * -x + iy * -z - iz * -y, iy * w + iw * -y + iz * -x - ix * -z, iz * w + iw * -z + ix * -y - iy * -x]; }
