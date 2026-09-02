extends SceneTree
func _init() -> void:
	var scene: PackedScene = load("res://assets/characters/character-a.glb")
	var rig := scene.instantiate()
	get_root().add_child(rig)
	await process_frame
	var mi := _first_mesh(rig)
	var total := _merge_aabb(rig, Transform3D.IDENTITY)
	print("[AABB] total pos=", total.position, " size=", total.size)
	# pose holding-right: ¿cómo queda el brazo?
	var ap: AnimationPlayer = rig.find_child("AnimationPlayer", true, false)
	print("[ANIM] has holding-right: ", ap.has_animation("holding-right"), " | length: ", ap.get_animation("holding-right").length)
	quit()

func _first_mesh(n: Node) -> Node:
	if n is MeshInstance3D: return n
	for c in n.get_children():
		var r := _first_mesh(c)
		if r != null: return r
	return null

func _merge_aabb(n: Node, xf: Transform3D) -> AABB:
	var out := AABB()
	var first := true
	if n is Node3D: xf = xf * (n as Node3D).transform
	if n is MeshInstance3D:
		var mi := n as MeshInstance3D
		var local := xf * mi.get_aabb()
		out = local; first = false
	for c in n.get_children():
		var sub := _merge_aabb(c, xf)
		if not first: out = out.merge(sub)
		else: out = sub; first = false
	return out
