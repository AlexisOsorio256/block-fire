class_name BlockfireCrosshair
extends Control

var feedback_timer: float = 0.0
var feedback_headshot: bool = false

func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	set_process(true)
	queue_redraw()

func register_hit(headshot: bool) -> void:
	feedback_timer = 0.22
	feedback_headshot = headshot
	queue_redraw()

func _process(delta: float) -> void:
	if feedback_timer <= 0.0:
		return
	feedback_timer = maxf(0.0, feedback_timer - delta)
	queue_redraw()

func _draw() -> void:
	var center := size * 0.5
	var base_color := Color(1.0, 1.0, 1.0, 0.88)
	var gap := 5.0
	var arm := 8.0
	var width := 2.0
	for direction: Vector2 in [Vector2.LEFT, Vector2.RIGHT, Vector2.UP, Vector2.DOWN]:
		draw_line(center + direction * gap, center + direction * (gap + arm), base_color, width, true)
	draw_circle(center, 1.5, base_color)
	if feedback_timer > 0.0:
		var strength := clampf(feedback_timer / 0.22, 0.0, 1.0)
		var feedback_color := Color("#ffd35f") if feedback_headshot else Color("#d8f4ff")
		feedback_color.a = strength
		var hit_arm := 10.0 + (3.0 if feedback_headshot else 0.0)
		var hit_gap := 8.0
		for direction: Vector2 in [Vector2(-1, -1), Vector2(1, -1), Vector2(-1, 1), Vector2(1, 1)]:
			var diagonal := direction.normalized()
			draw_line(center + diagonal * hit_gap, center + diagonal * (hit_gap + hit_arm), feedback_color, 2.4, true)
