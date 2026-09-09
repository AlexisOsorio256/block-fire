"""Genera los clips de animacion de BLOCKFIRE con el rig real.

Entrada : assets/models/skins/operator_adult_smooth.glb (22 huesos)
Salida  : assets/models/animation_library/<Clip>.glb, un archivo por clip, con
          UNA sola animacion que se llama exactamente como el archivo.

Contrato del integrador: rotacion local (cuaternion) por hueso, sin escala, sin
root motion (solo el hueso Root puede trasladarse, para el aterrizaje), 30 fps,
sin clips de idle/walk/run/aim/shoot/death.

Uso: blender --background --python tools/make_anim_clips.py -- [Clip ...]
"""
import json
import math
import os
import struct
import sys

import bpy
from mathutils import Euler, Quaternion

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "assets/models/skins/operator_adult_smooth.glb")
OUT_DIR = os.path.join(ROOT, "assets/models/animation_library")
FPS = 30

# ---------------------------------------------------------------------------
# Definicion de clips. Cada pose: frame -> {hueso: (rx, ry, rz) en grados
# locales}. `root_z`: frame -> desplazamiento vertical del hueso Root en metros
# (solo aterrizaje). `loop`: el ultimo frame repite la pose del primero.
# ---------------------------------------------------------------------------
CLIPS = {
    "Reload": {
        "frames": 42,
        "loop": False,
        "keys": [
            (0, {}),
            (6, {"UpperArm.L": (-18, 0, -10), "LowerArm.L": (38, 0, 0), "Wrist.L": (10, 0, 0),
                 "Abdomen": (5, 0, -3), "Chest": (4, 0, -2), "Neck": (10, 0, 0), "Head": (6, 0, 0),
                 "UpperArm.R": (-3, 0, 0)}),
            (12, {"UpperArm.L": (-24, 0, -14), "LowerArm.L": (56, 0, 0), "Wrist.L": (18, 0, 6),
                  "Abdomen": (9, 0, -6), "Chest": (7, 0, -4), "Neck": (16, 0, 0), "Head": (10, 0, 0),
                  "UpperArm.R": (-6, 0, 0), "LowerArm.R": (4, 0, 0)}),
            (20, {"UpperArm.L": (-8, 0, -6), "LowerArm.L": (74, 0, 0), "Wrist.L": (22, 0, -8),
                  "Abdomen": (11, 0, -4), "Chest": (8, 0, -2), "Neck": (18, 0, 0), "Head": (12, 0, 0),
                  "UpperArm.R": (-7, 0, 0), "LowerArm.R": (6, 0, 0)}),
            (28, {"UpperArm.L": (-21, 0, -12), "LowerArm.L": (52, 0, 0), "Wrist.L": (14, 0, 4),
                  "Abdomen": (8, 0, -5), "Chest": (6, 0, -3), "Neck": (14, 0, 0), "Head": (9, 0, 0),
                  "UpperArm.R": (-5, 0, 0), "LowerArm.R": (3, 0, 0)}),
            (33, {"UpperArm.L": (-27, 0, -15), "LowerArm.L": (44, 0, 0), "Wrist.L": (6, 0, 8),
                  "Abdomen": (10, 0, -6), "Chest": (8, 0, -4), "Neck": (15, 0, 0), "Head": (9, 0, 0),
                  "UpperArm.R": (-6, 0, 0), "LowerArm.R": (4, 0, 0)}),
            (38, {"UpperArm.L": (-9, 0, -4), "LowerArm.L": (18, 0, 0), "Wrist.L": (3, 0, 2),
                  "Abdomen": (3, 0, -2), "Chest": (2, 0, -1), "Neck": (5, 0, 0), "Head": (3, 0, 0),
                  "UpperArm.R": (-2, 0, 0)}),
            (42, {}),
        ],
    },
    "StrafeLeft": {
        "frames": 33,
        "loop": True,
        "keys": [
            (0, {}),
            (8, {"UpperLeg.L": (0, -17, 0), "UpperLeg.R": (0, 9, 0),
                 "LowerLeg.L": (13, 0, 0), "LowerLeg.R": (21, 0, 0),
                 "Foot.L": (-7, 0, 0), "Foot.R": (6, 0, 0),
                 "Hips": (0, 0, 3), "Abdomen": (0, 0, -2), "Chest": (0, 0, -3),
                 "UpperArm.L": (0, 0, -3), "UpperArm.R": (0, 0, 3), "Head": (0, 0, -2)}),
            (16, {"UpperLeg.L": (0, 4, 0), "UpperLeg.R": (0, -4, 0),
                  "LowerLeg.L": (24, 0, 0), "LowerLeg.R": (24, 0, 0),
                  "Hips": (0, 0, 0), "Chest": (0, 0, 0),
                  "UpperArm.L": (0, 0, 0), "UpperArm.R": (0, 0, 0)}),
            (25, {"UpperLeg.L": (0, 9, 0), "UpperLeg.R": (0, -17, 0),
                  "LowerLeg.L": (21, 0, 0), "LowerLeg.R": (13, 0, 0),
                  "Foot.L": (6, 0, 0), "Foot.R": (-7, 0, 0),
                  "Hips": (0, 0, -3), "Abdomen": (0, 0, 2), "Chest": (0, 0, 3),
                  "UpperArm.L": (0, 0, 3), "UpperArm.R": (0, 0, -3), "Head": (0, 0, 2)}),
            (33, {}),
        ],
    },
    "StrafeRight": {
        "frames": 33,
        "loop": True,
        "keys": [
            (0, {}),
            (8, {"UpperLeg.R": (0, 17, 0), "UpperLeg.L": (0, -9, 0),
                 "LowerLeg.R": (13, 0, 0), "LowerLeg.L": (21, 0, 0),
                 "Foot.R": (-7, 0, 0), "Foot.L": (6, 0, 0),
                 "Hips": (0, 0, -3), "Abdomen": (0, 0, 2), "Chest": (0, 0, 3),
                 "UpperArm.R": (0, 0, -3), "UpperArm.L": (0, 0, 3), "Head": (0, 0, 2)}),
            (16, {"UpperLeg.R": (0, -4, 0), "UpperLeg.L": (0, 4, 0),
                  "LowerLeg.R": (24, 0, 0), "LowerLeg.L": (24, 0, 0),
                  "Hips": (0, 0, 0), "Chest": (0, 0, 0),
                  "UpperArm.L": (0, 0, 0), "UpperArm.R": (0, 0, 0)}),
            (25, {"UpperLeg.R": (0, -9, 0), "UpperLeg.L": (0, 17, 0),
                  "LowerLeg.R": (21, 0, 0), "LowerLeg.L": (13, 0, 0),
                  "Foot.R": (6, 0, 0), "Foot.L": (-7, 0, 0),
                  "Hips": (0, 0, 3), "Abdomen": (0, 0, -2), "Chest": (0, 0, -3),
                  "UpperArm.R": (0, 0, 3), "UpperArm.L": (0, 0, -3), "Head": (0, 0, -2)}),
            (33, {}),
        ],
    },
    "Land": {
        "frames": 14,
        "loop": False,
        "keys": [
            (0, {"UpperLeg.L": (34, 0, 0), "UpperLeg.R": (34, 0, 0),
                 "LowerLeg.L": (58, 0, 0), "LowerLeg.R": (58, 0, 0),
                 "Foot.L": (-22, 0, 0), "Foot.R": (-22, 0, 0),
                 "Abdomen": (13, 0, 0), "Chest": (9, 0, 0), "Neck": (7, 0, 0), "Head": (5, 0, 0),
                 "UpperArm.L": (-6, 0, -4), "UpperArm.R": (-6, 0, 4)}),
            (4, {"UpperLeg.L": (22, 0, 0), "UpperLeg.R": (22, 0, 0),
                 "LowerLeg.L": (38, 0, 0), "LowerLeg.R": (38, 0, 0),
                 "Foot.L": (-14, 0, 0), "Foot.R": (-14, 0, 0),
                 "Abdomen": (8, 0, 0), "Chest": (5, 0, 0), "Neck": (4, 0, 0), "Head": (3, 0, 0),
                 "UpperArm.L": (-3, 0, -2), "UpperArm.R": (-3, 0, 2)}),
            (8, {"UpperLeg.L": (7, 0, 0), "UpperLeg.R": (7, 0, 0),
                 "LowerLeg.L": (13, 0, 0), "LowerLeg.R": (13, 0, 0),
                 "Abdomen": (2, 0, 0), "Chest": (1, 0, 0)}),
            (11, {"UpperLeg.L": (-3, 0, 0), "UpperLeg.R": (-3, 0, 0),
                  "LowerLeg.L": (-2, 0, 0), "LowerLeg.R": (-2, 0, 0),
                  "Chest": (-1, 0, 0)}),
            (14, {}),
        ],
        "root_z": {0: -0.20, 4: -0.11, 8: -0.02, 11: 0.012, 14: 0.0},
    },
    "Flinch": {
        "frames": 11,
        "loop": False,
        "keys": [
            (0, {}),
            (2, {"Chest": (-11, 0, 3), "Abdomen": (-6, 0, 2), "Neck": (-8, 0, 0), "Head": (-7, 0, 0),
                 "UpperArm.L": (7, 0, 4), "UpperArm.R": (7, 0, -4),
                 "LowerArm.L": (10, 0, 0), "LowerArm.R": (10, 0, 0),
                 "Hips": (-3, 0, 0), "UpperLeg.L": (5, 0, 0), "UpperLeg.R": (5, 0, 0),
                 "LowerLeg.L": (8, 0, 0), "LowerLeg.R": (8, 0, 0)}),
            (5, {"Chest": (5, 0, -1), "Abdomen": (3, 0, -1), "Neck": (3, 0, 0), "Head": (3, 0, 0),
                 "UpperArm.L": (-2, 0, -1), "UpperArm.R": (-2, 0, 1)}),
            (8, {"Chest": (-1, 0, 0), "Neck": (-1, 0, 0), "Head": (-1, 0, 0)}),
            (11, {}),
        ],
        "root_z": {0: 0.0, 2: -0.025, 5: 0.006, 8: -0.002, 11: 0.0},
    },
    "CrouchIdle": {
        "frames": 36,
        "loop": True,
        "base": {"UpperLeg.L": (42, 0, 0), "UpperLeg.R": (42, 0, 0),
                 "LowerLeg.L": (62, 0, 0), "LowerLeg.R": (62, 0, 0),
                 "Foot.L": (-26, 0, 0), "Foot.R": (-26, 0, 0),
                 "Abdomen": (14, 0, 0), "Chest": (10, 0, 0),
                 "Neck": (-6, 0, 0), "Head": (-4, 0, 0),
                 "UpperArm.L": (-12, 0, -4), "LowerArm.L": (18, 0, 0),
                 "UpperArm.R": (-10, 0, 4), "LowerArm.R": (12, 0, 0)},
        "keys": [
            (0, {}),
            (12, {"Chest": (11.5, 0, 0), "Abdomen": (15, 0, 0), "Head": (-5, 0, 0)}),
            (24, {"Chest": (8.5, 0, 0), "Abdomen": (13, 0, 0), "Head": (-3, 0, 0)}),
            (36, {}),
        ],
        "root_z": {0: -0.34, 12: -0.335, 24: -0.345, 36: -0.34},
    },
    "CrouchWalk": {
        "frames": 33,
        "loop": True,
        "base": {"Abdomen": (15, 0, 0), "Chest": (11, 0, 0),
                 "Neck": (-6, 0, 0), "Head": (-4, 0, 0),
                 "UpperArm.L": (-12, 0, -4), "LowerArm.L": (18, 0, 0),
                 "UpperArm.R": (-10, 0, 4), "LowerArm.R": (12, 0, 0)},
        "keys": [
            (0, {"UpperLeg.L": (42, 0, 0), "UpperLeg.R": (42, 0, 0),
                 "LowerLeg.L": (62, 0, 0), "LowerLeg.R": (62, 0, 0),
                 "Foot.L": (-26, 0, 0), "Foot.R": (-26, 0, 0)}),
            (8, {"UpperLeg.L": (58, 0, 0), "UpperLeg.R": (26, 0, 0),
                 "LowerLeg.L": (48, 0, 0), "LowerLeg.R": (74, 0, 0),
                 "Foot.L": (-18, 0, 0), "Foot.R": (-30, 0, 0),
                 "Chest": (12, 0, 0)}),
            (16, {"UpperLeg.L": (42, 0, 0), "UpperLeg.R": (42, 0, 0),
                  "LowerLeg.L": (66, 0, 0), "LowerLeg.R": (66, 0, 0),
                  "Foot.L": (-28, 0, 0), "Foot.R": (-28, 0, 0)}),
            (25, {"UpperLeg.L": (26, 0, 0), "UpperLeg.R": (58, 0, 0),
                  "LowerLeg.L": (74, 0, 0), "LowerLeg.R": (48, 0, 0),
                  "Foot.L": (-30, 0, 0), "Foot.R": (-18, 0, 0),
                  "Chest": (12, 0, 0)}),
            (33, {"UpperLeg.L": (42, 0, 0), "UpperLeg.R": (42, 0, 0),
                  "LowerLeg.L": (62, 0, 0), "LowerLeg.R": (62, 0, 0),
                  "Foot.L": (-26, 0, 0), "Foot.R": (-26, 0, 0)}),
        ],
        "root_z": {0: -0.34, 8: -0.325, 16: -0.355, 25: -0.325, 33: -0.34},
    },
}


