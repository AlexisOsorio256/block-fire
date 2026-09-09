# Traspaso de auditoría arquitectónica — 2026-09-09

**Auditoría general y plan de reparación:** la segunda mitad de este documento
contiene el mapa completo y los encargos A1–A9 (archivo, causa, cambio y aceptación).
La primera mitad conserva el estado exacto del trabajo parcial y su evidencia.

**Leer antes de continuar implementando.** El usuario pidió detener la implementación
para conservar uso y permitir que otro modelo cierre los cambios. No reiniciar la
auditoría ni interpretar este documento como una solicitud de rediseño completo.

## Objetivo y alcance

Extraer más capacidad efectiva del mismo modelo para desarrollar BLOCKFIRE, con
menos interferencia. Mantener un solo harness multi-model sobre DeepSeek Harness
(DSH), autonomía, actualizaciones upstream y ausencia de approval loops normales.
No modificar gameplay ni arte. La petición original autorizó commit + push al
final de una sesión verificada; **este trabajo todavía no tiene cierre verificado**.

Base al iniciar: `661a505` (working tree limpio). Runtime resuelto en esta máquina:
DSH `0.1.2-rc.1`, desde caché npx. Resolver: `node harness/lib/runtime.mjs`.
El historial menciona `0.1.5-alpha.2` verificado, pero eso NO prueba que esté activo
o disponible aquí. No actualizar ni instalar otro runtime para cerrar este frente.
Modelo de esta sesión: identificado como GPT-6 Astra por el entorno de trabajo;
no dispongo de un identificador de backend verificable para certificar un MODEL ID exacto.

## Arquitectura encontrada y decisiones que conservar

- `harness/host/patch.cordis.yml` aporta guard, Update Center y roster BUILD/CREATOR
  sobre Web. Los registries y rutas de modelos siguen siendo de DSH.
- BUILD y CREATOR comparten `presets/build/surface.cordis.yml`; persona y skills
  pertenecen al preset. CREATOR añade tools de objetivos y delegación, web fetch
  y acceso JIT a Cordis. No hay fork ni edición de paquetes upstream.
- Blender MCP y Cordis se activan por `bf_capability`; evitar pagar sus esquemas
  en todas las sesiones es razonable. No añadir otra capa de managers o workflows.
- `lib/runtime.mjs` centraliza resolución del binario y módulos. Conservarlo.
- DSH ya resuelve buena parte de la continuidad: compaction-basic conserva cola
  reciente, reutiliza prefijo de la petición al resumir, tiene recuperación por
  overflow y políticas por ruta/modelo. **No escribir otro compactador** sin
  evidencia de pérdida en una tarea real. Leí documentación y partes del código.
- `agent-instructions` carga baseline durable y descubre instrucciones anidadas
  al usar read/write/edit. Bash NO dispara ese descubrimiento. Es una limitación
  de upstream que importa porque bash domina las sesiones; todavía no hay prueba
  de que esté causando un fallo concreto en este repositorio.

La mayor limitación CONFIRMADA no es el número de tools: es confiar en mocks y
composición estática para afirmar que una capacidad realmente funciona. Esto ya
ocultaba un defecto del router JIT. Corregir esa frontera mejora tanto la capacidad
operativa como la posibilidad de seguir actualizando DSH sin romper el producto.

## Hallazgos confirmados, con acciones

### P1 — El router JIT usaba incorrectamente el lifecycle de Cordis

Dueño: `presets/build/plugins/capabilities.js`.

Antes guardaba `host.plugin(...)` y luego ejecutaba ese valor como `dispose()`.
Cordis devuelve un **Fiber**, cuyo método es `fiber.dispose()` y cuya activación
se espera mediante `fiber.await()`. El mock en `tests/plugins.test.mjs` devolvía
una función, por lo que aprobaba una API falsa. Una desactivación podía fallar y
mantener herramientas montadas aunque el mapa del router ya marcara OFF.

Cambios YA HECHOS, sin commit:

- Esperar `fiber.await()` y guardar `fiber.dispose`.
- Esperar limpieza al desactivar y al desmontar el router.
- Intentar limpiar el Fiber si falla el arranque.
- Consultar schemas con `scopeOf(ownerCtxOf(exec))`, importado bajo demanda desde
  `@deepseek-ai/dsh-scope`. Consultar sin scope omitía tools visibles solo al agente.
- Cambiar el mock para devolver la forma Fiber usada por este código.

Prueba real YA PASADA: `node harness/tests/mount.mjs` activa una capacidad local
mínima, comprueba su visibilidad para el dueño y ausencia en otra sesión, lista
sus herramientas y la desactiva. Repite el ciclo dos veces. No usa Blender real.

