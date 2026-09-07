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
var ammo: Array[int] = []
var reserve: Array[int] = []
var available_indices: Array[int] = []
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
var muzzle_anchor: Node3D
var shot_audio: AudioStreamPlayer3D
var reload_audio: AudioStreamPlayer3D
var switch_audio: AudioStreamPlayer3D
var empty_audio: AudioStreamPlayer3D
var impact_audio: AudioStreamPlayer3D
var shot_streams: Dictionary = {}
var rng := RandomNumberGenerator.new()
var arms_root: Node3D
var viewmodel_base_position := Vector3(0.28, -0.22, -0.46)
var viewmodel_base_rotation := Vector3(0.0, 180.0, 0.0)
var ads_base_position := Vector3(0.12, -0.16, -0.56)
var ads_base_rotation := Vector3(0.0, 180.0, 0.0)
var viewmodel_scale := 0.36
var muzzle_local := Vector3(0.0, 0.05, 0.4)
var muzzle_flash_scale := 1.0
var ads_weight: float = 0.0
var recoil_amount: float = 0.0
var viewmodel_time: float = 0.0
var third_person: bool = false
var impact_played_this_shot: bool = false

func setup(owner_actor: Node, owner_camera: Camera3D = null, controls: Node = null) -> void:
	actor = owner_actor
	camera = owner_camera
	mobile_controls = controls
	third_person = camera == null
	if third_person:
		viewmodel_base_position = Vector3(0.32, 1.28, -0.34)
		viewmodel_base_rotation = Vector3(-8.0, 180.0, 0.0)
		viewmodel_scale = 0.46
	else:
		viewmodel_base_position = Vector3(0.28, -0.22, -0.46)
		viewmodel_base_rotation = Vector3(0.0, 180.0, 0.0)
		viewmodel_scale = 0.36
	_apply_definition_pose()
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
	switch_audio = AudioStreamPlayer3D.new()
	switch_audio.name = "SwitchSfx"
	switch_audio.bus = "SFX"
	switch_audio.max_distance = 20.0
	add_child(switch_audio)
	empty_audio = AudioStreamPlayer3D.new()
	empty_audio.name = "EmptySfx"
	empty_audio.bus = "SFX"
	empty_audio.max_distance = 16.0
	add_child(empty_audio)
	impact_audio = AudioStreamPlayer3D.new()
	impact_audio.name = "ImpactSfx"
	impact_audio.bus = "SFX"
	impact_audio.max_distance = 28.0
	add_child(impact_audio)
	_reset_ammo_from_definitions()
	available_indices.clear()
	for index: int in range(DEFINITIONS.size()):
		available_indices.append(index)
	_refresh_viewmodel()
	if not third_person:
		_create_arms()
	_emit_ammo()

func _physics_process(delta: float) -> void:
	viewmodel_time += delta
	recoil_amount = move_toward(recoil_amount, 0.0, delta * (2.2 + current_definition().recoil * 4.0))
	_animate_viewmodel(delta)
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

func set_available_weapons(indices: Array, preferred_index: int = -1) -> void:
	var sanitized: Array[int] = []
	for value: Variant in indices:
		var index := int(value)
		if index >= 0 and index < DEFINITIONS.size() and not sanitized.has(index):
			sanitized.append(index)
	if sanitized.is_empty():
		sanitized.append(1)
	available_indices = sanitized
	var desired := active_index
	if preferred_index >= 0 and available_indices.has(preferred_index):
		desired = preferred_index
	elif not available_indices.has(desired):
		desired = available_indices[0]
	if desired != active_index:
		active_index = desired
		reload_timer = 0.0
		switching_timer = 0.0
		_refresh_viewmodel()
		_emit_ammo()
		weapon_changed.emit(current_definition())

func is_weapon_available(index: int) -> bool:
	return available_indices.has(index)

func set_fire_held(value: bool) -> void:
	fire_held = value

func set_aim_held(value: bool) -> void:
	aim_held = value

func clear_combat_input() -> void:
	fire_held = false
	aim_held = false
	previous_fire = false
	cooldown = 0.0
	reload_timer = 0.0
	switching_timer = 0.0
	ai_target = null
	ai_can_see = false

