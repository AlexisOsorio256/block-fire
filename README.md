<div align="center">

# 🔥 BLOCKFIRE

**FPS arcade three.js — en PC (navegador) y Android (WebView nativa).**

Entras. Te mueves. Disparas. Matas. Mueres. Repites.
Duelo de Escuadras 4v4 por rondas — o Todos contra Todos a 20 kills.

## 🏗️ Arquitectura (una responsabilidad por sistema)

| Capa | Qué es | Dueño |
|---|---|---|
| `src/` | **BLOCKFIRE RUNTIME** — mini-motor propio con contratos claros (una responsabilidad por sistema, una sola ruta de daño, sin magia) | IA |
| `index.html` + `style.css` | Presentación y HUD | IA |
| `tools/webview/` + `tools/build-web.sh` | Empaquetado Android (una de las DOS vías, ver §Android) | IA |
| `android/` | Capacitor (la OTRA vía Android: plugins, storage persistente, ads futuros) | IA |
| `assets/` | Samples de audio + texturas + modelos (licencias en [`CREDITS.md`](CREDITS.md)) | IA |
| `docs/migration/` | ❌ NO EXISTE — mención retirada (fue de la era Godot, ya descartado) | — |

**Decisión de motor** (probada en Galaxy S22 con capturas y logs): Three.js itera ~5×
más rápido con IA y con 0 regresiones de escena vs. engine completo. Godot fue
descartado y retirado del repo.

### Comandos

```bash
# web en local
python3 -m http.server 8931        # → http://localhost:8931  |  ?runTests=1 (tests)
# empaquetar web
bash tools/build-web.sh            # → www/ (generado, no se versiona)
# APK vía 2 — webview mínima sin gradle (aapt2+d8+apksigner)
cd tools/webview && bash build.sh  # → builds/blockfire-webview.apk (generado)
# APK vía 1 — Capacitor (producción)
bash tools/build-web.sh && npx cap sync android && cd android && ./gradlew assembleDebug
```

## 📱 Estrategia Android — CONTRADICCIÓN ABIERTA, no decidida

Existen **dos vías vivas** y ninguna eliminada:

1. **Capacitor** (`android/`, vía gradle): plugins, storage persistente, camino
   a ads futuros. Es la que el `package.json` declara (`@capacitor/*`).
2. **WebView mínima sin gradle** (`tools/webview/build.sh`): aapt2+d8+apksigner,
   APK de prueba rápida sin toolchain completo.

3. **TWA/PWA** (recomendada en este README antiguamente): APK mínima que abre
   la URL en Chrome; NO está implementada y no hay decisión humana que la
   elija. No se declara plan canónico.

El humano debe elegir UNA antes de la primera release. Hasta entonces ambas
conviven y ninguna se borra.

</div>

---

## 📱 REGLA PERMANENTE: HORIZONTAL

**BLOCKFIRE se juega EN HORIZONTAL — PC y Android, en TODAS las pantallas
(lobby, partida, configuración, todo).** No existe una versión vertical y el
gameplay no se adapta a portrait.

En móvil: si abres en vertical, un aviso a pantalla completa te pide girar el
dispositivo **antes** de tocar nada del juego. Al pulsar JUGAR, el juego pide
pantalla completa + bloqueo landscape (cuando el navegador lo permite).

## 🎮 Cómo se juega

| Acción | PC | Móvil |
|---|---|---|
| Mover | WASD | Joystick izquierdo (curva precisa) |
| Correr | Shift | Botón **CORRER** (fija) o joystick a tope |
| Mirar | Ratón | Deslizar en la mitad derecha — o arrastrar **FUEGO** |
| Disparar | Click izq | **FUEGO** (mantener) · arrástralo para apuntar mientras disparas |
| Apuntar (ADS) | Click der | **MIRA** un toque = fija; aparece **2º FUEGO** a la izquierda |
| Agacharse | C | Botón **COGER** (más preciso, más lento) |
| Saltar / Recargar | Espacio / R | Botones |
| Cambiar arma | 1-2-3-4 · Q/E cicla | Botón **ARMA** cicla |
| Abrir tienda | B (solo en fase de compra) | **ARSENAL** |
| Ajustes en partida | — | Botón ⚙ (arriba-izquierda) |
| Abandonar partida | Botón **ABANDONAR** | Botón **ABANDONAR** |

- **Multitouch real**: mueve y mira a la vez; dispara con un dedo y mira con
  otro; nada se pisa ni queda pegado.
- **Asistencia de apuntado** activa en móvil: si apuntas cerca del pecho, la
  bala ayuda — pero todavía tienes que rastrear al enemigo.
- **125 de vida**: los duelos duran lo justo. La cobertura es real.

