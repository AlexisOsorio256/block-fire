class_name BlockfireArena
extends Node3D

## Campo exterior original: terreno, piedra, vegetación y refugios. La
## colisión conserva huellas predecibles para navegación, pero el runtime no
## carga props Toon ni representa las coberturas como una arena de cajas.
const NAVIGATION_SOURCE_GROUP: StringName = &"blockfire_navigation_floor"
const NAVIGATION_AGENT_RADIUS := 0.5

var navigation_region: NavigationRegion3D
var gameplay_obstacles: Array[Dictionary] = []
var _tree_placements: Array = []

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
	environment.tonemap_exposure = 1.0
	# Post-proceso barato para móvil: brillo suave en luces y una gradación
	# ligera. Sin esto la imagen sale lavada y "de motor genérico".
	environment.glow_enabled = true
	environment.glow_intensity = 0.30
	environment.glow_bloom = 0.06
	environment.glow_hdr_threshold = 1.08
	environment.glow_blend_mode = Environment.GLOW_BLEND_MODE_ADDITIVE
	environment.adjustment_enabled = true
	environment.adjustment_saturation = 1.08
	environment.adjustment_contrast = 1.05
	environment.adjustment_brightness = 1.01
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
	_create_horizon_forest()


## Cinturón de árboles fuera de la zona jugable: cierra el horizonte y evita
## que el jugador vea el vacío más allá del borde del mapa.
func _create_horizon_forest() -> void:
	var rng := RandomNumberGenerator.new()
	rng.seed = 77123
	for i: int in range(84):
		var angle := TAU * float(i) / 84.0 + rng.randf_range(-0.03, 0.03)
		var radius := rng.randf_range(64.0, 88.0)
		var position := Vector3(cos(angle) * radius, 0.0, sin(angle) * radius)
		_add_tree(position, rng.randf_range(0.85, 1.45))


