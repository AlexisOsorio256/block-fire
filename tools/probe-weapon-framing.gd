extends SceneTree

## ¿Cuánto del arma propia ve el jugador y dónde cae respecto a la mira?
##
## El montaje puede estar bien alineado con el cañón y aun así no leerse en
## pantalla: en la vista real el arma queda tapada por brazo/torso y el jugador
## sólo ve una mira flotante. Este probe renderiza la vista de juego con el
## arma propia pintada de magenta plano y cuenta sus píxeles visibles, así que
## mide lo que ve el ojo, no lo que dice el basis del montaje.
##
## USO:
##   godot --path . --script res://tools/probe-weapon-framing.gd -- \
##     --out=/tmp/framing [--weapon=rifle] [--states=hip,ads,hip_fire]
##
## Imprime por estado: píxeles del arma visibles, huella sin oclusión (se apaga
## el cuerpo), % tapado por el propio operador, desvío del cañón respecto al eje
## de cámara, a cuántos píxeles de la mira aparece la boca y el error de muñeca
## contra el socket (una pose que no se alcanza se ve como mano despegada).
## No toca gameplay: monta el Player real, su cámara y su arma.

const IDS := ["rifle", "pistol", "shotgun", "smg"]
const DT := 1.0 / 60.0
const TICKS_PER_STATE := 40
const MAGENTA_MIN := 150

class ExamPlayer extends BlockfirePlayer:
	signal tick_done
	func _physics_process(delta: float) -> void:
		super._physics_process(delta)
		set_physics_process(false)
		tick_done.emit()


var out := ""
var weapon := "rifle"
var states: Array[String] = ["hip", "sprint", "ads", "hip_fire", "ads_fire", "crouch"]
var player: ExamPlayer
var controls: BlockfireMobileControls
var camera: Camera3D
var failures: int = 0
var _built := false


func _init() -> void:
	for arg in OS.get_cmdline_user_args():
		if arg.begins_with("--out="): out = arg.get_slice("=", 1)
		if arg.begins_with("--weapon="): weapon = arg.get_slice("=", 1)
		if arg.begins_with("--states="):
			states.clear()
			for token: String in arg.get_slice("=", 1).split(","):
				if not token.strip_edges().is_empty():
					states.append(token.strip_edges())
	if out.is_empty(): out = "/tmp/blockfire-weapon-framing-%d" % OS.get_process_id()
	DirAccess.make_dir_recursive_absolute(out)
	root.size = Vector2i(1280, 720)
	print("WEAPON_FRAMING out=%s weapon=%s states=%s" % [out, weapon, ",".join(states)])


func _process(_delta: float) -> bool:
	if not _built:
		_build.call_deferred()
		_built = true
		return false
	return false


func _build() -> void:
	var world := Node3D.new()
	root.add_child(world)
	var floor_body := StaticBody3D.new()
	var collision := CollisionShape3D.new()
	var box := BoxShape3D.new()
	box.size = Vector3(200, 1, 200)
	collision.shape = box
	floor_body.add_child(collision)
	floor_body.position.y = -0.5
	world.add_child(floor_body)
	var sun := DirectionalLight3D.new()
	sun.rotation_degrees = Vector3(-52, -30, 0)
	sun.light_energy = 1.08
	world.add_child(sun)
	var environment := WorldEnvironment.new()
	var env := Environment.new()
	env.background_mode = Environment.BG_COLOR
	env.background_color = Color("#8fb4d8")
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color("#cfe2f2")
	env.ambient_light_energy = 0.72
	environment.environment = env
	world.add_child(environment)
	player = ExamPlayer.new()
	world.add_child(player)
	player.set_physics_process(false)
	player.weapon.set_physics_process(false)
	player.visual.set_process(false)
	controls = BlockfireMobileControls.new()
	world.add_child(controls)
	controls.visible = false
	player.mobile_controls = controls
	player.weapon.switch_to(IDS.find(weapon))
	Engine.physics_ticks_per_second = 60
	camera = player.camera
	camera.make_current()

	var total_pixels := {}
	for state: String in states:
		var visible := await _measure(state)
		total_pixels[state] = visible
	print("WEAPON_FRAMING failures=%d" % failures)
	preload("res://tools/probe_teardown.gd").quiesce(self)
	quit(0 if failures == 0 else 1)


