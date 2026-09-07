class_name BlockfireMobileControls
extends Control

signal fire_started
signal fire_stopped
signal look_dragged(delta: Vector2)
signal jump_requested

const ICON_STROKE: float = 3.0

var mobile_qa: bool = false
var move_vector: Vector2 = Vector2.ZERO
var look_delta: Vector2 = Vector2.ZERO
var jump_request: bool = false
var crouch_request: bool = false
var reload_request: bool = false
var switch_request: bool = false
var firing: bool = false
var aiming: bool = false
var sprinting: bool = false
var edit_mode: bool = false
var move_pointer: int = -1
var look_pointer: int = -1
var fire_pointer: int = -1
var aim_pointer: int = -1
var touch_positions: Dictionary = {}
var layout: Dictionary = {}

func configure(is_mobile_qa: bool) -> void:
	mobile_qa = is_mobile_qa
	var settings := _settings()
	layout = settings.get_control_layout() if settings != null else {}
	set_process(true)
	queue_redraw()

func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	# Let the HUD's top-right settings/arsenal buttons receive taps. Gameplay
	# touches are still consumed below once they are classified as controls.
	mouse_filter = Control.MOUSE_FILTER_PASS
	var settings := _settings()
	layout = settings.get_control_layout() if settings != null else {}
	queue_redraw()

func _process(_delta: float) -> void:
	queue_redraw()

func _notification(what: int) -> void:
	if what == NOTIFICATION_APPLICATION_FOCUS_OUT \
			or what == NOTIFICATION_APPLICATION_PAUSED \
			or what == NOTIFICATION_WM_WINDOW_FOCUS_OUT:
		release_all()

func _gui_input(event: InputEvent) -> void:
	if event is InputEventScreenTouch:
		if _is_hud_action(event.position):
			_dispatch_hud_action(event.position)
			return
		_handle_touch(event.index, event.position, event.pressed)
		accept_event()
	elif event is InputEventScreenDrag:
		_handle_drag(event.index, event.position, event.relative)
		accept_event()
	elif mobile_qa and event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_LEFT:
		if _is_hud_action(event.position):
			_dispatch_hud_action(event.position)
			return
		_handle_touch(0, event.position, event.pressed)
		accept_event()
	elif mobile_qa and event is InputEventMouseMotion and touch_positions.has(0):
		_handle_drag(0, event.position, event.relative)
		accept_event()

func get_move_vector() -> Vector2:
	return move_vector

func consume_look_delta() -> Vector2:
	var value := look_delta
	look_delta = Vector2.ZERO
	return value

func consume_jump() -> bool:
	var value := jump_request
	jump_request = false
	return value

func consume_crouch() -> bool:
	var value := crouch_request
	crouch_request = false
	return value

func consume_reload() -> bool:
	var value := reload_request
	reload_request = false
	return value

func consume_switch() -> bool:
	var value := switch_request
	switch_request = false
	return value

func is_firing() -> bool:
	return firing

func is_aiming() -> bool:
	return aiming

func is_aim_latched() -> bool:
	return aiming

func is_looking() -> bool:
	return look_pointer >= 0 or fire_pointer >= 0 or aim_pointer >= 0

func is_sprinting() -> bool:
	return sprinting

func set_edit_mode(enabled: bool) -> void:
	edit_mode = enabled
	queue_redraw()

func set_control_position(control_id: String, normalized: Vector2) -> void:
	var entry: Dictionary = layout.get(control_id, {})
	entry["position"] = [normalized.x, normalized.y]
	layout[control_id] = entry
	queue_redraw()

func get_safe_area_rect() -> Rect2:
	var viewport_rect := Rect2(Vector2.ZERO, size)
	if size.x <= 0.0 or size.y <= 0.0:
		return viewport_rect
	var safe_area := DisplayServer.get_display_safe_area()
	var screen_size := DisplayServer.screen_get_size()
	if safe_area.size.x <= 0 or safe_area.size.y <= 0 or screen_size.x <= 0 or screen_size.y <= 0:
		return viewport_rect
	var scale := Vector2(size.x / float(screen_size.x), size.y / float(screen_size.y))
	var scaled := Rect2(Vector2(safe_area.position) * scale, Vector2(safe_area.size) * scale)
	return scaled.intersection(viewport_rect)

func set_control_scale(control_id: String, value: float) -> void:
	var entry: Dictionary = layout.get(control_id, {})
	entry["scale"] = clampf(value, 0.7, 1.45)
	layout[control_id] = entry
	queue_redraw()

