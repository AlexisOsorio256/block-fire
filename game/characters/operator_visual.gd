class_name OperatorVisual
extends Node3D

## Visual TPS en tercera persona. El personaje es el rig modular Quaternius
## "Ultimate Modular Males" (CC0): humano adulto de 1,86 m con proporciones
## reales y prendas que son GEOMETRÍA real (cada prenda es un MeshInstance3D
## del mismo skeleton, activado por visibilidad). Las animaciones son las del
## propio pack (Idle/Walk/Run_Gun/Idle_Aim/Idle_Shoot/Death), autoradas para
## este rig exacto, así que no hay retarget con shear.
##
## Contrato público (consumido por player.gd, bot.gd, lobby.gd, smoke.gd):
## model_root, weapon_mount, muzzle_marker, skeleton, animation_player,
## retarget_ready, set_combat_state, set_showcase_mode, set_equipped_weapon,
## play_death, get_muzzle_global_position.

## Malla derivada del pack modular: mismos 22 huesos y 8 clips, soldada y
## subdividida en Blender para quitar el faceteado y luego decimada a ~48 k
## triángulos (medido: 457 k costaban 31-34 fps en SM_S901E). El original CC0
## se conserva intacto. Herramientas: tools/blender-smooth-character.py y el
## script de decimación documentado en CREDITS.md.
const CHARACTER_SCENE_PATH := "res://assets/models/skins/operator_adult_lod.glb"
const ANIMATION_SOURCE_PATHS := [
	"res://assets/models/animation_library/UAL1_Standard.glb",
	"res://assets/models/animation_library/UAL2_Standard.glb"
]
## Clips propios generados sobre este mismo rig (mismos 22 huesos, sin root
## motion). El pack original no trae recarga ni strafe; ver
## tools/blender-smooth-character.py y el pipeline de clips del repo.
const EXTRA_CLIP_PATHS := [
	"res://assets/models/animation_library/Reload.glb",
	"res://assets/models/animation_library/StrafeLeft.glb",
	"res://assets/models/animation_library/StrafeRight.glb",
	"res://assets/models/animation_library/Land.glb",
	"res://assets/models/animation_library/Flinch.glb",
	"res://assets/models/animation_library/CrouchIdle.glb",
	"res://assets/models/animation_library/CrouchWalk.glb"
]
## Clips que deben repetir en bucle (glTF no lleva el metadato).
const LOOPING_CLIPS := ["StrafeLeft", "StrafeRight", "CrouchIdle", "CrouchWalk"]
const WEAPON_IDS := ["rifle", "pistol", "shotgun", "smg"]

## Cada slot del armario es un conjunto de módulos del pack. Solo un módulo
## por slot puede estar visible: eso es lo que hace que cambiar de prenda
## cambie la silueta y no un tinte.
const MODULE_SLOTS := {
	"top": ["Adventurer_Body", "Beach_Body", "Casual2_Body", "Casual_Body", "Farmer_Body",
		"King_Body", "Punk_Body", "SpaceSuit_Body", "Suit_Body", "Swat_Body", "Worker_Body"],
	"bottom": ["Adventurer_Legs", "Beach_Legs", "Casual2_Legs", "Casual_Legs", "Farmer_Pants",
		"King_Legs", "Punk_Legs", "SpaceSuit_Legs", "Suit_Legs", "Swat_Legs", "Worker_Legs"],
	"shoes": ["Adventurer_Feet", "Beach_Feet", "Casual2_Feet", "Casual_Feet", "Farmer_Feet",
		"King_Feet", "Punk_Feet", "SpaceSuit_Feet", "Suit_Feet", "Swat_Feet", "Worker_Feet"],
	"head": ["Adventurer_Head", "Beach_Head", "Casual2_Head", "Casual_Head", "Farmer_Head",
		"King_Head", "Punk_Head", "SpaceSuit_Head", "Suit_Head", "Swat_Head", "Worker_Head"],
}

## Velocidad de suelo que implica cada clip de locomoción, medida sobre el rig
## (amplitud de la zancada × 2 / duración). Con esto el pie no patina: la
## reproducción se escala a la velocidad real del actor.
const LOCOMOTION_CLIPS := [
	{"clip": "Walk", "implied": 1.32, "min_speed": 0.0},
	{"clip": "Run_Gun", "implied": 2.48, "min_speed": 1.9},
]

## Configuración por arma: silueta, longitud real objetivo en metros y agarre.
## `grip`/`grip_rot` están en espacio del hueso Wrist.R (la mano derecha); el
## asset se normaliza por su dimensión mayor para no depender de las unidades
## arbitrarias de cada modelo descargado.
## static var (no const) para poder calibrar en el laboratorio sin editar
## el archivo en cada iteración.
static var WEAPON_CONFIG := {
	"rifle": {
		"path": "res://assets/models/weapons/real/rifle.glb",
		"length": 0.92,
		"pivot": Vector3(0.0, -0.10, -0.21),
		"asset_rot": Vector3(0.0, 0.0, 0.0),
		"ready": Vector3(0.14, -0.06, 0.20),
		"aim": Vector3(0.08, 0.05, 0.26),
		"grip": Vector3(0.0, -0.02, 0.02),
		"wrist_rot": Vector3(0.0, 0.0, 0.0),
		"foregrip": Vector3(0.0, 0.06, 0.20),
		"muzzle": Vector3(0.0, 0.0, 0.46),
	},
	"pistol": {
		"path": "res://assets/models/weapons/real/desert_eagle_dec.glb",
		"length": 0.27,
		"pivot": Vector3(0.0, -0.06, 0.07),
		"asset_rot": Vector3(0.0, 0.0, 0.0),
		"ready": Vector3(0.17, -0.08, 0.22),
		"aim": Vector3(0.09, 0.05, 0.30),
		"grip": Vector3(0.0, -0.015, 0.0),
		"wrist_rot": Vector3(0.0, 0.0, 0.0),
		"foregrip": Vector3(-0.02, 0.02, 0.045),
		"muzzle": Vector3(0.0, 0.0, 0.13),
	},
	"shotgun": {
		"path": "res://assets/models/weapons/real/shotgun.glb",
		"length": 1.05,
		"pivot": Vector3(-0.264, 0.10, 0.0),
		"asset_rot": Vector3(0.0, -90.0, 0.0),
		"ready": Vector3(0.14, -0.06, 0.20),
		"aim": Vector3(0.08, 0.05, 0.26),
		"grip": Vector3(0.0, -0.02, 0.02),
		"wrist_rot": Vector3(0.0, 0.0, 0.0),
		"foregrip": Vector3(0.0, 0.06, 0.22),
		"muzzle": Vector3(0.0, 0.0, 0.52),
	},
	"smg": {
		"path": "res://assets/models/weapons/real/mpx_smg.glb",
		"length": 0.62,
		"pivot": Vector3(0.0, -0.08, 0.08),
		"asset_rot": Vector3(0.0, 0.0, 0.0),
		"ready": Vector3(0.14, -0.06, 0.18),
		"aim": Vector3(0.08, 0.05, 0.24),
		"grip": Vector3(0.0, -0.02, 0.02),
		"wrist_rot": Vector3(0.0, 0.0, 0.0),
		"foregrip": Vector3(0.0, 0.06, 0.18),
		"muzzle": Vector3(0.0, 0.0, 0.31),
	},
}

