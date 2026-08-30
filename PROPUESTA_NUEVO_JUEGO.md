# RESET PULSE DAM — NUEVO JUEGO SOBRE BASE PROBADA

**Fecha:** 2026-08-30  
**Orden:** Pulse Dam DESCARTADO como juego activo. Código y docs conservados como histórico. Infraestructura útil reutilizable.  
**Objetivo:** `BASE PROBADA + MUTACIÓN FUERTE = NUESTRO JUEGO` — nivel 3-4 diferenciación, `INPUT SIMPLE + MUCHAS DECISIONES + SEGUNDA ORDEN`

---

## A. INSPECCIÓN Y CLASIFICACIÓN DEL REPOSITORIO ACTUAL

**Repositorio:** `/home/alex/Documentos/pulse-dam` — `main` con 3 commits, 23 archivos, 1862 líneas `game.js`

### A. INFRAESTRUCTURA REUTILIZABLE (genérica, conservar para nuevo prototipo)

- `index.html` estructura (canvas + hud + overlay) → reutilizable como esqueleto DOM
- `style.css` base mobile-first, variables DPR, `touch-action:none`, `user-select:none` → reutilizable
- `game.js` — **Canvas setup** (`resize`, `DPR`, `W/H/CX`, `ctx.setTransform`) → conservar
- `game.js` — **Game loop** (`requestAnimationFrame`, `dt` cap 0.033, `time`, `lastFrame`, `visibilitychange`) → conservar
- `game.js` — **Input** (`pointerdown/up/cancel/leave`, `setPointerCapture`, `touchmove preventDefault`, `Space`, `touch-hint`) → conservar
- `game.js` — **Helpers matemáticos** (`clamp`, `lerp`, `rand`, `TAU`, `dist`) → conservar
- `game.js` — **Audio procedural** (`AudioContext`, `beep` con `oscillator`/`gain`/`biquad`, `sfx*` wrappers) → conservar
- `game.js` — **Partículas genéricas** (`spawnParticle`, `life`, `drag`, `max 180`, pooling) → conservar
- `game.js` — **Juice genérico** (`shake`/`shakeTime`, `flash`/`flashColor`, `hitStop`, `floaters`) → conservar
- `game.js` — **Debug** (`DEBUG`, `updateDebug` con FPS/estado) → conservar
- `game.js` — **Screenshot harness** (`?capture=ready|...` + `setTimeout` para forzar estados) → conservar patrón
- `game.js` — **Test harness** (`?runTests=1`, `tick`, `__TEST_RESULTS`, overlay) → conservar patrón
- `game.js` — **Storage** (`localStorage` best) → conservar
- `game.js` — **Vignette/grid** rendering helpers → conservar

### B. GAMEPLAY OBSOLETO PULSE DAM (eliminar completo, no dejar código muerto)

- `CONFIG.gate` (`thickness`, `maxHold`, `crackAt`, `leakAt`, `dangerAt`)
- `CONFIG.mass` (`radius`, `spawnInterval`, `gravity`, `wallRestitution`, `gateRestitution`)
- `CONFIG.blocks` / `CONFIG.release` / `CONFIG.score` específicos de presa
- Estado `gateClosed`, `holdTime`, `pressure`, `peakPressure`, `isOverload`, `releaseTime`, `blocksInitial/Destroyed`, `roundScore`
- Funciones `createFort` (fort piramidal específico), `spawnBall` (masa presa), `triggerRelease`, `triggerOverload`, `showResult` (scoring presión)
- Física `gate floor` (gateTop), `ball-ball` solo en reservorio, `ball vs blocks` fort específico
- Render: `DAM_W`, `GATE_Y`, `GROUND_Y`, `CHANNEL_LEFT/RIGHT`, `WALL_T`, agua con `waterY/wave`, compuerta con `bulge/grietas`, bloques con `hp/flag/tower`
- UI específica: `pressureBar`, `pressureFill` (0-100%), `feedback` `¡CRÍTICO!`, `statsLine` `MASA/BLOQUES`
- Capturas históricas `capturas/01-ready...10-tests` → **conservar en carpeta `capturas/historico-pulse/` como registro, no usar para nuevo juego**

**Regla de limpieza:** El nuevo `game.js` debe importar solo bloque A. Nada de B debe quedar importado ni referenciado. Si queda, es basura.

### C. HISTÓRICO

- Conservar sin borrar: `PROJECT_RULES.md` (v1.1), `DESIGN_LOG.md`, `RESET_TOTAL.md`, `INFORME_SHIELD_SURGE.md`, `capturas/` (mover a `capturas/historico-pulse/`), `README.md` actual (archivar como `README_PULSE_DAM_HISTORICO.md`)
- Nuevo juego tendrá `README.md`, `PROJECT_RULES.md`, `DESIGN_LOG.md` nuevos con **nuevo nombre operativo** (Pulse Dam descartado)

---

## B. 40 CONCEPTOS — BASE PROBADA + MUTACIÓN

> Cada concepto: Base probada (juego/género con mercado demostrado) + ADN conservado + Mutación estructural (nivel 2-4) + nueva fantasía. No es reskin.

### 1. REBOTE PERSISTENTE
- **BASE:** 8 Ball Pool (1B+ descargas, 31.7M reseñas)
- **ADN:** apuntar + fuerza + rebote + siguiente jugada
- **MUTACIÓN:** la bola **no resetea al centro**, queda donde se detuvo. Totens con hp/material reaccionan y cambian ángulo del siguiente tiro. Nivel 3 Remix
- **NUEVA FANTASÍA:** eres un “tacador” que deja la bola a propósito
- **INPUT:** drag para ángulo+fuerza, suelta
- **DECISIONES:** qué toten ataco, qué rebote uso (0/1/2 paredes), qué fuerza para dejar bola bien, qué material priorizar, si sacrifico toten fácil para preparar combo
- **CONSECUENCIAS:** toten cae, bola queda mal/bien, siguiente tiro más fácil/difícil, cadena de 2 rebotes
- **PROFUNDIDAD:** 100 partidas = ángulos nuevos, lectura de “dónde deja”
- **WOW:** bola que parecía perdida vuelve por pared y tira torre
- **ONE MORE TRY:** “si apunto 5° más y tiro flojo, queda centrada”
- **RIESGO:** rebote difícil → fallas y dejas bola en esquina
- **DIFERENCIACIÓN:** 3 (Pool vertical, totens hp, persistencia)
- **COMPLEJIDAD:** Baja — Canvas 2D, 1 círculo, 6 rects, rebote pared

