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

Pasada visual de superficie (capturas propias y de partida, no medición):

- El grano del mundo es UN dueño (`game/world/world_grain.gd`, compartido con el
  lobby) y se escala por superficie (`arena.gd::_fit_grain`). Con `uv1_scale`
  fijo de 3 el texel caía a 8 mm y el mipmap lo promediaba: el grano existía y no
  llegaba a pantalla.
- Ese ajuste era el de las cajas (un lado mayor para los dos ejes). En las mallas
  redondas la UV recorre metros distintos en cada eje: el alero de la estación
  (r 3,35 m) salía con radios de 19 x 3 cm y el dintel de la puerta rayado a lo
  largo. Ahora el cilindro ajusta U por su circunferencia y V por el mayor de
  radio/altura, y la esfera por ecuador y media circunferencia: la roca cercana
  pasa de mancha lisa a piedra a 6 cm (capturas 1:1 antes/después).
- El lobby tenía el mismo material plano y su patio (44x22) cortaba el horizonte
  a cuchillo; ahora lleva el grano compartido, niebla por profundidad (16→58 m) y
  el atrezzo a la derecha del panel, que es translúcido (alfa 0x9c): lo que
  quedaba detrás se leía como rectángulos oscuros dentro del panel.
- Trazadora: la caja de 16 mm es ancho de mundo; a un metro del ojo son ~15 px
  aditivos sobre la mira. El ancho se limita en radianes vistos desde la cámara
  (`CombatFX.TRACER_EYE_WIDTH`), así que sigue siendo una línea de ~4 px.
- Mira: el retículo dibujaba un hueco fijo de 5 px mientras el cono real del
  arma llega a ±3,6° (SMG a tope de calor). Medido en partida con el retículo
  centrado en el pecho (`reticle_deg=0.00`) y el gatillo mantenido: 69/25/9% de
  impactos a 10/20/30 m con SMG y 100/97/78% con rifle; con ADS 100/97/81% y
  100/100/100%. Ahora `WeaponController.current_spread()` es la única fórmula de
  dispersión (la que dispara) y la mira la proyecta a píxeles con el FOV de la
  cámara; el punto central sigue marcando la puntería exacta. Captura con el
  mismo encuadre y gatillo mantenido: hueco 5 → 33 px = cono declarado de la SMG
  (0,0625 rad × 533,7 px/rad a 68° y 720p). Con semilla fija, el patrón de
  impactos de 192 disparos es idéntico antes/después: sólo cambia la mira.
- Los botones AJUSTES/CAMBIAR del HUD crecían hacia el final y se salían del
  borde derecho en 1280x720; ahora crecen hacia el principio.
- Los controles táctiles dibujaban sus círculos y anillos sin antialias mientras
  los iconos ya lo llevaban: sobre el cielo el borde del joystick salía punteado
  y el aro de cada botón, escalonado. Los `draw_circle`/`draw_arc` de
  `mobile_controls.gd` y el punto de `crosshair.gd` pasan `antialiased`.
- Animación: pasada temporal (recarga rifle frontal/lateral, locomoción, combate,
  aire) sin defecto nuevo visible; las limitaciones conocidas siguen siendo las
  de arriba.
- El fogonazo salía al revés: `_emit_muzzle_fx` tomaba el `-Z` del montaje como
  delantero, y el cañón vive en el `+Z` (el marker de boca cuelga a +0,67 m en el
  rifle y +0,15 m en la pistola, medido en partida). El humo nacía detrás de la
  boca y derivaba hacia la cara del tirador, y el casquillo aparecía flotando
  22 cm por delante del cañón. Ahora la luz, el humo y el casquillo salen por
  delante de la boca (capturas 3x antes/después en vista de jugador).
- El mismo marco se colaba por el otro eje: con el cañón en `+Z`, la derecha del
  tirador es `-X`, y el `+X` del montaje es su izquierda (además, girar en
  positivo sobre `+X` baja la boca). Dos sitios del `WeaponController` lo
  trataban como el marco de la cámara: el casquillo salía hacia el lado
  contrario (medido en las cuatro armas: -0,050 m y -1,9 m/s respecto a la
  derecha real del arma) cruzando cuerpo y cara en cada ráfaga, y el ancla de FX
  —la que orienta estrella, humo y luz— giraba contra el cañón visible hasta
  7,73° (escopeta). Ahora sale por la derecha (+0,050 m, +1,6 m/s) y el ancla
  copia el marco visible (0,00°). Evidencia: `tools/probe-muzzle-frame.gd`
  antes/después (11 fallos → 0) y capturas 1:1 del mismo frame de ráfaga con
  bots congelados: antes los casquillos cruzan a la izquierda del personaje,
  después salen por su derecha. El segundo estado de retroceso del arma
  (`recoil_amount`) se borró en el mismo commit: la patada visual tiene un solo
  dueño, el montaje (`motion.recoil`).

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

