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

## Dense visual discovery

For open-ended visual/polish work, discovery and repair are separate passes. Do
one bounded representative sweep before touching code. Reuse existing captures or
produce only the views that expose materially different states. When several
independent captures are needed, generate them in one shell command/job instead
of spending a model turn per capture. Then read related images concurrently in
the same assistant step; when there are many frames, prefer one contact
sheet/strip over serial reads.

Scan the entire batch once and keep a short inventory of every clear defect with
its view/state. Do not tunnel into the first defect before finishing that scan.
Then rank the confirmed issues by visible impact and shared owner: fix a small
coherent group when one owner/change closes them together, otherwise fix the
highest-impact item and leave the other observed defects explicitly recorded for
the next pass. Do not continue discovery after one representative sweep unless a
fix exposes a genuinely new state.

For temporal defects, capture a short sequence/video as source evidence and sample
representative before/during/after frames into a strip/contact sheet the model can
actually inspect. A video file path by itself is not visual evidence. Open
individual frames only when the sheet hides a detail or continuity itself is the
question.

For a visual question, a current capture is primary evidence. Do not build a new
probe, geometry proof or analysis script for something the image already answers.
Use metrics only to locate a cause vision cannot reveal or to lock a regression
after the visual fix; inspect comparable evidence again after the change.

A test that cannot fail because of the change is not evidence. Neither is a
screenshot nobody looked at. Do not rerun an already decisive check without a
state change that could alter its result. Full suite, `qa touch` and Android build
are release/cross-boundary gates, not ritual closing steps.

Report what ran and what it proved; what did not run is `SIN VERIFICAR`; what was
deduced from logs or metrics is `INFERENCIA`. Commit and push once the required
evidence exists.
