# BLOCKFIRE — Arena blocky (parity: Map.js) 48×48 con cobertura, plataformas y spawns validados.
# Una sola fuente de verdad espacial: capa "level" (1) para movimiento, balas y visión.
# NavigationRegion3D horneado en runtime para los bots (mejora vs steering web).
class_name Arena
extends Node3D

const HALF := 24.0
const SPAWNS: Array[Vector3] = [
	Vector3(0, 0.1, 20), Vector3(-18, 0.1, 14), Vector3(18, 0.1, 14),
	Vector3(-18, 0.1, -14), Vector3(18, 0.1, -14), Vector3(0, 0.1, -20),
	Vector3(-20, 0.1, 0), Vector3(20, 0.1, 0), Vector3(9, 0.1, 9),
]

var nav_region: NavigationRegion3D

func _ready() -> void:
	_build_static()
	_build_navmesh()

func _ground_mat(c: Color) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_color = c
	m.roughness = 0.9
	return m

func _block(pos: Vector3, size: Vector3, mat: StandardMaterial3D, name_hint: String) -> void:
	var body := StaticBody3D.new()
	body.name = name_hint
	body.collision_layer = 1
	body.collision_mask = 0
	body.position = pos
	var col := CollisionShape3D.new()
	var shape := BoxShape3D.new()
	shape.size = size
	col.shape = shape
	body.add_child(col)
	var mi := MeshInstance3D.new()
	var mesh := BoxMesh.new()
	mesh.size = size
	mi.mesh = mesh
	mi.material_override = mat
	body.add_child(mi)
	add_child(body)

func _build_static() -> void:
	var ground_m := _ground_mat(Color(0.42, 0.46, 0.38))
	var wall_m := _ground_mat(Color(0.55, 0.42, 0.30))
	var plat_m := _ground_mat(Color(0.35, 0.52, 0.60))

	# suelo
	_block(Vector3(0, -0.5, 0), Vector3(HALF * 2, 1, HALF * 2), ground_m, "Ground")
	# perímetro
	_block(Vector3(0, 2, -HALF), Vector3(HALF * 2, 4, 1), wall_m, "WallN")
	_block(Vector3(0, 2, HALF), Vector3(HALF * 2, 4, 1), wall_m, "WallS")
	_block(Vector3(-HALF, 2, 0), Vector3(1, 4, HALF * 2), wall_m, "WallW")
	_block(Vector3(HALF, 2, 0), Vector3(1, 4, HALF * 2), wall_m, "WallE")
	# cobertura determinista (misma semilla que el mapa web a escala)
	var rng := RandomNumberGenerator.new()
	rng.seed = 20260901
	for i in 34:
		var x := rng.randf_range(-(HALF - 3.0), HALF - 3.0)
		var z := rng.randf_range(-(HALF - 3.0), HALF - 3.0)
		var w := rng.randf_range(1.6, 4.2)
		var h := rng.randf_range(1.1, 3.0)
		if Vector2(x, z).distance_to(Vector2(0, 20)) < 5.0:
			continue
		if Vector2(x, z).distance_to(Vector2.ZERO) < 4.0:
			continue
		_block(Vector3(x, h * 0.5, z), Vector3(w, h, w * 0.85), wall_m, "Cover%d" % i)
	# plataformas + escalón
	_block(Vector3(-10, 2.25, 8), Vector3(8, 0.5, 6), plat_m, "PlatA")
	_block(Vector3(12, 3.25, -6), Vector3(7, 0.5, 5), plat_m, "PlatB")
	_block(Vector3(-10, 0.75, 4.4), Vector3(3, 1.5, 1), wall_m, "Step")

	# iluminación: sol cálido + ambiente fresco (identidad colorida, no gris militar)
	var sun := DirectionalLight3D.new()
	sun.rotation_degrees = Vector3(-52, -38, 0)
	sun.light_energy = 1.15
	sun.light_color = Color(1.0, 0.96, 0.9)
	sun.shadow_enabled = true
	sun.directional_shadow_max_distance = 40.0
	add_child(sun)
	var world_env := WorldEnvironment.new()
	var env := Environment.new()
	env.background_mode = Environment.BG_COLOR
	env.background_color = Color(0.52, 0.68, 0.78)
	env.ambient_light_source = Environment.AMBIENT_SOURCE_SKY
	env.ambient_light_sky_contribution = 1.0
	env.ambient_light_color = Color(0.62, 0.70, 0.78)
	env.ambient_light_energy = 0.8
	env.fog_enabled = true
	env.fog_light_color = Color(0.60, 0.72, 0.82)
	env.fog_density = 0.004
	world_env.environment = env
	add_child(world_env)

func _build_navmesh() -> void:
	nav_region = NavigationRegion3D.new()
	var nm := NavigationMesh.new()
	nm.geometry_parsed_geometry_type = NavigationMesh.PARSED_GEOMETRY_STATIC_COLLIDERS
	nm.agent_radius = 0.5
	nm.agent_height = 1.8
	nm.agent_max_climb = 0.6
	nm.cell_size = 0.25
	nm.cell_height = 0.25
	nav_region.navigation_mesh = nm
	add_child(nav_region)
	# horneo diferido en el hilo principal (los bots arrastran y esperan)
	nav_region.bake_navigation_mesh.call_deferred(false)
