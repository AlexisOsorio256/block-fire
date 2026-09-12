class_name BlockfirePlayer
extends CharacterBody3D

## Owns gameplay displacement and camera orbit/collision. Physics order:
## look/input → velocity/body turn → move_and_slide → camera orbit/collision.
## Animation only reads movement; CameraFX owns camera shake, never the pivot.

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
var body_collision: CollisionShape3D
var head_hitbox: Area3D
var head_collision: CollisionShape3D
var look_yaw: float = 0.0
var look_pitch: float = 0.0
var jump_requested: bool = false
var assist_target: Node
var camera_recoil: float = 0.0
## Offset de cámara sobre el hombro derecho, en espacio del pivote.
const CAMERA_OFFSET := Vector3(0.55, 0.20, 3.25)
## Offset de cámara en ADS (más cerca y más al hombro).
const CAMERA_ADS_OFFSET := Vector3(0.72, 0.24, 2.35)
## Por debajo de esta distancia el avatar se oculta para no tapar la pantalla.
const CAMERA_BODY_HIDE_DISTANCE := 1.75
## Geometría autoritativa del actor. Agacharse debe bajar también colisión y
## headshot, no solo el clip/cámara.
const BODY_RADIUS := 0.38
const BODY_HEIGHT_STAND := 1.80
const BODY_HEIGHT_CROUCH := 1.35
const BODY_CENTER_STAND := 1.00
const BODY_CENTER_CROUCH := 0.775
const HEAD_Y_STAND := 2.16
const HEAD_Y_CROUCH := 1.55
var gravity: float = 22.0
## Velocidades calibradas con la zancada real del rig (Walk = 1,32 m/s,
## Run_Gun = 2,48 m/s): por encima de 7,1 m/s el clip no da más de sí y los
## pies patinan. 4,8/7,0 se cubren exactamente escalando la reproducción.
var walk_speed: float = 4.8
var sprint_speed: float = 7.0
var crouch_speed: float = 2.6
var acceleration: float = 32.0
var assist_break_timer: float = 0.0
## Alcance y fuerza del agarre rotacional; el cono limita dónde se siente.
const ASSIST_RANGE := 70.0
const ASSIST_GRIP := 0.35
const ASSIST_GRIP_CONE_DEG := 26.0
## Un arrastre mayor que esto en un tick es un flick deliberado: sin agarre.
const ASSIST_FLICK_PIXELS := 18.0
const ASSIST_FLICK_HOLD := 0.24
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
		_update_camera_pose(delta)
		return
	if match_context != null and match_context.has_method("is_combat_active") and not match_context.is_combat_active():
		input_enabled = false
		if weapon != null:
			weapon.clear_combat_input()
		_accelerate_horizontal(Vector3.ZERO, delta)
		_apply_gravity(delta)
		move_and_slide()
		_update_camera_pose(delta)
		return
	_update_look()
	if not input_enabled:
		_accelerate_horizontal(Vector3.ZERO, delta)
		_apply_gravity(delta)
		move_and_slide()
		_update_camera_pose(delta)
		return
	if _crouch_pressed():
		if crouched:
			# No levantar la cápsula dentro de techo/cobertura baja: el visual y
			# la física conservan la misma postura hasta que exista espacio real.
			if _can_stand():
				crouched = false
				_update_crouch_visual()
		else:
			crouched = true
			_update_crouch_visual()
	# Sample combat intent before selecting speed: ADS/fire win in the SAME tick.
	var fire_requested := Input.is_action_pressed("fire") or _mobile_fire()
	var aim_requested := Input.is_action_pressed("aim") or _mobile_aim()
	var input_vector := _movement_input()
	var wish_direction := _camera_relative_direction(input_vector)
	var sprint_requested := Input.is_action_pressed("sprint")
	if mobile_controls != null and mobile_controls.has_method("is_sprinting"):
		sprint_requested = sprint_requested or mobile_controls.is_sprinting()
	# Crouch > combat walk > sprint. Keep a held/latching sprint request intact
	# so releasing ADS/fire resumes sprint without an extra tap.
	var sprinting := sprint_requested and not crouched and not aim_requested and not fire_requested
	var target_speed := crouch_speed if crouched else (sprint_speed if sprinting else walk_speed)
	_accelerate_horizontal(wish_direction * target_speed, delta)
	_apply_gravity(delta)
	if _jump_pressed() and is_on_floor():
		velocity.y = 8.4
		_play_feedback("jump")
	if weapon != null:
		weapon.set_fire_held(fire_requested)
		weapon.set_aim_held(aim_requested)
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
	_update_camera_pose(delta)
	_update_footsteps(delta)
	if visual != null:
		var horizontal_speed := Vector2(velocity.x, velocity.z).length()
		# El visual recibe la velocidad REAL (m/s) para calibrar el clip.
		# Gameplay declara clase de velocidad (sprint) + velocidad real; la
		# animación sólo consume ambos para elegir clip y escala de reproducción.
		visual.set_combat_state(horizontal_speed > 0.15, weapon != null and weapon.fire_held, weapon != null and weapon.aim_held, horizontal_speed, sprinting)
	if camera != null:
		var target_fov := 52.0 if (weapon != null and weapon.aim_held) else 68.0
		# Smooth only the base lens. CameraFX subtracts/replaces its own additive
		# punch in render; damping that punch here makes recovery undershoot.
		var fx := get_node_or_null("CameraFX") as CameraFX
		var punch := fx.applied_fov_punch() if fx != null else 0.0
		camera.fov = lerpf(camera.fov - punch, target_fov, clampf(delta * 12.0, 0.0, 1.0)) + punch

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
		_play_feedback("death")
		_die(source)
	else:
		_play_feedback("hurt")
		if visual != null:
			visual.flinch(clampf(amount / 35.0, 0.35, 1.2))
	return true

