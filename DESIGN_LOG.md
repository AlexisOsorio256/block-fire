# DESIGN_LOG.md — REBOTE PERSISTENTE (nuevo juego)

> Log del nuevo juego. Histórico Pulse Dam en `DESIGN_LOG_PULSE_DAM_HISTORICO.md`.

---

## 2026-08-30 — Reset total Pulse Dam

**Cambio:** Pulse Dam descartado como juego activo. Código y docs archivados como histórico (`README_PULSE_DAM_HISTORICO.md`, `capturas/historico-pulse/`). No rework.

**Motivo:** Orden maestra: no rescatar presa/compuerta/presión. Pulse era unidimensional (solo *cuándo* soltar), sin segunda orden, sin espacio de decisiones, sin personalidad. Añadir rutas o tipos de masa sería construir alrededor del juego.

**Hipótesis:** Conservar infraestructura genérica (canvas, loop, input, partículas, harness) y conocimiento (tests, principios), pero borrar gameplay obsoleto y buscar `BASE PROBADA + MUTACIÓN FUERTE`.

**Resultado:** `PROPUESTA_NUEVO_JUEGO.md` con 40 conceptos base+mutación, filtros y TOP 3. Ganador: REBOTE PERSISTENTE.

**Decisión:** Mantener reset. No volver a Pulse.

---

## 2026-08-30 — Elección de REBOTE PERSISTENTE como #1

**Cambio:** Elegido `REBOTE PERSISTENTE` (Pool base + posición persistente + totens hp/material) como mejor apuesta. Alternativa: TIRO CON RESERVA (Angry+Clash). Wildcard: PINTAR EL REBOTE.

**Motivo:** Tras 40 conceptos y 6 filtros (mucho que hacer, jugada, segunda orden, maestría 100 partidas, familiaridad, clon 0-1, comercial, técnico), RebotPersistente es el único que pasa los 4 tests de oro (identidad+jugabilidad+profundidad+WOW) con viabilidad Canvas baja, base probada 1B+, diferenciación 3 Remix, y segunda orden natural (dónde queda la bola).

**Hipótesis:** Un input tonto (drag) con 3 variables ocultas (ángulo, fuerza, dónde deja) + 6 totens con hp genera 15 decisiones por partida de 5 tiros sin un botón nuevo. El experto no es más rápido, es estratégico (falla a propósito para preparar combo).

**Resultado:** Simulación 5s/30s/60s/10/100 + anuncio + espectador + clip + partida sin features validada en `PROPUESTA_NUEVO_JUEGO.md`. MVP definido: 1 bola + 3 paredes + 6 totens + suelo persistente + línea 2 rebotes.

**Decisión:** Prototipar RebotPersistente primero. No programar metajuego/economía hasta validar 6 preguntas + 3 cualitativas en 5 testers.

---

## 2026-08-30 — Infraestructura reutilizable vs obsoleto

**Cambio:** Clasificado `game.js` 1862 líneas: **A reutilizable** (Canvas setup, resize/DPR, pointer events, loop, audio, partículas, shake, harness) vs **B obsoleto** (dam, gate, pressure, reservoir, overload, fort específico, scoring presión).

**Motivo:** Orden maestra: reutilizar lo genérico, borrar gameplay Pulse sin dejar código muerto.

**Hipótesis:** Nuevo `game.js` debe ser ~600 líneas solo con A + nueva física de 1 bola + 6 rects. Si queda código de presa, ensucia prototipo.

**Resultado:** Documentado en `PROPUESTA_NUEVO_JUEGO.md` §A/B. Próximo prototipo partirá de esqueleto limpio con solo A.

**Decisión:** Mantener clasificación. No mantener compatibilidad con Pulse.

---

*Próxima entrada: resultado del playtest del MVP de RebotPersistente (5 testers, 6 preguntas).*
