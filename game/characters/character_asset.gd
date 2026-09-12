class_name CharacterAsset
extends RefCounted

## Convierte el GLB del personaje en algo usable por el actor: carga el rig,
## arregla los defectos del asset y monta el arma en el pecho con puños de
## agarre. Todo lo de aquí pasa UNA vez por proceso (los resultados se cachean
## como dato del asset) o una vez por actor, nunca por fotograma.
##
## Frontera de dueños: `OperatorBody` compone la pose cada fotograma;
## `OperatorWardrobe` decide qué geometría se ve; aquí sólo se prepara el asset.
##
## Por qué existe este archivo: el pack Quaternius trae tres defectos que hay
## que corregir antes de que el personaje sirva, y son cirugía de datos, no
## gameplay:
##   1. los vértices de las manos vienen rígidos al hueso Root (x bind > 0,60,
##      slab y≈1,39-1,46), así que la mano no sigue al brazo y la piel se
##      estira al apuntar. Se reasignan a Wrist.L/R al cargar y se descartan sus
##      triángulos (el rig no tiene huesos de dedos: la mano abierta no puede
##      agarrar). En su lugar se monta un puño cerrado en el punto de agarre.
##   2. las caras vienen planas (faceteado): el suavizado se hizo en Blender
##      (`tools/blender-smooth-character.py`), no aquí.
##   3. el material de ropa y piel es color plano y a distancia se leía como
##      plástico: se añade una textura de detalle generada (tela tejida / poro).
##
## Presupuesto medido (`tools/probe-build-cost.gd`, 9 combatientes): 15 505 ms
## antes de cachear, 1 611 ms después. Las dos cachés `static` son la razón;
## si se tocan, `tests/animation_layers.gd` compara la malla del actor en frío
## con la del que copia caché.

const CHARACTER_SCENE_PATH := "res://assets/models/skins/operator_adult_lod.glb"

## Clips propios generados sobre este mismo rig (mismos 22 huesos, sin root
## motion). El pack original no trae recarga ni strafe; ver
## tools/blender-smooth-character.py y el pipeline de clips del repo.
const EXTRA_CLIP_PATHS := [
	"res://assets/models/animation_library/WalkFwd.glb",
	"res://assets/models/animation_library/SprintFwd.glb",
	"res://assets/models/animation_library/ReloadRifle.glb",
	"res://assets/models/animation_library/ReloadPistol.glb",
	"res://assets/models/animation_library/StrafeLeft.glb",
	"res://assets/models/animation_library/StrafeRight.glb",
	"res://assets/models/animation_library/Land.glb",
	"res://assets/models/animation_library/Flinch.glb",
	"res://assets/models/animation_library/CrouchIdle.glb",
	"res://assets/models/animation_library/CrouchWalk.glb",
	"res://assets/models/animation_library/BackWalk.glb",
	"res://assets/models/animation_library/CrouchLeft.glb",
	"res://assets/models/animation_library/CrouchRight.glb",
	"res://assets/models/animation_library/CrouchBack.glb",
	"res://assets/models/animation_library/JumpStart.glb",
	"res://assets/models/animation_library/AirLoop.glb",
	"res://assets/models/animation_library/Brake.glb"
]
## Clips que deben repetir en bucle (glTF no lleva el metadato).
const LOOPING_CLIPS := ["WalkFwd", "SprintFwd", "StrafeLeft", "StrafeRight", "CrouchIdle", "CrouchWalk", "BackWalk", "CrouchLeft", "CrouchRight", "CrouchBack", "AirLoop"]
## Frontera de la caja donde el pack dejó los vértices de las manos rígidos al
## hueso Root, en espacio bind. Ver cabecera.
const HAND_BIND_MIN_X := 0.60
const HAND_BIND_MIN_Y := 1.30
const HAND_BIND_MAX_Y := 1.55

## El arma se ancla al pecho, no a la muñeca derecha: las manos van al arma
## (IK) y no al revés. Así el agarre de dos manos es posible con la longitud
## real de brazo de este rig y la boca de cañón es estable al apuntar.
const CHEST_BONE := "Chest"