func _die(killer: Node) -> void:
	if not is_alive:
		return
	is_alive = false
	if visual != null: visual.play_death()
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
	crouched = false
	if visual != null: visual.revive()
	input_enabled = true
	visible = true
	spawn_immunity = immunity
	collision_layer = 2
	collision_mask = 1 | 2
	health_changed.emit(health, max_health)
	look_pitch = 0.0
	look_yaw = rotation_degrees.y
	assist_target = null
	assist_break_timer = 0.0
	camera_recoil = 0.0
	last_damage_headshot = false
	_update_crouch_visual()
	if camera_pivot != null:
		camera_pivot.position.y = 1.58
	_play_feedback("respawn")

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
	# Sacudida + golpe de FOV del dueño de efectos (game/fx/camera_fx.gd).
	# Solo toca rotation/h_offset/v_offset de la cámara, nunca el pivot.
	CameraFX.kick(self, amount, ads)

func _play_feedback(sound_key: String) -> void:
	if feedback_audio == null:
		return
	feedback_audio.stream = CombatAudio.stream(sound_key)
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
	_play_feedback("step" if int(Time.get_ticks_msec() / 100) % 2 == 0 else "step2")

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
	# La ayuda sólo corrige un casi-fallo; sobre el objetivo el disparo conserva
	# la parte apuntada (pecho, cabeza) en vez de doblarse al torso.
	if _reticle_on_target(chosen, origin, base_direction, max_range):
		return base_direction
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

## One vector budget (m/s²) for starting, stopping and changing direction.
## Vertical velocity is owned by gravity/jump and is never included here.
func _accelerate_horizontal(target: Vector3, delta: float) -> void:
	var horizontal := Vector2(velocity.x, velocity.z).move_toward(Vector2(target.x, target.z), acceleration * delta)
	velocity.x = horizontal.x
	velocity.z = horizontal.y

