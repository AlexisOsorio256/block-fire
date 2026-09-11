# Player feel audit — 2026-09-11

Current implementation: camera, analog/directional response, runtime braking
and FOV-punch composition are closed. Upper-body aim/mount/IK remains a measured
visual iteration; the tested candidate was NOT shipped. Earlier findings below
record the before-state; implementation follow-ups contain current evidence.

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

### What DeepSeek still owns

1. `operator_body.gd` + `operator_visual.gd`: solve chest/mount pitch together
   with reachable weapon grips. Use `probe-aim-coordination.gd --aim --baseline`
   as the starting measurements, then promote the diagnostic to assertions
   only after barrel error <2°, reachable grip error <5 mm and no elbow flips
   pass for all four weapons through movement/reload/fire. Inspect front/side
   captures at ±45° and extreme pitch before accepting a candidate. Do not
   alter locomotion clips or stretch arm bones to conceal reach limits.
2. Physical thumb/device iteration: validate the 0.12 radial deadzone, sprint
   hysteresis, simultaneous fire/ADS and response latency. Desktop scheduled
   render samples and adb taps do not prove touch-to-photon latency.
3. Low-risk follow-up: existing QA shutdown resource warnings, with gameplay
   and animation contracts unchanged.

Keep the now-enforced analog/vector/brake/FOV gates green, along with the
tightened foot-slide limits. No pending implementation remains for analog
response, sprint arbitration, public brake triggering or FOV composition.

Final verification: `tools/bf test` exited 0: smoke 310, regressions 29,
animation_layers, player-feel, public brake and FOV gates passed. Regression
fixture `_test_ffa_spawn_ignores_corpses` still logs an out-of-tree transform
error at tests/regressions.gd:66; assertions pass, but stderr is not clean.
Final Android debug export exited 0. This follow-up did not install or inspect
the final APK on the phone; physical comfort/latency claims remain unverified.
