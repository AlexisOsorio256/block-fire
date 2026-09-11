# BLOCKFIRE Harness — arquitectura

## Invariantes

1. DSH es el motor; BLOCKFIRE compone, no forkea ni edita `node_modules`.
2. Solo hay BUILD (juego) y CREATOR (`harness/`).
3. Atención primero: el prefijo permanente se mide y se reduce hasta donde deja
   de ser gratis; nunca se canjea una regla, un marcador de resultado ni la
   semántica de un parámetro por texto más corto. Detalle pesado, JIT.
4. Sin plan mode obligatorio, manager paralelo ni workflow DSL.
5. Evidencia proporcional; lo no ejecutado no se llama verificado.
6. Un dueño por mecanismo: runtime, updater, surface y Web no se duplican.
7. `harness/test.sh` + `contract/contract.json` son la frontera con upstream.
8. Camino decisivo más corto: una tool/plugin/captura directa gana a scripts,
   auditorías, proxies, lecturas/pruebas duplicadas o delegación especulativa.
   Cuando la causa y la evidencia requerida ya están resueltas, se termina.

## Superficie y contexto

`presets/build/surface.cordis.yml` posee las **17 tools base**. Ambos espacios la
reutilizan. `todo_write` no forma parte del producto: el repo y la trayectoria ya
son estado durable y BLOCKFIRE no paga schema ni llamadas para mantener una
checklist paralela. Delegación y skills siguen disponibles, pero JIT y solo si
resuelven algo que unas pocas tools directas no resuelven mejor.

El prefijo permanente tiene un dueño explícito: `presets/build/plugins/prompt.js`
se une al waterfall `system-prompt/assemble` dentro del scope de la sesión y
devuelve el assembly que DSH usa tal cual — `renderPrompt()` y `header.tools`
salen de ahí. Reescribe descripciones al hecho operativo en inglés, elimina las
secciones `tool:*` que solo repetían una descripción (solo si esa tool existe),
comprime las secciones largas que son casi todo prohibición y alinea el texto de
sandbox con la política real (`approval:policy`): una sesión sin approvals no
recibe instrucciones de escalar. Nunca toca `parameters`, y lo que no reconoce
pasa intacto, así que un rename upstream degrada a "texto upstream", no a una
regla perdida. `presets/build/plugins/prompt.js` es también el único lugar donde
vive la política de idioma: el modelo lee inglés, el usuario recibe español.

La semántica de eficiencia también se prueba sobre el **assembly real** en
`tests/mount.mjs`: ambas personas deben recibir la regla de camino corto;
`read_image` debe mandar observación antes de proxies; `skill` no puede volver a
"cargar todo"; y `subagent` no puede sustituir unas pocas tool calls directas.
Eso evita que una futura compresión de prompt reintroduzca churn silenciosamente.

BUILD guarda su baseline mínimo dentro de la persona del preset: no monta
`agent-instructions`, no depende de `AGENTS.md` y no obliga lecturas al iniciar.
Sus skills de proyecto son JIT. Blender también es JIT: `blender` expone solo
`blender_exec` + `blender_screenshot`; `blender-full` escala al MCP completo.
Trabajo visual no se declara terminado sin inspeccionar la captura real; un
export exitoso, geometría auxiliar o una ruta de fichero no sustituyen verla.

CREATOR mantiene las mismas 17 tools base. No carga shared/game skills ni
Blender; solo su skill de harness, las skills shipped de autoría Cordis y la
capacidad `cordis` JIT. Shell, búsqueda y el subagente base cubren fetch/delegación
sin pagar goals, fork, list-agents o web-fetch en cada request.

La conversación es working set, no archivo. `compaction-basic` compacta a
`thresholdRatio: 0.55` y conserva `retainRatio: 0.10`: cuando detalle antiguo
vuelve a importar, se relee su dueño real en el repo. El pruner corta tool results
a partir de 4096 caracteres y conserva 2048 de cabeza + 768 de cola. Esos límites
están congelados por `tests/mount.mjs`; subirlos requiere una razón medida.

