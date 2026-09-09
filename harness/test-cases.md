# Casos de prueba de la capa BLOCKFIRE

Estos cuatro casos se escriben **tal cual** en una sesión nueva del preset
BLOCKFIRE. Lo que se comprueba no es que el agente acierte, sino que el harness
le da lo necesario sin que el usuario lo explique.

Antes: `harness/install.sh` y `harness/test.sh`.
Después de cada caso: `node harness/bin/session-report.mjs --last 1`.

## Caso A — descubrimiento de un P0 visual

```
Investiga el P0 visual actual de BLOCKFIRE y dime qué es, quién lo posee y qué
haría falta para verificarlo. No cambies nada todavía.
```

Debe aparecer sin que el usuario lo pida:

- `tools/bf doctor` como sonda de estado (HEAD, Godot, Blender, teléfono);
- `docs/CURRENT_STATE.md` como fuente del P0 (no `docs/history/*`);
- `docs/ARCHITECTURE.md` para el dueño y el test del área;
- la skill `blockfire-orientation` cargada (y `blockfire-evidence` si ya plantea
  el cierre).

Falla si: inventa el P0, cita historia como estado, o pide al usuario que le
diga dónde está cada cosa.

## Caso B — bug pequeño, sin contaminación

```
Corrige este bug pequeño en WeaponController: <describe el síntoma>. Añade la
prueba que lo demuestra y no toques nada más.
```

Debe cargar solo lo necesario: el código dueño, el test del área, y como mucho
`blockfire-evidence`. **No** debe cargar Blender, mundo, armario ni animación, y
**no** debe activar ninguna capacidad opcional.

Falla si: `bf_capability` aparece en `tools used`, si carga 3+ skills, o si
abre subagents para un cambio de un archivo.

## Caso C — craft de animación

```
Mejora la animación de pistola: el reload se ve blando y el arma flota en la
mano. Déjala mejor y verificada.
```

Debe descubrir por sí mismo: la skill `blockfire-animation-craft`, que la
autoridad es `assets/animation_sources/*.blend`, que se edita en Blender
interactivo, y que Blender MCP se activa con `bf_capability` (solo en esa
sesión). Debe mirar el clip antes de juzgarlo (`tools/bf qa motion`) y cerrar con
fuente + export + runtime.

Falla si: intenta generar el clip por script, o si dice que no puede usar
Blender.

## Caso D — explicar un archivo

```
Explícame qué hace game/weapons/weapon_controller.gd, sin cambiar nada.
```

Debe leer el archivo y responder. **No** debe arrancar suites, ni builds, ni
subagents, ni activar capacidades, ni cargar skills que no aporten.

Falla si: `tools used` muestra `tools/bf` o `subagent`, o si el agente convierte
una pregunta en una campaña de QA.

## Qué mirar en el reporte

```
node harness/bin/session-report.mjs --last 1
```

- `preset=blockfire` — la sesión se compuso con el preset correcto.
- `first header` — número de tools y tamaño de esquema (referencia: ~25 tools,
  ~22.6k chars; con Blender MCP activo, +28 tools y ~+26.7k chars).
- `cache read` / `hit` — el prefijo se mantiene estable mientras no se active
  una capacidad.
- `skills loaded` — solo las que el caso justifica.
- `tools used` — el camino que eligió el agente, sin ritual.
