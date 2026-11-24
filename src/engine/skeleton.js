// Esqueleto, clipes de animação (keyframes) e Animator com crossfade e camada de ação mascarada.
// Formato compatível com glTF: trilhas guardam rotação LOCAL absoluta de cada osso (quaternion).
import { mat4, quat } from './math.js';
import { MAX_BONES } from './renderer.js';

export class Skeleton {
  // bones: [{name, parent, pos:[x,y,z], rot:[q]}]; invBind opcional (Float32Array 16*n)
  constructor(bones, invBind) {
    this.bones = bones; this.index = {}; bones.forEach((b, i) => { this.index[b.name] = i; b.rot = b.rot || [0, 0, 0, 1]; b.scale = b.scale || [1, 1, 1]; });
    this.invBind = invBind || this._computeInvBind();
  }
  _computeInvBind() {
    const n = this.bones.length, world = [], inv = new Float32Array(n * 16), local = mat4.create();
    for (let i = 0; i < n; i++) {
      const b = this.bones[i]; mat4.fromTRS(local, b.pos, b.rot, b.scale);
      world[i] = b.parent >= 0 ? mat4.mul(mat4.create(), world[b.parent], local) : mat4.copy(mat4.create(), local);
      const iv = mat4.invert(mat4.create(), world[i]); inv.set(iv, i * 16);
    }
    return inv;
  }
}

export class Clip {
  constructor(name, duration, loop = true) { this.name = name; this.duration = duration; this.loop = loop; this.tracks = new Map(); this.posTracks = new Map(); this.events = []; }
  sampleRot(bi, t, out) {
    const tr = this.tracks.get(bi); if (!tr) return null;
    const { times, vals } = tr; const n = times.length;
    if (n === 1 || t <= times[0]) { out[0] = vals[0]; out[1] = vals[1]; out[2] = vals[2]; out[3] = vals[3]; return out; }
    if (t >= times[n - 1]) { const k = (n - 1) * 4; out[0] = vals[k]; out[1] = vals[k + 1]; out[2] = vals[k + 2]; out[3] = vals[k + 3]; return out; }
    let i = tr.last || 0; if (times[i] > t) i = 0;
    while (i < n - 2 && times[i + 1] < t) i++; tr.last = i;
    const f = (t - times[i]) / (times[i + 1] - times[i]);
    const a = [vals[i * 4], vals[i * 4 + 1], vals[i * 4 + 2], vals[i * 4 + 3]], b = [vals[i * 4 + 4], vals[i * 4 + 5], vals[i * 4 + 6], vals[i * 4 + 7]];
    return quat.slerp(a, b, f, out);
  }
  samplePos(bi, t, out) {
    const tr = this.posTracks.get(bi); if (!tr) return null;
    const { times, vals } = tr; const n = times.length;
    if (n === 1 || t <= times[0]) { out[0] = vals[0]; out[1] = vals[1]; out[2] = vals[2]; return out; }
    if (t >= times[n - 1]) { const k = (n - 1) * 3; out[0] = vals[k]; out[1] = vals[k + 1]; out[2] = vals[k + 2]; return out; }
    let i = 0; while (i < n - 2 && times[i + 1] < t) i++;
    const f = (t - times[i]) / (times[i + 1] - times[i]);
    for (let k = 0; k < 3; k++) out[k] = vals[i * 3 + k] + (vals[i * 3 + 3 + k] - vals[i * 3 + k]) * f;
    return out;
  }
}

// Gera keyframes a partir de uma função de pose (autoria procedural → clipe keyframe real).
// fn(phase 0..1) => { bones: { nome: [rx,ry,rz] }, root: [dx,dy,dz] }
export function bakeClip(skel, name, duration, fn, { loop = true, fps = 30, events = [] } = {}) {
  const clip = new Clip(name, duration, loop); clip.events = events;
  const frames = Math.max(2, Math.round(duration * fps) + 1);
  const rot = new Map(), pos = [];
  const times = new Float32Array(frames);
  for (let f = 0; f < frames; f++) {
    const ph = f / (frames - 1); times[f] = ph * duration;
    const pose = fn(ph) || {};
    for (const [bn, e] of Object.entries(pose.bones || {})) {
      const bi = skel.index[bn]; if (bi === undefined) continue;
      if (!rot.has(bi)) rot.set(bi, new Float32Array(frames * 4));
      const q = quat.mul(skel.bones[bi].rot, quat.fromEuler(e[0] || 0, e[1] || 0, e[2] || 0));
      rot.get(bi).set(q, f * 4);
    }
    const r = pose.root || [0, 0, 0], k = skel.rootScale || 1; const rp = skel.bones[0].pos; pos.push(rp[0] + r[0] * k, rp[1] + r[1] * k, rp[2] + r[2] * k);
  }
  // ossos que aparecem só em alguns quadros: preencher com repouso
  for (const [bi, arr] of rot) for (let f = 0; f < frames; f++) if (arr[f * 4 + 3] === 0 && arr[f * 4] === 0 && arr[f * 4 + 1] === 0 && arr[f * 4 + 2] === 0) arr.set(skel.bones[bi].rot, f * 4);
  for (const [bi, vals] of rot) clip.tracks.set(bi, { times, vals });
  clip.posTracks.set(0, { times, vals: new Float32Array(pos) });
  return clip;
}

