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
    this._cache = new Map();   // url -> Promise<Object3D|null> (template)
    this.failed = new Set();
  }

  // Carga y cachea el TEMPLATE (no añadir a escena jamás).
  load(url) {
    if (this._cache.has(url)) return this._cache.get(url);
    const p = new Promise((resolve) => {
      this._loader.load(url,
        (gltf) => resolve(gltf.scene),
        undefined,
        (err) => { console.warn(`[Assets] ${url} no cargó:`, err && err.message || err); this.failed.add(url); resolve(null); }
      );
    });
    this._cache.set(url, p);
    return p;
  }

  // Instancia lista para escena: clonado simple (armas no tienen esqueleto).
  // Devuelve null si el asset no está disponible → el llamador usa fallback.
  async instantiate(url) {
    const tpl = await this.load(url);
    return tpl ? tpl.clone(true) : null;
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
