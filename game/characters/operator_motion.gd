class_name OperatorMotion
extends RefCounted

## Evaluador único de clips. AnimationPlayer es biblioteca/visor, nunca reloj
## paralelo. Orden: base direccional → torso → reacción → commit; OperatorVisual
## termina con mirada → montaje → IK. Ninguna capa decide gameplay.
## Switch cancela reload (contrato WeaponController); daño no cancela acciones.
## Land sólo afecta base; Fire sólo procede de un disparo confirmado. Death
## captura la pose final, cancela todos los canales y bloquea hasta reset().
##
## Contrato de velocidad: gameplay declara la CLASE (sprint_intent) y la
## velocidad real (m/s). Los clips declaran su velocidad de suelo implícita en
## `locomotion_speeds.json`, generado por tools/make_anim_clips.py: el clip se
## reproduce a `velocidad_real / implícita`, así el pie no patina y la cadencia
## es la que el cuerpo puede dar. Clase y velocidad son problemas distintos:
## la clase elige el clip, la velocidad fija la reproducción.
enum Action { READY, RELOAD, SWITCH }
const UPPER := ["Abdomen", "Torso", "Chest", "Neck", "Head", "Shoulder.L", "Shoulder.R", "UpperArm.L", "UpperArm.R", "LowerArm.L", "LowerArm.R", "Wrist.L", "Wrist.R"]
const REACTION := ["Abdomen", "Torso", "Chest", "Neck", "Head"]
## Frenada: clip de absorción, no locomoción. Se pide por intención (gameplay o
## laboratorio) y no declara velocidad de suelo: sólo acompaña la parada.
const BRAKE := "ual/Brake"
const LOCO_WALK := "ual/WalkFwd"
const LOCO_SPRINT := "ual/SprintFwd"
const LOCO_BACK := "ual/BackWalk"
const LOCO_SIDE_L := "ual/StrafeLeft"
const LOCO_SIDE_R := "ual/StrafeRight"
const CROUCH_FWD := "ual/CrouchWalk"
const CROUCH_BACK := "ual/CrouchBack"
const CROUCH_SIDE_L := "ual/CrouchLeft"
const CROUCH_SIDE_R := "ual/CrouchRight"
## Recarga visual por arma. Arma larga = dos manos y cargador del cinturón;
## pistola = recorrido corto desde la cadera y pestillo de corredera. Es una
## tabla de PRESENTACIÓN: no altera tiempos ni munición.
const RELOAD_CLIP_BY_WEAPON := {
	"rifle": "ual/ReloadRifle",
	"shotgun": "ual/ReloadRifle",
	"smg": "ual/ReloadRifle",
	"pistol": "ual/ReloadPistol",
}
## Velocidad implícita declarada por el pipeline de Blender. Sin el archivo se
## usan los valores de gameplay para no calibrar a ciegas.
static var DECLARED_SPEEDS: Dictionary = _load_declared_speeds()
## Eje de avance (espacio del actor) que el pipeline declara para cada clip.
static var DECLARED_DIRECTIONS: Dictionary = _load_declared_directions()
var action := Action.READY
var dead := false
var grounded := true
var local_velocity := Vector3.ZERO # actor space: -Z forward, +X right
var crouched := false
var aiming := false
## Gameplay declara intención de sprint; la animación sólo la consume.
var sprint_intent := false
## Gameplay declara que el actor está frenando (venía con velocidad y la pierde).
var braking := false
var reload_remaining := 0.0
var reload_duration := 1.6
## El arma activa manda QUÉ lenguaje corporal de recarga se reproduce, pero no
## decide gameplay: el timer sigue siendo de WeaponController y aquí solo se
## consume su progreso normalizado. Rifle, escopeta y SMG comparten el lenguaje
## de arma larga; la pistola tiene el suyo (más corto y centrado).
var reload_weapon_id := "rifle"
var switch_remaining := 0.0
var reload_phase := 0.0
var reload_weight := 0.0
var switch_weight := 0.0
var aim_weight := 0.0
var recoil := 0.0
var recoil_strength := 1.0
var recoil_recovery := 16.0
var base_state := "Idle"
var phase := 0.0
var _clock := 0.0
var _air_time := 0.0
var _land_time := 10.0
var _flinch_time := 10.0
var _flinch_strength := 0.0
var _death_time := 0.0
var _grounded_before := true
var _move_weight := 0.0
var _sprint_weight := 0.0
var _crouch_weight := 0.0
var _brake_weight := 0.0
## Huesos que la frenada SÍ manda: cadera, columna y brazos cosméticos. Las
## piernas quedan fuera para no arrastrar el apoyo que sostiene el paso.
var _brake_mask: Array[int] = []
var _direction := Vector2(0, -1)
var _skel: Skeleton3D
var _clips: Dictionary = {}
var _upper: Array[int] = []
var _reaction: Array[int] = []
var _rest: Array[Transform3D] = []
var _pose: Array[Transform3D] = []
var _death_from: Array[Transform3D] = []
## Buffers reutilizados: samplear un clip cuesta ~20 interpolaciones de pista y
## 8 actores a 60 fps no perdonan una asignación por capa y por fotograma.
const _SLOT_COUNT := 9
var _slots: Array = []
var _slot_written: Array = []
var _position_bones: Array[int] = [0]