### 2. TIRO CON RESERVA
- **BASE:** Angry Birds 2 (100M+, 6.3M reseñas) + Clash Royale (mano)
- **ADN:** trayectoria + estructura + consecuencia
- **MUTACIÓN:** antes de tirar eliges **1 de 3 proyectiles** en mano (pesado/rebote/explosivo) que ves. El siguiente se roba. Nivel 4 Nueva interpretación
- **NUEVA FANTASÍA:** arsenal que gestionas, no resortera infinita
- **INPUT:** drag para trayectoria + tap para elegir proyectil en mano 3
- **DECISIONES:** qué proyectil uso ahora vs guardo, qué estructura ataco con cada tipo, orden de uso
- **CONSECUENCIAS:** estructura cae distinto según proyectil, siguiente mano cambia
- **PROFUNDIDAD:** gestión de mano + trayectoria
- **WOW:** cambias a pesado y atraviesa todo
- **ONE MORE TRY:** “si guardo el explosivo para la torre...”
- **RIESGO:** usar mal proyectil → desperdicio
- **DIFERENCIACIÓN:** 4 (Angry con mano)
- **COMPLEJIDAD:** Media — 3 tipos proyectil, igual física

### 3. PUENTE QUE CAE
- **BASE:** Donut County (agujero que crece, simple + progresivo)
- **ADN:** hacer algo simple y ver mundo cambiar
- **MUTACIÓN:** colocas **1 tabla puente que dura 2s y luego cae**; la bola rueda por ella. El puente caído cambia el terreno para el siguiente tiro. Nivel 3 Remix
- **NUEVA FANTASÍA:** arquitecto de puentes efímeros
- **INPUT:** drag tabla (colocar) + tap para soltar bola
- **DECISIONES:** dónde pongo puente, ángulo, si lo uso ahora o lo guardo para siguiente, dónde cae
- **CONSECUENCIAS:** puente sostiene → bola pasa → puente cae y bloquea/abre nuevo camino
- **PROFUNDIDAD:** segunda orden temporal
- **WOW:** puente que se cae justo y salva la bola
- **ONE MORE TRY:** “si pongo tabla 10px más arriba...”
- **RIESGO:** tabla mal → bola se va y bloqueas siguiente
- **DIFERENCIACIÓN:** 4
- **COMPLEJIDAD:** Media — física puente simple

### 4. HUECO HAMBRIENTO
- **BASE:** Donut County
- **ADN:** agujero que traga
- **MUTACIÓN:** hueco **rectangular que crece solo si tragas objetos del mismo color**; si tragas otro color, se encoge. Nivel 2 Mutación
- **NUEVA FANTASÍA:** agujero quisquilloso
- **INPUT:** drag hueco
- **DECISIONES:** qué color tragar primero, orden, dónde posicionar
- **CONSECUENCIAS:** crece/encoge, traga más/menos
- **PROFUNDIDAD:** gestión color
- **WOW:** pequeño traga gigante del mismo color
- **ONE MORE TRY:** “si como rojos primero...”
- **RIESGO:** comer mal color → encoge y pierdes
- **DIFERENCIACIÓN:** 2
- **COMPLEJIDAD:** Baja

### 5. FUSIÓN CON POSICIÓN
- **BASE:** Suika (colocación + fusión + espacio)
- **ADN:** colocar + combinar iguales → siguiente + espacio limitado
- **MUTACIÓN:** **la fusión deja un “hueco de aire” que empuja** a vecinos. Fusionar no solo libera espacio, reposiciona. Nivel 3 Remix (Suika + Física)
- **NUEVA FANTASÍA:** alquimista que hace explotar burbujas
- **INPUT:** tap para soltar pieza arriba (columna)
- **DECISIONES:** dónde suelto, qué fusión preparo, si provoco empuje para reordenar
- **CONSECUENCIAS:** fusión → empuje → nueva caída → otra fusión
- **PROFUNDIDAD:** física + planificación
- **WOW:** fusión que empuja y encadena 3
- **ONE MORE TRY:** “si suelto aquí, empuja y fusiona”
- **RIESGO:** empuje desordena
- **DIFERENCIACIÓN:** 3
- **COMPLEJIDAD:** Media

### 6. SUIKA VERTICAL
- **BASE:** Suika
- **ADN:** colocar + fusión
- **MUTACIÓN:** tablero **vertical 3 columnas** donde eliges columna y pieza cae con rebote lateral. Nivel 2
- **NUEVA FANTASÍA:** Tetris de fusión vertical
- **INPUT:** tap columna
- **DECISIONES:** qué columna, anticipar rebote
- **CONSECUENCIAS:** fusión en columna vs entre columnas
- **PROFUNDIDAD:** columnas
- **WOW:** fusión entre columnas
- **ONE MORE TRY:** otra columna
- **RIESGO:** columna llena
- **DIFERENCIACIÓN:** 2
- **COMPLEJIDAD:** Baja

### 7. CORTE QUIRÚRGICO
- **BASE:** Fruit Ninja (corte directo + combo)
- **ADN:** interacción directa + respuesta inmediata
- **MUTACIÓN:** cortas **1 viga de una estructura** y toda la estructura cae con física; **solo 1 corte por turno**, la estructura queda para siguiente turno. Nivel 3 Remix (Fruit Ninja + Angry Birds)
- **NUEVA FANTASÍA:** demoledor quirúrgico
- **INPUT:** swipe corto sobre viga
- **DECISIONES:** qué viga corto, dejar estructura inestable para siguiente corte
- **CONSECUENCIAS:** derrumbe parcial, nueva forma para siguiente corte
- **PROFUNDIDAD:** cada corte cambia siguiente
- **WOW:** 1 corte → todo colapsa hacia meta
- **ONE MORE TRY:** “si corto la de abajo...”
- **RIESGO:** cortar mal → estructura se estabiliza peor
- **DIFERENCIACIÓN:** 3
- **COMPLEJIDAD:** Media

### 8. JENGA INVERSO
- **BASE:** Donut County + Jenga
- **ADN:** quitar y ver caer
- **MUTACIÓN:** quitas **1 bloque y el resto cae, pero los bloques caídos se convierten en recurso para construir tu torre**. Nivel 3
- **NUEVA FANTASÍA:** demoledor que construye
- **INPUT:** tap bloque para quitar
- **DECISIONES:** qué bloque quitar, dónde usar el recurso
- **CONSECUENCIAS:** torre enemiga cae, tu torre crece
- **PROFUNDIDAD:** destrucción → construcción
- **WOW:** quitas y tu torre crece
- **ONE MORE TRY:** otro bloque
- **RIESGO:** quitar mal → tu torre se cae
- **DIFERENCIACIÓN:** 3
- **COMPLEJIDAD:** Media

### 9. REBOTE QUE MULTIPLICA (ELEGIDO)
- **BASE:** Peggle (una bola → cadena) + Mob Control (multiplicación)
- **ADN:** cadena + consecuencia enorme
- **MUTACIÓN:** **antes de tirar, colocas 1 zona x2** en el tablero; cada rebote en esa zona duplica puntos y deja la zona para siguiente tiro pero se mueve. Nivel 4 Nueva interpretación
- **NUEVA FANTASÍA:** colocador de multiplicadores
- **INPUT:** tap para zona x2 + drag para tiro
- **DECISIONES:** dónde pongo x2, dónde tiro para rebotar ahí, si dejo x2 bien para siguiente
- **CONSECUENCIAS:** cadena x2 → x4 → x8, zona se desplaza
- **PROFUNDIDAD:** zona + tiro + siguiente
- **WOW:** bola que no para de multiplicar
- **ONE MORE TRY:** “si pongo x2 arriba...”
- **RIESGO:** zona mal → 1 rebote
- **DIFERENCIACIÓN:** 4
- **COMPLEJIDAD:** Media

