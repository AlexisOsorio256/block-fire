# Player feel audit — 2026-09-11

Current implementation: camera, analog/directional response, runtime braking,
FOV-punch composition AND vertical chest/weapon/IK coordination are implemented.
The first aim candidates were rejected; the shared world-space chest/mount
rotation below supersedes them. Remaining work is visual/device polish, scope
presentation and chest-assist tuning; do not restart the completed runtime work.

Scope: BLOCKFIRE's own mobile TPS character, not another game's assets or motion.
No asset, clip, stride metadata, gameplay speed or animation ownership changed.

## Highest-impact findings

1. **VERIFIED / fixed: camera orbit and collision used inconsistent frame state.**
   `Player._update_look` compensated the parent rotation, then body turning
   changed that parent again. A rightward start with no look input displaced
   camera heading by 33° / 16.5° / 8.25° at 30 / 60 / 120 Hz. Collision ran
   before look and movement and interpolated through its collision limit.
   In a real physics-world fixture, a 90° pan left camera x=3.25 behind a wall
   whose near face was x=1.4. The final implementation restores the world orbit
   after movement and clamps the interpolated arm against world collision.
   Heading error is now <0.001°; camera x=1.0555. Persistent wall and smooth
   release checks pass. This removes unintended steering/aim motion and the
   reproduced cover penetration. Near-plane corner clearance is still a ray,
   not a volume sweep; the fix does not prove every corner safe.

2. **VERIFIED / fixed in follow-up: movement lost analog control and depended on heading.**
   The real `Player._camera_relative_direction` returns magnitude 1 for joystick
   magnitudes 0.05, 0.25, 0.5 and 1.0. Partial thumb deflection therefore cannot
   choose a slower walk. Separate x/z acceleration gives cardinal walk start
   and stop 9 ticks (150 ms), diagonal 7 ticks (116.7 ms), at 60 Hz.
   `MobileControls.is_sprinting` switches at magnitude 0.92 without hysteresis;
   sprint can coexist with ADS/fire. These last two are verified code paths,
   not measured device jitter or a mandate to change combat speed.
   **INFERENCE:** loss of precision and inconsistent direction response are
   larger feel limitations than more locomotion assets. Appropriate deadzone,
   sprint rules and response timings require thumb testing.

3. **VERIFIED / fixed in follow-up: runtime braking was disconnected from its lab proof.**
   Public Player→OperatorVisual stops produced zero `motion.braking` frames.
   `OperatorVisual._process` passes locomotion speed as the third argument to
   `OperatorBody.read_motion_inputs`; that method compares speed loss against
   `6 * speed`, although a deceleration threshold requires elapsed seconds.
   It also sets braking true without a corresponding false assignment.
   `tests/animation_layers.gd` directly sets braking; its passing brake test
   proves the layer, not this runtime trigger. Fixing the trigger blindly is
   unsafe: `OperatorMotion.evaluate` multiplies phase advance by
   `(1 - _brake_weight)`, potentially reintroducing sliding while still moving.
   **INFERENCE:** missing weight absorption weakens stop readability. The
   reversal probe also reports 0.121 m/frame pop and 0.370 m support footprint;
   this includes a changing support/transition and is NOT a steady-foot-slide
   failure or permission to alter stride calibration.

Additional coordination issues, verified by source inspection only:
`OperatorBody.update_head_look` applies pitch to the head, while
`OperatorVisual._update_weapon_mount` derives barrel basis from the model with
reload/switch/recoil rotations but no aim pitch. Raised/lowered aim therefore
needs a pitch/IK capture before claiming the weapon tracks the reticle.
`CameraFX` adds/subtracts FOV punch in render processing while Player lerps the
same FOV in physics; its claimed noninterference needs a firing-rate test.
Permanent recoil applied to `look_pitch` is not automatically a bug: define
recovery policy before changing it. Do not duplicate weapon cadence or aim.

## Implementation and reproduction

Owner changed: `game/player/player.gd` only. Physics order is now input/look →
velocity/body turn → move_and_slide → world orbit/collision. Early returns for
inactive/disabled/dead actors also update the camera. Collision checks the full
arm for a stable target, then the smoothed candidate for immediate obstruction
clearance. CameraFX still owns shake; no new manager or gameplay state.

`tools/probe-player-feel.gd` drives actual Player physics callbacks at fixed
steps with a real physics-world wall and MobileControls. It disables automatic
callbacks for determinism; it does NOT measure input-to-photon latency or actual
30/120 Hz rendering. `--baseline` prints failures without a nonzero exit, solely
for before/after diagnosis; the normal invocation is included in `tools/bf test`.
Analog/brake observations are diagnostics, not assertions endorsing defects.

Commands (use the Godot binary found by `tools/bf doctor`):

- `tools/bf test`
- `godot --headless --path . --script res://tools/qa_touch.gd`
- `godot --headless --path . --script res://tools/probe-loco-axes.gd -- --sweep`
- `godot --headless --path . --script res://tools/probe-refactor-oracle.gd`

