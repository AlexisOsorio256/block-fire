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
	environment.background_mode = Environment.BG_SKY
	var sky := Sky.new()
	var sky_material := ProceduralSkyMaterial.new()
	sky_material.sky_top_color = Color("#2f6fc4")
	sky_material.sky_horizon_color = Color("#a8d4f2")
	sky_material.ground_bottom_color = Color("#5d6b7d")
	sky_material.ground_horizon_color = Color("#93a7ba")
	sky_material.sun_angle_max = 22.0
	sky.sky_material = sky_material
	environment.sky = sky
	environment.ambient_light_source = Environment.AMBIENT_SOURCE_SKY
	environment.ambient_light_sky_contribution = 1.0
	environment.ambient_light_energy = 1.0
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
	_create_box("Ground", Vector3(0, -0.22, 0), Vector3(120, 0.4, 120), Color("#aebccd"), true)
	_create_box("NorthWall", Vector3(0, 2.4, -58), Vector3(116, 5.0, 1.0), Color("#3d5a7a"), true)
	_create_box("SouthWall", Vector3(0, 2.4, 58), Vector3(116, 5.0, 1.0), Color("#3d5a7a"), true)
	_create_box("WestWall", Vector3(-58, 2.4, 0), Vector3(1.0, 5.0, 116), Color("#3d5a7a"), true)
	_create_box("EastWall", Vector3(58, 2.4, 0), Vector3(1.0, 5.0, 116), Color("#3d5a7a"), true)

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
	var crate_specs := [
		{"pos": Vector3(-38, 0.9, -19), "yaw": 6.0, "tint": Color("#bd8859")},
		{"pos": Vector3(-38, 0.9, 19), "yaw": -9.0, "tint": Color("#a97749")},
		{"pos": Vector3(38, 0.9, -19), "yaw": 11.0, "tint": Color("#c69465")},
		{"pos": Vector3(38, 0.9, 19), "yaw": -5.0, "tint": Color("#b07f50")},
		{"pos": Vector3(-10, 0.65, -37), "yaw": 12.0, "tint": Color("#ad854f")},
		{"pos": Vector3(10, 0.65, 37), "yaw": -10.0, "tint": Color("#c08c56")},
	]
	var crate_index := 0
	for spec: Dictionary in crate_specs:
		_add_obstacle("Crate", spec["pos"], Vector3(4.0, 1.8, 4.0), spec["tint"], spec["yaw"])
		crate_index += 1
	var arch_color := Color("#a84d43")
	_add_obstacle("ArchLeft", Vector3(-7, 3.0, -32), Vector3(1.2, 6.0, 1.2), arch_color)
	_add_obstacle("ArchRight", Vector3(7, 3.0, -32), Vector3(1.2, 6.0, 1.2), arch_color)
	# ArchTop is above the agent height. It remains a visual lintel, not a
	# ground-projected navigation obstruction, so the gate stays traversable.
	_create_box("ArchTop", Vector3(0, 5.8, -32), Vector3(15.2, 1.0, 1.2), Color("#d28c45"), true)
	_create_landmarks()

func _add_obstacle(node_name: String, position: Vector3, size: Vector3, color: Color, yaw_degrees: float = 0.0) -> void:
	gameplay_obstacles.append({"center": position, "size": size})
	_create_box(node_name, position, size, color, true, yaw_degrees)

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

