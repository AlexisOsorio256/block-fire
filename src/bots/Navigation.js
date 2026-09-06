import * as THREE from '../lib/three.module.js';

// ── Navigation — DUEÑO ÚNICO de la navegación de bots ──
// Opción A (decisión técnica, la más pequeña y estable para un mapa AABB
// procedural): occupancy grid 2D generado UNA VEZ desde Map.checkCollision +
// A* con cache de caminos. Sin dependencias (three-pathfinding NO construye
// navmesh por sí solo y exigiría un GLB exportado a mano: no entra aquí).
//
// Contratos:
//   findPath(from, to, out) → out|null   (array REUTILIZADO de {x,z} — el
//       llamador lo consume antes del próximo findPath de OTRO bot; cada bot
//       copia su waypoint actual y no retiene el array)
//   hasLineOfSight(a, b) → bool          (raycast DDA sobre el grid)
//   repathNeeded(bot) → bool             (throttle por bot: coste ~0 por frame)
//
// Economía (reglas §7): el grid se rasteriza 1× por partida/mapa (120×120 →
// celdas de 2u = 60×60 = 3.600 sondas), A* solo corre en repath (cada
// 0.7–1.5s por bot como máximo), la SERP se recorta a waypoints significativos
// y cada bot sigue su waypoint activo con el steering que ya tenía.

const CELL = 2;          // metros por celda (bot radius 0.38 + margen sobra)
const MAX_PATH_LEN = 520; // límite de A*: diagonal completa expande ~426 (medido)

export class Navigation {
  constructor(map) {
    this.map = map;
    this.size = map.size;                       // media anchura (60)
    this.dim = Math.ceil((this.size * 2) / CELL); // 60 celdas por lado
    this._grid = null;                          // Uint8Array: 1 = caminable
    this._paths = new Map();                    // bot.id → { path, at, dest }
    this._clock = 0;
    // Scratch de A* (reutilizado; reglas §7: cero allocs por consulta en
    // estado estable — el path out es propiedad del llamador del frame)
    this._open = [];
    this._came = new Map();
    this._g = new Map();
  }

  // Rasteriza caminabilidad 1×: una celda es caminable si un cilindro de
  // radio bot (0.45 con margen) cabe en su centro. Coste único ~3.6k checks.
  _ensureGrid() {
    if (this._grid) return;
    const d = this.dim, grid = new Uint8Array(d * d);
    const probe = new THREE.Vector3();
    for (let j = 0; j < d; j++) {
      for (let i = 0; i < d; i++) {
        const x = -this.size + (i + 0.5) * CELL;
        const z = -this.size + (j + 0.5) * CELL;
        // Altura de sonda: feet a 0.1 y ojo a 1.65 — reproduce el AABB de un
        // bot de pie sobre el suelo (las plataformas bajas cuentan como piso).
        probe.set(x, 1.65, z);
        grid[j * d + i] = this.map.checkCollision(probe, 0.45, 1.65) ? 0 : 1;
      }
    }
    this._grid = grid;
  }

  _idx(x, z) {
    const i = Math.floor((x + this.size) / CELL);
    const j = Math.floor((z + this.size) / CELL);
    if (i < 0 || j < 0 || i >= this.dim || j >= this.dim) return -1;
    return j * this.dim + i;
  }

  _cellCenter(idx, out) {
    const i = idx % this.dim, j = (idx / this.dim) | 0;
    out.x = -this.size + (i + 0.5) * CELL;
    out.z = -this.size + (j + 0.5) * CELL;
    return out;
  }

  // Línea de visión 2D sobre el grid (DDA simple por muestreo): el mapa es
  // AABB y los muros altos bloquean visión y paso por igual en XZ.
  hasLineOfSight(ax, az, bx, bz) {
    this._ensureGrid();
    const dx = bx - ax, dz = bz - az;
    const dist = Math.hypot(dx, dz);
    const steps = Math.ceil(dist / (CELL * 0.5));
    for (let s = 1; s < steps; s++) {
      const t = s / steps;
      const idx = this._idx(ax + dx * t, az + dz * t);
      if (idx >= 0 && !this._grid[idx]) return false;
    }
    return true;
  }

  // ¿Toca repath? Cada bot recalcula como máximo cada ~1s y solo si su
  // destino cambió significativamente.
  repathNeeded(bot) {
    const rec = this._paths.get(bot.id);
    if (!rec) return true;
    if (this._clock - rec.at < 0.9) return false;
    return true;
  }

  // A* 4-dir + post-suavizado string-pulling. Devuelve `out` (array del
  // llamador) con waypoints {x,z}, o null si no hay camino.
  findPath(fromX, fromZ, toX, toZ, out) {
    this._ensureGrid();
    out.length = 0;
    const start = this._idx(fromX, fromZ);
    const goal = this._idx(toX, toZ);
    if (start < 0 || goal < 0) return null;
    if (!this._grid[start]) {
      // Origen en celda bloqueada (borde de pared): buscar la vecina libre
      // más cercana en vez de rendirse.
      const fix = this._nearestOpen(start);
      if (fix < 0) return null;
      return this._runAStar(fix, goal, out);
    }
    if (!this._grid[goal]) {
      const fix = this._nearestOpen(goal);
      if (fix < 0) return null;
      return this._runAStar(start, fix, out);
    }
    return this._runAStar(start, goal, out);
  }

