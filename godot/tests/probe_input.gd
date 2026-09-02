# sonda temporal: acciones de input + FPS en render real
extends SceneTree

func _init() -> void:
	# acciones registradas
	var actions := ["move_forward", "move_back", "move_left", "move_right", "jump",
		"sprint", "crouch", "reload", "fire", "aim", "weapon_1", "weapon_2", "weapon_3", "weapon_next"]
	for a in actions:
		var evs := InputMap.action_get_events(a)
		if evs.is_empty():
			print("[PROBE] ACCION VACIA: " + a)
		else:
			print("[PROBE] %s = %s" % [a, evs[0].as_text()])
	quit()
