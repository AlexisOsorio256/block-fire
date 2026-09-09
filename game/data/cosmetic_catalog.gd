class_name CosmeticCatalog
extends RefCounted

## Única fuente de verdad del catálogo de cosméticos de avatar.
## Cada prenda es un MeshInstance3D real del rig modular Quaternius
## Ultimate Modular Males (CC0): cambiar de prenda cambia GEOMETRÍA, no un
## tinte. El nombre de cada item describe la prenda que realmente se ve.
## Slots deformables: top / bottom / shoes / head (un módulo visible por slot).
## Accesorios rígidos: headwear / eyewear / mask (malla dedicada anclada al
## hueso Head). skin tiñe los materiales "Skin" del pack.

## Módulos disponibles por slot (nombres exactos dentro de avatar_rig.gltf).
const SLOT_MODULES := {
	"top": ["Casual2_Body", "Casual_Body", "Suit_Body", "Swat_Body", "Punk_Body", "Worker_Body",
		"Farmer_Body", "Adventurer_Body"],
	"bottom": ["Casual2_Legs", "Casual_Legs", "Suit_Legs", "Swat_Legs", "Punk_Legs", "Worker_Legs",
		"Farmer_Pants", "Adventurer_Legs"],
	"shoes": ["Casual2_Feet", "Casual_Feet", "Suit_Feet", "Swat_Feet", "Punk_Feet", "Worker_Feet",
		"Farmer_Feet", "Adventurer_Feet"],
	"head": ["Casual2_Head", "Suit_Head", "Punk_Head", "Swat_Head", "Worker_Head", "Farmer_Head",
		"Adventurer_Head", "Casual_Head"],
}

## (id, slot, etiqueta, módulo del rig). La etiqueta nombra la prenda real.
const GARMENTS := [
	["top_tee", "top", "Camiseta", "Casual2_Body"],
	["top_hoodie", "top", "Sudadera", "Casual_Body"],
	["top_jacket", "top", "Chaqueta", "Suit_Body"],
	["top_tactical", "top", "Chaleco táctico", "Swat_Body"],
	["top_vest", "top", "Chaleco", "Punk_Body"],
	["top_work", "top", "Camisa de trabajo", "Worker_Body"],
	["bottom_jeans", "bottom", "Vaqueros", "Casual2_Legs"],
	["bottom_ripped", "bottom", "Vaqueros rotos", "Casual_Legs"],
	["bottom_trousers", "bottom", "Pantalón de traje", "Suit_Legs"],
	["bottom_cargo", "bottom", "Cargo táctico", "Swat_Legs"],
	["bottom_boots_pants", "bottom", "Pantalón militar", "Punk_Legs"],
	["bottom_work", "bottom", "Pantalón de trabajo", "Worker_Legs"],
	["shoes_sneakers", "shoes", "Zapatillas", "Casual2_Feet"],
	["shoes_sneakers_white", "shoes", "Zapatillas blancas", "Casual_Feet"],
	["shoes_dress", "shoes", "Zapatos", "Suit_Feet"],
	["shoes_tactical", "shoes", "Botas tácticas", "Swat_Feet"],
	["shoes_high", "shoes", "Botas altas", "Punk_Feet"],
	["shoes_work", "shoes", "Botas de trabajo", "Worker_Feet"],
	["head_short", "head", "Pelo corto", "Casual2_Head"],
	["head_formal", "head", "Pelo formal", "Suit_Head"],
	["head_mohawk", "head", "Cresta", "Punk_Head"],
	["head_balaclava", "head", "Pasamontañas", "Swat_Head"],
	["head_hardhat", "head", "Casco de obra", "Worker_Head"],
	["head_farmer", "head", "Pelo de campo", "Farmer_Head"],
]


