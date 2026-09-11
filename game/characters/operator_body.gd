class_name OperatorBody
extends RefCounted

## Pose del personaje: lee el estado de gameplay, lo traduce a intención de
## animación y resuelve brazos y mirada. Es el único que escribe la pose del
## `Skeleton3D` además de `OperatorMotion` (que compone las capas de clip).
##
## Frontera de dueños, en este orden y sin excepciones:
##   intención → `OperatorMotion.evaluate()` → mirada → montaje (`OperatorVisual`)
##   → IK de brazos. `OperatorVisual._process` es el director: llama a cada
##   dueño en ese orden. Aquí NO se monta el arma ni se decide qué ropa se ve.
##
## La animación jamás decide desplazamiento: este archivo LEE la velocidad real
## del actor y declara la clase (sprint). El IK jamás inventa trayectoria de
## arma: apunta a los puntos de agarre que publica el montaje.
##
## Estado propio (no del actor): velocidad del fotograma anterior, mirada
## suavizada y la pose capturada al morir. Antes vivía mezclado en
## `operator_visual.gd` y no se sabía quién mandaba sobre la pose.

## Cuánto baja la raíz al morir para que el cuerpo quede apoyado en el suelo.
const DEATH_DROP := -0.05
## Distancia del hueso de muñeca al centro de la palma en este rig.
const PALM_OFFSET := 0.075

## El cuerpo se hunde al morir; el montaje lee este desplazamiento para
## acompañarlo (el arma no puede quedarse flotando sobre el cadáver).
var base_offset := 0.0

var _previous_speed := 0.0
var _head_look_yaw := 0.0
var _head_look_pitch := 0.0
var _debug_reload_time := 0.0
var _death_weapon_local := Transform3D.IDENTITY
var _death_hand_local := Transform3D.IDENTITY


## Traduce el estado de gameplay del actor a intención para `OperatorMotion`.
## Se llama ANTES de `motion.evaluate()`.
func read_motion_inputs(actor: OperatorVisual, delta: float, speed: float) -> void:
	var motion := actor.motion
	if motion == null:
		return
	motion.crouched = actor.crouched
	motion.aiming = actor.aiming or actor.firing
	motion.sprint_intent = actor.sprinting
	# Frenada: venía con velocidad y la está perdiendo. Se mide aquí porque este
	# es el único punto que ve la velocidad real por fotograma; el gameplay no
	# necesita saber nada de animación para que la parada se lea.
	# La velocidad por defecto la declara el gameplay (avance sobre -Z); si el
	# actor es un CharacterBody3D, manda su velocidad REAL en espacio del actor.
	motion.local_velocity = Vector3(0, 0, -actor.locomotion_speed_scale) if actor.moving else Vector3.ZERO
	var body := actor.get_parent()
	if body is CharacterBody3D:
		motion.local_velocity = body.global_basis.inverse() * body.get_real_velocity()
		motion.grounded = body.is_on_floor()
	var weapon := actor.weapon_controller() as WeaponController
	if weapon != null:
		motion.reload_remaining = weapon.reload_timer
		motion.reload_duration = weapon.current_definition().reload_time
		# El arma activa elige el LENGUAJE visual de recarga; el timer sigue
		# siendo de WeaponController y la animación solo consume progreso.
		motion.reload_weapon_id = weapon.current_definition().id
		motion.switch_remaining = weapon.switching_timer
		if not weapon.weapon_fired.is_connected(actor.confirmed_shot):
			weapon.weapon_fired.connect(actor.confirmed_shot)
	elif actor.debug_force_reload:
		_debug_reload_time = fposmod(_debug_reload_time + delta, 2.0)
		motion.reload_duration = 2.0
		motion.reload_remaining = 2.0 - _debug_reload_time
	else:
		motion.reload_remaining = 0.0
		motion.switch_remaining = 0.0
	# Frenada: venía con velocidad y la está perdiendo. Se mide aquí porque este
	# es el único punto que ve la velocidad real por fotograma; el gameplay no
	# necesita saber nada de animación para que la parada se lea. Ojo: el
	# `delta` de la línea siguiente es la ÚLTIMA velocidad vista por el
	# evaluador, no el tiempo de fotograma (así lo lee `_process`).
	var speed_now := float(motion.local_velocity.length()) if motion.local_velocity != Vector3.ZERO else actor.locomotion_speed_scale
	if speed > 0.0 and _previous_speed - speed_now > 6.0 * speed and speed_now > 0.25:
		motion.braking = true
	_previous_speed = speed_now