## El arma se ancla al pecho, no a la muñeca derecha: las manos van al arma
## (IK) y no al revés. Así el agarre de dos manos es posible con la longitud
## real de brazo de este rig y la boca de cañón es estable al apuntar.
const CHEST_BONE := "Chest"
## Distancia del hueso de muñeca al centro de la palma en este rig.
const PALM_OFFSET := 0.075
## Cuánto baja la raíz al morir para que el cuerpo quede apoyado en el suelo.
const DEATH_DROP := -0.05
## Defecto del pack UMC: los vértices de las manos vienen rígidos al hueso Root
## (x bind >0,60, slab y≈1,39-1,46), así que las manos no siguen al brazo y la
## piel se estira al apuntar. Se reasignan a Wrist.L/R al cargar.
const HAND_BIND_MIN_X := 0.60
const HAND_BIND_MIN_Y := 1.30
const HAND_BIND_MAX_Y := 1.55
const AIM_BLEND_SPEED := 9.0

var operator_id := "BRAVO"
var team := "ally"
var is_human := false
var accent := Color("#4fd6e9")
var loadout: Dictionary = {}
var model_root: Node3D
var weapon_mount: Node3D
var muzzle_marker: Marker3D
var skeleton: Skeleton3D
var animation_player: AnimationPlayer
var showcase_mode := false
var showcase_weapon_skin := "Estándar"
var equipped_weapon_id := "rifle"
var moving := false
var firing := false
var aiming := false
var dead := false
var locomotion_speed_scale := 1.0
var retarget_ready := false
## Interruptor de diagnóstico para comparar con/sin IK de mano izquierda.
var ik_enabled := true
## Congela el clip para inspeccionar un instante exacto (laboratorio).
var debug_hold_animation := false
## Fuerza la pose de recarga en el laboratorio (no tiene arma padre).
var debug_force_reload := false
## Laboratorio: yaw/pitch de mirada sin actor padre (grados).
var debug_head_look := Vector2.ZERO
var _last_locomotion_clip := ""
var _aim_blend := 0.0
## El pack modular no trae clips de recarga ni de salto: se resuelven como
## desplazamientos procedurales del montaje del arma y de los brazos, leídos
## del estado real del WeaponController (no inventan gameplay).
var _reload_blend := 0.0
var _switch_blend := 0.0
var _airborne_blend := 0.0
var crouched := false
var _one_shot := ""
var _weapon_ref: Node = null
var _head_look_yaw := 0.0
var _head_look_pitch := 0.0
## Flinch y aterrizaje: reacciones cortas sin clip propio en el pack.
var _flinch := 0.0
var _land_dip := 0.0
var _was_on_floor := true
var _last_fall_speed := 0.0
var _wardrobe_pending := false
var _ik_left: SkeletonIK3D
var _ik_right: SkeletonIK3D
var _left_target: Marker3D
var _right_target: Marker3D
var _modules: Dictionary = {}
var _skin_materials: Array[StandardMaterial3D] = []
var _accessory_root: Node3D
var _mounted_weapon: Node3D


func configure(id: String, team_id: String, color: Color, cosmetic_loadout: Dictionary = {}, human: bool = false) -> void:
	operator_id = id
	team = team_id
	accent = color
	loadout = cosmetic_loadout
	is_human = human
	_build()


func resolve_default_loadout(role_seed: int = 0) -> Dictionary:
	if not loadout.is_empty():
		return loadout
	if is_human:
		var settings := _settings()
		if settings != null:
			return settings.cosmetic_loadout()
		# Fuera del árbol todavía (player.gd y lobby.gd configuran antes de
		# add_child): un humano nunca debe recibir ropa aleatoria de bot.
		return CosmeticCatalog.default_loadout()
	return CosmeticCatalog.bot_loadout_for(operator_id, "entry", role_seed)


func set_showcase_mode(enabled: bool, weapon_scene: String = "", weapon_skin: String = "") -> void:
	showcase_mode = enabled
	if model_root != null:
		model_root.rotation_degrees.y = 0.0 if enabled else 180.0
	# El lobby presenta el loadout con el arma a la altura del pecho (ready).
	# Forzar la pose de apuntado ponía el arma delante de la cara y el puño
	# tapaba el rostro; el apuntado se reserva para ADS real en partida.
	if not weapon_scene.is_empty():
		equipped_weapon_id = _weapon_id_from_scene(weapon_scene)
	if not weapon_skin.is_empty():
		showcase_weapon_skin = weapon_skin
	if model_root != null:
		_set_team_marker_visible(not showcase_mode)
		_refresh_weapon()
		_refresh_animation_state()


func set_showcase_weapon_skin(weapon_skin: String) -> void:
	showcase_weapon_skin = weapon_skin
	if showcase_mode:
		_refresh_weapon()


func set_equipped_weapon(weapon_id: String, weapon_skin: String = "Estándar") -> void:
	equipped_weapon_id = weapon_id if WEAPON_IDS.has(weapon_id) else "rifle"
	if not weapon_skin.is_empty():
		showcase_weapon_skin = weapon_skin
	_refresh_weapon()


## Agachado real con clip (antes `player.gd` aplastaba el personaje con
## `scale.y = 0.72`, que deformaba toda la malla).
func set_crouch_state(value: bool) -> void:
	if crouched == value:
		return
	crouched = value
	_refresh_animation_state()


func set_combat_state(is_moving: bool, is_firing: bool, is_aiming: bool = false, locomotion_speed: float = 1.0) -> void:
	moving = is_moving
	firing = is_firing
	aiming = is_aiming
	# Velocidad real en metros por segundo (la animación se calibra con ella).
	locomotion_speed_scale = maxf(locomotion_speed, 0.0)
	_refresh_animation_state()


func play_death() -> void:
	dead = true
	_play_native("Death", false)
	if model_root == null:
		return
	# El clip acuesta el cuerpo en espacio de huesos pero no mueve la raíz del
	# actor: sin este descenso el cadáver queda flotando a la altura de pie.
	model_root.position = Vector3.ZERO
	var tween := create_tween()
	tween.tween_property(model_root, "position:y", DEATH_DROP, 0.5).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_IN)


## Sacudida al recibir daño: el gameplay avisa, el visual solo reacciona.
func flinch(strength: float = 1.0) -> void:
	_flinch = clampf(_flinch + strength, 0.0, 1.4)
	if animation_player != null and animation_player.get_animation("ual/Flinch") != null:
		_one_shot = "Flinch"


## Reaparecer: el clip Death deja el cuerpo acostado y `dead` bloqueaba las
## animaciones, así que un bot respawneado seguía mostrándose como cadáver.
func revive() -> void:
	dead = false
	if model_root != null:
		model_root.position = Vector3.ZERO
	_last_locomotion_clip = ""
	_refresh_animation_state()


func get_muzzle_global_position() -> Vector3:
	return muzzle_marker.global_position if muzzle_marker != null else global_position + Vector3(0.0, 1.35, -0.8)


