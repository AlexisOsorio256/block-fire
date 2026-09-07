class_name BlockfireMatch
extends Node3D

signal exit_to_lobby

const Arena := preload("res://game/world/arena.gd")
const Player := preload("res://game/player/player.gd")
const Bot := preload("res://game/bots/bot.gd")
const Hud := preload("res://game/ui/hud.gd")

var mode: String = "squad"
var operator_id: String = "BRAVO"
var weapon_skin: String = "Estándar"
var mobile_qa: bool = false
var state: String = "BUY"
var round_number: int = 1
var ally_rounds: int = 0
var enemy_rounds: int = 0
var round_timer: float = 0.0
var transition_timer: float = 0.0
var coins: int = 1300
var arena: BlockfireArena
var player: BlockfirePlayer
var bots: Array[BlockfireBot] = []
var hud: BlockfireHud
var spectator_camera: Camera3D
var spectator_index: int = 0
var spectator_targets: Array[Node] = []
var last_team: String = "enemy"
var kills: Dictionary = {}
var ffa_winner: Node
var round_start_count: int = 0
var qa_skip_buy: bool = false

func configure(selected_mode: String, selected_operator: String, selected_skin: String, use_mobile_qa: bool) -> void:
	mode = selected_mode
	operator_id = selected_operator
	weapon_skin = selected_skin
	mobile_qa = use_mobile_qa

func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	arena = Arena.new()
	arena.name = "ArenaSquad" if mode == "squad" else "ArenaFFA"
	add_child(arena)
	arena.build()
	hud = Hud.new()
	hud.name = "HUD"
	hud.setup(self, mobile_qa)
	add_child(hud)
	hud.buy_requested.connect(_on_buy_requested)
	hud.arsenal_requested.connect(_on_arsenal_requested)
	hud.settings_requested.connect(_on_settings_requested)
	hud.exit_requested.connect(func() -> void: exit_to_lobby.emit())
	hud.spectator_next.connect(func() -> void: _cycle_spectator(1))
	hud.spectator_previous.connect(func() -> void: _cycle_spectator(-1))
	_start_round()

func _process(delta: float) -> void:
	if state == "BUY":
		round_timer = maxf(0.0, round_timer - delta)
		hud.update_buy_time(round_timer)
		if round_timer <= 0.0:
			_start_combat()
	elif state == "ROUND_END":
		transition_timer = maxf(0.0, transition_timer - delta)
		if transition_timer <= 0.0:
			_start_round()
	elif state == "COMBAT":
		if mode == "squad":
			_evaluate_squad()
		_update_spectator_camera()
	if Input.is_action_just_pressed("pause") and state == "COMBAT":
		Input.set_mouse_mode(Input.MOUSE_MODE_VISIBLE)

func _start_round() -> void:
	state = "BUY"
	round_start_count += 1
	_clear_actors()
	var spawns := arena.get_spawns(mode)
	if mode == "squad":
		round_timer = SquadRules.buy_duration(round_number)
		_create_player(spawns[0], "ally")
		for index: int in range(1, 4):
			_create_bot(spawns[index], "ally", ["entry", "support", "anchor"][index - 1], ["TALON", "DUNE", "VULTURE"][index - 1], 0.0)
		for index: int in range(4, 8):
			_create_bot(spawns[index], "enemy", ["entry", "support", "anchor", "entry"][index - 4], ["HAVOC", "VULTURE", "DUNE", "TALON"][index - 4], 0.08)
		hud.update_score(ally_rounds, enemy_rounds, round_number)
		if qa_skip_buy:
			round_timer = 0.0
			_start_combat()
		else:
			hud.show_buy(true, round_timer, coins, WeaponController.DEFINITIONS, player.weapon.active_index)
			hud.set_status("FASE DE COMPRA · prepara tu arsenal")
	else:
		round_timer = 0.0
		_create_player(spawns[0], "player")
		for index: int in range(1, 8):
			_create_bot(spawns[index], "bot_%d" % index, ["entry", "support", "anchor"][index % 3], ["VULTURE", "TALON", "DUNE", "HAVOC"][index % 4], 0.05)
		hud.update_score(0, 0, 1)
		_start_combat()
	kills.clear()
	if player != null:
		kills[player.get_instance_id()] = 0

func _start_combat() -> void:
	if state == "COMBAT":
		return
	state = "COMBAT"
	hud.show_buy(false, 0, coins, WeaponController.DEFINITIONS, player.weapon.active_index if player != null else 1)
	hud.set_status("🛡️ 2s · DISPARAR LO ROMPE", Color("#91e6ff"))
	hud.show_banner("¡A LUCHAR!", 1.35)
	if player != null:
		player.input_enabled = true
		if not mobile_qa:
			Input.set_mouse_mode(Input.MOUSE_MODE_CAPTURED)

