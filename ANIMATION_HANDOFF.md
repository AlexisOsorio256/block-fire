# Continuación inmediata — agarre y strafe

Base: `9f9818e`. Verificación final completada; cambios preparados para commit y push.

Resultado final: smoke 296 PASS, animation_layers PASS. Foot slide walk/sprint/left/right: 0.12/0.01/0.17/0.109 m/s. STRAFE_GRIP socket 0.000 mm, barrel_alignment 1.000000. Capturas finales completadas e inspeccionadas: `final-reversal.png` (frames 178..205, inversión a 6 s), además del agarre lateral comparado.
No releer documentación ni abrir otros frentes. No tocar harness/ ni recargas CRAFT_LOCKED.

## Cambios hechos

- `operator_visual.gd`: mano izquierda del rifle en guardamanos (antes bajo el cargador), palma abierta por dentro con dedos/ pulgar alrededor; socket explícito de muñeca. Montaje acercado y ADS bajado para conservar alcance sin meter culata en cabeza. Segunda iteración conservada.
- `StrafeLeft.blend` y `StrafeRight.blend`: inclinación lateral de cadera 8° ±2.5°, contrapeso de torso/cuello y compensación de brazos. Editadas mediante Blender GUI/MCP, guardadas, exportadas con `tools/bf blender StrafeLeft StrafeRight` y reimportadas mediante Godot `--headless --editor --import`.
- Comparación contra fuentes base en Blender: SOLO rotaciones Hips/Torso/Neck/UpperArm.L/R cambiadas; todas las curvas de piernas, pies, posiciones y tiempos idénticas; cierre de bucle 0.0.
- `operator_motion.gd`: el nuevo test derecho encontró que `lerp(...).normalized()` no sale de vectores exactamente opuestos: seguía reproduciendo izquierda al moverse a derecha, deslizamiento 9.60 m/s. Cambiado a interpolación angular; inversión lateral pasa por adelante. Esta es la última corrección; suite y secuencia de inversión verificadas.
- `tests/animation_layers.gd`: añade deslizamiento derecho y distancia muñeca/socket + orientación del cañón en ambos strafes/ADS.
- `tools/probe-ik-quality.gd`: añade error del socket y distancia palma/guardamanos.

## Evidencia existente e inspeccionada

`captures/support-strafe/before-front/` y `after-front/`: locomotion frontal, 8 s, 30 Hz. `before-side/` y `after-side/`: combat lateral, 4 s, 30 Hz. Mismos ángulos y fotogramas. `after-q34/`: locomotion 3/4.
`grip-compare.png`: antes/después lateral, frame 50 (1.667 s), ya mirado; mejora clara del apoyo.
`strafe-phases.png`: secuencia frontal comparada, ya mirada, pero es ANTERIOR al último arreglo del filtro de dirección: regenerar si se usa como evidencia final de inversión.

Medida reproducible: `tools/bf qa ik`. Palma a referencia de superficie inferior del guardamanos: antes 78.364 mm, después 2.033 mm (proxy AABB, no sustituye juicio visual). Socket muñeca: HIP ~0 mm, ADS 7.8 mm, reload 12.6 mm en probe previo al último filtro. Mano rodea guardamanos en vez de atravesarlo con cilindro macizo.
Script de comparación puntual de ambas implementaciones: `/tmp/bf-grip-measure.gd`; baseline de OperatorVisual en `/tmp/bf-operator-before.gd`. Log `/tmp/bf-ss-grip-measure.log`.

## Receta de reproducción y notas previas (resueltas)

1. Leer `/tmp/bf-ss-tests.log`: última ejecución `tools/bf test`, iniciada tras corregir filtro. La anterior tenía 296 smoke PASS y animation_layers FAIL SOLO por right_slide=9.60 (bug encontrado arriba). No ocultar un rojo.
2. Esperar últimas capturas: logs `/tmp/bf-ss-after-front.log` y `/tmp/bf-ss-after-q34.log` deben llegar a frame_0239. Ver frames 180..200: inversión L→R a 6 s. Confirmar postura lateral correcta y transición sin popping. Las carpetas after se están actualizando tras el cambio del filtro.
3. Si suite verde y visual correcto, actualizar `docs/CURRENT_STATE.md`, `git diff --check`, commit + push (autorizados). No Android.
4. Cerrar Blender GUI y procesos Godot propios al acabar. Las herramientas MCP preexistentes no son procesos iniciados por esta sesión.

Otros logs: `/tmp/bf-ss-export.log`, `/tmp/bf-ss-import.log`, `/tmp/bf-ss-ik-final.log`, `/tmp/bf-ss-reload-final.log` (reload PASS, fugas al salir ya preexistentes). ReloadRifle/ReloadPistol no modificados.

No perseguir perfección: el apoyo sigue estilizado y los puños derechos heredados son toscos; no abrir ese frente. Completar únicamente la verificación final y cerrar.
