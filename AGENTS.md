# BLOCKFIRE — tarjeta operativa

Constitución: PROJECT_RULES.md. Hechos del producto: README.md. Atribuciones:
CREDITS.md. No se hacen commits ni pushes salvo petición explícita.

## Arranque

En este orden:

1. Leer PROJECT_RULES.md, README.md y el código dueño del comportamiento.
2. Ejecutar git status --short, git log --oneline -5 y git diff --stat.
3. Arrancar el servidor con bash tools/start-server.sh (o --bg/--stop); cada
   proceso iniciado debe cerrarse y verificarse al terminar.

Prioridades: estabilidad → gameplay → rendimiento → UX → inmersión →
features. Trabajar por frentes completos y mantener la suite existente.

## Dueños

| Área | Archivos principales |
|---|---|
| Presentación y HUD | index.html, style.css, src/ui/HUD.js |
| Arranque | src/main.js |
| Partida y daño | src/core/Game.js |
| Entrada táctil/PC | src/core/Input.js, src/core/ControlLayout.js |
| Armas | src/combat/WeaponSystem.js |
| Audio | src/audio/AudioManager.js |
| Personajes | src/characters/SoldierAvatar.js, src/bots/Bot.js |
| Mundo | src/world/Map.js, src/world/MapDecor.js |
| Suite DEV | src/testing/ |
| Android | android/ solo para el frente nativo; tools/webview/ solo smoke/debug |

Game.js, Input.js, style.css, index.html y HUD.js no tienen dos escritores
simultáneos. www/, builds/ y node_modules/ son generados.

## Verificación

Durante la iteración: pruebas dirigidas y chequeos de sintaxis/build. Al
cerrar: suite completa ?runTests=1 (el total lo dicta la suite actual),
consola sin errores propios, build de producción y comprobación de procesos.
El diagnóstico DEV vive en window.__BLOCKFIRE__.getDiagnostics(). Web
responsive sirve para iterar; Android físico es la autoridad de plataforma.
Lo no ejecutado se informa como SIN VERIFICAR.

Terminología de trabajo: HOTFIX, FRENTE COMPLETO y REFACTOR CAUSAL.
