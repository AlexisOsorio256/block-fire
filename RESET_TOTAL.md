# RESET TOTAL — PULSE DAM DESCARTADO

**Fecha:** 2026-08-30  
**Estado:** `PULSE DAM = PROTOTIPO DESCARTADO — NO REWORK`  
**Repositorio:** se conserva como experimento histórico (`PROJECT_RULES.md`, `DESIGN_LOG.md`, `capturas/`, `INFORME_SHIELD_SURGE.md`). No se construye encima.  
**Misión nueva:** encontrar `INPUT SIMPLE + MUCHAS DECISIONES` desde cero, con todo lo aprendido.

> Este documento es el **informe obligatorio** de la fase de exploración. No contiene código. Solo el juego que merece ser prototipado.

---

## 1. PRINCIPIOS EXTRAÍDOS (DE TODO LO ESTUDIADO)

No son copias de juegos, son mecanismos de decisión que funcionan:

**De Angry Birds —** Un input tonto (arrastrar y soltar) esconde: ángulo + fuerza + punto de impacto + material + orden + rebote + gravedad + viento implícito. Profundidad = *dónde y cómo*, no *cuánto*.

**De Mob Control —** Pequeña intervención (elegir puerta) → consecuencia visual enorme (x2, x5). Escalada, ruta, multiplicación, sensación de poder. El jugador optimiza, no solo reacciona.

**De Pool —** Dirección + fuerza + efecto + anticipación de la siguiente jugada. Cada tiro cambia el tablero para el siguiente. Segunda orden.

**De Clash Royale —** Una carta simple jugada en un lugar y momento = decenas de respuestas posibles. Simple de ejecutar, imposible de dominar. Economía interna + timing + posicionamiento.

**De Draw to Save —** *Player Authored Outcome*: “yo lo provoqué”. Si no sientes autoría, es una animación, no un juego.

**De Peggle —** Una bola → cadena audiovisual → combo → payoff. La anticipación del rebote es el juego.

**De Donut County —** Haces una cosa ridículamente simple (mover un agujero) y el mundo cambia progresivamente. Pocas acciones, mucha transformación visible.

**De Suika —** Reglas de fusión trivial (dos iguales → siguiente) + gravedad + espacio limitado = decisiones futuras condicionadas por el presente. Acumulativo.

**De Fruit Ninja —** Corte directo + feedback inmediato + combos + bombas como riesgo. Riesgo visible, castigo inmediato.

**De Vampire Survivors —** Pocas acciones manuales, sistemas que generan espectáculo. El jugador elige *qué* escalar, no *cuánto* clicar.

**Síntesis — Principios útiles para el nuevo juego:**
1.  **Una acción, muchas variables ocultas** (ángulo, fuerza, timing, posición)
2.  **Consecuencia desproporcionada** (x → 10x visual)
3.  **Segunda orden:** lo que haces ahora cambia el escenario de la siguiente decisión
4.  **Autoría:** sin “yo lo causé” no hay “otra”
5.  **Cadena:** una acción dispara otra → otra (no acción → recompensa plana)
6.  **Riesgo visible:** el premio grande se ve, pero también el coste de fallar
7.  **Espacio de decisiones grande sin botones nuevos**

---

## 2. ERRORES A NO REPETIR

### Orbital Sling — “Sé que funciona, pero no quiero jugarlo”

- **Cálculo espacial excesivo:** exigir predecir órbitas elípticas a ojo. El jugador pensaba más de lo que sentía.
- **Predicción pasiva:** soltar y esperar 2s a ver si daba. Sin agencia durante el vuelo.
- **Falta de payoff:** impacto visual pequeño vs cálculo grande.
- **Genérico:** se sentía como demo de física, no como juego con personalidad.

**Regla:** Si el jugador tiene que hacer trigonometría mental, está mal.

### Shield Surge — “Entiendo lo que hago, pero me da igual”

- **Reactivo, no proactivo:** escudo que reacciona a amenazas que vienen hacia ti. Nunca eliges, solo defiendes.
- **Payoff insuficiente:** absorber en el borde daba números, no espectáculo. `NORMAL` y `PERFECT` se veían casi igual.
- **Sin autoría:** el surge era automático. El jugador no decidía cuándo explotar.

**Regla:** Un juego donde solo reaccionas no genera “quiero otra jugada mia”.

### Pulse Dam — “Aquí sí hay decisión, pero no hay juego”

**Por qué se descarta completo (no rework):**

- **Concepto unidimensional:** toda la profundidad era `cuánto aguanto`. Una sola variable (tiempo) → una sola decisión (soltar). Pasado el “momento crítico 78-97%” no había nada más que aprender. A las 10 partidas ya habías visto todo.
- **Sin segunda orden:** soltar no cambiaba el siguiente turno. Cada ronda reseteaba el fort. No había “preparo la siguiente jugada”. Era `acción → resultado → reset`, no `acción → resultado → nuevo escenario`.
- **Sin espacio de decisiones:** no había *dónde* soltar, *cómo* apuntar, *qué* priorizar. Solo *cuándo*. Angry Birds con solo “cuánto estiro” sería igual de pobre.
- **Escalada solo numérica:** más presión = más velocidad = más bloques. No emergía estrategia nueva (como en Pool donde la bola blanca queda mal colocada).
- **Personalidad prestada:** visualmente era “presa de agua genérica”. Sin arte, eran `círculos → rectángulo → rectángulos grises`. No pasaba el test de silueta.
- **¿Por qué no rework?** Añadir “rutas para la avalancha” o “tipos de masa” sería **construir alrededor del juego** en lugar de encontrar un juego. El error es el núcleo, no los features. Mejor reset total.

**Regla:** Si el verbo central cabe en una palabra (`aguantar`) y no genera al menos 3 decisiones secundarias interesantes, el núcleo no tiene profundidad.

---

## 3. MAPA DEL ESPACIO DE DISEÑO

**Qué familias tienen MÁS potencial para `INPUT SIMPLE + MUCHAS DECISIONES + SEGUNDA ORDEN` (sin necesidad de arte ni física compleja):**

**TIER S — Prototipar primero:**
- **Física dirigida (Pool/Angry Birds/Peggle):** *Dirección + Fuerza + Rebote + Siguiente posición*. Segunda orden natural. Alto WOW, alta profundidad, test de 100 partidas fuerte.
- **Colocación + Transformación (Suika/Donut):** *Colocar → Fusionar → Espacio cambia*. Acumulativo, cada acción condiciona la siguiente. Muy adictivo, fácil de entender.
- **Redirección + Multiplicación (Mob Control):** *Elegir ruta → multiplicar → escalar*. Consecuencia visual enorme con input mínimo. Muy compartible.
- **Selección + Cadena (Peggle/Fruit Ninja):** *Elegir dónde cortar/lanzar → cadena*. Combos emergentes, riesgo visible.

