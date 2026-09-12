class_name WeaponController
extends Node3D

signal weapon_fired(definition: WeaponDefinition)
signal weapon_changed(definition: WeaponDefinition)
signal ammo_changed(current: int, reserve: int, definition: WeaponDefinition)
signal damage_confirmed(amount: float, headshot: bool)

const DEFINITIONS: Array[WeaponDefinition] = [
	preload("res://game/data/weapons/rifle.tres"),
	preload("res://game/data/weapons/pistol.tres"),
	preload("res://game/data/weapons/shotgun.tres"),
	preload("res://game/data/weapons/smg.tres")
]

var actor: Node
var camera: Camera3D
var mobile_controls: Node
var active_index: int = 1
var ammo: Array[int] = []
var reserve: Array[int] = []
var available_indices: Array[int] = []
var cooldown: float = 0.0
var reload_timer: float = 0.0
var switching_timer: float = 0.0
var fire_held: bool = false
var aim_held: bool = false
var ai_target: Node
var ai_can_see: bool = false
var previous_fire: bool = false
var muzzle_flash: MeshInstance3D
var muzzle_anchor: Node3D
var shot_audio: AudioStreamPlayer3D
var shot_tail_audio: AudioStreamPlayer3D
var reload_audio: AudioStreamPlayer3D
var switch_audio: AudioStreamPlayer3D
var empty_audio: AudioStreamPlayer3D
var impact_audio: AudioStreamPlayer3D
var shot_streams: Dictionary = {}
var rng := RandomNumberGenerator.new()
var muzzle_flash_scale := 1.0
var recoil_amount: float = 0.0
var impact_played_this_shot: bool = false
var combat_fx: CombatFX
## Calor de dispersión acumulado por disparos seguidos: el arma "abre" el
## cono mientras se mantiene el gatillo y se cierra al soltar. Es lo que hace
## legible una ráfaga frente a disparos sueltos.
var spread_heat: float = 0.0
const SPREAD_HEAT_MAX := 2.6

func setup(owner_actor: Node, owner_camera: Camera3D = null, controls: Node = null) -> void:
	actor = owner_actor
	camera = owner_camera
	mobile_controls = controls
	muzzle_flash_scale = current_definition().muzzle_flash_scale
	rng.randomize()
	shot_audio = AudioStreamPlayer3D.new()
	shot_audio.name = "WeaponSfx"
	shot_audio.bus = "SFX"
	shot_audio.max_distance = 42.0
	add_child(shot_audio)
	# Capa de cola: la misma muestra más grave y baja, en paralelo, para dar
	# cuerpo al disparo sin depender de samples nuevos.
	shot_tail_audio = AudioStreamPlayer3D.new()
	shot_tail_audio.name = "WeaponTailSfx"
	shot_tail_audio.bus = "SFX"
	add_child(shot_tail_audio)
	reload_audio = AudioStreamPlayer3D.new()
	reload_audio.name = "ReloadSfx"
	reload_audio.bus = "SFX"
	reload_audio.max_distance = 20.0
	add_child(reload_audio)
	switch_audio = AudioStreamPlayer3D.new()
	switch_audio.name = "SwitchSfx"
	switch_audio.bus = "SFX"
	switch_audio.max_distance = 20.0
	add_child(switch_audio)
	empty_audio = AudioStreamPlayer3D.new()
	empty_audio.name = "EmptySfx"
	empty_audio.bus = "SFX"
	empty_audio.max_distance = 16.0
	add_child(empty_audio)
	impact_audio = AudioStreamPlayer3D.new()
	impact_audio.name = "ImpactSfx"
	impact_audio.bus = "SFX"
	impact_audio.max_distance = 28.0
	add_child(impact_audio)
	combat_fx = CombatFX.new()
	combat_fx.name = "CombatFX"
	add_child(combat_fx)
	_reset_ammo_from_definitions()
	available_indices.clear()
	for index: int in range(DEFINITIONS.size()):
		available_indices.append(index)
	_refresh_presentation()
	_emit_ammo()

