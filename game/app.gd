extends Node

const LobbyScene := preload("res://game/lobby/lobby.tscn")
const MatchScene := preload("res://game/match/match.tscn")

var current_screen: Node
var mobile_qa: bool = false
var qa_mode: String = ""
var qa_combat: bool = false
var qa_editor: bool = false

func _ready() -> void:
	_apply_brand_theme()
	BlockfireInputSetup.ensure_actions()
	var args := OS.get_cmdline_user_args()
	mobile_qa = args.has("--mobile-qa")
	qa_mode = "ffa" if args.has("--qa-ffa") else ("squad" if args.has("--qa-squad") or args.has("--qa-combat") else "")
	qa_combat = args.has("--qa-combat")
	qa_editor = args.has("--qa-editor")
	if qa_editor:
		qa_mode = "squad"
		qa_combat = true
	if mobile_qa and not DisplayServer.get_name() == "headless":
		DisplayServer.window_set_size(Vector2i(852, 393))
	_show_lobby()
	if qa_mode != "":
		call_deferred("_start_match", qa_mode, "BRAVO", "Estándar")

## Fuente de marca (Rajdhani, OFL) para todo el árbol de UI. Sin esto la
## interfaz usa la fuente por defecto del motor y se lee genérica.
func _apply_brand_theme() -> void:
	var brand := Theme.new()
	var font := load("res://assets/fonts/Rajdhani-SemiBold.ttf") as Font
	if font != null:
		brand.default_font = font
	brand.default_font_size = 16
	get_tree().root.theme = brand


func _show_lobby() -> void:
	_clear_screen()
	var lobby := LobbyScene.instantiate() as BlockfireLobby
	lobby.mobile_qa = mobile_qa
	lobby.start_requested.connect(_start_match)
	add_child(lobby)
	current_screen = lobby

func _start_match(mode: String, operator_id: String, weapon_skin: String) -> void:
	_clear_screen()
	var game_match := MatchScene.instantiate() as BlockfireMatch
	game_match.configure(mode, operator_id, weapon_skin, mobile_qa)
	game_match.qa_skip_buy = qa_combat
	game_match.exit_to_lobby.connect(_show_lobby)
	add_child(game_match)
	current_screen = game_match
	if qa_editor:
		call_deferred("_open_qa_editor")

func _open_qa_editor() -> void:
	if current_screen != null and current_screen.has_method("open_control_editor"):
		current_screen.open_control_editor()

func _clear_screen() -> void:
	if is_instance_valid(current_screen):
		current_screen.queue_free()
	current_screen = null
