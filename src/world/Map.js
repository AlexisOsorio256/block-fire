import * as THREE from '../lib/three.module.js';

export class Map {
  constructor(scene) {
    this.scene = scene;
    this.boxes = []; // For collision: { min: Vector3, max: Vector3, mesh }
    this.spawns = [];
    this.size = 48; // Half size
    this.wallHeight = 5;

    // Real CC0 textures (Kenney, see CREDITS.md). If a file fails to load the
    // material keeps its flat color — the map never breaks, just degrades.
    const loader = new THREE.TextureLoader();
    const loadTex = (file, repeatX, repeatY, fallbackColor) => {
      const tex = loader.load(`assets/textures/${file}`, undefined, undefined, () => {});
      if (tex) {
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(repeatX, repeatY);
        tex.anisotropy = 8; // sharper textures at grazing angles (floor!)
      }
      return new THREE.MeshStandardMaterial({
        color: fallbackColor,
        map: tex || null,
        roughness: 0.85,
        metalness: 0.05
      });
    };
    // Scale repeats so texels read at arcade scale (not noisy)
    this._matGround = loadTex('ground.png', 24, 24, 0x9aa5b3);
    this._matWall = loadTex('wall.png', 24, 1, 0x5a6b80);
    this._matCover = loadTex('cover.png', 1.6, 1.6, 0xc9b8a0);
    this._matPlatform = loadTex('platform.png', 2.5, 1.5, 0x9fb06a);
    // Duelo de Escuadras: identidad de base (suelo/pared tintados por equipo)
    this._matAllyFloor = loadTex('ground.png', 6, 2, 0x2f6b5a);
    this._matEnemyFloor = loadTex('ground.png', 6, 2, 0x7a4038);
    this._matAllyWall = loadTex('wall.png', 4, 1, 0x2f6b5a);
    this._matEnemyWall = loadTex('wall.png', 4, 1, 0x7a4038);
    this._matWood = loadTex('cover.png', 2, 1, 0x8a6a3a);
    // Duelo de Escuadras: colores de equipo (aliado verde-azul, enemigo rojo)
    this._matAllyFloor = loadTex('ground.png', 6, 2, 0x2b4a52);
    this._matEnemyFloor = loadTex('ground.png', 6, 2, 0x52303a);
    this._matAllyWall = loadTex('wall.png', 4, 1, 0x2f6b5a);
    this._matEnemyWall = loadTex('wall.png', 4, 1, 0x7a4038);
    this._matWood = loadTex('cover.png', 2, 1, 0x8a6a3a);

    this._createGround();
    this._createWalls();
    this._createCover();
    this._createSpawns();
    // spawns fijos de escuadra: cada equipo sale de SU base (sur vs norte)
    this.squadSpawns = {
      ally:  [new THREE.Vector3(-4, 1.6, this.size*0.42), new THREE.Vector3(0, 1.6, this.size*0.44),
              new THREE.Vector3(4, 1.6, this.size*0.42),  new THREE.Vector3(-1, 1.6, this.size*0.36)],
      enemy: [new THREE.Vector3(-4, 1.6, -this.size*0.42), new THREE.Vector3(0, 1.6, -this.size*0.44),
              new THREE.Vector3(4, 1.6, -this.size*0.42), new THREE.Vector3(1, 1.6, -this.size*0.36)],
    };
  }

  _createGround() {
    const groundGeo = new THREE.PlaneGeometry(this.size*2, this.size*2);
    const ground = new THREE.Mesh(groundGeo, this._matGround);
    ground.rotation.x = -Math.PI/2;
    ground.position.y = 0;
    ground.receiveShadow = true;
    this.scene.add(ground);
  }

  // material: 'wall' | 'cover' | 'platform' (shared textured material)
  _createBox(x, y, z, w, h, d, material = 'cover') {
    const geo = new THREE.BoxGeometry(w, h, d);
    const mat = {
      wall: this._matWall, platform: this._matPlatform, cover: this._matCover,
      allyFloor: this._matAllyFloor, enemyFloor: this._matEnemyFloor,
      allyWall: this._matAllyWall, enemyWall: this._matEnemyWall, wood: this._matWood,
    }[material] || this._matCover;
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y + h/2, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.scene.add(mesh);

    // Collision box
    const min = new THREE.Vector3(x - w/2, y, z - d/2);
    const max = new THREE.Vector3(x + w/2, y + h, z + d/2);
    this.boxes.push({ min, max, mesh, x, y, z, w, h, d });

    return mesh;
  }

