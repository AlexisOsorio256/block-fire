import * as THREE from 'three';

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
      color: 0x1a2332, 
      roughness: 0.85,
      metalness: 0.05
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI/2;
    ground.position.y = 0;
    ground.receiveShadow = true;
    this.scene.add(ground);

    // Grid texture illusion with lines
    const gridHelper = new THREE.GridHelper(this.size*2, 24, 0x2a3a5a, 0x1e2a44);
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
    // Outer walls
    this._createBox(0, 0, -s, s*2, h, t, 0x1e2a44);
    this._createBox(0, 0, s, s*2, h, t, 0x1e2a44);
    this._createBox(-s, 0, 0, t, h, s*2, 0x1e2a44);
    this._createBox(s, 0, 0, t, h, s*2, 0x1e2a44);
  }

  _createCover() {
    // Central cover clusters - designed for frequent encounters, not a maze
    const colors = [0x2a344a, 0x2a3a4a, 0x344a5a, 0x3a4a6a];
    const pick = () => colors[Math.floor(Math.random()*colors.length)];

    // Cluster 1 - near center
    this._createBox(0, 0, 0, 6, 2.2, 1.2, pick());
    this._createBox(3, 0, -2, 1.2, 1.8, 4, pick());
    this._createBox(-3, 0, 2, 1.2, 1.8, 4, pick());

    // Cluster 2 - NW
    this._createBox(-14, 0, -12, 4, 2.8, 1.2, pick());
    this._createBox(-12, 0, -14, 1.2, 1.6, 4, pick());
    this._createBox(-16, 0, -8, 2, 1.2, 2, 0x2a3a4a);

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

    // Platforms (second height)
    this._createBox(0, 2.2, 8, 8, 0.4, 4, 0x1e2a44);
    this._createBox(0, 2.2, -8, 6, 0.4, 4, 0x1e2a44);
    this._createBox(-8, 1.2, 0, 4, 0.4, 6, 0x1e2a44);
    this._createBox(8, 1.2, 0, 4, 0.4, 6, 0x1e2a44);

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

  getGroundY(x, z) {
    // Simple: ground is at 0, but platforms are at y=2.2
    // For now, just return 0, but could check if over platform
    // Check platforms: they are at y=2.2 with height 0.4, so top at 2.6
    // But for MVP, keep ground at 0, platforms are just cover, not walkable? For simplicity, make platforms walkable by checking AABB top
    for(const box of this.boxes){
      if(box.h < 1) {
        // Platform
        if(x > box.min.x && x < box.max.x && z > box.min.z && z < box.max.z){
          if(box.max.y > 1) return box.max.y;
        }
      }
    }
    return 0;
  }

  checkCollision(pos, radius, height) {
    const minX = pos.x - radius, maxX = pos.x + radius;
    const minZ = pos.z - radius, maxZ = pos.z + radius;
    const minY = pos.y - height, maxY = pos.y;

    for(const box of this.boxes){
      if(maxX < box.min.x || minX > box.max.x) continue;
      if(maxZ < box.min.z || minZ > box.max.z) continue;
      if(maxY < box.min.y || minY > box.max.y) continue;
      // Skip ground (y=0) - ground is not a wall, handled separately
      if(box.min.y === 0 && box.max.y < 1) continue;
      return true;
    }
    // Bounds
    if(Math.abs(pos.x) > this.size - 0.5 || Math.abs(pos.z) > this.size - 0.5) return true;
    return false;
  }

  raycast(start, dir, maxDist) {
    // Simple ray against boxes
    const ray = new THREE.Ray(start, dir);
    let closest = null;
    let closestDist = maxDist;

    for(const box of this.boxes){
      // Skip small ground boxes? Keep them as cover
      const boxMesh = box.mesh;
      // Use Three's Raycaster for mesh
      // For performance, do AABB check first
      const invDir = new THREE.Vector3(1/dir.x, 1/dir.y, 1/dir.z);
      // Simplified: just check distance to box center
      const center = new THREE.Vector3((box.min.x+box.max.x)/2, (box.min.y+box.max.y)/2, (box.min.z+box.max.z)/2);
      const toCenter = center.clone().sub(start);
      const proj = toCenter.dot(dir);
      if(proj < 0 || proj > closestDist) continue;
      const closestPoint = start.clone().addScaledVector(dir, proj);
      const dx = Math.max(box.min.x - closestPoint.x, 0, closestPoint.x - box.max.x);
      const dy = Math.max(box.min.y - closestPoint.y, 0, closestPoint.y - box.max.y);
      const dz = Math.max(box.min.z - closestPoint.z, 0, closestPoint.z - box.max.z);
      const distSq = dx*dx + dy*dy + dz*dz;
      if(distSq < 0.01 && proj < closestDist){
        closestDist = proj;
        closest = { distance: proj, point: closestPoint, box };
      }
    }
    return closest;
  }
}
