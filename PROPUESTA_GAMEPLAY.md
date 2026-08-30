# PROPUESTA GAMEPLAY — De Pulse Dam descartado a Base Probada + Mutación Fuerte

**Fecha:** 2026-08-30  
**Pulse Dam:** DESCARTADO como juego (conservado como histórico en `*_PULSE_DAM_HISTORICO.md` + `capturas/historico-pulse/`). Solo se reutiliza infraestructura genérica.  
**Objetivo:** No inventar mecánica desde cero. Encontrar **base validada por mercado** + **mutación que la haga nuestra** (nivel 3-4), con espacio de decisiones amplio sin necesidad de economía/progresión.

> No se escribe código en esta fase. Solo diseño con evidencia.

---

## A. Qué aprendimos de Pulse Dam y por qué falló

Pulse Dam tenía decisión real (`aguantar → riesgo → release`) y causalidad clara, pero falló como **juego** por tres razones estructurales:

1.  **Una sola variable:** Toda la profundidad era `cuánto tiempo aguanto`. Una decisión (timing) por partida. No había *dónde*, *cómo*, *qué* ni *con qué*. A las 10 partidas ya habías visto todo.
2.  **Sin segunda orden:** `tiro → resultado → reset`. Soltar no cambiaba el siguiente turno (fort reseteaba). No había “preparo la siguiente jugada”. Era `acción → puntos → otra vez`, no `acción → nuevo escenario → nueva decisión`.
3.  **Sin espacio de decisiones:** No emergía estrategia nueva. Más presión = más velocidad = más bloques, solo número. Un experto no hacía algo que un novato no consideraba, solo lo hacía con mejor timing.

**Regla extraída:** Si el verbo cabe en una palabra (`aguantar`) y no genera al menos 3 decisiones secundarias interesantes sin añadir features, el núcleo no tiene profundidad. Por eso se descarta completo, no se hace v2.

---

## B. Qué hace que Angry Birds sea simple pero profundo

**Input:** 1 drag (ángulo+fuerza) + suelta. Un niño lo entiende en 2s.

**Por qué no es aburrido (datos reales: 1B+ descargas, franquicia, 100M+ Angry Birds 2, físicas + bird skills):**

- **Trayectoria + estructura + material:** No es solo “darle al cerdo”. Madera se rompe distinto a piedra, cristal rebota, TNT explota. Cada estructura es un puzzle.
- **Selección:** En Angry Birds 2 eliges qué pájaro tirar (rojo directo, amarillo acelera, azul se divide, verde rebota). 3 pájaros en mano = 3 decisiones.
- **Consecuencia en cadena:** Un tiro tira una viga → viga cae sobre otra → otra cae sobre cerdo. No es tiro → puntos, es tiro → física → derrumbe.
- **Rejugabilidad:** Mismo nivel, 3 pájaros distintos, 3 estrategias.

**ADN:** `trayectoria + estructura + material + selección + cadena`

**Profundidad sin economía:** Ya con 3 pájaros y 6 estructuras tienes cientos de combinaciones. La tienda es monetización, no gameplay.

---

## C. Qué hace que Mob Control sea simple pero profundo

**Input:** 1 drag para apuntar cañón, mantienes para disparar stickmen por puertas `x2/x3` (datos: 100M+ descargas, Voodoo, 4.1★ 827K reviews, gates móviles, campeones).

**Por qué no es aburrido:**

- **Multiplicación visible:** 10 → 20 → 60 → 180. Consecuencia desproporcionada con input mínimo. El jugador *ve* el poder.
- **Posicionamiento + timing:** Puertas se mueven, hay puertas rojas que restan, boosts de velocidad. No es “dispara al centro”, es “espera 0.3s y entra por x3”.
- **Escalada + caos:** Tu masa crece pero también la enemiga. Debes decidir: ¿voy por x3 arriesgado o x2 seguro?
- **Campeones como recurso:** Barra que se llena al disparar → decides cuándo soltar campeón.

**ADN:** `posicionamiento + multiplicación + timing + escalada + caos`

**Profundidad sin economía:** Solo con 2 puertas móviles y 1 campeón ya tienes 4 decisiones por oleada.

---

## D. Qué hace que 8 Ball Pool sea simple pero profundo

**Input:** 1 drag (ángulo+fuerza) + efecto. Un toque.

**Por qué no es aburrido (1B+ descargas, 31.7M reseñas, Miniclip):**

- **Siguiente jugada:** No es meter una bola, es *dejar la blanca bien para la siguiente*. Cada tiro cambia el escenario del siguiente. El pro piensa 3 tiros adelante.
- **Geometría + fuerza + efecto:** Misma bola, 10 ángulos, 5 fuerzas, 3 efectos = 150 resultados.
- **Riesgo/recompensa:** Tiro fácil a tronera cercana vs tiro difícil que deja mejor posición. Defensa (safety) cuando no hay tiro claro.
- **Material (paño/bandas):** rebote no es 100% predecible, hay que dominar.

**ADN:** `puntería + fuerza + geometría + siguiente jugada + riesgo`

**Profundidad sin niveles:** Con 7 bolas en mesa ya tienes 50 situaciones. No necesitas 100 niveles.

---

## E. Qué hace que Clash Royale sea simple pero profundo

**Input:** 1 tap para colocar carta de mano de 4 (de un mazo de 8) en arena.

**Por qué no es aburrido (500M+, 41.7M reseñas):**

- **Selección + timing + posición:** Misma carta en puente vs atrás es juego distinto. Misma carta ahora vs en 2s es distinto.
- **Recurso que se recarga (elixir):** No puedes jugar todo. Cada carta es “¿ahora o después?”.
- **Counter y predicción:** Si él gasta 5 de elixir, tú castigas. Lees su mano.
- **4 cartas en mano = 4 decisiones constantes:** ¿qué juego, qué guardo, qué sacrifico?

**ADN:** `selección + timing + posición + recurso + counter + predicción`

**Profundidad sin progresión:** Con 8 cartas base (sin subir de nivel) ya tienes meta. Subir nivel es monetización, no profundidad.

---

## F. Qué hace que otros relevantes funcionen

