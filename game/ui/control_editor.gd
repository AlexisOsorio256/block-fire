class_name BlockfireControlEditor
extends Control

signal closed

var mobile_controls: BlockfireMobileControls
var selected_id: String = "fire"
var dragging: bool = false
var drag_pointer: int = -1
var scale_slider: HSlider
var opacity_slider: HSlider
var selected_label: Label
var panel_rect := Rect2(20, 20, 330, 310)

const CONTROL_IDS: Array[String] = ["joystick", "fire", "aim", "jump", "reload", "switch", "crouch", "sprint"]

func setup(controls: BlockfireMobileControls) -> void:
	mobile_controls = controls
	if mobile_controls != null:
		mobile_controls.visible = true
		mobile_controls.set_edit_mode(true)

func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_STOP
	_build_panel()
	queue_redraw()

func _exit_tree() -> void:
	if mobile_controls != null:
		mobile_controls.set_edit_mode(false)

func _build_panel() -> void:
	var panel := PanelContainer.new()
	panel.position = panel_rect.position
	panel.size = panel_rect.size
	panel.add_theme_stylebox_override("panel", BlockfireTheme.panel(Color("#071127f2"), Color("#80cfff"), 14, 2))
	add_child(panel)
	var stack := VBoxContainer.new()
	stack.add_theme_constant_override("separation", 7)
	panel.add_child(stack)
	var title := BlockfireTheme.label("EDITAR CONTROLES", 19, Color.WHITE)
	stack.add_child(title)
	var hint := BlockfireTheme.label("Arrastra un control. Solo se limita el área segura.", 10, Color("#a9c4e5"))
	hint.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	stack.add_child(hint)
	var grid := GridContainer.new()
	grid.columns = 4
	grid.add_theme_constant_override("h_separation", 5)
	grid.add_theme_constant_override("v_separation", 5)
	stack.add_child(grid)
	for id: String in CONTROL_IDS:
		var button := Button.new()
		button.text = id.to_upper()
		button.custom_minimum_size = Vector2(69, 30)
		button.add_theme_font_size_override("font_size", 10)
		BlockfireTheme.apply_button(button, Color("#80cfff"))
		button.pressed.connect(func() -> void: _select(id))
		grid.add_child(button)
	selected_label = BlockfireTheme.label("SELECCIONADO: " + selected_id.to_upper(), 11, BlockfireTheme.GOLD)
	stack.add_child(selected_label)
	var scale_text := BlockfireTheme.label("TAMAÑO", 10, Color("#a9c4e5"))
	stack.add_child(scale_text)
	scale_slider = HSlider.new()
	scale_slider.min_value = 0.7
	scale_slider.max_value = 1.45
	scale_slider.step = 0.01
	stack.add_child(scale_slider)
	var opacity_text := BlockfireTheme.label("OPACIDAD", 10, Color("#a9c4e5"))
	stack.add_child(opacity_text)
	opacity_slider = HSlider.new()
	opacity_slider.min_value = 0.25
	opacity_slider.max_value = 1.0
	opacity_slider.step = 0.01
	stack.add_child(opacity_slider)
	scale_slider.value_changed.connect(_on_scale_changed)
	opacity_slider.value_changed.connect(_on_opacity_changed)
	var actions := HBoxContainer.new()
	actions.add_theme_constant_override("separation", 6)
	stack.add_child(actions)
	var save := Button.new()
	save.text = "GUARDAR"
	BlockfireTheme.apply_button(save, BlockfireTheme.GOLD)
	save.pressed.connect(_save)
	actions.add_child(save)
	var reset := Button.new()
	reset.text = "RESTABLECER"
	BlockfireTheme.apply_button(reset, Color("#80cfff"))
	reset.pressed.connect(_reset)
	actions.add_child(reset)
	var close := Button.new()
	close.text = "SALIR"
	BlockfireTheme.apply_button(close, Color("#80cfff"))
	close.pressed.connect(_close)
	actions.add_child(close)
	_select(selected_id)

func _gui_input(event: InputEvent) -> void:
	if event is InputEventScreenTouch:
		if event.pressed and not panel_rect.has_point(event.position):
			dragging = true
			drag_pointer = event.index
			_move_selected(event.position)
		else:
			dragging = false
			drag_pointer = -1
		accept_event()
	elif event is InputEventScreenDrag and dragging and event.index == drag_pointer:
		_move_selected(event.position)
		accept_event()
	elif event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_LEFT:
		if event.pressed and not panel_rect.has_point(event.position):
			dragging = true
			drag_pointer = 0
			_move_selected(event.position)
		else:
			dragging = false
			drag_pointer = -1
		accept_event()
	elif event is InputEventMouseMotion and dragging:
		_move_selected(event.position)
		accept_event()

func _select(id: String) -> void:
	selected_id = id
	if selected_label != null:
		selected_label.text = "SELECCIONADO: " + selected_id.to_upper()
	if mobile_controls != null:
		scale_slider.value = mobile_controls.get_control_scale(selected_id)
		opacity_slider.value = mobile_controls.get_control_opacity(selected_id)

func _move_selected(position: Vector2) -> void:
	if mobile_controls == null or size.x <= 0.0 or size.y <= 0.0:
		return
	var safe_rect := mobile_controls.get_safe_area_rect()
	var margin := 46.0
	var clamped_position := Vector2(
		clampf(position.x, safe_rect.position.x + margin, safe_rect.end.x - margin),
		clampf(position.y, safe_rect.position.y + margin, safe_rect.end.y - margin)
	)
	var normalized := Vector2(clamped_position.x / size.x, clamped_position.y / size.y)
	mobile_controls.set_control_position(selected_id, normalized)

func _on_scale_changed(value: float) -> void:
	if mobile_controls != null:
		mobile_controls.set_control_scale(selected_id, value)

func _on_opacity_changed(value: float) -> void:
	if mobile_controls != null:
		mobile_controls.set_control_opacity(selected_id, value)

func _save() -> void:
	if mobile_controls != null:
		mobile_controls.save_layout()
		_select(selected_id)

func _reset() -> void:
	if mobile_controls != null:
		mobile_controls.reset_layout()
		_select(selected_id)

func _close() -> void:
	if mobile_controls != null:
		mobile_controls.save_layout()
	closed.emit()
