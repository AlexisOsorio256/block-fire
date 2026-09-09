class_name CosmeticCatalog
extends RefCounted

## Única fuente de verdad del catálogo de cosméticos de avatar.
## Prendas deformables = nombres de MeshInstance3D del rig modular
## assets/models/quaternius_modular/avatar_rig.gltf (Quaternius Ultimate
## Modular Characters, CC0): todos comparten CharacterArmature/Skeleton3D y
## se activan por visibilidad (un top, un bottom, unos shoes, una head).
## Accesorios rígidos conservan esta API y se dibujan con mallas dedicadas en
## OperatorVisual, siempre sujetos a BoneAttachment3D.

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

## Paleta por familia y prenda (tinte por superficie sobre el rig Toon
## Shooter: Character_Main/Enemy_Red=camisa y casco, Pants=pantalón,
## Black=botas). La familia swat conserva los colores stock del pack
## (oliva/khaki); el resto son familias urbanas táctico-casuales.
const FAMILY_COLORS := {
	"swat": {"top": Color("#667a3d"), "bottom": Color("#a88f39"), "shoes": Color("#23262b"), "head": Color("#667a3d")},
	"casual": {"top": Color("#756184"), "bottom": Color("#8b7f9b"), "shoes": Color("#2e2a35"), "head": Color("#756184")},
	"worker": {"top": Color("#ba7e42"), "bottom": Color("#8a6a3c"), "shoes": Color("#3a2f24"), "head": Color("#ba7e42")},
	"suit": {"top": Color("#50658a"), "bottom": Color("#3a4a68"), "shoes": Color("#232c3d"), "head": Color("#50658a")},
	"punk": {"top": Color("#8f4b5f"), "bottom": Color("#5c3a44"), "shoes": Color("#26201f"), "head": Color("#8f4b5f")},
	"farmer": {"top": Color("#7d6b3a"), "bottom": Color("#5d5a33"), "shoes": Color("#33291c"), "head": Color("#7d6b3a")},
	"scifi": {"top": Color("#4a7da5"), "bottom": Color("#3a6285"), "shoes": Color("#1f2b38"), "head": Color("#4a7da5")}
}

## Item de prenda con color de familia explícito y su malla del rig modular
## UMC (el fallback sigue vistiendo geometría real si el Toon no carga).
static func _garment(id: String, slot: String, label: String, family: String, mesh_node: String) -> CosmeticItem:
	var item := CosmeticItem.make(id, slot, label)
	var family_colors: Dictionary = FAMILY_COLORS.get(family, {})
	item.color = family_colors.get(slot, Color.WHITE) if slot != "head" else family_colors.get("head", Color.WHITE)
	item.mesh_node = mesh_node
	return item

