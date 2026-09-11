extends SceneTree
## Diagnóstico de locomoción por ejes: mide el pie de apoyo en el mundo para
## direcciones cardinales, diagonales y una inversión lateral, con la misma
## fórmula de runtime. No cambia gameplay ni clips: sólo observa.
##
## USO: godot --path . --script res://tools/probe-loco-axes.gd -- [--speed=4.8]
##      [--sprint] [--weapon=rifle] [--settle=120] [--frames=180]
##      [--stride-debug] [--stance-profile] [--sweep]
##
## Métrica principal: durante un apoyo, el pie aterriza y el mundo se mueve
## debajo. Si el reloj está bien, la huella (desviación máxima desde el
## aterrizaje) y su componente sobre el rumbo son ~0; si el reloj va lento o
## rápido, el pie deriva de forma monótona y la huella crece con el apoyo.
## Contrato de medición: TODO caso empieza por `_reset_case`. Sin ese reset, un
## barrido de rumbos hereda `crouched` del bloque anterior y mide la zancada de
## crouch creyendo que mide la de pie (pasó: cadencia 4.8 en vez de 3.26 y
## números creíbles pero falsos). El estado heredado no avisa.

var _speed := 4.8
var _sprint := false
var _weapon := "rifle"
var _settle := 120
var _frames := 180
var _stride_debug := false
var _stance_profile := false
var _crouch_case := false
var _sweep := false

func _init() -> void:
	for arg in OS.get_cmdline_user_args():
		if arg.begins_with("--speed="): _speed = float(arg.get_slice("=", 1))
		if arg.begins_with("--weapon="): _weapon = arg.get_slice("=", 1)
		if arg.begins_with("--settle="): _settle = int(arg.get_slice("=", 1))
		if arg.begins_with("--frames="): _frames = int(arg.get_slice("=", 1))
		if arg == "--sprint": _sprint = true
		if arg == "--stride-debug": _stride_debug = true
		if arg == "--stance-profile": _stance_profile = true
		if arg == "--sweep": _sweep = true
	call_deferred("run")

func run() -> void:
	var v := OperatorVisual.new()
	root.add_child(v)
	v.configure("BRAVO", "ally", Color.CYAN, {}, true)
	v.set_process(false)
	v.debug_manual_state = true
	v.set_equipped_weapon(_weapon)
	var m := v.motion
	var feet := [v.skeleton.find_bone("Foot.L"), v.skeleton.find_bone("Foot.R")]
	var cases := [
		["fwd 4.8", Vector3(0, 0, -_speed), Vector3(0, 0, -1)],
		["strafe L 4.8", Vector3(-_speed, 0, 0), Vector3(-1, 0, 0)],
		["strafe R 4.8", Vector3(_speed, 0, 0), Vector3(1, 0, 0)],
		["diag fwd-L 4.8", Vector3(-_speed * 0.70710678, 0, -_speed * 0.70710678), Vector3(-0.70710678, 0, -0.70710678)],
		["diag fwd-R 4.8", Vector3(_speed * 0.70710678, 0, -_speed * 0.70710678), Vector3(0.70710678, 0, -0.70710678)],
		["crouch fwd 2.6", Vector3(0, 0, -2.6), Vector3(0, 0, -1), true],
		["crouch diag 2.6", Vector3(-1.8384776, 0, -1.8384776), Vector3(-0.70710678, 0, -0.70710678), true],
	]
	for entry: Array in cases:
		_crouch_case = entry.size() > 3
		m.crouched = _crouch_case
		_measure(v, m, feet, entry[0] as String, entry[1] as Vector3, entry[2] as Vector3)
		if _stride_debug: _dump_stride(v, m, entry[0] as String, entry[2] as Vector3)
		if _stance_profile: _profile_stance(v, m, feet, entry[0] as String, entry[1] as Vector3, entry[2] as Vector3)
	if _sweep: _sweep_headings(v, m, feet)
	_reversal(v, m, feet)
	v.free()
	quit(0)