func _physics_process(delta: float) -> void:
	recoil_amount = move_toward(recoil_amount, 0.0, delta * (2.2 + current_definition().recoil * 4.0))
	spread_heat = move_toward(spread_heat, 0.0, delta * (2.4 + current_definition().recoil * 26.0))
	_update_muzzle_anchor()
	cooldown = maxf(0.0, cooldown - delta)
	if switching_timer > 0.0:
		switching_timer = maxf(0.0, switching_timer - delta)
	if reload_timer > 0.0:
		reload_timer = maxf(0.0, reload_timer - delta)
		if reload_timer <= 0.0:
			_finish_reload()
		return
	if actor == null or not actor.get("is_alive"):
		return
	if fire_held:
		if current_definition().automatic or not previous_fire:
			try_fire()
	previous_fire = fire_held
	if not fire_held:
		previous_fire = false

func current_definition() -> WeaponDefinition:
	return DEFINITIONS[clampi(active_index, 0, DEFINITIONS.size() - 1)]

func set_available_weapons(indices: Array, preferred_index: int = -1) -> void:
	var sanitized: Array[int] = []
	for value: Variant in indices:
		var index := int(value)
		if index >= 0 and index < DEFINITIONS.size() and not sanitized.has(index):
			sanitized.append(index)
	if sanitized.is_empty():
		sanitized.append(1)
	available_indices = sanitized
	var desired := active_index
	if preferred_index >= 0 and available_indices.has(preferred_index):
		desired = preferred_index
	elif not available_indices.has(desired):
		desired = available_indices[0]
	if desired != active_index:
		active_index = desired
		reload_timer = 0.0
		switching_timer = 0.0
		_refresh_presentation()
		_emit_ammo()
		weapon_changed.emit(current_definition())

func is_weapon_available(index: int) -> bool:
	return available_indices.has(index)

func set_fire_held(value: bool) -> void:
	fire_held = value

func set_aim_held(value: bool) -> void:
	aim_held = value

func clear_combat_input() -> void:
	fire_held = false
	aim_held = false
	previous_fire = false
	cooldown = 0.0
	reload_timer = 0.0
	switching_timer = 0.0
	spread_heat = 0.0
	ai_target = null
	ai_can_see = false

func can_use_combat() -> bool:
	if actor == null or not bool(actor.get("is_alive")):
		return false
	if actor.has_method("can_use_combat"):
		return bool(actor.can_use_combat())
	var context: Node = actor.get("match_context")
	return context == null or not context.has_method("is_combat_active") or bool(context.is_combat_active())

func set_ai_target(target: Node, can_see: bool) -> void:
	ai_target = target
	ai_can_see = can_see

func switch_to(index: int) -> bool:
	if index < 0 or index >= DEFINITIONS.size() or not available_indices.has(index):
		return false
	if index == active_index:
		return true
	if reload_timer > 0.0:
		reload_timer = 0.0
	active_index = index
	switching_timer = 0.34
	spread_heat = 0.0
	_refresh_presentation()
	_emit_ammo()
	weapon_changed.emit(current_definition())
	_play_switch()
	return true

func next_weapon() -> void:
	if available_indices.is_empty():
		return
	var slot := available_indices.find(active_index)
	if slot < 0:
		slot = 0
	switch_to(available_indices[(slot + 1) % available_indices.size()])

func previous_weapon() -> void:
	if available_indices.is_empty():
		return
	var slot := available_indices.find(active_index)
	if slot < 0:
		slot = 0
	switch_to(available_indices[(slot - 1 + available_indices.size()) % available_indices.size()])

func request_reload() -> void:
	if not can_use_combat() or reload_timer > 0.0 or switching_timer > 0.0:
		return
	if ammo.size() <= active_index or reserve.size() <= active_index:
		return
	var definition := current_definition()
	if ammo[active_index] >= definition.magazine_size or reserve[active_index] <= 0:
		return
	reload_timer = definition.reload_time
	spread_heat = 0.0
	_play_reload("start")

