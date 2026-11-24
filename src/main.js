// Ponto de entrada: verifica suporte, inicializa o jogo e trata erros de forma visível.
import { Game } from './game/game.js';

const canvas = document.getElementById('gl');
function fail(msg) {
  const box = document.getElementById('errorBox'); box.classList.remove('hidden');
  document.getElementById('errorText').textContent = msg; document.getElementById('loading').classList.add('hidden');
}
window.addEventListener('error', (e) => console.error('Erro não tratado:', e.message));
try {
  const game = new Game(canvas);
  window.__game = game; // usado pelos testes automatizados
  game.init().catch((e) => { console.error(e); fail('Falha ao iniciar: ' + e.message); });
} catch (e) {
  console.error(e);
  fail(e.message.includes('WebGL2') ? 'Seu navegador não suporta WebGL2. Use uma versão recente do Chrome, Edge, Firefox ou Safari.' : 'Falha ao iniciar: ' + e.message);
}
