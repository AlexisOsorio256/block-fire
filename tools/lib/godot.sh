#!/bin/bash
# Single Godot resolver for every BLOCKFIRE tool.
blockfire_find_godot() {
  if [ -n "${BLOCKFIRE_GODOT:-}" ] && [ -x "$BLOCKFIRE_GODOT" ]; then printf '%s\n' "$BLOCKFIRE_GODOT"; return 0; fi
  local candidate
  for candidate in "$(command -v godot 2>/dev/null || true)" "$(command -v godot4 2>/dev/null || true)" "$HOME/.local/share/blockfire-tools/godot-4.7.2/godot"; do
    if [ -n "$candidate" ] && [ -x "$candidate" ]; then printf '%s\n' "$candidate"; return 0; fi
  done
  return 1
}
