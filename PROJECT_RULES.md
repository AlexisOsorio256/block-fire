# PROJECT RULES — BLOCKFIRE

Constitución estable del producto. README.md contiene los hechos cambiantes;
CREDITS.md, las atribuciones. Si hay duda, inspeccionar y probar: no inventar.

## 1. Producto y prioridades

BLOCKFIRE es un FPS arcade estilizado, colorido, legible y rápido. El núcleo
es moverse, apuntar, disparar, impactar, matar, morir y repetir. Las
referencias de género sirven para ritmo y claridad; no autorizan copiar mapas,
layouts, UI, nombres, personajes, assets, sonidos o branding.

Prioridades inmutables: estabilidad → gameplay → rendimiento → UX → inmersión
→ features.

## 2. Alcance

PC web y Android con WebView comparten un único runtime Three.js/WebGL.
BLOCKFIRE es horizontal en lobby, compra, combate, muerte, espectador, fin y
configuración. Capacitor es la vía Android canónica; la WebView mínima es
smoke/debug y no puede divergir. Android físico valida la plataforma; el
laboratorio responsive del navegador acelera la iteración.

No se añaden economía real, cuentas, backend, multijugador online, anuncios,
ranking, chat, clanes, vehículos, campaña, loot ni matchmaking. Se mantienen
la tienda de ronda con monedas ficticias y las skins cosméticas locales.

## 3. Arquitectura e invariantes

Un dueño y una fuente de verdad por concepto: input, daño, muerte, respawn,
HUD, audio, colisión, VFX, navegación y assets. Game.js orquesta y conserva
solo el estado de sesión; los sistemas poseen su comportamiento.

Todo disparo sigue intención → cadencia/munición → trayectoria → oclusión →
daño → feedback → muerte/score/respawn. Jugador y bots comparten colisión,
visión y daño; la dificultad son parámetros, no trampas. Reiniciar limpia
estado temporal. Fuego amigo está desactivado. El fallback geométrico es
técnico y no define la dirección artística.

## 4. Tipos de cambio

- HOTFIX: parche mínimo para una causa concreta.
- FRENTE COMPLETO: cierra una experiencia o problema entero, incluso si
  atraviesa varios sistemas relacionados.
- REFACTOR CAUSAL: elimina una causa de bugs o reduce caminos duplicados de
  forma comprobable.

Aplicar el cambio causal mínimo que cierre el problema. No optimizar ni
reorganizar lo que funciona mientras quede un defecto jugable importante.

## 5. Rendimiento y procesos

Priorizar frame estable, pocas asignaciones por frame, geometría/materiales
reutilizados y listeners/timers con dueño y reset. tools/*.sh calcula la raíz
desde su ubicación; nunca contiene rutas absolutas de una máquina humana.
www/, builds/, capturas rutinarias y secretos no se versionan.

Todo proceso iniciado durante el trabajo tiene lifecycle explícito y se cierra
al terminar: servidor, Chromium, Node, adb, Gradle o watchers. No usar nohup
suelto ni pkill indiscriminado.

## 6. Licencias y documentación

Los samples assets/sfx/gshot_*.ogg son CC-BY 3.0 de Jesús Lastra. Su
atribución canónica está en CREDITS.md y la mención de autoría permanece en el
lobby. Los modelos Kenney usados por el runtime tienen su licencia junto a
los assets.

El mapa documental es pequeño: AGENTS.md operación, este archivo
constitución, README.md hechos, docs/PRODUCT_SPEC.md especificación,
docs/ROADMAP.md próximos hitos y docs/CODEMAP.md navegación del código. No
crear diarios ni duplicar reglas.

## 7. Evidencia y pruebas

Conservar la suite DEV y ejecutar pruebas dirigidas durante la iteración. Al
final, ejecutar toda la suite actual con ?runTests=1, comprobar consola, build
de producción y registrar métricas disponibles. No inventar capturas ni
atribuir una verificación humana o de hardware que no se haya ejecutado.
Toda limitación se etiqueta SIN VERIFICAR; las conclusiones derivadas de logs
o mediciones, INFERENCIA cuando corresponda.

## 8. Git

Cambios revisables y enfocados. No commit ni push sin petición explícita.
