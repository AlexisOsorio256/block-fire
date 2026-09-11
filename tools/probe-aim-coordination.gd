extends SceneTree
## Public visual/weapon state; measure intended camera heading vs barrel +Z.
## Default gate covers aim/grips/transitions and FOV. --capture saves pose views.
const ProbeTeardown := preload("res://tools/probe_teardown.gd")
class ProbePlayer extends BlockfirePlayer:
	signal tick_done
	var measured_delta := 0.0
	func _physics_process(delta: float) -> void:
		measured_delta = delta
		super._physics_process(delta)
		tick_done.emit()

var failures := 0
func _init() -> void:
	call_deferred("run")
func check(ok: bool, label: String) -> void:
	if not ok:
		failures += 1
		printerr("FAIL: " + label)
func tick(player: ProbePlayer) -> void:
	player.set_physics_process(true)
	await player.tick_done
	player.set_physics_process(false)
	check(absf(player.measured_delta - 1.0 / 60.0) < 0.000001, "actual physics step is 1/60 s")

func run() -> void:
	# Accelerate wall-clock QA, while every engine physics step remains 1/60 s.
	Engine.time_scale = 10.0
	Engine.physics_ticks_per_second = 600
	Engine.max_physics_steps_per_frame = 128
	var floor_body := StaticBody3D.new()
	var collider := CollisionShape3D.new()
	var box := BoxShape3D.new()
	box.size = Vector3(400, 1, 400)
	collider.shape = box
	floor_body.add_child(collider)
	floor_body.position.y = -0.5
	root.add_child(floor_body)
	var player := ProbePlayer.new()
	root.add_child(player)
	player.set_physics_process(false)
	player.visual.set_process(false)
	player.weapon.set_physics_process(false)
	await physics_frame
	var controls := BlockfireMobileControls.new()
	root.add_child(controls)
	player.mobile_controls = controls
	var visual := player.visual
	for index in 4:
		player.weapon.set_available_weapons([index], index)
		var id := player.weapon.current_definition().id
		visual.set_equipped_weapon(id)
		for pitch: float in [-78, -45, 0, 45, 78]:
			controls.aiming = true
			player.look_pitch = pitch
			for frame in 120:
				await tick(player)
				visual._process(1.0 / 60.0)
			var intended := -player.camera_pivot.global_basis.z.normalized()
			var barrel := visual.weapon_mount.global_basis.z.normalized()
			var error := rad_to_deg(acos(clampf(intended.dot(barrel), -1, 1)))
			var socket_error := grip_error(visual, "L")
			print("AIM weapon=%s pitch=%.0f error_deg=%.6f socket_mm=%.6f position=%s grounded=%s" % [id, pitch, error, socket_error * 1000, player.position, player.is_on_floor()])
			check(player.is_on_floor(), "aim fixture stays grounded")
			check(feet_unchanged(visual), "aim never moves feet or their ancestors")
			if "--capture" in OS.get_cmdline_user_args() and pitch in [-78.0, -45.0, 0.0, 45.0, 78.0]:
				await capture_pose(player, id, pitch)
			check(error < 2.0, "settled barrel tracks intended aim")
			check(socket_error < 0.005, "support wrist stays on socket")
		# Moving, entering ADS, reload and confirmed-shot transitions at aim pitch.
		for state: String in ["strafe", "sprint_ads", "crouch", "reload", "shot"]:
			player.crouched = state == "crouch"
			player._update_crouch_visual()
			player.look_pitch = 45.0
			var max_grip := 0.0
			var max_flip := 0.0
			var previous := {"L": Vector3.ZERO, "R": Vector3.ZERO}
			controls.qa_set_move(Vector2.RIGHT if state in ["strafe", "crouch"] else (Vector2.UP if state == "sprint_ads" else Vector2.ZERO))
			player.weapon.reload_timer = 0.0
			player.weapon.switching_timer = 0.0
			for frame in 180:
				controls.aiming = not (state == "sprint_ads" and frame < 30)
				if state == "reload" and frame == 30:
					player.weapon.ammo[index] = 1
					player.weapon.request_reload()
				if state == "shot" and frame == 30:
					player.weapon.cooldown = 0.0
					check(player.weapon.try_fire(), "confirmed shot uses weapon gameplay path")
				await tick(player)
				player.weapon._physics_process(1.0 / 60.0)
				visual._process(1.0 / 60.0)
				for side: String in ["L", "R"]:
					max_grip = maxf(max_grip, grip_error(visual, side))
					var sk := visual.skeleton
					var shoulder := sk.get_bone_global_pose(sk.find_bone("UpperArm." + side)).origin
					var elbow := sk.get_bone_global_pose(sk.find_bone("LowerArm." + side)).origin
					var wrist := sk.get_bone_global_pose(sk.find_bone("Wrist." + side)).origin
					var plane := (shoulder - elbow).cross(wrist - elbow).normalized()
					if previous[side] != Vector3.ZERO:
						max_flip = maxf(max_flip, rad_to_deg(acos(clampf(plane.dot(previous[side]), -1, 1))))
					previous[side] = plane
			print("AIM_TRANSITION weapon=%s state=%s max_grip_mm=%.6f elbow_step_deg=%.6f" % [id, state, max_grip * 1000, max_flip])
			check(max_grip < 0.005, "transition preserves reachable grips")
			check(max_flip < 90.0, "no elbow-plane flip during transition")
	controls.release_all()
	# Exercise the actual Player ADS lerp interleaved with CameraFX render ticks.
	for ads: bool in [false, true]:
		for hz: int in [30, 60, 120]:
			controls.aiming = ads
			var target := 52.0 if ads else 68.0
			player.camera.fov = target
			CameraFX.kick(player, 0.03, ads)
			var fx := player.get_node("CameraFX") as CameraFX
			fx.set_process(false)
			fx.fov_punch = 0.0
			fx._process(1.0)
			player.camera.fov = target
			fx.punch_fov(3.0)
			fx._process(0.0)
			var minimum := player.camera.fov
			for step in 360:
				if step % 2 == 0: player._physics_process(1.0 / 60.0)
				if step % (120 / hz) == 0: fx._process(1.0 / hz)
				minimum = minf(minimum, player.camera.fov)
			print("FOV ads=%s render=%d minimum=%.6f target=%.1f final_error=%.6f" % [ads, hz, minimum, target, absf(player.camera.fov - target)])
			check(minimum >= target - 0.001 and absf(player.camera.fov - target) < 0.1, "FOV punch cannot undershoot baseline")
	await process_frame
	floor_body.free()
	player.free()
	controls.free()
	print("AIM_COORDINATION: failures=%d" % failures)
	ProbeTeardown.quiesce(self)
	quit(0 if "--baseline" in OS.get_cmdline_user_args() else mini(failures, 1))

