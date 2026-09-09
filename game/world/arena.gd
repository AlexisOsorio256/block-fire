class_name BlockfireArena
extends Node3D

## Campo exterior original: terreno, piedra, vegetación y refugios. La
## colisión conserva huellas predecibles para navegación, pero el runtime no
## carga props Toon ni representa las coberturas como una arena de cajas.
const NAVIGATION_SOURCE_GROUP: StringName = &"blockfire_navigation_floor"
const NAVIGATION_AGENT_RADIUS := 0.5

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
	return get_world_3d().direct_space_state.intersect_ray(query).is_empty()


func _create_environment() -> void:
	var world := WorldEnvironment.new()
	var environment := Environment.new()
	environment.background_mode = Environment.BG_SKY
	var sky := Sky.new()
	var sky_material := ProceduralSkyMaterial.new()
	sky_material.sky_top_color = Color("#2c69a8")
	sky_material.sky_horizon_color = Color("#b9d8e7")
	sky_material.ground_bottom_color = Color("#33432d")
	sky_material.ground_horizon_color = Color("#6e8466")
	sky_material.sun_angle_max = 16.0
	sky.sky_material = sky_material
	environment.sky = sky
	environment.ambient_light_source = Environment.AMBIENT_SOURCE_SKY
	environment.ambient_light_sky_contribution = 0.82
	environment.ambient_light_energy = 0.72
	environment.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	world.environment = environment
	add_child(world)
	var sun := DirectionalLight3D.new()
	sun.rotation_degrees = Vector3(-52, -30, 0)
	sun.light_color = Color("#fff0d2")
	sun.light_energy = 1.08
	sun.shadow_enabled = true
	sun.shadow_bias = 0.18
	sun.shadow_normal_bias = 3.5
	sun.directional_shadow_max_distance = 65.0
	add_child(sun)


func _create_ground() -> void:
	_create_floor()
	for side: float in [-1.0, 1.0]:
		_create_boundary(Vector3(side * 58.0, 2.4, 0), Vector3(1.0, 5.0, 116.0))
		_create_boundary(Vector3(0, 2.4, side * 58.0), Vector3(116.0, 5.0, 1.0))
	for position: Vector3 in [Vector3(-47, 0, -43), Vector3(46, 0, -38), Vector3(-45, 0, 38), Vector3(45, 0, 41)]:
		_add_tree(position, 1.25)
		_add_tree(position + Vector3(3.0, 0, 2.0), 0.85)


func _create_layout() -> void:
	gameplay_obstacles.clear()
	_add_obstacle("FieldStation", Vector3(0, 1.65, 0), Vector3(10, 3.3, 8), Color("#475b62"), 0.0)
	_add_obstacle("NorthRidge", Vector3(0, 1.1, -18), Vector3(24, 2.2, 3.0), Color("#6c6250"), 0.0)
	_add_obstacle("SouthRidge", Vector3(0, 1.1, 18), Vector3(24, 2.2, 3.0), Color("#6c6250"), 0.0)
	_add_obstacle("WestGrove", Vector3(-21, 1.0, 0), Vector3(3.0, 2.0, 20), Color("#557354"), 0.0)
	_add_obstacle("EastGrove", Vector3(21, 1.0, 0), Vector3(3.0, 2.0, 20), Color("#557354"), 0.0)
	for spec: Dictionary in [
		{"pos": Vector3(-38, 0.9, -19), "yaw": 6.0}, {"pos": Vector3(-38, 0.9, 19), "yaw": -9.0},
		{"pos": Vector3(38, 0.9, -19), "yaw": 11.0}, {"pos": Vector3(38, 0.9, 19), "yaw": -5.0},
		{"pos": Vector3(-10, 0.65, -37), "yaw": 12.0}, {"pos": Vector3(10, 0.65, 37), "yaw": -10.0}
	]:
		_add_obstacle("RockCluster", spec["pos"], Vector3(4.0, 1.8, 4.0), Color("#706757"), spec["yaw"])
	_add_obstacle("NorthGateLeft", Vector3(-7, 3.0, -32), Vector3(1.2, 6.0, 1.2), Color("#5b6361"), 0.0)
	_add_obstacle("NorthGateRight", Vector3(7, 3.0, -32), Vector3(1.2, 6.0, 1.2), Color("#5b6361"), 0.0)
	_create_gate_lintel()
	_create_landmarks()