Pendiente de cierre: comprobar fallo de activación asíncrona y limpieza al cerrar
la sesión con una capacidad todavía activa. Revisar el catch: si dispose también
rechaza puede tapar el error de arranque. No afirmar que estos casos ya pasaron.
La implementación aún conserva fallback al contexto del preset si no hay agente,
y un Map de dueños que se limpia al desmontar el router. Revisar su necesidad y
retención antes de ampliar alcance; no están demostrados como fallos de sesión.

### P1 — La suite no montaba realmente los presets ni probaba su superficie

Dueño: `test.sh`; nueva prueba `tests/mount.mjs`.

`--dump-config` verifica composición, pero no inicialización de plugins. Además,
las importaciones de capacidades se hacían desde el preset instalado, aunque se
hubiera solicitado verificar otro árbol candidato. Eso podía mezclar versiones.

Cambios YA HECHOS:

- Boot real de bundles DSH base + Web y parche host BLOCKFIRE en DSH_HOME temporal.
- Copia temporal de presets del repo; todos los enlaces de módulos apuntan al
  árbol elegido por el resolver. Ningún paquete upstream se modifica.
- Puerto loopback efímero, sin abrir navegador, sin telemetría ni llamadas LLM.
- Crear agentes INACTIVOS: la tool subagent con modelSelectionSettings se registra
  al crear un agente, no solo con standingKeyFor. Una prueba solo del standing
  scope arrojaría un falso fallo de herramienta ausente.
- Comparar nombres de tools con contract.json y presencia de las skills esperadas.
- Disponer agentes, Fiber raíz y directorio temporal al terminar.
- `test.sh` ejecuta esa prueba con timeout; `--self-test` quita deliberadamente el
  servicio host subagent-model-selection-settings y exige el error específico.
- Las importaciones de paquetes opcionales resuelven ahora desde INSTALL_MODULES.

No confundir esto con QA de navegador o sesiones LLM: no verifica la ejecución del
bundle cliente del Update Center, respuesta del modelo, MCP externo ni Android.
Tampoco reproduce ajustes privados del usuario: prueba la composición del producto.

### P2 — Logs históricos/vacíos se trataban como incompatibilidad upstream

La suite inicial falló con 9 errores sobre una sesión BUILD sin turnos ni requests.
Exigía que existieran eventos que nunca habían ocurrido. Además, WANT_LIVE se
parseaba pero el escaneo de logs se ejecutaba incluso sin --live.

Cambios YA HECHOS en test.sh:

- Auditar logs históricos solo con --live; no usarlos como prueba del candidato.
- Buscar sesiones con request/header; omitir las vacías como falta de evidencia.
- Subir el límite de lectura de selección de logs de 8 a 512 MiB para no excluir
  silenciosamente sesiones largas por ese límite (igual al lector existente).

Pendiente: `contract_check.mjs log` aún exige todos los tipos de evento en cada
sesión. Una sesión válida sin tools puede seguir fallando. Ajustar el contrato
según qué operaciones ocurrieron, con fixtures vacía, sin tools, con tools y
malformada. No simplemente dejar de detectar campos obligatorios ausentes.

### P2 — Memoria operativa y skill de autoría contienen información obsoleta

`presets/build/skills/blockfire-harness/SKILL.md` todavía enseña
`.agent-presets/blockfire`, `presets/blockfire` y standingKeyFor('blockfire').
Los espacios actuales son build/creator. Además afirma que la suite es estática;
con este cambio ya no lo será. Corregir estos puntos y enlazar ARCHITECTURE.md en
vez de repetir un mapa que vuelve a divergir. No reescribir todas las skills.

`docs/CURRENT_STATE.md` arrastra una instantánea antigua del juego y afirma que
la V1 está verificada. Se agregó un enlace a este traspaso sin revalidar ni alterar
las métricas históricas de gameplay. No presentarlas como resultados de hoy.

### P2 — Las métricas no demuestran mejora causal del harness

`session-report.mjs` inspeccionado; NO modificado. Últimas sesiones con trabajo:

| Preset | Requests | Cache reportado | Tools/esquema primer header |
|---|---:|---:|---|
| cordis | 101 | 99.3% | 33 / 33,910 caracteres |
| cordis | 183 | 97.8% | 33 / 33,910 caracteres |
| build | 0 | n/a | sin header |

No usar esas sesiones cordis para afirmar un before/after de BUILD/CREATOR.
El adapter DeepSeek instalado convierte prompt_tokens a inputTokens NO cacheados
restando cacheRead; la suma del report es coherente para ese adapter. No se auditó
exhaustivamente esa semántica en todos los adapters.