static func _load_declared_speeds() -> Dictionary:
	var parsed: Variant = JSON.parse_string(FileAccess.get_file_as_string("res://assets/models/animation_library/locomotion_speeds.json"))
	return parsed if parsed is Dictionary else {}


static func _load_declared_directions() -> Dictionary:
	var directions: Dictionary = {}
	for name: String in DECLARED_SPEEDS:
		var entry: Variant = DECLARED_SPEEDS[name]
		if not entry is Dictionary: continue
		var declared: Variant = entry.get("direction")
		if not declared is Array or (declared as Array).size() < 2: continue
		var vector := Vector2(float(declared[0]), float(declared[1]))
		if vector.length_squared() > 0.0001: directions[name] = vector.normalized()
	return directions

## Clip visual de recarga que corresponde al arma equipada. Sólo presentación.
func reload_clip() -> String:
	return RELOAD_CLIP_BY_WEAPON.get(reload_weapon_id, RELOAD_CLIP_BY_WEAPON["rifle"])


## Clase de recarga ("rifle"/"pistol") que consume el recorrido de mano publicado
## en reload_hand_path.json. Una sola tabla decide clip y recorrido: no pueden
## desincronizarse.
func reload_class() -> String:
	return "pistol" if reload_weapon_id == "pistol" else "rifle"


func declared_speed(clip: String) -> float:
	var short := clip.get_slice("/", 1) if clip.contains("/") else clip
	var entry: Variant = DECLARED_SPEEDS.get(short)
	if entry is Dictionary:
		return float(entry.get("speed", 0.0))
	return 0.0


## Eje de avance declarado del clip, en espacio del actor (x = derecha, y = atrás).
func declared_direction(clip: String) -> Vector2:
	var short := clip.get_slice("/", 1) if clip.contains("/") else clip
	var entry: Variant = DECLARED_DIRECTIONS.get(short)
	return entry if entry is Vector2 else Vector2(0.0, -1.0)

func setup(skel: Skeleton3D, player: AnimationPlayer) -> void:
	_skel = skel
	player.active = false
	for i in skel.get_bone_count():
		_rest.append(skel.get_bone_rest(i))
		if skel.get_bone_name(i) in UPPER: _upper.append(i)
		if skel.get_bone_name(i) in REACTION: _reaction.append(i)
		if skel.get_bone_name(i) in ["Hips", "Body", "Root"] + REACTION: _brake_mask.append(i)
	_pose = _rest.duplicate()
	for i in _SLOT_COUNT:
		_slots.append(_rest.duplicate())
		_slot_written.append([])
	# Escala fija y posiciones sólo donde hay pista: escribir los 22 huesos
	# cada fotograma costaba más que evaluar los clips.
	for i in skel.get_bone_count():
		skel.set_bone_pose_scale(i, Vector3.ONE)
	for name: String in player.get_animation_list():
		var clip := player.get_animation(name)
		var tracks: Array = []
		for t in clip.get_track_count():
			var path := clip.track_get_path(t)
			if path.get_subname_count() != 1 or not clip.track_is_enabled(t): continue
			var bone := skel.find_bone(path.get_subname(0))
			if bone >= 0 and clip.track_get_type(t) in [Animation.TYPE_ROTATION_3D, Animation.TYPE_POSITION_3D]:
				tracks.append([t, bone, clip.track_get_type(t)])
		var mask: Array[int] = []
		for channel: Array in tracks:
			var bone: int = channel[1]
			if not mask.has(bone): mask.append(bone)
			if channel[2] == Animation.TYPE_POSITION_3D and not _position_bones.has(bone):
				_position_bones.append(bone)
		_clips[name] = {"clip": clip, "tracks": tracks, "mask": mask}

