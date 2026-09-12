class_name CombatFX
extends Node3D

## Piscina de efectos de combate en mundo (no depende del viewmodel).
##
## Presupuesto por disparo, decidido para el renderer Mobile y SM_S901E:
##   1 luz de fogonazo breve (reutilizada) + 1 quad de humo + 1 casquillo.
## Los impactos añaden chispas (quads baratos) y un decal por impacto; todo
## vive en piscinas preasignadas para no instanciar nada durante el fuego.
##
## El nodo es `top_level`: sus hijos trabajan en coordenadas de mundo, así que
## no hay que deshacer la transform del arma/actor al colocar cada efecto.

const SMOKE_COUNT := 6
const SPARK_COUNT := 28
const SHELL_COUNT := 6
const TRACER_COUNT := 8
const DECAL_COUNT := 24

const SMOKE_TTL := 0.30
const SPARK_TTL_MIN := 0.18
const SPARK_TTL_MAX := 0.34
const SHELL_TTL := 0.95
const TRACER_TTL := 0.10
## Ancho máximo de la trazadora en radianes vistos desde la cámara (~4 px en un
## render de 1280 px con 70° de FOV). Evita que una trazadora que pasa cerca del
## ojo se convierta en una banda ancha.
const TRACER_EYE_WIDTH := 0.0045
const DECAL_TTL := 7.0
const DECAL_SIZE := 0.085
const GRAVITY := 9.2

var _rng := RandomNumberGenerator.new()
static var _soft_texture_cache: ImageTexture
var _muzzle_light: OmniLight3D
var _muzzle_energy := 0.0
var _smoke: Array[Dictionary] = []
var _sparks: Array[Dictionary] = []
var _shells: Array[Dictionary] = []
var _tracers: Array[Dictionary] = []
var _decals: Array[Dictionary] = []
var _decal_cursor := 0
var _smoke_cursor := 0
var _spark_cursor := 0
var _shell_cursor := 0
var _tracer_cursor := 0
var _ready_pools := false


func _ready() -> void:
	top_level = true
	_rng.randomize()
	_build_pools()
	set_process(true)


func _build_pools() -> void:
	if _ready_pools:
		return
	_ready_pools = true
	_muzzle_light = OmniLight3D.new()
	_muzzle_light.name = "MuzzleLight"
	_muzzle_light.light_color = Color("#ffc65a")
	_muzzle_light.omni_range = 5.2
	_muzzle_light.shadow_enabled = false
	_muzzle_light.light_energy = 0.0
	_muzzle_light.visible = false
	add_child(_muzzle_light)

	for index: int in range(SMOKE_COUNT):
		_smoke.append(_make_quad("Smoke%d" % index, _billboard_material(Color(0.60, 0.60, 0.64, 0.42), false), 0.12))
	for index: int in range(SPARK_COUNT):
		_sparks.append(_make_quad("Spark%d" % index, _billboard_material(Color(1.0, 0.78, 0.35, 0.95), true), 0.05))
	for index: int in range(SHELL_COUNT):
		_shells.append(_make_shell("Shell%d" % index))
	for index: int in range(TRACER_COUNT):
		_tracers.append(_make_tracer("Tracer%d" % index))
	for index: int in range(DECAL_COUNT):
		_decals.append(_make_decal("Decal%d" % index))


## Fogonazo: 1 luz breve + 1 quad de humo. `origin` es la boca del cañón.
func muzzle_burst(origin: Vector3, forward: Vector3, scale: float) -> void:
	if not _ready_pools:
		_build_pools()
	_muzzle_energy = 4.2 * clampf(scale, 0.6, 2.0)
	_muzzle_light.global_position = origin + forward * 0.05
	_muzzle_light.omni_range = 3.2
	_muzzle_light.light_energy = _muzzle_energy
	_muzzle_light.visible = true

	var smoke: Dictionary = _smoke[_smoke_cursor % _smoke.size()]
	_smoke_cursor += 1
	var node: MeshInstance3D = smoke["node"]
	node.global_position = origin + forward * 0.10 + Vector3(0.0, 0.02, 0.0)
	node.scale = Vector3.ONE * clampf(scale, 0.6, 1.4)
	node.transparency = 0.0
	node.visible = true
	smoke["life"] = SMOKE_TTL
	smoke["drift"] = forward * 0.45 + Vector3(0.0, 0.16, 0.0)