export class Animator {
  constructor(skel) {
    this.skel = skel; const n = skel.bones.length;
    this.states = []; // camada base: [{clip, time, weight, target, speed}]
    this.action = null; // {clip, time, weight, fadeIn, fadeOut, mask:Set, speed, onEvent, onEnd, firedEvents}
    this.localRot = Array.from({ length: n }, (_, i) => skel.bones[i].rot.slice());
    this.localPos = Array.from({ length: n }, (_, i) => skel.bones[i].pos.slice());
    this.world = Array.from({ length: n }, () => mat4.create());
    this.boneMats = new Float32Array(MAX_BONES * 16);
    for (let i = 0; i < MAX_BONES; i++) this.boneMats.set(mat4.create(), i * 16);
    this.extra = new Map(); // ajustes procedurais aditivos (olhar, inclinação)
    this.overlays = []; this.overlayMask = null; // camada de postura (ex.: segurar/mirar arma) sobre a locomoção
    this._tmp = [0, 0, 0, 1]; this._tmpP = [0, 0, 0]; this._local = mat4.create(); this._skin = mat4.create();
  }
  get current() { const s = this.states[this.states.length - 1]; return s ? s.clip.name : null; }
  play(clip, fade = 0.2, speed = 1, restart = false) {
    const top = this.states[this.states.length - 1];
    if (top && top.clip === clip && !restart) { top.speed = speed; return; }
    for (const s of this.states) { s.target = 0; s.fade = fade; }
    let st = this.states.find((s) => s.clip === clip);
    if (st && !restart) { this.states.splice(this.states.indexOf(st), 1); }
    else st = { clip, time: 0, weight: fade <= 0 ? 1 : 0 };
    if (restart) st.time = 0;
    st.target = 1; st.fade = fade; st.speed = speed;
    this.states.push(st);
    if (fade <= 0) { this.states = [st]; st.weight = 1; }
  }
  // Ação de corpo inteiro ou parcial (mask = Set de índices de ossos)
  playAction(clip, { mask = null, speed = 1, fadeIn = 0.1, fadeOut = 0.15, onEvent = null, onEnd = null } = {}) {
    this.action = { clip, time: 0, weight: fadeIn > 0 ? 0 : 1, fadeIn, fadeOut, mask, speed, onEvent, onEnd, fired: new Set(), ending: false };
  }
  stopAction(fade = 0.15) { if (this.action) { this.action.ending = true; this.action.fadeOut = fade; } }
  // Postura persistente mascarada (clip=null remove com transição)
  setOverlay(clip, mask, fade = 0.2) {
    if (mask) this.overlayMask = mask;
    const top = this.overlays[this.overlays.length - 1];
    if (top && top.clip === clip && top.target === 1) return;
    for (const o of this.overlays) { o.target = 0; o.fade = fade; }
    if (!clip) return;
    let o = this.overlays.find((x) => x.clip === clip); if (o) this.overlays.splice(this.overlays.indexOf(o), 1); else o = { clip, time: 0, weight: 0 };
    o.target = 1; o.fade = fade; this.overlays.push(o);
  }
  get busy() { return !!(this.action && !this.action.ending); }