func can_use_combat() -> bool:
	if actor == null or not bool(actor.get("is_alive")):
		return false
	if actor.has_method("can_use_combat"):
		return bool(actor.can_use_combat())
	var context: Node = actor.get("match_context")
	return context == null or not context.has_method("is_combat_active") or bool(context.is_combat_active())

func set_ai_target(target: Node, can_see: bool) -> void:
	ai_target = target
	ai_can_see = can_see

func switch_to(index: int) -> bool:
	if index < 0 or index >= DEFINITIONS.size() or not available_indices.has(index):
		return false
	if index == active_index:
		return true
	if reload_timer > 0.0:
		reload_timer = 0.0
	active_index = index
	switching_timer = 0.34
	_refresh_viewmodel()
	_emit_ammo()
	weapon_changed.emit(current_definition())
	_play_switch()
	return true

func next_weapon() -> void:
	if available_indices.is_empty():
		return
	var slot := available_indices.find(active_index)
	if slot < 0:
		slot = 0
	switch_to(available_indices[(slot + 1) % available_indices.size()])

func previous_weapon() -> void:
	if available_indices.is_empty():
		return
	var slot := available_indices.find(active_index)
	if slot < 0:
		slot = 0
	switch_to(available_indices[(slot - 1 + available_indices.size()) % available_indices.size()])

func request_reload() -> void:
	if not can_use_combat() or reload_timer > 0.0 or switching_timer > 0.0:
		return
	if ammo.size() <= active_index or reserve.size() <= active_index:
		return
	var definition := current_definition()
	if ammo[active_index] >= definition.magazine_size or reserve[active_index] <= 0:
		return
	reload_timer = definition.reload_time
	_play_reload("start")

func try_fire() -> bool:
	if not can_use_combat() or switching_timer > 0.0 or reload_timer > 0.0 or cooldown > 0.0:
		return false
	if ammo.size() <= active_index or reserve.size() <= active_index:
		return false
	var definition := current_definition()
	if ammo[active_index] <= 0:
		_play_empty()
		request_reload()
		return false
	ammo[active_index] -= 1
	cooldown = definition.fire_interval
	var recoil_scale := 0.76 if aim_held else 1.0
	recoil_amount = minf(0.26, recoil_amount + definition.recoil * 2.4 * recoil_scale)
	if actor != null and actor.has_method("break_spawn_immunity"):
		actor.break_spawn_immunity()
	if actor != null and actor.has_method("apply_weapon_recoil"):
		actor.apply_weapon_recoil(definition.recoil, aim_held)
	_emit_ammo()
	weapon_fired.emit(definition)
	_play_shot(definition.id)
	_show_muzzle_flash()
	impact_played_this_shot = false
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
		_play_impact_once()
		return
	if actor.has_method("get_team") and target.get_team() == actor.get_team():
		return
	var distance: float = origin.distance_to(hit.position)
	var multiplier: float = 1.0
	var headshot := false
	if is_headshot_collider(collider):
		multiplier = definition.headshot_multiplier
		headshot = true
	var falloff := 1.0
	if distance > definition.falloff_start:
		falloff = lerpf(1.0, definition.falloff_min, inverse_lerp(definition.falloff_start, definition.range, distance))
	var damage: float = definition.damage * multiplier * falloff
	if target.has_method("take_damage"):
		target.take_damage(damage, actor, headshot)
		damage_confirmed.emit(damage, headshot)

func is_headshot_collider(collider: Object) -> bool:
	return collider is Area3D and collider.get_meta("damage_zone", "") == "head"

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

func _reset_ammo_from_definitions() -> void:
	ammo.clear()
	reserve.clear()
	for definition: WeaponDefinition in DEFINITIONS:
		ammo.append(definition.magazine_size)
		reserve.append(definition.reserve_ammo)

func _emit_ammo() -> void:
	if DEFINITIONS.is_empty() or ammo.size() < DEFINITIONS.size() or reserve.size() < DEFINITIONS.size():
		return
	ammo_changed.emit(ammo[active_index], reserve[active_index], current_definition())

