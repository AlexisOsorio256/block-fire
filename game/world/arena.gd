class_name BlockfireArena
extends Node3D

const NAVIGATION_SOURCE_GROUP: StringName = &"blockfire_navigation_floor"
const NAVIGATION_AGENT_RADIUS: float = 0.5

var navigation_region: NavigationRegion3D

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
	navigation_region = NavigationRegion3D.new()
	navigation_region.name = "NavigationRegion"
	var mesh := NavigationMesh.new()
	mesh.agent_radius = NAVIGATION_AGENT_RADIUS
	mesh.agent_height = 1.75
	mesh.agent_max_climb = 0.25
	mesh.agent_max_slope = 35.0
	mesh.cell_size = 0.25
	mesh.cell_height = 0.25
	mesh.filter_walkable_low_height_spans = true
	mesh.set_parsed_geometry_type(NavigationMesh.PARSED_GEOMETRY_STATIC_COLLIDERS)
	mesh.set_source_geometry_mode(NavigationMesh.SOURCE_GEOMETRY_GROUPS_WITH_CHILDREN)
	mesh.set_source_group_name(NAVIGATION_SOURCE_GROUP)
	mesh.set_collision_mask(1)
	navigation_region.navigation_mesh = mesh
	add_child(navigation_region)

	# Bake one walkable source (the floor) and carve every gameplay obstacle.
	# The NavigationServer owns the resulting path graph; no custom grid/A* is
	# used and bots still follow it through NavigationAgent3D.
	var source := NavigationMeshSourceGeometryData3D.new()
	NavigationServer3D.parse_source_geometry_data(mesh, source, self)
	for obstruction: PackedVector3Array in _navigation_obstructions():
		source.add_projected_obstruction(obstruction, 0.0, 8.0, true)
	NavigationServer3D.bake_from_source_geometry_data(mesh, source)

func _navigation_obstructions() -> Array[PackedVector3Array]:
	var result: Array[PackedVector3Array] = []
	# The margin is intentionally slightly larger than the physical bot radius
	# so a path never asks the capsule center to skim a cover corner.
	var margin := NAVIGATION_AGENT_RADIUS + 0.12
	var blockers: Array[Dictionary] = [
		{"center": Vector3(0, 0, 0), "size": Vector3(10, 0, 8)},
		{"center": Vector3(0, 0, -18), "size": Vector3(24, 0, 3)},
		{"center": Vector3(0, 0, 18), "size": Vector3(24, 0, 3)},
		{"center": Vector3(-21, 0, 0), "size": Vector3(3, 0, 20)},
		{"center": Vector3(21, 0, 0), "size": Vector3(3, 0, 20)},
		{"center": Vector3(-38, 0, -19), "size": Vector3(4, 0, 4)},
		{"center": Vector3(-38, 0, 19), "size": Vector3(4, 0, 4)},
		{"center": Vector3(38, 0, -19), "size": Vector3(4, 0, 4)},
		{"center": Vector3(38, 0, 19), "size": Vector3(4, 0, 4)},
		{"center": Vector3(-10, 0, -37), "size": Vector3(4, 0, 4)},
		{"center": Vector3(10, 0, 37), "size": Vector3(4, 0, 4)},
		{"center": Vector3(-7, 0, -32), "size": Vector3(1.2, 0, 1.2)},
		{"center": Vector3(7, 0, -32), "size": Vector3(1.2, 0, 1.2)},
		{"center": Vector3(0, 0, -32), "size": Vector3(15.2, 0, 1.2)},
		{"center": Vector3(0, 0, -58), "size": Vector3(116, 0, 1)},
		{"center": Vector3(0, 0, 58), "size": Vector3(116, 0, 1)},
		{"center": Vector3(-58, 0, 0), "size": Vector3(1, 0, 116)},
		{"center": Vector3(58, 0, 0), "size": Vector3(1, 0, 116)}
	]
	for blocker: Dictionary in blockers:
		var center: Vector3 = blocker["center"]
		var size: Vector3 = blocker["size"]
		result.append(_rect_obstruction(center, size, margin))
	return result

func _rect_obstruction(center: Vector3, size: Vector3, margin: float) -> PackedVector3Array:
	var half_x := size.x * 0.5 + margin
	var half_z := size.z * 0.5 + margin
	return PackedVector3Array([
		Vector3(center.x - half_x, 0, center.z - half_z),
		Vector3(center.x + half_x, 0, center.z - half_z),
		Vector3(center.x + half_x, 0, center.z + half_z),
		Vector3(center.x - half_x, 0, center.z + half_z)
	])

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
	if node_name == "Ground":
		body.add_to_group(NAVIGATION_SOURCE_GROUP)
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
