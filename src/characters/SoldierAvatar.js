import * as THREE from '../lib/three.module.js';
import * as SkeletonUtils from '../lib/SkeletonUtils.js';
import { assets, WEAPON_MODELS } from '../core/AssetRegistry.js';

// ── AvatarLib: personajes GLB REALES (no bloques) ──
// Soldado animado (three.js examples, licencia CC/attribution en CREDITS)
// con animaciones Idle/Walk/Run. Cada instancia es un clone de esqueleto
// (SkeletonUtils.clone) con su propio AnimationMixer.
//
// Fallback técnico: si el GLB no carga (offline/APK viejo), los bots conservan
// una malla simple y el juego nunca se rompe por un asset.
//
// Tinte por equipo: los materiales del GLB se clonan por instancia y se
// multiplican hacia verde (aliado) / rojo (enemigo) — identidad de escuadra
// legible a distancia, como los banners de Free Fire.

const TEAM_TINTS = {
  ally:  0x59d97c,
  enemy: 0xff5a4a,
  hero:  0xffd23f,  // lobby
};

// Scratch del anclaje arma→mano (update): cero allocs por frame (reglas §6)
const _gunAnchorM = new THREE.Matrix4();
const _gunAnchorP = new THREE.Vector3();
const _gunAnchorQ = new THREE.Quaternion();
const _gunAnchorS = new THREE.Vector3();

// ── OPERADORES: 7 identidades legibles (paleta del TRAJE, no del equipo) ──
// El equipo NO se dice pintando el modelo entero de verde/rojo (ilegible y
// prohibido por el brief): cada operador tiene su paleta body/gear/visor y la
// identidad ALIADO/ENEMIGO vive en dos piezas consistentes — el VISOR con
// glow del color de equipo y la BANDA de hombro. Lectura <1s: silueta+paleta
// = personaje, visor/banda = equipo.
const OPERATORS = [
  { name: 'BRAVO',  body: 0x8a4a3a, gear: 0x3d4557, visor: 0x39d7ff }, // asalto azul-hielo
  { name: 'VULTURE',body: 0x5a6b80, gear: 0x2b3038, visor: 0xff8329 }, // urbano naranja
  { name: 'TALON',  body: 0x4a5d4a, gear: 0x556b52, visor: 0x9dff3d }, // táctico lima
  { name: 'DUNE',   body: 0xb08d52, gear: 0x6e5a34, visor: 0xffd23f }, // desierto oro
  { name: 'HAVOC',  body: 0x5a3a4a, gear: 0x6e2f3c, visor: 0xff3d71 }, // pesado magenta
  { name: 'ROOK',   body: 0x39445c, gear: 0x8a44d9, visor: 0x8844ff }, // violeta
  { name: 'GHOST',  body: 0x2a3242, gear: 0x181d28, visor: 0x4dffd2 }, // nocturno turquesa
];

