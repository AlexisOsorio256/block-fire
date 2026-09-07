class_name OperatorDefinition
extends Resource

## Shared-rig operator identity. Every humanoid uses the same animated
## Character_Soldier/Character_Enemy rig (suite contract), while jacket, pants,
## skin tone, trim and silhouette gear (see OperatorVisual._add_gear) make the
## five operators readable as distinct characters.

@export var id: String = "BRAVO"
@export var display_name: String = "BRAVO"
@export var subtitle: String = "ASALTO"
@export var accent: Color = Color("#ff9d50")
@export var visor: Color = Color("#55dcff")
@export var model_scene: String = "res://assets/models/quaternius_toon_shooter/Character_Soldier.gltf"
@export var jacket: Color = Color("#e0763a")
@export var pants: Color = Color("#3f4a5c")
@export var skin_tone: Color = Color("#d4a27f")
@export var trim: Color = Color("#ffd477")
@export var gear: String = "vest"  # helmet/crest/beanie/scarf/heavy/vest variants in OperatorVisual
@export var has_backpack: bool = false
@export var build_scale: float = 0.78

const SHARED_CHARACTER_SCENE: String = "res://assets/models/quaternius_toon_shooter/Character_Soldier.gltf"
const ENEMY_CHARACTER_SCENE: String = "res://assets/models/quaternius_toon_shooter/Character_Enemy.gltf"

static func roster() -> Array[OperatorDefinition]:
	var result: Array[OperatorDefinition] = []
	# BRAVO: warm orange jacket, blue pants, helmet with amber crest.
	result.append(_make("BRAVO", "ASALTO", Color("#ff9d50"), Color("#55dcff"), SHARED_CHARACTER_SCENE,
		Color("#e0763a"), Color("#41537a"), Color("#e8b48c"), Color("#ffb73e"), "crest", false, 0.78))
	# VULTURE: urban grey-green, beanie, no backpack.
	result.append(_make("VULTURE", "URBANO", Color("#9b806e"), Color("#f2b04c"), SHARED_CHARACTER_SCENE,
		Color("#66756d"), Color("#3a4248"), Color("#c9976b"), Color("#c9d3b8"), "beanie", false, 0.78))
	# TALON: green tactical jacket, olive pants, cap + visor scarf, backpack.
	result.append(_make("TALON", "TÁCTICO", Color("#86c75b"), Color("#c9ff65"), SHARED_CHARACTER_SCENE,
		Color("#5d8f45"), Color("#47543a"), Color("#d8a878"), Color("#c9ff65"), "scarf", true, 0.77))
	# DUNE: desert sand explorer, pale beanie, backpack.
	result.append(_make("DUNE", "EXPLORADOR", Color("#d7b46a"), Color("#ffe4a0"), SHARED_CHARACTER_SCENE,
		Color("#c8a35f"), Color("#8a6f45"), Color("#e8c193"), Color("#ffe4a0"), "scarf", true, 0.79))
	# HAVOC: crimson heavy, helmet + heavy vest, biggest build.
	result.append(_make("HAVOC", "PESADO", Color("#d44d79"), Color("#ff7b9d"), SHARED_CHARACTER_SCENE,
		Color("#b03d5f"), Color("#4a3540"), Color("#e0a988"), Color("#ff9db8"), "heavy", true, 0.82))
	return result

static func _make(operator_id: String, role: String, color: Color, visor_color: Color, scene_path: String,
		jacket_color: Color = Color("#e0763a"), pants_color: Color = Color("#3f4a5c"),
		skin_color: Color = Color("#d4a27f"), trim_color: Color = Color("#ffd477"),
		gear_kind: String = "vest", backpack: bool = false, scale_value: float = 0.78) -> OperatorDefinition:
	var value := OperatorDefinition.new()
	value.id = operator_id
	value.display_name = operator_id
	value.subtitle = role
	value.accent = color
	value.visor = visor_color
	value.model_scene = scene_path
	value.jacket = jacket_color
	value.pants = pants_color
	value.skin_tone = skin_color
	value.trim = trim_color
	value.gear = gear_kind
	value.has_backpack = backpack
	value.build_scale = scale_value
	return value