  _createWalls() {
    const s = this.size;
    const h = this.wallHeight;
    const t = 1.0;
    // Outer walls — darker rim, clearly "boundary"
    this._createBox(0, 0, -s, s*2, h, t, 'wall');
    this._createBox(0, 0, s, s*2, h, t, 'wall');
    this._createBox(-s, 0, 0, t, h, s*2, 'wall');
    this._createBox(s, 0, 0, t, h, s*2, 'wall');
  }

  _createCover() {
    // Central cover clusters - designed for frequent encounters, not a maze

    // Cluster 1 - near center
    this._createBox(0, 0, 0, 6, 2.2, 1.2, 'cover');
    this._createBox(3, 0, -2, 1.2, 1.8, 4, 'cover');
    this._createBox(-3, 0, 2, 1.2, 1.8, 4, 'cover');

    // Cluster 2 - NW
    this._createBox(-14, 0, -12, 4, 2.8, 1.2, 'cover');
    this._createBox(-12, 0, -14, 1.2, 1.6, 4, 'cover');
    this._createBox(-16, 0, -8, 2, 1.2, 2, 'cover');

    // Cluster 3 - SE
    this._createBox(14, 0, 12, 4, 2.2, 1.2, 'cover');
    this._createBox(12, 0, 14, 1.2, 1.8, 4, 'cover');
    this._createBox(16, 0, 8, 2, 1.4, 2, 'cover');

    // Cluster 4 - NE
    this._createBox(12, 0, -14, 3, 2.0, 1.2, 'cover');
    this._createBox(14, 0, -10, 1.2, 1.6, 3, 'cover');

    // Cluster 5 - SW
    this._createBox(-12, 0, 14, 3, 2.0, 1.2, 'cover');
    this._createBox(-14, 0, 10, 1.2, 1.6, 3, 'cover');

    // OUTER RING cover (map audit: cardinal spawns had 11-13/16 open sight
    // lines >20u — spawn sniping). Mid-ring blocks break the long lanes and
    // create flanking routes without closing the arena feel.
    // N lane (behind spawn 0,-18)
    this._createBox(-7, 0, -26, 5, 2.4, 1.4, 'cover');
    this._createBox(8, 0, -26, 4, 2.0, 1.4, 'cover');
    // S lane (behind spawn 0,18)
    this._createBox(7, 0, 26, 5, 2.4, 1.4, 'cover');
    this._createBox(-8, 0, 26, 4, 2.0, 1.4, 'cover');
    // E lane (behind spawn 18,0)
    this._createBox(26, 0, -6, 1.4, 2.4, 5, 'cover');
    this._createBox(26, 0, 8, 1.4, 2.0, 4, 'cover');
    // W lane (behind spawn -18,0)
    this._createBox(-26, 0, 7, 1.4, 2.4, 5, 'cover');
    this._createBox(-26, 0, -8, 1.4, 2.0, 4, 'cover');
    // Diagonal corners: soft cover for the (±12,±12) spawns' long diagonals
    this._createBox(20, 0, 20, 2.6, 1.8, 2.6, 'cover');
    this._createBox(-20, 0, -20, 2.6, 1.8, 2.6, 'cover');
    this._createBox(20, 0, -20, 2.6, 1.8, 2.6, 'cover');
    this._createBox(-20, 0, 20, 2.6, 1.8, 2.6, 'cover');

    // Platforms — distinct elevated tone + accent edges
    this._createBox(0, 2.2, 8, 8, 0.4, 4, 'platform');
    this._createBox(0, 2.2, -8, 6, 0.4, 4, 'platform');
    this._createBox(-8, 1.2, 0, 4, 0.4, 6, 'platform');
    this._createBox(8, 1.2, 0, 4, 0.4, 6, 'platform');

    // Small cover boxes scattered — positions validated against spawn points
    // so a prop can never sit on top of a spawn. tryPlace gives up after 20
    // attempts (skip) rather than blocking map creation.
    const spawnBlocked = (x, z) => this.spawns.some(s => Math.hypot(s.x - x, s.z - z) < 2.6);
    for(let i=0;i<6;i++){
      for (let attempt = 0; attempt < 20; attempt++) {
        const x = (Math.random()-0.5)*36;
        const z = (Math.random()-0.5)*36;
        if(Math.hypot(x,z) < 8) continue;
        if (spawnBlocked(x, z)) continue;
        this._createBox(x, 0, z, 1.6, 1.0, 1.6, 'cover');
        break;
      }
    }
  }

