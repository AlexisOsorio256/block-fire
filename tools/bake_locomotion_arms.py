"""Bake credible rifle-hold arms into SprintFwd/StrafeLeft sources (background Blender).

Method (same principle as the reload craft: temporal IK + bake):
- Open each .blend source, keep legs/torso/head/feet exactly as generated
  (speeds, foot lock and loop continuity untouched).
- Add TEMPORAL IK (Blender IK constraints + target empties that follow the
  posed chest, poles static). Targets are defined in Blender armature space,
  in front of the chest, within arm reach: hands end on an invisible rifle.
- Bake ONLY UpperArm.L/R + LowerArm.L/R (rotation+location) per frame.
  Shoulder/Wrist are left as generated: runtime IK overwrites Upper/Lower
  fully, so the game behaviour is preserved; Shoulder/Wrist stay identical.
- Remove temporal rig, save source. Export is done separately via
  `tools/bf blender` (non-destructive export path).

Targets are relative to the PER-FRAME posed chest head (weapon stabilized to
the torso, like OperatorVisual's chest-mounted weapon):
  GRIP_R = chest + (-0.03, -0.26, +0.01)   (right hand, rear grip)
  FORE_L = chest + (+0.03, -0.40, +0.01)   (left hand, foregrip, 14 cm ahead)
Poles (static, from frame-0 shoulders):
  POLE_L = shoulderL0 + (+0.35, +0.25, -0.35)
  POLE_R = shoulderR0 + (-0.35, +0.25, -0.35)
(Blender space: X right, Y back (forward = -Y), Z up.)

Usage:
  blender --background --python tools/bake_locomotion_arms.py -- SprintFwd StrafeLeft
  blender --background --python tools/bake_locomotion_arms.py -- --verify-only SprintFwd
"""
import bpy
import math
import os
import sys
from mathutils import Vector

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SOURCE_DIR = os.path.join(ROOT, 'assets/animation_sources')

ARM_BONES = ['UpperArm.L', 'UpperArm.R', 'LowerArm.L', 'LowerArm.R']
GRIP_OFFSET_R = Vector((-0.03, -0.26, 0.01))
FORE_OFFSET_L = Vector((0.03, -0.40, 0.01))
POLE_OFFSET_L = Vector((0.35, 0.25, -0.35))
POLE_OFFSET_R = Vector((-0.35, 0.25, -0.35))


def chest_head_world(arm):
    pb = arm.pose.bones['Chest']
    return arm.matrix_world @ pb.head


def shoulder_head_world(arm, side):
    pb = arm.pose.bones['Shoulder.' + side]
    return arm.matrix_world @ pb.head


