# TPS locomotion: working recipe

Run from the project root. Check `git status -sb` and use `tools/bf doctor` when
you need to resolve Godot/Blender. Preserve others' changes. The product reference
orients; do not claim equivalence with Free Fire without an observable movement
comparison.

## Capture and look

`qa motion` already owns the useful temporal lab: fixed 30 Hz, real
`OperatorVisual` + weapon + IK, semantic overlay, and
`--view=front|q34|side|back`. When two views expose different information, launch
them **concurrently** with the same mode/weapon/duration and separate output dirs:

```bash
tools/bf qa motion --mode=locomotion --view=side --duration=16 --out=/tmp/bf-before-side & p1=$!
tools/bf qa motion --mode=locomotion --view=back --duration=16 --out=/tmp/bf-before-back & p2=$!
wait "$p1" "$p2"
```

Side is strong for foot contact, weapon pitch and body lean; back/q34 exposes
facing, shoulders, hands and silhouette. Use two views by default, not four. Add a
third only when a named ambiguity survives. These capture runs are read-only, so
parallelism is useful; imports, source/Blender writes and git operations are not
parallel work. Never share an output directory between capture processes.

Produces 480 PNG per 16 s view at fixed simulated 30 Hz time; the run can take
longer than 16 seconds. If bash hands back a job, keep working on already-known
context and check `job_output` when needed. Do not relaunch a slow QA merely because
it is still running.

Known limit (measured): `qa_motion.gd` moves the actor with a fixed 1/30 s step,
but lets the locomotion clock advance with the frame's REAL delta, so on a busy
machine the rendered cadence is not the simulated one (measured: 0.28 cycles/s in
diagonal while the same state gives 3.26 cycles/s in a fixed-step probe). It
serves to look at pose, blend, mount and IK; not to judge cadence, sliding or
phase. Those judgments go through `tools/probe-loco-axes.gd` (fixed step, foot
print metric).

The sequence advances through walk, sprint, strafe L, strafe R, diagonal, back,
crouch fwd and crouch lateral: two seconds per segment. Start with sparse semantic
coverage, then densify only the suspicious boundary. Around a transition at frame
N, a useful local set is N-1, N, N+1, N+3, N+6 (plus a later settle when needed).
If the overlay exposes a blend weight, sample several points across that blend.
Do not increase frame density across the whole run to inspect one transition.

Build sheets with the project helper, preserving the same indices in each view:

```bash
tools/bf qa sheet --out=/tmp/bf-before-side-turn.png --cols=3 --cell=480x270 \
  /tmp/bf-before-side/frame_0119.png /tmp/bf-before-side/frame_0120.png \
  /tmp/bf-before-side/frame_0121.png /tmp/bf-before-side/frame_0123.png \
  /tmp/bf-before-side/frame_0126.png /tmp/bf-before-side/frame_0132.png

tools/bf qa sheet --out=/tmp/bf-before-back-turn.png --cols=3 --cell=480x270 \
  /tmp/bf-before-back/frame_0119.png /tmp/bf-before-back/frame_0120.png \
  /tmp/bf-before-back/frame_0121.png /tmp/bf-before-back/frame_0123.png \
  /tmp/bf-before-back/frame_0126.png /tmp/bf-before-back/frame_0132.png
```

Read both sheets in the same inference and compare aligned tiles. Open individual
PNGs only when thumbnails hide a hand/foot detail. Save the after in separate
directories and compare the same frames, weapon, camera, speed and duration. If
you change the phase clock, record that difference: the same frame no longer means
the same cycle phase. Still clips do not prove continuity.

## Do not confuse lab and gameplay

`qa_motion.gd` uses the real visual, clips, mount and IK, but enables
`debug_manual_state`: it writes intent and speed directly. It does not test input
-> Player -> set_combat_state -> _read_motion_inputs. If the failure appears while
playing, walk that public path and test the affected contract; do not conclude
gameplay is fine because the lab looks fine.

Likewise, the lab and player camera answer different questions. Use the multiview
lab to localize pose/layer ownership. After a player-facing fix (weapon silhouette,
ADS/combat framing, camera-relative presentation, input-driven transition), add
one representative real player-camera capture if the lab cannot prove that
perspective. Do not run both routes as ritual duplicate evidence.

`--mode=sequence --view=back --duration=16` adds idle, start, stop, crouch/stand
and combat. Its diagonal crouch segment uses components 2.6/2.6: magnitude ~3.68
m/s even though the label says 2.6. Use locomotion mode to compare cardinal crouch
at 2.6; do not recalibrate clips from that label.

The camera follows the actor and the checkerboard exposes sliding. Perceived
smoothness on device, touch input and real FPS need their own run; fixed sampling
does not prove them.