## DeepSeek work order

| Order / owner and exact files | Work | Measurable acceptance / protect |
|---|---|---|
| CLOSED — Player: `game/player/player.gd`; MobileControls: `game/ui/mobile_controls.gd`; test: `tools/probe-player-feel.gd` | Preserve joystick magnitude through camera-relative mapping; apply a documented radial deadzone/remap in the input owner. Use vector acceleration, not per-axis rates. Decide sprint/ADS/fire arbitration in Player; keep the touch button a request. | At 25/50/75% post-deadzone input, requested speed is 25/50/75% of the selected speed (±1%). Full input stays 4.8/7.0/2.6 m/s. Cardinal/diagonal start/stop/reversal times differ by ≤1 physics tick. Record 90°/180° changes, overshoot and braking distance at 30/60/120 Hz; do not invent a faster speed to hide latency. No sprint threshold flicker during a ±0.02 input sweep; verify intended latch and ADS policy. |
| CLOSED — OperatorBody: `game/characters/operator_body.gd`; director: `game/characters/operator_visual.gd`; layer: `game/characters/operator_motion.gd`; tests: `tests/animation_layers.gd`, `tools/probe-player-feel.gd` | Repair brake input's units and release lifecycle; use planar real velocity. Test the public path first. Then evaluate phase suppression while braking before enabling the layer. | Deceleration above the chosen threshold activates within one visual sample; constant speed, acceleration and vertical-only motion do not trigger. Release returns weight to zero within the declared fade. Public stop/resume/reversal at 30/60/120 Hz must keep foot baselines below; test different render/physics ratios. No root motion or velocity writes from animation. |
| 3 — OperatorBody/OperatorVisual; `game/characters/operator_body.gd`, `game/characters/operator_visual.gd`; camera feedback: `game/fx/camera_fx.gd`; `game/player/player.gd` | Capture four weapons at aim pitch −45/0/+45°, strafe, sprint→ADS, reload and firing. Coordinate upper-body pitch, weapon mounting and IK in existing frame order. Separately measure FOV composition/recoil before fixing it. | Settled barrel follows intended aim within 2° outside authored recoil; support grip ≤5 mm where reachable, no elbow flip. Shot feedback only on confirmed shots; empty/reload/switch do not kick. After recoil finishes, hip/ADS FOV returns within 0.1° of 68/52 with no undershoot caused by punch subtraction, at 30/60/120 render rates. Preserve cadence, ammo and reload timers. |
| 4 — Physical Android verification, same owners | Hold movement + drag look + fire, toggle ADS, reverse at cover, pause/resume. Record and watch video on the supported phone; use high-speed external capture for latency. | Record median/p95 touch-to-camera and touch-to-motion latency plus frame-time p95; proposed target ≤2 displayed frames for visible first response, to validate against device capability. No stuck pointers, unrequested aim motion, cover flashes or sprint chatter. Scripted adb swipes cannot establish thumb comfort or multitouch latency. |

## Numbers that must stay green

- Camera fixture: world orbit error <0.001° at 30/60/120 fixed-step Hz;
  immediate wall clearance, stable obstruction and smooth release.
- Gameplay speeds 4.8 / 7.0 / 2.6 m/s; animation reads real velocity and never
  displaces Player/Bot. One clip clock and generated stride metadata unchanged.
- Remeasured pose signature **1044286260**, unchanged. Future intentional pose
  work may change it, but must explain why; this camera patch must not.
  Current valid signature after aim/mount work: **`1135775949`** (was
  `3900121176`).
- Steady slide baseline walk/sprint/left/right ≈0.01 / 0.13 / 0.01 / 0.005 m/s.
  Existing test ceilings are looser (0.40 / 1.20 / 0.55 / 0.55); do not mistake
  merely passing those ceilings for preserving current quality.
- Support footprint: cardinals ≈0.000 m, diagonal 0.078 m, 30° oblique 0.065 m,
  crouch diagonal 0.051 m; heading-axis drift ≤0.028 m. Allow only rounding
  tolerance (0.002 m) before investigating. Existing diagonal test <0.12 m.
- Rifle support socket ≈0 mm, barrel alignment 1.0 in the existing strafe
  fixture. Axis-crossing pop test <0.16 m/frame. Manual brake settling remains
  phase 0, lowest foot ≈0.023 m, pose jitter ≈0.

## Evidence from this run

**VERIFIED:** Godot 4.7.2 headless: smoke 310, regressions 29,
animation_layers and all six camera checks PASS. Axis sweep and oracle rerun
match the baselines above. `qa_touch.gd` reports PASS / zero failures; its exit
also reports 50 ObjectDB instances and 8 resources still in use, so this is not
a clean resource-lifecycle result. Android debug export and installation PASS.
On connected Samsung SM-S901E, screenshots were inspected showing the new build's
lobby and live FFA character rendering (`captures/player-feel-audit/`). The app
was force-stopped afterward.