**Peggle (PopCap, pinball + puzzle):** 1 tiro desde arriba → rebotes impredecibles pero leibles → naranjas obligatorias + verdes con poder + morada bonus + cubo que da bola extra. Simple, cadena visual, cada tiro es anticipación (“¿dónde va a rebotar?”). WOW de fiebre. Profundidad: elegir ángulo que maximice rebotes y cazar verde/morada.

**Suika (colocación+fusión):** Tap para soltar fruta arriba. 2 iguales → fusionan → siguiente. Espacio limitado. Decisión actual (dónde suelto) cambia espacio futuro. Muy adictivo con 0 economía. WOW: cadena de 3 fusiones.

**Vampire Survivors (pocas acciones, mucha escalada):** Mueves, eliges 1 de 3 mejoras cada nivel. Input simple, sistema genera espectáculo. Decisión: qué build escalo. Profundidad: sinergias.

**Donut County (agujero):** Drag agujero que crece al tragar. Muy simple, mundo cambia visiblemente. Decisión: orden de tragado. Profundidad: qué tamaño necesitas para cada objeto.

**Fruit Ninja (corte):** Swipe. Bombas como riesgo, combos por timing. Decisión: qué corto ahora, qué dejo, cuándo arriesgo.

**Twisted Tangle (manipular nudos):** Drag pines para desenredar. Niveles con llaves/cerraduras que cambian regla. Decisión: orden de desenredo.

---

## G. Patrones comunes encontrados

1.  **Input ridículamente simple** (1 drag, 1 tap, 1 hold) pero **variables ocultas** (ángulo, fuerza, timing, posición, qué dejo para después)
2.  **Consecuencia desproporcionada** (10 → 180, 1 tiro → derrumbe, 1 fusión → hueco)
3.  **Segunda orden obligatoria:** lo que haces ahora cambia el escenario del siguiente movimiento (blanca, mano, espacio, inclinación)
4.  **Riesgo visible y elegible:** puerta roja x2 vs x3, tiro fácil vs tiro perfecto, gastar elixir ahora vs después
5.  **Cadena, no recompensa plana:** tiro → rebote → otro impacto → combo (Peggle, Angry)
6.  **Autoría:** “YO lo dejé bien”, “YO elegí esa puerta”, “YO pinté ese rebote”
7.  **Espacio de decisiones grande sin botones:** 3-4 decisiones por turno con 1 gesto

Si un concepto no tiene 3+ de estos, es débil.

---

## H. 15-25 BASES DE GAMEPLAY PROBADAS (20 bases evaluadas)

| # | Base / Familia | Input | Decisión principal | Secundaria | Riesgo/Recompensa | Profundidad sin features | Espectáculo | Replay | Riesgo clon | Mutación posible |
|---|---|---|---|---|---|---|---|---|---|
|1|Angry Birds (trayectoria)|drag ángulo+fuerza|qué estructura ataco|qué pájaro, qué rebote|tiro fácil 1 cerdo vs difícil 3 cerdos|alta (material+orden)|derrumbre|alto|medio (resortera)|alta — segunda capa de decisión antes del tiro|
|2|Mob Control (multiplicación)|drag cañón|qué puerta (x2 vs x3 móvil)|timing, campeón|seguro x2 vs arriesgado x3|alta (posicionamiento)|masa x10|alto|alto (puertas)|alta — otra forma de multiplicar|
|3|8 Ball Pool (posicionamiento)|drag tiro|qué bola + dónde dejo blanca|fuerza, efecto, banda|tiro fácil mal deja vs difícil bien deja|muy alta (geometría)|carambola|muy alto|medio|alta — persistencia|
|4|Peggle (cadena)|drag tiro|qué ángulo maximiza rebotes|verde/morada, cubo|tiro centrado seguro vs lateral arriesgado|alta|fiebre|alto|medio|alta — zona colocable|
|5|Clash Royale (mano 4)|tap colocar|qué carta dónde y cuándo|elixir, counter, predicción|jugar ahora vs guardar|muy alta|push|muy alto|alto (cartas)|alta — otra mano|
|6|Suika (fusión)|tap columna|dónde suelto|qué fusión preparo, espacio|columna segura vs arriesgada que fusiona|alta|triple fusión|alto|alto (frutas)|alta — fusión que empuja|
|7|Donut County (agujero)|drag agujero|dónde pongo agujero|orden, tamaño|hueco pequeño seguro vs grande arriesgado|media|traga grande|medio|medio|media — agujero que encoge|
|8|Fruit Ninja (corte)|swipe|qué corto ahora|qué dejo, bomba|combo 3 vs bomba|media|combo|medio|bajo|media — corte que divide|
|9|Twisted Tangle (nudos)|drag pin|qué pin muevo primero|orden, llave|mover fácil vs que libera 2|media|desenredo|medio|bajo|media — llave angular|
|10|Vampire Survivors (escalada)|tap elegir (1 de 3)|qué mejora escale|sinergia|mejora segura vs arriesgada|alta|saturación pantalla|alto|medio|alta — 3 monedas escalables|
|11|Pool + Suika (fusión posicional)|tap columna|dónde fusionar para empujar|espacio|fusionar ahora vs preparar|alta|empuje|alto|bajo|alta|
|12|Tiro + Reserva (Clash+Suika)|tap elegir|¿juego ahora o reservo?|qué reservo|reservar vs jugar|alta|reserva revienta|alto|bajo|alta|
|13|Corte + Derrumbe (Jenga)|swipe viga|qué viga corto|qué deja para siguiente|viga central vs lateral|alta|derrumbe|alto|bajo|alta|
|14|Puzle encaje (Tetris)|drag colocar|dónde encaja y qué deja|rotación, siguiente pieza|encaje fácil vs que prepara línea|media|línea|medio|alto|media — reordenar cola|
|15|Ritmo (Vampire timing)|hold timing|cuándo soltar en ventana|racha|perfect arriesgado vs good seguro|baja|perfect|bajo|bajo|baja|
|16|Defensa posicional (Tower)|tap colocar torre|dónde coloco|qué torre, cuándo|torre cara vs barata|media|oleada|medio|medio|media|
|17|Física sandbox (Construcción)|drag colocar bloque|dónde pongo bloque|equilibrio, siguiente bloque|bloque seguro vs que tambalea|alta|torre alta|alto|bajo|alta|
|18|Matching (Candy)|swap 2|qué swap da cascada futura|preparar siguiente|swap 3 ahora vs preparar 4|media|cascada|medio|alto|media|
|19|Recolección (Donut empuja)|drag empuje|dirección empuje|dónde queda hueco|empuje corto vs largo|media|reordena|medio|bajo|media|
|20|Imán/Polo (Pool magnético)|tap imán + tiro|dónde imán y polo N/S|tiro|imán ayuda vs desvía|alta|curva magnética|alto|bajo|alta|

