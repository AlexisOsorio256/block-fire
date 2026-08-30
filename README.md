# PULSE DAM

> **Juego mobile-first de interacción mínima donde el jugador contiene deliberadamente una masa en movimiento, acumula presión/tensión y decide cuándo liberar esa energía para provocar una consecuencia física masiva.**

> ⚠️ **PULSE DAM NO ESTÁ VALIDADO COMO PRODUCTO.**  
> **EL MVP ESTÁ TÉCNICAMENTE IMPLEMENTADO.**  
> **EL CORE GAMEPLAY ESTÁ EN FASE DE VALIDACIÓN HUMANA.**  
> **NO AGREGAR FEATURES HASTA COMPLETAR ESTA VALIDACIÓN.**  
> Ver semáforo abajo: `TECHNICAL: PASS / GAMEPLAY: PROMISING / PRODUCT: NOT VALIDATED`.

---

## Qué es

Pulse Dam es un prototipo jugable HTML5 Canvas (sin dependencias) que explora una única interacción:

```
MANTÉN = CONTENER (cierra compuerta, acumula masa y presión)
SUELTA = LIBERAR  (abre compuerta, masa avalancha hacia el fort)
```

Una sola escena, una fortificación destructible, una masa de esferas físicas. La profundidad viene del **timing y el riesgo**, no de botones extra.

Stack: `index.html` + `style.css` + `game.js` — Canvas2D nativo + Web Audio. Sin backend, sin motores pesados.

---

## Qué estamos intentando conseguir

> **Crear un loop en el que el jugador presione para contener/acumular, sienta tensión creciente, libere voluntariamente y reciba una consecuencia física claramente mayor que su acción inicial, generando deseo inmediato de volver a intentarlo.**

No buscamos demostrar que una IA escribe código. Buscamos descubrir si **contener → aguantar → soltar** puede producir una reacción física y emocional desproporcionadamente satisfactoria.

---

## Core Loop

```
CONTENER
  ↓
ACUMULAR (masa + presión)
  ↓
AGUANTAR (riesgo creciente: grietas, fugas, vibración)
  ↓
DECIDIR (¿suelto ahora o aguanto un poco más?)
  ↓
LIBERAR (compuerta abre, masa acelera proporcional a presión)
  ↓
CAOS (impacto, colapso, partículas, shake, sonido)
  ↓
RECOMPENSA (bloques destruidos, score, presión)
  ↓
REINTENTAR (un toque, sin menús)
```

---

## Principios (resumen de PROJECT_RULES.md)

- **SMALL INPUT → LARGE CONSEQUENCE** — un dedo genera avalancha.
- **ACTIVE ANTICIPATION** — mientras contienes, decides y arriesgas.
- **PLAYER AGENCY** — el resultado depende de *cuándo* sueltas.
- **CONTROL SIMPLE / PROFUNDIDAD OCULTA** — no añadir botones.
- **ESCALADA** — más presión / más masa / más destrucción.
- **CAUSALIDAD VISUAL** — ves por qué pasó.
- **FAST RETRY** — siguiente partida a un toque.
- **JUICE COMO AMPLIFICADOR** — no oculta mecánica aburrida.

Jerarquía: `GAMEPLAY > ESTABILIDAD > PERFORMANCE > UX > INMERSIÓN > FEATURES` y `DIVERSIÓN > CLARIDAD > AGENCIA > ...`

Ver reglas completas: [`PROJECT_RULES.md`](./PROJECT_RULES.md)

---

## Estado actual

**MVP jugable — Pulse Dam v1.0 (2026-08-30) — AUDITADO**

> **TECHNICAL: PASS — VISUAL: PASS — GAMEPLAY: PROMISING / PENDING HUMAN TEST — PRODUCT: NOT VALIDATED**

Implementado:

- ✅ Canal vertical con paredes y compuerta instantánea
- ✅ Masa de esferas (`max 150`, `gravity 980`, spawn `84ms`) con apilamiento creíble
- ✅ Presión `0–100%` en `3400ms` con umbrales `crack 42% / leak 62% / danger 75% / overload 100%`
- ✅ Visuales de tensión: grietas, fugas, vibración, tinte `azul→amarillo→rojo`, barra pulsante
- ✅ Release con impulso `base 320 + 8.8×presión`, spread proporcional, `hitStop`/`shake` jerárquico
- ✅ Fort de 25 bloques (pirámide + torre + bandera), `hp` variable, física de caída
- ✅ Destrucción: `perBlock 42` + `pressureBonus` + `riskBonus 125` + `overload -85`
- ✅ Audio Web Audio: `CHARGE tick / RELEASE whoosh / IMPACT thud / DESTRUCTION crumble / OVERLOAD`
- ✅ Score / Best (`localStorage pulseDamBest`) + feedback `¡CRÍTICO! / ¡PULSO MASIVO!`
- ✅ Retry instantáneo y debug `DEBUG=false` + `DEBUG_SKINLESS` (ver Skinless Test)
- ✅ Capturas A–G + tests técnicos `10/10` (¡ojo! técnico ≠ diversión)

No implementado (prohibido en MVP sin validar core): tienda, monedas, skins, backend, leaderboard, multiplayer, anuncios, economía, etc.

**Estado honesto:**

- **Técnico PASS:** arquitectura limpia, 60fps, `10/10` tests, capturas auditables.
- **Visual PASS:** causalidad clara en captures, juice jerárquico.
- **Gameplay PROMISING / PENDING:** en pruebas internas el riesgo `78–97%` ya invita a “otra”, pero **no ha sido validado con jugadores reales**. Los tests automatizados demuestran que el programa hace lo que se pidió, **no que sea divertido**. Ver `DESIGN_LOG.md` auditoría 1854 líneas y Skinless Test.
- **Producto NOT VALIDATED:** no agregar features hasta completar playtest humano (ver checklist cualitativo abajo). No es “production ready”, es **candidato que merece prueba humana**.

### Semáforo (auditado 2026-08-30)

| Área                | Estado |
| ------------------- | ------ |
| Arquitectura        | 🟢 PASS |
| Control             | 🟢 PASS |
| Causalidad          | 🟢 PASS |
| Feedback            | 🟢 PASS |
| Retry               | 🟢 PASS |
| Evidencia visual    | 🟢 PASS |
| Documentación       | 🟢 PASS |
| Performance inicial | 🟢 PASS |
| Identidad           | 🟡 PROMISING |
| Profundidad         | 🟡 PROMISING |
| Diversión real      | 🟡 PENDING TEST |
| Retención           | ⚪ NOT VALIDATED |
| Potencial comercial | ⚪ NOT VALIDATED |

> Los ⚪ no son malos: simplemente no se pueden demostrar con código. Requieren playtest humano.

---

## Cómo ejecutar

```bash
# en la carpeta del proyecto
python3 -m http.server 8000
# abrir
http://localhost:8000
```

Controles:

- **Touch / Mouse:** mantén pulsado para contener, suelta para liberar
- **Teclado:** `Espacio` mantener/soltar, `Shift+D` debug
- **Botones:** `TOCA PARA CONTENER` / `TOCA PARA REINTENTAR`

Parámetros útiles:

- `?capture=ready|containment|tension|release|impact|result|retry|gameplay` — fuerza estado para screenshots
- `?runTests=1` — ejecuta harness 10 tests determinista (¡técnico, no gameplay!)
- `?skinless=1` — **Skinless Test**: desactiva arte, partículas, audio, shake. Solo círculos/rectángulos/fondo plano. Prueba si la decisión sigue siendo satisfactoria.
- `?capture=...&skinless=1` — combina captura + skinless para evidencia sin arte
- `?capture=...` usa `virtual-time-budget=3500` para que JS termine antes del screenshot (ver `DESIGN_LOG.md`)