## El pack mira a +Z y el contrato del actor usa -Z como delante: una sola
## rotación deja la espalda hacia la cámara de hombro. El modelo ya está en
## metros (1,86 m), así que no se escala.
const MODEL_YAW_DEGREES := 180.0


## Carga el GLB y devuelve el nodo ya preparado, con el esqueleto y la
## biblioteca de clips listos. Devuelve null si el asset no está.
static func instantiate_rig(parent: Node3D) -> Node3D:
	if not ResourceLoader.exists(CHARACTER_SCENE_PATH):
		return null
	var packed := load(CHARACTER_SCENE_PATH) as PackedScene
	if packed == null:
		return null
	var character := packed.instantiate()
	character.name = "CharacterModel"
	parent.add_child(character)
	return character


## Punto de entrada único del asset: prepara el rig y deja el esqueleto, la
## biblioteca de animación y los clips propios instalados.
static func prepare(character: Node, model_root: Node3D) -> Skeleton3D:
	var skeleton := character.find_child("Skeleton3D", true, false) as Skeleton3D
	var animation_player := character.find_child("AnimationPlayer", true, false) as AnimationPlayer
	if skeleton == null or animation_player == null:
		return null
	repair_module_weights(character, skeleton)
	install_extra_clips(animation_player, skeleton)
	return skeleton


## Reasigna a las muñecas los vértices que el pack dejó rígidos al hueso Root.
## Es una corrección de datos del asset, no un truco de escala: sin esto las
## manos se quedan en la T-pose mientras el brazo se mueve y la piel se estira.
static func repair_module_weights(character: Node, skeleton: Skeleton3D) -> void:
	var wrist_l := skeleton.find_bone("Wrist.L")
	var wrist_r := skeleton.find_bone("Wrist.R")
	if wrist_l < 0 or wrist_r < 0:
		return
	for candidate: Node in character.find_children("*", "MeshInstance3D", true, false):
		var mesh_instance := candidate as MeshInstance3D
		if mesh_instance == null or mesh_instance.mesh == null:
			continue
		apply_material_detail(mesh_instance)
		var root_bind := _root_bind_index(mesh_instance)
		if root_bind < 0:
			continue
		_repair_mesh_hands(mesh_instance, root_bind, wrist_l, wrist_r)


static func _root_bind_index(mesh_instance: MeshInstance3D) -> int:
	if mesh_instance.skin == null:
		return -1
	for bind in range(mesh_instance.skin.get_bind_count()):
		if String(mesh_instance.skin.get_bind_name(bind)) == "Root":
			return bind
	return -1


## Resultado de la cirugía de pesos por asset y superficie. Vive en `static` a
## propósito: es dato derivado del asset, idéntico para todos los actores.
static var _REPAIR_CACHE: Dictionary = {}


