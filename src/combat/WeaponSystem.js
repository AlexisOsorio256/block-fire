import * as THREE from '../lib/three.module.js';
import { assets, WEAPON_MODELS } from '../core/AssetRegistry.js';

export const WeaponData = {
  rifle: {
    name: 'Rifle',
    price: 1500,
    damage: 17, // TTK body 0.81s a distancia óptima (medido): reacción posible
    headshotMul: 2.0,
    fireRate: 0.115,
    magazineSize: 30,
    reloadTime: 1.6,
    spread: 0.012,
    recoil: 0.6,
    range: 90,
    pellets: 1,
    automatic: true,
    bulletSpeed: 0, // hitscan
    falloffStart: 35,
    falloffMin: 0.7,
  },
  pistol: {
    name: 'Pistol',
    price: 0, // arma inicial: gratis, siempre en el inventario
    damage: 25, // TTK body ~1.04s / head 0.52s: secundaria digna que premia puntería
    headshotMul: 2.0,
    fireRate: 0.26,
    magazineSize: 12,
    reloadTime: 1.1,
    spread: 0.006,
    recoil: 0.35,
    range: 70,
    pellets: 1,
    automatic: false,
    bulletSpeed: 0,
    falloffStart: 25,
    falloffMin: 0.75,
  },
  shotgun: {
    name: 'Shotgun',
    price: 1200,
    damage: 26, // 26x6=156: one-shot SOLO dentro de ~7m; a 10m quedan 114 (seguimiento)
    headshotMul: 1.5,
    fireRate: 0.75,
    magazineSize: 6,
    reloadTime: 1.9,
    spread: 0.082,
    recoil: 1.1,
    range: 16,
    pellets: 6,
    automatic: false,
    bulletSpeed: 0,
    falloffStart: 7,
    falloffMin: 0.2,
  },
  smg: {
    name: 'SMG',
    damage: 13,
    headshotMul: 1.9,
    fireRate: 0.085,
    magazineSize: 36,
    reloadTime: 1.8,
    spread: 0.018,
    recoil: 0.4,
    range: 55,
    pellets: 1,
    automatic: true,
    bulletSpeed: 0,
    falloffStart: 20,
    falloffMin: 0.65,
    price: 1800,
  }
};

// Skins de armas — DECISIÓN DE PRODUCTO: son cosmética gratuita del loadout,
// se eligen en el LOBBY y persisten en localStorage. NO hay compra de skins
// (el oro del Clash Squad solo compra armas); por eso no existe `price` aquí.
// accent/dark: colores que sustituyen los materiales de identidad del arma
// (null = Estándar: restaurar los materiales originales).
export const WeaponSkins = {
  none:    { name: 'Estándar', accent: null,      dark: null },
  oro:     { name: 'Oro',      accent: 0xffc93f,  dark: 0x8a6a1f },
  bosque:  { name: 'Bosque',   accent: 0x5d9c48,  dark: 0x2f4a2c },
  hielo:   { name: 'Hielo',    accent: 0x7fd8ff,  dark: 0x2f5a78 },
  carbon:  { name: 'Carbón',   accent: 0x39d7ff,  dark: 0x10131c },
};

// Arriba mundial compartido (cero allocs; nunca se muta)
const UP = new THREE.Vector3(0, 1, 0);
const RELOAD_SEQUENCE = {
  rifle:   { marks: [0.16, 0.42, 0.72, 0.90], sounds: ['reload_mag_out', 'reload_mag_in', 'reload_bolt', 'equip'] },
  pistol:  { marks: [0.20, 0.52, 0.78, 0.92], sounds: ['reload_mag_out', 'reload_mag_in', 'reload_slide', 'equip'] },
  smg:     { marks: [0.14, 0.40, 0.68, 0.88], sounds: ['reload_mag_out', 'reload_mag_in', 'reload_bolt', 'equip'] },
  shotgun: { marks: [0.18, 0.45, 0.64, 0.86], sounds: ['reload_shell', 'reload_shell', 'reload_pump', 'equip'] },
};
const SWITCH_DURATIONS = { rifle: 0.42, pistol: 0.32, smg: 0.30, shotgun: 0.52 };
const clamp01 = (v) => Math.min(1, Math.max(0, v));

export class WeaponSystem {
  constructor(scene, camera, audio, vfx, applyDamage, game = null) {
    this.scene = scene;
    this.camera = camera;
    this.audio = audio;
    this.vfx = vfx;          // VfxSystem (partículas)
    this.applyDamage = applyDamage;
    // Cadencia POR TIRADOR de bots: id → instante de reloj hasta el que no
    // puede disparar (el cooldown del jugador es la cadencia del arma; el de
    // cada bot vive aquí y muere con la partida — regla §4).
    this._botFireCd = new Map();
    this._wClock = 0;
    this.game = game;        // backref: onPlayerFired + hud (contrato pequeño)
    this.weaponData = WeaponData; // el arsenal vive aquí (la tienda lo consulta)

    this.weapons = ['rifle', 'pistol', 'shotgun', 'smg'];
    this.currentIndex = 1; // Pistola: arma inicial del Duelo de Escuadras
    this.owned = new Set(['pistol']); // el resto se desbloquea en la TIENDA
    this.currentWeapon = WeaponData[this.weapons[this.currentIndex]];
    
    this.ammoInMag = this.currentWeapon.magazineSize;
    this.reserveAmmo = this.currentWeapon.magazineSize * 3;
    this.isReloading = false;
    this.reloadTimer = 0;
    this.fireCooldown = 0;
    this.recoilOffset = 0;
    this._displayWeaponKey = this.weapons[this.currentIndex];
    this._switchAnim = 0;
    this._switchPending = false;
    this._switchPreviousKey = null;
    this._switchStage = -1;
    this._actionStage = -1;
    this._viewmodelVisible = false;
    this._vmOffset = new THREE.Vector3();
    this._actionPose = {
      x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0, scale: 1,
      magY: 0, magZ: 0, slideZ: 0, boltZ: 0, pumpZ: 0, stockX: 0,
    };

    this.raycaster = new THREE.Raycaster();
    this.crosshair = document.getElementById('crosshair');
    this.hitmarker = document.getElementById('hitmarker');

    // Weapon meshes — fallback técnico. La ruta normal carga GLB reales
    // (Kenney Blaster Kit CC0); la malla simple solo se ve mientras carga o si
    // el asset falla (offline/APK vieja).
    this._weaponModels = this._createWeaponMeshes();
    for (const key of Object.keys(this._weaponModels)) {
      this._indexAnimationParts(this._weaponModels[key]);
      this.scene.add(this._weaponModels[key]);
      this._weaponModels[key].visible = key === this.weapons[this.currentIndex];
    }
    this.weaponMesh = this._weaponModels[this._displayWeaponKey];

    // ── GLB reales (ruta principal): sustituyen al fallback por arma cuando
    // llegan. ORIENTACIÓN MEDIDA (análisis de vértices/Box3 por malla +
    // silueta proyectada, ver .tmp/glb-slabs.mjs): TODOS los GLB de Kenney
    // aquí usados crecen hacia +Z (pistola: empuñadura z+ / cañón z-;
    // rifle: empuñadura z+ / cargador y cañón z-; escopeta: culata z=+1.39 /
    // cañón z=0; SMG: empuñadura z+). El cañón del viewmodel apunta a -Z,
    // así que SIN rotación (rotY: Math.PI los ponía AL REVÉS — bug visual
    // "arma sostenida al revés"). Escopeta además nace con zmin=0 (origen
    // en la boca): se recentra por Box3 para que el pivote sea el centro.
    this._glbModels = {};
    for (const key of Object.keys(WEAPON_MODELS)) {
      assets.instantiate(WEAPON_MODELS[key]).then((obj) => {
        if (!obj) return; // el fallback técnico permanece
        // Normalización: Kenney ~0.6-1.4u de largo; el viewmodel vive a
        // ~0.4m de la cámara y espera armas de 0.35–0.62u. Cañón = -Z.
        const NORM = {
          rifle:   { scale: 0.42 },
          pistol:  { scale: 0.30 },
          shotgun: { scale: 0.26 },  // modelo 1.39u de largo
          smg:     { scale: 0.30 },
        };
        const n = NORM[key] || { scale: 1 };
        const wrap = new THREE.Group();
        obj.rotation.y = 0; // Kenney ya apunta el cañón a -Z: no tocar
        obj.scale.setScalar(n.scale);
        // Recentrado por Box3 real: el origen del asset rara vez es su centro
        // (la escopeta nace con zmin=0). Así el preset del viewmodel controla
        // la posición con un invariante, no con offsets por arma.
        obj.updateMatrixWorld(true);
        const bb = new THREE.Box3().setFromObject(obj);
        const c = bb.getCenter(new THREE.Vector3());
        obj.position.sub(c); // centro geométrico al origen del wrap
        // Elevar la LÍNEA DEL CAÑÓN hacia el eje del wrap (la mira visual del
        // arma debe quedar cerca del centro, no el centro de la bbox): la
        // mitad superior de la bbox ≈ cota del cañón en estos modelos.
        obj.position.y += bb.getSize(new THREE.Vector3()).y * 0.25;
        wrap.add(obj);
        // Brazos/manos low-poly del jugador agarrando el arma (paleta del
        // soldado). Viven DENTRO del wrap: heredan bob/recoil/ADS/recarga.
        this._attachArms(wrap, key);
        this._indexAnimationParts(wrap);
        wrap.visible = false;
        this.scene.add(wrap);
        this._glbModels[key] = wrap;
        // Si es el arma activa, cambiar visibilidad ya
        this._updateWeaponMesh();
      });
    }
  }

