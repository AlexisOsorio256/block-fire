class_name OperatorMotion
extends RefCounted

## Evaluador único de clips. AnimationPlayer es biblioteca/visor, nunca reloj
## paralelo. Orden: base direccional → torso → reacción → commit; OperatorVisual
## termina con mirada → montaje → IK. Ninguna capa decide gameplay.
## Switch cancela reload (contrato WeaponController); daño no cancela acciones.
## Land sólo afecta base; Fire sólo procede de un disparo confirmado. Death
## captura la pose final, cancela todos los canales y bloquea hasta reset().
enum Action { READY, RELOAD, SWITCH }
const UPPER := ["Abdomen", "Torso", "Chest", "Neck", "Head", "Shoulder.L", "Shoulder.R", "UpperArm.L", "UpperArm.R", "LowerArm.L", "LowerArm.R", "Wrist.L", "Wrist.R"]
const REACTION := ["Abdomen", "Torso", "Chest", "Neck", "Head"]
var action := Action.READY
var dead := false
var grounded := true
var local_velocity := Vector3.ZERO # actor space: -Z forward, +X right
var crouched := false
var aiming := false
var reload_remaining := 0.0
var reload_duration := 1.6
var switch_remaining := 0.0
var reload_phase := 0.0
var reload_weight := 0.0
var switch_weight := 0.0
var aim_weight := 0.0
var recoil := 0.0
var recoil_strength := 1.0
var recoil_recovery := 16.0
var base_state := "Idle"
var phase := 0.0
var _clock := 0.0
var _air_time := 0.0
var _land_time := 10.0
var _flinch_time := 10.0
var _flinch_strength := 0.0
var _death_time := 0.0
var _grounded_before := true
var _move_weight := 0.0
var _run_weight := 0.0
var _right_weight := 0.5
var _back_weight := 0.0
var _crouch_weight := 0.0
var _direction := Vector2(0, -1)
var _skel: Skeleton3D
var _clips: Dictionary = {}
var _upper: Array[int] = []
var _reaction: Array[int] = []
var _rest: Array[Transform3D] = []
var _pose: Array[Transform3D] = []
var _death_from: Array[Transform3D] = []

func setup(skel: Skeleton3D, player: AnimationPlayer) -> void:
	_skel = skel
	player.active = false
	for i in skel.get_bone_count():
		_rest.append(skel.get_bone_rest(i))
		if skel.get_bone_name(i) in UPPER: _upper.append(i)
		if skel.get_bone_name(i) in REACTION: _reaction.append(i)
	_pose = _rest.duplicate()
	for name: String in player.get_animation_list():
		var clip := player.get_animation(name)
		var tracks: Array = []
		for t in clip.get_track_count():
			var path := clip.track_get_path(t)
			if path.get_subname_count() != 1 or not clip.track_is_enabled(t): continue
			var bone := skel.find_bone(path.get_subname(0))
			if bone >= 0 and clip.track_get_type(t) in [Animation.TYPE_ROTATION_3D, Animation.TYPE_POSITION_3D]:
				tracks.append([t, bone, clip.track_get_type(t)])
		_clips[name] = {"clip": clip, "tracks": tracks}

func reset() -> void:
	dead = false
	crouched = false
	aiming = false
	local_velocity = Vector3.ZERO
	_crouch_weight = 0.0
	action = Action.READY
	reload_remaining = 0.0
	switch_remaining = 0.0
	reload_weight = 0.0
	switch_weight = 0.0
	aim_weight = 0.0
	recoil = 0.0
	_land_time = 10.0
	_flinch_time = 10.0
	_air_time = 0.0
	_death_time = 0.0
	_grounded_before = true
	grounded = true
	_move_weight = 0.0
	phase = 0.0
	_pose = _rest.duplicate()

func die() -> void:
	if dead: return
	dead = true
	_death_time = 0.0
	_death_from.clear()
	for i in _skel.get_bone_count(): _death_from.append(_skel.get_bone_pose(i))
	action = Action.READY
	reload_weight = 0.0
	switch_weight = 0.0
	recoil = 0.0
	_flinch_time = 10.0
	_land_time = 10.0

func hit(strength: float) -> void:
	if dead: return
	_flinch_time = 0.0
	_flinch_strength = clampf(strength, 0.0, 1.0)

