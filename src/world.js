import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { coastalMaterial } from "./coastal-materials.js";
import { COASTLINE } from "../shared/maps.js";
import { box, cylinder, ellipsoid, material, joint, bake } from "./geometry.js";
import { wire, ring } from "./equipment.js";
import { surface } from "./materials.js";

const stone = coastalMaterial("plaster"),
  trim = material(0xd9ccad),
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
  box(parent, x, y, z - 0.045, 0.69, 0.94, 0.015, 0x344d4d, 0, 0.045);
  box(parent, x, y, z - 0.06, 0.045, 0.98, 0.028, trim);
  box(parent, x, y + 0.03, z - 0.06, 0.72, 0.04, 0.03, trim);
  for (const s of [-1, 1]) {
    const shutter = joint(parent, x + s * 0.58, y, z - 0.065);
    shutter.rotation.y = s * -0.12;
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
  cylinder(parent, x, y + size * 0.94, z, size * 0.51, 0.02, 0x5b5840);
  for (let i = 0; i < 7; i++) {
    const a = i * 2.4;
    ellipsoid(
      parent,
      x + Math.sin(a) * size * 0.35,
      y + size * (1.1 + (i % 3) * 0.2),
      z + Math.cos(a) * size * 0.35,
      size * 0.15,
      size * 0.43,
      size * 0.14,
      material(i % 2 ? 0x6f9556 : 0x4f7e48),
    ).rotation.z = Math.sin(a) * 0.7;
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
    material(0xc7b881, 0.15),
  );
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
function palm(parent, x, z, height = 6) {
  const g = joint(parent, x, 0, z);
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0.12, height * 0.35, 0.08),
    new THREE.Vector3(0.55, height * 0.8, 0.14),
    new THREE.Vector3(0.7, height, 0),
  ]);
  const trunk = new THREE.Mesh(
    new THREE.TubeGeometry(curve, 12, 0.18, 8, false),
    material(0x9c8160),
  );
  trunk.userData.ownedGeometry = true;
  trunk.castShadow = true;
  g.add(trunk);
  for (let i = 1; i < 16; i++) {
    const p = curve.getPoint(i / 16),
      r = ring(g, p.x, p.y, p.z, 0.18, 0.012, 0x776c4f, "y");
  }
  const leafMat = material(0x528b4b),
    pale = material(0x7ca35a);
  leafMat.side = pale.side = THREE.DoubleSide;
  for (let i = 0; i < 9; i++) {
    const a = (i * Math.PI * 2) / 9,
      points = [];
    for (let j = 0; j <= 10; j++) {
      const t = j / 10,
        dist = t * 2.65,
        w = Math.sin(t * Math.PI) * 0.36,
        y = height + Math.sin(t * Math.PI) * 0.66 - t * 0.73;
      points.push(
        0.7 + Math.sin(a) * dist + Math.cos(a) * w,
        y,
        Math.cos(a) * dist - Math.sin(a) * w,
        0.7 + Math.sin(a) * dist - Math.cos(a) * w,
        y,
        Math.cos(a) * dist + Math.sin(a) * w,
      );
    }
    const idx = [];
    for (let j = 0; j < 10; j++)
      idx.push(j * 2, j * 2 + 1, j * 2 + 2, j * 2 + 1, j * 2 + 3, j * 2 + 2);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(points, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const leaf = new THREE.Mesh(geo, i % 2 ? leafMat : pale);
    leaf.castShadow = true;
    leaf.userData.ownedGeometry = true;
    g.add(leaf);
    for (let j = 2; j < 9; j++) {
      const t = j / 10,
        dist = t * 2.65;
      wire(
        g,
        [
          [
            0.7 + Math.sin(a) * dist,
            height + Math.sin(t * Math.PI) * 0.66 - t * 0.73,
            Math.cos(a) * dist,
          ],
          [
            0.7 +
              Math.sin(a) * dist +
              Math.cos(a) * 0.32 * Math.sin(t * Math.PI),
            height + Math.sin(t * Math.PI) * 0.66 - t * 0.73 - 0.04,
            Math.cos(a) * dist - Math.sin(a) * 0.32 * Math.sin(t * Math.PI),
          ],
        ],
        0x668a45,
        0.008,
      );
    }
  }
  for (let i = 0; i < 3; i++)
    ellipsoid(
      g,
      0.62 + Math.sin(i * 2) * 0.16,
      height - 0.16,
      Math.cos(i * 2) * 0.16,
      0.14,
      0.18,
      0.14,
      0x9c9260,
    );
  bake(g);
  return g;
}
function crate(parent, b) {
  const { x, y, z, w, h, d } = b;
  box(parent, x, y, z, w, h, d, wood, 0, 0.04);
  const band = 0.11;
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
  cylinder(parent, b.x, b.y, b.z, 0.49, b.h, material(0x53838b, 0.25));
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
}
function stall(parent, b, index) {
  crate(parent, b);
  const { x, z } = b,
    shade = material(index % 2 ? 0xd99a58 : 0xc07551);
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
  for (let i = 0; i < 12; i++)
    ellipsoid(
      parent,
      x - 0.8 + (i % 4) * 0.49,
      b.h + 0.11,
      z - 0.35 + Math.floor(i / 4) * 0.3,
      0.14,
      0.11,
      0.13,
      i % 2 ? 0xc39b49 : 0xa48d4a,
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
      deep: { value: new THREE.Color(0x087f9d) },
      shallow: { value: new THREE.Color(0x54c9bd) },
    },
    vertexShader: `varying vec3 vWorld;uniform float time;void main(){vec3 p=position;p.z+=sin(p.x*.16+time*.7)*.035+cos(p.y*.21+time*.9)*.025;vec4 world=modelMatrix*vec4(p,1.);vWorld=world.xyz;gl_Position=projectionMatrix*viewMatrix*world;}`,
    fragmentShader: `uniform float time;uniform vec3 deep;uniform vec3 shallow;varying vec3 vWorld;void main(){float wave=sin(vWorld.x*.8+sin(vWorld.z*.26)+time)*cos(vWorld.z*.4+vWorld.x*.1-time*.8);float sparkle=pow(max(0.,wave),22.);vec3 view=normalize(cameraPosition-vWorld);float fresnel=pow(1.-max(0.,view.y),4.);vec3 c=mix(deep,shallow,.28+wave*.09)+vec3(.8,.9,.78)*sparkle*.17;gl_FragColor=vec4(mix(c,vec3(.52,.78,.83),fresnel*.5),.88);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>}`,
  });
}
export function buildWorld(scene) {
  const root = new THREE.Group(),
    details = new THREE.Group();
  root.name = "COASTLINE";
  scene.add(root);
  root.add(details);
  scene.background = new THREE.Color(0x9ecedb);
  scene.fog = new THREE.FogExp2(0xb7d8d8, 0.0036);
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(480, 24, 12),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        top: { value: new THREE.Color(0x398bbd) },
        horizon: { value: new THREE.Color(0xb7dce4) },
      },
      vertexShader:
        "varying vec3 direction;void main(){direction=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
      fragmentShader:
        "varying vec3 direction;uniform vec3 top;uniform vec3 horizon;void main(){vec3 d=normalize(direction);float h=pow(max(0.,d.y),.45);vec3 color=mix(horizon,top,h);float cloud=0.;gl_FragColor=vec4(mix(color,vec3(.95),cloud),1.);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>}",
    }),
  );
  root.add(sky);
  const sun = new THREE.DirectionalLight(0xffedc9, 2.7);
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
  root.add(new THREE.HemisphereLight(0xd7f2fa, 0x727b61, 0.72));
  const water = waterMaterial();
  for (const [w, d, x, y, z] of [
    [700, 700, 0, -1.4, 0],
    [6, 56, 0, -0.78, 0],
  ]) {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, d, 48, 48), water);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, y, z);
    mesh.userData.ownedGeometry = true;
    root.add(mesh);
  }
  const paved = coastalMaterial("paving"),
    sand = surface("sand", 0xe9d0a0, 4);
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
    if (b.type === "stall") {
      stall(root, b, stallIndex++);
      continue;
    }
    if (b.type === "facade" || b.type === "archTop") {
      box(root, b.x, b.y, b.z, b.w, b.h, b.d, stone, 0, 0.035);
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
    palm(details, x, z, h);
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
  sign(details, "A  •  PIAZZA", -29, 2.2, -13.29, 0xaa765b, 0.8);
  sign(details, "B  •  MARINA", 29, 2.2, -13.29, 0x4f8397, 0.8);
  // Distant cliffs and lighthouse establish the island beyond the playable parapet.
  const cliffMat = material(0xb1ad91);
  for (let i = 0; i < 50; i++) {
    const a = (i / 50) * Math.PI * 2,
      radx = 48 + (i % 3) * 1.8,
      radz = 40 + (i % 4),
      m = new THREE.Mesh(new THREE.DodecahedronGeometry(1, 1), cliffMat);
    m.position.set(Math.sin(a) * radx, -3, Math.cos(a) * radz);
    m.scale.set(4 + (i % 3), 5, 4 + (i % 4));
    m.rotation.set(i * 0.3, i * 0.7, 0.2);
    m.castShadow = m.receiveShadow = true;
    m.userData.ownedGeometry = true;
    details.add(m);
  }
  const lighthouse = joint(details, -54, -1, -45);
  cylinder(lighthouse, 0, 6, 0, 1.6, 13, trim, false, 1.05);
  for (const y of [1, 11.9])
    cylinder(lighthouse, 0, y, 0, 1.78, 0.25, 0xc78d64);
  cylinder(lighthouse, 0, 13, 0, 1.34, 1.4, material(0x88b7b5, 0.65));
  cylinder(lighthouse, 0, 13.85, 0, 1.7, 0.35, roof, false, 0);
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
  boat(details, 46, -0.84, 26, 0.2, 0xaf6652);
  boat(details, -47, -0.86, 25, -0.35, 0xe2d5b7);
  boat(details, 62, -0.9, -5, 0.5, 0xf0dfb3);
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
