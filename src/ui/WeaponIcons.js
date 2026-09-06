import * as THREE from '../lib/three.module.js';
import { assets } from '../core/AssetRegistry.js';

// ── WeaponIcons — iconos de la tienda renderizados desde el GLB real ──
// Un render offscreen POR ARMA (no por frame): escena mínima, luz de tres
// puntos, cámara ortográfica en PERFIL LATERAL (elevación leve) y data-URL
// PNG transparente. El encuadre se calcula proyectando el Box3 real del arma
// al espacio de la cámara (fit exacto, sin márgenes arbitrarios). El arma
// SIEMPRE apunta a la derecha (eje largo Z → +X en pantalla) y el resultado
// se cachea en HUD._iconCache — coste único por partida, cero por frame.
// La carga pasa por AssetRegistry (dueño único de GLB, regla §7).
// Sin GLB (falloff de red) devuelve null: la tarjeta conserva el glifo ASCII.

const _cache = new Map(); // url → Promise<dataURL|null>

// Resolución interna 2x del tamaño CSS (64×40) para retina/nitidez.
const RENDER_W = 320, RENDER_H = 200;

// Dirección de cámara PERFIL + elevación ~19°: mira el eje más largo (Z en
// estos GLB) de costado, la culata queda a la izquierda y el cañón a la
// derecha (arma "apunta a la derecha") con un pelín de vista superior.
const CAM_DIR = new THREE.Vector3(1, 0.35, 0).normalize();

export function renderWeaponIcon(url) {
  if (_cache.has(url)) return _cache.get(url);
  const p = assets.loadRaw(url).then((gltf) => {
    if (!gltf) return null;
    try {
      const obj = gltfSafeScene(gltf);
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
      renderer.setSize(RENDER_W, RENDER_H);
      renderer.setClearColor(0x000000, 0);
      const scene = new THREE.Scene();
      // Tres puntos: key cálida arriba-derecha, fill frío izquierda, rim trasero
      scene.add(new THREE.AmbientLight(0xffffff, 0.75));
      const key = new THREE.DirectionalLight(0xfff2d0, 2.2); key.position.set(2, 3, 4); scene.add(key);
      const fill = new THREE.DirectionalLight(0x8fb8ff, 1.1); fill.position.set(-3, 1, 2); scene.add(fill);
      const rim = new THREE.DirectionalLight(0xffffff, 1.4); rim.position.set(0, 2, -4); scene.add(rim);
      scene.add(obj);
      renderer.render(scene, fitCamera(obj, renderer));
      const dataUrl = renderer.domElement.toDataURL('image/png');
      renderer.dispose();
      return dataUrl;
    } catch (e) { console.warn('[WeaponIcons] render fail', e && e.message); return null; }
  });
  _cache.set(url, p);
  return p;
}

// Cámara ortográfica ajustada a la CAJA del arma, no a maxDim*constante:
// 1) coloca la cámara sobre CAM_DIR mirando al centro del Box3;
// 2) proyecta las 8 esquinas del box al espacio de cámara;
// 3) fija left/right/top/bottom al half-extent proyectado (×pad) y expande
//    al aspect del canvas (contain). El arma llena el cuadro sea cual sea su
//    tamaño o proporción.
function fitCamera(obj, renderer) {
  const aspect = RENDER_W / RENDER_H;
  const PAD = 1.06; // 3% de aire por borde
  const box = new THREE.Box3().setFromObject(obj);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const dist = Math.max(size.x, size.y, size.z) * 3 + 1; // orto: solo evita clipear
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, dist * 4);
  cam.position.copy(center).addScaledVector(CAM_DIR, dist);
  cam.up.set(0, 1, 0);
  cam.lookAt(center);
  cam.updateMatrixWorld(true);
  cam.matrixWorldInverse.copy(cam.matrixWorld).invert();
  // Half-extents de la caja proyectada en el plano de la cámara
  let maxU = 1e-4, maxV = 1e-4;
  const v = new THREE.Vector3();
  for (let i = 0; i < 8; i++) {
    v.set(i & 1 ? box.max.x : box.min.x,
          i & 2 ? box.max.y : box.min.y,
          i & 4 ? box.max.z : box.min.z)
      .applyMatrix4(cam.matrixWorldInverse);
    maxU = Math.max(maxU, Math.abs(v.x));
    maxV = Math.max(maxV, Math.abs(v.y));
  }
  let halfW = maxU * PAD, halfH = maxV * PAD;
  if (halfW / halfH > aspect) halfH = halfW / aspect; else halfW = halfH * aspect;
  cam.left = -halfW; cam.right = halfW; cam.top = halfH; cam.bottom = -halfH;
  cam.updateProjectionMatrix();
  return cam;
}

function gltfSafeScene(gltf) {
  const root = gltf.scene;
  root.updateMatrixWorld(true);
  return root;
}
