class_name BlockfireArena
extends Node3D

const NAVIGATION_SOURCE_GROUP: StringName = &"blockfire_navigation_floor"
const NAVIGATION_AGENT_RADIUS: float = 0.5

var navigation_region: NavigationRegion3D
var gameplay_obstacles: Array[Dictionary] = []

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
	gameplay_obstacles.clear()
	var cover_color := Color("#a67250")
	var steel_color := Color("#405a70")
	_add_obstacle("CenterBlock", Vector3(0, 1.6, 0), Vector3(10, 3.2, 8), steel_color)
	_create_box("CenterRoof", Vector3(0, 3.4, 0), Vector3(13, 0.35, 11), Color("#f0ad48"), true)
	_add_obstacle("NorthCover", Vector3(0, 1.1, -18), Vector3(24, 2.2, 3.0), cover_color)
	_add_obstacle("SouthCover", Vector3(0, 1.1, 18), Vector3(24, 2.2, 3.0), cover_color)
	_add_obstacle("WestCover", Vector3(-21, 1.0, 0), Vector3(3.0, 2.0, 20), steel_color)
	_add_obstacle("EastCover", Vector3(21, 1.0, 0), Vector3(3.0, 2.0, 20), steel_color)
	for position: Vector3 in [Vector3(-38, 0.9, -19), Vector3(-38, 0.9, 19), Vector3(38, 0.9, -19), Vector3(38, 0.9, 19), Vector3(-10, 0.65, -37), Vector3(10, 0.65, 37)]:
		_add_obstacle("Crate", position, Vector3(4.0, 1.8, 4.0), Color("#bd8859"))
	var arch_color := Color("#a84d43")
	_add_obstacle("ArchLeft", Vector3(-7, 3.0, -32), Vector3(1.2, 6.0, 1.2), arch_color)
	_add_obstacle("ArchRight", Vector3(7, 3.0, -32), Vector3(1.2, 6.0, 1.2), arch_color)
	# ArchTop is above the agent height. It remains a visual lintel, not a
	# ground-projected navigation obstruction, so the gate stays traversable.
	_create_box("ArchTop", Vector3(0, 5.8, -32), Vector3(15.2, 1.0, 1.2), Color("#d28c45"), true)
	_create_landmarks()

func _add_obstacle(node_name: String, position: Vector3, size: Vector3, color: Color) -> void:
	gameplay_obstacles.append({"center": position, "size": size})
	_create_box(node_name, position, size, color, true)

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
	var blockers: Array[Dictionary] = gameplay_obstacles.duplicate(true)
	# The lintel is intentionally absent here: its physical collider is above
	# the walkable span and must not close the open gate.
	blockers.append_array([
		{"center": Vector3(0, 0, -58), "size": Vector3(116, 0, 1)},
		{"center": Vector3(0, 0, 58), "size": Vector3(116, 0, 1)},
		{"center": Vector3(-58, 0, 0), "size": Vector3(1, 0, 116)},
		{"center": Vector3(58, 0, 0), "size": Vector3(1, 0, 116)}
	])
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
	var visual := _create_obstacle_visual(node_name, position, size, color)
	if visual == null:
		var box_visual := MeshInstance3D.new()
		box_visual.name = node_name + "Visual"
		var mesh := BoxMesh.new()
		mesh.size = size
		box_visual.mesh = mesh
		box_visual.position = position
		var texture_path := ""
		if node_name == "Ground":
			texture_path = "res://assets/textures/ground.png"
		elif node_name.contains("Wall") or node_name.contains("Center") or node_name.contains("Cover"):
			texture_path = "res://assets/textures/wall.png"
		elif node_name.contains("Crate"):
			texture_path = "res://assets/textures/cover.png"
		box_visual.material_override = _material(color, texture_path)
		visual = box_visual
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

