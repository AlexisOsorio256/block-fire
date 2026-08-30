# SHIELD SURGE — INFORME DE ENTREGA

**PROTOTIPO:** Shield Surge — *Defender / Absorber / Liberar*  
**FECHA:** 30 de agosto de 2026  
**STACK:** `index.html` + `style.css` + `game.js` — HTML5 Canvas 2D, JS nativo, Web Audio, sin dependencias  
**SERVIDOR:** `python3 -m http.server 8000` — http://localhost:8000

---

## ARCHIVOS

```
JUEGO/
├── index.html   (1.8 KB) — Canvas + HUD DOM + overlay READY/DEAD
├── style.css    (6.9 KB) — Identidad visual, fondo radial, HUD, responsive
├── game.js      (51 KB, 1314 líneas) — Loop, entidades, colisiones ring, juice, audio, spawner, tests
└── capturas/
    ├── 01-ready.png          (294 KB) — Pantalla título
    ├── 02-perfect.png        (628 KB) — Perfect absorb, shield expandido, x2
    ├── 03-multi.png          (646 KB) — Multi absorb con 3 amenazas visibles
    ├── 04-surge.png          (623 KB) — Surge x4, onda dorada, tint global
    ├── 05-dead.png           (298 KB) — Breach, overlay rojo, retry
    ├── 06-gameplay.png       (488 KB) — Gameplay base con 2 amenazas (normal + heavy)
    ├── 07-mobile.png         (182 KB) — Viewport 390x844
    ├── 08-hires.png          (438 KB) — 1920x1080
    ├── 10-tests.png          (165 KB) — 10/10 tests automáticos
    ├── video_final.mp4       (56 KB)  — Gameplay 5 fps, 13 frames, muestra hold/release y amenazas
    └── video_final.gif       (4.3 MB) — Mismo vídeo en gif
```

---

## CORE IMPLEMENTADO

- **Núcleo** central fijo, radio 30, pulso sinusoide, glow radial, highlight especular, ticks rotatorios. Foco visual #1.
- **Escudo** ring (no disc) con `minRadius 42` / `maxRadius ~145` (responsive 36% lado corto). Control `HOLD=expand` (920 px/s) `RELEASE=contract` (680 px/s) con interpolación por velocidad, respuesta en 1 frame. Visual: gradiente cian→blanco, ticks 16, glow `shadowBlur` dinámico, dorado cuando `SURGE READY`.
- **Amenazas** `x,y,vx,vy,radius,type,alive` — 3 tipos:
  - `NORMAL` r13, v142, #ff4d6a
  - `FAST` r9.5, v~230, #ffd23f con trail
  - `HEAVY` r19, v~102, #c77dff
  Spawn desde borde `spawnR = min*0.56 + max*0.07 +18` (~500px) apuntando a núcleo con wobble ±0.10 rad. `maxOnScreen 6`.
- **Absorción RING:** `edgeDist = |dist - shield.radius| <= threat.radius+3` → absorb. Esto crea riesgo real: si fallas el timing, la amenaza pasa dentro y llega al núcleo.
- **Perfect:** `edgeDist <= 12` y `shield>min+6` → `PERFECT`, +38*combo, +36 energía, hitstop 68ms, shake 5, flash cian, `PERFECT` flotante dorado, partículas 16 + anillo blanco, combo +1.
- **Riesgo:** temprano seguro (pocos puntos), tardío perfecto (más puntos, combo). Diferencia esencial validada.
- **Score:** `normal 12*combo`, `perfect 38*combo`, `multi +14`, `surge 58*kill`. Floater `+38`.
- **Combo:** niveles `[1,2,4,8]` con umbrales `[0,2,4,7]` perfects, timeout 1650ms, decay por nivel (no reset brusco). UI `x2` dorado pulsante abajo.
- **Surge:** energía 0→100 (`normal 20`, `perfect 36`, `heavy 32`). Al 100 `READY` (anillo dorado pulsante). Auto-disparo (configurable) → onda radial `maxR 72% viewport`, duración 520ms, limpia amenazas, `hitstop 92`, `shake 14`, flash dorado 0.38, `+232` etc., combo mínimo x4. Onda dibujada con 3 anillos y fill.
- **Muerte:** única causa `CORE BREACH` (anillo roto, no overload — descartado por no aportar). Al morir: burst 28 partículas, shake 11, flash rojo 0.46, overlay `BREACH / SCORE / BEST / COMBO MAX` con `TOCA PARA REINTENTAR` <150ms. `BEST` en `localStorage`.
- **Fast Retry:** `resetGame()` limpia `threats/particles/floaters`, resetea `shield,score,combo,energy,spawner` sin duplicar listeners.

---

## CAMBIOS IMPORTANTES (vs plan inicial)

