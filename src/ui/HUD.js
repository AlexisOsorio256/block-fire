export class HUD {
  constructor() {
    this.scoreEl = document.getElementById('score');
    this.timerEl = document.getElementById('timer');
    this.healthEl = document.getElementById('health');
    this.ammoEl = document.getElementById('ammo');
    this.killsEl = document.getElementById('kills');
    this.deathsEl = document.getElementById('deaths');
    this.killfeedEl = document.getElementById('killfeed');
    this.debugEl = document.getElementById('debug');
    this.debugEnabled = false;
    this.killbannerEl = document.getElementById('killbanner');
    this.hitbannerEl = document.getElementById('hitbanner');
    this.weaponNameEl = document.getElementById('weapon-name');
    this._killTimer = null;
    this._hitTimer = null;
  }

  update({ score, timeLeft, health, ammo, kills, deaths, fps, pos, botCount, weaponName }) {
    if (this.timerEl) {
      const m = Math.floor(timeLeft / 60);
      const s = Math.floor(timeLeft % 60);
      this.timerEl.textContent = `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    }
    if (this.killsEl) this.killsEl.textContent = kills || 0;
    if (this.healthEl) {
      this.healthEl.textContent = Math.max(0, Math.round(health));
      this.healthEl.style.color = health > 60 ? '#4ade80' : health > 30 ? '#facc15' : '#f87171';
    }
    if (this.ammoEl) {
      this.ammoEl.textContent = ammo || '0/0';
      const parts = String(ammo).split('/');
      if (this.ammoEl) this.ammoEl.style.color = Number(parts[0]) === 0 ? '#f87171' : '#fff';
    }
    if (this.weaponNameEl) this.weaponNameEl.textContent = (weaponName || 'RIFLE').toUpperCase();

    if (this.debugEnabled && this.debugEl) {
      this.debugEl.textContent = `FPS ${fps|0} | POS ${pos.x.toFixed(1)},${pos.y.toFixed(1)},${pos.z.toFixed(1)} | BOTS ${botCount} | SCORE ${score}`;
      this.debugEl.classList.remove('hidden');
    } else if (this.debugEl) {
      this.debugEl.classList.add('hidden');
    }
  }

  showKill(killer, victim, isHeadshot) {
    if (!this.killfeedEl) return;
    const entry = document.createElement('div');
    entry.className = 'kill-entry';
    entry.textContent = `${killer} ${isHeadshot ? '◉' : '→'} ${victim}`;
    if (isHeadshot) entry.style.borderLeftColor = '#ff4444';
    this.killfeedEl.appendChild(entry);
    setTimeout(()=> {
      entry.style.opacity = '0';
      entry.style.transform = 'translateX(20px)';
      setTimeout(()=> entry.remove(), 300);
    }, 2200);
  }

  // Big centered kill confirmation — strong but brief
  showKillBanner(isHeadshot) {
    if (!this.killbannerEl) return;
    const title = this.killbannerEl.querySelector('.kb-title');
    const sub = this.killbannerEl.querySelector('.kb-sub');
    title.textContent = 'ELIMINADO';
    sub.textContent = isHeadshot ? 'HEADSHOT +100' : '+100';
    this.killbannerEl.classList.remove('show');
    void this.killbannerEl.offsetWidth; // restart animation
    this.killbannerEl.classList.add('show');
    clearTimeout(this._killTimer);
    this._killTimer = setTimeout(()=> this.killbannerEl.classList.remove('show'), 900);
  }

  // Small damage-dealt indicator (hit confirm) — optional extra clarity
  showHitBanner(isHeadshot) {
    if (!this.hitbannerEl) return;
    this.hitbannerEl.textContent = isHeadshot ? 'HEADSHOT' : '';
    if (!isHeadshot) return;
    this.hitbannerEl.classList.remove('show');
    void this.hitbannerEl.offsetWidth;
    this.hitbannerEl.classList.add('show');
    clearTimeout(this._hitTimer);
    this._hitTimer = setTimeout(()=> this.hitbannerEl.classList.remove('show'), 600);
  }

  toggleDebug() {
    this.debugEnabled = !this.debugEnabled;
  }
}
