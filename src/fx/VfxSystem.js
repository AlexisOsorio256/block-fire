import * as THREE from '../lib/three.module.js';

// ── VfxSystem — ÚNICO dueño de los efectos visuales de combate ──
// flash de boca · impacto · anillo · sangre · trazadora.
// Contrato: fire()/Game llaman a los 4 métodos públicos; el sistema se anima
// solo con update(dt) desde el loop central (cero rAF/timers propios).
//
// Economía (reglas §6): pooling de vidas — geometrías y materiales BASE son
// compartidos y jamás se mutan; cada partícula clona el material porque el
// fade muta opacity por partícula (el primer tiro apagaba a los siguientes con
// material compartido). _killVFX hace dispose SOLO del clon.

export class VfxSystem {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;

    this._activeFlashes = [];
    this._activeImpacts = [];
    this._activeBloods = [];
    this._activeRings = [];
    // Geometrías compartidas
    this._geoMuzzle = new THREE.SphereGeometry(0.06, 6, 6);
    this._matMuzzle = new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.9 });
    this._geoMuzzleCore = new THREE.SphereGeometry(0.035, 6, 6);
    this._matMuzzleCore = new THREE.MeshBasicMaterial({ color: 0xfff8e0 });
    this._geoImpact = new THREE.BoxGeometry(0.08, 0.08, 0.08);
    this._matImpact = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 1 });
    this._matImpactHead = new THREE.MeshBasicMaterial({ color: 0xff4444, transparent: true, opacity: 1 });
    this._geoBlood = new THREE.SphereGeometry(0.05, 4, 4);
    this._matBlood = new THREE.MeshBasicMaterial({ color: 0xcc2222, transparent: true, opacity: 0.85 });
    this._geoRing = new THREE.RingGeometry(0.1, 0.16, 12);
    this._matRing = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7, side: THREE.DoubleSide });
    // Geometría/material de trazadora (perezoso: solo si hay disparos)
    this._geoTracer = null;
    this._matTracer = null;
  }

  muzzleFlash(pos, dir, size = 1) {
    // Two-layer flash: glowing shell + hot core, at the muzzle tip.
    // `size` scales per weapon (shotgun blast vs pistol snap).
    const flash = new THREE.Mesh(this._geoMuzzle, this._matMuzzle.clone());
    flash.position.copy(pos).addScaledVector(dir, 0.10);
    flash.scale.set(1.6 * size, 1.6 * size, 2.4 * size);
    this.scene.add(flash);
    this._activeFlashes.push({ mesh: flash, life: 0.055, maxLife: 0.055 });

    // Clonado: el fade de update() muta opacity por partícula; con el
    // material compartido el primer tiro apagaba los siguientes.
    const core = new THREE.Mesh(this._geoMuzzleCore, this._matMuzzleCore.clone());
    core.position.copy(flash.position);
    this.scene.add(core);
    this._activeFlashes.push({ mesh: core, life: 0.04, maxLife: 0.04 });
  }

  impact(point, isHeadshot) {
    // Impact cube + expanding ring decal (always faces camera).
    // kind by surface: wall = pale concrete chip, body = warm red, head = hot red.
    const mat = (isHeadshot ? this._matImpactHead : this._matImpact).clone();
    const cube = new THREE.Mesh(this._geoImpact, mat);
    cube.position.copy(point);
    if (isHeadshot === null) { isHeadshot = false; mat.color.setHex(0xb8c4d4); } // wall chip
    this.scene.add(cube);
    this._activeImpacts.push({ mesh: cube, life: 0.36, maxLife: 0.36 });

    const ring = new THREE.Mesh(this._geoRing, this._matRing.clone());
    ring.position.copy(point);
    ring.quaternion.copy(this.camera.quaternion);
    this.scene.add(ring);
    this._activeRings.push({ mesh: ring, life: 0.22, maxLife: 0.22 });
  }

  // Tracer: a bright thin streak from the muzzle to the hit point. One mesh
  // per shot (additive, 60ms) — makes every shot READ as a bullet, not a
  // generic flash. Bots' tracers too: incoming fire is now visible.
  tracer(from, to) {
    const dir = new THREE.Vector3().subVectors(to, from);
    const len = dir.length();
    // A quemarropa el streak degenera en un tablón gigante frente a la cámara
    // (visto en gameplay real: cinta blanca cruzando la pantalla).
    if (len < 1.0) return;
    const geo = this._geoTracer || (this._geoTracer = new THREE.BoxGeometry(0.012, 0.012, 1));
    const mat = (this._matTracer || (this._matTracer = new THREE.MeshBasicMaterial({ color: 0xffe9a0, transparent: true, opacity: 0.85 }))).clone();
    const m = new THREE.Mesh(geo, mat);
    m.position.copy(from).addScaledVector(dir, 0.5);
    m.lookAt(to);
    m.scale.z = len;
    this.scene.add(m);
    this._activeFlashes.push({ mesh: m, life: 0.06, maxLife: 0.06, flat: true });
  }

  blood(point) {
    // A quemarropa las esferas nacen pegadas al objetivo y tapan la pantalla
    // entera de rojo (gameplay real). El feedback ya lo dan hitmarker+sonido.
    if (this.camera && point.distanceTo(this.camera.position) < 0.9) return;
    for(let i=0;i<5;i++){
      const mat = this._matBlood.clone();
      const p = new THREE.Mesh(this._geoBlood, mat);
      p.position.copy(point);
      p.position.y += 0.12;
      this.scene.add(p);
      const vel = new THREE.Vector3((Math.random()-0.5)*2.4, Math.random()*1.5+0.5, (Math.random()-0.5)*2.4);
      this._activeBloods.push({ mesh: p, vel, life: 0.42, maxLife: 0.42 });
    }
  }

  // Cada disparo crea 2–8 materiales clonados: sin dispose se acumulan en la
  // GPU y la partida larga (o el móvil modesto) se degrada.
  _killVFX(mesh) {
    this.scene.remove(mesh);
    if (mesh.material && mesh.material !== this._matMuzzleCore) mesh.material.dispose();
  }

  update(dt) {
    // Flashes
    for(let i=this._activeFlashes.length-1;i>=0;i--){
      const f = this._activeFlashes[i];
      f.life -= dt;
      if(f.life <= 0){ this._killVFX(f.mesh); this._activeFlashes.splice(i,1); }
      else if (f.mesh.material.transparent) {
        f.mesh.material.opacity = Math.max(0, f.life / f.maxLife) * 0.9;
      }
    }
    // Impacts
    for(let i=this._activeImpacts.length-1;i>=0;i--){
      const it = this._activeImpacts[i];
      it.life -= dt;
      if(it.life <= 0){ this._killVFX(it.mesh); this._activeImpacts.splice(i,1); }
      else { it.mesh.position.y += dt * 1.2; it.mesh.material.opacity = it.life / it.maxLife; it.mesh.rotation.x += dt*6; it.mesh.rotation.y += dt*4; }
    }
    // Rings
    for(let i=this._activeRings.length-1;i>=0;i--){
      const r = this._activeRings[i];
      r.life -= dt;
      if(r.life <= 0){ this._killVFX(r.mesh); this._activeRings.splice(i,1); }
      else {
        const k = 1 - r.life / r.maxLife;
        const s = 1 + k * 2.2;
        r.mesh.scale.set(s, s, s);
        r.mesh.material.opacity = (1 - k) * 0.7;
      }
    }
    // Blood
    for(let i=this._activeBloods.length-1;i>=0;i--){
      const b = this._activeBloods[i];
      b.life -= dt;
      if(b.life <= 0){ this._killVFX(b.mesh); this._activeBloods.splice(i,1); }
      else {
        b.mesh.position.addScaledVector(b.vel, dt);
        b.vel.y -= 9.8 * dt * 0.6;
        b.mesh.material.opacity = b.life / b.maxLife;
      }
    }
  }
}
