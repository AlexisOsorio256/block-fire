import * as THREE from '../lib/three.module.js';
import { AvatarLib, OPERATORS } from '../characters/SoldierAvatar.js';
import { LOBBY_WEAPON_MODELS } from '../core/AssetRegistry.js';

// ── Lobby — ESTUDIO DE PERSONAJE, no "mapa detrás del panel": pedestal +
// héroe GLB + bóveda de estudio + 3 luces de retrato. Dueña exclusiva de la
// puesta en escena del lobby. El ESTADO (globalSkin, skinsFor) vive en Game;
// Lobby pinta y delega las decisiones hacia arriba. El GLB llena el héroe al
// cargar (fallback: pedestal vacío, nunca un crash).

// El héroe vive a la DERECHA de la pantalla (la UI ocupa la columna
// izquierda): el pedestal se apoya en el mundo (2.6, 0, 5.2) y TODA la
// composición sale de esa referencia.
const STAGE_X = 2.6, STAGE_Z = 5.2;

// El ESTUDIO es un interior propio: vive DEBAJO del mapa (y=-100) para que
// NINGUNA geometría de la arena (arco de acceso en z=7.6, casa central,
// coberturas) cruce la línea cámara→héroe. Auditoría visual: el pilar de
// óxido del arco del mapa ocultaba ~85% del héroe — la sonda numérica
// (?capture=probe) identificó el ocluidor exacto. La cámara y las luces del
// set viajan con el grupo; el test 26 protege el contrato con un raycast.
const LOBBY_Y = -100;

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
    this.group.position.set(STAGE_X, LOBBY_Y, STAGE_Z);
    this.g.scene.add(this.group);
    this.hero = null;
    this.gun = null;
    this.ringMat = null;
    this.heroVisible = true;
    this._buildSet();
    this.renderOperators();
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
    // fondo, centrado sobre el héroe → fondo con gradiente propio y contraste
    // de silueta (el héroe DUNE es cálido: la bóveda fría lo recorta).
    const glow = new THREE.Mesh(
      new THREE.CircleGeometry(4.8, 48, Math.PI, Math.PI),
      new THREE.MeshBasicMaterial({ color: 0x9fbfff, transparent: true, opacity: 0.45 })
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
    // Derecha de FONDO: antes estas columnas quedaban delante de la lente
    // del retrato en pantallas anchas y tapaban al héroe con polígonos negros.
    // Conservan profundidad, pero nunca ocupan el pasillo cámara→operador.
    mkCol(1.6, 8.5, 1.2, 5.6, 4.2, -3.4, 0.45);
    // Extremo derecho, también detrás del plano del héroe.
    mkCol(2.8, 11, 1.8, 9.4, 5.4, -4.8, 0.2);
    // Izquierda lejana (tras el plano de la UI, apenas asoma)
    mkCol(1.8, 7, 1.3, -7.2, 3.4, 1.2, -0.35);

    // ── ILUMINACIÓN DE ESTUDIO (apagable al entrar en partida) ──
    // Key cálida (spot) + rim frío + punto de bóveda. Posiciones FIJAS del
    // set (no dependen del GLB: en el constructor el héroe aún no existe).
    // El sol de la arena (dir 1.35 + hemi 1.15) lava el estudio: la key y el
    // rim compiten y ganan para vender volumen de retrato.
    this.keyLight = new THREE.SpotLight(0xffd9a0, 380, 30, 0.62, 0.55, 1.8);
    this.keyLight.position.set(3.4, 5.6, 7.6);
    // Target LOCAL al grupo (el grupo vive en (STAGE_X, LOBBY_Y, STAGE_Z)):
    // apunta al pecho del héroe en coordenadas del set.
    this.keyLight.target.position.set(0, 1.1, 0);
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
    this.rimLight.target.position.set(0, 1.2, 0); // local al grupo: al héroe
    group.add(this.rimLight, this.rimLight.target);
  }

  // Héroe del lobby: soldado GLB con arma, idle, giro suave.
  // Encuadre POR Box3 REAL (invariantes numéricos antes que capturas): se
  // mide el modelo montado, se alinean los pies al pedestal y se derivan las
  // métricas que consume applyCameraPose(). Nada de números a ojo.
  buildHero(operator = this.g.heroOperator ?? 3) {
    if (this.hero && this.hero.root) this.group.remove(this.hero.root);
    this.hero = null;
    this.gun = null;
    // Fallback inmediato para que el héroe NUNCA aparezca desarmado…
    const gun = AvatarLib.makeHeldWeapon('rifle', 0xffd23f);
    const op = Math.max(0, Math.min(OPERATORS.length - 1, Number(operator) || 0));
    this.operatorIndex = op;
    // La paleta y la pieza de equipo pertenecen al operador, no al bando:
    // el lobby muestra la diferencia real que luego se ve en la partida.
    const av = AvatarLib.create({ team: 'hero', weapon: gun, operator: op });
    if (!av) { console.error('[Lobby] avatar no creado'); return; }
    this.hero = av;
    this.gun = gun;
    this._poseHeroGun(av);
    // …y ARMA GLB REAL en el mismo pivote en cuanto AssetRegistry la traiga:
    // el escaparate más importante del juego no exhibe el arma fallback.
    if (av.gunPivot) {
      AvatarLib.makeHeldWeaponGlb('rifle', LOBBY_WEAPON_MODELS.rifle).then((glb) => {
        if (!glb || !this.hero || this.hero !== av || !av.gunPivot) return;
        const pivot = av.gunPivot;
        while (pivot.children.length) pivot.remove(pivot.children[0]);
        // La variante de exhibición es algo más larga y deja leer cañón,
        // cuerpo y cargador sin confundirse con una pistola cuadrada.
        glb.scale.multiplyScalar(1.28);
        pivot.add(glb);
        this.gun = glb;
        // El restyle de legibilidad vive AQUÍ (no en create): el swap async
        // trae los materiales PBR OSCUROS de fábrica — medidos en (30,32,53)
        // bajo la key del estudio, idénticos al muro (29,31,51): invisible.
        this._restyleHeroGun(glb);
        // El GLB tiene su propio giro de normalización; recalcular la pose
        // después del swap mantiene el cañón apuntando al mismo low-ready que
        // el fallback y evita que el arma quede invertida al terminar la carga.
        this._poseHeroGun(av);
        this.paintHeroGun(); // skin global elegida manda sobre el restyle
      });
    }
    av.root.scale.setScalar(1.22); // presencia: el héroe debe lucir en el estudio
    av.setGrounded();
    av.root.position.set(0, PED_TOP, 0);
    // El frente nativo del GLB es −Z (visor medido a −0.19u del hueso de la
    // cabeza: ?capture=probe). create() lo voltea con rotation.y=π. La cámara
    // orbita el set a azimuth +0.27 rad: el giro del héroe debe SUMAR hacia la
    // cámara (π+0.32), no restar — con π−0.28 quedaba a 34° de la lente y la
    // auditoría visual lo leía "de perfil estricto".
    av.root.rotation.y = Math.PI + 0.32;
    this.group.add(av.root);
    // ── Encuadre por Box3: pies al pedestal + métricas para la cámara ──
    // El Box3 se mide TRAS el primer update de animación (la pose TPose del
    // GLB mide más que el idle); update() funde pesos y asienta la pose.
    av.update(0.05);
    this.group.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(av.root);
    const heroH = Math.max(0.1, box.max.y - box.min.y);
    // Pies al pedestal: corrección en espacio LOCAL del set. El Box3 es
    // world-space y el grupo vive en LOBBY_Y (bajo el mapa): restar su Y
    // evita el bucle que devolvía al héroe a la arena (bug de la auditoría).
    const localMinY = box.min.y - this.group.position.y;
    av.root.position.y += PED_TOP - localMinY;
    this.group.updateMatrixWorld(true);
    this._heroBox = new THREE.Box3().setFromObject(av.root); // YA asentado
    this._heroHomeY = av.root.position.y; // Y de origen para hide/show limpio
    this._heroHeight = this._heroBox.max.y - this._heroBox.min.y;
    this._heroChest = (this._heroBox.min.y + this._heroBox.max.y) / 2 + heroH * 0.12;
    this._heroHalfW = Math.max(0.65, Math.min(0.95, heroH * 0.30)); // hombros+arma
    this.paintHeroGun(); // skin global del lobby también en su arma
  }

  setOperator(operator) {
    const next = Math.max(0, Math.min(OPERATORS.length - 1, Number(operator) || 0));
    if (next === this.operatorIndex && this.hero) return;
    this.g.heroOperator = next;
    this.buildHero(next);
    this.renderOperators();
  }

  // ── LEGIBILIDAD DEL ARMA DEL HÉROE (medido, no estético) ──
  // El atlas original del asset es correcto para el icono/viewmodel, pero en
  // el set cálido del lobby convertía el rifle en un bloque blanco-violeta.
  // La presentación usa materiales de estudio por PIEZA: acero azul oscuro
  // para que la silueta tenga volumen y naranja solo en el cargador/identidad.
  // La geometría GLB, la mano y el arma de gameplay siguen siendo las mismas.
  // SOLO HÉROE: los bots combaten bajo sol de arena (raster distinto).
  _restyleHeroGun(gun) {
    if (!gun) return;
    const steel = new THREE.MeshStandardMaterial({
      color: 0x50647d, roughness: 0.42, metalness: 0.28,
      emissive: 0x0b1422, emissiveIntensity: 0.08,
    });
    const accent = new THREE.MeshStandardMaterial({
      color: 0xffa21f, roughness: 0.34, metalness: 0.18,
      emissive: 0x5a2c00, emissiveIntensity: 0.42,
    });
    gun.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = true;
      o.receiveShadow = true;
      const isMagazine = /magazine|mag|clip/i.test(o.name || '');
      // GLB materials can carry an emissive channel for their atlas. Only the
      // named accent piece participates in lobby weapon skins; otherwise the
      // Oro/Bosque/etc. swatch would repaint the entire rifle body.
      o.userData._heroSkinAccent = isMagazine;
      // En el lobby se elimina el atlas porque su paleta clara aplana el
      // rifle contra la luz de estudio; la malla y sus normales siguen dando
      // los paneles/volumen del GLB y la identidad vuelve por el cargador.
      o.material = Array.isArray(o.material)
        ? o.material.map(() => isMagazine ? accent : steel)
        : (isMagazine ? accent : steel);
    });
  }

  // POSE DE PRESENTACIÓN DEL ARMA: en idle el brazo derecho cuelga y el
  // cañón queda vertical pegado a la pierna (auditoría visual: "objeto oscuro
  // ilegible en la cadera"). Se gira el pivote de la mano UNA vez, en espacio
  // local del hueso, para que el cañón apunte al FRENTE del personaje
  // (low-ready de estudio). El idle anima el hueso; la corrección local
  // persiste. Determinista: se verifica con ?capture=probe (barrel dot).
  _poseHeroGun(av, camera) {
    if (!av || !av.gunPivot) return;
    const pivot = av.gunPivot;
    av.root.updateMatrixWorld(true);
    // ORIENTACIÓN RESPECTO A LA CÁMARA (juez visual, 3 iteraciones): lo que
    // importa no es el frente del héroe sino el RAYO de cámara. Si el cañón
    // apunta cerca de ese rayo (dot ±0.9), el rifle se escorza a un bloque
    // de 30px. Objetivo: eje largo del arma PERPENDICULAR al rayo (dot≈0),
    // cruzando la pantalla — su longitud 0.8u se proyecta completa — con
    // 15° de caída de cañón (low-ready legible).
    const cam = camera || this.g.camera;
    // BASE DE MUNDO de la cámara LEÍDA DE SU MATRIZ (columnas de
    // matrixWorld): X = derecha de pantalla, −Z = hacia la cámara.
    // El cálculo anterior derivaba "derecha de pantalla" de
    // (cam.position − pivot), ignorando el yaw real de la cámara — y la
    // sonda instrumentada midió que al render el arma quedaba VERTICAL
    // (caja 0.23×0.6×0.6: 25×79px pegados a la pierna, no 79×20 cruzando
    // el encuadre). La posición de la cámara la fija applyCameraPose
    // DESPUÉS de buildHero; con la matriz viva no hay orden que rompa.
    cam.updateMatrixWorld();
    const ce = cam.matrixWorld.elements;
    const screenRight = new THREE.Vector3(ce[0], ce[1], ce[2]).setY(0);
    if (screenRight.lengthSq() < 1e-6) screenRight.set(1, 0, 0);
    screenRight.normalize();
    const toCam = new THREE.Vector3(-ce[8], 0, -ce[10]);
    if (toCam.lengthSq() < 1e-6) toCam.set(0, 0, 1);
    toCam.normalize();
    // 97% perpendicular al rayo + 24% hacia la cámara: el cañón cruza el
    // encuadre y su punta queda apenas delante (dot a cámara ≈ 0.24).
    const target = screenRight.multiplyScalar(0.83).addScaledVector(toCam, 0.56).normalize();
    // El pivote describe la mano, no necesariamente el cañón: los GLB reales
    // llevan un nodo hijo con la corrección de importación. Medir ese nodo
    // evita orientar el arma usando la culata como si fuera la boca.
    const held = pivot.children[0];
    const barrelNode = held && held.userData.isGlb && held.children[0] ? held.children[0] : pivot;
    const cur = barrelNode.getWorldDirection(new THREE.Vector3()).negate().setY(0);
    if (cur.lengthSq() < 1e-6) return;
    cur.normalize();
    // Corrección mundial cur→target, PERSISTIDA como "rest" del pivote: el
    // anclaje por frame (SoldierAvatar.update) recompone ancla·rest cada
    // frame — un bake en pivot.quaternion moriría en el siguiente update()
    // (bug medido con la sonda: pose descartada). El ancla (mano) tiene su
    // PROPIA rotación: conjugamos la corrección al marco del ancla para que
    // el resultado MUNDIAL sea exactamente cur→target (premultiplicar en
    // local dejaba dot 0.665 vs objetivo 0.24: sonda).
    av.root.updateMatrixWorld(true);
    const rest = pivot.userData.rest || (pivot.userData.rest = { quat: new THREE.Quaternion() });
    const rootWQ = av.root.getWorldQuaternion(new THREE.Quaternion());
    const pivotWQ = pivot.getWorldQuaternion(new THREE.Quaternion());
    const anchorQ = rootWQ.clone().invert().multiply(pivotWQ).multiply(rest.quat.clone().invert());
    const qcorr = new THREE.Quaternion().setFromUnitVectors(cur, target);
    rest.quat.copy(anchorQ.clone().invert().multiply(qcorr).multiply(anchorQ).multiply(rest.quat));
    // CAÍDA del cañón (14°) + ROLL del arma sobre su eje largo: +28° deja el
    // CARGADOR (pieza emissive) mirando al lado de cámara (juez ronda 3) sin
    // escorzar el eje largo (caja X 0.97u: sonda).
    rest.quat.multiply(new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(1, 0, 0), THREE.MathUtils.degToRad(14)));
    rest.quat.multiply(new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(0, 0, 1), THREE.MathUtils.degToRad(40)));
    // OFFSET DE EXHIBICIÓN (persistente, marco local del root): saca el arma
    // DELANTE del plano del cuerpo — sin esto el antebrazo tapa media arma en
    // móvil ("medio oculta tras el torso", juez ronda 3). −Z local del root
    // (el héroe mira a cámara) + leve descenso: cuelga delante del muslo.
    // Bajo la mano derecha y ligeramente al frente: el cañón cruza el torso
    // en low-ready y la empuñadura queda visiblemente dentro de la mano.
    rest.pos = rest.pos || new THREE.Vector3(0.02, 0.12, -0.18);
    // Deja el pivote YA en ancla·rest (coherente sin esperar al próximo tick)
    pivot.quaternion.copy(anchorQ).multiply(rest.quat);
    pivot.position.add(rest.pos);
    pivot.updateMatrixWorld(true);
  }

  // El arma del héroe lleva la skin global elegida (las skins "ni se veían").
  // SKIN ESTÁNDAR (accent null): restaurar el material ORIGINAL — sin este
  // cache, `new THREE.Color(null)` nacía BLANCO y destruía la paleta del arma.
  paintHeroGun() {
    if (!this.gun || !this.g.skinsFor) return;
    const sk = this.g.skinsFor[this.g.globalSkin];
    if (!sk) return;
    this.gun.traverse((o) => {
      if (o.isMesh) {
        (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => {
          if (!m.emissive || m.emissiveIntensity < 0.2) return;
          if (this.gun.userData && this.gun.userData.isGlb && !o.userData._heroSkinAccent) return;
          if (!o.userData._origGun) o.userData._origGun = { color: m.color.getHex(), emissive: m.emissive.getHex() };
          const orig = o.userData._origGun;
          if (sk.accent !== null && sk.accent !== undefined) {
            const accent = new THREE.Color(sk.accent);
            m.color.copy(accent); m.emissive.copy(accent);
          } else {
            m.color.setHex(orig.color); m.emissive.setHex(orig.emissive);
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

  renderOperators() {
    const wrap = document.getElementById('lobby-operators');
    if (!wrap) return;
    const hex = (value) => `#${Number(value).toString(16).padStart(6, '0')}`;
    wrap.replaceChildren();
    OPERATORS.slice(0, 5).forEach((op, index) => {
      const b = document.createElement('button');
      b.className = 'lobby-operator' + (index === (this.operatorIndex ?? this.g.heroOperator) ? ' on' : '');
      b.dataset.operator = String(index);
      b.setAttribute('aria-label', `${op.name}, ${op.role}`);
      b.innerHTML = `<span class="op-emblem" style="--op-body:${hex(op.body)};--op-gear:${hex(op.gear)};--op-visor:${hex(op.visor)}"><i></i><b></b></span><strong>${op.name}</strong><small>${op.role}</small>`;
      b.addEventListener('click', () => this.g.setHeroOperator(index));
      wrap.appendChild(b);
    });
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
    // TODO el cálculo vive en espacio LOCAL del set: el Box3 es world-space y
    // el grupo vive en LOBBY_Y — restarlo aquí evita apuntar la cámara 100u
    // por debajo del héroe (dobla el offset y explota el encuadre).
    // PROTAGONISMO POR NÚMERO: el héroe medido en PÍXELES debe ocupar ~72%
    // de la altura de pantalla (rango de producto 65–80%). El Box3 tiene
    // profundidad (arma/ability asoman hacia cámara): la proyección de SUS
    // 8 esquinas infla el encuadre ~1.2× respecto al cuerpo — el objetivo
    // nominal se compensa (0.72/1.2) para que lo MEDIDO caiga en rango.
    const boxTop = (this._heroBox ? this._heroBox.max.y : 2.1) - LOBBY_Y;
    const boxBot = (this._heroBox ? this._heroBox.min.y : 0.0) - LOBBY_Y;
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
    // bóveda visible sobre la cabeza. (LOBBY_Y: el estudio vive bajo el mapa.)
    const eyeY = Math.max(1.15, midY * 0.96);
    // Órbita FIJA (no temporal): casi frontal con yaw suave → volumen 3D y
    // composición ESTABLE entre capturas y aspectos.
    const yaw = 0.26; // rad ~15°
    camera.position.set(
      STAGE_X + Math.sin(yaw) * dist,
      LOBBY_Y + eyeY,
      STAGE_Z + Math.cos(yaw) * dist
    );

    // Punto de mira: el CENTRO del Box3 del héroe (márgenes verticales
    // simétricos por construcción), desplazado al tercio derecho en PANTALLA
    // (empujar el lookAt hacia la izquierda del héroe).
    const shift = this._lookShiftWorld(dist, aspect);
    camera.lookAt(STAGE_X - shift, LOBBY_Y + midY, STAGE_Z);
  }

  // Desplazamiento lateral (en mundo) del punto de mira para componer el
  // héroe en el tercio derecho: proporción del ancho VISIBLE a la distancia
  // de cámara (tan de half-hfov * dist) — no un número fijo a ojo.
  _lookShiftWorld(dist, aspect) {
    const vFov = THREE.MathUtils.degToRad(LOBBY_FOV);
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect);
    const halfWView = Math.tan(hFov / 2) * dist; // semiancho visible en el plano del héroe
    // 32% deja al operador en el tercio derecho sin arrinconarlo tras los
    // elementos de ambientación del borde. La columna izquierda de UI sigue
    // libre y el héroe conserva aire a ambos lados en 16:9 y móvil horizontal.
    return halfWView * 0.32;
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
      // Vaivén sutil alrededor de una pose frontal a cámara (ver buildHero).
      // MANTÉN la pose del arma (rest) horizontal: el vaivén del cuerpo NO
      // debe escorzar el rifle (dot cámara medía 0.24→0.67 con el vaivén).
      // La corrección mundial es la misma que hizo _poseHeroGun.
      this.hero.root.rotation.y = Math.PI + 0.32 + Math.sin(t * 0.35) * 0.2;
      if (this.hero.gunPivot) {
        const pivot = this.hero.gunPivot;
        const rest = pivot.userData.rest;
        if (rest) {
          pivot.parent.updateMatrixWorld(true);
          // Mantenimiento EN LAZO CERRADO solo de la DIRECCIÓN del cañón
          // (invariante al vaivén): dq corrige cur→want sobre un eje
          // perpendicular al cañón, así que PRESERVA el roll del rest —
          // sin bucle cerrado el vaivén escorzaba el arma (dot 0.24→0.67).
          // El roll de presentación NO se toca aquí: multiplicarlo por
          // frame ACUMULABA giro sin límite (bug medido: silueta blob).
          const cam = this.g.camera;
          cam.updateMatrixWorld();
          const ce = cam.matrixWorld.elements;
          const toCamXZ = new THREE.Vector3(-ce[8], 0, -ce[10]).normalize();
          const rightXZ = new THREE.Vector3(ce[0], 0, ce[2]).normalize();
          const want = rightXZ.multiplyScalar(0.83).addScaledVector(toCamXZ, 0.56).normalize();
          want.applyAxisAngle(rightXZ, THREE.MathUtils.degToRad(-14)); // caída
          const cur = pivot.getWorldDirection(new THREE.Vector3()).negate();
          const dq = new THREE.Quaternion().setFromUnitVectors(cur, want);
          const wq = pivot.getWorldQuaternion(new THREE.Quaternion());
          rest.quat.premultiply(wq.clone().invert().multiply(dq).multiply(wq));
        }
      }
    }
    if (this.ringMat) this.ringMat.opacity = 0.4 + Math.sin(t * 2.2) * 0.15;
  }
}
