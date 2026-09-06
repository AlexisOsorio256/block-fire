import * as THREE from '../lib/three.module.js';
import { AvatarLib } from '../characters/SoldierAvatar.js';

// ── Lobby — ESTUDIO DE PERSONAJE, no "mapa detrás del panel": pedestal +
// héroe GLB + bóveda de estudio + 3 luces de retrato. Dueña exclusiva de la
// puesta en escena del lobby. El ESTADO (globalSkin, skinsFor) vive en Game;
// Lobby pinta y delega las decisiones hacia arriba. El GLB llena el héroe al
// cargar (fallback: pedestal vacío, nunca un crash).

// El héroe vive a la DERECHA de la pantalla (la UI ocupa la columna
// izquierda): el pedestal se apoya en el mundo (2.6, 0, 5.2) y TODA la
// composición sale de esa referencia.
const STAGE_X = 2.6, STAGE_Z = 5.2;

// Radio del pedestal: el héroe (y su sombra) pisa una plataforma protagonista.
const PED_R = 2.05;

// Face superior del pedestal (y del recuadre de pies del héroe).
const PED_TOP = 0.36;

// FOV de retrato del lobby (teleobjetivo suave). Game lo restaura a su FOV
// de gameplay al entrar en partida (78).
const LOBBY_FOV = 34;

export class Lobby {
  constructor(game) {
    this.g = game;
    this.group = new THREE.Group();
    this.group.position.set(STAGE_X, 0, STAGE_Z);
    this.g.scene.add(this.group);
    this.hero = null;
    this.gun = null;
    this.ringMat = null;
    this.heroVisible = true;
    this._buildSet();
  }

