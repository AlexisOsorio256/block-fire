class_name BlockfireBot
extends CharacterBody3D

signal bot_died(bot: Node, killer: Node)

const MIN_PLAYER_SEPARATION: float = 4.5

var match_context: Node
var team: String = "enemy"
var operator_id: String = "VULTURE"
var role: BotRole = BotRole.make("support")
var is_bot: bool = true
var is_alive: bool = true
var health: float = 200.0
var max_health: float = 200.0
var bot_accuracy: float = 0.68
var difficulty_bonus: float = 0.0
var spawn_immunity: float = 0.0
var weapon: WeaponController
var visual: OperatorVisual
var feedback_audio: AudioStreamPlayer3D
var navigation_agent: NavigationAgent3D
var target: Node
var target_refresh: float = 0.0
var stuck_timer: float = 0.0
var last_position: Vector3
var orbit_sign: float = 1.0
var target_memory_position: Vector3 = Vector3.ZERO
var target_memory_timer: float = 0.0
var navigation_safe_velocity: Vector3 = Vector3.ZERO
var has_navigation_safe_velocity: bool = false
var reposition_timer: float = 0.0
var death_hide_timer: float = 0.0
var last_damage_headshot: bool = false
var rng := RandomNumberGenerator.new()

func configure(context: Node, team_id: String, selected_operator: String, role_id: String, difficulty_bonus: float = 0.0) -> void:
	match_context = context
	team = team_id
	operator_id = selected_operator
	role = BotRole.make(role_id)
	self.difficulty_bonus = clampf(difficulty_bonus, 0.0, 0.2)
	# Enemy advantage is deliberately distributed: a little faster reaction,
	# slightly better shot quality and more willingness to reposition/recover.
	bot_accuracy = clampf(role.accuracy + self.difficulty_bonus * 0.32, 0.28, 0.9)
	rng.randomize()
	orbit_sign = -1.0 if hash(name) % 2 == 0 else 1.0
	reposition_timer = rng.randf_range(0.2, 1.0)

func _ready() -> void:
	add_to_group("combatants")
	collision_layer = 2
	# Mantiene separados los cuerpos de combatientes para que no atraviesen
	# la cámara del jugador cuando se acercan en FFA.
	collision_mask = 1 | 2
	_create_collision()
	visual = OperatorVisual.new()
	# El operator_id ya no elige un héroe: solo alimenta la variación
	# determinista de ropa (CosmeticCatalog.bot_loadout_for).
	visual.configure(operator_id, team, _team_color())
	add_child(visual)
	feedback_audio = AudioStreamPlayer3D.new()
	feedback_audio.name = "BotFeedbackSfx"
	feedback_audio.bus = "SFX"
	feedback_audio.max_distance = 24.0
	add_child(feedback_audio)
	navigation_agent = NavigationAgent3D.new()
	navigation_agent.name = "NavigationAgent3D"
	navigation_agent.path_height_offset = 0.0
	navigation_agent.path_desired_distance = 0.55
	navigation_agent.path_max_distance = 2.5
	navigation_agent.target_desired_distance = 1.1
	navigation_agent.radius = 0.5
	navigation_agent.neighbor_distance = 8.0
	navigation_agent.max_neighbors = 6
	navigation_agent.max_speed = 7.5
	navigation_agent.time_horizon = 0.65
	navigation_agent.avoidance_enabled = true
	navigation_agent.velocity_computed.connect(_on_navigation_velocity_computed)
	add_child(navigation_agent)
	weapon = WeaponController.new()
	weapon.name = "WeaponController"
	add_child(weapon)
	weapon.setup(self)
	last_position = global_position

