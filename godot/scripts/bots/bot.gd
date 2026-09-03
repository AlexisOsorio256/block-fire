# BLOCKFIRE — Bot (parity: Bot.js) — wander → chase → attack
# Navegación real con NavigationAgent3D (mejora sobre steering del web).
# Mismas reglas que el jugador: misma ruta de daño, oclusión respetada. Sin trampas.
class_name Bot
extends CharacterBody3D

signal bot_shot(from: Vector3, to: Vector3)

const GRAVITY := 22.0
const WALK := 3.4
const CHASE := 5.2
const ATTACK_RANGE := 14.0
const SIGHT_RANGE := 32.0
const FIRE_INTERVAL := 0.62
const DAMAGE := 10.0

enum State { WANDER, CHASE, ATTACK, DEAD }

var state: int = State.WANDER
var hp := 50.0
var max_hp := 50.0
var active := true

var nav: NavigationAgent3D
var target: Node3D = null
var _wander_timer := 0.0
var _fire_timer := 0.0
var _vy := 0.0
var _head: StaticBody3D
var _spawn_point := Vector3.ZERO
var char_model: CharacterModel

func _ready() -> void:
	add_to_group("entities")
	collision_layer = 2
	collision_mask = 1
	build_body()
	build_model()
	build_nav()

func build_body() -> void:
	var col := CollisionShape3D.new()
	var shape := CapsuleShape3D.new()
	shape.radius = 0.38
	shape.height = 1.8
	col.shape = shape
	add_child(col)

func build_model() -> void:
	# mismo sistema de personaje que el jugador, skin propia por bot (un sistema + datos)
	char_model = CharacterModel.new()
	char_model.name = "Model"
	add_child(char_model)
	var idx := name.replace("Bot_", "").to_int()
	char_model.setup((idx + 1) % CharacterModel.OUTFITS.size())

	# hitbox de cabeza (hitscan distingue head/body — parity)
	_head = StaticBody3D.new()
	_head.collision_layer = 2
	_head.add_to_group("head")
	_head.set_meta("owner", self)
	var hcol := CollisionShape3D.new()
	var hshape := BoxShape3D.new()
	hshape.size = Vector3(0.44, 0.44, 0.44)
	hcol.shape = hshape
	_head.add_child(hcol)
	_head.position.y = 1.68
	add_child(_head)

func build_nav() -> void:
	nav = NavigationAgent3D.new()
	nav.radius = 0.45
	nav.height = 1.8
	nav.path_desired_distance = 0.6
	nav.target_desired_distance = 0.8
	add_child(nav)

func _mat(c: Color) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_color = c
	m.roughness = 0.85
	return m

func setup(bot_target: Node3D, spawn_pos: Vector3) -> void:
	target = bot_target
	_spawn_point = spawn_pos
	global_position = spawn_pos

func respawn(pos: Vector3) -> void:
	hp = max_hp
	active = true
	visible = true
	position = pos
	if char_model != null:
		char_model.play("idle")
	state = State.WANDER
	Audio.play_at("respawn", pos, -8.0)

func take_damage(amount: float, headshot: bool, from: Vector3) -> void:
	hp -= amount
	if char_model != null:
		char_model.hit_flash()
	if hp <= 0.0:
		die(headshot)

func die(headshot: bool) -> void:
	if state == State.DEAD:
		return
	state = State.DEAD
	active = false
	if char_model != null:
		char_model.die_pose()
	# caída animada visible brevemente antes del respawn (muerte satisfactoria)
	var tw := create_tween()
	tw.tween_property(self, "position:y", -0.6, 0.5).set_ease(Tween.EASE_IN)
	Game.register_kill(self, _killer, _last_headshot or headshot)
	Game.queue_respawn(self, _spawn_point)

var _killer: Node = null
var _last_headshot := false

func notify_attacker(attacker: Node, headshot: bool) -> void:
	_killer = attacker
	_last_headshot = headshot

