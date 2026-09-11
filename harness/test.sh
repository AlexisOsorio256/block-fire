#!/bin/bash
# BLOCKFIRE harness layer — compatibility suite.
#
# This is the contract between our thin layer and DeepSeek Harness. It is cheap
# by default (no model calls) and it FAILS LOUDLY rather than letting an upstream
# change alter behavior silently.
#
#   harness/test.sh                       the installed runtime
#   harness/test.sh --network             also exercise update detection
#   harness/test.sh --live                also verify the tool surface against the
#                                         newest real session of each space
#   harness/test.sh --self-test           negative controls: the suite must FAIL
#                                         on a deliberately broken layer
#   harness/test.sh --install <modules> --dsh-bin <bin>
#                                         run against a STAGED candidate tree
#                                         (this is what update.mjs verify calls)
#
# Boots an isolated Web host and creates idle BUILD/CREATOR agents without LLM
# calls. --live additionally audits historical request logs; those logs do not
# establish compatibility of a staged candidate.
set -uo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$HERE/.." && pwd)"
PRESETS="$HERE/presets"
SPACES=(build creator)
DSH_HOME_DIR="${DSH_HOME:-$HOME/.dsh}"
DEST_ROOT="$DSH_HOME_DIR/.agent-presets"
PATCH="$DSH_HOME_DIR/profiles/web/blockfire.patch.yml"

WANT_NETWORK=0
WANT_LIVE=0
WANT_SELF_TEST=0
INSTALL_MODULES=""
DSH_BIN=""

while [ $# -gt 0 ]; do
	case "$1" in
		--network) WANT_NETWORK=1 ;;
		--live) WANT_LIVE=1 ;;
		--self-test) WANT_SELF_TEST=1 ;;
		--install) INSTALL_MODULES="${2:-}"; shift ;;
		--dsh-bin) DSH_BIN="${2:-}"; shift ;;
		-h|--help) sed -n '2,20p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
		*) echo "test.sh: unknown option $1" >&2; exit 2 ;;
	esac
	shift
done

fail=0
ok() { printf '  ok    %s\n' "$1"; }
bad() { printf '  FAIL  %s\n' "$1"; fail=1; }
warn() { printf '  warn  %s\n' "$1"; }
skip() { printf '  skip  %s\n' "$1"; }

# The runtime comes from the one shared resolver, never from `command -v dsh`.
# --install/--dsh-bin are explicit overrides (update.mjs verify uses them on a
# staged tree); the resolver validates them, so a broken candidate fails here
# instead of the suite silently testing some other tree.
EXPLICIT_RUNTIME=0
if [ -n "$INSTALL_MODULES" ]; then export BLOCKFIRE_INSTALL_MODULES="$INSTALL_MODULES"; EXPLICIT_RUNTIME=1; fi
if [ -n "$DSH_BIN" ]; then export BLOCKFIRE_DSH_BIN="$DSH_BIN"; EXPLICIT_RUNTIME=1; fi
# shellcheck source=lib/runtime.sh
. "$HERE/lib/runtime.sh"
if blockfire_runtime_resolve; then
	INSTALL_MODULES="$BLOCKFIRE_INSTALL_MODULES"
	DSH_BIN="$BLOCKFIRE_DSH_BIN"
else
	if [ "$EXPLICIT_RUNTIME" = 1 ]; then
		echo "test.sh: the explicit runtime override is not a valid DSH install" >&2
		echo "test.sh: ${BLOCKFIRE_RUNTIME_ERROR:-unknown}" >&2
		exit 2
	fi
	INSTALL_MODULES=""
	DSH_BIN=""
fi

echo "BLOCKFIRE harness layer — $(basename "$REPO")/harness"
echo "  dsh runtime:     ${BLOCKFIRE_RUNTIME_VERSION:-<not found>} (${BLOCKFIRE_RUNTIME_SOURCE_LABEL:-unresolved})"
echo "  install modules: ${INSTALL_MODULES:-<not found>}"
echo "  dsh binary:      ${DSH_BIN:-<not found>}"