func _refresh_viewmodel() -> void:
	if is_instance_valid(viewmodel):
		viewmodel.queue_free()
	viewmodel = null
	muzzle_anchor = null
	var definition := current_definition()
	_apply_definition_pose()
	var model_scene := load(definition.viewmodel_scene) as PackedScene
	if model_scene != null:
		viewmodel = model_scene.instantiate() as Node3D
	if viewmodel == null:
		viewmodel = _fallback_weapon(definition.id)
	add_child(viewmodel)
	viewmodel.position = viewmodel_base_position
	viewmodel.rotation_degrees = viewmodel_base_rotation
	viewmodel.scale = Vector3.ONE * viewmodel_scale
	_create_muzzle_anchor()
	_apply_weapon_skin()

func _apply_definition_pose() -> void:
	# Per-weapon first-person calibration from the WeaponDefinition resource;
	# third-person keeps its own fixed rig pose.
	var definition := current_definition()
	if third_person:
		return
	viewmodel_base_position = definition.hip_position
	viewmodel_base_rotation = definition.hip_rotation
	ads_base_position = definition.ads_position
	ads_base_rotation = definition.ads_rotation
	muzzle_local = definition.muzzle_offset
	muzzle_flash_scale = definition.muzzle_flash_scale

func _create_muzzle_anchor() -> void:
	if viewmodel == null or not is_instance_valid(viewmodel):
		return
	muzzle_anchor = Node3D.new()
	muzzle_anchor.name = "MuzzleAnchor"
	# Weapon models are origin-centered with the barrel tip pointing +Z
	# (rifle tip z=+0.43, shotgun +1.39, pistol/smg +0.32). Place the anchor
	# at the real muzzle tip so the flash leaves the barrel, not the stock.
	muzzle_anchor.position = muzzle_local
	if third_person:
		muzzle_anchor.position = Vector3(0.0, 0.0, -0.78)
	viewmodel.add_child(muzzle_anchor)

func _create_arms() -> void:
	if is_instance_valid(arms_root):
		arms_root.queue_free()
	arms_root = Node3D.new()
	arms_root.name = "ArmsAndHands"
	arms_root.position = viewmodel_base_position
	arms_root.rotation_degrees = viewmodel_base_rotation
	# Sleeve + worked glove hands reading as operator arms, not blobs.
	arms_root.scale = Vector3.ONE * 0.30
	add_child(arms_root)
	_create_sleeve("LeftSleeve", Vector3(0.02, -0.08, 0.16), Vector3(6.0, -14.0, -30.0), Vector3(0.10, 0.09, 0.30))
	_create_sleeve("RightSleeve", Vector3(-0.14, -0.09, 0.20), Vector3(6.0, 12.0, 26.0), Vector3(0.10, 0.09, 0.30))
	# Screen mapping (viewmodel yaw 180): local +x reads slightly screen-right,
	# local +z reads screen-left toward the muzzle. Trigger hand at the grip,
	# support hand forward under the barrel.
	_create_hand("TriggerHand", Vector3(0.02, -0.02, -0.10), 12.0)
	_create_hand("SupportHand", Vector3(-0.10, -0.10, 0.33), -12.0)

func _create_sleeve(node_name: String, position: Vector3, rotation: Vector3, size: Vector3) -> void:
	var sleeve := MeshInstance3D.new()
	sleeve.name = node_name
	# Tapered sleeve built from a capsule-like cylinder: shoulder wide, wrist narrow.
	var mesh := CylinderMesh.new()
	mesh.top_radius = minf(size.x, size.y) * 0.55
	mesh.bottom_radius = maxf(size.x, size.y) * 0.62
	mesh.height = size.z
	mesh.radial_segments = 10
	mesh.rings = 1
	sleeve.mesh = mesh
	sleeve.position = position
	sleeve.rotation_degrees = rotation
	sleeve.rotation_degrees.x += 90.0
	sleeve.material_override = _arm_material(Color("#2c4468"))
	arms_root.add_child(sleeve)
	# Cuff ring near the wrist to break the silhouette.
	var cuff := MeshInstance3D.new()
	var cuff_mesh := TorusMesh.new()
	cuff_mesh.inner_radius = maxf(size.x, size.y) * 0.5
	cuff_mesh.outer_radius = maxf(size.x, size.y) * 0.78
	cuff.mesh = cuff_mesh
	cuff.position = Vector3(0.0, -size.z * 0.42, 0.0)
	cuff.rotation_degrees = Vector3(0.0, 0.0, 0.0)
	cuff.material_override = _arm_material(Color("#1d2c45"))
	sleeve.add_child(cuff)

