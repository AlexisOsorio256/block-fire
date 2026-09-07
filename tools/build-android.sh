#!/bin/bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

find_godot() {
	if [ -n "${BLOCKFIRE_GODOT:-}" ] && [ -x "$BLOCKFIRE_GODOT" ]; then
		echo "$BLOCKFIRE_GODOT"
		return 0
	fi
	for candidate in "$(command -v godot 2>/dev/null || true)" "$(command -v godot4 2>/dev/null || true)"; do
		if [ -n "$candidate" ] && [ -x "$candidate" ]; then
			echo "$candidate"
			return 0
		fi
	done
	return 1
}

GODOT_BIN="$(find_godot || true)"
if [ -z "$GODOT_BIN" ]; then
	echo "Godot 4.7.2 no encontrado. Define BLOCKFIRE_GODOT o instala godot/godot4." >&2
	exit 1
fi
mkdir -p "$ROOT/builds"
exec "$GODOT_BIN" --headless --path "$ROOT" --export-debug "Android" "$ROOT/builds/blockfire-debug.apk"
