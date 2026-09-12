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
contract is proved, stop. More proof matters only when it protects a distinct
regression.

- Logic/rules: one targeted test, or `tools/bf test` when that suite owns it.
- Scene/input/runtime: QA of the affected area.
- Presentation/animation: watched current capture plus runtime only when it answers a different question.
- Android/platform: physical device only when the conclusion depends on it.
- Performance: before/after measurement.
- Docs: consistency with the code owner.
- Assets: origin/license in `CREDITS.md`.

## One discovery sweep

Open-ended visual work gets one bounded representative sweep before editing.
Reuse current evidence. Generate only materially different states/views together
and keep timelines aligned.

For four or more related stills, make one overview:

`tools/bf qa sheet --out=/tmp/blockfire-visual-sheet.png --cols=4 <images...>`

Keep an overview compact enough to judge the subject: normally **8-12 semantic
tiles**, not dozens of tiny frames. Prefer two complementary views over many
redundant ones. If a specific tile exposes a candidate but hides one edit-critical
detail, one focused close view is enough; otherwise do not densify.

Scan composition, facing/gaze, pose, weapon/hand alignment, silhouette/clipping,
lighting, background and UI overlap; for motion also scan feet/contact,
pelvis/torso, weapon/hand continuity, camera and transition/recovery. Inventory
obvious defects once, then make a binary decision.

## Decision fork

After the sweep choose exactly one outcome; do not oscillate between them.

**A — defect + owner:** one player-visible defect is concrete enough to name and
one owner/layer is plausible. The first code/search/probe call is a commitment to
that hypothesis and starts EVIDENCE LOCK.

**B — no justified defect:** nothing important is nameable at the inspected
resolution. Stop and report that bounded result. This is a successful outcome.
Do not reconstruct the images from memory, search for a different candidate,
reinterpret probe numbers, or keep thinking until some edit can be invented.

A `TERMINAL VISUAL PASS` guard result means outcome B is mandatory for the current
turn. Produce the final report immediately; do not call another tool or continue
internal reconsideration.

## EVIDENCE LOCK

Once outcome A starts, discovery is over until a real edit:

1. No more images, sheets, captures or custom labs.
2. Read the owner and only an edit-critical dependency if needed.
3. At most one causal check may choose between two materially different patches.
4. Edit. Let the comparable after falsify or confirm the patch.

Do not disprove alternative hypotheses or switch to a new candidate when the
committed hypothesis dies. If the bounded owner/check path does not justify an
edit, stop the turn without changing product code. A failed hypothesis is useful
evidence; it is not permission to reopen discovery.

## No throwaway tooling in the repo

Use existing `tools/bf` and tracked probes. If a genuinely missing observation
blocks the initial patch choice and no existing tool can expose it, the smallest
throwaway may live only under `/tmp/blockfire-*`; never under `captures/`,
`tests/`, `tools/` or another checkout path. Once EVIDENCE LOCK starts, creating a
new probe/lab is no longer allowed.

Generated PNGs, contact sheets, logs and one-session diagnostic scripts stay
outside the checkout.

## Choose the owner from the image

Use multiview evidence to avoid code archaeology. If feet/pelvis/torso are
coherent but only weapon, hands, camera-relative presentation or an additive pose
is wrong, inspect mount/IK/runtime layer before clips. If the whole body path or
isolated clip is wrong, motion/clip ownership is plausible. If only a transition
is wrong while steady clips are sound, inspect transition blending rather than all
clips.

## Verification cadence

After an edit, repeat the same minimal semantic evidence. Add one player-camera
capture only when the isolated lab cannot prove what the player sees. Lab +
runtime are not ritual duplicates.

Run the cheapest focal test that can fail because of the change. During a coherent
visual group do not run the full suite after each micro-fix; run it once when the
group closes, or earlier only for real cross-boundary risk/failure. Do not rerun a
decisive check without a state change that could alter it.

Report what ran and what it proved. What did not run is `SIN VERIFICAR`;
deductions from logs/metrics are `INFERENCIA`. Commit and push once required
evidence exists.
