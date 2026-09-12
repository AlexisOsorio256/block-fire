extends SceneTree
## Contrato de capas de animación (Astra) + contrato de clase de velocidad.
## Un solo dueño de la pose, un solo reloj, sin pop al cruzar el eje lateral.
var failures := 0
func check(value: bool, message: String) -> void:
	if not value:
		failures += 1
		push_error(message)

func _init() -> void:
	call_deferred("run")

## Mide el patinaje del pie de apoyo en el mundo mientras el actor avanza a la
## velocidad declarada. Devuelve el peor valor en m/s y cuántas muestras hubo.
func _measure_slide(v: OperatorVisual, m: OperatorMotion, feet: Array, velocity: Vector3, sprint: bool) -> Dictionary:
	m.local_velocity = velocity
	m.sprint_intent = sprint
	for i in 120: v._process(1.0/60.0)
	var worst := 0.0
	var samples := 0
	var worst_frame := -1
	for i in 180:
		var before: Array[Vector3] = []
		for f in feet:
			before.append(v.skeleton.global_transform * v.skeleton.get_bone_global_pose(f).origin)
		var support := 0 if before[0].y <= before[1].y else 1
		# El hueso Foot nace a 0.0228 m: sólo cuenta la planta realmente apoyada.
		var planted := before[support].y < 0.033
		v._process(1.0/60.0)
		v.position += v.global_basis * m.local_velocity / 60.0
		if planted:
			var now := v.skeleton.global_transform * v.skeleton.get_bone_global_pose(feet[support]).origin
			# Sólo cuenta el deslizamiento HORIZONTAL: el pie rodando en el
			# sitio (talón→punta) sube y baja sin patinar.
			var planar := Vector2(now.x - before[support].x, now.z - before[support].z)
			if planar.length() * 60.0 > worst:
				worst = planar.length() * 60.0
				worst_frame = i
			samples += 1
	return {"worst": worst, "samples": samples, "frame": worst_frame}

## Huella del apoyo en diagonales: desde el aterrizaje, cuánto se aleja el pie
## del punto donde tocó el suelo. Una diagonal mezcla dos clips ortogonales y
## cada uno sólo retrocede por su eje: si el reloj promedia magnitudes en vez de
## proyectar por rumbo, el paso se acorta y el apoyo deriva (medido: 0.14 m de
## huella y 1.96 m/s de deriva antes de proyectar; 0.002 m después).
func _measure_diagonal_footprint(v: OperatorVisual, m: OperatorMotion, feet: Array, velocity: Vector3) -> float:
	m.reset()
	m.aiming = false
	m.crouched = false
	m.sprint_intent = false
	m.local_velocity = velocity
	for i in 120: v._process(1.0/60.0)
	var worst := 0.0
	var anchored := false
	var anchor := Vector3.ZERO
	for i in 240:
		var before: Array[Vector3] = []
		for f in feet:
			before.append(v.skeleton.global_transform * v.skeleton.get_bone_global_pose(f).origin)
		var support := 0 if before[0].y <= before[1].y else 1
		var planted := before[support].y < 0.033
		v._process(1.0/60.0)
		v.position += v.global_basis * m.local_velocity / 60.0
		var now := v.skeleton.global_transform * v.skeleton.get_bone_global_pose(feet[support]).origin
		if not planted:
			anchored = false
			continue
		if not anchored:
			anchored = true
			anchor = before[support]
			continue
		worst = maxf(worst, Vector2(now.x - anchor.x, now.z - anchor.z).length())
	return worst

