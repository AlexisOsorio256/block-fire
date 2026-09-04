import * as THREE from '../lib/three.module.js';

export const WeaponData = {
  rifle: {
    name: 'Rifle',
    price: 1500,
    damage: 24,
    headshotMul: 2.0,
    fireRate: 0.11, // seconds between shots
    magazineSize: 30,
    reloadTime: 1.6,
    spread: 0.012,
    recoil: 0.6,
    range: 90,
    pellets: 1,
    automatic: true,
    bulletSpeed: 0, // hitscan
    falloffStart: 40, // full damage to 40u, then decays to 75% at 90u
    falloffMin: 0.75,
  },
  pistol: {
    name: 'Pistol',
    price: 0, // arma inicial: gratis, siempre en el inventario
    damage: 18, // 18x7=126 > 125HP: 7 al cuerpo, 4 a la cabeza (2x) — secundaria digna
    headshotMul: 2.0,
    fireRate: 0.32,
    magazineSize: 12,
    reloadTime: 1.1,
    spread: 0.006,
    recoil: 0.35,
    range: 70,
    pellets: 1,
    automatic: false,
    bulletSpeed: 0,
    falloffStart: 30, // full damage to 30u, then decays to 80% at 70u
    falloffMin: 0.8,
  },
  shotgun: {
    name: 'Shotgun',
    price: 1200,
    damage: 21, // 21x6=126 > 125HP: a bocajarro (todas las postas) es kill de 1 disparo
    headshotMul: 1.5,
    fireRate: 0.72,
    magazineSize: 6,
    reloadTime: 1.9,
    spread: 0.082,
    recoil: 1.1,
    range: 22,
    pellets: 6,
    automatic: false,
    bulletSpeed: 0,
    falloffStart: 6, // full damage to 6u, then falls hard to 35% at 22u
    falloffMin: 0.35,
  },
  smg: {
    name: 'SMG',
    damage: 16,
    headshotMul: 2.0,
    fireRate: 0.075,
    magazineSize: 36,
    reloadTime: 1.8,
    spread: 0.018,
    recoil: 0.4,
    range: 60,
    pellets: 1,
    automatic: true,
    bulletSpeed: 0,
    falloffStart: 25,
    falloffMin: 0.7,
    price: 1800,
  }
};

// Skins de armas (cosmético, compra con oro en la fase de compra).
// accent/dark: colores que sustituyen los materiales de identidad del arma.
export const WeaponSkins = {
  none:    { name: 'Estándar', price: 0,    accent: null,      dark: null },
  oro:     { name: 'Oro',      price: 2500, accent: 0xffc93f,  dark: 0x8a6a1f },
  bosque:  { name: 'Bosque',   price: 1500, accent: 0x5d9c48,  dark: 0x2f4a2c },
  hielo:   { name: 'Hielo',    price: 2000, accent: 0x7fd8ff,  dark: 0x2f5a78 },
  carbon:  { name: 'Carbón',   price: 1800, accent: 0x39d7ff,  dark: 0x10131c },
};

export class WeaponSystem {
  constructor(scene, camera, audio, vfx, applyDamage) {
    this.scene = scene;
    this.camera = camera;
    this.audio = audio;
    this.vfx = vfx;
    this.applyDamage = applyDamage;
    this.weaponData = WeaponData; // el arsenal vive aquí (la tienda lo consulta)

    this.weapons = ['rifle', 'pistol', 'shotgun', 'smg'];
    this.currentIndex = 1; // Pistola: arma inicial del Duelo de Escuadras
    this.owned = new Set(['pistol']); // el resto se desbloquea en la TIENDA
    this.currentWeapon = WeaponData[this.weapons[this.currentIndex]];
    
    this.ammoInMag = this.currentWeapon.magazineSize;
    this.reserveAmmo = this.currentWeapon.magazineSize * 3;
    this.isReloading = false;
    this.reloadTimer = 0;
    this.fireCooldown = 0;
    this.recoilOffset = 0;

    this.raycaster = new THREE.Raycaster();
    this.crosshair = document.getElementById('crosshair');
    this.hitmarker = document.getElementById('hitmarker');

    // Weapon meshes (simple blocky) — THREE distinct models so the player
    // always recognizes what is in their hands (silhouette, not just stats).
    this._weaponModels = this._createWeaponMeshes();
    for (const key of Object.keys(this._weaponModels)) {
      this.scene.add(this._weaponModels[key]);
      this._weaponModels[key].visible = key === this.weapons[this.currentIndex];
    }
    this.weaponMesh = this._weaponModels.rifle; // alias for the current model
  }

