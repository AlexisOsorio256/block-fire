#!/bin/bash
# BLOCKFIRE harness layer — smoke test.
#
# Cheap by default (no model calls): composition shape, row resolution, skill
# frontmatter, plugin syntax, and drift between the repo and the installed copy.
#
#   harness/test.sh
#
# This does not prove the composition MOUNTS; see the live checks at the end of
# this file and in README.md.
set -uo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/.." && pwd)"
PRESET="$HERE/presets/blockfire"
COMPOSITION="$PRESET/agent.cordis.yml"
SKILLS="$PRESET/skills"

fail=0
ok() { printf '  ok    %s\n' "$1"; }
bad() { printf '  FAIL  %s\n' "$1"; fail=1; }

echo "BLOCKFIRE harness layer — $(basename "$ROOT")/harness"

# ── structure ───────────────────────────────────────────────────────────────
echo "structure"
for f in "$COMPOSITION" "$PRESET/preset.yml" "$PRESET/plugins/capabilities.js" "$HERE/install.sh" "$HERE/bin/session-report.mjs"; do
	if [ -f "$f" ]; then ok "${f#"$ROOT"/}"; else bad "missing ${f#"$ROOT"/}"; fi
done
for d in "$SKILLS"/*/; do
	[ -f "$d/SKILL.md" ] || bad "skill without SKILL.md: ${d#"$ROOT"/}"
done
[ "$(ls -1 "$SKILLS" | wc -l)" -gt 0 ] || bad "no skills found"

# ── plugin syntax ───────────────────────────────────────────────────────────
echo "plugin"
if node --check "$PRESET/plugins/capabilities.js" 2>/dev/null; then ok "plugins/capabilities.js parses"; else bad "plugins/capabilities.js has a syntax error"; fi

# ── composition + skills ────────────────────────────────────────────────────
echo "composition"
# Package rows resolve against the DSH install; the installed copy links it.
BF_INSTALL_MODULES="$(readlink -f "${DSH_HOME:-$HOME/.dsh}/.agent-presets/blockfire/node_modules" 2>/dev/null || true)"
export BF_INSTALL_MODULES
python3 - "$COMPOSITION" "$SKILLS" <<'PY'
import json, os, sys

try:
    import yaml
except ImportError:
    print("  SKIP  PyYAML not installed (composition check skipped)")
    sys.exit(0)

composition, skills_dir = sys.argv[1], sys.argv[2]

class Loader(yaml.SafeLoader):
    pass

# `!!js <expr>` is evaluated by the harness at mount time; here it only has to
# parse, so the tag becomes an opaque marker.
Loader.add_multi_constructor('tag:yaml.org,2002:js', lambda loader, suffix, node: {'__js__': True})

problems = []
try:
    rows = yaml.load(open(composition, encoding='utf-8'), Loader=Loader)
except Exception as error:
    print(f"  FAIL  composition does not parse: {error}")
    sys.exit(1)

if not isinstance(rows, list):
    print("  FAIL  composition must be a top-level list of rows")
    sys.exit(1)

base = os.path.dirname(os.path.abspath(composition))
install_modules = os.environ.get('BF_INSTALL_MODULES', '')
ids, names = [], []

def visit(row_list, path=''):
    for row in row_list:
        if not isinstance(row, dict):
            problems.append(f'{path}: row is not a map')
            continue
        row_id = row.get('id') or '?'
        if row.get('group') is True:
            children = row.get('config')
            if not isinstance(children, list):
                problems.append(f'{path}{row_id}: group without a row list')
                continue
            visit(children, f'{path}{row_id}:')
            continue
        name = row.get('name')
        if not isinstance(name, str):
            problems.append(f'{path}{row_id}: no plugin name')
            continue
        ids.append(f'{path}{row_id}')
        names.append(name)
        if name.startswith('cordis:'):
            continue
        if name.startswith('.'):
            target = os.path.normpath(os.path.join(base, name))
            if not os.path.exists(target):
                problems.append(f'{path}{row_id}: relative row target missing: {name}')
            continue
        if name.startswith('file:') or os.path.isabs(name):
            continue
        if install_modules:
            # A row may name a package subpath export (`@scope/pkg/sub`); only
            # the package root has to exist in the install.
            parts = name.split('/')
            package = '/'.join(parts[:2]) if name.startswith('@') else parts[0]
            if not os.path.isdir(os.path.join(install_modules, package)):
                problems.append(f'{path}{row_id}: package not installed: {package}')

visit(rows)
dupes = {i for i in ids if ids.count(i) > 1}
for d in sorted(dupes):
    problems.append(f'duplicate row id: {d}')

if problems:
    for p in problems:
        print(f'  FAIL  {p}')
else:
    print(f'  ok    {len(ids)} rows resolve ({len(set(names))} distinct plugins)')

# ── skill frontmatter ───────────────────────────────────────────────────────
skill_problems = []
count = 0
for entry in sorted(os.listdir(skills_dir)):
    path = os.path.join(skills_dir, entry, 'SKILL.md')
    if not os.path.isfile(path):
        continue
    count += 1
    text = open(path, encoding='utf-8').read()
    if not text.startswith('---\n'):
        skill_problems.append(f'{entry}: missing frontmatter')
        continue
    end = text.find('\n---', 4)
    if end < 0:
        skill_problems.append(f'{entry}: unterminated frontmatter')
        continue
    try:
        meta = yaml.load(text[4:end], Loader=yaml.SafeLoader) or {}
    except Exception as error:
        skill_problems.append(f'{entry}: frontmatter does not parse: {error}')
        continue
    if meta.get('name') != entry:
        skill_problems.append(f'{entry}: frontmatter name is {meta.get("name")!r}, must equal the directory name')
    description = meta.get('description')
    if not isinstance(description, str) or not description.strip():
        skill_problems.append(f'{entry}: missing description')
    elif len(description) > 400:
        skill_problems.append(f'{entry}: description is {len(description)} chars; keep the catalog entry short')

if skill_problems:
    for p in skill_problems:
        print(f'  FAIL  {p}')
else:
    print(f'  ok    {count} skills with valid frontmatter')

sys.exit(1 if (problems or skill_problems) else 0)
PY
[ $? -eq 0 ] || fail=1

# ── installed copy in sync ──────────────────────────────────────────────────
echo "installation"
if "$HERE/install.sh" --check >/dev/null 2>&1; then
	ok "installed copy is in sync with the repo"
else
	bad "installed copy differs — run harness/install.sh"
fi

# ── what this test cannot prove ─────────────────────────────────────────────
# The checks above are static. Whether the composition MOUNTS in a live runtime
# is a separate check: only the Web surface composes agent presets in this DSH
# version, so the two real checks are
#   1. a mount validation inside a `cordis` session (agentPresets.standingKeyFor),
#      procedure in README.md and in the `blockfire-harness` skill;
#   2. a real BLOCKFIRE session in the Web GUI.
echo "live mount: NOT covered here (see harness/README.md — mount validation + a real session)"

echo
if [ "$fail" = 0 ]; then
	echo "PASS"
else
	echo "FAIL"
fi
exit "$fail"
