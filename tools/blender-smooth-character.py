"""Suelda y subdivide el rig modular CC0 con Blender (headless).

Uso:
  blender -b --python tools/blender-smooth-character.py -- \
    assets/models/quaternius_modular/avatar_rig.gltf \
    assets/models/skins/operator_adult_smooth.glb 1 0.004

Por qué: el pack viene facetado y se lee "de bloques". Soldar primero evita el
pinzamiento de la subdivisión en las costuras y conserva el esqueleto de 22
huesos y los 8 clips originales. El asset original NO se modifica.
"""
import bpy, sys, os, bmesh

argv = sys.argv[sys.argv.index("--") + 1:]
src, dst = argv[0], argv[1]
level = int(argv[2]) if len(argv) > 2 else 1
weld = float(argv[3]) if len(argv) > 3 else 0.004

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
applied = 0
for obj in list(bpy.data.objects):
    if obj.type != 'MESH' or obj.data.shape_keys:
        continue
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    mesh = obj.data
    bm = bmesh.new()
    bm.from_mesh(mesh)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=weld)
    bm.to_mesh(mesh)
    bm.free()
    mesh.update()
    modifier = obj.modifiers.new('bf_subdiv', 'SUBSURF')
    modifier.subdivision_type = 'CATMULL_CLARK'
    modifier.levels = level
    modifier.render_levels = level
    modifier.use_limit_surface = False
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    applied += 1
    obj.select_set(False)
print("SMOOTH meshes processed:", applied)
bpy.ops.export_scene.gltf(filepath=dst, export_format='GLB', export_animations=True, export_skins=True)
print("SMOOTH exported:", dst, os.path.getsize(dst))
