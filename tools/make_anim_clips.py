"""Author and bake Quaternius motion in Blender 4.0 (CC0 rig, 22 bones).

blender --background --python tools/make_anim_clips.py -- [Clip ...]
Also callable through Blender MCP: main(['StrafeLeft', ...]).
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
from mathutils import Vector, Euler, Quaternion

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'assets/models/skins/operator_adult_lod.glb')
OUT_DIR = os.path.join(ROOT, 'assets/models/animation_library')
FPS = 30
NAMES = ['StrafeLeft', 'StrafeRight', 'BackWalk', 'CrouchIdle', 'CrouchWalk',
         'CrouchLeft', 'CrouchRight', 'CrouchBack', 'Reload', 'JumpStart', 'AirLoop', 'Land', 'Flinch']
PALM_KEYS = [
    [0., [0.,0.,0.]], [.10, [0.,-.005,-.01]], [.23, [.035,-.16,-.17]],
    [.40, [.14,-.32,-.20]], [.56, [.07,-.18,-.19]], [.65, [.02,-.10,-.18]],
    [.72, [.025,-.12,-.17]], [.88, [-.005,.012,-.01]], [1., [0.,0.,0.]]]


def prune_channels(path):
    raw = open(path, 'rb').read()
    offset, binary, doc = 12, b'', None
    while offset < len(raw):
        size, kind = struct.unpack('<II', raw[offset:offset+8])
        payload = raw[offset+8:offset+8+size]
        if kind == 0x4E4F534A: doc = json.loads(payload)
        elif kind == 0x004E4942: binary = payload
        offset += size + 8
    for anim in doc.get('animations', []):
        keep = [c for c in anim['channels'] if c['target']['path'] == 'rotation' or
                (c['target']['path'] == 'translation' and doc['nodes'][c['target']['node']]['name'] in ['Root','Body','Foot.L','Foot.R'])]
        used = sorted({c['sampler'] for c in keep})
        for c in keep: c['sampler'] = used.index(c['sampler'])
        anim['channels'] = keep
        anim['samplers'] = [anim['samplers'][i] for i in used]
    data = json.dumps(doc, separators=(',', ':')).encode()
    data += b' ' * (-len(data) % 4)
    binary += b'\0' * (-len(binary) % 4)
    out = struct.pack('<4sII', b'glTF', 2, 28 + len(data) + len(binary))
    out += struct.pack('<II', len(data), 0x4E4F534A) + data
    out += struct.pack('<II', len(binary), 0x004E4942) + binary
    open(path,'wb').write(out)


def ease(t):
    t=max(0.,min(1.,t))
    return t*t*(3-2*t)


def palm_at(t):
    for (a, av), (b, bv) in zip(PALM_KEYS, PALM_KEYS[1:]):
        if t <= b: return Vector(av).lerp(Vector(bv), ease((t-a)/(b-a)))
    return Vector((0,0,0))


def empty(name):
    obj=bpy.data.objects.new(name,None)
    bpy.context.collection.objects.link(obj)
    return obj


def curve(obj, data_path, frame, value, linear=False):
    setattr(obj,data_path,value)
    obj.keyframe_insert(data_path,frame=frame)
    for fc in obj.id_data.animation_data.action.fcurves:
        if fc.data_path != obj.path_from_id(data_path): continue
        p=fc.keyframe_points[-1]
        p.interpolation='LINEAR' if linear else 'BEZIER'
        p.handle_left_type=p.handle_right_type='AUTO_CLAMPED'


def rot(arm,name,keys):
    bone=arm.pose.bones[name]
    bone.rotation_mode='XYZ'
    for frame,angles in keys:
        curve(bone,'rotation_euler',frame,tuple(math.radians(v) for v in angles))


def setup():
    # Only our dedicated authoring scene is cleared, never a user's open scene.
    for obj in list(bpy.context.scene.objects): bpy.data.objects.remove(obj,do_unlink=True)
    for action in list(bpy.data.actions): bpy.data.actions.remove(action)
    bpy.data.orphans_purge(do_recursive=True)
    bpy.ops.import_scene.gltf(filepath=SRC)
    arm=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
    arm.animation_data_clear()
    for obj in list(bpy.context.scene.objects):
        if obj.type=='MESH': bpy.data.objects.remove(obj,do_unlink=True)
    for bone in arm.pose.bones:
        bone.rotation_mode='QUATERNION'
        bone.rotation_quaternion=Quaternion()
        bone.location=(0,0,0)
        bone.scale=(1,1,1)
    bpy.ops.mesh.primitive_cube_add(size=.002)
    proxy=bpy.context.object
    proxy.name='ClipProxy'
    proxy.parent=arm
    mod=proxy.modifiers.new('Armature','ARMATURE'); mod.object=arm
    proxy.vertex_groups.new(name='Root').add(range(8),1.,'REPLACE')
    return arm,proxy


def leg_controls(arm):
    controls={}
    for side in ['L','R']:
        foot=arm.pose.bones['Foot.'+side]
        ctl=empty('Contact.'+side)
        ctl.location=arm.data.bones[foot.name].head_local
        copy=foot.constraints.new('COPY_LOCATION'); copy.target=ctl
        ankle=empty('Ankle.'+side); ankle.parent=ctl
        ankle.location=arm.data.bones['LowerLeg.'+side].tail_local-arm.data.bones[foot.name].head_local
        knee=empty('KneePlane.'+side)
        knee.location=(.18 if side=='L' else -.18,-1.5,.6)
        ik=arm.pose.bones['LowerLeg.'+side].constraints.new('IK')
        ik.target=ankle; ik.pole_target=knee; ik.chain_count=2
        # Mirrored rest rolls: L needs PI, R needs 0 to bend toward -Y.
        ik.pole_angle=math.pi if side == 'L' else 0.0
        ik.use_stretch=False
        controls[side]=ctl
    return controls


def feet_key(controls,frame,positions):
    for side in ['L','R']: curve(controls[side],'location',frame,positions[side],True)


def body_key(arm,frame,offset):
    bone=arm.pose.bones['Body']
    # Blender bone-local translation, converted from armature coordinates.
    local=arm.data.bones['Body'].matrix_local.to_3x3().inverted() @ Vector(offset)
    curve(bone,'location',frame,local,True)


def gait(arm,name,controls):
    low=name.startswith('Crouch')
    idle=name=='CrouchIdle'
    frames=72 if idle else (30 if low else 24)
    direction=Vector((0,-1,0))
    if name in ['StrafeLeft','CrouchLeft']: direction=Vector((1,0,0))
    if name in ['StrafeRight','CrouchRight']: direction=Vector((-1,0,0))
    if name in ['BackWalk','CrouchBack']: direction=Vector((0,1,0))
    lateral=abs(direction.x) > .5
    stride=(.50 if low else .60) if lateral else (.625 if low else .72) # planted travel / 0.5 cycle: 1.25 / 1.8 m/s
    if idle: stride=0
    for frame in range(frames+1):
        phase=frame/frames
        positions={}
        # COM settles onto support leg; pelvis remains inside foot envelope.
        shift=(.004 if idle else .025)*math.cos(phase*math.tau)
        body_key(arm,frame,(shift, .055 if low else 0., (-.28 if low else (-.12 if lateral else -.035))-.012*math.cos(phase*math.tau*2)))
        delays=[('L',0),('R',.18 if lateral else .5)]
        if direction.x < 0: delays=[('R',0),('L',.18)]
        for side,delay in delays:
            q=(phase+delay)%1
            rest=arm.data.bones['Foot.'+side].head_local.copy()
            if lateral: rest.x=.24 if side=='L' else -.24
            if q < .5:
                travel=stride*(.5-2*q); lift=0.
            else:
                u=(q-.5)*2
                # Breakdowns: toe-off → passing → heel contact, contact velocity
                # matches the planted segment at both ends (cubic Hermite).
                h=3*u*u-2*u*u*u
                travel=stride*(-.5+h-(u*u*u-2*u*u+u)-(u*u*u-u*u))
                lift=(.075 if low else .115)*math.sin(math.pi*u)**2
            rest += direction*travel
            rest.z += 0.0 if idle else lift
            positions[side]=rest
        feet_key(controls,frame,positions)
    rot(arm,'Hips',[(0,(0,0,-2)),(frames/4,(0,0,2)),(frames/2,(0,0,2)),(frames*3/4,(0,0,-2)),(frames,(0,0,-2))])
    rot(arm,'Abdomen',[(0,(8 if low else 2,0,1.2)),(frames/2,(8 if low else 2,0,-1.2)),(frames,(8 if low else 2,0,1.2))])
    return frames


def air(arm,name,controls):
    frames={'JumpStart':8,'AirLoop':24,'Land':14}[name]
    # Contact before compression; delayed torso recovery supplies overlap.
    if name=='Land': keys=[(0,-.015),(2,-.08),(4,-.19),(7,-.11),(10,.006),(14,0.)]
    elif name=='JumpStart': keys=[(0,-.045),(1,-.065),(3,.01),(5,0.),(8,0.)]
    else: keys=[(0,0.),(12,.004),(24,0.)]
    for f,z in keys: body_key(arm,f,(0,0,z))
    for frame in range(frames+1):
        positions={}
        for side in ['L','R']:
            rest=arm.data.bones['Foot.'+side].head_local.copy()
            if name!='Land':
                w=ease((frame-2)/6) if name=='JumpStart' else 1.
                rest.z += (.16 if side=='L' else .10)*w
                rest.y += (.10 if side=='L' else .06)*w
            positions[side]=rest
        feet_key(controls,frame,positions)
    if name=='Land':
        rot(arm,'Abdomen',[(0,(0,0,0)),(4,(9,0,0)),(8,(4,0,0)),(11,(-1,0,0)),(14,(0,0,0))])
        rot(arm,'Chest',[(0,(0,0,0)),(5,(4,0,0)),(9,(1,0,0)),(14,(0,0,0))])
    return frames


def upper(arm,name):
    if name=='Flinch':
        rot(arm,'Chest',[(0,(0,0,0)),(2,(-7,0,2)),(5,(2,0,-.5)),(8,(-.5,0,0)),(11,(0,0,0))])
        rot(arm,'Head',[(0,(0,0,0)),(3,(-3,0,0)),(7,(1,0,0)),(11,(0,0,0))])
        return 11
    rot(arm,'Abdomen',[(0,(0,0,0)),(5,(-1,0,1)),(13,(2,0,-3)),(25,(3,0,-4)),(36,(2,0,-2)),(45,(-.7,0,.8)),(54,(0,0,0))])
    rot(arm,'Chest',[(0,(0,0,0)),(7,(-1,0,1.5)),(17,(3,0,-3)),(27,(4,0,-2)),(34,(1,0,-4)),(40,(2,0,-1)),(48,(-.4,0,.5)),(54,(0,0,0))])
    rot(arm,'Shoulder.L',[(0,(0,0,0)),(8,(0,-2,-2)),(16,(0,3,5)),(23,(0,1,3)),(33,(0,-3,-2)),(38,(0,1,1)),(48,(0,-.5,-1)),(54,(0,0,0))])
    rot(arm,'Shoulder.R',[(0,(0,0,0)),(8,(0,-1,1)),(20,(0,2,2)),(36,(0,1,1)),(47,(0,-.4,-.4)),(54,(0,0,0))])
    rot(arm,'Head',[(0,(0,0,0)),(9,(1,0,0)),(18,(7,0,-3)),(29,(5,0,-2)),(39,(2,0,0)),(47,(-.7,0,.5)),(54,(0,0,0))])
    # Visible editable Blender palm target with the same authored path as runtime.
    ctl=empty('ReloadPalmPath')
    for t,p in PALM_KEYS:
        curve(ctl,'location',t*54,Vector((.14+p[0],-.40-p[2],1.38+p[1])))
    return 54


def build(name):
    arm,proxy=setup()
    controls=leg_controls(arm)
    if name in ['Reload','Flinch']: frames=upper(arm,name)
    elif name in ['JumpStart','AirLoop','Land']: frames=air(arm,name,controls)
    else: frames=gait(arm,name,controls)
    scene=bpy.context.scene
    scene.render.fps=FPS; scene.frame_start=0; scene.frame_end=frames
    # Bake world-space constraint solutions to local bone transforms, preserving
    # rotations AND the independent foot/body translations. No solver in GLB.
    samples=[]
    for f in range(frames+1):
        scene.frame_set(f); bpy.context.view_layer.update()
        samples.append([b.matrix.copy() for b in arm.pose.bones])
    for b in arm.pose.bones:
        for c in list(b.constraints): b.constraints.remove(c)
    arm.animation_data_clear()
    action=bpy.data.actions.new(name); arm.animation_data_create(); arm.animation_data.action=action
    for frame,matrices in enumerate(samples):
        scene.frame_set(frame)
        for b,matrix in zip(arm.pose.bones,matrices):
            b.rotation_mode='QUATERNION'; b.matrix=matrix
            bpy.context.view_layer.update()
            b.keyframe_insert('rotation_quaternion',frame=frame)
            b.keyframe_insert('location',frame=frame)
    for fc in action.fcurves:
        for k in fc.keyframe_points: k.interpolation='LINEAR'
    scene.frame_set(0)
    # Small editable source includes target curves and evaluated action.
    source=os.path.join(ROOT,'assets/animation_sources')
    os.makedirs(source,exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(source,name+'.blend'),compress=True)
    for other in list(bpy.data.actions):
        if other != action: bpy.data.actions.remove(other)
    bpy.ops.object.select_all(action='DESELECT'); arm.select_set(True);proxy.select_set(True)
    bpy.context.view_layer.objects.active=arm
    path=os.path.join(OUT_DIR,name+'.glb')
    bpy.ops.export_scene.gltf(filepath=path,export_format='GLB',use_selection=True,
        export_animations=True,export_frame_range=True,export_animation_mode='ACTIONS',
        export_nla_strips=False,export_optimize_animation_size=False,export_skins=True,
        export_materials='NONE',export_image_format='NONE',export_morph=False)
    prune_channels(path)
    print('ASTRA_CLIP',name,frames,os.path.getsize(path),flush=True)


def main(names=None):
    os.makedirs(OUT_DIR,exist_ok=True)
    with open(os.path.join(OUT_DIR,'reload_hand_path.json'),'w') as f: json.dump(PALM_KEYS,f)
    for name in (names or NAMES):
        if name not in NAMES: raise ValueError(name)
        build(name)

if __name__=='__main__':
    main(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else None)
