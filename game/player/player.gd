class_name BlockfirePlayer
extends CharacterBody3D

signal health_changed(value: float, maximum: float)
signal player_died(player: Node, killer: Node)

var match_context: Node
var mobile_controls: Node
var team: String = "ally"
var operator_id: String = "BRAVO"
var is_bot: bool = false
var is_alive: bool = true
var input_enabled: bool = true
var health: float = 200.0
var max_health: float = 200.0
var spawn_immunity: float = 0.0
var crouched: bool = false
var camera: Camera3D
var camera_pivot: Node3D
var weapon: WeaponController
var visual: OperatorVisual
var feedback_audio: AudioStreamPlayer3D
var look_yaw: float = 0.0
var look_pitch: float = 0.0
var jump_requested: bool = false
var assist_target: Node
var camera_recoil: float = 0.0
var gravity: float = 22.0
var walk_speed: float = 6.6
var sprint_speed: float = 9.2
var crouch_speed: float = 3.7
var acceleration: float = 32.0
var assist_break_timer: float = 0.0
var step_timer: float = 0.0
var last_damage_headshot: bool = false

func configure(context: Node, team_id: String, selected_operator: String, controls: Node = null) -> void:
	match_context = context
	team = team_id
	operator_id = selected_operator
	mobile_controls = controls

func _ready() -> void:
	add_to_group("combatants")
	collision_layer = 2
	# Los cuerpos de jugadores y bots comparten la capa 2: bloquear el solape
	# evita que un rival atraviese la cámara en el combate FFA.
	collision_mask = 1 | 2
	_create_collision()
	_create_visual()
	_create_camera()
	feedback_audio = AudioStreamPlayer3D.new()
	feedback_audio.name = "PlayerFeedbackSfx"
	feedback_audio.bus = "SFX"
	feedback_audio.max_distance = 24.0
	add_child(feedback_audio)
	health_changed.emit(health, max_health)

func _notification(what: int) -> void:
	if what == NOTIFICATION_APPLICATION_FOCUS_OUT \
			or what == NOTIFICATION_APPLICATION_PAUSED \
			or what == NOTIFICATION_WM_WINDOW_FOCUS_OUT:
		if mobile_controls != null and mobile_controls.has_method("release_all"):
			mobile_controls.release_all()
		if weapon != null:
			weapon.clear_combat_input()

func _physics_process(delta: float) -> void:
	assist_break_timer = maxf(0.0, assist_break_timer - delta)
	camera_recoil = move_toward(camera_recoil, 0.0, delta * 5.0)
	if spawn_immunity > 0.0:
		spawn_immunity = maxf(0.0, spawn_immunity - delta)
	if not is_alive:
		return
	if match_context != null and match_context.has_method("is_combat_active") and not match_context.is_combat_active():
		input_enabled = false
		if weapon != null:
			weapon.clear_combat_input()
		velocity.x = move_toward(velocity.x, 0.0, acceleration * delta)
		velocity.z = move_toward(velocity.z, 0.0, acceleration * delta)
		_apply_gravity(delta)
		move_and_slide()
		return
	_update_look(delta)
	if not input_enabled:
		velocity.x = move_toward(velocity.x, 0.0, acceleration * delta)
		velocity.z = move_toward(velocity.z, 0.0, acceleration * delta)
		_apply_gravity(delta)
		move_and_slide()
		return
	var input_vector := _movement_input()
	var wish_direction := _camera_relative_direction(input_vector)
	var sprinting := Input.is_action_pressed("sprint")
	if mobile_controls != null and mobile_controls.has_method("is_sprinting"):
		sprinting = sprinting or mobile_controls.is_sprinting()
	var target_speed := crouch_speed if crouched else (sprint_speed if sprinting else walk_speed)
	velocity.x = move_toward(velocity.x, wish_direction.x * target_speed, acceleration * delta)
	velocity.z = move_toward(velocity.z, wish_direction.z * target_speed, acceleration * delta)
	_apply_gravity(delta)
	if _jump_pressed() and is_on_floor():
		velocity.y = 8.4
		_play_feedback("res://assets/sfx/jump.ogg")
	if _crouch_pressed():
		crouched = not crouched
		_update_crouch_visual()
	if weapon != null:
		weapon.set_fire_held(Input.is_action_pressed("fire") or _mobile_fire())
		weapon.set_aim_held(Input.is_action_pressed("aim") or _mobile_aim())
		if Input.is_action_just_pressed("reload") or _mobile_reload():
			weapon.request_reload()
		if Input.is_action_just_pressed("previous_weapon"):
			weapon.previous_weapon()
		if Input.is_action_just_pressed("next_weapon") or _mobile_next_weapon():
			weapon.next_weapon()
		if Input.is_action_just_pressed("switch_weapon"):
			weapon.switch_to(0)
	_update_body_rotation(delta, wish_direction)
	move_and_slide()
	_update_footsteps(delta)
	if visual != null:
		var horizontal_speed := Vector2(velocity.x, velocity.z).length()
		visual.set_combat_state(horizontal_speed > 0.15, weapon != null and weapon.fire_held, weapon != null and weapon.aim_held, horizontal_speed / maxf(walk_speed, 0.1))
	if camera != null:
		var target_fov := 54.0 if (weapon != null and weapon.aim_held) else 70.0
		camera.fov = lerpf(camera.fov, target_fov, delta * 12.0)

