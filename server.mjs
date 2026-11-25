// Servidor do mundo multiplayer da Ilha Perdida (sem dependências: só o Node.js).
// O dono do mundo roda este arquivo (dois cliques em "Hospedar mundo.bat"). Ele:
//  • serve o jogo em http://SEU-IP:8790 (os amigos abrem por aqui ou colam o IP no jogo);
//  • faz a ponte entre os jogadores (WebSocket em /mp): o navegador do dono é quem roda o mundo
//    (robôs, NPCs, loot) e os outros recebem as atualizações;
//  • /mp/info mostra o nome do mundo, quantos jogadores e se tem senha (para o botão "Buscar").
// Funciona em rede local ou por VPN (Radmin VPN, Hamachi, ZeroTier…): é só usar o IP da VPN.
import http from 'http'; import fs from 'fs'; import path from 'path'; import crypto from 'crypto'; import os from 'os'; import { exec } from 'child_process'; import { fileURLToPath } from 'url';
const PORT = +(process.env.PORT || process.argv[2] || 8790), ROOT = path.dirname(fileURLToPath(import.meta.url)), VERSION = 1;
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.ico': 'image/x-icon', '.md': 'text/plain; charset=utf-8', '.txt': 'text/plain; charset=utf-8' };

let world = null; // { name, pass } definido pelo dono ao abrir o mundo
let host = null; const peers = new Map(); let nextId = 2;
const isLocal = (s) => { const a = (s.remoteAddress || '').replace('::ffff:', ''); return a === '127.0.0.1' || a === '::1'; };

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x'); res.setHeader('Access-Control-Allow-Origin', '*');
  if (url.pathname === '/mp/info') { res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    return res.end(JSON.stringify({ ok: true, game: 'ilha_perdida', version: VERSION, open: !!host, name: world ? world.name : null, pass: !!(world && world.pass), players: host ? 1 + peers.size : 0, names: host ? [host.name, ...[...peers.values()].map((p) => p.name)] : [] })); }
  let p = decodeURIComponent(url.pathname); if (p === '/') p = '/index.html';
  const file = path.normalize(path.join(ROOT, p)); if (!file.startsWith(ROOT) || /server\.m?js$|\.bat$|\.sh$/.test(file)) { res.writeHead(403); return res.end('proibido'); }
  fs.stat(file, (e, st) => { if (e || !st.isFile()) { res.writeHead(404); return res.end('não encontrado'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Content-Length': st.size, 'Cache-Control': 'no-cache' }); fs.createReadStream(file).pipe(res); });
});

// ---------- WebSocket mínimo (RFC 6455) ----------
function wsAccept(req, sock) {
  const key = req.headers['sec-websocket-key']; if (!key) return sock.destroy();
  const acc = crypto.createHash('sha1').update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  sock.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${acc}\r\n\r\n`); sock.setNoDelay(true);
  const c = { sock, buf: Buffer.alloc(0), frag: [], id: 0, name: '?', alive: true, local: isLocal(sock) };
  sock.on('data', (d) => { c.buf = Buffer.concat([c.buf, d]); parse(c); }); sock.on('close', () => drop(c)); sock.on('error', () => drop(c));
}
function parse(c) {
  for (;;) { const b = c.buf; if (b.length < 2) return; const fin = b[0] & 0x80, op = b[0] & 0x0f, masked = b[1] & 0x80; let len = b[1] & 0x7f, off = 2;
    if (len === 126) { if (b.length < 4) return; len = b.readUInt16BE(2); off = 4; } else if (len === 127) { if (b.length < 10) return; len = Number(b.readBigUInt64BE(2)); off = 10; }
    if (len > 64 * 1024 * 1024) return c.sock.destroy(); const mlen = masked ? 4 : 0; if (b.length < off + mlen + len) return;
    let data = b.subarray(off + mlen, off + mlen + len); if (masked) { const m = b.subarray(off, off + 4); data = Buffer.from(data); for (let i = 0; i < data.length; i++) data[i] ^= m[i & 3]; }
    c.buf = b.subarray(off + mlen + len);
    if (op === 8) { send(c, null, 8); return c.sock.end(); } if (op === 9) { send(c, data, 10); continue; } if (op === 10) continue;
    if (op === 1 || op === 2) c.frag = [data]; else if (op === 0) c.frag.push(data); if (!fin) continue;
    const msg = Buffer.concat(c.frag).toString('utf8'); c.frag = []; let o; try { o = JSON.parse(msg); } catch (e) { continue; } onMsg(c, o, msg); }
}
function send(c, data, op = 1) {
  if (!c || c.sock.destroyed) return; const p = data === null ? Buffer.alloc(0) : Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf8'); let h;
  if (p.length < 126) { h = Buffer.from([0x80 | op, p.length]); } else if (p.length < 65536) { h = Buffer.alloc(4); h[0] = 0x80 | op; h[1] = 126; h.writeUInt16BE(p.length, 2); } else { h = Buffer.alloc(10); h[0] = 0x80 | op; h[1] = 127; h.writeBigUInt64BE(BigInt(p.length), 2); }
  c.sock.write(Buffer.concat([h, p]));
}
const sendJ = (c, o) => send(c, JSON.stringify(o));
function drop(c) {
  if (!c.alive) return; c.alive = false; try { c.sock.destroy(); } catch (e) { /* já fechado */ }
  if (c === host) { host = null; world = null; for (const p of peers.values()) { sendJ(p, { t: 'hostgone' }); p.sock.end(); } peers.clear(); console.log('O dono saiu — mundo fechado.'); return; }
  if (peers.delete(c.id)) { console.log(`${c.name} saiu.`); const m = JSON.stringify({ t: 'leave', from: c.id }); if (host) send(host, m); for (const p of peers.values()) send(p, m); }
}
function onMsg(c, o, raw) {
  if (!c.id) { // primeira mensagem: quem é
    if (o.t !== 'hello') return c.sock.end();
    if (o.role === 'host') { if (!c.local) { sendJ(c, { t: 'denied', why: 'Só o computador que roda o servidor pode hospedar.' }); return c.sock.end(); } if (host) { sendJ(c, { t: 'denied', why: 'Este servidor já tem um mundo aberto.' }); return c.sock.end(); }
      c.id = 1; c.name = String(o.name || 'Dono').slice(0, 24); host = c; world = { name: String((o.world && o.world.name) || 'Mundo').slice(0, 40), pass: String((o.world && o.world.pass) || '') }; sendJ(c, { t: 'welcome', id: 1, host: true }); console.log(`Mundo "${world.name}" aberto${world.pass ? ' (com senha)' : ''}.`); return; }
    if (!host) { sendJ(c, { t: 'denied', why: 'Nenhum mundo aberto neste IP agora. Peça para o dono abrir o mundo.' }); return c.sock.end(); }
    if (world.pass && String(o.pass || '') !== world.pass) { sendJ(c, { t: 'denied', why: 'Senha errada.' }); return c.sock.end(); }
    if (peers.size >= 15) { sendJ(c, { t: 'denied', why: 'O mundo está cheio.' }); return c.sock.end(); }
    c.id = nextId++; c.name = String(o.name || 'Jogador').slice(0, 24); peers.set(c.id, c); sendJ(c, { t: 'welcome', id: c.id, host: false, world: world.name });
    sendJ(host, { t: 'join', from: c.id, name: c.name, pid: o.pid, look: o.look }); console.log(`${c.name} entrou (${(c.sock.remoteAddress || '').replace('::ffff:', '')}).`); return; }
  // repasse: to = id | 'all' | (sem 'to' = para o dono)
  o.from = c.id; const m = JSON.stringify(o);
  if (o.to === 'all') { if (c !== host && host) send(host, m); for (const p of peers.values()) if (p !== c) send(p, m); }
  else if (typeof o.to === 'number') { const d = o.to === 1 ? host : peers.get(o.to); if (d && d !== c) send(d, m); }
  else if (c !== host && host) send(host, m);
}
server.on('upgrade', (req, sock) => { if (new URL(req.url, 'http://x').pathname !== '/mp') return sock.destroy(); wsAccept(req, sock); });
server.on('error', (e) => { console.error(e.code === 'EADDRINUSE' ? `A porta ${PORT} já está em uso — feche o outro servidor ou use outra porta (node server.mjs 8791).` : e); process.exit(1); });
server.listen(PORT, '0.0.0.0', () => {
  const ips = []; for (const [n, list] of Object.entries(os.networkInterfaces())) for (const a of list || []) if (a.family === 'IPv4' && !a.internal) ips.push([a.address, n]);
  console.log('==============================================');
  console.log('  ILHA PERDIDA — servidor do mundo ligado');
  console.log('==============================================');
  console.log(`Jogue aqui neste PC:  http://localhost:${PORT}/?host=1`);
  for (const [ip, n] of ips) console.log(`Amigos usam o IP:     ${ip}${PORT !== 8790 ? ':' + PORT : ''}   (${n}${ip.startsWith('26.') ? ' — Radmin VPN' : ''})`);
  console.log('Deixe esta janela aberta enquanto jogarem. Ctrl+C fecha o servidor.');
  if (!process.env.NO_BROWSER) { const u = `http://localhost:${PORT}/?host=1`; const cmd = process.platform === 'win32' ? `start "" "${u}"` : process.platform === 'darwin' ? `open "${u}"` : `xdg-open "${u}"`; exec(cmd, () => {}); }
});
setInterval(() => { for (const c of [host, ...peers.values()]) if (c) send(c, null, 9); }, 20000);