func reset() -> void:
	dead = false
	crouched = false
	aiming = false
	sprint_intent = false
	braking = false
	local_velocity = Vector3.ZERO
	_crouch_weight = 0.0
	_brake_weight = 0.0
	action = Action.READY
	reload_remaining = 0.0
	switch_remaining = 0.0
	reload_weight = 0.0
	switch_weight = 0.0
	aim_weight = 0.0
	recoil = 0.0
	_land_time = 10.0
	_flinch_time = 10.0
	_air_time = 0.0
	_death_time = 0.0
	_grounded_before = true
	grounded = true
	_move_weight = 0.0
	_sprint_weight = 0.0
	_direction = Vector2(0, -1)
	phase = 0.0
	_pose.assign(_rest)

func die() -> void:
	if dead: return
	dead = true
	_death_time = 0.0
	_death_from.clear()
	for i in _skel.get_bone_count(): _death_from.append(_skel.get_bone_pose(i))
	action = Action.READY
	reload_weight = 0.0
	switch_weight = 0.0
	recoil = 0.0
	_flinch_time = 10.0
	_land_time = 10.0

func hit(strength: float) -> void:
	if dead: return
	_flinch_time = 0.0
	_flinch_strength = clampf(strength, 0.0, 1.0)

func shot(strength: float, recovery: float) -> void:
	if dead or reload_remaining > 0.0 or switch_remaining > 0.0: return
	recoil_strength = strength
	recoil_recovery = recovery
	recoil = minf(recoil + strength, strength * 1.5)

func length_of(name: String) -> float:
	return (_clips[name].clip as Animation).length if _clips.has(name) else 1.0


## Retroceso del apoyo que aporta la mezcla, proyectado sobre el rumbo de
## avance. Cada clip sólo retrocede por SU eje declarado en espacio del actor
## (x derecha, z atrás): en una diagonal los dos clips ortogonales aportan cada
## uno |eje·rumbo|, no una media de magnitudes escalares (que acortaba el paso
## y dejaba al apoyo patinando ~1.5 m/s).
func _stride_reach(entries: Array, heading: Vector3) -> float:
	var reach := 0.0
	for entry: Array in entries:
		var weight: float = entry[1]
		if weight <= 0.0001 or not _clips.has(entry[0]): continue
		var axis: Vector2 = declared_direction(entry[0])
		var along: float = absf(Vector3(axis.x, 0.0, axis.y).dot(heading))
		reach += weight * maxf(declared_speed(entry[0]), 0.1) * along
	return reach

## Samplea un clip en un buffer reutilizado (sin asignar memoria por capa).
## Sólo se resetean los huesos que el clip toca: el resto del buffer ya está en
## reposo y no se escribe.
func _sample_into(slot: int, name: String, time: float, loop: bool = false) -> Array[Transform3D]:
	var result: Array[Transform3D] = _slots[slot]
	if not _clips.has(name): return result
	var entry: Dictionary = _clips[name]
	var clip: Animation = entry.clip
	var t := fposmod(time, clip.length) if loop else clampf(time, 0.0, clip.length)
	# El buffer se comparte entre clips con máscaras distintas: se limpia todo
	# lo que quedó escrito antes, no sólo lo que este clip va a escribir.
	for idx: int in _slot_written[slot]:
		result[idx] = _rest[idx]
	_slot_written[slot] = entry.mask
	for channel: Array in entry.tracks:
		var idx: int = channel[1]
		if channel[2] == Animation.TYPE_ROTATION_3D:
			result[idx].basis = Basis(clip.rotation_track_interpolate(channel[0], t))
		else:
			result[idx].origin = clip.position_track_interpolate(channel[0], t)
	# Root horizontal is NEVER animation authority, including Death.
	result[0].origin.x = _rest[0].origin.x
	result[0].origin.z = _rest[0].origin.z
	return result

func _sample(name: String, time: float, loop: bool = false) -> Array[Transform3D]:
	var copy: Array[Transform3D] = _rest.duplicate()
	copy.assign(_sample_into(_SLOT_COUNT - 1, name, time, loop))
	return copy