func _unhandled_input(event: InputEvent) -> void:
	if not input_enabled or is_bot:
		return
	if event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_LEFT and event.pressed:
		Input.set_mouse_mode(Input.MOUSE_MODE_CAPTURED)
	if event is InputEventMouseMotion and Input.mouse_mode == Input.MOUSE_MODE_CAPTURED:
		var motion: Vector2 = event.relative * _look_sensitivity()
		look_yaw -= motion.x
		look_pitch = clampf(look_pitch - motion.y, -78.0, 78.0)
	if event is InputEventKey and event.pressed and not event.echo:
		match event.physical_keycode:
			KEY_1: weapon.switch_to(0)
			KEY_2: weapon.switch_to(1)
			KEY_3: weapon.switch_to(2)
			KEY_4: weapon.switch_to(3)
			KEY_ESCAPE: Input.set_mouse_mode(Input.MOUSE_MODE_VISIBLE)

func take_damage(amount: float, source: Node, headshot: bool = false) -> bool:
	if not can_use_combat() or spawn_immunity > 0.0:
		return false
	health = maxf(0.0, health - amount)
	last_damage_headshot = headshot
	health_changed.emit(health, max_health)
	if match_context != null and match_context.has_method("register_damage"):
		match_context.register_damage(self, amount, headshot, source)
	if health <= 0.0:
		_play_feedback("res://assets/sfx/sfx_death.ogg")
		_die(source)
	else:
		_play_feedback("res://assets/sfx/sfx_hurt.ogg")
	return true

func _die(killer: Node) -> void:
	if not is_alive:
		return
	is_alive = false
	input_enabled = false
	visible = false
	collision_layer = 0
	collision_mask = 0
	if weapon != null:
		weapon.clear_combat_input()
	if mobile_controls != null and mobile_controls.has_method("release_all"):
		mobile_controls.release_all()
	# Cámara de muerte: cae al piso y mira hacia abajo. A la altura de ojos la
	# cámara quedaba dentro de los bots que se aglomeran sobre el cadáver y el
	# jugador veía un blob gigante durante todo el tiempo de respawn.
	if camera_pivot != null:
		camera_pivot.position.y = 0.5
	look_pitch = -34.0
	player_died.emit(self, killer)

func reset_at(spawn: Vector3, immunity: float = 2.0) -> void:
	if mobile_controls != null and mobile_controls.has_method("release_all"):
		mobile_controls.release_all()
	global_position = spawn
	velocity = Vector3.ZERO
	health = max_health
	is_alive = true
	input_enabled = true
	visible = true
	spawn_immunity = immunity
	collision_layer = 2
	collision_mask = 1 | 2
	health_changed.emit(health, max_health)
	look_pitch = 0.0
	look_yaw = rotation_degrees.y
	if camera_pivot != null:
		camera_pivot.position.y = 1.58
	assist_target = null
	assist_break_timer = 0.0
	camera_recoil = 0.0
	last_damage_headshot = false
	_play_feedback("res://assets/sfx/respawn.ogg")