## Frenada: al soltar, el cuerpo absorbe en vez de llegar al idle caminando.
## Se mide la huella del apoyo durante la frenada y que el estado se publique.
func _measure_brake(v: OperatorVisual, m: OperatorMotion, feet: Array) -> Dictionary:
	m.reset()
	m.crouched = false
	m.aiming = false
	m.local_velocity = Vector3(0, 0, -4.8)
	for i in 90: v._process(1.0/60.0)
	var brake_clip := m.length_of("ual/Brake")
	check(brake_clip > 0.05, "Brake clip is loaded (%.2f s)" % brake_clip)
	m.braking = true
	# La parada no se juzga por la ventana de transición (ahí el apoyo cambia de
	# pie y cualquier métrica de anclaje mide el cambio de apoyo, no un defecto).
	# Se juzga por el ASENTAMIENTO: al frenar el cuerpo absorbe, y al quedarse
	# quieto la fase termina en un contacto, no congelada a mitad de zancada.
	var worst := 0.0
	var peak_state := ""
	for i in 60:
		m.local_velocity = Vector3(0, 0, -maxf(0.0, 4.8 - 32.0 * (i + 1) / 60.0))
		v._process(1.0/60.0)
		if m.base_state == "Brake": peak_state = "Brake"
		worst = maxf(worst, m._brake_weight)
	for i in 40:
		m.local_velocity = Vector3.ZERO
		v._process(1.0/60.0)
	var settled_phase := m.phase
	var settled_low := 1.0
	for f in feet:
		settled_low = minf(settled_low, (v.skeleton.global_transform * v.skeleton.get_bone_global_pose(f).origin).y)
	check(settled_low < 0.033, "Stop settles with a foot planted (lowest %.3f m)" % settled_low)
	check(minf(settled_phase, 1.0 - settled_phase) < 0.06, "Stop phase settles on a contact (%.3f)" % settled_phase)
	var settled_pose := m._pose.duplicate()
	for i in 20: v._process(1.0/60.0)
	var jitter := 0.0
	for b in settled_pose.size():
		jitter = maxf(jitter, settled_pose[b].origin.distance_to(m._pose[b].origin))
	check(jitter < 0.02, "Stopped actor holds still (worst %.3f m)" % jitter)
	var weight_peaked := m._brake_weight
	m.braking = false
	for i in 30: v._process(1.0/60.0)
	return {"footprint": worst, "state": peak_state, "weight": weight_peaked, "released": m._brake_weight,
		"settled_phase": settled_phase, "settled_low": settled_low, "jitter": jitter}


