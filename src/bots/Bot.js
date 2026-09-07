import * as THREE from '../lib/three.module.js';
import { AvatarLib } from '../characters/SoldierAvatar.js';
import { MAX_HEALTH } from '../core/CombatRules.js';

// ── Scratch a nivel de módulo (reglas §6: cero allocs por frame) ──
// Bot.update corre 7× por frame, SIEMPRE en secuencia y nunca reentrante:
// un único set de vectores reutilizables. NINGUNO escapa por el return.
const S = {
  eye: new THREE.Vector3(),    // ojo del bot (LOS)
  chest: new THREE.Vector3(),  // pecho del candidato
  dir: new THREE.Vector3(),    // dirección LOS / puntería
  move: new THREE.Vector3(),   // vector de movimiento del frame
  wish: new THREE.Vector3(),   // velocidad deseada
  next: new THREE.Vector3(),   // posición candidata
  axis: new THREE.Vector3(),   // sondeo por eje (X y luego Z)
  toA: new THREE.Vector3(),    // hacia el ancla (aliados)
  toT: new THREE.Vector3(),    // hacia el objetivo
  strafe: new THREE.Vector3(), // strafe perpendicular
  fwd: new THREE.Vector3(),    // frente del bot
  wp: new THREE.Vector3(),     // waypoint actual de navegación
};
const UP = new THREE.Vector3(0, 1, 0);
const CANDIDATES = []; // objetivos enemigos del frame (reutilizado)

// ROLES EMERGENTES por parámetros (no clases): variaciones de distancia
// preferida, agresividad, reacción y lane. El id del bot fija el rol:
// 0/3 → entry (agresivo), 1/4 → support, 2/5 → anchor, 6 → support.
const ROLE_PARAMS = [
  { prefDist: 7,  aggro: 1.25, react: 0.16, laneBias: 0.7  }, // entry
  { prefDist: 11, aggro: 0.95, react: 0.28, laneBias: 0.0  }, // support
  { prefDist: 14, aggro: 0.7,  react: 0.38, laneBias: -0.7 }, // anchor
  { prefDist: 7,  aggro: 1.25, react: 0.18, laneBias: -0.7 }, // entry
  { prefDist: 11, aggro: 0.95, react: 0.25, laneBias: 0.7  }, // support
  { prefDist: 14, aggro: 0.75, react: 0.35, laneBias: 0.0  }, // anchor
  { prefDist: 9,  aggro: 1.0,  react: 0.22, laneBias: 0.0  }, // support
];

// COMPORTAMIENTO DEL ARSENAL PARA BOTS (tabla única, sin clases por arma):
// la distancia preferida y la agresividad NACEN del arma en la mano y las
// MODULA el rol (entry empuja, anchor frena — ver preferredDist()).
const WEAPON_RANGE = {
  shotgun: { prefDist: 5.5, aggro: 1.35, range: 24 }, // cierra a quemarropa
  smg:     { prefDist: 9.0, aggro: 1.10, range: 75 }, // presión móvil corto/medio
  rifle:   { prefDist: 12,  aggro: 0.95, range: 120 }, // medio: no se pega al enemigo
  pistol:  { prefDist: 10,  aggro: 0.85, range: 90 }, // conservadora/backup
};

// Distancia preferida efectiva: el arma pone la base, el rol modula
// (prefDist del rol normalizado a 11 = neutro). El rol NUNCA sustituye al arma.
// Exportada para la suite (contrato: distancia táctica según arma).
export function preferredDist(role, weaponKey) {
  const w = WEAPON_RANGE[weaponKey] || WEAPON_RANGE.rifle;
  return w.prefDist * (role.prefDist / 11);
}

export class Bot {
  constructor(id, scene, map, position, navigation = null) {
    this.id = id;
    this.isBot = true;
    this.isAlive = true;
    this.map = map;
    this.scene = scene;
    this.navigation = navigation; // dueño de rutas (inyectado por Game; null → steering puro)
    // Snap spawn Y to actual ground (covers platforms correctly)
    const gy = map ? map.getGroundY(position.x, position.z) : 0;
    this.position = new THREE.Vector3(position.x, gy + 1.65, position.z);
    this.health = MAX_HEALTH;
    this.maxHealth = MAX_HEALTH;
    this.kills = 0;
    this.deaths = 0;

    this.yaw = Math.random() * Math.PI * 2;
    this.targetYaw = this.yaw;
    this.pitch = 0;

    this.velocity = new THREE.Vector3();
    // Ritmo por operador: rompe la marcha sincronizada sin convertir a nadie
    // en aimbot ni depender de suerte que vuelve imposible reproducir bugs.
    this._tempo = 0.88 + (id % 5) * 0.055;
    this.speed = 3.55 * this._tempo;
    this.sprintSpeed = 5.0;

    this.height = 1.65;
    this.radius = 0.38;

    this.mesh = this._createMesh();
    scene.add(this.mesh);

    // Head mesh for headshot
    this.headMesh = this.mesh.getObjectByName('head');

    // AI state
    this.state = 'wander'; // wander, chase, attack
    this.team = 'enemy';
    this.target = null;
    this.stateTimer = 0;
    this.wanderDir = new THREE.Vector3((Math.random()-0.5), 0, (Math.random()-0.5)).normalize();
    this.shootCooldown = 0;
    this.strafeDir = Math.random() > 0.5 ? 1 : -1;
    this.strafeTimer = 0;
    // INTENCIÓN (anti-idle P0): segundos de ronda SIN contacto de ningún tipo
    // (target, memoria o daño recibido). Al superarlo, el bot toma un objetivo
    // táctico barato (centro/lanes) en vez de deambular: el mapa no se queda
    // con "todos paseándose" hasta el timeout. Se resetea en cada respawn.
    this._noContactT = 0;
    this._tacticalGoal = null;

    // Memoria CORTA del último enemigo visto (reacciona como humano, no como radar):
    // recordar posición ~1.5s tras perder LOS; prescinde del target luego.
    this._lastSeen = null;       // {x,z,ttl}
    this._reactWait = 0;         // tiempo de reacción restante al adquirir objetivo
    this._noShootTime = 0;       // tiempo sin poder disparar con LOS → reubicarse
    this._flankT = 0;            // reubicación lateral en curso (límite temporal)
    this._laneSeed = (id % 2 === 0) ? 1 : -1; // flanco preferido coherente por bot
    this._flankDir = this._laneSeed; // lado del flanqueo (alterna por intento)
    this._recoveryGoal = new THREE.Vector3();
    this._recoveryT = 0;
    this._blockedT = 0;
    this._navDebug = { waypoint: null, pathFailures: 0, collisionAttempts: 0, stuckRecoveries: 0, distanceWindow: 0, effectiveSpeed: 0 };

    // CLASH SQUAD: arma comprada por ronda (la IA "compra" en la fase de compra)
    this.weaponKey = 'pistol';

    // Avatar GLB real: se inyecta cuando AvatarLib termina de cargar; hasta
    // entonces (o si falla) la malla simple de arriba es el personaje.
    this._avatar = null;
    this._fallbackParts = [];
  }

