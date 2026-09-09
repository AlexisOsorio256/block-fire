class_name OperatorVisual
extends Node3D

## Third-person character visual. The skin is a real skinned GLB and the
## locomotion/combat clips come from the shared UAL rig through runtime
## retargeting. No primitive or Toon fallback is created when an asset is
## missing: gameplay keeps its mount/muzzle contract until a licensed weapon
## mesh is supplied.
const CHARACTER_SCENE_PATH := "res://assets/models/skins/rigged_anime_japanese_high_school_boy.glb"
const ANIMATION_SOURCE_PATHS := [
	"res://assets/models/animation_library/UAL1_Standard.glb",
	"res://assets/models/animation_library/UAL2_Standard.glb"
]
const WEAPON_IDS := ["rifle", "pistol", "shotgun", "smg"]
const WEAPON_ASSETS := {
	"rifle": "res://assets/models/weapons/real/type64_smg.glb",
	"pistol": "res://assets/models/weapons/real/desert_eagle.glb",
	"smg": "res://assets/models/weapons/real/mpx_smg.glb"
}
const WEAPON_ASSET_SCALES := {
	"rifle": 0.0012,
	"pistol": 0.0030,
	"smg": 0.0100
}
const WEAPON_ASSET_ROTATIONS := {
	"rifle": Vector3(0.0, 90.0, 0.0),
	"pistol": Vector3(0.0, 90.0, 0.0),
	"smg": Vector3(0.0, 90.0, 0.0)
}

# The downloaded skin uses Blender control/deformation names. These are the
# deformation bones that correspond to the canonical UAL 65-bone skeleton.
# Keeping the map here makes the retarget explicit and reviewable instead of
# hiding it in an importer or a second runtime manager.
const TARGET_BONE_MAP := {
	"root": "GLTF_created_0_rootJoint",
	"pelvis": "hips_81",
	"spine_01": "DEF-spine_75",
	"spine_02": "DEF-spine.001_74",
	"spine_03": "DEF-spine.002_73",
	"neck_01": "neck_175",
	"Head": "head_169",
	"clavicle_l": "DEF-shoulder.L_189",
	"upperarm_l": "DEF-upper_arm.L_299",
	"lowerarm_l": "DEF-forearm.L_297",
	"hand_l": "DEF-hand.L_295",
	"thigh_l": "DEF-thigh.L_133",
	"calf_l": "DEF-shin.L_131",
	"foot_l": "DEF-foot.L_129",
	"ball_l": "DEF-toe.L_128",
	"clavicle_r": "DEF-shoulder.R_313",
	"upperarm_r": "DEF-upper_arm.R_423",
	"lowerarm_r": "DEF-forearm.R_421",
	"hand_r": "DEF-hand.R_419",
	"thigh_r": "DEF-thigh.R_152",
	"calf_r": "DEF-shin.R_150",
	"foot_r": "DEF-foot.R_148",
	"ball_r": "DEF-toe.R_147",
	"index_01_l": "DEF-f_index.01.L_209",
	"index_02_l": "DEF-f_index.02.L_208",
	"index_03_l": "DEF-f_index.03.L_207",
	"middle_01_l": "DEF-f_middle.01.L_242",
	"middle_02_l": "DEF-f_middle.02.L_241",
	"middle_03_l": "DEF-f_middle.03.L_240",
	"ring_01_l": "DEF-f_ring.01.L_261",
	"ring_02_l": "DEF-f_ring.02.L_260",
	"ring_03_l": "DEF-f_ring.03.L_259",
	"pinky_01_l": "DEF-f_pinky.01.L_280",
	"pinky_02_l": "DEF-f_pinky.02.L_279",
	"pinky_03_l": "DEF-f_pinky.03.L_278",
	"thumb_01_l": "DEF-thumb.01.L_213",
	"thumb_02_l": "DEF-thumb.02.L_212",
	"thumb_03_l": "DEF-thumb.03.L_211",
	"index_01_r": "DEF-f_index.01.R_333",
	"index_02_r": "DEF-f_index.02.R_332",
	"index_03_r": "DEF-f_index.03.R_331",
	"middle_01_r": "DEF-f_middle.01.R_366",
	"middle_02_r": "DEF-f_middle.02.R_365",
	"middle_03_r": "DEF-f_middle.03.R_364",
	"ring_01_r": "DEF-f_ring.01.R_385",
	"ring_02_r": "DEF-f_ring.02.R_384",
	"ring_03_r": "DEF-f_ring.03.R_383",
	"pinky_01_r": "DEF-f_pinky.01.R_404",
	"pinky_02_r": "DEF-f_pinky.02.R_403",
	"pinky_03_r": "DEF-f_pinky.03.R_402",
	"thumb_01_r": "DEF-thumb.01.R_337",
	"thumb_02_r": "DEF-thumb.02.R_336",
	"thumb_03_r": "DEF-thumb.03.R_335"
}

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
var _last_locomotion_clip := ""


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
	return CosmeticCatalog.bot_loadout_for(operator_id, "entry", role_seed)