  // ── Brazos del viewmodel: par de brazos low-poly (manga + guante) que
  // agarran el arma. Construidos UNA vez por arma, sin allocs por frame:
  // el wrap completo (arma+brazos) se mueve con la animación existente.
  // Escala: el diseño de brazo asume un arma de ~0.55u; se escala por el
  // Box3 REAL del arma normalizada para que las manos caigan sobre grip y
  // guardamanos en las 4 armas (pistola 0.19u … escopeta 0.36u).
  _attachArms(wrap, weaponKey) {
    // Paleta del soldado (OPERATORS/DAV): manga azul-gris, guante oscuro,
    // piel cartoon visible en la mano.
    // Emissive sutil del propio tono: el viewmodel vive en el encuadre SIEMPRE
    // (bajo el arma mirando arriba, contra el cielo, de espaldas al sol); sin
    // él los brazos caen a silueta negra y el agarre se vuelve ilegible.
    const sleeveMat = new THREE.MeshStandardMaterial({ color: 0x39445c, roughness: 0.8, metalness: 0.05, emissive: 0x39445c, emissiveIntensity: 0.30 });
    const skinMat   = new THREE.MeshStandardMaterial({ color: 0xd9a066, roughness: 0.7, metalness: 0.0, emissive: 0xd9a066, emissiveIntensity: 0.28 });
    const gloveMat  = new THREE.MeshStandardMaterial({ color: 0x9fb0d8, roughness: 0.75, metalness: 0.1, emissive: 0x9fb0d8, emissiveIntensity: 0.38 });
    const mk = (w, h, d, mat, x, y, z, rx = 0) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.position.set(x, y, z);
      if (rx) m.rotation.x = rx;
      return m;
    };
    // hombro→codo→mano: dos segmentos por brazo (silueta doblada natural).
    // Diseño base (arma de 0.55u): mano derecha en la empuñadura (z+ del
    // arma), mano izquierda en el guardamanos (z-).
    const armR = new THREE.Group();
    armR.add(mk(0.085, 0.085, 0.30, sleeveMat, 0.05, -0.045, 0.16, 0.22)); // manga sup
    armR.add(mk(0.075, 0.075, 0.16, gloveMat,  0.02, -0.075, 0.02, -0.10)); // guante/puño
    armR.add(mk(0.06, 0.07, 0.09,  skinMat,    0.015, -0.10, -0.03));       // mano en grip
    const armL = new THREE.Group();
    armL.add(mk(0.08, 0.08, 0.26, sleeveMat, -0.05, -0.06, -0.05, -0.28));  // manga bajo el guardamanos
    armL.add(mk(0.07, 0.07, 0.14, gloveMat,  -0.02, -0.045, -0.14, 0.12));  // guante en guardamanos
    armL.add(mk(0.058, 0.065, 0.08, skinMat, -0.015, -0.03, -0.19));        // mano al frente
    // Ajuste por arma real: largo visible = Box3 del hijo (ya escalado/centrado)
    wrap.updateMatrixWorld(true);
    const bb = new THREE.Box3().setFromObject(wrap);
    const size = bb.getSize(new THREE.Vector3());
    const L = size.z;
    const k = THREE.MathUtils.clamp(L / 0.55, 0.34, 0.85);
    armR.scale.setScalar(k);
    armL.scale.setScalar(k);
    armR.position.set(0.012 * k, -0.015 * k, L * 0.18);  // mano derecha sobre la empuñadura
    armL.position.set(-0.010 * k, -0.005 * k, -L * 0.26); // mano izquierda al guardamanos
    wrap.add(armR, armL);
  }

  // Indexa piezas animables una sola vez. GLB y fallback comparten el mismo
  // contrato; si un asset no nombra una pieza, la pose general sigue siendo
  // válida y no se inventa una jerarquía costosa.
  _indexAnimationParts(model) {
    if (!model) return;
    const parts = model.userData.animParts || {};
    model.traverse((o) => {
      const name = o.name || '';
      if (!parts.magazine && /magazine|mag|clip/i.test(name)) parts.magazine = o;
      if (!parts.slide && /slide/i.test(name)) parts.slide = o;
      if (!parts.bolt && /bolt|charging/i.test(name)) parts.bolt = o;
      if (!parts.pump && /pump|fore.?end/i.test(name)) parts.pump = o;
      if (!parts.stock && /stock/i.test(name)) parts.stock = o;
    });
    model.userData.animParts = parts;
    model.userData.animBase = [];
    for (const key of ['magazine', 'slide', 'bolt', 'pump', 'stock']) {
      const node = parts[key];
      if (!node) continue;
      model.userData.animBase.push({
        key,
        node,
        position: node.position.clone(),
        quaternion: node.quaternion.clone(),
      });
    }
  }

  _resetActionPose() {
    const p = this._actionPose;
    p.x = 0; p.y = 0; p.z = 0;
    p.rx = 0; p.ry = 0; p.rz = 0; p.scale = 1;
    p.magY = 0; p.magZ = 0; p.slideZ = 0; p.boltZ = 0;
    p.pumpZ = 0; p.stockX = 0;
  }

  _applyAnimationParts(model, pose) {
    const data = model && model.userData;
    if (!data || !data.animParts) return;
    for (const base of data.animBase || []) {
      base.node.position.copy(base.position);
      base.node.quaternion.copy(base.quaternion);
    }
    const parts = data.animParts;
    if (parts.magazine) {
      parts.magazine.position.y += pose.magY;
      parts.magazine.position.z += pose.magZ;
    }
    if (parts.slide) parts.slide.position.z += pose.slideZ;
    if (parts.bolt) parts.bolt.position.z += pose.boltZ;
    if (parts.pump) parts.pump.position.z += pose.pumpZ;
    if (parts.stock) parts.stock.position.x += pose.stockX;
  }

  _advanceReloadStage(progress) {
    const key = this.weapons[this.currentIndex];
    const sequence = RELOAD_SEQUENCE[key] || RELOAD_SEQUENCE.rifle;
    let stage = 0;
    while (stage < sequence.marks.length && progress >= sequence.marks[stage]) stage++;
    if (stage === this._actionStage) return;
    this._actionStage = stage;
    if (stage > 0 && this.audio) {
      this.audio.play(sequence.sounds[stage - 1], this.currentWeapon.name, { throttleClass: 'weaponAction' });
    }
  }

  _applyReloadPose(key, progress, pose) {
    const wave = Math.sin(Math.min(1, Math.max(0, progress)) * Math.PI);
    pose.y = -0.075 * wave;
    if (key === 'shotgun') {
      const pumpP = clamp01((progress - 0.40) / 0.42);
      const pull = pumpP < 0.5 ? pumpP * 2 : 2 - pumpP * 2;
      pose.pumpZ = -0.14 * Math.min(1, pull);
      pose.x = -0.025 * wave;
      pose.rz = -0.035 * wave;
      return;
    }
    const magOut = clamp01((progress - 0.08) / 0.14);
    const magIn = clamp01((progress - 0.40) / 0.18);
    pose.magY = -0.16 * magOut + 0.16 * magIn;
    pose.magZ = key === 'smg' ? -0.025 * magOut : 0;
    if (key === 'pistol') {
      const slide = Math.sin(Math.min(1, Math.max(0, (progress - 0.66) / 0.18)) * Math.PI);
      pose.slideZ = -0.085 * slide;
    } else {
      const bolt = Math.sin(Math.min(1, Math.max(0, (progress - 0.64) / 0.18)) * Math.PI);
      pose.boltZ = -0.09 * bolt;
      if (key === 'smg') pose.x = -0.018 * wave;
    }
  }

  _applySwitchPose(progress, pose) {
    const p = clamp01(progress);
    this._resetActionPose();
    if (p < 0.40) {
      const t = p / 0.40;
      pose.x = -0.20 * t;
      pose.y = -0.18 * t;
      pose.rz = -0.14 * t;
      pose.scale = 1 - 0.08 * t;
    } else if (p < 0.55) {
      pose.x = -0.20;
      pose.y = -0.18;
      pose.rz = -0.14;
      pose.scale = 0.92;
    } else {
      const t = (p - 0.55) / 0.45;
      pose.x = 0.05 * (1 - t);
      pose.y = -0.18 * (1 - t);
      pose.rz = 0.04 * (1 - t);
      pose.scale = 0.92 + 0.08 * t;
    }
  }

  _createWeaponMeshes() {
    // Materiales POR ARMA (no compartidos): applySkin tiñe dark/accent solo del
    // modelo comprado. Compartir una instancia hacía que la skin del rifle
    // cambiara también pistola/escopeta/SMG.
    const Mats = () => ({
      body:  new THREE.MeshStandardMaterial({ color: 0x3d4557, roughness: 0.55, metalness: 0.45 }),
      black: new THREE.MeshStandardMaterial({ color: 0x191d2c, roughness: 0.45, metalness: 0.55 }),
      grip:  new THREE.MeshStandardMaterial({ color: 0x2b3038, roughness: 0.8, metalness: 0.1 }),
      wood:  new THREE.MeshStandardMaterial({ color: 0x6e4a2f, roughness: 0.75, metalness: 0.05 }),
    });
    // Per-weapon accent materials (swapped by _updateWeaponMesh on switch)
    const accents = { rifle: 0xffb400, pistol: 0x4ade80, shotgun: 0xff5a3c };
    const accentM = {};
    for (const k of Object.keys(accents)) {
      accentM[k] = new THREE.MeshStandardMaterial({ color: accents[k], roughness: 0.35, metalness: 0.3, emissive: 0x402800, emissiveIntensity: 0.35 });
    }

    const add = (group, geo, mat, x, y, z, rotX = 0) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      if (rotX) m.rotation.x = rotX;
      group.add(m);
      return m;
    };

    // ---- RIFLE: full-length, rail + vents + angled mag (the "standard") ----
    const rifle = new THREE.Group();
    const rM = Mats();
    const bodyM = rM.body, blackM = rM.black, gripM = rM.grip;
    add(rifle, new THREE.BoxGeometry(0.09, 0.11, 0.34), bodyM, 0, 0, 0);
    const rifleBolt = add(rifle, new THREE.BoxGeometry(0.055, 0.03, 0.30), blackM, 0, 0.075, -0.02);
    add(rifle, new THREE.BoxGeometry(0.058, 0.012, 0.28), accentM.rifle, 0, 0.062, -0.02); // identity line
    add(rifle, new THREE.BoxGeometry(0.045, 0.045, 0.30), blackM, 0, 0.01, -0.30);
    add(rifle, new THREE.BoxGeometry(0.07, 0.07, 0.16), bodyM, 0, 0.005, -0.24);
    add(rifle, new THREE.BoxGeometry(0.074, 0.02, 0.04), accentM.rifle, 0, 0.045, -0.20);
    add(rifle, new THREE.BoxGeometry(0.074, 0.02, 0.04), accentM.rifle, 0, 0.045, -0.27);
    add(rifle, new THREE.BoxGeometry(0.075, 0.075, 0.06), blackM, 0, 0.01, -0.46);
    add(rifle, new THREE.BoxGeometry(0.082, 0.082, 0.012), accentM.rifle, 0, 0.01, -0.435);
    const rifleMag = add(rifle, new THREE.BoxGeometry(0.06, 0.16, 0.09), blackM, 0, -0.125, 0.04, 0.12); // angled mag
    add(rifle, new THREE.BoxGeometry(0.064, 0.02, 0.094), accentM.rifle, 0, -0.20, 0.052, 0.12);
    add(rifle, new THREE.BoxGeometry(0.06, 0.13, 0.07), gripM, 0, -0.11, 0.16, -0.25);
    add(rifle, new THREE.BoxGeometry(0.03, 0.02, 0.09), blackM, 0, -0.055, 0.10);
    add(rifle, new THREE.BoxGeometry(0.07, 0.10, 0.16), bodyM, 0, -0.01, 0.24);
    add(rifle, new THREE.BoxGeometry(0.072, 0.04, 0.05), gripM, 0, -0.045, 0.30);
    add(rifle, new THREE.BoxGeometry(0.025, 0.05, 0.04), accentM.rifle, 0, 0.115, -0.16); // front sight
    add(rifle, new THREE.BoxGeometry(0.03, 0.03, 0.03), blackM, 0, 0.105, 0.10);
    rifle.userData.parts = { dark: bodyM, black: blackM, accent: accentM.rifle };
    rifle.userData.animParts = { magazine: rifleMag, bolt: rifleBolt };

    // ---- PISTOL: compact slide + stubby barrel + big grip (the "sidearm") ----
    const pistol = new THREE.Group();
    const pM = Mats();
    const bodyM2 = pM.body, blackM2 = pM.black, gripM2 = pM.grip;
    const addP = (geo, mat, x, y, z, rotX = 0) => add(pistol, geo, mat, x, y, z, rotX);
    const pistolSlide = addP(new THREE.BoxGeometry(0.075, 0.09, 0.22), blackM2, 0, 0, -0.02);        // slide
    addP(new THREE.BoxGeometry(0.078, 0.02, 0.20), accentM.pistol, 0, 0.055, -0.02); // slide top stripe
    addP(new THREE.BoxGeometry(0.05, 0.05, 0.05), blackM2, 0, 0.005, -0.16);     // short barrel tip
    addP(new THREE.BoxGeometry(0.06, 0.05, 0.18), bodyM2, 0, -0.06, 0.02);       // frame
    addP(new THREE.BoxGeometry(0.06, 0.15, 0.07), gripM2, 0, -0.13, 0.10, -0.32); // grip
    const pistolMag = addP(new THREE.BoxGeometry(0.064, 0.02, 0.074), accentM.pistol, 0, -0.135, 0.115, -0.32); // mag base
    addP(new THREE.BoxGeometry(0.026, 0.045, 0.03), accentM.pistol, 0, 0.07, -0.12); // front sight
    addP(new THREE.BoxGeometry(0.03, 0.03, 0.03), blackM2, 0, 0.06, 0.08);       // rear sight
    addP(new THREE.BoxGeometry(0.02, 0.03, 0.06), blackM2, 0, -0.035, -0.045);   // trigger guard
    pistol.userData.parts = { dark: bodyM2, black: blackM2, accent: accentM.pistol };
    pistol.userData.animParts = { magazine: pistolMag, slide: pistolSlide };

    // ---- SHOTGUN: long barrel + pump + wide stock (the "heavy") ----
    const shotgun = new THREE.Group();
    const sM = Mats();
    const addS = (geo, mat, x, y, z, rotX = 0) => add(shotgun, geo, mat, x, y, z, rotX);
    addS(new THREE.BoxGeometry(0.11, 0.12, 0.30), sM.body, 0, 0, 0.02);          // chunky receiver
    addS(new THREE.BoxGeometry(0.115, 0.02, 0.26), accentM.shotgun, 0, 0.072, 0.02); // receiver top band
    addS(new THREE.BoxGeometry(0.055, 0.055, 0.46), sM.black, 0, 0.015, -0.34);  // LONG barrel
    addS(new THREE.BoxGeometry(0.085, 0.085, 0.035), sM.black, 0, 0.015, -0.56); // thick muzzle
    addS(new THREE.BoxGeometry(0.09, 0.022, 0.05), accentM.shotgun, 0, 0.015, -0.52); // muzzle ring
    const shotgunPump = addS(new THREE.BoxGeometry(0.062, 0.062, 0.14), sM.wood, 0, -0.055, -0.22);  // pump handle
    addS(new THREE.BoxGeometry(0.066, 0.02, 0.15), accentM.shotgun, 0, -0.055, -0.22); // pump rails
    addS(new THREE.BoxGeometry(0.07, 0.13, 0.07), sM.wood, 0, -0.10, 0.18, -0.28); // wood grip
    addS(new THREE.BoxGeometry(0.08, 0.11, 0.20), sM.wood, 0, -0.015, 0.30);     // wood stock
    addS(new THREE.BoxGeometry(0.03, 0.05, 0.04), accentM.shotgun, 0, 0.09, -0.16); // bead sight
    shotgun.userData.parts = { dark: sM.body, black: sM.black, accent: accentM.shotgun };
    shotgun.userData.animParts = { pump: shotgunPump };

    // ---- SMG: compacta, cargador largo, culata plegable (la "rápida") ----
    accents.smg = 0x39d7ff;
    accentM.smg = new THREE.MeshStandardMaterial({ color: accents.smg, roughness: 0.35, metalness: 0.3, emissive: 0x0a2a33, emissiveIntensity: 0.35 });
    const smg = new THREE.Group();
    const gM = Mats();
    const addG = (geo, mat, x, y, z, rotX = 0) => add(smg, geo, mat, x, y, z, rotX);
    addG(new THREE.BoxGeometry(0.075, 0.10, 0.26), gM.body, 0, 0, -0.02);
    const smgBolt = addG(new THREE.BoxGeometry(0.05, 0.028, 0.22), gM.black, 0, 0.068, -0.04);
    addG(new THREE.BoxGeometry(0.052, 0.012, 0.20), accentM.smg, 0, 0.05, -0.04);
    addG(new THREE.BoxGeometry(0.042, 0.042, 0.14), gM.black, 0, 0.005, -0.24);
    addG(new THREE.BoxGeometry(0.062, 0.062, 0.045), gM.black, 0, 0.005, -0.325);
    addG(new THREE.BoxGeometry(0.078, 0.02, 0.035), accentM.smg, 0, 0.05, -0.30); // muzzle ring
    const smgMag = addG(new THREE.BoxGeometry(0.055, 0.17, 0.075), gM.black, 0, -0.115, 0.02);     // long mag
    addG(new THREE.BoxGeometry(0.06, 0.02, 0.08), accentM.smg, 0, -0.205, 0.03);
    addG(new THREE.BoxGeometry(0.05, 0.12, 0.06), gM.grip, 0, -0.095, 0.12, -0.28);
    addG(new THREE.BoxGeometry(0.065, 0.075, 0.13), gM.body, 0, -0.005, 0.20);
    addG(new THREE.BoxGeometry(0.06, 0.05, 0.10), gM.black, 0, 0.02, 0.30);         // folded stock
    addG(new THREE.BoxGeometry(0.024, 0.04, 0.03), accentM.smg, 0, 0.095, -0.16);
    smg.userData.parts = { dark: gM.body, black: gM.black, accent: accentM.smg };
    smg.userData.animParts = { magazine: smgMag, bolt: smgBolt };

    return { rifle, pistol, shotgun, smg };
  }

  // ── Brazos para el FALLBACK técnico: mismo diseño que los del GLB. Se crean
  // UNA vez y se cuelgan de la escena; update() los sincroniza con el arma
  // activa (position/quaternion/scale + offset local). Sin allocs por frame.
  _ensureFallbackArms() {
    if (this._fallbackArms) return;
    // Emissive sutil del propio tono: el viewmodel vive en el encuadre SIEMPRE
    // (bajo el arma mirando arriba, contra el cielo, de espaldas al sol); sin
    // él los brazos caen a silueta negra y el agarre se vuelve ilegible.
    const sleeveMat = new THREE.MeshStandardMaterial({ color: 0x39445c, roughness: 0.8, metalness: 0.05, emissive: 0x39445c, emissiveIntensity: 0.30 });
    const skinMat   = new THREE.MeshStandardMaterial({ color: 0xd9a066, roughness: 0.7, metalness: 0.0, emissive: 0xd9a066, emissiveIntensity: 0.28 });
    const gloveMat  = new THREE.MeshStandardMaterial({ color: 0x9fb0d8, roughness: 0.75, metalness: 0.1, emissive: 0x9fb0d8, emissiveIntensity: 0.38 });
    const mk = (w, h, d, mat, x, y, z, rx = 0) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.position.set(x, y, z);
      if (rx) m.rotation.x = rx;
      return m;
    };
    const armR = new THREE.Group();
    armR.add(mk(0.085, 0.085, 0.30, sleeveMat, 0.05, -0.045, 0.16, 0.22));
    armR.add(mk(0.075, 0.075, 0.16, gloveMat,  0.02, -0.075, 0.02, -0.10));
    armR.add(mk(0.06, 0.07, 0.09,  skinMat,    0.015, -0.10, -0.03));
    const armL = new THREE.Group();
    armL.add(mk(0.08, 0.08, 0.26, sleeveMat, -0.05, -0.06, -0.05, -0.28));
    armL.add(mk(0.07, 0.07, 0.14, gloveMat,  -0.02, -0.045, -0.14, 0.12));
    armL.add(mk(0.058, 0.065, 0.08, skinMat, -0.015, -0.03, -0.19));
    const g = new THREE.Group();
    g.add(armR, armL);
    g.visible = false;
    this.scene.add(g);
    this._fallbackArms = g;
  }

  // Sincroniza los brazos del fallback con el viewmodel activo.
  // Offset local fijo (reciclado): los brazos nacen un poco más abajo/lado
  // que el arma para que las manos caigan sobre grip y guardamanos.
  _syncFallbackArms(bobX, bobY) {
    this._ensureFallbackArms();
    const arms = this._fallbackArms;
    const mesh = this.weaponMesh;
    const displayKey = this._displayWeaponKey || this.weapons[this.currentIndex];
    const isFallback = mesh && this._weaponModels[displayKey] === mesh;
    // Solo visibles si el JUEGO considera al fallback el viewmodel activo
    // (glb ausente u oculto por debug). El update() de Game ya apagó el
    // fuera de partida: ese flag basta, no hace falta duplicarlo.
    arms.visible = !!(isFallback && this.weaponMesh.visible);
    if (!arms.visible) return;
    if (!this._armOffset) this._armOffset = new THREE.Vector3();
    this._armOffset.set(0.01, -0.03, 0.02).applyQuaternion(mesh.quaternion);
    arms.position.copy(mesh.position).add(this._armOffset);
    arms.quaternion.copy(mesh.quaternion);
    arms.scale.copy(mesh.scale);
  }

  // ── SKINS: aplica los colores de la skin al modelo del arma ──
  // 'none'/Estándar restaura los colores originales (cacheados la 1ª vez).
  applySkin(weaponKey, skinKey) {
    const skin = WeaponSkins[skinKey] || WeaponSkins.none;
    const model = this._weaponModels[weaponKey];
    if (!model || !skin) return;
    const parts = model.userData.parts || {};
    if (!model.userData.origColors && parts.accent && parts.dark) {
      model.userData.origColors = { accent: parts.accent.color.getHex(), dark: parts.dark.color.getHex() };
    }
    const orig = model.userData.origColors || {};
    if (parts.accent) parts.accent.color.setHex((skin.accent ?? orig.accent) ?? 0xffffff);
    if (parts.dark) parts.dark.color.setHex((skin.dark ?? orig.dark) ?? 0xffffff);
  }

  // Per-weapon viewmodel presets (position offset + scale + muzzle tip z).
  // Built ONCE: update() ran this every frame (3 Vector3 + object per frame → GC churn).
  _viewPresets() {
    if (!this._presetsCache) this._presetsCache = {
      // muzzle = punta del cañón en espacio de cámara. Modelos RECENTRADOS por
      // Box3 (el wrap tiene el centro geométrico en su origen), así que la
      // punta ≈ -(largo_final/2) por arma: rifle 0.34, pistol 0.10, shotgun
      // 0.36 (1.39u*0.26/2), smg 0.18.
      rifle:   { pos: new THREE.Vector3(0.26, -0.22, -0.45), scale: 1.0,  muzzle: -0.48 },
      pistol:  { pos: new THREE.Vector3(0.22, -0.20, -0.38), scale: 0.9,  muzzle: -0.26 },
      shotgun: { pos: new THREE.Vector3(0.28, -0.24, -0.42), scale: 1.15, muzzle: -0.60 },
      smg:     { pos: new THREE.Vector3(0.24, -0.21, -0.40), scale: 1.0,  muzzle: -0.35 },
    };
    return this._presetsCache;
  }

  update(dt, canShoot) {
    this._wClock += dt;
    if (this.fireCooldown > 0) this.fireCooldown -= dt;
    if (this.isReloading) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) {
        const needed = this.currentWeapon.magazineSize - this.ammoInMag;
        const toLoad = Math.min(needed, this.reserveAmmo);
        this.ammoInMag += toLoad;
        this.reserveAmmo -= toLoad;
        this.isReloading = false;
        this._actionStage = -1;
        if (this.audio) this.audio.play('reloadEnd', this.currentWeapon.name);
      }
    }
    // Recoil recovery (spring back)
    this.recoilOffset = THREE.MathUtils.lerp(this.recoilOffset, 0, Math.min(1, dt * 9));
    this.recoilKick = THREE.MathUtils.lerp(this.recoilKick || 0, 0, Math.min(1, dt * 10));

    // Hide viewmodel outside a live match (lobby orbit shows the arena).
    // _updateWeaponMesh also reads this flag so late GLB loads cannot resurrect
    // a weapon over the lobby or death/spectator HUD.
    this._viewmodelVisible = canShoot !== false;
    if (this.weaponMesh) this.weaponMesh.visible = this._viewmodelVisible;
    if (!this._viewmodelVisible && this._fallbackArms) this._fallbackArms.visible = false;
    if (canShoot === false) return;

    let switchProgress = 0;
    const wasSwitching = this._switchAnim > 0;
    if (wasSwitching) {
      this._switchAnim = Math.max(0, this._switchAnim - dt);
      switchProgress = 1 - (this._switchAnim / (this._switchDuration || 0.42));
      if (this._switchPending && switchProgress >= 0.40) {
        this._switchPending = false;
        this._displayWeaponKey = this.weapons[this.currentIndex];
        this._updateWeaponMesh();
        this._switchStage = 1;
        if (this.audio) this.audio.play('switch_swap', this.currentWeapon.name, { throttleClass: 'weaponAction' });
      }
      if (this._switchAnim === 0) {
        if (this._switchStage < 2 && this.audio) {
          this.audio.play('equip', this.currentWeapon.name, { throttleClass: 'weaponAction' });
        }
        this._switchStage = -1;
        this._switchPreviousKey = null;
        this._switchReady = false;
      }
    }

    // Weapon viewmodel follows camera with ADS blend + recoil kickback
    // + walk bob/sway so the gun feels physically held, not glued to screen
    if (this.weaponMesh) {
      const displayKey = this._displayWeaponKey || this.weapons[this.currentIndex];
      const preset = this._viewPresets()[displayKey] || this._viewPresets().rifle;
      // ADS pulls the weapon to center
      const ads = this._adsBlend;
      const pose = this._actionPose;
      this._resetActionPose();
      if (this.isReloading) {
        const progress = clamp01((this.currentWeapon.reloadTime - this.reloadTimer) / this.currentWeapon.reloadTime);
        this._advanceReloadStage(progress);
        this._applyReloadPose(this.weapons[this.currentIndex], progress, pose);
      } else if (wasSwitching) {
        this._applySwitchPose(switchProgress, pose);
      }

      // Walk bob driven by the player's horizontal speed (Game feeds it each
      // frame via setMoveSpeed). Bob is applied AFTER the smoothed base so the
      // lerp can never damp it away (validated with pixel ground-truth).
      this._bobPhase = (this._bobPhase || 0) + dt * (5 + (this.moveSpeedNow || 0) * 1.1);
      const speed01 = Math.min(1, (this.moveSpeedNow || 0) / 6);
      const bobAmt = (1 - ads * 0.85) * speed01;          // ADS nearly stills the gun
      const bobY = Math.sin(this._bobPhase * 2) * 0.024 * bobAmt;
      const bobX = Math.cos(this._bobPhase) * 0.030 * bobAmt;

      const targetX = THREE.MathUtils.lerp(preset.pos.x, 0.0, ads) + pose.x;
      const targetY = THREE.MathUtils.lerp(preset.pos.y, -0.145, ads) + pose.y;
      const targetZ = THREE.MathUtils.lerp(preset.pos.z, -0.30, ads) + pose.z + (this.recoilKick || 0) * 0.09;

      // Smooth follow for the BASE position only
      this._vmPos = this._vmPos || preset.pos.clone();
      this._vmPos.x = THREE.MathUtils.lerp(this._vmPos.x, targetX, Math.min(1, dt * 14));
      this._vmPos.y = THREE.MathUtils.lerp(this._vmPos.y, targetY, Math.min(1, dt * 14));
      this._vmPos.z = THREE.MathUtils.lerp(this._vmPos.z, targetZ, Math.min(1, dt * 14));

      this.weaponMesh.position.copy(this.camera.position);
      this.weaponMesh.quaternion.copy(this.camera.quaternion);
      const offset = this._vmOffset.copy(this._vmPos);
      offset.x += bobX; offset.y += bobY;    // bob on top of smoothed base
      offset.applyQuaternion(this.camera.quaternion);
      this.weaponMesh.position.add(offset);

      // Recoil pitch on viewmodel + subtle roll with the bob
      this.weaponMesh.rotation.x = this.camera.rotation.x + pose.rx - (this.recoilOffset || 0) * 0.05 - (this.recoilKick || 0) * 0.10;
      this.weaponMesh.rotation.y = this.camera.rotation.y + pose.ry;
      this.weaponMesh.rotation.z = this.camera.rotation.z + pose.rz + bobX * 1.2;
      const s = preset.scale * (1 - ads * 0.12) * pose.scale;
      this.weaponMesh.scale.setScalar(s);
      this._applyAnimationParts(this.weaponMesh, pose);
      // Brazos del fallback siguen al arma con el mismo bob/recoil.
      this._syncFallbackArms(bobX, bobY);
    }
  }

  // Game feeds the player's horizontal speed each frame for bob/sway
  setMoveSpeed(speed) {
    this.moveSpeedNow = speed;
  }

  // ADS state blend (0..1), driven by Input.aim from Game
  setAim(aiming, dt) {
    const target = aiming ? 1 : 0;
    this._adsBlend = THREE.MathUtils.lerp(this._adsBlend || 0, target, Math.min(1, dt * 12));
  }

  canFire(usesPlayerAmmo = true, shooter = null) {
    // isReloading is exclusively the player's state (bots never reload). It
    // must NOT gate bots: probing showed every bot went silent for the whole
    // player reload (1.1–1.9s), gifting the player a free-push window.
    if (usesPlayerAmmo && this.isReloading) return false;
    if (usesPlayerAmmo && this.fireCooldown > 0) return false;
    if (usesPlayerAmmo && this.ammoInMag <= 0) {
      // Dry-fire click only when actively trying to shoot (not on spam frames)
      if (!this._emptyClickAt || performance.now() - this._emptyClickAt > 250) {
        this._emptyClickAt = performance.now();
        if (this.audio) this.audio.play('empty');
      }
      this.reload();
      return false;
    }
    // Cadencia POR TIRADOR (bot): el cooldown y el cargador son del jugador.
    // El fireCooldown GLOBAL que antes bloqueaba a los bots silenciaba al
    // equipo entero hasta 3s tras CADA disparo de cualquier bot — rondas
    // "vacías" con todos paseándose y rondas perdidas sin combate visto.
    if (shooter && shooter.isBot) {
      const until = this._botFireCd.get(shooter.id) || 0;
      if (this._wClock < until) return false;
    }
    return true;
  }

  // ── fire(): la RUTA ÚNICA del disparo (intención → cadencia → trayectoria
  // → oclusión → daño → feedback) ──
  //
  // opts (SOLO bots): { origin, aim, listener }
  //   origin:   posición mundial del cañón (raycast + impactos).
  //   aim:      dirección normalizada del disparo (base del spread).
  //   listener: quién OYE el disparo (attenuación por distancia).
  // El jugador omite opts: su cámara es dueña del origen y del aim.
  // Sin esto, Game tenía que SECUESTRAR la cámara hacia el ojo de cada bot
  // (mover → disparar → restaurar), acoplamiento que ya causó el bug de
  // volumen del test 12.
  fire(shooter, targets, map = null, opts = null) {
    const usesPlayerAmmo = !shooter.isBot;
    if (!this.canFire(usesPlayerAmmo, shooter)) return null;
    // Regla Free Fire: DISPARAR rompe la protección de spawn. Sin esto, el
    // jugador podría disparar inmune (la inmunidad nunca se quitaría en uso real).
    if (usesPlayerAmmo && this.game && this.game.onPlayerFired) this.game.onPlayerFired();

    // Los bots disparan SU arma comprada en la fase de compra; el jugador
    // dispara la que tiene equipada. Nadie comparte arma con nadie.
    const weapon = shooter.isBot ? (WeaponData[shooter.weaponKey] || WeaponData.rifle) : this.currentWeapon;

    // Origen del rayo y oyente: explícitos para bots, cámara para el jugador.
    const origin = (opts && opts.origin) || this.camera.position;
    const aimDir = (opts && opts.aim) || null; // bots: puntería propia; jugador: cámara
    const listener = (opts && opts.listener) || origin;

    // Tracer bookkeeping: one streak per shot from the muzzle to where the
    // round actually landed (hit or wall). Player sees their own bullet;
    // bot tracers make incoming fire visible and readable. For the player,
    // the origin gets refined to the viewmodel muzzle below.
    const tracerFrom = origin.clone();
    let tracerTo = null;

    if (usesPlayerAmmo) {
      this.ammoInMag--;
      this.fireCooldown = weapon.fireRate;
      this.recoilOffset += weapon.recoil;
      this.recoilKick = Math.min(1.4, (this.recoilKick || 0) + weapon.recoil * 0.5);
      // Camera recoil kick — handled by the controller that owns the camera.
      // Amplitude tuned so ONE shot is visible at a glance (per vision audit:
      // previous 0.011 was imperceptible).
      if (this.playerController && this.playerController.addRecoil) {
        const ads = this._adsBlend || 0;
        const scale = 1 - ads * 0.35;
        this.playerController.addRecoil(weapon.recoil * 0.028 * scale, (Math.random()-0.5) * weapon.recoil * 0.014);
      }
    } else if (shooter && shooter.isBot) {
      // Cadencia del PROPIO bot (misma fireRate del arma que el jugador):
      // antes un solo disparo de un bot congelaba a TODO el equipo hasta 3s
      // (cooldown global) — equipo mudo = rondas sin combate (bug P0).
      this._botFireCd.set(shooter.id, this._wClock + weapon.fireRate);
    }

    // Crosshair feedback (player only)
    if (usesPlayerAmmo && this.crosshair) {
      this.crosshair.classList.add('fire');
      setTimeout(()=> this.crosshair.classList.remove('fire'), 80);
    }

    // Gunfire audio. Bot shots: separate throttle class (so a bot firing
    // within 30ms of the player's shot can no longer mute the player's own
    // gunshot) and distance attenuation (far gunfire must not be as loud as
    // the weapon in your hands).
    if (this.audio) {
      if (usesPlayerAmmo) {
        this.audio.play('shoot', weapon.name);
      } else {
        const dist = shooter.position ? listener.distanceTo(shooter.position) : 20;
        const vol = Math.max(0.12, Math.min(0.85, 1 - dist / 45));
        this.audio.play('shoot', weapon.name, { throttleClass: 'shootBot', volumeScale: vol });
      }
    }

    // Muzzle flash — from viewmodel muzzle in world space
    if (usesPlayerAmmo && this.vfx) {
      const preset = this._viewPresets()[this.weapons[this.currentIndex]] || this._viewPresets().rifle;
      const ads = this._adsBlend || 0;
      const mx = THREE.MathUtils.lerp(preset.pos.x, 0, ads);
      const my = THREE.MathUtils.lerp(preset.pos.y, -0.145, ads);
      const mz = THREE.MathUtils.lerp(preset.pos.z, -0.30, ads) + preset.muzzle; // per-weapon muzzle tip
      const muzzleLocal = new THREE.Vector3(mx, my + 0.01, mz);
      const muzzleWorld = muzzleLocal.applyQuaternion(this.camera.quaternion).add(this.camera.position);
      // Muzzle flash size carries weapon identity: shotgun cannon-blast,
      // rifle standard, pistol compact.
      const flashSize = weapon === WeaponData.shotgun ? 1.7 : weapon === WeaponData.pistol ? 0.75 : 1.0;
      this.vfx.muzzleFlash(muzzleWorld, this.camera.getWorldDirection(new THREE.Vector3()), flashSize);
      tracerFrom.copy(muzzleWorld); // the player's tracer leaves the viewmodel muzzle
    }

    // Raycast for each pellet
    let hits = [];

    // ── DIRECCIÓN BASE (una sola vez por disparo) ──
    // Jugador: cámara. Bot: su puntería explícita. Sobre ESTA dirección actúa
    // UNA única asistencia y a su alrededor se genera el spread — así el
    // patrón de escopeta JAMÁS se comprime: la asistencia puede mover el
    // CENTRO del patrón, no cerrar sus postas.
    const baseDir = new THREE.Vector3();
    if (aimDir) baseDir.copy(aimDir);
    else this.camera.getWorldDirection(baseDir);

    // ── AIM ASSIST (solo jugador): UNA fricción suave sobre la DIRECCIÓN BASE,
    // ANTES del spread. Sin snap; la CABEZA es recompensa del input vertical
    // REAL del jugador (levantar la mira), jamás de un pull automático. La
    // asistencia decae con la distancia angular, cae a cero si el objetivo
    // está tras cobertura, nunca actúa sobre aliados y es menor en PC que en
    // touch. CADA PELLET NO EJECUTA SU PROPIA ASISTENCIA (order fix: antes el
    // pull corría dentro del bucle y comprimía el patrón de la escopeta).
    if (usesPlayerAmmo) {
      const touch = this.game && this.game._isTouchPlatform;
      const assistCone = (touch ? 0.11 : 0.07);      // mitad de cono (rad)
      const maxPull = (touch ? 0.055 : 0.035);        // rotación máxima (rad)
      let bestDev = Infinity;
      let bestDist = 0;
      let pullDir = null;
      let pullStrength = 0;
      for (const target of targets) {
        if (target === shooter || !target.isAlive) continue;
        // escuadras: jamás asistencia sobre ALIADOS
        if (target.isBot && (target.team || 'enemy') === 'ally') continue;
        if (target.isBot && shooter.team && (target.team || 'enemy') === shooter.team) continue;
        const th = target.height || 1.65;
        const chest = target.position.clone(); chest.y -= th * 0.38;
        const toChest = chest.clone().sub(origin);
        const dist = toChest.length();
        if (dist > weapon.range) continue;
        toChest.normalize();
        const dot = toChest.dot(baseDir);
        if (dot <= Math.cos(assistCone)) continue;      // fuera del cono
        // Oclusión: la asistencia muere si el torso está tras un muro
        if (map) {
          const mapBlock = map.raycast(origin, toChest, dist - 0.4);
          if (mapBlock) continue;
        }
        // desviación angular del rayo crudo respecto al pecho
        const dev = Math.acos(Math.min(1, dot));
        if (dev < bestDev) {
          bestDev = dev;
          bestDist = dist;
          // dirección de jalado: del rayo crudo HACIA el pecho, escalada
          // por cercanía al centro del cono (magnetismo progresivo)
          pullStrength = maxPull * (1 - dev / assistCone);
          pullDir = toChest;
        }
      }
      if (pullDir) {
        // Fricción: acerca UNA FRACCIÓN del hueco, nunca fija el objetivo.
        // TECHO DEL CIERRE (bug headDrag): el lerp por-dev (≈0.71 a 12u en
        // touch) podía desplazar el rayo MÁS que el error de puntería del
        // jugador — apuntar EXACTO a la cabeza quedaba jalado al torso
        // (0.51u de caída a 12u: fuera de la esfera de 0.28). La fricción
        // ayuda a ACERCARSE, jamás a atravesar el punto apuntado: el cierre
        // se limita a la MITAD del error angular y a un techo lineal con la
        // distancia (0.30 rad·u ≈ 0.28 rad a 0.9u vs 0.033 a 9.5u), así el
        // drag vertical REAL del jugador siempre puede ganar y llevar el
        // tiro a la cabeza — el assist crea espacio, no lo consume.
        const gapClosed = Math.min(
          Math.min(0.85, pullStrength / Math.max(0.02, bestDev)),
          bestDev * 0.5,
          0.30 / Math.max(2, bestDist)
        );
        baseDir.lerp(pullDir, gapClosed).normalize();
      }
    }

    // Spread en SHOOTER space alrededor de la dirección base YA asistida.
    // World-space x/y offsets made the cone collapse to a line when facing
    // ±X (east/west), so shotgun spread depended on where you were looking,
    // not where you aimed. Jugador: ejes de la base; bots: base ortonormal
    // desde su aim explícito (sin secuestro de cámara).
    const camRight = new THREE.Vector3().crossVectors(baseDir, UP).normalize();
    const camUp = new THREE.Vector3().crossVectors(camRight, baseDir).normalize();
    // Crouch steadies the aim: up to −15% spread at full crouch (classic
    // crouch-accuracy contract, matches the slower crouch speed).
    const crouchBonus = this.playerController ? 1 - (this.playerController.crouchBlend || 0) * 0.15 : 1;
    for (let p = 0; p < weapon.pellets; p++) {
      // ADS tightens spread (stable aim) — PLAYER ONLY: _adsBlend is the
      // player's aim state; bots inheriting it made the whole bot squad
      // silently sharpen whenever the player aimed down sights.
      const spreadScale = usesPlayerAmmo
        ? (1 - (this._adsBlend || 0) * 0.65) * crouchBonus
        : 1;
      const spreadX = (Math.random()-0.5) * weapon.spread * spreadScale;
      const spreadY = (Math.random()-0.5) * weapon.spread * spreadScale;

      const direction = baseDir.clone();
      // Apply spread around the shooter's own axes (SIN asistencia por posta:
      // el patrón respeta el spread del arma, el centro ya fue asistido)
      direction.addScaledVector(camRight, spreadX).addScaledVector(camUp, spreadY);
      direction.normalize();

      this.raycaster.set(origin, direction);
      // Check against targets (players/bots + map)
      // For map, we use a simple ray against map boxes (handled in Game)
      let closestHit = null;
      let closestDist = weapon.range;

      // A wall takes priority over a target behind it. This must happen before
      // damage is applied; filtering the result afterwards cannot undo a hit.
      const mapHit = map && map.raycast(origin, direction, closestDist);
      if (mapHit) closestDist = mapHit.distance;

      for (const target of targets) {
        if (target === shooter) continue;
        if (!target.isAlive) continue;
        // Sin fuego amigo: mismo equipo nunca impacta (escuadras). En FFA los
        // equipos son únicos, así que este filtro no cambia nada allí.
        if (shooter.team && target.team && shooter.team === target.team) continue;
        // Target.position is eye height: feet = y - height. Hitboxes must be
        // measured DOWN from eye, matching the visible mesh:
        // head cube center ≈ feet+1.55 → eye-0.10, body torso ≈ eye-0.62.
        const h = target.height || 1.65;
        const bodyPos = target.position.clone(); bodyPos.y -= h * 0.38;
        const headPos = target.position.clone(); headPos.y -= 0.10;
        const legPos = target.position.clone(); legPos.y -= h * 0.72;
        const toBody = new THREE.Vector3().subVectors(bodyPos, origin);
        const projDist = toBody.dot(direction);
        if (projDist < 0 || projDist > closestDist) continue;
        const closestPoint = origin.clone().addScaledVector(direction, projDist);
        const bodyHit = closestPoint.distanceTo(bodyPos) < 0.55;
        const headHit = closestPoint.distanceTo(headPos) < 0.28;
        // Piernas: la esfera del pecho no llega a las espinillas de pie
        // (cuenta como cuerpo, nunca como headshot).
        const legHit = closestPoint.distanceTo(legPos) < 0.42;

        if (bodyHit || headHit || legHit) {
          closestDist = projDist;
          closestHit = { target, distance: projDist, headshot: headHit, point: closestPoint.clone() };
        }
      }

      if (closestHit) {
        hits.push(closestHit);
      } else {
        if (this.vfx) {
          const missPoint = mapHit
            ? mapHit.point
            : origin.clone().addScaledVector(direction, 45);
          this.vfx.impact(missPoint, null);
          if (!tracerTo) tracerTo = missPoint;
        }
        // Wall ricochet sound only when the player's own shot hits geometry
        if (mapHit && usesPlayerAmmo && this.audio) {
          this.audio.play('impact_wall');
        }
      }
    }

    // Apply damage for hits (for shotgun, multiple pellets can hit same target, count once but sum damage)
    // Group hits by target
    const hitsByTarget = new Map();
    for (const hit of hits) {
      if (!hitsByTarget.has(hit.target)) hitsByTarget.set(hit.target, []);
      hitsByTarget.get(hit.target).push(hit);
    }

    let totalDamage = 0;
    let killed = false;
    for (const [target, targetHits] of hitsByTarget) {
      let damage = 0;
      let isHeadshot = false;
      for (const h of targetHits) {
        // Damage falloff by distance: full damage up to falloffStart, then
        // linear decay to falloffMin at weapon range. Gives each weapon a
        // combat-distance identity (shotgun = close monster, rifle = mid-long).
        let dmg = weapon.damage * (h.headshot ? weapon.headshotMul : 1);
        const start = weapon.falloffStart ?? weapon.range * 0.5;
        if (h.distance > start && weapon.range > start) {
          const k = (h.distance - start) / (weapon.range - start);
          dmg *= 1 - (1 - (weapon.falloffMin ?? 0.5)) * k;
        }
        damage += dmg;
        if (h.headshot) isHeadshot = true;
      }
      // Game owns scores, death feedback and respawns for both player and bots.
      if (this.applyDamage) {
        const died = this.applyDamage(target, damage, isHeadshot ? 'head' : 'body', shooter);
        if (died) killed = true;
        totalDamage += damage;
        // VFX
        if (this.vfx) {
          const hitPoint = targetHits[0].point;
          this.vfx.impact(hitPoint, isHeadshot);
          this.vfx.blood(hitPoint);
          if (!tracerTo) tracerTo = hitPoint;
        }
        // Número de daño: UNO por víctima y disparo con el daño REAL acumulado
        // (post-falloff, postas de escopeta sumadas). Solo para el jugador.
        if (usesPlayerAmmo && this.game && this.game.damageNumbers) {
          this.game.damageNumbers.show(damage, targetHits[0].point, isHeadshot, died);
        }
      }
    }

    // Tracer streak — from the muzzle to the landing point. The player's
    // tracer starts at the viewmodel muzzle (already computed for the flash);
    // bot tracers start just off their eye so incoming fire is visible.
    if (this.vfx && tracerTo) {
      this.vfx.tracer(tracerFrom, tracerTo);
    }

    // Hitmarker — hierarchy: body hit (small yellow) → headshot (bigger, red
    // tint + sharper sound) → kill (largest, red). The player learns the
    // difference without reading anything.
    // NOTE: on a KILL this does NOT play a kill sound — Game.applyDamage owns
    // kill audio. Playing it here too doubled every kill jingle (audio bug).
    if (usesPlayerAmmo && hits.length > 0) {
      const headshot = hits.some(h => h.headshot);
      this.showHitmarker(killed, headshot && !killed);
      if (!killed && this.audio) this.audio.play(headshot ? 'headshot' : 'hit');
      if (headshot && !killed && this.game && this.game.hud) this.game.hud.showHitBanner(true);
    }

    return { hits, totalDamage, killed };
  }

  showHitmarker(killed, headshot = false) {
    if (!this.hitmarker) return;
    this.hitmarker.classList.add('show');
    // Headshot-no-kill: white-hot core (bigger pop), kill: red (biggest)
    this.hitmarker.classList.toggle('hs', headshot && !killed);
    const ticks = this.hitmarker.querySelectorAll('i');
    const color = killed ? '#ff4444' : (headshot ? '#ffffff' : '#ffd23f');
    ticks.forEach(t => t.style.background = color);
    clearTimeout(this._hmTimer);
    this._hmTimer = setTimeout(()=> {
      this.hitmarker.classList.remove('show');
      this.hitmarker.classList.remove('hs');
    }, killed ? 240 : (headshot ? 170 : 120));
    if (this.crosshair) {
      this.crosshair.classList.add('hit');
      setTimeout(()=> this.crosshair.classList.remove('hit'), 120);
    }
  }

  reload() {
    if (this.isReloading) return;
    if (this.ammoInMag === this.currentWeapon.magazineSize) return;
    if (this.reserveAmmo <= 0) return;
    if (this._switchAnim > 0) this._finishSwitch();
    this.isReloading = true;
    this.reloadTimer = this.currentWeapon.reloadTime;
    this._actionStage = 0;
    if (this.audio) this.audio.play('reloadStart', this.currentWeapon.name);
  }

  // dir: 1-3 selects a slot, -1 cycles to the previous weapon, 'next' cycles
  // forward (KeyE / mobile switch button — a fixed slot would trap mobile
  // players on the pistol).
  switchWeapon(dir) {
    if (this.isReloading) return;
    if (this._switchAnim > 0) this._finishSwitch();
    // Duelo de Escuadras: SOLO armas en propiedad (la TIENDA desbloquea el resto)
    const isOwned = (i) => this.owned.has(this.weapons[i]);
    let idx = this.currentIndex;
    if (dir === 'next' || dir === -1) {
      // Ciclar (Q/E/botón ARMA) salta las no-owned: el ciclo debe terminar en
      // un arma PROPIA en ambas direcciones (antes prev se rendía si el slot
      // adyacente no era owned y el botón moría).
      const step = dir === 'next' ? 1 : -1;
      let g = 0;
      do { idx = (idx + step + this.weapons.length) % this.weapons.length; g++; }
      while (g <= this.weapons.length && !isOwned(idx));
      if (!isOwned(idx)) return; // el inventario entero sin posesión
    } else if (typeof dir === 'number' && dir >= 1 && dir <= this.weapons.length) {
      if (!isOwned(dir - 1)) return; // no comprada: la tienda manda
      idx = dir - 1;
    } else {
      idx = (idx + dir + this.weapons.length) % this.weapons.length;
      if (!isOwned(idx)) return;
    }
    if (idx === this.currentIndex) return;
    this.currentIndex = idx;
    this.currentWeapon = WeaponData[this.weapons[this.currentIndex]];
    // Fresh mag on switch keeps the loop simple; ammo economy is not a goal.
    this.ammoInMag = this.currentWeapon.magazineSize;
    this.reserveAmmo = this.currentWeapon.magazineSize * 3;
    this.isReloading = false;
    this.fireCooldown = 0.2;
    // Visible switch animation: unequip → swap → equip → ready. The previous
    // model stays visible until the handoff phase, so a switch never pops
    // straight from one silhouette to another.
    const oldKey = this._displayWeaponKey || this.weapons[this.currentIndex];
    this._switchPreviousKey = oldKey;
    this._switchDuration = SWITCH_DURATIONS[this.weapons[idx]] || 0.38;
    this._switchAnim = this._switchDuration;
    this._switchPending = true;
    this._switchStage = 0;
    this._switchReady = true;
    if (this.audio) this.audio.play('switch', this.currentWeapon.name);
  }

  _updateWeaponMesh() {
    if (!this._weaponModels) return;
    const current = this.weapons[this.currentIndex];
    const display = (this._switchPending && this._switchPreviousKey)
      ? this._switchPreviousKey
      : (this._displayWeaponKey || current);
    const glb = this._glbModels && this._glbModels[display];
    for (const key of Object.keys(this._weaponModels)) {
      this._weaponModels[key].visible = this._viewmodelVisible && !glb && key === display;
    }
    for (const key of Object.keys(this._glbModels || {})) {
      this._glbModels[key].visible = this._viewmodelVisible && key === display;
    }
    this.weaponMesh = glb || this._weaponModels[display];
    // El viewmodel activo escala/bobea vía preset; el GLB hereda transform
    // del wrap — aplicar la skin del arsenal también tiñe el GLB (accent).
    if (glb) this._applySkinToGlb(display);
  }

  _finishSwitch() {
    if (this._switchAnim <= 0 && !this._switchPending) return;
    this._switchAnim = 0;
    this._switchPending = false;
    this._switchPreviousKey = null;
    this._switchStage = -1;
    this._switchReady = false;
    this._displayWeaponKey = this.weapons[this.currentIndex];
    this._updateWeaponMesh();
  }

  resetTransient() {
    this.isReloading = false;
    this.reloadTimer = 0;
    this.fireCooldown = 0;
    this._finishSwitch();
    this._actionStage = -1;
    this._resetActionPose();
    this._displayWeaponKey = this.weapons[this.currentIndex];
    this._updateWeaponMesh();
  }

  // Skins sobre GLB: tiñe la malla (colormap de Kenney) con el accent global.
  _applySkinToGlb(weaponKey) {
    const wrap = this._glbModels && this._glbModels[weaponKey];
    if (!wrap) return;
    const skin = (this.game && WeaponSkins[this.game.globalSkin]) || WeaponSkins.none;
    // Los brazos del jugador NO se tiñen: su paleta (manga/guante/piel) es
    // la del operador. Marcamos los materiales de brazo para excluirlos.
    const ARM_COLORS = new Set(['39445c', '9fb0d8', 'd9a066']);
    wrap.traverse((o) => {
      if (o.isMesh && o.material) {
        if (!o.userData._origMat) o.userData._origMat = Array.isArray(o.material) ? o.material[0] : o.material;
        if (o.userData._origMat && o.userData._origMat.color && ARM_COLORS.has(o.userData._origMat.color.getHexString())) return; // brazo
        const m = o.userData._origMat.clone();
        if (skin.accent !== null && skin.accent !== undefined) {
          m.color = new THREE.Color(skin.accent);
        }
        o.material = m;
      }
    });
  }

  getAmmoText() {
    return `${this.ammoInMag}/${this.reserveAmmo}`;
  }

  // URL del GLB fuente de un arma (iconos de tienda). Fallback: null → glifo.
  _iconSourceUrl(key) {
    return WEAPON_MODELS[key] || null;
  }
}
