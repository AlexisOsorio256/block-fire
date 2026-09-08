class_name OperatorVisual
extends Node3D

## Apariencia del avatar (jugador y bots). El jugador ya no tiene héroes:
## BRAVO/VULTURE/TALON/DUNE/HAVOC quedan deprecados y el id solo decide la
## variación determinista de los bots. La identidad visible vive en la ROPA
## (CosmeticCatalog sobre el rig modular compartido) y en un pequeño accesorio
## de equipo (banda en el brazo), nunca en un aro gigante ni un tinte global.
## Rig base: assets/models/quaternius_modular/avatar_rig.gltf (CC0, Quaternius
## Ultimate Modular Characters). Un Skeleton3D humanoide comparte las
## animaciones y las prendas urbanas; el arsenal visual se monta en la muñeca
## para acompañar Idle/Run/Shoot/Death sin un objeto flotante.

const AVATAR_SCENE := "res://assets/models/quaternius_modular/avatar_rig.gltf"
const WeaponVisualScript := preload("res://game/weapons/weapon_visual.gd")

## Altura importada ~2.0 unidades; esta escala la acerca a la cápsula de 1.8.
const MODEL_SCALE := 0.72
const MODEL_Y_OFFSET := 0.0

const BAND_COLOR_ALLY := Color("#4fd6e9")
const BAND_COLOR_ENEMY := Color("#da4f68")

var operator_id: String = "BRAVO"
var team: String = "ally"
## True solo para el humano local. Los bots nunca heredan el loadout persistido
## aunque compartan team "ally": usan variación determinista propia.
var is_human: bool = false
var accent: Color = BAND_COLOR_ALLY
var model_root: Node3D
var skeleton: Skeleton3D
var animation_player: AnimationPlayer
var animation_state: StringName = &""
## Cosméticos activos: slot -> CosmeticItem (los bots usan su variación;
## el jugador recibe su loadout desde SettingsStore via player.gd).
var loadout: Dictionary = {}
## Color de equipo para la banda/aro pequeño.
var team_band_color: Color = BAND_COLOR_ALLY
## El escaparate del lobby es un estado del visual, no un parche externo: al
## reconstruir el rig conserva el rifle y omite los marcadores de combate.
var showcase_mode: bool = false
var showcase_weapon_scene: String = ""
var showcase_weapon_skin: String = "Estándar"
var _weapon_mount: BoneAttachment3D

## Índice de skin del skeleton (una sola copia compartida por instancias del
## mismo PackedScene: Godot instancia Skeleton3D por escena, sin coste extra).
var _attachments: Array[BoneAttachment3D] = []


func configure(id: String, team_id: String, color: Color, cosmetic_loadout: Dictionary = {}, human: bool = false) -> void:
	operator_id = id
	team = team_id
	accent = color
	team_band_color = color
	loadout = cosmetic_loadout
	is_human = human
	_build()


func set_showcase_mode(enabled: bool, weapon_scene: String = "", weapon_skin: String = "") -> void:
	showcase_mode = enabled
	if not weapon_scene.is_empty():
		showcase_weapon_scene = weapon_scene
	if not weapon_skin.is_empty():
		showcase_weapon_skin = weapon_skin
	if skeleton == null or not is_instance_valid(skeleton):
		return
	if showcase_mode:
		_remove_team_markers()
		_remove_mounted_weapon()
		_add_showcase_weapon()
		_apply_showcase_pose()
	else:
		_remove_mounted_weapon()
		_add_team_marker()


func set_showcase_weapon_skin(weapon_skin: String) -> void:
	showcase_weapon_skin = weapon_skin
	if not showcase_mode or skeleton == null or not is_instance_valid(skeleton):
		return
	_remove_mounted_weapon()
	_add_showcase_weapon()
	_apply_showcase_pose()


## Compatibilidad: firma antigua configure(id, team, color) sigue válida.
## El humano usa su loadout persistido; los bots usan variación determinista
## propia por operator_id/role. No se usa el string de team para decidir.
func resolve_default_loadout(role_seed: int = 0) -> Dictionary:
	if not loadout.is_empty():
		return loadout
	if is_human:
		var settings := _settings()
		if settings != null:
			return settings.cosmetic_loadout()
	return CosmeticCatalog.bot_loadout_for(operator_id, "entry", role_seed)


