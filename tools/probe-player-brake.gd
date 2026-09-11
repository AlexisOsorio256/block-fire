extends SceneTree
## Public Player → Visual → Body → Motion, using real engine physics ticks.
## A no-brake counterfactual verifies that reaction adds ZERO foot/phase drift.
class ProbePlayer extends BlockfirePlayer:
	signal tick_done
	func _physics_process(delta: float) -> void:
		super._physics_process(delta)
		tick_done.emit()

var failures := 0
var max_foot_delta := 0.0
var max_phase_delta := 0.0

func _init() -> void:
	call_deferred("run")

func check(ok: bool, message: String) -> void:
	if not ok:
		failures += 1
		printerr("FAIL: " + message)

func sample(player: ProbePlayer, reference: OperatorVisual, dt: float) -> void:
	player.visual._process(dt)
	var actual := player.visual.motion
	var counter := reference.motion
	counter.local_velocity = actual.local_velocity
	counter.grounded = actual.grounded
	counter.aiming = actual.aiming
	counter.crouched = actual.crouched
	counter.sprint_intent = actual.sprint_intent
	counter.braking = false
	counter.evaluate(dt)
	max_phase_delta = maxf(max_phase_delta, absf(wrapf(actual.phase - counter.phase, -0.5, 0.5)))
	for bone: String in ["Foot.L", "Foot.R"]:
		var i := player.visual.skeleton.find_bone(bone)
		var a := player.visual.skeleton.get_bone_global_pose(i).origin
		var b := reference.skeleton.get_bone_global_pose(i).origin
		max_foot_delta = maxf(max_foot_delta, a.distance_to(b))

func run() -> void:
	var world := Node3D.new()
	root.add_child(world)
	var floor_body := StaticBody3D.new()
	var shape := CollisionShape3D.new()
	var box := BoxShape3D.new()
	box.size = Vector3(400, 1, 400)
	shape.shape = box
	floor_body.add_child(shape)
	floor_body.position.y = -0.5
	world.add_child(floor_body)
	var player := ProbePlayer.new()
	world.add_child(player)
	player.set_physics_process(false)
	player.visual.set_process(false)
	player.weapon.set_physics_process(false)
	var controls := BlockfireMobileControls.new()
	world.add_child(controls)
	player.mobile_controls = controls
	var reference := OperatorVisual.new()
	world.add_child(reference)
	reference.configure("BRAVO", "ally", Color.CYAN, {}, true)
	reference.set_process(false)
	reference.debug_manual_state = true
	for rates: Vector2i in [Vector2i(30,30), Vector2i(60,60), Vector2i(120,120), Vector2i(30,120), Vector2i(120,30)]:
		Engine.physics_ticks_per_second = rates.x
		controls.release_all()
		player.reset_at(Vector3(0, 0.1, 0))
		player.set_physics_process(true)
		for i in 15: await player.tick_done
		player.set_physics_process(false)
		player.visual.revive()
		reference.motion.reset()
		controls.aiming = true
		max_foot_delta = 0.0
		max_phase_delta = 0.0
		var render_every := maxi(1, rates.x / rates.y)
		var renders_per_tick := maxi(1, rates.y / rates.x)
		var tick_index := 0
		var previous_speed := -1.0
		var peak_weight := 0.0
		var public_brake_samples := 0
		for stage: String in ["start", "steady", "stop", "idle", "resume", "reverse", "steady", "stop", "idle"]:
			if stage != "steady": controls.qa_set_move(Vector2.ZERO if stage in ["stop", "idle"] else (Vector2.DOWN if stage == "reverse" else Vector2.UP))
			var active := 0
			for tick in rates.x / 2:
				player.set_physics_process(true)
				await player.tick_done
				player.set_physics_process(false)
				tick_index += 1
				if tick_index % render_every != 0: continue
				var speed := Vector2(player.get_real_velocity().x, player.get_real_velocity().z).length()
				var expected := previous_speed > 0.25 and (previous_speed - speed) / (float(render_every) / rates.x) > 6.0 and player.is_on_floor()
				for render in renders_per_tick:
					sample(player, reference, 1.0 / rates.y)
					check(player.visual.motion.braking == expected, "brake uses planar acceleration once per physics snapshot")
					if player.visual.motion.braking: active += 1
					peak_weight = maxf(peak_weight, player.visual.motion._brake_weight)
				previous_speed = speed
				if stage == "idle" and tick > rates.x / 3:
					check(player.visual.motion._brake_weight == 0.0, "idle clears brake weight within 0.18s")
			public_brake_samples += active
			print("PUBLIC_BRAKE physics=%d render=%d stage=%s active_samples=%d weight=%.6f" % [rates.x, rates.y, stage, active, player.visual.motion._brake_weight])
		check(public_brake_samples > 0 and peak_weight > 0.0, "public stops activate brake")
		check(max_foot_delta < 0.000001 and max_phase_delta < 0.000001, "brake cannot alter feet or locomotion phase")
		print("BRAKE_INVARIANT physics=%d render=%d added_foot_delta=%.9f phase_delta=%.9f peak_weight=%.6f" % [rates.x, rates.y, max_foot_delta, max_phase_delta, peak_weight])
		player.visual.revive()
		player.visual._process(1.0 / rates.y)
		check(not player.visual.motion.braking, "respawn clears derivative history")
	# Vertical-only jump has no planar deceleration; an airborne stop isn't a brake.
	controls.release_all()
	player.visual.revive()
	player.velocity = Vector3(0, 8.4, 0)
	for i in 20:
		player.set_physics_process(true)
		await player.tick_done
		player.set_physics_process(false)
		player.visual._process(1.0 / 120.0)
		check(not player.visual.motion.braking, "vertical-only velocity never activates braking")
	await process_frame # Leave tick_done emission before freeing its sender.
	world.free()
	print("PLAYER_BRAKE: %s failures=%d" % ["PASS" if failures == 0 else "FAIL", failures])
	quit(0 if failures == 0 else 1)