## Caminos de tierra: cintas de anchura fija pegadas al terreno. Solo visual
## (sin collider, no entran en la malla de navegación) y sin tocar lanes ni
## spawns; hacen que el mapa se lea diseñado en vez de campo abierto.
##
## La cinta lleva borde fundido (alfa por vértice) y grano de tierra tileado.
## Sin ellos era un polígono marrón plano con corte a cuchillo: en el suelo
## cercano se leía como una textura que no cargó, no como tierra pisada.
## Las caras miran hacia arriba con CULL_BACK; antes el winding estaba
## invertido y solo se veían gracias a CULL_DISABLED, que además pagaba el
## doble de relleno y arruinaba el fundido al mezclar las dos caras.
func _create_paths() -> void:
	# Rutas que bordean la estación en vez de atravesarla (radio del edificio
	# ~3,4 m): dos diagonales hacia los flancos y dos accesos laterales.
	var routes: Array = [
		[Vector3(0, 0, 8), Vector3(6, 0, 4), Vector3(16, 0, -4), Vector3(26, 0, -12)],
		[Vector3(0, 0, 8), Vector3(-6, 0, 4), Vector3(-16, 0, -4), Vector3(-26, 0, -12)],
		[Vector3(-26, 0, 0), Vector3(-12, 0, 0), Vector3(-4.6, 0, 0)],
		[Vector3(26, 0, 0), Vector3(12, 0, 0), Vector3(4.6, 0, 0)],
	]
	var surface := SurfaceTool.new()
	surface.begin(Mesh.PRIMITIVE_TRIANGLES)
	# Corte transversal: núcleo sólido de 2,3 m y 0,55 m de fundido por lado,
	# con un carril intermedio en cada borde para que el fundido pueda variar.
	var half_width := 1.15
	var fade := 0.55
	var lanes: Array[float] = [
		-half_width - fade, -half_width - fade * 0.5, -half_width,
		half_width, half_width + fade * 0.5, half_width + fade
	]
	var lane_alpha: Array[float] = [0.0, 0.5, 1.0, 1.0, 0.5, 0.0]
	var steps := 12
	for route: Array in routes:
		var total := 0.0
		for index in range(route.size() - 1):
			total += (route[index + 1] as Vector3).distance_to(route[index] as Vector3)
		# El extremo lejano del camino se apaga en la hierba; el cercano a la
		# estación se queda sólido para que la ruta siga "llevando" a algo. Una
		# cinta de tierra cortada a cuchillo en medio del prado se lee como
		# geometría sin terminar.
		var frayed_end := (route[route.size() - 1] as Vector3).length() > (route[0] as Vector3).length()
		var travelled := 0.0
		for segment in range(route.size() - 1):
			var from: Vector3 = route[segment]
			var to: Vector3 = route[segment + 1]
			var segment_length := from.distance_to(to)
			var direction := (to - from).normalized()
			var side := Vector3(-direction.z, 0.0, direction.x)
			for step in range(steps):
				var t0 := float(step) / float(steps)
				var t1 := float(step + 1) / float(steps)
				var a := from.lerp(to, t0)
				var b := from.lerp(to, t1)
				var fade_a := _path_end_fade(travelled + segment_length * t0, total, frayed_end)
				var fade_b := _path_end_fade(travelled + segment_length * t1, total, frayed_end)
				for lane in range(lanes.size() - 1):
					var p0: Vector3 = a + side * lanes[lane]
					var p1: Vector3 = a + side * lanes[lane + 1]
					var q0: Vector3 = b + side * lanes[lane]
					var q1: Vector3 = b + side * lanes[lane + 1]
					_path_quad(surface, p0, p1, q0, q1,
						_path_fade_alpha(lane_alpha[lane], p0) * fade_a,
						_path_fade_alpha(lane_alpha[lane + 1], p1) * fade_a,
						_path_fade_alpha(lane_alpha[lane], q0) * fade_b,
						_path_fade_alpha(lane_alpha[lane + 1], q1) * fade_b)
			travelled += segment_length
	surface.generate_normals()
	var mesh := surface.commit()
	if mesh == null:
		return
	var path := MeshInstance3D.new()
	path.name = "DirtPaths"
	path.mesh = mesh
	# Cinta de una sola cara pegada al suelo: no proyecta sombra ni la recibe
	# como un muro, y sin cast_shadow el fundido del borde no ensucia el mapa
	# de sombras con la silueta del quad.
	path.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF

	var material := _material(Color.WHITE)
	material.albedo_texture = _dirt_texture()
	material.detail_enabled = false
	# UV de la cinta = 0,05/m; con escala 8 el grano de tierra repite cada 2,5 m
	# (manchas de ~0,4 m), del mismo orden que el césped del terreno.
	material.uv1_scale = Vector3(8.0, 8.0, 1.0)
	material.vertex_color_use_as_albedo = true
	material.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	material.cull_mode = BaseMaterial3D.CULL_BACK
	material.roughness = 0.98
	path.material_override = material
	add_child(path)


## Quad de camino con la cara hacia arriba. Los cuatro alfas son los de sus
## cuatro esquinas (carriles `p0`/`p1` en los extremos `a` y `b`).
func _path_quad(surface: SurfaceTool, p0: Vector3, p1: Vector3, q0: Vector3, q1: Vector3, alpha_p0: float, alpha_p1: float, alpha_q0: float, alpha_q1: float) -> void:
	_path_vertex(surface, p0, alpha_p0)
	_path_vertex(surface, q0, alpha_q0)
	_path_vertex(surface, p1, alpha_p1)
	_path_vertex(surface, q0, alpha_q0)
	_path_vertex(surface, q1, alpha_q1)
	_path_vertex(surface, p1, alpha_p1)


## Fundido del extremo lejano: el camino se desvanece en los últimos 2,5 m en
## vez de terminar en un corte recto sobre el prado.
func _path_end_fade(distance_along: float, total: float, frayed_end: bool) -> float:
	var fade := 2.5
	if frayed_end:
		return clampf((total - distance_along) / fade, 0.0, 1.0)
	return clampf(distance_along / fade, 0.0, 1.0)


## Alfa de un carril: el borde exterior respira con una onda continua en el
## espacio. Nada de ruido por tramo, que marcaba escalones cada 0,85 m; el
## núcleo (alfa 1) no se toca, así que el camino no se agujerea.
func _path_fade_alpha(base_alpha: float, point: Vector3) -> float:
	if base_alpha <= 0.0 or base_alpha >= 1.0:
		return base_alpha
	return base_alpha * (0.72 + 0.28 * sin(point.x * 0.9 + point.z * 1.3))


