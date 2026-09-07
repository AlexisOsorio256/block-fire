extends SceneTree

const ControlEditorScript := preload("res://game/ui/control_editor.gd")

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
	_check(controls.is_aiming(), "aim latch starts")
	controls.qa_release_aim()
	_check(not controls.is_aiming(), "aim release clears")
	controls.qa_press_jump()
	_check(controls.consume_jump(), "jump is one shot")
	_check(not controls.consume_jump(), "jump is not sticky")
	controls.release_all()
	_check(not controls.is_firing() and controls.get_move_vector() == Vector2.ZERO, "touch release clears state")
	controls.free()

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