func _create_hand(node_name: String, position: Vector3, roll: float) -> void:
	var hand := MeshInstance3D.new()
	hand.name = node_name
	# Gloved fist: tapered palm + wrapped thumb knuckle over the grip.
	var palm_mesh := PrismMesh.new()
	palm_mesh.size = Vector3(0.13, 0.11, 0.15)
	palm_mesh.left_to_right = 0.18
	hand.mesh = palm_mesh
	hand.position = position
	hand.rotation_degrees = Vector3(-14.0, 0.0, roll)
	hand.material_override = _arm_material(Color("#d99873"))
	arms_root.add_child(hand)
	# Wrap thumb block overlapping the palm toward the grip.
	var knuckle := MeshInstance3D.new()
	var knuckle_mesh := BoxMesh.new()
	knuckle_mesh.size = Vector3(0.115, 0.055, 0.075)
	knuckle.mesh = knuckle_mesh
	knuckle.position = Vector3(0.0, 0.045, -0.045)
	knuckle.rotation_degrees.x = 24.0
	knuckle.material_override = _arm_material(Color("#c9855f"))
	hand.add_child(knuckle)

func _arm_material(color: Color) -> StandardMaterial3D:
	var material := StandardMaterial3D.new()
	material.albedo_color = color
	material.roughness = 0.86
	return material

func _animate_viewmodel(delta: float) -> void:
	if not is_instance_valid(viewmodel):
		return
	var aiming_now := 1.0 if aim_held else 0.0
	ads_weight = lerpf(ads_weight, aiming_now, clampf(delta * 14.0, 0.0, 1.0))
	var movement := Vector3.ZERO
	if actor is CharacterBody3D:
		var actor_velocity := (actor as CharacterBody3D).velocity
		movement = Vector3(actor_velocity.x, 0.0, actor_velocity.z)
	var move_amount := clampf(movement.length() / 8.0, 0.0, 1.0)
	var bob := Vector3(
		cos(viewmodel_time * 8.0) * 0.012 * move_amount,
		sin(viewmodel_time * 16.0) * 0.009 * move_amount,
		0.0
	)
	var sway := Vector3(sin(viewmodel_time * 1.35) * 0.006, cos(viewmodel_time * 1.7) * 0.005, 0.0)
	var target_position := viewmodel_base_position.lerp(ads_base_position, ads_weight) + bob + sway
	var target_rotation := viewmodel_base_rotation.lerp(ads_base_rotation, ads_weight)
	target_rotation.x -= recoil_amount * 54.0
	target_rotation.z += sin(viewmodel_time * 8.0) * 1.5 * move_amount
	if reload_timer > 0.0:
		# Two-phase reload: drop and roll the gun out (first 45%), then bring it
		# back up to seated (rest). Keeps hands near grip/foregrip the whole time.
		var definition := current_definition()
		var phase := clampf(1.0 - reload_timer / definition.reload_time, 0.0, 1.0)
		var pull := sin(clampf(phase / 0.45, 0.0, 1.0) * PI) if phase < 0.45 else sin(clampf((phase - 0.45) / 0.55, 0.0, 1.0) * PI) * 0.35
		target_position += Vector3(-0.04 * pull, (-0.16 + 0.03 * sin(phase * PI)) * pull + 0.02 * pull, 0.10 * pull)
		target_rotation.x += 14.0 * pull
		target_rotation.z += (26.0 - 10.0 * sin(phase * PI)) * pull
	if switching_timer > 0.0:
		var switch_weight := clampf(switching_timer / 0.34, 0.0, 1.0)
		target_position += Vector3(0.03, -sin(switch_weight * PI) * 0.20, switch_weight * 0.12)
		target_rotation.z += sin(switch_weight * PI) * 28.0
	viewmodel.position = viewmodel.position.lerp(target_position, clampf(delta * 18.0, 0.0, 1.0))
	viewmodel.rotation_degrees = viewmodel.rotation_degrees.lerp(target_rotation, clampf(delta * 18.0, 0.0, 1.0))
	if is_instance_valid(arms_root):
		arms_root.position = viewmodel.position
		arms_root.rotation_degrees = viewmodel.rotation_degrees
		if reload_timer > 0.0:
			# The gun drops into the reload pose while the hands stay close to
			# the grip; this avoids a forearm clipping through the screen edge.
			arms_root.position.y += 0.10
			arms_root.rotation_degrees.x = lerpf(viewmodel_base_rotation.x, viewmodel.rotation_degrees.x, 0.18)
			arms_root.rotation_degrees.z = lerpf(viewmodel_base_rotation.z, viewmodel.rotation_degrees.z, 0.18)

