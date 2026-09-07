// Input abstraction — PC and Mobile produce same actions.
// Touch layer: Pointer Events with per-pointer OWNERSHIP. One finger owns the
// joystick, another owns the look drag; buttons are independent pointers.
// Every owned state is released on pointerup/pointercancel/blur/orientation
// change — no stuck fire, no joystick glued after a system gesture takes the
// finger. Nothing here multiplies touchstart semantics (touches[0] ambiguity
// was the old bug: with two fingers down, both zones read the SAME touch).
import { settings } from './Settings.js';
import { controlLayout } from './ControlLayout.js';

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
    // Touch state exists before DOM binding so blur/pagehide are safe even
    // when the page is loaded without mobile controls or Pointer Events.
    this._firePointers = new Set();
    this._fireLook = { x: 0, y: 0 };
    this._joystickPointer = null;
    this._lookPointer = null;
    this.sprintLock = false;
    this.crouch = false;
    this._setupKeyboardMouse();
    this._setupTouch();
    // Safety net: any focus loss / visibility change / orientation flip must
    // release every owned pointer (stuck fire/joystick otherwise).
    window.addEventListener('blur', () => this._releaseAll());
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') this._releaseAll();
    });
    window.addEventListener('orientationchange', () => this._releaseAll());
    window.addEventListener('pagehide', () => this._releaseAll());
  }

  _releaseAll() {
    this._keys.clear();
    this._mouseDown = false;
    this._aimDown = false;
    this.fire = false;
    this.aim = false;
    this.reload = false;
    this.jump = false;
    this.switchWeapon = 0;
    this.move.x = 0;
    this.move.y = 0;
    this.look.x = 0;
    this.look.y = 0;
    this.sprint = false;
    this.sprintLock = false;
    this.crouch = false;
    if (this._jumpTimer) { clearTimeout(this._jumpTimer); this._jumpTimer = null; }
    if (this._firePointers) this._firePointers.clear();
    this._fireLook.x = 0;
    this._fireLook.y = 0;
    this._joystick.active = false;
    this._joystick.x = 0;
    this._joystick.y = 0;
    this._touchLook.active = false;
    this._touchLook.x = 0;
    this._touchLook.y = 0;
    this._joystickPointer = null;
    this._lookPointer = null;
    // Reset latched button visuals too (returning from background = clean slate)
    const aim = document.getElementById('btn-aim');
    const sprint = document.getElementById('btn-sprint');
    const crouch = document.getElementById('btn-crouch');
    if (aim) { aim.classList.remove('active'); }
    if (sprint) { sprint.classList.remove('active'); sprint.setAttribute('aria-pressed', 'false'); }
    if (crouch) crouch.classList.remove('active');
    const mc = document.getElementById('mobile-controls');
    if (mc) mc.classList.remove('aiming');
    const stick = document.getElementById('joystick-stick');
    if (stick) stick.style.transform = 'translate(-50%, -50%)';
  }

  _setupKeyboardMouse() {
    window.addEventListener('keydown', e => {
      this._keys.add(e.code);
      if (e.code === 'Space') this.jump = true;
      if (e.code === 'KeyR') this.reload = true;
      if (e.code === 'KeyC' && !e.repeat) this.crouch = !this.crouch; // crouch toggle
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
    const btnSprint = document.getElementById('btn-sprint');
    const btnCrouch = document.getElementById('btn-crouch');
    const btnFullscreen = document.getElementById('btn-fullscreen');

    if (!joystickZone || !window.PointerEvent) return;

    // ---- Fullscreen + landscape lock: el DOM deriva del estado REAL. ----
    if (btnFullscreen) {
      const enterIcon = '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>';
      const exitIcon = '<path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/>';
      const syncFullscreen = () => {
        const active = !!(document.fullscreenElement || document.webkitFullscreenElement);
        btnFullscreen.classList.toggle('is-fullscreen', active);
        btnFullscreen.setAttribute('aria-label', active ? 'Salir de pantalla completa' : 'Entrar en pantalla completa');
        btnFullscreen.title = active ? 'Salir de pantalla completa' : 'Pantalla completa';
        const svg = btnFullscreen.querySelector('svg');
        if (svg) svg.innerHTML = active ? exitIcon : enterIcon;
      };
      document.addEventListener('fullscreenchange', syncFullscreen);
      document.addEventListener('webkitfullscreenchange', syncFullscreen);
      syncFullscreen();
      const goFullscreen = async () => {
        const el = document.documentElement;
        const already = document.fullscreenElement || document.webkitFullscreenElement;
        try {
          if (already) {
            const exit = document.exitFullscreen || document.webkitExitFullscreen;
            if (exit) await exit.call(document);
            return;
          }
          const req = el.requestFullscreen || el.webkitRequestFullscreen || el.requestFullScreen || el.webkitRequestFullScreen;
          if (!req) throw new Error('Fullscreen API unavailable');
          const p = req.call(el, { navigationUI: 'hide' });
          if (p && p.catch) await p;
          // Landscape is a permanent project rule: lock it while fullscreen.
          const so = screen.orientation && (screen.orientation.lock || screen.lockOrientation);
          if (so) { try { so.call(screen.orientation || screen, 'landscape'); } catch(e){} }
          syncFullscreen();
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
      if (controlLayout.editMode) return; // el editor arrastra la base/joystick
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
    joystickZone.addEventListener('lostpointercapture', joystickRelease);

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
    lookZone.addEventListener('lostpointercapture', lookRelease);

    // ---- Action buttons: each is its own pointer; cancel releases ----
    // Fire (both buttons): hold to fire, DRAG to aim — the Free Fire gesture.
    // The drag deltas feed their OWN accumulator (not the look zone's) so
    // releasing the look-zone finger can never wipe pending fire-drag deltas.
    // PlayerController's getLookDelta sums both and applies sensitivity once.
    // En MODO EDICIÓN el control NO ejecuta gameplay (el editor arrastra).
    this._firePointers = new Set();
    this._fireLook = { x: 0, y: 0 };
    const bindFire = (el) => {
      if (!el) return;
      let lastX = 0, lastY = 0;
      el.addEventListener('pointerdown', e => {
        if (controlLayout.editMode) return;
        e.preventDefault();
        this._firePointers.add(e.pointerId);
        this.fire = true;
        lastX = e.clientX; lastY = e.clientY;
        try { el.setPointerCapture(e.pointerId); } catch (err) {}
      });
      el.addEventListener('pointermove', e => {
        if (!this._firePointers.has(e.pointerId)) return;
        e.preventDefault();
        this._fireLook.x += (e.clientX - lastX);
        this._fireLook.y += (e.clientY - lastY);
        lastX = e.clientX; lastY = e.clientY;
      });
      const release = e => {
        if (!this._firePointers.has(e.pointerId)) return;
        this._firePointers.delete(e.pointerId);
        this.fire = this._firePointers.size > 0;
      };
      el.addEventListener('pointerup', release);
      el.addEventListener('pointercancel', release);
      el.addEventListener('lostpointercapture', release);
    };
    bindFire(btnFire);
    bindFire(document.getElementById('btn-fire-left'));

    // ---- ADS: TAP TO LATCH (not hold). Holding the aim button used to eat
    // the whole right thumb on real devices (implicit pointer capture): with
    // two thumbs there was no finger left to move the camera. Tap = ADS on,
    // tap again = off. The thumb is free to fire/look meanwhile.
    this._setAim = (on) => {
      this.aim = on;
      if (btnAim) btnAim.classList.toggle('active', on);
      const mc = document.getElementById('mobile-controls');
      if (mc) mc.classList.toggle('aiming', on);
    };
    if (btnAim) btnAim.addEventListener('pointerdown', e => {
      if (controlLayout.editMode) return;
      e.preventDefault();
      this._setAim(!this.aim);
    });

    // ---- Sprint lock: tap to latch (joystick-edge sprint still works) ----
    this.sprintLock = false;
    if (btnSprint) {
      btnSprint.addEventListener('pointerdown', e => {
        if (controlLayout.editMode) return;
        e.preventDefault();
        this.sprintLock = !this.sprintLock;
        btnSprint.classList.toggle('active', this.sprintLock);
        btnSprint.setAttribute('aria-pressed', String(this.sprintLock));
      });
    }

    // ---- Crouch latch: tap to crouch, tap to stand (PC: KeyC toggle) ----
    this.crouch = false;
    if (btnCrouch) {
      btnCrouch.addEventListener('pointerdown', e => {
        if (controlLayout.editMode) return;
        e.preventDefault();
        this.crouch = !this.crouch;
        btnCrouch.classList.toggle('active', this.crouch);
      });
    }

    const bindButton = (el, onDown, onUp) => {
      if (!el) return;
      el.addEventListener('pointerdown', e => {
        if (controlLayout.editMode) return;
        e.preventDefault();
        try { el.setPointerCapture(e.pointerId); } catch (err) {}
        onDown();
      });
      const up = e => { e.preventDefault(); onUp(); };
      el.addEventListener('pointerup', up);
      el.addEventListener('pointercancel', up);
      el.addEventListener('lostpointercapture', () => onUp());
    };
    bindButton(btnJump, () => {
      this.jump = true;
      if (this._jumpTimer) clearTimeout(this._jumpTimer);
      this._jumpTimer = setTimeout(() => { this.jump = false; this._jumpTimer = null; }, 120);
    }, () => {});
    // Reload/switch are one-frame intents. Clearing reload on pointerup made
    // quick taps disappear before the next rAF on real touch hardware.
    bindButton(btnReload, () => this.reload = true, () => {});
    // 'next' cycles rifle → pistol → shotgun; a fixed slot (pistol) made the
    // button a dead end for mobile players on the other two weapons.
    bindButton(btnSwitch, () => this.switchWeapon = 'next', () => {});

    // ---- Control layout: ControlLayout.js es el dueño (posición fracción
    // 0..1, tamaño y opacidad por control, persistencia normalizada). Input
    // solo lo aplica y delega el modo edición en él.
    this.editMode = false; // lectura pública: Game/config consultan el estado
    Object.defineProperty(this, 'editMode', {
      get: () => controlLayout.editMode,
      set: (v) => controlLayout.setEditMode(!!v),
    });
    this.setEditMode = (on) => controlLayout.setEditMode(on);
    this.applyLayout = () => controlLayout.apply();

    // Player-configurable control scale/opacity (lobby settings panel).
    this.applyControlSettings = () => {
      controlLayout.apply();
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
      // Mild expo curve: fine control near center (aim while walking), full
      // speed at the edge. Keyboard stays digital.
      const ex = (v) => Math.sign(v) * Math.pow(Math.abs(v), 1.45);
      mx = ex(this._joystick.x);
      my = ex(this._joystick.y) * -1; // invert Y: up is forward
    } else if (mx !== 0 || my !== 0) {
      const len = Math.hypot(mx, my);
      mx /= len; my /= len;
    }

    this.move.x = mx;
    this.move.y = my;

    // Sprint: Shift on PC, the CORRER lock button on touch, or the joystick
    // pinned at full push (≥0.95) — all three coexist.
    this.sprint = this.sprintLock === true
      || this._keys.has('ShiftLeft') || this._keys.has('ShiftRight')
      || (this._joystick.active && Math.hypot(this._joystick.x, this._joystick.y) >= 0.95);
  }

  consumeOneFrameActions() {
    const reload = this.reload;
    const switchW = this.switchWeapon;
    this.reload = false;
    this.switchWeapon = 0;
    return { reload, switchW };
  }

  // Raw pixels accumulated since last frame from BOTH sources (look-zone
  // drag + fire-button drag); consume-and-clear. No decay, no frame-rate
  // dependence — the consumer applies the configured scale exactly once.
  // Contrato: devuelve SIEMPRE el mismo objeto interno (_lookDeltaOut) — el
  // consumidor lo lee al instante, jamás lo retiene (cero allocs por frame).
  getLookDelta() {
    const look = this._touchLook;
    const fire = this._fireLook;
    const out = this._lookDeltaOut || (this._lookDeltaOut = { x: 0, y: 0 });
    if (look.active || look.x !== 0 || look.y !== 0 || fire.x !== 0 || fire.y !== 0) {
      out.x = look.x + fire.x;
      out.y = look.y + fire.y;
      look.x = 0; look.y = 0;
      fire.x = 0; fire.y = 0;
      return out;
    }
    out.x = 0; out.y = 0;
    return out;
  }
}
