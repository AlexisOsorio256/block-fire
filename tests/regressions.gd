extends SceneTree

const MatchScript := preload("res://game/match/match.gd")

var failures: Array[String] = []
var checks := 0

func _init() -> void:
	call_deferred("_run")

func _check(condition: bool, message: String) -> void:
	checks += 1
	if not condition:
		failures.append(message)

func _run() -> void:
	_test_touch_pointer_ownership()
	_test_touch_hit_geometry()
	_test_ffa_spawn_ignores_corpses()
	_test_overlay_restores_player_input()
	_test_damage_hitbox_lifecycle()
	_test_weapon_ray_contracts()
	_test_crouch_collision_profile()
	_test_match_weapon_skin_is_authoritative()
	_test_single_hit_marker_owner()
	if failures.is_empty():
		print("BLOCKFIRE TARGETED REGRESSIONS: PASS (%d checks)" % checks)
		quit(0)
		return
	for failure: String in failures:
		printerr("FAIL: " + failure)
	printerr("BLOCKFIRE TARGETED REGRESSIONS: FAIL (%d checks, %d failures)" % [checks, failures.size()])
	quit(1)

func _test_touch_pointer_ownership() -> void:
	var controls := BlockfireMobileControls.new()
	controls.configure(true)
	controls.size = Vector2(1280.0, 720.0)
	var jump_center: Vector2 = controls.call("_button_center", "jump")
	controls.call("_handle_touch", 9, jump_center, true)
	controls.call("_handle_drag", 9, jump_center + Vector2(140.0, -120.0), Vector2(24.0, -18.0))
	_check(controls.consume_look_delta() == Vector2.ZERO, "dragging a one-shot action finger never moves the camera")
	_check(controls.consume_jump(), "jump still fires while its pointer is captured")
	controls.call("_handle_touch", 9, jump_center + Vector2(140.0, -120.0), false)
	controls.free()

func _test_touch_hit_geometry() -> void:
	var controls := BlockfireMobileControls.new()
	controls.configure(true)
	controls.size = Vector2(1280.0, 720.0)
	var sprint_center: Vector2 = controls.call("_button_center", "sprint")
	var sprint_edge := sprint_center + Vector2(65.0, 0.0)
	_check(bool(controls.call("_in_sprint", sprint_edge)), "sprint outer hit edge is valid")
	_check(bool(controls.call("_in_any_button", sprint_edge)), "button arbitration uses sprint's real hit radius")
	controls.set_control_scale("fire", 1.45)
	_check(is_equal_approx(controls.get_control_safe_radius("fire"), 58.0 * 1.45), "editor safe radius follows scaled fire hit geometry")
	controls.set_control_scale("sprint", 1.45)
	_check(is_equal_approx(controls.get_control_safe_radius("sprint"), 68.0 * 1.45), "editor safe radius follows scaled sprint hit geometry")
	controls.free()

func _test_ffa_spawn_ignores_corpses() -> void:
	var game_match := MatchScript.new()
	var actor := BlockfirePlayer.new()
	var corpse := BlockfireBot.new()
	corpse.is_alive = false
	corpse.global_position = Vector3.ZERO
	game_match.player = actor
	game_match.bots = [corpse]
	var spawns: Array[Vector3] = [Vector3.ZERO, Vector3(10.0, 0.0, 0.0)]
	_check(game_match._pick_free_spawn(spawns, actor) == spawns[0], "dead combatants do not push FFA respawns away from an otherwise free point")
	game_match.bots.clear()
	game_match.player = null
	actor.free()
	corpse.free()
	game_match.free()