## Trazadora: caja fina estirada del cañón al punto de impacto.
##
## La caja mide 16 mm, pero eso es un ancho de mundo: a un metro del ojo son
## ~15 px de pantalla y, al ser aditiva y sin sombra, tapaba la mira con una
## banda crema quemada (vista en capturas propias y de bots que cruzan cerca).
## El ancho se limita a `TRACER_EYE_WIDTH` radianes medidos desde la cámara, de
## modo que la trazadora sigue siendo una línea de ~4 px a cualquier distancia.
func tracer(from: Vector3, to: Vector3, width: float = 0.016) -> void:
	if not _ready_pools:
		_build_pools()
	var delta := to - from
	var length := delta.length()
	if length < 0.05:
		return
	width = minf(width, TRACER_EYE_WIDTH * _eye_distance_to_segment(from, delta, length))
	var entry: Dictionary = _tracers[_tracer_cursor % _tracers.size()]
	_tracer_cursor += 1
	var node: MeshInstance3D = entry["node"]
	node.global_transform = Transform3D(Basis.looking_at(delta.normalized(), Vector3.UP), from + delta * 0.5)
	node.scale = Vector3(width, width, length)
	node.transparency = 0.0
	node.visible = true
	entry["life"] = TRACER_TTL


## Distancia de la cámara activa al punto más cercano del tramo. Sin cámara (o
## fuera del árbol) devuelve infinito: el límite de ancho no aplica.
func _eye_distance_to_segment(from: Vector3, delta: Vector3, length: float) -> float:
	if not is_inside_tree():
		return INF
	var viewport := get_viewport()
	var camera := viewport.get_camera_3d() if viewport != null else null
	if camera == null:
		return INF
	var eye := camera.global_position
	var t := clampf((eye - from).dot(delta) / (length * length), 0.0, 1.0)
	return eye.distance_to(from + delta * t)


## Impacto en geometría: chispas + decal. `flesh` cambia a puff sin decal.
func impact(point: Vector3, normal: Vector3, flesh: bool = false) -> void:
	if not _ready_pools:
		_build_pools()
	var base_normal := normal.normalized() if normal.length_squared() > 0.001 else Vector3.UP
	var count := 2 if flesh else 4
	for index: int in range(count):
		var entry: Dictionary = _sparks[_spark_cursor % _sparks.size()]
		_spark_cursor += 1
		var node: MeshInstance3D = entry["node"]
		node.global_position = point + base_normal * 0.03
		node.scale = Vector3.ONE * (0.55 if flesh else 1.0)
		node.transparency = 0.0
		node.visible = true
		var tangent := base_normal.cross(Vector3.UP)
		if tangent.length_squared() < 0.001:
			tangent = Vector3.RIGHT
		tangent = tangent.normalized()
		var bitangent := base_normal.cross(tangent).normalized()
		var burst := base_normal * _rng.randf_range(1.4, 2.6)
		burst += tangent * _rng.randf_range(-1.5, 1.5)
		burst += bitangent * _rng.randf_range(-1.5, 1.5)
		entry["velocity"] = burst
		entry["life"] = _rng.randf_range(SPARK_TTL_MIN, SPARK_TTL_MAX)
	if flesh:
		return
	var decal: Dictionary = _decals[_decal_cursor % _decals.size()]
	_decal_cursor += 1
	var decal_node: MeshInstance3D = decal["node"]
	var basis := Basis.looking_at(-base_normal, Vector3.UP if absf(base_normal.y) < 0.95 else Vector3.FORWARD)
	decal_node.global_transform = Transform3D(basis, point + base_normal * 0.012)
	decal_node.rotation *= _rng.randf_range(0.0, TAU)
	decal_node.scale = Vector3.ONE * _rng.randf_range(0.8, 1.25)
	decal_node.transparency = 0.0
	decal_node.visible = true
	decal["life"] = DECAL_TTL


