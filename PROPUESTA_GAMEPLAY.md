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

---

# TERCERA PRUEBA — DEMOSTRACIÓN 60s CON CONSECUENCIAS EXPLÍCITAS (como pediste)

> **Regla:** No vale decir “el jugador decide X”. Hay que mostrar **“tengo 18 unidades, envío 12 por izquierda → quedan 8 tras muro → 8 llegan detrás → ahora tengo 2 posiciones”**.

### DIRECCIÓN A — MASA BIFURCADA — Demo 60s con números

**Estado inicial (0s):** Tengo 18 unidades azules en la entrada. Bifurcación con 3 ramas: Izq x3 con muro enemigo (requiere 10 para romper), Centro x2 libre, Der x1.5 con boost pero trampa que resta 30%. Enemigo defiende Izq con 12 rojas.

**5s:** Decido **12 por Izq + 6 por Centro**. Las 12 chocan con 12 rojas → quedan 4 azules (12-8 muertos) y rompen muro pero llegan debilitadas y pintan poco territorio. Las 6 por Centro pasan por x2 → 12, llegan intactas y pintan territorio Centro 40%. Ahora tengo **4 en Izq (posición avanzada pero débil) y 12 en Centro (posición retrasada pero fuerte)** y debo decidir cuál reforzar. Si hubiera mandado 18 por Izq, tendría 10 tras muro y pintaría mucho, pero si enemigo pone refuerzo hubiera perdido todo.

**15s:** Enemigo refuerza Izq con 10 más. Mi territorio Centro da +20% a la siguiente oleada que pase por ahí. Decido mandar siguiente oleada de 20 unidades **0 por Izq, 14 por Centro, 6 por Der**. Las 14 por Centro con bonus se hacen 33 (14×2×1.2) y llegan a base enemiga. Las 6 por Der activan boost y se hacen 9 pero pierden 3 en trampa → 6.

**30s:** Base enemiga recibe 33+6=39. Mi masa pintó Centro y Der. Siguiente bifurcación tiene 3 ramas nuevas, pero Centro y Der siguen pintados 1 oleada más. Decido si repito Centro para aprovechar bonus o cambio a Izq ahora que enemigo movió defensa.

**60s:** He pintado 2/3 ramas, mi masa total es 45, enemiga 30. Si hubiera ido todo por Izq al inicio, tendría 0 en Centro y no tendría bonus. La decisión de split cambió el mapa.

### DIRECCIÓN B — DESTRUCCIÓN QUE CONSTRUYE — Demo 60s con escombros reales

**Estado inicial (0s):** Torre 1: base madera (3 bloques), Torre 2: piedra (2 bloques duros arriba), hueco entre ellas de 4 unidades. Tengo 1 bola. Escombros: 0.

**3s:** Apunto a **base madera** (no a piedra). Bola golpea madera → torre 1 se derrumba, deja **3 escombros madera pequeños** en suelo entre torres. Dos de ellos iguales se fusionan (Suika) → **1 viga larga madera** (ocupa 3 unidades). Torre 2 sigue intacta.

**12s:** Decido: ¿uso viga larga ahora como puente hacia Torre 2 o la guardo? Si la uso ahora, podré llegar a piedra con rebote. Si la guardo, Torre 2 sigue inalcanzable. **Uso viga**: la coloco con drag entre hueco, forma puente.

**20s:** Segunda bola: apunto a piedra pero **rebota en mi puente** → ángulo que antes era imposible ahora entra, golpea base piedra → piedra cae, deja **2 escombros piedra grandes**. Uno de ellos cae sobre mi puente y lo rompe → puente deja **1 escombro madera + 1 piedra**.

**35s:** Tengo **1 viga madera + 2 piedra**. Decido fusionar 2 piedra → **1 losa piedra** grande que sirve como trampolín. La coloco bajo donde caerá la siguiente bola.

**55s:** Tercera bola: tiro flojo, cae en losa, rebota alto y limpia lo que queda. Si en el primer tiro hubiera ido directo a piedra, habría hecho poco daño y **no tendría puente**, siguiente tiro seguiría imposible. El derrumbe creó la solución.

### DIRECCIÓN C — COLOCACIÓN FÍSICA — Demo 60s con física

