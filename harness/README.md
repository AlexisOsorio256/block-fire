# BLOCKFIRE Harness

Capa delgada sobre DeepSeek Harness. No es un fork y no edita `node_modules`.
Solo existen **BUILD** para el juego y **CREATOR** para `harness/`.

## Uso

```bash
harness/install.sh
harness/bin/blockfire
```

Una sesión conserva la composición con la que nació; cambios de preset aplican
a sesiones nuevas.

## Diseño

- Código, tests y git mandan; detalle y capacidades se cargan JIT.
- BUILD y CREATOR mantienen la misma superficie permanente mínima.
- BUILD tiene skills del proyecto y Blender JIT (`blender` mínimo, `blender-full`
  solo al escalar).
- CREATOR no carga contexto, skills ni Blender del juego; conserva solo skills
  de autoría del harness y `cordis` JIT.
- El prefijo permanente es el producto: `presets/build/plugins/prompt.js` se une
  al waterfall `system-prompt/assemble` y ajusta lo que el modelo recibe —
  descripciones cortas en inglés, ninguna sección que solo repita una
  descripción, y el texto de sandbox coherente con la política real de la
  sesión. Parámetros y semántica no se tocan: solo prosa.
- Trabajo visual no está cerrado hasta inspeccionar la captura real; exportar o
  generar una imagen sin verla no prueba calidad.
- Todo lo que lee el modelo es inglés; la respuesta al usuario es español.
- `harness/lib/runtime.mjs` es el único resolutor DSH.
- `harness/test.sh` es el contrato con upstream.
- Sin plan mode, goals permanentes, manager adicional ni workflow obligatorio.

## Presupuesto de contexto

`node harness/bin/context-report.mjs` mide, sin llamadas al modelo, el prefijo
permanente de cada espacio (system + contexto + schemas + catálogo de skills) y
lo desglosa por dueño con `--details`. Es la evidencia antes de tocar el prompt;
el token real de una sesión lo da `session-report.mjs --last 1`.

La suite congela **system + schemas** con un techo de 17.500 caracteres por
espacio en `tests/mount.mjs`: falla si el prefijo crece en silencio o si una tool
pierde sus parámetros. No se guarda aquí un número "actual" porque se volvería
obsoleto con el siguiente ajuste de persona/upstream; el valor autoritativo es
el que imprime el `mount`/`context-report` de la versión que realmente está
instalada. Las optimizaciones conservan los marcadores que el modelo necesita
reconocer en resultados (`[exit code: N]`, `[sandbox: ...]`, `[status: ...]`,
`wait: true`).

Cada persona declara además el objetivo de su modo, porque es una directiva
permanente y no prosa: CREATOR hace medible la eficiencia de todo lo que lee el
modelo sin canjear reglas, marcadores ni semántica de parámetros por texto más
corto; BUILD mejora el juego sin sacrificar animación, calidad visual ni game
feel, y no reescribe nada sin una razón medida.

## Web

La capa añade Update Center, borrado de conversaciones y stats junto a la
actividad: turns, steps, LLM, tools, TTFT, TPS, cache, input y output. **New
Session** pertenece al sidebar upstream; BLOCKFIRE usa ese seam y no duplica el
control.

DSH actual hace la persistencia de sesiones append-only y no expone delete. Por
eso **Delete** es deliberadamente de dos fases: mientras Web está vivo primero se
registra durablemente el id pendiente, y solo después se archiva/desacopla
mediante APIs oficiales. Al siguiente `harness/bin/blockfire`, antes de abrir
nuevos handles, `purge-sessions.mjs` elimina log y projection cache. Una cola
corrupta no se sobrescribe ni se interpreta como vacía. En runtimes antiguos con
la forma legacy existe un fallback compatible.

## Update Center

La Web debe ser el camino normal. El CLI de diagnóstico sigue disponible:

```bash
node harness/bin/update.mjs status
node harness/bin/update.mjs check
node harness/bin/update.mjs stage <version>
node harness/bin/update.mjs verify <version>
node harness/bin/update.mjs activate <version>
node harness/bin/update.mjs rollback
```

Update = stage aislado → suite contra el candidato → activate solo si PASS. La
versión en marcha no se toca; el launcher exporta su versión real para que la
Web no la adivine re-ejecutando el resolver. Re-stage invalida el veredicto
anterior y rollback falla si su árbol ya no existe. Tags/versiones con sintaxis
de ruta se rechazan antes de crear o borrar staging; si el host se cierra durante
un update, no puede arrancar el siguiente paso después del teardown.

## Verificación

```bash
harness/test.sh
node harness/bin/context-report.mjs --details
node harness/bin/session-report.mjs --last 5
node tools/audit-repo.mjs
```

`harness/test.sh` incluye las regresiones baratas de guard, updater, delete/purge,
integridad de logs y lifecycle Web antes de depender de QA físico. Para auditar
logs reales del DSH instalado usa `--live`; reconoce tanto
`session.v3.jsonl.zstd` como el nombre legacy. Una última línea JSONL a medio
escribir puede ser una sesión viva; corrupción en medio no se convierte en
métricas aparentemente completas.

Para inspeccionar cambios **visuales del Web harness** sin tocar el `DSH_HOME`
real ni copiar credenciales:

```bash
node harness/tests/visual-boot.mjs
```

Arranca un host Web aislado con fixture visual y puerto efímero por defecto; la
captura/página debe mirarse realmente para contar como evidencia. Termina con
Ctrl-C/SIGTERM para disponer el host y borrar su árbol temporal.

`tools/audit-repo.mjs` audita el repositorio del juego antes de limpiar nada:
assets que nada referencia, metadata huérfana de Godot, refs de herramienta que
anclan objetos muertos y caché regenerable, cada hallazgo con su tamaño y su
prueba. No borra: propone. Su test corre dentro de `harness/test.sh` contra un
repo fabricado con basura a propósito, en las dos direcciones: que detecte y que
no grite en falso.

`--live`, `--network` y `--self-test` añaden evidencia cuando corresponde. La
ausencia de evidencia nunca se presenta como PASS.