func is_combat_active() -> bool:
	return state == "COMBAT"

func get_arena() -> Node:
	return arena

func get_combatants() -> Array[Node]:
	var result: Array[Node] = []
	if is_instance_valid(player):
		result.append(player)
	for bot: BlockfireBot in bots:
		if is_instance_valid(bot):
			result.append(bot)
	return result

func open_control_editor() -> void:
	if hud != null:
		hud.toggle_control_editor()

func get_rally_point(team_id: String) -> Vector3:
	if mode == "ffa":
		return Vector3.ZERO
	return Vector3(-6, 0.2, 0) if team_id == "ally" else Vector3(6, 0.2, 0)

func register_damage(victim: Node, amount: float, headshot: bool, source: Node) -> void:
	if victim == player:
		hud.show_damage("-%d" % roundi(amount), false)
	elif source == player:
		hud.show_damage("%d%s" % [roundi(amount), "  HEADSHOT" if headshot else ""], headshot)

func _create_player(spawn: Vector3, team_id: String) -> void:
	player = Player.new()
	player.name = "Player"
	player.configure(self, team_id, operator_id, hud.mobile_controls)
	add_child(player)
	player.global_position = spawn
	player.player_died.connect(_on_player_died)
	player.health_changed.connect(hud.update_health)
	player.weapon.ammo_changed.connect(hud.update_ammo)
	player.weapon.weapon_changed.connect(func(definition: WeaponDefinition) -> void: hud.update_ammo(player.weapon.ammo[player.weapon.active_index], player.weapon.reserve[player.weapon.active_index], definition))
	player.weapon.damage_confirmed.connect(func(amount: float, headshot: bool) -> void: hud.show_damage("%d%s" % [roundi(amount), "  HEADSHOT" if headshot else ""], headshot))

func _create_bot(spawn: Vector3, team_id: String, role_id: String, bot_operator: String, bonus: float) -> void:
	var bot := Bot.new()
	bot.name = "Bot_%s_%d" % [team_id, bots.size()]
	bot.configure(self, team_id, bot_operator, role_id, bonus)
	add_child(bot)
	bot.global_position = spawn
	bot.bot_died.connect(_on_bot_died)
	bots.append(bot)
	kills[bot.get_instance_id()] = 0

func _on_buy_requested(index: int) -> void:
	if state != "BUY" or player == null or not player.is_alive:
		return
	if index < 0 or index >= WeaponController.DEFINITIONS.size():
		return
	var definition := WeaponController.DEFINITIONS[index]
	if index != 1 and coins < definition.cost:
		hud.set_status("MONEDAS INSUFICIENTES", Color("#ff9d86"))
		return
	if index != 1:
		coins -= definition.cost
	player.weapon.switch_to(index)
	hud.show_buy(true, round_timer, coins, WeaponController.DEFINITIONS, index)
	hud.set_status("EQUIPADA · %s" % definition.display_name, Color("#9be6ff"))

func _on_arsenal_requested() -> void:
	if state == "BUY":
		return
	if player != null and player.weapon != null:
		player.weapon.next_weapon()

func _on_settings_requested() -> void:
	if hud != null:
		hud.toggle_control_editor()

func _on_player_died(_dead: Node, killer: Node) -> void:
	last_team = killer.get_team() if is_instance_valid(killer) and killer.has_method("get_team") else "enemy"
	hud.show_death("MUERTE")
	if mode == "ffa":
		_schedule_respawn(player)
		return
	_start_spectating()
	_evaluate_squad()

func _on_bot_died(dead: Node, killer: Node) -> void:
	last_team = killer.get_team() if is_instance_valid(killer) and killer.has_method("get_team") else "ally"
	if is_instance_valid(killer):
		var id: int = killer.get_instance_id()
		kills[id] = int(kills.get(id, 0)) + 1
		if mode == "ffa":
			hud.update_score(get_player_kills(), 0, 1)
			if FfaRules.is_match_over(kills[id]):
				ffa_winner = killer
				_finish_ffa()
				return
	if mode == "ffa":
		_schedule_respawn(dead)
	else:
		_evaluate_squad()

func _evaluate_squad() -> void:
	if state != "COMBAT" or mode != "squad":
		return
	var ally_alive := 0
	var enemy_alive := 0
	for combatant: Node in get_combatants():
		if not combatant.get("is_alive"):
			continue
		if combatant.get_team() == "ally":
			ally_alive += 1
		else:
			enemy_alive += 1
	if ally_alive == 0 or enemy_alive == 0:
		var winner := SquadRules.resolve_elimination_winner(ally_alive, enemy_alive, last_team)
		_end_squad_round(winner)

