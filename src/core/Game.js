import * as THREE from '../lib/three.module.js';
import { Input } from './Input.js';
import { PlayerController } from '../player/PlayerController.js';
import { WeaponSystem } from '../combat/WeaponSystem.js';
import { Bot } from '../bots/Bot.js';
import { Map } from '../world/Map.js';
import { HUD } from '../ui/HUD.js';
import { AudioManager } from '../audio/AudioManager.js';
import { settings } from './Settings.js';
import { AvatarLib } from '../characters/SoldierAvatar.js';

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
    this.scene.fog = new THREE.Fog(0x87b5e8, 45, 125); // mapa 120x120

    // Renderer — mobile renders sharper than before (DPR cap 1.75, was 1.5:
    // the "Android looks degraded" note) with the dynamic downscaler
    // (_adaptResolution) protecting FPS if the device can't hold the budget.
    const isMobile = window.innerWidth < 900 || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    this.renderer = new THREE.WebGLRenderer({ antialias: !isMobile, powerPreference: 'high-performance' });
    this._dpr = { min: 0.9, max: isMobile ? 1.75 : 2.0, value: Math.min(window.devicePixelRatio, isMobile ? 1.75 : 2.0) };
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
    // Modo persistido: 'squad' (Duelo de Escuadras, BO7) | 'ffa' (Todos contra Todos)
    this.gameMode = localStorage.getItem('bf_mode') || 'squad';
    this.map = new Map(this.scene, this.gameMode);
    this.hud = new HUD();
    this.audio = new AudioManager();

    // Player
    this.player = {
      position: new THREE.Vector3(0, 1.8, 10),
      isAlive: true,
      isBot: false,
      mesh: null,
      name: 'YOU',
      team: this.gameMode === 'squad' ? 'ally' : 'ffa_player'
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
    this.weaponData = this.weaponSystem.weaponData; // datos del arsenal (tienda)
    // Skins: data + aplicar la skin global del lobby a todo el arsenal
    import('../combat/WeaponSystem.js').then(({ WeaponSkins }) => {
      this.skinsFor = WeaponSkins;
      if (!WeaponSkins[this.globalSkin]) this.globalSkin = 'none';
      for (const wKey of this.weaponSystem.weapons) this.weaponSystem.applySkin(wKey, this.globalSkin);
      this._renderLobbySkins();
      this._paintHeroGun(); // por si el héroe ya estaba construido
    });

    // Bots — Duelo de Escuadras: 4v4 (jugador + 3 aliados vs 4 enemigos)
    this.bots = [];
    for(let i=0;i<7;i++){
      const pos = this.map.getRandomSpawn(this.player.position);
      const bot = new Bot(i, this.scene, this.map, pos);
      if (this.gameMode === 'squad') {
        bot.name = (i < 3 ? `ALIADO_${i+1}` : `ENEMIGO_${i-2}`);
        bot.team = (i < 3 ? 'ally' : 'enemy');
        bot.colorStripe = (i < 3 ? 0x2ee86e : 0xff5a4a);
      } else {
        bot.name = `BOT_${i+1}`;
        bot.team = `ffa_${i}`; // todos contra todos
        bot.colorStripe = 0xffd23f;
      }
      this.bots.push(bot);
    }
    // Avatares GLB reales: cargar y aplicarlo a los 7 bots (fallback blocky
    // automático si el asset no está)
    AvatarLib.load().then((ok) => {
      console.log('[Avatars] GLB listo:', ok, '— aplicando a', this.bots.length, 'bots');
      if (!ok) return;
      try {
        for (const b of this.bots) b.attachAvatar();
        this._buildLobbyHero();
        console.log('[Lobby] héroe construido:', !!this._lobbyHero);
      } catch (e) { console.error('[Avatars] error:', e && e.message, e && e.stack && e.stack.split('\n')[1]); }
    });

    // Match
    this.matchState = 'LOADING'; // LOADING, COUNTDOWN, PLAYING, FINISHED
    // ARSENAL: tecla B abre/cierra la tienda en PC (en móvil, botón dedicado)
    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyB' && this.matchState === 'PLAYING' && this.phase !== 'roundEnd') this.openShop();
    });
    this.matchTime = 0;
    this.matchDuration = 5 * 60; // 5 minutes (FFA)
    this.killTarget = 20;
    // CLASH SQUAD: rondas estilo Free Fire (fuente: Wikipedia — modos de FF)
    // Mejor-de-7: gana el PRIMERO en llegar a 4 rondas de equipo.
    // Cada ronda: fase de COMPRA (tienda animada) → combate → eliminación.
    this.ROUND_TARGET = 4;      // rondas para ganar el duelo
    this.BUY_TIME = 15;         // segundos de fase de compra
    this.ROUND_TIME = 90;       // segundos por ronda (mapa 120x120)
    this.round = 1;
    this.roundWins = { ally: 0, enemy: 0 };
    this.phase = 'buy';         // squad: 'buy' | 'combat' | 'roundEnd'
    this.phaseTime = this.BUY_TIME;
    this.teamScore = { ally: 0, enemy: 0 }; // kills de la ronda actual (HUD)
    this.coins = 1300;
    this.immuneUntil = 0;
    this._roundEndTime = 0;
    this._combatStarted = false;
    // SKIN global del arsenal (loadout de lobby, gratis, persistente).
    // Decisión de producto: las skins se eligen en el LOBBY, no en partida.
    this.globalSkin = 'none';
    try {
      const gs = localStorage.getItem('bf_skin_global') || 'none';
      if (gs) this.globalSkin = gs;
    } catch(e) {}
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

    // ── LOBBY 3D: pedestal + héroe (el GLB lo llena al cargar) ──
    this._lobbyGroup = new THREE.Group();
    // Héroe a la DERECHA del plano (el panel del lobby ocupa la izquierda):
    // cámara mirando al héroe desplazado — composición estilo Free Fire.
    this._lobbyGroup.position.set(2.6, 0, 5.2);
    this.scene.add(this._lobbyGroup);
    const pedMat = new THREE.MeshStandardMaterial({ color: 0x1a2233, roughness: 0.6, metalness: 0.3 });
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.9, 0.22, 24), pedMat);
    ped.position.y = 0.11;
    ped.receiveShadow = true;
    this._lobbyGroup.add(ped);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.55 });
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.55, 1.75, 40), ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.225;
    this._lobbyGroup.add(ring);
    this._lobbyRingMat = ringMat;

    // Time
    this.clock = new THREE.Clock();
    this.lastFpsUpdate = 0;
    this.fps = 60;

    this._setupEvents();
    this._setupOverlay();

    // Visibility resume: when the browser freezes the tab (screen off, app
    // switch — rAF stops, which is correct and battery-friendly), returning
    // must be clean: flush the clamped delta and wake the audio context so
    // the first frame back doesn't drop sound or lurch. The simulation itself
    // never advances while hidden (dt clamp = soft pause), so no death while
    // away. Chrome may also fully discard the page after long hides: that
    // reloads the lobby by browser design — nothing we can (or should) do.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && this.matchState === 'PLAYING') {
        this.clock.getDelta(); // flush the accumulated (clamped) delta
        if (this.audio) this.audio._ensure();
      }
    });

    window.addEventListener('resize', ()=> this.onResize());
    this.onResize();

    // Start loop
    this.animate();
  }

  // Héroe del lobby: soldado GLB con arma, idle, giro suave
  _buildLobbyHero() {
    const gun = AvatarLib.makeHeldWeapon('rifle', 0xffd23f);
    const av = AvatarLib.create({ team: 'hero', weapon: gun });
    if (!av) { console.error('[Lobby] avatar no creado'); return; }
    this._lobbyHero = av;
    this._lobbyGun = gun;
    av.root.scale.setScalar(1.22); // presencia: el héroe debe lucir tras el velo
    av.root.position.set(0, 0.22, 0);
    this._lobbyGroup.add(av.root);
    // Foco dorado sobre el héroe (1 luz sin sombras: el velo del overlay lo
    // apagaba y "no lucía").
    if (!this._lobbySpot) {
      this._lobbySpot = new THREE.PointLight(0xffd9a0, 12, 12, 1.6);
      this._lobbySpot.position.set(2.6, 3.2, 6.4);
      this.scene.add(this._lobbySpot);
    }
    this._paintHeroGun(); // skin global del lobby también en su arma
  }

  // El arma del héroe lleva la skin global elegida (las skins "ni se veían").
  _paintHeroGun() {
    if (!this._lobbyGun || !this.skinsFor) return;
    const sk = this.skinsFor[this.globalSkin];
    if (!sk) return;
    const accent = new THREE.Color(sk.accent);
    this._lobbyGun.traverse((o) => {
      if (o.isMesh) {
        (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => {
          if (m.emissive && m.emissiveIntensity >= 0.2) {
            m.color.copy(accent); m.emissive.copy(accent);
          }
        });
      }
    });
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
    dir.shadow.camera.left = -50;
    dir.shadow.camera.right = 50;
    dir.shadow.camera.top = 50;
    dir.shadow.camera.bottom = -50;
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

    // ---- Lobby: selector de MODO (Duelo de Escuadras 4v4 / Todos contra Todos).
    // La lista de armas del lobby fue RETIRADA (decisión del usuario): el arma
    // se compra en la fase de compra del Clash Squad, como en Free Fire.
    this._lobbyModeEls = [...document.querySelectorAll('.lobby-mode')];
    const refreshModeUI = () => {
      this._lobbyModeEls.forEach(b => b.classList.toggle('selected', b.dataset.mode === this.gameMode));
    };
    this._lobbyModeEls.forEach(b => {
      b.addEventListener('click', () => {
        if (this.gameMode === b.dataset.mode) return;
        this.gameMode = b.dataset.mode;
        localStorage.setItem('bf_mode', this.gameMode);
        refreshModeUI();
        this.audio.play('ui');
        // El mapa, los equipos y los tintes se construyen una sola vez al
        // arrancar para este modo: recargar es el único reinicio limpio
        // (regla §4) en vez de jugar FFA con arena y equipos de escuadras.
        location.reload();
      });
    });
    refreshModeUI();

    // ---- Lobby last-match stats (localStorage: local only, no server)
    const statsEl = document.getElementById('lobby-stats');
    const showLobbyStats = () => {
      try {
        const last = JSON.parse(localStorage.getItem('bf_last_match') || 'null');
        const wins = parseInt(localStorage.getItem('bf_wins') || '0', 10);
        if (last) {
          statsEl.innerHTML = `ÚLTIMA PARTIDA: <b>${last.kills}</b> KILLS · <b>${last.deaths}</b> MUERTES${wins ? ` · VICTORIAS: <b>${wins}</b>` : ''}`;
        } else {
          statsEl.textContent = 'PRIMERA PARTIDA — DUELO DE ESCUADRAS: GANA EL PRIMERO EN LLEGAR A 4 RONDAS';
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
    // Open/close logic shared by the lobby chip AND the in-match ⚙ button.
    // Opening during a match FREEZES the simulation (paused) so bots can't
    // shoot a player who is reading a slider; closing resumes.
    const openConfig = () => {
      configPanel.classList.remove('hidden');
      this._configOpen = true;
      if (this.input && this.input.setEditMode) this.input.setEditMode(false);
      const note = document.getElementById('cfg-note');
      if (note) note.textContent = 'EDITAR CONTROLES: arrastra cada botón y suéltalo. Se guarda solo.';
      if (document.pointerLockElement) document.exitPointerLock();
      this.audio.play('ui');
    };
    const openCfg = document.getElementById('btn-config');
    const openCfgInMatch = document.getElementById('btn-settings');
    const closeCfg = document.getElementById('cfg-close');
    const resetCfg = document.getElementById('cfg-reset');
    const editCfg = document.getElementById('cfg-editcontrols');
    if (openCfg) openCfg.addEventListener('click', openConfig);
    if (openCfgInMatch) openCfgInMatch.addEventListener('click', openConfig);
    if (closeCfg) closeCfg.addEventListener('click', () => {
      configPanel.classList.add('hidden');
      this._configOpen = false;
      if (this.input && this.input.setEditMode) this.input.setEditMode(false);
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
      const note = document.getElementById('cfg-note');
      if (note) note.textContent = 'Controles restablecidos. Se guarda en este dispositivo.';
      this.audio.play('ui');
    });
    if (editCfg) editCfg.addEventListener('click', () => {
      if (this.input && this.input.setEditMode) {
        const on = !this.input.editMode;
        this.input.setEditMode(on);
        const note = document.getElementById('cfg-note');
        if (note) note.textContent = on
          ? 'MODO EDICIÓN: arrastra cada botón. CERRAR guarda y vuelve al juego.'
          : 'Disposición guardada.';
      }
      this.audio.play('ui');
    });

    const startGame = ()=>{
      this.audio.init();
      this.audio.play('ui');
      this.startMatch();
      overlay.classList.add('hidden');
      titleBlock.classList.add('hidden');
      resultBlock.classList.add('hidden');
      // First-match onboarding for touch players: one compact card, closes on
      // tap or after 9s. Stored locally — shown exactly once per device.
      // En escuadras se difiere al primer combate: la tarjeta tapaba la
      // tienda de compra y no dejaba comprar (captura móvil).
      if (this.gameMode !== 'squad') this._maybeTouchHint();
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
      if (this.gameMode === 'squad') {
        sub.textContent = `RONDAS ${this.roundWins.ally} — ${this.roundWins.enemy} · ${this.playerKills} kills`;
      } else {
        sub.textContent = won ? `¡${this.playerKills} kills!` : `Llegaste a ${this.playerKills} kills`;
      }
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
      if (this._lobbyGroup) this._lobbyGroup.visible = true; // vuelve el héroe tras la partida
      resultBlock.classList.remove('hidden');
      titleBlock.classList.add('hidden');
      overlay.classList.remove('hidden');
      document.exitPointerLock();
    };
  }

  // ABANDONAR (regla: sin pausa genérica): salir de la partida es recargar —
  // el reinicio más limpio posible, todo el estado temporal muere (regla §4).
  abandonMatch() {
    location.reload();
  }

  startMatch() {
    // The gameplay HUD + touch controls only exist DURING a match: without
    // this, mobile controls and health/ammo chips bleed through the lobby.
    document.body.classList.add('playing');
    // Reset squad-specific HUD (round score, immunity, shop) so FFA doesn't
    // inherit stale elements from a prior squad match.
    const ss = document.getElementById('squad-score');
    if (ss) ss.classList.remove('show');
    this.hud.closeShop();
    this.shopOpenFlag = false;
    // El pedestal del héroe es decorado del lobby: en partida confundía
    // (un "noveno" soldado dorado en medio de la arena).
    if (this._lobbyGroup) this._lobbyGroup.visible = false;
    this.matchState = 'PLAYING';
    this.matchTime = 0;
    this.playerKills = 0;
    this.playerDeaths = 0;
    this._resultShown = false; // showResult must fire exactly once per match

    if (this.gameMode === 'squad') {
      // ── CLASH SQUAD: mejor-de-7, primero a 4 rondas (reglas Free Fire) ──
      this.round = 1;
      this.player.team = 'ally'; // sin esto el fuego amigo no aplica al jugador
      this.roundWins = { ally: 0, enemy: 0 };
      // Oro inicial 1300: en R1 siempre hay algo comprable (escopeta 1200).
      // Con 1000 la tienda de R1 era un escaparate intocable ("no deja comprar").
      this.coins = 1300;               // oro inicial (arrastra entre rondas)
      this.weaponSystem.owned = new Set(['pistol']);
      this.weaponSystem.switchWeapon(2); // Pistola (índice 2)
      this.hud.updateTeamScore(0, 0, 1, this.ROUND_TARGET);
      this.startRound(1);
      return;
    }
    // ── FFA (Todos contra Todos): 20 kills, respawns, 5 minutos ──
    this.phase = 'ffa';
    this.player.team = 'ffa_player'; // equipo único: todos son enemigos
    this.teamScore.ally = 0;
    this.teamScore.enemy = 0;
    this.coins = 0;
    this.immuneUntil = this.matchTime + 5.0;
    this.hud.showImmunity(5);
    this._resultShown = false;
    this._resetTemporalState();
    // FFA: arsenal libre desde el inicio (la economía vive en el Clash Squad)
    this.weaponSystem.owned = new Set(['pistol', 'rifle', 'shotgun', 'smg']);
    this.weaponSystem.switchWeapon(1); // Rifle
    this.playerController.respawn(this.map.getRandomSpawn());
    this.playerController.health = this.playerController.maxHealth;
    for(const bot of this.bots){
      bot.respawn(this.map.getRandomSpawn(this.player.position));
      bot.kills = 0;
      bot.deaths = 0;
      bot.immuneUntil = this.matchTime + 5.0; // mismo escudo que el jugador
      bot.setWeapon('rifle');
    }
    this.weaponSystem.ammoInMag = this.weaponSystem.currentWeapon.magazineSize;
    this.weaponSystem.reserveAmmo = this.weaponSystem.currentWeapon.magazineSize * 3;
    this.weaponSystem.isReloading = false;
    this.hud.update({ health: this.playerController.maxHealth, ammo: this.weaponSystem.getAmmoText(), kills: 0, deaths: 0, score: '0 - 0', timeLeft: this.matchDuration, fps: 60, pos: this.player.position, botCount: this.bots.length });
  }

  // Rule §4: un reinicio devuelve TODO el estado temporal a limpio.
  _resetTemporalState() {
    for (const t of this._pendingRespawns) clearTimeout(t);
    this._pendingRespawns.length = 0;
    this.shopOpenFlag = false;
    this._streakCount = 0;
    this._lastKillAt = 0;
    if (this.hud && this.hud.killfeedEl) this.hud.killfeedEl.innerHTML = '';
    const dOv = document.getElementById('death-overlay');
    if (dOv) dOv.classList.remove('show');
    this.weaponSystem.fireCooldown = 0;
    this.weaponSystem._switchAnim = 0;
    this._hitstop = 0;
    this._shake = 0;
    this.hitFlash = 0;
  }

  // ═══ CLASH SQUAD — RONDAS (reglas Free Fire: BO7, compra antes de ronda,
  // ronda ganada al ELIMINAR al equipo rival) ═══
  startRound(n) {
    this.round = n;
    this.phase = 'buy';
    this.phaseTime = this.BUY_TIME;
    this.teamScore.ally = 0;
    this.teamScore.enemy = 0;
    this.matchTime = 0;
    this._combatStarted = false;
    this._resetTemporalState();
    // Reset por escuadra: cada equipo sale de SU base (jugador Sur, enemigos Norte)
    const squadSpawns = this.map.squadSpawns || { ally: [this.map.getRandomSpawn()], enemy: [this.map.getRandomSpawn()] };
    this.playerController.health = this.playerController.maxHealth;
    this.playerController.velocity.set(0,0,0);
    let allyIdx = 1, enemyIdx = 0;
    // Spawn que pisa cobertura = bot congelado en coll=true para siempre
    // (autopsia: (-1,17.3)/(1,-17.3) muerden la esquina de una cobertura).
    // Micro-espiral a la primera posición libre (jugador incluido).
    const snapClear = (pos, radius, height) => {
      // Margen +0.25: nacer a 2cm de un muro (válido pero infértil para moverse)
      // también congela en la práctica — visto en la autopsia tras el primer nudge.
      const R = radius + 0.25;
      const probe = pos.clone();
      const gy = this.map.getGroundY(probe.x, probe.z);
      probe.y = gy + height;
      if (!this.map.checkCollision(probe, R, height)) return probe;
      for (const r of [0.8, 1.6, 2.4]) {
        for (let a = 0; a < 8; a++) {
          const ang = a * Math.PI / 4;
          const cand = new THREE.Vector3(pos.x + Math.cos(ang) * r, pos.y, pos.z + Math.sin(ang) * r);
          cand.y = this.map.getGroundY(cand.x, cand.z) + height;
          if (!this.map.checkCollision(cand, R, height)) return cand;
        }
      }
      return probe; // sin hueco: respawn original (no peor que antes)
    };
    this.playerController.respawn(snapClear(squadSpawns.ally[0], this.playerController.radius, this.playerController.height));
    for (const bot of this.bots) {
      const pos = (bot.team === 'ally') ? squadSpawns.ally[allyIdx++ % 4] : squadSpawns.enemy[enemyIdx++ % 4];
      bot.respawn(snapClear(pos, bot.radius, bot.height));
      bot.velocity.set(0,0,0);
      // LA COMPRA DE LOS BOTS: cada ronda mejoran arma (IA de economía)
      bot.setWeapon(this._botBuy(n, bot));
    }
    this.weaponSystem.ammoInMag = this.weaponSystem.currentWeapon.magazineSize;
    this.weaponSystem.reserveAmmo = this.weaponSystem.currentWeapon.magazineSize * 3;
    this.weaponSystem.isReloading = false;
    this.hud.update({ health: this.playerController.maxHealth, ammo: this.weaponSystem.getAmmoText(), kills: 0, deaths: 0, score: `${this.roundWins.ally} — ${this.roundWins.enemy}`, timeLeft: this.ROUND_TIME, fps: 60, pos: this.player.position, botCount: this.bots.length });
    this.hud.updateTeamScore(this.roundWins.ally, this.roundWins.enemy, n, this.ROUND_TARGET);
    // TIENDA ANIMADA: se abre SOLA antes de cada ronda (estilo Free Fire)
    this.openShop();
  }

  // La IA "compra": mezcla determinista por bot+ronda que sube de tier.
  _botBuy(roundN, bot) {
    const roll = (bot.id * 7 + roundN * 3) % 10;
    if (roundN === 1) return roll < 6 ? 'pistol' : 'smg';
    if (roll < 4) return 'rifle';
    if (roll < 6) return 'shotgun';
    if (roll < 8) return 'smg';
    return 'pistol';
  }

  // Onboarding táctil bajo demanda (ver startGame: diferido al combate).
  _maybeTouchHint() {
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
  }

  // Fin de la fase de compra → ¡A LUCHAR!
  _startCombat() {
    this.phase = 'combat';
    this.phaseTime = this.ROUND_TIME;
    this._combatStarted = true;
    this.hud.closeShop();
    this.shopOpenFlag = false;
    // Defensa en profundidad (B5): si la fase de compra dejó un equipo a cero,
    // cerrar la ronda de inmediato en vez de jugar 90s contra un mapa vacío.
    this.hud.showRoundBanner('¡A LUCHAR!', `RONDA ${this.round}`, '#ffd23f');
    this._maybeTouchHint(); // onboarding diferido: la tienda ya cerró
    // Inmunidad corta al chocar (3s), y DISPARAR la rompe (regla Free Fire)
    this.immuneUntil = this.matchTime + 3.0;
    for (const b of this.bots) b.immuneUntil = this.matchTime + 3.0;
    this.hud.showImmunity(3);
    const allyAlive = (this.player.isAlive ? 1 : 0) + this.bots.filter(b => b.team === 'ally' && b.isAlive).length;
    const enemyAlive = this.bots.filter(b => b.team === 'enemy' && b.isAlive).length;
    if (this.gameMode === 'squad' && (allyAlive === 0 || enemyAlive === 0)) {
      this._endRound(enemyAlive === 0 ? 'ally' : 'enemy');
      return;
    }
  }

  // Fin de ronda: banner + oro → siguiente ronda o fin del duelo
  _endRound(winner) { // 'ally' | 'enemy' | 'draw'
    if (this.phase === 'roundEnd') return;
    this.phase = 'roundEnd';
    this.hud.closeShop();
    this.shopOpenFlag = false;
    if (winner === 'ally') {
      this.roundWins.ally++;
      this.coins += 400;
      this.hud.showRoundBanner('¡RONDA GANADA!', `${this.roundWins.ally} — ${this.roundWins.enemy} · +400 ORO`, '#7dff9a');
    } else if (winner === 'enemy') {
      this.roundWins.enemy++;
      this.coins += 200;
      this.hud.showRoundBanner('RONDA PERDIDA', `${this.roundWins.ally} — ${this.roundWins.enemy} · +200 ORO`, '#ff6b7a');
    } else {
      this.coins += 100;
      this.hud.showRoundBanner('EMPATE', `${this.roundWins.ally} — ${this.roundWins.enemy} · +100 ORO`, '#facc15');
    }
    this.hud.updateTeamScore(this.roundWins.ally, this.roundWins.enemy, this.round, this.ROUND_TARGET);
    this.audio.play(winner === 'ally' ? 'win_round' : winner === 'enemy' ? 'lose_round' : 'ui');
    this._roundEndTime = this.matchTime;
  }

  _afterRoundEnd() {
    if (this.roundWins.ally >= this.ROUND_TARGET || this.roundWins.enemy >= this.ROUND_TARGET) {
      this.matchState = 'FINISHED';
      this.showResult(this.roundWins.ally > this.roundWins.enemy);
      return;
    }
    this.startRound(this.round + 1);
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
    return -rel * 180 / Math.PI; // HUD.showDamageDirection espera GRADOS (no radianes)
  }

  // DamageSystem central
  // ── ARSENAL (tienda in-match, Duelo de Escuadras) ──
  // ── ARSENAL (tienda del Clash Squad: fase de compra ANTES de cada ronda) ──
  openShop() {
    if (this.shopOpenFlag) { this.hud.closeShop(); this.shopOpenFlag = false; return; }
    // Clash Squad: la compra es ANTES de la ronda (regla Free Fire); en FFA
    // el arsenal abre cuando sea (todo es gratis allí).
    if (this.gameMode === 'squad' && this.phase !== 'buy') return;
    const weapons = this.weaponSystem.weapons.map(k => ({
      key: k,
      name: this.weaponData[k].name,
      price: this.weaponData[k].price || 0,
      owned: this.weaponSystem.owned.has(k),
    }));
    this.hud.showShop({
      weapons,
      onBuyWeapon: (i) => this.buyWeapon(i),
      getCoins: () => this.coins,
    });
    this.shopOpenFlag = true;
  }

  buyWeapon(i) {
    const key = this.weaponSystem.weapons[i];
    const price = this.weaponData[key].price || 0;
    if (this.weaponSystem.owned.has(key)) {
      // ya es tuya: equiparla (cambio gratis dentro de la fase de compra)
      this.weaponSystem.switchWeapon(i + 1);
      this.hud.refreshShop(this.coins, this.weaponSystem.owned);
      return;
    }
    if (this.coins < price) { this.audio.play('empty'); return; }
    this.coins -= price;
    this.weaponSystem.owned.add(key);
    this.weaponSystem.switchWeapon(i + 1);
    this.audio.play('switch');
    this.hud.refreshShop(this.coins, this.weaponSystem.owned);
  }

  // Skin global del arsenal (se elige en el LOBBY, gratis, persistente).
  setGlobalSkin(skinKey) {
    if (!this.skinsFor || !this.skinsFor[skinKey]) return;
    if (this.globalSkin === skinKey) return;
    this.globalSkin = skinKey;
    try { localStorage.setItem('bf_skin_global', skinKey); } catch(e) {}
    for (const wKey of this.weaponSystem.weapons) this.weaponSystem.applySkin(wKey, skinKey);
    if (this.audio) this.audio.play('ui');
    this._renderLobbySkins();
    this._paintHeroGun();
  }

  // Chips de skins del lobby (se construyen al cargar WeaponSkins).
  _renderLobbySkins() {
    const wrap = document.getElementById('lobby-skins');
    if (!wrap || !this.skinsFor) return;
    wrap.innerHTML = '';
    for (const key of Object.keys(this.skinsFor)) {
      const b = document.createElement('button');
      b.className = 'lobby-skin' + (key === this.globalSkin ? ' on' : '');
      b.dataset.skin = key;
      b.innerHTML = `<span class="ls-swatch" data-skin="${key}"></span><b>${this.skinsFor[key].name}</b>`;
      b.addEventListener('click', () => this.setGlobalSkin(key));
      wrap.appendChild(b);
    }
  }

  applyDamage(target, amount, hitType, attacker) {
    // Once a match is decided, late damage (stray bullets in the same frame)
    // must not change scores or retrigger the result screen.
    if(!target.isAlive || this.matchState === 'FINISHED') return false;
    // Inmunidad de spawn (Free Fire): escudo POR ENTIDAD al empezar el combate.
    // onPlayerFired solo caduca el del jugador: disparar ya no desprotege a
    // los bots (el gate global hacía exactamente eso).
    if (target === this.player) {
      if (this.matchTime < this.immuneUntil) return false;
    } else if (target.isBot && target.immuneUntil && this.matchTime < target.immuneUntil) {
      return false;
    }
    
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
      // Oro por eliminación (solo escuadras: la economía del Clash Squad)
      const killerTeam = attacker ? (attacker.team || (attacker.isBot ? 'enemy' : 'ally')) : (target.isBot ? 'ally' : 'enemy');
      if (this.gameMode === 'squad' && killerTeam === 'ally') {
        this.coins += 80;
        this.hud.refreshShop(this.coins, this.weaponSystem.owned);
      }
      this.teamScore[killerTeam] = (this.teamScore[killerTeam] || 0) + 1;
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
        // El bot que mató al jugador acredita su kill: sin esto la carrera
        // FFA a 20 era invisible para el rival (LÍDER espejo).
        if (attacker && attacker.isBot) attacker.kills++;
        // Player death breaks any active streak
        this._streakCount = 0;
        // The death drone belongs to the player's own death. Bot deaths already
        // carry their feedback (VFX + kill jingle); playing it for every bot
        // kill — including bot-vs-bot across the map — was constant bass mud.
        if(this.audio) this.audio.play('death');
        // Death transition: red fade + MUERTE banner. En escuadras nadie
        // reaparece en la ronda (el "REAPARECIENDO..." estático mentía):
        // el texto dice lo que toca según el modo.
        const dOv = document.getElementById('death-overlay');
        if (dOv) {
          const lbl = dOv.querySelector('label');
          if (lbl) lbl.textContent = this.gameMode === 'squad' ? 'ESPERA EL FIN DE LA RONDA' : 'REAPARECIENDO...';
          dOv.classList.add('show');
        }
      } else if(target.isBot && attacker && attacker.isBot){
        attacker.kills++;
        // Bots killing each other (or the player) belong in the feed: in an
        // FFA the leaderboard race must stay legible, not only your own kills.
        this.hud.showKill(attacker.name || 'BOT', target.isBot ? (target.name || 'BOT') : 'YOU', hitType==='head');
      }
      // FFA: 20 kills gana la partida (legacy)
      if (this.gameMode === 'ffa' && (this.playerKills >= this.killTarget || this._maxBotKills() >= this.killTarget)) {
        this.matchState = 'FINISHED';
        this.showResult(this.playerKills >= this._maxBotKills());
        return died;
      }
      // CLASH SQUAD: un equipo COMPLETO eliminado termina la RONDA (no hay respawn)
      if (this.gameMode === 'squad' && this.phase === 'combat') {
        const allyCount = (this.player.isAlive ? 1 : 0) + this.bots.filter(b => b.team === 'ally' && b.isAlive).length;
        const enemyCount = this.bots.filter(b => b.team === 'enemy' && b.isAlive).length;
        if (enemyCount === 0 || allyCount === 0) {
          this._endRound(enemyCount === 0 ? 'ally' : (allyCount === 0 ? 'enemy' : 'draw'));
        }
      }

      // Respawn after 1.8s — tracked so startMatch can cancel them. A shotgun
      // blast can kill TWO entities in the same frame: each death schedules
      // its own timer, so this must be a list (a single handle let stale
      // timers from the previous match teleport entities mid-next-match).
      // CLASH SQUAD: NADIE reaparece dentro de la ronda (regla Free Fire);
      // el fin de ronda ya resetea a todos. Solo FFA tiene respawn.
      if (this.gameMode === 'squad') {
        if (!target.isBot) {
          // El jugador muerto ve el overlay y espera el fin de ronda
          // (la cámara queda en el lugar de la muerte; banner de ronda llega)
        }
      } else { const respawnTimer = setTimeout(()=>{
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
      }

      // (el fin de ronda por eliminación se evaluó arriba)
    }

    return died;
  }

  _maxBotKills() {
    return Math.max(...this.bots.map(b=>b.kills), 0);
  }

  // En escuadras solo se dispara en combate: la compra es para comprar y el
  // roundEnd ya decidió. Sin este gate, la fase de compra acumulaba muertes
  // que corrompían la paridad de la ronda (hasta rondas vacías de 75s).
  _canFight() {
    return this.gameMode !== 'squad' || this.phase === 'combat';
  }

  // Regla Free Fire: disparar rompe la protección de spawn
  onPlayerFired() {
    if (this.matchTime < this.immuneUntil) {
      this.immuneUntil = this.matchTime;
      const el = document.getElementById('squad-immunity');
      if (el) el.classList.remove('show');
    }
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
        let dxn = dx, dzn = dz;
        let dSq = dxn * dxn + dzn * dzn;
        if (dSq >= minDist * minDist) continue;
        if (dSq === 0) {
          // Superposición exacta (visto en gameplay: enemigos pegados a
          // quemarropa que nunca se resolvían): dirección determinista en vez
          // de rendirse para siempre. d=0 → empuje de medio minDist por lado.
          const ang = ((i * 7 + j * 13) % 8) * Math.PI / 4;
          dxn = Math.cos(ang); dzn = Math.sin(ang);
          dSq = 0;
        }
        const d = Math.sqrt(dSq);
        const overlap = (minDist - d) / 2;
        const nx = dxn / (d || 1), nz = dzn / (d || 1);
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

    // Clonado: el fade de _updateVFX muta opacity por partícula; con el
    // material compartido el primer tiro apagaba los siguientes.
    const core = new THREE.Mesh(this._geoMuzzleCore, this._matMuzzleCore.clone());
    core.position.copy(flash.position);
    this.scene.add(core);
    this._activeFlashes.push({ mesh: core, life: 0.04, maxLife: 0.04 });
  }

  impact(point, isHeadshot) {
    // Impact cube + expanding ring decal (always faces camera).
    // kind by surface: wall = pale concrete chip, body = warm red, head = hot red.
    const mat = (isHeadshot ? this._matImpactHead : this._matImpact).clone();
    const cube = new THREE.Mesh(this._geoImpact, mat);
    cube.position.copy(point);
    if (isHeadshot === null) { isHeadshot = false; mat.color.setHex(0xb8c4d4); } // wall chip
    this.scene.add(cube);
    this._activeImpacts.push({ mesh: cube, life: 0.36, maxLife: 0.36 });

    const ring = new THREE.Mesh(this._geoRing, this._matRing.clone());
    ring.position.copy(point);
    ring.quaternion.copy(this.camera.quaternion);
    this.scene.add(ring);
    this._activeRings.push({ mesh: ring, life: 0.22, maxLife: 0.22 });
  }

  // Tracer: a bright thin streak from the muzzle to the hit point. One mesh
  // per shot (additive, 60ms) — makes every shot READ as a bullet, not a
  // generic flash. Bots' tracers too: incoming fire is now visible.
  tracer(from, to) {
    const dir = new THREE.Vector3().subVectors(to, from);
    const len = dir.length();
    // A quemarropa el streak degenera en un tablón gigante frente a la cámara
    // (visto en gameplay real: cinta blanca cruzando la pantalla).
    if (len < 1.0) return;
    const geo = this._geoTracer || (this._geoTracer = new THREE.BoxGeometry(0.012, 0.012, 1));
    const mat = (this._matTracer || (this._matTracer = new THREE.MeshBasicMaterial({ color: 0xffe9a0, transparent: true, opacity: 0.85 }))).clone();
    const m = new THREE.Mesh(geo, mat);
    m.position.copy(from).addScaledVector(dir, 0.5);
    m.lookAt(to);
    m.scale.z = len;
    this.scene.add(m);
    this._activeFlashes.push({ mesh: m, life: 0.06, maxLife: 0.06, flat: true });
  }

  blood(point) {
    // A quemarropa las esferas nacen pegadas al objetivo y tapan la pantalla
    // entera de rojo (gameplay real). El feedback ya lo dan hitmarker+sonido.
    if (this.camera && point.distanceTo(this.camera.position) < 0.9) return;
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

  // Cada disparo crea 2–8 materiales clonados: sin dispose se acumulan en la
  // GPU y la partida larga (o el móvil modesto) se degrada. Geometrías y
  // materiales base son compartidos y NO se tocan — solo los clones por tiro.
  _killVFX(mesh) {
    this.scene.remove(mesh);
    if (mesh.material && mesh.material !== this._matMuzzleCore) mesh.material.dispose();
  }
  _updateVFX(dt) {
    // Flashes
    for(let i=this._activeFlashes.length-1;i>=0;i--){
      const f = this._activeFlashes[i];
      f.life -= dt;
      if(f.life <= 0){ this._killVFX(f.mesh); this._activeFlashes.splice(i,1); }
      else if (f.mesh.material.transparent) {
        f.mesh.material.opacity = Math.max(0, f.life / f.maxLife) * 0.9;
      }
    }
    // Impacts
    for(let i=this._activeImpacts.length-1;i>=0;i--){
      const it = this._activeImpacts[i];
      it.life -= dt;
      if(it.life <= 0){ this._killVFX(it.mesh); this._activeImpacts.splice(i,1); }
      else { it.mesh.position.y += dt * 1.2; it.mesh.material.opacity = it.life / it.maxLife; it.mesh.rotation.x += dt*6; it.mesh.rotation.y += dt*4; }
    }
    // Rings
    for(let i=this._activeRings.length-1;i>=0;i--){
      const r = this._activeRings[i];
      r.life -= dt;
      if(r.life <= 0){ this._killVFX(r.mesh); this._activeRings.splice(i,1); }
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
      if(b.life <= 0){ this._killVFX(b.mesh); this._activeBloods.splice(i,1); }
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

    // In-match settings panel open → PAUSE the simulation (bots, timers, HUD)
    // but keep rendering the last frame. Closing the panel resumes play.
    if (this._configOpen && this.matchState === 'PLAYING'){
      this._updateVFX(Math.min(dt, 0.033));
      this.renderer.render(this.scene, this.camera);
      return;
    }

    if(this.matchState !== 'PLAYING'){
      // LOBBY 3D: cámara cinematográfica orbitando AL HÉROE animado.
      // El héroe se encuadra a la DERECHA (la UI del lobby ocupa el centro):
      // la cámara mira 1.5m a la izquierda del pedestal.
      const t = this.clock.elapsedTime;
      const r = 3.2, h = 1.7;
      this.camera.position.set(2.6 + Math.sin(t * 0.13) * r, h, Math.cos(t * 0.13) * r + 5.2);
      this.camera.lookAt(1.1, 1.2, 5.2);
      if (this._lobbyHero) {
        this._lobbyHero.update(Math.min(dt, 0.033));
        this._lobbyHero.root.rotation.y = Math.PI + Math.sin(t * 0.35) * 0.5;
      }
      if (this._lobbyRingMat) this._lobbyRingMat.opacity = 0.4 + Math.sin(t * 2.2) * 0.18;
      // Bots wander during lobby so the arena feels alive (no shooting: the
      // player ghost is hidden from targeting while in menu)
      const playerWasTargetable = this.player.isAlive;
      this.player.isAlive = false;
      for (const bot of this.bots) {
        if (!bot.isAlive) { if (bot._dyingT > 0) bot._updateDying(Math.min(dt, 0.033)); continue; }
        // En el lobby los bots pasean LEJOS del héroe: uno parado junto a la
        // cámara tapaba el encuadre con un pilar negro.
        const dx = bot.position.x - 2.6, dz = bot.position.z - 5.2;
        if (dx * dx + dz * dz < 4.5 * 4.5) {
          bot.state = 'wander';
          bot.stateTimer = 0;
          if (dx * dx + dz * dz > 0.001) bot.wanderDir.set(dx, 0, dz).normalize();
          else bot.wanderDir.set(Math.random() - 0.5, 0, Math.random() - 0.5).normalize();
        }
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

    // ── CLASH SQUAD: máquina de fases ──
    if (this.gameMode === 'squad') {
      this.phaseTime -= dt;
      if (this.phase === 'buy') {
        this.hud.tickBuyPhase(this.phaseTime, this.BUY_TIME);
        if (this.phaseTime <= 0) this._startCombat();
      } else if (this.phase === 'combat') {
        this.hud.tickBuyPhase(-1, this.BUY_TIME); // oculta el contador de compra
        if (this.phaseTime <= 0) {
          // Tiempo agotado → gana el equipo con MÁS VIVOS (empate = ronda nula)
          const allyCount = (this.player.isAlive ? 1 : 0) + this.bots.filter(b => b.team === 'ally' && b.isAlive).length;
          const enemyCount = this.bots.filter(b => b.team === 'enemy' && b.isAlive).length;
          this._endRound(allyCount > enemyCount ? 'ally' : enemyCount > allyCount ? 'enemy' : 'draw');
        }
      } else if (this.phase === 'roundEnd') {
        if (this.matchTime - this._roundEndTime > 3.0) this._afterRoundEnd();
      }
    }

    const timeLeft = this.gameMode === 'squad'
      ? Math.max(0, this.phaseTime)
      : Math.max(0, this.matchDuration - this.matchTime);
    if (this.gameMode !== 'squad' && timeLeft <= 0){
      this.matchState = 'FINISHED';
      const won = this.playerKills >= Math.max(...this.bots.map(b=>b.kills), 0);
      this.showResult(won);
      return;
    }

    // Input
    this.input.update();
    const { reload, switchW } = this.input.consumeOneFrameActions();
    if(reload) this.weaponSystem.reload();
    if(switchW) this.weaponSystem.switchWeapon(switchW);

    // FREEZE de compra (regla Free Fire: nadie se mueve hasta que empieza la
    // ronda, cada uno en su lugar). La cámara sigue mirando y la tienda sigue
    // clicable — solo el desplazamiento queda anulado este frame.
    const frozen = this.gameMode === 'squad' && this.phase === 'buy';
    let savedMove = null;
    if (frozen && this.input) {
      savedMove = { m: this.input.move, j: this.input.jump, s: this.input.sprint, c: this.input.crouch };
      this.input.move = { x: 0, y: 0 };
      this.input.jump = false; this.input.sprint = false; this.input.crouch = false;
    }
    // Player
    this.playerController.update(dt);
    // Muerto en escuadras: espectar al primer aliado vivo (estilo Free Fire)
    // en vez de mirar al punto de muerte hasta el fin de ronda.
    if (!this.player.isAlive && this.gameMode === 'squad' && this.phase === 'combat') {
      const mate = this.bots.find(b => b.team === 'ally' && b.isAlive);
      if (mate) {
        this.camera.position.copy(mate.position);
        this.camera.position.y += 0.15;
        this.camera.rotation.order = 'YXZ';
        this.camera.rotation.y = mate.yaw;
        this.camera.rotation.x = 0;
        this.camera.rotation.z = 0;
      }
    }
    if (savedMove && this.input) {
      this.input.move = savedMove.m; this.input.jump = savedMove.j;
      this.input.sprint = savedMove.s; this.input.crouch = savedMove.c;
    }

    // ADS is a camera zoom + weapon centering: one aim input, one feel.
    // Speed FOV: moving fast widens the view slightly (+7° at full run) —
    // a classic arcade speed cue that costs nothing and never triggers while
    // aiming (ADS fov wins).
    this.weaponSystem.setAim(this.input.aim, dt);
    const horizSpeed = Math.hypot(this.playerController.velocity.x, this.playerController.velocity.z);
    const speedFov = Math.min(1, horizSpeed / this.playerController.moveSpeed) * 7;
    const targetFov = this.input.aim ? 62 : 78 + speedFov;
    if (Math.abs(this.camera.fov - targetFov) > 0.05) {
      this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, targetFov, Math.min(1, dt * 14));
      this.camera.updateProjectionMatrix();
    }

    // Weapon
    // Feed the weapon the player's horizontal speed for walk bob/sway
    this.weaponSystem.setMoveSpeed(Math.hypot(this.playerController.velocity.x, this.playerController.velocity.z));
    this.weaponSystem.update(dt, this.player.isAlive);

    // Shooting (player) — en escuadras solo en combate (ver _canFight)
    if(this.input.fire && this.player.isAlive && this._canFight()){
      const allTargets = [...this.bots, this.player];
      this.weaponSystem.fire(this.player, allTargets, this.map);
    }

    // Bots: dying bots animate their tumble (they no longer run AI); alive
    // bots run full behavior. Same loop, same contract as before.
    // En freeze de compra la IA no corre: firmes en su lugar (idle asentado).
    for(const bot of this.bots){
      if (!bot.isAlive) {
        if (bot._dyingT > 0) bot._updateDying(dt);
        continue;
      }
      if (frozen) {
        bot.velocity.set(0, 0, 0);
        if (bot._avatar) { bot._avatar.setLocomotion('idle'); bot._avatar.update(dt); }
        continue;
      }
      const action = bot.update(dt, this.player, this.bots, this.map);
      if(action && action.shoot && bot.isAlive && this._canFight()){
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

    // Check win FFA (guarded: applyDamage ya finaliza + muestra resultado)
    if (this.gameMode === 'ffa' && this.matchState === 'PLAYING' && (this.playerKills >= this.killTarget || this._maxBotKills() >= this.killTarget)){
      this.matchState = 'FINISHED';
      this.showResult(this.playerKills >= this._maxBotKills());
      return;
    }

    this.hud.tickSquad(dt, this.immuneUntil, this.matchTime);
    if (Input.wasKeyPressedThisFrame === undefined) { /* guard */ }

    // ARSENAL: tecla B (PC). En móvil hay botón dedicado.

    // HUD
    const aliveBots = this.bots.filter(b=>b.isAlive).length;
    const botLeader = this.bots.reduce((a,b)=>Math.max(a,b.kills),0);
    this.hud.update({
      score: this.gameMode === 'squad' ? `${this.roundWins.ally} — ${this.roundWins.enemy}` : `${this.teamScore.ally} — ${this.teamScore.enemy}`,
      leader: this.gameMode === 'squad' ? this.round : Math.max(this.playerKills, this._maxBotKills()),
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
