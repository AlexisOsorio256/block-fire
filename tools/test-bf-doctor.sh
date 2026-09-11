#!/bin/bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

mkdir -p "$TMP/tools" "$TMP/tests" "$TMP/game/data/weapons" \
	"$TMP/assets/animation_sources" "$TMP/assets/models/animation_library"
cp "$ROOT/tools/bf" "$TMP/tools/bf"
chmod +x "$TMP/tools/bf"
touch "$TMP/tests/smoke.gd" "$TMP/tools/qa_motion.gd" "$TMP/tools/qa_touch.gd"
printf 'id = "rifle"\n' > "$TMP/game/data/weapons/rifle.tres"
touch "$TMP/assets/animation_sources/Walk.blend" "$TMP/assets/models/animation_library/Walk.glb"

git -C "$TMP" init -q
git -C "$TMP" config user.email test@blockfire.local
git -C "$TMP" config user.name BLOCKFIRE-test
git -C "$TMP" add .
git -C "$TMP" commit -qm baseline

assert_clean() {
	local output
	output="$(cd "$TMP" && ./tools/bf doctor)"
	if grep -Fq '(+cambios sin commit)' <<<"$output"; then
		echo "test-bf-doctor: clean repo reported dirty" >&2
		exit 1
	fi
}

assert_dirty() {
	local label="$1" output
	output="$(cd "$TMP" && ./tools/bf doctor)"
	if ! grep -Fq '(+cambios sin commit)' <<<"$output"; then
		echo "test-bf-doctor: $label repo reported clean" >&2
		exit 1
	fi
}

assert_clean
printf 'dirty\n' > "$TMP/untracked.txt"
assert_dirty untracked
git -C "$TMP" add untracked.txt
assert_dirty staged
git -C "$TMP" commit -qm staged
printf '# dirty\n' >> "$TMP/tests/smoke.gd"
assert_dirty unstaged

echo "test-bf-doctor: PASS"
