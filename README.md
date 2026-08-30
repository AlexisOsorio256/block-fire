# BLOCKFIRE — FPS 3D Blocky

> **FPS 3D pequeño, rápido y jugable.** 1 jugador + 7 bots en Free For All, 20 kills para ganar o 5 minutos. Movimiento arcade, disparo satisfactorio, respawn inmediato. PC (WASD+Mouse) y Móvil (joystick + botones) con la misma lógica.

---

## Qué es

BLOCKFIRE es un prototipo FPS 3D inspirado en la sensación de juegos como KUBOOM 3D (accesibilidad y ritmo) sin copiar mapas, armas, personajes ni UI. No es una demo técnica de cubos: es un FPS real desde el primer segundo.

**Objetivo del prototipo:** comprobar si es divertido entrar, moverse rápido, encontrar enemigos, disparar, matar y volver a hacerlo sin fricción.

---

## Core Loop

```
Entrar a partida (1 click)
↓
Moverte rápido (WASD / joystick + salto)
↓
Encontrar enemigo (mapa pequeño, encuentros <10s)
↓
Apuntar + Disparar (hitscan, recoil, hitmarker)
↓
Impacto (muzzle flash, sonido, sangre, shake)
↓
Kill (+1, sonido distinto, killfeed)
↓
Morir → Respawn 1.8s en spawn lejano
↓
Repetir hasta 20 kills o 5 min
```

---

## Controles

**PC:**
- `WASD` mover, `Shift` correr, `Space` saltar
- `Mouse` mirar (click para bloquear puntero), `Click izq` disparar, `Click der` apuntar
- `R` recargar, `1/2/3` o `Q/E` cambiar arma

**Móvil:**
- Izquierda: joystick virtual para mover
- Derecha: desliza para mirar
- Botones: ● disparar, ◎ apuntar, ↑ saltar, ↻ recargar, ⇄ cambiar arma

La lógica es la misma, solo cambia el origen del input (`KeyboardMouseInput` vs `TouchInput` → `PlayerController`).

---

## Armas (mismo sistema, datos distintos)

| Arma | Tipo | Daño | Cadencia | Cargador | Precisión | Pellets |
|------|------|------|----------|----------|-----------|---------|
| Rifle | auto | 24 | 0.11s | 30 | media | 1 |
| Pistola | semi | 28 | 0.32s | 12 | alta | 1 |
| Escopeta | semi | 14×6 | 0.72s | 6 | dispersa | 6 |

Headshot x2. Alcance: rifle 90, pistola 70, escopeta 22.

---

## Estado actual

**Prototipo FFA 8 jugadores (1 humano + 7 bots) — 1 mapa pequeño, 3 armas, 5 min / 20 kills**

- Movimiento rápido (5.2 / 7.0 sprint, salto 7.5, gravedad 22)
- Cámara FPS fluida (yaw/pitch, sensibilidad 0.0022, clamp)
- Disparo hitscan inmediato, recoil, crosshair y hitmarker con feedback
- Bots: wander → chase → attack, strafe, buscan objetivo, disparan, mueren, respawn
- Daño centralizado (`DamageSystem` via `applyDamage`), headshot x2
- Mapa 48×48 con 5 clusters de cobertura + plataformas, 8 spawns con jitter
- Audio procedural (Web Audio) sin assets pesados
- HUD mínimo: HP, munición, kills/deaths, timer
- 60fps objetivo, sombras suaves, niebla, pooling

**No tiene (a propósito):** tienda, skins, progresión, multiplayer online, ranking, clanes. Solo el núcleo.

---

## Cómo ejecutar

```bash
python3 -m http.server 8002 --directory /home/alex/Documentos/pulse-dam
# abrir http://localhost:8002
```

Click en `ENTRAR A PARTIDA` → en PC click en canvas para bloquear ratón → `ESC` para salir.

Parámetros:
- `?runTests=1` — 6 tests técnicos (game loads, move, fire, bots, map, HUD)
- `?capture=playing` — fuerza estado `PLAYING` para screenshots

---

## Arquitectura (para que la IA no se pierda)

```
src/
  core/
    Game.js         # Scene, renderer, luces, loop, match (FFA 20 kills / 5 min), respawn
    Input.js        # Abstrae KeyboardMouseInput y TouchInput → {move, look, fire, jump...}
  player/
    PlayerController.js # Movimiento, gravedad, salto, colisión AABB, cámara FPS
  combat/
    WeaponSystem.js # WeaponData (rifle/pistol/shotgun) + hitscan raycast + recoil + munición
  bots/
    Bot.js          # Mesh blocky, vida, estados wander/chase/attack, strafe, disparo
  world/
    Map.js          # Ground + 4 paredes + 5 clusters + plataformas + 8 spawns + colisión/Occlusión
  ui/
    HUD.js          # HP, ammo, kills, timer, killfeed, debug
  audio/
    AudioManager.js # Web Audio procedural (shoot/hit/kill/reload)
  main.js           # Entry, expone window.__BLOCKFIRE__

index.html          # Importmap three@0.160.0, HUD, mobile controls, overlay
style.css           # HUD + mobile joystick + overlay
capturas/           # Evidencia visual (vacía hasta generar)
```

**Principios:**
- Pocos sistemas, responsabilidades claras, sin frameworks gigantes
- Datos + Sistemas separados (`WeaponData` vs `WeaponSystem`)
- Humanos y bots usan **el mismo** `WeaponSystem` (no duplicar lógica)
- PC y móvil solo cambian `Input`, no `PlayerController`
- Archivos pequeños (<400 líneas), sin sobreingeniería

---

## Capturas

Vacío hasta generar. Para crear:
```bash
chromium --headless --virtual-time-budget=3000 --window-size=1280,800 --screenshot=/tmp/bf.png http://localhost:8002/?capture=playing
```

---

*Última actualización: 2026-08-30 — BLOCKFIRE prototipo FFA 8 jugadores. 1 jugador + 7 bots, 20 kills, 5 min, PC+Móvil.*
