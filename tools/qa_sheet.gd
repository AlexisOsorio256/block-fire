extends SceneTree
## Contact sheet for visual QA. Packs many already-rendered frames into one PNG
## so the model can scan a representative set in one visual read.
##
## Usage:
##   tools/bf qa sheet --out=/tmp/sheet.png --cols=4 --cell=320x180 /tmp/a.png /tmp/b.png ...
##
## This is presentation tooling only; it never runs game logic or mutates source assets.

var _out := "/tmp/blockfire-sheet.png"
var _cols := 4
var _cell_w := 320
var _cell_h := 180
var _paths: Array[String] = []


func _init() -> void:
	for arg: String in OS.get_cmdline_user_args():
		if arg.begins_with("--out="):
			_out = arg.get_slice("=", 1)
		elif arg.begins_with("--cols="):
			_cols = maxi(1, int(arg.get_slice("=", 1)))
		elif arg.begins_with("--cell="):
			var parts := arg.get_slice("=", 1).to_lower().split("x")
			if parts.size() != 2:
				_fail("invalid --cell, expected WIDTHxHEIGHT")
				return
			_cell_w = maxi(32, int(parts[0]))
			_cell_h = maxi(32, int(parts[1]))
		elif arg.begins_with("--"):
			_fail("unknown option: %s" % arg)
			return
		else:
			_paths.append(arg)

	if _paths.is_empty():
		_fail("no input images")
		return

	_build_sheet()


func _build_sheet() -> void:
	var loaded: Array[Image] = []
	for path: String in _paths:
		var image := Image.new()
		var error := image.load(path)
		if error != OK or image.is_empty():
			_fail("cannot load %s" % path)
			return
		image.convert(Image.FORMAT_RGBA8)
		loaded.append(image)

	var rows := int(ceil(float(loaded.size()) / float(_cols)))
	var sheet := Image.create(_cols * _cell_w, rows * _cell_h, false, Image.FORMAT_RGBA8)
	sheet.fill(Color("#11151b"))

	for index: int in range(loaded.size()):
		var image := loaded[index]
		var scale := minf(float(_cell_w) / float(image.get_width()), float(_cell_h) / float(image.get_height()))
		var width := maxi(1, int(round(float(image.get_width()) * scale)))
		var height := maxi(1, int(round(float(image.get_height()) * scale)))
		image.resize(width, height, Image.INTERPOLATE_LANCZOS)
		var column := index % _cols
		var row := floori(float(index) / float(_cols))
		var x := column * _cell_w + floori(float(_cell_w - width) / 2.0)
		var y := row * _cell_h + floori(float(_cell_h - height) / 2.0)
		sheet.blit_rect(image, Rect2i(0, 0, width, height), Vector2i(x, y))

	var save_error := sheet.save_png(_out)
	if save_error != OK:
		_fail("cannot save %s (error %d)" % [_out, save_error])
		return

	print("QA_SHEET out=%s images=%d grid=%dx%d cell=%dx%d" % [_out, loaded.size(), _cols, rows, _cell_w, _cell_h])
	quit(0)


func _fail(message: String) -> void:
	push_error("QA_SHEET %s" % message)
	quit(2)
