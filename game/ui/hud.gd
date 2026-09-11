class_name BlockfireHud
extends CanvasLayer

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
## Overlays interactivos (AJUSTES + editor de controles) y la pausa que
## imponen. El estado de pausa vive ahí, no aquí: ver `hud_overlays.gd`.
var overlays := HudOverlays.new(self)
## Feedback de combate (sesión FX): hit marker, números de daño flotantes,
## kill feed, indicador de recarga/cargador bajo y viñeta de daño recibido.
var _hit_marker: Control
var _hit_marker_timer := 0.0
var _hit_marker_headshot := false
var _hit_marker_kill := false
var _damage_popups: Array[Label] = []
var _damage_popup_cursor := 0
var _kill_feed: VBoxContainer
var _kill_feed_entries: Array[Label] = []
var _kill_feed_cursor := 0
var _reload_label: Label
var _reload_bar: ProgressBar
var _damage_vignette: ColorRect
var _vignette_alpha := 0.0
var _low_ammo := false
var _hitstop_until_ms := 0
## Contador de FPS para medición en dispositivo. Nunca aparece por defecto: se
## activa con el argumento `--fps` (APK de QA) o con el ajuste `show_fps`.
var _fps_label: Label
var _fps_elapsed := 0.0
var _fps_min := 999.0
var _fps_max := 0.0

func setup(context: Node, use_mobile_qa: bool) -> void:
	match_context = context
	mobile_qa = use_mobile_qa
	_build()
	overlays.setup(root, mobile_controls)

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
	settings.offset_left = -182
	settings.offset_right = -104
	settings.offset_top = 14
	settings.offset_bottom = 56
	settings.z_index = 5
	settings.add_theme_font_size_override("font_size", 11)
	BlockfireTheme.apply_button(settings, Color("#80cfff"))
	settings.pressed.connect(func() -> void: settings_requested.emit())
	root.add_child(settings)

	var arsenal := Button.new()
	arsenal.text = "CAMBIAR"
	arsenal.tooltip_text = "Cambiar arma"
	arsenal.anchor_left = 1.0
	arsenal.anchor_right = 1.0
	arsenal.offset_left = -96
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

	# HUD periférico: vida a la izquierda (a la derecha del joystick), cargador
	# arriba a la derecha. El centro queda libre para mundo, punto de mira y
	# enemigo, que es lo que el jugador necesita leer mientras dispara.
	bottom_bar = HBoxContainer.new()
	bottom_bar.anchor_left = 0.0
	bottom_bar.anchor_top = 1.0
	bottom_bar.anchor_right = 0.0
	bottom_bar.anchor_bottom = 1.0
	bottom_bar.offset_left = 268
	bottom_bar.offset_right = 420
	bottom_bar.offset_top = -92
	bottom_bar.offset_bottom = -18
	bottom_bar.alignment = BoxContainer.ALIGNMENT_BEGIN
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
	ammo_panel.anchor_left = 1.0
	ammo_panel.anchor_right = 1.0
	ammo_panel.anchor_top = 0.0
	ammo_panel.anchor_bottom = 0.0
	ammo_panel.offset_left = -176
	ammo_panel.offset_right = -16
	ammo_panel.offset_top = 64
	ammo_panel.offset_bottom = 116
	ammo_panel.add_theme_stylebox_override("panel", BlockfireTheme.panel(Color("#071127d9"), Color("#49607e"), 10, 1))
	root.add_child(ammo_panel)
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

	_build_combat_feedback()
	if _fps_enabled():
		_fps_label = BlockfireTheme.label("FPS --", 12, Color("#8ff1c5"))
		_fps_label.anchor_left = 0.0
		_fps_label.anchor_top = 0.0
		_fps_label.offset_left = 12
		_fps_label.offset_top = 8
		_fps_label.offset_right = 260
		_fps_label.offset_bottom = 28
		_fps_label.add_theme_color_override("font_shadow_color", Color("#000000cc"))
		_fps_label.add_theme_constant_override("shadow_offset_x", 2)
		_fps_label.add_theme_constant_override("shadow_offset_y", 2)
		root.add_child(_fps_label)

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