Otro defecto detectado por lectura: report cuenta `compaction` y
`manual-compaction`, mientras compaction-basic instalado emite
`compaction/start`, `compaction/summary`, `compaction/end`; end puede llevar error.
Pendiente: contar operaciones exitosas/fallidas con esa forma real y fixtures.
No afirmar pérdida de memoria ni cero compactaciones a partir del contador viejo.
El report toma solo el primer header: no cuantifica cambios de superficie JIT ni
mezcla de modelos/rutas a lo largo de una sesión. No convertirlo en dashboard;
primero corregir medidas que sustentan decisiones.

## Evidencia y estado exacto del working tree

Archivos modificados antes del traspaso:

- `harness/presets/build/plugins/capabilities.js`
- `harness/tests/plugins.test.mjs`
- `harness/test.sh`
- NUEVO `harness/tests/mount.mjs` (debe incluirse en el commit final).

Pruebas ejecutadas:

1. Baseline `harness/test.sh --self-test`: FAIL por log BUILD vacío.
   Log local: `/tmp/blockfire-architecture-baseline.log`.
2. Suite tras integrar mount/logs, ANTES de los últimos cambios del router: PASS,
   incluido control negativo de servicio host.
   Log local: `/tmp/blockfire-architecture-after.log`.
3. Unit tests tras corregir Fiber, ANTES del último ajuste de scope: PASS.
4. ÚLTIMA ejecución `node harness/tests/mount.mjs`: PASS con router actual:
   BUILD 18 tools / 16,576 schema chars / 5 skills;
   CREATOR 24 tools / 21,819 schema chars / 7 skills;
   on/list/off dos veces e aislamiento entre sesiones PASS.

Estas cifras son medidas locales, no tokens ni rendimiento de tareas. No se
cambió el catálogo permanente ni se añadió texto al system prompt. La corrección
reduce herramientas residuales al desactivar; no se midió ahorro en sesiones LLM.

**SIN VERIFICAR:** suite completa sobre el último estado, instalación sincronizada
tras cambios del router, Blender/MCP real, sesiones LLM nuevas, navegador, Android.
Doctor: Godot NO encontrado, Blender 4.0.2 presente, MCP NO, teléfono ninguno.
No se lanzaron suites del juego ni build Android. No se hizo commit ni push.
Los procesos de las pruebas de montaje terminaron; cada prueba dispone su servidor.
No asumir que los logs /tmp sobreviven a un reinicio.

## Instrucciones para el siguiente modelo: cierre pequeño y verificable

1. Leer este documento, git diff y los cuatro archivos cambiados. No rehacer toda
   la investigación ni rediseñar compaction/tools/adapters.
2. Cerrar los dos casos de lifecycle pendientes si caben; mantener pruebas reales
   que habrían fallado con el router original. No volver a un mock como autoridad.
3. Corregir la skill obsoleta y actualizar las secciones de verificación/riesgos
   en harness/ARCHITECTURE.md y README.md. Este documento es el traspaso, no una
   segunda constitución ni contexto a cargar permanentemente en los modelos.
4. Ejecutar `harness/install.sh`, `harness/test.sh --self-test` y
   `harness/test.sh --live`. Diferenciar falta de sesiones de incompatibilidad.
   Revisar diff y procesos propios. No activar otra versión de DSH.
5. Si queda tiempo, corregir contador de compaction y contrato de logs con
   fixtures de eventos. Si no, registrar pendiente preciso, sin scaffolding.
6. Informar Godot/Android/MCP como SIN VERIFICAR si siguen indisponibles. Cumplir
   gates del proyecto que puedan ejecutarse; nunca falsificar un cierre verde.
7. Commit + push solo cuando el frente quede verificado según las reglas del
   repo. Entregar SHA y un reporte corto, sin prometer mejora de calidad sin A/B.

## Próxima decisión de alto impacto (no implementada)

Usar tareas reales pequeñas y repetibles de BLOCKFIRE con el mismo modelo, ruta,
presupuesto y estado de repo para comparar harness genérico vs BUILD. Evaluar
resultado correcto, tiempo hasta evidencia válida, relecturas, correcciones,
tokens y recuperación tras compaction; no solo cache o cantidad de tools.
Primero reparar la observabilidad anterior para que esa comparación sea honesta.

Áreas aún SIN auditoría exhaustiva: comportamiento multi-model completo,
compaction bajo carga con tarea del juego, reinicio/resume de capacidades JIT,
colisiones process-global de Cordis concurrente, cliente Web en navegador y la
validez del veredicto de update después de cambiar/restagear el árbol. Leí el
updater y el límite Web/host, pero no ejecuté una actualización ni probé esos
escenarios. No afirmar que «se auditó todo».

