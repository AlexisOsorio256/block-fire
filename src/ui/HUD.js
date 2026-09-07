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
    // Iconos de arma: data-URL renderizada UNA VEZ desde el GLB real
    // (hud.weaponIcon(key)) — la tarjeta nunca muestra ASCII si hay modelo.
    this._iconCache = {};
    this._iconRequests = {};
  }

  // ── Icono de arma para la tienda: render offscreen del GLB (Kenney) ──
  // Devuelve data-URL cacheada o null mientras renderiza (la tarjeta muestra
  // el fallback tipográfico y se actualiza solo cuando el icono está listo).
  weaponIcon(key) {
    if (this._iconCache[key]) return this._iconCache[key];
    if (this._iconRequests[key]) return null;
    const g = this._gameRef;
    const url = g && g.weaponSystem && g.weaponSystem._iconSourceUrl
      ? g.weaponSystem._iconSourceUrl(key) : null;
    if (!url) return null;
    this._iconRequests[key] = true;
    // Render fuera de banda: import diferido para no acoplar HUD a three
    import('./WeaponIcons.js').then(({ renderWeaponIcon }) => {
      renderWeaponIcon(url).then((dataUrl) => {
        if (dataUrl) {
          this._iconCache[key] = dataUrl;
          if (this._shopData) this._renderShop(); // re-pinta con iconos reales
        }
      });
    }).catch((e) => { console.warn('[HUD] icon render:', e && e.message); });
    return null;
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

  // Marcador por rondas: lectura instantánea por color + pips, sin copiar
  // palabras de equipo ni métricas de FFA sobre el combate de escuadras.
  updateTeamScore(ally, enemy, round, roundTarget) {
    const a = document.getElementById('score-ally');
    const e = document.getElementById('score-enemy');
    const r = document.getElementById('round-ind');
    if (a) a.textContent = ally;
    if (e) e.textContent = enemy;
    if (r && round) r.textContent = `R${round}`;
    const paintPips = (id, wins, tone) => {
      const el = document.getElementById(id);
      if (!el) return;
      const target = roundTarget || 4;
      el.replaceChildren(...Array.from({ length: target }, (_, i) => {
        const pip = document.createElement('i');
        if (i < wins) pip.className = `won ${tone}`;
        return pip;
      }));
    };
    paintPips('round-pips-ally', ally, 'ally');
    paintPips('round-pips-enemy', enemy, 'enemy');
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
    this._bannerT = 2.1;
  }

  // Impacto de fin de ronda: una capa brevísima, pulso del marcador y banner
  // comparten reloj/DOM del HUD. Es feedback real aun sin depender de assets.
  showRoundResult(winner) {
    const el = document.getElementById('round-feedback');
    const score = document.getElementById('squad-score');
    if (el) {
      el.className = `show ${winner === 'ally' ? 'win' : 'lose'}`;
      clearTimeout(this._roundFeedbackTimer);
      this._roundFeedbackTimer = setTimeout(() => { el.className = ''; }, 780);
    }
    if (score) {
      score.classList.remove('score-pop');
      void score.offsetWidth;
      score.classList.add('score-pop');
    }
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

  // Tienda in-match: SOLO armas [{key,name,price,owned,equipped}] + callbacks
  showShop({ weapons, onBuyWeapon, getCoins }) {
    this._shopCallbacks = { onBuyWeapon, getCoins };
    this._shopData = { weapons };
    const panel = document.getElementById('buy-phase');
    if (panel) panel.classList.add('show');
    // La mirada no participa en la compra: crosshair fuera mientras la tienda
    // esté abierta (auditoría: la cruz quedaba activa sobre el panel).
    const xh = document.getElementById('crosshair');
    if (xh) xh.classList.add('hide');
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
    // Máximos para las barras relativas (daño por disparo global, no por posta)
    const MAX = { dmg: 30, rate: 10, range: 90 };
    data.weapons.forEach((w, i) => {
      const card = document.createElement('button');
      card.className = 'bp-item' + (w.owned ? ' owned' : '')
        + (!w.owned && coins >= w.price ? ' affordable' : '')
        + (!w.owned && coins < w.price ? ' cant' : '')
        + (w.equipped ? ' equipped' : '');
      // Icono: data-URL del GLB real si ya está renderizada; glifo mientras.
      const iconUrl = this.weaponIcon(w.key);
      const icoHtml = iconUrl
        ? `<img class="bp-img" src="${iconUrl}" alt="">`
        : `<span class="bp-ico">${icons[w.key] || '⌗'}</span>`;
      // Stats relativas (si el arma aportó datos): 3 barras compactas
      const wd = w.data;
      const bars = wd ? `
        <span class="bp-stat"><i style="width:${Math.round(100 * Math.min(1, (wd.damage * (wd.pellets || 1)) / MAX.dmg))}%"></i></span>
        <span class="bp-stat"><i style="width:${Math.round(100 * Math.min(1, (1 / wd.fireRate) / MAX.rate))}%"></i></span>
        <span class="bp-stat"><i style="width:${Math.round(100 * Math.min(1, wd.range / MAX.range))}%"></i></span>` : '';
      card.innerHTML = `${icoHtml}<b>${w.name}</b>${bars}<span class="bp-price">${w.equipped ? 'EQUIPADA' : w.owned ? 'COMPRADA' : '🪙 ' + w.price}</span>`;
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

  closeShop() {
    const panel = document.getElementById('buy-phase');
    if (panel && !panel.classList.contains('buy-locked')) panel.classList.remove('show');
    const xh = document.getElementById('crosshair');
    if (xh) xh.classList.remove('hide');
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

  // ── ESPECTADOR (Duelo de Escuadras) ──
  // Ojo: _specShown vive en HUD (dueño del DOM); el estado del espectador
  // (a quién se espectea) vive en Game. hideSpectate limpia TODO lo visual.
  showSpectate(name) {
    let el = document.getElementById('spectate-banner');
    if (!el) {
      el = document.createElement('div');
      el.id = 'spectate-banner';
      el.innerHTML = '<b>ESPECTANDO</b><span id="spectate-name"></span>' +
        '<div class="spec-nav"><button id="spec-prev" aria-label="Compañero anterior">‹</button>' +
        '<button id="spec-next" aria-label="Compañero siguiente">›</button></div>';
      document.getElementById('hud').appendChild(el);
      // Botones móviles ‹ › (PC usa Q/E o flechas): solo PIDEN el cambio.
      document.getElementById('spec-prev').addEventListener('click', () => {
        if (this._gameRef && this._gameRef._spectating) this._gameRef._specWish = -1;
      });
      document.getElementById('spec-next').addEventListener('click', () => {
        if (this._gameRef && this._gameRef._spectating) this._gameRef._specWish = 1;
      });
    }
    el.querySelector('#spectate-name').textContent = name || '';
    el.classList.add('show');
    this._specShown = true;
  }

  hideSpectate() {
    const el = document.getElementById('spectate-banner');
    if (el) el.classList.remove('show');
    this._specShown = false;
  }

  // Muerto en escuadras: el HUD de vida/arma del jugador muerto desaparece
  // (arma/manos ya no existen); el marcador de rondas y el tiempo siguen.
  showPlayerDeadHud(dead) {
    const hb = document.getElementById('hud-bottom');
    if (hb) hb.classList.toggle('spectator-hidden', !!dead);
  }

  update({ score, timeLeft, health, maxHealth = 200, ammo, kills, deaths, fps, pos, botCount, weaponName, leader }) {
    if (this.leaderEl) this.leaderEl.textContent = leader !== undefined ? leader : (this.leaderEl.textContent || '0');
    if (this.timerEl) {
      const m = Math.floor(timeLeft / 60);
      const s = Math.floor(timeLeft % 60);
      this.timerEl.textContent = `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    }
    if (this.killsEl) this.killsEl.textContent = kills || 0;
    if (this.healthEl) {
      this.healthEl.textContent = Math.max(0, Math.round(health));
      const ratio = Math.max(0, Math.min(1, health / maxHealth));
      this.healthEl.style.color = ratio > 0.45 ? '#dfffe9' : ratio > 0.22 ? '#ffe59b' : '#ffd0cd';
      const fill = document.getElementById('health-fill');
      if (fill) fill.style.transform = `scaleX(${ratio})`;
      if (this.healthEl.parentElement) {
        this.healthEl.parentElement.classList.toggle('critical', ratio <= 0.22 && health > 0);
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
    if (this._vignEl) this._vignEl.classList.toggle('low', health / maxHealth <= 0.22 && health > 0);

    if (this.debugEnabled && this.debugEl) {
      this.debugEl.textContent = `FPS ${fps|0} | POS ${pos.x.toFixed(1)},${pos.y.toFixed(1)},${pos.z.toFixed(1)} | BOTS ${botCount} | SCORE ${score}`;
      this.debugEl.classList.remove('hidden');
    } else if (this.debugEl) {
      this.debugEl.classList.add('hidden');
    }
  }

  // Killfeed: NOMBRE → NOMBRE con glifo del arma + marca compacta de
  // headshot. Nombres SIEMPRE player-facing (Game._displayName los filtra).
  showKill(killer, victim, isHeadshot, weaponKey) {
    if (!this.killfeedEl) return;
    const entry = document.createElement('div');
    entry.className = 'kill-entry' + (isHeadshot ? ' hs' : '');
    const GLYPH = { rifle: '⌐', pistol: '¬', shotgun: '⋔', smg: '∥' };
    entry.innerHTML =
      `<b>${killer}</b><i class="kf-weapon">${GLYPH[weaponKey] || '→'}</i>` +
      `<i class="kf-hs" style="display:${isHeadshot ? '' : 'none'}">◉</i><b>${victim}</b>`;
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
