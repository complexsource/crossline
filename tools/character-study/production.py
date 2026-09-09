"""Bake the approved character into a compact, single-material source mesh.

Vertex binding tags survive joining/UV baking. The Node character compiler turns
them into a real glTF skin, identity-axis bones, locomotion clips and LODs.
"""
import bpy
import math
import json

JOINTS=['body','head','arm0','elbow0','wrist0','arm1','elbow1','wrist1',
        'leg0','knee0','ankle0','leg1','knee1','ankle1',
        *['finger%d_%d'%(s,f) for s in range(2) for f in range(4)]]

def mix(a,b,t):
    t=max(0,min(1,t))
    return JOINTS.index(a),JOINTS.index(b),t

def binding(name,p,is_head):
    x,y,z=p; ax=abs(x); side=0 if x>0 else 1
    lower_name=name.lower()
    if is_head or any(k in name.lower() for k in ['headwrap','head wrap','beard','moustache','mustache']):
        return mix('head','head',0)
    if 'neck' in name.lower() and ax<.18:
        return mix('body','head',(z-2.12)/.12)
    if any(k in lower_name for k in ['wrist strap','glove strap','glove back','fingerless glove','thumb glove','thumb tip']):
        return mix('wrist'+str(side),'wrist'+str(side),0)
    if any(k in lower_name for k in ['padded shoulder','shoulder buckle','shoulder strap','field radio']):
        return mix('body','body',0)
    # Authoring components overlap the torso in the relaxed pose. Classify whole
    # sleeves/forearms semantically, rather than cutting their inner vertices at
    # abs(x)=.46: that hard cut creates stretched triangles when the arm lifts.
    if 'sculpted forearm' in lower_name:
        if z<1.50:
            # The glove and forearm meet at Z1.235. Keep their shared seam fully
            # on the wrist and spread twist through the lower forearm, not its cap.
            return mix('wrist'+str(side),'elbow'+str(side),(z-1.30)/.20)
        return mix('elbow'+str(side),'arm'+str(side),(z-1.51)/.16)
    if 'short sleeve' in lower_name or 'sleeve cuff' in lower_name:
        return mix('arm'+str(side),'body',(z-1.99)/.09)
    if 'untucked shirt hem' in lower_name:
        return mix('body','body',0)
    if 'trouser seat' in lower_name:
        # A shared pelvis crosses X=0. Fade to the hip there rather than assigning
        # immediately adjacent central vertices to opposite rotating thighs.
        influence=min(1,ax/.18)*max(0,min(1,(1.29-z)/.16))
        return mix('body','leg'+str(side),influence)
    # Hands and sleeve seams may have been merged by material in the art study.
    if ax>.46 and 0.93<z<1.77:
        # Include the complete innermost fingertip, not only its outer half.
        # Its centre is .593 but its radius reaches .577; clipping at .584
        # pinned neighbouring vertices to different transforms during gripping.
        if z<1.085 and ax>.54:
            f=min(range(4),key=lambda i:abs(ax-(.659+i*.039)*.9))
            return mix('wrist'+str(side),'finger%d_%d'%(side,f),(1.096-z)/.045)
        if z<1.30:
            return mix('wrist'+str(side),'elbow'+str(side),(z-1.18)/.12)
        if z<1.67:
            return mix('elbow'+str(side),'arm'+str(side),(z-1.51)/.16)
        return mix('arm'+str(side),'body',max(0,(.465-ax)/.065))
    if z<1.29:
        if z<.42:
            return mix('ankle'+str(side),'knee'+str(side),(z-.30)/.12)
        if z<.85:
            return mix('knee'+str(side),'leg'+str(side),(z-.69)/.16)
        return mix('leg'+str(side),'body',(z-1.13)/.16)
    return mix('body','body',0)

