class_name OperatorDefinition
extends Resource

@export var id: String = "BRAVO"
@export var display_name: String = "BRAVO"
@export var subtitle: String = "ASALTO"
@export var accent: Color = Color("#ff9d50")
@export var visor: Color = Color("#55dcff")
@export var model_scene: String = "res://assets/models/kenney_blocky/character-a.glb"

static func roster() -> Array[OperatorDefinition]:
	var result: Array[OperatorDefinition] = []
	result.append(_make("BRAVO", "ASALTO", Color("#ff9d50"), Color("#55dcff"), "res://assets/models/kenney_blocky/character-a.glb"))
	result.append(_make("VULTURE", "URBANO", Color("#9b806e"), Color("#f2b04c"), "res://assets/models/kenney_blocky/character-b.glb"))
	result.append(_make("TALON", "TÁCTICO", Color("#86c75b"), Color("#c9ff65"), "res://assets/models/kenney_blocky/character-c.glb"))
	result.append(_make("DUNE", "EXPLORADOR", Color("#d7b46a"), Color("#ffe4a0"), "res://assets/models/kenney_blocky/character-d.glb"))
	result.append(_make("HAVOC", "PESADO", Color("#d44d79"), Color("#ff7b9d"), "res://assets/models/kenney_blocky/character-e.glb"))
	return result

static func _make(operator_id: String, role: String, color: Color, visor_color: Color, scene_path: String) -> OperatorDefinition:
	var value := OperatorDefinition.new()
	value.id = operator_id
	value.display_name = operator_id
	value.subtitle = role
	value.accent = color
	value.visor = visor_color
	value.model_scene = scene_path
	return value
