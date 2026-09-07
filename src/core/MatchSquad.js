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
    g.buyDuration = n === 1 ? g.FIRST_BUY_TIME : g.BUY_TIME;
    g.phaseTime = g.buyDuration;
    g.teamScore.ally = 0;
    g.teamScore.enemy = 0;
    g.matchTime = 0;
    g._combatStarted = false;
    g._resetTemporalState();
    // Rutas de navegación de la ronda anterior mueren aquí (regla §4)
    if (g.navigation) g.navigation.reset();
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
    g.weaponSystem.resetAmmo();
    g.hud.update({ health: g.playerController.maxHealth, ammo: g.weaponSystem.getAmmoText(), kills: 0, deaths: 0, score: `${g.roundWins.ally} — ${g.roundWins.enemy}`, timeLeft: g.ROUND_TIME, fps: 60, pos: g.player.position, botCount: g.bots.length });
    g.hud.updateTeamScore(g.roundWins.ally, g.roundWins.enemy, n, g.ROUND_TARGET);
    // La compra manda en la pantalla: los controles táctiles se APAGAN
    // visualmente (atenuados, no interactivos) mientras la tienda está abierta.
    document.body.classList.add('buying');
    // TIENDA ANIMADA: se abre SOLA antes de cada ronda (estilo Free Fire)
    g.openShop();
  }

  // La IA "compra": mezcla determinista por bot+ronda que sube de tier, pero
  // COHERENTE con el ROL (entry cierra → escopeta/SMG, anchor controla → rifle):
  // el patrón jamás contradice al arma del personaje (regla de producto).
  _botBuy(roundN, bot) {
    const roll = (bot.id * 7 + roundN * 3) % 10;
    const roleIdx = bot.id % 7;                 // mismos índices que ROLE_PARAMS
    const isEntry = roleIdx === 0 || roleIdx === 3;
    const isAnchor = roleIdx === 2 || roleIdx === 5;
    if (roundN === 1) {
      if (isEntry) return roll < 4 ? 'shotgun' : 'pistol';
      return roll < 6 ? 'pistol' : 'smg';
    }
    if (isEntry) {           // agresivo: cierra distancia
      if (roll < 5) return 'shotgun';
      if (roll < 8) return 'smg';
      return 'rifle';
    }
    if (isAnchor) {          // control: media distancia estable
      if (roll < 6) return 'rifle';
      if (roll < 8) return 'smg';
      return 'shotgun';
    }
    if (roll < 4) return 'rifle'; // support: mezcla flexible
    if (roll < 6) return 'smg';
    if (roll < 8) return 'shotgun';
    return 'pistol';
  }

  // Fin de la fase de compra → ¡A LUCHAR!
  startCombat() {
    const g = this.g;
    g.phase = 'combat';
    g.phaseTime = g.ROUND_TIME;
    g._combatStarted = true;
    document.body.classList.remove('buying');
    g.hud.closeShop();
    g.shopOpenFlag = false;
    g.hud.showRoundBanner('¡A LUCHAR!', `RONDA ${g.round}`, '#ffd23f');
    g._maybeTouchHint(); // onboarding diferido: la tienda ya cerró
    // Inmunidad corta al chocar (3s), y DISPARAR la rompe (regla Free Fire)
    g.immuneUntil = g.matchTime + 3.0;
    for (const b of g.bots) b.immuneUntil = g.matchTime + 3.0;
    g.hud.showImmunity(3);
    const { ally, enemy } = this._aliveCounts();
    // Defensa en profundidad (B5): si la fase de compra dejó un equipo a cero,
    // cerrar la ronda de inmediato en vez de jugar 90s contra un mapa vacío.
    if (ally === 0 || enemy === 0) {
      this.endRound(enemy === 0 ? 'ally' : 'enemy');
      return;
    }
  }

  // Vivos por equipo (fuente única: el jugador + bots, misma fórmula en
  // eliminación y timeout — jamás una tercera cuenta divergente).
  _aliveCounts() {
    const g = this.g;
    return {
      ally: (g.player.isAlive ? 1 : 0) + g.bots.filter(b => b.team === 'ally' && b.isAlive).length,
      enemy: g.bots.filter(b => b.team === 'enemy' && b.isAlive).length,
      allyHP: (g.player.isAlive ? g.playerController.health : 0) + g.bots.filter(b => b.team === 'ally' && b.isAlive).reduce((s, b) => s + b.health, 0),
      enemyHP: g.bots.filter(b => b.team === 'enemy' && b.isAlive).reduce((s, b) => s + b.health, 0),
    };
  }

  // El reloj de combate es un watchdog sin resultado de producto. Si ambos
  // equipos siguen vivos, reabre rutas y empuja a bots hacia contacto; jamás
  // regala puntos ni introduce una tercera salida.
  _breakStall() {
    const g = this.g;
    g.phaseTime = 14;
    for (const bot of g.bots) if (bot.isAlive && bot.forceEngagement) bot.forceEngagement();
    console.info(`[MATCH] watchdog R${g.round}: reencauzando combate, sin adjudicar ronda`);
  }

  // Fin de ronda: solo eliminación de un equipo → oro + feedback → siguiente.
  endRound(winner) { // 'ally' | 'enemy'
    const g = this.g;
    if (g.phase === 'roundEnd') return;
    if (winner !== 'ally' && winner !== 'enemy') throw new Error(`Round winner inválido: ${winner}`);
    g.phase = 'roundEnd';
    const { ally, enemy } = this._aliveCounts();
    const reason = `eliminacion A${ally}/E${enemy}`;
    console.log(`[MATCH] ronda ${g.round} fin — ${reason} → ${winner}`);
    document.body.classList.remove('buying');
    g.hud.closeShop();
    g.shopOpenFlag = false;
    if (winner === 'ally') {
      g.roundWins.ally++;
      g.coins += 400;
      g.hud.showRoundBanner('¡RONDA GANADA!', `${g.roundWins.ally} — ${g.roundWins.enemy} · +400 ORO`, '#7dff9a');
    } else {
      g.roundWins.enemy++;
      g.coins += 200;
      g.hud.showRoundBanner('RONDA PERDIDA', `${g.roundWins.ally} — ${g.roundWins.enemy} · +200 ORO`, '#ff6b7a');
    }
    g.hud.updateTeamScore(g.roundWins.ally, g.roundWins.enemy, g.round, g.ROUND_TARGET);
    g.hud.showRoundResult(winner);
    g.audio.play(winner === 'ally' ? 'win_round' : 'lose_round');
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
      g.hud.tickBuyPhase(g.phaseTime, g.buyDuration || g.BUY_TIME);
      if (g.phaseTime <= 0) this.startCombat();
    } else if (g.phase === 'combat') {
      g.hud.tickBuyPhase(-1, g.buyDuration || g.BUY_TIME); // oculta el contador de compra
      if (g.phaseTime <= 0) {
        this._breakStall();
      }
    } else if (g.phase === 'roundEnd') {
      if (g.matchTime - g._roundEndTime > 2.1) this.afterRoundEnd();
    }
  }
}