func try_fire() -> bool:
	if not can_use_combat() or switching_timer > 0.0 or reload_timer > 0.0 or cooldown > 0.0:
		return false
	if ammo.size() <= active_index or reserve.size() <= active_index:
		return false
	var definition := current_definition()
	if ammo[active_index] <= 0:
		_play_empty()
		request_reload()
		return false
	ammo[active_index] -= 1
	cooldown = definition.fire_interval
	var recoil_scale := 0.76 if aim_held else 1.0
	recoil_amount = minf(0.26, recoil_amount + definition.recoil * 2.4 * recoil_scale)
	spread_heat = minf(SPREAD_HEAT_MAX, spread_heat + (0.34 + definition.recoil * 5.0) * recoil_scale)
	if actor != null and actor.has_method("break_spawn_immunity"):
		actor.break_spawn_immunity()
	if actor != null and actor.has_method("apply_weapon_recoil"):
		actor.apply_weapon_recoil(definition.recoil, aim_held)
	_emit_ammo()
	weapon_fired.emit(definition)
	_play_shot(definition.id)
	_show_muzzle_flash()
	_emit_muzzle_fx(definition)
	impact_played_this_shot = false
	for pellet: int in range(definition.pellets):
		_fire_pellet(definition, pellet)
	return true


## Fogonazo (luz + humo) y casquillo: presupuesto fijo de 1 luz + 1 quad + 1
## casquillo por disparo, servido desde piscinas en CombatFX.
func _emit_muzzle_fx(definition: WeaponDefinition) -> void:
	if combat_fx == null or muzzle_anchor == null or not is_instance_valid(muzzle_anchor):
		return
	var muzzle := muzzle_anchor.global_position
	var basis := muzzle_anchor.global_transform.basis
	# El cañón vive en el +Z del montaje: el marker de boca cuelga a +0,67 m
	# (rifle) / +0,15 m (pistola) y el humo debe salir POR DELANTE de esa boca.
	# Con -Z el humo nacía detrás y derivaba hacia la cara del tirador, y el
	# casquillo aparecía flotando 22 cm delante del cañón.
	var forward := basis.z
	var flash_scale := clampf(muzzle_flash_scale, 0.6, 2.0)
	combat_fx.muzzle_burst(muzzle, forward, flash_scale)
	combat_fx.shell_eject(muzzle - forward * 0.22, basis.x, basis.y)


func _muzzle_origin() -> Vector3:
	if muzzle_anchor != null and is_instance_valid(muzzle_anchor):
		return muzzle_anchor.global_position
	return _aim_origin()


## Lo que la mira cubre: primer obstáculo del rayo de cámara, o el alcance
## máximo del arma cuando no hay nada delante. La boca debe poder llegar a ese
## punto, así que la cobertura frente al cañón sigue bloqueando el disparo.
func _intended_point(aim_origin: Vector3, direction: Vector3, range_meters: float) -> Vector3:
	if actor == null or not actor.is_inside_tree():
		return aim_origin + direction * range_meters
	var query := PhysicsRayQueryParameters3D.create(aim_origin, aim_origin + direction * range_meters)
	query.collision_mask = 1 | 2 | 4
	query.collide_with_areas = true
	query.exclude = _shot_excludes()
	var hit: Dictionary = actor.get_world_3d().direct_space_state.intersect_ray(query)
	if hit.is_empty():
		return aim_origin + direction * range_meters
	return hit["position"]


## Cuerpo propio y hitbox de cabeza propia nunca cuentan como obstáculo.
func _shot_excludes() -> Array[RID]:
	var excluded: Array[RID] = []
	if actor is CollisionObject3D:
		excluded.append((actor as CollisionObject3D).get_rid())
	if actor != null:
		var own_head := actor.get_node_or_null("HeadHitbox") as CollisionObject3D
		if own_head != null:
			excluded.append(own_head.get_rid())
	return excluded