## Construye el feedback de combate. Todo se crea una vez y se reutiliza: no se
## instancia ni un nodo durante el fuego.
func _build_combat_feedback() -> void:
	# Viñeta de daño recibido (por debajo del resto del HUD).
	_damage_vignette = ColorRect.new()
	_damage_vignette.name = "DamageVignette"
	_damage_vignette.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_damage_vignette.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_damage_vignette.color = Color(0.75, 0.05, 0.06, 0.0)
	_damage_vignette.z_index = -1
	root.add_child(_damage_vignette)

	# Indicador de recarga / cargador bajo, justo bajo el panel de munición.
	_reload_label = BlockfireTheme.label("", 12, Color("#ffd471"))
	_reload_label.anchor_left = 1.0
	_reload_label.anchor_right = 1.0
	_reload_label.anchor_top = 0.0
	_reload_label.anchor_bottom = 0.0
	_reload_label.offset_left = -176
	_reload_label.offset_right = -16
	_reload_label.offset_top = 120
	_reload_label.offset_bottom = 140
	_reload_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	_reload_label.add_theme_color_override("font_shadow_color", Color("#000000aa"))
	_reload_label.add_theme_constant_override("shadow_offset_x", 2)
	_reload_label.add_theme_constant_override("shadow_offset_y", 2)
	root.add_child(_reload_label)
	_reload_bar = ProgressBar.new()
	_reload_bar.anchor_left = 1.0
	_reload_bar.anchor_right = 1.0
	_reload_bar.anchor_top = 0.0
	_reload_bar.anchor_bottom = 0.0
	_reload_bar.offset_left = -176
	_reload_bar.offset_right = -16
	_reload_bar.offset_top = 142
	_reload_bar.offset_bottom = 148
	_reload_bar.min_value = 0.0
	_reload_bar.max_value = 100.0
	_reload_bar.value = 0.0
	_reload_bar.show_percentage = false
	_reload_bar.visible = false
	_reload_bar.add_theme_stylebox_override("background", BlockfireTheme.button_style(Color("#15233a"), Color("#2c4361"), 3))
	_reload_bar.add_theme_stylebox_override("fill", BlockfireTheme.button_style(Color("#ffd471"), Color("#ffe9a8"), 3))
	root.add_child(_reload_bar)

	# Kill feed: arriba a la derecha.
	_kill_feed = VBoxContainer.new()
	_kill_feed.anchor_left = 1.0
	_kill_feed.anchor_right = 1.0
	_kill_feed.anchor_top = 0.0
	_kill_feed.anchor_bottom = 0.0
	_kill_feed.offset_left = -330
	_kill_feed.offset_right = -16
	_kill_feed.offset_top = 158
	_kill_feed.offset_bottom = 262
	_kill_feed.alignment = BoxContainer.ALIGNMENT_BEGIN
	_kill_feed.add_theme_constant_override("separation", 2)
	root.add_child(_kill_feed)
	for _index: int in range(4):
		var entry := BlockfireTheme.label("", 12, Color.WHITE)
		entry.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
		entry.modulate = Color(1, 1, 1, 0)
		entry.add_theme_color_override("font_shadow_color", Color("#000000aa"))
		entry.add_theme_constant_override("shadow_offset_x", 2)
		entry.add_theme_constant_override("shadow_offset_y", 2)
		_kill_feed.add_child(entry)
		_kill_feed_entries.append(entry)

	# Números de daño flotantes (pool de 8, centro de pantalla).
	for _index: int in range(8):
		var popup := BlockfireTheme.label("", 19, Color("#ffe9c2"))
		popup.anchor_left = 0.5
		popup.anchor_right = 0.5
		popup.anchor_top = 0.5
		popup.anchor_bottom = 0.5
		popup.offset_left = -60
		popup.offset_right = 60
		popup.offset_top = -12
		popup.offset_bottom = 24
		popup.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		popup.add_theme_color_override("font_shadow_color", Color("#000000cc"))
		popup.add_theme_constant_override("shadow_offset_x", 2)
		popup.add_theme_constant_override("shadow_offset_y", 2)
		popup.modulate = Color(1, 1, 1, 0)
		root.add_child(popup)
		_damage_popups.append(popup)

	# Hit marker dibujado por encima del crosshair.
	_hit_marker = Control.new()
	_hit_marker.name = "HitMarker"
	_hit_marker.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_hit_marker.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_hit_marker.z_index = 2
	_hit_marker.draw.connect(_draw_hit_marker)
	root.add_child(_hit_marker)

	set_process(true)