  _createSpawns() {
    // 8 spawn points around map, not too close to each other
    this.spawns = [
      new THREE.Vector3(0, 1.8, 18),
      new THREE.Vector3(18, 1.8, 0),
      new THREE.Vector3(0, 1.8, -18),
      new THREE.Vector3(-18, 1.8, 0),
      new THREE.Vector3(12, 1.8, 12),
      new THREE.Vector3(-12, 1.8, -12),
      new THREE.Vector3(12, 1.8, -12),
      new THREE.Vector3(-12, 1.8, 12),
    ];
  }

  // A spawn position is valid when the entity's collision AABB fits there
  // without touching any solid box. Position.y is eye height (see rules).
  isSpawnClear(x, z, radius = 0.45, height = 1.65) {
    const probe = new THREE.Vector3(x, height, z);
    const feetGround = this.getGroundY(x, z, 0);
    // If the ground under the spawn is a raised platform, the entity must fit
    // between platform top and any geometry above — the plain AABB check with
    // feet at platform level covers that.
    probe.y = feetGround + height;
    return !this.checkCollision(probe, radius, height);
  }

  getRandomSpawn(excludePos = null, minDist = 8) {
    // Candidates: farthest 3 from excludePos (usually the player) so bots
    // spawn across the arena, never in the player's face.
    let candidates = this.spawns.slice();
    if (excludePos) {
      candidates.sort((a,b) => b.distanceTo(excludePos) - a.distanceTo(excludePos));
      candidates = candidates.slice(0, 3);
    }
    // Try spawns in random order; within each, try the exact point first, then
    // jittered offsets. First CLEAR position wins — no spawning inside walls,
    // cover boxes or scattered props.
    const shuffled = candidates.slice().sort(() => Math.random() - 0.5);
    const jitters = [
      [0, 0], [0.8, 0], [-0.8, 0], [0, 0.8], [0, -0.8],
      [1.6, 0], [-1.6, 0], [0, 1.6], [0, -1.6], [1.2, 1.2], [-1.2, -1.2], [1.2, -1.2], [-1.2, 1.2]
    ];
    for (const base of shuffled) {
      for (const [jx, jz] of jitters) {
        const x = base.x + jx, z = base.z + jz;
        if (Math.abs(x) > this.size - 1.2 || Math.abs(z) > this.size - 1.2) continue;
        if (this.isSpawnClear(x, z)) {
          const gy = this.getGroundY(x, z, 0);
          return new THREE.Vector3(x, gy + 1.65, z);
        }
      }
    }
    // Defensive fallback: exact spawn point, snapped to its ground (all 8 base
    // spawns sit in open ground by design; this should never run).
    const fallback = this.spawns[0];
    return new THREE.Vector3(fallback.x, this.getGroundY(fallback.x, fallback.z, 0) + 1.65, fallback.z);
  }

  // Highest walkable surface at (x,z) whose top is reachable from feetY
  // (within stepUp). Platforms above the entity's head are ceilings, not floor.
  getGroundY(x, z, feetY = Infinity, stepUp = 0.5) {
    let best = 0;
    for(const box of this.boxes){
      if(box.h >= 1) continue; // not a walkable platform
      if(box.max.y <= 0.5) continue;
      if(box.max.y > feetY + stepUp) continue; // above feet: not ground for this entity
      if(x > box.min.x && x < box.max.x && z > box.min.z && z < box.max.z){
        if(box.max.y > best) best = box.max.y;
      }
    }
    return best;
  }

  checkCollision(pos, radius, height) {
    const minX = pos.x - radius, maxX = pos.x + radius;
    const minZ = pos.z - radius, maxZ = pos.z + radius;
    const minY = pos.y - height, maxY = pos.y;

    for(const box of this.boxes){
      if(maxX < box.min.x || minX > box.max.x) continue;
      if(maxZ < box.min.z || minZ > box.max.z) continue;
      if(maxY < box.min.y || minY > box.max.y) continue;
      // Skip walkable platforms when standing on top — they are floors, not walls
      if(box.h < 1 && minY >= box.max.y - 0.05) continue;
      // Thin ground debris not collidable (defensive)
      if(box.min.y === 0 && box.max.y < 1) continue;
      return true;
    }
    // Bounds
    if(Math.abs(pos.x) > this.size - 0.5 || Math.abs(pos.z) > this.size - 0.5) return true;
    return false;
  }