# ── structure ───────────────────────────────────────────────────────────────
echo "structure"
for file in \
	"$PRESETS/build/agent.cordis.yml" \
	"$PRESETS/build/surface.cordis.yml" \
	"$PRESETS/build/preset.yml" \
	"$PRESETS/build/plugins/capabilities.js" \
	"$PRESETS/build/plugins/blender-min.js" \
	"$PRESETS/build/plugins/prompt.js" \
	"$PRESETS/creator/agent.cordis.yml" \
	"$PRESETS/creator/preset.yml" \
	"$HERE/host/patch.cordis.yml" \
	"$HERE/host/guard.js" \
	"$HERE/web/package.json" \
	"$HERE/web/lib/index.js" \
	"$HERE/web/lib/client.js" \
	"$HERE/contract/contract.json" \
	"$HERE/bin/blockfire" \
	"$HERE/bin/context-report.mjs" \
	"$HERE/bin/update.mjs" \
	"$HERE/bin/session-report.mjs" \
	"$HERE/install.sh" \
	"$HERE/lib/check_composition.py" \
	"$HERE/lib/contract_check.mjs" \
	"$HERE/lib/isolated-host.mjs" \
	"$HERE/lib/runtime.mjs" \
	"$HERE/lib/runtime.sh" \
	"$HERE/tests/plugins.test.mjs" \
	"$HERE/tests/report.test.mjs" \
	"$HERE/tests/safety.test.mjs" \
	"$HERE/tests/mount.mjs" \
	"$HERE/ARCHITECTURE.md"; do
	if [ -f "$file" ]; then ok "${file#"$REPO"/}"; else bad "missing ${file#"$REPO"/}"; fi
done
for space in "${SPACES[@]}"; do
	[ -d "$PRESETS/$space" ] || bad "$space preset directory missing"
done
[ "$(ls -1 "$PRESETS/build/skills" 2>/dev/null | wc -l)" -gt 0 ] || bad "BUILD has no skills"

# ── runtime discovery ───────────────────────────────────────────────────────
# The failure this section exists for: DSH started with `npx @deepseek-ai/dsh`
# has no `dsh` in a fresh shell's PATH, so anything that resolved the runtime by
# itself reported "no dsh runtime found" and left the bridge link unset.
echo "runtime"
if [ -n "$DSH_BIN" ] && [ -n "$INSTALL_MODULES" ]; then
	ok "resolver found DSH $BLOCKFIRE_RUNTIME_VERSION via $BLOCKFIRE_RUNTIME_SOURCE_LABEL"
	if [ -d "$INSTALL_MODULES/@deepseek-ai/dsh" ]; then
		ok "node_modules holds @deepseek-ai/dsh: $INSTALL_MODULES"
	else
		bad "resolved node_modules does not hold @deepseek-ai/dsh: $INSTALL_MODULES"
	fi
else
	bad "no DSH runtime resolved — harness/bin/blockfire cannot boot and bridges cannot link"
fi
shared=0
for file in "$HERE/bin/blockfire" "$HERE/install.sh" "$HERE/test.sh"; do
	grep -q 'lib/runtime.sh' "$file" && shared=$((shared + 1))
done
grep -q 'lib/runtime.mjs' "$HERE/bin/update.mjs" && shared=$((shared + 1))
if [ "$shared" = 4 ]; then
	ok "launcher, install, suite and updater share harness/lib/runtime.mjs"
else
	bad "only $shared/4 consumers use the shared runtime resolver"
fi
if grep -n 'command -v dsh' "$HERE/bin/blockfire" "$HERE/install.sh" "$HERE/bin/update.mjs" 2>/dev/null | grep -q .; then
	bad "a consumer still resolves dsh on its own instead of using harness/lib/runtime.mjs"
else
	ok "no consumer resolves dsh on its own"
fi

