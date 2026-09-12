# BLOCKFIRE — ARQUITECTURA

Mapa de dueños y contratos. Si algo aquí contradice el código, **el código
manda**: corrige este documento en el mismo commit. Para el estado operativo
del día usa `docs/CURRENT_STATE.md`; las reglas del proyecto viven en
`PROJECT_RULES.md`.

## Contratos que no se negocian

| Contrato | Dueño | Qué NO puede hacer la animación |
|---|---|---|
| Desplazamiento | `Player` / `Bot` (`CharacterBody3D`) | Decidir posición o velocidad. La animación **nunca** mueve al actor. |
| Gameplay de arma | `WeaponController` | Decidir munición, `reload_timer` o si la recarga termina. |
| Pose del personaje | `OperatorMotion` (clips) + `OperatorBody` (intención, mirada, IK) | Existir un segundo reloj de animación. `AnimationPlayer` es biblioteca/visor, nunca reloj. |
| Orden del frame del personaje | `OperatorVisual._process` (director) | Cambiar el orden: intención → clips → mirada → montaje → IK. Cada paso lo ejecuta su dueño y nadie más escribe el `Skeleton3D`. |
| Montaje de arma | `OperatorVisual` | Escribir la pose del cuerpo. Aquí sólo se decide DÓNDE va el arma. |
| HUD | `HUD` (observador) | Decidir gameplay. Solo lee señales. |
| Velocidad implícita del clip | `tools/make_anim_clips.py` → `locomotion_speeds.json` | Inventar una segunda tabla de velocidades. Gameplay declara la clase (`sprint_intent`) y la velocidad real; el clip se reproduce a `real / implícita`. |

## Mapa de dueños