# Auditoría general y especificación de reparaciones

Ampliación solicitada por el usuario: **encargo para implementar, no solo notas**.
Desde esta ampliación no se han hecho más cambios de código. Los apartados
anteriores documentan el estado parcial recibido; los siguientes indican dónde,
cómo y en qué orden arreglar el conjunto. La lectura cubre los componentes propios
de harness/ y las interfaces DSH relevantes; no equivale a ejecutar todas las
combinaciones de proveedor, dispositivo, navegador y reinicio.

## Mapa de cobertura y dictamen

| Área | Dueño | Dictamen / trabajo asignado |
|---|---|---|
| System/personas | presets/{build,creator}/agent.cordis.yml | Conservar separación; quitar obligación prematura de activar Cordis. A6. |
| Tools permanentes | presets/build/surface.cordis.yml | Conservar catálogo actual hasta medir tareas; no aplicar umbral de uso como ley. A6/A9. |
| Skills y contexto | presets/build/skills/ | Hay rutas obsoletas y duplicación/contradicciones operativas. A6. |
| Capacidades JIT | presets/build/plugins/capabilities.js | Defecto real de Fiber y de scope; cierre parcial hecho. A1. |
| Compaction/pruning | surface.cordis.yml + paquetes DSH | Mantener implementación upstream; reparar medición y evaluar continuidad. A5/A9. |
| Session state/resume | router + DSH agent/session | Estado JIT solo en memoria; definir contrato de resume con prueba. A1/A8. |
| Subagents | surface + creator + host DSH | Host correcto; schemas dependen de sesión/settings. No recortar más a ciegas. A2/A8. |
| Model adapters | host DSH | No fork; falta prueba de ruta/capacidad/imagen con segundo modelo. A8. |
| Cordis | capability de CREATOR | Buen acceso JIT; descubrimiento/listado defectuoso y concurrencia pendiente. A1/A8. |
| Web/host | web/lib/{index,client}.js | Frontera CLI razonable; estado mostrado no es necesariamente runtime en ejecución. A7. |
| Update/staging | bin/update.mjs | Veredictos caducables, rutas sin validar y restage destructivo. A3. |
| Runtime discovery | lib/runtime.mjs + bin/blockfire | Centralizar fue correcto; fallback staged y enlaces crean incoherencia. A4. |
| Instalación | install.sh | Copias mutables y enlaces ligados al árbol anterior. A4. |
| Observabilidad | bin/session-report.mjs | Cuenta eventos antiguos y solo primer header; cohortes insuficientes. A5. |
| Compatibilidad | test.sh + lib/check_composition.py + contract | Montaje real añadido; logs y gates incompletos. A2. |
| Guard/autonomía | host/guard.js + personas | Heurística, no confinamiento. No ampliar regex para fingir sandbox. A6/A8. |
| Integración juego | skills + tools/bf | Buen punto de entrada; no añadir wrappers; corregir recetas imprecisas. A6/A9. |

## Orden de implementación

1. **A1 + A2:** terminar el frente abierto y cerrar su verificación. Máxima certeza.
2. **A3 + A4:** asegurar que se verifica, activa y arranca exactamente el árbol
   correcto. No mezclar esta reparación con una actualización de DSH.
3. **A5 + A6:** reparar medición e instrucciones que inducen decisiones erróneas.
4. **A7:** corregir información engañosa del Update Center.
5. **A8 + A9:** ejecutar pruebas de incertidumbres y comparación de capacidad;
   implementar cambios adicionales solo si sus resultados lo justifican.

Cada frente debe poder revisarse y verificarse por separado. No crear todas las
infraestructuras propuestas de una vez ni usar este inventario como workflow
obligatorio para los modelos que desarrollan el juego.

## A1 — Capacidades JIT: lifecycle, visibilidad y estado fiable

**Archivos/funciones:** `presets/build/plugins/capabilities.js`: `activate`,
`deactivate`, `registeredNames`, `describeAll`, `mounted`, `ownerCtxOf`;
`tests/mount.mjs` y `tests/plugins.test.mjs`.

**Confirmado:** retorno Fiber tratado como función; consulta de tools sin scope.
Ambos tienen corrección parcial y prueba real, descritas arriba.

**Confirmado por lectura, sin corregir:** `prefixOf(spec)` presupone MCP para
TODAS las capacidades. Cordis no tiene serverName ni tools `mcp__...`, así que
list puede decir «tools not registered yet» aunque Cordis esté listo.

**Implementación indicada:**

