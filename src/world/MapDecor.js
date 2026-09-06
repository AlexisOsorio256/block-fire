import * as THREE from '../lib/three.module.js';
import { mergeGeometries } from '../lib/BufferGeometryUtils.js';

// ═══════════════════════════════════════════════════════════════════════════
// MapDecor — capa VISUAL del mapa, desacoplada de la COLISIÓN
// ═══════════════════════════════════════════════════════════════════════════
// Contrato de la slice (punto DÉCIMO del brief):
//   · Los colliders (map.boxes) NO se tocan: nada de lo que añade este
//     módulo entra en boxes → gameplay, navegación de bots (Navigation
//     rasteriza desde Map.checkCollision) y TTK intactos. Props sin collider.
//   · Presupuesto Android (reglas §7): geometrías cacheadas (cada primitiva
//     existe UNA vez), materiales compartidos por familia, pintura de suelo
//     FUSIONADA en 1 mesh por material (mergeGeometries), CERO luces y
//     sombras nuevas, CERO postproceso, sin texturas grandes (el único mapa
//     es un canvas 512x128 procedural para el rótulo BLOCKFIRE).
//   · Legibilidad: zoning por cuadrante (mercado cálido, taller frío...),
//     landmarks altos por lane (beacons de base ya existentes + contenedores
//     apilados E, grúa W, arcos y rótulo en el centro), personajes siempre
//     contrastados: los suelos fríos son CLAROS (concreto 0x8a97a5) y ningún
//     suelo usa el rojo de equipo enemigo (0xff5a4a) ni el verde aliado
//     (0x59d97c) como color dominante (paleta de SoldierAvatar.js).
// ═══════════════════════════════════════════════════════════════════════════

const COL = {
  wood:     0x9a6b3f,
  woodDark: 0x6e4a2a,
  metal:    0x5b6773,
  metalDk:  0x3a4450,
  rust:     0x8a4a30,
  teal:     0x2e7d78,
  cream:    0xe8dcc3,
  yellow:   0xf2c14e,
  red:      0xc44536,
  blueGray: 0x5b7185,
  concrete: 0x8a97a5,
  white:    0xf2efe6,
  green:    0x4a7c3f,
  orange:   0xe07b39,
  charcoal: 0x2a2f3a,
  skyBlue:  0x7db2d9,
};

export class MapDecor {
  constructor(map) {
    this.map = map;
    this.scene = map.scene;
    this.s = map.size;
    this.meshCount = 0;
    this._geo = new Map();     // key → geometría compartida
    this._mat = new Map();     // key → material compartido
    this._paints = new Map();  // material → geometrías de pintura de suelo
    this._bake = new Map();    // material → geometrías de props (horneado)

    this.matWhite  = this._std(COL.white, 0.9);
    this.matBlack  = this._std(COL.charcoal, 0.85);
    this.matMetal  = this._std(COL.metal, 0.55, 0.35);
    this.matMetalDk= this._std(COL.metalDk, 0.6, 0.3);
    this.matWood   = this._std(COL.wood, 0.85);
    this.matWoodDk = this._std(COL.woodDark, 0.85);
    this.matRust   = this._std(COL.rust, 0.8, 0.1);
    this.matTeal   = this._std(COL.teal, 0.8);
    this.matCream  = this._std(COL.cream, 0.9);
    this.matYellow = this._std(COL.yellow, 0.8);
    this.matRed    = this._std(COL.red, 0.8);
    this.matBlue   = this._std(COL.blueGray, 0.85);
    this.matConc   = this._std(COL.concrete, 0.9);
    this.matGreen  = this._std(COL.green, 0.9);
    this.matOrange = this._std(COL.orange, 0.8);
    this.matSky    = this._std(COL.skyBlue, 0.75);
  }

  // (helper para mantener la paleta en un solo lugar)
  woodDark() { return 0x6e4a2a; }

  _std(color, roughness = 0.85, metalness = 0.05) {
    const key = `s${color}_${roughness}_${metalness}`;
    if (!this._mat.has(key)) {
      this._mat.set(key, new THREE.MeshStandardMaterial({ color, roughness, metalness }));
    }
    return this._mat.get(key);
  }

