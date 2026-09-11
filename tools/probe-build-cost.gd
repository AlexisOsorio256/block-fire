extends SceneTree
## Sizing del hitch de arranque de partida: `OperatorVisual._build()` por actor.
## Con 9 combatientes el coste se multiplica; aquí se ve en frío y en caliente.
##
##   godot --headless --path . --script res://tools/probe-build-cost.gd

const ACTORS := 9

func _init() -> void:
	var total := 0.0
	for i in range(ACTORS):
		var actor := Node3D.new()
		get_root().add_child(actor)
		var visual := OperatorVisual.new()
		actor.add_child(visual)
		var start := Time.get_ticks_usec()
		visual._build()
		var ms := (Time.get_ticks_usec() - start) / 1000.0
		total += ms
		if i < 3 or i == ACTORS - 1:
			print("actor %d _build() = %7.1f ms" % [i + 1, ms])
		visual.free()
		actor.free()
	print("TOTAL %d actores = %.0f ms" % [ACTORS, total])
	quit()