func _process(delta: float) -> void:
	if _hit_marker_timer > 0.0:
		_hit_marker_timer = maxf(0.0, _hit_marker_timer - delta)
		if _hit_marker != null:
			_hit_marker.queue_redraw()
	if _vignette_alpha > 0.0 and _damage_vignette != null:
		_vignette_alpha = maxf(0.0, _vignette_alpha - delta * 1.9)
		_damage_vignette.color = Color(0.75, 0.05, 0.06, _vignette_alpha)
	if _hitstop_until_ms > 0 and Time.get_ticks_msec() >= _hitstop_until_ms:
		_hitstop_until_ms = 0
		Engine.time_scale = 1.0
	_update_fps_counter(delta)
	_update_reload_indicator()


func _fps_enabled() -> bool:
	if OS.get_cmdline_user_args().has("--fps") or OS.get_cmdline_args().has("--fps"):
		return true
	var settings := get_node_or_null("/root/SettingsStore") if is_inside_tree() else null
	return settings != null and bool(settings.get_value("show_fps", false))


func _update_fps_counter(delta: float) -> void:
	if _fps_label == null:
		return
	var fps := Engine.get_frames_per_second()
	_fps_min = minf(_fps_min, fps)
	_fps_max = maxf(_fps_max, fps)
	_fps_elapsed += delta
	if _fps_elapsed < 0.25:
		return
	_fps_elapsed = 0.0
	_fps_label.text = "FPS %d   min %d   max %d" % [fps, int(_fps_min), int(_fps_max)]


## El arma local se lee del contexto de partida: no hace falta que match.gd
## emita nada nuevo para el indicador de recarga.
func _local_weapon() -> Node:
	if match_context == null:
		return null
	var local_player: Node = match_context.get("player")
	if local_player == null:
		return null
	return local_player.get("weapon")


func _update_reload_indicator() -> void:
	if _reload_label == null:
		return
	var weapon := _local_weapon()
	var reloading := false
	if weapon != null:
		reloading = float(weapon.get("reload_timer")) > 0.0
		if reloading:
			var definition: WeaponDefinition = weapon.call("current_definition")
			var total := maxf(0.05, definition.reload_time)
			_reload_bar.value = clampf(1.0 - float(weapon.get("reload_timer")) / total, 0.0, 1.0) * 100.0
	_reload_bar.visible = reloading
	if reloading:
		_reload_label.text = "RECARGANDO"
		_reload_label.add_theme_color_override("font_color", Color("#ffd471"))
	elif _low_ammo:
		_reload_label.text = "CARGADOR BAJO"
		_reload_label.add_theme_color_override("font_color", Color("#ff8b72"))
	else:
		_reload_label.text = ""