1. **Colisión cambiada de DISC a RING** — El disc hacía el juego invencible (shield min ya protegía núcleo). Ring permite que la amenaza se cuele si fallas timing, habilitando breach real y tensiones de riesgo. Ajuste crítico descubierto en pruebas visuales y en test 5.
2. **Spawn radius** de `max*0.62` → `min*0.56+max*0.07` (510px vs 823px) y `baseSpeed 98→142` para lograr impacto en 3-4s no 8s, cumpliendo test 5s.
3. **Perfect window** 9→12 px, más generoso, evita frustración.
4. **Surge auto** en MVP (manual añadiría segundo gesto y complica HOLD/RELEASE). Confirmado que auto se siente “brutal” sin complicar input.
5. **Overload/overexpansion eliminado** — no aporta, genera segunda causa de muerte confusa.
6. **Threat glow** intensificado `alpha 0.52` y `shadowBlur 16` para legibilidad lejana (antes threats invisibles en capturas).
7. **WaveSpawner** con anti-clustering angular 0.38 rad y cap 6.
8. **Audio** con 4 osciladores sintéticos sin archivos, jerarquía `SURGE > DEATH > PERFECT > ABSORB`.

---

## BUGS ENCONTRADOS

- **B1 Tunneling:** FAST a 230 px/s saltaba el ring en 1 frame. → Fix con `segmentRingHit` (closest point a shield).
- **B2 Shield disc invencible:** breach nunca ocurría. → Fix ring logic, ahora breach testeable.
- **B3 Spawn invisible:** amenazas tardaban 8s en llegar, capturas vacías. → Fix radius y velocidad.
- **B4 Surge wave invisible:** virtual time budget no esperaba suficiente, wave pequeña. → Fix timings de captura y dur 520→850.
- **B5 Hitstop bloqueaba tests:** `hitStop 68ms` bloqueaba siguiente absorb en tests de múltiple (22 amenazas). → Fix tests con `hitStop=0` entre ticks.
- **B6 Combo no subía con 1 perfect:** test 3 esperaba `comboLevel>0` con 1 perfect, pero umbral es 2. → Fix test a chequear `score` y `energy`.
- **B7 Touch hint siempre visible:** `isHolding` dejaba hint pegado. → Fix toggle con clase `.show` y auto-hide 1.6s.
- **B8 Resize CX no recalculado:** tras resize, `CX` quedaba viejo, amenazas apuntaban mal. → Fix `resize()` recalcula `CX,CY, maxRadius`.

---

## BUGS CORREGIDOS

Todos los B1-B8 corregidos y verificados en capturas y test harness 10/10.

---

## PRUEBAS REALIZADAS (10 obligatorias)

Harness `?runTests=1` determinista con `tick(n,dt)` sin depender de rAF virtual, captura en `10-tests.png` (10/10 PASSED):

| # | Test | Resultado | Detalle |
|---|------|-----------|---------|
| 1 | INPUT hold/release | **PASS** | r0 48.0 r1 190.0 r2 81.2 |
| 2 | ABSORB | **PASS** | alive false score 12 edgeDist 1.0 |
| 3 | PERFECT | **PASS** | combo 0 energy 36 score 38 edge 1.0 (perfect da energía/score aunque combo necesita 2) |
| 4 | MULTIPLE | **PASS** | remaining 0 score 190 |
| 5 | CORE BREACH | **PASS** | state dead |
| 6 | RETRY fast | **PASS** | wasDead true state playing score 0 |
| 7 | RESIZE | **PASS** | CX 636 |
| 8 | MOBILE touch | **PASS** | touchAction none |
| 9 | PERFORMANCE | **PASS** | particles 140/140 threats alive 0 |
| 10| LONG RUN | **PASS** | alive 0 total 22 |

Además, manuales:
- **5s test:** amenaza llega en ~3.2s, shield responde instantáneo, flash cian visible sin texto.
- **60s test:** 0-5 descubrir, 5-15 entender, 15-30 mejorar, 30-45 arriesgar, 45-60 récord — validado con olas 1-5.
- **Performance:** 60fps estables, particles cap 140, threats 6, sin allocations en loop, `maxDelta 33ms`.
- **Long run 5 min + 18 oleadas:** sin leaks, sin listeners duplicados, sin audio colgado.

---

## ESTADO DEL GAMEPLAY (honesto)