func _path_vertex(surface: SurfaceTool, point: Vector3, alpha: float) -> void:
	surface.set_uv(Vector2(point.x * 0.05, point.z * 0.05))
	surface.set_color(Color(1.0, 1.0, 1.0, clampf(alpha, 0.0, 1.0)))
	# +0,07: el terreno es una malla lineal cada 3,1 m y la función de altura es
	# curva, así que con menos margen la cinta se hundía entre vértices y no se
	# veía.
	surface.add_vertex(Vector3(point.x, _terrain_height(point.x, point.z) + 0.07, point.z))


## Grano de tierra de los caminos. Mismo recurso que el césped (ruido fractal
## + rampa) para que camino y terreno compartan lenguaje visual; el color
## plano anterior se leía como textura ausente.
func _dirt_texture() -> NoiseTexture2D:
	var noise := FastNoiseLite.new()
	noise.noise_type = FastNoiseLite.TYPE_SIMPLEX_SMOOTH
	noise.frequency = 0.05
	noise.fractal_octaves = 3
	noise.fractal_gain = 0.55
	var texture := NoiseTexture2D.new()
	texture.noise = noise
	texture.width = 128
	texture.height = 128
	texture.seamless = true
	texture.in_3d_space = false
	var ramp := Gradient.new()
	ramp.set_color(0, Color("#4a3a26"))
	ramp.set_color(1, Color("#8b7350"))
	ramp.add_point(0.5, Color("#6a5539"))
	texture.color_ramp = ramp
	return texture


## Construye el bosque completo con un solo MultiMesh de malla fusionada
## (tronco + ramas + copa en una superficie con color de vértice).
func _build_tree_multimesh() -> void:
	if _tree_placements.is_empty():
		return
	var surface := SurfaceTool.new()
	surface.begin(Mesh.PRIMITIVE_TRIANGLES)
	_append_cylinder(surface, Vector3(0, 1.55, 0), 0.15, 3.1, Color("#5b4634"), 8)
	_append_cylinder(surface, Vector3(0.42, 2.85, 0.16), 0.07, 1.15, Color("#54402f"), 6)
	_append_cylinder(surface, Vector3(-0.36, 3.05, -0.12), 0.06, 1.05, Color("#54402f"), 6)
	var canopy: Array = [
		[Vector3(0.0, 4.35, 0.0), 1.45, Color("#5c8b4c")],
		[Vector3(0.95, 3.95, 0.30), 1.10, Color("#4f7c41")],
		[Vector3(-0.90, 4.05, -0.25), 1.05, Color("#48743c")],
		[Vector3(0.35, 3.65, 0.85), 0.95, Color("#456f39")],
		[Vector3(-0.40, 3.70, -0.90), 0.90, Color("#426a36")],
		[Vector3(0.10, 5.15, -0.10), 0.95, Color("#639253")],
		[Vector3(-0.15, 3.25, 0.35), 0.80, Color("#3d6233")],
	]
	for blob: Array in canopy:
		_append_sphere(surface, blob[0] as Vector3, float(blob[1]), blob[2] as Color, 8, 5)
	surface.generate_normals()
	var tree_mesh := surface.commit()
	if tree_mesh == null:
		return
	var material := StandardMaterial3D.new()
	material.vertex_color_use_as_albedo = true
	material.roughness = 0.92
	material.detail_enabled = true
	material.detail_albedo = _world_grain()
	material.detail_blend_mode = BaseMaterial3D.BLEND_MODE_MUL
	material.uv1_scale = Vector3(2.0, 2.0, 1.0)
	tree_mesh.surface_set_material(0, material)
	var multimesh := MultiMesh.new()
	multimesh.mesh = tree_mesh
	multimesh.transform_format = MultiMesh.TRANSFORM_3D
	multimesh.instance_count = _tree_placements.size()
	for index in range(_tree_placements.size()):
		var placement: Dictionary = _tree_placements[index]
		var scale_value := float(placement["scale"])
		var basis := Basis(Vector3.UP, float((index * 2654435761) % 360) * PI / 180.0)
		basis = basis.scaled(Vector3.ONE * scale_value)
		multimesh.set_instance_transform(index, Transform3D(basis, placement["position"] as Vector3))
	var node := MultiMeshInstance3D.new()
	node.name = "Forest"
	node.multimesh = multimesh
	add_child(node)


