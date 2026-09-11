extends SceneTree
# Proves whether the character GLB yields byte-identical mesh geometry per
# instance, which is what allows caching the runtime weight repair per asset.
func _init() -> void:
	var a := _signature()
	var b := _signature()
	print("instance A: ", a)
	print("instance B: ", b)
	print("geometry identical across instances: ", a == b)
	quit()

func _signature() -> Array:
	var scene: PackedScene = load(OperatorVisual.CHARACTER_SCENE_PATH)
	var character := scene.instantiate()
	var sig: Array = []
	var meshes: Array = character.find_children("*", "MeshInstance3D", true, false)
	for candidate: Node in meshes:
		var mi := candidate as MeshInstance3D
		if mi == null or mi.mesh == null:
			continue
		var per_mesh := [String((mi.mesh as Resource).resource_path), mi.mesh.get_surface_count()]
		for s in range(mi.mesh.get_surface_count()):
			var arrays: Array = mi.mesh.surface_get_arrays(s)
			var verts: PackedVector3Array = arrays[Mesh.ARRAY_VERTEX]
			var bones: PackedInt32Array = arrays[Mesh.ARRAY_BONES]
			var hash_v := hash(verts)
			var hash_b := hash(bones)
			per_mesh.append([verts.size(), hash_v, hash_b])
		sig.append([mi.name, per_mesh])
	character.free()
	return sig
