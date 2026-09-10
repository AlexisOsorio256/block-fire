# BLOCKFIRE Harness — arquitectura

V1. Auditable por Astra después. Las decisiones dudosas están marcadas abajo en
**Riesgos**, no escondidas.

## Invariantes

1. **Un solo harness.** DeepSeek Harness es el motor; BLOCKFIRE es una capa
   delgada sobre él. No hay fork, no se edita `node_modules`, no se parchean
   paquetes. Actualizar DSH = actualizar paquetes.
2. **Dos espacios visibles.** El usuario elige **BUILD** (trabajo sobre el
   proyecto) o **CREATOR** (trabajo sobre el harness). Nada más.
3. **Presupuesto de atención.** Cada fila permanente se paga en cada request
   (esquema de tool + sección de prompt). Una fila entra si una gran proporción
   de sesiones la usa; si no, es capacidad JIT o no existe.
4. **El modelo decide.** No hay máquina de estados, ni workflow DSL, ni pipeline
   obligatorio. Las tools son primitivas; el camino lo elige el modelo.
5. **Cero approval loops normales.** La política se aplica en el entorno, no
   interrumpiendo al usuario. Lo destructivo sigue bloqueado por política.
6. **Contexto JIT.** El prompt permanente solo contiene invariantes de larga
   duración. Hechos cambiantes (HEAD, P0, FPS, assets, teléfono) viven en el
   repo y se leen cuando la tarea los pide. Un hecho, un dueño.
7. **Fallar claro > comportarse distinto en silencio.** `harness/test.sh` es el
   contrato; un cambio upstream que rompa la capa debe ponerlo en rojo.
8. **No sobreingeniería.** Ningún componente propio sin justificación medida.

## Componentes propios (todo lo demás es DSH)

| Componente | Qué es | Por qué existe |
|---|---|---|
| `presets/build/` | El espacio BUILD: persona + skills; incluye `surface.cordis.yml` | Punto de entrada del trabajo normal |
| `presets/build/surface.cordis.yml` | **Único dueño** de la superficie de tools que ambos espacios montan | BUILD y CREATOR no pueden divergir en filas de tools |
| `presets/creator/` | El espacio CREATOR: persona + skills + deltas (delegación completa, goals, web fetch, capacidad `cordis`) | Trabajo sobre el harness |
| `presets/build/plugins/capabilities.js` | Router `bf_capability` + capacidades JIT declaradas | Blender MCP son ~7.4k tokens de esquema; la mayoría de sesiones no lo toca |
| `host/guard.js` | Guard de operaciones destructivas (host plane) | Sustituye los prompts de aprobación por un límite de política |
| `host/patch.cordis.yml` | Capa de parche del perfil Web (guard, Update Center, roster) | Punto de extensión **soportado** por DSH; no toca archivos del usuario |
| `web/` | Plugin propio host+cliente: ruta `/blockfire/update` (estado, acciones, progreso de job), página *Settings → BLOCKFIRE* que maneja Update/Rollback, stats de sesión en vivo, botón `+ New` y borrado permanente de conversaciones | Superficie Web visible sin tocar el frontend de upstream |
| `bin/blockfire` | Launcher: política + parche + versión activa | Una sola forma de arrancar el producto |
| `bin/update.mjs` | Update Center: detectar, stage, verify, activate, rollback | Actualizar sin congelar y sin rezar |
| `lib/runtime.mjs` | Resolutor único del runtime DSH (binario + `node_modules`) | Un solo lugar decide qué DSH se arranca y contra qué `node_modules` resuelven los puentes |
| `bin/session-report.mjs` | Métricas por sesión desde el log real | Cache/contexto medidos, no afirmados |
| `test.sh` + `lib/` + `tests/` | Suite de compatibilidad: montaje real aislado (`tests/mount.mjs`), fixtures de contadores y controles negativos | Detectar breaking changes de DSH |
| `contract/contract.json` | La lista explícita de superficies upstream que usamos | Si DSH rompe, se adapta **esta** zona |

## Frontera con DSH

La capa depende exactamente de esto, y `contract/contract.json` lo nombra:

