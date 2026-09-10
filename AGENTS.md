# BLOCKFIRE — tarjeta operativa

Constitución: `PROJECT_RULES.md` (prioridades, invariantes, tipos de cambio).
Hechos del producto: `README.md`. Atribuciones: `CREDITS.md`. Dueños y
contratos de cada sistema: `docs/ARCHITECTURE.md`. Estado operativo de hoy:
`docs/CURRENT_STATE.md` (único; `docs/history/*` es histórico).

## Arranque

Sin ritual: entra al código y trabaja. El mapa de dueños de cada comportamiento
vive en `docs/ARCHITECTURE.md` — consúltalo cuando necesites saber quién posee
qué; no lo deduzcas por nombre de archivo ni cercanía de carpetas.
`PROJECT_RULES.md` y `docs/CURRENT_STATE.md` se leen cuando la tarea los pide.
`tools/bf doctor` (HEAD, Godot, Blender, teléfono, armas y clips) es la sonda
de estado cuando la tarea toca plataforma o assets — no un paso de apertura.

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
