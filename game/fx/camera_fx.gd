class_name CameraFX
extends Node

## Sacudida de cámara por trauma + golpe de FOV por disparo.
##
## Se aplica sobre `rotation`, `h_offset` y `v_offset` de la Camera3D: player.gd
## solo escribe el pivot (look) y `camera.position` (colisión/ADS), así que este
## nodo no pelea con ningún transform del jugador. `process_priority` alto lo
## hace correr después del lerp de FOV de ADS, y el offset se resta antes de
## volver a sumarse para no acumular sobre ese lerp.

const TRAUMA_DECAY := 2.4
const FOV_DECAY := 38.0
const MAX_YAW_DEG := 1.35
const MAX_PITCH_DEG := 0.95
const MAX_ROLL_DEG := 0.55
const MAX_SHIFT := 0.05

var camera: Camera3D
var trauma := 0.0
var fov_punch := 0.0
var _fov_applied := 0.0
var _time := 0.0


## Punto de entrada único para el jugador. Llamar UNA línea desde
## `player.gd::apply_weapon_recoil(amount, ads)`:
##
##     CameraFX.kick(self, amount, ads)
##
## Crea el nodo la primera vez, lo engancha al actor y alimenta trauma + FOV.
static func kick(actor: Node, amount: float, ads: bool) -> void:
	if actor == null or not is_instance_valid(actor):
		return
	var camera := actor.get("camera") as Camera3D
	var fx := actor.get_node_or_null("CameraFX") as CameraFX
	if fx == null:
		fx = CameraFX.new()
		fx.name = "CameraFX"
		actor.add_child(fx)
	fx.setup(camera)
	var fx_scale := 0.68 if ads else 1.0
	fx.add_trauma(clampf(amount * 7.0, 0.14, 0.55) * fx_scale)
	fx.punch_fov(clampf(rad_to_deg(amount) * 1.4, 0.45, 3.0) * fx_scale)


func _ready() -> void:
	process_priority = 100
	_time = randf() * 10.0


func setup(target: Camera3D) -> void:
	camera = target


## `amount` 0..1: se eleva al cuadrado al aplicarlo, así un disparo suelto
## apenas mueve y una ráfaga sostenida se siente progresiva.
func add_trauma(amount: float) -> void:
	trauma = clampf(trauma + amount, 0.0, 1.0)


func punch_fov(degrees: float) -> void:
	fov_punch = clampf(fov_punch + degrees, 0.0, 6.0)


## Player excludes this already-applied effect while smoothing its base lens.
## The camera holds base + punch; this is the existing effect bookkeeping,
## not a second base-FOV state or a new camera owner.
func applied_fov_punch() -> float:
	return _fov_applied


func _process(delta: float) -> void:
	if camera == null or not is_instance_valid(camera):
		return
	_time += delta
	trauma = maxf(0.0, trauma - delta * TRAUMA_DECAY)
	fov_punch = move_toward(fov_punch, 0.0, delta * FOV_DECAY)
	var shake := trauma * trauma
	if shake > 0.0002:
		camera.rotation_degrees = Vector3(
			sin(_time * 47.0) * MAX_PITCH_DEG * shake,
			sin(_time * 39.0 + 1.7) * MAX_YAW_DEG * shake,
			sin(_time * 53.0 + 0.4) * MAX_ROLL_DEG * shake)
		camera.h_offset = sin(_time * 31.0) * MAX_SHIFT * shake
		camera.v_offset = cos(_time * 37.0) * MAX_SHIFT * shake
	elif camera.rotation_degrees != Vector3.ZERO or camera.h_offset != 0.0 or camera.v_offset != 0.0:
		camera.rotation_degrees = Vector3.ZERO
		camera.h_offset = 0.0
		camera.v_offset = 0.0
	if absf(fov_punch - _fov_applied) > 0.0005:
		camera.fov -= _fov_applied
		_fov_applied = fov_punch
		camera.fov += _fov_applied


func _exit_tree() -> void:
	if camera != null and is_instance_valid(camera):
		camera.fov -= _fov_applied
		camera.rotation_degrees = Vector3.ZERO
		camera.h_offset = 0.0
		camera.v_offset = 0.0
