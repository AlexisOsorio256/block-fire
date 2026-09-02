# BLOCKFIRE — main.gd (parity: main.js + Game.js wiring)
# Construye arena, jugador, bots, HUD, controles; maneja pausa, fin de partida,
# landscape gate en móvil y el modo self-test headless.
extends Node3D

var arena: Arena
var player: Player
var hud: Hud
var touch: TouchControls
var bots: Array[Bot] = []
var is_touch: bool = false
var rotate_overlay: Control

func _ready() -> void:
	is_touch = DisplayServer.is_touchscreen_available() or OS.get_cmdline_user_args().has("--touch-debug")

	if OS.get_cmdline_user_args().has("--selftest") and not Engine.has_meta("blockfire_selftest_nested"):
		var tester: Node = load("res://tests/selftest.gd").new()
		add_child(tester)
		return

	if OS.get_cmdline_user_args().has("--fps-probe"):
		_fps_probe = true
		_probe_start = Time.get_ticks_msec()

	_setup_match()

var _fps_probe := false
var _probe_start := 0
var _probe_frames := 0

func _fps_probe_tick() -> void:
	if not _fps_probe:
		return
	_probe_frames += 1
	var elapsed := Time.get_ticks_msec() - _probe_start
	if elapsed >= 15000:
		var fps := float(_probe_frames) * 1000.0 / float(elapsed)
		print("[FPS-PROBE] frames=%d ms=%d avg=%.1f" % [_probe_frames, elapsed, fps])
		get_tree().quit()

func _setup_match() -> void:
	# arena + navegación
	arena = Arena.new()
	arena.name = "Arena"
	add_child(arena)

	# jugador
	player = Player.new()
	player.name = "Player"
	add_child(player)
	player.global_position = Arena.SPAWNS[0]
	player.input_layer = null  # desktop por defecto; touch se conecta abajo
	player.died.connect(func(): pass)

	# armas + HUD
	hud = Hud.new()
	hud.name = "Hud"
	add_child(hud)
	hud.bind_player(player, player.weapon)

	# mouse capturado en desktop
	if not is_touch:
		Input.mouse_mode = Input.MOUSE_MODE_CAPTURED

	# bots (7 — parity FFA web)
	for i in 7:
		var bot := Bot.new()
		bot.name = "Bot_%d" % i
		add_child(bot)
		bot.global_position = Arena.SPAWNS[i + 1]
		bot.target = player
		bots.append(bot)

	# controles táctiles solo en móvil/touch
	if is_touch:
		touch = TouchControls.new()
		touch.name = "TouchControls"
		add_child(touch)
		player.input_layer = touch
		_check_orientation()

	# botones de la partida también disparan el hitmarker del HUD vía arma
	player.weapon.hitmarker.connect(hud.flash_hitmarker)

	# fin de partida: resultado 3s → volver al lobby limpio
	Game.match_over.connect(func(_won):
		await get_tree().create_timer(3.0).timeout
		Game.reset_match()
		get_tree().change_scene_to_file("res://scenes/lobby.tscn"))

	# menú de pausa (ESC en desktop, botón ⚙ futuro en móvil)
	pause_menu = _build_pause_menu()
	add_child(pause_menu)


var pause_menu: CanvasLayer

func _process(_delta: float) -> void:
	if not is_touch and Input.is_action_just_pressed("ui_cancel"):
		_toggle_pause()
	Game.tick(_delta)
	_score_label_update()
	_fps_probe_tick()

func _toggle_pause() -> void:
	var paused := not get_tree().paused
	get_tree().paused = paused
	pause_menu.get_child(0).visible = paused
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE if paused else Input.MOUSE_MODE_CAPTURED
	Audio.play("ui", -6.0)

func _build_pause_menu() -> CanvasLayer:
	var layer := CanvasLayer.new()
	layer.layer = 20
	layer.process_mode = Node.PROCESS_MODE_ALWAYS
	var root := Control.new()
	root.set_anchors_preset(Control.PRESET_FULL_RECT)
	root.visible = false  # solo visible en pausa
	layer.add_child(root)
	var dim := ColorRect.new()
	dim.set_anchors_preset(Control.PRESET_FULL_RECT)
	dim.color = Color(0.05, 0.06, 0.09, 0.85)
	root.add_child(dim)
	var v := VBoxContainer.new()
	v.set_anchors_preset(Control.PRESET_CENTER)
	v.custom_minimum_size = Vector2(300, 240)
	v.add_theme_constant_override("separation", 16)
	root.add_child(v)
	var t := Label.new()
	t.text = "PAUSA"
	t.add_theme_font_size_override("font_size", 40)
	v.add_child(t)
	var cont := Button.new()
	cont.text = "CONTINUAR"
	cont.add_theme_font_size_override("font_size", 24)
	cont.pressed.connect(_toggle_pause)
	v.add_child(cont)
	var sens_row := HBoxContainer.new()
	v.add_child(sens_row)
	var sl := Label.new()
	sl.text = "Sensibilidad"
	sens_row.add_child(sl)
	var slider := HSlider.new()
	slider.min_value = 0.3; slider.max_value = 2.0; slider.step = 0.1
	slider.value = Settings.sens
	slider.custom_minimum_size = Vector2(150, 0)
	slider.value_changed.connect(_on_sens_changed)
	sens_row.add_child(slider)
	var exit := Button.new()
	exit.text = "SALIR AL LOBBY"
	exit.add_theme_font_size_override("font_size", 20)
	exit.pressed.connect(func():
		get_tree().paused = false
		Game.reset_match()
		get_tree().change_scene_to_file("res://scenes/lobby.tscn"))
	v.add_child(exit)
	return layer

func _on_sens_changed(v: float) -> void:
	Settings.sens = v
	Settings.save_settings()

func _score_label_update() -> void:
	if hud != null:
		hud.score_label.text = "%d kills  ·  %d:%02d" % [
			Game.player_kills,
			int(maxf(Game.time_left, 0.0)) / 60,
			int(maxf(Game.time_left, 0.0)) % 60,
		]
		hud.hp_bar.value = player.hp
		hud.hp_label.text = "HP %d" % int(maxf(player.hp, 0.0))

func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventMouseButton and not is_touch:
		if event.pressed and Input.mouse_mode != Input.MOUSE_MODE_CAPTURED:
			Input.mouse_mode = Input.MOUSE_MODE_CAPTURED

# gate de orientación (regla permanente: HORIZONTAL)
func _notification(what: int) -> void:
	if what == NOTIFICATION_WM_SIZE_CHANGED:
		_check_orientation()

func _check_orientation() -> void:
	if not is_touch:
		return
	var vp := get_viewport().get_visible_rect().size
	var portrait := vp.y > vp.x
	if portrait and rotate_gate == null:
		rotate_gate = _build_rotate_gate()
		add_child(rotate_gate)
	elif not portrait and rotate_gate != null:
		rotate_gate.queue_free()
		rotate_gate = null

var rotate_gate: Control

func _build_rotate_gate() -> Control:
	var c := Control.new()
	c.set_anchors_preset(Control.PRESET_FULL_RECT)
	var rect := ColorRect.new()
	rect.set_anchors_preset(Control.PRESET_FULL_RECT)
	rect.color = Color(0.08, 0.09, 0.12)
	c.add_child(rect)
	var l := Label.new()
	l.text = "GIRA TU DISPOSITIVO\nBLOCKFIRE se juega en horizontal"
	l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	l.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	l.set_anchors_preset(Control.PRESET_FULL_RECT)
	l.add_theme_font_size_override("font_size", 34)
	c.add_child(l)
	return c
