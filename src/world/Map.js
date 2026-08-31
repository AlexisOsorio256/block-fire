import * as THREE from '../lib/three.module.js';

export class Map {
  constructor(scene) {
    this.scene = scene;
    this.boxes = []; // For collision: { min: Vector3, max: Vector3, mesh }
    this.spawns = [];
    this.size = 48; // Half size
    this.wallHeight = 5;

    this._createGround();
    this._createWalls();
    this._createCover();
    this._createSpawns();
  }

  _createGround() {
    const groundGeo = new THREE.PlaneGeometry(this.size*2, this.size*2);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x8d99a8,
      roughness: 0.92,
      metalness: 0.02
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI/2;
    ground.position.y = 0;
    ground.receiveShadow = true;
    this.scene.add(ground);

    // Subtle grid keeps blocky identity without darkening the floor
    const gridHelper = new THREE.GridHelper(this.size*2, 24, 0x74869c, 0x8093a6);
    gridHelper.position.y = 0.02;
    this.scene.add(gridHelper);
  }

  _createBox(x, y, z, w, h, d, color) {
    const geo = new THREE.BoxGeometry(w, h, d);
    const mat = new THREE.MeshStandardMaterial({ 
      color: color || 0x2a344a,
      roughness: 0.75
    });
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
    this._createBox(0, 0, -s, s*2, h, t, 0x5a6b80);
    this._createBox(0, 0, s, s*2, h, t, 0x5a6b80);
    this._createBox(-s, 0, 0, t, h, s*2, 0x5a6b80);
    this._createBox(s, 0, 0, t, h, s*2, 0x5a6b80);
  }

  _createCover() {
    // Central cover clusters - designed for frequent encounters, not a maze
    // Warm-lit concrete tones: readable cover vs floor vs walls
    const colors = [0xb9c4cf, 0xcabdae, 0xa8b6c4, 0xd4c5b0];
    const pick = () => colors[Math.floor(Math.random()*colors.length)];

    // Cluster 1 - near center
    this._createBox(0, 0, 0, 6, 2.2, 1.2, pick());
    this._createBox(3, 0, -2, 1.2, 1.8, 4, pick());
    this._createBox(-3, 0, 2, 1.2, 1.8, 4, pick());

    // Cluster 2 - NW
    this._createBox(-14, 0, -12, 4, 2.8, 1.2, pick());
    this._createBox(-12, 0, -14, 1.2, 1.6, 4, pick());
    this._createBox(-16, 0, -8, 2, 1.2, 2, pick());

    // Cluster 3 - SE
    this._createBox(14, 0, 12, 4, 2.2, 1.2, pick());
    this._createBox(12, 0, 14, 1.2, 1.8, 4, pick());
    this._createBox(16, 0, 8, 2, 1.4, 2, pick());

    // Cluster 4 - NE
    this._createBox(12, 0, -14, 3, 2.0, 1.2, pick());
    this._createBox(14, 0, -10, 1.2, 1.6, 3, pick());

    // Cluster 5 - SW
    this._createBox(-12, 0, 14, 3, 2.0, 1.2, pick());
    this._createBox(-14, 0, 10, 1.2, 1.6, 3, pick());

    // Platforms — distinct elevated tone + accent edges
    this._createBox(0, 2.2, 8, 8, 0.4, 4, 0x9fb06a);
    this._createBox(0, 2.2, -8, 6, 0.4, 4, 0x9fb06a);
    this._createBox(-8, 1.2, 0, 4, 0.4, 6, 0x9fb06a);
    this._createBox(8, 1.2, 0, 4, 0.4, 6, 0x9fb06a);

    // Small cover boxes scattered
    for(let i=0;i<6;i++){
      const x = (Math.random()-0.5)*36;
      const z = (Math.random()-0.5)*36;
      if(Math.hypot(x,z) < 8) continue;
      this._createBox(x, 0, z, 1.6, 1.0, 1.6, pick());
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

  getRandomSpawn(excludePos = null, minDist = 8) {
    // Find spawn far from excludePos
    let candidates = this.spawns.slice();
    if (excludePos) {
      candidates.sort((a,b) => b.distanceTo(excludePos) - a.distanceTo(excludePos));
      // Pick from farthest 3
      candidates = candidates.slice(0, 3);
    }
    const pick = candidates[Math.floor(Math.random()*candidates.length)];
    // Add jitter
    const jitter = new THREE.Vector3((Math.random()-0.5)*2, 0, (Math.random()-0.5)*2);
    return pick.clone().add(jitter);
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
}
