# BLOCKFIRE — Lobby (presentación third-person, no dashboard)
# Prioridad visual: personaje → arma → identidad → JUGAR. Selector de skin vivo.
extends Node3D

var turntable: Node3D
var char_model: CharacterModel
var skin := 0
var title: Label
var skin_label: Label
var settings_panel: Control

func _ready() -> void:
	_build_stage()
	_build_character()
	_build_ui()

func _build_stage() -> void:
	var world_env := WorldEnvironment.new()
	var env := Environment.new()
	env.background_mode = Environment.BG_COLOR
	env.background_color = Color(0.10, 0.12, 0.17)
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color(0.35, 0.42, 0.55)
	env.ambient_light_energy = 0.7
	world_env.environment = env
	add_child(world_env)

	var key := DirectionalLight3D.new()
	key.rotation_degrees = Vector3(-42, -30, 0)
	key.light_energy = 1.6
	key.light_color = Color(1.0, 0.93, 0.82)
	key.shadow_enabled = true
	add_child(key)
	var rim := DirectionalLight3D.new()
	rim.rotation_degrees = Vector3(-12, 150, 0)
	rim.light_energy = 0.9
	rim.light_color = Color(0.45, 0.65, 1.0)  # rim frío de identidad
	add_child(rim)

	# pedestal giratorio
	var disc := MeshInstance3D.new()
	var cyl := CylinderMesh.new()
	cyl.top_radius = 1.1
	cyl.bottom_radius = 1.25
	cyl.height = 0.12
	disc.mesh = cyl
	var m := StandardMaterial3D.new()
	m.albedo_color = Color(0.16, 0.19, 0.25)
	m.metallic = 0.5
	m.roughness = 0.4
	disc.material_override = m
	disc.position.y = 0.06
	add_child(disc)

	var cam := Camera3D.new()
	cam.position = Vector3(0, 1.35, 3.4)
	cam.fov = 50
	add_child(cam)
	cam.look_at(Vector3(0, 1.0, 0))

func _build_character() -> void:
	turntable = Node3D.new()
	add_child(turntable)
	turntable.position.y = 0.12
	char_model = CharacterModel.new()
	turntable.add_child(char_model)
	char_model.setup(skin)
	char_model.play("holding-right")
	_mount_display_weapon()

func _mount_display_weapon() -> void:
	if char_model.arm_right == null:
		return
	for c in char_model.arm_right.get_children():
		c.queue_free()
	var w := WeaponSystem.build_weapon_mesh(0)
	char_model.add_child(w)
	w.scale = Vector3.ONE * 1.6
	w.position = Vector3(0.22, 1.22, 0.5)
	w.rotation_degrees = Vector3(0, -20, 0)

func _build_ui() -> void:
	var canvas := CanvasLayer.new()
	add_child(canvas)
	var root := Control.new()
	root.set_anchors_preset(Control.PRESET_FULL_RECT)
	canvas.add_child(root)

	title = Label.new()
	title.text = "BLOCKFIRE"
	title.add_theme_font_size_override("font_size", 64)
	title.add_theme_color_override("font_color", Color(1, 1, 1))
	title.add_theme_color_override("font_shadow_color", Color(1.0, 0.35, 0.29, 0.6))
	title.add_theme_constant_override("shadow_offset_x", 3)
	title.add_theme_constant_override("shadow_offset_y", 3)
	title.anchor_left = 0.06; title.anchor_top = 0.08
	root.add_child(title)

	var sub := Label.new()
	sub.text = "20 kills. Corre, dispara, repite."
	sub.add_theme_font_size_override("font_size", 20)
	sub.add_theme_color_override("font_color", Color(1, 1, 1, 0.75))
	sub.anchor_left = 0.062; sub.anchor_top = 0.24
	root.add_child(sub)

	# JUGAR — la acción dominante
	var play := Button.new()
	play.text = "JUGAR"
	play.add_theme_font_size_override("font_size", 40)
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color(1.0, 0.35, 0.29)
	sb.set_corner_radius_all(14)
	sb.content_margin_left = 46; sb.content_margin_right = 46
	sb.content_margin_top = 14; sb.content_margin_bottom = 14
	play.add_theme_stylebox_override("normal", sb)
	var sbh := sb.duplicate()
	sbh.bg_color = Color(1.0, 0.5, 0.42)
	play.add_theme_stylebox_override("hover", sbh)
	play.anchor_left = 0.06; play.anchor_top = 0.78
	play.pressed.connect(func():
		Audio.play("ui", -4.0)
		get_tree().change_scene_to_file("res://scenes/main.tscn"))
	root.add_child(play)

	# selector de skin (flechas)
	skin_label = Label.new()
	skin_label.add_theme_font_size_override("font_size", 22)
	skin_label.anchor_left = 0.06; skin_label.anchor_top = 0.60
	root.add_child(skin_label)
	var prev := Button.new()
	prev.text = "<"
	prev.add_theme_font_size_override("font_size", 26)
	prev.anchor_left = 0.06; prev.anchor_top = 0.68
	prev.pressed.connect(func(): _cycle_skin(-1))
	root.add_child(prev)
	var nxt := Button.new()
	nxt.text = ">"
	nxt.add_theme_font_size_override("font_size", 26)
	nxt.anchor_left = 0.14; nxt.anchor_top = 0.68
	nxt.pressed.connect(func(): _cycle_skin(1))
	root.add_child(nxt)
	_update_skin_label()

	# configuración secundaria
	var cfg := Button.new()
	cfg.text = "CONFIGURACIÓN"
	cfg.add_theme_font_size_override("font_size", 18)
	cfg.anchor_left = 0.06; cfg.anchor_top = 0.92
	cfg.pressed.connect(func(): _toggle_settings())
	root.add_child(cfg)

