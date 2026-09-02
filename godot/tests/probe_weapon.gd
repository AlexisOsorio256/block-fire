extends SceneTree
func _init() -> void:
	var lobby: PackedScene = load("res://scenes/lobby.tscn")
	var l := lobby.instantiate()
	root.add_child(l)
	await process_frame
	await process_frame
	await process_frame
	# buscar el CharacterModel en el árbol
	_dump(l, 0)
	quit()

func _dump(n: Node, depth: int) -> void:
	if depth > 4: return
	print("  ".repeat(depth), "• ", n.name, " [", n.get_class(), "]")
	for c in n.get_children():
		_dump(c, depth + 1)