| Superficie | Uso | Quién detecta el cambio |
|---|---|---|
| Filas de composición (`name: '@deepseek-ai/dsh-*'`) | Montar tools/skills/compaction | `check_composition.py` (paquete instalado, archivo relativo, include, patch sin target) |
| Roster de presets (`$DSH_HOME/.agent-presets/<id>`, `preset.yml`) | Los dos espacios | `agentPresets.standingKeyFor` en cada sesión nueva + `--dump-config` |
| Sección de usuario `llm-pi-ai:` / `llm-deepseek:` en `$DSH_HOME/settings.yaml` | Rutas que cada adaptador LLM sirve: proveedor, baseURL, api, credencial (`apiKeyEnv`) y catálogo por ruta; hot-reload sin reinicio, la fila `llm-pi-ai` monta dormant | Boot real aislado con la sección candidata (molde: `tests/mount.mjs`) |
| Capa de parche del perfil (`--patch`, `cordis.patch.yml`) | Guard, Update Center, roster por defecto | `dsh --profile web --patch <archivo> --dump-config` (falla si un patch no matchea) |
| `ctx.tools.register/guard/schemas`, `ctx.plugin` (Fiber: `await()`/`dispose()`), `ctx.effect` | Router y guard | Tests unitarios con contexto falso (`tests/plugins.test.mjs`) + montaje real con Fiber y scopes (`tests/mount.mjs`) |
| Log de sesión (`request/header`, `assistant/message.usage.*`, `compaction/*`) | Métricas y contrato de superficie | `contract_check.mjs log/surface` contra sesiones reales; fixtures vacías/sin tools/con tools/malformadas en `--self-test` |
| Slots del frontend (`conversation.input.dock`, `conversation.composer.dock`, `sidebar.footer.action`, `conversation.session.header.utilities`) y su semántica de id+`priority` (menor prioridad sombrea; mismo id a la misma prioridad lanza) | Stats, botón `+ New`, Delete | Boot aislado con navegador (`tests/visual-boot.mjs` + CDP); la suite estática solo comprueba sintaxis |
| `sessionPersistence` (`create/append/locate/list`), `storageDomain` (`workspace`), `workspaceRegistry` (`setState/rebuildEntities`), `agents` (`status`) | Borrado permanente de sesiones | `tests/plugins.test.mjs` (405/400/404/409 + ruta feliz en tmpdir) y prueba E2E en navegador |
| `dsh.client` + `window.__ModuleLoader__` | Página BLOCKFIRE en Settings | Bundle propio escrito a mano; si el formato cambia, falla al cargar el módulo |
| Registro npm `@deepseek-ai/dsh` + releases de GitHub | Update Center | `update.mjs check` |

**Sin API inventada.** No hay capa de abstracción sobre Cordis: los servicios de
DSH (`agentPresets`, `tools`, `skills`, `systemPrompt`, `webServer`) son la
frontera estable y se usan directamente. Lo que sí existe es una lista explícita
del contrato y una suite que lo comprueba.

## Resolución del runtime

`lib/runtime.mjs` es el único dueño de la pregunta "¿qué DSH y qué
`node_modules`?". Launcher, `install.sh`, `test.sh` y `update.mjs` lo consumen
(`lib/runtime.sh` para los shell, import directo para Node) y ningún consumidor
mira el PATH por su cuenta; `test.sh` falla si alguno lo intenta.

Orden: override explícito (`BLOCKFIRE_DSH_BIN` / `BLOCKFIRE_INSTALL_MODULES`) →
pin ACTIVE del Update Center → `dsh` en PATH (o en la shell de login) →
`node_modules` local → global → caché de npx → candidato staged, como último
recurso para que una máquina cuyo único DSH esté staged siga arrancando. Un
candidato solo vale si su `node_modules` contiene de verdad `@deepseek-ai/dsh`
con versión y binario; un override inválido falla en vez de caer en otro árbol
(si no, `verify` podría probar un runtime distinto del candidato).

Por qué no basta `command -v dsh`: la forma histórica de arrancar DSH aquí es
`npx @deepseek-ai/dsh web`, y npx inyecta su caché en el PATH solo dentro de ese
proceso. En una shell nueva no hay `dsh` y todo lo que dependiera del PATH se
quedaba sin `node_modules` (puentes opcionales rotos) o decía "no dsh runtime
found". El resolutor devuelve binario y `node_modules` del **mismo** árbol, que
es lo que necesita Blender MCP para resolver.

## Estrategia de contexto

- Prompt permanente = persona del espacio (identidad + contrato del espacio) +
  catálogo de skills (una línea por skill). `AGENTS.md` como mensaje durable es
  **solo de BUILD**: CREATOR trabaja el harness sin tarjeta del proyecto ni
  skills del juego; su detalle operativo vive en la skill `blockfire-harness`.
- **Un hecho, un dueño**: los hechos del proyecto los posee `AGENTS.md` (BUILD)
  y `docs/*`; la persona no los repite. Sin ritual de arranque: la tarjeta no
  obliga a doctor/git/lecturas al abrir sesión — eso es decisión de la tarea.
- El arranque NO es una lectura de documentos: es `tools/bf doctor` + git + el
  código dueño. La skill de orientación se eliminó porque su cuerpo costaba en
  toda sesión (2.8k chars en el step 1) y sus instrucciones inducían leer tres
  documentos de entrada (~16k chars) que la tarea rara vez necesita: la
  selección de contexto es JIT como todo lo demás.
- El cuerpo de una skill se paga solo cuando la tarea encaja con su descripción.
- Nada volátil en el prefijo: eso es lo que mantiene la tasa de acierto de
  KV-cache (95–99.9% medido en sesiones reales).

