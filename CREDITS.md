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

## Skin rigged de integración — Sketchfab (CC-BY 4.0)

`assets/models/skins/rigged_anime_japanese_high_school_boy.glb`

- **Autor**: suzuart
- **Fuente**: [Rigged Anime Japanese High School Boy](https://sketchfab.com/3d-models/rigged-anime-japanese-high-school-boy-845df0101cd5429e86b190be757d1365)
- **Licencia**: Creative Commons Attribution 4.0 International
  ([CC-BY 4.0](https://creativecommons.org/licenses/by/4.0/))
- Se usa como **skin técnica temporal** para validar el retarget de UAL1/UAL2
  sobre un armature real de 413 huesos. Su estética anime no fija la dirección
  visual final de BLOCKFIRE; se sustituirá cuando el usuario seleccione una skin
  vestida compatible con el objetivo semi-realista del proyecto.

## Personajes legacy retirados — Kenney Blocky Characters (CC0)

`assets/models/kenney_blocky/character-{a,b,c,d,e}.glb` y sus texturas

- **Fuente**: Kenney, [Blocky Characters](https://kenney.nl/assets/blocky-characters)
- **Licencia**: Creative Commons Zero (CC0); copia local en
  `assets/models/kenney_blocky/LICENSE-KENNEY.txt`
- No los carga el runtime. Se mantienen temporalmente en el árbol de assets
  hasta cerrar la limpieza física y no son una opción de arte final.

## Operadores y props retirados — Quaternius Toon Shooter Game Kit (CC0)

`assets/models/quaternius_toon_shooter/Character_Soldier.gltf`,
`Character_Enemy.gltf`, `Barrier_Large.gltf` + `Barrier_Large_Fence.png`,
`Container_Long.gltf` y `Structure_1.gltf`

- **Fuente**: Quaternius, [Toon Shooter Game Kit](https://quaternius.com/packs/toonshootergamekit.html)
- **Licencia**: Creative Commons Zero (CC0) 1.0, indicada explícitamente en
  la página oficial del pack; evidencia y hashes en
  `assets/models/quaternius_toon_shooter/LICENSE-QUATERNIUS.md`
- No se cargan desde juego, lobby ni mapa. Quedan descartados como dirección
  visual; esta entrada se conserva únicamente para atribuir los ficheros
  heredados mientras se elimina el paquete del árbol de trabajo.

## Avatar modular retirado — Quaternius Ultimate Modular Men (CC0)

`assets/models/quaternius_modular/avatar_rig.gltf` + `avatar_rig.bin`
(rig fusionado de 11 personajes: Swat, Casual, Worker, Suit, Punk, Farmer,
SpaceSuit, King, Beach, Adventurer, Casual2; 8 animaciones)

- **Fuente**: Quaternius, [Ultimate Modular Men Pack](https://quaternius.com/packs/ultimatemodularcharacters.html)
- **Licencia**: Creative Commons Zero (CC0) 1.0; copia local en
  `assets/models/quaternius_modular/LICENSE-QUATERNIUS-UMC.txt`
- No es el avatar canónico. El runtime usa el operador original de tercera
  persona definido en `game/characters/operator_visual.gd`; este rig queda
  retirado junto con sus problemas de pesos y transparencias.

## Brazos en primera persona retirados — Drillimpact PSX First Person Arms (CC0)

`assets/models/arms/arms_rig.glb` + `arms_rig_arms_01.png`
(rig de brazos con 18 animaciones, textura 512px embebida)

- **Autor**: Drillimpact (drillimpact.itch.io)
- **Fuente**: [PSX First Person Arms](https://drillimpact.itch.io/psx-first-person-arms-free)
- **Licencia**: CC0 (dominio público); verbatim local en
  `assets/models/arms/LICENSE-PSX-ARMS.txt`
- La cámara canónica es tercera persona y el runtime no carga este asset.

## Modelos de armas retirados — Kenney (CC0)

`assets/models/weapons/rifle.glb`, `pistol.glb`, `shotgun.glb`, `smg.glb`,
`rifle-alt.glb` + `assets/models/weapons/Textures/`

- **Fuente**: Kenney (kenney.nl), pack de armas low-poly
- **Licencia**: CC0 1.0 (dominio público, sin atribución requerida —
  registrada como cortesía; ver `assets/models/weapons/LICENSE-kenney.txt`)
- No se usan como viewmodel, en bots, lobby ni gameplay. El reemplazo solo
  podrá entrar después de validar un arsenal PBR con licencia compatible y
  registrar su fuente y atribución aquí.

## Armas PBR de integración — Sketchfab (CC-BY 4.0)

`assets/models/weapons/real/desert_eagle.glb`,
`assets/models/weapons/real/mpx_smg.glb`,
`assets/models/weapons/real/type64_smg.glb`

- **Desert Eagle**: autor attix84work — [fuente Sketchfab](https://sketchfab.com/3d-models/desert-eagle-gun-1605b6c38826433fb3fe564e1d043199)
- **MPX SMG** y **Type-64 SMG**: autor nebula075 — [MPX](https://sketchfab.com/3d-models/mpx-smg-238fa4b18f1247e99231529f98d11a61) y [Type-64](https://sketchfab.com/3d-models/type-64-smg-b3651411f81243f3b37ca93322c67ae9)
- **Licencia**: Creative Commons Attribution 4.0 International (CC-BY 4.0)
- Se importan como armas reales de integración, con escala/orientación
  específica por exportador. Antes de declararlas finales hay que validar
  agarre, muzzle y disparo en Android; la atribución no se elimina al cambiar
  de skin o de montaje.

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