- Conservar `fiber.await()`/`fiber.dispose()` y scope explícito.
- Declarar selector de tools por capacidad: `toolPrefix` para MCP y prefijo
  `cordis_` si coincide con el catálogo instalado de Cordis; comprobar nombres
  reales antes de fijarlo. No hardcodear la regla MCP en el router genérico.
- Montar solo con agente/contexto de sesión válido; si falta, retornar un error
  claro. No caer silenciosamente a montaje compartido en el preset.
- Registrar estado antes de un await susceptible de intercalarse: usar una
  entrada por sesión/capacidad con estado `starting`, Fiber y promesa, para que
  dos on simultáneos no creen dos montajes. No crear otro servicio global.
- En off, esperar limpieza antes de anunciar éxito. Si falla, conservar estado
  diagnóstico suficiente para saber qué quedó vivo. Error de cleanup no debe
  borrar el error original de arranque.
- Atar el registro al lifecycle del agente (WeakMap por agente o efecto de su
  contexto que quite la entrada), no conservar indefinidamente IDs en un preset
  standing. Comprobar comportamiento de resume antes de decidir persistencia.
- Evitar afirmar ACTIVE solo porque `plugin()` devolvió algo. Diferenciar montaje
  correcto de disponibilidad de servicio externo; MCP necesita su propia evidencia.

**Aceptación:** mismo scope ve tools, otro no; on/off/on funciona; dos on a la vez
no duplican; plugin que rechaza async devuelve error y no deja tools; cerrar
sesión activa libera la capacidad; list de Cordis identifica sus tools reales.
Fixture local para lifecycle; una prueba MCP real cuando haya Blender. No exigir
Blender en la suite offline ni asegurar que quedó verificado sin ejecutarla.

## A2 — Compatibilidad: comportamiento real y evidencia correctamente clasificada

**Dueños:** `test.sh`, `tests/mount.mjs`, `lib/contract_check.mjs`,
`lib/check_composition.py`, `contract/contract.json`.

**Qué hacer:**

- Mantener nueva prueba de montaje real contra el runtime explícito. No retirar
  el control negativo ni volver a usar logs antiguos para certificar candidato.
- Separar veredictos: PASS del montaje, FAIL de incompatibilidad, SIN EVIDENCIA
  de sesiones/modelos externos. --live debe dejar claro qué alcanzó a verificar.
- En checkLog, validar datos de eventos presentes y obligaciones causales: si
  existe una llamada completada debe haber resultado; no exigir tool/call si
  el modelo nunca usó tools. Sesión vacía no certifica nada, tampoco prueba rotura.
- Tratar campos de usage opcionales como no disponibles según adapter, no como
  cero ni incompatibilidad automática (reasoning/cache no siempre se reportan).
- El contrato exacto de tools se aplica a sesión BASE nueva con settings conocidos.
  Configuración multi-model puede añadir `list_subagent_models`; no interpretar
  ese delta autorizado como deriva ni ampliar silenciosamente todos los contratos.
- `check_composition.py:visit` salta `cordis:group` mediante continue y no recorre
  sus configs: su promesa de comprobar todas las filas es demasiado amplia.
  Delegar validez semántica al loader real; si se conserva el chequeo estructural,
  recorrer grupos/includes, detectar ciclos y duplicados anidados. No reimplementar
  el algoritmo completo de patches de Cordis en Python.
- La prueba shell de duplicados tampoco recorre configs de grupos; cubrir el
  caso si se mantiene. No usar dos comprobaciones parciales como autoridad.
- Añadir al contrato documentado las APIs realmente usadas por mount.mjs y por
  Fiber/scope. No ampliar el prompt del modelo con esa lista.

**Aceptación:** fixtures sin tools válidas, header malformado inválido, paquete
faltante en grupo detectado, servicio host faltante detectado, sin credenciales
ni LLM necesarios para pruebas offline. Registrar explícitamente versión probada.

## A3 — Updates: el PASS debe pertenecer al contenido que se activa

**Dueño:** `bin/update.mjs`: `stage`, `verify`, `activate`, `rollback`,
`readState`, `writeState`, `releaseNotes`.

**Confirmado por lectura:**

- stage concatena `version` en una ruta y ejecuta rmSync recursivo sin validar
  versión/contención. Un argumento con `..` puede salir de staging. No reproducir
  eso contra el estado real; probar solo con fixture temporal.
- Restage borra la carpeta de esa versión: puede ser el runtime activo/previous.
  Contradice la garantía de no tocar el proceso/tree actual.
- stage NO invalida `state.verified[version]`; activate solo mira `ok === true`.
  El PASS anterior puede aprobar una reinstalación diferente o una capa cambiada.
