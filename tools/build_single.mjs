// Gera um único arquivo HTML com o jogo inteiro (código, estilo, ícones e sons embutidos),
// para sites que só aceitam "um arquivo .html". Uso: node tools/build_single.mjs [saida.html]
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url'; import { createRequire } from 'module';
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url))); const OUT = process.argv[2] || path.join(ROOT, 'dist', 'ilha_perdida.html');
const require = createRequire(import.meta.url); let esbuild;
for (const p of ['esbuild', '/opt/npm-tools/node_modules/esbuild']) { try { esbuild = require(p); break; } catch (e) { /* tenta o próximo */ } }
if (!esbuild) { console.error('Precisa do esbuild (npm i -D esbuild)'); process.exit(1); }

const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.json': 'application/json', '.glb': 'model/gltf-binary' };
const SKIP = new Set(['assets/models/reference_player.glb']); // modelo de referência não usado pelo jogo
const assets = {}; let raw = 0;
(function walk(dir) { for (const f of fs.readdirSync(path.join(ROOT, dir))) { const rel = dir + '/' + f, abs = path.join(ROOT, rel); if (fs.statSync(abs).isDirectory()) walk(rel); else if (!SKIP.has(rel) && MIME[path.extname(f).toLowerCase()]) { const b = fs.readFileSync(abs); raw += b.length; assets[rel] = `data:${MIME[path.extname(f).toLowerCase()]};base64,${b.toString('base64')}`; } } })('assets');

const res = await esbuild.build({ entryPoints: [path.join(ROOT, 'src/main.js')], bundle: true, format: 'iife', minify: true, write: false, target: 'es2020', legalComments: 'none' });
const js = res.outputFiles[0].text;
// os arquivos de "assets/..." passam a vir de dentro do próprio HTML (fetch, <img src>, innerHTML)
const shim = `(()=>{const A=window.__ASSETS=${JSON.stringify(assets)};
const key=(u)=>{if(u&&typeof u!=='string')u=u.url||String(u);if(typeof u!=='string')return null;const i=u.indexOf('assets/');if(i<0)return null;const k=u.slice(i).split(/[?#]/)[0];return k;};
const of=window.fetch.bind(window);window.fetch=(u,o)=>{const k=key(u);if(k){const d=A[k];if(!d)return Promise.resolve(new Response('',{status:404,statusText:'Not Found'}));return of(d);}return of(u,o);};
const rx=/(?:\\.\\/)?assets\\/[\\w\\/.\\-]+\\.(?:png|jpe?g|webp|svg)/g;const sub=(s)=>typeof s==='string'&&s.indexOf('assets/')>=0?s.replace(rx,(m)=>A[m.replace(/^\\.\\//,'')]||m):s;
const d=Object.getOwnPropertyDescriptor(Element.prototype,'innerHTML');Object.defineProperty(Element.prototype,'innerHTML',{configurable:true,enumerable:d.enumerable,get(){return d.get.call(this);},set(v){d.set.call(this,sub(v));}});
const ia=Element.prototype.insertAdjacentHTML;Element.prototype.insertAdjacentHTML=function(p,h){return ia.call(this,p,sub(h));};
const sa=Element.prototype.setAttribute;Element.prototype.setAttribute=function(n,v){return sa.call(this,n,(n==='src'||n==='href'||n==='style')?sub(v):v);};
const ds=Object.getOwnPropertyDescriptor(HTMLImageElement.prototype,'src');Object.defineProperty(HTMLImageElement.prototype,'src',{configurable:true,enumerable:ds.enumerable,get(){return ds.get.call(this);},set(v){ds.set.call(this,sub(v));}});
})();`;
let html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8'); const css = fs.readFileSync(path.join(ROOT, 'style.css'), 'utf8');
const safe = (s) => s.replace(/<\/script/gi, '<\\/script');
html = html.replace(/<link rel="stylesheet" href="style\.css">/, () => `<style>\n${css.replace(/url\((['"]?)(?:\.\/)?(assets\/[^'")]+)\1\)/g, (m, q, p) => (assets[p] ? `url("${assets[p]}")` : m))}\n</style>`);
html = html.replace(/<script type="module" src="src\/main\.js"><\/script>/, () => `<script>${safe(shim)}</script>\n<script>${safe(js)}</script>`);
if (html.includes('src/main.js')) { console.error('Não achei a tag do script principal no index.html'); process.exit(1); }
fs.mkdirSync(path.dirname(OUT), { recursive: true }); fs.writeFileSync(OUT, html);
console.log(`OK: ${OUT} — ${(fs.statSync(OUT).size / 1048576).toFixed(2)} MB (código ${(js.length / 1048576).toFixed(2)} MB, ${Object.keys(assets).length} arquivos embutidos, ${(raw / 1048576).toFixed(2)} MB originais)`);