func _movement_input() -> Vector2:
	var value := Input.get_vector("move_left", "move_right", "move_forward", "move_back")
	if mobile_controls != null and mobile_controls.has_method("get_move_vector"):
		var touch_value: Vector2 = mobile_controls.get_move_vector()
		if touch_value != Vector2.ZERO:
			value = touch_value
	return value

func _update_look() -> void:
	var look := Vector2.ZERO
	if mobile_controls != null and mobile_controls.has_method("consume_look_delta"):
		look = mobile_controls.consume_look_delta()
	var sensitivity := _look_sensitivity()
	# El agarre escala el arrastre del propio pulgar, nunca lo sustituye: con el
	# pulgar quieto no hay movimiento de cámara y ningún arrastre deliberado se
	# invierte, así que la cabeza sigue siendo alcanzable.
	look *= _assist_aim_scale(look)
	look_yaw -= look.x * sensitivity
	look_pitch = clampf(look_pitch - look.y * sensitivity, -78.0, 78.0)
	_sync_camera_orbit()

func _update_camera_pose(delta: float) -> void:
	# Follow the stance transition instead of teleporting the eye by 40 cm.
	# Death owns its lowered pivot; collision is still resolved after this move.
	if is_alive and camera_pivot != null:
		var height := 1.18 if crouched else 1.58
		camera_pivot.position.y = lerpf(camera_pivot.position.y, height, 1.0 - exp(-18.0 * delta))
	# Body rotation changes the parent basis after look input. Restore the
	# absolute orbit before testing collision at the actor's NEW position.
	_sync_camera_orbit()
	_update_camera_collision(delta)

func _sync_camera_orbit() -> void:
	if camera_pivot != null:
		# look_yaw is an absolute world heading; the pivot is a child of the
		# actor, so convert it to a local orbit. Looking around no longer rotates
		# the whole body; the body turns only while moving/aiming below.
		camera_pivot.rotation_degrees.y = look_yaw - rotation_degrees.y
		camera_pivot.rotation_degrees.x = look_pitch

func _camera_relative_direction(input_vector: Vector2) -> Vector3:
	if input_vector == Vector2.ZERO:
		return Vector3.ZERO
	var local_direction := Vector3(input_vector.x, 0.0, input_vector.y)
	if camera_pivot == null:
		return local_direction.limit_length(1.0)
	# Movimiento TPS = heading horizontal de cámara. Multiplicar primero por
	# la base completa incluía pitch: al mirar muy arriba/abajo el componente
	# forward se encogía antes de normalizar y una diagonal cambiaba de ángulo.
	var right := camera_pivot.global_transform.basis.x
	var back := camera_pivot.global_transform.basis.z
	right.y = 0.0
	back.y = 0.0
	if right.length_squared() < 0.0001 or back.length_squared() < 0.0001:
		return local_direction.limit_length(1.0)
	right = right.normalized()
	back = back.normalized()
	return (right * input_vector.x + back * input_vector.y).limit_length(1.0)

func _update_body_rotation(delta: float, movement_direction: Vector3) -> void:
	var target_yaw := rotation.y
	var should_face_camera := weapon != null and (weapon.aim_held or weapon.fire_held)
	if should_face_camera:
		target_yaw = deg_to_rad(look_yaw)
	elif movement_direction.length_squared() > 0.000001:
		target_yaw = atan2(-movement_direction.x, -movement_direction.z)
	else:
		return
	rotation.y = lerp_angle(rotation.y, target_yaw, clampf(delta * 11.0, 0.0, 1.0))

