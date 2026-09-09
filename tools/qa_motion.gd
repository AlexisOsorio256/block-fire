extends SceneTree
## Integrated motion exam. Fixed 30 Hz, actual OperatorVisual + weapon + IK.
## --mode=sequence|locomotion|reload|air|combat --view=front|q34|side|back
## --out=captures/post-astra/final --weapon=rifle --duration=24
##
## Speeds are GAMEPLAY speeds (player.gd: walk 4.8, sprint 7.0, crouch 2.6) and
## every label means the gameplay action, never the clip's own implied speed.
## The clip's implied speed is declared in locomotion_speeds.json by the Blender
## pipeline; the runtime scales playback from the two.
const WALK := 4.8
const SPRINT := 7.0
const CROUCH := 2.6
var visual: OperatorVisual
var camera: Camera3D
var label: Label
var frame := 0
var out := "captures/post-astra/final"
var mode := "sequence"
var view := "q34"
var weapon := "rifle"
var duration := 24.0
var _ready_lab := false
var _death_sent := false
var _shot_frame := -100
var _capture := true

func _init() -> void:
	for arg in OS.get_cmdline_user_args():
		if arg.begins_with("--out="): out = arg.get_slice("=", 1)
		if arg.begins_with("--mode="): mode = arg.get_slice("=", 1)
		if arg.begins_with("--view="): view = arg.get_slice("=", 1)
		if arg.begins_with("--weapon="): weapon = arg.get_slice("=", 1)
		if arg.begins_with("--duration="): duration = float(arg.get_slice("=", 1))
		if arg == "--no-capture": _capture = false
	DirAccess.make_dir_recursive_absolute(out)
	root.size = Vector2i(960, 540)
	_build.call_deferred()

func _build() -> void:
	var world := Node3D.new()
	root.add_child(world)
	var env := WorldEnvironment.new()
	env.environment = Environment.new()
	env.environment.background_mode = Environment.BG_COLOR
	env.environment.background_color = Color("#303941")
	env.environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.environment.ambient_light_color = Color.WHITE
	env.environment.ambient_light_energy = 0.7
	world.add_child(env)
	var light := DirectionalLight3D.new()
	light.rotation_degrees = Vector3(-45, 25, 0)
	light.light_energy = 1.4
	light.shadow_enabled = true
	world.add_child(light)
	var ground := MeshInstance3D.new()
	var mesh := PlaneMesh.new()
	mesh.size = Vector2(200,200)
	ground.mesh = mesh
	var material := ShaderMaterial.new()
	material.shader = Shader.new()
	material.shader.code = "shader_type spatial; varying vec3 p; void vertex(){p=(MODEL_MATRIX*vec4(VERTEX,1.)).xyz;} void fragment(){float v=mod(floor(p.x*2.)+floor(p.z*2.),2.); ALBEDO=mix(vec3(.21,.24,.26),vec3(.31,.34,.36),v);ROUGHNESS=1.;}"
	ground.material_override = material
	world.add_child(ground)
	visual = OperatorVisual.new()
	visual.configure("BRAVO", "ally", Color.CYAN, {}, true)
	world.add_child(visual)
	visual.set_showcase_mode(true)
	visual.set_equipped_weapon(weapon)
	visual.set_process(false)
	visual.debug_manual_state = true
	camera = Camera3D.new()
	camera.fov = 40
	world.add_child(camera)
	camera.make_current()
	label = Label.new()
	label.position = Vector2(22,18)
	label.add_theme_font_size_override("font_size", 22)
	root.add_child(label)
	_ready_lab = true

