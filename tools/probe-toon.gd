extends SceneTree

func _init() -> void:
	await process_frame
	await _probe_mount()
	_probe_rigs()
	quit(0)


## Calibración del mount third-person: expresa el +Z del esqueleto (hacia
## dónde mira el rig) y la mano en espacio del hueso LowerArm.R.
func _probe_mount() -> void:
	for cfg: Array in [["VULTURE", "enemy"], ["BRAVO", "ally"]]:
		var visual := OperatorVisual.new()
		get_root().add_child(visual)
		await process_frame
		visual.configure(cfg[0], cfg[1], Color("#da4f68"), {})
		await process_frame
		visual.set_combat_state(false, true)
		for i: int in range(30):
			await process_frame
		var skel := visual.skeleton
		var lower := skel.find_bone("LowerArm.R")
		var index := skel.find_bone("Index1.R")
		var hand_l := skel.find_bone("Index1.L")
		var lower_global := skel.get_bone_global_pose(lower)
		var index_global := skel.get_bone_global_pose(index)
		var fwd_in_mount := lower_global.basis.inverse() * Vector3(0, 0, 1)
		var up_in_mount := lower_global.basis.inverse() * Vector3(0, 1, 0)
		var hand_in_mount := lower_global.inverse() * index_global.origin
		var hand_l_in_mount := lower_global.inverse() * skel.get_bone_global_pose(hand_l).origin
		print("== mount team=", cfg[1])
		print("  fwd(+Z) in mount=", fwd_in_mount, " up(+Y) in mount=", up_in_mount)
		print("  handR in mount=", hand_in_mount, " handL in mount=", hand_l_in_mount)
		print("  euler for gun(+Z fwd, +Y up): ", _gun_euler(fwd_in_mount, up_in_mount))
		# Verificación directa: monta el rifle y mide a dónde apunta en el
		# mundo respecto al esqueleto (facing real del rig en esta pose).
		var rifle := BlockfireWeaponVisual.new()
		rifle.configure("rifle")
		visual.attach_weapon_to_hand(rifle, "rifle", "Estándar", false)
		for i: int in range(5):
			await process_frame
		var gun_world: Transform3D = (rifle as Node3D).global_transform
		var skel_world: Transform3D = skel.global_transform
		var gun_in_skel := skel_world.affine_inverse() * gun_world
		print("  gun +Z in skel=", (gun_in_skel.basis * Vector3(0, 0, 1)).normalized(), " gun +Y in skel=", (gun_in_skel.basis * Vector3(0, 1, 0)).normalized(), " gun pos=", gun_in_skel.origin)
		visual.free()


## Rota +Z sobre fwd y +Y sobre up: devuelve euler XYZ (grados) del mount.
func _gun_euler(fwd: Vector3, up: Vector3) -> Vector3:
	var z_axis := fwd.normalized()
	var x_axis := up.cross(z_axis).normalized()
	if x_axis.length_squared() < 0.01:
		x_axis = Vector3.RIGHT
	var y_axis := z_axis.cross(x_axis).normalized()
	var basis := Basis(x_axis, y_axis, z_axis)
	return basis.get_euler() * 180.0 / PI


func _probe_old() -> void:
	for cfg: Array in [
		["VULTURE", "enemy", {"head": "head_swat", "headwear": "headwear_beret", "eyewear": "", "mask": "", "top": "top_swat", "bottom": "bottom_swat", "shoes": "shoes_swat", "skin": "skin_light"}],
		["BRAVO", "ally", {"head": "head_swat", "headwear": "headwear_cap", "eyewear": "eyewear_shades", "mask": "mask_bandana", "top": "top_swat", "bottom": "bottom_swat", "shoes": "shoes_swat", "skin": "skin_light"}],
	]:
		var visual := OperatorVisual.new()
		get_root().add_child(visual)
		await process_frame
		visual.configure(cfg[0], cfg[1], Color("#da4f68"), cfg[2])
		await process_frame
		await process_frame
		print("== team=", cfg[1])
		var skel := visual.skeleton
		var names: Array[String] = []
		for bi: int in range(skel.get_bone_count()):
			names.append(skel.get_bone_name(bi))
		print("  bones: ", names)
		var head_bone := skel.find_bone("Head")
		if head_bone < 0:
			head_bone = skel.find_bone("Head_2")
		print("  head_bone=", skel.get_bone_name(head_bone) if head_bone >= 0 else "NONE")
		print("  Head bone global origin=", skel.get_bone_global_pose(head_bone).origin, " basis_y=", skel.get_bone_global_pose(head_bone).basis.y)
		for mesh_name: String in ["Character_Enemy_Head", "Head"]:
			var mi := visual.model_root.find_child(mesh_name, true, false) as MeshInstance3D
			if mi != null:
				print("  mesh ", mesh_name, " origin_world=", (mi as Node3D).global_position, " aabb_center_world=", mi.get_aabb().get_center(), " top_world=", mi.get_aabb().position.y + mi.get_aabb().size.y)
		for node: Node in visual.find_children("*", "BoneAttachment3D", true, false):
			var ba := node as BoneAttachment3D
			if str(ba.name) in ["Head_2", "UpperArm_L", "UpperArm_R", "Index1_R"]:
				print("  SRCATT ", ba.name, " bone=", ba.bone_name, " own_pos=", (ba as Node3D).position, " own_rot=", (ba as Node3D).rotation_degrees)
			var mi := node as MeshInstance3D
			if mi == null:
				continue
			var pname := str((mi.get_parent() as Node).name) if mi.get_parent() != null else "?"
			if pname == "TeamBandAttachment" or (mi.get_parent() as Node) is BoneAttachment3D and not str(mi.name) in ["TeamBand", "MountedWeapon"]:
				print("  ACC ", mi.name, " under=", pname, " origin_world=", (mi as Node3D).global_position, " aabb_center=", mi.get_aabb().get_center())
		visual.free()
	_probe_rigs()
	quit(0)


