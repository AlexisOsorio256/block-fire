extends SceneTree
## ¿La mano de apoyo RECORRE de verdad el cargador? Este probe mide el recorrido
## real de Wrist.L durante una recarga de cada clase de arma, usando el mismo
## camino que el juego (OperatorMotion + IK de OperatorVisual). Sirve para
## distinguir "el clip está bien pero el IK no lo muestra" de "el clip no viaja".
## USO: godot --headless --path . --script res://tools/probe-reload-hand.gd

const PHASES := [0.0, 0.2, 0.34, 0.5, 0.7, 0.9, 1.0]

var _app: Node
var _visual: Node

func _init() -> void:
	await process_frame
	Input.emulate_mouse_from_touch = false
	_app = (load("res://game/app.tscn") as PackedScene).instantiate()
	root.add_child(_app)
	for i: int in range(10):
		await process_frame
	_app.set("mobile_qa", true)
	_app.set("qa_combat", true)
	_app.call("_start_match", "ffa", "BRAVO", "Estándar")
	for i: int in range(30):
		await process_frame
	var player: Node = _app.current_screen.get_node_or_null("Player")
	_visual = player.get("visual") if player != null else null
	var weapon: Node = player.get("weapon") if player != null else null
	if _visual == null or weapon == null:
		print("PROBE_RELOAD_HAND: no visual/weapon")
		quit(1)
		return
	var motion: RefCounted = _visual.get("motion")
	var fails := 0
	for weapon_id: String in ["rifle", "pistol"]:
		# El arma equipada REAL manda: así el probe mide la selección de verdad,
		# no un valor inyectado que _read_motion_inputs pisaría.
		var index := -1
		for i: int in range(WeaponController.DEFINITIONS.size()):
			if WeaponController.DEFINITIONS[i].id == weapon_id:
				index = i
		if index < 0:
			continue
		weapon.set("active_index", index)
		weapon.set("switching_timer", 0.0)
		_visual.call("_process", 0.0)
		for i: int in range(3):
			await process_frame
		var duration := 1.7
		var clip: String = motion.call("reload_clip")
		var klass: String = motion.call("reload_class")
		var origin := _wrist()
		var lowest := origin
		var samples: Dictionary = {}
		for phase: float in PHASES:
			# El timer lo sigue teniendo WeaponController: el probe no lo duplica,
			# solo lo posiciona para muestrear el progreso normalizado.
			weapon.set("reload_timer", (1.0 - phase) * duration)
			motion.set("reload_duration", duration)
			motion.set("reload_weight", 1.0)
			_visual.call("_process", 0.0)
			await process_frame
			var p := _wrist()
			samples[phase] = p
			if p.y < lowest.y:
				lowest = p
		var drop := origin.y - lowest.y
		print("PROBE_RELOAD_HAND %s clip=%s class=%s drop=%.3fm travel=%.3fm" % [
			weapon_id, clip, klass, drop, origin.distance_to(lowest)])
		for phase: float in PHASES:
			var p: Vector3 = samples[phase]
			print("   phase=%.2f wrist_local=(%.3f, %.3f, %.3f)" % [phase, p.x, p.y, p.z])
		# Un recorrido creíble baja la mano al menos 12 cm desde el agarre.
		if drop < 0.12:
			fails += 1
			print("   FAIL: la mano apenas baja (%.3f m)" % drop)
		weapon.set("reload_timer", 0.0)
		motion.set("reload_weight", 0.0)
		for i: int in range(4):
			await process_frame
	print("PROBE_RELOAD_HAND: %s (%d fallos)" % ["PASS" if fails == 0 else "FAIL", fails])
	quit(0 if fails == 0 else 1)

func _wrist() -> Vector3:
	var skeleton: Skeleton3D = _visual.get("skeleton")
	var idx := skeleton.find_bone("Wrist.L")
	return skeleton.global_transform * skeleton.get_bone_global_pose(idx).origin
