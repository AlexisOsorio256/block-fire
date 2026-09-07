class_name OperatorVisual
extends Node3D

## Visual identity for operators and bots.
## Design contract (see game/data/operator_definition.gd):
## - All humanoids share one animated Quaternius rig (source of truth), so the
##   shared-rig contract in the test suite stays intact.
## - Operator identity lives on the BODY (jacket + pants) via the definition
##   palette and on silhouette gear (helmet/vest/backpack) built from primitives.
## - Team identity lives on the HELMET + shoulder band + a short ground ring,
##   never on a floating halo, so friend/foe reads at a glance without
##   dominating the silhouette.

const HELMET_CENTER := Vector3(0.0, 1.845, 0.015)
const HELMET_RADIUS := 0.155
const VEST_CENTER := Vector3(0.0, 1.115, 0.0)
const BACKPACK_CENTER := Vector3(0.0, 1.16, 0.235)
const SHOULDER_BAND_Z := -0.155
const GROUND_RING_Y := 0.045

var operator_id: String = "BRAVO"
var team: String = "ally"
var accent: Color = Color("#ff9d50")
var model_root: Node3D
var animation_player: AnimationPlayer
var animation_state: StringName = &""
var definition: OperatorDefinition

func configure(id: String, team_id: String, color: Color) -> void:
	operator_id = id
	team = team_id
	accent = color
	definition = _find_definition(id)
	_build()

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
	animation_player = null
	animation_state = &""
	var model_path := definition.model_scene if definition != null else OperatorDefinition.SHARED_CHARACTER_SCENE
	if team != "ally" and team != "player":
		model_path = OperatorDefinition.ENEMY_CHARACTER_SCENE
	var packed := load(model_path) as PackedScene
	if packed != null:
		model_root = packed.instantiate() as Node3D
	if model_root != null:
		add_child(model_root)
		# The shared rig has a broad toon silhouette; this scale keeps it aligned
		# with the gameplay capsule while preserving readable shoulders and gear.
		model_root.scale = Vector3.ONE * (definition.build_scale if definition != null else 0.78)
		model_root.position.y = 0.30
		_hide_embedded_weapon_nodes(model_root)
		_apply_operator_materials()
		_find_animation_player()
		_play_animation(&"Idle")
		_add_team_marker()
		_add_gear()
		return
	_build_fallback()

func _find_definition(id: String) -> OperatorDefinition:
	for candidate: OperatorDefinition in OperatorDefinition.roster():
		if candidate.id == id:
			return candidate
	return OperatorDefinition.new()

func _find_animation_player() -> void:
	for candidate: Node in model_root.find_children("*", "AnimationPlayer", true, false):
		animation_player = candidate as AnimationPlayer
		if animation_player != null:
			return

func _hide_embedded_weapon_nodes(node: Node) -> void:
	var embedded_weapon_names: Array[String] = [
		"ak", "grenadelauncher", "knife_1", "knife_2", "pistol", "revolver",
		"revolver_small", "rocketlauncher", "shortcannon", "shotgun", "shovel",
		"smg", "sniper", "sniper_2"
	]
	for child: Node in node.get_children():
		if child is Node3D and embedded_weapon_names.has(child.name.to_lower()):
			(child as Node3D).visible = false
		else:
			_hide_embedded_weapon_nodes(child)

func _play_animation(animation_name: StringName) -> void:
	if animation_player == null or not is_instance_valid(animation_player):
		return
	if not animation_player.has_animation(animation_name):
		if animation_name != &"Idle" and animation_player.has_animation(&"Idle"):
			animation_name = &"Idle"
		else:
			return
	if animation_state == animation_name and animation_player.is_playing():
		return
	animation_state = animation_name
	animation_player.play(animation_name, 0.12)
	animation_player.speed_scale = 1.0

