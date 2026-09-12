class_name BlockfireCrosshair
extends Control

## El hueco de la cruz es el cono REAL del arma proyectado a píxeles:
## `WeaponController.current_spread()` es la única fuente de dispersión y aquí
## sólo se dibuja. Antes el hueco era fijo (5 px) aunque el arma disparaba hasta
## ±3,6° al mantener el gatillo: con el retículo centrado en el pecho, la
## mayoría de las balas caía fuera y la pantalla no lo decía.
const BASE_GAP := 5.0
const ARM := 8.0
## Tope de seguridad: el peor cono vivo es la escopeta a tope de calor
## (±11,9° ≈ 111 px a 720p), así que este límite no recorta ningún arma actual.
const MAX_GAP := 180.0

var _gap := BASE_GAP

func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	queue_redraw()

## Compatibilidad con HUD: el feedback de impacto tiene un único dueño en
## BlockfireHud.HitMarker. Antes este método dibujaba un segundo juego de
## diagonales encima del mismo disparo y el marker se veía grueso/doble.
func register_hit(_headshot: bool) -> void:
	pass

## Píxeles por radián en el centro de la pantalla: la cámara de Godot usa el FOV
## vertical con KEEP_HEIGHT, así que la altura manda.
static func focal_pixels(viewport_height: float, fov_degrees: float) -> float:
	if viewport_height <= 0.0 or fov_degrees <= 0.0:
		return 0.0
	return (viewport_height * 0.5) / tan(deg_to_rad(fov_degrees) * 0.5)

func set_spread(half_angle_rad: float, fov_degrees: float) -> void:
	var focal := focal_pixels(get_viewport_rect().size.y, fov_degrees)
	if focal <= 0.0:
		return
	set_gap_pixels(half_angle_rad * focal)

func set_gap_pixels(gap_pixels: float) -> void:
	var gap := clampf(gap_pixels, BASE_GAP, MAX_GAP)
	if absf(gap - _gap) < 0.25:
		return
	_gap = gap
	queue_redraw()

func _draw() -> void:
	var center := size * 0.5
	var base_color := Color(1.0, 1.0, 1.0, 0.88)
	var width := 2.0
	for direction: Vector2 in [Vector2.LEFT, Vector2.RIGHT, Vector2.UP, Vector2.DOWN]:
		# El punto central sigue marcando la puntería exacta; el hueco marca
		# hasta dónde puede desviarse la bala.
		draw_line(center + direction * _gap, center + direction * (_gap + ARM), base_color, width, true)
	draw_circle(center, 1.5, base_color, true, -1.0, true)