  update(dt) {
    const sk = this.skel, n = sk.bones.length;
    // pesos da camada base
    for (const s of this.states) {
      s.time += dt * s.speed;
      if (s.clip.loop) s.time %= s.clip.duration; else s.time = Math.min(s.time, s.clip.duration);
      const rate = s.fade > 0 ? dt / s.fade : 1;
      s.weight += Math.sign(s.target - s.weight) * Math.min(Math.abs(s.target - s.weight), rate);
    }
    this.states = this.states.filter((s) => s.weight > 0.001 || s.target > 0);
    const q = this._tmp, p = this._tmpP;
    for (let i = 0; i < n; i++) {
      const lr = this.localRot[i]; lr[0] = sk.bones[i].rot[0]; lr[1] = sk.bones[i].rot[1]; lr[2] = sk.bones[i].rot[2]; lr[3] = sk.bones[i].rot[3];
      let acc = 0;
      for (const s of this.states) {
        if (s.weight <= 0) continue;
        if (!s.clip.sampleRot(i, s.time, q)) { q[0] = sk.bones[i].rot[0]; q[1] = sk.bones[i].rot[1]; q[2] = sk.bones[i].rot[2]; q[3] = sk.bones[i].rot[3]; }
        acc += s.weight; quat.slerp(lr, q, s.weight / acc, lr);
      }
    }
    // posição da raiz
    const rp = this.localPos[0]; rp[0] = sk.bones[0].pos[0]; rp[1] = sk.bones[0].pos[1]; rp[2] = sk.bones[0].pos[2];
    { let acc = 0; for (const s of this.states) { if (s.weight <= 0 || !s.clip.samplePos(0, s.time, p)) continue; acc += s.weight; const f = s.weight / acc; for (let k = 0; k < 3; k++) rp[k] += (p[k] - rp[k]) * f; } }
    // camada de postura
    for (const o of this.overlays) {
      o.time = (o.time + dt) % o.clip.duration; const rate = o.fade > 0 ? dt / o.fade : 1;
      o.weight += Math.sign(o.target - o.weight) * Math.min(Math.abs(o.target - o.weight), rate);
      if (o.weight <= 0) continue;
      for (let i = 0; i < n; i++) { if (this.overlayMask && !this.overlayMask.has(i)) continue; if (o.clip.sampleRot(i, o.time, q)) quat.slerp(this.localRot[i], q, o.weight, this.localRot[i]); }
    }
    this.overlays = this.overlays.filter((o) => o.weight > 0.001 || o.target > 0);
    // camada de ação
    const a = this.action;
    if (a) {
      a.time += dt * a.speed;
      if (!a.ending) { a.weight = a.fadeIn > 0 ? Math.min(1, a.weight + dt / a.fadeIn) : 1; }
      else a.weight = Math.max(0, a.weight - dt / Math.max(0.01, a.fadeOut));
      for (const ev of a.clip.events) if (!a.fired.has(ev.name) && a.time >= ev.t * a.clip.duration) { a.fired.add(ev.name); a.onEvent && a.onEvent(ev.name); }
      if (!a.ending && a.time >= a.clip.duration) {
        if (a.clip.loop) a.time %= a.clip.duration;
        else { a.time = a.clip.duration; if (a.fadeOut > 0) a.ending = true; const cb = a.onEnd; a.onEnd = null; cb && cb(); if (a.fadeOut <= 0 && this.action === a) a.holding = true; }
      }
      const w = a.weight;
      for (let i = 0; i < n; i++) {
        if (a.mask && !a.mask.has(i)) continue;
        if (a.clip.sampleRot(i, a.time, q)) quat.slerp(this.localRot[i], q, w, this.localRot[i]);
      }
      if (!a.mask && a.clip.samplePos(0, a.time, p)) for (let k = 0; k < 3; k++) rp[k] += (p[k] - rp[k]) * w;
      if (this.action === a && a.ending && a.weight <= 0) this.action = null;
    }
    // ajustes aditivos
    for (const [bi, eq] of this.extra) { const r = quat.mul(this.localRot[bi], eq); this.localRot[bi] = quat.normalize(r); }
    // matrizes
    for (let i = 0; i < n; i++) {
      const b = sk.bones[i];
      mat4.fromTRS(this._local, i === 0 ? rp : b.pos, this.localRot[i], b.scale);
      if (b.parent >= 0) mat4.mul(this.world[i], this.world[b.parent], this._local); else mat4.copy(this.world[i], this._local);
      mat4.mul(this._skin, this.world[i], sk.invBind.subarray(i * 16, i * 16 + 16));
      this.boneMats.set(this._skin, i * 16);
    }
  }
}

// Máscara: osso e todos os descendentes
export function maskFrom(skel, rootName) {
  const r = skel.index[rootName], s = new Set([r]);
  for (let i = 0; i < skel.bones.length; i++) { let p = skel.bones[i].parent; while (p >= 0) { if (p === r) { s.add(i); break; } p = skel.bones[p].parent; } }
  return s;
}