  // Reemplaza el cuerpo de fallback por el soldado GLB animado (mismo group:
  // posición/rotación/muerte/respawn siguen operando igual).
  // Compra en la fase de compra: cambia el arma VISIBLE en la mano.
  // Ruta principal: GLB real; el fallback solo vive si el asset falla.
  setWeapon(key) {
    this.weaponKey = key;
    if (!this._avatar || !AvatarLib.ready) return;
    if (this._avatar.triggerAction) this._avatar.triggerAction('swap');
    // localizar el gunPivot (hijo de la mano derecha) y swap el modelo
    const oldGun = this._gunPivot && this._gunPivot.children[0];
    const teamColor = this.team === 'ally' ? 0x2ee86e : 0xff5a4a;
    const mount = (gun) => {
      if (!this._gunPivot) return;
      const prev = this._gunPivot.children[0];
      if (prev) this._gunPivot.remove(prev);
      this._gunPivot.add(gun);
    };
    // Fallback inmediato (feedback de compra sin esperar red/disco)…
    mount(AvatarLib.makeHeldWeapon(key, teamColor));
    // …y GLB real cuando llegue (reemplaza el fallback en el mismo pivote)
    AvatarLib.makeHeldWeaponGlb(key).then((glb) => { if (glb) mount(glb); });
  }

  attachAvatar() {
    if (!AvatarLib.ready || this._avatar) return;
    const gun = AvatarLib.makeHeldWeapon(this.weaponKey,
      this.team === 'ally' ? 0x2ee86e : 0xff5a4a);
    const av = AvatarLib.create({ team: this.team || 'enemy', weapon: gun, operator: this.id });
    if (!av) return;
    this._avatar = av;
    av.root.scale.setScalar(1.15); // presencia: personajes más grandes (pedido del usuario)
    av.setGrounded();
    // AvatarLib.create expone el pivote de forma explícita: es hermano del
    // esqueleto y se ancla a la mano por frame. Buscarlo bajo el hueso hacía
    // que compras posteriores cambiaran la lógica, pero no el arma visible.
    this._gunPivot = av.gunPivot || null;
    // Ocultar piezas de fallback (conservar el grupo: Game las posiciona igual)
    this._fallbackParts = this.mesh.children.filter(c => c !== av.root).map(c => { c.userData.__wasVisible = c.visible; return c; });
    for (const c of this._fallbackParts) c.visible = false;
    this.mesh.add(av.root);
  }

