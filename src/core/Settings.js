// Player settings — ONE source of truth for user preferences (localStorage).
// Every consumer reads live values through the singleton; the lobby settings
// panel writes through Settings.set(). Ranges are clamped at one place.
// Nothing here talks to gameplay logic — pure data with persistence.

const KEY = 'bf_settings';

const DEFAULTS = {
  sensMul: 1.0,     // camera look multiplier (PC mouse + mobile drag)
  adsMul: 0.75,     // look multiplier while aiming down sights
  btnScale: 1.0,    // mobile action-button scale (0.8..1.4)
  btnOpacity: 1.0,  // mobile control opacity (0.4..1.0)
  btnPos: {},       // per-button drag offsets: { btnId: [dx, dy] }
};

const RANGES = {
  sensMul: [0.3, 2.0],
  adsMul: [0.3, 1.0],
  btnScale: [0.8, 1.4],
  btnOpacity: [0.4, 1.0],
};

class Settings {
  constructor() {
    this._values = { ...DEFAULTS };
    this._listeners = [];
    this._load();
  }

  _load() {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY) || '{}');
      for (const k of Object.keys(DEFAULTS)) {
        if (k === 'btnPos') {
          // btnPos: only sane numeric pairs survive a load
          if (raw.btnPos && typeof raw.btnPos === 'object') {
            for (const [id, v] of Object.entries(raw.btnPos)) {
              if (Array.isArray(v) && v.length === 2 && v.every(n => typeof n === 'number' && isFinite(n))) {
                this._values.btnPos[id] = this.clampBtnPos(v[0], v[1]);
              }
            }
          }
          continue;
        }
        if (typeof raw[k] === 'number' && isFinite(raw[k])) {
          this._values[k] = this._clamp(k, raw[k]);
        }
      }
    } catch (e) { /* corrupt storage → defaults */ }
  }

  get(name) { return this._values[name]; }

  // Button drag offsets — the in-match layout editor writes through here.
  getBtnPos(id) {
    return this._values.btnPos[id] || [0, 0];
  }

  setBtnPos(id, dx, dy) {
    const c = this.clampBtnPos(dx, dy);
    this._values.btnPos[id] = c;
    this._persist();
  }

  resetBtnPos() {
    this._values.btnPos = {};
    this._persist();
  }

  clampBtnPos(dx, dy) {
    const L = 170, V = 120; // px, keeps any button on-screen from its anchor
    return [Math.max(-L, Math.min(L, Math.round(dx))), Math.max(-V, Math.min(V, Math.round(dy)))];
  }

  set(name, value) {
    if (!(name in DEFAULTS)) return;
    const v = this._clamp(name, value);
    if (v === this._values[name]) return;
    this._values[name] = v;
    this._persist();
    this._listeners.forEach(fn => fn(name, v));
  }

  _persist() {
    try { localStorage.setItem(KEY, JSON.stringify(this._values)); } catch (e) { /* private mode */ }
  }

  reset() {
    for (const k of Object.keys(DEFAULTS)) {
      if (k === 'btnPos') continue;
      this.set(k, DEFAULTS[k]);
    }
    this.resetBtnPos();
  }

  isDefault() {
    return Object.keys(DEFAULTS).every(k => k === 'btnPos' || this._values[k] === DEFAULTS[k]);
  }

  _clamp(name, v) {
    const [min, max] = RANGES[name];
    return Math.min(max, Math.max(min, v));
  }

  onChange(fn) { this._listeners.push(fn); }
}

export const settings = new Settings();
