class_name CosmeticCatalog
extends RefCounted

## Única fuente de verdad del catálogo de cosméticos de avatar.
## Prendas deformables = nombres de MeshInstance3D del rig modular
## assets/models/quaternius_modular/avatar_rig.gltf (Quaternius Ultimate
## Modular Characters, CC0): todos comparten CharacterArmature/Skeleton3D y
## se activan por visibilidad (un top, un bottom, unos shoes, una head).
## Accesorios rígidos = primitivas con BoneAttachment3D (gafas/máscara/gorra
## ligera) hasta integrar mallas dedicadas (deuda P2).

const OUTFIT_SWAT := "swat"
const OUTFIT_CASUAL := "casual"
const OUTFIT_WORKER := "worker"
const OUTFIT_SUIT := "suit"
const OUTFIT_PUNK := "punk"
const OUTFIT_FARMER := "farmer"
const OUTFIT_SPACESUIT := "spacesuit"
const OUTFIT_KING := "king"
const OUTFIT_BEACH := "beach"
const OUTFIT_ADVENTURER := "adventurer"
const OUTFIT_CASUAL2 := "casual2"

## Slot -> id -> CosmeticItem.
static func items() -> Dictionary:
	var result: Dictionary = {}

	# --- Outfits (top+bottom+shoes se eligen por pieza individual,
	# normalmente del mismo outfit para evitar mezclas incoherentes). ---
	var swat_top := CosmeticItem.make("top_swat", "top", "Chaleco táctico")
	swat_top.mesh_node = "Swat_Body"
	var swat_bottom := CosmeticItem.make("bottom_swat", "bottom", "Pantalón táctico")
	swat_bottom.mesh_node = "Swat_Legs"
	var swat_shoes := CosmeticItem.make("shoes_swat", "shoes", "Botas tácticas")
	swat_shoes.mesh_node = "Swat_Feet"

	var casual_top := CosmeticItem.make("top_casual", "top", "Sudadera violeta")
	casual_top.mesh_node = "Casual_Body"
	var casual_bottom := CosmeticItem.make("bottom_casual", "bottom", "Vaqueros")
	casual_bottom.mesh_node = "Casual_Legs"
	var casual_shoes := CosmeticItem.make("shoes_casual", "shoes", "Zapatillas casual")
	casual_shoes.mesh_node = "Casual_Feet"

	var worker_top := CosmeticItem.make("top_worker", "top", "Chaleco de obra")
	worker_top.mesh_node = "Worker_Body"
	var worker_bottom := CosmeticItem.make("bottom_worker", "bottom", "Pantalón marrón")
	worker_bottom.mesh_node = "Worker_Legs"
	var worker_shoes := CosmeticItem.make("shoes_worker", "shoes", "Botas de obra")
	worker_shoes.mesh_node = "Worker_Feet"

	var suit_top := CosmeticItem.make("top_suit", "top", "Traje formal")
	suit_top.mesh_node = "Suit_Body"
	var suit_bottom := CosmeticItem.make("bottom_suit", "bottom", "Pantalón de traje")
	suit_bottom.mesh_node = "Suit_Legs"
	var suit_shoes := CosmeticItem.make("shoes_suit", "shoes", "Zapatos de vestir")
	suit_shoes.mesh_node = "Suit_Feet"

	var punk_top := CosmeticItem.make("top_punk", "top", "Chaqueta punk")
	punk_top.mesh_node = "Punk_Body"
	var punk_bottom := CosmeticItem.make("bottom_punk", "bottom", "Pantalón callejero")
	punk_bottom.mesh_node = "Punk_Legs"
	var punk_shoes := CosmeticItem.make("shoes_punk", "shoes", "Botas negras")
	punk_shoes.mesh_node = "Punk_Feet"

	var farmer_top := CosmeticItem.make("top_farmer", "top", "Camisa del campo")
	farmer_top.mesh_node = "Farmer_Body"
	var farmer_bottom := CosmeticItem.make("bottom_farmer", "bottom", "Pantalón de faena")
	farmer_bottom.mesh_node = "Farmer_Pants"
	var farmer_shoes := CosmeticItem.make("shoes_farmer", "shoes", "Botas de campo")
	farmer_shoes.mesh_node = "Farmer_Feet"

	var scifi_top := CosmeticItem.make("top_scifi", "top", "Traje de vacío")
	scifi_top.mesh_node = "SpaceSuit_Body"
	var scifi_bottom := CosmeticItem.make("bottom_scifi", "bottom", "Pernera de vacío")
	scifi_bottom.mesh_node = "SpaceSuit_Legs"
	var scifi_shoes := CosmeticItem.make("shoes_scifi", "shoes", "Botas de vacío")
	scifi_shoes.mesh_node = "SpaceSuit_Feet"

	var all_items: Array[CosmeticItem] = [swat_top, casual_top, worker_top, suit_top, punk_top, farmer_top,
			scifi_top, swat_bottom, casual_bottom, worker_bottom, suit_bottom, punk_bottom, farmer_bottom,
			swat_shoes, casual_shoes, worker_shoes, suit_shoes, punk_shoes, farmer_shoes, scifi_shoes]
	for item: CosmeticItem in all_items:
		result[item.slot + ":" + item.id] = item

	# Cabezas: cada outfit incluye su cabeza (cara+pelo). La base es Swat_Head
	# (corto, militar) y se puede cambiar de look.
	for head_pair: Array in [["head_swat", "Swat_Head", "Cabeza rapada táctica"],
			["head_casual", "Casual_Head", "Pelo corto castaño"],
			["head_casual2", "Casual2_Head", "Melena clara"],
			["head_worker", "Worker_Head", "Bigote de obra"],
			["head_punk", "Punk_Head", "Cresta punk"],
			["head_farmer", "Farmer_Head", "Gorra de campo"]]:
		var head := CosmeticItem.make(head_pair[0], "head", head_pair[2])
		head.mesh_node = head_pair[1]
		result["head:" + head.id] = head

	# --- Accesorios rígidos (primitivas con BoneAttachment3D). ---
	var shades := CosmeticItem.make("eyewear_shades", "eyewear", "Gafas de sol")
	shades.attachment_bone = "Head"
	shades.attachment_offset = Vector3(0.0, 0.06, -0.075)
	shades.attachment_scale = 1.0
	shades.color = Color("#1c2026")

	var glasses := CosmeticItem.make("eyewear_glasses", "eyewear", "Gafas claras")
	glasses.attachment_bone = "Head"
	glasses.attachment_offset = Vector3(0.0, 0.06, -0.075)
	glasses.color = Color("#cfe8ef")

	var mask := CosmeticItem.make("mask_bandana", "mask", "Bandana")
	mask.attachment_bone = "Head"
	mask.attachment_offset = Vector3(0.0, -0.045, -0.055)
	mask.attachment_scale = 1.0
	mask.color = Color("#3a4148")

	var mask_dark := CosmeticItem.make("mask_dark", "mask", "Máscara urbana")
	mask_dark.attachment_bone = "Head"
	mask_dark.attachment_offset = Vector3(0.0, -0.045, -0.055)
	mask_dark.color = Color("#23262e")

	var cap := CosmeticItem.make("headwear_cap", "headwear", "Gorra urbana")
	cap.attachment_bone = "Head"
	cap.attachment_offset = Vector3(0.0, 0.115, -0.01)
	cap.attachment_rotation_deg = Vector3(-12.0, 0.0, 0.0)
	cap.color = Color("#46536b")

	var beret := CosmeticItem.make("headwear_beret", "headwear", "Boina")
	beret.attachment_bone = "Head"
	beret.attachment_offset = Vector3(0.015, 0.125, 0.0)
	beret.attachment_rotation_deg = Vector3(0.0, 0.0, -9.0)
	beret.color = Color("#5d6b46")

	for accessory: CosmeticItem in [shades, glasses, mask, mask_dark, cap, beret]:
		result[accessory.slot + ":" + accessory.id] = accessory

	# --- Tonos de piel. ---
	var tones: Array = [["skin_light", "Claro", Color("#e8b48c")],
			["skin_medium", "Medio", Color("#c98f63")],
			["skin_tan", "Moreno", Color("#a5714b")],
			["skin_dark", "Oscuro", Color("#7a4f33")]]
	for tone: Array in tones:
		var item := CosmeticItem.make(tone[0], "skin", tone[1])
		item.is_skin_tone = true
		item.color = tone[2]
		result["skin:" + item.id] = item

	return result


