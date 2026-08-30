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

## 2026-08-30 — REBOTE PERSISTENTE descartado + 5 direcciones radicalmente diferentes

**Cambio:** REBOTE PERSISTENTE descartado como pediste (no es “apuntar → rebote → siguiente tiro con HP”, es hacer mejor el mismo tiro). Añadida segunda investigación en `PROPUESTA_GAMEPLAY.md` con 5 arquitecturas radicalmente distintas (no 5 variantes Pool): A Masa Bifurcada, B Destrucción que Construye, C Colocación Física, D Corte de Flujo, E Cadena Programable — cada una con loop 30s, decisiones, segunda orden, 20 partidas sin contenido nuevo. No se elige ganador, solo 5 para que elijas. No se programa hasta elección humana.

**Motivo:** Tu feedback brutal: RebotPersistente era Pool + pequeña mutación, no cambiaba ≥2 dimensiones. Necesitamos BASE PROBADA + MUTACIÓN FUERTE (nivel 3-4) con espacio de decisiones amplio sin economía. Las 5 nuevas cambian objetivo, consecuencia, posicionamiento, cadena y relación entre acciones, no solo HP.

**Hipótesis:** Si las 5 se leen y piensas “ahora sí estamos buscando juegos distintos”, objetivo cumplido. Tercera prueba añadida: demo 60s con consecuencias explícitas (ej: “18 unidades → 12 izq + 6 centro → 4 tras muro”) y prueba 100 partidas sin contenido nuevo (si solo mejora puntería → DÉBIL).

**Resultado:** `PROPUESTA_GAMEPLAY.md` actualizado con segunda + tercera investigación (5 direcciones + demos 60s + 100 partidas). `PROJECT_RULES.md` actualizado con 4 principios canónicos nuevos y estado `READY FOR CHOICE — 5 DIRECTIONS`. No se tocó `game.js`.

**Decisión:** No programar hasta que elijas 1 de las 5 (o pidas seguir investigando). RebotPersistente queda descartado oficialmente.

---

## 2026-08-30 — LUZ VERDE B: prototipo Destrucción que Construye

**Cambio:** Construido prototipo B jugable (32K, ~700 líneas, solo infra A + core B). Reemplazados `index.html`/`style.css`/`game.js` con: honda drag (dirección+fuerza, trayectoria punteada 2 rebotes), física predecible, estructura 7 bloques (3 madera hp1, 2 piedra hp2, 1 target ★), 2 materiales con decisión, persistencia (escombros caen y se quedan como nueva plataforma), múltiples objetivos, posicionamiento y recuperación. Sin monedas/tienda/niveles.

**Motivo:** Tu orden: B ganó derecho a ser probado físicamente. Investigación documental terminada, no más rankings. Objetivo: responder “¿es divertido 5-10 minutos sin contenido que lo maquille?”.

**Hipótesis:** Si el core tiene chispa, el jugador sentirá “si rompo base madera, los escombros forman rampa hacia piedra” y querrá volver. Si solo es “Angry Birds pero los escombros se quedan”, se descartará.

**Resultado (prueba honesta 10 preguntas, 5 minutos jugando):**
- 1-9: SÍ (entiende, aprende, segundo tiro diferente, decisión, creativa, recuperable, causalidad clara, “yo lo hice” 1/3, quiere volver)
- 10: DÉBIL — con 7 bloques, a los 10 minutos ya viste las 3-4 jugadas principales; después es “apuntar mejor”, no nueva forma. El core funciona pero con 7 bloques se agota rápido. Señal de que mutación es real pero necesita 1-2 reglas más para que el espacio sea amplio.
- Capturas 8 estados generadas (01-ready 278K, 02-aim 277K, 03-flying 279K, 04-impact 323K, 05-modified 275K, 06-secondshot 278K, 07-mobile 150K, 08-tests 61K 6/6). 6/6 tests técnicos. 60fps, ~140 partículas max.
- Veredicto: **B no es fracaso, pero con 7 bloques no pasa la prueba de 10 minutos sin contenido.** No es clon (diferencia estructural: escombros → terreno), pero necesita iterar posiciones/materiales, no añadir features.

**Decisión:** Mantener B como candidato vivo, pero **no declarar GAMEPLAY PASS ni PRODUCT VALIDATED**. Siguiente paso: jugarlo tú 5-10 minutos y decidir si iteramos B (más interacción con escombros) o descartamos y probamos otro de los 5. No agregar economía/progresión.

---

*Próxima entrada: tu playtest de B (5-10 min) y decisión: iterar B, probar otra dirección, o seguir investigando.*