## Primitivas con color de vértice para poder fusionar todo el bosque en una
## sola superficie (el MultiMesh no admite materiales distintos por instancia).
func _append_cylinder(surface: SurfaceTool, centre: Vector3, radius: float, height: float, color: Color, segments: int) -> void:
	surface.set_color(color)
	var half := height * 0.5
	for segment in range(segments):
		var a0 := TAU * float(segment) / float(segments)
		var a1 := TAU * float(segment + 1) / float(segments)
		var p0 := centre + Vector3(cos(a0) * radius, -half, sin(a0) * radius)
		var p1 := centre + Vector3(cos(a1) * radius, -half, sin(a1) * radius)
		var p2 := centre + Vector3(cos(a1) * radius, half, sin(a1) * radius)
		var p3 := centre + Vector3(cos(a0) * radius, half, sin(a0) * radius)
		for point: Vector3 in [p0, p1, p2, p2, p3, p0]:
			surface.set_uv(Vector2(point.x, point.z))
			surface.add_vertex(point)


func _append_sphere(surface: SurfaceTool, centre: Vector3, radius: float, color: Color, segments: int, rings: int) -> void:
	surface.set_color(color)
	for ring in range(rings):
		var phi0 := PI * float(ring) / float(rings)
		var phi1 := PI * float(ring + 1) / float(rings)
		for segment in range(segments):
			var th0 := TAU * float(segment) / float(segments)
			var th1 := TAU * float(segment + 1) / float(segments)
			var p0 := centre + Vector3(sin(phi0) * cos(th0), cos(phi0), sin(phi0) * sin(th0)) * radius
			var p1 := centre + Vector3(sin(phi0) * cos(th1), cos(phi0), sin(phi0) * sin(th1)) * radius
			var p2 := centre + Vector3(sin(phi1) * cos(th1), cos(phi1), sin(phi1) * sin(th1)) * radius
			var p3 := centre + Vector3(sin(phi1) * cos(th0), cos(phi1), sin(phi1) * sin(th0)) * radius
			for point: Vector3 in [p0, p1, p2, p2, p3, p0]:
				surface.set_uv(Vector2(point.x, point.z))
				surface.add_vertex(point)


## Matas de hierba con MultiMesh: cientos de instancias en una sola llamada de
## dibujo, sin collider. Da textura de suelo sin tocar navegación ni huellas.
func _create_grass_tufts() -> void:
	var blade := CylinderMesh.new()
	blade.top_radius = 0.0
	blade.bottom_radius = 0.10
	blade.height = 0.38
	blade.radial_segments = 3
	blade.rings = 1
	var material := StandardMaterial3D.new()
	material.albedo_color = Color("#5f8440")
	material.roughness = 0.95
	material.cull_mode = BaseMaterial3D.CULL_DISABLED
	blade.material = material
	var multimesh := MultiMesh.new()
	multimesh.mesh = blade
	multimesh.transform_format = MultiMesh.TRANSFORM_3D
	var rng := RandomNumberGenerator.new()
	rng.seed = 424242
	var count := 3600
	multimesh.instance_count = count
	var placed := 0
	var attempts := 0
	# En manchas de 3-6 matas: dispersas una a una se leían como pinchos
	# uniformes en lugar de vegetación.
	while placed < count and attempts < count * 6:
		attempts += 1
		var centre := Vector3(rng.randf_range(-54.0, 54.0), 0.0, rng.randf_range(-54.0, 54.0))
		if centre.length() < 7.5:
			continue
		var clump := rng.randi_range(3, 6)
		var clump_scale := rng.randf_range(0.75, 1.35)
		for _blade in range(clump):
			if placed >= count:
				break
			var offset := Vector3(rng.randf_range(-0.75, 0.75), 0.0, rng.randf_range(-0.75, 0.75))
			var scale_value := clump_scale * rng.randf_range(0.75, 1.25)
			var basis := Basis(Vector3.UP, rng.randf_range(0.0, TAU)).scaled(Vector3(scale_value, scale_value * rng.randf_range(0.75, 1.6), scale_value))
			multimesh.set_instance_transform(placed, Transform3D(basis, centre + offset))
			placed += 1
	multimesh.visible_instance_count = placed
	var node := MultiMeshInstance3D.new()
	node.name = "GrassTufts"
	node.multimesh = multimesh
	add_child(node)