func _on_sens_changed(v: float) -> void:
	Settings.sens_mul = v
	Settings.save_settings()

func _cycle_skin(dir: int) -> void:
	skin = (skin + dir + CharacterModel.OUTFITS.size()) % CharacterModel.OUTFITS.size()
	for c in turntable.get_children():
		c.queue_free()
	char_model = CharacterModel.new()
	turntable.add_child(char_model)
	char_model.setup(skin)
	char_model.play("holding-right")
	_mount_display_weapon()
	_update_skin_label()
	Audio.play("switch", -8.0)

func _update_skin_label() -> void:
	var names := ["ASALTO", "BOSQUE", "DESIERTO", "NOCTURNO", "RAID", "TACTICO", "VIOLETA", "ARENA"]
	skin_label.text = "SKIN: %s" % names[skin % names.size()]

func _toggle_settings() -> void:
	if settings_panel == null:
		settings_panel = _build_settings()
		add_child(settings_panel)
	settings_panel.visible = not settings_panel.visible
	Audio.play("ui", -6.0)

func _build_settings() -> Control:
	var p := PanelContainer.new()
	p.set_anchors_preset(Control.PRESET_CENTER)
	p.custom_minimum_size = Vector2(380, 220)
	var v := VBoxContainer.new()
	p.add_child(v)
	var t := Label.new()
	t.text = "CONFIGURACIÓN"
	t.add_theme_font_size_override("font_size", 24)
	v.add_child(t)
	var sens_row := HBoxContainer.new()
	v.add_child(sens_row)
	var sl := Label.new()
	sl.text = "Sensibilidad"
	sl.custom_minimum_size = Vector2(140, 0)
	sens_row.add_child(sl)
	var sens_slider := HSlider.new()
	sens_slider.min_value = 0.3
	sens_slider.max_value = 2.0
	sens_slider.step = 0.1
	sens_slider.value = Settings.sens_mul
	sens_slider.custom_minimum_size = Vector2(160, 0)
	sens_slider.value_changed.connect(_on_sens_changed)
	sens_row.add_child(sens_slider)
	var close := Button.new()
	close.text = "CERRAR"
	close.pressed.connect(func(): settings_panel.visible = false)
	v.add_child(close)
	return p

var _turn_t := 0.0

func _process(delta: float) -> void:
	# vaivén ¾ frontal (siempre se ve el arma en la mano derecha)
	_turn_t += delta
	turntable.rotation.y = sin(_turn_t * 0.45) * 0.55 + 0.15
	_internal_shot(delta)

var _shot_t := 0.0
var _shot_done := false

# captura interna del viewport (no depende de la pantalla del usuario)
func _internal_shot(delta: float) -> void:
	var args := OS.get_cmdline_user_args()
	for a in args:
		if a.begins_with("--shot="):
			_shot_t += delta
			if _shot_t >= float(a.get_slice("=", 1)) and not _shot_done:
				_shot_done = true
				var img := get_viewport().get_texture().get_image()
				img.save_png("user://shot-lobby.png")
				print("[SHOT] guardado user://shot-lobby.png")
				get_tree().quit()