func _add_obstacle(node_name: String, position: Vector3, size: Vector3, color: Color, yaw_degrees: float) -> void:
	gameplay_obstacles.append({"center": position, "size": size})
	_create_cover_visual(node_name, position, size, color, yaw_degrees)
	_add_box_collider(node_name, position, size, yaw_degrees)


func _create_floor() -> void:
	var floor := MeshInstance3D.new()
	floor.name = "GroundVisual"
	floor.mesh = _terrain_mesh(120.0, 48)
	floor.material_override = _ground_material()
	add_child(floor)
	var body := StaticBody3D.new()
	body.name = "Ground"
	body.add_to_group(NAVIGATION_SOURCE_GROUP)
	var shape := CollisionShape3D.new()
	var box := BoxShape3D.new()
	box.size = Vector3(120, 0.4, 120)
	shape.shape = box
	shape.position.y = -0.2
	body.add_child(shape)
	add_child(body)


func _terrain_mesh(size: float, subdivisions: int) -> ArrayMesh:
	var surface := SurfaceTool.new()
	surface.begin(Mesh.PRIMITIVE_TRIANGLES)
	var step := size / float(subdivisions)
	var start := -size * 0.5
	for z: int in range(subdivisions):
		for x: int in range(subdivisions):
			var x0 := start + float(x) * step
			var x1 := x0 + step
			var z0 := start + float(z) * step
			var z1 := z0 + step
			var uv0 := Vector2(float(x) / subdivisions * 4.0, float(z) / subdivisions * 4.0)
			var uv1 := Vector2(float(x + 1) / subdivisions * 4.0, float(z + 1) / subdivisions * 4.0)
			var p00 := Vector3(x0, _terrain_height(x0, z0), z0)
			var p01 := Vector3(x0, _terrain_height(x0, z1), z1)
			var p10 := Vector3(x1, _terrain_height(x1, z0), z0)
			var p11 := Vector3(x1, _terrain_height(x1, z1), z1)
			_surface_vertex(surface, p00, Vector2(uv0.x, uv0.y))
			_surface_vertex(surface, p01, Vector2(uv0.x, uv1.y))
			_surface_vertex(surface, p10, Vector2(uv1.x, uv0.y))
			_surface_vertex(surface, p10, Vector2(uv1.x, uv0.y))
			_surface_vertex(surface, p01, Vector2(uv0.x, uv1.y))
			_surface_vertex(surface, p11, uv1)
	surface.generate_normals()
	var mesh := surface.commit()
	return mesh if mesh != null else ArrayMesh.new()


func _surface_vertex(surface: SurfaceTool, position: Vector3, uv: Vector2) -> void:
	surface.set_uv(uv)
	surface.add_vertex(position)


func _terrain_height(x: float, z: float) -> float:
	# Very shallow undulation gives the field depth without moving collision or
	# navigation off their deterministic flat gameplay plane.
	var broad := sin(x * 0.075) * 0.08 + cos(z * 0.065) * 0.06
	var detail := sin((x + z) * 0.19) * 0.018
	return broad + detail


func _create_boundary(position: Vector3, size: Vector3) -> void:
	var body := StaticBody3D.new()
	body.name = "Boundary"
	body.position = position
	body.collision_layer = 1
	var shape := CollisionShape3D.new()
	var box := BoxShape3D.new()
	box.size = size
	shape.shape = box
	body.add_child(shape)
	add_child(body)


func _add_box_collider(node_name: String, position: Vector3, size: Vector3, yaw_degrees: float) -> void:
	var body := StaticBody3D.new()
	body.name = node_name
	body.position = position
	body.rotation_degrees.y = yaw_degrees
	body.collision_layer = 1
	body.collision_mask = 2 | 4
	var shape := CollisionShape3D.new()
	var box := BoxShape3D.new()
	box.size = size
	shape.shape = box
	body.add_child(shape)
	add_child(body)