## Slot -> id -> CosmeticItem.
static func items() -> Dictionary:
	var result: Dictionary = {}
	for row: Array in GARMENTS:
		var item := CosmeticItem.make(row[0], row[1], row[2])
		item.mesh_node = row[3]
		result[item.slot + ":" + item.id] = item

	# --- Accesorios rígidos (malla dedicada anclada al hueso Head). ---
	var shades := CosmeticItem.make("eyewear_shades", "eyewear", "Gafas de sol")
	shades.color = Color("#1c2026")
	var glasses := CosmeticItem.make("eyewear_glasses", "eyewear", "Gafas claras")
	glasses.color = Color("#cfe8ef")
	var mask := CosmeticItem.make("mask_bandana", "mask", "Bandana")
	mask.color = Color("#3a4148")
	var mask_dark := CosmeticItem.make("mask_dark", "mask", "Máscara urbana")
	mask_dark.color = Color("#23262e")
	var cap := CosmeticItem.make("headwear_cap", "headwear", "Gorra urbana")
	cap.color = Color("#46536b")
	var beret := CosmeticItem.make("headwear_beret", "headwear", "Boina")
	beret.color = Color("#5d6b46")
	for accessory: CosmeticItem in [shades, glasses, mask, mask_dark, cap, beret]:
		result[accessory.slot + ":" + accessory.id] = accessory

	# --- Tonos de piel (tiñen los materiales "Skin" del pack). ---
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
	var all := items()
	for key: String in all:
		var item: CosmeticItem = all[key]
		if not result.has(item.slot):
			result[item.slot] = []
		(result[item.slot] as Array).append(item)
	return result


static func default_loadout() -> Dictionary:
	## Táctico-casual urbano: chaleco táctico, vaqueros, botas, pelo corto.
	return {
		"head": "head_short",
		"headwear": "",
		"eyewear": "",
		"mask": "",
		"top": "top_tactical",
		"bottom": "bottom_jeans",
		"shoes": "shoes_tactical",
		"skin": "skin_light"
	}


static func item_for(slot: String, item_id: String) -> CosmeticItem:
	if item_id.is_empty():
		return null
	return items().get(slot + ":" + item_id)


static func bot_loadout_for(operator_id: String, role_id: String, seed_value: int) -> Dictionary:
	## Los bots visten combinaciones reales y reproducibles por semilla.
	var rng := RandomNumberGenerator.new()
	rng.seed = seed_value
	var loadout := default_loadout()
	var outfits: Array[Dictionary] = [
		{"top": "top_tactical", "bottom": "bottom_cargo", "shoes": "shoes_tactical", "heads": ["head_balaclava", "head_short"]},
		{"top": "top_tee", "bottom": "bottom_jeans", "shoes": "shoes_sneakers", "heads": ["head_short", "head_formal"]},
		{"top": "top_hoodie", "bottom": "bottom_ripped", "shoes": "shoes_sneakers_white", "heads": ["head_short", "head_mohawk"]},
		{"top": "top_vest", "bottom": "bottom_boots_pants", "shoes": "shoes_high", "heads": ["head_mohawk", "head_short"]},
		{"top": "top_jacket", "bottom": "bottom_trousers", "shoes": "shoes_dress", "heads": ["head_formal"]},
		{"top": "top_work", "bottom": "bottom_work", "shoes": "shoes_work", "heads": ["head_hardhat", "head_short"]},
	]
	var outfit: Dictionary = outfits[rng.randi() % outfits.size()]
	loadout["top"] = outfit["top"]
	loadout["bottom"] = outfit["bottom"]
	loadout["shoes"] = outfit["shoes"]
	var heads: Array = outfit["heads"]
	loadout["head"] = heads[rng.randi() % heads.size()]
	if rng.randf() < 0.35:
		loadout["headwear"] = "headwear_cap" if rng.randf() < 0.6 else "headwear_beret"
	if rng.randf() < 0.3:
		loadout["mask"] = "mask_bandana" if rng.randf() < 0.5 else "mask_dark"
	if rng.randf() < 0.25:
		loadout["eyewear"] = "eyewear_shades"
	var skins := ["skin_light", "skin_medium", "skin_tan", "skin_dark"]
	loadout["skin"] = skins[rng.randi() % skins.size()]
	return loadout