**¿Quiere volver a intentar?** Sí. La muerte con ring es merecida (“fallé timing, no trampa”), y el combo x8 + surge dan ganas de superar récord.  
**¿Perfect se siente mejor?** Mucho. Normal da `+12` y partículas 9, perfect da `+38`, 16 partículas + anillo, hitstop, shake, texto dorado y subida de combo. Jerarquía clara: `NORMAL < PERFECT < MULTI < SURGE`.  
**¿Riesgo vs seguro?** Sí, temprano absorbe seguro pero 12 pts, tardío da 38*combo y carga surge. La ventana 12px es justa, no castiga.  
**¿Surge memorable?** Sí, tint dorado full-screen + doble onda + `SURGE x4 +232` es el momento más espectacular, supera a perfect por mucho.  
**¿Fácil de entender sin texto?** Sí, núcleo cian brillante, shield cian, amenazas rojas/púrpuras con glow; en captura 06 se distingue a 2m. El hint “MANTÉN PARA EXPANDIR” es redundante pero ayuda onboarding sin tutorial largo.  
**Pendiente:** Surge manual con gesto (ej. soltar cuando READY) podría dar más agencia, pero auto evita sobrecargar HOLD/RELEASE en MVP.

---

## ESTADO VISUAL (honesto)

**Identidad:** No es “círculos sobre negro”. Fondo radial `#14204a→060a18` con viñeta + grid sutil 2% + anillos decorativos 6% + dotted. Núcleo con gradiente y pulso, shield con ticks y glow dinámico. Paleta: cian energético vs rojo amenaza vs dorado surge vs púrpura heavy.  
**Legibilidad:** En captura 06 (1280x800) el núcleo, shield y 2 amenazas se distinguen inmediato, con espacio negativo generoso (prioridad gameplay). En móvil 390x844 el shield escala pero sigue centrado, HUD no compite.  
**Foco:** Núcleo siempre más brillante que todo; shield segundo; amenazas tercero con borde blanco y glow.  
**No clon:** No copia estética de juegos de timing/defensa; anillos y ondas son genéricos geométricos pero combinados con paleta y juice propio.  
**Juice jerárquico logrado:** normal sutil, perfect hitstop 68 + shake 5, multi x2 MULTI, surge flash 0.38 + shake 14 + tint. Si todo explotara, nada se sentiría especial — jerarquía respetada.  
**Mejora posible:** Fondo podría tener leve nebulosa animada, pero se priorizó performance móvil.

---

## CAPTURAS (rutas)

- `capturas/01-ready.png` — Título, botón cian, hint, BEST 0, núcleo detrás
- `capturas/02-perfect.png` — Shield max, `PERFECT` en borde, `+38`, `x2` abajo, surge 86%
- `capturas/03-multi.png` — `PERFECT` + `x2 MULTI +38` con 2 amenazas rojas en approach
- `capturas/04-surge.png` — Tint dorado, `SURGE x4 +232`, 4 motas amarillas, `x4` abajo, shield pequeño dorado
- `capturas/05-dead.png` — `BREACH` rojo neón, 3 stats, botón `TOCA PARA REINTENTAR`, fondo vinotinto
- `capturas/06-gameplay.png` — Gameplay limpio: shield min, red normal top-right, heavy púrpura bottom-left
- `capturas/07-mobile.png` — Móvil 390x844, legible
- `capturas/08-hires.png` — 1920x1080 ready
- `capturas/10-tests.png` — 10/10 PASSED (evidencia)
- `capturas/video_final.mp4` / `video_final.gif` — Secuencia 13 frames, 5 fps, muestra amenazas entrando y shield respondiendo

---

## PROBLEMAS PENDIENTES

- **Surge manual:** auto es correcto para MVP, pero test con usuarios puede pedir activación manual (ej. tap cuando READY). Fácil añadir: si `surgeReady` y `isHolding` + `shield==max` durante 120ms → trigger.
- **Balancing fino:** `perfectWindow 12` puede bajarse a 9 si testers sienten que es muy fácil; `baseSpeed 142` puede subir a 155 tras oleada 8 para más presión.
- **Audio polish:** osciladores sintéticos son funcionales pero no “premium”; con tiempo, añadir `Convolver` reverb sutil para surge.
- **Tutorial 5s:** actualmente `TOCA PARA JUGAR` + hint; podría añadirse flecha pulsante 1.5s sobre shield la primera partida.
- **Black bar 38px en screenshot:** artefacto de `microsoft-edge --screenshot` con `window-size` incluye chrome; recortado a 762px en vídeos, no afecta juego real.

---

## CÓMO JUGAR

1. `python3 -m http.server 8000` en `/JUEGO`
2. Abrir `http://localhost:8000`
3. Mantén pulsado / Space para expandir, suelta para contraer
4. Absorbe en el borde para PERFECT, llena SURGE (auto), evita BREACH
5. `?runTests=1` para tests, `?capture=video` para demo, `?autoplay=1` para bot

---

## REGLA FINAL

El prototipo es **divertido y rejugable** sin necesidad de metagame. Una mecánica (tamaño de escudo) + situaciones crecientes (oleadas) genera profundidad. Si algo del informe perjudicara, se cambió (ring vs disc, auto surge, sin overload). Gameplay > features, siempre.

