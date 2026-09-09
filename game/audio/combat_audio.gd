class_name CombatAudio
extends RefCounted

## Utilidades de audio de combate compartidas por el arma y el feedback.
##
## No crea nodos: sólo calcula y configura los AudioStreamPlayer3D que ya
## existen, para no instanciar nada en el camino de fuego. Todo lo que se
## randomiza aquí es perceptual: ±3.5 % de tono (unos 60 cents) evita el
## "metralleta de sample idéntico" sin que el disparo deje de sonar a su arma.

const PITCH_JITTER := 0.035
const PITCH_MIN := 0.55
const PITCH_MAX := 1.8


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
