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

### Semantic temporal evidence

For animation, combat, camera or gamefeel over time, **batch meaning, not just
pixels**. Do not pick frames merely because they are evenly spaced. First identify
the meaningful stable states and transitions for the behavior under review, then
sample a compact chronological storyboard that preserves their context.

For each important transition, prefer the smallest set that exposes continuity:
last stable frame before it, a representative transition/peak frame, first stable
frame after it, and recovery/settle only when recovery is visually meaningful.
Also include representative steady-state phases needed to judge the cycle itself.
Keep state metadata available in the capture, filename or tool output — intent,
speed, ADS/fire/reload/crouch/air state or other facts that explain why a tile
exists. A tile without a semantic reason is a candidate to drop.

Read the resulting sheet as **one timeline**, comparing adjacent tiles instead of
judging each as an isolated screenshot. Before touching code, inventory every
clear continuity defect relevant to the scene: feet/contact and cadence,
pelvis/torso continuity, facing and silhouette, weapon/hand alignment, camera
composition, combat feedback/HUD state and transition/recovery pops. One sheet
should support several diagnoses when the evidence shows them; do not burn a new
model turn for each visible defect.

If the source is a video or long sequence, select semantic frames from it first
and then build the sheet. Blind every-N-frame sampling is a fallback only when no
state/transition information exists. A video path by itself is not visual
evidence. Open individual frames only when the overview hides detail or continuity
itself needs a closer adjacent comparison.

## Fast closure after the sweep

The representative sheet is the discovery pass, not permission to start another
audit. Once a visible defect is confirmed and its likely owner is known, stop
general exploration. Read the owner and only the dependency required to make the
edit, apply the smallest plausible fix, and generate comparable after evidence.
If the image already establishes the defect, do not add measurements or another
angle unless a specific unanswered question could change the fix.

Batch independent captures, targeted checks and other cheap shell work into one
command/job. Do not spend a separate model turn on each command when their results
can be judged together. A successful edit plus decisive after evidence does not
need a reread of unrelated code. If one targeted causal check still leaves the
owner genuinely ambiguous, record the issue as unresolved rather than expanding
into a broad subsystem audit.

Rank confirmed issues by visible impact and shared owner. Fix a small coherent
group when one owner/change closes them together; otherwise fix the highest-impact
item and keep the other observed defects in the short inventory. Do not start a
second discovery sweep unless a fix exposes a genuinely new state.

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
