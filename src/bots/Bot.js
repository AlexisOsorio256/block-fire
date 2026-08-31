import * as THREE from '../lib/three.module.js';

export class Bot {
  constructor(id, scene, map, position) {
    this.id = id;
    this.isBot = true;
    this.isAlive = true;
    this.map = map;
    this.scene = scene;
    // Snap spawn Y to actual ground (covers platforms correctly)
    const gy = map ? map.getGroundY(position.x, position.z) : 0;
    this.position = new THREE.Vector3(position.x, gy + 1.65, position.z);
    this.health = 100;
    this.maxHealth = 100;
    this.kills = 0;
    this.deaths = 0;

    this.yaw = Math.random() * Math.PI * 2;
    this.targetYaw = this.yaw;
    this.pitch = 0;

    this.velocity = new THREE.Vector3();
    this.speed = 3.2 + Math.random() * 0.8;
    this.sprintSpeed = 5.0;

    this.height = 1.65;
    this.radius = 0.38;

    this.mesh = this._createMesh();
    scene.add(this.mesh);

    // Head mesh for headshot
    this.headMesh = this.mesh.getObjectByName('head');

    // AI state
    this.state = 'wander'; // wander, chase, attack
    this.target = null;
    this.stateTimer = 0;
    this.wanderDir = new THREE.Vector3((Math.random()-0.5), 0, (Math.random()-0.5)).normalize();
    this.shootCooldown = 0;
    this.strafeDir = Math.random() > 0.5 ? 1 : -1;
    this.strafeTimer = 0;
  }

