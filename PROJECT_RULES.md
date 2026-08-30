# PROJECT_RULES.md — Constitución Canónica — 5 DIRECCIONES EN INVESTIGACIÓN

> **Pulse Dam descartado. REBOTE PERSISTENTE descartado (2026-08-30).** Históricos en `historico/` y `*_PULSE_DAM_HISTORICO.md`. No se programa hasta elegir 1 de las 5 direcciones de `PROPUESTA_GAMEPLAY.md`.

---

## 1. IDENTIDAD

**Nombre operativo:** `PENDIENTE — 5 DIRECCIONES` (A Masa Bifurcada, B Destrucción que Construye, C Colocación Física, D Corte de Flujo, E Cadena Programable)  
**Descripción:** No hay juego activo. Se investigan 5 arquitecturas radicalmente diferentes con `BASE PROBADA + MUTACIÓN FUERTE` (nivel 3-4). Cada una usa input familiar (drag, tap, swipe) pero lo que ocurre después debe tener espacio de decisiones amplio sin economía.

**Género:** Pendiente de elección humana. No Pool.

**Estado:** `NO PROGRAMAR — INVESTIGACIÓN`

---

## 2. OBJETIVO IRREFUTABLE

> **Encontrar una BASE PROBADA + MUTACIÓN FUERTE que produzca `INPUT SIMPLE + MUCHAS DECISIONES + SEGUNDA ORDEN + MAESTRÍA + ONE MORE TRY` sin necesidad de economía/progresión. La simplicidad del input es deseable. La simplicidad del gameplay NO.**

```
BASE PROBADA (ej: Mob Control, Angry Birds, Clash) + MUTACIÓN que cambie ≥2 dimensiones (objetivo, decisión, consecuencia, posicionamiento, cadena, relación entre acciones) = NUESTRO JUEGO
```

**Test de profundidad (20 preguntas) debe pasar sin agregar niveles/cartas/poderes. Si depende de contenido futuro, es DÉBIL.**

---

## 3. TEST IRREFUTABLE (10)

| # | Test | Pregunta |
|---|------|----------|
|1|COMPRENSIÓN|¿Entiende en 5s que drag y suelta tira?|
|2|AGENCIA|¿El resultado (totens + dónde queda) es claramente su culpa?|
|3|TENSIÓN|¿Duda entre seguro (1 toten + buena posición) vs arriesgado (2 totens + mala)?|
|4|PAYOFF|¿Rebote que tira torre se siente mucho mayor que el drag?|
|5|ASIMETRÍA|¿Un drag pequeño genera cadena de 2 rebotes + derrumbe?|
|6|APRENDIZAJE|¿Tras fallar esquina, sabe qué corregir (5° / fuerza)?|
|7|RETRY|¿Tras quedarse sin ángulo, quiere otra?|
|8|PERSONALIDAD|¿Con círculos+rectángulos+línea se reconoce?|
|9|FRUSTRACIÓN|¿Bola en esquina se siente “yo la dejé mal”, no “el juego me trolea”?|
|10|ONE MORE TRY|¿Dice “si apunto 5° más y tiro flojo...”?|

Si 10 es NO → NO está listo.

---

## 4. COSAS QUE APRENDIMOS (Pulse Dam)

Pulse Dam falló porque era **unidimensional** (solo *cuándo* soltar, sin *dónde/cómo*), sin segunda orden (reset cada ronda), sin espacio de decisiones, y personalidad prestada (presa genérica). No se rescata, no se hace v2.

---

## 5. PRINCIPIOS CANÓNICOS (añadidos 2026-08-30 por orden maestra)