## Detalle visual puramente decorativo: arbustos y piedras pequeñas SIN
## collider. No altera spawns, lanes, navegación ni huellas de colisión; solo
## llena el vacío entre los hitos para que el mapa no se lea como una llanura.
func _scatter_detail() -> void:
	var rng := RandomNumberGenerator.new()
	rng.seed = 20260908
	var placed: Array[Vector3] = []
	var attempts := 0
	while placed.size() < 54 and attempts < 600:
		attempts += 1
		var candidate := Vector3(rng.randf_range(-52.0, 52.0), 0.0, rng.randf_range(-52.0, 52.0))
		# Fuera del edificio central y de los pasillos de spawn.
		if candidate.length() < 13.0:
			continue
		if absf(candidate.x) < 4.0 and absf(candidate.z) < 34.0:
			continue
		var too_close := false
		for other: Vector3 in placed:
			if other.distance_to(candidate) < 5.0:
				too_close = true
				break
		if too_close:
			continue
		placed.append(candidate)
		if rng.randf() < 0.62:
			_add_shrub(self, candidate, rng.randf_range(0.55, 1.15))
		else:
			_add_boulder(self, candidate + Vector3(0, 0.18, 0),
				Vector3(rng.randf_range(0.5, 1.1), rng.randf_range(0.35, 0.7), rng.randf_range(0.5, 1.1)),
				Color("#7a7263"))


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
	_create_paths()
	_scatter_detail()
	_create_grass_tufts()
	_build_tree_multimesh()


func _add_obstacle(node_name: String, position: Vector3, size: Vector3, color: Color, yaw_degrees: float) -> void:
	gameplay_obstacles.append({"center": position, "size": size})
	_create_cover_visual(node_name, position, size, color, yaw_degrees)
	_add_box_collider(node_name, position, size, yaw_degrees)


func _create_floor() -> void:
	var floor := MeshInstance3D.new()
	floor.name = "GroundVisual"
	# El terreno visual es mayor que la zona jugable (120 m) para que el borde
	# del mapa no se vea como una banda oscura en el horizonte.
	floor.mesh = _terrain_mesh(200.0, 64)
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
			# Winding en sentido que Godot considera frontal visto desde
			# arriba: con el orden anterior el terreno quedaba culled y solo se
			# veía el color de suelo del cielo.
			_surface_vertex(surface, p00, Vector2(uv0.x, uv0.y))
			_surface_vertex(surface, p10, Vector2(uv1.x, uv0.y))
			_surface_vertex(surface, p01, Vector2(uv0.x, uv1.y))
			_surface_vertex(surface, p10, Vector2(uv1.x, uv0.y))
			_surface_vertex(surface, p11, uv1)
			_surface_vertex(surface, p01, Vector2(uv0.x, uv1.y))
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
	# Estación con lectura de edificio: zócalo, cuerpo, banda de ventanas,
	# alero y puerta. Un cilindro liso se leía como una torre genérica.
	_add_cylinder(root, "StationBase", Vector3(0, 0.18, 0), 2.72, 0.36, color.darkened(0.28), 16)
	_add_cylinder(root, "StationCore", Vector3(0, 1.6, 0), 2.5, 3.2, color, 16)
	_add_cylinder(root, "StationWindows", Vector3(0, 2.25, 0), 2.53, 0.62, Color("#1d2b33"), 16)
	_add_cylinder(root, "StationTrim", Vector3(0, 2.62, 0), 2.58, 0.12, Color("#8a9490"), 16)
	_add_cylinder(root, "StationRoof", Vector3(0, 3.34, 0), 3.35, 0.24, Color("#d2a45b"), 20)
	_add_cylinder(root, "StationRoofLip", Vector3(0, 3.5, 0), 2.55, 0.18, Color("#b98d46"), 16)
	var door := MeshInstance3D.new()
	door.name = "StationDoor"
	var door_mesh := BoxMesh.new()
	door_mesh.size = Vector3(1.35, 2.05, 0.22)
	door.mesh = door_mesh
	door.material_override = _material(Color("#2a3439"))
	door.position = Vector3(0.0, 1.02, 2.48)
	root.add_child(door)
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
	# Los árboles se acumulan y se dibujan con un único MultiMesh: antes cada
	# árbol eran ~10 MeshInstance3D y el horizonte solo costaba ~840 draw calls.
	_tree_placements.append({"position": position, "scale": scale_value})


