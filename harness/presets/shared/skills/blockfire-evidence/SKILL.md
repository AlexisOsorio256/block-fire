---
name: blockfire-evidence
description: >-
  Elegir la evidencia mínima que realmente demuestra un cambio de BLOCKFIRE.
whenToUse: >-
  Cuando haya que decidir qué prueba basta para cerrar código, visuales,
  animación, rendimiento o plataforma.
---

# Evidencia proporcional

Prueba el comportamiento que cambió; no ejecutes una checklist global por
costumbre.

- Lógica/reglas: test dirigido o `tools/bf test` si esa suite cubre el cambio.
- Escena/input/runtime: QA del área afectada.
- Presentación/animación: evidencia visual mirada + runtime relevante.
- Android/plataforma: dispositivo físico cuando la conclusión dependa de él.
- Rendimiento: medida antes/después.
- Docs: coherencia con código dueño.
- Assets: origen/licencia en `CREDITS.md`.

Un test que no toca el cambio no es evidencia. Una captura no mirada tampoco.
La suite completa, `qa touch` y build Android son gates de publicación o de
cambios que realmente los atraviesan, no de cada commit.

Reporte: ejecutado = afirma qué probó; no ejecutado = `SIN VERIFICAR`; deducido
de logs/métricas = `INFERENCIA`. Commit + push pueden hacerse cuando la evidencia
necesaria de esa tarea existe.
