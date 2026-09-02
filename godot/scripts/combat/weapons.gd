# BLOCKFIRE — Sistema de armas data-driven (parity: WeaponSystem.js)
# Una clase para N armas. Identidad por datos: cadencia, daño, spread, recoil, sonido.
# Hitscan con oclusión real (capa level). Daño por la ruta única: Game.apply_damage.
class_name WeaponSystem
extends Node

signal ammo_changed(mag: int, reserve: int)
signal hitmarker(headshot: bool)

const WEAPONS := [
	{ "name": "Rifle", "auto": true, "interval": 0.1, "body": 24.0, "head": 48.0,
		"mag": 30, "reserve": 90, "reload": 2.2, "spread": 1.1, "recoil": 0.012,
		"range": 120.0, "sound": "shot_rifle", "pellets": 1 },
	{ "name": "Pistola", "auto": false, "interval": 0.24, "body": 30.0, "head": 60.0,
		"mag": 12, "reserve": 36, "reload": 1.6, "spread": 0.9, "recoil": 0.018,
		"range": 100.0, "sound": "shot_pistol", "pellets": 1 },
	{ "name": "Escopeta", "auto": false, "interval": 0.9, "body": 8.0, "head": 16.0,
		"mag": 6, "reserve": 24, "reload": 2.8, "spread": 4.5, "recoil": 0.03,
		"range": 45.0, "sound": "shot_shotgun", "pellets": 8 },
]

var owner_body: Player
var aiming := false
var current := 0
var mag := 30
var reserve := 90
var reloading := false
var _reload_end := 0.0
var _cooldown := 0.0
var _recovery := 0.0
var _semi_latch := false

const LAYER_LEVEL := 1
const LAYER_ENTITIES := 2

func setup(body: Player) -> void:
	owner_body = body
	mag = WEAPONS[current]["mag"]
	reserve = WEAPONS[current]["reserve"]
	_mount_weapon()

# ---- arma física en la mano (silueta por arma, parity visual con el web) ----
var _weapon_node: Node3D
var _muzzle: Marker3D

func _mount_weapon() -> void:
	if _weapon_node != null:
		_weapon_node.queue_free()
	_weapon_node = Node3D.new()
	_weapon_node.name = "Weapon_" + WEAPONS[current]["name"]
	_muzzle = Marker3D.new()
	_muzzle.name = "Muzzle"
	_muzzle.position = Vector3(0, 0, _barrel_len())
	_weapon_node.add_child(_muzzle)
	_build_silhouette(_weapon_node)
	var hand := owner_body.char_model.arm_right
	if hand != null:
		hand.add_child(_weapon_node)
		_weapon_node.position = Vector3(0, -0.34, 0.02)
		_weapon_node.rotation_degrees = Vector3(-90, 0, 0)

func _barrel_len() -> float:
	return [0.62, 0.34, 0.72][current]

func _build_silhouette(parent: Node3D) -> void:
	# una sola función, 3 siluetas por datos — crecer el arsenal no duplica código
	var body_mat := StandardMaterial3D.new()
	body_mat.albedo_color = Color(0.18, 0.19, 0.22)
	body_mat.roughness = 0.55
	body_mat.metallic = 0.35
	var accent_mat := StandardMaterial3D.new()
	accent_mat.albedo_color = [Color(0.85, 0.55, 0.12), Color(0.35, 0.5, 0.7), Color(0.55, 0.3, 0.2)][current]
	accent_mat.roughness = 0.6

	var w := 0.07
	var l := _barrel_len()
	# cañón/cuerpo
	_box(parent, Vector3(w, w, l), Vector3(0, 0, l * 0.5), body_mat)
	# empuñadura
	_box(parent, Vector3(w * 0.9, 0.14, w * 1.2), Vector3(0, -0.1, 0.04), accent_mat)
	if current == 0:  # rifle: culata + cargador curvo
		_box(parent, Vector3(w * 0.8, 0.1, 0.22), Vector3(0, -0.02, -0.09), body_mat)
		_box(parent, Vector3(w * 0.8, 0.16, 0.09), Vector3(0, -0.14, 0.24), accent_mat)
		_box(parent, Vector3(w * 0.6, 0.05, 0.16), Vector3(0, 0.06, 0.30), accent_mat)
	elif current == 1:  # pistola: corredera compacta
		_box(parent, Vector3(w * 1.1, 0.055, l * 0.55), Vector3(0, 0.045, 0.12), accent_mat)
	else:  # escopeta: bomba + doble cañón visual
		_box(parent, Vector3(w * 1.4, w * 1.2, l * 0.4), Vector3(0, -0.02, 0.16), accent_mat)
		_box(parent, Vector3(w * 0.6, w * 0.6, l * 0.9), Vector3(0, 0.055, l * 0.5), body_mat)

