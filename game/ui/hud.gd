class_name BlockfireHud
extends CanvasLayer

const ControlEditorScript := preload("res://game/ui/control_editor.gd")
const CrosshairScript := preload("res://game/ui/crosshair.gd")

signal buy_requested(index: int)
signal arsenal_requested
signal settings_requested
signal exit_requested
signal spectator_next
signal spectator_previous

var match_context: Node
var mobile_controls: BlockfireMobileControls
var root: Control
var score_label: Label
var round_label: Label
var health_label: Label
var health_bar: ProgressBar
var ammo_label: Label
var reserve_label: Label
var weapon_label: Label
var status_label: Label
var banner_label: Label
var damage_label: Label
var crosshair: Control
var bottom_bar: HBoxContainer
var control_editor
var settings_panel: PanelContainer
var settings_backdrop: ColorRect
var return_to_settings: bool = false
var buy_panel: PanelContainer
var buy_title: Label
var buy_timer: Label
var buy_coins: Label
var buy_warning: Label
var buy_buttons: Array[Button] = []
var spectator_panel: PanelContainer
var end_panel: PanelContainer
var ui_audio: AudioStreamPlayer
var mobile_qa: bool = false
## Actores congelados mientras un overlay interactivo está abierto.
var _editor_frozen: Array[Node] = []
var _overlay_input_states: Dictionary = {}

func setup(context: Node, use_mobile_qa: bool) -> void:
	match_context = context
	mobile_qa = use_mobile_qa
	_build()

