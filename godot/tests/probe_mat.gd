extends SceneTree
func _init() -> void:
	var scene: PackedScene = load("res://assets/characters/character-a.glb")
	var rig := scene.instantiate()
	get_root().add_child(rig)
	_walk(rig)
	quit()

func _walk(n: Node) -> void:
	if n is MeshInstance3D:
		var mi := n as MeshInstance3D
		print("[MAT] ", mi.name, " override=", mi.material_override)
		for i in mi.mesh.get_surface_count():
			var m := mi.mesh.surface_get_material(i)
			if m is BaseMaterial3D:
				var bm := m as BaseMaterial3D
				var tex := bm.albedo_texture
				print("  surf", i, " tex=", tex, " albedo=", bm.albedo_color, " cull=", bm.cull_mode)
	for c in n.get_children():
		_walk(c)
