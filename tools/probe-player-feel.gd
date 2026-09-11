extends SceneTree
## Deterministic real Player tick + physics-world camera regression.
## No animation or movement substitutes. --baseline reports without failing.
class ProbePlayer extends BlockfirePlayer:
	signal tick_done
	func _physics_process(delta: float) -> void:
		super._physics_process(delta)
		tick_done.emit()

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
	var player := ProbePlayer.new()
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
	await movement_tests(player, controls)
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

func reset_case(player: BlockfirePlayer, controls: BlockfireMobileControls) -> void:
	controls.release_all()
	player.velocity = Vector3.ZERO
	player.position = Vector3.ZERO
	player.rotation = Vector3.ZERO
	player.look_yaw = 0.0
	player.look_pitch = 0.0
	player.crouched = false
	player._update_crouch_visual()
	player._sync_camera_orbit()

func movement_tests(player: ProbePlayer, controls: BlockfireMobileControls) -> void:
	reset_case(player, controls)
	for radius: float in [0.0, 0.06, 0.12]:
		controls.qa_set_move(Vector2.ONE.normalized() * radius)
		check(controls.get_move_vector().length() < 0.000001, "radial deadzone %.2f" % radius)
	for mode: String in ["walk", "sprint", "crouch"]:
		reset_case(player, controls)
		controls.aiming = mode == "walk"
		controls.sprinting = mode == "sprint"
		player.crouched = mode == "crouch"
		var speed := player.crouch_speed if player.crouched else (player.sprint_speed if controls.sprinting else player.walk_speed)
		for amount: float in [0.25, 0.5, 0.75, 1.0]:
			var raw := controls.MOVE_DEADZONE + amount * (1.0 - controls.MOVE_DEADZONE)
			controls.qa_set_move(Vector2.ONE.normalized() * raw)
			for i in 40: player._physics_process(1.0 / 60.0)
			var measured := Vector2(player.velocity.x, player.velocity.z).length()
			print("ANALOG %s input=%.2f speed=%.4f expected=%.4f" % [mode, amount, measured, amount * speed])
			check(absf(measured - amount * speed) < 0.01 * speed, "analog speed scales with remapped magnitude")
			for pitch: float in [-78.0, 0.0, 78.0]:
				player.look_pitch = pitch
				player._sync_camera_orbit()
				check(absf(player._camera_relative_direction(controls.get_move_vector()).length() - amount) < 0.00001, "pitch preserves analog magnitude")
	reset_case(player, controls)
	controls.qa_set_move(Vector2(0, -1))
	check(controls.is_sprinting(), "full travel requests sprint")
	for i in 20:
		controls.qa_set_move(Vector2(0, -(0.9 if i % 2 == 0 else 0.94)))
		check(controls.is_sprinting(), "±0.02 around old threshold does not chatter after entry")
	controls.qa_set_move(Vector2(0, -0.87))
	check(not controls.is_sprinting(), "sprint exits below lower threshold")
	for i in 20:
		controls.qa_set_move(Vector2(0, -(0.9 if i % 2 == 0 else 0.94)))
		check(not controls.is_sprinting(), "threshold noise cannot re-enter sprint")
	controls.sprinting = true
	controls.qa_set_move(Vector2(0, -0.5))
	check(controls.is_sprinting(), "button latch works at partial travel")
	controls.release_all()
	check(not controls.is_sprinting(), "focus/pause release clears both sprint requests")
	# Full raw input alone requests sprint, but combat and crouch win immediately.
	for state: String in ["sprint", "aim", "fire", "crouch", "resume"]:
		controls.qa_set_move(Vector2(0, -1))
		controls.aiming = state == "aim"
		controls.firing = state == "fire"
		player.crouched = state == "crouch"
		player._physics_process(1.0 / 60.0)
		check(player.visual.sprinting == (state in ["sprint", "resume"]), "same-tick sprint arbitration " + state)
		for i in 30: player._physics_process(1.0 / 60.0)
		var expected := 7.0 if state in ["sprint", "resume"] else (2.6 if state == "crouch" else 4.8)
		check(absf(player.velocity.length() - expected) < 0.001, "arbitrated speed " + state)
	for hz: int in [30, 60, 120]:
		Engine.physics_ticks_per_second = hz
		# Drain old-rate ticks queued before Engine's new rate takes effect.
		reset_case(player, controls)
		player.set_physics_process(true)
		for i in 12: await player.tick_done
		player.set_physics_process(false)
		var dt := 1.0 / hz
		var reference: Array[int] = []
		for angle: float in [0.0, PI / 4.0]:
			reset_case(player, controls)
			controls.aiming = true
			var initial := Vector2.UP.rotated(angle)
			var counts: Array[int] = []
			for action: String in ["start", "stop", "resume", "turn90", "reverse"]:
				var target := initial
				if action == "stop": target = Vector2.ZERO
				if action == "turn90": target = initial.rotated(PI / 2)
				if action == "reverse": target = -initial.rotated(PI / 2)
				controls.qa_set_move(target)
				var expected := Vector3(target.x, 0, target.y) * player.walk_speed
				var ticks := 0
				var distance := 0.0
				var overshoot := 0.0
				while player.velocity.distance_to(expected) > 0.001 and ticks < hz:
					var before := player.position
					var prior := player.velocity
					player.set_physics_process(true)
					await player.tick_done
					player.set_physics_process(false)
					check(absf(player.position.distance_to(before) - player.velocity.length() * dt) < 0.00001, "engine displacement uses the measured tick duration")
					distance += player.position.distance_to(before)
					overshoot = maxf(overshoot, player.velocity.length() - player.walk_speed)
					check(player.velocity.distance_to(prior) <= player.acceleration * dt + 0.00001, "vector acceleration budget")
					ticks += 1
				counts.append(ticks)
				check(ticks < hz and overshoot < 0.00001, "target reached without overshoot")
				print("RESPONSE hz=%d heading=%.0f action=%s ticks=%d ms=%.3f distance=%.6f overshoot=%.6f" % [hz, rad_to_deg(angle), action, ticks, ticks * dt * 1000, distance, overshoot])
			if reference.is_empty(): reference = counts
			else:
				for i in counts.size(): check(absi(counts[i] - reference[i]) <= 1, "direction-independent timing")
	Engine.physics_ticks_per_second = 60
	await physics_frame
	reset_case(player, controls)