func break_spawn_immunity() -> void:
	spawn_immunity = 0.0

func can_use_combat() -> bool:
	return is_alive and input_enabled and (match_context == null or not match_context.has_method("is_combat_active") or bool(match_context.is_combat_active()))

func apply_weapon_recoil(amount: float, ads: bool) -> void:
	if not can_use_combat():
		return
	var kick := rad_to_deg(amount) * (0.72 if ads else 0.9)
	camera_recoil += kick
	look_pitch = clampf(look_pitch + kick, -78.0, 78.0)

func _play_feedback(path: String) -> void:
	if feedback_audio == null:
		return
	feedback_audio.stream = load(path) as AudioStream
	feedback_audio.play()

func _update_footsteps(delta: float) -> void:
	var horizontal_speed := Vector2(velocity.x, velocity.z).length()
	if not is_on_floor() or horizontal_speed < 1.0:
		step_timer = 0.0
		return
	step_timer -= delta
	if step_timer > 0.0:
		return
	step_timer = lerpf(0.48, 0.27, clampf(horizontal_speed / sprint_speed, 0.0, 1.0))
	_play_feedback("res://assets/sfx/step.ogg" if int(Time.get_ticks_msec() / 100) % 2 == 0 else "res://assets/sfx/step2.ogg")

func get_team() -> String:
	return team

func get_target_point() -> Vector3:
	return global_position + Vector3.UP * (1.35 if crouched else 1.7)

## Punto de asistencia independiente del hitbox de cabeza: la ayuda móvil
## acompaña el torso visible, conserva línea de visión y nunca decide disparar.
func get_assist_point() -> Vector3:
	return global_position + Vector3.UP * (0.96 if crouched else 1.22)

func get_aim_origin() -> Vector3:
	return camera.global_position if camera != null else global_position + Vector3.UP * 1.6

func get_mobile_assisted_direction(base_direction: Vector3, max_range: float) -> Vector3:
	if not can_use_combat() or mobile_controls == null or match_context == null or not match_context.has_method("get_combatants"):
		return base_direction
	var origin := get_aim_origin()
	var chosen := _select_assist_target(base_direction, max_range, origin)
	if chosen == null:
		assist_target = null
		return base_direction
	assist_target = chosen
	var assisted_point: Vector3 = chosen.get_assist_point() if chosen.has_method("get_assist_point") else chosen.get_target_point()
	var assisted_direction := origin.direction_to(assisted_point)
	var angle_to_target := rad_to_deg(acos(clampf(base_direction.normalized().dot(assisted_direction), -1.0, 1.0)))
	var follow_strength := 0.70 if weapon != null and weapon.aim_held else 0.54
	follow_strength *= 1.0 - clampf(angle_to_target / 27.0, 0.0, 1.0) * 0.24
	return base_direction.normalized().lerp(assisted_direction, follow_strength).normalized()

func _select_assist_target(base_direction: Vector3, max_range: float, origin: Vector3) -> Node:
	if match_context == null or not match_context.has_method("get_combatants") or max_range <= 0.0:
		return null
	var direction := base_direction.normalized()
	if direction.length_squared() < 0.01:
		return null
	var chosen: Node
	var chosen_score := -INF
	var candidates: Array[Node] = match_context.get_combatants()
	for candidate: Node in candidates:
		if candidate == self or not is_instance_valid(candidate) or not bool(candidate.get("is_alive")):
			continue
		if not candidate.has_method("get_team") or candidate.get_team() == team:
			continue
		var target_point: Vector3 = candidate.get_assist_point() if candidate.has_method("get_assist_point") else candidate.global_position + Vector3.UP * 1.22
		var to_target := origin.direction_to(target_point)
		var dot := clampf(direction.dot(to_target), -1.0, 1.0)
		var angle := acos(dot)
		var cone := deg_to_rad(31.0) if candidate == assist_target else deg_to_rad(22.0)
		if angle > cone or origin.distance_to(target_point) > max_range:
			continue
		if not _assist_has_line_of_sight(origin, target_point):
			continue
		var distance_score := 1.0 - clampf(origin.distance_to(target_point) / max_range, 0.0, 1.0)
		var score := dot * 0.78 + distance_score * 0.22
		if score > chosen_score:
			chosen_score = score
			chosen = candidate
	return chosen

