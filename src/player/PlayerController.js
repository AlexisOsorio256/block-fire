import * as THREE from '../lib/three.module.js';

export class PlayerController {
  constructor(player, input, camera, scene, map) {
    this.player = player;
    this.input = input;
    this.camera = camera;
    this.scene = scene;
    this.map = map;

    this.velocity = new THREE.Vector3();
    this.onGround = false;
    this.health = 100;
    this.maxHealth = 100;

    this.yaw = 0;
    this.pitch = 0;
    this.sensitivity = 0.0022;

    // Fast arcade FPS feel: base run is already fast, sprint is a boost.
    this.moveSpeed = 6.0;
    this.sprintSpeed = 7.8;
    this.jumpForce = 8.2;
    this.gravity = 26;

    // Accel: snap toward wish velocity; friction stops without gluing mid-air
    this.groundAccel = 52;
    this.groundFriction = 36;
    this.airAccel = 24;

    // Feel details (subtle, cheap)
    this.roll = 0;          // strafe camera roll (radians)
    this.bobTime = 0;       // head bob phase

    this.height = 1.65;
    this.radius = 0.35;

    this._setupPointerLock();
  }

  _setupPointerLock() {
    const canvas = document.querySelector('#game-container canvas');
    if (!canvas) return;
    // Pointer lock on click when playing
    canvas.addEventListener('click', () => {
      if (document.pointerLockElement !== canvas && this.player.isAlive) {
        canvas.requestPointerLock();
      }
    });
    document.addEventListener('mousemove', e => {
      if (document.pointerLockElement && document.pointerLockElement.tagName === 'CANVAS') {
        this.yaw -= e.movementX * this.sensitivity;
        this.pitch -= e.movementY * this.sensitivity;
        this.pitch = Math.max(-Math.PI/2 + 0.1, Math.min(Math.PI/2 - 0.1, this.pitch));
      }
    });
  }

  update(dt) {
    if (!this.player.isAlive) return;

    // Mobile look from touch
    const touchLook = this.input.getLookDelta();
    if (touchLook.x !== 0 || touchLook.y !== 0) {
      this.yaw -= touchLook.x * 0.015;
      this.pitch -= touchLook.y * 0.015;
      this.pitch = Math.max(-Math.PI/2 + 0.1, Math.min(Math.PI/2 - 0.1, this.pitch));
    }

    // Apply rotation to camera — yaw/pitch + subtle strafe roll
    this.roll = THREE.MathUtils.lerp(this.roll, -this.input.move.x * 0.018, Math.min(1, dt * 10));
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;
    this.camera.rotation.z = this.roll;

    // Movement
    const move = this.input.move;
    const isSprinting = this.input._keys && this.input._keys.has('ShiftLeft');
    const speed = isSprinting ? this.sprintSpeed : this.moveSpeed;

    const forward = new THREE.Vector3();
    const right = new THREE.Vector3();
    this.camera.getWorldDirection(forward);
    forward.y = 0; forward.normalize();
    right.crossVectors(forward, new THREE.Vector3(0,1,0));

    // Input move is in local space: x = strafe, y = forward
    const wishDir = new THREE.Vector3();
    wishDir.addScaledVector(forward, move.y);
    wishDir.addScaledVector(right, move.x);
    if (wishDir.lengthSq() > 0) wishDir.normalize();
    const wishVel = wishDir.multiplyScalar(speed);

    // Acceleration toward wish velocity. Separate accel/friction gives
    // instant response + precise stops without feeling glued mid-air.
    const accel = this.onGround
      ? (wishDir.lengthSq() > 0 ? this.groundAccel : this.groundFriction)
      : this.airAccel;
    const t = Math.min(1, accel * dt);
    this.velocity.x = THREE.MathUtils.lerp(this.velocity.x, wishVel.x, t);
    this.velocity.z = THREE.MathUtils.lerp(this.velocity.z, wishVel.z, t);

    // Gravity and jump
    if (this.input.jump && this.onGround) {
      this.velocity.y = this.jumpForce;
      this.onGround = false;
    }
    this.velocity.y -= this.gravity * dt;

    // Apply movement with simple collision against map
    const nextPos = this.player.position.clone().addScaledVector(this.velocity, dt);
    
    // Simple ground check: highest walkable surface at or below feet (+step)
    const feetY = nextPos.y - this.height;
    const groundY = this.map ? this.map.getGroundY(nextPos.x, nextPos.z, feetY) : 0;
    const playerBottom = feetY;
    if (playerBottom <= groundY) {
      nextPos.y = groundY + this.height;
      this.velocity.y = Math.max(0, this.velocity.y);
      this.onGround = true;
    } else {
      this.onGround = false;
    }

    // Wall collision (simple AABB against map boxes)
    if (this.map) {
      const collided = this.map.checkCollision(nextPos, this.radius, this.height);
      if (collided) {
        // Simple slide: try X only, then Z only
        const tryX = this.player.position.clone(); tryX.x = nextPos.x;
        if (!this.map.checkCollision(tryX, this.radius, this.height)) {
          nextPos.x = tryX.x;
        } else {
          this.velocity.x = 0;
        }
        const tryZ = this.player.position.clone(); tryZ.z = nextPos.z;
        if (!this.map.checkCollision(tryZ, this.radius, this.height)) {
          nextPos.z = tryZ.z;
        } else {
          this.velocity.z = 0;
        }
        // Y already handled
        nextPos.y = this.player.position.y + this.velocity.y * dt;
        if (nextPos.y - this.height <= groundY) {
          nextPos.y = groundY + this.height;
          this.onGround = true;
          this.velocity.y = 0;
        }
      }
    }

    this.player.position.copy(nextPos);
    this.player.position.y = Math.max(this.player.position.y, groundY + this.height);

    // Update camera position (eyes) + subtle run bob
    const horizSpeed = Math.hypot(this.velocity.x, this.velocity.z);
    if (this.onGround && horizSpeed > 1) {
      this.bobTime += dt * (6 + horizSpeed * 0.7);
    } else {
      this.bobTime = 0;
    }
    const bob = this.bobTime > 0 ? Math.sin(this.bobTime) * 0.03 * Math.min(1, horizSpeed / this.moveSpeed) : 0;
    this.camera.position.copy(this.player.position);
    this.camera.position.y += 0.15 + bob; // eye offset + bob

    // Update player mesh (for bots to see) — align feet to ground
    if (this.player.mesh) {
      this.player.mesh.position.copy(this.player.position);
      this.player.mesh.position.y -= this.height;
      this.player.mesh.rotation.y = this.yaw;
    }
  }

  // Small camera recoil kick (pitch up + random yaw), applied by WeaponSystem
  addRecoil(pitchKick, yawKick) {
    this.pitch = Math.min(Math.PI/2 - 0.1, this.pitch + pitchKick);
    this.yaw += yawKick;
  }

  takeDamage(amount) {
    if (!this.player.isAlive) return false;
    this.health -= amount;
    if (this.health <= 0) {
      this.health = 0;
      this.player.isAlive = false;
      return true; // died
    }
    return false;
  }

  respawn(pos) {
    const gy = this.map ? this.map.getGroundY(pos.x, pos.z) : 0;
    this.player.position.set(pos.x, gy + this.height, pos.z);
    this.velocity.set(0,0,0);
    this.health = this.maxHealth;
    this.player.isAlive = true;
  }
}
