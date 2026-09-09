---
name: blockfire-animation-craft
description: >-
  Craft de animación BLOCKFIRE: fuentes .blend como autoridad, edición en
  Blender interactivo con blender-mcp, export GLB, CRAFT_LOCKED y QA motion.
whenToUse: >-
  Cualquier tarea que cree, ajuste o juzgue un clip de animación, rig, IK o
  pose (reload, sprint, slide, aim, respawn, armario).
---

# Craft de animación

## Autoridad y dirección del flujo

- La autoridad es `assets/animation_sources/<Clip>.blend`. El GLB exportado es
  un artefacto, no la fuente: nunca edites el GLB ni el `.import` a mano.
- Se edita en **Blender interactivo** (GUI + blender-mcp), no generando por
  script. `tools/make_anim_clips.py` existe para reconstrucciones masivas, no
  como camino normal de craft.
- `ReloadRifle` y `ReloadPistol` están en `CRAFT_LOCKED`: `--rebuild` se niega
  a tocarlos. Si el trabajo es sobre esos clips, el camino es la GUI.

## Activar Blender MCP (capacidad opcional)

Las tools de Blender **no** están cargadas por defecto: su esquema son ~7.4k
tokens que la mayoría de sesiones no necesita. Si el craft lo requiere:

1. `tools/bf doctor` — confirma `Blender MCP OK` (addon escuchando en
   `127.0.0.1:9876`, GUI abierta con el `.blend` correcto).
2. `bf_capability { action: "on", capability: "blender" }` — activa el puente.
   Sus tools aparecen como `mcp__blender__*` en el paso siguiente.
3. Trabaja. Al terminar, `bf_capability { action: "off", capability: "blender" }`
   para devolver el catálogo de tools a su estado estable.

Si el addon no responde, no inventes un camino alternativo silencioso: repórtalo
y decide con el usuario si se arregla la GUI o se cambia de estrategia.

## Ciclo de trabajo de un clip

1. Mira el estado actual antes de juzgar: `tools/bf qa motion --mode=reload
   --weapon=pistol` (u `--mode` / `--weapon` que correspondan).
2. Abre la fuente y el cuerpo de visualización:
   `tools/bf body ReloadRifle` añade el cuerpo al `.blend` de origen para poder
   juzgar el clip con contexto humano.
3. Edita en la GUI. Cambios pequeños y verificables; guarda la fuente.
4. Exporta no destructivo: `tools/bf blender ReloadRifle` (`.blend` → GLB).
5. Vuelve a mirar: QA motion + runtime en Godot. Un clip exportado no está
   verificado hasta que se ve en el juego.
6. Si el clip lo consume el jugador, comprueba que el contrato del arma/pose
   sigue cumpliéndose (dueño: `docs/ARCHITECTURE.md`, no esta skill).

## Evidencia de cierre para animación

- fuente `.blend` guardada y con el cambio (no solo el GLB),
- export ejecutado sin errores,
- `qa motion` del modo/arma afectados, mirado,
- runtime Godot (y Android si la tarea lo pedía),
- duración/velocidad declaradas coherentes con lo que se ve.

## Trampas

- Regenerar por script un clip que debía editarse a mano (y encima CRAFT_LOCKED).
- Juzgar un clip solo por el GLB o solo por el número de frames.
- Dejar Blender MCP activo toda la sesión "por si acaso": cuesta tokens en cada
  request y no aporta nada fuera del craft.
- Exportar sin guardar la fuente: el siguiente craft pierde el trabajo.
