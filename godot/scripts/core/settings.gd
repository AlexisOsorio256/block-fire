# BLOCKFIRE — Settings autoload (parity: src/core/Settings.js)
# Persistence: user://settings.cfg — sensibilidad, ADS, tamaño/opacidad de botones, layout.
extends Node

signal changed

const PATH := "user://settings.cfg"

# sensibilidad base (rad/px) + multiplicador de usuario (0.3–2.0)
const SENS_BASE := 0.0022
var sens_mul: float = 1.0
var ads_mul: float = 0.6
# touch sensibilidad (parity web 0.0052 rad/px)
var touch_sens: float = 0.0052
# botones móviles
var btn_scale: float = 1.0
var btn_opacity: float = 0.85
# posiciones personalizadas por botón (Vector2 offsets)
var btn_pos: Dictionary = {}

func _ready() -> void:
	load_settings()

func load_settings() -> void:
	var cfg := ConfigFile.new()
	if cfg.load(PATH) != OK:
		return
	sens_mul = cfg.get_value("input", "sens_mul", sens_mul)
	ads_mul = cfg.get_value("input", "ads_mul", ads_mul)
	touch_sens = cfg.get_value("input", "touch_sens", touch_sens)
	btn_scale = cfg.get_value("ui", "btn_scale", btn_scale)
	btn_opacity = cfg.get_value("ui", "btn_opacity", btn_opacity)
	btn_pos = cfg.get_value("ui", "btn_pos", {})

func save_settings() -> void:
	var cfg := ConfigFile.new()
	cfg.set_value("input", "sens_mul", sens_mul)
	cfg.set_value("input", "ads_mul", ads_mul)
	cfg.set_value("input", "touch_sens", touch_sens)
	cfg.set_value("ui", "btn_scale", btn_scale)
	cfg.set_value("ui", "btn_opacity", btn_opacity)
	cfg.set_value("ui", "btn_pos", btn_pos)
	cfg.save(PATH)

func look_mul() -> float:
	return SENS_BASE * sens_mul

func aim_mul() -> float:
	return ads_mul

func set_btn_offset(id: String, pos: Vector2) -> void:
	btn_pos[id] = pos
	save_settings()

func get_btn_offset(id: String) -> Vector2:
	return btn_pos.get(id, Vector2.ZERO)

func reset_buttons() -> void:
	btn_pos.clear()
	save_settings()
