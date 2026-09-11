class_name BlockfireLobby
extends Node3D


signal start_requested(mode: String, operator_id: String, weapon_skin: String)

var mobile_qa: bool = false
var selected_mode: String = "squad"
## El operador deprecado ya no es player-facing: se mantiene solo por contrato
## de señal con app/match (la apariencia vive en cosméticos + skin de arma).
var selected_operator: String = "PLAYER"
var selected_skin: String = "Estándar"
var hero: OperatorVisual
var mode_buttons: Dictionary = {}
var skin_buttons: Dictionary = {}
var settings_popup: PanelContainer
var wardrobe_panel: PanelContainer
var armory_panel: PanelContainer
var ui_root: Control
var wardrobe_category: String = "top"
var wardrobe_grid: GridContainer
var wardrobe_category_buttons: Dictionary = {}
var armory_label: Label3D
var weapon_display_root: Node3D
var _time: float = 0.0

## Derivado de WeaponSkin.TINTS (fuente única del tintado de armas).
var SKINS: Array[String] = WeaponSkin.skin_names()
## Categoría UI -> slot de CosmeticCatalog.
## Etiquetas honestas: cada slot cambia GEOMETRÍA real del rig modular, no un
## tinte (el nombre antiguo "COLOR SUP." describía el armario ficticio previo).
const WARDROBE_CATEGORIES: Array = [
	["CABEZA", "head"],
	["GORRA", "headwear"],
	["GAFAS", "eyewear"],
	["MÁSCARA", "mask"],
	["TOP", "top"],
	["PANTALÓN", "bottom"],
	["CALZADO", "shoes"],
	["PIEL", "skin"],
]

func _ready() -> void:
	var settings := _settings()
	selected_skin = str(settings.get_value("weapon_skin", "Estándar") if settings != null else "Estándar")
	_build_world()
	_build_ui()

func _process(delta: float) -> void:
	_time += delta
	# Sin giro del product shot: a ángulos oblicuos el arma procedural se lee
	# desarmada en piezas (aberración vista en el teléfono). El escaparate queda
	# fijo en su ángulo de costado, siempre legible.

