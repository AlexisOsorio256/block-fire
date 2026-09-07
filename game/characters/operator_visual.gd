class_name OperatorVisual
extends Node3D

var operator_id: String = "BRAVO"
var team: String = "ally"
var accent: Color = Color("#ff9d50")
var model_root: Node3D
var animation_player: AnimationPlayer
var animation_state: StringName = &""
var definition: OperatorDefinition

func configure(id: String, team_id: String, color: Color) -> void:
	operator_id = id
	team = team_id
	accent = color
	definition = _find_definition(id)
	_build()

func set_combat_state(moving: bool, firing: bool) -> void:
	if animation_player == null or not is_instance_valid(animation_player):
		return
	var desired: StringName = &"Idle"
	if firing and moving:
		desired = &"Run_Shoot"
	elif firing:
		desired = &"Idle_Shoot"
	elif moving:
		desired = &"Run_Gun"
	_play_animation(desired)

func play_death() -> void:
	_play_animation(&"Death")

func _build() -> void:
	for child: Node in get_children():
		child.free()
	model_root = null
	animation_player = null
	animation_state = &""
	var model_path := definition.model_scene if definition != null else OperatorDefinition.SHARED_CHARACTER_SCENE
	if team != "ally" and team != "player":
		model_path = OperatorDefinition.ENEMY_CHARACTER_SCENE
	var packed := load(model_path) as PackedScene
	if packed != null:
		model_root = packed.instantiate() as Node3D
	if model_root != null:
		add_child(model_root)
		# The shared rig has a broad toon silhouette; this scale keeps it aligned
		# with the gameplay capsule while preserving readable shoulders and gear.
		model_root.scale = Vector3.ONE * 0.78
		model_root.position.y = 0.30
		_hide_embedded_weapon_nodes(model_root)
		_apply_operator_materials()
		_find_animation_player()
		_play_animation(&"Idle")
		_add_team_marker()
		return
	_build_fallback()

func _find_definition(id: String) -> OperatorDefinition:
	for candidate: OperatorDefinition in OperatorDefinition.roster():
		if candidate.id == id:
			return candidate
	return OperatorDefinition.new()

func _find_animation_player() -> void:
	for candidate: Node in model_root.find_children("*", "AnimationPlayer", true, false):
		animation_player = candidate as AnimationPlayer
		if animation_player != null:
			return

func _hide_embedded_weapon_nodes(node: Node) -> void:
	var embedded_weapon_names: Array[String] = [
		"ak", "grenadelauncher", "knife_1", "knife_2", "pistol", "revolver",
		"revolver_small", "rocketlauncher", "shortcannon", "shotgun", "shovel",
		"smg", "sniper", "sniper_2"
	]
	for child: Node in node.get_children():
		if child is Node3D and embedded_weapon_names.has(child.name.to_lower()):
			(child as Node3D).visible = false
		else:
			_hide_embedded_weapon_nodes(child)

func _play_animation(animation_name: StringName) -> void:
	if animation_player == null or not is_instance_valid(animation_player):
		return
	if not animation_player.has_animation(animation_name):
		if animation_name != &"Idle" and animation_player.has_animation(&"Idle"):
			animation_name = &"Idle"
		else:
			return
	if animation_state == animation_name and animation_player.is_playing():
		return
	animation_state = animation_name
	animation_player.play(animation_name, 0.12)
	animation_player.speed_scale = 1.0

func _apply_operator_materials() -> void:
	if model_root == null:
		return
	var body_tint := accent
	var visor_tint := definition.visor if definition != null else Color("#55dcff")
	for candidate: Node in model_root.find_children("*", "MeshInstance3D", true, false):
		var mesh_instance := candidate as MeshInstance3D
		if mesh_instance == null or mesh_instance.mesh == null:
			continue
		var mesh_name := mesh_instance.name.to_lower()
		for surface_index: int in range(mesh_instance.mesh.get_surface_count()):
			var source := mesh_instance.get_active_material(surface_index)
			if source is not StandardMaterial3D:
				continue
			var material := source.duplicate() as StandardMaterial3D
			var tint := visor_tint if mesh_name.contains("head") or mesh_name.contains("visor") else body_tint
			var strength := 0.60 if tint == visor_tint else 0.34
			material.albedo_color = material.albedo_color.lerp(tint, strength)
			if tint == visor_tint:
				material.emission_enabled = true
				material.emission = tint
				material.emission_energy_multiplier = 0.35
			mesh_instance.set_surface_override_material(surface_index, material)

func _add_team_marker() -> void:
	var marker := MeshInstance3D.new()
	marker.name = "TeamMarker"
	var mesh := TorusMesh.new()
	mesh.inner_radius = 0.10
	mesh.outer_radius = 0.14
	marker.mesh = mesh
	marker.position = Vector3(0, 2.14, 0)
	marker.material_override = _emissive_material(accent)
	add_child(marker)

	var badge := MeshInstance3D.new()
	badge.name = "TeamBadge"
	var badge_mesh := CylinderMesh.new()
	badge_mesh.top_radius = 0.055
	badge_mesh.bottom_radius = 0.055
	badge_mesh.height = 0.025
	badge.mesh = badge_mesh
	badge.position = Vector3(0, 1.55, -0.44)
	badge.rotation_degrees.x = 90.0
	badge.material_override = _emissive_material(accent.lightened(0.18))
	add_child(badge)

func _build_fallback() -> void:
	var body := MeshInstance3D.new()
	var capsule := CapsuleMesh.new()
	capsule.height = 1.45
	capsule.radius = 0.34
	body.mesh = capsule
	body.position.y = 1.0
	body.material_override = _material(accent.darkened(0.18))
	add_child(body)
	var head := MeshInstance3D.new()
	var head_mesh := SphereMesh.new()
	head_mesh.height = 0.55
	head_mesh.radius = 0.3
	head.mesh = head_mesh
	head.position.y = 1.95
	head.material_override = _material(Color("#d4a27f"))
	add_child(head)
	var visor := MeshInstance3D.new()
	var visor_mesh := BoxMesh.new()
	visor_mesh.size = Vector3(0.34, 0.09, 0.05)
	visor.mesh = visor_mesh
	visor.position = Vector3(0, 2.02, -0.28)
	visor.material_override = _emissive_material(definition.visor if definition != null else Color("#5ce8ff"))
	add_child(visor)
	_add_team_marker()

func _emissive_material(color: Color) -> StandardMaterial3D:
	var material := _material(color)
	material.emission_enabled = true
	material.emission = color
	material.emission_energy_multiplier = 0.7
	return material

func _material(color: Color) -> StandardMaterial3D:
	var material := StandardMaterial3D.new()
	material.albedo_color = color
	material.roughness = 0.72
	return material
