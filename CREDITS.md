# CREDITS — atribuciones obligatorias

Licencias de los assets incluidos en el repo. **Esta atribución es requisito
legal de las licencias: borrarla sin reemplazar los assets es una violación.**

## Sonidos de disparo — CC-BY 3.0 (atribución obligatoria)

`assets/sfx/gshot_rifle.ogg`, `assets/sfx/gshot_pistol.ogg`,
`assets/sfx/gshot_shotgun.ogg`

- **Autor**: Jesús Lastra
- **Fuente**: Sonniss.com — Game Audio GDL ("Gun Sounds Pack")
- **Licencia**: Creative Commons Attribution 3.0 (CC-BY 3.0)
- **Requisito**: atribución visible dentro del juego (presente de forma
  discreta en el lobby de Godot y en Ajustes → Legal). Si estos samples se
  reemplazan por propios/CC0, este bloque y su mención pueden retirarse.

## Texturas del mapa — CC0

`assets/textures/ground.png`, `wall.png`, `cover.png`, `platform.png`

- **Fuente**: Kenney (kenney.nl), pack de texturas genéricas
- **Licencia**: CC0 1.0 (dominio público, sin atribución requerida —
  se registra como cortesía)

## Fuente de rig y animaciones — Universal Animation Library (CC0)

`assets/models/animation_library/UAL1_Standard.glb`,
`UAL2_Standard.glb` y `Mannequin_F.glb`