# ── our own code ────────────────────────────────────────────────────────────
echo "plugins"
for file in "$PRESETS/build/plugins/capabilities.js" "$PRESETS/build/plugins/prompt.js" "$PRESETS/build/plugins/blender-min.js" "$HERE/host/guard.js" "$HERE/web/lib/index.js" "$HERE/web/lib/client.js" "$HERE/lib/runtime.mjs" "$HERE/lib/isolated-host.mjs" "$HERE/bin/context-report.mjs" "$HERE/bin/update.mjs" "$HERE/bin/session-report.mjs"; do
	if node --check "$file" 2>/dev/null; then ok "${file#"$REPO"/} parses"; else bad "${file#"$REPO"/} has a syntax error"; fi
done
if node "$HERE/tests/plugins.test.mjs" >/tmp/blockfire-plugin-tests.log 2>&1; then
	ok "plugin unit tests pass ($(grep -c '^ok ' /tmp/blockfire-plugin-tests.log) tests)"
else
	bad "plugin unit tests fail — see /tmp/blockfire-plugin-tests.log"
	tail -20 /tmp/blockfire-plugin-tests.log | sed 's/^/        /'
fi
if node "$HERE/tests/report.test.mjs" >/tmp/blockfire-report-tests.log 2>&1; then
	ok "session-report fixture tests pass ($(grep -c '^ok ' /tmp/blockfire-report-tests.log) tests)"
else
	bad "session-report fixture tests fail — see /tmp/blockfire-report-tests.log"
	tail -20 /tmp/blockfire-report-tests.log | sed 's/^/        /'
fi
if node "$HERE/tests/safety.test.mjs" >/tmp/blockfire-safety-tests.log 2>&1; then
	ok "safety boundary tests pass ($(grep -c '^ok ' /tmp/blockfire-safety-tests.log) tests)"
else
	bad "safety boundary tests fail — see /tmp/blockfire-safety-tests.log"
	tail -20 /tmp/blockfire-safety-tests.log | sed 's/^/        /'
fi
# El auditor de repositorio se prueba contra un repo fabricado con basura a
# propósito: un auditor que no detecta no sirve, y uno que grita en falso hace
# borrar producto.
if node "$HERE/tests/audit-repo.test.mjs" >/tmp/blockfire-audit-tests.log 2>&1; then
	ok "repo audit detects dead files without false positives"
else
	bad "repo audit test fails — see /tmp/blockfire-audit-tests.log"
	tail -20 /tmp/blockfire-audit-tests.log | sed 's/^/        /'
fi

# Exercise actual services, session-scoped tools and skills in the selected tree.
echo "isolated runtime mount"
if timeout 60 node "$HERE/tests/mount.mjs" > /tmp/blockfire-mount-tests.log 2>&1; then
	cat /tmp/blockfire-mount-tests.log
else
	bad "runtime mount failed — see /tmp/blockfire-mount-tests.log"
	tail -25 /tmp/blockfire-mount-tests.log
fi

# ── compositions ────────────────────────────────────────────────────────────
echo "compositions"
if python3 -c 'import yaml' 2>/dev/null; then
	composition_out="$(python3 "$HERE/lib/check_composition.py" --install-modules "$INSTALL_MODULES" \
		"$PRESETS/build/agent.cordis.yml" "$PRESETS/creator/agent.cordis.yml" 2>&1)"
	while IFS= read -r line; do
		case "$line" in
			OK*) ok "${line#OK }" ;;
			NOTE*) warn "${line#NOTE }" ;;
			FAIL*) bad "${line#FAIL }" ;;
			*) [ -n "$line" ] && warn "$line" ;;
		esac
	done <<<"$composition_out"
	# Row ids must stay unique across a resolved composition, or the loader
	# silently keeps one of them.
	for space in "${SPACES[@]}"; do
		dupes="$(python3 - "$PRESETS/$space/agent.cordis.yml" <<'PY'
import sys, yaml, os
class L(yaml.SafeLoader): pass
L.add_multi_constructor('tag:yaml.org,2002:js', lambda l, s, n: None)
seen, dupes = set(), set()
def walk(path, base):
    rows = yaml.load(open(path, encoding='utf-8'), Loader=L) or []
    for row in rows:
        if not isinstance(row, dict): continue
        if row.get('name') == 'cordis:include':
            target = os.path.normpath(os.path.join(base, (row.get('config') or {}).get('path', '')))
            walk(target, os.path.dirname(target)); continue
        rid = row.get('id')
        if rid in seen: dupes.add(rid)
        if rid is not None: seen.add(rid)
