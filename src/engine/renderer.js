// Renderizador WebGL2 realista: PBR (GGX) com materiais procedurais, sombras suaves, HDR,
// SSAO, bloom, névoa de altura, céu atmosférico, água, partículas, skinning e instancing.
import { mat4, frustumPlanes, sphereInFrustum } from './math.js';

import { MAX_BONES, MAX_PL, COMMON_VS, DEPTH_FS, LIT_FS, SKY_VS, SKY_FS, WATER_VS, WATER_FS, PART_VS, PART_FS, FS_VS, SSAO_FS, BRIGHT_FS, BLUR_FS, COMPOSITE_FS, FXAA_FS } from './shaders.js';
export { MAX_BONES };

function floatToHalf(v) {
  const f = new Float32Array(1), u = new Uint32Array(f.buffer); f[0] = v; const x = u[0];
  const s = (x >>> 16) & 0x8000; let e = ((x >>> 23) & 0xff) - 112; let m = x & 0x7fffff;
  if (e <= 0) return s; if (e >= 31) return s | 0x7c00; return s | (e << 10) | (m >>> 13);
}

export class Renderer {
  constructor(canvas) {
    const gl = canvas.getContext('webgl2', { antialias: true, powerPreference: 'high-performance', alpha: false });
    if (!gl) throw new Error('WebGL2 não suportado neste navegador.');
    this.gl = gl; this.canvas = canvas; this.programs = new Map();
    this.view = mat4.create(); this.proj = mat4.create(); this.viewProj = mat4.create(); this.invVP = mat4.create();
    this.lightVP = mat4.create(); this.camPos = [0, 0, 0]; this.planes = [];
    this.shadowSize = (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) ? 1024 : 2048; this.shadowsEnabled = true; this.flatShading = false; this.post = { ssao: true, bloom: true, fxaa: true }; this.exposure = 1.0; this.detail = 1.0; this.pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    this.env = { sunDir: [0, 1, 0], sunCol: [1, 1, 1], ambSky: [0.3, 0.35, 0.4], ambGround: [0.15, 0.13, 0.1], fogCol: [0.6, 0.7, 0.8], fogDensity: 0.004,
      zenith: [0.2, 0.4, 0.8], horizon: [0.7, 0.8, 0.9], moonDir: [0, -1, 0], night: 0, cloud: 0, time: 0, wind: 1, wet: 0, flash: 0, fogAmt: 0, rain: 0, scatterCol: [0.6, 0.45, 0.3], fogHeight: 10 };
    this.pointLights = [];
    this.stats = { draws: 0, tris: 0 };
    this.hdrFormat = gl.getExtension('EXT_color_buffer_float') ? 'f16' : 'u8'; gl.getExtension('OES_texture_float_linear');
    this._initShadow(); this._initQuads(); this._initParticles(); this._initPost();
    gl.enable(gl.DEPTH_TEST); gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK);
  }

  program(defs) {
    defs = defs.slice();
    const key = defs.slice().sort().join('|');
    let p = this.programs.get(key); if (p) return p;
    const head = defs.map((d) => `#define ${d}\n`).join('');
    const inject = (src) => src.replace('#version 300 es', '#version 300 es\n' + head);
    const fs = defs.includes('DEPTH') ? DEPTH_FS : LIT_FS;
    if (defs.includes('DEPTH') && defs.includes('ALPHA') && !defs.includes('TEX')) defs = [...defs, 'TEX'];
    p = this._compile(inject(COMMON_VS), inject(fs)); this.programs.set(key, p); return p;
  }
  _compile(vsSrc, fsSrc) {
    const gl = this.gl;
    const mk = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { const log = gl.getShaderInfoLog(s); throw new Error('Erro de shader: ' + log + '\n' + src.split('\n').slice(0, 5).join('\n')); } return s; };
    const prog = gl.createProgram(); gl.attachShader(prog, mk(gl.VERTEX_SHADER, vsSrc)); gl.attachShader(prog, mk(gl.FRAGMENT_SHADER, fsSrc));
    gl.linkProgram(prog); if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error('Erro de link: ' + gl.getProgramInfoLog(prog));
    const u = {}; const n = gl.getProgramParameter(prog, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) { const info = gl.getActiveUniform(prog, i); const name = info.name.replace(/\[0\]$/, ''); u[name] = gl.getUniformLocation(prog, info.name); }
    return { prog, u };
  }

  // ---------- Recursos ----------
  createMesh(d) {
    const gl = this.gl; const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
    const buf = (data, loc, size, type = gl.FLOAT) => { const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, size, type, false, 0, 0); return b; };
    const bufs = [buf(d.pos, 0, 3), buf(d.nrm, 1, 3), buf(d.col, 2, 4)];
    if (d.joints) bufs.push(buf(d.joints, 3, 4), buf(d.weights, 4, 4));
    if (d.uv) bufs.push(buf(d.uv, 10, 2));
    const ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
    const idx = d.idx.length > 65535 || d.pos.length / 3 > 65535 ? new Uint32Array(d.idx) : new Uint16Array(d.idx);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
    gl.bindVertexArray(null);
    let minY = Infinity, maxY = -Infinity, r = 0;
    for (let i = 0; i < d.pos.length; i += 3) { const y = d.pos[i + 1]; if (y < minY) minY = y; if (y > maxY) maxY = y; r = Math.max(r, Math.hypot(d.pos[i], d.pos[i + 1], d.pos[i + 2])); }
    return { vao, count: idx.length, idxType: idx instanceof Uint32Array ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT, bufs, ib, radius: r, minY, maxY, skinned: !!d.joints, uv: !!d.uv, data: d };
  }
  createInstanced(mesh, matrices, colors) {
    const gl = this.gl; const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
    const d = mesh.data;
    const bind = (b, loc, size) => { gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0); };
    bind(mesh.bufs[0], 0, 3); bind(mesh.bufs[1], 1, 3); bind(mesh.bufs[2], 2, 4);
    if (mesh.uv) bind(mesh.bufs[mesh.skinned ? 5 : 3], 10, 2);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.ib);
    const mb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, mb);
    for (let i = 0; i < 4; i++) { gl.enableVertexAttribArray(5 + i); gl.vertexAttribPointer(5 + i, 4, gl.FLOAT, false, 64, i * 16); gl.vertexAttribDivisor(5 + i, 1); }
    const cb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, cb);
    gl.enableVertexAttribArray(9); gl.vertexAttribPointer(9, 4, gl.FLOAT, false, 0, 0); gl.vertexAttribDivisor(9, 1);
    gl.bindVertexArray(null);
    const batch = { vao, mesh, mb, cb, instCount: 0, sphere: [0, 0, 0, 1], instanced: true };
    batch.update = (m, c) => {
      const n = m.length / 16; batch.instCount = n;
      if (!c) { c = new Float32Array(n * 4).fill(1); }
      gl.bindBuffer(gl.ARRAY_BUFFER, mb); gl.bufferData(gl.ARRAY_BUFFER, m, gl.DYNAMIC_DRAW);
      gl.bindBuffer(gl.ARRAY_BUFFER, cb); gl.bufferData(gl.ARRAY_BUFFER, c, gl.DYNAMIC_DRAW);
      // esfera envolvente para culling
      let minx = Infinity, minz = Infinity, maxx = -Infinity, maxz = -Infinity, miny = Infinity, maxy = -Infinity;
      for (let i = 0; i < n; i++) { const x = m[i * 16 + 12], y = m[i * 16 + 13], z = m[i * 16 + 14];
        if (x < minx) minx = x; if (x > maxx) maxx = x; if (z < minz) minz = z; if (z > maxz) maxz = z; if (y < miny) miny = y; if (y > maxy) maxy = y; }
      const sc = n ? Math.hypot(m[0], m[1], m[2]) : 1;
      batch.sphere = [(minx + maxx) / 2, (miny + maxy) / 2, (minz + maxz) / 2, Math.hypot(maxx - minx, maxy - miny, maxz - minz) / 2 + mesh.radius * Math.max(sc, 1.6)];
    };
    batch.update(matrices, colors);
    return batch;
  }
  disposeMesh(m) { const gl = this.gl; if (!m || m.disposed) return; for (const b of m.bufs) gl.deleteBuffer(b); gl.deleteBuffer(m.ib); gl.deleteVertexArray(m.vao); m.data = null; m.disposed = true; }
  disposeBatch(b) { const gl = this.gl; if (!b) return; gl.deleteBuffer(b.mb); gl.deleteBuffer(b.cb); gl.deleteVertexArray(b.vao); }
  createHeightTexture(heights, n) {
    const gl = this.gl; const t = this.heightTex || gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    const h = new Uint16Array(n * n); for (let i = 0; i < n * n; i++) h[i] = floatToHalf(heights[i]); gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R16F, n, n, 0, gl.RED, gl.HALF_FLOAT, h);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    this.heightTex = t; return t;
  }
  createTexture(image) {
    const gl = this.gl; const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image); gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    const af = gl.getExtension('EXT_texture_filter_anisotropic'); if (af) gl.texParameterf(gl.TEXTURE_2D, af.TEXTURE_MAX_ANISOTROPY_EXT, 8); return t;
  }

  _initShadow() {
    const gl = this.gl;
    this.shadowTex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, this.shadowTex);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.DEPTH_COMPONENT24, this.shadowSize, this.shadowSize);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    this.shadowFbo = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, this.shadowFbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, this.shadowTex, 0);
    gl.drawBuffers([gl.NONE]); gl.readBuffer(gl.NONE);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }
  _initQuads() {
    const gl = this.gl;
    this.fsVao = gl.createVertexArray(); gl.bindVertexArray(this.fsVao);
    const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0); gl.bindVertexArray(null);
    this.skyProg = this._compile(SKY_VS, SKY_FS);
    this.waterProg = this._compile(WATER_VS, WATER_FS);
  }
  createWaterMesh(size, seg, level) {
    const gl = this.gl; const pos = []; const idx = [];
    for (let z = 0; z <= seg; z++) for (let x = 0; x <= seg; x++) pos.push(-size / 2 + (x / seg) * size, level, -size / 2 + (z / seg) * size);
    for (let z = 0; z < seg; z++) for (let x = 0; x < seg; x++) { const i = z * (seg + 1) + x; idx.push(i, i + seg + 1, i + 1, i + 1, i + seg + 1, i + seg + 2); }
    const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
    const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(pos), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
    const ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(idx), gl.STATIC_DRAW);
    gl.bindVertexArray(null); this.water = { vao, count: idx.length };
  }
  _initParticles() {
    const gl = this.gl; this.partProg = this._compile(PART_VS, PART_FS);
    this.partMax = 6000; this.partData = new Float32Array(this.partMax * 9); this.partCount = 0;
    this.partVao = gl.createVertexArray(); gl.bindVertexArray(this.partVao);
    const qb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, qb);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, -1, 1, 1, -1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    this.partBuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, this.partBuf); gl.bufferData(gl.ARRAY_BUFFER, this.partData.byteLength, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 36, 0); gl.vertexAttribDivisor(1, 1);
    gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 36, 16); gl.vertexAttribDivisor(2, 1);
    gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3, 1, gl.FLOAT, false, 36, 32); gl.vertexAttribDivisor(3, 1);
    gl.bindVertexArray(null);
  }
  particle(x, y, z, size, r, g, b, a, stretch = 0) {
    if (this.partCount >= this.partMax) return; const d = this.partData, i = this.partCount++ * 9;
    d[i] = x; d[i + 1] = y; d[i + 2] = z; d[i + 3] = size; d[i + 4] = r; d[i + 5] = g; d[i + 6] = b; d[i + 7] = a; d[i + 8] = stretch;
  }

  resize() {
    const pr = window.__TEST_RES || this.pixelRatio; // testes automáticos (render por software) usam resolução reduzida
    const w = Math.max(1, Math.floor(this.canvas.clientWidth * pr)), h = Math.max(1, Math.floor(this.canvas.clientHeight * pr));
    if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h; }
  }
  setCamera(eye, target, fov, near = 0.1, far = 900) {
    this.resize();
    mat4.perspective(this.proj, fov, this.canvas.width / Math.max(1, this.canvas.height), near, far);
    mat4.lookAt(this.view, eye, target, [0, 1, 0]);
    mat4.mul(this.viewProj, this.proj, this.view); mat4.invert(this.invVP, this.viewProj);
    this.camPos = eye.slice(); this.planes = frustumPlanes(this.viewProj);
    const v = this.view; this.camRight = [v[0], v[4], v[8]]; this.camUp = [v[1], v[5], v[9]];
  }
  setShadowCenter(c) {
    const s = this.env.sunDir[1] > 0.05 ? this.env.sunDir : this.env.moonDir; this.shadowLightDir = s; this.shadowCenter = c;
    const ext = 55, texel = (ext * 2) / this.shadowSize;
    const lv = mat4.create(); const lp = mat4.create();
    const eye = [c[0] + s[0] * 150, c[1] + s[1] * 150, c[2] + s[2] * 150];
    mat4.lookAt(lv, eye, c, Math.abs(s[1]) > 0.99 ? [0, 0, 1] : [0, 1, 0]);
    // estabiliza o shadow map (snap ao texel) para evitar tremulação
    const cl = mat4.transformPoint(lv, c);
    const sx = Math.round(cl[0] / texel) * texel - cl[0], sy = Math.round(cl[1] / texel) * texel - cl[1];
    mat4.ortho(lp, -ext + sx + cl[0], ext + sx + cl[0], -ext + sy + cl[1], ext + sy + cl[1], 1, 400);
    mat4.mul(this.lightVP, lp, lv);
  }
  visible(x, y, z, r) { return sphereInFrustum(this.planes, x, y, z, r); }

  _setCommon(p, depth) {
    const gl = this.gl, u = p.u, e = this.env;
    gl.uniformMatrix4fv(u.u_viewProj, false, depth ? this.lightVP : this.viewProj);
    gl.uniformMatrix4fv(u.u_lightVP, false, this.lightVP);
    if (u.u_time) gl.uniform1f(u.u_time, e.time);
    if (u.u_wind) gl.uniform1f(u.u_wind, e.wind);
    if (depth) return;
    gl.uniform3fv(u.u_sunDir, this.lightDirForShade || e.sunDir); gl.uniform3fv(u.u_sunCol, e.sunCol);
    gl.uniform3fv(u.u_ambSky, e.ambSky); gl.uniform3fv(u.u_ambGround, e.ambGround); gl.uniform3fv(u.u_fogCol, this._fogLin);
    gl.uniform3fv(u.u_camPos, this.camPos); gl.uniform1f(u.u_fogDensity, e.fogDensity); gl.uniform3fv(u.u_scatterCol, e.scatterCol); gl.uniform1f(u.u_fogHeight, e.fogHeight); gl.uniform1f(u.u_detail, this.detail);
    gl.uniform1f(u.u_shadowOn, this.shadowsEnabled ? 1 : 0); gl.uniform1f(u.u_wet, e.wet);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.shadowTex); gl.uniform1i(u.u_shadow, 0);
    const n = Math.min(this.pointLights.length, MAX_PL);
    if (n) {
      const pp = new Float32Array(MAX_PL * 4), pc = new Float32Array(MAX_PL * 4);
      for (let i = 0; i < n; i++) { const l = this.pointLights[i]; pp.set([l.pos[0], l.pos[1], l.pos[2], l.range], i * 4); pc.set([l.col[0], l.col[1], l.col[2], 1], i * 4); }
      gl.uniform4fv(u.u_plPos, pp); gl.uniform4fv(u.u_plCol, pc);
    }
    gl.uniform1i(u.u_plCount, n);
  }

  // ---------- pós-processamento ----------
  _initPost() {
    this.ssaoProg = this._compile(FS_VS, SSAO_FS); this.brightProg = this._compile(FS_VS, BRIGHT_FS); this.blurProg = this._compile(FS_VS, BLUR_FS);
    this.compProg = this._compile(FS_VS, COMPOSITE_FS); this.fxaaProg = this._compile(FS_VS, FXAA_FS); this.rt = null;
  }
  _tex(w, h, fmt) {
    const gl = this.gl; const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    if (fmt === 'depth') gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT24, w, h, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, null);
    else if (fmt === 'f16') gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
    else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    const filt = fmt === 'depth' ? gl.NEAREST : gl.LINEAR;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filt); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filt);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); return t;
  }
  _fbo(color, depth) { const gl = this.gl; const f = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, f);
    if (color) gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, color, 0);
    if (depth) gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, depth, 0);
    const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE; gl.bindFramebuffer(gl.FRAMEBUFFER, null); return ok ? f : null; }
  _ensureTargets() {
    const gl = this.gl, w = this.canvas.width, h = this.canvas.height;
    if (this.rt && this.rt.w === w && this.rt.h === h) return this.rt;
    if (this.rt) for (const t of this.rt.texs) gl.deleteTexture(t);
    const hw = Math.max(1, w >> 1), hh = Math.max(1, h >> 1), qw = Math.max(1, w >> 2), qh = Math.max(1, h >> 2);
    let fmt = this.hdrFormat; let hdr = this._tex(w, h, fmt); const depth = this._tex(w, h, 'depth'); let main = this._fbo(hdr, depth);
    if (!main) { gl.deleteTexture(hdr); fmt = 'u8'; hdr = this._tex(w, h, fmt); main = this._fbo(hdr, depth); }
    const ao = this._tex(hw, hh, 'u8'), b1 = this._tex(qw, qh, fmt), b2 = this._tex(qw, qh, fmt), ldr = this._tex(w, h, 'u8');
    this.rt = { w, h, hw, hh, qw, qh, hdr, depth, main, ao, aoF: this._fbo(ao), b1, b2, b1F: this._fbo(b1), b2F: this._fbo(b2), ldr, ldrF: this._fbo(ldr), texs: [hdr, depth, ao, b1, b2, ldr] };
    return this.rt;
  }
  _pass(prog, fbo, w, h, setup) { const gl = this.gl; gl.bindFramebuffer(gl.FRAMEBUFFER, fbo); gl.viewport(0, 0, w, h); gl.useProgram(prog.prog); setup(prog.u); gl.bindVertexArray(this.fsVao); gl.drawArrays(gl.TRIANGLES, 0, 3); }
  _bind(u, name, unit, tex) { const gl = this.gl; gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, tex); gl.uniform1i(u[name], unit); }

  // Renderiza a lista de itens. item: {mesh|batch, model, bones, alpha, emissive, tint, wind, terrain, shadow, tex, alphaTest}
  renderFrame(items, opts = {}) {
    const gl = this.gl; this.stats.draws = 0; this.stats.tris = 0;
    const e = this.env; this._fogLin = e.fogCol.map((v) => Math.pow(v, 2.2));
    const sunUp = e.sunDir[1] > 0.05;
    this.lightDirForShade = sunUp ? e.sunDir : e.moonDir;
    // ---- passe de sombra ----
    if (this.shadowsEnabled) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.shadowFbo); gl.viewport(0, 0, this.shadowSize, this.shadowSize);
      gl.clear(gl.DEPTH_BUFFER_BIT); this._lastProg = null; gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(1.5, 3); gl.disable(gl.CULL_FACE);
      const sc = this.shadowCenter || [0, 0, 0];
      for (const it of items) { if (it.shadow === false || (it.alpha !== undefined && it.alpha < 0.99)) continue;
        const s = it.batch ? it.batch.sphere : it.sphere; if (s && Math.hypot(s[0] - sc[0], s[2] - sc[2]) > 85 + s[3]) continue;
        this._drawItem(it, true); }
      gl.disable(gl.POLYGON_OFFSET_FILL); gl.enable(gl.CULL_FACE);
    }
    const rt = this._ensureTargets();
    gl.bindFramebuffer(gl.FRAMEBUFFER, rt.main);
    gl.viewport(0, 0, rt.w, rt.h);
    gl.clearColor(this._fogLin[0], this._fogLin[1], this._fogLin[2], 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    // ---- céu ----
    gl.disable(gl.DEPTH_TEST); gl.depthMask(false);
    const sp = this.skyProg; gl.useProgram(sp.prog);
    gl.uniformMatrix4fv(sp.u.u_invVP, false, this.invVP); gl.uniform3fv(sp.u.u_camPos, this.camPos);
    gl.uniform3fv(sp.u.u_sunDir, e.sunDir); gl.uniform3fv(sp.u.u_moonDir, e.moonDir); gl.uniform3fv(sp.u.u_zenith, e.zenith);
    gl.uniform3fv(sp.u.u_horizon, e.horizon); gl.uniform3fv(sp.u.u_fogCol, this._fogLin); gl.uniform3fv(sp.u.u_scatterCol, e.scatterCol); gl.uniform1f(sp.u.u_night, e.night);
    gl.uniform1f(sp.u.u_cloud, e.cloud); gl.uniform1f(sp.u.u_time, e.time); gl.uniform1f(sp.u.u_fogAmt, e.fogAmt); gl.uniform1f(sp.u.u_flash, e.flash);
    gl.bindVertexArray(this.fsVao); gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.enable(gl.DEPTH_TEST); gl.depthMask(true);
    // ---- opacos ----
    this._lastProg = null;
    const transp = [];
    for (const it of items) { if (it.alpha !== undefined && it.alpha < 0.99) { transp.push(it); continue; } this._drawItem(it, false); }
    // ---- água ----
    if (this.water) {
      gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.disable(gl.CULL_FACE);
      const wp = this.waterProg; gl.useProgram(wp.prog);
      gl.uniformMatrix4fv(wp.u.u_viewProj, false, this.viewProj); gl.uniform1f(wp.u.u_time, e.time);
      gl.uniform3fv(wp.u.u_camPos, this.camPos); gl.uniform3fv(wp.u.u_sunDir, this.lightDirForShade); gl.uniform3fv(wp.u.u_sunCol, e.sunCol);
      gl.uniform3fv(wp.u.u_zenith, e.zenith); gl.uniform3fv(wp.u.u_horizon, e.horizon); gl.uniform3fv(wp.u.u_fogCol, this._fogLin);
      gl.uniform3fv(wp.u.u_ambSky, e.ambSky); gl.uniform1f(wp.u.u_fogDensity, e.fogDensity); gl.uniform1f(wp.u.u_night, e.night); gl.uniform1f(wp.u.u_rain, e.rain);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.heightTex); gl.uniform1i(wp.u.u_height, 1);
      gl.uniform4fv(wp.u.u_hInfo, this.hInfo || [0, 0, 1, 0]); gl.uniform2fv(wp.u.u_off, this.waterOff || [0, 0]);
      gl.bindVertexArray(this.water.vao); gl.drawElements(gl.TRIANGLES, this.water.count, gl.UNSIGNED_INT, 0);
      gl.enable(gl.CULL_FACE);
    }
    // ---- transparentes ----
    this._lastProg = null;
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false);
    for (const it of transp) this._drawItem(it, false);
    gl.depthMask(true);
    // ---- partículas ----
    if (this.partCount) {
      const pp = this.partProg; gl.useProgram(pp.prog);
      gl.uniformMatrix4fv(pp.u.u_viewProj, false, this.viewProj); gl.uniform3fv(pp.u.u_camRight, this.camRight); gl.uniform3fv(pp.u.u_camUp, this.camUp);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.partBuf); gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.partData, 0, this.partCount * 9);
      gl.depthMask(false); gl.disable(gl.CULL_FACE);
      gl.bindVertexArray(this.partVao); gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, this.partCount);
      gl.depthMask(true); gl.enable(gl.CULL_FACE);
    }
    this.partCount = 0;
    gl.disable(gl.BLEND); gl.disable(gl.DEPTH_TEST);
    // ---- SSAO (meia resolução) ----
    const P = this.post;
    if (P.ssao) { const invP = mat4.invert(mat4.create(), this.proj);
      this._pass(this.ssaoProg, rt.aoF, rt.hw, rt.hh, (u) => { this._bind(u, 'u_depth', 0, rt.depth); gl.uniformMatrix4fv(u.u_invProj, false, invP); gl.uniform2f(u.u_res, rt.hw, rt.hh); gl.uniform1f(u.u_proj11, this.proj[5]); }); }
    // ---- bloom (1/4 de resolução, desfoque separável) ----
    if (P.bloom) {
      this._pass(this.brightProg, rt.b1F, rt.qw, rt.qh, (u) => { this._bind(u, 'u_tex', 0, rt.hdr); gl.uniform1f(u.u_exposure, this.exposure); });
      for (let i = 0; i < 2; i++) {
        this._pass(this.blurProg, rt.b2F, rt.qw, rt.qh, (u) => { this._bind(u, 'u_tex', 0, rt.b1); gl.uniform2f(u.u_dir, 1.6 / rt.qw, 0); });
        this._pass(this.blurProg, rt.b1F, rt.qw, rt.qh, (u) => { this._bind(u, 'u_tex', 0, rt.b2); gl.uniform2f(u.u_dir, 0, 1.6 / rt.qh); });
      }
    }
    // ---- composição: AO + bloom + exposição + ACES + gradação + vinheta + grão ----
    const ov = opts.overlay || [0, 0, 0, 0];
    this._pass(this.compProg, P.fxaa ? rt.ldrF : null, rt.w, rt.h, (u) => {
      this._bind(u, 'u_hdr', 0, rt.hdr); this._bind(u, 'u_ao', 1, rt.ao); this._bind(u, 'u_bloom', 2, rt.b1);
      gl.uniform1f(u.u_exposure, this.exposure); gl.uniform1f(u.u_aoOn, P.ssao ? 1 : 0); gl.uniform1f(u.u_bloomOn, P.bloom ? 1 : 0); gl.uniform1f(u.u_time, e.time % 100);
      gl.uniform1f(u.u_sat, this.saturation ?? 0.88); gl.uniform1f(u.u_vig, 0.9); gl.uniform4fv(u.u_overlay, ov); gl.uniform2f(u.u_texel, 1 / rt.hw, 1 / rt.hh);
    });
    if (P.fxaa) this._pass(this.fxaaProg, null, rt.w, rt.h, (u) => { this._bind(u, 'u_tex', 0, rt.ldr); gl.uniform2f(u.u_texel, 1 / rt.w, 1 / rt.h); });
    gl.enable(gl.DEPTH_TEST); gl.bindVertexArray(null); gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  _drawItem(it, depth) {
    const gl = this.gl;
    const mesh = it.batch ? it.batch.mesh : it.mesh;
    if (it.batch && it.batch.instCount === 0) return;
    if (!depth && it.cull !== false) {
      if (it.batch) { const s = it.batch.sphere; if (!this.visible(s[0], s[1], s[2], s[3])) return; }
      else if (it.sphere) { const s = it.sphere; if (!this.visible(s[0], s[1], s[2], s[3])) return; }
    }
    const defs = [];
    if (it.batch) defs.push('INSTANCED');
    if (mesh.skinned && it.bones) defs.push('SKINNED');
    if (it.wind) defs.push('WIND');
    if (it.terrain && !depth) defs.push('TERRAIN');
    if (it.tex && mesh.uv && (!depth || it.alphaTest)) defs.push('TEX');
    if (it.alphaTest && it.tex && mesh.uv) defs.push('ALPHA');
    if (depth) defs.push('DEPTH');
    const p = this.program(defs);
    if (this._lastProg !== p || this._lastDepth !== depth) { gl.useProgram(p.prog); this._setCommon(p, depth); this._lastProg = p; this._lastDepth = depth; }
    const u = p.u;
    gl.uniformMatrix4fv(u.u_model, false, it.model || IDENT);
    if (it.bones && u.u_bones) gl.uniformMatrix4fv(u.u_bones, false, it.bones);
    if (!depth) {
      gl.uniform1f(u.u_alpha, it.alpha ?? 1); gl.uniform1f(u.u_emissive, it.emissive || 0); if (u.u_fogMul) gl.uniform1f(u.u_fogMul, it.fogMul ?? 1); if (u.u_rim) gl.uniform1f(u.u_rim, it.rim || 0);
      gl.uniform4fv(u.u_tint, it.tint || ONE4);
      if (it.doubleSided) gl.disable(gl.CULL_FACE);
    }
    if (it.tex && u.u_tex) { gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, it.tex); gl.uniform1i(u.u_tex, 2); }
    gl.bindVertexArray(it.batch ? it.batch.vao : mesh.vao);
    if (it.batch) gl.drawElementsInstanced(gl.TRIANGLES, mesh.count, mesh.idxType, 0, it.batch.instCount);
    else gl.drawElements(gl.TRIANGLES, mesh.count, mesh.idxType, 0);
    this.stats.tris += (mesh.count / 3) * (it.batch ? it.batch.instCount : 1);
    if (!depth && it.doubleSided) gl.enable(gl.CULL_FACE);
    this.stats.draws++;
  }
  beginFrame() { this._curFrame = (this._curFrame || 0) + 1; this._lastProg = null; }
}
const IDENT = mat4.create();
const ONE4 = new Float32Array([1, 1, 1, 1]);