---

## I. 40 CONCEPTOS BASE+MUTACIÓN (resumen) / Ver detalle completo en PROPUESTA_NUEVO_JUEGO.md

Los 40 ya generados en `PROPUESTA_NUEVO_JUEGO.md` cumplen `BASE+MUTACIÓN` (no reskin de HP). Ejemplo de 8 representativos:

- **Pool + Persistencia** (Rebot Persistente) — Pool + bola queda → nivel 3
- **Angry + Mano 3** (Tiro con Reserva) — Angry + Clash → 4
- **Peggle + Zona x2 colocable** (Rebot que Multiplica) — Peggle + Mob → 4
- **Donut + Puente que cae** — Donut + física efímera → 4
- **Fruit + Corte 1 viga** — Fruit + Angry → 3
- **Suika + Empuje** — Suika + física → 3
- **Clash + Energía escalable** — Clash + Vampire → 3
- **Pool + Línea de rebote pintada** — Pool + Peggle → 4

Todos con diferenciación 2-4 (descartados 0-1).

---

## J. COMBINACIONES BASE+MUTACIÓN EXPLORADAS

Probadas 12 combinaciones coherentes, no “cualquier mezcla”:

- `Trayectoria + Recurso` (Angry + Clash)
- `Posicionamiento + Fusión` (Pool + Suika)
- `Destrucción + Selección` (Fruit + Angry)
- `Timing + Cadena` (Peggle + Mob)
- `Física + Estrategia` (Pool + Donut)
- `Apuntado + Progresión` (Pool + Vampire)
- `Matching + Physics` (Suika + Pool)
- `Tower + Direct Manipulation` (Donut + Pool)
- `Sports + Roguelite` (Pool + Vampire)
- `Puzzle + Chaos` (Suika + Peggle)

Descartadas por incoherencia: `Ritmo + Construcción` (no hay anticipación), `Memoria + Física` (choque de ritmos).

---

## K-L. 5 FINALISTAS (no elige automático, equilibrio diversión/base/diferenciación/profundidad/viabilidad)

### FINALISTA 1 — REBOTE PERSISTENTE (Pool)
- Base: 8 Ball Pool
- Mutación: posición persistente + totens hp/material
- Diferenciación: 3 Remix
- Viabilidad: Canvas 2D bajo

### FINALISTA 2 — TIRO CON RESERVA (Angry + Clash)
- Base: Angry Birds 2 + Clash Royale
- Mutación: mano de 3 proyectiles, eliges 1 por tiro, ves siguiente
- Diferenciación: 4 Nueva interpretación
- Viabilidad: Canvas 2D medio

### FINALISTA 3 — PINTAR EL REBOTE (Pool + Peggle)
- Base: Pool + Peggle
- Mutación: pintas 1 línea de rebote fantasma antes de tirar
- Diferenciación: 4
- Viabilidad: Canvas 2D medio (detección línea)

### FINALISTA 4 — FUSIÓN QUE EMPUJA (Suika)
- Base: Suika
- Mutación: fusión empuja vecinos (no solo libera espacio)
- Diferenciación: 3 Remix
- Viabilidad: DOM/Canvas medio

### FINALISTA 5 — CORTE QUIRÚRGICO (Fruit Ninja + Angry)
- Base: Fruit Ninja + Angry Birds
- Mutación: 1 corte en 1 viga por turno, estructura queda para siguiente turno (segunda orden)
- Diferenciación: 3 Remix
- Viabilidad: Canvas 2D medio (corte + física vigas)

---

## M. PARTIDA IMAGINARIA 60s — FINALISTAS

### REBOTE PERSISTENTE — 60s
0s Ve 6 totens, bola abajo centrada. Drag → línea punteada 2 rebotes → suelta → tira a madera, bola queda centrada.  
10s Tira a pared derecha → rebota a piedra hp2, piedra cae a medias (hp1), bola queda en esquina derecha (mala).  
20s Desde esquina, no tiene ángulo a torre. Decide tiro corto seguro a madera para recentrar bola. Madera cae, bola vuelve al centro.  
35s Ahora con ángulo, tira fuerte a pared izquierda → doble rebote → tira torre + piedra restante.  
50s Quedan 2 totens. Bola quedó arriba. Tira flojo directo, limpia.  
60s Score, bola queda. Piensa: “si en el segundo tiro hubiera tirado más flojo, no quedaba en esquina”.

### TIRO CON RESERVA — 60s
0s Ve 3 proyectiles: pesado, rebote, explosivo. Estructura madera + piedra. Elige rebote.  
15s Tira rebote a piedra, rebota y tira madera. Siguiente mano trae pesado.  
30s Guarda pesado, tira rebote pequeño a madera.  
45s Ahora con pesado, apunta a base piedra → atraviesa todo.  
60s Le queda explosivo, decide si lo guarda.

### PINTAR EL REBOTE — 60s
0s Pinta línea diagonal, tira, rebota donde no había pared y entra a toten.
20s Pinta línea corta, tira flojo, rebote pintado lo salva.
40s Pinta línea que sirve para tiro actual y deja bien para siguiente.
60s Línea mal pintada te saca, aprendes a pintar más corta.

### FUSIÓN QUE EMPUJA — 60s
0s Suelta burbuja, no fusiona.  
15s Suelta otra igual al lado, fusionan → empuje empuja tercera burbuja a hueco y fusiona de nuevo.  
35s Prepara fusión en esquina para empujar hacia centro.  
55s Empuje desordena, pierdes.

### CORTE QUIRÚRGICO — 60s
0s Ves torre con 5 vigas. Cortas viga central → derrumbe parcial, queda forma en L.  
20s Cortas viga de base de la L → resto cae hacia meta.  
40s Torre restante en equilibrio, cortas lateral → cae fuera, fallo.
60s Aprendes que cortar base primero era mejor.

