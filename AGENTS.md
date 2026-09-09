# BLOCKFIRE — tarjeta operativa

Constitución: `PROJECT_RULES.md`. Hechos del producto: `README.md`.
Atribuciones: `CREDITS.md`. Commits y pushes: autorizados al cerrar una sesión
verificada (contrato del harness BLOCKFIRE, `harness/ARCHITECTURE.md`); no se
pide permiso para eso.

## Arranque (en este orden, son 5 minutos)

1. `PROJECT_RULES.md` — qué se puede y qué no.
2. `tools/bf doctor` — HEAD, Godot, Blender (+MCP), teléfono, armas y clips
   activos. No ejecuta suites largas.
3. `docs/ARCHITECTURE.md` — dueños, contratos, dónde se configura cada cosa y
   qué test lanzar según lo que toques.
4. `docs/CURRENT_STATE.md` — estado real de hoy: verde/rojo, P0, siguiente
   tarea. Es el único estado operativo; `docs/history/*` es histórico.
5. El código dueño del comportamiento. `git status --short`, `git log --oneline -5`.

No dupliques reglas: si algo está en `ARCHITECTURE.md`, enlázalo.

## Producto y plataforma

Godot 4.7.2 Standard, GDScript, renderer Mobile y Android landscape-first.
Linux es el laboratorio autónomo; la validación física Android es la
autoridad de plataforma. No reabrir rutas Unity, web, PWA, WebView o
Capacitor.

Prioridades: estabilidad → gameplay → rendimiento → UX → inmersión →
features. Trabajar por frentes completos y mantener la suite existente.

## Dueños

El mapa completo (entradas, salidas, fuente de verdad, test y "no modificar
para") está en `docs/ARCHITECTURE.md`. Resumen de un vistazo:

| Área | Archivos principales |
|---|---|
| Arranque y escenas | `game/app.gd`, `game/app.tscn` |
| Partida, rondas y daño | `game/match/match.gd`, `game/match/*_rules.gd` |
| Jugador, cámara y aim assist | `game/player/player.gd` |
| Entrada táctil y layout | `game/input_setup.gd`, `game/ui/mobile_controls.gd`, `game/ui/control_editor.gd` |
| Armas | `game/weapons/weapon_controller.gd`, `game/data/weapons/*.tres`, `game/data/weapon_definition.gd` |
| HUD y lobby | `game/ui/hud.gd`, `game/lobby/lobby.gd` |
| Pose, IK y armario | `game/characters/operator_visual.gd`, `game/characters/operator_motion.gd` |
| Bots | `game/bots/bot.gd`, `game/data/bot_role.gd` |
| Mundo y navegación | `game/world/arena.gd` |
| Ajustes y audio | `game/settings_store.gd`, `game/audio/*` |
| Suite DEV | `tests/*.gd`, `tools/bf`, `tools/test.sh` |
| Android | `project.godot`, `export_presets.cfg`, `tools/build-android.sh` |

Un solo escritor por dueño. `SettingsStore` es el único autoload; no crear
una capa de managers globales sin una necesidad demostrable.

## Verificación

Punto de entrada único: `tools/bf` (`doctor`, `test`, `qa <lo que tocas>`,
`build android`). Durante la iteración: prueba dirigida, sintaxis/importación y
`--qa-squad`, `--qa-ffa`, `--qa-combat` o `--qa-editor`. Al cerrar:

- `tools/bf test` (smoke + animation_layers) y `tools/bf qa touch`;
- `tools/bf build android`; instalar/lanzar en el teléfono si está conectado;
- comprobación de APK y de procesos, sin editor, servidor, Gradle, adb o
  watchers abandonados;
- inspección visual de lobby, compra, combate y editor de controles cuando
  el cambio afecte presentación.

Lo no ejecutado se informa como `SIN VERIFICAR`. Las conclusiones derivadas
de logs o métricas son `INFERENCIA` cuando corresponda.

## Animación (craft)

La autoridad es `assets/animation_sources/<Clip>.blend` y se edita en **Blender
interactivo** (GUI + blender-mcp), no generando por script. `ReloadRifle` y
`ReloadPistol` están en `CRAFT_LOCKED`: `--rebuild` se niega a tocarlos. El
export es no destructivo:

```
tools/bf body ReloadRifle                          # cuerpo visible en el viewport
tools/bf blender ReloadRifle                       # export .blend -> GLB
```

Antes de juzgar un clip, míralo: `tools/bf qa motion --mode=reload --weapon=pistol`.

## Terminología

`HOTFIX`: parche mínimo para una causa concreta.
`FRENTE COMPLETO`: cierra una experiencia atravesando sus sistemas dueños.
`REFACTOR CAUSAL`: elimina una causa de bugs o caminos duplicados de forma
comprobable.