func shot(strength: float, recovery: float) -> void:
	if dead or reload_remaining > 0.0 or switch_remaining > 0.0: return
	recoil_strength = strength
	recoil_recovery = recovery
	recoil = minf(recoil + strength, strength * 1.5)

func length_of(name: String) -> float:
	return (_clips[name].clip as Animation).length if _clips.has(name) else 1.0

func _sample(name: String, time: float, loop: bool = false) -> Array[Transform3D]:
	var result: Array[Transform3D] = _rest.duplicate()
	if not _clips.has(name): return result
	var entry: Dictionary = _clips[name]
	var clip: Animation = entry.clip
	var t := fposmod(time, clip.length) if loop else clampf(time, 0.0, clip.length)
	for channel: Array in entry.tracks:
		var idx: int = channel[1]
		if channel[2] == Animation.TYPE_ROTATION_3D:
			result[idx].basis = Basis(clip.rotation_track_interpolate(channel[0], t))
		else:
			result[idx].origin = clip.position_track_interpolate(channel[0], t)
	# Root horizontal is NEVER animation authority, including Death.
	result[0].origin.x = _rest[0].origin.x
	result[0].origin.z = _rest[0].origin.z
	return result

func _blend(a: Array[Transform3D], b: Array[Transform3D], weight: float, mask: Array[int] = []) -> void:
	for i in a.size():
		if mask.is_empty() or i in mask:
			a[i] = a[i].interpolate_with(b[i], weight)

func _add_clip(name: String, time: float, weight: float, mask: Array[int]) -> void:
	if weight <= 0.0001 or time > length_of(name): return
	var sample := _sample(name, time)
	for i in mask:
		var delta := _rest[i].basis.get_rotation_quaternion().inverse() * sample[i].basis.get_rotation_quaternion()
		_pose[i].basis = _pose[i].basis * Basis(Quaternion.IDENTITY.slerp(delta, weight))