---

## N. NOVATO / INTERMEDIO / EXPERTO

**REBOTE PERSISTENTE:**
- Novato: tira directo fuerte al centro.
- 5 min: descubre rebote pared y que fuerza deja bola cerca/lejos.
- 1h: empieza a elegir entre seguro (1 toten + buena posición) vs arriesgado (2 totens + mala).
- Experto: falla a propósito toten fácil para dejar bola perfecta para combo de 3, usa 2 paredes, conoce que esquina = -20°.

**TIRO CON RESERVA:**
- Novato: tira el que toca.
- 5 min: guarda explosivo para torre.
- 1h: cuenta qué viene en 2 turnos, sacrifica tiro débil para mano perfecta.
- Experto: no juega carta aunque sea buena si arruina siguiente mano.

**PINTAR EL REBOTE:**
- Novato: pinta línea recta.
- 5 min: pinta para corregir tiro malo.
- 1h: pinta línea que sirve para tiro actual y posiciona siguiente.
- Experto: pinta 2 segmentos implícitos.

**FUSIÓN QUE EMPUJA:** novato suelta al centro, intermedio prepara fusión en esquina para empuje, experto usa empuje para reordenar tablero entero.

**CORTE QUIRÚRGICO:** novato corta al medio, intermedio corta base, experto deja estructura en equilibrio inestable para siguiente corte.

---

## O. ¿POR QUÉ NO ES ABURRIDO DESPUÉS DE 20 PARTIDAS?

**REBOTE:** 6 totens × 3 materiales × 10 ángulos × 5 fuerzas × 3 rebotes = 540 situaciones sin un nivel nuevo. Cada posición de bola es un puzzle nuevo. No necesitas 100 niveles, necesitas 6 totens bien puestos.

**TIRO RESERVA:** 3 proyectiles × 6 estructuras = 18 combinaciones por turno, y mano cambia. Cada mano es puzzle.

**PINTAR:** línea pintada en 10 posiciones × 10 ángulos × 10 fuerzas = 1000. No se repite.

**FUSIÓN:** empuje hace que cada fusión reordene, no hay partida igual.

**CORTE:** cada corte deja forma distinta, cada forma es nuevo puzzle. Con 5 vigas ya tienes 120 órdenes.

Profundidad no viene de “20 enemigos”, viene de **interacción de pocas reglas**.

---

## P. ¿POR QUÉ NO NECESITA ECONOMÍA PARA SER DIVERTIDO?

Todos tienen **recompensa intrínseca** (física, cadena, “yo lo hice”) sin tienda:

- RebotPersistente: ver bola volver y tirar torre es recompensa. Score es feedback, no economía.
- TiroReserva: elegir proyectil correcto y ver atravesar es recompensa.
- Pintar: ver tu línea funcionar es recompensa.

Economía/monetización es **progresión extrínseca** para retención D7/D30, no para que el core sea divertido en 60s. Si el core necesita monedas para ser divertido, el core está roto. Todos estos son divertidos con `score/best` solo.

---

## Q. MOMENTOS ESPECTACULARES (5-15s, compartibles)

- **RebotPersistente:** bola que rebota en 2 paredes, tira torre, y queda centrada. Clip con línea punteada antes.
- **Tiro Reserva:** cambias a pesado y atraviesa 3 vigas.
- **Pintar:** pintas rebote donde no hay pared y entra.
- **Fusión:** fusión que empuja y encadena 3 fusiones.
- **Corte:** 1 corte y toda la L se derrumba hacia meta en cámara lenta.

Todos tienen `setup → decisión → ejecución → payoff → sorpresa`.

---

## PRUEBA DE PROFUNDIDAD — 20 PREGUNTAS OBLIGATORIAS (para los 5 finalistas, sin agregar features)

**REBOTE PERSISTENTE (ganador):**
1. 1s: drag y suelta para tirar bola
2. Decisiones por partida: 5 tiros × 3 decisiones (qué toten, qué rebote, qué fuerza/dónde deja) = 15
3. Cuántas diferentes sin features: >15 (material, ángulo, fuerza, posición, orden)
4. Nuevo: tira recto al centro
5. 5 min: descubre rebote pared y que fuerza deja bola cerca/lejos
6. 1h: domina dilema seguro vs arriesgado y sacrificio de toten fácil
7. Experto: usa 2 paredes, falla a propósito para preparar combo, conoce esquina = -20°
8. Riesgo/recompensa: sí, 1 toten seguro vs 2 totens arriesgado
9. Planificación: sí, dónde dejar bola
10. Ejecución: sí, ángulo+fuerza
11. Improvisación: sí, rebote inesperado que deja mal y debes adaptar
12. Cambiar estrategia: sí, plan A madera / B piedra / C sacrificio
13. Espectacular inesperado: sí, rebote doble que limpia 3
14. Cadena: sí, rebote → impacto → derrumbe → nueva posición
15. “YO hice eso”: sí, “yo la dejé centrada”
16. Material para cientos sin sistemas: sí, 6 totens × 10 ángulos × 5 fuerzas = 300
17. Ver a otro y querer intentar: sí, “yo quiero ese rebote”
18. Clip 5-15s: sí, línea punteada → tiro → rebote → derrumbe
19. Fallar interesante: sí, deja bola en esquina sin ángulo
20. Mejora por habilidad, no desbloqueos: sí, ángulo/fuerza/posición

**TIRO CON RESERVA:** 1s elige proyectil y tira, 15 decisiones (qué proyectil, qué estructura, orden), 5 min guarda explosivo, 1h cuenta mano, experto sacrifica tiro débil, riesgo sí, planificación sí, cadena sí, espectacular sí, clip sí, mejora por habilidad sí.

**PINTAR EL REBOTE:** 1s pinta línea y tira, 12 decisiones, 5 min corrige tiro, 1h pinta para siguiente, experto 2 segmentos, riesgo línea mal, planificación sí, espectacular sí, clip sí.

**FUSIÓN QUE EMPUJA:** 1s suelta burbuja, 10 decisiones, 5 min prepara empuje, 1h usa empuje para reordenar, riesgo sí, planificación sí, espectacular cadena 3, clip sí.

