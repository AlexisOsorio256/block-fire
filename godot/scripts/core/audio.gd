# BLOCKFIRE — Audio autoload (parity: src/audio/AudioManager.js)
# Samples reales (Jesús Lastra CC-BY 3.0 + sintetizados propios). Un dueño por sonido.
# Playlists: disparos por arma, confirmaciones de combate, UI.
extends Node

var _streams: Dictionary = {}
var _pool: Array[AudioStreamPlayer] = []
const POOL_SIZE := 8

func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	_load("shot_rifle", "res://assets/audio/gshot_rifle.ogg")
	_load("shot_pistol", "res://assets/audio/gshot_pistol.ogg")
	_load("shot_shotgun", "res://assets/audio/gshot_shotgun.ogg")
	_load("hit", "res://assets/audio/sfx_hit.ogg")
	_load("headshot", "res://assets/audio/sfx_headshot.ogg")
	_load("kill", "res://assets/audio/sfx_kill.ogg")
	_load("hurt", "res://assets/audio/sfx_hurt.ogg")
	_load("death", "res://assets/audio/sfx_death.ogg")
	_load("reload", "res://assets/audio/reload_start.ogg")
	_load("switch", "res://assets/audio/switch.ogg")
	_load("jump", "res://assets/audio/jump.ogg")
	_load("respawn", "res://assets/audio/respawn.ogg")
	for i in POOL_SIZE:
		var p := AudioStreamPlayer.new()
		p.bus = "Master"
		add_child(p)
		_pool.append(p)

var _pool_i := 0

func _load(key: String, path: String) -> void:
	if ResourceLoader.exists(path):
		_streams[key] = load(path)
	else:
		push_warning("[Audio] falta sample: " + path)

func play(key: String, volume_db: float = 0.0, pitch: float = 1.0) -> void:
	if not _streams.has(key):
		return
	var p := _pool[_pool_i]
	_pool_i = (_pool_i + 1) % POOL_SIZE
	p.stream = _streams[key]
	p.volume_db = volume_db
	p.pitch_scale = pitch
	p.play()

# sonido en el mundo (bots, impactos lejanos) con atenuación por distancia
func play_at(key: String, pos: Vector3, volume_db: float = 0.0) -> void:
	if not _streams.has(key):
		return
	var p3 := AudioStreamPlayer3D.new()
	p3.stream = _streams[key]
	p3.volume_db = volume_db
	p3.max_distance = 40.0
	p3.attenuation_model = AudioStreamPlayer3D.ATTENUATION_INVERSE_DISTANCE
	get_tree().current_scene.add_child(p3)
	p3.global_position = pos
	p3.play()
	p3.finished.connect(p3.queue_free)