- writeState escribe directamente; lectura inválida se trata como estado vacío.
  Dos escritores (incluido check desde Web) pueden perder actualizaciones.
- rollback no valida que el árbol anterior siga existiendo.

**Implementación indicada:**

1. Validar versión exacta admitida antes de tocar disco; rechazar tags/rutas y
   separadores. Verificar contención con rutas resueltas. Confirmar que el package
   instalado tiene la versión solicitada. Usar semver compatible si ya está
   disponible; no escribir otro parser parcial innecesario.
2. Staging en directorio NUEVO por intento/generación; nunca borrar ACTIVE ni
   previous. Publicar la referencia en estado solo tras instalación completa.
3. Invalidar veredicto en cada nuevo staging. Guardar identidad de generación,
   fingerprint de capa/contrato/test relevante y del árbol de dependencias usado
   (como mínimo lockfile/metadata de instalación); definir qué protege el hash.
   activate rechaza si la identidad/fingerprint cambió desde verify. Un timestamp
   o solo la versión NO es identidad del contenido.
4. Estado por escritura temporal + rename en mismo directorio. Añadir exclusión
   breve de mutaciones o chequeo de revisión para no perder cambios concurrentes.
   Lectura de JSON corrupto falla claro y conserva el archivo, no borra el pin.
5. rollback valida el destino antes de cambiar estado. activate repetido al mismo
   árbol no reemplaza previous por el propio active.
6. Poner deadline explícito al fetch de releaseNotes. Mantener check sin instalación.

**Aceptación:** verify→restage→activate exige nuevo verify; verify→cambiar capa
exige nuevo verify; activo no se elimina al stagear su versión; ../ rechazado sin
writes; rollback ausente falla sin mutación; error/interrupción conserva estado
legible; dos operaciones no pierden active. Pruebas con npm simulado/fixtures,
no instalaciones de red para cada caso.

## A4 — Runtime e instalación: una sola identidad en TODO el proceso

**Dueños:** `lib/runtime.mjs`: `resolveRuntime`, `overrideEntries`,
`activePinEntries`, `stagedEntries`; `bin/blockfire`; `install.sh`.

**Confirmado por lectura:**

- Resolver acepta staged como último recurso, incluso sin verificación: stage
  puede terminar convirtiéndose en arranque sin activate. Contradice el gate.
- Si pin active no existe cae a otro runtime. El launcher imprime el ganador,
  pero no garantiza que sea la versión elegida ni exige recuperación explícita.
- Overrides múltiples se resuelven con `find(ok)`: uno inválido y otro válido,
  o binario A + módulos B, no provocan contradicción explícita. El comentario
  promete una autoridad más estricta que la implementación.
- install.sh enlaza node_modules de cada preset a la versión de ESE momento.
  activate cambia state.json, pero ni activate ni launcher resincronizan esos
  enlaces. El import dinámico de Blender/Cordis puede usar A mientras host usa B.
- install reemplaza carpetas mediante rm+cp; no es una generación inmutable de
  preset. Hay ventana incompleta y cambios de disco durante sesiones vivas.

**Implementación indicada:**

- Resolución de arranque: override consistente → active válido → descubrimiento
  normal solo si no hay pin. Con pin roto, fallo accionable o recuperación
  EXPLÍCITA; no elegir otra versión sin expresar esa decisión.
- Staged se enumera para gestión/verify, no se arranca por fallback. Si solo hay
  staged, indicar verify+activate; no añadir un cuarto modo de usuario.
- Validar todos los overrides provistos y exigir mismo realpath de módulos.
- Garantizar enlaces/materialización del runtime elegido antes de arrancar.
  Solución inmediata: detectar drift y materializar coherentemente al arranque
  cuando no afecte generaciones vivas. Solución sostenible: directorios de
  despliegue por identidad de capa+runtime; cada proceso conserva su directorio,
  roster y enlaces. No basta retocar un symlink compartido mientras otro proceso
  antiguo puede activar una capacidad JIT. Elegir esto junto con A3.
- No convertir instalación en reconstrucción completa de DSH ni copiar node_modules.
  Reutilizar árbol inmutable elegido; cambios de presets son solo capa propia.

**Aceptación:** dos árboles fixture A/B; activar B produce host B y resolución
JIT B, proceso A conserva A; override contradictorio falla; pin ausente y staged
sin activar no arrancan por accidente; ninguna mutación de paquetes upstream.

## A5 — Métricas que permiten decisiones honestas

**Dueños:** `bin/session-report.mjs`: `resolveTargets`, `fold`;
`lib/contract_check.mjs` para vocabulario de eventos.