El costo del prefijo se mide sin llamadas al modelo con
`bin/context-report.mjs` (host aislado, `--details` por dueño) y se congela como
techo en `tests/mount.mjs`. `bin/session-report.mjs` sigue siendo la lectura real
de una sesión ya ocurrida: acepta la última línea truncada de una sesión viva,
pero corrupción JSONL en medio hace la evidencia parcial y devuelve error. Además
expone promedio de prompt por usage, multiplicación acumulada respecto del primer
request, llamadas exactas repetidas y recargas de skills para que el churn sea
visible sin revisar la trayectoria a mano.

## Runtime

`lib/runtime.mjs` decide una sola vez binario + `node_modules`. Launcher,
instalación, suite y updater lo consumen. `bin/blockfire` aplica el patch Web,
completa deletes encolados antes de boot y exporta al host la versión DSH que
realmente arrancó.

`danger-full-access` sigue siendo necesario para Godot/Blender/Gradle/adb; el
límite destructivo es `host/guard.js`, no un sandbox ficticio. Las rutas
protegidas se reconocen también escritas como `~`, `$HOME` o `${HOME}`.

`host/package.json` identifica ese plugin incluso cuando se carga mediante el
symlink del perfil Web. El inventario de plugins de DeepSeek prepara la petición
antes del HTTP: sin manifest propio ascendía al perfil sin versión y fallaba con
`REQUEST_EXTENSION`. La prueba de montaje reproduce el symlink y prepara las
extensiones para BUILD/CREATOR sin llamadas al modelo.

## Update Center

La implementación es una sola:

`check → stage aislado → verify → activate → rollback`

La Web invoca `bin/update.mjs`; no duplica lógica. Re-stage borra cualquier
veredicto anterior. `verify` confirma que la suite corrió contra el árbol staged.
Rollback valida que su árbol aún exista. Activate/rollback afectan el siguiente
arranque; el proceso vivo no cambia. Versiones/tags se validan antes de formar
rutas de staging. Si el host entra en teardown durante una operación, el hijo
actual se cancela y no puede arrancar el siguiente paso (en particular,
`verify` nunca continúa a `activate` después del cierre).

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

1. se rechaza una sesión RUNNING y se valida que el snapshot exista;
2. **primero** se persiste el id en
   `$DSH_HOME/.blockfire-harness/pending-session-deletes.json`; si esa cola está
   corrupta, el delete falla sin archivar/detachar ni sobrescribirla;
3. Web usa `workspaceRegistry.archiveSession()` + `Workspace.detachSession()`
   para desaparecerla durablemente de la UI;
4. el próximo `harness/bin/blockfire` ejecuta `purge-sessions.mjs` **antes** de
   abrir DSH y elimina log + projection cache. Una cola inválida se conserva y
   falla fuerte en vez de fingirse vacía.

Runtimes antiguos con header/`locate()` conservan un fallback legacy. Attachments
compartidos no se borran: requieren GC propio upstream.

El id archivado permanece en `archivedSessionIds` tras el purge/restart:
upstream no ofrece `unarchive` ni ninguna seam para retirarlo, y el set solo
guarda ids (bytes, sin logs ni adjuntos). No se tocan los internals del
storage domain para limpiarlo.

## Evidencia de compatibilidad

`harness/test.sh` monta BUILD/CREATOR en un `DSH_HOME` efímero y prueba la
superficie real sin llamadas al modelo. El modo `--live` reconoce tanto
`session.v3.jsonl.zstd` (DSH actual) como el nombre legacy y compara contra la
sesión que realmente montó cada espacio. El contrato acepta el prompt dinámico
actual en `system/message` además del `header.system` legacy; no confunde un
cambio de representación soportado con una incompatibilidad.

Los límites baratos (guard, updater, purger, integridad de logs y lifecycle Web)
tienen fixtures sin red en `tests/safety.test.mjs`, antes de depender de QA del
modelo o de Android.

## Riesgos abiertos

- DSH todavía no tiene una operación first-party atómica de delete físico.
- `tool-cordis` puede tener estado process-global; sigue CREATOR-only y JIT.
- `danger-full-access` no es aislamiento completo.
- Browser/Blender/Android necesitan evidencia real solo cuando la conclusión
  depende de ellos.
- Los `parameters` de tools y el catálogo de skills shipped siguen siendo costo
  permanente que no se recorta alterando semántica upstream; cualquier reducción
  futura debe medirse sobre el assembly real.
