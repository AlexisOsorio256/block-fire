# Handover de animación — BLOCKFIRE (post-Astra)

Sesión DeepSeek V4.1 Flash que continúa el commit `424b638` de Astra.
Trabajo **sin commit ni push** (pendiente de autorización del usuario).

## 1. Arquitectura final (no romper)

`INPUTS (gameplay) → OperatorMotion (compositor) → pose base → capas →
commit → OperatorVisual (mirada → montaje de arma → IK → manos)`.

- Un solo dueño de la pose: `game/characters/operator_motion.gd`.
  `AnimationPlayer.active = false`: es biblioteca de clips, nunca reloj.
- Orden fijo: clips/capas ANTES del IK, porque las manos resuelven contra la
  pose corporal final.
- Gameplay declara y la animación consume: velocidad real (m/s) + **clase de
  velocidad** (`sprint_intent`). Ver `player.gd:134`, `bot.gd:144`.
- Contratos preservados: reload cancelado por switch, daño no cancela reload,
  recoil sólo con disparo confirmado, death captura pose y bloquea todo,
  revive limpia canales.

## 2. Fuente autoritativa de una animación (la respuesta única)

**`assets/animation_sources/<Clip>.blend`**. Se abre en Blender, se mueven
claves, se guarda y se exporta:

```bash
blender --background --python tools/make_anim_clips.py                 # exporta todos los .blend
blender --background --python tools/make_anim_clips.py -- Reload Land  # exporta dos
blender --background --python tools/make_anim_clips.py -- --rebuild WalkFwd  # regenera (DESTRUCTIVO)
blender --background --python tools/make_anim_clips.py -- --verify    # audita sin tocar
```

- `tools/make_anim_clips.py` es **generador (--rebuild)** y **exportador
  (por defecto)**. El exportador nunca regenera un clip que ya tiene fuente:
  una edición a mano sobrevive.
- La velocidad de suelo de cada clip se declara UNA vez en `GAIT` (m/s reales
  de gameplay) y se escribe a `assets/models/animation_library/locomotion_speeds.json`,
  que el runtime lee. No hay segunda verdad.
- La trayectoria de la palma de recarga se declara en `PALM_KEYS` y se escribe
  a `reload_hand_path.json`: mismo dato para el marcador de Blender y para el
  IK de runtime.
- Dentro del `.blend` la acción está **horneada** (154 curvas: 22 huesos ×
  rotación + traslación de Root/Body/Foot). Las constraints IK se eliminan tras
  hornear, así que las curvas son la autoridad y los empties `Contact.*`,
  `Ankle.*`, `KneePlane.*` y `ReloadPalmPath` quedan como referencia visual de
  la trayectoria autorada. Para retocar un clip: Graph Editor / Dope Sheet sobre
  el hueso y volver a exportar. Para re-autorar desde cero: `--rebuild`.
- Blender MCP (addon en `localhost:9876`) sigue activo para inspeccionar y
  editar en vivo; el trabajo de esta sesión se hizo con el cliente del socket
  y con `blender --background`.

## 3. Clips

| Clip | Estado | Velocidad declarada | Notas |
|---|---|---|---|
| WalkFwd | nuevo | 4.8 m/s | jog de 0.517 s, cadencia 3.86 pasos/s |
| SprintFwd | nuevo | 7.0 m/s | 0.417 s, 4.8 pasos/s, inclinación 20° |
| StrafeLeft/Right | rehechos | 4.8 m/s | desplazamiento lateral real |
| BackWalk | rehecho | 4.8 m/s | |
| CrouchWalk/Left/Right/Back | rehechos | 2.6 m/s | postura −0.30 m |
| CrouchIdle | rehecho | — | respiración |
| Reload | 2ª pasada | 1.8 s normalizado | torso/cabeza/hombro autorados + palm path |
| JumpStart | 2ª pasada | 0.30 s | anticipación → empuje → suelta |
| AirLoop | 2ª pasada | 0.80 s | piernas asimétricas, sin ciclo |
| Land | 2ª pasada | 0.47 s | contacto → compresión → recuperación |
| Flinch | 2ª pasada | 0.40 s | aditivo, no stun |

