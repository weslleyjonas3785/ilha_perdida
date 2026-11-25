# Gera os ícones das armas e ferramentas (assets/icons/gun_<id>.png e tool_<id>.png) a partir dos próprios modelos 3D do jogo.
# Renderização em canvas 2D (low-poly, sombreamento por face, contorno escuro e sombra). Uso: servidor em :8765 e
#   python3 tools/gun_icons.py
import base64, json, os, sys
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); OUT = os.path.join(ROOT, 'assets', 'icons')
JS = r"""
async () => {
  const W = await import('/src/game/weapons.js'); const P = await import('/src/game/props.js'); const S = await import('/src/game/struct.js'); const MX = await import('/src/game/machines.js');
  const { ITEMS } = await import('/src/game/items.js');
  const jobs = [];
  for (const id of Object.keys(W.GUNS)) if (ITEMS[id] && !ITEMS[id].img) jobs.push(['gun_' + id, W.gunMesh(id), 'gun']);
  for (const id of ['axe', 'scrapaxe', 'pickaxe', 'spear', 'scrapspear', 'shockspear', 'knife', 'scrapknife', 'torch']) if (ITEMS[id] && !ITEMS[id].img) jobs.push(['tool_' + id, P.toolMesh(id), 'tool']);
  if (ITEMS.hammer && !ITEMS.hammer.img) jobs.push(['tool_hammer', S.hammerMesh(), 'tool']);
  if (ITEMS.c4 && !ITEMS.c4.img) jobs.push(['tool_c4', MX.c4Mesh(), 'gun']);
  const N = 256, out = {};
  for (const [name, m, kind] of jobs) {
    const pos = m.pos, col = m.col, idx = m.idx; const nv = pos.length / 3;
    // ferramentas são modeladas em pé (cabo no eixo Y); armas apontam para +Z
    let ax = [0, 0, 1]; { let mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9]; for (let i = 0; i < nv; i++) for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], pos[i * 3 + k]); mx[k] = Math.max(mx[k], pos[i * 3 + k]); }
      const ext = [mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]]; ax = ext[1] > ext[2] && ext[1] > ext[0] ? [0, 1, 0] : ext[0] > ext[2] ? [1, 0, 0] : [0, 0, 1]; }
    // vista lateral 3/4: o eixo comprido vai para a direita, inclinado; câmera um pouco acima e à esquerda
    const tilt = kind === 'tool' ? 0.8 : -0.1, yaw = 0.42, pitch = 0.32;
    const toView = (x, y, z) => { // gira o eixo comprido para +X da tela
      let p = ax[1] ? [y, -x, z] : ax[0] ? [x, y, z] : [z, y, -x];
      if (kind === 'tool') p = [p[0], p[1], p[2]];
      // inclinação no plano da tela
      let [a, b, c] = p; [a, b] = [a * Math.cos(tilt) - b * Math.sin(tilt), a * Math.sin(tilt) + b * Math.cos(tilt)];
      // vira um pouco para mostrar a lateral e o topo
      [a, c] = [a * Math.cos(yaw) - c * Math.sin(yaw), a * Math.sin(yaw) + c * Math.cos(yaw)]; [b, c] = [b * Math.cos(pitch) - c * Math.sin(pitch), b * Math.sin(pitch) + c * Math.cos(pitch)];
      return [a, b, c]; };
    const V = []; let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; for (let i = 0; i < nv; i++) { const v = toView(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]); V.push(v); x0 = Math.min(x0, v[0]); x1 = Math.max(x1, v[0]); y0 = Math.min(y0, v[1]); y1 = Math.max(y1, v[1]); }
    const sc = (N * 0.93) / Math.max(x1 - x0, y1 - y0), cx = (x0 + x1) / 2, cy = (y0 + y1) / 2; const scr = (v) => [N / 2 + (v[0] - cx) * sc, N / 2 - (v[1] - cy) * sc];
    const tris = []; const L = (() => { const l = [0.35, 0.8, 0.55]; const n = Math.hypot(...l); return l.map((q) => q / n); })();
    for (let t = 0; t < idx.length; t += 3) { const a = V[idx[t]], b = V[idx[t + 1]], c = V[idx[t + 2]];
      const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], w = [c[0] - a[0], c[1] - a[1], c[2] - a[2]]; let n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]]; const nl = Math.hypot(...n) || 1; n = n.map((q) => q / nl);
      if (n[2] < -0.02) continue; // de costas para a câmera (vista de +Z)
      const k = idx[t] * 4; const base = [col[k], col[k + 1], col[k + 2]]; const metal = col[k + 3] < 0.6;
      const dif = Math.max(0, n[0] * L[0] + n[1] * L[1] + n[2] * L[2]); const lum = 0.42 + 0.7 * dif; const spec = metal ? Math.pow(Math.max(0, n[1] * 0.6 + n[2] * 0.8), 18) * 0.35 : 0;
      const c3 = base.map((q) => Math.min(255, Math.round((q * lum + spec) * 255)));
      tris.push({ z: (a[2] + b[2] + c[2]) / 3, p: [scr(a), scr(b), scr(c)], c: `rgb(${c3[0]},${c3[1]},${c3[2]})` }); }
    tris.sort((p, q) => p.z - q.z);
    const cv = document.createElement('canvas'); cv.width = cv.height = N; const x = cv.getContext('2d');
    const draw = (ctx, fill) => { for (const t of tris) { ctx.beginPath(); ctx.moveTo(...t.p[0]); ctx.lineTo(...t.p[1]); ctx.lineTo(...t.p[2]); ctx.closePath(); ctx.fillStyle = fill || t.c; ctx.strokeStyle = fill || t.c; ctx.lineWidth = 0.8; ctx.fill(); ctx.stroke(); } };
    // contorno escuro (silhueta engrossada) + sombra + arma
    const sil = document.createElement('canvas'); sil.width = sil.height = N; draw(sil.getContext('2d'), '#000');
    x.save(); x.shadowColor = 'rgba(0,0,0,0.55)'; x.shadowBlur = 8; x.shadowOffsetY = 4; for (const [dx, dy] of [[-2, 0], [2, 0], [0, -2], [0, 2], [-1.5, -1.5], [1.5, 1.5], [-1.5, 1.5], [1.5, -1.5]]) x.drawImage(sil, dx, dy); x.restore();
    x.globalAlpha = 1; x.fillStyle = 'rgba(16,16,18,1)'; x.drawImage(sil, 0, 0); draw(x);
    out[name] = cv.toDataURL('image/png');
  }
  return out;
}
"""
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(); pg.goto("http://localhost:8765/package.json"); pg.wait_for_timeout(500)
    res = pg.evaluate(JS); b.close()
for name, url in res.items():
    with open(os.path.join(OUT, name + '.png'), 'wb') as f: f.write(base64.b64decode(url.split(',')[1]))
print(json.dumps(sorted(res.keys())))
