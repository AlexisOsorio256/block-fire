class_name BlockfireHud
extends CanvasLayer

const ControlEditorScript := preload("res://game/ui/control_editor.gd")

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
var ammo_label: Label
var weapon_label: Label
var status_label: Label
var banner_label: Label
var damage_label: Label
var bottom_bar: HBoxContainer
var control_editor
var buy_panel: PanelContainer
var buy_title: Label
var buy_timer: Label
var buy_coins: Label
var buy_buttons: Array[Button] = []
var spectator_panel: PanelContainer
var end_panel: PanelContainer
var mobile_qa: bool = false

func setup(context: Node, use_mobile_qa: bool) -> void:
	match_context = context
	mobile_qa = use_mobile_qa
	_build()

func _build() -> void:
	root = Control.new()
	root.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(root)

	var top_panel := PanelContainer.new()
	top_panel.anchor_left = 0.5
	top_panel.anchor_right = 0.5
	top_panel.offset_left = -155
	top_panel.offset_right = 155
	top_panel.offset_top = 18
	top_panel.offset_bottom = 65
	top_panel.add_theme_stylebox_override("panel", BlockfireTheme.panel(Color("#071127dc"), Color("#35557a"), 12, 1))
	root.add_child(top_panel)
	var top_row := HBoxContainer.new()
	top_row.alignment = BoxContainer.ALIGNMENT_CENTER
	top_row.add_theme_constant_override("separation", 18)
	top_panel.add_child(top_row)
	score_label = BlockfireTheme.label("0  —  0", 21, Color.WHITE)
	score_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	top_row.add_child(score_label)
	round_label = BlockfireTheme.label("R1", 12, BlockfireTheme.GOLD)
	top_row.add_child(round_label)

	var settings := Button.new()
	settings.text = "⚙"
	settings.tooltip_text = "Editar controles"
	settings.anchor_left = 1.0
	settings.anchor_right = 1.0
	settings.offset_left = -154
	settings.offset_right = -90
	settings.offset_top = 18
	settings.offset_bottom = 64
	BlockfireTheme.apply_button(settings, Color("#80cfff"))
	settings.pressed.connect(func() -> void: settings_requested.emit())
	root.add_child(settings)

	var arsenal := Button.new()
	arsenal.text = "▣"
	arsenal.tooltip_text = "Abrir arsenal (B)"
	arsenal.anchor_left = 1.0
	arsenal.anchor_right = 1.0
	arsenal.offset_left = -84
	arsenal.offset_right = -20
	arsenal.offset_top = 18
	arsenal.offset_bottom = 64
	BlockfireTheme.apply_button(arsenal, BlockfireTheme.GOLD)
	arsenal.pressed.connect(func() -> void: arsenal_requested.emit())
	root.add_child(arsenal)

	var crosshair := BlockfireTheme.label("+", 28, Color("#ffffffcc"))
	crosshair.anchor_left = 0.5
	crosshair.anchor_top = 0.5
	crosshair.anchor_right = 0.5
	crosshair.anchor_bottom = 0.5
	crosshair.offset_left = -10
	crosshair.offset_top = -20
	crosshair.offset_right = 10
	crosshair.offset_bottom = 10
	crosshair.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	root.add_child(crosshair)

	bottom_bar = HBoxContainer.new()
	bottom_bar.anchor_left = 0.5
	bottom_bar.anchor_top = 1.0
	bottom_bar.anchor_right = 0.5
	bottom_bar.anchor_bottom = 1.0
	bottom_bar.offset_left = -225
	bottom_bar.offset_right = 225
	bottom_bar.offset_top = -84
	bottom_bar.offset_bottom = -22
	bottom_bar.alignment = BoxContainer.ALIGNMENT_CENTER
	bottom_bar.add_theme_constant_override("separation", 20)
	root.add_child(bottom_bar)
	var health_panel := PanelContainer.new()
	health_panel.custom_minimum_size = Vector2(150, 58)
	health_panel.add_theme_stylebox_override("panel", BlockfireTheme.panel(Color("#071127d9"), Color("#347ea1"), 10, 1))
	bottom_bar.add_child(health_panel)
	health_label = BlockfireTheme.label("200  HP", 22, Color("#7de1ff"))
	health_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	health_panel.add_child(health_label)
	var ammo_panel := PanelContainer.new()
	ammo_panel.custom_minimum_size = Vector2(210, 58)
	ammo_panel.add_theme_stylebox_override("panel", BlockfireTheme.panel(Color("#071127d9"), Color("#49607e"), 10, 1))
	bottom_bar.add_child(ammo_panel)
	var ammo_stack := VBoxContainer.new()
	ammo_panel.add_child(ammo_stack)
	ammo_label = BlockfireTheme.label("12 / 72", 21, Color.WHITE)
	ammo_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	ammo_stack.add_child(ammo_label)
	weapon_label = BlockfireTheme.label("PISTOL", 10, Color("#9db7db"))
	weapon_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	ammo_stack.add_child(weapon_label)

	status_label = BlockfireTheme.label("", 14, Color("#ffd471"))
	status_label.anchor_left = 0.5
	status_label.anchor_top = 0.18
	status_label.anchor_right = 0.5
	status_label.anchor_bottom = 0.18
	status_label.offset_left = -220
	status_label.offset_right = 220
	status_label.offset_bottom = 30
	status_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	root.add_child(status_label)
	banner_label = BlockfireTheme.label("", 32, Color.WHITE)
	banner_label.anchor_left = 0.5
	banner_label.anchor_top = 0.34
	banner_label.anchor_right = 0.5
	banner_label.anchor_bottom = 0.34
	banner_label.offset_left = -300
	banner_label.offset_right = 300
	banner_label.offset_bottom = 56
	banner_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	root.add_child(banner_label)
	damage_label = BlockfireTheme.label("", 14, Color("#ff8b72"))
	damage_label.anchor_left = 0.5
	damage_label.anchor_top = 0.55
	damage_label.anchor_right = 0.5
	damage_label.anchor_bottom = 0.55
	damage_label.offset_left = -200
	damage_label.offset_right = 200
	damage_label.offset_bottom = 36
	damage_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
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

