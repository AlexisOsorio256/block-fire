# BLOCKFIRE — ESTADO ACTUAL

Único estado operativo del repo. Los `docs/history/*` son históricos: no los
uses para decidir. Mapa de dueños y contratos: `docs/ARCHITECTURE.md`.

## Instantánea

- **HEAD**: `0633ac6` (base de sesión; el P0 visual de locomoción se cierra en este árbol).
- **Modelo de la última sesión**: `muse-spark`.
- **Tests verdes**: `tools/bf test` → smoke 296 checks PASS, animation_layers
  PASS (pie deslizante walk 0.16 · sprint 0.01 · strafe 0.01 m/s, presupuestos
  0.40 / 1.20 / 0.55). `tools/bf qa touch` → PASS. `tools/bf build android` →
  APK debug firmado OK (84 M). IK de brazos idéntico a base (`probe-ik-quality`:
  rifle STRAFE 54.8/118.1/4.6/0.829/0.075, clavado).
- **Tests rojos**: ninguno.
- **Android en dispositivo**: SIN VERIFICAR (sin teléfono conectado; APK construido, no instalado).
- **Personaje activo**: `assets/models/skins/operator_adult_lod.glb`.
- **Armas activas**: `rifle`, `pistol`, `shotgun`, `smg`
  (`game/data/weapons/*.tres`).
- **Autoridad de animación**: `assets/animation_sources/<Clip>.blend`
  (Blender). `ReloadRifle` y `ReloadPistol` son `CRAFT_LOCKED`: `--rebuild`
  se niega a regenerarlos.

## P0 visual

En la base `4be6d19`, `SprintFwd`/`StrafeLeft` recibieron brazos de rifle en sus
fuentes Blender sin depender del IK de runtime (horneado IK-temporal en
`tools/bake_locomotion_arms.py`: solo `UpperArm`/`LowerArm`, hombros/muñecas y
piernas intactos; bucle 0.0, velocidades 7.01/4.79 m/s, reach <1). Runtime con
IK de aquella entrega pixel-idéntico a su base (diff medio 0.02/255). `ReloadRifle`/`ReloadPistol`
(CRAFT_LOCKED) intactos. Verificación: `qa_anim_lab` sin IK (brazos al frente,
manos juntas) + `qa_motion` con IK + `probe-noik-hold`.

Pulido posterior sobre `4be6d19`: sprint demasiado erguido en runtime.
`SprintFwd.blend` ajustado en Blender interactivo: abdomen +12°, cuello −10°,
contrarrotación de brazos para conservar la orientación de agarre. Solo cambian
las rotaciones de esos cuatro huesos; las demás curvas, piernas y tiempos son
idénticos a la base. Export y reimport Godot ejecutados. Comparación visual de
`qa motion --mode=locomotion --duration=8` antes/después (incluidas transiciones
walk→sprint→strafe) y `qa anim` lateral sin IK: inclinación más legible, mirada
al frente. El laboratorio actualiza el montaje tras cada seek y deja de mostrar
el arma en los pies. Capturas runtime: `captures/anim-polish/`.
`tools/bf test`: 296 checks + animation_layers PASS; foot slide 0.16/0.01/0.01
m/s. `tools/bf qa reload`: PASS, aunque el probe avisa de recursos vivos al
salir. Pendiente visual: manos de apoyo toscas y rigidez del strafe.
Android de este pulido: SIN VERIFICAR (sesión limitada a animación en Linux).

Pulido de apoyo/strafe sobre `9f9818e`: mano izquierda del rifle en el
guardamanos con palma cóncava y socket de muñeca explícito; contacto palma a
superficie medida 78.364→2.033 mm. Ajustados montaje/ADS para alcance del rig.
Ambos strafes tienen inclinación lateral y contrapeso en fuentes Blender;
piernas/pies/tiempos idénticos y bucles 0.0. Corregido en OperatorMotion el
bloqueo de interpolación al invertir exactamente izquierda→derecha.
Final: `tools/bf test` PASS (296 smoke + animation_layers); foot slide
walk/sprint/left/right 0.12/0.01/0.17/0.109 m/s; socket strafe ~0 mm y
alineación del arma 1.0. Capturas comparadas e inversión final inspeccionadas
en `captures/support-strafe/`; receta y medidas en `ANIMATION_HANDOFF.md`.
Sigue siendo una mano estilizada; puño derecho heredado tosco. Sin Android.

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

Sesión 2026-09-09 (noche): contexto permanente reducido con evidencia —
`AGENTS.md` 4.0k→1.9k chars (tabla de dueños fuera, duplica `docs/ARCHITECTURE.md`;
arranque = doctor + git + código, no lectura de documentos), persona BUILD
recortada, skill `blockfire-orientation` eliminada (costaba 2.8k chars en el
step 1 e inducía ~16k chars de lecturas de documentos en el step 2) y
`blockfire-harness` movida a CREATOR. BUILD queda en 4 skills; primer request
medido 7345→6857 tokens con el mismo catálogo de 18 tools. Superficie Web nueva
(sin tocar upstream): stats de sesión en vivo junto a la actividad (bajo
"Deep diving", encima del dock de To-Do), botón `+ New` en el pie del sidebar,
y borrado permanente de conversaciones (`POST /blockfire/session/delete` +
slots de header) — verificado E2E en navegador aislado; el strip que DSH monta
debajo del composer queda anulado. Verificación: `harness/test.sh` PASS (17
tests de plugins, incluidos 3 nuevos del borrado), `tests/visual-boot.mjs` +
CDP para la pieza visual. El proceso Web vivo requiere reinicio para cargar la
ruta de borrado; el cliente se recarga con F5.

Cierre del traspaso de auditoría (2026-09-09,
[docs/history/HANDOFF-AUDIT-ASTRA.md](history/HANDOFF-AUDIT-ASTRA.md)): el router
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

P0 técnico pendiente (`OperatorVisual`, 1331 líneas): partir por los candidatos
de extracción ordenados en `docs/ARCHITECTURE.md`, no a lo bruto.
