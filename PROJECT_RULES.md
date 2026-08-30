# PROJECT_RULES.md — Constitución Canónica

> Este documento es la FUENTE CANÓNICA de reglas del proyecto. Controla todas las decisiones futuras. Cualquier cambio que contradiga estas reglas debe justificarse explícitamente contra los Tests Irrefutables.

---

## 1. IDENTIDAD DEL PROYECTO

**Nombre operativo:**

```
PULSE DAM
```

**Descripción:**

> Juego mobile-first de interacción mínima donde el jugador contiene deliberadamente una masa en movimiento, acumula presión/tensión y decide cuándo liberar esa energía para provocar una consecuencia física masiva.

**Género:** Physics / Timing / Destruction — One-button, portrait mobile.

**Stack:** HTML5 Canvas + JavaScript nativo + Web Audio. Sin dependencias, sin backend, sin motores pesados.

---

## 2. OBJETIVO IRREFUTABLE

> **Crear un loop en el que el jugador presione para contener/acumular, sienta tensión creciente, libere voluntariamente y reciba una consecuencia física claramente mayor que su acción inicial, generando deseo inmediato de volver a intentarlo.**

```
CONTENER → ACUMULAR → AGUANTAR → DECIDIR → LIBERAR → CAOS → RECOMPENSA → REINTENTAR
```

Toda decisión de diseño debe servir a esta frase. Si no lo hace, no pertenece al MVP.

---

## 3. TEST IRREFUTABLE DEL PROYECTO

Todo futuro cambio DEBE evaluarse contra estas 10 preguntas. Un "NO" en cualquiera es señal de `NEEDS TUNING`.

| # | Test | Pregunta |
|---|------|----------|
| 1 | **COMPRENSIÓN** | ¿Una persona puede entender lo esencial observando el juego durante unos segundos? |
| 2 | **AGENCIA** | ¿El jugador realmente causa el resultado? |
| 3 | **TENSIÓN** | ¿Contener la masa genera una decisión y no simplemente una espera? |
| 4 | **PAYOFF** | ¿Liberar produce una consecuencia claramente satisfactoria? |
| 5 | **ASIMETRÍA** | ¿Una pequeña acción del jugador produce una reacción visual mucho mayor? |
| 6 | **APRENDIZAJE** | ¿El jugador puede mejorar después de fallar? |
| 7 | **RETRY** | ¿Después de terminar una partida existe una razón inmediata para intentar otra? |
| 8 | **PERSONALIDAD** | ¿La mecánica sigue siendo interesante aunque se eliminen las texturas y el arte final? |
| 9 | **FRUSTRACIÓN** | ¿El fracaso se siente causado por una decisión del jugador y no por arbitrariedad? |
| 10 | **ONE MORE TRY** | ¿El juego provoca espontáneamente el deseo de intentar otra vez? |

> Si la pregunta definitiva **"¿provoca ONE MORE TRY?"** es NO → el proyecto **NO está listo**.

---

## 4. COSAS QUE APRENDIMOS

### ORBITAL SLING — Falló por:

- Cálculo espacial excesivo
- Predicción de trayectorias
- Espera pasiva
- Dificultad
- Poca expresividad
- Sensación genérica

**Regla:** No repetir. No introducir mecánicas que exijan cálculo mental de trayectorias.

### SHIELD SURGE — Falló por:

- Gameplay demasiado reactivo
- Poca iniciativa del jugador
- Payoff insuficientemente grande
- Falta de identidad mecánica
- Poca sensación de autoría

**Regla:** No repetir. No hacer juegos donde el jugador solo reacciona. Pulse Dam debe dar **iniciativa y autoría**: el jugador DECIDE cuándo liberar.

> El siguiente prototipo también puede fallar. Si falla, documentar por qué en `DESIGN_LOG.md` y no repetir el mismo error.

---

## 5. PRINCIPIOS DE DISEÑO

| Principio | Significado |
|-----------|-------------|
| **SMALL INPUT → LARGE CONSEQUENCE** | Una interacción pequeña (un dedo, un hold) debe poder producir una reacción enorme en pantalla. |
| **ACTIVE ANTICIPATION** | Mientras el jugador contiene, debe estar tomando una decisión o asumiendo un riesgo. No es espera pasiva. |
| **PLAYER AGENCY** | El resultado debe depender claramente de la decisión del jugador (cuándo liberar, cuánto arriesgar). |
| **CONTROL SIMPLE / PROFUNDIDAD OCULTA** | No añadir botones para fabricar profundidad. Profundidad = timing + riesgo + lectura de presión. |
| **ESCALADA** | La acción debe poder evolucionar hacia resultados progresivamente mayores (más masa, más presión, más destrucción). |
| **CAUSALIDAD VISUAL** | El jugador debe ver por qué ocurrió lo que ocurrió. Masa → compuerta → liberación → impacto → destrucción, todo visible y continuo. |
| **FAST RETRY** | La siguiente partida debe estar a un toque. Sin menús intermedios que rompan el loop. |
| **GAME JUICE COMO AMPLIFICADOR** | Los efectos deben aumentar una acción buena. No deben intentar salvar una acción aburrida. Jerarquía: `NORMAL < BUENO < PERFECTO < MASIVO`. |

**Jerarquía de prioridades técnicas:**

```
GAMEPLAY > ESTABILIDAD > PERFORMANCE > UX > INMERSIÓN > FEATURES
```

Dentro de gameplay:

```
DIVERSIÓN > CLARIDAD > AGENCIA > TENSIÓN > PAYOFF > REJUGABILIDAD > POLISH
```

---

## 6. COSAS PROHIBIDAS (en MVP)

