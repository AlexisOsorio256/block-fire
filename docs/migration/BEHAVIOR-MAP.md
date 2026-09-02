# MAPA DE COMPORTAMIENTO — BLOCKFIRE (fase 1 de auditoría de migración)

> Propósito: documento de preservación. Describe el comportamiento REAL del
> juego (verificado en código y pruebas, no intenciones). Si algún día se
> migra la infraestructura (p. ej. a Unity), este documento define la
> equivalencia mínima que la nueva implementación debe cumplir ANTES de
> considerarse completa. Fuente de verdad del gameplay: el código citado.
> Última verificación: commit `7db1129`, 18/18 tests PASS.

## 1. Reglas de partida (invariantes de producto)

- Modo: FFA local, **8 entidades** (1 humano + 7 bots), 20 kills ganan.
- Timer de partida; al expirar gana el líder. Pantalla VICTORIA/DERROTA
  (DENTRO de `#overlay` — regresión histórica documentada, test 18).
- Vida del jugador: **125 HP**. Regeneración NO existe. Daño de bots: 10/rifle.
- Respawn del jugador: **2 s** (pendingRespawns en Game). Respawn de bots: 2 s.
- Spawns: puntos validados (`Map.spawns`), nunca dentro de geometría.
- Bots usan **las mismas reglas de daño/combate** que el jugador (regla 4 de
  PROJECT_RULES). Su IA: wander → chase → attack, ataque con cadencia propia,
  hitscan con dispersión, oclusión respetada (los bots no disparan a través
  de paredes).
- Fin de partida resetea TODO: entidades, munición, cooldowns, timers, VFX,
  HUD, input (`_releaseAll`), banners y audio.

## 2. Movimiento (PlayerController + Input)

| Parámetro | Valor | Nota |
|---|---|---|
| Altura de ojo | 1.65 m | 1.15 agachado (`crouchBlend` animado) |
| Velocidad de caminar | 7.2 m/s | verificada por test |
| Sprint | 8.6 m/s | Shift (PC) / botón CORRER o joystick a tope (móvil) |
| Aceleración / fricción | 58 / 46 | respuesta de giro verificada 1.79 en 0.25 s |
| Aceleración en aire | 26 | control aéreo reducido pero real |
| Gravedad | −22 m/s² | salto ~1.5 m |
| Agachado | ×0.55 velocidad, −15 % spread | funciona también en el aire (pies plantados) |
| Colisión | AABB propia contra `Map.boxes` + suelo y=0 | sin motor de físicas |
| Separación de entidades | 0.73 m mínimo jugador↔bot | test 10 |

- La cámara yaw/pitch es acumulativa; **0.0052 rad/px** en táctil × sensMul ×
  adsMul (settings). ADS multiplica ×0.6 por defecto.
- FOV: 75° base + **7°** de kick con velocidad (feel).
- Respawn del jugador teletransporta a spawn validado y limpia velocidad.

## 3. Combate (WeaponSystem)

Orden de resolución por disparo (invariante de PROJECT_RULES §4):
`intención → cadencia/munición → trayectoria → oclusión → impacto/daño →
feedback → muerte/score/respawn`.

| Arma | Cadencia | Daño cuerpo/cabeza | Munición | Recarga | Identidad |
|---|---|---|---|---|---|
| Rifle | automático, intervalo corto | 24 / 48 | 30 + 90 | 2.2 s | mecánico, 380 ms de sample |
| Pistola | semi | 30 / 60 | 12 + 36 | 1.6 s | seca, 255 ms |
| Escopeta | lenta, 8 perdigones | 8× / — | 6 + 24 | 2.8 s | pesada, 600 ms |

- **Hitscan**: raycast contra bots (esferas cuerpo/cabeza) Y contra
  `Map.boxes` (AABB). La cobertura bloquea balas siempre (mismo contrato
  espacial que el movimiento).
- Oclusión: el rayo más cercano gana (pared o cuerpo).
- **Aim assist solo en móvil**: si el rayo pasa cerca del pecho (radio
  generoso), la bala ayuda; el rastreo del objetivo sigue siendo del jugador.
- Agachado: −15 % de dispersión. ADS: dispersión reducida.
- Feedback por disparo: retroceso de cámara (recuperación), kick de arma
  (viewmodel), muzzle flash, **trazadora** (desde el cañón del viewmodel en
  el jugador; desde el arma del bot hacia su objetivo), sonido por arma.
