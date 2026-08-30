# DESIGN_LOG.md — Memoria de Diseño de PULSE DAM

> Registro histórico de decisiones importantes. Cada cambio relevante debe dejar hipótesis y resultado para que futuras IAs entiendan el porqué de los valores.

Formato: `FECHA | CAMBIO | MOTIVO | HIPÓTESIS | RESULTADO | DECISIÓN`

---

## 2026-08-30 — Constitución inicial

**Cambio:** Creación de `PROJECT_RULES.md` como fuente canónica.

**Motivo:** Los dos prototipos previos (Orbital Sling, Shield Surge) fallaron por dispersión y pérdida de foco. Sin constitución, el proyecto acumulaba features.

**Hipótesis:** Documentar identidad, objetivo irrefutable y 10 tests irrefutables evitará agregar tienda, monedas, etc. antes de validar el core.

**Resultado:** Constitución v1.0 creada, estructura `README / PROJECT_RULES / DESIGN_LOG` definida.

**Decisión:** Mantener.

---

## 2026-08-30 — Limpieza de legado Shield Surge

**Cambio:** Separación clara entre `PULSE DAM` y `SHIELD SURGE`. Renombrado `INFORME.md` → `INFORME_SHIELD_SURGE.md`, limpieza de `capturas/` (movidas a `/tmp/backup_shield`, regeneradas para Pulse).

**Motivo:** El usuario detectó confusión entre capturas de Pulse y Surge (“estas confundiendo capturas con pulse y surge”). Mantener ambos mezclados contamina la validación visual y rompe la regla de auditoría futura.

**Hipótesis:** Un repo con artefactos de dos juegos impide que una IA futura entienda qué estamos construyendo y bajo qué criterios evaluarlo. Separar deja el repo canónico limpio.

**Resultado:** `capturas/` ahora contiene solo imágenes de Pulse Dam (`01-ready` … `10-tests`), con prefijos distintos a Surge. `INFORME_SHIELD_SURGE.md` queda como archivo histórico, no como doc canónica.

**Decisión:** Mantener. No borrar `INFORME_SHIELD_SURGE.md` por trazabilidad, pero excluirlo de `README` principal.

---

## 2026-08-30 — Definición mecánica HOLD = CONTENER / RELEASE = LIBERAR

**Cambio:** Compuerta cerrada mientras `isHolding===true`, abierta al soltar. Presión `0..100` basada en `holdTime / maxHold (3400ms)`. `gateClosed` es instantáneo, sin animación bloqueante.

**Motivo:** Cumplir `SMALL INPUT → LARGE CONSEQUENCE` y `ACTIVE ANTICIPATION`. El jugador debe decidir *cuándo* soltar, no solo reaccionar.

**Hipótesis:** Si la presión sube solo mientras se mantiene, y el riesgo (grietas, fugas, vibración) crece con el tiempo, aparecerá la decisión “¿aguanto un poco más?”.

**Resultado:** En pruebas con `tick` simulado: `p1 4.7%` tras 160ms de hold, decae a `0` tras soltar (test 1 PASS). La respuesta es inmediata (1 frame).

**Decisión:** Mantener. `maxHold 3400ms` deja ventana de riesgo `2100–3400ms`.

---

## 2026-08-30 — Presión visual y riesgo escalonado

**Cambio:** Tres umbrales: `crackAt 1350ms (42%)`, `leakAt 2100ms (62%)`, `dangerAt 2550ms (75%)`, `overload 3400ms (100%)`. Visuales: grietas en compuerta, partículas de fuga, barra `danger/overload` pulsante, vibración `shakeCharge→shakeDanger`, tinte de masa `azul→amarillo→rojo`.

**Motivo:** Evitar “barra de progreso” pasiva. Debe sentirse *“estoy aguantando demasiado”*.

**Hipótesis:** Señales múltiples (color, grietas, shake, sonido) hacen la tensión comprensible sin texto.

**Resultado:** Captura `03-tension` muestra `87%` con `¡CRÍTICO!`, grietas y `flash` rojizo. Test 3 `RIESGO presión 99.3%` PASS.

**Decisión:** Mantener umbrales. Ajustables si testers lo sienten demasiado fácil/difícil.

---

## 2026-08-30 — Masa simulada sin motor pesado