## Margen con el que el rayo de la boca rebasa el punto de la mira: sin él, un
## impacto que cae justo en la superficie puede quedar fuera del segmento.
const CONVERGENCE_BACKSTOP := 0.02


func _fire_pellet(definition: WeaponDefinition, pellet_index: int) -> void:
	# La cámara decide hacia dónde quiere disparar; la boca real decide desde
	# dónde puede salir la bala. Antes el raycast nacía en la cámara TPS, de
	# modo que asomarse con el hombro permitía dañar a través de una cobertura
	# que todavía bloqueaba físicamente el cañón.
	var aim_origin: Vector3 = _aim_origin()
	var direction: Vector3 = _aim_direction()
	var spread := definition.spread * (1.0 + spread_heat * (0.42 if aim_held else 0.95))
	if actor != null and actor.get("is_bot"):
		if ai_target == null or not ai_can_see:
			return
		var target_point: Vector3 = ai_target.get_target_point() if ai_target.has_method("get_target_point") else ai_target.global_position + Vector3.UP
		direction = aim_origin.direction_to(target_point)
		var accuracy: float = float(actor.get("bot_accuracy")) if actor.get("bot_accuracy") != null else 0.65
		spread *= lerpf(1.8, 0.25, accuracy)
		direction = _spread_direction(direction, spread)
	else:
		direction = _spread_direction(direction, spread * (0.55 if aim_held else 1.0))

	# Bala y mira comparten punto: la boca dispara HACIA el punto que la mira ya
	# cubre, no paralela a la cámara. Con convergencia lejana el cañón quedaba a
	# 0,77 m del eje de cámara y el disparo caía a esa distancia del retículo a
	# cualquier alcance normal; con la convergencia al punto real, la cobertura
	# sigue ganando porque el rayo completo sigue naciendo en la boca.
	var intended_point := _intended_point(aim_origin, direction, definition.range)
	var origin := _muzzle_origin()
	var muzzle_to_intended := intended_point - origin
	var intended_distance := muzzle_to_intended.length()
	if intended_distance < 0.0001:
		return
	# Terminar exactamente sobre la superficie del objetivo deja el impacto al
	# borde numérico del rayo: 1 de cada 3 disparos no encontraba nada. El punto
	# se rebasa CONVERGENCE_BACKSTOP para que el primer obstáculo sea el que la
	# mira ya cubría.
	var end := origin + (muzzle_to_intended / intended_distance) * minf(intended_distance + CONVERGENCE_BACKSTOP, definition.range)
	var shot_direction := origin.direction_to(end)
	var query := PhysicsRayQueryParameters3D.create(origin, end)
	query.collision_mask = 1 | 2 | 4
	# HeadHitbox es Area3D (capa 4). PhysicsRayQueryParameters3D ignora áreas
	# por defecto; sin esta bandera el multiplicador de headshot es inalcanzable.
	query.collide_with_areas = true
	query.exclude = _shot_excludes()
	var hit: Dictionary = actor.get_world_3d().direct_space_state.intersect_ray(query)
	if combat_fx != null:
		# Una sola trazadora por disparo: en escopeta (8 perdigones) dibujar
		# ocho beams multiplica el coste sin cambiar la lectura en pantalla.
		if pellet_index == 0:
			var tracer_end := origin + shot_direction * minf(origin.distance_to(end), 30.0)
			if not hit.is_empty():
				tracer_end = hit.position
			combat_fx.tracer(origin, tracer_end)
	if hit.is_empty():
		return
	var collider: Object = hit.get("collider")
	var target := _find_actor(collider)
	if target == null or not target.has_method("get_team"):
		if combat_fx != null:
			combat_fx.impact(hit.position, hit.get("normal", Vector3.UP))
		_play_impact_once()
		return
	if actor.has_method("get_team") and target.get_team() == actor.get_team():
		return
	# La esfera de cabeza está DENTRO de la cápsula del cuerpo: el rayo siempre
	# toca primero el cuerpo, así que apuntar a la cabeza visible no contaba.
	# Cuando el cuerpo gana el trazo, se pregunta explícitamente por la capa de
	# cabeza (4) y, si es del mismo actor, ese es el punto de impacto real.
	if not is_headshot_collider(collider) and actor != null and actor.is_inside_tree():
		# El segmento del cuerpo termina en su superficie: la esfera de cabeza
		# queda por dentro, así que la consulta de cabeza recorre la línea del
		# disparo un metro más allá del primer impacto (sobra para atravesar el
		# actor). Sólo cuenta si la cabeza es del MISMO actor.
		var head_distance := minf(definition.range, origin.distance_to(hit.position) + 1.0)
		var head_query := PhysicsRayQueryParameters3D.create(origin, origin + shot_direction * head_distance)
		head_query.collision_mask = 4
		head_query.collide_with_areas = true
		head_query.exclude = _shot_excludes()
		var head_hit: Dictionary = actor.get_world_3d().direct_space_state.intersect_ray(head_query)
		if not head_hit.is_empty() and _find_actor(head_hit.get("collider")) == target:
			hit = head_hit
			collider = head_hit.get("collider")
	var distance: float = origin.distance_to(hit.position)
	var multiplier: float = 1.0
	var headshot := false
	if is_headshot_collider(collider):
		multiplier = definition.headshot_multiplier
		headshot = true
	var falloff := 1.0
	if distance > definition.falloff_start:
		falloff = lerpf(1.0, definition.falloff_min, inverse_lerp(definition.falloff_start, definition.range, distance))
	var damage: float = definition.damage * multiplier * falloff
	if not target.has_method("take_damage") or not bool(target.take_damage(damage, actor, headshot)):
		# Spawn shield / inactive combat rejected the hit. Do not lie to the
		# shooter with blood, damage numbers or a hit marker for damage that did
		# not actually enter the victim.
		return
	if combat_fx != null:
		combat_fx.impact(hit.position, hit.get("normal", Vector3.UP), true)
	damage_confirmed.emit(damage, headshot)