func _build_world() -> void:
	var environment_node := WorldEnvironment.new()
	var environment := Environment.new()
	environment.background_mode = Environment.BG_SKY
	var sky := Sky.new()
	var sky_material := ProceduralSkyMaterial.new()
	sky_material.sky_top_color = Color("#2f6fc4")
	sky_material.sky_horizon_color = Color("#8fc0e4")
	sky_material.ground_bottom_color = Color("#3a4a5e")
	sky_material.ground_horizon_color = Color("#8fa5b8")
	sky.sky_material = sky_material
	environment.sky = sky
	environment.ambient_light_source = Environment.AMBIENT_SOURCE_SKY
	environment.ambient_light_energy = 0.7
	environment.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	environment_node.environment = environment
	add_child(environment_node)

	var sun := DirectionalLight3D.new()
	sun.rotation_degrees = Vector3(-38, -30, 0)
	sun.light_color = Color("#ffe3ae")
	sun.light_energy = 1.25
	sun.shadow_enabled = true
	sun.shadow_bias = 0.18
	sun.shadow_normal_bias = 3.5
	add_child(sun)
	var rim := DirectionalLight3D.new()
	rim.rotation_degrees = Vector3(-12, 148, 0)
	rim.light_color = Color("#6fd0ff")
	rim.light_energy = 0.65
	add_child(rim)

	var camera := Camera3D.new()
	camera.position = Vector3(2.55, 1.52, 3.85)
	camera.fov = 39.0
	camera.current = true
	add_child(camera)
	camera.look_at(Vector3(1.65, 0.98, 0.15), Vector3.UP)

	# Patio: suelo asfaltado oscuro + círculo pintado donde apoya el héroe.
	var ground := MeshInstance3D.new()
	var ground_mesh := BoxMesh.new()
	ground_mesh.size = Vector3(44, 0.2, 22)
	ground.mesh = ground_mesh
	ground.position = Vector3(1.5, -0.1, 1.0)
	ground.material_override = _material(Color("#2b3c55"))
	add_child(ground)
	var ground_body := StaticBody3D.new()
	ground_body.position = ground.position
	var ground_shape := CollisionShape3D.new()
	var ground_box := BoxShape3D.new()
	ground_box.size = Vector3(44, 0.2, 22)
	ground_shape.shape = ground_box
	ground_body.add_child(ground_shape)
	add_child(ground_body)
	var pad := MeshInstance3D.new()
	var pad_mesh := TorusMesh.new()
	pad_mesh.inner_radius = 0.48
	pad_mesh.outer_radius = 0.54
	pad.mesh = pad_mesh
	pad.position = Vector3(1.55, 0.02, 0)
	pad.material_override = _emissive(Color("#d59136"), 0.16)
	add_child(pad)
	for i: int in range(3):
		var dash := MeshInstance3D.new()
		var dash_mesh := BoxMesh.new()
		dash_mesh.size = Vector3(1.1, 0.02, 0.22)
		dash.mesh = dash_mesh
		dash.position = Vector3(-2.2 + float(i) * 1.6, 0.012, 3.4)
		dash.material_override = _material(Color("#37cfe0").darkened(0.3))
		add_child(dash)

	_add_lamp(Vector3(-3.2, 0.0, 2.2))
	_add_lamp(Vector3(5.8, 0.0, 2.4))
	_add_lobby_props()

	hero = OperatorVisual.new()
	hero.position = Vector3(1.55, 0.0, 0)
	# Yaw hacia la cámara (la cámara está en +X/+Z del héroe): con -28 el rifle
	# del showcase quedaba detrás del panel de UI y el personaje daba la espalda
	# al eje de lectura del lobby.
	hero.rotation_degrees.y = 52.0
	var settings := _settings()
	var cosmetic_loadout := settings.cosmetic_loadout() if settings != null else CosmeticCatalog.default_loadout()
	hero.configure(selected_operator, "ally", Color("#f0a064"), cosmetic_loadout, true)
	add_child(hero)
	# El lobby presenta al personaje, no una pose de combate que le tape la cara.
	hero.set_combat_state(false, false)
	hero.set_showcase_mode(true, "", selected_skin)

## Atrezzo de fondo del lobby: cajas, barreras y un contenedor para que el
## escaparate no sea un vacío azul. Sin collider (el lobby no se juega).
func _add_lobby_props() -> void:
	var crate_material := _material(Color("#4a5b6e"))
	var dark_crate := _material(Color("#39485a"))
	var container_material := _material(Color("#3f5f6b"))
	# La cámara del lobby está en (2.55, 1.52, 3.85) mirando al héroe: el atrezzo
	# se coloca a la espalda y a los lados de esa línea, no fuera de cuadro.
	var specs: Array = [
		[Vector3(-3.1, 0.55, -1.8), Vector3(1.6, 1.1, 1.6), 18.0, crate_material],
		[Vector3(-1.9, 0.45, -2.6), Vector3(1.2, 0.9, 1.2), -12.0, dark_crate],
		[Vector3(-2.9, 1.35, -2.1), Vector3(1.1, 0.8, 1.1), 32.0, dark_crate],
		[Vector3(4.4, 0.5, -1.6), Vector3(2.2, 1.0, 1.2), -8.0, crate_material],
		[Vector3(-4.6, 0.6, 1.2), Vector3(1.4, 1.2, 1.4), 24.0, dark_crate],
	]
	for spec: Array in specs:
		var box := MeshInstance3D.new()
		var mesh := BoxMesh.new()
		mesh.size = spec[1] as Vector3
		box.mesh = mesh
		box.position = spec[0] as Vector3
		box.rotation_degrees.y = float(spec[2])
		box.material_override = spec[3] as Material
		add_child(box)
	var container := MeshInstance3D.new()
	var container_mesh := BoxMesh.new()
	container_mesh.size = Vector3(6.4, 2.6, 2.6)
	container.mesh = container_mesh
	container.position = Vector3(3.9, 1.3, -6.2)
	container.rotation_degrees.y = -14.0
	container.material_override = container_material
	add_child(container)