func _add_tree_to(root: Node3D, position: Vector3, scale_value: float) -> void:
	_tree_placements.append({"position": root.position + position, "scale": scale_value})


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


var _grain_texture: Texture2D


func _world_grain() -> Texture2D:
	if _grain_texture != null:
		return _grain_texture
	var size := 64
	var image := Image.create(size, size, false, Image.FORMAT_RGB8)
	var rng := RandomNumberGenerator.new()
	rng.seed = 9911
	for y in range(size):
		for x in range(size):
			var value := 0.82 + rng.randf_range(-0.10, 0.14)
			image.set_pixel(x, y, Color(value, value, value))
	_grain_texture = ImageTexture.create_from_image(image)
	return _grain_texture


func _ground_material() -> StandardMaterial3D:
	# Césped con textura REAL tileada (Kenney CC0) más un ruido suave encima.
	# Antes el ruido se estiraba sobre los 120 m del mapa y el suelo se leía
	# como una llanura plana de color uniforme.
	# `assets/textures/ground.png` es una placa metálica de Kenney: teñida de
	# verde no daba césped, solo una llanura gris-verde. La variación de hierba
	# se genera con ruido fractal y se tilea sobre el terreno.
	var material := _material(Color.WHITE)
	var noise := FastNoiseLite.new()
	noise.noise_type = FastNoiseLite.TYPE_SIMPLEX_SMOOTH
	# NoiseTexture2D muestrea el ruido en coordenadas de PÍXEL: con frecuencia
	# alta caben decenas de oscilaciones en 256 px y el mipmap lo aplana a un
	# color uniforme. Frecuencia baja = manchas de hierba de ~1 m visibles.
	noise.frequency = 0.014
	noise.fractal_octaves = 3
	noise.fractal_gain = 0.5
	var noise_texture := NoiseTexture2D.new()
	noise_texture.noise = noise
	noise_texture.width = 256
	noise_texture.height = 256
	noise_texture.seamless = true
	noise_texture.in_3d_space = false
	# Rampa de dos verdes: el ruido crudo es gris de bajo contraste y teñido
	# se leía como color plano. Con rampa la variación es visible.
	var ramp := Gradient.new()
	ramp.set_color(0, Color("#3c5729"))
	ramp.set_color(1, Color("#8fa96b"))
	ramp.add_point(0.5, Color("#5f7c42"))
	noise_texture.color_ramp = ramp
	material.albedo_texture = noise_texture
	# UV del terreno 0..4 sobre 120 m: con escala 9 cada mancha mide ~3,3 m.
	material.uv1_scale = Vector3(9.0, 9.0, 1.0)
	material.texture_filter = BaseMaterial3D.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS_ANISOTROPIC
	material.roughness = 0.96
	material.cull_mode = BaseMaterial3D.CULL_BACK
	return material


## Material de mundo con grano procedural: los colores planos hacían que
## rocas, muros y estructuras se leyeran como bloques de plástico.
func _material(color: Color, emission: float = 0.0) -> StandardMaterial3D:
	var material := StandardMaterial3D.new()
	material.albedo_color = color
	material.roughness = 0.84
	material.detail_enabled = true
	material.detail_albedo = _world_grain()
	material.detail_blend_mode = BaseMaterial3D.BLEND_MODE_MUL
	material.uv1_scale = Vector3(3.0, 3.0, 1.0)
	if emission > 0.0:
		material.emission_enabled = true
		material.emission = color
		material.emission_energy_multiplier = emission
	return material
