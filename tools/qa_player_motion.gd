extends "res://tools/qa_motion.gd"
## Same lighting/checkerboard as qa motion, but input drives the real Player.
## One real 60 Hz physics tick per sample; no velocity/position substitution.
## --view=player uses the gameplay camera; side/q34 use an observer.
## --out=/tmp/feel --frames=60,62,64,66,68,72,180,182,184,186,192
## --all-frames optionally records a temporal strip/video source.

class ExamPlayer extends BlockfirePlayer:
	signal tick_done
	func _physics_process(dt: float) -> void:
		super._physics_process(dt)
		set_physics_process(false)
		tick_done.emit()

var player: ExamPlayer
var controls: BlockfireMobileControls
const DT := 1.0 / 60.0

func _build() -> void:
	super._build()
	visual.free()
	var world := camera.get_parent()
	var floor_body := StaticBody3D.new()
	var collision := CollisionShape3D.new()
	var box := BoxShape3D.new()
	box.size = Vector3(200, 1, 200)
	collision.shape = box
	floor_body.add_child(collision)
	floor_body.position.y = -0.5
	world.add_child(floor_body)
	player = ExamPlayer.new()
	world.add_child(player)
	player.set_physics_process(false)
	player.weapon.set_physics_process(false)
	player.visual.set_process(false)
	controls = BlockfireMobileControls.new()
	world.add_child(controls)
	controls.visible = false
	player.mobile_controls = controls
	visual = player.visual
	player.weapon.switch_to(OperatorVisual.WEAPON_IDS.find(weapon))
	Engine.physics_ticks_per_second = 60
	if view != "player": camera.make_current()
	_run.call_deferred()

func _process(_dt: float) -> bool:
	return false # The coroutine samples after each real physics tick.

func _run() -> void:
	for i in 600:
		frame = i
		controls.qa_set_move(Vector2.ZERO)
		controls.aiming = false
		controls.firing = false
		var stage := "Idle"
		if i >= 60 and i < 180:
			stage = "Start / sprint"
			controls.qa_set_move(Vector2.UP)
		elif i >= 180 and i < 240:
			stage = "Reverse / sprint"
			controls.qa_set_move(Vector2.DOWN)
		elif i >= 240 and i < 300:
			stage = "Release / brake"
		elif i >= 300 and i < 360:
			stage = "ADS strafe L"
			controls.qa_set_move(Vector2.LEFT)
			controls.aiming = true
		elif i >= 360 and i < 420:
			stage = "ADS strafe reverse R"
			controls.qa_set_move(Vector2.RIGHT)
			controls.aiming = true
		elif i >= 420 and i < 480:
			stage = "HIP fire"
			controls.firing = true
		elif i >= 480 and i < 540:
			stage = "Reload"
			if i == 480: player.weapon.request_reload()
		elif i >= 540:
			stage = "Switch"
			if i == 540: player.weapon.next_weapon()
		player.set_physics_process(true)
		await player.tick_done
		player.weapon._physics_process(DT)
		visual._process(DT)
		var speed := Vector2(player.velocity.x, player.velocity.z).length()
		if view != "player":
			var yaw: float = {"front": 180.0, "q34": 145.0, "side": 90.0, "back": 0.0}.get(view, 145.0)
			var focus := player.position + Vector3(0, 1.0, 0)
			camera.position = focus + Vector3(sin(deg_to_rad(yaw)) * 4.1, 0.45, cos(deg_to_rad(yaw)) * 4.1)
			camera.look_at(focus)
		label.text = "%s | input real | %s\nframe %d | %.3fs | %.2f m/s | yaw %.1f" % [stage, view, i, i * DT, speed, rad_to_deg(player.rotation.y)]
		if _capture and (_capture_all or _capture_frames.has(i)):
			await RenderingServer.frame_post_draw
			root.get_texture().get_image().save_png("%s/frame_%04d.png" % [out, i])
			print("PLAYER_SAMPLE frame=%d velocity=%s yaw=%.2f phase=%.4f" % [i, player.velocity, rad_to_deg(player.rotation.y), visual.motion.phase])
	controls.release_all()
	preload("res://tools/probe_teardown.gd").quiesce(self)
	quit()
