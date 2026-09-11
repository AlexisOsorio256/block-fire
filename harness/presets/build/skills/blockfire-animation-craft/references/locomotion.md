# Locomoción TPS: receta de trabajo

Ejecuta desde la raíz del proyecto. Comprueba `git status -sb` y usa
`tools/bf doctor` cuando necesites resolver Godot/Blender. Conserva cambios ajenos.
La referencia de producto orienta; no declares equivalencia con Free Fire sin
una comparación de movimiento observable.

## Capturar y mirar

```bash
tools/bf qa motion --mode=locomotion --view=q34 --duration=16 --out=/tmp/bf-before
```

Produce 480 PNG a tiempo simulado fijo de 30 Hz; la ejecución puede tardar más
que 16 segundos. Si bash entrega un job, continúa leyendo al dueño del código y
consulta `job_output` al necesitar el resultado. No relances el QA porque tarde.

Límite conocido (medido): `qa_motion.gd` traduce al actor con un paso fijo de
1/30 s, pero deja que el reloj de locomoción avance con el delta REAL del
fotograma, así que con la máquina ocupada la cadencia renderizada no es la
simulada (medido: 0.28 ciclos/s en diagonal mientras el mismo estado da 3.26
ciclos/s en un sondeo a paso fijo). Sirve para mirar pose, mezcla, montaje e IK;
no para juzgar cadencia, patinaje ni fase. Esos juicios van por
`tools/probe-loco-axes.gd` (paso fijo, métrica de huella del apoyo).

La secuencia avanza por walk, sprint, strafe L, strafe R, diagonal, back,
crouch fwd y crouch lateral: dos segundos por tramo. Mira con `read_image`
varias fases del ciclo y frames alrededor de 60, 120, 180, 240 y 360;
por ejemplo N-1, N, N+1, N+3, N+6. No basta comparar una pose favorecedora.

Para hacer una rejilla sin inventar una herramienta nueva, si ImageMagick está
disponible:

```bash
montage /tmp/bf-before/frame_0179.png /tmp/bf-before/frame_0180.png \
  /tmp/bf-before/frame_0181.png /tmp/bf-before/frame_0183.png \
  /tmp/bf-before/frame_0186.png /tmp/bf-before/frame_0192.png \
  -thumbnail 480x270 -tile 3x2 -geometry +2+2 /tmp/bf-before-turn.png
```

Abre la rejilla con `read_image`. Para observar manos/pies abre además PNG
individuales; una miniatura puede ocultar defectos. Guarda el después en otro
directorio y compara mismos frames, arma, cámara, velocidad y duración. Si
cambias el reloj de fase, registra esa diferencia: mismo frame ya no significa
misma fase del ciclo. Los clips quietos no prueban continuidad.

## No confundir laboratorio y gameplay

`qa_motion.gd` usa el visual real, clips, montaje e IK, pero activa
`debug_manual_state`: escribe intención y velocidad directamente. No prueba
input → Player → set_combat_state → _read_motion_inputs. Si el fallo aparece
jugando, recorre ese camino público y prueba el contrato afectado; no concluyas
que gameplay está bien porque el laboratorio se ve bien.

`--mode=sequence --view=back --duration=16` añade idle, arranque, parada,
crouch/stand y combate. Su tramo crouch diagonal usa componentes 2.6/2.6:
magnitud ~3.68 m/s aunque la etiqueta diga 2.6. Usa el modo locomotion para
comparar crouch cardinal a 2.6; no recalibres clips a partir de esa etiqueta.

La cámara sigue al actor y el checkerboard expone sliding. La suavidad percibida
en dispositivo, input táctil y FPS reales necesitan su propia ejecución; el
muestreo fijo no los demuestra.

## Cambiar al dueño y verificar

Si corriges mezcla/input no exportes clips. Si editas `.blend`, guarda y exporta
solo los clips autorizados con `tools/bf blender <Clip>`. Después resuelve la
ruta real de Godot con doctor y ejecuta ese binario:

```bash
"$BLOCKFIRE_GODOT" --headless --editor --path . --import
```

Este comando presupone `BLOCKFIRE_GODOT` definido con la ruta que doctor mostró.
Espera a que termine y confirma que reimportó el GLB actualizado sin errores.
Si lo omite por caché, invalida solo el cache importado de ese GLB y repite;
no edites configuraciones `.import` ni borres todo `.godot` por costumbre.