Mobile-first: funciona con `pointer events`, `touch-action:none`, `DPR` adaptativo, `orientation` vertical. Desktop es herramienta de desarrollo.

---

## Cómo probar (checklist gameplay) — PLAYTEST HUMANO CUALITATIVO

> Los tests `?runTests=1` son **TECHNICAL PASS**. No demuestran diversión. Este checklist es el verdadero criterio de producto.

Haz estos 6 tests sin leer instrucciones previas (observa, no expliques):

- **A Primer contacto (5s):** ¿sabes qué hacer sin texto? (mantener)
- **B Primer release:** ¿soltar produce satisfacción inmediata? (avalanchas pequeñas vs grandes)
- **C Segundo intento:** ¿sabes qué hacer diferente? (aguantar más)
- **D Riesgo:** ¿aparece “aguanto un poco más”? (¿llegas a 78–97%?)
- **E Payoff:** ¿gran acumulación → reacción mucho mayor? (¿14+ bloques?)
- **F Repetición:** tras 3 partidas, ¿quieres “otra”?

**Criterio cualitativo (más valioso que “15 reintentos”):**

- **Después de la primera muerte:** ¿volvió a tocar sin que nadie se lo pidiera? (sí/no)
- **Después de la tercera:** ¿está experimentando voluntariamente con el tiempo de carga? (sí/no)
- **Después de la quinta:** ¿está intentando mejorar una decisión concreta? (sí/no)

> Una persona puede hacer 15 reintentos por paciencia o por completar la prueba; otra puede enamorarse en 4. Lo cualitativo dice más.

Criterio de aprobación (todos deben ser SÍ para `GAMEPLAY PASS`):

```
[ ] Se entiende rápido
[ ] Input responde inmediato
[ ] Contener crea tensión
[ ] Liberar crea satisfacción
[ ] Existe riesgo
[ ] Resultado > input
[ ] Causalidad clara
[ ] Derrota clara (overload por avaricia, no aleatoriedad)
[ ] Retry rápido
[ ] Deseo de repetir (observado cualitativamente)
```

Si alguno falla → `STATUS = NEEDS TUNING` (ajustar valores `maxHold / pressureMul / spawnInterval`, **no añadir features**).

### Skinless Test (prueba definitiva sin arte)

```
?skinless=1          → juega sin arte (círculos, rectángulos, fondo plano, sin partículas/audio/shake)
?capture=tension&skinless=1 → captura evidencia sin arte
```

Pregunta:

> **¿sigue siendo satisfactorio aguantar y soltar con solo círculos y rectángulos?**

- Si **SÍ** → el core tiene valor, el juice lo amplifica.
- Si **NO** → corregir core, no añadir partículas.

Evidencia: `capturas/skinless-*.png` (generar con `chromium --screenshot ...?capture=tension&skinless=1`).

---

## Validación visual

Capturas generadas con `chromium --headless --virtual-time-budget=3500`:

- `capturas/01-ready.png` — A Estado inicial (título, fort intacto, presión 0%)
- `capturas/02-containment.png` — B Contención (34%, masa en reservorio)
- `capturas/03-tension.png` — C Tensión máxima (87%, ¡CRÍTICO!, grietas, shake)
- `capturas/04-release.png` — D Release (avalancha, `¡PULSO PERFECTO!`)
- `capturas/05-impact.png` — E Impacto (colapso, partículas, `¡DEVASTADOR!`)
- `capturas/06-result.png` — F Game over / Result (`¡PULSO MASIVO! 23 bloques 612 pts`)
- `capturas/07-retry.png` — G Retry (ready tras resultado, Best conservado)
- `capturas/07-mobile.png` — 390×844 mobile
- `capturas/08-hires.png` — 1920×1080
- `capturas/10-tests.png` — 10/10 tests

Para regenerar:

```bash
chromium --headless --disable-gpu --virtual-time-budget=3500 --window-size=1280,800 --screenshot=/tmp/out.png http://localhost:8000/?capture=tension
# skinless
chromium --headless --disable-gpu --virtual-time-budget=3500 --window-size=1280,800 --screenshot=/tmp/skinless.png "http://localhost:8000/?capture=tension&skinless=1"
```