func _build() -> void:
	root = Control.new()
	root.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(root)
	ui_audio = AudioStreamPlayer.new()
	ui_audio.name = "UiFeedbackSfx"
	ui_audio.bus = "UI"
	add_child(ui_audio)

	var top_panel := PanelContainer.new()
	top_panel.anchor_left = 0.5
	top_panel.anchor_right = 0.5
	top_panel.offset_left = -120
	top_panel.offset_right = 120
	top_panel.offset_top = 14
	top_panel.offset_bottom = 56
	top_panel.add_theme_stylebox_override("panel", BlockfireTheme.panel(Color("#071127dc"), Color("#35557a"), 12, 1))
	root.add_child(top_panel)
	var top_row := HBoxContainer.new()
	top_row.alignment = BoxContainer.ALIGNMENT_CENTER
	top_row.add_theme_constant_override("separation", 14)
	top_panel.add_child(top_row)
	score_label = BlockfireTheme.label("0  —  0", 18, Color.WHITE)
	score_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	top_row.add_child(score_label)
	round_label = BlockfireTheme.label("R1", 11, BlockfireTheme.GOLD)
	top_row.add_child(round_label)

	var settings := Button.new()
	settings.text = "AJUSTES"
	settings.tooltip_text = "Ajustes y controles"
	settings.anchor_left = 1.0
	settings.anchor_right = 1.0
	settings.offset_left = -166
	settings.offset_right = -88
	settings.offset_top = 14
	settings.offset_bottom = 56
	settings.z_index = 5
	settings.add_theme_font_size_override("font_size", 11)
	BlockfireTheme.apply_button(settings, Color("#80cfff"))
	settings.pressed.connect(func() -> void: settings_requested.emit())
	root.add_child(settings)

	var arsenal := Button.new()
	arsenal.text = "ARMA"
	arsenal.tooltip_text = "Cambiar arma"
	arsenal.anchor_left = 1.0
	arsenal.anchor_right = 1.0
	arsenal.offset_left = -76
	arsenal.offset_right = -16
	arsenal.offset_top = 14
	arsenal.offset_bottom = 56
	arsenal.z_index = 5
	arsenal.add_theme_font_size_override("font_size", 11)
	BlockfireTheme.apply_button(arsenal, BlockfireTheme.GOLD)
	arsenal.pressed.connect(func() -> void: arsenal_requested.emit())
	root.add_child(arsenal)

	crosshair = CrosshairScript.new()
	crosshair.name = "Crosshair"
	crosshair.custom_minimum_size = Vector2(34, 34)
	crosshair.anchor_left = 0.5
	crosshair.anchor_top = 0.5
	crosshair.anchor_right = 0.5
	crosshair.anchor_bottom = 0.5
	crosshair.offset_left = -17
	crosshair.offset_top = -17
	crosshair.offset_right = 17
	crosshair.offset_bottom = 17
	root.add_child(crosshair)

	bottom_bar = HBoxContainer.new()
	bottom_bar.anchor_left = 0.5
	bottom_bar.anchor_top = 1.0
	bottom_bar.anchor_right = 0.5
	bottom_bar.anchor_bottom = 1.0
	bottom_bar.offset_left = -154
	bottom_bar.offset_right = 154
	# Información compacta, separada de los pulgares: suficiente altura para la
	# barra de vida y el cargador sin convertir el centro inferior en un panel.
	bottom_bar.offset_top = -92
	bottom_bar.offset_bottom = -18
	bottom_bar.alignment = BoxContainer.ALIGNMENT_CENTER
	bottom_bar.add_theme_constant_override("separation", 8)
	root.add_child(bottom_bar)
	var health_panel := PanelContainer.new()
	health_panel.custom_minimum_size = Vector2(116, 44)
	health_panel.add_theme_stylebox_override("panel", BlockfireTheme.panel(Color("#071127d9"), Color("#347ea1"), 10, 1))
	bottom_bar.add_child(health_panel)
	var health_stack := VBoxContainer.new()
	health_stack.add_theme_constant_override("separation", 2)
	health_panel.add_child(health_stack)
	health_label = BlockfireTheme.label("200", 18, Color("#7de1ff"))
	health_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	health_stack.add_child(health_label)
	health_bar = ProgressBar.new()
	health_bar.min_value = 0.0
	health_bar.max_value = 200.0
	health_bar.value = 200.0
	health_bar.show_percentage = false
	health_bar.custom_minimum_size = Vector2(88, 7)
	health_bar.add_theme_stylebox_override("background", BlockfireTheme.button_style(Color("#15233a"), Color("#2c4361"), 4))
	health_bar.add_theme_stylebox_override("fill", BlockfireTheme.button_style(Color("#2793af"), Color("#7de1ff"), 4))
	health_stack.add_child(health_bar)
	var ammo_panel := PanelContainer.new()
	ammo_panel.custom_minimum_size = Vector2(156, 44)
	ammo_panel.add_theme_stylebox_override("panel", BlockfireTheme.panel(Color("#071127d9"), Color("#49607e"), 10, 1))
	bottom_bar.add_child(ammo_panel)
	var ammo_stack := VBoxContainer.new()
	ammo_stack.add_theme_constant_override("separation", 0)
	ammo_panel.add_child(ammo_stack)
	var ammo_row := HBoxContainer.new()
	ammo_row.alignment = BoxContainer.ALIGNMENT_CENTER
	ammo_row.add_theme_constant_override("separation", 4)
	ammo_stack.add_child(ammo_row)
	ammo_label = BlockfireTheme.label("12", 23, Color.WHITE)
	ammo_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	ammo_row.add_child(ammo_label)
	reserve_label = BlockfireTheme.label("/ 72", 13, Color("#9db7db"))
	reserve_label.vertical_alignment = VERTICAL_ALIGNMENT_BOTTOM
	ammo_row.add_child(reserve_label)
	weapon_label = BlockfireTheme.label("PISTOL", 9, Color("#9db7db"))
	weapon_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	ammo_stack.add_child(weapon_label)

	status_label = BlockfireTheme.label("", 13, Color("#ffd471"))
	status_label.anchor_left = 0.5
	status_label.anchor_top = 0.18
	status_label.anchor_right = 0.5
	status_label.anchor_bottom = 0.18
	status_label.offset_left = -220
	status_label.offset_right = 220
	status_label.offset_bottom = 30
	status_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	status_label.add_theme_color_override("font_shadow_color", Color("#000000aa"))
	status_label.add_theme_constant_override("shadow_offset_x", 2)
	status_label.add_theme_constant_override("shadow_offset_y", 2)
	root.add_child(status_label)
	banner_label = BlockfireTheme.label("", 28, Color.WHITE)
	banner_label.anchor_left = 0.5
	banner_label.anchor_top = 0.34
	banner_label.anchor_right = 0.5
	banner_label.anchor_bottom = 0.34
	banner_label.offset_left = -300
	banner_label.offset_right = 300
	banner_label.offset_bottom = 52
	banner_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	banner_label.add_theme_color_override("font_shadow_color", Color("#000000aa"))
	banner_label.add_theme_constant_override("shadow_offset_x", 3)
	banner_label.add_theme_constant_override("shadow_offset_y", 3)
	root.add_child(banner_label)
	damage_label = BlockfireTheme.label("", 13, Color("#ff8b72"))
	damage_label.anchor_left = 0.5
	damage_label.anchor_top = 0.55
	damage_label.anchor_right = 0.5
	damage_label.anchor_bottom = 0.55
	damage_label.offset_left = -200
	damage_label.offset_right = 200
	damage_label.offset_bottom = 34
	damage_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	damage_label.add_theme_color_override("font_shadow_color", Color("#000000aa"))
	damage_label.add_theme_constant_override("shadow_offset_x", 2)
	damage_label.add_theme_constant_override("shadow_offset_y", 2)
	root.add_child(damage_label)

	if mobile_qa or DisplayServer.is_touchscreen_available():
		mobile_controls = BlockfireMobileControls.new()
		mobile_controls.name = "MobileControls"
		mobile_controls.configure(mobile_qa)
		root.add_child(mobile_controls)