## Un caso estacionario: estabiliza, luego mide apoyos completos y el reloj.
## Estado inicial de todo caso: reset completo + las variables que este sondeo
## controla. Sin esto, los casos se contaminan entre sí y las cifras mienten sin
## fallar. `crouch` decide la zancada, así que se declara por caso, no se hereda.
func _reset_case(v: OperatorVisual, m: OperatorMotion, velocity: Vector3, crouched: bool) -> void:
	m.reset()
	m.crouched = crouched
	m.aiming = false
	m.sprint_intent = _sprint
	m.reload_remaining = 0.0
	m.switch_remaining = 0.0
	v.position = Vector3.ZERO
	m.local_velocity = velocity
	for i in _settle:
		v._process(1.0 / 60.0)
		# El actor AVANZA mientras asienta: si el reloj gira y el cuerpo no se
		# mueve, el pie de apoyo retrocede contra un cuerpo quieto y cualquier
		# medida de deslizamiento sale a la velocidad del clip (medido: 4.8 m/s
		# de "derrape" con la animación correcta).
		v.position += v.global_basis * m.local_velocity / 60.0


func _measure(v: OperatorVisual, m: OperatorMotion, feet: Array, label: String, velocity: Vector3, axis: Vector3) -> void:
	_reset_case(v, m, velocity, _crouch_case)
	var planar_axis := Vector2(axis.x, axis.z)
	var worst_footprint := 0.0
	var worst_along := 0.0
	var plants := 0
	var phases := 0.0
	var travelled := 0.0
	var anchored := false
	var anchor := Vector3.ZERO
	var footprint := 0.0
	var along := 0.0
	for i in _frames:
		var before: Array[Vector3] = []
		for f in feet:
			before.append(v.skeleton.global_transform * v.skeleton.get_bone_global_pose(f).origin)
		var support := 0 if before[0].y <= before[1].y else 1
		# El hueso Foot nace a 0.0228 m: sólo cuenta la planta realmente apoyada.
		var planted := before[support].y < 0.033
		var before_phase := m.phase
		v._process(1.0 / 60.0)
		v.position += v.global_basis * m.local_velocity / 60.0
		travelled += velocity.length() / 60.0
		phases += fposmod(m.phase - before_phase, 1.0)
		var now := v.skeleton.global_transform * v.skeleton.get_bone_global_pose(feet[support]).origin
		if not planted:
			anchored = false
			continue
		if not anchored:
			anchored = true
			anchor = before[support]
			footprint = 0.0
			along = 0.0
			plants += 1
			continue
		var offset := Vector2(now.x - anchor.x, now.z - anchor.z)
		footprint = maxf(footprint, offset.length())
		along = maxf(along, offset.dot(planar_axis))
		worst_footprint = maxf(worst_footprint, footprint)
		worst_along = maxf(worst_along, along)
	if plants == 0:
		print("%-16s sin apoyos medidos" % label)
		return
	print("%-16s apoyos=%d huella_max=%.3f m deriva_max=%+.3f m cycles=%.2f travel=%.2f m (%.2f m/ciclo)" % [
		label, plants, worst_footprint, worst_along, phases, travelled,
		travelled / maxf(phases, 0.001)])


## Barrido de rumbos a velocidad constante: comprueba que la deriva del apoyo
## se mantiene pequeña en todo el rango, no sólo en el cardinal y el diagonal.
func _sweep_headings(v: OperatorVisual, m: OperatorMotion, feet: Array) -> void:
	print("barrido de rumbo a %.1f m/s (huella y deriva del apoyo por apoyo):" % _speed)
	for degrees in [10, 20, 30, 40, 45, 50, 60, 70, 80]:
		var radians := deg_to_rad(float(degrees))
		var axis := Vector3(-sin(radians), 0.0, -cos(radians))
		_crouch_case = false
		m.crouched = false
		_measure(v, m, feet, "  %.0f° del eje" % degrees, axis * _speed, axis)