**ANDROID SIN VERIFICAR:** attempted scripted pan was confounded by bot death
in the inspected capture. It proves neither a camera response improvement nor
latency. Hands-on thumb comfort, simultaneous touch/fire/ADS, sustained frame
pacing and corner stress testing remain unverified. No claim of commercial-game
parity is supported by these tests; the ranking of remaining feel work is an
engineering inference from the measured defects.

## Analog/directional implementation follow-up

Closed in Player + MobileControls. Raw joystick travel has a 0.12 radial
deadzone and linear remap of the remaining 0.88; visual knob remains raw.
Auto-sprint enters at 0.96 and exits at 0.88 raw travel. Button sprint is still
a request. Crouch takes priority, then ADS/fire walk, then sprint. Releasing
combat resumes a held sprint request. Speeds remain 4.8/7.0/2.6. Horizontal
acceleration is a single Vector2 budget at 32 m/s², including disabled stopping.

Player-feel now asserts the roadmap's analog magnitude/speed, pitch invariance,
hysteresis, same-tick arbitration, vector acceleration, no speed overshoot and
direction-independent timing. Timing/displacement cases run real engine physics
callbacks: calling `_physics_process(dt)` manually does not change Godot's
internal move_and_slide timestep. A regression also checks distance against the
actual tick duration to prevent misleading 30/120 Hz displacement measurements.

VERIFIED output (cardinal and diagonal counts equal in every case):

```text
ANALOG walk input=0.25 speed=1.2000 expected=1.2000
ANALOG walk input=0.50 speed=2.4000 expected=2.4000
ANALOG walk input=0.75 speed=3.6000 expected=3.6000
ANALOG walk input=1.00 speed=4.8000 expected=4.8000
ANALOG sprint input=0.25 speed=1.7500 expected=1.7500
ANALOG sprint input=0.50 speed=3.5000 expected=3.5000
ANALOG sprint input=0.75 speed=5.2500 expected=5.2500
ANALOG sprint input=1.00 speed=7.0000 expected=7.0000
ANALOG crouch input=0.25 speed=0.6500 expected=0.6500
ANALOG crouch input=0.50 speed=1.3000 expected=1.3000
ANALOG crouch input=0.75 speed=1.9500 expected=1.9500
ANALOG crouch input=1.00 speed=2.6000 expected=2.6000
RESPONSE hz=30 heading=0 action=start ticks=5 ms=166.667 distance=0.515556 overshoot=0.000000
RESPONSE hz=30 heading=0 action=stop ticks=5 ms=166.667 distance=0.284445 overshoot=0.000000
RESPONSE hz=30 heading=0 action=resume ticks=5 ms=166.667 distance=0.515556 overshoot=0.000000
RESPONSE hz=30 heading=0 action=turn90 ticks=7 ms=233.333 distance=0.929438 overshoot=0.000000
RESPONSE hz=30 heading=0 action=reverse ticks=9 ms=300.000 distance=0.728889 overshoot=0.000000
RESPONSE hz=60 heading=0 action=start ticks=9 ms=150.000 distance=0.400000 overshoot=0.000000
RESPONSE hz=60 heading=0 action=stop ticks=9 ms=150.000 distance=0.320000 overshoot=0.000000
RESPONSE hz=60 heading=0 action=resume ticks=9 ms=150.000 distance=0.400000 overshoot=0.000000
RESPONSE hz=60 heading=0 action=turn90 ticks=13 ms=216.667 distance=0.848607 overshoot=0.000000
RESPONSE hz=60 heading=0 action=reverse ticks=18 ms=300.000 distance=0.720000 overshoot=0.000000
RESPONSE hz=120 heading=0 action=start ticks=18 ms=150.000 distance=0.380000 overshoot=0.000000
RESPONSE hz=120 heading=0 action=stop ticks=18 ms=150.000 distance=0.340000 overshoot=0.000000
RESPONSE hz=120 heading=0 action=resume ticks=18 ms=150.000 distance=0.380000 overshoot=0.000000
RESPONSE hz=120 heading=0 action=turn90 ticks=26 ms=216.667 distance=0.848245 overshoot=0.000000
RESPONSE hz=120 heading=0 action=reverse ticks=36 ms=300.000 distance=0.720000 overshoot=0.000000
```

Suite: smoke 310, regressions 29, animation_layers PASS; updated real-tick
player-feel PASS. Touch QA PASS / zero failures (resource cleanup warnings
remain). Thumb comfort of the new deadzone is not established by headless QA.

The rate-transition test now drains queued old-rate ticks before measurement.
The corrected real-callback probe exited 0 with no failed assertions.

## Runtime braking implementation follow-up

Closed in OperatorBody/Visual/Motion. Removed the speed-as-time argument.
Planar deceleration >6 m/s² activates the reaction; physics-frame sampling
prevents multiple renders of one velocity from clearing it prematurely.
Steady/accelerating/airborne motion clears intent; respawn resets history.
The brake mask excludes foot ancestors (Hips/Body/Root) and no longer suppresses
locomotion phase. Rest phase now settles to zero from either half of the cycle.
No clips, generated speeds, gameplay displacement or weapon timers changed.