func set_control_opacity(control_id: String, value: float) -> void:
	var entry: Dictionary = layout.get(control_id, {})
	entry["opacity"] = clampf(value, 0.25, 1.0)
	layout[control_id] = entry
	queue_redraw()

func get_control_scale(control_id: String) -> float:
	return float(layout.get(control_id, {}).get("scale", 1.0))

func get_control_opacity(control_id: String) -> float:
	return float(layout.get(control_id, {}).get("opacity", 1.0))

func save_layout() -> void:
	var settings := _settings()
	if settings != null:
		settings.set_control_layout(layout)

func reset_layout() -> void:
	layout = {}
	var settings := _settings()
	if settings != null:
		settings.reset_control_layout()
	queue_redraw()

func qa_press_fire() -> void:
	firing = true
	fire_started.emit()

func qa_release_fire() -> void:
	firing = false
	fire_stopped.emit()

func qa_press_jump() -> void:
	jump_request = true
	jump_requested.emit()

func qa_tap_aim() -> void:
	aiming = not aiming

func qa_press_aim() -> void:
	qa_tap_aim()

func qa_release_aim() -> void:
	# ADS is tap-to-latch. Releasing the finger must not clear it.
	pass

func qa_set_move(value: Vector2) -> void:
	move_vector = value.limit_length(1.0)

func qa_drag_look(delta: Vector2) -> void:
	look_delta += delta

func release_all() -> void:
	var was_firing := firing
	move_pointer = -1
	look_pointer = -1
	fire_pointer = -1
	aim_pointer = -1
	touch_positions.clear()
	move_vector = Vector2.ZERO
	look_delta = Vector2.ZERO
	jump_request = false
	crouch_request = false
	reload_request = false
	switch_request = false
	firing = false
	aiming = false
	sprinting = false
	if was_firing:
		fire_stopped.emit()
	queue_redraw()

func _handle_touch(pointer: int, position: Vector2, pressed: bool) -> void:
	if pressed:
		touch_positions[pointer] = position
		if _in_fire(position):
			fire_pointer = pointer
			qa_press_fire()
		elif _in_aim(position):
			aim_pointer = pointer
			aiming = not aiming
		elif _in_jump(position):
			jump_request = true
			jump_requested.emit()
		elif _in_reload(position):
			reload_request = true
		elif _in_switch(position):
			switch_request = true
		elif _in_crouch(position):
			crouch_request = true
		elif _in_sprint(position):
			sprinting = not sprinting
		elif _in_move(position):
			move_pointer = pointer
			_update_move(position)
		else:
			look_pointer = pointer
	else:
		touch_positions.erase(pointer)
		if pointer == move_pointer:
			move_pointer = -1
			move_vector = Vector2.ZERO
		if pointer == look_pointer:
			look_pointer = -1
		if pointer == fire_pointer:
			fire_pointer = -1
			qa_release_fire()
		if pointer == aim_pointer:
			aim_pointer = -1

func _handle_drag(pointer: int, position: Vector2, relative: Vector2) -> void:
	touch_positions[pointer] = position
	if pointer == move_pointer:
		_update_move(position)
	elif pointer == fire_pointer or pointer == look_pointer or pointer == aim_pointer:
		look_delta += relative
		look_dragged.emit(relative)
	elif not _in_any_button(position):
		look_delta += relative
		look_dragged.emit(relative)

func _update_move(position: Vector2) -> void:
	var center := _move_center()
	move_vector = ((position - center) / 72.0).limit_length(1.0)

func _move_center() -> Vector2:
	var normalized: Vector2 = _normalized_position("joystick", Vector2(0.12, 0.76))
	return Vector2(size.x * normalized.x, size.y * normalized.y)

func _normalized_position(id: String, fallback: Vector2) -> Vector2:
	if layout.has(id) and layout[id] is Dictionary and layout[id].has("position"):
		var saved: Array = layout[id]["position"]
		if saved.size() == 2:
			return Vector2(float(saved[0]), float(saved[1]))
	return fallback

func _control_scale(id: String) -> float:
	return clampf(float(layout.get(id, {}).get("scale", 1.0)), 0.7, 1.45)

func _control_opacity(id: String) -> float:
	return clampf(float(layout.get(id, {}).get("opacity", 1.0)), 0.25, 1.0)