for arg in sys.argv[1:]:
    walk(arg, os.path.dirname(os.path.abspath(arg)))
print(','.join(sorted(dupes)))
PY
)"
		if [ -n "$dupes" ]; then bad "$space has duplicate row ids: $dupes"; else ok "$space row ids are unique across includes"; fi
	done
else
	skip "PyYAML not installed (composition checks skipped)"
fi

# The shipped composition-authoring skills CREATOR reads from the install.
if [ -n "$INSTALL_MODULES" ]; then
	shipped="$(python3 -c "import json;print(json.load(open('$HERE/contract/contract.json'))['layout']['shippedCordisSkills'])" 2>/dev/null || echo '')"
	if [ -n "$shipped" ] && [ -d "$INSTALL_MODULES/$shipped" ]; then
		ok "shipped composition skills resolve ($shipped)"
	else
		bad "shipped composition skills missing under the install: $shipped"
	fi
	for package in $(python3 -c "import json;print(' '.join(json.load(open('$HERE/contract/contract.json'))['layout']['capabilityPackages'].values()))" 2>/dev/null); do
		if [ -d "$INSTALL_MODULES/$package" ]; then ok "capability package present: $package"; else bad "capability package missing: $package"; continue; fi
		# The router imports the package and mounts its `apply`; a renamed export
		# would only surface when a user asked for the capability.
		if (node --input-type=module -e "import { createRequire } from 'node:module'; import { pathToFileURL } from 'node:url'; const r = createRequire(process.argv[1] + '/probe.cjs'); const m = await import(pathToFileURL(r.resolve('$package'))); const p = m.default ?? m; if (typeof p.apply !== 'function') { console.error('no apply'); process.exit(1) }" "$INSTALL_MODULES" 2>/dev/null); then
			ok "capability package mounts as a Cordis plugin: $package"
		else
			bad "capability package is not a Cordis plugin (no apply): $package"
		fi
	done
	# Harness-owned file capabilities: resolved ./-relative against the router
	# module, so they are checked as repo files with a Cordis plugin shape
	# (named exports + apply), not as installed packages.
	for key in $(python3 -c "import json;c=json.load(open('$HERE/contract/contract.json'))['layout'].get('fileCapabilities',{});print(' '.join(k for k in c if not k.startswith('_')))" 2>/dev/null); do
		rel="$(python3 -c "import json;print(json.load(open('$HERE/contract/contract.json'))['layout']['fileCapabilities']['$key'])")"
		if [ -f "$HERE/$rel" ] && node --check "$HERE/$rel" 2>/dev/null \
			&& (node --input-type=module -e "const m = await import(process.argv[1]); const p = m.default ?? m; if (typeof p.apply !== 'function' || typeof m.name !== 'string') process.exit(1)" "file://$HERE/$rel" 2>/dev/null); then
			ok "file capability is a loadable Cordis plugin: $key ($rel)"
		else
			bad "file capability broken or not a Cordis plugin: $key ($rel)"
		fi
	done
fi

# Capability declarations are per space: leaking CREATOR's runtime toolset into
# BUILD would hand project work the ability to rewrite the harness.
if grep -q "dsh-tool-cordis" "$PRESETS/build/surface.cordis.yml" "$PRESETS/build/agent.cordis.yml" 2>/dev/null; then
	bad "BUILD declares the CREATOR-only cordis capability"
else
	ok "BUILD does not declare the cordis capability"
fi
if grep -q "dsh-tool-cordis" "$PRESETS/creator/agent.cordis.yml" 2>/dev/null; then
	ok "CREATOR declares the cordis capability (JIT)"
else
	bad "CREATOR does not declare the cordis capability"
fi