### 10. CAMINO QUE SE BORRA
- **BASE:** Draw to Save (dibuja → consecuencia)
- **ADN:** player authored outcome
- **MUTACIÓN:** dibujas **camino de 1 trazo que la bola sigue y se borra al pasar**; el camino borrado deja hueco para siguiente. Nivel 3
- **NUEVA FANTASÍA:** dibujante de caminos fantasma
- **INPUT:** drag para dibujar camino
- **DECISIONES:** qué camino dibujo que toque 3 dianas en orden, cuánto dura
- **CONSECUENCIAS:** camino guía → se borra → nuevo hueco
- **PROFUNDIDAD:** planificación de trazo
- **WOW:** “lo dibujé y lo hizo”
- **RIESGO:** trazo largo → se borra antes
- **DIFERENCIACIÓN:** 3
- **COMPLEJIDAD:** Media (detección trazo)

### 11. FLOJO Y CARO
- **BASE:** Clash Royale (3 cartas, elegir)
- **ADN:** selección + timing + recurso
- **MUTACIÓN:** **mano de 3, cada carta cuesta 1-3 de tu “energía” que se recarga lento;** jugar carta cara deja sin energía 2 turnos. Nivel 3 Remix (Clash + Puzzle)
- **NUEVA FANTASÍA:** gestor de energía
- **INPUT:** tap carta de mano 3
- **DECISIONES:** qué carta juego ahora vs guardo, gestionar energía, anticipar recarga
- **CONSECUENCIAS:** carta potente → sin energía → siguiente turno flojo
- **PROFUNDIDAD:** economía + mano
- **WOW:** “gasté todo y remonté”
- **RIESGO:** gastar mal → mano muerta
- **DIFERENCIACIÓN:** 3
- **COMPLEJIDAD:** Baja (DOM)

### 12. MANO QUE PESA
- **BASE:** Clash Royale
- **ADN:** mano pequeña que pesa
- **MUTACIÓN:** **mano de 3 donde la carta no jugada se vuelve más barata cada turno** (incentivo a esperar). Nivel 2 Mutación
- **NUEVA FANTASÍA:** paciente vs impulsivo
- **INPUT:** tap carta
- **DECISIONES:** jugar ahora o esperar a que se abarate
- **CONSECUENCIAS:** carta barata → combo
- **PROFUNDIDAD:** timing de mano
- **WOW:** “la esperé y salió gratis”
- **RIESGO:** esperar → te atacan
- **DIFERENCIACIÓN:** 2
- **COMPLEJIDAD:** Baja

### 13. TRES MONEDAS
- **BASE:** Vampire Survivors (pocas acciones, mucha escalada)
- **ADN:** sistema genera espectáculo
- **MUTACIÓN:** **solo 3 monedas por partida, cada acción cuesta 1, pero cada acción escala** (cada tiro es más grande). Nivel 3
- **NUEVA FANTASÍA:** avaro que escala
- **INPUT:** tap para tirar / colocar
- **DECISIONES:** cuándo gastar moneda escasa
- **CONSECUENCIAS:** tiro 1 pequeño, tiro 3 enorme
- **PROFUNDIDAD:** gestión 3
- **WOW:** último tiro gigante
- **ONE MORE TRY:** “si guardo para el final...”
- **RIESGO:** gastar temprano → último flojo
- **DIFERENCIACIÓN:** 3
- **COMPLEJIDAD:** Baja

### 14. SOPLO QUE EMPUJA
- **BASE:** 8 Ball Pool (fuerza + dirección)
- **ADN:** apuntar + fuerza
- **MUTACIÓN:** **soplo direccional que empuja varias bolas a la vez** con fricción; soplar deja “viento residual” que afecta siguiente soplo. Nivel 3
- **NUEVA FANTASÍA:** dios del viento
- **INPUT:** drag dirección + fuerza soplo
- **DECISIONES:** dirección, fuerza, usar viento residual
- **CONSECUENCIAS:** varias bolas se mueven, viento queda
- **PROFUNDIDAD:** viento acumulativo
- **WOW:** soplo que arrastra 5
- **ONE MORE TRY:** “si soplo suave...”
- **RIESGO:** soplo fuerte se lleva todo fuera
- **DIFERENCIACIÓN:** 3
- **COMPLEJIDAD:** Media

### 15. ANCLA QUE VUELVE
- **BASE:** Angry Birds (tensar)
- **ADN:** trayectoria
- **MUTACIÓN:** **ancla elástica que tras lanzar vuelve y puedes re-tensar en el aire** 1 vez. Nivel 3
- **NUEVA FANTASÍA:** tirachinas con segundo aire
- **INPUT:** drag para tensar, tap en aire para re-tensar
- **DECISIONES:** cuándo re-tensar, ángulo
- **CONSECUENCIAS:** segundo impulso cambia trayectoria
- **PROFUNDIDAD:** timing aéreo
- **WOW:** vuelve y la relanzas
- **ONE MORE TRY:** re-tensar distinto
- **RIESGO:** re-tensar mal → se estrella
- **DIFERENCIACIÓN:** 3
- **COMPLEJIDAD:** Media

### 16. DOBLA O NADA (Riesgo)
- **BASE:** Mob Control (posicionamiento + multiplicación)
- **ADN:** pequeña intervención → enorme
- **MUTACIÓN:** **antes de elegir puerta, apuestas “doblar”** → si aciertas puerta buena, x2; si fallas, 0. Nivel 2 Mutación
- **NUEVA FANTASÍA:** apostador de puertas
- **INPUT:** tap puerta + tap doblar
- **DECISIONES:** ¿doblo o aseguro? ¿qué puerta?
- **CONSECUENCIAS:** riesgo visible
- **PROFUNDIDAD:** apuesta
- **WOW:** doblada entra x4
- **ONE MORE TRY:** “me la juego”
- **RIESGO:** 0
- **DIFERENCIACIÓN:** 2
- **COMPLEJIDAD:** Baja

### 17. TIRÓN QUE ARRASTRA
- **BASE:** Fruit Ninja (corte arrastra)
- **ADN:** gesto directo
- **MUTACIÓN:** **swipe largo arrastra todo a su paso, pero arrastra también bombas** → debes elegir línea que maximice buenos y evite bombas. Nivel 2
- **NUEVA FANTASÍA:** imán que arrastra
- **INPUT:** swipe
- **DECISIONES:** qué línea arrastra más buenos sin bomba
- **CONSECUENCIAS:** arrastra 5 → combo, arrastra bomba → pierdes
- **PROFUNDIDAD:** selección
- **WOW:** arrastra todo
- **ONE MORE TRY:** otro ángulo
- **RIESGO:** bomba
- **DIFERENCIACIÓN:** 2
- **COMPLEJIDAD:** Baja