**Cambio:** `balls` con `gravity 980`, `drag 0.08`, colisiones `pared / compuerta / suelo / bloques` + colisión `ball-ball` aproximada solo en reservorio (O(n²) limitado a `y < GATE_Y`). `spawnInterval 84ms`, `max 150`, `radius ~7`.

**Motivo:** Prioridad `SENSACIÓN > PRECISIÓN FÍSICA`. Un motor rígido pesado complica iteración y performance móvil.

**Hipótesis:** Una aproximación barata pero con apilamiento creíble basta para que la liberación se sienta causal.

**Resultado:** Test 2 `CONTENCION reservoir 11` PASS (masa se acumula). Test 5 `PAYOFF destrucción 23` PASS (masa cae y destruye). Performance `particles 180/180 balls 180` PASS a 60fps.

**Decisión:** Mantener. No usar Matter.js/Box2D en MVP.

---

## 2026-08-30 — Release con impulso proporcional a presión

**Cambio:** Al liberar, cada ball en reservorio recibe `vy = baseVy 320 + peakPressure*8.8` más `spread` horizontal `±110* pNorm`. Si `pNorm <0.6` → `PULSO DÉBIL`, `0.6–0.84` → `BUEN PULSO`, `0.84–97` → `CRÍTICO/PERFECTO` con `hitStop` y `shakeImpact`.

**Motivo:** `SMALL INPUT → LARGE CONSEQUENCE` debe ser proporcional y visible. Más presión = más velocidad = más bloques.

**Hipótesis:** Un factor lineal `+8.8 por %` da diferencia clara entre `34%` y `87%` sin volverse caótico.

**Resultado:** Test 4 `RELEASE boost vyBefore -1.6 → 894` PASS. En gameplay, `86%` genera avalancha que llena ~50% de pantalla y derriba `≥9` bloques.

**Decisión:** Mantener. Tuning posible: `pressureMul 8.8` ajustable ±1.5.

---

## 2026-08-30 — Fort destructible y payoff jerárquico

**Cambio:** Fort de `25` bloques (`7+6+5+6+1 flag`). `hp 2` en base, `1` arriba. `perBlock 42` pts, `pressureBonus 0.95×peak`, `riskBonus 125` si `78–97%`, `overloadPenalty -85`. Jerarquía: `CASI NADA < LIGERO < BUENO < DEVASTADOR < MASIVO`.

**Motivo:** El payoff debe ser *claramente mayor que el input* y comunicar causalidad (masa → impacto → colapso).

**Hipótesis:** Un fort piramidal con flag arriba da foco y permite escalada: golpe débil derriba 2–3, perfecto 14+, crítico 23/25.

**Resultado:** Test 5 `destruidos 23/25` PASS con presión 92. Captura `05-impact` muestra colapso y partículas doradas.

**Decisión:** Mantener. No añadir docenas de niveles antes de validar que este fort ya provoca “otra”.

---

## 2026-08-30 — Overload como falla por avaricia, no por arbitrariedad

**Cambio:** Si `pressure ≥100` mientras se mantiene, `triggerOverload()` automático: compuerta cede con impulso débil `0.42×`, `shakeOverload`, `flash rojo`, feedback `¡SOBRECARGA!`, score penalizado.

**Motivo:** Test 9 `FRUSTRACIÓN`: el fracaso debe sentirse causado por decisión del jugador, no por RNG.

**Hipótesis:** Un límite claro y castigo suave (no muerte brusca) enseña a liberar antes del tope y evita explotar la espera infinita.

**Resultado:** Test 6 `OVERLOAD auto isOverload true` PASS. En partida real, aguantar `3.4s` rompe débil y deja `6-result` con `OVERLOAD`.

**Decisión:** Mantener.

---

## 2026-08-30 — Game juice progresivo

**Cambio:** Primero `contención+release+impacto` funcionales; luego `partículas 180 cap, shake, hitStop (32/58/78), flash, trails, water ripple, cracks, audio Web Audio`.

**Motivo:** Principio `JUICE COMO AMPLIFICADOR, NO SALVAVIDAS`. Jerarquía `NORMAL < BUENO < PERFECTO < MASIVO`.

**Hipótesis:** Si el core es divertido con círculos y rectángulos, el juice lo amplificará; si no, el juice no oculta el aburrimiento.

**Resultado:** Pregunta definitiva “¿círculos y rectángulos siguen siendo divertidos?” → Sí, por la decisión de riesgo. Juice añade sin ocultar.