func _probe_rigs() -> void:
	for path: String in [
		"res://assets/models/quaternius_toon_shooter/Character_Soldier.gltf",
		"res://assets/models/quaternius_toon_shooter/Character_Enemy.gltf",
	]:
		var packed := load(path) as PackedScene
		print("== ", path, " packed=", packed != null)
		if packed == null:
			continue
		var root := packed.instantiate() as Node
		get_root().add_child(root)
		_print(root, 0)
		print("--- skeleton search ---")
		var skel := _find(root)
		if skel != null:
			print("skeleton: ", skel.get_path(), " bones=", skel.get_bone_count())
			var direct := 0
			for child: Node in skel.get_children():
				if child is MeshInstance3D:
					direct += 1
					print("  direct mesh: ", child.name, " visible=", (child as MeshInstance3D).visible)
			print("  direct mesh count=", direct)
		var ap: AnimationPlayer = null
		for c: Node in root.find_children("*", "AnimationPlayer", true, false):
			ap = c
			break
		if ap != null:
			print("  anims: ", ap.get_animation_list())
		# Materiales de cabeza/cuerpo + AABB para calibrar accesorios y escala.
		for mesh_name: String in ["Head", "Character_Enemy_Head", "Body", "Character_Enemy"]:
			var mi := root.find_child(mesh_name, true, false) as MeshInstance3D
			if mi == null or mi.mesh == null:
				continue
			print("  mesh ", mesh_name, " aabb=", mi.mesh.get_aabb(), " pos=", mi.position)
			for si: int in range(mi.mesh.get_surface_count()):
				var mat := mi.get_active_material(si)
				if mat is StandardMaterial3D:
					print("    surf ", si, " name=", (mat as StandardMaterial3D).resource_name, " albedo=", (mat as StandardMaterial3D).albedo_color)
		if skel != null:
			for b: String in ["Head", "Hips", "Root"]:
				var bi := skel.find_bone(b)
				if bi >= 0:
					print("  bone ", b, " rest origin=", skel.get_bone_rest(bi).origin)
		var lo := Vector3(1e9, 1e9, 1e9)
		var hi := Vector3(-1e9, -1e9, -1e9)
		for node: Node in root.find_children("*", "MeshInstance3D", true, false):
			var mi := node as MeshInstance3D
			if mi == null or not mi.visible:
				continue
			if str(mi.name) in ["AK", "GrenadeLauncher", "Knife_1", "Knife_2", "Pistol", "Revolver", "Revolver_Small", "RocketLauncher", "ShortCannon", "Shotgun", "Shovel", "SMG", "Sniper", "Sniper_2"]:
				continue
			var ab := mi.get_aabb()
			lo = lo.min(ab.position)
			hi = hi.max(ab.position + ab.size)
		print("  GLOBAL rest span (sin armas ejemplo): min=", lo, " max=", hi, " altura=", hi.y - lo.y)
		root.free()
	quit(0)

func _find(n: Node) -> Skeleton3D:
	if n is Skeleton3D:
		return n
	for c: Node in n.get_children():
		var f := _find(c)
		if f != null:
			return f
	return null

func _print(n: Node, depth: int) -> void:
	if depth > 6:
		return
	var extra := ""
	if n is MeshInstance3D:
		extra = " [MESH visible=%s]" % (n as MeshInstance3D).visible
	if n is Skeleton3D:
		extra = " [SKELETON]"
	if n is BoneAttachment3D:
		extra = " [ATTACH bone=%s]" % (n as BoneAttachment3D).bone_name
	print("  ".repeat(depth), n.name, " <", n.get_class(), ">", extra)
	for c: Node in n.get_children():
		_print(c, depth + 1)
