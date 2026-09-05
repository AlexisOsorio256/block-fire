import { Game } from './core/Game.js';
import { runTestSuite } from './testing/suite.js';
import { setupCapture } from './testing/capture.js';

// BLOCKFIRE — Entry point
// Este fichero SOLO arranca: crea el Game, cablea los botones globales y
// activa los gates (landscape / tests / capturas). Cero lógica de juego.

let game;
try {
  game = new Game();
  // ARSENAL + PAUSA: botones del flujo REAL (no en tests)
  const arsenalBtn = document.getElementById('btn-arsenal');
  if (arsenalBtn) arsenalBtn.addEventListener('click', () => game.openShop());
  const pauseBtn = document.getElementById('btn-pause');
  if (pauseBtn) pauseBtn.addEventListener('click', () => game.abandonMatch());
} catch(e){
  console.error('Game init failed', e);
  document.body.insertAdjacentHTML('beforeend', `<div style="position:fixed;top:40px;left:0;background:#f00;color:#fff;padding:4px;z-index:9999;font:12px monospace">GAME ERROR: ${e.message}</div>`);
}
window.__BLOCKFIRE__ = game;
window.Game = Game;

console.log('%c BLOCKFIRE — FFA 8 players — 20 kills to win ', 'background:#ffd23f;color:#0a0f1e;padding:6px 10px;border-radius:6px;font-weight:900;');
console.log('PC: WASD + Mouse (click to lock) + Click to shoot | Mobile: joystick + drag + buttons');
console.log('Tests: ?runTests=1 | Capture: ?capture=ready|playing');

// ---- Landscape gate (regla permanente: BLOCKFIRE es horizontal) ----
// En pantallas táctiles, TODA la app (lobby incluido) se bloquea en portrait:
// el jugador recibe la instrucción ANTES de tocar el flujo jugable, no después.
const rotateGate = document.getElementById('rotate-gate');
const isCoarsePointer = () => window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 900;
function updateRotateGate() {
  if (!rotateGate) return;
  const portrait = window.innerHeight > window.innerWidth;
  // Hide while tests run so ?runTests=1 works on any window shape.
  const testing = new URLSearchParams(location.search).has('runTests');
  rotateGate.classList.toggle('show', isCoarsePointer() && portrait && !testing);
}
window.addEventListener('resize', updateRotateGate);
window.addEventListener('orientationchange', updateRotateGate);
updateRotateGate();

// Harness
const params = new URLSearchParams(location.search);
if (params.has('runTests')) runTestSuite(game);
if (params.has('capture')) setupCapture(game, params.get('capture'));