- **Autor**: Quaternius
- **Fuente**: [Universal Animation Library](https://quaternius.com/packs/universalanimationlibrary.html) y
  [Universal Animation Library 2](https://quaternius.com/packs/universalanimationlibrary2.html)
- **Licencia**: Creative Commons Zero (CC0) 1.0; copia local en
  `assets/models/animation_library/LICENSE-QUATERNIUS-UAL.txt`
- La biblioteca se usa como fuente técnica de rig/animaciones. El maniquí
  desnudo no es la skin final y no debe presentarse como personaje jugable;
  la ropa y el modelo visual se incorporarán con un asset compatible que el
  usuario seleccione.

## Tipografía de interfaz — Rajdhani (OFL 1.1)

`assets/fonts/Rajdhani-SemiBold.ttf`, `assets/fonts/Rajdhani-Bold.ttf`

- **Autor**: Indian Type Foundry
- **Fuente**: Google Fonts — [Rajdhani](https://fonts.google.com/specimen/Rajdhani)
- **Licencia**: SIL Open Font License 1.1 (copia local en
  `assets/fonts/OFL-Rajdhani.txt`). Permite uso comercial y redistribución
  manteniendo la licencia y sin vender la fuente por sí sola.

## Malla jugable derivada del pack modular (CC0 → CC0)

`assets/models/skins/operator_adult_smooth.glb` (soldada + subdividida) y
`assets/models/skins/operator_adult_lod.glb` (**la que usa el juego**, misma
malla decimada a ~48 k triángulos para rendimiento móvil)

- **Origen**: derivada de `assets/models/quaternius_modular/avatar_rig.gltf`
  (Quaternius, CC0) con `tools/blender-smooth-character.py`: soldado de
  vértices + subdivisión Catmull-Clark nivel 1 en Blender 4.0.2.
- **Licencia**: CC0 1.0, igual que el original (no añade condiciones).
- Conserva los 22 huesos y los 8 clips originales. El asset original sigue en
  el repo sin modificar. Pipeline reproducible en
  `tools/blender-smooth-character.py` (soldar + Catmull-Clark) y decimación
  documentada en `captures/deepseek41/SESSION.md` (medición: 457 k triángulos
  costaban 31-34 fps en SM_S901E; 48 k devuelven el frame time).

## Avatar modular retirado — Quaternius Ultimate Modular Men (CC0)

`assets/models/quaternius_modular/avatar_rig.gltf` + `avatar_rig.bin`
(rig fusionado de 11 personajes: Swat, Casual, Worker, Suit, Punk, Farmer,
SpaceSuit, King, Beach, Adventurer, Casual2; 8 animaciones)

- **Fuente**: Quaternius, [Ultimate Modular Men Pack](https://quaternius.com/packs/ultimatemodularcharacters.html)
- **Licencia**: Creative Commons Zero (CC0) 1.0; copia local en
  `assets/models/quaternius_modular/LICENSE-QUATERNIUS-UMC.txt`
- **Sí es la base de la malla jugable**: `operator_adult_smooth.glb` y
  `operator_adult_lod.glb` derivan de este rig (soldado, subdividido y
  decimado). Se conserva como fuente original del pack.

## Clips de animación propios — derivados del rig CC0

`assets/models/animation_library/{Reload,StrafeLeft,StrafeRight,Land,Flinch,CrouchIdle,CrouchWalk}.glb`

- **Autoría**: generados para BLOCKFIRE con `tools/make_anim_clips.py` (Blender
  4.0.2, API Python) sobre el rig de 22 huesos de
  `assets/models/skins/operator_adult_smooth.glb`, derivado a su vez del pack
  Quaternius CC0.
- **Licencia**: CC0 1.0, igual que el rig de origen; sin condiciones añadidas.
- Cada archivo contiene **una sola animación** con el nombre exacto del clip,
  30 fps, rotación local por hueso (cuaternión) y sin root motion salvo la
  traslación del hueso `Root` en `Land` y los clips de agachado.
- Los cuatro cíclicos (`StrafeLeft`, `StrafeRight`, `CrouchIdle`, `CrouchWalk`)
  están autorados con el último frame idéntico al primero; el bucle hay que
  activarlo al cargarlos (`Animation.LOOP_LINEAR`), porque glTF no lo lleva.

## Armas PBR de integración — Sketchfab (CC-BY 4.0)

`assets/models/weapons/real/desert_eagle.glb`,
`assets/models/weapons/real/mpx_smg.glb`

- **Desert Eagle**: autor attix84work — [fuente Sketchfab](https://sketchfab.com/3d-models/desert-eagle-gun-1605b6c38826433fb3fe564e1d043199)
- **MPX SMG**: autor nebula075 — [MPX](https://sketchfab.com/3d-models/mpx-smg-238fa4b18f1247e99231529f98d11a61)
- **Type-64 SMG**: retirada del repo (se usaba como rifle, categoría incorrecta; el rifle es ahora el Mk.18 CQB). Atribución conservada por si se vuelve a incorporar: autor nebula075 — [Type-64](https://sketchfab.com/3d-models/type-64-smg-b3651411f81243f3b37ca93322c67ae9)
- **Licencia**: Creative Commons Attribution 4.0 International (CC-BY 4.0)
- Se importan como armas reales de integración, con escala/orientación
  específica por exportador. Antes de declararlas finales hay que validar
  agarre, muzzle y disparo en Android; la atribución no se elimina al cambiar
  de skin o de montaje.

### Rifle y escopeta PBR añadidos (2026-09-08)

`assets/models/weapons/real/rifle.glb` y
`assets/models/weapons/real/shotgun.glb` (texturas PBR 1024×1024 embebidas en
cada GLB; el importador de Godot genera las copias extraídas `rifle_*.png` y
`shotgun_*`, igual que con las tres armas anteriores)

- **Mk.18 CQB (rifle)**: autor moog! — [fuente Sketchfab](https://sketchfab.com/3d-models/mk18-cqb-75f6b0a09db247d9ae174f5513831a41)
- **Remington 870 (escopeta)**: autor Jazavac — [fuente Sketchfab](https://sketchfab.com/3d-models/remington-870-d7cd704167ee4ed8a3b266bfd2db6623)
- **Licencia**: Creative Commons Attribution 4.0 International (CC-BY 4.0)
- Se descargan sin cuenta desde el espejo público del dataset Objaverse
  (allenai/objaverse); el fichero es el GLB original de Sketchfab y
  autoría/licencia se verifican en la ficha pública de cada modelo.
- Orientación de origen: `rifle.glb` tiene la longitud sobre +Z (1,397 u) con
  la boca en +Z; `shotgun.glb` sobre +X (1 281 u, en milímetros) con la boca
  en +X. La escala se normaliza por dimensión mayor en `operator_visual.gd`,
  así que el ajuste pendiente es solo `asset_rot` por arma.

## Referencias visuales internas proporcionadas por el usuario

`docs/reference/character-visual-reference.png` y
`docs/reference/tps-gameplay-reference.png` son capturas aportadas por el
usuario para fijar encuadre, densidad y tono. El origen/licencia de esas
capturas no se ha verificado; se conservan sólo como documentación de
dirección y no se cargan en el juego ni se redistribuyen como assets jugables.

## Audio restante — CC0

`assets/sfx/` (hit, headshot, kill, hurt, death, impact, ui, steps, reload,
switch, jump, empty, respawn, kill_banner): diseñados para el proyecto /
aportados por el equipo, sin restricciones conocidas.

## Armas PBR decimadas (CC-BY 4.0, misma autoría que el original)

`assets/models/weapons/real/desert_eagle_dec.glb`

- **Autoría/licencia**: idénticas al `desert_eagle.glb` original (attix84work,
  CC-BY 4.0) — es la misma obra reducida de 459 696 a 14 991 triángulos para
  móvil, sin cambio visual apreciable a distancia de juego.
- El original se conserva para comparación A/B.
