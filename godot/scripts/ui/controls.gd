# BLOCKFIRE — Controles táctiles (parity: Input.js) — Android primera clase.
# Ownership por touch index: cada dedo posee UNA función; nada se pega.
# Joystick izq (curva expo 1.45, a tope = sprint) · cámara derecha · FUEGO con drag-to-aim.
# Los botones usan la emulación nativa touch→mouse de Godot.
class_name TouchControls
extends CanvasLayer

const STICK_RADIUS := 100.0
const STICK_CENTER := Vector2(150, 0)  # y se calcula con el viewport

var look_delta := Vector2.ZERO

var _stick_idx := -1
var _stick_origin := Vector2.ZERO
var _look_idx := -1
var _fire_held := false
var _aim_toggled := false
var _sprint := false
var _crouch := false
var _jump_edge := false
var _reload_edge := false
var _weapon_edge := false
var _move := Vector2.ZERO
var _fire_drag := false
var _fire_last := Vector2.ZERO

var _knob: Control
var _base: Control

func _ready() -> void:
	layer = 5
	_build_ui()
	print("[TOUCH-DBG] capa táctil construida")

func _stick_center() -> Vector2:
	return Vector2(150, get_viewport().get_visible_rect().size.y - 150)

func _build_ui() -> void:
	var root := Control.new()
	root.set_anchors_preset(Control.PRESET_FULL_RECT)
	root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(root)

	# base + knob del joystick
	_base = Control.new()
	_base.custom_minimum_size = Vector2(220, 220)
	_base.anchor_top = 1.0; _base.anchor_bottom = 1.0
	_base.offset_left = 40; _base.offset_right = 260
	_base.offset_top = -280; _base.offset_bottom = -60
	_base.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_base.draw.connect(func():
		_base.draw_circle(Vector2(110, 110), 110, Color(0.05, 0.06, 0.09, 0.30))
		_base.draw_circle(Vector2(110, 110), 96, Color(0.05, 0.06, 0.09, 0.18))
		_base.draw_arc(Vector2(110, 110), 103, 0, TAU, 48, Color(1, 1, 1, 0.5), 3.0))
	root.add_child(_base)
	_knob = Control.new()
	_knob.custom_minimum_size = Vector2(84, 84)
	_knob.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_knob.position = Vector2(68, 68)  # hijo de la base: centro exacto
	_knob.draw.connect(func():
		_knob.draw_circle(Vector2(42, 42), 40, Color(0.92, 0.94, 0.98, 0.75))
		_knob.draw_arc(Vector2(42, 42), 40, 0, TAU, 40, Color(0.08, 0.09, 0.12, 0.9), 4.0))
	_base.add_child(_knob)

	# FUEGO — grande, rojo, con drag-to-aim
	var fire := _button("FUEGO", 160, Color(1.0, 0.35, 0.3, 0.85))
	_anchor_br(fire, Vector2(-220, -200), 160)
	fire.gui_input.connect(_fire_input)
	root.add_child(fire)

	# resto de acciones (tap)
	var defs := [
		["MIRA", Vector2(-440, -170), 92, Color(0.35, 0.8, 0.5, 0.55), func(): _aim_toggled = not _aim_toggled],
		["SALTO", Vector2(-130, -400), 88, Color(1, 1, 1, 0.45), func(): _jump_edge = true],
		["RECARGA", Vector2(-300, -330), 80, Color(1, 1, 1, 0.45), func(): _reload_edge = true],
		["CORRER", Vector2(-160, -560), 82, Color(1, 1, 1, 0.45), func(): _sprint = not _sprint],
		["AGACHARSE", Vector2(-470, -300), 82, Color(1, 1, 1, 0.45), func(): _crouch = not _crouch],
		["ARMA", Vector2(-560, -420), 82, Color(1, 1, 1, 0.45), func(): _weapon_edge = true],
	]
	for d in defs:
		var b := _button(d[0], d[2], d[3])
		_anchor_br(b, d[1], d[2])
		b.pressed.connect(d[4])
		b.gui_input.connect(func(ev):
			if ev is InputEventScreenTouch or ev is InputEventMouseButton:
				get_viewport().set_input_as_handled())  # tap en botón ≠ mirar
		root.add_child(b)

func _anchor_br(b: Control, offset: Vector2, diameter: float) -> void:
	b.anchor_left = 1; b.anchor_right = 1; b.anchor_top = 1; b.anchor_bottom = 1
	b.offset_left = offset.x; b.offset_right = offset.x + diameter
	b.offset_top = offset.y; b.offset_bottom = offset.y + diameter