func set_showcase_mode(enabled: bool, weapon_scene: String = "", weapon_skin: String = "") -> void:
	showcase_mode = enabled
	if model_root != null:
		model_root.rotation_degrees.y = 0.0 if enabled else 180.0
	# The lobby is a third-person loadout preview, not a neutral bind pose:
	# hold the weapon in the same chest-level stance used by ADS so the mount
	# and the downloaded weapon can be inspected together.
	aiming = enabled
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


func set_combat_state(is_moving: bool, is_firing: bool, is_aiming: bool = false, locomotion_speed: float = 1.0) -> void:
	moving = is_moving
	firing = is_firing
	aiming = is_aiming
	locomotion_speed_scale = clampf(locomotion_speed, 0.85, 1.55)
	_refresh_animation_state()


func play_death() -> void:
	dead = true
	if animation_player != null and retarget_ready:
		_play_clip("Death01", false)


func get_muzzle_global_position() -> Vector3:
	return muzzle_marker.global_position if muzzle_marker != null else global_position + Vector3(0.0, 1.35, -0.8)


func _process(_delta: float) -> void:
	if animation_player == null or not retarget_ready or dead:
		return
	_refresh_animation_state()


func _build() -> void:
	for child: Node in get_children():
		remove_child(child)
		child.free()
	model_root = Node3D.new()
	model_root.name = "RiggedOperator"
	model_root.scale = Vector3.ONE * 1.05
	# The downloaded GLB is authored facing +Z while Blockfire's actor/camera
	# contract uses -Z as forward. Rotate the imported visual once so gameplay
	# shows the character's back to the shoulder camera and the face toward the
	# aim/enemy direction. The lobby overrides this to face its presentation cam.
	model_root.rotation_degrees.y = 180.0
	add_child(model_root)
	skeleton = null
	animation_player = null
	retarget_ready = false
	dead = false
	_last_locomotion_clip = ""

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
	_refresh_weapon()
	_set_team_marker_visible(not showcase_mode)
	_refresh_animation_state()


func _setup_target_rig(character: Node) -> void:
	skeleton = character.find_child("Skeleton3D", true, false) as Skeleton3D
	animation_player = character.find_child("AnimationPlayer", true, false) as AnimationPlayer
	var target_mesh := _find_skinned_mesh(character)
	if skeleton == null or animation_player == null:
		return
	_remap_skin_bind_names(target_mesh)
	_rename_target_bones()
	# The downloaded skin ships with a Walk clip authored for this exact
	# control/deformation rig. Preserve it for locomotion; applying UAL Jog_Fwd
	# directly to this 413-bone hierarchy makes the limbs shear while moving.
	_retarget_target_animations()
	skeleton.force_update_all_bone_transforms()
	_install_ual_animations()

	var hand_index := skeleton.find_bone("hand_r")
	if hand_index >= 0:
		var attachment := BoneAttachment3D.new()
		attachment.name = "WeaponMount"
		attachment.bone_name = "hand_r"
		attachment.position = Vector3(0.02, -0.015, -0.03)
		# BoneAttachment3D must live below the Skeleton3D; placing it beside the
		# imported scene leaves the weapon at the character origin (the old
		# ground-level screenshot exposed exactly that failure).
		skeleton.add_child(attachment)
		weapon_mount = attachment
	else:
		weapon_mount = Node3D.new()
		weapon_mount.name = "WeaponMount"
		model_root.add_child(weapon_mount)
	muzzle_marker = Marker3D.new()
	muzzle_marker.name = "MuzzleMarker"
	weapon_mount.add_child(muzzle_marker)


func _find_skinned_mesh(parent: Node) -> MeshInstance3D:
	for candidate: Node in parent.find_children("*", "MeshInstance3D", true, false):
		var mesh_instance := candidate as MeshInstance3D
		if mesh_instance != null and mesh_instance.skin != null:
			return mesh_instance
	return null