def bake_one(name):
    path = os.path.join(SOURCE_DIR, name + '.blend')
    bpy.ops.wm.open_mainfile(filepath=path)
    scene = bpy.context.scene
    arm = next(o for o in scene.objects if o.type == 'ARMATURE')
    act = bpy.data.actions.get(name)
    if act is None:
        raise ValueError(f'{name}: action {name} not found')
    arm.animation_data.action = act
    frame_start = int(scene.frame_start)
    frame_end = int(scene.frame_end)
    frames = list(range(frame_start, frame_end + 1))
    print(f'BAKE_ARMS {name} frames {frame_start}..{frame_end}', flush=True)

    # Static poles from frame-0 shoulders.
    scene.frame_set(frame_start)
    bpy.context.view_layer.update()
    pole_l_pos = shoulder_head_world(arm, 'L') + POLE_OFFSET_L
    pole_r_pos = shoulder_head_world(arm, 'R') + POLE_OFFSET_R

    def make_empty(nm, pos):
        e = bpy.data.objects.new(nm, None)
        scene.collection.objects.link(e)
        e.location = pos
        return e

    tgt_l = make_empty('IK_Fore_L', pole_l_pos)
    tgt_r = make_empty('IK_Grip_R', pole_r_pos)
    pole_l = make_empty('IK_Pole_L', pole_l_pos)
    pole_r = make_empty('IK_Pole_R', pole_r_pos)

    # Temporal IK on the two arms.
    cons = []
    for side, tgt, pole in (('L', tgt_l, pole_l), ('R', tgt_r, pole_r)):
        pb = arm.pose.bones['LowerArm.' + side]
        c = pb.constraints.new('IK')
        c.target = tgt
        c.pole_target = pole
        c.chain_count = 2
        # Elbows point down/out (poles are down/out/back of the shoulders).
        # Mirrored rest rolls need opposite pole angles, like the leg rig
        # (L needs PI, R needs 0) — verified by elbow height diagnostics.
        c.pole_angle = math.pi if side == 'L' else 0.0
        c.use_stretch = False
        cons.append((pb, c))

    # Pass 1: solve per frame, store armature-space matrices of the 4 bones.
    # Two sweeps: the first moves the solver from the old swing branch onto
    # the hold branch; only the second is recorded. Frame N is then forced to
    # frame 0 (same chest/target inputs, so identical solution): the gait
    # convention requires first==last for a pop-free loop.
    solved = {}
    for sweep in range(2):
        for f in frames:
            scene.frame_set(f)
            bpy.context.view_layer.update()
            chest = chest_head_world(arm)
            tgt_r.location = chest + GRIP_OFFSET_R
            tgt_l.location = chest + FORE_OFFSET_L
            bpy.context.view_layer.update()
            if sweep == 1:
                solved[f] = [arm.pose.bones[bn].matrix.copy() for bn in ARM_BONES]
            # Diagnostics: elbow height vs shoulder, wrist distance to target.
            if sweep == 1 and f in (frame_start, (frame_start + frame_end) // 2):
                el = arm.matrix_world @ arm.pose.bones['LowerArm.L'].head
                sh = shoulder_head_world(arm, 'L')
                print(f'  frame {f} chest={tuple(round(v,3) for v in chest)} '
                      f'elbowL_z-shL_z={el.z - sh.z:.3f} '
                      f'wristL-target={((arm.matrix_world @ arm.pose.bones["Wrist.L"].head) - tgt_l.location).length:.3f}',
                      flush=True)
    solved[frame_end] = [m.copy() for m in solved[frame_start]]

    # Remove temporal rig.
    for pb, c in cons:
        pb.constraints.remove(c)
    for e in (tgt_l, tgt_r, pole_l, pole_r):
        bpy.data.objects.remove(e, do_unlink=True)

    # Pass 2: replace ONLY the 4 arm bones' curves, preserve everything else.
    doomed = [fc for fc in act.fcurves
              if any(f'pose.bones["{bn}"]' in fc.data_path for bn in ARM_BONES)]
    for fc in doomed:
        act.fcurves.remove(fc)
    for f in frames:
        scene.frame_set(f)
        bpy.context.view_layer.update()
        # Bone by bone, parents before children (ARM_BONES lists Uppers
        # first): setting LowerArm.matrix converts through the parent's
        # CURRENT matrix, so the parent must be updated + keyed first.
        # Same pattern as make_anim_clips.build().
        for bn, matrix in zip(ARM_BONES, solved[f]):
            b = arm.pose.bones[bn]
            b.rotation_mode = 'QUATERNION'
            b.matrix = matrix
            bpy.context.view_layer.update()
            b.keyframe_insert('rotation_quaternion', frame=f)
            b.keyframe_insert('location', frame=f)
    for fc in act.fcurves:
        if any(f'pose.bones["{bn}"]' in fc.data_path for bn in ARM_BONES):
            for k in fc.keyframe_points:
                k.interpolation = 'LINEAR'
    # Loop closure check.
    scene.frame_set(frame_start)
    bpy.context.view_layer.update()
    first = [arm.pose.bones[bn].rotation_quaternion.copy() for bn in ARM_BONES]
    scene.frame_set(frame_end)
    bpy.context.view_layer.update()
    last = [arm.pose.bones[bn].rotation_quaternion.copy() for bn in ARM_BONES]
    # Loop closure check (quaternion double-cover: q == -q).
    gaps = []
    for a, b in zip(first, last):
        d1 = (a.w - b.w) ** 2 + (a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2
        d2 = (a.w + b.w) ** 2 + (a.x + b.x) ** 2 + (a.y + b.y) ** 2 + (a.z + b.z) ** 2
        gaps.append(math.sqrt(min(d1, d2)))
    print(f'BAKE_ARMS {name} done, arm loop gap max={max(gaps):.5f}', flush=True)
    scene.frame_set(frame_start)
    bpy.ops.wm.save_as_mainfile(filepath=path, compress=True)
    print(f'BAKE_ARMS {name} saved {path}', flush=True)


def main(argv):
    names = [a for a in argv if not a.startswith('--')]
    for name in names:
        if name not in ('SprintFwd', 'StrafeLeft'):
            raise ValueError(f'refusing {name}: this tool only bakes SprintFwd/StrafeLeft')
        bake_one(name)


if __name__ == '__main__':
    main(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