## Perfil de un apoyo completo: desplazamiento del pie respecto al aterrizaje.
func _profile_stance(v: OperatorVisual, m: OperatorMotion, feet: Array, label: String, velocity: Vector3, axis: Vector3) -> void:
	_reset_case(v, m, velocity, _crouch_case)
	var planar_axis := Vector2(axis.x, axis.z)
	var anchored := false
	var anchor := Vector3.ZERO
	var line := ""
	for i in 240:
		var before: Array[Vector3] = []
		for f in feet:
			before.append(v.skeleton.global_transform * v.skeleton.get_bone_global_pose(f).origin)
		var support := 0 if before[0].y <= before[1].y else 1
		var planted := before[support].y < 0.033
		v._process(1.0 / 60.0)
		v.position += v.global_basis * m.local_velocity / 60.0
		var now := v.skeleton.global_transform * v.skeleton.get_bone_global_pose(feet[support]).origin
		if not planted:
			anchored = false
			continue
		if not anchored:
			anchored = true
			anchor = before[support]
			line = ""
			continue
		line += "%+.3f " % Vector2(now.x - anchor.x, now.z - anchor.z).dot(planar_axis)
	print("  %s apoyo (m sobre el rumbo desde el aterrizaje): %s" % [label, line])

## Traza la aritmética del reloj para un rumbo: pesos, alcance, ciclo y stride.
func _dump_stride(v: OperatorVisual, m: OperatorMotion, label: String, axis: Vector3) -> void:
	var heading := Vector2(axis.x, axis.z)
	var fwd := maxf(0.0, -heading.y)
	var back := maxf(0.0, heading.y)
	var side := absf(heading.x)
	var total := fwd + back + side
	fwd /= total
	back /= total
	side /= total
	var entries: Array = [["ual/WalkFwd", fwd * (1.0 - m._sprint_weight)],
		["ual/SprintFwd", fwd * m._sprint_weight], ["ual/BackWalk", back],
		["ual/StrafeRight" if heading.x > 0.0 else "ual/StrafeLeft", side]]
	var detail := ""
	var cycle := 0.0
	for entry: Array in entries:
		if entry[1] <= 0.0001: continue
		var speed: float = m.declared_speed(entry[0])
		var direction: Vector2 = m.declared_direction(entry[0])
		cycle += entry[1] * m.length_of(entry[0])
		detail += "%s w=%.3f v=%.2f dir=%s | " % [entry[0].get_slice("/", 1), entry[1], speed, str(direction)]
	var reach: float = m._stride_reach(entries, Vector3(heading.x, 0.0, heading.y)) if m.has_method("_stride_reach") else 0.0
	print("  stride(%s) heading=%s sprint_w=%.2f ... %s reach=%.3f cycle=%.3f stride=%.3f cycles/s=%.2f" % [
		label, str(heading), m._sprint_weight, detail, reach, cycle, reach * cycle,
		heading.length() * _speed / maxf(reach * cycle, 0.01)])

## Inversión lateral: el actor pasa de strafe L a strafe R. Mide continuidad de
## la pose (pop por fotograma) y deriva del apoyo durante la transición.
func _reversal(v: OperatorVisual, m: OperatorMotion, feet: Array) -> void:
	_reset_case(v, m, Vector3(-_speed, 0, 0), false)
	var previous := v.skeleton.get_bone_global_pose(feet[0]).origin
	var worst_pop := 0.0
	var worst_footprint := 0.0
	var anchored := false
	var anchor := Vector3.ZERO
	for i in 90:
		var before: Array[Vector3] = []
		for f in feet:
			before.append(v.skeleton.global_transform * v.skeleton.get_bone_global_pose(f).origin)
		var support := 0 if before[0].y <= before[1].y else 1
		var planted := before[support].y < 0.033
		m.local_velocity = Vector3(-_speed + 2.0 * _speed * (i + 1) / 90.0, 0, 0)
		v._process(1.0 / 60.0)
		v.position += v.global_basis * m.local_velocity / 60.0
		var now := v.skeleton.get_bone_global_pose(feet[0]).origin
		worst_pop = maxf(worst_pop, now.distance_to(previous))
		previous = now
		var world := v.skeleton.global_transform * v.skeleton.get_bone_global_pose(feet[support]).origin
		if not planted:
			anchored = false
			continue
		if not anchored:
			anchored = true
			anchor = world
			continue
		worst_footprint = maxf(worst_footprint, Vector2(world.x - anchor.x, world.z - anchor.z).length())
	print("reversal L->R   pop=%.3f m/frame huella_apoyo=%.3f m direction=%s" % [worst_pop, worst_footprint, str(m._direction)])
