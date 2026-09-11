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
var sprint_pointer: int = -1
## Dedos capturados por acciones de un toque. Sin esta propiedad, al arrastrar
## SALTO/RECARGAR/CAMBIAR/AGACHARSE/CORRER fuera de su círculo el mismo dedo
## caía al fallback de cámara y producía un tirón de mira.
var action_pointers: Dictionary = {}
var touch_positions: Dictionary = {}
var layout: Dictionary = {}

func configure(is_mobile_qa: bool) -> void:
	mobile_qa = is_mobile_qa
	var settings := _settings()
	layout = settings.get_control_layout() if settings != null else {}
	queue_redraw()

func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	# HUD buttons own their own input. Gameplay touch is collected only from
	# unhandled events, so no viewport-width coordinate hack can steal a tap.
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	var settings := _settings()
	layout = settings.get_control_layout() if settings != null else {}
	queue_redraw()

func _notification(what: int) -> void:
	if what == NOTIFICATION_APPLICATION_FOCUS_OUT \
			or what == NOTIFICATION_APPLICATION_PAUSED \
			or what == NOTIFICATION_WM_WINDOW_FOCUS_OUT:
		release_all()

func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventScreenTouch:
		_handle_touch(event.index, event.position, event.pressed)
		get_viewport().set_input_as_handled()
	elif event is InputEventScreenDrag:
		_handle_drag(event.index, event.position, event.relative)
		get_viewport().set_input_as_handled()
	elif mobile_qa and not DisplayServer.is_touchscreen_available() \
			and event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_LEFT:
		# Mapeo mouse→touch SOLO para QA de escritorio. Con pantalla táctil el
		# SO ya entrega InputEventScreenTouch y la emulación mouse-from-touch
		# duplicaría cada tap (MIRA alternaría dos veces y el latch no engancha).
		_handle_touch(0, event.position, event.pressed)
		get_viewport().set_input_as_handled()
	elif mobile_qa and not DisplayServer.is_touchscreen_available() \
			and event is InputEventMouseMotion and touch_positions.has(0):
		_handle_drag(0, event.position, event.relative)
		get_viewport().set_input_as_handled()

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
	# Auto-carrera: con el joystick empujado al tope el personaje corre sin
	# exigir un segundo dedo en CORRER. El botón sigue siendo un latch
	# independiente para medias inclinaciones.
	if move_vector.length() >= 0.92:
		return true
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

## Radio que debe caber dentro del safe area al editar. Es la misma autoridad
## geométrica que usa el hit-test; evita que un control grande quede medio fuera
## de pantalla aunque su centro sí esté dentro.
func get_control_safe_radius(control_id: String) -> float:
	if control_id == "joystick":
		return 66.0 * _control_scale(control_id)
	return _button_hit_radius(control_id) * _control_scale(control_id)

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
	queue_redraw()

func qa_release_fire() -> void:
	firing = false
	fire_stopped.emit()
	queue_redraw()

func qa_press_jump() -> void:
	jump_request = true
	jump_requested.emit()

func qa_tap_aim() -> void:
	aiming = not aiming
	queue_redraw()

func qa_press_aim() -> void:
	qa_tap_aim()

func qa_press_reload() -> void:
	reload_request = true
	queue_redraw()

func qa_release_aim() -> void:
	# ADS is tap-to-latch. Releasing the finger must not clear it.
	pass

func qa_set_move(value: Vector2) -> void:
	move_vector = value.limit_length(1.0)
	queue_redraw()

func qa_drag_look(delta: Vector2) -> void:
	look_delta += delta

func release_all() -> void:
	var was_firing := firing
	move_pointer = -1
	look_pointer = -1
	fire_pointer = -1
	aim_pointer = -1
	sprint_pointer = -1
	action_pointers.clear()
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
			action_pointers[pointer] = true
			jump_request = true
			jump_requested.emit()
		elif _in_reload(position):
			action_pointers[pointer] = true
			reload_request = true
		elif _in_switch(position):
			action_pointers[pointer] = true
			switch_request = true
		elif _in_crouch(position):
			action_pointers[pointer] = true
			crouch_request = true
		elif _in_sprint(position):
			action_pointers[pointer] = true
			sprint_pointer = pointer
			# CORRER is a tap-to-toggle action. A quick mobile tap must persist
			# through the next movement sample instead of requiring a long hold.
			sprinting = not sprinting
		elif _in_move(position):
			move_pointer = pointer
			_update_move(position)
		else:
			look_pointer = pointer
	else:
		touch_positions.erase(pointer)
		action_pointers.erase(pointer)
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
		if pointer == sprint_pointer:
			sprint_pointer = -1
			# Keep the toggle latched after finger-up; release_all() clears it on
			# pause/focus loss and at the next match reset.
	queue_redraw()