func _add_lamp(position: Vector3) -> void:
	var root := Node3D.new()
	root.position = position
	add_child(root)
	var post := MeshInstance3D.new()
	var post_mesh := CylinderMesh.new()
	post_mesh.top_radius = 0.06
	post_mesh.bottom_radius = 0.09
	post_mesh.height = 2.6
	post.mesh = post_mesh
	post.position = Vector3(0, 1.3, 0)
	post.material_override = _material(Color("#2c3f55"))
	root.add_child(post)
	var head := MeshInstance3D.new()
	var head_mesh := SphereMesh.new()
	head_mesh.height = 0.3
	head_mesh.radius = 0.15
	head.mesh = head_mesh
	head.position = Vector3(0, 2.75, 0)
	head.material_override = _emissive(Color("#ffe9b0"), 0.8)
	root.add_child(head)

func _build_ui() -> void:
	var layer := CanvasLayer.new()
	layer.layer = 10
	add_child(layer)
	var root := Control.new()
	root.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	root.mouse_filter = Control.MOUSE_FILTER_PASS
	ui_root = root
	layer.add_child(root)

	var left_shell := Panel.new()
	left_shell.anchor_right = 0.39
	left_shell.anchor_bottom = 0.0
	left_shell.offset_left = 24.0
	left_shell.offset_top = 20.0
	left_shell.offset_right = -20.0
	left_shell.offset_bottom = 444.0
	left_shell.mouse_filter = Control.MOUSE_FILTER_IGNORE
	left_shell.add_theme_stylebox_override("panel", BlockfireTheme.panel(Color("#0711279c"), Color("#6c8db766"), 16, 1))
	root.add_child(left_shell)

	var left := VBoxContainer.new()
	left.anchor_left = 0.0
	left.anchor_top = 0.0
	left.anchor_right = 0.39
	left.anchor_bottom = 1.0
	left.offset_left = 40.0
	left.offset_top = 32.0
	left.offset_right = -28.0
	left.offset_bottom = -28.0
	left.add_theme_constant_override("separation", 8)
	root.add_child(left)

	var title := BlockfireTheme.label("BLOCKFIRE", 43 if not mobile_qa else 32, Color.WHITE)
	title.add_theme_color_override("font_shadow_color", Color("#000000aa"))
	title.add_theme_constant_override("shadow_offset_x", 3)
	title.add_theme_constant_override("shadow_offset_y", 3)
	left.add_child(title)
	var subtitle := BlockfireTheme.label("TPS MÓVIL · 4v4 / FFA", 12, Color("#9db7db"))
	subtitle.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	left.add_child(subtitle)

	var play := Button.new()
	play.text = "JUGAR"
	play.custom_minimum_size = Vector2(0, 58 if not mobile_qa else 48)
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
	var squad := _make_select_button("ESCUADRAS 4v4\nRONDAS · TIENDA", 14)
	var ffa := _make_select_button("TODOS CONTRA TODOS\n8 · 20 BAJAS", 14)
	modes.add_child(squad)
	modes.add_child(ffa)
	mode_buttons["squad"] = squad
	mode_buttons["ffa"] = ffa
	squad.pressed.connect(func() -> void: _select_mode("squad"))
	ffa.pressed.connect(func() -> void: _select_mode("ffa"))

	var char_title := BlockfireTheme.label("PERSONAJE", 11, Color("#8da9ce"))
	left.add_child(char_title)
	var chars := HBoxContainer.new()
	chars.add_theme_constant_override("separation", 8)
	left.add_child(chars)
	var wardrobe := _make_select_button("ROPA\nY EQUIPO", 13)
	var armory := _make_select_button("ARMAS\nSKINS", 13)
	chars.add_child(wardrobe)
	chars.add_child(armory)
	wardrobe.pressed.connect(_toggle_wardrobe)
	armory.pressed.connect(_toggle_armory)

	var footer := HBoxContainer.new()
	footer.add_theme_constant_override("separation", 10)
	left.add_child(footer)
	var settings := Button.new()
	settings.text = "AJUSTES"
	settings.custom_minimum_size = Vector2(140, 36)
	BlockfireTheme.apply_button(settings, Color("#80cfff"))
	settings.pressed.connect(_open_settings)
	footer.add_child(settings)
	var hint := BlockfireTheme.label("Móvil: joystick + fuego · Legal en Ajustes", 10, Color("#6d86a6"))
	hint.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	hint.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	footer.add_child(hint)
	_select_mode(selected_mode)
	_select_skin(selected_skin)

