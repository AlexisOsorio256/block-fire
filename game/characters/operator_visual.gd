class_name OperatorVisual
extends Node3D

## Actor TPS en tercera persona. Es el DIRECTOR del frame y el dueño del
## montaje del arma; el resto del trabajo del personaje vive en tres archivos
## con frontera explícita, para que se pueda leer uno sin cargar con los otros:
##
##   `character_asset.gd`  → prepara el GLB (cirugía de malla, clips, puños).
##                           Una vez por proceso/actor, nunca por fotograma.
##   `operator_wardrobe.gd` → qué geometría se ve (ropa, piel, accesorios).
##   `operator_body.gd`    → pose: intención, mirada e IK de brazos.
##   `operator_motion.gd`  → composición de clips (único reloj de animación).
##   aquí                  → orden del frame, montaje del arma y contrato público.
##
## Orden del frame, sin excepciones (`_process` lo ejecuta tal cual):
##   intención → clips → mirada → montaje del arma → IK de brazos.
## Ninguna capa decide gameplay: la animación jamás mueve al actor y este
## archivo jamás decide munición, recarga ni daño.
##
## Contrato público (consumido por `player.gd`, `bot.gd`, `lobby.gd`, los
## laboratorios de `tools/` y las suites): `model_root`, `weapon_mount`,
## `muzzle_marker`, `skeleton`, `animation_player`, `motion`, `wardrobe`,
## `retarget_ready`, `loadout`, `equipped_weapon_id`, `debug_head_look`,
## `set_combat_state`, `set_crouch_state`, `set_showcase_mode`,
## `set_equipped_weapon`, `play_death`, `flinch`, `revive`,
## `get_muzzle_global_position`, `reload_hand_offset`.
##
## Malla: derivada del pack modular Quaternius "Ultimate Modular Males" (CC0),
## mismos 22 huesos, soldada y subdividida en Blender para quitar el faceteado y
## decimada a ~48 k triángulos (medido: 457 k costaban 31-34 fps en SM_S901E).
## El original CC0 se conserva intacto. Ver `CREDITS.md`.

## Configuración por arma: silueta, longitud real objetivo en metros y agarre.
## `grip`/`grip_rot` están en espacio del hueso Wrist.R (la mano derecha); el
## asset se normaliza por su dimensión mayor para no depender de las unidades
## arbitrarias de cada modelo descargado.
## static var (no const) para poder calibrar en el laboratorio sin editar
## el archivo en cada iteración.
# Ready/ADS offsets are calibrated against real wrist reach (probe-aim-coordination).
# Keep the weapon inside both arms' reach; never stretch bones to fix a mount.
static var WEAPON_CONFIG := {
	"rifle": {
		"body_kick": 1.0, "recovery": 17,
		"pole_l": Vector3(0.55, -1.0, -0.30),
		"pole_r": Vector3(-0.55, -1.0, -0.30),
		"path": "res://assets/models/weapons/real/rifle.glb",
		"length": 0.92,
		"pivot": Vector3(0.0, -0.10, -0.21),
		"asset_rot": Vector3(0.0, 0.0, 0.0),
		"ready": Vector3(-0.10, -0.06, 0.07),
		"aim": Vector3(-0.08, -0.025, 0.14),
		"grip": Vector3(0.0, -0.02, 0.02),
		"wrist_rot": Vector3(0.0, 0.0, 0.0),
		# Underside of the rifle handguard, measured in the normalized mesh.
		"foregrip": Vector3(0.0, 0.175, 0.28),
		"support_wrist": Vector3(0.040, -0.025, -0.065),
		"muzzle": Vector3(0.0, 0.0, 0.67),
	},
	"pistol": {
		"body_kick": 1.35, "recovery": 14,
		"pole_l": Vector3(0.38, -1.0, -0.30),
		"pole_r": Vector3(-0.38, -1.0, -0.30),
		"path": "res://assets/models/weapons/real/desert_eagle_dec.glb",
		"length": 0.27,
		"pivot": Vector3(-0.001, -0.030, -0.099),
		"asset_rot": Vector3(0.0, 0.0, 0.0),
		"ready": Vector3(-0.11, -0.08, 0.22),
		"aim": Vector3(-0.08, 0.05, 0.30),
		"grip": Vector3(0.0, -0.015, 0.0),
		"wrist_rot": Vector3(0.0, 0.0, 0.0),
		"foregrip": Vector3(-0.02, 0.02, 0.045),
		"muzzle": Vector3(0.0, 0.0, 0.21),
	},
	"shotgun": {
		"body_kick": 2.2, "recovery": 10,
		"pole_l": Vector3(0.7, -1.0, -0.30),
		"pole_r": Vector3(-0.7, -1.0, -0.30),
		"path": "res://assets/models/weapons/real/shotgun.glb",
		"length": 1.05,
		"pivot": Vector3(-0.264, 0.10, 0.0),
		"asset_rot": Vector3(0.0, -90.0, 0.0),
		"ready": Vector3(-0.10, -0.06, 0.13),
		"aim": Vector3(-0.08, 0.05, 0.19),
		"grip": Vector3(0.0, -0.02, 0.02),
		"wrist_rot": Vector3(0.0, 0.0, 0.0),
		"foregrip": Vector3(0.0, 0.06, 0.22),
		"muzzle": Vector3(0.0, 0.0, 0.76),
	},
	"smg": {
		"body_kick": 0.65, "recovery": 22,
		"pole_l": Vector3(0.48, -1.0, -0.30),
		"pole_r": Vector3(-0.48, -1.0, -0.30),
		"path": "res://assets/models/weapons/real/mpx_smg.glb",
		"length": 0.62,
		"pivot": Vector3(0.0, -0.095, -0.028),
		"asset_rot": Vector3(0.0, 180.0, 0.0),
		"ready": Vector3(-0.10, -0.06, 0.14),
		"aim": Vector3(-0.08, 0.05, 0.24),
		"grip": Vector3(0.0, -0.02, 0.02),
		"wrist_rot": Vector3(0.0, 0.0, 0.0),
		"foregrip": Vector3(0.0, 0.06, 0.18),
		"muzzle": Vector3(0.0, 0.0, 0.15),
	},
}

