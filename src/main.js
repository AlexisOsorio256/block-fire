import { Game } from './core/Game.js';
import { BUILD_ID } from './core/BuildInfo.js';

// BF_DEV_TOOLS: define de build. En PROD es false → rama muerta, sin harness.
// En DEV directo (src/main.js sin esbuild) lo cubre este fallback.
typeof BF_DEV_TOOLS === 'undefined' && (globalThis.BF_DEV_TOOLS = true);

// BLOCKFIRE — Entry point
// Este fichero SOLO arranca: crea el Game, cablea los botones globales y
// activa los gates (landscape / tests / capturas). Cero lógica de juego.

let game;
try {
  game = new Game();
  // ARSENAL: botón del flujo REAL (no en tests). ABANDONAR vive dentro de
  // CONFIGURACIÓN (Game._setupOverlay): nada flotante de toque accidental.
  const arsenalBtn = document.getElementById('btn-arsenal');
  if (arsenalBtn) arsenalBtn.addEventListener('click', () => game.openShop());
} catch(e){
  console.error('Game init failed', e);
  document.body.insertAdjacentHTML('beforeend', `<div style="position:fixed;top:40px;left:0;background:#f00;color:#fff;padding:4px;z-index:9999;font:12px monospace">GAME ERROR: ${e.message}</div>`);
}
window.__BLOCKFIRE__ = game;
window.Game = Game;

console.log('%c BLOCKFIRE — FFA 8 players — 20 kills to win ', 'background:#ffd23f;color:#0a0f1e;padding:6px 10px;border-radius:6px;font-weight:900;');
console.log(`BUILD_ID=${BUILD_ID}`);
console.log('PC: WASD + Mouse (click to lock) + Click to shoot | Mobile: joystick + drag + buttons');
if (BF_DEV_TOOLS) console.log('Tests: ?runTests=1 | Capture: ?capture=ready|playing');

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

// Harness: import dinámico — esbuild lo elimina del bundle PROD vía
// --define:BF_DEV_TOOLS=false (rama muerta). En DEV (sin bundle o sin define)
// se cargan solo si se piden por query param. Cero harness en producción.
const params = new URLSearchParams(location.search);
if (BF_DEV_TOOLS && params.has('runTests')) import('./testing/suite.js').then(m => m.runTestSuite(game));
if (BF_DEV_TOOLS && params.has('capture')) import('./testing/capture.js').then(m => m.setupCapture(game, params.get('capture')));
