extends SceneTree
## Transición lateral->diagonal: continuidad de pose (huella del apoyo y salto
## de pose por hueso) frente al pop crudo, que escala con la cadencia.
func _init() -> void: call_deferred("run")
func run() -> void:
	var v := OperatorVisual.new()
	root.add_child(v)
	v.configure("BRAVO", "ally", Color.CYAN, {}, true)
	v.set_process(false)
	v.debug_manual_state = true
	var m := v.motion
	var feet := [v.skeleton.find_bone("Foot.L"), v.skeleton.find_bone("Foot.R")]
	m.local_velocity = Vector3(-4.8, 0, 0)
	for i in 45: v._process(1.0 / 60.0)
	var previous: Array[Transform3D] = []
	for i in v.skeleton.get_bone_count(): previous.append(v.skeleton.get_bone_global_pose(i))
	var worst_pose := 0.0
	var worst_rot := 0.0
	var worst_body := 0.0
	var worst_leg := 0.0
	var worst_rate := 0.0
	var worst_pop := 0.0
	var worst_clip := 0.0
	var worst_footprint := 0.0
	var anchored := false
	var anchor := Vector3.ZERO
	var previous_yaw := v.rotation.y
	var previous_phase := m.phase
	for i in 45:
		var before: Array[Vector3] = []
		for f in feet:
			before.append(v.skeleton.global_transform * v.skeleton.get_bone_global_pose(f).origin)
		var support := 0 if before[0].y <= before[1].y else 1
		var planted := before[support].y < 0.033
		m.local_velocity = Vector3(-4.8 + 9.6 * (i + 1) / 45.0, 0, -4.8 * (i + 1) / 45.0)
		v._process(1.0 / 60.0)
		var phase_step := fposmod(m.phase - previous_phase, 1.0)
		previous_phase = m.phase
		var body_turn := rad_to_deg(v.rotation.y - previous_yaw)
		previous_yaw = v.rotation.y
		for b in v.skeleton.get_bone_count():
			var now_pose := v.skeleton.get_bone_global_pose(b)
			var raw := now_pose.origin.distance_to(previous[b].origin)
			worst_pose = maxf(worst_pose, raw)
			worst_rot = maxf(worst_rot, now_pose.basis.get_rotation_quaternion().angle_to(previous[b].basis.get_rotation_quaternion()))
			# Cuánto de ese salto explica ya el giro del cuerpo (radio al eje Y).
			var carried := deg_to_rad(body_turn) * Vector2(now_pose.origin.x, now_pose.origin.z).length()
			worst_body = maxf(worst_body, carried)
			worst_leg = maxf(worst_leg, raw - carried)
			if raw > worst_pop:
				worst_pop = raw
				worst_rate = phase_step
				worst_clip = maxf(0.1, m.length_of("ual/WalkFwd") if m._direction.y < -0.5 else m.length_of("ual/StrafeLeft"))
			previous[b] = now_pose
		var world := v.skeleton.global_transform * v.skeleton.get_bone_global_pose(feet[support]).origin
		if not planted:
			anchored = false
			continue
		if not anchored:
			anchored = true
			anchor = world
			continue
		worst_footprint = maxf(worst_footprint, Vector2(world.x - anchor.x, world.z - anchor.z).length())
	print("transición: huella_apoyo=%.3f m pose_pop=%.4f (cuerpo %.4f, pierna %.4f) m/frame rot_pop_max=%.2f°" % [worst_footprint, worst_pose, worst_body, worst_leg, rad_to_deg(worst_rot)])
	# El salto esperado si el hueso gira 2*pi por ciclo y el ciclo avanza
	# phase_step: un valor observado mayor sería discontinuidad de pose.
	var radius: float = 0.4
	print("peor fotograma: pop=%.4f m con paso de fase %.4f ciclo -> esperado %.4f m (radio %.2f m); cadencia %.2f ciclos/s" % [
		worst_pop, worst_rate, TAU * worst_rate * radius, radius, worst_rate * 60.0])
	v.free()
	quit(0)