const WEAPON_IDS := ["rifle", "pistol", "shotgun", "smg"]

## Recorrido de la mano de apoyo por CLASE de arma ("rifle"/"pistol"), en
## espacio del montaje. Lo escribe tools/make_anim_clips.py; nadie más lo edita.
static var RELOAD_HAND_PATHS: Dictionary = JSON.parse_string(FileAccess.get_file_as_string("res://assets/models/animation_library/reload_hand_path.json"))

## La velocidad de suelo implícita de cada clip de locomoción vive en
## `locomotion_speeds.json`, escrito por tools/make_anim_clips.py y consumido
## por OperatorMotion. Aquí no se duplica: dos verdades divergen siempre.

var operator_id := "BRAVO"
var team := "ally"
var is_human := false
var accent := Color("#4fd6e9")
var loadout: Dictionary = {}
var model_root: Node3D
var weapon_mount: Node3D
var muzzle_marker: Marker3D
var skeleton: Skeleton3D
var animation_player: AnimationPlayer
var showcase_mode := false
var showcase_weapon_skin := "Estándar"
var equipped_weapon_id := "rifle"
var moving := false
var firing := false
var aiming := false
var sprinting := false
var dead := false
var crouched := false
var locomotion_speed_scale := 1.0
var retarget_ready := false
## Interruptor de diagnóstico para comparar con/sin IK de mano izquierda.
var ik_enabled := true
## Congela el clip para inspeccionar un instante exacto (laboratorio).
var debug_hold_animation := false
var debug_manual_state := false
## Fuerza la pose de recarga en el laboratorio (no tiene arma padre).
var debug_force_reload := false
## Laboratorio: yaw/pitch de mirada sin actor padre (grados).
var debug_head_look := Vector2.ZERO
var motion: OperatorMotion
var wardrobe := OperatorWardrobe.new()

var _body := OperatorBody.new()
var _weapon_ref: Node = null
var _left_fist: Node3D
var _right_fist: Node3D
var _mount_offset := Vector3.ZERO
var _mount_initialized := false
var _mounted_weapon: Node3D


func configure(id: String, team_id: String, color: Color, cosmetic_loadout: Dictionary = {}, human: bool = false) -> void:
	operator_id = id
	team = team_id
	accent = color
	loadout = cosmetic_loadout
	is_human = human
	_build()


