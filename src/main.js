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

      // Test 8: an FFA ends when ANY combatant reaches the kill target —
      // a bot hitting 20 must finish the match as a defeat, exactly once.
      const winsBefore = localStorage.getItem('bf_wins') || '0';
      game.matchState = 'PLAYING';
      game._resultShown = false;
      const botA = game.bots[0], botB = game.bots[1];
      botA.kills = game.killTarget - 1;
      const bBStart = botB.position.clone();
      game.applyDamage(botB, 999, 'body', botA);
      const endedOk = game.matchState === 'FINISHED'
        && document.getElementById('result-title').textContent === 'DERROTA';
      game.showResult(true); // duplicate call in the same frame must be a no-op
      const idempotentOk = document.getElementById('result-title').textContent === 'DERROTA'
        && (localStorage.getItem('bf_wins') || '0') === winsBefore;
      log('8 BOT REACHES TARGET ENDS MATCH', endedOk && idempotentOk,
        `state ${game.matchState} result DERROTA:${endedOk} noDoubleShow:${idempotentOk}`);
      botA.kills = 0;
      botB.respawn(bBStart);
      game.matchState = 'LOADING';

      // Test 9: 'next' cycles through all three weapons (KeyE / mobile button)
      game.weaponSystem.isReloading = false;
      game.weaponSystem.fireCooldown = 0;
      game.weaponSystem.switchWeapon(1); // rifle
      game.weaponSystem.switchWeapon('next');
      const w1 = game.weaponSystem.currentWeapon.name;
      game.weaponSystem.switchWeapon('next');
      const w2 = game.weaponSystem.currentWeapon.name;
      game.weaponSystem.switchWeapon('next');
      const w3 = game.weaponSystem.currentWeapon.name;
      const cycleOk = w1 === 'Pistol' && w2 === 'Shotgun' && w3 === 'Rifle';
      log('9 WEAPON CYCLE NEXT', cycleOk, `${w1} → ${w2} → ${w3}`);
      game.weaponSystem.switchWeapon(1);

      // Test 10: entities must not share the same body space (bots used to
      // walk inside the player, filling the camera with point-blank polygons)
      const pp = game.player.position;
      const saveP = pp.clone();
      const b2Start = game.bots[2].position.clone();
      game.player.isAlive = true;
      game.bots[2].isAlive = true;
      pp.set(0, 1.65, 40);
      game.bots[2].position.set(0.1, 1.65, 40.1);
      game._separateEntities();
      const sepDist = pp.distanceTo(game.bots[2].position);
      const sepOk = sepDist >= (0.35 + 0.38) - 0.01;
      log('10 ENTITY SEPARATION', sepOk, `dist ${sepDist.toFixed(2)} ≥ ${(0.35+0.38).toFixed(2)}`);
      pp.copy(saveP);
      game.bots[2].respawn(b2Start);

      // Test 11: bots must keep firing while the PLAYER reloads. canFire used
      // to gate every shooter on the player's reload flag, silencing the whole
      // enemy team for 1.1–1.9s whenever the player pressed R.
      game.weaponSystem.isReloading = true;
      game.weaponSystem.fireCooldown = 0;
      const bot11 = game.bots[3];
      const bot11Start = bot11.position.clone();
      bot11.isAlive = true; bot11.health = bot11.maxHealth;
      const camSave11 = game.camera.position.clone();
      game.camera.position.set(0, 1.65, 10);
      game.camera.lookAt(0, 1.65, 0);
      game.camera.updateMatrixWorld();
      bot11.position.set(0, 1.65, 5);
      const rBotReload = game.weaponSystem.fire(bot11, [game.player], game.map);
      game.weaponSystem.isReloading = false;
      game.camera.position.copy(camSave11);
      game.camera.updateMatrixWorld();
      log('11 BOT FIRES DURING PLAYER RELOAD', rBotReload !== null, `result ${rBotReload ? 'fired' : 'BLOCKED'}`);
      bot11.respawn(bot11Start);

      // Test 12: bot gunfire volume must be measured from the real listener
      // (player camera), not the bot-eye camera Game hijacks for the raycast.
      const camSave12 = game.camera.position.clone();
      game.camera.position.set(0, 1.65, 10); // 20u from the bot below
      game.camera.updateMatrixWorld();
      let capturedScale = null;
      const realPlay = game.audio.play.bind(game.audio);
      game.audio.play = (name, variant, opts) => {
        if (name === 'shoot' && opts && opts.throttleClass === 'shootBot') capturedScale = opts.volumeScale;
      };
      const bot12 = game.bots[4];
      const bot12Start = bot12.position.clone();
      bot12.isAlive = true; bot12.health = bot12.maxHealth;
      bot12.position.set(0, 1.65, -10); // exactly 20u in front of the camera
      game.weaponSystem.fireCooldown = 0;
      game.weaponSystem.fire(bot12, [game.player], game.map, game.camera.position.clone());
      game.audio.play = realPlay;
      game.camera.position.copy(camSave12);
      game.camera.updateMatrixWorld();
      const expectedScale = Math.max(0.12, Math.min(0.85, 1 - 20 / 45)); // ≈0.556
      const volOk = capturedScale !== null && Math.abs(capturedScale - expectedScale) < 0.01;
      log('12 BOT SHOT DISTANCE VOLUME', volOk, `scale ${capturedScale?.toFixed(3)} ≈ ${expectedScale.toFixed(3)}`);
      bot12.respawn(bot12Start);
    } catch(e){
      log('TEST ERROR', false, String(e).slice(0,120));
      console.error(e);
    }

    // Test 13 (async — needs the real 1.8s respawn window): a pending respawn
    // timer from the previous match must NOT teleport the player after
    // OTRA PARTIDA (rule §4: restart resets all temporal state).
    setTimeout(() => {
      try {
        let spawnIdx = 0;
        const realSpawn = game.map.getRandomSpawn.bind(game.map);
        game.map.getRandomSpawn = () => new THREE.Vector3(spawnIdx++ * 10, 1.65, 18);
        game.matchState = 'PLAYING';
        game._resultShown = false;
        // Freeze bots so nothing can legitimately kill/move the player during
        // the wait window (deterministic, not fighting the live AI).
        const botsAlive = game.bots.map(b => b.isAlive);
        game.bots.forEach(b => b.isAlive = false);
        game.startMatch(); // spawn A
        game.applyDamage(game.player, 999, 'body', game.bots[0]); // die → stale timer +1800ms
        game.startMatch(); // immediate retry → spawn B
        const posB = game.player.position.clone();
        setTimeout(() => {
          let teleported = true;
          try {
            teleported = game.player.position.distanceTo(posB) > 0.001;
            log('13 NO STALE RESPAWN TELEPORT', !teleported,
              teleported ? `teleported to x=${game.player.position.x.toFixed(1)}` : `stayed at x=${posB.x.toFixed(1)}`);
          } finally {
            game.map.getRandomSpawn = realSpawn;
            game.bots.forEach((b, i) => b.isAlive = botsAlive[i]);
            game.matchState = 'LOADING';
            renderTests();
          }
        }, 2100);
      } catch(e){
        log('TEST ERROR 13', false, String(e).slice(0,120));
        console.error(e);
        renderTests();
      }
    }, 2200);

    // Show overlay (re-rendered after the async test 13 finishes)
    function renderTests(){
    try {
      const prev = document.getElementById('test-overlay');
      if (prev) prev.remove();
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
    }
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
