class_name BlockfireWeaponVisual
extends Node3D

## Malla visual estilizada de las armas.
##
## El gameplay sigue siendo propiedad de WeaponController y las definiciones
## .tres. Este nodo solo dibuja el arma: cada silueta está compuesta por
## perfiles extruidos y tubos facetados propios, con receiver, culata, grip,
## cargador y cañón distinguibles. No depende de primitivas visibles del
## runtime ni de una transformación de objeto que oculte una silueta pobre.

var weapon_id: String = "rifle"
var _built: bool = false

const BODY_RIFLE := Color("#253545")
const METAL_RIFLE := Color("#718797")
const ACCENT_RIFLE := Color("#6bb6bd")
const GRIP_RIFLE := Color("#151f2c")

const BODY_PISTOL := Color("#2e3f50")
const METAL_PISTOL := Color("#9bafb9")
const ACCENT_PISTOL := Color("#c66b59")
const GRIP_PISTOL := Color("#171f29")

const BODY_SHOTGUN := Color("#4c3f35")
const METAL_SHOTGUN := Color("#8f9da1")
const ACCENT_SHOTGUN := Color("#cf934b")
const GRIP_SHOTGUN := Color("#20262d")

const BODY_SMG := Color("#304557")
const METAL_SMG := Color("#829aa7")
const ACCENT_SMG := Color("#c66f63")
const GRIP_SMG := Color("#171f2a")


func configure(id: String) -> void:
	weapon_id = id
	if is_inside_tree():
		_build()


func build(id: String = "") -> void:
	if not id.is_empty():
		weapon_id = id
	_build()


func _ready() -> void:
	_build()


func _build() -> void:
	if _built:
		return
	_built = true
	match weapon_id:
		"rifle":
			_build_rifle()
		"pistol":
			_build_pistol()
		"shotgun":
			_build_shotgun()
		"smg":
			_build_smg()
		_:
			_build_rifle()


func _build_rifle() -> void:
	_profile_part("Receiver", PackedVector2Array([
		Vector2(-0.28, -0.08), Vector2(-0.22, -0.15), Vector2(0.22, -0.15),
		Vector2(0.29, -0.06), Vector2(0.29, 0.10), Vector2(0.21, 0.16),
		Vector2(-0.22, 0.16), Vector2(-0.30, 0.08)
	]), 0.34, 0.0, BODY_RIFLE)
	_profile_part("UpperReceiver", PackedVector2Array([
		Vector2(-0.20, 0.12), Vector2(0.22, 0.12), Vector2(0.25, 0.19),
		Vector2(-0.17, 0.19)
	]), 0.20, 0.10, METAL_RIFLE)
	_cylinder_part("Barrel", 0.040, 0.58, 0.22, 0.09, METAL_RIFLE)
	_cylinder_part("MuzzleBrake", 0.068, 0.12, 0.79, 0.09, GRIP_RIFLE, 8)
	_profile_part("Stock", PackedVector2Array([
		Vector2(-0.23, -0.12), Vector2(-0.39, -0.10), Vector2(-0.49, -0.03),
		Vector2(-0.48, 0.08), Vector2(-0.30, 0.12), Vector2(-0.20, 0.08)
	]), 0.28, -0.30, GRIP_RIFLE)
	_box_part("CheekRest", Vector3(0.18, 0.055, 0.22), 0.018, Vector3(-0.31, 0.19, -0.25), METAL_RIFLE)
	_profile_part("Grip", PackedVector2Array([
		Vector2(-0.095, 0.10), Vector2(0.10, 0.10), Vector2(0.075, -0.18),
		Vector2(-0.065, -0.24), Vector2(-0.13, -0.12)
	]), 0.18, -0.02, GRIP_RIFLE, Vector3(0.0, -0.18, 0.0), Vector3(-9.0, 0.0, 0.0))
	_profile_part("Magazine", PackedVector2Array([
		Vector2(-0.10, 0.10), Vector2(0.10, 0.10), Vector2(0.08, -0.18),
		Vector2(-0.08, -0.23)
	]), 0.16, 0.04, GRIP_RIFLE, Vector3(0.0, -0.19, 0.03), Vector3(-10.0, 0.0, 0.0))
	_box_part("Foregrip", Vector3(0.12, 0.16, 0.20), 0.032, Vector3(0.0, -0.13, 0.41), GRIP_RIFLE, Vector3(-8.0, 0.0, 0.0))
	_box_part("TopRail", Vector3(0.12, 0.045, 0.43), 0.016, Vector3(0.0, 0.215, 0.25), GRIP_RIFLE)
	# Mira trasera en dos postes con calado central: en ADS se alinea el punto
	# delantero en el hueco, bajo el crosshair.
	_box_part("RearSightL", Vector3(0.032, 0.10, 0.07), 0.012, Vector3(-0.055, 0.28, -0.10), ACCENT_RIFLE)
	_box_part("RearSightR", Vector3(0.032, 0.10, 0.07), 0.012, Vector3(0.055, 0.28, -0.10), ACCENT_RIFLE)
	_box_part("FrontSight", Vector3(0.055, 0.10, 0.055), 0.014, Vector3(0.0, 0.18, 0.64), ACCENT_RIFLE)


