extends SceneTree
## Camino PÚBLICO: input real -> Player -> visual, sin `debug_manual_state`.
## Comprueba que la intención llega como vector y velocidad correctos por
## diagonal, inversión y sprint, y que el reloj de locomoción responde a esa
## velocidad (cadencia medida). La calidad del apoyo (huella y deriva) se mide
## en paso fijo con `tools/probe-loco-axes.gd`, que no depende de la física.
##
## USO: godot --path . --script res://tools/probe-player-locomotion.gd -- [--weapon=rifle]
var _weapon := "rifle"

func _init() -> void:
	for arg in OS.get_cmdline_user_args():
		if arg.begins_with("--weapon="): _weapon = arg.get_slice("=", 1)
	call_deferred("run")

func run() -> void:
	var world := Node3D.new()
	root.add_child(world)
	var floor_body := StaticBody3D.new()
	var shape := CollisionShape3D.new()
	var box := BoxShape3D.new()
	box.size = Vector3(400.0, 1.0, 400.0)
	shape.shape = box
	floor_body.add_child(shape)
	floor_body.position = Vector3(0, -0.5, 0)
	world.add_child(floor_body)
	var player := BlockfirePlayer.new()
	player.name = "Player"
	player.is_bot = false
	world.add_child(player)
	player.configure(null, "ally", "BRAVO", null)
	player.spawn_immunity = 0.0
	var weapon_index := {"rifle": 0, "pistol": 1, "shotgun": 2, "smg": 3}.get(_weapon, 0) as int
	player.weapon.set_available_weapons([weapon_index], weapon_index)
	player.global_position = Vector3(0, 0.1, 0)
	await physics_frame
	var visual := player.visual
	var motion := visual.motion
	print("arma=%s  visual=%s" % [player.weapon.current_definition().id, visual.equipped_weapon_id])

	# Diagonal frontal-izquierda por input: adelante + izquierda.
	Input.action_press("move_forward")
	Input.action_press("move_left")
	for i in 180: await physics_frame
	var expected := Vector2(-4.8 * 0.70710678, -4.8 * 0.70710678)
	# El cuerpo gira hacia el rumbo de avance, así que en régimen estable el
	# vector en espacio del actor es "adelante": la diagonal de gameplay no
	# mezcla clips perpendiculares salvo durante el giro. El laboratorio sí puede
	# forzarla (`probe-loco-axes.gd`), y de ahí salió la corrección del reloj.
	print("diagonal por input: velocidad=(%.2f, %.2f) esperado=(%.2f, %.2f) yaw=%.1f° moving=%s dir_actor=(%.3f, %.3f) cadencia_adelante=%.2f ciclos/s" % [
		player.velocity.x, player.velocity.z, expected.x, expected.y, rad_to_deg(player.rotation.y),
		str(visual.moving), motion._direction.x, motion._direction.y, _phase_rate(motion, 0.5)])

	# Inversión lateral: izquierda -> derecha sin soltar el avance.
	Input.action_release("move_left")
	Input.action_press("move_right")
	for i in 180: await physics_frame
	print("inversión L->R por input: velocidad=(%.2f, %.2f) yaw=%.1f° dir_actor=(%.3f, %.3f) cadencia=%.2f ciclos/s" % [
		player.velocity.x, player.velocity.z, rad_to_deg(player.rotation.y),
		motion._direction.x, motion._direction.y, _phase_rate(motion, 0.5)])

	# Sprint con rifle a 7.0 m/s.
	Input.action_press("sprint")
	for i in 180: await physics_frame
	print("sprint por input: velocidad=%.2f m/s (esperado 7.00) sprint=%s peso_sprint=%.2f dir_actor=(%.3f, %.3f) cadencia=%.2f ciclos/s (esperado 2.36)" % [
		Vector2(player.velocity.x, player.velocity.z).length(), str(visual.sprinting), motion._sprint_weight,
		motion._direction.x, motion._direction.y, _phase_rate(motion, 0.5)])
	Input.action_release("sprint")
	Input.action_release("move_forward")
	Input.action_release("move_right")
	world.queue_free()
	quit(0)

## Ritmo de fase medido: ciclos reales avanzados por segundo simulado.
func _phase_rate(motion: OperatorMotion, seconds: float) -> float:
	var steps := int(seconds * 60.0)
	var cycles := 0.0
	var previous := motion.phase
	for i in steps:
		motion.evaluate(1.0 / 60.0)
		cycles += fposmod(motion.phase - previous, 1.0)
		previous = motion.phase
	return cycles / seconds
