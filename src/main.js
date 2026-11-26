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
