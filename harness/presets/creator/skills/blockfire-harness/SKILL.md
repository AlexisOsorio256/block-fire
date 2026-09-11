---
name: blockfire-harness
description: >-
  Frontera mínima para cambiar harness/, medir su superficie y mantenerlo
  compatible con upstream DSH.
whenToUse: >-
  Cuando la tarea modifica presets, host/web, runtime resolver, updater,
  capacidades JIT, métricas o tests del harness.
---

# BLOCKFIRE Harness

Trabaja en `harness/`; nunca edites `node_modules` ni la copia instalada en
`$DSH_HOME`. Upstream DSH es dependencia, no fork.

Flujo normal:

1. Inspecciona solo el código dueño del problema.
2. Haz el cambio mínimo; capacidades pesadas van detrás de `bf_capability`.
3. `harness/install.sh` sincroniza repo → instalación.
4. `harness/test.sh` prueba composición/runtime; usa `--live` solo cuando una
   sesión real aporta evidencia relevante.
5. Mide el efecto con `node harness/bin/session-report.mjs --last 1` cuando el
   cambio trate de contexto/herramientas.

Reglas:

- Persona y tools permanentes deben ser estables y pequeños; nada volátil entra
  al prefijo.
- Skills contienen solo conocimiento que cambia una decisión y se carga JIT.
- No añadas wrappers para cosas que bash/fs ya resuelven.
- No añadas una tool permanente por comodidad; schemas grandes son JIT.
- Si necesitas detalle de composición/plugin, usa las skills shipped de Cordis.
- `harness/ARCHITECTURE.md` es referencia de frontera/riesgos, no lectura de
  inicio.

Cierre: prueba proporcional, instalación en sync cuando corresponda y reporte
honesto de lo no verificado.