func update_score(ally: int, enemy: int, round_number: int) -> void:
	if score_label != null:
		score_label.text = "%d   —   %d" % [ally, enemy]
		round_label.text = "R%d" % round_number

func update_ffa_score(kills: int, target: int) -> void:
	if score_label != null:
		score_label.text = "KILLS %d / %d" % [kills, target]
		round_label.text = "FFA"

func update_health(value: float, maximum: float) -> void:
	if health_label != null:
		health_label.text = "%d" % roundi(value)
		health_label.add_theme_color_override("font_color", Color("#ff887d") if value <= maximum * 0.3 else Color("#7de1ff"))
	if health_bar != null:
		health_bar.max_value = maximum
		health_bar.value = clampf(value, 0.0, maximum)
		health_bar.add_theme_stylebox_override("fill", BlockfireTheme.button_style(
		Color("#b84c5a") if value <= maximum * 0.3 else Color("#2793af"),
		Color("#ff8b7d") if value <= maximum * 0.3 else Color("#7de1ff"), 4))

func update_ammo(current: int, reserve: int, definition: WeaponDefinition) -> void:
	if ammo_label != null:
		ammo_label.text = "%d" % current
	if reserve_label != null:
		reserve_label.text = "/ %d" % reserve
	if weapon_label != null:
		weapon_label.text = definition.short_name

func set_status(text: String, color: Color = Color("#ffd471")) -> void:
	if status_label != null:
		status_label.text = text
		status_label.add_theme_color_override("font_color", color)

func show_banner(text: String, duration: float = 1.6) -> void:
	if banner_label == null:
		return
	banner_label.text = text
	banner_label.modulate = Color.WHITE
	var tween := create_tween()
	tween.tween_interval(duration)
	tween.tween_property(banner_label, "modulate", Color(1, 1, 1, 0), 0.35)

func show_damage(text: String, headshot: bool = false) -> void:
	if damage_label == null:
		return
	damage_label.text = text
	damage_label.add_theme_color_override("font_color", Color("#ffe07b") if headshot else Color("#ff9a86"))
	damage_label.modulate = Color.WHITE
	var tween := create_tween()
	tween.tween_interval(0.55)
	tween.tween_property(damage_label, "modulate", Color(1, 1, 1, 0), 0.28)