  // Geometría cacheada: la misma primitiva se reutiliza en todos los props.
  _g(key, make) {
    if (!this._geo.has(key)) this._geo.set(key, make());
    return this._geo.get(key);
  }

  // ═══ HORNEADO: cada prop se acumula como geometría transformada por
  // material y `flush()` la fusiona en UN mesh por material. Android paga
  // ~17 draw calls por TODA la decoración (frente a ~300 meshes sueltos).
  // La sombra sigue: los meshes horneados llevan castShadow/receiveShadow.
  box(w, h, d, mat, x, y, z, ry = 0) {
    const g = new THREE.BoxGeometry(w, h, d);
    if (ry) g.rotateY(ry);
    g.translate(x, y, z);
    this._push(mat, g);
    this.meshCount++;
  }

  cyl(rt, rb, h, seg, mat, x, y, z) {
    const g = new THREE.CylinderGeometry(rt, rb, h, seg);
    g.translate(x, y, z);
    this._push(mat, g);
    this.meshCount++;
  }

  _push(mat, g) {
    let arr = this._bake.get(mat);
    if (!arr) { arr = []; this._bake.set(mat, arr); }
    arr.push(g);
  }

  // Fusiona TODO lo acumulado (props + pintura de suelo) en 1 mesh/material.
  flush() {
    // pintura de suelo (parches finos, receiveShadow, sin proyectar)
    for (const [mat, arr] of this._paints) {
      if (!arr.length) continue;
      const merged = arr.length === 1 ? arr[0] : mergeGeometries(arr);
      const m = new THREE.Mesh(merged, mat);
      m.receiveShadow = true;
      m.userData.deco = true;
      this.scene.add(m);
      if (arr.length > 1) for (const g of arr) g.dispose();
    }
    this._paints.clear();
    // props sólidos (cast+receive)
    for (const [mat, arr] of this._bake) {
      if (!arr.length) continue;
      const merged = arr.length === 1 ? arr[0] : mergeGeometries(arr);
      const m = new THREE.Mesh(merged, mat);
      m.castShadow = true;
      m.receiveShadow = true;
      m.userData.deco = true;
      this.scene.add(m);
      if (arr.length > 1) for (const g of arr) g.dispose();
    }
    this._bake.clear();
  }

  // ── Pintura de suelo: parches 0.03 (van al horneado de su material) ──
  _paint(w, d, x, z, mat) {
    const g = new THREE.BoxGeometry(w, 0.03, d);
    g.translate(x, 0.015, z);
    this._push(mat, g);
  }

  _flushPaint() {
    this.flush(); // compat: Map.js llama _flushPaint() al terminar
  }

