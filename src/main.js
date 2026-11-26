// Ponto de entrada: verifica suporte, inicializa o jogo e trata erros de forma visível.
import { Game } from './game/game.js';

const canvas = document.getElementById('gl');
function fail(msg) {
  const box = document.getElementById('errorBox'); box.classList.remove('hidden');
  document.getElementById('errorText').textContent = msg; document.getElementById('loading').classList.add('hidden');
}
window.addEventListener('error', (e) => console.error('Erro não tratado:', e.message));
// a placa de vídeo pode "perder" o contexto WebGL (muitas abas com 3D abertas, pouca memória de vídeo, driver reiniciado).
// Em vez de travar com "Erro de shader: null", avisa e recarrega a página sozinho (no máximo 3 vezes seguidas).
function gpuReload(why) { let n = 0; try { n = +(sessionStorage.getItem('glReload') || 0); } catch (e) {} if (n >= 3) { fail('A placa de vídeo parou de responder (' + why + '). Feche outras abas com jogos/3D e recarregue a página.'); return; }
  try { sessionStorage.setItem('glReload', String(n + 1)); } catch (e) {} fail('A placa de vídeo reiniciou — recarregando o jogo…'); setTimeout(() => location.reload(), 1500); }
canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); gpuReload('contexto perdido'); }, false);
window.addEventListener('error', (e) => { if (/Erro de shader: null/.test(e.message || '')) gpuReload('shader'); });
window.addEventListener('unhandledrejection', (e) => { if (/Erro de shader: null/.test(String(e.reason && e.reason.message || ''))) gpuReload('shader'); });
setTimeout(() => { try { sessionStorage.removeItem('glReload'); } catch (e) {} }, 60000);
try {
  const game = new Game(canvas);
  window.__game = game; // usado pelos testes automatizados
  game.init().catch((e) => { console.error(e); if (/Erro de shader: null/.test(e.message)) return gpuReload('shader'); fail('Falha ao iniciar: ' + e.message); });
} catch (e) {
  console.error(e); if (/Erro de shader: null/.test(e.message)) gpuReload('shader'); else
  fail(e.message.includes('WebGL2') ? 'Seu navegador não suporta WebGL2. Use uma versão recente do Chrome, Edge, Firefox ou Safari.' : 'Falha ao iniciar: ' + e.message);
}

// tela cheia: botão no canto superior direito (aparece quando o mouse chega perto do canto). Esc sai da tela cheia.
(() => { const btn = document.getElementById('fsBtn'); if (!btn) return; const B = document.body; let hideT = 0;
  const isFs = () => !!(document.fullscreenElement || document.webkitFullscreenElement);
  const show = (on) => { B.classList.toggle('fsShow', on); if (on) { clearTimeout(hideT); hideT = setTimeout(() => { if (!btn.matches(':hover')) B.classList.remove('fsShow'); }, 2500); } };
  window.addEventListener('mousemove', (e) => { if (document.pointerLockElement) return; const near = e.clientX > innerWidth - 130 && e.clientY < 110; if (near) show(true); else if (B.classList.contains('fsShow') && !btn.matches(':hover')) B.classList.remove('fsShow'); });
  document.addEventListener('mouseleave', () => { if (!btn.matches(':hover')) B.classList.remove('fsShow'); });
  btn.addEventListener('mousedown', (e) => e.stopPropagation());
  btn.addEventListener('click', (e) => { e.stopPropagation(); e.preventDefault(); const g = window.__game;
    if (isFs()) { (document.exitFullscreen || document.webkitExitFullscreen).call(document); return; }
    const d = document.documentElement, req = d.requestFullscreen || d.webkitRequestFullscreen; if (!req) { if (g && g.ui) g.ui.toast('Este navegador não deixa usar tela cheia aqui', 'warn'); return; }
    let p; try { p = req.call(d, { navigationUI: 'hide' }); } catch (err) { p = Promise.reject(err); }
    Promise.resolve(p).then(() => { B.classList.remove('fsShow'); B.classList.add('isFs'); if (g && g.state === 'playing' && g.input && !g.input.touchActive && !g.ui.anyOpen) g.input.requestLock(true); })
      .catch(() => { if (g && g.ui) g.ui.toast('Esta página não deixa usar tela cheia — abra o arquivo direto no navegador (Chrome/Edge)', 'warn'); }); });
  const upd = () => B.classList.toggle('isFs', isFs()); document.addEventListener('fullscreenchange', upd); document.addEventListener('webkitfullscreenchange', upd);
})();
// botão de voz no celular: liga o microfone direto no toque (o navegador só mostra "Permitir" dentro de um toque/clique)
(() => { const b = document.querySelector('#mobile [data-id=mic], [data-act=mic]'); if (!b) return; let t0 = 0;
  const go = (e) => { const g = window.__game; if (!g || !g.voice || document.body.classList.contains('tedit')) return; const now = performance.now(); if (now - t0 < 500) return; t0 = now; g.voice._dT = now; g.voice.toggle(); };
  b.addEventListener('touchend', go, { passive: true }); b.addEventListener('click', go); })();
