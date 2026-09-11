"""Author, verify and export Quaternius motion in Blender 4.0 (CC0 rig, 22 bones).

AUTHORITY — read before editing an animation
-------------------------------------------
1. `assets/animation_sources/<Clip>.blend` is the ART SOURCE. Open it in Blender,
   move keys, save it, export. Hand edits survive because the exporter never
   regenerates a clip that already has a source.
2. This script is the GENERATOR (only with --rebuild) and the EXPORTER (default).
3. Declared ground speed lives in GAIT below and is written to
   `locomotion_speeds.json`. The runtime reads that file, so the clip's real
   speed and the playback calibration are one truth, never two.

    blender --background --python tools/make_anim_clips.py                # export all
    blender --background --python tools/make_anim_clips.py -- Reload Land  # export two
    blender --background --python tools/make_anim_clips.py -- --rebuild WalkFwd
    blender --background --python tools/make_anim_clips.py -- --verify WalkFwd

Foot contact trajectories drive two-bone IK, then glTF bakes evaluated poses.
Feet in this rig are children of Root, NOT LowerLeg: their translations are
required. Body carries weight shifts; actor Root never travels horizontally.
Reload uses independently timed chest/shoulder/head curves and a palm path.
The JSON palm path is shared with runtime IK; no disconnected replacement fist.
"""
import bpy
import json
import math
import os
import struct
import sys
from mathutils import Vector, Quaternion

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'assets/models/skins/operator_adult_lod.glb')
OUT_DIR = os.path.join(ROOT, 'assets/models/animation_library')
SOURCE_DIR = os.path.join(ROOT, 'assets/animation_sources')
FPS = 60
NAMES = ['WalkFwd', 'SprintFwd', 'StrafeLeft', 'StrafeRight', 'BackWalk',
         'CrouchIdle', 'CrouchWalk', 'CrouchLeft', 'CrouchRight', 'CrouchBack',
         'ReloadRifle', 'ReloadPistol', 'JumpStart', 'AirLoop', 'Land', 'Flinch',
         'Brake']
# Hand-authored sources. --rebuild REFUSES to touch these: regenerating them
# from the formulas below would silently destroy the interactive Blender craft.
# Use the default (export) mode instead, or pass --force-rebuild on purpose.
CRAFT_LOCKED = {'ReloadRifle', 'ReloadPistol'}
LEG_REACH = 0.433 + 0.433  # UpperLeg + LowerLeg, measured from the rest skeleton
# Retardo de la cadena cadera -> pecho -> cabeza, en fracción de ciclo. Es lo que
# separa "el torso gira entero" de "la cadera lidera y el pecho llega tarde".
CHAIN_LAG = 0.045
# Amplitud del balanceo de columna por metro de rebote vertical. El torso rígido
# era el otro motivo de "genérico": al pisar, la columna absorbe y el pecho cae;
# al empujar, se extiende. Se deriva del `bob` de cada clip, así que un clip con
# más rebote recibe más balanceo sin tocar constantes a mano.
SPINE_PITCH_PER_BOB = 1.15
# Reparto por hueso y adelanto respecto al rebote. El pecho va delante del punto
# bajo (absorbe al aterrizar), la cabeza estabiliza la mirada y llega después.
SPINE_PITCH_SHARE = {'Abdomen': 0.30, 'Torso': 0.50, 'Chest': 0.80, 'Neck': 0.45, 'Head': 1.35}
ANKLE_OFFSET = Vector((0.0, -0.0039, 0.078))  # ankle above the contact point
GROUND_Z = 0.0228  # Foot bone head z when the foot is flat on the floor

# ---------------------------------------------------------------------------
# GAIT: the declared ground speed of every locomotion clip, in m/s. These are
# the GAMEPLAY speeds (player.gd: walk 4.8, sprint 7.0, crouch 2.6, bots
# 4.4-7.5). A clip is authored so that its planted foot moves backwards at
# exactly this speed; the runtime then plays it at rate 1.0 and the feet do not
# slide. `front`/`back` are the planted excursion in metres ahead of and behind
# the hip; their sum is the stride this rig can actually reach (leg = 0.866 m).
# ---------------------------------------------------------------------------
GAIT = {
    'WalkFwd': dict(speed=4.8, duty=0.33, front=0.36, back=0.46, lift=0.145,
                    bob=0.030, lean=10.0, yaw=13.0, sway=0.026, pitch=( -11, 0, 8, 26, -6, -11),
                    dir=(0, -1, 0), crouch=0.0, arms=1.0),
    'SprintFwd': dict(speed=7.0, duty=0.29, front=0.42, back=0.44, lift=0.190,
                      bob=0.040, lean=20.0, yaw=18.0, sway=0.018, pitch=(-8, 2, 12, 32, -10, -8),
                      dir=(0, -1, 0), crouch=0.0, arms=1.5),
    'BackWalk': dict(speed=4.8, duty=0.33, front=0.46, back=0.36, lift=0.130,
                     bob=0.018, lean=5.0, yaw=6.0, sway=0.022, pitch=(-6, 4, 10, 18, -8, -6),
                     dir=(0, 1, 0), crouch=0.0, arms=0.8),
    # Strafe: a lateral gait with alternating support can only avoid scissoring
    # the legs if the per-step sweep (speed * duty * cycle) stays near the stance
    # width. At 4.8 m/s that means a SHORT excursion and a fast cadence: the
    # declared speed is untouched, the cycle shrinks and the stance widens.
    'StrafeLeft': dict(speed=4.8, duty=0.34, front=0.28, back=0.28, lift=0.100,
                       bob=0.024, lean=4.0, yaw=8.0, sway=0.013, stance=0.070,
                       pitch=(-6, 2, 8, 20, -8, -6), dir=(1, 0, 0), crouch=0.0, arms=0.6),
    'StrafeRight': dict(speed=4.8, duty=0.34, front=0.28, back=0.28, lift=0.100,
                        bob=0.024, lean=4.0, yaw=8.0, sway=0.013, stance=0.070,
                        pitch=(-6, 2, 8, 20, -8, -6), dir=(-1, 0, 0), crouch=0.0, arms=0.6),
    'CrouchWalk': dict(speed=2.6, duty=0.38, front=0.26, back=0.36, lift=0.095,
                       bob=0.012, lean=15.0, yaw=5.0, sway=0.016, pitch=(-5, 2, 6, 14, -6, -5),
                       dir=(0, -1, 0), crouch=0.30, arms=0.5),
    'CrouchBack': dict(speed=2.6, duty=0.38, front=0.36, back=0.26, lift=0.095,
                       bob=0.012, lean=13.0, yaw=5.0, sway=0.016, pitch=(-4, 2, 6, 12, -6, -4),
                       dir=(0, 1, 0), crouch=0.30, arms=0.5),
    'CrouchLeft': dict(speed=2.6, duty=0.38, front=0.22, back=0.22, lift=0.075,
                       bob=0.012, lean=14.0, yaw=3.0, sway=0.008, stance=0.055,
                       pitch=(-4, 2, 6, 12, -6, -4), dir=(1, 0, 0), crouch=0.30, arms=0.5),
    'CrouchRight': dict(speed=2.6, duty=0.38, front=0.22, back=0.22, lift=0.075,
                        bob=0.012, lean=14.0, yaw=3.0, sway=0.008, stance=0.055,
                        pitch=(-4, 2, 6, 12, -6, -4), dir=(-1, 0, 0), crouch=0.30, arms=0.5),
}

