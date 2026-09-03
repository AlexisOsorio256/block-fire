import * as THREE from './lib/three.module.js';
import { Game } from './core/Game.js';

// BLOCKFIRE — FPS 3D Prototype
// Entry point — keeps architecture simple and predictable

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
      // Punto de tiro determinista: buscar un lugar abierto del mapa (los dos
      // mapas tienen suelo despejado a ±size*0.7 en la diagonal)
      const eye = new THREE.Vector3(game.map.size*0.7, 1.65, game.map.size*0.7);
      game.camera.position.copy(eye);
      game.camera.lookAt(eye.x, 1.65, eye.z - 10); // aim straight -Z at torso height
      game.camera.updateMatrixWorld();
      bot.position.set(eye.x, 1.65, eye.z - 10);   // 10u ahead of the muzzle
      bot.health = bot.maxHealth;
      bot.isAlive = true;
      bot.mesh.visible = true;
      game.playerKills = 0;
      game.weaponSystem.fireCooldown = 0;
      game.weaponSystem.ammoInMag = game.weaponSystem.currentWeapon.magazineSize;
      game.weaponSystem.owned.add('rifle');
      game.weaponSystem.switchWeapon(1); // rifle: daño de perfil para el test
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

      // Test 8: DUELO DE ESCUADRAS POR RONDAS — eliminar al equipo enemigo
      // COMPLETO gana la RONDA (no la partida). La partida se gana a 4 rondas.
      game.matchState = 'PLAYING';
      game.gameMode = 'squad';
      game._resultShown = false;
      game.phase = 'combat';       // ronda en pleno combate
      game.round = 1;
      game.roundWins = { ally: 0, enemy: 0 };
      const botB = game.bots[1]; // ALIADO_2 — lo usamos como víctima
      const bBStart = botB.position.clone();
      // matar a los 4 enemigos con un atacante aliado
      for (let bi = 3; bi <= 6; bi++) {
        const b = game.bots[bi];
        b.isAlive = true; b.health = 1;
        game.applyDamage(b, 999, 'body', botB);
      }
      const roundWon = game.roundWins.ally === 1 && game.phase === 'roundEnd'
        && document.getElementById('round-banner').classList.contains('show');
      log('8 SQUAD ROUND WIN ON ELIMINATION', roundWon,
        `roundWins ${game.roundWins.ally}-${game.roundWins.enemy} phase ${game.phase} banner ${document.getElementById('round-banner').classList.contains('show')}`);
      // 4 rondas ganadas = FIN DEL DUELO (VICTORIA)
      game.phase = 'roundEnd';
      game.roundWins.ally = 4;
      game._afterRoundEnd();
      const matchWon = game.matchState === 'FINISHED'
        && document.getElementById('result-title').textContent === 'VICTORIA';
      log('8b SQUAD MATCH AT 4 ROUND WINS', matchWon, `state ${game.matchState}`);
      botB.respawn(bBStart);
      game.matchState = 'LOADING';
      game._resultShown = false;

      // Test 9: 'next' cycles through all three weapons (KeyE / mobile button)
      game.weaponSystem.isReloading = false;
      game.weaponSystem.fireCooldown = 0;
      game.weaponSystem.owned = new Set(['rifle', 'pistol', 'shotgun', 'smg']);
      game.weaponSystem.switchWeapon(1); // pistol (pos 1)
      game.weaponSystem.switchWeapon('next');
      const w1 = game.weaponSystem.currentWeapon.name;
      game.weaponSystem.switchWeapon('next');
      const w2 = game.weaponSystem.currentWeapon.name;
      game.weaponSystem.switchWeapon('next');
      const w3 = game.weaponSystem.currentWeapon.name;
      const cycleOk = w1 === 'Pistol' && w2 === 'Shotgun' && w3 === 'SMG';
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

      // Test 14: damage-direction convention — yaw 0 faces -Z, so an attacker
      // to the player's RIGHT (east/+X) must read +90°, front reads 0°.
      game.playerController.yaw = 0;
      game.player.position.set(0, 1.65, 0);
      const botDir = game.bots[5];
      const botDirStart = botDir.position.clone();
      botDir.position.set(10, 1.65, 0); // east = player's right
      const angleRight = game._damageAngle(botDir);
      botDir.position.set(0, 1.65, -10); // north = in front
      const angleFront = game._damageAngle(botDir);
      const dirOk = Math.abs(angleRight - Math.PI / 2) < 0.001 && Math.abs(angleFront) < 0.001;
      log('14 DAMAGE DIRECTION ANGLES', dirOk, `right ${(angleRight * 180 / Math.PI).toFixed(0)}° front ${(angleFront * 180 / Math.PI).toFixed(0)}°`);
      botDir.respawn(botDirStart);

      // Test 15: ADS is a TAP-TO-LATCH on touch (the old hold-to-aim captured
      // the finger: with two thumbs there was none left for the camera).
      const btnAim = document.getElementById('btn-aim');
      const aimDown = () => btnAim.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 901, bubbles: true, cancelable: true }));
      aimDown();
      const aimOn = game.input.aim === true && btnAim.classList.contains('active')
        && document.getElementById('mobile-controls').classList.contains('aiming');
      aimDown();
      const aimOff = game.input.aim === false && !btnAim.classList.contains('active');
      log('15 ADS TOGGLE LATCH', aimOn && aimOff, `on:${aimOn} off:${aimOff}`);

      // Test 16: crouch — blend rises, eye lowers, feet stay planted.
      game.input.crouch = true;
      const pc16 = game.playerController;
      pc16.respawn(new THREE.Vector3(0, 1.65, 18)); // validated spawn — always clear
      game.input._keys.clear(); // test 2 left a stale move vector — idle player
      game.input.update();
      for (let i = 0; i < 5; i++) { pc16.update(1 / 60); if (i < 2) console.log('[DBG16]', i, pc16.player.position.y.toFixed(3), pc16.height.toFixed(3), pc16.onGround); }
      const feetBefore = pc16.player.position.y - pc16.height;
      console.log('[DBG16] pre-crouch feet', feetBefore.toFixed(3), 'y', pc16.player.position.y.toFixed(3));
      for (let i = 0; i < 40; i++) pc16.update(1 / 60);
      const feetAfter = pc16.player.position.y - pc16.height;
      const crouchOk = pc16.crouchBlend > 0.9 && pc16.height < 1.3 && Math.abs(feetBefore - feetAfter) < 0.02;
      log('16 CROUCH ANIMATED', crouchOk, `blend ${pc16.crouchBlend.toFixed(2)} h ${pc16.height.toFixed(2)} feetB ${feetBefore.toFixed(3)} feetA ${feetAfter.toFixed(3)} pos ${pc16.player.position.x.toFixed(1)},${pc16.player.position.y.toFixed(2)},${pc16.player.position.z.toFixed(1)} ground${pc16.onGround}`);
      game.input.crouch = false;
      for (let i = 0; i < 40; i++) pc16.update(1 / 60);

      // Test 17: fire-drag feeds its OWN accumulator — releasing the look-zone
      // finger must never wipe pending fire-drag deltas (and vice versa).
      const input17 = game.input;
      const btnFire = document.getElementById('btn-fire');
      btnFire.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 910, clientX: 100, clientY: 100, bubbles: true, cancelable: true }));
      btnFire.dispatchEvent(new PointerEvent('pointermove', { pointerId: 910, clientX: 400, clientY: 150, bubbles: true, cancelable: true }));
      input17._touchLook.x = 5; input17._touchLook.y = 3;
      input17._touchLook.active = false;
      const fireHeld = input17.fire === true;
      const delta17 = input17.getLookDelta();
      // fire-drag delta (400-100, 150-100) + stale look (5, 3) = (305, 53)
      const fireDeltaOk = delta17.x === 305 && delta17.y === 53;
      log('17 FIRE-DRAG LOOK', fireHeld && fireDeltaOk, `fire ${fireHeld} dx ${delta17.x} dy ${delta17.y}`);
      input17._firePointers.delete(910);
      input17.fire = input17._firePointers.size > 0;

      // Test 18: the result screen lives INSIDE #overlay + FFA legacy:
      // 20 kills (modo Todos contra Todos) finaliza la partida con VICTORIA.
      const rb18 = document.getElementById('result-block');
      game.matchState = 'PLAYING';
      game._resultShown = false;
      game.gameMode = 'ffa';
      game.phase = 'ffa';
      game.playerKills = game.killTarget;
      game.applyDamage(game.bots[6], 999, 'body', game.player);
      const title18 = document.getElementById('result-title').textContent;
      const r18 = rb18.getBoundingClientRect();
      const visible18 = r18.width > 100 && r18.top < innerHeight && r18.bottom > 0;
      log('18 RESULT SCREEN VISIBLE (FFA 20 KILLS)', document.getElementById('overlay').contains(rb18) && title18 === 'VICTORIA' && visible18,
        `inOverlay:${document.getElementById('overlay').contains(rb18)} "${title18}" rect ${r18.width.toFixed(0)}x${r18.height.toFixed(0)}@${r18.top.toFixed(0)}`);
      game.playerKills = 0;
      game._resultShown = false;
      game.matchState = 'LOADING';

      // ── Test 19: FASE DE COMPRA — abrir startRound abre la tienda animada ──
      game.matchState = 'PLAYING';
      game.gameMode = 'squad';
      game.startRound(2);
      const bp = document.getElementById('buy-phase');
      const buyOpen = bp.classList.contains('show')
        && game.phase === 'buy'
        && game.bots.every(b => b.weaponKey);
      log('19 BUY PHASE OPENS + BOTS BUY', buyOpen,
        `shop ${bp.classList.contains('show')} phase ${game.phase} weapons ${game.bots.map(b=>b.weaponKey).join(',')}`);
      // skins: aplicar cambia el color del acento del viewmodel
      game.weaponSystem.owned.add('rifle');
      game.weaponSystem.switchWeapon(1);
      const accentBefore = game.weaponSystem._weaponModels.rifle.userData.parts.accent.color.getHexString();
      game.skinsFor = { oro: { name: 'Oro', price: 0 } };
      game.coins = 5000;
      game.buySkin('oro');
      const accentAfter = game.weaponSystem._weaponModels.rifle.userData.parts.accent.color.getHexString();
      log('20 SKIN APPLIES TO WEAPON', accentBefore !== accentAfter && game.skins.rifle === 'oro',
        `accent ${accentBefore} → ${accentAfter}`);
      // inmunidad se ROMPE al disparar (regla Free Fire)
      game.matchState = 'PLAYING';
      game.phase = 'combat';
      game.immuneUntil = game.matchTime + 5;
      game.onPlayerFired();
      const immuneBroken = game.matchTime >= game.immuneUntil;
      log('21 IMMUNITY BREAKS ON FIRE', immuneBroken, `immuneUntil ${game.immuneUntil.toFixed(2)} matchTime ${game.matchTime.toFixed(2)}`);
      game.matchState = 'LOADING';
      game._shopOpen = false;

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
      // acortar la fase de compra para la captura del combate
      game.phaseTime = 1.5;
    }
    if(mode==='combat'){
      game.startMatch();
      document.getElementById('overlay').classList.add('hidden');
      // fase de compra corta → combate real con bots GLB en movimiento
      game.phaseTime = 1.2;
      }
  }, 600);
}
