# BLOCKFIRE — estado operativo

Solo hechos volátiles útiles para trabajo del juego. Dueños/contratos en
`docs/ARCHITECTURE.md`. No contiene estado del harness. El historial de sesiones
vive en git (`git log`), no en documentos: un traspaso viejo se lee como estado
vigente y desinforma.

## Verde conocido

- `tools/bf test`: smoke 310 + regressions 29 + animation_layers PASS en la
  última verificación de locomoción y de arranque de partida.
- Foot slide medido walk/sprint/strafe L/R: 0.01 / 0.13 / 0.01 / 0.005 m/s.
- Huella del apoyo (paso fijo, `tools/probe-loco-axes.gd`): cardinales 0.000 m,
  diagonal 4.8 0.078 m, oblicuo 30° 0.065 m, crouch diagonal 0.051 m; en el
  barrido de rumbos la deriva sobre el eje queda ≤ 0.028 m.
- El reloj de fase proyecta el retroceso de cada clip sobre el rumbo
  (`|eje·rumbo|`); promediar magnitudes escalares descalibraba las diagonales
  (deriva 0.142 m y ~2 m/s de patinaje por apoyo) con los cardinales perfectos.
- Rifle strafe: socket de apoyo ~0 mm y alineación de cañón 1.0.
- Audio: `CombatAudio` es dueño del catálogo/cache; `SettingsStore` gobierna
  buses SFX/UI.
- Armas: cada GLB carga con geometría y llega al montaje de la mano
  (`tools/probe-weapon-load.gd`). La metadata de import de un GLB importa: si
  Godot no extrae sus texturas, el arma carga con 0 superficies.
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

`game/characters/operator_visual.gd` sigue siendo un archivo grande (1 385
líneas): modelo/malla, armario, accesorios, montaje de arma e IK en un solo
dueño. No existe un frente de extracción autorizado por tamaño: solo dividir
cuando una frontera de dueño/bug concreta justifique el cambio y pueda probarse
sin alterar pose, IK, montaje o armario.

Coste de construcción del personaje ya medido y cacheado: ver "Presupuesto de
arranque de partida" en `docs/ARCHITECTURE.md` (9 actores: 15 505 → 1 611 ms).

## Plataforma

Android físico de los últimos pulidos de animación: `SIN VERIFICAR` si no había
dispositivo conectado. Un build APK no sustituye prueba de dispositivo cuando
la conclusión dependa de Android.

El presupuesto de arranque de partida está medido en sobremesa (headless). Su
equivalente en dispositivo está `SIN VERIFICAR`: el cambio reduce operaciones
(texturas y cirugía de malla por actor) pero el reparto exacto en móvil no se ha
cronometrado.
