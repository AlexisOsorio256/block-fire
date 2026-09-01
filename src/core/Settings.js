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
        if (typeof raw[k] === 'number' && isFinite(raw[k])) {
          this._values[k] = this._clamp(k, raw[k]);
        }
      }
    } catch (e) { /* corrupt storage → defaults */ }
  }

  get(name) { return this._values[name]; }

  set(name, value) {
    if (!(name in DEFAULTS)) return;
    const v = this._clamp(name, value);
    if (v === this._values[name]) return;
    this._values[name] = v;
    try { localStorage.setItem(KEY, JSON.stringify(this._values)); } catch (e) { /* private mode */ }
    this._listeners.forEach(fn => fn(name, v));
  }

  reset() {
    for (const k of Object.keys(DEFAULTS)) this.set(k, DEFAULTS[k]);
  }

  isDefault() {
    return Object.keys(DEFAULTS).every(k => this._values[k] === DEFAULTS[k]);
  }

  _clamp(name, v) {
    const [min, max] = RANGES[name];
    return Math.min(max, Math.max(min, v));
  }

  onChange(fn) { this._listeners.push(fn); }
}

export const settings = new Settings();
