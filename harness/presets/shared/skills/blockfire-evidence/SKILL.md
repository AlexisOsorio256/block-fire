---
name: blockfire-evidence
description: >-
  Pick the minimum evidence that actually proves a BLOCKFIRE change.
whenToUse: >-
  When deciding what proof is enough to close code, visuals, animation,
  performance or platform work.
---

# Proportional evidence

Prove the behavior that changed; do not run a global checklist out of habit.

- Logic/rules: a targeted test, or `tools/bf test` when that suite covers the change.
- Scene/input/runtime: QA of the affected area.
- Presentation/animation: visual evidence you actually looked at, plus the relevant runtime.
- Android/platform: a physical device when the conclusion depends on it.
- Performance: a before/after measurement.
- Docs: consistency with the code that owns the behavior.
- Assets: origin and license in `CREDITS.md`.

A test that does not touch the change is not evidence. Neither is a screenshot
nobody looked at. The full suite, `qa touch` and an Android build are gates for
release or for changes that really cross them, not for every commit.

Report: what ran states what it proved; what did not run is `SIN VERIFICAR`;
what was deduced from logs or metrics is `INFERENCIA`. Commit and push are
allowed once that task's required evidence exists.
