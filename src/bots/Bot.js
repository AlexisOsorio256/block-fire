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
    this.maxHealth = 125;
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
    const gearMat = new THREE.MeshStandardMaterial({ color: 0x2e3950, roughness: 0.6, metalness: 0.15 });
    // Per-skin visor color: each bot reads as a distinct "operator"
    const visorColors = [0x8844ff, 0xff8329, 0x39d7ff, 0xff3d71, 0x9dff3d, 0xffd23f, 0x4dffd2];
    const visorMat = new THREE.MeshStandardMaterial({
      color: 0x10141f, roughness: 0.3, metalness: 0.5,
      emissive: visorColors[this.id % visorColors.length], emissiveIntensity: 0.7
    });

    // Torso
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.9, 0.36), bodyMat);
    body.position.y = 0.9;
    body.castShadow = true;
    group.add(body);
    // Chest plate
    const chest = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.34, 0.06), gearMat);
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

    // SKIN DETAIL by id: helmet crest / antenna / shoulder pads — visual
    // differentiation between bots without any inventory/skin SYSTEM.
    if (this.id % 3 === 0) {
      // Helmet crest
      const crest = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.16, 0.3), visorMat);
      crest.position.set(0, 1.82, 0);
      group.add(crest);
    } else if (this.id % 3 === 1) {
      // Shoulder pads
      const padGeo = new THREE.BoxGeometry(0.24, 0.14, 0.3);
      const padL = new THREE.Mesh(padGeo, gearMat); padL.position.set(-0.45, 1.28, 0); group.add(padL);
      const padR = new THREE.Mesh(padGeo, gearMat); padR.position.set(0.45, 1.28, 0); group.add(padR);
    } else {
      // Antenna backpack
      const pack = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.4, 0.16), gearMat);
      pack.position.set(0, 1.05, -0.24); group.add(pack);
      const ant = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.4, 0.03), visorMat);
      ant.position.set(0.12, 1.42, -0.3); group.add(ant);
    }

    // ARMS with SHOULDER PIVOTS — real walk-cycle swing, not position bob.
    // The pivot sits at the shoulder; the arm hangs below and rotates in Z.
    const makeArm = (side) => {
      const pivot = new THREE.Group();
      pivot.position.set(side * 0.42, 1.12, 0);          // shoulder height
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.55, 0.18), bodyMat);
      arm.position.y = -0.28;                            // hangs from pivot
      arm.castShadow = true;
      pivot.add(arm);
      group.add(pivot);
      return pivot;
    };
    this._lArm = makeArm(-1);
    this._rArm = makeArm(1);

    // LEGS with HIP PIVOTS — knees lift forward/back like a stride.
    const makeLeg = (side) => {
      const pivot = new THREE.Group();
      pivot.position.set(side * 0.16, 0.62, 0);          // hip height
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.62, 0.24), darkMat);
      leg.position.y = -0.31;                            // hangs from pivot
      leg.castShadow = true;
      pivot.add(leg);
      group.add(pivot);
      return pivot;
    };
    this._lLeg = makeLeg(-1);
    this._rLeg = makeLeg(1);

    // Blocky rifle held at hip (parented to right arm pivot so it swings too)
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
    // Hit flinch: short knockback away from the attacker — visible hit confirm
    if (attacker && this.mesh) {
      const away = new THREE.Vector3().subVectors(this.position, attacker.position);
      away.y = 0;
      if (away.lengthSq() > 0.0001) {
        away.normalize().multiplyScalar(hitType === 'head' ? 0.5 : 0.3);
        const next = this.position.clone().add(away);
        if (!this.map.checkCollision(next, this.radius, this.height)) {
          this.position.copy(next);
        }
        this._flinchT = 0.12;
      }
    }
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
    this._stridePhase = 0;
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

    // Apply movement with SMOOTH ACCELERATION — bots ease into their stride
    // instead of snapping to full speed (kills the "ghost sliding" look).
    // velocity lerps toward the wish velocity; position integrates velocity.
    const wish = move.lengthSq() > 0.01 ? move.clone().multiplyScalar(this.speed) : new THREE.Vector3();
    const accelT = Math.min(1, (move.lengthSq() > 0.01 ? 6.5 : 9) * dt);
    this.velocity.x = THREE.MathUtils.lerp(this.velocity.x, wish.x, accelT);
    this.velocity.z = THREE.MathUtils.lerp(this.velocity.z, wish.z, accelT);
    if (Math.hypot(this.velocity.x, this.velocity.z) > 0.02) {
      const nextPos = this.position.clone().addScaledVector(this.velocity, dt);
      // Ground: only platforms reachable from current feet height
      const groundY = map.getGroundY(nextPos.x, nextPos.z, this.position.y - this.height);
      nextPos.y = groundY + this.height;
      if (!map.checkCollision(nextPos, this.radius, this.height)) {
        this.position.copy(nextPos);
      } else {
        // Try slide axis-separated (same contract as the player)
        const tryX = this.position.clone(); tryX.x = nextPos.x; tryX.y = nextPos.y;
        if (!map.checkCollision(tryX, this.radius, this.height)) this.position.x = tryX.x;
        const tryZ = this.position.clone(); tryZ.z = nextPos.z; tryZ.y = nextPos.y;
        if (!map.checkCollision(tryZ, this.radius, this.height)) this.position.z = tryZ.z;
        // Blocked head-on: cut velocity so the bot doesn't push into walls
        this.velocity.multiplyScalar(0.4);
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

    // Hit flinch: brief body tilt toward the shot (decays in ~0.12s)
    if (this._flinchT > 0) {
      this._flinchT -= dt;
      const k = Math.max(0, this._flinchT / 0.12);
      this.mesh.rotation.x = k * 0.35; // recoil tilt
    } else {
      this.mesh.rotation.x = 0;
    }

    // WALK CYCLE — hip/shoulder pivots swing like a real stride. Speed drives
    // stride frequency; still bots settle to neutral pose smoothly.
    const speedNow = Math.hypot(this.velocity.x, this.velocity.z);
    const moving = move.lengthSq() > 0.01;
    this._stridePhase = (this._stridePhase || 0) + dt * (4 + speedNow * 1.6);
    const strideAmp = moving ? Math.min(0.55, 0.25 + speedNow * 0.09) : 0;
    const swing = Math.sin(this._stridePhase) * strideAmp;
    if (this._lLeg && this._rLeg) {
      // Smooth toward target so stopping reads as deceleration, not a freeze
      this._lLeg.rotation.x = THREE.MathUtils.lerp(this._lLeg.rotation.x, swing, Math.min(1, dt * 12));
      this._rLeg.rotation.x = THREE.MathUtils.lerp(this._rLeg.rotation.x, -swing, Math.min(1, dt * 12));
    }
    if (this._lArm && this._rArm) {
      // Arms counter-swing the legs; right arm swings less (holds the rifle)
      this._lArm.rotation.x = THREE.MathUtils.lerp(this._lArm.rotation.x, -swing * 0.8, Math.min(1, dt * 12));
      this._rArm.rotation.x = THREE.MathUtils.lerp(this._rArm.rotation.x, swing * 0.35, Math.min(1, dt * 12));
    }
    // Subtle body bounce synced to the stride (feet stay planted on ground)
    if (this.mesh) {
      const bounce = moving ? Math.abs(Math.sin(this._stridePhase)) * 0.03 * (speedNow / 4) : 0;
      this.mesh.position.y = this.position.y - this.height + bounce;
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
