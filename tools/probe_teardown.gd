extends RefCounted
## Teardown compartido de probes y QA. Un AudioStreamPlayer que se libera con la
## reproducción en curso deja objetos de audio vivos en el servidor: la salida
## reporta "ObjectDB instances were leaked" y "resources still in use" que no son
## nodos olvidados, y ese ruido tapa una fuga real. Los tools que reproducen
## audio del juego lo paran y dejan drenar al servidor antes de `quit()`.
##
## Uso:
##     const ProbeTeardown := preload("res://tools/probe_teardown.gd")
##     ProbeTeardown.quiesce(self)      # antes de quit(), con el SceneTree


## Detiene la reproducción de todo el árbol. `owned=false` incluye los nodos
## creados en código, que es justo lo que estos fixtures construyen.
static func silence(root: Node) -> void:
	for child: Node in root.find_children("*", "AudioStreamPlayer", true, false):
		var player := child as AudioStreamPlayer
		player.stop()
		player.stream = null
	for child: Node in root.find_children("*", "AudioStreamPlayer3D", true, false):
		var player_3d := child as AudioStreamPlayer3D
		player_3d.stop()
		player_3d.stream = null


## Pausa el árbol (nada nuevo suena), para el audio y espera a que el servidor
## de audio, que mezcla en su propio hilo, suelte las reproducciones pendientes.
static func quiesce(tree: SceneTree, drain_msec: int = 250) -> void:
	if tree == null:
		return
	tree.paused = true
	silence(tree.root)
	OS.delay_msec(drain_msec)
