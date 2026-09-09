# Traspaso a Astra — estado real de BLOCKFIRE

Documento de continuidad. Lo escribió la sesión de **DeepSeek V4.1 Flash**
(commit que lo acompaña). No es marketing: es lo que está hecho, lo que está
verificado y lo que queda, con la evidencia donde está.

## 0. Por qué existe este documento

Astra es un recurso escaso (se agota en pocas horas). Esta sesión hizo el
trabajo largo y repetitivo de dirección visual, integración y verificación en
dispositivo para que Astra gaste su cuota en lo que de verdad se le da mejor y
es más difícil aquí: **modelado/animación de personaje con Blender** y el
acabado visual fino. Todo lo demás ya está cableado y con puertas de calidad
automáticas.

## 1. Qué se hizo en esta sesión (DeepSeek V4.1)

### Personaje
- Sustituido el skin anime temporal por el rig modular **Quaternius Ultimate
  Modular Men (CC0)**: humano adulto de 1,86 m, 22 huesos, 8 clips nativos.
- **Defecto del asset encontrado y reparado en runtime**: los vértices de las
  manos venían rígidos al hueso `Root` (brazos estirados como cuchillas). Se
  reasignan a `Wrist.L/R`, se recorta la mano abierta y se montan **puños
  cerrados** anclados al arma (`operator_visual.gd::_repair_module_weights`).
- **Blender 4.0.2** (instalado con apt): soldado + Catmull-Clark para quitar el
  faceteado, y después **decimación a 47 976 triángulos** porque 456 812
  costaban 31-34 fps en el S901E. La malla en uso es
  `assets/models/skins/operator_adult_lod.glb`; el paso intermedio suave queda
  como `operator_adult_smooth.glb`. Ojo: al decimar hay que **borrar el
  atributo `COLOR_0`** antes del colapso o salen manchas rojas/blancas (los
  colores del pack son de material, no de vértice).
- Sombreado suave, textura de detalle procedural (tela/piel), accesorios
  reposicionados (gorra/boina/gafas/máscara) y mirada de cabeza al punto de
  mira, flinch al recibir daño, absorción de aterrizaje y cambio de arma
  animado.

### Armario (ropa real)
- `CosmeticCatalog` describía módulos que `OperatorVisual` **nunca leía**: el
  armario era ficción. Ahora cada prenda enciende su geometría real por slot
  (top/pantalón/calzado/cabeza), con nombres honestos ("Chaqueta", "Vaqueros",
  "Botas tácticas"…) y migración de los ids antiguos basados en color.

### Armas
- Cuatro categorías correctas: rifle **Mk.18 CQB** y escopeta **Remington 870**
  (CC-BY 4.0, añadidas), pistola **Desert Eagle** (decimada de 459 696 a 14 991
  triángulos) y **MPX SMG**.
- `WEAPON_CONFIG` por arma: longitud real objetivo, pivote de agarre, rotación
  de origen, `grip`/`foregrip`/`muzzle`. Escala derivada del AABB.
- Agarre a dos manos con **IK de dos huesos** apuntando a la palma
  (`ik_error_mano_izq = 0,075 m` = exacto en las cuatro armas).
- Corregida la orientación de pistola y SMG (iban con la culata al frente).

### Cámara, HUD y mundo
- Cámara sobre hombro con colisión, distancia mínima y ocultado del cuerpo
  cuando el entorno la pega; offset propio en ADS; FOV 68/52.
- HUD periférico: vida abajo-izquierda, cargador arriba-derecha, hit marker,
  números de daño, kill feed, RECARGANDO con barra, aviso de cargador bajo,
  viñeta de daño, hit-stop. FUEGO+DRAG, ADS latch, sprint y multitouch
  verificados en el teléfono.
- **Terreno invisible reparado** (winding invertido: el "suelo" era el color de
  cielo del ProceduralSkyMaterial). Ahora hay césped con variación, matas en
  manchas, bosque de horizonte en un solo MultiMesh, caminos de tierra, rocas y
  estación detallada.
- Botones/labels honestos ("ROPA Y EQUIPO", "ARMARIO · ROPA Y ACCESORIOS"),
  fuente de marca Rajdhani (OFL), glow + gradación, splash "TPS ARCADE".

### Bugs de gameplay reparados
- Bots apilados sobre la cabeza del jugador (respawn dentro de otro actor) y
  bots revividos en pose de cadáver.
- HUD mostraba el arma equivocada (señales conectadas después de fijar armas).
- CORRER solo funcionaba con el joystick; Ajustes→CONTINUAR dejaba los
  controles invisibles.
