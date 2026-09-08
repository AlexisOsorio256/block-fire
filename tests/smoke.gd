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
	await _test_player_and_operator_contracts()
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
		_check(definition.reserve_ammo >= definition.magazine_size, definition.id + " reserve is definition-owned")
		_check(definition.recoil > 0.0, definition.id + " recoil is data-owned")
		_check(definition.range > definition.falloff_start, definition.id + " range/falloff ordering")
	_check(ids.has("rifle") and ids.has("pistol") and ids.has("shotgun") and ids.has("smg"), "weapon roster ids")
	_check(WeaponController.DEFINITIONS[0].automatic, "rifle is automatic")
	_check(not WeaponController.DEFINITIONS[1].automatic, "pistol is semi automatic")
	_check(WeaponController.DEFINITIONS[2].pellets > 1, "shotgun uses pellets")
	_check(BotRole.make("entry").preferred_weapon_id == "smg", "entry role selects SMG")
	_check(BotRole.make("support").preferred_weapon_id == "rifle", "support role selects rifle")
	_check(BotRole.make("anchor").preferred_weapon_id == "rifle", "anchor role selects rifle")

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
	_test_cosmetic_catalog()
	await _test_visual_in_tree()
	var victim := BlockfireBot.new()
	_check(not victim.last_damage_headshot, "headshot kill flag starts false")
	victim.last_damage_headshot = true
	_check(victim.last_damage_headshot, "headshot kill flag is remembered by the victim")
	victim.free()

func _test_visual_in_tree() -> void:
	## El rig modular necesita el árbol para resolver SettingsStore y animar.
	var visual := OperatorVisual.new()
	get_root().add_child(visual)
	await process_frame
	visual.configure("BRAVO", "ally", Color("#ff9d50"), {}, true)
	_check(visual.animation_player != null and visual.animation_player.has_animation(&"Idle"), "avatar rig exposes idle animation")
	_check(visual.animation_player != null and visual.animation_player.has_animation(&"Run_Gun"), "avatar rig exposes locomotion animation")
	_check(visual.animation_player != null and visual.animation_player.has_animation(&"Death"), "avatar rig exposes death animation")
	_check(visual.model_root != null, "avatar visual builds a model root")
	_check(visual.skeleton != null, "avatar keeps a shared Skeleton3D")
	var avatar_parts := 0
	if visual.model_root != null:
		# Solo piezas del avatar: el arma de escaparate vive bajo el mount de
		# la muñeca y no debe contar como prenda (su número de meshes varía por
		# arma y no forma parte del contrato de ropa).
		for part_name: String in ["Head", "Body", "ShoulderPad_L", "ShoulderPad_R"]:
			var part := visual.model_root.find_child(part_name, true, false) as MeshInstance3D
			if part != null and part.visible:
				avatar_parts += 1
		var band_found := false
		for node: Node in visual.model_root.find_children("*", "MeshInstance3D", true, false):
			var mesh_instance := node as MeshInstance3D
			if mesh_instance != null and mesh_instance.visible and String(mesh_instance.name) == "TeamBand":
				band_found = true
		_check(avatar_parts == 4 and band_found, "avatar shows head+top+bottom+shoes plus the team band")
	var attachments := 0
	if visual.skeleton != null:
		for node: Node in visual.skeleton.get_children():
			if node is BoneAttachment3D:
				attachments += 1
	_check(attachments >= 1, "team band rides a BoneAttachment3D")
	# Regresión P0: el rig UMC llegó con alfa 0 (invisible). Todo material
	# visible debe quedar opaco por instancia, salvo la piel de tops ocultada
	# como mitigación temporal de pesos corruptos (manos en T-pose).
	var opaque_ok := true
	if visual.skeleton != null:
		for node: Node in visual.skeleton.get_children():
			var mesh_instance := node as MeshInstance3D
			if mesh_instance == null or not mesh_instance.visible or mesh_instance.mesh == null:
				continue
			var is_top := String(mesh_instance.name).ends_with("_Body")
			for surface_index: int in range(mesh_instance.mesh.get_surface_count()):
				var material := mesh_instance.get_active_material(surface_index)
				if material is StandardMaterial3D:
					var source_mat := material as StandardMaterial3D
					var is_hidden_top_skin := is_top and source_mat.resource_name == "Skin" and source_mat.albedo_color.a < 0.01
					if is_hidden_top_skin:
						continue
					if source_mat.albedo_color.a < 0.99 or source_mat.transparency != BaseMaterial3D.TRANSPARENCY_DISABLED:
						opaque_ok = false
	_check(opaque_ok, "avatar materials are opaque after repair")
	# Regresión P0: ownership humano/bot no depende del string de team.
	# Un bot aliado nunca debe heredar el loadout persistido del jugador.
	var settings: Node = get_root().get_node("SettingsStore")
	settings.set_cosmetic_slot("top", "top_suit")
	settings.set_cosmetic_slot("bottom", "bottom_suit")
	var ally_bot_visual := OperatorVisual.new()
	ally_bot_visual.name = "AllyBotOwnership"
	get_root().add_child(ally_bot_visual)
	await process_frame
	ally_bot_visual.configure("TALON", "ally", Color("#f0a064"))
	var ally_loadout := ally_bot_visual.resolve_default_loadout(42)
	_check(String(ally_loadout.get("top", "")) != "top_suit", "ally bot does not inherit player top")
	settings.set_cosmetic_slot("top", "top_swat")
	settings.set_cosmetic_slot("bottom", "bottom_swat")
	# El escaparate debe sobrevivir al rebuild que provoca cambiar una prenda:
	# el rifle es parte del lifecycle del visual y no del lobby por frame.
	visual.set_showcase_mode(true, "res://assets/models/weapons/rifle.glb", "Estándar")
	_check(visual.get_node_or_null("TeamRing") == null, "showcase hides combat ring")
	_check(visual.get_node_or_null("ShowcaseWeaponAttachment") != null, "showcase attaches display weapon")
	visual.configure("BRAVO", "ally", Color("#ff9d50"), {}, true)
	_check(visual.get_node_or_null("TeamRing") == null and visual.get_node_or_null("ShowcaseWeaponAttachment") != null,
		"showcase weapon survives avatar rebuild")
	ally_bot_visual.queue_free()
	visual.queue_free()
	var bot := BlockfireBot.new()
	bot.name = "SmokeBot"
	bot.configure(null, "enemy", "VULTURE", "support")
	get_root().add_child(bot)
	await process_frame
	_check(bot.visual != null and bot.visual.model_root != null, "bot builds its own visual")
	var bot_meshes := 0
	if bot.visual != null and bot.visual.skeleton != null:
		# El bando enemigo viste el rig Enemy: cuerpo + cabeza como meshes
		# directos del esqueleto (sin hombreras), sin contar arma ni banda.
		for node: Node in bot.visual.skeleton.get_children():
			if node is MeshInstance3D and (node as MeshInstance3D).visible:
				bot_meshes += 1
	_check(bot_meshes == 2, "bot avatar resolves a deterministic loadout")
	_check((bot.collision_mask & 2) != 0, "bot body blocks combatant overlap")
	var collision_player := BlockfirePlayer.new()
	get_root().add_child(collision_player)
	await process_frame
	_check((collision_player.collision_mask & 2) != 0, "player body blocks combatant overlap")
	get_root().remove_child(collision_player)
	collision_player.free()
	bot.get_parent().remove_child(bot)
	bot.free()

