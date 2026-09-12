<div align="center">

# 🔥 BLOCKFIRE

**TPS arcade para Android, hecho en Godot.**

</div>

BLOCKFIRE usa Godot 4.7.2 Standard, GDScript, renderer Mobile y orientación
landscape. La ruta de producto es tercera persona sobre el hombro; el código,
los tests y el estado real del repo mandan sobre documentación vieja.

## Trabajar con el proyecto

`tools/bf` es el punto de entrada normal:

```bash
tools/bf doctor
tools/bf test
tools/bf qa motion|touch|perf|fx|hud|anim|shot|slide|ik|reload
tools/bf build android
tools/bf blender <Clip...>
```

Los scripts encuentran Godot mediante `BLOCKFIRE_GODOT`, `godot`/`godot4` en
PATH o la instalación provisionada en
`~/.local/share/blockfire-tools/godot-4.7.2/godot`.

Las fuentes de animación viven en `assets/animation_sources/*.blend`; los GLB de
runtime se generan desde esas fuentes. Para trabajo visual/rig, Blender es la
fuente de edición y el runtime de Godot es la evidencia final.

## Dónde mirar

- `docs/PRODUCT_SPEC.md`: producto y alcance.
- `docs/ARCHITECTURE.md`: dueños y contratos de ingeniería.
- `docs/CURRENT_STATE.md`: hechos operativos volátiles.
- `docs/reference/`: referencias visuales, no assets de runtime.
- `CREDITS.md`: licencias y atribuciones.

No hay Unity, PWA, WebView/Capacitor ni backend de juego. Android físico es la
autoridad cuando una conclusión depende del dispositivo; un build APK por sí
solo no sustituye esa evidencia.
