# BLOCKFIRE — codemap

## Arranque y flujo

`game/app.gd` carga lobby o partida y reconoce los modos QA. La escena raíz es
`game/app.tscn`; `SettingsStore` es el único autoload. `game/match/match.gd`
orquesta compra, combate, muerte, respawn, espectador, score y retry.

## Sistemas dueños

- `game/player/player.gd`: CharacterBody3D, cámara, movimiento, 200 HP,
  daño/muerte y aim assist móvil con cono y línea de visión.
- `game/ui/mobile_controls.gd`: ownership por pointer, multitouch, joystick,
  mirada, fuego-arrastre, botones y liberación segura.
- `game/ui/control_editor.gd`: edición táctil de posición, escala y opacidad
  dentro de safe area; persiste en `SettingsStore`.
- `game/weapons/weapon_controller.gd`: cuatro armas, munición derivada de
  `.tres`, loadout disponible, cadencia, hitscan, oclusión, recoil, ADS,
  viewmodel, muzzle anchor, audio y skin.
- `game/bots/bot.gd`: percepción, roles, selección de enemigo, combate y
  movimiento mediante `NavigationAgent3D`.
- `game/world/arena.gd`: geometría, colliders, cobertura, iluminación,
  navegación y línea de visión.
- `game/ui/hud.gd`: score por modo, ronda, compra, salud, munición, crosshair,
  banners, daño, espectador, fin de partida y controles móviles.
- `game/lobby/lobby.gd`: selección de modo, operador, skin, ajustes y entrada
  a la partida.
- `game/audio/default_bus_layout.tres` y `game/settings_store.gd`: buses,
  volumen y preferencias locales.
- `game/characters/operator_visual.gd`: rig humanoide animado de Quaternius,
  tintes/equipo, marcador de equipo, clips de locomoción/muerte y fallback.

## Datos y verificación

`game/data/` contiene definiciones de operadores, roles y armas; `assets/`
contiene modelos, texturas y audio licenciados. `tests/smoke.gd` comprueba
contratos de input, match rules, arsenal, aim assist, operadores y editor.
`tools/run-game.sh` ejecuta laboratorio; `tools/build-android.sh` produce el
APK.

## Hot paths

Para input: `mobile_controls.gd` → `player.gd`. Para disparo:
`weapon_controller.gd` → raycast → `match.gd`/objetivo. Para bots:
`bot.gd` → `arena.gd`. Para flujo: `app.gd` → `lobby.gd` → `match.gd` →
`hud.gd`.
