class_name OperatorDefinition
extends Resource

## DEPRECAADO: los operadores player-facing (BRAVO/VULTURE/TALON/DUNE/HAVOC)
## ya no existen como concepto de producto. El jugador es un PERSONAJE BASE
## con ropa/cosméticos modulares (game/data/cosmetic_catalog.gd) y los roles
## entry/support/anchor viven solo como IA de bots (game/data/bot_role.gd).
## Este archivo conserva el id y el accent como datos legacy para la firma
## de compatibilidad (tools/qa_shot.gd --operator=BRAVO, lobby transitorio)
## hasta que el frente de lobby termine el cambio causal.

@export var id: String = "BRAVO"
@export var display_name: String = "BRAVO"
@export var accent: Color = Color("#ff9d50")

## Ruta canónica del rig modular compartido (última fuente de rig).
const SHARED_CHARACTER_SCENE: String = "res://assets/models/quaternius_modular/avatar_rig.gltf"
const AVATAR_SCENE: String = SHARED_CHARACTER_SCENE

## Acentos legacy de los operadores, solo para teñir marcadores de equipo.
const LEGACY_ACCENTS: Dictionary = {
	"BRAVO": Color("#ff9d50"),
	"VULTURE": Color("#9b806e"),
	"TALON": Color("#86c75b"),
	"DUNE": Color("#d7b46a"),
	"HAVOC": Color("#d44d79")
}

static func accent_for(operator_id: String) -> Color:
	return LEGACY_ACCENTS.get(operator_id, Color("#ff9d50"))


static func roster() -> Array[OperatorDefinition]:
	## Alias de compatibilidad: los tests y el lobby transitorio pueden seguir
	## pidiendo la lista, pero ya no representa héroes seleccionables.
	var result: Array[OperatorDefinition] = []
	for operator_id: String in LEGACY_ACCENTS:
		var value := OperatorDefinition.new()
		value.id = operator_id
		value.display_name = operator_id
		value.accent = LEGACY_ACCENTS[operator_id]
		result.append(value)
	return result
