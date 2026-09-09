extends SceneTree

## Laboratorio de FX de combate (Linux, no forma parte del runtime).
##
## Monta un estudio mínimo (suelo, pared, luz, cámara) y dispara el sistema
## CombatFX directamente, sin bots ni spawn immunity, para poder MIRAR una
## captura determinista del fogonazo, humo, trazadora, chispas, decal y
## casquillo. No toca gameplay ni HUD.
##
## USO:
##   godot --path . --script res://tools/qa_fx_lab.gd -- \
##     --out=/tmp/fx_lab.png --frames=3 [--impact] [--shell]

var _out := "/tmp/fx_lab.png"
var _frames := 3
var _impact := false
var _shell := false
var _weapon_flash := false
var _built := false
var _waited := 0
var _fx: CombatFX
var _muzzle := Vector3(0.55, 1.05, 0.55)
var _target := Vector3(-0.35, 1.15, -3.6)


func _init() -> void:
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--out="):
			_out = a.get_slice("=", 1)
		elif a.begins_with("--frames="):
			_frames = int(a.get_slice("=", 1))
		elif a == "--impact":
			_impact = true
		elif a == "--shell":
			_shell = true
		elif a == "--weapon-flash":
			_weapon_flash = true
	print("QA_FX_LAB out=%s frames=%d impact=%s shell=%s weapon_flash=%s" % [_out, _frames, _impact, _shell, _weapon_flash])


func _process(_delta: float) -> bool:
	if not _built:
		_build()
		_built = true
		# --frames=-1 captura en el mismo frame del build: el fogonazo del arma
		# sólo dura 85 ms y a 20 fps el tween ya lo ha apagado al frame siguiente.
		if _frames < 0:
			return _capture()
		return false
	if _waited < _frames:
		_waited += 1
		return false
	return _capture()


func _capture() -> bool:
	var image := root.get_texture().get_image()
	if image == null or image.is_empty():
		push_error("QA_FX_LAB: viewport sin imagen")
		return true
	image.save_png(_out)
	print("QA_FX_LAB saved %s (%s)" % [_out, image.get_size()])
	return true


func _build() -> void:
	var world := Node3D.new()
	world.name = "FxLab"
	root.add_child(world)

	var env := WorldEnvironment.new()
	var environment := Environment.new()
	environment.background_mode = Environment.BG_COLOR
	environment.background_color = Color(0.13, 0.15, 0.18)
	environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	environment.ambient_light_color = Color(0.55, 0.6, 0.68)
	environment.ambient_light_energy = 0.9
	environment.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	env.environment = environment
	world.add_child(env)

	var key := DirectionalLight3D.new()
	key.rotation_degrees = Vector3(-38.0, 26.0, 0.0)
	key.light_energy = 1.15
	world.add_child(key)

	var ground := MeshInstance3D.new()
	var plane := PlaneMesh.new()
	plane.size = Vector2(14.0, 14.0)
	ground.mesh = plane
	ground.position = Vector3(0.0, 0.0, -1.0)
	ground.material_override = _matte(Color(0.30, 0.31, 0.33))
	world.add_child(ground)

	var wall := MeshInstance3D.new()
	var box := BoxMesh.new()
	box.size = Vector3(7.0, 3.4, 0.25)
	wall.mesh = box
	wall.position = Vector3(0.0, 1.7, -3.8)
	wall.material_override = _matte(Color(0.42, 0.40, 0.38))
	world.add_child(wall)

	if _weapon_flash:
		_build_weapon_flash(world)
		return
	_fx = CombatFX.new()
	_fx.name = "CombatFX"
	world.add_child(_fx)

	var camera := Camera3D.new()
	camera.fov = 58.0
	camera.position = Vector3(-2.35, 1.75, 0.35)
	world.add_child(camera)
	camera.look_at(Vector3(0.1, 1.05, -1.9), Vector3.UP)
	camera.make_current()

	_fx.muzzle_burst(_muzzle, (_target - _muzzle).normalized(), 1.0)
	_fx.tracer(_muzzle, _target)
	if _impact:
		_fx.impact(_target, Vector3(0, 0, 1))
	if _shell:
		_fx.shell_eject(_muzzle - Vector3(0, 0, 0.1), Vector3.RIGHT, Vector3.UP)


## Reproduce el fogonazo REAL del arma (estrella + humo + luz) a 3,25 m de
## cámara y con la escala de asset que usa el juego (0,659 = 0,92/1,397 del
## rifle), que es la condición que se reportó como "ocupa media pantalla".
func _build_weapon_flash(world: Node3D) -> void:
	# El fogonazo del arma dura 85 ms por tween: a 20 fps se consume en un solo
	# frame y no se puede medir. Ralentizar el tiempo del laboratorio lo hace
	# observable sin tocar el código de juego.
	Engine.time_scale = 0.05
	var weapon := WeaponController.new()
	weapon.name = "FlashWeapon"
	world.add_child(weapon)
	var anchor := Node3D.new()
	anchor.name = "MuzzleAnchor"
	anchor.top_level = true
	world.add_child(anchor)
	weapon.muzzle_anchor = anchor
	var muzzle := Vector3(0.0, 1.15, 0.0)
	var scale := 0.659
	anchor.global_transform = Transform3D(Basis.IDENTITY.scaled(Vector3.ONE * scale), muzzle)
	var camera := Camera3D.new()
	camera.fov = 52.0
	camera.position = Vector3(0.0, 1.15, 3.25)
	world.add_child(camera)
	camera.look_at(muzzle, Vector3.UP)
	camera.make_current()
	weapon.call("_show_muzzle_flash")
	weapon.call("_emit_muzzle_fx", weapon.current_definition())


func _matte(color: Color) -> StandardMaterial3D:
	var material := StandardMaterial3D.new()
	material.albedo_color = color
	material.roughness = 0.85
	return material