func _build_pistol() -> void:
	_profile_part("Slide", PackedVector2Array([
		Vector2(-0.135, -0.035), Vector2(-0.135, 0.09), Vector2(-0.08, 0.14),
		Vector2(0.115, 0.14), Vector2(0.145, 0.07), Vector2(0.145, -0.035)
	]), 0.36, 0.12, METAL_PISTOL, Vector3(0.0, 0.11, 0.0))
	_profile_part("Frame", PackedVector2Array([
		Vector2(-0.15, -0.06), Vector2(-0.08, -0.12), Vector2(0.13, -0.11),
		Vector2(0.16, 0.00), Vector2(0.08, 0.08), Vector2(-0.13, 0.07)
	]), 0.30, 0.02, BODY_PISTOL)
	_cylinder_part("Barrel", 0.030, 0.34, 0.28, 0.115, GRIP_PISTOL, 8)
	_profile_part("Grip", PackedVector2Array([
		Vector2(-0.115, 0.08), Vector2(0.115, 0.08), Vector2(0.095, -0.28),
		Vector2(0.02, -0.39), Vector2(-0.11, -0.31)
	]), 0.17, -0.07, GRIP_PISTOL, Vector3(0.0, -0.03, 0.0), Vector3(-8.0, 0.0, 0.0))
	_profile_part("Magazine", PackedVector2Array([
		Vector2(-0.08, 0.08), Vector2(0.08, 0.08), Vector2(0.065, -0.21),
		Vector2(-0.06, -0.25)
	]), 0.12, -0.07, BODY_PISTOL, Vector3(0.0, -0.08, 0.0), Vector3(-8.0, 0.0, 0.0))
	_box_part("FrontSight", Vector3(0.045, 0.08, 0.05), 0.012, Vector3(0.0, 0.23, 0.34), ACCENT_PISTOL)
	_box_part("RearSightL", Vector3(0.028, 0.065, 0.05), 0.010, Vector3(-0.048, 0.25, -0.03), ACCENT_PISTOL)
	_box_part("RearSightR", Vector3(0.028, 0.065, 0.05), 0.010, Vector3(0.048, 0.25, -0.03), ACCENT_PISTOL)
	_box_part("TriggerGuardTop", Vector3(0.16, 0.035, 0.08), 0.012, Vector3(0.0, -0.08, 0.10), GRIP_PISTOL)
	_box_part("TriggerGuardFront", Vector3(0.035, 0.10, 0.08), 0.012, Vector3(0.075, -0.13, 0.10), GRIP_PISTOL)


