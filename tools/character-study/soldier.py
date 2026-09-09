"""Crossline Soldier approval study. Run with Blender 4.5 --background --python.

Genuine editable geometry; this is an unrigged art-direction study, not the shipped
multiplayer asset. Z-up, facing -Y in Blender. Geometry is exported separately from
the studio. Run from any directory; output stays in the canonical repository.
"""
import bpy
import math
import sys
import json
import argparse
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
OUT = ROOT / 'art' / 'character-study'
OUT.mkdir(parents=True, exist_ok=True)
parser = argparse.ArgumentParser()
parser.add_argument('--character', choices=['soldier', 'terrorist'], default='soldier')
parser.add_argument('--production', action='store_true')
parser.add_argument('--no-render', action='store_true')
args = parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
CHARACTER = args.character
sys.path.insert(0, str(HERE))
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)

def material(name, color, rough=.5, metallic=0, textile=False):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*color, 1)
    m.use_nodes = True
    bs = m.node_tree.nodes.get('Principled BSDF')
    bs.inputs['Base Color'].default_value = (*color, 1)
    bs.inputs['Roughness'].default_value = rough
    bs.inputs['Metallic'].default_value = metallic
    if textile:
        noise = m.node_tree.nodes.new('ShaderNodeTexNoise')
        noise.inputs['Scale'].default_value = 180
        noise.inputs['Detail'].default_value = 2
        bump = m.node_tree.nodes.new('ShaderNodeBump')
        bump.inputs['Strength'].default_value = .15
        bump.inputs['Distance'].default_value = .009
        m.node_tree.links.new(noise.outputs['Fac'], bump.inputs['Height'])
        m.node_tree.links.new(bump.outputs['Normal'], bs.inputs['Normal'])
    return m

m = {
    'skin': material('Warm peach / skin', (.73,.32,.115), .48),
    'cloth': material('Sage cotton', (.12,.19,.105), .79, textile=True),
    'clothLight': material('Fold highlight / sage', (.175,.245,.145), .76, textile=True),
    'clothDark': material('Seam / deep olive', (.10,.145,.075), .85),
    'leather': material('Tactical brown', (.067,.052,.033), .67, textile=True),
    'leatherLight': material('Edge / khaki leather', (.16,.115,.063), .61, textile=True),
    'metal': material('Brushed graphite hardware', (.20,.22,.17), .34, .65),
    'dark': material('Dark polymer', (.042,.05,.035), .48),
    'orange': material('Unit patch / amber', (.80,.245,.035), .67),
    'sole': material('Rubber sole', (.063,.052,.041), .8),
}
m['skin'].node_tree.nodes.get('Principled BSDF').inputs['Subsurface Weight'].default_value = .06
m['skin'].node_tree.nodes.get('Principled BSDF').inputs['Subsurface Radius'].default_value = (1,.4,.2)
m['hair'] = material('Espresso hair', (.035,.018,.010), .47)
m['hairLight'] = material('Hair edge', (.057,.03,.014), .5)
m['lip'] = material('Warm lip', (.50,.19,.085), .55)
m['mouth'] = material('Mouth cavity', (.064,.012,.008), .8)
m['teeth'] = material('Ivory enamel', (.91,.89,.78), .3)
m['white'] = material('Eye sclera', (.91,.91,.81), .23)
m['iris'] = material('Chestnut iris', (.26,.095,.027), .28)
m['irisLight'] = material('Iris amber flecks', (.29,.115,.032), .35)
m['pupil'] = material('Deep pupils', (.004,.003,.002), .12)
m['helmet'] = material('Enamel / sage helmet', (.235,.335,.175), .36, .08)
m['goggle'] = material('Goggle bronze frame', (.30,.27,.185), .35, .35)
m['lens'] = material('Smoked green lens', (.15,.29,.245), .13, .55)
m['cream'] = material('Warm white', (.85,.83,.69), .5)

def finish(ob, mat):
    ob.data.materials.append(mat)
    if ob.type == 'MESH':
        for p in ob.data.polygons: p.use_smooth = True
    return ob

