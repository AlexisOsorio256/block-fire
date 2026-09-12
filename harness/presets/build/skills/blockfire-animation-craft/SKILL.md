---
name: blockfire-animation-craft
description: "Load for clips, rig, IK, poses or reload; fix animation, TPS locomotion and gamefeel."
whenToUse: "When the task touches clips, rig, IK, poses, reload, locomotion or stiffness, popping and sliding of movement; also if it asks for Free Fire-style movement."
---

# Animation

Source of truth: `assets/animation_sources/<Clip>.blend`; the GLB is an export. Do
not edit `.glb`/`.import` by hand. `ReloadRifle` and `ReloadPistol` are
`CRAFT_LOCKED`: no `--rebuild`.

## One timeline, then commit to an owner

Use semantic temporal evidence before code archaeology. Prefer one compact aligned
storyboard over serial frames: stable state, transition boundary/peak, first stable
after, recovery only when it changes the result. When angle matters, run the same
timeline from two complementary views concurrently (`side` + `q34/back` is usually
enough). Keep mode, weapon, duration and frame indices identical.

The first aligned overview must answer the visible question, not every possible
animation question. Scan feet/contact, pelvis/torso, facing/silhouette,
weapon/support hand, aim/recoil/reload, camera and transition pops. Locally densify
a suspicious boundary only while no concrete defect/owner can yet be named.

### Animation EVIDENCE LOCK

The instant a concrete defect and plausible layer exist, **stop looking**. No more
pre-edit screenshots, views, sheets, clips or "one last comparison". Read the
owner and an edit-critical dependency if needed. One extra causal check is allowed
only when you can state two materially different candidate patches and the check
selects between them. Then edit and let the after sequence falsify or confirm the
choice.

Do not use long reasoning to talk yourself out of an obvious player-visible defect.
A minimal plausible patch plus watched after is cheaper and more informative than
proving every alternative wrong first. If the user says to edit now, skip any
remaining discovery immediately.

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
If only the weapon/hand relation is wrong, do not reopen locomotion cadence. This
is exactly the point of the aligned views.

## No session labs in the checkout

Do not create custom animation/pitch/combat labs just to increase confidence.
Existing `tools/bf qa motion`, tracked probes and comparable runtime capture come
first. If a missing state truly blocks the patch and existing tooling cannot expose
it, write the smallest throwaway script/output under `/tmp/blockfire-*`, never
under `captures/`, `tests/`, `tools/` or any repo path, and remove it afterwards.

For locomotion consult [the runtime recipe](references/locomotion.md). Preserve
speeds and foot-lock unless gameplay change was requested. Two failed edits with
no new evidence mean revise the hypothesis or leave it unresolved, not more blind
tuning.

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
