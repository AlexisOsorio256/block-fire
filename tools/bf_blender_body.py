"""Añade un CUERPO DE VISUALIZACIÓN a la escena Blender abierta (no guarda).

Los sources de `assets/animation_sources/*.blend` son rig puro: solo el
armature, los empties de control y el `ClipProxy` de exportación. Eso es
correcto para autorar y exportar, pero deja el viewport sin cuerpo y es
imposible juzgar si una recarga "parece una persona".

Este helper importa el modelo ACTIVO del juego, deja un solo conjunto de
prendas y lo vuelve a enlazar al rig del clip, de modo que el viewport muestra
la malla deformada por la animación que estás editando.

USO INTERACTIVO (Blender GUI + blender-mcp), desde la escena que quieras ver:

    exec(open('tools/bf_blender_body.py').read())

USO DESDE TERMINAL (sin guardar nada):

    blender assets/animation_sources/SprintFwd.blend \
        --python tools/bf_blender_body.py -- Swat

El helper NO guarda el .blend: el cuerpo es solo de visualización y el
exportador sigue seleccionando únicamente `CharacterArmature` + `ClipProxy`.
"""
import os
import sys

import bpy

DEFAULT_MODEL = 'assets/models/skins/operator_adult_lod.glb'
DEFAULT_OUTFIT = 'Swat'
OUTFIT_PARTS = ('Body', 'Head', 'Legs', 'Feet', 'Pants')


def _repo_root():
    """Repo root, tanto si el helper se ejecuta como script como si se hace
    exec() desde blender-mcp (donde __file__ no existe)."""
    try:
        return os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    except NameError:
        pass
    blend = bpy.data.filepath
    if blend:
        return os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(blend))))
    return os.getcwd()


def add_display_body(model_path=None, outfit=DEFAULT_OUTFIT):
    model_path = model_path or os.path.join(_repo_root(), DEFAULT_MODEL)
    arm = next((o for o in bpy.context.scene.objects if o.type == 'ARMATURE'), None)
    if arm is None:
        raise RuntimeError('no hay armature en la escena abierta')

    keep = {'%s_%s' % (outfit, part) for part in OUTFIT_PARTS}
    before = set(bpy.data.objects)
    # El importador glTF necesita un objeto activo (lo usa para su colección
    # interna); recién abierto un .blend el contexto puede no tener ninguno.
    bpy.context.view_layer.objects.active = arm
    arm.select_set(True)
    bpy.ops.import_scene.gltf(filepath=model_path)
    imported = [o for o in bpy.data.objects if o not in before]
    imported_arm = next((o for o in imported if o.type == 'ARMATURE'), None)

    bound = []
    for obj in imported:
        if obj.type != 'MESH' or obj.name not in keep:
            continue
        obj.parent = arm
        obj.matrix_parent_inverse = arm.matrix_world.inverted()
        for mod in obj.modifiers:
            if mod.type == 'ARMATURE':
                mod.object = arm
        bound.append(obj)
    for obj in imported:
        if obj is imported_arm or obj not in bound:
            bpy.data.objects.remove(obj, do_unlink=True)

    # El cuerpo de visualización no se mezcla con los objetos del clip.
    collection = bpy.data.collections.get('DISPLAY_REF') or bpy.data.collections.new('DISPLAY_REF')
    if collection.name not in bpy.context.scene.collection.children:
        bpy.context.scene.collection.children.link(collection)
    for obj in bound:
        for owner in list(obj.users_collection):
            owner.objects.unlink(obj)
        collection.objects.link(obj)

    # Los empties de control estorban en la vista pero siguen en la escena.
    for obj in bpy.context.scene.objects:
        if obj.type == 'EMPTY' or obj.name == 'ClipProxy':
            obj.hide_set(True)
    print('BLOCKFIRE_DISPLAY_BODY', outfit, len(bound), 'mallas enlazadas a', arm.name)
    return bound


if __name__ == '__main__':
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    add_display_body(outfit=argv[0] if argv else DEFAULT_OUTFIT)