### 18. INTERCAMBIO FORZADO
- **BASE:** Suika (fusión) + Clash Royale (swap)
- **ADN:** fusión + mano
- **MUTACIÓN:** **cada turno debes intercambiar 1 pieza tuya con 1 aleatoria del “mazo rival”** (ves la rival antes). Nivel 3
- **NUEVA FANTASÍA:** mercader forzado
- **INPUT:** tap 2 piezas para swap
- **DECISIONES:** qué intercambio aunque la rival sea mala, sacrificar
- **CONSECUENCIAS:** tu tablero cambia, rival no existe pero simula presión
- **PROFUNDIDAD:** sacrificio
- **WOW:** “cambié y me salió”
- **RIESGO:** pieza rival peor
- **DIFERENCIACIÓN:** 3
- **COMPLEJIDAD:** Baja

### 19. DIVISIÓN ÚTIL
- **BASE:** Suika + Tetris
- **ADN:** encaje + espacio
- **MUTACIÓN:** **puedes dividir tu pieza en 2 mitades** (tap) para encajar en 2 huecos, pero cada mitad vale la mitad de puntos. Nivel 3
- **NUEVA FANTASÍA:** cortador
- **INPUT:** tap para dividir / colocar entero
- **DECISIONES:** ¿divido o espero entera? ¿dónde va cada mitad?
- **CONSECUENCIAS:** 2 encajes vs 1 grande
- **PROFUNDIDAD:** división
- **WOW:** “la partí y encajó”
- **RIESGO:** dividir mal → ninguna encaja
- **DIFERENCIACIÓN:** 3
- **COMPLEJIDAD:** Media

### 20. CHISPA QUE SALTA
- **BASE:** Peggle + Twisted Tangle (nodo → nodo)
- **ADN:** cadena + resolver
- **MUTACIÓN:** **chispa que tú enciendes salta entre nodos cercanos automáticamente, pero tú eliges nodo inicial**; la chispa elige el camino más corto, tú eliges inicio para maximizar. Nivel 2
- **NUEVA FANTASÍA:** pirotécnico
- **INPUT:** tap nodo inicial
- **DECISIONES:** qué nodo inicio da cadena más larga
- **CONSECUENCIAS:** cadena de 6 saltos
- **PROFUNDIDAD:** lectura de grafo
- **WOW:** chispa que viaja sola
- **ONE MORE TRY:** otro inicio
- **RIESGO:** salto se corta
- **DIFERENCIACIÓN:** 2
- **COMPLEJIDAD:** Baja

### 21. CAÍDA GUIADA
- **BASE:** Donut County (inclinar) + Peggle
- **ADN:** inclinar + cadena
- **MUTACIÓN:** **inclinas tablero con drag y la bola cae tocando dianas; la inclinación queda para siguiente bola**. Nivel 3
- **NUEVA FANTASÍA:** inclinador
- **INPUT:** drag para inclinar
- **DECISIONES:** cuánto inclino, dejar inclinado para siguiente
- **CONSECUENCIAS:** inclinación persiste → siguiente bola distinta
- **PROFUNDIDAD:** segunda orden de inclinación
- **WOW:** “la dejé inclinada y la siguiente hizo combo”
- **RIESGO:** inclinar de más → se sale
- **DIFERENCIACIÓN:** 3
- **COMPLEJIDAD:** Media

### 22. ECO EN SALAS
- **BASE:** Peggle (onda)
- **ADN:** onda que rebota
- **MUTACIÓN:** **gritas (tap) y onda se divide en cada sala, tú eliges dónde gritar para que división toque 3 salas**. Nivel 2
- **NUEVA FANTASÍA:** gritón
- **INPUT:** tap sala origen
- **DECISIONES:** dónde gritar
- **CONSECUENCIAS:** onda divide → 3 salas
- **PROFUNDIDAD:** espacial
- **WOW:** eco que se expande
- **ONE MORE TRY:** otro origen
- **RIESGO:** eco se pierde
- **DIFERENCIACIÓN:** 2
- **COMPLEJIDAD:** Baja

### 23. PUNTO DÉBIL
- **BASE:** Angry Birds (estructura + punto débil)
- **ADN:** estructura + destrucción
- **MUTACIÓN:** **estructuras con punto débil que solo se ve si mantienes pulsado 0.5s (revela grieta), pero mantener te quita tiempo**. Nivel 3
- **NUEVA FANTASÍA:** inspector
- **INPUT:** hold para revelar + tap para golpear
- **DECISIONES:** ¿revelo punto débil o golpeo a ciegas rápido?
- **CONSECUENCIAS:** revelar → derrumbe total vs golpe rápido → poco
- **PROFUNDIDAD:** tiempo vs información
- **WOW:** “lo miré y lo tiré”
- **ONE MORE TRY:** revelar otro
- **RIESGO:** tiempo perdido
- **DIFERENCIACIÓN:** 3
- **COMPLEJIDAD:** Baja

### 24. EXPLOSIÓN PRESTADA
- **BASE:** Angry Birds (bomba) + Clash Royale (préstamo)
- **ADN:** bomba + timing
- **MUTACIÓN:** **bomba prestada que explota en 3s, debes colocarla ya, no puedes guardarla**. Nivel 2
- **NUEVA FANTASÍA:** artificiero apurado
- **INPUT:** tap para poner bomba
- **DECISIONES:** dónde poner bomba con prisa
- **CONSECUENCIAS:** bomba abre camino o destruye meta
- **PROFUNDIDAD:** prisa
- **WOW:** explosión justa
- **ONE MORE TRY:** otra posición
- **RIESGO:** mal puesta
- **DIFERENCIACIÓN:** 2
- **COMPLEJIDAD:** Baja

### 25. TRES MONEDAS V2
- **BASE:** Vampire Survivors (escalada con pocas acciones)
- **ADN:** pocas acciones → espectáculo
- **MUTACIÓN:** **3 monedas que al gastarlas hacen que el siguiente gasto sea más grande** (escala). Nivel 3
- **NUEVA FANTASÍA:** gastador escalado
- **INPUT:** tap para gastar
- **DECISIONES:** cuándo gastar para escalar
- **CONSECUENCIAS:** último gasto gigante
- **PROFUNDIDAD:** gestión escala
- **WOW:** último tiro enorme
- **ONE MORE TRY:** guardar
- **RIESGO:** gastar temprano
- **DIFERENCIACIÓN:** 3
- **COMPLEJIDAD:** Baja

### 26. RESERVA QUE ESTORBA
- **BASE:** Tetris + Clash Royale
- **ADN:** reserva limitada
- **MUTACIÓN:** **reserva de 3 que si se llena pierdes, pero la reserva se puede “vaciar” haciendo combo en tablero**. Nivel 3
- **NUEVA FANTASÍA:** malabarista
- **INPUT:** swipe a reserva o tablero
- **DECISIONES:** reservar vs jugar, cuándo vaciar
- **CONSECUENCIAS:** reserva llena → pierdes, combo → vacía
- **PROFUNDIDAD:** gestión
- **WOW:** “vacialé justo”
- **ONE MORE TRY:** gestionar mejor
- **RIESGO:** llenar
- **DIFERENCIACIÓN:** 3
- **COMPLEJIDAD:** Baja

