# PROJECT RULES — BLOCKFIRE

## 0. Carácter de este documento

Este archivo es la **constitución técnica y de producto** de BLOCKFIRE. Debe
seguir siendo válido durante años. No es un changelog, no enumera tareas del
momento y no se actualiza por cada ajuste. El estado actual, comandos,
resultados, contenido existente y siguiente paso pertenecen al `README.md`.

Una IA debe leer primero `README.md` y después este archivo. Si ambos se
contradicen, este archivo manda en principios y límites; el README manda en los
hechos cambiantes. Si hay ambigüedad, no inventar: inspeccionar, probar y pedir
dirección humana si la decisión modifica producto o arquitectura.

## 1. Misión y brújula de producto

BLOCKFIRE será un FPS 3D blocky comercial, propio, rápido, claro y eficiente
para PC y Android. Su valor no proviene de una lista enorme de sistemas, sino
de un núcleo que funciona extraordinariamente bien:

**movimiento responsivo + disparo instantáneo + impactos legibles + kills
claras + respawn rápido + rendimiento estable**

Cada cambio debe responder: “¿mejora de forma comprobable la siguiente
partida del jugador?”. Si no mejora estabilidad, diversión, claridad,
rendimiento o una necesidad de producto aprobada, no se implementa.

El orden de prioridad nunca cambia:

**estabilidad → gameplay → rendimiento → claridad/UX → contenido → features**

No optimizar para impresionar a un desarrollador o a una IA. Optimizar para
que el jugador quiera jugar otra partida.

## 2. Autoridad y control de alcance

El humano dirige la visión y aprueba cambios de alcance. La IA inspecciona,
propone, implementa y verifica dentro de ese alcance; no decide por su cuenta
qué juego debe ser BLOCKFIRE.

Una petición de implementación autoriza solo el cambio necesario para ese
resultado. No autoriza sistemas adyacentes, refactors masivos, dependencias,
reescrituras ni “mejoras” especulativas.

No añadir o asumir sistemas de economía, cuentas, tienda, skins, inventario,
progresión, anuncios, ranking, chat, clanes, vehículos, campaña, loot,
matchmaking o multijugador sin una decisión explícita de producto. Cuando un
futuro sistema sea aprobado, entrará por etapas pequeñas y verificables; no
por una segunda arquitectura paralela.

No copiar mapas, UI, nombres, assets, personajes ni identidad de otros juegos.
Las referencias externas solo pueden inspirar sensaciones de claridad, ritmo o
feedback; BLOCKFIRE debe conservar identidad propia.

## 3. Principios de arquitectura duradera

La arquitectura existe para hacer cambios seguros, no para parecer empresarial.
Debe seguir siendo pequeña, directa, modular y fácil de inspeccionar.

- Una responsabilidad clara por sistema y una única fuente de verdad por dato.
- Datos configurables separados de la lógica que los usa cuando aporta claridad
  real; no crear capas vacías ni abstracciones anticipadas.
- Un solo camino de gameplay para cada concepto: input, movimiento, daño,
  armas, muerte, respawn, HUD, audio, colisión y efectos. Reutilizarlo para
  humano, bots y plataformas cuando corresponda.
- PC y Android pueden tener adaptadores de entrada y presentación distintos,
  pero las reglas de partida y combate son las mismas.
- Los sistemas se comunican por contratos pequeños y explícitos. No introducir
  estado global oculto, dependencias circulares ni banderas sin dueño.
- El sistema dueño cambia un estado. Los demás piden acciones o consumen el
  resultado; no modificar campos ajenos de forma silenciosa.
- Preferir extender un sistema existente a duplicarlo. Extraer un módulo solo
  cuando una responsabilidad nueva ya sea real, estable y difícil de entender
  dentro de su dueño actual.

Los nombres y archivos pueden evolucionar con una migración justificada, pero
estas responsabilidades no deben duplicarse ni dispersarse.

## 4. Invariantes de gameplay

Estas reglas se preservan durante cualquier expansión:

- El input nunca debe bloquear, invertir o degradar controles conocidos sin una
  razón demostrable y una prueba en la plataforma afectada.
- Todo disparo resuelve en orden: intención → cadencia/munición → trayectoria
  → oclusión → impacto/daño → feedback → muerte/score/respawn.
- La geometría bloquea balas, visión y movimiento según el mismo contrato
  espacial; no aceptar daños a través de cobertura por comodidad.
- Daño, muerte, marcador y respawn deben pasar por una ruta central y
  comprobable. No permitir atajos que dejen contadores, entidades o timers en
  estados incoherentes.
- Los bots usan las mismas reglas de combate que el jugador. Su dificultad
  proviene de parámetros y decisiones simples, no de trampas ni complejidad
  artificial.
- Reiniciar una partida devuelve todos los estados temporales a un estado
  limpio: entidades, munición, cooldowns, input, timers, VFX, HUD y audio.
- Todo feedback importante tiene una lectura inmediata: disparo, impacto,
  headshot, kill, daño recibido, muerte, respawn y objetivo de partida.

## 5. Plataformas: PC y Android

PC y Android son objetivos de primera clase. Ninguna plataforma es una versión
de segunda categoría ni una excusa para bifurcar el juego.

- Diseñar primero reglas, UI y flujo que funcionen con mouse/teclado y táctil.
- Tratar tamaño, orientación, densidad, área segura, foco, pausa/interrupción,
  audio y rendimiento móvil como requisitos reales, no como detalles finales.
- No declarar “móvil listo” por CSS o emulación. Validar controles y rendimiento
  en un dispositivo Android real antes de afirmarlo.