**TIER A — Fuerte, pero necesita cuidado:**
- **Riesgo/Apuesta:** Doblar o romper, timing. Fácil de entender, difícil de dominar, pero sin sistema detrás se vuelve repetitivo.
- **Construcción efímera:** Colocar un soporte que desaparece → el escenario cambia para el siguiente turno. Buena segunda orden si el soporte importa.
- **Recursos internos:** 3 monedas / mano que pesa. Economía visible sin tienda. Requiere claridad extrema.

**TIER B — Interesante pero propenso a clon:**
- **Timing puro / Ritmo:** Muy accesible, pero sin posicionamiento se vuelve “juego de reflejos” y pierde profundidad estratégica.
- **Memoria/Patrones:** Profundo, pero difícil de hacer “one more try” físico y compartible.
- **Destrucción pura:** Satisfactorio 10s, pero sin construcción posterior no hay segunda orden.

**TIER C — Evitar para MVP:**
- **Simulación / Tycoon / RTS:** Demasiados sistemas para MVP.
- **Física compleja (fluidos, soft-body):** Rompe mobile y claridad.

**Conclusión del mapa:** Buscamos en la intersección **Física dirigida + Colocación + Redirección + Transformación**. Ahí nacen verbos compuestos tipo `APUNTAR + REBOTAR + ELEGIR RUTA + FUSIONAR` sin necesitar 3 botones.

---

## 4. 50 CONCEPTOS — 13 FAMILIAS

> Formato por concepto: Nombre / Verbo / Input / Objetivo / Decisión Principal / Secundarias / Sistema / Payoff / WOW / Riesgo / Failure / OneMoreTry / Profundidad / Personalidad
> Escala brutal (no 9/10 a todo). Solo los que pasan 5 filtros llegan a TOP 15.

### FAMILIA FÍSICA — Dirección, fuerza, rebote

**1. REBOTE MEDIDO**
- Verbo: APUNTAR
- Input: drag para ángulo + fuerza (una acción)
- Objetivo: derribar totens con 1 bola
- Decisión principal: ¿qué rebote uso para el segundo impacto?
- Secundarias: orden de totens, fuerza vs control, dejar bola bien colocada
- Sistema: una bola, paredes, 5-7 bloques con hp
- Payoff: cadena de 2-3 rebotes → derrumbe
- WOW: bola que parecía perdida vuelve y tira la torre
- Riesgo: forzar rebote difícil → fallar ambos
- Failure: bola queda mal para siguiente tiro (segunda orden)
- OneMoreTry: “si apunto 5° más a la izquierda, entra”
- Profundidad: ángulos, fuerza, orden
- Personalidad: Pool sin mesa

**2. CURVA PRESTADA**
- Verbo: CURVAR
- Input: flick con curva (drag + arqueo)
- Objetivo: rodear obstáculo y tocar 3 dianas
- Decisión: ¿curva amplia segura o curva cerrada arriesgada?
- Secundarias: punto de curva, velocidad, rebote en pared
- Sistema: trayectoria curva + pared + dianas que dan puntos
- Payoff: curva perfecta roza 3 dianas
- WOW: bola que gira y entra por rendija
- Riesgo: curva cerrada se estrella
- Failure: sin curva, sin puntos
- OneMoreTry: ajustar curva
- Profundidad: curva + rebote
- Personalidad: tiro con efecto

**3. ANCLA ELÁSTICA**
- Verbo: TENSAR
- Input: hold en ancla, drag y suelta (slingshot con ancla fija)
- Objetivo: alcanzar cofres lejanos
- Decisión: ¿cuánto tenso vs control del rebote de vuelta?
- Secundarias: ángulo de ancla, usar rebote de la banda elástica
- Sistema: goma elástica + paredes + cofres
- Payoff: tensión máxima → vuelo largo + rebote útil
- WOW: se estira al máximo y vuelve
- Riesgo: tensar de más → perder control
- Failure: corto
- OneMoreTry: tensar distinto
- Personalidad: tirachinas con memoria

**4. GRAVEDAD COMPARTIDA**
- Verbo: GIRAR
- Input: tap para rotar escenario 90°
- Objetivo: llevar bola a meta con gravedad
- Decisión: ¿cuándo girar?
- Secundarias: orden de giros, momentum
- Sistema: laberinto + gravedad que gira
- Payoff: 3 giros justos → bola cae perfecta
- WOW: giras y todo se reordena
- Riesgo: girar tarde → bola se atasca
- Failure: bucle
- OneMoreTry: probar secuencia
- Personalidad: puzzle gravitatorio

### FAMILIA TIMING

**5. LATIDO PARTIDO**
- Verbo: SINCRONIZAR
- Input: tap en el latido (círculo que late)
- Objetivo: hacer coincidir 2 pulsos
- Decisión: ¿tap temprano seguro o justo en pico arriesgado?
- Secundarias: cuál pulso priorizar, mantener racha
- Sistema: 2 círculos con ritmos distintos, ventana que se achica
- Payoff: pico → x3
- WOW: latidos se alinean
- Riesgo: fallar pico → pierdes racha
- Failure: desincronía
- OneMoreTry: “lo tenía”
- Profundidad: ritmo
- Personalidad: ritmo sin música

**6. VENTANA DOBLE**
- Verbo: ELEGIR MOMENTO
- Input: tap cuando 2 ventanas se solapan
- Objetivo: maximizar overlap
- Decisión: ¿esperar overlap grande o tomar pequeño seguro?
- Secundarias: cuál ventana mirar, anticipar
- Sistema: ventanas que se abren/cierran a ritmos distintos
- Payoff: overlap perfecto → x5
- WOW: se juntan justo
- Riesgo: esperar → pierdes ambas
- Failure: tap fuera
- OneMoreTry: timing
- Profundidad: lectura
- Personalidad: timing puro

**7. ECO A TIEMPO**
- Verbo: RETARDAR
- Input: tap, eco vuelve tras 1s (debes tapar eco)
- Objetivo: encadenar ecos
- Decisión: ¿dónde pongo el primer tap para que el eco caiga bien?
- Secundarias: posición + timing del eco
- Sistema: tap deja marca, eco rebota
- Payoff: cadena de 4 ecos
- WOW: eco que vuelve solo
- Riesgo: eco cae en mal sitio
- Failure: eco perdido
- OneMoreTry: colocar mejor
- Profundidad: posición + tiempo
- Personalidad: eco

**8. PULSO SECUENCIAL**
- Verbo: SEGUIR
- Input: hold y suelta al ritmo (como Guitar Hero de 1 botón)
- Objetivo: completar secuencia de 5 pulsos
- Decisión: ¿mantener o cortar secuencia?
- Secundarias: respiración, no precipitarse
- Sistema: barra con marcadores
- Payoff: 5 perfect → explosión
- WOW: racha
- Riesgo: arriesgar perfect → fail
- Failure: romper racha
- OneMoreTry: ritmo
- Profundidad: baja (solo ritmo)

