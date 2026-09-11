extends SceneTree
## Deterministic real Player tick + physics-world camera regression.
## No animation or movement substitutes. --baseline reports without failing.
var failures := 0

func _init() -> void:
	call_deferred("run")

func check(ok: bool, label: String) -> void:
	print("%s: %s" % ["PASS" if ok else "FAIL", label])
	if not ok: failures += 1

func heading(node: Node3D) -> float:
	var forward := -node.global_basis.z
	return rad_to_deg(atan2(-forward.x, -forward.z))

func run() -> void:
	var world := Node3D.new()
	root.add_child(world)
	var player := BlockfirePlayer.new()
	world.add_child(player)
	player.set_physics_process(false)
	player.visual.set_process(false)
	player.weapon.set_physics_process(false)
	var controls := BlockfireMobileControls.new()
	world.add_child(controls)
	player.mobile_controls = controls
	player.gravity = 0.0
	await physics_frame
	for hz: float in [30.0, 60.0, 120.0]:
		player.position = Vector3.ZERO
		player.rotation = Vector3.ZERO
		player.look_yaw = 0.0
		player.look_pitch = 0.0
		player.velocity = Vector3.ZERO
		controls.qa_set_move(Vector2(0.5, 0.0))
		player._physics_process(1.0 / hz)
		var error := absf(wrapf(heading(player.camera_pivot) - player.look_yaw, -180, 180))
		print("turn hz=%.0f world_heading_error=%.6f deg" % [hz, error])
		check(error < 0.001, "body turn preserves world camera heading")
	controls.release_all()
	player.position = Vector3.ZERO
	player.rotation = Vector3.ZERO
	player.look_yaw = 0.0
	player._update_look(1.0 / 60.0)
	for magnitude: float in [0.05, 0.25, 0.5, 1.0]:
		print("joystick %.2f -> wish magnitude %.3f" % [magnitude, player._camera_relative_direction(Vector2(magnitude, 0)).length()])
	# Observe the public movement→visual brake path, rather than setting braking.
	for direction: Vector2 in [Vector2(0, -0.5), Vector2(0.5, -0.5)]:
		player.velocity = Vector3.ZERO
		controls.qa_set_move(direction)
		var ticks := 0
		while Vector2(player.velocity.x, player.velocity.z).length() < 4.799 and ticks < 60:
			player._physics_process(1.0 / 60.0)
			player.visual._process(1.0 / 60.0)
			ticks += 1
		print("walk start direction=%s reaches 4.8 in %d ticks / %.1f ms" % [direction, ticks, ticks * 1000.0 / 60.0])
		controls.release_all()
		var brake_frames := 0
		var stop_ticks := 0
		while player.velocity.length() > 0.001 and stop_ticks < 60:
			player._physics_process(1.0 / 60.0)
			player.visual._process(1.0 / 60.0)
			if player.visual.motion.braking: brake_frames += 1
			stop_ticks += 1
		print("stop %d ticks / %.1f ms; runtime brake frames=%d" % [stop_ticks, stop_ticks * 1000.0 / 60.0, brake_frames])
	player.position = Vector3.ZERO
	player.rotation = Vector3.ZERO
	player.look_yaw = 0.0
	player._update_look(1.0 / 60.0)
	# A wall appears on the new orbit after a 90 degree touch pan. Collision
	# must be resolved against that orbit within this same Player tick.
	var wall := StaticBody3D.new()
	var collision := CollisionShape3D.new()
	var box := BoxShape3D.new()
	box.size = Vector3(0.2, 8, 8)
	collision.shape = box
	wall.add_child(collision)
	wall.position = Vector3(1.5, 0, 0)
	world.add_child(wall)
	await physics_frame
	player.camera.position = player.CAMERA_OFFSET
	controls.qa_drag_look(Vector2(-90.0 / player._look_sensitivity(), 0))
	player._physics_process(1.0 / 60.0)
	print("pan into wall: camera x=%.4f (near face=1.4)" % player.camera.global_position.x)
	check(player.camera.global_position.x < 1.4, "new orbit retracts before wall in same tick")
	var resting := player.camera.position
	for tick in 30: player._physics_process(1.0 / 60.0)
	check(player.camera.position.distance_to(resting) < 0.001, "persistent wall does not pump the camera arm")
	# Smooth extension remains available when the obstacle is removed.
	wall.position.x = 100.0
	await physics_frame
	var before := player.camera.position.length()
	player._physics_process(1.0 / 60.0)
	check(player.camera.position.length() > before and player.camera.position.length() < player.CAMERA_OFFSET.length(), "unobstructed arm extends smoothly")
	world.free()
	quit(0 if "--baseline" in OS.get_cmdline_user_args() else mini(failures, 1))