Pendiente: recarga específica por arma (hoy una sola para las 4), death por
tipo de impacto, y variantes de ADS por arma.

## 4. Verificación (todo ejecutado en esta sesión)

```bash
BLOCKFIRE_GODOT=... tools/test.sh          # smoke 204 checks + animation_layers
godot --headless --path . --script res://tests/animation_layers.gd
godot --headless --path . --script res://tools/qa_touch.gd
```

- `tests/smoke.gd`: **PASS** (204 checks).
- `tests/animation_layers.gd`: **PASS**, ya integrado en `tools/test.sh`
  (dos suites, un proceso Godot por suite).
- Patinaje horizontal del pie de apoyo medido en runtime:
  walk **0.00 m/s**, sprint 0.69 m/s, strafe 0.47 m/s (peor fotograma de
  aterrizaje).
- IK auditado con `tools/probe-ik-quality.gd` (4 armas × HIP/ADS/RELOAD/STRAFE/
  CROUCH, 240 fotogramas): codo mínimo 41.6°, máximo 152.2°, **flip de plano
  máximo 5.0°/fotograma**, extensión máxima 0.936 de la longitud de brazo (sin
  hiperextensión), puño a 0.075 m de la muñeca (el offset de palma diseñado).
- Vídeo/fotogramas: `captures/post-astra/final/` (4 vistas de la secuencia +
  locomoción + recarga + aire + 4 armas en combate, con `.mp4` por vista) y el
  baseline de Astra en `captures/post-astra/baseline/`.
- `tools/qa_touch.gd`: **FAIL 9 comprobaciones, PRE-EXISTENTE**. Astra no tocó
  ese camino (`mobile_controls.gd`, `weapon_controller.gd`, `app.gd` y
  `qa_touch.gd` no aparecen en su diff). Fuera del frente de animación.

## 5. Android

- `tools/build-android.sh` → `builds/blockfire-debug.apk` (87 MB, firmado y
  verificado). Contiene `locomotion_speeds.json` y `reload_hand_path.json`
  (`export_presets.cfg` actualizado).
- **Validación en dispositivo: BLOQUEADA.** `adb devices -l` no lista ningún
  dispositivo y no hay Android por USB (`lsusb` sólo muestra ratón y webcam).
  Sin dispositivo autorizado no se instaló, no se lanzó y no hay vídeo Android.

## 6. Rendimiento

- `tools/qa_perf.gd --qa-ffa` (1 jugador + 7 bots, Intel HD 520): **48.9 fps
  medios** (pico 58), 56 draw calls, 835 k primitivas.
- Coste del compositor medido con `tools/probe-motion-cost.gd` (8 actores,
  4 armas, idle/walk/sprint/strafe/crouch/reload/air): **330 µs por actor y
  fotograma → 2.64 ms/frame** (15.8 % de un fotograma de 60 fps). Bajó de
  385 µs al reutilizar buffers de pose y escribir sólo los huesos animados.
  El coste restante son las interpolaciones de pista del `Animation` de Godot.

## 7. Deuda restante

1. Recarga por arma (pistola no debe recargar como rifle).
2. Vídeo/validación en teléfono (bloqueado por falta de dispositivo).
3. Mezcla de diagonales: coherente en fase, pero el clip lateral cruza el pie
   de arrastre; a 4.8 m/s laterales es lo físicamente posible con estas piernas.
4. Crouch lateral a 2.6 m/s obliga a cruce de pies.
5. `qa_touch.gd` sigue en rojo (fuera de este frente).
6. Alcance del rig: piernas de 0.866 m contra 4.8 m/s obligan a cadencia alta
   (3.86 pasos/s) y a bajar el centro de masa ~0.11 m. Es geometría, no estilo:
   para un paso más lento habría que bajar la velocidad de gameplay.