func _physics_process(delta: float) -> void:
	if not active or target == null:
		return
	var to_target := target.global_position - global_position
	var dist := Vector3(to_target.x, 0, to_target.z).length()

	# línea de visión: la cobertura bloquea (parity raycast)
	var has_los := false
	if dist < SIGHT_RANGE:
		var space := get_world_3d().direct_space_state
		var eye := global_position + Vector3.UP * 1.5
		var t_eye := target.global_position + Vector3.UP * 1.3
		var q := PhysicsRayQueryParameters3D.create(eye, t_eye, 1)  # solo capa level
		has_los = space.intersect_ray(q).is_empty()

	if has_los and dist <= ATTACK_RANGE:
		state = State.ATTACK
	elif has_los:
		state = State.CHASE
	else:
		state = State.WANDER

	# decisión de movimiento
	var move := Vector3.ZERO
	if state == State.WANDER:
		_wander_timer -= delta
		if _wander_timer <= 0.0 or nav.is_navigation_finished():
			_wander_timer = randf_range(3.0, 7.0)
			nav.target_position = _random_wander_point()
		if not nav.is_navigation_finished():
			var next := nav.get_next_path_position()
			move = (next - global_position).normalized() * WALK
	elif state == State.CHASE:
		nav.target_position = target.global_position
		if not nav.is_navigation_finished():
			var next2 := nav.get_next_path_position()
			move = (next2 - global_position).normalized() * CHASE
	else:
		# ataque: strafe lateral + ligera presión
		var dir := Vector3(to_target.x, 0, to_target.z).normalized()
		var side := dir.cross(Vector3.UP)
		move = (dir * 0.25 + side * sin(Time.get_ticks_msec() / 1000.0 * 1.7) * 0.6) * WALK

	if not is_on_floor():
		_vy -= GRAVITY * delta
	else:
		_vy = -1.0
	velocity = Vector3(move.x, _vy, move.z)
	move_and_slide()
	if char_model != null:
		char_model.locomotion(Vector3(move.x, 0, move.z).length(), WALK, CHASE)
		# postura de combate: arma en mano mientras persigue/ataca
		if state != State.WANDER and char_model.current_action != "holding-right":
			char_model.play("holding-right")

	# orientar hacia el objetivo cuando está comprometido
	if state != State.WANDER:
		var look := Vector3(to_target.x, 0, to_target.z)
		if look.length_squared() > 0.001:
			rotation.y = lerp_angle(rotation.y, atan2(-look.x, -look.z), delta * 6.0)

	# disparo (mismo contrato: hitscan + oclusión — nunca a través de paredes)
	_fire_timer -= delta
	if state == State.ATTACK and _fire_timer <= 0.0:
		_fire_timer = FIRE_INTERVAL
		_fire()
		if char_model != null:
			char_model.shoot_pose()

func _random_wander_point() -> Vector3:
	var a := randf() * TAU
	var r := randf_range(6.0, 20.0)
	return Vector3(cos(a) * r, 0.0, sin(a) * r)

func _fire(dir_hint: Vector3 = Vector3.ZERO) -> void:
	if target == null:
		return
	var origin := global_position + Vector3.UP * 1.4 + global_transform.basis.x * 0.25
	var aim := (target.global_position + Vector3.UP * 1.2 - origin).normalized()
	aim = aim.rotated(Vector3.UP, deg_to_rad(randf_range(-1.8, 1.8)))

	var space := get_world_3d().direct_space_state
	var q := PhysicsRayQueryParameters3D.create(origin, origin + aim * 60.0)
	q.collision_mask = 1 | 2
	q.exclude = [get_rid()]
	var hit := space.intersect_ray(q)
	var end := origin + aim * 60.0
	if hit:
		end = hit["position"]
	bot_shot.emit(origin, end)
	Audio.play_at("shot_rifle", global_position, -10.0)
	if hit:
		var node: Object = hit["collider"]
		var victim: Node = null
		if node.is_in_group("entities"):
			victim = node
		elif node.is_in_group("head"):
			victim = node.get_meta("owner", null)
		if victim != null and victim != self:
			var head: bool = node.is_in_group("head")
			if victim.has_method("notify_attacker"):
				victim.notify_attacker(self, head)
			Game.apply_damage(victim, DAMAGE * (2.0 if head else 1.0), head, origin)