def mesh(name, verts, faces, mat, sub=0):
    data = bpy.data.meshes.new(name)
    data.from_pydata(verts, [], faces)
    data.update()
    ob = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(ob)
    finish(ob, mat)
    if sub:
        mod = ob.modifiers.new('Sculpted surface', 'SUBSURF')
        mod.levels = sub
        mod.render_levels = sub
    return ob

def uv(name, loc, scale, mat, segments=32, rings=20):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, location=loc)
    ob = bpy.context.object
    ob.name = name
    ob.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish(ob, mat)

def box(name, loc, scale, mat, bevel=.04):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    ob = bpy.context.object
    ob.name = name
    ob.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    mod = ob.modifiers.new('Soft manufactured edges', 'BEVEL')
    mod.width = bevel
    mod.segments = 3
    mod = ob.modifiers.new('Weighted normals', 'WEIGHTED_NORMAL')
    return finish(ob, mat)

def loft(name, rings, mat, segments=32, sub=1):
    verts, faces = [], []
    for z,rx,ry,x,y in rings:
        for i in range(segments):
            a = i * math.tau / segments
            verts.append((x+rx*math.cos(a), y+ry*math.sin(a), z))
    for j in range(len(rings)-1):
        for i in range(segments):
            a=j*segments+i; b=j*segments+(i+1)%segments
            faces.append((a,b,b+segments,a+segments))
    faces.append(tuple(reversed(range(segments))))
    faces.append(tuple((len(rings)-1)*segments+i for i in range(segments)))
    return mesh(name, verts, faces, mat, sub)

def curve(name, points, radius, mat, closed=False):
    data = bpy.data.curves.new(name, 'CURVE')
    data.dimensions = '3D'
    data.resolution_u = 10
    data.bevel_depth = radius
    data.bevel_resolution = 3
    spline = data.splines.new('BEZIER')
    spline.bezier_points.add(len(points)-1)
    for p,co in zip(spline.bezier_points, points):
        p.co = co
        p.handle_left_type = p.handle_right_type = 'AUTO'
    spline.use_cyclic_u = closed
    ob = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(ob)
    ob.data.materials.append(mat)
    return ob

helpers = dict(uv=uv, box=box, loft=loft, curve=curve, mesh=mesh)

# Preserve the cheekbones and helmet fit, then gradually taper the lower jaw to
# a gently extended, rounded chin. The subtle V comes from a continuous surface,
# not pinched cheeks or a pointed chin attached to the original round head.
head = loft('Sculpt / rounded head', [
    (2.185,.03,.04,0,.025), (2.213,.175,.17,0,.015),
    (2.28,.259,.23,0,.006), (2.36,.335,.275,0,0),
    (2.46,.412,.309,0,.008), (2.57,.465,.326,0,.018),
    (2.71,.455,.331,0,.027), (2.86,.434,.318,0,.037),
    (2.98,.352,.265,0,.044), (3.045,.22,.19,0,.04),
    (3.074,.02,.03,0,.04),
], m['skin'], 64, 2)
for vertex in head.data.vertices:
    x,y,z = vertex.co
    if y < .027:
        front = max(0, -(y-.027)/.34)**2
        cheek = math.exp(-((abs(x)-.25)/.115)**2-((z-2.51)/.115)**2)
        muzzle = math.exp(-(x/.24)**2-((z-2.41)/.09)**2)
        vertex.co.y -= front*(.035*cheek + .032*muzzle)