def prune_channels(path: str) -> None:
    """Blender exporta T/R/S en los 22 huesos aunque solo se anime rotacion.
    Se podan los canales constantes y los samplers huerfanos: el integrador
    exige rotacion local y, como mucho, traslacion del hueso Root."""
    raw = open(path, "rb").read()
    magic, version, _length = struct.unpack("<4sII", raw[:12])
    offset = 12
    doc = None
    bin_chunk = b""
    while offset < len(raw):
        clen, ctype = struct.unpack("<II", raw[offset:offset + 8])
        data = raw[offset + 8:offset + 8 + clen]
        if ctype == 0x4E4F534A:
            doc = json.loads(data.decode("utf-8"))
        elif ctype == 0x004E4942:
            bin_chunk = data
        offset += 8 + clen

    for animation in doc.get("animations", []):
        keep = []
        for channel in animation.get("channels", []):
            target = channel.get("target", {})
            index = target.get("node")
            name = doc["nodes"][index].get("name", "") if index is not None else ""
            if target.get("path") == "rotation":
                keep.append(channel)
            elif target.get("path") == "translation" and name == "Root":
                keep.append(channel)
        used = sorted({channel["sampler"] for channel in keep})
        remap = {old: new for new, old in enumerate(used)}
        for channel in keep:
            channel["sampler"] = remap[channel["sampler"]]
        animation["channels"] = keep
        animation["samplers"] = [animation["samplers"][i] for i in used]

    payload = json.dumps(doc, separators=(",", ":")).encode("utf-8")
    payload += b" " * ((4 - len(payload) % 4) % 4)
    padded = bin_chunk + b"\x00" * ((4 - len(bin_chunk) % 4) % 4)
    total = 12 + 8 + len(payload) + (8 + len(padded) if padded else 0)
    out = bytearray(struct.pack("<4sII", magic, version, total))
    out += struct.pack("<II", len(payload), 0x4E4F534A) + payload
    if padded:
        out += struct.pack("<II", len(padded), 0x004E4942) + padded
    open(path, "wb").write(bytes(out))