func _button_center(id: String) -> Vector2:
	var defaults: Dictionary = {
		"fire": Vector2(0.87, 0.72), "aim": Vector2(0.75, 0.75), "jump": Vector2(0.91, 0.48),
		"reload": Vector2(0.73, 0.46), "switch": Vector2(0.62, 0.86), "crouch": Vector2(0.8, 0.9), "sprint": Vector2(0.23, 0.89)
	}
	var value: Vector2 = _normalized_position(id, defaults.get(id, Vector2(0.5, 0.5)))
	return Vector2(size.x * value.x, size.y * value.y)

func _in_move(position: Vector2) -> bool:
	return position.distance_to(_move_center()) < 96.0 * _control_scale("joystick")

func _in_fire(position: Vector2) -> bool:
	return position.distance_to(_button_center("fire")) < 58.0 * _control_scale("fire")

func _in_aim(position: Vector2) -> bool:
	return position.distance_to(_button_center("aim")) < 48.0 * _control_scale("aim")

func _in_jump(position: Vector2) -> bool:
	return position.distance_to(_button_center("jump")) < 42.0 * _control_scale("jump")

func _in_reload(position: Vector2) -> bool:
	return position.distance_to(_button_center("reload")) < 38.0 * _control_scale("reload")

func _in_switch(position: Vector2) -> bool:
	return position.distance_to(_button_center("switch")) < 42.0 * _control_scale("switch")

func _in_crouch(position: Vector2) -> bool:
	return position.distance_to(_button_center("crouch")) < 42.0 * _control_scale("crouch")

func _in_sprint(position: Vector2) -> bool:
	return position.distance_to(_button_center("sprint")) < 42.0 * _control_scale("sprint")

func _in_any_button(position: Vector2) -> bool:
	for id: String in ["fire", "aim", "jump", "reload", "switch", "crouch", "sprint"]:
		if position.distance_to(_button_center(id)) < 62.0 * _control_scale(id):
			return true
	return false

func _is_hud_action(position: Vector2) -> bool:
	# Match both top-right HUD actions with a little safe-area tolerance.
	return position.y <= 104.0 and position.x >= size.x - 250.0

func _dispatch_hud_action(position: Vector2) -> void:
	var hud := get_parent().get_parent() if get_parent() != null else null
	if hud == null:
		return
	var normalized_x := position.x / maxf(size.x, 1.0)
	if normalized_x < 0.94 and hud.has_method("toggle_control_editor"):
		hud.toggle_control_editor()
	elif hud.has_signal("arsenal_requested"):
		hud.arsenal_requested.emit()

func _draw() -> void:
	if not mobile_qa and not DisplayServer.is_touchscreen_available():
		return
	var settings := _settings()
	var alpha: float = float(settings.get_value("mobile_opacity", 0.68)) if settings != null else 0.68
	var soft := Color(0.05, 0.1, 0.18, alpha * 0.62 * _control_opacity("joystick"))
	var bright := Color(0.55, 0.78, 1.0, alpha)
	var joystick_scale := _control_scale("joystick")
	draw_circle(_move_center(), 72.0 * joystick_scale, soft)
	draw_arc(_move_center(), 72.0 * joystick_scale, 0, TAU, 32, bright, 2.0)
	draw_circle(_move_center() + move_vector * 40.0 * joystick_scale, 29.0 * joystick_scale, Color(0.34, 0.66, 0.92, alpha * _control_opacity("joystick")))
	for id: String in ["fire", "aim", "jump", "reload", "switch", "crouch", "sprint"]:
		var center := _button_center(id)
		var radius: float = (55.0 if id == "fire" else 40.0) * _control_scale(id)
		var control_alpha := alpha * _control_opacity(id)
		var pressed := (id == "fire" and firing) or (id == "aim" and aiming) or (id == "sprint" and sprinting)
		var color := Color(1.0, 0.42, 0.16, control_alpha) if id == "fire" else Color(0.15, 0.28, 0.48, control_alpha)
		if id == "aim":
			color = Color(0.12, 0.62, 0.84, control_alpha)
		if pressed:
			color = color.lightened(0.28)
		draw_circle(center, radius, color)
		draw_arc(center, radius, 0, TAU, 24, Color(bright.r, bright.g, bright.b, control_alpha), 2.0)
		_draw_icon(id, center, radius, Color(1, 1, 1, minf(1.0, control_alpha + 0.12)))
		if edit_mode:
			var context_name: String = str({"fire": "FUEGO", "aim": "MIRA", "jump": "SALTO", "reload": "RECARGAR", "switch": "CAMBIAR", "crouch": "AGACHAR", "sprint": "CORRER"}.get(id, id.to_upper()))
			draw_string(ThemeDB.fallback_font, center + Vector2(-radius, radius + 18), context_name, HORIZONTAL_ALIGNMENT_CENTER, radius * 2.0, 11, Color.WHITE)
	if edit_mode:
		draw_rect(Rect2(Vector2.ZERO, size), Color(0.4, 0.7, 1.0, 0.08), false, 2.0)

