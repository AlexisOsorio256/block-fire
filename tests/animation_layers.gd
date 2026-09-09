extends SceneTree
var failures := 0
func check(value: bool, message: String) -> void:
	if not value:
		failures += 1
		push_error(message)

func _init() -> void:
	call_deferred("run")

func run() -> void:
	var v := OperatorVisual.new()
	root.add_child(v)
	v.configure("BRAVO", "ally", Color.CYAN, {}, true)
	v.set_process(false)
	v.debug_manual_state = true
	var m := v.motion
	check(not v.animation_player.active, "No parallel animation clock")
	for clip in ["Reload","StrafeLeft","StrafeRight","CrouchWalk","JumpStart","AirLoop","Land"]:
		check(v.animation_player.has_animation("ual/"+clip), "Required clip "+clip)
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
	print("ANIMATION_LAYERS: ","PASS" if failures == 0 else "FAIL", " failures=",failures)
	quit(0 if failures == 0 else 1)