func _physics_process(delta: float) -> void:
	if death_hide_timer > 0.0:
		death_hide_timer = maxf(0.0, death_hide_timer - delta)
		if death_hide_timer <= 0.0:
			visible = false
	if spawn_immunity > 0.0:
		spawn_immunity = maxf(0.0, spawn_immunity - delta)
	if target_memory_timer > 0.0:
		target_memory_timer = maxf(0.0, target_memory_timer - delta)
	reposition_timer = maxf(0.0, reposition_timer - delta)
	if not is_alive or match_context == null:
		return
	if match_context.has_method("is_combat_active") and not match_context.is_combat_active():
		_stop_navigation()
		weapon.clear_combat_input()
		_move_with_velocity(Vector3.ZERO, delta)
		return
	target_refresh -= delta
	if target_refresh <= 0.0:
		target_refresh = maxf(0.12, role.reaction - difficulty_bonus * 0.55)
		_acquire_target()
	var movement_target := Vector3.ZERO
	var can_see := false
	var target_alive := is_instance_valid(target) and bool(target.get("is_alive"))
	if target_alive:
		var target_position: Vector3 = target.get_target_point()
		var distance := global_position.distance_to(target_position)
		can_see = _has_line_of_sight(target_position)
		if can_see:
			target_memory_position = Vector3(target_position.x, 0.2, target_position.z)
			target_memory_timer = 1.35
		if can_see or target_memory_timer > 0.0:
			movement_target = _movement_intent(target_position, distance, can_see)
	elif not is_instance_valid(target) or target_memory_timer <= 0.0:
		target = null
	if target == null or not is_instance_valid(target) or not bool(target.get("is_alive")):
		if target_memory_timer > 0.0:
			movement_target = target_memory_position
		elif match_context.has_method("get_rally_point"):
			movement_target = match_context.get_rally_point(team)
		weapon.set_ai_target(null, false)
		weapon.set_fire_held(false)
	else:
		weapon.set_ai_target(target, can_see)
		var target_distance := global_position.distance_to(target.get_target_point())
		weapon.set_fire_held(can_see and target_distance <= current_weapon_range())
	if movement_target.length_squared() > 0.01:
		movement_target.y = 0.2
		navigation_agent.target_position = movement_target
	var desired_velocity := _navigation_velocity(4.4 + (role.aggression + difficulty_bonus * 0.45) * 1.5)
	var separation_velocity := _player_separation_velocity()
	if separation_velocity.length_squared() > 0.01:
		# El path sigue siendo la autoridad normal; esta salida de emergencia solo
		# evita que la silueta de un bot ocupe la cámara del jugador.
		_stop_navigation()
		desired_velocity = separation_velocity
	_move_with_velocity(desired_velocity, delta)
	var bot_speed := desired_velocity.length()
	# Los bots no tienen tecla de sprint: su clase de velocidad se deriva de la
	# velocidad de navegación real (el clip SprintFwd declara 7.0 m/s).
	visual.set_combat_state(bot_speed > 0.1, weapon.fire_held, weapon.fire_held and can_see, bot_speed, bot_speed >= 6.0)
	if desired_velocity.length_squared() > 0.1 or (target_alive and can_see):
		var facing := desired_velocity.normalized()
		if target_alive and can_see:
			facing = global_position.direction_to(target.get_target_point())
			facing.y = 0.0
			facing = facing.normalized()
		if facing.length_squared() > 0.001:
			rotation.y = lerp_angle(rotation.y, atan2(-facing.x, -facing.z), delta * 6.0)
	if global_position.distance_to(last_position) < 0.03 and desired_velocity.length_squared() > 0.1:
		stuck_timer += delta
		if stuck_timer > maxf(0.72, 1.0 - difficulty_bonus * 1.6):
			_recover_from_stuck()
	else:
		stuck_timer = 0.0
	last_position = global_position

func _movement_intent(target_position: Vector3, distance: float, can_see: bool) -> Vector3:
	if not can_see:
		return target_memory_position
	var flat_to_target := global_position.direction_to(target_position)
	flat_to_target.y = 0.0
	if flat_to_target.length_squared() < 0.01:
		return global_position
	flat_to_target = flat_to_target.normalized()
	var ideal := role.preferred_distance
	if distance > ideal + 2.0:
		return Vector3(target_position.x, 0.2, target_position.z)
	if distance < ideal - 2.0:
		return Vector3(target_position.x, 0.2, target_position.z) - flat_to_target * maxf(ideal, 6.0)
	# Anchor holds the angle more often; entry creates a readable lateral move.
	# The timer prevents random jitter every frame while still making roles
	# observably different without a behavior-tree layer.
	if reposition_timer > 0.0:
		return global_position
	var reposition_chance := clampf(role.reposition_tendency + difficulty_bonus * 0.55, 0.12, 0.9)
	if rng.randf() > reposition_chance:
		reposition_timer = lerpf(2.8, 1.8, role.reposition_tendency)
		return global_position
	reposition_timer = lerpf(2.8, 1.15, role.reposition_tendency)
	var lateral := Vector3(-flat_to_target.z, 0.0, flat_to_target.x)
	var orbit_distance := clampf(ideal * 0.42, 3.0, 8.0)
	return Vector3(target_position.x, 0.2, target_position.z) + lateral * orbit_sign * orbit_distance