func set_combat_state(moving: bool, firing: bool) -> void:
	if animation_player == null or not is_instance_valid(animation_player):
		return
	var desired: StringName = &"Idle"
	if firing and moving:
		desired = &"Run_Shoot"
	elif firing:
		desired = &"Idle_Shoot"
	elif moving:
		desired = &"Run_Gun"
	_play_animation(desired)


func play_death() -> void:
	_play_animation(&"Death")


func _build() -> void:
	for child: Node in get_children():
		child.free()
	model_root = null
	skeleton = null
	animation_player = null
	animation_state = &""
	_attachments.clear()
	var effective := loadout if not loadout.is_empty() else resolve_default_loadout(hash(operator_id) + hash(name))
	var packed := load(AVATAR_SCENE) as PackedScene
	if packed != null:
		model_root = packed.instantiate() as Node3D
	if model_root != null:
		add_child(model_root)
		model_root.scale = Vector3.ONE * MODEL_SCALE
		model_root.position.y = MODEL_Y_OFFSET
		skeleton = _find_skeleton(model_root)
		_find_animation_player()
		_apply_loadout(effective)
		_play_animation(&"Idle")
		if showcase_mode:
			_add_showcase_weapon()
			_apply_showcase_pose()
		else:
			_add_team_marker()
		return
	_build_fallback()


func _find_skeleton(node: Node) -> Skeleton3D:
	if node is Skeleton3D:
		return node
	for child: Node in node.get_children():
		var found := _find_skeleton(child)
		if found != null:
			return found
	return null


func _find_animation_player() -> void:
	for candidate: Node in model_root.find_children("*", "AnimationPlayer", true, false):
		animation_player = candidate as AnimationPlayer
		if animation_player != null:
			return


func _play_animation(animation_name: StringName) -> void:
	if animation_player == null or not is_instance_valid(animation_player):
		return
	if not animation_player.has_animation(animation_name):
		return
	if animation_state == animation_name and animation_player.is_playing():
		return
	animation_state = animation_name
	animation_player.play(animation_name, 0.12)
	animation_player.speed_scale = 1.0


## Activa una prenda deformable del rig modular y desactiva las demás de su slot.
func _apply_loadout(effective: Dictionary) -> void:
	if skeleton == null:
		return
	if model_root.find_child("Body", true, false) != null and model_root.find_child("Head", true, false) != null:
		_apply_toon_shooter_loadout(effective)
		return
	# 1) Todo oculto salvo lo pedido: primero apagamos TODAS las prendas.
	for child: Node in skeleton.get_children():
		if child is MeshInstance3D:
			(child as MeshInstance3D).visible = false
	# 2) Slots deformables: head/top/bottom/shoes. Un solo mesh por slot.
	for slot: String in ["head", "top", "bottom", "shoes"]:
		var item := CosmeticCatalog.item_for(slot, String(effective.get(slot, "")))
		if item == null or item.mesh_node.is_empty():
			# Fallback: el cuerpo necesita top/bottom/shoes siempre.
			item = CosmeticCatalog.item_for(slot, _fallback_for(slot))
		if item == null:
			continue
		var mesh_instance := skeleton.get_node_or_null(NodePath(item.mesh_node)) as MeshInstance3D
		if mesh_instance != null:
			mesh_instance.visible = true
	# 3) Tinte de piel en los materiales Skin de la cabeza.
	var skin_item := CosmeticCatalog.item_for("skin", String(effective.get("skin", "")))
	if skin_item != null:
		_tint_skin(skin_item.color)
	# 3b) Reparación causal: el rig UMC llegó con baseColorFactor alfa 0 en los
	# 37 materiales (invisibles con alpha scissor). Se fuerza opaco por instancia
	# sin tocar el material importado compartido.
	_repair_avatar_materials()
	# 4) Accesorios rígidos.
	for slot: String in ["headwear", "eyewear", "mask"]:
		var accessory := CosmeticCatalog.item_for(slot, String(effective.get(slot, "")))
		if accessory != null:
			_add_accessory(accessory)