### FAMILIA ESTRATEGIA / POSICIONAMIENTO

**9. SOMBRA DE RESERVA**
- Verbo: RESERVAR
- Input: tap para colocar pieza en reserva o en tablero (1 de 2)
- Objetivo: maximizar puntos en tablero 3x3
- Decisión: ¿juego ahora o reservo para combo futuro?
- Secundarias: qué pieza reservar, cuándo usar reserva
- Sistema: piezas caen, reserva de 1, tablero con combos
- Payoff: reserva → jugada futura x3
- WOW: “la guardé y ahora revienta”
- Riesgo: reservar mala pieza → bloqueas
- Failure: tablero se llena
- OneMoreTry: gestión
- Profundidad: alta (segunda orden clara)
- Personalidad: Suika + reserva

**10. CORTE DE CAMINO**
- Verbo: BLOQUEAR
- Input: tap en intersección para cerrar camino
- Objetivo: desviar flujo hacia tu meta
- Decisión: ¿qué camino cierras?
- Secundarias: anticipar flujo rival (vs sistema), dejar alternativa
- Sistema: flujos que avanzan por caminos
- Payoff: desvío perfecto → flujo masivo a tu base
- WOW: cierras y todo gira
- Riesgo: cierras mal → te bloqueas
- Failure: flujo perdido
- OneMoreTry: probar otro corte
- Profundidad: estrategia
- Personalidad: desvío

**11. SEGUNDA FILA**
- Verbo: POSPONER
- Input: drag pieza a fila 1 (juega ya) o fila 2 (juega después)
- Objetivo: hacer líneas
- Decisión: ¿juego débil ahora o preparo fuerte después?
- Secundarias: qué va a fila 2, orden
- Sistema: 2 filas, piezas caen
- Payoff: fila 2 llena → combo
- WOW: “lo preparé”
- Failure: fila 2 se pudre
- OneMoreTry: planificación
- Profundidad: segunda orden
- Personalidad: Tetris con espera

**12. INTERCAMBIO DE TERRENO**
- Verbo: INTERCAMBIAR
- Input: tap 2 celdas para swap
- Objetivo: alinear 3
- Decisión: ¿qué swap da cadena futura, no solo inmediata?
- Secundarias: preparar siguiente swap
- Sistema: grid 5x5, cascada
- Payoff: swap → cascada de 2
- WOW: cascada inesperada
- Riesgo: swap que no da nada
- Failure: te quedas sin movimientos
- OneMoreTry: buscar cadena
- Profundidad: media

### FAMILIA PUZZLE / ENCAJE

**13. HUECO QUE CRECE**
- Verbo: COLOCAR (agujero)
- Input: drag hueco, suelta para que objetos caigan
- Objetivo: tragar todo con hueco mínimo
- Decisión: ¿dónde pongo el hueco ahora?
- Secundarias: orden de tragado, tamaño crece al tragar
- Sistema: Donut-like, objetos con tamaño
- Payoff: hueco pequeño traga grande al final
- WOW: crece y traga
- Riesgo: poner hueco mal → objetos se dispersan
- Failure: hueco no alcanza
- OneMoreTry: posición
- Profundidad: espacial
- Personalidad: agujero

**14. PIEZA PRESTADA**
- Verbo: PEDIR PRESTADO
- Input: tap para tomar pieza prestada (debes devolverla en 2 turnos)
- Objetivo: completar forma
- Decisión: ¿pido prestado ahora o espero?
- Secundarias: qué pieza pedir, cómo devolver
- Sistema: préstamo con deuda
- Payoff: préstamo → forma perfecta
- WOW: “la devolví justo”
- Riesgo: no poder devolver → penalización
- Failure: deuda
- OneMoreTry: timing préstamo
- Profundidad: deuda
- Personalidad: préstamo

**15. GIRO INCOMPLETO**
- Verbo: GIRAR 90°
- Input: tap para girar pieza 90° (no 360 libre)
- Objetivo: encajar en hueco
- Decisión: ¿cuántos giros y cuándo parar?
- Secundarias: anticipar encaje siguiente
- Sistema: piezas caen, giro limitado
- Payoff: giro justo → encaje + bonus giro mínimo
- WOW: encaja de milagro
- Riesgo: girar de más → no encaja
- Failure: hueco
- OneMoreTry: girar distinto
- Profundidad: rotación

**16. ORDEN QUE PESA**
- Verbo: REORDENAR
- Input: drag para reordenar 3 piezas en cola
- Objetivo: hacer que la siguiente que caiga encaje
- Decisión: ¿qué orden deja mejor futuro?
- Secundarias: sacrificar encaje ahora por mejor después
- Sistema: cola de 3 visible
- Payoff: orden perfecto → 2 encajes seguidos
- WOW: “lo ordené y entró”
- Riesgo: reordenar mal → peor
- Failure: atasco
- OneMoreTry: reordenar
- Profundidad: segunda orden

### FAMILIA ACCIÓN / FLICK

**17. TIRÓN QUE ARRASTRA**
- Verbo: ARRASTRAR
- Input: swipe largo que arrastra todo a su paso
- Objetivo: llevar 5 objetos a meta de un tirón
- Decisión: ¿qué línea arrastra más sin llevarse bomba?
- Secundarias: ángulo de swipe, longitud
- Sistema: objetos + bombas, swipe con fricción
- Payoff: swipe que se lleva 5
- WOW: arrastra todo
- Riesgo: llevarse bomba → pierdes
- Failure: arrastrar poco
- OneMoreTry: ángulo
- Profundidad: selección

**18. EMPUJÓN EN CADENA**
- Verbo: EMPUJAR
- Input: tap en borde para empujar fila
- Objetivo: alinear 3 empujando
- Decisión: ¿qué fila empujo?
- Secundarias: qué dirección, anticipar cadena
- Sistema: grid, empuje desplaza
- Payoff: empuje → 2 líneas
- WOW: empuje que encadena
- Riesgo: empujar y romper
- Failure: desordena
- OneMoreTry: otra fila
- Profundidad: media

**19. CORTE QUE SEPARA**
- Verbo: CORTAR
- Input: dibujar línea corta para cortar objeto en 2
- Objetivo: separar parte buena de bomba
- Decisión: ¿dónde corto?
- Secundarias: ángulo de corte, qué parte conservas
- Sistema: objetos con bomba dentro
- Payoff: corte perfecto → parte buena cae, bomba se va
- WOW: corte quirúrgico
- Riesgo: cortar mal → pierdes
- Failure: corte que no separa
- OneMoreTry: ángulo
- Profundidad: precisión