# Join the nose to the face with a fine voxel union, then smooth the skin.
nose_parts = [head,
    uv('Nose bridge', (0,-.303,2.653), (.052,.047,.105), m['skin']),
    uv('Button nose', (0,-.372,2.574), (.078,.075,.054), m['skin']),
    uv('Nose wing L', (-.058,-.353,2.565), (.043,.039,.031), m['skin']),
    uv('Nose wing R', (.058,-.353,2.565), (.043,.039,.031), m['skin']),
]
bpy.ops.object.select_all(action='DESELECT')
for ob in nose_parts: ob.select_set(True)
bpy.context.view_layer.objects.active = head
# Evaluate subdivision before joining so its intended cheek profile is retained.
bpy.ops.object.convert(target='MESH')
bpy.ops.object.join()
head = bpy.context.object
rem = head.modifiers.new('Unified facial sculpt', 'REMESH')
rem.mode = 'VOXEL'; rem.voxel_size=.008; rem.use_smooth_shade=True
bpy.ops.object.modifier_apply(modifier=rem.name)
smooth = head.modifiers.new('Skin relaxation', 'SMOOTH'); smooth.factor=.62; smooth.iterations=5
bpy.ops.object.modifier_apply(modifier=smooth.name)
dec = head.modifiers.new('Study topology', 'DECIMATE'); dec.ratio=.55
bpy.ops.object.modifier_apply(modifier=dec.name)
for s in [-1,1]:
    uv('Ear', (s*.447,.026,2.598), (.073,.064,.124), m['skin'])
    uv('Ear concha', (s*.481,-.029,2.603), (.030,.014,.068), m['lip'])
    curve('Ear ridge', [(s*.485,-.043,2.55),(s*.499,-.047,2.61),(s*.480,-.035,2.659)], .012, m['skin'])
    uv('Nostril', (s*.046,-.393,2.543), (.014,.008,.009), m['lip'],24,12)

# Project the eye surfaces onto the actual sculpt, keeping outer corners in their
# sockets. A curved sclera and subtle central bulge avoid stuck-on spherical eyes.
tree = BVHTree.FromObject(head, bpy.context.evaluated_depsgraph_get())
def face_y(x,z):
    hit=tree.ray_cast(Vector((x,-2,z)),Vector((0,1,0)))[0]
    return hit.y if hit else -.24

def eye_disk(name,cx,cz,rx,rz,mat,surface,lower=1):
    cols=48;rows=10
    vs=[(cx,surface(cx,cz),cz)]
    for j in range(1,rows+1):
        r=j/rows
        for i in range(cols):
            a=i*math.tau/cols
            sy=math.sin(a)
            x=cx+rx*r*math.cos(a);z=cz+rz*r*sy*(lower if sy<0 else 1)
            vs.append((x,surface(x,z),z))
    fs=[]
    for i in range(cols):fs.append((0,1+i,1+(i+1)%cols))
    for j in range(rows-1):
        for i in range(cols):
            a=1+j*cols+i;b=1+j*cols+(i+1)%cols
            fs.append((a,a+cols,b+cols,b))
    ob=mesh(name,vs,fs,mat)
    # These front-facing surfaces need normals toward -Y in Blender.
    for p in ob.data.polygons:
        if p.normal.y>0:p.flip()
    return ob

