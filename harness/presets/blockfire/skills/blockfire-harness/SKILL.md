---
name: blockfire-harness
description: >-
  Cómo mejorar la propia capa BLOCKFIRE del harness (harness/) sin tocar DSH:
  layout, instalar, probar, qué es upstream y qué reglas mantienen el cache.
whenToUse: >-
  Cuando una skill estorba o falta, una tool no existe, el prompt desperdicia
  tokens, una capacidad es difícil de descubrir, o hay que cambiar el preset.
---

# Mejorar la capa BLOCKFIRE

El agente puede modificar esta capa cuando el trabajo real demuestra que algo
está mal. No es un privilegio decorativo: es el mecanismo de evolución.

## Qué es de quién

| Capa | Dónde vive | ¿Se edita? |
|---|---|---|
| DSH upstream (paquetes) | `node_modules/@deepseek-ai/*` | **Nunca** |
| Presets shipped (`standard`, `cordis`, ...) | dentro de `dsh-agent-presets` | **Nunca** |
| Capa BLOCKFIRE | `<repo>/harness/` | Sí, aquí |
| Proyecto BLOCKFIRE | `game/`, `docs/`, `tools/bf`, ... | Solo si la tarea lo pide |

La instalación activa es una **copia** de `harness/` en
`$DSH_HOME/.agent-presets/blockfire/`. Editar la copia se pierde; editar el repo
y sincronizar es el camino.

```
harness/
  presets/blockfire/agent.cordis.yml   # el preset (una fila por capacidad)
  presets/blockfire/preset.yml         # nombre y descripción para el selector
  presets/blockfire/plugins/           # código propio de la capa (mínimo)
  presets/blockfire/skills/*/SKILL.md  # contexto bajo demanda
  install.sh                           # repo -> $DSH_HOME (idempotente)
  test.sh                              # smoke de la capa
  bin/session-report.mjs               # tokens/cache/skills/tools por sesión
```

## Ciclo de cambio

1. Edita en `harness/` (nunca en `$DSH_HOME`).
2. `harness/install.sh` — sincroniza la copia activa.
3. `harness/test.sh` — forma, resolución de filas, frontmatter, plugin y drift.
   Es estático: no prueba que la composición monte.
4. Montaje real: en una sesión `cordis`, un plugin temporal llama a
   `agentPresets.standingKeyFor('blockfire')` y lista `ctx.skills.list({ scope })`.
   El procedimiento completo está en `harness/README.md`. Si falla, el mensaje
   nombra la fila o el servicio culpable.
5. Sesión nueva en la GUI (el preset se monta al crearla; una sesión viva no se
   recompone) para confirmar el efecto real. Después:
   `node harness/bin/session-report.mjs --last 1`.
6. commit + push del cambio de capa.

## Reglas que mantienen el diseño sano

- **Prefijo estable**: la persona y el catálogo de tools no cambian dentro de
  una sesión. Nada volátil (HEAD, P0, listas de archivos, capturas, logs) entra
  en la persona. Eso vive en el repo y se lee bajo demanda.
- **Progressive disclosure**: el catálogo de skills es barato; el cuerpo se
  carga cuando la tarea encaja. Una skill nueva debe cambiar una decisión real,
  no repetir lo que ya dice `docs/ARCHITECTURE.md`.
- **Schemas caros = capacidades opcionales**: si un puente añade miles de
  tokens de esquema, decláralo en `config.capabilities` del preset y actívalo
  con `bf_capability`, no en la fila estática.
- **Una fila publica servicio ⇒ necesita `isolate`; una fila que solo consume
  servicio host ⇒ fuera de todo `isolate`.** Romper esto hace fallar el mount.
- **Pocos componentes**: antes de añadir un plugin o una tool, escribe qué
  problema real resuelve. Si la respuesta es "quizá sirva", no se añade.
- **No reimplementar el proyecto**: `tools/bf` sigue siendo el punto de entrada
  de verificación; bash sigue siendo la herramienta general.

## Portabilidad de modelo

El preset no menciona proveedor ni modelo. Cambiar de modelo es cambiar la
selección (`/model`, o `agent-default-model` en `settings.yaml`) — la capa
BLOCKFIRE no cambia. Si un modelo nuevo necesita otro *tuning* (por ejemplo más
o menos skills cargadas de golpe), eso se ajusta aquí y se documenta como
tuning, no como dependencia estructural.

## Antes de declarar la mejora hecha

`harness/test.sh` verde, copia sincronizada, y una frase en el commit que diga
qué problema real resolvía y cómo se comprobó. Si no puedes demostrarlo, no era
una mejora: era una opinión.
