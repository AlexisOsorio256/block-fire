# ASTRA — uso único: el prompt que más valor saca al recurso

Documento de traspaso. Resume **qué se me complica de verdad**, qué artefactos
hay que darle a Astra y **la prompt exacta** para gastar su único intento en lo
que más mueve la aguja.

---

## 1. Dónde está el techo real (honesto)

| frente | cómo voy | por qué |
|---|---|---|
| Geometría, escala, orientación, colisiones, layout | **Fuerte** | lo verifico con números (bbox, trayectorias, píxeles) y renders estáticos |
| Medición y rendimiento | **Fuerte** | `qa_perf.gd`, triángulos por asset, fps por timestamps |
| Código, refactor, contratos, tests | **Fuerte** | compila + suite en cada edición |
| **Calidad de animación** (peso, anticipación, timing) | **Débil** | mis 7 clips son FK procedural: se leen, pero no tienen *craft* |
| **"Game feel" percibido** (¿se siente bien?) | **Débil** | juzgo fotogramas fijos; el *feel* vive en el tiempo |
| **Dirección visual / ¿esto se ve genérico?** | **Débil** | no tengo criterio estético entrenado ni memoria de referencia |

Astra ve **vídeo continuo**, que es exactamente la dimensión que a mí me falta:
el movimiento a lo largo del tiempo y la coherencia visual de una secuencia.

---

## 2. Artefactos que hay que darle (rutas)

Ya existen:
- `captures/deepseek41/final/bf_pass3.mp4` (26 s de gameplay real, cámara de hombro)
- `captures/deepseek41/android/bf_pass1.mp4`, `bf_pass2.mp4` (Android, más largo)
- `/tmp/fps_test.mp4`, `/tmp/fps2.mp4` (15 s de combate 4v4 con 8 bots, para juzgar ritmo y feel)

Falta generar (1 comando cada uno, no ensucia el repo porque `captures/` está
ignorado por git):
```bash
# Turnaround de cada clip sobre el rig real, 8 s por clip a 30 fps
for c in Reload StrafeLeft StrafeRight Land Flinch CrouchIdle CrouchWalk; do
  blender --background --python tools/make_anim_clips.py -- $c   # ya regenera el glb
done
# (si se quiere vídeo por clip, grabar el visor con bf_char_lab + ffmpeg:
#  tools/bf-frames.sh ya existe para eso)
```

---

## 3. LA PROMPT (copiar/pegar tal cual, un solo intento)

> Eres director de animación y de game feel de un shooter TPS móvil (Godot 4.7,
> renderer Mobile, Android). Te doy vídeo de gameplay real y clips de animación.
> Tu salida va a implementarse **a ciegas por otro agente**, así que debe ser
> precisa y accionable, no opiniones.
>
> Contexto del juego: BLOCKFIRE, TPS 4v4/FFA, personaje de 22 huesos
> (`Root, Body, Hips, Abdomen, Torso, Chest, Neck, Head, Shoulder.L/R,
> UpperArm.L/R, LowerArm.L/R, Wrist.L/R, UpperLeg.L/R, LowerLeg.L/R, Foot.L/R`),
> 30 fps, clips: `Idle, Idle_Gun, Idle_Aim, Idle_Shoot, Walk, Run_Gun,
> Run_Shoot, Death, Reload, StrafeLeft, StrafeRight, Land, Flinch, CrouchIdle,
> CrouchWalk`. El arma se monta en el hueso `Chest` y las manos se colocan con
> IK. Velocidades reales: Walk 1,32 m/s, Run 2,48 m/s.
>
> MIRA LOS VÍDEOS Y DIME, por orden de impacto:
> 1. **Los 5 defectos de animación más graves** (rigidez, patinaje de pies,
>    falta de peso, transiciones que se cortan, poses que no leen). Para cada
>    uno: clip, fotograma/segundo exacto, hueso(s), y el cambio concreto
>    (grados, tiempos, curva de interpolación). Nada de "añadir más fluidez".
> 2. **Los 3 problemas de game feel** que más se notan (retroceso, sacudida de
>    cámara, hit-stop, feedback de impacto, ritmo de la cadencia) con el valor
>    numérico sugerido y dónde aplicarlo.
> 3. **¿El conjunto se ve genérico?** Sé brutal: di exactamente qué elementos
>    (silueta del personaje, armas, mundo, HUD, efectos) delatan que es un
>    asset store genérico, y cuál es el cambio de mayor impacto por esfuerzo.
> 4. **Un ranking final de 5 tareas** ordenadas por (impacto visual ÷ horas de
>    trabajo), cada una con archivo a tocar y criterio de aceptación medible.
>
> Restricciones del proyecto: no se pueden añadir assets de pago; el
> presupuesto es 60 fps en un Galaxy S20 FE; nada de root motion (el
> desplazamiento lo controla el jugador); el personaje debe seguir pesando
> ≤45.000 triángulos.

---

## 4. Qué hacer con la respuesta

1. Cotejar cada punto con lo que ya está hecho (para no repetir): la lista de
   verificación está en `CREDITS.md` y en los mensajes de la sesión.
2. Integrar **solo** lo que traiga número y archivo; descartar lo que sea
   adjetivo sin valor.
3. Verificar cada cambio con captura propia + `tools/test.sh` + `qa_touch`, y
   medir fps con `tools/qa_perf.gd` antes/después.
4. La prioridad 1 de Astra casi seguro caerá en los clips de personaje: ahí el
   pipeline ya está montado (`tools/make_anim_clips.py`, editar `CLIPS[...]` y
   regenerar) y verificado (`tools/qa_anim_lab.gd`).

---

## 5. Estado técnico al cerrar esta sesión (para que Astra no repita trabajo)

- Rendimiento: 31-34 fps sostenidos en combate con 8 bots en el S901E.
  Causa raíz medida: personaje de **456.732 triángulos** (subdivisión) y
  Desert Eagle de **459.696**. `tools/qa_perf.gd` da draw calls/primitivas/fps.
- Decimación: `tools/decimate_assets.py` probada. Desert Eagle 459.696 →
  14.703 sin pérdida visible. Personaje 456.812 → 41.163 (dentro del
  presupuesto) **pero con manchas de color** por los `COLOR_0` del GLB al
  colapsar; 114.244 mantiene el mismo defecto, así que el problema no es el
  ratio. Pendiente: decidir LOD o decimar por módulo.
- Armas PBR: `rifle.glb` (Mk.18, 17.587 tris) y `shotgun.glb` (Remington 870,
  30.700 tris), CC-BY 4.0, orientación y agarre verificados.
- Efectos/game feel hechos: fogonazo con luz+humo (46 px a 3,25 m), casquillo,
  trazadora, impacto con chispas+decal, hit marker, números de daño, kill feed,
  indicador de recarga, viñeta de daño, hit-stop, sacudida de cámara, spread
  acumulado, jitter de audio.
- Bugs cerrados: CORRER independiente del joystick, ajustes→continuar ya no
  oculta los mandos, Desert Eagle y MPX ya no van al revés.