func _blend(a: Array[Transform3D], b: Array[Transform3D], weight: float, mask: Array[int] = []) -> void:
	if mask.is_empty():
		for i in a.size():
			a[i] = a[i].interpolate_with(b[i], weight)
		return
	for i in mask:
		a[i] = a[i].interpolate_with(b[i], weight)

func _add_clip(name: String, time: float, weight: float, mask: Array[int]) -> void:
	if weight <= 0.0001 or time > length_of(name): return
	var sample := _sample_into(_SLOT_COUNT - 1, name, time)
	for i in mask:
		var delta := _rest[i].basis.get_rotation_quaternion().inverse() * sample[i].basis.get_rotation_quaternion()
		_pose[i].basis = _pose[i].basis * Basis(Quaternion.IDENTITY.slerp(delta, weight))

func evaluate(delta: float) -> void:
	_clock += delta
	if dead:
		_death_time += delta
		_pose.assign(_death_from)
		_blend(_pose, _sample_into(0, "Death", _death_time), smoothstep(0.0, 0.085, _death_time))
		_commit()
		return
	if grounded and not _grounded_before: _land_time = 0.0
	if not grounded and _grounded_before: _air_time = 0.0
	_grounded_before = grounded
	_air_time += delta
	_land_time += delta
	_flinch_time += delta
	action = Action.SWITCH if switch_remaining > 0.0 else (Action.RELOAD if reload_remaining > 0.0 else Action.READY)
	if action == Action.RELOAD:
		reload_phase = clampf(1.0 - reload_remaining / maxf(reload_duration, 0.01), 0.0, 1.0)
	else:
		reload_phase = minf(1.0, reload_phase + delta / maxf(reload_duration, 0.01))
	reload_weight = move_toward(reload_weight, 1.0 if action == Action.RELOAD else 0.0, delta / 0.12)
	switch_weight = move_toward(switch_weight, 1.0 if action == Action.SWITCH else 0.0, delta / 0.09)
	aim_weight = move_toward(aim_weight, 1.0 if aiming and action == Action.READY else 0.0, delta / (0.09 if aiming else 0.14))
	recoil *= exp(-recoil_recovery * delta)
	var speed := Vector2(local_velocity.x, local_velocity.z).length()
	# La salida de la marcha es RÁPIDA: si la pose se desvanece hacia el idle
	# mientras el pie sigue plantado, el apoyo se arrastra a la velocidad del
	# cuerpo (medido: 2.5 m/s de derrape). Mejor resolver la parada que fundirla.
	_move_weight = move_toward(_move_weight, smoothstep(0.08, 0.65, speed), delta / (0.11 if speed > 0.15 else 0.05))
	_crouch_weight = move_toward(_crouch_weight, 1.0 if crouched else 0.0, delta / (0.19 if crouched else 0.24))
	# La frenada entra rápido (el peso cae de golpe) y sale más lento (recupera).
	_brake_weight = move_toward(_brake_weight, 1.0 if braking else 0.0, delta / (0.16 if braking else 0.18))
	if speed > 0.15:
		var wanted := Vector2(local_velocity.x, local_velocity.z).normalized()
		var turn := wrapf(wanted.angle() - _direction.angle(), -PI, PI)
		# Normalized lerp cannot leave an exactly opposite unit vector. Turn
		# through the forward gait on lateral reversals, preserving cycle phase.
		if _direction.dot(wanted) < -0.9999 and absf(_direction.x) > 0.99:
			turn = PI if _direction.x < 0.0 else -PI
		_direction = _direction.rotated(turn * (1.0 - exp(-18.0 * delta)))
	# Clase de velocidad: gameplay decide, la animación sólo la consume.
	var walk_speed := maxf(declared_speed(LOCO_WALK), 0.1)
	var sprint_speed := maxf(declared_speed(LOCO_SPRINT), walk_speed)
	var sprint_target := smoothstep(walk_speed * 0.96, sprint_speed * 0.96, speed) if sprint_intent else 0.0
	_sprint_weight = move_toward(_sprint_weight, sprint_target, delta / 0.12)
	# Pesos de dirección normalizados (adelante / atrás / lateral). El lateral
	# vale 0 exactamente al cruzar el eje, así el cambio de clip no se ve.
	var fwd := maxf(0.0, -_direction.y)
	var back := maxf(0.0, _direction.y)
	var side := absf(_direction.x)
	var total := fwd + back + side
	if total > 0.0001:
		fwd /= total
		back /= total
		side /= total
	var walk_weight := fwd * (1.0 - _sprint_weight)
	var sprint_weight := fwd * _sprint_weight
	var walk_cycle := 0.0
	var walk_implied := 0.0
	var low_cycle := 0.0
	var low_implied := 0.0
	# La base sigue de pie mientras la capa baja entra/sale; seleccionar aquí
	# por el booleano crouched saltaba directamente al clip bajo en un frame.
	var entries: Array = [[LOCO_WALK, walk_weight], [LOCO_SPRINT, sprint_weight], [LOCO_BACK, back],
		[LOCO_SIDE_R if _direction.x > 0.0 else LOCO_SIDE_L, side]]
	var crouch_entries: Array = [[CROUCH_FWD, fwd], [CROUCH_BACK, back],
		[CROUCH_SIDE_R if _direction.x > 0.0 else CROUCH_SIDE_L, side]]
	for entry: Array in entries:
		var weight: float = entry[1]
		if weight <= 0.0001 or not _clips.has(entry[0]): continue
		walk_implied += weight * maxf(declared_speed(entry[0]), 0.1)
		walk_cycle += weight * length_of(entry[0])
	for entry: Array in crouch_entries:
		var weight: float = entry[1]
		if weight <= 0.0001 or not _clips.has(entry[0]): continue
		low_implied += weight * maxf(declared_speed(entry[0]), 0.1)
		low_cycle += weight * length_of(entry[0])
	if walk_implied <= 0.0001:
		walk_implied = walk_speed
		walk_cycle = length_of(LOCO_WALK)
	if low_implied <= 0.0001:
		low_implied = walk_speed
		low_cycle = length_of(LOCO_WALK)
	# Alcance real del apoyo: el pie del clip sólo retrocede por SU eje, así que
	# los clips perpendiculares de una diagonal no suman distancia de zancada
	# (magnitud escalar promedio acortaba el paso y el pie patinaba 1.5 m/s).
	# La ruta de pie y la de crouch comparten la proyección y el ciclo mezclado.
	var heading3 := Vector3(_direction.x, 0.0, _direction.y)
	var walk_reach := _stride_reach(entries, heading3)
	if walk_reach <= 0.0001: walk_reach = walk_implied
	var low_reach := _stride_reach(crouch_entries, heading3)
	if low_reach <= 0.0001: low_reach = low_implied
	var stride := lerpf(walk_reach * walk_cycle, low_reach * low_cycle, _crouch_weight)
	if speed > 0.15:
		# Con la frenada encima el paso DEJA de avanzar: si el reloj siguiera
		# girando a velocidad plena mientras el cuerpo para, el pie plantado
		# derrapara contra el suelo a esa velocidad.
		phase = fposmod(phase + delta * speed * (1.0 - _brake_weight) / maxf(stride, 0.01), 1.0)
	else:
		# Parado: la fase ASIENTA en un contacto en vez de congelarse a mitad de
		# zancada. Un pie en el aire y quieto se lee como maniquí; se elige el
		# contacto más cercano hacia adelante y se llega en ~0.2 s.
		var settle := fposmod(0.0 - phase, 1.0)
		if settle > 0.0 and settle <= 0.5:
			phase = fposmod(phase + minf(settle, delta * 2.5), 1.0)
	# Idle_Gun se samplea UNA vez por fotograma y sirve de base y de capa de arma.
	var idle := _sample_into(0, "Idle_Gun", _clock, true)
	_pose.assign(idle)
	if _move_weight > 0.0:
		_blend(_pose, _blend_clips(entries, 2), _move_weight)
	if _crouch_weight > 0.0:
		var low := _sample_into(5, "ual/CrouchIdle", _clock, true)
		var crouch_move := _blend_clips(crouch_entries, 6)
		_blend(low, crouch_move, _move_weight)
		_blend(_pose, low, _crouch_weight)
	# La frenada va DESPUÉS de la base: absorbe sobre la pose que ya existe. NO
	# escribe piernas: el clip baja el centro de masas y echa el torso atrás, y
	# quien decide dónde está el apoyo sigue siendo el ciclo de locomoción que
	# está saliendo. Mezclar aquí la pose de piernas del clip arrastraba el pie
	# plantado 0.37 m hacia la postura neutra antes de que el paso desapareciera.
	if _brake_weight > 0.0 and _clips.has(BRAKE):
		# Ancla en el fotograma de máxima absorción (0.09 s del clip): con menos
		# peso el clip avanza desde ahí hacia la recuperación, no al revés.
		var brake_peak := minf(0.09, length_of(BRAKE))
		var brake_time := brake_peak + (1.0 - _brake_weight) * maxf(length_of(BRAKE) - brake_peak, 0.0)
		_blend(_pose, _sample_into(8, BRAKE, brake_time), _brake_weight, _brake_mask)
	base_state = "Crouch" if crouched else ("Brake" if _brake_weight > 0.5 else ("Move" if speed > 0.15 else "Idle"))
	if not grounded:
		var air := _sample_into(4, "ual/JumpStart", _air_time)
		_blend(air, _sample_into(5, "ual/AirLoop", _air_time, true), smoothstep(0.12, 0.26, _air_time))
		# Extend during descent using measured vertical velocity, before contact.
		_blend(air, _sample_into(6, "ual/Land", 0.0), smoothstep(1.5, 5.0, -local_velocity.y))
		_blend(_pose, air, smoothstep(0.0, 0.10, _air_time))
		base_state = "Air"
	elif _land_time < length_of("ual/Land"):
		# Land fades over moving legs rather than freezing locomotion.
		_blend(_pose, _sample_into(4, "ual/Land", _land_time), (1.0 - smoothstep(0.08, 0.32, _land_time)) * (0.75 if crouched else 1.0))
		base_state = "Land"
	# A alta velocidad el torso autorado (inclinación, contrarrotación) tiene que
	# sobrevivir: la capa de arma baja de peso en vez de congelar la espalda.
	var upper_weight := lerpf(lerpf(0.65, 0.42, clampf(speed / maxf(sprint_speed, 0.1), 0.0, 1.0)), 0.85, aim_weight)
	var hold := idle
	if aim_weight > 0.0:
		hold = _sample_into(1, "Idle_Aim", _clock, true)
		_blend(hold, idle, 1.0 - aim_weight, _upper)
	# La espalda conserva el impulso/contrapeso del clip. Brazos mantienen
	# su estabilización y OperatorVisual resuelve el agarre después de esta capa.
	for bone in _upper:
		var weight := upper_weight
		if bone in _reaction:
			weight *= lerpf(1.0, 0.45, _move_weight)
		_pose[bone] = _pose[bone].interpolate_with(hold[bone], weight)
	_add_clip(reload_clip(), reload_phase * length_of(reload_clip()), reload_weight, _upper)
	_add_clip("ual/Flinch", _flinch_time, _flinch_strength * (0.35 if action != Action.READY else 0.55), _reaction)
	var chest := _skel.find_bone("Chest")
	_pose[chest].basis *= Basis(Vector3.RIGHT, deg_to_rad(2.4 * recoil))
	_commit()