func _apply_weapon_skin() -> void:
	if viewmodel == null or not is_instance_valid(viewmodel):
		return
	var settings := get_node_or_null("/root/SettingsStore") if is_inside_tree() else null
	var skin := str(settings.get_value("weapon_skin", "Estándar") if settings != null else "Estándar")
	WeaponSkin.apply(viewmodel, skin)

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
	if muzzle_anchor == null or not is_instance_valid(muzzle_anchor):
		_create_muzzle_anchor()
	if muzzle_anchor == null:
		return
	if not is_instance_valid(muzzle_flash):
		muzzle_flash = MeshInstance3D.new()
		# Cheap billboard quad + short cone: reads as a flash in a single frame
		# on Mobile renderer, much lighter than particles.
		var quad := QuadMesh.new()
		quad.size = Vector2(0.34, 0.34)
		var flash_mesh := ArrayMesh.new()
		flash_mesh.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, quad.get_mesh_arrays())
		muzzle_flash.mesh = flash_mesh
		muzzle_flash.material_override = _muzzle_flash_material()
		muzzle_anchor.add_child(muzzle_flash)
		muzzle_flash.position = Vector3(0.0, 0.0, 0.02)
		var spike := MeshInstance3D.new()
		spike.name = "MuzzleSpike"
		var cone := CylinderMesh.new()
		cone.top_radius = 0.004
		cone.bottom_radius = 0.045
		cone.height = 0.26
		cone.radial_segments = 6
		spike.mesh = cone
		spike.material_override = _muzzle_flash_material()
		spike.rotation_degrees.x = -90.0
		spike.position = Vector3(0.0, 0.0, 0.15)
		muzzle_flash.add_child(spike)
	var flash_scale := maxf(0.6, muzzle_flash_scale)
	muzzle_flash.scale = Vector3.ONE * flash_scale
	muzzle_flash.rotation_degrees.z = rng.randf_range(0.0, 360.0)
	muzzle_flash.visible = true
	get_tree().create_timer(0.045).timeout.connect(func() -> void:
		if is_instance_valid(muzzle_flash):
			muzzle_flash.visible = false
	)

func _muzzle_flash_material() -> StandardMaterial3D:
	var material := StandardMaterial3D.new()
	material.albedo_color = Color("#ffd45a")
	material.emission_enabled = true
	material.emission = Color("#ff8d30")
	material.emission_energy_multiplier = 3.4
	material.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	material.billboard_mode = BaseMaterial3D.BILLBOARD_ENABLED
	material.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	material.albedo_color.a = 0.9
	return material

func _play_shot(weapon_id: String) -> void:
	if shot_audio == null:
		return
	var paths: Dictionary = {
		"rifle": "res://assets/sfx/gshot_rifle.ogg",
		"pistol": "res://assets/sfx/gshot_pistol.ogg",
		"shotgun": "res://assets/sfx/gshot_shotgun.ogg",
		"smg": "res://assets/sfx/gshot_rifle.ogg"
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

func _play_switch() -> void:
	if switch_audio == null:
		return
	switch_audio.stream = load("res://assets/sfx/switch.ogg") as AudioStream
	switch_audio.play()

func _play_empty() -> void:
	if empty_audio == null:
		return
	empty_audio.stream = load("res://assets/sfx/empty.ogg") as AudioStream
	empty_audio.play()

func _play_impact_once() -> void:
	if impact_played_this_shot or impact_audio == null:
		return
	impact_played_this_shot = true
	impact_audio.stream = load("res://assets/sfx/sfx_impact_wall.ogg") as AudioStream
	impact_audio.play()