### 27. SECUENCIA QUE SE ROMPE
- **BASE:** Twisted Tangle (resolver patrón)
- **ADN:** manipular + resolver
- **MUTACIÓN:** **patrón 3-1 que debes detectar ruptura tapando, pero cada acierto cambia el patrón siguiente**. Nivel 2
- **NUEVA FANTASÍA:** detector
- **INPUT:** tap ruptura
- **DECISIONES:** ¿es ruptura real?
- **CONSECUENCIAS:** ruptura → nuevo patrón
- **PROFUNDIDAD:** atención
- **WOW:** “lo vi”
- **ONE MORE TRY:** observar
- **RIESGO:** tap falso
- **DIFERENCIACIÓN:** 2
- **COMPLEJIDAD:** Baja

### 28. SOMBRA DEL SIGUIENTE
- **BASE:** Pool (anticipación) + Suika (siguiente pieza)
- **ADN:** siguiente jugada visible
- **MUTACIÓN:** **ves la sombra de dónde caerá la siguiente pieza si sueltas ahora, y puedes mover 1 celda la sombra con hold**. Nivel 3
- **NUEVA FANTASÍA:** vidente
- **INPUT:** drag para posición + hold para mover sombra
- **DECISIONES:** dónde suelto ahora vs dónde dejo sombra para después
- **CONSECUENCIAS:** sombra mueve → siguiente cae distinto
- **PROFUNDIDAD:** segunda orden
- **WOW:** “moví la sombra y encajó”
- **RIESGO:** mover mal sombra
- **DIFERENCIACIÓN:** 3
- **COMPLEJIDAD:** Baja

### 29. PAR QUE GIRA
- **BASE:** Twisted Tangle
- **ADN:** manipular nudos
- **MUTACIÓN:** **emparejas 2 celdas (memoria), pero cada fallo gira el tablero 90°**. Nivel 3
- **NUEVA FANTASÍA:** memoria giratoria
- **INPUT:** tap 2 celdas
- **DECISIONES:** qué par intentar tras giro
- **CONSECUENCIAS:** giro cambia memoria espacial
- **PROFUNDIDAD:** memoria + giro
- **WOW:** “me acordé girado”
- **ONE MORE TRY:** recordar
- **RIESGO:** olvidar
- **DIFERENCIACIÓN:** 3
- **COMPLEJIDAD:** Baja

### 30. REGLA QUE CAMBIA
- **BASE:** Clash Royale (cambiar regla) + Puzzle
- **ADN:** regla como recurso
- **MUTACIÓN:** **cambias regla del tablero (ej: rojo vale doble) 1 vez por partida, dura 3 turnos, luego vuelve**. Nivel 3
- **NUEVA FANTASÍA:** legislador
- **INPUT:** tap regla
- **DECISIONES:** cuándo cambiar regla, qué regla poner
- **CONSECUENCIAS:** tablero vale distinto 3 turnos
- **PROFUNDIDAD:** timing regla
- **WOW:** “cambié y gané”
- **ONE MORE TRY:** otra regla
- **RIESGO:** cambiar mal
- **DIFERENCIACIÓN:** 3
- **COMPLEJIDAD:** Media

### 31. TIRA Y RECOGE
- **BASE:** 8 Ball Pool + Donut County
- **ADN:** tirar + recoger
- **MUTACIÓN:** **bola que tiras deja rastro que luego puedes “recoger” arrastrando para recuperar fuerza del siguiente tiro**. Nivel 4
- **NUEVA FANTASÍA:** pescador de trayectorias
- **INPUT:** drag para tirar + swipe para recoger rastro
- **DECISIONES:** dónde tirar para dejar rastro útil, cuándo recoger
- **CONSECUENCIAS:** rastro → fuerza extra siguiente tiro
- **PROFUNDIDAD:** tiro + recogida
- **WOW:** “recogí mi tiro”
- **ONE MORE TRY:** rastro distinto
- **RIESGO:** rastro mal → fuerza perdida
- **DIFERENCIACIÓN:** 4
- **COMPLEJIDAD:** Media

### 32. IMÁN QUE ELIGE POLO
- **BASE:** Pool (rebotes magnéticos)
- **ADN:** rebote
- **MUTACIÓN:** **colocas 1 imán que atrae o repele (tap para cambiar polo) antes de tirar**. Nivel 3
- **NUEVA FANTASÍA:** magnetista
- **INPUT:** tap para poner imán + tap para polo + drag tiro
- **DECISIONES:** dónde pongo imán, polo N/S, cómo afecta tiro
- **CONSECUENCIAS:** imán curva trayectoria
- **PROFUNDIDAD:** polo + posición
- **WOW:** imán que curva
- **ONE MORE TRY:** polo opuesto
- **RIESGO:** imán mal → desvía fuera
- **DIFERENCIACIÓN:** 3
- **COMPLEJIDAD:** Media

### 33. TORRE QUE RESPIRA
- **BASE:** Suika + Jenga
- **ADN:** torre inestable
- **MUTACIÓN:** **torre que respira (se expande/contrae cada 2s), debes colocar bloque en fase contraída para que encaje, pero si lo haces en expandida ganas x2**. Nivel 3
- **NUEVA FANTASÍA:** constructor rítmico
- **INPUT:** tap timing con respiración
- **DECISIONES:** ¿coloco seguro en contraída o arriesgo en expandida?
- **CONSECUENCIAS:** timing → x2 y torre más alta
- **PROFUNDIDAD:** ritmo + construcción
- **WOW:** “lo puse expandida y aguantó”
- **ONE MORE TRY:** timing
- **RIESGO:** expandida → cae
- **DIFERENCIACIÓN:** 3
- **COMPLEJIDAD:** Media

### 34. COPIA FANTASMA
- **BASE:** Peggle + Donut County
- **ADN:** copia que actúa
- **MUTACIÓN:** **tu último tiro deja un fantasma que repite el tiro siguiente con 0.5s de retraso**. Nivel 4
- **NUEVA FANTASÍA:** eco de tiro
- **INPUT:** drag tiro (fantasma automático)
- **DECISIONES:** dónde tiro para que fantasma también acierte
- **CONSECUENCIAS:** 2 bolas (real + fantasma) con desfase
- **PROFUNDIDAD:** tiro que sirve para 2
- **WOW:** fantasma que hace el segundo impacto
- **ONE MORE TRY:** “si tiro aquí, fantasma limpia”
- **RIESGO:** fantasma estorba
- **DIFERENCIACIÓN:** 4
- **COMPLEJIDAD:** Media