## Choose the layer before editing

Use the aligned views to distinguish source motion from runtime presentation. If
feet/pelvis/torso remain coherent while only weapon, hands or an additive pose are
rigid or misaligned, inspect `operator_visual.gd` mount/IK/layer blending before
opening Blender or changing cadence. If the whole body path is wrong in isolation,
motion/clip ownership is plausible. This is a decision shortcut, not proof by
code: the visual evidence comes first.

## Change the owner and verify

If you fix blend/input, do not export clips. If you edit `.blend`, save and export
only the authorized clips with `tools/bf blender <Clip>`. Then resolve the real
Godot path with doctor and run that binary:

```bash
"$BLOCKFIRE_GODOT" --headless --editor --path . --import
```

This command assumes `BLOCKFIRE_GODOT` is defined with the path doctor showed.
Wait for it to finish and confirm it reimported the updated GLB without errors. If
it skips it due to cache, invalidate only that GLB's imported cache and repeat; do
not edit `.import` configs or delete all `.godot` out of habit.

Repeat the previous QA with `--out=/tmp/bf-after-*`. For locomotion/layers use
`tools/bf test`: it covers public sprint selection, crouch/ADS continuity, cardinal
foot slide, mount and IK. To investigate a specific failure there are
`tools/bf qa slide --speed=7 --sprint`, `tools/bf qa ik` and `tools/bf qa reload`.
Do not run all those tests if the suite already settled the question.

Cardinal tests do not certify diagonal sliding or every sharp reversal. Do not
change speeds to make the animation pass. Close with defect, change, watched
evidence, tests run, limits and SHA if there was a commit. Close the processes
started by the task; keep useful evidence.

## Stop and start: who owns the foot plant

A stop does not just need "a stop clip". Measured in this project, releasing the
stick failed in three things at once, each with its own owner:

1. The leg cycle kept spinning at full speed while the body braked: the planted
   foot drags against the ground at body speed. Owner: the phase clock (it shuts
   off with braking).
2. The walk faded to idle in 0.18 s with the foot planted: 2.5 m/s of skid. Owner:
   the low-speed exit of `_move_weight` (0.05 s).
3. The phase froze mid-stride: one foot planted and the other dangling, both
   still, which reads as a mannequin. Owner: the phase (settles on a contact).

Rule that came out of it: **an absorption clip does not reposition the feet**. The
first version of the braking clip took a step forward and dragged the plant 0.37 m
toward the neutral stance before the step disappeared - worse than the defect.
What decides where the plant is, is the locomotion cycle that is playing out; the
braking clip only drives center of mass, spine and arms, and that is why its mask
excludes the legs.

When measuring a stop, do not measure the transition window: there the plant
changes foot and any anchoring metric measures the change, not a defect. Measure
the settle (phase on a contact, foot planted, no residual jitter).

## Assets: a texture next to a GLB is not judged by grep

When cleaning up, `rifle.glb` loads its textures by **external** path
(`rifle_0.png` ...), even though the GLB embeds them: Godot's `.import` resolves
them on import and a delete "proven by grep" broke the showcase. The smoke test
caught it; the auditor did not. Rule: for binaries (`.glb`, `.bin`, `.ttf`,
`.blend`) you may claim nothing references them; for textures and audio you may
not - check by deleting a copy, reimporting and running `tools/bf test`. The
`tools/audit-repo.mjs` auditor applies that distinction and warns how many it does
not judge.

## Measure direction before touching the clock

```bash
"$BLOCKFIRE_GODOT" --path . --script res://tools/probe-loco-axes.gd -- --weapon=rifle --sweep
```

Fixed-step 60 Hz probe with the real visual: for each heading it prints the foot
plant print (how far the foot drifts from the point where it landed) and the drift
over the heading. Cardinal and diagonal must stay within a few centimeters; a
monotonic drift over ~0.1 m reveals a miscalibrated clock, not an ugly pose. It
serves for cardinals, diagonals, heading sweep, crouch and lateral reversal
(`reversal`), and `tools/probe-axis-pop.gd` separates pose jump from high cadence
at an axis crossing.

Causal rule that came out of it: the clock advances `speed / stride`, and in a
blend the stride is the projection of each clip's backward motion onto the heading
(`|axis.heading|` per clip). Averaging scalar magnitudes assumes every clip
advances along the heading, and in diagonal that shortens the step: the plant
drifted 0.142 m per plant (~2 m/s) with perfect cardinals. With projection,
0.002 m. If the symptom appears only in diagonals, suspect the clock before the
clip; the lab with `debug_manual_state` reproduces that case without input.
