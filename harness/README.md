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
- Todo lo que lee el modelo es inglés; la respuesta al usuario es español.
- `harness/lib/runtime.mjs` es el único resolutor DSH.
- `harness/test.sh` es el contrato con upstream.
- Sin plan mode, goals permanentes, manager adicional ni workflow obligatorio.

## Presupuesto de contexto

`node harness/bin/context-report.mjs` mide, sin llamadas al modelo, el prefijo
permanente de cada espacio (system + contexto + schemas + catálogo de skills) y
lo desglosa por dueño con `--details`. Es la evidencia antes de tocar el prompt;
el token real de una sesión lo da `session-report.mjs --last 1`.

Medido con DSH 0.1.5-rc.2, system + schemas pasó de 21.381 a 16.976 caracteres
en BUILD (−20,6%) y de 21.171 a 17.134 en CREATOR (−19,1%): se elimina la prosa
duplicada y las descripciones quedan en el hecho operativo, conservando los
marcadores que el modelo tiene que reconocer en los resultados (`[exit code: N]`,
`[sandbox: ...]`, `[status: ...]`, `wait: true`). El prefijo completo
(system + contexto + schemas + catálogo de skills) queda en 18.541 y 19.192
caracteres. El techo vive en `tests/mount.mjs`, que falla si el prefijo crece en
silencio o si una tool pierde sus parámetros.

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
eso **Delete** es deliberadamente de dos fases: mientras Web está vivo se
archiva/desacopla mediante las APIs oficiales y se encola el id; al siguiente
`harness/bin/blockfire`, antes de abrir nuevos handles, `purge-sessions.mjs`
elimina log y projection cache. En runtimes antiguos con la forma legacy existe
un fallback compatible.

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
anterior y rollback falla si su árbol ya no existe.

## Verificación

```bash
harness/test.sh
node harness/tests/delete-current.test.mjs
node harness/bin/context-report.mjs --details
node harness/bin/session-report.mjs --last 5
node tools/audit-repo.mjs
```

`tools/audit-repo.mjs` audita el repositorio del juego antes de limpiar nada:
assets que nada referencia, metadata huérfana de Godot, refs de herramienta que
anclan objetos muertos y caché regenerable, cada hallazgo con su tamaño y su
prueba. No borra: propone. Existe porque una limpieza a mano (2.7 GB → 201 MB)
se hizo tres veces con grep y `du`, y porque borrar sin prueba es lo que casi
rompe el repo. Su test se ejecuta dentro de `harness/test.sh` contra un repo
fabricado con basura a propósito, en las dos direcciones: que detecte y que no
grite en falso.

`--live`, `--network` y `--self-test` añaden evidencia cuando corresponde. La
ausencia de evidencia nunca se presenta como PASS.