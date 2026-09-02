# BLOCKFIRE — CharacterModel (compartido por Player y Bots — un sistema + datos)
# Rig Kenney Blocky (CC0, 20 skins, 27 animaciones): locomoción, poses de arma,
# disparo, muerte. Normaliza escala a 1.8m y expone la mano derecha para el arma.
class_name CharacterModel
extends Node3D

# SKINS = outfits con identidad (personaje base + accesorios que cambian la silueta).
# El rig Kenney conserva sus texturas originales; los accesorios son geometría real.
const OUTFITS := [
	{ "char": "a", "name": "ASALTO", "gear": ["vest", "helmet"] },
	{ "char": "b", "name": "BOSQUE", "gear": ["backpack", "cap"] },
	{ "char": "c", "name": "DESIERTO", "gear": ["vest", "cap"] },
	{ "char": "d", "name": "NOCTURNO", "gear": ["hood", "pads"] },
	{ "char": "e", "name": "RAID", "gear": ["armor", "helmet"] },
	{ "char": "f", "name": "TACTICO", "gear": ["vest", "pads"] },
	{ "char": "g", "name": "VANGUARDIA", "gear": ["armor", "visor"] },
	{ "char": "h", "name": "ARENA", "gear": ["backpack", "cap"] },
]

var anim: AnimationPlayer
var arm_right: Node3D
var rig: Node3D
var current_action := ""

func setup(skin: int) -> void:
	var outfit: Dictionary = OUTFITS[skin % OUTFITS.size()]
	var path := "res://assets/characters/character-%s.glb" % outfit["char"]
	var scene: PackedScene = load(path)
	if scene == null:
		push_warning("[CHAR] falta " + path)
		return
	rig = scene.instantiate()
	add_child(rig)
	anim = rig.find_child("AnimationPlayer", true, false)
	if anim == null:
		push_warning("[CHAR] sin AnimationPlayer en " + path)
		return
	# normalizar a 1.8 m y pies en y=0
	var aabb := _whole_aabb(rig)
	if aabb.size.y > 0.01:
		var s := 1.8 / aabb.size.y
		rig.scale = Vector3.ONE * s
		rig.position.y = -aabb.position.y * s
	_build_gear(rig, outfit)
	arm_right = rig.find_child("arm-right", true, false)
	play("idle")

# AABB combinado en espacio LOCAL (funciona fuera del árbol — el bug del personaje flotando)
func _whole_aabb(root: Node) -> AABB:
	return _merge_aabb(root, Transform3D.IDENTITY)

func _merge_aabb(n: Node, xf: Transform3D) -> AABB:
	var out := AABB()
	var first := true
	if n is Node3D:
		xf = xf * (n as Node3D).transform
	if n is MeshInstance3D:
		out = xf * (n as MeshInstance3D).get_aabb()
		first = false
	for c in n.get_children():
		var sub := _merge_aabb(c, xf)
		if first:
			out = sub
			first = false
		else:
			out = out.merge(sub)
	return out

func _build_gear(root: Node, outfit: Dictionary) -> void:
	# accesorios anclados a los nodos del rig: cambian la SILUETA (prueba de skin real)
	var torso := root.find_child("torso", true, false)
	var head := root.find_child("head", true, false)
	var arm_l := root.find_child("arm-left", true, false)
	var arm_r := root.find_child("arm-right", true, false)
	var dark := Color(0.16, 0.17, 0.20)
	for gear_id: String in outfit["gear"]:
		match gear_id:
			"vest":
				if torso: _gear_box(torso, Vector3(0.5, 0.42, 0.42), Vector3(0, 0.08, 0), dark, 0.7)
			"armor":
				if torso:
					_gear_box(torso, Vector3(0.54, 0.34, 0.46), Vector3(0, 0.14, 0), Color(0.25, 0.28, 0.33), 0.55)
					_gear_box(torso, Vector3(0.5, 0.18, 0.4), Vector3(0, -0.1, 0), dark, 0.7)
			"helmet":
				if head:
					var c := CylinderMesh.new()
					c.top_radius = 0.21; c.bottom_radius = 0.24; c.height = 0.18
					_gear_mesh(head, c, Vector3(0, 0.18, 0), Color(0.20, 0.23, 0.28), 0.5)
			"visor":
				if head: _gear_box(head, Vector3(0.36, 0.08, 0.06), Vector3(0, 0.02, -0.2), Color(0.10, 0.9, 0.8), 0.3, true)
			"cap":
				if head: _gear_box(head, Vector3(0.4, 0.1, 0.4), Vector3(0, 0.2, 0.0), outfit_color(outfit), 0.8)
			"hood":
				if head: _gear_box(head, Vector3(0.44, 0.3, 0.42), Vector3(0, 0.06, 0.04), dark, 0.85)
			"backpack":
				if torso: _gear_box(torso, Vector3(0.38, 0.44, 0.2), Vector3(0, 0.05, 0.26), Color(0.4, 0.33, 0.22), 0.8)
			"pads":
				if arm_l: _gear_box(arm_l, Vector3(0.16, 0.14, 0.18), Vector3(0, -0.12, 0), dark, 0.6)
				if arm_r: _gear_box(arm_r, Vector3(0.16, 0.14, 0.18), Vector3(0, -0.12, 0), dark, 0.6)