# ── host patch layer ────────────────────────────────────────────────────────
echo "host plane"
if [ -f "$PATCH" ]; then ok "installed host patch present: $PATCH"; else bad "host patch not installed — run harness/install.sh"; fi
[ -f "$HERE/host/patch.cordis.yml" ] && cmp -s "$HERE/host/patch.cordis.yml" "$PATCH" && ok "installed host patch matches the repo" || bad "installed host patch differs from harness/host/patch.cordis.yml"
if [ -n "$INSTALL_MODULES" ] && python3 -c 'import yaml' 2>/dev/null; then
	patch_out="$(python3 "$HERE/lib/check_composition.py" --patch --base "$DSH_HOME_DIR/profiles/web" \
		--install-modules "$INSTALL_MODULES" "$HERE/host/patch.cordis.yml" 2>&1)"
	while IFS= read -r line; do
		case "$line" in
			OK*) ok "host patch: ${line#OK }" ;;
			NOTE*) : ;;
			FAIL*) bad "host patch: ${line#FAIL }" ;;
		esac
	done <<<"$patch_out"
fi
# The real composition check: DSH itself composes the tree, applies our patch,
# and reports every patch row that matched nothing.
if [ -n "$DSH_BIN" ] && [ -f "$PATCH" ]; then
	if timeout 180 node "$DSH_BIN" --profile web --patch "$PATCH" --dump-config >/tmp/blockfire-dump.yml 2>/tmp/blockfire-dump.err; then
		if [ -s /tmp/blockfire-dump.err ]; then
			bad "dsh --dump-config warned: $(head -2 /tmp/blockfire-dump.err | tr '\n' ' ')"
		else
			ok "dsh --profile web --patch <installed> --dump-config composes cleanly"
		fi
		for row in blockfire-guard blockfire-update-center; do
			grep -q "id: $row" /tmp/blockfire-dump.yml && ok "host row composed: $row" || bad "host row missing from the composed tree: $row"
		done
		grep -q "default: build" /tmp/blockfire-dump.yml && ok "roster default is BUILD" || bad "roster default is not BUILD"
		grep -q "includeShippedRoot: false" /tmp/blockfire-dump.yml && ok "shipped preset roster is hidden" || bad "shipped presets still in the roster"
	else
		bad "dsh --profile web --patch <installed> --dump-config failed — the host patch does not compose"
		head -5 /tmp/blockfire-dump.err | sed 's/^/        /'
	fi
else
	skip "no dsh binary: host composition not composed"
fi

# ── upstream contract ───────────────────────────────────────────────────────
echo "contract"
if [ -n "$INSTALL_MODULES" ]; then
	version="$(node -e 'try{process.stdout.write(require(process.argv[1] + "/@deepseek-ai/dsh/package.json").version)}catch{}' "$INSTALL_MODULES" 2>/dev/null)"
	node "$HERE/lib/contract_check.mjs" dsh "$version" || fail=1
else
	skip "no install modules: DSH version unknown"
fi

newest_log() {
	local space="$1"
	node -e '
const { readdirSync, statSync } = require("node:fs")
const { join } = require("node:path")
const root = join(process.env.DSH_HOME || join(process.env.HOME, ".dsh"), "sessions")
const space = process.argv[1]
const found = []
const names = ["session.v3.jsonl.zstd", "session.jsonl.zstd"]
for (const project of readdirSync(root)) {
  let entries = []
  try { entries = readdirSync(join(root, project)) } catch { continue }
  for (const entry of entries) {
    const dir = join(root, project, entry)
    for (const name of names) {
      try {
        const log = join(dir, name)
        const stat = statSync(log)
        found.push({ log, mtime: stat.mtimeMs })
        break
      } catch {}
    }
  }
}
found.sort((a, b) => b.mtime - a.mtime)
for (const entry of found) {
  try {
    const { execFileSync } = require("node:child_process")
    const head = execFileSync("zstd", ["-dc", entry.log], { maxBuffer: 512 * 1024 * 1024 }).toString("utf8")
    const events = head.trim().split("\n").map(line => { try { return JSON.parse(line) } catch { return {} } })
    if (!events.some(event => event.type === "request/header")) continue
    // Classify by the preset the session actually mounted: an explicit
    // agent-preset/selected wins over the initial session-event label.
    const selected = [...events].reverse().find(event => event.type === "agent-preset/selected")
    const preset = selected?.data?.agentPreset ?? selected?.data?.preset ?? (events[0].agentPreset || "")
    if (preset !== space) continue
    process.stdout.write(entry.log)
    process.exit(0)
  } catch {}
}
' "$space" 2>/dev/null
}