**20. SOPLO DIRECCIONAL**
- Verbo: SOPLAR
- Input: hold y suelta para soplar en dirección (drag dirección)
- Objetivo: llevar plumas a meta con obstáculos
- Decisión: ¿dirección y fuerza del soplo?
- Secundarias: usar paredes para curvar
- Sistema: viento + plumas
- Payoff: soplo que curva y lleva 3
- WOW: soplo que gira
- Riesgo: soplo fuerte → fuera
- Failure: soplo débil
- OneMoreTry: dirección
- Profundidad: física suave

### FAMILIA RIESGO / APUESTA

**21. DOBLA O ROMPE**
- Verbo: DOBLAR
- Input: tap “doblar” antes de lanzar (apuesta)
- Objetivo: lanzar y acertar para doblar puntos, fallar → 0
- Decisión: ¿doblo o aseguro?
- Secundarias: cuándo doblar (racha)
- Sistema: lanzamiento + apuesta
- Payoff: 3 doblados seguidos → x8
- WOW: “me la jugué”
- Riesgo: fallar → 0
- Failure: avaricia
- OneMoreTry: doblar menos
- Profundidad: apuesta

**22. PRÉSTAMO DE TIEMPO**
- Verbo: PEDIR TIEMPO
- Input: tap para +2s pero siguiente ronda -2s
- Objetivo: completar puzzle a tiempo
- Decisión: ¿pido tiempo ahora?
- Secundarias: gestión de deuda temporal
- Sistema: tiempo prestado
- Payoff: pedir justo → completas
- WOW: “lo pedí y gané”
- Riesgo: deuda → siguiente imposible
- Failure: te quedas sin tiempo
- OneMoreTry: pedir distinto
- Profundidad: deuda

**23. TRES SEGUNDOS**
- Verbo: AGUANTAR (pero distinto a Pulse)
- Input: hold 3s exactos (suelta en 3.00 ±0.2)
- Objetivo: clavar 3.00
- Decisión: ¿suelto o aguanto 0.1 más?
- Secundarias: ritmo interno
- Sistema: timer oculto tras 1s
- Payoff: 3.00 perfect → x5
- WOW: clavar
- Riesgo: pasarse 0.1
- Failure: imprecisión
- OneMoreTry: timing
- Profundidad: baja (solo timing)

**24. ÚLTIMA FICHA**
- Verbo: APOSTAR FICHA
- Input: drag ficha a zona segura (1x) o arriesgada (3x)
- Objetivo: maximizar tras 5 fichas
- Decisión: ¿dónde pongo cada ficha?
- Secundarias: gestión de 5 fichas, leer probabilidades
- Sistema: zonas con % visible
- Payoff: 3x arriesgada entra
- WOW: “entró la de 3x”
- Riesgo: perder ficha
- Failure: mala gestión
- OneMoreTry: apostar distinto
- Profundidad: gestión

### FAMILIA TRANSFORMACIÓN / FUSIÓN

**25. DOS EN UNO (Suika-like puro)**
- Verbo: FUSIONAR
- Input: tap para soltar pieza arriba
- Objetivo: fusionar iguales → siguiente nivel
- Decisión: ¿dónde suelto para futura fusión?
- Secundarias: preparar cadena, no tapar
- Sistema: gravedad + fusión 1+1→2
- Payoff: fusión → fusión → fusión
- WOW: cadena de 3 fusiones
- Riesgo: soltar mal → atasco
- Failure: pila alta
- OneMoreTry: posición
- Profundidad: alta
- Personalidad: Suika

**26. COLOR QUE CONTAGIA**
- Verbo: CONTAGIAR
- Input: tap en celda para contagiar color a vecinos
- Objetivo: todo de un color
- Decisión: ¿qué celda contagio primero?
- Secundarias: orden de contagio
- Sistema: flood fill limitado
- Payoff: contagio en 3 pasos
- WOW: todo cambia
- Riesgo: contagio bloqueado
- Failure: bucle
- OneMoreTry: otro inicio
- Profundidad: puzzle

**27. FORMA QUE APRENDE**
- Verbo: COPIAR FORMA
- Input: dibujar forma, sistema la replica con física
- Objetivo: hacer forma que encaje y ruede
- Decisión: ¿qué forma dibujo?
- Secundarias: tamaño, peso
- Sistema: dibujo → cuerpo físico
- Payoff: forma que rueda perfecto
- WOW: “lo dibujé y funcionó”
- Riesgo: forma mala → no rueda
- Failure: forma inútil
- OneMoreTry: dibujar mejor
- Profundidad: creatividad

**28. INTERCAMBIO FORZADO**
- Verbo: INTERCAMBIAR
- Input: tap 2 piezas para swap forzado (una es aleatoria rival)
- Objetivo: mejorar tu tablero
- Decisión: ¿qué intercambio, aunque la otra pieza sea mala?
- Secundarias: sacrificar
- Sistema: swap con pieza aleatoria
- Payoff: swap que arregla 2
- WOW: “cambié y me salió”
- Riesgo: pieza aleatoria peor
- Failure: empeoras
- OneMoreTry: otro swap
- Profundidad: riesgo

**29. DIVISIÓN ÚTIL**
- Verbo: DIVIDIR
- Input: tap para dividir pieza en 2 mitades
- Objetivo: encajar mitades en huecos distintos
- Decisión: ¿divido o espero pieza entera?
- Secundarias: dónde dividir, qué mitad usar
- Sistema: división
- Payoff: dividir → 2 encajes
- WOW: “la partí y encajó”
- Riesgo: dividir mal → ninguna encaja
- Failure: desperdicio
- OneMoreTry: dividir distinto
- Profundidad: decisión

### FAMILIA CADENA / COMBO

**30. CHISPA QUE SALTA**
- Verbo: ENCENDER
- Input: tap en chispa inicial
- Objetivo: que chispa llegue a meta saltando
- Decisión: ¿dónde enciendo?
- Secundarias: qué camino, qué combustible
- Sistema: chispa salta entre nodos cercanos
- Payoff: cadena de 6 saltos
- WOW: chispa que viaja
- Riesgo: salto se corta
- Failure: chispa se apaga
- OneMoreTry: otro inicio
- Profundidad: camino

**31. REBOTE QUE MULTIPLICA**
- Verbo: MULTIPLICAR POR REBOTE
- Input: tap para soltar bola, cada rebote duplica (si cae en zona)
- Objetivo: maximizar rebotes en zona multiplicadora
- Decisión: ¿dónde suelto para maximizar rebotes?
- Secundarias: ángulo inicial
- Sistema: Peggle-like, zonas x2
- Payoff: 5 rebotes en x2 → x32
- WOW: rebote infinito
- Riesgo: rebote fuera de zona
- Failure: 1 rebote
- OneMoreTry: posición
- Profundidad: rebote