# One aperture definition keeps sclera, eyelid and lash geometry aligned during
# face revisions. Horizontal -12%, vertical -15% relative to the initial study.
EYE_WIDTH = .106
EYE_HEIGHT = .102
EYE_LOWER = .82
for s in [-1,1]:
    cx=s*.19; cz=2.709
    def eye_y(x,z):
        r2=((x-cx)/EYE_WIDTH)**2+((z-cz)/(EYE_HEIGHT if z>=cz else EYE_HEIGHT*EYE_LOWER))**2
        return face_y(x,z)-.003-.021*max(0,1-r2)
    eye_disk('Eye white',cx,cz,EYE_WIDTH,EYE_HEIGHT,m['white'],eye_y,EYE_LOWER)
    eye_disk('Limbal ring',cx,cz+.003,.071,.074,m['hair'],lambda x,z:eye_y(x,z)-.003)
    eye_disk('Brown iris',cx,cz+.003,.067,.070,m['iris'],lambda x,z:eye_y(x,z)-.004)
    for i in range(28):
        a=i*math.tau/28
        pts=[]
        # Low-contrast, irregular fibers avoid a diagram-like clock-face iris.
        for r in [.037,.049,.060+.002*math.sin(i*2.7)]:
            x=cx+math.sin(a)*r;z=cz+math.cos(a)*r*1.12
            pts.append((x,eye_y(x,z)-.005,z))
        fiber=curve('Iris fiber',pts,.00045,m['irisLight'])
        fiber.data.resolution_u=3;fiber.data.bevel_resolution=1
    eye_disk('Pupil',cx,cz+.003,.039,.046,m['pupil'],lambda x,z:eye_y(x,z)-.007)
    x=cx-.020;z=cz+.034
    uv('Eye catchlight',(x,eye_y(x,z)-.01,z),(.010,.003,.013),m['white'],24,12)
    x=cx+.021;z=cz-.029
    uv('Eye small catchlight',(x,eye_y(x,z)-.009,z),(.0034,.002,.0043),m['white'],16,8)
    # A continuous thin skin fold merges back into the sculpt; no tube ends.
    vs=[];fs=[]
    for j in range(4):
        t=j/3;r=.993+.13*t
        for i in range(64):
            a=i*math.tau/64;sy=math.sin(a)
            x=cx+EYE_WIDTH*r*math.cos(a);z=cz+EYE_HEIGHT*r*sy*(EYE_LOWER if sy<0 else 1)
            y=face_y(x,z)-.006*(1-t)-.003*math.sin(math.pi*t)
            vs.append((x,y,z))
        if j:
            for i in range(64):fs.append(((j-1)*64+i,j*64+i,j*64+(i+1)%64,(j-1)*64+(i+1)%64))
    mesh('Sculpted continuous eyelid',vs,fs,m['skin'])
    top=[]
    for i in range(17):
        a=i*math.pi/16;x=cx+EYE_WIDTH*math.cos(a);z=cz+EYE_HEIGHT*math.sin(a)
        top.append((x,face_y(x,z)-.007,z))
    curve('Fine upper lash line',top,.0014,m['hair'])
    # Thick inner brow with a curved arch and a genuinely tapered temple end.
    vs=[];fs=[]
    for i in range(25):
        t=i/24;x=s*(.078+.253*t)
        z=2.839+.035*math.sin(math.pi*t)-.005*t
        width=.018*(1-.8*t)+.006*math.sin(math.pi*t)
        if i in (0,24):width*=.4
        for k in range(8):
            a=k*math.tau/8;zz=z+math.cos(a)*width
            vs.append((x,face_y(x,zz)-.01-math.sin(a)*.009,zz))
        if i:
            for k in range(8):fs.append(((i-1)*8+k,i*8+k,i*8+(k+1)%8,(i-1)*8+(k+1)%8))
    vs.append((s*.078,face_y(s*.078,2.839)-.01,2.839))
    vs.append((s*.331,face_y(s*.331,2.834)-.01,2.834))
    for k in range(8):
        fs.append((200,k,(k+1)%8));fs.append((201,192+(k+1)%8,192+k))
    mesh('Sculpted tapered eyebrow',vs,fs,m['hair'],1)

def mouth_y(x,z):
    return -.333 + .70*x*x + .12*(z-2.43)

def ribbon(name, upper, lower, mat):
    verts=[]; faces=[]
    for i in range(41):
        t=-1+2*i/40
        x=t*.193
        for fn in [upper,lower]:
            z=fn(t)
            verts.append((x,mouth_y(x,z),z))
        if i: faces.append((2*i-2,2*i,2*i+1,2*i-1))
    return mesh(name,verts,faces,mat)

ribbon('Sculpted smile opening',lambda t:2.448+.053*t*t,lambda t:2.369+.13*t*t,m['mouth'])
# One curved enamel strip with subtle divisions, no separate oversized teeth.
teeth=[]; faces=[]
for i in range(41):
    t=-1+2*i/40; x=t*.175
    top=2.447+.043*t*t; bottom=top-(.035*(1-t*t)+.008)
    for z in [top,bottom]: teeth.append((x,mouth_y(x,z)-.004,z))
    if i: faces.append((2*i-2,2*i,2*i+1,2*i-1))
mesh('Curved smile / upper teeth',teeth,faces,m['teeth'])
for x in [-.122,-.076,-.025,.025,.076,.122]:
    t=x/.175; z=2.447+.043*t*t
    curve('Tooth division',[(x,mouth_y(x,z)-.0045,z-.004),(x,mouth_y(x,z)-.0045,z-.025)],.0006,m['leatherLight'])
