# BLOCKFIRE — ESTADO ACTUAL

Único estado operativo del repo. Los `docs/history/*` son históricos: no los
uses para decidir. Mapa de dueños y contratos: `docs/ARCHITECTURE.md`.

## Instantánea

- **HEAD**: `7f695d9` (unifica la tabla de módulos del armario).
- **Modelo de la última sesión**: `muse-spark`.
- **Tests verdes**: `tools/bf test` → smoke 296 checks PASS, animation_layers
  PASS. `tools/bf qa touch` → PASS (13 checks). `tools/bf qa fx` → OK
  (idéntico a base).
- **Tests rojos**: ninguno.
- **Pie deslizante** (peor fotograma de aterrizaje): walk 0.16 · sprint 0.01 ·
  strafe 0.01 m/s (presupuestos 0.40 / 1.20 / 0.55).
- **Android**: VERIFIED en SM-S901E (`R5CT403MXZJ`) — APK debug construido,
  instalado, lanzado y grabado con input real.
- **Personaje activo**: `assets/models/skins/operator_adult_lod.glb`.
- **Armas activas**: `rifle`, `pistol`, `shotgun`, `smg`
  (`game/data/weapons/*.tres`).
- **Autoridad de animación**: `assets/animation_sources/<Clip>.blend`
  (Blender). `ReloadRifle` y `ReloadPistol` son `CRAFT_LOCKED`: `--rebuild`
  se niega a regenerarlos.

## P0 visual

1. **Arms de los clips de locomotion**: el generador deja los brazos en reposo
   (T-pose) y el IK de runtime los sustituye. En Blender el viewport de
   `SprintFwd`/`StrafeLeft` no muestra una pose de arma creíble. No afecta al
   runtime, sí al juicio visual y a cualquier export sin IK.

## P0 técnico

1. **`OperatorVisual` sigue siendo el archivo más grande** (1331 líneas).
   Candidatos de extracción ya identificados y ordenados en
   `docs/ARCHITECTURE.md` → no partirlo a lo bruto.

Resuelto: audio con dueño y suite (`CombatAudio.SAMPLES` + caché, buses
`SFX`/`UI` gobernados por `SettingsStore`, contrato en `tests/smoke.gd`):
rutas dispersas centralizadas y el ajuste SFX ya afecta al feedback de UI.

Resuelto: la tabla de módulos del armario vive solo en
`CosmeticCatalog.SLOT_MODULES` (incluye los módulos sin prenda publicada,
que `OperatorVisual` necesita poder ocultar).

## Harness

Cierre del traspaso de auditoría (2026-09-09,
[harness/ARCHITECTURE_HANDOFF.md](../harness/ARCHITECTURE_HANDOFF.md)): el router
JIT ahora usa el lifecycle real de Cordis (Fiber `await()`/`dispose()`), limpia
montajes parciales cuando un arranque rechaza, libera la entrada al cerrar la
sesión dueña y nombra las tools reales de cada capacidad; `harness/test.sh`
arranca un host Web aislado con los dos presets (`tests/mount.mjs`), el contrato
de logs distingue PASS / FAIL / SIN EVIDENCIA con fixtures, y el report cuenta
compaction por lifecycle real. Verificado con `harness/install.sh` +
`harness/test.sh --self-test` + `harness/test.sh --live` (superficie CREATOR
24 tools contra contrato; BUILD sin sesión clasificable: SIN EVIDENCIA).

Pendiente registrado: resto de A5 (por-header schema drift, cohortes por
preset/ruta), resume de sesión persistida con capacidad activa, concurrencia
`cordis` entre dos sesiones, Blender/MCP real, navegador, Android — SIN
VERIFICAR hasta tener el entorno o las pruebas.

Capa BLOCKFIRE V1 en `harness/` (dos espacios BUILD/CREATOR, superficie mínima,
capacidades JIT, guard de operaciones destructivas, Update Center con stage +
verify + rollback). Contrato y riesgos: `harness/ARCHITECTURE.md`. Verificado
con `harness/test.sh`; una sesión real de BUILD/CREATOR sigue SIN VERIFICAR.

## Siguiente tarea recomendada

Dar brazos creíbles a `SprintFwd`/`StrafeLeft` en Blender (mismo método que la
recarga: IK temporal + bake) para que el source se pueda juzgar sin runtime.
