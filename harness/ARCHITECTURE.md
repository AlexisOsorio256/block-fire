# BLOCKFIRE Harness — arquitectura

## Invariantes

1. DSH es el motor; BLOCKFIRE compone, no forkea ni edita `node_modules`.
2. Solo hay BUILD (juego) y CREATOR (`harness/`).
3. Atención primero: prefijo/toolset permanente mínimo; detalle pesado JIT.
4. Sin plan mode obligatorio, manager paralelo ni workflow DSL.
5. Evidencia proporcional; lo no ejecutado no se llama verificado.
6. Un dueño por mecanismo: runtime, updater, surface y Web no se duplican.
7. `harness/test.sh` + `contract/contract.json` son la frontera con upstream.

## Superficie y contexto

`presets/build/surface.cordis.yml` posee las **18 tools base**. Ambos espacios la
reutilizan.

BUILD guarda su baseline mínimo dentro de la persona del preset: no monta
`agent-instructions`, no depende de `AGENTS.md` y no obliga lecturas al iniciar.
Sus skills de proyecto son JIT. Blender también es JIT: `blender` expone solo
`blender_exec` + `blender_screenshot`; `blender-full` escala al MCP completo.

CREATOR mantiene las mismas 18 tools base. No carga shared/game skills ni
Blender; solo su skill de harness, las skills shipped de autoría Cordis y la
capacidad `cordis` JIT. Shell, búsqueda y el subagente base cubren fetch/delegación
sin pagar goals, fork, list-agents o web-fetch en cada request.

## Runtime

`lib/runtime.mjs` decide una sola vez binario + `node_modules`. Launcher,
instalación, suite y updater lo consumen. `bin/blockfire` aplica el patch Web,
completa deletes encolados antes de boot y exporta al host la versión DSH que
realmente arrancó.

`danger-full-access` sigue siendo necesario para Godot/Blender/Gradle/adb; el
límite destructivo es `host/guard.js`, no un sandbox ficticio.

## Update Center

La implementación es una sola:

`check → stage aislado → verify → activate → rollback`

La Web invoca `bin/update.mjs`; no duplica lógica. Re-stage borra cualquier
veredicto anterior. `verify` confirma que la suite corrió contra el árbol staged.
Rollback valida que su árbol aún exista. Activate/rollback afectan el siguiente
arranque; el proceso vivo no cambia.

## Web

El plugin propio usa slots/servicios upstream. Añade Update Center, Delete y
stats vivos: turns, steps, LLM, tools, TTFT, TPS con
`IconGaugeOutline16`, cache e input/output. No hay fork de ChatView ni scraping
DOM. New Session es el botón propio del sidebar upstream (mismo seam
`startSession`); el harness no duplica ese control.

## Delete: dos fases por diseño

DSH actual devuelve `SessionPersistenceSnapshot` y su backend JSONL es
append-only: no ofrece `delete()` ni `locate()`. Borrar el directorio mientras el
host puede conservar handles sería incorrecto.

Por eso:

1. se rechaza una sesión RUNNING;
2. Web valida el snapshot y usa `workspaceRegistry.archiveSession()` +
   `Workspace.detachSession()` para desaparecerla durablemente de la UI;
3. el id se encola en `$DSH_HOME/.blockfire-harness/`;
4. el próximo `harness/bin/blockfire` ejecuta `purge-sessions.mjs` **antes** de
   abrir DSH y elimina log + projection cache.

Runtimes antiguos con header/`locate()` conservan un fallback legacy. Attachments
compartidos no se borran: requieren GC propio upstream.

El id archivado permanece en `archivedSessionIds` tras el purge/restart:
upstream no ofrece `unarchive` ni ninguna seam para retirarlo, y el set solo
guarda ids (bytes, sin logs ni adjuntos). No se tocan los internals del
storage domain para limpiarlo.

## Riesgos abiertos

- DSH todavía no tiene una operación first-party atómica de delete físico.
- `tool-cordis` puede tener estado process-global; sigue CREATOR-only y JIT.
- `danger-full-access` no es aislamiento completo.
- Browser/Blender/Android necesitan evidencia real solo cuando la conclusión
  depende de ellos.