func _navigation_velocity(speed: float) -> Vector3:
	if NavigationServer3D.map_get_iteration_id(navigation_agent.get_navigation_map()) == 0:
		return Vector3.ZERO
	if navigation_agent.is_navigation_finished():
		return Vector3.ZERO
	var next_path_position := navigation_agent.get_next_path_position()
	var direction := global_position.direction_to(next_path_position)
	direction.y = 0.0
	if direction.length_squared() < 0.001:
		return Vector3.ZERO
	return direction.normalized() * speed

func _player_separation_velocity() -> Vector3:
	if match_context == null or not is_instance_valid(target):
		return Vector3.ZERO
	if target != match_context.get("player") or not bool(target.get("is_alive")):
		return Vector3.ZERO
	var target_position: Vector3 = target.global_position
	var offset: Vector3 = global_position - target_position
	offset.y = 0.0
	var distance: float = offset.length()
	if distance >= MIN_PLAYER_SEPARATION:
		return Vector3.ZERO
	if distance < 0.01:
		offset = Vector3.RIGHT if get_instance_id() % 2 == 0 else Vector3.FORWARD
	return offset.normalized() * 6.0

func _move_with_velocity(wanted_velocity: Vector3, delta: float) -> void:
	var movement_velocity := wanted_velocity
	if navigation_agent != null and navigation_agent.avoidance_enabled:
		navigation_agent.set_velocity(wanted_velocity)
		if has_navigation_safe_velocity:
			movement_velocity = navigation_safe_velocity
	velocity.x = move_toward(velocity.x, movement_velocity.x, 16.0 * delta)
	velocity.z = move_toward(velocity.z, movement_velocity.z, 16.0 * delta)
	if not is_on_floor():
		velocity.y -= 22.0 * delta
	else:
		velocity.y = 0.0
	move_and_slide()

func _on_navigation_velocity_computed(safe_velocity: Vector3) -> void:
	navigation_safe_velocity = safe_velocity
	has_navigation_safe_velocity = true

func _stop_navigation() -> void:
	if navigation_agent == null:
		return
	navigation_agent.set_velocity(Vector3.ZERO)
	navigation_agent.set_velocity_forced(Vector3.ZERO)
	has_navigation_safe_velocity = false

func _recover_from_stuck() -> void:
	orbit_sign *= -1.0
	target_refresh = 0.0
	stuck_timer = 0.0
	target_memory_timer = 0.0
	if is_instance_valid(target) and target.get("is_alive"):
		# A new tactical point is selected on the next perception tick; the
		# navigation agent remains the source of movement and never teleports.
		navigation_agent.target_position = global_position
	else:
		target = null
	_stop_navigation()

func take_damage(amount: float, source: Node, headshot: bool = false) -> bool:
	if not can_use_combat() or spawn_immunity > 0.0:
		return false
	health = maxf(0.0, health - amount)
	last_damage_headshot = headshot
	if match_context.has_method("register_damage"):
		match_context.register_damage(self, amount, headshot, source)
	if health <= 0.0:
		_play_feedback("res://assets/sfx/sfx_death.ogg")
		_die(source)
	else:
		_play_feedback("res://assets/sfx/sfx_hurt.ogg")
		if visual != null:
			visual.flinch(clampf(amount / 35.0, 0.35, 1.2))
	return true

func _die(killer: Node) -> void:
	if not is_alive:
		return
	is_alive = false
	# Quaternius Death clip runs 0.77s; hiding at 0.72s cut the settle. 1.1s
	# lets the clip finish plus a short hold before the body disappears.
	death_hide_timer = 1.1
	collision_layer = 0
	collision_mask = 0
	weapon.clear_combat_input()
	if visual != null:
		visual.play_death()
	bot_died.emit(self, killer)