func _assist_has_line_of_sight(origin: Vector3, target_point: Vector3) -> bool:
	var arena: Node = match_context.get_arena() if match_context.has_method("get_arena") else null
	if arena != null and arena.has_method("has_line_of_sight"):
		var excluded: Array[RID] = [get_rid()]
		return arena.has_line_of_sight(origin, target_point, excluded)
	return true

func set_spectator_mode(enabled: bool) -> void:
	input_enabled = not enabled and is_alive

func _movement_input() -> Vector2:
	var value := Input.get_vector("move_left", "move_right", "move_forward", "move_back")
	if mobile_controls != null and mobile_controls.has_method("get_move_vector"):
		var touch_value: Vector2 = mobile_controls.get_move_vector()
		if touch_value.length_squared() > 0.001:
			value = touch_value
	return value

func _update_look(delta: float) -> void:
	var look := Vector2.ZERO
	if mobile_controls != null and mobile_controls.has_method("consume_look_delta"):
		look = mobile_controls.consume_look_delta()
	var sensitivity := _look_sensitivity()
	look_yaw -= look.x * sensitivity
	look_pitch = clampf(look_pitch - look.y * sensitivity, -78.0, 78.0)
	_apply_rotational_assist(delta, look)
	if camera_pivot != null:
		# look_yaw is an absolute world heading; the pivot is a child of the
		# actor, so convert it to a local orbit. Looking around no longer rotates
		# the whole body; the body turns only while moving/aiming below.
		camera_pivot.rotation_degrees.y = look_yaw - rotation_degrees.y
		camera_pivot.rotation_degrees.x = look_pitch

func _camera_relative_direction(input_vector: Vector2) -> Vector3:
	if input_vector.length_squared() < 0.001:
		return Vector3.ZERO
	var direction := Vector3(input_vector.x, 0.0, input_vector.y)
	if camera_pivot != null:
		direction = camera_pivot.global_transform.basis * direction
	direction.y = 0.0
	return direction.normalized()

func _update_body_rotation(delta: float, movement_direction: Vector3) -> void:
	var target_yaw := rotation.y
	var should_face_camera := weapon != null and (weapon.aim_held or weapon.fire_held)
	if should_face_camera:
		target_yaw = deg_to_rad(look_yaw)
	elif movement_direction.length_squared() > 0.01:
		target_yaw = atan2(-movement_direction.x, -movement_direction.z)
	else:
		return
	rotation.y = lerp_angle(rotation.y, target_yaw, clampf(delta * 11.0, 0.0, 1.0))

func _apply_rotational_assist(delta: float, look_input: Vector2) -> void:
	if not can_use_combat() or mobile_controls == null or match_context == null or camera == null:
		return
	# Rotational assist is an ADS/fire aid, never a free-look magnet. The old
	# is_looking branch pulled the camera toward every candidate while the thumb
	# merely panned, which read as wall/cover lock-on on a phone.
	var engaged: bool = _mobile_fire() or _mobile_aim() \
		or Input.is_action_pressed("aim") or Input.is_action_pressed("fire")
	if not engaged:
		assist_target = null
		return
	if look_input.length() > 18.0:
		assist_break_timer = 0.24
	if assist_break_timer > 0.0:
		return
	var origin := get_aim_origin()
	var target := _select_assist_target(-camera.global_transform.basis.z, 70.0, origin)
	if target == null:
		assist_target = null
		return
	assist_target = target
	var target_point: Vector3 = target.get_assist_point() if target.has_method("get_assist_point") else target.get_target_point()
	var target_direction := origin.direction_to(target_point)
	var desired_yaw := rad_to_deg(atan2(-target_direction.x, -target_direction.z))
	var desired_pitch := rad_to_deg(asin(clampf(target_direction.y, -1.0, 1.0)))
	var yaw_error := wrapf(desired_yaw - look_yaw, -180.0, 180.0)
	var pitch_error := desired_pitch - look_pitch
	var follow_rate := 15.0 if _uses_ads() else 10.0
	var blend := clampf(delta * follow_rate, 0.0, 0.28)
	look_yaw = wrapf(look_yaw + yaw_error * blend, -360.0, 360.0)
	look_pitch = clampf(look_pitch + pitch_error * blend, -78.0, 78.0)

