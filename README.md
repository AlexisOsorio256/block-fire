<div align="center">

# 🔥 BLOCKFIRE

**FPS arcade Three.js — navegador y Android WebView.**

Entras. Te mueves. Disparas. Matas. Mueres. Repites.
Duelo de Escuadras 4v4 por rondas o Todos contra Todos a 20 kills.

</div>

## Estado y arquitectura

El runtime actual usa Three.js/WebGL y una sola ruta de juego para navegador y
Android. Capacitor (android/) es el empaquetado Android canónico; la WebView
mínima de tools/webview/ es una vía de smoke/debug. La dirección visual es
estilizada, colorida, legible y rápida; la geometría primitiva solo es
fallback técnico cuando un asset no está disponible.

| Área | Dueño |
|---|---|
| Arranque y gates | src/main.js |
| Partida, rondas, daño y espectador | src/core/Game.js, src/core/MatchSquad.js |
| Input y configuración táctil | src/core/Input.js, src/core/ControlLayout.js |
| Movimiento y cámara | src/player/PlayerController.js |
| Armas y hitscan | src/combat/WeaponSystem.js |
| Bots y navegación | src/bots/Bot.js, src/bots/Navigation.js |
| Mundo y decoración | src/world/Map.js, src/world/MapDecor.js |
| HUD y lobby | src/ui/HUD.js, src/ui/Lobby.js |
| Audio y VFX | src/audio/AudioManager.js, src/fx/ |
| Personaje | src/characters/SoldierAvatar.js |
| Suite DEV | src/testing/suite.js |

## Comandos

~~~bash
# servidor con lifecycle y PID controlado
bash tools/start-server.sh
# también: bash tools/start-server.sh --bg
# detener una instancia propia: bash tools/start-server.sh --stop

# build web de producción, con BUILD_ID y sin harness DEV
bash tools/build-web.sh

# Capacitor: vía Android canónica
bash tools/build-web.sh
npx cap sync android
(cd android && ./gradlew assembleDebug)
~~~

La suite se abre en http://127.0.0.1:8931/?runTests=1. Para WebGL headless se
requiere una implementación de software, por ejemplo
--enable-unsafe-swiftshader --use-angle=swiftshader.

## Plataforma y controles

BLOCKFIRE es horizontal en todas las pantallas. En táctil, portrait muestra
una compuerta de giro antes del flujo jugable; la actividad Android declara
landscape y el navegador intenta bloquearlo al entrar en fullscreen.

| Acción | PC | Móvil |
|---|---|---|
| Mover | WASD | Joystick izquierdo |
| Correr | Shift | CORRER o joystick a tope |
| Mirar | Ratón | Arrastre derecho o arrastre de FUEGO |
| Disparar | Click izquierdo | FUEGO, mantenido y arrastrable |
| Apuntar | Click derecho | MIRA, toque con segundo FUEGO |
| Agacharse | C | AGACHAR |
| Saltar / recargar | Espacio / R | Botones |
| Cambiar arma | 1–4, Q/E | ARMA |

El layout táctil se puede mover, redimensionar y hacer más transparente desde
CONFIGURACIÓN → EDITAR CONTROLES. window.__BLOCKFIRE__.getDiagnostics() está
disponible en DEV y devuelve el estado de render y plataforma.

## Producto disponible

- Duelo de Escuadras 4v4, primero a cuatro rondas, con fase de compra,
  inmunidad de spawn y sin respawn durante la ronda.
- FFA de ocho combatientes, respawn y objetivo de 20 kills.
- Soldado GLB animado cuando carga, con siete operadores, colores de equipo,
  equipo modular, locomoción y feedback de disparo/impacto/muerte.
- Rifle, pistola, escopeta y SMG con modelos Kenney, fallback técnico,
  retroceso, ADS, recarga, cambio de arma, trazadoras e impactos.
- Audio con samples atribuidos y fallback procedural; el SMG tiene identidad
  sonora separada.
- Bots con percepción, navegación, roles y distancia táctica por arma.
- Mapa 120×120 con colliders estructurales y decoración separadas.
- Lobby de estudio, tienda de ronda, skins cosméticas locales, HUD, números de
  daño, feedback direccional y espectador de aliados.

La suite DEV protege contratos de juego; no se usa como sustituto de una
comprobación física en Android.

## Licencias

Consulta CREDITS.md. Los disparos gshot_*.ogg son CC-BY 3.0 de Jesús Lastra y
los modelos de armas Kenney están documentados junto a sus assets. Esta
entrega no añade assets externos nuevos.