# Clips whose first and last frame must be identical (phase loop).
LOOPING = ['WalkFwd', 'SprintFwd', 'StrafeLeft', 'StrafeRight', 'BackWalk',
           'CrouchIdle', 'CrouchWalk', 'CrouchLeft', 'CrouchRight', 'CrouchBack', 'AirLoop']

# Palm target offset per weapon class, in weapon-mount space. The runtime IK
# consumes these; a rifle magazine comes from the belt (long travel), a pistol
# magazine from the hip line (short travel) plus a slide-stop flick on the way
# back. Keys are (normalised phase, [x, y, z] metres).
PALM_PATHS = {
    'rifle': [
        [0.00, [0.0, 0.0, 0.0]], [0.08, [0.005, -0.02, -0.02]], [0.22, [0.05, -0.18, -0.15]],
        [0.34, [0.13, -0.30, -0.19]], [0.40, [0.13, -0.30, -0.19]], [0.52, [0.06, -0.16, -0.18]],
        [0.60, [0.02, -0.09, -0.17]], [0.64, [0.02, -0.11, -0.165]], [0.70, [0.03, -0.12, -0.16]],
        [0.74, [0.02, -0.08, -0.16]], [0.88, [-0.005, 0.012, -0.01]], [1.00, [0.0, 0.0, 0.0]]],
    'pistol': [
        [0.00, [0.0, 0.0, 0.0]], [0.07, [0.0, -0.01, -0.03]], [0.20, [0.03, -0.10, -0.09]],
        [0.32, [0.08, -0.19, -0.12]], [0.38, [0.08, -0.19, -0.12]], [0.50, [0.03, -0.08, -0.11]],
        [0.60, [0.015, -0.05, -0.10]], [0.66, [0.02, -0.06, -0.095]], [0.72, [0.03, -0.10, -0.06]],
        [0.78, [0.01, -0.04, -0.04]], [0.90, [0.0, -0.005, -0.01]], [1.00, [0.0, 0.0, 0.0]]],
}
PALM_KEYS = PALM_PATHS['rifle']

REPORT = []


# --------------------------------------------------------------------------- #
# glTF helpers
# --------------------------------------------------------------------------- #
def prune_channels(path):
    raw = open(path, 'rb').read()
    offset, binary, doc = 12, b'', None
    while offset < len(raw):
        size, kind = struct.unpack('<II', raw[offset:offset + 8])
        payload = raw[offset + 8:offset + 8 + size]
        if kind == 0x4E4F534A:
            doc = json.loads(payload)
        elif kind == 0x004E4942:
            binary = payload
        offset += size + 8
    for anim in doc.get('animations', []):
        keep = [c for c in anim['channels'] if c['target']['path'] == 'rotation' or
                (c['target']['path'] == 'translation' and
                 doc['nodes'][c['target']['node']]['name'] in ['Root', 'Body', 'Foot.L', 'Foot.R'])]
        used = sorted({c['sampler'] for c in keep})
        for c in keep:
            c['sampler'] = used.index(c['sampler'])
        anim['channels'] = keep
        anim['samplers'] = [anim['samplers'][i] for i in used]
    data = json.dumps(doc, separators=(',', ':')).encode()
    data += b' ' * (-len(data) % 4)
    binary += b'\0' * (-len(binary) % 4)
    out = struct.pack('<4sII', b'glTF', 2, 28 + len(data) + len(binary))
    out += struct.pack('<II', len(data), 0x4E4F534A) + data
    out += struct.pack('<II', len(binary), 0x004E4942) + binary
    open(path, 'wb').write(out)


# --------------------------------------------------------------------------- #
# Authoring primitives
# --------------------------------------------------------------------------- #
def ease(t):
    t = max(0., min(1., t))
    return t * t * (3 - 2 * t)


def smoother(t):
    t = max(0., min(1., t))
    return t * t * t * (t * (t * 6 - 15) + 10)


def palm_at(t):
    for (a, av), (b, bv) in zip(PALM_KEYS, PALM_KEYS[1:]):
        if t <= b:
            return Vector(av).lerp(Vector(bv), ease((t - a) / (b - a)))
    return Vector((0, 0, 0))


def empty(name):
    obj = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(obj)
    return obj


def curve(obj, data_path, frame, value, linear=False):
    setattr(obj, data_path, value)
    obj.keyframe_insert(data_path, frame=frame)
    for fc in obj.id_data.animation_data.action.fcurves:
        if fc.data_path != obj.path_from_id(data_path):
            continue
        p = fc.keyframe_points[-1]
        p.interpolation = 'LINEAR' if linear else 'BEZIER'
        p.handle_left_type = p.handle_right_type = 'AUTO_CLAMPED'


def rot(arm, name, keys):
    bone = arm.pose.bones[name]
    bone.rotation_mode = 'XYZ'
    for frame, angles in keys:
        curve(bone, 'rotation_euler', frame, tuple(math.radians(v) for v in angles))


