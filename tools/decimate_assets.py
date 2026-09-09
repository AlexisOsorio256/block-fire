"""Decima assets pesados de BLOCKFIRE a un presupuesto de triángulos.

Uso:
  blender --background --python tools/decimate_assets.py -- <src> <dst> <ratio>

Ejemplo:
  blender --background --python tools/decimate_assets.py -- \
    assets/models/skins/operator_adult_smooth.glb \
    assets/models/skins/operator_adult_smooth_dec.glb 0.09

No toca el original: escribe un archivo NUEVO. Conserva rig (22 huesos),
nombres de clips (el exportador quita el sufijo `_CharacterArmature` que añade
el importador) y materiales/texturas.
"""
import os
import sys

import bpy

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
if len(argv) < 3:
    print("USO: blender --background --python tools/decimate_assets.py -- <src> <dst> <ratio>")
    raise SystemExit(1)

src, dst, ratio = argv[0], argv[1], float(argv[2])

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)

before = 0
after = 0
for obj in [o for o in bpy.data.objects if o.type == "MESH"]:
    polys = len(obj.data.polygons)
    before += polys
    if polys < 200:
        after += polys
        continue
    modifier = obj.modifiers.new("Decimate", "DECIMATE")
    modifier.decimate_type = "COLLAPSE"
    modifier.ratio = max(0.02, min(1.0, ratio))
    modifier.use_collapse_triangulate = True
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    after += len(obj.data.polygons)
    print("  %-28s %7d -> %7d polys" % (obj.name[:28], polys, len(obj.data.polygons)))

print("TOTAL %d -> %d polys (ratio %.3f)" % (before, after, ratio))

bpy.ops.object.select_all(action="SELECT")
bpy.ops.export_scene.gltf(
    filepath=dst,
    export_format="GLB",
    use_selection=False,
    export_animations=True,
    export_animation_mode="ACTIONS",
    export_nla_strips=False,
    export_yup=True,
    export_skins=True,
    export_morph=False,
)
print("ESCRITO %s (%d bytes)" % (dst, os.path.getsize(dst)))
