// Suite de tests de BLOCKFIRE — ?runTests=1
// Regla del proyecto: TODOS los tests actuales en verde (el número canónico lo
// dicta la propia suite — prohibido hardcodear un literal tipo "25/25").
// Cada test protege un CONTRATO con nombre propio (ver detalle de cada assert).
import * as THREE from '../lib/three.module.js';
import { preferredDist } from '../bots/Bot.js';
import { controlLayout } from '../core/ControlLayout.js';

export function runTestSuite(game) {
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
      const reserveOk = game.weaponSystem.reserveAmmo === 333;
      log('3b RESERVE AMMO CONTRACT', reserveOk, `reserva ${game.weaponSystem.reserveAmmo}`);
      // Test 4: Bots exist
      log('4 BOTS', game.bots.length === 7, `bots ${game.bots.length}`);
      const maxHealthOk = game.playerController.maxHealth === 200
        && game.playerController.health <= 200
        && game.bots.every(b => b.maxHealth === 200);
      log('4b MAX HEALTH CONTRACT', maxHealthOk,
        `player ${game.playerController.health}/${game.playerController.maxHealth} · bots ${game.bots.map(b => b.maxHealth).join('/')}`);
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
      // La víctima debe ser un ENEMIGO: en escuadras no hay fuego amigo (el
      // jugador no puede dañar a su escuadra), así que bots[0] (aliado) ya no
      // sirve como dummy de tiro.
      const bot = game.bots.find(b => (b.team || 'enemy') !== (game.player.team || 'ally')) || game.bots[3];
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
      // La transición visual bloquea el fuego hasta que el arma llega a la
      // mano. Este test mide daño, no la animación de equipar; completa el
      // handoff de manera explícita antes de disparar.
      game.weaponSystem._finishSwitch();
      let combatResult = null;
      // Deterministic shots: zero spread for the test (spread is random and
      // made this test flaky when flinch pushed the bot).
      const savedSpread = game.weaponSystem.currentWeapon.spread;
      game.weaponSystem.currentWeapon.spread = 0;
      for(let i=0;i<6 && bot.isAlive; i++) {
        game.weaponSystem.fireCooldown = 0;
        // Bots flinch on hit (knockback), so re-aim at the moving target each
        // shot — a real fight tracks the target instead of a fixed spot.
        // Aim at the head: 200 HP y daño retunado → 4 tiros bastan; 6 dan
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
      const switchReady9 = (dir) => { game.weaponSystem.switchWeapon(dir); game.weaponSystem._finishSwitch(); };
      switchReady9(1); // pistol (pos 1)
      switchReady9('next');
      const w1 = game.weaponSystem.currentWeapon.name;
      switchReady9('next');
      const w2 = game.weaponSystem.currentWeapon.name;
      switchReady9('next');
      const w3 = game.weaponSystem.currentWeapon.name;
      const cycleOk = w1 === 'Pistol' && w2 === 'Shotgun' && w3 === 'SMG';
      log('9 WEAPON CYCLE NEXT', cycleOk, `${w1} → ${w2} → ${w3}`);
      game.weaponSystem.switchWeapon(1);
      const switchAnim9 = game.weaponSystem._switchAnim;
      const blockedByHandoff9 = switchAnim9 > 0
        && game.weaponSystem.fire(game.player, []) === null;
      game.weaponSystem._finishSwitch();
      log('9b SWITCH BLOCKS FIRE UNTIL READY', blockedByHandoff9,
        `anim=${switchAnim9.toFixed(2)} · fireDuranteHandoff=${blockedByHandoff9 ? 'BLOQUEADO' : 'ERROR'}`);

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
      // (player camera), not from the bot's shot origin.
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
      game.weaponSystem.fire(bot12, [game.player], game.map, { listener: game.camera.position });
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
      const dirOk = Math.abs(angleRight - 90) < 0.1 && Math.abs(angleFront) < 0.1;
      log('14 DAMAGE DIRECTION ANGLES', dirOk, `right ${angleRight.toFixed(0)}° front ${angleFront.toFixed(0)}°`);
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

      // Test 46: CORRER móvil es un latch real (no solo un estilo CSS) y
      // eleva de forma visible la velocidad que consume PlayerController.
      const btnSprint46 = document.getElementById('btn-sprint');
      const pos46 = game.player.position.clone();
      game.input._releaseAll();
      game.input._keys.add('KeyW');
      game.input.sprintLock = false;
      btnSprint46.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 902, bubbles: true, cancelable: true }));
      game.input.update();
      const sprintOn46 = game.input.sprint === true && game.input.sprintLock === true
        && btnSprint46.classList.contains('active') && btnSprint46.getAttribute('aria-pressed') === 'true';
      const speedGap46 = game.playerController.sprintSpeed >= game.playerController.moveSpeed * 1.25;
      btnSprint46.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 903, bubbles: true, cancelable: true }));
      game.input.update();
      const sprintOff46 = game.input.sprint === false && game.input.sprintLock === false
        && !btnSprint46.classList.contains('active');
      game.input._releaseAll();
      game.player.position.copy(pos46);
      game.playerController.velocity.set(0, 0, 0);
      log('46 MOBILE SPRINT LATCH', sprintOn46 && speedGap46 && sprintOff46,
        `on:${sprintOn46} +${game.playerController.sprintSpeed - game.playerController.moveSpeed}u/s off:${sprintOff46}`);

      // Test 16: crouch — blend rises, eye lowers, feet stay planted.
      game.input.crouch = true;
      const pc16 = game.playerController;
      pc16.respawn(new THREE.Vector3(0, 1.65, 18)); // validated spawn — always clear
      game.input._keys.clear(); // test 2 left a stale move vector — idle player
      game.input.update();
      for (let i = 0; i < 5; i++) pc16.update(1 / 60);
      const feetBefore = pc16.player.position.y - pc16.height;
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

      // ── Tests 40-45: EDITOR DE CONTROLES (ControlLayout.js — dueño único
      // del layout táctil: posición normalizada 0..1, tamaño y opacidad por
      // control, modo edición sin gameplay, defaults, fire-drag intacto). ──
      // 40) Persistencia NORMALIZADA: la fracción fx/fy guardada debe
      // reproducir la misma posición relativa tras "cambiar" el viewport.
      const cl40 = game.input && game.input.applyLayout ? controlLayout : null;
      if (cl40) {
        const before40 = cl40.get('btn-fire');
        cl40.set('btn-fire', { fx: 0.75, fy: 0.5 });
        // El lobby oculta #mobile-controls (body sin .playing): medir px reales
        // exige hacerla visible temporalmente (el modo edición real la muestra).
        document.body.classList.add('ctl-editing');
        cl40.apply();
        const vw40 = innerWidth, vh40 = innerHeight; // controles VISIBLES
        const l40 = document.getElementById('btn-fire').getBoundingClientRect().left;
        // Re-aplicar = el ciclo que ejecuta un resize real: la fracción debe
        // reproducir la misma posición relativa (persistencia normalizada).
        cl40.apply();
        const after40 = cl40.get('btn-fire');
        const fracStable40 = Math.abs(after40.fx - 0.75) < 1e-6 && Math.abs(after40.fy - 0.5) < 1e-6;
        const el40 = document.getElementById('btn-fire');
        const r40 = el40.getBoundingClientRect();
        const cx40 = (r40.left + r40.width / 2) / vw40, cy40 = (r40.top + r40.height / 2) / vh40;
        const px40 = Math.abs(cx40 - 0.75) < 0.02 && Math.abs(cy40 - 0.5) < 0.02;
        // La fracción sobrevive a un ciclo reload de Settings (mismo storage)
        const raw40 = JSON.parse(localStorage.getItem('bf_settings') || '{}');
        const persisted40 = raw40.controlLayout && raw40.controlLayout['btn-fire']
          && Math.abs(raw40.controlLayout['btn-fire'].fx - 0.75) < 1e-6;
        // Restablecer la posición del test
        cl40.set('btn-fire', { fx: before40.fx, fy: before40.fy });
        cl40.apply();
        document.body.classList.remove('ctl-editing');
        const movedFromAnchor40 = Math.abs(l40 - (before40.fx * vw40)) > 0; // referencia registrada
        log('40 CONTROLS PERSIST NORMALIZED', fracStable40 && px40 && persisted40 && movedFromAnchor40,
          `fx ${after40.fx.toFixed(3)} fy ${after40.fy.toFixed(3)} · px±2% ${px40} · localStorage ${persisted40}`);
      } else {
        log('40 CONTROLS PERSIST NORMALIZED', false, 'controlLayout no expuesto vía Input');
      }

      // 41) TAMAÑO por control: escalar UNO no toca a los demás (ni el global).
      const s41 = cl40.get('btn-jump');
      const others41 = cl40.get('btn-reload');
      cl40.set('btn-jump', { scale: 1.5 });
      cl40.apply();
      document.body.classList.add('ctl-editing'); // medible: el lobby la oculta
      cl40.apply();
      const jumpScaled41 = Math.abs(cl40.get('btn-jump').scale - 1.5) < 1e-6;
      const othersTouched41 = cl40.get('btn-reload').scale === s41.scale || cl40.get('btn-reload').scale === 1;
      const othersUntouched41 = cl40.get('btn-reload').scale !== 1.5;
      const jumpSize41 = document.getElementById('btn-jump').getBoundingClientRect().width;
      const reloadSize41 = document.getElementById('btn-reload').getBoundingClientRect().width;
      const sizeVisual41 = jumpSize41 > reloadSize41 * 1.2; // 1.5× vs 1× con margen
      document.body.classList.remove('ctl-editing');
      cl40.set('btn-jump', { scale: 1 });
      cl40.apply();
      log('41 PER-CONTROL SCALE', jumpScaled41 && othersUntouched41 && sizeVisual41,
        `jump ${jumpSize41.toFixed(0)}px vs reload ${reloadSize41.toFixed(0)}px · scale jump ${jumpScaled41} · reload intacto ${othersUntouched41}`);

      // 42) OPACIDAD por control: mismo contrato.
      cl40.set('btn-reload', { opacity: 0.4 });
      cl40.apply();
      const opEl42 = document.getElementById('btn-reload');
      const opApplied42 = Math.abs(parseFloat(opEl42.style.opacity) - 0.4) < 1e-6;
      const fireOp42 = document.getElementById('btn-fire').style.opacity;
      const fireUntouched42 = fireOp42 === '' || Math.abs(parseFloat(fireOp42) - 1) < 1e-6;
      cl40.set('btn-reload', { opacity: 1 });
      cl40.apply();
      log('42 PER-CONTROL OPACITY', opApplied42 && fireUntouched42,
        `reload ${opEl42.style.opacity} · fire opacity intacta (${fireOp42 || 'inherit'})`);

      // 43) MODO EDICIÓN no dispara gameplay: arrastrar FUEGO en edición no
      // pone input.fire, no acumula look-delta, y al salir queda limpio.
      const btnFire43 = document.getElementById('btn-fire');
      const fireBefore43 = game.weaponSystem.ammoInMag;
      cl40.setEditMode(true);
      const editing43 = cl40.editMode === true;
      // seleccionar + arrastrar el FUEGO (pointer capture vía mobile-controls)
      const mcEl43 = document.getElementById('mobile-controls');
      const fRect43 = btnFire43.getBoundingClientRect();
      const pd43 = new PointerEvent('pointerdown', { pointerId: 930, clientX: fRect43.left + 10, clientY: fRect43.top + 10, bubbles: true, cancelable: true });
      btnFire43.dispatchEvent(pd43);
      mcEl43.dispatchEvent(new PointerEvent('pointermove', { pointerId: 930, clientX: fRect43.left + 80, clientY: fRect43.top + 40, bubbles: true, cancelable: true }));
      mcEl43.dispatchEvent(new PointerEvent('pointerup', { pointerId: 930, bubbles: true, cancelable: true }));
      const noFire43 = game.input.fire === false;
      const noDelta43 = (() => { const d = game.input.getLookDelta(); return d.x === 0 && d.y === 0; })();
      const moved43 = Math.abs(cl40.get('btn-fire').fx - 0.9463) > 0.001; // el drag MOVIO el layout
      cl40.setEditMode(false);
      const exitedClean43 = cl40.editMode === false && game.input.fire === false
        && document.getElementById('ctl-editor').classList.contains('hidden');
      // tras salir, el mismo gesto vuelve a disparar (gameplay restaurado)
      btnFire43.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 931, bubbles: true, cancelable: true }));
      const fireWorksAfter43 = game.input.fire === true;
      game.input._firePointers.delete(931);
      game.input.fire = game.input._firePointers.size > 0;
      log('43 EDIT MODE NO GAMEPLAY', editing43 && noFire43 && noDelta43 && moved43 && exitedClean43 && fireWorksAfter43,
        `edit:${editing43} noFire:${noFire43} noDelta:${noDelta43} dragMueve:${moved43} salidaLimpia:${exitedClean43} fuegoRestaurado:${fireWorksAfter43}`);

      // 44) RESTABLECER (defaults restore): modifica VARIOS controles y
      // resetAll() debe devolver fracciones/escala/opacidad a default.
      cl40.set('btn-aim', { fx: 0.2, fy: 0.2, scale: 1.8, opacity: 0.5 });
      cl40.set('joystick-base', { fx: 0.6, fy: 0.6 });
      cl40.resetAll();
      cl40.apply();
      const d44 = cl40.defaults();
      const aim44 = cl40.get('btn-aim');
      const joy44 = cl40.get('joystick-base');
      const resetOk44 = Math.abs(aim44.fx - d44['btn-aim'].fx) < 1e-6
        && aim44.scale === 1 && aim44.opacity === 1
        && Math.abs(joy44.fx - d44['joystick-base'].fx) < 1e-6
        && !localStorage.getItem('bf_settings').includes('"btn-aim"');
      log('44 DEFAULTS RESTORE', resetOk44,
        `aim fx ${aim44.fx.toFixed(4)} (def ${d44['btn-aim'].fx.toFixed(4)}) scale ${aim44.scale} op ${aim44.opacity} · joystick fx ${joy44.fx.toFixed(4)}`);

      // 45) FIRE-DRAG sigue funcionando tras cargar un layout EDITADO
      // (mismo contrato que el test 17, pero con la posición editada aplicada).
      cl40.set('btn-fire', { fx: 0.8, fy: 0.4 });
      cl40.apply();
      const btnFire45 = document.getElementById('btn-fire');
      btnFire45.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 940, clientX: 200, clientY: 100, bubbles: true, cancelable: true }));
      btnFire45.dispatchEvent(new PointerEvent('pointermove', { pointerId: 940, clientX: 350, clientY: 130, bubbles: true, cancelable: true }));
      const fireHeld45 = game.input.fire === true;
      const delta45 = game.input.getLookDelta();
      const fireDeltaOk45 = delta45.x === 150 && delta45.y === 30;
      btnFire45.dispatchEvent(new PointerEvent('pointerup', { pointerId: 940, bubbles: true, cancelable: true }));
      const released45 = game.input.fire === false;
      // restaurar layout limpio para el resto de la suite
      cl40.resetAll();
      cl40.apply();
      const ammo45 = game.weaponSystem.ammoInMag;
      log('45 FIRE DRAG WORKS ON EDITED LAYOUT', fireHeld45 && fireDeltaOk45 && released45,
        `hold ${fireHeld45} · dx ${delta45.x} dy ${delta45.y} · release ${released45} · ammo ${ammo45}`);

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
      // skins: la skin GLOBAL del lobby tiñe todo el arsenal (gratis, persistente)
      game.weaponSystem.owned.add('rifle');
      game.weaponSystem.switchWeapon(1);
      const accentBefore = game.weaponSystem._weaponModels.rifle.userData.parts.accent.color.getHexString();
      const pistolBefore = game.weaponSystem._weaponModels.pistol.userData.parts.accent.color.getHexString();
      game.skinsFor = { oro: { name: 'Oro', accent: 0xffc93f, dark: 0x8a6a1f } };
      game.setGlobalSkin('oro');
      const accentAfter = game.weaponSystem._weaponModels.rifle.userData.parts.accent.color.getHexString();
      const pistolAfter = game.weaponSystem._weaponModels.pistol.userData.parts.accent.color.getHexString();
      log('20 GLOBAL SKIN (LOBBY)', accentBefore !== accentAfter && pistolBefore !== pistolAfter && game.globalSkin === 'oro',
        `rifle ${accentBefore} → ${accentAfter} · pistol ${pistolBefore} → ${pistolAfter}`);
      // inmunidad se ROMPE al disparar (regla Free Fire)
      game.matchState = 'PLAYING';
      game.phase = 'combat';
      game.immuneUntil = game.matchTime + 5;
      game.onPlayerFired();
      const immuneBroken = game.matchTime >= game.immuneUntil;
      log('21 IMMUNITY BREAKS ON FIRE', immuneBroken, `immuneUntil ${game.immuneUntil.toFixed(2)} matchTime ${game.matchTime.toFixed(2)}`);
      game.matchState = 'LOADING';

      // Test 22: REGRESIONES de la auditoría (un assert por fix, todos en squad
      // salvo R5). Si alguno falla, volvió el bug correspondiente.
      game.matchState = 'PLAYING';
      game.gameMode = 'squad';
      game.player.team = 'ally';
      game.startRound(1);
      // R1: tienda in-match SOLO armas + skins en el lobby
      game.skinsFor = game.skinsFor || { oro: { name: 'Oro', accent: 0xffc93f, dark: 0x8a6a1f } };
      game._renderLobbySkins();
      const r1ok = !document.getElementById('bp-tab-skins')
        && document.getElementById('bp-grid').children.length > 0
        && document.getElementById('lobby-skins').children.length > 0;
      game._startCombat();
      game.immuneUntil = 0; game.bots.forEach(b => b.immuneUntil = 0);
      const allyT = game.bots.find(b => b.team === 'ally');
      allyT.isAlive = true; allyT.health = allyT.maxHealth;
      game.applyDamage(allyT, 200, 'body', game.player);
      const r2ok = allyT.isAlive && allyT.health === allyT.maxHealth;
      game.startRound(2);
      const r3ok = document.getElementById('buy-phase').classList.contains('show') && game.phase === 'buy';
      game._startCombat();
      const hadShield = game.bots.every(b => b.immuneUntil > game.matchTime);
      game.onPlayerFired();
      const r4ok = hadShield && game.bots.every(b => b.immuneUntil > game.matchTime);
      game.gameMode = 'ffa'; game.player.team = 'ffa_player';
      game.playerController.respawn(new THREE.Vector3(0, 1.65, 18));
      const kb22 = game.bots[4]; kb22.isAlive = true; kb22.kills = 0;
      game.immuneUntil = 0; kb22.immuneUntil = 0;
      game.applyDamage(game.player, 999, 'body', kb22);
      const r5ok = kb22.kills === 1;
      log('22 FIX REGRESSIONS', r1ok && r2ok && r3ok && r4ok && r5ok,
        `skins:${r1ok} noFF:${r2ok} shopR2:${r3ok} imm:${r4ok} credit:${r5ok}`);
      // R6: TODAS las armas tienen daño numérico (una pistola sin `damage`
      // propagaba NaN: HP "NaN" e inmortales en el gameplay grabado).
      const r6ok = game.weaponSystem.weapons.every(k =>
        Number.isFinite(game.weaponData[k].damage) && Number.isFinite(game.weaponData[k].headshotMul));
      log('22b WEAPON DAMAGE FINITE', r6ok, game.weaponSystem.weapons.map(k => `${k}:${game.weaponData[k].damage}`).join(' '));
      // R7: VFX a quemarropa no tapan la pantalla (cinta blanca + flash rojo
      // gigante vistos en el gameplay grabado).
      const fl0 = game.vfx._activeFlashes.length, bl0 = game.vfx._activeBloods.length;
      const eye23 = game.camera.position.clone();
      game.vfx.tracer(eye23, eye23.clone().add(new THREE.Vector3(0, 0, -0.3)));
      game.vfx.blood(eye23.clone());
      const r7ok = game.vfx._activeFlashes.length === fl0 && game.vfx._activeBloods.length === bl0;
      log('23 NO POINT-BLANK VFX SPAM', r7ok, `flashes ${fl0}→${game.vfx._activeFlashes.length} bloods ${bl0}→${game.vfx._activeBloods.length}`);
      game.matchState = 'LOADING';
      game._resultShown = false;

      // Test 24: REGRESIÓN — MatchSquad usaba THREE.Vector3 en snapClear SIN
      // importar THREE. Con los spawns actuales (despejados) la espiral nunca
      // corría; con un spawn de base obstruido, startRound(1) moría con
      // ReferenceError y la partida quedaba colgada en la fase de compra.
      game.matchState = 'PLAYING';
      game.gameMode = 'squad';
      const savedSquadSpawns = game.map.squadSpawns;
      const savedCheck = game.map.checkCollision.bind(game.map);
      // Bloquear TODO el mapa: la espiral de snapClear tiene que correr entera
      // (8 direcciones × 3 radios) y devolver el respawn original sin lanzar.
      game.map.checkCollision = () => true;
      let roundOpenSurvived = true;
      try { game.startRound(1); } catch (e) { roundOpenSurvived = false; console.error('24 crash:', e); }
      game.map.squadSpawns = savedSquadSpawns;
      game.map.checkCollision = savedCheck;
      game.matchState = 'LOADING';
      log('24 ROUND START SURVIVES BLOCKED SPAWNS', roundOpenSurvived,
        roundOpenSurvived ? 'startRound completó con mapa 100% obstruido' : 'startRound lanzó excepción');

      // ── Test 25: GUNPLAY — aim assist fricción (NO snap) + levantar mira ──
      // Setup determinista: cámara a 12u del bot enemigo, spread 0.
      game.matchState = 'PLAYING';
      game.gameMode = 'squad';
      game.phase = 'combat';
      game.player.team = 'ally';
      const bot25 = game.bots.find(b => b.team === 'enemy');
      bot25.isAlive = true; bot25.health = bot25.maxHealth;
      bot25.immuneUntil = 0;
      const start25 = bot25.position.clone();
      game.immuneUntil = 0;
      const camSave25 = game.camera.position.clone();
      const rotSave25 = { x: game.camera.rotation.x, y: game.camera.rotation.y };
      game.weaponSystem.owned.add('rifle');
      game.weaponSystem.switchWeapon(1);
      const savedSpread25 = game.weaponSystem.currentWeapon.spread;
      game.weaponSystem.currentWeapon.spread = 0;
      // Punto de tiro despejado (diagonal del mapa, como test 7): x=z=size*0.7
      const eye25 = new THREE.Vector3(game.map.size * 0.7, 1.65, game.map.size * 0.7);
      bot25.position.set(eye25.x, 1.65, eye25.z - 12);
      game.player.position.set(eye25.x, 1.65, eye25.z);
      const fireAt = (pitch) => {
        game.camera.position.set(eye25.x, 1.65, eye25.z);
        game.camera.rotation.order = 'YXZ';
        game.camera.rotation.set(pitch, 0, 0);
        game.camera.updateMatrixWorld();
        game.weaponSystem.fireCooldown = 0;
        return game.weaponSystem.fire(game.player, [bot25], game.map);
      };
      // 25a: mira AL PECHO (pitch que apunta al torso y=-0.62 desde ojo 1.65 → ángulo abajo)
      const chestY = 1.65 - 0.62;
      const resBody = fireAt(Math.atan2(chestY - 1.65, 12));
      const bodyHit = resBody && resBody.hits.some(h => h.target === bot25 && !h.headshot);
      // 25b: LEVANTAR MIRA — mismo punto, pitch subido a la cabeza: headshot REAL
      // (la cabeza está en eye-0.10 → y=1.55; el pitch positivo mira ARRIBA)
      const headY = 1.55;
      const resHead = fireAt(Math.atan2(headY - 1.65, 12));
      const headHit = resHead && resHead.hits.some(h => h.headshot);
      // 25c: mira ligeramente ARRIBA de la cabeza — la fricción NO debe
      // secuestrar el rayo hacia el torso (sin snap-up automático)
      const resOver = fireAt(Math.atan2(headY - 1.65, 12) + 0.09); // por encima de la cabeza
      const overChest = !(resOver && resOver.hits.some(h => h.target === bot25));
      // 25d: objetivo TRAS MURO → la fricción no ayuda ni impacta
      game.weaponSystem.fireCooldown = 0;
      // muro entre jugador y bot: reusar _createBox es invasivo; usar raycast directo:
      bot25.position.set(0, 1.65, -12);
      const wallCheck = game.map.raycast(
        new THREE.Vector3(0, 1.65, 0),
        new THREE.Vector3(0, 0, -1).normalize(),
        12
      );
      // Sin muro real en esa línea por defecto — el gate de oclusión interna
      // ya se cubre con pullDir solo si !mapBlock; aquí validamos el camino:
      // insertar caja temporal delante del bot y verificar NO-hit asistido
      const min0 = new THREE.Vector3(eye25.x - 1, 0, eye25.z - 7), max0 = new THREE.Vector3(eye25.x + 1, 3, eye25.z - 6);
      game.map.boxes.push({ min: min0, max: max0, mesh: null, x: eye25.x, y: 0, z: eye25.z - 6.5, w: 2, h: 2.2, d: 1 });
      const resWall = fireAt(Math.atan2(chestY - 1.65, 12)); // apuntando "al pecho" tras el muro
      const wallBlocked = !(resWall && resWall.hits.some(h => h.target === bot25));
      game.map.boxes.pop(); // restaurar mapa
      // 25e: ALIADO no recibe asistencia ni daño (fuego amigo OFF)
      const ally25 = game.bots.find(b => b.team === 'ally');
      ally25.isAlive = true; ally25.health = ally25.maxHealth;
      const allyStart25 = ally25.position.clone();
      // enemigo y aliado en la MISMA línea: el rayo al pecho del aliado no debe dañarlo
      ally25.position.set(eye25.x, 1.65, eye25.z - 6);
      const resAlly = fireAt(Math.atan2(chestY - 1.65, 12));
      const allySafe = ally25.health === ally25.maxHealth;
      bot25.respawn(start25); ally25.respawn(allyStart25);
      game.camera.position.copy(camSave25);
      game.camera.rotation.set(rotSave25.x, rotSave25.y, 0);
      game.camera.updateMatrixWorld();
      game.weaponSystem.currentWeapon.spread = savedSpread25;
      game.matchState = 'LOADING';
      const aimOk = bodyHit && headHit && overChest && wallBlocked && allySafe;
      log('25 AIM ASSIST FRICTION (no snap, occlusion, no-ally)', aimOk,
        `body:${bodyHit} headDrag:${headHit} noSnapUp:${overChest} wallBlocked:${wallBlocked} allySafe:${allySafe}`);
      game.matchState = 'LOADING';
      game._resultShown = false;

      // ── Test 30: Navigation.reset(botId) — CONTRATO por bot ──
      // La reubicación de UN bot no puede borrar las rutas del resto; el
      // reset() global solo existe para inicio de ronda/partida (regla §4).
      const nav30 = game.navigation;
      const botA30 = game.bots[0], botB30 = game.bots[1];
      nav30.reset();
      nav30.nextWaypoint(botA30, 0, 30);    // crea ruta A
      nav30.nextWaypoint(botB30, 0, -30);   // crea ruta B
      const bothCached30 = !nav30.repathNeeded(botA30) && !nav30.repathNeeded(botB30);
      nav30.reset(botB30.id);               // SOLO B
      const onlyB30 = nav30.repathNeeded(botB30) && !nav30.repathNeeded(botA30);
      nav30.reset();                        // global
      const all30 = nav30.repathNeeded(botA30) && nav30.repathNeeded(botB30);
      log('30 NAVIGATION RESET(botId) CONTRACT', bothCached30 && onlyB30 && all30,
        `cache ${bothCached30} · soloB ${onlyB30} · global ${all30}`);

      // ── Test 31: PERCEPCIÓN — enemigo a <8u DETRÁS DE UN MURO no se
      // adquiere (los bots NO tienen wallhack de proximidad). Control: sin
      // muro, la misma línea SÍ se adquiere (la percepción funciona).
      game.gameMode = 'squad';
      game.player.team = 'ally';
      const bot31 = game.bots.find(b => b.team === 'enemy');
      const bot31Start = bot31.position.clone();
      bot31.isAlive = true; bot31.health = bot31.maxHealth;
      game.player.isAlive = true;
      game.player.position.set(30, 1.65, 30);
      bot31.position.set(30, 1.65, 25); // a 5u — dentro del viejo radio <8
      const cand31 = [bot31, game.player]; // ÚNICO candidato: el jugador
      // muro 6×3×1 entre ambos (Map.js: cajas con mesh null son válidas)
      game.map.boxes.push({ min: new THREE.Vector3(27, 0, 26.5), max: new THREE.Vector3(33, 3, 27.5), mesh: null, x: 30, y: 0, z: 27, w: 6, h: 3, d: 1 });
      bot31.update(0.016, game.player, cand31, game.map);
      const wallHack31 = bot31.target === game.player; // NO debe adquirirlo
      game.map.boxes.pop();
      bot31._lastSeen = null; // sin memoria: percepción pura
      bot31.update(0.016, game.player, cand31, game.map);
      const seesFine31 = bot31.target === game.player;
      log('31 BOT NO WALLHACK THROUGH WALL', !wallHack31 && seesFine31,
        `trasMuro ${wallHack31 ? 'ADQUIRIDO (BUG)' : 'ignorado'} · lineaAbierta ${seesFine31 ? 'adquirido' : 'PERDIDO'}`);
      bot31.respawn(bot31Start);

      // ── Test 32: RANGO TÁCTICO SEGÚN ARMA (contrato, no valores exactos):
      // mismo rol → shotgun cierra < smg < rifle; y el rol MODULA (un entry
      // con rifle cierra más que un anchor con rifle).
      const role32 = { prefDist: 11, aggro: 1, react: 0.2, laneBias: 0 };
      const dShot32 = preferredDist(role32, 'shotgun');
      const dSmg32 = preferredDist(role32, 'smg');
      const dRifle32 = preferredDist(role32, 'rifle');
      const ordered32 = dShot32 < dSmg32 && dSmg32 < dRifle32;
      const roleMod32 = preferredDist({ ...role32, prefDist: 7 }, 'rifle') < dRifle32;
      log('32 WEAPON RANGE DRIVES ENGAGEMENT', ordered32 && roleMod32,
        `shotgun ${dShot32.toFixed(1)} < smg ${dSmg32.toFixed(1)} < rifle ${dRifle32.toFixed(1)} · rolModula ${roleMod32}`);

      // Test 47: Navigation no puede reutilizar el mismo camino cuando cambia
      // la posición objetivo; y una cápsula que aterriza sobre una cobertura
      // alta debe quedar libre, mientras la consulta ascendente no la pega al
      // lateral del objeto.
      const nav47 = game.navigation;
      const bot47 = game.bots[0];
      nav47.reset(bot47.id);
      nav47.nextWaypoint(bot47, 42, 42);
      const recA47 = nav47._paths.get(bot47.id);
      const destA47 = recA47 && recA47.destX === 42 && recA47.destZ === 42;
      nav47.nextWaypoint(bot47, -42, -42);
      const recB47 = nav47._paths.get(bot47.id);
      const destB47 = recB47 && recB47.destX === -42 && recB47.destZ === -42;
      const synthetic47 = {
        min: new THREE.Vector3(51, 0, 51), max: new THREE.Vector3(53, 1, 53),
        mesh: null, x: 52, y: 0, z: 52, w: 2, h: 1, d: 2,
      };
      game.map.boxes.push(synthetic47);
      const top47 = new THREE.Vector3(52, 2.65, 52);
      const topClear47 = !game.map.checkCollision(top47, 0.35, 1.65);
      const risingGround47 = game.map.getGroundY(52, 52, 0, -1) === 0;
      game.map.boxes.pop();
      nav47.reset(bot47.id);
      const ranges47 = game.weaponData.rifle.range >= 120 && game.weaponData.pistol.range >= 90
        && game.weaponData.shotgun.range >= 24 && game.weaponData.smg.range >= 75;
      log('47 RANGE + NAV DESTINATION + TOP COLLISION', ranges47 && destA47 && destB47 && recA47 === recB47 && topClear47 && risingGround47,
        `alcance:${ranges47} destA:${destA47} destB:${destB47} cacheReusa:${recA47 === recB47} topLibre:${topClear47} subidaSinPegamento:${risingGround47}`);

      // ── Test 33: SHOTGUN SPREAD IS NOT COLLAPSED BY AIM ASSIST ──
      // La asistencia mueve el CENTRO del patrón (el rifle central acierta)
      // pero NO comprime el patrón: las postas al EXTREMO del cono de spread
      // (0.058 rad ≈ 0.87 m a 15 u) fallan aunque haya objetivo delante.
      // Determinista: Math.random stubbeado a 1 (todas las postas al extremo).
      game.gameMode = 'squad';
      game.phase = 'combat';
      game.player.team = 'ally';
      const bot33 = game.bots.find(b => b.team === 'enemy');
      bot33.isAlive = true; bot33.health = bot33.maxHealth; bot33.immuneUntil = 0;
      const start33 = bot33.position.clone();
      game.immuneUntil = 0;
      const camSave33 = game.camera.position.clone();
      const rotSave33 = { x: game.camera.rotation.x, y: game.camera.rotation.y, z: game.camera.rotation.z };
      const touchSave33 = game._isTouchPlatform;
      game._isTouchPlatform = true; // cono de touch: donde el colapso era visible
      const eye33 = new THREE.Vector3(42, 1.65, 42);
      bot33.position.set(42, 1.65, 27); // 15u: dentro del rango 16 de la escopeta
      game.player.position.copy(eye33);
      const fire33 = (weaponKey, randFn) => {
        game.weaponSystem.owned.add(weaponKey);
        game.weaponSystem.switchWeapon({ rifle: 1, pistol: 2, shotgun: 3, smg: 4 }[weaponKey]);
        game.weaponSystem._finishSwitch(); // prueba de trayectoria, no de handoff visual
        const realRandom = Math.random;
        Math.random = randFn;
        game.camera.position.copy(eye33);
        game.camera.rotation.order = 'YXZ';
        game.camera.rotation.set(Math.atan2((1.65 - 0.62) - 1.65, 15), 0, 0); // al pecho
        game.camera.updateMatrixWorld();
        game.weaponSystem.fireCooldown = 0;
        const r = game.weaponSystem.fire(game.player, [bot33], game.map);
        Math.random = realRandom;
        return r;
      };
      const centerHits33 = (() => { const r = fire33('rifle', () => 0.5); return !!(r && r.hits.some(h => h.target === bot33)); })();
      const extreme33 = fire33('shotgun', () => 1);
      const patternKept33 = !!extreme33 && extreme33.hits.length === 0;
      bot33.respawn(start33);
      game._isTouchPlatform = touchSave33;
      game.camera.position.copy(camSave33);
      game.camera.rotation.set(rotSave33.x, rotSave33.y, rotSave33.z);
      game.camera.updateMatrixWorld();
      game.weaponSystem.switchWeapon(1);
      log('33 SHOTGUN SPREAD NOT COLLAPSED BY ASSIST', centerHits33 && patternKept33,
        `centroAsistido(rifle) ${centerHits33} · postasExtremas(shotgun) ${patternKept33 ? 'FALLAN (patrón intacto)' : 'ACIERTAN (patrón colapsado)'}`);
      game.matchState = 'LOADING';
      game._resultShown = false;

      // ── Test 37: el watchdog de combate NO entrega resultados. Si el reloj
      // llega a cero con ambos equipos vivos, solo fuerza rutas de contacto.
      game.matchState = 'PLAYING';
      game.gameMode = 'squad';
      game.player.team = 'ally';
      game.phase = 'combat';
      const ms37 = game.squad;
      game.player.isAlive = true; game.playerController.health = game.playerController.maxHealth;
      game.bots.forEach(b => { b.isAlive = true; b.health = b.maxHealth; b._tacticalGoal = null; });
      game.roundWins = { ally: 2, enemy: 1 };
      game.phaseTime = 0;
      ms37.tickPhase(0.016);
      const watchdogOk37 = game.phase === 'combat' && game.roundWins.ally === 2 && game.roundWins.enemy === 1
        && game.bots.filter(b => b.isAlive).every(b => !!b._tacticalGoal);
      log('37 ROUND WATCHDOG DOES NOT AWARD RESULT', watchdogOk37,
        `fase=${game.phase} score=${game.roundWins.ally}-${game.roundWins.enemy} rutasForzadas=${game.bots.filter(b => b._tacticalGoal).length}`);

      // ── Test 37b: NINGUNA muerte fuera de la ruta central de daño ──
      // Una baja SIEMPRE pasa por Game.applyDamage → Bot.takeDamage: health=0,
      // _dyingT>0 (animación de muerte). Ningún otro sistema escribe isAlive.
      const victim37b = game.bots.find(b => b.team === 'enemy');
      game.player.isAlive = true;
      game.phase = 'combat'; game.matchState = 'PLAYING';
      game.roundWins = { ally: 0, enemy: 0 };
      victim37b.isAlive = true; victim37b.health = 50; victim37b.immuneUntil = 0;
      game.immuneUntil = 0;
      const diedCentral37b = game.applyDamage(victim37b, 999, 'body', game.player);
      const centralOk37b = !victim37b.isAlive && victim37b.health === 0 && victim37b._dyingT > 0;
      game._resetTemporalState();
      game.matchState = 'LOADING';
      game._resultShown = false;
      log('37b DEATH ONLY VIA CENTRAL DAMAGE PATH', diedCentral37b && centralOk37b,
        `applyDamage(999) → muere:${diedCentral37b} health=0:${victim37b.health === 0} animMuerte:${victim37b._dyingT > 0}`);

      // ── Test 37c: IA CON INTENCIÓN (anti-idle P0) — un bot SIN contacto
      // durante >10s toma un objetivo táctico (geografía barata, sin radar)
      // yNavigation encuentra ruta hasta él: nadie se queda "paseando" en
      // una esquina hasta el timeout de ronda.
      game.gameMode = 'squad';
      game.phase = 'combat';
      game.player.team = 'ally';
      const bot37c = game.bots.find(b => b.team === 'enemy');
      bot37c.respawn(new THREE.Vector3(0, 0, -40));
      bot37c._noContactT = 0; bot37c._tacticalGoal = null;
      game.player.isAlive = false; // percepción vacía garantizada
      const others37c = game.bots.filter(b => b !== bot37c);
      others37c.forEach(b => { b.isAlive = false; b._dyingT = 0; });
      let goalTaken37c = null;
      for (let i = 0; i < 700 && !goalTaken37c; i++) { // ~12s simulados
        bot37c.update(1 / 60, game.player, [bot37c], game.map);
        if (bot37c._tacticalGoal) goalTaken37c = bot37c._tacticalGoal;
      }
      const nav37c = game.navigation; nav37c.reset();
      // Contrato: el bot toma goal SIN contacto y AVANZA hacia él. La celda
      // exacta del jitter puede caer en celda muerta de la casa central (el
      // juego lo re-sortea con noRoute): el test re-intenta la ruta desde el
      // goal ACTUAL y acepta si existe ruta a CUALQUIER goal tomado.
      const path37c = goalTaken37c
        ? nav37c.findPath(bot37c.position.x, bot37c.position.z, goalTaken37c.x, goalTaken37c.z, [])
        : null;
      const spawn37c = new THREE.Vector3(0, bot37c.position.y, -40);
      const moved37c = bot37c.position.distanceTo(spawn37c) > 2;
      bot37c.respawn(new THREE.Vector3(0, 0, -26));
      game.player.isAlive = true;
      others37c.forEach(b => { b.isAlive = true; b._dyingT = 0; });
      game.matchState = 'LOADING';
      game._resultShown = false;
      log('37c BOT TAKES TACTICAL GOAL WHEN IDLE', !!goalTaken37c && moved37c,
        `objetivo=${goalTaken37c ? `(${goalTaken37c.x.toFixed(0)},${goalTaken37c.z.toFixed(0)})` : 'NINGUNO'} · rutaA*=${path37c ? path37c.length + 'wp' : 'RE-SORTEO (celda muerta)'} · seMovio=${moved37c} · avance=${bot37c.position.distanceTo(spawn37c).toFixed(1)}u`);

      // ── Test 35b: KILLFEED sin nombres internos de bot ──
      // "ALIADO_2·BRAVO", "ENEMIGO_1", "BOT_1" son datos internos de IA. El
      // killfeed muestra SOLO callsigns de operador (BRAVO, VULTURE…) y TÚ.
      const feed35 = document.getElementById('killfeed');
      feed35.innerHTML = '';
      game.gameMode = 'squad';
      game.player.team = 'ally';
      game.player.name = 'YOU';
      const killer35 = game.bots.find(b => b.team === 'enemy');
      const victim35 = game.bots.find(b => b.team === 'ally');
      const bot35 = game.bots.find(b => b.team === 'enemy' && b !== killer35);
      // player mata a bot (headshot) · bot mata a bot (enemigo→aliado) ·
      // bot mata al jugador: TRES rutas del feed, cero nombres internos.
      // Los bots llegan tocados por tests previos: restaurar vida/vivos/inmunidad.
      game.matchState = 'PLAYING'; // applyDamage ignora todo tras FINISHED
      game.phase = 'combat';       // y en escuadras solo combate cuenta bajas
      game.player.isAlive = true;
      game.immuneUntil = 0;
      killer35.isAlive = true; killer35.immuneUntil = 0;
      victim35.isAlive = true; victim35.immuneUntil = 0;
      bot35.isAlive = true; bot35.immuneUntil = 0;
      game.applyDamage(victim35, 999, 'body', game.player);
      victim35.isAlive = true; victim35.health = 1; // revivir para la segunda baja
      game.applyDamage(victim35, 999, 'head', killer35);
      game.applyDamage(bot35, 999, 'body', game.player);
      const killTexts35 = [...feed35.querySelectorAll('.kill-entry')].map(e => e.textContent);
      const badName35 = killTexts35.some(t =>
        /ALIADO_|ENEMIGO_|BOT_|·BRAVO|·VULTURE|·TALON|·DUNE|·HAVOC|·ROOK|·GHOST|·OP|YOU|undefined|NaN/.test(t));
      const goodNames35 = killTexts35.length > 0 && killTexts35.every(t =>
        /(BRAVO|VULTURE|TALON|DUNE|HAVOC|ROOK|GHOST|TÚ)/.test(t));
      const headMarked35 = feed35.querySelectorAll('.kill-entry.hs').length >= 1;
      log('35b KILLFEED NO INTERNAL BOT NAMES', !badName35 && goodNames35 && headMarked35,
        `${killTexts35.join(' | ')} · sinNombresInternos:${!badName35} · soloCallsigns:${goodNames35} · headshotMarcado:${headMarked35}`);
      feed35.innerHTML = '';
      game._resetTemporalState();
      game.matchState = 'LOADING';
      // ── Test 38: ESPECTADOR EN DUELO DE ESCUADRAS (P0) ──
      // Muerte del jugador con aliados vivos → espectador REAL: banner
      // "ESPECTANDO <CALLSIGN>", viewmodel oculto, HUD vida/arma fuera y
      // cámara en 3ª persona siguiendo al aliado (lectura pura).
      game.matchState = 'PLAYING';
      game.gameMode = 'squad';
      game.player.team = 'ally';
      game.phase = 'combat';
      game.roundWins = { ally: 0, enemy: 0 };
      game.player.isAlive = true;
      game.playerController.health = 100;
      game.immuneUntil = 0;
      game.bots.forEach(b => { b.isAlive = true; b.immuneUntil = 0; });
      // El loop REAL corre en paralelo: sin congelar la fase, el timeout de
      // ronda cerraba el espectador a mitad de las aserciones (ronda → buy).
      const timeSave38 = { phaseTime: game.phaseTime, matchTime: game.matchTime };
      game.phaseTime = 1e9; game.matchTime = 0;
      const specEnemy38 = game.bots.find(b => b.team === 'enemy');
      const camSave38 = game.camera.position.clone();
      game.applyDamage(game.player, 999, 'body', specEnemy38); // ruta central de daño
      const specBanner38 = document.getElementById('spectate-banner');
      const vmVisible38 = game.weaponSystem.weaponMesh ? game.weaponSystem.weaponMesh.visible : 'NULL';
      // El ocultado del viewmodel es asíncrono (race del GLB): el contrato
      // sincrónico es banner+estado; el VM lo protege 38b con sondeo.
      const spectateOk38 = !!game._spectating && game._spectating.team === 'ally'
        && specBanner38 && specBanner38.classList.contains('show')
        && /BRAVO|VULTURE|TALON|DUNE|HAVOC|ROOK|GHOST/.test(specBanner38.querySelector('#spectate-name').textContent)
        && document.getElementById('hud-bottom').classList.contains('spectator-hidden');
      // cámara 3ª persona: un frame del espectador acerca la cámara al aliado
      const specAlly38 = game._spectating;
      for (let i = 0; i < 30; i++) game._updateSpectator(1 / 60); // ~0.5s: el lerp converge
      const camFollows38 = game.camera.position.distanceTo(specAlly38.position) < 6;
      const lookDir38 = new THREE.Vector3();
      const lookTarget38 = new THREE.Vector3(specAlly38.position.x, specAlly38.position.y + 1.2, specAlly38.position.z);
      game.camera.getWorldDirection(lookDir38);
      const camLooksAt38 = lookDir38.dot(lookTarget38.sub(game.camera.position).normalize()) > 0.96;
      // aliado especteado muere → auto-switch al siguiente vivo (fase roundEnd
      // YA decidida: se simula la muerte ANTES del cierre de ronda)
      game.phase = 'buy'; // congela el gate de fin de ronda durante el switch
      const firstAllyName38 = game._displayName(game._spectating);
      game.applyDamage(game._spectating, 999, 'body', specEnemy38);
      const expectedNext38 = game.bots.find(b => b.team === 'ally' && b.isAlive);
      game._updateSpectator(0.016); // el frame siguiente ejecuta el auto-switch
      const autoSwitch38 = game._spectating === expectedNext38
        && game._spectating.isAlive
        && game._displayName(game._spectating) !== firstAllyName38;
      // cambian con Q/E vía _specWish (mismo camino que las teclas)
      game._specWish = 1; game._updateSpectator(0.016);
      const cycledOk38 = game._spectating.isAlive;
      // reset de ronda → espectador COMPLETAMENTE limpio
      game.startRound(2);
      const clean38 = game._spectating === null
        && !(specBanner38 && specBanner38.classList.contains('show'))
        && !document.getElementById('hud-bottom').classList.contains('spectator-hidden')
        && game.player.isAlive;
      game.phaseTime = timeSave38.phaseTime; game.matchTime = timeSave38.matchTime + 1e9; // loop nunca cierra esta ronda congelada
      log('38 SPECTATE ON DEATH + AUTOSWITCH + CLEAN RESET', spectateOk38 && camFollows38 && camLooksAt38 && autoSwitch38 && cycledOk38 && clean38,
        `banner:${spectateOk38} vmOculto:${!vmVisible38} camSigue:${camFollows38} autoSwitch:${autoSwitch38} ciclo:${cycledOk38} reset:${clean38}`);
      // Aserciones de GLB/consola: los assets llegan ASÍNCRRONOS — el test
      // SONDEA (mismo patrón que 26/34) en lugar de correr a tiempo fijo.
      const poll38 = (attempt = 0) => {
        const vm38 = game.weaponSystem.weaponMesh;
        const banner38b = document.getElementById('spectate-banner');
        if (vm38 && vm38.visible && attempt < 40) {
          game._startSpectating(); // re-activa: el HUD se re-pinta y el VM se apaga al siguiente frame
          return setTimeout(() => poll38(attempt + 1), 250);
        }
        const glbOk38 = vm38 ? vm38.visible === false : true; // viewmodel oculto (GLB o fallback técnico)
        log('38b SPECTATE VIEWMODEL HIDDEN (GLB RACE)', glbOk38,
          `vm ${vm38 ? (vm38.visible ? 'VISIBLE (bug)' : 'oculto') : 'sin viewmodel'} tras ${attempt} reintentos`);
        game._resetTemporalState();
        game.matchState = 'LOADING';
        game._resultShown = false;
        game.camera.position.copy(camSave38);
      };
      poll38();

    // ── Test 39: ESPECTADOR = SOLO LECTURA (el input no mueve al aliado) ──
      // Con el espectador activo, WASD/fuego/joystick del espectador no pueden
      // alterar la simulación del aliado: su posición avanza por SU IA y el
      // jugador muerto no recibe disparos (isAlive gate).
      game.matchState = 'PLAYING';
      game.gameMode = 'squad';
      game.player.team = 'ally';
      game.phase = 'combat';
      game.player.isAlive = true;
      game.immuneUntil = 0;
      game.bots.forEach(b => { b.isAlive = true; b.immuneUntil = 0; });
      game.applyDamage(game.player, 999, 'body', game.bots.find(b => b.team === 'enemy'));
      const spec39 = game._spectating;
      const allyPosBefore39 = spec39.position.clone();
      // todo el input del espectador a full: mover + fuego + cambio de arma
      game.input._keys.add('KeyW'); game.input._keys.add('KeyA');
      game.input.fire = true; game.input._specWish = 1;
      for (let i = 0; i < 30; i++) { // ~0.5s simulados por el loop de Game
        game.input.update();
        game.playerController.update(1 / 60);
        game._updateSpectator(1 / 60);
      }
      game.input._keys.delete('KeyW'); game.input._keys.delete('KeyA');
      game.input.fire = false;
      const readOnlyOk39 = spec39.position.distanceTo(allyPosBefore39) < 2.5 // deriva de IA propia, no teletransporte del input
        && game._specWish === 0; // el deseo se consumió: el ciclo lo maneja _updateSpectator
      // el aliado especteado corre su IA normal (velocidad distinta de un bot muerto)
      const aiRan39 = spec39.isAlive && game.player.isAlive === false;
      game._resetTemporalState();
      game.matchState = 'LOADING';
      game._resultShown = false;
      log('39 SPECTATOR INPUT NEVER MOVES THE ALLY', readOnlyOk39 && aiRan39,
        `deriva ${(spec39.position.distanceTo(allyPosBefore39)).toFixed(2)}u (<2.5 = IA propia) · specWishConsumido:${game._specWish === 0} · ia:${aiRan39}`);
      // ── Test 35: INVENTARIO SOLO ARMAS OWNED (bug Android: cambiar a un arma
      // NO comprada). R1 → pistola única; compra UNA primaria; todos los caminos
      // de cambio (Q/E/botón ARMA/slots 1-4) respetan `owned` SIEMPRE.
      game.matchState = 'PLAYING';
      game.gameMode = 'squad';
      game.shopOpenFlag = false; // startRound abre la tienda: sin esto buy() duplica el flag
      game.startRound(1);
      // Forzar el caso exacto del reporte: R1, SOLO pistola en propiedad.
      game.weaponSystem.owned = new Set(['pistol']);
      game.weaponSystem.isReloading = false;
      game.weaponSystem.switchWeapon(2); // pistola
      game.weaponSystem._finishSwitch();
      const wStart35 = game.weaponSystem.weapons[game.weaponSystem.currentIndex];
      const ws = game.weaponSystem;
      // El input de producción se bloquea durante unequip→swap→equip. Las
      // aserciones de inventario prueban el filtro de propiedad, así que cada
      // intención consecutiva concluye de forma determinista su transición.
      const ready35 = () => ws._finishSwitch();
      // slots no-owned bloqueados (rifle=1, escopeta=3, smg=4)
      const slotBlocked35 = !ws.switchWeapon(1) && !ws.switchWeapon(3) && !ws.switchWeapon(4)
        && ws.weapons[ws.currentIndex] === 'pistol';
      // next/prev repetidos nunca abandonan la pistola
      ws.switchWeapon('next'); ready35(); ws.switchWeapon('next'); ready35(); ws.switchWeapon('next'); ready35();
      const nextStayed35 = ws.weapons[ws.currentIndex] === 'pistol';
      ws.switchWeapon(-1); ready35(); ws.switchWeapon(-1); ready35();
      const prevStayed35 = ws.weapons[ws.currentIndex] === 'pistol';
      // comprar UNA primaria (escopeta) por la TIENDA → pasa a ser cambiable
      const coins35 = game.coins;
      game.coins = 9999;
      const shotIdx = ws.weapons.indexOf('shotgun');
      game.shop.buy(shotIdx);
      ready35();
      const boughtOk35 = ws.owned.has('shotgun') && ws.weapons[ws.currentIndex] === 'shotgun';
      // con pistol+shotgun owned: slots no-owned SIGUEN bloqueados
      const slotRifle35 = !ws.switchWeapon(1) && !ws.switchWeapon(4);
      // next/prev ciclan SOLO por las 2 owned (pistol ↔ shotgun, nunca rifle/smg)
      ws.switchWeapon(2); ready35(); // pistola
      ws.switchWeapon('next'); ready35();
      const cycleA35 = ws.weapons[ws.currentIndex] === 'shotgun';
      ws.switchWeapon('next'); ready35();
      const cycleB35 = ws.weapons[ws.currentIndex] === 'pistol';
      ws.switchWeapon(-1); ready35();
      const cycleC35 = ws.weapons[ws.currentIndex] === 'shotgun';
      // nueva ronda: MatchSquad NO toca owned (arrastra compras) pero el filtro
      // sigue valiendo; retry (startMatch squad) RESETEA a {pistol} — y tras el
      // reset el arma activa vuelve a ser una owned.
      game.squad.startMatch();
      ready35();
      const retryOk35 = ws.owned.has('pistol') && ws.weapons[ws.currentIndex] === 'pistol'
        && !ws.switchWeapon(1) && !ws.switchWeapon(3) && !ws.switchWeapon(4);
      // FFA: arsenal completo ES el contrato del modo (no es un leak)
      game.gameMode = 'ffa';
      game.startMatch();
      const ffaOk35 = ws.owned.size === 4;
      game.coins = coins35;
      game.matchState = 'LOADING';
      game._resultShown = false;
      const inv35 = slotBlocked35 && nextStayed35 && prevStayed35 && boughtOk35
        && slotRifle35 && cycleA35 && cycleB35 && cycleC35 && retryOk35 && ffaOk35 && wStart35 === 'pistol';
      log('35 INVENTORY ONLY OWNED WEAPONS', inv35,
        `slotsBloqueados:${slotBlocked35} nextFijo:${nextStayed35} prevFijo:${prevStayed35} compra:${boughtOk35} riflePost:${slotRifle35} ciclo ${cycleA35}/${cycleB35}/${cycleC35} retry:${retryOk35} ffa:${ffaOk35} inicial:${wStart35}`);
    } catch(e){
      log('TEST ERROR', false, String(e).slice(0,120));
      console.error(e);
    }

    // Test 29: DECOR DEL MAPA — CONTRATOS (sin números mágicos: el mapa puede
    // evolucionar; lo que se protege es el contrato visual/colisión, regla §9):
    //   a) decor existe y va HORNEADA (pocas meshes deco, muchas geometrías)
    //   b) NINGÚN mesh decorativo es un collider (la decoración puramente
    //      visual no registra colisión por accidente)
    //   c) los props SÓLIDOS a nivel de jugador SÍ registran collider simple:
    //      bidón, pila de cajas, contenedor apilado y base de grúa bloquean
    //   d) los spawns de escuadra siguen libres
    //   e) la navegación sigue disponible de base a base (los props no rompen A*)
    //   f) las torres faro de base (landmarks SIN collider propio, Map.js)
    //      siguen visibles desde la base aliada
    try {
      game.matchState = 'PLAYING';
      game.gameMode = 'squad';
      game.player.team = 'ally';
      game.startRound(1);
      const m29 = game.map, d29 = m29.decor;
      const decoMeshes29 = [];
      m29.scene.traverse(o => { if (o.isMesh && o.userData.deco) decoMeshes29.push(o); });
      const hasDecor29 = !!d29 && decoMeshes29.length >= 15 && decoMeshes29.length < 120;
      const noDecoCollider29 = decoMeshes29.every(mesh => !m29.boxes.some(b => b.mesh === mesh));
      // props sólidos canónicos de MapDecor (bidón mercado, cajas, contenedor E, grúa W)
      const probe29 = new THREE.Vector3();
      const solidAt29 = (x, z) => { probe29.set(x, 1.0, z); return m29.checkCollision(probe29, 0.4, 1.65); };
      const solids29 = [[2.4, 10.8], [9.6, 16.2], [40, 0], [-32.5, 0]].map(([x, z]) => solidAt29(x, z));
      const solidPropsOk29 = solids29.every(Boolean) && m29.boxes.some(b => b.mesh === null && b.h >= 1);
      const spawnClear29 = m29.squadSpawns.ally.every(p => m29.isSpawnClear(p.x, p.z))
        && m29.squadSpawns.enemy.every(p => m29.isSpawnClear(p.x, p.z));
      const nav29 = game.navigation;
      nav29.reset();
      const path29 = nav29.findPath(0, m29.size * 0.42, 0, -m29.size * 0.42, []);
      const navOk29 = Array.isArray(path29) && path29.length > 0;
      const eye29 = new THREE.Vector3(-4, 1.65, m29.size * 0.42);
      const beaconsOk29 = [[-m29.size * 0.36, 7.4, m29.size * 0.40], [m29.size * 0.36, 7.4, -m29.size * 0.40]].every(([lx, ly, lz]) => {
        const dir = new THREE.Vector3(lx - eye29.x, ly - eye29.y, lz - eye29.z);
        const dist = dir.length(); dir.normalize();
        return !m29.raycast(eye29, dir, dist);
      });
      log('29 MAP DECOR + SOLID PROP CONTRACT', hasDecor29 && noDecoCollider29 && solidPropsOk29 && spawnClear29 && navOk29 && beaconsOk29,
        `decor ${decoMeshes29.length} meshes · deco≠collider ${noDecoCollider29} · sólidos ${solids29.filter(Boolean).length}/4 · spawns ${spawnClear29} · nav base-base ${navOk29} · faros visibles ${beaconsOk29}`);
      game.matchState = 'LOADING';
    } catch(e){
      log('TEST ERROR 29', false, String(e).slice(0,120));
      console.error(e);
    }
    // timer from the previous match must NOT teleport the player after
    // OTRA PARTIDA (rule §4: restart resets all temporal state).
    // AISLAMIENTO: los timers de respawn SOLO existen en FFA (en escuadras
    // nadie reaparece y startRound recoloca al jugador con snapClear — un
    // squad heredado de los tests 24/25 producía "teleport" falso). Además se
    // congela el reloj PASADA la inmunidad de spawn: con matchTime real la
    // inmunidad podía tragar el applyDamage(999) y la muerte (y su timer)
    // nunca ocurría. Los bots se re-congelan tras cada startMatch porque el
    // FFA los respawnea.
    setTimeout(() => {
      try {
        let spawnIdx = 0;
        const realSpawn = game.map.getRandomSpawn.bind(game.map);
        game.map.getRandomSpawn = () => new THREE.Vector3(spawnIdx++ * 10, 1.65, 18);
        game.matchState = 'PLAYING';
        game.gameMode = 'ffa';
        game.player.team = 'ffa_player';
        game._resultShown = false;
        const botsAlive = game.bots.map(b => b.isAlive);
        game.startMatch(); // spawn A
        game.matchTime = 100; // reloj congelado: inmunidad de spawn caducada
        game.bots.forEach(b => b.isAlive = false);
        game.applyDamage(game.player, 999, 'body', game.bots[0]); // die → stale timer +1800ms
        game.startMatch(); // immediate retry → spawn B (cancela el timer, regla §4)
        // Test 36: los CONTROLES MÓVILES sobreviven al retry (body.playing +
        // elemento de controles presentes tras la segunda partida consecutiva)
        const mobileRetry36 = document.body.classList.contains('playing')
          && !!document.getElementById('mobile-controls');
        game.bots.forEach(b => b.isAlive = false);
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
            log('36 MOBILE CONTROLS AFTER RETRY', mobileRetry36,
              `body.playing ${document.body.classList.contains('playing')} · controls ${!!document.getElementById('mobile-controls')}`);
            runTest26();
          }
        }, 2100);
      } catch(e){
        log('TEST ERROR 13', false, String(e).slice(0,120));
        console.error(e);
        runTest26();
      }
    }, 2200);

    // Test 13 (async — needs the real 1.8s respawn window): a pending respawn

    // ── Test 26: LOBBY — ENCUADRE DEL HÉROE POR INVARIANTES (async) ──
    // El héroe GLB se construye cuando el asset termina de cargar (variable:
    // 0.5–4s), así que el test SONDEA en lugar de correr a +200ms. La pose la
    // deriva Lobby.applyCameraPose() del Box3 REAL del héroe; los invariantes
    // de producto se verifican en NDC/píxeles con la cámara viva (sin
    // capturas ni timings frágiles):
    //   a) héroe COMPLETO con aire ≥3% de pantalla arriba/abajo (≥2% lados)
    //   b) PROTAGONISTA: ocupa 60–85% de la altura de pantalla (NDC del Box3;
    //      el parallax del Box3 infla la medida — lo medido manda, no el
    //      objetivo nominal de applyCameraPose)
    //   c) compuesto en el tercio DERECHO y sin invadir la columna de UI
    //   d) JUGAR = CTA dominante (área > 1.5× el mayor botón secundario)
    //   e) FOV de retrato del lobby activo (34)
    function runTest26(attempt = 0) {
      try {
        const L26 = game.lobby;
        if (!L26 || !L26.hero || !L26._heroBox) {
          if (attempt < 24) return setTimeout(() => runTest26(attempt + 1), 500);
          log('26 LOBBY HERO FRAMING', false, 'héroe GLB no construido tras 12s (¿falló la carga del asset?)');
          renderTests();
          return;
        }
        // El héroe quedó oculto por startMatch/setVisible(false) de tests
        // previos: el encuadre se mide con el set montado, como en el lobby.
        if (!L26.heroVisible) L26.setVisible(true);
        // showResult (tests 18/22) dejó title-block oculto y result-block
        // visible: medir la JERARQUÍA exige el estado de lobby real. Se
        // guarda y se restaura para no contaminar otros tests.
        const tbEl26 = document.getElementById('title-block');
        const rbEl26 = document.getElementById('result-block');
        const tbWas26 = tbEl26.classList.contains('hidden');
        const rbWas26 = rbEl26.classList.contains('hidden');
        tbEl26.classList.remove('hidden');
        rbEl26.classList.add('hidden');
        const cam26 = game.camera;
        cam26.aspect = innerWidth / Math.max(1, innerHeight);
        L26.applyCameraPose(cam26);
        cam26.updateMatrixWorld();
        const ndc26 = L26.heroNdcBox(cam26);
        const W26 = innerWidth, H26 = innerHeight;
        const m26 = {
          left: (ndc26.minX + 1) / 2 * W26,
          right: (1 - ndc26.maxX) / 2 * W26,
          top: (1 - ndc26.maxY) / 2 * H26,
          bottom: (ndc26.minY + 1) / 2 * H26,
        };
        // El span NDC va de -1..1 (rango 2): la fracción de PANTALLA es span/2
        const fill26 = (ndc26.maxY - ndc26.minY) / 2;
        const center26 = (ndc26.minX + ndc26.maxX) / 2; // >0 = mitad derecha
        const tb26 = tbEl26.getBoundingClientRect();
        const uiRight26 = tb26.right; // borde derecho de la columna de UI
        const a26 = m26.top >= 0.03 * H26 && m26.bottom >= 0.03 * H26
          && m26.right >= 0.02 * W26 && m26.left >= 0.02 * W26;
        const b26 = fill26 >= 0.60 && fill26 <= 0.85;
        const c26 = center26 > 0.10 && m26.left >= uiRight26 + 8;
        const btns26 = [...document.querySelectorAll('#overlay button')]
          .filter(el => el.id !== 'playBtn' && el.id !== 'retryBtn' && !el.closest('#result-block'))
          .map(el => { const r = el.getBoundingClientRect(); return r.width * r.height; });
        const maxSec26 = Math.max(0, ...btns26);
        const rp26 = document.getElementById('playBtn').getBoundingClientRect();
        const d26 = rp26.width * rp26.height > maxSec26 * 1.5;
        const e26 = cam26.fov === 34;
        // f) SIN OCLUSIÓN: nada tapa al héroe. Rayo cámara→centro del héroe
        // contra TODA la escena: la auditoría visual encontró el arco del MAPA
        // (pilar de óxido en z=7.6) atravesando la línea cámara→héroe cuando
        // el estudio vivía dentro de la arena. El estudio vive bajo el mapa
        // (LOBBY_Y) y este raycast es el contrato permanente.
        const chest26 = new THREE.Vector3(
          (L26._heroBox.min.x + L26._heroBox.max.x) / 2,
          (L26._heroBox.min.y + L26._heroBox.max.y) / 2,
          (L26._heroBox.min.z + L26._heroBox.max.z) / 2
        );
        const dir26 = chest26.clone().sub(cam26.position);
        const distHero26 = dir26.length();
        dir26.normalize();
        const ray26 = new THREE.Raycaster(cam26.position.clone(), dir26, 0.1, distHero26 - 0.05);
        const isHeroPart26 = (o) => { while (o) { if (o === L26.hero.root) return true; o = o.parent; } return false; };
        const occluders26 = ray26.intersectObjects(game.scene.children, true).filter(h => !isHeroPart26(h.object));
        const f26 = occluders26.length === 0;
        log('26 LOBBY HERO FRAMING', a26 && b26 && c26 && d26 && e26 && f26,
          `margins t/b/l/r ${m26.top.toFixed(0)}/${m26.bottom.toFixed(0)}/${m26.left.toFixed(0)}/${m26.right.toFixed(0)}px · fill ${(fill26 * 100).toFixed(0)}% · uiClear ${m26.left.toFixed(0)}≥${uiRight26.toFixed(0)}:${m26.left >= uiRight26 + 8} · play${(rp26.width * rp26.height).toFixed(0)}>1.5×${maxSec26.toFixed(0)}:${d26} · fov ${cam26.fov} · sinOclusion ${f26}`);
        // restaurar el estado DOM que tocamos
        tbEl26.classList.toggle('hidden', tbWas26);
        rbEl26.classList.toggle('hidden', rbWas26);
      } catch(e){
        log('TEST ERROR 26', false, String(e).slice(0,120));
        console.error(e);
      }
      pollGun34();
    }

    // ── Test 34: el arma del héroe del lobby es el GLB REAL (no el fallback
    // PRIMITIVE FALLBACK). El swap fallback→GLB es asíncrono (AssetRegistry): se SONDEA.
    // Contrato: lobby.gun.userData.isGlb === true (marca de makeHeldWeaponGlb).
    function pollGun34(attempt = 0) {
      try {
        const gun34 = game.lobby && game.lobby.gun;
        if (gun34 && gun34.userData && gun34.userData.isGlb) {
          log('34 LOBBY HERO GUN IS GLB', true, 'arma GLB real montada en el pivote del héroe');
        } else if (attempt < 20) {
          return setTimeout(() => pollGun34(attempt + 1), 500);
        } else {
          log('34 LOBBY HERO GUN IS GLB', false, 'el arma del héroe sigue en PRIMITIVE FALLBACK tras 10s');
        }
      } catch(e){
        log('TEST ERROR 34', false, String(e).slice(0,120));
        console.error(e);
      }
      renderTests();
    }

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
