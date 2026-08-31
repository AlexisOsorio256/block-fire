// Input abstraction — PC and Mobile produce same actions
// No duplication in PlayerController

export class Input {
  constructor() {
    this.move = { x: 0, y: 0 };
    this.look = { x: 0, y: 0 };
    this.fire = false;
    this.aim = false;
    this.jump = false;
    this.reload = false;
    this.switchWeapon = 0; // -1, 0, 1, or weapon index 1-3
    this._keys = new Set();
    this._mouseDown = false;
    this._aimDown = false;
    this._touchLook = { x: 0, y: 0, active: false };
    this._joystick = { x: 0, y: 0, active: false };
    this._setupKeyboardMouse();
    this._setupTouch();
  }

  _setupKeyboardMouse() {
    window.addEventListener('keydown', e => {
      this._keys.add(e.code);
      if (e.code === 'Space') this.jump = true;
      if (e.code === 'KeyR') this.reload = true;
      if (e.code === 'Digit1') this.switchWeapon = 1;
      if (e.code === 'Digit2') this.switchWeapon = 2;
      if (e.code === 'Digit3') this.switchWeapon = 3;
      if (e.code === 'KeyQ') this.switchWeapon = -1;
      if (e.code === 'KeyE') this.switchWeapon = 1;
    });
    window.addEventListener('keyup', e => {
      this._keys.delete(e.code);
      if (e.code === 'Space') this.jump = false;
    });
    // Mouse look handled via pointer lock in CameraController, but we capture deltas here for fallback
    window.addEventListener('mousedown', e => {
      if (e.button === 0) { this._mouseDown = true; this.fire = true; }
      if (e.button === 2) { this._aimDown = true; this.aim = true; }
    });
    window.addEventListener('mouseup', e => {
      if (e.button === 0) { this._mouseDown = false; this.fire = false; }
      if (e.button === 2) { this._aimDown = false; this.aim = false; }
    });
    window.addEventListener('contextmenu', e => e.preventDefault());
  }

