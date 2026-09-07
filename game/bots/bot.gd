class_name BlockfireBot
extends CharacterBody3D

signal bot_died(bot: Node, killer: Node)

var match_context: Node
var team: String = "enemy"
var operator_id: String = "VULTURE"
var role: BotRole = BotRole.make("support")
var is_bot: bool = true
var is_alive: bool = true
var health: float = 200.0
var max_health: float = 200.0
var bot_accuracy: float = 0.68
var spawn_immunity: float = 0.0
var weapon: WeaponController
var visual: OperatorVisual
var navigation_agent: NavigationAgent3D
var target: Node
var target_refresh: float = 0.0
var stuck_timer: float = 0.0
var last_position: Vector3
var orbit_sign: float = 1.0

func configure(context: Node, team_id: String, selected_operator: String, role_id: String, difficulty_bonus: float = 0.0) -> void:
	match_context = context
	team = team_id
	operator_id = selected_operator
	role = BotRole.make(role_id)
	bot_accuracy = clampf(role.accuracy + difficulty_bonus, 0.28, 0.9)
	orbit_sign = -1.0 if hash(name) % 2 == 0 else 1.0

func _ready() -> void:
	add_to_group("combatants")
	collision_layer = 2
	collision_mask = 1
	_create_collision()
	visual = OperatorVisual.new()
	visual.configure(operator_id, team, _team_color())
	add_child(visual)
	navigation_agent = NavigationAgent3D.new()
	navigation_agent.name = "NavigationAgent3D"
	navigation_agent.path_height_offset = 0.0
	navigation_agent.path_desired_distance = 1.2
	navigation_agent.target_desired_distance = role.preferred_distance
	navigation_agent.radius = 0.55
	navigation_agent.avoidance_enabled = true
	add_child(navigation_agent)
	weapon = WeaponController.new()
	weapon.name = "WeaponController"
	add_child(weapon)
	weapon.setup(self)
	last_position = global_position

func _physics_process(delta: float) -> void:
	if spawn_immunity > 0.0:
		spawn_immunity = maxf(0.0, spawn_immunity - delta)
	if not is_alive or match_context == null:
		return
	if match_context.has_method("is_combat_active") and not match_context.is_combat_active():
		weapon.set_fire_held(false)
		velocity.x = move_toward(velocity.x, 0.0, 16.0 * delta)
		velocity.z = move_toward(velocity.z, 0.0, 16.0 * delta)
		if not is_on_floor():
			velocity.y -= 22.0 * delta
		move_and_slide()
		return
	target_refresh -= delta
	if target_refresh <= 0.0:
		target_refresh = 0.24
		_acquire_target()
	var desired := Vector3.ZERO
	var can_see := false
	if is_instance_valid(target) and target.get("is_alive"):
		var target_position: Vector3 = target.get_target_point()
		var distance := global_position.distance_to(target_position)
		can_see = _has_line_of_sight(target_position)
		if can_see and distance <= current_weapon_range() * 0.92:
			var to_target := global_position.direction_to(target_position)
			var ideal := role.preferred_distance
			if distance > ideal + 2.0:
				desired = to_target
			elif distance < ideal - 2.0:
				desired = -to_target
			else:
				desired = Vector3(-to_target.z, 0, to_target.x) * orbit_sign
		else:
			desired = global_position.direction_to(target_position)
		navigation_agent.target_position = target_position
		weapon.set_ai_target(target, can_see)
		weapon.set_fire_held(can_see and distance <= current_weapon_range())
	else:
		var rally: Vector3 = Vector3.ZERO
		if match_context.has_method("get_rally_point"):
			rally = match_context.get_rally_point(team)
		desired = global_position.direction_to(rally)
		weapon.set_ai_target(null, false)
		weapon.set_fire_held(false)
	if desired.length_squared() > 0.01:
		desired.y = 0.0
		desired = desired.normalized()
		var speed := 4.4 + role.aggression * 1.5
		velocity.x = move_toward(velocity.x, desired.x * speed, 16.0 * delta)
		velocity.z = move_toward(velocity.z, desired.z * speed, 16.0 * delta)
		rotation.y = lerp_angle(rotation.y, atan2(-desired.x, -desired.z), delta * 6.0)
	else:
		velocity.x = move_toward(velocity.x, 0.0, 16.0 * delta)
		velocity.z = move_toward(velocity.z, 0.0, 16.0 * delta)
	if not is_on_floor():
		velocity.y -= 22.0 * delta
	else:
		velocity.y = 0.0
	move_and_slide()
	if global_position.distance_to(last_position) < 0.03 and desired.length_squared() > 0.1:
		stuck_timer += delta
		if stuck_timer > 1.2:
			orbit_sign *= -1.0
			target_refresh = 0.0
			stuck_timer = 0.0
	else:
		stuck_timer = 0.0
	last_position = global_position

func take_damage(amount: float, source: Node, headshot: bool = false) -> void:
	if not is_alive or spawn_immunity > 0.0:
		return
	health = maxf(0.0, health - amount)
	if match_context.has_method("register_damage"):
		match_context.register_damage(self, amount, headshot, source)
	if health <= 0.0:
		_die(source)

func _die(killer: Node) -> void:
	if not is_alive:
		return
	is_alive = false
	visible = false
	collision_layer = 0
	collision_mask = 0
	weapon.set_fire_held(false)
	bot_died.emit(self, killer)

func reset_at(spawn: Vector3, immunity: float = 0.8) -> void:
	global_position = spawn
	velocity = Vector3.ZERO
	health = max_health
	is_alive = true
	visible = true
	spawn_immunity = immunity
	collision_layer = 2
	collision_mask = 1
	target = null
	last_position = global_position

func get_team() -> String:
	return team

func get_target_point() -> Vector3:
	return global_position + Vector3.UP * 1.62

func get_aim_origin() -> Vector3:
	return global_position + Vector3.UP * 1.55

func _acquire_target() -> void:
	var candidates: Array = match_context.get_combatants() if match_context.has_method("get_combatants") else []
	var nearest: Node
	var nearest_distance := INF
	for candidate: Node in candidates:
		if candidate == self or not is_instance_valid(candidate) or not candidate.get("is_alive"):
			continue
		if candidate.has_method("get_team") and candidate.get_team() == team:
			continue
		var distance := global_position.distance_squared_to(candidate.global_position)
		if distance < nearest_distance:
			nearest_distance = distance
			nearest = candidate
	target = nearest

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
	sphere.radius = 0.27
	head_shape.shape = sphere
	head_shape.position.y = 1.95
	head.add_child(head_shape)
	add_child(head)

func _team_color() -> Color:
	return Color("#f0a064") if team == "ally" else Color("#da4f68")
