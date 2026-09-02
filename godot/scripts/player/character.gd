# BLOCKFIRE — CharacterModel (compartido por Player y Bots — un sistema + datos)
# Rig Kenney Blocky (CC0, 20 skins, 27 animaciones): locomoción, poses de arma,
# disparo, muerte. Normaliza escala a 1.8m y expone la mano derecha para el arma.
class_name CharacterModel
extends Node3D

# skin: índice → outfit con personaje + tinte de uniforme + acento (identidad BLOCKFIRE)
const OUTFITS := [
	{ "char": "a", "uniform": Color(0.30, 0.48, 0.68), "accent": Color(0.95, 0.62, 0.15) },  # asalto azul
	{ "char": "b", "uniform": Color(0.42, 0.46, 0.34), "accent": Color(0.85, 0.85, 0.80) },  # bosque
	{ "char": "c", "uniform": Color(0.52, 0.34, 0.20), "accent": Color(0.90, 0.75, 0.45) },  # desierto
	{ "char": "d", "uniform": Color(0.22, 0.26, 0.34), "accent": Color(0.55, 0.80, 0.95) },  # nocturno
	{ "char": "e", "uniform": Color(0.55, 0.28, 0.24), "accent": Color(0.95, 0.85, 0.30) },  # raid rojo
	{ "char": "f", "uniform": Color(0.36, 0.52, 0.42), "accent": Color(0.90, 0.90, 0.90) },  # táctico verde
	{ "char": "g", "uniform": Color(0.48, 0.42, 0.52), "accent": Color(0.85, 0.45, 0.85) },  # violeta
	{ "char": "h", "uniform": Color(0.62, 0.55, 0.38), "accent": Color(1.00, 0.55, 0.20) },  # arena naranja
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
	_tint_parts(rig, outfit)
	arm_right = rig.find_child("arm-right", true, false)
	play("idle")

func _whole_aabb(root: Node) -> AABB:
	var total := AABB()
	var first := true
	var stack: Array[Node] = [root]
	while not stack.is_empty():
		var n: Node = stack.pop_back()
		for c in n.get_children():
			stack.append(c)
		if n is MeshInstance3D:
			var ab: AABB = n.get_aabb()
			var xform: Transform3D = n.global_transform
			if n.is_inside_tree():
				xform = n.global_transform
				var rel := global_transform.affine_inverse() * xform
				ab = rel * ab
			if first:
				total = ab
				first = false
			else:
				total = total.merge(ab)
	return total

func _tint_parts(root: Node, outfit: Dictionary) -> void:
	var stack: Array[Node] = [root]
	while not stack.is_empty():
		var n: Node = stack.pop_back()
		for c in n.get_children():
			stack.append(c)
		if n is MeshInstance3D:
			var nm := String(n.name).to_lower()
			var mat := StandardMaterial3D.new()
			if "torso" in nm or "arm" in nm:
				mat.albedo_color = outfit["uniform"]
			elif "leg" in nm:
				mat.albedo_color = outfit["uniform"].darkened(0.35)
			elif "head" in nm:
				mat.albedo_color = Color(0.85, 0.68, 0.55)
			elif "hat" in nm or "cap" in nm:
				mat.albedo_color = outfit["accent"]
			else:
				continue
			mat.roughness = 0.85
			n.material_override = mat

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
