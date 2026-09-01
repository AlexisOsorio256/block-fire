# Créditos de assets — BLOCKFIRE

## Audio (`assets/sfx/`)

### CC0 (dominio público — sin atribución obligatoria, cortesía a sus creadores)
- **Kenney "Sci-fi Sounds"** (→ respawn.ogg)
  — https://kenney.nl/assets/sci-fi-sounds — © Kenney, CC0
- **Kenney "Impact Sounds"** (→ impact_wall→sfx_impact_wall fue sustituido; hoy: step, step2,
  jump, empty, switch, reload_start, reload_end)
  — https://kenney.nl/assets/impact-sounds — © Kenney, CC0
- **Kenney "Interface Sounds"** (→ ui.ogg)
  — https://kenney.nl/assets/interface-sounds — © Kenney, CC0

### CC-BY 3.0 (atribución obligatoria — la línea de créditos del lobby la menciona)
- **"Collaboration / Sound Effects Shooting sounds 001" — © Jesús Lastra, CC-BY 3.0**
  — https://opengameart.org/content/collaboration-sound-effects-shooting-sounds-001
  → `gshot_rifle.ogg` (SHOOT008), `gshot_pistol.ogg` (SHOOT007), `gshot_shotgun.ogg` (SHOOT005).
  Recortados, comprimidos, normalizados a -14 LUFS con fades via ffmpeg; mono 44.1kHz.

### Sintetizados por el proyecto (dominio propio, sin dependencia externa)
- `sfx_hit.ogg` (impacto en enemigo), `sfx_headshot.ogg` (tick de headshot),
  `sfx_kill.ogg` (confirmación de baja: golpe + doble tono), `sfx_kill_banner.ogg`
  (racha/banner), `sfx_hurt.ogg` (daño recibido, ataque instantáneo),
  `sfx_impact_wall.ogg` (golpe a pared con cuerpo metálico), `sfx_death.ogg`
  (muerte del jugador).
  Sintetizados offline en Python (envolventes ADSR + osciladores + ruido
  filtrado), normalizados a pico 0.9, exportados via ffmpeg a OGG mono 44.1kHz.
  Diseñados para el género FPS: ataque instantáneo, cuerpo y cola corta —
  sin jingles sci-fi.

## Texturas (`assets/textures/`)
- **Generadas proceduralmente por el proyecto** (PIL): paneles biselados,
  muro de bloques, crate y plataforma industrial. Sin dependencia externa,
  dominio propio del proyecto.

## Procesamiento
- OGG mono 44.1kHz optimizado con ffmpeg; PNG 256px optimizado con PIL.
- El resto de efectos (visuales/3D) son procedurales del propio juego.

Licencias originales incluidas en los zips fuente (License.txt de Kenney,
COPYING.txt del pack de Jesús Lastra).