**32. CAÍDA GUIADA**
- Verbo: INCLINAR
- Input: drag para inclinar tablero
- Objetivo: bola toque 5 dianas al caer
- Decisión: ¿cuánto inclino y cuándo?
- Secundarias: timing de inclinación
- Sistema: gravedad + inclinación
- Payoff: inclinación → 5 dianas
- WOW: “la guié”
- Riesgo: inclinar de más → se sale
- Failure: cae directo
- OneMoreTry: inclinar distinto
- Profundidad: control

**33. ECO EN SALAS**
- Verbo: GRITAR
- Input: tap para emitir onda, rebota en salas
- Objetivo: onda toque 3 salas
- Decisión: ¿dónde grito?
- Secundarias: qué sala priorizar
- Sistema: onda que rebota y se divide
- Payoff: onda que llena 3 salas
- WOW: eco que se expande
- Riesgo: eco se pierde
- Failure: 1 sala
- OneMoreTry: otro origen
- Profundidad: espacial

### FAMILIA CONSTRUCCIÓN / COLOCACIÓN

**34. PUENTE DE UNO**
- Verbo: COLOCAR TABLA
- Input: drag tabla para puente (1 por turno)
- Objetivo: bola llegue a meta
- Decisión: ¿dónde pongo la tabla este turno?
- Secundarias: ángulo, qué hueco cubrir
- Sistema: bola rueda, tabla permanece 1 turno luego cae
- Payoff: puente justo → bola pasa y luego tabla cae y abre nuevo camino
- WOW: puente que se cae a tiempo
- Riesgo: tabla mal → bola se va
- Failure: puente inútil
- OneMoreTry: otra posición
- Profundidad: segunda orden (tabla que cae cambia siguiente)
- Personalidad: puente efímero

**35. TORRE CON PRÉSTAMO**
- Verbo: APILAR
- Input: tap para soltar bloque (con préstamo de bloque siguiente visible)
- Objetivo: torre alta sin caer
- Decisión: ¿dónde pongo bloque sabiendo el siguiente?
- Secundarias: equilibrio
- Sistema: física torre
- Payoff: 10 bloques → torre alta
- WOW: torre que se tambalea y aguanta
- Riesgo: poner mal → derrumbe
- Failure: caída
- OneMoreTry: colocar mejor
- Profundidad: física

**36. CAMINO QUE SE BORRA**
- Verbo: DIBUJAR CAMINO
- Input: dibujar línea, bola la sigue y la borra al pasar
- Objetivo: bola toque 3 dianas antes de que camino se borre
- Decisión: ¿qué camino dibujo que toque 3 en orden?
- Secundarias: orden, longitud
- Sistema: camino efímero
- Payoff: camino que toca 3
- WOW: “lo dibujé y lo hizo”
- Riesgo: camino largo → se borra antes
- Failure: bola se pierde
- OneMoreTry: dibujar distinto
- Profundidad: planificación

**37. SOPORTE FANTASMA**
- Verbo: COLOCAR FANTASMA
- Input: tap para poner soporte fantasma (dura 2s luego desaparece)
- Objetivo: que estructura no caiga esos 2s y haga algo
- Decisión: ¿dónde pongo fantasma y cuándo?
- Secundarias: timing
- Sistema: estructura inestable + soporte temporal
- Payoff: fantasma → estructura aguanta y hace cadena
- WOW: “lo sostuve justo”
- Riesgo: fantasma mal puesto → igual cae
- Failure: no sirve
- OneMoreTry: posición
- Profundidad: timing + posición

### FAMILIA DESTRUCCIÓN

**38. PUNTO DÉBIL**
- Verbo: GOLPEAR
- Input: tap en punto de estructura para golpear
- Objetivo: derrumbar con 1 golpe
- Decisión: ¿dónde golpeo?
- Secundarias: ángulo de golpe
- Sistema: estructura con puntos débiles ocultos
- Payoff: golpe en punto → derrumbe total
- WOW: “le di donde era”
- Riesgo: golpe donde no → nada
- Failure: golpe inútil
- OneMoreTry: otro punto
- Profundidad: observación

**39. CORTE LIMPIO**
- Verbo: CORTAR
- Input: swipe para cortar viga
- Objetivo: que corte provoque derrumbe hacia meta
- Decisión: ¿qué viga corto?
- Secundarias: orden de cortes
- Sistema: vigas + gravedad
- Payoff: 1 corte → todo cae a meta
- WOW: corte que derrumba
- Riesgo: cortar mal → se queda
- Failure: corte inútil
- OneMoreTry: otra viga
- Profundidad: causa

**40. DERRUMBE ELEGIDO**
- Verbo: ELEGIR ORDEN DE CAÍDA
- Input: tap en bloque para quitarlo (como Jenga)
- Objetivo: que al quitar, el resto caiga hacia meta
- Decisión: ¿qué bloque quito primero?
- Secundarias: orden
- Sistema: torre Jenga + meta abajo
- Payoff: quitar 1 → torre cae a meta
- WOW: Jenga inverso
- Riesgo: quitar mal → torre cae fuera
- Failure: derrumbe fuera
- OneMoreTry: otro bloque
- Profundidad: orden

**41. EXPLOSIÓN PRESTADA**
- Verbo: PRESTAR EXPLOSIÓN
- Input: tap para poner bomba prestada (explota en 3s, debes usarla)
- Objetivo: bomba rompa lo justo para que bola caiga
- Decisión: ¿dónde pongo bomba?
- Secundarias: timing de explosión
- Sistema: bomba con cuenta
- Payoff: bomba → abre camino
- WOW: explosión justa
- Riesgo: bomba mal → destruye meta
- Failure: explosión inútil
- OneMoreTry: otra posición
- Profundidad: timing

### FAMILIA RECURSOS

**42. TRES MONEDAS**
- Verbo: GASTAR
- Input: tap en objeto para comprar con 3 monedas (gastas 1 por turno)
- Objetivo: maximizar puntos con 3 monedas
- Decisión: ¿qué compro ahora o guardo?
- Secundarias: gestión de 3
- Sistema: tienda de 3 objetos por turno
- Payoff: comprar justo → combo
- WOW: “guardé y compré mejor”
- Riesgo: gastar mal → sin monedas para lo bueno
- Failure: mala gestión
- OneMoreTry: comprar distinto
- Profundidad: economía

**43. RESERVA QUE ESTORBA**
- Verbo: RESERVAR / DESCARTAR
- Input: swipe a reserva o a descarte
- Objetivo: no llenar reserva
- Decisión: ¿reservo o tiro?
- Secundarias: qué reservar para futuro
- Sistema: reserva limitada a 3, si se llena pierdes
- Payoff: reserva que luego usas
- WOW: “me salvé con la reserva”
- Riesgo: reservar de más → bloqueas
- Failure: reserva llena
- OneMoreTry: gestionar
- Profundidad: gestión

