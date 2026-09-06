import * as THREE from '../lib/three.module.js';
import { GLTFLoader } from '../lib/GLTFLoader.js';

// ── AssetRegistry — DUEÑO ÚNICO de la carga de assets GLB ──
// Precarga, cache, clonación y FALLBACKS: si un GLB no carga (offline/APK
// vieja), los consumidores reciben null y montan su fallback blocky — el
// juego NUNCA se rompe por un asset (misma filosofía que AvatarLib).
// Los materiales se clonan por instancia cuando el consumidor los tiñe.

class AssetRegistry {
  constructor() {
    this._loader = new GLTFLoader();
    this._rawCache = new Map(); // url -> Promise<GLTF|null> (escena + clips)
    this.failed = new Set();
  }

  // ── Carga y cachea el GLTF COMPLETO (escena + animaciones) ──
  // DUEÑO ÚNICO de GLTFLoader (regla §7): AvatarLib, WeaponIcons y cualquier
  // consumidor futuro pasan por aquí — UNA cache, UN registro de fallos, un
  // solo warning por asset roto. Nadie más instancia loaders.
  loadRaw(url) {
    if (this._rawCache.has(url)) return this._rawCache.get(url);
    const p = new Promise((resolve) => {
      this._loader.load(url,
        (gltf) => resolve(gltf),
        undefined,
        (err) => { console.warn(`[Assets] ${url} no cargó:`, err && err.message || err); this.failed.add(url); resolve(null); }
      );
    });
    this._rawCache.set(url, p);
    return p;
  }

  // Template (escena sin clonar): NO añadir a escena jamás — clónalo.
  load(url) {
    return this.loadRaw(url).then((g) => (g ? g.scene : null));
  }

  // Instancia lista para escena. Devuelve null si el asset no está
  // disponible → el llamador usa fallback.
  async instantiate(url) {
    const gltf = await this.loadRaw(url);
    return gltf ? gltf.scene.clone(true) : null;
  }
}

export const assets = new AssetRegistry();

// ── Armas: mapa weaponKey → URL. La ruta normal carga GLB; el blocky queda
// como fallback técnico si el asset falla. Origen/licencia: CREDITS.md. ──
export const WEAPON_MODELS = {
  rifle:   'assets/models/weapons/rifle.glb',
  pistol:  'assets/models/weapons/pistol.glb',
  shotgun: 'assets/models/weapons/shotgun.glb',
  smg:     'assets/models/weapons/smg.glb',
};
