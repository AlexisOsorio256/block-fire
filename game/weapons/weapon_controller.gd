class_name WeaponController
extends Node3D

signal weapon_fired(definition: WeaponDefinition)
signal weapon_changed(definition: WeaponDefinition)
signal ammo_changed(current: int, reserve: int, definition: WeaponDefinition)
signal damage_confirmed(amount: float, headshot: bool)

const DEFINITIONS: Array[WeaponDefinition] = [
	preload("res://game/data/weapons/rifle.tres"),
	preload("res://game/data/weapons/pistol.tres"),
	preload("res://game/data/weapons/shotgun.tres"),
	preload("res://game/data/weapons/smg.tres")
]

var actor: Node
var camera: Camera3D
var mobile_controls: Node
var active_index: int = 1
var ammo: Array[int] = [30, 12, 6, 32]
var reserve: Array[int] = [150, 72, 42, 160]
var cooldown: float = 0.0
var reload_timer: float = 0.0
var switching_timer: float = 0.0
var fire_held: bool = false
var aim_held: bool = false
var ai_target: Node
var ai_can_see: bool = false
var previous_fire: bool = false
var viewmodel: Node3D
var muzzle_flash: MeshInstance3D
var shot_audio: AudioStreamPlayer3D
var reload_audio: AudioStreamPlayer3D
var shot_streams: Dictionary = {}
var rng := RandomNumberGenerator.new()

func setup(owner_actor: Node, owner_camera: Camera3D = null, controls: Node = null) -> void:
	actor = owner_actor
	camera = owner_camera
	mobile_controls = controls
	rng.randomize()
	shot_audio = AudioStreamPlayer3D.new()
	shot_audio.name = "WeaponSfx"
	shot_audio.bus = "SFX"
	shot_audio.max_distance = 42.0
	add_child(shot_audio)
	reload_audio = AudioStreamPlayer3D.new()
	reload_audio.name = "ReloadSfx"
	reload_audio.bus = "SFX"
	reload_audio.max_distance = 20.0
	add_child(reload_audio)
	_refresh_viewmodel()
	_emit_ammo()

func _physics_process(delta: float) -> void:
	cooldown = maxf(0.0, cooldown - delta)
	if switching_timer > 0.0:
		switching_timer = maxf(0.0, switching_timer - delta)
	if reload_timer > 0.0:
		reload_timer = maxf(0.0, reload_timer - delta)
		if reload_timer <= 0.0:
			_finish_reload()
		return
	if actor == null or not actor.get("is_alive"):
		return
	if fire_held:
		if current_definition().automatic or not previous_fire:
			try_fire()
	previous_fire = fire_held
	if not fire_held:
		previous_fire = false

func current_definition() -> WeaponDefinition:
	return DEFINITIONS[clampi(active_index, 0, DEFINITIONS.size() - 1)]

func set_fire_held(value: bool) -> void:
	fire_held = value

func set_aim_held(value: bool) -> void:
	aim_held = value

func set_ai_target(target: Node, can_see: bool) -> void:
	ai_target = target
	ai_can_see = can_see

func switch_to(index: int) -> void:
	if index < 0 or index >= DEFINITIONS.size() or index == active_index:
		return
	if reload_timer > 0.0:
		reload_timer = 0.0
	active_index = index
	switching_timer = 0.34
	_refresh_viewmodel()
	_emit_ammo()
	weapon_changed.emit(current_definition())

func next_weapon() -> void:
	switch_to((active_index + 1) % DEFINITIONS.size())

func previous_weapon() -> void:
	switch_to((active_index - 1 + DEFINITIONS.size()) % DEFINITIONS.size())

func request_reload() -> void:
	if reload_timer > 0.0 or switching_timer > 0.0:
		return
	var definition := current_definition()
	if ammo[active_index] >= definition.magazine_size or reserve[active_index] <= 0:
		return
	reload_timer = definition.reload_time
	_play_reload("start")

func try_fire() -> bool:
	if switching_timer > 0.0 or reload_timer > 0.0 or cooldown > 0.0:
		return false
	var definition := current_definition()
	if ammo[active_index] <= 0:
		request_reload()
		return false
	ammo[active_index] -= 1
	cooldown = definition.fire_interval
	_emit_ammo()
	weapon_fired.emit(definition)
	_play_shot(definition.id)
	_show_muzzle_flash()
	for pellet: int in range(definition.pellets):
		_fire_pellet(definition)
	return true