**Reparación concreta:**

- `--last N` explícito debe tener prioridad sobre DSH_SESSION_JSONL (hoy el env
  gana y puede devolver siempre una sesión aunque el agente pida cinco).
- Separar request/header observado de assistant/message con usage. Contar tools
  aunque usage falte; hoy el break temprano elimina también esas llamadas.
- Contar compaction por lifecycle real, vinculando compactionId y error del end;
  separar pruning, resumen exitoso, fallo y operación incompleta. No contar cada
  evento como una compactación ni tomar ausencia de usage como cero coste.
- Guardar cohortes por preset y ruta. Si cambia modelo no rotular todos los
  tokens de la sesión con el último modelo observado.
- Reportar por header tamaño/count de schemas y cambios de hash; primer/máximo/
  último y momentos de cambio bastan. Añadir medidas de contexto durable por
  separado de system/tools cuando el log lo permita; AGENTS no vive solo en system.
- No inferir ahorro de razonamiento, calidad o cache de caracteres de esquema.
  No añadir coste/precios inventados. Marcar no disponible en datos ausentes.

**Pruebas:** fixtures de dos rutas, usage ausente, JIT on/off, compactación
exitosa/fallida, env+--last. Comparación de report antes/después sobre los mismos
logs para corregir contadores, no como mejora del modelo.

## A6 — Menos instrucciones contradictorias; mejores recetas del juego

**Dueños y ediciones:**

- `blockfire-harness/SKILL.md`: sustituir rutas blockfire obsoletas por build y
  creator; delegar mapa/contrato a ARCHITECTURE.md; mencionar nueva prueba real.
- `blockfire-orientation/SKILL.md`: eliminar orden de arranque duplicado (actualmente
  pone doctor antes de PROJECT_RULES, al revés de AGENTS). Enlazar AGENTS y mantener
  solo reglas de selección de contexto que no estén allí. No exigir releer la
  misma orientación por cada cambio menor de área.
- `blockfire-evidence/SKILL.md`: referencia al mapa canónico de tests; no crear
  una segunda matriz que diverja. Conservar distinción visual mirado/inferencia.
- `blockfire-android-qa/SKILL.md`: no recomendar `adb install -r builds/*.apk`;
  seleccionar el APK generado exacto y serial concreto desde scripts del repo.
  Verificar qué imprime doctor: aquí no reportó ruta adb, aunque la skill promete
  que sí. No bloquear al modelo por falta de información que puede descubrir de
  forma read-only mediante el dueño existente. No añadir nuevo wrapper Android.
- `blockfire-animation-craft/SKILL.md`: doctor comprueba conexión, no demuestra
  que la GUI tenga el blend correcto. Pedir inspección real de escena/archivo al
  entrar en craft. Conservar autoridad .blend y CRAFT_LOCKED.
- Persona CREATOR: cambiar «para inspeccionar o modificar el runtime, activa
  cordis» por «para inspeccionar/modificar el runtime VIVO». Leer código instalado,
  composiciones y tests no necesita pagar Cordis ni arriesgar colisiones globales.
- Personas/arquitectura: guard es prevención heurística de ciertos comandos,
  no protección universal de credenciales o de fuera del workspace. No anunciar
  propiedades que regex no implementa; no convertirlo en parser/sandbox gigante.

**Aceptación:** mismas cinco skills o menos si una queda enteramente redundante;
ninguna ruta antigua ni dos órdenes de arranque; catálogo no crece; recetas se
contrastan con comandos reales. Medir reducción de texto, sin atribuirle mejora
causal de calidad hasta A9. Respetar reglas del proyecto y autorizaciones del usuario.

**Decisión de arquitectura:** la regla «permanente si uso ≥25%» es una heurística,
no un gate. Frecuencia depende de tareas previas y de visibilidad de la tool.
read_image puede ser rara y esencial para BLOCKFIRE. No quitar primitives solo
por frecuencia ni asumir que sustituir web_fetch por curl siempre preserva
extracción/feedback. Mantener superficie actual hasta observar tareas reales.

## A7 — Web: mostrar la verdad sin ampliar privilegios

**Dueños:** `bin/update.mjs:status/activeTree/installedTree`,
`web/lib/index.js:apply/runCli`, `web/lib/client.js:UpdateCenter`.

**Confirmado por lectura:** runningInstall consulta el resolver actual; no prueba
qué árbol cargó el proceso Web. Cliente rotula launcher pin usando status.active
(que también contiene fallback cuando no hay pin). Ignora checkError: fallo de
consulta puede mostrarse como «not checked». Backend check escribe lastCheck en
estado aunque se describe read-only; no instala, pero sí muta metadata.

