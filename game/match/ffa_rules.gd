class_name FfaRules
extends RefCounted

const COMBATANT_COUNT: int = 8
const KILLS_TO_WIN: int = 20

static func is_match_over(kills: int) -> bool:
	return kills >= KILLS_TO_WIN

static func respawn_delay() -> float:
	return 2.0