## La cabeza sigue el punto de mira sin girar el cuerpo: el torso lo controla
## el gameplay y una cabeza rígida delataba que el personaje era un maniquí.
func update_head_look(actor: OperatorVisual, delta: float) -> void:
	var skeleton := actor.skeleton
	if skeleton == null:
		return
	var head := skeleton.find_bone("Head")
	if head < 0:
		return
	var aim_yaw := actor.debug_head_look.x
	var aim_pitch := actor.debug_head_look.y
	var body := actor.get_parent()
	if body != null and body.get("look_yaw") != null:
		aim_yaw = float(body.get("look_yaw"))
		aim_pitch = float(body.get("look_pitch"))
		var body_yaw := rad_to_deg((body as Node3D).rotation.y)
		aim_yaw = wrapf(aim_yaw - body_yaw, -180.0, 180.0)
	elif body != null:
		return
	_head_look_yaw = lerpf(_head_look_yaw, clampf(aim_yaw, -62.0, 62.0), clampf(delta * 7.0, 0.0, 1.0))
	_head_look_pitch = lerpf(_head_look_pitch, clampf(aim_pitch * 0.45, -22.0, 22.0), clampf(delta * 7.0, 0.0, 1.0))
	var local := skeleton.get_bone_pose(head)
	var yaw_basis := Basis(Vector3.UP, deg_to_rad(_head_look_yaw))
	var pitch_basis := Basis(Vector3.RIGHT, deg_to_rad(-_head_look_pitch))
	skeleton.set_bone_pose_rotation(head, (yaw_basis * pitch_basis * local.basis).get_rotation_quaternion())


## Captura la pose del arma y de la mano en el instante de morir: el cadáver no
## compone clips, así que el arma debe quedarse donde estaba.
func capture_death_pose(actor: OperatorVisual) -> void:
	if actor.skeleton == null or actor.weapon_mount == null:
		return
	var wrist_r := actor.skeleton.find_bone("Wrist.R")
	if wrist_r >= 0:
		var wrist_global := actor.skeleton.global_transform * actor.skeleton.get_bone_global_pose(wrist_r)
		_death_weapon_local = wrist_global.affine_inverse() * actor.weapon_mount.global_transform
	var wrist_l := actor.skeleton.find_bone("Wrist.L")
	if wrist_l >= 0 and is_instance_valid(actor.left_fist()):
		var wrist_l_global := actor.skeleton.global_transform * actor.skeleton.get_bone_global_pose(wrist_l)
		_death_hand_local = wrist_l_global.affine_inverse() * actor.left_fist().global_transform


## Acompaña el hundimiento del cuerpo al morir y devuelve la altura aplicada a
## la raíz, que el montaje del arma necesita para no quedarse flotando.
func update_death_drop(actor: OperatorVisual, delta: float) -> float:
	if actor.model_root == null:
		return base_offset
	actor.model_root.position.y = move_toward(actor.model_root.position.y, DEATH_DROP, delta * 0.1)
	base_offset = actor.model_root.position.y
	return base_offset


func death_weapon_local() -> Transform3D:
	return _death_weapon_local


func death_hand_local() -> Transform3D:
	return _death_hand_local


## Une la muñeca con el punto de agarre que publica el montaje. El puño vive en
## el arma, así que el IK apunta al arma y no al revés.
func solve_arms_ik(actor: OperatorVisual) -> void:
	var skeleton := actor.skeleton
	if skeleton == null or actor.weapon_mount == null or not actor.ik_enabled or actor.mounted_weapon() == null:
		return
	var weapon_id := actor.equipped_weapon_id
	var config: Dictionary = OperatorVisual.WEAPON_CONFIG.get(weapon_id, {})
	var grip_world := actor.weapon_mount.global_transform * (config.get("grip", Vector3.ZERO) as Vector3)
	var foregrip_world := actor.weapon_mount.global_transform * (config.get("foregrip", Vector3.ZERO) as Vector3)
	var pole_r: Vector3 = config.get("pole_r", Vector3(-0.55, -1.0, -0.30))
	var pole_l: Vector3 = config.get("pole_l", Vector3(0.55, -1.0, -0.30))
	_solve_arm_ik(actor, "R", grip_world, pole_r)
	# The authored hand path is a continuous offset from support grip. Both
	# arms retain the same solver and elbow plane throughout the whole reload.
	var target := foregrip_world
	var motion := actor.motion
	if motion != null and motion.reload_weight > 0.0:
		# La clase de recarga la decide OperatorMotion a partir del weapon_id;
		# aquí solo se consume para elegir el recorrido de mano publicado.
		var path := OperatorVisual.reload_hand_offset(motion.reload_phase, motion.reload_class())
		target += actor.weapon_mount.global_basis * path * motion.reload_weight
	_solve_arm_ik(actor, "L", target, pole_l)
	var left := actor.left_fist()
	var right := actor.right_fist()
	if is_instance_valid(left): left.global_position = target
	if is_instance_valid(right): right.global_position = grip_world


