extends SceneTree
func _init() -> void:
	var scene: PackedScene = load("res://assets/characters/character-a.glb")
	var rig := scene.instantiate()
	get_root().add_child(rig)
	_dump(rig, 0)
	quit()

func _dump(n: Node, depth: int) -> void:
	var t := "  ".repeat(depth)
	if n is Node3D:
		print("[NODE] %s'%s' pos=%s" % ["|  ".repeat(0), n.name, (n as Node3D).position])
	elif n is AnimationPlayer:
		print("[ANIM] ", n.name, " anims=", (n as AnimationPlayer).get_animation_list().slice(0, 6))
	for c in n.get_children():
		_dump(c, depth + 1)