**Reparación indicada:**

- Separar running (capturado al boot), selectedForNextLaunch, pinned y discovered.
  Si running no está disponible, mostrar desconocido, no adivinar por PATH.
- Usar status.pinned para la fila pin; mostrar pinStale y checkError explícitamente.
- Precisar que la ruta consulta metadata y puede actualizar lastCheck; no agregar
  stage/activate por HTTP en este frente. Autoridad de mutaciones sigue en CLI.
- Limitar tiempo de toda la consulta y evitar peticiones de check simultáneas
  redundantes con una promesa en vuelo; no añadir un servicio de colas.
- Prueba en navegador del registro settings.section y carga __ModuleLoader__,
  además de HTTP. Un bundle que parsea no demuestra que la página funciona.

**Aceptación:** arrancar A, seleccionar B: UI distingue A actual/B próximo; sin
pin no inventa pin; fallo de red muestra error; consulta nunca instala ni activa;
servidor y navegador de prueba cerrados. No requiere que el usuario elija modelo.

## A8 — Incertidumbres: pruebas antes de soluciones

No implementar parches grandes basados en estos riesgos sin reproducirlos.

| Riesgo | Prueba concreta | Cambio solo si falla |
|---|---|---|
| Cordis process-global concurrente | Dos agentes CREATOR activan Cordis en host aislado y luego desactivan | Error accionable y ownership explícito; preferir arreglo upstream. No serializar TODO CREATOR ni crear fork. |
| Capacidad JIT tras resume | Activar fixture, cerrar/reabrir sesión y pedir list/on | Estado reconstruido o mensaje explícito de que requiere reactivación; nunca ACTIVE falso. Persistir intención mínima solo si compensa. |
| Fork/subagent hereda tools de padre con capacidad | Padre activa fixture, crear hijo/fork y mirar scopes; cerrar padre | Definir ownership/política por contrato DSH; no copiar disposers ni introducir registries alternos. |
| Modelo distinto sin visión | read_image y petición real a segundo adapter | Descubrir soporte de imágenes y reportar límite; no afirmar QA visual mediante texto. |
| Compaction omite evidencia relevante | Tarea con objetivo, corrección, tests y artifact paths; forzar /compact y continuar | Primero ajustar evidencia recuperable/checkpoint; solo después hook mínimo, sin reemplazar motor. |
| Pruner borra error importante en medio de un output | Fixture largo con diagnóstico central, compactar y recuperar original | Mantener ruta de log/spill consultable; no desactivar pruning globalmente sin medir. |
| Bash salta instrucciones anidadas | Fixture con AGENTS anidado, bash vs read/edit | Preferir lectura estructurada del dueño antes de editar; no parsear shell para detectar cwd. |
| Política no coincide con promesa del launcher | Crear sesión nueva por launcher, leer eventos permission/approval | Ajustar mecanismo soportado DSH; no introducir preguntas rutinarias ni adivinar env vars. |

## A9 — Criterio final: capacidad del mismo modelo, no tamaño por sí solo

**Dueño de evaluación:** `harness/test-cases.md` y report de A5.
Cambiar caso D actual: obliga a añadir una capacidad para pasar aceptación aunque
no haga falta. Sustituir por «diagnosticar una capacidad rota y justificar si se
cambia». Una prueba del harness no debe recompensar añadir infraestructura.

Preparar 3 tareas acotadas sobre mismo commit y checkouts aislados: encontrar un
fallo de lógica con test existente; localizar una regresión visual con captura
conocida; continuar un diagnóstico tras compaction con una corrección del usuario.
Usar mismo modelo/ruta/reasoning/budget en genérico y BUILD, con verificador
independiente de si el agente dice que pasó. Repetir si es viable; registrar
variación. Si el hardware/visión no están disponibles, no fabricar el caso visual.

Comparar éxito correcto, evidencia válida, tiempo, tokens, relecturas y necesidad
de intervención. Cache se registra como explicación de coste, no objetivo de
calidad. No cargar este protocolo en todas las sesiones; es evaluación ocasional
de arquitectura. No añadir más herramientas hasta que un fallo indique cuál falta.

## Definición de terminado para este documento

Este archivo entrega **mapa general + diagnóstico + solución + dueño + pruebas**.
A1/A2 ya tienen cambios parciales; A3–A9 son instrucciones, NO implementaciones.
Las conclusiones de lectura son INFERENCIA sobre ejecución hasta probarlas. No
se ha certificado todo DSH ni toda combinación de modelos. El siguiente agente
puede empezar por A1 sin pedir otra arquitectura al usuario ni repetir la auditoría.
