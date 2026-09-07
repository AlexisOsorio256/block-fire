class_name BlockfireLobby
extends Node3D

signal start_requested(mode: String, operator_id: String, weapon_skin: String)

var mobile_qa: bool = false
var selected_mode: String = "squad"
var selected_operator: String = "BRAVO"
var selected_skin: String = "Estándar"
var hero: OperatorVisual
var mode_buttons: Dictionary = {}
var operator_buttons: Dictionary = {}
var skin_buttons: Dictionary = {}
var settings_popup: PanelContainer
var ui_root: Control
var profile_label: Label
var armory_label: Label3D

const OPERATORS: Array[String] = ["BRAVO", "VULTURE", "TALON", "DUNE", "HAVOC"]
const SKINS: Array[String] = ["Estándar", "Oro", "Bosque", "Hielo", "Carbón"]

func _ready() -> void:
	var settings := _settings()
	selected_operator = str(settings.get_value("operator", "BRAVO") if settings != null else "BRAVO")
	selected_skin = str(settings.get_value("weapon_skin", "Estándar") if settings != null else "Estándar")
	_build_world()
	_build_ui()

func _build_world() -> void:
	var environment_node := WorldEnvironment.new()
	var environment := Environment.new()
	environment.background_mode = Environment.BG_COLOR
	environment.background_color = Color("#07132b")
	environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	environment.ambient_light_color = Color("#7998c4")
	environment.ambient_light_energy = 0.76
	environment.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	environment_node.environment = environment
	add_child(environment_node)

	var sun := DirectionalLight3D.new()
	sun.rotation_degrees = Vector3(-38, -32, 0)
	sun.light_color = Color("#ffe0ab")
	sun.light_energy = 1.18
	sun.shadow_enabled = true
	add_child(sun)

	var camera := Camera3D.new()
	camera.position = Vector3(0, 3.0, 8.8)
	camera.fov = 32.0
	camera.current = true
	add_child(camera)
	camera.look_at(Vector3(0, 1.5, 0), Vector3.UP)

	var backdrop := MeshInstance3D.new()
	var backdrop_mesh := BoxMesh.new()
	backdrop_mesh.size = Vector3(44, 16, 0.8)
	backdrop.mesh = backdrop_mesh
	backdrop.position = Vector3(2, 5.0, -5.4)
	backdrop.material_override = _material(Color("#162d54"))
	add_child(backdrop)
	var stripe := MeshInstance3D.new()
	var stripe_mesh := BoxMesh.new()
	stripe_mesh.size = Vector3(40, 0.25, 0.2)
	stripe.mesh = stripe_mesh
	stripe.position = Vector3(-1, 5.5, -4.9)
	stripe.rotation_degrees.z = -7.0
	stripe.material_override = _material(Color("#375b80"))
	add_child(stripe)

	var pedestal := MeshInstance3D.new()
	var pedestal_mesh := CylinderMesh.new()
	pedestal_mesh.top_radius = 2.5
	pedestal_mesh.bottom_radius = 2.9
	pedestal_mesh.height = 0.28
	pedestal.mesh = pedestal_mesh
	pedestal.position = Vector3(1.4, 0.15, 0)
	pedestal.material_override = _material(Color("#405a76"))
	add_child(pedestal)
	var ring := MeshInstance3D.new()
	var ring_mesh := TorusMesh.new()
	ring_mesh.inner_radius = 2.72
	ring_mesh.outer_radius = 2.86
	ring.mesh = ring_mesh
	ring.position = Vector3(1.4, 0.32, 0)
	ring.material_override = _material(Color("#ffb73e"))
	add_child(ring)

	hero = OperatorVisual.new()
	hero.position = Vector3(1.4, 0.35, 0)
	# Kenney characters face -Z; keep the portrait looking toward the camera.
	hero.rotation_degrees.y = 0.0
	hero.configure(selected_operator, "ally", _operator_color(selected_operator))
	add_child(hero)
	_create_weapon_display()

