class_name OperatorWardrobe
extends RefCounted

## Dueño ÚNICO de la apariencia cosmética del personaje: qué módulo de
## geometría del pack se ve en cada slot, el tono de piel y los accesorios
## rígidos (gorra, boina, gafas, máscara).
##
## Frontera de dueños: aquí no hay pose ni gameplay. `OperatorBody` compone el
## hueso cada fotograma; `CharacterAsset` repara el asset; esto decide qué se
## dibuja. El estado del armario vive aquí (`modules`, `skin_materials`,
## `accessory_root`) y no en el actor: antes estaba repartido y leer
## `operator_visual.gd` no decía quién mandaba sobre la ropa.
##
## Todos los ids de prenda salen de `CosmeticCatalog`; este archivo no guarda
## listas propias de cosméticos a propósito (dos verdades divergen siempre).

var modules: Dictionary = {}
var skin_materials: Array[StandardMaterial3D] = []
var accessory_root: Node3D
## El actor se creó sin árbol (sin SettingsStore alcanzable): se vistió con el
## conjunto por defecto y hay que volver a resolver cuando entre al árbol.
var pending_default_loadout := false


## Indexa por slot los módulos de geometría que el pack trae en el GLB. El
## catálogo decide qué nombres existen; el asset sólo aporta los nodos.
func index_modules(character: Node) -> void:
	for slot: String in CosmeticCatalog.SLOT_MODULES:
		modules[slot] = {}
		for module_name: String in CosmeticCatalog.SLOT_MODULES[slot]:
			var mesh_instance := character.find_child(module_name, true, false) as MeshInstance3D
			if mesh_instance != null:
				modules[slot][module_name] = mesh_instance


## Módulos de geometría visibles ahora mismo.
func visible_modules() -> Array[MeshInstance3D]:
	var result: Array[MeshInstance3D] = []
	for slot: String in modules:
		for module_name: String in modules[slot]:
			var mesh_instance: MeshInstance3D = modules[slot][module_name]
			if mesh_instance.visible:
				result.append(mesh_instance)
	return result


## Activa exactamente una prenda por slot según el loadout. Es lo único que
## decide qué geometría se ve; sin item válido se usa el módulo por defecto
## del slot para que el personaje nunca quede desnudo ni invisible.
func apply(actor: OperatorVisual) -> void:
	if modules.is_empty():
		return
	# Un loadout vacío (lobby/humano) se resuelve contra SettingsStore o el
	# conjunto por defecto; nunca se deja al personaje con módulos al azar.
	if actor.loadout.is_empty():
		if actor.is_inside_tree():
			actor.loadout = actor.resolve_default_loadout()
		else:
			# Todavía sin árbol: se viste con el conjunto por defecto y se
			# vuelve a resolver en _ready() cuando SettingsStore es alcanzable.
			pending_default_loadout = true
			actor.loadout = CosmeticCatalog.default_loadout()
	for slot: String in CosmeticCatalog.SLOT_MODULES:
		var slot_modules: Dictionary = modules.get(slot, {})
		if slot_modules.is_empty():
			continue
		var wanted := _module_for_slot(actor, slot)
		if wanted.is_empty() or not slot_modules.has(wanted):
			wanted = _default_module_for_slot(slot, slot_modules)
		for module_name: String in slot_modules:
			(slot_modules[module_name] as MeshInstance3D).visible = module_name == wanted
	apply_skin_tone(actor)
	rebuild_accessories(actor)


func _module_for_slot(actor: OperatorVisual, slot: String) -> String:
	var item_id := str(actor.loadout.get(slot, ""))
	if item_id.is_empty():
		return ""
	var item := CosmeticCatalog.item_for(slot, item_id)
	return item.mesh_node if item != null else ""


func _default_module_for_slot(slot: String, slot_modules: Dictionary) -> String:
	match slot:
		"top": return "Casual2_Body" if slot_modules.has("Casual2_Body") else slot_modules.keys()[0]
		"bottom": return "Casual2_Legs" if slot_modules.has("Casual2_Legs") else slot_modules.keys()[0]
		"shoes": return "Casual2_Feet" if slot_modules.has("Casual2_Feet") else slot_modules.keys()[0]
		"head": return "Casual2_Head" if slot_modules.has("Casual2_Head") else slot_modules.keys()[0]
	return slot_modules.keys()[0]


## El tono de piel multiplica los materiales "Skin" del pack (compartidos por
## todos los módulos) sin tocar el resto de la prenda.
func apply_skin_tone(actor: OperatorVisual) -> void:
	var item_id := str(actor.loadout.get("skin", ""))
	if item_id.is_empty():
		return
	var item := CosmeticCatalog.item_for("skin", item_id)
	if item == null:
		return
	var target := item.color
	for mesh_instance: MeshInstance3D in visible_modules():
		var surface_count := mesh_instance.mesh.get_surface_count() if mesh_instance.mesh != null else 0
		for surface in range(surface_count):
			var material := mesh_instance.get_active_material(surface) as StandardMaterial3D
			if material == null:
				continue
			if not String(material.resource_name).begins_with("Skin"):
				continue
			var tinted := material.duplicate() as StandardMaterial3D
			tinted.albedo_color = tinted.albedo_color.lerp(target, 0.85)
			mesh_instance.set_surface_override_material(surface, tinted)
			skin_materials.append(tinted)


