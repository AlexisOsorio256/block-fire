class_name WorldGrain
extends RefCounted
## Grano procedural de las superficies del mundo (muros, cajas, suelo).
##
## Vive aquí y no en `arena.gd` porque el lobby pinta props con el mismo
## lenguaje visual: sin grano, una caja de 6 m es una cara plana de color y se
## lee como geometría sin textura. Es la MISMA imagen para todos los dueños
## (semilla fija y caché estática), no una copia por escena.

const SIZE := 64
const SEED := 9911

static var _cached: ImageTexture


static func texture() -> Texture2D:
	if _cached != null:
		return _cached
	var image := Image.create(SIZE, SIZE, false, Image.FORMAT_RGB8)
	var rng := RandomNumberGenerator.new()
	rng.seed = SEED
	for y in range(SIZE):
		for x in range(SIZE):
			var value := 0.82 + rng.randf_range(-0.10, 0.14)
			image.set_pixel(x, y, Color(value, value, value))
	_cached = ImageTexture.create_from_image(image)
	return _cached


## Material de mundo: color plano más el grano multiplicado. `uv1_scale` fija
## cada cuántas caras repite el grano; las superficies grandes piden un valor
## mayor para que la mancha no se estire.
static func material(color: Color, uv1_scale: float = 3.0, roughness: float = 0.84) -> StandardMaterial3D:
	var material := StandardMaterial3D.new()
	material.albedo_color = color
	material.roughness = roughness
	material.detail_enabled = true
	material.detail_albedo = texture()
	material.detail_blend_mode = BaseMaterial3D.BLEND_MODE_MUL
	material.uv1_scale = Vector3(uv1_scale, uv1_scale, 1.0)
	return material