func _draw_icon(id: String, center: Vector2, radius: float, color: Color) -> void:
	var r := radius * 0.42
	match id:
		"fire":
			draw_circle(center, r * 0.28, color, false, ICON_STROKE)
			for direction: Vector2 in [Vector2.UP, Vector2.RIGHT, Vector2.DOWN, Vector2.LEFT]:
				draw_line(center + direction * r * 0.45, center + direction * r, color, ICON_STROKE, true)
		"aim":
			var eye := PackedVector2Array([center + Vector2(-r, 0), center + Vector2(-r * 0.52, -r * 0.52), center, center + Vector2(r * 0.52, -r * 0.52), center + Vector2(r, 0), center + Vector2(r * 0.52, r * 0.52), center, center + Vector2(-r * 0.52, r * 0.52), center + Vector2(-r, 0)])
			draw_polyline(eye, color, ICON_STROKE, true)
			draw_circle(center, r * 0.22, color, false, ICON_STROKE)
		"jump":
			draw_line(center + Vector2(-r * 0.72, r * 0.42), center, color, ICON_STROKE, true)
			draw_line(center, center + Vector2(r * 0.72, r * 0.42), color, ICON_STROKE, true)
			draw_line(center + Vector2(-r * 0.72, r * 0.72), center + Vector2(r * 0.72, r * 0.72), color, ICON_STROKE, true)
		"reload":
			draw_arc(center, r * 0.72, deg_to_rad(35), deg_to_rad(320), 20, color, ICON_STROKE, true)
			draw_colored_polygon(PackedVector2Array([center + Vector2(r * 0.62, -r * 0.76), center + Vector2(r * 0.92, -r * 0.58), center + Vector2(r * 0.56, -r * 0.38)]), color)
		"switch":
			draw_line(center + Vector2(-r * 0.78, -r * 0.3), center + Vector2(r * 0.65, -r * 0.3), color, ICON_STROKE, true)
			draw_line(center + Vector2(r * 0.65, -r * 0.3), center + Vector2(r * 0.28, -r * 0.62), color, ICON_STROKE, true)
			draw_line(center + Vector2(r * 0.65, -r * 0.3), center + Vector2(r * 0.28, 0.02 * r), color, ICON_STROKE, true)
			draw_line(center + Vector2(r * 0.78, r * 0.3), center + Vector2(-r * 0.65, r * 0.3), color, ICON_STROKE, true)
			draw_line(center + Vector2(-r * 0.65, r * 0.3), center + Vector2(-r * 0.28, -0.02 * r), color, ICON_STROKE, true)
		"crouch":
			draw_circle(center + Vector2(0, -r * 0.55), r * 0.22, color)
			draw_line(center + Vector2(0, -r * 0.28), center + Vector2(0, r * 0.45), color, ICON_STROKE, true)
			draw_line(center + Vector2(0, r * 0.05), center + Vector2(r * 0.66, r * 0.38), color, ICON_STROKE, true)
			draw_line(center + Vector2(0, r * 0.45), center + Vector2(r * 0.72, r * 0.72), color, ICON_STROKE, true)
			draw_line(center + Vector2(-r * 0.35, r * 0.72), center + Vector2(r * 0.78, r * 0.72), color, ICON_STROKE, true)
		"sprint":
			draw_line(center + Vector2(-r * 0.75, -r * 0.45), center + Vector2(r * 0.08, -r * 0.45), color, ICON_STROKE, true)
			draw_line(center + Vector2(-r * 0.9, 0), center + Vector2(-r * 0.08, 0), color, ICON_STROKE, true)
			draw_line(center + Vector2(-r * 0.75, r * 0.45), center + Vector2(r * 0.08, r * 0.45), color, ICON_STROKE, true)
			draw_line(center + Vector2(r * 0.06, r * 0.18), center + Vector2(r * 0.78, r * 0.18), color, ICON_STROKE, true)
			draw_line(center + Vector2(r * 0.78, r * 0.18), center + Vector2(r * 0.5, -r * 0.12), color, ICON_STROKE, true)
			draw_line(center + Vector2(r * 0.78, r * 0.18), center + Vector2(r * 0.5, r * 0.48), color, ICON_STROKE, true)

func _settings() -> Node:
	if not is_inside_tree():
		return null
	return get_node_or_null("/root/SettingsStore")