func _button(text: String, diameter: float, color: Color) -> Button:
	var b := Button.new()
	b.text = text
	b.add_theme_font_size_override("font_size", int(diameter * 0.16))
	b.add_theme_color_override("font_color", Color.WHITE)
	b.add_theme_color_override("font_shadow_color", Color(0, 0, 0, 0.5))
	b.add_theme_constant_override("shadow_offset_x", 1)
	b.add_theme_constant_override("shadow_offset_y", 1)
	var sb := StyleBoxFlat.new()
	sb.bg_color = color
	sb.set_corner_radius_all(int(diameter) / 2)
	b.add_theme_stylebox_override("normal", sb)
	var sbp := sb.duplicate()
	sbp.bg_color = color.lightened(0.25)
	b.add_theme_stylebox_override("pressed", sbp)
	var sbh := sb.duplicate()
	sbh.bg_color = color
	b.add_theme_stylebox_override("hover", sbh)
	return b

func _fire_input(ev: InputEvent) -> void:
	if _dbg < 40 and (ev is InputEventScreenTouch or ev is InputEventMouseButton):
		_dbg += 1
		print("[TOUCH-DBG] FUEGO recibe: ", ev.get_class(), " pressed=", ev.pressed)
	if ev is InputEventScreenTouch or ev is InputEventScreenDrag or ev is InputEventMouseButton or ev is InputEventMouseMotion:
		get_viewport().set_input_as_handled()  # FUEGO posee su dedo: nunca activa la zona de mirar
	if ev is InputEventScreenTouch:
		_fire_held = ev.pressed
		_fire_drag = ev.pressed
		_fire_last = ev.position
	elif ev is InputEventScreenDrag and _fire_drag:
		look_delta += ev.relative
		_fire_last = ev.position
	elif ev is InputEventMouseButton:
		_fire_held = ev.pressed and ev.button_index == MOUSE_BUTTON_LEFT
		_fire_drag = _fire_held
		_fire_last = ev.position
	elif ev is InputEventMouseMotion and _fire_drag:
		look_delta += ev.relative

var _dbg := 0
func _unhandled_input(event: InputEvent) -> void:
	if _dbg < 30 and (event is InputEventScreenTouch or event is InputEventScreenDrag):
		_dbg += 1
		print("[TOUCH-DBG] unhandled: ", event.get_class(), " pressed=", event.pressed if event is InputEventScreenTouch else "-", " pos=", event.position)
	if event is InputEventScreenTouch:
		var st := event as InputEventScreenTouch
		var n := st.position / get_viewport().get_visible_rect().size
		if event.pressed:
			if n.x < 0.42 and n.y > 0.4 and _stick_idx == -1:
				_stick_idx = event.index
				_stick_origin = event.position
				_stick_last = Time.get_ticks_msec()
			elif n.x >= 0.42 and _look_idx == -1 and _fire_held == false:
				_look_idx = event.index
				_look_last_ms = Time.get_ticks_msec()
		else:
			if event.index == _stick_idx:
				_stick_idx = -1
				_sprint = false
				_move = Vector2.ZERO
			elif event.index == _look_idx:
				_look_idx = -1
	elif event is InputEventScreenDrag:
		if event.index == _look_idx:
			look_delta += event.relative
			_look_last_ms = Time.get_ticks_msec()
		elif event.index == _stick_idx:
			_stick_last = Time.get_ticks_msec()
			var dr := event as InputEventScreenDrag
			var d := (dr.position - _stick_origin).limit_length(STICK_RADIUS)
			_knob.position = Vector2(68, 68) + d
			var mag := d.length() / STICK_RADIUS
			if mag > 0.001:
				_move = d.normalized() * pow(mag, 1.45)
			else:
				_move = Vector2.ZERO
			_sprint = mag > 0.95

var _stick_last := 0
var _look_last_ms := 0

# releases en _input: SIEMPRE se ven aunque un botón consuma el evento
# (el timeout de 350ms rompía el sprint sostenido — auditoría B3)
func _input(event: InputEvent) -> void:
	if event is InputEventScreenTouch and not event.pressed:
		if event.index == _stick_idx:
			_stick_idx = -1
			_move = Vector2.ZERO
			_sprint = false
			_knob.position = Vector2(68, 68)
		elif event.index == _look_idx:
			_look_idx = -1

func take_look_delta() -> Vector2:
	var d := look_delta
	look_delta = Vector2.ZERO
	return d

func move_vec() -> Vector2:
	return _move

func jump_pressed() -> bool:
	var v := _jump_edge
	_jump_edge = false
	return v

func sprint_held() -> bool: return _sprint
func crouch_toggled() -> bool: return _crouch
func aim_toggled() -> bool: return _aim_toggled
func fire_held() -> bool: return _fire_held

func reload_pressed() -> bool:
	var v := _reload_edge
	_reload_edge = false
	return v

func weapon_request() -> int:
	var v := _weapon_edge
	_weapon_edge = false
	return v if v else -1

func release_all() -> void:
	_stick_idx = -1
	_look_idx = -1
	_fire_held = false
	_fire_drag = false
	_move = Vector2.ZERO
	_sprint = false