**44. MANO QUE PESA**
- Verbo: ELEGIR DE MANO
- Input: tap 1 de 3 cartas en mano (mano de 3, robas 1 por turno)
- Objetivo: jugar carta que mejor encaje
- Decisión: ¿qué carta juego ahora?
- Secundarias: qué dejo para después, anticipar robo
- Sistema: mano + descarte + robo
- Payoff: jugar carta que hace cadena con la que viene
- WOW: “me vino la que necesitaba”
- Riesgo: jugar mala carta → mano se atasca
- Failure: mano muerta
- OneMoreTry: elegir distinta
- Profundidad: mano

**45. DEUDA DE TURNO**
- Verbo: PEDIR DEUDA
- Input: tap para tomar deuda (+2 puntos ahora, -3 después)
- Objetivo: maximizar total en 5 turnos
- Decisión: ¿cuándo me endeudo?
- Secundarias: gestión deuda
- Sistema: deuda
- Payoff: deuda bien usada → ganas
- WOW: “me endeudé y remonté”
- Riesgo: deuda impagable
- Failure: deuda te hunde
- OneMoreTry: endeudarte distinto
- Profundidad: deuda

### FAMILIA PATRONES / MEMORIA

**46. SECUENCIA QUE SE ROMPE**
- Verbo: ROMPER PATRÓN
- Input: tap cuando patrón se rompe (ej: 3 rojos, 1 azul)
- Objetivo: detectar ruptura
- Decisión: ¿es ruptura o no?
- Secundarias: no precipitarse
- Sistema: patrón que a veces rompe
- Payoff: detectar ruptura → x3
- WOW: “lo vi”
- Riesgo: tap falso → pierdes
- Failure: no ver
- OneMoreTry: observar
- Profundidad: atención

**47. RITMO INVERSO**
- Verbo: INVERTIR RITMO
- Input: tap al ritmo, pero cada 4 se invierte
- Objetivo: no fallar inversión
- Decisión: ¿cuándo invertir?
- Secundarias: contar
- Sistema: ritmo con inversión
- Payoff: racha con inversión
- WOW: “lo invertí”
- Riesgo: olvidar invertir
- Failure: fallar
- OneMoreTry: contar
- Profundidad: ritmo

**48. SOMBRA DEL SIGUIENTE**
- Verbo: PREDECIR SOMBRA
- Input: tap donde caerá sombra en 1s
- Objetivo: acertar sombra
- Decisión: ¿dónde caerá?
- Secundarias: leer trayectoria
- Sistema: sombra que se mueve y se oculta
- Payoff: acertar sombra → x3
- WOW: “la predije”
- Riesgo: fallar → pierdes
- Failure: mala predicción
- OneMoreTry: predecir mejor
- Profundidad: predicción

**49. PAR QUE NO CIERRA**
- Verbo: EMPAREJAR
- Input: tap 2 celdas para emparejar (memoria)
- Objetivo: emparejar con giro: cada vez que fallas, tablero gira 90°
- Decisión: ¿qué par intento?
- Secundarias: recordar tras giro
- Sistema: memoria + giro
- Payoff: par tras giro → x2
- WOW: “me acordé girado”
- Riesgo: olvidar tras giro
- Failure: fallar
- OneMoreTry: recordar
- Profundidad: memoria espacial

**50. REGLA QUE CAMBIA**
- Verbo: CAMBIAR REGLA
- Input: tap para cambiar regla del tablero (ej: ahora rojo vale doble)
- Objetivo: cambiar regla cuando te conviene
- Decisión: ¿cuándo cambio regla?
- Secundarias: qué regla poner, anticipar
- Sistema: reglas intercambiables
- Payoff: cambiar regla → combo
- WOW: “cambié y gané”
- Riesgo: cambiar mal → pierdes
- Failure: regla mala
- OneMoreTry: cambiar distinto
- Profundidad: reglas

---

## 5. TOP 15 — Filtrados con 5 filtros + fortalezas/debilidades

**FILTRO 1 (no clon, explicable, control simple):** descartados 5,7,8,14,22,23,46,47 (ritmo puro, préstamo abstracto, memoria pura sin fisicalidad)  
**FILTRO 2 (¿qué más puede hacer además de lo obvio?):** descartados 6,15,18,38,48 (solo timing o solo golpear sin segunda orden)  
**FILTRO 3 (¿qué cambia sin otro botón?):** descartados 42,45 (economía que necesita UI)  
**FILTRO 4 (¿qué aprende en 10 partidas?):** descartados 30,46 (solo “probar otro inicio”)  
**FILTRO 5 (¿clip compartible?):** descartados 26,33,49 (poco visual)

**Sobreviven 15:**

### 1. REBOTE MEDIDO (Física)
- Fortalezas: segunda orden clara (bola queda mal/bien), fácil de entender, clip con rebote inesperado
- Debilidades: puede sentirse “ya lo hace Pool”
- Riesgo: física debe sentirse justa, no aleatoria
- Similitud peligrosa: Pool → diferenciar con totens con hp/materiales y meta vertical
- Probar: ¿cadena de 2 rebotes es legible?

### 2. CURVA PRESTADA
- F: curva + rebote, mucho control, WOW de curva cerrada
- D: curva puede ser difícil en móvil con dedo gordo
- R: sensibilidad
- S: “tiro curvo” genérico → darle identidad con dianas que se abren
- Probar: ¿curva con un dedo es precisa?

### 4. GRAVEDAD COMPARTIDA
- F: girar escenario es muy visual, segunda orden fuerte
- D: puede marear
- R: laberinto
- S: no clon directo, pero “girar tablero” es conocido
- Probar: ¿3 giros son divertidos sin mareo?

### 9. SOMBRA DE RESERVA (Estrategia)
- F: segunda orden perfecta (reserva = deuda futura), muy Suika pero con reserva, fácil de implementar DOM
- D: menos físico, más puzzle
- R: necesita claridad de reserva
- S: similar a Tetris Hold → diferenciar con tablero 3x3 y fusión
- Probar: ¿reserva genera “la guardé y ahora revienta”?

### 10. CORTE DE CAMINO
- F: desviar flujo es muy visual, decisión de una intersección → todo cambia
- D: flujo es abstracto
- R: legibilidad del flujo
- S: no clon obvio
- Probar: ¿desvío se entiende en 5s?

### 13. HUECO QUE CRECE (Donut)
- F: visual muy potente, simple, segunda orden (hueco crece)
- D: puede ser lento si hueco es pequeño
- R: ritmo
- S: Donut County es referencia directa → cambiar a forma rectangular que crece por absorción
- Probar: ¿crecer es satisfactorio sin ser lento?