func _uses_ads() -> bool:
	return (weapon != null and weapon.aim_held) or Input.is_action_pressed("aim") or _mobile_aim()

func _look_sensitivity() -> float:
	var settings := _settings()
	var sensitivity := float(settings.get_value("sensitivity", 0.12) if settings != null else 0.12)
	if not _uses_ads():
		return sensitivity
	var multiplier := float(settings.get_value("ads_multiplier", 0.72) if settings != null else 0.72)
	return sensitivity * clampf(multiplier, 0.1, 1.0)

func _apply_gravity(delta: float) -> void:
	if not is_on_floor():
		velocity.y -= gravity * delta
	else:
		velocity.y = minf(velocity.y, 0.0)

func _jump_pressed() -> bool:
	if Input.is_action_just_pressed("jump"):
		return true
	if mobile_controls != null and mobile_controls.has_method("consume_jump"):
		return mobile_controls.consume_jump()
	return false

func _crouch_pressed() -> bool:
	if Input.is_action_just_pressed("crouch"):
		return true
	return mobile_controls != null and mobile_controls.has_method("consume_crouch") and mobile_controls.consume_crouch()

func _mobile_fire() -> bool:
	return mobile_controls != null and mobile_controls.has_method("is_firing") and mobile_controls.is_firing()

func _mobile_aim() -> bool:
	return mobile_controls != null and mobile_controls.has_method("is_aiming") and mobile_controls.is_aiming()

func _mobile_reload() -> bool:
	return mobile_controls != null and mobile_controls.has_method("consume_reload") and mobile_controls.consume_reload()

func _mobile_next_weapon() -> bool:
	return mobile_controls != null and mobile_controls.has_method("consume_switch") and mobile_controls.consume_switch()

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
	var head_sphere := SphereShape3D.new()
	head_sphere.radius = 0.2
	head_shape.shape = head_sphere
	# Keep the head above the body capsule so a head ray resolves the Area3D
	# instead of being swallowed by the full-height body collider.
	head_shape.position.y = 2.16
	head.add_child(head_shape)
	add_child(head)

func _create_visual() -> void:
	visual = OperatorVisual.new()
	# El avatar del jugador no depende del operator_id deprecado: la ropa
	# viene del loadout persistido en SettingsStore (claves cosmetic_*).
	# is_human=true: único que puede leer el loadout persistido.
	visual.configure(operator_id, team, _team_color(), {}, true)
	visual.visible = true
	add_child(visual)

func _create_camera() -> void:
	camera_pivot = Node3D.new()
	camera_pivot.name = "CameraPivot"
	camera_pivot.position = Vector3(0, 1.52, 0)
	add_child(camera_pivot)
	camera = Camera3D.new()
	camera.name = "PlayerCamera"
	camera.current = true
	camera.fov = 70.0
	camera.near = 0.10
	# Cámara sobre el hombro: el avatar, la mochila y el arma permanecen en
	# cuadro. El raycast sigue saliendo de esta cámara, no del modelo.
	camera.position = Vector3(0.62, 0.22, 3.85)
	camera_pivot.add_child(camera)
	weapon = WeaponController.new()
	weapon.name = "WeaponController"
	add_child(weapon)
	weapon.setup(self, camera, mobile_controls)

func _update_crouch_visual() -> void:
	if visual != null:
		visual.scale.y = 0.72 if crouched else 1.0
	if camera_pivot != null:
		camera_pivot.position.y = 1.18 if crouched else 1.58

func _team_color() -> Color:
	return Color("#4fd6e9") if team == "ally" else Color("#da4f68")

func _settings() -> Node:
	return get_node_or_null("/root/SettingsStore") if is_inside_tree() else null