  _createWeaponMeshes() {
    // Materiales POR ARMA (no compartidos): applySkin tiñe dark/accent solo del
    // modelo comprado. Compartir una instancia hacía que la skin del rifle
    // cambiara también pistola/escopeta/SMG.
    const Mats = () => ({
      body:  new THREE.MeshStandardMaterial({ color: 0x3d4557, roughness: 0.55, metalness: 0.45 }),
      black: new THREE.MeshStandardMaterial({ color: 0x191d2c, roughness: 0.45, metalness: 0.55 }),
      grip:  new THREE.MeshStandardMaterial({ color: 0x2b3038, roughness: 0.8, metalness: 0.1 }),
      wood:  new THREE.MeshStandardMaterial({ color: 0x6e4a2f, roughness: 0.75, metalness: 0.05 }),
    });
    // Per-weapon accent materials (swapped by _updateWeaponMesh on switch)
    const accents = { rifle: 0xffb400, pistol: 0x4ade80, shotgun: 0xff5a3c };
    const accentM = {};
    for (const k of Object.keys(accents)) {
      accentM[k] = new THREE.MeshStandardMaterial({ color: accents[k], roughness: 0.35, metalness: 0.3, emissive: 0x402800, emissiveIntensity: 0.35 });
    }

    const add = (group, geo, mat, x, y, z, rotX = 0) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      if (rotX) m.rotation.x = rotX;
      group.add(m);
      return m;
    };

    // ---- RIFLE: full-length, rail + vents + angled mag (the "standard") ----
    const rifle = new THREE.Group();
    const rM = Mats();
    const bodyM = rM.body, blackM = rM.black, gripM = rM.grip;
    add(rifle, new THREE.BoxGeometry(0.09, 0.11, 0.34), bodyM, 0, 0, 0);
    add(rifle, new THREE.BoxGeometry(0.055, 0.03, 0.30), blackM, 0, 0.075, -0.02);
    add(rifle, new THREE.BoxGeometry(0.058, 0.012, 0.28), accentM.rifle, 0, 0.062, -0.02); // identity line
    add(rifle, new THREE.BoxGeometry(0.045, 0.045, 0.30), blackM, 0, 0.01, -0.30);
    add(rifle, new THREE.BoxGeometry(0.07, 0.07, 0.16), bodyM, 0, 0.005, -0.24);
    add(rifle, new THREE.BoxGeometry(0.074, 0.02, 0.04), accentM.rifle, 0, 0.045, -0.20);
    add(rifle, new THREE.BoxGeometry(0.074, 0.02, 0.04), accentM.rifle, 0, 0.045, -0.27);
    add(rifle, new THREE.BoxGeometry(0.075, 0.075, 0.06), blackM, 0, 0.01, -0.46);
    add(rifle, new THREE.BoxGeometry(0.082, 0.082, 0.012), accentM.rifle, 0, 0.01, -0.435);
    add(rifle, new THREE.BoxGeometry(0.06, 0.16, 0.09), blackM, 0, -0.125, 0.04, 0.12); // angled mag
    add(rifle, new THREE.BoxGeometry(0.064, 0.02, 0.094), accentM.rifle, 0, -0.20, 0.052, 0.12);
    add(rifle, new THREE.BoxGeometry(0.06, 0.13, 0.07), gripM, 0, -0.11, 0.16, -0.25);
    add(rifle, new THREE.BoxGeometry(0.03, 0.02, 0.09), blackM, 0, -0.055, 0.10);
    add(rifle, new THREE.BoxGeometry(0.07, 0.10, 0.16), bodyM, 0, -0.01, 0.24);
    add(rifle, new THREE.BoxGeometry(0.072, 0.04, 0.05), gripM, 0, -0.045, 0.30);
    add(rifle, new THREE.BoxGeometry(0.025, 0.05, 0.04), accentM.rifle, 0, 0.115, -0.16); // front sight
    add(rifle, new THREE.BoxGeometry(0.03, 0.03, 0.03), blackM, 0, 0.105, 0.10);
    rifle.userData.parts = { dark: bodyM, black: blackM, accent: accentM.rifle };

    // ---- PISTOL: compact slide + stubby barrel + big grip (the "sidearm") ----
    const pistol = new THREE.Group();
    const pM = Mats();
    const bodyM2 = pM.body, blackM2 = pM.black, gripM2 = pM.grip;
    const addP = (geo, mat, x, y, z, rotX = 0) => add(pistol, geo, mat, x, y, z, rotX);
    addP(new THREE.BoxGeometry(0.075, 0.09, 0.22), blackM2, 0, 0, -0.02);        // slide
    addP(new THREE.BoxGeometry(0.078, 0.02, 0.20), accentM.pistol, 0, 0.055, -0.02); // slide top stripe
    addP(new THREE.BoxGeometry(0.05, 0.05, 0.05), blackM2, 0, 0.005, -0.16);     // short barrel tip
    addP(new THREE.BoxGeometry(0.06, 0.05, 0.18), bodyM2, 0, -0.06, 0.02);       // frame
    addP(new THREE.BoxGeometry(0.06, 0.15, 0.07), gripM2, 0, -0.13, 0.10, -0.32); // grip
    addP(new THREE.BoxGeometry(0.064, 0.02, 0.074), accentM.pistol, 0, -0.135, 0.115, -0.32); // mag base
    addP(new THREE.BoxGeometry(0.026, 0.045, 0.03), accentM.pistol, 0, 0.07, -0.12); // front sight
    addP(new THREE.BoxGeometry(0.03, 0.03, 0.03), blackM2, 0, 0.06, 0.08);       // rear sight
    addP(new THREE.BoxGeometry(0.02, 0.03, 0.06), blackM2, 0, -0.035, -0.045);   // trigger guard
    pistol.userData.parts = { dark: bodyM2, black: blackM2, accent: accentM.pistol };

