class_name OperatorVisual
extends Node3D

## Apariencia del avatar (jugador y bots). El jugador ya no tiene héroes:
## BRAVO/VULTURE/TALON/DUNE/HAVOC quedan deprecados y el id solo decide la
## variación determinista de los bots. La identidad visible vive en la ROPA
## (CosmeticCatalog sobre el rig modular compartido) y en un pequeño accesorio
## de equipo (banda en el brazo), nunca en un aro gigante ni un tinte global.
## Rig: assets/models/quaternius_modular/avatar_rig.gltf (CC0, Quaternius
## Ultimate Modular Characters). Un solo Skeleton3D; top/bottom/shoes/head se
## activan por visibilidad; accesorios rígidos cuelgan de BoneAttachment3D.

const AVATAR_SCENE := "res://assets/models/quaternius_modular/avatar_rig.gltf"

## Escala del rig modular (altura ~1.97 unidades) al tamaño de gameplay (~1.75).
const MODEL_SCALE := 0.885
const MODEL_Y_OFFSET := 0.0

const BAND_COLOR_ALLY := Color("#f0a064")
const BAND_COLOR_ENEMY := Color("#da4f68")

var operator_id: String = "BRAVO"
var team: String = "ally"
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

## Índice de skin del skeleton (una sola copia compartida por instancias del
## mismo PackedScene: Godot instancia Skeleton3D por escena, sin coste extra).
var _attachments: Array[BoneAttachment3D] = []


func configure(id: String, team_id: String, color: Color, cosmetic_loadout: Dictionary = {}) -> void:
	operator_id = id
	team = team_id
	accent = color
	team_band_color = color
	loadout = cosmetic_loadout
	_build()


## Compatibilidad: firma antigua configure(id, team, color) sigue válida.
## Con loadout vacío el jugador usa SettingsStore y los bots usan variación
## determinista por operator_id/role.
func resolve_default_loadout(role_seed: int = 0) -> Dictionary:
	if not loadout.is_empty():
		return loadout
	var settings := _settings()
	if settings != null and team in ["ally", "player"]:
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
	# 4) Accesorios rígidos.
	for slot: String in ["headwear", "eyewear", "mask"]:
		var accessory := CosmeticCatalog.item_for(slot, String(effective.get(slot, "")))
		if accessory != null:
			_add_accessory(accessory)


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
			material.albedo_color = tone
			mesh_instance.set_surface_override_material(surface_index, material)


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
	var mesh := BoxMesh.new()
	mesh.size = Vector3(0.16, 0.035, 0.035)
	return mesh


func _mask_mesh() -> Mesh:
	var mesh := BoxMesh.new()
	mesh.size = Vector3(0.13, 0.11, 0.06)
	return mesh


func _cap_mesh() -> Mesh:
	var mesh := SphereMesh.new()
	mesh.radius = 0.115
	mesh.height = 0.10
	return mesh


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
