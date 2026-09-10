class_name CombatAudio
extends RefCounted

## Dueño único del audio de combate y feedback (catálogo + mezcla).
##
## Qué posee: la tabla clave lógica → sample (`SAMPLES`), la caché de streams
## y las matemáticas perceptuales (jitter de tono, atenuación 3D, cola).
## Qué NO posee: cuándo suena cada cosa (eso sigue en `WeaponController`,
## `BlockfirePlayer`, `BlockfireBot` y `HUD`, que piden streams por clave).
##
## No crea nodos: sólo calcula y configura los AudioStreamPlayer3D que ya
## existen, para no instanciar nada en el camino de fuego. Todo lo que se
## randomiza aquí es perceptual: ±3.5 % de tono (unos 60 cents) evita el
## "metralleta de sample idéntico" sin que el disparo deje de sonar a su arma.
##
## Sin sample propio de SMG en el repo: `shot_smg` comparte el de rifle (el
## arma lo distingue por tono/cadencia en `WeaponController._play_shot`).
## `ui.ogg` y `sfx_kill_banner.ogg` existen en `assets/sfx/` sin emisor:
## reservados, fuera del catálogo hasta que un dueño los pida.

const PITCH_JITTER := 0.035
const PITCH_MIN := 0.55
const PITCH_MAX := 1.8

const BUS_SFX := "SFX"
const BUS_UI := "UI"

## Única fuente de verdad de rutas de samples. Nadie fuera de este archivo
## escribe literales `res://assets/sfx/...` (lo vigila el smoke de audio).
const SAMPLES: Dictionary = {
	"shot_rifle": "res://assets/sfx/gshot_rifle.ogg",
	"shot_pistol": "res://assets/sfx/gshot_pistol.ogg",
	"shot_shotgun": "res://assets/sfx/gshot_shotgun.ogg",
	"shot_smg": "res://assets/sfx/gshot_rifle.ogg",
	"reload_start": "res://assets/sfx/reload_start.ogg",
	"reload_end": "res://assets/sfx/reload_end.ogg",
	"switch": "res://assets/sfx/switch.ogg",
	"empty": "res://assets/sfx/empty.ogg",
	"impact_wall": "res://assets/sfx/sfx_impact_wall.ogg",
	"hurt": "res://assets/sfx/sfx_hurt.ogg",
	"death": "res://assets/sfx/sfx_death.ogg",
	"hit": "res://assets/sfx/sfx_hit.ogg",
	"headshot": "res://assets/sfx/sfx_headshot.ogg",
	"kill": "res://assets/sfx/sfx_kill.ogg",
	"jump": "res://assets/sfx/jump.ogg",
	"step": "res://assets/sfx/step.ogg",
	"step2": "res://assets/sfx/step2.ogg",
	"respawn": "res://assets/sfx/respawn.ogg",
}

static var _cache: Dictionary = {}


## Stream cacheado por clave lógica. Una clave desconocida avisa y devuelve
## null (silencio) en vez de romper el camino de fuego.
static func stream(sound_key: String) -> AudioStream:
	if _cache.has(sound_key):
		return _cache[sound_key] as AudioStream
	if not SAMPLES.has(sound_key):
		push_warning("CombatAudio: clave desconocida '" + sound_key + "'")
		return null
	var loaded: AudioStream = load(str(SAMPLES[sound_key])) as AudioStream
	if loaded == null:
		push_warning("CombatAudio: falta el sample '" + str(SAMPLES[sound_key]) + "'")
		return null
	_cache[sound_key] = loaded
	return loaded

## Tono con jitter simétrico alrededor del base del arma.
static func jitter_pitch(base_pitch: float, amount: float = PITCH_JITTER) -> float:
	return clampf(base_pitch * randf_range(1.0 - amount, 1.0 + amount), PITCH_MIN, PITCH_MAX)


## Configura la atenuación 3D de un reproductor ya existente: distancia máxima,
## tamaño de unidad y filtro de agudos para que un disparo lejano se apague
## antes de sonar como si estuviera al lado.
static func configure_falloff(player: AudioStreamPlayer3D, max_distance: float, unit_size: float, cutoff_hz: float = 4200.0) -> void:
	if player == null or not is_instance_valid(player):
		return
	player.max_distance = max_distance
	player.unit_size = unit_size
	player.attenuation_model = AudioStreamPlayer3D.ATTENUATION_INVERSE_DISTANCE
	player.attenuation_filter_cutoff_hz = cutoff_hz
	player.attenuation_filter_db = -14.0


## Volumen relativo de la capa de cola (cuerpo del disparo): siempre por debajo
## del impacto principal para no embarrar la mezcla.
static func tail_volume_db(base_volume_db: float) -> float:
	return clampf(base_volume_db - 7.5, -24.0, 0.0)