func show_hit_feedback(amount: float, headshot: bool) -> void:
	show_damage("%d%s" % [roundi(amount), "  HEADSHOT" if headshot else ""], headshot)
	if crosshair != null:
		crosshair.register_hit(headshot)
	_play_ui_sound("res://assets/sfx/sfx_headshot.ogg" if headshot else "res://assets/sfx/sfx_hit.ogg")

func show_kill(headshot: bool = false) -> void:
	show_banner("HEADSHOT" if headshot else "ELIMINACIÓN", 0.8)
	_play_ui_sound("res://assets/sfx/sfx_headshot.ogg" if headshot else "res://assets/sfx/sfx_kill.ogg")

func _play_ui_sound(path: String) -> void:
	if ui_audio == null:
		return
	ui_audio.stream = load(path) as AudioStream
	ui_audio.play()

func show_buy(visible: bool, seconds: float, coins: int, definitions: Array[WeaponDefinition], equipped: int) -> void:
	if visible:
		if is_instance_valid(buy_panel):
			buy_panel.queue_free()
		buy_panel = PanelContainer.new()
		buy_panel.anchor_left = 0.5
		buy_panel.anchor_top = 1.0
		buy_panel.anchor_right = 0.5
		buy_panel.anchor_bottom = 1.0
		buy_panel.offset_left = -380
		buy_panel.offset_right = 380
		# La compra debe informar sin tapar la arena: cuatro tarjetas compactas
		# dejan visible la acción y la cobertura del mapa.
		buy_panel.offset_top = -254
		buy_panel.offset_bottom = -18
		buy_panel.add_theme_stylebox_override("panel", BlockfireTheme.panel(Color("#071127f0"), Color("#536f95"), 16, 2))
		root.add_child(buy_panel)
		var stack := VBoxContainer.new()
		stack.add_theme_constant_override("separation", 8)
		buy_panel.add_child(stack)
		var header := HBoxContainer.new()
		stack.add_child(header)
		buy_title = BlockfireTheme.label("FASE DE COMPRA", 15, BlockfireTheme.GOLD)
		header.add_child(buy_title)
		buy_timer = BlockfireTheme.label("%d s" % ceili(seconds), 16, Color.WHITE)
		buy_timer.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		buy_timer.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
		header.add_child(buy_timer)
		buy_coins = BlockfireTheme.label("CRÉDITOS  %d" % coins, 14, Color("#ffe285"))
		buy_coins.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
		stack.add_child(buy_coins)
		buy_warning = BlockfireTheme.label("", 13, Color("#ff9d86"))
		buy_warning.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		stack.add_child(buy_warning)
		var row := HBoxContainer.new()
		row.add_theme_constant_override("separation", 8)
		stack.add_child(row)
		buy_buttons.clear()
		for index: int in range(definitions.size()):
			var definition := definitions[index]
			var button := Button.new()
			var owned: bool = match_context != null and match_context.has_method("is_weapon_owned") and bool(match_context.is_weapon_owned(index))
			var state_text := "EQUIPADA" if index == equipped else ("COMPRADA" if owned else "COSTE %d" % definition.cost)
			var mode_text := "AUTO" if definition.automatic else "SEMI"
			button.text = "%s\n%s\n%d DMG · %s · %d" % [definition.display_name, state_text, roundi(definition.damage), mode_text, definition.magazine_size]
			button.custom_minimum_size = Vector2(0, 78)
			button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
			button.add_theme_font_size_override("font_size", 11)
			BlockfireTheme.apply_button(button, BlockfireTheme.GOLD)
			button.pressed.connect(func() -> void: buy_requested.emit(index))
			row.add_child(button)
			buy_buttons.append(button)
			button.modulate = Color.WHITE if index == equipped else (Color("#b6e3cb") if owned else Color("#8795a8"))
		var hint := BlockfireTheme.label("Primero en 4 rondas · compra y equipa antes del cierre", 10, Color("#9db7db"))
		hint.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		stack.add_child(hint)
		if mobile_controls != null:
			mobile_controls.visible = false
		if bottom_bar != null:
			bottom_bar.visible = false
	else:
		if is_instance_valid(buy_panel):
			buy_panel.queue_free()
			buy_panel = null
		if mobile_controls != null:
			mobile_controls.visible = true
		if bottom_bar != null:
			bottom_bar.visible = true

