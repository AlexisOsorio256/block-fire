# BLOCKFIRE — Player third-person (parity: PlayerController.js + Input.js)
# Números de paridad BEHAVIOR-MAP §2: walk 7.2 / sprint 8.6 / accel 58 / fric 46 /
# aire 26 / gravedad -22 / ojo 1.65→1.15 / salto ~1.5m / HP 125.
class_name Player
extends CharacterBody3D

signal died

var hp := 125.0
var max_hp := 125.0
var _last_attacker: Node = null
var _last_headshot := false
var _crouch_blend := 0.0
var _base_cam_y := 0.35
var _trauma := 0.0
var _step_timer := 0.2

# sacudida de cámara al recibir daño / disparar (trauma con decaimiento)
func add_trauma(amount: float) -> void:
	_trauma = minf(_trauma + amount, 1.0)

const WALK := 7.2
const SPRINT := 8.6
const ACCEL := 58.0
const FRICTION := 46.0
const AIR_ACCEL := 26.0
const GRAVITY := 22.0
const JUMP_V := 8.12
const EYE_H := 1.65
const CROUCH_EYE := 1.15
const CROUCH_MULT := 0.55
const BODY_H := 1.8
const CROUCH_H := 1.15

var input_layer: Node = null   # InputLayer (desktop o touch)
var weapon: Node = null        # WeaponSystem
var active: bool = true

# look
var yaw: float = 0.0
var pitch: float = 0.0
var crouching: bool = false

# nodos
var model: Node3D
var head: Node3D
var cam: Camera3D
var spring: SpringArm3D
var collision: CollisionShape3D
var char_model: CharacterModel

func _ready() -> void:
	add_to_group("player")
	add_to_group("entities")
	collision_layer = 2
	collision_mask = 1
	build_body()
	build_camera()
	weapon = load("res://scripts/combat/weapons.gd").new()
	weapon.name = "Weapon"
	add_child(weapon)
	weapon.setup(self)

func build_body() -> void:
	collision = CollisionShape3D.new()
	var shape := CapsuleShape3D.new()
	shape.radius = 0.38
	shape.height = BODY_H
	collision.shape = shape
	add_child(collision)

	# modelo real (Kenney CC0, animaciones) — la base para skins
	char_model = CharacterModel.new()
	char_model.name = "Model"
	add_child(char_model)
	char_model.setup(0)  # skin del jugador

func build_camera() -> void:
	head = Node3D.new()
	head.name = "Head"
	head.position.y = EYE_H
	add_child(head)
	spring = SpringArm3D.new()
	spring.spring_length = 3.2
	spring.margin = 0.25
	spring.collision_mask = 1
	spring.position = Vector3.ZERO
	head.add_child(spring)
	cam = Camera3D.new()
	cam.fov = 75.0
	cam.near = 0.05
	spring.add_child(cam)
	cam.position = Vector3(0.55, 0.35, 0)  # hombro derecho
	cam.current = true
	_base_cam_y = cam.position.y

func _mat(c: Color) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_color = c
	m.roughness = 0.8
	return m

func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventMouseMotion and Input.mouse_mode == Input.MOUSE_MODE_CAPTURED:
		var s: float = Settings.look_mul() * (0.35 if _aiming() else 1.0)
		yaw -= event.relative.x * s
		pitch = clampf(pitch - event.relative.y * s, -1.55, 1.55)

func _physics_process(delta: float) -> void:
	if not active:
		return
	_read_look(delta)
	_move(delta)
	_animate(delta)

func _read_look(delta: float) -> void:
	# look desde la capa táctil (delta acumulado por frame)
	if input_layer != null:
		var d: Vector2 = input_layer.take_look_delta()
		var s: float = Settings.touch_sens * (0.6 if _aiming() else 1.0)
		yaw -= d.x * s
		pitch = clampf(pitch - d.y * s, -1.55, 1.55)
	rotation.y = yaw
	head.rotation.x = pitch
	# FOV kick por velocidad + ADS (parity: base 75 + 7 kick)
	var speed_frac := Vector3(velocity.x, 0, velocity.z).length() / SPRINT
	var target_fov := 75.0 + 7.0 * speed_frac
	if _aiming():
		target_fov = 55.0
	cam.fov = lerpf(cam.fov, target_fov, delta * 10.0)

	# hombro: derecha normal, centro-izquierda al apuntar (ADS se siente distinto)
	var shoulder := 0.55 if not _aiming() else -0.25
	cam.position.x = lerpf(cam.position.x, shoulder, delta * 9.0)
	# acercar el arma al apuntar
	spring.spring_length = lerpf(spring.spring_length, 1.6 if _aiming() else 3.2, delta * 8.0)

	# shake por trauma (recibe golpes y disparos): decae, ruido pequeño
	if _trauma > 0.0:
		_trauma = maxf(_trauma - delta * 1.6, 0.0)
		var shake := _trauma * _trauma
		cam.position.y = _base_cam_y + randf_range(-1, 1) * 0.05 * shake
		cam.rotation.z = randf_range(-1, 1) * 0.03 * shake
	else:
		cam.position.y = lerpf(cam.position.y, _base_cam_y, delta * 8.0)
		cam.rotation.z = lerpf(cam.rotation.z, 0.0, delta * 8.0)