func resolve_default_loadout(role_seed: int = 0) -> Dictionary:
	if not loadout.is_empty():
		return loadout
	if is_human:
		var settings := _settings()
		if settings != null:
			return settings.cosmetic_loadout()
		# Fuera del árbol todavía (player.gd y lobby.gd configuran antes de
		# add_child): un humano nunca debe recibir ropa aleatoria de bot.
		return CosmeticCatalog.default_loadout()
	return CosmeticCatalog.bot_loadout_for(operator_id, "entry", role_seed)


func set_showcase_mode(enabled: bool, weapon_scene: String = "", weapon_skin: String = "") -> void:
	showcase_mode = enabled
	if not weapon_scene.is_empty():
		equipped_weapon_id = _weapon_id_from_scene(weapon_scene)
	if not weapon_skin.is_empty():
		showcase_weapon_skin = weapon_skin
	_set_team_marker_visible(not showcase_mode)
	if not retarget_ready:
		return
	_refresh_weapon()


func set_showcase_weapon_skin(weapon_skin: String) -> void:
	showcase_weapon_skin = weapon_skin
	_refresh_weapon()


func set_equipped_weapon(weapon_id: String, weapon_skin: String = "Estándar") -> void:
	if not WEAPON_CONFIG.has(weapon_id):
		return
	equipped_weapon_id = weapon_id
	showcase_weapon_skin = weapon_skin
	_refresh_weapon()


## Agachado real con clip (antes `player.gd` aplastaba el personaje con
## `scale.y = 0.72`, que deformaba toda la malla).
func set_crouch_state(value: bool) -> void:
	crouched = value
	if motion != null:
		motion.crouched = value


## Gameplay declara la clase de velocidad (sprint) además de la velocidad real.
## La animación no la inventa: sólo la consume para elegir clip.
func set_combat_state(is_moving: bool, is_firing: bool, is_aiming: bool = false, locomotion_speed: float = 1.0, sprinting_state: bool = false) -> void:
	moving = is_moving
	firing = is_firing
	aiming = is_aiming
	locomotion_speed_scale = locomotion_speed
	sprinting = sprinting_state


func play_death() -> void:
	dead = true
	if motion != null:
		motion.die()
	_body.capture_death_pose(self)


func flinch(strength: float = 1.0) -> void:
	if motion != null and not dead:
		motion.hit(strength)


func confirmed_shot(_definition: WeaponDefinition = null) -> void:
	if motion == null or dead:
		return
	var config: Dictionary = WEAPON_CONFIG.get(equipped_weapon_id, {})
	var kick := float(config.get("body_kick", 1.0))
	var recovery := float(config.get("recovery", 16.0))
	motion.shot(kick, recovery)


func revive() -> void:
	dead = false
	_body.reset_motion_history()
	if model_root != null:
		model_root.position.y = 0.0
	if motion != null:
		motion.reset()
	_mount_initialized = false
	_refresh_animation_state()


func get_muzzle_global_position() -> Vector3:
	if muzzle_marker == null:
		return global_position
	return muzzle_marker.global_position


func _ready() -> void:
	if wardrobe.pending_default_loadout:
		wardrobe.pending_default_loadout = false
		loadout = resolve_default_loadout()
		wardrobe.apply(self)


func _process(delta: float) -> void:
	if motion == null or not retarget_ready: return
	# Contract: inputs → clips/layers → head → mount → IK → hands. No other
	# process callback writes this skeleton, including while paused/dead.
	if not debug_hold_animation:
		if not debug_manual_state: _body.read_motion_inputs(self, delta)
		motion.evaluate(delta)
		if not dead: _body.update_head_look(self, delta)
	_update_weapon_mount(delta)
	if not dead: _body.solve_arms_ik(self)


