#!/bin/bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# Tooling regressions are shell-only and cheap. Run them before requiring Godot so
# repo-state/evidence bugs fail even on a machine that cannot launch the game.
bash "$ROOT/tools/test-bf-doctor.sh"

find_godot() {
	if [ -n "${BLOCKFIRE_GODOT:-}" ] && [ -x "$BLOCKFIRE_GODOT" ]; then
		echo "$BLOCKFIRE_GODOT"
		return 0
	fi
	for candidate in "$(command -v godot 2>/dev/null || true)" "$(command -v godot4 2>/dev/null || true)" \
			"$HOME/.local/share/blockfire-tools/godot-4.7.2/godot"; do
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

# Suites enfocadas, un proceso Godot cada una (sin reutilizar árboles):
# producto, regresiones, pose/velocidad, cámara en mundo físico y marco del
# arma (de qué lado sale el casquillo y hacia dónde apunta el fogonazo).
STATUS=0
for suite in tests/smoke.gd tests/regressions.gd tests/animation_layers.gd tools/probe-player-feel.gd tools/probe-player-brake.gd tools/probe-aim-coordination.gd tools/probe-aim-assist.gd tools/probe-muzzle-frame.gd; do
	echo "── $suite"
	if ! "$GODOT_BIN" --headless --path "$ROOT" --script "res://$suite"; then
		STATUS=1
	fi
done
exit "$STATUS"
