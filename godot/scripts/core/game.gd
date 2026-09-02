# BLOCKFIRE — Game autoload (parity: Game.js + MatchState)
# RUTA ÚNICA de daño/muerte/respawn/score. Un solo dueño del audio de kill (bug histórico).
extends Node

signal kill_banner(text: String)
signal match_over(won: bool)
signal player_hurt(dir_angle: float, amount: float)

const TARGET_KILLS := 20
const MATCH_TIME := 300.0
const RESPAWN_DELAY := 2.0

var player: Node3D = null
var player_kills: int = 0
var bot_kills: int = 0
var time_left: float = MATCH_TIME
var finished: bool = false

var _respawn_queue: Array[Dictionary] = []
var _last_kill_time: float = -10.0
var _kills_in_window: int = 0
var _streak: int = 0

func reset_match() -> void:
	player_kills = 0
	bot_kills = 0
	time_left = MATCH_TIME
	finished = false
	_respawn_queue.clear()
	_last_kill_time = -10.0
	_kills_in_window = 0
	_streak = 0

func tick(delta: float) -> void:
	if finished:
		return
	time_left -= delta
	# cola de respawn (parity: pendingRespawns)
	for i in range(_respawn_queue.size() - 1, -1, -1):
		if _respawn_queue[i]["t"] <= Time.get_ticks_msec() / 1000.0:
			var who: Node = _respawn_queue[i]["who"]
			var pos: Vector3 = _respawn_queue[i]["pos"]
			_respawn_queue.remove_at(i)
			if is_instance_valid(who) and who.has_method("respawn"):
				who.respawn(pos)
	if time_left <= 0.0:
		_end_match(player_kills >= bot_kills)

# ---- RUTA ÚNICA DE DAÑO ----
func apply_damage(victim: Node, amount: float, headshot: bool, from: Vector3) -> void:
	if finished or not is_instance_valid(victim):
		return
	if victim.has_method("take_damage"):
		victim.take_damage(amount, headshot, from)

func register_kill(victim: Node, killer: Node, headshot: bool) -> void:
	if finished:
		return
	var killer_is_player: bool = killer != null and killer.is_in_group("player")
	var victim_is_player: bool = victim != null and victim.is_in_group("player")

	if killer_is_player and not victim_is_player:
		var now := Time.get_ticks_msec() / 1000.0
		if now - _last_kill_time < 2.5:
			_kills_in_window += 1
		else:
			_kills_in_window = 1
		_last_kill_time = now
		_streak += 1
		var text := "ELIMINADO +100"
		if _kills_in_window >= 2:
			text = "DOBLE BAJA +200"
		elif headshot:
			text = "HEADSHOT +150"
		if _streak >= 3:
			text += "  RACHA x%d" % _streak
		kill_banner.emit(text)
		Audio.play("kill")
		player_kills += 1
		if player_kills >= TARGET_KILLS:
			_end_match(true)
	elif victim_is_player:
		bot_kills += 1
		_streak = 0
		_kills_in_window = 0
		player_hurt.emit(0.0, 0.0)

func queue_respawn(who: Node, pos: Vector3, delay: float = RESPAWN_DELAY) -> void:
	_respawn_queue.append({
		"who": who,
		"pos": pos,
		"t": Time.get_ticks_msec() / 1000.0 + delay,
	})
	if is_instance_valid(who) and "active" in who:
		who.set("active", false)
		who.visible = false

func _end_match(won: bool) -> void:
	if finished:
		return
	finished = true
	match_over.emit(won)
