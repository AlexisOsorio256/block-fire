extends SceneTree
## Laboratorio Linux: lanza el juego N frames en un modo y guarda PNG.
## USO:
##   godot --path . --script res://tools/qa_shot.gd -- \
##     --out=/tmp/x.png --frames=180 --mode=lobby|squad|ffa \
##     --pos=x,y,z --yaw=grados --pitch=grados --ads --fire --reload \
##     --operator=BRAVO --skin=Oro --weapon=rifle --mobile --combat \
##     --editor --reload-at=N --switch-at=N
## No forma parte del runtime del juego.

var _out := "/tmp/bf_shot.png"
var _frames := 0
var _mode := ""
var _pos := Vector3.INF
var _yaw := 0.0
var _pitch := 0.0
var _ads := false
var _fire := false
var _reload := false
var _operator := "BRAVO"
var _skin := "Estándar"
var _weapon_id := ""
var _mobile := false
var _combat := false
var _editor := false
var _reload_at := -1
var _switch_at := -1
var _reload_pressed := false
var _switch_pressed := false
var _ads_pressed := false
var _keepalive := false
var _started := false
var _shot_done := false
var _app: Node = null
var _player: Node = null
var _controls: Node = null

func _init() -> void:
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--out="):
			_out = a.get_slice("=", 1)
		elif a.begins_with("--frames="):
			_frames = int(a.get_slice("=", 1))
		elif a.begins_with("--mode="):
			_mode = a.get_slice("=", 1)
		elif a.begins_with("--pos="):
			var p := a.get_slice("=", 1).split_floats(",")
			if p.size() == 3:
				_pos = Vector3(p[0], p[1], p[2])
		elif a.begins_with("--yaw="):
			_yaw = float(a.get_slice("=", 1))
		elif a.begins_with("--pitch="):
			_pitch = float(a.get_slice("=", 1))
		elif a.begins_with("--operator="):
			_operator = a.get_slice("=", 1)
		elif a.begins_with("--skin="):
			_skin = a.get_slice("=", 1)
		elif a.begins_with("--weapon="):
			_weapon_id = a.get_slice("=", 1)
		elif a.begins_with("--reload-at="):
			_reload_at = int(a.get_slice("=", 1))
		elif a.begins_with("--switch-at="):
			_switch_at = int(a.get_slice("=", 1))
		elif a == "--ads":
			_ads = true
		elif a == "--fire":
			_fire = true
		elif a == "--reload":
			_reload = true
		elif a == "--mobile":
			_mobile = true
		elif a == "--combat":
			_combat = true
		elif a == "--keepalive":
			# Laboratorio: mantiene vivo al jugador para capturar viewmodel/flash
			# (los bots FFA matan al jugador inactivo en ~2 s).
			_keepalive = true
		elif a == "--editor":
			_editor = true
	print("QA_SHOT out=%s frames=%d mode=%s op=%s skin=%s weapon=%s" % [_out, _frames, _mode, _operator, _skin, _weapon_id])

func _process(_delta: float) -> bool:
	# Espera activa hasta que exista una ventana renderizada antes de capturar.
	if _frames > 0:
		_frames -= 1
		_tick()
		return false
	if not _shot_done:
		if not root.is_visible():
			return false
		var img := root.get_texture().get_image()
		if img == null or img.is_empty():
			return false
		_shot_done = true
		_save_shot()
		return true
	return false

