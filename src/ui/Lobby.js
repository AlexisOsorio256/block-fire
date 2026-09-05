import * as THREE from '../lib/three.module.js';
import { AvatarLib } from '../characters/SoldierAvatar.js';

// ── Lobby — la ESCENA 3D del menú: pedestal + héroe GLB + foco + chips de skins ──
// Dueña exclusiva de la puesta en escena del lobby. El ESTADO (globalSkin,
// skinsFor) vive en Game; Lobby pinta y delega las decisiones hacia arriba.
// El GLB llena el héroe al cargar (fallback: pedestal vacío, nunca un crash).

export class Lobby {
  constructor(game) {
    this.g = game;
    const scene = game.scene;
    const group = new THREE.Group();
    // Héroe a la DERECHA del plano (el panel del lobby ocupa la izquierda):
    // cámara mirando al héroe desplazado — composición estilo Free Fire.
    group.position.set(2.6, 0, 5.2);
    scene.add(group);
    this.group = group;
    const pedMat = new THREE.MeshStandardMaterial({ color: 0x1a2233, roughness: 0.6, metalness: 0.3 });
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.9, 0.22, 24), pedMat);
    ped.position.y = 0.11;
    ped.receiveShadow = true;
    group.add(ped);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.55 });
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.55, 1.75, 40), ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.225;
    group.add(ring);
    this.ringMat = ringMat;
    this.hero = null;
    this.gun = null;
    this.spot = null;
  }

  // Héroe del lobby: soldado GLB con arma, idle, giro suave
  buildHero() {
    const gun = AvatarLib.makeHeldWeapon('rifle', 0xffd23f);
    const av = AvatarLib.create({ team: 'hero', weapon: gun });
    if (!av) { console.error('[Lobby] avatar no creado'); return; }
    this.hero = av;
    this.gun = gun;
    av.root.scale.setScalar(1.22); // presencia: el héroe debe lucir tras el velo
    av.root.position.set(0, 0.22, 0);
    this.group.add(av.root);
    // Foco dorado sobre el héroe (1 luz sin sombras: el velo del overlay lo
    // apagaba y "no lucía").
    if (!this.spot) {
      this.spot = new THREE.PointLight(0xffd9a0, 12, 12, 1.6);
      this.spot.position.set(2.6, 3.2, 6.4);
      this.g.scene.add(this.spot);
    }
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

  // El pedestal es decorado del lobby: oculto en partida (confundía:
  // un "noveno" soldado dorado en medio de la arena).
  setVisible(v) { this.group.visible = v; }

  // Animación del lobby (desde Game.animate mientras matchState !== 'PLAYING').
  tick(dt, t) {
    if (this.hero) {
      this.hero.update(Math.min(dt, 0.033));
      this.hero.root.rotation.y = Math.PI + Math.sin(t * 0.35) * 0.5;
    }
    if (this.ringMat) this.ringMat.opacity = 0.4 + Math.sin(t * 2.2) * 0.18;
  }
}
