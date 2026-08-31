# BLOCKFIRE

FPS 3D blocky para PC y Android. Hoy es un prototipo local single-player: 1
humano + 7 bots FFA. El producto se reduce a un loop: **entrar → moverse →
encontrar → disparar → kill clara → respawn rápido → otra partida**.

Este archivo describe el estado del proyecto. Las reglas para modificarlo
están en [`PROJECT_RULES.md`](PROJECT_RULES.md). Antes de tocar código, lee
ambos, en ese orden.

## Estado canónico — 2026-08-30 (post game-feel polish)

- Prototipo local, sin build, empaquetador Android ni dependencias de npm: se
  sirve como archivos ES modules estáticos. Android es una plataforma objetivo,
  no una app ya implementada.
- Una partida termina al llegar a 20 kills o a los 5 minutos.
- Mapa cuadrado de **96 × 96 unidades** (`Map.size = 48` es el semiextento),
  con cobertura, plataformas y 8 puntos de spawn.
- Tres armas: rifle, pistola y escopeta. Un único `WeaponSystem` resuelve
  hitscan, daño, oclusión y feedback; jugador y bots comparten esa lógica.
- PC: WASD, mouse, click para disparar, botón derecho para apuntar, R y 1–3.
  Móvil: joystick, arrastre de cámara y botones.
- La suite mínima es `?runTests=1`: **7/7 PASS**. Incluye carga, movimiento,
  disparo, HUD, mapa, bots y una kill que actualiza el marcador.

### Convenciones espaciales (importantes para IA)

- `position.y` de jugador y bots es la **altura del ojo**; los pies están en
  `y - height` (`height = 1.65`). Los meshes se colocan con los pies en
  `getGroundY()`; nunca con offsets mágicos.
- `Map.getGroundY(x, z, feetY, stepUp)` solo acepta plataformas alcanzables
  desde `feetY` (evita teletransportes sobre plataformas al pasar debajo).
- `Map.raycast` usa slab ray-AABB exacto: la oclusión se comprueba **antes**
  de aplicar daño, para jugador y bots por igual.
- Los hitboxes (cuerpo/cabeza) se miden hacia **abajo** desde el ojo
  (`WeaponSystem.fire`): cabeza ≈ `eye − 0.10`, torso ≈ `eye − 0.63`.

### Game feel implementado

- Movimiento arcade rápido: 6.0 u/s base, 7.8 sprint, salto 8.2, gravedad 26;
  aceleración/fricción separadas (95% de velocidad en ~17 ms), air-control,
  strafe-roll sutil de cámara y head-bob mínimo.
- ADS con zoom de FOV + centrado del viewmodel + spread reducido (un solo
  input de apuntado, sin segundo modelo de movimiento).
- Recoil en dos capas: kick del viewmodel + pitch/yaw de cámara vía
  `PlayerController.addRecoil`.
- Kill feedback: banner central "ELIMINADO / +100" con pop CSS, mini-banner
  de HEADSHOT, hitstop de 55 ms al 45% de timescale, screen shake de ~0.25 s,
  hitmarker de 4 ticks y kill feed lateral.
- Audio 100% procedural (WebAudio, sin assets): disparos con ruido filtrado +
  cuerpo, headshot con crack agudo, kill de dos notas, hurt, death, respawn,
  reload start/end, switch, dry-fire, UI. Master con compresor.
- Iluminación de día arcade: cielo `#87b5e8`, hemisferio 1.15, sol 1.35 con
  sombras 1024, fill frío; suelo gris claro, cobertura en tonos arena, y
  plataformas verdes; bots saturados con visor emisivo para destacar.
- Lobby: overlay mínimo (título + JUGAR) con la arena real detrás — cámara
  orbital lenta con bots patrullando como fondo vivo.
- HUD: kills+timer arriba; vida y munición abajo (en móvil se elevan para no
  chocar con joystick/botones); crosshair de 4 ticks.

No hay multijugador, cuentas, economía, inventario, progresión, tienda ni
sistemas de contenido. No asumir que existen.

## Arquitectura actual

```
src/main.js                    arranque y smoke tests
src/core/Game.js               escena, ciclo, partida, daño y VFX
src/core/Input.js              teclado/mouse/táctil → acciones neutrales
src/player/PlayerController.js movimiento, cámara, gravedad y respawn humano
src/combat/WeaponSystem.js     datos de armas, hitscan, munición y feedback
src/bots/Bot.js                IA simple: wander → chase → attack
src/world/Map.js               geometría, spawns, colisión y raycast
src/ui/HUD.js                  HUD, kill feed y banners de feedback
src/audio/AudioManager.js      audio procedural
```

No crear una segunda ruta para PC/móvil, jugador/bots, daño, armas o respawn.
Extiende el sistema dueño de la responsabilidad.

## Ejecutar y verificar

```bash
python3 -m http.server 8002 --bind 127.0.0.1 --directory /home/alex/Documentos/BlockFire
```

- `http://127.0.0.1:8002/` — lobby + partida normal.
- `?runTests=1` — smoke tests; no aceptar cambios si no marca 7/7 PASS.
- `?capture=playing` — partida iniciada para una captura.

`capturas/` contiene evidencia visual puntual, no documentación de producto.
El historial de decisiones y cambios es `git log` y GitHub; no mantener diarios
o logs narrativos dentro del repositorio. Actualiza este README solo al cambiar
el estado, alcance, arquitectura real, controles o verificación del proyecto.