**Decisión:** Mantener jerarquía. No saturar todo al máximo.

---

## 2026-08-30 — Test harness corregido (RESIZE)

**Cambio:** Test 8 `RESIZE` fallaba porque asignar `W=960` y llamar `resize()` sobrescribe con `window.innerWidth`. Cambiado a verificación de `DAM_W ≈ clamp(W*0.40)` y `CX≈W/2` más mock determinista.

**Motivo:** Un test rojo por lógica de test, no por bug de juego, contamina la validación y confunde capturas `pulse` vs `surge`.

**Hipótesis:** Un test que valida la fórmula de layout, no una simulación de resize imposible en headless, es más robusto.

**Resultado:** `Total 10/10 PASSED` (antes 9/10). Captura `10-tests.png` ahora PASS completa.

**Decisión:** Mantener nueva lógica de test.

---

## 2026-08-30 — Validación visual con capturas Pulse

**Cambio:** Generadas `capturas/01-ready … 10-tests` para Pulse Dam con `chromium --headless --virtual-time-budget=3500 --window-size=...`.

**Motivo:** Parte 12 del prompt maestro exige capturas A–G para verificar comprensión, contención, tensión, release, impacto, result y retry.

**Hipótesis:** Si las capturas muestran compuerta, masa acumulada, presión 34%→87%, avalancha y colapso, la causalidad es clara.

**Resultado:** 7 estados + mobile + hires + tests generados y verificados vía `dump-dom`. No se mezclan con Surge.

**Decisión:** Mantener proceso de captura para futuras iteraciones.

---

## 2026-08-30 — Auditoría 1854 líneas + Skinless Test + Separación TECHNICAL/GAMEPLAY

**Cambio:** Auditoría de `game.js 1862 líneas`, implementación de `DEBUG_SKINLESS` (`?skinless=1`), y corrección de semáforo `TECHNICAL: PASS / GAMEPLAY: PROMISING / PRODUCT: NOT VALIDATED`. Actualizados `README.md` y `PROJECT_RULES.md`.

**Motivo:** Feedback de diseño/producto (revisión externa) señaló tres riesgos: (1) 1854 líneas pueden ocultar “construir alrededor del juego” si son reglas/excepciones; (2) afirmar “sin arte sigue siendo divertido” sin prueba; (3) `10/10 PASSED` confundía técnico con diversión.

**Hipótesis:**

- Desglose por secciones (CONFIG 14% / UPDATE core 37% / RENDER 26% / INPUT+audio+harness 23%) demostrará que el peso es estado/render/helpers, no sistemas de tuning excesivos.
- Un `?skinless=1` que deja solo círculos, rectángulos, fondo plano, sin partículas/audio/shake, es la prueba falsable de si la decisión `aguantar/soltar` vale sin juice.
- Separar `TECHNICAL PASS` (automatizable) de `GAMEPLAY PASS` (requiere humano) evita declarar victoria prematura y bloquea *feature creep*.

**Resultado:**

- Auditoría realizada: 685 líneas UPDATE (core), 477 RENDER, 430 harness/input/audio. No hay tienda/economía/loot. Riesgo contenido.
- `DEBUG_SKINLESS` implementado: `has('skinless')` → fondo `#0a0e1e`, paredes `#2a344a`, bolas `#e0f0ff` (o amarillo/rojo según presión), sin `spawnParticle` ni `beep`, `render` early-return.
- Capturas `skinless-tension` verificadas vía `?capture=tension&skinless=1` con `chromium --virtual-time-budget=3500`.
- `README.md` ahora muestra banner rojo `NO ESTÁ VALIDADO COMO PRODUCTO` + semáforo 🟢/🟡/⚪ + checklist cualitativo (1ª/3ª/5ª muerte) y rechaza “15 reintentos” como criterio.
- `PROJECT_RULES.md` v1.1 añade §10 con distinción `TECHNICAL/GAMEPLAY/PRODUCT` y Skinless Test obligatorio para futuras auditorías.

**Decisión:** Mantener. No agregar features hasta completar playtest humano con checklist de 6 preguntas + 3 observaciones cualitativas. Próximo paso: probar `?skinless=1` con 5 jugadores y registrar si aparece `¿vuelvo? / ¿experimento? / ¿mejoro decisión?`.

---

*Próximas entradas deben seguir el mismo formato y referenciar test irrefutable afectado.*
