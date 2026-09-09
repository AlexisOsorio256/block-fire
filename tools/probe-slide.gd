extends SceneTree
## Diagnóstico de patinaje: el actor avanza a la velocidad declarada del clip y
## se mide la velocidad del pie de apoyo PLANO en el mundo. Imprime el peor
## fotograma con su fase y altura, no sólo el máximo.
## USO: godot --path . --script res://tools/probe-slide.gd -- --speed=4.8 [--sprint] [--frames=200]
var _speed := 4.8
var _sprint := false
var _frames := 200

func _init() -> void:
	for arg in OS.get_cmdline_user_args():
		if arg.begins_with("--speed="): _speed = float(arg.get_slice("=", 1))
		if arg.begins_with("--frames="): _frames = int(arg.get_slice("=", 1))
		if arg == "--sprint": _sprint = true
	call_deferred("run")

func run() -> void:
	var v := OperatorVisual.new()
	root.add_child(v)
	v.configure("BRAVO", "ally", Color.CYAN, {}, true)
	v.set_process(false)
	v.debug_manual_state = true
	var m := v.motion
	var feet := [v.skeleton.find_bone("Foot.L"), v.skeleton.find_bone("Foot.R")]
	var direction := Vector3(0, 0, -1)
	if absf(_speed) > 0.0 and OS.get_cmdline_user_args().has("--lateral"):
		direction = Vector3(-1, 0, 0)
	m.local_velocity = direction * _speed
	m.sprint_intent = _sprint
	for i in 150: v._process(1.0/60.0)
	print("clip len walk=", v.animation_player.get_animation("ual/WalkFwd").length,
		" sprint=", v.animation_player.get_animation("ual/SprintFwd").length,
		" declared walk=", m.declared_speed("ual/WalkFwd"), " sprint=", m.declared_speed("ual/SprintFwd"),
		" sprint_weight=", m._sprint_weight)
	var worst := 0.0
	var worst_info := ""
	var samples := 0
	var histogram := {}
	for i in _frames:
		var before: Array[Vector3] = []
		var before_model: Array[Vector3] = []
		for f in feet:
			before.append(v.skeleton.global_transform * v.skeleton.get_bone_global_pose(f).origin)
			before_model.append(v.skeleton.get_bone_global_pose(f).origin)
		var support := 0 if before[0].y <= before[1].y else 1
		var planted := before[support].y < 0.033
		v._process(1.0/60.0)
		v.position += v.global_basis * m.local_velocity / 60.0
		if not planted: continue
		samples += 1
		var now := v.skeleton.global_transform * v.skeleton.get_bone_global_pose(feet[support]).origin
		var model_now := v.skeleton.get_bone_global_pose(feet[support]).origin
		var planar := Vector2(now.x - before[support].x, now.z - before[support].z)
		var slide := planar.length() * 60.0
		var bucket := "%.1f" % (floor(slide * 10.0) / 10.0)
		histogram[bucket] = int(histogram.get(bucket, 0)) + 1
		if slide > worst:
			worst = slide
			worst_info = "frame %d phase %.4f foot %s y %.4f->%.4f worlddx %.5f modeldx %.5f modeldy %.5f modeldz %.5f" % [
				i, m.phase, "L" if support == 0 else "R", before[support].y, now.y,
				now.x - before[support].x, model_now.x - before_model[support].x,
				model_now.y - before_model[support].y, model_now.z - before_model[support].z]
	print("samples=", samples, " worst=", "%.3f" % worst, " m/s")
	var prev_phase := m.phase
	v._process(1.0/60.0)
	print("phase delta per frame = ", m.phase - prev_phase, " (expect 1/cycle = ", 1.0 / v.animation_player.get_animation("ual/StrafeLeft" if OS.get_cmdline_user_args().has("--lateral") else "ual/WalkFwd").length, " per second)")
	print("implied/cycle debug: sprint_weight=", m._sprint_weight, " direction=", m._direction, " move_weight=", m._move_weight)
	print("worst frame: ", worst_info)
	var keys := histogram.keys()
	keys.sort()
	var line := ""
	for k in keys: line += "%s:%d  " % [k, histogram[k]]
	print("histograma (m/s:muestras) ", line)
	v.free()
	quit(0)