## ⚙️ Configuración (⚙ en partida, o CONFIGURACIÓN en el lobby)

- Sensibilidad de cámara (0.3×–2×) y sensibilidad ADS (0.3×–1×)
- **EDITAR CONTROLES**: arrastra cada botón y suéltalo donde quieras
- Tamaño y opacidad de los controles
- RESTAURAR vuelve todo por defecto. Se guarda en el dispositivo (localStorage).

## 🖼️ Así se ve

| Lobby | Partida |
|---|---|
| ![Lobby](capturas/01-lobby.png) | ![Partida](capturas/05-gameplay-post-polish.png) |

| Móvil horizontal |
|---|
| ![Landscape](capturas/06-mobile-landscape.png) |

## ✨ Qué tiene (estado actual)

- **DUELO DE ESCUADRAS (Clash Squad)**: 4v4 por rondas BO7 (primero a 4), fase
  de COMPRA antes de cada ronda con oro ficticio, inmunidad de spawn que se
  rompe al disparar, sin respawn en ronda (estilo Free Fire)
- **TODOS CONTRA TODOS (FFA)**: 8 jugadores, respawns, 20 kills gana
- 7 bots con outfits blocky propios (7 skins/siluetas distintas) que usan el
  GLB de soldado animado si carga (fallback blocky automático)
- 4 armas (rifle, pistola, escopeta, SMG) con modelos blocky, siluetas y
  sonidos propios (rifle mecánico, pistola seca, escopeta pesada, SMG rápida),
  retroceso, recarga y cambio animados
- **Trazadoras** en cada disparo (los tuyos y los de los bots) + impactos
  diferenciados pared/enemigo + sangre
- Disparos reales grabados (Jesús Lastra CC-BY 3.0, ver `CREDITS.md`) +
  confirmaciones de combate diseñadas para el género
- **Multitouch estilo FPS móvil**: fuego arrastrable, ADS por toque con segundo
  fuego, agacharse, sprint fijo; sin estados táctiles pegados
- Landscape obligatorio en móvil con instrucción ANTES del gameplay
- Screen shake, vignette de daño, **indicador direccional de daño**, respawn en 2s
- Mapa 120×120 con texturas CC0: FFA con 6 casas; arena Clash Squad con bases
  espejo tintadas, centro y lanes
- 60 FPS de presupuesto en PC y móviles modestos (resolución adaptativa)
- Lobby con héroe 3D en pedestal, selector de modo y de skin de armas,
  estadísticas locales y panel de configuración

---

## 🛠️ Para desarrolladores / IAs

> **Las reglas del proyecto están en [`PROJECT_RULES.md`](PROJECT_RULES.md) — léelas antes de tocar código.**

Arquitectura (una responsabilidad por sistema):

```
src/main.js                    arranque puro: gates (landscape / tests / capturas)
src/core/Game.js               orquestador: loop, daño central y estado de partida
src/core/MatchSquad.js         flujo de rondas del Duelo de Escuadras (BO7)
src/core/Input.js              teclado/mouse/pointer táctil → acciones neutrales
src/core/Settings.js           preferencias del jugador (localStorage)
src/player/PlayerController.js movimiento, cámara, gravedad y respawn humano
src/combat/WeaponSystem.js     armas, hitscan, oclusión, aim assist y feedback
src/economy/Shop.js            tienda del Clash Squad (comprar/equipar)
src/fx/VfxSystem.js            efectos de combate (flash/impacto/trazadora/sangre)
src/bots/Bot.js                IA: wander → chase → attack + walk cycle
src/world/Map.js               geometría, spawns validados, colisión y raycast
src/ui/HUD.js                  HUD, kill feed, banners y daño direccional
src/ui/Lobby.js                escena 3D del lobby (héroe, pedestal, skins)
src/audio/AudioManager.js      samples (CC0/CC-BY) + fallback procedural
src/characters/SoldierAvatar.js  soldado GLB animado + fallback blocky
src/testing/suite.js           suite ?runTests=1 (todos en verde, obligatorio)
src/testing/capture.js         harness ?capture= (auditoría visual)
```

### Cómo ejecutar y probar

```bash
python3 -m http.server 8931        # desde la raíz del repo
# → http://localhost:8931          (el juego)
# → http://localhost:8931/?runTests=1   (suite de tests en pantalla)
```

En PC se puede probar el input táctil reduciendo la ventana a <900px de ancho.
Los tests también corren en headless:
`chromium --headless=new --enable-unsafe-swiftshader --dump-dom 'http://localhost:8931/?runTests=1'`
(WebGL por software: sin GPU headless el primer intento puede morir con
"Error creating WebGL context").
