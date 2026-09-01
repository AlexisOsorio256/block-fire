// AudioManager — real CC0 samples (Kenney) with procedural WebAudio fallback.
// Assets live in assets/sfx/*.ogg (see CREDITS.md). If a sample fails to load
// (offline, missing file), the procedural synth plays instead — audio never
// breaks, it just degrades.
export class AudioManager {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.masterGain = null;
    this._buffers = new Map();     // name -> AudioBuffer (decoded sample)
    this._loading = new Map();     // name -> Promise
    this._noiseBuffer = null;
    this._base = 'assets/sfx/';
  }

  init() {
    if (this.ctx) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.55;
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.knee.value = 22;
      comp.ratio.value = 8;
      comp.attack.value = 0.002;
      comp.release.value = 0.12;
      this.masterGain.connect(comp);
      comp.connect(this.ctx.destination);
      // 1s of white noise for procedural fallbacks
      const len = this.ctx.sampleRate;
      this._noiseBuffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = this._noiseBuffer.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      // Kick off sample loading (fire-and-forget; sounds that aren't ready
      // yet use the procedural synth transparently)
      this._preload();
    } catch (e) {
      this.enabled = false;
      console.warn('WebAudio not supported', e);
    }
  }

  _preload() {
    // name -> [file, volume] for every real sample we ship.
    // Gunshots: real CC-BY recordings (Jesús Lastra, see CREDITS.md) — one
    // DISTINCT sample per weapon (rifle mechanical 380ms / pistol dry 255ms /
    // shotgun heavy 600ms). The old approach pitch-shifted one sci-fi laser
    // for all three; real identity needs real sources.
    this._manifest = {
      'shoot-rifle':   ['gshot_rifle.ogg', 0.55],
      'shoot-shotgun': ['gshot_shotgun.ogg', 0.72],
      'shoot-pistol':  ['gshot_pistol.ogg', 0.55],
      'hit':           ['hit.ogg', 0.55],
      'hitmarker':     ['hitmarker.ogg', 0.5],
      'impact_wall':   ['impact_wall.ogg', 0.5],
      'kill':          ['kill.ogg', 0.6],
      'hurt':          ['hurt.ogg', 0.5],
      'ui':            ['ui.ogg', 0.6],
      'kill_banner':   ['kill_banner.ogg', 0.6],
      'respawn':       ['respawn.ogg', 0.55],
      'reloadStart':   ['reload_start.ogg', 0.55],
      'reloadEnd':     ['reload_end.ogg', 0.55],
      'switch':        ['switch.ogg', 0.5],
      'jump':          ['jump.ogg', 0.4],
      'empty':         ['empty.ogg', 0.5],
      'step1':          ['step.ogg', 0.28],
      'step2':          ['step2.ogg', 0.28],
    };
    for (const [key, [file]] of Object.entries(this._manifest)) {
      const p = fetch(this._base + file)
        .then(r => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
        .then(ab => this.ctx.decodeAudioData(ab))
        .then(buf => { this._buffers.set(key, buf); })
        .catch(err => { /* missing sample → procedural fallback covers it */ console.warn(`[sfx] ${file} no cargó:`, err && err.message); });
      this._loading.set(key, p);
    }
    Promise.allSettled(this._loading.values());
  }

  _ensure() {
    if (!this.ctx) this.init();
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  // ---- real sample playback ----
  _playSample(key, volume = 0.5, rate = 1) {
    const buf = this._buffers.get(key);
    if (!buf) return false;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rate;
    const g = this.ctx.createGain();
    g.gain.value = volume;
    src.connect(g); g.connect(this.masterGain);
    src.start();
    return true;
  }

  // ---- procedural fallbacks (compact synth voices) ----
  _noise(g, t, dur, { freq = 1800, type = 'lowpass', q = 0.8, gain = 0.5 } = {}) {
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuffer;
    src.loop = true;
    const filter = this.ctx.createBiquadFilter();
    filter.type = type; filter.frequency.value = freq; filter.Q.value = q;
    const ng = this.ctx.createGain();
    ng.gain.setValueAtTime(gain, t);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter); filter.connect(ng); ng.connect(this.masterGain);
    src.start(t); src.stop(t + dur + 0.02);
  }

  _tone(t, dur, { type = 'sine', from = 440, to = null, gain = 0.2, delay = 0 } = {}) {
    const o = this.ctx.createOscillator();
    const og = this.ctx.createGain();
    o.type = type;
    const t0 = t + delay;
    o.frequency.setValueAtTime(from, t0);
    if (to) o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t0 + dur);
    og.gain.setValueAtTime(gain, t0);
    og.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(og); og.connect(this.masterGain);
    o.start(t0); o.stop(t0 + dur + 0.02);
  }

  play(name, variant, opts = {}) {
    if (!this.enabled) return;
    this._ensure();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;

    // Voice throttle: identical sounds fired within this window replace the
    // previous one instead of stacking (10 rifle shots/s must not become a
    // wall of noise). Per-event class so steps don't block shots; callers can
    // override the class (bot gunfire uses its own so it never mutes the
    // player's own gunshot).
    const throttleClass = opts.throttleClass || (name.startsWith('shoot') ? 'shoot' : name);
    const minGap = { shoot: 0.03, shootBot: 0.06, step: 0.05, hit: 0.02, impact_wall: 0.05 }[throttleClass] || 0;
    this._lastPlay = this._lastPlay || {};
    if (minGap && t - (this._lastPlay[throttleClass] || -1) < minGap) {
      this._lastPlay[throttleClass] = t;
      return; // too soon after the previous identical sound
    }
    this._lastPlay[throttleClass] = t;

    // Map game events to real samples first
    const sampleMap = {
      'shoot': variant === 'Shotgun' ? 'shoot-shotgun' : variant === 'Pistol' ? 'shoot-pistol' : 'shoot-rifle',
      'hit': 'hit',
      'headshot': 'hitmarker',
      'kill': 'kill',
      'hurt': 'hurt',
      'respawn': 'respawn',
      'reloadStart': 'reloadStart',
      'reloadEnd': 'reloadEnd',
      'switch': 'switch',
      'ui': 'ui',
      'empty': 'empty',
      'jump': 'jump',
      'step': Math.random() < 0.5 ? 'step1' : 'step2',
    };
    if (sampleMap[name]) {
      const key = sampleMap[name];
      let vol = this._manifest && this._manifest[key] ? this._manifest[key][1] : 0.5;
      // Tiny rate variation so rapid fire doesn't sound machine-identical.
      // Per-weapon identity now comes from the distinct recorded samples —
      // no pitch-shifting disguise on top.
      let rate = 1 + (Math.random() - 0.5) * 0.05;
      if (opts.volumeScale !== undefined) vol *= opts.volumeScale;
      if (this._playSample(key, vol, rate)) return;
      // fall through to procedural fallback below
    }

    switch(name) {
      case 'shoot': {
        if (variant === 'Shotgun') { this._noise(null, t, 0.24, {freq: 900, gain: 0.5}); this._tone(t, 0.16, {type:'sine', from:150, to:40, gain:0.45}); }
        else if (variant === 'Pistol') { this._noise(null, t, 0.10, {freq: 2400, gain: 0.38}); this._tone(t, 0.08, {type:'sine', from:300, to:90, gain:0.32}); }
        else { this._noise(null, t, 0.13, {freq: 2000, gain: 0.4}); this._tone(t, 0.09, {type:'sine', from:220, to:60, gain:0.36}); }
        break;
      }
      case 'hit': this._noise(null, t, 0.07, {freq: 900, gain: 0.3}); this._tone(t, 0.06, {type:'triangle', from:520, to:300, gain:0.16}); break;
      case 'headshot': this._noise(null, t, 0.05, {freq: 3600, gain: 0.35}); this._tone(t, 0.16, {type:'sine', from:1250, to:1600, gain:0.2}); break;
      case 'kill': this._tone(t, 0.10, {type:'triangle', from:620, gain:0.26}); this._tone(t, 0.16, {type:'triangle', from:930, gain:0.26, delay:0.07}); break;
      case 'hurt': this._tone(t, 0.14, {type:'sawtooth', from:160, to:70, gain:0.3}); this._noise(null, t, 0.10, {freq:500, gain:0.2}); break;
      case 'death': this._tone(t, 0.5, {type:'sawtooth', from:200, to:30, gain:0.3}); this._noise(null, t, 0.30, {freq:400, gain:0.22}); break;
      case 'respawn': this._tone(t, 0.09, {type:'sine', from:400, to:800, gain:0.18}); this._tone(t, 0.12, {type:'sine', from:600, to:1200, gain:0.14, delay:0.08}); break;
      case 'reloadStart': this._noise(null, t, 0.05, {freq:1400, gain:0.2}); this._tone(t, 0.04, {type:'square', from:320, to:180, gain:0.1}); break;
      case 'reloadEnd': this._noise(null, t, 0.06, {freq:1000, gain:0.24}); this._tone(t, 0.06, {type:'square', from:500, to:240, gain:0.14}); break;
      case 'switch': this._noise(null, t, 0.05, {freq:1600, gain:0.16}); this._tone(t, 0.05, {type:'square', from:700, to:500, gain:0.1}); break;
      case 'ui': this._tone(t, 0.07, {type:'sine', from:660, to:880, gain:0.16}); break;
      case 'empty': this._tone(t, 0.04, {type:'square', from:1100, to:700, gain:0.1}); break;
      case 'jump': this._tone(t, 0.09, {type:'sine', from:320, to:470, gain:0.12}); break;
      case 'step': this._noise(null, t, 0.05, {freq:260, gain:0.06}); break;
      default: this._tone(t, 0.1, {type:'sine', from:440, gain:0.12}); break;
    }
  }

  setVolume(v) {
    if (this.masterGain) this.masterGain.gain.value = v;
  }
}