- La futura app Android debe envolver el juego existente con la mínima capa de
  plataforma posible; no reescribir el gameplay para empaquetarlo.
- Toda función visual debe tener un presupuesto y una degradación razonable
  para dispositivos más modestos.

## 6. Rendimiento y recursos

El presupuesto de rendimiento es una restricción de diseño desde el inicio.
Medir en la plataforma probada antes de afirmar FPS, memoria, estabilidad o
compatibilidad.

- Priorizar frame time estable sobre picos visuales o métricas promedio bonitas.
- Evitar trabajo por frame que escale innecesariamente con enemigos, partículas,
  proyectiles o complejidad del mapa.
- Reutilizar geometrías, materiales y objetos de efecto frecuentes; liberar o
  reciclar recursos temporales de forma explícita.
- No crear un `requestAnimationFrame`, listener o timer sin dueño y ciclo de
  vida claro. Todo debe detenerse o resetearse al terminar una partida.
- Mantener renderer, sombras, resolución y pixel ratio dentro de un presupuesto
  adecuado para PC y Android. Aplicar una optimización solo cuando la medición
  demuestre un cuello de botella o elimine una fuga evidente.
- No introducir infraestructura de optimización compleja para ahorrar una
  cantidad insignificante de trabajo.

## 7. Protocolo de una IA antes, durante y después de cambiar

### Antes

1. Leer README, estas reglas y el código dueño del comportamiento.
2. Inspeccionar el árbol, cambios sin confirmar, pruebas, assets y evidencia
   existentes. Nunca borrar, sobrescribir ni atribuirse trabajo ajeno.
3. Ejecutar y observar el juego si el cambio afecta interacción, visuales,
   rendimiento, controles, audio o ciclo de partida.
4. Formular una hipótesis comprobable y clasificarla: `BUG`, `INCONSISTENCIA`,
   `RIESGO` o `MEJORA FUTURA`. No presentar una conjetura como hecho.

### Durante

1. Elegir el cambio más pequeño que resuelva la causa, dentro del sistema dueño.
2. Conservar contratos e invariantes. No aprovechar el cambio para introducir
   contenido, reorganizaciones o archivos innecesarios.
3. Mantener cada modificación explicable en una frase causal: problema → cambio
   → resultado esperado.
4. Si surge una necesidad de arquitectura, contenido, servicio externo,
   persistencia o alcance no autorizado, detenerse y pedir decisión humana.

### Después

1. Ejecutar las pruebas disponibles y revisar errores de consola.
2. Repetir manualmente el flujo afectado. Si toca gameplay, recorrer al menos
   entrada, uso, feedback, fallo, muerte/reinicio cuando aplique.
3. Comparar antes/después mediante captura, vídeo o métricas cuando el cambio
   sea visual, de game feel o rendimiento.
4. Informar hechos: causa, archivos, pruebas, evidencia, métricas observadas y
   riesgos pendientes. Nunca ocultar un fallo ni afirmar una prueba no hecha.
5. Actualizar README solo si cambió un hecho canónico: estado, alcance,
   arquitectura real, controles, plataforma o verificación.

## 8. Evidencia y criterio de calidad

Los tests automatizados son una red mínima, no una prueba de diversión ni de
compatibilidad. Los cambios deben recibir evidencia proporcional a su riesgo:

- Lógica aislada: test relevante y revisión de consola.
- Gameplay: partida real y resultado observable.
- Visual/UI: captura antes/después desde la misma situación cuando sea posible.
- Movimiento, ritmo o feedback: vídeo corto o secuencia de capturas que permita
  observarlo, más una explicación de lo que mejoró.
- Rendimiento: dispositivo/plataforma, resolución, configuración, duración y
  FPS o frame time observados; no extrapolar entre dispositivos.
- Android: prueba táctil y de rendimiento en hardware Android real.

Una modificación está lista solo si no degrada el núcleo, respeta estas reglas,
queda probada en el alcance que tocó y deja al siguiente agente una base más
clara, no más confusa.

## 9. Git, GitHub y memoria del proyecto

Git es la memoria permanente del proyecto y GitHub es el punto de sincronía,
revisión y respaldo. El repositorio debe seguir siendo legible sin depender de
una conversación anterior.

- Mantener cambios pequeños, enfocados y fáciles de revisar.
- No mezclar una corrección, un refactor y contenido nuevo en el mismo cambio
  sin una razón clara.
- No incluir capturas, vídeos o assets grandes por rutina: solo evidencia o
  material de producto con propósito explícito. Preferir archivos comprimidos y
  representativos.
- No commitear secretos, credenciales, datos personales, builds efímeros,
  dependencias generadas ni basura de herramientas.
- Usar mensajes de commit que describan el resultado, no intenciones vagas.
- Eliminar documentación histórica o duplicada: Git conserva el historial. El
  README y este archivo son las únicas guías raíz permanentes.

## 10. Antialucinación y decisiones futuras

Una IA debe distinguir siempre entre lo que vio, lo que ejecutó, lo que leyó y
lo que infiere. Debe declarar incertidumbre y solicitar una decisión cuando no
pueda verificar algo de forma segura.

No asumir que un sistema existe porque sería útil, porque aparece en una idea,
porque un archivo tiene un nombre sugerente o porque una captura antigua lo
parece mostrar. No convertir una posibilidad en código sin autorización.

El juego sí crecerá, pero por capas: primero núcleo validado; después una
necesidad concreta; después una implementación pequeña; después evidencia;
después la siguiente capa. Nunca “a ver qué pasa”.
