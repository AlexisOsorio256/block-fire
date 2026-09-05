// ── MatchSquad — máquina de fases del DUELO DE ESCUADRAS (Clash Squad BO7) ──
// Dueña del FLUJO de rondas: compra → combate → fin de ronda → fin de duelo.
// El ESTADO del partido vive en Game (fuente única: round, roundWins, phase,
// phaseTime, coins, immuneUntil, _roundEndTime...); esta clase define CÓMO
// evoluciona. FFA no pasa por aquí: Game lo orquesta directamente.
import * as THREE from '../lib/three.module.js';

export class MatchSquad {
  constructor(game) { this.g = game; }

  // Rama squad de Game.startMatch: reset del duelo + ronda 1.
  startMatch() {
    const g = this.g;
    // ── mejor-de-7, primero a 4 rondas (reglas Free Fire) ──
    g.round = 1;
    g.player.team = 'ally'; // sin esto el fuego amigo no aplica al jugador
    g.roundWins = { ally: 0, enemy: 0 };
    // Oro inicial 1300: en R1 siempre hay algo comprable (escopeta 1200).
    // Con 1000 la tienda de R1 era un escaparate intocable ("no deja comprar").
    g.coins = 1300;               // oro inicial (arrastra entre rondas)
    g.weaponSystem.owned = new Set(['pistol']);
    g.weaponSystem.switchWeapon(2); // Pistola (índice 2)
    g.hud.updateTeamScore(0, 0, 1, g.ROUND_TARGET);
    this.startRound(1);
  }

  // ═══ RONDA N: reset, spawns de base, compra de bots, tienda abierta ═══
  startRound(n) {
    const g = this.g;
    g.round = n;
    g.phase = 'buy';
    g.phaseTime = g.BUY_TIME;
    g.teamScore.ally = 0;
    g.teamScore.enemy = 0;
    g.matchTime = 0;
    g._combatStarted = false;
    g._resetTemporalState();
    // Reset por escuadra: cada equipo sale de SU base (jugador Sur, enemigos Norte)
    const squadSpawns = g.map.squadSpawns || { ally: [g.map.getRandomSpawn()], enemy: [g.map.getRandomSpawn()] };
    g.playerController.health = g.playerController.maxHealth;
    g.playerController.velocity.set(0,0,0);
    let allyIdx = 1, enemyIdx = 0;
    // Spawn que pisa cobertura = bot congelado en coll=true para siempre
    // (autopsia: (-1,17.3)/(1,-17.3) muerden la esquina de una cobertura).
    // Micro-espiral a la primera posición libre (jugador incluido).
    const snapClear = (pos, radius, height) => {
      // Margen +0.25: nacer a 2cm de un muro (válido pero infértil para moverse)
      // también congela en la práctica — visto en la autopsia tras el primer nudge.
      const R = radius + 0.25;
      const probe = pos.clone();
      const gy = g.map.getGroundY(probe.x, probe.z);
      probe.y = gy + height;
      if (!g.map.checkCollision(probe, R, height)) return probe;
      for (const r of [0.8, 1.6, 2.4]) {
        for (let a = 0; a < 8; a++) {
          const ang = a * Math.PI / 4;
          const cand = new THREE.Vector3(pos.x + Math.cos(ang) * r, pos.y, pos.z + Math.sin(ang) * r);
          cand.y = g.map.getGroundY(cand.x, cand.z) + height;
          if (!g.map.checkCollision(cand, R, height)) return cand;
        }
      }
      return probe; // sin hueco: respawn original (no peor que antes)
    };
    g.playerController.respawn(snapClear(squadSpawns.ally[0], g.playerController.radius, g.playerController.height));
    for (const bot of g.bots) {
      const pos = (bot.team === 'ally') ? squadSpawns.ally[allyIdx++ % 4] : squadSpawns.enemy[enemyIdx++ % 4];
      bot.respawn(snapClear(pos, bot.radius, bot.height));
      bot.velocity.set(0,0,0);
      // LA COMPRA DE LOS BOTS: cada ronda mejoran arma (IA de economía)
      bot.setWeapon(this._botBuy(n, bot));
    }
    g.weaponSystem.ammoInMag = g.weaponSystem.currentWeapon.magazineSize;
    g.weaponSystem.reserveAmmo = g.weaponSystem.currentWeapon.magazineSize * 3;
    g.weaponSystem.isReloading = false;
    g.hud.update({ health: g.playerController.maxHealth, ammo: g.weaponSystem.getAmmoText(), kills: 0, deaths: 0, score: `${g.roundWins.ally} — ${g.roundWins.enemy}`, timeLeft: g.ROUND_TIME, fps: 60, pos: g.player.position, botCount: g.bots.length });
    g.hud.updateTeamScore(g.roundWins.ally, g.roundWins.enemy, n, g.ROUND_TARGET);
    // TIENDA ANIMADA: se abre SOLA antes de cada ronda (estilo Free Fire)
    g.openShop();
  }

