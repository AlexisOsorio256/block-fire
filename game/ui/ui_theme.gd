class_name BlockfireTheme
extends RefCounted

const INK: Color = Color("#071127")
const INK_SOFT: Color = Color("#101e39")
const PANEL: Color = Color("#0a1428e8")
const PANEL_LIGHT: Color = Color("#172844e8")
const GOLD: Color = Color("#ffb73e")
const ICE: Color = Color("#c8e7ff")

static func panel(color: Color = PANEL, border: Color = Color("#304969"), radius: int = 14, width: int = 1) -> StyleBoxFlat:
	var style := StyleBoxFlat.new()
	style.bg_color = color
	style.border_color = border
	style.set_border_width_all(width)
	style.set_corner_radius_all(radius)
	style.content_margin_left = 18.0
	style.content_margin_right = 18.0
	style.content_margin_top = 14.0
	style.content_margin_bottom = 14.0
	return style

static func button_style(fill: Color, border: Color, radius: int = 10) -> StyleBoxFlat:
	var style := panel(fill, border, radius, 1)
	style.content_margin_left = 14.0
	style.content_margin_right = 14.0
	style.content_margin_top = 9.0
	style.content_margin_bottom = 9.0
	return style

static func apply_button(button: Button, accent: Color = GOLD) -> void:
	button.add_theme_stylebox_override("normal", button_style(PANEL_LIGHT, Color("#395678")))
	button.add_theme_stylebox_override("hover", button_style(Color("#24456d"), accent))
	button.add_theme_stylebox_override("pressed", button_style(Color("#0c1a30"), accent, 8))
	button.add_theme_stylebox_override("focus", button_style(Color("#24456d"), accent))
	button.add_theme_color_override("font_color", ICE)
	button.add_theme_color_override("font_hover_color", Color.WHITE)
	button.add_theme_color_override("font_pressed_color", accent)
	button.add_theme_font_size_override("font_size", 16)
	button.mouse_default_cursor_shape = Control.CURSOR_POINTING_HAND

static func label(text: String, size: int, color: Color = ICE) -> Label:
	var value := Label.new()
	value.text = text
	value.add_theme_font_size_override("font_size", size)
	value.add_theme_color_override("font_color", color)
	return value