func _draw_hit_marker() -> void:
	if _hit_marker_timer <= 0.0 or _hit_marker == null:
		return
	var strength := clampf(_hit_marker_timer / 0.26, 0.0, 1.0)
	var center := _hit_marker.size * 0.5
	var gap := 9.0 + 6.0 * (1.0 - strength)
	var arm := 12.0 + (7.0 if _hit_marker_kill else 0.0)
	var width := 3.2 if _hit_marker_kill else 2.4
	var color := Color("#ff5a4a") if _hit_marker_kill else (Color("#ffd35f") if _hit_marker_headshot else Color("#eaf6ff"))
	color.a = strength
	for direction: Vector2 in [Vector2(-1, -1), Vector2(1, -1), Vector2(-1, 1), Vector2(1, 1)]:
		var diagonal := direction.normalized()
		_hit_marker.draw_line(center + diagonal * gap, center + diagonal * (gap + arm), color, width, true)


func _spawn_damage_popup(amount: float, headshot: bool) -> void:
	if _damage_popups.is_empty():
		return
	var popup: Label = _damage_popups[_damage_popup_cursor % _damage_popups.size()]
	var slot := _damage_popup_cursor % _damage_popups.size()
	_damage_popup_cursor += 1
	popup.text = "%d" % roundi(amount)
	popup.add_theme_color_override("font_color", Color("#ffd35f") if headshot else Color("#ffe9c2"))
	popup.add_theme_font_size_override("font_size", 24 if headshot else 19)
	# Escalona en rejilla 3x3: dos impactos seguidos no se pisan en pantalla.
	var base_x := float(slot % 3 - 1) * 48.0 + randf_range(-8.0, 8.0)
	var base_y := -14.0 - float((slot / 3) % 3) * 27.0
	popup.offset_left = base_x - 60.0
	popup.offset_right = base_x + 60.0
	popup.offset_top = base_y
	popup.offset_bottom = base_y + 36.0
	popup.modulate = Color(1, 1, 1, 1)
	var drift := randf_range(-26.0, 26.0)
	var tween := create_tween()
	tween.set_parallel(true)
	tween.tween_property(popup, "offset_left", base_x - 60.0 + drift, 0.72)
	tween.tween_property(popup, "offset_right", base_x + 60.0 + drift, 0.72)
	tween.tween_property(popup, "offset_top", base_y - 52.0, 0.72)
	tween.tween_property(popup, "offset_bottom", base_y - 16.0, 0.72)
	tween.tween_property(popup, "modulate", Color(1, 1, 1, 0), 0.5).set_delay(0.22)


func _push_kill_feed(text: String, color: Color) -> void:
	if _kill_feed_entries.is_empty():
		return
	var entry: Label = _kill_feed_entries[_kill_feed_cursor % _kill_feed_entries.size()]
	_kill_feed_cursor += 1
	entry.text = text
	entry.add_theme_color_override("font_color", color)
	entry.modulate = Color(1, 1, 1, 1)
	var tween := create_tween()
	tween.tween_interval(2.4)
	tween.tween_property(entry, "modulate", Color(1, 1, 1, 0), 0.5)


func _flash_damage_vignette(strength: float) -> void:
	_vignette_alpha = maxf(_vignette_alpha, clampf(strength, 0.10, 0.40))


## Hit-stop en la baja: micro-dip de time_scale que se restaura siempre por
## temporizador real (no por delta escalado) y también al salir del árbol.
func _hit_stop(duration: float, scale: float) -> void:
	Engine.time_scale = clampf(scale, 0.6, 1.0)
	_hitstop_until_ms = Time.get_ticks_msec() + int(duration * 1000.0)


func _exit_tree() -> void:
	Engine.time_scale = 1.0
	_hitstop_until_ms = 0


func _notification(what: int) -> void:
	if what == NOTIFICATION_WM_WINDOW_FOCUS_OUT or what == NOTIFICATION_APPLICATION_PAUSED:
		Engine.time_scale = 1.0
		_hitstop_until_ms = 0


func update_score(ally: int, enemy: int, round_number: int) -> void:
	if score_label != null:
		score_label.text = "%d   —   %d" % [ally, enemy]
		round_label.text = "R%d" % round_number