`tools/probe-player-brake.gd` is in `tools/bf test`. It runs public movement on
a real floor, validates per-snapshot activation/release and vertical-only
rejection, and compares both foot transforms and phase to a no-brake reference
with identical locomotion inputs. Mixed render rates are scheduled visual
samples, not device performance measurements. Verified output:

```text
BRAKE_INVARIANT physics=30 render=30 added_foot_delta=0.000000000 phase_delta=0.000000000 peak_weight=1.000000
BRAKE_INVARIANT physics=60 render=60 added_foot_delta=0.000000000 phase_delta=0.000000000 peak_weight=0.937500
BRAKE_INVARIANT physics=120 render=120 added_foot_delta=0.000000000 phase_delta=0.000000000 peak_weight=0.937500
BRAKE_INVARIANT physics=30 render=120 added_foot_delta=0.000000000 phase_delta=0.000000000 peak_weight=1.000000
BRAKE_INVARIANT physics=120 render=30 added_foot_delta=0.000000000 phase_delta=0.000000000 peak_weight=1.000000
PLAYER_BRAKE: PASS failures=0
```

FOOT_SLIDE walk=0.01 (f156) sprint=0.13 (f42) strafe=0.01 (f152) m/s (peor fotograma de aterrizaje)
BRAKE weight=1.00 released=0.00 fase_asentada=0.000 pie_bajo=0.023 jitter=0.0037
DIAGONAL_FOOTPRINT diagonal=0.078 m oblicuo=0.065 m (huella del apoyo a 4.8)
STRAFE_GRIP socket_mm=0.000 barrel_alignment=1.000000 right_slide=0.005 m/s
ANIMATION_LAYERS: PASS failures=0

Steady-slide ceilings tightened to 0.02/0.14/0.02/0.007 m/s and diagonal
footprint to 0.080 m. Axis sweep remains ≤0.028 m drift; reversal diagnostic
remains 0.121 m/frame / 0.370 m footprint. The manual held-brake pose now has
0.0037 m idle jitter (previously 0.0000): removing the hip/root override exposes
authored idle motion. This is below the unchanged 0.02 m settling contract; it
is not hidden or represented as an identical pose. Public brake adds exactly
zero foot or phase displacement relative to the unbraked pose.

The pose oracle intentionally changes: it exercises the formerly broken
trigger and the corrected idle settling. It is not an unchanged refactor.
Reload-hand probe PASS; it still emits resource cleanup warnings. Rendered
sequence QA inspected for character/weapon continuity.

Measured post-brake oracle: `1863296244` (old camera-only `1044286260`).

## FOV composition closed; aim candidate rejected

Player now excludes `CameraFX.applied_fov_punch()` from base-FOV smoothing and
re-adds it. CameraFX retains the existing additive-effect bookkeeping: no new
FOV state, manager, cadence or recoil policy. `tools/probe-aim-coordination.gd`
is in the default test gate, checking hip/ADS recovery at 30/60/120 render rates
against Player's actual physics FOV update. Before/after command output:

```text
FOV ads=false render=30 minimum=67.186882 target=68.0 final_error=0.000015
FOV ads=false render=60 minimum=67.020699 target=68.0 final_error=0.000015
FOV ads=false render=120 minimum=67.020699 target=68.0 final_error=0.000015
FOV ads=true render=30 minimum=51.186878 target=52.0 final_error=0.000008
FOV ads=true render=60 minimum=51.020691 target=52.0 final_error=0.000008
FOV ads=true render=120 minimum=51.020691 target=52.0 final_error=0.000008
FOV ads=false render=30 minimum=68.000000 target=68.0 final_error=0.000000
FOV ads=false render=60 minimum=68.000000 target=68.0 final_error=0.000000
FOV ads=false render=120 minimum=68.000000 target=68.0 final_error=0.000000
FOV ads=true render=30 minimum=52.000000 target=52.0 final_error=0.000000
FOV ads=true render=60 minimum=52.000000 target=52.0 final_error=0.000000
FOV ads=true render=120 minimum=52.000000 target=52.0 final_error=0.000000
```

The optional `--aim --baseline` diagnostic now measures grounded Player poses,
actual wrist targets (not the fist mesh placed directly at its goal), strafe,
sprint→ADS, reload and a confirmed shot. It exposes existing unreachable grips:

```text
AIM weapon=rifle pitch=-45 error_deg=44.999996 socket_mm=6.853417
AIM weapon=rifle pitch=0 error_deg=0.000000 socket_mm=7.643435
AIM weapon=rifle pitch=45 error_deg=44.999996 socket_mm=7.669152
AIM_TRANSITION weapon=rifle state=reload max_grip_mm=11.671482 elbow_step_deg=3.047225
AIM_TRANSITION weapon=pistol state=reload max_grip_mm=2.481977 elbow_step_deg=2.643824
AIM weapon=shotgun pitch=-45 error_deg=44.999996 socket_mm=32.227248
AIM weapon=shotgun pitch=0 error_deg=0.000000 socket_mm=31.669054
AIM weapon=shotgun pitch=45 error_deg=44.999996 socket_mm=32.056596
AIM_TRANSITION weapon=shotgun state=reload max_grip_mm=44.084974 elbow_step_deg=3.410706
AIM_TRANSITION weapon=smg state=reload max_grip_mm=33.480547 elbow_step_deg=2.801140
```

Candidate chest/mount pitch aligned all four barrels (0.000000° at −45/0/+45),
but the half-chest rotation increased the rifle's down-aim wrist gap to
29.339433 mm and shotgun's to 55.368405 mm. A full-chest variant reduced this
to 7.095776 / 32.502919 mm but did not close the existing grip/contact defects.
Both candidates were reverted; only the verified FOV correction ships. This
is genuine required visual/IK iteration, not a completed aim feature.

## Shared chest/weapon aim implemented (supersedes rejected candidates)

`OperatorBody.update_head_look` rotates the chest in world space around its
existing origin and publishes the same model-space `aim_basis` to
`OperatorVisual._update_weapon_mount`. Local bone axes were the earlier error:
the animated parent was already tilted, so the chest and gun rotated around
different axes. The corrected operation preserves shoulder-to-grip reach.
The head consumes residual look so it does not pitch twice. The existing
`OperatorMotion.aim_weight` blends entry/exit; reload/switch retain their layers.
No new animation clock, manager, root motion or gameplay aim source exists.

Weapon mounts were measured too far forward for the rig. Ready/ADS forward
offsets now: rifle 0.07/0.14 m, shotgun 0.13/0.19 m, SMG 0.14/0.24 m; pistol
unchanged. Reload lowers the gun 0.08 m instead of 0.13 m, keeping the authored
hand path reachable. No source clip or generated hand path was edited.

### VERIFIED evidence

`tools/probe-aim-coordination.gd` now runs aim AND FOV assertions by default.
Its public Player ticks run in actual physics callbacks with measured 1/60 s
steps; accelerated test wall time is not a latency or device-FPS measurement.
Calling move_and_slide outside physics had used render delta and let the old
capture fixture walk off its floor. The repaired fixture asserts groundedness
and tick duration. `--capture` adds inspected desktop pose views.