  _createMesh() {
    const group = new THREE.Group();

    // Palette: saturated body readable against light concrete map
    const bodyColor = this._getTeamColor();
    const bodyMat = new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.7 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x1c2230, roughness: 0.65 });
    const visorMat = new THREE.MeshStandardMaterial({
      color: 0x10141f, roughness: 0.3, metalness: 0.5,
      emissive: 0x8844ff, emissiveIntensity: 0.55
    });

    // Torso — slightly tapered block
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.9, 0.36), bodyMat);
    body.position.y = 0.9;
    body.castShadow = true;
    group.add(body);
    // Chest plate detail
    const chest = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.34, 0.06), darkMat);
    chest.position.set(0, 1.02, 0.19);
    group.add(chest);
    // Belt
    const belt = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.1, 0.38), darkMat);
    belt.position.y = 0.52;
    group.add(belt);

    // Head + glowing visor (enemy readability)
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.42), darkMat);
    head.position.y = 1.55;
    head.name = 'head';
    head.castShadow = true;
    group.add(head);
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.12, 0.05), visorMat);
    visor.position.set(0, 1.57, 0.22);
    group.add(visor);
    this._visorMat = visorMat;

    // Arms
    const armGeo = new THREE.BoxGeometry(0.18, 0.55, 0.18);
    const leftArm = new THREE.Mesh(armGeo, bodyMat);
    leftArm.position.set(-0.42, 0.85, 0);
    group.add(leftArm);
    const rightArm = new THREE.Mesh(armGeo, bodyMat);
    rightArm.position.set(0.42, 0.85, 0);
    group.add(rightArm);

    // Legs
    const legGeo = new THREE.BoxGeometry(0.22, 0.6, 0.22);
    const leftLeg = new THREE.Mesh(legGeo, darkMat);
    leftLeg.position.set(-0.16, 0.3, 0);
    leftLeg.userData._baseY = 0.3;
    group.add(leftLeg);
    const rightLeg = new THREE.Mesh(legGeo, darkMat);
    rightLeg.position.set(0.16, 0.3, 0);
    rightLeg.userData._baseY = 0.3;
    group.add(rightLeg);
    this._lLeg = leftLeg;
    this._rLeg = rightLeg;

    // Blocky rifle held at hip
    const gun = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, 0.58), darkMat);
    gun.position.set(0.42, 0.85, 0.35);
    group.add(gun);

    // group.position is feet position; mesh is 1.76 tall vs collider 1.65
    // so feet are exactly on groundY when group.y = position.y - height
    group.position.copy(this.position);
    group.position.y -= this.height;

    return group;
  }

  _getTeamColor() {
    // FFA: saturated enemy tones that pop against light concrete
    const colors = [0xd94f4f, 0xd97b2d, 0x2d9dd9, 0x8a44d9, 0xd92d86, 0x2dd98a];
    return colors[this.id % colors.length];
  }

  takeDamage(amount, hitType, attacker) {
    if (!this.isAlive) return false;
    this.health -= amount;
    // Hit flash on body materials only (visor keeps its own glow)
    if (this.mesh) {
      const flashed = [];
      this.mesh.children.forEach(c => {
        if (c.material && c.material.emissive && c.material !== this._visorMat) {
          c.userData._savedEmissive = c.material.emissive.getHex();
          c.material.emissive.setHex(0xff2222);
          flashed.push(c);
        }
      });
      if (flashed.length) {
        clearTimeout(this._flashTimer);
        this._flashTimer = setTimeout(()=> {
          flashed.forEach(c => {
            if (c.material && c.userData._savedEmissive !== undefined) {
              c.material.emissive.setHex(c.userData._savedEmissive);
            }
          });
        }, 80);
      }
    }
    if (this.health <= 0) {
      this.health = 0;
      this.isAlive = false;
      this.mesh.visible = false;
      return true;
    }
    return false;
  }

  respawn(pos) {
    // pos may be a spawn point with stale Y — always snap to ground
    const gy = this.map ? this.map.getGroundY(pos.x, pos.z) : 0;
    this.position.set(pos.x, gy + this.height, pos.z);
    this.health = this.maxHealth;
    this.isAlive = true;
    this.mesh.visible = true;
    this.mesh.position.copy(this.position);
    this.mesh.position.y -= this.height;
    this.velocity.set(0,0,0);
    this.yaw = Math.random() * Math.PI * 2;
    this.targetYaw = this.yaw;
    this.state = 'wander';
    this.stateTimer = 0;
  }

  update(dt, player, bots, map) {
    if (!this.isAlive) return null; // returns action

    this.stateTimer += dt;
    this.shootCooldown = Math.max(0, this.shootCooldown - dt);
    this.strafeTimer -= dt;

    // Find nearest target (player + other bots)
    let nearest = null;
    let nearestDist = Infinity;
    const candidates = [player, ...bots].filter(t => t !== this && t.isAlive);
    for (const c of candidates) {
      const d = this.position.distanceTo(c.position);
      // Check line of sight (simple: no wall between)
      if (d < nearestDist && d < 28) {
        // Ray from bot eyes (head) to target chest
        const eye = this.position.clone(); eye.y -= 0.12;
        const targetChest = c.position.clone(); targetChest.y -= 0.35;
        const dir = new THREE.Vector3().subVectors(targetChest, eye).normalize();
        const dist = eye.distanceTo(targetChest);
        const hit = map.raycast(eye, dir, dist);
        if (!hit) {
          nearest = c;
          nearestDist = d;
        } else if (d < 8) {
          // If very close, still chase even if behind cover
          nearest = c;
          nearestDist = d;
        }
      }
    }
    this.target = nearest;

    // State machine
    if (nearest && nearestDist < 18) {
      this.state = 'attack';
    } else if (nearest && nearestDist < 30) {
      this.state = 'chase';
    } else {
      if (this.state === 'attack' && !nearest) this.state = 'wander';
      if (this.stateTimer > 3 + Math.random()*2) {
        this.state = 'wander';
        this.stateTimer = 0;
        this.wanderDir.set((Math.random()-0.5), 0, (Math.random()-0.5)).normalize();
      }
    }

    let move = new THREE.Vector3();
    let wantShoot = false;
    let lookAtTarget = false;

    if (this.state === 'wander') {
      move.copy(this.wanderDir);
      // Avoid walls: if blocked, pick new dir
      const nextPos = this.position.clone().addScaledVector(move, this.speed * dt * 2);
      if (map.checkCollision(nextPos, this.radius, this.height)) {
        this.wanderDir.set((Math.random()-0.5), 0, (Math.random()-0.5)).normalize();
        move.copy(this.wanderDir);
      }
      // Slow wander
      move.multiplyScalar(0.6);

    } else if (this.state === 'chase' && nearest) {
      const toTarget = new THREE.Vector3().subVectors(nearest.position, this.position);
      toTarget.y = 0; toTarget.normalize();
      move.copy(toTarget);
      lookAtTarget = true;
      if (nearestDist < 6) {
        // Strafe
        if (this.strafeTimer <= 0) {
          this.strafeDir = Math.random() > 0.5 ? 1 : -1;
          this.strafeTimer = 0.6 + Math.random()*0.8;
        }
        const strafe = new THREE.Vector3().crossVectors(toTarget, new THREE.Vector3(0,1,0)).multiplyScalar(this.strafeDir * 0.7);
        move.add(strafe);
        move.normalize();
      }

    } else if (this.state === 'attack' && nearest) {
      lookAtTarget = true;
      wantShoot = nearestDist < 22;
      // Strafe heavily when attacking
      const toTarget = new THREE.Vector3().subVectors(nearest.position, this.position);
      toTarget.y = 0; const dist = toTarget.length();
      toTarget.normalize();
      if (dist > 8) {
        move.copy(toTarget).multiplyScalar(0.7);
      } else if (dist < 4) {
        move.copy(toTarget).multiplyScalar(-0.5);
      } else {
        if (this.strafeTimer <= 0) {
          this.strafeDir = Math.random() > 0.5 ? 1 : -1;
          this.strafeTimer = 0.4 + Math.random()*0.6;
        }
        const strafe = new THREE.Vector3().crossVectors(toTarget, new THREE.Vector3(0,1,0)).multiplyScalar(this.strafeDir);
        move.copy(strafe);
      }
      if (this.strafeTimer > 0) {
        const strafe = new THREE.Vector3().crossVectors(toTarget, new THREE.Vector3(0,1,0)).multiplyScalar(this.strafeDir * 0.6);
        move.add(strafe);
      }
      move.normalize();
      move.multiplyScalar(0.85);
    }

    // Apply movement
    if (move.lengthSq() > 0.01) {
      const nextPos = this.position.clone().addScaledVector(move, this.speed * dt);
      // Ground: only platforms reachable from current feet height
      const groundY = map.getGroundY(nextPos.x, nextPos.z, this.position.y - this.height);
      nextPos.y = groundY + this.height;
      if (!map.checkCollision(nextPos, this.radius, this.height)) {
        this.position.copy(nextPos);
      } else {
        // Try slide
        const tryX = this.position.clone(); tryX.x = nextPos.x;
        if (!map.checkCollision(tryX, this.radius, this.height)) this.position.x = tryX.x;
        const tryZ = this.position.clone(); tryZ.z = nextPos.z;
        if (!map.checkCollision(tryZ, this.radius, this.height)) this.position.z = tryZ.z;
      }
      // Face movement direction if not looking at target
      if (!lookAtTarget && move.lengthSq() > 0.01) {
        this.targetYaw = Math.atan2(move.x, move.z);
      }
    }

    // Look at target
    if (lookAtTarget && nearest) {
      const toTarget = new THREE.Vector3().subVectors(nearest.position, this.position);
      this.targetYaw = Math.atan2(toTarget.x, toTarget.z);
      // Add slight spread inaccuracy for bots (worse at distance)
      const inaccuracy = THREE.MathUtils.clamp(nearestDist * 0.012, 0.02, 0.12);
      this.targetYaw += (Math.random()-0.5) * inaccuracy;
    }

    // Smooth yaw
    let yawDiff = this.targetYaw - this.yaw;
    // Normalize to -PI to PI
    while (yawDiff > Math.PI) yawDiff -= Math.PI*2;
    while (yawDiff < -Math.PI) yawDiff += Math.PI*2;
    this.yaw += yawDiff * Math.min(1, dt * 6);

    // Update mesh: feet stay on groundY
    this.mesh.position.copy(this.position);
    this.mesh.position.y -= this.height;
    this.mesh.rotation.y = this.yaw;

    // Bob legs when moving
    if (move.lengthSq() > 0.01) {
      const bob = Math.sin(Date.now() * 0.012) * 0.08;
      const lLeg = this._lLeg, rLeg = this._rLeg;
      if (lLeg && rLeg) {
        lLeg.position.y = (lLeg.userData._baseY ?? 0.3) + bob;
        rLeg.position.y = (rLeg.userData._baseY ?? 0.3) - bob;
      }
    }

    // Shooting
    let shoot = false;
    if (wantShoot && this.shootCooldown <= 0 && nearest) {
      // Check if facing target within ~35 degrees
      const toTarget = new THREE.Vector3().subVectors(nearest.position, this.position).normalize();
      const forward = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
      const dot = forward.dot(toTarget);
      if (dot > 0.72) {
        shoot = true;
        this.shootCooldown = 0.22 + Math.random()*0.35; // fire rate variation
        // Add recoil to yaw
        this.yaw += (Math.random()-0.5) * 0.06;
      }
    }

    return {
      move,
      look: { yaw: this.yaw, pitch: this.pitch },
      shoot,
      target: nearest
    };
  }
}