## Mezcla normalizada de clips en la MISMA fase (todos los clips de locomoción
## comparten convención: fase 0 = contacto del pie izquierdo). El clip dominante
## entra primero para que la pose base no se diluya. Usa buffers reutilizados.
func _blend_clips(entries: Array, first_slot: int) -> Array[Transform3D]:
	var usable: Array = []
	var total := 0.0
	for entry: Array in entries:
		var weight: float = entry[1]
		if weight <= 0.0001 or not _clips.has(entry[0]): continue
		usable.append([entry[0], weight])
		total += weight
	if usable.is_empty():
		return _slots[first_slot]
	if usable.size() > 1:
		usable.sort_custom(func(a: Array, b: Array) -> bool: return a[1] > b[1])
	var out := _sample_into(first_slot, usable[0][0], phase * length_of(usable[0][0]), true)
	var consumed: float = usable[0][1] / total
	for index in range(1, usable.size()):
		var share: float = (usable[index][1] / total) / maxf(consumed + usable[index][1] / total, 0.0001)
		_blend(out, _sample_into(first_slot + 1, usable[index][0], phase * length_of(usable[index][0]), true), share)
		consumed += usable[index][1] / total
	return out

func _commit() -> void:
	for i in _pose.size():
		_skel.set_bone_pose_rotation(i, _pose[i].basis.get_rotation_quaternion())
	for i in _position_bones:
		_skel.set_bone_pose_position(i, _pose[i].origin)