**Estado inicial (0s):** Arena 10x10, 2 obstáculos fijos en centro. Mano: muro pesado (2 elixir, bloquea mucho), rebote ligero (1, rebota), bomba (3, empuja). Elixir 4/10. Enemigo suelta flujo de 10 bolas por arriba.

**3s:** Flujo enemigo viene por centro. Decido **colocar muro pesado en (5,5) justo en centro** (cuesta 2, quedo en 2 elixir). Flujo choca, se divide en 2: 5 bolas a izquierda, 5 a derecha, ambas van hacia mis zonas x2 laterales (bien).

**10s:** Coloco **unidad ligera en (2,5)** con 1 elixir (quedo en 1). Flujo dividido izquierdo choca con unidad ligera → rebota y empuja a 3 bolas enemigas hacia trampa en (1,3). Trampa se activa y empuja de vuelta.

**18s:** Enemigo coloca su muro en (8,5) bloqueando mi flujo. Mi muro + su muro crean embudo en (6,5). Decido esperar 2s a juntar elixir a 3 y poner **bomba en embudo**. Si la pongo ahora, flujo aún no está en embudo y desperdicio.

**26s:** Flujo de 12 bolas entra en embudo, pongo bomba → explota, empuja 8 bolas fuera del mapa. Si hubiera puesto bomba en centro al inicio, habría empujado solo 3.

### DIRECCIÓN D — CORTE DE FLUJO — Demo 60s

**Estado inicial (0s):** Laberinto 3x3 paredes, río azul de 10 bolas avanza por camino central hacia x2. Río rojo enemigo igual. Paredes cerradas.

**3s:** Veo que camino central lleva a x2 pero tiene trampa que resta 3. Decido **cortar pared izquierda con swipe** (1 corte). Pared se abre, río se desvía instantáneamente 90° hacia x3. 10 bolas entran por x3 → 30. Río rojo sigue por centro.

**8s:** Nuevo río azul de 12 viene. Como mi corte sigue abierto, **va automático por x3 sin que haga nada** → 36. Ya no necesito cortar. Enemigo corta su pared y su río también va por x3.

**16s:** Mi río x3 ahora va directo a base enemiga, pero enemigo puso muro en (2,2). Decido **cortar muro enemigo**: cuesta 1 corte, pero si lo hago ahora, mi río de 14 que viene en 2s pasará. Espero 2s.

**19s:** Corto muro enemigo justo cuando río de 14 llega → 14×3=42 pasan. Si hubiera cortado antes, río anterior de 12 se habría desviado a x2 y perdido x3.

**28s:** Laberinto queda con 2 paredes abiertas (izquierda y enemiga). Siguiente oleada de 16 se dividirá sola: 10 por mi x3 y 6 por centro. No necesito cortar. El laberinto que creé juega solo.

### DIRECCIÓN E — CADENA PROGRAMABLE — Demo 60s

**Estado inicial (0s):** Tablero 8 pines grises fijos + 4 naranjas (obligatorias) + 1 morada bonus. Mano: pin “división” (divide bola en 2). Tengo que decidir dónde poner mi pin.

**3s:** Coloco **pin división en (4,4) entre 2 naranjas**. Pin dura 2 tiros.

**5s:** Suelto bola desde arriba centro. Bola cae → toca pin fijo en (4,2) → rebota a mi pin división en (4,4) → se divide en 2 bolas → cada una toca 1 naranja → 2 naranjas limpias, pin división sigue, 2 pines grises golpeados dan recurso “explosivo”.

**14s:** Ahora tengo pin explosivo en mano. Quedan 2 naranjas juntas abajo en (3,7) y (5,7). Coloco **pin explosivo en (4,6) justo arriba de ellas**. Si lo pongo en centro, explotaría y solo tocaría 1.

**19s:** Suelto bola desde izquierda. Bola rebota en 2 pines fijos, cae en mi pin explosivo (4,6) → explota con radio 2 → limpia las 2 naranjas + 1 pin gris → limpio tablero. Pin explosivo desaparece, me queda pin rebote normal.

**28s:** Tablero ahora tiene hueco donde estaban naranjas. Mi pin división sigue 1 tiro más en (4,4). Si en el primer tiro hubiera puesto pin en esquina, solo habría tocado 1 naranja y no tendría recurso explosivo para el final. El pin que puse en 3s cambió el tiro de 19s.

