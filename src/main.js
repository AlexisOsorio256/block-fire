import * as THREE from './lib/three.module.js';
import { Game } from './core/Game.js';

// BLOCKFIRE — FPS 3D Prototype
// Entry point — keeps architecture simple and predictable

let game;
try {
  game = new Game();
} catch(e){
  console.error('Game init failed', e);
  document.body.insertAdjacentHTML('beforeend', `<div style="position:fixed;top:40px;left:0;background:#f00;color:#fff;padding:4px;z-index:9999;font:12px monospace">GAME ERROR: ${e.message}</div>`);
}
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
  setTimeout(() => {
    try {
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
      try { game.weaponSystem.fire(game.player, []); } catch(e){ console.error('fire err',e); }
      const ammoAfter = game.weaponSystem.ammoInMag;
      log('3 WEAPON FIRE', ammoAfter < ammoBefore, `ammo ${ammoBefore} -> ${ammoAfter}`);
      // Test 4: Bots exist
      log('4 BOTS', game.bots.length === 7, `bots ${game.bots.length}`);
      // Test 5: Map has collision
      const coll2 = typeof game.map.checkCollision === 'function';
      log('5 MAP COLLISION', coll2, `hasCheck ${coll2}`);
      // Test 6: HUD
      const hudOk = !!document.getElementById('hud');
      log('6 HUD', hudOk, `hud ${hudOk}`);
      // Test 7: A hitscan kill must reach the match damage system. This covers
      // score/death wiring, not merely that a target mesh can lose health.
      // NOTE: in ?runTests=1 the match stays in LOADING (lobby orbit cam),
      // so the test sets its own deterministic camera pose instead of
      // trusting whatever the lobby left in the camera.
      const bot = game.bots[0];
      const botStart = bot.position.clone();
      const eye = new THREE.Vector3(30, 1.65, 24);
      game.camera.position.copy(eye);
      game.camera.lookAt(30, 1.65, 14); // aim straight -Z at torso height
      game.camera.updateMatrixWorld();
      bot.position.set(30, 1.65, 14);   // 10u ahead of the muzzle
      bot.health = bot.maxHealth;
      bot.isAlive = true;
      bot.mesh.visible = true;
      game.playerKills = 0;
      game.weaponSystem.fireCooldown = 0;
      game.weaponSystem.ammoInMag = game.weaponSystem.currentWeapon.magazineSize;
      let combatResult = null;
      // Deterministic shots: zero spread for the test (spread is random and
      // made this test flaky when flinch pushed the bot).
      const savedSpread = game.weaponSystem.currentWeapon.spread;
      game.weaponSystem.currentWeapon.spread = 0;
      for(let i=0;i<6 && bot.isAlive; i++) {
        game.weaponSystem.fireCooldown = 0;
        // Bots flinch on hit (knockback), so re-aim at the moving target each
        // shot — a real fight tracks the target instead of a fixed spot.
        // Aim at the head: 125 HP / headshot 48 → 3 shots kill; 6 shots give
        // headroom so the test is deterministic regardless of body/head ratio.
        game.camera.lookAt(bot.position.x, bot.position.y - 0.08, bot.position.z);
        game.camera.updateMatrixWorld();
        combatResult = game.weaponSystem.fire(game.player, [bot], null);
      }
      game.weaponSystem.currentWeapon.spread = savedSpread;
      const combatOk = !bot.isAlive && game.playerKills === 1 && combatResult?.totalDamage > 0;
      const scoreAfterWeapon = game.playerKills;
      bot.respawn(botStart);
      game.playerKills = 0;
      game.applyDamage(bot, 200, 'body', game.player);
      const directDamageOk = game.playerKills === 1;
      log('7 COMBAT + SCORE', combatOk && directDamageOk, `weaponKills ${scoreAfterWeapon} directKills ${game.playerKills} damage ${combatResult?.totalDamage || 0}`);
      bot.respawn(botStart);
      game.playerKills = 0;
    } catch(e){
      log('TEST ERROR', false, String(e).slice(0,120));
      console.error(e);
    }
    // Show overlay
    try {
      const overlay = document.createElement('div');
      overlay.id = 'test-overlay';
      overlay.style.cssText = 'position:fixed;inset:0;z-index:99;background:rgba(10,16,30,0.96);color:#fff;font:13px/1.5 ui-monospace,monospace;padding:22px;overflow:auto';
      let html = '<h2 style="color:#ffd23f;margin-bottom:10px">BLOCKFIRE — TESTS</h2><pre>';
      for (const r of window.__TESTS__) {
        html += `<span style="color:${r.pass?'#7dff9a':'#ff6b7a'}">${r.pass?'PASS':'FAIL'}</span> ${r.name} <span style="opacity:0.7">${r.detail}</span>\n`;
      }
      const passed = window.__TESTS__.filter(r=>r.pass).length;
      html += `\nTotal ${passed}/${window.__TESTS__.length} PASSED\n</pre>`;
      overlay.innerHTML = html;
      document.body.appendChild(overlay);
    } catch(e){ console.error('overlay err',e); }
  }, 200);
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
