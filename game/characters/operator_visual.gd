class_name OperatorVisual
extends Node3D

var operator_id: String = "BRAVO"
var team: String = "ally"
var accent: Color = Color("#ff9d50")
var model_root: Node3D
var idle_time: float = 0.0

func configure(id: String, team_id: String, color: Color) -> void:
	operator_id = id
	team = team_id
	accent = color
	_build()

func _process(delta: float) -> void:
	if model_root == null or not is_instance_valid(model_root):
		return
	idle_time += delta
	model_root.position.y = sin(idle_time * 1.8) * 0.018

func _build() -> void:
	for child: Node in get_children():
		child.queue_free()
	var model_path := _model_path(operator_id)
	var packed := load(model_path) as PackedScene
	if packed != null:
		model_root = packed.instantiate() as Node3D
		if model_root != null:
			add_child(model_root)
			model_root.scale = Vector3.ONE * 1.0
			_play_idle_animation(model_root)
			_add_team_marker()
			return
	_build_fallback()

func _model_path(id: String) -> String:
	return {
		"BRAVO": "res://assets/models/kenney_blocky/character-a.glb",
		"VULTURE": "res://assets/models/kenney_blocky/character-b.glb",
		"TALON": "res://assets/models/kenney_blocky/character-c.glb",
		"DUNE": "res://assets/models/kenney_blocky/character-d.glb",
		"HAVOC": "res://assets/models/kenney_blocky/character-e.glb"
	}.get(id, "res://assets/models/kenney_blocky/character-a.glb")

func _add_team_marker() -> void:
	var marker := MeshInstance3D.new()
	marker.name = "TeamMarker"
	var mesh := TorusMesh.new()
	mesh.inner_radius = 0.12
	mesh.outer_radius = 0.16
	marker.mesh = mesh
	marker.position = Vector3(0, 2.35, 0)
	marker.material_override = _material(accent)
	add_child(marker)

func _build_fallback() -> void:
	var body := MeshInstance3D.new()
	var capsule := CapsuleMesh.new()
	capsule.height = 1.45
	capsule.radius = 0.34
	body.mesh = capsule
	body.position.y = 1.0
	body.material_override = _material(accent.darkened(0.18))
	add_child(body)
	var head := MeshInstance3D.new()
	var head_mesh := SphereMesh.new()
	head_mesh.height = 0.55
	head_mesh.radius = 0.3
	head.mesh = head_mesh
	head.position.y = 1.95
	head.material_override = _material(Color("#d4a27f"))
	add_child(head)
	var visor := MeshInstance3D.new()
	var visor_mesh := BoxMesh.new()
	visor_mesh.size = Vector3(0.34, 0.09, 0.05)
	visor.mesh = visor_mesh
	visor.position = Vector3(0, 2.02, -0.28)
	visor.material_override = _material(Color("#5ce8ff"))
	add_child(visor)
	var shoulder := MeshInstance3D.new()
	var shoulder_mesh := BoxMesh.new()
	shoulder_mesh.size = Vector3(0.86, 0.18, 0.32)
	shoulder.mesh = shoulder_mesh
	shoulder.position.y = 1.5
	shoulder.material_override = _material(accent.lightened(0.1))
	add_child(shoulder)

func _play_idle_animation(root: Node) -> void:
	for candidate: Node in root.find_children("*", "AnimationPlayer", true, false):
		var animation_player := candidate as AnimationPlayer
		if animation_player == null:
			continue
		var chosen: StringName = &""
		for animation_name: StringName in animation_player.get_animation_list():
			var normalized := String(animation_name).to_lower()
			if normalized.contains("idle"):
				chosen = animation_name
				break
		if chosen == &"":
			for animation_name: StringName in animation_player.get_animation_list():
				if String(animation_name).to_lower() not in ["reset", "rest"]:
					chosen = animation_name
					break
		if chosen != &"":
			animation_player.play(chosen)
			return

func _material(color: Color) -> StandardMaterial3D:
	var material := StandardMaterial3D.new()
	material.albedo_color = color
	material.roughness = 0.72
	return material
