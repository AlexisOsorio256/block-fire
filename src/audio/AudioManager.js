export class AudioManager {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.masterGain = null;
    this.sounds = new Map();
  }

  init() {
    if (this.ctx) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.52;
      this.masterGain.connect(this.ctx.destination);
    } catch (e) {
      this.enabled = false;
      console.warn('WebAudio not supported', e);
    }
  }

  _ensure() {
    if (!this.ctx) this.init();
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  play(name, variant) {
    if (!this.enabled) return;
    this._ensure();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const g = this.ctx.createGain();
    g.connect(this.masterGain);

    // Procedural sounds - no assets needed for prototype
    switch(name) {
      case 'shoot': {
        const o = this.ctx.createOscillator();
        const f = this.ctx.createBiquadFilter();
        f.type = 'highpass'; f.frequency.value = 1200;
        // Different weapon sounds
        let freq = 180, freq2 = 60, dur = 0.08;
        if (variant === 'Shotgun') { freq = 120; freq2 = 30; dur = 0.14; g.gain.value = 0.32; }
        else if (variant === 'Pistol') { freq = 280; freq2 = 90; dur = 0.07; g.gain.value = 0.22; }
        else { freq = 180; freq2 = 70; dur = 0.09; g.gain.value = 0.24; } // rifle
        o.type = 'square'; o.frequency.value = freq;
        o.frequency.exponentialRampToValueAtTime(Math.max(20, freq2), t + dur);
        g.gain.value = variant === 'Shotgun' ? 0.32 : 0.24;
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(f); f.connect(g);
        o.start(t); o.stop(t+dur+0.02);
        // Click
        const o2 = this.ctx.createOscillator();
        const g2 = this.ctx.createGain();
        o2.type = 'square'; o2.frequency.value = 1200;
        g2.gain.value = 0.08; g2.gain.exponentialRampToValueAtTime(0.0001, t+0.04);
        o2.connect(g2); g2.connect(this.masterGain);
        o2.start(t); o2.stop(t+0.05);
        break;
      }
      case 'hit': {
        const o = this.ctx.createOscillator();
        o.type = 'sine'; o.frequency.value = 880;
        o.frequency.exponentialRampToValueAtTime(440, t+0.07);
        g.gain.value = 0.18; g.gain.exponentialRampToValueAtTime(0.0001, t+0.11);
        o.connect(g); o.start(t); o.stop(t+0.12);
        break;
      }
      case 'kill': {
        const o = this.ctx.createOscillator();
        o.type = 'sine'; o.frequency.value = 640;
        o.frequency.exponentialRampToValueAtTime(920, t+0.18);
        g.gain.value = 0.26; g.gain.exponentialRampToValueAtTime(0.0001, t+0.22);
        o.connect(g); o.start(t); o.stop(t+0.23);
        const o2 = this.ctx.createOscillator();
        const g2 = this.ctx.createGain();
        o2.type = 'triangle'; o2.frequency.value = 1200;
        g2.gain.value = 0.12; g2.gain.exponentialRampToValueAtTime(0.0001, t+0.18);
        o2.connect(g2); g2.connect(this.masterGain);
        o2.start(t+0.06); o2.stop(t+0.24);
        break;
      }
      case 'reload': {
        const o = this.ctx.createOscillator();
        o.type = 'triangle'; o.frequency.value = 380;
        o.frequency.linearRampToValueAtTime(520, t+0.12);
        g.gain.value = 0.14; g.gain.exponentialRampToValueAtTime(0.0001, t+0.22);
        o.connect(g); o.start(t); o.stop(t+0.23);
        break;
      }
      case 'death': {
        const o = this.ctx.createOscillator();
        o.type = 'sawtooth'; o.frequency.value = 180;
        o.frequency.exponentialRampToValueAtTime(28, t+0.42);
        g.gain.value = 0.22; g.gain.exponentialRampToValueAtTime(0.0001, t+0.48);
        o.connect(g); o.start(t); o.stop(t+0.5);
        break;
      }
      case 'jump': {
        const o = this.ctx.createOscillator();
        o.type = 'sine'; o.frequency.value = 320;
        o.frequency.linearRampToValueAtTime(480, t+0.09);
        g.gain.value = 0.12; g.gain.exponentialRampToValueAtTime(0.0001, t+0.14);
        o.connect(g); o.start(t); o.stop(t+0.15);
        break;
      }
      case 'step': {
        const o = this.ctx.createOscillator();
        o.type = 'square'; o.frequency.value = 80;
        g.gain.value = 0.04; g.gain.exponentialRampToValueAtTime(0.0001, t+0.06);
        o.connect(g); o.start(t); o.stop(t+0.07);
        break;
      }
      default: {
        const o = this.ctx.createOscillator();
        o.type = 'sine'; o.frequency.value = 440;
        g.gain.value = 0.12;
        g.gain.exponentialRampToValueAtTime(0.0001, t+0.1);
        o.connect(g); o.start(t); o.stop(t+0.11);
      }
    }
  }

  setVolume(v) {
    if (this.masterGain) this.masterGain.gain.value = v;
  }
}