`tools/qa_shot.gd` captura ADS y fuego también en escritorio: `--ads`, `--fire` y
la recarga se enrutaban solo por `MobileControls`, así que sin la ruta táctil no
pulsaban nada y la vista de apuntado no se podía capturar. Sin móvil ahora pulsa
las acciones reales del InputMap (`fire`, `aim`, `reload`), que es lo que el
jugador lee.

`tools/probe_teardown.gd` (compartido): pausa el árbol, para todo
`AudioStreamPlayer(3D)` y deja drenar al servidor de audio antes de `quit()`.
Sin él, qa_touch (52/8), probe-reload-hand (58/6) y a veces
probe-aim-coordination (10-14/4-6) reportaban fugas de audio al salir que
tapaban una fuga real. Los cuatro salen limpios.

`tools/probe-reload-hand.gd` es determinista desde entonces (delta fijo 1/60 y
fase sostenida): rifle 0.364/0.409 m, pistola 0.197/0.218 m, idénticos entre
corridas. Las cifras anteriores (0.266/0.290 y 0.157/0.187) venían del fixture
con pacing de frames y quedan superadas.

Los fixtures de los probes no son el runtime. Formas conocidas de mentir, todas
vistas en esta sesión: audio pendiente al salir, sacudida de `CameraFX` girando
la cámara entre ticks, focus-out que limpia el input de combate, un bot muerto
que sale en silencio de la selección de objetivo, un nodo fuera del árbol que
ignora `global_position`, y un muro creado dentro del jugador que lo empuja.

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

Oráculo válido actual: `1135775949` (antes `3900121176`); el fixture ahora
construye nodos después de entrar al árbol. Firmas históricas de `_init` no son
comparación fiable. Los montajes y la pose sí cambiaron intencionalmente.

Disparo y asistencia (implementado y verificado): la boca converge al primer
obstáculo que cubre la mira y sigue trazando todo el segmento desde el cañón
(la cobertura bloquea igual); `CONVERGENCE_BACKSTOP` 0.02 m evita el impacto al
borde numérico del rayo. La asistencia rotacional es agarre sobre el arrastre
propio (35% sobre el torso, 0 sin pulgar, nada en un flick) y la ayuda de
dirección no dobla un disparo cuyo retículo ya cubre el objetivo. Prueba por
defecto nueva: `tools/probe-aim-assist.gd` (18 fallos antes, 0 después; 8/8
headshots y 8/8 impactos al pecho a 3.5/10/25 m). Velocidades, slide, huella y
FOV sin cambios.

Volumen de cabeza corregido: el hitbox heredado (2.16 m en pie/1.55 agachado)
flotaba sobre la malla (medido: hueso Head a 1.55 m, corona ~1.92; agachado
1.27/1.63), así que apuntar a la cabeza visible registraba pecho y el headshot
sólo existía en el aire sobre la cabeza. Ahora el centro es 1.74/1.45, la
esfera vive DENTRO de la cápsula y `WeaponController` consulta la capa de
cabeza (4) cuando el cuerpo gana el trazo, con el punto de impacto real en la
esfera. Los bots apuntan al centro de masa (1.35/1.05) para no regalar el
multiplicador. Mismo fixture que antes (`aim_head` lee el hitbox en vez de
copiar 2.16): apuntando a la cabeza visible pasó de 0/8 headshots (3 fallos) a
8/8 a 3.5/10/25 m; captura 1:1 antes/después del mismo disparo muestra 18
blanco→23 amarillo. Suite smoke 311, regresiones 29, animation_layers, player
feel, brake, aim coordination y aim assist PASS; baselines de pies/FOV/oráculo
sin tocar.

Montaje de armas corregido: la pistola se sujetaba a 8.2 cm de la mano y la SMG
a 4.9 cm (ahora 0.010/0.017 m, como rifle 0.016 y escopeta 0.015), los cuatro
marcadores de boca estaban 0.10-0.23 m dentro del cañón (ahora 0.022-0.027 m
dentro de la corona) y la SMG estaba girada 180° (culata delante): se monta con
`asset_rot` (0, 180, 0). Lo que lo zanjó fue renderizar cada arma montada con
los ejes del montaje dibujados; el chequeo del basis del montaje y las
heurísticas de masa pasaban con el arma al revés. Alineación de cañón, muñecas (máx 0.0055 mm) y recorrido
de recarga (rifle 0.365/0.410 m, pistola 0.197/0.218 m) intactos.

APK final instalado en SM-S901E: lobby, partida FFA en vivo, ADS, disparo y
cambio de arma verificados; logcat sin errores ni avisos de Godot; capturas en
`captures/aim-assist/`. Confort táctil/latencia/multitouch y fluidez sostenida
siguen SIN VERIFICAR.

Pendiente: presentación de mira/óptica ADS (el cañón es paralelo al eje de
cámara a propósito: se proyecta al centro de pantalla; una mira real pide pose
a altura de ojo), inspección visual de transiciones (sólo hay invariantes
numéricos) y posible ajuste de letalidad de bots tras la convergencia. Continuar
sobre lo implementado; ver `docs/PLAYER_FEEL_AUDIT.md` para pruebas y dueños.