curve('Soft lower lip',[(t*.193,mouth_y(t*.193,2.366+.133*t*t)+.001,2.366+.133*t*t) for t in [-1,-.75,-.5,-.25,0,.25,.5,.75,1]], .009,m['lip'])
for s in [-1,1]:
    curve('Smile dimple',[(s*.184,-.309,2.478),(s*.205,-.293,2.497),(s*.223,-.277,2.493)],.004,m['lip'])

# Swept sculpted locks use a tapered elliptical tube along a Bézier path.
def lock(name,points,width,depth):
    p=[Vector(q) for q in points]
    vs=[]; fs=[]; rows=20; cols=12
    for j in range(rows+1):
        t=j/rows
        c=(1-t)**3*p[0]+3*(1-t)**2*t*p[1]+3*(1-t)*t*t*p[2]+t**3*p[3]
        tangent=(-3*(1-t)**2*p[0]+(3*(1-t)**2-6*(1-t)*t)*p[1]+(6*(1-t)*t-3*t*t)*p[2]+3*t*t*p[3]).normalized()
        side=tangent.cross(Vector((0,1,0))).normalized()
        normal=side.cross(tangent).normalized()
        taper=max(.025,math.sin(math.pi*(t*.88+.06)))**.6
        for i in range(cols):
            a=math.tau*i/cols
            vs.append(c+side*math.cos(a)*width*taper+normal*math.sin(a)*depth*taper)
        if j:
            for i in range(cols): fs.append(((j-1)*cols+i,(j-1)*cols+(i+1)%cols,j*cols+(i+1)%cols,j*cols+i))
    fs.append(tuple(reversed(range(cols))))
    fs.append(tuple(rows*cols+i for i in range(cols)))
    return mesh(name,vs,fs,m['hair'],1)

for i in range(5):
    x=.30-i*.108
    lock('Swept forehead lock',[(x+.04,-.223,3.04),(x+.04,-.317,3.015),(x-.016,-.345,2.965),(x-.13,-.309,2.923+(i%2)*.015)],.064,.032)
for s in [-1,1]:
    lock('Temple hair',[(s*.38,-.07,3.00),(s*.434,-.12,2.90),(s*.45,-.11,2.78),(s*.426,-.087,2.682)],.041,.027)

if CHARACTER == 'soldier':
    # Raised forehead opening with dipped side and rear protection.
    verts=[]; faces=[]; rows=22; cols=64
    for j in range(rows+1):
        t=j/rows; p=t*math.pi/2
        for i in range(cols):
            a=math.tau*i/cols; front=max(0,-math.sin(a))
            edge=2.79+.172*front**2; z=edge+(3.225-edge)*math.cos(p)
            verts.append((.492*math.sin(p)*math.cos(a),.05+.384*math.sin(p)*math.sin(a),z))
        if j:
            for i in range(cols):faces.append(((j-1)*cols+i,j*cols+i,j*cols+(i+1)%cols,(j-1)*cols+(i+1)%cols))
    helmet=mesh('Contoured helmet shell',verts,faces,m['helmet'],1)
    solid=helmet.modifiers.new('Helmet shell thickness','SOLIDIFY');solid.thickness=.025
    rim=[]
    for i in range(64):
        a=math.tau*i/64; front=max(0,-math.sin(a))
        rim.append((.494*math.cos(a),.05+.386*math.sin(a),2.79+.172*front*front))
    curve('Rolled helmet rim',rim,.013,m['clothDark'],True)
    strap=[]
    for i in range(32):
        a=math.tau*i/32
        strap.append((.464*math.cos(a),.05+.366*math.sin(a),3.04))
    curve('Goggle retention strap',strap,.033,m['leather'],True)
    for s in [-1,1]:
        cx=s*.22
        outline=[(-.172,-.062),(-.15,.072),(-.09,.112),(.104,.099),(.175,.048),(.17,-.072),(.102,-.096),(-.11,-.091)]
        coords=[(cx+x,-.375+.36*(cx+x)**2,3.117+z) for x,z in outline]
        lens=mesh('Goggle lens',coords,[tuple(range(len(coords)))],m['lens'])
        sol=lens.modifiers.new('Lens thickness','SOLIDIFY');sol.thickness=.012
        be=lens.modifiers.new('Lens roundover','BEVEL');be.width=.025;be.segments=4
        curve('Goggle rubber seal',coords,.031,m['dark'],True)
        curve('Bronze goggle frame',[(x,y-.012,z) for x,y,z in coords],.021,m['goggle'],True)
    curve('Goggle nose bridge',[(-.05,-.404,3.128),(0,-.428,3.137),(.05,-.404,3.128)],.023,m['goggle'])
    head_objects=set(bpy.context.scene.objects)
    from body import build_body
    build_body(helpers,m)
