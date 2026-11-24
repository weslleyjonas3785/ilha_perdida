// Carregador GLB/glTF 2.0 (malhas com skin, esqueleto, animações e textura base) para substituir
// os modelos provisórios por modelos definitivos (ex.: exportados do Blender ou Mixamo).
import { mat4, quat } from './math.js';
import { Skeleton, Clip, maskFrom } from './skeleton.js';
import { MAX_BONES } from './renderer.js';

const COMP = { 5120: Int8Array, 5121: Uint8Array, 5122: Int16Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array };
const NUM = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };

export function parseGLB(buf) {
  const dv = new DataView(buf);
  if (dv.getUint32(0, true) !== 0x46546c67) throw new Error('Arquivo não é GLB');
  let off = 12, json = null, bin = null;
  while (off < buf.byteLength) {
    const len = dv.getUint32(off, true), type = dv.getUint32(off + 4, true);
    if (type === 0x4e4f534a) json = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, off + 8, len)));
    else if (type === 0x004e4942) bin = buf.slice(off + 8, off + 8 + len);
    off += 8 + len;
  }
  return { json, bin };
}
function readAccessor(g, bin, i) {
  const a = g.accessors[i], bv = g.bufferViews[a.bufferView]; const T = COMP[a.componentType], n = NUM[a.type];
  const stride = bv.byteStride || 0, eb = T.BYTES_PER_ELEMENT * n; const base = (bv.byteOffset || 0) + (a.byteOffset || 0);
  let out;
  if (!stride || stride === eb) out = new T(bin.slice(base, base + a.count * eb));
  else { out = new T(a.count * n); const src = new DataView(bin); for (let k = 0; k < a.count; k++) for (let c = 0; c < n; c++) { const o = base + k * stride + c * T.BYTES_PER_ELEMENT;
    out[k * n + c] = T === Float32Array ? src.getFloat32(o, true) : T === Uint16Array ? src.getUint16(o, true) : T === Uint8Array ? src.getUint8(o) : T === Uint32Array ? src.getUint32(o, true) : T === Int16Array ? src.getInt16(o, true) : src.getInt8(o); } }
  if (a.normalized && T !== Float32Array) { const max = T === Uint8Array ? 255 : T === Uint16Array ? 65535 : T === Int8Array ? 127 : 32767; const f = new Float32Array(out.length); for (let k = 0; k < out.length; k++) f[k] = Math.max(out[k] / max, -1); return { data: f, n }; }
  return { data: out, n };
}
const ALIAS = { hips: ['hips', 'pelvis', 'mixamorig:hips'], spine: ['spine', 'mixamorig:spine'], chest: ['chest', 'spine2', 'mixamorig:spine2', 'upperchest'], neck: ['neck', 'mixamorig:neck'], head: ['head', 'mixamorig:head'],
  handR: ['handr', 'hand_r', 'righthand', 'mixamorig:righthand', 'hand.r'], handL: ['handl', 'hand_l', 'lefthand', 'mixamorig:lefthand', 'hand.l'] };
const CLIP_ALIAS = { idle: ['idle'], walk: ['walk', 'walking'], run: ['run', 'running', 'jog'], sprint: ['sprint', 'fastrun'], jump: ['jump'], fall: ['fall', 'falling'], land: ['land', 'landing'],
  crouchIdle: ['crouchidle', 'crouch'], crouchWalk: ['crouchwalk', 'sneak'], turn: ['turn'], swim: ['swim', 'swimming'], swimIdle: ['swimidle', 'treadwater'], climb: ['climb'], pickup: ['pickup', 'pick'],
  use: ['use', 'drink', 'eat'], chop: ['chop', 'axe'], mine: ['mine', 'pickaxe'], punch: ['punch'], punchL: ['punchl'], thrust: ['thrust', 'stab'], block: ['block'], hit: ['hit', 'hitreaction'], die: ['die', 'death'], sleep: ['sleep'] };
const FALLBACK = { sprint: 'run', run: 'walk', crouchIdle: 'idle', crouchWalk: 'walk', turn: 'idle', swimIdle: 'idle', swim: 'walk', fall: 'idle', jump: 'fall', land: 'idle', climb: 'jump', pickup: 'use', use: 'idle', chop: 'punch', mine: 'chop', punchL: 'punch', punch: 'idle', thrust: 'punch', block: 'idle', hit: 'idle', die: 'idle', sleep: 'die' };
const EVENTS = { pickup: [{ t: 0.5, name: 'grab' }], use: [{ t: 0.55, name: 'apply' }], chop: [{ t: 0.53, name: 'hit' }], mine: [{ t: 0.58, name: 'hit' }], punch: [{ t: 0.45, name: 'hit' }], punchL: [{ t: 0.45, name: 'hit' }], thrust: [{ t: 0.48, name: 'hit' }] };
const NONLOOP = new Set(['jump', 'land', 'climb', 'pickup', 'use', 'chop', 'mine', 'punch', 'punchL', 'thrust', 'hit', 'die']);

