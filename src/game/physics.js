// Física de personagens: colisores (cilindros e caixas orientadas) em grade espacial,
// resolução de colisão por cápsula, chão (terreno + plataformas), cavernas e raios para a câmera.
const CS = 8;
export class Physics {
  constructor(world) { this.world = world; this.grid = new Map(); this.stamp = 0; this.dynamic = []; }
  _key(i, j) { return i * 100003 + j; }
  _bounds(c) { const r = c.type === 'cyl' ? c.r : Math.hypot(c.hx, c.hz); return [c.x - r, c.z - r, c.x + r, c.z + r]; }
  add(c) {
    if (c.type === 'box') { c.cos = Math.cos(c.rot || 0); c.sin = Math.sin(c.rot || 0); }
    c._cells = []; const [x0, z0, x1, z1] = this._bounds(c);
    for (let i = Math.floor(x0 / CS); i <= Math.floor(x1 / CS); i++) for (let j = Math.floor(z0 / CS); j <= Math.floor(z1 / CS); j++) {
      const k = this._key(i, j); let a = this.grid.get(k); if (!a) this.grid.set(k, (a = [])); a.push(c); c._cells.push(k); }
    return c;
  }
  remove(c) { if (!c || !c._cells) return; for (const k of c._cells) { const a = this.grid.get(k); if (a) { const i = a.indexOf(c); if (i >= 0) a.splice(i, 1); if (!a.length) this.grid.delete(k); } } c._cells = null; }
  query(x, z, r) {
    const out = []; this.stamp++;
    for (let i = Math.floor((x - r) / CS); i <= Math.floor((x + r) / CS); i++) for (let j = Math.floor((z - r) / CS); j <= Math.floor((z + r) / CS); j++) {
      const a = this.grid.get(this._key(i, j)); if (!a) continue; for (const c of a) if (c._s !== this.stamp) { c._s = this.stamp; out.push(c); } }
    for (const d of this.dynamic) if (Math.abs(d.x - x) < r + d.r && Math.abs(d.z - z) < r + d.r) out.push(d);
    return out;
  }
  // Ponto mais próximo de um colisor em XZ; retorna [nx, nz, penetração] para um círculo de raio rad
  push(c, x, z, rad) {
    if (c.type === 'cyl') { const dx = x - c.x, dz = z - c.z, d = Math.hypot(dx, dz), pen = c.r + rad - d; if (pen <= 0) return null; return d > 1e-4 ? [dx / d, dz / d, pen] : [1, 0, pen]; }
    const dx = x - c.x, dz = z - c.z; const lx = dx * c.cos - dz * c.sin, lz = dx * c.sin + dz * c.cos;
    const cx = Math.max(-c.hx, Math.min(c.hx, lx)), cz = Math.max(-c.hz, Math.min(c.hz, lz));
    let nx = lx - cx, nz = lz - cz, d = Math.hypot(nx, nz), pen;
    if (d > 1e-5) { pen = rad - d; if (pen <= 0) return null; nx /= d; nz /= d; }
    else { const px = c.hx - Math.abs(lx), pz = c.hz - Math.abs(lz); if (px < pz) { nx = Math.sign(lx) || 1; nz = 0; pen = px + rad; } else { nx = 0; nz = Math.sign(lz) || 1; pen = pz + rad; } }
    // volta para o mundo
    return [nx * c.cos + nz * c.sin, -nx * c.sin + nz * c.cos, pen];
  }
  insideXZ(c, x, z, pad = 0) {
    if (c.type === 'cyl') return Math.hypot(x - c.x, z - c.z) < c.r + pad;
    const dx = x - c.x, dz = z - c.z; const lx = dx * c.cos - dz * c.sin, lz = dx * c.sin + dz * c.cos; return Math.abs(lx) < c.hx + pad && Math.abs(lz) < c.hz + pad;
  }
  // Resolve um corpo cilíndrico (pés em p[1]); step = altura máxima que se sobe sem pular
  resolve(p, rad, height, step, ignore = null) {
    let hit = null;
    for (let it = 0; it < 3; it++) {
      let moved = false;
      for (const c of this.query(p[0], p[2], rad + 1)) {
        if (c === ignore || c.ghost || c.camOnly) continue;
        if (c.y1 <= p[1] + step || c.y0 >= p[1] + height) continue;
        const r = this.push(c, p[0], p[2], rad); if (!r) continue;
        p[0] += r[0] * r[2]; p[2] += r[1] * r[2]; moved = true; hit = c;
      }
      if (this._caveResolve(p, rad, height)) moved = true;
      if (!moved) break;
    }
    return hit;
  }
  _caveResolve(p, rad, height) {
    let moved = false;
    for (const cv of this.world.caves) {
      const dx = p[0] - cv.x, dz = p[2] - cv.z, d = Math.hypot(dx, dz);
      if (d > cv.R + 2 || p[1] > cv.y + cv.H) continue;
      const ang = Math.atan2(dz, dx); let da = Math.abs(((ang - cv.ent) % 6.2832 + 9.4248) % 6.2832 - 3.1416);
      const halfAt = cv.entHalf - 0.5 / Math.max(d, 1); // a abertura estreita conforme o raio do jogador
      if (da < halfAt) continue;
      const wallIn = cv.R - 0.9, wallOut = cv.R + 0.6;
      if (d < cv.R - 0.1 && d > wallIn - rad) { const t = wallIn - rad; p[0] = cv.x + dx / d * t; p[2] = cv.z + dz / d * t; moved = true; }
      else if (d >= cv.R - 0.1 && d < wallOut + rad) { const t = wallOut + rad; p[0] = cv.x + dx / d * t; p[2] = cv.z + dz / d * t; moved = true; }
    }
    return moved;
  }
  // Altura do chão sob o corpo: terreno ou topo de plataformas alcançáveis
  ground(x, z, rad, feetY, step) {
    let g = this.world.height(x, z), plat = null;
    for (const c of this.query(x, z, rad + 0.5)) {
      if (c.ghost || c.camOnly || c.y1 > feetY + step || c.y1 < g) continue;
      if (!this.insideXZ(c, x, z, rad * 0.6)) continue;
      g = c.y1; plat = c;
    }
    return [g, plat];
  }
  // Bloqueio de um ponto (câmera)
  pointBlocked(x, y, z, pad, insideCave) {
    if (y < this.world.height(x, z) + pad) return true;
    for (const c of this.query(x, z, pad + 0.5)) { if (c.ghost || c.noCam || c.dyn) continue; if (y < c.y0 - pad || y > c.y1 + pad) continue; if (this.insideXZ(c, x, z, pad)) return true; }
    if (insideCave) { const cv = insideCave; const d = Math.hypot(x - cv.x, z - cv.z); const hr = cv.R - 0.8; const yTop = cv.y - 0.6 + Math.sqrt(Math.max(0, 1 - (d / cv.R) ** 2)) * cv.H;
      if (d > hr) { const ang = Math.atan2(z - cv.z, x - cv.x); const da = Math.abs(((ang - cv.ent) % 6.2832 + 9.4248) % 6.2832 - 3.1416); if (da > cv.entHalf * 0.8) return true; }
      if (y > yTop - 0.8) return true; }
    return false;
  }
  // Marcha do raio: retorna fração livre [0..1]
  rayFree(a, b, pad, insideCave) {
    const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2]; const len = Math.hypot(dx, dy, dz); const steps = Math.ceil(len / 0.15);
    for (let i = 1; i <= steps; i++) { const t = i / steps; if (this.pointBlocked(a[0] + dx * t, a[1] + dy * t, a[2] + dz * t, pad, insideCave)) return Math.max(0, (i - 1) / steps); }
    return 1;
  }
  // Teste de sobreposição de uma área (construção)
  overlaps(shape, ignore) {
    const r = shape.type === 'cyl' ? shape.r : Math.hypot(shape.hx, shape.hz);
    for (const c of this.query(shape.x, shape.z, r + 1)) {
      if (c.ghost || (ignore && ignore(c))) continue; if (c.y1 <= shape.y0 + 0.05 || c.y0 >= shape.y1 - 0.05) continue;
      if (shapesOverlap(this, shape, c)) return c;
    }
    return null;
  }
}
function shapesOverlap(ph, a, b) {
  // amostragem: verifica pontos de 'a' dentro de 'b' e vice-versa (suficiente para validação de construção)
  const pts = samplePts(a); for (const [x, z] of pts) if (ph.insideXZ(b, x, z, -0.02)) return true;
  const pts2 = samplePts(b); for (const [x, z] of pts2) if (ph.insideXZ(a, x, z, -0.02)) return true;
  return false;
}
function samplePts(s) {
  if (s.type === 'cyl') { const p = [[s.x, s.z]]; for (let i = 0; i < 8; i++) p.push([s.x + Math.cos(i * 0.785) * s.r * 0.95, s.z + Math.sin(i * 0.785) * s.r * 0.95]); return p; }
  const c = Math.cos(s.rot || 0), sn = Math.sin(s.rot || 0); const p = [];
  for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) { const lx = (i / 2) * s.hx * 0.98, lz = (j / 2) * s.hz * 0.98; p.push([s.x + lx * c + lz * sn, s.z - lx * sn + lz * c]); }
  return p;
}
