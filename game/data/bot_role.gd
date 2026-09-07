class_name BotRole
extends Resource

@export var id: String = "support"
@export var preferred_distance: float = 18.0
@export var reaction: float = 0.42
@export var aggression: float = 0.55
@export var accuracy: float = 0.68
@export var reposition_tendency: float = 0.35
@export var preferred_weapon_id: String = "rifle"

static func make(role_id: String) -> BotRole:
	var role := BotRole.new()
	role.id = role_id
	match role_id:
		"entry":
			role.preferred_distance = 10.0
			role.reaction = 0.34
			role.aggression = 0.72
			role.accuracy = 0.62
			role.reposition_tendency = 0.48
			role.preferred_weapon_id = "smg"
		"anchor":
			role.preferred_distance = 24.0
			role.reaction = 0.5
			role.aggression = 0.48
			role.accuracy = 0.76
			role.reposition_tendency = 0.22
			role.preferred_weapon_id = "rifle"
		_:
			role.id = "support"
			role.preferred_distance = 17.0
			role.reaction = 0.42
			role.aggression = 0.58
			role.accuracy = 0.69
			role.preferred_weapon_id = "rifle"
	return role