func _create_obstacle_visual(node_name: String, position: Vector3, _size: Vector3, color: Color) -> Node3D:
	match node_name:
		"CenterBlock":
			var center := Node3D.new()
			center.name = "CentralStructureVisual"
			center.position = Vector3(position.x, 0.0, position.z)
			var structure := _load_prop("Structure_1.gltf")
			if structure == null:
				return null
			structure.scale = Vector3(1.15, 0.75, 1.45)
			center.add_child(structure)
			_add_accent_bar(center, Vector3(0, 1.85, -3.55), Vector3(8.0, 0.14, 0.18), Color("#42d6e9"))
			_add_accent_bar(center, Vector3(0, 1.85, 3.55), Vector3(8.0, 0.14, 0.18), Color("#ffb73e"))
			return center
		"NorthCover", "SouthCover":
			var lane_cover := Node3D.new()
			lane_cover.name = node_name + "Visual"
			lane_cover.position = Vector3(position.x, 0.0, position.z)
			for offset: float in [-9.0, -4.5, 0.0, 4.5, 9.0]:
				var container := _load_prop("Container_Long.gltf")
				if container == null:
					return null
				container.position.x = offset
				container.scale = Vector3.ONE * 1.02
				lane_cover.add_child(container)
			_add_accent_bar(lane_cover, Vector3(0, 1.32, 0), Vector3(22.0, 0.10, 0.12), color.lightened(0.16))
			return lane_cover
		"WestCover", "EastCover":
			var side_cover := Node3D.new()
			side_cover.name = node_name + "Visual"
			side_cover.position = Vector3(position.x, 0.0, position.z)
			for offset: float in [-7.5, -2.5, 2.5, 7.5]:
				var barrier := _load_prop("Barrier_Large.gltf")
				if barrier == null:
					return null
				barrier.position.z = offset
				barrier.rotation_degrees.y = 90.0
				barrier.scale = Vector3.ONE * 0.92
				side_cover.add_child(barrier)
			_add_accent_bar(side_cover, Vector3(0, 1.86, 0), Vector3(0.12, 0.10, 18.0), color.lightened(0.18))
			return side_cover
	return null

func _load_prop(file_name: String) -> Node3D:
	var packed := load("res://assets/models/quaternius_toon_shooter/" + file_name) as PackedScene
	return packed.instantiate() as Node3D if packed != null else null

func _add_accent_bar(parent: Node3D, position: Vector3, size: Vector3, color: Color) -> void:
	var bar := MeshInstance3D.new()
	bar.name = "AccentTrim"
	var mesh := BoxMesh.new()
	mesh.size = size
	bar.mesh = mesh
	bar.position = position
	bar.material_override = _emissive_material(color, 0.35)
	parent.add_child(bar)

func _create_landmarks() -> void:
	_create_lane_marker("CentralLane", Vector3(0, 0.012, 0), Vector3(12.0, 0.025, 0.18), Color("#37cfe0"))
	_create_lane_marker("NorthLane", Vector3(0, 0.012, -29.5), Vector3(12.0, 0.025, 0.18), Color("#ffb73e"))
	_create_lane_marker("SouthLane", Vector3(0, 0.012, 29.5), Vector3(12.0, 0.025, 0.18), Color("#f26e80"))
	_create_landmark_label("CENTRAL", Vector3(0, 4.35, -4.1), Color("#63e9f5"))
	_create_landmark_label("ORANGE GATE", Vector3(0, 6.65, -31.0), Color("#ffb73e"))
	_create_landmark_label("CONTAINERS", Vector3(-41.0, 3.75, -18.0), Color("#63e9f5"))
	_create_landmark_label("SOUTH YARD", Vector3(41.0, 3.75, 18.0), Color("#f7839a"))

func _create_lane_marker(node_name: String, position: Vector3, size: Vector3, color: Color) -> void:
	var marker := MeshInstance3D.new()
	marker.name = node_name
	var mesh := BoxMesh.new()
	mesh.size = size
	marker.mesh = mesh
	marker.position = position
	marker.material_override = _emissive_material(color, 0.2)
	add_child(marker)

func _create_landmark_label(text: String, position: Vector3, color: Color) -> void:
	var label := Label3D.new()
	label.name = text.replace(" ", "") + "Sign"
	label.text = text
	label.position = position
	label.font_size = 40
	label.pixel_size = 0.008
	label.modulate = color
	label.outline_size = 8
	label.outline_modulate = Color("#071127cc")
	label.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	label.no_depth_test = true
	add_child(label)

func _emissive_material(color: Color, energy: float) -> StandardMaterial3D:
	var material := _material(color)
	material.emission_enabled = true
	material.emission = color
	material.emission_energy_multiplier = energy
	return material

func _material(color: Color, texture_path: String = "") -> StandardMaterial3D:
	var material := StandardMaterial3D.new()
	material.albedo_color = color.lightened(0.42) if texture_path != "" else color
	material.roughness = 0.82
	if texture_path != "":
		material.albedo_texture = load(texture_path) as Texture2D
		material.uv1_scale = Vector3(4.0, 4.0, 4.0)
	return material
