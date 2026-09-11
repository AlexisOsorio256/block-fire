# BLOCKFIRE Harness — arquitectura

## Invariantes

1. **Un solo harness.** DeepSeek Harness es el motor; BLOCKFIRE es una capa de
   composición, no un fork. No se edita `node_modules`.
2. **Dos espacios.** BUILD trabaja el proyecto; CREATOR trabaja `harness/` y la
   frontera DSH/Cordis.
3. **Atención primero.** Lo permanente debe ser pequeño. Detalle, skills y
   capacidades pesadas se cargan solo cuando la tarea los necesita.
4. **El modelo decide.** No hay plan mode obligatorio, manager paralelo ni
   workflow DSL.
5. **Evidencia proporcional.** La prueba depende del cambio. Lo no ejecutado no
   se declara verificado.
6. **Un dueño por mecanismo.** Runtime, updater, tool surface y Web tienen una
   única implementación; no se duplican rutas que puedan divergir.
7. **Compatibilidad explícita.** `harness/test.sh` y
   `contract/contract.json` detectan cambios relevantes de upstream.

## Superficie

`presets/build/surface.cordis.yml` es el dueño de la superficie base. BUILD la
monta directamente. CREATOR la reutiliza y añade solo delegación completa,
goals, `web_fetch` y la capacidad JIT de Cordis.

La persona BUILD contiene el baseline mínimo de BLOCKFIRE. No se monta
`agent-instructions` y el proyecto no necesita un `AGENTS.md` para arrancar una
sesión. Código, tests y git son la fuente de verdad; la documentación se consulta
solo cuando una tarea concreta la hace útil.

Las skills son conocimiento JIT. El catálogo cuesta poco; el cuerpo solo entra en
contexto cuando el modelo carga la skill. Las capacidades grandes usan
`bf_capability`:

- `blender`: `blender_exec` + `blender_screenshot`;
- `blender-full`: puente MCP completo, solo cuando el loop mínimo no basta;
- `cordis`: inspección/modificación del runtime, solo CREATOR.

`blender` y `blender-full` son excluyentes para evitar dos conexiones que
compitan contra el mismo addon.

## Runtime

`lib/runtime.mjs` es el único resolutor de DSH. Launcher, instalación, suite y
updater consumen esa misma decisión. La resolución mantiene binario y
`node_modules` del mismo árbol y soporta override explícito, pin del Update
Center, PATH, instalaciones locales/globales, caché de npx y candidatos staged.

`bin/blockfire` es el launcher normal. Aplica el perfil Web + patch BLOCKFIRE y
usa `danger-full-access` por defecto porque Godot, Blender, Gradle y adb escriben
fuera del workspace. El límite destructivo es `host/guard.js`; no pretende ser
un sandbox completo.

## Update Center

`bin/update.mjs` implementa una sola cadena:

`check → stage → verify → activate → rollback`

La Web llama este mismo mecanismo; no lo reimplementa. Un candidato se instala
en un árbol aislado, se verifica con `harness/test.sh` y solo entonces puede
activarse. La activación aplica al siguiente arranque y conserva el runtime
anterior para rollback.

## Web

`web/` y el plugin host usan slots/servicios de DSH, sin copiar ChatView ni
modificar upstream.

La superficie propia incluye:

- Update Center en Settings;
- stats de sesión en `conversation.input.dock`, junto a la actividad y antes del
  composer;
- shadow del stats strip upstream en `conversation.composer.dock` para no
  duplicar cifras;
- botón `+ New` en el pie del sidebar;
- borrado permanente en las utilidades de la sesión.

Los stats leen las proyecciones durables `sessionStats` y `tokenUsage` y muestran
turns, steps, LLM time, tool time, TTFT, TPS con `IconGaugeOutline16`, cache hit,
input y output. No dependen del texto de la conversación ni de scraping DOM.

## Borrado de sesiones

La versión actual de DSH no expone una primitiva first-party única para borrar
una sesión persistida. La capa BLOCKFIRE usa las fronteras reales disponibles:

1. rechaza borrar una sesión cuyo agente sigue RUNNING;
2. quita el id del workspace y del estado de archivado mediante el dominio de
   storage/registro;
3. borra el directorio del log y la entrada de projection cache;
4. deja la UI navegar a una sesión válida después de que el feed refleje el
   cambio.

No se hace un `rm` ciego desde la UI. La costura mínima que falta upstream es una
operación durable equivalente a `sessionPersistence.delete(id)` +
`workspaceRegistry.removeSession(id)`. Los attachments son content-addressed y
pueden ser compartidos entre sesiones; DSH explícitamente difiere su GC, por lo
que no se borran objetos compartidos al eliminar una sola sesión.

## Contrato con DSH

La capa depende de superficies concretas que `contract/contract.json` y la suite
vigilan: composición/presets, `ctx.tools`, Fiber de plugins, logs y usage,
proyecciones, slots Web, `sessionPersistence`, `storageDomain`,
`workspaceRegistry`, `agents` y el layout de las skills shipped de Cordis.

`harness/test.sh` valida sintaxis, composición, montaje real aislado, tools y
skills por espacio, ciclo on/list/off de capacidades, aislamiento entre sesiones,
fallos de arranque, fixtures de session-report y sincronía de la instalación.
`--live` añade sesiones reales; `--network` añade detección de updates.

## Riesgos que siguen siendo reales

- El borrado permanente funciona sobre seams existentes pero upstream aún no
  ofrece la operación atómica de delete descrita arriba.
- `tool-cordis` tiene estado process-global en algunas rutas; dos activaciones
  concurrentes pueden chocar. Por eso sigue JIT y CREATOR-only.
- `danger-full-access` no es aislamiento. El guard solo bloquea un conjunto corto
  de operaciones catastróficas.
- Una suite sin navegador no demuestra por sí sola posición/estética Web; cuando
  esa conclusión importa hace falta evidencia Web real.
- Blender y Android físico solo son autoridad cuando la tarea depende de ellos;
  no son gates universales.