Repite el QA anterior con `--out=/tmp/bf-after`. Para locomoción/capas usa
`tools/bf test`: cubre selección pública de sprint, continuidad crouch/ADS,
foot slide cardinal, montaje e IK. Para investigar un fallo específico están
`tools/bf qa slide --speed=7 --sprint`, `tools/bf qa ik` y `tools/bf qa reload`.
No ejecutes todas esas pruebas si la suite ya resolvió la cuestión.

Los tests cardinales no certifican sliding diagonal ni cada inversión brusca.
No cambies velocidades para hacer pasar la animación. Cierra con defecto,
cambio, evidencia mirada, pruebas ejecutadas, límites y SHA si hubo commit.
Cierra los procesos iniciados por la tarea; conserva evidencia útil.

## Parada y arranque: quien manda en el apoyo

Una parada no necesita "un clip de parada" y ya. Medido en este proyecto, al
soltar el stick fallaban tres cosas a la vez, cada una con su dueño:

1. El ciclo de piernas seguía girando a velocidad plena mientras el cuerpo
   frenaba: el pie plantado se arrastra contra el suelo a la velocidad del
   cuerpo. Dueño: el reloj de fase (se apaga con la frenada).
2. La marcha se desvanecía hacia el idle en 0.18 s con el pie apoyado: 2.5 m/s
   de derrape. Dueño: la salida de `_move_weight` a baja velocidad (0.05 s).
3. La fase se congelaba a mitad de zancada: un pie plantado y otro colgando,
   quietos, que se lee como maniquí. Dueño: la fase (asienta en un contacto).

Regla que salió de ahí: **un clip de absorción no recoloca los pies**. La primera
versión del clip de frenada daba un paso adelante y arrastraba el apoyo 0.37 m
hacia la postura neutra antes de que el paso desapareciera — peor que el
defecto. El que decide dónde está el apoyo es el ciclo de locomoción que está
saliendo; el clip de frenada sólo manda centro de masas, columna y brazos, y por
eso su máscara excluye las piernas.

Al medir una parada, no midas la ventana de transición: ahí el apoyo cambia de
pie y cualquier métrica de anclaje mide el cambio, no un defecto. Mide el
asentamiento (fase en un contacto, pie apoyado, sin jitter residual).

## Assets: una textura junto a un GLB no se juzga por grep

Al limpiar, `rifle.glb` carga sus texturas por ruta **externa** (`rifle_0.png`
…), aunque el GLB las embeba: el `.import` de Godot las resuelve al importar y
un borrado "probado por grep" rompió el showcase. El smoke test lo cazó; el
auditor no. Regla: para binarios (`.glb`, `.bin`, `.ttf`, `.blend`) se puede
afirmar que nada los referencia; para texturas y audio, no — se comprueba
borrando una copia, reimportando y corriendo `tools/bf test`. El auditor de
`tools/audit-repo.mjs` aplica esa distinción y avisa de cuántos no juzga.

## Medir dirección antes de tocar el reloj

```bash
"$BLOCKFIRE_GODOT" --path . --script res://tools/probe-loco-axes.gd -- --weapon=rifle --sweep
```

Sondeo a paso fijo de 60 Hz con el visual real: por cada rumbo imprime la huella
del apoyo (cuánto se aleja el pie del punto donde aterrizó) y la deriva sobre el
rumbo. Cardinal y diagonal deben quedar en pocos centímetros; una deriva
monótona de más de ~0.1 m delata reloj descalibrado, no una pose fea. Sirve para
cardinales, diagonales, barrido de rumbos, crouch y la inversión lateral
(`reversal`), y `tools/probe-axis-pop.gd` separa salto de pose de cadencia alta
en un cruce de eje.

Regla causal que salió de ahí: el reloj avanza `velocidad / zancada`, y en una
mezcla la zancada es la proyección del retroceso de cada clip sobre el rumbo
(`|eje·rumbo|` por clip). Promediar magnitudes escalares supone que cada clip
avanza por el rumbo, y en diagonal eso acorta el paso: el apoyo derivaba 0.142 m
por apoyo (≈2 m/s) con cardinales perfectos. Al proyectar, 0.002 m. Si el
síntoma aparece sólo en diagonales, sospecha del reloj antes del clip; el
laboratorio con `debug_manual_state` reproduce ese caso sin input.