---

## PARTIDA SIN CONTENIDO NUEVO — ¿Qué descubre el jugador después de 100 partidas con las mismas piezas?

**A Masa Bifurcada (mismas 3 ramas, mismos multiplicadores):**
- Novato (partida 1-3): manda todo por x3.
- 5 partidas: descubre que dividir 70/30 pinta territorio.
- 20 partidas: descubre finta (mandar poco a x3 para que enemigo defienda ahí, mandar masa real por x2).
- 100 partidas: domina **sacrificio**: manda 4 unidades a propósito a morir en trampa para que enemigo crea que vas por ahí, mientras acumulas masa para siguiente oleada por ruta pintada. No es más puntería, es lectura del rival. No necesita nuevas puertas.

**B Destrucción que Construye (mismas 2 torres, mismos 3 escombros):**
- Novato: tira al centro para destruir.
- 5 partidas: descubre que tirar a base madera da más escombros que tirar a piedra.
- 20 partidas: descubre que **no destruir todo es mejor**: dejar 1 bloque en pie para que escombros caigan inclinados y formen rampa.
- 100 partidas: aprende a **fallar a propósito** el primer tiro para que escombros caigan exactamente donde necesita el puente del segundo tiro. Tira flojo a esquina para generar viga larga en lugar de 3 pequeños. No necesita nuevas torres.

**C Colocación Física (mismas 3 cartas, misma arena):**
- Novato: pone muro en centro.
- 20 partidas: descubre que poner muro 10px más a la izquierda hace que flujo entre en trampa.
- 100 partidas: descubre **no colocar**: deja elixir a 10 y espera a que enemigo coloque, luego pone muro que usa su muro como parte de embudo. Juega con su colocación.

**D Corte de Flujo (mismo laberinto 3x3):**
- Novato: corta la pared más cercana al río.
- 20 partidas: descubre que no cortar 5s y esperar a que 2 ríos se junten permite desviar ambos con 1 corte.
- 100 partidas: deja laberinto con 2 paredes abiertas a propósito para que su río y el enemigo compartan camino y se empujen.

**E Cadena Programable (mismos 8 pines fijos):**
- Novato: pone pin al azar.
- 20 partidas: pone pin donde la bola que falló la última vez habría rebotado mejor.
- 100 partidas: pone pin que **no da muchos rebotes ahora pero deja el tablero perfecto para el siguiente tiro con explosivo**. Juega a 2 turnos vista.

> Si la respuesta después de 100 partidas fuera solo “mejor puntería”, está marcado DÉBIL. En los 5, la respuesta es **sacrificio, finta, no colocar, dejar en equilibrio, preparar 2 turnos** — formas de jugar, no puntería.