func update_ffa_score(kills: int, target: int) -> void:
	if score_label != null:
		score_label.text = "BAJAS %d / %d" % [kills, target]
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
	_low_ammo = current <= maxi(1, int(definition.magazine_size * 0.25))
	if ammo_label != null:
		ammo_label.add_theme_color_override("font_color",
			Color("#ff8b72") if _low_ammo else Color.WHITE)

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
	_flash_damage_vignette(0.16 if headshot else 0.11)

func show_hit_feedback(amount: float, headshot: bool) -> void:
	# El label central queda para daño RECIBIDO (match.gd llama show_damage con
	# "-N"). El daño infligido se lee ahora en el popup flotante y el marker,
	# así que aquí no se duplica texto.
	if crosshair != null:
		crosshair.register_hit(headshot)
	_hit_marker_timer = 0.26
	_hit_marker_headshot = headshot
	_hit_marker_kill = false
	if _hit_marker != null:
		_hit_marker.queue_redraw()
	_spawn_damage_popup(amount, headshot)
	_play_ui_sound("headshot" if headshot else "hit")

func show_kill(headshot: bool = false) -> void:
	show_banner("HEADSHOT" if headshot else "ELIMINACIÓN", 0.8)
	_hit_marker_timer = 0.30
	_hit_marker_headshot = headshot
	_hit_marker_kill = true
	if _hit_marker != null:
		_hit_marker.queue_redraw()
	_push_kill_feed("TÚ  ▸  %s" % ("HEADSHOT" if headshot else "ENEMIGO"),
		Color("#ffd35f") if headshot else Color("#eaf6ff"))
	_hit_stop(0.05, 0.82)
	_play_ui_sound("headshot" if headshot else "kill")

func _play_ui_sound(sound_key: String) -> void:
	if ui_audio == null:
		return
	ui_audio.stream = CombatAudio.stream(sound_key)
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

## Overlays: el HUD es la PUERTA (teclado, botones, suite y QA) y
## `HudOverlays` el dueño. Se mantienen los nombres antiguos porque los usan
## tests/regressions.gd, tests/smoke.gd y tools/qa_shot.gd.
func toggle_control_editor() -> void:
	# El editor mueve controles táctiles: sin ellos no hay nada que editar.
	# Antes esto era un guard dentro del propio toggle; vive aquí porque es
	# decisión del HUD (quién sabe si hay mandos), no del overlay.
	if mobile_controls == null:
		set_status("EDITOR DISPONIBLE EN CONTROLES TÁCTILES", Color("#ffd471"))
		return
	overlays.toggle_control_editor()


func toggle_settings() -> void:
	overlays.toggle_settings()


func _freeze_for_overlay() -> void:
	overlays.freeze_for_overlay()


func _resume_from_overlay() -> void:
	overlays.resume_from_overlay()


func _resume_from_editor() -> void:
	# Alias de compatibilidad para la suite DEV y herramientas antiguas.
	overlays.resume_from_overlay()


func _open_control_editor(from_settings: bool) -> void:
	overlays.open_control_editor(from_settings)


func _close_control_editor() -> void:
	overlays.close_control_editor()


func _open_settings_panel() -> void:
	overlays.open_settings_panel()


func _close_settings_panel() -> void:
	overlays.close_settings_panel()


## El overlay no conoce el layout del HUD: estos dos callbacks son el contrato
## para que oculte y restaure las piezas de juego mientras está abierto.
func hide_for_overlay() -> void:
	if mobile_controls != null:
		mobile_controls.visible = false
	if bottom_bar != null:
		bottom_bar.visible = false
	if crosshair != null:
		crosshair.visible = false


func restore_after_overlay() -> void:
	if mobile_controls != null:
		mobile_controls.visible = true
	if bottom_bar != null:
		bottom_bar.visible = true
	if crosshair != null:
		crosshair.visible = true


func _settings() -> Node:
	return get_node_or_null("/root/SettingsStore") if is_inside_tree() else null




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
