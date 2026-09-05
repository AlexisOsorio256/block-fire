import * as THREE from '../lib/three.module.js';
import { GLTFLoader } from '../lib/GLTFLoader.js';
import * as SkeletonUtils from '../lib/SkeletonUtils.js';

// ── AvatarLib: personajes GLB REALES (no bloques) ──
// Soldado animado (three.js examples, licencia CC/attribution en CREDITS)
// con animaciones Idle/Walk/Run. Cada instancia es un clone de esqueleto
// (SkeletonUtils.clone) con su propio AnimationMixer.
//
// Fallback: si el GLB no carga (offline/APK viejo), los bots conservan su
// malla blocky — el juego NUNCA se rompe por un asset.
//
// Tinte por equipo: los materiales del GLB se clonan por instancia y se
// multiplican hacia verde (aliado) / rojo (enemigo) — identidad de escuadra
// legible a distancia, como los banners de Free Fire.

const TEAM_TINTS = {
  ally:  0x59d97c,
  enemy: 0xff5a4a,
  hero:  0xffd23f,  // lobby
};

export const AvatarLib = {
  ready: false,
  failed: false,
  _template: null,
  _idleClip: null,
  _runClip: null,
  _walkClip: null,

  load() {
    if (this.ready || this.failed) return Promise.resolve(this.ready);
    return new Promise((resolve) => {
      new GLTFLoader().load(
        'assets/models/soldier.glb',
        (gltf) => {
          try {
            const root = gltf.scene;
            root.updateMatrixWorld(true);
            this._template = root;
            const clips = gltf.animations || [];
            // BUG: se comparaba el nombre en minúsculas con 'Idle'/'Run'/'Walk'
            // capitalizados → el match por nombre NUNCA acertaba y todo caía al
            // fallback por posición (clips[0]/clips[1]). Funciona por suerte con
            // este GLB, pero cualquier reorden lo rompe en silencio.
            const byName = (n) => clips.find(c => c.name.toLowerCase() === n.toLowerCase());
            this._idleClip = byName('idle')  || clips[0] || null;
            this._runClip  = byName('run')   || clips[1] || null;
            this._walkClip = byName('walk')  || this._runClip;
            this.ready = true;
            console.log('[AvatarLib] soldier.glb cargado — clips:', clips.map(c=>c.name).join(','));
            resolve(true);
          } catch (e) {
            console.error('AvatarLib parse', e);
            this.failed = true;
            resolve(false);
          }
        },
        undefined,
        (err) => { console.error('[AvatarLib] fallo carga GLB:', err && err.message || err); this.failed = true; resolve(false); }
      );
    });
  },

  // Instancia animada. opts: { team: 'ally'|'enemy'|'hero', weapon: Group|null }
  create(opts = {}) {
    if (!this.ready) return null;
    const clone = SkeletonUtils.clone(this._template);
    clone.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = false;
        // Tinte de equipo: clonar material para no afectar al template.
        // CRÍTICO: conservar el TIPO (single vs array) — un array de 1 material
        // sobre geometría SIN groups hace que three.js no dibuje NADA.
        if (o.material) {
          const tintOf = (m) => {
            const m2 = m.clone();
            const tint = new THREE.Color(TEAM_TINTS[opts.team] || 0xffffff);
            m2.color = m2.color.clone().lerp(tint, opts.team === 'hero' ? 0.25 : 0.55);
            return m2;
          };
          o.material = Array.isArray(o.material)
            ? o.material.map(tintOf)
            : tintOf(o.material);
          // Visor con glow del equipo: el tinte 0.55 sobre la textura oliva
          // dejaba aliados y enemigos indistinguibles a distancia de combate
          // (visto en gameplay: todos khaki). El visor lleva la identidad.
          if (/visor/i.test(o.name || '')) {
            const teamCol = new THREE.Color(TEAM_TINTS[opts.team] || 0xffffff);
            (Array.isArray(o.material) ? o.material : [o.material]).forEach((mm) => {
              if (mm.emissive) { mm.emissive.copy(teamCol); mm.emissiveIntensity = 1.6; }
            });
          }
        }
      }
    });
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
    if (hand && opts.weapon) {
      // Arma agarrada: cachelada en la mano, culata hacia atrás, cañón al frente.
      // La mano mixamorig tiene +Y por los dedos; el arma va perpendicular.
      const gunPivot = new THREE.Group();
      gunPivot.add(opts.weapon);
      opts.weapon.position.set(0, 0.13, 0.03);
      opts.weapon.rotation.set(0, 0, 0);
      hand.add(gunPivot);
    }

    return {
      root: clone,
      mixer,
      actions,
      _loco: 'idle',
      // Estado de locomoción: 'idle' | 'walk' | 'run'. Desconocidos → idle.
      setLocomotion(state) {
        this._loco = (state === 'walk' || state === 'run') ? state : 'idle';
        this._moving = this._loco !== 'idle';
      },
      // Compat: el Bot llamaba setMoving(bool). walk genérico en movimiento.
      setMoving(moving) { this.setLocomotion(moving ? 'walk' : 'idle'); },
      // Culatazo al disparar: el GLB no trae clip de tiro; un dip corto del
      // torso vende cada disparo sin tocar el esqueleto (root, no huesos).
      _pulse: 0,
      pulse() { this._pulse = 1; },
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
        clone.rotation.x = -0.13 * this._pulse;
        mixer.update(dt);
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
};