func _handle_drag(pointer: int, position: Vector2, relative: Vector2) -> void:
	touch_positions[pointer] = position
	if pointer == move_pointer:
		_update_move(position)
	elif pointer == fire_pointer or pointer == look_pointer or pointer == aim_pointer:
		look_delta += relative
		look_dragged.emit(relative)
	elif action_pointers.has(pointer):
		# Un botón de acción conserva la propiedad del dedo hasta finger-up,
		# incluso si el dedo sale visualmente del círculo.
		pass
	elif not _in_any_button(position):
		look_delta += relative
		look_dragged.emit(relative)
	queue_redraw()

func _update_move(position: Vector2) -> void:
	var center := _move_center()
	move_vector = ((position - center) / 72.0).limit_length(1.0)
	queue_redraw()

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
		"reload": Vector2(0.73, 0.46), "switch": Vector2(0.62, 0.86), "crouch": Vector2(0.8, 0.9), "sprint": Vector2(0.23, 0.58)
	}
	var value: Vector2 = _normalized_position(id, defaults.get(id, Vector2(0.5, 0.5)))
	return Vector2(size.x * value.x, size.y * value.y)

func _button_hit_radius(id: String) -> float:
	match id:
		"fire": return 58.0
		"aim": return 48.0
		"jump": return 42.0
		"reload": return 38.0
		"switch", "crouch": return 42.0
		"sprint": return 68.0
	return 0.0

func _in_move(position: Vector2) -> bool:
	# Use both the radial hit test and a broad lower-left lane. Android safe-area
	# transforms can move the rendered joystick by a few dozen pixels; movement
	# must not silently fall through to camera look when the thumb lands there.
	# Los botones SIEMPRE ganan sobre la lane: CORRER vive dentro de ella y con
	# el pulgar viniendo del joystick el puntero quedaba pegado al movimiento.
	if _in_any_button(position):
		return false
	return position.distance_to(_move_center()) < 140.0 * _control_scale("joystick") \
		or (position.x < size.x * 0.34 and position.y > size.y * 0.55)

func _in_fire(position: Vector2) -> bool:
	return position.distance_to(_button_center("fire")) < _button_hit_radius("fire") * _control_scale("fire")

func _in_aim(position: Vector2) -> bool:
	return position.distance_to(_button_center("aim")) < _button_hit_radius("aim") * _control_scale("aim")

func _in_jump(position: Vector2) -> bool:
	return position.distance_to(_button_center("jump")) < _button_hit_radius("jump") * _control_scale("jump")

func _in_reload(position: Vector2) -> bool:
	return position.distance_to(_button_center("reload")) < _button_hit_radius("reload") * _control_scale("reload")

func _in_switch(position: Vector2) -> bool:
	return position.distance_to(_button_center("switch")) < _button_hit_radius("switch") * _control_scale("switch")

func _in_crouch(position: Vector2) -> bool:
	return position.distance_to(_button_center("crouch")) < _button_hit_radius("crouch") * _control_scale("crouch")

func _in_sprint(position: Vector2) -> bool:
	return position.distance_to(_button_center("sprint")) < _button_hit_radius("sprint") * _control_scale("sprint")

func _in_any_button(position: Vector2) -> bool:
	for id: String in ["fire", "aim", "jump", "reload", "switch", "crouch", "sprint"]:
		if position.distance_to(_button_center(id)) < _button_hit_radius(id) * _control_scale(id):
			return true
	return false

