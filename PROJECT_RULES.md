# PROJECT_RULES.md — Constitución Canónica — REBOTE PERSISTENTE

> **Pulse Dam descartado.** Este es el canon del nuevo juego. Históricos en `*_PULSE_DAM_HISTORICO.md`.

---

## 1. IDENTIDAD

**Nombre operativo:** `REBOTE PERSISTENTE` (temporal, hasta fantasía final)  
**Descripción:** Juego mobile-first de 1 bola que tiras con drag (ángulo+fuerza), rebota en paredes, rompe totens con hp/material, **y se queda donde cae**. Cada tiro cambia el siguiente.

**Género:** Física dirigida / Puzzle de posicionamiento — One-drag, portrait.

---

## 2. OBJETIVO IRREFUTABLE

> **Crear un loop donde el jugador entienda en 5s cómo tirar, descubra en 30s el rebote, domine en 60s la fuerza para dejar bien colocada la bola, y a las 10 partidas elija entre tiro seguro que deja bien vs tiro arriesgado que tira más pero deja mal, queriendo volver a corregir ángulo/fuerza.**

```
VER → ELEGIR OBJETIVO → APUNTAR → SOLTAR → REBOTE → IMPACTO → QUEDA → NUEVO ESCENARIO
```

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

## 5. PRINCIPIOS

- **SIMPLE DE CONTROLAR ≠ SIMPLE DE JUGAR:** 1 drag, decenas de situaciones (como Pool, Angry Birds, Clash)
- **BASE PROBADA + MUTACIÓN FUERTE:** Pool es base, mutación es persistencia + hp/material. Nivel 3 Remix, no clon
- **SEGUNDA ORDEN:** tiro cambia escenario del siguiente tiro
- **PLAYER AUTHORED:** “yo lo dejé bien/mal”
- **SMALL INPUT → LARGE CONSEQUENCE:** drag 2cm → 2 rebotes + 3 totens
- **FAST RETRY:** bola quieta → siguiente drag

Jerarquía: `GAMEPLAY > ESTABILIDAD > PERFORMANCE > UX > FEATURES` y `DIVERSIÓN > CLARIDAD > AGENCIA > ...`

---

## 6. COSAS PROHIBIDAS (MVP)

No agregar hasta validar core con 5 testers y las 6 preguntas + 3 cualitativas:

tienda, monedas, skins, inventario, cartas, energía, login, backend, leaderboard, multiplayer, anuncios, economía, misiones, battle pass, RPG, árbol mejoras, 20 niveles, tutorial largo, múltiples bolas, viento, materiales extra.

---

## 7. NO CLONAR

Inspirado en principios de Pool/Angry Birds/Peggle/Mob Control/Suika, pero NO copiar pájaros, resortera, mesa de billar, clavijas, puertas, cañones, etc. Identidad = *persistencia*.

---

## 8. MVP

```
1 bola + 3 paredes + 6 totens (3 madera hp1,2 piedra hp2,1 torre) + suelo persistente + línea 2 rebotes + score/best + retry
```
Nada más. Una escena. Si no provoca “otra”, iterar posiciones, no añadir features.

Debug: `const DEBUG=false` + `DEBUG_SKINLESS` (círculos/rects, sin partículas, para test sin arte)

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

*Última actualización: 2026-08-30 — RebotPersistente v0.1 — READY FOR PROTOTYPE*