func _solve_arm_ik(actor: OperatorVisual, side: String, target_world: Vector3, pole: Vector3) -> void:
	var skeleton := actor.skeleton
	var upper := skeleton.find_bone("UpperArm." + side)
	var lower := skeleton.find_bone("LowerArm." + side)
	var wrist := skeleton.find_bone("Wrist." + side)
	if upper < 0 or lower < 0 or wrist < 0:
		return
	var target := skeleton.global_transform.affine_inverse() * target_world
	var config: Dictionary = OperatorVisual.WEAPON_CONFIG.get(actor.equipped_weapon_id, {})
	if side == "L" and config.has("support_wrist"):
		# The cupped palm has a fixed wrist socket in weapon space. Solving
		# that socket keeps the forearm attached through ADS and lateral lean.
		target = skeleton.global_transform.affine_inverse() * (target_world + actor.weapon_mount.global_basis * (config.support_wrist as Vector3))
		_two_bone_ik(actor, upper, lower, wrist, target, pole)
		return
	# La malla de la mano sobresale ~7 cm del hueso de muñeca: el IK apunta a
	# la PALMA (objetivo retrocedido a lo largo del brazo), no a la muñeca,
	# para que el arma caiga dentro de la mano y no delante de los dedos.
	var shoulder := skeleton.get_bone_global_pose(upper).origin
	var to_target := target - shoulder
	if to_target.length() > 0.001:
		target -= to_target.normalized() * PALM_OFFSET
	_two_bone_ik(actor, upper, lower, wrist, target, pole)


func _two_bone_ik(actor: OperatorVisual, root_idx: int, mid_idx: int, end_idx: int, target: Vector3, pole: Vector3) -> void:
	var skeleton := actor.skeleton
	var root_pose := skeleton.get_bone_global_pose(root_idx)
	var mid_pose := skeleton.get_bone_global_pose(mid_idx)
	var end_pose := skeleton.get_bone_global_pose(end_idx)
	var s := root_pose.origin
	var e := mid_pose.origin
	var w := end_pose.origin
	var l1 := s.distance_to(e)
	var l2 := e.distance_to(w)
	if l1 <= 0.0001 or l2 <= 0.0001:
		return
	var to_target := target - s
	var d := clampf(to_target.length(), absf(l1 - l2) + 0.005, l1 + l2 - 0.012)
	var dir := to_target / maxf(to_target.length(), 0.0001)
	target = s + dir * d
	var axis := dir.cross(pole.normalized())
	if axis.length() < 0.001:
		axis = dir.cross(Vector3.RIGHT if absf(dir.x) < 0.9 else Vector3.UP)
	axis = axis.normalized()
	var cos_a := clampf((l1 * l1 + d * d - l2 * l2) / (2.0 * l1 * d), -1.0, 1.0)
	var elbow_dir := dir.rotated(axis, acos(cos_a))
	var elbow := s + elbow_dir * l1
	var root_delta := _rotation_between(e - s, elbow - s)
	var new_root := Transform3D(Basis(root_delta) * root_pose.basis, s)
	# La dirección del antebrazo se mide DESPUÉS de la rotación del hombro.
	var mid_delta := _rotation_between(root_delta * (w - e), target - elbow)
	var new_mid := Transform3D(Basis(mid_delta) * Basis(root_delta) * mid_pose.basis, elbow)
	var parent_global := Transform3D.IDENTITY
	var parent_idx := skeleton.get_bone_parent(root_idx)
	if parent_idx >= 0:
		parent_global = skeleton.get_bone_global_pose(parent_idx)
	var local_root := parent_global.affine_inverse() * new_root
	var local_mid := new_root.affine_inverse() * new_mid
	# Solo rotación: la longitud del hueso en un rig skinned es fija.
	skeleton.set_bone_pose_rotation(root_idx, local_root.basis.get_rotation_quaternion())
	skeleton.set_bone_pose_rotation(mid_idx, local_mid.basis.get_rotation_quaternion())
	# Orientación de la muñeca: el pack trae la mano abierta y plana; se gira
	# para que la palma mire al arma en vez de al suelo.
	var wrist_rot: Vector3 = OperatorVisual.WEAPON_CONFIG.get(actor.equipped_weapon_id, {}).get("wrist_rot", Vector3.ZERO)
	var extra := Basis.from_euler(Vector3(deg_to_rad(wrist_rot.x), deg_to_rad(wrist_rot.y), deg_to_rad(wrist_rot.z)))
	var wrist_local := skeleton.get_bone_pose(end_idx)
	skeleton.set_bone_pose_rotation(end_idx, (extra * wrist_local.basis).get_rotation_quaternion())


func _rotation_between(from: Vector3, to: Vector3) -> Quaternion:
	var a := from.normalized()
	var b := to.normalized()
	if a.length_squared() < 0.0001 or b.length_squared() < 0.0001:
		return Quaternion.IDENTITY
	var dot := clampf(a.dot(b), -1.0, 1.0)
	if dot > 0.9999:
		return Quaternion.IDENTITY
	if dot < -0.9999:
		var fallback := a.cross(Vector3.UP)
		if fallback.length() < 0.001:
			fallback = a.cross(Vector3.RIGHT)
		return Quaternion(fallback.normalized(), PI)
	return Quaternion(a.cross(b).normalized(), acos(dot))
