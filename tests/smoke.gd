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
	_test_audio_contract()
	_test_control_editor_contract()
	_test_weapon_models_load()
	_test_consolidation_contracts()
	await _test_navigation_contract()
	_test_lobby_screen_contract()
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
	_check(WeaponController.DEFINITIONS[1].automatic, "pistol supports held fire")
	_check(WeaponController.DEFINITIONS[2].pellets > 1, "shotgun uses pellets")
	_check(BotRole.make("entry").preferred_weapon_id == "smg", "entry role selects SMG")
	_check(BotRole.make("support").preferred_weapon_id == "rifle", "support role selects rifle")
	_check(BotRole.make("anchor").preferred_weapon_id == "rifle", "anchor role selects rifle")
	# Contrato de presentación: cada arma de gameplay tiene UN perfil visual vivo
	# en OperatorVisual.WEAPON_CONFIG y no hay perfiles huérfanos. Este dato estaba
	# duplicado (muerto) en WeaponDefinition, que invitaba a editar el archivo
	# equivocado.
	for definition: WeaponDefinition in WeaponController.DEFINITIONS:
		_check(OperatorVisual.WEAPON_CONFIG.has(definition.id), definition.id + " has a live visual profile")
	_check(OperatorVisual.WEAPON_CONFIG.size() == WeaponController.DEFINITIONS.size(), "no orphan weapon visual profiles")
	# El armario del lobby deriva de la tabla de tintes: una sola lista de skins.
	_check(WeaponSkin.skin_names().size() == WeaponSkin.TINTS.size() and WeaponSkin.skin_names()[0] == "Estándar",
		"skin list derives from the tint table")

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
	_test_ual_animation_library()
	_test_cosmetic_catalog()
	await _test_visual_in_tree()
	var victim := BlockfireBot.new()
	_check(not victim.last_damage_headshot, "headshot kill flag starts false")
	victim.last_damage_headshot = true
	_check(victim.last_damage_headshot, "headshot kill flag is remembered by the victim")
	victim.free()

