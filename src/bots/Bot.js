import * as THREE from '../lib/three.module.js';

export class Bot {
  constructor(id, scene, map, position) {
    this.id = id;
    this.isBot = true;
    this.isAlive = true;
    this.position = position.clone();
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

    this.map = map;
    this.scene = scene;

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
    
    // Body - blocky
    const bodyGeo = new THREE.BoxGeometry(0.6, 0.9, 0.35);
    const bodyMat = new THREE.MeshStandardMaterial({ 
      color: this._getTeamColor(),
      roughness: 0.8
    });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.9;
    body.castShadow = true;
    group.add(body);

    // Head
    const headGeo = new THREE.BoxGeometry(0.42, 0.42, 0.42);
    const headMat = new THREE.MeshStandardMaterial({ color: 0xffdbac, roughness: 0.9 });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.y = 1.55;
    head.name = 'head';
    head.castShadow = true;
    group.add(head);

    // Arms
    const armGeo = new THREE.BoxGeometry(0.18, 0.55, 0.18);
    const armMat = new THREE.MeshStandardMaterial({ color: 0x2a2f45 });
    const leftArm = new THREE.Mesh(armGeo, armMat);
    leftArm.position.set(-0.42, 0.85, 0);
    group.add(leftArm);
    const rightArm = new THREE.Mesh(armGeo, armMat);
    rightArm.position.set(0.42, 0.85, 0);
    group.add(rightArm);

    // Legs
    const legGeo = new THREE.BoxGeometry(0.22, 0.6, 0.22);
    const legMat = new THREE.MeshStandardMaterial({ color: 0x1a2332 });
    const leftLeg = new THREE.Mesh(legGeo, legMat);
    leftLeg.position.set(-0.16, 0.3, 0);
    group.add(leftLeg);
    const rightLeg = new THREE.Mesh(legGeo, legMat);
    rightLeg.position.set(0.16, 0.3, 0);
    group.add(rightLeg);

    // Weapon (simple)
    const gunGeo = new THREE.BoxGeometry(0.08, 0.08, 0.55);
    const gunMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
    const gun = new THREE.Mesh(gunGeo, gunMat);
    gun.position.set(0.42, 0.85, 0.35);
    group.add(gun);

    group.position.copy(this.position);
    group.position.y -= this.height - 0.9;

    return group;
  }

  _getTeamColor() {
    // FFA: each bot has slightly different tint
    const hues = [0.02, 0.08, 0.55, 0.65, 0.75, 0.85];
    const hue = hues[this.id % hues.length];
    const color = new THREE.Color().setHSL(hue, 0.65, 0.5);
    return color.getHex();
  }

  takeDamage(amount, hitType, attacker) {
    if (!this.isAlive) return false;
    this.health -= amount;
    // Flash
    if (this.mesh) {
      this.mesh.children.forEach(c => {
        if (c.material) {
          c.material.emissive = new THREE.Color(0xff0000);
          setTimeout(()=> { if(c.material) c.material.emissive.setHex(0x000000); }, 90);
        }
      });
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
    this.position.copy(pos);
    this.health = this.maxHealth;
    this.isAlive = true;
    this.mesh.visible = true;
    this.mesh.position.copy(this.position);
    this.mesh.position.y -= this.height - 0.9;
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
        // Ray check against map
        const dir = new THREE.Vector3().subVectors(c.position, this.position).normalize();
        const dist = this.position.distanceTo(c.position);
        const hit = map.raycast(this.position.clone().add(new THREE.Vector3(0, 0.6, 0)), dir, dist);
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
      // Ground
      const groundY = map.getGroundY(nextPos.x, nextPos.z);
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

    // Update mesh
    this.mesh.position.copy(this.position);
    this.mesh.position.y -= this.height - 0.9;
    this.mesh.rotation.y = this.yaw;

    // Bob legs when moving
    if (move.lengthSq() > 0.01) {
      const bob = Math.sin(Date.now() * 0.012) * 0.08;
      this.mesh.children[3].position.y = 0.3 + bob;
      this.mesh.children[4].position.y = 0.3 - bob;
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