func toggle_control_editor() -> void:
	if mobile_controls == null:
		set_status("EDITOR DISPONIBLE EN CONTROLES TÁCTILES", Color("#ffd471"))
		return
	if is_instance_valid(control_editor):
		_close_control_editor()
		return
	_open_control_editor(false)

func toggle_settings() -> void:
	if is_instance_valid(control_editor):
		return
	if is_instance_valid(settings_panel):
		_close_settings_panel()
		_resume_from_overlay()
		return
	_freeze_for_overlay()
	_open_settings_panel()

func _open_control_editor(from_settings: bool) -> void:
	return_to_settings = from_settings
	if not from_settings:
		_freeze_for_overlay()
	control_editor = ControlEditorScript.new()
	control_editor.name = "ControlEditor"
	control_editor.setup(mobile_controls)
	control_editor.closed.connect(_close_control_editor)
	root.add_child(control_editor)

func _freeze_for_overlay() -> void:
	_editor_frozen.clear()
	_overlay_input_states.clear()
	if match_context != null and match_context.has_method("set_local_overlay_paused"):
		match_context.set_local_overlay_paused(true)
	# Guarda el input antes de _stop_combat_inputs(), que lo limpia para evitar
	# que al cerrar el modal quede el jugador permanentemente deshabilitado.
	if match_context != null and match_context.has_method("get_combatants"):
		for actor: Node in match_context.get_combatants():
			if is_instance_valid(actor) and bool(actor.get("is_alive")):
				if actor.get("input_enabled") != null:
					_overlay_input_states[actor.get_instance_id()] = bool(actor.get("input_enabled"))
	if match_context != null and match_context.has_method("_stop_combat_inputs"):
		match_context._stop_combat_inputs()
	if match_context != null and match_context.has_method("get_combatants"):
		for actor: Node in match_context.get_combatants():
			if is_instance_valid(actor) and actor.has_method("get") and bool(actor.get("is_alive")):
				_editor_frozen.append(actor)
				actor.set_physics_process(false)
	if mobile_controls != null:
		mobile_controls.release_all()

func _resume_from_overlay() -> void:
	for actor: Node in _editor_frozen:
		if is_instance_valid(actor):
			actor.set_physics_process(true)
			var saved_input: Variant = _overlay_input_states.get(actor.get_instance_id(), null)
			if saved_input != null and actor.get("input_enabled") != null:
				actor.set("input_enabled", bool(saved_input))
	_editor_frozen.clear()
	_overlay_input_states.clear()
	if match_context != null and match_context.has_method("set_local_overlay_paused"):
		match_context.set_local_overlay_paused(false)
	if mobile_controls != null:
		mobile_controls.release_all()

func _resume_from_editor() -> void:
	# Alias de compatibilidad para la suite DEV y herramientas antiguas.
	_resume_from_overlay()

func _close_control_editor() -> void:
	if is_instance_valid(control_editor):
		control_editor.queue_free()
	control_editor = null
	if return_to_settings:
		return_to_settings = false
		_open_settings_panel()
	else:
		_resume_from_overlay()

func _close_settings_panel() -> void:
	if is_instance_valid(settings_backdrop):
		settings_backdrop.queue_free()
		settings_backdrop = null
	if is_instance_valid(settings_panel):
		settings_panel.queue_free()
		settings_panel = null