func _ready() -> void:
	if _wardrobe_pending:
		_wardrobe_pending = false
		loadout = resolve_default_loadout()
		_apply_wardrobe()


func _process(delta: float) -> void:
	if animation_player == null or not retarget_ready:
		return
	_update_reload_state(delta)
	_update_airborne_state(delta)
	_update_head_look(delta)
	_update_reaction_pose(delta)
	if not dead:
		_refresh_animation_state()
	_update_weapon_mount(delta)
	if not dead:
		_solve_arms_ik()


func _build() -> void:
	# El IK de la mano izquierda debe escribirse DESPUÉS de que AnimationPlayer
	# haya volcado las poses del clip: prioridad alta = procesado más tarde.
	process_priority = 100
	for child: Node in get_children():
		remove_child(child)
		child.free()
	model_root = Node3D.new()
	model_root.name = "RiggedOperator"
	# El pack mira a +Z y el contrato del actor usa -Z como delante: una sola
	# rotación deja la espalda hacia la cámara de hombro. El modelo ya está en
	# metros (1,86 m), así que no se escala.
	model_root.rotation_degrees.y = 180.0
	add_child(model_root)
	skeleton = null
	animation_player = null
	retarget_ready = false
	dead = false
	_last_locomotion_clip = ""
	_modules.clear()
	_skin_materials.clear()
	_accessory_root = null
	_mounted_weapon = null

	var packed := load(CHARACTER_SCENE_PATH) as PackedScene if ResourceLoader.exists(CHARACTER_SCENE_PATH) else null
	if packed != null:
		var character := packed.instantiate()
		character.name = "CharacterModel"
		model_root.add_child(character)
		_setup_target_rig(character)

	_add_team_marker()
	if weapon_mount == null:
		weapon_mount = Node3D.new()
		weapon_mount.name = "WeaponMount"
		model_root.add_child(weapon_mount)
		muzzle_marker = Marker3D.new()
		muzzle_marker.name = "MuzzleMarker"
		weapon_mount.add_child(muzzle_marker)
	_apply_wardrobe()
	_refresh_weapon()
	_set_team_marker_visible(not showcase_mode)
	_refresh_animation_state()


func _setup_target_rig(character: Node) -> void:
	skeleton = character.find_child("Skeleton3D", true, false) as Skeleton3D
	animation_player = character.find_child("AnimationPlayer", true, false) as AnimationPlayer
	if skeleton == null or animation_player == null:
		return
	_index_modules(character)
	_repair_module_weights(character)
	retarget_ready = true
	_install_extra_clips()

	if skeleton.find_bone(CHEST_BONE) >= 0:
		weapon_mount = Node3D.new()
		weapon_mount.name = "WeaponMount"
		model_root.add_child(weapon_mount)
	else:
		weapon_mount = Node3D.new()
		weapon_mount.name = "WeaponMount"
		model_root.add_child(weapon_mount)
	muzzle_marker = Marker3D.new()
	muzzle_marker.name = "MuzzleMarker"
	weapon_mount.add_child(muzzle_marker)


## Reasigna a las muñecas los vértices que el pack dejó rígidos al hueso Root.
## Es una corrección de datos del asset, no un truco de escala: sin esto las
## manos se quedan en la T-pose mientras el brazo se mueve y la piel se estira.
func _repair_module_weights(character: Node) -> void:
	if skeleton == null:
		return
	var wrist_l := skeleton.find_bone("Wrist.L")
	var wrist_r := skeleton.find_bone("Wrist.R")
	if wrist_l < 0 or wrist_r < 0:
		return
	for candidate: Node in character.find_children("*", "MeshInstance3D", true, false):
		var mesh_instance := candidate as MeshInstance3D
		if mesh_instance == null or mesh_instance.mesh == null:
			continue
		_apply_material_detail(mesh_instance)
		var root_bind := _root_bind_index(mesh_instance)
		if root_bind < 0:
			continue
		_repair_mesh_hands(mesh_instance, root_bind, wrist_l, wrist_r)


func _root_bind_index(mesh_instance: MeshInstance3D) -> int:
	if mesh_instance.skin == null:
		return -1
	for bind in range(mesh_instance.skin.get_bind_count()):
		if String(mesh_instance.skin.get_bind_name(bind)) == "Root":
			return bind
	return -1


func _repair_mesh_hands(mesh_instance: MeshInstance3D, root_bind: int, wrist_l: int, wrist_r: int) -> void:
	var source := mesh_instance.mesh
	if source.get_surface_count() == 0:
		return
	var repaired := ArrayMesh.new()
	var changed := false
	for surface in range(source.get_surface_count()):
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
		for vertex in range(vertices.size()):
			var position := vertices[vertex]
			var hand := absf(position.x) >= HAND_BIND_MIN_X \
					and position.y >= HAND_BIND_MIN_Y and position.y <= HAND_BIND_MAX_Y
			is_hand[vertex] = hand
			if not hand:
				continue
			# El pack deja las manos rígidas al hueso Root: se reasignan a la
			# muñeca para que sigan al brazo en lugar de quedarse en la T-pose.
			if bones[vertex * per_vertex] == root_bind:
				var target_bone := wrist_l if position.x > 0.0 else wrist_r
				for slot in range(per_vertex):
					bones[vertex * per_vertex + slot] = target_bone if slot == 0 else 0
					weights[vertex * per_vertex + slot] = 1.0 if slot == 0 else 0.0
				changed = true
		arrays[Mesh.ARRAY_BONES] = bones
		arrays[Mesh.ARRAY_WEIGHTS] = weights
		if not changed:
			repaired.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arrays)
			repaired.surface_set_material(surface, source.surface_get_material(surface))
			continue
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
	if changed:
		mesh_instance.mesh = repaired


## Promedia las normales de los vértices que comparten posición: el pack viene
## con caras planas (faceteado) y el personaje se leía "de bloques". No cambia
## la topología ni los pesos, solo el sombreado.
func _smooth_normals(vertices: PackedVector3Array, normals: PackedVector3Array) -> PackedVector3Array:
	if normals.size() != vertices.size():
		return normals
	var accumulated: Dictionary = {}
	var keys: PackedStringArray = []
	keys.resize(vertices.size())
	for index in range(vertices.size()):
		var v := vertices[index]
		var key := "%.3f_%.3f_%.3f" % [v.x, v.y, v.z]
		keys[index] = key
		accumulated[key] = (accumulated.get(key, Vector3.ZERO) as Vector3) + normals[index]
	var result := PackedVector3Array()
	result.resize(normals.size())
	for index in range(normals.size()):
		var total: Vector3 = accumulated[keys[index]]
		result[index] = total.normalized() if total.length() > 0.0001 else normals[index]
	return result