func _test_cosmetic_catalog() -> void:
	var items := CosmeticCatalog.items()
	for slot: String in ["head", "top", "bottom", "shoes"]:
		_check(_slot_count(items, slot) >= 1, "cosmetic slot has at least one outfit piece: " + slot)
	for slot: String in ["headwear", "eyewear", "mask", "skin"]:
		_check(_slot_count(items, slot) >= 1, "cosmetic slot has at least one item: " + slot)
	var swat := CosmeticCatalog.item_for("top", "top_swat")
	_check(swat != null and swat.mesh_node == "Swat_Body", "swat top maps to its modular mesh")
	_check(ResourceLoader.exists("res://assets/models/quaternius_modular/avatar_rig.gltf"), "modular avatar asset imports")
	var loadout := CosmeticCatalog.default_loadout()
	for slot: String in ["head", "top", "bottom", "shoes", "skin"]:
		_check(String(loadout.get(slot, "")).length() > 0, "default loadout fills slot " + slot)
	var bot_loadout := CosmeticCatalog.bot_loadout_for("VULTURE", "support", 1234)
	_check(String(bot_loadout.get("top", "")).length() > 0 and String(bot_loadout.get("bottom", "")).length() > 0,
		"bot loadout resolves top and bottom deterministically")

func _slot_count(items: Dictionary, slot: String) -> int:
	var count := 0
	for key: String in items:
		var item: CosmeticItem = items[key]
		if item.slot == slot:
			count += 1
	return count

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
	game_match.round_owned_weapons = {"pistol": true}
	game_match.coins = 1300
	_check(game_match.buy_weapon(2), "affordable shotgun purchase succeeds")
	_check(game_match.coins == 100, "shotgun purchase charges once")
	_check(game_match.buy_weapon(2), "selecting owned shotgun succeeds")
	_check(game_match.coins == 100, "owned shotgun does not double-charge")
	var availability_weapon := WeaponController.new()
	availability_weapon.set_available_weapons([1, 2], 1)
	_check(not availability_weapon.is_weapon_available(0), "unbought rifle is unavailable in squad")
	_check(not availability_weapon.switch_to(0), "direct switch rejects unbought rifle")
	availability_weapon.next_weapon()
	_check(availability_weapon.active_index == 2, "next weapon follows the squad loadout")
	availability_weapon.previous_weapon()
	_check(availability_weapon.active_index == 1, "previous weapon follows the squad loadout")
	availability_weapon.free()
	var data_weapon := WeaponController.new()
	data_weapon.setup(null)
	_check(data_weapon.ammo[0] == WeaponController.DEFINITIONS[0].magazine_size, "ammo magazine comes from weapon definition")
	_check(data_weapon.reserve[3] == WeaponController.DEFINITIONS[3].reserve_ammo, "reserve ammo comes from weapon definition")
	_check(data_weapon.muzzle_anchor != null and data_weapon.muzzle_anchor.get_parent() == data_weapon.viewmodel, "muzzle flash anchor follows the viewmodel")
	data_weapon.free()
	var bot := BlockfireBot.new()
	game_match.kills[bot.get_instance_id()] = 0
	_check(game_match.register_ffa_kill(bot), "FFA kill below target registers")
	_check(int(game_match.kills[bot.get_instance_id()]) == 1, "bot kill against player increments killer score")
	_check(not game_match.ffa_killer_reached_target(bot), "FFA continues at one kill")
	game_match.kills[bot.get_instance_id()] = 18
	_check(game_match.register_ffa_kill(bot), "FFA nineteenth kill registers")
	_check(not game_match.ffa_killer_reached_target(bot), "FFA continues at nineteen kills")
	_check(game_match.register_ffa_kill(bot), "FFA twentieth kill registers")
	_check(game_match.ffa_killer_reached_target(bot), "FFA ends only after twenty kills")
	_check(MatchScript.ffa_result_title(false) == "DERROTA", "bot FFA winner is player defeat")
	_check(MatchScript.ffa_result_title(true) == "VICTORIA", "player FFA winner is victory")
	var player := BlockfirePlayer.new()
	game_match.player = player
	game_match.bots.append(bot)
	_check(game_match._ffa_display_name(player) == "TÚ", "FFA result uses player-facing winner name")
	_check(game_match._ffa_display_name(bot) == "RIVAL 1", "FFA result hides internal bot name")
	var separation_player := BlockfirePlayer.new()
	var separation_bot := BlockfireBot.new()
	separation_bot.match_context = game_match
	get_root().add_child(separation_player)
	get_root().add_child(separation_bot)
	game_match.player = separation_player
	separation_player.global_position = Vector3.ZERO
	separation_bot.target = separation_player
	separation_bot.global_position = Vector3(1.0, 0.2, 0.0)
	var separation_velocity: Vector3 = separation_bot._player_separation_velocity()
	_check(separation_velocity.length() > 0.1 and separation_velocity.x > 0.0, "FFA bot separates from player camera")
	get_root().remove_child(separation_bot)
	separation_bot.free()
	get_root().remove_child(separation_player)
	separation_player.free()
	game_match.bots.clear()
	game_match.player = null
	player.configure(game_match, "ally", "BRAVO")
	player.input_enabled = true
	game_match.state = "BUY"
	var health_before := player.health
	player.take_damage(40.0, bot)
	_check(player.health == health_before, "BUY blocks damage")
	var gated_bot := BlockfireBot.new()
	gated_bot.configure(game_match, "enemy", "HAVOC", "support")
	var bot_health_before := gated_bot.health
	gated_bot.take_damage(40.0, player)
	_check(gated_bot.health == bot_health_before, "BUY blocks bot damage")
	var gated_weapon := WeaponController.new()
	gated_weapon.setup(player)
	gated_weapon.set_fire_held(true)
	_check(not gated_weapon.try_fire(), "BUY blocks firing")
	gated_weapon.free()
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
	gated_bot.free()
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
	var gate_path := NavigationServer3D.map_get_path(agent.get_navigation_map(), Vector3(0, 0.2, -40), Vector3(0, 0.2, -24), true)
	_check(gate_path.size() >= 2, "navigation reaches the open north gate")
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
	_test_spectator_contract()
	_test_editor_pause_contract()

func _test_spectator_contract() -> void:
	var game_match := MatchScript.new()
	var first := game_match._spectator_display_name(0)
	_check(first == "COMPAÑERO 1", "spectator uses player-facing names")
	_check(not first.contains("Bot_"), "spectator hides internal bot names")
	game_match.free()

func _test_editor_pause_contract() -> void:
	## La pausa del editor congela física de combatientes sin managers.
	var hud := BlockfireHud.new()
	get_root().add_child(hud)
	hud.setup(null, true)
	var bot := BlockfireBot.new()
	bot.name = "PauseBot"
	bot.configure(null, "enemy", "VULTURE", "support")
	get_root().add_child(bot)
	var physics_before := bot.is_physics_processing()
	hud.match_context = bot.match_context
	# Simula contexto mínimo con un combatiente vivo.
	var fake := RefCounted.new()
	hud._editor_frozen = [bot]
	bot.set_physics_process(false)
	_check(not bot.is_physics_processing(), "editor freeze stops bot physics")
	hud._resume_from_editor()
	_check(bot.is_physics_processing() == physics_before, "editor close resumes bot physics")
	get_root().remove_child(bot)
	bot.free()
	get_root().remove_child(hud)
	hud.free()