---

## Reglas del proyecto

- **Constitución canónica:** [`PROJECT_RULES.md`](./PROJECT_RULES.md) — controla el proyecto. Léela antes de modificar nada.
- **Historial de diseño:** [`DESIGN_LOG.md`](./DESIGN_LOG.md) — por qué existe cada valor.
- **Auditoría futura:** otra IA que entre debe leer `README → PROJECT_RULES → DESIGN_LOG → código → ejecutar → capturar → comparar contra 10 tests`. No modificar solo porque “podría mejorarse”.

Prohibido añadir sin justificar contra los 10 tests: tienda, monedas, skins, inventario, cartas, login, backend, leaderboard, multiplayer, anuncios, economía, misiones complejas, battle pass, etc.

---

## Estructura

```
PULSE-DAM/
├── README.md                    # este archivo
├── PROJECT_RULES.md             # constitución
├── DESIGN_LOG.md                # memoria histórica
├── index.html                   # MVP jugable
├── game.js                      # lógica completa (1854 líneas)
├── style.css                    # estilo mobile-first
├── capturas/                    # validación visual Pulse Dam (solo Pulse!)
│   ├── 01-ready.png
│   ├── 02-containment.png
│   ├── 03-tension.png
│   ├── 04-release.png
│   ├── 05-impact.png
│   ├── 06-result.png
│   ├── 07-mobile.png
│   ├── 08-hires.png
│   └── 10-tests.png
└── INFORME_SHIELD_SURGE.md      # informe histórico Shield Surge (legado, no canónico)
```

---

## Auditoría 1854 líneas — ¿estamos construyendo alrededor del juego?

**Líneas totales:** `1862` (`wc -l game.js`)

Desglose aproximado:

- **CONFIG + estado + DOM + resize + fort + spawn + partículas + score/feedback + game flow:** ~270 líneas (14%) — reglas mínimas
- **UPDATE (presión, spawner, física bolas, ball-ball, ball-block, blocks, partículas, result):** ~685 líneas (37%) — **core gameplay**
- **RENDER (dam, agua, compuerta, bloques, bolas, partículas, juice, skinless branch):** ~477 líneas (26%)
- **INPUT + audio + loop + capture helpers + test harness (10 tests):** ~430 líneas (23%)

> Conclusión: la mayoría es **estado/render/HUD/helpers + tests**, no sistemas de tuning excesivos. No hay tienda, economía, etc. El riesgo de “construir alrededor” está contenido, pero se vigilará: **no agregar sistemas hasta validar gameplay humano**.

## Pregunta definitiva + Skinless Test

> “¿Si elimino todo el arte y dejo círculos, masas, paredes y una compuerta, esta interacción sigue siendo divertida?”

Con Pulse Dam **afirmamos SÍ** pero **no lo habíamos demostrado con capturas** — solo con juice. Ahora existe prueba deliberada:

```bash
?skinless=1
```

- bolas → círculos blancos (rojo/amarillo solo si presión alta, sin glow)
- fort → rectángulos grises
- compuerta → rectángulo plano
- fondo → plano `#0a0e1e`
- sin partículas, sin audio, sin shake/flash

Si en `?skinless=1` sigue apareciendo la tensión `34%→87%` y el payoff `23 bloques`, el core pasa. Captura: `capturas/skinless-tension.png`.

Si **NO** pasa, hay que corregir core, no añadir partículas.

---

*Última actualización: 2026-08-30 — MVP Pulse Dam v1.0 AUDITADO.*
*`TECHNICAL: PASS / VISUAL: PASS / GAMEPLAY: PROMISING / PRODUCT: NOT VALIDATED`*
*Próximo paso: playtest humano con checklist cualitativo (6 preguntas + 3 observaciones). NO agregar features hasta completar.*
