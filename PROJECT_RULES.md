# PROJECT_RULES.md — Constitución Canónica — ESCOMBROS (B — Destrucción que Construye)

> **Pulse Dam y Rebot Persistente descartados (2026-08-30).** Históricos en `historico/`. **B — Destrucción que Construye** tiene luz verde **solo para prototiparse** (no es el juego final). El prototipo decide si vive o muere.

---

## 1. IDENTIDAD

**Nombre operativo:** `ESCOMBROS` (provisional B)  
**Descripción:** Prototipo de 1 tiro drag → destrucción por material → escombros persistentes que se convierten en nuevo escenario para el siguiente tiro. No es Angry Birds con otro nombre: la diferencia estructural es que **los restos modifican el espacio del siguiente tiro**.

**Género:** Physics destruction + construcción efímera — One-drag, portrait.

---

## 2. OBJETIVO IRREFUTABLE

> **Comprobar si `TIRO → DESTRUCCIÓN → ESCOMBROS PERSISTENTES → NUEVA DECISIÓN` es divertido 5-10 minutos sin contenido que lo maquille. El prototipo debe permitir `APUNTAR → LANZAR → DESTRUIR → ALTERAR ESCENARIO → NUEVA DECISIÓN → LANZAR OTRA VEZ`.**

```
TIRO → DESTRUCCIÓN → RESTOS MODIFICAN ESCENARIO → ESCENARIO PERSISTENTE → NUEVA DECISIÓN → NUEVO TIRO
```

**Si después de 10 minutos solo es “apuntar mejor”, descartar. Si es “descubrir nueva forma de usar escombros”, continuar.**

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

## 8. MVP — PROTOTIPO B EN VALIDACIÓN

**Mínimo para B (ya construido, 32K):**
```
1 honda + 1 proyectil + 7 bloques (3 madera hp1, 2 piedra hp2, 1 target ★, 1 madera suelta) + suelo persistente
+ drag dirección+fuerza + trayectoria punteada 2 rebotes + física predecible + escombros que quedan
```
Nada más. Si no provoca 9/10 en la prueba de 10 preguntas, iterar posiciones/materiales, no añadir features.

Debug: `const DEBUG=false`

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

*Última actualización: 2026-08-30 — B prototipo jugable en validación. No es el juego final. El prototipo decide si vive o muere. — READY FOR PLAYTEST*
