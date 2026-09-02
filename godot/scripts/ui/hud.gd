# BLOCKFIRE — HUD (parity: HUD.js) — vida, munición, marcador, banners, hitmarker,
# daño direccional, vignette, resultado. Control puro construido en código.
class_name Hud
extends CanvasLayer

var hp_bar: ProgressBar
var hp_label: Label
var ammo_label: Label
var score_label: Label
var banner_label: Label
var result_label: Label
var hitmarker: Control
var vignette: ColorRect

var _banner_t := 0.0
var _vignette_t := 0.0

const FONT := 22

func _mk_label(parent: Control, anchor: int, offset: Vector2, size: int, color: Color) -> Label:
	var l := Label.new()
	l.add_theme_font_size_override("font_size", size)
	l.add_theme_color_override("font_color", color)
	l.add_theme_color_override("font_shadow_color", Color(0, 0, 0, 0.6))
	l.add_theme_constant_override("shadow_offset_x", 2)
	l.add_theme_constant_override("shadow_offset_y", 2)
	l.anchor_left = anchor & 1
	l.anchor_right = (anchor >> 1) & 1
	l.anchor_top = (anchor >> 2) & 1
	l.anchor_bottom = (anchor >> 3) & 1
	l.offset_left = offset.x
	l.offset_top = offset.y
	parent.add_child(l)
	return l

func _ready() -> void:
	var root := Control.new()
	root.set_anchors_preset(Control.PRESET_FULL_RECT)
	root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(root)

	# vignette de daño (flash rojo en bordes)
	vignette = ColorRect.new()
	vignette.set_anchors_preset(Control.PRESET_FULL_RECT)
	vignette.color = Color(0.8, 0.05, 0.05, 0.0)
	vignette.mouse_filter = Control.MOUSE_FILTER_IGNORE
	root.add_child(vignette)

	hp_bar = ProgressBar.new()
	hp_bar.anchor_top = 0.92; hp_bar.anchor_bottom = 0.92
	hp_bar.anchor_left = 0.02; hp_bar.anchor_right = 0.2
	hp_bar.offset_top = -30; hp_bar.offset_bottom = -8
	hp_bar.show_percentage = false
	hp_bar.modulate = Color(1, 1, 1, 0.9)
	root.add_child(hp_bar)
	hp_label = _mk_label(root, 0b0101, Vector2(10, -28), 20, Color.WHITE)

	ammo_label = _mk_label(root, 0b0110, Vector2(-260, -40), 26, Color(1, 1, 1, 0.95))
	ammo_label.anchor_left = 1.0; ammo_label.anchor_right = 1.0
	ammo_label.offset_left = -260; ammo_label.offset_right = -20
	ammo_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	ammo_label.anchor_top = 0.94; ammo_label.anchor_bottom = 0.94

	score_label = _mk_label(root, 0b0100, Vector2(-120, 8), 22, Color(1, 1, 1, 0.9))
	score_label.anchor_left = 0.5; score_label.anchor_right = 0.5

	banner_label = _mk_label(root, 0b0100, Vector2(-260, 90), 30, Color(1.0, 0.85, 0.4))
	banner_label.anchor_left = 0.5; banner_label.anchor_right = 0.5
	banner_label.text = ""

	result_label = _mk_label(root, 0b1111, Vector2.ZERO, 64, Color.WHITE)
	result_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	result_label.text = ""

	hitmarker = ColorRect.new()
	hitmarker.color = Color(1, 1, 1, 0)
	hitmarker.size = Vector2(26, 3)
	hitmarker.position = Vector2(0, 0)
	hitmarker.set_anchors_preset(Control.PRESET_CENTER)
	root.add_child(hitmarker)

	Game.kill_banner.connect(_on_banner)
	Game.match_over.connect(_on_match_over)
	Game.player_hurt.connect(func(_a, _b): _vignette_t = 0.35)

func _on_banner(text: String) -> void:
	banner_label.text = text
	_banner_t = 1.6
	banner_label.scale = Vector2(1.15, 1.15)

func flash_hitmarker(headshot: bool) -> void:
	hitmarker.color = Color(1.0, 0.4, 0.3) if headshot else Color(1, 1, 1, 0.9)
	var tw := create_tween()
	tw.tween_property(hitmarker, "color:a", 0.0, 0.18)

func _process(delta: float) -> void:
	if _banner_t > 0.0:
		_banner_t -= delta
		banner_label.scale = banner_label.scale.lerp(Vector2.ONE, delta * 8.0)
		if _banner_t <= 0.0:
			banner_label.text = ""
	if _vignette_t > 0.0:
		_vignette_t -= delta
		vignette.color.a = maxf(0.0, _vignette_t) * 0.9
	else:
		vignette.color.a = 0.0

func bind_player(p: Player, w: WeaponSystem) -> void:
	hp_bar.max_value = p.max_hp
	p.died.connect(func(): _vignette_t = 0.6)
	Game.player_hurt.connect(_on_hurt)
	w.ammo_changed.connect(func(m: int, r: int):
		ammo_label.text = ("RECARGANDO" if w.reloading else "%d / %d" % [m, r]))
	w.hitmarker.connect(flash_hitmarker)
	ammo_label.text = "%d / %d" % [w.mag, w.reserve]

func _on_hurt(dir_angle: float, _amount: float) -> void:
	_vignette_t = 0.35
	# indicador direccional: marca roja hacia la fuente
	if dmg_dir == null:
		dmg_dir = ColorRect.new()
		dmg_dir.color = Color(1.0, 0.2, 0.15, 0.85)
		dmg_dir.size = Vector2(90, 6)
		add_child(dmg_dir)
	dmg_dir.visible = true
	var center := get_viewport().get_visible_rect().size * 0.5
	var off := Vector2.UP.rotated(-dir_angle) * 120.0
	dmg_dir.position = center + off - dmg_dir.size * 0.5
	dmg_dir.rotation = dir_angle + PI / 2.0
	var tw := create_tween()
	tw.tween_interval(0.25)
	tw.tween_callback(func(): dmg_dir.visible = false)

var dmg_dir: ColorRect

func _on_match_over(won: bool) -> void:
	result_label.text = "VICTORIA" if won else "DERROTA"
	result_label.modulate = Color(0.45, 1.0, 0.55) if won else Color(1.0, 0.4, 0.35)
