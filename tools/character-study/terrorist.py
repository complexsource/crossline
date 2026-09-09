"""Rugged opposing character, sharing the approved Soldier face/proportions.

Editable Blender geometry, Z-up and facing -Y. Pattern shaders are intentionally
simple so the asset pipeline can bake them into a shared material atlas.
"""
import bpy
import bmesh
import math
from mathutils import Vector


def build_terrorist(h, m, head, face_y):
    from body import build_body
    before = set(bpy.context.scene.objects)
    mesh, loft, box, raw_uv, raw_curve = (h[k] for k in ("mesh", "loft", "box", "uv", "curve"))

    def variant(source, name, color, roughness=.75):
        mat=source.copy()
        mat.name=name
        mat.diffuse_color=(*color,1)
        bs=mat.node_tree.nodes.get("Principled BSDF")
        bs.inputs["Base Color"].default_value=(*color,1)
        bs.inputs["Roughness"].default_value=roughness
        return mat

    v=dict(m)
    v["cloth"]=variant(m["cloth"],"Rugged / warm linen",(.38,.265,.15))
    v["clothLight"]=variant(m["clothLight"],"Rugged / rolled linen",(.47,.35,.22))
    v["clothDark"]=variant(m["clothDark"],"Rugged / tobacco canvas",(.125,.089,.053))
    v["leather"]=variant(m["leather"],"Rugged / weathered brown leather",(.14,.085,.042))
    v["leatherLight"]=variant(m["leatherLight"],"Rugged / leather edges",(.28,.17,.081))
    v["dark"]=variant(m["dark"],"Rugged / dark glove leather",(.068,.045,.026),.69)
    v["sole"]=variant(m["sole"],"Rugged / worn brown sole",(.075,.047,.027),.84)
    pants=variant(m["cloth"],"Rugged / dark umber trousers",(.145,.101,.061))
    sash=variant(m["cloth"],"Rugged / faded burgundy sash",(.19,.074,.052),.85)
    patch=variant(m["cloth"],"Rugged / repaired canvas",(.22,.153,.089),.86)
    beard=variant(m["hair"],"Rugged / espresso beard",(.031,.016,.009),.60)
    beard_edge=variant(m["hairLight"],"Rugged / beard edge strands",(.050,.026,.013),.64)
    scarf=variant(m["cloth"],"Rugged / woven sand and umber scarf",(.40,.29,.17),.86)
    nodes=scarf.node_tree.nodes
    links=scarf.node_tree.links
    coords=nodes.new("ShaderNodeTexCoord")
    pattern=nodes.new("ShaderNodeTexBrick")
    pattern.inputs["Color1"].default_value=(.48,.355,.215,1)
    pattern.inputs["Color2"].default_value=(.069,.044,.026,1)
    pattern.inputs["Mortar"].default_value=(.34,.24,.14,1)
    pattern.inputs["Scale"].default_value=13
    pattern.inputs["Mortar Size"].default_value=.022
    pattern.inputs["Mortar Smooth"].default_value=.008
    pattern.inputs["Brick Width"].default_value=.70
    pattern.inputs["Row Height"].default_value=.42
    pattern.offset=.5
    pattern.offset_frequency=2
    # Uniform object-space triplanar weave. Generated coordinates normalize every
    # separate object independently; the drape's curved Y coordinate then made
    # the old XY-only brick pattern form concentric bands across its front.
    separate=nodes.new("ShaderNodeSeparateXYZ")
    links.new(coords.outputs["Object"],separate.inputs["Vector"])
    geometry=nodes.new("ShaderNodeNewGeometry")
    absolute=nodes.new("ShaderNodeVectorMath");absolute.operation="ABSOLUTE"
    links.new(geometry.outputs["Normal"],absolute.inputs[0])
    normals=nodes.new("ShaderNodeSeparateXYZ")
    links.new(absolute.outputs["Vector"],normals.inputs["Vector"])
    terms=[]
    for axis,order in (("X",("Y","Z","X")),("Y",("X","Z","Y")),("Z",("X","Y","Z"))):
        combine=nodes.new("ShaderNodeCombineXYZ")
        for target,source in zip(("X","Y","Z"),order):
            links.new(separate.outputs[source],combine.inputs[target])
        tex=pattern if axis=="Y" else nodes.new("ShaderNodeTexBrick")
        if tex!=pattern:
            for name in ("Color1","Color2","Mortar","Scale","Mortar Size","Mortar Smooth","Brick Width","Row Height"):
                tex.inputs[name].default_value=pattern.inputs[name].default_value
            tex.offset=.5;tex.offset_frequency=2
        links.new(combine.outputs["Vector"],tex.inputs["Vector"])
        weight=nodes.new("ShaderNodeVectorMath");weight.operation="SCALE"
        links.new(tex.outputs["Color"],weight.inputs[0])
        links.new(normals.outputs[axis],weight.inputs[3])
        terms.append(weight)
    add=nodes.new("ShaderNodeVectorMath");add.operation="ADD"
    links.new(terms[0].outputs[0],add.inputs[0]);links.new(terms[1].outputs[0],add.inputs[1])
    add2=nodes.new("ShaderNodeVectorMath");add2.operation="ADD"
    links.new(add.outputs[0],add2.inputs[0]);links.new(terms[2].outputs[0],add2.inputs[1])
    total=nodes.new("ShaderNodeVectorMath");total.operation="DOT_PRODUCT"
    links.new(absolute.outputs[0],total.inputs[0]);total.inputs[1].default_value=(1,1,1)
    inverse=nodes.new("ShaderNodeMath");inverse.operation="DIVIDE"
    inverse.inputs[0].default_value=1;links.new(total.outputs["Value"],inverse.inputs[1])
    final=nodes.new("ShaderNodeVectorMath");final.operation="SCALE"
    links.new(add2.outputs[0],final.inputs[0]);links.new(inverse.outputs[0],final.inputs[3])
    links.new(final.outputs[0],nodes.get("Principled BSDF").inputs["Base Color"])

    def uv(name,loc,scale,mat):
        return raw_uv(name,loc,scale,mat,segments=20,rings=12)

    def curve(name,pts,radius,mat,closed=False):
        ob=raw_curve(name,pts,radius,mat,closed)
        ob.data.resolution_u=4
        ob.data.bevel_resolution=1 if radius<.01 else 2
        return ob

    def solid(ob,thickness=.01):
        mod=ob.modifiers.new("Fabric edge thickness","SOLIDIFY")
        mod.thickness=thickness
        return ob

    # Retain the proven anatomical proportions and glove/boot forms, but remove
    # every soldier-specific vest, rigid knee assembly and unit identifier.
    body=build_body(h,v)
    remove=("rear field pack","vest","shoulder strap","shoulder buckle","padded shoulder", "magazine",
            "cargo pouch","field radio","radio ","identification", "chevron",
            "folded shirt collar","kneepad","knee panel","knee strap", "strapped thigh",
            "thigh pocket","angled thigh","glove back reinforcement")
    for ob in list(body):
        name=ob.name.lower()
        if any(term in name for term in remove):
            bpy.data.objects.remove(ob,do_unlink=True)
            continue
        if "shared small details" in name and ob.type=="MESH":
            # The body builder batches tiny fittings by material. Remove the old
            # shoulder/knee/vest fitting vertices without touching fingers/laces.
            mat=ob.data.materials[0] if ob.data.materials else None
            if mat!=v["skin"]:
                bm=bmesh.new();bm.from_mesh(ob.data)
                doomed=[vert for vert in bm.verts if (ob.matrix_world@vert.co).z>.55]
                bmesh.ops.delete(bm,geom=doomed,context="VERTS")
                bm.to_mesh(ob.data);bm.free()
                if not len(ob.data.vertices):
                    bpy.data.objects.remove(ob,do_unlink=True)
                    continue
        if "trouser" in name:
            ob.data.materials.clear();ob.data.materials.append(pants)
        elif "boot" in name or "gaiter" in name:
            if ob.data.materials and ob.data.materials[0] in (v["clothDark"],v["clothLight"]):
                ob.data.materials.clear();ob.data.materials.append(v["leatherLight"])
        elif "fingerless glove" in name or "glove finger" in name or "thumb glove" in name:
            ob.data.materials.clear();ob.data.materials.append(v["dark"])

    # A longer uneven shirt hem and two open, fitted suede waistcoat panels change
    # the torso silhouette; the chest is deliberately free of military magazines.
    vs=[];fs=[];cols=48
    for j in range(5):
        t=j/4
        for i in range(cols):
            a=math.tau*i/cols
            z=1.325-.225*t+.025*t*(math.sin(3*a)+.33*math.sin(11*a))
            rx=.306+.026*t;ry=.216+.025*t
            vs.append((rx*math.cos(a),.012+ry*math.sin(a),z))
            if j:
                p=(j-1)*cols+i;q=(j-1)*cols+(i+1)%cols
                fs.append((p,q,q+cols,p+cols))
    solid(mesh("Rugged untucked shirt hem",vs,fs,v["cloth"],1),.012)

    for s,side in ((-1,"Left"),(1,"Right")):
        rings=[(1.285,.07,.286,-.245),(1.39,.060,.321,-.267),
               (1.59,.055,.347,-.283),(1.81,.092,.379,-.279),
               (1.965,.147,.359,-.215),(2.06,.196,.270,-.141)]
        vs=[];fs=[];cols=10
        for j,(z,inner,outer,y) in enumerate(rings):
            for i in range(cols+1):
                t=i/cols;x=s*(inner+(outer-inner)*t)
                zz=z+.006*math.sin(i*1.7+j*.5)*(1 if j==0 else .2)
                yy=y-.026*math.sin(math.pi*t)
                vs.append((x,yy,zz))
                if j and i:
                    p=(j-1)*(cols+1)+i-1
                    fs.append((p,p+1,p+cols+2,p+cols+1))
        panel=solid(mesh(side+" rugged open waistcoat",vs,fs,v["leather"],1),.026)
        curve(side+" waistcoat stitched inner border",[(s*inner,y-.008,z+.008)
              for z,inner,outer,y in rings],.0025,v["leatherLight"])
        # Low-profile outer utility pockets, unlike the Soldier chest rig.
        box(side+" suede waistcoat pocket",(s*.237,-.314,1.50),(.17,.034,.135),v["leather"],.017)
        box(side+" waistcoat pocket lip",(s*.237,-.336,1.548),(.176,.016,.025),v["leatherLight"],.008)

    # Broad diagonal leather strap. Surface follows the torso instead of hovering.
    points=[(-.282,-.241,1.997),(-.17,-.303,1.83),(-.04,-.319,1.67),(.12,-.30,1.49),(.27,-.267,1.36)]
    vs=[];fs=[]
    for i,(x,y,z) in enumerate(points):
        for d in (-1,1):vs.append((x+d*.035,y-.022,z+d*.024))
        if i:fs.append((2*i-2,2*i-1,2*i+1,2*i))
    solid(mesh("Rugged diagonal equipment strap",vs,fs,v["leatherLight"],1),.014)
    buckle=box("Rugged cross strap buckle",(-.05,-.349,1.684),(.11,.024,.10),v["metal"],.012)
    buckle.rotation_euler[1]=-.57

    # Cloth waist wrap and an asymmetrical hanging sash, with a worn, irregular hem.
    loft("Rugged burgundy waist sash",[(1.328,.333,.232,0,.006),(1.35,.343,.246,0,.006),
         (1.407,.344,.245,0,.009),(1.45,.328,.231,0,.014)],sash,40,1)
    for row in range(2):
        pts=[]
        for i in range(25):
            a=math.tau*i/24
            pts.append((.345*math.cos(a),.006+.248*math.sin(a),1.356+row*.048+.008*math.sin(2*a)))
        curve("Rugged sash overlapping fold",pts,.004,sash,True)
    vs=[];fs=[];rows=14;cols=8
    for j in range(rows+1):
        t=j/rows;cx=-.285-.027*math.sin(t*math.pi)
        width=.084*(1-.2*t)
        for i in range(cols+1):
            u=i/cols*2-1
            x=cx+width*u;z=1.385-.53*t+.018*t*t*math.sin(u*9)
            y=-.276-.020*math.sin(t*8+u*2)-.018*t
            vs.append((x,y,z))
            if j and i:
                p=(j-1)*(cols+1)+i-1;fs.append((p,p+1,p+cols+2,p+cols+1))
    solid(mesh("Left rugged hanging waist sash",vs,fs,sash,1),.007)

    # Soft sewn repairs replace armor, and overlapping wraps identify rugged boots.
    for s,side in ((-1,"Left"),(1,"Right")):
        x=s*.245
        repair=box(side+" stitched trouser repair",(x,-.174,.89),(.20,.014,.16),patch,.025)
        repair.rotation_euler[1]=s*.13
        for i in range(4):
            xx=x-.075+i*.05
            curve(side+" trouser repair stitch",[(xx,-.188,.953),(xx+.009,-.188,.972)],.0018,v["clothLight"])
        for k in range(3):
            z=.448+k*.027
            pts=[(s*.288+.15*math.cos(a),.018+.156*math.sin(a),z+.007*math.sin(a*2+k))
                 for a in [i*math.tau/24 for i in range(25)]]
            curve(side+" rugged ankle cloth wrap",pts,.009,v["clothLight"],True)

    # Headwrap: a soft cap plus genuinely layered fabric bands, not a recolored
    # helmet. Front edge exposes the approved dark fringe and eyebrows.
    vs=[];fs=[];rows=18;cols=56
    for j in range(rows+1):
        p=(j/rows)*math.pi/2
        for i in range(cols):
            a=math.tau*i/cols
            bottom=2.93+.07*max(0,-math.sin(a))
            x=.489*math.sin(p)*math.cos(a)
            y=.045+.355*math.sin(p)*math.sin(a)
            z=bottom+(3.267-bottom)*math.cos(p)+.004*math.sin(a*9)*math.sin(p)
            vs.append((x,y,z))
            if j:
                q=(j-1)*cols+i;r=(j-1)*cols+(i+1)%cols
                fs.append((q,r,r+cols,q+cols))
    solid(mesh("Headwrap soft woven crown",vs,fs,scarf,1),.016)
    for layer in range(3):
        vs=[];fs=[];cols=64;rows=6
        for j in range(rows+1):
            vj=j/rows-.5
            for i in range(cols):
                a=math.tau*i/cols
                z=2.987+layer*.078+.040*math.cos(a+.55*layer)+vj*(.078 if layer<2 else .068)
                bottom=2.93+.07*max(0,-math.sin(a))
                elevation=max(0,min(.98,(z-bottom)/(3.267-bottom)))
                radial=math.sqrt(1-elevation*elevation)
                rx=.489*radial+.007+.007*math.cos(vj*math.pi)
                ry=.355*radial+.008+.006*math.cos(vj*math.pi)
                vs.append((rx*math.cos(a),.044+ry*math.sin(a),z+.005*math.sin(a*13+vj*4)))
                if j:
                    q=(j-1)*cols+i;r=(j-1)*cols+(i+1)%cols
                    fs.append((q,r,r+cols,q+cols))
        solid(mesh("Headwrap overlapping cloth band "+str(layer),vs,fs,scarf,1),.010)

    # A broad fabric tail falls behind one ear and shoulder, adding a distinct
    # asymmetrical silhouette without crossing or hiding the expression.
    vs=[];fs=[];rows=18;cols=8
    for j in range(rows+1):
        t=j/rows;cx=.438+.014*math.sin(math.pi*t)-.14*(t**1.6)
        for i in range(cols+1):
            u=i/cols*2-1
            width=(.056+.013*math.sin(math.pi*t))*(1-.28*t)
            x=cx+u*width
            y=.13+.17*t+.06*math.sin(math.pi*t)
            y+=.026*math.sin(u*math.pi*2+t*3)*(.5+.5*math.sin(math.pi*t))
            z=3.01-.81*t+t*t*(.026*math.sin(u*4.3)+.007*math.sin(u*13))
            vs.append((x,y,z))
            if j and i:
                q=(j-1)*(cols+1)+i-1;fs.append((q,q+1,q+cols+2,q+cols+1))
    solid(mesh("Headwrap draped side tail",vs,fs,scarf,1),.009)

    # Neck scarf ring and triangular chest drape: the material pattern follows the
    # actual folds and is later baked; no reference photograph is used as a decal.
    vs=[];fs=[];cols=56;rows=8
    for j in range(rows+1):
        t=j/rows
        for i in range(cols):
            a=math.tau*i/cols
            rx=.244+.045*math.sin(t*math.pi);ry=.185+.048*math.sin(t*math.pi)
            z=2.055+.173*t+.025*math.sin(a+.3)
            vs.append((rx*math.cos(a),.005+ry*math.sin(a),z))
            if j:
                q=(j-1)*cols+i;r=(j-1)*cols+(i+1)%cols
                fs.append((q,r,r+cols,q+cols))
    solid(mesh("Scarf folded neck wrap",vs,fs,scarf,1),.013)
    vs=[];fs=[];rows=16;cols=18
    for j in range(rows+1):
        t=j/rows;width=.305*(1-t)+.019*t
        for i in range(cols+1):
            u=i/cols*2-1
            x=width*u-.036*t
            z=2.139-.345*t+.031*(abs(u)**1.7)*(1-t)
            y=-.282-.087*(1-u*u)-.011*math.sin(t*9+u*3)
            y-=.018*math.sin(t*math.pi)
            vs.append((x,y,z))
            if j and i:
                q=(j-1)*(cols+1)+i-1;fs.append((q,q+1,q+cols+2,q+cols+1))
    solid(mesh("Scarf triangular chest drape",vs,fs,scarf,1),.009)
    for side in (-1,1):
        for j in range(8):
            t=.12+j*.105;width=.305*(1-t)+.019*t
            x=side*width-.036*t;z=2.139-.345*t+.031*(1-t)
            y=-.283-.011*math.sin(t*9+side*3)
            curve("Scarf short woven fringe",[(x,y,z),(x+side*.011,y-.004,z-.021)],.0016,v["clothLight"])

    # A fitted face-surface beard preserves the approved jaw and leaves the smile
    # opening clear. The sideburn boundary rises smoothly toward the temples.
    vs=[];fs=[]
    def beard_limits(x):
        a=abs(x)/.405
        low=2.211+.25*(a**1.7)
        high=2.339+.326*(a**1.38)
        return low,high
    # Copy the actual lower-head surface, including the rounded underside. A
    # projected front-only patch stopped short of the jaw and exposed a bare band.
    selected=[];lookup={};densities=[]
    def density_at(co):
        x,y,z=co
        _,high=beard_limits(min(.405,abs(x)))
        # A soft irregular boundary suggests small hairs, not a razor-cut mask.
        high+=.003*math.sin(x*155)+.002*math.sin(x*263)
        return max(0,min(1,(high-z+.008)/.023))
    for poly in head.data.polygons:
        coords_local=[head.data.vertices[i].co for i in poly.vertices]
        if all(p.z<2.67 and p.y<.175 and abs(p.x)<.455 and density_at(p)>0 for p in coords_local):
            selected.append(poly)
    for poly in selected:
        face=[]
        for idx in poly.vertices:
            if idx not in lookup:
                vertex=head.data.vertices[idx]
                density=density_at(vertex.co)
                point=head.matrix_world@(vertex.co+vertex.normal*(.002+.013*density))
                lookup[idx]=len(vs);vs.append(tuple(point));densities.append(density)
            face.append(lookup[idx])
        fs.append(tuple(face))
    beard_ob=mesh("Beard fitted cheek and rounded chin",vs,fs,beard)
    colors=beard_ob.data.color_attributes.new(name="Beard soft hairline",type="FLOAT_COLOR",domain="POINT")
    base=tuple(m["skin"].node_tree.nodes.get("Principled BSDF").inputs["Base Color"].default_value[:3])
    for i,density in enumerate(densities):
        x,y,z=vs[i]
        t=density*density*(3-2*density)
        variation=.88+.12*math.sin(x*181+z*91)
        dark=(.031*variation,.016*variation,.009*variation)
        colors.data[i].color=(*(base[c]*(1-t)+dark[c]*t for c in range(3)),1)
    moustache_material=beard.copy();moustache_material.name="Rugged / soft espresso moustache"
    attr=beard.node_tree.nodes.new("ShaderNodeVertexColor");attr.layer_name=colors.name
    beard.node_tree.links.new(attr.outputs["Color"],beard.node_tree.nodes.get("Principled BSDF").inputs["Base Color"])
    # Fine, sparse surface strands soften the perimeter instead of rigid hair tubes.
    for i in range(34):
        x=-.39+.78*i/33
        lo,hi=beard_limits(x)
        pts=[]
        for k in range(3):
            z=hi-.014-k*.014;xx=x*(1-.014*k)
            pts.append((xx,face_y(xx,z)-.014,z))
        curve("Beard fine edge strand",pts,.0008,beard_edge)
    for side in (-1,1):
        vs=[];fs=[];cols=24;rows=4
        for j in range(rows+1):
            vj=j/rows
            for i in range(cols+1):
                t=i/cols;x=side*(.012+.202*t)
                lower=2.457+.053*(abs(x)/.193)**2
                height=.0375*(math.sin(math.pi*(.08+.87*t))**.65)
                z=lower+height*vj
                y=face_y(x,z)-.010-.013*math.sin(math.pi*vj)
                vs.append((x,y,z))
                if j and i:
                    q=(j-1)*(cols+1)+i-1;fs.append((q,q+1,q+cols+2,q+cols+1))
        ob=mesh("Moustache tapered upper lip "+str(side),vs,fs,moustache_material,1)
        for p in ob.data.polygons:
            if p.normal.y>0:p.flip()

    # An asymmetrical worn canvas satchel distinguishes the rear silhouette from
    # the Soldier's compact symmetrical hydration carrier.
    loft("Rugged rear satchel",[[1.38,.12,.045,.19,.236],[1.42,.174,.082,.19,.267],
        [1.67,.178,.087,.19,.267],[1.73,.16,.065,.19,.25]],v["clothDark"],28,1)
    flap=box("Rugged satchel rounded flap",(.19,.34,1.688),(.32,.034,.094),patch,bevel=.028)
    box("Rugged satchel closure",(.19,.368,1.56),(.046,.024,.125),v["leatherLight"],bevel=.008)
    box("Rugged satchel buckle",(.19,.387,1.548),(.058,.012,.038),m["metal"],bevel=.006)
    pts=[(-.24,.19,2.055),(-.15,.268,1.91),(.0,.3,1.76),(.17,.316,1.65)]
    verts=[]
    for x,y,z in pts: verts.extend([(x-.025,y,z+.018),(x+.025,y,z-.018)])
    solid(mesh("Rugged satchel diagonal webbing",verts,[(i,i+1,i+3,i+2) for i in (0,2,4)],v["leatherLight"],1),.012)
    return [o for o in bpy.context.scene.objects if o not in before]
