class_name BlockfireArena
extends Node3D

var spawn_squad: Array[Vector3] = [
	Vector3(-28, 0.2, 0), Vector3(-24, 0.2, -7), Vector3(-24, 0.2, 7), Vector3(-20, 0.2, 0),
	Vector3(28, 0.2, 0), Vector3(24, 0.2, -7), Vector3(24, 0.2, 7), Vector3(20, 0.2, 0)
]
var spawn_ffa: Array[Vector3] = [
	Vector3(-30, 0.2, -24), Vector3(-10, 0.2, -27), Vector3(12, 0.2, -27), Vector3(30, 0.2, -18),
	Vector3(-30, 0.2, 20), Vector3(-10, 0.2, 27), Vector3(12, 0.2, 27), Vector3(30, 0.2, 20)
]

func build() -> void:
	_create_environment()
	_create_ground()
	_create_layout()
	_create_navigation()

func get_spawns(mode: String) -> Array[Vector3]:
	return spawn_ffa.duplicate() if mode == "ffa" else spawn_squad.duplicate()

func has_line_of_sight(from: Vector3, to: Vector3, exclude: Array[RID] = []) -> bool:
	var query := PhysicsRayQueryParameters3D.create(from, to)
	query.collision_mask = 1
	query.exclude = exclude
	var hit := get_world_3d().direct_space_state.intersect_ray(query)
	return hit.is_empty()

func _create_environment() -> void:
	var world := WorldEnvironment.new()
	var environment := Environment.new()
	environment.background_mode = Environment.BG_COLOR
	environment.background_color = Color("#3475bd")
	environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	environment.ambient_light_color = Color("#9ac6ef")
	environment.ambient_light_energy = 0.72
	environment.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	world.environment = environment
	add_child(world)
	var sun := DirectionalLight3D.new()
	sun.rotation_degrees = Vector3(-54, -28, 0)
	sun.light_color = Color("#fff0d2")
	sun.light_energy = 1.12
	sun.shadow_enabled = true
	sun.directional_shadow_max_distance = 55.0
	add_child(sun)

func _create_ground() -> void:
	_create_box("Ground", Vector3(0, -0.22, 0), Vector3(120, 0.4, 120), Color("#8795a7"), true)
	_create_box("NorthWall", Vector3(0, 2.4, -58), Vector3(116, 5.0, 1.0), Color("#314862"), true)
	_create_box("SouthWall", Vector3(0, 2.4, 58), Vector3(116, 5.0, 1.0), Color("#314862"), true)
	_create_box("WestWall", Vector3(-58, 2.4, 0), Vector3(1.0, 5.0, 116), Color("#314862"), true)
	_create_box("EastWall", Vector3(58, 2.4, 0), Vector3(1.0, 5.0, 116), Color("#314862"), true)

func _create_layout() -> void:
	var cover_color := Color("#a67250")
	var steel_color := Color("#405a70")
	_create_box("CenterBlock", Vector3(0, 1.6, 0), Vector3(10, 3.2, 8), steel_color, true)
	_create_box("CenterRoof", Vector3(0, 3.4, 0), Vector3(13, 0.35, 11), Color("#f0ad48"), true)
	_create_box("NorthCover", Vector3(0, 1.1, -18), Vector3(24, 2.2, 3.0), cover_color, true)
	_create_box("SouthCover", Vector3(0, 1.1, 18), Vector3(24, 2.2, 3.0), cover_color, true)
	_create_box("WestCover", Vector3(-21, 1.0, 0), Vector3(3.0, 2.0, 20), steel_color, true)
	_create_box("EastCover", Vector3(21, 1.0, 0), Vector3(3.0, 2.0, 20), steel_color, true)
	for position: Vector3 in [Vector3(-38, 0.9, -19), Vector3(-38, 0.9, 19), Vector3(38, 0.9, -19), Vector3(38, 0.9, 19), Vector3(-10, 0.65, -37), Vector3(10, 0.65, 37)]:
		_create_box("Crate", position, Vector3(4.0, 1.8, 4.0), Color("#bd8859"), true)
	var arch_color := Color("#a84d43")
	_create_box("ArchLeft", Vector3(-7, 3.0, -32), Vector3(1.2, 6.0, 1.2), arch_color, true)
	_create_box("ArchRight", Vector3(7, 3.0, -32), Vector3(1.2, 6.0, 1.2), arch_color, true)
	_create_box("ArchTop", Vector3(0, 5.8, -32), Vector3(15.2, 1.0, 1.2), Color("#d28c45"), true)

func _create_navigation() -> void:
	var region := NavigationRegion3D.new()
	region.name = "NavigationRegion"
	var mesh := NavigationMesh.new()
	mesh.vertices = PackedVector3Array([
		Vector3(-54, 0, -54), Vector3(54, 0, -54), Vector3(54, 0, 54), Vector3(-54, 0, 54)
	])
	mesh.add_polygon(PackedInt32Array([0, 1, 2, 3]))
	mesh.agent_radius = 0.55
	region.navigation_mesh = mesh
	add_child(region)

func _create_box(node_name: String, position: Vector3, size: Vector3, color: Color, collider: bool) -> Node3D:
	var visual := MeshInstance3D.new()
	visual.name = node_name + "Visual"
	var mesh := BoxMesh.new()
	mesh.size = size
	visual.mesh = mesh
	visual.position = position
	var texture_path := ""
	if node_name == "Ground":
		texture_path = "res://assets/textures/ground.png"
	elif node_name.contains("Wall") or node_name.contains("Center") or node_name.contains("Cover"):
		texture_path = "res://assets/textures/wall.png"
	elif node_name.contains("Crate"):
		texture_path = "res://assets/textures/cover.png"
	visual.material_override = _material(color, texture_path)
	add_child(visual)
	if not collider:
		return visual
	var body := StaticBody3D.new()
	body.name = node_name
	body.position = position
	body.collision_layer = 1
	body.collision_mask = 2 | 4
	var shape := CollisionShape3D.new()
	var box := BoxShape3D.new()
	box.size = size
	shape.shape = box
	body.add_child(shape)
	add_child(body)
	return body

func _material(color: Color, texture_path: String = "") -> StandardMaterial3D:
	var material := StandardMaterial3D.new()
	material.albedo_color = color.lightened(0.42) if texture_path != "" else color
	material.roughness = 0.82
	if texture_path != "":
		material.albedo_texture = load(texture_path) as Texture2D
		material.uv1_scale = Vector3(4.0, 4.0, 4.0)
	return material