if [ "$WANT_LIVE" = 1 ]; then
for space in "${SPACES[@]}"; do
	log="$(newest_log "$space")"
	if [ -z "$log" ]; then
		skip "$space has no real session yet: run one, then re-run with --live"
		continue
	fi
	node "$HERE/lib/contract_check.mjs" log "$log" || fail=1
	node "$HERE/lib/contract_check.mjs" surface "$log" "$space" || fail=1
done

else
	skip "historical logs not used as candidate evidence (--live to audit)"
fi

# ── installed copy in sync ──────────────────────────────────────────────────
echo "installation"
# When the suite runs against an explicit candidate (update.mjs verify), the
# installed copies still belong to the LIVE runtime: strip the override for this
# check, or a staged tree would look like drift in the installation.
install_check() {
	if [ "$BLOCKFIRE_RUNTIME_SOURCE" = "override" ]; then
		env -u BLOCKFIRE_DSH_BIN -u BLOCKFIRE_INSTALL_MODULES "$HERE/install.sh" --check
	else
		"$HERE/install.sh" --check
	fi
}
if install_check >/dev/null 2>&1; then
	ok "installed copies are in sync with the repo"
else
	bad "installed copies differ — run harness/install.sh"
	install_check 2>&1 | grep -E 'DRIFT|stale|missing' | head -5 | sed 's/^/        /'
fi

# ── update detection (network) ──────────────────────────────────────────────
echo "updates"
if [ "$WANT_NETWORK" = 1 ]; then
	if timeout 180 node "$HERE/bin/update.mjs" check --json >/tmp/blockfire-update.json 2>/tmp/blockfire-update.err; then
		ok "update detection reached the package registry"
		node -e '
const report = require("/tmp/blockfire-update.json")
if (typeof report.installed !== "string" || report.installed === "") throw new Error("no installed version")
if (!Array.isArray(report.channels) || report.channels.length === 0) throw new Error("no channels")
if (!Array.isArray(report.newer)) throw new Error("no newer list")
process.stdout.write(`  ok    channels: ${report.channels.map((c) => `${c.channel}=${c.version}`).join(", ")}; newer: ${report.newer.length}\n`)
' || bad "update report is malformed"
	else
		bad "update detection failed — see /tmp/blockfire-update.err"
		head -3 /tmp/blockfire-update.err | sed 's/^/        /'
	fi
else
	skip "network checks disabled (--network)"
fi

# ── negative controls ───────────────────────────────────────────────────────
# A suite that only ever passes proves nothing. These fixtures MUST fail.
if [ "$WANT_SELF_TEST" = 1 ]; then
	echo "self-test (negative controls)"
	if timeout 60 node "$HERE/tests/mount.mjs" --missing-host-service >/tmp/blockfire-mount-negative.log 2>&1; then
		bad "mount negative control: missing host service must FAIL"
	elif grep -q 'requires @deepseek-ai/dsh-tool-subagent/model-selection-settings' /tmp/blockfire-mount-negative.log; then
		ok "mount negative control: missing host service rejected by real runtime"
	else
		bad "mount negative control failed for an unexpected reason — /tmp/blockfire-mount-negative.log"
	fi
	tmp="$(mktemp -d)"
	mkdir -p "$tmp/preset/plugins"
	cat >"$tmp/preset/agent.cordis.yml" <<'YML'
- id: missing-package
  name: '@deepseek-ai/dsh-package-that-does-not-exist'
