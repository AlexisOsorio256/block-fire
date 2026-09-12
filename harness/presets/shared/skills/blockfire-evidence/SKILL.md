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
contract is proved, stop. More proof is useful only when it protects a distinct
regression.

- Logic/rules: one targeted test, or `tools/bf test` when that suite owns it.
- Scene/input/runtime: QA of the affected area.
- Presentation/animation: watched current capture plus runtime only when it answers a different question.
- Android/platform: physical device only when the conclusion depends on it.
- Performance: before/after measurement.
- Docs: consistency with the code owner.
- Assets: origin/license in `CREDITS.md`.

## One discovery sweep

Open-ended visual work gets **one** bounded representative discovery sweep before
editing. Reuse current evidence. Generate only materially different states/views,
launch independent read-only captures together, and keep aligned timelines in the
same mode/weapon/duration.

For four or more related stills, inspect one overview first:

`tools/bf qa sheet --out=/tmp/blockfire-visual-sheet.png --cols=4 <images...>`

Two or three independent views belong in the same assistant step. Prefer two
complementary views (for example side + q34/back) over four redundant ones. Keep
semantic state metadata and sample motion around meaningful steady states and
transition boundaries, not arbitrary intervals. If a transition needs detail,
densify only that boundary.

The overview is for coverage, not exhaustive proof. Scan composition, facing/gaze,
pose, weapon/hand alignment, silhouette/clipping, lighting, background and UI
overlap; for motion also scan feet/contact, pelvis/torso, weapon/hand continuity,
camera and transition/recovery. Record the obvious defects, then choose the
highest-impact coherent owner. Do not turn every possible concern into a separate
investigation.

## EVIDENCE LOCK

**As soon as one player-visible defect is clear enough to name and one plausible
owner/layer exists, discovery is finished.** This is a hard stop, not a suggestion.
Before the first edit:

1. Do not read another image, add another view, rebuild a sheet or rerun a capture.
2. Read the owner and only an edit-critical dependency if needed.
3. At most **one** causal check is allowed, and only when its result chooses between
   two materially different patches. State those two patches before running it.
4. Then edit. The comparable after is the next diagnostic step.

Do not spend pre-edit turns disproving alternative hypotheses, increasing
confidence, checking a candidate that would not change the patch, or proving that
unrelated systems are fine. A plausible minimal fix is allowed to be falsified by
the after; that is cheaper than a proof marathon.

If the user says to edit/fix/start now, EVIDENCE LOCK is immediate. Do not take
"one last look" first.

If the first sweep reveals no important defect, stop and report that result. Do
not keep hunting until some change can be justified.

## No throwaway tooling in the repo

A visible defect is never a reason to create a new lab/probe/capture script. Use
existing `tools/bf` and tracked probes first. If a genuinely missing observation
**blocks** the choice of patch and no existing tool can expose it, the smallest
throwaway script/output may be created only under `/tmp/blockfire-*`; never put
session QA under `captures/`, `tests/`, `tools/` or another checkout path. Remove
the temporary artifact when done.

The repo keeps permanent product/tooling, not one-session evidence. Generated PNGs,
contact sheets, logs and diagnostic scripts stay outside the checkout.

## Choose the owner from the image

Use multiview evidence to avoid broad code archaeology. If feet/pelvis/torso are
coherent but only weapon, hands, camera-relative presentation or an additive pose
is wrong, inspect mount/IK/runtime layer before clips. If the whole body path or
isolated clip is wrong, motion/clip ownership is plausible. If only a transition
is wrong while steady clips are sound, inspect transition blending rather than all
clips.

Once the owner is plausible, broad grep/subsystem exploration is churn. If one
allowed causal check still leaves ownership genuinely ambiguous, leave the issue
unresolved rather than expanding into an audit.

## Verification cadence

After the edit, repeat the **same minimal semantic frames/views**. Add one
player-camera/runtime capture only when the isolated lab cannot prove what the
player sees. Lab + runtime are not ritual duplicates.

Run the cheapest focal test that can fail because of the change. During a coherent
visual group do not run the full suite after each micro-fix; run it once when the
group closes, or earlier only for a real cross-boundary risk/failure. Do not rerun
a decisive check without a state change that could alter it.

Report what ran and what it proved. What did not run is `SIN VERIFICAR`; deductions
from logs/metrics are `INFERENCIA`. Commit and push once required evidence exists.
