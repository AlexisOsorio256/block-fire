# Capa BLOCKFIRE del harness

Esta carpeta es **todo** lo que BLOCKFIRE añade a DeepSeek Harness. No es un
fork: compone capacidades que DSH ya ofrece, añade dos plugins pequeños y una
página Web propia. Actualizar DSH = actualizar paquetes.

Las decisiones de arquitectura, la frontera con DSH y los riesgos están en
**`ARCHITECTURE.md`**. Esto es solo el manual de uso.

```
DSH upstream (paquetes @deepseek-ai/*)          ← nunca se edita
        ↓
perfil Web + capa de parche host/               ← guard, Update Center, roster
        ↓
dos espacios: BUILD / CREATOR (presets/)        ← lo único que el usuario elige
        ↓
skills on-demand + capacidades JIT              ← se pagan solo cuando se usan
        ↓
proyecto BLOCKFIRE (AGENTS.md, docs/, tools/bf) ← hechos y verificación
```

## Arrancar

```
harness/install.sh          # repo -> $DSH_HOME (presets + parche host + plugin web)
harness/bin/blockfire       # arranca la superficie Web con la política y el parche
```

`harness/bin/blockfire` es la forma normal de arrancar el producto: aplica la
capa de parche, fija la política de permisos (sin prompts de aprobación, porque
Godot/Blender/Gradle/adb escriben fuera del workspace) y arranca la versión que
el Update Center tiene activa. `dsh web` a secas sigue siendo el despliegue
upstream puro, sin filas BLOCKFIRE.

Una sesión ya abierta conserva la composición con la que nació; un cambio en un
preset aplica a la siguiente sesión.

### Runtime

`harness/lib/runtime.mjs` es el **único** resolutor del runtime DSH: lo consumen
el launcher, `install.sh`, `test.sh` y el Update Center. No hace falta un `dsh`
global ni `npm i -g`: en una shell nueva resuelve, en este orden, el runtime
ACTIVE del Update Center, un `dsh` en el PATH (o en la shell de login), un
`node_modules` local o global, el caché de `npx @deepseek-ai/dsh` y, como último
recurso, un candidato staged. Devuelve siempre binario **y** `node_modules` del
mismo árbol, que es lo que resuelven las capacidades opcionales (Blender MCP).

```
node harness/lib/runtime.mjs            # qué runtime usaría BLOCKFIRE y por qué
node harness/lib/runtime.mjs --json     # candidatos y diagnóstico
BLOCKFIRE_DSH_BIN=/ruta/lib/bin.js harness/bin/blockfire    # forzar uno
```

`command -v dsh` por sí solo no basta: bajo `npx`, `dsh` existe solo dentro de
ese proceso npx.

## Los dos espacios

| Espacio | Para qué | Superficie permanente |
|---|---|---|
| **BUILD** | Trabajo normal sobre el proyecto: código, animación, Android, QA | 18 tools, ~16.5k caracteres de esquema |
| **CREATOR** | Trabajo sobre el harness: presets, plugins, runtime, compatibilidad | BUILD + delegación completa + goals + `web_fetch`; el toolset Cordis es una capacidad JIT |

Plan mode no está montado en ninguno: una máquina de estados de "planear antes
de actuar" no aporta a un modelo que ya inspecciona, decide e itera, y medía 0
usos en las sesiones reales.

## Capacidades JIT

```
bf_capability                 # lista lo declarado y su estado
bf_capability action=on  capability=blender
bf_capability action=on  capability=cordis
bf_capability action=off capability=blender
```

- `blender` (BUILD y CREATOR): puente MCP a Blender GUI. Apagado por defecto.
- `cordis` (solo CREATOR): inspección y modificación del runtime. Apagado por
  defecto.

Activar una capacidad cambia el catálogo de tools y por eso invalida la cache
desde la posición del esquema. Compensa solo para capacidades pesadas; una tool
pequeña que casi no se usa se elimina, no se esconde aquí.

## Contexto

En el prompt permanente solo entran: la persona del espacio (identidad +
contrato del harness), `AGENTS.md` como mensaje durable y el catálogo de skills
(una línea por skill). Los hechos del proyecto — HEAD, P0, estado, assets,
teléfono, últimos tests — viven en el repo y se leen cuando la tarea los pide.
Un hecho tiene un dueño: los hechos del proyecto los posee `AGENTS.md` y
`docs/`, y la persona no los repite. El arranque es `tools/bf doctor` + git +
el código dueño; los documentos se leen cuando la tarea los necesita, no de
rutina.

