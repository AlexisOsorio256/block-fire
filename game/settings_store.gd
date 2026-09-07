class_name BlockfireSettingsStore
extends Node

const SAVE_VERSION: int = 1
const SAVE_PATH: String = "user://settings.cfg"

var values: Dictionary = {
	"master_volume": 0.85,
	"sfx_volume": 0.9,
	"sensitivity": 0.12,
	"ads_multiplier": 0.72,
	"mobile_opacity": 0.68,
	"operator": "BRAVO",
	"weapon_skin": "Estándar",
	"quality": "mobile",
	"control_layout": {}
}

func _ready() -> void:
	_load()
	_apply_audio()

func get_value(key: String, fallback: Variant = null) -> Variant:
	return values.get(key, fallback)

func set_value(key: String, value: Variant) -> void:
	values[key] = value
	_save()
	if key == "master_volume" or key == "sfx_volume":
		_apply_audio()

func set_control_layout(layout: Dictionary) -> void:
	values["control_layout"] = layout.duplicate(true)
	_save()

func get_control_layout() -> Dictionary:
	return values.get("control_layout", {}).duplicate(true)

func reset_control_layout() -> void:
	values["control_layout"] = {}
	_save()

func _load() -> void:
	var config := ConfigFile.new()
	if config.load(SAVE_PATH) != OK:
		return
	var version: int = int(config.get_value("meta", "save_version", SAVE_VERSION))
	if version != SAVE_VERSION:
		return
	for key: String in values.keys():
		if config.has_section_key("settings", key):
			values[key] = config.get_value("settings", key)

func _save() -> void:
	var config := ConfigFile.new()
	config.set_value("meta", "save_version", SAVE_VERSION)
	for key: String in values.keys():
		config.set_value("settings", key, values[key])
	config.save(SAVE_PATH)

func _apply_audio() -> void:
	var master: float = clampf(float(values.get("master_volume", 0.85)), 0.0, 1.0)
	var sfx: float = clampf(float(values.get("sfx_volume", 0.9)), 0.0, 1.0)
	if AudioServer.get_bus_count() > 0:
		AudioServer.set_bus_volume_db(0, linear_to_db(maxf(master, 0.0001)))
	if AudioServer.get_bus_index("SFX") >= 0:
		AudioServer.set_bus_volume_db(AudioServer.get_bus_index("SFX"), linear_to_db(maxf(sfx, 0.0001)))