## Devuelve los arrays de una superficie sin los triángulos que tocan la mano,
## compactando los vértices supervivientes para no dejar triángulos degenerados.
func _drop_hand_triangles(arrays: Array, is_hand: Array[bool], per_vertex: int) -> Array:
	var vertices: PackedVector3Array = arrays[Mesh.ARRAY_VERTEX]
	var indices := PackedInt32Array()
	if arrays[Mesh.ARRAY_INDEX] != null:
		indices = arrays[Mesh.ARRAY_INDEX]
	else:
		indices.resize(vertices.size())
		for i in range(vertices.size()):
			indices[i] = i
	var bones_source: PackedInt32Array = arrays[Mesh.ARRAY_BONES]
	var weights_source: PackedFloat32Array = arrays[Mesh.ARRAY_WEIGHTS]
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


func _empty_like(source: Variant) -> Variant:
	match typeof(source):
		TYPE_PACKED_VECTOR3_ARRAY: return PackedVector3Array()
		TYPE_PACKED_VECTOR2_ARRAY: return PackedVector2Array()
		TYPE_PACKED_INT32_ARRAY: return PackedInt32Array()
		TYPE_PACKED_FLOAT32_ARRAY: return PackedFloat32Array()
		TYPE_PACKED_COLOR_ARRAY: return PackedColorArray()
	return null


func _append_vertex(source: Array, target: Array, vertex: int, per_vertex: int) -> void:
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


## Puño cerrado de reemplazo: el pack no tiene huesos de dedos, así que la
## mano abierta nunca puede agarrar. Caja biselada + nudillos + pulgar en la
## muñeca, con el material de piel del propio pack para que combine.
func _build_grip_hands() -> void:
	## Los puños se montan en el arma (grip y guardamanos) en vez de en el hueso
	## de la muñeca: así el puño y el agarre coinciden siempre, y el IK de los
	## brazos apunta exactamente a ese punto.
	if weapon_mount == null or skeleton == null:
		return
	for child: Node in weapon_mount.get_children():
		if child.name == "GripHands":
			child.free()
	var hands := Node3D.new()
	hands.name = "GripHands"
	weapon_mount.add_child(hands)
	var skin_material := _hand_material()
	var config: Dictionary = WEAPON_CONFIG.get(equipped_weapon_id, {})
	var grip: Vector3 = config.get("grip", Vector3.ZERO)
	var foregrip: Vector3 = config.get("foregrip", Vector3.ZERO)
	hands.add_child(_make_fist("RightFist", grip, skin_material, false))
	if foregrip != Vector3.ZERO:
		hands.add_child(_make_fist("LeftFist", foregrip, skin_material, true))


func _make_fist(fist_name: String, at: Vector3, skin_material: StandardMaterial3D, mirrored: bool) -> Node3D:
	var fist := Node3D.new()
	fist.name = fist_name
	fist.position = at
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


## Detalle procedural por tipo de material: la ropa y la piel del pack son
## color plano y a distancia se leían como plástico. Se añade una textura de
## detalle generada (tela tejida / poro) sin tocar el asset original.
func _apply_material_detail(mesh_instance: MeshInstance3D) -> void:
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


func _detail_texture(base: float, amplitude: float, woven: bool) -> Texture2D:
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
	return ImageTexture.create_from_image(image)


func _hand_material() -> StandardMaterial3D:
	for mesh_instance: MeshInstance3D in _all_module_meshes():
		if mesh_instance.mesh == null:
			continue
		for surface in range(mesh_instance.mesh.get_surface_count()):
			var material := mesh_instance.get_active_material(surface) as StandardMaterial3D
			if material != null and String(material.resource_name).begins_with("Skin"):
				return material.duplicate() as StandardMaterial3D
	var fallback := StandardMaterial3D.new()
	fallback.albedo_color = Color("#d9a06f")
	return fallback


## Carga los clips propios (recarga, strafe, agachado, flinch, aterrizaje)
## en la biblioteca "ual". Están autorados sobre este mismo rig, así que solo
## hay que reescribir la ruta de pista para que apunte a este Skeleton3D.
func _install_extra_clips() -> void:
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
					_remap_clip_tracks(copied)
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


func _remap_clip_tracks(animation: Animation) -> void:
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


func _index_modules(character: Node) -> void:
	for slot: String in MODULE_SLOTS:
		_modules[slot] = {}
		for module_name: String in MODULE_SLOTS[slot]:
			var mesh_instance := character.find_child(module_name, true, false) as MeshInstance3D
			if mesh_instance != null:
				_modules[slot][module_name] = mesh_instance


## Activa exactamente una prenda por slot según el loadout. Es lo único que
## decide qué geometría se ve; sin item válido se usa el módulo por defecto
## del slot para que el personaje nunca quede desnudo ni invisible.
func _apply_wardrobe() -> void:
	if _modules.is_empty():
		return
	# Un loadout vacío (lobby/humano) se resuelve contra SettingsStore o el
	# conjunto por defecto; nunca se deja al personaje con módulos al azar.
	if loadout.is_empty():
		if is_inside_tree():
			loadout = resolve_default_loadout()
		else:
			# Todavía sin árbol: se viste con el conjunto por defecto y se
			# vuelve a resolver en _ready() cuando SettingsStore es alcanzable.
			_wardrobe_pending = true
			loadout = CosmeticCatalog.default_loadout()
	for slot: String in MODULE_SLOTS:
		var modules: Dictionary = _modules.get(slot, {})
		if modules.is_empty():
			continue
		var wanted := _module_for_slot(slot)
		if wanted.is_empty() or not modules.has(wanted):
			wanted = _default_module_for_slot(slot, modules)
		for module_name: String in modules:
			(modules[module_name] as MeshInstance3D).visible = module_name == wanted
	_apply_skin_tone()
	_rebuild_accessories()


func _module_for_slot(slot: String) -> String:
	var item_id := str(loadout.get(slot, ""))
	if item_id.is_empty():
		return ""
	var item := CosmeticCatalog.item_for(slot, item_id)
	return item.mesh_node if item != null else ""


func _default_module_for_slot(slot: String, modules: Dictionary) -> String:
	match slot:
		"top": return "Casual2_Body" if modules.has("Casual2_Body") else modules.keys()[0]
		"bottom": return "Casual2_Legs" if modules.has("Casual2_Legs") else modules.keys()[0]
		"shoes": return "Casual2_Feet" if modules.has("Casual2_Feet") else modules.keys()[0]
		"head": return "Casual2_Head" if modules.has("Casual2_Head") else modules.keys()[0]
	return modules.keys()[0]


## El tono de piel multiplica los materiales "Skin" del pack (compartidos por
## todos los módulos) sin tocar el resto de la prenda.
func _apply_skin_tone() -> void:
	var item_id := str(loadout.get("skin", ""))
	if item_id.is_empty():
		return
	var item := CosmeticCatalog.item_for("skin", item_id)
	if item == null:
		return
	var target := item.color
	for mesh_instance: MeshInstance3D in _all_module_meshes():
		var surface_count := mesh_instance.mesh.get_surface_count() if mesh_instance.mesh != null else 0
		for surface in range(surface_count):
			var material := mesh_instance.get_active_material(surface) as StandardMaterial3D
			if material == null:
				continue
			if not String(material.resource_name).begins_with("Skin"):
				continue
			var tinted := material.duplicate() as StandardMaterial3D
			tinted.albedo_color = tinted.albedo_color.lerp(target, 0.85)
			mesh_instance.set_surface_override_material(surface, tinted)
			_skin_materials.append(tinted)