func run() -> void:
	var v := OperatorVisual.new()
	root.add_child(v)
	v.configure("BRAVO", "ally", Color.CYAN, {}, true)
	v.set_process(false)
	v.debug_manual_state = true
	var m := v.motion
	check(not v.animation_player.active, "No parallel animation clock")
	# El camino público de gameplay debe transmitir sprint (sin debug manual).
	v.debug_manual_state = false
	v.set_combat_state(true, false, false, 7.0, true)
	v._process(1.0 / 60.0)
	check(v.sprinting and m.sprint_intent, "Gameplay sprint reaches the motion evaluator")
	v.set_combat_state(true, false, false, 4.8, false)
	v._process(1.0 / 60.0)
	check(not v.sprinting and not m.sprint_intent, "Gameplay sprint release reaches the motion evaluator")
	v.debug_manual_state = true
	m.reset()
	m.local_velocity = Vector3(0, 0, -4.8)
	for i in 120: m.evaluate(1.0 / 60.0)
	# Cambiar intención sin avanzar tiempo no puede saltar a otra pose.
	var standing_pose := m._pose.duplicate()
	m.crouched = true
	m.evaluate(0.0)
	var crouch_pop := 0.0
	for bone in standing_pose.size():
		crouch_pop = maxf(crouch_pop, standing_pose[bone].origin.distance_to(m._pose[bone].origin))
		crouch_pop = maxf(crouch_pop, standing_pose[bone].basis.get_rotation_quaternion().angle_to(m._pose[bone].basis.get_rotation_quaternion()))
	check(crouch_pop < 0.001, "Crouch intent does not snap the moving pose")
	m.crouched = false
	m.aiming = true
	m.evaluate(0.0)
	var aim_pop := 0.0
	for bone in standing_pose.size():
		aim_pop = maxf(aim_pop, standing_pose[bone].basis.get_rotation_quaternion().angle_to(m._pose[bone].basis.get_rotation_quaternion()))
	check(aim_pop < 0.001, "ADS intent does not snap torso stabilization")
	m.reset()

	for clip in ["ReloadRifle","ReloadPistol","StrafeLeft","StrafeRight","CrouchWalk","JumpStart","AirLoop","Land","WalkFwd","SprintFwd"]:
		check(v.animation_player.has_animation("ual/"+clip), "Required clip "+clip)
	# --- Recarga por arma: una sola tabla decide clip y recorrido de mano -----
	check(m.reload_class() == "rifle", "Default reload class is rifle")
	m.reload_weapon_id = "pistol"
	check(m.reload_clip() == "ual/ReloadPistol", "Pistol selects its own reload clip")
	check(m.reload_class() == "pistol", "Pistol selects its own hand path")
	for weapon_id in ["rifle", "shotgun", "smg"]:
		m.reload_weapon_id = weapon_id
		check(m.reload_clip() == "ual/ReloadRifle", weapon_id + " uses the long-gun reload")
		check(m.reload_class() == "rifle", weapon_id + " uses the long-gun hand path")
	m.reload_weapon_id = "rifle"
	check(OperatorVisual.reload_hand_offset(0.34, "rifle") != OperatorVisual.reload_hand_offset(0.34, "pistol"),
		"Rifle and pistol hand travels differ at the pouch beat")
	# --- Contrato de velocidad declarada (una sola verdad) -------------------
	check(not OperatorMotion.DECLARED_SPEEDS.is_empty(), "locomotion_speeds.json is loaded")
	check(absf(m.declared_speed("ual/WalkFwd") - 4.8) < 0.01, "WalkFwd declares gameplay walk 4.8")
	check(absf(m.declared_speed("ual/SprintFwd") - 7.0) < 0.01, "SprintFwd declares gameplay sprint 7.0")
	check(absf(m.declared_speed("ual/StrafeRight") - 4.8) < 0.01, "StrafeRight declares gameplay 4.8")
	check(absf(m.declared_speed("ual/CrouchWalk") - 2.6) < 0.01, "CrouchWalk declares gameplay 2.6")
	m.local_velocity = Vector3(3.4,0,-3.4)
	m.aiming = true
	for i in 30: v._process(1.0/60.0)
	var foot := v.skeleton.find_bone("Foot.L")
	var before := v.skeleton.get_bone_global_pose(foot)
	var phase := m.phase
	m.reload_duration = 2
	m.reload_remaining = 1.4
	m.hit(1)
	for i in 12: v._process(1.0/60.0)
	check(m.action == OperatorMotion.Action.RELOAD, "Damage preserves gameplay reload")
	check(m.phase != phase and before.origin.distance_to(v.skeleton.get_bone_global_pose(foot).origin) > 0.01, "Moving reload preserves foot cycle")
	check(absf(m.reload_phase - 0.3) < 0.001, "Reload seeks gameplay normalized time")
	m.crouched = true
	for i in 30: v._process(1.0/60.0)
	check(m.base_state == "Crouch", "ADS reload does not erase crouch")
	m.switch_remaining = 0.2
	v._process(1.0/60.0)
	check(m.action == OperatorMotion.Action.SWITCH, "Switch cancels visual reload")
	m.reload_remaining = 0
	m.switch_remaining = 0
	m.grounded = false
	for i in 30: v._process(1.0/60.0)
	check(m.base_state == "Air", "Air survives ADS")
	m.grounded = true
	m.shot(1,16)
	v._process(1.0/60.0)
	check(m.base_state == "Land" and m.recoil > 0, "Land and confirmed fire coexist")
	v.play_death()
	m.reload_remaining = 1
	m.hit(1)
	m.shot(2,10)
	for i in 100: v._process(1.0/60.0)
	check(m.dead and m.reload_weight == 0 and m.recoil == 0, "Death blocks every action/reaction")
	var root_bone := v.skeleton.find_bone("Root")
	var pos := v.skeleton.get_bone_pose_position(root_bone)
	var rest := v.skeleton.get_bone_rest(root_bone).origin
	check(absf(pos.x-rest.x)<0.0001 and absf(pos.z-rest.z)<0.0001, "No horizontal root motion")
	v.revive()
	v._process(1.0/60.0)
	check(not m.dead and m.action == OperatorMotion.Action.READY, "Revive clears terminal state and actions")
	# --- Clase de velocidad: walk usa WalkFwd, sprint usa SprintFwd ---------
	m.crouched = false
	m.aiming = false
	m.grounded = true
	m.sprint_intent = false
	m.local_velocity = Vector3(0,0,-4.8)
	for i in 120: v._process(1.0/60.0)
	check(m._sprint_weight < 0.05, "Walk speed never selects the sprint clip")
	check(absf(m.phase - fposmod(2.0 * 4.8 / (4.8 * v.animation_player.get_animation("ual/WalkFwd").length), 1.0)) < 0.05, "Walk plays at rate 1.0 (no frantic scaling)")
	m.sprint_intent = true
	m.local_velocity = Vector3(0,0,-7.0)
	var last_barrel := v.weapon_mount.global_basis.z.normalized()
	var carry_step := 0.0
	for i in 120:
		v._process(1.0/60.0)
		var barrel := v.weapon_mount.global_basis.z.normalized()
		carry_step = maxf(carry_step, rad_to_deg(acos(clampf(last_barrel.dot(barrel), -1.0, 1.0))))
		last_barrel = barrel
	check(m._sprint_weight > 0.95, "Sprint intent at 7.0 selects the sprint clip")
	check(last_barrel.dot(v.model_root.global_basis.y.normalized()) < -0.25, "Sprint carries the muzzle below the firing line")
	check(carry_step < 8.0, "Sprint carry enters without a barrel snap")
	m.sprint_intent = false
	m.local_velocity = Vector3(0,0,-4.8)
	for i in 120: v._process(1.0/60.0)
	check(m._sprint_weight < 0.05, "Releasing sprint returns to the walk clip")
	check(v.weapon_mount.global_basis.z.normalized().dot(v.model_root.global_basis.z.normalized()) > 0.9999, "Walking restores the baseline weapon mount")
	# --- Continuidad de fase al cruzar el eje lateral (bug de crossfade) ----
	var worst := 0.0
	var previous := v.skeleton.get_bone_global_pose(foot).origin
	m.aiming = false
	m.local_velocity = Vector3(-4.8,0,0)
	for i in 45:
		v._process(1.0/60.0)
		previous = v.skeleton.get_bone_global_pose(foot).origin
		m.local_velocity = Vector3(-4.8 + 9.6 * (i + 1) / 45.0, 0, -4.8 * (i + 1) / 45.0)
	for i in 45:
		v._process(1.0/60.0)
		var now := v.skeleton.get_bone_global_pose(foot).origin
		worst = maxf(worst, now.distance_to(previous))
		previous = now
	# El tope depende de la cadencia: este barrido lleva la velocidad a ~6.5 m/s
	# y el reloj sube a ~4 ciclos/s, así que el pie recorre ~0.13 m/frame por
	# geometría (2*pi*r*ciclos/60 con r~0.4 m = 0.17 m) y no por salto de pose.
	check(worst < 0.16, "No foot pop crossing the lateral axis (worst %.3f m/frame)" % worst)
	# --- Cero patinaje: el actor avanza a la velocidad declarada por el clip ---
	# El pie de apoyo plano debe quedar quieto en el mundo. "De apoyo" = el pie
	# más bajo de la zancada con la planta apoyada (el pie en vuelo no cuenta).
	m.aiming = false
	m.crouched = false
	m.sprint_intent = false
	var feet := [v.skeleton.find_bone("Foot.L"), v.skeleton.find_bone("Foot.R")]
	var slide_walk := _measure_slide(v, m, feet, Vector3(0,0,-4.8), false)
	check(slide_walk.samples > 20, "Planted foot sampled at walk (%d frames)" % slide_walk.samples)
	check(slide_walk.worst < 0.02, "No horizontal foot slide at walk 4.8 (worst %.2f m/s)" % slide_walk.worst)
	var slide_sprint := _measure_slide(v, m, feet, Vector3(0,0,-7.0), true)
	check(slide_sprint.worst < 0.14, "No horizontal foot slide at sprint 7.0 (worst %.2f m/s)" % slide_sprint.worst)
	var slide_side := _measure_slide(v, m, feet, Vector3(-4.8,0,0), false)
	print("FOOT_SLIDE walk=%.2f (f%d) sprint=%.2f (f%d) strafe=%.2f (f%d) m/s (peor fotograma de aterrizaje)" % [slide_walk.worst, slide_walk.frame, slide_sprint.worst, slide_sprint.frame, slide_side.worst, slide_side.frame])
	check(slide_side.worst < 0.02, "No horizontal foot slide at strafe 4.8 (worst %.2f m/s)" % slide_side.worst)
	var slide_right := _measure_slide(v, m, feet, Vector3(4.8,0,0), false)
	check(slide_right.worst < 0.007, "No horizontal foot slide at right strafe 4.8 (worst %.2f m/s)" % slide_right.worst)
	var brake := _measure_brake(v, m, feet)
	check(brake.state == "Brake", "Braking publishes the Brake base state")
	check(brake.weight > 0.9, "Braking reaches full weight (%.2f)" % brake.weight)
	check(brake.footprint < 1.01, "Brake state engages during the stop (%.2f)" % brake.footprint)
	check(brake.settled_low < 0.033, "Stop settles with a foot planted")
	check(brake.settled_phase < 0.06, "Stop phase settles on a contact (%.3f)" % brake.settled_phase)
	check(brake.jitter < 0.02, "Stopped actor holds still (%.3f m)" % brake.jitter)
	check(brake.released < 0.15, "Brake weight releases after stopping (%.2f)" % brake.released)
	print("BRAKE weight=%.2f released=%.2f fase_asentada=%.3f pie_bajo=%.3f jitter=%.4f" % [
		brake.weight, brake.released, brake.settled_phase, brake.settled_low, brake.jitter])
	m.sprint_intent = false
	var diagonal := _measure_diagonal_footprint(v, m, feet, Vector3(-3.4,0,-3.4))
	check(diagonal < 0.080, "Planted foot holds its ground on the diagonal 4.8 (worst %.3f m)" % diagonal)
	# 30° del eje frontal: comprueba la proyección fuera del diagonal exacto.
	var oblique := _measure_diagonal_footprint(v, m, feet, Vector3(-2.4,0,-4.1577))
	check(oblique < 0.12, "Planted foot holds its ground at an oblique heading (worst %.3f m)" % oblique)
	print("DIAGONAL_FOOTPRINT diagonal=%.3f m oblicuo=%.3f m (huella del apoyo a 4.8)" % [diagonal, oblique])
	# Authored lateral lean must not pull the support wrist away from its palm
	# or rotate the chest-mounted barrel away from the actor's aim direction.
	v.set_equipped_weapon("rifle")
	m.reset()
	var socket_error := 0.0
	var barrel_alignment := 1.0
	for direction in [-4.8, 4.8]:
		m.local_velocity = Vector3(direction, 0, 0)
		for ads in [false, true]:
			m.aiming = ads
			for i in 120:
				v._process(1.0 / 60.0)
				var wrist := v.skeleton.global_transform * v.skeleton.get_bone_global_pose(v.skeleton.find_bone("Wrist.L")).origin
				var socket := v._left_fist.global_position + v.weapon_mount.global_basis * (OperatorVisual.WEAPON_CONFIG.rifle.support_wrist as Vector3)
				socket_error = maxf(socket_error, wrist.distance_to(socket))
				barrel_alignment = minf(barrel_alignment, v.weapon_mount.global_basis.z.normalized().dot(v.model_root.global_basis.z.normalized()))
	print("STRAFE_GRIP socket_mm=%.3f barrel_alignment=%.6f right_slide=%.3f m/s" % [socket_error * 1000.0, barrel_alignment, slide_right.worst])
	check(socket_error < 0.020, "Support wrist stays attached through left/right strafe and ADS")
	check(barrel_alignment > 0.9999, "Lateral body lean preserves barrel orientation")
	# Separate from the existing gait timeline: extra ticks must not change
	# the foot-contact phases sampled by the baseline measurements above.
	m.reset()
	m.sprint_intent = true
	m.local_velocity = Vector3(0, 0, -7.0)
	for i in 30: v._process(1.0 / 60.0)
	# Combat must override carry even while the gait is still blending out.
	m.aiming = true
	for i in 9: v._process(1.0 / 60.0)
	check(v.weapon_mount.global_basis.z.normalized().dot(v.model_root.global_basis.z.normalized()) > 0.9999, "ADS restores firing direction during sprint blend")
	m.reset()
	# Numerical reach and singularity guard across all real weapon configurations.
	for weapon in OperatorVisual.WEAPON_IDS:
		v.set_equipped_weapon(weapon)
		for i in 90:
			m.aiming = i%30<15
			m.reload_duration=1.5
			m.reload_remaining=maxf(0,(90-i)/60.0)
			v._process(1.0/60.0)
			for bone in v.skeleton.get_bone_count():
				check(v.skeleton.get_bone_global_pose(bone).is_finite(), "Finite pose "+weapon)
	v.free()
	_test_repaired_mesh_replay()
	print("ANIMATION_LAYERS: ","PASS" if failures == 0 else "FAIL", " failures=",failures)
	quit(0 if failures == 0 else 1)

