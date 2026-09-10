---
name: blockfire-evidence
description: >-
  Qué cuenta como evidencia para cerrar una tarea en BLOCKFIRE, cómo elegir la
  más barata que pruebe el cambio y cómo reportar lo no verificado.
whenToUse: >-
  Antes de declarar terminada cualquier tarea que toque código, presentación,
  animación, rendimiento o plataforma; también cuando dudes de si una
  comprobación basta.
---

# Evidencia antes de "terminado"

El cierre no se justifica con confianza ni con "compiló". Se justifica con la
evidencia que **esa** tarea necesita. Elegir la más barata que realmente pruebe
el cambio es parte del trabajo, no un extra.

## Matriz por tipo de cambio

| Cambio | Evidencia mínima | Cómo |
|---|---|---|
| Lógica pura / reglas | test dirigido verde | `tools/bf test`, `tools/bf qa <área>` |
| Escena, nodo, señal, input | runtime real, no solo import | `--qa-squad`, `--qa-ffa`, `--qa-combat`, `--qa-editor` |
| Presentación (HUD, lobby, tienda, editor de controles) | captura o vídeo **mirado** | `tools/bf qa shot` / `qa hud` / captura Android |
| Animación | fuente Blender + export + runtime | `blockfire-animation-craft` |
| Android | instalación + lanzamiento en dispositivo | `blockfire-android-qa` |
| Rendimiento | medición antes/después, no impresión | `tools/bf qa perf` |
| Documentación | coherencia con el código dueño | lectura cruzada del archivo citado |
| Assets / licencias | origen y licencia registrados | `CREDITS.md` |

No todas las tareas necesitan todas las filas. Sí necesitan **decir cuál usaron**.

## Contrato de reporte

- Lo ejecutado y verde: se afirma, con el comando exacto.
- Lo no ejecutado: `SIN VERIFICAR`, explícito. No se esconde ni se suaviza.
- Lo deducido de logs, métricas o lectura: `INFERENCIA`, con la fuente.
- Una captura que no miraste no es evidencia visual.
- Un test que no toca el código cambiado no es evidencia de ese cambio.

## Cierre de sesión

Al cerrar, el orden de `AGENTS.md` sigue siendo el correcto: `tools/bf test`,
`tools/bf qa touch`, `tools/bf build android`, instalación en teléfono si está
conectado, y comprobación de que no quedaron editor, servidor, Gradle, adb ni
watchers vivos. Si el cambio afecta presentación, inspección visual real.

commit + push están autorizados cuando esa verificación existe; no se piden de
nuevo. Si falta evidencia, no se commitea: se reporta `SIN VERIFICAR` y se dice
qué falta.

## Anti-patrones

- "Compila, entonces funciona".
- Sustituir el test del área por un script improvisado que solo prueba tu
  camino feliz.
- Declarar un P0 cerrado sin reproducir antes el fallo y verlo desaparecer.
- Medir rendimiento con el editor abierto y el resto de la máquina ocupada.
