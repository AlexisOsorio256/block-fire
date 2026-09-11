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
- `harness/lib/runtime.mjs` es el único resolutor DSH.
- `harness/test.sh` es el contrato con upstream.
- Sin plan mode, goals permanentes, manager adicional ni workflow obligatorio.

## Web

La capa añade Update Center, `+ New`, borrado de conversaciones y stats junto a
la actividad: turns, steps, LLM, tools, TTFT, TPS, cache, input y output.

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
node harness/bin/session-report.mjs --last 5
```

`--live`, `--network` y `--self-test` añaden evidencia cuando corresponde. La
ausencia de evidencia nunca se presenta como PASS.