func _apply_operator_materials() -> void:
	if model_root == null:
		return
	var jacket: Color = definition.jacket if definition != null else accent
	var pants: Color = definition.pants if definition != null else Color("#3f4a5c")
	var visor_tint := definition.visor if definition != null else Color("#55dcff")
	for candidate: Node in model_root.find_children("*", "MeshInstance3D", true, false):
		var mesh_instance := candidate as MeshInstance3D
		if mesh_instance == null or mesh_instance.mesh == null:
			continue
		for surface_index: int in range(mesh_instance.mesh.get_surface_count()):
			var source := mesh_instance.get_active_material(surface_index)
			if source is not StandardMaterial3D:
				continue
			var material := source.duplicate() as StandardMaterial3D
			var material_name := material.resource_name.to_lower()
			if material_name.is_empty():
				material_name = String(mesh_instance.name).to_lower()
			if material_name.begins_with("character_main") or material_name.begins_with("enemy_red"):
				# Jacket: carries the operator identity color.
				material.albedo_color = jacket
			elif material_name.begins_with("pants"):
				material.albedo_color = pants
			elif material_name.begins_with("skin"):
				material.albedo_color = definition.skin_tone if definition != null else Color("#d4a27f")
			elif material_name.contains("head") or material_name.contains("visor"):
				material.albedo_color = material.albedo_color.lerp(visor_tint, 0.60)
				material.emission_enabled = true
				material.emission = visor_tint
				material.emission_energy_multiplier = 0.35
			mesh_instance.set_surface_override_material(surface_index, material)

## Silhouette gear built from primitives. Each operator gets a distinct helmet
## shape, vest and backpack so the five operators never read as clones even in
## mid combat. Hitboxes and the shared rig are untouched.
func _add_gear() -> void:
	var jacket: Color = definition.jacket if definition != null else accent
	var trim: Color = definition.trim if definition != null else accent.lightened(0.2)
	var gear: String = definition.gear if definition != null else "vest"
	var head_node := _find_head_node()
	var head_top := HELMET_CENTER.y + HELMET_RADIUS
	match gear:
		"crest":
			_add_helmet(head_node)
			var crest := MeshInstance3D.new()
			var crest_mesh := BoxMesh.new()
			crest_mesh.size = Vector3(0.045, 0.115, 0.30)
			crest.mesh = crest_mesh
			crest.position = Vector3(0.0, head_top + 0.035, -0.01)
			crest.material_override = _material(trim, 0.55)
			head_node.add_child(crest)
		"beanie":
			_add_beanie(head_node, trim)
		"scarf":
			_add_beanie(head_node, trim)
			var scarf := MeshInstance3D.new()
			var scarf_mesh := BoxMesh.new()
			scarf_mesh.size = Vector3(0.30, 0.085, 0.13)
			scarf.mesh = scarf_mesh
			scarf.position = Vector3(0.0, 1.60, -0.10)
			scarf.rotation_degrees.z = -8.0
			scarf.material_override = _material(trim, 0.0)
			head_node.add_child(scarf)
			var tail := MeshInstance3D.new()
			var tail_mesh := BoxMesh.new()
			tail_mesh.size = Vector3(0.09, 0.26, 0.06)
			tail.mesh = tail_mesh
			tail.position = Vector3(0.10, 1.44, 0.03)
			tail.rotation_degrees.z = 14.0
			tail.material_override = _material(trim, 0.0)
			head_node.add_child(tail)
		"heavy":
			_add_helmet(head_node)
			_add_vest_plate(jacket, trim)
		"vest":
			_add_beanie(head_node, trim)
			_add_vest_plate(jacket, trim)
	if definition.has_backpack:
		var pack := MeshInstance3D.new()
		var pack_mesh := BoxMesh.new()
		pack_mesh.size = Vector3(0.30, 0.34, 0.16)
		pack.mesh = pack_mesh
		pack.position = BACKPACK_CENTER
		pack.material_override = _material(trim.darkened(0.35), 0.0)
		add_child(pack)
		var strap := MeshInstance3D.new()
		var strap_mesh := BoxMesh.new()
		strap_mesh.size = Vector3(0.32, 0.05, 0.18)
		strap.mesh = strap_mesh
		strap.position = BACKPACK_CENTER + Vector3(0.0, 0.20, -0.01)
		strap.material_override = _material(jacket.darkened(0.45), 0.0)
		add_child(strap)

