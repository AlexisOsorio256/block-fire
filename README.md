# BLOCKFIRE

FPS 3D blocky para PC y Android. Hoy es un prototipo local single-player: 1
humano + 7 bots FFA. El producto se reduce a un loop: **entrar → moverse →
encontrar → disparar → kill clara → respawn rápido → otra partida**.

Este archivo describe el estado del proyecto. Las reglas para modificarlo
están en [`PROJECT_RULES.md`](PROJECT_RULES.md). Antes de tocar código, lee
ambos, en ese orden.

## Estado canónico — 2026-08-30

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
src/ui/HUD.js                  HUD y kill feed
src/audio/AudioManager.js      audio procedural
```

No crear una segunda ruta para PC/móvil, jugador/bots, daño, armas o respawn.
Extiende el sistema dueño de la responsabilidad.

## Ejecutar y verificar

```bash
python3 -m http.server 8002 --bind 127.0.0.1 --directory /home/alex/Documentos/BlockFire
```

- `http://127.0.0.1:8002/` — partida normal.
- `?runTests=1` — smoke tests; no aceptar cambios si no marca 7/7 PASS.
- `?capture=playing` — partida iniciada para una captura.

`capturas/` contiene evidencia visual puntual, no documentación de producto.
El historial de decisiones y cambios es `git log` y GitHub; no mantener diarios
o logs narrativos dentro del repositorio. Actualiza este README solo al cambiar
el estado, alcance, arquitectura real, controles o verificación del proyecto.