### 35. LLAVE QUE ABRE DOS
- **BASE:** Twisted Tangle (llaves y cerraduras)
- **ADN:** llave → cerradura
- **MUTACIÓN:** **1 llave que tú giras abre 2 cerraduras a la vez si el ángulo es justo (45° abre ambas)**. Nivel 2
- **NUEVA FANTASÍA:** cerrajero angular
- **INPUT:** drag para girar llave
- **DECISIONES:** ángulo que abra 2
- **CONSECUENCIAS:** 1 giro → 2 aperturas
- **PROFUNDIDAD:** ángulo
- **WOW:** “abrí 2 de golpe”
- **ONE MORE TRY:** girar distinto
- **RIESGO:** ángulo mal → 0
- **DIFERENCIACIÓN:** 2
- **COMPLEJIDAD:** Baja

### 36. CARRERA DE SOMBRAS
- **BASE:** Vampire Survivors (oleada) + Timing
- **ADN:** oleada + timing
- **MUTACIÓN:** **3 sombras corren, tú tocas 1 para darle impulso, pero las otras 2 se frenan**. Nivel 3
- **NUEVA FANTASÍA:** entrenador de sombras
- **INPUT:** tap sombra para impulso
- **DECISIONES:** qué sombra impulso, cuándo, gestión 3
- **CONSECUENCIAS:** impulso → avanza, otras frenan → carrera cambia
- **PROFUNDIDAD:** gestión 3
- **WOW:** “impulsé a la última y remontó”
- **ONE MORE TRY:** impulsar otra
- **RIESGO:** impulsar mal → pierdes
- **DIFERENCIACIÓN:** 3
- **COMPLEJIDAD:** Baja

### 37. PINTAR EL REBOTE
- **BASE:** Pool + Peggle
- **ADN:** pintar + rebote
- **MUTACIÓN:** **pintas con el dedo 1 línea de rebote (1s) antes de tirar, la bola rebotará ahí aunque no haya pared**. Nivel 4
- **NUEVA FANTASÍA:** pintor de rebotes
- **INPUT:** drag para pintar línea + drag para tiro
- **DECISIONES:** dónde pinto rebote, dónde tiro para usarlo
- **CONSECUENCIAS:** rebote pintado → cadena nueva
- **PROFUNDIDAD:** línea + tiro
- **WOW:** “pinté el rebote y entró”
- **ONE MORE TRY:** línea distinta
- **RIESGO:** línea mal → rebote te saca
- **DIFERENCIACIÓN:** 4
- **COMPLEJIDAD:** Media

### 38. MERCADO DE TIROS
- **BASE:** Clash Royale (mercado) + Angry Birds
- **ADN:** mercado + tiro
- **MUTACIÓN:** **3 tiros en mercado, cada uno con precio (1-3), solo tienes 3 monedas por partida, el tiro caro es más potente**. Nivel 3
- **NUEVA FANTASÍA:** comprador de tiros
- **INPUT:** tap para comprar tiro + drag para tirar
- **DECISIONES:** qué tiro compro, cuándo gastar
- **CONSECUENCIAS:** tiro caro → más destrucción pero sin monedas después
- **PROFUNDIDAD:** economía de tiros
- **WOW:** “compré el caro y reventó”
- **ONE MORE TRY:** comprar barato
- **RIESGO:** gastar mal
- **DIFERENCIACIÓN:** 3
- **COMPLEJIDAD:** Media

### 39. FANTASMA QUE EMPUJA (Donut + Pool)
- **BASE:** Donut County
- **ADN:** agujero empuja
- **MUTACIÓN:** **agujero que no traga, empuja (sopla) todo 1 celda en dirección que eliges, luego se mueve**. Nivel 3
- **NUEVA FANTASÍA:** soplador
- **INPUT:** drag dirección empuje + tap para mover agujero
- **DECISIONES:** dirección de empuje, dónde mover agujero después
- **CONSECUENCIAS:** empuje → reordena → nuevo hueco
- **PROFUNDIDAD:** empuje + posición
- **WOW:** “empujé y todo encajó”
- **ONE MORE TRY:** empujar distinto
- **RIESGO:** empujar mal → desordena
- **DIFERENCIACIÓN:** 3
- **COMPLEJIDAD:** Media

### 40. TIEMPO PRESTADO 2.0
- **BASE:** Vampire Survivors + Suika
- **ADN:** tiempo como recurso
- **MUTACIÓN:** **pides +2s prestados, pero el tablero se encoge 10% por cada segundo pedido**. Nivel 3
- **NUEVA FANTASÍA:** deudor de espacio
- **INPUT:** tap para pedir tiempo
- **DECISIONES:** ¿pido tiempo aunque me encoja?
- **CONSECUENCIAS:** tiempo extra vs espacio menos
- **PROFUNDIDAD:** trade-off
- **WOW:** “pedí y gané con poco espacio”
- **RIESGO:** encoger → sin espacio
- **DIFERENCIACIÓN:** 3
- **COMPLEJIDAD:** Baja

---

## C. FILTROS APLICADOS

**Filtro “Mucho que hacer” (≥5 decisiones reales por partida):** descartados 23 (solo timing 3s), 27 (solo detectar), 38 (solo punto débil sin segunda orden) → quedan 37  
**Filtro “Jugada” (existe “voy a intentar esta jugada”):** descartados 4,22,30 (solo “probar otro inicio” sin jugada nombrable) → quedan 34  
**Filtro “Segunda orden” (acción cambia siguiente decisión):** descartados 16,17,24 (solo apuesta sin cambio de escenario) → quedan 31  
**Filtro “Maestría 100 partidas” (experto hace algo distinto, no solo más rápido):** descartados 20,21,26 (solo más rápido) → quedan 28  
**Filtro “Familiaridad 5s” (entiende familia):** todos pasan (todos son Pool/Angry/Donut/Suika reconocibles)  
**Filtro “Clon 0-1” (descartar clon/reskin):** descartados los 0-1 identificados (ninguno era 0, pero 6 y 12 eran 1) → quedan 28  
**Filtro “Comercial” (base con mercado probado):** todos tienen base con 100M+ descargas, pasan  
**Filtro “Técnico HTML5” (viable sin backend):** descartados 15 (ancla elástica con física compleja) y 33 (torre respira con física inestable) → quedan 26

**Tras filtros quedan 26 candidatos viables.** De ellos, elegimos TOP 15 por mayor densidad de decisiones + WOW + viabilidad.

---

## D. TOP 15

