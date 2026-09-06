# PROJECT RULES — BLOCKFIRE (constitución)

Documento de principios y límites, válido durante años. `README.md` son los
hechos cambiantes (comandos, estado, alcance real). Si colisionan: aquí mandan
los principios; el README manda en los hechos. Ante ambigüedad: inspeccionar,
probar y pedir dirección humana. Prohibido inventar.

## 1. Misión y brújula

BLOCKFIRE es un producto comercial en estabilización y pulido final: un FPS
arcade con identidad propia (colorido, legible, rápido) cuyo núcleo —moverse,
disparar, impactar, matar, morir, repetir— debe sentirse agresivo y justo.
Referencia de PRINCIPIOS: shooters móviles arcade rápidos (Free Fire) pueden
usarse como referencia de calidad, legibilidad, ritmo, combate y sensación
(lobby centrado en personaje, economía de ronda). JAMÁS copiar MATERIAL de
terceros: ni mapas, ni layouts exactos, ni UI, ni nombres, ni personajes, ni
assets, ni sonidos, ni branding, ni identidad, ni contenido. Ninguna lectura
de estas reglas autoriza copiar material.

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

**Estrategia Android**: **Capacitor es la vía canónica de PRODUCCIÓN**
(plugins, storage persistente, integraciones futuras). La APK mínima sin
gradle (`tools/webview/build.sh`) sobrevive únicamente como smoke/debug rápido
si aporta valor y no diverge. La web runtime es única; Android es una cáscara
delgada y nunca reescribe gameplay. No mantener tres estrategias Android
iguales por años.

La APK (cualquiera de las vías) es una cáscara y nunca reescribe gameplay.

## 7. Rendimiento, procesos y economía de la IA

Frame estable sobre picos bonitos. Reutilizar geometrías y materiales; ningún
`requestAnimationFrame`, listener o timer sin dueño y sin reset al terminar la
partida. Y la IA también tiene presupuesto: herramientas en batch por mensaje,
cero polling, cada cambio visual cuesta pocas capturas con pregunta concreta.

**Higiene de procesos (regla permanente)**: TODO proceso iniciado por una IA
tiene DUEÑO. Prohibido dejar vivos Chromium/chrome-headless, `http.server`,
node servers, emuladores, `adb forward`, gradle daemons, watchers o procesos
de captura después del trabajo que los necesitó. PROHIBIDO `nohup ... &` sin
lifecycle explícito (PID file + stop + verificación). Prohibido `pkill`
indiscriminado (puede matar apps reales del usuario). Cada proceso: registrar
PID, cerrarse al terminar, limpiar sus temporales. Con 8 GB de RAM: mínimo
número de procesos persistentes; máximo un emulador a la vez, sin dejarlo
abierto tras su frente.

**Build reproducible**: las herramientas del repo (`tools/*.sh`) calculan la
raíz desde la ubicación del script. PROHIBIDO rutas absolutas de máquina
humana. El bundle de PRODUCCIÓN no lleva harness de testing/capturas (rama
muerta por define); los tests viven en DEV (`?runTests=1`) y son el seguro
del proyecto: no se borran por crecer, se mantienen protegiendo invariantes.
Toda build lleva BUILD_ID (commit+timestamp) visible solo en consola/debug,
nunca player-facing.

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

## 10. Flujo de trabajo: orquestador + dueños de frente

El trabajo se organiza en **FRENTES COMPLETOS cerrados** (una experiencia o
problema entero, puede atravesar Input, Game, HUD, Map, assets…). El
orquestador administra trabajo; los SUBAGENTES DUEÑOS lo ejecutan.

**Orquestador principal**: 0 imágenes como objetivo. Asigna dueños, evita
conflictos de archivos, recibe reportes compactos, revisa diffs, integra y
ejecuta verificación global. NO consume su contexto viendo capturas.

**Subagente dueño visual (regla obligatoria): QUIEN VE EL DEFECTO VISUAL ES,
POR DEFECTO, QUIEN LO CORRIGE.** Cada dueño recibe contexto limpio y
autocontenido del frente completo, VE él mismo sus capturas, diagnostica,
EDITA, ejecuta, RECAPTURA, vuelve a ver e ITERA él mismo hasta cerrar.
Prohibido el relevo "A ve → A describe → B interpreta → B corrige": añade
latencia y pierde información. Tampoco se cierra un frente visual solo con
PIL/histogramas/números: los números EXPLICAN, la visión DETERMINA
presentación. Ambos: NUMÉRICO + VISUAL.

- **Presupuesto de visión** (límite duro del proveedor: 8 imágenes por chat):
  máximo operativo **6 imágenes por dueño visual**, reservando 2 del límite
  para contingencias; nunca superar 6 de forma planificada. Cada imagen debe
  responder una pregunta (no mirar 10 veces la misma pantalla). Si con 6 no
  cierra: reportar estado y abrir un agente nuevo limpio.
- **Juez fresco OPCIONAL**: solo cuando el dueño dice que cerró, el cambio es
  visualmente importante y una segunda opinión aporta valor. Máximo 2
  imágenes; acepta o veta; NO es intermediario obligatorio. Si veta, la
  corrección vuelve AL MISMO dueño mientras su contexto siga vivo.
- **Capturas de ESTADOS COMPLETOS**: la verificación visual recorre TODOS los
  estados del juego (lobby → compra → combate → muerte → espectador → fin de
  ronda → retry → regreso al lobby, en PC y móvil landscape), no solo la
  pantalla tocada. Los bugs suelen vivir en la transición, no en la pantalla.
- **Destino Android SIEMPRE presente**: se itera en web (headless/puppeteer)
  porque es el ciclo más rápido, pero el producto se empaqueta a Android.
  Toda decisión de rendimiento, DPR, safe-areas, touch y peso de assets se
  toma como si corriera en un WebView móvil. "Web" nunca es excusa para
  costes que Android no se puede permitir.
- **Seguridad de ediciones paralelas**: se pueden paralelizar auditorías, y
  implementaciones si los archivos son disjuntos. Antes de lanzar dueños, el
  orquestador define la tabla FRENTE → ARCHIVOS QUE POSEE. Dos frentes nunca
  editan a la vez `Game.js`, `Input.js`, `style.css`, `index.html` o `HUD.js`
  sin coordinación: uno espera o el orquestador integra la parte común.
- **Reporte de frente**: el dueño devuelve FRENTE / BUGS CONFIRMADOS / CAUSA /
  ARCHIVOS / CORRECCIONES / TESTS / EVIDENCIA / IMÁGENES USADAS x/6 /
  MÉTRICAS / RIESGO RESTANTE / SIN VERIFICAR. Lo no ejecutado se marca SIN
  VERIFICAR. El orquestador integra, conserva la suite en verde y decide el
  siguiente frente.

## 11. Git

Cambios enfocados y revisables; un commit = una cosa; mensajes que describen
resultado (prohibido "act", "actualizacion", "ligero"). Jamás secretos,
generados ni dependencias. Sin commit ni push salvo petición explícita.
La basura no se reorganiza: se elimina con decisión humana registrada.

## 12. Antialucinación

Visto ≠ ejecutado ≠ leído ≠ inferido. Citar archivo:línea siempre; lo no
verificado se marca SIN VERIFICAR; una conjetura jamás es un hecho. Un
hallazgo falso cuesta más que un hallazgo menos.