func _fire_pellet(definition: WeaponDefinition) -> void:
	var origin: Vector3 = _aim_origin()
	var direction: Vector3 = _aim_direction()
	var spread := definition.spread
	if actor != null and actor.get("is_bot"):
		if ai_target == null or not ai_can_see:
			return
		var target_point: Vector3 = ai_target.get_target_point() if ai_target.has_method("get_target_point") else ai_target.global_position + Vector3.UP
		direction = origin.direction_to(target_point)
		var accuracy: float = float(actor.get("bot_accuracy")) if actor.get("bot_accuracy") != null else 0.65
		spread *= lerpf(1.8, 0.25, accuracy)
		direction = _spread_direction(direction, spread)
	else:
		direction = _spread_direction(direction, spread * (0.55 if aim_held else 1.0))
	var end := origin + direction * definition.range
	var query := PhysicsRayQueryParameters3D.create(origin, end)
	query.collision_mask = 1 | 2 | 4
	if actor is CollisionObject3D:
		query.exclude = [actor.get_rid()]
	var hit: Dictionary = actor.get_world_3d().direct_space_state.intersect_ray(query)
	if hit.is_empty():
		return
	var collider: Object = hit.get("collider")
	var target := _find_actor(collider)
	if target == null or not target.has_method("get_team"):
		return
	if actor.has_method("get_team") and target.get_team() == actor.get_team():
		return
	var distance: float = origin.distance_to(hit.position)
	var multiplier: float = 1.0
	var headshot := false
	if collider is Area3D and collider.get_meta("damage_zone", "") == "head":
		multiplier = definition.headshot_multiplier
		headshot = true
	var falloff := 1.0
	if distance > definition.falloff_start:
		falloff = lerpf(1.0, definition.falloff_min, inverse_lerp(definition.falloff_start, definition.range, distance))
	var damage: float = definition.damage * multiplier * falloff
	if target.has_method("take_damage"):
		target.take_damage(damage, actor, headshot)
		damage_confirmed.emit(damage, headshot)

func _find_actor(value: Object) -> Node:
	var node := value as Node
	for _index: int in range(6):
		if node == null:
			return null
		if node.has_method("take_damage") and node.has_method("get_team"):
			return node
		node = node.get_parent()
	return null

func _aim_origin() -> Vector3:
	if actor != null and actor.has_method("get_aim_origin"):
		return actor.get_aim_origin()
	if camera != null:
		return camera.global_position
	return global_position

func _aim_direction() -> Vector3:
	if actor != null and actor.get("is_bot") and ai_target != null:
		return _aim_origin().direction_to(ai_target.get_target_point())
	var base_direction: Vector3 = -camera.global_transform.basis.z if camera != null else -global_transform.basis.z
	if actor != null and actor.has_method("get_mobile_assisted_direction"):
		return actor.get_mobile_assisted_direction(base_direction, current_definition().range)
	if camera != null:
		return -camera.global_transform.basis.z
	return -global_transform.basis.z

func _spread_direction(direction: Vector3, amount: float) -> Vector3:
	var right := direction.cross(Vector3.UP).normalized()
	if right.length_squared() < 0.01:
		right = Vector3.RIGHT
	var up := right.cross(direction).normalized()
	return (direction + right * rng.randf_range(-amount, amount) + up * rng.randf_range(-amount, amount)).normalized()

func _finish_reload() -> void:
	var definition := current_definition()
	var needed: int = definition.magazine_size - ammo[active_index]
	var moved: int = mini(needed, reserve[active_index])
	ammo[active_index] += moved
	reserve[active_index] -= moved
	_emit_ammo()
	_play_reload("end")

func _emit_ammo() -> void:
	if DEFINITIONS.is_empty():
		return
	ammo_changed.emit(ammo[active_index], reserve[active_index], current_definition())

func _refresh_viewmodel() -> void:
	if is_instance_valid(viewmodel):
		viewmodel.queue_free()
	viewmodel = null
	var definition := current_definition()
	var model_scene := load(definition.viewmodel_scene) as PackedScene
	if model_scene != null:
		viewmodel = model_scene.instantiate() as Node3D
	if viewmodel == null:
		viewmodel = _fallback_weapon(definition.id)
	add_child(viewmodel)
	viewmodel.position = Vector3(0.28, -0.22, -0.46)
	viewmodel.rotation_degrees = Vector3(0, 180, 0)
	viewmodel.scale = Vector3.ONE * 0.36
	_apply_weapon_skin()