| # | Nombre | Base | ADN | Mutación | Decisiones clave | WOW | Profundidad | Riesgo | Dif. |
|---|--------|------|-----|----------|------------------|-----|-------------|--------|------|
|1|REBOTE PERSISTENTE|Pool|apuntar+fuerza+rebote|situación persistente|qué toten, qué rebote, fuerza, dónde deja|rebote que vuelve|100 partidas ángulos|dejar mal|3|
|2|TIRO CON RESERVA|Angry+Clash|trayectoria|mano 3 proyectiles|qué proyectil uso/guardó, qué estructura|pesado atraviesa|gestión mano|gastar mal|4|
|5|FUSIÓN CON POSICIÓN|Suika|fusión|fusión empuja|dónde suelto, qué empuje provoca|empuje que encadena 3|física+plan|desordena|3|
|7|CORTE QUIRÚRGICO|Fruit+Angry|corte|corte 1 viga con segunda orden|qué viga, qué deja para siguiente|1 corte colapsa|causal|estabiliza mal|3|
|9|REBOTE QUE MULTIPLICA|Peggle+Mob|multiplicación|zona x2 colocable|dónde pongo x2, dónde tiro|bola x8|zona+tiro|zona mal|4|
|10|CAMINO QUE SE BORRA|Draw|player authored|camino efímero|qué camino dibujo|“lo dibujé y lo hizo”|trazo|se borra|3|
|13|TRES MONEDAS V2|Vampire|escalada|3 monedas escalables|cuándo gasto|último gigante|gestión 3|gastar temprano|3|
|14|SOPLO QUE EMPUJA|Pool|dirección|viento residual|dirección+fuerza+viento|rastro viento|viento acumulativo|fuera|3|
|19|DIVISIÓN ÚTIL|Suika|encaje|dividir pieza|¿divido? dónde mitades|partí y encajó|división|mitades no encajan|3|
|25|TRES MONEDAS V2 — ya|Vampire|—|—|—|—|—|—|—|
|31|TIRA Y RECOGE|Pool+Donut|tiro+rastro|rastro que da fuerza siguiente|dónde tiro para rastro útil|recogí mi tiro|tiro+recogida|mala|4|
|32|IMÁN QUE ELIGE POLO|Pool|rebote|imán N/S colocable|dónde imán, polo|curva magnética|polo|desvía|3|
|34|COPIA FANTASMA|Peggle|eco|fantasma repite tiro|dónde tiro para que fantasma también|2 bolas desfase|tiro para 2|estorba|4|
|37|PINTAR EL REBOTE|Pool+Peggle|rebote|línea de rebote pintada|dónde pinto, dónde tiro|pinté y entró|línea+tiro|te saca|4|
|39|FANTASMA QUE EMPUJA|Donut|empuje|agujero empuja|dirección empuje|empujé y encajó|empuje|desordena|3|

*Nota: 13 y 25 son misma familia pero 13 es más simple, 25 es escalada; se mantienen ambas por perfiles distintos.*

---

## E. TOP 7 — Bases suficientemente diferentes

**1. REBOTE PERSISTENTE** (Pool) — Física dirigida + persistencia  
**2. TIRO CON RESERVA** (Angry+Clash) — Trayectoria + mano  
**3. FUSIÓN CON POSICIÓN** (Suika) — Colocación + física  
**4. CORTE QUIRÚRGICO** (Fruit Ninja) — Corte + destrucción con segunda orden  
**5. REBOTE QUE MULTIPLICA** (Peggle+Mob) — Cadena + multiplicación colocable  
**6. TIRA Y RECOGE** (Pool+Donut) — Tiro + recurso rastro  
**7. PINTAR EL REBOTE** (Pool+Peggle) — Creación de rebote

Descartados de TOP15 a 7 por ser variantes cercanas: CAMINO QUE SE BORRA (similar a PINTAR pero menos preciso), TRES MONEDAS (demasiado abstracto sin física), SOPLO (viento difícil de leer), DIVISIÓN (confuso), IMÁN (similar a PINTAR pero menos “player authored”), COPIA FANTASMA (similar a TIRA Y RECOGE), FANTASMA QUE EMPUJA (menos WOW que CORTE).

---

## F. TOP 3

### #1 MEJOR APUESTA — REBOTE PERSISTENTE
- **Base:** 8 Ball Pool
- **Mutación:** posición persistente + totens con hp/material + bola queda
- **Equilibrio:** diversión alta, base probada 1B+, diferenciación 3, profundidad 100 partidas, viabilidad Canvas baja
- **Por qué mejor apuesta:** pasa todos los tests de oro sin necesitar física compleja ni economía. Es el más fácil de entender y el más difícil de dominar con una sola mecánica.

### #2 ALTERNATIVA — TIRO CON RESERVA
- **Base:** Angry Birds 2 + Clash Royale
- **Mutación:** mano de 3 proyectiles con coste/efecto
- **Equilibrio:** si REBOTE falla por ser “demasiado Pool”, este es puzzle puro con gestión. Muy distinto, igual de profundo, viabilidad DOM. Perfil: cerebral vs físico.

### #3 WILDCARD — PINTAR EL REBOTE
- **Base:** Pool + Peggle
- **Mutación:** pintas tu propio rebote antes de tirar
- **Equilibrio:** el más original (nivel 4), nadie dirá “es básicamente X”. Riesgo: dibujo puede ser impreciso, pero si se clava, es mágico y muy compartible. Wildcard perfecto.

---

## G. TEST FINAL — TOP 3

### REBOTE PERSISTENTE
- **5s:** Ve bola, totens, línea punteada. Tira recto y rompe algo. Entiende “tiro y rompo”.
- **30s:** Descubre rebote pared → toten. Ve que bola queda donde cayó.
- **60s:** Domina fuerza para dejar bola centrada. Empieza a decir “tiro flojo a izquierda para quedar bien”.
- **10 partidas:** Elige entre seguro (1 toten + buena posición) vs arriesgado (2 totens + mala posición). Aparece plan A/B.
- **100 partidas:** Usa 2 paredes, falla a propósito un toten fácil para preparar combo de 3, conoce que esquina = -20° útil. No es más rápido, es estratégico.
- **Anuncio 3s:** bola rebota en pared → tira torre → bola queda centrada “¿dónde la dejo?”.
- **Espectador:** “¿dónde va a rebotar?” Anticipación.
- **Clip:** setup drag → tiro → rebote → derrumbe → bola queda. Compartible.
- **Frustración:** rebote que deja bola en esquina y siguiente tiro es horrible → siente que fue su decisión de fuerza, no RNG.
- **Retorno:** “si apunto 5° más...”

### TIRO CON RESERVA
- **5s:** Ve 3 proyectiles, tira uno. Entiende “elijo con qué tiro”.
- **30s:** Descubre que pesado atraviesa madera, rebote sirve para piedra.
- **60s:** Empieza a guardar explosivo para torre.
- **10 partidas:** Gestiona mano: no gasta explosivo en madera.
- **100 partidas:** Cuenta qué proyectil viene en 2 turnos, sacrifica tiro débil para preparar mano perfecta.
- **Anuncio:** cambio de proyectil → tiro pesado atraviesa todo.
- **Espectador:** “¿cuál va a usar?”
- **Clip:** cambia a pesado → atraviesa → torre cae.
- **Frustración:** gastar explosivo en nada → culpa propia.
- **Retorno:** “si guardo...”

### PINTAR EL REBOTE
- **5s:** Ve bola y pared blanca punteada que puede pintar. Pinta línea y tira. Rebota en tu línea.
- **30s:** Descubre que línea mal puesta te saca.
- **60s:** Pinta línea para doble rebote.
- **10 partidas:** Pinta línea que sirve para tiro actual y deja bien para siguiente.
- **100 partidas:** Pinta línea curva implícita con 2 segmentos, usa línea para corregir tiro malo.
- **Anuncio:** pinta línea → bola rebota donde no hay pared → entra.
- **Espectador:** “¿dónde la va a pintar?”
- **Clip:** pinta → tira → rebote pintado → gol.
- **Frustración:** línea imprecisa con dedo gordo.
- **Retorno:** “si la pinto 10px más arriba...”

