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

# Dos suites, un proceso Godot cada una (el runner no reutiliza un árbol a medias).
# smoke.gd: producto completo. animation_layers.gd: contrato de pose/velocidad.
STATUS=0
for suite in tests/smoke.gd tests/animation_layers.gd; do
	echo "── $suite"
	if ! "$GODOT_BIN" --headless --path "$ROOT" --script "res://$suite"; then
		STATUS=1
	fi
done
exit "$STATUS"