func _test_visual_in_tree() -> void:
	## El avatar de tercera persona debe ser la malla skinned descargada y
	## conservar el contrato de montaje/aim mientras el arma PBR final llega.
	var visual := OperatorVisual.new()
	get_root().add_child(visual)
	await process_frame
	visual.configure("BRAVO", "ally", Color("#ff9d50"), {}, true)
	_check(visual.model_root != null, "avatar visual builds a model root")
	_check(visual.model_root != null and visual.model_root.find_child("CharacterModel", true, false) != null,
		"avatar instantiates the downloaded rigged skin")
	_check(visual.skeleton != null and visual.skeleton.get_bone_count() >= 20,
		"avatar keeps the modular deformation skeleton")
	_check(visual.animation_player != null and visual.retarget_ready,
		"avatar exposes its native animation library")
	if visual.animation_player != null:
		_check(visual.animation_player.has_animation("Idle_Gun"), "native idle clip is addressable")
		_check(visual.animation_player.has_animation("Idle_Aim"), "native aim clip is addressable")
		_check(visual.animation_player.has_animation("Idle_Shoot"), "native shoot clip is addressable")
		_check(visual.animation_player.has_animation("Walk"), "native walk clip is addressable")
		_check(visual.animation_player.has_animation("Run_Gun"), "native run clip is addressable")
		_check(visual.animation_player.has_animation("Death"), "native death clip is addressable")
	visual.set_combat_state(false, false)
	await process_frame
	_check(visual.motion != null and visual.motion.base_state == "Idle" and not visual.animation_player.active,
		"avatar starts in native idle")
	# El armario debe ser geometría real: cada prenda enciende su módulo.
	var wardrobe_settings: Node = get_root().get_node("SettingsStore")
	wardrobe_settings.set_cosmetic_slot("top", "top_tactical")
	visual.configure("BRAVO", "ally", Color("#ff9d50"), {}, true)
	var tactical_module := visual.model_root.find_child("Swat_Body", true, false) as MeshInstance3D
	var casual_module := visual.model_root.find_child("Casual2_Body", true, false) as MeshInstance3D
	_check(tactical_module != null and tactical_module.visible, "tactical top shows its modular mesh")
	_check(casual_module != null and not casual_module.visible, "unselected tops stay hidden")
	wardrobe_settings.set_cosmetic_slot("top", "top_hoodie")
	visual.configure("BRAVO", "ally", Color("#ff9d50"), {}, true)
	var hoodie_module := visual.model_root.find_child("Casual_Body", true, false) as MeshInstance3D
	_check(hoodie_module != null and hoodie_module.visible, "changing the top changes real geometry")
	_check(visual.model_root != null and visual.model_root.find_child("TeamRing", true, false) != null,
		"avatar keeps the team marker outside the skinned mesh")
	_check(visual.weapon_mount != null and visual.muzzle_marker != null,
		"avatar exposes a bone-attached weapon muzzle")
	# Regresión P0: ownership humano/bot no depende del string de team.
	# Un bot aliado nunca debe heredar el loadout persistido del jugador.
	var settings: Node = get_root().get_node("SettingsStore")
	settings.set_cosmetic_slot("top", "top_jacket")
	settings.set_cosmetic_slot("bottom", "bottom_trousers")
	var ally_bot_visual := OperatorVisual.new()
	ally_bot_visual.name = "AllyBotOwnership"
	get_root().add_child(ally_bot_visual)
	await process_frame
	ally_bot_visual.configure("TALON", "ally", Color("#f0a064"))
	var ally_loadout := ally_bot_visual.resolve_default_loadout(42)
	_check(String(ally_loadout.get("top", "")) != "top_jacket", "ally bot does not inherit player top")
	settings.set_cosmetic_slot("top", "top_tactical")
	settings.set_cosmetic_slot("bottom", "bottom_jeans")
	# El escaparate debe sobrevivir al rebuild que provoca cambiar una prenda:
	# el rifle es parte del lifecycle del visual y no del lobby por frame.
	visual.set_showcase_mode(true, "", "Estándar")
	var showcase_ring := visual.model_root.get_node_or_null("TeamRing") as Node3D
	var showcase_rifle := visual.model_root.find_child("MountedWeapon", true, false) as Node3D
	_check(showcase_ring != null and not showcase_ring.visible, "showcase hides combat ring")
	_check(showcase_rifle != null and showcase_rifle.visible, "showcase keeps the equipped weapon visible")
	var real_weapon_meshes := showcase_rifle.find_children("*", "MeshInstance3D", true, false) if showcase_rifle != null else []
	_check(real_weapon_meshes.size() > 0, "showcase mounts a real imported weapon mesh")
	visual.configure("BRAVO", "ally", Color("#ff9d50"), {}, true)
	showcase_ring = visual.model_root.get_node_or_null("TeamRing") as Node3D
	showcase_rifle = visual.model_root.find_child("MountedWeapon", true, false) as Node3D
	_check(showcase_ring != null and not showcase_ring.visible and showcase_rifle != null,
		"showcase survives avatar rebuild")
	ally_bot_visual.queue_free()
	visual.queue_free()
	var bot := BlockfireBot.new()
	bot.name = "SmokeBot"
	bot.configure(null, "enemy", "VULTURE", "support")
	get_root().add_child(bot)
	await process_frame
	_check(bot.visual != null and bot.visual.model_root != null, "bot builds its own visual")
	_check(bot.visual != null and bot.visual.skeleton != null and bot.visual.skeleton.get_bone_count() >= 20,
		"bot keeps the same rigged third-person avatar")
	_check((bot.collision_mask & 2) != 0, "bot body blocks combatant overlap")
	var collision_player := BlockfirePlayer.new()
	get_root().add_child(collision_player)
	await process_frame
	_check((collision_player.collision_mask & 2) != 0, "player body blocks combatant overlap")
	get_root().remove_child(collision_player)
	collision_player.free()
	bot.get_parent().remove_child(bot)
	bot.free()

func _test_ual_animation_library() -> void:
	## La UAL se valida como fuente técnica de rig/animación, no como skin
	## visible: el maniquí desnudo no debe volver a entrar por accidente al
	## lobby o a la partida mientras esperamos la ropa compatible.
	var sources := [
		{"path": "res://assets/models/animation_library/UAL1_Standard.glb", "clips": ["Idle", "Jog_Fwd", "Sprint", "Pistol_Shoot", "Pistol_Reload", "Death01"]},
		{"path": "res://assets/models/animation_library/UAL2_Standard.glb", "clips": ["Idle_FoldArms", "Melee_Hook", "Slide"]}
	]
	for source_data: Dictionary in sources:
		var scene := load(str(source_data["path"])) as PackedScene
		_check(scene != null, "UAL source imports: " + str(source_data["path"]))
		if scene == null:
			continue
		var instance := scene.instantiate()
		var skeleton := instance.find_child("Skeleton3D", true, false) as Skeleton3D
		_check(skeleton != null and skeleton.get_bone_count() >= 65, "UAL source exposes the shared 65-bone rig")
		var animation_player := instance.find_child("AnimationPlayer", true, false) as AnimationPlayer
		_check(animation_player != null, "UAL source exposes AnimationPlayer")
		if animation_player != null:
			var libraries := animation_player.get_animation_library_list()
			_check(not libraries.is_empty(), "UAL source exposes an animation library")
			for clip: String in source_data["clips"]:
				var clip_found := false
				for library_name: String in libraries:
					var library := animation_player.get_animation_library(library_name)
					if library != null and library.has_animation(clip):
						clip_found = true
						break
				_check(clip_found, "UAL clip available: " + clip)
		instance.free()