def set_pose(arm, pose) -> None:
    for bone in arm.pose.bones:
        bone.rotation_mode = "QUATERNION"
        bone.rotation_quaternion = Quaternion((1.0, 0.0, 0.0, 0.0))
        bone.location = (0.0, 0.0, 0.0)
    for name, (rx, ry, rz) in pose.items():
        bone = arm.pose.bones.get(name)
        if bone is None:
            print("AVISO: hueso inexistente %s" % name)
            continue
        bone.rotation_quaternion = Euler(
            (math.radians(rx), math.radians(ry), math.radians(rz)), "XYZ").to_quaternion()


def build_clip(arm, name, spec) -> None:
    scene = bpy.context.scene
    scene.render.fps = FPS
    scene.frame_start = 0
    scene.frame_end = spec["frames"]
    if arm.animation_data is None:
        arm.animation_data_create()
    action = bpy.data.actions.new(name)
    arm.animation_data.action = action

    for frame, pose in spec["keys"]:
        merged = dict(spec.get("base", {}))
        merged.update(pose)
        set_pose(arm, merged)
        root_z = spec.get("root_z", {}).get(frame, 0.0)
        root = arm.pose.bones.get("Root")
        if root is not None:
            # El hueso Root del rig apunta hacia arriba: su eje local Y es el
            # vertical, asi que el desplazamiento vertical va en Y local.
            root.location = (0.0, root_z, 0.0)
        for bone in arm.pose.bones:
            bone.keyframe_insert("rotation_quaternion", frame=frame)
            if bone.name == "Root":
                bone.keyframe_insert("location", frame=frame)

    for fcurve in action.fcurves:
        for point in fcurve.keyframe_points:
            point.interpolation = "BEZIER"
            point.handle_left_type = "AUTO_CLAMPED"
            point.handle_right_type = "AUTO_CLAMPED"

    # Limpieza: la importacion deja las acciones originales del personaje.
    for other in list(bpy.data.actions):
        if other is not action:
            bpy.data.actions.remove(other)

    path = os.path.join(OUT_DIR, "%s.glb" % name)
    bpy.ops.object.select_all(action="SELECT")
    bpy.context.view_layer.objects.active = arm
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format="GLB",
        use_selection=False,
        export_apply=False,
        export_animations=True,
        export_frame_range=True,
        export_animation_mode="ACTIONS",
        export_nla_strips=False,
        export_optimize_animation_size=False,
        export_yup=True,
        export_skins=True,
        export_materials="NONE",
        export_image_format="NONE",
        export_morph=False,
    )
    prune_channels(path)
    print("CLIP %-12s frames=%-3d loop=%-5s bytes=%d" % (
        name, spec["frames"], spec["loop"], os.path.getsize(path)))

    # Metrica de control: recorrido de las manos y del Root.
    print("  METRICA %s:" % name)
    for frame, _pose in spec["keys"]:
        scene.frame_set(frame)
        wl = arm.pose.bones.get("Wrist.L")
        wr = arm.pose.bones.get("Wrist.R")
        rt = arm.pose.bones.get("Root")
        parts = ["f=%2d" % frame]
        if wl is not None:
            p = arm.matrix_world @ wl.head
            parts.append("Wrist.L=(%.2f,%.2f,%.2f)" % (p.x, p.y, p.z))
        if wr is not None:
            p = arm.matrix_world @ wr.head
            parts.append("Wrist.R=(%.2f,%.2f,%.2f)" % (p.x, p.y, p.z))
        if rt is not None:
            p = arm.matrix_world @ rt.head
            parts.append("Root=(%.2f,%.2f,%.2f)" % (p.x, p.y, p.z))
        print("    " + "  ".join(parts))