- **El proyecto no busca una mecánica complicada; busca una interacción simple con un espacio de decisiones profundo. La simplicidad del input es deseable. La simplicidad del gameplay NO.**
- **No inventar la rueda cuando existe una base de gameplay probada. Investigar, extraer el mecanismo que funciona, mutarlo estructuralmente y construir una experiencia propia.**
- **La infraestructura existente se reutiliza por valor técnico; ninguna mecánica existente se conserva por sentimentalismo ni por coste hundido.**
- **Código reutilizable ≠ gameplay reutilizable.**
- **SIMPLE DE CONTROLAR ≠ SIMPLE DE JUGAR:** 1 drag/tap/swipe, decenas de situaciones (como Pool, Angry Birds, Clash)
- **BASE PROBADA + MUTACIÓN FUERTE (nivel 3-4 Remix/Nueva interpretación):** No clon (0) ni reskin (1)
- **SEGUNDA ORDEN:** acción cambia escenario del siguiente turno
- **PLAYER AUTHORED:** “YO hice eso”
- **SMALL INPUT → LARGE CONSEQUENCE:** 1 gesto → cadena visible
- **FAST RETRY:** siguiente decisión a un gesto

Jerarquía: `GAMEPLAY > ESTABILIDAD > PERFORMANCE > UX > FEATURES` y `DIVERSIÓN > CLARIDAD > AGENCIA > ...`

---

## 6. COSAS PROHIBIDAS (MVP)

No agregar hasta validar core con 5 testers y las 6 preguntas + 3 cualitativas:

tienda, monedas, skins, inventario, cartas, energía, login, backend, leaderboard, multiplayer, anuncios, economía, misiones, battle pass, RPG, árbol mejoras, 20 niveles, tutorial largo, múltiples bolas, viento, materiales extra.

---

## 7. NO CLONAR

Inspirado en principios de Pool/Angry Birds/Peggle/Mob Control/Suika, pero NO copiar pájaros, resortera, mesa de billar, clavijas, puertas, cañones, etc. Identidad = *persistencia*.

---

## 8. MVP — NO PROGRAMAR HASTA ELECCIÓN HUMANA

**REBOTE PERSISTENTE descartado.** No hay MVP activo.

Cuando se elija 1 de las 5 direcciones de `PROPUESTA_GAMEPLAY.md`, su MVP será:
- 1 escena, sin tienda/monedas/niveles/skins, solo infra A reutilizable (Canvas, loop, partículas, harness)
- Debe pasar los 20 tests de profundidad sin contenido nuevo

Debug: `const DEBUG=false` + `DEBUG_SKINLESS` (para test sin arte cuando haya MVP)

---

## 9. JUICE

Jerarquía `NORMAL < BUENO < PERFECTO < MASIVO` — polvo al caer, flash solo en torre. No todo al máximo.

---

## 10. AUDITORÍA FUTURA

1. Leer `README.md`
2. Leer `PROJECT_RULES.md` (este)
3. Leer `DESIGN_LOG.md`
4. Leer `PROPUESTA_NUEVO_JUEGO.md` (por qué este y no otros 39)
5. Inspeccionar código (solo infra A reutilizable, nada de presa)
6. Ejecutar, capturar, `?runTests` (técnico ≠ gameplay)
7. Playtest 5 personas con 6 preguntas + 3 cualitativas

No modificar porque “podría mejorarse” sin hipótesis en `DESIGN_LOG`.

---

## 11. ESTRUCTURA

```
├── README.md (nuevo)
├── PROJECT_RULES.md (este)
├── DESIGN_LOG.md (nuevo)
├── PROPUESTA_NUEVO_JUEGO.md (40 conceptos)
├── capturas/historico-pulse/ (Pulse descartado)
└── game.js (histórico, se refactorizará a ~600 líneas solo con infra A)
```

---

## 12. REGLAS MAESTRAS

> **NO INVENTAR LA RUEDA. NO CLONAR LA RUEDA. HACER UNA RUEDA QUE GIRA Y HACERLA NUESTRA.**

> **1–3 acciones + muchísimas situaciones, no 20 features.**

> **¿Si dejo solo círculo + rectángulos + línea, sigue siendo reconocible y divertido? Si NO, corregir core.**

---

*Última actualización: 2026-08-30 — 5 direcciones en investigación. REBOTE PERSISTENTE descartado. No programar. — READY FOR CHOICE*