func _box(parent: Node3D, size: Vector3, pos: Vector3, mat: Material) -> void:
	var mi := MeshInstance3D.new()
	var bm := BoxMesh.new()
	bm.size = size
	mi.mesh = bm
	mi.material_override = mat
	parent.add_child(mi)
	mi.position = pos

# kick visual del arma al disparar (recoil físico visible en tercera persona)
func _weapon_kick() -> void:
	if _weapon_node == null:
		return
	var tw := _weapon_node.create_tween()
	tw.tween_property(_weapon_node, "position:z", 0.02 - 0.06, 0.04)
	tw.tween_property(_weapon_node, "position:z", 0.02, 0.09)

func _physics_process(delta: float) -> void:
	if owner_body == null or not owner_body.active:
		return
	aiming = Input.is_action_pressed("aim") or (owner_body.input_layer != null and owner_body.input_layer.aim_toggled())
	_cooldown -= delta

	if reloading and Time.get_ticks_msec() / 1000.0 >= _reload_end:
		var need: int = WEAPONS[current]["mag"] - mag
		mag += mini(need, reserve)
		reserve -= mini(need, reserve)
		reloading = false

	if Input.is_action_just_pressed("reload") or (owner_body.input_layer != null and owner_body.input_layer.reload_pressed()):
		start_reload()
	for i in 3:
		if Input.is_action_just_pressed("weapon_%d" % (i + 1)):
			switch_to(i)
	if Input.is_action_just_pressed("weapon_next"):
		switch_to((current + 1) % WEAPONS.size())
	if owner_body.input_layer != null:
		var wi: int = owner_body.input_layer.weapon_request()
		if wi >= 0:
			switch_to(wi)

	# recuperación de recoil (pitch vuelve)
	if _recovery > 0.0:
		var r: float = minf(_recovery, WEAPONS[current]["recoil"] * delta * 8.0)
		owner_body.pitch = clampf(owner_body.pitch - r, -1.55, 1.55)
		_recovery -= r

	var want_fire: bool = owner_body.input_layer.fire_held() if owner_body.input_layer != null else Input.is_action_pressed("fire")
	if want_fire and not reloading and mag > 0 and _cooldown <= 0.0:
		if WEAPONS[current]["auto"] or not _semi_latch:
			fire()
			_semi_latch = true
	if not want_fire:
		_semi_latch = false

func start_reload() -> void:
	if reloading or mag == WEAPONS[current]["mag"] or reserve == 0:
		return
	reloading = true
	_reload_end = Time.get_ticks_msec() / 1000.0 + WEAPONS[current]["reload"]
	Audio.play("reload", -4.0)

func switch_to(index: int) -> void:
	if index == current or index < 0 or index >= WEAPONS.size():
		return
	current = index
	reloading = false
	mag = WEAPONS[current]["mag"]
	reserve = WEAPONS[current]["reserve"]
	_cooldown = WEAPONS[current]["interval"]
	Audio.play("switch", -6.0)
	_mount_weapon()
	ammo_changed.emit(mag, reserve)

func fire() -> void:
	mag -= 1
	_cooldown = WEAPONS[current]["interval"]
	var cam: Camera3D = owner_body.cam
	var origin := cam.global_position
	var forward := -cam.global_transform.basis.z

	var spread: float = WEAPONS[current]["spread"] \
		* (0.5 if aiming else 1.0) * (0.85 if owner_body.crouching else 1.0)
	for i in WEAPONS[current]["pellets"]:
		var dir := forward.rotated(cam.global_transform.basis.y, deg_to_rad(randf_range(-spread, spread)))
		dir = dir.rotated(cam.global_transform.basis.x, deg_to_rad(randf_range(-spread, spread)))
		_shot(origin, dir)

	Audio.play(WEAPONS[current]["sound"])
	owner_body.pitch = clampf(owner_body.pitch + WEAPONS[current]["recoil"], -1.55, 1.55)
	_recovery += WEAPONS[current]["recoil"]
	_muzzle_flash(_muzzle_pos(origin, forward), forward)
	_weapon_kick()
	if owner_body.char_model != null:
		owner_body.char_model.shoot_pose()
	ammo_changed.emit(mag, reserve)

