# PROJECT RULES — BLOCKFIRE

Constitución estable del producto. `README.md` contiene los hechos
cambiantes; `CREDITS.md`, las atribuciones. Si hay duda, inspeccionar y
probar: no inventar.

## 1. Producto y prioridades

BLOCKFIRE es un TPS arcade estilizado, colorido, legible y rápido para
Android en orientación horizontal. El núcleo es moverse, apuntar, disparar,
impactar, matar, morir y repetir.

Prioridades inmutables: estabilidad → gameplay → rendimiento → UX → inmersión
→ features.

La presentación visual canónica es **tercera persona sobre el hombro**. No se
vuelve a primera persona, no se reintroducen brazos PSX y ningún documento
antiguo que diga "FPS" autoriza a revertir esa decisión.

La ruta canónica es Godot 4.7.2 Standard, GDScript y renderer Mobile. El
proyecto no debe volver a incorporar Unity, Three.js, WebGL como runtime,
PWA, WebView o Capacitor. Linux sirve para desarrollo y pruebas headless;
Android físico valida la plataforma.

## 2. Alcance e invariantes

El juego ofrece Duelo de Escuadras 4v4 por rondas y FFA de ocho combatientes.
La vida del jugador es 200 HP. La tienda usa monedas ficticias y las skins
son locales y cosméticas. No hay backend, cuentas, economía real,
multijugador online, anuncios, ranking, chat, clanes, vehículos, campaña,
loot ni matchmaking.

Un dueño y una fuente de verdad por concepto: input, daño, muerte, respawn,
HUD, audio, colisión, VFX, navegación y assets. `game/match/match.gd`
orquesta el estado de sesión; cada sistema posee su comportamiento. Hay como
máximo uno o dos autoloads y no se crea una colección de managers globales.

Todo disparo sigue intención → cadencia/munición → trayectoria → oclusión →
daño → feedback → muerte/score/respawn. Jugador y bots comparten colisión,
visión y daño. La asistencia móvil ayuda a apuntar dentro de un cono visible,
con línea de visión, sin autofuego, wallhack ni teletransporte de mira.
Fuego amigo está desactivado.

## 3. Tipos de cambio

- `HOTFIX`: parche mínimo para una causa concreta.
- `FRENTE COMPLETO`: cierra una experiencia o problema entero.
- `REFACTOR CAUSAL`: elimina una causa de bugs o reduce caminos duplicados de
  forma comprobable.

Aplicar el cambio causal mínimo que cierre el problema. No reorganizar lo
que funciona mientras quede un defecto jugable importante.

## 4. Rendimiento y recursos

Priorizar frame estable, pocas asignaciones por frame, geometría y materiales
reutilizados, navegación nativa y timers con dueño y reset. `tools/*.sh`
calcula la raíz desde su ubicación y no contiene rutas absolutas de una
máquina humana. `.godot/`, `builds/`, imports y capturas rutinarias no son
fuente del juego.

Todo proceso iniciado tiene lifecycle explícito y se cierra al terminar:
editor/juego Godot, servidor, adb, Gradle, exportaciones o watchers. No usar
procesos duplicados, emulador ni comandos destructivos de amplio alcance.

## 5. Assets y legal

No incorporar assets sin licencia y atribución. Los samples
`assets/sfx/gshot_*.ogg` son CC-BY 3.0 de Jesús Lastra. La biblioteca UAL de
rig/animaciones bajo CC0 conserva su licencia junto a los GLB. La skin técnica
y las armas de integración de Sketchfab son CC-BY 4.0 y deben mantener sus
fuentes. Los modelos Kenney heredados también conservan su licencia mientras
se retiran. La atribución canónica está en `CREDITS.md` y la mención de audio
permanece accesible en el lobby y Ajustes → Legal.

## 6. Evidencia y Git

La suite DEV, las pruebas dirigidas, el export Android y la inspección de
procesos son gates. Al finalizar un frente se comprueban también la salida
visual afectada y los logs propios. No inventar capturas ni declarar prueba
física si no se ejecutó; etiquetar lo pendiente como `SIN VERIFICAR`.

Los cambios deben ser revisables y enfocados. No hacer commit ni push sin
petición explícita.
