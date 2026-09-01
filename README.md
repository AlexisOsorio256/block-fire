<div align="center">

# 🔥 BLOCKFIRE

**FPS arcade 3D blocky — corre en tu navegador, gratis.**

Entras. Te mueves. Disparas. Matas. Mueres. Repites.
20 kills y ganas. Así de simple.

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
| Mover | WASD | Joystick izquierdo (a tope = **correr**) |
| Mirar | Ratón | Deslizar en la mitad derecha |
| Disparar | Click izq | Botón rojo |
| Apuntar (ADS) | Click der | Botón mira (sensibilidad reducida) |
| Saltar / Recargar | Espacio / R | Botones |
| Cambiar arma | 1-2-3 · Q/E cicla | Botón ⟳ cicla |

- **Elige tu arma en el lobby** (rifle, pistola o escopeta) antes de entrar.
- **Sprint**: Shift (PC) o joystick a tope (móvil). Apuntar cancela el sprint.
- **Asistencia de apuntado** activa en móvil: si apuntas cerca del pecho, la
  bala ayuda — pero todavía tienes que rastrear al enemigo.
- **125 de vida**: los duelos duran lo justo. La cobertura es real.
- **Multitouch real**: mueve con un dedo y mira con otro a la vez; disparar no
  bloquea la cámara. La cámara tiene indicador de dirección de daño.

## ⚙️ Configuración (lobby → CONFIGURACIÓN)

- Sensibilidad de cámara (0.3×–2×)
- Sensibilidad ADS (0.3×–1×)
- Tamaño y opacidad de los controles táctiles
- Se guarda en el dispositivo (localStorage). Sin cuentas, sin servidor.

## 🖼️ Así se ve

| Lobby | Partida |
|---|---|
| ![Lobby](capturas/01-lobby.png) | ![Partida](capturas/05-gameplay-post-polish.png) |

| Móvil horizontal |
|---|
| ![Landscape](capturas/06-mobile-landscape.png) |

## ✨ Qué tiene

- 8 jugadores FFA (tú + 7 bots con estilos visuales distintos y caminata propia)
- 3 armas con **modelos, siluetas y sonidos propios** (rifle mecánico, pistola
  seca, escopeta pesada), retroceso, recarga y cambio animados
- **Asistencia de apuntado** (más generosa en móvil) + 125 HP: duelos con duelo
- Disparos reales grabados (Jesús Lastra CC-BY 3.0) + impactos CC0 de Kenney
- **Multitouch**: mueve y mira a la vez; joystick a tope = sprint; sin estados
  táctiles pegados (pointer capture + liberación en cancel/blur)
- Landscape obligatorio en móvil con instrucción ANTES del gameplay
- Screen shake, vignette de daño, **indicador direccional de daño**, respawn en 2s
- Mapa 96×96 con texturas CC0, cobertura y plataformas; spawns validados
- 60 FPS de presupuesto en PC y móviles modestos (resolución adaptativa)
- Lobby con selector de arma, estadísticas locales y panel de configuración

---

## 🛠️ Para desarrolladores / IAs

> **Las reglas del proyecto están en [`PROJECT_RULES.md`](PROJECT_RULES.md) — léelas antes de tocar código.**

Arquitectura (una responsabilidad por sistema):

```
src/main.js                    arranque, landscape gate y smoke tests
src/core/Settings.js           preferencias del jugador (localStorage)
src/core/Game.js               escena, ciclo, partida, daño y VFX
src/core/Input.js              teclado/mouse/pointer táctil → acciones neutrales
src/player/PlayerController.js movimiento, cámara, gravedad y respawn humano
src/combat/WeaponSystem.js     armas, hitscan, oclusión, aim assist y feedback
src/bots/Bot.js                IA: wander → chase → attack + walk cycle
src/world/Map.js               geometría, spawns validados, colisión y raycast
src/ui/HUD.js                  HUD, kill feed, banners y daño direccional
src/audio/AudioManager.js      samples (CC0/CC-BY) + fallback procedural
```

### Cómo ejecutar y probar

```bash
python3 -m http.server 8931        # desde la raíz del repo
# → http://localhost:8931          (el juego)
# → http://localhost:8931/?runTests=1   (suite de tests en pantalla)
```

En PC se puede probar el input táctil reduciendo la ventana a <900px de ancho.
Los tests también corren en headless: `chromium --headless=new ... ?runTests=1`.

---

## 📱 Estrategia Android (investigación — NO implementada todavía)

**Recomendación: PWA instalada → y encima una TWA (Trusted Web Activity) como APK.**
Razón: BLOCKFIRE es un sitio estático sin build — el mismo hosting web sirve a
PC y a Android, y las actualizaciones llegan sin reconstruir la APK (la TWA es
solo un contenedor del Chrome del sistema).

| Opción | Veredicto | Por qué |
|---|---|---|
| **TWA (Bubblewrap)** | ✅ La viable | APK mínima (~2MB) sin código propio: abre tu URL en Chrome a pantalla completa con `orientation: landscape` forzado vía manifest. Actualizaciones = subir archivos al host. Requiere HTTPS + `assetlinks.json`. |
| PWA instalada | ✅ Paso previo | El mismo manifest (`display: fullscreen`, `orientation: landscape`) hace al juego instalable con landscape bloqueado por el SO, sin APK. Primera etapa natural. |
| WebView propio | ❌ No recomendado | Heredas ciclo de vida, latencia de input, audio y compat WebGL de la WebView del dispositivo sin beneficio real frente a TWA. |

Pasos futuros (cuando se apruebe): hosting HTTPS → `manifest.json` (nombre,
iconos, `display: fullscreen`, `orientation: landscape`, `theme_color`) → service
worker mínimo para cache/offline → `bubblewrap init --manifest` → APK firmada.
El juego web sigue siendo el producto principal; la APK no reescribe nada.
Audio necesita un gesto de usuario para arrancar (ya implementado: botón JUGAR).
