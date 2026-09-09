#!/bin/bash
# BLOCKFIRE harness layer — install / sync / verify.
#
# The layer's source of truth is this repository (`harness/`). DSH discovers
# presets under $DSH_HOME/.agent-presets, so this script materializes the preset
# there. That copy is a build artifact: edit the repo, then run this script.
#
#   harness/install.sh            sync repo -> $DSH_HOME
#   harness/install.sh --check    report drift, change nothing (exit 1 on drift)
#   harness/install.sh --diff     show what differs
#
# Deliberately does NOT touch the host composition, the DSH install, or any
# shipped preset: updating DSH must never require redoing this layer.
set -uo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
SRC="$HERE/presets/blockfire"
DSH_HOME_DIR="${DSH_HOME:-$HOME/.dsh}"
DEST_ROOT="$DSH_HOME_DIR/.agent-presets"
DEST="$DEST_ROOT/blockfire"

MODE="sync"
case "${1:-}" in
	--check) MODE="check" ;;
	--diff) MODE="diff" ;;
	-h|--help) sed -n '2,13p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
	"") ;;
	*) echo "install.sh: unknown option $1" >&2; exit 2 ;;
esac

[ -d "$SRC" ] || { echo "install.sh: missing $SRC" >&2; exit 1; }

# Locate the DSH install's node_modules so the installed preset can resolve the
# optional bridges it mounts on demand (Blender MCP). The plugin itself imports
# nothing, so a missing link degrades that one capability instead of breaking
# the preset.
find_install_node_modules() {
	local bin real dir
	bin="$(command -v dsh 2>/dev/null || true)"
	[ -n "$bin" ] || return 1
	real="$(readlink -f "$bin" 2>/dev/null || echo "$bin")"
	dir="$(dirname "$real")"
	while [ "$dir" != "/" ]; do
		if [ "$(basename "$dir")" = "node_modules" ]; then echo "$dir"; return 0; fi
		dir="$(dirname "$dir")"
	done
	return 1
}

INSTALL_MODULES="$(find_install_node_modules || true)"

link_state() {
	if [ ! -L "$DEST/node_modules" ]; then
		[ -e "$DEST/node_modules" ] && { echo "stale"; return; }
		echo "missing"; return
	fi
	if [ -n "$INSTALL_MODULES" ] && [ "$(readlink -f "$DEST/node_modules")" = "$(readlink -f "$INSTALL_MODULES")" ]; then
		echo "ok"
	else
		echo "stale"
	fi
}

if [ "$MODE" = "check" ] || [ "$MODE" = "diff" ]; then
	rc=0
	if [ ! -d "$DEST" ]; then
		echo "DRIFT: $DEST does not exist — run harness/install.sh"
		exit 1
	fi
	if diff -r -q --exclude=node_modules "$SRC" "$DEST" >/dev/null 2>&1; then
		echo "IN SYNC: $DEST"
	else
		echo "DRIFT: $DEST differs from $SRC"
		[ "$MODE" = "diff" ] && diff -r -u --exclude=node_modules "$SRC" "$DEST" | head -120
		rc=1
	fi
	case "$(link_state)" in
		ok) echo "BRIDGE LINK: ok -> $INSTALL_MODULES" ;;
		missing) echo "BRIDGE LINK: missing (optional capabilities unavailable; re-run harness/install.sh)"; rc=1 ;;
		stale) echo "BRIDGE LINK: stale -> $(readlink "$DEST/node_modules" 2>/dev/null) (expected $INSTALL_MODULES)"; rc=1 ;;
	esac
	[ "$rc" = 0 ] || echo "run harness/install.sh to fix"
	exit "$rc"
fi

mkdir -p "$DEST_ROOT"
rm -rf "$DEST"
cp -a "$SRC" "$DEST" || { echo "install.sh: copy failed" >&2; exit 1; }
chmod -R u+rwX,go-rwx "$DEST"

if [ -n "$INSTALL_MODULES" ]; then
	ln -sfn "$INSTALL_MODULES" "$DEST/node_modules"
	echo "bridge link: $DEST/node_modules -> $INSTALL_MODULES"
else
	echo "WARNING: could not locate the DSH install's node_modules; optional" >&2
	echo "capabilities (Blender MCP) will report a resolution error until fixed." >&2
fi

echo "installed: $DEST"
echo
echo "Preset id: blockfire"
echo "  Web GUI new session -> choose \"BLOCKFIRE\" in the new-session chip"
echo "  Make it the default -> Settings -> Agent presets -> BLOCKFIRE -> make default"
echo "  (only the Web surface composes agent presets in this DSH version;"
echo "   the headless/TUI profiles compose the agent process-wide)"
echo
echo "Verify the layer: harness/test.sh"
