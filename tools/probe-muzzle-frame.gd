extends SceneTree
## Marco real del arma (diagnóstico, no forma parte del runtime).
##
## El arma se monta con el cañón en el +Z del montaje (`WEAPON_CONFIG` pone la
## boca a +0,67 m en el rifle), no con el -Z de la cámara de Godot. En un marco
## con el cañón en +Z el +X apunta al lado IZQUIERDO del tirador y girar en
## positivo sobre él BAJA la boca. Las dos cosas se ven en partida: el casquillo
## sale cruzando el cuerpo y el fogonazo deja de apuntar como el cañón visible.
##
## Dispara una ráfaga con el Player real (mismo orden física → render) y mide:
##   - de qué lado del eje del arma queda cada casquillo y hacia dónde vuela;
##   - cuánto gira el ancla de FX (fogonazo, humo, estrella) respecto al marco
##     del cañón visible que copia en ese mismo tick.
##
## USO: godot --headless --path . --script res://tools/probe-muzzle-frame.gd

const ProbeTeardown := preload("res://tools/probe_teardown.gd")
const DT := 1.0 / 60.0
## El ancla de FX es la copia exacta del marco visible: cualquier patada propia
## es una segunda rotación que el cañón dibujado no tiene.
const MAX_FX_ANGLE_DEG := 0.5

var failures := 0

func _init() -> void:
	call_deferred("run")

func check(ok: bool, label: String) -> void:
	print("%s: %s" % ["PASS" if ok else "FAIL", label])
	if not ok:
		failures += 1

func run() -> void:
	var world := Node3D.new()
	root.add_child(world)
	var player := BlockfirePlayer.new()
	world.add_child(player)
	player.set_physics_process(false)
	player.set_process(false)
	player.visual.set_process(false)
	player.weapon.set_physics_process(false)
	player.gravity = 0.0
	await physics_frame
	for index: int in range(OperatorVisual.WEAPON_IDS.size()):
		_burst(player, index)
	Input.action_release("fire")
	print("MUZZLE_FRAME failures=%d" % failures)
	ProbeTeardown.quiesce(self)
	quit(1 if failures > 0 else 0)

## Ráfaga con el arma `index`: primero deja terminar el cambio, luego mide con el
## gatillo mantenido, que es cuando el montaje y el ancla de FX se separan.
func _burst(player: BlockfirePlayer, index: int) -> void:
	player.weapon.switch_to(index)
	for _tick in range(40):
		_step(player)
	var id: String = str(player.weapon.current_definition().id)
	var max_angle := 0.0
	var shots := 0
	Input.action_press("fire")
	for _tick in range(60):
		var before: int = int(player.weapon.ammo[index])
		max_angle = maxf(max_angle, _step(player))
		if int(player.weapon.ammo[index]) < before:
			shots += 1
	Input.action_release("fire")
	# Los casquillos vivos deben estar y volar por el costado DERECHO del arma:
	# la ventana de eyección mira a la derecha del tirador. Si aparecen a la
	# izquierda, cruzan cuerpo y cara en cada ráfaga.
	var actor_right := player.global_transform.basis.x.normalized()
	var mount_origin: Vector3 = (player.visual.weapon_mount as Node3D).global_position
	var min_side := INF
	var min_velocity_side := INF
	for entry: Dictionary in player.weapon.combat_fx._shells:
		var shell := entry["node"] as MeshInstance3D
		if shell == null or not shell.visible:
			continue
		min_side = minf(min_side, (shell.global_position - mount_origin).dot(actor_right))
		min_velocity_side = minf(min_velocity_side, (entry["velocity"] as Vector3).dot(actor_right))
	print("WEAPON %-8s shots=%2d fx_angle_max=%.2f deg shell_side_min=%.3f m shell_velocity_side_min=%.3f m/s" % [
		id, shots, max_angle, min_side, min_velocity_side])
	check(max_angle < MAX_FX_ANGLE_DEG, "%s: el fogonazo apunta como el cañón visible (máx %.2f° < %.1f°)" % [
		id, max_angle, MAX_FX_ANGLE_DEG])
	check(min_side > 0.0, "%s: los casquillos quedan a la derecha del arma (mín %.3f m > 0)" % [
		id, min_side])
	check(min_velocity_side > 0.3, "%s: los casquillos vuelan hacia la derecha (mín %.3f m/s > 0,3)" % [
		id, min_velocity_side])

## Mismo orden que el runtime: tick de física del actor, tick del arma (que
## actualiza el ancla) y el `_process` del visual que escribe el montaje.
## Devuelve cuánto gira el ancla respecto al marco del cañón que copia.
func _step(player: BlockfirePlayer) -> float:
	player._physics_process(DT)
	var marker: Node3D = player.visual.muzzle_marker
	var copied := marker.global_transform.basis.z.normalized() if marker != null else Vector3.FORWARD
	player.weapon._physics_process(DT)
	player.visual._process(DT)
	var anchor: Node3D = player.weapon.muzzle_anchor
	if anchor == null:
		return 0.0
	return rad_to_deg(copied.angle_to(anchor.global_transform.basis.z.normalized()))