func _shot(origin: Vector3, dir: Vector3) -> void:
	var space := owner_body.get_world_3d().direct_space_state
	var q := PhysicsRayQueryParameters3D.create(origin, origin + dir * WEAPONS[current]["range"])
	q.collision_mask = LAYER_LEVEL | LAYER_ENTITIES
	q.exclude = [owner_body.get_rid()]
	var hit := space.intersect_ray(q)

	var max_range: float = WEAPONS[current]["range"]
	var end := origin + dir * max_range
	if hit:
		end = hit["position"]
	_tracer(origin, end)
	if hit:
		var node: Object = hit["collider"]
		var victim: Node = null
		if node.is_in_group("entities"):
			victim = node
		elif node.is_in_group("head"):
			victim = node.get_meta("owner", null)
		if victim != null and victim != owner_body:
			var head: bool = node.is_in_group("head")
			if victim.has_method("notify_attacker"):
				victim.notify_attacker(owner_body, head)
			var dmg: float = WEAPONS[current]["head"] if head else WEAPONS[current]["body"]
			Game.apply_damage(victim, dmg, head, origin)
			Audio.play("headshot" if head else "hit", -3.0)
			hitmarker.emit(head)
			_impact(end, Color(1.0, 0.35, 0.3))
		else:
			Audio.play_at("impact", end, -10.0)
			_impact(end, Color(0.72, 0.77, 0.83))

func _tracer(from: Vector3, to: Vector3) -> void:
	var mesh := ImmediateMesh.new()
	mesh.surface_begin(Mesh.PRIMITIVE_LINES)
	mesh.surface_add_vertex(from)
	mesh.surface_add_vertex(to)
	mesh.surface_end()
	var mi := MeshInstance3D.new()
	mi.mesh = mesh
	var m := StandardMaterial3D.new()
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.albedo_color = Color(1.0, 0.85, 0.5, 0.9)
	mi.material_override = m
	get_tree().current_scene.add_child(mi)
	var tw := mi.create_tween()
	tw.tween_property(m, "albedo_color:a", 0.0, 0.06)
	tw.tween_callback(mi.queue_free)

func _impact(pos: Vector3, color: Color) -> void:
	# chispas con partículas GPU (8-12 fragmentos, vida corta, presupuesto fijo)
	var p := GPUParticles3D.new()
	p.one_shot = true
	p.emitting = false
	p.amount = 10
	p.lifetime = 0.35
	p.explosiveness = 1.0
	var pm := ParticleProcessMaterial.new()
	pm.direction = Vector3.UP
	pm.spread = 70.0
	pm.initial_velocity_min = 2.0
	pm.initial_velocity_max = 5.0
	pm.gravity = Vector3(0, -12, 0)
	pm.scale_min = 0.4
	pm.scale_max = 1.0
	p.process_material = pm
	var quad := QuadMesh.new()
	quad.size = Vector2(0.05, 0.05)
	var pm2 := StandardMaterial3D.new()
	pm2.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	pm2.albedo_color = color
	pm2.vertex_color_use_as_albedo = true
	quad.material = pm2
	p.draw_pass_1 = quad
	get_tree().current_scene.add_child(p)
	p.global_position = pos
	p.emitting = true
	get_tree().create_timer(0.8).timeout.connect(p.queue_free)

func _muzzle_pos(cam_origin: Vector3, dir: Vector3) -> Vector3:
	if _muzzle != null and _muzzle.is_inside_tree():
		return _muzzle.global_position
	return cam_origin + dir * 0.6

func _muzzle_flash(origin: Vector3, dir: Vector3) -> void:
	var light := OmniLight3D.new()
	light.light_color = Color(1.0, 0.8, 0.45)
	light.light_energy = 3.0
	light.omni_range = 4.0
	light.shadow_enabled = false
	get_tree().current_scene.add_child(light)
	light.global_position = origin + dir * 0.8
	var tw := light.create_tween()
	tw.tween_property(light, "light_energy", 0.0, 0.05)
	tw.tween_callback(light.queue_free)