**CORTE QUIRÚRGICO:** 1s swipe viga, 8 decisiones, 5 min corta base, 1h deja en equilibrio, riesgo sí, planificación sí, espectacular derrumbe, clip sí.

> Si la respuesta depende de agregar niveles/cartas/poderes, marcado DÉBIL — ninguno de los 5 depende.

## R. QUÉ REUTILIZARÍAMOS DE LA INFRAESTRUCTURA ACTUAL

**Reutilizar tal cual (A):** `Canvas setup`, `resize/DPR`, `pointer/touch input`, `loop/delta`, `audio procedural (beep)`, `partículas`, `shake/hitstop`, `screenshot harness (?capture)`, `test harness (?runTests)`, `localStorage`, `helpers (clamp/lerp)`, `index.html/style.css` esqueleto.

**Eliminar definitivamente (B):** `dam`, `gate`, `pressure`, `reservoir`, `overload`, `avalanche`, `mass accumulation presa`, `fort específico Pulse`, `estados exclusivos Pulse`, `UI presión`, `feedback textual Pulse`. No dejar código muerto.

Nuevo `game.js` estimado ~600 líneas solo con A + nueva física (1 bola + 6 rects), no 1862.

---

## S. QUÉ PARTE DE PULSE DAM DEBE DESAPARECER DEFINITIVAMENTE

Todo lo que contenga `presa/compuerta/presión/avalancha`:

- Variables: `DAM_W`, `GATE_Y`, `pressure`, `holdTime`, `gateClosed`, `isOverload`, `peakPressure`
- Funciones: `createFort` (forma presa), `spawnBall` presa, `triggerRelease/Overload` de presión, `showResult` de presión
- Render: agua con `waterY/wave`, compuerta con `bulge/grietas`, fort presa
- UI: barra presión, `¡CRÍTICO!`, `MASA/BLOQUES` de presa
- Concepto: `aguantar` como única decisión. No se rescata ni como “modo”.

**Pulse Dam queda solo como histórico en `*_PULSE_DAM_HISTORICO.md` y `capturas/historico-pulse/`.**

---

## RESULTADO FINAL — PROPUESTA