func _aiming() -> bool:
	return weapon != null and weapon.aiming

func _move(delta: float) -> void:
	var mv := Vector2.ZERO
	var want_jump := false
	var want_sprint := false
	var want_crouch := false
	if input_layer != null:
		mv = input_layer.move_vec()
		want_jump = input_layer.jump_pressed()
		want_sprint = input_layer.sprint_held()
		want_crouch = input_layer.crouch_toggled()
	else:
		mv = Input.get_vector("move_left", "move_right", "move_forward", "move_back")
		want_jump = Input.is_action_just_pressed("jump")
		want_sprint = Input.is_action_pressed("sprint")
		want_crouch = Input.is_action_just_pressed("crouch")

	crouching = want_crouch
	var sprinting := want_sprint and not _aiming() and not crouching and mv.length() > 0.5

	var wish := (transform.basis * Vector3(mv.x, 0, mv.y))
	var max_speed := WALK
	if sprinting:
		max_speed = SPRINT
	if crouching:
		max_speed *= CROUCH_MULT
	var wish_vel := wish * max_speed

	var a := ACCEL if is_on_floor() else AIR_ACCEL
	velocity.x = move_toward(velocity.x, wish_vel.x, a * delta)
	velocity.z = move_toward(velocity.z, wish_vel.z, a * delta)
	if is_on_floor() and mv.length() < 0.05:
		velocity.x = move_toward(velocity.x, 0.0, FRICTION * delta)
		velocity.z = move_toward(velocity.z, 0.0, FRICTION * delta)

	if is_on_floor():
		if want_jump and not crouching:
			velocity.y = JUMP_V
			Audio.play("jump", -8.0)
	else:
		velocity.y -= GRAVITY * delta
	if is_on_floor() and velocity.y < -1.0:
		velocity.y = -1.0

	move_and_slide()

	# pasos: ritmo ligado a velocidad real (solo en suelo y moviéndose)
	if is_on_floor() and Vector3(velocity.x, 0, velocity.z).length() > 2.0:
		_step_timer -= delta * (Vector3(velocity.x, 0, velocity.z).length() / WALK)
		if _step_timer <= 0.0:
			_step_timer = 0.38
			Audio.play("step" if randi() % 2 == 0 else "step2", -14.0, randf_range(0.9, 1.1))
	else:
		_step_timer = 0.2

	# crouch: colisión + ojo animados (parity: crouchBlend)
	_crouch_blend = move_toward(_crouch_blend, 1.0 if crouching else 0.0, delta * 6.0)
	collision.shape.height = lerpf(BODY_H, CROUCH_H, _crouch_blend)
	collision.position.y = 0.0
	head.position.y = lerpf(EYE_H, CROUCH_EYE, _crouch_blend)

func _animate(delta: float) -> void:
	if char_model == null:
		return
	if weapon != null and weapon.aiming:
		char_model.play("holding-right-shoot", 1.0)  # pose de apuntado
	else:
		char_model.locomotion(Vector3(velocity.x, 0, velocity.z).length(), WALK, SPRINT)

func take_damage(amount: float, headshot: bool, from: Vector3) -> void:
	hp -= amount
	add_trauma(0.35)
	if char_model != null:
		char_model.hit_flash()
	var to_att := from - global_position
	var angle := atan2(-to_att.x, -to_att.z)
	Game.player_hurt.emit(angle_difference(yaw, angle), amount)
	Audio.play("hurt", -4.0)
	if hp <= 0.0:
		die()

func respawn(pos: Vector3) -> void:
	global_position = pos
	velocity = Vector3.ZERO
	hp = max_hp
	active = true
	visible = true
	spring.spring_length = 3.2
	Audio.play("respawn", -6.0)

func notify_attacker(attacker: Node, headshot: bool) -> void:
	_last_attacker = attacker
	_last_headshot = headshot

func die() -> void:
	if not active:
		return
	active = false
	visible = true
	if char_model != null:
		char_model.die_pose()
	add_trauma(0.8)
	spring.spring_length = 4.4  # death cam: cámara se aleja
	Audio.play("death", -2.0)
	Game.register_kill(self, _last_attacker, _last_headshot)
	Game.queue_respawn(self, global_position)
	died.emit()