func outfit_color(_o: Dictionary) -> Color:
	return Color(0.85, 0.45, 0.15)

func _gear_box(parent: Node3D, size: Vector3, pos: Vector3, color: Color, rough: float, glow := false) -> void:
	var mi := MeshInstance3D.new()
	var bm := BoxMesh.new()
	bm.size = size
	mi.mesh = bm
	var m := StandardMaterial3D.new()
	m.albedo_color = color
	m.roughness = rough
	if glow:
		m.emission_enabled = true
		m.emission = color
		m.emission_energy_multiplier = 1.2
	mi.material_override = m
	parent.add_child(mi)
	mi.position = pos

func _gear_mesh(parent: Node3D, mesh: Mesh, pos: Vector3, color: Color, rough: float) -> void:
	var mi := MeshInstance3D.new()
	mi.mesh = mesh
	var m := StandardMaterial3D.new()
	m.albedo_color = color
	m.roughness = rough
	mi.material_override = m
	parent.add_child(mi)
	mi.position = pos

# ---- API de animación (crossfade suave entre acciones) ----
func play(action: String, speed := 1.0, blend := 0.18) -> void:
	if anim == null:
		return
	if not anim.has_animation(action):
		return
	if current_action == action:
		anim.speed_scale = speed
		return
	current_action = action
	anim.play(action, blend, speed)

# locomoción continua según velocidad real (0=idle, caminar=walk, sprint)
func locomotion(speed_now: float, walk_speed: float, sprint_speed: float) -> void:
	var clamped_speed := maxf(speed_now, 0.0)
	if clamped_speed < 0.4:
		_play_loco("idle")
		return
	var sprinting := clamped_speed > walk_speed * 1.05
	var action := "sprint" if sprinting else "walk"
	_play_loco(action)
	# escalar ritmo de la animación a la velocidad real (feel)
	var ref_speed := sprint_speed if sprinting else walk_speed
	anim.speed_scale = clampf(clamped_speed / ref_speed, 0.6, 1.5)

func _play_loco(action: String) -> void:
	if current_action != action:
		current_action = action
		anim.play(action, 0.22)

# pose con arma (idle de pie, arma en mano derecha) — usada cuando está quieto armado
func hold_weapon() -> void:
	play("holding-right")

# disparo: one-shot de la animación de shoot y vuelta a pose de arma
func shoot_pose() -> void:
	if anim == null:
		return
	if not anim.has_animation("holding-right-shoot"):
		return
	anim.play("holding-right-shoot", 0.05)
	current_action = "holding-right-shoot"

func die_pose() -> void:
	play("die", 1.0, 0.1)

func hit_flash() -> void:
	# reacción breve al recibir daño: flash de material emisivo en el torso
	if rig == null:
		return
	var torso := rig.find_child("torso", true, false)
	if torso is MeshInstance3D:
		var m := (torso as MeshInstance3D).material_override
		if m is StandardMaterial3D:
			var sm := m as StandardMaterial3D
			sm.emission_enabled = true
			sm.emission = Color(1.0, 0.25, 0.2)
			sm.emission_energy_multiplier = 1.6
			var tw := create_tween()
			tw.tween_property(sm, "emission_energy_multiplier", 0.0, 0.22)
			tw.tween_callback(func(): sm.emission_enabled = false)