  // ── SET DE ESTUDIO (profundidad propia: nada de arena de combate detrás) ──
  // Capas legibles: pedestal (foreground) → héroe (medio) → columnas/muro
  // (mid) → bóveda luminosa (background). Todo meshes estáticos baratos.
  _buildSet() {
    const group = this.group;

    // Piso del estudio (recibe la luz de la bóveda): azul noche profundo
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x141c30, roughness: 0.9, metalness: 0.1 });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(44, 44), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0.005; // apenas sobre el mapa (evita z-fight)
    floor.receiveShadow = true;
    group.add(floor);

    // Pedestal: base ancha + top superior, cara superior más clara
    const pedMat = new THREE.MeshStandardMaterial({ color: 0x1c2740, roughness: 0.55, metalness: 0.35 });
    const base = new THREE.Mesh(new THREE.CylinderGeometry(PED_R, PED_R * 1.14, 0.26, 36), pedMat);
    base.position.y = 0.13;
    base.castShadow = true;
    base.receiveShadow = true;
    group.add(base);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(PED_R * 0.88, PED_R * 0.88, 0.1, 36), pedMat);
    top.position.y = PED_TOP - 0.05;
    top.castShadow = true;
    top.receiveShadow = true;
    group.add(top);
    const topFace = new THREE.Mesh(
      new THREE.CircleGeometry(PED_R * 0.88, 36),
      new THREE.MeshStandardMaterial({ color: 0x26334f, roughness: 0.55, metalness: 0.2 })
    );
    topFace.rotation.x = -Math.PI / 2;
    topFace.position.y = PED_TOP + 0.001;
    topFace.receiveShadow = true;
    group.add(topFace);

    // DOBLE anillo de marca (dorado BLOCKFIRE): fino pulsante + trazo fijo
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(PED_R * 0.92, PED_R * 0.99, 48),
      new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.5, side: THREE.DoubleSide })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = PED_TOP + 0.01;
    group.add(ring);
    this.ringMat = ring.material;
    const ring2 = new THREE.Mesh(
      new THREE.RingGeometry(PED_R * 1.0, PED_R * 1.04, 48),
      new THREE.MeshBasicMaterial({ color: 0xffb400, transparent: true, opacity: 0.22, side: THREE.DoubleSide })
    );
    ring2.rotation.x = -Math.PI / 2;
    ring2.position.y = PED_TOP + 0.01;
    group.add(ring2);

    // BACKDROP: muro lejano (azul noche) que cierra el encuadre. Sin cielo ni
    // arena: el lobby es un interior propio.
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x111a30, roughness: 0.95, metalness: 0.05 });
    const backWall = new THREE.Mesh(new THREE.PlaneGeometry(46, 16), wallMat);
    backWall.position.set(0, 7, -7);
    backWall.receiveShadow = true;
    group.add(backWall);

    // Franjas de marca doradas en la pared (identidad, tenue, asimétricas)
    const brand = new THREE.Mesh(
      new THREE.PlaneGeometry(13, 0.32),
      new THREE.MeshBasicMaterial({ color: 0xffb400, transparent: true, opacity: 0.28 })
    );
    brand.position.set(1.6, 4.5, -6.9);
    group.add(brand);
    const brand2 = new THREE.Mesh(
      new THREE.PlaneGeometry(8, 0.18),
      new THREE.MeshBasicMaterial({ color: 0xffb400, transparent: true, opacity: 0.16 })
    );
    brand2.position.set(-4.6, 2.9, -6.9);
    group.add(brand2);

    // BÓVEDA DE LUZ (background): semicírculo emisivo sobre la pared del
    // fondo, centrado sobre el héroe → fondo con gradiente propio.
    const glow = new THREE.Mesh(
      new THREE.CircleGeometry(4.8, 48, Math.PI, Math.PI),
      new THREE.MeshBasicMaterial({ color: 0x9fbfff, transparent: true, opacity: 0.3 })
    );
    glow.position.set(STAGE_X - 1.2, 1.2, -6.85);
    group.add(glow);

    // ── Columnas (foreground/mid): profundidad por capas ──
    const colMat = new THREE.MeshStandardMaterial({ color: 0x18233c, roughness: 0.7, metalness: 0.3 });
    const mkCol = (w, h, d, x, y, z, rotY) => {
      const c = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), colMat);
      c.position.set(x, y, z);
      c.rotation.y = rotY;
      c.castShadow = true;
      c.receiveShadow = true;
      group.add(c);
      return c;
    };
    // Derecha-cerca del héroe (borde del encuadre, pantalla)
    mkCol(1.6, 8.5, 1.2, 5.6, 4.2, 3.4, 0.45);
    // Extremo derecho, aún más cerca de cámara (dolly de encuadre)
    mkCol(2.8, 11, 1.8, 9.4, 5.4, 6.2, 0.2);
    // Izquierda lejana (tras el plano de la UI, apenas asoma)
    mkCol(1.8, 7, 1.3, -7.2, 3.4, 1.2, -0.35);

    // ── ILUMINACIÓN DE ESTUDIO (apagable al entrar en partida) ──
    // Key cálida (spot) + rim frío + punto de bóveda. Posiciones FIJAS del
    // set (no dependen del GLB: en el constructor el héroe aún no existe).
    // El sol de la arena (dir 1.35 + hemi 1.15) lava el estudio: la key y el
    // rim compiten y ganan para vender volumen de retrato.
    this.keyLight = new THREE.SpotLight(0xffd9a0, 380, 30, 0.62, 0.55, 1.8);
    this.keyLight.position.set(3.4, 5.6, 7.6);
    this.keyLight.target.position.set(STAGE_X, 1.1, STAGE_Z);
    this.keyLight.castShadow = true;
    this.keyLight.shadow.mapSize.set(1024, 1024);
    this.keyLight.shadow.bias = -0.0005;
    group.add(this.keyLight, this.keyLight.target);

    // Punto de bóveda frío (contra de la key): modela la pared del fondo
    this.vaultLight = new THREE.PointLight(0x4d7dff, 110, 28, 1.9);
    this.vaultLight.position.set(1.4, 7.2, -2.8);
    group.add(this.vaultLight);

    // Rim frío desde atrás-izquierda: recorta la silueta del héroe
    this.rimLight = new THREE.DirectionalLight(0x6aa8ff, 2.2);
    this.rimLight.position.set(-4.5, 4, 1);
    this.rimLight.target.position.set(STAGE_X, 1.2, STAGE_Z);
    group.add(this.rimLight, this.rimLight.target);
  }

  // Héroe del lobby: soldado GLB con arma, idle, giro suave.
  // Encuadre POR Box3 REAL (invariantes numéricos antes que capturas): se
  // mide el modelo montado, se alinean los pies al pedestal y se derivan las
  // métricas que consume applyCameraPose(). Nada de números a ojo.
  buildHero() {
    const gun = AvatarLib.makeHeldWeapon('rifle', 0xffd23f);
    // Operador 3 = DUNE (paleta desierto/oro): el héroe comparte la paleta
    // dorada de la marca; sin tinte de equipo (no hay bando en el lobby).
    const av = AvatarLib.create({ team: 'hero', weapon: gun, operator: 3 });
    if (!av) { console.error('[Lobby] avatar no creado'); return; }
    this.hero = av;
    this.gun = gun;
    av.root.scale.setScalar(1.22); // presencia: el héroe debe lucir en el estudio
    av.root.position.set(0, PED_TOP, 0);
    av.root.rotation.y = Math.PI - 0.28; // de frente a cámara con un giro suave
    this.group.add(av.root);
    // ── Encuadre por Box3: pies al pedestal + métricas para la cámara ──
    // El Box3 se mide TRAS el primer update de animación (la pose TPose del
    // GLB mide más que el idle); update() funde pesos y asienta la pose.
    av.update(0.05);
    this.group.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(av.root);
    const heroH = Math.max(0.1, box.max.y - box.min.y);
    // Pies al pedestal: el minY real del modelo baja a la cara superior
    av.root.position.y += PED_TOP - box.min.y;
    this.group.updateMatrixWorld(true);
    this._heroBox = new THREE.Box3().setFromObject(av.root); // YA asentado
    this._heroHomeY = av.root.position.y; // Y de origen para hide/show limpio
    this._heroHeight = this._heroBox.max.y - this._heroBox.min.y;
    this._heroChest = (this._heroBox.min.y + this._heroBox.max.y) / 2 + heroH * 0.12;
    this._heroHalfW = Math.max(0.65, Math.min(0.95, heroH * 0.30)); // hombros+arma
    this.paintHeroGun(); // skin global del lobby también en su arma
  }

  // El arma del héroe lleva la skin global elegida (las skins "ni se veían").
  paintHeroGun() {
    if (!this.gun || !this.g.skinsFor) return;
    const sk = this.g.skinsFor[this.g.globalSkin];
    if (!sk) return;
    const accent = new THREE.Color(sk.accent);
    this.gun.traverse((o) => {
      if (o.isMesh) {
        (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => {
          if (m.emissive && m.emissiveIntensity >= 0.2) {
            m.color.copy(accent); m.emissive.copy(accent);
          }
        });
      }
    });
  }

  // Chips de skins del lobby (se construyen al cargar WeaponSkins).
  renderSkins() {
    const g = this.g;
    const wrap = document.getElementById('lobby-skins');
    if (!wrap || !g.skinsFor) return;
    wrap.innerHTML = '';
    for (const key of Object.keys(g.skinsFor)) {
      const b = document.createElement('button');
      b.className = 'lobby-skin' + (key === g.globalSkin ? ' on' : '');
      b.dataset.skin = key;
      b.innerHTML = `<span class="ls-swatch" data-skin="${key}"></span><b>${g.skinsFor[key].name}</b>`;
      b.addEventListener('click', () => g.setGlobalSkin(key));
      wrap.appendChild(b);
    }
  }

  // El estudio es decorado del lobby: en partida se oculta TODO (grupo +
  // luces del set) para no contaminar la arena ("noveno soldado dorado").
  // El héroe viaja a un almacén fuera del mapa: sus métricas Box3 (y el test
  // de encuadre) siguen pudiendo medirlo sin pintarlo en la arena.
  setVisible(v) {
    this.group.visible = v;
    this.heroVisible = v;
    if (this.keyLight) this.keyLight.visible = v;
    if (this.vaultLight) this.vaultLight.visible = v;
    if (this.rimLight) this.rimLight.visible = v;
    if (this.hero) {
      this.hero.root.visible = v;
      // Almacén bajo el mapa al ocultar; Y de origen (pies en pedestal) al volver
      if (!v) this.hero.root.position.set(0, -60, 0);
      else if (this._heroHomeY !== undefined) this.hero.root.position.set(0, this._heroHomeY, 0);
    }
  }

  // ── POSE DE CÁMARA POR INVARIANTES (única verdad del encuadre) ──
  // Insumos: Box3 REAL del héroe (medido al construirlo, no a ojo) + aspecto
  // y FOV propios. Salida: posición/lookAt/FOV/aspect EXACTOS para que el
  // héroe quede COMPLETO (con margen) y protagonista.
  //
  // Geometría: triángulo de encuadre —
  //   distV = semialtura_a_cubrir / tan(fovY/2)
  //   distW = semiancho_a_cubrir / tan(fovX/2)
  //   dist  = max(ambas) * aire extra
  // La mira se desplaza LATERALMENTE en mundo (proporcional al ancho visible)
  // para componer el héroe en el tercio derecho: la UI respira a la izquierda
  // sin taparlo nunca.
  applyCameraPose(camera) {
    const aspect = camera.aspect || (window.innerWidth / Math.max(1, window.innerHeight));
    camera.fov = LOBBY_FOV;
    camera.aspect = aspect;
    camera.updateProjectionMatrix();

    // Ventana vertical a encuadrar: del suelo bajo el pedestal a holgura
    // sobre la cabeza (medida por Box3 real; fallback generoso sin héroe).
    // PROTAGONISMO POR NÚMERO: el héroe medido en PÍXELES debe ocupar ~72%
    // de la altura de pantalla (rango de producto 65–80%). El Box3 tiene
    // profundidad (arma/ability asoman hacia cámara): la proyección de SUS
    // 8 esquinas infla el encuadre ~1.2× respecto al cuerpo — el objetivo
    // nominal se compensa (0.72/1.2) para que lo MEDIDO caiga en rango.
    const boxTop = this._heroBox ? this._heroBox.max.y : 2.1;
    const boxBot = this._heroBox ? this._heroBox.min.y : 0.0;
    const FILL_TARGET = 0.60; // nominal → ~0.72 medido (parallax de Box3)
    const heroH = Math.max(0.1, boxTop - boxBot);
    const screenH = heroH / FILL_TARGET; // alto de mundo visible objetivo
    const midY = (boxTop + boxBot) / 2;  // centro de mira = centro del héroe
    const halfH = screenH / 2;

    // Semiancho a cubrir: pedestal + márgenes (el héroe cabe de sobra)
    const halfW = PED_R + 0.55;

    const vFov = THREE.MathUtils.degToRad(LOBBY_FOV);
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect);
    const dFitV = halfH / Math.tan(vFov / 2);
    const dFitH = halfW / Math.tan(hFov / 2);
    const dist = Math.max(dFitV, dFitH, 3.2) * 1.05; // aire extra 5%

    // Cámara casi a la altura del pecho: leve contrapicado heroico y la
    // bóveda visible sobre la cabeza.
    const eyeY = Math.max(1.15, midY * 0.96);
    // Órbita FIJA (no temporal): casi frontal con yaw suave → volumen 3D y
    // composición ESTABLE entre capturas y aspectos.
    const yaw = 0.26; // rad ~15°
    camera.position.set(
      STAGE_X + Math.sin(yaw) * dist,
      eyeY,
      STAGE_Z + Math.cos(yaw) * dist
    );

    // Punto de mira: el CENTRO del Box3 del héroe (márgenes verticales
    // simétricos por construcción), desplazado al tercio derecho en PANTALLA
    // (empujar el lookAt hacia la izquierda del héroe).
    const shift = this._lookShiftWorld(dist, aspect);
    camera.lookAt(STAGE_X - shift, midY, STAGE_Z);
  }

  // Desplazamiento lateral (en mundo) del punto de mira para componer el
  // héroe en el tercio derecho: proporción del ancho VISIBLE a la distancia
  // de cámara (tan de half-hfov * dist) — no un número fijo a ojo.
  _lookShiftWorld(dist, aspect) {
    const vFov = THREE.MathUtils.degToRad(LOBBY_FOV);
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect);
    const halfWView = Math.tan(hFov / 2) * dist; // semiancho visible en el plano del héroe
    return halfWView * 0.30; // héroe al ~72% del ancho de pantalla
  }

  // Métricas (para el test de encuadre y debug): Box3 del héroe en NDC con
  // la cámara dada. Héroe completo en pantalla ⇔ |NDC| < 1 en x e y.
  heroNdcBox(camera) {
    if (!this._heroBox) return null;
    const b = this._heroBox;
    const corners = [
      new THREE.Vector3(b.min.x, b.min.y, b.min.z), new THREE.Vector3(b.max.x, b.min.y, b.min.z),
      new THREE.Vector3(b.min.x, b.max.y, b.min.z), new THREE.Vector3(b.max.x, b.max.y, b.min.z),
      new THREE.Vector3(b.min.x, b.min.y, b.max.z), new THREE.Vector3(b.max.x, b.min.y, b.max.z),
      new THREE.Vector3(b.min.x, b.max.y, b.max.z), new THREE.Vector3(b.max.x, b.max.y, b.max.z),
    ];
    const ndc = corners.map(c => c.project(camera));
    const xs = ndc.map(v => v.x), ys = ndc.map(v => v.y);
    return {
      minX: Math.min(...xs), maxX: Math.max(...xs),
      minY: Math.min(...ys), maxY: Math.max(...ys),
    };
  }

  // Animación del lobby (desde Game.animate mientras matchState !== 'PLAYING').
  tick(dt, t) {
    if (this.hero && this.heroVisible) {
      this.hero.update(Math.min(dt, 0.033));
      // Vaivén sutil alrededor de una pose frontal con carácter (fija)
      this.hero.root.rotation.y = Math.PI - 0.28 + Math.sin(t * 0.35) * 0.2;
    }
    if (this.ringMat) this.ringMat.opacity = 0.4 + Math.sin(t * 2.2) * 0.15;
  }
}