static func _repair_mesh_hands(mesh_instance: MeshInstance3D, root_bind: int, wrist_l: int, wrist_r: int) -> void:
	var source := mesh_instance.mesh
	if source.get_surface_count() == 0:
		return
	var asset := source.resource_path
	var repaired := ArrayMesh.new()
	var changed := false
	for surface in range(source.get_surface_count()):
		# La geometría de un asset es la misma en cada actor: la cirugía se hace
		# una vez por proceso y el resto de actores copian el resultado ya
		# calculado. La caché se indexa por la posición en la malla reparada
		# —que no es la de origen cuando una superficie se descarta entera—.
		# Medido: 250 ms por actor sin caché, ~40 ms con ella.
		var cached: Dictionary = _REPAIR_CACHE.get(asset, {}).get(repaired.get_surface_count(), {})
		if not cached.is_empty():
			repaired.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, cached["arrays"])
			repaired.surface_set_material(repaired.get_surface_count() - 1, cached["material"])
			changed = true
			continue
		var arrays: Array = source.surface_get_arrays(surface)
		var vertices: PackedVector3Array = arrays[Mesh.ARRAY_VERTEX]
		var bones: PackedInt32Array = arrays[Mesh.ARRAY_BONES]
		var weights: PackedFloat32Array = arrays[Mesh.ARRAY_WEIGHTS]
		var per_vertex := bones.size() / maxi(vertices.size(), 1)
		if per_vertex <= 0:
			repaired.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arrays)
			continue
		var is_hand: Array[bool] = []
		is_hand.resize(vertices.size())
		var repaired_here := false
		for vertex in range(vertices.size()):
			var position := vertices[vertex]
			var hand := absf(position.x) >= HAND_BIND_MIN_X \
					and position.y >= HAND_BIND_MIN_Y and position.y <= HAND_BIND_MAX_Y
			is_hand[vertex] = hand
			if not hand:
				continue
			if bones[vertex * per_vertex] == root_bind:
				var target_bone := wrist_l if position.x > 0.0 else wrist_r
				for slot in range(per_vertex):
					bones[vertex * per_vertex + slot] = target_bone if slot == 0 else 0
					weights[vertex * per_vertex + slot] = 1.0 if slot == 0 else 0.0
				repaired_here = true
		arrays[Mesh.ARRAY_BONES] = bones
		arrays[Mesh.ARRAY_WEIGHTS] = weights
		if not repaired_here:
			repaired.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arrays)
			repaired.surface_set_material(repaired.get_surface_count() - 1, source.surface_get_material(surface))
			continue
		changed = true
		# La mano abierta no puede cerrarse (el rig no tiene huesos de dedos):
		# se eliminan sus triángulos y el puño cerrado se monta en el arma, en
		# el punto de agarre real, así siempre coincide con el guardamanos.
		var compact := _drop_hand_triangles(arrays, is_hand, per_vertex)
		compact[Mesh.ARRAY_TANGENT] = null
		if (compact[Mesh.ARRAY_INDEX] as PackedInt32Array).is_empty():
			# Superficie formada solo por manos (no queda nada que dibujar).
			continue
		repaired.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, compact)
		repaired.surface_set_material(repaired.get_surface_count() - 1, source.surface_get_material(surface))
		_cache_repaired_surface(asset, repaired.get_surface_count() - 1, compact, source.surface_get_material(surface))
	if changed:
		mesh_instance.mesh = repaired


static func _cache_repaired_surface(asset: String, surface: int, arrays: Array, material: Material) -> void:
	if asset.is_empty():
		return
	var per_asset: Dictionary = _REPAIR_CACHE.get(asset, {})
	per_asset[surface] = {"arrays": arrays, "material": material}
	_REPAIR_CACHE[asset] = per_asset


## Devuelve los arrays de una superficie sin los triángulos que tocan la mano,
## compactando los vértices supervivientes para no dejar triángulos degenerados.
static func _drop_hand_triangles(arrays: Array, is_hand: Array[bool], per_vertex: int) -> Array:
	var vertices: PackedVector3Array = arrays[Mesh.ARRAY_VERTEX]
	var indices := PackedInt32Array()
	if arrays[Mesh.ARRAY_INDEX] != null:
		indices = arrays[Mesh.ARRAY_INDEX]
	else:
		indices.resize(vertices.size())
		for i in range(vertices.size()):
			indices[i] = i
	var remap := PackedInt32Array()
	remap.resize(vertices.size())
	remap.fill(-1)
	var compact: Array = []
	compact.resize(Mesh.ARRAY_MAX)
	for key in range(arrays.size()):
		if key == Mesh.ARRAY_INDEX or arrays[key] == null:
			continue
		if (arrays[key] as Variant).size() == 0:
			continue
		compact[key] = _empty_like(arrays[key])
	var new_indices := PackedInt32Array()
	for triangle in range(indices.size() / 3):
		var a := indices[triangle * 3]
		var b := indices[triangle * 3 + 1]
		var c := indices[triangle * 3 + 2]
		if is_hand[a] or is_hand[b] or is_hand[c]:
			continue
		for vertex: int in [a, b, c]:
			if remap[vertex] < 0:
				remap[vertex] = (compact[Mesh.ARRAY_VERTEX] as PackedVector3Array).size()
				_append_vertex(arrays, compact, vertex, per_vertex)
			new_indices.append(remap[vertex])
	compact[Mesh.ARRAY_INDEX] = new_indices
	return compact


static func _empty_like(source: Variant) -> Variant:
	match typeof(source):
		TYPE_PACKED_VECTOR3_ARRAY: return PackedVector3Array()
		TYPE_PACKED_VECTOR2_ARRAY: return PackedVector2Array()
		TYPE_PACKED_INT32_ARRAY: return PackedInt32Array()
		TYPE_PACKED_FLOAT32_ARRAY: return PackedFloat32Array()
		TYPE_PACKED_COLOR_ARRAY: return PackedColorArray()
	return null