def setup():
    # Only our dedicated authoring scene is cleared, never a user's open scene.
    for obj in list(bpy.context.scene.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    for action in list(bpy.data.actions):
        bpy.data.actions.remove(action)
    bpy.data.orphans_purge(do_recursive=True)
    bpy.ops.import_scene.gltf(filepath=SRC)
    arm = next(o for o in bpy.context.scene.objects if o.type == 'ARMATURE')
    arm.animation_data_clear()
    for obj in list(bpy.context.scene.objects):
        if obj.type == 'MESH':
            bpy.data.objects.remove(obj, do_unlink=True)
    for bone in arm.pose.bones:
        bone.rotation_mode = 'QUATERNION'
        bone.rotation_quaternion = Quaternion()
        bone.location = (0, 0, 0)
        bone.scale = (1, 1, 1)
    bpy.ops.mesh.primitive_cube_add(size=.002)
    proxy = bpy.context.object
    proxy.name = 'ClipProxy'
    proxy.parent = arm
    mod = proxy.modifiers.new('Armature', 'ARMATURE')
    mod.object = arm
    proxy.vertex_groups.new(name='Root').add(range(8), 1., 'REPLACE')
    return arm, proxy


def leg_controls(arm):
    controls = {}
    for side in ['L', 'R']:
        foot = arm.pose.bones['Foot.' + side]
        ctl = empty('Contact.' + side)
        ctl.location = arm.data.bones[foot.name].head_local
        copy = foot.constraints.new('COPY_LOCATION')
        copy.target = ctl
        ankle = empty('Ankle.' + side)
        ankle.parent = ctl
        ankle.location = ANKLE_OFFSET
        knee = empty('KneePlane.' + side)
        knee.location = (.18 if side == 'L' else -.18, -1.5, .6)
        ik = arm.pose.bones['LowerLeg.' + side].constraints.new('IK')
        ik.target = ankle
        ik.pole_target = knee
        ik.chain_count = 2
        # Mirrored rest rolls: L needs PI, R needs 0 to bend toward -Y.
        ik.pole_angle = math.pi if side == 'L' else 0.0
        ik.use_stretch = False
        controls[side] = ctl
    return controls


def feet_key(controls, frame, positions):
    for side in ['L', 'R']:
        curve(controls[side], 'location', frame, positions[side], True)


def body_key(arm, frame, offset, linear=False):
    bone = arm.pose.bones['Body']
    # Blender bone-local translation, converted from armature coordinates.
    local = arm.data.bones['Body'].matrix_local.to_3x3().inverted() @ Vector(offset)
    curve(bone, 'location', frame, local, linear)


# --------------------------------------------------------------------------- #
# Locomotion
# --------------------------------------------------------------------------- #
def foot_track(q, spec, frames):
    """Contact position and foot pitch for a foot whose local phase is q.

    q = 0 is heel contact. While planted (q < duty) the contact point travels
    backwards along the travel direction at exactly spec['speed'], so the
    rendered foot is ground-locked at playback rate 1.0.
    """
    speed = spec['speed']
    duty = spec['duty']
    front, back = spec['front'], spec['back']
    excursion = front + back
    cycle = frames / FPS
    d = Vector(spec['dir']).normalized()
    if q < duty:
        u = q / duty
        along = front - speed * (q * cycle)
        # Heel lifts late in stance; the ankle rises with the contact point and
        # the foot pitches toe-down so the toe stays on the floor.
        rise = 0.0 if u < 0.62 else 0.055 * ease((u - 0.62) / 0.38)
        if u < 0.18:
            pitch = spec['pitch'][0] * (1.0 - ease(u / 0.18))
        elif u < 0.62:
            pitch = spec['pitch'][1] + (spec['pitch'][2] - spec['pitch'][1]) * ease((u - 0.18) / 0.44)
        else:
            pitch = spec['pitch'][2] + (spec['pitch'][3] - spec['pitch'][2]) * ease((u - 0.62) / 0.38)
        lift = rise
    else:
        u = (q - duty) / (1.0 - duty)
        # Heel recovery, knee drive, reach: slow out of toe-off, fast through
        # mid-swing, decelerating into contact.
        # Hermite con pendiente final EXACTA a la velocidad de apoyo: el pie
        # llega al suelo moviéndose ya a la velocidad con la que va a quedar
        # clavado, así el fotograma de aterrizaje no da un salto de velocidad
        # (era el peor derrape del walk: 1.05 m/s con el factor 0.7 anterior).
        swing_time = (1.0 - duty) * (frames / FPS)
        slope = -speed * swing_time / max(excursion, 1e-6)
        h10 = u * u * u - 2.0 * u * u + u
        h11 = u * u * u - u * u
        h01 = -2.0 * u * u * u + 3.0 * u * u
        along = (front - excursion) + excursion * (h01 + slope * (h10 + h11))
        # Aterrizaje C1 también en DISCRETO: en el último 20% del vuelo el pie
        # se pega a la recta exacta de apoyo, así el delta del fotograma de
        # contacto es idéntico al de la fase apoyada (antes quedaba un escalón
        # de 1 m/s justo al tocar el suelo).
        if u > 0.8:
            blend = ease((u - 0.8) / 0.2)
            landing = front + speed * (1.0 - u) * (1.0 - duty) * cycle
            along = along * (1.0 - blend) + landing * blend
        lift = 0.055 * (1.0 - u) ** 2.5 + spec['lift'] * math.sin(math.pi * u) ** 1.15
        if u < 0.45:
            pitch = spec['pitch'][3] + (spec['pitch'][4] - spec['pitch'][3]) * ease(u / 0.45)
        else:
            pitch = spec['pitch'][4] + (spec['pitch'][5] - spec['pitch'][4]) * ease((u - 0.45) / 0.55)
    return along, lift, pitch


def hip_ceiling(spec, feet_state, hip_xy):
    """Highest hip that still lets every planted foot reach, from real reach.

    Returns None during flight (no planted foot): the caller carries the value
    across the gap instead of letting a sentinel pollute the smoothing.
    """
    limit = 10.0
    for state in feet_state:
        ankle_z = GROUND_Z + state['lift'] + ANKLE_OFFSET.z
        horizontal = Vector((state['pos'].x - hip_xy.x, state['pos'].y - hip_xy.y)).length
        reach = LEG_REACH - 0.022
        if horizontal >= reach:
            return 0.0
        limit = min(limit, ankle_z + math.sqrt(reach * reach - horizontal * horizontal))
    return limit


def circular_fill(values, period):
    """Replace None entries by linear interpolation between the nearest real ones."""
    known = [i for i, v in enumerate(values) if v is not None]
    if not known:
        return [0.0] * len(values)
    filled = list(values)
    for i in range(len(values)):
        if filled[i] is not None:
            continue
        before = max((k for k in known if k < i), default=None)
        after = min((k for k in known if k > i), default=None)
        if before is None:
            before = known[-1] - period
        if after is None:
            after = known[0] + period
        span = max(after - before, 1e-6)
        a = values[before % len(values)]
        b = values[after % len(values)]
        filled[i] = a + (b - a) * ((i - before) / span)
    return filled


def gait(name, arm, controls):
    spec = GAIT[name]
    cycle = (spec['front'] + spec['back']) / (spec['speed'] * spec['duty'])
    frames = max(14, int(round(cycle * FPS)))
    crouch = spec['crouch']
    d = Vector(spec['dir']).normalized()
    hip_xy = Vector((0.0, -0.0451, 0.0))  # UpperLeg head x/y at rest

    # Pass 1: foot targets and the hip height the reach allows.
    tracks = {}
    planted_map = {}
    ceilings = []
    for side in ('L', 'R'):
        delay = 0.0 if side == 'L' else 0.5
        rest = arm.data.bones['Foot.' + side].head_local.copy()
        # A wider base stance is what buys room for a lateral step without the
        # legs crossing. It only applies to lateral clips (spec['stance']).
        rest += Vector((1.0 if side == 'L' else -1.0, 0.0, 0.0)) * spec.get('stance', 0.0)
        rows = []
        flags = []
        for frame in range(frames + 1):
            phase = (frame % frames) / frames
            q = (phase + delay) % 1.0
            along, lift, pitch = foot_track(q, spec, frames)
            pos = rest + d * along
            pos.z = GROUND_Z + lift
            rows.append(dict(pos=pos, lift=lift, pitch=pitch, planted=q < spec['duty']))
            flags.append(q < spec['duty'])
        tracks[side] = rows
        planted_map[side] = flags
    for frame in range(frames + 1):
        ceilings.append(hip_ceiling(spec, [tracks['L'][frame], tracks['R'][frame]], hip_xy))
    ceilings = circular_fill(ceilings, frames)
    # The COM sits below the reach envelope the whole cycle. Two separate
    # causes: what the leg geometry forces (reach) and what the pose declares
    # (crouch). Neither is a hand-tuned constant in disguise.
    reach_drop = max(0.0, 0.9642 - (min(ceilings) - 0.006))
    for frame in range(frames + 1):
        phase = (frame % frames) / frames
        # Running bob: lowest at mid-stance, highest at mid-flight.
        bob = spec['bob'] * (1.0 + math.cos(2.0 * math.tau * (phase - spec['duty'] * 0.5))) * 0.5
        desired = 0.9642 - max(reach_drop, crouch) - bob
        # The envelope only ever caps: the leg is never asked to over-reach.
        target = min(desired, ceilings[frame] - 0.006)
        drop = target - 0.9642
        sway = spec['sway'] * math.sin(math.tau * phase)
        body_key(arm, frame, (sway, 0.0, drop), True)
        positions = {s: tracks[s][frame]['pos'] for s in ('L', 'R')}
        feet_key(controls, frame, positions)
        for side in ('L', 'R'):
            rot(arm, 'Foot.' + side, [(frame, (tracks[side][frame]['pitch'], 0.0, 0.0))])
        # Pelvis yaw leads the swing leg, spine counter-rotates. La cadena lleva
        # RETARDO progresivo (cadera -> pecho -> cabeza): sin él todas las
        # vértebras giran en la misma fase, el torso se lee como un bloque y el
        # andar se siente genérico aunque el perfil vertical sea correcto.
        yaw = spec['yaw'] * math.cos(math.tau * phase)
        roll = spec['sway'] * 60.0 * math.sin(math.tau * phase)
        yaw_mid = spec['yaw'] * math.cos(math.tau * (phase - CHAIN_LAG))
        yaw_top = spec['yaw'] * math.cos(math.tau * (phase - CHAIN_LAG * 2.0))
        rot(arm, 'Hips', [(frame, (0.0, roll, -yaw))])
        # Balanceo de columna ligado al peso: el rebote vertical menos su media
        # (+1 abajo, -1 arriba) modula el cabeceo de cada vértebra.
        weight = ((spec['bob'] * 0.5 - bob) / max(spec['bob'] * 0.5, 1e-6))
        weight = max(-1.0, min(1.0, weight))
        # `rot()` recibe GRADOS: el balanceo nace en metros de rebote y hay que
        # convertirlo, o el cabeceo queda 57x más pequeño y no se ve.
        swing = math.degrees(weight * spec['bob'] * SPINE_PITCH_PER_BOB)
        pitch_abdomen = spec['lean'] * 0.30 + swing * SPINE_PITCH_SHARE['Abdomen']
        pitch_torso = spec['lean'] * 0.34 + swing * SPINE_PITCH_SHARE['Torso']
        pitch_chest = spec['lean'] * 0.26 + swing * SPINE_PITCH_SHARE['Chest']
        pitch_neck = -spec['lean'] * 0.35 + swing * SPINE_PITCH_SHARE['Neck']
        pitch_head = -spec['lean'] * 0.30 + swing * SPINE_PITCH_SHARE['Head']
        rot(arm, 'Abdomen', [(frame, (pitch_abdomen, 0.0, yaw_mid * 0.45))])
        rot(arm, 'Torso', [(frame, (pitch_torso, 0.0, yaw_mid * 0.55))])
        rot(arm, 'Chest', [(frame, (pitch_chest, 0.0, yaw_top * 0.75))])
        rot(arm, 'Neck', [(frame, (pitch_neck, 0.0, 0.0))])
        rot(arm, 'Head', [(frame, (pitch_head, 0.0, -yaw_top * 0.25))])
        # Arm swing is cosmetic: runtime IK replaces both arms with the weapon.
        swing = spec['arms'] * 26.0 * math.cos(math.tau * phase)
        rot(arm, 'UpperArm.L', [(frame, (-swing * 0.55, 0.0, 0.0))])
        rot(arm, 'UpperArm.R', [(frame, (swing * 0.55, 0.0, 0.0))])
        rot(arm, 'LowerArm.L', [(frame, (max(0.0, -swing) * 0.5, 0.0, 0.0))])
        rot(arm, 'LowerArm.R', [(frame, (max(0.0, swing) * 0.5, 0.0, 0.0))])
    return frames, planted_map


def crouch_idle(arm, controls):
    """Static low stance with breathing; no leg travel."""
    frames = int(2.4 * FPS)
    base = 0.9642 - 0.30
    for frame in range(frames + 1):
        phase = (frame % frames) / frames
        breath = 0.008 * math.sin(math.tau * phase)
        body_key(arm, frame, (0.0, 0.0, (base - 0.9642) + breath), True)
        positions = {}
        for side in ('L', 'R'):
            rest = arm.data.bones['Foot.' + side].head_local.copy()
            rest.y -= 0.04 if side == 'L' else -0.02
            rest.z = GROUND_Z
            positions[side] = rest
        feet_key(controls, frame, positions)
        for side in ('L', 'R'):
            rot(arm, 'Foot.' + side, [(frame, (4.0, 0.0, 0.0))])
        rot(arm, 'Hips', [(frame, (0.0, 0.0, 0.0))])
        rot(arm, 'Abdomen', [(frame, (10.0 + breath * 40.0, 0.0, 0.0))])
        rot(arm, 'Torso', [(frame, (9.0, 0.0, 0.0))])
        rot(arm, 'Chest', [(frame, (5.0, 0.0, 0.0))])
        rot(arm, 'Neck', [(frame, (-6.0, 0.0, 0.0))])
        rot(arm, 'Head', [(frame, (-5.0, 0.0, 0.0))])
        rot(arm, 'UpperArm.L', [(frame, (0.0, 0.0, 0.0))])
        rot(arm, 'UpperArm.R', [(frame, (0.0, 0.0, 0.0))])
        rot(arm, 'LowerArm.L', [(frame, (0.0, 0.0, 0.0))])
        rot(arm, 'LowerArm.R', [(frame, (0.0, 0.0, 0.0))])
    return frames, base


# --------------------------------------------------------------------------- #
# Air chain: anticipation -> push -> release, float, contact -> compression
# --------------------------------------------------------------------------- #
def air(name, arm, controls):
    if name == 'JumpStart':
        frames = int(0.30 * FPS)
        # (seconds, com z, foot z L, foot z R, foot y L, foot y R)
        keys = [(0.00, 0.000, 0.000, 0.000, 0.000, 0.000),
                (0.07, -0.075, 0.000, 0.000, 0.010, -0.010),
                (0.13, -0.020, 0.030, 0.020, 0.040, 0.020),
                (0.20, 0.030, 0.110, 0.070, 0.075, 0.045),
                (0.30, 0.040, 0.155, 0.105, 0.090, 0.055)]
        for frame in range(frames + 1):
            t = frame / FPS
            for (a, b) in zip(keys, keys[1:]):
                if t <= b[0] or b is keys[-1]:
                    u = ease((t - a[0]) / max(b[0] - a[0], 1e-6))
                    vals = [a[i] + (b[i] - a[i]) * u for i in range(1, 6)]
                    break
            body_key(arm, frame, (0.0, 0.0, vals[0]), True)
            positions = {}
            for side, idx in (('L', 1), ('R', 2)):
                rest = arm.data.bones['Foot.' + side].head_local.copy()
                rest.z = GROUND_Z + vals[idx]
                rest.y -= vals[idx + 2]
                positions[side] = rest
            feet_key(controls, frame, positions)
            rot(arm, 'Foot.L', [(frame, (-6.0 + 34.0 * ease(t / 0.30), 0.0, 0.0))])
            rot(arm, 'Foot.R', [(frame, (-6.0 + 30.0 * ease(t / 0.30), 0.0, 0.0))])
            lean = 4.0 - 6.0 * ease(t / 0.30)
            rot(arm, 'Abdomen', [(frame, (lean, 0.0, 0.0))])
            rot(arm, 'Torso', [(frame, (lean * 0.8, 0.0, 0.0))])
            rot(arm, 'Chest', [(frame, (lean * 0.5, 0.0, 0.0))])
            rot(arm, 'Neck', [(frame, (-lean * 0.6, 0.0, 0.0))])
            rot(arm, 'Head', [(frame, (-lean * 0.4, 0.0, 0.0))])
            rot(arm, 'UpperArm.L', [(frame, (18.0 * ease(t / 0.30), 0.0, 0.0))])
            rot(arm, 'UpperArm.R', [(frame, (14.0 * ease(t / 0.30), 0.0, 0.0))])
            rot(arm, 'LowerArm.L', [(frame, (0.0, 0.0, 0.0))])
            rot(arm, 'LowerArm.R', [(frame, (0.0, 0.0, 0.0))])
        return frames
    if name == 'AirLoop':
        frames = int(0.80 * FPS)
        for frame in range(frames + 1):
            phase = (frame % frames) / frames
            float_z = 0.012 * math.sin(math.tau * phase)
            body_key(arm, frame, (0.0, 0.0, 0.040 + float_z), True)
            positions = {}
            for side, forward, lift, lag in (('L', 0.075, 0.150, 0.0), ('R', -0.030, 0.105, 0.6)):
                rest = arm.data.bones['Foot.' + side].head_local.copy()
                rest.y -= forward + 0.010 * math.sin(math.tau * phase + lag)
                rest.z = GROUND_Z + lift + 0.008 * math.sin(math.tau * phase + lag + 0.9)
                positions[side] = rest
            feet_key(controls, frame, positions)
            rot(arm, 'Foot.L', [(frame, (16.0 + 4.0 * math.sin(math.tau * phase), 0.0, 0.0))])
            rot(arm, 'Foot.R', [(frame, (24.0 + 4.0 * math.sin(math.tau * phase + 1.2), 0.0, 0.0))])
            rot(arm, 'Abdomen', [(frame, (6.0 + 1.5 * math.sin(math.tau * phase), 0.0, -3.0))])
            rot(arm, 'Torso', [(frame, (5.0, 0.0, -2.0))])
            rot(arm, 'Chest', [(frame, (3.0, 0.0, 2.0 * math.sin(math.tau * phase)))])
            rot(arm, 'Neck', [(frame, (-4.0, 0.0, 0.0))])
            rot(arm, 'Head', [(frame, (-3.0, 0.0, 0.0))])
            rot(arm, 'UpperArm.L', [(frame, (12.0, 0.0, 0.0))])
            rot(arm, 'UpperArm.R', [(frame, (9.0, 0.0, 0.0))])
            rot(arm, 'LowerArm.L', [(frame, (6.0, 0.0, 0.0))])
            rot(arm, 'LowerArm.R', [(frame, (5.0, 0.0, 0.0))])
        return frames
    # Land: contact, compression, recovery with a small overshoot.
    frames = int(0.47 * FPS)
    # The rest pose already has straight legs: the COM may never rise above it,
    # or the IK clamps and the foot lifts. Recovery is expressed by the spine.
    com = [(0.00, 0.020), (0.07, -0.055), (0.15, -0.185), (0.24, -0.120),
           (0.34, -0.010), (0.47, 0.000)]
    foot = [(0.00, 0.060), (0.10, 0.000), (0.47, 0.000)]
    lean = [(0.00, -4.0), (0.15, 11.0), (0.26, 5.0), (0.36, -2.0), (0.47, 0.0)]
    for frame in range(frames + 1):
        t = frame / FPS

        def track(table, when):
            for (a, av), (b, bv) in zip(table, table[1:]):
                if t <= b:
                    return av + (bv - av) * ease((t - a) / max(b - a, 1e-6))
            return table[-1][1]

        body_key(arm, frame, (0.0, 0.0, track(com, t)), True)
        positions = {}
        for side in ('L', 'R'):
            rest = arm.data.bones['Foot.' + side].head_local.copy()
            rest.z = GROUND_Z + track(foot, t)
            rest.y -= 0.030 if side == 'L' else 0.010
            positions[side] = rest
        feet_key(controls, frame, positions)
        rot(arm, 'Foot.L', [(frame, (18.0 * (1.0 - ease(t / 0.16)), 0.0, 0.0))])
        rot(arm, 'Foot.R', [(frame, (16.0 * (1.0 - ease(t / 0.16)), 0.0, 0.0))])
        a = track(lean, t)
        rot(arm, 'Abdomen', [(frame, (a, 0.0, 0.0))])
        rot(arm, 'Torso', [(frame, (a * 0.9, 0.0, 0.0))])
        rot(arm, 'Chest', [(frame, (a * 0.6, 0.0, 0.0))])
        rot(arm, 'Neck', [(frame, (-a * 0.7, 0.0, 0.0))])
        rot(arm, 'Head', [(frame, (-a * 0.5, 0.0, 0.0))])
        arm_k = 16.0 * (1.0 - ease(t / 0.30))
        rot(arm, 'UpperArm.L', [(frame, (arm_k, 0.0, 0.0))])
        rot(arm, 'UpperArm.R', [(frame, (arm_k, 0.0, 0.0))])
        rot(arm, 'LowerArm.L', [(frame, (arm_k * 0.4, 0.0, 0.0))])
        rot(arm, 'LowerArm.R', [(frame, (arm_k * 0.4, 0.0, 0.0))])
    return frames


# --------------------------------------------------------------------------- #
# Reload / Flinch: the body has to sell the action, not just the hand
# --------------------------------------------------------------------------- #
def brake(arm, controls):
    """Frenada: absorción encima del paso, sin recolocar los pies.

    Soltar el stick apagaba la marcha y el personaje llegaba al idle sin fase de
    absorción. Este clip NO pisa adelante: la pierna de apoyo la elige el ciclo
    de locomoción que está saliendo, y recolocar el pie desde el clip pelearía
    con él (medido: 0.33 m de huella, el pie derrapaba al desaparecer el paso).
    Lo que hace es lo que sí manda el clip: caer el centro de masas, doblar las
    rodillas y echar el torso atrás para aguantar. Los pies quedan donde el
    gait los tenía, así que al entrar y salir no arrastra nada.
    """
    frames = int(0.38 * FPS)
    com_z = [(0.00, -0.005), (0.09, -0.105), (0.20, -0.070), (0.30, -0.015), (0.38, 0.000)]
    com_y = [(0.00, 0.000), (0.09, -0.045), (0.22, -0.025), (0.38, 0.000)]
    lean = [(0.00, 2.0), (0.09, -7.0), (0.20, -4.5), (0.30, 1.0), (0.38, 0.0)]
    knee = [(0.00, 0.0), (0.09, 13.0), (0.22, 8.0), (0.38, 0.0)]

    def track(table, when):
        for (a, av), (b, bv) in zip(table, table[1:]):
            if when <= b:
                return av + (bv - av) * ease((when - a) / max(b - a, 1e-6))
        return table[-1][1]

    for frame in range(frames + 1):
        t = frame / FPS
        # Centro de masas: baja y va ligeramente atrás (el peso cae al frenar).
        body_key(arm, frame, (0.0, track(com_y, t), track(com_z, t)), True)
        # Los pies se quedan en su apoyo de reposo: el clip no los recoloca.
        positions = {}
        for side in ('L', 'R'):
            rest = arm.data.bones['Foot.' + side].head_local.copy()
            rest.z = GROUND_Z
            positions[side] = rest
        feet_key(controls, frame, positions)
        bend = track(knee, t)
        rot(arm, 'UpperLeg.L', [(frame, (bend, 0.0, 0.0))])
        rot(arm, 'UpperLeg.R', [(frame, (bend, 0.0, 0.0))])
        rot(arm, 'LowerLeg.L', [(frame, (-bend * 1.6, 0.0, 0.0))])
        rot(arm, 'LowerLeg.R', [(frame, (-bend * 1.6, 0.0, 0.0))])
        rot(arm, 'Foot.L', [(frame, (bend * 0.6, 0.0, 0.0))])
        rot(arm, 'Foot.R', [(frame, (bend * 0.6, 0.0, 0.0))])
        lean_now = track(lean, t)
        rot(arm, 'Abdomen', [(frame, (lean_now * 1.1, 0.0, 0.0))])
        rot(arm, 'Torso', [(frame, (lean_now, 0.0, 0.0))])
        rot(arm, 'Chest', [(frame, (lean_now * 0.8, 0.0, 0.0))])
        rot(arm, 'Neck', [(frame, (-lean_now * 0.7, 0.0, 0.0))])
        rot(arm, 'Head', [(frame, (-lean_now * 0.6, 0.0, 0.0))])
        # Brazos cosméticos: el IK de runtime los reemplaza por el arma.
        swing = -lean_now * 0.8
        rot(arm, 'UpperArm.L', [(frame, (swing, 0.0, 0.0))])
        rot(arm, 'UpperArm.R', [(frame, (swing * 0.8, 0.0, 0.0))])
        rot(arm, 'LowerArm.L', [(frame, (0.0, 0.0, 0.0))])
        rot(arm, 'LowerArm.R', [(frame, (0.0, 0.0, 0.0))])
    return frames


def upper(arm, name):
    # ReloadRifle/ReloadPistol are CRAFT_LOCKED: this formula path only exists
    # for a forced --force-rebuild, never for the normal pipeline.
    if name == 'Flinch':
        frames = int(0.40 * FPS)
        for frame in range(frames + 1):
            t = frame / FPS
            hit = ease(t / 0.06) if t < 0.06 else (1.0 - ease((t - 0.06) / 0.22) if t < 0.28 else -0.12 * (1.0 - ease((t - 0.28) / 0.12)))
            rot(arm, 'Chest', [(frame, (-7.0 * hit, 0.0, 2.0 * hit))])
            rot(arm, 'Abdomen', [(frame, (-3.0 * hit, 0.0, 1.0 * hit))])
            rot(arm, 'Neck', [(frame, (-2.5 * hit, 0.0, 0.0))])
            rot(arm, 'Head', [(frame, (-3.0 * hit, 0.0, 0.0))])
            rot(arm, 'Shoulder.L', [(frame, (0.0, -2.0 * hit, -2.0 * hit))])
            rot(arm, 'Shoulder.R', [(frame, (0.0, -1.5 * hit, 1.5 * hit))])
        return frames
    # Reload: torso, shoulder and gaze weight, timed to the palm path. A pistol
    # reload is shorter and much more centred than a rifle reload.
    frames = int((1.4 if name == 'ReloadPistol' else 1.8) * FPS)

    def track(table, t):
        for (a, av), (b, bv) in zip(table, table[1:]):
            if t <= b:
                return av + (bv - av) * ease((t - a) / max(b - a, 1e-6))
        return table[-1][1]

    # Chest yaw follows the hand toward the magazine, then snaps back on the
    # seat. Head glances down at the well and returns to the target.
    chest_yaw = [(0.00, 0.0), (0.14, 3.0), (0.40, 7.5), (0.58, 5.0), (0.74, 2.0), (0.88, -1.5), (1.00, 0.0)]
    chest_pitch = [(0.00, 0.0), (0.20, 2.0), (0.46, 4.5), (0.70, 1.5), (0.86, 3.0), (1.00, 0.0)]
    head_yaw = [(0.00, 0.0), (0.18, -6.0), (0.46, -13.0), (0.70, -6.0), (0.90, 1.5), (1.00, 0.0)]
    head_pitch = [(0.00, 0.0), (0.18, 4.0), (0.46, 9.0), (0.72, 3.0), (0.90, -1.0), (1.00, 0.0)]
    shoulder_l = [(0.00, 0.0), (0.16, -5.0), (0.44, -8.0), (0.68, -3.0), (0.84, -5.0), (1.00, 0.0)]
    body_z = [(0.00, 0.0), (0.20, -0.012), (0.44, -0.026), (0.70, -0.014), (0.86, -0.022), (1.00, 0.0)]
    for frame in range(frames + 1):
        t = frame / frames
        rot(arm, 'Abdomen', [(frame, (track(chest_pitch, t) * 0.45, 0.0, track(chest_yaw, t) * 0.35))])
        rot(arm, 'Torso', [(frame, (track(chest_pitch, t) * 0.55, 0.0, track(chest_yaw, t) * 0.55))])
        rot(arm, 'Chest', [(frame, (track(chest_pitch, t) * 0.65, 0.0, track(chest_yaw, t) * 0.85))])
        rot(arm, 'Neck', [(frame, (track(head_pitch, t) * 0.45, 0.0, track(head_yaw, t) * 0.35))])
        rot(arm, 'Head', [(frame, (track(head_pitch, t) * 0.55, 0.0, track(head_yaw, t) * 0.65))])
        rot(arm, 'Shoulder.L', [(frame, (0.0, track(shoulder_l, t), track(shoulder_l, t) * 0.6))])
        rot(arm, 'Shoulder.R', [(frame, (0.0, track(shoulder_l, t) * 0.2, 0.0))])
        body_key(arm, frame, (0.0, 0.0, track(body_z, t)), True)
    # Visible editable Blender palm target with the same authored path as runtime.
    ctl = empty('ReloadPalmPath')
    for t, p in PALM_KEYS:
        curve(ctl, 'location', t * frames, Vector((.14 + p[0], -.40 - p[2], 1.38 + p[1])))
    return frames


# --------------------------------------------------------------------------- #
# Verification: reach, ground lock, loop continuity
# --------------------------------------------------------------------------- #
def verify(name, arm, frames, expected_speed=None, planted_map=None):
    scene = bpy.context.scene
    rows = []
    for f in range(frames + 1):
        scene.frame_set(f)
        bpy.context.view_layer.update()
        row = {}
        for side in ('L', 'R'):
            hip = arm.matrix_world @ arm.pose.bones['UpperLeg.' + side].head
            ankle = arm.matrix_world @ arm.pose.bones['LowerLeg.' + side].tail
            foot = arm.matrix_world @ arm.pose.bones['Foot.' + side].head
            row[side] = (hip, ankle, foot)
        rows.append(row)
    worst_reach = 0.0
    for row in rows:
        for side in ('L', 'R'):
            hip, ankle, _ = row[side]
            worst_reach = max(worst_reach, (ankle - hip).length / LEG_REACH)
    slides = []
    for i in range(frames):
        for side in ('L', 'R'):
            if planted_map is not None and not (planted_map[side][i] and planted_map[side][i + 1]):
                continue
            f0, f1 = rows[i][side][2], rows[i + 1][side][2]
            if planted_map is None and (f0.z - GROUND_Z > 0.02 or f1.z - GROUND_Z > 0.02):
                continue
            slides.append((f1 - f0).length * FPS)
    loop = 0.0
    if name in LOOPING:
        for side in ('L', 'R'):
            loop = max(loop, (rows[0][side][2] - rows[frames][side][2]).length)
    REPORT.append(dict(clip=name, frames=frames, seconds=round(frames / FPS, 3),
                       reach=round(worst_reach, 3),
                       planted_speed=round(sum(slides) / len(slides), 2) if slides else None,
                       loop_gap=round(loop, 5), expected=expected_speed))
    return REPORT[-1]


# --------------------------------------------------------------------------- #
# Build
# --------------------------------------------------------------------------- #
def build(name, export=True):
    arm, proxy = setup()
    controls = leg_controls(arm)
    if name in ('ReloadRifle', 'ReloadPistol', 'Reload', 'Flinch'):
        frames = upper(arm, name)
        speed = None
        planted = None
    elif name in ('JumpStart', 'AirLoop', 'Land'):
        frames = air(name, arm, controls)
        speed = None
        planted = None
    elif name == 'Brake':
        frames = brake(arm, controls)
        speed = None
        planted = None
    elif name == 'CrouchIdle':
        frames, _ = crouch_idle(arm, controls)
        speed = 0.0
        planted = None
    else:
        frames, planted = gait(name, arm, controls)
        speed = GAIT[name]['speed']
    scene = bpy.context.scene
    scene.render.fps = FPS
    scene.frame_start = 0
    scene.frame_end = frames
    verify(name, arm, frames, speed, planted)
    # Bake world-space constraint solutions to local bone transforms, preserving
    # rotations AND the independent foot/body translations. No solver in GLB.
    samples = []
    for f in range(frames + 1):
        scene.frame_set(f)
        bpy.context.view_layer.update()
        samples.append([b.matrix.copy() for b in arm.pose.bones])
    for b in arm.pose.bones:
        for c in list(b.constraints):
            b.constraints.remove(c)
    arm.animation_data_clear()
    action = bpy.data.actions.new(name)
    arm.animation_data_create()
    arm.animation_data.action = action
    for frame, matrices in enumerate(samples):
        scene.frame_set(frame)
        for b, matrix in zip(arm.pose.bones, matrices):
            b.rotation_mode = 'QUATERNION'
            b.matrix = matrix
            bpy.context.view_layer.update()
            b.keyframe_insert('rotation_quaternion', frame=frame)
            b.keyframe_insert('location', frame=frame)
    for fc in action.fcurves:
        for k in fc.keyframe_points:
            k.interpolation = 'LINEAR'
    scene.frame_set(0)
    # Small editable source includes target curves and evaluated action.
    os.makedirs(SOURCE_DIR, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(SOURCE_DIR, name + '.blend'), compress=True)
    if export:
        export_source(name, arm, proxy)
    print('BLOCKFIRE_CLIP', name, frames, flush=True)


def export_source(name, arm=None, proxy=None):
    """Export one .blend source to GLB. Non-destructive: never regenerates."""
    if arm is None:
        bpy.ops.wm.open_mainfile(filepath=os.path.join(SOURCE_DIR, name + '.blend'))
        scene = bpy.context.scene
        arm = next(o for o in scene.objects if o.type == 'ARMATURE')
        proxy = scene.objects.get('ClipProxy')
    for other in list(bpy.data.actions):
        if not arm.animation_data or other != arm.animation_data.action:
            bpy.data.actions.remove(other)
    # A hand-authored source may be saved in Pose Mode, where the object-level
    # select_all operator has no valid poll in --background. Select directly.
    active = bpy.context.view_layer.objects.active
    if active is not None and active.mode != 'OBJECT':
        bpy.ops.object.mode_set(mode='OBJECT')
    for obj in bpy.context.view_layer.objects:
        obj.select_set(False)
    arm.select_set(True)
    if proxy is not None:
        proxy.select_set(True)
    bpy.context.view_layer.objects.active = arm
    path = os.path.join(OUT_DIR, name + '.glb')
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True,
                              export_animations=True, export_frame_range=True,
                              export_animation_mode='ACTIONS', export_nla_strips=False,
                              export_optimize_animation_size=False, export_skins=True,
                              export_materials='NONE', export_image_format='NONE',
                              export_morph=False)
    prune_channels(path)
    print('BLOCKFIRE_EXPORT', name, os.path.getsize(path), flush=True)


