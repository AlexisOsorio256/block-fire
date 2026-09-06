// ── DamageNumbers — números flotantes de daño (dueño único) ──
// feedback de daño infligido: body = claro, headshot = destacado, kill = rojo.
// Pool de Nodos DOM FIJO (nunca se crean nodos por disparo — reglas §6);
// posición proyectada mundo→pantalla en update() desde el loop de Game.
// La escopeta acumula sus postas en UN número por víctima y disparo
// (WeaponSystem agrupa por target y llama show() una vez con el total).

import * as THREE from '../lib/three.module.js';

const POOL_SIZE = 14;

export class DamageNumbers {
  constructor(camera) {
    this.camera = camera;
    this.pool = [];
    for (let i = 0; i < POOL_SIZE; i++) {
      const el = document.createElement('div');
      el.className = 'dmg-num';
      el.style.display = 'none';
      document.getElementById('hud').appendChild(el);
      this.pool.push({ el, life: 0, maxLife: 0, world: null, rise: 0 });
    }
    this._v = new THREE.Vector3();
  }

  // amount: daño REAL post-falloff (ya sumado por víctima). head: headshot.
  // point: punto de impacto (mundo). killed: la víctima murió con este golpe.
  show(amount, point, head, killed) {
    // slot libre o el de vida más baja (reciclaje)
    let slot = this.pool[0];
    for (const s of this.pool) { if (s.life <= 0) { slot = s; break; } if (s.life < slot.life) slot = s; }
    slot.life = slot.maxLife = killed ? 0.9 : 0.65;
    slot.world = point.clone();
    slot.rise = 0;
    slot.el.textContent = String(Math.round(amount));
    slot.el.classList.toggle('head', !!head);
    slot.el.classList.toggle('kill', !!killed);
    slot.el.style.display = 'block';
  }

  update(dt) {
    for (const s of this.pool) {
      if (s.life <= 0) continue;
      s.life -= dt;
      if (s.life <= 0) { s.el.style.display = 'none'; s.world = null; continue; }
      if (!s.world) continue;
      s.rise += dt * 0.8; // deriva ascendente en mundo (no DOM: 1 transform/frame)
      const p = this._v.set(s.world.x, s.world.y + s.rise, s.world.z);
      p.project(this.camera);
      // detrás de la cámara → ocultar sin destruir el pool
      if (p.z > 1) { s.el.style.opacity = '0'; continue; }
      const x = (p.x * 0.5 + 0.5) * window.innerWidth;
      const y = (-p.y * 0.5 + 0.5) * window.innerHeight;
      const k = s.life / s.maxLife;
      s.el.style.opacity = String(Math.min(1, k * 2.2));
      s.el.style.transform = `translate(-50%,-50%) translate(${x.toFixed(0)}px, ${(y - (1 - k) * 18).toFixed(0)}px)`;
    }
  }

  // fin de partida: el pool vuelve a cero (regla §4)
  reset() {
    for (const s of this.pool) { s.life = 0; s.el.style.display = 'none'; s.world = null; }
  }
}