## Construye el actor entero. Idempotente: vacía lo anterior antes de montar.
func _build() -> void:
	# El IK de la mano izquierda debe escribirse DESPUÉS de que AnimationPlayer
	# haya volcado las poses del clip: prioridad alta = procesado más tarde.
	process_priority = 100
	for child: Node in get_children():
		remove_child(child)
		child.free()
	model_root = Node3D.new()
	model_root.name = "RiggedOperator"
	model_root.rotation_degrees.y = CharacterAsset.MODEL_YAW_DEGREES
	add_child(model_root)
	skeleton = null
	animation_player = null
	retarget_ready = false
	dead = false
	motion = null
	wardrobe.modules.clear()
	wardrobe.skin_materials.clear()
	wardrobe.accessory_root = null
	_mounted_weapon = null

	var character := CharacterAsset.instantiate_rig(model_root)
	if character != null:
		skeleton = CharacterAsset.prepare(character, model_root)
		animation_player = character.find_child("AnimationPlayer", true, false) as AnimationPlayer
		if skeleton != null and animation_player != null:
			wardrobe.index_modules(character)
			retarget_ready = true
			motion = OperatorMotion.new()
			motion.setup(skeleton, animation_player)

	weapon_mount = Node3D.new()
	weapon_mount.name = "WeaponMount"
	model_root.add_child(weapon_mount)
	muzzle_marker = Marker3D.new()
	muzzle_marker.name = "MuzzleMarker"
	weapon_mount.add_child(muzzle_marker)
	_add_team_marker()
	wardrobe.apply(self)
	_refresh_weapon()
	_set_team_marker_visible(not showcase_mode)
	_refresh_animation_state()


func weapon_controller() -> Node:
	if _weapon_ref != null and is_instance_valid(_weapon_ref):
		return _weapon_ref
	var actor := get_parent()
	if actor != null:
		_weapon_ref = actor.get("weapon") as Node
	return _weapon_ref


func mounted_weapon() -> Node3D:
	return _mounted_weapon


func left_fist() -> Node3D:
	return _left_fist


func right_fist() -> Node3D:
	return _right_fist


func _refresh_animation_state() -> void:
	# Public setters only latch state; _process owns evaluation once per frame.
	pass


func _add_team_marker() -> void:
	var ring := MeshInstance3D.new()
	ring.name = "TeamRing"
	var mesh := TorusMesh.new()
	mesh.inner_radius = 0.32
	mesh.outer_radius = 0.36
	ring.mesh = mesh
	ring.position.y = 0.035
	ring.material_override = _ring_material(accent)
	model_root.add_child(ring)


func _set_team_marker_visible(value: bool) -> void:
	var ring := model_root.get_node_or_null("TeamRing") as Node3D if model_root != null else null
	if ring != null:
		ring.visible = value


func _ring_material(color: Color) -> StandardMaterial3D:
	var material := StandardMaterial3D.new()
	material.albedo_color = color
	material.emission_enabled = true
	material.emission = color
	material.emission_energy_multiplier = 0.7
	material.roughness = 0.55
	return material