static func _append_vertex(source: Array, target: Array, vertex: int, per_vertex: int) -> void:
	for key in range(source.size()):
		if key == Mesh.ARRAY_INDEX or source[key] == null or target[key] == null:
			continue
		# ARRAY_BONES, ARRAY_WEIGHTS y ARRAY_TANGENT son planos (varias
		# componentes por vértice); copiarlos uno a uno rompe el formato.
		var stride := 1
		if key == Mesh.ARRAY_BONES or key == Mesh.ARRAY_WEIGHTS:
			stride = per_vertex
		elif key == Mesh.ARRAY_TANGENT:
			stride = 4
		elif key >= Mesh.ARRAY_CUSTOM0 and key <= Mesh.ARRAY_CUSTOM3:
			stride = 4
		if stride > 1:
			if key == Mesh.ARRAY_BONES:
				var i32: PackedInt32Array = target[key]
				var src_i: PackedInt32Array = source[key]
				for slot in range(stride):
					i32.append(src_i[vertex * stride + slot])
				target[key] = i32
			else:
				var f32: PackedFloat32Array = target[key]
				var src_f: PackedFloat32Array = source[key]
				for slot in range(stride):
					f32.append(src_f[vertex * stride + slot])
				target[key] = f32
			continue
		match typeof(target[key]):
			TYPE_PACKED_VECTOR3_ARRAY:
				var v3: PackedVector3Array = target[key]
				v3.append((source[key] as PackedVector3Array)[vertex])
				target[key] = v3
			TYPE_PACKED_VECTOR2_ARRAY:
				var v2: PackedVector2Array = target[key]
				v2.append((source[key] as PackedVector2Array)[vertex])
				target[key] = v2
			TYPE_PACKED_INT32_ARRAY:
				var i32: PackedInt32Array = target[key]
				i32.append((source[key] as PackedInt32Array)[vertex])
				target[key] = i32
			TYPE_PACKED_FLOAT32_ARRAY:
				var f32: PackedFloat32Array = target[key]
				f32.append((source[key] as PackedFloat32Array)[vertex])
				target[key] = f32
			TYPE_PACKED_COLOR_ARRAY:
				var col: PackedColorArray = target[key]
				col.append((source[key] as PackedColorArray)[vertex])
				target[key] = col


## Detalle procedural por tipo de material: la ropa y la piel del pack son
## color plano y a distancia se leían como plástico. Se añade una textura de
## detalle generada (tela tejida / poro) sin tocar el asset original.
static func apply_material_detail(mesh_instance: MeshInstance3D) -> void:
	if mesh_instance.mesh == null:
		return
	for surface in range(mesh_instance.mesh.get_surface_count()):
		var source := mesh_instance.get_active_material(surface) as StandardMaterial3D
		if source == null:
			continue
		var name := String(source.resource_name).to_lower()
		var material := source.duplicate() as StandardMaterial3D
		if name.begins_with("skin"):
			material.detail_enabled = true
			material.detail_albedo = _detail_texture(0.55, 0.06, false)
			material.detail_blend_mode = BaseMaterial3D.BLEND_MODE_MUL
			material.detail_uv_layer = BaseMaterial3D.DETAIL_UV_1
			material.uv1_scale = Vector3(14.0, 14.0, 1.0)
			material.roughness = 0.72
		elif name.is_empty() or name in ["default"]:
			continue
		else:
			material.detail_enabled = true
			material.detail_albedo = _detail_texture(0.5, 0.18, true)
			material.detail_blend_mode = BaseMaterial3D.BLEND_MODE_MUL
			material.detail_uv_layer = BaseMaterial3D.DETAIL_UV_1
			material.uv1_scale = Vector3(9.0, 9.0, 1.0)
			material.roughness = 0.88
		mesh_instance.set_surface_override_material(surface, material)


