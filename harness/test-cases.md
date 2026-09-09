# Casos de aceptación de la capa BLOCKFIRE

Se escriben **tal cual** en una sesión nueva del espacio correspondiente. Lo que
se comprueba no es que el agente acierte, sino que el harness le da lo necesario
sin que el usuario lo explique y sin cargar lo que no hace falta.

Antes: `harness/install.sh` y `harness/test.sh`.
Después de cada caso: `node harness/bin/session-report.mjs --last 1`.
Al cerrar: `harness/test.sh --live` fija la superficie observada como contrato.

## A — tarea pequeña de código (BUILD) no carga Blender ni contexto visual

```
Arregla el typo de docs/CURRENT_STATE.md y corre la comprobación más barata que
lo pruebe. No abras Blender.
```

Debe cumplirse: ningún tool `mcp__blender__*` en el catálogo; ninguna skill de
animación cargada; `session-report` con ~18 tools y sin `bf_capability action=on`.

## B — tarea de animación descubre y activa Blender sin megaprompt

```
El clip ReloadPistol se ve rígido en la mano izquierda. Diagnostica y propone el
ajuste, usando la fuente .blend como autoridad.
```

Debe cumplirse: el agente carga `blockfire-animation-craft` y activa la capacidad
`blender` con `bf_capability` (o explica por qué no está disponible si Blender no
está abierto). `session-report` muestra `capabilities on:blender` y los tools
`mcp__blender__*` a partir de ese paso.

## C — un modelo distinto de DeepSeek sigue funcionando (BUILD)

```
tools/bf doctor
```

Cambia el modelo en el selector (p. ej. GLM) antes de enviar. Debe cumplirse: la
sesión arranca con el preset BUILD, el catálogo de tools es el mismo y
`session-report` reporta `model=` y `provider=` del modelo elegido. La capa no
nombra proveedor ni modelo en ninguna fila.

## D — CREATOR puede inspeccionar y modificar la capa

```
Lee harness/ARCHITECTURE.md y añade una capacidad JIT nueva al espacio BUILD
justificando el coste de esquema que ahorra.
```

Debe cumplirse: el agente carga `editing-cordis-compositions`, activa la
capacidad `cordis` para inspeccionar el runtime, edita `harness/`, ejecuta
`install.sh` + `test.sh` y deja el cambio listo para commit. Sin editar nunca la
instalación de DSH.

## E — incompatibilidad simulada produce FAIL claro

```
harness/test.sh --self-test
```

Debe fallar exactamente cuando la capa está rota. Los controles negativos
comprueban: paquete ausente, include ausente, patch que no matchea nada y plugin
relativo ausente. Si alguno no falla, la suite no sirve.

## F — detección de updates contra la fuente real

```
harness/test.sh --network
node harness/bin/update.mjs check
```

Debe cumplirse: se reportan los canales (`latest`, `next`, `alpha`), las
versiones nuevas con fecha y enlace a release notes, sin instalar ni reemplazar
nada. Un candidato solo se activa después de `stage` + `verify`.

## G — cero approval loops en trabajo normal

```
tools/bf test && tools/bf build android
```

Debe cumplirse: ninguna pregunta de aprobación. La política se aplica por
entorno (`harness/bin/blockfire` fija `danger-full-access` + `never`) y el límite
real es el guard de operaciones destructivas. Si el agente pide permiso para
leer, editar, testear, construir, capturar, commitear o pushear, la capa está mal.

## Qué mirar en el reporte

```
node harness/bin/session-report.mjs --last 1
```

- `preset=build|creator` — la sesión se compuso con el espacio correcto.
- `policy` — `sandbox=danger-full-access approval=never` (sin prompts).
- `first header` — tools y tamaño de esquema. Referencia medida: BUILD 18 tools /
  ~16.5k chars; CREATOR 24 / ~21.8k; con `cordis` activo, +7 tools / ~+7.5k.
- `schema cost` — qué fila permanente se está pagando más.
- `cache read` / `hit` — el prefijo se mantiene estable mientras no se active una
  capacidad.
- `skills loaded` — solo las que el caso justifica.
- `capabilities` — `on:blender` / `on:cordis` solo cuando la tarea lo pide.
- `tools used` — el camino que eligió el agente, sin ritual.
