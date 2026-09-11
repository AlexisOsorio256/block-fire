---
name: blockfire-animation-craft
description: >-
  Diagnóstico y mejora de animación, locomoción TPS y gamefeel: gameplay,
  mezcla runtime o clip Blender, con evidencia visual comparable.
whenToUse: >-
  Cuando la tarea toca clips, rig, IK, poses, reload, locomoción o rigidez,
  popping y sliding del movimiento; también si pide movimiento tipo Free Fire.
---

# Animación

Fuente de verdad: `assets/animation_sources/<Clip>.blend`; el GLB es export. No
edites `.glb`/`.import` a mano. `ReloadRifle` y `ReloadPistol` son
`CRAFT_LOCKED`: no `--rebuild`.

Primero identifica dónde nace el defecto:

- Input, velocidad o intención no llega: `game/player/player.gd` y
  `OperatorVisual.set_combat_state()` / `_read_motion_inputs()`.
- Clip correcto aislado, pero transición/torso falla: `operator_motion.gd`.
- Pose final, montaje de arma o agarre: orden de capas/IK en `operator_visual.gd`.
- El defecto existe en el clip aislado: edita su `.blend` en Blender.

En locomoción consulta [la receta de runtime](references/locomotion.md): incluye
comandos, fases comparables y límites del laboratorio. Mira primero el defecto,
plantea una causa comprobable y haz un cambio focal; vuelve a mirar la misma
secuencia. Preserva velocidades y foot-lock salvo cambio de gameplay pedido.
Dos intentos sin evidencia nueva son señal para revisar la hipótesis o entregar
el caso a revisión, no para seguir afinando números a ciegas.

Para editar el clip, activa `bf_capability` con
`{"action":"on","capability":"blender"}`: `blender_exec` +
`blender_screenshot`. Python también permite consultar escena, huesos y curvas;
no hace falta el MCP completo para esas consultas. Si falta una capacidad real,
apaga `blender` y activa `blender-full`; no conviven.

Guarda la fuente, exporta con `tools/bf blender <Clip>`, fuerza reimport Godot y
mira el runtime/QA relevante antes de cerrar. Una captura no mirada ni un export
sin runtime prueban calidad visual. Android solo cuando la conclusión dependa
del dispositivo.

Si Blender MCP no está disponible, repórtalo; no sustituyas silenciosamente el
craft interactivo por generación masiva.

La imagen tiene que llegar al modelo: usa `read_image` para PNG de Godot y
`blender_screenshot` para el viewport. Un path, un MP4 generado o un mensaje de
imagen no disponible no permiten juzgar calidad. Si falla la ruta visual,
continúa las pruebas numéricas útiles y deja el juicio visual sin verificar.
