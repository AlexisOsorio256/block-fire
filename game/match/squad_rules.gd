class_name SquadRules
extends RefCounted

const FIRST_TO_ROUNDS: int = 4
const TEAM_SIZE: int = 4
const BUY_FIRST_ROUND: float = 10.0
const BUY_LATER_ROUNDS: float = 8.0

static func buy_duration(round_number: int) -> float:
	return BUY_FIRST_ROUND if round_number <= 1 else BUY_LATER_ROUNDS

static func is_match_over(ally_rounds: int, enemy_rounds: int) -> bool:
	return ally_rounds >= FIRST_TO_ROUNDS or enemy_rounds >= FIRST_TO_ROUNDS

static func resolve_elimination_winner(ally_alive: int, enemy_alive: int, last_team: String) -> String:
	if ally_alive > 0 and enemy_alive <= 0:
		return "ally"
	if enemy_alive > 0 and ally_alive <= 0:
		return "enemy"
	if last_team == "ally" or last_team == "enemy":
		return last_team
	return "enemy"

static func next_round(round_number: int) -> int:
	return round_number + 1
