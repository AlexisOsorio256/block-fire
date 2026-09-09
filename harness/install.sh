#!/bin/bash
# BLOCKFIRE harness layer — install / sync / verify.
#
# The layer's source of truth is this repository (`harness/`). DSH discovers
# presets under $DSH_HOME/.agent-presets and host rows under
# $DSH_HOME/profiles/<profile>/; this script materializes both. Those copies are
# build artifacts: edit the repo, then run this script.
#
#   harness/install.sh            sync repo -> $DSH_HOME
#   harness/install.sh --check    report drift, change nothing (exit 1 on drift)
#   harness/install.sh --diff     show what differs
#
# Deliberately does NOT touch: the DSH installation, any shipped preset, the
# user's own profile patch file (`cordis.patch.yml`), or settings.yaml.
#
# The DSH runtime it links against is discovered by harness/lib/runtime.mjs —
# the one resolver shared by the launcher, this script, the suite and the Update
# Center. Nothing here looks for `dsh` on PATH by itself.
set -uo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$HERE/.." && pwd)"
PRESETS_SRC="$HERE/presets"
DSH_HOME_DIR="${DSH_HOME:-$HOME/.dsh}"
DEST_ROOT="$DSH_HOME_DIR/.agent-presets"
PROFILE_DIR="$DSH_HOME_DIR/profiles/web"
PROFILE_MODULES="$PROFILE_DIR/node_modules"
WEB_PLUGIN_LINK="$PROFILE_MODULES/@blockfire/harness-web"
GUARD_LINK="$PROFILE_DIR/blockfire"
PATCH_DEST="$PROFILE_DIR/blockfire.patch.yml"

SPACES=(build creator)
LEGACY_PRESETS=(blockfire)

MODE="sync"
case "${1:-}" in
	--check) MODE="check" ;;
	--diff) MODE="diff" ;;
	-h|--help) sed -n '2,15p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
	"") ;;
	*) echo "install.sh: unknown option $1" >&2; exit 2 ;;
esac

[ -d "$PRESETS_SRC" ] || { echo "install.sh: missing $PRESETS_SRC" >&2; exit 1; }

# ── runtime ─────────────────────────────────────────────────────────────────
# The installed preset must resolve the optional bridges it mounts on demand
# (Blender MCP) and the host plugin must resolve nothing extra, so install needs
# both the DSH binary and the matching node_modules. Both come from the one
# shared resolver; looking for `dsh` on PATH is not enough on a machine that
# starts DSH with `npx @deepseek-ai/dsh`, where dsh exists only inside that npx
# process.
# shellcheck source=lib/runtime.sh
. "$HERE/lib/runtime.sh"

if blockfire_runtime_resolve; then
	INSTALL_MODULES="$BLOCKFIRE_INSTALL_MODULES"
	DSH_BIN="$BLOCKFIRE_DSH_BIN"
	RUNTIME_NOTE="DSH $BLOCKFIRE_RUNTIME_VERSION via $BLOCKFIRE_RUNTIME_SOURCE_LABEL"
else
	INSTALL_MODULES=""
	DSH_BIN=""
	RUNTIME_NOTE="no DSH runtime found"
fi

link_state() {
	local link="$1" expected="$2"
	if [ ! -L "$link" ]; then
		[ -e "$link" ] && { echo "stale"; return; }
		echo "missing"; return
	fi
	if [ -n "$expected" ] && [ "$(readlink -f "$link" 2>/dev/null)" = "$(readlink -f "$expected" 2>/dev/null)" ]; then
		echo "ok"
	else
		echo "stale"
	fi
}