func _test_overlay_restores_player_input() -> void:
	var game_match := MatchScript.new()
	var actor := BlockfirePlayer.new()
	actor.input_enabled = true
	var weapon := WeaponController.new()
	actor.weapon = weapon
	actor.add_child(weapon)
	weapon.reload_timer = 1.25
	weapon.cooldown = 0.21
	weapon.spread_heat = 1.4
	weapon.set_fire_held(true)
	game_match.player = actor
	var hud := BlockfireHud.new()
	hud.match_context = game_match
	hud.call("_freeze_for_overlay")
	_check(not actor.input_enabled, "overlay freezes player input while open")
	_check(bool(hud.get("_overlay_input_states").get(actor.get_instance_id(), false)), "overlay snapshots enabled input before clearing it")
	_check(is_equal_approx(weapon.reload_timer, 1.25) and is_equal_approx(weapon.cooldown, 0.21), "overlay pause preserves reload/cooldown state")
	_check(is_equal_approx(weapon.spread_heat, 1.4), "overlay pause preserves spread state")
	_check(not weapon.fire_held, "overlay releases held fire without resetting weapon state")
	_check(not weapon.is_physics_processing(), "overlay freezes child WeaponController timers")
	hud.call("_resume_from_overlay")
	_check(actor.input_enabled, "closing overlay restores the player's previous input state")
	_check(weapon.is_physics_processing(), "closing overlay resumes WeaponController processing")
	game_match.player = null
	actor.free()
	hud.free()
	game_match.free()

func _test_damage_hitbox_lifecycle() -> void:
	var game_match := MatchScript.new()
	var actor := Node3D.new()
	var head := Area3D.new()
	head.name = "HeadHitbox"
	head.collision_layer = 4
	actor.add_child(head)
	game_match._set_damage_hitbox_enabled(actor, false)
	_check(head.collision_layer == 0, "dead combatant head area stops blocking bullets")
	game_match._set_damage_hitbox_enabled(actor, true)
	_check(head.collision_layer == 4, "respawn restores the head damage layer")
	actor.free()
	game_match.free()

func _test_weapon_ray_contracts() -> void:
	var source := FileAccess.get_file_as_string("res://game/weapons/weapon_controller.gd")
	_check(source.contains("query.collide_with_areas = true"), "weapon ray explicitly collides with Area3D head hitboxes")
	_check(source.contains("var origin := _muzzle_origin()"), "authoritative damage ray starts at the real muzzle")
	_check(source.contains("get_node_or_null(\"HeadHitbox\")"), "muzzle ray excludes the shooter's own head Area3D")

func _test_crouch_collision_profile() -> void:
	var actor := BlockfirePlayer.new()
	actor.call("_create_collision")
	var body := actor.get_node_or_null("BodyCollision") as CollisionShape3D
	var head := actor.get_node_or_null("HeadHitbox/HeadCollision") as CollisionShape3D
	_check(body != null and body.shape is CapsuleShape3D, "player owns a named capsule collision profile")
	_check(head != null, "player owns a named head collision profile")
	if body != null and body.shape is CapsuleShape3D and head != null:
		var capsule := body.shape as CapsuleShape3D
		var standing_height := capsule.height
		var standing_head_y := head.position.y
		actor.crouched = true
		actor.call("_apply_collision_profile")
		_check(capsule.height < standing_height, "crouch lowers the physical body capsule")
		_check(head.position.y < standing_head_y, "crouch lowers the actual headshot volume")
		actor.crouched = false
		actor.call("_apply_collision_profile")
		_check(is_equal_approx(capsule.height, standing_height), "standing restores body collision height")
		_check(is_equal_approx(head.position.y, standing_head_y), "standing restores headshot height")
	actor.free()

func _test_match_weapon_skin_is_authoritative() -> void:
	var game_match := MatchScript.new()
	game_match.weapon_skin = "Oro"
	var actor := BlockfirePlayer.new()
	actor.match_context = game_match
	var controller := WeaponController.new()
	controller.actor = actor
	_check(str(controller.call("_current_weapon_skin")) == "Oro", "match-selected weapon skin wins over ambient settings")
	actor.free()
	controller.free()
	game_match.free()

func _test_single_hit_marker_owner() -> void:
	var source := FileAccess.get_file_as_string("res://game/ui/crosshair.gd")
	_check(source.contains("func register_hit(_headshot: bool)"), "crosshair keeps the HUD compatibility seam")
	_check(not source.contains("feedback_timer"), "crosshair no longer renders a duplicate timed hit marker")