func _add_helmet(head_node: Node3D) -> void:
	var helmet := MeshInstance3D.new()
	var helmet_mesh := SphereMesh.new()
	helmet_mesh.radius = HELMET_RADIUS
	helmet_mesh.height = HELMET_RADIUS * 2.0 * 0.86
	helmet.mesh = helmet_mesh
	helmet.position = HELMET_CENTER
	helmet.material_override = _material(_team_color(), 0.55)
	add_child(helmet)
	var brim := MeshInstance3D.new()
	var brim_mesh := BoxMesh.new()
	brim_mesh.size = Vector3(0.26, 0.035, 0.16)
	brim.mesh = brim_mesh
	brim.position = HELMET_CENTER + Vector3(0.0, -0.045, -0.13)
	brim.material_override = _material(_team_color().darkened(0.3), 0.0)
	add_child(brim)

func _add_beanie(head_node: Node3D, trim: Color) -> void:
	var beanie := MeshInstance3D.new()
	var beanie_mesh := SphereMesh.new()
	beanie_mesh.radius = HELMET_RADIUS * 0.92
	beanie_mesh.height = HELMET_RADIUS * 1.1
	beanie.mesh = beanie_mesh
	beanie.position = HELMET_CENTER + Vector3(0.0, 0.012, 0.0)
	beanie.material_override = _material(trim, 0.0)
	add_child(beanie)

func _add_vest_plate(jacket: Color, trim: Color) -> void:
	var vest := MeshInstance3D.new()
	var vest_mesh := BoxMesh.new()
	vest_mesh.size = Vector3(0.40, 0.44, 0.24)
	vest.mesh = vest_mesh
	vest.position = VEST_CENTER
	vest.material_override = _material(jacket.darkened(0.42), 0.0)
	add_child(vest)
	var plate := MeshInstance3D.new()
	var plate_mesh := BoxMesh.new()
	plate_mesh.size = Vector3(0.30, 0.26, 0.045)
	plate.mesh = plate_mesh
	plate.position = VEST_CENTER + Vector3(0.0, 0.03, -0.20)
	plate.material_override = _material(trim, 0.0)
	add_child(plate)

func _team_color() -> Color:
	return accent

func _add_team_marker() -> void:
	# Shoulder team band: small, rigid and readable without a floating halo.
	var band := MeshInstance3D.new()
	band.name = "TeamBand"
	var band_mesh := BoxMesh.new()
	band_mesh.size = Vector3(0.46, 0.075, 0.10)
	band.mesh = band_mesh
	band.position = Vector3(0.0, 1.47, SHOULDER_BAND_Z)
	band.material_override = _material(_team_color(), 0.25)
	add_child(band)
	# Short ground ring: team ring on the floor, faint from the front but
	# unmistakable from above and in the HUD framing.
	var ring := MeshInstance3D.new()
	ring.name = "TeamRing"
	var ring_mesh := TorusMesh.new()
	ring_mesh.inner_radius = 0.30
	ring_mesh.outer_radius = 0.36
	ring.mesh = ring_mesh
	ring.position = Vector3(0.0, GROUND_RING_Y, 0.0)
	ring.material_override = _material(_team_color(), 0.4)
	add_child(ring)

func _find_head_node() -> Node3D:
	if model_root == null:
		return self
	for candidate: Node in model_root.find_children("*", "MeshInstance3D", true, false):
		var mesh_instance := candidate as MeshInstance3D
		if mesh_instance != null and String(mesh_instance.name).to_lower().contains("head"):
			return mesh_instance
	return self

func _build_fallback() -> void:
	var body := MeshInstance3D.new()
	var capsule := CapsuleMesh.new()
	capsule.height = 1.45
	capsule.radius = 0.34
	body.mesh = capsule
	body.position.y = 1.0
	body.material_override = _material(definition.jacket if definition != null else accent.darkened(0.18), 0.0)
	add_child(body)
	var head := MeshInstance3D.new()
	var head_mesh := SphereMesh.new()
	head_mesh.height = 0.55
	head_mesh.radius = 0.3
	head.mesh = head_mesh
	head.position.y = 1.95
	head.material_override = _material(Color("#d4a27f"), 0.0)
	add_child(head)
	var visor := MeshInstance3D.new()
	var visor_mesh := BoxMesh.new()
	visor_mesh.size = Vector3(0.34, 0.09, 0.05)
	visor.mesh = visor_mesh
	visor.position = Vector3(0, 2.02, -0.28)
	visor.material_override = _material(definition.visor if definition != null else Color("#5ce8ff"), 0.6)
	add_child(visor)
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
