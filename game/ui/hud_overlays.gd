class_name HudOverlays
extends RefCounted

## Dueño único de los overlays interactivos del HUD: panel de AJUSTES y editor
## de controles, más la pausa que ambos imponen a la partida.
##
## Frontera de dueños: aquí no se decide qué se dibuja en el HUD de combate
## (eso es `hud.gd`) ni reglas de partida (eso es `match.gd`). Lo que sí posee
## este archivo es el estado de pausa —qué actores quedaron congelados y con qué
## `input_enabled` volver— que antes vivía mezclado con el marcador y la mira y
## era el punto más fácil de romper del HUD: si el snapshot se pierde, al cerrar
## el modal el jugador queda deshabilitado para siempre.
##
## El overlay no conoce el layout del HUD: pide ocultar/restaurar piezas por el
## diccionario `presenter` que le pasa `hud.gd` (`hide_for_overlay` /
## `restore_after_overlay`). Así el HUD puede cambiar de paneles sin tocar esto.

const ControlEditorScript := preload("res://game/ui/control_editor.gd")

## El HUD dueño. Se fija al construir el overlay (`HudOverlays.new(self)`), no en
## `setup()`: las suites y `match.gd` asignan `hud.match_context` sin llamar a
## `setup()`, y el contexto tiene que estar disponible igual.
var hud: BlockfireHud
var mobile_controls: BlockfireMobileControls
var root: Control


func _init(owner: BlockfireHud) -> void:
	hud = owner

var settings_panel: PanelContainer
var settings_backdrop: ColorRect
var control_editor
## El editor se abrió desde AJUSTES: al cerrarlo hay que volver a AJUSTES, no a
## la partida.
var return_to_settings := false
## Actores congelados mientras un overlay interactivo está abierto.
var frozen: Array[Node] = []
## `input_enabled` de cada actor antes de congelarlo, por instance_id.
var input_states: Dictionary = {}


func setup(hud_root: Control, controls: BlockfireMobileControls) -> void:
	root = hud_root
	mobile_controls = controls


## El contexto de partida vive en el HUD y lo asigna `match.gd` (y las suites)
## DESPUÉS de `setup()`, así que se lee en cada uso y nunca se copia.
func context() -> Node:
	return hud.match_context if hud != null else null


func toggle_control_editor() -> void:
	if is_instance_valid(control_editor):
		close_control_editor()
		return
	open_control_editor(false)


func toggle_settings() -> void:
	if is_instance_valid(control_editor):
		return
	if is_instance_valid(settings_panel):
		close_settings_panel()
		return
	open_settings_panel()


func open_control_editor(from_settings: bool) -> void:
	return_to_settings = from_settings
	freeze_for_overlay()
	control_editor = ControlEditorScript.new()
	control_editor.name = "ControlEditor"
	control_editor.setup(mobile_controls)
	control_editor.closed.connect(close_control_editor)
	root.add_child(control_editor)


## Congela la partida mientras un overlay está abierto: para la física de los
## combatientes, suelta el input táctil y guarda el estado previo para poder
## restaurarlo exacto.
func freeze_for_overlay() -> void:
	frozen.clear()
	input_states.clear()
	if context() != null and context().has_method("set_local_overlay_paused"):
		context().set_local_overlay_paused(true)
	# Guarda el input antes de _stop_combat_inputs(), que lo limpia para evitar
	# que al cerrar el modal quede el jugador permanentemente deshabilitado.
	if context() != null and context().has_method("get_combatants"):
		for actor: Node in context().get_combatants():
			if is_instance_valid(actor) and bool(actor.get("is_alive")):
				if actor.get("input_enabled") != null:
					input_states[actor.get_instance_id()] = bool(actor.get("input_enabled"))
	if context() != null and context().has_method("_stop_combat_inputs"):
		context()._stop_combat_inputs()
	if context() != null and context().has_method("get_combatants"):
		for actor: Node in context().get_combatants():
			if is_instance_valid(actor) and actor.has_method("get") and bool(actor.get("is_alive")):
				frozen.append(actor)
				actor.set_physics_process(false)
	if mobile_controls != null:
		mobile_controls.release_all()


func resume_from_overlay() -> void:
	for actor: Node in frozen:
		if is_instance_valid(actor):
			actor.set_physics_process(true)
			var saved_input: Variant = input_states.get(actor.get_instance_id(), null)
			if saved_input != null and actor.get("input_enabled") != null:
				actor.set("input_enabled", bool(saved_input))
	frozen.clear()
	input_states.clear()
	if context() != null and context().has_method("set_local_overlay_paused"):
		context().set_local_overlay_paused(false)
	if mobile_controls != null:
		mobile_controls.release_all()


func close_control_editor() -> void:
	if is_instance_valid(control_editor):
		control_editor.queue_free()
	control_editor = null
	if return_to_settings:
		return_to_settings = false
		open_settings_panel()
	else:
		resume_from_overlay()


func close_settings_panel() -> void:
	# `free()` y no `queue_free()`: el panel se crea y se destruye dentro de la
	# misma llamada, así que un cierre diferido dejaría vivo el anterior y el
	# siguiente `open` no haría nada (el guard `is_instance_valid` lo vería).
	if is_instance_valid(settings_backdrop):
		settings_backdrop.free()
	settings_backdrop = null
	if is_instance_valid(settings_panel):
		settings_panel.free()
	settings_panel = null
	# Los controles, la barra de vida y la mira se ocultan al abrir ajustes. Si
	# no se restauran aquí, al pulsar CONTINUAR el juego queda sin mandos
	# visibles ni mira aunque sigan capturando toques: bug reportado en
	# dispositivo.
	restore_presenter()


func open_settings_panel() -> void:
	if is_instance_valid(settings_panel):
		return
	hide_presenter()
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
		close_settings_panel()
		open_control_editor(true)
	)
	actions.add_child(edit)
	var close := Button.new()
	close.text = "CONTINUAR"
	close.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	BlockfireTheme.apply_button(close, BlockfireTheme.GOLD)
	close.pressed.connect(func() -> void:
		close_settings_panel()
		resume_from_overlay()
	)
	actions.add_child(close)


func _add_setting_slider(stack: VBoxContainer, label_text: String, key: String, minimum: float, maximum: float, fallback: float) -> void:
	var label := BlockfireTheme.label(label_text, 10, Color("#9db7db"))
	stack.add_child(label)
	var slider := HSlider.new()
	slider.min_value = minimum
	slider.max_value = maximum
	slider.step = 0.01
	# El store lo resuelve el HUD (`presenter["settings"]`): este archivo no
	# tiene por qué saber dónde vive el autoload.
	var settings := hud._settings() if hud != null else null
	slider.value = float(settings.get_value(key, fallback) if settings != null else fallback)
	slider.value_changed.connect(func(value: float) -> void:
		if settings != null:
			settings.set_value(key, value)
	)
	stack.add_child(slider)


## El overlay no conoce el layout del HUD: le pide que oculte o restaure sus
## piezas de juego mientras está abierto.
func hide_presenter() -> void:
	if hud != null:
		hud.hide_for_overlay()


func restore_presenter() -> void:
	if hud != null:
		hud.restore_after_overlay()
