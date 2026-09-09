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

El mapa completo de componentes, la frontera con DSH y los riesgos abiertos
están en `harness/ARCHITECTURE.md` — no se duplican aquí.

La instalación activa es una **copia** materializada por `harness/install.sh`:
los presets de cada espacio en `$DSH_HOME/.agent-presets/build|creator/` y las
filas host en `$DSH_HOME/profiles/web/`. Editar la copia se pierde; editar el
repo y sincronizar es el camino.

```
harness/
  presets/build/        # espacio BUILD: persona, superficie compartida, skills, plugins/
  presets/creator/      # espacio CREATOR: persona + deltas sobre la superficie de BUILD
  host/                 # capa de parche del perfil Web (guard, Update Center, roster)
  web/                  # página Settings → BLOCKFIRE y ruta /blockfire/update
  bin/                  # launcher, Update Center, session-report
  lib/                  # resolutor de runtime, chequeos de composición y contrato
  tests/                # unit tests de plugins, fixtures del report, montaje real
  install.sh            # repo -> $DSH_HOME (idempotente)
  test.sh               # suite de compatibilidad: montaje real + controles negativos
```

## Ciclo de cambio

1. Edita en `harness/` (nunca en `$DSH_HOME`).
2. `harness/install.sh` — sincroniza la copia activa.
3. `harness/test.sh` — boots reales: `tests/mount.mjs` arranca un host Web
   aislado con los dos presets y prueba la superficie y el ciclo de capacidades
   sin llamadas al modelo; los controles negativos deben fallar con
   `--self-test`.
4. Sesión nueva en la GUI (el preset se monta al crearla; una sesión viva no se
   recompone) para confirmar el efecto real. Después:
   `node harness/bin/session-report.mjs --last 1`.
5. commit + push del cambio de capa.

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
