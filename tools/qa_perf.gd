extends SceneTree

## Sonda de rendimiento (no forma parte del runtime).
##
## Arranca la app con los flags de QA que ya entiende `game/app.gd` y publica
## cada segundo los monitores de rendimiento que importan para decidir recortes
## de cara a 60 fps en Android: draw calls, primitivas, objetos en pantalla,
## nodos, pares de fisica y memoria estatica.
##
## USO:
##   godot --path . --script res://tools/qa_perf.gd -- --qa-ffa
##   godot --path . --script res://tools/qa_perf.gd -- --qa-squad --seconds=12

var _seconds := 12.0
var _built := false
var _elapsed := 0.0
var _samples := 0
var _peak := {}
var _sum := {}


func _init() -> void:
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--seconds="):
			_seconds = float(a.get_slice("=", 1))
	print("QA_PERF arrancando la app (%.0f s de muestreo)" % _seconds)


func _process(delta: float) -> bool:
	if not _built:
		var scene: PackedScene = load("res://game/app.tscn")
		if scene == null:
			push_error("QA_PERF: no se pudo cargar app.tscn")
			return true
		root.add_child(scene.instantiate())
		_built = true
		return false
	_elapsed += delta
	_sample()
	if _elapsed >= _seconds:
		_report()
		return true
	return false


func _sample() -> void:
	var monitors := {
		"fps": Performance.TIME_FPS,
		"draw_calls": Performance.RENDER_TOTAL_DRAW_CALLS_IN_FRAME,
		"primitives": Performance.RENDER_TOTAL_PRIMITIVES_IN_FRAME,
		"objects": Performance.RENDER_TOTAL_OBJECTS_IN_FRAME,
		"nodes": Performance.OBJECT_NODE_COUNT,
		"physics_pairs": Performance.PHYSICS_3D_COLLISION_PAIRS,
		"static_mem_mb": Performance.MEMORY_STATIC,
	}
	for key: String in monitors:
		var value := float(Performance.get_monitor(monitors[key]))
		_sum[key] = float(_sum.get(key, 0.0)) + value
		_peak[key] = maxf(float(_peak.get(key, 0.0)), value)
	_samples += 1


func _report() -> void:
	print("QA_PERF muestras=%d  segundos=%.1f" % [_samples, _elapsed])
	print("%-14s %10s %10s" % ["monitor", "media", "pico"])
	for key: String in ["fps", "draw_calls", "primitives", "objects", "nodes", "physics_pairs", "static_mem_mb"]:
		var average := float(_sum.get(key, 0.0)) / maxf(1.0, float(_samples))
		var suffix := " MB" if key == "static_mem_mb" else ""
		var average_value := average / 1048576.0 if key == "static_mem_mb" else average
		var peak_value := float(_peak.get(key, 0.0))
		if key == "static_mem_mb":
			peak_value /= 1048576.0
		print("%-14s %10.1f %10.1f%s" % [key, average_value, peak_value, suffix])