func _all_module_meshes() -> Array[MeshInstance3D]:
	var result: Array[MeshInstance3D] = []
	for slot: String in _modules:
		for module_name: String in _modules[slot]:
			var mesh_instance: MeshInstance3D = _modules[slot][module_name]
			if mesh_instance.visible:
				result.append(mesh_instance)
	return result


## Accesorios rígidos (gorra, boina, gafas, máscara) construidos como mallas
## low-poly coherentes con el pack y anclados al hueso Head.
func _rebuild_accessories() -> void:
	if _accessory_root != null and is_instance_valid(_accessory_root):
		_accessory_root.queue_free()
	_accessory_root = null
	if skeleton == null:
		return
	if skeleton.find_bone("Head") < 0:
		return
	var head_attachment := BoneAttachment3D.new()
	head_attachment.name = "HeadAccessories"
	head_attachment.bone_name = "Head"
	skeleton.add_child(head_attachment)
	_accessory_root = head_attachment
	if _loadout_has("headwear", "headwear_cap"):
		_add_cap(head_attachment)
	elif _loadout_has("headwear", "headwear_beret"):
		_add_beret(head_attachment)
	if not str(loadout.get("mask", "")).is_empty():
		_add_mask(head_attachment)
	if not str(loadout.get("eyewear", "")).is_empty():
		_add_glasses(head_attachment)


func _loadout_has(slot: String, item_id: String) -> bool:
	return str(loadout.get(slot, "")) == item_id


func _accessory_material(color: Color) -> StandardMaterial3D:
	var material := StandardMaterial3D.new()
	material.albedo_color = color
	material.roughness = 0.62
	return material


func _add_cap(parent: Node3D) -> void:
	var item := CosmeticCatalog.item_for("headwear", "headwear_cap")
	var color := item.color if item != null else Color("#46536b")
	var cap := Node3D.new()
	cap.name = "Cap"
	var crown := MeshInstance3D.new()
	var sphere := SphereMesh.new()
	sphere.radius = 0.086
	sphere.height = 0.17
	sphere.is_hemisphere = true
	sphere.radial_segments = 14
	sphere.rings = 5
	crown.mesh = sphere
	crown.material_override = _accessory_material(color)
	crown.position = Vector3(0.0, 0.0, 0.0)
	cap.add_child(crown)
	var brim := MeshInstance3D.new()
	var brim_mesh := BoxMesh.new()
	brim_mesh.size = Vector3(0.168, 0.014, 0.098)
	brim.mesh = brim_mesh
	brim.material_override = _accessory_material(color.darkened(0.18))
	brim.position = Vector3(0.0, -0.010, 0.082)
	cap.add_child(brim)
	# El hueso Head nace en el cuello: la corona va ~0,20 m por encima.
	cap.position = Vector3(0.0, 0.192, 0.004)
	cap.rotation_degrees = Vector3(-9.0, 0.0, 0.0)
	parent.add_child(cap)


func _add_beret(parent: Node3D) -> void:
	var item := CosmeticCatalog.item_for("headwear", "headwear_beret")
	var color := item.color if item != null else Color("#5d6b46")
	var beret := MeshInstance3D.new()
	beret.name = "Beret"
	var sphere := SphereMesh.new()
	sphere.radius = 0.082
	sphere.height = 0.09
	sphere.is_hemisphere = true
	sphere.radial_segments = 12
	sphere.rings = 3
	beret.mesh = sphere
	beret.material_override = _accessory_material(color)
	beret.position = Vector3(0.012, 0.186, 0.0)
	beret.rotation_degrees = Vector3(0.0, 0.0, -11.0)
	parent.add_child(beret)


func _add_mask(parent: Node3D) -> void:
	var item := CosmeticCatalog.item_for("mask", str(loadout.get("mask", "")))
	var color := item.color if item != null else Color("#23262e")
	var mask := MeshInstance3D.new()
	mask.name = "Mask"
	var sphere := SphereMesh.new()
	sphere.radius = 0.072
	sphere.height = 0.13
	sphere.radial_segments = 12
	sphere.rings = 5
	mask.mesh = sphere
	mask.material_override = _accessory_material(color)
	mask.scale = Vector3(0.90, 0.64, 0.94)
	mask.position = Vector3(0.0, 0.092, 0.058)
	parent.add_child(mask)


func _add_glasses(parent: Node3D) -> void:
	var item := CosmeticCatalog.item_for("eyewear", str(loadout.get("eyewear", "")))
	var color := item.color if item != null else Color("#1c2026")
	var glasses := Node3D.new()
	glasses.name = "Glasses"
	for side: float in [-1.0, 1.0]:
		var lens := MeshInstance3D.new()
		var lens_mesh := BoxMesh.new()
		lens_mesh.size = Vector3(0.045, 0.026, 0.012)
		lens.mesh = lens_mesh
		lens.material_override = _accessory_material(color)
		lens.position = Vector3(side * 0.034, 0.158, 0.106)
		glasses.add_child(lens)
	var bridge := MeshInstance3D.new()
	var bridge_mesh := BoxMesh.new()
	bridge_mesh.size = Vector3(0.028, 0.008, 0.010)
	bridge.mesh = bridge_mesh
	bridge.material_override = _accessory_material(color)
	bridge.position = Vector3(0.0, 0.158, 0.106)
	glasses.add_child(bridge)
	parent.add_child(glasses)


func _add_team_marker() -> void:
	var ring := MeshInstance3D.new()
	ring.name = "TeamRing"
	var mesh := TorusMesh.new()
	mesh.inner_radius = 0.32
	mesh.outer_radius = 0.36
	ring.mesh = mesh
	ring.position.y = 0.035
	ring.material_override = _ring_material(accent)
	model_root.add_child(ring)


func _set_team_marker_visible(value: bool) -> void:
	var ring := model_root.get_node_or_null("TeamRing") as Node3D if model_root != null else null
	if ring != null:
		ring.visible = value


func _ring_material(color: Color) -> StandardMaterial3D:
	var material := StandardMaterial3D.new()
	material.albedo_color = color
	material.emission_enabled = true
	material.emission = color
	material.emission_energy_multiplier = 0.7
	material.roughness = 0.55
	return material


