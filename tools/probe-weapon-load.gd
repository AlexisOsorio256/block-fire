extends SceneTree
## Diagnóstico de modelos de arma (no forma parte del runtime).
##
## Responde a dos preguntas que hoy sólo se ven en pantalla o en un warning
## perdido de consola:
##   1. ¿el GLB del arma carga con geometría y texturas, o queda a 0 superficies?
##      El import de Godot extrae texturas de un GLB a ficheros junto al modelo;
##      sin esa metadata el arma carga vacía y el jugador se queda sin modelo.
##   2. ¿el modelo llega al montaje de la mano con geometría visible?
##
## USO:
##   godot --headless --path . --script res://tools/probe-weapon-load.gd

func _init() -> void:
	_weapon_files()
	_weapon_in_hand()
	quit()

func _weapon_files() -> void:
	for id: String in OperatorVisual.WEAPON_CONFIG:
		var path: String = str(OperatorVisual.WEAPON_CONFIG[id].get("path", ""))
		var packed := load(path) as PackedScene if ResourceLoader.exists(path) else null
		var model := packed.instantiate() if packed != null else null
		var surfaces := 0
		var flat: Array[String] = []
		if model != null:
			for candidate: Node in model.find_children("*", "MeshInstance3D", true, false):
				var mesh_instance := candidate as MeshInstance3D
				if mesh_instance == null or mesh_instance.mesh == null:
					continue
				for surface in range(mesh_instance.mesh.get_surface_count()):
					surfaces += 1
					var material := mesh_instance.get_active_material(surface) as StandardMaterial3D
					if material == null or material.albedo_texture == null:
						flat.append("%s/%s" % [
							mesh_instance.name,
							material.resource_name if material != null else "<null>"])
			model.free()
		print("WEAPON %-8s %-52s surfaces=%2d flat_materials=%d %s" % [
			id, path, surfaces, flat.size(),
			"" if flat.is_empty() else str(flat)])

func _weapon_in_hand() -> void:
	var actor := Node3D.new()
	get_root().add_child(actor)
	var visual := OperatorVisual.new()
	actor.add_child(visual)
	visual._build()
	if visual.weapon_mount == null:
		print("HAND no weapon mount on the actor")
		visual.free()
		actor.free()
		return
	for id: String in OperatorVisual.WEAPON_IDS:
		visual.set_equipped_weapon(id)
		var meshes := 0
		for candidate: Node in visual.weapon_mount.find_children("*", "MeshInstance3D", true, false):
			var mesh_instance := candidate as MeshInstance3D
			if mesh_instance != null and mesh_instance.mesh != null and mesh_instance.is_visible_in_tree():
				meshes += 1
		var target: float = float(OperatorVisual.WEAPON_CONFIG[id].get("length", 0.0))
		print("HAND %-8s mounted_meshes=%2d target_length=%.2f muzzle=%s" % [
			id, meshes, target, str(visual.get_muzzle_global_position()).pad_decimals(3)])
	visual.free()
	actor.free()
