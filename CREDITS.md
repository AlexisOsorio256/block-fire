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

## Personajes legacy — Kenney Blocky Characters (CC0)

`assets/models/kenney_blocky/character-{a,b,c,d,e}.glb` y sus texturas

- **Fuente**: Kenney, [Blocky Characters](https://kenney.nl/assets/blocky-characters)
- **Licencia**: Creative Commons Zero (CC0); copia local en
  `assets/models/kenney_blocky/LICENSE-KENNEY.txt`
- Se conservan como fallback/migración licenciada; el runtime canónico usa el
  rig humanoide de Quaternius descrito abajo.

## Operadores y props — Quaternius Toon Shooter Game Kit (CC0)

`assets/models/quaternius_toon_shooter/Character_Soldier.gltf`,
`Character_Enemy.gltf`, `Barrier_Large.gltf` + `Barrier_Large_Fence.png`,
`Container_Long.gltf` y `Structure_1.gltf`

- **Fuente**: Quaternius, [Toon Shooter Game Kit](https://quaternius.com/packs/toonshootergamekit.html)
- **Licencia**: Creative Commons Zero (CC0) 1.0, indicada explícitamente en
  la página oficial del pack; evidencia y hashes en
  `assets/models/quaternius_toon_shooter/LICENSE-QUATERNIUS.md`
- Se integran como un rig animado compartido (con la variante de color
  enemiga del mismo kit), y como decoración visual ligera del mapa; no se
  redistribuye el pack como tal.

## Modelos de armas — Kenney (CC0)

`assets/models/weapons/rifle.glb`, `pistol.glb`, `shotgun.glb`, `smg.glb`,
`rifle-alt.glb` + `assets/models/weapons/Textures/`

- **Fuente**: Kenney (kenney.nl), pack de armas low-poly
- **Licencia**: CC0 1.0 (dominio público, sin atribución requerida —
  registrada como cortesía; ver `assets/models/weapons/LICENSE-kenney.txt`)
- Se usan en viewmodel en primera persona, manos de bots e iconos de tienda.

## Audio restante — CC0

`assets/sfx/` (hit, headshot, kill, hurt, death, impact, ui, steps, reload,
switch, jump, empty, respawn, kill_banner): diseñados para el proyecto /
aportados por el equipo, sin restricciones conocidas.