func _refresh_animation_state() -> void:
	if animation_player == null or not retarget_ready or dead:
		return
	if debug_hold_animation:
		return
	animation_player.speed_scale = 1.0
	if _reload_blend > 0.35 and animation_player.get_animation("ual/Reload") != null:
		# Clip propio de recarga: manda sobre la pose procedural.
		if animation_player.current_animation != "ual/Reload":
			animation_player.play("ual/Reload", 0.12)
		return
	if firing:
		# Idle_Shoot es un one-shot del pack: se rearma al terminar para que
		# mantener FUEGO siga mostrando disparo mientras el controller dispara.
		var shoot := animation_player.get_animation("Idle_Shoot")
		if shoot != null:
			if animation_player.current_animation != "Idle_Shoot" 					or animation_player.current_animation_position >= shoot.length - 0.02:
				animation_player.play("Idle_Shoot", 0.05)
			_last_locomotion_clip = "Idle_Shoot"
		return
	if aiming:
		_play_native("Idle_Aim", true)
		return
	if _one_shot != "":
		var one_shot_path := "ual/" + _one_shot
		var one_shot_anim := animation_player.get_animation(one_shot_path)
		if one_shot_anim == null:
			_one_shot = ""
		elif animation_player.current_animation != one_shot_path:
			_play_native(one_shot_path, false)
		elif animation_player.current_animation_position >= one_shot_anim.length - 0.03:
			_one_shot = ""
		else:
			return
	if crouched:
		var crouch_clip := "CrouchWalk" if moving else "CrouchIdle"
		if animation_player.get_animation("ual/" + crouch_clip) != null:
			animation_player.speed_scale = 1.0
			_play_native("ual/" + crouch_clip, true)
			return
	var strafe := _strafe_clip()
	if strafe != "":
		animation_player.speed_scale = 1.0
		_play_native("ual/" + strafe, true)
		return
	if moving:
		# `locomotion_speed_scale` lleva la velocidad REAL en m/s (contrato
		# actualizado en player.gd/bot.gd): se elige el clip más lento que
		# cubra esa velocidad y se escala su reproducción para no arrastrar
		# los pies (antes: walk a 6,6 m/s con un clip de 1,32 m/s → 3× patinaje).
		var speed := maxf(locomotion_speed_scale, 0.05)
		var chosen: Dictionary = LOCOMOTION_CLIPS[0]
		for candidate: Dictionary in LOCOMOTION_CLIPS:
			if speed >= float(candidate["min_speed"]):
				chosen = candidate
		animation_player.speed_scale = clampf(speed / float(chosen["implied"]), 0.7, 3.1)
		_play_native(str(chosen["clip"]), true)
		return
	_play_native("Idle_Gun", true)


## El arma vive anclada al pecho y las dos manos van al arma. El pack modular
## no trae ninguna pose de dos manos y sus brazos miden 0,42 m de alcance, así
## que sostener el arma extendida es imposible: se sostiene cerca del torso,
## como en la referencia, y el IK coloca muñeca y codo en el arma.
## El arma se baja y se inclina mientras recarga; el brazo izquierdo suelta el
## guardamanos y baja a por el cargador.
func _update_reload_state(delta: float) -> void:
	var weapon := _weapon()
	var reloading := debug_force_reload
	var switching := false
	if weapon != null:
		if not reloading:
			reloading = float(weapon.get("reload_timer")) > 0.0
		switching = float(weapon.get("switching_timer")) > 0.0
	_reload_blend = move_toward(_reload_blend, 1.0 if reloading else 0.0, delta * 7.0)
	# Cambio de arma: se baja y se vuelve a subir en lugar de aparecer de golpe.
	_switch_blend = move_toward(_switch_blend, 1.0 if switching else 0.0, delta * 11.0)


## Salto/aterrizaje: sin clip en el pack, las piernas se recogen al despegar.
func _update_airborne_state(delta: float) -> void:
	var actor := get_parent()
	var airborne := false
	if actor != null and actor is CharacterBody3D:
		airborne = not (actor as CharacterBody3D).is_on_floor() and absf((actor as CharacterBody3D).velocity.y) > 0.6
	_airborne_blend = move_toward(_airborne_blend, 1.0 if airborne else 0.0, delta * 5.0)
	if _airborne_blend > 0.001:
		_pose_airborne(_airborne_blend)


func _pose_airborne(weight: float) -> void:
	if skeleton == null:
		return
	for pair: Array in [["UpperLeg.L", -0.55], ["UpperLeg.R", -0.35], ["LowerLeg.L", 0.75], ["LowerLeg.R", 0.55]]:
		var index := skeleton.find_bone(str(pair[0]))
		if index < 0:
			continue
		var local := skeleton.get_bone_pose(index)
		var extra := Basis(Vector3.RIGHT, float(pair[1]) * weight)
		skeleton.set_bone_pose_rotation(index, (extra * local.basis).get_rotation_quaternion())


## La cabeza sigue el punto de mira sin girar el cuerpo: el torso lo controla
## el gameplay y una cabeza rígida delataba que el personaje era un maniquí.
func _update_head_look(delta: float) -> void:
	if skeleton == null:
		return
	var head := skeleton.find_bone("Head")
	if head < 0:
		return
	var aim_yaw := debug_head_look.x
	var aim_pitch := debug_head_look.y
	var actor := get_parent()
	if actor != null and actor.get("look_yaw") != null:
		aim_yaw = float(actor.get("look_yaw"))
		aim_pitch = float(actor.get("look_pitch"))
		var body_yaw := rad_to_deg((actor as Node3D).rotation.y)
		aim_yaw = wrapf(aim_yaw - body_yaw, -180.0, 180.0)
	elif actor != null:
		return
	_head_look_yaw = lerpf(_head_look_yaw, clampf(aim_yaw, -62.0, 62.0), clampf(delta * 7.0, 0.0, 1.0))
	_head_look_pitch = lerpf(_head_look_pitch, clampf(aim_pitch * 0.45, -22.0, 22.0), clampf(delta * 7.0, 0.0, 1.0))
	var local := skeleton.get_bone_pose(head)
	var yaw_basis := Basis(Vector3.UP, deg_to_rad(_head_look_yaw))
	var pitch_basis := Basis(Vector3.RIGHT, deg_to_rad(-_head_look_pitch))
	skeleton.set_bone_pose_rotation(head, (yaw_basis * pitch_basis * local.basis).get_rotation_quaternion())


## Flinch (torso atrás) y absorción de aterrizaje (flexión de piernas + bajada
## del cuerpo). Se resuelven sobre los huesos que ya controlamos.
func _update_reaction_pose(delta: float) -> void:
	if skeleton == null:
		return
	var actor := get_parent()
	if actor is CharacterBody3D:
		var body := actor as CharacterBody3D
		var on_floor := body.is_on_floor()
		if on_floor and not _was_on_floor:
			_land_dip = clampf(absf(_last_fall_speed) * 0.035, 0.0, 0.32)
			if _land_dip > 0.06 and animation_player != null and animation_player.get_animation("ual/Land") != null:
				_one_shot = "Land"
		if not on_floor:
			_last_fall_speed = body.velocity.y
		_was_on_floor = on_floor
	_flinch = move_toward(_flinch, 0.0, delta * 2.6)
	_land_dip = move_toward(_land_dip, 0.0, delta * 1.6)
	if _flinch <= 0.001 and _land_dip <= 0.001:
		return
	var chest := skeleton.find_bone("Chest")
	if chest >= 0 and _flinch > 0.001:
		var local := skeleton.get_bone_pose(chest)
		var lean := Basis(Vector3.RIGHT, deg_to_rad(9.0 * _flinch))
		skeleton.set_bone_pose_rotation(chest, (lean * local.basis).get_rotation_quaternion())
	if _land_dip > 0.001:
		for pair: Array in [["UpperLeg.L", -0.5], ["UpperLeg.R", -0.5], ["LowerLeg.L", 0.85], ["LowerLeg.R", 0.85]]:
			var index := skeleton.find_bone(str(pair[0]))
			if index < 0:
				continue
			var local := skeleton.get_bone_pose(index)
			var bend := Basis(Vector3.RIGHT, float(pair[1]) * (_land_dip / 0.32))
			skeleton.set_bone_pose_rotation(index, (bend * local.basis).get_rotation_quaternion())
		if model_root != null:
			model_root.position.y = -_land_dip * 0.5