  // La IA "compra": mezcla determinista por bot+ronda que sube de tier.
  _botBuy(roundN, bot) {
    const roll = (bot.id * 7 + roundN * 3) % 10;
    if (roundN === 1) return roll < 6 ? 'pistol' : 'smg';
    if (roll < 4) return 'rifle';
    if (roll < 6) return 'shotgun';
    if (roll < 8) return 'smg';
    return 'pistol';
  }

  // Fin de la fase de compra → ¡A LUCHAR!
  startCombat() {
    const g = this.g;
    g.phase = 'combat';
    g.phaseTime = g.ROUND_TIME;
    g._combatStarted = true;
    g.hud.closeShop();
    g.shopOpenFlag = false;
    g.hud.showRoundBanner('¡A LUCHAR!', `RONDA ${g.round}`, '#ffd23f');
    g._maybeTouchHint(); // onboarding diferido: la tienda ya cerró
    // Inmunidad corta al chocar (3s), y DISPARAR la rompe (regla Free Fire)
    g.immuneUntil = g.matchTime + 3.0;
    for (const b of g.bots) b.immuneUntil = g.matchTime + 3.0;
    g.hud.showImmunity(3);
    const allyAlive = (g.player.isAlive ? 1 : 0) + g.bots.filter(b => b.team === 'ally' && b.isAlive).length;
    const enemyAlive = g.bots.filter(b => b.team === 'enemy' && b.isAlive).length;
    // Defensa en profundidad (B5): si la fase de compra dejó un equipo a cero,
    // cerrar la ronda de inmediato en vez de jugar 90s contra un mapa vacío.
    if (allyAlive === 0 || enemyAlive === 0) {
      this.endRound(enemyAlive === 0 ? 'ally' : 'enemy');
      return;
    }
  }

  // Fin de ronda: banner + oro → (Game decide: siguiente ronda o fin del duelo)
  endRound(winner) { // 'ally' | 'enemy' | 'draw'
    const g = this.g;
    if (g.phase === 'roundEnd') return;
    g.phase = 'roundEnd';
    g.hud.closeShop();
    g.shopOpenFlag = false;
    if (winner === 'ally') {
      g.roundWins.ally++;
      g.coins += 400;
      g.hud.showRoundBanner('¡RONDA GANADA!', `${g.roundWins.ally} — ${g.roundWins.enemy} · +400 ORO`, '#7dff9a');
    } else if (winner === 'enemy') {
      g.roundWins.enemy++;
      g.coins += 200;
      g.hud.showRoundBanner('RONDA PERDIDA', `${g.roundWins.ally} — ${g.roundWins.enemy} · +200 ORO`, '#ff6b7a');
    } else {
      g.coins += 100;
      g.hud.showRoundBanner('EMPATE', `${g.roundWins.ally} — ${g.roundWins.enemy} · +100 ORO`, '#facc15');
    }
    g.hud.updateTeamScore(g.roundWins.ally, g.roundWins.enemy, g.round, g.ROUND_TARGET);
    g.audio.play(winner === 'ally' ? 'win_round' : winner === 'enemy' ? 'lose_round' : 'ui');
    g._roundEndTime = g.matchTime;
  }

  // Tras el banner de ronda: otra ronda o fin del duelo (VICTORIA/DERROTA).
  afterRoundEnd() {
    const g = this.g;
    if (g.roundWins.ally >= g.ROUND_TARGET || g.roundWins.enemy >= g.ROUND_TARGET) {
      g.matchState = 'FINISHED';
      g.showResult(g.roundWins.ally > g.roundWins.enemy);
      return;
    }
    this.startRound(g.round + 1);
  }

  // Tick de la máquina de fases (desde Game.animate, SOLO en squad).
  tickPhase(dt) {
    const g = this.g;
    g.phaseTime -= dt;
    if (g.phase === 'buy') {
      g.hud.tickBuyPhase(g.phaseTime, g.BUY_TIME);
      if (g.phaseTime <= 0) this.startCombat();
    } else if (g.phase === 'combat') {
      g.hud.tickBuyPhase(-1, g.BUY_TIME); // oculta el contador de compra
      if (g.phaseTime <= 0) {
        // Tiempo agotado → gana el equipo con MÁS VIVOS (empate = ronda nula)
        const allyCount = (g.player.isAlive ? 1 : 0) + g.bots.filter(b => b.team === 'ally' && b.isAlive).length;
        const enemyCount = g.bots.filter(b => b.team === 'enemy' && b.isAlive).length;
        this.endRound(allyCount > enemyCount ? 'ally' : enemyCount > allyCount ? 'enemy' : 'draw');
      }
    } else if (g.phase === 'roundEnd') {
      if (g.matchTime - g._roundEndTime > 3.0) this.afterRoundEnd();
    }
  }
}