func _create_cover_visual(node_name: String, position: Vector3, size: Vector3, color: Color, yaw_degrees: float) -> void:
	var root := Node3D.new()
	root.name = node_name + "Visual"
	root.position = Vector3(position.x, 0.0, position.z)
	root.rotation_degrees.y = yaw_degrees
	add_child(root)
	match node_name:
		"FieldStation":
			_add_station(root, color)
		"NorthRidge", "SouthRidge":
			for offset: float in [-9.0, -4.5, 0.0, 4.5, 9.0]:
				_add_boulder(root, Vector3(offset, 0.9, 0.0), Vector3(3.2, 1.85, 2.3), color.lightened(0.05))
				_add_shrub(root, Vector3(offset + 1.2, 0.0, 1.25), 0.85)
		"WestGrove", "EastGrove":
			for offset: float in [-7.5, -2.5, 2.5, 7.5]:
				_add_tree_to(root, Vector3(0.0, 0.0, offset), 0.95)
				_add_boulder(root, Vector3(0.0, 0.7, offset + 1.0), Vector3(1.5, 1.4, 2.1), color.darkened(0.12))
		"RockCluster":
			_add_boulder(root, Vector3.ZERO, Vector3(3.8, 2.0, 3.6), color)
			_add_boulder(root, Vector3(1.1, 0.45, 0.6), Vector3(1.9, 1.2, 1.8), color.lightened(0.10))
			_add_shrub(root, Vector3(-1.3, 0.0, 1.1), 0.8)
		"NorthGateLeft", "NorthGateRight":
			_add_gate_post(root, color)


func _add_station(root: Node3D, color: Color) -> void:
	_add_cylinder(root, "StationCore", Vector3(0, 1.6, 0), 2.5, 3.2, color, 16)
	_add_cylinder(root, "StationRoof", Vector3(0, 3.3, 0), 3.4, 0.22, Color("#d2a45b"), 20)
	for offset: Vector3 in [Vector3(-3.4, 0.9, -2.5), Vector3(3.4, 0.9, -2.5), Vector3(-3.4, 0.9, 2.5), Vector3(3.4, 0.9, 2.5)]:
		_add_boulder(root, offset, Vector3(2.0, 1.7, 1.8), Color("#6f6759"))
	_add_light_post(root, Vector3(-3.6, 0.0, 0.0))
	_add_light_post(root, Vector3(3.6, 0.0, 0.0))


func _create_gate_lintel() -> void:
	var root := Node3D.new()
	root.name = "NorthGate"
	root.position = Vector3(0, 0, -32)
	add_child(root)
	_add_cylinder(root, "GateLintel", Vector3(0, 5.8, 0), 0.44, 15.2, Color("#5b6361"), 10, Vector3(0, 0, 90))


func _add_gate_post(root: Node3D, color: Color) -> void:
	_add_cylinder(root, "GatePost", Vector3(0, 3.0, 0), 0.38, 6.0, color, 10)
	_add_light_post(root, Vector3(0.45, 0.0, 0.0))


func _add_tree(position: Vector3, scale_value: float) -> void:
	var root := Node3D.new()
	root.name = "Tree"
	root.position = position
	add_child(root)
	_add_tree_to(root, Vector3.ZERO, scale_value)


func _add_tree_to(root: Node3D, position: Vector3, scale_value: float) -> void:
	_add_cylinder(root, "Trunk", position + Vector3(0, 1.7 * scale_value, 0), 0.16 * scale_value, 3.4 * scale_value, Color("#584537"), 8)
	for crown: Vector3 in [Vector3(0, 3.8, 0), Vector3(0.65, 3.25, 0.25), Vector3(-0.6, 3.1, -0.2)]:
		_add_sphere(root, "Foliage", position + crown * scale_value, Vector3.ONE * 1.7 * scale_value, Color("#4e7e46"))


func _add_shrub(root: Node3D, position: Vector3, scale_value: float) -> void:
	_add_sphere(root, "Shrub", position + Vector3(0, 0.5 * scale_value, 0), Vector3(1.25, 1.0, 1.15) * scale_value, Color("#517a42"))


func _add_boulder(root: Node3D, position: Vector3, dimensions: Vector3, color: Color) -> void:
	_add_sphere(root, "Boulder", position, dimensions, color)


func _add_light_post(root: Node3D, position: Vector3) -> void:
	_add_cylinder(root, "LightPost", position + Vector3(0, 1.4, 0), 0.07, 2.8, Color("#30414a"), 8)
	_add_sphere(root, "Lamp", position + Vector3(0, 2.85, 0), Vector3.ONE * 0.22, Color("#ffe6a1"), 0.75)


