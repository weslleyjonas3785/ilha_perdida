// Atlas de folhagem gerado proceduralmente em canvas (sem arquivos externos): aglomerados de folhas
// de carvalho e bétula, ramos de pinheiro com agulhas, tufos de grama, grama com flores e folha de palmeira.
// Cada região tem canal alfa recortado (alpha-test) e é usada em "cartões" 3D com normais esféricas.
import { rng } from '../engine/math.js';

export const ATLAS = {
  oak: [0, 0, 0.5, 0.5], birch: [0.5, 0, 1, 0.5],
  pine: [0, 0.5, 0.25, 1], grass: [0.25, 0.5, 0.5, 0.75], flowers: [0.25, 0.75, 0.5, 1],
  palm: [0.5, 0.5, 0.75, 1], fern: [0.75, 0.5, 0.94, 0.94],
};
export const UV_SOLID = [0.97, 0.97];

const hsl = (h, s, l, a = 1) => `hsla(${h},${s}%,${l}%,${a})`;

function leaf(ctx, x, y, len, wid, ang, col, rib) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
  ctx.beginPath(); ctx.moveTo(0, 0);
  ctx.bezierCurveTo(wid, len * 0.25, wid * 0.9, len * 0.75, 0, len);
  ctx.bezierCurveTo(-wid * 0.9, len * 0.75, -wid, len * 0.25, 0, 0);
  ctx.fillStyle = col; ctx.fill();
  if (rib) { ctx.strokeStyle = rib; ctx.lineWidth = Math.max(0.6, wid * 0.12); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, len * 0.92); ctx.stroke(); }
  ctx.restore();
}

function cluster(ctx, X, Y, W, H, seed, opts) {
  const r = rng(seed); const cx = X + W / 2, cy = Y + H / 2;
  // ramos finos
  ctx.strokeStyle = 'rgb(70,52,36)'; ctx.lineCap = 'round';
  for (let i = 0; i < opts.twigs; i++) {
    const a = r() * Math.PI * 2; ctx.lineWidth = 2 + r() * 3; ctx.beginPath(); ctx.moveTo(cx, cy + H * 0.35);
    ctx.quadraticCurveTo(cx + Math.cos(a) * W * 0.2, cy + Math.sin(a) * H * 0.2, cx + Math.cos(a) * W * 0.42, cy + Math.sin(a) * H * 0.42); ctx.stroke();
  }
  // folhas em camadas: escuras atrás, claras na frente
  for (let layer = 0; layer < 3; layer++) {
    for (let i = 0; i < opts.n; i++) {
      const a = r() * Math.PI * 2, d = Math.sqrt(r()) * W * 0.44;
      const x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d * (H / W);
      const L = opts.len * (0.75 + r() * 0.5); const h = opts.hue + (r() - 0.5) * 14;
      const l = opts.light + layer * 7 + (r() - 0.5) * 10 - (d / W) * 6;
      leaf(ctx, x, y, L, L * opts.wid, a + Math.PI / 2 + (r() - 0.5) * 1.2, hsl(h, opts.sat, l), hsl(h, opts.sat - 10, l + 10, 0.5));
    }
  }
}

function pineBranch(ctx, X, Y, W, H, seed) {
  const r = rng(seed); const cx = X + W / 2;
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgb(66,48,34)'; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(cx, Y + H); ctx.lineTo(cx, Y + 8); ctx.stroke();
  for (let s = 0; s < 3; s++) for (let i = 0; i < 260; i++) {
    const t = r(); const y = Y + H - t * (H - 10); const side = r() < 0.5 ? -1 : 1;
    const len = (W * 0.45) * (1 - t * 0.55) * (0.6 + r() * 0.5);
    const sx = cx + side * (r() * len * 0.25);
    const ang = side * (0.5 + r() * 0.7);
    ctx.strokeStyle = hsl(118 + (r() - 0.5) * 18, 34, 17 + s * 6 + r() * 8); ctx.lineWidth = 1.6 + r();
    ctx.beginPath(); ctx.moveTo(sx, y); ctx.lineTo(sx + Math.sin(ang) * len, y - Math.cos(ang) * len * 0.55); ctx.stroke();
  }
}

function grassTuft(ctx, X, Y, W, H, seed, flowers) {
  const r = rng(seed);
  for (let i = 0; i < 90; i++) {
    const u = (r() + r() + r()) / 3; const x = X + W * (0.06 + u * 0.88); const mid = 1 - Math.abs(u - 0.5) * 1.7;
    const h = H * (0.2 + mid * 0.55 + r() * 0.25) * (r() < 0.15 ? 0.5 : 1), bend = (u - 0.5) * W * 0.5 + (r() - 0.5) * W * 0.2, w = 2 + r() * 3;
    const g = ctx.createLinearGradient(0, Y + H, 0, Y + H - h);
    const hue = 80 + (r() - 0.5) * 22; g.addColorStop(0, hsl(hue, 38, 22)); g.addColorStop(0.5, hsl(hue, 45, 34 + r() * 10)); g.addColorStop(1, hsl(hue - 12, 42, 50 + r() * 10));
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x - w, Y + H); ctx.quadraticCurveTo(x + bend * 0.3, Y + H - h * 0.6, x + bend, Y + H - h); ctx.quadraticCurveTo(x + bend * 0.3 + w * 0.3, Y + H - h * 0.6, x + w, Y + H); ctx.fill();
  }
  if (flowers) {
    const cols = [[50, 85, 60], [345, 70, 62], [0, 0, 96], [270, 50, 66]];
    for (let i = 0; i < 9; i++) {
      const x = X + W * (0.12 + r() * 0.76), y = Y + H * (0.1 + r() * 0.35); const c = cols[i % 4];
      ctx.strokeStyle = hsl(95, 40, 25); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, Y + H); ctx.lineTo(x, y); ctx.stroke();
      for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; ctx.fillStyle = hsl(c[0], c[1], c[2] - r() * 8); ctx.beginPath(); ctx.ellipse(x + Math.cos(a) * 6, y + Math.sin(a) * 6, 6, 3.5, a, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = hsl(42, 90, 45); ctx.beginPath(); ctx.arc(x, y, 3.5, 0, Math.PI * 2); ctx.fill();
    }
  }
}