  // Ajedrezado n×n (plaza central).
  _checker(w, d, x, z, matA, matB, n = 4) {
    const cw = w / n, cd = d / n;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        this._paint(cw, cd, x - w / 2 + cw * (i + 0.5), z - d / 2 + cd * (j + 0.5),
          (i + j) % 2 ? matB : matA);
      }
    }
  }

  // Franja de peligro amarilla/negra (bordes de zona y plataformas).
  _hazard(w, d, x, z, n = 4) {
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n - 0.5;
      if (w >= d) this._paint(w / n, d, x + t * w, z, i % 2 ? this.matBlack : this.matYellow);
      else this._paint(w, d / n, x, z + t * d, i % 2 ? this.matBlack : this.matYellow);
    }
  }

  // ═══════════════════ PROPS (decoración sin collider) ═══════════════════

  // Bidón industrial: cuerpo + aros + tapa.
  _drum(x, z, mat, ry = 0) {
    this.box(0.6, 0.92, 0.6, mat, x, 0.46, z, ry);
    this.box(0.64, 0.1, 0.64, this.matMetalDk, x, 0.2, z, ry);
    this.box(0.64, 0.1, 0.64, this.matMetalDk, x, 0.72, z, ry);
    this.cyl(0.1, 0.1, 0.08, 8, this.matMetalDk, x, 0.96, z);
  }

  // Pila de 2 neumáticos (torus acostado, va al horneado).
  _tires(x, z) {
    for (let i = 0; i < 2; i++) {
      const g = new THREE.TorusGeometry(0.42, 0.18, 8, 10);
      g.rotateX(Math.PI / 2);
      g.translate(x, 0.19 + i * 0.36, z);
      this._push(this.matBlack, g);
      this.meshCount++;
    }
  }

  // Aire acondicionado de azotea (y = altura del suelo donde apoya).
  _acUnit(x, y, z, ry = 0) {
    this.box(0.9, 0.7, 0.6, this.matMetal, x, y + 0.35, z, ry);
    this.box(0.92, 0.08, 0.62, this.matMetalDk, x, y + 0.5, z, ry);
    this.cyl(0.22, 0.22, 0.06, 10, this.matBlack, x, y + 0.73, z);
  }

  // Tubería vertical con brazo horizontal (ry: dirección del codo en XZ).
  _pipe(x, z, h, ry = 0) {
    this.cyl(0.09, 0.09, h, 6, this.matMetal, x, h / 2, z);
    const dx = Math.round(Math.cos(ry)), dz = -Math.round(Math.sin(ry));
    this.box(0.24, 0.24, 0.7, this.matMetalDk, x + dx * 0.35, h - 0.12, z + dz * 0.35, ry);
  }

  // Toldo a rayas: (x,z)=centro del tellado; dir=-1 cuelga hacia -z.
  _awning(x, z, mat, dir) {
    for (let i = 0; i < 4; i++) {
      this.box(0.75, 0.07, 0.9, i % 2 ? this.matWhite : mat, x - 1.125 + i * 0.75, 2.35, z);
    }
    this.box(3.0, 0.1, 0.12, this.matWoodDk, x, 2.3, z + dir * 0.45);
  }

  // Cornisa de remate para muros de 2.6 (el collider NO cambia: es adorno
  // pegado ARRIBA del muro, centrado en su cara). len a lo largo de X (ax=0)
  // o de Z (ax=1). Color por zona: cada base/lane se lee desde los spawns.
  _wallCap(x, y, z, len, ax, mat) {
    if (ax) this.box(0.5, 0.22, len, mat, x, y, z);
    else this.box(len, 0.22, 0.72, mat, x, y, z);
  }

  // Pilar de esquina (levantas la silueta de una casa esquinada).
  _cornerPost(x, z, h, mat) {
    this.box(0.34, h, 0.34, mat, x, h / 2, z);
    this.box(0.5, 0.16, 0.5, this.matWoodDk, x, h + 0.08, z);
  }

  // Ventana cartoon (marco blanco + cristal azul + alféizar).
  _window(x, y, z, ax = 0) {
    if (ax) {
      this.box(0.06, 0.9, 1.1, this.matSky, x, y, z);
      this.box(0.1, 1.06, 1.26, this.matWhite, x, y, z);
      this.box(0.16, 0.08, 1.3, this.matWoodDk, x, y - 0.57, z);
    } else {
      this.box(1.1, 0.9, 0.06, this.matSky, x, y, z);
      this.box(1.26, 1.06, 0.1, this.matWhite, x, y, z);
      this.box(1.3, 0.08, 0.16, this.matWoodDk, x, y - 0.57, z);
    }
  }

  // Rótulo BLOCKFIRE: tablero oscuro + canvas de texto procedural (512x128,
  // el único "map" de la slice — pequeño y generado, no un asset).
  _textMat(text, fg) {
    const key = `txt${text}${fg}`;
    if (!this._mat.has(key)) {
      const c = document.createElement('canvas');
      c.width = 512; c.height = 128;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#232833';
      ctx.fillRect(0, 0, 512, 128);
      ctx.fillStyle = fg;
      ctx.font = '900 84px Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, 256, 70);
      const tex = new THREE.CanvasTexture(c);
      tex.anisotropy = 4;
      this._mat.set(key, new THREE.MeshBasicMaterial({ map: tex }));
    }
    return this._mat.get(key);
  }

  // Cartel con texto: caras ±z (ry=0) o ±x (ry=±π/2); dos caras legibles.
  _sign(x, y, z, ry, w, h, text = 'BLOCKFIRE', twoSided = true) {
    const cos = Math.abs(Math.cos(ry)) > 0.5;
    if (cos) this.box(w, h, 0.14, this.matMetalDk, x, y, z);
    else this.box(0.14, h, w, this.matMetalDk, x, y, z);
    const tm = this._textMat(text, '#ffd23f');
    const plane = this._g(`pl${w}|${h}`, () => new THREE.PlaneGeometry(w - 0.12, h - 0.12));
    const mk = (fy) => {
      const m = new THREE.Mesh(plane, tm);
      m.position.set(cos ? x : x + fy * 0.08, y, cos ? z + fy * 0.08 : z);
      m.rotation.y = cos ? (fy > 0 ? 0 : Math.PI) : (fy > 0 ? Math.PI / 2 : -Math.PI / 2);
      m.userData.deco = true;
      this.scene.add(m);
      this.meshCount++;
    };
    mk(1);
    if (twoSided) mk(-1);
    // patas si flota por encima del suelo
    if (y - h / 2 > 0.35) {
      const lh = y - h / 2;
      const off = w / 2 - 0.25;
      if (cos) {
        this.box(0.08, lh, 0.08, this.matMetalDk, x - off, lh / 2, z);
        this.box(0.08, lh, 0.08, this.matMetalDk, x + off, lh / 2, z);
      } else {
        this.box(0.08, lh, 0.08, this.matMetalDk, x, lh / 2, z - off);
        this.box(0.08, lh, 0.08, this.matMetalDk, x, lh / 2, z + off);
      }
    }
  }

  // Señal STOP cartoon.
  _stopSign(x, z, ry = 0) {
    this.cyl(0.05, 0.05, 2.6, 6, this.matMetalDk, x, 1.3, z);
    this.cyl(0.52, 0.52, 0.1, 8, this.matRed, x, 2.6, z);
    this.box(0.74, 0.16, 0.05, this.matWhite,
      x + Math.cos(ry) * 0.28, 2.6, z + Math.sin(ry) * 0.28, ry);
  }

  // Farola de plaza (cabeza amarilla plana, sin luz real: presupuesto).
  _lampPost(x, z, dir = 1) {
    this.cyl(0.07, 0.1, 4.2, 6, this.matMetalDk, x, 2.1, z);
    this.box(1.1, 0.1, 0.1, this.matMetalDk, x + dir * 0.5, 4.15, z);
    this.box(0.5, 0.16, 0.34, this.matYellow, x + dir * 1.0, 4.05, z);
  }

  // Jardinera con 3 arbustos.
  _planter(x, z) {
    this.box(1.5, 0.5, 0.6, this.matWoodDk, x, 0.25, z);
    this.box(1.56, 0.08, 0.66, this.matRust, x, 0.52, z);
    for (const [ox, oz] of [[-0.4, 0], [0.1, 0.05], [0.5, -0.04]]) {
      const g = new THREE.SphereGeometry(0.38, 8, 6);
      g.translate(x + ox, 0.72, z + oz);
      this._push(this.matGreen, g);
      this.meshCount++;
    }
  }

  // Pila de cajas de mercado.
  _crateStack(x, z, ry = 0) {
    const c = (dx, dy, dz, m) => this.box(0.85, 0.55, 0.85, m, x + dx, 0.275 + dy * 0.55, z + dz, ry);
    c(0, 0, 0, this.matWood);
    c(0.1, 1, -0.08, this.matWoodDk);
    c(-0.08, 2, 0.05, this.matYellow);
  }

  // Contenedor 20' con nervios y puertas; y = altura de apilado.
  _container(x, z, mat, ry = 0, y = 0) {
    const w = 6, h = 2.6, d = 2.5;
    const cos = Math.abs(Math.cos(ry)) > 0.5;
    this.box(cos ? w : d, h, cos ? d : w, mat, x, y + h / 2, z);
    for (let i = -2; i <= 2; i++) {
      const t = i * 1.15;
      if (cos) this.box(0.12, h - 0.3, d + 0.08, this.matMetalDk, x + t, y + h / 2, z);
      else this.box(d + 0.08, h - 0.3, 0.12, this.matMetalDk, x, y + h / 2, z + t);
    }
    if (cos) {
      this.box(0.06, h - 0.5, d + 0.06, this.matMetalDk, x - w / 2 + 0.03, y + h / 2, z);
      this.box(0.08, 0.9, 0.08, this.matYellow, x - w / 2 + 0.08, y + 0.9, z - 0.4);
    } else {
      this.box(d + 0.06, h - 0.5, 0.06, this.matMetalDk, x, y + h / 2, z - w / 2 + 0.03);
      this.box(0.08, 0.9, 0.08, this.matYellow, x - 0.4, y + 0.9, z - w / 2 + 0.03);
    }
  }

  // LANDMARK: torre de agua (patas + tanque + bandas + cono).
  _waterTower(x, z, mat, accent) {
    const H = 6;
    for (const [ox, oz] of [[-1.1, -1.1], [1.1, -1.1], [-1.1, 1.1], [1.1, 1.1]]) {
      this.box(0.18, H, 0.18, this.matMetalDk, x + ox, H / 2, z + oz);
    }
    for (const yy of [2.1, 4.2]) {
      this.box(2.35, 0.1, 0.1, this.matMetalDk, x, yy, z - 1.1);
      this.box(2.35, 0.1, 0.1, this.matMetalDk, x, yy, z + 1.1);
      this.box(0.1, 0.1, 2.35, this.matMetalDk, x - 1.1, yy, z);
      this.box(0.1, 0.1, 2.35, this.matMetalDk, x + 1.1, yy, z);
    }
    this.cyl(1.7, 1.7, 2.3, 12, mat, x, H + 0.6, z);
    this.cyl(1.78, 1.78, 0.18, 12, accent, x, H + 1.5, z);
    const cone = new THREE.ConeGeometry(1.75, 0.8, 12);
    cone.translate(x, H + 2.1, z);
    this._push(this.matMetalDk, cone);
    this.meshCount++;
  }

  // LANDMARK: valla publicitaria BLOCKFIRE (tabla 12x3 sobre 2 patas).
  _billboard(x, z) {
    const H = 8.2;
    this.box(0.3, H, 0.3, this.matMetalDk, x - 4.5, H / 2, z - 0.5);
    this.box(0.3, H, 0.3, this.matMetalDk, x + 4.5, H / 2, z - 0.5);
    this.box(12, 3.2, 0.5, this.matBlack, x, H - 1.2, z);
    this._sign(x, H - 1.2, z + 0.3, 0, 11, 2.2, 'BLOCKFIRE', false);
    // zócalo de piezas (lectura cartoon a distancia)
    this.box(12.4, 0.3, 0.7, this.matYellow, x, 0.15, z);
  }

  // LANDMARK: arco de acceso al centro (pórtico rojo con larguero amarillo).
  _gateArc(x, z) {
    for (const side of [-1, 1]) {
      this.box(0.45, 4.2, 0.45, this.matRust, x + side * 3.0, 2.1, z);
    }
    this.box(6.6, 0.55, 0.55, this.matRust, x, 4.2, z);
    this.box(6.9, 0.18, 0.7, this.matYellow, x, 4.55, z);
    this.box(5.4, 0.3, 0.1, this.matRed, x, 3.75, z + 0.34);
    this.box(5.4, 0.3, 0.1, this.matRed, x, 3.75, z - 0.34);
  }

  // LANDMARK: contenedor apilado en cruz (2 abajo + 1 arriba transversal).
  _containerStack(x, z) {
    this._container(x, z - 1.6, this.matTeal, 0, 0);
    this._container(x, z + 1.6, this.matRust, 0, 0);
    this._container(x, z, this.matYellow, Math.PI / 2, 2.6);
  }

  // LANDMARK: grúa de obra (torre amarilla + pluma + gancho).
  _crane(x, z) {
    const H = 9;
    this.box(1.4, H, 1.4, this.matYellow, x, H / 2, z);
    this.box(1.7, 0.5, 1.7, this.matMetalDk, x, H + 0.2, z);
    this.box(1.1, 1.1, 1.1, this.matTeal, x + 0.7, H + 0.75, z);
    this.box(7.5, 0.5, 0.5, this.matYellow, x + 4.45, H + 0.45, z);
    this.box(2.0, 0.4, 0.4, this.matRust, x - 1.3, H + 0.4, z);
    this.cyl(0.05, 0.05, 2.4, 6, this.matBlack, x + 7.6, H - 0.85, z);
    this.box(0.5, 0.4, 0.5, this.matMetalDk, x + 7.6, H - 2.3, z);
  }

  // ═══════════════════ CLASH SQUAD ═══════════════════
  // Zoning: centro neutro ajedrezado + pista roja N-S; cuadrante SE (x>0,z>0)
  // MERCADO cálido (amarillo); SW taller frío (concreto); cuadrantes norte
  // en azul-gris/teal (zona enemiga). Landmarks: beacons de base (Map.js),
  // contenedores apilados E, grúa W, arcos + rótulo centro.
  buildClashSquad() {
    const s = this.s;

    // ── ZONING DE SUELO (pintura; colisión intacta) ──
    // Legibilidad anti-camuflaje (paleta SoldierAvatar): NINGUNA superficie
    // grande usa el rojo enemigo (0xff5a4a) ni el verde aliado (0x59d97c);
    // la pista central es CREMA (dist ≥84 de todos los trajes) con bordes
    // rojos finos — BRAVO (traje 0x8a4a3a) no se funde con el suelo.
    this._checker(14, 14, 0, 0, this.matCream, this.matBlack, 4);          // plaza central
    this._paint(3.4, s * 0.36, 0, s * 0.46, this.matCream);                // pista sur
    this._paint(3.4, s * 0.36, 0, -s * 0.46, this.matCream);               // pista norte
    this._paint(0.45, s * 0.36, 1.95, s * 0.46, this.matRed);              // borde rojo
    this._paint(0.45, s * 0.36, -1.95, s * 0.46, this.matRed);
    this._paint(0.45, s * 0.36, 1.95, -s * 0.46, this.matRed);
    this._paint(0.45, s * 0.36, -1.95, -s * 0.46, this.matRed);
    this._paint(s * 0.22, s * 0.18, s * 0.33, s * 0.31, this.matYellow);   // mercado cálido
    this._paint(s * 0.22, s * 0.22, -s * 0.31, s * 0.31, this.matConc);    // taller frío
    this._paint(s * 0.2, s * 0.22, -s * 0.31, -s * 0.31, this.matTeal);    // depósito N-O
    this._paint(s * 0.2, s * 0.22, s * 0.31, -s * 0.31, this.matOrange);   // obras N-E
    // sendas laterales E/W que leen como rutas de flanqueo
    this._paint(s * 0.34, 2.4, s * 0.5, 0, this.matYellow);
    this._paint(s * 0.34, 2.4, -s * 0.5, 0, this.matYellow);
    // bordes de la plaza central en peligro
    this._hazard(15, 1.4, 0, 7.6, 5);
    this._hazard(15, 1.4, 0, -7.6, 5);

    // ── FACHADAS DE BASE (adorno sobre los muros que YA son colliders) ──
    // Base aliada (muros en x=±14.4, z 15..20, cara norte z=15)
    this._window(-12.3, 1.5, 14.97, 0);
    this._window(-16.5, 1.5, 14.97, 0);
    this._window(12.3, 1.5, 14.97, 0);
    this._window(16.5, 1.5, 14.97, 0);
    this._awning(-14.4, 14.5, this.matOrange, -1);
    this._awning(14.4, 14.5, this.matTeal, -1);
    this._pipe(10.7, 15.7, 2.5, Math.PI / 2);
    this._pipe(-10.7, 15.7, 2.5, Math.PI / 2);
    // CORNISAS de base (silueta leíble desde el otro extremo del mapa):
    // aliada crema cálida, enemiga azul acero.
    this._wallCap(-14.4, 2.71, 17.5, 5.6, 1, this.matCream);
    this._wallCap(14.4, 2.71, 17.5, 5.6, 1, this.matCream);
    this._wallCap(0, 1.21, 16.2, 7, 1, this.matCream);      // muro central bajo
    this._wallCap(-14.4, 2.71, -17.5, 5.6, 1, this.matMetalDk);
    this._wallCap(14.4, 2.71, -17.5, 5.6, 1, this.matMetalDk);
    this._wallCap(0, 1.21, -16.2, 7, 1, this.matMetalDk);
    // pilares de esquina: suben la silueta de la base a 3.6
    this._cornerPost(-17.5, 15.2, 3.6, this.matCream);
    this._cornerPost(17.5, 15.2, 3.6, this.matTeal);
    this._cornerPost(-17.5, -15.2, 3.6, this.matMetalDk);
    this._cornerPost(17.5, -15.2, 3.6, this.matRust);
    // Base enemiga (espejo frío)
    this._window(-12.3, 1.5, -14.97, 0);
    this._window(-16.5, 1.5, -14.97, 0);
    this._window(12.3, 1.5, -14.97, 0);
    this._window(16.5, 1.5, -14.97, 0);
    this._awning(-14.4, -14.5, this.matBlue, 1);
    this._awning(14.4, -14.5, this.matRust, 1);
    this._pipe(10.7, -15.7, 2.5, -Math.PI / 2);
    this._pipe(-10.7, -15.7, 2.5, -Math.PI / 2);

    // ── CASAS: aire acondicionado en azotea + tubería de corner + pilar ──
    // (mismas 6 casas: ±22.8/±14.1 y ±26.4/0 — collar de colliders intacto)
    for (const [hx, hz] of [[-22.8, 14.1], [22.8, 14.1], [-22.8, -14.1], [22.8, -14.1], [-26.4, 0], [26.4, 0]]) {
      this._acUnit(hx + 3.5, 2.6, hz + 3.5, 0);
      this._pipe(hx - 3.6, hz - 3.6, 2.2, -Math.PI / 4);
      this._cornerPost(hx + 3.9, hz + 3.9, 3.2, this.matWoodDk);
    }

    // ── CENTRO (se LEE distinto: arcos + rótulo + farolas + cornisas) ──
    this._gateArc(0, 7.6);
    this._gateArc(0, -7.6);
    this._sign(0, 3.5, -3.2, 0, 3.0, 0.75, 'BLOCKFIRE', true); // sobre muro transversal
    this._lampPost(-5.2, 5.2, 1);
    this._lampPost(5.2, -5.2, -1);
    this._lampPost(-5.2, -5.2, 1);
    this._lampPost(5.2, 5.2, -1);
    // cornisa + ventanas ciegas en los muros x=±4 del caserón central
    for (const wx of [-4, 4]) {
      this.box(1.5, 0.22, 7.3, this.matCream, wx, 2.71, 0);
      const face = wx > 0 ? 0.63 : -0.63;
      for (const wz of [-2.1, 0, 2.1]) {
        this.box(0.06, 0.8, 1.3, this.matSky, wx + face, 1.5, wz);
        this.box(0.1, 0.96, 1.46, this.matWhite, wx + face * 1.08, 1.5, wz);
      }
    }
    // hastial sobre el muro transversal (y pilar alto: silueta del CENTRO)
    this.box(9.3, 0.9, 0.24, this.matRust, 0, 3.05, -3.2);
    this.box(9.7, 0.18, 0.4, this.matYellow, 0, 3.55, -3.2);
    this._cornerPost(-4.5, -3.2, 4.6, this.matRust);
    this._cornerPost(4.5, -3.2, 4.6, this.matRust);

    // ── LANE ESTE: distrito de contenedores (landmark apilado) ──
    this._containerStack(40, 0);
    this._drum(31.2, 4.6, this.matRust);
    this._drum(33.0, 5.3, this.matTeal, 0.6);
    this._tires(31.4, -4.8);

    // ── LANE OESTE: obra con grúa (landmark) ──
    this._crane(-32.5, 0);
    this._drum(-31.2, -4.8, this.matRust, 0.3);
    this._tires(-31.4, 4.8);

    // ── MERCADO (cuadrante aliado este): puestos ──
    this._crateStack(10.8, 19.8);
    this._crateStack(9.6, 16.2, 0.4);
    this._planter(10.2, 22.4);
    this._sign(16, 1.9, 14.94, 0, 2.4, 0.6, 'BLOCKFIRE', false);

    // ── TALLER (cuadrante aliado oeste) ──
    this._drum(-20.4, 18.6, this.matRust);
    this._drum(-18.6, 19.8, this.matTeal, 0.8);
    this._tires(-19.4, 21.0);

    // ── DEPÓSITOS NORTEOS: señal + bidones (vida sin collider) ──
    this._planter(-16.2, -16.2);
    this._stopSign(18, -18, 0);
    this._drum(18.6, -19.8, this.matBlue, 0.4);

    // ── Barriles escoltando los contenedores centrales (puntos heredados) ──
    this._drum(-7.6, -10.8, this.matRust);
    this._drum(-11.6, -13.4, this.matTeal, 0.5);
    this._drum(2.4, 10.8, this.matRust, 0.2);
    this._drum(6.4, 13.2, this.matYellow, 0.9);

    this._flushPaint();
  }

  // ═══════════════════ FFA ═══════════════════
  // Mismo lenguaje, zoning DISTINTO: anillo de obras naranja, pasos
  // peatonales cardinales, centros en plataformas con peligro + rótulos, y
  // 4 landmarks de esquina (torre de agua NE, contenedores NO, grúa SO,
  // valla BLOCKFIRE SE). No es el squad recoloreado: otros elementos.
  buildFFA() {
    const s = this.s;

    // Pasos peatonales hacia el centro desde cada spawn cardinal
    this._hazard(5.4, 2.4, 0, 18, 4);
    this._hazard(5.4, 2.4, 0, -18, 4);
    this._hazard(2.4, 5.4, 18, 0, 4);
    this._hazard(2.4, 5.4, -18, 0, 4);
    // anillo amarillo de obras a media radio (4 arcos)
    this._paint(2.6, s * 0.3, 0, s * 0.42, this.matYellow);
    this._paint(2.6, s * 0.3, 0, -s * 0.42, this.matYellow);
    this._paint(s * 0.3, 2.6, s * 0.42, 0, this.matYellow);
    this._paint(s * 0.3, 2.6, -s * 0.42, 0, this.matYellow);
    // peligro alrededor de las 4 plataformas (el centro se distingue)
    this._hazard(9.6, 5.6, 0, 8, 6);
    this._hazard(9.6, 5.6, 0, -8, 6);
    this._hazard(5.6, 9.6, -8, 0, 6);
    this._hazard(5.6, 9.6, 8, 0, 6);

    // rótulos BLOCKFIRE sobre las plataformas N/S (cara al anillo)
    this._sign(0, 3.5, 9.4, 0, 3.0, 0.75, 'BLOCKFIRE', false);
    this._sign(0, 3.5, -9.4, 0, 3.0, 0.75, 'BLOCKFIRE', false);

    // 4 landmarks de esquina
    this._waterTower(31.5, 31.5, this.matRust, this.matYellow);
    this._containerStack(-30.4, 33.6);
    this._crane(-31, -31);
    this._billboard(36, -30);

    // vestidores medios (evitando colliders; todos sin collider)
    this._crateStack(25.2, 0);
    this._drum(-25.2, 0, this.matRust);
    this._tires(0, 25.2);
    this._planter(0, -25.2);
    this._stopSign(12, 12, Math.PI / 4);
    this._stopSign(-12, -10, -Math.PI / 4);
    this._lampPost(12, -12, 1);
    this._lampPost(-12, 12, -1);
    this._acUnit(34, 2.2, 34, 0);
    this._acUnit(-34, 2.2, -34, 0);
  }
}
