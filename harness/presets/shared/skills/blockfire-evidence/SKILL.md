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
captures together instead of spending a model turn per capture.

For **four or more related stills**, serial `read_image` calls are the wrong
shape. Build one overview first:

`tools/bf qa sheet --out=/tmp/blockfire-visual-sheet.png --cols=4 <images...>`

Inspect that sheet once and inventory every clear defect with its tile/view/state
before focusing on any one issue. Open an individual source image only when the
overview hides a detail needed to judge or fix it. For two or three independent
views, issue their `read_image` calls together in the same assistant step.

### Parallel multiview evidence

When two camera views or fixtures are independent, read-only and expose different
failure modes, **fan them out concurrently instead of running them serially**.
For `tools/bf qa motion`, prefer two complementary views such as side + back/q34
with the same mode, weapon, duration and timeline, each in its own output
directory. Launch both processes/jobs before waiting for either. Two useful views
normally beat four redundant ones; add a third only if one specific ambiguity
survives.

Keep semantic frames aligned across views: the same frame/state in one view should
map to the same frame/state in the other. Build one sheet per view or a paired
sheet, then inspect the aligned timelines in the same inference. This turns camera
occlusion into information: one view can expose foot/contact and weapon pitch while
another exposes facing, shoulder/hand relation or silhouette.

Parallelize only observation that cannot mutate shared state. Never run source
edits, imports, Blender writes, asset exports or git writes concurrently against
the same files, and never share one capture output directory between processes.
If launching two Godot runs would contend for a mutable import step, do the import
once first and fan out only the read-only capture stage.

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

Use **adaptive temporal density**. Keep the overall sweep sparse, then sample more
densely only around the suspicious boundary (for example N-1, N, N+1, N+3, N+6,
or several frames spanning the blend weight). Do not raise the frame density of
the whole sequence just because one transition needs close inspection. If real-time
play hides the boundary, deterministic frame stepping or a slowed capture is fine;
the purpose is to expose the transition, not to create more frames to inspect.

Read the resulting sheet as **one timeline**, comparing adjacent tiles and aligned
views instead of judging screenshots independently. Before touching code,
inventory every clear continuity defect relevant to the scene: feet/contact and
cadence, pelvis/torso continuity, facing and silhouette, weapon/hand alignment,
camera composition, combat feedback/HUD state and transition/recovery pops. One
sheet should support several diagnoses when the evidence shows them; do not burn a
new model turn for each visible defect.

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

Use the observed scope to choose the owner before escalating. If body/locomotion
continuity is coherent across views but only a weapon, hand, camera or overlay
remains rigid/misaligned, inspect that runtime layer first rather than reopening
clips or movement timing. If the whole body path or isolated clip is wrong, then
the motion/clip owner is plausible. Multiview evidence is especially useful for
making this distinction without a broad code audit.

Batch independent captures, targeted checks and other cheap shell work. Do not
spend a separate model turn on each command when their results can be judged
together. A successful edit plus decisive after evidence does not need a reread of
unrelated code. If one targeted causal check still leaves the owner genuinely
ambiguous, record the issue as unresolved rather than expanding into a broad
subsystem audit.

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
of it: repeat the same semantic frames/views after the edit, plus a relevant
probe/test only when that contract needs one. If the defect affects what the
player actually sees — camera, weapon presentation, ADS/combat composition or
input-driven transitions — add **one** representative player-camera/runtime
capture when the isolated lab cannot prove that perspective. Lab + runtime are
not two ritual proofs; use both only when they answer different questions.

During a coherent visual pass, do **not** run `tools/bf test` after every micro-fix.
Run the broad integration suite once after the coherent group is closed, or earlier
only when a cross-boundary change or a failure creates a new reason. A commit does
not by itself require another full suite.

A test that cannot fail because of the change is not evidence. Neither is a
screenshot nobody looked at. Do not rerun an already decisive check without a
state change that could alter its result. Full suite, `qa touch` and Android build
are release/cross-boundary gates, not ritual closing steps.

Report what ran and what it proved; what did not run is `SIN VERIFICAR`; what was
deduced from logs or metrics is `INFERENCIA`. Commit and push once the required
evidence exists.
