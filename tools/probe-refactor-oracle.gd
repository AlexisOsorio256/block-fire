extends SceneTree
## Oráculo de refactor del personaje: firma determinista de la POSE que produce
## `OperatorVisual` (huesos, montaje del arma y boca de cañón) a lo largo de un
## guion fijo de estados y armas.
##
## Para qué: mover código entre archivos es seguro sólo si el resultado es
## IDÉNTICO. Esta firma se mide antes y después y se comparan los números; si
## cambian, el refactor cambió comportamiento y no se acepta.
##
##   godot --headless --path . --script res://tools/probe-refactor-oracle.gd
##
## La apariencia (ropa, accesorios) no entra aquí: la cubren las suites y el
## diff de capturas de `tools/qa_shot.gd`.

var _lines: Array[String] = []

func _init() -> void:
	print("ORACLE_POSE_SIGNATURE %d" % _run())
	for line in _lines:
		print(line)
	quit()

func _run() -> int:
	var actor := Node3D.new()
	get_root().add_child(actor)
	var visual := OperatorVisual.new()
	visual.configure("BRAVO", "ally", Color("#4fd6e9"), {}, true)
	actor.add_child(visual)

	var digest: Array[int] = []
	# Cada arma, y los estados que cambian la pose: andar, sprint, apuntar,
	# agachado en diagonal, recarga y frenada.
	var script: Array = []
	for weapon in OperatorVisual.WEAPON_IDS:
		script.append({"weapon": weapon, "frames": 30, "velocity": Vector3(0, 0, -4.8), "sprint": false, "aim": false, "crouch": false, "reload": 0.0})
		script.append({"weapon": weapon, "frames": 30, "velocity": Vector3(0, 0, -7.0), "sprint": true, "aim": false, "crouch": false, "reload": 0.0})
		script.append({"weapon": weapon, "frames": 30, "velocity": Vector3.ZERO, "sprint": false, "aim": true, "crouch": false, "reload": 0.0})
		script.append({"weapon": weapon, "frames": 30, "velocity": Vector3(1.2, 0, -1.2), "sprint": false, "aim": false, "crouch": true, "reload": 0.0})
		script.append({"weapon": weapon, "frames": 30, "velocity": Vector3.ZERO, "sprint": false, "aim": false, "crouch": false, "reload": 1.5})
		script.append({"weapon": weapon, "frames": 30, "velocity": Vector3(0, 0, -0.4), "sprint": false, "aim": false, "crouch": false, "reload": 0.0})
	var step := 0
	for entry: Dictionary in script:
		visual.set_equipped_weapon(entry["weapon"])
		visual.crouched = entry["crouch"]
		visual.aiming = entry["aim"]
		visual.sprinting = entry["sprint"]
		if float(entry["reload"]) > 0.0:
			visual.debug_force_reload = true
		for frame in range(entry["frames"]):
			var speed: float = (entry["velocity"] as Vector3).length()
			visual.locomotion_speed_scale = speed
			visual.set_combat_state(speed > 0.01, false, entry["aim"], speed, entry["sprint"])
			visual._process(1.0 / 60.0)
			step += 1
			if visual.skeleton != null:
				for bone in range(visual.skeleton.get_bone_count()):
					var pose := visual.skeleton.get_bone_pose(bone)
					digest.append(hash(pose.origin))
					digest.append(hash(pose.basis.x))
					digest.append(hash(pose.basis.y))
					digest.append(hash(pose.basis.z))
			if visual.weapon_mount != null:
				digest.append(hash(visual.weapon_mount.transform))
				digest.append(hash(visual.weapon_mount.scale))
			digest.append(hash(visual.get_muzzle_global_position()))
		visual.debug_force_reload = false
		if step % 180 == 0:
			_lines.append("step %d weapon=%s digest=%d" % [step, entry["weapon"], hash(digest)])
	visual.free()
	actor.free()
	return hash(digest)