## Expected wrist socket for a reachable grip. Report real error, not the fist
## mesh (which is placed directly at the target and would tautologically pass).
func grip_error(visual: OperatorVisual, side: String) -> float:
	var sk := visual.skeleton
	var shoulder := sk.global_transform * sk.get_bone_global_pose(sk.find_bone("UpperArm." + side)).origin
	var wrist := sk.global_transform * sk.get_bone_global_pose(sk.find_bone("Wrist." + side)).origin
	var target := visual.left_fist().global_position if side == "L" else visual.right_fist().global_position
	var config: Dictionary = OperatorVisual.WEAPON_CONFIG[visual.equipped_weapon_id]
	if side == "L" and config.has("support_wrist"):
		target += visual.weapon_mount.global_basis * (config.support_wrist as Vector3)
	else:
		target -= shoulder.direction_to(target) * OperatorBody.PALM_OFFSET
	return wrist.distance_to(target)

func feet_unchanged(visual: OperatorVisual) -> bool:
	for name: String in ["Foot.L", "Foot.R"]:
		var sk := visual.skeleton
		var index := sk.find_bone(name)
		var expected: Transform3D = visual.motion._pose[index]
		var parent := sk.get_bone_parent(index)
		while parent >= 0:
			expected = visual.motion._pose[parent] * expected
			parent = sk.get_bone_parent(parent)
		if expected.origin.distance_to(sk.get_bone_global_pose(index).origin) > 0.000001:
			return false
	return true

func capture_pose(player: BlockfirePlayer, id: String, pitch: float) -> void:
	var observer := Camera3D.new()
	root.add_child(observer)
	observer.position = player.position + Vector3(3.0, 1.8, -3.0)
	observer.look_at(player.position + Vector3(0, 1.1, 0))
	observer.fov = 40
	observer.make_current()
	var light := DirectionalLight3D.new()
	root.add_child(light)
	light.rotation_degrees = Vector3(-45, -30, 0)
	light.light_energy = 1.4
	var environment := WorldEnvironment.new()
	environment.environment = Environment.new()
	environment.environment.background_mode = Environment.BG_COLOR
	environment.environment.background_color = Color("#455469")
	environment.environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	environment.environment.ambient_light_color = Color.WHITE
	environment.environment.ambient_light_energy = 0.7
	root.add_child(environment)
	await process_frame
	await RenderingServer.frame_post_draw
	DirAccess.make_dir_recursive_absolute("res://captures/aim-coordination")
	root.get_texture().get_image().save_png("res://captures/aim-coordination/%s_%d.png" % [id, int(pitch)])
	observer.free()
	light.free()
	environment.free()
	player.camera.make_current()
