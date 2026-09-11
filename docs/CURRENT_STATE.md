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

`game/characters/operator_visual.gd` ya no mezcla cadencias: 547 líneas
(contrato + orden del frame + montaje del arma), con el asset en
`character_asset.gd`, la pose en `operator_body.gd` y la ropa en
`operator_wardrobe.gd`. El traslado está probado idéntico por
`tools/probe-refactor-oracle.gd` (`1044286260` antes y después).

`game/ui/hud.gd` bajó de 960 a 851 líneas: los overlays interactivos (AJUSTES
+ editor de controles) y sobre todo **su estado de pausa** viven ahora en
`game/ui/hud_overlays.gd`. Ese estado era lo más fácil de romper del HUD —si se
pierde el snapshot de `input_enabled`, al cerrar el modal el jugador queda
deshabilitado— y estaba repartido en el mismo archivo que el marcador y la
mira. El HUD es la puerta (teclado, botones, suite, QA) y el overlay el dueño.
Probado idéntico con `tools/probe-hud-contract.gd` (firma `1446467736` antes y
después) más la suite y capturas por pantalla.

Queda en `hud.gd` el HUD de combate (marcador, salud, munición, banners) y el
panel de compra/espectador/fin de partida: 851 líneas todavía grandes, pero con
un dueño único cada uno. No hay frontera nueva justificada por medición; el
criterio para abrirla es el mismo (cadencias distintas o estado compartido).

`game/world/arena.gd` (679) y `game/match/match.gd` (538) son grandes pero cada
uno responde a un dueño único (geometría del mundo / reglas de partida); su
tamaño es de contenido, no de fronteras mezcladas.

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

## Herramientas

`tools/audit-repo.mjs` tarda ~0,2 s (antes 39 s: lanzaba ~84 000 `grep` como
subproceso). Se puede ejecutar antes de cada limpieza sin pensarlo.

## Respuesta del personaje — implementación vigente

Cámara: error de rumbo <0.001° a pasos 30/60/120 Hz; colisión inmediata,
sin bombeo. Analog: deadzone radial 0.12 y remap lineal; auto-sprint entra
0.96/sale 0.88, crouch y ADS/fuego ganan. Aceleración vectorial 32 m/s²;
cardinal y diagonal tienen tiempos idénticos, sin overshoot.

Frenada: derivada planar por snapshot físico (>6 m/s²), release/reset explícitos;
capa sólo torso, sin suprimir fase ni escribir ancestros de pies. Prueba pública
30/60/120 y ratios 30:120/120:30: delta añadido de pies/fase 0.000000000.
Oráculo intencional post-frenada `1863296244`. Slide/huella conservados; jitter
idle de frenada manual 0.0037 m (antes 0.0000, contrato sin cambiar <0.02 m).

FOV: Player suaviza la base sin amortiguar el punch aditivo de CameraFX.
Prueba de recuperación hip/ADS a render 30/60/120: mínimos 68.000000/52.000000,
error final 0.000000. No nueva fuente de verdad.

Torso/montaje/IK vertical IMPLEMENTADOS: giro compartido en espacio mundial,
cabeza residual y offsets dentro del alcance del rig. Prueba por defecto:
`tools/probe-aim-coordination.gd`, 20 casos de pitch/arma más strafe/sprint→ADS/
crouch/recarga/disparo. Error angular máximo 0.000000°, error de muñeca máximo
0.009204 mm; pies sin desplazamiento añadido. Capturas desktop inspeccionadas.

Oráculo válido actual: `3900121176`; el fixture ahora construye nodos después
de entrar al árbol. Firmas históricas de `_init` no son comparación fiable.
Los montajes y la pose sí cambiaron intencionalmente.

APK final instalado en SM-S901E; lobby y una pose ADS en partida inspeccionados.
Confort táctil/latencia/multitouch y fluidez sostenida siguen SIN VERIFICAR.
Pendiente: pulido visual de transiciones/extremos, asistencia fuerte al pecho
sin bloquear arrastre a cabeza y presentación de mira/óptica ADS. Continuar
sobre lo implementado; ver `docs/PLAYER_FEEL_AUDIT.md` para pruebas y dueños.