```
BASE PROBADA:
8 Ball Pool (1B+ descargas, 31.7M reseñas) + Angry Birds/Peggle como referencia de rebote — apuntar + fuerza + rebote + siguiente jugada

POR QUÉ ESA BASE:
Input comprensible en 1s (drag), pero espacio de decisiones enorme (ángulo, fuerza, objetivo, material, rebote, posición siguiente). Probado 1B veces, no necesita tutorial. Segunda orden natural (dónde queda la bola). Comercialmente validado, familiar, no necesita economía para ser divertido.

MUTACIÓN:
POSICIÓN PERSISTENTE + TOTENS CON HP/MATERIAL. La bola NO resetea al centro; queda donde se detuvo. Totens con hp1 madera / hp2 piedra obligan a elegir rebote vs directo. Cada tiro cambia el ángulo del siguiente. De “tiro → puntos → reset” a “tiro → resultado → nuevo escenario”.

NUESTRA IDENTIDAD:
No es Pool (no hay mesa, es vertical), no es Angry Birds (no hay resortera, es 1 bola que persiste), no es Peggle (no hay clavijas). Es “el pool que deja la bola donde cae y te obliga a pensar el siguiente tiro”. Silueta reconocible: círculo + 6 rectángulos + línea punteada de 2 rebotes. Nivel 3 Remix (no clon, no reskin).

CORE:
Drag para ángulo+fuerza → suelta → bola rebota en paredes → golpea totens → totens caen si hp0 → bola se detiene y SE QUEDA → siguiente turno desde ahí.

DECISIONES:
- qué totens ataco (madera fácil vs piedra que necesita rebote)
- qué rebote uso (0/1/2 paredes)
- qué fuerza para dejar bola bien/mal
- si sacrifico toten fácil para preparar posición perfecta
- orden de ataque
- riesgo: seguro con mala posición vs arriesgado con buena

WOW:
Bola que parecía perdida rebota en 2 paredes, tira torre de piedra, y queda centrada para el siguiente. Cadena de 2 rebotes que limpia 3 totens.

ONE MORE TRY:
“Si apunto 5° más a la izquierda y tiro flojo, queda centrada y la siguiente entra.” Cada fallo deja bola en sitio que invita a corregir. No es más rápido, es más listo.

RIESGO:
Física de rebote debe sentirse justa, no aleatoria. Mitigación: totens colocados para que siempre haya tiro seguro desde esquina, línea punteada 2 rebotes.

DIFERENCIACIÓN:
3 — Remix

MVP:
1 bola + 3 paredes + 6 totens + suelo persistente + línea 2 rebotes + score/best + retry. Canvas 2D, sin backend, ~600 líneas reutilizando infra A. Medir 6 preguntas + 3 cualitativas en 5 testers.

STATUS:
READY FOR PROTOTYPE (HISTÓRICO — REBOTE PERSISTENTE DESCARTADO EL 2026-08-30 POR NUEVA ORDEN)

---

# SEGUNDA INVESTIGACIÓN — 5 DIRECCIONES RADICALMENTE DIFERENTES

**Fecha:** 2026-08-30 — **REBOTE PERSISTENTE DESCARTADO** como pediste. No es “apuntar → rebote → siguiente tiro con HP”. El análisis volvió a caer en “hacer mejor el mismo tiro”. Esta segunda investigación busca **BASE PROBADA + MUTACIÓN que cambie ≥2 dimensiones** (objetivo, decisión, consecuencia, posicionamiento, estrategia, riesgo, cadena, control durante acción, relación entre acciones, información).

> No se programa. No se elige ganador. Solo 5 arquitecturas tan distintas que digas “ahora sí estamos buscando juegos distintos”.

Cada dirección reutiliza input familiar (arrastrar, apuntar, colocar, cortar, tocar momento) pero lo que pasa DESPUÉS es el juego.

---

## DIRECCIÓN A — MASA BIFURCADA — Mob Control + Clash Royale + Routing territorial

- **Base inspiradora:** Mob Control (100M+, puertas x2/x3, masa desproporcionada) + Clash Royale (colocación + recurso + counter) + Routing (elegir camino)
- **Input reutilizado:** arrastrar para apuntar cañón / flujo (Mob Control)
- **Qué conserva:** sensación de multiplicación desproporcionada, puertas visibles, escalada, caos de masa
- **Qué cambia radicalmente:** la masa **no sigue un camino único**. Fluye sola y tú en cada bifurcación decides **cuánto % mandas por cada rama** (split 70/30, 50/50) con un gesto rápido. Además, cada rama deja un **rastro territorial** (color) que persiste 2 oleadas y da bonus si vuelves a pasar. Cambia **objetivo** (no solo llegar a base, controlar territorio), **decisión** (repartir, no solo elegir puerta), **consecuencia** (masa dividida), **relación entre acciones** (rastro persiste) y **riesgo** (concentrar vs dividir).
- **Loop 30s (no es apunta→espera):** 0s ves masa azul avanzando sola hacia bifurcación con 3 ramas: A x3 con enemigo defendiendo, B x2 libre, C x1.5 con boost pero trampa. 3s decides split 50/30/20 con drag. 5s ves dos masas separadas avanzar, una choca con enemigo, otra limpia y pinta territorio. 10s decides si mandas refuerzo a A o consolidas B. 15s masa pintada da +20% a siguiente oleada que pase por ahí → decides si vuelves a usarla. 20s enemigo reacciona y bloquea rama B → debes improvisar y mandar por C. 30s oleada termina, territorio pintado queda, decides estrategia para siguiente oleada con 3 ramas nuevas.
- **Decisiones disponibles:** cuánto % a cada rama, qué rama priorizar, cuándo reforzar, si usar masa para pintar territorio o para atacar base, si sacrificar cantidad por posición
- **Decisiones segundo orden:** el split de ahora deja rastro que bonifica la siguiente oleada; elegir A ahora bloquea B después
- **Riesgo/recompensa:** concentrar 80% en x3 → si pasa, masa gigante; si enemigo bloquea, pierdes 80%. Dividir 33/33/33 → seguro pero masa pequeña en cada rama
- **Cadena:** masa → puerta x3 → masa grande → pinta territorio → siguiente masa por ahí → más grande → ataca base → base deja rastro
- **Estrategias válidas:** Agresiva (todo a x3), Controladora (pintar territorio), Distracción (mandar poco a x3 para que enemigo defienda ahí, mandar masa real por x2)
- **Novato:** manda todo por x3 visible
- **Experto:** hace split 20/80 para pintar territorio y en siguiente oleada usa territorio pintado para x3 gratis; finta al enemigo
- **20 partidas:** cada bifurcación es puzzle de 3 ramas con enemigos distintos, rastro de 2 turnos crea memoria. No necesitas niveles nuevos, solo 3 ramas bien diseñadas dan 100 combinaciones. Descubres fintas, sacrificios, control territorial
- **Espectáculo:** masa de 10 se vuelve 180 delante de tus ojos en 2s
- **Clips 5-15s:** split justo antes de bifurcación → masa se divide y pinta 2 territorios
- **Riesgo clon:** 2 (Mob) → con split + territorio sube a 3-4, no es solo elegir puerta
- **Infra reutilizable:** Canvas, loop, partículas para masa, shake al multiplicar, harness capture, audio tick. Reutiliza `partículas`, `shake`, `loop` de Pulse
- **Pulse que desaparece:** todo `pressure`, `gate`, `avalanche` — nada de presa

---

## DIRECCIÓN B — DESTRUCCIÓN QUE CONSTRUYE — Angry Birds + Suika/Donut + Construcción

- **Base:** Angry Birds (trayectoria + estructura + material + cadena) + Suika (fusión + espacio) + Donut County (colocar y ver mundo cambiar)
- **Input:** apuntar y lanzar (Angry Birds)
- **Qué conserva:** trayectoria, destrucción por material, cadena de derrumbe
- **Qué cambia radicalmente:** **los escombros no desaparecen**: caen y se convierten en **bloques construibles** que puedes colocar para construir puente/trampolín para el siguiente tiro. Además, 2 escombros iguales se fusionan (Suika) en bloque mayor. Cambia **objetivo** (no solo destruir, destruir para construir), **consecuencia** (escombro → material), **relación entre acciones** (derrumbe de ahora es plataforma del siguiente tiro), **estrategia** (qué destruir para qué construir)
- **Loop 30s:** 0s ves torre madera + piedra, bola en mano. 3s apuntas y lanzas a base madera → torre cae, deja 3 escombros madera. 8s escombros se asientan, 2 iguales se fusionan en viga larga. 12s decides: ¿uso viga para hacer puente hacia torre de piedra lejana o la guardo? 15s colocas viga como puente con drag. 20s lanzas segunda bola que rebota en tu puente y llega a piedra que antes era imposible. 28s puente se rompe y deja nuevos escombros para siguiente.
- **Decisiones:** qué estructura tiro, qué escombros genero, qué fusiono, dónde coloco puente, si guardo escombro
- **Segundo orden:** el tiro de ahora crea el terreno del siguiente tiro
- **Riesgo/recompensa:** tirar a madera da muchos escombros pequeños (mucho material, poco daño), tirar a piedra da pocos escombros grandes (poco material, mucho daño)
- **Cadena:** tiro → derrumbe → escombros → fusión → puente → tiro → rebote en puente → nuevo derrumbe
- **Estrategias:** Demoledor puro (todo a destruir), Constructor (tiro suave para generar material), Fusionador (busca 2 iguales)
- **Novato:** tira al centro para destruir
- **Experto:** tira a esquina para que escombros caigan justo donde necesita puente, busca fusión para viga larga
- **20 partidas:** cada torre deja escombros distintos, cada fusión cambia. No necesitas 20 niveles, con 5 torres bien diseñadas tienes 100 formas de construir. Descubres que a veces es mejor NO destruir todo
- **Espectáculo:** torre que se derrumba y del polvo aparece viga que colocas
- **Clips:** tiro → derrumbe → escombros se fusionan → colocas puente → segundo tiro rebota en tu puente
- **Riesgo clon:** 3 (no es Angry Birds con círculos, es Angry + Suika + construcción)
- **Infra reutilizable:** Canvas, física rebote, partículas polvo, audio impacto. Reutiliza `partículas`, `shake`, `audio` de Pulse
- **Pulse que desaparece:** `pressure`, `gate`, isla de presión — nada

---

## DIRECCIÓN C — COLOCACIÓN FÍSICA — Clash Royale + Pool + Física sandbox

- **Base:** Clash Royale (colocar carta en arena, timing, posición, elixir) + 8 Ball Pool (fuerza, rebote, posición)
- **Input:** elegir carta (tap de mano 3) + arrastrar para posicionar en arena (Clash)
- **Qué conserva:** selección de mano, timing, posicionamiento como decisión principal, recurso que se recarga
- **Qué cambia radicalmente:** **las unidades/cosas que colocas tienen física real** (masa, rebote, empuje). No caminan solas por un camino, caen y empujan. Colocar un muro pesado desvía la bola enemiga, colocar una unidad ligera rebota. Cambia **consecuencia** (colocar no es atacar, es alterar física), **posicionamiento** (cada pixel importa), **cadena** (una colocación empuja a otra), **control durante acción** (puedes colocar mientras la física sigue)
- **Loop 30s:** 0s tienes 3 cartas: muro pesado (2 elixir), rebote ligero (1), bomba (3). Ronda enemiga suelta masa por arriba. 3s decides: colocas muro en centro para desviar flujo enemigo hacia tu zona x2. 7s flujo enemigo choca con tu muro, rebota y se divide. 10s colocas unidad ligera en lateral que rebota y empuja masa enemiga hacia trampa. 15s enemigo coloca su muro. 20s ves que tu muro + su muro crean un embudo → colocas bomba en embudo. 28s bomba explota y empuja todo.
- **Decisiones:** qué carta de 3 juego, dónde exactamente (pixel), cuándo (ahora vs en 1s cuando flujo llegue), si guardo elixir
- **Segundo orden:** cada colocación queda 5s y altera física del siguiente placement (muro que pusiste bloquea tu siguiente)
- **Riesgo/recompensa:** muro pesado bloquea mucho pero cuesta 2 elixir y te deja sin jugada 3s; ligero es barato pero poco empuje
- **Cadena:** colocas muro → flujo rebota → empuja unidad → unidad activa trampa → trampa empuja de vuelta
- **Estrategias:** Muralla (todo muros), Rebote (todo ligeros que rebotan), Bomba (espera embudo)
- **Novato:** coloca en centro sin mirar flujo
- **Experto:** coloca 10px más a la izquierda para que rebote entre en trampa, cuenta elixir enemigo, deja hueco a propósito
- **20 partidas:** arena con 2 obstáculos fijos + 6 cartas distintas = cientos de colocaciones. Cada colocación es puzzle de física. Descubres que a veces es mejor NO colocar y dejar elixir.
- **Espectáculo:** colocar muro y ver masa de 20 rebotar como billar
- **Clips:** colocas muro en último segundo y masa enemiga se desvía y se va fuera
- **Riesgo clon:** 4 (no es Clash con skins, es Clash con física Pool)
- **Infra reutilizable:** Canvas, pointer drag para posicionar, loop, partículas para empuje, shake. Reutiliza `pointer events`, `loop`, `shake` de Pulse
- **Pulse que desaparece:** nada de presa/compuerta, solo drag de colocación

---

## DIRECCIÓN D — CORTE DE FLUJO — Fruit Ninja + Laberinto + Mob Control (flujo automático)

- **Base:** Fruit Ninja (swipe para cortar) + Mob Control (flujo de masa) + Laberinto/Roting
- **Input:** swipe para cortar (Fruit Ninja) — pero no cortas fruta, cortas **pared del laberinto**
- **Qué conserva:** gesto de corte directo, respuesta inmediata, flujo constante de masa como en Mob
- **Qué cambia radicalmente:** **tú no controlas la masa**. La masa fluye sola como río por laberinto hacia tu base (y la enemiga hacia la tuya). Tú solo puedes **cortar 1 pared cada 3s** para abrir un nuevo camino y desviar el flujo. El laberinto es el tablero. Cambia **objetivo** (no disparar masa, desviar río), **decisión** (qué pared cortar, no qué puerta elegir), **control durante acción** (cortas mientras fluye), **consecuencia** (corte abre camino permanente para las siguientes oleadas), **información** (ves el flujo venir y anticipas)
- **Loop 30s:** 0s ves río azul de 10 bolas avanzando solo por camino central hacia puertas x2. Enemigo tiene río rojo. 3s ves que camino central tiene trampa, decides cortar pared izquierda con swipe para abrir atajo hacia x3. 5s río se desvía, entra por x3 y se hace 30. 10s nuevo río viene, pero tu corte sigue abierto → ahora va automático por x3 sin que hagas nada. Enemigo corta su pared y desvía su río. 15s ves que tu río x3 ahora va directo a base enemiga, pero enemigo puso muro. Decides cortar muro enemigo (cuesta 2 cortes). 20s cortas, río pasa. 25s río grande llega a base y pinta territorio. 30s laberinto queda distinto para siguiente oleada.
- **Decisiones:** qué pared cortar (de 6 posibles), cuándo (ahora vs esperar a que río llegue), si gasto corte en desviar mi río o en bloquear enemigo, qué camino dejo abierto para siguiente
- **Segundo orden:** cada corte deja el laberinto abierto para las siguientes oleadas (tuya y enemiga). Cortar ahora facilita tu siguiente, pero también puede facilitar al enemigo si cortas mal.
- **Riesgo/recompensa:** cortar pared hacia x3 → masa x3 pero camino más largo y enemigo puede usarlo también. Dejar camino central seguro → poca masa pero seguro
- **Cadena:** corte → desvío → masa por x3 → masa grande → pinta → siguiente masa por camino pintado → más grande
- **Estrategias:** Atajo (abrir x3), Bloqueo (cortar para cerrar camino enemigo), Territorio (cortar para pintar)
- **Novato:** corta la pared más cercana al río
- **Experto:** no corta nada 5s, espera a que 2 ríos se junten y corta una pared que desvía ambos a x3 a la vez; corta pared que parece inútil ahora pero abre cadena en 2 oleadas
- **20 partidas:** laberinto de 3x3 paredes = 9 paredes, cada una abre 2 caminos. Con 1 corte cada 3s tienes 10 cortes por partida = 90 decisiones. Cada partida el laberinto inicial es distinto. Descubres que a veces es mejor NO cortar y dejar río ir por x2
- **Espectáculo:** río de 10 bolas que se desvía de golpe por tu corte y se hace 30
- **Clips:** swipe → pared se abre → río entero gira 90° y entra por x3
- **Riesgo clon:** 4 (no es Fruit Ninja con bolas, es Fruit Ninja como editor de laberinto para flujo Mob)
- **Infra reutilizable:** Canvas, swipe detection, flujo de partículas, loop. Reutiliza `pointer events` (swipe), `loop`, `partículas` de Pulse, pero sin `pressure`
- **Pulse que desaparece:** todo `pressure`, `gate`, `avalanche` — aquí el flujo es automático, tú solo editas escenario

---

## DIRECCIÓN E — CADENA PROGRAMABLE — Peggle + Chain Reaction + Programación táctica

- **Base:** Peggle (1 tiro → rebotes + cadena) + Chain Reaction (1 chispa → otra) + Programación (colocar antes de ejecutar)
- **Input:** **2 taps secuenciales**: 1º tap para **colocar 1 pin rebotador** (eliges tipo: rebote normal / división / explosivo) en el tablero, 2º tap para **soltar bola** desde arriba (Peggle). Ambos son 1 tap, muy familiares.
- **Qué conserva:** tiro Peggle desde arriba, rebotes, naranjas obligatorias, cadena visual, anticipación
- **Qué cambia radicalmente:** **tú colocas el pin que va a rebotar** antes de tirar. El tablero tiene 8 pines fijos + 1 tuyo. Tu pin persiste 2 tiros y luego desaparece. Además, los pines golpeados desaparecen y se convierten en recurso para colocar el siguiente pin (si golpeas 3 naranjas, tu siguiente pin puede ser explosivo). Cambia **decisión** (no solo ángulo, sino dónde pongo mi pin), **consecuencia** (pin colocado cambia todos los rebotes), **relación entre acciones** (pin que pones ahora afecta los 2 siguientes tiros), **estrategia** (qué tipo de pin pongo), **información** (ves pines fijos y eliges hueco)
- **Loop 30s:** 0s ves tablero con 8 pines grises y 4 naranjas. Tienes pin “división” en mano. 3s eliges dónde poner tu pin (entre 2 naranjas). 5s sueltas bola desde arriba con drag. 7s bola rebota en tu pin → se divide en 2 → cada una toca naranja → cadena. 12s pines golpeados desaparecen y te dan recurso “explosivo”. 15s colocas pin explosivo abajo donde quedaron 2 naranjas juntas. 20s sueltas bola → rebota en pin fijo → cae en tu pin explosivo → explota y limpia naranjas. 28s tu pin explosivo desaparece, te queda pin rebote normal para siguiente.
- **Decisiones:** dónde pongo mi pin (de 10 huecos), qué tipo (rebote/división/explosivo según recurso), dónde suelto bola (izquierda/centro/derecha), si uso pin para rebotar ahora o para preparar siguiente
- **Segundo orden:** pin colocado dura 2 tiros → el pin que pones ahora cambia el tablero del siguiente tiro. Recurso de pines golpeados → tu siguiente pin es mejor
- **Riesgo/recompensa:** poner pin en centro → muchos rebotes pero puede desviar bola fuera; poner en lateral seguro → pocos rebotes pero asegura 1 naranja. Pin explosivo limpia mucho pero desaparece y dejas hueco.
- **Cadena:** colocas pin → tiras → rebote en tu pin → divide → cada división toca naranja → naranjas dan recurso → siguiente pin mejor → siguiente tiro más grande
- **Estrategias:** Centro (pin en medio para máximo rebote), Esquina (pin seguro), División (pin que divide para tocar 2 lados), Explosivo (guardar pin explosivo para final)
- **Novato:** pone pin al azar y tira al centro
- **Experto:** pone pin donde la bola que falló la última vez habría rebotado mejor; guarda pin explosivo para cuando queden 2 naranjas juntas; pone pin que sirve para tiro actual y también deja hueco para el siguiente tiro
- **20 partidas:** tablero con 8 pines fijos aleatorios + 4 naranjas aleatorias = cientos de tableros. Cada pin que colocas (3 tipos × 10 posiciones) = 30 opciones por turno × 5 turnos = 150. Descubres que a veces es mejor poner pin que no rebota mucho ahora pero deja el tablero perfecto para el siguiente tiro con explosivo.
- **Espectáculo:** bola que toca tu pin, se divide en 2, cada una explota y limpia 4 naranjas con fiebre Peggle
- **Clips:** colocas pin → tiras → bola rebota en tu pin → división → fiebre
- **Riesgo clon:** 4 (no es Peggle con otro skin, es Peggle donde TÚ pones un peg)
- **Infra reutilizable:** Canvas, tiro drag, rebote, partículas, audio, harness. Reutiliza `pointer events`, `partículas`, `audio beep`, `shake` de Pulse, pero sin `pressure`
- **Pulse que desaparece:** todo `pressure`, `gate`, `reservoir`, `avalanche`

---

## CRITERIO FINAL — SIN GANADOR

No hay ganador. Las 5 son arquitecturas **radicalmente diferentes**:

- **A** es **flujo dividido en tiempo real** (ruta + territorio)
- **B** es **tiro que genera material construible** (destrucción → construcción)
- **C** es **colocación con física** (poner + empujar)
- **D** es **edición de laberinto para flujo automático** (cortar, no disparar)
- **E** es **programación de rebote** (colocar pin + tirar)

Si las lees y piensas “ahora sí estamos buscando juegos distintos” → objetivo cumplido. El siguiente paso es **elegir 1 de las 5 para prototipar**, no programar 5 a la vez.

**Rebote Persistente queda oficialmente descartado** (no es ninguna de las 5, era variante Pool con persistencia, nivel 2, descartado por ser “hacer mejor el mismo tiro”).

*Fin de segunda investigación. No se escribe código hasta que elijas 1 dirección. Si ninguna te provoca “joder, aquí sí hay un juego”, seguimos investigando, no forzamos ganador.*

STATUS:
READY FOR CHOICE — 5 DIRECTIONS
```