else:
    head_objects=set(bpy.context.scene.objects)
    from terrorist import build_terrorist
    build_terrorist(helpers,m,head,face_y)

character=[ob for ob in bpy.context.scene.objects if ob.type in {'MESH','CURVE'}]
for ob in character: ob['crossline_asset']=CHARACTER+'-study'

# Export a browser-viewable static study, deliberately not placed in public/models.
bpy.ops.object.select_all(action='DESELECT')
for ob in character: ob.select_set(True)
bpy.context.view_layer.objects.active=head
bpy.ops.export_scene.gltf(filepath=str(OUT/(CHARACTER+'-study.glb')),export_format='GLB',use_selection=True,export_apply=True,export_yup=True,export_cameras=False,export_lights=False,export_extras=True)
if args.production:
    from production import compile_character
    compile_character(character,head_objects,CHARACTER,ROOT)
if args.no_render:
    print('CHARACTER_EXPORT_COMPLETE',CHARACTER)
    sys.exit(0)

floor_mat=material('Studio / teal',(.032,.17,.16),.72)
box('Studio floor',(0,0,-.095),(200,200,.15),floor_mat,.03)
world=bpy.context.scene.world or bpy.data.worlds.new('Studio World')
bpy.context.scene.world=world;world.use_nodes=True
world.node_tree.nodes['Background'].inputs[0].default_value=(.13,.22,.23,1)
world.node_tree.nodes['Background'].inputs[1].default_value=.35

def area(name,loc,power,color,size,target=(0,0,1.8)):
    data=bpy.data.lights.new(name,'AREA');data.energy=power;data.color=color;data.shape='DISK';data.size=size
    ob=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(ob);ob.location=loc
    ob.rotation_euler=(Vector(target)-ob.location).to_track_quat('-Z','Y').to_euler()
area('Large warm key',(-3,-4.5,6),550,(1,.84,.67),4)
area('Soft blue fill',(3,-2.5,3.5),240,(.63,.82,1),3)
area('Top rim',(1.3,2.0,5),800,(.75,1,.93),3)
area('Eye softbox',(-.8,-4,3.4),40,(1,.96,.83),1)

data=bpy.data.cameras.new('Portrait camera');camera=bpy.data.objects.new('Portrait camera',data)
bpy.context.collection.objects.link(camera);bpy.context.scene.camera=camera
data.type='ORTHO';data.ortho_scale=3.65;data.lens=70
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=48;scene.cycles.use_denoising=True
scene.render.resolution_x=1000;scene.render.resolution_y=1250;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';scene.view_settings.view_transform='AgX'
scene.view_settings.look='AgX - Medium High Contrast'
scene.render.film_transparent=False
scene.render.image_settings.color_mode='RGB'
bpy.context.preferences.filepaths.save_version=0

def shot(name,loc,target,scale):
    camera.location=loc;camera.rotation_euler=(Vector(target)-camera.location).to_track_quat('-Z','Y').to_euler();data.ortho_scale=scale
    scene.render.filepath=str(OUT/name)
    bpy.ops.render.render(write_still=True)

camera.location=(4,-9,4.1);camera.rotation_euler=(Vector((0,0,1.63))-camera.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/(CHARACTER+'-study.blend')))
shot(CHARACTER+'-three-quarter.png',(4,-9,4.1),(0,0,1.63),3.65)
shot(CHARACTER+'-front.png',(0,-10,3.7),(0,0,1.63),3.65)
shot(CHARACTER+'-face.png',(2.6,-9,3.7),(0,-.02,2.69),1.28)
print('CHARACTER_STUDY_COMPLETE',CHARACTER,str(OUT))
