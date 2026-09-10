---
name: session-retrospective
description: >-
  Auto-revisión breve de tu propia trayectoria al cerrar una tarea
  significativa: qué costó de más, qué fue complejidad real y qué fricción
  evitable del harness, y qué mejora concreta se aplica con evidencia.
whenToUse: >-
  Antes de entregar el cierre de una tarea significativa (archivos cambiados,
  decisión no trivial ejecutada, problema real de varios pasos). No corre en
  preguntas y respuestas, lecturas sin cambio ni entregas triviales de un paso.
---

# Retrospectiva de cierre

La revisión la haces tú, sobre tu propia trayectoria, en el mismo turno de
cierre. No es un framework ni un analizador: tres preguntas con una barra de
evidencia. No interrumpe el trabajo, no pide aprobación, no abre tareas nuevas.

## Las tres preguntas

La evidencia es la trayectoria real de esta sesión — no lo que imaginas que
suele pasar:

1. **¿Qué costó más de lo necesario?** Pasos de más, exploración repetida, un
   dato que hubo que descubrir porque no estaba donde lo buscabas.
2. **¿Cuánto era complejidad real de la tarea y cuánto fricción evitable del
   harness?** Una primitiva que existía pero no se encontraba; una tool que
   faltó o que sobró; un documento dueño que no apuntaba donde hiciste el
   esfuerzo. La complejidad real se acepta; la fricción se corrige.
3. **¿Qué mejora concreta habría hecho este mismo trabajo más eficiente?**

## Barra de evidencia

Cada mejora candidata se justifica por separado. No hay cuota ni tope: detectar
varias no obliga a aplicar ninguna, ni limita cuántas pasan la barra.

- **Aplica directo** lo pequeño, causal y generalizable con un momento concreto
  de esta sesión donde habría cambiado lo que hiciste. Pequeño: una línea de
  documento, un ajuste de skill o persona, un valor de configuración. Causal:
  elimina exactamente la fricción observada. Generalizable: sobrevive a esta
  tarea y no depende de este caso.
- **Más que eso — contexto o tools permanentes, un componente nuevo, un cambio
  estructural — requiere una prueba medible ANTES de aplicarse**: línea base
  contra después con un instrumento real (`session-report`, la suite del
  harness, el contador que toque). Sin medición que demuestre el beneficio es
  una opinión: queda como observación en la respuesta, nunca como cambio.

## Límites

- Si la evidencia no es clara: no cambia nada y el cierre no se retrasa.
- Nada de framework, analizador o abstracción nueva para gestionar esto.
- Nada que degrade el cache del prefijo sin compensación medida.
- Lo que apliques se verifica proporcional al cambio y se reporta con el resto;
  lo que no se verificó queda `SIN VERIFICAR`, como siempre.
