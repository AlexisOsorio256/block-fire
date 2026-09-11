extends SceneTree
## Huella determinista del HUD: qué nodos construye, dónde están anclados y qué
## se ve en cada pantalla. Es el oráculo para mover código del HUD, donde lo que
## se pone en riesgo no es la pose sino el layout y qué panel manda.
##
##   godot --headless --path . --script res://tools/probe-hud-contract.gd
##
## Cada escenario monta un HUD NUEVO: los paneles de muerte/fin de partida se
## acumulan en el mismo nodo, así que reutilizar uno solo mediría basura del
## escenario anterior. No sustituye a las capturas (`tools/qa_shot.gd`).

var _lines: Array[String] = []

func _init() -> void:
	call_deferred("run")

func run() -> void:
	var digest: Array[int] = []
	for scenario in ["idle", "combat", "buy", "settings", "editor", "death", "spectator", "end"]:
		var hud := BlockfireHud.new()
		get_root().add_child(hud)
		hud.setup(null, false)
		_drive(hud, scenario)
		var local: Array[int] = []
		var nodes := _walk(hud, "", local, 0)
		digest.append(hash(local))
		_lines.append("SCENARIO %-10s nodes=%3d hash=%d" % [scenario, nodes, hash(local)])
		hud.free()
	print("HUD_CONTRACT_SIGNATURE %d" % hash(digest))
	for line in _lines:
		print(line)
	quit()

## Estado público que un modelo puede romper al mover código.
func _drive(hud: BlockfireHud, scenario: String) -> void:
	match scenario:
		"idle":
			pass
		"combat":
			hud.update_score(3, 1, 2)
			hud.update_health(137.0, 200.0)
			hud.update_ammo(12, 72, WeaponController.DEFINITIONS[1])
			hud.set_status("COMBATE ACTIVO")
			hud.show_banner("RONDA 2", 1.6)
			hud.show_damage("37", true)
			hud.show_hit_feedback(24.0, false)
			hud.show_kill(true)
		"buy":
			hud.show_buy(true, 12.0, 900, WeaponController.DEFINITIONS, 1)
			hud.update_buy_time(5.0)
			hud.show_buy_warning("SIN SALDO")
		"settings":
			hud.toggle_settings()
		"editor":
			hud.toggle_control_editor()
		"death":
			hud.show_death("ELIMINADO")
		"spectator":
			hud.show_spectator("COMPAÑERO 1")
		"end":
			hud.show_match_end("VICTORIA", "3 - 1")

## Estructura, no estado volátil: los offsets y el texto de los popups de daño
## los mueven tweens. Lo que un refactor puede romper es QUÉ nodo existe, dónde
## está anclado, si se ve y qué texto fijo lleva.
func _walk(node: Node, path: String, digest: Array[int], depth: int) -> int:
	var count := 0
	for child: Node in node.get_children():
		var child_path := path + "/" + String(child.name).split("@")[0]
		count += 1
		digest.append(hash(child_path))
		digest.append(hash(child.get_class()))
		if child is Control:
			var control := child as Control
			digest.append(hash(control.anchor_left))
			digest.append(hash(control.anchor_top))
			digest.append(hash(control.anchor_right))
			digest.append(hash(control.anchor_bottom))
			digest.append(int(control.visible))
		if child is Label:
			digest.append(hash((child as Label).text))
		if depth < 2:
			_lines.append("%s%s [%s]" % ["  ".repeat(depth), child_path, child.get_class()])
		count += _walk(child, child_path, digest, depth + 1)
	return count
