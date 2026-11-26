// Voz por proximidade: CAPS LOCK (ou o botão 🎤 no celular) liga o microfone e ele fica aberto até apertar de novo.
// Quem está perto ouve (volume e lado conforme a distância/direção). NPCs e robôs também ouvem quando você fala
// e vão na sua direção. Áudio: 8 kHz, μ-law (8 bits), pacotes de ~0,16 s pelo mesmo canal do multiplayer.
const RATE = 8000, CHUNK = 1280, HEAR_R = 45, GATE = 0.018;

function muEnc(x) { const s = Math.max(-1, Math.min(1, x)) * 32635; const sign = s < 0 ? 0x80 : 0; let v = Math.abs(s) + 132; let e = 7; for (let m = 0x4000; (v & m) === 0 && e > 0; m >>= 1) e--; const man = (v >> (e + 3)) & 0x0f; return ~(sign | (e << 4) | man) & 0xff; }
const MU_DEC = new Float32Array(256); for (let i = 0; i < 256; i++) { const u = ~i & 0xff; const sign = u & 0x80, e = (u >> 4) & 7, man = u & 0x0f; let v = ((man << 3) + 132) << e; v -= 132; MU_DEC[i] = (sign ? -v : v) / 32768; }
const b64 = (u8) => { let s = ''; for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]); return btoa(s); };
const unb64 = (s) => { const t = atob(s), u = new Uint8Array(t.length); for (let i = 0; i < t.length; i++) u[i] = t.charCodeAt(i); return u; };

