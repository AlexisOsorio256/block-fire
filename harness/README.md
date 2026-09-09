# Capa BLOCKFIRE del harness

Esta carpeta es **todo** lo que BLOCKFIRE añade a DeepSeek Harness. No es un
fork, no parchea paquetes y no vive dentro de DSH: solo compone capacidades que
DSH ya ofrece y añade un plugin mínimo propio.

```
DSH upstream (paquetes en node_modules/@deepseek-ai/*)   ← nunca se edita
        ↓
preset `blockfire` (esta carpeta)                        ← capacidades de la sesión
        ↓
skills on-demand (contexto progresivo)                   ← se cargan solo si encajan
        ↓
proyecto BLOCKFIRE (AGENTS.md, docs/, tools/bf, game/)   ← hechos y verificación
```

Actualizar DSH = actualizar paquetes. Nada de aquí se reconstruye.

## Inicio de una sesión BLOCKFIRE

```
harness/install.sh          # sincroniza repo -> $DSH_HOME/.agent-presets/blockfire
```

- **Web GUI**: en la sesión nueva, elige **BLOCKFIRE** en el chip de preset. Para
  que sea el preset por defecto: *Settings → Agent presets → BLOCKFIRE → make
  default*.
- Solo la superficie **Web** compone presets en esta versión de DSH
  (0.1.2-rc.1): los perfiles `headless` y `tui` componen el agente a nivel de
  proceso y no leen el roster. Una tarea puntual por CLI con este preset no es
  posible sin cambiar el host, y eso está fuera del alcance de esta capa.

Una sesión ya abierta conserva la composición con la que nació; un cambio en el
preset aplica a la siguiente.

## Componentes y responsabilidad

| Componente | Responsabilidad | Por qué existe |
|---|---|---|
| `presets/blockfire/agent.cordis.yml` | Compone las filas que la sesión necesita | Una sola entrada obvia; sin cargar DSH entero |
| `presets/blockfire/preset.yml` | Nombre y descripción en el selector | Aparece como "BLOCKFIRE", no como un id |
| `presets/blockfire/plugins/capabilities.js` | Router de capacidades pesadas (`bf_capability`) | Blender MCP son 28 tools / ~7.4k tokens de esquema que la mayoría de sesiones no usa |
| `presets/blockfire/skills/*/SKILL.md` | Contexto especializado bajo demanda | El catálogo cuesta ~100 tokens; el cuerpo se paga solo cuando se carga |
| `install.sh` | Materializa la capa en `$DSH_HOME` y enlaza `node_modules` | La instalación es un artefacto; el repo es la fuente |
| `test.sh` | Smoke de la capa (forma, resolución, skills, plugin, drift) | Un cambio sin prueba es una opinión |
| `bin/session-report.mjs` | Lee el log de sesión y reporta tokens, cache, tools y skills | Cache y contexto medidos, no afirmados |

El preset monta: persona BLOCKFIRE, `AGENTS.md` como baseline durable, bash,
fs + búsqueda, jobs, skills, goals, plan mode, compaction, delegación
(`subagent`, `subagent_fork`, `list_agents`) y web. Deliberadamente **no**
monta `tool-workflow` ni `tool-ralph`: cuestan esquema en cada request y
BLOCKFIRE rara vez necesita fan-out masivo. Añadir sus filas (copiadas del
preset shipped `standard`) es un cambio de configuración, no de arquitectura.

## Contexto: divulgación progresiva

En el prompt inicial solo entra:

1. la identidad y el contrato de trabajo (persona, ~500 tokens, sin hechos
   volátiles);
2. `AGENTS.md` como mensaje durable (la tarjeta operativa del proyecto);
3. el catálogo de skills: una línea por skill.

No entra `PROJECT_RULES.md`, ni `docs/ARCHITECTURE.md`, ni `CURRENT_STATE.md`,
ni README, ni CREDITS, ni el historial de git, ni capturas, ni logs. Todo eso se
lee **cuando la tarea lo pide**, desde el archivo que lo posee.

Según la tarea:

| Tarea | Se carga |
|---|---|
| Orientación / cambio de área | `blockfire-orientation` |
| Cierre de cualquier tarea | `blockfire-evidence` |
| Animación, rig, pose | `blockfire-animation-craft` (+ activa Blender MCP) |
| Input táctil, APK, rendimiento | `blockfire-android-qa` |
| Cambiar esta capa | `blockfire-harness` |
| Nada de lo anterior | ninguna: solo `tools/bf` y el código dueño |

