---
name: blockfire-orientation
description: >-
  Cómo orientarse en BLOCKFIRE sin adivinar: sonda única del repo, quién posee
  qué, dónde vive el estado real de hoy y qué reglas no se duplican.
whenToUse: >-
  Primera tarea de una sesión, cambio de área (armas, HUD, mundo, bots, input),
  o cualquier momento en que no sepas qué archivo es dueño de un comportamiento.
---

# Orientación BLOCKFIRE

El proyecto ya documenta lo suyo. Esta skill solo dice **dónde mirar y en qué
orden**, no repite reglas: si algo vive en `PROJECT_RULES.md`,
`docs/ARCHITECTURE.md` o `AGENTS.md`, se enlaza, no se copia.

## Orden de arranque (5 minutos, sin suites largas)

1. `tools/bf doctor` — una sola llamada: HEAD, cambios sin commit, Godot,
   Blender + Blender MCP, teléfono conectado, armas y clips activos. Es la
   sonda; no la sustituyas por cinco comandos ad-hoc.
2. `PROJECT_RULES.md` — qué se puede y qué no (constitución).
3. `docs/ARCHITECTURE.md` — dueños, entradas/salidas, fuente de verdad, test
   que corresponde a cada área, y "no modificar para".
4. `docs/CURRENT_STATE.md` — estado real de hoy: verde/rojo, P0, siguiente
   tarea. Es el **único** estado operativo; `docs/history/*` es histórico.
5. El código dueño del comportamiento, no el que parece relacionado.
   `git status --short` y `git log --oneline -5` antes de tocar nada.

## Cómo decidir qué leer

- ¿No sabes quién manda en un comportamiento? `docs/ARCHITECTURE.md` tiene la
  tabla de dueños; no deduzcas el dueño por el nombre del archivo.
- ¿Necesitas el estado, no la arquitectura? `docs/CURRENT_STATE.md`.
- ¿Necesitas historia o por qué algo es así? `git log` sobre el archivo dueño
  antes de `docs/history/`.
- ¿Necesitas atribución/licencias de assets? `CREDITS.md`.

## Reglas de trabajo que no cambian

- Un solo escritor por dueño. Si tu cambio obliga a un segundo escritor, la
  decisión es de arquitectura, no de parche: dilo antes de implementarlo.
- Prioridades: estabilidad → gameplay → rendimiento → UX → inmersión →
  features. Un P0 se atiende por su causa, no por su síntoma.
- Godot 4.7.2 + GDScript, renderer Mobile, Android landscape-first. No reabrir
  rutas Unity/web/PWA/WebView/Capacitor.
- Linux es el laboratorio autónomo; el teléfono es la autoridad de plataforma.
- `tools/bf` es el punto de entrada único de verificación. No inventes un
  segundo camino de test si `bf` ya cubre el área.

## Trampas vistas

- Editar `docs/history/*` creyendo que es estado actual.
- Correr la suite completa para un cambio que solo pedía `--qa-<área>`.
- Deducir el dueño de un sistema por proximidad de carpetas.
- Reportar "funciona" sin haber ejecutado el test del área.

La evidencia de cierre está en `blockfire-evidence`; el craft de animación en
`blockfire-animation-craft`; Android en `blockfire-android-qa`.