func _weapon() -> Node:
	if _weapon_ref != null and is_instance_valid(_weapon_ref):
		return _weapon_ref
	var actor := get_parent()
	if actor != null:
		_weapon_ref = actor.get("weapon") as Node
	return _weapon_ref


func _update_weapon_mount(delta: float) -> void:
	if weapon_mount == null or skeleton == null:
		return
	var chest := skeleton.find_bone(CHEST_BONE)
	if chest < 0:
		return
	var config: Dictionary = WEAPON_CONFIG.get(equipped_weapon_id, {})
	var target_blend := 1.0 if (aiming or firing) else 0.0
	_aim_blend = move_toward(_aim_blend, target_blend, delta * AIM_BLEND_SPEED)
	var ready_offset: Vector3 = config.get("ready", Vector3.ZERO)
	var aim_offset: Vector3 = config.get("aim", ready_offset)
	var offset := ready_offset.lerp(aim_offset, _aim_blend)
	if _reload_blend > 0.001:
		offset += Vector3(0.03, -0.13, -0.05) * _reload_blend
	if _switch_blend > 0.001:
		offset += Vector3(0.0, -0.10, -0.04) * _switch_blend
	var chest_global := skeleton.global_transform * skeleton.get_bone_global_pose(chest)
	# Orientación del arma = ejes del personaje, no del hueso Chest (el hueso
	# lleva su propio roll y dejaba el arma vertical). La posición sí sigue al
	# pecho para que acompañe el balanceo de la animación.
	var basis := model_root.global_transform.basis.orthonormalized()
	if _reload_blend > 0.001:
		basis = basis * Basis(Vector3.RIGHT, deg_to_rad(-16.0 * _reload_blend))
	if _switch_blend > 0.001:
		basis = basis * Basis(Vector3.RIGHT, deg_to_rad(-11.0 * _switch_blend))
	weapon_mount.global_transform = Transform3D(basis, chest_global.origin + basis * offset)


func _solve_arms_ik() -> void:
	if skeleton == null or weapon_mount == null or not ik_enabled or _mounted_weapon == null:
		return
	var config: Dictionary = WEAPON_CONFIG.get(equipped_weapon_id, {})
	var grip_world := weapon_mount.global_transform * (config.get("grip", Vector3.ZERO) as Vector3)
	var foregrip_world := weapon_mount.global_transform * (config.get("foregrip", Vector3.ZERO) as Vector3)
	_solve_arm_ik("R", grip_world, Vector3(-0.55, -1.0, -0.30))
	if _reload_blend > 0.35 and animation_player != null \
			and animation_player.get_animation("ual/Reload") != null:
		# El clip de recarga ya mueve ambos brazos: no los sobreescribas.
		return
	if _reload_blend > 0.35:
		# La mano izquierda va al cargador (cadera) mientras recarga.
		var chest_index := skeleton.find_bone(CHEST_BONE)
		var chest_global := skeleton.global_transform * skeleton.get_bone_global_pose(chest_index)
		var hip_target := chest_global * Vector3(0.16, -0.42, 0.10)
		_solve_arm_ik("L", hip_target, Vector3(0.55, -1.0, -0.30))
		return
	_solve_arm_ik("L", foregrip_world, Vector3(0.55, -1.0, -0.30))


func _solve_arm_ik(side: String, target_world: Vector3, pole: Vector3) -> void:
	var upper := skeleton.find_bone("UpperArm." + side)
	var lower := skeleton.find_bone("LowerArm." + side)
	var wrist := skeleton.find_bone("Wrist." + side)
	if upper < 0 or lower < 0 or wrist < 0:
		return
	var target := skeleton.global_transform.affine_inverse() * target_world
	# La malla de la mano sobresale ~7 cm del hueso de muñeca: el IK apunta a
	# la PALMA (objetivo retrocedido a lo largo del brazo), no a la muñeca,
	# para que el arma caiga dentro de la mano y no delante de los dedos.
	var shoulder := skeleton.get_bone_global_pose(upper).origin
	var to_target := target - shoulder
	if to_target.length() > 0.001:
		target -= to_target.normalized() * PALM_OFFSET
	_two_bone_ik(upper, lower, wrist, target, pole)


func _two_bone_ik(root_idx: int, mid_idx: int, end_idx: int, target: Vector3, pole: Vector3) -> void:
	var root_pose := skeleton.get_bone_global_pose(root_idx)
	var mid_pose := skeleton.get_bone_global_pose(mid_idx)
	var end_pose := skeleton.get_bone_global_pose(end_idx)
	var s := root_pose.origin
	var e := mid_pose.origin
	var w := end_pose.origin
	var l1 := s.distance_to(e)
	var l2 := e.distance_to(w)
	if l1 <= 0.0001 or l2 <= 0.0001:
		return
	var to_target := target - s
	var d := clampf(to_target.length(), 0.001, l1 + l2 - 0.001)
	var dir := to_target / maxf(to_target.length(), 0.0001)
	var axis := dir.cross(pole.normalized())
	if axis.length() < 0.001:
		axis = dir.cross(Vector3.RIGHT)
	axis = axis.normalized()
	var cos_a := clampf((l1 * l1 + d * d - l2 * l2) / (2.0 * l1 * d), -1.0, 1.0)
	var elbow_dir := dir.rotated(axis, acos(cos_a))
	var elbow := s + elbow_dir * l1
	var root_delta := _rotation_between(e - s, elbow - s)
	var new_root := Transform3D(Basis(root_delta) * root_pose.basis, s)
	# La dirección del antebrazo se mide DESPUÉS de la rotación del hombro.
	var mid_delta := _rotation_between(root_delta * (w - e), target - elbow)
	var new_mid := Transform3D(Basis(mid_delta) * Basis(root_delta) * mid_pose.basis, elbow)
	var parent_global := Transform3D.IDENTITY
	var parent_idx := skeleton.get_bone_parent(root_idx)
	if parent_idx >= 0:
		parent_global = skeleton.get_bone_global_pose(parent_idx)
	var local_root := parent_global.affine_inverse() * new_root
	var local_mid := new_root.affine_inverse() * new_mid
	# Solo rotación: la longitud del hueso en un rig skinned es fija.
	skeleton.set_bone_pose_rotation(root_idx, local_root.basis.get_rotation_quaternion())
	skeleton.set_bone_pose_rotation(mid_idx, local_mid.basis.get_rotation_quaternion())
	# Orientación de la muñeca: el pack trae la mano abierta y plana; se gira
	# para que la palma mire al arma en vez de al suelo.
	var wrist_rot: Vector3 = WEAPON_CONFIG.get(equipped_weapon_id, {}).get("wrist_rot", Vector3.ZERO)
	var extra := Basis.from_euler(Vector3(deg_to_rad(wrist_rot.x), deg_to_rad(wrist_rot.y), deg_to_rad(wrist_rot.z)))
	var wrist_local := skeleton.get_bone_pose(end_idx)
	skeleton.set_bone_pose_rotation(end_idx, (extra * wrist_local.basis).get_rotation_quaternion())


