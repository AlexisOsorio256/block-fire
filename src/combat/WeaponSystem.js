import * as THREE from '../lib/three.module.js';

export const WeaponData = {
  rifle: {
    name: 'Rifle',
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
    damage: 28,
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
  }
};

export class WeaponSystem {
  constructor(scene, camera, audio, vfx, applyDamage) {
    this.scene = scene;
    this.camera = camera;
    this.audio = audio;
    this.vfx = vfx;
    this.applyDamage = applyDamage;

    this.weapons = ['rifle', 'pistol', 'shotgun'];
    this.currentIndex = 0;
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

    // Weapon mesh (simple blocky)
    this.weaponMesh = this._createWeaponMesh();
    this.scene.add(this.weaponMesh);
  }

  _createWeaponMesh() {
    const group = new THREE.Group();
    // Three-material scheme with real contrast: gunmetal body, deep-black
    // furniture, warm amber accents. Not flat black — reads as a designed prop.
    const bodyM = new THREE.MeshStandardMaterial({ color: 0x3d4557, roughness: 0.55, metalness: 0.45 });
    const blackM = new THREE.MeshStandardMaterial({ color: 0x191d2c, roughness: 0.45, metalness: 0.55 });
    const accentM = new THREE.MeshStandardMaterial({ color: 0xffb400, roughness: 0.35, metalness: 0.3, emissive: 0x402800, emissiveIntensity: 0.35 });
    const gripM = new THREE.MeshStandardMaterial({ color: 0x2b3038, roughness: 0.8, metalness: 0.1 });

    const add = (geo, mat, x, y, z, rotX = 0) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      if (rotX) m.rotation.x = rotX;
      group.add(m);
      return m;
    };

    // Receiver — main body with top rail in accent
    add(new THREE.BoxGeometry(0.09, 0.11, 0.34), bodyM, 0, 0, 0);
    add(new THREE.BoxGeometry(0.055, 0.03, 0.30), blackM, 0, 0.075, -0.02);
    // Rail accent stripe (the weapon's "identity line")
    add(new THREE.BoxGeometry(0.058, 0.012, 0.28), accentM, 0, 0.062, -0.02);
    // Barrel + handguard with vents
    add(new THREE.BoxGeometry(0.045, 0.045, 0.30), blackM, 0, 0.01, -0.30);
    add(new THREE.BoxGeometry(0.07, 0.07, 0.16), bodyM, 0, 0.005, -0.24);
    add(new THREE.BoxGeometry(0.074, 0.02, 0.04), accentM, 0, 0.045, -0.20); // vent accent
    add(new THREE.BoxGeometry(0.074, 0.02, 0.04), accentM, 0, 0.045, -0.27);
    // Muzzle brake (chunkier, with amber tip ring)
    add(new THREE.BoxGeometry(0.075, 0.075, 0.06), blackM, 0, 0.01, -0.46);
    add(new THREE.BoxGeometry(0.082, 0.082, 0.012), accentM, 0, 0.01, -0.435);
    // Magazine (angled, with baseplate accent)
    add(new THREE.BoxGeometry(0.06, 0.16, 0.09), blackM, 0, -0.125, 0.04, 0.12);
    add(new THREE.BoxGeometry(0.064, 0.02, 0.094), accentM, 0, -0.20, 0.052, 0.12);
    // Grip + trigger guard
    add(new THREE.BoxGeometry(0.06, 0.13, 0.07), gripM, 0, -0.11, 0.16, -0.25);
    add(new THREE.BoxGeometry(0.03, 0.02, 0.09), blackM, 0, -0.055, 0.10);
    // Stock (two-tone)
    add(new THREE.BoxGeometry(0.07, 0.10, 0.16), bodyM, 0, -0.01, 0.24);
    add(new THREE.BoxGeometry(0.072, 0.04, 0.05), gripM, 0, -0.045, 0.30);
    // Front sight
    add(new THREE.BoxGeometry(0.025, 0.05, 0.04), accentM, 0, 0.115, -0.16);
    // Rear sight
    add(new THREE.BoxGeometry(0.03, 0.03, 0.03), blackM, 0, 0.105, 0.10);