## Asistencia rotacional = resistencia al arrastre, no imán. Mientras ADS/fuego
## está activo, arrastrar sobre el torso visible pesa más; el giro pedido nunca
## se sustituye ni se revierte, así que un arrastre deliberado a la cabeza no se
## bloquea y al soltar el pulgar la mira se queda donde quedó.
func _assist_aim_scale(look_input: Vector2) -> float:
	if not can_use_combat() or mobile_controls == null or match_context == null or camera == null:
		return 1.0
	if look_input.length_squared() < 0.0001:
		# Sin arrastre no hay nada que escalar: cero movimiento no pedido.
		return 1.0
	var engaged: bool = _mobile_fire() or _mobile_aim() \
		or Input.is_action_pressed("aim") or Input.is_action_pressed("fire")
	if not engaged:
		assist_target = null
		return 1.0
	# Un flick por encima de este umbral es un giro deliberado: sin agarre.
	if look_input.length() > ASSIST_FLICK_PIXELS:
		assist_break_timer = ASSIST_FLICK_HOLD
	if assist_break_timer > 0.0:
		return 1.0
	var origin := get_aim_origin()
	var aim := -camera.global_transform.basis.z
	var target := _select_assist_target(aim, ASSIST_RANGE, origin)
	if target == null:
		assist_target = null
		return 1.0
	assist_target = target
	var target_point: Vector3 = target.get_assist_point() if target.has_method("get_assist_point") else target.get_target_point()
	var angle := rad_to_deg(aim.angle_to(origin.direction_to(target_point)))
	var proximity := 1.0 - clampf(angle / ASSIST_GRIP_CONE_DEG, 0.0, 1.0)
	return 1.0 - ASSIST_GRIP * proximity

## Dónde está el retículo, con el mismo rayo que trazará el arma: la ayuda sólo
## convierte un casi-fallo. Si el retículo ya cae sobre el objetivo, doblar la
## bala hacia el torso le quitaría al jugador la parte que eligió (apuntar a la
## cabeza terminaba en el pecho).
func _reticle_on_target(candidate: Node, origin: Vector3, direction: Vector3, max_range: float) -> bool:
	if not candidate is CollisionObject3D or not is_inside_tree() or direction.length_squared() < 0.0001:
		return false
	var query := PhysicsRayQueryParameters3D.create(origin, origin + direction.normalized() * max_range)
	query.collision_mask = 1 | 2 | 4
	query.collide_with_areas = true
	var excluded: Array[RID] = [get_rid()]
	if head_hitbox != null:
		excluded.append(head_hitbox.get_rid())
	query.exclude = excluded
	var hit := get_world_3d().direct_space_state.intersect_ray(query)
	if hit.is_empty():
		return false
	var collider := hit.get("collider") as Node
	if collider == null:
		return false
	return collider == candidate or candidate.is_ancestor_of(collider)

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
	body_collision = CollisionShape3D.new()
	body_collision.name = "BodyCollision"
	var capsule := CapsuleShape3D.new()
	capsule.radius = BODY_RADIUS
	capsule.height = BODY_HEIGHT_STAND
	body_collision.shape = capsule
	add_child(body_collision)
	head_hitbox = Area3D.new()
	head_hitbox.name = "HeadHitbox"
	head_hitbox.collision_layer = 4
	head_hitbox.collision_mask = 0
	head_hitbox.set_meta("damage_zone", "head")
	head_collision = CollisionShape3D.new()
	head_collision.name = "HeadCollision"
	var head_sphere := SphereShape3D.new()
	head_sphere.radius = 0.2
	head_collision.shape = head_sphere
	head_hitbox.add_child(head_collision)
	add_child(head_hitbox)
	_apply_collision_profile()

func _apply_collision_profile() -> void:
	if body_collision != null:
		var capsule := body_collision.shape as CapsuleShape3D
		if capsule != null:
			capsule.radius = BODY_RADIUS
			capsule.height = BODY_HEIGHT_CROUCH if crouched else BODY_HEIGHT_STAND
		body_collision.position.y = BODY_CENTER_CROUCH if crouched else BODY_CENTER_STAND
	if head_collision != null:
		head_collision.position.y = HEAD_Y_CROUCH if crouched else HEAD_Y_STAND

