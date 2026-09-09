# shellcheck shell=bash
# BLOCKFIRE Harness — shell access to the ONE runtime resolver.
#
# Sourced, never executed. It adds one function and no state of its own; the
# resolution rules live in harness/lib/runtime.mjs and nowhere else.
#
#   . "$HERE/lib/runtime.sh"
#   if blockfire_runtime_resolve; then
#       node "$BLOCKFIRE_DSH_BIN" ...
#   fi
#
# Sets (overwriting whatever the caller had):
#   BLOCKFIRE_DSH_BIN              the JS entry to boot with `node`
#   BLOCKFIRE_INSTALL_MODULES      the matching node_modules (bridges resolve here)
#   BLOCKFIRE_RUNTIME_VERSION      e.g. 0.1.2-rc.1
#   BLOCKFIRE_RUNTIME_SOURCE       active-pin | path | local | global | npx-cache | staged | override
#   BLOCKFIRE_RUNTIME_SOURCE_LABEL human label for the source
#   BLOCKFIRE_RUNTIME_ERROR        why it failed (empty on success)
#
# Returns 0 when a valid runtime was found, 1 otherwise. Diagnostics go to
# stderr; stdout stays clean so callers can redirect it.
#
# An exported BLOCKFIRE_DSH_BIN / BLOCKFIRE_INSTALL_MODULES is passed through to
# the resolver as the authoritative override — it is never cleared here.

BLOCKFIRE_RUNTIME_MJS="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/runtime.mjs"

blockfire_runtime_resolve() {
	local output

	BLOCKFIRE_RUNTIME_VERSION=""
	BLOCKFIRE_RUNTIME_SOURCE=""
	BLOCKFIRE_RUNTIME_SOURCE_LABEL=""
	BLOCKFIRE_RUNTIME_ERROR=""

	if ! command -v node >/dev/null 2>&1; then
		BLOCKFIRE_DSH_BIN=""
		BLOCKFIRE_INSTALL_MODULES=""
		BLOCKFIRE_RUNTIME_ERROR="node is not on PATH; DSH cannot be resolved or run without it"
		return 1
	fi

	# BLOCKFIRE_DSH_BIN / BLOCKFIRE_INSTALL_MODULES are deliberately left
	# untouched here: when the caller exported one, it IS the override the
	# resolver must see. Clearing them would silently resolve some other tree
	# (that is how `update.mjs verify` could test the wrong candidate).
	if output="$(node "$BLOCKFIRE_RUNTIME_MJS" --shell)"; then
		eval "$output"
	else
		# --shell prints the KEY='value' lines even on failure (empty values), so
		# evaluating them still clears any stale override. The reason is already
		# on stderr; keep a copy for callers.
		eval "$output"
		BLOCKFIRE_RUNTIME_ERROR="${BLOCKFIRE_RUNTIME_ERROR:-no DSH runtime found}"
		return 1
	fi

	[ -n "$BLOCKFIRE_DSH_BIN" ]
}