func is_headshot_collider(collider: Object) -> bool:
	return collider is Area3D and collider.get_meta("damage_zone", "") == "head"

func _find_actor(value: Object) -> Node:
	var node := value as Node
	for _index: int in range(6):
		if node == null:
			return null
		if node.has_method("take_damage") and node.has_method("get_team"):
			return node
		node = node.get_parent()
	return null

func _aim_origin() -> Vector3:
	if actor != null and actor.has_method("get_aim_origin"):
		return actor.get_aim_origin()
	if camera != null:
		return camera.global_position
	return global_position

func _aim_direction() -> Vector3:
	if actor != null and actor.get("is_bot") and ai_target != null:
		return _aim_origin().direction_to(ai_target.get_target_point())
	var base_direction: Vector3 = -camera.global_transform.basis.z if camera != null else -global_transform.basis.z
	if actor != null and actor.has_method("get_mobile_assisted_direction"):
		return actor.get_mobile_assisted_direction(base_direction, current_definition().range)
	if camera != null:
		return -camera.global_transform.basis.z
	return -global_transform.basis.z

func _spread_direction(direction: Vector3, amount: float) -> Vector3:
	var right := direction.cross(Vector3.UP).normalized()
	if right.length_squared() < 0.01:
		right = Vector3.RIGHT
	var up := right.cross(direction).normalized()
	return (direction + right * rng.randf_range(-amount, amount) + up * rng.randf_range(-amount, amount)).normalized()

func _finish_reload() -> void:
	var definition := current_definition()
	var needed: int = definition.magazine_size - ammo[active_index]
	var moved: int = mini(needed, reserve[active_index])
	ammo[active_index] += moved
	reserve[active_index] -= moved
	_emit_ammo()
	_play_reload("end")

