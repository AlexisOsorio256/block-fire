extends SceneTree

## Laboratorio del feedback de HUD (no forma parte del runtime).
##
## Monta el HUD real con un contexto de partida falso y dispara los eventos de
## feedback a mano (impacto, headshot, baja, munición baja y recarga) para
## poder MIRAR una captura determinista del hit marker, los números de daño
## flotantes, el kill feed y el indicador de recarga.
##
## USO:
##   godot --path . --script res://tools/qa_hud_lab.gd -- --out=/tmp/hud_lab.png [--frames=4]


class FakePlayer:
	extends Node3D
	var weapon: Node
	var camera: Camera3D


class FakeContext:
	extends Node
	var player: Node


var _out := "/tmp/hud_lab.png"
var _frames := 4
var _built := false
var _waited := 0


func _init() -> void:
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--out="):
			_out = a.get_slice("=", 1)
		elif a.begins_with("--frames="):
			_frames = int(a.get_slice("=", 1))
	print("QA_HUD_LAB out=%s frames=%d" % [_out, _frames])


func _process(_delta: float) -> bool:
	if not _built:
		_build()
		_built = true
		return false
	if _waited < _frames:
		_waited += 1
		return false
	var image := root.get_texture().get_image()
	if image == null or image.is_empty():
		push_error("QA_HUD_LAB: viewport sin imagen")
		return true
	image.save_png(_out)
	print("QA_HUD_LAB saved %s (%s)" % [_out, image.get_size()])
	return true


func _build() -> void:
	var backdrop := ColorRect.new()
	backdrop.color = Color(0.10, 0.13, 0.17)
	backdrop.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	backdrop.z_index = -10
	root.add_child(backdrop)

	var weapon := WeaponController.new()
	weapon.name = "FakeWeapon"
	root.add_child(weapon)
	var fake_player := FakePlayer.new()
	fake_player.name = "FakePlayer"
	fake_player.weapon = weapon
	root.add_child(fake_player)
	var fake_camera := Camera3D.new()
	fake_camera.name = "FakeCamera"
	fake_player.add_child(fake_camera)
	fake_camera.global_transform = Transform3D.IDENTITY
	fake_player.camera = fake_camera
	var attacker := Node3D.new()
	attacker.name = "FakeAttacker"
	root.add_child(attacker)
	attacker.global_position = Vector3(-7.0, 0.0, -1.5)
	var context := FakeContext.new()
	context.name = "FakeContext"
	context.player = fake_player
	root.add_child(context)

	var hud := BlockfireHud.new()
	hud.name = "FakeHud"
	root.add_child(hud)
	hud.setup(context, true)

	# Eventos a mirar: munición baja + recarga en curso.
	hud.update_ammo(3, 42, weapon.current_definition())
	weapon.reload_timer = 1.05
	# Impacto normal, headshot y baja (hit marker + popups + kill feed).
	hud.show_hit_feedback(23.0, false)
	hud.show_hit_feedback(61.0, true)
	hud.show_kill(true)
	# Daño recibido desde la izquierda: viñeta + aviso direccional.
	hud.show_damage("-18", false, attacker)
