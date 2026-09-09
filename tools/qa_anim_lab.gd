extends SceneTree

## Laboratorio de clips de animación (no forma parte del runtime).
##
## Carga el rig real del personaje, le inyecta el clip externo de
## `assets/models/animation_library/` y renderiza N frames del clip para poder
## MIRARLOS. Imprime huesos, nombre del clip, duración y las primeras pistas
## para que el integrador verifique el contrato sin abrir Blender.
##
## USO:
##   godot --path . --script res://tools/qa_anim_lab.gd -- \
##     --clip=Reload --out=/tmp/anim.png --times=0.0,0.7 --view=q34

const CHARACTER := "res://assets/models/skins/operator_adult_lod.glb"

var _clip := "ReloadRifle"
var _out := "/tmp/anim.png"
var _times: Array[float] = [0.0, 0.7]
var _view := "q34"
var _built := false
var _index := 0
var _player: AnimationPlayer
var _camera: Camera3D
var _subject: Node3D
var _waited := 0


func _init() -> void:
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--clip="):
			_clip = a.get_slice("=", 1)
		elif a.begins_with("--out="):
			_out = a.get_slice("=", 1)
		elif a.begins_with("--view="):
			_view = a.get_slice("=", 1)
		elif a.begins_with("--times="):
			_times.clear()
			for t in a.get_slice("=", 1).split(",", false):
				_times.append(float(t.strip_edges()))
	print("QA_ANIM_LAB clip=%s out=%s times=%s" % [_clip, _out, _times])


func _process(_delta: float) -> bool:
	if not _built:
		_build()
		_built = true
		_apply_time(_times[0])
		return false
	if _waited < 3:
		_waited += 1
		return false
	_waited = 0
	var path := _out
	if _times.size() > 1:
		path = "%s_t%.2f.%s" % [_out.get_basename(), _times[_index], _out.get_extension()]
	var image := root.get_texture().get_image()
	if image == null or image.is_empty():
		push_error("QA_ANIM_LAB: viewport sin imagen")
		return true
	image.save_png(path)
	print("QA_ANIM_LAB saved %s" % path)
	_index += 1
	if _index >= _times.size():
		return true
	_apply_time(_times[_index])
	return false


func _apply_time(t: float) -> void:
	if _player != null:
		var name := _clip if _player.has_animation(_clip) else "qa/" + _clip
		_player.play(name)
		_player.seek(t, true)
		_player.pause()


func _build() -> void:
	var world := Node3D.new()
	root.add_child(world)
	var env := WorldEnvironment.new()
	var environment := Environment.new()
	environment.background_mode = Environment.BG_COLOR
	environment.background_color = Color(0.15, 0.16, 0.19)
	environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	environment.ambient_light_color = Color(0.65, 0.68, 0.74)
	environment.ambient_light_energy = 0.95
	env.environment = environment
	world.add_child(env)
	var key := DirectionalLight3D.new()
	key.rotation_degrees = Vector3(-42.0, 38.0, 0.0)
	key.light_energy = 1.3
	world.add_child(key)

	var visual := OperatorVisual.new()
	visual.configure("BRAVO", "ally", Color.CYAN, {}, true)
	visual.set_showcase_mode(true)
	world.add_child(visual)
	visual.set_process(false)
	_subject = visual
	_player = visual.animation_player
	_player.active = true
	if not _player.has_animation(_clip):
		var copied := _player.get_animation("ual/" + _clip)
		if copied == null:
			push_error("Missing clip: " + _clip)
			return
		var library := AnimationLibrary.new()
		library.add_animation(_clip, copied)
		_player.add_animation_library("qa", library)
	_build_camera(world)


func _build_camera(world: Node3D) -> void:
	_camera = Camera3D.new()
	_camera.fov = 40.0
	world.add_child(_camera)
	_camera.make_current()
	var yaw := 35.0 if _view == "q34" else (90.0 if _view == "side" else (180.0 if _view == "back" else 0.0))
	var focus := Vector3(0.0, 1.15, 0.0)
	var distance := 3.4
	var dir := Vector3(sin(deg_to_rad(yaw)), 0.0, cos(deg_to_rad(yaw)))
	_camera.global_position = focus + dir * distance + Vector3(0.0, 0.35, 0.0)
	_camera.look_at(focus, Vector3.UP)
