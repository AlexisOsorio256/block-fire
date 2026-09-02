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
	# blocky militar con variación por skin (identidad visual por bot)
	var palette: Array = [
		[Color(0.36, 0.42, 0.34), Color(0.55, 0.42, 0.30)],  # assault
		[Color(0.45, 0.47, 0.50), Color(0.30, 0.32, 0.36)],  # urban
		[Color(0.30, 0.36, 0.48), Color(0.20, 0.24, 0.30)],  # tactical
		[Color(0.52, 0.50, 0.38), Color(0.40, 0.36, 0.26)],  # scout
		[Color(0.34, 0.30, 0.30), Color(0.44, 0.28, 0.22)],  # heavy
		[Color(0.48, 0.36, 0.20), Color(0.30, 0.22, 0.14)],  # raider
		[Color(0.22, 0.24, 0.30), Color(0.12, 0.14, 0.18)],  # nightops
	]
	var pal: Array = palette[name.hash() % palette.size()]
	var torso := MeshInstance3D.new()
	var tm := BoxMesh.new(); tm.size = Vector3(0.62, 0.72, 0.34)
	torso.mesh = tm
	torso.position.y = 1.06
	torso.material_override = _mat(pal[0])
	add_child(torso)
	var headm := MeshInstance3D.new()
	var hm := BoxMesh.new()
	hm.size = Vector3(0.42, 0.42, 0.42)
	headm.mesh = hm
	headm.position.y = 1.68
	headm.material_override = _mat(pal[1])
	add_child(headm)
	# franja de ID luminosa (identidad BLOCKFIRE)
	var stripe := MeshInstance3D.new()
	var sm := BoxMesh.new(); sm.size = Vector3(0.64, 0.08, 0.36)
	stripe.mesh = sm
	stripe.position.y = 1.24
	var smat := StandardMaterial3D.new()
	smat.albedo_color = Color.from_hsv(float(name.hash() % 100) / 100.0, 0.8, 1.0)
	smat.emission_enabled = true
	smat.emission = smat.albedo_color
	smat.emission_energy_multiplier = 1.2
	stripe.material_override = smat
	add_child(stripe)

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
	global_position = pos
	state = State.WANDER
	Audio.play_at("respawn", pos, -8.0)

func take_damage(amount: float, headshot: bool, from: Vector3) -> void:
	hp -= amount
	Audio.play_at("hit", global_position, -6.0)
	if hp <= 0.0:
		die(headshot)

func die(headshot: bool) -> void:
	if state == State.DEAD:
		return
	state = State.DEAD
	active = false
	visible = false
	Game.register_kill(self, _killer, headshot)
	Game.queue_respawn(self, _spawn_point)

var _killer: Node = null

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
