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
    this.maxHealth = 125;

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
    this._landPunch = 0;    // camera dip on landing (never undefined → no NaN)

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

    // Mobile look from touch — raw pixel delta, fixed scale.
    // ~0.0038 rad/px: a full swipe across a 400px-tall screen ≈ 87°, matching
    // standard mobile FPS feel. Dead zone ignores sub-pixel finger jitter.
    const touchLook = this.input.getLookDelta();
    const DEAD = 0.6; // px
    if (Math.abs(touchLook.x) > DEAD || Math.abs(touchLook.y) > DEAD) {
      this.yaw -= touchLook.x * 0.0038;
      this.pitch -= touchLook.y * 0.0038;
      this.pitch = Math.max(-Math.PI/2 + 0.1, Math.min(Math.PI/2 - 0.1, this.pitch));
    }

    // Apply rotation to camera — yaw/pitch + subtle strafe roll.
    // Recoil spring: returns the aim toward where the player was pointing.
    // _recoilReturn is the exact pitch still owed; recovery consumes from it
    // and can never overshoot below the original aim.
    if ((this._recoilReturn || 0) > 0.0004) {
      const use = Math.min(this._recoilReturn, this._recoilReturn * dt * 9);
      this.pitch -= use;
      this._recoilReturn -= use;
      if (this._recoilReturn < 0.0004) this._recoilReturn = 0;
    }
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
    // In the air the wish speed caps at ~85% of ground speed: jumps keep
    // momentum but a mid-air direction change can't reach full strafe —
    // the movement reads as committed, not ice-skating.
    const speedCap = this.onGround ? speed : speed * 0.85;
    const wishVel = wishDir.multiplyScalar(speedCap);

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
      // Takeoff blip: the rising sample belongs to the jump itself. It used to
      // fire on landing, where the camera dip already carries the feedback.
      if (this.audio) this.audio.play('jump');
    }
    this.velocity.y -= this.gravity * dt;

    // Apply movement with simple collision against map
    const nextPos = this.player.position.clone().addScaledVector(this.velocity, dt);

    // Ground resolve BEFORE wall checks: know the floor under the full next position
    const groundY = this.map ? this.map.getGroundY(nextPos.x, nextPos.z, nextPos.y - this.height) : 0;

    // Axis-separated movement resolution: try each axis independently from
    // the CURRENT position; an axis only moves if its result is collision-free.
    // This cannot tunnel through geometry (each step is validated) and slides
    // naturally along walls.
    const cand = this.player.position.clone();
    // Y axis (gravity/jump)
    cand.y = nextPos.y;
    if (cand.y - this.height < groundY) {
      const wasFalling = this.velocity.y < -3; // meaningful fall → landing punch
      cand.y = groundY + this.height;
      if (wasFalling && !this.onGround) {
        this._landPunch = 0.09; // camera dip on landing (feedback is the dip, not a sound)
      }
      this.velocity.y = Math.max(0, this.velocity.y);
      this.onGround = true;
    } else {
      this.onGround = false;
    }

    // X axis
    const tryX = cand.clone(); tryX.x = nextPos.x;
    if (!this.map || !this.map.checkCollision(tryX, this.radius, this.height)) {
      cand.x = tryX.x;
    } else {
      this.velocity.x = 0;
    }
    // Z axis
    const tryZ = cand.clone(); tryZ.z = nextPos.z;
    if (!this.map || !this.map.checkCollision(tryZ, this.radius, this.height)) {
      cand.z = tryZ.z;
    } else {
      this.velocity.z = 0;
    }
    // Final safety: if the combined position is somehow inside geometry
    // (corner cases), revert to the previous safe position.
    if (this.map && this.map.checkCollision(cand, this.radius, this.height)) {
      cand.copy(this.player.position);
      this.velocity.x = 0; this.velocity.z = 0;
    }
    this.player.position.copy(cand);

    // Update camera position (eyes) + subtle run bob + landing punch
    const horizSpeed = Math.hypot(this.velocity.x, this.velocity.z);
    if (this.onGround && horizSpeed > 1) {
      const prevBob = this.bobTime;
      this.bobTime += dt * (6 + horizSpeed * 0.7);
      // Footstep on each bob cycle downswing (sin crosses zero downward):
      // soft pace when walking, faster when sprinting — synced to the camera.
      if (Math.floor(prevBob / Math.PI) !== Math.floor(this.bobTime / Math.PI)) {
        if (this.audio) this.audio.play('step');
      }
    } else {
      this.bobTime = 0;
    }
    if (this._landPunch > 0) this._landPunch = Math.max(0, this._landPunch - dt * 0.5);
    const bob = this.bobTime > 0 ? Math.sin(this.bobTime) * 0.03 * Math.min(1, horizSpeed / this.moveSpeed) : 0;
    this.camera.position.copy(this.player.position);
    this.camera.position.y += 0.15 + bob - this._landPunch; // eye offset + bob - land dip

    // Update player mesh (for bots to see) — align feet to ground
    if (this.player.mesh) {
      this.player.mesh.position.copy(this.player.position);
      this.player.mesh.position.y -= this.height;
      this.player.mesh.rotation.y = this.yaw;
    }
  }

  // Small camera recoil kick (pitch up + random yaw), applied by WeaponSystem
  // Camera recoil kick: pitch up + random yaw. _recoilReturn accumulates the
  // exact pitch owed; the spring in update() pays it back over time (punch +
  // settle, no permanent rise, no overshoot).
  addRecoil(pitchKick, yawKick) {
    this.pitch = Math.min(Math.PI/2 - 0.1, this.pitch + pitchKick);
    this.yaw += yawKick;
    this._recoilReturn = Math.min(0.35, (this._recoilReturn || 0) + pitchKick);
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
