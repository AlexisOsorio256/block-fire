// Harness de capturas — ?capture=lobbybare|playing|combat|probe
// Herramienta de auditoría visual (reglas §8): pone el juego en la situación
// pedida para fotografiarlo siempre desde la misma situación.
import * as THREE from '../lib/three.module.js';

export function setupCapture(game, mode) {
  setTimeout(()=>{
    if(mode==='lobbybare'){
      // Auditoría visual del lobby 3D sin el velo del overlay
      document.getElementById('overlay').style.display = 'none';
    }
    if(mode==='playing'){
      game.startMatch();
      document.getElementById('overlay').classList.add('hidden');
      // acortar la fase de compra para la captura del combate
      game.phaseTime = 1.5;
    }
    if(mode==='combat'){
      game.startMatch();
      document.getElementById('overlay').classList.add('hidden');
      // combate REAL desde el frame 1: el headless swiftshader avanza ~1-2s
      // de juego por presupuesto (dt clamp 0.033/frame) — esperar la fase de
      // compra dejaba capturas "atrapadas en la tienda" (auditoría visual).
      game.phaseTime = 0.05;
      }
    if(mode==='probe' || mode==='combatprobe'){
      // SONDA NUMÉRICA (cero imágenes): pose de cámara del lobby + raycast
      // cámara→pecho del héroe contra TODA la escena. Identifica QUÉ objeto
      // ocluye al héroe (auditoría visual detectó un pilar; esto da nombre y
      // posición mundial del culpable). En 'combatprobe', perfila COMBATE
      // real (renderer.info: draw calls/triángulos/texturas + DPR activo).
      if (mode === 'combatprobe') { game.startMatch(); game.phaseTime = 0.05; document.getElementById('overlay').classList.add('hidden'); }
      else document.getElementById('overlay').style.display = 'none';
      const out = document.createElement('pre');
      out.id = 'capture-probe';
      out.style.cssText = 'position:fixed;left:0;top:0;z-index:999;color:#fff;background:#000;font:11px monospace';
      document.body.appendChild(out);
      const run = () => {
        const L = game.lobby;
        if (mode === 'probe' && (!L || !L.hero || !L._heroBox)) { setTimeout(run, 300); return; }
        if (mode === 'combatprobe' && game.phase !== 'combat') { setTimeout(run, 200); return; }
        const cam = game.camera;
        if (mode === 'probe') {
          L.applyCameraPose(cam);
          cam.updateMatrixWorld(true);
        }
        const payload = {};
        if (mode === 'probe') {
          const box = L._heroBox;
          const chest = new THREE.Vector3((box.min.x + box.max.x) / 2, (box.min.y + box.max.y) / 2, (box.min.z + box.max.z) / 2);
          const dir = chest.clone().sub(cam.position);
          const dist = dir.length();
          dir.normalize();
          const rc = new THREE.Raycaster(cam.position.clone(), dir, 0.1, dist - 0.05);
          const isHeroPart = (o) => { while (o) { if (o === L.hero.root) return true; o = o.parent; } return false; };
          const hits = rc.intersectObjects(game.scene.children, true).filter(h => !isHeroPart(h.object));
          payload.cam = cam.position.toArray().map(v => +v.toFixed(2));
          payload.chest = chest.toArray().map(v => +v.toFixed(2));
          payload.heroDist = +dist.toFixed(2);
          // FRENTE DEL HÉROE (datos, no conjetura): el visor del GLB está en
          // la cara — el vector pecho→visor es el frente. dot(frente, hacia
          // cámara) > 0 ⇒ el héroe MIRA a cámara; < 0 ⇒ le da la espalda.
          let visor = null;
          L.hero.root.traverse(o => { if (o.isMesh && /visor/i.test(o.name || '')) visor = visor || o; });
          if (visor) {
            const vp = visor.getWorldPosition(new THREE.Vector3());
            const face = vp.sub(chest).normalize();
            const toCam = cam.position.clone().sub(chest).normalize();
            payload.heroFaceDot = +face.dot(toCam).toFixed(3);
            // Ángulos en el plano XZ (atan2(x,z)): delta = cuánto hay que
            // girar AL héroe (rotation.y += delta) para que mire a cámara.
            const faceAng = Math.atan2(face.x, face.z);
            const camAng = Math.atan2(toCam.x, toCam.z);
            payload.faceAngle = +faceAng.toFixed(3);
            payload.camAngle = +camAng.toFixed(3);
            payload.neededYawDelta = +(camAng - faceAng).toFixed(3);
          }
          // Cañón del arma del héroe vs dirección a cámara (plano XZ)
          if (L.hero && L.hero.gunPivot) {
            const toCamXZ = cam.position.clone().sub(chest).setY(0).normalize();
            const barrel = L.hero.gunPivot.getWorldDirection(new THREE.Vector3()).negate();
            payload.heroBarrelDot = +barrel.dot(toCamXZ).toFixed(3);
            // DÓNDE está el arma y si es visible: posición mundial + box
            // NDC del wrap (si sale del encuadre u oculta, aquí se ve).
            const gWrap = L.hero.gunPivot.children[0];
            if (gWrap) {
              // Actualiza TODO el árbol antes de medir: la sonda corre fuera
              // del rAF (sin tick de animación) y las matrices de huesos
              // quedan en estado indeterminado → caja degenerada de mentira.
              game.scene.updateMatrixWorld(true);
              const gBox = new THREE.Box3().setFromObject(gWrap);
              const gC = gBox.getCenter(new THREE.Vector3());
              payload.gunWorld = [gC.x, gC.y, gC.z].map(v => +v.toFixed(2));
              payload.gunSize = gBox.getSize(new THREE.Vector3()).toArray().map(v => +v.toFixed(2));
              payload.gunVisible = gWrap.visible;
              payload.gunIsGlb = !!gWrap.userData.isGlb;
              payload.gunChildCount = gWrap.children.length;
              // Recuento de meshes bajo el wrap + sus matrixWorld scale
              let gm = 0; const ginfo = [];
              gWrap.traverse(o => {
                if (o.isMesh) {
                  gm++;
                  const p = o.geometry.attributes.position;
                  // muestra los extremos del AABB de VÉRTICES crudos (sin matrix)
                  const bb = new THREE.Box3();
                  for (let i = 0; i < Math.min(p.count, 4000); i++) {
                    bb.expandByPoint(new THREE.Vector3().fromBufferAttribute(p, i));
                  }
                  const size = bb.getSize(new THREE.Vector3());
                  const hasNaN = o.matrixWorld.some ? [...o.matrixWorld.elements].some(Number.isNaN) : false;
                  ginfo.push(`${o.name || '?'} vsize:${size.toArray().map(v => +v.toFixed(2))} nan:${hasNaN}`);
                }
              });
              payload.gunMeshes = gm; payload.gunMeshInfo = ginfo.slice(0, 6);
              // Centro NDC del CARGADOR (pieza emissive dorada): legibilidad
              // del contraste interno (juez ronda 3).
              let mag = null; gWrap.traverse(o => { if (o.isMesh && /magazine/i.test(o.name || '')) mag = mag || o; });
              if (mag) {
                const mBox = new THREE.Box3().setFromObject(mag);
                const mC = mBox.getCenter(new THREE.Vector3());
                const mN = mC.clone().project(cam);
                payload.magNdc = { x: +mN.x.toFixed(2), y: +mN.y.toFixed(2) };
              }
              // ¿Matrices NaN en el árbol del héroe? (una rotación corrompida
              // con NaN contrae la caja a 0: síntoma exacto observado)
              let nanNodes = 0;
              L.hero.root.traverse(o => { if (o.matrixWorld && [...o.matrixWorld.elements].some(Number.isNaN)) nanNodes++; });
              payload.nanNodes = nanNodes;
              // Escala de la cadena wrap→root: un hueso con scale 0 contrae
              // el arma a un punto (caja degenerada con vértices sanos).
              const chain = [];
              let n2 = gWrap;
              while (n2 && n2 !== L.hero.root) {
                chain.push(`${n2.name || n2.type} scale:${n2.scale.toArray().map(v => +v.toFixed(2))} pos:${n2.position.toArray().map(v => +v.toFixed(2))}`);
                n2 = n2.parent;
              }
              payload.gunChain = chain.slice(0, 8);
              // MATRIX WORLD del wrap y del mesh interior (el Box3 usa exactamente esto)
              payload.gunWrapMatrix = [...gWrap.matrixWorld.elements].map(v => +v.toFixed(3));
              const gObj = gWrap.children[0];
              if (gObj) {
                payload.gunObjMatrix = [...gObj.matrixWorld.elements].map(v => +v.toFixed(3));
                payload.gunObjScaleLocal = gObj.scale.toArray().map(v => +v.toFixed(3));
                payload.gunObjPosLocal = gObj.position.toArray().map(v => +v.toFixed(3));
                payload.gunObjRot = gObj.rotation.toArray().slice(0, 3).map(v => +v.toFixed(3));
              }
              // NDC del centro del arma con la cámara del lobby
              const gNdc = gC.clone().project(cam);
              payload.gunNdc = { x: +gNdc.x.toFixed(2), y: +gNdc.y.toFixed(2), z: +gNdc.z.toFixed(2) };
              // Frustum: ¿el arma está delante de la cámara?
              payload.gunAhead = cam.position.distanceTo(gC) < 20;
              // Visibilidad por rayo cámara→arma (¿algo la tapa?)
              const dirG = gC.clone().sub(cam.position);
              const dG = dirG.length(); dirG.normalize();
              const rcG = new THREE.Raycaster(cam.position.clone(), dirG, 0.1, dG - 0.03);
              const isGunPart = (o) => { while (o) { if (o === L.hero.root) return true; o = o.parent; } return false; };
              payload.gunOccluders = rcG.intersectObjects(game.scene.children, true).filter(h => !isGunPart(h.object)).length;
            }
          }
          // FRENTE NATIVO DEL MODELO (decisivo, sin ambigüedad de pose): la
          // cabeza es un HUESO y el visor una MALLA delante/detrás de ella.
          // visorOffsetLocal.z > 0 ⇒ frente nativo +Z; < 0 ⇒ −Z.
          if (game.lobby && game.lobby.hero) {
            // La plantilla vive en AvatarLib (no exportada): medimos el héroe
            // en pose idle pero a través de su esqueleto — la cabeza es un
            // HUESO (transformación confiada) y el visor una MALLA.
            let vMesh = null, headBone = null;
            L.hero.root.traverse(o => {
              if (o.isMesh && /visor/i.test(o.name || '') && !vMesh) vMesh = o;
              if (o.isBone && /Head$/i.test(o.name) && !headBone) headBone = o;
            });
            if (vMesh && headBone) {
              const vBox = new THREE.Box3().setFromObject(vMesh);
              const vC = vBox.getCenter(new THREE.Vector3());
              const hP = headBone.getWorldPosition(new THREE.Vector3());
              const inv = new THREE.Quaternion();
              L.hero.root.getWorldQuaternion(inv).invert();
              const local = vC.clone().sub(hP).applyQuaternion(inv);
              payload.visorOffsetLocal = { x: +local.x.toFixed(3), y: +local.y.toFixed(3), z: +local.z.toFixed(3) };
              // ¿MIRA a cámara? Delta angular (XZ) entre el frente medido
              // visor−cabeza (sin sesgo del arma) y la dirección a cámara.
              // 0 ⇒ frontal; ±π ⇒ de espaldas.
              const faceXZ = vC.clone().sub(hP); faceXZ.y = 0;
              if (faceXZ.lengthSq() > 1e-6) {
                const faceA = Math.atan2(faceXZ.x, faceXZ.z);
                const camA = Math.atan2(cam.position.x - hP.x, cam.position.z - hP.z);
                let d = (camA - faceA) % (2 * Math.PI);
                if (d > Math.PI) d -= 2 * Math.PI;
                if (d < -Math.PI) d += 2 * Math.PI;
                payload.faceToCamDelta = +d.toFixed(3);
              }
            }
          }
          payload.occluders = hits.slice(0, 10).map(h => ({
            d: +h.distance.toFixed(2),
            name: h.object.name || '(anon)',
            kind: h.object.type,
            point: h.point.toArray().map(v => +v.toFixed(1)),
          }));
        }
        // PERFILADO (reglas §18): medir, no declarar. Un render manual deja
        // en renderer.info los contadores del ÚLTIMO frame.
        game.renderer.render(game.scene, cam);
        const i = game.renderer.info;
        payload.profile = {
          drawCalls: i.render.calls,
          triangles: i.render.triangles,
          geometries: i.memory.geometries,
          textures: i.memory.textures,
          programs: i.programs ? i.programs.length : null,
          dpr: +game.renderer.getPixelRatio().toFixed(2),
          dprRange: game._dpr ? [game._dpr.min, game._dpr.max] : null,
          res: [window.innerWidth, window.innerHeight],
          mobileMode: !!game._isMobile,
          touchAssist: !!game._isTouchPlatform,
        };
        // ORIENTACIÓN (datos, no conjetura): el cañón del arma apunta a −Z
        // LOCAL del wrap (normalización makeHeldWeaponGlb). Dirección MUNDIAL
        // del cañón vs el frente esperado: dot ≈ +1 correcto, ≈ −1 volteado.
        const barrelDot = (avatar, expected) => {
          if (!avatar || !avatar.gunPivot || !expected) return null;
          const barrel = avatar.gunPivot.getWorldDirection(new THREE.Vector3()).negate();
          return +barrel.dot(expected).toFixed(3);
        };
        if (mode === 'combatprobe') {
          const b3 = game.bots.find(b => b.isAlive && b._avatar);
          if (b3) {
            const fwd = new THREE.Vector3(Math.sin(b3.yaw), 0, Math.cos(b3.yaw));
            payload.botBarrelDot = barrelDot(b3._avatar, fwd);
          }
        }
        out.textContent = JSON.stringify(payload);
      };
      run();
    }
  }, 600);
}