func evaluate(delta: float) -> void:
	_clock += delta
	if dead:
		_death_time += delta
		_pose = _death_from.duplicate()
		_blend(_pose, _sample("Death", _death_time), smoothstep(0.0, 0.085, _death_time))
		_commit()
		return
	if grounded and not _grounded_before: _land_time = 0.0
	if not grounded and _grounded_before: _air_time = 0.0
	_grounded_before = grounded
	_air_time += delta
	_land_time += delta
	_flinch_time += delta
	action = Action.SWITCH if switch_remaining > 0.0 else (Action.RELOAD if reload_remaining > 0.0 else Action.READY)
	if action == Action.RELOAD:
		reload_phase = clampf(1.0 - reload_remaining / maxf(reload_duration, 0.01), 0.0, 1.0)
	else:
		reload_phase = minf(1.0, reload_phase + delta / maxf(reload_duration, 0.01))
	reload_weight = move_toward(reload_weight, 1.0 if action == Action.RELOAD else 0.0, delta / 0.12)
	switch_weight = move_toward(switch_weight, 1.0 if action == Action.SWITCH else 0.0, delta / 0.09)
	aim_weight = move_toward(aim_weight, 1.0 if aiming and action == Action.READY else 0.0, delta / (0.09 if aiming else 0.14))
	recoil *= exp(-recoil_recovery * delta)
	var speed := Vector2(local_velocity.x, local_velocity.z).length()
	_move_weight = move_toward(_move_weight, smoothstep(0.08, 0.65, speed), delta / (0.11 if speed > 0.15 else 0.18))
	_crouch_weight = move_toward(_crouch_weight, 1.0 if crouched else 0.0, delta / (0.19 if crouched else 0.24))
	if speed > 0.15:
		_direction = _direction.lerp(Vector2(local_velocity.x, local_velocity.z).normalized(), 1.0 - exp(-18.0 * delta)).normalized()
	_run_weight = move_toward(_run_weight, smoothstep(1.4, 2.4, speed), delta / 0.13)
	_right_weight = move_toward(_right_weight, 1.0 if _direction.x > 0 else 0.0, delta / 0.14)
	_back_weight = move_toward(_back_weight, 1.0 if _direction.y > 0 else 0.0, delta / 0.16)
	var side := "ual/StrafeRight" if _direction.x > 0.0 else "ual/StrafeLeft"
	var side_weight := absf(_direction.x) / maxf(absf(_direction.x) + absf(_direction.y), 0.001)
	var implied := lerpf(lerpf(lerpf(1.32, 2.48, _run_weight), 1.8, _back_weight), 1.5, side_weight)
	implied = lerpf(implied, lerpf(1.25, 1.0, side_weight), _crouch_weight)
	var cycle := lerpf(lerpf(lerpf(length_of("Walk"), length_of("Run_Gun"), _run_weight), length_of("ual/BackWalk"), _back_weight), length_of(side), side_weight)
	phase = fposmod(phase + delta * speed / maxf(implied * cycle, 0.01), 1.0)
	_pose = _sample("Idle_Gun", _clock, true)
	if _move_weight > 0.0:
		var travel := _sample("Run_Gun" if _run_weight >= 1.0 else "Walk", phase * length_of("Run_Gun" if _run_weight >= 1.0 else "Walk"), true)
		if _run_weight > 0.0 and _run_weight < 1.0: _blend(travel, _sample("Run_Gun", phase * length_of("Run_Gun"), true), _run_weight)
		if _back_weight > 0.0: _blend(travel, _sample("ual/BackWalk", phase * length_of("ual/BackWalk"), true), _back_weight)
		if side_weight > 0.001:
			var sideways := _sample("ual/StrafeRight" if _right_weight >= 1.0 else "ual/StrafeLeft", phase * length_of(side), true)
			if _right_weight > 0.0 and _right_weight < 1.0: _blend(sideways, _sample("ual/StrafeRight", phase * length_of(side), true), _right_weight)
			_blend(travel, sideways, side_weight)
		_blend(_pose, travel, _move_weight)
	if _crouch_weight > 0.0:
		var low := _sample("ual/CrouchIdle", _clock, true)
		var crouch_move := _sample("ual/CrouchWalk", phase * length_of("ual/CrouchWalk"), true)
		# Directional crouch clips use the same contact phase as standing strafe.
		var crouch_side := "ual/CrouchRight" if _direction.x > 0 else "ual/CrouchLeft"
		if _direction.y > 0: crouch_move = _sample("ual/CrouchBack", phase * length_of("ual/CrouchBack"), true)
		_blend(crouch_move, _sample(crouch_side, phase * length_of(crouch_side), true), side_weight)
		_blend(low, crouch_move, _move_weight)
		_blend(_pose, low, _crouch_weight)
	base_state = "Crouch" if crouched else ("Move" if speed > 0.15 else "Idle")
	if not grounded:
		var air := _sample("ual/JumpStart", _air_time)
		_blend(air, _sample("ual/AirLoop", _air_time, true), smoothstep(0.12, 0.26, _air_time))
		# Extend during descent using measured vertical velocity, before contact.
		_blend(air, _sample("ual/Land", 0.0), smoothstep(1.5, 5.0, -local_velocity.y))
		_blend(_pose, air, smoothstep(0.0, 0.10, _air_time))
		base_state = "Air"
	elif _land_time < length_of("ual/Land"):
		# Land fades over moving legs rather than freezing locomotion.
		_blend(_pose, _sample("ual/Land", _land_time), (1.0 - smoothstep(0.08, 0.32, _land_time)) * (0.75 if crouched else 1.0))
		base_state = "Land"
	var upper := _sample("Idle_Gun", _clock, true)
	if aim_weight > 0.0: _blend(upper, _sample("Idle_Aim", _clock, true), aim_weight)
	_blend(_pose, upper, 0.85 if aiming else 0.65, _upper)
	_add_clip("ual/Reload", reload_phase * length_of("ual/Reload"), reload_weight, _upper)
	_add_clip("ual/Flinch", _flinch_time, _flinch_strength * (0.35 if action != Action.READY else 0.55), _reaction)
	var chest := _skel.find_bone("Chest")
	_pose[chest].basis *= Basis(Vector3.RIGHT, deg_to_rad(2.4 * recoil))
	_commit()

func _commit() -> void:
	for i in _pose.size():
		_skel.set_bone_pose_position(i, _pose[i].origin)
		_skel.set_bone_pose_rotation(i, _pose[i].basis.get_rotation_quaternion())
		_skel.set_bone_pose_scale(i, Vector3.ONE)