| Sistema | Dueño (archivo) | Entradas | Salidas / fuente de verdad | Cómo se prueba | No modificar para |
|---|---|---|---|---|---|
| App | `game/app.gd`, `game/app.tscn` | flags `--qa-*`, señales de lobby/match | pantalla actual, tema | `tools/test.sh`, `--qa-ffa` | gameplay, UI |
| Match | `game/match/match.gd` + `*_rules.gd` | `configure()`, señales HUD/player | rondas, economía, respawn; estado en `match.gd` | `tools/test.sh` (smoke) | daño, IA, layout HUD |
| Player | `game/player/player.gd` | InputMap, `MobileControls`, SettingsStore | salud, velocidades 4.8/7.0/2.6, cámara y FOV | `tools/test.sh`, `qa_touch`, `tools/probe-player-feel.gd` | stats de arma, clips, texto HUD |
| Bot | `game/bots/bot.gd` + `bot_role.gd` | `match_context`, `NavigationAgent3D` | navegación y disparo; números por rol | `tools/test.sh`, `--qa-ffa` | spawns, daño, stats de arma |
| WeaponController | `game/weapons/weapon_controller.gd` + `game/data/weapons/*.tres` | `set_fire_held/aim_held/request_reload/switch_to` | munición, `reload_timer`, hitscan; definiciones en los `.tres` | `tools/test.sh` (incluye `probe-muzzle-frame`), `qa_fx_lab`, `qa_shot` | malla/pose del arma (eso es `WEAPON_CONFIG`) |
| OperatorVisual | `game/characters/operator_visual.gd` | estado de gameplay + `WeaponController` | contrato público del actor, orden del frame, montaje del arma; perfil visual en `WEAPON_CONFIG` | `tools/test.sh` (`animation_layers`), `qa_anim_lab`, `qa_shot`, `probe-ik-quality` | pose del cuerpo (eso es `OperatorBody`), clips |
| OperatorBody | `game/characters/operator_body.gd` | velocidad real del actor, intención de sprint/crouch/aim, timers del arma, puntos de agarre del montaje | intención de capa, giro de porte del torso, mirada suavizada, IK de los dos brazos, pose de muerte | `tools/test.sh` (`animation_layers`), `tools/probe-refactor-oracle.gd`, `tools/probe-weapon-framing.gd` | montaje del arma, qué ropa se ve, gameplay |
| OperatorMotion | `game/characters/operator_motion.gd` | velocidad local, intención de sprint, timers del arma | pose compuesta, pesos de capa, elección de clip | `tools/test.sh` (`animation_layers`), `qa_motion` | constantes de velocidad, geometría del clip |
| CharacterAsset | `game/characters/character_asset.gd` | el GLB del personaje (`operator_adult_lod.glb`) | esqueleto listo, malla reparada, clips instalados, puños de agarre, detalle de material (multiplica albedo: su media es el brillo de la prenda); cachés por asset | `tools/test.sh` (`_test_weapon_models_load`, `_test_character_material_contract`), `animation_layers` (`_test_repaired_mesh_replay`), `probe-build-cost`, `probe-weapon-load` | pose por fotograma, gameplay, cosméticos |
| Cosmetics | `game/characters/operator_wardrobe.gd` + `game/data/cosmetic_catalog.gd` + `settings_store.gd` | selección del lobby | módulos visibles, tono de piel, accesorios; datos en el catálogo | `tools/test.sh`, `qa_shot --wardrobe` | armas, pose |
| HUD | `game/ui/hud.gd` | señales de match/player/weapon | paneles, feedback de combate (hit marker, popups, aviso direccional de daño recibido), editor de controles | `qa_hud_lab`, `qa_shot`, `tools/test.sh` (`_test_damage_direction_contract`) | persistencia, reglas de match |
| MobileControls | `game/ui/mobile_controls.gd` + `control_editor.gd` | `InputEventScreenTouch/Drag` | vector de movimiento, look, FUEGO/ADS; layout en SettingsStore | `qa_touch`, `tools/test.sh` | matemática de cámara del player |
| Settings | `game/settings_store.gd` (único autoload) | dos UIs escriben | `values`, layout, loadout | `tools/test.sh` | layout de HUD/lobby |
| Arena | `game/world/arena.gd` | `build()` del match | geometría, spawns, navegación | `tools/test.sh`, `qa_perf`, `--qa-ffa` | selección de spawn, pathing de bots |
| CombatFX | `game/fx/combat_fx.gd` | `muzzle_burst/tracer/impact/shell_eject` | partículas y decals con pool | `qa_fx_lab` | posición de boca (eso es `muzzle_marker`) |
| CameraFX | `game/fx/camera_fx.gd` | `CameraFX.kick(...)` | trauma y FOV punch | `qa_shot` (visual) | posición/pivote de cámara (eso es `player.gd`) |
| Audio | `game/audio/combat_audio.gd` (dueño único: catálogo `SAMPLES`, caché, mezcla) + `game/settings_store.gd` (volúmenes) | claves lógicas (`stream("hit")`), ajustes `master/sfx` | buses `SFX`/`UI` en `default_bus_layout.tres`, samples en `assets/sfx/` | `tools/test.sh` (smoke: `_test_audio_contract`) | timing de gameplay |

## Dónde se configura cada cosa

- **Rifle / pistola / escopeta / SMG** (stats, coste, munición, `reload_time`):
  `game/data/weapons/<id>.tres`. Presentación del arma (modelo, montaje,
  agarre, boca, retroceso del cuerpo): `OperatorVisual.WEAPON_CONFIG`. Ese
  montaje deja el cañón en `+Z`, así que la derecha del tirador es `-X`: el
  casquillo sale por ahí y el fogonazo no puede girarse sobre `+X`
  (`tools/probe-muzzle-frame.gd` lo mide en las cuatro armas).
- **Retículo**: `game/ui/crosshair.gd` dibuja el cono de
  `WeaponController.current_spread()` proyectado con el FOV real de la cámara.
  El HUD sólo lo empuja: nadie recalcula dispersión fuera del arma.
- **Recarga visual**: clip por arma en `OperatorMotion.RELOAD_CLIP_BY_WEAPON`,
  recorrido de la mano en `assets/models/animation_library/reload_hand_path.json`
  (generado por `tools/make_anim_clips.py`).
- **Velocidades de locomotion**: `game/player/player.gd` (gameplay) y
  `tools/make_anim_clips.py` (velocidad implícita del clip). El contrato está
  en `tests/animation_layers.gd`.
