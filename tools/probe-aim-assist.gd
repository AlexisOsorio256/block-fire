extends SceneTree
## Mobile aim assist with ADS/fire held. The chest/torso help must never block a
## deliberate drag to the head, never move the aim with the thumb at rest, and
## never turn a shot that is already on the target into a chest hit.
##
## The target is the real BlockfireBot (real collision, real damage zones, real
## take_damage); the match context is a stub so combat stays deterministic. Player
## ticks are real physics callbacks measured at 1/60 s.
## --baseline prints failures without a nonzero exit.
const ProbeTeardown := preload("res://tools/probe_teardown.gd")

class ProbePlayer extends BlockfirePlayer:
	signal tick_done
	var measured_delta := 0.0
	func _physics_process(delta: float) -> void:
		measured_delta = delta
		super._physics_process(delta)
		tick_done.emit()

class AssistMatch extends Node:
	var combatants: Array[Node] = []

	func get_combatants() -> Array[Node]:
		return combatants

	func get_arena() -> Node:
		return null

var failures := 0
var player: ProbePlayer
var bot: BlockfireBot
var controls: BlockfireMobileControls
var match_stub: AssistMatch

func _init() -> void:
	call_deferred("run")

func check(ok: bool, label: String) -> void:
	if not ok:
		failures += 1
		printerr("FAIL: " + label)

func tick() -> void:
	player.set_physics_process(true)
	await player.tick_done
	player.set_physics_process(false)

func visual_tick() -> void:
	player.visual._process(1.0 / 60.0)

func settle(ticks: int) -> void:
	for _index in ticks:
		await tick()
		visual_tick()

## Point both look angles at a world point from the ACTUAL camera position; the
## camera orbits the pivot, so this is a fixed point, not one assignment.
func aim_at(point: Vector3) -> void:
	for _iteration in 8:
		player._sync_camera_orbit()
		var direction := player.camera.global_position.direction_to(point)
		player.look_yaw = rad_to_deg(atan2(-direction.x, -direction.z))
		player.look_pitch = clampf(rad_to_deg(asin(clampf(direction.y, -1.0, 1.0))), -78.0, 78.0)
	player._sync_camera_orbit()

func reticle_error(point: Vector3) -> float:
	player._sync_camera_orbit()
	var forward := -player.camera.global_transform.basis.z.normalized()
	return rad_to_deg(forward.angle_to(player.camera.global_position.direction_to(point)))

## Angular radius of a sphere of `radius_m` at `point`: the window in which the
## reticle is still over that body part.
func angular_radius(point: Vector3, radius_m: float) -> float:
	player._sync_camera_orbit()
	return rad_to_deg(atan2(radius_m, player.camera.global_position.distance_to(point)))

## Deliberate thumb drag toward a point, closing the loop like a player who can
## see the reticle, limited to `max_pixels` per tick. Returns the ticks used.
func drag_until(point: Vector3, max_pixels: float, tolerance: float, max_ticks: int) -> int:
	var used := 0
	for _index in max_ticks:
		if reticle_error(point) <= tolerance:
			break
		player._sync_camera_orbit()
		var direction := player.camera.global_position.direction_to(point)
		var desired_yaw := rad_to_deg(atan2(-direction.x, -direction.z))
		var desired_pitch := rad_to_deg(asin(clampf(direction.y, -1.0, 1.0)))
		var sensitivity := player._look_sensitivity()
		var delta := Vector2(
			-wrapf(desired_yaw - player.look_yaw, -180.0, 180.0) / sensitivity,
			-(desired_pitch - player.look_pitch) / sensitivity)
		controls.qa_drag_look(delta.limit_length(max_pixels))
		await tick()
		used += 1
	return used

func aim_head() -> Vector3:
	return bot.global_position + Vector3.UP * 2.16

## Bots die from accumulated damage and the assist skips dead candidates, so each
## scenario must start from a live target or it silently measures nothing.
func reset_target(distance: float) -> void:
	bot.global_position = Vector3(0.0, 0.0, -distance)
	bot.reset_at(bot.global_position, 0.0)
	bot.break_spawn_immunity()
	check(bot.is_alive and bot.collision_layer != 0, "target is live before the scenario")
	check(Vector2(player.global_position.x, player.global_position.z).length() < 0.01 and player.is_on_floor(),
		"player still holds the origin before this distance")

func fire_at(point: Vector3, shots: int) -> Dictionary:
	var hits := 0
	var heads := 0
	var missed := 0
	var muzzle_offset := 0.0
	for _index in shots:
		await tick()
		# The pose follows the aim and the muzzle anchor follows the pose: aim,
		# let the visual place the weapon, then fire from where it really is.
		aim_at(point)
		visual_tick()
		visual_tick()
		player.weapon._update_muzzle_anchor()
		var axis := -player.camera.global_transform.basis.z.normalized()
		var to_muzzle := player.weapon._muzzle_origin() - player.camera.global_position
		muzzle_offset = maxf(muzzle_offset, (to_muzzle - axis * to_muzzle.dot(axis)).length())
		player.weapon.cooldown = 0.0
		player.weapon.reload_timer = 0.0
		player.weapon.switching_timer = 0.0
		player.weapon.spread_heat = 0.0
		player.weapon.ammo[player.weapon.active_index] = 30
		var before := bot.health
		player.weapon.try_fire()
		if bot.health < before:
			hits += 1
			if bot.last_damage_headshot:
				heads += 1
		else:
			missed += 1
		bot.health = bot.max_health
	return {"hits": hits, "head": heads, "miss": missed, "offset": muzzle_offset}