## Casquillo expulsado desde la ventana de eyección.
func shell_eject(origin: Vector3, right: Vector3, up: Vector3) -> void:
	if not _ready_pools:
		_build_pools()
	var entry: Dictionary = _shells[_shell_cursor % _shells.size()]
	_shell_cursor += 1
	var node: MeshInstance3D = entry["node"]
	node.global_position = origin + right * 0.05 + up * 0.02
	node.global_rotation = Vector3(_rng.randf_range(0.0, TAU), _rng.randf_range(0.0, TAU), 0.0)
	node.visible = true
	entry["velocity"] = right * _rng.randf_range(1.5, 2.1) + up * _rng.randf_range(0.8, 1.3)
	entry["spin"] = Vector3(_rng.randf_range(-9.0, 9.0), _rng.randf_range(-9.0, 9.0), _rng.randf_range(-9.0, 9.0))
	entry["floor"] = origin.y - 0.12
	entry["life"] = SHELL_TTL


func _process(delta: float) -> void:
	if _muzzle_light != null and _muzzle_light.visible:
		# <=50 ms de vida: suficiente para leerse como fogonazo y no dejar
		# popping en el clúster de luces del renderer Mobile.
		_muzzle_light.light_energy = move_toward(_muzzle_light.light_energy, 0.0, delta * _muzzle_energy * 22.0)
		if _muzzle_light.light_energy <= 0.02:
			_muzzle_light.visible = false
	for entry: Dictionary in _smoke:
		if not _fade_entry(entry, delta, SMOKE_TTL, true):
			continue
		var node: MeshInstance3D = entry["node"]
		node.global_position += (entry["drift"] as Vector3) * delta
		node.scale += Vector3.ONE * delta * 0.55
	for entry: Dictionary in _sparks:
		if entry["life"] <= 0.0:
			continue
		var node: MeshInstance3D = entry["node"]
		var velocity: Vector3 = entry["velocity"]
		velocity.y -= GRAVITY * delta
		entry["velocity"] = velocity
		node.global_position += velocity * delta
		if not _fade_entry(entry, delta, SPARK_TTL_MAX, false):
			continue
	for entry: Dictionary in _tracers:
		_fade_entry(entry, delta, TRACER_TTL, false)
	for entry: Dictionary in _decals:
		_fade_entry(entry, delta, DECAL_TTL, false)
	for entry: Dictionary in _shells:
		if entry["life"] <= 0.0:
			continue
		var node: MeshInstance3D = entry["node"]
		var velocity: Vector3 = entry["velocity"]
		velocity.y -= GRAVITY * delta
		if node.global_position.y <= float(entry["floor"]) and velocity.y < 0.0:
			velocity.y = -velocity.y * 0.32
			velocity.x *= 0.6
			velocity.z *= 0.6
			entry["floor"] = -1e9
		entry["velocity"] = velocity
		node.global_position += velocity * delta
		var spin: Vector3 = entry["spin"]
		node.rotate_x(spin.x * delta)
		node.rotate_y(spin.y * delta)
		entry["life"] = maxf(0.0, float(entry["life"]) - delta)
		if entry["life"] <= 0.0:
			node.visible = false