export async function loadGLBCharacter(renderer, buf) {
  const { json: g, bin } = parseGLB(buf); const nodes = g.nodes;
  const skinI = g.skins ? 0 : -1; if (skinI < 0) throw new Error('GLB sem esqueleto (skin)');
  const skin = g.skins[skinI]; let joints = skin.joints.slice();
  const parentOf = new Array(nodes.length).fill(-1); nodes.forEach((n, i) => (n.children || []).forEach((c) => (parentOf[c] = i)));
  // ordena juntas pai→filho
  const depth = (i) => { let d = 0; while (parentOf[i] >= 0) { i = parentOf[i]; d++; } return d; }; joints.sort((a, b) => depth(a) - depth(b));
  if (joints.length > MAX_BONES) throw new Error(`Esqueleto com ${joints.length} ossos (máx. ${MAX_BONES})`);
  const remap = skin.joints.map((j) => joints.indexOf(j)); const jIndex = new Map(joints.map((j, i) => [j, i]));
  const ibmRaw = skin.inverseBindMatrices !== undefined ? readAccessor(g, bin, skin.inverseBindMatrices).data : null;
  const ibm = new Float32Array(joints.length * 16); skin.joints.forEach((j, k) => { const m = ibmRaw ? ibmRaw.subarray(k * 16, k * 16 + 16) : mat4.create(); ibm.set(m, remap[k] * 16); });
  const lc = (s) => s.toLowerCase().replace(/\s/g, '');
  const bones = joints.map((j) => { const n = nodes[j]; let pos = n.translation || [0, 0, 0], rot = n.rotation || [0, 0, 0, 1], scale = n.scale || [1, 1, 1];
    return { name: n.name || 'j' + j, parent: jIndex.has(parentOf[j]) ? jIndex.get(parentOf[j]) : -1, pos: [...pos], rot: [...rot], scale: [...scale] }; });
  const skel = new Skeleton(bones, ibm);
  for (const [k, al] of Object.entries(ALIAS)) { const i = bones.findIndex((b) => al.includes(lc(b.name)) || lc(b.name).endsWith(':' + al[0]) || lc(b.name).endsWith(al[0])); if (i >= 0) skel.index[k] = i; }
  // transformação acumulada dos nós acima da raiz do esqueleto
  const worldOf = (i) => { const chain = []; while (i >= 0) { chain.unshift(i); i = parentOf[i]; } const m = mat4.create(); for (const k of chain) { const n = nodes[k]; const l = n.matrix ? new Float32Array(n.matrix) : mat4.fromTRS(mat4.create(), n.translation || [0, 0, 0], n.rotation || [0, 0, 0, 1], n.scale || [1, 1, 1]); mat4.mul(m, m, l); } return m; };
  const A = parentOf[joints[0]] >= 0 ? worldOf(parentOf[joints[0]]) : mat4.create();
  // malha com skin
  const meshNode = nodes.findIndex((n) => n.mesh !== undefined && n.skin === skinI);
  const prims = g.meshes[nodes[meshNode].mesh].primitives;
  const P = [], N = [], C = [], J = [], W = [], UV = [], I = []; let tex = null, hasUV = false;
  for (const pr of prims) {
    const at = pr.attributes; const base = P.length / 3; const pos = readAccessor(g, bin, at.POSITION).data; const cnt = pos.length / 3;
    const nrm = at.NORMAL !== undefined ? readAccessor(g, bin, at.NORMAL).data : new Float32Array(cnt * 3).fill(0).map((v, k) => (k % 3 === 1 ? 1 : 0));
    const mat = pr.material !== undefined ? g.materials[pr.material] : null; const bc = mat?.pbrMetallicRoughness?.baseColorFactor || [1, 1, 1, 1];
    const col = at.COLOR_0 !== undefined ? readAccessor(g, bin, at.COLOR_0) : null;
    const jn = readAccessor(g, bin, at.JOINTS_0).data, wt = readAccessor(g, bin, at.WEIGHTS_0).data;
    const uv = at.TEXCOORD_0 !== undefined ? readAccessor(g, bin, at.TEXCOORD_0).data : null; if (uv) hasUV = true;
    for (let k = 0; k < cnt; k++) {
      P.push(pos[k * 3], pos[k * 3 + 1], pos[k * 3 + 2]); N.push(nrm[k * 3], nrm[k * 3 + 1], nrm[k * 3 + 2]);
      if (col) { const n = col.n; C.push(Math.pow(col.data[k * n] * bc[0], 1 / 2.2), Math.pow(col.data[k * n + 1] * bc[1], 1 / 2.2), Math.pow(col.data[k * n + 2] * bc[2], 1 / 2.2), 1); }
      else C.push(Math.pow(bc[0], 1 / 2.2), Math.pow(bc[1], 1 / 2.2), Math.pow(bc[2], 1 / 2.2), 1);
      for (let c = 0; c < 4; c++) { J.push(remap[jn[k * 4 + c]] ?? 0); W.push(wt[k * 4 + c]); }
      UV.push(uv ? uv[k * 2] : 0, uv ? uv[k * 2 + 1] : 0);
    }
    if (pr.indices !== undefined) { for (const v of readAccessor(g, bin, pr.indices).data) I.push(v + base); } else for (let k = 0; k < cnt; k++) I.push(base + k);
    const ti = mat?.pbrMetallicRoughness?.baseColorTexture?.index;
    if (ti !== undefined && !tex && g.textures[ti].source !== undefined) { const img = g.images[g.textures[ti].source]; const bv = g.bufferViews[img.bufferView];
      try { const blob = new Blob([new Uint8Array(bin, bv.byteOffset || 0, bv.byteLength)], { type: img.mimeType }); tex = renderer.createTexture(await createImageBitmap(blob, { imageOrientation: 'none' })); } catch (e) { console.warn('Textura ignorada', e); } }
  }
  const data = { pos: new Float32Array(P), nrm: new Float32Array(N), col: new Float32Array(C), idx: I, joints: new Float32Array(J), weights: new Float32Array(W) };
  if (hasUV) data.uv = new Float32Array(UV);
  const mesh = renderer.createMesh(data);
  // normaliza altura para ~1,8 m com pés no chão
  const Mw = worldOf(meshNode); let minY = Infinity, maxY = -Infinity; for (let k = 0; k < P.length; k += 3) { const y = mat4.transformPoint(Mw, [P[k], P[k + 1], P[k + 2]])[1]; minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
  const fix = 1.8 / Math.max(0.01, maxY - minY);
  const offset = mat4.mul(mat4.create(), mat4.fromTRS(mat4.create(), [0, -minY * fix, 0], [0, 0, 0, 1], [fix, fix, fix]), A);
  // animações
  const raw = {};
  for (const an of g.animations || []) {
    let dur = 0; const clip = new Clip(an.name || 'anim', 1, true);
    for (const ch of an.channels) { const bi = jIndex.get(ch.target.node); if (bi === undefined) continue; const s = an.samplers[ch.sampler];
      const times = readAccessor(g, bin, s.input).data; let vals = readAccessor(g, bin, s.output).data; dur = Math.max(dur, times[times.length - 1]);
      const n = ch.target.path === 'rotation' ? 4 : 3;
      if (s.interpolation === 'CUBICSPLINE') { const v2 = new Float32Array(times.length * n); for (let k = 0; k < times.length; k++) for (let c = 0; c < n; c++) v2[k * n + c] = vals[k * n * 3 + n + c]; vals = v2; }
      if (ch.target.path === 'rotation') clip.tracks.set(bi, { times: new Float32Array(times), vals: new Float32Array(vals) });
      else if (ch.target.path === 'translation' && bi === 0) clip.posTracks.set(0, { times: new Float32Array(times), vals: new Float32Array(vals) }); }
    clip.duration = Math.max(dur, 0.05); raw[lc(clip.name)] = clip;
  }
  const clips = {};
  for (const [k, al] of Object.entries(CLIP_ALIAS)) { const f = al.map((a) => raw[a] || Object.entries(raw).find(([n]) => n.endsWith(a) || n.includes('|' + a))?.[1]).find(Boolean); if (f) { f.name = k; clips[k] = f; } }
  if (!clips.idle) { const first = Object.values(raw)[0]; if (!first) throw new Error('GLB sem animações'); clips.idle = first; }
  for (const k of Object.keys(CLIP_ALIAS)) { if (clips[k]) continue; let f = FALLBACK[k]; while (f && !clips[f]) f = FALLBACK[f]; clips[k] = clips[f] || clips.idle; }
  for (const [k, c] of Object.entries(clips)) { if (NONLOOP.has(k)) c.loop = false; if (EVENTS[k] && !c.events.length) c.events = EVENTS[k]; }
  clips.masks = { upper: maskFrom(skel, bones[skel.index.spine ?? 0].name) };
  return { skel, clips, mesh, tex, offset, toolScale: 1 / Math.hypot(offset[0], offset[1], offset[2]) };
}

// Se existir assets/models/player.glb no projeto, substitui o personagem provisório.
export async function loadModelOverride(game, manifestUrl) {
  let url = null;
  try { const m = await fetch(manifestUrl); if (!m.ok) return null; const j = await m.json(); if (!j.player) return null; url = new URL(j.player, new URL(manifestUrl, location.href)).href; } catch (e) { return null; }
  let res; try { res = await fetch(url); } catch (e) { return null; }
  if (!res.ok) { console.warn('Modelo não encontrado:', url); return null; }
  const buf = await res.arrayBuffer();
  try { const a = await loadGLBCharacter(game.renderer, buf); game.playerAssets = a; game.modelSource = url; console.info('Modelo GLB carregado:', url); return a; }
  catch (e) { console.warn('Falha ao carregar GLB, usando modelo provisório:', e.message); return null; }
}