func _apply_toon_shooter_loadout(effective: Dictionary) -> void:
	# El pack Toon Shooter trae varias armas de ejemplo colgadas del dedo. Se
	# ocultan para que WeaponController/attach_weapon_to_hand sea el único dueño
	# del arma visible y no haya dos representaciones compitiendo.
	var weapon_meshes := [
		"AK", "GrenadeLauncher", "Knife_1", "Knife_2", "Pistol", "Revolver",
		"Revolver_Small", "RocketLauncher", "ShortCannon", "Shotgun", "Shovel",
		"SMG", "Sniper", "Sniper_2"
	]
	for node: Node in model_root.find_children("*", "MeshInstance3D", true, false):
		var mesh_instance := node as MeshInstance3D
		mesh_instance.visible = node.name in ["Head", "Body", "ShoulderPad_L", "ShoulderPad_R"]
	for weapon_name: String in weapon_meshes:
		var weapon_node := model_root.find_child(weapon_name, true, false)
		if weapon_node is MeshInstance3D:
			(weapon_node as MeshInstance3D).visible = false

	# La ropa sigue siendo una decisión visible: el rig integrado se tiñe por
	# familia de outfit y por pantalón, sin mezclar prendas incompatibles.
	var top_color := _toon_outfit_color(String(effective.get("top", "top_swat")))
	var bottom_color := _toon_outfit_color(String(effective.get("bottom", "bottom_swat")))
	var outfit_color := top_color.lerp(bottom_color, 0.28)
	for mesh_name: String in ["Body", "ShoulderPad_L", "ShoulderPad_R"]:
		var mesh_node := model_root.find_child(mesh_name, true, false) as MeshInstance3D
		if mesh_node != null:
			_tint_toon_mesh(mesh_node, outfit_color, 0.42)
	var head := model_root.find_child("Head", true, false) as MeshInstance3D
	if head != null:
		# La cabeza del pack tiene una silueta heroica muy grande. Reducirla en la
		# capa visual recupera proporción humana sin tocar cápsula ni hitboxes.
		head.scale = Vector3.ONE * 0.82
		_tint_toon_mesh(head, _toon_head_color(String(effective.get("head", "head_swat"))), 0.28)
		_tint_toon_skin(head, _toon_skin_color(String(effective.get("skin", "skin_light"))))


func _toon_outfit_color(item_id: String) -> Color:
	if item_id.contains("casual"):
		return Color("#756184")
	if item_id.contains("worker"):
		return Color("#ba7e42")
	if item_id.contains("suit"):
		return Color("#3d4d67")
	if item_id.contains("punk"):
		return Color("#8f4b5f")
	if item_id.contains("farmer"):
		return Color("#667b4e")
	if item_id.contains("scifi"):
		return Color("#4a7da5")
	return Color("#466b7d")


func _toon_head_color(item_id: String) -> Color:
	if item_id.contains("punk"):
		return Color("#7e4354")
	if item_id.contains("worker"):
		return Color("#d39a43")
	if item_id.contains("farmer"):
		return Color("#73854a")
	if item_id.contains("casual"):
		return Color("#607d9d")
	return Color("#4b7588")


func _toon_skin_color(item_id: String) -> Color:
	if item_id.contains("medium"):
		return Color("#c99168")
	if item_id.contains("tan"):
		return Color("#aa704e")
	if item_id.contains("dark"):
		return Color("#7f523a")
	return Color("#e0ad82")


func _tint_toon_mesh(mesh_instance: MeshInstance3D, target: Color, strength: float) -> void:
	if mesh_instance.mesh == null:
		return
	for surface_index: int in range(mesh_instance.mesh.get_surface_count()):
		var source := mesh_instance.get_active_material(surface_index)
		if not source is StandardMaterial3D:
			continue
		var material := source.duplicate() as StandardMaterial3D
		material.albedo_color = material.albedo_color.lerp(target, strength)
		mesh_instance.set_surface_override_material(surface_index, material)