## Curva "mantener y fundir": el efecto se queda a opacidad plena la mayor
## parte de su vida y sólo funde en el último 45 %. Con un fundido lineal puro
## y delta real de 30-50 ms (móvil), trazadora y chispas desaparecían antes de
## que el ojo las registrara.
func _fade_entry(entry: Dictionary, delta: float, ttl: float, _grow: bool) -> bool:
	if entry["life"] <= 0.0:
		return false
	entry["life"] = maxf(0.0, float(entry["life"]) - delta)
	var node: MeshInstance3D = entry["node"]
	var remaining := float(entry["life"]) / ttl
	node.transparency = clampf(1.0 - clampf(remaining / 0.45, 0.0, 1.0), 0.0, 1.0)
	if entry["life"] <= 0.0:
		node.visible = false
		return false
	return true


func _make_quad(name: String, material: StandardMaterial3D, size: float) -> Dictionary:
	var node := MeshInstance3D.new()
	node.name = name
	var quad := QuadMesh.new()
	quad.size = Vector2(size, size)
	node.mesh = quad
	node.material_override = material
	node.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	node.visible = false
	add_child(node)
	return {"node": node, "life": 0.0, "velocity": Vector3.ZERO, "drift": Vector3.ZERO}


func _make_shell(name: String) -> Dictionary:
	var node := MeshInstance3D.new()
	node.name = name
	var box := BoxMesh.new()
	box.size = Vector3(0.013, 0.013, 0.030)
	node.mesh = box
	var material := StandardMaterial3D.new()
	material.albedo_color = Color("#c9a24a")
	material.metallic = 0.85
	material.roughness = 0.32
	node.material_override = material
	node.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	node.visible = false
	add_child(node)
	return {"node": node, "life": 0.0, "velocity": Vector3.ZERO, "spin": Vector3.ZERO, "floor": 0.0}


func _make_tracer(name: String) -> Dictionary:
	var node := MeshInstance3D.new()
	node.name = name
	var box := BoxMesh.new()
	box.size = Vector3.ONE
	node.mesh = box
	node.material_override = _billboard_material(Color(1.0, 0.90, 0.58, 0.62), true, false, false)
	node.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	node.visible = false
	add_child(node)
	return {"node": node, "life": 0.0}


func _make_decal(name: String) -> Dictionary:
	var node := MeshInstance3D.new()
	node.name = name
	var quad := QuadMesh.new()
	quad.size = Vector2(DECAL_SIZE, DECAL_SIZE)
	node.mesh = quad
	node.material_override = _billboard_material(Color(0.04, 0.04, 0.05, 0.72), false, false)
	node.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	node.visible = false
	add_child(node)
	return {"node": node, "life": 0.0}


## Textura radial suave generada una vez: sin ella los quads de humo, chispa y
## decal se leían como cuadrados duros de color plano.
static func _soft_texture() -> ImageTexture:
	if _soft_texture_cache != null:
		return _soft_texture_cache
	var size := 64
	var image := Image.create(size, size, false, Image.FORMAT_RGBA8)
	for y: int in range(size):
		for x: int in range(size):
			var offset := Vector2(float(x) - size * 0.5 + 0.5, float(y) - size * 0.5 + 0.5)
			var falloff := clampf(1.0 - offset.length() / (size * 0.5), 0.0, 1.0)
			image.set_pixel(x, y, Color(1.0, 1.0, 1.0, falloff * falloff))
	_soft_texture_cache = ImageTexture.create_from_image(image)
	return _soft_texture_cache


func _billboard_material(color: Color, additive: bool, billboard: bool = true, soft: bool = true) -> StandardMaterial3D:
	var material := StandardMaterial3D.new()
	material.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	material.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	material.blend_mode = BaseMaterial3D.BLEND_MODE_ADD if additive else BaseMaterial3D.BLEND_MODE_MIX
	material.billboard_mode = BaseMaterial3D.BILLBOARD_ENABLED if billboard else BaseMaterial3D.BILLBOARD_DISABLED
	material.cull_mode = BaseMaterial3D.CULL_DISABLED
	material.albedo_color = color
	if soft:
		material.albedo_texture = _soft_texture()
	material.disable_receive_shadows = true
	return material
