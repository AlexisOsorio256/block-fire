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
produce only views that expose materially different states. Generate independent
captures together in one shell command/job instead of spending a model turn per
capture.

For **four or more related stills**, serial `read_image` calls are the wrong
shape. Build one overview first:

`tools/bf qa sheet --out=/tmp/blockfire-visual-sheet.png --cols=4 <images...>`

Inspect that sheet once and inventory every clear defect with its tile/view/state
before focusing on any one issue. Open an individual source image only when the
overview hides a detail needed to judge or fix it. For two or three independent
views, issue their `read_image` calls together in the same assistant step.

A character/presentation scene is incomplete until the same pass explicitly
checks composition, facing/gaze, pose, weapon and hand alignment, silhouette and
clipping, lighting, background, and UI overlap. Record defects from all of those
visible dimensions before prioritizing; a strong first defect must not collapse
the rest of the scene into background noise.

Rank confirmed issues by visible impact and shared owner. Fix a small coherent
group when one owner/change closes them together; otherwise fix the highest-impact
item and keep the other observed defects in the short inventory. Do not start a
second discovery sweep unless a fix exposes a genuinely new state.

For temporal defects, capture a short sequence/video as source evidence and sample
representative before/during/after frames into a strip/contact sheet the model can
actually inspect. A video file path by itself is not visual evidence. Open
individual frames only when the sheet hides a detail or continuity itself is the
question.

For a visual question, a current capture is primary evidence. Do not build a new
probe, geometry proof or analysis script for something the image already answers.
Use metrics only to locate a cause vision cannot reveal or to lock a regression
after the visual fix; inspect comparable evidence again after the change.

## Verification cadence

A focused visual fix gets the cheapest targeted evidence that could fail because
of it: the comparable capture plus a relevant probe/test only when that contract
needs one. During a coherent visual pass, do **not** run `tools/bf test` after
every micro-fix. Run the broad integration suite once after the coherent group is
closed, or earlier only when a cross-boundary change or a failure creates a new
reason. A commit does not by itself require another full suite.

A test that cannot fail because of the change is not evidence. Neither is a
screenshot nobody looked at. Do not rerun an already decisive check without a
state change that could alter its result. Full suite, `qa touch` and Android build
are release/cross-boundary gates, not ritual closing steps.

Report what ran and what it proved; what did not run is `SIN VERIFICAR`; what was
deduced from logs or metrics is `INFERENCIA`. Commit and push once the required
evidence exists.