func _process(_delta: float) -> bool:
	if not _ready_lab: return false
	if frame >= int(duration * 30): return true
	var t := frame / 30.0
	var m := visual.motion
	m.local_velocity = Vector3.ZERO
	m.aiming = false
	m.crouched = false
	m.grounded = true
	m.sprint_intent = false
	m.reload_remaining = 0
	m.switch_remaining = 0
	var stage := "Idle"
	var fire := false
	if mode == "reload":
		m.local_velocity = Vector3(0,0,-WALK) if t > 3 else Vector3.ZERO
		m.reload_duration = 2.0
		m.reload_remaining = 2.0 - fposmod(t, 3.0) if fposmod(t,3.0) < 2.0 else 0.0
		stage = "Reload / moving reload"
	elif mode == "locomotion":
		var index := int(t / 2.0) % 8
		var vectors := [Vector3(0,0,-WALK),Vector3(0,0,-SPRINT),Vector3(-WALK,0,0),Vector3(WALK,0,0),
			Vector3(3.4,0,-3.4),Vector3(0,0,WALK),Vector3(0,0,-CROUCH),Vector3(-CROUCH,0,0)]
		m.local_velocity = vectors[index]
		m.sprint_intent = index == 1
		m.crouched = index > 5
		m.aiming = index > 2
		stage = ["Walk 4.8", "Sprint 7.0", "Strafe L 4.8", "Strafe R 4.8",
			"Diagonal 4.8", "Back 4.8", "Crouch 2.6", "Crouch strafe 2.6"][index]
	elif mode == "air":
		var cycle := fposmod(t,2.0)
		m.grounded = cycle >= 0.8
		m.local_velocity = Vector3(0,0,-WALK) if t > 2 else Vector3.ZERO
		m.local_velocity.y = 8.4-22*cycle if not m.grounded else 0.0
		visual.position.y = maxf(0.0, 8.4*cycle-11*cycle*cycle) if not m.grounded else 0.0
		fire = t > 4
		stage = "Jump / air / land"
	elif mode == "combat":
		m.aiming = fposmod(t,2) > 1
		fire = t > 1
		m.local_velocity = Vector3(-WALK,0,0) if t > 3 else Vector3.ZERO
		if frame % 60 == 0: visual.flinch()
		stage = "HIP / ADS / fire / flinch"
	else:
		if t < 2: stage = "Idle"
		elif t < 4:
			stage = "Walk 4.8"; m.local_velocity = Vector3(0,0,-WALK)
		elif t < 6:
			stage = "Sprint 7.0"; m.local_velocity = Vector3(0,0,-SPRINT); m.sprint_intent = true
		elif t < 8:
			stage = "Strafe L 4.8 / ADS"; m.local_velocity = Vector3(-WALK,0,0); m.aiming = t > 7
		elif t < 10:
			stage = "Fire / diagonal 4.8"; m.local_velocity = Vector3(3.4,0,-3.4); m.aiming = true; fire = true
		elif t < 12:
			stage = "Reload while moving 4.8 + hit"; m.local_velocity = Vector3(0,0,-WALK); m.reload_duration = 2; m.reload_remaining = 12-t
			if frame == 330: visual.flinch()
		elif t < 14:
			stage = "ADS / crouch 2.6"; m.crouched = true; m.aiming = true; m.local_velocity = Vector3(-CROUCH,0,-CROUCH)
		elif t < 15: stage = "Stand"
		elif t < 15.8:
			stage = "Jump / air"; m.grounded = false; var jump := t-15; m.local_velocity.y = 8.4-22*jump; visual.position.y = maxf(0,8.4*jump-11*jump*jump)
		elif t < 18:
			stage = "Land / fire / run 4.8"; visual.position.y = 0; m.local_velocity = Vector3(0,0,-WALK); fire = true
		elif t < 20:
			stage = "Switch / sprint 7.0"; m.local_velocity = Vector3(0,0,-SPRINT); m.sprint_intent = true; m.switch_remaining = maxf(0,18.34-t)
		elif t < 21:
			stage = "Reload → Death"; m.reload_duration = 2; m.reload_remaining = 22-t
		else:
			stage = "Death (all layers blocked)"
			if not _death_sent: visual.play_death(); _death_sent = true
	if fire and frame - _shot_frame >= (24 if weapon == "shotgun" else (9 if weapon == "pistol" else 3)):
		visual.confirmed_shot(); _shot_frame = frame
	# Actor moves in world; camera follows. Checkerboard exposes foot sliding.
	# local_velocity es espacio del actor (-Z delante): se convierte con su basis.
	# El signo invertido hacía patinar los pies al revés y ocultaba el error.
	visual.position += visual.global_basis * m.local_velocity / 30.0
	visual._process(1.0/30.0)
	var yaw := {"front":0.0,"q34":35.0,"side":90.0,"back":180.0}.get(view,35.0) as float
	var focus := Vector3(visual.position.x,1.0+visual.position.y*0.7,visual.position.z)
	camera.position = focus + Vector3(sin(deg_to_rad(yaw))*4.1,.45,cos(deg_to_rad(yaw))*4.1)
	camera.look_at(focus)
	label.text = "%s  ·  %s  ·  %s\n%.2fs  |  %.1f m/s  |  sprint %.2f  |  reload %.2f" % [stage,weapon,view,t,Vector2(m.local_velocity.x,m.local_velocity.z).length(),m._sprint_weight,m.reload_phase]
	if _capture:
		_capture_frame.call_deferred(frame)
	frame += 1
	return false

func _capture_frame(index: int) -> void:
	await RenderingServer.frame_post_draw
	var img := root.get_texture().get_image()
	img.save_png("%s/frame_%04d.png" % [out,index])
