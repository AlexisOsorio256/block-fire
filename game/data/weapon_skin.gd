class_name WeaponSkin
extends RefCounted

## Única fuente de verdad del tintado cosmético de armas.
## El lobby (preview) y el gameplay (viewmodel) comparten esta función.

const TINTS: Dictionary = {
	"Estándar": Color.WHITE,
	"Oro": Color("#e4bd62"),
	"Bosque": Color("#78a77d"),
	"Hielo": Color("#82bfe2"),
	"Carbón": Color("#777d91")
}

static func tint_for(skin: String) -> Color:
	return TINTS.get(skin, Color.WHITE)

static func apply(root: Node, skin: String) -> void:
	var tint := tint_for(skin)
	if tint.is_equal_approx(Color.WHITE) or root == null or not is_instance_valid(root):
		return
	for candidate: Node in root.find_children("*", "MeshInstance3D", true, false):
		var mesh_instance := candidate as MeshInstance3D
		if mesh_instance == null or mesh_instance.mesh == null:
			continue
		for surface_index: int in range(mesh_instance.mesh.get_surface_count()):
			var source := mesh_instance.get_active_material(surface_index)
			if source is StandardMaterial3D:
				var material := source.duplicate() as StandardMaterial3D
				material.albedo_color = Color(
					material.albedo_color.r * tint.r,
					material.albedo_color.g * tint.g,
					material.albedo_color.b * tint.b,
					material.albedo_color.a
				)
				mesh_instance.set_surface_override_material(surface_index, material)