func _create_weapon_display() -> void:
	var packed := load("res://assets/models/weapons/rifle.glb") as PackedScene
	if packed == null:
		return
	var display_base := MeshInstance3D.new()
	display_base.name = "ArmoryPreviewBase"
	var base_mesh := CylinderMesh.new()
	base_mesh.top_radius = 0.58
	base_mesh.bottom_radius = 0.68
	base_mesh.height = 0.16
	display_base.mesh = base_mesh
	display_base.position = Vector3(3.55, 0.28, 0.15)
	display_base.material_override = _material(Color("#405a76"))
	add_child(display_base)
	var display_ring := MeshInstance3D.new()
	display_ring.name = "ArmoryPreviewRing"
	var ring_mesh := TorusMesh.new()
	ring_mesh.inner_radius = 0.58
	ring_mesh.outer_radius = 0.64
	display_ring.mesh = ring_mesh
	display_ring.position = Vector3(3.55, 0.38, 0.15)
	display_ring.material_override = _material(BlockfireTheme.GOLD)
	add_child(display_ring)
	var display := Node3D.new()
	display.name = "ArmoryPreview"
	display.position = Vector3(3.55, 0.78, 0.15)
	display.rotation_degrees = Vector3(-8.0, 180.0, -24.0)
	display.scale = Vector3.ONE * 1.05
	display.add_child(packed.instantiate())
	add_child(display)
	armory_label = Label3D.new()
	armory_label.name = "ArmoryPreviewLabel"
	armory_label.text = "RIFLE  //  " + selected_skin.to_upper()
	armory_label.position = Vector3(3.25, 2.65, 0.0)
	armory_label.font_size = 30
	armory_label.pixel_size = 0.006
	armory_label.modulate = BlockfireTheme.GOLD
	armory_label.outline_size = 7
	armory_label.outline_modulate = Color("#071127cc")
	armory_label.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	armory_label.no_depth_test = true
	add_child(armory_label)