func _end_squad_round(winner: String) -> void:
	if state != "COMBAT":
		return
	state = "ROUND_END"
	transition_timer = 2.2
	if winner == "ally":
		ally_rounds += 1
		coins += 800
		hud.show_banner("RONDA GANADA", 1.7)
		hud.set_status("TU ESCUADRA DOMINA EL PUNTO", Color("#8ff1c5"))
	else:
		enemy_rounds += 1
		hud.show_banner("RONDA PERDIDA", 1.7)
		hud.set_status("EL ENEMIGO TOMA LA RONDA", Color("#ff9d86"))
	hud.update_score(ally_rounds, enemy_rounds, round_number)
	if SquadRules.is_match_over(ally_rounds, enemy_rounds):
		state = "FINISHED"
		var title := "VICTORIA" if ally_rounds > enemy_rounds else "DERROTA"
		hud.show_match_end(title, "%d  —  %d rondas" % [ally_rounds, enemy_rounds])
		Input.set_mouse_mode(Input.MOUSE_MODE_VISIBLE)
	else:
		round_number = SquadRules.next_round(round_number)

func _start_spectating() -> void:
	spectator_targets.clear()
	for bot: BlockfireBot in bots:
		if bot.is_alive and bot.team == "ally":
			spectator_targets.append(bot)
	if spectator_targets.is_empty():
		return
	spectator_index = 0
	if spectator_camera == null:
		spectator_camera = Camera3D.new()
		spectator_camera.name = "SpectatorCamera"
		spectator_camera.current = false
		add_child(spectator_camera)
	player.camera.current = false
	spectator_camera.current = true
	hud.show_spectator(str(spectator_targets[0].name))

func _cycle_spectator(direction: int) -> void:
	if spectator_targets.is_empty():
		return
	var valid: Array[Node] = []
	for target: Node in spectator_targets:
		if is_instance_valid(target) and target.get("is_alive"):
			valid.append(target)
	spectator_targets = valid
	if spectator_targets.is_empty():
		return
	spectator_index = posmod(spectator_index + direction, spectator_targets.size())
	hud.show_spectator(str(spectator_targets[spectator_index].name))

func _update_spectator_camera() -> void:
	if not is_instance_valid(spectator_camera) or not spectator_camera.current or spectator_targets.is_empty():
		return
	var target: Node = spectator_targets[spectator_index] if spectator_index < spectator_targets.size() else spectator_targets[0]
	if not is_instance_valid(target) or not target.get("is_alive"):
		_cycle_spectator(1)
		return
	spectator_camera.global_position = target.global_position + Vector3(0, 3.2, 6.5)
	spectator_camera.look_at(target.get_target_point(), Vector3.UP)

func _schedule_respawn(actor: Node) -> void:
	var delay := FfaRules.respawn_delay()
	get_tree().create_timer(delay).timeout.connect(func() -> void:
		if state != "COMBAT" or not is_instance_valid(actor):
			return
		var spawns := arena.get_spawns("ffa")
		var index := int(abs(actor.get_instance_id())) % spawns.size()
		actor.reset_at(spawns[index], 1.2)
		if actor == player:
			player.camera.current = true
			hud.hide_spectator()
			if hud.mobile_controls != null:
				hud.mobile_controls.release_all()
				hud.mobile_controls.visible = true
			hud.set_status("REAPARECIENDO", Color("#91e6ff"))
	)

func _finish_ffa() -> void:
	if state == "FINISHED":
		return
	state = "FINISHED"
	Input.set_mouse_mode(Input.MOUSE_MODE_VISIBLE)
	var winner_name := str(ffa_winner.name) if is_instance_valid(ffa_winner) else "GANADOR"
	hud.show_match_end("VICTORIA FFA", "%s alcanza 20 eliminaciones" % winner_name)

func retry() -> void:
	ally_rounds = 0
	enemy_rounds = 0
	round_number = 1
	coins = 1300
	state = "BUY"
	if is_instance_valid(hud.end_panel):
		hud.end_panel.queue_free()
		hud.end_panel = null
	_start_round()

func get_player_kills() -> int:
	return int(kills.get(player.get_instance_id(), 0)) if player != null else 0

func _clear_actors() -> void:
	if is_instance_valid(player):
		player.queue_free()
	player = null
	for bot: BlockfireBot in bots:
		if is_instance_valid(bot):
			bot.queue_free()
	bots.clear()
	spectator_targets.clear()
	if is_instance_valid(spectator_camera):
		spectator_camera.queue_free()
		spectator_camera = null