def main() -> int:
    requested = [a for a in sys.argv[sys.argv.index("--") + 1:]] if "--" in sys.argv else []
    names = requested or list(CLIPS.keys())

    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=SRC)
    armatures = [o for o in bpy.data.objects if o.type == "ARMATURE"]
    if not armatures:
        print("ERROR: el glb no trae armature")
        return 1
    arm = armatures[0]
    print("HUESOS(%d): %s" % (len(arm.data.bones), [b.name for b in arm.data.bones]))

    # La malla del personaje pesa 20 MB y no aporta nada al clip: se sustituye
    # por un proxy minimo deformado por Root para que el glTF lleve skin y Godot
    # importe un Skeleton3D con poses de hueso reales.
    for obj in list(bpy.data.objects):
        if obj.type == "MESH":
            bpy.data.objects.remove(obj, do_unlink=True)
    bpy.ops.mesh.primitive_cube_add(size=0.02, location=(0.0, 0.0, 0.0))
    proxy = bpy.context.active_object
    proxy.name = "ClipProxy"
    modifier = proxy.modifiers.new("Armature", "ARMATURE")
    modifier.object = arm
    group = proxy.vertex_groups.new(name="Root")
    group.add(range(len(proxy.data.vertices)), 1.0, "REPLACE")
    proxy.parent = arm

    os.makedirs(OUT_DIR, exist_ok=True)
    for name in names:
        spec = CLIPS.get(name)
        if spec is None:
            print("ERROR: clip desconocido %s" % name)
            continue
        build_clip(arm, name, spec)
    return 0


if __name__ == "__main__":
    sys.exit(main())