```text
AIM weapon=rifle pitch=-78 error_deg=0.000000 socket_mm=0.000269 position=(0.0, -0.099759, 0.0) grounded=true
AIM weapon=rifle pitch=-45 error_deg=0.000000 socket_mm=0.000138 position=(0.0, -0.099759, 0.0) grounded=true
AIM weapon=rifle pitch=0 error_deg=0.000000 socket_mm=0.000060 position=(0.0, -0.099759, 0.0) grounded=true
AIM weapon=rifle pitch=45 error_deg=0.000000 socket_mm=0.000111 position=(0.0, -0.099759, 0.0) grounded=true
AIM weapon=rifle pitch=78 error_deg=0.000000 socket_mm=0.000192 position=(0.0, -0.099759, 0.0) grounded=true
AIM_TRANSITION weapon=rifle state=strafe max_grip_mm=0.000968 elbow_step_deg=1.455084
AIM_TRANSITION weapon=rifle state=sprint_ads max_grip_mm=0.001922 elbow_step_deg=8.613062
AIM_TRANSITION weapon=rifle state=crouch max_grip_mm=0.002185 elbow_step_deg=0.807698
AIM_TRANSITION weapon=rifle state=reload max_grip_mm=0.002146 elbow_step_deg=8.074237
AIM_TRANSITION weapon=rifle state=shot max_grip_mm=0.002214 elbow_step_deg=6.295755
AIM weapon=pistol pitch=-78 error_deg=0.000000 socket_mm=0.000119 position=(22.36067, -0.099759, -15.0576) grounded=true
AIM weapon=pistol pitch=-45 error_deg=0.000000 socket_mm=0.001125 position=(22.36067, -0.099759, -15.0576) grounded=true
AIM weapon=pistol pitch=0 error_deg=0.000000 socket_mm=0.000119 position=(22.36067, -0.099759, -15.0576) grounded=true
AIM weapon=pistol pitch=45 error_deg=0.000000 socket_mm=0.000358 position=(22.36067, -0.099759, -15.0576) grounded=true
AIM weapon=pistol pitch=78 error_deg=0.000000 socket_mm=0.000961 position=(22.36067, -0.099759, -15.0576) grounded=true
AIM_TRANSITION weapon=pistol state=strafe max_grip_mm=0.003939 elbow_step_deg=0.953471
AIM_TRANSITION weapon=pistol state=sprint_ads max_grip_mm=0.004428 elbow_step_deg=3.952898
AIM_TRANSITION weapon=pistol state=crouch max_grip_mm=0.004580 elbow_step_deg=0.855923
AIM_TRANSITION weapon=pistol state=reload max_grip_mm=0.004370 elbow_step_deg=4.498408
AIM_TRANSITION weapon=pistol state=shot max_grip_mm=0.004625 elbow_step_deg=7.073572
AIM weapon=shotgun pitch=-78 error_deg=0.000000 socket_mm=0.000358 position=(44.72177, -0.099759, -30.1152) grounded=true
AIM weapon=shotgun pitch=-45 error_deg=0.000000 socket_mm=0.001911 position=(44.72177, -0.099759, -30.1152) grounded=true
AIM weapon=shotgun pitch=0 error_deg=0.000000 socket_mm=0.000119 position=(44.72177, -0.099759, -30.1152) grounded=true
AIM weapon=shotgun pitch=45 error_deg=0.000000 socket_mm=0.001073 position=(44.72177, -0.099759, -30.1152) grounded=true
AIM weapon=shotgun pitch=78 error_deg=0.000000 socket_mm=0.000358 position=(44.72177, -0.099759, -30.1152) grounded=true
AIM_TRANSITION weapon=shotgun state=strafe max_grip_mm=0.004498 elbow_step_deg=1.124658
AIM_TRANSITION weapon=shotgun state=sprint_ads max_grip_mm=0.005525 elbow_step_deg=7.510317
AIM_TRANSITION weapon=shotgun state=crouch max_grip_mm=0.008630 elbow_step_deg=0.575053
AIM_TRANSITION weapon=shotgun state=reload max_grip_mm=0.008597 elbow_step_deg=8.268046
AIM_TRANSITION weapon=shotgun state=shot max_grip_mm=0.008613 elbow_step_deg=6.942011
AIM weapon=smg pitch=-78 error_deg=0.000000 socket_mm=0.000715 position=(67.0831, -0.099759, -45.17308) grounded=true
AIM weapon=smg pitch=-45 error_deg=0.000000 socket_mm=0.001788 position=(67.0831, -0.099759, -45.17308) grounded=true
AIM weapon=smg pitch=0 error_deg=0.000000 socket_mm=0.000000 position=(67.0831, -0.099759, -45.17308) grounded=true
AIM weapon=smg pitch=45 error_deg=0.000000 socket_mm=0.003997 position=(67.0831, -0.099759, -45.17308) grounded=true
AIM weapon=smg pitch=78 error_deg=0.000000 socket_mm=0.000358 position=(67.0831, -0.099759, -45.17308) grounded=true
AIM_TRANSITION weapon=smg state=strafe max_grip_mm=0.008571 elbow_step_deg=0.968336
AIM_TRANSITION weapon=smg state=sprint_ads max_grip_mm=0.008857 elbow_step_deg=5.987102
AIM_TRANSITION weapon=smg state=crouch max_grip_mm=0.008649 elbow_step_deg=0.777329
AIM_TRANSITION weapon=smg state=reload max_grip_mm=0.008649 elbow_step_deg=6.868899
AIM_TRANSITION weapon=smg state=shot max_grip_mm=0.009204 elbow_step_deg=2.984391
AIM_COORDINATION: failures=0
```

20 stationary weapon/pitch cases (4 weapons × −78/−45/0/+45/+78°): maximum
barrel error 0.000000°. Across strafe, sprint→ADS, crouch, reload and confirmed
shot: maximum wrist error 0.009204 mm, maximum per-sample elbow-plane change
8.613062°. Assertions enforce <2°, <5 mm and no >90° elbow flip. The aim layer
also asserts that both feet match the pre-aim clip pose within 0.000001 m.

Full suite: smoke 310, regressions 29, animation_layers, public movement/brake
and aim/FOV gates PASS. The added crouch coverage separately passed. Foot-slide
still 0.01/0.13/0.01/0.005 m/s, diagonal 0.078 m, oblique 0.065 m, rifle socket
0.000 mm / barrel alignment 1.000000. Reload-hand probe PASS: rifle drop 0.266 m,
travel 0.290 m; pistol drop 0.157 m, travel 0.187 m. Cleanup warnings in that QA
remain unaddressed.

The pose oracle now defers node construction until the tree is active, fixing
its out-of-tree transform errors. Its valid current signature is 3900121176.
Historical init-time signatures are not a reliable direct comparison to the
repaired fixture; mounts/aim/settling are also intentional pose changes. Use
this valid signature for future no-behavior-change refactors.

Desktop rendered pose captures were inspected for rifle, shotgun and SMG at
up/down aim. The final Android APK exported and installed on the SM-S901E;
lobby and live ADS capture were inspected (`captures/aim-coordination/`). This
verifies device launch and a displayed ADS pose, not latency or subjective feel.
The test app and adb daemon started for this task were stopped.

### What DeepSeek still owns

1. **Animation polish:** inspect running→aim, lateral reversals, stop/resume and
   extreme upper-body pitch on device; tune presentation only where visible
   evidence warrants it. The runtime aim/IK connection is implemented—do not
   replace it or reintroduce hip/root edits that move feet. Existing authored
   arm/hand silhouettes can be polished with all numerical gates intact.