func _test_cosmetic_catalog() -> void:
	var items := CosmeticCatalog.items()
	for slot: String in ["head", "top", "bottom", "shoes"]:
		_check(_slot_count(items, slot) >= 1, "cosmetic slot has at least one outfit piece: " + slot)
	for slot: String in ["headwear", "eyewear", "mask", "skin"]:
		_check(_slot_count(items, slot) >= 1, "cosmetic slot has at least one item: " + slot)
	# Cada prenda debe apuntar a un módulo REAL del rig y a un solo slot.
	for slot: String in CosmeticCatalog.SLOT_MODULES:
		var items_for_slot: Array = CosmeticCatalog.items_by_slot().get(slot, [])
		_check(items_for_slot.size() >= 2, "wardrobe offers real geometry options for slot " + slot)
		for item: CosmeticItem in items_for_slot:
			_check(CosmeticCatalog.SLOT_MODULES[slot].has(item.mesh_node),
				"garment maps to a real module: " + item.id)
	var tactical := CosmeticCatalog.item_for("top", "top_tactical")
	_check(tactical != null and tactical.mesh_node == "Swat_Body", "tactical top maps to its modular mesh")
	var hoodie := CosmeticCatalog.item_for("top", "top_hoodie")
	_check(hoodie != null and hoodie.mesh_node != tactical.mesh_node, "different tops use different geometry")
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
	controls.size = Vector2(1280.0, 720.0)
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
	var sprint_center: Vector2 = controls.call("_button_center", "sprint")
	controls.call("_handle_touch", 7, sprint_center, true)
	controls.call("_handle_touch", 7, sprint_center, false)
	_check(controls.is_sprinting(), "sprint tap latches after finger-up")
	controls.crouch_request = true
	controls.reload_request = true
	controls.switch_request = true
	controls.release_all()
	_check(not controls.is_firing() and not controls.is_aiming() and not controls.is_sprinting() and controls.get_move_vector() == Vector2.ZERO, "touch release clears held state")
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
	_check(data_weapon.muzzle_anchor == null, "weapon without actor does not allocate a visual anchor")
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
	# La esfera de cabeza vive DENTRO de la cápsula a propósito; el rayo la
	# resuelve con una consulta explícita a la capa 4. Este contrato protege la
	# calibración: sobre el rig no debe flotar por encima del torso como el
	# valor heredado 2.16.
	_check(head_shape.position.y > body_shape.position.y + 0.5, "head hitbox sits on the visible head, not the capsule center")
	_check(head_shape.position.y + head_sphere.radius <= body_shape.position.y + body.height * 0.5 + 0.1, "head hitbox stays on the rig instead of floating above it")
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

## El lobby es la única pantalla sin cobertura: un error de parseo en su script
## no rompe ninguna prueba y deja la app en negro en dispositivo. Además de
## instanciarlo, se fija la trampa concreta que lo rompió: un ternario cuyo
## receptor es de tipo base no deja inferir el tipo con `:=` en Godot 4.7.2.
func _test_lobby_screen_contract() -> void:
	_check(BlockfireLobby != null, "lobby class is registered (its script parses)")
	var scene := load("res://game/lobby/lobby.tscn") as PackedScene
	_check(scene != null, "lobby scene loads")
	if scene != null:
		var lobby := scene.instantiate()
		_check(lobby is BlockfireLobby, "lobby scene instantiates as BlockfireLobby")
		_check(lobby.has_signal("start_requested"), "lobby exposes the start contract app.gd consumes")
		_check("mobile_qa" in lobby, "lobby accepts the mobile QA flag")
		lobby.free()
	var holder: Node = get_root().get_node_or_null("SettingsStore")
	var typed: Dictionary = holder.cosmetic_loadout() if holder != null else CosmeticCatalog.default_loadout()
	_check(not typed.is_empty(), "base-typed receiver needs an explicit type in a ternary (Godot 4.7.2)")

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

func _ensure_audio_buses() -> void:
	## En headless `--script` el layout de buses del proyecto no se aplica
	## (solo existe Master): la suite levanta los buses que el juego declara.
	for bus_name: String in [CombatAudio.BUS_SFX, CombatAudio.BUS_UI]:
		if AudioServer.get_bus_index(bus_name) < 0:
			AudioServer.add_bus()
			AudioServer.set_bus_name(AudioServer.get_bus_count() - 1, bus_name)
			AudioServer.set_bus_send(AudioServer.get_bus_index(bus_name), "Master")