func _build_ui() -> void:
	var layer := CanvasLayer.new()
	layer.layer = 10
	add_child(layer)
	var root := Control.new()
	root.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	root.mouse_filter = Control.MOUSE_FILTER_PASS
	ui_root = root
	layer.add_child(root)

	var left := VBoxContainer.new()
	left.anchor_left = 0.0
	left.anchor_top = 0.0
	left.anchor_right = 0.48
	left.anchor_bottom = 1.0
	left.offset_left = 48.0
	left.offset_top = 46.0
	left.offset_right = -20.0
	left.offset_bottom = -42.0
	left.add_theme_constant_override("separation", 10)
	root.add_child(left)

	var title := BlockfireTheme.label("BLOCKFIRE", 48 if not mobile_qa else 34, Color.WHITE)
	title.text = "BLOCK" + "FIRE"
	title.add_theme_color_override("font_shadow_color", Color("#00000099"))
	title.add_theme_constant_override("shadow_offset_x", 3)
	title.add_theme_constant_override("shadow_offset_y", 4)
	left.add_child(title)
	var subtitle := BlockfireTheme.label("FPS ARCADE  ·  DUELO DE ESCUADRAS 4v4  ·  TODOS CONTRA TODOS", 12, Color("#9db7db"))
	subtitle.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	left.add_child(subtitle)

	var play := Button.new()
	play.text = "JUGAR"
	play.custom_minimum_size = Vector2(0, 62 if not mobile_qa else 48)
	play.add_theme_font_size_override("font_size", 25 if not mobile_qa else 20)
	BlockfireTheme.apply_button(play, BlockfireTheme.GOLD)
	play.add_theme_stylebox_override("normal", BlockfireTheme.button_style(Color("#ffb73e"), Color("#ffd477"), 12))
	play.add_theme_color_override("font_color", Color("#071127"))
	play.pressed.connect(_on_play)
	left.add_child(play)

	var mode_title := BlockfireTheme.label("MODO", 11, Color("#8da9ce"))
	left.add_child(mode_title)
	var modes := HBoxContainer.new()
	modes.add_theme_constant_override("separation", 8)
	left.add_child(modes)
	var squad := _make_select_button("DUELO DE ESCUADRAS\n4v4 · RONDAS · TIENDA", 15)
	var ffa := _make_select_button("TODOS CONTRA TODOS\n8 JUGADORES · 20 KILLS", 15)
	modes.add_child(squad)
	modes.add_child(ffa)
	mode_buttons["squad"] = squad
	mode_buttons["ffa"] = ffa
	squad.pressed.connect(func() -> void: _select_mode("squad"))
	ffa.pressed.connect(func() -> void: _select_mode("ffa"))

	var op_title := BlockfireTheme.label("OPERADORES", 11, Color("#8da9ce"))
	left.add_child(op_title)
	var ops := HBoxContainer.new()
	ops.add_theme_constant_override("separation", 6)
	left.add_child(ops)
	for id: String in OPERATORS:
		var operator_button := _make_small_button(id + "\n" + _operator_role(id), 11)
		ops.add_child(operator_button)
		operator_buttons[id] = operator_button
		operator_button.pressed.connect(func() -> void: _select_operator(id))

	var skin_title := BlockfireTheme.label("SKINS DE ARMAS", 11, Color("#8da9ce"))
	left.add_child(skin_title)
	var skins := HBoxContainer.new()
	skins.add_theme_constant_override("separation", 6)
	left.add_child(skins)
	for skin: String in SKINS:
		var skin_button := _make_small_button(skin, 11)
		skins.add_child(skin_button)
		skin_buttons[skin] = skin_button
		skin_button.pressed.connect(func() -> void: _select_skin(skin))

	var footer := HBoxContainer.new()
	footer.add_theme_constant_override("separation", 12)
	left.add_child(footer)
	profile_label = BlockfireTheme.label("OPERADOR ACTIVO  ·  " + selected_operator, 12, Color("#b9cde7"))
	profile_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	footer.add_child(profile_label)
	var settings := Button.new()
	settings.text = "CONFIGURACIÓN"
	settings.custom_minimum_size = Vector2(150, 34)
	BlockfireTheme.apply_button(settings, Color("#80cfff"))
	settings.pressed.connect(_open_settings)
	footer.add_child(settings)

	var controls_hint := BlockfireTheme.label("PC: WASD + RATÓN  ·  MÓVIL: JOYSTICK + FUEGO\nLEGAL Y CRÉDITOS DISPONIBLES EN CONFIGURACIÓN", 10, Color("#6d86a6"))
	controls_hint.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	left.add_child(controls_hint)
	_select_mode(selected_mode)
	_select_operator(selected_operator)
	_select_skin(selected_skin)

func _make_select_button(text: String, size: int) -> Button:
	var button := Button.new()
	button.text = text
	button.custom_minimum_size = Vector2(0, 58)
	button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	button.add_theme_font_size_override("font_size", size)
	button.alignment = HORIZONTAL_ALIGNMENT_CENTER
	BlockfireTheme.apply_button(button, BlockfireTheme.GOLD)
	return button

func _make_small_button(text: String, size: int) -> Button:
	var button := Button.new()
	button.text = text
	button.custom_minimum_size = Vector2(0, 42)
	button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	button.add_theme_font_size_override("font_size", size)
	BlockfireTheme.apply_button(button, Color("#80cfff"))
	return button

func _select_mode(mode: String) -> void:
	selected_mode = mode
	for id: String in mode_buttons:
		var button: Button = mode_buttons[id]
		button.modulate = Color.WHITE if id == mode else Color("#8292a8")

func _select_operator(id: String) -> void:
	selected_operator = id
	var settings := _settings()
	if settings != null:
		settings.set_value("operator", id)
	for key: String in operator_buttons:
		operator_buttons[key].modulate = Color.WHITE if key == id else Color("#8292a8")
	if profile_label != null:
		profile_label.text = "OPERADOR ACTIVO  ·  " + id
	if is_instance_valid(hero):
		hero.configure(id, "ally", _operator_color(id))