2. **Chest assist and head dragging:** tune existing Player assist toward the
   visible torso; preserve deliberate upward drag to the head. Stronger assist
   is a pending product tuning request, not an implemented change here. Keep
   cone/line-of-sight and no-auto-fire contracts.
3. **ADS sight presentation:** the current shoulder zoom is implemented; an
   explicit weapon-appropriate scope/sight presentation is pending. Keep the
   camera aim and weapon gameplay owners; do not hide an aim mismatch in HUD.
4. **Physical feel:** quantify touch latency, thumb comfort, simultaneous
   move/fire/ADS and frame pacing. Screenshots and offline physics probes do
   not establish commercial-game parity.

Start with existing code/tests, not another broad audit. Commit each verified
polish. Preserve speeds 4.8/7.0/2.6 and all foot/phase/FOV gates above.

## Shot line, chest assist and weapon mount closed

Three measured defects were reproduced, fixed and verified in this order.

**1. The shot did not land where the reticle points.** The muzzle ray started at
the real barrel but converged on a point at full range, so the measured 0.77 m
muzzle-to-camera axis offset became the miss distance at every normal range:
a target whose chest or head was under the reticle took 0/8 hits at
3.5/10/25 m, and headshots were impossible. The muzzle now fires at the first
obstacle the aim ray covers and still traces the whole segment from the barrel,
so cover in front of the muzzle keeps blocking. `CONVERGENCE_BACKSTOP` (0.02 m)
keeps an impact that lands exactly on a surface inside the segment: without it,
1 of 3 shots found nothing.

**2. The chest assist blocked deliberate head aim.** The ADS/fire rotational
assist was a magnet: a sustained drag stalled 2.07 deg above the torso point
(head unreachable at every tested range) and the camera moved with the thumb at
rest (-0.87/-0.64/-0.57 deg in 1.5 s). It is now grip resistance on the
player's own drag (35% slower on the torso line, exactly zero with no thumb
input, none during a deliberate flick), and the direction assist no longer
bends a shot whose reticle already covers the target.

`tools/probe-aim-assist.gd` is in `tools/test.sh`: real BlockfireBot target,
real physics callbacks, real weapon path. Same probe before the fixes: 18
failures; after: 0.

```text
ASSIST_FREE drag_px=6 step_deg=0.7200 expected=0.7200
ASSIST_DRAG distance=3.5 window_deg=1.0000 fast_ticks=43 fast_error=0.2728 slow_ticks=126 slow_error=0.4916
ASSIST_REST distance=3.5 head_error_start=0.4916 head_error_end=0.4916 pitch_drift=0.0000 yaw_drift=0.0000
ASSIST_ADHESION distance=3.5 drag_px=6 torso_step_deg=0.3370 free_step_deg=0.5184 slowdown=0.3499
ASSIST_SHOT distance=3.5 aim=head shots=8 hits=8 heads=8 missed=0 muzzle_offset_m=0.7844
ASSIST_SHOT distance=3.5 aim=chest shots=8 hits=8 heads=0 missed=0
ASSIST_NEAR_MISS distance=3.5 miss_raw_deg=5.3072 miss_assisted_deg=1.7669 hits=8 heads=0
ASSIST_COVER distance=3.5 wall_at=1.8 shots=4 hits=0
ASSIST_DRAG distance=10.0 window_deg=0.9420 fast_ticks=15 fast_error=0.2962 slow_ticks=44 slow_error=0.3867
ASSIST_SHOT distance=10.0 aim=head shots=8 hits=8 heads=8 missed=0 muzzle_offset_m=0.7821
ASSIST_SHOT distance=10.0 aim=chest shots=8 hits=8 heads=0 missed=0
ASSIST_NEAR_MISS distance=10.0 miss_raw_deg=2.5464 miss_assisted_deg=0.8042 hits=8 heads=0
ASSIST_DRAG distance=25.0 window_deg=0.4197 fast_ticks=6 fast_error=0.1909 slow_ticks=18 slow_error=0.1718
ASSIST_SHOT distance=25.0 aim=head shots=8 hits=8 heads=8 missed=0 muzzle_offset_m=0.7814
ASSIST_SHOT distance=25.0 aim=chest shots=8 hits=8 heads=0 missed=0
ASSIST_NEAR_MISS distance=25.0 miss_raw_deg=1.1518 miss_assisted_deg=0.3538 hits=8 heads=0
ASSIST_COVER distance=25.0 wall_at=12.5 shots=4 hits=0
AIM_ASSIST: failures=0
```

Without the fixes the same probe reported: drag never reached the head
(fast_error 8.19/3.00/0.51 deg), rest drift -0.87/-0.64/-0.57 deg, and 8/8
missed shots on both head and chest aim at 3.5/10 m (6-7 of 8 at 25 m).

