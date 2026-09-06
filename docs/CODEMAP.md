# BLOCKFIRE — codemap

## Arranque y ciclo

src/main.js crea Game, instala la compuerta landscape y carga la suite o
capturas solo en DEV. src/core/Game.js ordena el ciclo, ronda, daño, respawn,
espectador y coordinación entre sistemas.

## Sistemas

- src/core/Input.js: teclado, ratón, Pointer Events, multitouch y liberación
  segura.
- src/core/ControlLayout.js: posiciones normalizadas, safe areas y editor.
- src/player/PlayerController.js: cámara, locomoción, gravedad, colisión y
  daño del jugador.
- src/combat/WeaponSystem.js: arsenal, munición, viewmodel, hitscan,
  oclusión, recoil y feedback.
- src/audio/AudioManager.js: samples licenciados y voces procedurales.
- src/bots/Bot.js / Navigation.js: percepción, roles, navegación y
  comportamiento por arma.
- src/world/Map.js / MapDecor.js: colliders, raycast, spawns y capa visual.
- src/characters/SoldierAvatar.js: GLB, rig, locomoción, equipo y fallback.
- src/ui/HUD.js / Lobby.js: interfaz, flujo de menú, banners y estudio.
- src/fx/: partículas, trazadoras y números de daño.

## Hot paths

Para entrada, mirar Input.js y PlayerController.js; para daño,
Game.applyDamage() y WeaponSystem.fire(); para espectador,
Game._startSpectating()/update; para arma visible,
WeaponSystem.update()/_updateWeaponMesh(); para personaje,
SoldierAvatar.create()/update() y Bot.attachAvatar().