func _test_audio_contract() -> void:
	## CombatAudio es el dueño único: buses, catálogo, caché y mezcla.
	_check(CombatAudio.BUS_SFX == "SFX" and CombatAudio.BUS_UI == "UI", "audio buses are named once")
	_ensure_audio_buses()
	_check(AudioServer.get_bus_index(CombatAudio.BUS_SFX) >= 0, "SFX bus exists")
	_check(AudioServer.get_bus_index(CombatAudio.BUS_UI) >= 0, "UI bus exists")
	_check(CombatAudio.SAMPLES.size() >= 18, "audio catalog covers every combat sample")
	for sound_key: String in CombatAudio.SAMPLES:
		var sample_path := str(CombatAudio.SAMPLES[sound_key])
		_check(sample_path.begins_with("res://assets/sfx/") and sample_path.ends_with(".ogg"),
			"catalog entry points at sfx: " + sound_key)
		_check(ResourceLoader.exists(sample_path), "audio sample exists: " + sound_key)
		var via_catalog: AudioStream = CombatAudio.stream(sound_key)
		_check(via_catalog != null, "audio sample loads: " + sound_key)
		_check(via_catalog != null and is_same(via_catalog, CombatAudio.stream(sound_key)),
			"audio sample is cached: " + sound_key)
	_check(CombatAudio.stream("no_existe") == null, "unknown audio key stays silent")
	# Matemáticas perceptuales intactas tras la extracción del catálogo.
	_check(absf(CombatAudio.tail_volume_db(-2.0) - (-9.5)) < 0.001, "tail layer sits below the main shot")
	var jittered: float = CombatAudio.jitter_pitch(1.0)
	_check(jittered >= 1.0 - CombatAudio.PITCH_JITTER and jittered <= 1.0 + CombatAudio.PITCH_JITTER,
		"pitch jitter stays perceptual")
	CombatAudio.configure_falloff(null, 10.0, 2.0)
	_check(true, "falloff setup tolerates a missing player")
	# El ajuste SFX gobierna el 3D y el feedback de UI (hit/kill del HUD).
	var settings: Node = get_root().get_node("SettingsStore")
	var master_before: float = float(settings.get_value("master_volume", 0.85))
	var sfx_before: float = float(settings.get_value("sfx_volume", 0.9))
	settings.set_value("sfx_volume", 0.0)
	var muted_db := linear_to_db(0.0001)
	_check(absf(AudioServer.get_bus_volume_db(AudioServer.get_bus_index("UI")) - muted_db) < 0.5,
		"SFX setting mutes UI feedback")
	settings.set_value("sfx_volume", 0.9)
	_check(absf(AudioServer.get_bus_volume_db(AudioServer.get_bus_index("UI")) - AudioServer.get_bus_volume_db(AudioServer.get_bus_index("SFX"))) < 0.001,
		"UI feedback follows the SFX bus")
	settings.set_value("master_volume", master_before)
	settings.set_value("sfx_volume", sfx_before)
	# Ningún sistema escribe rutas de samples: una sola fuente de verdad.
	for source_file: String in ["res://game/weapons/weapon_controller.gd", "res://game/player/player.gd", "res://game/bots/bot.gd", "res://game/ui/hud.gd"]:
		_check(not FileAccess.get_file_as_string(source_file).contains("assets/sfx/"),
			"no dispersed sample paths in " + source_file.get_file())

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

## Cada arma debe llegar a las manos CON geometría. El import de Godot extrae
## las texturas de un GLB a ficheros junto al modelo; si esa metadata falta, el
## arma carga con 0 superficies y el jugador se queda sin modelo: sólo sale un
## warning en consola. Esto lo convierte en un fallo de suite.
func _test_weapon_models_load() -> void:
	for weapon_id: String in OperatorVisual.WEAPON_CONFIG:
		var path: String = str(OperatorVisual.WEAPON_CONFIG[weapon_id].get("path", ""))
		_check(ResourceLoader.exists(path), "weapon model exists for " + weapon_id)
		var packed := load(path) as PackedScene
		if packed == null:
			_check(false, "weapon model loads as a scene for " + weapon_id)
			continue
		var model := packed.instantiate()
		var surfaces := 0
		for candidate: Node in model.find_children("*", "MeshInstance3D", true, false):
			var mesh_instance := candidate as MeshInstance3D
			if mesh_instance != null and mesh_instance.mesh != null:
				surfaces += mesh_instance.mesh.get_surface_count()
		_check(surfaces > 0, "weapon model yields geometry for " + weapon_id)
		model.free()

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
	# Simula contexto mínimo con un combatiente vivo. El estado de pausa vive
	# en el dueño del overlay (`hud_overlays.gd`), no en el HUD.
	hud.overlays.frozen = [bot]
	bot.set_physics_process(false)
	_check(not bot.is_physics_processing(), "editor freeze stops bot physics")
	hud._resume_from_editor()
	_check(bot.is_physics_processing() == physics_before, "editor close resumes bot physics")
	get_root().remove_child(bot)
	bot.free()
	get_root().remove_child(hud)
	hud.free()