STATUS:
READY FOR CHOICE — 5 DIRECTIONS (con demo 60s explícita)
```

---

# ÚLTIMA AUDITORÍA — 5 FINALISTAS A PRUEBA DE FUEGO (NO ELEGIR GANADOR)

**Fecha:** 2026-08-30 — **REBOTE PERSISTENTE descartado definitivamente.** No se programa. Esta auditoría somete a los 5 (A-E) a 20 pruebas brutales, con foco en **B Destrucción que Construye** (tu favorita). Si ninguno llega a *“joder, aquí sí hay juego”*, no se fuerza ganador.

> Regla: No vale “decide estratégicamente”. Hay que mostrar **estado → decisión → resultado → nuevo estado**.

### 1. NO PARTAS DE NUESTRA IDEA — Qué viene de juego existente vs qué aportamos

**A Masa Bifurcada (Mob Control):** Hereda *puertas x2/x3 + masa que avanza*. Debe aportar: **split % + territorio pintado que persiste 2 oleadas**. Si solo fuera “pinto territorio”, es reskin. Aporta decisión nueva: **repartir 1 masa en 2 posiciones simultáneas y decidir cuál sacrificar**.

**B Destrucción que Construye (Angry + Suika):** Hereda *trayectoria + destrucción por material + fusión de iguales*. Debe aportar: **escombro → bloque colocable + fusión que cambia forma del siguiente tiro**. Decisión nueva que NO existe en Angry ni Suika: **destruir para generar material que debes colocar, y ese material cambia la geometría del siguiente disparo**. Ni Angry (destruye y desaparece) ni Suika (fusiona y libera espacio) tienen eso. Si solo fuera “bloques son diferentes”, sería reskin y se descarta.

**C Colocación Física (Clash + Pool):** Hereda *mano 3 + colocar*. Debe aportar: **física de empuje/rebote que persiste**. Decisión nueva: **colocar 10px más a la izquierda para que rebote entre en trampa, no solo “qué carta juego”**.

**D Corte de Flujo (Fruit + Laberinto):** Hereda *swipe + flujo Mob*. Debe aportar: **cortar pared del laberinto para desviar río automático**. Decisión nueva: **qué pared cortar para que el río que viene en 2s vaya por x3, no qué puerta elegir ahora**.

**E Cadena Programable (Peggle):** Hereda *tiro + rebotes*. Debe aportar: **colocar 1 pin tuyo que dura 2 tiros + recurso de pines golpeados**. Decisión nueva: **dónde pongo mi pin para que sirva ahora Y deje hueco para el siguiente tiro**.

### 2. COMPARACIÓN DIRECTA CONTRA REFERENCIA

**A vs Mob Control:**
- Referencia: eliges 1 puerta (x2 vs x3) → masa entra por ahí.
- Nuestra: eliges **split 70/30 entre 2 puertas simultáneamente** → 2 masas con posiciones distintas.
- Diferencia decisión: repartir, no elegir.
- Diferencia estado: quedan 2 masas en 2 territorios + 1 territorio pintado (Mob deja 1 masa).
- Diferencia estrategia: finta (mandar poco a x3 para que enemigo defienda ahí).
- Diferencia maestría: experto sacrifica 4 a trampa para pintar territorio para siguiente oleada (novato no sacrifica).

**B vs Angry Birds / Suika:**
- Angry: tiras → destruyes → desaparece → siguiente tiro mismo escenario.
- Suika: sueltas → fusionas → liberas espacio.
- Nuestra: tiras → destruyes → **escombros caen y fusionan en viga → colocas viga → siguiente tiro rebota en tu viga**. Si quitas fusión, sigue habiendo juego (escombros → puente) pero menos profundidad. Si quitas destrucción, no hay escombros → no hay juego. El núcleo es **destrucción → geometría nueva**.
- Decisión nueva: ¿qué torre tiro para generar qué forma de escombro?
- Estado diferente: tras tiro 1 hay una viga donde antes había hueco.
- Estrategia nueva: no destruir todo, dejar bloque en pie para que escombros caigan inclinados.
- Maestría: experto tira flojo a esquina para generar viga larga, no 3 pequeños.

**C vs Clash Royale:** Clash: colocas → unidad camina sola por camino. Nuestra: colocas → unidad cae con física y empuja. Diferencia: posicionamiento pixel-perfect y rebote. Experto deja hueco a propósito.

**D vs Fruit Ninja:** Fruit: cortas fruta que viene. Nuestra: cortas pared del laberinto que **queda abierta**. Diferencia: corte persiste 10s y desvía flujo futuro.

**E vs Peggle:** Peggle: tiras a pines fijos. Nuestra: **pones 1 pin tuyo** que dura 2 tiros. Diferencia: eliges hueco y tipo de pin, y el pin que pones ahora afecta el siguiente tiro.

Si no hay 4 diferencias → DESCARTAR. Las 5 las tienen.

### 3. PRUEBA “¿QUÉ HAGO?” — 60s concreta (resumen con estado)

**A (60s):** 0s: 18 unidades, 3 ramas: A x3 con muro, B x2 libre, C trampa. 3s: mando 12A+6B → 4 sobreviven en A y 12 en B. 10s: veo que B pintó y da +20% → mando 14 por B → 33 llegan a base. 20s: enemigo bloquea B → improviso y mando 6 por C. 30s: tengo 2 territorios pintados.

**B (60s):** 0s: Torre madera 3 bloques + Torre piedra 2 bloques + hueco 4u. 3s: tiro a base madera → 3 escombros → 2 fusionan en viga larga en suelo (3u). 12s: coloco viga como puente sobre hueco. 20s: tiro a piedra rebota en MI puente → piedra cae y deja 2 escombros piedra → uno rompe mi puente. 35s: fusiono 2 piedra → losa. 55s: tiro flojo cae en losa → rebota alto y limpia.

**C:** 0s: mano muro(2), rebote(1), bomba(3), flujo 10 por centro. 3s: pongo muro en (5,5) → flujo se divide. 10s: pongo ligero en (2,5) → empuja 3 hacia trampa. 18s: espero elixir y pongo bomba en embudo creado por mi muro + muro enemigo.

**D:** 0s: río 10 por centro a x2. 3s: corto pared izq → río gira 90° a x3 → 30. 10s: siguiente río va auto por x3 (no corto). 19s: corto muro enemigo justo cuando río de 14 llega → 42.

**E:** 0s: 8 pines + 4 naranjas, pin división en mano. 3s: pongo pin división en (4,4). 5s: tiro centro → divide en 2 → 2 naranjas. 14s: pongo pin explosivo en (4,6). 19s: tiro izquierda → rebota → explota pin → limpia 2 naranjas.

### 4. PRUEBA DE LOS 10 TIROS (solo B detallada, las otras similar)

**B — 10 tiros con estado → decisión → resultado → nuevo estado:**

T1 Estado: 2 torres separadas, 0 escombros. Decisión: ¿madera (muchos escombros) o piedra (pocos)? Acción: tiro a base madera. Resultado: 3 escombros madera, 2 fusionan en viga larga. Nuevo estado: viga larga en suelo, hueco entre torres.

T2 Estado: viga larga + hueco. Decisión: ¿uso viga ahora como puente o la guardo? Acción: coloco viga como puente. Resultado: puente cubre hueco. Nuevo estado: puente sobre hueco, piedra sigue inalcanzable sin puente.

T3 Estado: puente listo. Decisión: ¿tiro a piedra usando puente como rebote o aseguro madera restante? Acción: tiro a piedra rebotando en puente. Resultado: piedra cae, deja 2 escombros piedra que rompen puente. Nuevo estado: puente roto (1 madera+1 piedra), losa piedra disponible.

T4 Estado: 1 madera+2 piedra. Decisión: ¿fusiono 2 piedra en losa o uso madera suelta? Acción: fusiono piedra → losa grande. Resultado: losa 3u. Nuevo estado: losa + 1 madera suelta.

T5: coloco losa como trampolín. T6: tiro flojo rebota en losa → limpia. T7: quedan 2 bloques sueltos, decido no destruir todo para dejar rampa. T8: tiro a rampa → escombros caen inclinados y forman nueva rampa. T9: tiro curvo usando rampa. T10: limpia.

Si tras tiro 3-4 fuera solo “apuntar mejor → destruir → repetir” → FALLIDO. Aquí cada tiro cambia la geometría del siguiente, no es repetir.

Las otras 4 direcciones pasan igual: A cada oleada deja territorio, C cada colocación deja muro, D cada corte deja camino, E cada pin deja hueco.

### 5. PRUEBA SEGUNDA ORDEN — 3 cadenas naturales A→B→C→D

**B 3 cadenas:**
- Cadena 1: Tiro a madera (A) → deja 3 escombros, 2 fusionan en viga (B) → decides dónde poner viga (C) → viga permite tiro a piedra (D)
- Cadena 2: Colocas viga como puente (A) → tiro rebota en viga (B) → piedra cae sobre viga y la rompe (C) → deja 1 madera+1 piedra que fusionas (D)
- Cadena 3: Fusionas 2 piedra en losa (A) → losa como trampolín (B) → tiro flojo rebota alto (C) → limpia torre alta (D)

No es A→puntos. Es A→nuevo escenario→nueva decisión→nuevo escenario.

Las otras direcciones tienen 3 cadenas similares (A: split→territorio→bonus→siguiente split, etc.)

### 6. PRUEBA DE ERROR — ¿Qué pasa si haces mala jugada?

**A:** Mandas 18 por Izq x3 y enemigo tenía muro + trampa → pierdes 12, te quedan 6 y territorio Izq sin pintar. ¿Muerto? No, te quedan Centro y Der pintables, puedes recuperar mandando por Centro con bonus.

**B:** Tiras a piedra primero y solo dejas 1 escombro pequeño, no puedes hacer puente y Torre madera sigue bloqueando. ¿Muerto? No, puedes tirar a madera ahora y generar viga, solo perdiste 1 tiro.

**C:** Pones muro en centro mal y bloqueas tu propio flujo → tu masa se va fuera. ¿Muerto? No, el muro dura 5s y desaparece, puedes corregir en siguiente colocación.

**D:** Cortas pared hacia x3 pero era trampa → río pierde 30%. ¿Muerto? No, el corte queda abierto y el siguiente río puedes desviarlo de nuevo con otro corte.

**E:** Pones pin división en esquina y tira solo toca 1 naranja → pierdes recurso explosivo. ¿Muerto? No, pin dura 2 tiros, puedes usar segundo tiro para compensar.

Todas tienen estados malos jugables, no “reinicia”.

### 7. PRUEBA DE RECUPERACIÓN — 3 maneras de recuperar situación mala

**Situación B mala:** “Destruiste madera muy pronto y ahora el objetivo piedra está bloqueado porque no dejaste escombros para puente”

- Recuperación 1: Usa los pocos escombros que quedaron para hacer mini-puente y tiro curvo.
- Recuperación 2: Tira a la base de piedra con tiro muy flojo para que escombros caigan hacia el hueco y formen rampa improvisada.
- Recuperación 3: No tires 1 turno, deja que la gravedad asiente escombros y se fusionen solos en viga más larga (esperar).

Si solo hay “reiniciar” → débil. B tiene 3.

Similar para A (si te quedas sin territorio, puedes pintar Der, hacer finta, o sacrificar), C (si bloqueas tu flujo, puedes poner rebote ligero para desviar, esperar a que muro expire, o poner bomba para limpiar), etc.

### 8. PRUEBA DE ESTRATEGIAS — 3 estilos competitivos

**B:**
- Agresivo: tira siempre a piedra para daño máximo, construye poco, busca derrumbe directo.
- Seguro: tira a madera, genera muchos escombros, construye puentes sólidos, avanza lento.
- Creativo: deja 1 bloque en pie a propósito para que escombros caigan inclinados y formen rampa curva que usa 2 tiros después.

Las 3 son competitivas, no es “uno apunta mejor”.

**A:** Agresivo (todo a x3), Controlador (pinta territorio), Finta (sacrifica).

**C:** Muralla, Rebote, Bomba.

**D:** Atajo, Bloqueo, Territorio.

**E:** Centro, Esquina, División.

### 9. PRUEBA 1 / 20 / 100 PARTIDAS — B como ejemplo

- **Partida 1:** descubre que tirar a madera da escombros.
- **5 partidas:** empieza a guardar viga larga para puente.
- **20 partidas:** deliberadamente **no destruye todo**: deja 1 bloque en pie para que escombros caigan inclinados y formen rampa. Descubre que tirar flojo a esquina genera viga larga en vez de 3 pequeños.
- **50 partidas:** comprende que el orden importa: madera → viga → piedra → losa → trampolín es mejor que piedra → madera.
- **100 partidas:** puede **fallar a propósito** el primer tiro para que 2 escombros caigan exactamente donde necesita el puente del tercer tiro. Tira a un sitio vacío para que la física asiente escombros y fusionen mejor. No es más puntería, es planificación a 3 tiros vista. Cada etapa introduce **nueva forma de decidir** (qué destruir, qué fusionar, dónde colocar, cuándo no destruir).

Si fuera solo “apunta mejor” → débil. Aquí es decisiones diferentes.

### 10-11. PRUEBA SIN ARTE / SIN CONTENIDO

**Sin arte (círculos+rectángulos+física):** B sigue siendo interesante porque la decisión es **geométrica** (dónde cae el rectángulo, cómo se apoya), no visual. Con círculos (bola) + rectángulos (escombros) + línea de tiro se entiende. No necesita partículas.

**Sin contenido (mismos 2 torres, mismos escombros, sin niveles nuevos):** B produce 100 partidas porque cada tiro deja escombros en posición distinta → cada partida es puzzle nuevo. No necesita 20 torres. Si dependiera de niveles → descartar. No depende.

### 12. PRUEBA DE CLON

**“Esto es básicamente Angry Birds.”** — ¿Qué parece clon? Trayectoria + destrucción + bloques.

**Pero NO es Angry Birds porque:** En Angry, destruyes y desaparece. Aquí **destruyes y construyes**: los restos se fusionan (Suika) y los colocas. La siguiente jugada usa lo que destruiste. Angry es `tiro → puntos → siguiente nivel`. B es `tiro → material → colocación → siguiente tiro usa tu construcción`. Diferencia estructural, no estética.

Similar para Angry+Suika: No es Suika con resortera, porque Suika no tiene tiro ni colocación de puente.

### 13. PRUEBA DE ESPECTÁCULO — 3 momentos 5-10s

**B:**
1. Torre de 3 pisos se derrumba y del polvo aparece viga que se fusiona y la colocas como puente (5s)
2. Bola rebota en tu puente y entra por hueco que era imposible antes (5s)
3. Dos escombros iguales se fusionan en el aire mientras caen y forman losa que usas como trampolín (7s)

Todos son **causalidad física visible**, no partículas.

### 14. PRUEBA DE AUTORÍA — 3 situaciones “YO lo hice”

1. “Yo puse la viga ahí, por eso la bola rebotó y entró.”
2. “Yo dejé ese bloque en pie a propósito para que los escombros cayeran inclinados.”
3. “Yo fusioné esos dos escombros y por eso tengo losa grande ahora.”

No es RNG.

### 15. PRUEBA DE JUSTICIA

Si pierdes en B (no puedes llegar a torre): puedes ver por qué — “tiré a piedra primero y no generé material para puente, si hubiera tirado a madera tendría viga”. Es tu culpa, no del RNG.

### 16. PRUEBA DE ONE MORE TRY — Frases concretas (no “mejor puntuación”)

- “Si primero rompo la base madera y dejo caer la viga hacia la derecha, puedo usarla para llegar a la piedra de atrás que no llego directo.”
- “Si no fusiono esos 2 escombros ahora y los guardo, en el siguiente tiro tendré losa grande para trampolín.”
- “Si dejo ese bloque en pie, los escombros caerán inclinados y me harán rampa.”

No es “quiero más puntos”, es “quiero probar esa jugada”.

### 17. PRUEBA DE SIMPLICIDAD

- **Input con el dedo:** “arrastras para apuntar y sueltas para lanzar, luego arrastras escombro para colocarlo” (2 drags, ambos familiares).
- **Qué decide realmente:** qué estructura destruir para qué forma de escombro, qué fusionar, dónde colocar puente para que el siguiente tiro rebote, si sacrificar destrucción por material. Mucho más complejo que el input.

Fórmula buscada: `INPUT SIMPLE → DECISIÓN PROFUNDA → CONSECUENCIA VISIBLE (puente) → NUEVO ESTADO → NUEVA DECISIÓN`

### 18. COMPARACIÓN FINAL — Tabla con scores respaldados por ejemplos anteriores (1-10)

| Concepto | Input | Decisiones | 2ª orden | Recuperación | Estrategias | Maestría (100) | Espectáculo | Diferenciación | Riesgo aburrimiento | Riesgo clon | **Total** |
|---|---|---|---|---|---|---|---|---|---|---|---|
| A Masa Bifurcada | 9 drag cañón | 8 split+territorio | 8 rastro persiste | 7 3 maneras | 8 3 estilos | 7 sacrificio | 8 masa x10 | 5 (cerca Mob) | 6 puede ser Mob 2 | 6 medio | **72** |
| B Destrucción-Construye | 9 drag tiro+colocar | 9 qué destruir/qué construir | **9** escombro→puente | 8 3 recuperaciones | 9 3 estilos muy distintos | **9** no destruir para preparar | **9** puente que permite tiro imposible | **8** Angry+Suika remix | 4 bajo si física se siente justa | 5 medio (no es Angry) | **79** |
| C Colocación Física | 9 tap colocar | 8 dónde pixel + elixir | 7 muro queda 5s | 7 | 7 | 7 no colocar | 7 muro desvía masa | 7 Clash+Pool | 7 puede ser Clash raro | 6 medio | 71 |
| D Corte de Flujo | 9 swipe | 7 qué pared cortar | 7 corte persiste | 6 | 7 | 6 esperar a juntar ríos | 8 río gira 90° | 6 puzzle repetitivo | 7 puede ser “una acción repetida” | 7 bajo | 68 |
| E Cadena Programable | 8 2 taps | 8 dónde pin + tipo | 8 pin dura 2 tiros | 7 | 8 | 8 guardar pin | 8 división → fiebre | 7 Peggle+prep | 6 puede ser cerebralo | 6 medio | 71 |

*Scores respaldados por demos 60s y pruebas 100 partidas anteriores. B lidera en decisiones, 2ª orden y maestría.*

### 19. REGLA ESPECIAL PARA B — ¿Qué pasa si quito fusión o destrucción?

**Si elimino completamente la parte “fusionar” de Suika (2 iguales → bloque mayor):**
- ¿Sigue siendo buen juego? **Sí, pero menos profundo.** Queda `tiro → escombros → colocas escombros sueltos como puente`. Sigue habiendo segunda orden (escombro → puente), pero pierdes la decisión de **qué fusionar y qué forma generar** (viga larga vs 2 pequeños) y la sorpresa de fusión en el aire. El núcleo **destrucción → construcción** sobrevive sin fusión. Fusión es **mejora, no núcleo**. No es decoración, pero no es indispensable.

**Si elimino completamente la parte “lanzar y destruir” de Angry Birds (trayectoria + destrucción):**
- ¿Sigue existiendo nuestro sistema? **No.** Sin tiro y sin destrucción no hay escombros, no hay material, no hay nada que construir. La destrucción es el **generador de recurso**. Si la quitas, no hay juego.

**Conclusión:** El núcleo no es *Angry + Suika*, es **destrucción que genera material colocable que modifica el siguiente tiro**. La fusión de Suika es una **mutación que potencia** ese núcleo (decides qué forma generar), pero el núcleo sin fusión ya tiene juego (y sería más simple de prototipar). **No construir “Angry Birds + Suika” literal**, construir **relación destrucción→espacio→siguiente decisión**, y usar fusión solo si después de probar sin fusión vemos que falta decisión de forma.

### 20. TOP 3 — Sin elegir ganador, solo 3 para tu decisión

**TOP 3 (ordenado por puntuación pero sin declarar ganador):**

**B — Destrucción que Construye — Qué es:** tiro que deja escombros que fusionan y colocas. **Por qué existe:** es el único donde tu acción literalmente construye el escenario del siguiente turno. **Qué hace diferente:** no es Angry con bloques, es Angry donde los restos importan. **Dónde puede romperse:** física de escombros puede sentirse caótica si no se siente justa. **Qué falta demostrar:** que el jugador entiende que debe construir, no solo destruir, y que disfruta colocar. **Qué preocupa:** física + construcción puede complicarse. **Qué entusiasma:** segunda orden muy fuerte, momentos “NO MAMES, LO HICE YO”.

**A — Masa Bifurcada — Qué es:** flujo que divides en bifurcación y pinta territorio. **Por qué existe:** es el más comercial y claro. **Diferente:** no es elegir puerta, es repartir y pintar. **Dónde romperse:** puede sentirse Mob Control 2 si el territorio es solo “pinto”. **Qué falta:** demostrar que split 70/30 es decisión interesante y no solo “x3 vs x2”. **Preocupa:** cercanía a Mob. **Entusiasma:** masa desproporcionada inmediata.

**E — Cadena Programable — Qué es:** colocas 1 pin + tiras. **Por qué existe:** preparación → ejecución → consecuencia con recurso. **Diferente:** Peggle donde TÚ pones el peg. **Dónde romperse:** puede volverse puzzle de “solución correcta”. **Qué falta:** demostrar que hay varias jugadas buenas, no una. **Preocupa:** cerebralo. **Entusiasma:** pin que divide y explota.

**C y D quedan fuera del TOP 3 por ahora** (C puede ser Clash raro, D puede ser una acción repetida), pero no descartados del todo — son direcciones válidas si B/E/A fallan en prototipo de papel.

> **READY FOR HUMAN DECISION — 3 direcciones, sin código, sin MVP, sin ganador forzado. Elige 1 para prototipar o di “ninguna alcanza el estándar y seguimos investigando”.**
```

