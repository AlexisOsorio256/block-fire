---
name: blockfire-animation-craft
description: "Load for clips, rig, IK, poses or reload; fix animation, TPS locomotion and gamefeel."
whenToUse: "When the task touches clips, rig, IK, poses, reload, locomotion or stiffness, popping and sliding of movement; also if it asks for Free Fire-style movement."
---

# Animation

Source of truth: `assets/animation_sources/<Clip>.blend`; the GLB is an export. Do
not edit `.glb`/`.import` by hand. `ReloadRifle` and `ReloadPistol` are
`CRAFT_LOCKED`: no `--rebuild`.

## One timeline, then one decision

Use semantic temporal evidence before code archaeology. Prefer one compact aligned
storyboard over serial frames: stable state, transition boundary/peak, first stable
after, recovery only when it changes the result. When angle matters, run the same
timeline from two complementary views concurrently (`side` + `q34/back` is usually
enough). Keep mode, weapon, duration and frame indices identical.

The overview must stay readable: usually 8-12 semantic tiles per sheet, not dozens
of tiny poses. Scan feet/contact, pelvis/torso, facing/silhouette, weapon/support
hand, aim/recoil/reload, camera and transition pops. A suspicious tile may earn one
focused detail before commitment; global densification is not allowed.

After the overview choose once:

- **Concrete defect + plausible layer:** the next code/search/probe call commits to
  that layer and Animation EVIDENCE LOCK starts.
- **No concrete defect:** stop the turn with no product edit. Do not replay the
  timeline from memory, brainstorm another candidate or mine probe numbers until
  something looks suspicious.

A `TERMINAL VISUAL PASS` result ends animation discovery immediately. Do not keep
reasoning after it; report the bounded result.

### Animation EVIDENCE LOCK

Once committed, no more pre-edit screenshots, views, sheets, clips or custom labs.
Read the owner and an edit-critical dependency if needed. One causal check is
allowed only when its result chooses between two materially different patches.
Then edit and let the after sequence falsify or confirm the choice.

If that committed hypothesis is disproved, stop the turn rather than switching to
a second hypothesis. A failed candidate is a completed result, not a reason for a
new sweep.

Use multiview evidence to separate **clip/body** from **runtime-layer** defects:

- Input/speed/intent missing: `game/player/player.gd` and
  `OperatorVisual.set_combat_state()` / `_read_motion_inputs()`.
- Clip correct, transition/torso wrong: `operator_motion.gd`.
- Pose correct but cadence/sliding wrong: phase clock in `operator_motion.gd`;
  use `tools/probe-loco-axes.gd` only when that metric can change the patch.
- Feet/pelvis/torso coherent while weapon/hands/camera-relative pose alone is
  rigid/misaligned: `operator_visual.gd` mount/layer/IK before Blender.
- Defect exists in isolated clip: edit the `.blend` source.

If steady clips are sound but a transition is wrong, do not inspect every clip.
If only the weapon/hand relation is wrong, do not reopen locomotion cadence.

## No session labs in the checkout

Existing `tools/bf qa motion`, tracked probes and comparable runtime capture come
first. If a missing state truly blocks the initial patch choice and existing tools
cannot expose it, write the smallest throwaway under `/tmp/blockfire-*`, never
under `captures/`, `tests/`, `tools/` or any repo path, and remove it afterwards.
Once EVIDENCE LOCK starts, new diagnostic scripts are forbidden.

For locomotion consult [the runtime recipe](references/locomotion.md). Preserve
speeds and foot-lock unless gameplay change was requested. Two failed edits with
no new evidence mean revise the hypothesis in a future pass or leave it unresolved,
not more blind tuning now.

After a player-facing fix, repeat the same minimal aligned frames. Add one
player-camera/runtime capture only when the lab cannot prove what the player sees.
Do not duplicate lab and runtime when they answer the same question.

## Blender only when the clip is the owner

Enable `bf_capability` with `{"action":"on","capability":"blender"}` for
`blender_exec` + `blender_screenshot`; escalate to `blender-full` only when a real
missing capability requires it. They do not coexist.

`*.blend` files are pure rig. To judge them with the real operator, run
`exec(open('tools/bf_blender_body.py').read())` in the scene and render semantic
frames. `Body.location` uses local Y vertically (local Z is forward). If a clip
comes from `--rebuild`, check whether its arms require the existing rebake path
before export.

Save source, export only the affected clip with `tools/bf blender <Clip>`, force
Godot reimport, then inspect the relevant runtime/QA. An unwatched capture or an
export without runtime does not prove visual quality. Android only when the
conclusion depends on the device.