**3. Weapons were held by the wrong part and fired from inside the barrel.**
The mount transform was the only thing ever verified, and it was aligned while
the meshes were not: the pistol sat 8.2 cm from the hand that should hold it
(the character gripped the front of the frame, so the pistol read as held
backwards) and the SMG 4.9 cm. Pivots derived from the mesh (lowest rear vertex
cluster = grip) bring both to 0.010/0.017 m, the same order as rifle 0.016 and
shotgun 0.015. The muzzle marker, which is the tracer origin, the muzzle flash
and the hitscan origin, sat 0.10-0.23 m inside the barrel on all four weapons;
markers now sit 0.022-0.027 m inside the mesh crown.

```text
AUDIT rifle    z=[-0.228, 0.692] muzzle_cfg_z=0.670
AUDIT pistol   z=[-0.036, 0.234] muzzle_cfg_z=0.210 (was pivot (0,-0.06,0.07), tip 0.234 vs 0.13)
AUDIT shotgun  z=[-0.263, 0.787] muzzle_cfg_z=0.760
AUDIT smg      z=[-0.176, 0.444] muzzle_cfg_z=0.420
```

A fourth pass rendered each mounted weapon with the MOUNT's own axes drawn
(X red, Y green, Z blue, camera along -X so +Z is screen-right): that is what
settled orientation for good, because mount-basis checks and mass heuristics
both passed while the SMG's buttstock sat on the +Z side and its muzzle on -Z.
The MPX is now mounted with `asset_rot = (0, 180, 0)` and its muzzle marker
moved from the stock end to the real crown (0.15, mesh tip 0.176); rifle,
pistol and shotgun were re-checked the same way and are correct. When a render
already shows the defect, look at the render and fix it: proving it in numbers
first cost most of this session.

Barrel alignment (0.000000 deg at -78/-45/0/+45/+78 for four weapons), wrist
sockets (max 0.0055 mm), reload hand path (rifle 0.365/0.410 m, pistol
0.197/0.218 m) and foot invariants are unchanged. Pose oracle moves from
`3900121176` to **`1135775949`** because the weapon really is somewhere else
relative to the hand now: intentional, not a refactor.

## Tooling hygiene and the current reference numbers

Four tools quit with playbacks still live in the audio server and reported
"N ObjectDB instances were leaked" plus "resources still in use"
(qa_touch 52/8, probe-reload-hand 58/6, probe-aim-coordination 10-14/4-6);
`tools/probe_teardown.gd` pauses the tree, stops every AudioStreamPlayer(3D)
and lets the audio server drain before `quit()`. All four now exit clean, with
qa_touch PASS (0 fallos) and reload-hand PASS.

`probe-reload-hand` measured through real frame pacing, so the same pose moved
up to 0.03 m between runs. It now freezes automatic processing and advances
the layer with a fixed 1/60 s step while holding the sampled phase: rifle
0.364/0.409 m and pistol 0.197/0.218 m, identical across runs (24 settle steps,
verified equal to 90). The previous documented numbers (rifle 0.266/0.290,
pistol 0.157/0.187) came from the frame-paced fixture and are superseded.

`probe-aim-coordination` re-asserts the thumb state every tick: a windowed run
can receive focus-out, Player clears combat input there, and the fixture used
to lose the aim layer at negative pitch (2 failures, windowed only).

Probe fixtures are not the runtime. Known ways they lie, all hit this session:
audio playbacks left at exit, `CameraFX` shake rotating the camera between
ticks, focus-out clearing combat input, a dead bot silently dropping out of
assist target selection, an out-of-tree node ignoring `global_position`, and a
wall spawned inside the player pushing it away.

## Android on device (SM-S901E, R5CT403MXZJ)

Debug APK built, installed (incremental) and launched; FFA live on device with
HUD, health, ammo and touch controls; ADS toggles (zoom + centre reticle);
fire accepted; weapon switch accepted; logcat reported 0 Godot errors or
warnings over the session; the game was force-stopped afterwards and captures
were inspected (`captures/aim-assist/`). The rifle in the character's hands on
device reads right side up with the magazine below and the stock at the
shoulder.

**SIN VERIFICAR on device:** touch-to-camera latency, thumb comfort,
simultaneous move/look/fire/ADS, sustained frame pacing, and how the new drag
grip and head reachability feel to a real thumb. Scripted taps and swipes
cannot establish any of that.

## Still open

1. **ADS sight presentation.** The camera sits 0.78 m from the weapon axis by
   design: the barrel is parallel to the view axis, so the weapon projects to
   the screen centre (correct as seen) while the shot line is now the reticle.
   A true sight picture (weapon at eye level, optic/aperture presentation) is
   pose work on the aim layer plus a weapon-appropriate reticle; not done here.
2. **Visual transition inspection** (running→aim, lateral reversals, stop and
   resume) has numeric invariants only; no rendered sequence was judged.
3. **Bot lethality** after the convergence fix is symmetric and unmeasured:
   bots now land on their aim line instead of at the muzzle offset, so their
   close-range damage per shot went up. Candidate for a tuning pass.
