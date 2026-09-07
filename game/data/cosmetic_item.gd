class_name CosmeticItem
extends Resource

## Ropa/accesorio cosmético del avatar (sin stats). El catálogo vive en
## CosmeticCatalog y describe prendas del rig modular Quaternius
## Ultimate Modular Characters (CC0) más accesorios rígidos.
## - SLOT top/bottom/shoes: meshes deformables del MISMO skeleton; se activan
##   por visibilidad (nunca mezclar dos tops a la vez).
## - SLOT headwear/eyewear/mask: accesorio rígido anclado con BoneAttachment3D.
## - skin_tone y hair alteran materiales del mesh base.

@export var id: String = ""
@export var slot: String = "top"  # headwear/eyewear/mask/top/bottom/shoes/hair
@export var display_name: String = ""

## Prenda deformable: nombre del MeshInstance3D dentro del rig modular.
@export var mesh_node: String = ""

## Material fallback para accesorios rígidos construidos con primitivas.
@export var color: Color = Color("#5a6470")

## Ajustes de colocación del accesorio rígido (espacio del hueso).
@export var attachment_bone: String = "Head"
@export var attachment_offset: Vector3 = Vector3.ZERO
@export var attachment_rotation_deg: Vector3 = Vector3.ZERO
@export var attachment_scale: float = 1.0

## Tinte de piel (solo slot skin) o material a teñir dentro de la prenda.
@export var is_skin_tone: bool = false
@export var tint_targets: PackedStringArray = PackedStringArray()


static func make(item_id: String, item_slot: String, item_name: String) -> CosmeticItem:
	var item := CosmeticItem.new()
	item.id = item_id
	item.slot = item_slot
	item.display_name = item_name
	return item