def compile_character(objects,head_objects,character,root):
    out=root/'art'/'characters';out.mkdir(parents=True,exist_ok=True)
    deps=bpy.context.evaluated_depsgraph_get();copies=[];materials={}
    for original in objects:
        evaluated=original.evaluated_get(deps)
        data=bpy.data.meshes.new_from_object(evaluated,depsgraph=deps)
        if not data.polygons:
            bpy.data.meshes.remove(data);continue
        ob=bpy.data.objects.new(original.name,data)
        bpy.context.collection.objects.link(ob)
        ob.matrix_world=original.matrix_world.copy()
        bpy.context.view_layer.objects.active=ob
        bpy.ops.object.select_all(action='DESELECT');ob.select_set(True)
        bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
        # Keep the approved face silhouette; decorative geometry gets a stronger LOD.
        ratio=.80 if 'Sculpt /' in original.name else .45 if any(k in original.name for k in ['Eye','iris','eyebrow','smile','teeth']) else .28
        if len(data.polygons)>80:
            dec=ob.modifiers.new('Game topology','DECIMATE');dec.ratio=ratio
            bpy.ops.object.modifier_apply(modifier=dec.name)
        tri=ob.modifiers.new('Stable skin triangles','TRIANGULATE')
        bpy.ops.object.modifier_apply(modifier=tri.name)
        for i,mat in enumerate(ob.data.materials):
            if mat.name not in materials:materials[mat.name]=mat.copy()
            ob.data.materials[i]=materials[mat.name]
        names=['_RIG_A','_RIG_B','_RIG_BLEND','_FACE_UV']
        for name in names:ob.data.attributes.new(name,'FLOAT','POINT')
        # Adding a CustomData layer can invalidate earlier RNA references when
        # a mesh already contains color attributes (the Terrorist beard does).
        attrs=[ob.data.attributes[name] for name in names]
        for v in ob.data.vertices:
            values=(*binding(original.name,v.co,original in head_objects),1 if 'Sculpt /' in original.name else 0)
            for attr,value in zip(attrs,values):attr.data[v.index].value=value
        copies.append(ob)
    bpy.ops.object.select_all(action='DESELECT')
    for ob in copies:ob.select_set(True)
    bpy.context.view_layer.objects.active=copies[0]
    bpy.ops.object.join();baked=bpy.context.object;baked.name=character+'-atlas-source'
    for ob in objects:ob.hide_render=True
    bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(66),island_margin=.005,area_weight=.4,scale_to_bounds=True)
    bpy.ops.object.mode_set(mode='OBJECT')
    # Give the continuous facial sculpt a continuous cylindrical UV chart. Smart
    # projection breaks the remeshed nose into sub-texel islands, leaving dark
    # unbaked specks even in pure albedo. Reserve the left third of the atlas for
    # this chart; the seam is behind the head, not through the nose or cheeks.
    uv=baked.data.uv_layers.active.data
    face_flags=baked.data.attributes['_FACE_UV']
    for poly in baked.data.polygons:
        if all(face_flags.data[i].value>.5 for i in poly.vertices):
            coords=[]
            for loop_id in poly.loop_indices:
                p=baked.data.vertices[baked.data.loops[loop_id].vertex_index].co
                coords.append((.5+math.atan2(p.x,.027-p.y)/math.tau,(p.z-2.17)/.93))
            crosses=max(p[0] for p in coords)-min(p[0] for p in coords)>.5
            for loop_id,(u,v) in zip(poly.loop_indices,coords):
                if crosses and u<.5:u+=1
                uv[loop_id].uv=(.012+.325*u,.025+.95*max(0,min(1,v)))
        else:
            for loop_id in poly.loop_indices:
                u,v=uv[loop_id].uv
                uv[loop_id].uv=(.365+.625*u,.005+.99*v)
    baked.data.attributes.remove(face_flags)
    scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=8
    scene.render.bake.margin=6;scene.render.bake.use_clear=True
    images={}
    for kind,size in [('color',2048),('normal',1024),('orm',1024)]:
        img=bpy.data.images.new(character+'-'+kind,width=size,height=size,alpha=False)
        if kind!='color':img.colorspace_settings.name='Non-Color'
        images[kind]=img
        for mat in baked.data.materials:
            nodes=mat.node_tree.nodes
            tex=nodes.get('Bake target') or nodes.new('ShaderNodeTexImage');tex.name='Bake target';tex.image=img;nodes.active=tex
        if kind=='color':
            # Bake pure albedo, independent of diffuse/subsurface/metal BSDFs.
            # Diffuse-color baking left black fragments on the unified nose and
            # dulled metallic gear. Emission also preserves linked scarf/beard art.
            restore=[]
            for mat in baked.data.materials:
                nodes=mat.node_tree.nodes;links=mat.node_tree.links
                shader=nodes.get('Principled BSDF');output=nodes.get('Material Output')
                old=output.inputs['Surface'].links[0].from_socket
                emission=nodes.new('ShaderNodeEmission')
                base=shader.inputs['Base Color']
                if base.is_linked:links.new(base.links[0].from_socket,emission.inputs['Color'])
                else:emission.inputs['Color'].default_value=base.default_value
                links.new(emission.outputs[0],output.inputs['Surface'])
                restore.append((mat,old,output,emission))
            bpy.ops.object.bake(type='EMIT')
            for mat,old,output,emission in restore:
                mat.node_tree.links.new(old,output.inputs['Surface'])
                mat.node_tree.nodes.remove(emission)
        elif kind=='normal':
            bpy.ops.object.bake(type='NORMAL',normal_space='TANGENT')
        else:
            for mat in baked.data.materials:
                nodes=mat.node_tree.nodes;links=mat.node_tree.links
                shader=nodes.get('Principled BSDF');output=nodes.get('Material Output')
                emission=nodes.new('ShaderNodeEmission')
                # Short-range contact occlusion gives collars, pouch flaps and
                # facial creases depth without painting directional shadows in
                # the albedo. AO is packed in R; roughness/metalness stay G/B.
                ao=nodes.new('ShaderNodeAmbientOcclusion');ao.samples=16
                ao.inputs['Distance'].default_value=.14
                channels=nodes.new('ShaderNodeCombineColor')
                links.new(ao.outputs['AO'],channels.inputs['Red'])
                channels.inputs['Green'].default_value=shader.inputs['Roughness'].default_value
                channels.inputs['Blue'].default_value=shader.inputs['Metallic'].default_value
                links.new(channels.outputs[0],emission.inputs['Color'])
                links.new(emission.outputs[0],output.inputs['Surface'])
            bpy.ops.object.bake(type='EMIT')
        img.filepath_raw=str(out/(character+'-'+kind+'.png'));img.file_format='PNG';img.save();img.pack()
    atlas=bpy.data.materials.new(character+' / baked tactical atlas');atlas.use_nodes=True
    nodes=atlas.node_tree.nodes;links=atlas.node_tree.links;shader=nodes.get('Principled BSDF')
    for kind in ['color','normal','orm']:
        tex=nodes.new('ShaderNodeTexImage');tex.image=images[kind];tex.label=kind
        if kind=='color':links.new(tex.outputs['Color'],shader.inputs['Base Color'])
        elif kind=='normal':
            norm=nodes.new('ShaderNodeNormalMap');links.new(tex.outputs['Color'],norm.inputs['Color']);links.new(norm.outputs['Normal'],shader.inputs['Normal'])
        else:
            separate=nodes.new('ShaderNodeSeparateColor');links.new(tex.outputs['Color'],separate.inputs['Color'])
            links.new(separate.outputs['Green'],shader.inputs['Roughness']);links.new(separate.outputs['Blue'],shader.inputs['Metallic'])
    baked.data.materials.clear();baked.data.materials.append(atlas)
    for poly in baked.data.polygons:poly.material_index=0
    baked['crosslineRigJointOrder']=JOINTS
    bpy.ops.export_scene.gltf(filepath=str(out/(character+'-source.glb')),export_format='GLB',use_selection=True,export_apply=True,export_yup=True,export_attributes=True,export_extras=True,export_cameras=False,export_lights=False)
    (out/(character+'-source.json')).write_text(json.dumps({'jointOrder':JOINTS,'triangles':len(baked.data.polygons),'vertices':len(baked.data.vertices),'source':'Blender baked approved character; not a production skin until tools/build-characters.js runs'},indent=2)+'\n')
    bpy.data.objects.remove(baked,do_unlink=True)
    for ob in objects:ob.hide_render=False
    print('BAKED_CHARACTER_COMPLETE',character)
