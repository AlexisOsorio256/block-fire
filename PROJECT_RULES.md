# PROJECT RULES — BLOCKFIRE (constitución)

Documento de principios y límites, válido durante años. `README.md` son los
hechos cambiantes (comandos, estado, alcance real). Si colisionan: aquí mandan
los principios; el README manda en los hechos. Ante ambigüedad: inspeccionar,
probar y pedir dirección humana. Prohibido inventar.

## 1. Misión y brújula

FPS arcade cuyo núcleo funciona extraordinariamente bien: moverse, disparar,
impactar, matar, morir, repetir. Cada cambio responde: "¿mejora de forma
comprobable la próxima partida?". Prioridades inmutables:

**estabilidad → gameplay → rendimiento → claridad/UX → contenido → features**

No copiar mapas, UI, nombres, assets ni identidad de otros juegos.

## 2. Alcance y basura

Prohibido sin decisión explícita del humano: economía real, cuentas,
backend/multijugador, anuncios, ranking, chat, clanes, vehículos, campaña,
loot, matchmaking, monetización. (Aprobado y vigente: tienda in-match con oro
ficticio + skins cosméticas persistentes en localStorage.)

Nada entra al repo sin justificar su valor. Prohibido commitear: generados
(`www/`, `builds/`), secretos, dependencias, capturas rutinarias (solo
evidencia aprobada y comprimida). Candidatos a limpieza —decide el humano con
verificación, no la IA por su cuenta—: `www/`, `builds/`, `capturas/`
históricas, `android/` (hoy 25M/53 ficheros: ¿producto o lastre?).

La atribución legal NO es basura: `assets/sfx/gshot_*.ogg` son CC-BY 3.0
(Jesús Lastra) y exigen atribución. Decisión registrada: `CREDITS.md` se
elimina SOLO cuando (a) esos samples se reemplacen por propios/CC0, o (b) la
atribución viva en una línea de README/index.html. Borrarlo sin una de esas
dos vías es violación de licencia, no limpieza.

`docs/migration/` no existe y el README lo cita: o se crea con lo que aporte
o se borra la mención. Referencias muertas = basura.

## 3. Arquitectura

Una responsabilidad por sistema, una fuente de verdad por dato, un solo camino
por concepto (input, daño, muerte, respawn, HUD, audio, colisión, VFX).
Contratos pequeños entre sistemas. Extender antes que duplicar. Sin estado
global oculto, sin dependencias circulares, sin banderas sin dueño.

## 4. Invariantes de gameplay

Input nunca bloquea ni degrada controles sin prueba en la plataforma afectada.
Todo disparo resuelve intención → cadencia/munición → trayectoria → oclusión →
daño → feedback → muerte/score/respawn por la ruta central. La geometría
bloquea balas, visión y movimiento con el mismo contrato para todos. Los bots
usan las mismas reglas que el jugador (dificultad = parámetros, no trampas).
Reiniciar devuelve TODO el estado temporal a limpio. Todo lo importante tiene
lectura inmediata. Mundo consistente con el modo elegido. Fuego amigo según
modo (escuadras OFF).

## 5. Plataformas

Horizontal SIEMPRE, en TODAS las pantallas. PC y Android son primera clase con
las mismas reglas. Móvil no se declara listo sin hardware real. La APK es una
cáscara mínima y nunca reescribe gameplay.

## 6. Rendimiento y economía de la IA

Frame estable sobre picos bonitos. Reutilizar geometrías y materiales; ningún
`requestAnimationFrame`, listener o timer sin dueño y sin reset al terminar la
partida. Y la IA también tiene presupuesto: herramientas en batch por mensaje,
cero polling, cada cambio visual cuesta 1–3 capturas (no 20). Cada llamada se
gasta como si costara dinero.

## 7. Protocolo de la IA

Antes: leer README + reglas + código dueño; `git status/diff/log`; formular
hipótesis y clasificarla (`BUG`/`INCONSISTENCIA`/`RIESGO`/`MEJORA`).
Durante: el cambio más pequeño en el sistema dueño, explicable en una frase
causal (problema → cambio → resultado). Nada de refactors ni contenido
aprovechados. Si surge alcance no autorizado: parar y preguntar.
Después: suite `?runTests=1` en headless sin bajar de 23/23, consola limpia,
recorrer el flujo afectado (entrada, uso, feedback, fallo, muerte/reinicio),
captura+visión si toca visual o game-feel, informar hechos y riesgos, tocar el
README solo si cambió un hecho canónico.

## 8. Evidencia visual obligatoria

Ningún cambio visual, de game-feel o de HUD se declara bueno sin captura del
antes/después desde la misma situación + análisis visual hecho por la propia
IA (los modelos son multimodales: la captura se lee directamente, sin
puentes). La visión DETECTA anomalías; los píxeles las EXPLICAN. Sin captura = SIN VERIFICAR = no se cierra el trabajo.

## 9. Git

Cambios pequeños, enfocados y revisables; un commit = una cosa; mensajes que
describen resultado. Jamás secretos, generados ni dependencias. Sin commit ni
push salvo petición explícita. La basura no se reorganiza: se elimina con
decisión humana registrada.

## 10. Antialucinación

Visto ≠ ejecutado ≠ leído ≠ inferido. Citar archivo:línea siempre; lo no
verificado se marca SIN VERIFICAR; una conjetura jamás es un hecho. Un
hallazgo falso cuesta más que un hallazgo menos.
