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
  },
  shotgun: {
    name: 'Shotgun',
    damage: 14,
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
  }
};

export class WeaponSystem {
  constructor(scene, camera, audio, vfx) {
    this.scene = scene;
    this.camera = camera;
    this.audio = audio;
    this.vfx = vfx;

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
    // Body
    const bodyGeo = new THREE.BoxGeometry(0.12, 0.08, 0.42);
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x2a2f45, roughness: 0.7 });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.set(0.28, -0.18, -0.42);
    group.add(body);
    // Barrel
    const barrelGeo = new THREE.BoxGeometry(0.04, 0.04, 0.32);
    const barrelMat = new THREE.MeshStandardMaterial({ color: 0x1a1f33 });
    const barrel = new THREE.Mesh(barrelGeo, barrelMat);
    barrel.position.set(0.28, -0.15, -0.62);
    group.add(barrel);
    // Muzzle point
    this.muzzlePos = new THREE.Vector3(0.28, -0.15, -0.78);
    group.muzzle = barrel;
    return group;
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
        if (this.audio) this.audio.play('reload');
      }
    }
    // Recoil recovery
    this.recoilOffset = THREE.MathUtils.lerp(this.recoilOffset, 0, dt * 8);

    // Update weapon mesh position (attached to camera)
    if (this.weaponMesh) {
      // Position relative to camera
      this.weaponMesh.position.copy(this.camera.position);
      this.weaponMesh.quaternion.copy(this.camera.quaternion);
      // Offset forward/right/down
      const offset = new THREE.Vector3(0.28, -0.18 - this.recoilOffset*0.04, -0.42);
      offset.applyQuaternion(this.camera.quaternion);
      this.weaponMesh.position.add(offset);
      // Recoil kick
      this.weaponMesh.rotation.x = this.camera.rotation.x - this.recoilOffset * 0.04;
      this.weaponMesh.rotation.y = this.camera.rotation.y;
      this.weaponMesh.rotation.z = this.camera.rotation.z;
    }
  }

  canFire() {
    if (this.isReloading) return false;
    if (this.fireCooldown > 0) return false;
    if (this.ammoInMag <= 0) {
      this.reload();
      return false;
    }
    return true;
  }

  fire(shooter, targets) {
    if (!this.canFire()) return null;

    const weapon = this.currentWeapon;
    this.ammoInMag--;
    this.fireCooldown = weapon.fireRate;
    this.recoilOffset += weapon.recoil;

    // Crosshair feedback
    if (this.crosshair) {
      this.crosshair.classList.add('fire');
      setTimeout(()=> this.crosshair.classList.remove('fire'), 80);
    }

    if (this.audio) this.audio.play('shoot', weapon.name);

    // Muzzle flash
    if (this.vfx) this.vfx.muzzleFlash(this.camera.position, this.camera.getWorldDirection(new THREE.Vector3()));

    // Raycast for each pellet
    let hits = [];
    for (let p = 0; p < weapon.pellets; p++) {
      const spreadX = (Math.random()-0.5) * weapon.spread;
      const spreadY = (Math.random()-0.5) * weapon.spread;
      
      const direction = new THREE.Vector3();
      this.camera.getWorldDirection(direction);
      // Apply spread
      direction.x += spreadX;
      direction.y += spreadY;
      direction.normalize();

      this.raycaster.set(this.camera.position, direction);
      // Check against targets (players/bots + map)
      // For map, we use a simple ray against map boxes (handled in Game)
      let closestHit = null;
      let closestDist = weapon.range;

      for (const target of targets) {
        if (target === shooter) continue;
        if (!target.isAlive) continue;
        // Simple sphere check (head is higher)
        const toTarget = new THREE.Vector3().subVectors(target.position, this.camera.position);
        const projDist = toTarget.dot(direction);
        if (projDist < 0 || projDist > closestDist) continue;
        const closestPoint = this.camera.position.clone().addScaledVector(direction, projDist);
        const distToCenter = closestPoint.distanceTo(target.position);
        // Body radius 0.4, head is 0.25 at y+0.5
        const bodyHit = distToCenter < 0.45;
        const headPos = target.position.clone(); headPos.y += 0.55;
        const headDist = closestPoint.distanceTo(headPos);
        const headHit = headDist < 0.22;

        if (bodyHit || headHit) {
          closestDist = projDist;
          closestHit = { target, distance: projDist, headshot: headHit, point: closestPoint.clone() };
        }
      }

      if (closestHit) {
        // Check map occlusion: if map blocks the shot, ignore
        // This will be handled by Game which checks map ray first
        hits.push(closestHit);
      } else {
        // Miss - show impact on map
        if (this.vfx) {
          const missPoint = this.camera.position.clone().addScaledVector(direction, 45);
          this.vfx.impact(missPoint, null);
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
        const d = weapon.damage * (h.headshot ? weapon.headshotMul : 1);
        damage += d;
        if (h.headshot) isHeadshot = true;
      }
      // Apply via DamageSystem (passed in as callback)
      if (target.takeDamage) {
        const died = target.takeDamage(damage, isHeadshot ? 'head' : 'body', shooter);
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

    // Hitmarker
    if (hits.length > 0) {
      this.showHitmarker(killed);
      if (this.audio) this.audio.play(killed ? 'kill' : 'hit');
    }

    // Auto reload if empty
    if (this.ammoInMag <= 0 && this.reserveAmmo > 0 && !this.isReloading) {
      // Don't auto reload immediately, let player press R, but for bots auto
      if (shooter.isBot) this.reload();
    }

    return { hits, totalDamage, killed };
  }

  showHitmarker(killed) {
    if (!this.hitmarker) return;
    this.hitmarker.classList.add('show');
    this.hitmarker.style.borderColor = killed ? '#ff4444' : '#ffd23f';
    this.hitmarker.style.transform = 'translate(-50%,-50%) scale(1.4)';
    setTimeout(()=> {
      this.hitmarker.classList.remove('show');
      this.hitmarker.style.transform = 'translate(-50%,-50%) scale(1)';
    }, 140);
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
    if (this.audio) this.audio.play('reload');
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
    // Keep ammo? For prototype, keep same ammo but update mag size to new weapon's mag if needed
    // For simplicity, refill on switch
    this.ammoInMag = this.currentWeapon.magazineSize;
    this.reserveAmmo = this.currentWeapon.magazineSize * 3;
    this.isReloading = false;
    this.fireCooldown = 0.2;
    this._updateWeaponMesh();
  }

  _updateWeaponMesh() {
    if (!this.weaponMesh) return;
    // Change color based on weapon
    const colors = { rifle: 0x2a2f45, pistol: 0x3a2f2a, shotgun: 0x2a3a2f };
    const color = colors[this.weapons[this.currentIndex]] || 0x2a2f45;
    this.weaponMesh.children[0].material.color.setHex(color);
  }

  getAmmoText() {
    return `${this.ammoInMag}/${this.reserveAmmo}`;
  }
}
