---
name: blockfire-evidence
description: >-
  Pick the minimum evidence that actually proves a BLOCKFIRE change.
whenToUse: >-
  When deciding what proof is enough to close code, visuals, animation,
  performance or platform work.
---

# Proportional evidence

Use the cheapest decisive evidence for the behavior that changed. Once that
contract is proved, stop: more independent proof is waste unless it protects a
distinct regression.

- Logic/rules: a targeted test, or `tools/bf test` when that suite covers the change.
- Scene/input/runtime: QA of the affected area.
- Presentation/animation: inspect the current capture first; visual evidence you actually looked at, plus the relevant runtime only when needed.
- Android/platform: a physical device when the conclusion depends on it.
- Performance: a before/after measurement.
- Docs: consistency with the code that owns the behavior.
- Assets: origin and license in `CREDITS.md`.

For a visual question, a current capture is primary evidence. Do not build a new
probe, geometry proof or analysis script for something the image already answers.
Use metrics only to locate a cause vision cannot reveal or to lock a regression
after the visual fix; inspect again after the change.

A test that cannot fail because of the change is not evidence. Neither is a
screenshot nobody looked at. Do not rerun an already decisive check without a
state change that could alter its result. Full suite, `qa touch` and Android build
are release/cross-boundary gates, not ritual closing steps.

Report what ran and what it proved; what did not run is `SIN VERIFICAR`; what was
deduced from logs or metrics is `INFERENCIA`. Commit and push once the required
evidence exists.