func _create_landmarks() -> void:
	_add_shrub(self, Vector3(-14, 0, -14), 1.0)
	_add_shrub(self, Vector3(14, 0, 14), 1.0)
	for position: Vector3 in [Vector3(-37, 0, -14), Vector3(37, 0, 14)]:
		_add_tree(position, 0.9)


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
	var source := NavigationMeshSourceGeometryData3D.new()
	NavigationServer3D.parse_source_geometry_data(mesh, source, self)
	for obstruction: PackedVector3Array in _navigation_obstructions():
		source.add_projected_obstruction(obstruction, 0.0, 8.0, true)
	NavigationServer3D.bake_from_source_geometry_data(mesh, source)


func _navigation_obstructions() -> Array[PackedVector3Array]:
	var result: Array[PackedVector3Array] = []
	var margin := NAVIGATION_AGENT_RADIUS + 0.12
	var blockers: Array[Dictionary] = gameplay_obstacles.duplicate(true)
	blockers.append_array([
		{"center": Vector3(0, 0, -58), "size": Vector3(116, 0, 1)},
		{"center": Vector3(0, 0, 58), "size": Vector3(116, 0, 1)},
		{"center": Vector3(-58, 0, 0), "size": Vector3(1, 0, 116)},
		{"center": Vector3(58, 0, 0), "size": Vector3(1, 0, 116)}
	])
	for blocker: Dictionary in blockers:
		var center: Vector3 = blocker["center"]
		var size: Vector3 = blocker["size"]
		var half_x := size.x * 0.5 + margin
		var half_z := size.z * 0.5 + margin
		result.append(PackedVector3Array([
			Vector3(center.x - half_x, 0, center.z - half_z), Vector3(center.x + half_x, 0, center.z - half_z),
			Vector3(center.x + half_x, 0, center.z + half_z), Vector3(center.x - half_x, 0, center.z + half_z)
		]))
	return result


func _add_cylinder(root: Node3D, node_name: String, position: Vector3, radius: float, height: float, color: Color, segments: int, rotation_value: Vector3 = Vector3.ZERO) -> void:
	var mesh := CylinderMesh.new()
	mesh.top_radius = radius
	mesh.bottom_radius = radius * 1.06
	mesh.height = height
	mesh.radial_segments = segments
	var node := _mesh_node(node_name, mesh, position, _material(color))
	node.rotation_degrees = rotation_value
	root.add_child(node)


func _add_sphere(root: Node3D, node_name: String, position: Vector3, dimensions: Vector3, color: Color, emission: float = 0.0) -> void:
	var mesh := SphereMesh.new()
	mesh.radius = 0.5
	mesh.height = 1.0
	var node := _mesh_node(node_name, mesh, position, _material(color, emission))
	node.scale = dimensions
	root.add_child(node)


func _mesh_node(node_name: String, mesh: Mesh, position: Vector3, material: Material) -> MeshInstance3D:
	var node := MeshInstance3D.new()
	node.name = node_name
	node.mesh = mesh
	node.position = position
	node.material_override = material
	node.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON
	return node


func _ground_material() -> StandardMaterial3D:
	var material := _material(Color("#506b43"))
	var noise := FastNoiseLite.new()
	noise.noise_type = FastNoiseLite.TYPE_SIMPLEX_SMOOTH
	noise.frequency = 0.045
	noise.fractal_octaves = 4
	var noise_texture := NoiseTexture2D.new()
	noise_texture.noise = noise
	noise_texture.width = 256
	noise_texture.height = 256
	noise_texture.seamless = true
	material.albedo_texture = noise_texture
	material.uv1_scale = Vector3(1.0, 1.0, 1.0)
	material.texture_filter = BaseMaterial3D.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS_ANISOTROPIC
	return material


func _material(color: Color, emission: float = 0.0) -> StandardMaterial3D:
	var material := StandardMaterial3D.new()
	material.albedo_color = color
	material.roughness = 0.84
	if emission > 0.0:
		material.emission_enabled = true
		material.emission = color
		material.emission_energy_multiplier = emission
	return material