function palmFrond(ctx, X, Y, W, H, seed) {
  const r = rng(seed); const cx = X + W / 2;
  ctx.strokeStyle = 'rgb(96,104,52)'; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(cx, Y + H); ctx.lineTo(cx, Y + 6); ctx.stroke();
  for (let i = 0; i < 46; i++) {
    const t = i / 46; const y = Y + H - 20 - t * (H - 40);
    const len = W * 0.46 * Math.sin(Math.PI * (0.15 + t * 0.85)) + 6;
    for (const side of [-1, 1]) {
      ctx.strokeStyle = hsl(95 + (r() - 0.5) * 12, 42, 26 + r() * 14); ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(cx, y); ctx.quadraticCurveTo(cx + side * len * 0.5, y - 10, cx + side * len, y - 26 - r() * 10); ctx.stroke();
    }
  }
}

function fern(ctx, X, Y, W, H, seed) {
  const r = rng(seed); const cx = X + W / 2;
  for (let f = 0; f < 5; f++) {
    const a = (f - 2) * 0.35; ctx.save(); ctx.translate(cx, Y + H); ctx.rotate(a);
    const L = H * (0.75 + r() * 0.2);
    ctx.strokeStyle = 'rgb(60,80,30)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -L); ctx.stroke();
    for (let i = 0; i < 22; i++) { const t = i / 22, y = -L * (0.1 + t * 0.88), l = W * 0.2 * Math.sin(Math.PI * (0.2 + t * 0.8));
      for (const s of [-1, 1]) leaf(ctx, 0, y, l, 0.28, s * (Math.PI / 2 + 0.35), hsl(100 + (r() - 0.5) * 10, 45, 24 + r() * 12)); }
    ctx.restore();
  }
}

// Gera o atlas (1024x1024). Fundo com a cor média da folhagem e alfa 0 evita halos escuros nos mipmaps.
export function makeFoliageAtlas() {
  const S = 1024; const c = document.createElement('canvas'); c.width = c.height = S; const ctx = c.getContext('2d');
  const R = (k) => ATLAS[k].map((v) => v * S);
  const reg = (k, fill) => { const [x0, y0, x1, y1] = R(k); ctx.save(); ctx.beginPath(); ctx.rect(x0, y0, x1 - x0, y1 - y0); ctx.clip(); fill(x0, y0, x1 - x0, y1 - y0); ctx.restore(); };
  reg('oak', (x, y, w, h) => cluster(ctx, x, y, w, h, 11, { n: 150, len: 30, wid: 0.42, hue: 98, sat: 42, light: 20, twigs: 9 }));
  reg('birch', (x, y, w, h) => cluster(ctx, x, y, w, h, 23, { n: 190, len: 22, wid: 0.55, hue: 78, sat: 50, light: 30, twigs: 12 }));
  reg('pine', (x, y, w, h) => pineBranch(ctx, x, y, w, h, 5));
  reg('grass', (x, y, w, h) => grassTuft(ctx, x, y, w, h, 7, false));
  reg('flowers', (x, y, w, h) => grassTuft(ctx, x, y, w, h, 9, true));
  reg('palm', (x, y, w, h) => palmFrond(ctx, x, y, w, h, 3));
  reg('fern', (x, y, w, h) => fern(ctx, x, y, w, h, 4));
  // região sólida branca (tronco, frutos, caules): o shader usa a cor do vértice
  ctx.fillStyle = '#fff'; ctx.fillRect(S * 0.95, S * 0.95, S * 0.05, S * 0.05);
  // sangra a cor para pixels transparentes (evita borda escura com mipmaps)
  const img = ctx.getImageData(0, 0, S, S), d = img.data;
  // 1) pixels transparentes recebem a cor média opaca da região (mipmaps distantes sem halo escuro)
  for (const k of Object.keys(ATLAS)) { const [x0, y0, x1, y1] = ATLAS[k].map((v) => Math.round(v * S)); let sr = 0, sg = 0, sb = 0, n = 0;
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const i = (y * S + x) * 4; if (d[i + 3] > 128) { sr += d[i]; sg += d[i + 1]; sb += d[i + 2]; n++; } }
    if (!n) continue; sr /= n; sg /= n; sb /= n;
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const i = (y * S + x) * 4; if (d[i + 3] === 0) { d[i] = sr; d[i + 1] = sg; d[i + 2] = sb; } } }
  for (let pass = 0; pass < 2; pass++) for (let y = 1; y < S - 1; y++) for (let x = 1; x < S - 1; x++) {
    const i = (y * S + x) * 4; if (d[i + 3] > 0 && d[i + 3] !== 1) continue; if (d[i + 3] === 1) continue;
    for (const o of [-4, 4, -S * 4, S * 4]) { const j = i + o; if (d[j + 3] > 100) { d[i] = d[j]; d[i + 1] = d[j + 1]; d[i + 2] = d[j + 2]; d[i + 3] = 1; break; } }
  }
  for (let i = 3; i < d.length; i += 4) if (d[i] === 1) d[i] = 0;
  return img; // ImageData não-premultiplicado: enviado direto à GPU, preservando a cor sangrada

}
