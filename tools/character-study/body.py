"""Reference-led Soldier body study. Z-up; the face/front points toward -Y.

This is deliberately separate from the shipping character builder. The supplied
helpers create smooth meshes; garment silhouettes come from shaped cross sections
rather than an assembly of round limb primitives.
"""

import bpy
import math
from mathutils import Vector


def build_body(h, m):
    before = set(bpy.context.scene.objects)
    raw_uv, raw_box, loft, raw_curve = (h[k] for k in ("uv", "box", "loft", "curve"))

    # The study's dimensions below are half extents; the shared Blender helper
    # takes full side lengths for its unit cube.
    def box(name, loc, scale, material, bevel=.04):
        return raw_box(name, loc, tuple(v*2 for v in scale), material, bevel=bevel)

    def uv(name, loc, scale, material):
        detail = max(scale) < .016
        return raw_uv(name, loc, scale, material,
                      segments=12 if detail else 24, rings=8 if detail else 14)

    def curve(name, points, radius, material):
        obj = raw_curve(name, points, radius, material)
        obj.data.resolution_u = 4 if radius < .01 else 6
        obj.data.bevel_resolution = 1 if radius < .01 else 2
        return obj
    skin, cloth = m["skin"], m["cloth"]
    light, shade = m["clothLight"], m["clothDark"]
    leather, leather_light = m["leather"], m["leatherLight"]
    metal, dark, orange, sole = (m[k] for k in ("metal", "dark", "orange", "sole"))

    def shell(name, rings, material, segments=28, sub=1):
        return loft(name, rings, material, segments=segments, sub=sub)

    def seam(name, points, material=leather_light, radius=.004):
        return curve(name, points, radius, material)

    def strap(name, points, width, material, thickness=.012, across=(1,0,0)):
        """A flat, padded ribbon with real thickness; no tubular webbing."""
        w = Vector(across).normalized()
        centers = [Vector(p) for p in points]
        verts, faces = [], []
        for i, center in enumerate(centers):
            tangent = centers[min(i+1,len(centers)-1)]-centers[max(i-1,0)]
            normal = tangent.normalized().cross(w).normalized()
            for dx, dz in ((-1,-1),(1,-1),(1,1),(-1,1)):
                v=center+w*width*.5*dx+normal*thickness*.5*dz
                verts.append(tuple(v))
        for j in range(len(centers)-1):
            for k in range(4):
                a=j*4+k; b=j*4+(k+1)%4
                faces.append((a,b,b+4,a+4))
        faces.extend(((3,2,1,0),tuple((len(centers)-1)*4+i for i in range(4))))
        ob=h["mesh"](name,verts,faces,material,sub=0)
        bevel=ob.modifiers.new("Soft webbing edges","BEVEL")
        bevel.width=.004
        bevel.segments=2
        return ob

    # A soft barrel chest, gathered waist and raised rear shoulders give the
    # jacket a readable shape even before the chest equipment is installed.
    shell("Shirt tailored torso", [
        [1.28,.32,.205,0,.015], [1.31,.35,.23,0,.014],
        [1.39,.35,.225,0,.008], [1.51,.345,.232,0,.005],
        [1.72,.41,.258,0,.02], [1.92,.475,.25,0,.025],
        [2.04,.465,.223,0,.033], [2.10,.30,.175,0,.035],
        [2.13,.18,.14,0,.035],
    ], cloth, 36, 1)
    shell("Warm exposed neck", [
        [2.05,.135,.125,0,.012], [2.13,.13,.12,0,.012],
        [2.23,.145,.128,0,.006], [2.32,.16,.138,0,.005],
    ], skin, 28, 1)
    # Folded collar halves flare away from a clean V opening.
    for s in (-1, 1):
        collar = box("Folded shirt collar", (s*.12,-.132,2.09),
                     (.092,.039,.135), light, bevel=.027)
        collar.rotation_euler[1] = s*-.39
        collar.rotation_euler[2] = s*.22
    seam("Shirt center placket", [(0,-.236,1.36),(0,-.265,1.70),
                                 (0,-.232,1.98),(0,-.15,2.045)], shade, .008)

    # Relaxed arms: the section centers move outward below each shoulder. The
    # forearm has a wrist taper, elbow fullness and a slightly flattened palm.
    for s, side in ((-1,"Left"),(1,"Right")):
        shell(side+" loose short sleeve", [
            [1.67,.148,.157,s*.584,.02], [1.70,.166,.166,s*.585,.02],
            [1.78,.168,.17,s*.572,.018], [1.89,.17,.176,s*.543,.02],
            [1.985,.172,.16,s*.485,.028], [2.025,.132,.128,s*.465,.035],
            [2.04,.07,.085,s*.439,.04],
        ], cloth, 28, 1)
        shell(side+" rolled sleeve cuff", [
            [1.665,.145,.157,s*.589,.02], [1.677,.173,.18,s*.588,.02],
            [1.711,.175,.181,s*.579,.02], [1.727,.159,.167,s*.574,.02],
        ], light, 28, 1)
        shell(side+" sculpted forearm", [
            [1.235,.085,.074,s*.705,-.014], [1.29,.091,.082,s*.698,-.01],
            [1.41,.12,.103,s*.675,.007], [1.55,.136,.12,s*.632,.015],
            [1.65,.128,.12,s*.603,.02], [1.69,.10,.097,s*.594,.02],
        ], skin, 32, 1)
        # The sleeve's folds are in the changing loft sections. Applied tubular
        # highlight strips would look detached under grazing studio light.

        shell(side+" fingerless glove palm", [
            [1.055,.09,.06,s*.72,-.043], [1.075,.106,.068,s*.72,-.04],
            [1.14,.107,.077,s*.718,-.027], [1.205,.091,.072,s*.71,-.017],
            [1.24,.082,.07,s*.706,-.014],
        ], leather, 28, 1)
        wrist = box(side+" glove wrist strap", (s*.706,-.018,1.238),
                    (.096,.087,.035), leather_light, bevel=.018)
        box(side+" glove strap keeper", (s*.706,-.11,1.24),
            (.058,.016,.029), dark, bevel=.009)
        box(side+" glove back reinforcement", (s*.719,-.108,1.151),
            (.069,.018,.057), shade, bevel=.025)
        for f in range(4):
            x = s*(.659+f*.039)
            length = [.067,.09,.085,.062][f]
            seam(side+" curled glove finger", [(x,-.072,1.085),
                (x,-.082,1.039),(x,-.055,1.075-length)], leather, .019)
            uv(side+" fingertip", (x,-.047,1.075-length),
               (.018,.022,.026), skin)
        seam(side+" folded thumb glove", [(s*.635,-.032,1.145),
            (s*.616,-.076,1.117),(s*.626,-.098,1.086)], leather,.027)
        uv(side+" thumb tip", (s*.637,-.091,1.074),(.026,.026,.031),skin)

    # Reference-inspired opened utility vest: rounded fabric equipment, deliberate
    # negative space at the center and a few high-contrast functional closures.
    for s, side in ((-1,"Left"),(1,"Right")):
        shell(side+" vest front panel", [
            [1.39,.123,.075,s*.184,-.237], [1.43,.15,.078,s*.184,-.24],
            [1.68,.163,.073,s*.196,-.265], [1.90,.16,.068,s*.213,-.254],
            [2.035,.115,.06,s*.226,-.172], [2.065,.086,.044,s*.228,-.121],
        ], leather, 24, 1)
        strap(side+" padded shoulder webbing", [(s*.278,.225,1.92),
            (s*.285,.21,2.0),(s*.275,.12,2.106),(s*.258,0,2.134),
            (s*.248,-.10,2.108),(s*.235,-.203,2.055),
            (s*.226,-.268,1.99),(s*.222,-.31,1.875)],
            .102,leather_light,.017)
        buckle = box(side+" shoulder strap buckle", (s*.226,-.286,1.966),
                     (.063,.022,.072), leather_light, bevel=.016)
        box(side+" shoulder buckle center", (s*.226,-.312,1.967),
            (.043,.009,.036), dark, bevel=.007)

        # Two magazine sleeves form one softly tailored chest pack per side.
        for n in range(2):
            x = s*(.114+n*.117)
            box(side+" upper magazine pouch", (x,-.352,1.817),
                (.051,.046,.098), leather, bevel=.021)
            box(side+" magazine pouch folded flap", (x,-.398,1.876),
                (.055,.014,.042), leather_light, bevel=.012)
            box(side+" magazine pull tab", (x,-.42,1.821),
                (.011,.009,.04), shade, bevel=.004)
        box(side+" lower cargo pouch", (s*.178,-.343,1.57),
            (.121,.070,.129), leather, bevel=.029)
        box(side+" cargo pouch top flap", (s*.178,-.413,1.653),
            (.128,.018,.054), leather_light, bevel=.018)
        box(side+" cargo pouch closure strap", (s*.178,-.438,1.594),
            (.025,.014,.064), leather_light, bevel=.008)
        box(side+" cargo pouch latch", (s*.178,-.455,1.57),
            (.022,.013,.027), metal, bevel=.006)
        pouch_stitch=seam(side+" cargo pouch stitching", [(s*(.178-.09),-.414,1.61),
            (s*(.178-.09),-.414,1.477),(s*(.178+.09),-.414,1.477),
            (s*(.178+.09),-.414,1.61)], leather_light,.002)
        for point in pouch_stitch.data.splines[0].bezier_points:
            point.handle_left_type=point.handle_right_type="VECTOR"

    # Exposed front fasteners and a single radio keep the vest asymmetrical.
    for z in (1.49,1.735):
        box("Vest horizontal clasp webbing", (0,-.305,z),(.069,.018,.023),shade,.008)
        box("Vest clasp", (0,-.329,z),(.031,.015,.027),leather_light,.007)
    box("Shoulder field radio", (-.355,-.245,1.96),(.069,.039,.099),dark,.025)
    for k in range(3):
        seam("Radio speaker groove", [(-.4,-.29,1.967+k*.017),
             (-.315,-.29,1.967+k*.017)], metal,.003)
    seam("Short radio aerial", [(-.398,-.225,2.023),
         (-.414,-.218,2.119)],dark,.008)

    patch = box("Orange shoulder identification patch", (.625,-.111,1.864),
                (.076,.020,.092),orange,bevel=.023)
    patch.rotation_euler[2] = -.35
    for z in (1.846,1.897):
        seam("Shoulder ivory chevron", [(.575,-.14,z-.013),
             (.615,-.151,z+.008),(.658,-.133,z-.012)],light,.007)

    # Narrow only the upper-body assembly, including hanging arms/hands. The
    # head and the subsequently constructed pelvis, legs and boots are untouched.
    for obj in [o for o in bpy.context.scene.objects if o not in before]:
        if obj.name == "Warm exposed neck":
            continue
        obj.location.x *= .90
        obj.scale.x *= .90

    # Hips and trousers are a single visual garment with subtly changing sections,
    # soft folds at the knee and a generous bloused ankle.
    shell("Trouser seat", [
        [1.10,.267,.201,0,.035], [1.16,.331,.225,0,.025],
        [1.27,.377,.241,0,.013], [1.39,.351,.219,0,.008],
        [1.425,.329,.199,0,.004],
    ],cloth,32,1)
    shell("Wide utility belt", [
        [1.365,.355,.234,0,0], [1.375,.368,.25,0,0],
        [1.435,.361,.243,0,0],[1.443,.35,.228,0,0],
    ],leather,32,1)
    box("Belt metal buckle",(0,-.262,1.405),(.068,.02,.043),metal,.011)
    box("Belt buckle inset",(0,-.286,1.405),(.043,.005,.025),dark,.005)
    for s, side in ((-1,"Left"),(1,"Right")):
        box(side+" belt loop",(s*.172,-.239,1.402),(.026,.022,.052),leather_light,.007)
        box(side+" belt utility pouch",(s*.291,-.216,1.355),
            (.063,.048,.094),leather,bevel=.018)
        box(side+" belt utility flap",(s*.291,-.265,1.409),
            (.067,.013,.036),leather_light,bevel=.012)
        uv(side+" belt pouch press stud",(s*.291,-.28,1.391),(.008,.004,.008),metal)
        shell(side+" shaped trouser leg", [
            [.399,.127,.129,s*.282,.007], [.439,.17,.157,s*.284,.012],
            [.475,.187,.166,s*.283,.014], [.53,.177,.16,s*.279,.019],
            [.605,.172,.169,s*.265,.026], [.715,.185,.181,s*.244,.005],
            [.79,.182,.181,s*.226,-.014], [.90,.192,.193,s*.218,.002],
            [1.05,.192,.195,s*.207,.02], [1.20,.187,.193,s*.192,.027],
            [1.25,.162,.18,s*.178,.03],
        ],cloth,28,1)
        shell(side+" tan reinforced knee panel", [
            [.656,.128,.031,s*.253,-.134], [.71,.166,.047,s*.242,-.163],
            [.80,.177,.052,s*.228,-.167], [.91,.165,.047,s*.224,-.145],
            [.986,.137,.032,s*.216,-.143],
        ],leather_light,24,1)
        shell(side+" rounded protective kneepad", [
            [.676,.082,.021,s*.244,-.20], [.699,.118,.043,s*.241,-.208],
            [.749,.13,.054,s*.236,-.219], [.817,.131,.052,s*.23,-.216],
            [.858,.107,.037,s*.224,-.20], [.87,.064,.016,s*.224,-.197],
        ],shade,28,1)
        for z in (.731,.816):
            for dx in (-.089,.089):
                uv(side+" kneepad recessed rivet",(s*.233+dx,-.25,z),
                   (.008,.004,.008),metal)
        strap(side+" flat knee strap", [(s*.12,-.145,.76),
             (s*.065,.012,.763),(s*.13,.165,.77),
             (s*.287,.18,.772),(s*.416,.045,.77),(s*.372,-.13,.765)],
             .043,leather,.008,across=(0,0,1))

        holster = box(side+" strapped thigh pocket", (s*.362,-.102,1.089),
                      (.069,.055,.111),leather,bevel=.021)
        holster.rotation_euler[1] = s*.13
        box(side+" thigh pocket flap",(s*.362,-.16,1.159),
            (.071,.012,.040),leather_light,bevel=.01)
        strap(side+" angled thigh webbing",[(s*.096,-.143,1.076),
            (s*.216,-.182,1.055),(s*.353,-.124,1.123)],
            .048,leather,.009,across=(0,0,1))

    # Broad front-heavy boots: the long forefoot is part of the loft silhouette,
    # not a ball glued to an ankle. Contrast separates sole, toe leather and gaiter.
    for s, side in ((-1,"Left"),(1,"Right")):
        x=s*.288
        shell(side+" continuous boot outsole", [
            [.024,.182,.295,x,-.077], [.029,.204,.316,x,-.078],
            [.076,.205,.317,x,-.078], [.089,.198,.31,x,-.078],
        ],sole,32,1)
        shell(side+" boot shaped leather upper", [
            [.083,.185,.297,x,-.077], [.11,.186,.29,x,-.078],
            [.16,.18,.27,x,-.067], [.212,.16,.232,x,-.046],
            [.265,.151,.187,x,-.018], [.34,.142,.15,x,.012],
            [.419,.145,.144,x,.018], [.441,.135,.131,x,.02],
        ],leather,32,1)
        shell(side+" rounded olive toe guard", [
            [.09,.159,.185,x,-.173], [.109,.177,.19,x,-.175],
            [.154,.177,.174,x,-.18], [.186,.144,.136,x,-.18],
            [.198,.084,.086,x,-.177],
        ],shade,28,1)
        shell(side+" boot folded padded tongue", [
            [.205,.094,.025,x,-.211], [.259,.089,.029,x,-.173],
            [.344,.077,.032,x,-.137], [.423,.08,.031,x,-.128],
        ],leather_light,24,1)
        shell(side+" cuff canvas gaiter", [
            [.414,.146,.144,x,.016], [.429,.154,.151,x,.016],
            [.468,.154,.148,x,.017], [.48,.142,.134,x,.019],
        ],shade,28,1)
        box(side+" boot ankle cinch",(x,-.133,.449),(.095,.024,.026),leather,.01)
        box(side+" boot ankle buckle",(x+s*.023,-.16,.45),(.024,.01,.026),metal,.007)
        left_lace=[]
        right_lace=[]
        fronts=[-.226,-.200,-.183,-.171,-.164]
        for row in range(5):
            z=.233+row*.038
            y=fronts[row]+.008
            width=.069-row*.003
            if row:
                left_lace.append((x,(fronts[row]+fronts[row-1])*.5-.004,z-.019))
                right_lace.append((x,(fronts[row]+fronts[row-1])*.5-.006,z-.019))
            left_lace.append((x+(-1 if row%2==0 else 1)*width,y-.004,z))
            right_lace.append((x+(1 if row%2==0 else -1)*width,y-.004,z))
            # A joined pair of eyelet flanges costs a single curve object.
            seam(side+" lace eyelet pair",[(x-width-.009,y+.004,z),
                (x-width,y-.01,z),(x-width+.009,y+.004,z)],metal,.004)
            seam(side+" opposite lace eyelet",[(x+width-.009,y+.004,z),
                (x+width,y-.01,z),(x+width+.009,y+.004,z)],metal,.004)
        for suffix,points in (("A",left_lace),("B",right_lace)):
            lace=seam(side+" taut crisscross lace "+suffix,points,leather_light,.004)
            for point in lace.data.splines[0].bezier_points:
                point.handle_left_type=point.handle_right_type="VECTOR"
        seam(side+" curved welt stitching",[(x-.14,-.265,.098),
            (x-.104,-.35,.10),(x,-.38,.10),(x+.104,-.35,.10),
            (x+.14,-.265,.098)],leather_light,.003)
        for d in (-.128,-.064,0,.064,.128):
            y=-.078-.316*math.sqrt(1-(d/.204)**2)-.001
            seam(side+" sole front traction groove",[(x+d,y,.033),
                 (x+d,y,.062)],dark,.006)

    # Rear silhouette and believable construction remain readable when running
    # away from camera; this is a tailored hydration carrier, not a box backpack.
    shell("Rear field pack",[[1.52,.17,.043,0,.233],[1.56,.205,.072,0,.258],
        [1.79,.211,.083,0,.26],[1.96,.188,.068,0,.245],[2.005,.14,.031,0,.22]],
        leather,32,1)
    for side in (-1,1):
        strap("Rear field pack webbing",[(side*.13,.296,1.96),(side*.14,.351,1.79),
            (side*.13,.327,1.57)],.046,leather_light,.012)
        box("Rear field pack clasp",(side*.13,.357,1.76),(.034,.013,.025),metal,.009)
    seam("Rear field pack piped seam",[(-.17,.3,1.93),(-.192,.34,1.74),
        (-.17,.312,1.57),(.17,.312,1.57),(.192,.34,1.74),(.17,.3,1.93)],shade,.007)
    # Fold ridges use broad shallow forms; no loose tubular lines on exposed skin.
    for s in (-1,1):
        for i in range(3):
            fold=uv("Trouser compression fold",(s*(.205+i*.013),.105,.87+i*.04),
                (.1-i*.011,.027,.012),shade)
            fold.rotation_euler[1]=s*.17
    created = [o for o in bpy.context.scene.objects if o not in before]
    # Join like-material tiny static details. The study does not need separate
    # transform nodes for every stitch, eyelet, strap stud and buckle surface.
    # Main garments remain distinct to make later sculpt edits straightforward.
    details = [o for o in created if any(word in o.name.lower() for word in
        ("rivet","press stud","eyelet","traction groove","speaker groove",
         "fingertip","thumb tip","stitched edge","stitching","chevron"))]
    buckets = {}
    for obj in details:
        material = obj.data.materials[0] if len(obj.data.materials) else None
        buckets.setdefault(material,[]).append(obj)
    for material, objects in buckets.items():
        if len(objects)<2:
            continue
        bpy.ops.object.select_all(action="DESELECT")
        for obj in objects:
            obj.select_set(True)
        bpy.context.view_layer.objects.active=objects[0]
        # Curve and mesh details must share a type before joining.
        bpy.ops.object.convert(target="MESH")
        bpy.ops.object.join()
        bpy.context.object.name="Soldier shared small details " + (material.name if material else "default")
    return [o for o in bpy.context.scene.objects if o not in before]