export class Voice {
  constructor(game) { this.g = game; this.on = false; this.level = 0; this.talking = false; this.buf = []; this.next = new Map(); this.noiseT = 0; this.talkT = 0; this.busy = false; }
  // o navegador só libera o microfone em página segura (https) ou no próprio computador (localhost)
  available() { return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia); }
  async toggle() { if (this.busy) return; if (this.on) return this.stop(); return this.start(); }
  _closePerm() { const d = document.getElementById('micPerm'); if (d) d.remove(); }
  // janela "Permitir microfone": o botão chama o pedido do navegador direto no toque/clique (exigência do celular)
  permPanel(kind) { const g = this.g; this._closePerm(); const d = document.createElement('div'); d.id = 'micPerm';
    const inFrame = (() => { try { return window.self !== window.top; } catch (e) { return true; } })(); const ios = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    const steps = ios ? '<li>Toque em <b>aA</b> (ou no ícone ao lado do endereço) → <b>Ajustes do Site</b> → <b>Microfone</b> → <b>Permitir</b>.</li><li>Ou: Ajustes do iPhone → Safari → Microfone → Permitir.</li>'
      : '<li>Toque no <b>cadeado</b> (ou ⓘ) ao lado do endereço do site → <b>Permissões</b> → <b>Microfone</b> → <b>Permitir</b>.</li><li>Ou: menu ⋮ → Configurações → Configurações do site → Microfone → libere este site.</li>';
    const msg = kind === 'ask' ? '<p>Para falar com quem está perto no jogo, o navegador precisa da sua permissão para usar o microfone.</p>'
      : kind === 'nodev' ? '<p>Nenhum microfone foi encontrado neste aparelho.</p>'
      : '<p>O microfone está <b>bloqueado</b> para este site. Libere assim e toque em <b>Tentar de novo</b>:</p><ol>' + steps + '</ol>' + (inFrame ? '<p class="mut">Se o jogo estiver aberto dentro de outra página (pré-visualização), ela pode não deixar usar o microfone: abra o arquivo direto no navegador.</p>' : '');
    d.innerHTML = '<div class="mpBox"><h3>🎤 Microfone</h3>' + msg + '<div class="mpBtns">' + (kind === 'nodev' ? '' : '<button class="mpOk">' + (kind === 'ask' ? 'Permitir microfone' : 'Tentar de novo') + '</button>') + '<button class="mpNo">Agora não</button></div></div>';
    document.body.appendChild(d); g.input && g.input.exitLock && g.input.exitLock();
    const ok = d.querySelector('.mpOk'); if (ok) ok.addEventListener('click', (e) => { e.stopPropagation(); this.start({ fromPanel: true }); });
    d.querySelector('.mpNo').addEventListener('click', (e) => { e.stopPropagation(); this._closePerm(); }); for (const ev of ['touchstart', 'touchend', 'mousedown']) d.addEventListener(ev, (e) => e.stopPropagation()); }
  async start(opts = {}) {
    const g = this.g; g.audio.init(); const c = g.audio.ctx; if (!c) return;
    if (!this.available()) { g.ui.toast('🎤 O navegador bloqueou o microfone: ele só funciona com o jogo aberto em https (site) ou no próprio PC (localhost). No Chrome dá para liberar o IP em chrome://flags → "Insecure origins treated as secure".', 'warn'); return; }
    // permissão já negada antes: o navegador não pergunta de novo sozinho — mostra como liberar
    let st = null; try { if (navigator.permissions && navigator.permissions.query) st = (await navigator.permissions.query({ name: 'microphone' })).state; } catch (e) {}
    if (st === 'denied') { this.permPanel('denied'); return; }
    if (st !== 'granted' && !opts.fromPanel) { this.permPanel('ask'); return; } // pede com um botão (toque do jogador = o navegador abre a janelinha de permitir)
    this.busy = true;
    try { this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } }); }
    catch (e) { this.busy = false; this.permPanel(e && (e.name === 'NotFoundError' || e.name === 'DevicesNotFoundError') ? 'nodev' : 'denied'); return; }
    this._closePerm();
    this.busy = false; this.on = true; this.src = c.createMediaStreamSource(this.stream); this.an = c.createAnalyser(); this.an.fftSize = 1024; this.td = new Float32Array(this.an.fftSize); this.src.connect(this.an);
    const ratio = c.sampleRate / RATE; let acc = 0;
    this.proc = c.createScriptProcessor(2048, 1, 1); this.mute = c.createGain(); this.mute.gain.value = 0; this.src.connect(this.proc); this.proc.connect(this.mute); this.mute.connect(c.destination);
    this.proc.onaudioprocess = (ev) => { const d = ev.inputBuffer.getChannelData(0); // reduz para 8 kHz (média por janela)
      for (let i = 0; i < d.length; i++) { acc += 1; if (acc >= ratio) { acc -= ratio; this.buf.push(d[i]); } }
      while (this.buf.length >= CHUNK) { const part = this.buf.splice(0, CHUNK); if (this.talkT > 0) this._send(part); } };
    this.ui(true); g.ui.toast('🎤 Microfone ligado (CAPS LOCK desliga). Quem estiver perto ouve você — e os inimigos também!', 'info');
  }
  stop() { this.on = false; this.talking = false; this.level = 0; try { this.proc && (this.proc.onaudioprocess = null, this.proc.disconnect()); this.src && this.src.disconnect(); this.mute && this.mute.disconnect(); } catch (e) { /* já parado */ }
    if (this.stream) for (const t of this.stream.getTracks()) t.stop(); this.stream = null; this.buf = []; document.body.classList.remove('micTalk'); this.ui(false); this.g.ui.toast('🎤 Microfone desligado', 'info'); }
  _send(part) { const net = this.g.net; if (!net || !net.active) return; const u = new Uint8Array(part.length); for (let i = 0; i < part.length; i++) u[i] = muEnc(part[i] * 1.6);
    const P = this.g.player; net.send({ to: 'all', t: 'vc', p: [+P.pos[0].toFixed(1), +P.pos[1].toFixed(1), +P.pos[2].toFixed(1)], a: b64(u) }); }
  // a cada quadro: nível da voz, ícone piscando e barulho para NPCs/robôs
  update(dt) {
    if (!this.on || !this.an) return; this.an.getFloatTimeDomainData(this.td); let s = 0; for (let i = 0; i < this.td.length; i++) s += this.td[i] * this.td[i]; const rms = Math.sqrt(s / this.td.length);
    this.level += (rms - this.level) * Math.min(1, dt * 12); const loud = this.level > GATE; if (loud) this.talkT = 0.35; else this.talkT -= dt; this.talking = this.talkT > 0;
    const el = document.getElementById('micIcon'); if (el) el.classList.toggle('talk', loud); document.body.classList.toggle('micTalk', loud);
    this.noiseT -= dt; const g = this.g; if (this.talking && this.noiseT <= 0 && g.state === 'playing' && !g.player.dead) { this.noiseT = 0.6; const R = Math.min(38, 14 + this.level * 260); g.noise && g.noise(g.player.pos, R, 'voz'); }
  }
  // voz de outro jogador: toca na posição dele (volume pela distância, lado pelo estéreo)
  onRemote(o) {
    const g = this.g, c = g.audio.ctx; if (!c || c.state !== 'running' || !o.a || !o.p) return; const L = g.audio.listener && g.audio.listener(); if (!L) return;
    const dx = o.p[0] - L.eye[0], dz = o.p[2] - L.eye[2], d = Math.hypot(dx, dz); if (d > HEAR_R) return;
    const u = unb64(o.a); const buf = c.createBuffer(1, u.length, RATE); const ch = buf.getChannelData(0); for (let i = 0; i < u.length; i++) ch[i] = MU_DEC[u[i]];
    const s = c.createBufferSource(); s.buffer = buf; const gn = c.createGain(); gn.gain.value = Math.pow(1 - d / HEAR_R, 1.2) * 1.6; const pan = c.createStereoPanner(); pan.pan.value = Math.max(-1, Math.min(1, -Math.sin(Math.atan2(dx, dz) - L.yaw) * Math.min(1, d / 3)));
    s.connect(gn); gn.connect(pan); pan.connect(g.audio.master || c.destination);
    const now = c.currentTime; let t = this.next.get(o.from) || 0; if (t < now + 0.05 || t > now + 0.8) t = now + 0.08; s.start(t); this.next.set(o.from, t + buf.duration);
    const pr = g.net && g.net.peers && g.net.peers.get(o.from); if (pr) pr.talkT = 0.4; }
  ui(on) { const el = document.getElementById('micIcon'); if (el) { el.classList.toggle('hidden', !on); el.classList.remove('talk'); } document.body.classList.toggle('micOn', on); }
}
