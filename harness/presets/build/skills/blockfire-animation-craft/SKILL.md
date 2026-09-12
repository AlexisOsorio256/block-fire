---
name: blockfire-animation-craft
description: "Load for clips, rig, IK, poses or reload; fix animation, TPS locomotion and gamefeel."
whenToUse: "When the task touches clips, rig, IK, poses, reload, locomotion or stiffness, popping and sliding of movement; also if it asks for Free Fire-style movement."
---

# Animation

Source of truth: `assets/animation_sources/<Clip>.blend`; the GLB is an export. Do
not edit `.glb`/`.import` by hand. `ReloadRifle` and `ReloadPistol` are
`CRAFT_LOCKED`: no `--rebuild`.

## Read motion as a timeline first

When current captures/renders can show the sequence, build **semantic temporal
evidence before tracing code, transforms or measurements**. Do not just sample
frames at equal intervals. Select a compact chronological storyboard covering the
relevant stable states plus the transition boundaries between them: last stable
before, transition/peak, first stable after, and recovery/settle only when it
changes the visual result. Include representative steady phases needed to judge a
cycle. For long sequences or video, sample those semantic moments into one
`tools/bf qa sheet` rather than opening the source frame by frame.

Keep enough state context to explain every tile — for example movement intent,
speed, sprint, ADS, fire, reload, crouch, airborne/land or weapon switch. The
existing QA overlay, semantic filenames and `qa sheet` tile mapping are preferred
over inventing a new probe. A frame with no reason to exist in the storyboard is
noise.

Inspect the **whole timeline in one inference** and compare adjacent tiles. Before
focusing on the first bad pose, inventory all clear continuity defects relevant to
the motion: foot contact/slide and cadence, pelvis height/rotation, torso and
shoulder continuity, facing/silhouette, dominant/support hand and weapon alignment,
aim/recoil/reload continuity, camera composition and transition/recovery pops.
One temporal sheet should support several diagnoses when the evidence contains
them. Open an individual frame only when the sheet hides the detail needed to
judge or fix it. Use numbers to locate a cause vision cannot reveal or to protect
the fix, never as a substitute for looking.

Then identify where the defect is born:

- Input, speed or intent does not arrive: `game/player/player.gd` and
  `OperatorVisual.set_combat_state()` / `_read_motion_inputs()`.
- Clip correct in isolation, but transition/torso fails: `operator_motion.gd`.
- Pose correct but cadence or sliding: the phase clock in `operator_motion.gd`
  (advances `speed / stride`), not the clip. Measure it before touching formulas
  with `tools/probe-loco-axes.gd`, as the recipe says.
- Final pose, weapon mount or grip: layer/IK order in `operator_visual.gd`.
- Defect exists in the isolated clip: edit its `.blend` in Blender.

For locomotion consult [the runtime recipe](references/locomotion.md): it includes
commands, comparable phases and lab limits. Look at the defect first, state a
testable cause and make one focal change; look at the same semantic sequence
again. Preserve speeds and foot-lock unless a gameplay change was requested. Two
attempts with no new evidence are a signal to revise the hypothesis or hand the
case to review, not to keep tuning numbers blindly.

To edit the clip, enable `bf_capability` with
`{"action":"on","capability":"blender"}`: `blender_exec` +
`blender_screenshot`. Python also allows querying scene, bones and curves; the
full MCP is not needed for those queries. If a real capability is missing, turn
off `blender` and enable `blender-full`; they do not coexist.

`*.blend` files are pure rig: the viewport has no body and the render comes out
empty. To really judge, run `exec(open('tools/bf_blender_body.py').read())`
in the open scene (it links the real operator to the clip rig) and **render** the
cycle with `bpy.ops.render.render` at semantic frames across the cycle, not a
single pose: `blender_screenshot` captures the viewport and does not always
refresh. Measuring the clip also requires looking at the curve, not the pose:
`Body.location` uses its **local Y** as the vertical axis (local Z is forward),
and reading the wrong index makes you conclude a flat curve "is already applied".
If the clip comes from `--rebuild`, check whether its arms need re-baking
(`tools/bake_locomotion_arms.py`, SprintFwd and StrafeLeft only) before exporting.

Save the source, export with `tools/bf blender <Clip>`, force a Godot reimport and
look at the relevant runtime/QA before closing. An unwatched capture or an export
without runtime does not prove visual quality. Android only when the conclusion
depends on the device.

If the Blender MCP is unavailable, report it; do not silently replace interactive
craft with mass generation.

The image must reach the model: use `read_image` for Godot PNGs and
`blender_screenshot` for the viewport. A path, a generated MP4 or an
image-not-available message does not allow judging quality; sample a video into
semantic representative frames/contact sheet unless the active client can
actually present its frames to the model. If the visual route fails, continue
useful numeric tests and leave the visual judgment unverified.
