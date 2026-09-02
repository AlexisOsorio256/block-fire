# BLOCKFIRE — Self-test headless (parity checks + flujo de partida simulado)
# Ejecutar: godot --headless scenes/main.tscn --selftest   (vía main.gd)
# o: godot --headless -s res://tests/selftest.gd --path .
extends Node

var failures := 0
var passes := 0

func _ready() -> void:
	await get_tree().process_frame
	await _run_all()
	if failures == 0:
		print("[SELFTEST] ALL %d PASSED" % passes)
	else:
		print("[SELFTEST] FAILED %d de %d" % [failures, passes + failures])
	get_tree().quit(0 if failures == 0 else 1)

func check(cond: bool, name: String) -> void:
	if cond:
		passes += 1
		print("[TEST] PASS ", name)
	else:
		failures += 1
		print("[TEST] FAIL ", name)

func _run_all() -> void:
	# ---- paridad numérica (BEHAVIOR-MAP) ----
	var player: Player = load("res://scripts/player/player.gd").new()
	check(is_equal_approx(player.max_hp, 125.0), "HP jugador 125")
	check(is_equal_approx(Player.WALK, 7.2), "velocidad caminar 7.2")
	check(is_equal_approx(Player.SPRINT, 8.6), "sprint 8.6")
	check(is_equal_approx(Player.ACCEL, 58.0), "aceleración 58")
	check(is_equal_approx(Player.FRICTION, 46.0), "fricción 46")
	check(is_equal_approx(Player.GRAVITY, 22.0), "gravedad 22")
	check(is_equal_approx(Player.EYE_H, 1.65), "ojo 1.65")
	check(is_equal_approx(Player.CROUCH_EYE, 1.15), "crouch ojo 1.15")

	var weapons: Array = load("res://scripts/combat/weapons.gd").WEAPONS
	check(weapons.size() == 3, "3 armas")
	check(weapons[0]["mag"] == 30 and weapons[0]["reserve"] == 90, "rifle 30+90")
	check(is_equal_approx(weapons[0]["interval"], 0.1), "rifle 600 rpm")
	check(weapons[2]["pellets"] == 8, "escopeta 8 perdigones")
	check(weapons[1]["reload"] == 1.6, "pistola recarga 1.6")

	check(Game.TARGET_KILLS == 20, "20 kills ganan")
	check(Game.RESPAWN_DELAY == 2.0, "respawn 2s")
	check(Arena.SPAWNS.size() >= 9, "spawns validados >= 9")

	# ---- flujo de partida real en escena ----
	Engine.set_meta("blockfire_selftest_nested", true)
	var main_scene: Node = load("res://scenes/main.tscn").instantiate()
	get_tree().root.add_child(main_scene)
	await get_tree().physics_frame
	await get_tree().process_frame

	var pl: Player = main_scene.get_node_or_null("Player")
	check(pl != null, "player existe en escena")
	var bot_count := 0
	var first_bot: Bot = null
	for c in main_scene.get_children():
		if c is Bot:
			bot_count += 1
			if first_bot == null:
				first_bot = c
	check(bot_count == 7, "7 bots")

	if pl != null and first_bot != null:
		# kill del jugador por la ruta única → score sube + banner
		var banner_texts: Array[String] = []
		Game.kill_banner.connect(func(t: String): banner_texts.append(t))
		var kills_before := Game.player_kills
		first_bot.notify_attacker(pl, true)  # simula lo que hace WeaponSystem._shot
		Game.apply_damage(first_bot, 999.0, true, pl.global_position)
		await get_tree().process_frame
		check(Game.player_kills == kills_before + 1, "score por kill via ruta única")
		check(banner_texts.size() == 1 and banner_texts[0].begins_with("HEADSHOT +150"), "banner headshot +150")
		check(not first_bot.active, "bot muerto tras kill")

		# muerte del jugador → respawn pendiente
		Game.apply_damage(pl, 130.0, false, pl.global_position + Vector3(0, 0, 3))
		check(not pl.active, "muerte del jugador por daño letal")
		# arma montada en la mano derecha del rig
		var hand: Node3D = pl.char_model.arm_right
		var mounted := false
		if hand != null:
			for c in hand.get_children():
				if String(c.name).begins_with("Weapon_"):
					mounted = true
		check(mounted, "arma física montada en la mano")