    // ---- SHOTGUN: long barrel + pump + wide stock (the "heavy") ----
    const shotgun = new THREE.Group();
    const sM = Mats();
    const addS = (geo, mat, x, y, z, rotX = 0) => add(shotgun, geo, mat, x, y, z, rotX);
    addS(new THREE.BoxGeometry(0.11, 0.12, 0.30), sM.body, 0, 0, 0.02);          // chunky receiver
    addS(new THREE.BoxGeometry(0.115, 0.02, 0.26), accentM.shotgun, 0, 0.072, 0.02); // receiver top band
    addS(new THREE.BoxGeometry(0.055, 0.055, 0.46), sM.black, 0, 0.015, -0.34);  // LONG barrel
    addS(new THREE.BoxGeometry(0.085, 0.085, 0.035), sM.black, 0, 0.015, -0.56); // thick muzzle
    addS(new THREE.BoxGeometry(0.09, 0.022, 0.05), accentM.shotgun, 0, 0.015, -0.52); // muzzle ring
    addS(new THREE.BoxGeometry(0.062, 0.062, 0.14), sM.wood, 0, -0.055, -0.22);  // pump handle
    addS(new THREE.BoxGeometry(0.066, 0.02, 0.15), accentM.shotgun, 0, -0.055, -0.22); // pump rails
    addS(new THREE.BoxGeometry(0.07, 0.13, 0.07), sM.wood, 0, -0.10, 0.18, -0.28); // wood grip
    addS(new THREE.BoxGeometry(0.08, 0.11, 0.20), sM.wood, 0, -0.015, 0.30);     // wood stock
    addS(new THREE.BoxGeometry(0.03, 0.05, 0.04), accentM.shotgun, 0, 0.09, -0.16); // bead sight
    shotgun.userData.parts = { dark: sM.body, black: sM.black, accent: accentM.shotgun };

    // ---- SMG: compacta, cargador largo, culata plegable (la "rápida") ----
    accents.smg = 0x39d7ff;
    accentM.smg = new THREE.MeshStandardMaterial({ color: accents.smg, roughness: 0.35, metalness: 0.3, emissive: 0x0a2a33, emissiveIntensity: 0.35 });
    const smg = new THREE.Group();
    const gM = Mats();
    const addG = (geo, mat, x, y, z, rotX = 0) => add(smg, geo, mat, x, y, z, rotX);
    addG(new THREE.BoxGeometry(0.075, 0.10, 0.26), gM.body, 0, 0, -0.02);
    addG(new THREE.BoxGeometry(0.05, 0.028, 0.22), gM.black, 0, 0.068, -0.04);
    addG(new THREE.BoxGeometry(0.052, 0.012, 0.20), accentM.smg, 0, 0.05, -0.04);
    addG(new THREE.BoxGeometry(0.042, 0.042, 0.14), gM.black, 0, 0.005, -0.24);
    addG(new THREE.BoxGeometry(0.062, 0.062, 0.045), gM.black, 0, 0.005, -0.325);
    addG(new THREE.BoxGeometry(0.078, 0.02, 0.035), accentM.smg, 0, 0.05, -0.30); // muzzle ring
    addG(new THREE.BoxGeometry(0.055, 0.17, 0.075), gM.black, 0, -0.115, 0.02);     // long mag
    addG(new THREE.BoxGeometry(0.06, 0.02, 0.08), accentM.smg, 0, -0.205, 0.03);
    addG(new THREE.BoxGeometry(0.05, 0.12, 0.06), gM.grip, 0, -0.095, 0.12, -0.28);
    addG(new THREE.BoxGeometry(0.065, 0.075, 0.13), gM.body, 0, -0.005, 0.20);
    addG(new THREE.BoxGeometry(0.06, 0.05, 0.10), gM.black, 0, 0.02, 0.30);         // folded stock
    addG(new THREE.BoxGeometry(0.024, 0.04, 0.03), accentM.smg, 0, 0.095, -0.16);
    smg.userData.parts = { dark: gM.body, black: gM.black, accent: accentM.smg };

