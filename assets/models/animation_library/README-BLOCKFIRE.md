# BLOCKFIRE — fuente de animación UAL

Estos GLB son una **fuente de rig y animaciones**, no el arte final del
personaje. Los archivos vienen de Universal Animation Library de Quaternius y
están publicados bajo CC0 1.0; la atribución completa está en
`CREDITS.md` y en `LICENSE-QUATERNIUS-UAL.txt`.

## Qué se integra

- `UAL1_Standard.glb`: biblioteca principal de 43 clips. Es la fuente para
  locomoción y combate de BLOCKFIRE: `Idle`, `Walk`, `Jog_Fwd`, `Sprint`,
  `Pistol_Aim_*`, `Pistol_Shoot`, `Pistol_Reload`, `Jump*` y `Death01`.
- `UAL2_Standard.glb`: segunda biblioteca de 43 clips para gestos, melee y
  estados adicionales (`Idle_FoldArms`, `Melee_Hook`, `Slide`, etc.). Se
  conserva como ampliación, no como locomoción base.
- `Mannequin_F.glb`: maniquí femenino desnudo para comprobar proporciones y
  compatibilidad del rig. No se carga como skin jugable.

Se usa la variante sin sufijo `_RM`: el jugador ya se mueve por código y no
debe duplicar el desplazamiento con root motion. Las variantes `_RM` quedan
en los ZIP originales de Descargas como referencia, no se copian al runtime.

## Contrato de la skin retargetable

La ropa/personaje que se incorpore debe llegar como GLB/FBX que Godot pueda
importar a glTF, con un `Skeleton3D` humano y estos nombres de hueso de la UAL
(`root`, `pelvis`, `spine_01..03`, `neck_01`, `Head`, brazos, manos y piernas
con sufijos `_l`/`_r`). La skin debe estar skineada al mismo rig; no se debe
deformar con escalas o huesos nuevos sin retarget explícito. La skin técnica
actual es `assets/models/skins/rigged_anime_japanese_high_school_boy.glb`: su
armature Blender de 413 huesos se remapea en
`game/characters/operator_visual.gd` y conserva los nombres de bind del Skin
antes de renombrar los huesos.

El adaptador conserva el `Skeleton3D` y `AnimationPlayer` de la skin, instala
una biblioteca `ual` con los clips retargeteados y deja el arma en un
`BoneAttachment3D` de `hand_r`. Los GLB de esta carpeta siguen siendo fuente
de animación; no se instancian como maniquí visible en lobby o partida.