## Ancla el arma al pecho y elige su silueta. La pose del cuerpo la compone
## `OperatorBody`; aquí sólo se decide DÓNDE va el arma y qué modelo se ve.
func _update_weapon_mount(delta: float) -> void:
	if weapon_mount == null or skeleton == null:
		return
	if dead:
		_body.update_death_drop(self, delta)
		var wrist_r := skeleton.find_bone("Wrist.R")
		if wrist_r >= 0:
			weapon_mount.global_transform = skeleton.global_transform * skeleton.get_bone_global_pose(wrist_r) * _body.death_weapon_local()
		var left := _left_fist
		var wrist_l := skeleton.find_bone("Wrist.L")
		if is_instance_valid(left) and wrist_l >= 0:
			left.global_transform = skeleton.global_transform * skeleton.get_bone_global_pose(wrist_l) * _body.death_hand_local()
		return
	var chest := skeleton.find_bone(CharacterAsset.CHEST_BONE)
	if chest < 0:
		return
	var config: Dictionary = WEAPON_CONFIG.get(equipped_weapon_id, {})
	var aim_blend := motion.aim_weight if motion != null else 0.0
	var reload_blend := motion.reload_weight if motion != null else 0.0
	var switch_blend := motion.switch_weight if motion != null else 0.0
	# Let the running silhouette carry the weapon below the firing line.
	# Reuse the gait blend so starting/stopping and returning to combat are
	# continuous; reload/switch keep their own authored mount and hand path.
	var carry_blend := motion._sprint_weight * motion._move_weight if motion != null else 0.0
	carry_blend *= (1.0 - aim_blend) * (1.0 - reload_blend) * (1.0 - switch_blend)
	var ready_offset: Vector3 = config.get("ready", Vector3.ZERO)
	var aim_offset: Vector3 = config.get("aim", ready_offset)
	var offset := ready_offset.lerp(aim_offset, aim_blend)
	offset += Vector3(0.0, -0.09, -0.025) * carry_blend
	if reload_blend > 0.001:
		# Lower by 8 cm: 13 cm made the authored reload target unreachable.
		offset += Vector3(0.03, -0.08, -0.05) * reload_blend
	if switch_blend > 0.001:
		offset += Vector3(0.0, -0.10, -0.04) * switch_blend
	if not _mount_initialized:
		_mount_offset = offset
		_mount_initialized = true
	_mount_offset = _mount_offset.lerp(offset, 1.0 - exp(-24.0 * delta))
	offset = _mount_offset
	if motion != null: offset.z -= motion.recoil * 0.018
	var chest_global := skeleton.global_transform * skeleton.get_bone_global_pose(chest)
	# Model orientation + the aim turn published by OperatorBody. Do not use
	# the animated chest basis: its roll would rotate the barrel away from aim.
	# Position follows the chest; the shared turn preserves shoulder/grip reach.
	var basis := model_root.global_transform.basis.orthonormalized() * _body.aim_basis
	basis *= Basis(Vector3.RIGHT, deg_to_rad(22.0 * carry_blend))
	if reload_blend > 0.001:
		basis = basis * Basis(Vector3.RIGHT, deg_to_rad(-16.0 * reload_blend))
	if switch_blend > 0.001:
		basis = basis * Basis(Vector3.RIGHT, deg_to_rad(-11.0 * switch_blend))
	if motion != null: basis *= Basis(Vector3.RIGHT, deg_to_rad(-motion.recoil * 1.8))
	weapon_mount.global_transform = Transform3D(basis, chest_global.origin + basis * offset)


## Carga el GLB del arma activa, lo normaliza a su longitud objetivo, lo gira a
## la convención del arma y monta los puños de agarre. Sólo presentación: las
## stats viven en `game/data/weapons/*.tres`.
func _refresh_weapon() -> void:
	if weapon_mount == null:
		return
	# Contenedor persistente: el asset intercambiable vive dentro. Si se
	# recreara "MountedWeapon" en cada cambio, Godot renombraría el nuevo por
	# colisión con el anterior aún en queue_free y los consumidores dejarían
	# de encontrarlo.
	if _mounted_weapon == null or not is_instance_valid(_mounted_weapon):
		_mounted_weapon = Node3D.new()
		_mounted_weapon.name = "MountedWeapon"
		weapon_mount.add_child(_mounted_weapon)
	for child: Node in _mounted_weapon.get_children():
		_mounted_weapon.remove_child(child)
		child.queue_free()
	var config: Dictionary = WEAPON_CONFIG.get(equipped_weapon_id, {})
	var asset := _new_weapon(equipped_weapon_id)
	asset.name = "WeaponAsset"
	var asset_scale := _normalise_weapon(asset, float(config.get("length", 0.9)))
	_mounted_weapon.add_child(asset)
	# El asset se normaliza por su dimensión mayor y se gira a la convención
	# del arma: -Z adelante, +Y arriba. Así grip/foregrip/muzzle son metros
	# legibles iguales para las cuatro categorías.
	asset.scale = Vector3.ONE * asset_scale
	var asset_rotation: Vector3 = config.get("asset_rot", Vector3(0.0, 180.0, 0.0))
	asset.rotation_degrees = asset_rotation
	# Pivote: el origen del asset casi nunca está en el agarre. Se desplaza el
	# asset para que el punto de agarre caiga en el origen del montaje.
	var pivot: Vector3 = config.get("pivot", Vector3.ZERO)
	# `pivot` está en metros del arma ya normalizada; se rota y se compensa.
	asset.position = -(Basis.from_euler(Vector3(
		deg_to_rad(asset_rotation.x), deg_to_rad(asset_rotation.y), deg_to_rad(asset_rotation.z))) * pivot)
	_mounted_weapon.position = Vector3.ZERO
	_mounted_weapon.rotation = Vector3.ZERO
	WeaponSkin.apply(asset, showcase_weapon_skin)
	var fists := CharacterAsset.build_grip_hands(
		weapon_mount, equipped_weapon_id, config, CharacterAsset.hand_material(wardrobe.modules))
	_left_fist = fists[0]
	_right_fist = fists[1]
	if muzzle_marker != null:
		muzzle_marker.position = config.get("muzzle", Vector3(0.0, 0.0, -0.45))
		muzzle_marker.rotation = Vector3.ZERO