  _createMesh() {
    const group = new THREE.Group();

    // 7 OWN outfit presets — each bot reads as a distinct operator at a
    // glance (palette + gear + silhouette). Diseños originales y legibles.
    const OUTFITS = [
      { name: 'assault',  body: 0xb0453c, pants: 0x2a2f3a, gear: 0x39445c, crest: true  }, // asalto rojo oscuro + cresta
      { name: 'urban',    body: 0x5a6b80, pants: 0x3a4250, gear: 0x8b97a8, pads:  true },  // urbano gris-azul
      { name: 'tactical', body: 0x3d4a3a, pants: 0x2b332b, gear: 0x556b52, pack:  true },  // táctico verde
      { name: 'scout',    body: 0xc2a35a, pants: 0x6e5a34, gear: 0x2e3950, hood:  true },  // explorador arena
      { name: 'heavy',    body: 0x4a3540, pants: 0x302229, gear: 0x6e2f3c, bulky: true },  // pesado oscuro
      { name: 'raider',   body: 0xd97b2d, pants: 0x4a3a2a, gear: 0x8a44d9, crest: true },  // paleta colorida
      { name: 'nightops', body: 0x232a38, pants: 0x181d28, gear: 0x39d7ff, pads:  true },  // ops nocturno
    ];
    const outfit = OUTFITS[this.id % OUTFITS.length];
    const bodyMat = new THREE.MeshStandardMaterial({ color: outfit.body, roughness: 0.7 });
    const darkMat = new THREE.MeshStandardMaterial({ color: outfit.pants, roughness: 0.65 });
    const gearMat = new THREE.MeshStandardMaterial({ color: outfit.gear, roughness: 0.6, metalness: 0.15 });
    // Per-skin visor color: each bot reads as a distinct "operator"
    const visorColors = [0x8844ff, 0xff8329, 0x39d7ff, 0xff3d71, 0x9dff3d, 0xffd23f, 0x4dffd2];
    const visorMat = new THREE.MeshStandardMaterial({
      color: 0x10141f, roughness: 0.3, metalness: 0.5,
      emissive: visorColors[this.id % visorColors.length], emissiveIntensity: 1.15
    });

    // Torso — slightly broader than the old 0.62: presence without touching
    // the 0.55 hitbox sphere (visual stays inside it).
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.9, 0.4), bodyMat);
    body.position.y = 0.9;
    body.castShadow = true;
    group.add(body);
    // Chest plate + GLOW STRIPE: the emissive stripe gives every skin a
    // readable signature at distance (vision audit: dark earth tones blended
    // with the map — the glow stripe fixes target acquisition, not just style).
    const chest = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.36, 0.22), gearMat);
    chest.position.set(0, 1.02, 0.22);
    group.add(chest);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.07, 0.03), visorMat);
    stripe.position.set(0, 1.14, 0.245);
    group.add(stripe);
    // Belt
    const belt = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.1, 0.42), darkMat);
    belt.position.y = 0.52;
    group.add(belt);

    // Head + glowing visor (enemy readability)
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.45, 0.45), darkMat);
    head.position.y = 1.55;
    head.name = 'head';
    head.castShadow = true;
    group.add(head);
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.37, 0.12, 0.05), visorMat);
    visor.position.set(0, 1.57, 0.24);
    group.add(visor);
    this._visorMat = visorMat;

    // GEAR per outfit — silhouette variation you can read mid-fight
    if (outfit.crest) {
      const crest = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.16, 0.3), visorMat);
      crest.position.set(0, 1.84, 0);
      group.add(crest);
    }
    if (outfit.hood) {
      const hood = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.2, 0.5), gearMat);
      hood.position.set(0, 1.78, 0);
      group.add(hood);
    }
    if (outfit.pads) {
      const padGeo = new THREE.BoxGeometry(0.26, 0.15, 0.32);
      const padL = new THREE.Mesh(padGeo, gearMat); padL.position.set(-0.48, 1.28, 0); group.add(padL);
      const padR = new THREE.Mesh(padGeo, gearMat); padR.position.set(0.48, 1.28, 0); group.add(padR);
    }
    if (outfit.pack) {
      const pack = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.42, 0.18), gearMat);
      pack.position.set(0, 1.05, -0.26); group.add(pack);
      const ant = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.4, 0.03), visorMat);
      ant.position.set(0.12, 1.44, -0.32); group.add(ant);
    }
    if (outfit.bulky) {
      // Heavy: extra armor slabs on chest and hips
      const slabL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.5, 0.3), gearMat);
      slabL.position.set(-0.42, 0.95, 0); group.add(slabL);
      const slabR = slabL.clone(); slabR.position.x = 0.42; group.add(slabR);
    }

    // ARMS with SHOULDER PIVOTS — real walk-cycle swing, not position bob.
    // The pivot sits at the shoulder; the arm hangs below and rotates in Z.
    const makeArm = (side) => {
      const pivot = new THREE.Group();
      pivot.position.set(side * 0.47, 1.12, 0);          // shoulder height (clear of the 0.72 torso)
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.55, 0.18), bodyMat);
      arm.position.y = -0.28;                            // hangs from pivot
      arm.castShadow = true;
      pivot.add(arm);
      group.add(pivot);
      return pivot;
    };
    this._lArm = makeArm(-1);
    this._rArm = makeArm(1);

    // LEGS with HIP PIVOTS — knees lift forward/back like a stride.
    const makeLeg = (side) => {
      const pivot = new THREE.Group();
      pivot.position.set(side * 0.17, 0.62, 0);          // hip height (inside the 0.74 belt)
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.62, 0.24), darkMat);
      leg.position.y = -0.31;                            // hangs from pivot
      leg.castShadow = true;
      pivot.add(leg);
      group.add(pivot);
      return pivot;
    };
    this._lLeg = makeLeg(-1);
    this._rLeg = makeLeg(1);

    // Rifle de fallback en la cadera (parentado al brazo derecho)
    const gun = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, 0.58), darkMat);
    gun.position.set(0.42, 0.85, 0.35);
    group.add(gun);

    // group.position is feet position; mesh is 1.76 tall vs collider 1.65
    // so feet are exactly on groundY when group.y = position.y - height
    group.position.copy(this.position);
    group.position.y -= this.height;

    // Silhouette variation per outfit (scaled from the FEET — group origin —
    // so taller/wider bots keep their feet on the ground). Hitboxes unchanged.
    const SIL = { assault: [1.0, 1.0], urban: [1.02, 0.99], tactical: [1.04, 1.02], scout: [0.92, 0.96], heavy: [1.14, 1.07], raider: [0.98, 1.01], nightops: [0.98, 1.0] };
    const s = SIL[outfit.name] || [1, 1];
    group.scale.set(s[0], s[1], s[0]);

    return group;
  }

  takeDamage(amount, hitType, attacker) {
    if (!this.isAlive) return false;
    if (attacker && attacker.team && attacker.team === this.team) return false; // fuego amigo OFF
    this.health -= amount;
    if (this._avatar && this._avatar.triggerAction) this._avatar.triggerAction('hit');
    // Hit flinch: short knockback away from the attacker — visible hit confirm
    if (attacker && this.mesh) {
      const away = new THREE.Vector3().subVectors(this.position, attacker.position);
      away.y = 0;
      if (away.lengthSq() > 0.0001) {
        away.normalize().multiplyScalar(hitType === 'head' ? 0.5 : 0.3);
        const next = this.position.clone().add(away);
        if (!this.map.checkCollision(next, this.radius, this.height)) {
          this.position.copy(next);
        }
        this._flinchT = 0.12;
      }
    }
    // Hit flash on body materials only (visor keeps its own glow)
    if (this.mesh) {
      const flashed = [];
      this.mesh.children.forEach(c => {
        if (c.material && c.material.emissive && c.material !== this._visorMat) {
          c.userData._savedEmissive = c.material.emissive.getHex();
          c.material.emissive.setHex(0xff2222);
          flashed.push(c);
        }
      });
      if (flashed.length) {
        // Timer con dueño: si el bot muere/reaparece antes de los 80ms, el
        // restore caducado tocaba los materiales NUEVOS del respawn.
        this._flashGen = (this._flashGen || 0) + 1;
        const gen = this._flashGen;
        clearTimeout(this._flashTimer);
        this._flashTimer = setTimeout(()=> {
          if (gen !== this._flashGen) return;
          flashed.forEach(c => {
            if (c.material && c.userData._savedEmissive !== undefined) {
              c.material.emissive.setHex(c.userData._savedEmissive);
            }
          });
        }, 80);
      }
    }
    if (this.health <= 0) {
      this.health = 0;
      this.isAlive = false;
      // DEATH Tumble: visible 0.6s — fall back + spin, then hide. The Game
      // VFX loop drives _dyingT so no new timer system is needed.
      this._dyingT = 0.6;
      if (this._avatar && this._avatar.triggerAction) this._avatar.triggerAction('death');
      this._dyingDir = attacker ? Math.atan2(
        this.position.x - attacker.position.x,
        this.position.z - attacker.position.z
      ) : this.yaw;
      return true;
    }
    return false;
  }

  // Animación de la caída — la maneja Game desde su loop (así no hay un
  // sistema de timers nuevo). Devuelve false cuando la animación terminó.
  _updateDying(dt) {
    if (this._dyingT <= 0) return false;
    this._dyingT -= dt;
    const k = Math.max(0, this._dyingT / 0.6); // 1 → 0
    if (this.mesh) {
      // Tilt backward around the base, away from the killer
      this.mesh.rotation.y = this.yaw;
      this.mesh.rotation.x = (1 - k) * (Math.PI / 2) * 0.9; // fall back
      this.mesh.position.y = this.position.y - this.height - (1 - k) * 0.25; // slight sink
      // Fade out at the end so the hide isn't a pop
      const fade = Math.min(1, k * 3);
      this.mesh.traverse(o => { if (o.material) { o.material.transparent = true; o.material.opacity = fade; } });
      if (this._dyingT <= 0) {
        this.mesh.visible = false;
        // Restore materials for next respawn (opacity/transparent are shared
        // per-bot instances, reset once here)
        this.mesh.traverse(o => { if (o.material) { o.material.opacity = 1; o.material.transparent = false; } });
      }
    }
    return this._dyingT > 0;
  }

  respawn(pos) {
    // pos may be a spawn point with stale Y — always snap to ground
    const gy = this.map ? this.map.getGroundY(pos.x, pos.z) : 0;
    this.position.set(pos.x, gy + this.height, pos.z);
    this.health = this.maxHealth;
    this.isAlive = true;
    this._dyingT = 0;
    this._flashGen = (this._flashGen || 0) + 1; // cancela el restore de hit-flash pendiente
    // El fade de muerte (_updateDying) pudo interrumpirse (fin de ronda sin
    // respawn): sin este reset el bot reaparece semitransparente.
    this.mesh.traverse(o => { if (o.material) { o.material.opacity = 1; o.material.transparent = false; } });
    this.mesh.visible = true;
    this.mesh.rotation.set(0, this.yaw, 0);
    this.mesh.position.copy(this.position);
    this.mesh.position.y -= this.height;
    this.velocity.set(0,0,0);
    this._stridePhase = 0;
    this.yaw = Math.random() * Math.PI * 2;
    this.targetYaw = this.yaw;
    this.state = 'wander';
    this.stateTimer = 0;
    // Memoria táctica muere con el respawn (regla §4: reset a limpio)
    this._lastSeen = null;
    this._reactWait = 0;
    this._noShootTime = 0;
    this._flankT = 0;
    this._noContactT = 0;
    this._tacticalGoal = null;
    this._stuckT = 0;
    this._stuckAnchor = null;
    this._recoveryT = 0;
    this._blockedT = 0;
    this._navDebug.waypoint = null;
    this._navDebug.distanceWindow = 0;
    this._navDebug.effectiveSpeed = 0;
    if (this.navigation) this.navigation.reset(this.id);
    if (this._avatar) {
      this._avatar.resetAction();
      this._avatar.setMoving(false);
      this._avatar.setGrounded();
    }
  }

  // Watchdog de ronda: no teletransporta ni daña. Solo invalida la ruta que
  // dejó de ser útil y hace que este operador tome una línea de choque nueva.
  forceEngagement() {
    this._lastSeen = null;
    this._noContactT = 11;
    this._tacticalGoal = { x: this._laneSeed * 5, z: 0 };
    this.state = 'wander';
    this.stateTimer = 0;
    this._flankT = 1.0;
    this._flankDir = -this._flankDir;
    if (this.navigation) this.navigation.reset(this.id);
  }

  // Choose a short escape whose entire segment is clear. Recovery goals used
  // to be a single lateral point that could itself be behind the same wall;
  // Navigation then faithfully routed the bot back into the trap.
  _startRecovery(map) {
    if (this.navigation) this.navigation.reset(this.id);
    this.strafeDir = -this.strafeDir;
    this._flankT = 1.2;
    this._flankDir = -this._flankDir;
    this._recoveryT = 1.15;
    const side = this._flankDir;
    let found = false;
    for (let option = 0; option < 4 && !found; option++) {
      let angle, distance;
      if (option === 0) { angle = this.yaw + Math.PI * 0.5 * side; distance = 4.2; }
      else if (option === 1) { angle = this.yaw - Math.PI * 0.5 * side; distance = 4.2; }
      else if (option === 2) { angle = this.yaw + Math.PI; distance = 3.0; }
      else { angle = this.yaw; distance = 2.0; }
      let clear = true;
      for (let step = 1; step <= 4; step++) {
        const t = distance * step / 4;
        S.axis.set(this.position.x + Math.sin(angle) * t, this.position.y, this.position.z + Math.cos(angle) * t);
        if (map && map.checkCollision(S.axis, this.radius, this.height)) { clear = false; break; }
      }
      if (clear) {
        this._recoveryGoal.set(this.position.x + Math.sin(angle) * distance, 0, this.position.z + Math.cos(angle) * distance);
        found = true;
      }
    }
    if (!found) this._recoveryGoal.set(this.position.x, 0, this.position.z);
    this._blockedT = 0;
    this._navDebug.stuckRecoveries++;
  }

  // Snapshot DEV explícito: permite observar el comportamiento real sin
  // dejar overlays de producción ni arrays nuevos en el update por frame.
  getNavigationDebug() {
    const d = this._navDebug;
    return {
      id: this.id,
      state: this.state,
      target: this.target ? (this.target.operatorName || this.target.name || 'player') : null,
      waypoint: d.waypoint ? { x: d.waypoint.x, z: d.waypoint.z } : null,
      effectiveSpeed: d.effectiveSpeed,
      distanceWindow: d.distanceWindow,
      pathFailures: d.pathFailures,
      collisionAttempts: d.collisionAttempts,
      stuckRecoveries: d.stuckRecoveries,
    };
  }

  update(dt, player, bots, map) {
    if (!this.isAlive) return null; // returns action

    this.stateTimer += dt;
    this.shootCooldown = Math.max(0, this.shootCooldown - dt);
    this.strafeTimer -= dt;
    const role = ROLE_PARAMS[this.id % ROLE_PARAMS.length];
    const weaponProfile = WEAPON_RANGE[this.weaponKey] || WEAPON_RANGE.pistol;
    // Bots can notice a real, unobstructed opponent farther away now that the
    // weapons support it, but contact remains bounded so they do not become a
    // map-wide radar. Shotguns still force a close encounter.
    const contactRange = Math.min(48, Math.max(24, weaponProfile.range * 0.75));

    // ── ADQUISICIÓN DE OBJETIVO (con memoria corta y reacción) ──
    // SOLO el equipo contrario (Duelo de Escuadras). Búsqueda por LOS como
    // antes, pero el objetivo VISTO necesita this._reactWait (tiempo de
    // reacción del rol) antes de dispararse; al perder LOS, la posición se
    // recuerda ~1.5s (memoria corta) y luego decae — nada de radar eterno.
    let nearest = null;
    let nearestDist = Infinity;
    const myTag = (t) => (t.team || (t === player ? 'ally' : 'enemy'));
    CANDIDATES.length = 0;
    for (const t of bots) if (t !== this && t.isAlive && myTag(t) !== this.team) CANDIDATES.push(t);
    if (player !== this && player.isAlive && myTag(player) !== this.team) CANDIDATES.push(player);
    for (const c of CANDIDATES) {
      const d = this.position.distanceTo(c.position);
      if (d < nearestDist && d < contactRange) {
        S.eye.copy(this.position); S.eye.y -= 0.12;
        S.chest.copy(c.position); S.chest.y -= 0.35;
        S.dir.subVectors(S.chest, S.eye).normalize();
        const dist = S.eye.distanceTo(S.chest);
        const hit = map.raycast(S.eye, S.dir, dist);
        // OCLUSIÓN REAL SIEMPRE (sin excepción de proximidad): un enemigo tras
        // un muro NO se adquiere aunque esté a <8u — los bots no tienen
        // wallhack. Corta distancia ≠ visión a través de geometría.
        if (!hit) { nearest = c; nearestDist = d; }
      }
    }
    if (nearest) {
      // Objetivo NUEVO → arrancar tiempo de reacción; el mismo → mantener
      if (this.target !== nearest) this._reactWait = role.react;
      this._lastSeen = { x: nearest.position.x, z: nearest.position.z, ttl: 1.5 };
      this._noContactT = 0; // contacto = ver enemigo
    } else if (this._lastSeen) {
      this._lastSeen.ttl -= dt;
      if (this._lastSeen.ttl <= 0) this._lastSeen = null;
    }
    this.target = nearest;

    // ── State machine (con memoria: chase a la ÚLTIMA POSICIÓN VISTA) ──
    // El umbral de ataque usa la distancia efectiva del ARMA+rol.
    const prefDistNow = preferredDist(role, this.weaponKey);
    // ANTI-IDLE (P0): sin target, sin memoria y sin daño recibido durante
    // demasiado tiempo → la ronda se está muriendo en un paseo. Tras el umbral
    // el bot toma un OBJETIVO TÁCTICO BARATO (centro/lanes: zonas de conflicto
    // donde el combate pasa; jamás posiciones ocultas del enemigo). Dura hasta
    // que el contacto llegue (entonces el flujo normal de chase/attack manda).
    this._noContactT += dt;
    const IDLE_LIMIT = 10;
    if ((nearest || this._lastSeen || this._flinchT > 0)) {
      this._noContactT = 0;
      this._tacticalGoal = null;
    } else if (this._noContactT > IDLE_LIMIT && !this._tacticalGoal) {
      this._tacticalGoal = this._pickTacticalGoal();
      this._noContactT = 0;
      this.stateTimer = 0;
    }
    if (this._tacticalGoal && (nearest || this._lastSeen)) this._tacticalGoal = null;

    const shootRange = Math.min(contactRange, weaponProfile.range * 0.92);
    if (nearest && nearestDist < Math.max(prefDistNow + 8, shootRange)) {
      this.state = 'attack';
    } else if (nearest) {
      this.state = 'chase';
    } else if (this._lastSeen && this.state !== 'idle') {
      // perdió LOS: perseguir la última posición vista (investigar) mientras
      // la memoria viva — se comporta como jugador, no como radar
      this.state = this.state === 'wander' ? 'wander' : 'chase';
    } else {
      if (this.state === 'attack' || this.state === 'chase') { this.state = 'wander'; this.stateTimer = 0; }
      if (this.stateTimer > 3 + Math.random()*2) {
        this.state = 'wander';
        this.stateTimer = 0;
        this.wanderDir.set((Math.random()-0.5), 0, (Math.random()-0.5)).normalize();
      }
    }

    const move = S.move;
    let wantShoot = false;
    let lookAtTarget = false;
    const nav = this.navigation;
    let wp = null; // waypoint activo de navegación (solo si nav disponible)

    // ── Utilidad de ruta: destino según estado ──
    let goalX = null, goalZ = null;
    if (this.state === 'chase') {
      const g = nearest ? nearest.position : this._lastSeen;
      if (g) { goalX = g.x; goalZ = g.z; }
    } else if (this.state === 'attack' && nearest && this._flankT > 0) {
      // REPOSICIONAMIENTO LATERAL: punto perpendicular al objetivo (flanqueo
      // corto por Navigation) — no empujar pared, no radar: moverse a un sitio
      // con ángulo de tiro. Límite temporal: _flankT decae en el ataque.
      const dx = nearest.position.x - this.position.x;
      const dz = nearest.position.z - this.position.z;
      const len = Math.hypot(dx, dz) || 1;
      goalX = this.position.x + (-dz / len) * this._flankDir * 6;
      goalZ = this.position.z + (dx / len) * this._flankDir * 6;
    } else if (this.state === 'wander') {
      // OBJETIVO TÁCTICO anti-idle: moverse hacia una zona de conflicto
      // (determinada SIN ver posiciones ocultas) tiene prioridad en wander.
      if (this._tacticalGoal) {
        goalX = this._tacticalGoal.x; goalZ = this._tacticalGoal.z;
        // llegado a la zona (o sin ruta hacia ella: celda muerta por el
        // jitter): CRUZAR al extremo contrario de la base — patrulla N-S con
        // propósito (el contacto llega al CRUZAR la arena, no al zigzaguear
        // alrededor de la casa central).
        const nearGoal = Math.hypot(goalX - this.position.x, goalZ - this.position.z) < 4;
        const recG = nav && nav._paths ? nav._paths.get(this.id) : null;
        const noRoute = nav && wp === null && recG && recG.at >= 0 && this.stateTimer > 2.5;
        if (nearGoal || noRoute) {
          // enemigo (base norte, z<0) cruza a z>0; aliado cruza a z<0
          const cross = (this.team === 'enemy' ? 1 : -1) * this.map.size * 0.32;
          this._tacticalGoal = { x: (Math.random() - 0.5) * 8, z: cross + (Math.random() - 0.5) * 6 };
          goalX = this._tacticalGoal.x; goalZ = this._tacticalGoal.z;
        }
      }
      // ALIADOS con ancla: reagruparse cerca del jugador SOLO si el jugador
      // avanza (el ancla vive en SU base si el jugador no se mueve → la
      // escuadra entera pasaba 90s en spawn). El anti-idle (goal táctico al
      // centro) manda sobre el ancla: salir de spawn con propósito.
      else if (this.team === 'ally' && player && player.isAlive && this._tacticalGoal === null && this._noContactT < IDLE_LIMIT) {
        const spread = (this.id - 1) * 2.2; // aliado 0..2 → -2.2, 0, +2.2
        const side = this._laneSeed;
        goalX = player.position.x + side * (3 + Math.abs(spread)) + spread * 0.3;
        goalZ = player.position.z + this._laneSeed * 2.5;
      } else if (this.stateTimer > 3 + Math.random()*2) {
        this.stateTimer = 0;
        // ENEMIGOS en wander: presionar por LANE (no wander aleatorio eterno):
        // cruzar hacia la base contraria por el flanco de su laneSeed
        goalX = this._laneSeed * this.map.size * 0.3 + role.laneBias * 4;
        goalZ = (this.team === 'enemy' ? 1 : -1) * this.map.size * 0.35;
      }
    }

    // Una recuperación siempre toma primero una salida lateral corta. Volver
    // a pedir exactamente la misma ruta era la causa del bucle frente a caja.
    if (this._recoveryT > 0) {
      this._recoveryT -= dt;
      goalX = this._recoveryGoal.x;
      goalZ = this._recoveryGoal.z;
    }

    // Consulta de waypoint (barata: cache 0.9s por bot en Navigation)
    if (nav && goalX !== null) {
      const w = nav.nextWaypoint(this, goalX, goalZ);
      if (w) { wp = w; this._navDebug.waypoint = w; }
      else {
        this._navDebug.waypoint = null;
        const rec = nav._paths && nav._paths.get(this.id);
        if (rec) this._navDebug.pathFailures = rec.failures || 0;
      }
    }

    if (this.state === 'wander') {
      if (wp) {
        // ATAJOS: el A* es 4-dir y el string-pulling conserva esquinas — un
        // waypoint más adelante alcanzable en recta no justifica zigzag.
        // La LOS se valida contra el MAPA REAL (checkCollision por muestreo
        // con el radio del bot), no contra el grid: el grid solo garantiza
        // el CENTRO de cada celda y un "atajo visible" saltaba el wp de
        // acceso real (autopsia: botón patinando hasta agotar la ruta).
        const recNav = nav && nav._paths ? nav._paths.get(this.id) : null;
        if (recNav && recNav.path.length > recNav.i) {
          const skip = Math.min(recNav.i + 2, recNav.path.length - 1);
          const cand = recNav.path[skip];
          if (skip > recNav.i && cand) {
            const dxs = cand.x - this.position.x, dzs = cand.z - this.position.z;
            const len = Math.hypot(dxs, dzs) || 1;
            const probe = S.axis.copy(this.position);
            let clear = true;
            for (let st = 1; st <= 4; st++) {
              probe.x = this.position.x + (dxs / len) * (len * st / 4);
              probe.z = this.position.z + (dzs / len) * (len * st / 4);
              probe.y = this.position.y;
              if (map.checkCollision(probe, this.radius, this.height)) { clear = false; break; }
            }
            if (clear) { recNav.i = skip; wp = cand; }
          }
        }
        // seguir el camino de Navigation (con falla local si un frame no hay)
        S.wp.set(wp.x, 0, wp.z).sub(this.position); S.wp.y = 0;
        if (S.wp.lengthSq() > 0.001) {
          move.copy(S.wp).normalize().multiplyScalar(0.8);
          this.targetYaw = Math.atan2(move.x, move.z);
        } else move.set(0, 0, 0);
      } else if (goalX !== null) {
        // sin nav: steering directo al ancla (comportamiento previo)
        S.toA.set(goalX - this.position.x, 0, goalZ - this.position.z);
        const distA = S.toA.length();
        if (distA > 3) {
          move.copy(S.toA.normalize()).multiplyScalar(0.7);
          this.targetYaw = Math.atan2(move.x, move.z);
        } else {
          move.set(0, 0, 0);
          this.targetYaw = Math.atan2(-S.toA.x, -S.toA.z);
        }
      } else {
        move.copy(this.wanderDir);
        const nextPos = S.next.copy(this.position).addScaledVector(move, this.speed * dt * 2);
        if (map.checkCollision(nextPos, this.radius, this.height)) {
          this.wanderDir.set((Math.random()-0.5), 0, (Math.random()-0.5)).normalize();
          move.copy(this.wanderDir);
        }
        move.multiplyScalar(0.6);
      }

    } else if (this.state === 'chase' && (nearest || this._lastSeen)) {
      lookAtTarget = !!nearest;
      if (wp) {
        S.wp.set(wp.x, 0, wp.z).sub(this.position); S.wp.y = 0;
        if (S.wp.lengthSq() > 0.001) { move.copy(S.wp).normalize(); }
        else move.set(0, 0, 0);
      } else if (nearest) {
        const toTarget = S.toT.subVectors(nearest.position, this.position);
        toTarget.y = 0; toTarget.normalize();
        move.copy(toTarget);
      } else move.set(0, 0, 0);
      if (nearest && nearestDist < 6) {
        if (this.strafeTimer <= 0) {
          this.strafeDir = Math.random() > 0.5 ? 1 : -1;
          this.strafeTimer = 0.6 + Math.random()*0.8;
        }
        const strafe = S.strafe.crossVectors(S.toT.subVectors(nearest.position, this.position).normalize(), UP).multiplyScalar(this.strafeDir * 0.7);
        move.add(strafe);
        move.normalize();
      }

    } else if (this.state === 'attack' && nearest) {
      lookAtTarget = true;
      // Mantener la DISTANCIA PREFERIDA del ARMA (modulada por el rol): shotgun
      // cierra, rifle/SMG media, pistola conservadora. Reacción del rol antes
      // del primer disparo; aggro del arma escala el avance.
      wantShoot = nearestDist < shootRange && this._reactWait <= 0;
      if (this._reactWait > 0) this._reactWait -= dt;
      const toTarget = S.toT.subVectors(nearest.position, this.position);
      toTarget.y = 0; const dist = toTarget.length();
      toTarget.normalize();
      if (this._flankT > 0) {
        // Reubicación en curso: seguir el waypoint lateral (o strafe amplio si
        // Navigation no tiene ruta) — se NO dispara mejor pegado a la pared.
        this._flankT -= dt;
        if (wp) {
          S.wp.set(wp.x, 0, wp.z).sub(this.position); S.wp.y = 0;
          if (S.wp.lengthSq() > 0.001) move.copy(S.wp).normalize(); else move.set(0, 0, 0);
        } else {
          move.copy(S.strafe.crossVectors(toTarget, UP).multiplyScalar(this._flankDir)).normalize();
        }
        move.multiplyScalar(0.9);
      } else {
        const pref = prefDistNow;
        const wr = weaponProfile;
        if (dist > pref + 3) {
          move.copy(toTarget).multiplyScalar(0.7 * role.aggro * wr.aggro);
        } else if (dist < pref - 3) {
          move.copy(toTarget).multiplyScalar(-0.5);
        } else {
          if (this.strafeTimer <= 0) {
            this.strafeDir = Math.random() > 0.5 ? 1 : -1;
            this.strafeTimer = 0.4 + Math.random()*0.6;
          }
          const strafe = S.strafe.crossVectors(toTarget, UP).multiplyScalar(this.strafeDir);
          move.copy(strafe);
        }
        if (this.strafeTimer > 0) {
          const strafe = S.strafe.crossVectors(toTarget, UP).multiplyScalar(this.strafeDir * 0.6);
          move.add(strafe);
        }
        move.normalize();
        move.multiplyScalar(0.85);
      }
      // Reubicarse si lleva demasiado sin poder disparar (cubierto/trabado):
      // 2.5s con target a la vista sin abrir fuego → FLANQUEO lateral con
      // límite temporal. reset(SOLO este bot): los demás conservan su ruta.
      if (wantShoot) {
        this._noShootTime += dt;
      } else {
        this._noShootTime = 0;
      }
      if (this._noShootTime > 2.5) {
        this._flankT = 2.2;
        this._flankDir = -this._flankDir; // alternar lado: impredecible, no zigzag eterno
        this._noShootTime = 0;
        if (nav) nav.reset(this.id);
        this.strafeDir = -this.strafeDir;
      }
    }

    // Apply movement with SMOOTH ACCELERATION — bots ease into their stride
    // instead of snapping to full speed (kills the "ghost sliding" look).
    // velocity lerps toward the wish velocity; position integrates velocity.
    const moveMag0 = move.lengthSq();
    const wish = S.wish;
    if (move.lengthSq() > 0.01) wish.copy(move).multiplyScalar(this.speed); else wish.set(0, 0, 0);
    const accelT = Math.min(1, (move.lengthSq() > 0.01 ? 6.5 : 9) * dt);
    this.velocity.x = THREE.MathUtils.lerp(this.velocity.x, wish.x, accelT);
    this.velocity.z = THREE.MathUtils.lerp(this.velocity.z, wish.z, accelT);
    if (Math.hypot(this.velocity.x, this.velocity.z) > 0.02) {
      const nextPos = S.next.copy(this.position).addScaledVector(this.velocity, dt);
      // Ground: only platforms reachable from current feet height
      const groundY = map.getGroundY(nextPos.x, nextPos.z, this.position.y - this.height);
      nextPos.y = groundY + this.height;
      if (!map.checkCollision(nextPos, this.radius, this.height)) {
        this.position.copy(nextPos);
      } else {
        this._navDebug.collisionAttempts++;
        // Try slide axis-separated (same contract as the player)
        const oldX = this.position.x, oldZ = this.position.z;
        const tryX = S.axis.copy(this.position); tryX.x = nextPos.x; tryX.y = nextPos.y;
        if (!map.checkCollision(tryX, this.radius, this.height)) this.position.x = tryX.x;
        const tryZ = S.axis.copy(this.position); tryZ.z = nextPos.z; tryZ.y = nextPos.y;
        if (!map.checkCollision(tryZ, this.radius, this.height)) this.position.z = tryZ.z;
        const slid = Math.hypot(this.position.x - oldX, this.position.z - oldZ);
        if (slid < 0.002) {
          this._blockedT += dt;
          // Do not wait for the 2.5s watchdog when the body is visibly
          // pressing a wall: invalidate the route and choose a tested escape
          // direction before the bot can settle into a corner.
          if (this._blockedT >= 0.24) this._startRecovery(map);
        } else {
          this._blockedT = 0;
        }
        // Blocked head-on: cut velocity so the bot doesn't push into walls
        this.velocity.multiplyScalar(0.4);
      }
    }
    // STUCK-BREAKER (P0): quiere moverse y NO GANA TERRENO en ~1.6s →
    // nueva ruta y lateral corto. Mide desplazamiento desde la ANCLA: si en
    // ese tiempo no se alejó >1.5u, es atasco (la micro-oscilación entre dos
    // waypoints inalcanzables también cuenta). FUERA del gate de velocidad.
    // Sin radar, sin ronda congelada.
    {
      const anchor = this._stuckAnchor || (this._stuckAnchor = new THREE.Vector3());
      this._stuckT += dt;
      if (this._stuckT > 1.6) {
        const traveled = this.position.distanceTo(anchor);
        this._navDebug.distanceWindow = traveled;
        this._navDebug.effectiveSpeed = traveled / this._stuckT;
        if (moveMag0 > 0.0002 && traveled < 1.5) {
          this._startRecovery(map);
        }
        this._stuckT = 0;
        anchor.copy(this.position);
      }
    }
    // Face movement direction if not looking at target
    if (!lookAtTarget && move.lengthSq() > 0.01) {
      this.targetYaw = Math.atan2(move.x, move.z);
    }

    // Look at target
    if (lookAtTarget && nearest) {
      const toTarget = S.toT.subVectors(nearest.position, this.position);
      this.targetYaw = Math.atan2(toTarget.x, toTarget.z);
      // Add slight spread inaccuracy for bots (worse at distance)
      const inaccuracy = THREE.MathUtils.clamp(nearestDist * 0.012, 0.02, 0.12);
      this.targetYaw += (Math.random()-0.5) * inaccuracy;
    }

    // Smooth yaw: rápido fijando al enemigo, lento paseando (el giro brusco
    // en wander + strafe corto era el "efecto peonza" del gameplay grabado).
    let yawDiff = this.targetYaw - this.yaw;
    // Normalize to -PI to PI
    while (yawDiff > Math.PI) yawDiff -= Math.PI*2;
    while (yawDiff < -Math.PI) yawDiff += Math.PI*2;
    const yawRate = lookAtTarget ? 6 : 3;
    this.yaw += yawDiff * Math.min(1, dt * yawRate);

    // Update mesh: feet stay on groundY
    this.mesh.position.copy(this.position);
    this.mesh.position.y -= this.height;
    this.mesh.rotation.y = this.yaw;

    // Hit flinch: brief body tilt toward the shot (decays in ~0.12s)
    if (this._flinchT > 0) {
      this._flinchT -= dt;
      const k = Math.max(0, this._flinchT / 0.12);
      this.mesh.rotation.x = k * 0.35; // recoil tilt
    } else {
      this.mesh.rotation.x = 0;
    }

    // WALK CYCLE — hip/shoulder pivots swing like a real stride. Speed drives
    // stride frequency; still bots settle to neutral pose smoothly.
    const speedNow = Math.hypot(this.velocity.x, this.velocity.z);
    this._navDebug.effectiveSpeed = speedNow;
    const moving = move.lengthSq() > 0.01;
    this._stridePhase = (this._stridePhase || 0) + dt * (4 + speedNow * 1.6);
    const strideAmp = moving ? Math.min(0.55, 0.25 + speedNow * 0.09) : 0;
    const swing = Math.sin(this._stridePhase) * strideAmp;
    if (this._lLeg && this._rLeg) {
      // Smooth toward target so stopping reads as deceleration, not a freeze
      this._lLeg.rotation.x = THREE.MathUtils.lerp(this._lLeg.rotation.x, swing, Math.min(1, dt * 12));
      this._rLeg.rotation.x = THREE.MathUtils.lerp(this._rLeg.rotation.x, -swing, Math.min(1, dt * 12));
    }
    if (this._lArm && this._rArm) {
      // Arms counter-swing the legs; right arm swings less (holds the rifle)
      this._lArm.rotation.x = THREE.MathUtils.lerp(this._lArm.rotation.x, -swing * 0.8, Math.min(1, dt * 12));
      this._rArm.rotation.x = THREE.MathUtils.lerp(this._rArm.rotation.x, swing * 0.35, Math.min(1, dt * 12));
    }
    // Subtle body bounce synced to the stride (feet stay planted on ground)
    if (this.mesh) {
      const bounce = moving ? Math.abs(Math.sin(this._stridePhase)) * 0.03 * (speedNow / 4) : 0;
      this.mesh.position.y = this.position.y - this.height + bounce;
    }

    // Avatar GLB: idle/walk/run por velocidad real + mixer tick. Amigos y
    // enemigos comparten el mismo contrato (dificultad = parámetros, no trampas).
    if (this._avatar) {
      const loco = !moving ? 'idle' : (this.state === 'wander' && speedNow < 4.2) ? 'walk' : 'run';
      if (this._avatar._loco !== loco) this._avatar.setLocomotion(loco);
      this._avatar.update(dt);
    }

    // Shooting
    let shoot = false;
    if (wantShoot && this.shootCooldown <= 0 && nearest) {
      // Check if facing target within ~35 degrees
      const toTarget = S.toT.subVectors(nearest.position, this.position).normalize();
      const forward = S.fwd.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
      const dot = forward.dot(toTarget);
      if (dot > 0.72) {
        shoot = true;
        this.shootCooldown = 0.22 + Math.random()*0.35; // fire rate variation
        this._noShootTime = 0; // disparó: el timer de reubicación vuelve a cero
        // Add recoil to yaw
        this.yaw += (Math.random()-0.5) * 0.06;
        if (this._avatar) this._avatar.pulse(); // culatazo visible
      }
    }

    // Contrato del action: SOLO datos planos (shoot/target). Los vectores de
    // trabajo son scratch del módulo y NO salen por aquí (cero escapes).
    return {
      shoot,
      target: nearest
    };
  }

  // Zona de conflicto para el anti-idle: centros y lanes del mapa (por dónde
  // pasa el combate de todos los modos). SIN radar — solo geografía barata.
  // La determinación es determinista por bot+turno: el equipo cubre zonas
  // distintas en vez de peregrinar en fila india.
  _pickTacticalGoal() {
    // Centro (0,0): TODO el tráfico N-S de la arena pasa por el centro o los
    // lanes — converger hacia el centro maximiza el contacto sin radar.
    // El jitter reparte al escuadrón; si el punto cae en celda muerta (muro
    // central), el próximo repath del anti-idle lo vuelve a sortear.
    const jitter = 6;
    return { x: (Math.random() - 0.5) * jitter, z: (Math.random() - 0.5) * jitter };
  }
}
