// AudioManager — procedural WebAudio synthesis. No assets, no downloads, no
// licensing risk. Every combat/feedback event has a distinct, punchy voice.
export class AudioManager {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.masterGain = null;
    this._noiseBuffer = null;
  }

  init() {
    if (this.ctx) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.5;
      // Gentle limiter so layered shots never clip
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.knee.value = 22;
      comp.ratio.value = 8;
      comp.attack.value = 0.002;
      comp.release.value = 0.12;
      this.masterGain.connect(comp);
      comp.connect(this.ctx.destination);
      // Pre-render 1s of white noise (reused by shots/impacts)
      const len = this.ctx.sampleRate;
      this._noiseBuffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = this._noiseBuffer.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    } catch (e) {
      this.enabled = false;
      console.warn('WebAudio not supported', e);
    }
  }

  _ensure() {
    if (!this.ctx) this.init();
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  // Small helpers — keep each sound compact (few nodes, short life)
  _noise(g, t, dur, { freq = 1800, type = 'lowpass', q = 0.8, gain = 0.5, hp = null } = {}) {
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuffer;
    src.loop = true;
    src.playbackRate.value = 0.9 + Math.random() * 0.2;
    const filter = this.ctx.createBiquadFilter();
    filter.type = type; filter.frequency.value = freq; filter.Q.value = q;
    const ng = this.ctx.createGain();
    ng.gain.setValueAtTime(gain, t);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter); filter.connect(ng); ng.connect(this.masterGain);
    if (hp) {
      const hpf = this.ctx.createBiquadFilter();
      hpf.type = 'highpass'; hpf.frequency.value = hp;
      ng.disconnect(); ng.connect(hpf); hpf.connect(this.masterGain);
    }
    src.start(t); src.stop(t + dur + 0.02);
  }

  _tone(g, t, dur, { type = 'sine', from = 440, to = null, gain = 0.2, delay = 0 } = {}) {
    const o = this.ctx.createOscillator();
    const og = this.ctx.createGain();
    o.type = type;
    const t0 = t + delay;
    o.frequency.setValueAtTime(from, t0);
    if (to) o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t0 + dur);
    og.gain.setValueAtTime(gain, t0);
    og.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(og); og.connect(g || this.masterGain);
    o.start(t0); o.stop(t0 + dur + 0.02);
  }

  play(name, variant) {
    if (!this.enabled) return;
    this._ensure();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const g = this.ctx.createGain();
    g.connect(this.masterGain);

    switch(name) {
      case 'shoot': {
        // Punchy gun: noise burst + body thump + crack, per weapon
        if (variant === 'Shotgun') {
          this._noise(g, t, 0.24, { freq: 900, gain: 0.55 });
          this._tone(g, t, 0.16, { type: 'sine', from: 150, to: 40, gain: 0.5 });
          this._tone(g, t, 0.05, { type: 'square', from: 1600, to: 300, gain: 0.12 });
        } else if (variant === 'Pistol') {
          this._noise(g, t, 0.10, { freq: 2400, gain: 0.4 });
          this._tone(g, t, 0.08, { type: 'sine', from: 300, to: 90, gain: 0.35 });
        } else { // Rifle
          this._noise(g, t, 0.13, { freq: 2000, gain: 0.42, hp: 200 });
          this._tone(g, t, 0.09, { type: 'sine', from: 220, to: 60, gain: 0.4 });
          this._tone(g, t, 0.03, { type: 'square', from: 1300, to: 400, gain: 0.10 });
        }
        break;
      }
      case 'hit': {
        // Flesh impact confirm — short snap
        this._noise(g, t, 0.07, { freq: 900, gain: 0.30 });
        this._tone(g, t, 0.06, { type: 'triangle', from: 520, to: 300, gain: 0.16 });
        break;
      }
      case 'headshot': {
        // Sharp crack + high ring — unmistakable
        this._noise(g, t, 0.05, { freq: 3600, gain: 0.4, hp: 900 });
        this._tone(g, t, 0.16, { type: 'sine', from: 1250, to: 1600, gain: 0.20 });
        break;
      }
      case 'kill': {
        // Two-note victory blip
        this._tone(g, t, 0.10, { type: 'triangle', from: 620, gain: 0.26 });
        this._tone(g, t, 0.16, { type: 'triangle', from: 930, gain: 0.26, delay: 0.07 });
        this._noise(g, t, 0.08, { freq: 2600, gain: 0.10, hp: 700 });
        break;
      }
      case 'hurt': {
        // Player took damage — low thud + alarm edge
        this._tone(g, t, 0.14, { type: 'sawtooth', from: 160, to: 70, gain: 0.30 });
        this._noise(g, t, 0.10, { freq: 500, gain: 0.20 });
        break;
      }
      case 'death': {
        // Downward sweep — clear failure cue
        this._tone(g, t, 0.5, { type: 'sawtooth', from: 200, to: 30, gain: 0.30 });
        this._noise(g, t, 0.30, { freq: 400, gain: 0.22 });
        break;
      }
      case 'respawn': {
        // Rising ready-up
        this._tone(g, t, 0.09, { type: 'sine', from: 400, to: 800, gain: 0.18 });
        this._tone(g, t, 0.12, { type: 'sine', from: 600, to: 1200, gain: 0.14, delay: 0.08 });
        break;
      }
      case 'reloadStart': {
        // Mag out — click-clack
        this._noise(g, t, 0.05, { freq: 1400, gain: 0.22, hp: 300 });
        this._tone(g, t, 0.04, { type: 'square', from: 320, to: 180, gain: 0.10 });
        break;
      }
      case 'reloadEnd': {
        // Mag in — decisive chunk
        this._noise(g, t, 0.06, { freq: 1000, gain: 0.26, hp: 250 });
        this._tone(g, t, 0.06, { type: 'square', from: 500, to: 240, gain: 0.14 });
        this._tone(g, t, 0.05, { type: 'square', from: 800, to: 400, gain: 0.10, delay: 0.05 });
        break;
      }
      case 'switch': {
        this._noise(g, t, 0.05, { freq: 1600, gain: 0.18, hp: 400 });
        this._tone(g, t, 0.05, { type: 'square', from: 700, to: 500, gain: 0.10 });
        break;
      }
      case 'ui': {
        this._tone(g, t, 0.07, { type: 'sine', from: 660, to: 880, gain: 0.16 });
        break;
      }
      case 'empty': {
        // Dry fire click
        this._tone(g, t, 0.04, { type: 'square', from: 1100, to: 700, gain: 0.10 });
        this._noise(g, t, 0.03, { freq: 2200, gain: 0.08 });
        break;
      }
      case 'jump': {
        this._tone(g, t, 0.09, { type: 'sine', from: 320, to: 470, gain: 0.12 });
        break;
      }
      case 'step': {
        this._noise(g, t, 0.05, { freq: 260, gain: 0.06 });
        break;
      }
      default: {
        this._tone(g, t, 0.1, { type: 'sine', from: 440, gain: 0.12 });
      }
    }
  }

  setVolume(v) {
    if (this.masterGain) this.masterGain.gain.value = v;
  }
}
