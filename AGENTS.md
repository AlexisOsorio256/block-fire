# BLOCKFIRE — tarjeta operativa

Constitución: `PROJECT_RULES.md` (prioridades, invariantes, tipos de cambio).
Hechos del producto: `README.md`. Atribuciones: `CREDITS.md`. Dueños y
contratos de cada sistema: `docs/ARCHITECTURE.md`. Estado operativo de hoy:
`docs/CURRENT_STATE.md` (único; `docs/history/*` es histórico).

## Arranque

1. `tools/bf doctor` — una sola sonda: HEAD, Godot, Blender (+MCP), teléfono,
   armas y clips activos. No la sustituyas por comandos ad-hoc.
2. El código dueño del comportamiento (mapa en `docs/ARCHITECTURE.md`); no
   deduzcas el dueño por el nombre del archivo ni por proximidad de carpetas.
3. `git status --short` y `git log --oneline -5` antes de tocar.

Lee `PROJECT_RULES.md`, `docs/ARCHITECTURE.md` o `docs/CURRENT_STATE.md` solo
cuando la tarea los necesite; no como trámite de arranque.

## Producto y plataforma

TPS arcade 4v4 por rondas / FFA de 8, para Android landscape-first. Godot
4.7.2 + GDScript, renderer Mobile. Linux es el laboratorio autónomo; el
teléfono es la autoridad de plataforma. No reabrir rutas Unity, web, PWA,
WebView o Capacitor. Un solo escritor por dueño; `SettingsStore` es el único
autoload.

## Verificación

Punto de entrada único: `tools/bf` (`doctor`, `test`, `qa <área>`,
`build android`). Durante la iteración: prueba dirigida y `--qa-squad`,
`--qa-ffa`, `--qa-combat` o `--qa-editor`. Al cerrar: `tools/bf test`,
`tools/bf qa touch`, `tools/bf build android`, y comprobación de que no
quedaron editor, servidor, Gradle, adb ni watchers vivos.

Lo no ejecutado se reporta `SIN VERIFICAR`; lo deducido de logs o métricas,
`INFERENCIA`. La matriz de evidencia por tipo de cambio vive en la skill
`blockfire-evidence`; animación en `blockfire-animation-craft`; Android en
`blockfire-android-qa`.

Commits y pushes: autorizados al cerrar una sesión verificada (contrato del
harness, `harness/ARCHITECTURE.md`); no se pide permiso para eso.