func _tick() -> void:
	var tree_root := root
	if _app == null:
		_app = tree_root.get_node_or_null("Blockfire")
		if _app == null:
			var scene: PackedScene = load("res://game/app.tscn")
			if scene == null:
				return
			# El lobby y el gameplay leen el skin desde SettingsStore; se fija
			# ANTES de añadir la app para que el lobby no lea el valor viejo.
			var settings: Node = tree_root.get_node_or_null("/root/SettingsStore")
			if settings != null:
				settings.set_value("weapon_skin", _skin)
				settings.set_value("operator", _operator)
			_app = scene.instantiate()
			tree_root.add_child(_app)
		return
	# start_requested es una SIGNAL del lobby, no un método: has_method() es
	# siempre false para señales en Godot 4 y el arranque QA nunca se dispara.
	if not _started and _mode != "" and _mode != "lobby" and _app.get("current_screen") != null and _app.current_screen.has_signal("start_requested"):
		_started = true
		if _mobile:
			# mobile_qa debe estar en app ANTES de _start_match: hud.setup solo
			# crea MobileControls si mobile_qa o pantalla táctil.
			_app.set("mobile_qa", true)
		if _combat:
			_app.set("qa_combat", true)
		if _editor:
			_app.set("qa_editor", true)
		_app.call("_start_match", "ffa" if _mode == "ffa" else "squad", _operator, _skin)
		return
	if _player == null and _app.get("current_screen") != null:
		_player = _app.current_screen.get_node_or_null("Player")
	if _player == null:
		return
	if _pos != Vector3.INF and _player is Node3D:
		_player.global_position = _pos
	if _keepalive and bool(_player.get("is_alive")):
		_player.set("health", _player.get("max_health"))
	elif _keepalive and not bool(_player.get("is_alive")):
		# Resurrección mínima de laboratorio si ya murió en frames previos.
		_player.set("is_alive", true)
		_player.set("health", _player.get("max_health"))
	if _yaw != 0.0 or _pitch != 0.0:
		# El jugador trabaja look_yaw/look_pitch en GRADOS (rotation_degrees.y,
		# pitch limitado a -78..78): pasar tal cual, sin conversion.
		_player.set("look_yaw", _yaw)
		_player.set("look_pitch", clampf(_pitch, -78.0, 78.0))
	var weapon: Node = _player.get("weapon")
	if _weapon_id != "" and weapon != null:
		var ids := ["rifle", "pistol", "shotgun", "smg"]
		var index := ids.find(_weapon_id)
		# Re-emitir switch_to cada frame reinicia switching_timer y el arma
		# jamas dispara: solo cambiar si el arma activa es otra.
		if index >= 0 and weapon.has_method("switch_to") and _switch_at <= 0 and weapon.get("active_index") != index:
			weapon.call("switch_to", index)
	if _switch_at > 0 and _frames <= _switch_at and not _switch_pressed and weapon != null:
		_switch_pressed = true
		var ids := ["rifle", "pistol", "shotgun", "smg"]
		var index := ids.find(_weapon_id)
		if index >= 0:
			weapon.call("switch_to", index)
	if _controls == null:
		_controls = _player.get("mobile_controls")
	if _controls == null:
		return
	if _fire:
		# El jugador sobrescribe fire_held cada tick fisico con is_firing();
		# hay que re-pulsar cada frame como un dedo real mantenido.
		# Disparar primero garantiza combate activo y keepalive antes del ADS.
		_controls.call("qa_press_fire")
	if _ads and not _ads_pressed and _frames <= 100:
		# qa_press_aim es un latch (aiming = not aiming): una sola pulsacion,
		# llamarlo cada frame alterna ADS on/off y arruina la captura.
		# Tras fire (combate activo), frames<=100 asegura el latch estable.
		_ads_pressed = true
		_controls.call("qa_press_aim")
	if _reload and not _reload_pressed:
		_reload_pressed = true
		_controls.call("qa_press_reload")
	if _reload_at > 0 and _frames <= _reload_at and not _reload_pressed:
		_reload_pressed = true
		_controls.call("qa_press_reload")

func _save_shot() -> void:
	var img := root.get_texture().get_image()
	if img == null:
		push_error("QA_SHOT: ventana sin textura renderizada")
		return
	img.save_png(_out)
	print("QA_SHOT saved %s %s" % [_out, img.get_size()])
