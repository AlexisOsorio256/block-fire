import * as THREE from '../lib/three.module.js';
import { Input } from './Input.js';
import { PlayerController } from '../player/PlayerController.js';
import { WeaponSystem } from '../combat/WeaponSystem.js';
import { Bot } from '../bots/Bot.js';
import { Map } from '../world/Map.js';
import { HUD } from '../ui/HUD.js';
import { AudioManager } from '../audio/AudioManager.js';
import { settings } from './Settings.js';

export class Game {
  constructor() {
    this.container = document.getElementById('game-container');
    
    // Scene
    this.scene = new THREE.Scene();
    // Gradient sky dome — cheap (1 sphere, BackSide, no lighting) but reads
    // as "sky" instead of a flat color. Horizon haze matches the fog.
    const skyGeo = new THREE.SphereGeometry(160, 16, 12);
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        top: { value: new THREE.Color(0x4a90d9) },
        horizon: { value: new THREE.Color(0xbfe0f5) },
        below: { value: new THREE.Color(0x87b5e8) }
      },
      vertexShader: `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: `
        uniform vec3 top; uniform vec3 horizon; uniform vec3 below;
        varying vec3 vDir;
        void main() {
          float h = vDir.y;
          vec3 c = h > 0.0
            ? mix(horizon, top, pow(h, 0.55))
            : mix(horizon, below, pow(-h, 0.7));
          gl_FragColor = vec4(c, 1.0);
        }`
    });
    this.scene.add(new THREE.Mesh(skyGeo, skyMat));
    this.scene.fog = new THREE.Fog(0x87b5e8, 34, 90);

    // Renderer — mobile renders at a sharper DPR cap, with a dynamic downscaler
    // (_adaptResolution) if sustained frame time suffers. See PROJECT_RULES §6.
    const isMobile = window.innerWidth < 900 || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    this.renderer = new THREE.WebGLRenderer({ antialias: !isMobile, powerPreference: 'high-performance' });
    this._dpr = { min: 0.9, max: isMobile ? 1.5 : 2.0, value: Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2.0) };
    this.renderer.setPixelRatio(this._dpr.value);
    this._frameTimes = [];
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.container.appendChild(this.renderer.domElement);
    this._isMobile = isMobile;

    // Camera
    this.camera = new THREE.PerspectiveCamera(78, window.innerWidth/window.innerHeight, 0.1, 200);
    
    // Lights
    this._setupLights();

    // Core systems
    this.input = new Input();
    this.map = new Map(this.scene);
    this.hud = new HUD();
    this.audio = new AudioManager();

    // Player
    this.player = {
      position: new THREE.Vector3(0, 1.8, 10),
      isAlive: true,
      isBot: false,
      mesh: null,
      name: 'YOU'
    };
    this.playerController = new PlayerController(this.player, this.input, this.camera, this.scene, this.map);
    this.playerController.audio = this.audio; // for land/jump feedback sounds
    // Create invisible mesh for player (for bots to target)
    const playerGeo = new THREE.BoxGeometry(0.5, 1.6, 0.5);
    const playerMat = new THREE.MeshBasicMaterial({ visible: false });
    this.player.mesh = new THREE.Mesh(playerGeo, playerMat);
    this.scene.add(this.player.mesh);

    // Weapon
    this.weaponSystem = new WeaponSystem(this.scene, this.camera, this.audio, this, this.applyDamage.bind(this));
    this.weaponSystem.playerController = this.playerController;

    // Bots
    this.bots = [];
    for(let i=0;i<7;i++){
      const pos = this.map.getRandomSpawn(this.player.position);
      const bot = new Bot(i, this.scene, this.map, pos);
      bot.name = `BOT_${i+1}`;
      this.bots.push(bot);
    }

    // Match
    this.matchState = 'LOADING'; // LOADING, COUNTDOWN, PLAYING, FINISHED
    this.matchTime = 0;
    this.matchDuration = 5 * 60; // 5 minutes
    this.killTarget = 20;
    this.playerKills = 0;
    this.playerDeaths = 0;
    this._resultShown = false;
    this.killFeed = [];
    this._pendingRespawns = []; // setTimeout ids of scheduled respawns

    // Effects — pooling para eficiencia (no crear Geometry/Material por disparo)
    this.hitFlash = 0;
    this._hitstop = 0;
    this._shake = 0;
    this._activeFlashes = [];
    this._activeImpacts = [];
    this._activeBloods = [];
    this._activeRings = [];
    // Geometrías compartidas
    this._geoMuzzle = new THREE.SphereGeometry(0.06, 6, 6);
    this._matMuzzle = new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.9 });
    this._geoMuzzleCore = new THREE.SphereGeometry(0.035, 6, 6);
    this._matMuzzleCore = new THREE.MeshBasicMaterial({ color: 0xfff8e0 });
    this._geoImpact = new THREE.BoxGeometry(0.08, 0.08, 0.08);
    this._matImpact = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 1 });
    this._matImpactHead = new THREE.MeshBasicMaterial({ color: 0xff4444, transparent: true, opacity: 1 });
    this._geoBlood = new THREE.SphereGeometry(0.05, 4, 4);
    this._matBlood = new THREE.MeshBasicMaterial({ color: 0xcc2222, transparent: true, opacity: 0.85 });
    this._geoRing = new THREE.RingGeometry(0.1, 0.16, 12);
    this._matRing = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7, side: THREE.DoubleSide });

    // Time
    this.clock = new THREE.Clock();
    this.lastFpsUpdate = 0;
    this.fps = 60;

    this._setupEvents();
    this._setupOverlay();

    window.addEventListener('resize', ()=> this.onResize());
    this.onResize();

    // Start loop
    this.animate();
  }

  _setupLights() {
    // Bright arcade-military daylight: readable, not washed out
    this.renderer.toneMappingExposure = 1.15;

    const ambient = new THREE.HemisphereLight(0xbfd9ff, 0x3d4a5f, 1.15);
    this.scene.add(ambient);

    const dir = new THREE.DirectionalLight(0xfff2d4, 1.35);
    dir.position.set(18, 28, 12);
    dir.castShadow = true;
    dir.shadow.mapSize.set(1024, 1024);
    dir.shadow.camera.near = 0.5;
    dir.shadow.camera.far = 80;
    dir.shadow.camera.left = -40;
    dir.shadow.camera.right = 40;
    dir.shadow.camera.top = 40;
    dir.shadow.camera.bottom = -40;
    dir.shadow.bias = -0.0006;
    this.scene.add(dir);

    // Cool fill from opposite side — separates bots from walls
    const fill = new THREE.DirectionalLight(0x7db4ff, 0.45);
    fill.position.set(-12, 14, -18);
    this.scene.add(fill);
  }

  _setupEvents() {
    // Weapon switch via input will be handled in update
    // Debug toggle — F3 only. Shift+D was removed: Shift is sprint and
    // sprint-strafing right (Shift+D) fired keydown repeats that toggled the
    // debug overlay on and off mid-sprint.
    window.addEventListener('keydown', e=>{
      if(e.code==='F3'){
        this.hud.toggleDebug();
      }
    });
  }

  _setupOverlay() {
    const overlay = document.getElementById('overlay');
    const titleBlock = document.getElementById('title-block');
    const resultBlock = document.getElementById('result-block');
    const playBtn = document.getElementById('playBtn');
    const retryBtn = document.getElementById('retryBtn');

    // ---- Lobby weapon selector: the chosen weapon is equipped at match start
    this.lobbyWeapon = parseInt(localStorage.getItem('bf_lobby_weapon') || '0', 10);
    const weaponBtns = [...document.querySelectorAll('.lobby-weapon')];
    const refreshWeaponUI = () => {
      weaponBtns.forEach((b, i) => b.classList.toggle('selected', i === this.lobbyWeapon));
    };
    weaponBtns.forEach(b => {
      b.addEventListener('click', () => {
        this.lobbyWeapon = parseInt(b.dataset.weapon, 10);
        localStorage.setItem('bf_lobby_weapon', String(this.lobbyWeapon));
        refreshWeaponUI();
        this.audio.play('ui');
      });
    });
    refreshWeaponUI();

    // ---- Lobby last-match stats (localStorage: local only, no server)
    const statsEl = document.getElementById('lobby-stats');
    const showLobbyStats = () => {
      try {
        const last = JSON.parse(localStorage.getItem('bf_last_match') || 'null');
        const wins = parseInt(localStorage.getItem('bf_wins') || '0', 10);
        if (last) {
          statsEl.innerHTML = `ÚLTIMA PARTIDA: <b>${last.kills}</b> KILLS · <b>${last.deaths}</b> MUERTES${wins ? ` · VICTORIAS: <b>${wins}</b>` : ''}`;
        } else {
          statsEl.textContent = 'PRIMERA PARTIDA — 20 KILLS PARA GANAR';
        }
      } catch(e){ statsEl.textContent = ''; }
    };
    showLobbyStats();

    // Fullscreen + landscape lock from the JUGAR gesture itself (the only
    // moment a browser allows both). Best effort: iOS rejects the lock —
    // the rotate gate covers that case instead of a mid-game rotation.
    const tryFullscreenLandscape = async () => {
      const coarse = window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 900;
      if (!coarse || window.innerWidth > window.innerHeight) return;
      const el = document.documentElement;
      const req = el.requestFullscreen || el.webkitRequestFullscreen;
      if (!req) return;
      try {
        const p = req.call(el, { navigationUI: 'hide' });
        if (p && p.catch) await p;
        const so = screen.orientation && (screen.orientation.lock || screen.lockOrientation);
        if (so) { try { await so.call(screen.orientation || screen, 'landscape'); } catch (e) {} }
      } catch (e) { /* gate (main.js) instructs rotation instead */ }
    };

    // ---- Config panel: sensitivity (camera/ADS) + touch control size/opacity.
    // Writes through Settings (persisted); Input and PlayerController read the
    // live values every frame, so no re-wiring is needed on change.
    const configPanel = document.getElementById('config-panel');
    const cfgBindings = [
      ['cfg-sens',      'out-sens',      'sensMul',     v => `${v.toFixed(1)}×`],
      ['cfg-ads',       'out-ads',       'adsMul',      v => `${v.toFixed(2)}×`],
      ['cfg-btnscale',  'out-btnscale',  'btnScale',    v => `${v.toFixed(2)}×`],
      ['cfg-btnopacity','out-btnopacity','btnOpacity',  v => `${Math.round(v * 100)}%`],
    ];
    for (const [inputId, outId, setting, fmt] of cfgBindings) {
      const input = document.getElementById(inputId);
      const out = document.getElementById(outId);
      if (!input || !out) continue;
      input.value = String(settings.get(setting));
      out.textContent = fmt(settings.get(setting));
      input.addEventListener('input', () => {
        settings.set(setting, parseFloat(input.value));
        out.textContent = fmt(settings.get(setting));
      });
    }
    const openCfg = document.getElementById('btn-config');
    const closeCfg = document.getElementById('cfg-close');
    const resetCfg = document.getElementById('cfg-reset');
    if (openCfg) openCfg.addEventListener('click', () => {
      configPanel.classList.remove('hidden');
      this.audio.play('ui');
    });
    if (closeCfg) closeCfg.addEventListener('click', () => {
      configPanel.classList.add('hidden');
      this.audio.play('ui');
    });
    if (resetCfg) resetCfg.addEventListener('click', () => {
      settings.reset();
      for (const [inputId, outId, setting, fmt] of cfgBindings) {
        const input = document.getElementById(inputId);
        const out = document.getElementById(outId);
        if (input) input.value = String(settings.get(setting));
        if (out) out.textContent = fmt(settings.get(setting));
      }
      if (this.input && this.input.applyControlSettings) this.input.applyControlSettings();
      this.audio.play('ui');
    });

    const startGame = ()=>{
      this.audio.init();
      this.audio.play('ui');
      // Equip the lobby-selected weapon before the match starts
      this.weaponSystem.switchWeapon(this.lobbyWeapon + 1);
      this.startMatch();
      overlay.classList.add('hidden');
      titleBlock.classList.add('hidden');
      resultBlock.classList.add('hidden');
      // First-match onboarding for touch players: one compact card, closes on
      // tap or after 9s. Stored locally — shown exactly once per device.
      if ((window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 900)
          && !localStorage.getItem('bf_onboarded')) {
        try { localStorage.setItem('bf_onboarded', '1'); } catch (e) {}
        const hint = document.getElementById('touch-hint');
        if (hint) {
          hint.classList.remove('hidden');
          const close = () => hint.classList.add('hidden');
          const btn = document.getElementById('th-close');
          if (btn) btn.addEventListener('click', close, { once: true });
          setTimeout(close, 9000);
        }
      }
      // Lock pointer for PC
      if(window.innerWidth > 900){
        this.renderer.domElement.requestPointerLock();
      }
      tryFullscreenLandscape();
    };

    playBtn.addEventListener('click', startGame);
    retryBtn.addEventListener('click', startGame);
    // Also allow Enter
    window.addEventListener('keydown', e=>{
      if(e.code==='Enter' && this.matchState==='FINISHED'){
        startGame();
      }
    });

    // Unlock pointer on overlay show
    this.showResult = (won)=>{
      // Exactly once per match: the kill-win path and the frame's "Check win"
      // scan can both fire in the same frame, which used to double-count
      // bf_wins and re-pop the result screen.
      if (this._resultShown) return;
      this._resultShown = true;
      const title = document.getElementById('result-title');
      const sub = document.getElementById('result-sub');
      const fk = document.getElementById('finalKills');
      const fd = document.getElementById('finalDeaths');
      const fs = document.getElementById('finalScore');
      title.textContent = won ? 'VICTORIA' : 'DERROTA';
      title.style.color = won ? '#ffd23f' : '#ff6b6a';
      sub.textContent = won ? `¡${this.playerKills} kills!` : `Llegaste a ${this.playerKills} kills`;
      fk.textContent = this.playerKills;
      fd.textContent = this.playerDeaths;
      fs.textContent = `${this.playerKills} - ${this.playerDeaths}`;
      // Persist last-match stats + wins for the lobby
      try {
        localStorage.setItem('bf_last_match', JSON.stringify({ kills: this.playerKills, deaths: this.playerDeaths }));
        if (won) localStorage.setItem('bf_wins', String(parseInt(localStorage.getItem('bf_wins') || '0', 10) + 1));
      } catch(e){ /* storage full/blocked: lobby stats just stay stale */ }
      showLobbyStats();
      document.body.classList.remove('playing'); // back to lobby: hide gameplay HUD/touch controls
      resultBlock.classList.remove('hidden');
      titleBlock.classList.add('hidden');
      overlay.classList.remove('hidden');
      document.exitPointerLock();
    };
  }

  startMatch() {
    // The gameplay HUD + touch controls only exist DURING a match: without
    // this, mobile controls and health/ammo chips bleed through the lobby.
    document.body.classList.add('playing');
    this.matchState = 'PLAYING';
    this.matchTime = 0;
    this.playerKills = 0;
    this.playerDeaths = 0;
    this._resultShown = false; // showResult must fire exactly once per match
    // Rule §4: a restart returns ALL temporal state to clean. Pending respawn
    // timers from the previous match would teleport entities 1.8s in; leftover
    // fire/shake/cooldown state would bleed into the new match.
    for (const t of this._pendingRespawns) clearTimeout(t);
    this._pendingRespawns.length = 0;
    // The cancelled timers were also what hid the death overlay — do it here.
    const dOv = document.getElementById('death-overlay');
    if (dOv) dOv.classList.remove('show');
    this.weaponSystem.fireCooldown = 0;
    this.weaponSystem._switchAnim = 0;
    this._hitstop = 0;
    this._shake = 0;
    this.hitFlash = 0;
    // Reset player and bots
    const playerSpawn = this.map.getRandomSpawn();
    this.playerController.respawn(playerSpawn);
    this.playerController.health = this.playerController.maxHealth;
    this.hud.update({ health: this.playerController.maxHealth, ammo: this.weaponSystem.getAmmoText(), kills: 0, deaths: 0, score: '0 - 0', timeLeft: this.matchDuration, fps: 60, pos: this.player.position, botCount: this.bots.length });
    
    for(const bot of this.bots){
      const pos = this.map.getRandomSpawn(this.player.position);
      bot.respawn(pos);
      bot.kills = 0;
      bot.deaths = 0;
    }
    this.weaponSystem.ammoInMag = this.weaponSystem.currentWeapon.magazineSize;
    this.weaponSystem.reserveAmmo = this.weaponSystem.currentWeapon.magazineSize * 3;
    this.weaponSystem.isReloading = false;
  }

  // Dynamic resolution: every ~1.5s of frames, if the average frame time is
  // over budget (22ms), drop DPR a step; if comfortably under (14ms) and below
  // cap, raise it back. Small steps avoid visible oscillation.
  _adaptResolution(dt) {
    this._frameTimes.push(dt);
    if (this._frameTimes.length < 90) return;
    const avg = this._frameTimes.reduce((a,b)=>a+b, 0) / this._frameTimes.length;
    this._frameTimes.length = 0;
    const step = 0.15;
    if (avg > 0.022 && this._dpr.value > this._dpr.min) {
      this._dpr.value = Math.max(this._dpr.min, this._dpr.value - step);
      this.renderer.setPixelRatio(this._dpr.value);
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    } else if (avg < 0.014 && this._dpr.value < this._dpr.max) {
      this._dpr.value = Math.min(this._dpr.max, this._dpr.value + step);
      this.renderer.setPixelRatio(this._dpr.value);
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
  }

  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  // Screen-space angle of an attacker relative to where the player faces:
  // 0 = front, +90° = right, 180° = behind, -90° = left. Pure math so the
  // test harness can pin the convention. Camera forward for rotation.y = yaw
  // (YXZ) is (-sin yaw, 0, -cos yaw) → facing angle = yaw + π.
  _damageAngle(attacker) {
    const dx = attacker.position.x - this.player.position.x;
    const dz = attacker.position.z - this.player.position.z;
    const toAtk = Math.atan2(dx, dz);
    const facing = this.playerController.yaw + Math.PI;
    let rel = toAtk - facing;
    while (rel > Math.PI) rel -= Math.PI * 2;
    while (rel < -Math.PI) rel += Math.PI * 2;
    return -rel; // CSS clockwise-positive
  }

  // DamageSystem central
  applyDamage(target, amount, hitType, attacker) {
    // Once a match is decided, late damage (stray bullets in the same frame)
    // must not change scores or retrigger the result screen.
    if(!target.isAlive || this.matchState === 'FINISHED') return false;
    
    let died = false;
    if(target.isBot){
      died = target.takeDamage(amount, hitType, attacker);
    } else {
      // Player
      died = this.playerController.takeDamage(amount);
      // Damage vignette — real overlay above the canvas
      if(!died){
        this.hitFlash = 0.3;
        const v = document.getElementById('damage-vignette');
        if (v) { v.classList.add('show'); clearTimeout(this._vignTimer); this._vignTimer = setTimeout(()=> v.classList.remove('show'), 240); }
        if(this.audio) this.audio.play('hurt');
        // Where did that come from? Directional wedge so the player can turn
        // and fight instead of guessing (essential on mobile, useful on PC).
        if (attacker && attacker.position) {
          this.hud.showDamageDirection(this._damageAngle(attacker));
        }
      }
    }

    if(died){
      // Score
      if(attacker && !attacker.isBot){
        this.playerKills++;
        this.hud.showKill(attacker.name || 'YOU', target.name || 'BOT', hitType==='head');
        // Player kill streak: consecutive kills within 3.5s escalate the banner
        const now = performance.now();
        this._streakCount = (now - (this._lastKillAt || 0) < 3500) ? (this._streakCount || 0) + 1 : 1;
        this._lastKillAt = now;
        this.hud.showKillBanner(hitType==='head', this._streakCount);
        if(this.audio) this.audio.play('kill');
        if(this.audio) this.audio.play('kill_banner');
        // Kill punch: micro hitstop + shake strong enough to FEEL it (vision
        // audit: previous 0.5 was invisible; 1.4 ≈ 3px wobble ≈ clear confirm)
        this._hitstop = 0.055;
        this._shake = Math.min(1.6, (this._shake||0) + 1.4);
      } else if(!target.isBot){
        this.playerDeaths++;
        // Player death breaks any active streak
        this._streakCount = 0;
        // The death drone belongs to the player's own death. Bot deaths already
        // carry their feedback (VFX + kill jingle); playing it for every bot
        // kill — including bot-vs-bot across the map — was constant bass mud.
        if(this.audio) this.audio.play('death');
        // Death transition: red fade + MUERTE banner until respawn
        const dOv = document.getElementById('death-overlay');
        if (dOv) dOv.classList.add('show');
      } else if(target.isBot && attacker && attacker.isBot){
        attacker.kills++;
        // Bots killing each other (or the player) belong in the feed: in an
        // FFA the leaderboard race must stay legible, not only your own kills.
        this.hud.showKill(attacker.name || 'BOT', target.isBot ? (target.name || 'BOT') : 'YOU', hitType==='head');
      }
      // A bot reaching the kill target wins the FFA: the match must end in
      // defeat here, not keep running until the timer silently decides.
      const botLeader = target.isBot && attacker && attacker.isBot ? Math.max(attacker.kills, 0) : 0;
      if(botLeader >= this.killTarget){
        this.matchState = 'FINISHED';
        this.showResult(false);
        return died;
      }

      // Respawn after 1.8s — tracked so startMatch can cancel them. A shotgun
      // blast can kill TWO entities in the same frame: each death schedules
      // its own timer, so this must be a list (a single handle let stale
      // timers from the previous match teleport entities mid-next-match).
      const respawnTimer = setTimeout(()=>{
        if(target.isBot){
          const pos = this.map.getRandomSpawn(this.player.position);
          target.respawn(pos);
        } else {
          // Player respawn
          const pos = this.map.getRandomSpawn();
          // Find far spawn from enemies
          let farPos = pos;
          let maxDist = 0;
          for(let i=0;i<6;i++){
            const p = this.map.getRandomSpawn();
            let minDistToBot = Infinity;
            for(const b of this.bots){
              if(b.isAlive) minDistToBot = Math.min(minDistToBot, p.distanceTo(b.position));
            }
            if(minDistToBot > maxDist){
              maxDist = minDistToBot;
              farPos = p;
            }
          }
          this.playerController.respawn(farPos);
          const dOv2 = document.getElementById('death-overlay');
          if (dOv2) dOv2.classList.remove('show');
          if(this.audio) this.audio.play('respawn');
        }
      }, 1800);
      this._pendingRespawns.push(respawnTimer);

      // Check win condition (player reached the target)
      if(this.playerKills >= this.killTarget){
        this.matchState = 'FINISHED';
        this.showResult(true);
      }
    }

    return died;
  }

  // Entity-entity separation (player + bots): resolve overlaps in XZ so
  // nobody stands inside anyone else. Each overlap pushes both parties apart
  // by half; every push is validated against map geometry so a shove can
  // never push anyone through a wall or off a platform edge into geometry.
  // 8 entities → 28 pairs of cheap distance checks per frame.
  _separateEntities() {
    const ents = this.player.isAlive ? [this.player, ...this.bots.filter(b => b.isAlive)] : this.bots.filter(b => b.isAlive);
    const RADII = ents.map(e => e.isBot ? 0.38 : 0.35);
    for (let i = 0; i < ents.length; i++) {
      for (let j = i + 1; j < ents.length; j++) {
        const a = ents[i], b = ents[j];
        const dx = b.position.x - a.position.x;
        const dz = b.position.z - a.position.z;
        const minDist = RADII[i] + RADII[j];
        const dSq = dx * dx + dz * dz;
        if (dSq >= minDist * minDist || dSq === 0) continue;
        const d = Math.sqrt(dSq);
        const overlap = (minDist - d) / 2;
        const nx = dx / d, nz = dz / d;
        // Candidate positions: push each entity half the overlap apart
        const tryA = { x: a.position.x - nx * overlap, z: a.position.z - nz * overlap };
        const tryB = { x: b.position.x + nx * overlap, z: b.position.z + nz * overlap };
        const probe = new THREE.Vector3();
        probe.copy(a.position); probe.x = tryA.x; probe.z = tryA.z;
        if (!this.map.checkCollision(probe, RADII[i], a.height || 1.65)) {
          a.position.x = tryA.x; a.position.z = tryA.z;
          if (a.isBot && a.mesh) { a.mesh.position.x = a.position.x; a.mesh.position.z = a.position.z; }
        }
        probe.copy(b.position); probe.x = tryB.x; probe.z = tryB.z;
        if (!this.map.checkCollision(probe, RADII[j], b.height || 1.65)) {
          b.position.x = tryB.x; b.position.z = tryB.z;
          if (b.isBot && b.mesh) { b.mesh.position.x = b.position.x; b.mesh.position.z = b.position.z; }
        }
      }
    }
  }

  // VFX helpers — pooling + loop central (sin rAF por partícula)
  muzzleFlash(pos, dir, size = 1) {
    // Two-layer flash: glowing shell + hot core, at the muzzle tip.
    // `size` scales per weapon (shotgun blast vs pistol snap).
    const flash = new THREE.Mesh(this._geoMuzzle, this._matMuzzle.clone());
    flash.position.copy(pos).addScaledVector(dir, 0.10);
    flash.scale.set(1.6 * size, 1.6 * size, 2.4 * size);
    this.scene.add(flash);
    this._activeFlashes.push({ mesh: flash, life: 0.055, maxLife: 0.055 });

    const core = new THREE.Mesh(this._geoMuzzleCore, this._matMuzzleCore);
    core.position.copy(flash.position);
    this.scene.add(core);
    this._activeFlashes.push({ mesh: core, life: 0.04, maxLife: 0.04 });
  }

  impact(point, isHeadshot) {
    // Impact cube + expanding ring decal (always faces camera)
    const mat = (isHeadshot ? this._matImpactHead : this._matImpact).clone();
    const cube = new THREE.Mesh(this._geoImpact, mat);
    cube.position.copy(point);
    this.scene.add(cube);
    this._activeImpacts.push({ mesh: cube, life: 0.36, maxLife: 0.36 });

    const ring = new THREE.Mesh(this._geoRing, this._matRing.clone());
    ring.position.copy(point);
    ring.quaternion.copy(this.camera.quaternion);
    this.scene.add(ring);
    this._activeRings.push({ mesh: ring, life: 0.22, maxLife: 0.22 });
  }

  blood(point) {
    for(let i=0;i<5;i++){
      const mat = this._matBlood.clone();
      const p = new THREE.Mesh(this._geoBlood, mat);
      p.position.copy(point);
      p.position.y += 0.12;
      this.scene.add(p);
      const vel = new THREE.Vector3((Math.random()-0.5)*2.4, Math.random()*1.5+0.5, (Math.random()-0.5)*2.4);
      this._activeBloods.push({ mesh: p, vel, life: 0.42, maxLife: 0.42 });
    }
  }

  _updateVFX(dt) {
    // Flashes
    for(let i=this._activeFlashes.length-1;i>=0;i--){
      const f = this._activeFlashes[i];
      f.life -= dt;
      if(f.life <= 0){ this.scene.remove(f.mesh); this._activeFlashes.splice(i,1); }
      else if (f.mesh.material.transparent) {
        f.mesh.material.opacity = Math.max(0, f.life / f.maxLife) * 0.9;
      }
    }
    // Impacts
    for(let i=this._activeImpacts.length-1;i>=0;i--){
      const it = this._activeImpacts[i];
      it.life -= dt;
      if(it.life <= 0){ this.scene.remove(it.mesh); this._activeImpacts.splice(i,1); }
      else { it.mesh.position.y += dt * 1.2; it.mesh.material.opacity = it.life / it.maxLife; it.mesh.rotation.x += dt*6; it.mesh.rotation.y += dt*4; }
    }
    // Rings
    for(let i=this._activeRings.length-1;i>=0;i--){
      const r = this._activeRings[i];
      r.life -= dt;
      if(r.life <= 0){ this.scene.remove(r.mesh); this._activeRings.splice(i,1); }
      else {
        const k = 1 - r.life / r.maxLife;
        const s = 1 + k * 2.2;
        r.mesh.scale.set(s, s, s);
        r.mesh.material.opacity = (1 - k) * 0.7;
      }
    }
    // Blood
    for(let i=this._activeBloods.length-1;i>=0;i--){
      const b = this._activeBloods[i];
      b.life -= dt;
      if(b.life <= 0){ this.scene.remove(b.mesh); this._activeBloods.splice(i,1); }
      else {
        b.mesh.position.addScaledVector(b.vel, dt);
        b.vel.y -= 9.8 * dt * 0.6;
        b.mesh.material.opacity = b.life / b.maxLife;
      }
    }
  }

  animate() {
    requestAnimationFrame(()=> this.animate());
    let dt = Math.min(this.clock.getDelta(), 0.033);
    const time = this.clock.elapsedTime;

    // FPS
    this.fps = 1/dt;
    this._adaptResolution(dt);

    if(this.matchState !== 'PLAYING'){
      // Lobby camera: slow orbit over the arena — the game itself is the menu backdrop
      const t = this.clock.elapsedTime;
      const r = 26, h = 12;
      this.camera.position.set(Math.sin(t * 0.08) * r, h, Math.cos(t * 0.08) * r);
      this.camera.lookAt(0, 1, 0);
      // Bots wander during lobby so the arena feels alive (no shooting: the
      // player ghost is hidden from targeting while in menu)
      const playerWasTargetable = this.player.isAlive;
      this.player.isAlive = false;
      for (const bot of this.bots) {
        if (!bot.isAlive) { if (bot._dyingT > 0) bot._updateDying(Math.min(dt, 0.033)); continue; }
        bot.update(Math.min(dt, 0.033), this.player, this.bots, this.map);
      }
      this.player.isAlive = playerWasTargetable;
      this._updateVFX(Math.min(dt, 0.033));
      // Hide first-person viewmodel while in menu
      if (this.weaponSystem && this.weaponSystem.weaponMesh) this.weaponSystem.weaponMesh.visible = false;
      this.renderer.render(this.scene, this.camera);
      return;
    }

    // Kill hitstop: 55ms of 45% time-scale — punchy, never interruptive
    if(this._hitstop > 0){
      dt *= 0.45;
      this._hitstop -= Math.min(this._hitstop, 1/60);
    }

    this.matchTime += dt;
    const timeLeft = Math.max(0, this.matchDuration - this.matchTime);
    if(timeLeft <= 0){
      this.matchState = 'FINISHED';
      const won = this.playerKills >= Math.max(...this.bots.map(b=>b.kills), 0);
      this.showResult(won);
      return; // match is over — do not simulate or render another gameplay frame
    }

    // Input
    this.input.update();
    const { reload, switchW } = this.input.consumeOneFrameActions();
    if(reload) this.weaponSystem.reload();
    if(switchW) this.weaponSystem.switchWeapon(switchW);

    // Player
    this.playerController.update(dt);

    // ADS is a camera zoom + weapon centering: one aim input, one feel.
    // Speed FOV: moving fast widens the view slightly (+5° at full run) —
    // a classic arcade speed cue that costs nothing and never triggers while
    // aiming (ADS fov wins).
    this.weaponSystem.setAim(this.input.aim, dt);
    const horizSpeed = Math.hypot(this.playerController.velocity.x, this.playerController.velocity.z);
    const speedFov = Math.min(1, horizSpeed / this.playerController.moveSpeed) * 5;
    const targetFov = this.input.aim ? 62 : 78 + speedFov;
    if (Math.abs(this.camera.fov - targetFov) > 0.05) {
      this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, targetFov, Math.min(1, dt * 14));
      this.camera.updateProjectionMatrix();
    }

    // Weapon
    // Feed the weapon the player's horizontal speed for walk bob/sway
    this.weaponSystem.setMoveSpeed(Math.hypot(this.playerController.velocity.x, this.playerController.velocity.z));
    this.weaponSystem.update(dt, this.player.isAlive);

    // Shooting (player)
    if(this.input.fire && this.player.isAlive){
      const allTargets = [...this.bots, this.player];
      this.weaponSystem.fire(this.player, allTargets, this.map);
    }

    // Bots: dying bots animate their tumble (they no longer run AI); alive
    // bots run full behavior. Same loop, same contract as before.
    for(const bot of this.bots){
      if (!bot.isAlive) {
        if (bot._dyingT > 0) bot._updateDying(dt);
        continue;
      }
      const action = bot.update(dt, this.player, this.bots, this.map);
      if(action && action.shoot && bot.isAlive){
        // Bot shooting: eye is at head, not 0.6 above top
        const botEyePos = bot.position.clone(); botEyePos.y -= 0.12;
        const botDir = new THREE.Vector3(Math.sin(bot.yaw), 0, Math.cos(bot.yaw));
        // Add slight vertical aim to target if target is higher/lower
        if(action.target){
          const toTarget = new THREE.Vector3().subVectors(action.target.position, botEyePos).normalize();
          botDir.lerp(toTarget, 0.35);
          botDir.normalize();
        }
        // Temporarily override camera for weapon fire
        const savedPos = this.camera.position.clone();
        const savedQuat = this.camera.quaternion.clone();
        // Move camera to bot eye for raycast
        this.camera.position.copy(botEyePos);
        // Set camera rotation to look at target
        const lookTarget = botEyePos.clone().addScaledVector(botDir, 10);
        this.camera.lookAt(lookTarget);
        this.camera.updateMatrixWorld();

        const allTargets = [this.player, ...this.bots];
        // savedPos IS the real listener (player camera): fire() must measure
        // bot-shot distance from here, not from the hijacked bot-eye camera.
        const result = this.weaponSystem.fire(bot, allTargets, this.map, savedPos);

        // Restore camera
        this.camera.position.copy(savedPos);
        this.camera.quaternion.copy(savedQuat);
        this.camera.updateMatrixWorld();

        // If bot shot, show muzzle flash at bot
        if(result){
          this.muzzleFlash(botEyePos, botDir);
        }
      }
    }

    // Keep combatants out of each other's bodies. Without this, bots bumble
    // INTO the player and the camera fills with giant polygons at point-blank.
    // XZ-only push-apart, validated against the map (never shove through walls).
    this._separateEntities();

    // Check win (guarded: applyDamage already finishes + shows the result)
    if(this.matchState === 'PLAYING' && this.playerKills >= this.killTarget){
      this.matchState = 'FINISHED';
      this.showResult(true);
      return;
    }

    // HUD
    const aliveBots = this.bots.filter(b=>b.isAlive).length;
    const botLeader = this.bots.reduce((a,b)=>Math.max(a,b.kills),0);
    this.hud.update({
      score: `${this.playerKills} - ${botLeader}`,
      leader: botLeader,
      timeLeft,
      health: this.playerController.health,
      ammo: this.weaponSystem.getAmmoText(),
      kills: this.playerKills,
      deaths: this.playerDeaths,
      fps: this.fps,
      pos: this.player.position,
      botCount: aliveBots,
      weaponName: this.weaponSystem.currentWeapon.name
    });

    // Hit flash fade
    if(this.hitFlash>0){
      this.hitFlash -= dt;
    }

    // Screen shake (kill punch / damage) — applied as transient camera offset
    if(this._shake > 0.001){
      const s = this._shake;
      this.camera.position.x += (Math.random()-0.5) * s * 0.13;
      this.camera.position.y += (Math.random()-0.5) * s * 0.13;
      this.camera.rotation.z += (Math.random()-0.5) * s * 0.02;
      this._shake *= Math.max(0, 1 - dt * 12); // linear-ish decay, ~gone in 0.25s
      if(this._shake < 0.001) this._shake = 0;
    }

    this._updateVFX(dt);

    this.renderer.render(this.scene, this.camera);

    // Shake offsets must not persist into the next simulation step:
    // PlayerController.update() overwrites camera.position/rotation from
    // authoritative player state each frame, so no restore is needed.
  }
}
