# PROJECT RULES — BLOCKFIRE (constitución)

Documento de principios y límites, válido durante años. `README.md` son los
hechos cambiantes (comandos, estado, alcance real). Si colisionan: aquí mandan
los principios; el README manda en los hechos. Ante ambigüedad: inspeccionar,
probar y pedir dirección humana. Prohibido inventar.

## 1. Misión y brújula

BLOCKFIRE es un producto comercial en estabilización y pulido final: un FPS
arcade con identidad propia (colorido, legible, rápido) cuyo núcleo —moverse,
disparar, impactar, matar, morir, repetir— debe sentirse agresivo y justo.
Referencia de *sensación*: shooters móviles arcade rápidos (Free Fire) en
legibilidad, combate, lobby centrado en personaje y economía de ronda.
Referencia de calidad y principios, **jamás** material: prohibido copiar
mapas, UI, nombres, assets, identidad ni contenido de otros juegos.

Prioridades inmutables:

**estabilidad → gameplay → rendimiento → claridad/UX → presentación → features**

Cada cambio responde: "¿mejora de forma comprobable la próxima partida?".

## 2. Tipos de cambio (sustituye al antiguo "cambio más pequeño siempre")

| Tipo | Qué es | Límite |
|---|---|---|
| **HOTFIX** | Parche mínimo para un bug concreto | Una frase causal; nada aprovechado |
| **PULIDO VERTICAL** | Cierra una experiencia COMPLETA (puede atravesar Input, Game, HUD, Map, assets…) | La causa o el alcance lo justifica; se trabaja por *slices* verificables |
| **REFACTOR CAUSAL** | Elimina la causa de bugs o simplifica mantenimiento de forma comprobable | Debe reducir caminos duplicados o aclarar un dueño; nunca arquitectura por gusto |

Regla general: **aplicar el cambio causal mínimo que cierre el problema
COMPLETO.** Se permiten refactors contenidos cuando la causa atraviese
responsabilidades o cuando seguir parcheando aumente deuda/regresiones. Se
permite añadir o sustituir contenido visual cuando la tarea sea explícitamente
de product polish. No optimizar código que funciona mientras quede un problema
visible o jugable importante.

## 3. Alcance y basura

Prohibido sin decisión explícita del humano: economía real, cuentas,
backend/multijugador online, anuncios, ranking, chat, clanes, vehículos,
campaña, loot, matchmaking. (Aprobado y vigente: tienda in-match con oro
ficticio + skins cosméticas persistentes en localStorage.)

Nada entra al repo sin justificar su valor. Jamás se versionan: `www/`,
`builds/`, `node_modules/`, capturas rutinarias, secretos (`.env`). El
lockfile (`package-lock.json`) SÍ se versiona: npm es parte del build
reproducible (esbuild + Capacitor), ignorarlo por inercia rompe la
reproducibilidad.

**Atribuciones legales NO son basura**: los samples `gshot_*.ogg` son CC-BY 3.0
(Jesús Lastra). Su atribución vive en `CREDITS.md` (fuente canónica) y en el
lobby (`index.html`); moverla o borrarla sin reemplazar los assets es
violación de licencia.

Referencias muertas = basura: si la documentación cita algo que no existe, o
se crea o se borra la mención.

## 4. Arquitectura

Una responsabilidad por sistema, una fuente de verdad por dato, un solo camino
por concepto (input, daño, muerte, respawn, HUD, audio, colisión, VFX,
navegación, assets). Contratos pequeños entre sistemas. Extender antes que
duplicar. Sin estado global oculto, sin dependencias circulares, sin banderas
sin dueño. `Game.js` es ORQUESTADOR: crea sistemas, ordena el update y guarda
solo el estado de sesión que le corresponde; lo demás vive en su sistema dueño.
Pocos archivos, con dueño claro — ni 100 archivos ni un Game-lotodo.

## 5. Invariantes de gameplay

Input nunca bloquea ni degrada controles sin prueba en la plataforma afectada.
Todo disparo resuelve intención → cadencia/munición → trayectoria → oclusión →
daño → feedback → muerte/score/respawn por la ruta central. La geometría
bloquea balas, visión y movimiento con el mismo contrato para todos. Los bots
usan las mismas reglas que el jugador (dificultad = parámetros, no trampas).
Reiniciar devuelve TODO el estado temporal a limpio. Todo lo importante tiene
lectura inmediata. Mundo consistente con el modo elegido. Fuego amigo OFF.

## 6. Plataformas

Horizontal SIEMPRE, en TODAS las pantallas. PC y Android son primera clase con
las mismas reglas. Móvil no se declara listo sin hardware real.

**Estrategia Android**: existen dos vías en el repo — Capacitor (producción:
plugins, storage persistente, `tools/build-web.sh` → `www/` → gradle) y la
APK mínima sin gradle (`tools/webview/build.sh`, aapt2+d8+apksigner). El
README antiguo recomendaba TWA/PWA. **Contradicción abierta: NO decidida por
el humano.** Ambas vías se mantienen; la documentación las describe, no
elige. Decisión pendiente de dirección.

La APK (cualquiera de las vías) es una cáscara y nunca reescribe gameplay.

## 7. Rendimiento y economía de la IA

Frame estable sobre picos bonitos. Reutilizar geometrías y materiales; ningún
`requestAnimationFrame`, listener o timer sin dueño y sin reset al terminar la
partida. Y la IA también tiene presupuesto: herramientas en batch por mensaje,
cero polling, cada cambio visual cuesta 1–3 capturas (no 20). Posicionamiento
primero con invariantes numéricos (bounding boxes, distancias, spawns, TTK);
la captura es para VERIFICAR, no para explorar.

## 8. Protocolo de la IA

Antes: leer README + reglas + código dueño; `git status/diff/log`; formular
hipótesis y clasificarla (`BUG`/`INCONSISTENCIA`/`RIESGO`/`MEJORA`).
Durante: el tipo de cambio adecuado (§2) en el sistema dueño, explicable en
una frase causal. Si surge alcance no autorizado: parar y preguntar.
Después: suite `?runTests=1` headless completa (TODOS los tests en verde — el
número exacto lo dicta la suite actual, nunca un literal hardcodeado), consola
limpia, recorrer el flujo afectado (entrada, uso, feedback, fallo,
muerte/reinicio), captura+visión si toca visual o game-feel, informar hechos y
riesgos, tocar el README solo si cambió un hecho canónico.

## 9. Evidencia visual obligatoria

Ningún cambio visual, de game-feel o de HUD se declara bueno sin captura del
antes/después desde la misma situación + análisis visual hecho por la propia
IA. La visión DETECTA anomalías; los píxeles las EXPLICAN. Sin captura =
SIN VERIFICAR = no se cierra el trabajo. (Presupuesto: 1 captura antes,
1 después; tercera solo si la segunda revela defecto.)

## 10. Git

Cambios enfocados y revisables; un commit = una cosa; mensajes que describen
resultado (prohibido "act", "actualizacion", "ligero"). Jamás secretos,
generados ni dependencias. Sin commit ni push salvo petición explícita.
La basura no se reorganiza: se elimina con decisión humana registrada.

## 11. Antialucinación

Visto ≠ ejecutado ≠ leído ≠ inferido. Citar archivo:línea siempre; lo no
verificado se marca SIN VERIFICAR; una conjetura jamás es un hecho. Un
hallazgo falso cuesta más que un hallazgo menos.