func _tint_toon_skin(mesh_instance: MeshInstance3D, tone: Color) -> void:
	if mesh_instance.mesh == null:
		return
	for surface_index: int in range(mesh_instance.mesh.get_surface_count()):
		var source := mesh_instance.get_active_material(surface_index)
		if not source is StandardMaterial3D or String(source.resource_name) != "Skin":
			continue
		var material := source.duplicate() as StandardMaterial3D
		material.albedo_color = tone
		mesh_instance.set_surface_override_material(surface_index, material)


func _fallback_for(slot: String) -> String:
	match slot:
		"head": return "head_swat"
		"top": return "top_swat"
		"bottom": return "bottom_swat"
		"shoes": return "shoes_swat"
	return ""


func _tint_skin(tone: Color) -> void:
	for child: Node in skeleton.get_children():
		var mesh_instance := child as MeshInstance3D
		if mesh_instance == null or not mesh_instance.visible or mesh_instance.mesh == null:
			continue
		if not String(mesh_instance.name).ends_with("_Head"):
			continue
		for surface_index: int in range(mesh_instance.mesh.get_surface_count()):
			var source := mesh_instance.get_active_material(surface_index)
			if source is not StandardMaterial3D:
				continue
			if String(source.resource_name) != "Skin":
				continue
			var material := source.duplicate() as StandardMaterial3D
			tone.a = 1.0
			material.albedo_color = tone
			material.transparency = BaseMaterial3D.TRANSPARENCY_DISABLED
			mesh_instance.set_surface_override_material(surface_index, material)


## Fuerza opaco en todas las prendas visibles del rig modular.
func _repair_avatar_materials() -> void:
	if skeleton == null:
		return
	for child: Node in skeleton.get_children():
		var mesh_instance := child as MeshInstance3D
		if mesh_instance == null or not mesh_instance.visible or mesh_instance.mesh == null:
			continue
		for surface_index: int in range(mesh_instance.mesh.get_surface_count()):
			var source := mesh_instance.get_active_material(surface_index)
			if not (source is StandardMaterial3D):
				continue
			var source_mat := source as StandardMaterial3D
			if source_mat.albedo_color.a >= 0.99 and source_mat.transparency == BaseMaterial3D.TRANSPARENCY_DISABLED:
				continue
			var fixed := source_mat.duplicate() as StandardMaterial3D
			var fixed_color := fixed.albedo_color
			fixed_color.a = 1.0
			fixed.albedo_color = fixed_color
			fixed.transparency = BaseMaterial3D.TRANSPARENCY_DISABLED
			mesh_instance.set_surface_override_material(surface_index, fixed)


## Banda fina en el brazo + aro corto en el suelo: lectura de equipo mínima.
func _add_team_marker() -> void:
	var band := MeshInstance3D.new()
	band.name = "TeamBand"
	var band_mesh := TorusMesh.new()
	band_mesh.inner_radius = 0.075
	band_mesh.outer_radius = 0.105
	band.mesh = band_mesh
	band.rotation_degrees = Vector3(90.0, 0.0, 0.0)
	band.material_override = _material(team_band_color, 0.25)
	var upper_arm := "UpperArm.L" if team in ["ally", "player"] else "UpperArm.R"
	var attachment := BoneAttachment3D.new()
	attachment.name = "TeamBandAttachment"
	if skeleton != null and skeleton.find_bone(upper_arm) >= 0:
		attachment.bone_name = upper_arm
		skeleton.add_child(attachment)
		attachment.add_child(band)
		band.position = Vector3(0.0, -0.12, 0.0)
	else:
		add_child(band)
		band.position = Vector3(0.0, 1.32, -0.09)
	# Aro corto en el suelo (visible desde arriba, no domina la silueta).
	var ring := MeshInstance3D.new()
	ring.name = "TeamRing"
	var ring_mesh := TorusMesh.new()
	ring_mesh.inner_radius = 0.30
	ring_mesh.outer_radius = 0.35
	ring.mesh = ring_mesh
	ring.position = Vector3(0.0, 0.045, 0.0)
	ring.material_override = _material(team_band_color, 0.4)
	add_child(ring)


