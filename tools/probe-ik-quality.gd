extends SceneTree
## Auditoría del IK de brazos por arma y por estado (HALLAZGOS §27): ángulo de
## codo, hiperextensión, colapso de hombro y saltos de plano (flip de codo).
## USO: godot --headless --path . --script res://tools/probe-ik-quality.gd
const STATES := ["HIP", "ADS", "RELOAD", "STRAFE", "CROUCH"]
const ARM_LENGTH := 0.433  # UpperArm + LowerArm medidos en el rig

func _init() -> void:
	call_deferred("run")

func run() -> void:
	var v := OperatorVisual.new()
	root.add_child(v)
	v.configure("BRAVO", "ally", Color.CYAN, {}, true)
	v.set_process(false)
	v.debug_manual_state = true
	var m := v.motion
	print("%-9s %-7s %8s %8s %8s %8s %8s %10s" % ["weapon", "state", "min_elbow", "max_elbow", "max_flip", "hyperext", "wrist_err", "socket_err"])
	for weapon: String in OperatorVisual.WEAPON_IDS:
		v.set_equipped_weapon(weapon)
		for state: String in STATES:
			m.reset()
			m.crouched = state == "CROUCH"
			m.aiming = state == "ADS"
			m.local_velocity = Vector3(-4.8, 0, 0) if state == "STRAFE" else (Vector3(0, 0, -2.6) if state == "CROUCH" else Vector3.ZERO)
			m.sprint_intent = false
			var min_elbow := 999.0
			var max_elbow := -999.0
			var max_flip := 0.0
			var max_hyper := 0.0
			var worst_wrist := 0.0
			var worst_socket := 0.0
			var previous_plane := {"L": Vector3.ZERO, "R": Vector3.ZERO}
			for frame in 240:
				if state == "RELOAD":
					m.reload_duration = 2.0
					m.reload_remaining = maxf(0.0, 2.0 - fposmod(frame / 60.0, 2.4))
				v._process(1.0 / 60.0)
				for side in ["L", "R"]:
					var upper := v.skeleton.find_bone("UpperArm." + side)
					var lower := v.skeleton.find_bone("LowerArm." + side)
					var wrist := v.skeleton.find_bone("Wrist." + side)
					var s := v.skeleton.get_bone_global_pose(upper).origin
					var e := v.skeleton.get_bone_global_pose(lower).origin
					var w := v.skeleton.get_bone_global_pose(wrist).origin
					var a := (s - e).normalized()
					var b := (w - e).normalized()
					var elbow := rad_to_deg(acos(clampf(a.dot(b), -1.0, 1.0)))
					min_elbow = minf(min_elbow, elbow)
					max_elbow = maxf(max_elbow, elbow)
					var reach := s.distance_to(w) / ARM_LENGTH
					max_hyper = maxf(max_hyper, reach)
					# Plano del codo: normal de (s-e, w-e). Un flip lo invierte.
					var plane := a.cross(b)
					var previous: Vector3 = previous_plane[side]
					if plane.length() > 0.001 and previous.length() > 0.001:
						max_flip = maxf(max_flip, rad_to_deg(acos(clampf(plane.normalized().dot(previous.normalized()), -1.0, 1.0))))
					if plane.length() > 0.001:
						previous_plane[side] = plane
					if side == "L" and is_instance_valid(v._left_fist):
						var wrist_world := v.skeleton.global_transform * w
						worst_wrist = maxf(worst_wrist, wrist_world.distance_to(v._left_fist.global_position))
						var config: Dictionary = OperatorVisual.WEAPON_CONFIG[weapon]
						if config.has("support_wrist"):
							var socket := v._left_fist.global_position + v.weapon_mount.global_basis * (config.support_wrist as Vector3)
							worst_socket = maxf(worst_socket, wrist_world.distance_to(socket))
			print("%-9s %-7s %8.1f %8.1f %8.1f %8.3f %8.3f %10.4f" % [weapon, state, min_elbow, max_elbow, max_flip, max_hyper, worst_wrist, worst_socket])
			if weapon == "rifle" and state == "HIP":
				# Reference measured on the normalized rifle mesh: underside of the
				# rear handguard. AABB clearance is a contact proxy; inspect the hand too.
				var contact := Vector3(0.0, 0.172533, 0.28) * (0.86 / 0.92)
				var palm := v._left_fist.get_child(0) as MeshInstance3D
				var bounds := (v.weapon_mount.global_transform.affine_inverse() * palm.global_transform) * palm.get_aabb()
				print("RIFLE_PALM_HANDGUARD clearance_mm=%.3f" % (1000.0 * contact.distance_to(contact.clamp(bounds.position, bounds.end))))
	v.free()
	quit(0)
