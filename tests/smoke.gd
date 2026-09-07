extends SceneTree

const ControlEditorScript := preload("res://game/ui/control_editor.gd")
const MatchScript := preload("res://game/match/match.gd")
const ArenaScript := preload("res://game/world/arena.gd")

var failures: Array[String] = []
var checks: int = 0

func _init() -> void:
	call_deferred("_run")

func _run() -> void:
	_test_input_actions()
	_test_weapon_definitions()
	_test_squad_rules()
	_test_ffa_rules()
	_test_player_and_operator_contracts()
	_test_touch_contracts()
	_test_settings_layout_contract()
	_test_control_editor_contract()
	_test_consolidation_contracts()
	await _test_navigation_contract()
	if failures.is_empty():
		print("BLOCKFIRE GODOT SMOKE: PASS (%d checks)" % checks)
		quit(0)
	else:
		for failure: String in failures:
			printerr("FAIL: " + failure)
		printerr("BLOCKFIRE GODOT SMOKE: FAIL (%d checks, %d failures)" % [checks, failures.size()])
		quit(1)

func _check(condition: bool, message: String) -> void:
	checks += 1
	if not condition:
		failures.append(message)

func _test_input_actions() -> void:
	BlockfireInputSetup.ensure_actions()
	for action: String in ["move_left", "move_right", "move_forward", "move_back", "jump", "crouch", "sprint", "fire", "aim", "reload", "next_weapon", "pause"]:
		_check(InputMap.has_action(action), "missing input action: " + action)

func _test_weapon_definitions() -> void:
	_check(WeaponController.DEFINITIONS.size() == 4, "four weapon definitions are required")
	var ids: Array[String] = []
	for definition: WeaponDefinition in WeaponController.DEFINITIONS:
		ids.append(definition.id)
		_check(definition.damage > 0.0, definition.id + " damage must be positive")
		_check(definition.magazine_size > 0, definition.id + " magazine must be positive")
		_check(definition.range > definition.falloff_start, definition.id + " range/falloff ordering")
	_check(ids.has("rifle") and ids.has("pistol") and ids.has("shotgun") and ids.has("smg"), "weapon roster ids")
	_check(WeaponController.DEFINITIONS[0].automatic, "rifle is automatic")
	_check(not WeaponController.DEFINITIONS[1].automatic, "pistol is semi automatic")
	_check(WeaponController.DEFINITIONS[2].pellets > 1, "shotgun uses pellets")

func _test_squad_rules() -> void:
	_check(SquadRules.buy_duration(1) == 10.0, "first squad buy phase")
	_check(SquadRules.buy_duration(2) == 8.0, "later squad buy phase")
	_check(not SquadRules.is_match_over(3, 3), "3-3 squad match is not over")
	_check(SquadRules.is_match_over(4, 0), "first to four wins")
	_check(SquadRules.resolve_elimination_winner(0, 1, "enemy") == "enemy", "enemy elimination result")
	_check(SquadRules.resolve_elimination_winner(2, 0, "ally") == "ally", "ally elimination result")
	_check(SquadRules.resolve_elimination_winner(0, 0, "ally") == "ally", "simultaneous wipe has no draw")

func _test_ffa_rules() -> void:
	_check(FfaRules.COMBATANT_COUNT == 8, "FFA combatant count")
	_check(FfaRules.KILLS_TO_WIN == 20, "FFA kill target")
	_check(not FfaRules.is_match_over(19), "FFA continues at 19 kills")
	_check(FfaRules.is_match_over(20), "FFA ends at 20 kills")
	_check(FfaRules.respawn_delay() > 0.0, "FFA has a respawn delay")

func _test_player_and_operator_contracts() -> void:
	var player := BlockfirePlayer.new()
	_check(player.max_health == 200.0, "player starts at 200 HP")
	_check(player.has_method("get_mobile_assisted_direction"), "player exposes mobile aim assist")
	player.free()
	var roster: Array[OperatorDefinition] = OperatorDefinition.roster()
	_check(roster.size() == 5, "operator roster has five entries")
	var model_paths: Array[String] = []
	for definition: OperatorDefinition in roster:
		model_paths.append(definition.model_scene)
	var unique_paths: Array[String] = []
	for path: String in model_paths:
		if not unique_paths.has(path):
			unique_paths.append(path)
	_check(unique_paths.size() == model_paths.size(), "operators use distinct model paths")
	_check(ResourceLoader.exists(roster[0].model_scene), "operator model asset imports")

func _test_touch_contracts() -> void:
	var controls := BlockfireMobileControls.new()
	controls.configure(true)
	controls.qa_set_move(Vector2(0.7, -0.8))
	_check(controls.get_move_vector().length() <= 1.001, "joystick is clamped")
	controls.qa_press_fire()
	_check(controls.is_firing(), "fire press is held")
	controls.qa_drag_look(Vector2(14, -8))
	_check(controls.consume_look_delta() == Vector2(14, -8), "fire/look drag produces look delta")
	controls.qa_press_aim()
	_check(controls.is_aiming(), "aim tap latches")
	controls.qa_release_aim()
	_check(controls.is_aiming(), "aim release keeps latch")
	controls.qa_press_aim()
	_check(not controls.is_aiming(), "second aim tap unlatches")
	controls.qa_press_jump()
	_check(controls.consume_jump(), "jump is one shot")
	_check(not controls.consume_jump(), "jump is not sticky")
	controls.qa_press_aim()
	controls.qa_press_jump()
	controls.crouch_request = true
	controls.reload_request = true
	controls.switch_request = true
	controls.release_all()
	_check(not controls.is_firing() and not controls.is_aiming() and controls.get_move_vector() == Vector2.ZERO, "touch release clears held state")
	_check(not controls.jump_request and not controls.crouch_request and not controls.reload_request and not controls.switch_request, "touch release clears one-shots")
	controls.free()