func _select_skin(skin: String) -> void:
	selected_skin = skin
	var settings := _settings()
	if settings != null:
		settings.set_value("weapon_skin", skin)
	for key: String in skin_buttons:
		skin_buttons[key].modulate = Color.WHITE if key == skin else Color("#8292a8")
	if armory_label != null:
		armory_label.text = "RIFLE  //  " + skin.to_upper()

func _on_play() -> void:
	start_requested.emit(selected_mode, selected_operator, selected_skin)

func _open_settings() -> void:
	if is_instance_valid(settings_popup):
		settings_popup.queue_free()
		settings_popup = null
		return
	settings_popup = PanelContainer.new()
	settings_popup.position = Vector2(52, 18)
	settings_popup.size = Vector2(350, 370)
	settings_popup.add_theme_stylebox_override("panel", BlockfireTheme.panel(Color("#09172deF"), Color("#7fbfff"), 12, 2))
	if ui_root != null:
		ui_root.add_child(settings_popup)
	else:
		add_child(settings_popup)
	settings_popup.z_index = 20
	var stack := VBoxContainer.new()
	stack.add_theme_constant_override("separation", 8)
	settings_popup.add_child(stack)
	var heading := BlockfireTheme.label("CONFIGURACIÓN", 18, Color.WHITE)
	stack.add_child(heading)
	_add_setting_slider(stack, "VOLUMEN MASTER", "master_volume", 0.0, 1.0, 0.85)
	_add_setting_slider(stack, "VOLUMEN SFX", "sfx_volume", 0.0, 1.0, 0.9)
	_add_setting_slider(stack, "SENSIBILIDAD", "sensitivity", 0.04, 0.25, 0.12)
	_add_setting_slider(stack, "MULTIPLICADOR ADS", "ads_multiplier", 0.45, 1.0, 0.72)
	_add_setting_slider(stack, "OPACIDAD TÁCTIL", "mobile_opacity", 0.35, 1.0, 0.68)
	var legal_title := BlockfireTheme.label("LEGAL / CRÉDITOS", 10, Color("#9db7db"))
	stack.add_child(legal_title)
	var legal := BlockfireTheme.label("Audio: Jesús Lastra · CC-BY 3.0\nCódigo y atribuciones: CREDITS.md", 10, Color("#6d86a6"))
	legal.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	stack.add_child(legal)
	var close := Button.new()
	close.text = "CERRAR"
	BlockfireTheme.apply_button(close, Color("#80cfff"))
	close.pressed.connect(func() -> void:
		settings_popup.queue_free()
		settings_popup = null
	)
	stack.add_child(close)

func _add_setting_slider(stack: VBoxContainer, label_text: String, key: String, minimum: float, maximum: float, fallback: float) -> void:
	var label := BlockfireTheme.label(label_text, 10, Color("#9db7db"))
	stack.add_child(label)
	var slider := HSlider.new()
	slider.min_value = minimum
	slider.max_value = maximum
	slider.step = 0.01
	var settings := _settings()
	slider.value = float(settings.get_value(key, fallback) if settings != null else fallback)
	slider.value_changed.connect(func(value: float) -> void:
		if settings != null:
			settings.set_value(key, value)
	)
	stack.add_child(slider)

func _operator_role(id: String) -> String:
	match id:
		"VULTURE": return "URBANO"
		"TALON": return "TÁCTICO"
		"DUNE": return "EXPLORADOR"
		"HAVOC": return "PESADO"
	return "ASALTO"

func _settings() -> Node:
	return get_node_or_null("/root/SettingsStore") if is_inside_tree() else null

func _operator_color(id: String) -> Color:
	match id:
		"VULTURE": return Color("#9b806e")
		"TALON": return Color("#86c75b")
		"DUNE": return Color("#d7b46a")
		"HAVOC": return Color("#d44d79")
	return Color("#ff9d50")

func _material(color: Color) -> StandardMaterial3D:
	var material := StandardMaterial3D.new()
	material.albedo_color = color
	material.roughness = 0.76
	return material