## Slot -> id -> CosmeticItem.
static func items() -> Dictionary:
	var result: Dictionary = {}

	# --- Prendas: familias de color táctico-casual. En el rig Toon el cambio
	# es real por superficie (camisa/pantalón/botas) y el nombre promete
	# exactamente eso: color de esa prenda, no una silueta que no existe. ---
	var all_items: Array[CosmeticItem] = [
		_garment("top_swat", "top", "Oliva", "swat", "Swat_Body"),
		_garment("top_casual", "top", "Violeta", "casual", "Casual_Body"),
		_garment("top_worker", "top", "Ámbar", "worker", "Worker_Body"),
		_garment("top_suit", "top", "Azul marino", "suit", "Suit_Body"),
		_garment("top_punk", "top", "Granate", "punk", "Punk_Body"),
		_garment("top_farmer", "top", "Caqui", "farmer", "Farmer_Body"),
		_garment("top_scifi", "top", "Azul hielo", "scifi", "SpaceSuit_Body"),
		_garment("bottom_swat", "bottom", "Khaki", "swat", "Swat_Legs"),
		_garment("bottom_casual", "bottom", "Lila", "casual", "Casual_Legs"),
		_garment("bottom_worker", "bottom", "Ámbar", "worker", "Worker_Legs"),
		_garment("bottom_suit", "bottom", "Azul marino", "suit", "Suit_Legs"),
		_garment("bottom_punk", "bottom", "Granate", "punk", "Punk_Legs"),
		_garment("bottom_farmer", "bottom", "Oliva", "farmer", "Farmer_Pants"),
		_garment("bottom_scifi", "bottom", "Azul hielo", "scifi", "SpaceSuit_Legs"),
		_garment("shoes_swat", "shoes", "Carbón", "swat", "Swat_Feet"),
		_garment("shoes_casual", "shoes", "Lila", "casual", "Casual_Feet"),
		_garment("shoes_worker", "shoes", "Ámbar", "worker", "Worker_Feet"),
		_garment("shoes_suit", "shoes", "Azul marino", "suit", "Suit_Feet"),
		_garment("shoes_punk", "shoes", "Granate", "punk", "Punk_Feet"),
		_garment("shoes_farmer", "shoes", "Oliva", "farmer", "Farmer_Feet"),
		_garment("shoes_scifi", "shoes", "Azul hielo", "scifi", "SpaceSuit_Feet")
	]
	for item: CosmeticItem in all_items:
		result[item.slot + ":" + item.id] = item

	# Cabezas: en el rig Toon la cabeza es un casco de una pieza; el slot
	# cambia el color del casco (geometría única). Nombres de casco, no de peinados.
	var head_meshes: Dictionary = {
		"head_swat": "Swat_Head", "head_casual": "Casual_Head", "head_casual2": "Casual2_Head",
		"head_worker": "Worker_Head", "head_punk": "Punk_Head", "head_farmer": "Farmer_Head"
	}
	for head_pair: Array in [["head_swat", "Casco táctico oliva", "swat"],
			["head_casual", "Casco violeta", "casual"],
			["head_casual2", "Casco violeta claro", "casual"],
			["head_worker", "Casco ámbar", "worker"],
			["head_punk", "Casco granate", "punk"],
			["head_farmer", "Casco caqui", "farmer"]]:
		var head := CosmeticItem.make(head_pair[0], "head", head_pair[1])
		var family_colors: Dictionary = FAMILY_COLORS.get(head_pair[2], {})
		head.color = family_colors.get("head", Color("#667a3d"))
		head.mesh_node = head_meshes.get(head_pair[0], "")
		result["head:" + head.id] = head

	# --- Accesorios rígidos (malla dedicada con BoneAttachment3D). ---
	# Offsets en espacio del hueso de la cabeza (rostro +Z; centro de la cabeza
	# ~+0.35 sobre el hueso y corona ~+0.70 tras el reasentado del visual).
	var shades := CosmeticItem.make("eyewear_shades", "eyewear", "Gafas de sol")
	shades.attachment_bone = "Head"
	shades.attachment_offset = Vector3(0.0, 0.40, 0.62)
	shades.attachment_scale = 2.1
	shades.color = Color("#1c2026")

	var glasses := CosmeticItem.make("eyewear_glasses", "eyewear", "Gafas claras")
	glasses.attachment_bone = "Head"
	glasses.attachment_offset = Vector3(0.0, 0.40, 0.62)
	glasses.attachment_scale = 2.1
	glasses.color = Color("#cfe8ef")

	var mask := CosmeticItem.make("mask_bandana", "mask", "Bandana")
	mask.attachment_bone = "Head"
	mask.attachment_offset = Vector3(0.0, 0.18, 0.48)
	mask.attachment_scale = 2.2
	mask.color = Color("#3a4148")

	var mask_dark := CosmeticItem.make("mask_dark", "mask", "Máscara urbana")
	mask_dark.attachment_bone = "Head"
	mask_dark.attachment_offset = Vector3(0.0, 0.18, 0.48)
	mask_dark.attachment_scale = 2.2
	mask_dark.color = Color("#23262e")

	var cap := CosmeticItem.make("headwear_cap", "headwear", "Gorra urbana")
	cap.attachment_bone = "Head"
	# Recalibrado para HEAD_SCALE 0.45: con la escala antigua la gorra flotaba
	# sobre el casco como una vela.
	cap.attachment_offset = Vector3(0.0, 0.46, 0.01)
	cap.attachment_rotation_deg = Vector3(-12.0, 0.0, 0.0)
	cap.attachment_scale = 1.65
	cap.color = Color("#46536b")

	var beret := CosmeticItem.make("headwear_beret", "headwear", "Boina")
	beret.attachment_bone = "Head"
	beret.attachment_offset = Vector3(0.015, 0.47, 0.0)
	beret.attachment_rotation_deg = Vector3(0.0, 0.0, -9.0)
	beret.attachment_scale = 1.65
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
	## Los bots visten una familia completa para que la variación no mezcle
	## prendas incompatibles. Se mantiene la semilla para que cada bot sea
	## reproducible y se priorizan siluetas urbanas/táctico-casuales.
	var rng := RandomNumberGenerator.new()
	rng.seed = seed_value
	var loadout := default_loadout()
	var families: Array[Dictionary] = [
		{"top": "top_swat", "bottom": "bottom_swat", "shoes": "shoes_swat", "heads": ["head_swat", "head_casual"]},
		{"top": "top_casual", "bottom": "bottom_casual", "shoes": "shoes_casual", "heads": ["head_casual", "head_casual2"]},
		{"top": "top_worker", "bottom": "bottom_worker", "shoes": "shoes_worker", "heads": ["head_worker", "head_casual"]},
		{"top": "top_punk", "bottom": "bottom_punk", "shoes": "shoes_punk", "heads": ["head_punk", "head_casual2"]},
		{"top": "top_suit", "bottom": "bottom_suit", "shoes": "shoes_suit", "heads": ["head_swat", "head_casual", "head_casual2"]},
	]
	var family: Dictionary = families[rng.randi() % families.size()]
	loadout["top"] = family["top"]
	loadout["bottom"] = family["bottom"]
	loadout["shoes"] = family["shoes"]
	var heads: Array = family["heads"]
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