func _make_select_button(text: String, size: int) -> Button:
	var button := Button.new()
	button.text = text
	button.custom_minimum_size = Vector2(0, 56)
	button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	button.add_theme_font_size_override("font_size", size)
	button.alignment = HORIZONTAL_ALIGNMENT_CENTER
	BlockfireTheme.apply_button(button, BlockfireTheme.GOLD)
	return button

func _select_mode(mode: String) -> void:
	selected_mode = mode
	for id: String in mode_buttons:
		var button: Button = mode_buttons[id]
		BlockfireTheme.set_button_selected(button, id == mode, BlockfireTheme.GOLD)

func _select_skin(skin: String) -> void:
	selected_skin = skin
	var settings := _settings()
	if settings != null:
		settings.set_value("weapon_skin", skin)
	for key: String in skin_buttons:
		BlockfireTheme.set_button_selected(skin_buttons[key], key == skin, BlockfireTheme.GOLD)
	if armory_label != null:
		armory_label.text = "RIFLE · " + skin.to_upper()
	if is_instance_valid(hero):
		hero.set_showcase_weapon_skin(skin)
	if wardrobe_panel != null:
		_refresh_wardrobe()

func _toggle_wardrobe() -> void:
	_close_panels()
	wardrobe_panel = PanelContainer.new()
	wardrobe_panel.anchor_left = 0.0
	wardrobe_panel.anchor_top = 0.0
	wardrobe_panel.anchor_right = 0.39
	wardrobe_panel.anchor_bottom = 1.0
	wardrobe_panel.offset_left = 40.0
	wardrobe_panel.offset_top = 300.0
	wardrobe_panel.offset_right = -28.0
	wardrobe_panel.offset_bottom = -28.0
	wardrobe_panel.add_theme_stylebox_override("panel", BlockfireTheme.panel(Color("#0a162cf2"), Color("#7fbfff"), 14, 2))
	ui_root.add_child(wardrobe_panel)
	var stack := VBoxContainer.new()
	stack.add_theme_constant_override("separation", 6)
	wardrobe_panel.add_child(stack)
	var heading := BlockfireTheme.label("ARMARIO · ROPA Y ACCESORIOS", 15, BlockfireTheme.GOLD)
	stack.add_child(heading)
	wardrobe_category_buttons.clear()
	var cats := GridContainer.new()
	cats.columns = 4
	cats.add_theme_constant_override("h_separation", 5)
	cats.add_theme_constant_override("v_separation", 5)
	stack.add_child(cats)
	for pair: Array in WARDROBE_CATEGORIES:
		var cat_button := Button.new()
		cat_button.text = str(pair[0])
		cat_button.custom_minimum_size = Vector2(0, 30)
		cat_button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		cat_button.add_theme_font_size_override("font_size", 10)
		BlockfireTheme.apply_button(cat_button, Color("#80cfff"))
		var slot := str(pair[1])
		wardrobe_category_buttons[slot] = cat_button
		cat_button.pressed.connect(func() -> void:
			wardrobe_category = slot
			_refresh_wardrobe()
		)
		cats.add_child(cat_button)
	wardrobe_grid = GridContainer.new()
	wardrobe_grid.columns = 2
	wardrobe_grid.add_theme_constant_override("h_separation", 6)
	wardrobe_grid.add_theme_constant_override("v_separation", 6)
	stack.add_child(wardrobe_grid)
	var close := Button.new()
	close.text = "CERRAR"
	BlockfireTheme.apply_button(close, Color("#80cfff"))
	close.pressed.connect(_close_panels)
	stack.add_child(close)
	_refresh_wardrobe()
	_animate_panel_in(wardrobe_panel)