### Partida sin hablar de features — REBOTE PERSISTENTE (ejemplo)

Veo 6 totens, 2 de piedra arriba a la derecha, 4 de madera abajo. Mi bola está abajo centrada.  
Pienso: “Si tiro directo a madera, tiro 2 y dejo bola centrada, pero piedra sigue. Si tiro a pared derecha, rebota a piedra y quizá tira 1 pero dejo bola en esquina y el siguiente será difícil.”  
Elijo arriesgar: tiro flojo a pared derecha.  
Pasa: bola va a pared, rebota, golpea piedra, piedra cae, pero bola queda en esquina derecha, casi sin ángulo para el siguiente.  
Ahora tengo que decidir: ¿intento un tiro curvo desde esquina o aseguro madera con tiro corto y sacrifico piedra?  
Hago tiro corto a madera, bola vuelve al centro.  
Ahora sí tengo ángulo para piedra.  
El resultado cambió mi siguiente decisión. Eso es segunda orden.

Si esto suena emocionante (y lo es), es buen candidato. Si sonara seco, lo descartaríamos. No lo es.

---

## H. MVP CONCEPTUAL DEL GANADOR

**Nombre operativo nuevo:** **REBOTE PERSISTENTE** (temporal, hasta encontrar fantasía final)

**MVP mínimo (sin features, sin metajuego):**
```
- 1 bola blanca abajo (drag para ángulo+fuerza, línea punteada 2 rebotes)
- 3 paredes (izq, der, techo), suelo donde bola se detiene y SE QUEDA
- 6 totens: 3 madera hp1 (clara), 2 piedra hp2 (oscura), 1 torre alta hp1
- Score = totens caídos, Best persistente
- Turno termina cuando bola velocidad <5
- Siguiente turno: bola aparece DONDE QUEDÓ (no resetea)
- Retry instantáneo (tap)
```
**Qué NO poner:** múltiples bolas, tienda, viento, materiales extra, sonido más allá de pop, partículas más allá de polvo.

**Qué medir (mismas 6 + 3 cualitativas):**
1. ¿entiende en 5s? 2. ¿se tensa entre seguro vs arriesgado? 3. ¿se arriesga a rebote doble? 4. ¿sorprende rebote que tira? 5. ¿quiere volver tras fallar esquina? 6. ¿empieza a pensar “dónde dejo la bola”? + 1ª muerte ¿vuelve solo? 3ª ¿experimenta? 5ª ¿mejora decisión?

Si 3 de 5 testers dicen sí, tenemos juego. Si no, iterar posiciones totens/ángulo, no añadir features.

---

## I. ESTRUCTURA DE DOCUMENTACIÓN PARA EL NUEVO JUEGO

Tras elegir ganador, se crearán (reutilizando infraestructura A):

- `README.md` nuevo (qué es, core, cómo probar, estado READY FOR PROTOTYPE)
- `PROJECT_RULES.md` nuevo (identidad, tests, cosas prohibidas, no clonar)
- `DESIGN_LOG.md` nuevo (por qué Rebot persistente, por qué no los otros 39)
- Histórico archivado: `PROJECT_RULES.md` actual → `PROJECT_RULES_PULSE_DAM_HISTORICO.md`, `README.md` → `README_PULSE_HISTORICO.md`, `capturas/` → `capturas/historico-pulse/`

Arquitectura: reutilizar `Canvas setup, resize, DPR, pointer events, loop, audio, partículas, shake, debug, harness` tal cual. Eliminar todo bloque B (presa). Nuevo `game.js` de ~600 líneas, no 1862, enfocado solo en 1 bola + 6 rects + línea.

---

## J. RESULTADO FINAL OBLIGATORIO

```
BASE PROBADA:
8 Ball Pool (1B+ descargas, 31.7M reseñas) — apuntar + fuerza + rebote + siguiente jugada

POR QUÉ ESA BASE:
Input comprensible en 1s (drag), pero espacio de decisiones enorme (ángulo, fuerza, objetivo, material, rebote, posición siguiente). Probado 1B veces, no necesita tutorial. Segunda orden natural (dónde queda la bola).

MUTACIÓN:
POSICIÓN PERSISTENTE + TOTENS CON HP/MATERIAL. La bola NO resetea al centro; queda donde se detuvo. Totens con hp1 madera / hp2 piedra obligan a elegir rebote vs directo. Cada tiro cambia el ángulo del siguiente. De “tiro → puntos → reset” a “tiro → resultado → nuevo escenario”.

NUESTRA IDENTIDAD:
No es Pool (no hay mesa, es vertical), no es Angry Birds (no hay resortera, es 1 bola que persiste), no es Peggle (no hay clavijas). Es “el pool que deja la bola donde cae y te obliga a pensar el siguiente tiro”. Silueta reconocible: círculo + 6 rectángulos + línea punteada de 2 rebotes.

CORE:
Drag para ángulo+fuerza → suelta → bola rebota en paredes → golpea totens → totens caen si hp0 → bola se detiene y SE QUEDA → siguiente turno desde ahí.

DECISIONES:
- qué totens ataco (madera fácil vs piedra que necesita rebote)
- qué rebote uso (0/1/2 paredes)
- qué fuerza para dejar bola bien/mal (tiro flojo deja cerca, fuerte manda lejos)
- si sacrifico toten fácil para preparar posición perfecta
- orden de ataque (izquierda vs derecha)
- riesgo: tiro seguro con mala posición vs tiro arriesgado con buena

WOW:
Bola que parecía perdida rebota en pared y tira torre de piedra, y además queda centrada para el siguiente. Cadena de 2 rebotes que limpia 3 totens.

ONE MORE TRY:
“Si apunto 5° más a la izquierda y tiro flojo, queda centrada y la siguiente entra.” Cada fallo deja bola en sitio que invita a corregir ángulo/fuerza. No es “más rápido”, es “más listo”.

RIESGO:
Física de rebote debe sentirse justa, no aleatoria. Si la bola en esquina deja sin ángulo útil y el jugador siente “no puedo hacer nada”, frustra. Mitigación: totens colocados para que siempre haya tiro seguro desde cualquier esquina, y línea punteada muestra 2 rebotes.

DIFERENCIACIÓN:
3 — Remix (Pool + persistencia + hp). Se reconoce familia Pool, pero experiencia es suficientemente diferente para sentirse producto propio. No es clon (0) ni reskin (1), es mutación fuerte (2) llegando a remix (3). Objetivo ideal es 3-4, estamos en 3.

MVP:
1 bola + 3 paredes + 6 totens + suelo persistente + línea 2 rebotes + score/best + retry. Canvas 2D, sin backend, ~600 líneas reutilizando infraestructura A. Medir 6 preguntas + 3 cualitativas en 5 testers.

STATUS:
READY FOR PROTOTYPE
```

