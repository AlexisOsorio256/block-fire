import { Game } from './core/Game.js';

// BLOCKFIRE — FPS 3D Prototype
// Entry point — keeps architecture simple and predictable

const game = new Game();

// Expose for debugging and tests
window.__BLOCKFIRE__ = game;
window.Game = Game;

console.log('%c BLOCKFIRE — FFA 8 players — 20 kills to win ', 'background:#ffd23f;color:#0a0f1e;padding:6px 10px;border-radius:6px;font-weight:900;');
console.log('PC: WASD + Mouse (click to lock) + Click to shoot | Mobile: joystick + drag + buttons');
console.log('Tests: ?runTests=1 | Capture: ?capture=ready|playing');

// Simple test harness for Stage 1-5 validation
const params = new URLSearchParams(location.search);
if (params.has('runTests')) {
  window.__TESTS__ = [];
  const log = (name, pass, detail) => {
    window.__TESTS__.push({ name, pass, detail });
    console.log(`[TEST] ${name}: ${pass ? 'PASS' : 'FAIL'} ${detail}`);
  };
  setTimeout(async () => {
    // Test 1: Game loads
    log('1 GAME LOADS', !!game && !!game.scene, `scene ${!!game.scene} renderer ${!!game.renderer}`);
    // Test 2: Player can move (simulate input)
    const startPos = game.player.position.clone();
    game.input._keys.add('KeyW');
    game.input.update();
    game.playerController.update(0.016);
    const moved = game.player.position.distanceTo(startPos) > 0.01;
    log('2 PLAYER MOVE', moved, `dist ${game.player.position.distanceTo(startPos).toFixed(3)}`);
    game.input._keys.delete('KeyW');
    // Test 3: Weapon fires
    const ammoBefore = game.weaponSystem.ammoInMag;
    game.weaponSystem.fire(game.player, []);
    const ammoAfter = game.weaponSystem.ammoInMag;
    log('3 WEAPON FIRE', ammoAfter < ammoBefore, `ammo ${ammoBefore} -> ${ammoAfter}`);
    // Test 4: Bots exist
    log('4 BOTS', game.bots.length === 7, `bots ${game.bots.length}`);
    // Test 5: Map has collision
    const coll = game.map.checkCollision(new THREE.Vector3(0,1,0), 0.5, 1.6);
    log('5 MAP COLLISION', typeof coll === 'boolean', `coll ${coll}`);
    // Test 6: HUD
    const hudOk = !!document.getElementById('hud');
    log('6 HUD', hudOk, `hud ${hudOk}`);

    // Show overlay
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:99;background:rgba(10,16,30,0.96);color:#fff;font:13px/1.5 ui-monospace,monospace;padding:22px;overflow:auto';
    let html = '<h2 style="color:#ffd23f;margin-bottom:10px">BLOCKFIRE — TESTS</h2><pre>';
    for (const r of window.__TESTS__) {
      html += `<span style="color:${r.pass?'#7dff9a':'#ff6b7a'}">${r.pass?'PASS':'FAIL'}</span> ${r.name} <span style="opacity:0.7">${r.detail}</span>\n`;
    }
    const passed = window.__TESTS__.filter(r=>r.pass).length;
    html += `\nTotal ${passed}/${window.__TESTS__.length} PASSED\n</pre>`;
    overlay.innerHTML = html;
    document.body.appendChild(overlay);
  }, 800);
}

if (params.has('capture')) {
  const mode = params.get('capture');
  setTimeout(()=>{
    if(mode==='playing'){
      game.startMatch();
      document.getElementById('overlay').classList.add('hidden');
    }
  }, 600);
}