## Escala el asset para que su dimensión mayor mida `target_length` metros.
## Evita los factores mágicos por modelo: los GLB descargados llegan en
## centímetros, pulgadas o unidades arbitrarias según el exportador.
func _normalise_weapon(asset: Node3D, target_length: float) -> float:
	var bounds := _node_aabb(asset)
	var longest := maxf(bounds.size.x, maxf(bounds.size.y, bounds.size.z))
	if longest <= 0.0001 or target_length <= 0.0:
		return 1.0
	return target_length / longest


## AABB en el espacio del propio nodo raíz del asset. `get_aabb()` devuelve el
## AABB en espacio de malla, que en estos GLB está rotado por el nodo; medir
## ahí hacía girar el arma a vertical y colocarla mal.
func _node_aabb(node: Node3D) -> AABB:
	var bounds := AABB()
	var first := true
	for candidate: Node in node.find_children("*", "MeshInstance3D", true, false):
		var mesh_instance := candidate as MeshInstance3D
		if mesh_instance == null or mesh_instance.mesh == null:
			continue
		var to_root := Transform3D.IDENTITY
		var walker: Node = mesh_instance
		while walker != null and walker != node:
			to_root = (walker as Node3D).transform * to_root
			walker = walker.get_parent()
		var local := to_root * mesh_instance.get_aabb()
		if first:
			bounds = local
			first = false
		else:
			bounds = bounds.merge(local)
	return bounds


func _new_weapon(weapon_id: String) -> Node3D:
	var config: Dictionary = WEAPON_CONFIG.get(weapon_id, {})
	var asset_path := str(config.get("path", ""))
	var packed := load(asset_path) as PackedScene if not asset_path.is_empty() and ResourceLoader.exists(asset_path) else null
	if packed != null:
		var asset := packed.instantiate() as Node3D
		if asset != null:
			return asset
	# Sin asset licenciado no se sustituye por una primitiva: el hueco vacío es
	# la señal honesta de que falta el modelo de esa categoría.
	return Node3D.new()


## Id de arma a partir de la ruta del modelo, para el modo escaparate del
## lobby (`--weapon=<ruta>`), que habla en rutas y no en ids.
func _weapon_id_from_scene(scene_path: String) -> String:
	var path := scene_path.to_lower()
	if path.contains("pistol") or path.contains("eagle"): return "pistol"
	if path.contains("shotgun"): return "shotgun"
	if path.contains("smg") or path.contains("mpx"): return "smg"
	return "rifle"


func _settings() -> Node:
	return get_node_or_null("/root/SettingsStore") if is_inside_tree() else null


## Recorrido de la mano de apoyo durante la recarga, en espacio del montaje.
## La tabla la escribe `tools/make_anim_clips.py`; aquí sólo se interpola.
static func reload_hand_offset(t: float, weapon_class: String = "rifle") -> Vector3:
	# Anticipation, release, magazine, pouch, insert, seat, return, settle.
	# Timing is normalized to WeaponDefinition.reload_time; no ammo events here.
	# El recorrido viene por clase de arma: un cargador de rifle sale del cinturón,
	# uno de pistola de la cadera y remata con el pestillo de corredera.
	var keys: Array = RELOAD_HAND_PATHS.get(weapon_class, RELOAD_HAND_PATHS.get("rifle", []))
	for i in range(keys.size() - 1):
		var a: Array = keys[i]
		var b: Array = keys[i + 1]
		if t <= float(b[0]):
			var av := Vector3(a[1][0], a[1][1], a[1][2])
			var bv := Vector3(b[1][0], b[1][1], b[1][2])
			return av.lerp(bv, smoothstep(float(a[0]), float(b[0]), t))
	return Vector3.ZERO