func _reset_ammo_from_definitions() -> void:
	ammo.clear()
	reserve.clear()
	for definition: WeaponDefinition in DEFINITIONS:
		ammo.append(definition.magazine_size)
		reserve.append(definition.reserve_ammo)

func _emit_ammo() -> void:
	if DEFINITIONS.is_empty() or ammo.size() < DEFINITIONS.size() or reserve.size() < DEFINITIONS.size():
		return
	ammo_changed.emit(ammo[active_index], reserve[active_index], current_definition())

func _refresh_presentation() -> void:
	muzzle_flash_scale = current_definition().muzzle_flash_scale
	if actor == null:
		return
	var actor_visual := actor.get("visual") as Node
	if actor_visual != null and actor_visual.has_method("set_equipped_weapon"):
		actor_visual.call("set_equipped_weapon", current_definition().id, _current_weapon_skin())
	if muzzle_anchor == null or not is_instance_valid(muzzle_anchor):
		_create_muzzle_anchor()
	_update_muzzle_anchor()


func _create_muzzle_anchor() -> void:
	if muzzle_anchor != null and is_instance_valid(muzzle_anchor):
		muzzle_anchor.queue_free()
	muzzle_anchor = Node3D.new()
	muzzle_anchor.name = "MuzzleAnchor"
	muzzle_anchor.top_level = true
	add_child(muzzle_anchor)


func _update_muzzle_anchor() -> void:
	if muzzle_anchor == null or actor == null or not is_inside_tree() or not actor.is_inside_tree():
		return
	var actor_visual := actor.get("visual") as Node
	if actor_visual != null and actor_visual.has_method("get_muzzle_global_position"):
		var muzzle_marker_position: Vector3 = actor_visual.call("get_muzzle_global_position")
		muzzle_anchor.global_position = muzzle_marker_position
		var marker: Node3D = actor_visual.get("muzzle_marker") as Node3D
		if marker != null and is_instance_valid(marker):
			muzzle_anchor.global_transform = marker.global_transform
			# Patada visual: la boca sube con el retroceso acumulado. Se aplica
			# sobre la copia del marker, así el arma nunca se queda desfasada.
			if recoil_amount > 0.0005:
				var basis := muzzle_anchor.global_transform.basis
				muzzle_anchor.global_basis = basis.rotated(basis.x, recoil_amount * 0.9)
		else:
			muzzle_anchor.global_rotation = actor.global_rotation
	else:
		muzzle_anchor.global_position = actor.global_position + Vector3(0.0, 1.35, -0.75)


func _current_weapon_skin() -> String:
	# Match.configure() ya recibió la selección del lobby/QA: esa es la verdad
	# de esta partida. SettingsStore queda como fallback para usos aislados del
	# controlador, evitando que un arranque QA enseñe una skin distinta a la
	# que el match pidió explícitamente.
	if actor != null:
		var context: Node = actor.get("match_context")
		if context != null:
			var configured: Variant = context.get("weapon_skin")
			if configured != null and not str(configured).is_empty():
				return str(configured)
	var settings := get_node_or_null("/root/SettingsStore") if is_inside_tree() else null
	return str(settings.get_value("weapon_skin", "Estándar") if settings != null else "Estándar")