### 16. ORDEN QUE PESA (Reordenar cola)
- F: reordenar 3 es segunda orden pura, sin física
- D: abstracto
- R: necesita feedback de “siguiente pieza” muy claro
- S: Tetris-like
- Probar: ¿reordenar se siente como jugada?

### 25. DOS EN UNO (Suika)
- F: probado, adictivo, segunda orden, fácil de implementar
- D: clon directo si es frutas
- R: identidad
- S: Suika → cambiar tema a “burbujas que se fusionan” o “números”
- Probar: ¿fusión con gravedad es suficiente sin copiar frutas?

### 29. DIVISIÓN ÚTIL
- F: dividir es decisión con riesgo, muy táctil
- D: dividir puede confundir
- R: claridad de mitades
- S: poco clon
- Probar: ¿dividir se entiende al primer intento?

### 31. REBOTE QUE MULTIPLICA (Peggle)
- F: multiplicación visual enorme, clip perfecto
- D: puede sentirse aleatorio si zonas son pequeñas
- R: balance de zonas
- S: Peggle → diferenciar con “zonas que tú eliges antes”
- Probar: ¿elegir zona antes del tiro añade decisión?

### 34. PUENTE DE UNO
- F: puente de 1 que luego cae = segunda orden física + temporal
- D: física de puente puede ser inestable
- R: estabilidad
- S: poco clon
- Probar: ¿puente efímero se siente como jugada o como truco?

### 36. CAMINO QUE SE BORRA
- F: dibujar camino que se borra es muy “player authored”, clip con setup claro
- D: dibujo libre puede ser impreciso
- R: precisión del dibujo
- S: similar a “draw to save” pero sin perro → cambiar a “camino para bola”
- Probar: ¿dibujo libre es controlable con un dedo?

### 39. CORTE LIMPIO (Destrucción)
- F: cortar viga → derrumbe causal, muy satisfactorio, 1 acción → mucha consecuencia
- D: corte debe sentirse preciso
- R: detección de corte
- S: “cortar cuerda” genérico → diferenciar con vigas con tensión visible
- Probar: ¿1 corte puede tirar todo sin ser aleatorio?

### 40. DERRUMBE ELEGIDO (Jenga)
- F: quitar bloque = elegir orden, Jenga inverso, muy táctil
- D: puede ser lento
- R: ritmo
- S: Jenga → diferenciar con meta abajo
- Probar: ¿quitar 1 bloque puede ser WOW?

### 44. MANO QUE PESA (Recursos mano 3)
- F: mano de 3 con robo = decisiones constantes, segunda orden (qué dejo)
- D: es cartas, puede sentirse no físico
- R: claridad de mano
- S: Clash Royale-like pero sin torres
- Probar: ¿3 cartas son suficientes para profundidad?

---

## 6. TOP 7 — Identidad + Jugabilidad + Profundidad + WOW

De los 15, los 7 que realmente tienen las 4:

**1. REBOTE MEDIDO** — Pool vertical con totens. Identidad: rebote medido. Jugabilidad: ángulo+fuerza+orden. Profundidad: 100 partidas = ángulos nuevos. WOW: rebote que vuelve.

**2. SOMBRA DE RESERVA** — Reserva 3x3 con fusión. Identidad: “guardar para después”. Jugabilidad: colocar vs reservar. Profundidad: gestión de espacio futuro. WOW: “la guardé y ahora hizo x3”.

**3. HUECO QUE CRECE** — Agujero rectangular que crece. Identidad: agujero que come. Jugabilidad: dónde ponerlo. Profundidad: orden de absorción cambia tamaño. WOW: pequeño traga grande.

**4. PUENTE DE UNO** — Puente de 1 que se cae. Identidad: puente efímero. Jugabilidad: dónde y cuándo poner puente. Profundidad: puente que cae abre/cierra siguiente. WOW: puente que se cae a tiempo y salva.

**5. CORTE LIMPIO** — Cortar viga. Identidad: corte quirúrgico. Jugabilidad: qué viga cortar. Profundidad: cada viga cambia derrumbe. WOW: 1 corte → todo colapsa a meta.

**6. REBOTE QUE MULTIPLICA** — Rebote + zona x2 elegida. Identidad: tú eliges la zona multiplicadora antes. Jugabilidad: dónde pongo zona x2 + dónde suelto. Profundidad: zona + tiro. WOW: bola que no para de multiplicar.

**7. MANO QUE PESA** — Mano de 3. Identidad: mano pequeña que pesa. Jugabilidad: qué juego ahora vs dejo. Profundidad: 100 partidas = lectura de mazo. WOW: “me vino la que necesitaba”.

Descartados de TOP 15 a 7: Curva Prestada (difícil dedo), Gravedad Compartida (mareo), Orden Que Pesa (abstracto), Dos en Uno (clon Suika), División Útil (confuso), Camino Que Se Borra (impreciso), Derrumbe Elegido (lento).

---

## 7. TOP 3

### #1 — REBOTE MEDIDO (Mayor potencial)
- **Por qué #1:** Pasa los 4 tests de oro: 5s se entiende (tira), 30s descubres rebote, 60s dominas ángulo, 10 partidas = orden, 100 partidas = especialista en dejar bola bien colocada. Segunda orden natural (posición de bola), clip perfecto (setup → tiro → rebote → derrumbe), personalidad sin arte (círculo + rectángulos + línea de tiro). Viabilidad Canvas 2D simple, sin backend, sin física compleja (solo rebote pared/bloque). No es clon de Pool porque es vertical, con totens con hp y meta de “dejar bien colocado”.

### #2 — SOMBRA DE RESERVA (Mejor alternativa)
- **Por qué #2:** Si REBOTE falla por ser “demasiado físico”, este es puzzle puro con segunda orden brutal (reserva). Muy distinto, muy adictivo, muy Suika pero con twist reserva que es “player authored”. Viabilidad DOM, no necesita Canvas. Riesgo: menos WOW físico, más cerebral. Ideal si queremos probar “sin física”.

### #3 — PUENTE DE UNO (Wildcard)
- **Por qué #3:** Es el más loco y con más identidad propia. Nadie piensa “es básicamente X”. Combina física simple + segunda orden temporal (puente que se cae). Si funciona, es mágico. Riesgo: física de puente puede ser frustrante. Pero si lo clavamos, tenemos algo nuevo. Wildcard perfecto.

---

## 8. GANADOR

### **REBOTE MEDIDO — Pool vertical de 1 bola + totens + “siguiente posición importa”**