- Feedback por impacto: en pared chip gris (0xb8c4d4) + `sfx_impact_wall`;
  en cuerpo chispas rojas + `sfx_hit`; headshot rojo vivo + `sfx_headshot`.
- Kill: **UN solo sonido** de confirmación (`sfx_kill` — dueño único:
  `Game.applyDamage`; WeaponSystem NO reproduce kill — bug del doble audio
  corregido) + banner `ELIMINADO +100 / HEADSHOT +150 / DOBLE BAJA +200 /
  RACHA xN` (recompensa explícita decidida por producto).
- Al recibir daño: vignette roja, indicador direccional de daño (ángulo
  respecto al yaw, test 14), `sfx_hurt`, screen shake proporcional.
- Muerte del jugador: `sfx_death`, cámara baja, respawn en 2 s.

## 4. Bots (Bot.js)

- 7 unidades activas, **7 outfits** (asalto, urbano, táctico, explorador,
  pesado, raider, nightops) con gear distinto (crest/hood/pads/pack/bulky),
  franja luminosa de ID en el pecho, visor emissive, variación de silueta.
  Sin colores de equipo (FFA) — eliminado `_getTeamColor`.
- Máquina de estados: wander (puntos aleatorios validados) → chase (línea de
  visión con raycast de mapa) → attack (cadencia + dispersión + oclusión).
- Walk cycle procedural; suena con volumen por distancia (listener en el
  jugador) — test 12.
- Los bots pueden disparar mientras el jugador recarga (test 11).
- Muerte: ragdoll NO existe; caída simple + score + respawn 2 s
  (pendingRespawns).

## 5. Mapa (Map.js)

- 96×96 m, geometría blocky: suelos, muros, cajas de cobertura, plataformas
  (55 BoxGeometry + 4 esferas aprox). Texturas CC0 (ground/wall/cover/
  platform), anisotropía 8.
- Contrato espacial único: `Map.boxes` (AABBs) alimenta movimiento, balas y
  línea de visión de bots. `Map.raycast(origin, dir, maxDist)` y
  `Map.checkCollision` son la única fuente de verdad.
- Raycast contra AABBs propio (no usa el Raycaster de Three para gameplay).

## 6. Input (core/Input.js) — el sistema más delicado

**PC**: WASD/flechas, Shift sprint, espacio salto, C agacharse, R recarga,
1-2-3 armas, Q/E cicla, click izq dispara, click der ADS, Escape/pausa.
**Móvil** (pointer < 900 px o PointerEvent táctil):
- Joystick izquierdo (zona 42 % × 45 %): movimiento con **curva expo 1.45**
  (preciso en el centro, veloz al borde); a tope = sprint.
- Zona derecha: cámara por arrastre, ownership por `pointerId` — el primer
  dedo en la zona posee la cámara hasta `pointerup/cancel`.
- **FUEGO**: mantener dispara; **arrastrar mientras se dispara gira la
  cámara** (acumulador `_fireLook` separado de `_touchLook`; se suman en
  `getLookDelta`). Hay un 2º FUEGO a la izquierda **solo con ADS activo**,
  colocado ENCIMA de la zona del joystick (no dentro).
- **MIRA: tap = fija/suelta (toggle, NO hold)** — el hold-to-aim capturaba el
  dedo con implicit pointer capture y bloqueaba cámara/movimiento (bug
  crítico corregido, test 15).
- CORRER (toggle), COGER (toggle), SALTO, RECARGA, ARMA, ⚙ (pausa + config).
- `_releaseAll()` en `pointercancel`/`blur`/`visibilitychange`: NINGÚN estado
  táctil queda pegado.
- Editor de HUD (⚙ → EDITAR CONTROLES): arrastre por botón con
  `setPointerCapture`, persistencia en localStorage (`bf_settings`),
  `clampBtnPos` con límites reales (bug de Math.max corregido), el fuego no
  dispara durante la edición, RESTAURAR vuelve a valores por defecto.

## 7. Audio (AudioManager)

- Manifest con cache-busting `?v=2` (JS cacheado viejo pedía archivos
  borrados → 404 → fallback genérico: causa raíz del bug de audio del
  usuario). Fallos de carga se registran en consola.