func _rotation_between(from: Vector3, to: Vector3) -> Quaternion:
	var a := from.normalized()
	var b := to.normalized()
	if a.length_squared() < 0.0001 or b.length_squared() < 0.0001:
		return Quaternion.IDENTITY
	var dot := clampf(a.dot(b), -1.0, 1.0)
	if dot > 0.9999:
		return Quaternion.IDENTITY
	if dot < -0.9999:
		var fallback := a.cross(Vector3.UP)
		if fallback.length() < 0.001:
			fallback = a.cross(Vector3.RIGHT)
		return Quaternion(fallback.normalized(), PI)
	return Quaternion(a.cross(b).normalized(), acos(dot))


## Clip de desplazamiento lateral según la velocidad local del actor.
func _strafe_clip() -> String:
	if not moving:
		return ""
	var actor := get_parent() as Node3D
	if actor == null:
		return ""
	var velocity := Vector3.ZERO
	if actor is CharacterBody3D:
		velocity = (actor as CharacterBody3D).velocity
	else:
		return ""
	if velocity.length() < 1.2:
		return ""
	var local := actor.global_transform.basis.inverse() * velocity
	if absf(local.x) < absf(local.z) * 1.2:
		return ""
	var clip := "StrafeRight" if local.x > 0.0 else "StrafeLeft"
	return clip if animation_player != null and animation_player.get_animation("ual/" + clip) != null else ""


func _play_native(clip_name: String, loop: bool) -> void:
	if animation_player == null:
		return
	var animation := animation_player.get_animation(clip_name)
	if animation == null:
		# Fallback honesto: si el pack no trae el clip, no se inventa pose.
		if clip_name == "Idle_Gun":
			animation = animation_player.get_animation("Idle")
			clip_name = "Idle"
		if animation == null:
			return
	if _last_locomotion_clip == clip_name and animation_player.is_playing():
		return
	animation.loop_mode = Animation.LOOP_LINEAR if loop else Animation.LOOP_NONE
	animation_player.play(clip_name, 0.14)
	_last_locomotion_clip = clip_name


func _refresh_weapon() -> void:
	if weapon_mount == null:
		return
	# Contenedor persistente: el asset intercambiable vive dentro. Si se
	# recreara "MountedWeapon" en cada cambio, Godot renombraría el nuevo por
	# colisión con el anterior aún en queue_free y los consumidores dejarían
	# de encontrarlo.
	if _mounted_weapon == null or not is_instance_valid(_mounted_weapon):
		_mounted_weapon = Node3D.new()
		_mounted_weapon.name = "MountedWeapon"
		weapon_mount.add_child(_mounted_weapon)
	for child: Node in _mounted_weapon.get_children():
		_mounted_weapon.remove_child(child)
		child.queue_free()
	var config: Dictionary = WEAPON_CONFIG.get(equipped_weapon_id, {})
	var asset := _new_weapon(equipped_weapon_id)
	asset.name = "WeaponAsset"
	var asset_scale := _normalise_weapon(asset, float(config.get("length", 0.9)))
	_mounted_weapon.add_child(asset)
	# El asset se normaliza por su dimensión mayor y se gira a la convención
	# del arma: -Z adelante, +Y arriba. Así grip/foregrip/muzzle son metros
	# legibles iguales para las cuatro categorías.
	asset.scale = Vector3.ONE * asset_scale
	var asset_rotation: Vector3 = config.get("asset_rot", Vector3(0.0, 180.0, 0.0))
	asset.rotation_degrees = asset_rotation
	# Pivote: el origen del asset casi nunca está en el agarre. Se desplaza el
	# asset para que el punto de agarre caiga en el origen del montaje.
	var pivot: Vector3 = config.get("pivot", Vector3.ZERO)
	# `pivot` está en metros del arma ya normalizada; se rota y se compensa.
	asset.position = -(Basis.from_euler(Vector3(
		deg_to_rad(asset_rotation.x), deg_to_rad(asset_rotation.y), deg_to_rad(asset_rotation.z))) * pivot)
	_mounted_weapon.position = Vector3.ZERO
	_mounted_weapon.rotation = Vector3.ZERO
	WeaponSkin.apply(asset, showcase_weapon_skin)
	_build_grip_hands()
	if muzzle_marker != null:
		muzzle_marker.position = config.get("muzzle", Vector3(0.0, 0.0, -0.45))
		muzzle_marker.rotation = Vector3.ZERO


## Escala el asset para que su dimensión mayor mida `target_length` metros.
## Evita los factores mágicos por modelo: los GLB descargados llegan en
## centímetros, pulgadas o unidades arbitrarias según el exportador.
func _normalise_weapon(asset: Node3D, target_length: float) -> float:
	var bounds := _node_aabb(asset)
	var longest := maxf(bounds.size.x, maxf(bounds.size.y, bounds.size.z))
	if longest <= 0.0001 or target_length <= 0.0:
		return 1.0
	return target_length / longest


## AABB en el espacio del propio nodo raíz del asset. `get_aabb()` devuelve el
## AABB en espacio de malla, que en estos GLB está rotado por el nodo; medir
## ahí hacía girar el arma a vertical y colocarla mal.
func _node_aabb(node: Node3D) -> AABB:
	var bounds := AABB()
	var first := true
	for candidate: Node in node.find_children("*", "MeshInstance3D", true, false):
		var mesh_instance := candidate as MeshInstance3D
		if mesh_instance == null or mesh_instance.mesh == null:
			continue
		var to_root := Transform3D.IDENTITY
		var walker: Node = mesh_instance
		while walker != null and walker != node:
			to_root = (walker as Node3D).transform * to_root
			walker = walker.get_parent()
		var local := to_root * mesh_instance.get_aabb()
		if first:
			bounds = local
			first = false
		else:
			bounds = bounds.merge(local)
	return bounds


func _new_weapon(weapon_id: String) -> Node3D:
	var config: Dictionary = WEAPON_CONFIG.get(weapon_id, {})
	var asset_path := str(config.get("path", ""))
	var packed := load(asset_path) as PackedScene if not asset_path.is_empty() and ResourceLoader.exists(asset_path) else null
	if packed != null:
		var asset := packed.instantiate() as Node3D
		if asset != null:
			return asset
	# Sin asset licenciado no se sustituye por una primitiva: el hueco vacío es
	# la señal honesta de que falta el modelo de esa categoría.
	return Node3D.new()


func _weapon_id_from_scene(scene_path: String) -> String:
	var path := scene_path.to_lower()
	if path.contains("pistol") or path.contains("eagle"): return "pistol"
	if path.contains("shotgun"): return "shotgun"
	if path.contains("smg") or path.contains("mpx"): return "smg"
	return "rifle"


func _settings() -> Node:
	return get_node_or_null("/root/SettingsStore") if is_inside_tree() else null