func _create_box(node_name: String, position: Vector3, size: Vector3, color: Color, collider: bool, yaw_degrees: float = 0.0) -> Node3D:
	var visual := _create_obstacle_visual(node_name, position, size, color)
	if visual == null:
		var box_visual := MeshInstance3D.new()
		box_visual.name = node_name + "Visual"
		var mesh := BoxMesh.new()
		mesh.size = size
		box_visual.mesh = mesh
		box_visual.position = position
		box_visual.rotation_degrees.y = yaw_degrees
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
	body.rotation_degrees.y = yaw_degrees
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
			# One accent system on all four faces: the same two-tone trim wraps
			# the block so no single side gets a lone glowing strip.
			var trim_cyan := Color("#42d6e9")
			var trim_amber := Color("#ffb73e")
			for offset_z: float in [-3.55, 3.55]:
				_add_accent_bar(center, Vector3(0, 1.85, offset_z), Vector3(8.0, 0.14, 0.18), trim_cyan if offset_z < 0.0 else trim_amber)
			for offset_x: float in [-4.6, 4.6]:
				_add_accent_bar(center, Vector3(offset_x, 1.85, 0), Vector3(0.18, 0.14, 6.4), trim_amber if offset_x < 0.0 else trim_cyan)
			_add_accent_bar(center, Vector3(0, 3.62, 0), Vector3(13.1, 0.12, 11.1), trim_cyan)
			_create_corner_light(center, Vector3(-6.2, 0.0, -4.6))
			_create_corner_light(center, Vector3(6.2, 0.0, 4.6))
			return center
		"NorthCover", "SouthCover":
			var lane_cover := Node3D.new()
			lane_cover.name = node_name + "Visual"
			lane_cover.position = Vector3(position.x, 0.0, position.z)
			# Containers of one family but not clones: per-slot hue, yaw jitter and
			# occasional flip break the parade alignment without moving footprints.
			var palette := _container_palette(node_name)
			var slot_index := 0
			for offset: float in [-9.0, -4.5, 0.0, 4.5, 9.0]:
				var container := _load_prop("Container_Long.gltf")
				if container == null:
					return null
				container.position.x = offset
				container.rotation_degrees.y = _slot_yaw(node_name, slot_index)
				container.scale = Vector3.ONE * 1.02
				_tint_prop(container, palette[slot_index % palette.size()], 0.55)
				lane_cover.add_child(container)
				slot_index += 1
			_create_corner_light(lane_cover, Vector3(-11.2, 0.0, 0.0))
			_create_corner_light(lane_cover, Vector3(11.2, 0.0, 0.0))
			return lane_cover
		"WestCover", "EastCover":
			var side_cover := Node3D.new()
			side_cover.name = node_name + "Visual"
			side_cover.position = Vector3(position.x, 0.0, position.z)
			var barrier_palette := [Color("#7f93a8"), Color("#8a7462"), Color("#6f8496"), Color("#93876f")]
			var barrier_index := 0
			for offset: float in [-7.5, -2.5, 2.5, 7.5]:
				var barrier := _load_prop("Barrier_Large.gltf")
				if barrier == null:
					return null
				barrier.position.z = offset
				barrier.rotation_degrees.y = 90.0 + _slot_yaw(node_name, barrier_index) * 0.6
				barrier.scale = Vector3.ONE * (0.92 if barrier_index % 2 == 0 else 0.86)
				_tint_prop(barrier, barrier_palette[barrier_index % barrier_palette.size()], 0.4)
				side_cover.add_child(barrier)
				barrier_index += 1
			_create_corner_light(side_cover, Vector3(0.0, 0.0, -9.5))
			_create_corner_light(side_cover, Vector3(0.0, 0.0, 9.5))
			return side_cover
	return null

## Deterministic per-slot yaw jitter so replays and captures stay stable.
func _slot_yaw(node_name: String, index: int) -> float:
	var seed_value: int = node_name.hash() + index * 37
	var phase: float = float(absi(seed_value) % 100) / 100.0
	return (phase - 0.5) * 7.0

func _container_palette(node_name: String) -> Array[Color]:
	if node_name == "NorthCover":
		return [Color("#c0574a"), Color("#b8724a"), Color("#a84d43"), Color("#c26e56"), Color("#b04f3f")]
	return [Color("#4a7fa0"), Color("#3f6e8e"), Color("#5686a4"), Color("#447490"), Color("#5e8ba8")]

## Multiply a prop's embedded material colors toward a target hue while keeping
## its shading detail, so variants stay physical instead of flat-recolored.
func _tint_prop(root: Node3D, color: Color, strength: float) -> void:
	var stack: Array[Node] = [root]
	while not stack.is_empty():
		var node: Node = stack.pop_back()
		for child: Node in node.get_children():
			stack.append(child)
		if node is not MeshInstance3D:
			continue
		var mesh_instance := node as MeshInstance3D
		if mesh_instance.mesh == null:
			continue
		for surface_index: int in range(mesh_instance.mesh.get_surface_count()):
			var source := mesh_instance.get_active_material(surface_index)
			if source is not StandardMaterial3D:
				continue
			var material := source.duplicate() as StandardMaterial3D
			var original := material.albedo_color
			if original.v >= 0.92 and original.s <= 0.12:
				# Near-white panels take the strongest tint (container body).
				material.albedo_color = material.albedo_color.lerp(color, strength)
			else:
				# Trim/dark parts only shift slightly so detail survives.
				material.albedo_color = material.albedo_color.lerp(color.darkened(0.25), strength * 0.3)
			mesh_instance.set_surface_override_material(surface_index, material)

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

func _create_corner_light(parent: Node3D, position: Vector3) -> void:
	var root := Node3D.new()
	root.name = "CornerLight"
	root.position = position
	parent.add_child(root)
	var post := MeshInstance3D.new()
	var post_mesh := CylinderMesh.new()
	post_mesh.top_radius = 0.06
	post_mesh.bottom_radius = 0.09
	post_mesh.height = 2.6
	post.mesh = post_mesh
	post.position = Vector3(0, 1.3, 0)
	post.material_override = _material(Color("#2c3f55"))
	root.add_child(post)
	var head := MeshInstance3D.new()
	var head_mesh := SphereMesh.new()
	head_mesh.height = 0.3
	head_mesh.radius = 0.15
	head.mesh = head_mesh
	head.position = Vector3(0, 2.75, 0)
	head.material_override = _emissive_material(Color("#ffe9b0"), 0.8)
	root.add_child(head)