func _remove_team_markers() -> void:
	var ring := get_node_or_null("TeamRing")
	if ring != null:
		ring.free()
	if skeleton == null or not is_instance_valid(skeleton):
		return
	var band_attachment := skeleton.get_node_or_null("TeamBandAttachment")
	if band_attachment != null:
		band_attachment.free()


func _remove_showcase_weapon() -> void:
	_remove_mounted_weapon()


func _add_showcase_weapon() -> void:
	if showcase_weapon_scene.is_empty():
		return
	var gun := _new_weapon_visual(showcase_weapon_scene)
	if gun == null:
		return
	attach_weapon_to_hand(gun, _weapon_id_from_scene(showcase_weapon_scene), showcase_weapon_skin, true)


## Monta el arma del gameplay en la muñeca del rig. WeaponController conserva
## toda la lógica de daño/cadencia; este método solo posee el transform visual.
## BoneAttachment3D hace que el arma siga Idle_Gun, Run_Gun y Death sin un
## parche por frame ni una copia de la pose del actor.
func attach_weapon_to_hand(weapon: Node3D, weapon_id: String, weapon_skin: String = "Estándar", showcase: bool = false) -> Node3D:
	if weapon == null or skeleton == null or not is_instance_valid(skeleton):
		return weapon
	_remove_mounted_weapon()
	var marker := Node3D.new()
	marker.name = "ShowcaseWeaponAttachment" if showcase else "ThirdPersonWeaponAttachment"
	add_child(marker)
	var mount := _ensure_weapon_mount()
	mount.add_child(weapon)
	weapon.name = "MountedWeapon"
	var pose := _weapon_mount_pose(weapon_id, showcase)
	weapon.position = pose["position"]
	weapon.rotation_degrees = pose["rotation"]
	weapon.scale = Vector3.ONE * float(pose["scale"])
	WeaponSkin.apply(weapon, weapon_skin)
	if showcase:
		_apply_showcase_pose()
	return weapon


func _ensure_weapon_mount() -> BoneAttachment3D:
	if _weapon_mount != null and is_instance_valid(_weapon_mount):
		return _weapon_mount
	_weapon_mount = BoneAttachment3D.new()
	_weapon_mount.name = "WeaponHandMount"
	for bone_name: String in ["Wrist.R", "Index1.R", "LowerArm.R"]:
		if skeleton.find_bone(bone_name) >= 0:
			_weapon_mount.bone_name = bone_name
			break
	skeleton.add_child(_weapon_mount)
	return _weapon_mount


func _remove_mounted_weapon() -> void:
	for marker_name: String in ["ShowcaseWeaponAttachment", "ThirdPersonWeaponAttachment"]:
		var marker := get_node_or_null(marker_name)
		if marker != null:
			marker.free()
	if _weapon_mount != null and is_instance_valid(_weapon_mount):
		for child: Node in _weapon_mount.get_children():
			child.free()


func _apply_showcase_pose() -> void:
	if not showcase_mode:
		return
	if animation_player == null or not is_instance_valid(animation_player):
		return
	var pose: StringName = &"Idle_Shoot" if animation_player.has_animation(&"Idle_Shoot") else &"Idle_Gun"
	_play_animation(pose)


func _new_weapon_visual(scene_path: String) -> Node3D:
	var weapon := WeaponVisualScript.new()
	weapon.configure(_weapon_id_from_scene(scene_path))
	return weapon


func _weapon_id_from_scene(scene_path: String) -> String:
	var path := scene_path.to_lower()
	if path.contains("shotgun"):
		return "shotgun"
	if path.contains("pistol"):
		return "pistol"
	if path.contains("smg"):
		return "smg"
	return "rifle"


