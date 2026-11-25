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
  const IR = await import('/src/game/iconrender.js');
  for (const id of ['scope4', 'scope8']) jobs.push(['att_' + id, W.scopeMesh(id), 'gun']);
  for (const id of Object.keys(W.MAGS)) jobs.push(['att_' + id, W.magItemMesh(id), 'gun']);
  for (const id of Object.keys(W.SILS)) jobs.push(['att_' + id, W.silencerMesh(id), 'gun']);
  const only = (window.__ONLY || null); const out = {};
  for (const [name, m, kind] of jobs) { if (only && !name.startsWith(only)) continue; out[name] = IR.meshIcon(m, { kind, N: 256, axis: name.startsWith('att_mag') ? [0, 0, 1] : undefined, fit: name.startsWith('att_mag') ? 0.8 : 0.93 }).toDataURL('image/png'); }
  return out;
}
"""
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(); pg.goto("http://localhost:8765/package.json"); pg.wait_for_timeout(500)
    if len(sys.argv) > 1: pg.evaluate("(o) => { window.__ONLY = o; }", sys.argv[1])
    res = pg.evaluate(JS); b.close()
for name, url in res.items():
    with open(os.path.join(OUT, name + '.png'), 'wb') as f: f.write(base64.b64decode(url.split(',')[1]))
print(json.dumps(sorted(res.keys())))