func run() -> void:
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
	player = ProbePlayer.new()
	root.add_child(player)
	player.set_physics_process(false)
	player.visual.set_process(false)
	player.weapon.set_physics_process(false)
	bot = BlockfireBot.new()
	bot.name = "AssistTarget"
	bot.configure(null, "enemy", "VULTURE", "support")
	# Place the target BEFORE entering the tree: spawning it on top of the player
	# makes the physics engine depenetrate the player onto its head.
	bot.position = Vector3(0.0, 0.0, -3.5)
	root.add_child(bot)
	bot.set_physics_process(false)
	bot.visual.set_process(false)
	bot.weapon.set_physics_process(false)
	match_stub = AssistMatch.new()
	root.add_child(match_stub)
	match_stub.combatants = [player, bot]
	player.match_context = match_stub
	# Bot.take_damage dereferences match_context unconditionally; the stub has no
	# register_damage, which is the only member the target path needs.
	bot.match_context = match_stub
	await physics_frame
	controls = BlockfireMobileControls.new()
	root.add_child(controls)
	player.mobile_controls = controls
	player.weapon.set_available_weapons([0], 0)
	player.visual.set_equipped_weapon(player.weapon.current_definition().id)
	await tick()
	check(absf(player.measured_delta - 1.0 / 60.0) < 0.000001, "actual physics step is 1/60 s")

	# Free look is untouched: with neither ADS nor fire held a drag is 1:1.
	await settle(20)
	check(player.is_on_floor(), "assist fixture stays grounded")
	var free_start := player.look_pitch
	controls.qa_drag_look(Vector2(0.0, -6.0))
	await tick()
	print("ASSIST_FREE drag_px=6 step_deg=%.4f expected=%.4f" % [player.look_pitch - free_start, 6.0 * 0.12])
	check(absf(player.look_pitch - free_start - 6.0 * 0.12) < 0.01, "hip drag with no combat input is unscaled")

	# CameraFX shake runs per RENDERED frame and rotates the camera between
	# physics ticks: the probe measures aim intent, so freeze it first (same as
	# probe-aim-coordination) or the reticle drifts with wall-clock pacing.
	CameraFX.kick(player, 0.0, false)
	var fx := player.get_node_or_null("CameraFX") as CameraFX
	fx.set_process(false)
	fx.trauma = 0.0
	fx.fov_punch = 0.0
	fx._process(0.0)
	check(player.camera.rotation_degrees == Vector3.ZERO and player.camera.h_offset == 0.0,
		"camera FX frozen: the fixture measures intent, not shake")
	controls.qa_press_aim()
	controls.qa_press_fire()
	await settle(60)
	check(player.is_on_floor() and Vector2(player.global_position.x, player.global_position.z).length() < 0.01,
		"player holds the origin: the target never depenetrates the fixture")
	# ADS is latched for the rest of the run; measure its own sensitivity.
	var sensitivity := player._look_sensitivity()
	for distance: float in [3.5, 10.0, 25.0]:
		reset_target(distance)
		await settle(60)
		var head := aim_head()
		var torso := bot.get_assist_point()
		var head_window := minf(1.0, angular_radius(head, 0.2))

		# 1. A deliberate drag to the head must reach it: fast thumb, then slow.
		aim_at(torso)
		var fast_ticks := await drag_until(head, 6.0, head_window * 0.5, 120)
		var fast_error := reticle_error(head)
		aim_at(torso)
		await settle(3)
		var slow_ticks := await drag_until(head, 2.0, head_window * 0.5, 240)
		var slow_error := reticle_error(head)
		print("ASSIST_DRAG distance=%.1f window_deg=%.4f fast_ticks=%d fast_error=%.4f slow_ticks=%d slow_error=%.4f" % [
			distance, head_window, fast_ticks, fast_error, slow_ticks, slow_error])
		check(fast_error <= head_window, "a fast deliberate drag reaches the head")
		check(slow_error <= head_window, "a slow deliberate drag reaches the head")

		# 2. Thumb at rest: the aim stays where the drag left it.
		var rest_pitch := player.look_pitch
		var rest_yaw := player.look_yaw
		var rest_error := reticle_error(head)
		await settle(90)
		print("ASSIST_REST distance=%.1f head_error_start=%.4f head_error_end=%.4f pitch_drift=%.4f yaw_drift=%.4f" % [
			distance, rest_error, reticle_error(head),
			player.look_pitch - rest_pitch, player.look_yaw - rest_yaw])
		check(reticle_error(head) <= head_window, "the head stays under the reticle with the thumb at rest")
		check(absf(player.look_pitch - rest_pitch) < 0.05 and absf(player.look_yaw - rest_yaw) < 0.05,
			"thumb at rest never moves the aim")

		# 3. Adhesion is still there: the same drag travels less on the torso line
		#    than with no live candidate.
		aim_at(torso)
		await settle(3)
		var on_axis_start := player.look_pitch
		controls.qa_drag_look(Vector2(0.0, -6.0))
		await tick()
		var on_axis_step := player.look_pitch - on_axis_start
		bot.is_alive = false
		aim_at(torso)
		await settle(3)
		var free_step_start := player.look_pitch
		controls.qa_drag_look(Vector2(0.0, -6.0))
		await tick()
		var free_step := player.look_pitch - free_step_start
		bot.is_alive = true
		print("ASSIST_ADHESION distance=%.1f drag_px=6 torso_step_deg=%.4f free_step_deg=%.4f slowdown=%.4f" % [
			distance, on_axis_step, free_step, 1.0 - on_axis_step / maxf(free_step, 0.000001)])
		check(absf(free_step - 6.0 * sensitivity) < 0.01, "drag with no live candidate is unscaled")
		check(on_axis_step < free_step * 0.95, "torso line still slows the drag (assist alive)")

		# 4. The shot keeps the body part the player aimed at.
		var head_result := await fire_at(head, 8)
		print("ASSIST_SHOT distance=%.1f aim=head shots=8 hits=%d heads=%d missed=%d muzzle_offset_m=%.4f" % [
			distance, head_result["hits"], head_result["head"], head_result["miss"], head_result["offset"]])
		check(head_result["head"] >= 7, "a shot aimed at the head is a headshot")
		var chest_result := await fire_at(torso, 8)
		print("ASSIST_SHOT distance=%.1f aim=chest shots=8 hits=%d heads=%d missed=%d" % [
			distance, chest_result["hits"], chest_result["head"], chest_result["miss"]])
		check(chest_result["hits"] >= 7 and chest_result["head"] == 0, "a shot aimed at the torso is a body hit")

		# 5. The assist still converts a near miss into a hit.
		var right := player.camera.global_position.direction_to(torso).cross(Vector3.UP).normalized()
		var off_aim := torso + right * 0.55
		aim_at(off_aim)
		var raw := -player.camera.global_transform.basis.z.normalized()
		var origin := player.get_aim_origin()
		var assisted: Vector3 = player.get_mobile_assisted_direction(raw, player.weapon.current_definition().range)
		var miss_raw := rad_to_deg(raw.angle_to(origin.direction_to(torso)))
		var miss_assisted := rad_to_deg(assisted.angle_to(origin.direction_to(torso)))
		var on_target: bool = player._reticle_on_target(bot, origin, raw, player.weapon.current_definition().range)
		var near_miss := await fire_at(off_aim, 8)
		print("ASSIST_NEAR_MISS distance=%.1f offset_m=0.55 camera_range_m=%.2f on_target=%s miss_raw_deg=%.4f miss_assisted_deg=%.4f hits=%d heads=%d" % [
			distance, origin.distance_to(torso), on_target, miss_raw, miss_assisted, near_miss["hits"], near_miss["head"]])
		check(not on_target, "the near-miss fixture keeps the reticle off the target")
		check(miss_assisted < miss_raw * 0.5, "assist still bends a near miss toward the torso")
		check(near_miss["hits"] >= 7, "assist converts an off-axis shot into a hit")

		# 6. Cover still owns the shot: a wall in front of the barrel blocks it.
		var wall := StaticBody3D.new()
		var wall_shape := CollisionShape3D.new()
		var wall_box := BoxShape3D.new()
		wall_box.size = Vector3(3.0, 3.0, 0.2)
		wall_shape.shape = wall_box
		wall.add_child(wall_shape)
		wall.collision_layer = 1
		wall.collision_mask = 0
		root.add_child(wall)
		# global_position only lands on a node already inside the tree.
		wall.global_position = Vector3(0.0, 1.2, -distance * 0.5)
		var behind_wall := await fire_at(torso, 4)
		print("ASSIST_COVER distance=%.1f wall_at=%.1f shots=4 hits=%d" % [distance, distance * 0.5, behind_wall["hits"]])
		check(behind_wall["hits"] == 0, "a wall in front of the barrel still blocks the shot")
		wall.free()

	controls.release_all()
	await process_frame
	floor_body.free()
	player.free()
	bot.free()
	match_stub.free()
	controls.free()
	# Pending shot/hurt playbacks would report transient ObjectDB leaks at exit.
	ProbeTeardown.quiesce(self)
	print("AIM_ASSIST: failures=%d" % failures)
	quit(0 if "--baseline" in OS.get_cmdline_user_args() else mini(failures, 1))