## Cache: prefijo estable por diseño

La métrica que protege el diseño es la tasa de acierto de KV-cache. Reglas:

- **Nada volátil en el prompt.** HEAD, P0, estado, capturas y logs viven en el
  repo y llegan como resultado de tool, nunca al principio de la conversación.
- **Catálogo de tools estable durante la sesión.** Por eso Blender MCP está
  apagado por defecto: activarlo a mitad de sesión invalida el prefijo desde el
  esquema de tools. Una sesión que nunca pide Blender mantiene el prefijo
  byte a byte durante toda su vida.
- **Skills no rompen el prefijo.** El catálogo se emite como mensaje durable al
  inicio; cargar un cuerpo añade contenido al final.
- **Medición disponible**: `node harness/bin/session-report.mjs` reporta por
  sesión tokens de prompt, no cacheados, cacheados, % de acierto, tamaño del
  system prompt, número de tools y esquema total.

## Portabilidad de modelo

El preset no nombra proveedor ni modelo en ninguna fila. Cambiar de modelo es
cambiar la selección (`/model`, o `agent-default-model` en `settings.yaml`); la
capa BLOCKFIRE no cambia. El tuning por modelo (cuántas skills cargar de golpe,
cuánto contexto por turno) se ajusta aquí y se documenta como tuning, nunca como
dependencia estructural.

## Auto-mejora

El agente puede modificar esta capa cuando el trabajo real demuestre que algo
estorba: una skill inútil, una tool ausente, contexto redundante, un gate
incorrecto, una capacidad difícil de descubrir. El procedimiento está en la
skill `blockfire-harness`: editar aquí → `install.sh` → `test.sh` → sesión
nueva → commit. **Nunca** se edita la instalación de DSH ni un preset shipped.

## Pruebas

Tres niveles, de más barato a más real:

1. **Estático** — `harness/test.sh`: forma de la composición, resolución de cada
   fila contra la instalación de DSH, frontmatter de las skills, sintaxis del
   plugin y drift entre repo y copia instalada. Sin llamadas al modelo.
2. **Montaje real** — en una sesión con el preset `cordis`, un plugin temporal
   llama a `agentPresets.standingKeyFor('blockfire')` (la comprobación que hace
   el propio DSH al abrir sesión) y, con el `scope` devuelto, lista el catálogo
   de skills. Es la prueba de que la composición se monta y de que las skills
   resuelven:

   ```js
   return {
     name: 'preset-probe',
     inject: ['agentPresets', 'skills'],
     apply(ctx) {
       harness.registerTool(ctx, harness.defineTool({
         name: 'preset_probe',
         description: 'Mount-validate a preset and list its skill catalog.',
         parameters: { id: { type: 'string', required: true } },
         output: { schema: { type: 'string' }, render(_a, v) { return [{ type: 'text', text: v }] } },
         async execute(args) {
           const scope = await ctx.agentPresets.standingKeyFor(args.id)
           const skills = await ctx.skills.list({ scope })
           return 'MOUNT OK ' + args.id + '\n' + skills.map((s) => `${s.name} [${s.source}]`).join('\n')
         },
       }))
     },
   }
   ```

   Se define con `cordis_define` + `cordis_run`, se llama una vez y se retira con
   `cordis_undefine`.
3. **Sesión real** — una sesión BLOCKFIRE en la GUI. Es la única prueba de
   comportamiento del agente, y la que cierra la aceptación. Después:
   `node harness/bin/session-report.mjs --last 1` reporta tokens, cache, tools y
   skills de esa sesión. Los cuatro casos de aceptación, listos para copiar y
   pegar, están en `test-cases.md`.

## Riesgos conocidos

1. La copia instalada puede desincronizarse del repo; `test.sh` y
   `install.sh --check` lo detectan, pero hay que ejecutarlos.
2. El enlace `node_modules` de la copia instalada apunta a la instalación de
   DSH activa; si cambia la ruta de instalación, hay que re-ejecutar
   `install.sh`.
3. Activar una capacidad pesada invalida el prefijo de cache desde el esquema de
   tools de esa sesión (compensado por tenerla apagada por defecto).
4. Un preset solo se monta al crear la sesión: cambiar la composición no afecta
   a sesiones vivas.
5. Las skills envejecen: si una regla del proyecto cambia y la skill no, la
   skill miente. Por eso cada skill enlaza al archivo dueño en vez de copiarlo.