func _open_settings_panel() -> void:
	if is_instance_valid(settings_panel):
		return
	if mobile_controls != null:
		mobile_controls.visible = false
	if bottom_bar != null:
		bottom_bar.visible = false
	if crosshair != null:
		crosshair.visible = false
	settings_backdrop = ColorRect.new()
	settings_backdrop.name = "SettingsBackdrop"
	settings_backdrop.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	settings_backdrop.color = Color(0.01, 0.03, 0.08, 0.72)
	settings_backdrop.mouse_filter = Control.MOUSE_FILTER_STOP
	settings_backdrop.z_index = 30
	root.add_child(settings_backdrop)
	settings_panel = PanelContainer.new()
	settings_panel.name = "SettingsPanel"
	settings_panel.set_anchors_preset(Control.PRESET_CENTER)
	settings_panel.position = Vector2(-250.0, -205.0)
	settings_panel.size = Vector2(500.0, 410.0)
	settings_panel.add_theme_stylebox_override("panel", BlockfireTheme.panel(Color("#08152beF"), Color("#80cfff"), 16, 2))
	settings_panel.z_index = 31
	root.add_child(settings_panel)
	var stack := VBoxContainer.new()
	stack.add_theme_constant_override("separation", 8)
	settings_panel.add_child(stack)
	var header := HBoxContainer.new()
	stack.add_child(header)
	var title := BlockfireTheme.label("AJUSTES", 22, Color.WHITE)
	header.add_child(title)
	var state := BlockfireTheme.label("PARTIDA EN PAUSA", 10, Color("#8ff1c5"))
	state.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	state.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	header.add_child(state)
	var hint := BlockfireTheme.label("Configura tu experiencia sin perder el estado de la ronda.", 11, Color("#a9c4e5"))
	hint.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	stack.add_child(hint)
	_add_setting_slider(stack, "VOLUMEN MASTER", "master_volume", 0.0, 1.0, 0.85)
	_add_setting_slider(stack, "VOLUMEN SFX", "sfx_volume", 0.0, 1.0, 0.9)
	_add_setting_slider(stack, "SENSIBILIDAD", "sensitivity", 0.04, 0.25, 0.12)
	_add_setting_slider(stack, "MULTIPLICADOR ADS", "ads_multiplier", 0.45, 1.0, 0.72)
	_add_setting_slider(stack, "OPACIDAD TÁCTIL", "mobile_opacity", 0.35, 1.0, 0.68)
	var actions := HBoxContainer.new()
	actions.add_theme_constant_override("separation", 8)
	stack.add_child(actions)
	var edit := Button.new()
	edit.text = "EDITAR CONTROLES"
	edit.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	BlockfireTheme.apply_button(edit, Color("#80cfff"))
	edit.pressed.connect(func() -> void:
		_close_settings_panel()
		_open_control_editor(true)
	)
	actions.add_child(edit)
	var close := Button.new()
	close.text = "CONTINUAR"
	close.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	BlockfireTheme.apply_button(close, BlockfireTheme.GOLD)
	close.pressed.connect(func() -> void:
		_close_settings_panel()
		_resume_from_overlay()
	)
	actions.add_child(close)

func _add_setting_slider(stack: VBoxContainer, label_text: String, key: String, minimum: float, maximum: float, fallback: float) -> void:
	var label := BlockfireTheme.label(label_text, 10, Color("#9db7db"))
	stack.add_child(label)
	var slider := HSlider.new()
	slider.min_value = minimum
	slider.max_value = maximum
	slider.step = 0.01
	var settings := get_node_or_null("/root/SettingsStore") if is_inside_tree() else null
	slider.value = float(settings.get_value(key, fallback) if settings != null else fallback)
	slider.value_changed.connect(func(value: float) -> void:
		if settings != null:
			settings.set_value(key, value)
	)
	stack.add_child(slider)

func update_buy_time(seconds: float) -> void:
	if buy_timer != null:
		buy_timer.text = "%d s" % ceili(maxf(0.0, seconds))

func show_buy_warning(text: String) -> void:
	if buy_warning != null:
		buy_warning.text = text
		buy_warning.modulate = Color.WHITE
		var tween := create_tween()
		tween.tween_interval(1.4)
		tween.tween_property(buy_warning, "modulate", Color(1, 1, 1, 0), 0.4)
	set_status(text, Color("#ff9d86"))