func _show_muzzle_flash() -> void:
	if muzzle_anchor == null or not is_instance_valid(muzzle_anchor):
		_create_muzzle_anchor()
	if muzzle_anchor == null:
		return
	if not is_instance_valid(muzzle_flash):
		muzzle_flash = MeshInstance3D.new()
		muzzle_flash.name = "MuzzleFlash"
		# Irregular 6-point star flash built from triangles: no flat rectangle,
		# reads as a burst from any angle. Two crossed fans scale per weapon.
		muzzle_flash.mesh = _muzzle_flash_mesh()
		muzzle_flash.material_override = _muzzle_flash_material()
		muzzle_flash.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		muzzle_anchor.add_child(muzzle_flash)
		muzzle_flash.position = Vector3(0.0, 0.0, 0.03)
	var flash_scale := maxf(0.6, muzzle_flash_scale)
	# El flash de boca se dimensiona para leerse en móvil: a escala 1.0 el abanico
	# de pétalos media ~0.03 unidades en mundo y se perdía contra el cañón. El
	# factor 2.2 lo hacía ocupar ~0,5 m en cámara de hombro y tapaba al
	# personaje; 1.1 lo deja del ancho del arma.
	muzzle_flash.scale = Vector3.ONE * flash_scale * 1.1
	# Random roll around the barrel axis so each shot reads unique.
	muzzle_flash.rotation = Vector3(0.0, 0.0, rng.randf_range(0.0, TAU))
	muzzle_flash.visible = true
	muzzle_flash.transparency = 0.0
	var tween := create_tween()
	# 45 ms was effectively invisible in a 60 fps Android capture. Keep the
	# burst attached to the imported muzzle but give it two rendered frames.
	# `maxf` garantiza esos dos frames incluso en un dispositivo lento o tras
	# un hitch de arranque (un delta grande consumía el tween en un frame).
	var fade_time := maxf(0.085, 2.0 * get_process_delta_time())
	tween.tween_property(muzzle_flash, "transparency", 0.85, fade_time)
	tween.tween_callback(func() -> void:
		if is_instance_valid(muzzle_flash):
			muzzle_flash.visible = false
	)

## Star-shaped flash: petals in the barrel plane (XY) + forward petal along +Z.
func _muzzle_flash_mesh() -> ArrayMesh:
	var verts := PackedVector3Array()
	var indices := PackedInt32Array()
	var center := verts.size()
	verts.append(Vector3(0, 0, 0.0))
	var petals := 5
	for i: int in range(petals * 2):
		var angle := TAU * float(i) / float(petals * 2)
		var radius := 0.16 if i % 2 == 0 else 0.06
		verts.append(Vector3(cos(angle) * radius, sin(angle) * radius, 0.0))
	for i: int in range(petals):
		# Puntas reales: se usan los vértices interiores (2,4,6,8,10). El fan
		# anterior los ignoraba y el "flash" salía como un pentágono plano.
		var outer_a := center + 1 + i * 2
		var inner := center + 1 + (i * 2 + 1) % (petals * 2)
		var outer_b := center + 1 + ((i * 2 + 2) % (petals * 2))
		indices.append_array([center, outer_a, inner])
		indices.append_array([center, inner, outer_b])
	# Forward petal: three thin triangles pointing +Z (out of the barrel).
	var forward := verts.size()
	verts.append(Vector3(0, 0, 0.34))
	for i: int in range(3):
		var a := deg_to_rad(-40.0 + 40.0 * i)
		verts.append(Vector3(cos(a) * 0.045, sin(a) * 0.045, 0.02))
	for i: int in range(3):
		indices.append(forward)
		indices.append(forward + 1 + i)
		indices.append(forward + 1 + ((i + 1) % 3))
	var arrays_mesh := ArrayMesh.new()
	var arrays_data := []
	arrays_data.resize(Mesh.ARRAY_MAX)
	arrays_data[Mesh.ARRAY_VERTEX] = verts
	arrays_data[Mesh.ARRAY_INDEX] = indices
	arrays_mesh.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arrays_data)
	return arrays_mesh

func _muzzle_flash_material() -> StandardMaterial3D:
	var material := StandardMaterial3D.new()
	material.albedo_color = Color("#ffd45a")
	material.emission_enabled = true
	material.emission = Color("#ff8d30")
	material.emission_energy_multiplier = 3.4
	material.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	material.billboard_mode = BaseMaterial3D.BILLBOARD_DISABLED
	material.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	material.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
	material.cull_mode = BaseMaterial3D.CULL_DISABLED
	material.albedo_color.a = 0.9
	return material

