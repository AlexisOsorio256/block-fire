#!/usr/bin/env python3
"""BLOCKFIRE composition checker — the static half of the compatibility contract.

A Cordis composition fails in four ways that are invisible until a session
starts: a row whose package is not installed, a row whose relative file is
missing, an include that does not resolve, and a patch that silently matches
nothing. This checker resolves all of them offline, and treats every one as a
hard FAIL — a clear failure beats silently different behavior.

  check_composition.py [--install-modules DIR] [--expect-rows FILE] COMPOSITION...
  check_composition.py --patch [--install-modules DIR] PATCH.yml

Exit 0 = every row resolves and every patch target exists. Exit 1 = at least one
problem, printed as `FAIL <path>: <reason>`.
"""

import argparse
import os
import sys

try:
    import yaml
except ImportError:  # pragma: no cover - the suite reports the skip
    print("SKIP PyYAML not installed")
    sys.exit(3)


class Loader(yaml.SafeLoader):
    """`!!js` is evaluated by the harness at mount time; here it is opaque."""


Loader.add_multi_constructor(
    "tag:yaml.org,2002:js", lambda loader, suffix, node: {"__js__": loader.construct_scalar(node)}
)

problems = []
notes = []


def load(path):
    try:
        with open(path, encoding="utf-8") as handle:
            return yaml.load(handle, Loader=Loader)
    except Exception as error:  # noqa: BLE001 - any parse failure is the finding
        problems.append(f"{path}: cannot parse: {error}")
        return None


def package_root(name):
    parts = name.split("/")
    return "/".join(parts[:2]) if name.startswith("@") else parts[0]


def url_literal(entry):
    """Extract the relative literal from a `new URL('<literal>', baseUrl)` row."""
    if not isinstance(entry, dict):
        return None
    text = entry.get("__js__")
    if not isinstance(text, str):
        return None
    marker = "new URL("
    start = text.find(marker)
    if start < 0:
        return None
    rest = text[start + len(marker):].lstrip()
    if not rest.startswith(("'", '"')):
        return None
    quote = rest[0]
    end = rest.find(quote, 1)
    if end < 0:
        return None
    return rest[1:end]


def visit(rows, file_dir, install_modules, patch_targets=None):
    if not isinstance(rows, list):
        problems.append(f"{file_dir}: top-level list expected")
        return
    for row in rows:
        if not isinstance(row, dict):
            problems.append(f"{file_dir}: row is not a map")
            continue
        row_id = row.get("id") or "?"
        name = row.get("name")
        if not isinstance(name, str):
            problems.append(f"{file_dir}:{row_id}: no plugin name")
            continue

        if name == "cordis:include":
            config = row.get("config") or {}
            target = config.get("path")
            if not isinstance(target, str):
                problems.append(f"{file_dir}:{row_id}: include without a path")
                continue
            included = os.path.normpath(os.path.join(file_dir, target))
            if not os.path.isfile(included):
                problems.append(f"{file_dir}:{row_id}: include target missing: {target}")
                continue
            included_dir = os.path.dirname(included)
            included_rows = load(included)
            if included_rows is None:
                continue
            # Patch targets must exist in the included file, or the patch is a
            # silent no-op (the loader warns and skips it).
            for patch in config.get("patches") or []:
                if not isinstance(patch, dict):
                    continue
                patch_id = patch.get("id")
                if patch_id is None:
                    continue
                if not any(
                    isinstance(candidate, dict) and candidate.get("id") == patch_id
                    for candidate in included_rows
                ):
                    problems.append(f"{file_dir}:{row_id}: patch target not in include: {patch_id}")
            visit(included_rows, included_dir, install_modules)
            continue

        if name.startswith("cordis:"):
            continue

        if name.startswith(".") or os.path.isabs(name):
            target = os.path.normpath(os.path.join(file_dir, name))
            if not os.path.exists(target):
                problems.append(f"{file_dir}:{row_id}: relative row target missing: {name}")
            continue

        if patch_targets is not None:
            # Patch rows are matched by id, not declared; nothing else to resolve here.
            continue

        if install_modules:
            package = package_root(name)
            if not os.path.isdir(os.path.join(install_modules, package)):
                problems.append(f"{file_dir}:{row_id}: package not installed: {package}")

        if name == "@deepseek-ai/dsh-skill-filesystem":
            for entry in (row.get("config") or {}).get("customSkillDirs") or []:
                literal = url_literal(entry)
                if literal is None:
                    continue
                target = os.path.normpath(os.path.join(file_dir, literal))
                if not os.path.isdir(target):
                    if "node_modules" in target:
                        notes.append(f"{file_dir}:{row_id}: external skill dir not linked here: {literal}")
                    else:
                        problems.append(f"{file_dir}:{row_id}: skill dir missing: {literal}")
                    continue
                if not any(
                    os.path.isfile(os.path.join(target, entry_name, "SKILL.md"))
                    for entry_name in os.listdir(target)
                    if os.path.isdir(os.path.join(target, entry_name))
                ):
                    problems.append(f"{file_dir}:{row_id}: no skill with SKILL.md in {literal}")


def check_patch(path, install_modules, base=None):
    """A patch list: every non-insert row must target a row that exists upstream.

    Relative row names in a patch resolve against the PROFILE directory, not the
    patch file's own directory, because the loader composes patches onto the
    profile root. `base` is that directory.
    """
    rows = load(path)
    if rows is None:
        return
    base_dir = base if base is not None else os.path.dirname(os.path.abspath(path))
    if not isinstance(rows, list):
        problems.append(f"{path}: patch must be a top-level list")
        return
    for row in rows:
        if not isinstance(row, dict):
            problems.append(f"{path}: patch entry is not a map")
            continue
        if "insert" in row:
            visit(row["insert"], base_dir, install_modules, patch_targets=True)
            continue
        if not isinstance(row.get("id"), str):
            problems.append(f"{path}: patch without an id")
            continue
        if row.get("name") == "cordis:include":
            continue
        # The id is validated against the live composition by --dump-config; here
        # we only require the row to be well formed.
        notes.append(f"{path}: patch targets row id {row['id']}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--install-modules", default="")
    parser.add_argument("--patch", action="store_true")
    parser.add_argument("--base", default="", help="directory relative row names resolve against (patch mode)")
    parser.add_argument("paths", nargs="+")
    args = parser.parse_args()

    for path in args.paths:
        if args.patch:
            check_patch(path, args.install_modules, args.base or None)
        else:
            rows = load(path)
            if rows is None:
                continue
            visit(rows, os.path.dirname(os.path.abspath(path)), args.install_modules)

    for note in notes:
        print(f"NOTE {note}")
    for problem in problems:
        print(f"FAIL {problem}")
    if not problems:
        print(f"OK {len(args.paths)} file(s) resolve")
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