## `OperatorVisual._repair_mesh_hands` cachea por asset la cirugía de pesos (la
## geometría es idéntica en cada actor). Un actor en frío y otro que sólo copia
## la caché deben dar EXACTAMENTE la misma malla: si divergen, la caché devuelve
## superficies que el actor en frío descartó y Godot falla al asignar material.
## Se compara geometría/material, no nombres: el sufijo de un nodo anónimo
## (`@MeshInstance3D@15`) lo asigna Godot por sesión.
func _test_repaired_mesh_replay() -> void:
	var cold := _repaired_signature()
	var warm := _repaired_signature()
	check(not cold.is_empty(), "repaired mesh has surfaces")
	check(cold == warm, "warm repaired mesh is identical to the cold one")

func _repaired_signature() -> Array:
	var actor := Node3D.new()
	get_root().add_child(actor)
	var visual := OperatorVisual.new()
	actor.add_child(visual)
	visual._build()
	var signature: Array = []
	if visual.model_root != null:
		for candidate: Node in visual.model_root.find_children("*", "MeshInstance3D", true, false):
			var mesh_instance := candidate as MeshInstance3D
			if mesh_instance == null or mesh_instance.mesh == null:
				continue
			var surfaces: Array = []
			for surface in range(mesh_instance.mesh.get_surface_count()):
				var arrays: Array = mesh_instance.mesh.surface_get_arrays(surface)
				var material := mesh_instance.mesh.surface_get_material(surface)
				surfaces.append([
					hash(arrays[Mesh.ARRAY_VERTEX]),
					hash(arrays[Mesh.ARRAY_INDEX]) if arrays[Mesh.ARRAY_INDEX] != null else 0,
					material.resource_name if material != null else "",
				])
			signature.append(["" if String(mesh_instance.name).begins_with("@") else String(mesh_instance.name), surfaces])
	visual.free()
	actor.free()
	return signature