## Deja al Player en un estado, renderiza la vista real y mide el arma pintada.
func _measure(state: String) -> int:
	var aiming := state.contains("ads")
	var firing := state.ends_with("fire")
	var moving := state == "sprint"
	var crouching := state == "crouch"
	var reloading := state == "reload"
	var switching := state == "switch"
	for tick: int in range(TICKS_PER_STATE):
		controls.qa_set_move(Vector2.UP if moving else Vector2.ZERO)
		controls.aiming = aiming
		controls.firing = firing
		controls.crouch_request = crouching
		if player.crouched != crouching:
			controls.crouch_request = true
		if tick == 0 and reloading:
			player.weapon.ammo[player.weapon.active_index] = 1
			player.weapon.cooldown = 0.0
			player.weapon.request_reload()
		if tick == 0 and switching:
			player.weapon.switching_timer = 0.0
			player.weapon.next_weapon()
		player.set_physics_process(true)
		await player.tick_done
		player.weapon._physics_process(DT)
		player.visual._process(DT)
	player.set_physics_process(false)
	await RenderingServer.frame_post_draw
	var plain := root.get_texture().get_image()
	plain.save_png("%s/%s_plain.png" % [out, state])
	var gun_metrics := _muzzle_metrics()
	var magenta := _paint_weapon()
	await RenderingServer.frame_post_draw
	var image := root.get_texture().get_image()
	image.save_png("%s/%s_marked.png" % [out, state])
	var stats := _count_marked(image)
	# Huella sin oclusión: se apaga el cuerpo y los puños para separar "el arma
	# se ve poco" de "el arma está tapada por el propio operador".
	var hidden := _hide_operator()
	await RenderingServer.frame_post_draw
	var footprint := _count_marked(root.get_texture().get_image())
	_show_operator(hidden)
	_unpaint_weapon(magenta)
	var size := Vector2(image.get_width(), image.get_height())
	var reticle := size * 0.5
	var muzzle_screen: Vector2 = gun_metrics["muzzle_screen"]
	var muzzle_offset := muzzle_screen.distance_to(reticle)
	print("FRAMING state=%-9s weapon=%-6s pixels=%5d footprint=%5d hidden_pct=%2d bbox=%-18s barrel_deg=%.3f muzzle_offset_px=%.1f fov=%.1f firing=%s aim=%.2f grip_mm=%.2f" % [
		state, weapon, int(stats["pixels"]), int(footprint["pixels"]),
		_footprint_hidden_pct(int(stats["pixels"]), int(footprint["pixels"])), str(stats["bbox"]),
		float(gun_metrics["barrel_deg"]), muzzle_offset,
		camera.fov, player.visual.firing, player.visual.motion.aim_weight, maxf(grip_error("L"), grip_error("R")) * 1000.0])
	return int(stats["pixels"])


## Distancia entre la muñeca real y el socket del puño en el arma: si la pose
## deja el guardamanos fuera del alcance, el brazo se separa del arma.
func grip_error(side: String) -> float:
	var sk: Skeleton3D = player.visual.skeleton
	var wrist := sk.global_transform * sk.get_bone_global_pose(sk.find_bone("Wrist." + side)).origin
	var fist: Node3D = player.visual.left_fist() if side == "L" else player.visual.right_fist()
	if not is_instance_valid(fist):
		return 0.0
	var target := fist.global_position
	var config: Dictionary = OperatorVisual.WEAPON_CONFIG[player.visual.equipped_weapon_id]
	var socket_key := "support_wrist" if side == "L" else "grip_wrist"
	if config.has(socket_key):
		target += player.visual.weapon_mount.global_basis * (config[socket_key] as Vector3)
	else:
		# Sin socket publicado el IK apunta a la palma, no al centro del puño.
		var shoulder := sk.global_transform * sk.get_bone_global_pose(sk.find_bone("UpperArm." + side)).origin
		target -= shoulder.direction_to(target) * OperatorBody.PALM_OFFSET
	return wrist.distance_to(target)