func _remap_skin_bind_names(target_mesh: MeshInstance3D) -> void:
	if target_mesh == null or not target_mesh.skin is Skin:
		return
	var canonical_by_original: Dictionary = {}
	for canonical_name: String in TARGET_BONE_MAP:
		canonical_by_original[TARGET_BONE_MAP[canonical_name]] = canonical_name
	var remapped_skin := (target_mesh.skin as Skin).duplicate(true) as Skin
	if remapped_skin == null:
		return
	for bind_index: int in range(remapped_skin.get_bind_count()):
		var original_name := String(remapped_skin.get_bind_name(bind_index))
		if canonical_by_original.has(original_name):
			remapped_skin.set_bind_name(bind_index, canonical_by_original[original_name])
	target_mesh.skin = remapped_skin


func _rename_target_bones() -> void:
	for canonical_name: String in TARGET_BONE_MAP:
		var original_name: String = TARGET_BONE_MAP[canonical_name]
		var bone_index := skeleton.find_bone(original_name)
		if bone_index >= 0:
			skeleton.set_bone_name(bone_index, canonical_name)


func _install_ual_animations() -> void:
	if animation_player == null or skeleton == null:
		return
	var library := AnimationLibrary.new()
	for source_path: String in ANIMATION_SOURCE_PATHS:
		var source_packed := load(source_path) as PackedScene if ResourceLoader.exists(source_path) else null
		if source_packed == null:
			continue
		var source_instance := source_packed.instantiate()
		var source_player := source_instance.find_child("AnimationPlayer", true, false) as AnimationPlayer
		if source_player != null:
			for library_name: StringName in source_player.get_animation_library_list():
				var source_library := source_player.get_animation_library(library_name)
				if source_library == null:
					continue
				for clip_name: StringName in source_library.get_animation_list():
					if library.has_animation(clip_name):
						continue
					var source_animation := source_library.get_animation(clip_name)
					var copied := source_animation.duplicate(true) as Animation
					if copied == null:
						continue
					_retarget_animation(copied)
					library.add_animation(clip_name, copied)
		source_instance.free()
	if library.get_animation_list().is_empty():
		return
	if animation_player.get_animation_library_list().has(&"ual"):
		animation_player.remove_animation_library(&"ual")
	retarget_ready = animation_player.add_animation_library(&"ual", library) == OK


func _retarget_target_animations() -> void:
	if animation_player == null or skeleton == null:
		return
	if not animation_player.get_animation_library_list().has(&""):
		return
	var target_library := animation_player.get_animation_library(&"")
	if target_library == null:
		return
	for clip_name: StringName in target_library.get_animation_list():
		var animation := target_library.get_animation(clip_name)
		if animation != null:
			_remap_target_animation(animation)


func _remap_target_animation(animation: Animation) -> void:
	var relative_skeleton_path := animation_player.get_parent().get_path_to(skeleton)
	for track_index: int in range(animation.get_track_count()):
		var old_path := animation.track_get_path(track_index)
		var old_text := String(old_path)
		var colon := old_text.find(":")
		if colon < 0:
			continue
		var original_name := old_text.substr(colon + 1)
		var bone_name := original_name
		for canonical_name: String in TARGET_BONE_MAP:
			if TARGET_BONE_MAP[canonical_name] == original_name:
				bone_name = canonical_name
				break
		if skeleton.find_bone(bone_name) < 0:
			animation.track_set_enabled(track_index, false)
			continue
		animation.track_set_path(track_index, NodePath(String(relative_skeleton_path) + ":" + bone_name))


func _retarget_animation(animation: Animation) -> void:
	var relative_skeleton_path := animation_player.get_parent().get_path_to(skeleton)
	for track_index: int in range(animation.get_track_count()):
		var old_path := animation.track_get_path(track_index)
		var old_text := String(old_path)
		var colon := old_text.find(":")
		if colon < 0:
			continue
		var bone_name := old_text.substr(colon + 1)
		if skeleton.find_bone(bone_name) < 0:
			animation.track_set_enabled(track_index, false)
			continue
		animation.track_set_path(track_index, NodePath(String(relative_skeleton_path) + ":" + bone_name))


