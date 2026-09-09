import * as THREE from "three";
import {
  box,
  cylinder,
  ellipsoid,
  joint,
  material,
  bake,
  silhouette,
} from "./geometry.js";
import { finish, stamp, stampMaterial } from "./weapon-surfaces.js";

export function ring(parent, x, y, z, r, t, color, axis = "z") {
  const m = new THREE.Mesh(
    new THREE.TorusGeometry(r, t, 6, 24),
    typeof color === "number" ? material(color, 0.5) : color,
  );
  m.userData.ownedGeometry = true;
  m.position.set(x, y, z);
  if (axis === "y") m.rotation.x = Math.PI / 2;
  parent.add(m);
  return m;
}
export function wire(parent, points, color, r = 0.007) {
  const curve = new THREE.CatmullRomCurve3(
    points.map((p) => new THREE.Vector3(...p)),
  );
  const m = new THREE.Mesh(
    new THREE.TubeGeometry(curve, Math.max(6, points.length * 4), r, 6, false),
    typeof color === "number" ? material(color, 0.2) : color,
  );
  m.userData.ownedGeometry = true;
  parent.add(m);
  return m;
}
function panel(
  parent,
  points,
  depth,
  mat,
  position = [0, 0, 0],
  bevel = 0.006,
) {
  const shape = new THREE.Shape();
  points.forEach(([x, y], i) => (i ? shape.lineTo(x, y) : shape.moveTo(x, y)));
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelSegments: 2,
    bevelSize: bevel,
    bevelThickness: bevel * 0.65,
    steps: 1,
  });
  geo.translate(0, 0, -depth / 2);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(...position);
  mesh.castShadow = mesh.receiveShadow = true;
  mesh.userData.ownedGeometry = true;
  parent.add(mesh);
  return mesh;
}
function lathe(parent, points, mat, y = 0) {
  const geo = new THREE.LatheGeometry(
    points.map((p) => new THREE.Vector2(...p)),
    28,
  );
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = y;
  mesh.castShadow = mesh.receiveShadow = true;
  mesh.userData.ownedGeometry = true;
  parent.add(mesh);
  return mesh;
}
function screw(parent, x, y, z, mat, r = 0.006) {
  cylinder(parent, x, y, z, r, 0.004, mat, true);
  box(parent, x, y, z - 0.003, r * 1.1, 0.0015, 0.001, 0x354c40);
  box(parent, x, y, z - 0.003, 0.0015, r * 1.1, 0.001, 0x354c40);
}
function fragmentTile(parent, phi0, phi1, theta0, theta1, mat) {
  const vertices = [],
    uvs = [],
    indices = [],
    segments = 4;
  const pos = (phi, theta, r = 1) => [
    Math.sin(theta) * Math.sin(phi) * 0.094 * r,
    Math.cos(theta) * 0.126 * r,
    Math.sin(theta) * Math.cos(phi) * 0.094 * r,
  ];
  for (let j = 0; j <= segments; j++)
    for (let i = 0; i <= segments; i++) {
      vertices.push(
        ...pos(
          phi0 + ((phi1 - phi0) * i) / segments,
          theta0 + ((theta1 - theta0) * j) / segments,
        ),
      );
      uvs.push(i / segments, j / segments);
    }
  for (let j = 0; j < segments; j++)
    for (let i = 0; i < segments; i++) {
      const a = j * (segments + 1) + i;
      indices.push(
        a,
        a + segments + 1,
        a + 1,
        a + segments + 1,
        a + segments + 2,
        a + 1,
      );
    }
  for (const edge of [
    Array.from({ length: 5 }, (_, i) => [
      phi0 + ((phi1 - phi0) * i) / 4,
      theta0,
    ]),
    Array.from({ length: 5 }, (_, i) => [
      phi1,
      theta0 + ((theta1 - theta0) * i) / 4,
    ]),
    Array.from({ length: 5 }, (_, i) => [
      phi1 - ((phi1 - phi0) * i) / 4,
      theta1,
    ]),
    Array.from({ length: 5 }, (_, i) => [
      phi0,
      theta1 - ((theta1 - theta0) * i) / 4,
    ]),
  ]) {
    for (let i = 0; i < 4; i++) {
      const a = vertices.length / 3;
      vertices.push(
        ...pos(...edge[i]),
        ...pos(...edge[i + 1]),
        ...pos(...edge[i + 1], 0.93),
        ...pos(...edge[i], 0.93),
      );
      uvs.push(0, 0, 1, 0, 1, 1, 0, 1);
      indices.push(a, a + 1, a + 2, a, a + 2, a + 3);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = mesh.receiveShadow = true;
  mesh.userData.ownedGeometry = true;
  parent.add(mesh);
}
function fuseAssembly(parent, top, kind) {
  const steel = finish("metal", 0x626f5f),
    edge = finish("edge", 0xa4aa8e),
    dark = finish("metal", 0x354439);
  lathe(
    parent,
    [
      [0, 0],
      [0.029, 0],
      [0.034, 0.006],
      [0.033, 0.026],
      [0.026, 0.031],
      [0, 0.031],
    ],
    steel,
    top,
  );
  for (const y of [top + 0.005, top + 0.014])
    ring(parent, 0, y, 0, 0.033, 0.0025, edge, "y");
  const spoon = joint(parent, 0, top + 0.023, 0);
  spoon.name = "spoon";
  panel(
    spoon,
    [
      [-0.028, 0.011],
      [0.039, 0.011],
      [0.068, -0.047],
      [0.09, -0.128],
      [0.089, -0.196],
      [0.075, -0.197],
      [0.075, -0.13],
      [0.055, -0.05],
      [0.032, -0.004],
      [-0.028, -0.004],
    ],
    0.024,
    edge,
    [0, 0, 0],
    0.002,
  );
  for (const z of [-0.017, 0.017]) {
    const hinge = cylinder(
      parent,
      0.02,
      top + 0.025,
      z,
      0.012,
      0.004,
      dark,
      true,
    );
    screw(parent, 0.02, top + 0.025, z - 0.003, edge, 0.005);
  }
  const pull = joint(parent, -0.044, top + 0.028, -0.003);
  pull.name = "pullRing";
  wire(
    pull,
    [
      [0.035, -0.003, 0],
      [0.013, 0.007, 0],
      [-0.003, 0.018, 0],
    ],
    edge,
    0.0025,
  );
  ring(pull, -0.012, 0.019, 0, 0.026, 0.0032, edge);
  ring(pull, -0.012, 0.019, 0.003, 0.023, 0.0015, 0x65755f);
  cylinder(parent, 0.011, top + 0.024, 0, 0.004, 0.072, edge).rotation.z =
    Math.PI / 2;
  return { spoon, pull };
}
export function grenadeModel(kind = "he") {
  const g = new THREE.Group();
  g.name = kind;
  const dark = finish("metal", 0x344335),
    edge = finish("edge", 0x98a18d);
  if (kind === "he") {
    ellipsoid(g, 0, 0, 0, 0.088, 0.121, 0.088, finish("polymer", 0x334630));
    const body = finish("metal", 0x667c42);
    for (let row = 0; row < 5; row++)
      for (let col = 0; col < 10; col++) {
        const t0 = 0.29 + row * 0.508 + 0.025,
          t1 = 0.29 + (row + 1) * 0.508 - 0.025,
          p0 = (col * Math.PI) / 5 + 0.027,
          p1 = ((col + 1) * Math.PI) / 5 - 0.027;
        fragmentTile(g, p0, p1, t0, t1, body);
      }
    cylinder(g, 0, -0.115, 0, 0.04, 0.017, dark);
    ring(g, 0, 0.103, 0, 0.049, 0.005, 0xbbaa64, "y");
    const ink = new THREE.Mesh(
      new THREE.CylinderGeometry(
        0.095,
        0.095,
        0.034,
        24,
        1,
        true,
        Math.PI - 0.56,
        1.12,
      ),
      stampMaterial("HE / 02", "CL FIELD  •  FRAGMENT", "#d7cc98"),
    );
    ink.position.y = 0.004;
    ink.userData.ownedGeometry = true;
    g.add(ink);
    fuseAssembly(g, 0.111, kind);
  } else if (kind === "flash") {
    const shell = finish("metal", 0xa5aba0);
    lathe(
      g,
      [
        [0, -0.142],
        [0.056, -0.142],
        [0.069, -0.132],
        [0.071, -0.105],
        [0.06, -0.091],
        [0.059, 0.086],
        [0.068, 0.101],
        [0.065, 0.126],
        [0.052, 0.136],
        [0, 0.136],
      ],
      shell,
    );
    cylinder(g, 0, -0.005, 0, 0.059, 0.194, dark);
    // Ported outer cage is genuinely open between ribs, not painted black dots.
    for (let i = 0; i < 10; i++) {
      const a = (i * Math.PI) / 5,
        rib = box(
          g,
          Math.sin(a) * 0.061,
          0,
          Math.cos(a) * 0.061,
          0.019,
          0.198,
          0.015,
          shell,
          0,
          0.005,
        );
      rib.rotation.y = a;
    }
    for (const y of [-0.095, -0.039, 0.039, 0.094])
      ring(g, 0, y, 0, 0.064, 0.007, shell, "y");
    for (const y of [-0.119, 0.115]) ring(g, 0, y, 0, 0.069, 0.004, edge, "y");
    box(
      g,
      0,
      0,
      -0.071,
      0.064,
      0.044,
      0.008,
      finish("polymer", 0xc4ac64),
      0,
      0.004,
    );
    stamp(
      g,
      "FLASH",
      "CL / 03",
      [0, 0, -0.076],
      0.059,
      0.03,
      [0, Math.PI, 0],
      "#253f35",
    );
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3;
      screw(
        g,
        Math.sin(a) * 0.053,
        Math.cos(a) * 0.023 - 0.119,
        -0.048,
        edge,
        0.004,
      );
    }
    fuseAssembly(g, 0.139, kind);
  } else {
    const shell = finish("metal", 0x708878);
    lathe(
      g,
      [
        [0, -0.151],
        [0.056, -0.151],
        [0.071, -0.137],
        [0.073, -0.107],
        [0.071, 0.096],
        [0.065, 0.13],
        [0.055, 0.143],
        [0, 0.143],
      ],
      shell,
    );
    for (const y of [-0.128, -0.11, 0.103, 0.123])
      ring(g, 0, y, 0, 0.071, 0.004, edge, "y");
    cylinder(g, 0, -0.147, 0, 0.061, 0.015, dark);
    box(
      g,
      0,
      -0.011,
      -0.074,
      0.096,
      0.144,
      0.004,
      finish("polymer", 0xc8c8aa),
      0,
      0.006,
    );
    stamp(
      g,
      "SMOKE / S",
      "CROSSLINE  |  SCREEN",
      [0, 0.008, -0.077],
      0.087,
      0.046,
      [0, Math.PI, 0],
      "#35524a",
    );
    stamp(
      g,
      "15 SEC",
      "VISUAL SCREEN",
      [0, -0.05, -0.077],
      0.069,
      0.03,
      [0, Math.PI, 0],
      "#4c6358",
    );
    for (const y of [-0.066, 0.067])
      box(g, 0, y, -0.078, 0.082, 0.005, 0.003, 0xcc985d);
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      cylinder(
        g,
        Math.sin(a) * 0.045,
        0.145,
        Math.cos(a) * 0.045,
        0.007,
        0.003,
        dark,
      );
    }
    fuseAssembly(g, 0.147, kind);
  }
  bake(g);
  return g;
}
function screenMaterial() {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 96;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#152d29";
  ctx.fillRect(0, 0, 256, 96);
  ctx.fillStyle = "#8fc6a1";
  ctx.font = "10px Arial";
  ctx.fillText("CROSSLINE  /  FIELD CONTROLLER", 12, 14);
  const segments = [
      [4, 0, 20, 4],
      [25, 4, 4, 20],
      [25, 29, 4, 20],
      [4, 49, 20, 4],
      [0, 29, 4, 20],
      [0, 4, 4, 20],
      [4, 24, 20, 4],
    ],
    mask = [63, 6, 91, 79, 102, 109, 125, 7, 127, 111];
  for (const [i, d] of [0, 4, 3, 9].entries()) {
    const x = 20 + i * 48 + (i > 1 ? 9 : 0);
    for (let s = 0; s < 7; s++) {
      ctx.fillStyle = mask[d] & (1 << s) ? "#c3efbd" : "#254b3b";
      const [px, py, w, h] = segments[s];
      ctx.fillRect(x + px, 27 + py, w, h);
    }
  }
  ctx.fillStyle = "#c3efbd";
  ctx.fillRect(112, 40, 5, 5);
  ctx.fillRect(112, 62, 5, 5);
  ctx.font = "9px Arial";
  ctx.fillText("STANDBY", 202, 87);
  const map = new THREE.CanvasTexture(c);
  map.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshStandardMaterial({
    name: "Field controller LCD",
    map,
    roughness: 0.21,
    metalness: 0.1,
    emissive: 0x84bd94,
    emissiveMap: map,
    emissiveIntensity: 0.35,
  });
}
function keypad(parent) {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 192;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#d7d8bb";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "bold 33px Arial";
  const symbols = ["1", "2", "3", "A", "4", "5", "6", "B", "7", "8", "9", "↵"];
  symbols.forEach((s, i) =>
    ctx.fillText(s, (i % 4) * 64 + 32, Math.floor(i / 4) * 64 + 32),
  );
  const map = new THREE.CanvasTexture(c);
  map.colorSpace = THREE.SRGBColorSpace;
  const ink = new THREE.MeshStandardMaterial({
    map,
    transparent: true,
    roughness: 0.75,
    depthWrite: false,
  });
  for (let i = 0; i < 12; i++) {
    const x = 0.037 - (i % 4) * 0.047,
      y = 0.011 - Math.floor(i / 4) * 0.043;
    box(
      parent,
      x,
      y,
      -0.213,
      0.035,
      0.03,
      0.016,
      finish("polymer", i === 11 ? 0x8d8452 : 0x404f45),
      0,
      0.004,
    );
    const geo = new THREE.PlaneGeometry(0.029, 0.025),
      uv = geo.attributes.uv,
      col = i % 4,
      row = Math.floor(i / 4);
    for (let v = 0; v < uv.count; v++)
      uv.setXY(v, (col + uv.getX(v)) / 4, 1 - (row + 1 - uv.getY(v)) / 3);
    const text = new THREE.Mesh(geo, ink);
    text.position.set(x, y, -0.223);
    text.rotation.y = Math.PI;
    text.userData.ownedGeometry = true;
    parent.add(text);
  }
}
export function bombModel() {
  const g = new THREE.Group();
  g.name = "bomb";
  const olive = finish("metal", 0x647665),
    dark = finish("polymer", 0x2c3d34),
    tan = finish("fabric", 0xa0936c),
    edge = finish("edge", 0x9baf98);
  panel(
    g,
    [
      [-0.226, -0.16],
      [-0.241, -0.131],
      [-0.241, 0.124],
      [-0.208, 0.157],
      [0.21, 0.157],
      [0.241, 0.126],
      [0.241, -0.132],
      [0.216, -0.16],
    ],
    0.122,
    dark,
    [0, -0.011, 0.026],
    0.012,
  );
  // Pack modules, retaining bands and a rugged instrument chassis.
  for (const x of [-0.152, -0.05, 0.05, 0.152]) {
    box(g, x, -0.021, -0.077, 0.09, 0.303, 0.077, tan, 0, 0.014);
    for (const y of [-0.145, 0.117])
      box(g, x, y, -0.075, 0.095, 0.024, 0.083, olive, 0, 0.005);
    stamp(
      g,
      "CL / M",
      "FIELD MODULE",
      [x, -0.111, -0.119],
      0.07,
      0.027,
      [0, Math.PI, 0],
      "#e0d7b2",
    );
  }
  for (const x of [-0.177, 0.177]) {
    box(
      g,
      x,
      0,
      -0.114,
      0.031,
      0.354,
      0.022,
      finish("fabric", 0x354c38),
      0,
      0.005,
    );
    box(g, x, -0.094, -0.132, 0.049, 0.039, 0.015, edge, 0, 0.004);
    box(g, x, -0.094, -0.142, 0.03, 0.018, 0.004, dark, 0, 0.002);
    for (let i = 0; i < 6; i++)
      box(g, x, -0.038 + i * 0.02, -0.127, 0.017, 0.002, 0.001, 0x8d9677);
  }
  const face = panel(
    g,
    [
      [-0.155, -0.109],
      [-0.174, -0.088],
      [-0.174, 0.13],
      [-0.151, 0.15],
      [0.151, 0.15],
      [0.174, 0.127],
      [0.174, -0.09],
      [0.153, -0.109],
    ],
    0.071,
    olive,
    [0, 0.002, -0.157],
    0.008,
  );
  // Sealed front gasket sits proud of the main chassis.
  panel(
    g,
    [
      [-0.151, -0.097],
      [-0.16, -0.084],
      [-0.16, 0.122],
      [-0.145, 0.137],
      [0.146, 0.137],
      [0.16, 0.122],
      [0.16, -0.084],
      [0.146, -0.097],
    ],
    0.008,
    dark,
    [0, 0.002, -0.198],
    0.004,
  );
  box(g, -0.024, 0.088, -0.207, 0.252, 0.088, 0.016, edge, 0, 0.008);
  box(g, -0.024, 0.088, -0.218, 0.232, 0.071, 0.007, dark, 0, 0.005);
  const display = new THREE.Mesh(
    new THREE.PlaneGeometry(0.218, 0.061),
    screenMaterial(),
  );
  display.position.set(-0.024, 0.088, -0.223);
  display.rotation.y = Math.PI;
  display.name = "display";
  display.userData.dynamic = true;
  display.userData.ownedGeometry = true;
  g.add(display);
  keypad(g);
  for (const x of [-0.151, 0.151])
    for (const y of [-0.08, 0.125]) screw(g, x, y, -0.208, edge, 0.005);
  for (const y of [-0.066, -0.038, -0.01]) {
    box(g, 0.135, y, -0.205, 0.008, 0.016, 0.004, 0x171f1b, 0, 0.002);
    box(g, 0.132, y, -0.209, 0.002, 0.008, 0.002, 0xb0b69d);
  }
  const led = ellipsoid(
    g,
    0.126,
    0.09,
    -0.214,
    0.011,
    0.011,
    0.008,
    new THREE.MeshStandardMaterial({
      color: 0xe9b365,
      emissive: 0xe7a64a,
      emissiveIntensity: 1,
      roughness: 0.25,
    }),
  );
  led.name = "led";
  led.userData.dynamic = true;
  ring(g, 0.126, 0.09, -0.211, 0.014, 0.003, edge);
  stamp(
    g,
    "CX • FIELD",
    "CONTROLLER / V2",
    [0.03, -0.089, -0.207],
    0.119,
    0.022,
    [0, Math.PI, 0],
    "#aab89c",
  );
  // Wires terminate in visible plugged sockets, not disconnected floating ends.
  for (const [i, color] of [0xcb7455, 0xd2b56e, 0x588d9b].entries()) {
    const x = 0.095 - i * 0.032;
    cylinder(g, x, 0.163, -0.13, 0.013, 0.024, dark);
    ring(g, x, 0.176, -0.13, 0.012, 0.003, edge, "y");
    wire(
      g,
      [
        [x, 0.177, -0.13],
        [0.2 + i * 0.017, 0.219 + i * 0.012, -0.13],
        [0.226 + i * 0.009, 0.193, -0.027],
        [0.15 - i * 0.054, 0.177, 0.046],
        [0.13 - i * 0.069, 0.12, 0.057],
      ],
      color,
      0.006,
    );
    cylinder(g, 0.13 - i * 0.069, 0.12, 0.057, 0.012, 0.023, edge);
    ring(g, 0.13 - i * 0.069, 0.133, 0.057, 0.012, 0.003, dark, "y");
  }
  const carry = joint(g, 0, 0, 0);
  carry.name = "carryHandle";
  wire(
    carry,
    [
      [-0.128, 0.141, 0.04],
      [-0.12, 0.257, 0.047],
      [-0.071, 0.286, 0.05],
      [0.077, 0.286, 0.05],
      [0.12, 0.255, 0.047],
      [0.127, 0.141, 0.04],
    ],
    dark,
    0.012,
  );
  for (let i = 0; i < 9; i++)
    box(
      carry,
      -0.064 + i * 0.016,
      0.283,
      0.049,
      0.008,
      0.033,
      0.034,
      finish("polymer", 0x52634b),
      0,
      0.003,
    );
  for (const x of [-0.202, 0.202])
    for (const y of [-0.1, 0.096]) screw(g, x, y, -0.026, edge, 0.008);
  bake(g);
  return g;
}
export function knifeModel() {
  const g = new THREE.Group();
  g.name = "knife";
  const steel = finish("edge", 0xb9c8c4),
    dark = finish("metal", 0x506c6b),
    grip = finish("polymer", 0x435745);
  silhouette(
    g,
    [
      [-0.16, 0.044],
      [-0.43, 0.049],
      [-0.56, 0.018],
      [-0.65, -0.039],
      [-0.41, -0.063],
      [-0.2, -0.057],
    ],
    0.017,
    steel,
  );
  silhouette(
    g,
    [
      [-0.18, 0.045],
      [-0.43, 0.048],
      [-0.562, 0.018],
      [-0.583, -0.006],
      [-0.4, -0.025],
      [-0.19, -0.023],
    ],
    0.019,
    dark,
  );
  for (const s of [-1, 1]) {
    wire(
      g,
      [
        [s * 0.012, 0.012, -0.24],
        [s * 0.012, 0.018, -0.43],
        [s * 0.012, 0.002, -0.51],
      ],
      0x8baba7,
      0.004,
    );
    stamp(
      g,
      "C / 02",
      "FIELD STEEL",
      [s * 0.013, 0.002, -0.3],
      0.103,
      0.025,
      [0, (s * Math.PI) / 2, 0],
      "#9eccc4",
    );
  }
  for (let i = 0; i < 6; i++)
    box(
      g,
      0,
      0.044,
      -0.192 - i * 0.018,
      0.023,
      0.014,
      0.007,
      0x3c5553,
      0,
      0.0015,
    );
  silhouette(
    g,
    [
      [-0.169, 0.024],
      [-0.161, 0.077],
      [-0.134, 0.075],
      [-0.14, -0.075],
      [-0.165, -0.076],
    ],
    0.114,
    dark,
  );
  silhouette(
    g,
    [
      [-0.13, 0.036],
      [-0.102, 0.045],
      [0.077, 0.039],
      [0.12, 0.018],
      [0.126, -0.025],
      [0.087, -0.048],
      [-0.112, -0.042],
    ],
    0.066,
    grip,
  );
  for (const s of [-1, 1]) {
    const face = silhouette(
      g,
      [
        [-0.101, 0.026],
        [0.07, 0.027],
        [0.098, 0.007],
        [0.08, -0.035],
        [-0.084, -0.032],
      ],
      0.004,
      finish("polymer", 0x6a7759),
    );
    face.position.x = s * 0.034;
    for (const z of [-0.066, 0.067]) {
      const bolt = cylinder(g, s * 0.04, 0, z, 0.009, 0.005, steel);
      bolt.rotation.z = Math.PI / 2;
    }
    for (let i = 0; i < 9; i++)
      wire(
        g,
        [
          [s * 0.04, 0.021, -0.082 + i * 0.018],
          [s * 0.04, -0.026, -0.07 + i * 0.018],
        ],
        0x34493a,
        0.0025,
      );
  }
  cylinder(g, 0, 0, 0.119, 0.024, 0.019, dark, true);
  ring(g, 0, 0, 0.131, 0.017, 0.005, steel);
  wire(
    g,
    [
      [0.011, -0.02, 0.13],
      [0.033, -0.099, 0.15],
      [-0.017, -0.113, 0.149],
      [-0.012, -0.03, 0.133],
    ],
    0x5c6a47,
    0.0035,
  );
  bake(g);
  return g;
}