## Accesorios rígidos construidos como mallas low-poly coherentes con el pack y
## anclados al hueso Head.
func rebuild_accessories(actor: OperatorVisual) -> void:
	if accessory_root != null and is_instance_valid(accessory_root):
		accessory_root.queue_free()
	accessory_root = null
	if actor.skeleton == null:
		return
	if actor.skeleton.find_bone("Head") < 0:
		return
	var head_attachment := BoneAttachment3D.new()
	head_attachment.name = "HeadAccessories"
	head_attachment.bone_name = "Head"
	actor.skeleton.add_child(head_attachment)
	accessory_root = head_attachment
	if _loadout_has(actor, "headwear", "headwear_cap"):
		_add_cap(actor, head_attachment)
	elif _loadout_has(actor, "headwear", "headwear_beret"):
		_add_beret(actor, head_attachment)
	if not str(actor.loadout.get("mask", "")).is_empty():
		_add_mask(actor, head_attachment)
	if not str(actor.loadout.get("eyewear", "")).is_empty():
		_add_glasses(actor, head_attachment)


func _loadout_has(actor: OperatorVisual, slot: String, item_id: String) -> bool:
	return str(actor.loadout.get(slot, "")) == item_id


func _accessory_material(color: Color) -> StandardMaterial3D:
	var material := StandardMaterial3D.new()
	material.albedo_color = color
	material.roughness = 0.62
	return material


func _add_cap(actor: OperatorVisual, parent: Node3D) -> void:
	var item := CosmeticCatalog.item_for("headwear", "headwear_cap")
	var color := item.color if item != null else Color("#46536b")
	var cap := Node3D.new()
	cap.name = "Cap"
	var crown := MeshInstance3D.new()
	var sphere := SphereMesh.new()
	sphere.radius = 0.086
	sphere.height = 0.17
	sphere.is_hemisphere = true
	sphere.radial_segments = 14
	sphere.rings = 5
	crown.mesh = sphere
	crown.material_override = _accessory_material(color)
	crown.position = Vector3(0.0, 0.0, 0.0)
	cap.add_child(crown)
	var brim := MeshInstance3D.new()
	var brim_mesh := BoxMesh.new()
	brim_mesh.size = Vector3(0.168, 0.014, 0.098)
	brim.mesh = brim_mesh
	brim.material_override = _accessory_material(color.darkened(0.18))
	brim.position = Vector3(0.0, -0.010, 0.082)
	cap.add_child(brim)
	# El hueso Head nace en el cuello: la corona va ~0,20 m por encima.
	cap.position = Vector3(0.0, 0.192, 0.004)
	cap.rotation_degrees = Vector3(-9.0, 0.0, 0.0)
	parent.add_child(cap)


func _add_beret(actor: OperatorVisual, parent: Node3D) -> void:
	var item := CosmeticCatalog.item_for("headwear", "headwear_beret")
	var color := item.color if item != null else Color("#5d6b46")
	var beret := MeshInstance3D.new()
	beret.name = "Beret"
	var sphere := SphereMesh.new()
	sphere.radius = 0.082
	sphere.height = 0.09
	sphere.is_hemisphere = true
	sphere.radial_segments = 12
	sphere.rings = 3
	beret.mesh = sphere
	beret.material_override = _accessory_material(color)
	beret.position = Vector3(0.012, 0.186, 0.0)
	beret.rotation_degrees = Vector3(0.0, 0.0, -11.0)
	parent.add_child(beret)


func _add_mask(actor: OperatorVisual, parent: Node3D) -> void:
	var item := CosmeticCatalog.item_for("mask", str(actor.loadout.get("mask", "")))
	var color := item.color if item != null else Color("#23262e")
	var mask := MeshInstance3D.new()
	mask.name = "Mask"
	var sphere := SphereMesh.new()
	sphere.radius = 0.072
	sphere.height = 0.13
	sphere.radial_segments = 12
	sphere.rings = 5
	mask.mesh = sphere
	mask.material_override = _accessory_material(color)
	mask.scale = Vector3(0.90, 0.64, 0.94)
	mask.position = Vector3(0.0, 0.092, 0.058)
	parent.add_child(mask)


func _add_glasses(actor: OperatorVisual, parent: Node3D) -> void:
	var item := CosmeticCatalog.item_for("eyewear", str(actor.loadout.get("eyewear", "")))
	var color := item.color if item != null else Color("#1c2026")
	var glasses := Node3D.new()
	glasses.name = "Glasses"
	for side: float in [-1.0, 1.0]:
		var lens := MeshInstance3D.new()
		var lens_mesh := BoxMesh.new()
		lens_mesh.size = Vector3(0.045, 0.026, 0.012)
		lens.mesh = lens_mesh
		lens.material_override = _accessory_material(color)
		lens.position = Vector3(side * 0.034, 0.158, 0.106)
		glasses.add_child(lens)
	var bridge := MeshInstance3D.new()
	var bridge_mesh := BoxMesh.new()
	bridge_mesh.size = Vector3(0.028, 0.008, 0.010)
	bridge.mesh = bridge_mesh
	bridge.material_override = _accessory_material(color)
	bridge.position = Vector3(0.0, 0.158, 0.106)
	glasses.add_child(bridge)
	parent.add_child(glasses)