func _footprint_hidden_pct(visible: int, footprint: int) -> int:
	if footprint <= 0:
		return 0
	return int(round(100.0 * (1.0 - float(visible) / float(footprint))))


## Devuelve lo que se apagó, para poder restaurarlo en el mismo orden.
func _hide_operator() -> Array:
	var hidden: Array = []
	for module: MeshInstance3D in player.visual.wardrobe.visible_modules():
		hidden.append(module)
		module.visible = false
	for fist: Node3D in [player.visual.left_fist(), player.visual.right_fist()]:
		if is_instance_valid(fist):
			hidden.append(fist)
			fist.visible = false
	return hidden


func _show_operator(hidden: Array) -> void:
	for node: Node3D in hidden:
		if is_instance_valid(node):
			node.visible = true


## Pinta TODA la malla del arma montada con un material plano detectable.
func _paint_weapon() -> Array:
	var painted: Array = []
	var mount: Node3D = player.visual.mounted_weapon()
	if mount == null:
		failures += 1
		printerr("FRAMING: no mounted weapon")
		return painted
	var material := StandardMaterial3D.new()
	material.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	material.albedo_color = Color(1.0, 0.0, 1.0)
	for node: Node in mount.find_children("*", "MeshInstance3D", true, false):
		var mesh_instance := node as MeshInstance3D
		painted.append([mesh_instance, mesh_instance.material_override])
		mesh_instance.material_override = material
	return painted


func _unpaint_weapon(painted: Array) -> void:
	for entry: Array in painted:
		var mesh_instance := entry[0] as MeshInstance3D
		if is_instance_valid(mesh_instance):
			mesh_instance.material_override = entry[1]


## Cuenta píxeles magenta, su caja y cuántos caen fuera del encuadre. El AABB
## proyectado dice si el arma está fuera de pantalla aunque ninguna parte se
## vea: sin eso, "0 píxeles" no distingue tapado de encuadre perdido.
func _count_marked(image: Image) -> Dictionary:
	var pixels := 0
	var min_x := image.get_width()
	var min_y := image.get_height()
	var max_x := -1
	var max_y := -1
	for y: int in range(image.get_height()):
		for x: int in range(image.get_width()):
			var color := image.get_pixel(x, y)
			if color.r < 1.0 or color.b < 1.0 or color.g > 0.35:
				continue
			if color.r * 255.0 < MAGENTA_MIN or color.b * 255.0 < MAGENTA_MIN:
				continue
			pixels += 1
			min_x = mini(min_x, x)
			min_y = mini(min_y, y)
			max_x = maxi(max_x, x)
			max_y = maxi(max_y, y)
	var bbox := "none" if pixels == 0 else "%d,%d %dx%d" % [min_x, min_y, max_x - min_x + 1, max_y - min_y + 1]
	return {"pixels": pixels, "bbox": bbox}


## Ángulo entre el cañón y el eje de cámara, y posición de la boca en pantalla.
func _muzzle_metrics() -> Dictionary:
	var muzzle: Vector3 = player.visual.get_muzzle_global_position()
	var basis := player.visual.weapon_mount.global_transform.basis
	var forward := -camera.global_transform.basis.z
	var barrel := basis.z
	var deg := rad_to_deg(acos(clampf(barrel.dot(forward), -1.0, 1.0)))
	return {
		"barrel_deg": deg,
		"muzzle_screen": camera.unproject_position(muzzle),
	}