YML
	if python3 "$HERE/lib/check_composition.py" --install-modules "$INSTALL_MODULES" "$tmp/preset/agent.cordis.yml" >/dev/null 2>&1; then
		bad "negative control 1: a missing package must FAIL"
	else
		ok "negative control 1: a missing package FAILS"
	fi
	cat >"$tmp/preset/agent.cordis.yml" <<'YML'
- id: include
  name: cordis:include
  config:
    path: nowhere.yml
YML
	if python3 "$HERE/lib/check_composition.py" --install-modules "$INSTALL_MODULES" "$tmp/preset/agent.cordis.yml" >/dev/null 2>&1; then
		bad "negative control 2: a missing include must FAIL"
	else
		ok "negative control 2: a missing include FAILS"
	fi
	cat >"$tmp/preset/agent.cordis.yml" <<'YML'
- id: surface
  name: cordis:include
  config:
    path: included.yml
    patches:
      - id: a-row-that-does-not-exist
        config: {}
YML
	cat >"$tmp/preset/included.yml" <<'YML'
- id: real-row
  name: '@deepseek-ai/dsh-tool-bash'
YML
	if python3 "$HERE/lib/check_composition.py" --install-modules "$INSTALL_MODULES" "$tmp/preset/agent.cordis.yml" >/dev/null 2>&1; then
		bad "negative control 3: a patch that matches nothing must FAIL"
	else
		ok "negative control 3: a patch that matches nothing FAILS"
	fi
	cat >"$tmp/preset/agent.cordis.yml" <<'YML'
- id: guarded
  name: ./nonexistent/guard.js
