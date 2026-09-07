class_name BlockfireInputSetup
extends RefCounted

static func ensure_actions() -> void:
	var keys: Dictionary = {
		"move_left": KEY_A,
		"move_right": KEY_D,
		"move_forward": KEY_W,
		"move_back": KEY_S,
		"jump": KEY_SPACE,
		"crouch": KEY_C,
		"sprint": KEY_SHIFT,
		"reload": KEY_R,
		"switch_weapon": KEY_1,
		"previous_weapon": KEY_Q,
		"next_weapon": KEY_E,
		"pause": KEY_ESCAPE
	}
	for action: String in keys:
		_ensure_key(action, int(keys[action]))
	_ensure_mouse("fire", MOUSE_BUTTON_LEFT)
	_ensure_mouse("aim", MOUSE_BUTTON_RIGHT)

static func _ensure_key(action: String, keycode: Key) -> void:
	if not InputMap.has_action(action):
		InputMap.add_action(action)
	for existing: InputEvent in InputMap.action_get_events(action):
		if existing is InputEventKey and existing.physical_keycode == keycode:
			return
	var event := InputEventKey.new()
	event.physical_keycode = keycode
	InputMap.action_add_event(action, event)

static func _ensure_mouse(action: String, button: MouseButton) -> void:
	if not InputMap.has_action(action):
		InputMap.add_action(action)
	for existing: InputEvent in InputMap.action_get_events(action):
		if existing is InputEventMouseButton and existing.button_index == button:
			return
	var event := InputEventMouseButton.new()
	event.button_index = button
	InputMap.action_add_event(action, event)