func _create_landmarks() -> void:
	# Lane markings replaced by painted approach pads: pure albedo, no emissive.
	_create_lane_marker("CentralLane", Vector3(0, 0.012, 0), Vector3(12.0, 0.025, 0.18), Color("#37cfe0"))
	_create_lane_marker("NorthLane", Vector3(0, 0.012, -29.5), Vector3(12.0, 0.025, 0.18), Color("#ffb73e"))
	_create_lane_marker("SouthLane", Vector3(0, 0.012, 29.5), Vector3(12.0, 0.025, 0.18), Color("#f26e80"))
	# Punto central y esquinas: pintura de suelo para lectura de distancias
	# sin tocar colisiones, spawns ni navegación.
	_create_paint_disc("CenterPad", Vector3(0, 0.015, 0), 3.2, Color("#ffd471"))
	for corner: Vector2 in [Vector2(-38, -38), Vector2(38, -38), Vector2(-38, 38), Vector2(38, 38)]:
		_create_paint_disc("CornerPad", Vector3(corner.x, 0.015, corner.y), 1.6, Color("#8fa5b8"))
	# Physical signage: each landmark is a pole + banner mounted next to the
	# structure it names, so orientation reads from geometry instead of a
	# floating billboard label.
	_create_landmark_banner("CENTRAL", Vector3(6.6, 0.0, -4.4), Color("#63e9f5"))
	_create_landmark_banner("ORANGE GATE", Vector3(8.6, 0.0, -30.6), Color("#ffb73e"))
	_create_landmark_banner("CONTAINERS", Vector3(-35.4, 0.0, -14.6), Color("#63e9f5"))
	_create_landmark_banner("SOUTH YARD", Vector3(35.4, 0.0, 14.6), Color("#f7839a"))

func _create_paint_disc(node_name: String, position: Vector3, radius: float, color: Color) -> void:
	var disc := MeshInstance3D.new()
	disc.name = node_name
	var mesh := CylinderMesh.new()
	mesh.top_radius = radius
	mesh.bottom_radius = radius
	mesh.height = 0.02
	disc.mesh = mesh
	disc.position = position
	disc.material_override = _material(color.darkened(0.25))
	add_child(disc)

func _create_lane_marker(node_name: String, position: Vector3, size: Vector3, color: Color) -> void:
	# Painted approach pad: three dashes instead of one thin line so the lane
	# reads as floor paint from any angle, not as a laser strip.
	var paint := color.darkened(0.35)
	for index: int in range(3):
		var marker := MeshInstance3D.new()
		marker.name = "%sDash%d" % [node_name, index]
		var mesh := BoxMesh.new()
		mesh.size = Vector3(size.x * 0.26, size.y, size.z * 2.6)
		marker.mesh = mesh
		var slot := float(index) - 1.0
		marker.position = position + Vector3(slot * size.x * 0.37, 0.0, 0.0)
		marker.material_override = _material(paint)
		add_child(marker)

func _create_landmark_banner(text: String, base_position: Vector3, color: Color) -> void:
	var root := Node3D.new()
	root.name = text.replace(" ", "") + "Sign"
	root.position = base_position
	add_child(root)
	var pole_height := 4.2
	var pole := MeshInstance3D.new()
	var pole_mesh := CylinderMesh.new()
	pole_mesh.top_radius = 0.09
	pole_mesh.bottom_radius = 0.13
	pole_mesh.height = pole_height
	pole.mesh = pole_mesh
	pole.position = Vector3(0, pole_height * 0.5, 0)
	pole.material_override = _material(Color("#2c3f55"))
	root.add_child(pole)
	var plate := MeshInstance3D.new()
	var plate_mesh := BoxMesh.new()
	plate_mesh.size = Vector3(0.1, 1.15, 2.6)
	plate.mesh = plate_mesh
	plate.position = Vector3(0, pole_height - 0.75, 0)
	plate.material_override = _material(color.darkened(0.18))
	root.add_child(plate)
	for side: float in [-1.0, 1.0]:
		var label := Label3D.new()
		label.text = text
		label.position = Vector3(0.07 * side, pole_height - 0.75, 0)
		label.rotation_degrees.y = -90.0 * side
		label.font_size = 64
		label.pixel_size = 0.006
		# One-sided: without this the plate's far face shows the text mirrored.
		label.double_sided = false
		label.modulate = Color("#ffffff")
		label.outline_size = 10
		label.outline_modulate = Color("#12253bee")
		root.add_child(label)
	var cap := MeshInstance3D.new()
	var cap_mesh := BoxMesh.new()
	cap_mesh.size = Vector3(0.5, 0.5, 0.5)
	cap.mesh = cap_mesh
	cap.position = Vector3(0, pole_height + 0.1, 0)
	cap.rotation_degrees = Vector3(0.0, 45.0, 0.0)
	cap.material_override = _emissive_material(color, 0.3)
	root.add_child(cap)

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
		material.uv1_scale = Vector3(10.0, 10.0, 10.0)
	return material