YML
	if python3 "$HERE/lib/check_composition.py" --install-modules "$INSTALL_MODULES" "$tmp/preset/agent.cordis.yml" >/dev/null 2>&1; then
		bad "negative control 4: a missing relative plugin must FAIL"
	else
		ok "negative control 4: a missing plugin file FAILS"
	fi
	# The resolver must refuse an invalid explicit override instead of silently
	# resolving some other tree — that is how a verify run can test the wrong DSH.
	if BLOCKFIRE_DSH_BIN="$tmp/not-a-runtime" node "$HERE/lib/runtime.mjs" >/dev/null 2>&1; then
		bad "negative control 5: an invalid explicit runtime override must FAIL"
	else
		ok "negative control 5: an invalid explicit runtime override FAILS"
	fi

	# Log-contract fixtures: the contract must separate PASS (what happened),
	# FAIL (a real obligation broken) and SIN EVIDENCIA (nothing to check).
	fixtures="$tmp/log-fixtures"; mkdir -p "$fixtures"
	: >"$fixtures/empty.jsonl"
	cat >"$fixtures/no-requests.jsonl" <<'EOT'
{"type":"session","id":"s","cwd":"/x","agentPreset":"build","createdAt":0}
EOT
	cat >"$fixtures/valid.jsonl" <<'EOT'
{"type":"session","id":"s","cwd":"/x","agentPreset":"build","createdAt":0}
{"type":"agent-preset/selected","data":{"agentPreset":"build"}}
{"type":"request/header","data":{"header":{"system":"S","tools":[{"name":"bash"}],"config":{"model":"m"}}}}
{"type":"user/message","data":{}}
{"type":"tool/call","data":{"callId":"c1","name":"bash","arguments":"{}"}}
{"type":"tool/result","data":{"message":{"source":{"kind":"tool","callId":"c1"},"content":[{"type":"tool-result","toolCallId":"c1","content":[]}],"isError":false}}}
{"type":"assistant/message","data":{"usage":{"inputTokens":1,"cacheReadTokens":2,"outputTokens":3},"message":{"content":[]}}}
{"type":"step/end","data":{}}
EOT
	# Older runtimes put the callId directly on the result message; both shapes
	# must keep pairing.
	cat >"$fixtures/valid-alt-result-shape.jsonl" <<'EOT'
{"type":"session","id":"s","cwd":"/x","agentPreset":"build","createdAt":0}
{"type":"request/header","data":{"header":{"system":"S","tools":[{"name":"bash"}],"config":{"model":"m"}}}}
{"type":"tool/call","data":{"callId":"c1","name":"bash","arguments":"{}"}}
{"type":"tool/result","data":{"message":{"callId":"c1","content":[],"isError":false}}}
EOT
	# A call whose result never arrived while the log continued is a real break;
	# a call at the very end of the log may simply still be running.
	cat >"$fixtures/lost-result.jsonl" <<'EOT'
{"type":"session","id":"s","cwd":"/x","agentPreset":"build","createdAt":0}
{"type":"request/header","data":{"header":{"system":"S","tools":[{"name":"bash"}],"config":{"model":"m"}}}}
{"type":"tool/call","data":{"callId":"c1","name":"bash","arguments":"{}"}}
{"type":"tool/call","data":{"callId":"c2","name":"read","arguments":"{}"}}
{"type":"tool/result","data":{"message":{"source":{"kind":"tool","callId":"c2"},"content":[]}}}
EOT
	cat >"$fixtures/in-flight.jsonl" <<'EOT'
{"type":"session","id":"s","cwd":"/x","agentPreset":"build","createdAt":0}
{"type":"request/header","data":{"header":{"system":"S","tools":[{"name":"bash"}],"config":{"model":"m"}}}}
{"type":"tool/call","data":{"callId":"c1","name":"bash","arguments":"{}"}}
EOT
	cat >"$fixtures/bad-header.jsonl" <<'EOT'
{"type":"session","id":"s","cwd":"/x","agentPreset":"build","createdAt":0}
{"type":"request/header","data":{}}
EOT
	# A log mounted as another space must be SIN EVIDENCIA for this space, never
	# compared against the wrong contract.
	cat >"$fixtures/other-space.jsonl" <<'EOT'
{"type":"session","id":"s","cwd":"/x","agentPreset":"build","createdAt":0}
{"type":"agent-preset/selected","data":{"agentPreset":"creator"}}
{"type":"request/header","data":{"header":{"system":"S","tools":[{"name":"bash"}],"config":{"model":"m"}}}}
EOT
	log_case() {
		local name="$1" file="$2" expect="$3"
		case "$expect" in
			pass) node "$HERE/lib/contract_check.mjs" log "$file" >/dev/null 2>&1 \
				&& ok "log fixture $name passes" || bad "log fixture $name must pass" ;;
			fail) node "$HERE/lib/contract_check.mjs" log "$file" >/dev/null 2>&1 \
				&& bad "log fixture $name must FAIL" || ok "log fixture $name FAILS as it must" ;;
			skip) if node "$HERE/lib/contract_check.mjs" log "$file" 2>&1 | grep -q 'skip'; then
				ok "log fixture $name is SIN EVIDENCIA"
			else
				bad "log fixture $name must report SIN EVIDENCIA (skip)"
			fi ;;
		esac
	}
	log_case "empty session (SIN EVIDENCIA)" "$fixtures/empty.jsonl" skip
	log_case "session without requests (SIN EVIDENCIA)" "$fixtures/no-requests.jsonl" skip
	log_case "valid session with tools and usage" "$fixtures/valid.jsonl" pass
	log_case "alternate result callId shape" "$fixtures/valid-alt-result-shape.jsonl" pass
	log_case "result lost while the log continued" "$fixtures/lost-result.jsonl" fail
	log_case "newest call still in flight" "$fixtures/in-flight.jsonl" pass
	log_case "header without header object" "$fixtures/bad-header.jsonl" fail
	if node "$HERE/lib/contract_check.mjs" surface "$fixtures/other-space.jsonl" build 2>&1 | grep -q 'skip'; then
		ok "surface fixture mounted as another space is SIN EVIDENCIA"
	else
		bad "surface fixture mounted as another space must not be compared"
	fi
	rm -rf "$tmp"
fi

# ── what this suite cannot prove ────────────────────────────────────────────
echo "model behavior / physical QA: not covered by isolated runtime mount"
echo
if [ "$fail" = 0 ]; then
	echo "PASS"
else
	echo "FAIL"
fi
exit "$fail"