| Tarea | Skill |
|---|---|
| Cierre de cualquier tarea | `blockfire-evidence` |
| Animación, rig, pose | `blockfire-animation-craft` (+ capacidad `blender`) |
| Input táctil, APK, rendimiento | `blockfire-android-qa` |
| Cambiar esta capa | `blockfire-harness` (solo CREATOR) |
| Escribir una composición / un plugin (CREATOR) | `editing-cordis-compositions`, `cordis-plugin-development` |

## Update Center

```
node harness/bin/update.mjs status      # qué corre, qué está staged, qué pasó la suite
node harness/bin/update.mjs check       # canales, versiones nuevas, release notes
node harness/bin/update.mjs stage <v>   # instala el candidato en un árbol aislado
node harness/bin/update.mjs verify <v>  # corre harness/test.sh contra ese árbol
node harness/bin/update.mjs activate <v># solo si pasó; guarda la anterior
node harness/bin/update.mjs rollback
```

Nada se reemplaza solo y el proceso en marcha nunca se toca: el cambio aplica al
siguiente arranque. Estado en `$DSH_HOME/.blockfire-harness/state.json`.

En la Web, **Settings → BLOCKFIRE** muestra el estado (instalado, pin, staged,
verificado) y ofrece el botón de comprobación. No instala nada desde la UI.

## Superficie Web (plugin propio)

`web/` añade, sin tocar archivos upstream, cuatro piezas sobre slots reales del
frontend:

- **Stats de sesión** junto a la actividad: turns · steps, tiempo de LLM,
  velocidad de decode, cache hit y tokens de entrada/salida, leídos de las
  proyecciones `sessionStats`/`tokenUsage` — se actualizan mientras el agente
  trabaja. Va encima del dock de To-Do (que de otro modo la tapa) y debajo de
  la línea de estado; el strip que DSH monta debajo del composer queda
  anulado por id + prioridad.
- **Botón `+ New`** junto a Settings en el pie del sidebar: nueva sesión en el
  workspace actual/reciente (el `+` por-fila de upstream solo aparece al
  hover).
- **Borrado permanente** de la sesión abierta (Dos clics: armar + confirmar)
  vía `POST /blockfire/session/delete`: quita la cuenta del workspace por los
  puntos de escritura del propio registro, borra el directorio del log y la
  entrada del cache de proyecciones. Una sesión con agente en RUN se rechaza.
  El seam mínimo que falta upstream: `sessionPersistence.delete(id)` +
  `workspaceRegistry.removeSession(id)` como una operación durable.
- **Update Center** (sin cambios).

## Pruebas

```
harness/test.sh                 # suite de compatibilidad (sin llamadas al modelo)
harness/test.sh --network       # además comprueba detección de updates real
harness/test.sh --live          # además compara la superficie con sesiones reales
harness/test.sh --self-test     # controles negativos: la suite DEBE fallar
node harness/tests/plugins.test.mjs
node harness/tests/report.test.mjs
node harness/tests/mount.mjs
node harness/bin/session-report.mjs --last 5
```

`test.sh` comprueba: estructura, sintaxis y tests unitarios de los plugins,
fixtures de los contadores del report, resolución de cada fila (paquete
instalado, archivo relativo, include, patch sin target), composición real del
árbol con `dsh --profile web --patch ... --dump-config`, contrato del log de
sesión (PASS / FAIL / SIN EVIDENCIA, con fixtures), contrato de superficie por
espacio, sincronía de las copias instaladas y (con `--network`) el Update
Center.

`tests/mount.mjs` hace lo que la composición estática no puede: arranca un host
Web aislado (DSH_HOME efímero, puerto loopback, sin telemetría ni llamadas al
modelo), monta los dos presets de verdad y prueba contra el runtime vivo: la
superficie de tools y skills de cada espacio, el ciclo completo de una
capacidad (`on`/`list`/`off` dos veces, aislamiento entre sesiones), un plugin
cuyo arranque rechaza (error original, nada quedó montado) y el cierre de una
sesión con una capacidad activa (la entrada se libera; una sesión con el mismo
id empieza OFF). Lo que sigue sin probar: comportamiento del modelo, el bundle
cliente en un navegador, MCP externo (Blender) y Android.

## Auto-mejora

El agente puede modificar esta capa cuando el trabajo real demuestra que algo
estorba: una skill inútil, contexto duplicado, una capacidad difícil de
descubrir, cache degradado, una incompatibilidad upstream. Procedimiento:
editar aquí → `install.sh` → `test.sh` → sesión nueva → commit. **Nunca** se
edita la instalación de DSH ni un preset shipped.
