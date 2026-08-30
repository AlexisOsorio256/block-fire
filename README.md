# PULSE DAM

> **Juego mobile-first de interacción mínima donde el jugador contiene deliberadamente una masa en movimiento, acumula presión/tensión y decide cuándo liberar esa energía para provocar una consecuencia física masiva.**

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

**MVP jugable — Pulse Dam v1.0 (2026-08-30)**

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
- ✅ Retry instantáneo y debug `DEBUG=false`
- ✅ Capturas A–G + tests `10/10`

No implementado (prohibido en MVP sin validar core): tienda, monedas, skins, backend, leaderboard, multiplayer, anuncios, economía, etc.

**Estado honesto:** El core ya provoca “otra” en pruebas internas (riesgo vs payoff claro, `PAYOFF destrucción 23/25` con `92%`). Pendiente test con jugadores reales para ajustar `maxHold`, `pressureMul` y `spawnInterval`. No es “production ready”, es **prototipo para descubrir si merece seguir vivo**.

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
- `?runTests=1` — ejecuta harness 10 tests determinista
- `?capture=...` usa `virtual-time-budget=3500` para que JS termine antes del screenshot (ver `DESIGN_LOG.md`)

Mobile-first: funciona con `pointer events`, `touch-action:none`, `DPR` adaptativo, `orientation` vertical. Desktop es herramienta de desarrollo.

---

## Cómo probar (checklist gameplay)

Haz estos 6 tests sin leer instrucciones previas:

- **A Primer contacto (5s):** ¿sabes qué hacer sin texto? (mantener)
- **B Primer release:** ¿soltar produce satisfacción? (avalanchas pequeñas vs grandes)
- **C Segundo intento:** ¿sabes qué hacer diferente? (aguantar más)
- **D Riesgo:** ¿aparece “aguanto un poco más”? (¿llegas a 78–97%?)
- **E Payoff:** ¿gran acumulación → reacción mucho mayor? (¿14+ bloques?)
- **F Repetición:** tras 3 partidas, ¿quieres “otra”? (¿retry <1s te invita?)

Criterio de aprobación (todos deben ser SÍ):

```
[ ] Se entiende rápido
[ ] Input responde inmediato
[ ] Contener crea tensión
[ ] Liberar crea satisfacción
[ ] Existe riesgo
[ ] Resultado > input
[ ] Causalidad clara
[ ] Derrota clara (overload)
[ ] Retry rápido
[ ] Deseo de repetir
```

Si alguno falla → `STATUS = NEEDS TUNING` (ajustar valores, no añadir features).

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

## Pregunta definitiva

> “¿Si elimino todo el arte y dejo círculos, masas, paredes y una compuerta, esta interacción sigue siendo divertida?”

Con Pulse Dam: **SÍ** — la decisión de riesgo (cuándo soltar) ya es divertida con solo círculos y rectángulos. El juice solo la amplifica.

Si la respuesta fuera NO, habría que cambiar el core, no añadir partículas.

---

*Última actualización: 2026-08-30 — MVP Pulse Dam v1.0. ¿Merece seguir vivo? Juega 3 partidas y decide.*