## Textura de detalle por CLASE de material, no por superficie: el personaje
## tiene 124 superficies pero sólo dos variantes (piel y tejido). Sin la caché
## el mismo mapa se regeneraba 124 veces por actor (píxel a píxel en GDScript):
## medido 1082 ms por actor y 124 texturas en memoria para dos mapas distintos.
static var _DETAIL_TEXTURES: Dictionary = {}


static func _detail_texture(base: float, amplitude: float, woven: bool) -> Texture2D:
	var cache_key := "%s_%s_%s" % [base, amplitude, woven]
	if _DETAIL_TEXTURES.has(cache_key):
		return _DETAIL_TEXTURES[cache_key]
	var size := 128
	var image := Image.create(size, size, false, Image.FORMAT_RGB8)
	for y in range(size):
		for x in range(size):
			var value := base
			if woven:
				var stripe := 1.0 if (x / 3) % 2 == 0 else 0.0
				var weft := 1.0 if (y / 3) % 2 == 0 else 0.0
				value += (stripe * 0.55 + weft * 0.45 - 0.5) * amplitude
			else:
				var n := sin(float(x) * 0.9) * cos(float(y) * 0.7) * 0.5 + sin(float(x + y) * 0.23) * 0.5
				value += n * amplitude
			value = clampf(value, 0.0, 1.0)
			image.set_pixel(x, y, Color(value, value, value))
	var texture := ImageTexture.create_from_image(image)
	_DETAIL_TEXTURES[cache_key] = texture
	return texture


## El material de piel del propio pack, para que los puños de agarre combinen.
static func hand_material(modules: Dictionary) -> StandardMaterial3D:
	for slot: String in modules:
		for module_name: String in modules[slot]:
			var mesh_instance: MeshInstance3D = modules[slot][module_name]
			if mesh_instance.mesh == null:
				continue
			for surface in range(mesh_instance.mesh.get_surface_count()):
				var material := mesh_instance.get_active_material(surface) as StandardMaterial3D
				if material != null and String(material.resource_name).begins_with("Skin"):
					return material.duplicate() as StandardMaterial3D
	var fallback := StandardMaterial3D.new()
	fallback.albedo_color = Color("#d9a06f")
	return fallback


## Puños de agarre montados en el ARMA (grip y guardamanos), no en el hueso de
## la muñeca: así el puño y el agarre coinciden siempre, y el IK de los brazos
## apunta exactamente a ese punto. Devuelve [left_fist, right_fist]; el
## izquierdo es null cuando el arma se sostiene a una mano.
static func build_grip_hands(weapon_mount: Node3D, weapon_id: String, config: Dictionary, skin_material: StandardMaterial3D) -> Array:
	if weapon_mount == null:
		return [null, null]
	for child: Node in weapon_mount.get_children():
		if child.name == "GripHands":
			child.free()
	var hands := Node3D.new()
	hands.name = "GripHands"
	weapon_mount.add_child(hands)
	var grip: Vector3 = config.get("grip", Vector3.ZERO)
	var right_fist := _make_fist("RightFist", grip, skin_material, false, weapon_id)
	hands.add_child(right_fist)
	var left_fist: Node3D = null
	var foregrip: Vector3 = config.get("foregrip", Vector3.ZERO)
	if foregrip != Vector3.ZERO:
		left_fist = _make_fist("LeftFist", foregrip, skin_material, true, weapon_id)
		hands.add_child(left_fist)
	return [left_fist, right_fist]