func _build_shotgun() -> void:
	_profile_part("Receiver", PackedVector2Array([
		Vector2(-0.22, -0.10), Vector2(-0.18, -0.16), Vector2(0.20, -0.16),
		Vector2(0.26, -0.05), Vector2(0.24, 0.14), Vector2(0.16, 0.20),
		Vector2(-0.19, 0.18), Vector2(-0.25, 0.08)
	]), 0.40, -0.06, BODY_SHOTGUN)
	_cylinder_part("Barrel", 0.078, 1.04, 0.12, 0.10, METAL_SHOTGUN, 10)
	_cylinder_part("Muzzle", 0.105, 0.13, 1.13, 0.10, GRIP_SHOTGUN, 10)
	_cylinder_part("MagazineTube", 0.060, 0.84, 0.15, -0.10, BODY_SHOTGUN, 10)
	_profile_part("Stock", PackedVector2Array([
		Vector2(-0.21, -0.12), Vector2(-0.43, -0.10), Vector2(-0.53, -0.02),
		Vector2(-0.50, 0.10), Vector2(-0.25, 0.12), Vector2(-0.18, 0.05)
	]), 0.31, -0.38, GRIP_SHOTGUN)
	_profile_part("Grip", PackedVector2Array([
		Vector2(-0.10, 0.10), Vector2(0.10, 0.10), Vector2(0.08, -0.20),
		Vector2(-0.07, -0.27), Vector2(-0.13, -0.10)
	]), 0.20, -0.08, GRIP_SHOTGUN, Vector3(0.0, -0.18, 0.0), Vector3(-10.0, 0.0, 0.0))
	_box_part("Pump", Vector3(0.16, 0.15, 0.28), 0.035, Vector3(0.0, -0.06, 0.52), ACCENT_SHOTGUN, Vector3(-3.0, 0.0, 0.0))
	_box_part("TopRail", Vector3(0.13, 0.045, 0.40), 0.016, Vector3(0.0, 0.23, 0.10), GRIP_SHOTGUN)
	_box_part("FrontSight", Vector3(0.06, 0.12, 0.06), 0.014, Vector3(0.0, 0.20, 0.92), ACCENT_SHOTGUN)


func _build_smg() -> void:
	_profile_part("Receiver", PackedVector2Array([
		Vector2(-0.25, -0.09), Vector2(-0.18, -0.15), Vector2(0.23, -0.14),
		Vector2(0.28, -0.04), Vector2(0.25, 0.13), Vector2(0.17, 0.17),
		Vector2(-0.20, 0.15), Vector2(-0.27, 0.06)
	]), 0.30, -0.01, BODY_SMG)
	_profile_part("RearHousing", PackedVector2Array([
		Vector2(-0.23, -0.06), Vector2(-0.43, -0.04), Vector2(-0.47, 0.07),
		Vector2(-0.22, 0.13)
	]), 0.26, -0.23, GRIP_SMG)
	_cylinder_part("Barrel", 0.045, 0.50, 0.23, 0.08, METAL_SMG, 8)
	_cylinder_part("Muzzle", 0.070, 0.11, 0.72, 0.08, GRIP_SMG, 8)
	_profile_part("Magazine", PackedVector2Array([
		Vector2(-0.10, 0.11), Vector2(0.10, 0.11), Vector2(0.08, -0.23),
		Vector2(-0.06, -0.31)
	]), 0.15, 0.02, GRIP_SMG, Vector3(0.0, -0.18, 0.0), Vector3(-11.0, 0.0, 0.0))
	_profile_part("Grip", PackedVector2Array([
		Vector2(-0.095, 0.10), Vector2(0.10, 0.10), Vector2(0.07, -0.18),
		Vector2(-0.06, -0.24), Vector2(-0.12, -0.10)
	]), 0.17, -0.04, GRIP_SMG, Vector3(0.0, -0.17, 0.0), Vector3(-9.0, 0.0, 0.0))
	_box_part("TopRail", Vector3(0.12, 0.045, 0.38), 0.016, Vector3(0.0, 0.21, 0.20), GRIP_SMG)
	_box_part("StockHinge", Vector3(0.13, 0.11, 0.10), 0.02, Vector3(0.0, 0.05, -0.25), ACCENT_SMG)
	_box_part("RearSightL", Vector3(0.028, 0.085, 0.05), 0.010, Vector3(-0.05, 0.19, -0.16), ACCENT_SMG)
	_box_part("RearSightR", Vector3(0.028, 0.085, 0.05), 0.010, Vector3(0.05, 0.19, -0.16), ACCENT_SMG)
	_box_part("FrontSight", Vector3(0.055, 0.10, 0.055), 0.014, Vector3(0.0, 0.18, 0.57), ACCENT_SMG)


func _profile_part(name: String, points: PackedVector2Array, depth: float, z_center: float, color: Color, offset: Vector3 = Vector3.ZERO, rotation_deg: Vector3 = Vector3.ZERO) -> MeshInstance3D:
	var part := _part(name, _extruded_profile(points, depth, z_center), color)
	part.position = offset
	part.rotation_degrees = rotation_deg
	return part


