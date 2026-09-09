# BLOCKFIRE — ESTADO ACTUAL

Único estado operativo del repo. Los `docs/history/*` son históricos: no los
uses para decidir. Mapa de dueños y contratos: `docs/ARCHITECTURE.md`.

## Instantánea

- **HEAD**: `7f695d9` (unifica la tabla de módulos del armario).
- **Modelo de la última sesión**: `GLM-5.3-Flash`.
- **Tests verdes**: `tools/bf test` → smoke 210 checks PASS, animation_layers
  PASS. `tools/bf qa touch` → PASS (13 checks).
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
2. **Audio sin dueño ni suite**: buses en `.tres`, volúmenes en SettingsStore y
   rutas de samples dispersas; cero tests.

Resuelto: la tabla de módulos del armario vive solo en
`CosmeticCatalog.SLOT_MODULES` (incluye los módulos sin prenda publicada,
que `OperatorVisual` necesita poder ocultar).

## Siguiente tarea recomendada

Dar brazos creíbles a `SprintFwd`/`StrafeLeft` en Blender (mismo método que la
recarga: IK temporal + bake) para que el source se pueda juzgar sin runtime.