**Elevator pitch:** Tiras 1 bola por turno (drag para ángulo + fuerza, como Angry Birds/Pool). La bola rebota en paredes y golpea totens (bloques con hp/material). Los totens caen y dan puntos, **pero lo que importa es dónde queda tu bola al final**: si queda bien colocada, el siguiente tiro es fácil; si queda mal, el siguiente es difícil. Cada tiro es una jugada con 3 decisiones: *qué totens ataco, con qué rebote, y dónde dejo la bola*.

**No es:** Pool (no hay mesa, no hay tacos, es vertical), no es Angry Birds (no hay resortera, es 1 bola que rebota, no proyectiles), no es Peggle (no hay clavijas, hay totens).

---

## 9. POR QUÉ GANÓ — Simulación conceptual

**Test 5 segundos — ¿Qué hace un jugador nuevo?**
> Ve una bola abajo, totens arriba, una línea punteada al draguear. Tira recto y le da a algo. Entiende: “tiro y rompo”. No necesita tutorial.

**Test 30 segundos — ¿Qué descubre?**
> “Si tiro a la pared primero, luego rebota y le pega a otro”. Descubre rebote. Ve que la bola queda en un sitio raro tras el tiro. Empieza a mirar dónde queda.

**Test 60 segundos — ¿Qué empieza a dominar?**
> Empieza a **apuntar con rebote**: pared → toten. Y a **controlar fuerza**: tiro suave deja bola cerca, tiro fuerte la manda lejos. Ya piensa: “tiro flojo a la izquierda para que rebote y quede centrada”.

**Test 10 partidas — ¿Qué decisiones nuevas aparecen?**
> Ya no solo “qué tiro primero”, sino: “¿hago el tiro seguro que tira 1 toten y deja bola bien, o el arriesgado que tira 2 pero deja bola mal en esquina?”. Aparece **plan A vs plan B**. También “¿qué material ataco primero? ¿madera (fácil) o piedra (necesita rebote)?”

**Test 100 partidas — ¿Qué hace un experto que un principiante no?**
> Un principiante tira fuerte al centro. Un experto:
> - Usa rebotes de 2 paredes para llegar a totens escondidos
> - Mide fuerza al milímetro para que bola quede “a tiro” del siguiente grupo
> - A veces **falla a propósito un toten fácil** para dejar bola perfecta para un combo de 3 después
> - Conoce que si deja bola en esquina, el siguiente tiro tiene 20° menos de ángulo útil
> No es “más rápido”, es **estratégicamente distinto**. Pasa el test de profundidad.

**Test “¿Hay mucho que hacer?” — Decisiones por partida típica (5 tiros):**
> Tiro 1: ¿ataco izquierda o derecha? ¿fuerza media para quedar centro o fuerte para tirar 2? ¿uso pared izquierda o tiro directo?  
> Tiro 2: ¿limpio el toten de hp2 con rebote o aseguro el de hp1? ¿dejo bola arriba para el siguiente o abajo?  
> Tiro 3: ¿arriesgo rebote doble para el toten de piedra o aseguro madera? ¿si fallo, dónde queda bola?  
> Tiro 4: ¿preparo tiro final o cierro partida con seguro?  
> Tiro 5: ¿tiro de remate con rebote o directo?  
> **15 decisiones reales sin un botón nuevo.**

**Test “¿Puedo hacer una jugada?” — Sí.**
> “Voy a hacer la jugada pared-derecha → toten piedra → dejar bola centrada para rematar izquierda”. Eso es una jugada con nombre.

**Test “¿Puedo cambiar de estrategia?” — Sí.**
> Plan A: ir por madera fácil y asegurar. Plan B: ir por piedra con rebote y jugársela. Plan C: no tirar a totens, colocar bola para siguiente turno (sacrificio).

**Test de espectador —** “¿dónde va a rebotar?” Hay anticipación antes del payoff. No es tiro → recompensa inmediata, es tiro → vuelo → rebote → impacto → derrumbe.

**Test de clip (10s):** Setup (drag, línea punteada, totens), Decisión (apuntar a pared), Ejecución (tiro), Payoff (rebote → toten → derrumbe + bola queda centrada). Clip completo.

**Test de personalidad (círculos/cuadrados/líneas):** Sí, sigue siendo “bola que rebota entre rectángulos y deja rastro”. Reconocible sin arte.

**Test de clon:** ¿Es básicamente Pool/Angry Birds/Peggle? No. Es vertical, 1 bola que se queda, totens con hp, y la segunda orden de “dónde queda” es única.

**Test de viabilidad:** Canvas 2D, 1 bola, 6-8 rectángulos, paredes, línea de tiro. Física: rebote pared (invertir vx), rebote bloque (AABB vs círculo). Sin backend, sin multiplayer, sin economía. MVP en 1 archivo si hace falta.

---

## 10. QUÉ DEBEMOS PROTOTIPAR PRIMERO — Solo MVP conceptual, no código

**Objetivo del MVP:** Validar si **rebote + “dónde queda la bola”** genera `ONE MORE TRY` en 5 partidas.

**MVP mínimo (1 escena, sin features):**
```
1 bola blanca abajo (arrastrable para ángulo+fuerza)
3 paredes (izq, der, techo)
5-6 totens (rectángulos 2 con hp1 madera clara, 2 con hp2 piedra oscura, 1 toten alto)
Suelo donde bola se detiene y queda (no desaparece)
Línea punteada de previsualización (3 rebotes)
Score = totens caídos
Turno termina cuando bola se detiene (<5 velocidad)
Siguiente turno: bola aparece donde quedó (no resetea al centro)
Retry instantáneo (tap)
```

**Qué NO poner en MVP:** múltiples bolas, tienda, niveles, skins, viento, materiales complejos, sonido, partículas más allá de polvo al caer.

**Qué medir en playtest (mismas 6 preguntas de Pulse):**
1. ¿Entiende en 5s? (tira sin explicación)
2. ¿Me tenso? (¿dudo entre tiro seguro vs rebote arriesgado?)
3. ¿Me arriesgo? (¿intento rebote doble?)
4. ¿Me sorprende el payoff? (¿rebote inesperado tira algo?)
5. ¿Quiero volver? (¿tras fallar, quiero corregir ángulo?)
6. ¿Quiero mejorar decisión? (¿empiezo a pensar “dónde dejo la bola”?)

**Si esas 6 son SÍ en 3 de 5 testers, tenemos juego.** Si no, iterar ángulo/fuerza/posición de totens, no añadir features.

**Regla de oro para el prototipo:** No preguntar “¿qué más le ponemos?”, preguntar “¿qué decisión más puedo sacar del mismo tiro sin añadir un botón?”

---

> **Regla definitiva para el próximo prototipo:** No es “un juego sencillo”, es **fácil de controlar, difícil de dominar**. No más features, más decisiones. No más partículas, más consecuencias. No más sistemas, mejores interacciones entre sistemas. Esa es la identidad que no tenían Orbital, Shield ni Pulse.