- **Skins de arma**: `game/data/weapon_skin.gd` (`TINTS`). El lobby deriva su
  lista con `WeaponSkin.skin_names()`; no la dupliques.
- **Grano de las superficies del mundo** (muros, cajas, rocas, suelo y atrezzo
  del lobby): `game/world/world_grain.gd`. Una sola imagen cacheada por proceso
  para el mundo y el lobby (`WorldGrain.material(color, uv1_scale)`); el
  `uv1_scale` se elige por tamaño de superficie, porque el grano mide 64 px y el
  mismo valor estira la mancha en una caja de 6 m o la aplana por mipmap en una
  de 1,5 m.
- **Audio**: samples en `CombatAudio.SAMPLES` (única fuente de verdad; nadie
  escribe literales `res://assets/sfx/...`), buses en
  `game/audio/default_bus_layout.tres`, volúmenes (`master` + `sfx`, donde el
  bus `UI` de feedback sigue a `sfx`) en `SettingsStore._apply_audio()`.
  `ui.ogg` y `sfx_kill_banner.ogg` están reservados sin emisor.

## Fuentes vs generado

| Clase | Ruta | Regla |
|---|---|---|
| SOURCE (arte) | `assets/animation_sources/*.blend` | Se edita en **Blender interactivo** y se guarda. `ReloadRifle` y `ReloadPistol` están en `CRAFT_LOCKED`: `--rebuild` se niega a tocarlos. |
| RUNTIME (export) | `assets/models/animation_library/*.glb` | **No se edita a mano.** Sale de `blender --background --python tools/make_anim_clips.py` (modo export). |
| GENERATED DATA | `locomotion_speeds.json`, `reload_hand_path.json` | Los escribe el mismo pipeline. No los edites. |
| MODELO ACTIVO | `assets/models/skins/operator_adult_lod.glb` | Es la malla que usa el juego (`operator_visual.gd`). |
| QA | `captures/`, `tools/qa_*`, `tools/probe-*` | Salidas ignoradas por git; herramientas versionadas. |
| CACHÉ | `.godot/`, `*.import`, `*.uid` | Nunca a mano. |

## Descubrimiento de tests

| Si tocas… | Ejecuta |
|---|---|
| animación / clips / IK | `tools/bf test` + `tools/bf qa motion` + `tools/probe-reload-hand.gd` |
| controles táctiles / UI | `tools/bf qa touch` + `tools/bf test` |
| armas | `tools/bf test` (incluye `probe-muzzle-frame`) + `tools/bf qa fx` |
| presentación del arma / encuadre | `tools/probe-weapon-framing.gd` (necesita ventana: renderiza la vista real) + `tools/bf test` |
| mundo / arena | `tools/bf test` + `tools/bf qa perf` |
| HUD / lobby | `tools/bf qa hud` + `tools/bf test` |
| antes de publicar | `tools/bf test` + `tools/bf qa touch` + `tools/bf build android` |

La suite (`tests/smoke.gd`, `tests/regressions.gd`, `tests/animation_layers.gd`
`tools/probe-player-feel.gd` y `tools/probe-player-brake.gd`) es la puerta; los
`tools/qa_*` son las comprobaciones de experiencia y `tools/probe-*` son
mediciones de diagnóstico. Punto de entrada único: `tools/bf`.

## Presupuesto de arranque de partida

`OperatorVisual` construye el personaje en runtime: carga el GLB, repara los
pesos de las manos y genera el detalle de material. Nueve combatientes entran a
la vez, así que ese coste se multiplica por nueve. Medido con
`tools/probe-build-cost.gd` (Godot headless, sobremesa):

| | antes | ahora |
|---|---|---|
| 9 actores, `_build()` total | 15 505 ms | 1 611 ms |
| texturas de detalle generadas | 124 por proceso | 2 por proceso |

Dos cachés `static` lo sostienen, ambas en `character_asset.gd` porque son dato
derivado del ASSET (idéntico en cada actor, nunca por instancia):
`_DETAIL_TEXTURES` (dos mapas, uno de piel y otro de tejido) y `_REPAIR_CACHE`
(cirugía de pesos por superficie, indexada por la posición en la malla
reparada). Si se toca `repair_module_weights`, la prueba
`_test_repaired_mesh_replay` de `tests/animation_layers.gd` compara la malla del
actor en frío con la del que copia caché: deben ser idénticas.

