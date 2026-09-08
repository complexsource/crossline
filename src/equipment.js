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

export function ring(parent, x, y, z, r, t, color, axis = "z") {
  const m = new THREE.Mesh(
    new THREE.TorusGeometry(r, t, 6, 24),
    material(color, 0.5),
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
    ),
    m = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 20, r, 6, false),
      material(color, 0.2),
    );
  m.userData.ownedGeometry = true;
  parent.add(m);
  return m;
}
export function grenadeModel(kind = "he") {
  const g = new THREE.Group();
  g.name = kind;
  const color =
    kind === "he" ? 0x697647 : kind === "flash" ? 0xa9a99c : 0x879c8c;
  if (kind === "he") {
    ellipsoid(g, 0, 0, 0, 0.091, 0.125, 0.091, material(color, 0.32));
    for (let i = 0; i < 4; i++)
      ring(
        g,
        0,
        -0.075 + i * 0.05,
        0,
        0.079 + Math.sin((i / 3) * Math.PI) * 0.011,
        0.004,
        0x3d4b31,
        "y",
      );
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      wire(
        g,
        [
          [Math.sin(a) * 0.06, -0.1, Math.cos(a) * 0.06],
          [Math.sin(a) * 0.094, 0, Math.cos(a) * 0.094],
          [Math.sin(a) * 0.06, 0.1, Math.cos(a) * 0.06],
        ],
        0x414b32,
        0.003,
      );
    }
  } else {
    cylinder(g, 0, 0, 0, 0.072, 0.26, material(color, 0.45));
    cylinder(g, 0, -0.13, 0, 0.074, 0.024, material(0x343c38, 0.6));
    for (const y of [-0.095, 0.07])
      ring(g, 0, y, 0, 0.073, 0.009, 0x414b43, "y");
    box(
      g,
      0,
      -0.015,
      -0.073,
      0.066,
      0.07,
      0.003,
      kind === "smoke" ? 0xe6ede0 : 0xffcb6c,
      0,
      0.003,
    );
    if (kind === "flash")
      for (let i = 0; i < 8; i++)
        for (const y of [-0.08, 0.08]) {
          const a = (i * Math.PI) / 4;
          ellipsoid(
            g,
            Math.sin(a) * 0.071,
            y,
            Math.cos(a) * 0.071,
            0.008,
            0.012,
            0.008,
            0x303a36,
          );
        }
  }
  cylinder(g, 0, 0.14, 0, 0.032, 0.043, material(0x414941, 0.7));
  box(g, 0.054, 0.083, 0, 0.015, 0.19, 0.04, 0xacb19c, 0.7, 0.004).rotation.z =
    0.15;
  ring(g, -0.044, 0.157, 0, 0.028, 0.0035, 0xc0c5b3);
  bake(g);
  return g;
}
export function bombModel() {
  const g = new THREE.Group();
  g.name = "bomb";
  const body = material(0x586354, 0.35),
    rubber = material(0x293b36, 0.1),
    tan = material(0xcab282, 0.15);
  box(g, 0, 0, 0, 0.42, 0.24, 0.17, rubber, 0, 0.025);
  for (const x of [-0.145, -0.048, 0.048, 0.145]) {
    cylinder(g, x, -0.055, -0.1, 0.041, 0.28, tan);
    box(g, x, 0.05, -0.148, 0.057, 0.013, 0.007, 0x8b634d, 0, 0.002);
  }
  for (const x of [-0.14, 0.14])
    box(g, x, 0, -0.149, 0.035, 0.29, 0.025, 0x304139, 0, 0.005);
  box(g, 0, 0.055, -0.19, 0.32, 0.21, 0.07, body, 0, 0.014);
  box(g, -0.035, 0.107, -0.23, 0.21, 0.073, 0.009, 0x132d27, 0, 0.005);
  const display = box(
    g,
    -0.035,
    0.107,
    -0.236,
    0.18,
    0.046,
    0.003,
    new THREE.MeshStandardMaterial({
      color: 0x9fe9b9,
      emissive: 0x498953,
      emissiveIntensity: 0.4,
    }),
  );
  display.name = "display";
  display.userData.dynamic = true;
  for (let col = 0; col < 5; col++)
    for (let row = 0; row < 2; row++)
      box(
        g,
        -0.098 + col * 0.04,
        0.04 - row * 0.036,
        -0.235,
        0.028,
        0.025,
        0.007,
        0xced4b8,
        0,
        0.004,
      );
  for (const x of [-0.14, 0.14])
    for (const y of [-0.03, 0.14])
      ellipsoid(g, x, y, -0.231, 0.006, 0.006, 0.003, 0xd0d1ae);
  const led = ellipsoid(
    g,
    0.112,
    0.105,
    -0.233,
    0.013,
    0.013,
    0.006,
    new THREE.MeshStandardMaterial({
      color: 0xefad57,
      emissive: 0xff5720,
      emissiveIntensity: 1,
    }),
  );
  led.name = "led";
  led.userData.dynamic = true;
  for (const [i, c] of [0xdd745e, 0xe2bc65, 0x467aa1].entries())
    wire(
      g,
      [
        [0.17 - i * 0.025, 0.1, -0.2],
        [0.23, 0.19 + i * 0.012, -0.19],
        [0.24 - i * 0.02, 0.25, -0.05],
        [-0.08 + i * 0.06, 0.18, 0],
      ],
      c,
      0.007,
    );
  bake(g);
  return g;
}
export function knifeModel() {
  const g = new THREE.Group();
  g.name = "knife";
  silhouette(
    g,
    [
      [-0.17, 0.037],
      [-0.49, 0.044],
      [-0.64, -0.039],
      [-0.2, -0.049],
    ],
    0.023,
    material(0xc6d4d4, 0.85),
  );
  silhouette(
    g,
    [
      [-0.22, 0.023],
      [-0.46, 0.029],
      [-0.59, -0.031],
      [-0.25, -0.016],
    ],
    0.025,
    material(0x657e82, 0.8),
  );
  box(g, 0, 0, -0.16, 0.15, 0.019, 0.03, 0x879a93, 0.6, 0.007);
  box(g, 0, 0, -0.015, 0.065, 0.08, 0.255, 0x424e45, 0, 0.016);
  for (let i = 0; i < 7; i++)
    box(g, 0, 0, -0.11 + i * 0.032, 0.071, 0.085, 0.012, 0x69715d, 0, 0.004);
  ring(g, 0, 0, 0.108, 0.021, 0.005, 0xb3bca4);
  bake(g);
  return g;
}
