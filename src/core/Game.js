import * as THREE from '../lib/three.module.js';
import { Input } from './Input.js';
import { PlayerController } from '../player/PlayerController.js';
import { WeaponSystem } from '../combat/WeaponSystem.js';
import { Bot } from '../bots/Bot.js';
import { Map } from '../world/Map.js';
import { HUD } from '../ui/HUD.js';
import { AudioManager } from '../audio/AudioManager.js';

export class Game {
  constructor() {
    this.container = document.getElementById('game-container');
    
    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87b5e8);
    this.scene.fog = new THREE.Fog(0x87b5e8, 34, 90);

    // Renderer — eficiencia: sin antialias en móvil, pixelRatio ≤1.5, sombras 1024
    const isMobile = window.innerWidth < 900 || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    this.renderer = new THREE.WebGLRenderer({ antialias: !isMobile, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.2 : 1.5));
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
    this.killFeed = [];

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
    // Debug toggle
    window.addEventListener('keydown', e=>{
      if(e.code==='F3' || (e.shiftKey && e.code==='KeyD')){
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

    const startGame = ()=>{
      this.audio.init();
      this.audio.play('ui');
      this.startMatch();
      overlay.classList.add('hidden');
      titleBlock.classList.add('hidden');
      resultBlock.classList.add('hidden');
      // Lock pointer for PC
      if(window.innerWidth > 900){
        this.renderer.domElement.requestPointerLock();
      }
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
      resultBlock.classList.remove('hidden');
      titleBlock.classList.add('hidden');
      overlay.classList.remove('hidden');
      document.exitPointerLock();
    };
  }

  startMatch() {
    this.matchState = 'PLAYING';
    this.matchTime = 0;
    this.playerKills = 0;
    this.playerDeaths = 0;
    // Reset player and bots
    const playerSpawn = this.map.getRandomSpawn();
    this.playerController.respawn(playerSpawn);
    this.playerController.health = 100;
    this.hud.update({ health: 100, ammo: this.weaponSystem.getAmmoText(), kills: 0, deaths: 0, score: '0 - 0', timeLeft: this.matchDuration, fps: 60, pos: this.player.position, botCount: this.bots.length });
    
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

  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  // DamageSystem central
  applyDamage(target, amount, hitType, attacker) {
    if(!target.isAlive) return false;
    
    let died = false;
    if(target.isBot){
      died = target.takeDamage(amount, hitType, attacker);
    } else {
      // Player
      died = this.playerController.takeDamage(amount);
      // Hit flash
      if(!died){
        this.hitFlash = 0.28;
        if(this.audio) this.audio.play('hurt');
        document.body.style.background = 'radial-gradient(ellipse at center, rgba(255,60,60,0.18) 0%, transparent 70%)';
        setTimeout(()=> document.body.style.background='', 90);
      }
    }

    if(died){
      // Death handling
      if(this.audio) this.audio.play('death');
      // Score
      if(attacker && !attacker.isBot){
        this.playerKills++;
        this.hud.showKill(attacker.name || 'YOU', target.name || 'BOT', hitType==='head');
        this.hud.showKillBanner(hitType==='head');
        if(this.audio) this.audio.play('kill');
        // Kill punch: micro hitstop + subtle shake — feels earned, gone fast
        this._hitstop = 0.055;
        this._shake = Math.min(1, (this._shake||0) + 0.5);
      } else if(!target.isBot){
        this.playerDeaths++;
      } else if(target.isBot && attacker && attacker.isBot){
        attacker.kills++;
      }

      // Respawn after 1.8s
      setTimeout(()=>{
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
          if(this.audio) this.audio.play('respawn');
        }
      }, 1800);

      // Check win condition
      if(this.playerKills >= this.killTarget){
        this.matchState = 'FINISHED';
        this.showResult(true);
      } else {
        // Check if any bot reached target (for fun, but FFA is player vs all, so only player win matters for prototype)
        // Could also check if any bot has 20 kills, then player loses if time runs out and bot has more
      }
    }

    return died;
  }

  // VFX helpers — pooling + loop central (sin rAF por partícula)
  muzzleFlash(pos, dir) {
    // Two-layer flash: glowing shell + hot core, at the muzzle tip
    const flash = new THREE.Mesh(this._geoMuzzle, this._matMuzzle.clone());
    flash.position.copy(pos).addScaledVector(dir, 0.10);
    flash.scale.set(1.6, 1.6, 2.4);
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
      for (const bot of this.bots) bot.update(Math.min(dt, 0.033), this.player, this.bots, this.map);
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
    }

    // Input
    this.input.update();
    const { reload, switchW } = this.input.consumeOneFrameActions();
    if(reload) this.weaponSystem.reload();
    if(switchW) this.weaponSystem.switchWeapon(switchW);

    // Player
    this.playerController.update(dt);

    // ADS is a camera zoom + weapon centering: one aim input, one feel.
    this.weaponSystem.setAim(this.input.aim, dt);
    const targetFov = this.input.aim ? 62 : 78;
    if (Math.abs(this.camera.fov - targetFov) > 0.05) {
      this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, targetFov, Math.min(1, dt * 14));
      this.camera.updateProjectionMatrix();
    }

    // Weapon
    // Feed weapon the current horizontal speed for bob/sway, then update it
    this.weaponSystem.setMoveSpeed(Math.hypot(this.playerController.velocity.x, this.playerController.velocity.z));
    this.weaponSystem.update(dt, this.player.isAlive);

    // Shooting (player)
    if(this.input.fire && this.player.isAlive){
      const allTargets = [...this.bots, this.player];
      this.weaponSystem.fire(this.player, allTargets, this.map);
    }

    // Bots
    for(const bot of this.bots){
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
        const result = this.weaponSystem.fire(bot, allTargets, this.map);

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

    // Check win
    if(this.playerKills >= this.killTarget){
      this.matchState = 'FINISHED';
      this.showResult(true);
    }

    // HUD
    const aliveBots = this.bots.filter(b=>b.isAlive).length;
    this.hud.update({
      score: `${this.playerKills} - ${this.bots.reduce((a,b)=>Math.max(a,b.kills),0)}`,
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
      this.camera.position.x += (Math.random()-0.5) * s * 0.09;
      this.camera.position.y += (Math.random()-0.5) * s * 0.09;
      this.camera.rotation.z += (Math.random()-0.5) * s * 0.012;
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