func _weapon_mount_pose(weapon_id: String, showcase: bool) -> Dictionary:
	# Las cuatro mallas comparten el mismo eje artesanal: el cañón apunta por +Z.
	# Esta compensación alinea ese eje con la pose de muñeca del rig modular; la
	# geometría ya contiene sus diferencias de escala y proporción por familia.
	var pose := {
		"position": Vector3(0.0, 0.145, -0.055),
		"rotation": Vector3(3.0, 12.0, 60.0),
		"scale": 0.45
	}
	match weapon_id:
		"pistol":
			pose["position"] = Vector3(0.0, 0.136, -0.055)
			pose["scale"] = 0.42
		"shotgun":
			pose["position"] = Vector3(0.0, 0.135, -0.07)
			pose["scale"] = 0.45
		"smg":
			pose["position"] = Vector3(0.0, 0.14, -0.055)
			pose["scale"] = 0.44
	if showcase:
		pose["scale"] = float(pose["scale"]) * 1.08
	return pose


func _add_accessory(item: CosmeticItem) -> void:
	if skeleton == null or skeleton.find_bone(item.attachment_bone) < 0:
		return
	var attachment := BoneAttachment3D.new()
	attachment.bone_name = item.attachment_bone
	skeleton.add_child(attachment)
	_attachments.append(attachment)
	var accessory := MeshInstance3D.new()
	match item.slot:
		"eyewear":
			accessory.mesh = _eyewear_mesh()
			accessory.material_override = _material(item.color, 0.0)
			accessory.scale = Vector3.ONE * 0.92
		"mask":
			accessory.mesh = _mask_mesh()
			accessory.material_override = _material(item.color, 0.0)
		"headwear":
			accessory.mesh = _cap_mesh()
			accessory.material_override = _material(item.color, 0.0)
			accessory.scale = Vector3.ONE * 0.98
	attachment.add_child(accessory)
	accessory.position = item.attachment_offset
	accessory.rotation_degrees = item.attachment_rotation_deg
	accessory.scale *= item.attachment_scale


func _eyewear_mesh() -> Mesh:
	var tool := SurfaceTool.new()
	tool.begin(Mesh.PRIMITIVE_TRIANGLES)
	_append_rounded_prism(tool, Vector3(-0.062, 0.0, 0.0), Vector3(0.09, 0.045, 0.025), 0.012)
	_append_rounded_prism(tool, Vector3(0.062, 0.0, 0.0), Vector3(0.09, 0.045, 0.025), 0.012)
	_append_rounded_prism(tool, Vector3(0.0, 0.0, 0.0), Vector3(0.042, 0.016, 0.022), 0.006)
	_append_rounded_prism(tool, Vector3(-0.125, 0.0, 0.006), Vector3(0.045, 0.012, 0.018), 0.004)
	_append_rounded_prism(tool, Vector3(0.125, 0.0, 0.006), Vector3(0.045, 0.012, 0.018), 0.004)
	tool.generate_normals()
	return tool.commit()


func _mask_mesh() -> Mesh:
	var tool := SurfaceTool.new()
	tool.begin(Mesh.PRIMITIVE_TRIANGLES)
	_append_profile(tool, PackedVector2Array([
		Vector2(-0.105, 0.065), Vector2(0.105, 0.065), Vector2(0.12, 0.015),
		Vector2(0.09, -0.075), Vector2(-0.09, -0.075), Vector2(-0.12, 0.015)
	]), 0.055, 0.0)
	# Una costura fina da lectura de tela sin añadir otro nodo ni una textura
	# compartida que pueda contaminar los materiales del rig.
	_append_rounded_prism(tool, Vector3(0.0, 0.018, -0.031), Vector3(0.19, 0.012, 0.008), 0.003)
	tool.generate_normals()
	return tool.commit()