func update_health(value: float, maximum: float) -> void:
	if health_label != null:
		health_label.text = "%d  HP" % roundi(value)
		health_label.modulate = Color("#ff887d") if value <= maximum * 0.3 else Color("#7de1ff")

func update_ammo(current: int, reserve: int, definition: WeaponDefinition) -> void:
	if ammo_label != null:
		ammo_label.text = "%d / %d" % [current, reserve]
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

func show_buy(visible: bool, seconds: float, coins: int, definitions: Array[WeaponDefinition], equipped: int) -> void:
	if visible:
		if is_instance_valid(buy_panel):
			buy_panel.queue_free()
		buy_panel = PanelContainer.new()
		buy_panel.anchor_left = 0.5
		buy_panel.anchor_top = 1.0
		buy_panel.anchor_right = 0.5
		buy_panel.anchor_bottom = 1.0
		buy_panel.offset_left = -430
		buy_panel.offset_right = 430
		buy_panel.offset_top = -214
		buy_panel.offset_bottom = -20
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
		buy_coins = BlockfireTheme.label("🪙 %d" % coins, 14, Color("#ffe285"))
		buy_coins.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
		stack.add_child(buy_coins)
		var row := HBoxContainer.new()
		row.add_theme_constant_override("separation", 8)
		stack.add_child(row)
		buy_buttons.clear()
		for index: int in range(definitions.size()):
			var definition := definitions[index]
			var button := Button.new()
			button.text = "%s\n🪙 %d" % [definition.display_name, definition.cost]
			button.custom_minimum_size = Vector2(0, 72)
			button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
			button.add_theme_font_size_override("font_size", 14)
			BlockfireTheme.apply_button(button, BlockfireTheme.GOLD)
			button.pressed.connect(func() -> void: buy_requested.emit(index))
			row.add_child(button)
			buy_buttons.append(button)
			button.modulate = Color.WHITE if index == equipped else Color("#8795a8")
		var hint := BlockfireTheme.label("GANA EL PRIMERO EN LLEGAR A 4 RONDAS · las rondas se ganan eliminando al equipo rival", 10, Color("#9db7db"))
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
		control_editor.queue_free()
		control_editor = null
		return
	control_editor = ControlEditorScript.new()
	control_editor.name = "ControlEditor"
	control_editor.setup(mobile_controls)
	control_editor.closed.connect(_close_control_editor)
	root.add_child(control_editor)

func _close_control_editor() -> void:
	if is_instance_valid(control_editor):
		control_editor.queue_free()
	control_editor = null

func update_buy_time(seconds: float) -> void:
	if buy_timer != null:
		buy_timer.text = "%d s" % ceili(maxf(0.0, seconds))

func show_death(text: String = "ELIMINADO") -> void:
	set_status(text, Color("#ff8e82"))
	if mobile_controls != null:
		mobile_controls.visible = false

func show_spectator(target_name: String) -> void:
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

func show_match_end(title: String, subtitle: String) -> void:
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
