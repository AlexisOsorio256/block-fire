// Input abstraction — PC and Mobile produce same actions.
// Touch layer: Pointer Events with per-pointer OWNERSHIP. One finger owns the
// joystick, another owns the look drag; buttons are independent pointers.
// Every owned state is released on pointerup/pointercancel/blur/orientation
// change — no stuck fire, no joystick glued after a system gesture takes the
// finger. Nothing here multiplies touchstart semantics (touches[0] ambiguity
// was the old bug: with two fingers down, both zones read the SAME touch).
import { settings } from './Settings.js';

export class Input {
  constructor() {
    this.move = { x: 0, y: 0 };
    this.look = { x: 0, y: 0 };
    this.fire = false;
    this.aim = false;
    this.jump = false;
    this.sprint = false; // Shift held (PC) or joystick at full push (mobile)
    this.reload = false;
    this.switchWeapon = 0; // -1, 'next', or weapon slot 1-3
    this._keys = new Set();
    this._mouseDown = false;
    this._aimDown = false;
    this._touchLook = { x: 0, y: 0, active: false };
    this._joystick = { x: 0, y: 0, active: false };
    this._jumpTimer = null;
    this._setupKeyboardMouse();
    this._setupTouch();
    // Safety net: any focus loss / visibility change / orientation flip must
    // release every owned pointer (stuck fire/joystick otherwise).
    window.addEventListener('blur', () => this._releaseAll());
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') this._releaseAll();
    });
    window.addEventListener('orientationchange', () => this._releaseAll());
  }

  _releaseAll() {
    this.fire = false;
    this.aim = false;
    this.reload = false;
    this.jump = false;
    if (this._jumpTimer) { clearTimeout(this._jumpTimer); this._jumpTimer = null; }
    this._joystick.active = false;
    this._joystick.x = 0;
    this._joystick.y = 0;
    this._touchLook.active = false;
    this._touchLook.x = 0;
    this._touchLook.y = 0;
    this._joystickPointer = null;
    this._lookPointer = null;
    const stick = document.getElementById('joystick-stick');
    if (stick) stick.style.transform = 'translate(-50%, -50%)';
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
      if (e.code === 'KeyE') this.switchWeapon = 'next';
    });
    window.addEventListener('keyup', e => {
      this._keys.delete(e.code);
      if (e.code === 'Space') this.jump = false;
    });
    // PC fire/aim via mouse. Buttons 0/2 only; pointer-lock look is handled by
    // PlayerController (document mousemove). Guarded by target so a click on a
    // lobby button can't fire the weapon.
    window.addEventListener('mousedown', e => {
      if (e.target && e.target.closest && e.target.closest('#overlay, #mobile-controls, #test-overlay')) return;
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
    const btnFullscreen = document.getElementById('btn-fullscreen');

    if (!joystickZone || !window.PointerEvent) return;

    // ---- Fullscreen + landscape lock (unchanged behavior, pointer-safe) ----
    if (btnFullscreen) {
      const goFullscreen = async () => {
        const el = document.documentElement;
        const already = document.fullscreenElement || document.webkitFullscreenElement;
        try {
          if (already) {
            (document.exitFullscreen || document.webkitExitFullscreen).call(document);
            return;
          }
          const req = el.requestFullscreen || el.webkitRequestFullscreen || el.requestFullScreen || el.webkitRequestFullScreen;
          if (!req) throw new Error('Fullscreen API unavailable');
          const p = req.call(el, { navigationUI: 'hide' });
          if (p && p.catch) await p;
          // Landscape is a permanent project rule: lock it while fullscreen.
          const so = screen.orientation && (screen.orientation.lock || screen.lockOrientation);
          if (so) { try { so.call(screen.orientation || screen, 'landscape'); } catch(e){} }
        } catch (err) {
          btnFullscreen.title = err.message || 'fullscreen failed';
          const label = document.createElement('div');
          label.textContent = 'Pantalla completa no disponible aquí. Prueba localhost o instalá la app.';
          label.style.cssText = 'position:absolute;top:46px;right:12px;background:rgba(0,0,0,.75);color:#fff;font-size:11px;padding:6px 10px;border-radius:8px;z-index:9;max-width:220px';
          btnFullscreen.parentElement.appendChild(label);
          setTimeout(()=> label.remove(), 3200);
        }
      };
      btnFullscreen.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); goFullscreen(); });
    }

    // ---- Joystick: first pointer in the zone owns it until up/cancel ----
    let joystickOrigin = { x: 0, y: 0 };
    this._joystickPointer = null;

    const joystickMove = (x, y) => {
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
    const joystickEnd = () => {
      this._joystickPointer = null;
      this._joystick.active = false;
      this._joystick.x = 0;
      this._joystick.y = 0;
      if (joystickStick) joystickStick.style.transform = 'translate(-50%, -50%)';
    };

    joystickZone.addEventListener('pointerdown', e => {
      e.preventDefault();
      if (this._joystickPointer !== null) return; // already owned by a finger
      this._joystickPointer = e.pointerId;
      this._joystick.active = true;
      const rect = joystickBase.getBoundingClientRect();
      joystickOrigin.x = rect.left + rect.width / 2;
      joystickOrigin.y = rect.top + rect.height / 2;
      try { joystickZone.setPointerCapture(e.pointerId); } catch (err) {}
      joystickMove(e.clientX, e.clientY);
    });
    joystickZone.addEventListener('pointermove', e => {
      if (e.pointerId !== this._joystickPointer) return;
      e.preventDefault();
      joystickMove(e.clientX, e.clientY);
    });
    const joystickRelease = e => {
      if (e.pointerId !== this._joystickPointer) return;
      e.preventDefault();
      joystickEnd();
    };
    joystickZone.addEventListener('pointerup', joystickRelease);
    joystickZone.addEventListener('pointercancel', joystickRelease);

    // ---- Look zone: separate pointer, same ownership contract ----
    let lastLookX = 0, lastLookY = 0;
    this._lookPointer = null;

    lookZone.addEventListener('pointerdown', e => {
      e.preventDefault();
      if (this._lookPointer !== null) return;
      this._lookPointer = e.pointerId;
      this._touchLook.active = true;
      lastLookX = e.clientX;
      lastLookY = e.clientY;
      try { lookZone.setPointerCapture(e.pointerId); } catch (err) {}
    });
    lookZone.addEventListener('pointermove', e => {
      if (e.pointerId !== this._lookPointer) return;
      e.preventDefault();
      // Accumulate raw deltas; consumed (and cleared) by getLookDelta each frame.
      this._touchLook.x += (e.clientX - lastLookX);
      this._touchLook.y += (e.clientY - lastLookY);
      lastLookX = e.clientX;
      lastLookY = e.clientY;
    });
    const lookRelease = e => {
      if (e.pointerId !== this._lookPointer) return;
      e.preventDefault();
      this._lookPointer = null;
      this._touchLook.active = false;
      this._touchLook.x = 0;
      this._touchLook.y = 0;
    };
    lookZone.addEventListener('pointerup', lookRelease);
    lookZone.addEventListener('pointercancel', lookRelease);

    // ---- Action buttons: each is its own pointer; cancel releases ----
    const bindButton = (el, onDown, onUp) => {
      if (!el) return;
      el.addEventListener('pointerdown', e => { e.preventDefault(); onDown(); });
      const up = e => { e.preventDefault(); onUp(); };
      el.addEventListener('pointerup', up);
      el.addEventListener('pointercancel', up);
      el.addEventListener('lostpointercapture', () => onUp());
    };
    bindButton(btnFire, () => this.fire = true, () => this.fire = false);
    bindButton(btnAim, () => this.aim = true, () => this.aim = false);
    bindButton(btnJump, () => {
      this.jump = true;
      if (this._jumpTimer) clearTimeout(this._jumpTimer);
      this._jumpTimer = setTimeout(() => { this.jump = false; this._jumpTimer = null; }, 120);
    }, () => {});
    bindButton(btnReload, () => this.reload = true, () => this.reload = false);
    // 'next' cycles rifle → pistol → shotgun; a fixed slot (pistol) made the
    // button a dead end for mobile players on the other two weapons.
    bindButton(btnSwitch, () => this.switchWeapon = 'next', () => {});

    // Player-configurable control scale/opacity (lobby settings panel).
    this.applyControlSettings = () => {
      const mc = document.getElementById('mobile-controls');
      if (!mc) return;
      const scale = settings.get('btnScale');
      const opacity = settings.get('btnOpacity');
      mc.style.setProperty('--btn-scale', String(scale));
      mc.style.setProperty('--btn-opacity', String(opacity));
    };
    this.applyControlSettings();
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

    // Sprint: Shift on PC; on mobile the joystick pinned at full push (≥0.95)
    // counts as sprint — zero extra buttons, standard mobile-FPS gesture.
    this.sprint = this._keys.has('ShiftLeft') || this._keys.has('ShiftRight')
      || (this._joystick.active && Math.hypot(this._joystick.x, this._joystick.y) >= 0.95);
  }

  consumeOneFrameActions() {
    const reload = this.reload;
    const switchW = this.switchWeapon;
    this.reload = false;
    this.switchWeapon = 0;
    return { reload, switchW };
  }

  // Raw pixels accumulated since last frame; consume-and-clear. No decay, no
  // frame-rate dependence — the consumer applies the configured scale.
  getLookDelta() {
    if (this._touchLook.active || this._touchLook.x !== 0 || this._touchLook.y !== 0) {
      const x = this._touchLook.x;
      const y = this._touchLook.y;
      this._touchLook.x = 0;
      this._touchLook.y = 0;
      return { x, y };
    }
    return { x: 0, y: 0 };
  }
}