func _refresh_wardrobe() -> void:
	if wardrobe_grid == null or not is_instance_valid(wardrobe_grid):
		return
	for child: Node in wardrobe_grid.get_children():
		child.queue_free()
	var settings := _settings()
	var equipped := str(settings.get_value("cosmetic_" + wardrobe_category, "") if settings != null else "")
	for slot: String in wardrobe_category_buttons:
		BlockfireTheme.set_button_selected(wardrobe_category_buttons[slot], slot == wardrobe_category, Color("#80cfff"))
	# "Ninguno" para accesorios; las prendas siempre llevan algo equipado.
	if wardrobe_category in ["headwear", "eyewear", "mask"]:
		var none := _make_wardrobe_card("Ninguno", equipped.is_empty())
		none.pressed.connect(func() -> void: _equip_cosmetic(""))
		wardrobe_grid.add_child(none)
	for key: String in CosmeticCatalog.items():
		var item: CosmeticItem = CosmeticCatalog.items()[key]
		if item.slot != wardrobe_category:
			continue
		var card := _make_wardrobe_card(item.display_name, item.id == equipped)
		var item_id := item.id
		card.pressed.connect(func() -> void: _equip_cosmetic(item_id))
		wardrobe_grid.add_child(card)

func _make_wardrobe_card(text: String, is_equipped: bool) -> Button:
	var card := Button.new()
	card.text = ("✓ " if is_equipped else "") + text + ("\nEQUIPADO" if is_equipped else "")
	card.custom_minimum_size = Vector2(0, 44)
	card.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	card.add_theme_font_size_override("font_size", 12)
	BlockfireTheme.apply_button(card, BlockfireTheme.GOLD if is_equipped else Color("#80cfff"))
	card.modulate = Color.WHITE if is_equipped else Color("#a9c0da")
	return card

func _equip_cosmetic(item_id: String) -> void:
	var settings := _settings()
	if settings != null:
		settings.set_cosmetic_slot(wardrobe_category, item_id)
	if is_instance_valid(hero):
		var cosmetic_loadout := settings.cosmetic_loadout() if settings != null else CosmeticCatalog.default_loadout()
		hero.configure(selected_operator, "ally", Color("#f0a064"), cosmetic_loadout, true)
		# configure() reconstruye model_root con el yaw de gameplay. Reaplicar el
		# modo escaparate evita que cambiar una prenda gire el personaje 180°.
		hero.set_showcase_mode(true, "", selected_skin)
	_refresh_wardrobe()

func _toggle_armory() -> void:
	_close_panels()
	armory_panel = PanelContainer.new()
	armory_panel.anchor_left = 0.0
	armory_panel.anchor_top = 0.0
	armory_panel.anchor_right = 0.39
	armory_panel.anchor_bottom = 0.0
	armory_panel.offset_left = 40.0
	armory_panel.offset_top = 300.0
	armory_panel.offset_right = -28.0
	armory_panel.offset_bottom = 520.0
	armory_panel.add_theme_stylebox_override("panel", BlockfireTheme.panel(Color("#0a162cf2"), BlockfireTheme.GOLD, 14, 2))
	ui_root.add_child(armory_panel)
	if is_instance_valid(weapon_display_root):
		weapon_display_root.visible = true
	if armory_label != null:
		armory_label.visible = true
	var stack := VBoxContainer.new()
	stack.add_theme_constant_override("separation", 8)
	armory_panel.add_child(stack)
	stack.add_child(BlockfireTheme.label("ARMAS · SKIN PARA TODAS", 15, BlockfireTheme.GOLD))
	var grid := GridContainer.new()
	grid.columns = 3
	grid.add_theme_constant_override("h_separation", 6)
	grid.add_theme_constant_override("v_separation", 6)
	stack.add_child(grid)
	for skin: String in SKINS:
		var skin_button := _make_wardrobe_card(skin, skin == selected_skin)
		grid.add_child(skin_button)
		skin_buttons[skin] = skin_button
		skin_button.pressed.connect(func() -> void: _select_skin(skin))
	var close := Button.new()
	close.text = "CERRAR"
	BlockfireTheme.apply_button(close, Color("#80cfff"))
	close.pressed.connect(_close_panels)
	stack.add_child(close)
	_animate_panel_in(armory_panel)