func _test_consolidation_contracts() -> void:
	_check(int(ProjectSettings.get_setting("display/window/handheld/orientation", -1)) == 4, "project uses sensor landscape")
	var game_match := MatchScript.new()
	game_match.round_owned_weapons = {"pistol": true}
	game_match.coins = 2000
	_check(game_match.buy_weapon(0), "first rifle purchase succeeds")
	_check(game_match.coins == 500, "rifle purchase charges once")
	_check(game_match.buy_weapon(0), "selecting owned rifle succeeds")
	_check(game_match.coins == 500, "selecting owned rifle does not double-charge")
	_check(game_match.is_weapon_owned(0), "purchased rifle is owned")
	var bot := BlockfireBot.new()
	game_match.kills[bot.get_instance_id()] = 0
	_check(not game_match.register_ffa_kill(bot), "FFA kill below target continues")
	_check(int(game_match.kills[bot.get_instance_id()]) == 1, "bot kill against player increments killer score")
	_check(MatchScript.ffa_result_title(false) == "DERROTA", "bot FFA winner is player defeat")
	_check(MatchScript.ffa_result_title(true) == "VICTORIA", "player FFA winner is victory")
	var player := BlockfirePlayer.new()
	player.spawn_immunity = 2.0
	player.break_spawn_immunity()
	_check(player.spawn_immunity == 0.0, "firing contract can break spawn immunity")
	player._create_collision()
	var head := player.get_node("HeadHitbox")
	var head_shape := head.get_child(0) as CollisionShape3D
	var body_shape := player.get_child(0) as CollisionShape3D
	var body := body_shape.shape as CapsuleShape3D
	var head_sphere := head_shape.shape as SphereShape3D
	_check(head_shape.position.y - head_sphere.radius >= body_shape.position.y + body.height * 0.5, "head hitbox is not swallowed by body collider")
	var weapon := WeaponController.new()
	_check(weapon.is_headshot_collider(head), "head hitbox resolves as headshot")
	weapon.free()
	player.free()
	bot.free()
	game_match.free()

func _test_navigation_contract() -> void:
	var viewport := SubViewport.new()
	viewport.size = Vector2i(64, 64)
	viewport.world_3d = World3D.new()
	viewport.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	get_root().add_child(viewport)
	var arena := ArenaScript.new()
	viewport.add_child(arena)
	arena.build()
	_check(is_instance_valid(arena.navigation_region), "arena owns a navigation region")
	var mesh: NavigationMesh = arena.navigation_region.navigation_mesh
	_check(mesh != null and mesh.get_polygon_count() > 1, "navmesh is baked from more than one walkable polygon")
	var agent := NavigationAgent3D.new()
	agent.path_desired_distance = 0.55
	agent.target_desired_distance = 1.1
	agent.radius = 0.5
	var agent_root := Node3D.new()
	agent_root.add_child(agent)
	viewport.add_child(agent_root)
	agent_root.global_position = Vector3(-30, 0.2, 0)
	for _frame: int in range(32):
		await physics_frame
		if NavigationServer3D.map_get_iteration_id(agent.get_navigation_map()) > 0 and NavigationServer3D.map_get_regions(agent.get_navigation_map()).size() > 0:
			break
	var path := PackedVector3Array()
	if NavigationServer3D.map_get_iteration_id(agent.get_navigation_map()) > 0 and NavigationServer3D.map_get_regions(agent.get_navigation_map()).size() > 0:
		agent.target_position = Vector3(30, 0.2, 0)
		for _frame: int in range(24):
			await physics_frame
			if NavigationServer3D.map_get_iteration_id(agent.get_navigation_map()) <= 0:
				continue
			agent.get_next_path_position()
			path = agent.get_current_navigation_path()
			if path.size() > 0:
				break
	_check(path.size() > 2, "navigation agent produces a multi-waypoint path")
	var bends := false
	for point: Vector3 in path:
		if absf(point.z) > 4.5:
			bends = true
	_check(bends, "navigation path routes around center cover")
	viewport.remove_child(agent_root)
	agent_root.free()
	viewport.remove_child(arena)
	arena.free()
	get_root().remove_child(viewport)
	viewport.free()

func _test_settings_layout_contract() -> void:
	var settings: Node = get_root().get_node("SettingsStore")
	var controls := BlockfireMobileControls.new()
	get_root().add_child(controls)
	controls.configure(true)
	controls.set_control_position("fire", Vector2(0.81, 0.67))
	controls.set_control_scale("fire", 1.24)
	controls.set_control_opacity("fire", 0.58)
	controls.save_layout()
	var persisted: Dictionary = settings.get_control_layout()
	_check(persisted.has("fire"), "control layout persists")
	if persisted.has("fire"):
		_check(absf(float(persisted["fire"]["position"][0]) - 0.81) < 0.001, "control x position persists")
		_check(absf(float(persisted["fire"]["scale"]) - 1.24) < 0.001, "control scale persists")
		_check(absf(float(persisted["fire"]["opacity"]) - 0.58) < 0.001, "control opacity persists")
	controls.reset_layout()
	get_root().remove_child(controls)
	controls.free()

func _test_control_editor_contract() -> void:
	var controls := BlockfireMobileControls.new()
	get_root().add_child(controls)
	controls.configure(true)
	var editor = ControlEditorScript.new()
	editor.setup(controls)
	get_root().add_child(editor)
	_check(editor.get_child_count() > 0, "control editor builds its panel")
	_check(controls.edit_mode, "control editor enables edit mode")
	get_root().remove_child(editor)
	editor.free()
	get_root().remove_child(controls)
	controls.free()