  raycast(start, dir, maxDist) {
    // Robust slab ray-AABB — guarantees real wall occlusion
    let closest = null;
    let closestDist = maxDist;

    for(const box of this.boxes){
      const min = box.min, max = box.max;
      let tmin = -Infinity, tmax = Infinity;

      // X slab
      if (Math.abs(dir.x) < 1e-8) {
        if (start.x < min.x || start.x > max.x) continue;
      } else {
        const inv = 1 / dir.x;
        let t1 = (min.x - start.x) * inv;
        let t2 = (max.x - start.x) * inv;
        if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
        tmin = Math.max(tmin, t1);
        tmax = Math.min(tmax, t2);
        if (tmin > tmax) continue;
      }
      // Y slab
      if (Math.abs(dir.y) < 1e-8) {
        if (start.y < min.y || start.y > max.y) continue;
      } else {
        const inv = 1 / dir.y;
        let t1 = (min.y - start.y) * inv;
        let t2 = (max.y - start.y) * inv;
        if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
        tmin = Math.max(tmin, t1);
        tmax = Math.min(tmax, t2);
        if (tmin > tmax) continue;
      }
      // Z slab
      if (Math.abs(dir.z) < 1e-8) {
        if (start.z < min.z || start.z > max.z) continue;
      } else {
        const inv = 1 / dir.z;
        let t1 = (min.z - start.z) * inv;
        let t2 = (max.z - start.z) * inv;
        if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
        tmin = Math.max(tmin, t1);
        tmax = Math.min(tmax, t2);
        if (tmin > tmax) continue;
      }

      // tmin is entry, tmax is exit
      if (tmax < 0) continue; // behind
      const dist = tmin >= 0 ? tmin : tmax;
      if (dist < 0 || dist > closestDist) continue;
      // Skip if ray origin inside the box and exiting immediately (defensive: still counts as hit at 0)
      // but for walls we want to treat origin inside as not occluding self — ignore hits <0.08
      if (dist < 0.08) continue;
      if (dist < closestDist) {
        closestDist = dist;
        closest = { distance: dist, point: start.clone().addScaledVector(dir, dist), box };
      }
    }
    return closest;
  }


  // ═══ ARENA CLASH SQUAD: dos bases espejo + encuentro central ═══
  // (Duelo de Escuadras — inspiración Free Fire: spawns opuestos por equipo,
  //  lane central de encuentro y flancos con cobertura alternada.)
  _buildClashSquad() {
    const s = this.size;
    const add = (x, z, w, h, d, mat) => this._createBox(x, 0, z, w, h, d, mat);

    // BASE ALIADA (Sur, z>0): suelo pintado, casas refugio, muros bajos
    add(0, s*0.40, 12, 0.12, s*0.34, 'allyFloor');
    add(-s*0.24, s*0.30, 6, 2.6, 4, 'allyWall');
    add(s*0.24, s*0.30, 6, 2.6, 4, 'allyWall');
    add(-s*0.13, this.size*0.36, 5, 1.2, 1.4, 'wood');
    add(s*0.13, this.size*0.36, 5, 1.2, 1.4, 'wood');
    add(0, s*0.30, 1.4, 1.1, 6, 'allyWall');

    // BASE ENEMIGA (Norte) — espejo exacto
    add(0, -s*0.40, 12, 0.12, s*0.34, 'enemyFloor');
    add(-s*0.24, -s*0.30, 6, 2.6, 4, 'enemyWall');
    add(s*0.24, -s*0.30, 6, 2.6, 4, 'enemyWall');
    add(-s*0.12, -this.size*0.36, 5, 1.2, 1.4, 'wood');
    add(s*0.12, -this.size*0.36, 5, 1.2, 1.4, 'wood');
    add(0, -s*0.30, 1.4, 1.1, 6, 'enemyWall');

    // CENTRO: casa con dos paredes + coberturas cruzadas
    add(-4, 0, 1.2, 2.6, 7, 'wall');
    add(4, 0, 1.2, 2.6, 7, 'wall');
    add(0, -3.2, 9, 2.6, 1.2, 'wall');
    add(-6.5, 0, 3.2, 1.2, 1.2, 'wood');
    add(6.5, 0, -3.2, 1.2, 1.2, 'wood');

    // LANES laterales (flanqueo) con coberturas alternadas
    for (const side of [-1, 1]) {
      add(side * s*0.34, s*0.12, 2.2, 1.5, 4.5, 'wood');
      add(side * s*0.26, -s*0.12, 2.4, 2.2, 3, 'cover');
      add(side * s*0.12, s*0.16, 2.6, 1.2, 1.2, 'wood');
      add(side * s*0.18, -s*0.26, 3, 1.6, 1.6, 'cover');
    }

    // PROPS: contenedores industriales (identidad, no graybox)
    add(-s*0.16, -s*0.2, 2.6, 2.2, 2.6, 'cover');
    add(s*0.16, s*0.2, 2.6, 1.4, 2.6, 'enemyWall');
  }
}
