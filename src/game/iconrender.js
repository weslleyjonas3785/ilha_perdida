// Desenho de ícones a partir dos modelos 3D (canvas 2D, low-poly com sombreamento por face, contorno escuro e sombra).
// Usado pela ferramenta tools/gun_icons.py e, em tempo real, pela tela "Verificar" (arma com acessórios).
import { mat4 } from '../engine/math.js';

// junta várias malhas (cada uma com sua matriz) numa só
export function mergeMeshes(list) {
  let nv = 0, ni = 0; for (const [m] of list) { nv += m.pos.length / 3; ni += m.idx.length; }
  const pos = new Float32Array(nv * 3), col = new Float32Array(nv * 4), idx = new Uint32Array(ni); let v = 0, k = 0;
  for (const [m, T] of list) { const n = m.pos.length / 3; for (let i = 0; i < n; i++) { const p = T ? mat4.transformPoint(T, [m.pos[i * 3], m.pos[i * 3 + 1], m.pos[i * 3 + 2]]) : [m.pos[i * 3], m.pos[i * 3 + 1], m.pos[i * 3 + 2]]; pos.set(p, (v + i) * 3); for (let c = 0; c < 4; c++) col[(v + i) * 4 + c] = m.col[i * 4 + c]; }
    for (let i = 0; i < m.idx.length; i++) idx[k++] = m.idx[i] + v; v += n; }
  return { pos, col, idx };
}

// o: { kind: 'gun'|'tool', N, fit, w, h, axis } — 'axis' força o eixo comprido (para que várias variantes fiquem na mesma escala)
export function meshIcon(m, o = {}) {
  const kind = o.kind || 'gun', W = o.w || o.N || 256, H = o.h || o.N || 256, fit = o.fit || 0.93; const pos = m.pos, col = m.col, idx = m.idx; const nv = pos.length / 3;
  let ax = o.axis; if (!ax) { const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9]; for (let i = 0; i < nv; i++) for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], pos[i * 3 + k]); mx[k] = Math.max(mx[k], pos[i * 3 + k]); }
    const ext = [mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]]; ax = ext[1] > ext[2] && ext[1] > ext[0] ? [0, 1, 0] : ext[0] > ext[2] ? [1, 0, 0] : [0, 0, 1]; }
  const tilt = kind === 'tool' ? 0.8 : -0.1, yaw = 0.42, pitch = 0.32;
  const toView = (x, y, z) => { const p = ax[1] ? [y, -x, z] : ax[0] ? [x, y, z] : [z, y, -x]; let [a, b, c] = p; [a, b] = [a * Math.cos(tilt) - b * Math.sin(tilt), a * Math.sin(tilt) + b * Math.cos(tilt)];
    [a, c] = [a * Math.cos(yaw) - c * Math.sin(yaw), a * Math.sin(yaw) + c * Math.cos(yaw)]; [b, c] = [b * Math.cos(pitch) - c * Math.sin(pitch), b * Math.sin(pitch) + c * Math.cos(pitch)]; return [a, b, c]; };
  const V = []; let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; for (let i = 0; i < nv; i++) { const v = toView(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]); V.push(v); x0 = Math.min(x0, v[0]); x1 = Math.max(x1, v[0]); y0 = Math.min(y0, v[1]); y1 = Math.max(y1, v[1]); }
  if (o.frame) { [x0, x1, y0, y1] = o.frame; } // enquadramento fixo (mesma escala entre variantes)
  const sc = Math.min((W * fit) / (x1 - x0), (H * fit) / (y1 - y0)), cx = (x0 + x1) / 2, cy = (y0 + y1) / 2; const scr = (v) => [W / 2 + (v[0] - cx) * sc, H / 2 - (v[1] - cy) * sc];
  const tris = []; const L = (() => { const l = [0.35, 0.8, 0.55]; const n = Math.hypot(...l); return l.map((q) => q / n); })();
  for (let t = 0; t < idx.length; t += 3) { const a = V[idx[t]], b = V[idx[t + 1]], c = V[idx[t + 2]];
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], w = [c[0] - a[0], c[1] - a[1], c[2] - a[2]]; let n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]]; const nl = Math.hypot(...n) || 1; n = n.map((q) => q / nl);
    if (n[2] < -0.02) continue;
    const k = idx[t] * 4; const base = [col[k], col[k + 1], col[k + 2]]; const metal = col[k + 3] < 0.6;
    const dif = Math.max(0, n[0] * L[0] + n[1] * L[1] + n[2] * L[2]); const lum = 0.42 + 0.7 * dif; const spec = metal ? Math.pow(Math.max(0, n[1] * 0.6 + n[2] * 0.8), 18) * 0.35 : 0;
    const c3 = base.map((q) => Math.min(255, Math.round((q * lum + spec) * 255)));
    tris.push({ z: (a[2] + b[2] + c[2]) / 3, p: [scr(a), scr(b), scr(c)], c: `rgb(${c3[0]},${c3[1]},${c3[2]})` }); }
  tris.sort((p, q) => p.z - q.z);
  const cv = o.canvas || document.createElement('canvas'); cv.width = W; cv.height = H; const x = cv.getContext('2d'); x.clearRect(0, 0, W, H);
  const draw = (ctx, fill) => { for (const t of tris) { ctx.beginPath(); ctx.moveTo(...t.p[0]); ctx.lineTo(...t.p[1]); ctx.lineTo(...t.p[2]); ctx.closePath(); ctx.fillStyle = fill || t.c; ctx.strokeStyle = fill || t.c; ctx.lineWidth = 0.8; ctx.fill(); ctx.stroke(); } };
  const sil = document.createElement('canvas'); sil.width = W; sil.height = H; draw(sil.getContext('2d'), '#000');
  x.save(); x.shadowColor = 'rgba(0,0,0,0.55)'; x.shadowBlur = 8; x.shadowOffsetY = 4; for (const [dx, dy] of [[-2, 0], [2, 0], [0, -2], [0, 2], [-1.5, -1.5], [1.5, 1.5], [-1.5, 1.5], [1.5, -1.5]]) x.drawImage(sil, dx, dy); x.restore();
  x.drawImage(sil, 0, 0); draw(x);
  cv.frame = [x0, x1, y0, y1]; cv.axis = ax; return cv;
}
// enquadramento (em coordenadas de vista) de uma malha, para fixar a escala entre variantes
export function meshFrame(m, kind = 'gun') { const cv = meshIcon(m, { kind, N: 8 }); return { frame: cv.frame, axis: cv.axis }; }