    group.userData.parts = { dark: bodyM, black: blackM, accent: accentM };
    return group;
  }

  // Per-weapon viewmodel presets (position offset + scale)
  _weaponViewPresets() {
    return {
      rifle:   { pos: new THREE.Vector3(0.26, -0.22, -0.45), scale: 1.0 },
      pistol:  { pos: new THREE.Vector3(0.22, -0.20, -0.38), scale: 0.9 },
      shotgun: { pos: new THREE.Vector3(0.28, -0.24, -0.42), scale: 1.15 },
    };
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
      const preset = this._weaponViewPresets()[this.weapons[this.currentIndex]] || this._weaponViewPresets().rifle;
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
    if (this.isReloading) return false;
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

  fire(shooter, targets, map = null) {
    // Bots share the hitscan implementation, but never share the player's
    // magazine/cooldown. Their own cadence is controlled by Bot.shootCooldown.
    const usesPlayerAmmo = !shooter.isBot;
    if (!this.canFire(usesPlayerAmmo)) return null;

    const weapon = this.currentWeapon;
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

    // Crosshair feedback
    if (usesPlayerAmmo && this.crosshair) {
      this.crosshair.classList.add('fire');
      setTimeout(()=> this.crosshair.classList.remove('fire'), 80);
    }

    if (this.audio) this.audio.play('shoot', weapon.name);

    // Muzzle flash — from viewmodel muzzle in world space
    if (usesPlayerAmmo && this.vfx) {
      const preset = this._weaponViewPresets()[this.weapons[this.currentIndex]] || this._weaponViewPresets().rifle;
      const ads = this._adsBlend || 0;
      const mx = THREE.MathUtils.lerp(preset.pos.x, 0, ads);
      const my = THREE.MathUtils.lerp(preset.pos.y, -0.145, ads);
      const mz = THREE.MathUtils.lerp(preset.pos.z, -0.30, ads) - 0.48; // muzzle tip
      const muzzleLocal = new THREE.Vector3(mx, my + 0.01, mz);
      const muzzleWorld = muzzleLocal.applyQuaternion(this.camera.quaternion).add(this.camera.position);
      // Muzzle flash size carries weapon identity: shotgun cannon-blast,
      // rifle standard, pistol compact.
      const flashSize = weapon === WeaponData.shotgun ? 1.7 : weapon === WeaponData.pistol ? 0.75 : 1.0;
      this.vfx.muzzleFlash(muzzleWorld, this.camera.getWorldDirection(new THREE.Vector3()), flashSize);
    }

    // Raycast for each pellet
    let hits = [];
    for (let p = 0; p < weapon.pellets; p++) {
      // ADS tightens spread (stable aim)
      const spreadScale = 1 - (this._adsBlend || 0) * 0.65;
      const spreadX = (Math.random()-0.5) * weapon.spread * spreadScale;
      const spreadY = (Math.random()-0.5) * weapon.spread * spreadScale;

      const direction = new THREE.Vector3();
      this.camera.getWorldDirection(direction);
      // Apply spread
      direction.x += spreadX;
      direction.y += spreadY;
      direction.normalize();

      // AIM ASSIST (player only): if the raw shot would pass near a visible
      // enemy's chest, bend the ray onto the chest. Mobile (coarse pointer)
      // gets a wider assist cone; PC gets a subtle one. Bots never assist.
      // Occlusion is still checked afterwards — assist never shoots walls.
      if (usesPlayerAmmo) {
        const assistAngle = (this._isTouch || (window.matchMedia && window.matchMedia('(pointer: coarse)').matches)) ? 0.075 : 0.028;
        let bestDot = Math.cos(assistAngle);
        let assistDir = null;
        for (const target of targets) {
          if (target === shooter || !target.isAlive) continue;
          const th = target.height || 1.65;
          const chest = target.position.clone(); chest.y -= th * 0.38;
          const toChest = chest.clone().sub(this.camera.position);
          const dist = toChest.length();
          if (dist > weapon.range) continue;
          toChest.normalize();
          const dot = toChest.dot(direction);
          if (dot > bestDot) {
            // Only assist toward enemies the player is actually facing
            bestDot = dot;
            assistDir = toChest;
          }
        }
        if (assistDir) {
          // Blend 70% onto the chest — a nudge, not an aimbot: the ray keeps
          // most of its original direction so spray still requires tracking.
          direction.lerp(assistDir, 0.7).normalize();
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
        // Target.position is eye height: feet = y - height. Hitboxes must be
        // measured DOWN from eye, matching the visible mesh:
        // head cube center ≈ feet+1.55 → eye-0.10, body torso ≈ eye-0.62.
        const h = target.height || 1.65;
        const bodyPos = target.position.clone(); bodyPos.y -= h * 0.38;
        const headPos = target.position.clone(); headPos.y -= 0.10;
        const toBody = new THREE.Vector3().subVectors(bodyPos, this.camera.position);
        const projDist = toBody.dot(direction);
        if (projDist < 0 || projDist > closestDist) continue;
        const closestPoint = this.camera.position.clone().addScaledVector(direction, projDist);
        const bodyHit = closestPoint.distanceTo(bodyPos) < 0.55;
        const headHit = closestPoint.distanceTo(headPos) < 0.28;

        if (bodyHit || headHit) {
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
        }
      }
    }

    // Hitmarker — hierarchy: body hit (small yellow) → headshot (bigger, red
    // tint + sharper sound) → kill (largest, red). The player learns the
    // difference without reading anything.
    if (usesPlayerAmmo && hits.length > 0) {
      const headshot = hits.some(h => h.headshot);
      this.showHitmarker(killed, headshot && !killed);
      if (this.audio) this.audio.play(killed ? 'kill' : (headshot ? 'headshot' : 'hit'));
      if (headshot && !killed && this.vfx && this.vfx.hud) this.vfx.hud.showHitBanner(true);
    }

    // Auto reload if empty
    if (this.ammoInMag <= 0 && this.reserveAmmo > 0 && !this.isReloading) {
      // Don't auto reload immediately, let player press R, but for bots auto
      if (shooter.isBot) this.reload();
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

  switchWeapon(dir) {
    if (this.isReloading) return;
    let idx = this.currentIndex;
    if (typeof dir === 'number' && dir >= 1 && dir <= 3) {
      idx = dir - 1;
    } else {
      idx = (idx + dir + this.weapons.length) % this.weapons.length;
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
    if (!this.weaponMesh) return;
    // Accent block color hints at weapon type
    const accents = { rifle: 0xffb400, pistol: 0x4ade80, shotgun: 0xff5a3c };
    const parts = this.weaponMesh.userData.parts;
    if (parts) parts.accent.color.setHex(accents[this.weapons[this.currentIndex]] || 0xffb400);
  }

  getAmmoText() {
    return `${this.ammoInMag}/${this.reserveAmmo}`;
  }
}