## Refactor del personaje: cómo se prueba que no cambió nada

Mover código entre archivos sólo es aceptable si el resultado es IDÉNTICO, no
"parecido". La prueba es un número, no una impresión:

1. `tools/probe-refactor-oracle.gd` recorre un guion fijo (4 armas × andar,
   sprint, apuntar, agachado, recarga y frenada) y publica un hash de la pose de
   los 22 huesos, del montaje y de la boca de cañón. **Antes**: se anota el
   valor con el código viejo. **Después**: tiene que dar el mismo número.
   Medido en el split de `operator_visual.gd`: `1044286260` en ambos.
2. `tools/bf test`: smoke + regressions + animation_layers.
3. `tools/qa_shot.gd` en `--closeup`/`--cluster-bots`: mismo encuadre y diff de
   píxeles. Ojo: el render tiene jitter de temporal AA entre pasadas, así que la
   referencia es "mismo asset, mismo encuadre" (≈0,2 % de píxeles con delta > 1
   en el cierre de personaje), no "bytes iguales".

## Recetas

- **Editar una recarga**: abre `assets/animation_sources/ReloadRifle.blend` o
  `ReloadPistol.blend` en Blender, añade un cuerpo de visualización con
  `tools/bf_blender_body.py`, mueve claves en el Graph Editor, guarda y exporta
  con `blender --background --python tools/make_anim_clips.py -- ReloadRifle`.
  No uses `--rebuild`.
- **Ver la pose real**: `tools/bf qa motion --mode=reload --weapon=pistol`.
- **Medir el recorrido de la mano**: `tools/probe-reload-hand.gd` (imprime
  cuánto baja la mano por clase de arma).

## Cámara del jugador

`Player` conserva `look_yaw` como rumbo mundial. Orden de física: input/mirada →
velocidad/giro del cuerpo → `move_and_slide` → órbita/colisión de cámara. El
pivote hijo se compensa después del giro; la colisión limita tanto el destino
del brazo como la posición interpolada. `CameraFX` conserva la sacudida.
Auditoría y siguientes pasos medibles: `docs/PLAYER_FEEL_AUDIT.md`.

`OperatorBody` deriva frenada de velocidad planar real por snapshot físico;
no vuelve a derivarla por cada render. `OperatorMotion` sólo reacciona con
columna/cabeza: ni ancestros de pies ni reloj de zancada reciben el peso de
frenada. `OperatorVisual.revive` limpia el historial derivado.

`Player` excluye `CameraFX.applied_fov_punch()` al suavizar FOV base y vuelve a
sumarlo; `CameraFX` conserva su estado aditivo existente. Gate de recuperación,
pitch y contactos: `tools/probe-aim-coordination.gd` (por defecto toda la prueba;
`--capture` añade vistas de pose renderizadas).

En la etapa mirada, `OperatorBody` aplica el giro de pecho en espacio mundial
y publica `aim_basis` en espacio de modelo. El montaje consume ese mismo giro
antes del IK. La cabeza usa sólo la mirada residual. `OperatorMotion.aim_weight`
sigue siendo el único blend de entrada/salida; ningún ancestro de pies recibe
el giro. Los offsets de `WEAPON_CONFIG` se verifican contra alcance real de
muñecas, no sólo contra los puños dibujados en el arma.

Ese mismo giro incluye el **giro de porte** (`CARRY_STANCE_DEG`, `-18°`) que
`OperatorBody` añade al pecho mientras el actor no apunta ni dispara: con el
cañón paralelo al eje de cámara el arma quedaba tapada por el propio cuerpo en
la vista del jugador (`tools/probe-weapon-framing.gd`). Girar el torso —no el
montaje— mantiene hombros, codos y agarres en la misma relación, así que el IK
de apoyo sigue llegando; girar sólo el montaje despegaba la mano izquierda
(medido 14-51 mm). El peso de `aim` lo lleva a 0° en ADS y al disparar, y el
escaparate del lobby queda fuera. Los pies siguen sin recibir nada de esto.