- Foot sliding: la zancada real del rig es 1,32 m/s (Walk) y 2,48 m/s
  (Run_Gun); las velocidades de juego (6,6/9,2) se calibraron a 4,8/7,0 y la
  reproducción se escala a la velocidad real del actor.

### Clips de animación propios (7)
`assets/models/animation_library/{Reload,StrafeLeft,StrafeRight,Land,Flinch,CrouchIdle,CrouchWalk}.glb`
— 22 huesos, 30 fps, una animación por archivo, sin root motion (salvo la
traslación de `Root` en `Land`/agachado). Cableados en `operator_visual.gd`;
los cíclicos con `LOOP_LINEAR`. El agachado dejó de ser `scale.y = 0.72`.

## 2. Estado verificado (no promesas)

- `tools/test.sh` → **PASS (204 checks)**.
- `tools/qa_touch.gd` → **PASS (0 fallos)** (FUEGO+DRAG, ADS latch, multitouch).
- APK construido e **instalado en el SM_S901E**; **0 errores del motor** en
  logcat limpio. Evidencia: `captures/deepseek41/` (baseline, personaje,
  armario, armas, cámara-HUD, final + vídeos).
- Rendimiento medido en dispositivo: **31-34 fps sostenidos** con 8 bots antes
  de esta ronda. Se aplicaron: sombra direccional 2048→1024, distancia 55→45,
  `scaling_3d/scale = 0,85`, personaje 457 k→48 k triángulos, pistola
  460 k→15 k, y el bosque pasó de ~840 draw calls a 1 MultiMesh. **Falta
  volver a medir** (sonda lista: `tools/qa_perf.gd`).

## 3. Lo que queda para Astra (ordenado por valor)

1. **Medir FPS otra vez** con `tools/qa_perf.gd` y decidir si hace falta más
   recorte (candidatos: distancia de sombra, LOD de bots, reducir el bosque).
2. **El personaje sigue siendo estilizado low-poly**. Los dos operadores
   realistas CC-BY 4.0 que se evaluaron (`swat_operator.glb` 1,842 m / 66
   huesos Mixamo, y `fsb_operator.glb` 1,770 m) **se borraron del repo en la
   limpieza** (89 MB sin referencias). Se pueden volver a descargar sin cuenta
   desde el espejo público de Objaverse
   (`https://huggingface.co/datasets/allenai/objaverse/resolve/main/glbs/<bucket>/<uid>.glb`)
   con los uid de Sketchfab:
   swat `9e82fabf26194896b5ad4a364d864eab`,
   fsb `43a561e941704eefb1ab0614be4f0049`
   (autores: Mateusz Woliński / SpatialNeglect, CC-BY 4.0).
   Integrarlos exige:
   - quitar el arma fundida en la malla (son mallas separadas, se pueden
     ocultar por nombre: `Krinkov`, `Magazine`, `Null.001`),
   - retarget de los clips actuales (Mixamo ↔ 22 huesos) o autorar clips nuevos
     para el rig Mixamo,
   - rehacer el armario (esos modelos no tienen ropa modular),
   - neutralizar el parche ruso del FSB si se elige ese.
   **Esto es exactamente el trabajo para Blender + MCP.**
3. **Animaciones de acabado**: los 7 clips son funcionales pero básicos
   (autorados por script). Astra debería revisarlos en vídeo y pulir
   transiciones, sobre todo recarga y strafe.
4. **Densidad de combate del mapa**: hay un diseño de 34 props listo (fuera del
   repo, `/tmp/cover_layout.md`) que no se integró por falta de tiempo y porque
   requiere añadir colliders + verificar que la navegación sigue horneando.
5. **Deuda declarada**: no hay clip de muerte por arma, ni variantes de idle, ni
   animación de salto dedicada (el salto se resuelve recogiendo piernas).

## 4. Reglas de la casa que NO se deben romcar

- La presentación canónica es **TPS sobre el hombro** (ver `PROJECT_RULES.md`).
  No volver a FPS, no reintroducir brazos PSX.
- Nada de assets ripeados de juegos comerciales (incluido Free Fire): solo CC0 o
  CC-BY con atribución en `CREDITS.md`.
- No se escala ni se aplasta la malla para tapar un defecto de asset: se
  reemplaza el asset o se repara la causa.
- Un dueño por sistema (`AGENTS.md`); `SettingsStore` es el único autoload.
- Las herramientas de visión por ráfaga están en `tools/bf-shot.sh` (captura
  bajo demanda) y `tools/bf-frames.sh` (vídeo → rejilla de fotogramas): el
  modelo ve imágenes fijas, no vídeo continuo.