func _play_shot(weapon_id: String) -> void:
	if shot_audio == null:
		return
	var paths: Dictionary = {
		"rifle": "shot_rifle",
		"pistol": "shot_pistol",
		"shotgun": "shot_shotgun",
		"smg": "shot_smg"
	}
	if not shot_streams.has(weapon_id):
		shot_streams[weapon_id] = CombatAudio.stream(str(paths.get(weapon_id, "")))
	shot_audio.stream = shot_streams[weapon_id]
	# Sin sample propio de SMG en el repo: comparte el de rifle una octava de
	# cadencia más rápido y medio tono más grave (no acelerado-agudo), con un
	# poco menos de nivel porque su cadencia apila más energía.
	# Rifle y shotgun tienen picos a +1.4 dBFS en el archivo (ffprobe/astats):
	# -2.0 dB en reproducción devuelve margen sin tocar los assets CC-BY.
	if weapon_id == "smg":
		shot_audio.pitch_scale = 0.94
		shot_audio.volume_db = -3.4
	elif weapon_id == "shotgun":
		shot_audio.pitch_scale = 0.88
		shot_audio.volume_db = -2.0
	elif weapon_id == "rifle":
		shot_audio.pitch_scale = 1.0
		shot_audio.volume_db = -2.0
	else:
		shot_audio.pitch_scale = 1.0
		shot_audio.volume_db = 0.0
	# Variación perceptual (±60 cents) + falloff 3D: sin esto cada disparo de
	# una ráfaga es el mismo sample y el arma suena a bucle.
	var base_pitch := shot_audio.pitch_scale
	var base_volume := shot_audio.volume_db
	shot_audio.pitch_scale = CombatAudio.jitter_pitch(base_pitch)
	CombatAudio.configure_falloff(shot_audio, 46.0, 5.0)
	shot_audio.play()
	if shot_tail_audio != null:
		shot_tail_audio.stream = shot_audio.stream
		shot_tail_audio.pitch_scale = CombatAudio.jitter_pitch(base_pitch * 0.74)
		shot_tail_audio.volume_db = CombatAudio.tail_volume_db(base_volume)
		CombatAudio.configure_falloff(shot_tail_audio, 58.0, 7.0)
		shot_tail_audio.play()

func _play_reload(phase: String) -> void:
	if reload_audio == null:
		return
	var path := "reload_start" if phase == "start" else "reload_end"
	reload_audio.stream = CombatAudio.stream(path) as AudioStream
	reload_audio.pitch_scale = CombatAudio.jitter_pitch(1.0, 0.05)
	CombatAudio.configure_falloff(reload_audio, 22.0, 2.4)
	reload_audio.play()

func _play_switch() -> void:
	if switch_audio == null:
		return
	switch_audio.stream = CombatAudio.stream("switch") as AudioStream
	switch_audio.pitch_scale = CombatAudio.jitter_pitch(1.0, 0.05)
	CombatAudio.configure_falloff(switch_audio, 22.0, 2.4)
	switch_audio.play()

func _play_empty() -> void:
	if empty_audio == null:
		return
	empty_audio.stream = CombatAudio.stream("empty") as AudioStream
	empty_audio.pitch_scale = CombatAudio.jitter_pitch(1.0, 0.06)
	CombatAudio.configure_falloff(empty_audio, 18.0, 2.0)
	empty_audio.play()

func _play_impact_once() -> void:
	if impact_played_this_shot or impact_audio == null:
		return
	impact_played_this_shot = true
	impact_audio.stream = CombatAudio.stream("impact_wall") as AudioStream
	impact_audio.pitch_scale = CombatAudio.jitter_pitch(1.0, 0.07)
	CombatAudio.configure_falloff(impact_audio, 30.0, 3.0)
	impact_audio.play()