func _cap_mesh() -> Mesh:
	var tool := SurfaceTool.new()
	tool.begin(Mesh.PRIMITIVE_TRIANGLES)
	var sides := 12
	var rings := 4
	var center_y := 0.0
	var radius := 0.12
	for ring_index: int in range(rings):
		var y0 := float(ring_index) * 0.026
		var y1 := float(ring_index + 1) * 0.026
		var r0 := radius * (1.0 - float(ring_index) * 0.12)
		var r1 := radius * (1.0 - float(ring_index + 1) * 0.12)
		for side: int in sides:
			var next := (side + 1) % sides
			var a0 := TAU * float(side) / float(sides)
			var a1 := TAU * float(next) / float(sides)
			var p00 := Vector3(cos(a0) * r0, center_y + y0, sin(a0) * r0)
			var p01 := Vector3(cos(a1) * r0, center_y + y0, sin(a1) * r0)
			var p10 := Vector3(cos(a0) * r1, center_y + y1, sin(a0) * r1)
			var p11 := Vector3(cos(a1) * r1, center_y + y1, sin(a1) * r1)
			_add_triangle(tool, p00, p10, p11)
			_add_triangle(tool, p00, p11, p01)
	var brim := PackedVector2Array([
		Vector2(-0.15, -0.045), Vector2(0.15, -0.045), Vector2(0.13, 0.025),
		Vector2(-0.13, 0.025)
	])
	_append_profile(tool, brim, 0.025, -0.10)
	tool.generate_normals()
	return tool.commit()


func _append_rounded_prism(tool: SurfaceTool, center: Vector3, dimensions: Vector3, bevel: float) -> void:
	var half := Vector2(dimensions.x * 0.5, dimensions.y * 0.5)
	var b := clampf(bevel, 0.0, minf(half.x, half.y) * 0.8)
	var points := PackedVector2Array([
		Vector2(-half.x + b, -half.y), Vector2(half.x - b, -half.y),
		Vector2(half.x, -half.y + b), Vector2(half.x, half.y - b),
		Vector2(half.x - b, half.y), Vector2(-half.x + b, half.y),
		Vector2(-half.x, half.y - b), Vector2(-half.x, -half.y + b)
	])
	_append_profile(tool, points, dimensions.z, center.z, Vector2(center.x, center.y))


func _append_profile(tool: SurfaceTool, points: PackedVector2Array, depth: float, z_center: float, offset: Vector2 = Vector2.ZERO) -> void:
	if points.size() < 3:
		return
	var front := z_center - depth * 0.5
	var back := z_center + depth * 0.5
	for index: int in range(1, points.size() - 1):
		_add_triangle(tool, _accessory_point(points[0], front, offset), _accessory_point(points[index + 1], front, offset), _accessory_point(points[index], front, offset))
		_add_triangle(tool, _accessory_point(points[0], back, offset), _accessory_point(points[index], back, offset), _accessory_point(points[index + 1], back, offset))
	for index: int in points.size():
		var next := (index + 1) % points.size()
		_add_triangle(tool, _accessory_point(points[index], front, offset), _accessory_point(points[index], back, offset), _accessory_point(points[next], back, offset))
		_add_triangle(tool, _accessory_point(points[index], front, offset), _accessory_point(points[next], back, offset), _accessory_point(points[next], front, offset))


func _accessory_point(point: Vector2, z: float, offset: Vector2) -> Vector3:
	return Vector3(point.x + offset.x, point.y + offset.y, z)


func _add_triangle(tool: SurfaceTool, a: Vector3, b: Vector3, c: Vector3) -> void:
	tool.add_vertex(a)
	tool.add_vertex(b)
	tool.add_vertex(c)


func _build_fallback() -> void:
	var body := MeshInstance3D.new()
	var capsule := CapsuleMesh.new()
	capsule.height = 1.45
	capsule.radius = 0.30
	body.mesh = capsule
	body.position.y = 1.0
	body.material_override = _material(Color("#4a5568"), 0.0)
	add_child(body)
	var head := MeshInstance3D.new()
	var head_mesh := SphereMesh.new()
	head_mesh.height = 0.42
	head_mesh.radius = 0.21
	head.mesh = head_mesh
	head.position.y = 1.9
	head.material_override = _material(Color("#d4a27f"), 0.0)
	add_child(head)
	_add_team_marker()


func _material(color: Color, emission_energy: float) -> StandardMaterial3D:
	var material := StandardMaterial3D.new()
	material.albedo_color = color
	material.roughness = 0.72
	if emission_energy > 0.0:
		material.emission_enabled = true
		material.emission = color
		material.emission_energy_multiplier = emission_energy
	return material


func _settings() -> Node:
	return get_node_or_null("/root/SettingsStore") if is_inside_tree() else null
