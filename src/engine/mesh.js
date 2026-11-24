// Construtor de malhas procedurais (low-poly estilizado) com suporte a pesos de skinning.
import { mat4 } from './math.js';

export class MeshBuilder {
  constructor(opts = {}) {
    this.pos = []; this.nrm = []; this.col = []; this.idx = []; this.joints = []; this.weights = []; this.uv = [];
    this.skinned = !!opts.skinned; this.hasUV = false; this._uv = null; this.uvSolid = [0.96, 0.96]; this.color = [1, 1, 1]; this.flex = 1; this.bone = 0; this.weightFn = null;
  }
  setColor(c, flex = 1) { this.color = c; this.flex = flex; return this; }
  setBone(b) { this.bone = b; this.weightFn = null; return this; }
  vert(p, n, c = this.color) {
    const i = this.pos.length / 3;
    this.pos.push(p[0], p[1], p[2]); this.nrm.push(n[0], n[1], n[2]); this.col.push(c[0], c[1], c[2], this.flex);
    if (this._uv) { this.uv.push(this._uv[0], this._uv[1]); this._uv = null; } else this.uv.push(this.uvSolid[0], this.uvSolid[1]);
    if (this.skinned) {
      if (this.weightFn) { const { j, w } = this.weightFn(p); this.joints.push(j[0], j[1] ?? 0, j[2] ?? 0, j[3] ?? 0); this.weights.push(w[0], w[1] ?? 0, w[2] ?? 0, w[3] ?? 0); }
      else { this.joints.push(this.bone, 0, 0, 0); this.weights.push(1, 0, 0, 0); }
    }
    return i;
  }
  _tp(m, p) { return m ? mat4.transformPoint(m, p) : p; }
  _tn(m, n) { if (!m) return n; const d = mat4.transformDir(m, n); const l = Math.hypot(d[0], d[1], d[2]) || 1; return [d[0] / l, d[1] / l, d[2] / l]; }
  tri(a, b, c) { this.idx.push(a, b, c); }
  // Triângulo com normal plana a partir de pontos já transformados
  flatTri(p0, p1, p2, c) {
    const ux = p1[0] - p0[0], uy = p1[1] - p0[1], uz = p1[2] - p0[2], vx = p2[0] - p0[0], vy = p2[1] - p0[1], vz = p2[2] - p0[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    const n = [nx, ny, nz]; const a = this.vert(p0, n, c), b = this.vert(p1, n, c), d = this.vert(p2, n, c); this.tri(a, b, d);
  }
  box(m, sx, sy, sz, c) {
    const hx = sx / 2, hy = sy / 2, hz = sz / 2;
    const faces = [[[1, 0, 0], [[hx, -hy, hz], [hx, -hy, -hz], [hx, hy, -hz], [hx, hy, hz]]], [[-1, 0, 0], [[-hx, -hy, -hz], [-hx, -hy, hz], [-hx, hy, hz], [-hx, hy, -hz]]],
      [[0, 1, 0], [[-hx, hy, hz], [hx, hy, hz], [hx, hy, -hz], [-hx, hy, -hz]]], [[0, -1, 0], [[-hx, -hy, -hz], [hx, -hy, -hz], [hx, -hy, hz], [-hx, -hy, hz]]],
      [[0, 0, 1], [[-hx, -hy, hz], [hx, -hy, hz], [hx, hy, hz], [-hx, hy, hz]]], [[0, 0, -1], [[hx, -hy, -hz], [-hx, -hy, -hz], [-hx, hy, -hz], [hx, hy, -hz]]]];
    for (const [n, q] of faces) {
      const nn = this._tn(m, n); const i = q.map((p) => this.vert(this._tp(m, p), nn, c));
      this.tri(i[0], i[1], i[2]); this.tri(i[0], i[2], i[3]);
    }
    return this;
  }
  // Caixa com cantos arredondados (cubo subdividido projetado), normais suaves
  roundBox(m, sx, sy, sz, c, rad = null, n = 3) {
    const h = [sx / 2, sy / 2, sz / 2]; const r = Math.min(rad ?? Math.min(sx, sy, sz) * 0.22, h[0], h[1], h[2]);
    const inner = h.map((v) => v - r);
    const faces = [[0, 1, 2, 1], [0, 1, 2, -1], [1, 2, 0, 1], [1, 2, 0, -1], [2, 0, 1, 1], [2, 0, 1, -1]]; // eixo normal, u, v, sinal
    for (const [a, u, v, sg] of faces) {
      const base = this.pos.length / 3;
      for (let i = 0; i <= n; i++) for (let j = 0; j <= n; j++) {
        const p = [0, 0, 0]; p[a] = sg * h[a]; p[u] = -h[u] + (2 * h[u] * i) / n; p[v] = -h[v] + (2 * h[v] * j) / n;
        const q = p.map((x, k) => Math.max(-inner[k], Math.min(inner[k], x))); let d = [p[0] - q[0], p[1] - q[1], p[2] - q[2]]; const l = Math.hypot(...d) || 1; d = d.map((x) => x / l);
        const fp = [q[0] + d[0] * r, q[1] + d[1] * r, q[2] + d[2] * r];
        this.vert(this._tp(m, fp), this._tn(m, d), c);
      }
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
        const A = base + i * (n + 1) + j, B = A + n + 1;
        // orientação: produto vetorial (u x v) deve apontar para +eixo*sinal
        const right = ((u + 1) % 3 === v) ? sg > 0 : sg < 0;
        if (right) { this.tri(A, B, A + 1); this.tri(A + 1, B, B + 1); } else { this.tri(A, A + 1, B); this.tri(A + 1, B + 1, B); }
      }
    }
    return this;
  }
  // Cilindro ao longo de +Y (0..h). Lados suaves.
  cylinder(m, r0, r1, h, seg = 8, c, caps = true, wobble = null) {
    const base = this.pos.length / 3; const slope = (r0 - r1) / h;
    for (let i = 0; i <= seg; i++) {
      const a = (i / seg) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
      const w0 = wobble ? wobble(a, 0) : 1, w1 = wobble ? wobble(a, 1) : 1;
      const n = this._tn(m, [ca, slope, sa]);
      this.vert(this._tp(m, [ca * r0 * w0, 0, sa * r0 * w0]), n, c); this.vert(this._tp(m, [ca * r1 * w1, h, sa * r1 * w1]), n, c);
    }
    for (let i = 0; i < seg; i++) { const a = base + i * 2; this.tri(a, a + 1, a + 2); this.tri(a + 1, a + 3, a + 2); }
    if (caps) {
      if (r1 > 0.001) { const ct = this.vert(this._tp(m, [0, h, 0]), this._tn(m, [0, 1, 0]), c); const s = this.pos.length / 3;
        for (let i = 0; i <= seg; i++) { const a = (i / seg) * Math.PI * 2; this.vert(this._tp(m, [Math.cos(a) * r1, h, Math.sin(a) * r1]), this._tn(m, [0, 1, 0]), c); }
        for (let i = 0; i < seg; i++) this.tri(ct, s + i + 1, s + i); }
      if (r0 > 0.001) { const cb = this.vert(this._tp(m, [0, 0, 0]), this._tn(m, [0, -1, 0]), c); const s = this.pos.length / 3;
        for (let i = 0; i <= seg; i++) { const a = (i / seg) * Math.PI * 2; this.vert(this._tp(m, [Math.cos(a) * r0, 0, Math.sin(a) * r0]), this._tn(m, [0, -1, 0]), c); }
        for (let i = 0; i < seg; i++) this.tri(cb, s + i, s + i + 1); }
    }
    return this;
  }
  sphere(m, r, ws = 10, hs = 7, c, sy = 1) {
    const base = this.pos.length / 3;
    for (let y = 0; y <= hs; y++) {
      const v = y / hs, ph = v * Math.PI;
      for (let x = 0; x <= ws; x++) {
        const th = (x / ws) * Math.PI * 2; const n = [Math.sin(ph) * Math.cos(th), Math.cos(ph), Math.sin(ph) * Math.sin(th)];
        this.vert(this._tp(m, [n[0] * r, n[1] * r * sy, n[2] * r]), this._tn(m, [n[0], n[1] / sy, n[2]]), c);
      }
    }
    for (let y = 0; y < hs; y++) for (let x = 0; x < ws; x++) {
      const a = base + y * (ws + 1) + x, b = a + ws + 1; this.tri(a, a + 1, b); this.tri(b, a + 1, b + 1);
    }
    return this;
  }
  // Icosfera facetada com deslocamento (rochas, copas)
  rock(m, r, detail, disp, c, rand, colorFn) {
    const t = (1 + Math.sqrt(5)) / 2;
    let v = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]].map((p) => { const l = Math.hypot(...p); return p.map((x) => x / l); });
    let f = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
    for (let d = 0; d < detail; d++) {
      const cache = new Map(); const nf = [];
      const mid = (a, b) => { const k = a < b ? a + '_' + b : b + '_' + a; if (cache.has(k)) return cache.get(k); const p = [(v[a][0] + v[b][0]) / 2, (v[a][1] + v[b][1]) / 2, (v[a][2] + v[b][2]) / 2]; const l = Math.hypot(...p); v.push(p.map((x) => x / l)); cache.set(k, v.length - 1); return v.length - 1; };
      for (const [a, b, cc] of f) { const ab = mid(a, b), bc = mid(b, cc), ca = mid(cc, a); nf.push([a, ab, ca], [b, bc, ab], [cc, ca, bc], [ab, bc, ca]); }
      f = nf;
    }
    const dv = v.map((p) => { const s = r * (1 + (rand() - 0.5) * disp); return [p[0] * s, p[1] * s, p[2] * s]; });
    for (const [a, b, cc] of f) {
      const p0 = this._tp(m, dv[a]), p1 = this._tp(m, dv[b]), p2 = this._tp(m, dv[cc]);
      const col = colorFn ? colorFn((p0[1] + p1[1] + p2[1]) / 3, rand) : c;
      this.flatTri(p0, p1, p2, col);
    }
    return this;
  }
  // Rocha natural: icosfera subdividida com vértices compartilhados, deslocamento por ruído em
  // várias oitavas (blocos, fendas e arestas erodidas), base achatada e normais suaves.
  rockSmooth(m, r, detail = 3, disp = 0.35, c, rand = Math.random, colorFn = null, flat = 0.35) {
    const t = (1 + Math.sqrt(5)) / 2;
    const v = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]].map((p) => { const l = Math.hypot(...p); return p.map((x) => x / l); });
    let f = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
    for (let d = 0; d < detail; d++) { const cache = new Map(); const nf = [];
      const mid = (a, b) => { const k = a < b ? a * 65536 + b : b * 65536 + a; if (cache.has(k)) return cache.get(k); const p = [(v[a][0] + v[b][0]) / 2, (v[a][1] + v[b][1]) / 2, (v[a][2] + v[b][2]) / 2]; const l = Math.hypot(...p); v.push(p.map((x) => x / l)); cache.set(k, v.length - 1); return v.length - 1; };
      for (const [a, b, cc] of f) { const ab = mid(a, b), bc = mid(b, cc), ca = mid(cc, a); nf.push([a, ab, ca], [b, bc, ab], [cc, ca, bc], [ab, bc, ca]); } f = nf; }
    // ruído de valor 3D determinístico (semente da rocha)
    const seed = rand() * 1000; const h = (x, y, z) => { const s2 = Math.sin(x * 127.1 + y * 311.7 + z * 74.7 + seed) * 43758.5453; return s2 - Math.floor(s2); };
    const vn = (x, y, z) => { const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z), fx = x - ix, fy = y - iy, fz = z - iz; const u = fx * fx * (3 - 2 * fx), w = fy * fy * (3 - 2 * fy), q = fz * fz * (3 - 2 * fz);
      const L = (a, b, k) => a + (b - a) * k; return L(L(L(h(ix, iy, iz), h(ix + 1, iy, iz), u), L(h(ix, iy + 1, iz), h(ix + 1, iy + 1, iz), u), w), L(L(h(ix, iy, iz + 1), h(ix + 1, iy, iz + 1), u), L(h(ix, iy + 1, iz + 1), h(ix + 1, iy + 1, iz + 1), u), w), q); };
    const facets = [0, 1, 2, 3, 4].map(() => { const a = rand() * 6.28, b = Math.acos(rand() * 2 - 1); return [Math.sin(b) * Math.cos(a), Math.cos(b), Math.sin(b) * Math.sin(a), 0.82 + rand() * 0.12]; });
    const pos = v.map((p) => {
      let k = 1 + (vn(p[0] * 1.6, p[1] * 1.6, p[2] * 1.6) - 0.5) * disp * 1.4 + (vn(p[0] * 4, p[1] * 4, p[2] * 4) - 0.5) * disp * 0.45 + (vn(p[0] * 9, p[1] * 9, p[2] * 9) - 0.5) * disp * 0.15;
      for (const [nx, ny, nz, d] of facets) { const dd = p[0] * nx + p[1] * ny + p[2] * nz; if (dd * k > d) k = d / Math.max(dd, 0.01) + (k - d / Math.max(dd, 0.01)) * 0.15; } // planos de fratura
      let y = p[1] * k; if (y < -flat) y = -flat + (y + flat) * 0.15; // base achatada assentada no chão
      return [p[0] * k * r, y * r, p[2] * k * r];
    });
    const base = this.pos.length / 3; const acc = new Float32Array(v.length * 3); const W = pos.map((p) => this._tp(m, p));
    for (const [a, b, cc] of f) { const p0 = W[a], p1 = W[b], p2 = W[cc]; const ux = p1[0] - p0[0], uy = p1[1] - p0[1], uz = p1[2] - p0[2], wx = p2[0] - p0[0], wy = p2[1] - p0[1], wz = p2[2] - p0[2];
      const nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx; for (const i of [a, b, cc]) { acc[i * 3] += nx; acc[i * 3 + 1] += ny; acc[i * 3 + 2] += nz; } }
    for (let i = 0; i < v.length; i++) { const l = Math.hypot(acc[i * 3], acc[i * 3 + 1], acc[i * 3 + 2]) || 1; this.vert(W[i], [acc[i * 3] / l, acc[i * 3 + 1] / l, acc[i * 3 + 2] / l], colorFn ? colorFn(pos[i][1] / r, v[i], rand) : c); }
    for (const [a, b, cc] of f) this.tri(base + a, base + b, base + cc);
    return this;
  }
  // Painel de grama cruzado (duas faces), flex vertical
  blade(m, w, h, c, cTop) {
    const n = this._tn(m, [0, 0, 1]);
    const f0 = this.flex; this.flex = 0;
    const a = this.vert(this._tp(m, [-w / 2, 0, 0]), n, c), b = this.vert(this._tp(m, [w / 2, 0, 0]), n, c);
    this.flex = 1; const t = this.vert(this._tp(m, [0, h, 0]), this._tn(m, [0, 0.6, 1]), cTop || c); this.flex = f0;
    this.tri(a, b, t);
    return this;
  }
  // Superfície "loft": anéis elípticos empilhados (troncos, pernas, cabeça) com normais suaves.
  // rings: [{ y, rx, rz, cx=0, cz=0, col?, prof? }] — prof(a) multiplica o raio por ângulo (ex.: costas mais retas)
  loft(rings, seg, col, capTop = true, capBottom = true) {
    const start = this.pos.length / 3, i0 = this.idx.length;
    for (const r of rings) for (let j = 0; j <= seg; j++) {
      const a = (j / seg) * Math.PI * 2; const k = r.prof ? r.prof(a) : 1;
      this.vert([(r.cx || 0) + Math.sin(a) * r.rx * k, r.y, (r.cz || 0) + Math.cos(a) * r.rz * k], [0, 1, 0], r.col || col);
    }
    for (let i = 0; i < rings.length - 1; i++) for (let j = 0; j < seg; j++) {
      const a = start + i * (seg + 1) + j, b = a + seg + 1; this.tri(a, a + 1, b); this.tri(b, a + 1, b + 1);
    }
    const addCap = (ri, up) => { const r = rings[ri]; const c = this.vert([r.cx || 0, r.y + (up ? 0.002 : -0.002), r.cz || 0], [0, up ? 1 : -1, 0], r.col || col);
      for (let j = 0; j < seg; j++) { const a = start + ri * (seg + 1) + j; if (up) this.tri(c, a, a + 1); else this.tri(c, a + 1, a); } };
    if (capTop) addCap(rings.length - 1, true); if (capBottom) addCap(0, false);
    this.recomputeNormals(start, i0, seg + 1, rings.length);
    return this;
  }
  recomputeNormals(vStart, iStart, ringLen, nRings) {
    const n = this.pos.length / 3 - vStart; const acc = new Float32Array(n * 3);
    for (let t = iStart; t < this.idx.length; t += 3) {
      const ia = this.idx[t], ib = this.idx[t + 1], ic = this.idx[t + 2]; const P = this.pos;
      const ux = P[ib * 3] - P[ia * 3], uy = P[ib * 3 + 1] - P[ia * 3 + 1], uz = P[ib * 3 + 2] - P[ia * 3 + 2];
      const vx = P[ic * 3] - P[ia * 3], vy = P[ic * 3 + 1] - P[ia * 3 + 1], vz = P[ic * 3 + 2] - P[ia * 3 + 2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      for (const v of [ia, ib, ic]) { const k = (v - vStart) * 3; if (k < 0) continue; acc[k] += nx; acc[k + 1] += ny; acc[k + 2] += nz; }
    }
    if (ringLen) for (let r = 0; r < nRings; r++) { const a = r * ringLen * 3, b = (r * ringLen + ringLen - 1) * 3; for (let c = 0; c < 3; c++) { const s = acc[a + c] + acc[b + c]; acc[a + c] = acc[b + c] = s; } }
    for (let v = 0; v < n; v++) { const k = v * 3; const l = Math.hypot(acc[k], acc[k + 1], acc[k + 2]) || 1; this.nrm[(vStart + v) * 3] = acc[k] / l; this.nrm[(vStart + v) * 3 + 1] = acc[k + 1] / l; this.nrm[(vStart + v) * 3 + 2] = acc[k + 2] / l; }
  }
  append(other, m) { // mescla outro builder (estático)
    const base = this.pos.length / 3;
    for (let i = 0; i < other.pos.length; i += 3) {
      const p = this._tp(m, [other.pos[i], other.pos[i + 1], other.pos[i + 2]]); const n = this._tn(m, [other.nrm[i], other.nrm[i + 1], other.nrm[i + 2]]);
      this.pos.push(...p); this.nrm.push(...n); this.uv.push(other.uv[i / 3 * 2] ?? 0, other.uv[i / 3 * 2 + 1] ?? 0); if (other.hasUV) this.hasUV = true;
      const ci = (i / 3) * 4; this.col.push(other.col[ci], other.col[ci + 1], other.col[ci + 2], other.col[ci + 3]);
      if (this.skinned) { this.joints.push(this.bone, 0, 0, 0); this.weights.push(1, 0, 0, 0); }
    }
    for (const i of other.idx) this.idx.push(i + base);
    return this;
  }
  build() {
    const d = { pos: new Float32Array(this.pos), nrm: new Float32Array(this.nrm), col: new Float32Array(this.col), idx: this.idx };
    if (this.skinned) { d.joints = new Float32Array(this.joints); d.weights = new Float32Array(this.weights); }
    if (this.hasUV) d.uv = new Float32Array(this.uv);
    return d;
  }
  // Marca materiais PBR pela cor (vértices ainda com material padrão alfa=1): table = [[cor, alfa], ...]
  tagMaterials(table, tol = 0.1) {
    for (let i = 0; i < this.col.length; i += 4) {
      if (this.col[i + 3] !== 1) continue; let best = null, bd = tol;
      for (const [c, a] of table) { const d = Math.abs(this.col[i] - c[0]) + Math.abs(this.col[i + 1] - c[1]) + Math.abs(this.col[i + 2] - c[2]); if (d < bd) { bd = d; best = a; } }
      if (best !== null) this.col[i + 3] = best;
    }
    return this;
  }
  vuv(p, n, c, u, v) { this._uv = [u, v]; this.hasUV = true; return this.vert(p, n, c); }
  // Cartão de folhagem com UV (região do atlas r=[u0,v0,u1,v1]); 'pts' = 4 cantos já transformados
  // (base-esq, base-dir, topo-dir, topo-esq). Normal opcional por vértice (ex.: esférica a partir do centro da copa).
  quadUV(pts, r, c, nFn) {
    const ux = pts[1][0] - pts[0][0], uy = pts[1][1] - pts[0][1], uz = pts[1][2] - pts[0][2], vx = pts[3][0] - pts[0][0], vy = pts[3][1] - pts[0][1], vz = pts[3][2] - pts[0][2];
    let n = [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx]; const l = Math.hypot(...n) || 1; n = n.map((k) => k / l);
    const uvs = [[r[0], r[3]], [r[2], r[3]], [r[2], r[1]], [r[0], r[1]]];
    const id = pts.map((p, i) => this.vuv(p, nFn ? nFn(p) : n, c, uvs[i][0], uvs[i][1]));
    this.tri(id[0], id[1], id[2]); this.tri(id[0], id[2], id[3]);
  }
  // Cartão a partir de matriz: centro na base (0,0,0), largura w em X, altura h em Y, curvatura 'bend' (queda da ponta em -Z)
  card(m, w, h, r, c, nFn, segs = 1, bend = 0) {
    for (let k = 0; k < segs; k++) {
      const t0 = k / segs, t1 = (k + 1) / segs; const z0 = -bend * t0 * t0, z1 = -bend * t1 * t1;
      const rr = [r[0], r[1] + (r[3] - r[1]) * (1 - t1), r[2], r[1] + (r[3] - r[1]) * (1 - t0)];
      const P = [[-w / 2, h * t0, z0], [w / 2, h * t0, z0], [w / 2, h * t1, z1], [-w / 2, h * t1, z1]].map((p) => this._tp(m, p));
      this.quadUV(P, rr, c, nFn);
    }
  }
}

export const M = (x = 0, y = 0, z = 0, ry = 0, s = 1, rx = 0, rz = 0) => mat4.compose([x, y, z], ry, s, rx, rz);
export const hex = (h) => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];
export const shade = (c, f) => [Math.min(1, c[0] * f), Math.min(1, c[1] * f), Math.min(1, c[2] * f)];