func _apply_weapon_skin() -> void:
	if viewmodel == null or not is_instance_valid(viewmodel):
		return
	var settings := get_node_or_null("/root/SettingsStore")
	var skin := str(settings.get_value("weapon_skin", "Estándar") if settings != null else "Estándar")
	var tint: Color = {
		"Estándar": Color.WHITE,
		"Oro": Color("#e4bd62"),
		"Bosque": Color("#78a77d"),
		"Hielo": Color("#82bfe2"),
		"Carbón": Color("#777d91")
	}.get(skin, Color.WHITE)
	if tint == Color.WHITE:
		return
	for candidate: Node in viewmodel.find_children("*", "MeshInstance3D", true, false):
		var mesh_instance := candidate as MeshInstance3D
		if mesh_instance == null or mesh_instance.mesh == null:
			continue
		for surface_index: int in range(mesh_instance.mesh.get_surface_count()):
			var source := mesh_instance.get_active_material(surface_index)
			if source is StandardMaterial3D:
				var material := source.duplicate() as StandardMaterial3D
				material.albedo_color = Color(
					material.albedo_color.r * tint.r,
					material.albedo_color.g * tint.g,
					material.albedo_color.b * tint.b,
					material.albedo_color.a
				)
				mesh_instance.set_surface_override_material(surface_index, material)

func _fallback_weapon(id: String) -> Node3D:
	var root := Node3D.new()
	var mesh_instance := MeshInstance3D.new()
	var mesh := BoxMesh.new()
	mesh.size = Vector3(0.18, 0.16, 0.8 if id != "shotgun" else 0.95)
	mesh_instance.mesh = mesh
	mesh_instance.material_override = _weapon_material(id)
	root.add_child(mesh_instance)
	var barrel := MeshInstance3D.new()
	var barrel_mesh := CylinderMesh.new()
	barrel_mesh.top_radius = 0.035
	barrel_mesh.bottom_radius = 0.035
	barrel_mesh.height = 0.45
	barrel.mesh = barrel_mesh
	barrel.rotation_degrees.x = 90
	barrel.position.z = -0.52
	barrel.material_override = _weapon_material("barrel")
	root.add_child(barrel)
	return root

func _weapon_material(id: String) -> StandardMaterial3D:
	var material := StandardMaterial3D.new()
	material.albedo_color = {
		"rifle": Color("#6c83d8"), "pistol": Color("#d75b43"), "shotgun": Color("#d99b3d"), "smg": Color("#b84a58"), "barrel": Color("#252d43")
	}.get(id, Color("#7788a8"))
	material.metallic = 0.2
	material.roughness = 0.45
	return material

func _show_muzzle_flash() -> void:
	if not is_instance_valid(muzzle_flash):
		muzzle_flash = MeshInstance3D.new()
		var mesh := SphereMesh.new()
		mesh.radius = 0.07
		mesh.height = 0.14
		muzzle_flash.mesh = mesh
		var material := StandardMaterial3D.new()
		material.albedo_color = Color("#ffd45a")
		material.emission_enabled = true
		material.emission = Color("#ff8d30")
		material.emission_energy_multiplier = 3.0
		muzzle_flash.material_override = material
		add_child(muzzle_flash)
		muzzle_flash.position = Vector3(0.28, -0.22, -0.9)
	muzzle_flash.visible = true
	get_tree().create_timer(0.045).timeout.connect(func() -> void:
		if is_instance_valid(muzzle_flash):
			muzzle_flash.visible = false
	)

func _play_shot(weapon_id: String) -> void:
	if shot_audio == null:
		return
	var paths: Dictionary = {
		"rifle": "res://assets/sfx/gshot_rifle.ogg",
		"pistol": "res://assets/sfx/gshot_pistol.ogg",
		"shotgun": "res://assets/sfx/gshot_shotgun.ogg",
		"smg": "res://assets/sfx/gshot_pistol.ogg"
	}
	if not shot_streams.has(weapon_id):
		shot_streams[weapon_id] = load(str(paths.get(weapon_id, ""))) as AudioStream
	shot_audio.stream = shot_streams[weapon_id]
	shot_audio.pitch_scale = 1.08 if weapon_id == "smg" else (0.88 if weapon_id == "shotgun" else 1.0)
	shot_audio.play()

func _play_reload(phase: String) -> void:
	if reload_audio == null:
		return
	var path := "res://assets/sfx/reload_start.ogg" if phase == "start" else "res://assets/sfx/reload_end.ogg"
	reload_audio.stream = load(path) as AudioStream
	reload_audio.play()
