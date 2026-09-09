import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { coastalMaterial } from "./coastal-materials.js";
import { COASTLINE } from "../shared/maps.js";
import { box, cylinder, ellipsoid, material, joint, bake } from "./geometry.js";
import { wire, ring } from "./equipment.js";
import {
  buildingMaterial,
  decorateBuilding,
  decorateCoast,
  coastalPalm,
  tacticalLandmark,
  foliage,
} from "./coastal-art.js";

const stone = coastalMaterial("plaster"),
  trim = material(0xd5c299),
  iron = material(0x344d4c, 0.5),
  wood = coastalMaterial("wood"),
  roof = material(0xb86944);
function arch(parent, x, y, z, width, height, depth, color = 0xe9daba) {
  const r = width / 2,
    shape = new THREE.Shape();
  shape.moveTo(-r - 0.19, -height);
  shape.lineTo(-r - 0.19, 0);
  shape.absarc(0, 0, r + 0.19, Math.PI, 0, true);
  shape.lineTo(r + 0.19, -height);
  shape.lineTo(r, -height);
  shape.lineTo(r, 0);
  shape.absarc(0, 0, r, 0, Math.PI, false);
  shape.lineTo(-r, -height);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelSize: 0.035,
    bevelThickness: 0.02,
    bevelSegments: 1,
    curveSegments: 16,
  });
  const mesh = new THREE.Mesh(geo, material(color));
  mesh.position.set(x, y, z - depth / 2);
  mesh.castShadow = mesh.receiveShadow = true;
  mesh.userData.ownedGeometry = true;
  parent.add(mesh);
  return mesh;
}
function windowFrame(parent, x, y, z, accent) {
  box(parent, x, y, z, 0.91, 1.16, 0.06, trim, 0, 0.035);
  const glazing = material(0x234e61, 0.45);
  glazing.roughness = 0.22;
  box(parent, x, y, z - 0.045, 0.69, 0.94, 0.015, glazing, 0, 0.045);
  for (const s of [-1, 1]) {
    box(parent, x + s * 0.27, y + 0.12, z - 0.057, 0.02, 0.63, 0.014, 0x75a4aa);
    box(parent, x, y + s * 0.49, z - 0.058, 0.72, 0.045, 0.03, 0xb9b18c);
  }
  box(parent, x, y, z - 0.06, 0.045, 0.98, 0.028, trim);
  box(parent, x, y + 0.03, z - 0.06, 0.72, 0.04, 0.03, trim);
  for (const s of [-1, 1]) {
    const shutter = joint(parent, x + s * 0.58, y, z - 0.065);
    shutter.rotation.y = s * -0.25;
    box(shutter, 0, 0, 0, 0.35, 1.08, 0.05, accent, 0, 0.018);
    for (let i = 0; i < 7; i++)
      box(
        shutter,
        0,
        -0.42 + i * 0.135,
        -0.03,
        0.295,
        0.04,
        0.015,
        material(accent).color.clone().multiplyScalar(0.78).getHex(),
      );
    for (const yy of [-0.39, 0.37]) {
      box(shutter, 0, yy, -0.05, 0.32, 0.035, 0.035, 0x3f5756);
      ellipsoid(shutter, -0.12, yy, -0.075, 0.02, 0.019, 0.011, 0xb8ab7a);
    }
  }
  box(parent, x, y - 0.64, z - 0.04, 1.17, 0.13, 0.21, trim, 0, 0.025);
}
function planter(parent, x, y, z, size = 0.4) {
  cylinder(
    parent,
    x,
    y + size * 0.45,
    z,
    size * 0.43,
    size * 0.9,
    material(0xc28559),
    false,
    size * 0.59,
  );
  cylinder(parent, x, y + size * 0.9, z, size * 0.6, 0.085, 0xd79d6c);
  cylinder(parent, x, y + size * 0.9 + 0.046, z, size * 0.51, 0.006, 0x393e2b);
  for (let i = 0; i < 7; i++) {
    const a = i * 2.4;
    wire(
      parent,
      [
        [x, y + size * 0.94, z],
        [
          x + Math.sin(a) * size * 0.18,
          y + size,
          z + Math.cos(a) * size * 0.18,
        ],
        [
          x + Math.sin(a) * size * 0.35,
          y + size * (1.1 + (i % 3) * 0.2),
          z + Math.cos(a) * size * 0.35,
        ],
      ],
      0x4f6d3d,
      size * 0.017,
    );
    foliage(
      parent,
      x + Math.sin(a) * size * 0.35,
      y + size * (1.1 + (i % 3) * 0.2),
      z + Math.cos(a) * size * 0.35,
      size * 0.15,
      size * 0.43,
      size * 0.14,
      material(i % 2 ? 0x6f9556 : 0x4f7e48),
    ).rotation.set(Math.cos(a) * 0.28, a, Math.sin(a) * 0.6);
  }
}
function lamp(parent, x, y, z) {
  box(parent, x, y, z, 0.08, 0.35, 0.075, iron, 0, 0.016);
  wire(
    parent,
    [
      [x, y + 0.13, z],
      [x, y + 0.32, z - 0.25],
      [x, y + 0.27, z - 0.4],
    ],
    0x40534b,
    0.026,
  );
  const shade = cylinder(
    parent,
    x,
    y + 0.11,
    z - 0.4,
    0.115,
    0.22,
    material(0xe6bc73, 0.15),
  );
  shade.material.emissive.setHex(0x9c6527);
  shade.material.emissiveIntensity = 0.14;
  box(parent, x, y + 0.235, z - 0.4, 0.26, 0.05, 0.25, iron, 0, 0.025);
  for (const sx of [-1, 1])
    for (const sz of [-1, 1])
      box(
        parent,
        x + sx * 0.09,
        y + 0.11,
        z - 0.4 + sz * 0.09,
        0.017,
        0.23,
        0.017,
        iron,
      );
  cylinder(parent, x, y - 0.015, z - 0.4, 0.14, 0.045, iron);
}
function sign(parent, text, x, y, z, color = 0x426e7b, scale = 1) {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 128;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#" + color.toString(16).padStart(6, "0");
  ctx.fillRect(0, 0, 512, 128);
  ctx.strokeStyle = "#d7dcb8";
  ctx.lineWidth = 3;
  ctx.strokeRect(8, 8, 496, 112);
  ctx.fillStyle = "#f7eed6";
  ctx.font = "bold 54px Arial";
  ctx.textAlign = "center";
  ctx.fillText(text, 256, 84);
  const map = new THREE.CanvasTexture(c);
  map.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(2.3 * scale, 0.575 * scale),
    new THREE.MeshStandardMaterial({ map, roughness: 0.8 }),
  );
  mesh.position.set(x, y, z);
  mesh.userData.ownedGeometry = mesh.userData.ownedMaterial = true;
  parent.add(mesh);
  return mesh;
}
function crate(parent, b) {
  const { x, y, z, w, h, d } = b;
  box(parent, x, y, z, w, h, d, wood, 0, 0.04);
  for (let i = 1; i < Math.ceil(w / 0.34); i++)
    box(
      parent,
      x - w / 2 + i * (w / Math.ceil(w / 0.34)),
      y + h / 2 + 0.005,
      z,
      0.012,
      0.01,
      d - 0.12,
      0x765130,
    );
  for (const side of [-1, 1]) {
    for (const end of [-1, 1]) {
      box(
        parent,
        x + side * (w / 2 + 0.015),
        y + end * (h / 2 - 0.11),
        z,
        0.06,
        0.13,
        d,
        0xa48455,
        0,
        0.012,
      );
      box(
        parent,
        x + side * (w / 2 + 0.035),
        y,
        z + end * (d / 2 - 0.1),
        0.035,
        h - 0.12,
        0.12,
        0x6e754f,
        0,
        0.015,
      );
    }
    for (let i = 1; i < Math.ceil(d / 0.34); i++)
      box(
        parent,
        x + side * (w / 2 + 0.004),
        y,
        z - d / 2 + i * (d / Math.ceil(d / 0.34)),
        0.008,
        h - 0.15,
        0.012,
        0x775132,
      );
  }
  for (const s of [-1, 1]) {
    for (const t of [-1, 1]) {
      box(
        parent,
        x + s * (w / 2 - 0.065),
        y,
        z + (t * d) / 2,
        0.13,
        h,
        0.08,
        0x987848,
        0,
        0.015,
      );
      box(
        parent,
        x,
        y + s * (h / 2 - 0.065),
        z + (t * d) / 2,
        w,
        0.13,
        0.08,
        0xa58d57,
        0,
        0.015,
      );
    }
    const brace = box(
      parent,
      x,
      y,
      z + s * (d / 2 + 0.045),
      0.12,
      Math.hypot(w - 0.2, h - 0.2),
      0.06,
      0xbea375,
      0,
      0.012,
    );
    brace.rotation.z = -Math.atan2(w - 0.2, h - 0.2);
    for (const xx of [-1, 1])
      for (const yy of [-1, 1])
        ellipsoid(
          parent,
          x + xx * (w / 2 - 0.08),
          y + yy * (h / 2 - 0.08),
          z + s * (d / 2 + 0.09),
          0.018,
          0.018,
          0.008,
          0x504d37,
        );
  }
}
function barrel(parent, b) {
  const profile = [
    [0.44, -0.5],
    [0.46, -0.48],
    [0.47, -0.38],
    [0.49, -0.27],
    [0.51, 0],
    [0.49, 0.27],
    [0.47, 0.38],
    [0.46, 0.48],
    [0.44, 0.5],
  ];
  const geo = new THREE.LatheGeometry(
    profile.map(([r, y]) => new THREE.Vector2(r, y * b.h)),
    24,
  );
  const body = new THREE.Mesh(geo, material(0x477a84, 0.3));
  body.position.set(b.x, b.y, b.z);
  body.castShadow = body.receiveShadow = true;
  body.userData.ownedGeometry = true;
  parent.add(body);
  for (const y of [-0.45, 0, 0.45])
    cylinder(parent, b.x, b.y + y, b.z, 0.51, 0.045, iron);
  cylinder(
    parent,
    b.x,
    b.y + b.h / 2 + 0.005,
    b.z,
    0.48,
    0.035,
    material(0x788e88, 0.6),
  );
  cylinder(parent, b.x + 0.24, b.y + b.h / 2 + 0.03, b.z, 0.049, 0.018, iron);
  for (const s of [-1, 1]) {
    box(
      parent,
      b.x,
      b.y + 0.1,
      b.z + s * 0.502,
      0.29,
      0.29,
      0.008,
      0xd7c491,
      0,
      0.026,
    );
    box(
      parent,
      b.x,
      b.y + 0.1,
      b.z + s * 0.51,
      0.08,
      0.19,
      0.008,
      0x405d62,
      0,
      0.012,
    );
    ring(parent, b.x, b.y + 0.1, b.z + s * 0.515, 0.07, 0.011, 0x405d62);
  }
}
function stall(parent, b, index) {
  crate(parent, b);
  const { x, z } = b,
    shade = material(index % 2 ? 0xbc9959 : 0xb95f48);
  shade.side = THREE.DoubleSide;
  for (const s of [-1, 1])
    for (const t of [-1, 1])
      cylinder(parent, x + s * 1.26, 1.37, z + t * 0.94, 0.035, 2.74, wood);
  const vertices = [],
    indices = [];
  for (let i = 0; i < 9; i++) {
    const t = i / 8;
    vertices.push(
      x - 1.48,
      2.58 + Math.sin(t * Math.PI) * 0.31,
      z - 1.12 + t * 2.24,
      x + 1.48,
      2.58 + Math.sin(t * Math.PI) * 0.31,
      z - 1.12 + t * 2.24,
    );
    if (i < 8)
      indices.push(
        i * 2,
        i * 2 + 1,
        i * 2 + 2,
        i * 2 + 1,
        i * 2 + 3,
        i * 2 + 2,
      );
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  const cloth = new THREE.Mesh(geo, shade);
  cloth.castShadow = true;
  cloth.userData.ownedGeometry = true;
  parent.add(cloth);
  for (let i = 0; i < 9; i++)
    ellipsoid(
      parent,
      x - 1.2 + i * 0.3,
      2.55,
      z - 1.14,
      0.15,
      0.12,
      0.027,
      shade,
    );
  for (const sx of [-0.65, 0.65]) {
    box(parent, x + sx, b.h + 0.08, z, 1.05, 0.13, 1.07, 0x5f603a, 0, 0.025);
    for (const edge of [-1, 1])
      box(
        parent,
        x + sx + edge * 0.5,
        b.h + 0.22,
        z,
        0.07,
        0.3,
        1.07,
        wood,
        0,
        0.015,
      );
    for (const edge of [-1, 1])
      box(
        parent,
        x + sx,
        b.h + 0.22,
        z + edge * 0.5,
        1.05,
        0.3,
        0.07,
        wood,
        0,
        0.015,
      );
  }
  for (let i = 0; i < 18; i++)
    ellipsoid(
      parent,
      x - 1 + (i % 6) * 0.4,
      b.h + 0.27,
      z - 0.32 + Math.floor(i / 6) * 0.31,
      0.125,
      0.115,
      0.12,
      i % 3 === 0 ? 0xc77830 : i % 3 === 1 ? 0xa84f39 : 0x88a04c,
    );
}
function boat(parent, x, y, z, angle, color) {
  const g = joint(parent, x, y, z);
  g.rotation.y = angle;
  const curve = new THREE.Shape();
  curve.moveTo(0, -2.4);
  curve.bezierCurveTo(1.3, -1.3, 1.2, 1.6, 0.72, 2);
  curve.lineTo(-0.72, 2);
  curve.bezierCurveTo(-1.2, 1.6, -1.3, -1.3, 0, -2.4);
  const geo = new THREE.ExtrudeGeometry(curve, {
    depth: 0.5,
    bevelEnabled: true,
    bevelSize: 0.2,
    bevelThickness: 0.12,
    bevelSegments: 2,
    curveSegments: 14,
  });
  geo.rotateX(Math.PI / 2);
  const hull = new THREE.Mesh(geo, material(color));
  hull.userData.ownedGeometry = true;
  g.add(hull);
  box(g, 0, -0.05, 0, 1.35, 0.18, 3.1, wood, 0, 0.16);
  for (const z of [-0.9, 0.5, 1.3])
    box(g, 0, 0.15, z, 1.65, 0.12, 0.34, trim, 0, 0.04);
  ring(g, 0.84, 0.32, 1.1, 0.29, 0.079, 0xe7d8b6);
  wire(
    g,
    [
      [0.6, 0.22, -1.3],
      [0.95, 0.21, -0.3],
      [1.6, 0.15, 1.4],
    ],
    0x946c3f,
    0.037,
  );
  bake(g);
  return g;
}
function waterMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      time: { value: 0 },
      deep: { value: new THREE.Color(0x096a88) },
      shallow: { value: new THREE.Color(0x39a99c) },
    },
    vertexShader: `varying vec3 vWorld;uniform float time;void main(){vec3 p=position;p.z+=sin(p.x*.16+time*.7)*.035+cos(p.y*.21+time*.9)*.025;vec4 world=modelMatrix*vec4(p,1.);vWorld=world.xyz;gl_Position=projectionMatrix*viewMatrix*world;}`,
    fragmentShader: `uniform float time;uniform vec3 deep;uniform vec3 shallow;varying vec3 vWorld;
    void main(){
      vec2 p=vWorld.xz;
      float a=p.x*.53+p.y*.28+time*.63,b=p.y*.61-p.x*.17-time*.55;
      float wave=sin(a+sin(b*.37)*2.)*cos(b+sin(a*.41));
      float ripple=1./(1.+length(cameraPosition.xz-p)*.018);
      vec3 normal=normalize(vec3(-cos(a+sin(b*.37)*2.)*.026*ripple,1.,-cos(b+sin(a*.41))*.024*ripple));
      vec3 view=normalize(cameraPosition-vWorld);
      float fresnel=pow(1.-max(0.,dot(view,normal)),3.5);
      vec3 reflection=reflect(-view,normal);
      vec3 reflectedSky=mix(vec3(.34,.62,.69),vec3(.12,.36,.54),max(0.,reflection.y));
      float glint=pow(max(0.,dot(reflect(normalize(vec3(.45,-.78,.53)),normal),view)),180.);
      float flow=sin(p.x*3.8+p.y*.6+sin(p.y*.9-time*.3));
      float edge=1.-smoothstep(.04,.25,abs(abs(p.x)-3.));
      float foam=edge*step(abs(p.y),27.8)*smoothstep(-.1,.7,flow)*.18;
      vec3 c=mix(deep,shallow,.28+wave*.1);
      c=mix(c,reflectedSky,fresnel*.74)+vec3(.75,.63,.34)*glint*.34+vec3(.7,.83,.73)*foam;
      gl_FragColor=vec4(c,.96);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
  });
}
export function buildWorld(scene) {
  const root = new THREE.Group(),
    details = new THREE.Group();
  root.name = "COASTLINE";
  scene.add(root);
  root.add(details);
  scene.background = new THREE.Color(0x93c4d6);
  scene.fog = new THREE.FogExp2(0xadd0d5, 0.0025);
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(480, 24, 12),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        top: { value: new THREE.Color(0x347eb4) },
        horizon: { value: new THREE.Color(0xb9d9df) },
      },
      vertexShader:
        "varying vec3 direction;void main(){direction=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
      fragmentShader: `varying vec3 direction;uniform vec3 top;uniform vec3 horizon;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
      void main(){vec3 d=normalize(direction);float h=pow(max(0.,d.y),.55);vec3 color=mix(horizon,top,h);
        vec2 p=d.xz/max(.17,d.y)*1.9;
        float n=noise(p)*.6+noise(p*2.3)*.27+noise(p*5.7)*.13;
        float cloud=smoothstep(.61,.77,n)*smoothstep(.10,.27,d.y)*(1.-smoothstep(.52,.83,d.y));
        float sun=pow(max(0.,dot(d,normalize(vec3(-38.,68.,-48.)))),50.);
        color=mix(color,vec3(.83,.86,.78),cloud*.76)+vec3(.21,.15,.06)*sun;
        gl_FragColor=vec4(color,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    }),
  );
  root.add(sky);
  const sun = new THREE.DirectionalLight(0xffe4c1, 3.1);
  sun.position.set(-38, 68, -48);
  sun.castShadow = true;
  Object.assign(sun.shadow.camera, {
    left: -60,
    right: 60,
    top: 55,
    bottom: -55,
    near: 1,
    far: 180,
  });
  sun.shadow.normalBias = 0.06;
  sun.shadow.bias = -0.00015;
  sun.shadow.mapSize.set(2048, 2048);
  root.add(sun);
  root.add(new THREE.HemisphereLight(0xb9dfea, 0x605b45, 0.67));
  const water = waterMaterial();
  for (const [w, d, x, y, z] of [
    [3000, 3000, 0, -1.4, 0],
    [6, 56, 0, -0.78, 0],
  ]) {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, d, 48, 48), water);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, y, z);
    mesh.userData.ownedGeometry = true;
    root.add(mesh);
  }
  const paved = coastalMaterial("paving"),
    sand = coastalMaterial("sand");
  const buildings = new Map();
  let stallIndex = 0;
  for (const b of COASTLINE.boxes) {
    if (b.type === "land" || b.type === "canalFloor") {
      box(root, b.x, b.y, b.z, b.w, b.h, b.d, paved);
      continue;
    }
    if (b.type === "crate") {
      crate(root, b);
      continue;
    }
    if (b.type === "barrel") {
      barrel(root, b);
      continue;
    }
    if (["courtyardFountain", "harborMonument", "quayCover"].includes(b.type)) {
      tacticalLandmark(root, b);
      continue;
    }
    if (b.type === "stall") {
      stall(root, b, stallIndex++);
      continue;
    }
    if (b.type === "facade" || b.type === "archTop") {
      box(
        root,
        b.x,
        b.y,
        b.z,
        b.w,
        b.h,
        b.d,
        buildingMaterial(b.group),
        0,
        0.035,
      );
      if (!buildings.has(b.group)) buildings.set(b.group, []);
      buildings.get(b.group).push(b);
      continue;
    }
    if (b.type === "roof") {
      box(root, b.x, b.y, b.z, b.w, b.h, b.d, trim, 0, 0.02);
      box(root, b.x, b.y + 0.137, b.z, b.w - 0.15, 0.014, b.d - 0.15, roof);
      // Low perimeter coping preserves accessible flat roof terraces.
      for (const s of [-1, 1]) {
        box(
          details,
          b.x,
          b.y + 0.25,
          b.z + s * (b.d / 2 - 0.1),
          b.w,
          0.22,
          0.18,
          trim,
          0,
          0.025,
        );
      }
      for (let i = 0; i < Math.floor(b.w / 0.65); i++)
        box(
          details,
          b.x - b.w / 2 + 0.3 + i * 0.65,
          b.y + 0.146,
          b.z,
          0.012,
          0.012,
          b.d - 0.2,
          0xdbad83,
        );
      if (Math.abs(b.x) === 29 && b.z === -8)
        planter(details, b.x + b.w * 0.3, b.y + 0.14, b.z + b.d * 0.27, 0.7);
      continue;
    }
    if (["bridge", "dock"].includes(b.type)) {
      box(root, b.x, b.y, b.z, b.w, b.h, b.d, b.type === "dock" ? wood : trim);
      for (
        let i = 0;
        i < Math.floor((b.type === "dock" ? b.d : b.w) / 0.32);
        i++
      ) {
        if (b.type === "dock")
          box(
            details,
            b.x,
            b.y + 0.126,
            b.z - b.d / 2 + i * 0.32,
            b.w,
            0.01,
            0.012,
            0x826f52,
          );
        else
          box(
            details,
            b.x - b.w / 2 + i * 0.32,
            b.y + 0.126,
            b.z,
            0.013,
            0.01,
            b.d,
            0xa8a17e,
          );
      }
      if (b.type === "bridge")
        for (const s of [-1, 1]) {
          arch(details, 0, -0.08, b.z + s * 1.5, 5.6, 0.8, 0.15).rotation.z =
            Math.PI;
          for (const x of [-3, 3])
            box(
              details,
              x,
              0.7,
              b.z + s * 1.5,
              0.21,
              1.15,
              0.23,
              trim,
              0,
              0.025,
            );
          wire(
            details,
            [
              [-3, 1.12, b.z + s * 1.5],
              [0, 0.89, b.z + s * 1.5],
              [3, 1.12, b.z + s * 1.5],
            ],
            0x646a4f,
            0.019,
          );
        }
      else
        for (const s of [-1, 1])
          for (const zz of [-4, 0, 4]) {
            cylinder(details, b.x + s * 3.7, 0.3, b.z + zz, 0.13, 1.55, wood);
            ring(
              details,
              b.x + s * 3.7,
              0.85,
              b.z + zz,
              0.14,
              0.026,
              0x9e9169,
              "y",
            );
          }
      continue;
    }
    if (b.type === "tower") {
      box(root, b.x, b.y, b.z, b.w, b.h, b.d, stone, 0, 0.06);
      for (const s of [-1, 1]) {
        windowFrame(details, s * 1.4, 3.1, -34.53, 0x547e9a);
      }
      continue;
    }
    box(
      root,
      b.x,
      b.y,
      b.z,
      b.w,
      b.h,
      b.d,
      ["stairs", "waterstep", "towerDeck", "edge", "lowwall"].includes(b.type)
        ? trim
        : stone,
      0,
      0.015,
    );
    if (["edge", "lowwall"].includes(b.type))
      box(
        details,
        b.x,
        b.y + b.h / 2 + 0.035,
        b.z,
        b.w + 0.08,
        0.07,
        b.d + 0.08,
        0xcabb95,
        0,
        0.012,
      );
  }
  for (const list of buildings.values()) {
    const long = list.filter((b) => b.w > b.d),
      front = long[0],
      back = long[1];
    if (!front || !back) continue;
    const x = front.x,
      z = (front.z + back.z) / 2,
      w = front.w,
      d = Math.abs(front.z - back.z),
      height = front.h,
      accent = front.accent;
    decorateBuilding(
      details,
      { x, z, w, d, height, accent },
      { arch, lamp, sign },
    );
    for (const s of [-1, 1]) {
      const wall = joint(details, x, 0, z + s * (d / 2 + 0.26));
      if (s === 1) wall.rotation.y = Math.PI;
      for (let i = 0; i < Math.floor(w / 2.5); i++)
        windowFrame(wall, -w / 2 + 1.3 + i * 2.5, height * 0.6, 0, accent);
      box(
        wall,
        0,
        0.5,
        0.0,
        w,
        0.58,
        0.04,
        material(accent)
          .color.clone()
          .lerp(new THREE.Color(0xe3d9bb), 0.35)
          .getHex(),
      );
      box(wall, 0, height - 0.23, 0, w, 0.12, 0.12, trim, 0, 0.025);
      lamp(wall, w / 2 - 0.6, 2.4, -0.05);
      const door = joint(details, x + s * (w / 2 + 0.27), 0, z);
      door.rotation.y = (s * Math.PI) / 2;
      arch(door, 0, 1.68, 0, 2.58, 1.68, 0.15, 0xd6c7a3);
      box(door, 0, 0.08, -0.3, 2.7, 0.16, 0.8, trim, 0, 0.03);
      planter(door, -1.8, 0, 0, 0.65);
    }
  }
  // Paving motifs mark tactical areas without coloring entire courtyards.
  for (const [id, site] of Object.entries(COASTLINE.sites)) {
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const x = c.getContext("2d");
    x.strokeStyle = id === "A" ? "#c67556" : "#50889d";
    x.fillStyle = x.strokeStyle;
    x.lineWidth = 9;
    x.beginPath();
    x.arc(128, 128, 108, 0, Math.PI * 2);
    x.stroke();
    x.font = "bold 140px Arial";
    x.textAlign = "center";
    x.fillText(id, 128, 178);
    const map = new THREE.CanvasTexture(c);
    map.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(5.3, 5.3),
      new THREE.MeshStandardMaterial({
        map,
        transparent: true,
        depthWrite: false,
        roughness: 1,
      }),
    );
    m.rotation.x = -Math.PI / 2;
    m.position.set(site.x, 0.011, site.z);
    m.userData.ownedGeometry = m.userData.ownedMaterial = true;
    details.add(m);
  }
  box(details, -40, 0.014, 24, 5.5, 0.02, 13, sand);
  for (const [x, z, h] of [
    [-40, -29, 6.5],
    [39, -29, 7],
    [-37, 9, 6.8],
    [38, 10, 6.4],
    [-22, 10, 5.6],
    [23, 10, 5.8],
    [-8, -24, 5.7],
    [8, -24, 5.9],
    [-5, 31, 6.8],
    [6, 31, 6.5],
    [-39, 32, 5.5],
    [41, 32, 7.2],
    [-22, -33, 6],
    [24, -33, 6.5],
  ])
    coastalPalm(details, x, z, h);
  for (const [x, z] of [
    [-20, -12],
    [20, -12],
    [-25, 22],
    [25, 22],
    [-6, -4],
    [6, -4],
    [-7, 32],
    [8, 32],
  ])
    planter(details, x, 0, z, 0.65);
  sign(details, "MERCATO", -20, 2.25, 18.2, 0x9c7050, 0.7);
  sign(details, "COASTLINE", 0, 2.1, 35.95, 0x437b84, 1.2);
  // Distant cliffs and lighthouse establish the island beyond the playable parapet.
  const cliffMat = coastalMaterial("rock");
  for (let i = 0; i < 50; i++) {
    const a = (i / 50) * Math.PI * 2,
      radx = 48 + (i % 3) * 1.8,
      radz = 40 + (i % 4),
      m = new THREE.Mesh(new THREE.DodecahedronGeometry(1, 1), cliffMat);
    m.position.set(Math.sin(a) * radx, -3.8, Math.cos(a) * radz);
    m.scale.set(3.5 + (i % 3), 3.6, 3.4 + (i % 4));
    m.rotation.set(i * 0.3, i * 0.7, 0.2);
    m.castShadow = m.receiveShadow = true;
    m.userData.ownedGeometry = true;
    details.add(m);
  }
  const lighthouse = joint(details, -54, -1, -45);
  cylinder(lighthouse, 0, 6, 0, 1.6, 13, trim, false, 1.05);
  for (const y of [1, 11.9])
    cylinder(lighthouse, 0, y, 0, 1.78, 0.25, 0xc78d64);
  for (const y of [4.6, 8.1]) {
    const radius = 1.6 - ((y + 0.5) / 13) * 0.55 + 0.016;
    cylinder(
      lighthouse,
      0,
      y,
      0,
      radius + 0.019,
      0.9,
      y < 5 ? 0xc47b51 : 0x40798c,
      false,
      radius - 0.019,
    );
  }
  cylinder(lighthouse, 0, 0.28, 0, 2.35, 0.65, coastalMaterial("stone"));
  cylinder(lighthouse, 0, 11.75, 0, 2.25, 0.28, coastalMaterial("stone"));
  for (const yy of [12.03, 12.69])
    ring(lighthouse, 0, yy, 0, 2.07, 0.045, 0x36575a, "y");
  for (let i = 0; i < 16; i++) {
    const a = (i * Math.PI) / 8;
    cylinder(
      lighthouse,
      Math.sin(a) * 2.07,
      12.37,
      Math.cos(a) * 2.07,
      0.028,
      0.66,
      iron,
    );
  }
  cylinder(lighthouse, 0, 13, 0, 1.34, 1.4, material(0x88b7b5, 0.65));
  cylinder(lighthouse, 0, 13.85, 0, 1.7, 0.35, roof, false, 0);
  cylinder(
    lighthouse,
    0,
    13.97,
    0,
    1.88,
    0.56,
    material(0x3f7889, 0.35),
    false,
    0,
  );
  cylinder(lighthouse, 0, 14.44, 0, 0.065, 0.43, iron);
  ellipsoid(lighthouse, 0, 14.7, 0, 0.13, 0.17, 0.13, 0xbe9852);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    box(
      lighthouse,
      Math.sin(a) * 1.27,
      13,
      Math.cos(a) * 1.27,
      0.07,
      1.6,
      0.07,
      iron,
    );
  }
  box(lighthouse, 0, 7, -1.35, 0.48, 1.1, 0.1, 0x4c8899, 0, 0.15);
  for (const yy of [3, 6.3, 9.5]) {
    const window = joint(lighthouse, 0, yy, 1.52 - yy * 0.026);
    window.rotation.y = Math.PI;
    windowFrame(window, 0, 0, 0, 0x3f7889);
  }
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4,
      rock = new THREE.Mesh(new THREE.DodecahedronGeometry(1, 1), cliffMat);
    rock.position.set(-54 + Math.sin(a) * 3.2, -2.3, -45 + Math.cos(a) * 3.2);
    rock.scale.set(3.4, 2.6, 3.2);
    rock.rotation.y = a;
    rock.castShadow = rock.receiveShadow = true;
    rock.userData.ownedGeometry = true;
    details.add(rock);
  }
  boat(details, 46, -0.84, 26, 0.2, 0xaf6652);
  boat(details, -47, -0.86, 25, -0.35, 0xe2d5b7);
  boat(details, 62, -0.9, -5, 0.5, 0xf0dfb3);
  decorateCoast(details, { arch, lamp, sign, planter, boat });
  // Repeated geometry is instanced by spatial cell for useful frustum culling.
  const buckets = new Map(),
    meshes = [];
  details.updateMatrixWorld(true);
  details.traverse((o) => {
    if (
      o.isMesh &&
      !o.userData.ownedGeometry &&
      !o.userData.ownedMaterial &&
      !Array.isArray(o.material)
    ) {
      const p = new THREE.Vector3().setFromMatrixPosition(o.matrixWorld),
        key = `${o.geometry.uuid}/${o.material.uuid}/${Math.floor(p.x / 16)}/${Math.floor(p.z / 16)}`;
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(o);
    }
  });
  for (const list of buckets.values()) {
    if (list.length < 3) continue;
    const batch = new THREE.InstancedMesh(
      list[0].geometry,
      list[0].material,
      list.length,
    );
    list.forEach((o, i) => {
      batch.setMatrixAt(i, o.matrixWorld);
      o.removeFromParent();
    });
    batch.castShadow = batch.receiveShadow = true;
    batch.computeBoundingSphere();
    root.add(batch);
    meshes.push(batch);
  }
  const mergeBuckets = new Map();
  root.updateMatrixWorld(true);
  const all = [];
  root.traverse((o) => {
    if (
      o.isMesh &&
      !o.isInstancedMesh &&
      !o.material.isShaderMaterial &&
      !Array.isArray(o.material)
    )
      all.push(o);
  });
  for (const o of all) {
    const p = new THREE.Vector3().setFromMatrixPosition(o.matrixWorld),
      key =
        o.material.uuid +
        "/" +
        Math.floor(p.x / 20) +
        "/" +
        Math.floor(p.z / 20);
    if (!mergeBuckets.has(key)) mergeBuckets.set(key, []);
    mergeBuckets.get(key).push(o);
  }
  for (const list of mergeBuckets.values()) {
    if (list.length < 2) continue;
    const parts = list.map((o) =>
        (o.geometry.index
          ? o.geometry.toNonIndexed()
          : o.geometry.clone()
        ).applyMatrix4(o.matrixWorld),
      ),
      geometry = mergeGeometries(
        parts.map((g) => {
          if (!g.hasAttribute("uv"))
            g.setAttribute(
              "uv",
              new THREE.Float32BufferAttribute(
                new Float32Array(g.attributes.position.count * 2),
                2,
              ),
            );
          return g;
        }),
      );
    parts.forEach((g) => g.dispose());
    if (!geometry) continue;
    const mesh = new THREE.Mesh(geometry, list[0].material);
    mesh.castShadow = mesh.receiveShadow = true;
    mesh.userData.ownedGeometry = true;
    root.add(mesh);
    list.forEach((o) => {
      o.removeFromParent();
      if (o.userData.ownedGeometry) o.geometry.dispose();
    });
  }
  return {
    root,
    details,
    sun,
    map: COASTLINE,
    update(time) {
      water.uniforms.time.value = time;
    },
    dispose() {
      scene.remove(root);
      root.traverse((o) => {
        if (o.userData.ownedGeometry) o.geometry?.dispose();
        if (o.userData.ownedMaterial) {
          o.material.map?.dispose();
          o.material.dispose();
        }
      });
      water.dispose();
      sky.geometry.dispose();
      sky.material.dispose();
      sun.shadow.map?.dispose();
    },
  };
}