    return { rifle, pistol, shotgun, smg };
  }

  // ── SKINS: aplica los colores de la skin al modelo del arma ──
  // 'none'/Estándar restaura los colores originales (cacheados la 1ª vez).
  applySkin(weaponKey, skinKey) {
    const skin = WeaponSkins[skinKey] || WeaponSkins.none;
    const model = this._weaponModels[weaponKey];
    if (!model || !skin) return;
    const parts = model.userData.parts || {};
    if (!model.userData.origColors && parts.accent && parts.dark) {
      model.userData.origColors = { accent: parts.accent.color.getHex(), dark: parts.dark.color.getHex() };
    }
    const orig = model.userData.origColors || {};
    if (parts.accent) parts.accent.color.setHex((skin.accent ?? orig.accent) ?? 0xffffff);
    if (parts.dark) parts.dark.color.setHex((skin.dark ?? orig.dark) ?? 0xffffff);
  }

  // Per-weapon viewmodel presets (position offset + scale + muzzle tip z).
  // Built ONCE: update() ran this every frame (3 Vector3 + object per frame → GC churn).
  _viewPresets() {
    if (!this._presetsCache) this._presetsCache = {
      rifle:   { pos: new THREE.Vector3(0.26, -0.22, -0.45), scale: 1.0,  muzzle: -0.48 },
      pistol:  { pos: new THREE.Vector3(0.22, -0.20, -0.38), scale: 0.9,  muzzle: -0.30 },
      shotgun: { pos: new THREE.Vector3(0.28, -0.24, -0.42), scale: 1.15, muzzle: -0.60 },
      smg:     { pos: new THREE.Vector3(0.24, -0.21, -0.40), scale: 1.0,  muzzle: -0.34 },
    };
    return this._presetsCache;
  }

  update(dt, canShoot) {
    if (this.fireCooldown > 0) this.fireCooldown -= dt;
    if (this.isReloading) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) {
        const needed = this.currentWeapon.magazineSize - this.ammoInMag;
        const toLoad = Math.min(needed, this.reserveAmmo);
        this.ammoInMag += toLoad;
        this.reserveAmmo -= toLoad;
        this.isReloading = false;
        if (this.audio) this.audio.play('reloadEnd');
      }
    }
    // Recoil recovery (spring back)
    this.recoilOffset = THREE.MathUtils.lerp(this.recoilOffset, 0, Math.min(1, dt * 9));
    this.recoilKick = THREE.MathUtils.lerp(this.recoilKick || 0, 0, Math.min(1, dt * 10));

    // Hide viewmodel outside a live match (lobby orbit shows the arena)
    if (this.weaponMesh) this.weaponMesh.visible = canShoot !== false;
    if (canShoot === false) return;

    // Reload/switch animation: weapon dips down and comes back up.
    // reloadTimer counts DOWN to 0; dip peaks mid-reload. Same for switch
    // (0.28s pull-down + rise with the new model).
    let dipT = 0;
    if (this.isReloading) {
      const total = this.currentWeapon.reloadTime;
      const elapsed = total - this.reloadTimer;
      const k = Math.min(1, elapsed / total);        // 0..1 progress
      dipT = Math.sin(k * Math.PI);                  // smooth dip curve
    } else if (this._switchAnim > 0) {
      this._switchAnim = Math.max(0, this._switchAnim - dt);
      const k = 1 - (this._switchAnim / 0.28);       // 0..1 progress
      dipT = Math.sin((1 - k) * Math.PI) * (this._switchReady ? 1 : 1);
      if (this._switchAnim === 0) this._switchReady = false;
    }
    const dip = dipT * 0.16; // meters the gun drops during reload/switch

    // Weapon viewmodel follows camera with ADS blend + recoil kickback
    // + walk bob/sway so the gun feels physically held, not glued to screen
    if (this.weaponMesh) {
      const preset = this._viewPresets()[this.weapons[this.currentIndex]] || this._viewPresets().rifle;
      // ADS pulls the weapon to center
      const ads = this._adsBlend;

      // Walk bob driven by the player's horizontal speed (Game feeds it each
      // frame via setMoveSpeed). Bob is applied AFTER the smoothed base so the
      // lerp can never damp it away (validated with pixel ground-truth).
      this._bobPhase = (this._bobPhase || 0) + dt * (5 + (this.moveSpeedNow || 0) * 1.1);
      const speed01 = Math.min(1, (this.moveSpeedNow || 0) / 6);
      const bobAmt = (1 - ads * 0.85) * speed01;          // ADS nearly stills the gun
      const bobY = Math.sin(this._bobPhase * 2) * 0.024 * bobAmt;
      const bobX = Math.cos(this._bobPhase) * 0.030 * bobAmt;

      const targetX = THREE.MathUtils.lerp(preset.pos.x, 0.0, ads);
      const targetY = THREE.MathUtils.lerp(preset.pos.y, -0.145, ads) - dip;
      const targetZ = THREE.MathUtils.lerp(preset.pos.z, -0.30, ads) + (this.recoilKick || 0) * 0.09;

      // Smooth follow for the BASE position only
      this._vmPos = this._vmPos || preset.pos.clone();
      this._vmPos.x = THREE.MathUtils.lerp(this._vmPos.x, targetX, Math.min(1, dt * 14));
      this._vmPos.y = THREE.MathUtils.lerp(this._vmPos.y, targetY, Math.min(1, dt * 14));
      this._vmPos.z = THREE.MathUtils.lerp(this._vmPos.z, targetZ, Math.min(1, dt * 14));

      this.weaponMesh.position.copy(this.camera.position);
      this.weaponMesh.quaternion.copy(this.camera.quaternion);
      const offset = this._vmPos.clone();
      offset.x += bobX; offset.y += bobY;    // bob on top of smoothed base
      offset.applyQuaternion(this.camera.quaternion);
      this.weaponMesh.position.add(offset);

      // Recoil pitch on viewmodel + subtle roll with the bob
      this.weaponMesh.rotation.x = this.camera.rotation.x - (this.recoilOffset || 0) * 0.05 - (this.recoilKick || 0) * 0.10;
      this.weaponMesh.rotation.y = this.camera.rotation.y;
      this.weaponMesh.rotation.z = this.camera.rotation.z + bobX * 1.2;
      const s = preset.scale * (1 - ads * 0.12);
      this.weaponMesh.scale.setScalar(s);
    }
  }

  // Game feeds the player's horizontal speed each frame for bob/sway
  setMoveSpeed(speed) {
    this.moveSpeedNow = speed;
  }

  // ADS state blend (0..1), driven by Input.aim from Game
  setAim(aiming, dt) {
    const target = aiming ? 1 : 0;
    this._adsBlend = THREE.MathUtils.lerp(this._adsBlend || 0, target, Math.min(1, dt * 12));
  }

  canFire(usesPlayerAmmo = true) {
    // isReloading is exclusively the player's state (bots never reload). It
    // must NOT gate bots: probing showed every bot went silent for the whole
    // player reload (1.1–1.9s), gifting the player a free-push window.
    if (usesPlayerAmmo && this.isReloading) return false;
    if (usesPlayerAmmo && this.fireCooldown > 0) return false;
    if (usesPlayerAmmo && this.ammoInMag <= 0) {
      // Dry-fire click only when actively trying to shoot (not on spam frames)
      if (!this._emptyClickAt || performance.now() - this._emptyClickAt > 250) {
        this._emptyClickAt = performance.now();
        if (this.audio) this.audio.play('empty');
      }
      this.reload();
      return false;
    }
    return true;
  }

  fire(shooter, targets, map = null, listenerPos = null) {
    // Bots share the hitscan implementation, but never share the player's
    // magazine/cooldown. Their own cadence is controlled by Bot.shootCooldown.
    // Bots always engage with the rifle: letting them inherit the player's
    // loadout coupled bot damage/range to the player's lobby pick (picking the
    // shotgun silently nerfed every bot in the match).
    // listenerPos: where the shot is heard from. Game.js temporarily moves the
    // camera to the bot's eye before calling fire(), so bots must pass the
    // real listener (the player camera) or distance attenuation measures ~0.12
    // and every bot gunshot plays at full volume.
    const usesPlayerAmmo = !shooter.isBot;
    if (!this.canFire(usesPlayerAmmo)) return null;
    // Regla Free Fire: DISPARAR rompe la protección de spawn. Sin esto, el
    // jugador podría disparar inmune (la inmunidad nunca se quitaría en uso real).
    if (usesPlayerAmmo && this.vfx && this.vfx.onPlayerFired) this.vfx.onPlayerFired();

    // Tracer bookkeeping: one streak per shot from the muzzle to where the
    // round actually landed (hit or wall). Player sees their own bullet;
    // bot tracers make incoming fire visible and readable. For the player,
    // the origin gets refined to the viewmodel muzzle below.
    const tracerFrom = this.camera.position.clone();
    let tracerTo = null;

    // Los bots disparan SU arma comprada en la fase de compra; el jugador
    // dispara la que tiene equipada. Nadie comparte arma con nadie.
    const weapon = shooter.isBot ? (WeaponData[shooter.weaponKey] || WeaponData.rifle) : this.currentWeapon;
    if (usesPlayerAmmo) {
      this.ammoInMag--;
      this.fireCooldown = weapon.fireRate;
      this.recoilOffset += weapon.recoil;
      this.recoilKick = Math.min(1.4, (this.recoilKick || 0) + weapon.recoil * 0.5);
      // Camera recoil kick — handled by the controller that owns the camera.
      // Amplitude tuned so ONE shot is visible at a glance (per vision audit:
      // previous 0.011 was imperceptible).
      if (this.playerController && this.playerController.addRecoil) {
        const ads = this._adsBlend || 0;
        const scale = 1 - ads * 0.35;
        this.playerController.addRecoil(weapon.recoil * 0.028 * scale, (Math.random()-0.5) * weapon.recoil * 0.014);
      }
    }

    // Crosshair feedback (player only)
    if (usesPlayerAmmo && this.crosshair) {
      this.crosshair.classList.add('fire');
      setTimeout(()=> this.crosshair.classList.remove('fire'), 80);
    }

    // Gunfire audio. Bot shots: separate throttle class (so a bot firing
    // within 30ms of the player's shot can no longer mute the player's own
    // gunshot) and distance attenuation (far gunfire must not be as loud as
    // the weapon in your hands).
    if (this.audio) {
      if (usesPlayerAmmo) {
        this.audio.play('shoot', weapon.name);
      } else {
        const listener = listenerPos || this.camera.position;
        const dist = shooter.position ? listener.distanceTo(shooter.position) : 20;
        const vol = Math.max(0.12, Math.min(0.85, 1 - dist / 45));
        this.audio.play('shoot', weapon.name, { throttleClass: 'shootBot', volumeScale: vol });
      }
    }

    // Muzzle flash — from viewmodel muzzle in world space
    if (usesPlayerAmmo && this.vfx) {
      const preset = this._viewPresets()[this.weapons[this.currentIndex]] || this._viewPresets().rifle;
      const ads = this._adsBlend || 0;
      const mx = THREE.MathUtils.lerp(preset.pos.x, 0, ads);
      const my = THREE.MathUtils.lerp(preset.pos.y, -0.145, ads);
      const mz = THREE.MathUtils.lerp(preset.pos.z, -0.30, ads) + preset.muzzle; // per-weapon muzzle tip
      const muzzleLocal = new THREE.Vector3(mx, my + 0.01, mz);
      const muzzleWorld = muzzleLocal.applyQuaternion(this.camera.quaternion).add(this.camera.position);
      // Muzzle flash size carries weapon identity: shotgun cannon-blast,
      // rifle standard, pistol compact.
      const flashSize = weapon === WeaponData.shotgun ? 1.7 : weapon === WeaponData.pistol ? 0.75 : 1.0;
      this.vfx.muzzleFlash(muzzleWorld, this.camera.getWorldDirection(new THREE.Vector3()), flashSize);
      tracerFrom.copy(muzzleWorld); // the player's tracer leaves the viewmodel muzzle
    }

    // Raycast for each pellet
    let hits = [];
    // Spread in CAMERA space: world-space x/y offsets made the cone collapse
    // to a line when facing ±X (east/west), so shotgun spread depended on
    // where you were looking, not where you aimed.
    const camRight = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
    const camUp = new THREE.Vector3(0, 1, 0).applyQuaternion(this.camera.quaternion);
    // Crouch steadies the aim: up to −15% spread at full crouch (classic
    // crouch-accuracy contract, matches the slower crouch speed).
    const crouchBonus = this.playerController ? 1 - (this.playerController.crouchBlend || 0) * 0.15 : 1;
    for (let p = 0; p < weapon.pellets; p++) {
      // ADS tightens spread (stable aim) — PLAYER ONLY: _adsBlend is the
      // player's aim state; bots inheriting it made the whole bot squad
      // silently sharpen whenever the player aimed down sights.
      const spreadScale = usesPlayerAmmo
        ? (1 - (this._adsBlend || 0) * 0.65) * crouchBonus
        : 1;
      const spreadX = (Math.random()-0.5) * weapon.spread * spreadScale;
      const spreadY = (Math.random()-0.5) * weapon.spread * spreadScale;

      const direction = new THREE.Vector3();
      this.camera.getWorldDirection(direction);
      // Apply spread around the camera's own axes
      direction.addScaledVector(camRight, spreadX).addScaledVector(camUp, spreadY);
      direction.normalize();

      // AIM ASSIST (player only): if the raw shot would pass near a visible
      // enemy's chest, bend the ray onto the chest. Mobile (coarse pointer)
      // gets a wider assist cone; PC gets a subtle one. Bots never assist.
      // Occlusion is still checked afterwards — assist never shoots walls.
      if (usesPlayerAmmo) {
        // AGRESIVO (filosofía Free Fire): cono ancho + snap completo al pecho.
        // "Levantar la mira": si la puntería ya pasa por encima del pecho,
        // el snap va a la CABEZA (la maestría se premia). Solo enemigos
        // (escuadras: los aliados no reciben asistencia). Nunca atraviesa muros.
        const coarse = this._isTouch || (window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
        const assistAngle = coarse ? 0.16 : 0.028;
        let bestDot = Math.cos(assistAngle);
        let assistDir = null;
        for (const target of targets) {
          if (target === shooter || !target.isAlive) continue;
          // escuadras: no asistir sobre ALIADOS (target.team === 'ally' = tu escuadra)
          if (target.isBot && (target.team || 'enemy') === 'ally') continue;
          if (target.isBot && shooter.team && (target.team || 'enemy') === shooter.team) continue;
          const th = target.height || 1.65;
          const chest = target.position.clone(); chest.y -= th * 0.38;
          const head = target.position.clone(); head.y -= th * 0.82;
          const toChest = chest.clone().sub(this.camera.position);
          const dist = toChest.length();
          if (dist > weapon.range) continue;
          toChest.normalize();
          const dot = toChest.dot(direction);
          if (dot > bestDot) {
            bestDot = dot;
            // "Levantar la mira": si el rayo crudo pasa por encima del pecho,
            // el jugador apunta arriba → el snap sube a la CABEZA (red numbers)
            const toHead = head.clone().sub(this.camera.position).normalize();
            assistDir = (direction.dot(toHead) > direction.dot(toChest)) ? toHead : toChest;
          }
        }
        if (assistDir) {
          if (coarse) direction.copy(assistDir); // snap completo en móvil
          else direction.lerp(assistDir, 0.7).normalize(); // PC: sutil
        }
      }

      this.raycaster.set(this.camera.position, direction);
      // Check against targets (players/bots + map)
      // For map, we use a simple ray against map boxes (handled in Game)
      let closestHit = null;
      let closestDist = weapon.range;

      // A wall takes priority over a target behind it. This must happen before
      // damage is applied; filtering the result afterwards cannot undo a hit.
      const mapHit = map && map.raycast(this.camera.position, direction, closestDist);
      if (mapHit) closestDist = mapHit.distance;

      for (const target of targets) {
        if (target === shooter) continue;
        if (!target.isAlive) continue;
        // Sin fuego amigo: mismo equipo nunca impacta (escuadras). En FFA los
        // equipos son únicos, así que este filtro no cambia nada allí.
        if (shooter.team && target.team && shooter.team === target.team) continue;
        // Target.position is eye height: feet = y - height. Hitboxes must be
        // measured DOWN from eye, matching the visible mesh:
        // head cube center ≈ feet+1.55 → eye-0.10, body torso ≈ eye-0.62.
        const h = target.height || 1.65;
        const bodyPos = target.position.clone(); bodyPos.y -= h * 0.38;
        const headPos = target.position.clone(); headPos.y -= 0.10;
        const legPos = target.position.clone(); legPos.y -= h * 0.72;
        const toBody = new THREE.Vector3().subVectors(bodyPos, this.camera.position);
        const projDist = toBody.dot(direction);
        if (projDist < 0 || projDist > closestDist) continue;
        const closestPoint = this.camera.position.clone().addScaledVector(direction, projDist);
        const bodyHit = closestPoint.distanceTo(bodyPos) < 0.55;
        const headHit = closestPoint.distanceTo(headPos) < 0.28;
        // Piernas: la esfera del pecho no llega a las espinillas de pie
        // (cuenta como cuerpo, nunca como headshot).
        const legHit = closestPoint.distanceTo(legPos) < 0.42;

        if (bodyHit || headHit || legHit) {
          closestDist = projDist;
          closestHit = { target, distance: projDist, headshot: headHit, point: closestPoint.clone() };
        }
      }

      if (closestHit) {
        hits.push(closestHit);
      } else {
        if (this.vfx) {
          const missPoint = mapHit
            ? mapHit.point
            : this.camera.position.clone().addScaledVector(direction, 45);
          this.vfx.impact(missPoint, null);
          if (!tracerTo) tracerTo = missPoint;
        }
        // Wall ricochet sound only when the player's own shot hits geometry
        if (mapHit && usesPlayerAmmo && this.audio) {
          this.audio.play('impact_wall');
        }
      }
    }

    // Apply damage for hits (for shotgun, multiple pellets can hit same target, count once but sum damage)
    // Group hits by target
    const hitsByTarget = new Map();
    for (const hit of hits) {
      if (!hitsByTarget.has(hit.target)) hitsByTarget.set(hit.target, []);
      hitsByTarget.get(hit.target).push(hit);
    }

    let totalDamage = 0;
    let killed = false;
    for (const [target, targetHits] of hitsByTarget) {
      let damage = 0;
      let isHeadshot = false;
      for (const h of targetHits) {
        // Damage falloff by distance: full damage up to falloffStart, then
        // linear decay to falloffMin at weapon range. Gives each weapon a
        // combat-distance identity (shotgun = close monster, rifle = mid-long).
        let dmg = weapon.damage * (h.headshot ? weapon.headshotMul : 1);
        const start = weapon.falloffStart ?? weapon.range * 0.5;
        if (h.distance > start && weapon.range > start) {
          const k = (h.distance - start) / (weapon.range - start);
          dmg *= 1 - (1 - (weapon.falloffMin ?? 0.5)) * k;
        }
        damage += dmg;
        if (h.headshot) isHeadshot = true;
      }
      // Game owns scores, death feedback and respawns for both player and bots.
      if (this.applyDamage) {
        const died = this.applyDamage(target, damage, isHeadshot ? 'head' : 'body', shooter);
        if (died) killed = true;
        totalDamage += damage;
        // VFX
        if (this.vfx) {
          const hitPoint = targetHits[0].point;
          this.vfx.impact(hitPoint, isHeadshot);
          this.vfx.blood(hitPoint);
          if (!tracerTo) tracerTo = hitPoint;
        }
      }
    }

    // Tracer streak — from the muzzle to the landing point. The player's
    // tracer starts at the viewmodel muzzle (already computed for the flash);
    // bot tracers start just off their eye so incoming fire is visible.
    if (this.vfx && tracerTo) {
      this.vfx.tracer(tracerFrom, tracerTo);
    }

    // Hitmarker — hierarchy: body hit (small yellow) → headshot (bigger, red
    // tint + sharper sound) → kill (largest, red). The player learns the
    // difference without reading anything.
    // NOTE: on a KILL this does NOT play a kill sound — Game.applyDamage owns
    // kill audio. Playing it here too doubled every kill jingle (audio bug).
    if (usesPlayerAmmo && hits.length > 0) {
      const headshot = hits.some(h => h.headshot);
      this.showHitmarker(killed, headshot && !killed);
      if (!killed && this.audio) this.audio.play(headshot ? 'headshot' : 'hit');
      if (headshot && !killed && this.vfx && this.vfx.hud) this.vfx.hud.showHitBanner(true);
    }

    return { hits, totalDamage, killed };
  }

  showHitmarker(killed, headshot = false) {
    if (!this.hitmarker) return;
    this.hitmarker.classList.add('show');
    // Headshot-no-kill: white-hot core (bigger pop), kill: red (biggest)
    this.hitmarker.classList.toggle('hs', headshot && !killed);
    const ticks = this.hitmarker.querySelectorAll('i');
    const color = killed ? '#ff4444' : (headshot ? '#ffffff' : '#ffd23f');
    ticks.forEach(t => t.style.background = color);
    clearTimeout(this._hmTimer);
    this._hmTimer = setTimeout(()=> {
      this.hitmarker.classList.remove('show');
      this.hitmarker.classList.remove('hs');
    }, killed ? 240 : (headshot ? 170 : 120));
    if (this.crosshair) {
      this.crosshair.classList.add('hit');
      setTimeout(()=> this.crosshair.classList.remove('hit'), 120);
    }
  }

  reload() {
    if (this.isReloading) return;
    if (this.ammoInMag === this.currentWeapon.magazineSize) return;
    if (this.reserveAmmo <= 0) return;
    this.isReloading = true;
    this.reloadTimer = this.currentWeapon.reloadTime;
    if (this.audio) this.audio.play('reloadStart');
  }

  // dir: 1-3 selects a slot, -1 cycles to the previous weapon, 'next' cycles
  // forward (KeyE / mobile switch button — a fixed slot would trap mobile
  // players on the pistol).
  switchWeapon(dir) {
    if (this.isReloading) return;
    // Duelo de Escuadras: SOLO armas en propiedad (la TIENDA desbloquea el resto)
    const isOwned = (i) => this.owned.has(this.weapons[i]);
    let idx = this.currentIndex;
    if (dir === 'next') {
      let g = 0;
      do { idx = (idx + 1) % this.weapons.length; g++; } while (g <= this.weapons.length && !isOwned(idx));
      if (!isOwned(idx)) return; // el inventario entero sin posesión
    } else if (typeof dir === 'number' && dir >= 1 && dir <= this.weapons.length) {
      if (!isOwned(dir - 1)) return; // no comprada: la tienda manda
      idx = dir - 1;
    } else {
      idx = (idx + dir + this.weapons.length) % this.weapons.length;
      if (!isOwned(idx)) return;
    }
    if (idx === this.currentIndex) return;
    this.currentIndex = idx;
    this.currentWeapon = WeaponData[this.weapons[this.currentIndex]];
    // Fresh mag on switch keeps the loop simple; ammo economy is not a goal.
    this.ammoInMag = this.currentWeapon.magazineSize;
    this.reserveAmmo = this.currentWeapon.magazineSize * 3;
    this.isReloading = false;
    this.fireCooldown = 0.2;
    // Visible switch animation: gun dips and rises with the new model
    this._switchAnim = 0.28;
    this._switchReady = true;
    if (this.audio) this.audio.play('switch');
    this._updateWeaponMesh();
  }

  _updateWeaponMesh() {
    if (!this._weaponModels) return;
    // Model swap: hide every model, show the current one. Silhouettes differ
    // (rifle long + angled mag, pistol compact slide, shotgun long barrel +
    // pump + wood) — recognition without reading the HUD label.
    for (const key of Object.keys(this._weaponModels)) {
      this._weaponModels[key].visible = key === this.weapons[this.currentIndex];
    }
    this.weaponMesh = this._weaponModels[this.weapons[this.currentIndex]];
  }

  getAmmoText() {
    return `${this.ammoInMag}/${this.reserveAmmo}`;
  }
}