func _can_stand() -> bool:
	if not is_inside_tree():
		return true
	var shape := CapsuleShape3D.new()
	shape.radius = BODY_RADIUS
	shape.height = BODY_HEIGHT_STAND
	var query := PhysicsShapeQueryParameters3D.new()
	query.shape = shape
	query.collision_mask = 1
	query.exclude = [get_rid()]
	query.transform = Transform3D(global_transform.basis,
		global_position + global_transform.basis * Vector3(0.0, BODY_CENTER_STAND, 0.0))
	return get_world_3d().direct_space_state.intersect_shape(query, 1).is_empty()

func _create_visual() -> void:
	visual = OperatorVisual.new()
	# Configure ocurre antes de add_child(), así que OperatorVisual todavía no
	# puede resolver SettingsStore por sí solo. Pásale el loadout persistido de
	# forma explícita: la ropa elegida en lobby debe llegar realmente a partida.
	var cosmetic_loadout := CosmeticCatalog.default_loadout()
	var settings := _settings()
	if settings != null:
		cosmetic_loadout = settings.cosmetic_loadout()
	visual.configure(operator_id, team, _team_color(), cosmetic_loadout, true)
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
	camera.position = CAMERA_OFFSET
	camera_pivot.add_child(camera)
	weapon = WeaponController.new()
	weapon.name = "WeaponController"
	add_child(weapon)
	weapon.setup(self, camera, mobile_controls)

## La cámara nunca debe atravesar muro, esquina ni cover: se lanza un rayo del
## pivote a la posición deseada contra el mundo (capa 1) y se acerca el brazo
## de la cámara al primer impacto. El muro siempre gana: si está pegado al
## pivote, la cámara puede acercarse más que la distancia de confort y el avatar
## se oculta en vez de empujar la cámara a través de la geometría.
func _update_camera_collision(delta: float) -> void:
	if camera == null or camera_pivot == null:
		return
	var desired_local := CAMERA_OFFSET
	if weapon != null and weapon.aim_held:
		# ADS: la cámara se acerca y se desplaza al hombro para que el punto de
		# mira quede libre y el arma se lea, sin cambiar el origen del raycast.
		desired_local = CAMERA_ADS_OFFSET
	if crouched:
		desired_local.y -= 0.16
	# Resolve the full arm first so a persistent obstacle gives a stable target.
	# Then constrain the smoothed candidate too: smoothing alone can leave the
	# camera behind the wall for several frames after a pan or actor movement.
	var target_local := _camera_clear_offset(desired_local)
	var candidate := camera.position.lerp(target_local, clampf(delta * 14.0, 0.0, 1.0))
	camera.position = _camera_clear_offset(candidate)
	if visual != null:
		visual.visible = camera.position.length() > CAMERA_BODY_HIDE_DISTANCE

## World collision owns the limit; only unobstructed extension is smoothed.
func _camera_clear_offset(offset: Vector3) -> Vector3:
	var pivot_transform := camera_pivot.global_transform
	var from := pivot_transform.origin
	var desired := pivot_transform * offset
	var query := PhysicsRayQueryParameters3D.create(from, desired)
	query.collision_mask = 1
	query.exclude = [get_rid()]
	var hit := get_world_3d().direct_space_state.intersect_ray(query)
	if hit.is_empty():
		return offset
	var hit_local := pivot_transform.affine_inverse() * (hit["position"] as Vector3)
	var hit_distance := hit_local.length()
	if hit_distance <= 0.0001:
		return Vector3.ZERO
	var clearance := minf(0.35, hit_distance * 0.5)
	return hit_local - hit_local.normalized() * clearance


func _update_crouch_visual() -> void:
	# Hitboxes change immediately; pose and camera ease into the new stance.
	_apply_collision_profile()
	if visual != null:
		visual.set_crouch_state(crouched)

func _team_color() -> Color:
	return Color("#4fd6e9") if team == "ally" else Color("#da4f68")

func _settings() -> Node:
	return get_node_or_null("/root/SettingsStore") if is_inside_tree() else null