## Estrategia de tools y capacidades

Regla: **una tool es permanente si se usa en ≥25% de las sesiones, o si es una
primitiva del contrato humano/operativo** (`bash`, `read`/`edit`/`write`,
búsqueda, `skill`, `ask_user_question`, control de jobs). Evidencia en
`bin/session-report.mjs` sobre sesiones reales (2.468 llamadas analizadas).

Medido: BUILD pasó de 25 tools / 22.311 caracteres de esquema a **18 tools /
~16.5k**; CREATOR monta además delegación completa, goals y `web_fetch`.

**JIT solo para capacidades pesadas.** Activar una capacidad a mitad de sesión
invalida la cache desde el esquema de tools. Compensa cuando lo que se quita del
prefijo es mucho mayor que una invalidación (Blender MCP ~7.4k tokens; el
toolset Cordis ~7.5k caracteres). No compensa para una tool de 1.3k: esas se
quitan o se quedan, nunca se esconden tras el router.

## Modelo de updates

`status` (local) → `check` (registro npm + releases) → `stage <version>`
(instalación aislada) → `verify <version>` (esta suite contra el árbol candidato)
→ `activate <version>` (solo si pasó; guarda el anterior) → `rollback`.

- El proceso en marcha nunca se toca: el cambio de versión aplica al siguiente
  arranque.
- No hay atomicidad fingida: el switch es una escritura de estado y el rollback
  es la inversa.
- Ninguna versión se activa sin pasar la suite (`--force` es explícito y raro).
- La Web maneja ESTE mecanismo, no una copia: las rutas del plugin host lanzan
  `update.mjs` y devuelven su salida textual; el botón Update es la cadena
  stage → verify → activate gobernada por los códigos de salida del CLI, y un
  fallo deja todo exactamente donde estaba.

## Riesgos abiertos

0. **El borrado permanente usa seams reales pero incompletos upstream.**
   `sessionPersistence` es append-only y `workspaceRegistry` no tiene
   `removeSession`: la capa escribe la cuenta del workspace por
   `table.put` + `registry.setState` + `rebuildEntities` y borra el log y el
   cache de proyecciones por ruta conocida. Quedan dos costuras: (a) si el
   registro muta su estado global cacheado después de un borrado, un id
   archivado borrado puede reaparecer en el JSON (invisible en toda la UI,
   se limpia al reiniciar); (b) los hijos subagent de una sesión borrada
   sobreviven como sesiones independientes. El seam mínimo que eliminaría
   ambos: `sessionPersistence.delete(id)` + `workspaceRegistry.removeSession(id)`
   como una operación durable upstream.

1. **`tool-cordis` registra proveedores de inspección process-globales.** Dos
   sesiones que activen la capacidad `cordis` a la vez chocan (`provider already
   registered`). Mitigado: la capacidad es JIT y CREATOR es un espacio de trabajo
   único; no resuelto por upstream.
2. **El sandbox va abierto** (`danger-full-access`) porque Godot, Blender, Gradle
   y adb escriben fuera del workspace. La protección real es el guard, que es una
   lista corta de patrones: no es un sandbox y no pretende serlo.
3. **La superficie se verifica contra sesiones reales.** Un espacio que todavía
   no ha corrido no tiene evidencia de contrato (`--live` lo reporta como skip).
   Un log sin model requests es SIN EVIDENCIA, no PASS ni FAIL.
4. **El Update Center no prueba el candidato en un navegador real**: verifica la
   composición, las filas, el log y los plugins, no una sesión Web completa. Y
   `verify` exige la sección *installation* de la suite: desde un `$DSH_HOME`
   aislado sin copias sincronizadas (un boot E2E) falla ahí aunque el candidato
   sea compatible — fail-closed, pero hay que saberlo al interpretarlo.
5. **CREATOR lee las skills de autoría del preset shipped por ruta de instalación**
   (`node_modules/@deepseek-ai/dsh-agent-presets/presets/cordis/skills`). Si
   upstream mueve ese layout, `test.sh` falla y hay que reapuntar una línea.
6. **El puente puede apuntar al caché de npx.** Es el DSH que existe sin instalar
   nada, pero es efímero: `npm cache clean` (o el GC de npx) lo borra y el enlace
   queda roto hasta `install.sh` o hasta `stage` + `activate` de un runtime
   administrado. `install.sh --check` lo reporta como `BRIDGE LINK missing`.
7. **El ciclo de vida de las capacidades JIT se prueba con un fixture local**
   (`tests/mount.mjs`: Fiber real, arranque que rechaza, sesión que se cierra con
   una capacidad activa). No prueba Blender/MCP real, resume de sesión
   persistida, ni dos sesiones activando la capacidad `cordis` a la vez: eso
   sigue SIN VERIFICAR hasta que exista Blender conectado o una prueba dedicada.