static func _make_fist(fist_name: String, at: Vector3, skin_material: StandardMaterial3D, mirrored: bool, weapon_id: String) -> Node3D:
	var fist := Node3D.new()
	fist.name = fist_name
	fist.position = at
	if mirrored and weapon_id != "pistol":
		# Cupped support: palm below the handguard, fingers up one side and
		# thumb on the other. A solid cylinder here filled the weapon with skin.
		var parts := [
			[Vector3(0.076, 0.025, 0.085), Vector3(0.0, -0.017, -0.005)],
			[Vector3(0.015, 0.050, 0.025), Vector3(0.039, 0.020, -0.021)],
		]
		for z in [-0.030, -0.008, 0.014, 0.036]:
			parts.append([Vector3(0.014, 0.052, 0.018), Vector3(-0.037, 0.018, z)])
		for part: Array in parts:
			var surface := MeshInstance3D.new()
			var box := BoxMesh.new()
			box.size = part[0]
			surface.mesh = box
			surface.position = part[1]
			surface.material_override = skin_material
			fist.add_child(surface)
		return fist
	var palm := MeshInstance3D.new()
	var palm_mesh := CylinderMesh.new()
	# Canal de agarre a lo largo del cañón: el arma pasa por dentro del puño.
	palm_mesh.top_radius = 0.037
	palm_mesh.bottom_radius = 0.041
	palm_mesh.height = 0.096
	palm_mesh.radial_segments = 10
	palm_mesh.rings = 2
	palm.mesh = palm_mesh
	palm.material_override = skin_material
	palm.rotation_degrees = Vector3(90.0, 0.0, 0.0)
	fist.add_child(palm)
	var knuckles := MeshInstance3D.new()
	var knuckle_mesh := BoxMesh.new()
	knuckle_mesh.size = Vector3(0.074, 0.046, 0.040)
	knuckles.mesh = knuckle_mesh
	knuckles.material_override = skin_material
	knuckles.position = Vector3(0.0, 0.0, 0.062)
	fist.add_child(knuckles)
	var thumb := MeshInstance3D.new()
	var thumb_mesh := BoxMesh.new()
	thumb_mesh.size = Vector3(0.028, 0.058, 0.030)
	thumb.mesh = thumb_mesh
	thumb.material_override = skin_material
	thumb.position = Vector3(0.040 if mirrored else -0.040, 0.020, -0.010)
	thumb.rotation_degrees = Vector3(0.0, 0.0, -22.0 if mirrored else 22.0)
	fist.add_child(thumb)
	return fist


## Carga los clips propios (recarga, strafe, agachado, flinch, aterrizaje)
## en la biblioteca "ual". Están autorados sobre este mismo rig, así que solo
## hay que reescribir la ruta de pista para que apunte a este Skeleton3D.
static func install_extra_clips(animation_player: AnimationPlayer, skeleton: Skeleton3D) -> void:
	if animation_player == null or skeleton == null:
		return
	var library := AnimationLibrary.new()
	for clip_path: String in EXTRA_CLIP_PATHS:
		if not ResourceLoader.exists(clip_path):
			continue
		var packed := load(clip_path) as PackedScene
		if packed == null:
			continue
		var source := packed.instantiate()
		var source_player := source.find_child("AnimationPlayer", true, false) as AnimationPlayer
		if source_player != null:
			for library_name: StringName in source_player.get_animation_library_list():
				var source_library := source_player.get_animation_library(library_name)
				if source_library == null:
					continue
				for clip_name: StringName in source_library.get_animation_list():
					if library.has_animation(clip_name):
						continue
					var copied := source_library.get_animation(clip_name).duplicate(true) as Animation
					if copied == null:
						continue
					remap_clip_tracks(copied, animation_player, skeleton)
					library.add_animation(clip_name, copied)
		source.free()
	if library.get_animation_list().is_empty():
		return
	for clip_name: String in LOOPING_CLIPS:
		if library.has_animation(clip_name):
			library.get_animation(clip_name).loop_mode = Animation.LOOP_LINEAR
	if animation_player.get_animation_library_list().has(&"ual"):
		animation_player.remove_animation_library(&"ual")
	animation_player.add_animation_library(&"ual", library)


## Reapunta cada pista de hueso al Skeleton3D de este actor. Una pista cuyo
## hueso no existe en el rig se DESACTIVA en vez de reapuntarse: el clip y el
## esqueleto son el mismo pack, así que un nombre desconocido es un clip de
## otro rig y no debe mover nada.
static func remap_clip_tracks(animation: Animation, animation_player: AnimationPlayer, skeleton: Skeleton3D) -> void:
	var base := animation_player.get_parent()
	var skeleton_path := String(base.get_path_to(skeleton))
	for track in range(animation.get_track_count()):
		var text := String(animation.track_get_path(track))
		var colon := text.find(":")
		if colon < 0:
			continue
		var bone_name := text.substr(colon + 1)
		if skeleton.find_bone(bone_name) < 0:
			animation.track_set_enabled(track, false)
			continue
		animation.track_set_path(track, NodePath(skeleton_path + ":" + bone_name))