check_or_diff() {
	local rc=0 state
	if [ -z "$INSTALL_MODULES" ]; then
		echo "DRIFT: no DSH runtime resolved — bridge links cannot be verified"
		if command -v node >/dev/null 2>&1; then
			node "$HERE/lib/runtime.mjs" 2>&1 | sed 's/^/        /'
		else
			echo "        ${BLOCKFIRE_RUNTIME_ERROR:-node is not on PATH}"
		fi
		rc=1
	else
		echo "RUNTIME: $RUNTIME_NOTE"
	fi
	for space in "${SPACES[@]}"; do
		local src="$PRESETS_SRC/$space" dest="$DEST_ROOT/$space"
		if [ ! -d "$dest" ]; then
			echo "DRIFT: $dest does not exist — run harness/install.sh"
			rc=1
			continue
		fi
		if diff -r -q --exclude=node_modules "$src" "$dest" >/dev/null 2>&1; then
			echo "IN SYNC: $dest"
		else
			echo "DRIFT: $dest differs from $src"
			[ "$MODE" = "diff" ] && diff -r -u --exclude=node_modules "$src" "$dest" | head -120
			rc=1
		fi
		state="$(link_state "$dest/node_modules" "$INSTALL_MODULES")"
		case "$state" in
			ok) echo "  bridge link ok -> $INSTALL_MODULES" ;;
			missing) echo "  BRIDGE LINK missing (optional capabilities unavailable; re-run harness/install.sh)"; rc=1 ;;
			stale) echo "  BRIDGE LINK stale -> $(readlink "$dest/node_modules" 2>/dev/null)"; rc=1 ;;
		esac
	done
	for legacy in "${LEGACY_PRESETS[@]}"; do
		[ -d "$DEST_ROOT/$legacy" ] && { echo "DRIFT: legacy preset $DEST_ROOT/$legacy still present — re-run harness/install.sh"; rc=1; }
	done
	if [ ! -d "$PROFILE_DIR" ]; then
		echo "DRIFT: $PROFILE_DIR missing — boot the Web profile once, then re-run"
		rc=1
	fi
	state="$(link_state "$GUARD_LINK" "$HERE/host")"
	case "$state" in
		ok) echo "IN SYNC: $GUARD_LINK -> $HERE/host" ;;
		missing) echo "DRIFT: $GUARD_LINK missing — re-run harness/install.sh"; rc=1 ;;
		stale) echo "DRIFT: $GUARD_LINK -> $(readlink "$GUARD_LINK" 2>/dev/null)"; rc=1 ;;
	esac
	state="$(link_state "$WEB_PLUGIN_LINK" "$HERE/web")"
	case "$state" in
		ok) echo "IN SYNC: $WEB_PLUGIN_LINK -> $HERE/web" ;;
		missing) echo "DRIFT: $WEB_PLUGIN_LINK missing — re-run harness/install.sh"; rc=1 ;;
		stale) echo "DRIFT: $WEB_PLUGIN_LINK -> $(readlink "$WEB_PLUGIN_LINK" 2>/dev/null)"; rc=1 ;;
	esac
	if [ -f "$PATCH_DEST" ] && cmp -s "$HERE/host/patch.cordis.yml" "$PATCH_DEST"; then
		echo "IN SYNC: $PATCH_DEST"
	else
		echo "DRIFT: $PATCH_DEST differs from harness/host/patch.cordis.yml — re-run harness/install.sh"
		rc=1
	fi
	[ "$rc" = 0 ] || echo "run harness/install.sh to fix"
	exit "$rc"
}

if [ "$MODE" = "check" ] || [ "$MODE" = "diff" ]; then
	check_or_diff
fi

# ── presets ─────────────────────────────────────────────────────────────────
mkdir -p "$DEST_ROOT"
for space in "${SPACES[@]}"; do
	src="$PRESETS_SRC/$space"
	dest="$DEST_ROOT/$space"
	[ -d "$src" ] || { echo "install.sh: missing $src" >&2; exit 1; }
	rm -rf "$dest"
	cp -a "$src" "$dest" || { echo "install.sh: copy failed for $space" >&2; exit 1; }
	chmod -R u+rwX,go-rwx "$dest"
	if [ -n "$INSTALL_MODULES" ]; then
		ln -sfn "$INSTALL_MODULES" "$dest/node_modules"
		echo "preset $space -> $dest (bridge link -> $INSTALL_MODULES)"
	else
		echo "WARNING: no DSH runtime found; optional capabilities (Blender MCP) cannot" >&2
		echo "resolve until one exists. ${BLOCKFIRE_RUNTIME_ERROR:-}" >&2
		if command -v node >/dev/null 2>&1; then
			node "$HERE/lib/runtime.mjs" >&2 || true
		fi
		echo "preset $space -> $dest"
	fi
done

for legacy in "${LEGACY_PRESETS[@]}"; do
	if [ -d "$DEST_ROOT/$legacy" ]; then
		rm -rf "$DEST_ROOT/$legacy"
		echo "removed legacy preset $DEST_ROOT/$legacy (superseded by ${SPACES[*]})"
	fi
done

# ── host plane ──────────────────────────────────────────────────────────────
# The Web profile directory is created by DSH on first boot; let DSH do it
# rather than reproducing its manifest here.
if [ ! -d "$PROFILE_DIR" ]; then
	if [ -n "$DSH_BIN" ]; then
		echo "initializing the Web profile (dsh --profile web --dump-config)"
		node "$DSH_BIN" --profile web --dump-config >/dev/null 2>&1 || true
	fi
fi
if [ ! -d "$PROFILE_DIR" ]; then
	echo "WARNING: $PROFILE_DIR does not exist yet." >&2
	echo "Boot the Web surface once (dsh web), then re-run harness/install.sh to" >&2
	echo "link the host patch rows." >&2
else
	ln -sfn "$HERE/host" "$GUARD_LINK"
	mkdir -p "$(dirname "$WEB_PLUGIN_LINK")"
	ln -sfn "$HERE/web" "$WEB_PLUGIN_LINK"
	cp "$HERE/host/patch.cordis.yml" "$PATCH_DEST"
	echo "host patch rows -> $GUARD_LINK and $WEB_PLUGIN_LINK"
	echo "host patch layer -> $PATCH_DEST"
fi

# ── what to do next ─────────────────────────────────────────────────────────
cat <<TXT

installed: presets ${SPACES[*]} under $DEST_ROOT
runtime:   $RUNTIME_NOTE

Spaces (the only two the user chooses):
  BUILD    project work       — harness/bin/blockfire, then pick BUILD
  CREATOR  harness work       — same launcher, pick CREATOR

Launch the product:
  harness/bin/blockfire       # policy: no approval prompts + host patch layer
  dsh web                     # plain upstream deployment (no BLOCKFIRE rows)

Update state:
  node harness/bin/update.mjs status
  node harness/bin/update.mjs check

Verify the layer:
  harness/test.sh
TXT