func _refresh_animation_state() -> void:
	if animation_player == null or not retarget_ready or dead:
		return
	if firing:
		animation_player.speed_scale = 1.0
		# The UAL shoot keyframe is authored for its own rest pose and visibly
		# over-rotates this downloaded skin. While ADS, keep the stable chest
		# stance and let WeaponController own the actual shot/recoil events.
		if aiming and animation_player.get_animation("ual/Pistol_Aim_Neutral") != null:
			if animation_player.current_animation != "ual/Pistol_Aim_Neutral":
				_play_clip("Pistol_Aim_Neutral", true)
			return
		var current := animation_player.current_animation
		var shooting := animation_player.get_animation("ual/Pistol_Shoot")
		if current != "ual/Pistol_Shoot" or shooting == null or animation_player.current_animation_position >= shooting.length - 0.02:
			_play_clip("Pistol_Shoot", false)
		return
	if aiming and animation_player.get_animation("ual/Pistol_Aim_Neutral") != null:
		animation_player.speed_scale = 1.0
		if animation_player.current_animation != "ual/Pistol_Aim_Neutral":
			_play_clip("Pistol_Aim_Neutral", true)
		return
	var clip := "Walk" if moving and animation_player.get_animation("Walk") != null else "Idle"
	var library_prefix := "" if clip == "Walk" else "ual/"
	if clip != _last_locomotion_clip or animation_player.current_animation != library_prefix + clip:
		animation_player.speed_scale = 1.65 * locomotion_speed_scale if clip == "Walk" else 1.0
		if library_prefix.is_empty():
			_play_target_clip(clip, true)
		else:
			_play_clip(clip, true)
		_last_locomotion_clip = clip


func _play_clip(clip_name: String, loop: bool) -> void:
	if animation_player == null or animation_player.get_animation("ual/" + clip_name) == null:
		return
	var animation := animation_player.get_animation("ual/" + clip_name)
	animation.loop_mode = Animation.LOOP_LINEAR if loop else Animation.LOOP_NONE
	animation_player.play("ual/" + clip_name, 0.12)


func _play_target_clip(clip_name: String, loop: bool) -> void:
	if animation_player == null or animation_player.get_animation(clip_name) == null:
		return
	var animation := animation_player.get_animation(clip_name)
	animation.loop_mode = Animation.LOOP_LINEAR if loop else Animation.LOOP_NONE
	animation_player.play(clip_name, 0.12)


func _refresh_weapon() -> void:
	if weapon_mount == null:
		return
	for child: Node in weapon_mount.get_children():
		if child != muzzle_marker:
			# Let the renderer finish the current frame before releasing imported
			# GLB materials. Immediate free() causes Android's renderer to report
			# null-material dependency errors when a loadout switches weapon.
			child.queue_free()
	var weapon := _new_weapon(equipped_weapon_id)
	weapon.name = "MountedWeapon"
	weapon_mount.add_child(weapon)
	var visual_scale := 0.54
	match equipped_weapon_id:
		"pistol": visual_scale = 0.52
		"shotgun": visual_scale = 0.48
		"smg": visual_scale = 0.50
	var asset_scale := float(WEAPON_ASSET_SCALES.get(equipped_weapon_id, 0.01))
	weapon.scale = Vector3.ONE * visual_scale * asset_scale
	weapon.position = Vector3(0.0, -0.14, -0.10)
	var weapon_rotation: Vector3 = WEAPON_ASSET_ROTATIONS.get(equipped_weapon_id, Vector3.ZERO)
	weapon_rotation.z = -42.0
	weapon.rotation_degrees = weapon_rotation
	WeaponSkin.apply(weapon, showcase_weapon_skin)
	if muzzle_marker != null:
		# The downloaded Sketchfab meshes expose their barrel on local +Y (the
		# major AABB axis). The old fixed -Z marker was nowhere near the muzzle,
		# so third-person flashes appeared detached or invisible while firing.
		var muzzle_offset := weapon.transform * Vector3(0.0, _weapon_length(equipped_weapon_id) * visual_scale, 0.0)
		muzzle_marker.position = muzzle_offset
		muzzle_marker.rotation = weapon.rotation


func _new_weapon(_weapon_id: String) -> Node3D:
	var asset_path := str(WEAPON_ASSETS.get(_weapon_id, ""))
	var packed := load(asset_path) as PackedScene if not asset_path.is_empty() and ResourceLoader.exists(asset_path) else null
	if packed != null:
		var asset := packed.instantiate() as Node3D
		if asset != null:
			return asset
	# Deliberately no primitive replacement: a missing real weapon must be
	# visible as an empty mount until a licensed asset is provided.
	return Node3D.new()


func _weapon_length(weapon_id: String) -> float:
	match weapon_id:
		"pistol": return 0.42
		"shotgun": return 1.20
		"smg": return 0.78
	return 0.86


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


func _weapon_id_from_scene(scene_path: String) -> String:
	var path := scene_path.to_lower()
	if path.contains("pistol"): return "pistol"
	if path.contains("shotgun"): return "shotgun"
	if path.contains("smg"): return "smg"
	return "rifle"


func _settings() -> Node:
	return get_node_or_null("/root/SettingsStore") if is_inside_tree() else null