export const AvatarLib = {
  ready: false,
  failed: false,
  _template: null,
  _idleClip: null,
  _runClip: null,
  _walkClip: null,

  load() {
    if (this.ready || this.failed) return Promise.resolve(this.ready);
    return assets.loadRaw('assets/models/soldier.glb').then((gltf) => {
      if (!gltf) { this.failed = true; return false; }
      try {
        const root = gltf.scene;
        root.updateMatrixWorld(true);
        this._template = root;
        const clips = gltf.animations || [];
        // Match por nombre insensible a mayúsculas (con fallback posicional si
        // el GLB reordena clips — comportamiento documentado, no suerte).
        const byName = (n) => clips.find(c => c.name.toLowerCase() === n.toLowerCase());
        this._idleClip = byName('idle')  || clips[0] || null;
        this._runClip  = byName('run')   || clips[1] || null;
        this._walkClip = byName('walk')  || this._runClip;
        this._computeBoneFront(root);
        this.ready = true;
        console.log('[AvatarLib] soldier.glb cargado — clips:', clips.map(c=>c.name).join(','));
        return true;
      } catch (e) {
        console.error('AvatarLib parse', e);
        this.failed = true;
        return false;
      }
    });
  },

  // ── Referencia de FRENTE por hueso (datos, no conjetura) ──
  // El visor del GLB está en la cara frontal de la cabeza: su posición
  // expresada en el espacio local de Head/Spine2 da el eje "adelante" de cada
  // hueso. Las piezas modulares (mochila) lo usan para anclarse a la ESPALDA
  // sin adivinar la convención de ejes del rig Mixamo.
  _computeBoneFront(root) {
    this._boneFront = {};
    const findBone = (re) => { let b = null; root.traverse(o => { if (o.isBone && re.test(o.name)) b = b || o; }); return b; };
    let visor = null;
    root.traverse(o => { if (o.isMesh && /visor/i.test(o.name || '')) visor = visor || o; });
    if (!visor) return;
    const p = visor.getWorldPosition(new THREE.Vector3());
    for (const [key, re] of [['head', /Head$/i], ['spine', /Spine2$/i]]) {
      const bone = findBone(re);
      if (bone) this._boneFront[key] = bone.worldToLocal(p.clone());
    }
  },

  // Banda de hombro del equipo: 1 caja emissive sobre el hombro izquierdo,
  // pegada al hueso del brazo (se mueve con la animación). Es la identidad de
  // equipo secundaria junto al visor: banda verde = aliado, roja = enemigo.
  _addTeamBand(clone, teamCol) {
    let upperArmL = null;
    clone.traverse((o) => { if (o.isBone && /LeftArm$/i.test(o.name)) upperArmL = o; });
    const bandMat = new THREE.MeshStandardMaterial({
      color: teamCol, roughness: 0.5, metalness: 0.1,
      emissive: teamCol, emissiveIntensity: 0.55,
    });
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.075, 0.20), bandMat);
    if (upperArmL) {
      upperArmL.add(band);
      band.position.set(0, -0.10, 0); // tercio superior del brazo (hueso Mixamo ~0.3u)
    } else {
      // Sin esqueleto conocido: pegado al torso a altura de hombro (fallback)
      band.position.set(-0.30, 1.32, 0);
      clone.add(band);
    }
  },

  // ── Silueta modular del PERSONAJE (mismo rig, 3 variantes) ──
  // Usa el color `gear` de cada operador en UNA pieza distintiva: casco /
  // hombreras / mochila. PERSONAJE = silueta + outfit + paleta; el EQUIPO
  // sigue leyéndose solo en visor + banda (jamás el traje entero teñido).
  _addGearPiece(clone, opIdx) {
    const op = OPERATORS[opIdx % OPERATORS.length];
    const gearMat = new THREE.MeshStandardMaterial({ color: op.gear, roughness: 0.6, metalness: 0.2 });
    const findBone = (re) => { let b = null; clone.traverse(o => { if (o.isBone && re.test(o.name)) b = b || o; }); return b; };
    const variant = opIdx % 3;
    if (variant === 0) {
      // CASCO: cupola sobre el cráneo + visera corta (silueta "asalto")
      const head = findBone(/Head$/i);
      if (!head) return;
      const dome = new THREE.Mesh(new THREE.BoxGeometry(0.27, 0.12, 0.30), gearMat);
      dome.position.set(0, 0.06, 0);
      head.add(dome);
      const brim = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.035, 0.33), gearMat);
      brim.position.set(0, 0.005, 0);
      head.add(brim);
    } else if (variant === 1) {
      // HOMBRERAS: placas sobre ambos brazos (silueta "pesado")
      for (const re of [/LeftArm$/i, /RightArm$/i]) {
        const arm = findBone(re);
        if (!arm) continue;
        const pad = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.10, 0.22), gearMat);
        pad.position.set(0, -0.025, 0);
        arm.add(pad);
      }
    } else {
      // MOCHILA: placa a la ESPALDA usando la referencia de frente medida del
      // rig (sin ella, la pieza podría acabar en el pecho — se omite mejor).
      const spine = findBone(/Spine2$/i) || findBone(/Spine1$/i);
      if (!spine) return;
      const front = this._boneFront && this._boneFront.spine;
      if (!front || front.lengthSq() < 1e-6) return;
      const back = front.clone().normalize().multiplyScalar(-1);
      const pack = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.36, 0.14), gearMat);
      pack.position.copy(back.multiplyScalar(0.15));
      pack.position.y += 0.02;
      spine.add(pack);
    }
  },

  // Instancia animada. opts: { team: 'ally'|'enemy'|'hero', weapon: Group|null, operator: 0..6 }
  create(opts = {}) {
    if (!this.ready) return null;
    const clone = SkeletonUtils.clone(this._template);
    // Colormap del GLB: 2 materiales (VanguardBodyMat, Vanguard_VisorMat con
    // baseColorTexture). La textura difusa se multiplica por baseColor: los
    // tonos del traje se CLONAN por instancia y se tiñen con la paleta del
    // operador; el visor lleva el glow del EQUIPO (identidad, no el traje).
    const op = OPERATORS[(opts.operator ?? 0) % OPERATORS.length];
    const teamCol = new THREE.Color(TEAM_TINTS[opts.team] || 0xffffff);
    const isHero = opts.team === 'hero';
    clone.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = false;
        // CRÍTICO: conservar el TIPO (single vs array) — un array de 1 material
        // sobre geometría SIN groups hace que three.js no dibuje NADA.
        const paint = (m) => {
          const m2 = m.clone();
          if (/visor/i.test(o.name || '')) {
            // VISOR = identidad de equipo (glow aliado/enemigo + paleta propia)
            if (m2.color) m2.color.set(op.visor).lerp(teamCol, isHero ? 0.15 : 0.45);
            if (m2.emissive) { m2.emissive.copy(teamCol); m2.emissiveIntensity = 1.6; }
          } else {
            // TRAJE = identidad del OPERADOR (paleta propia, nunca el color de equipo).
            // La difusa del GLB es gris-base: baseColor manda sobre ella.
            if (m2.color) m2.color.set(op.body);
          }
          return m2;
        };
        if (o.material) {
          o.material = Array.isArray(o.material)
            ? o.material.map(paint)
            : paint(o.material);
        }
      }
    });
    // Banda de hombro única por avatar (fuera del traverse: solo 1)
    if (!isHero) this._addTeamBand(clone, teamCol);
    this._addGearPiece(clone, opts.operator ?? 0);
    // Normaliza la pose TPose→Idle y orientación: el soldado mira +Z en el
    // ejemplo original; nuestros bots miran +Z con yaw. Ajuste empírico abajo.
    clone.rotation.y = Math.PI; // el GLB mira hacia -Z; el juego usa +Z como frente

    // Animaciones: 3 estados (idle/walk/run) para amigos y enemigos.
    // walk = merodeo, run = persecución/combate. Los tres arrancan en play y
    // update() funde los pesos hacia el estado pedido (sin pops).
    const mixer = new THREE.AnimationMixer(clone);
    const actions = {};
    if (this._idleClip) actions.idle = mixer.clipAction(this._idleClip);
    if (this._walkClip) actions.walk = mixer.clipAction(this._walkClip);
    if (this._runClip)  actions.run  = mixer.clipAction(this._runClip);
    // walk y run pueden ser el MISMO clip (fallback): compartir acción evita
    // doble peso sobre el mismo track (se contaría dos veces).
    if (actions.walk && actions.run && this._walkClip === this._runClip) delete actions.walk;
    for (const k of Object.keys(actions)) actions[k].play();
    for (const k of ['walk', 'run']) if (actions[k]) actions[k].setEffectiveWeight(0);

    // Mano derecha para el arma (rig Mixamo)
    let hand = null;
    clone.traverse((o) => {
      if (o.isBone && /RightHand$/i.test(o.name)) hand = o;
    });
    let gunPivot = null;
    if (hand && opts.weapon) {
      // Arma agarrada: el pivote NO cuelga del esqueleto (bug medido): el rig
      // mixamo escala 1/77 su subárbol y la compensación —calculada con el
      // clone huérfano, antes del scale final— quedaba a merced del idle, que
      // mueve los huesos DESPUÉS del bake (sonda: bbox vertical 25×79px,
      // cañón a dot −0.95 del rayo al render). El pivote vive como HERMANO
      // del esqueleto y update() lo ANCLA a la mano cada frame: la pose es
      // exacta en el estado exacto del render (bots y héroe, mismo contrato).
      gunPivot = new THREE.Group();
      gunPivot.add(opts.weapon);
      opts.weapon.position.set(0, 0.13, 0.03); // agarre: offset en marco de mano
      opts.weapon.rotation.set(0, 0, 0);
      clone.add(gunPivot);
    }

    // Medición única de pies en el rig sin buscar Box3 durante update().
    // Bot/Lobby fijan después la escala y reaplican este offset una sola vez.
    clone.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(clone);
    const feetOffset = Number.isFinite(bounds.min.y) ? bounds.min.y : 0;
    const actionDurations = { shoot: 0.16, reload: 1.20, hit: 0.18, death: 0.60, swap: 0.42 };

    return {
      root: clone,
      mixer,
      actions,
      gunPivot, // pivote del arma (hermano del esqueleto; update() lo ancla)
      _handBone: hand, // hueso de la mano derecha (ancla del arma por frame)
      feetOffset,
      setGrounded() {
        const scaleY = Math.abs(this.root.scale.y) || 1;
        this.root.position.y = -this.feetOffset * scaleY;
      },
      _loco: 'idle',
      // Estado de locomoción: 'idle' | 'walk' | 'run'. Desconocidos → idle.
      setLocomotion(state) {
        this._loco = (state === 'walk' || state === 'run') ? state : 'idle';
        this._moving = this._loco !== 'idle';
      },
      // Compat: el Bot llamaba setMoving(bool). walk genérico en movimiento.
      setMoving(moving) { this.setLocomotion(moving ? 'walk' : 'idle'); },
      _action: 'idle',
      _actionT: 0,
      _actionDuration: 0,
      triggerAction(name) {
        const duration = actionDurations[name];
        if (!duration) return;
        this._action = name;
        this._actionT = duration;
        this._actionDuration = duration;
        if (name === 'shoot') this._pulse = 1;
      },
      resetAction() {
        this._action = 'idle';
        this._actionT = 0;
        this._actionDuration = 0;
        this._pulse = 0;
        clone.rotation.z = 0;
      },
      // Culatazo al disparar: el GLB no trae clip de tiro; un dip corto del
      // torso vende cada disparo sin tocar el esqueleto (root, no huesos).
      _pulse: 0,
      pulse() { this.triggerAction('shoot'); },
      update(dt) {
        // Funde cada peso hacia su objetivo: transición legible sin pops y
        // sin depender de que el llamador acierte el momento exacto.
        for (const k of Object.keys(actions)) {
          const target = (k === this._loco) ? 1 : 0;
          const cur = actions[k].getEffectiveWeight();
          const next = THREE.MathUtils.lerp(cur, target, Math.min(1, dt * 8));
          actions[k].setEffectiveWeight(Math.abs(next - target) < 0.01 ? target : next);
        }
        if (this._pulse > 0) this._pulse = Math.max(0, this._pulse - dt * 5);
        let actionK = 0;
        if (this._actionT > 0) {
          this._actionT = Math.max(0, this._actionT - dt);
          actionK = this._actionDuration > 0 ? this._actionT / this._actionDuration : 0;
          if (this._actionT === 0) {
            this._action = 'idle';
            this._actionDuration = 0;
          }
        }
        const phase = 1 - actionK;
        const envelope = Math.sin(Math.min(1, Math.max(0, phase)) * Math.PI);
        const actionX = this._action === 'reload' ? -0.11 * envelope
          : this._action === 'hit' ? 0.16 * envelope
          : this._action === 'death' ? -0.28 * phase
          : this._action === 'swap' ? 0.07 * envelope
          : this._action === 'shoot' ? -0.08 * envelope
          : 0;
        clone.rotation.x = -0.13 * this._pulse + actionX;
        clone.rotation.z = this._action === 'hit' ? 0.10 * envelope : 0;
        mixer.update(dt);
        // ANCLAJE DEL ARMA A LA MANO (estado de render exacto): tras el
        // mixer.update los huesos ya tienen su pose ESTE frame — copiar
        // posición+quaternion del hueso al pivote hermano reproduce el
        // marco de la mano a escala real (el pivote es hijo directo del
        // root, sin la escala 1/77 del rig). Sin esto, el arma no sigue
        // la animación (o no aparece: matrices de hueso aún sin asentar).
        if (gunPivot && this._handBone) {
          clone.updateMatrixWorld(true);
          // local = parentWorld⁻¹ · handWorld (pivote es hijo del root, que
          // rota/traslada: copiar world→local directamente heredaría doble).
          // Scratch de módulo: cero allocs por frame (reglas §6).
          _gunAnchorM.copy(clone.matrixWorld).invert()
            .multiply(this._handBone.matrixWorld);
          _gunAnchorM.decompose(_gunAnchorP, _gunAnchorQ, _gunAnchorS);
          gunPivot.position.copy(_gunAnchorP);
          // offset de exhibición del llamador (Lobby._poseHeroGun): saca el
          // arma del plano del cuerpo (móvil: "medio oculta tras el torso").
          const restData = gunPivot.userData.rest;
          if (restData && restData.pos) gunPivot.position.add(restData.pos);
          // ancla (marco de la mano) · resto (pose de presentación persistida
          // por el llamador — Lobby._poseHeroGun): el idle recompone la misma
          // pose en el estado EXACTO de este frame, sin bakes que el siguiente
          // update() descarte (bug medido: pose horneada → sobrescrita).
          gunPivot.quaternion.copy(_gunAnchorQ);
          const rest = gunPivot.userData.rest;
          if (rest) gunPivot.quaternion.multiply(rest.quat);
          // la escala extraída (≈1/77 del rig) se DESCARTA: el arma vive a
          // escala real del root (1.0 local → 1.22 mundo en el héroe)
        }
      },
    };
  },

  // Arma low-poly para la mano (misma familia visual que el viewmodel).
  // key: 'rifle'|'pistol'|'shotgun'|'smg' — teamColor tiñe el acento.
  makeHeldWeapon(key, accentColor) {
    const g = new THREE.Group();
    const body = new THREE.MeshStandardMaterial({ color: 0x3d4557, roughness: 0.55, metalness: 0.45 });
    const black = new THREE.MeshStandardMaterial({ color: 0x191d2c, roughness: 0.45, metalness: 0.55 });
    const accent = new THREE.MeshStandardMaterial({ color: accentColor, roughness: 0.35, metalness: 0.3, emissive: accentColor, emissiveIntensity: 0.25 });
    const add = (x, y, z, w, h, d, m) => { const mm = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); mm.position.set(x, y, z); g.add(mm); return mm; };
    if (key === 'pistol') {
      add(0, 0, -0.06, 0.05, 0.07, 0.20, black);
      add(0, 0.045, -0.06, 0.052, 0.015, 0.18, accent);
      add(0, -0.08, 0.02, 0.045, 0.13, 0.06, body);
    } else if (key === 'shotgun') {
      add(0, 0, -0.10, 0.06, 0.06, 0.44, black);
      add(0, 0.005, -0.34, 0.075, 0.075, 0.03, black);
      add(0, 0, 0.12, 0.08, 0.10, 0.26, body);
      add(0, -0.045, -0.12, 0.05, 0.05, 0.13, accent);
      add(0, -0.02, 0.30, 0.065, 0.09, 0.16, accent);
    } else if (key === 'smg') {
      add(0, 0, -0.05, 0.07, 0.09, 0.26, body);
      add(0, 0.055, -0.05, 0.045, 0.025, 0.22, black);
      add(0, 0.01, -0.22, 0.04, 0.04, 0.12, black);
      add(0, -0.11, 0.0, 0.05, 0.15, 0.07, black);
      add(0, -0.09, 0.10, 0.045, 0.10, 0.055, accent);
      add(0, 0.062, -0.05, 0.05, 0.012, 0.20, accent);
    } else { // rifle
      add(0, 0, -0.05, 0.07, 0.09, 0.34, body);
      add(0, 0.06, -0.06, 0.045, 0.025, 0.30, black);
      add(0, 0.052, -0.06, 0.05, 0.012, 0.28, accent);
      add(0, 0.005, -0.28, 0.04, 0.04, 0.30, black);
      add(0, 0.005, -0.43, 0.062, 0.062, 0.05, black);
      add(0, -0.10, 0.03, 0.05, 0.14, 0.08, black);
      add(0, -0.085, 0.13, 0.05, 0.11, 0.06, accent);
      add(0, -0.005, 0.21, 0.06, 0.085, 0.14, body);
    }
    g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    return g;
  },

  // ── Arma GLB REAL en la mano (ruta principal; fallback técnico) ──
  // Async: resuelve al llegar el asset; el llamador ya montó la malla simple y
  // esta la reemplaza en el mismo pivote. Escala de mano ~0.5.
  async makeHeldWeaponGlb(key) {
    const url = WEAPON_MODELS[key];
    if (!url) return null;
    const obj = await assets.instantiate(url);
    if (!obj) return null;
    const wrap = new THREE.Group();
    wrap.userData.isGlb = true; // contrato: arma GLB real (tests de lobby/bots)
    // Normalización de mano: cañón a -Z, tamaño ~0.35-0.5u.
    // ORIENTACIÓN MEDIDA (análisis de vértices/Box3): los GLB de Kenney ya
    // apuntan el cañón a -Z; rotY: Math.PI los volteaba (culata al frente).
    const S = { rifle: 0.55, pistol: 0.45, shotgun: 0.32, smg: 0.45 }[key] || 0.5;
    obj.rotation.y = 0;
    obj.scale.setScalar(S);
    // Recentro por Box3: la escopeta nace con origen en la boca (zmin=0) y el
    // pivote de la mano debe quedar en el cuerpo del arma, no en un extremo.
    obj.updateMatrixWorld(true);
    const bb = new THREE.Box3().setFromObject(obj);
    const c = bb.getCenter(new THREE.Vector3());
    obj.position.sub(c);
    wrap.add(obj);
    return wrap;
  },
};