## Aplanado por slot: slot -> Array[CosmeticItem]
static func items_by_slot() -> Dictionary:
	var result: Dictionary = {}
	for key: String in items():
		var item: CosmeticItem = items()[key]
		if not result.has(item.slot):
			result[item.slot] = []
		(result[item.slot] as Array).append(item)
	return result


static func default_loadout() -> Dictionary:
	return {
		"head": "head_swat",
		"headwear": "",
		"eyewear": "",
		"mask": "",
		"top": "top_swat",
		"bottom": "bottom_swat",
		"shoes": "shoes_swat",
		"skin": "skin_light"
	}


static func item_for(slot: String, item_id: String) -> CosmeticItem:
	if item_id.is_empty():
		return null
	return items().get(slot + ":" + item_id)


static func bot_loadout_for(operator_id: String, role_id: String, seed_value: int) -> Dictionary:
	## Los bots visten del mismo catálogo con variaciones deterministas y un
	## tronco de equipo: chaleco SWAT como top base teñido con el accent.
	var rng := RandomNumberGenerator.new()
	rng.seed = seed_value
	var loadout := default_loadout()
	var tops := ["top_swat", "top_worker", "top_punk", "top_farmer", "top_casual", "top_scifi"]
	var bottoms := ["bottom_swat", "bottom_worker", "bottom_punk", "bottom_farmer", "bottom_casual", "bottom_scifi"]
	var shoes := ["shoes_swat", "shoes_worker", "shoes_punk", "shoes_farmer", "shoes_casual", "shoes_scifi"]
	loadout["top"] = tops[rng.randi() % tops.size()]
	loadout["bottom"] = bottoms[rng.randi() % bottoms.size()]
	loadout["shoes"] = shoes[rng.randi() % shoes.size()]
	var heads := ["head_swat", "head_casual", "head_worker", "head_punk", "head_farmer", "head_casual2"]
	loadout["head"] = heads[rng.randi() % heads.size()]
	if rng.randf() < 0.4:
		loadout["headwear"] = "headwear_cap" if rng.randf() < 0.6 else "headwear_beret"
	if rng.randf() < 0.35:
		loadout["mask"] = "mask_bandana" if rng.randf() < 0.5 else "mask_dark"
	if rng.randf() < 0.3:
		loadout["eyewear"] = "eyewear_shades"
	var skins := ["skin_light", "skin_medium", "skin_tan", "skin_dark"]
	loadout["skin"] = skins[rng.randi() % skins.size()]
	return loadout