  _nearestOpen(idx) {
    const d = this.dim;
    const i0 = idx % d, j0 = (idx / d) | 0;
    for (let r = 1; r <= 3; r++) {
      for (let dj = -r; dj <= r; dj++) {
        for (let di = -r; di <= r; di++) {
          const i = i0 + di, j = j0 + dj;
          if (i < 0 || j < 0 || i >= d || j >= d) continue;
          if (this._grid[j * d + i]) return j * d + i;
        }
      }
    }
    return -1;
  }

  _runAStar(start, goal, out) {
    if (start === goal) { this._cellCenter(goal, out[0] || (out[0] = {})); out.length = 1; return out; }
    const d = this.dim;
    const open = this._open; open.length = 0;
    const came = this._came; came.clear();
    const g = this._g; g.clear();
    open.push(start); g.set(start, 0);
    const h = (idx) => {
      const di = Math.abs((idx % d) - (goal % d)), dj = Math.abs(((idx / d) | 0) - ((goal / d) | 0));
      return (di + dj) * CELL;
    };
    let expanded = 0;
    while (open.length && expanded < MAX_PATH_LEN) {
      // extrae el de menor f (lineal: los paths son cortos, 60 nodos máx)
      let bi = 0, bf = Infinity;
      for (let k = 0; k < open.length; k++) {
        const f = g.get(open[k]) + h(open[k]);
        if (f < bf) { bf = f; bi = k; }
      }
      const cur = open.splice(bi, 1)[0];
      expanded++;
      if (cur === goal) {
        // Reconstruir y SUAVIZAR: colapsar colineales (string pulling barato)
        const rev = [];
        let c = cur;
        while (c !== undefined) { rev.push(c); c = this._came.get(c); }
        rev.reverse();
        // conservar el punto exacto de destino al final
        const first = out[0] || (out[0] = {});
        this._cellCenter(rev[0], first);
        let n = 1;
        for (let k = 1; k < rev.length - 1; k++) {
          const a = rev[k - 1], b = rev[k], c2 = rev[k + 1];
          const ax = a % d, az = (a / d) | 0, bx = b % d, bz = (b / d) | 0, cx = c2 % d, cz = (c2 / d) | 0;
          const collinear = Math.sign(bx - ax) === Math.sign(cx - bx) && Math.sign(cz - az) === Math.sign(cz - bz);
          if (collinear) continue;
          const wp = out[n] || (out[n] = {});
          this._cellCenter(b, wp);
          n++;
        }
        const last = out[n] || (out[n] = {});
        last.x = this.map.size * (goal % d + 0.5) / d * 2 - this.map.size;
        last.z = this.map.size * (((goal / d) | 0) + 0.5) / d * 2 - this.map.size;
        // el destino real pedido (no el centro de celda): ya lo pasaron —
        // el llamador lo fija tras llamar si quiere exactitud de sub-celda
        out.length = n + 1;
        return out;
      }
      const ci = cur % d, cj = (cur / d) | 0;
      for (let s = 0; s < 4; s++) {
        const ni = ci + (s === 0 ? 1 : s === 1 ? -1 : 0);
        const nj = cj + (s === 2 ? 1 : s === 3 ? -1 : 0);
        if (ni < 0 || nj < 0 || ni >= d || nj >= d) continue;
        const nIdx = nj * d + ni;
        if (!this._grid[nIdx]) continue;
        const ng = g.get(cur) + CELL;
        const prev = g.get(nIdx);
        if (prev === undefined || ng < prev) {
          g.set(nIdx, ng);
          this._came.set(nIdx, cur);
          if (!open.includes(nIdx)) open.push(nIdx);
        }
      }
    }
    return null; // sin camino en el presupuesto
  }

  // API para Bot: obtiene el siguiente waypoint a seguir hacia (toX,toZ).
  // Cache por bot.id; devuelve coordenadas en scratch propio (el bot las
  // copia al instante). null = sin camino (el bot hace steering local).
  nextWaypoint(bot, toX, toZ) {
    let rec = this._paths.get(bot.id);
    if (!rec) {
      rec = { path: [], at: -9, i: 0 };
      this._paths.set(bot.id, rec);
    }
    if (this._clock - rec.at >= 0.9 || rec.i >= rec.path.length) {
      const p = this.findPath(bot.position.x, bot.position.z, toX, toZ, rec.path);
      rec.at = this._clock;
      rec.i = 0;
      if (!p) return null;
    }
    const wp = rec.path[rec.i];
    if (!wp) return null;
    // waypoint alcanzado → avanzar
    const dx = wp.x - bot.position.x, dz = wp.z - bot.position.z;
    if (dx * dx + dz * dz < 1.2 * 1.2) {
      rec.i++;
      const nx = rec.path[rec.i];
      if (!nx) return null;
      return nx;
    }
    return wp;
  }

  // invalidar todos los caminos (fin de ronda/reset: regla §4 — nada viejo)
  reset() {
    this._paths.clear();
  }

  tick(dt) { this._clock += dt; }
}