- Disparos reales grabados (Jesús Lastra, CC-BY 3.0): rifle/pistola/escopeta.
- Confirmaciones de combate sintetizadas por el proyecto: sfx_hit,
  sfx_headshot, sfx_kill (dueño único Game), sfx_kill_banner, sfx_hurt,
  sfx_impact_wall, sfx_death. Otros: jump, reload_start/end, respawn, steps,
  switch, ui, empty.
- Fallback procedural si falta un sample. Audio arranca con gesto de usuario
  (botón JUGAR) y se reanuda en `visibilitychange → visible`.
- Bots: disparos con volumen por distancia (listener = jugador).

## 8. HUD (ui/HUD.js)

- Vida, munición, marcador (kills/líder/timer), kill feed, banners (+100/
  +150/+200/xN con pop CSS), indicador direccional de daño (test 14),
  vignette de daño, pantalla de resultado (dentro de `#overlay`).
- Portrait en móvil: gate `#rotate-gate` a pantalla completa ANTES de tocar
  nada (regla permanente: HORIZONTAL en todo).

## 9. Persistencia y configuración (Settings.js)

- `bf_settings` en localStorage: sensibilidad cámara 0.3–2×, sensibilidad ADS
  0.3–1×, tamaño y opacidad de botones, posiciones por botón (btnPos).
- Panel accesible en el lobby Y en partida (⚙, pausa la simulación con
  `_configOpen`).

## 10. Rendimiento (presupuesto actual)

- DPR cap 1.75 en móvil + resolución adaptativa (downscale si FPS bajan,
  min 0.9). Anisotropía 8. Sin sombras dinámicas caras; luz direccional
  simple. Objetivo 60 FPS en PC y móviles modestos.
- Materiales compartidos donde se puede; VFX de vida corta (trazadoras 60 ms,
  flashes ~80 ms) creados por evento. Sin pooling formal (deuda conocida).
- Medido en headless SwiftShader: estable en 45 s de soak sin errores.
  **Android real: NO medido todavía** (sin dispositivo de pruebas usado).

## 11. Pruebas existentes (18/18 — `?runTests=1`, corren headless)

1 carga · 2 movimiento · 3 disparo · 4 bots · 5 colisión mapa · 6 HUD ·
7 combate+score · 8 fin de partida por bots · 9 ciclo de armas ·
10 separación entidades · 11 bots disparan en recarga · 12 volumen por
distancia · 13 sin teleport de respawn stale · 14 ángulos de daño
direccional · 15 ADS toggle · 16 crouch animado · 17 fire-drag ·
18 pantalla de resultado visible.

## 12. Trampas conocidas (no volver a introducirlas)

1. `result-block` debe vivir DENTRO de `#overlay` (el overlay fijo la tapa si
   está fuera).
2. El audio de kill tiene UN dueño: `Game.applyDamage`. WeaponSystem no
   reproduce 'kill'.
3. ADS es TOGGLE en móvil. Un hold-to-aim con capture mata la multitouch.
4. El acumulador de look del drag-fuego es separado del de la zona derecha;
   `getLookDelta` los suma. Liberar la zona de mira NO borra el drag-fuego.
5. `clampBtnPos` usa min/max en ambos ejes (no Math.max en Y).
6. En modo edición, `bindFire` debe salir temprano (no disparar al arrastrar).
7. Crouch planta los pies aunque esté en el aire (si no, el ojo flota con el
   collider quieto).
8. Al agacharse/saltar con el sistema de colisión propio: plantar pies ANTES
   de mover el ojo.
9. Cache-busting en el manifest de audio; los samples borrados provocan 404.
10. `bindFire` en modo edición y los handlers de pointer deben hacer
    `preventDefault` + stopPropagation solo cuando corresponde (no romper el
    editor de HUD).
11. Tests de movimiento parten de input limpio: limpiar `keys`/`input.move`
    entre tests (el test 16 lo aprendió a costa de un fallo).

## 13. Distribución actual

- Producto web estático (sin build): `python3 -m http.server` o cualquier
  hosting. Iteración = refrescar navegador (ms). Tests headless con chromium.
- Ruta Android documentada (NO implementada): PWA → TWA (bubblewrap, APK
  ~2 MB contenedor de Chrome, landscape forzado por manifest). Requiere:
  hosting HTTPS, manifest.json, service worker mínimo, JDK 17 + bubblewrap
  (NO instalados todavía), firma y `assetlinks.json`.
