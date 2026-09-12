class_name BlockfireCrosshair
extends Control

func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	queue_redraw()

## Compatibilidad con HUD: el feedback de impacto tiene un único dueño en
## BlockfireHud.HitMarker. Antes este método dibujaba un segundo juego de
## diagonales encima del mismo disparo y el marker se veía grueso/doble.
func register_hit(_headshot: bool) -> void:
	pass

func _draw() -> void:
	var center := size * 0.5
	var base_color := Color(1.0, 1.0, 1.0, 0.88)
	var gap := 5.0
	var arm := 8.0
	var width := 2.0
	for direction: Vector2 in [Vector2.LEFT, Vector2.RIGHT, Vector2.UP, Vector2.DOWN]:
		draw_line(center + direction * gap, center + direction * (gap + arm), base_color, width, true)
	draw_circle(center, 1.5, base_color, true, -1.0, true)
