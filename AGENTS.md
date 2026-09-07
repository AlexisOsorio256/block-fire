# BLOCKFIRE — tarjeta operativa

Constitución: `PROJECT_RULES.md`. Hechos del producto: `README.md`.
Atribuciones: `CREDITS.md`. No se hacen commits ni pushes salvo petición
explícita.

## Arranque

1. Leer `PROJECT_RULES.md`, `README.md` y el código dueño del comportamiento.
2. Ejecutar `git status --short`, `git log --oneline -5` y `git diff --stat`.
3. Usar un único proceso Godot por comprobación; cerrar y verificar todo
   proceso iniciado antes de terminar.

## Producto y plataforma

Godot 4.7.2 Standard, GDScript, renderer Mobile y Android landscape-first.
Linux es el laboratorio autónomo; la validación física Android es la
autoridad de plataforma. No reabrir rutas Unity, web, PWA, WebView o
Capacitor.

Prioridades: estabilidad → gameplay → rendimiento → UX → inmersión →
features. Trabajar por frentes completos y mantener la suite existente.

## Dueños

| Área | Archivos principales |
|---|---|
| Arranque y escenas | `game/app.gd`, `game/app.tscn` |
| Partida, rondas y daño | `game/match/match.gd`, `game/match/*_rules.gd` |
| Jugador, cámara y aim assist | `game/player/player.gd` |
| Entrada táctil y layout | `game/input_setup.gd`, `game/ui/mobile_controls.gd`, `game/ui/control_editor.gd` |
| Armas | `game/weapons/weapon_controller.gd`, `game/data/weapon_definition.gd` |
| HUD y lobby | `game/ui/hud.gd`, `game/lobby/lobby.gd` |
| Personajes y bots | `game/characters/operator_visual.gd`, `game/bots/bot.gd` |
| Mundo y navegación | `game/world/arena.gd` |
| Ajustes y audio | `game/settings_store.gd`, `game/audio/*` |
| Suite DEV | `tests/smoke.gd`, `tools/run-*.sh`, `tools/test.sh` |
| Android | `project.godot`, `export_presets.cfg`, `tools/build-android.sh` |

Un solo escritor por dueño. `SettingsStore` es el único autoload; no crear
una capa de managers globales sin una necesidad demostrable.

## Verificación

Durante la iteración: prueba dirigida, sintaxis/importación y ejecución QA
con `--qa-squad`, `--qa-ffa`, `--qa-combat` o `--qa-editor`. Al cerrar:

- `BLOCKFIRE_GODOT=... tools/test.sh` y la suite completa actual;
- export Android con `tools/build-android.sh`;
- comprobación de APK y de procesos, sin editor, servidor, Gradle, adb o
  watchers abandonados;
- inspección visual de lobby, compra, combate y editor de controles cuando
  el cambio afecte presentación.

Lo no ejecutado se informa como `SIN VERIFICAR`. Las conclusiones derivadas
de logs o métricas son `INFERENCIA` cuando corresponda.

## Terminología

`HOTFIX`: parche mínimo para una causa concreta.
`FRENTE COMPLETO`: cierra una experiencia atravesando sus sistemas dueños.
`REFACTOR CAUSAL`: elimina una causa de bugs o caminos duplicados de forma
comprobable.