func _box_part(name: String, dimensions: Vector3, bevel: float, offset: Vector3, color: Color, rotation_deg: Vector3 = Vector3.ZERO) -> MeshInstance3D:
	var half := Vector2(dimensions.x * 0.5, dimensions.y * 0.5)
	var b := clampf(bevel, 0.0, minf(half.x, half.y) * 0.85)
	var points := PackedVector2Array([
		Vector2(-half.x + b, -half.y), Vector2(half.x - b, -half.y),
		Vector2(half.x, -half.y + b), Vector2(half.x, half.y - b),
		Vector2(half.x - b, half.y), Vector2(-half.x + b, half.y),
		Vector2(-half.x, half.y - b), Vector2(-half.x, -half.y + b)
	])
	return _profile_part(name, points, dimensions.z, 0.0, color, offset, rotation_deg)


func _cylinder_part(name: String, radius: float, length: float, z_start: float, center_y: float, color: Color, sides: int = 10) -> MeshInstance3D:
	return _part(name, _cylinder_mesh(radius, length, sides, z_start, center_y), color)


func _part(name: String, mesh: ArrayMesh, color: Color) -> MeshInstance3D:
	var instance := MeshInstance3D.new()
	instance.name = name
	instance.mesh = mesh
	instance.material_override = _material(color)
	instance.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON
	add_child(instance)
	return instance


func _extruded_profile(points: PackedVector2Array, depth: float, z_center: float) -> ArrayMesh:
	var tool := SurfaceTool.new()
	tool.begin(Mesh.PRIMITIVE_TRIANGLES)
	if points.size() < 3:
		return tool.commit()
	var front := z_center - depth * 0.5
	var back := z_center + depth * 0.5
	for index: int in range(1, points.size() - 1):
		_add_triangle(tool, _profile_point(points[0], front), _profile_point(points[index + 1], front), _profile_point(points[index], front))
		_add_triangle(tool, _profile_point(points[0], back), _profile_point(points[index], back), _profile_point(points[index + 1], back))
	for index: int in points.size():
		var next := (index + 1) % points.size()
		_add_triangle(tool, _profile_point(points[index], front), _profile_point(points[index], back), _profile_point(points[next], back))
		_add_triangle(tool, _profile_point(points[index], front), _profile_point(points[next], back), _profile_point(points[next], front))
	tool.generate_normals()
	return tool.commit()


func _profile_point(point: Vector2, z: float) -> Vector3:
	return Vector3(point.x, point.y, z)


func _cylinder_mesh(radius: float, length: float, sides: int, z_start: float, center_y: float) -> ArrayMesh:
	var tool := SurfaceTool.new()
	tool.begin(Mesh.PRIMITIVE_TRIANGLES)
	var segment_count := maxi(6, sides)
	var front_center := Vector3(0.0, center_y, z_start)
	var back_center := Vector3(0.0, center_y, z_start + length)
	for index: int in segment_count:
		var next := (index + 1) % segment_count
		var a0 := TAU * float(index) / float(segment_count)
		var a1 := TAU * float(next) / float(segment_count)
		var front_a := Vector3(cos(a0) * radius, center_y + sin(a0) * radius, z_start)
		var front_b := Vector3(cos(a1) * radius, center_y + sin(a1) * radius, z_start)
		var back_a := Vector3(cos(a0) * radius, center_y + sin(a0) * radius, z_start + length)
		var back_b := Vector3(cos(a1) * radius, center_y + sin(a1) * radius, z_start + length)
		_add_triangle(tool, front_center, front_b, front_a)
		_add_triangle(tool, back_center, back_a, back_b)
		_add_triangle(tool, front_a, front_b, back_b)
		_add_triangle(tool, front_a, back_b, back_a)
	tool.generate_normals()
	return tool.commit()


func _add_triangle(tool: SurfaceTool, a: Vector3, b: Vector3, c: Vector3) -> void:
	tool.add_vertex(a)
	tool.add_vertex(b)
	tool.add_vertex(c)


func _material(color: Color) -> StandardMaterial3D:
	var material := StandardMaterial3D.new()
	material.albedo_color = color
	material.metallic = 0.18 if color.v > 0.35 else 0.08
	material.roughness = 0.42 if color.v > 0.35 else 0.58
	material.cull_mode = BaseMaterial3D.CULL_DISABLED
	return material