func _close_panels() -> void:
	if is_instance_valid(wardrobe_panel):
		wardrobe_panel.queue_free()
	wardrobe_panel = null
	wardrobe_grid = null
	if is_instance_valid(armory_panel):
		armory_panel.queue_free()
	armory_panel = null
	if is_instance_valid(weapon_display_root):
		weapon_display_root.visible = false
	if armory_label != null:
		armory_label.visible = false

func _animate_panel_in(panel: Control) -> void:
	panel.modulate = Color(1, 1, 1, 0)
	panel.scale = Vector2(0.97, 0.97)
	panel.pivot_offset = panel.size * 0.5
	var tween := create_tween().set_parallel(true)
	tween.tween_property(panel, "modulate", Color.WHITE, 0.16)
	tween.tween_property(panel, "scale", Vector2.ONE, 0.16)

func _on_play() -> void:
	start_requested.emit(selected_mode, selected_operator, selected_skin)

func _open_settings() -> void:
	_close_panels()
	if is_instance_valid(settings_popup):
		settings_popup.queue_free()
		settings_popup = null
		return
	settings_popup = PanelContainer.new()
	settings_popup.anchor_left = 0.0
	settings_popup.anchor_top = 0.0
	settings_popup.anchor_right = 0.39
	settings_popup.anchor_bottom = 0.0
	settings_popup.offset_left = 40.0
	settings_popup.offset_top = 120.0
	settings_popup.offset_right = -28.0
	settings_popup.offset_bottom = 524.0
	settings_popup.add_theme_stylebox_override("panel", BlockfireTheme.panel(Color("#0a162cf2"), Color("#7fbfff"), 14, 2))
	ui_root.add_child(settings_popup)
	settings_popup.z_index = 20
	var stack := VBoxContainer.new()
	stack.add_theme_constant_override("separation", 8)
	settings_popup.add_child(stack)
	stack.add_child(BlockfireTheme.label("AJUSTES", 18, Color.WHITE))
	_add_setting_slider(stack, "VOLUMEN MASTER", "master_volume", 0.0, 1.0, 0.85)
	_add_setting_slider(stack, "VOLUMEN SFX", "sfx_volume", 0.0, 1.0, 0.9)
	_add_setting_slider(stack, "SENSIBILIDAD", "sensitivity", 0.04, 0.25, 0.12)
	_add_setting_slider(stack, "MULTIPLICADOR ADS", "ads_multiplier", 0.45, 1.0, 0.72)
	_add_setting_slider(stack, "OPACIDAD TÁCTIL", "mobile_opacity", 0.35, 1.0, 0.58)
	stack.add_child(BlockfireTheme.label("LEGAL / CRÉDITOS", 10, Color("#9db7db")))
	var legal := BlockfireTheme.label("Audio: Jesús Lastra · CC-BY 3.0 · Ver CREDITS.md\nAvatar: Quaternius UMC · CC0 · Armas: Kenney · CC0", 10, Color("#6d86a6"))
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
	_animate_panel_in(settings_popup)

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

func _settings() -> Node:
	return get_node_or_null("/root/SettingsStore") if is_inside_tree() else null

func _material(color: Color) -> StandardMaterial3D:
	var material := StandardMaterial3D.new()
	material.albedo_color = color
	material.roughness = 0.85
	return material

func _emissive(color: Color, energy: float) -> StandardMaterial3D:
	var material := _material(color)
	material.emission_enabled = true
	material.emission = color
	material.emission_energy_multiplier = energy
	return material