func reset_at(spawn: Vector3, immunity: float = 0.8) -> void:
	_stop_navigation()
	global_position = spawn
	velocity = Vector3.ZERO
	health = max_health
	is_alive = true
	visible = true
	death_hide_timer = 0.0
	spawn_immunity = immunity
	collision_layer = 2
	collision_mask = 1 | 2
	target = null
	target_memory_position = Vector3.ZERO
	target_memory_timer = 0.0
	last_position = global_position
	last_damage_headshot = false
	reposition_timer = rng.randf_range(0.2, 1.0)
	weapon.clear_combat_input()
	if visual != null:
		visual.revive()

func break_spawn_immunity() -> void:
	spawn_immunity = 0.0

func can_use_combat() -> bool:
	return is_alive and (match_context == null or not match_context.has_method("is_combat_active") or bool(match_context.is_combat_active()))

func preferred_weapon_index() -> int:
	for index: int in range(WeaponController.DEFINITIONS.size()):
		if WeaponController.DEFINITIONS[index].id == role.preferred_weapon_id:
			return index
	return 0

func _play_feedback(path: String) -> void:
	if feedback_audio == null:
		return
	feedback_audio.stream = load(path) as AudioStream
	feedback_audio.play()

func get_team() -> String:
	return team

func get_target_point() -> Vector3:
	return global_position + Vector3.UP * 1.62

func get_assist_point() -> Vector3:
	return global_position + Vector3.UP * 1.18

func get_aim_origin() -> Vector3:
	return global_position + Vector3.UP * 1.55

func _acquire_target() -> void:
	var candidates: Array = match_context.get_combatants() if match_context.has_method("get_combatants") else []
	var best: Node
	var best_score := -INF
	var forward := -global_transform.basis.z
	for candidate: Node in candidates:
		if candidate == self or not is_instance_valid(candidate) or not bool(candidate.get("is_alive")):
			continue
		if candidate.has_method("get_team") and candidate.get_team() == team:
			continue
		var candidate_point: Vector3 = candidate.get_target_point() if candidate.has_method("get_target_point") else candidate.global_position + Vector3.UP * 1.4
		var distance := global_position.distance_to(candidate_point)
		if distance > 78.0 or not _within_perception_cone(forward, candidate_point):
			continue
		if not _has_line_of_sight(candidate_point):
			continue
		var direction := global_position.direction_to(candidate_point)
		var visibility_score := forward.dot(direction) * 0.62
		var distance_score := 1.0 - clampf(distance / 78.0, 0.0, 1.0)
		var score := visibility_score + distance_score * 0.38
		if score > best_score:
			best_score = score
			best = candidate
	if best != null:
		target = best
		target_memory_position = Vector3(best.get_target_point().x, 0.2, best.get_target_point().z)
		target_memory_timer = 1.35
	elif not is_instance_valid(target) or not bool(target.get("is_alive")) or target_memory_timer <= 0.0:
		target = null

func _within_perception_cone(forward: Vector3, point: Vector3) -> bool:
	var direction := global_position.direction_to(point)
	direction.y = 0.0
	if direction.length_squared() < 0.01:
		return true
	return forward.dot(direction.normalized()) >= cos(deg_to_rad(95.0))

func _has_line_of_sight(target_position: Vector3) -> bool:
	var arena: Node = match_context.get_arena() if match_context.has_method("get_arena") else null
	if arena != null and arena.has_method("has_line_of_sight"):
		var excluded: Array[RID] = [get_rid()]
		return arena.has_line_of_sight(get_aim_origin(), target_position, excluded)
	return true

func current_weapon_range() -> float:
	return weapon.current_definition().range if weapon != null else 70.0

func _create_collision() -> void:
	var collision := CollisionShape3D.new()
	var capsule := CapsuleShape3D.new()
	capsule.radius = 0.38
	capsule.height = 1.8
	collision.shape = capsule
	collision.position.y = 1.0
	add_child(collision)
	var head := Area3D.new()
	head.name = "HeadHitbox"
	head.collision_layer = 4
	head.collision_mask = 0
	head.set_meta("damage_zone", "head")
	var head_shape := CollisionShape3D.new()
	var sphere := SphereShape3D.new()
	sphere.radius = 0.2
	head_shape.shape = sphere
	head_shape.position.y = 2.16
	head.add_child(head_shape)
	add_child(head)

func _team_color() -> Color:
	return Color("#4fd6e9") if team == "ally" else Color("#da4f68")
