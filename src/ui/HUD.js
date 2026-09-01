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
    this.leaderEl = document.getElementById('leader');
    this.dmgDirEl = document.getElementById('damage-direction');
    this._dmgDirTimer = null;
    this._killTimer = null;
    this._hitTimer = null;
  }

  update({ score, timeLeft, health, ammo, kills, deaths, fps, pos, botCount, weaponName, leader }) {
    if (this.leaderEl) this.leaderEl.textContent = leader !== undefined ? leader : (this.leaderEl.textContent || '0');
    if (this.timerEl) {
      const m = Math.floor(timeLeft / 60);
      const s = Math.floor(timeLeft % 60);
      this.timerEl.textContent = `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    }
    if (this.killsEl) this.killsEl.textContent = kills || 0;
    if (this.healthEl) {
      this.healthEl.textContent = Math.max(0, Math.round(health));
      this.healthEl.style.color = health > 60 ? '#4ade80' : health > 30 ? '#facc15' : '#f87171';
      // Low-HP urgency: pulsing red border + heartbeat urgency below 30%
      if (this.healthEl.parentElement) {
        this.healthEl.parentElement.classList.toggle('critical', health <= 30 && health > 0);
      }
    }
    if (this.ammoEl) {
      this.ammoEl.textContent = ammo || '0/0';
      const parts = String(ammo).split('/');
      const inMag = Number(parts[0]);
      // Low ammo warning: pulse when ≤ 8 rounds, red at 0
      this.ammoEl.style.color = inMag === 0 ? '#f87171' : '#fff';
      if (this.ammoEl) {
        if (inMag > 0 && inMag <= 8) this.ammoEl.classList.add('low');
        else this.ammoEl.classList.remove('low');
      }
    }
    if (this.weaponNameEl) this.weaponNameEl.textContent = (weaponName || 'RIFLE').toUpperCase();

    // Persistent critical state: subtle pulsing red rim while ≤30 HP so
    // "about to die" is ambient knowledge, not just a per-hit flash.
    if (this._vignEl === undefined) this._vignEl = document.getElementById('damage-vignette');
    if (this._vignEl) this._vignEl.classList.toggle('low', health <= 30 && health > 0);

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

  // Big centered kill confirmation — strong but brief. Streak escalation:
  // 1 kill = ELIMINADO; 2 in 3.5s = DOBLE BAJA; 3+ = RACHA xN.
  // No fake "+100" points: the only score in BLOCKFIRE is kills, so the
  // banner must not advertise a scoring system that doesn't exist.
  showKillBanner(isHeadshot, streak = 1) {
    if (!this.killbannerEl) return;
    const title = this.killbannerEl.querySelector('.kb-title');
    const sub = this.killbannerEl.querySelector('.kb-sub');
    const hsTag = isHeadshot ? 'HEADSHOT' : '';
    if (streak >= 3) {
      title.textContent = 'RACHA';
      sub.textContent = `x${streak}${hsTag ? ' · ' + hsTag : ''}`;
    } else if (streak === 2) {
      title.textContent = 'DOBLE BAJA';
      sub.textContent = hsTag;
    } else {
      title.textContent = 'ELIMINADO';
      sub.textContent = hsTag;
    }
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

  // Directional damage indicator: a red wedge orbiting the crosshair, rotated
  // toward the attacker (0° = front, clockwise positive). Re-fires per hit.
  showDamageDirection(angleDeg = 0) {
    if (!this.dmgDirEl) return;
    this.dmgDirEl.style.transform = `translate(-50%, -50%) rotate(${angleDeg}deg)`;
    this.dmgDirEl.classList.remove('show');
    void this.dmgDirEl.offsetWidth; // restart animation
    this.dmgDirEl.classList.add('show');
    clearTimeout(this._dmgDirTimer);
    this._dmgDirTimer = setTimeout(() => this.dmgDirEl.classList.remove('show'), 650);
  }

  toggleDebug() {
    this.debugEnabled = !this.debugEnabled;
  }
}
