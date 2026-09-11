# BLOCKFIRE Harness

Capa delgada sobre DeepSeek Harness. No es un fork y no edita `node_modules`.
Solo existen dos espacios visibles: **BUILD** para trabajar en el juego y
**CREATOR** para trabajar en `harness/`.

## Uso

```bash
harness/install.sh
harness/bin/blockfire
```

`harness/bin/blockfire` aplica la capa BLOCKFIRE, la política de permisos y el
runtime activo. Una sesión ya abierta conserva la composición con la que nació;
los cambios de preset aplican a sesiones nuevas.

## Principios

- Código, tests y git son la verdad del proyecto.
- El contexto permanente debe ser pequeño; el detalle se carga JIT.
- Capacidades pesadas usan `bf_capability`; no inflan todas las sesiones.
- `harness/lib/runtime.mjs` es el único resolutor de DSH.
- `harness/test.sh` es el contrato de compatibilidad con upstream.
- No hay plan mode, manager adicional ni workflow obligatorio.

## Espacios

**BUILD** monta la superficie normal de edición, shell, búsqueda, skills,
subagente básico y capacidades JIT. Su baseline del proyecto vive en la persona
del preset; no depende de `AGENTS.md` ni obliga a leer documentación al arrancar.

**CREATOR** reutiliza la misma superficie base y añade lo necesario para trabajo
del harness: delegación completa, goals, `web_fetch` y la capacidad JIT de
Cordis. No recibe contexto de gameplay.

## Capacidades JIT

```text
bf_capability on blender        # loop mínimo: exec + screenshot
bf_capability on blender-full   # puente Blender completo
bf_capability on cordis         # solo CREATOR
bf_capability off <capability>
```

`blender` y `blender-full` no conviven. La opción mínima existe para no pagar el
esquema completo cuando solo hacen falta ejecución y captura.

## Web

La capa Web añade sin tocar upstream:

- Update Center;
- stats de sesión junto a la actividad, conservando turns, steps, LLM time,
  tool time, TTFT, TPS, cache, input y output;
- botón `+ New`;
- borrado permanente de conversación mediante la ruta host BLOCKFIRE.

El borrado usa las fronteras disponibles de la versión actual. Upstream todavía
no ofrece una operación única `sessionPersistence.delete(id)` +
`workspaceRegistry.removeSession(id)`, así que esa ausencia sigue siendo una
costura conocida y documentada en `ARCHITECTURE.md`.

## Update Center

```bash
node harness/bin/update.mjs status
node harness/bin/update.mjs check
node harness/bin/update.mjs stage <version>
node harness/bin/update.mjs verify <version>
node harness/bin/update.mjs activate <version>
node harness/bin/update.mjs rollback
```

El proceso en marcha nunca se reemplaza. Una activación aplica al siguiente
arranque y conserva el anterior para rollback.

## Verificación

```bash
harness/test.sh
harness/test.sh --live
harness/test.sh --network
harness/test.sh --self-test
node harness/bin/session-report.mjs --last 5
```

La suite comprueba composición, runtime, tools/skills montadas, plugins, router
JIT, contrato de logs y sincronía de la instalación. `--live` añade evidencia de
sesiones reales; ausencia de evidencia no se convierte en PASS.