def write_speed_manifest():
    os.makedirs(OUT_DIR, exist_ok=True)
    payload = {}
    for name, spec in GAIT.items():
        cycle = (spec['front'] + spec['back']) / (spec['speed'] * spec['duty'])
        payload[name] = dict(speed=spec['speed'], cycle=round(cycle, 4),
                             duty=spec['duty'], direction=list(spec['dir']))
    with open(os.path.join(OUT_DIR, 'locomotion_speeds.json'), 'w') as handle:
        json.dump(payload, handle, indent=1, sort_keys=True)
    with open(os.path.join(OUT_DIR, 'reload_hand_path.json'), 'w') as handle:
        json.dump(PALM_PATHS, handle)
    print('BLOCKFIRE_SPEEDS', json.dumps(payload, sort_keys=True), flush=True)


def main(argv):
    os.makedirs(OUT_DIR, exist_ok=True)
    rebuild = '--rebuild' in argv
    force = '--force-rebuild' in argv
    verify_only = '--verify' in argv
    names = [a for a in argv if not a.startswith('--')]
    write_speed_manifest()
    targets = names or NAMES
    for name in targets:
        if name not in NAMES:
            raise ValueError(name)
        source = os.path.join(SOURCE_DIR, name + '.blend')
        if verify_only:
            bpy.ops.wm.open_mainfile(filepath=source)
            arm = next(o for o in bpy.context.scene.objects if o.type == 'ARMATURE')
            frames = int(bpy.context.scene.frame_end)
            verify(name, arm, frames, GAIT.get(name, {}).get('speed'))
        elif rebuild and name in CRAFT_LOCKED and not force:
            raise SystemExit(
                f'refusing --rebuild {name}: it is hand-authored in Blender '
                f'(CRAFT_LOCKED). Export it instead, or pass --force-rebuild '
                f'to intentionally replace the craft.')
        elif rebuild or not os.path.exists(source):
            build(name)
        else:
            export_source(name)
    if REPORT:
        for row in REPORT:
            print('BLOCKFIRE_VERIFY', json.dumps(row, sort_keys=True), flush=True)


if __name__ == '__main__':
    main(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