No introducir automáticamente sin demostrar que el core funciona y sin superar los 10 tests:

- tienda, monedas, skins, inventario
- cartas, energía, login, backend, servidores
- leaderboard, multiplayer, anuncios
- economía, misiones complejas, battle pass, RPG
- árboles de mejoras
- decenas de niveles
- tutorial largo

**Regla:** El MVP debe demostrar primero que el core loop es divertido. Todo lo demás es distracción hasta entonces.

---

## 7. NO CLONAR

Pulse Dam puede inspirarse en **principios** observados en: Mob Control, Save the Doge, Peggle, Angry Birds, Donut County, Suika y otros.

Pero **NO copiar**:

- personajes, estética, estructura, niveles, UI, nombres, arte, enemigos, puertas, cañones, perros, abejas, sistemas específicos

La identidad debe venir de **nuestra interacción** (contener → acumular presión → liberar), no de assets prestados.

---

## 8. DEFINICIÓN DEL MVP

```
MASA + CANAL + COMPUERTA + CONTENCIÓN + ACUMULACIÓN + RELEASE + IMPACTO + DESTRUCCIÓN + SCORE + RETRY
```

Nada más es necesario inicialmente. Una sola escena jugable y bien pulida es suficiente.

### Escenario

- Arena 2D clara, canal/trayectoria controlada, paredes laterales, compuerta, masa móvil, objetivo destructible.

### Masa

- Puede ser partículas, clusters, esferas simples. `SENSACIÓN > PRECISIÓN FÍSICA`. La solución más sencilla que produzca buena sensación visual.

### Compuerta

```
HOLD   = CONTENER
RELEASE = LIBERAR
```
Respuesta al input inmediata. Sin animación larga antes del efecto.

### Contención

- Mientras HOLD: masa se acumula, presión/tensión crece, estado visual cambia, **riesgo creciente** visible.
- No es solo una barra de progreso. Debe sentirse *“estoy aguantando demasiado”*.

### Riesgo

```
más tiempo = más potencia + más riesgo
```
El jugador decide ¿suelto ahora o aguanto? Debe haber un punto donde aguantar se vuelve peligroso (crack, leak, overflow).

### Release

```
COMPUERTA → LIBERACIÓN → MASA → ACELERACIÓN → IMPACTO
```
Causal, inmediato, proporcional a lo acumulado.

### Payoff

`1 dedo → aguantar → soltar → MASA → CHOQUE → DESTRUCCIÓN`. Debe poder llenar gran parte de la pantalla.

### Objetivo destructible

Fortificación sencilla. Debe producir desplazamiento, ruptura, fragmentos, colapso, sonido, partículas, camera shake.

### Score

`score / best` al inicio. Puede premiar cantidad destruida, potencia, timing, riesgo. Sin economía.

### Debug

```js
const DEBUG = false;
```
Con DEBUG true mostrar FPS, masa, presión, tiempo contenido, potencia, estado, score.

---

## 9. JERARQUÍA DEL JUICE

```
NORMAL → BUENO → PERFECTO → MASIVO
```
No todo a máxima intensidad. Reservar el espectáculo para el payoff grande.

Efectos en orden: contención+release+impacto primero; después partículas, shake, hitstop, trails, audio, flashes.

Audio mínimo: `CHARGE, RELEASE, IMPACT, DESTRUCTION, FAIL` con `más presión = más tensión` y `más potencia = más impacto`.

---

## 10. REGLAS DE AUDITORÍA FUTURA

Cada vez que otra IA/agente abra el proyecto debe:

1. Leer `README.md`
2. Leer `PROJECT_RULES.md` (este archivo)
3. Leer `DESIGN_LOG.md`
4. Inspeccionar código
5. Ejecutar el juego
6. Capturar pantalla
7. Comparar contra los 10 tests

**No modificar solo porque "podría mejorarse".** Debe demostrar que la modificación ayuda a uno de los objetivos principales y registrar hipótesis/resultado en `DESIGN_LOG.md`.

### Cambios prohibidos sin justificación

- Añadir complejidad / controles
- Reducir claridad
- Aumentar tiempos muertos
- Hacer más difícil sin beneficio
- Ocultar información importante
- Reducir performance
- Añadir sistemas no necesarios

Cada cambio relevante debe responder:

> ¿Qué problema concreto estamos solucionando? ¿Cómo sabemos que lo solucionamos?

---

## 11. ESTRUCTURA DEL REPOSITORIO

```
PULSE-DAM/
├── README.md           # Qué es, cómo ejecutar, cómo probar, estado real
├── PROJECT_RULES.md    # Este archivo — controla el proyecto
├── DESIGN_LOG.md       # Memoria histórica de decisiones
├── index.html          # MVP jugable
├── game.js             # Lógica completa (sin deps)
└── style.css           # Estilo mobile-first
```

---

## 12. REGLAS MAESTRAS (recordatorio visible)

> **EL JUGADOR NO DEBE SENTIR QUE ESTÁ ESPERANDO PARA OBTENER UNA RECOMPENSA.**
> **DEBE SENTIR QUE ESTÁ ARRIESGÁNDOSE PARA CREAR UNA REACCIÓN.**

> **EL RESULTADO DEBE PARECER MAYOR QUE LA ACCIÓN QUE LO PRODUJO.**

> **SI EL JUEGO NO PROVOCA "OTRA", HAY QUE CAMBIAR EL JUEGO, NO SOLO EL CÓDIGO.**

> **¿Si elimino todo el arte y dejo círculos, masas, paredes y una compuerta, esta interacción sigue siendo divertida?** Si NO → corregir el core, no añadir partículas.

---

*Última actualización: 2026-08-30 — Constitución inicial Pulse Dam v1.0*
