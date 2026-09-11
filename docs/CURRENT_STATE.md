# BLOCKFIRE — estado operativo

Solo hechos volátiles útiles para trabajo del juego. Historia en `docs/history/`;
dueños/contratos en `docs/ARCHITECTURE.md`. No contiene estado del harness.

## Verde conocido

- `tools/bf test`: smoke 296 + animation_layers PASS en la última verificación
  de locomoción.
- Foot slide medido walk/sprint/strafe L/R: 0.12 / 0.01 / 0.17 / 0.109 m/s.
- Rifle strafe: socket de apoyo ~0 mm y alineación de cañón 1.0.
- Audio: `CombatAudio` es dueño del catálogo/cache; `SettingsStore` gobierna
  buses SFX/UI.
- Personaje activo: `assets/models/skins/operator_adult_lod.glb`.
- Armas activas: rifle, pistol, shotgun, smg (`game/data/weapons/*.tres`).
- Fuentes de animación: `assets/animation_sources/*.blend`; `ReloadRifle` y
  `ReloadPistol` son `CRAFT_LOCKED`.

## Visual actual

Sprint y strafes fueron pulidos en Blender: inclinación/contrapeso lateral,
agarre de apoyo del rifle y transición de inversión izquierda↔derecha. Piernas,
pies, tiempos y velocidades permanecieron bajo contrato. La mano de apoyo sigue
siendo estilizada y el puño derecho heredado todavía es tosco; no confundir ese
acabado con una regresión de locomoción.

## Pendiente técnico conocido

`game/characters/operator_visual.gd` sigue siendo un archivo grande. No existe
un frente de extracción autorizado por tamaño: solo dividir cuando una frontera
de dueño/bug concreta justifique el cambio y pueda probarse sin alterar pose,
IK, montaje o armario.

## Plataforma

Android físico de los últimos pulidos de animación: `SIN VERIFICAR` si no había
dispositivo conectado. Un build APK no sustituye prueba de dispositivo cuando
la conclusión dependa de Android.