func _draw() -> void:
	if not mobile_qa and not DisplayServer.is_touchscreen_available():
		return
	var settings := _settings()
	var alpha: float = float(settings.get_value("mobile_opacity", 0.58)) if settings != null else 0.58
	var soft := Color(0.04, 0.08, 0.15, alpha * 0.56 * _control_opacity("joystick"))
	var bright := Color(0.55, 0.78, 1.0, alpha * 0.9)
	var joystick_scale := _control_scale("joystick")
	var joystick_center := _move_center()
	var joystick_radius := 66.0 * joystick_scale
	draw_circle(joystick_center + Vector2(0.0, 4.0), joystick_radius, Color(0.0, 0.02, 0.06, alpha * 0.24))
	draw_circle(joystick_center, joystick_radius, soft)
	draw_arc(joystick_center, joystick_radius, 0, TAU, 36, bright, 2.0)
	draw_circle(joystick_center + move_vector * 36.0 * joystick_scale, 25.0 * joystick_scale, Color(0.34, 0.66, 0.92, alpha * 0.88 * _control_opacity("joystick")))
	draw_arc(joystick_center + move_vector * 36.0 * joystick_scale, 25.0 * joystick_scale, 0, TAU, 24, Color(0.75, 0.91, 1.0, alpha * 0.75), 1.5)
	for id: String in ["fire", "aim", "jump", "reload", "switch", "crouch", "sprint"]:
		var center := _button_center(id)
		var radius: float = (51.0 if id == "fire" else 37.0) * _control_scale(id)
		var control_alpha := alpha * _control_opacity(id)
		var pressed := (id == "fire" and firing) or (id == "aim" and aiming) or (id == "sprint" and sprinting)
		var color := Color(1.0, 0.42, 0.16, control_alpha) if id == "fire" else Color(0.15, 0.28, 0.48, control_alpha)
		if id == "aim":
			color = Color(0.12, 0.62, 0.84, control_alpha)
		if pressed:
			color = color.lightened(0.28)
		draw_circle(center + Vector2(0.0, 3.0), radius, Color(0.0, 0.02, 0.06, control_alpha * 0.24))
		draw_circle(center, radius, color)
		draw_arc(center, radius, 0, TAU, 24, Color(bright.r, bright.g, bright.b, control_alpha), 2.0)
		if pressed:
			draw_arc(center, radius - 5.0, 0, TAU, 24, Color(1.0, 1.0, 1.0, control_alpha * 0.62), 2.0)
		_draw_icon(id, center, radius, Color(1, 1, 1, minf(1.0, control_alpha + 0.12)))
		# CORRER lleva rótulo permanente fuera del editor (dentro ya muestra el
		# suyo y se duplicaría).
		if id == "sprint" and not edit_mode:
			draw_string(ThemeDB.fallback_font, center + Vector2(-radius, radius + 6), "CORRER", HORIZONTAL_ALIGNMENT_CENTER, radius * 2.0, 10, Color(1, 1, 1, minf(1.0, control_alpha + 0.2)))
		if edit_mode:
			var context_name: String = str({"fire": "FUEGO", "aim": "MIRA", "jump": "SALTO", "reload": "RECARGAR", "switch": "CAMBIAR ARMA", "crouch": "AGACHARSE", "sprint": "CORRER"}.get(id, id.to_upper()))
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
			draw_circle(center, r * 0.58, color, false, ICON_STROKE)
			draw_circle(center, r * 0.12, color)
			draw_line(center + Vector2(-r, 0), center + Vector2(-r * 0.64, 0), color, ICON_STROKE, true)
			draw_line(center + Vector2(r * 0.64, 0), center + Vector2(r, 0), color, ICON_STROKE, true)
			draw_line(center + Vector2(0, -r), center + Vector2(0, -r * 0.64), color, ICON_STROKE, true)
			draw_line(center + Vector2(0, r * 0.64), center + Vector2(0, r), color, ICON_STROKE, true)
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
			# Corredor inequívoco: cabeza + tronco + brazos/piernas en zancada
			# + líneas de velocidad. Nada de flechas abstractas.
			draw_circle(center + Vector2(r * 0.28, -r * 0.58), r * 0.17, color)
			var hip := center + Vector2(-r * 0.05, r * 0.15)
			var shoulder := center + Vector2(r * 0.12, -r * 0.30)
			draw_line(shoulder, hip, color, ICON_STROKE, true)
			draw_line(hip, center + Vector2(r * 0.42, r * 0.32), color, ICON_STROKE, true)
			draw_line(center + Vector2(r * 0.42, r * 0.32), center + Vector2(r * 0.36, r * 0.68), color, ICON_STROKE, true)
			draw_line(hip, center + Vector2(-r * 0.48, r * 0.42), color, ICON_STROKE, true)
			draw_line(center + Vector2(-r * 0.48, r * 0.42), center + Vector2(-r * 0.30, r * 0.68), color, ICON_STROKE, true)
			draw_line(shoulder, center + Vector2(r * 0.50, -r * 0.02), color, ICON_STROKE, true)
			draw_line(center + Vector2(r * 0.50, -r * 0.02), center + Vector2(r * 0.24, r * 0.18), color, ICON_STROKE, true)
			draw_line(shoulder, center + Vector2(-r * 0.32, -r * 0.08), color, ICON_STROKE, true)
			draw_line(center + Vector2(-r * 0.95, -r * 0.28), center + Vector2(-r * 0.45, -r * 0.28), color, ICON_STROKE - 1.0, true)
			draw_line(center + Vector2(-r * 0.95, r * 0.02), center + Vector2(-r * 0.52, r * 0.02), color, ICON_STROKE - 1.0, true)

func _settings() -> Node:
	if not is_inside_tree():
		return null
	return get_node_or_null("/root/SettingsStore")
