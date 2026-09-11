---
name: blockfire-animation-craft
description: >-
  Edición/jucio de animación, rig, IK o pose con fuente Blender + QA visual.
whenToUse: >-
  Cuando la tarea toca clips, rig, IK, poses, reload o locomoción.
---

# Animación

Fuente de verdad: `assets/animation_sources/<Clip>.blend`; el GLB es export. No
edites `.glb`/`.import` a mano. `ReloadRifle` y `ReloadPistol` son
`CRAFT_LOCKED`: no `--rebuild`.

Para craft interactivo usa primero la capacidad JIT mínima:
`bf_capability on blender` → `blender_exec` + `blender_screenshot`.
Loop normal: mirar → cambio focal → mirar. Si esas dos primitives no bastan,
apaga `blender` y activa `blender-full`; no conviven.

Guarda la fuente, exporta con `tools/bf blender <Clip>`, fuerza reimport Godot y
mira el runtime/QA relevante antes de cerrar. Una captura no mirada ni un export
sin runtime prueban calidad visual. Android solo cuando la conclusión dependa
del dispositivo.

Si Blender MCP no está disponible, repórtalo; no sustituyas silenciosamente el
craft interactivo por generación masiva.