func show_death(text: String = "ELIMINADO") -> void:
	set_status(text, Color("#ff8e82"))
	show_banner(text, 1.2)
	if mobile_controls != null:
		mobile_controls.visible = false
	if bottom_bar != null:
		bottom_bar.visible = false
	if crosshair != null:
		crosshair.visible = false

func show_spectator(target_name: String) -> void:
	if mobile_controls != null:
		mobile_controls.visible = false
	if bottom_bar != null:
		bottom_bar.visible = false
	if crosshair != null:
		crosshair.visible = false
	if is_instance_valid(spectator_panel):
		spectator_panel.queue_free()
	spectator_panel = PanelContainer.new()
	spectator_panel.anchor_left = 0.5
	spectator_panel.anchor_top = 1.0
	spectator_panel.anchor_right = 0.5
	spectator_panel.anchor_bottom = 1.0
	spectator_panel.offset_left = -180
	spectator_panel.offset_right = 180
	spectator_panel.offset_top = -110
	spectator_panel.offset_bottom = -22
	spectator_panel.add_theme_stylebox_override("panel", BlockfireTheme.panel(Color("#071127d9"), Color("#6c8db7"), 12, 1))
	root.add_child(spectator_panel)
	var row := HBoxContainer.new()
	row.alignment = BoxContainer.ALIGNMENT_CENTER
	spectator_panel.add_child(row)
	var previous := Button.new()
	previous.text = "‹"
	BlockfireTheme.apply_button(previous, Color("#80cfff"))
	previous.pressed.connect(func() -> void: spectator_previous.emit())
	row.add_child(previous)
	var label := BlockfireTheme.label("ESPECTANDO  " + target_name, 13, Color.WHITE)
	label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	row.add_child(label)
	var next := Button.new()
	next.text = "›"
	BlockfireTheme.apply_button(next, Color("#80cfff"))
	next.pressed.connect(func() -> void: spectator_next.emit())
	row.add_child(next)

func hide_spectator() -> void:
	if is_instance_valid(spectator_panel):
		spectator_panel.queue_free()
		spectator_panel = null
	if bottom_bar != null:
		bottom_bar.visible = true
	if crosshair != null:
		crosshair.visible = true
	if mobile_controls != null:
		mobile_controls.visible = true

func show_match_end(title: String, subtitle: String) -> void:
	if mobile_controls != null:
		mobile_controls.release_all()
		mobile_controls.visible = false
	if bottom_bar != null:
		bottom_bar.visible = false
	if crosshair != null:
		crosshair.visible = false
	if is_instance_valid(end_panel):
		end_panel.queue_free()
	end_panel = PanelContainer.new()
	end_panel.set_anchors_and_offsets_preset(Control.PRESET_CENTER)
	end_panel.position -= Vector2(250, 150)
	end_panel.size = Vector2(500, 300)
	end_panel.add_theme_stylebox_override("panel", BlockfireTheme.panel(Color("#071127f5"), BlockfireTheme.GOLD, 18, 2))
	root.add_child(end_panel)
	var stack := VBoxContainer.new()
	stack.alignment = BoxContainer.ALIGNMENT_CENTER
	stack.add_theme_constant_override("separation", 14)
	end_panel.add_child(stack)
	var title_label := BlockfireTheme.label(title, 34, Color.WHITE)
	title_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	stack.add_child(title_label)
	var sub := BlockfireTheme.label(subtitle, 14, Color("#b9cde7"))
	sub.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	stack.add_child(sub)
	var retry := Button.new()
	retry.text = "REINTENTAR"
	BlockfireTheme.apply_button(retry, BlockfireTheme.GOLD)
	retry.pressed.connect(func() -> void:
		if match_context != null and match_context.has_method("retry"):
			match_context.retry()
	)
	stack.add_child(retry)
	var lobby := Button.new()
	lobby.text = "VOLVER AL LOBBY"
	BlockfireTheme.apply_button(lobby, Color("#80cfff"))
	lobby.pressed.connect(func() -> void: exit_requested.emit())
	stack.add_child(lobby)