  _setupTouch() {
    const joystickZone = document.getElementById('joystick-zone');
    const joystickBase = document.getElementById('joystick-base');
    const joystickStick = document.getElementById('joystick-stick');
    const lookZone = document.getElementById('look-zone');
    const btnFire = document.getElementById('btn-fire');
    const btnAim = document.getElementById('btn-aim');
    const btnJump = document.getElementById('btn-jump');
    const btnReload = document.getElementById('btn-reload');
    const btnSwitch = document.getElementById('btn-switch');

    if (!joystickZone) return;

    // Joystick
    let joystickActive = false;
    let joystickOrigin = { x: 0, y: 0 };

    const handleJoystickStart = (x, y) => {
      joystickActive = true;
      this._joystick.active = true;
      const rect = joystickBase.getBoundingClientRect();
      joystickOrigin.x = rect.left + rect.width / 2;
      joystickOrigin.y = rect.top + rect.height / 2;
      handleJoystickMove(x, y);
    };
    const handleJoystickMove = (x, y) => {
      if (!joystickActive) return;
      let dx = x - joystickOrigin.x;
      let dy = y - joystickOrigin.y;
      const dist = Math.hypot(dx, dy);
      const maxDist = 42;
      if (dist > maxDist) {
        dx = (dx / dist) * maxDist;
        dy = (dy / dist) * maxDist;
      }
      this._joystick.x = dx / maxDist;
      this._joystick.y = dy / maxDist;
      if (joystickStick) {
        joystickStick.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
      }
    };
    const handleJoystickEnd = () => {
      joystickActive = false;
      this._joystick.active = false;
      this._joystick.x = 0;
      this._joystick.y = 0;
      if (joystickStick) joystickStick.style.transform = 'translate(-50%, -50%)';
    };

    joystickZone.addEventListener('touchstart', e => {
      e.preventDefault();
      const t = e.touches[0];
      handleJoystickStart(t.clientX, t.clientY);
    }, { passive: false });
    joystickZone.addEventListener('touchmove', e => {
      e.preventDefault();
      const t = e.touches[0];
      handleJoystickMove(t.clientX, t.clientY);
    }, { passive: false });
    joystickZone.addEventListener('touchend', e => {
      e.preventDefault();
      handleJoystickEnd();
    });
    // Mouse fallback for joystick (for testing on PC)
    joystickZone.addEventListener('mousedown', e => handleJoystickStart(e.clientX, e.clientY));
    window.addEventListener('mousemove', e => {
      if (joystickActive) handleJoystickMove(e.clientX, e.clientY);
    });
    window.addEventListener('mouseup', () => {
      if (joystickActive) handleJoystickEnd();
    });

    // Look zone (right side drag for camera)
    let lookActive = false;
    let lastLookX = 0, lastLookY = 0;
    lookZone.addEventListener('touchstart', e => {
      e.preventDefault();
      lookActive = true;
      this._touchLook.active = true;
      const t = e.touches[0];
      lastLookX = t.clientX;
      lastLookY = t.clientY;
    }, { passive: false });
    lookZone.addEventListener('touchmove', e => {
      e.preventDefault();
      if (!lookActive) return;
      const t = e.touches[0];
      const dx = t.clientX - lastLookX;
      const dy = t.clientY - lastLookY;
      this._touchLook.x = dx * 0.6;
      this._touchLook.y = dy * 0.6;
      lastLookX = t.clientX;
      lastLookY = t.clientY;
    }, { passive: false });
    lookZone.addEventListener('touchend', e => {
      e.preventDefault();
      lookActive = false;
      this._touchLook.active = false;
      this._touchLook.x = 0;
      this._touchLook.y = 0;
    });

    // Buttons
    const bindButton = (el, onDown, onUp) => {
      if (!el) return;
      el.addEventListener('touchstart', e => { e.preventDefault(); onDown(); }, { passive: false });
      el.addEventListener('touchend', e => { e.preventDefault(); onUp(); });
      el.addEventListener('mousedown', e => { e.preventDefault(); onDown(); });
      el.addEventListener('mouseup', e => { e.preventDefault(); onUp(); });
      el.addEventListener('mouseleave', () => onUp());
    };
    bindButton(btnFire, () => this.fire = true, () => this.fire = false);
    bindButton(btnAim, () => this.aim = true, () => this.aim = false);
    bindButton(btnJump, () => this.jump = true, () => setTimeout(()=>this.jump=false, 120));
    bindButton(btnReload, () => this.reload = true, () => this.reload = false);
    bindButton(btnSwitch, () => this.switchWeapon = 1, () => {});
  }

  // Called each frame to compute final move vector from keys + joystick
  update() {
    // Keyboard move
    let mx = 0, my = 0;
    if (this._keys.has('KeyW') || this._keys.has('ArrowUp')) my += 1;
    if (this._keys.has('KeyS') || this._keys.has('ArrowDown')) my -= 1;
    if (this._keys.has('KeyA') || this._keys.has('ArrowLeft')) mx -= 1;
    if (this._keys.has('KeyD') || this._keys.has('ArrowRight')) mx += 1;

    // Joystick overrides/ blends if active
    if (this._joystick.active) {
      mx = this._joystick.x;
      my = -this._joystick.y; // invert Y: up is forward
    } else if (mx !== 0 || my !== 0) {
      const len = Math.hypot(mx, my);
      mx /= len; my /= len;
    }

    this.move.x = mx;
    this.move.y = my;

    // Look is handled separately via mouse delta + touchLook, but we expose touchLook for CameraController
    // For PC mouse, look delta comes from pointer lock movement (handled in CameraController)
    // Here we just provide touchLook for mobile

    // One-frame actions: reload/switch should be consumed
    // Keep them true for one frame, then reset in Game after reading
  }

  consumeOneFrameActions() {
    const reload = this.reload;
    const switchW = this.switchWeapon;
    this.reload = false;
    this.switchWeapon = 0;
    return { reload, switchW };
  }

  // For CameraController to get look delta
  getLookDelta() {
    if (this._touchLook.active) {
      const x = this._touchLook.x;
      const y = this._touchLook.y;
      this._touchLook.x *= 0.5; // damp
      this._touchLook.y *= 0.5;
      return { x, y };
    }
    return { x: 0, y: 0 };
  }
}
