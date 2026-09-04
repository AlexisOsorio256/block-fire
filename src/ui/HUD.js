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
    this._bannerHide = 0; // reloj del banner de ronda (tickRoundBanner)
    this._buyCountAt = -1;
    this._shopData = null;
    // La tienda in-match es SOLO armas (las skins viven en el lobby).
  }

  // ── Duelo de Escuadras ──
  showImmunity(seconds) {
    this._immuneT = seconds;
    let el = document.getElementById('squad-immunity');
    if (!el) {
      el = document.createElement('div');
      el.id = 'squad-immunity';
      document.getElementById('hud').appendChild(el);
    }
    el.classList.add('show');
  }

  // Marcador por RONDAS: ALIADOS x — y ENEMIGOS · RONDA N/4
  updateTeamScore(ally, enemy, round, roundTarget) {
    const a = document.getElementById('score-ally');
    const e = document.getElementById('score-enemy');
    const r = document.getElementById('round-ind');
    if (a) a.textContent = ally;
    if (e) e.textContent = enemy;
    if (r && round) r.textContent = `RONDA ${round} · 1º EN ${roundTarget || 4}`;
    const wrap = document.getElementById('squad-score');
    if (wrap) wrap.classList.add('show');
  }

  // Banners de ronda: RONDA N · ¡A LUCHAR! · ¡RONDA GANADA! · RONDA PERDIDA
  showRoundBanner(title, sub, color) {
    const el = document.getElementById('round-banner');
    if (!el) return;
    const t = el.querySelector('.rb-title');
    const s = el.querySelector('.rb-sub');
    if (t) t.textContent = title;
    if (s) s.textContent = sub || '';
    el.style.setProperty('--rb-color', color || '#ffd23f');
    el.classList.remove('show');
    void el.offsetWidth; // reiniciar animación CSS
    el.classList.add('show');
    this._bannerT = 2.6;
  }

  tickRoundBanner(dt) {
    if (this._bannerT > 0) {
      this._bannerT -= dt;
      if (this._bannerT <= 0) {
        const el = document.getElementById('round-banner');
        if (el) el.classList.remove('show');
      }
    }
  }

  // Fase de compra: contador grande (la tienda abre sola — showShop lo maneja)
  tickBuyPhase(secondsLeft, total) {
    const wrap = document.getElementById('buy-phase');
    if (!wrap) return;
    if (secondsLeft < 0) { wrap.classList.remove('show'); return; }
    const cd = document.getElementById('bp-countdown');
    if (cd) {
      const s = Math.max(0, Math.ceil(secondsLeft));
      if (s !== this._buyCountAt) {
        this._buyCountAt = s;
        cd.textContent = s;
        cd.classList.remove('pulse');
        void cd.offsetWidth;
        cd.classList.add('pulse');
      }
    }
    wrap.classList.add('show');
  }

  // Tienda in-match: SOLO armas [{key,name,price,owned}] + callbacks
  showShop({ weapons, onBuyWeapon, getCoins }) {
    this._shopCallbacks = { onBuyWeapon, getCoins };
    this._shopData = { weapons };
    const panel = document.getElementById('buy-phase');
    if (panel) panel.classList.add('show');
    this._renderShop();
  }

  _renderShop() {
    const panel = document.getElementById('buy-phase');
    if (!panel || !this._shopCallbacks) return;
    const { onBuyWeapon, getCoins } = this._shopCallbacks;
    const coins = getCoins ? getCoins() : 0;
    const coinsEl = document.getElementById('bp-coins');
    if (coinsEl) coinsEl.textContent = '🪙 ' + coins;
    const grid = document.getElementById('bp-grid');
    if (!grid) return;
    grid.innerHTML = '';
    const data = this._shopData || { weapons: [] };
    const icons = { rifle: '⌐', pistol: '¬', shotgun: '⋔', smg: '∥' };
    data.weapons.forEach((w, i) => {
      const card = document.createElement('button');
      card.className = 'bp-item' + (w.owned ? ' owned' : '') + (!w.owned && coins >= w.price ? ' affordable' : '');
      card.innerHTML = `<span class="bp-ico">${icons[w.key] || '⌗'}</span><b>${w.name}</b><span class="bp-price">${w.owned ? 'COMPRADA' : '🪙 ' + w.price}</span>`;
      card.onclick = () => { onBuyWeapon(i); };
      grid.appendChild(card);
    });
  }

  // Re-render al comprar (oro nuevo + estado owned) — panel vivo en la fase
  refreshShop(coins, ownedSet) {
    const coinsEl = document.getElementById('bp-coins');
    if (coinsEl) coinsEl.textContent = '🪙 ' + coins;
    if (this._shopData && ownedSet) for (const w of this._shopData.weapons) w.owned = ownedSet.has(w.key);
    if (this._shopCallbacks) this._renderShop();
  }

  refreshCoins(coins) {
    this.refreshShop(coins, null);
  }

  closeShop() {
    const panel = document.getElementById('buy-phase');
    if (panel && !panel.classList.contains('buy-locked')) panel.classList.remove('show');
  }

  lockBuyPhase() {
    const panel = document.getElementById('buy-phase');
    if (panel) { panel.classList.add('buy-locked'); panel.classList.add('show'); }
  }

  unlockBuyPhase() {
    const panel = document.getElementById('buy-phase');
    if (panel) panel.classList.remove('buy-locked');
  }

  // tickSquad maneja el ESCUDO de inmunidad: cuenta atrás visible y desaparece.
  tickSquad(dt, immuneUntil, matchTime) {
    const el = document.getElementById('squad-immunity');
    if (!el) return;
    const left = Math.max(0, immuneUntil - matchTime);
    if (left > 0) {
      el.textContent = '🛡️ ' + Math.ceil(left) + 's · DISPARAR LO ROMPE';
      el.classList.add('show');
    } else {
      el.classList.remove('show');
    }
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
      if (this.healthEl.parentElement) {
        this.healthEl.parentElement.classList.toggle('critical', health <= 30 && health > 0);
      }
    }
    if (this.ammoEl) {
      this.ammoEl.textContent = ammo || '0/0';
      const parts = String(ammo).split('/');
      const inMag = Number(parts[0]);
      this.ammoEl.style.color = inMag === 0 ? '#f87171' : '#fff';
      if (this.ammoEl) {
        if (inMag > 0 && inMag <= 8) this.ammoEl.classList.add('low');
        else this.ammoEl.classList.remove('low');
      }
    }
    if (this.weaponNameEl) this.weaponNameEl.textContent = (weaponName || 'RIFLE').toUpperCase();

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

  showKillBanner(isHeadshot, streak = 1) {
    if (!this.killbannerEl) return;
    const title = this.killbannerEl.querySelector('.kb-title');
    const sub = this.killbannerEl.querySelector('.kb-sub');
    const hsTag = isHeadshot ? ' · HEADSHOT' : '';
    let points;
    if (streak >= 3) {
      title.textContent = 'RACHA';
      points = 100 * streak + (isHeadshot ? 50 : 0);
      sub.textContent = `x${streak} · +${points}`;
    } else if (streak === 2) {
      title.textContent = 'DOBLE BAJA';
      points = 200 + (isHeadshot ? 50 : 0);
      sub.textContent = `+${points}${hsTag}`;
    } else {
      title.textContent = 'ELIMINADO';
      points = 100 + (isHeadshot ? 50 : 0);
      sub.textContent = `+${points}${hsTag}`;
    }
    this.killbannerEl.classList.remove('show');
    void this.killbannerEl.offsetWidth;
    this.killbannerEl.classList.add('show');
    clearTimeout(this._killTimer);
    this._killTimer = setTimeout(()=> this.killbannerEl.classList.remove('show'), 900);
  }

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

  showDamageDirection(angleDeg = 0) {
    if (!this.dmgDirEl) return;
    this.dmgDirEl.style.transform = `translate(-50%, -50%) rotate(${angleDeg}deg)`;
    this.dmgDirEl.classList.remove('show');
    void this.dmgDirEl.offsetWidth;
    this.dmgDirEl.classList.add('show');
    clearTimeout(this._dmgDirTimer);
    this._dmgDirTimer = setTimeout(() => this.dmgDirEl.classList.remove('show'), 650);
  }

  toggleDebug() {
    this.debugEnabled = !this.debugEnabled;
  }
}
