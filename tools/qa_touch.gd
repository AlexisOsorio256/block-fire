extends SceneTree
## Prueba del path táctil REAL (§42-45): inyecta InputEventScreenTouch/Drag por
## Input.parse_input_event y comprueba FUEGO (mantenido y arrastrable), que el
## drag sobre FUEGO rota la cámara sin soltar el fuego, ADS tap-to-latch y
## multitouch joystick+FUEGO. No forma parte del runtime.
## USO: godot --path . --script res://tools/qa_touch.gd

var _app: Node
var _player: Node
var _controls: Node
var _fails: int = 0

func _init() -> void:
	await process_frame
	# QA de escritorio: sin emulación mouse-from-touch, cada ScreenTouch se
	# entrega una sola vez (en Android real la rama mouse queda inerte).
	Input.emulate_mouse_from_touch = false
	var scene: PackedScene = load("res://game/app.tscn")
	_app = scene.instantiate()
	root.add_child(_app)
	for i: int in range(10):
		await process_frame
	_app.set("mobile_qa", true)
	_app.set("qa_combat", true)
	_app.call("_start_match", "ffa", "BRAVO", "Estándar")
	for i: int in range(30):
		await process_frame
	_player = _app.current_screen.get_node_or_null("Player")
	_controls = _player.get("mobile_controls") if _player != null else null
	if _controls == null:
		_fail("mobile_controls no disponible")
		_finish()
		return
	var settings: Node = root.get_node_or_null("/root/SettingsStore")
	var weapon: Node = _player.get("weapon")
	# keepalive de laboratorio: los bots FFA matan al jugador inactivo.
	_player.set("health", _player.get("max_health"))
	await process_frame
	var fire_center: Vector2 = _controls.call("_button_center", "fire")
	var move_center: Vector2 = _controls.call("_move_center")
	var look_before: float = float(_player.get("look_yaw"))
	var ammo_before: int = int(weapon.get("ammo")[weapon.get("active_index")]) if weapon != null else -1

	# 1) TOUCH real sobre FUEGO → firing + fire_held.
	_inject_touch(0, fire_center, true)
	for i: int in range(3):
		await process_frame
	_check("FUEGO touch activa firing", _controls.is_firing())
	if weapon != null:
		_check("FUEGO touch activa fire_held del arma", bool(weapon.get("fire_held")))
	_check("fire_pointer asignado", int(_controls.get("fire_pointer")) == 0)
	await _frames(10)
	var ammo_after_fire: int = int(weapon.get("ammo")[weapon.get("active_index")]) if weapon != null else ammo_before
	_check("el arma consume munición mientras FUEGO", ammo_after_fire < ammo_before)
	_player.set("health", _player.get("max_health"))

	# 2) DRAG real sobre el mismo pointer (dedo abajo) → look gira, firing sigue.
	for i: int in range(8):
		_inject_drag(0, fire_center + Vector2(60.0 * (i + 1), 0.0), Vector2(60.0, 0.0))
		await process_frame
	var look_after_drag: float = float(_player.get("look_yaw"))
	_check("drag sobre FUEGO rota la cámara", absf(look_after_drag - look_before) > 1.0)
	_check("firing continúa durante el drag", _controls.is_firing())
	_player.set("health", _player.get("max_health"))

	# 3) Release → firing termina.
	_inject_touch(0, fire_center + Vector2(480.0, 0.0), false)
	for i: int in range(3):
		await process_frame
	_check("release termina firing", not _controls.is_firing())

	# 4) Multitouch: joystick (pointer 1) + FUEGO (pointer 2) simultáneos.
	_inject_touch(1, move_center, true)
	_inject_drag(1, move_center + Vector2(50.0, 0.0), Vector2(50.0, 0.0))
	_inject_touch(2, fire_center, true)
	for i: int in range(3):
		await process_frame
	_check("multitouch: FUEGO activo con joystick", _controls.is_firing())
	var move_len: float = (_controls.get_move_vector() as Vector2).length()
	_check("multitouch: joystick mueve mientras FUEGO", move_len > 0.1)
	_inject_touch(2, fire_center, false)
	_inject_touch(1, move_center, false)
	for i: int in range(3):
		await process_frame
	_check("multitouch release limpia estados", not _controls.is_firing() and (_controls.get_move_vector() as Vector2).length() < 0.01)

	# 5) ADS tap-to-latch (§34): tap ON, sigue ON; segundo tap OFF.
	var aim_center: Vector2 = _controls.call("_button_center", "aim")
	_inject_touch(0, aim_center, true)
	_inject_touch(0, aim_center, false)
	for i: int in range(2):
		await process_frame
	_check("ADS latch: tap activa", _controls.is_aiming())
	await _frames(5)
	_check("ADS latch: release mantiene ON", _controls.is_aiming())
	_inject_touch(0, aim_center, true)
	_inject_touch(0, aim_center, false)
	for i: int in range(2):
		await process_frame
	_check("ADS latch: segundo tap desactiva", not _controls.is_aiming())

	_finish()

func _inject_touch(pointer: int, position: Vector2, pressed: bool) -> void:
	var ev := InputEventScreenTouch.new()
	ev.index = pointer
	ev.position = _to_window(position)
	ev.pressed = pressed
	Input.parse_input_event(ev)

func _inject_drag(pointer: int, position: Vector2, relative: Vector2) -> void:
	var ev := InputEventScreenDrag.new()
	ev.index = pointer
	ev.position = _to_window(position)
	ev.relative = root.get_final_transform().basis_xform(relative)
	Input.parse_input_event(ev)

func _to_window(point: Vector2) -> Vector2:
	# _button_center()/_move_center() devuelven coordenadas de VIEWPORT (lógicas),
	# pero Input.parse_input_event entrega coordenadas de VENTANA. Con stretch
	# canvas_items/expand ambas difieren por el final transform de la raíz: en
	# --headless la ventana dummy es 64x64 y el factor es 1/20, así que sin esta
	# conversión cada tap caía fuera de la pantalla lógica y los 9 checks de
	# FUEGO/ADS fallaban siendo el producto correcto. Convertir aquí mantiene el
	# test independiente del tamaño de ventana.
	return root.get_final_transform() * point

func _frames(count: int) -> void:
	for i: int in range(count):
		await process_frame
	_player.set("health", _player.get("max_health"))

func _check(label: String, ok: bool) -> void:
	if not ok:
		_fails += 1
	print("[TOUCH-TEST] %s: %s" % ["PASS" if ok else "FAIL", label])

func _fail(label: String) -> void:
	_fails += 1
	print("[TOUCH-TEST] FAIL: ", label)

func _finish() -> void:
	print("[TOUCH-TEST] RESULTADO: %s (%d fallos)" % ["PASS" if _fails == 0 else "FAIL", _fails])
	quit(0 if _fails == 0 else 1)
