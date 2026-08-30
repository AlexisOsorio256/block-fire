# 5 DIRECCIONES — Investigación (Pulse Dam y Rebot Persistente descartados)

> **Pulse Dam DESCARTADO. REBOTE PERSISTENTE DESCARTADO (2026-08-30).** Históricos en `historico/` y `*_PULSE_DAM_HISTORICO.md`. No hay juego activo. Se investigan **5 arquitecturas radicalmente distintas** en `PROPUESTA_GAMEPLAY.md` (A Masa Bifurcada, B Destrucción que Construye, C Colocación Física, D Corte de Flujo, E Cadena Programable).

> **No se programa hasta elegir 1 de las 5.** Cada dirección usa input familiar (drag/tap/swipe) pero cambia ≥2 dimensiones (objetivo, consecuencia, posicionamiento, cadena, relación entre acciones).

---

## Qué es

**No hay juego activo.** Hay 5 direcciones en investigación profunda, cada una `BASE PROBADA + MUTACIÓN FUERTE` (nivel 3-4), con `INPUT SIMPLE + MUCHAS DECISIONES`.

- **A Masa Bifurcada** (Mob Control + Routing) — repartir masa en bifurcación, territorio persistente
- **B Destrucción que Construye** (Angry + Suika) — escombros se fusionan y se convierten en puente para el siguiente tiro **[tu favorita]**
- **C Colocación Física** (Clash + Pool) — colocar carta con física real que empuja
- **D Corte de Flujo** (Fruit + Laberinto) — cortar pared para desviar río automático
- **E Cadena Programable** (Peggle + Pin) — colocar pin + soltar bola, pin persiste 2 tiros

Ver detalle con loops 30s/60s y 20 preguntas en `PROPUESTA_GAMEPLAY.md`.

---

## Core Loop — Ejemplo de la favorita B (Destrucción que Construye)

```
VER torre + escombros disponibles
↓
ELEGIR qué estructura tirar (madera da muchos escombros pequeños, piedra pocos grandes)
↓
APUNTAR + LANZAR → derrumbe → escombros caen → 2 iguales se fusionan en viga
↓
COLOCAR viga como puente donde elijas
↓
LANZAR siguiente bola que REBOTA en tu puente y llega donde antes era imposible
↓
PUENTE se rompe y deja nuevos escombros → nuevo escenario
```

Segunda orden: `tiro → escombros → fusión → puente → siguiente tiro usa tu construcción`

---

## Qué estamos intentando conseguir

> **“Solo hago una cosa… ¿por qué tengo tantas cosas que pensar?”**

Que el jugador diga “sé cómo funciona” en 5s, “oh, pero puedo hacer esto” a los 30s, y “espera, si hago esto primero, puedo hacer aquello” a los 60s.

Input tonto (drag/tap/swipe), decenas de decisiones **sin añadir niveles/cartas/poderes**: qué, dónde, cuándo, qué sacrificar, qué preparar, qué riesgo asumir.

---

## Estado actual

```
BASES PROBADAS: 12 juegos investigados (Angry, Mob, Pool, Clash, Peggle, Suika, Vampire, Fruit, Donut + 3)
MUTACIONES: 5 direcciones radicalmente distintas (A-E) en PROPUESTA_GAMEPLAY.md
STATUS: READY FOR CHOICE — 5 DIRECTIONS (no hay ganador, no se programa)
DESCARTADOS: Pulse Dam (presa), Rebot Persistente (Pool+HP) — “hacer mejor el mismo tiro” no es profundidad
```

- Infraestructura reutilizable lista: Canvas, resize/DPR, pointer/touch, loop/delta, audio, partículas, shake/hitstop, harness, helpers (ver `PROPUESTA_GAMEPLAY.md` §A)
- Gameplay Pulse/Rebot eliminado conceptualmente, `game.js` sigue histórico (se refactorizará solo con infra A cuando elijas 1 de las 5)
- Informe completo: `PROPUESTA_GAMEPLAY.md` (A-S + segunda investigación 5 direcciones + demo 60s con consecuencias explícitas + 100 partidas sin contenido)
- Históricos archivados: `historico/` + `capturas/historico-pulse/` (8.7M total, root solo 4 .md + código)

**No agregar tienda, monedas, niveles, skins hasta validar core con 20 preguntas de profundidad.**

---

## Cómo ejecutar (cuando elijas 1 de las 5 y haya MVP)

```bash
python3 -m http.server 8000
# abrir http://localhost:8000
```

Controles dependerán de la dirección elegida (ej: B = drag para tiro + drag para colocar viga). Reutilizará `pointer events` y `loop` existentes.

Parámetros futuros: `?capture=...` y `?runTests=1` reutilizando harness.

---

## Cómo probar (cuando haya MVP — 20 preguntas, no 6)

Para cada dirección, sin agregar niveles/cartas/poderes:

1. ¿Qué hace en 1s? 2. ¿Qué decisiones por partida? 3. ¿Cuántas diferentes sin features? 4. ¿Qué hace novato? 5. ¿Qué descubre a los 5 min? 6. ¿Qué domina a la hora? 7. ¿Qué hace experto que novato no? 8. ¿Riesgo/recompensa? 9. ¿Planificación? 10. ¿Ejecución? 11. ¿Improvisación? 12. ¿Cambiar estrategia? 13. ¿Espectacular inesperado? 14. ¿Cadena? 15. ¿“YO hice eso”? 16. ¿Material para cientos sin sistemas? 17. ¿Ver a otro y querer intentar? 18. ¿Clip 5-15s? 19. ¿Fallar interesante? 20. ¿Mejora por habilidad?

Si depende de contenido futuro → DÉBIL.

---

## Estructura

```
pulse-dam/ (repo renombrado pendiente → rebote-persistente)
├── README.md                           # este archivo (nuevo juego)
├── PROJECT_RULES.md                    # reglas canónicas nuevo juego
├── DESIGN_LOG.md                       # por qué Rebot Persistente, por qué no otros 39
├── PROPUESTA_NUEVO_JUEGO.md            # informe 40 conceptos + filtros + TOP
├── README_PULSE_DAM_HISTORICO.md       # histórico descartado
├── PROJECT_RULES_PULSE_DAM_HISTORICO.md
├── DESIGN_LOG_PULSE_DAM_HISTORICO.md
├── capturas/historico-pulse/           # evidencia Pulse Dam (no usar)
├── capturas/                           # vacía, para nuevo juego
├── game.js                             # histórico Pulse Dam (se refactorizará, solo infra A reutilizable)
├── index.html / style.css              # esqueleto reutilizable
└── RESET_TOTAL.md / INFORME_SHIELD_SURGE.md # históricos
```

---

## Reglas

- Ver `PROJECT_RULES.md` nuevo (no el histórico)
- Ver `PROPUESTA_NUEVO_JUEGO.md` para el porqué del ganador
- No programar metajuego/economía/tienda hasta validar core

---

*Última actualización: 2026-08-30 — Pulse Dam y Rebot Persistente descartados. 5 direcciones en investigación. No programar. — READY FOR CHOICE*
