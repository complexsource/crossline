import * as THREE from "three";
import {
  box,
  cylinder,
  ellipsoid,
  garment,
  joint,
  material,
  bake,
} from "./geometry.js";
import { ring, wire, grenadeModel } from "./equipment.js";

let scarf;
function scarfMaterial() {
  if (scarf) return scarf;
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const x = c.getContext("2d");
  x.fillStyle = "#c5b699";
  x.fillRect(0, 0, 128, 128);
  x.fillStyle = "#524d3e";
  for (let i = -1; i < 5; i++)
    for (let j = -1; j < 5; j++) {
      x.save();
      x.translate(i * 32 + 16, j * 32 + 16);
      x.rotate(Math.PI / 4);
      x.fillRect(-9, -9, 18, 18);
      x.fillRect(-15, -3, 30, 6);
      x.restore();
    }
  const map = new THREE.CanvasTexture(c);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(3, 2);
  scarf = new THREE.MeshStandardMaterial({
    map,
    roughness: 0.92,
    color: 0xf4e2c1,
  });
  return scarf;
}
function j(parent, name, x, y, z) {
  const g = joint(parent, x, y, z);
  g.name = name;
  return g;
}
function pouch(p, x, y, z, w = 0.09, h = 0.13, cloth = material(0x7d8062)) {
  box(p, x, y, z, w, h, 0.068, cloth, 0, 0.014);
  box(p, x, y + h * 0.3, z - 0.039, w * 0.95, h * 0.26, 0.017, cloth, 0, 0.007);
  box(p, x, y - 0.014, z - 0.041, 0.022, 0.062, 0.009, 0x434e39, 0, 0.003);
  box(p, x, y - 0.035, z - 0.047, 0.031, 0.022, 0.009, 0xa2ab87, 0.5, 0.004);
}
export function glove(parent, x, y, z, terrorist = false) {
  const g = joint(parent, x, y, z),
    m = material(terrorist ? 0x564c3d : 0x5d7252),
    skin = material(0xc08a5b);
  ellipsoid(g, 0, 0, 0, 0.047, 0.058, 0.039, m);
  box(
    g,
    0,
    0.004,
    -0.028,
    0.075,
    0.055,
    0.018,
    terrorist ? 0x71624b : 0x7f8c62,
    0,
    0.014,
  );
  for (let i = 0; i < 4; i++) {
    const finger = joint(g, -0.031 + i * 0.021, -0.032, -0.026);
    box(finger, 0, -0.012, 0, 0.018, 0.05, 0.024, m, 0, 0.008).rotation.x =
      -0.34;
    ellipsoid(
      finger,
      0,
      -0.038,
      0.006,
      0.009,
      0.012,
      0.013,
      terrorist ? skin : m,
    );
  }
  ellipsoid(g, 0.045, 0, -0.018, 0.017, 0.036, 0.02, m);
  return g;
}
function face(head, terrorist) {
  const skin = material(terrorist ? 0xca9567 : 0xe0ae79),
    hair = material(0x40392d),
    brow = material(0x3f3529),
    white = material(0xf5f0db);
  cylinder(head, 0, -0.192, 0.012, 0.071, 0.13, skin);
  const geo = new THREE.SphereGeometry(1, 48, 32),
    positions = geo.attributes.position,
    colors = [];
  for (let i = 0; i < positions.count; i++) {
    let x = positions.getX(i) * 0.174,
      y = positions.getY(i) * 0.216,
      z = positions.getZ(i) * 0.15;
    if (y < -0.04) x *= 1 + (y + 0.04) * 1.1;
    if (z < 0) {
      const cheeks =
          Math.exp(
            -(((Math.abs(x) - 0.085) / 0.045) ** 2) -
              ((y + 0.055) / 0.055) ** 2,
          ) * 0.019,
        nose =
          Math.exp(-((x / 0.027) ** 2) - ((y + 0.032) / 0.052) ** 2) * 0.042;
      z -= cheeks + nose;
    }
    positions.setXYZ(i, x, y, z);
    const color =
      terrorist && (y < -0.115 || (Math.abs(x) > 0.132 && y < 0.02))
        ? hair.color
        : skin.color;
    colors.push(color.r, color.g, color.b);
  }
  geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const faceMesh = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 }),
  );
  faceMesh.userData.ownedGeometry = faceMesh.userData.ownedMaterial = true;
  faceMesh.castShadow = true;
  head.add(faceMesh);
  for (const s of [-1, 1]) {
    ellipsoid(head, s * 0.174, -0.017, 0, 0.033, 0.059, 0.03, skin);
    ellipsoid(head, s * 0.184, -0.014, -0.016, 0.014, 0.033, 0.012, 0xb17b54);
    // Sculpted cheek, socket, sclera, iris, pupil and catchlight.
    ellipsoid(head, s * 0.07, 0.026, -0.14, 0.04, 0.046, 0.015, 0xa77750);
    ellipsoid(head, s * 0.07, 0.027, -0.151, 0.035, 0.04, 0.016, white);
    ellipsoid(head, s * 0.068, 0.024, -0.165, 0.021, 0.029, 0.01, 0x815432);
    ellipsoid(head, s * 0.068, 0.024, -0.174, 0.013, 0.022, 0.006, 0x1d2420);
    ellipsoid(head, s * 0.06, 0.035, -0.18, 0.004, 0.006, 0.003, white);
    wire(
      head,
      [
        [s * 0.028, 0.082, -0.153],
        [s * 0.07, 0.097, -0.153],
        [s * 0.12, 0.081, -0.128],
      ],
      0x49382b,
      0.012,
    );
  }
  if (terrorist) {
    for (const s of [-1, 1])
      wire(
        head,
        [
          [s * 0.009, -0.067, -0.162],
          [s * 0.049, -0.061, -0.154],
          [s * 0.092, -0.082, -0.133],
        ],
        0x403428,
        0.013,
      );
  }
  // Small smile inset; not a flat face decal.
  wire(
    head,
    [
      [-0.05, -0.103, -0.143],
      [0, -0.116, -0.157],
      [0.05, -0.103, -0.143],
    ],
    0x79513b,
    0.006,
  );
  const hairCap = new THREE.Mesh(
    new THREE.SphereGeometry(1, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.6),
    hair,
  );
  hairCap.scale.set(0.174, 0.14, 0.151);
  hairCap.position.y = 0.099;
  hairCap.userData.ownedGeometry = true;
  head.add(hairCap);
  for (let i = 0; i < 4; i++)
    ellipsoid(
      head,
      -0.09 + i * 0.052,
      0.12 - Math.sin(i) * 0.012,
      -0.116,
      0.045,
      0.052,
      0.029,
      hair,
    ).rotation.z = -0.5;
}
export function characterModel(team) {
  const terrorist = team === "terrorists",
    root = new THREE.Group(),
    body = j(root, "body", 0, 0, 0),
    uniform = material(terrorist ? 0xa89c7c : 0x829b70),
    pants = material(terrorist ? 0x776f59 : 0x788b60),
    gear = material(terrorist ? 0x6c5c44 : 0x697655),
    dark = material(terrorist ? 0x413d32 : 0x3a4e39),
    skin = material(terrorist ? 0xca9567 : 0xe0ae79);
  root.name = terrorist ? "terrorist" : "soldier";
  garment(body, 0, 1.14, 0, 0.222, 0.292, 0.139, uniform);
  garment(body, 0, 0.925, 0, 0.221, 0.135, 0.145, pants);
  if (terrorist) {
    garment(body, 0, 0.95, -0.003, 0.244, 0.18, 0.157, uniform);
    for (const s of [-1, 1])
      box(
        body,
        s * 0.162,
        1.18,
        -0.132,
        0.116,
        0.4,
        0.037,
        gear,
        0,
        0.029,
      ).rotation.z = s * 0.1;
    wire(
      body,
      [
        [-0.14, 1.4, -0.095],
        [0, 1.2, -0.167],
        [0.2, 1, -0.04],
      ],
      0x584d3b,
      0.021,
    );
    const scarf = garment(
      body,
      0,
      1.43,
      -0.014,
      0.251,
      0.11,
      0.172,
      scarfMaterial(),
    );
    scarf.rotation.z = 0.08;
    const drape = garment(
      body,
      0.094,
      1.269,
      -0.169,
      0.095,
      0.204,
      0.027,
      scarfMaterial(),
    );
    drape.rotation.z = -0.49;
    const tail = garment(
      body,
      0.251,
      1.345,
      0.08,
      0.063,
      0.217,
      0.033,
      scarfMaterial(),
    );
    tail.rotation.z = 0.5;
    for (let i = 0; i < 7; i++)
      wire(
        body,
        [
          [0.02 + i * 0.022, 1.15, -0.202],
          [0.012 + i * 0.023, 1.11 - (i % 2) * 0.016, -0.2],
        ],
        0xc6bb9b,
        0.003,
      );
    for (const s of [-1, 1])
      pouch(body, s * 0.174, 1.015, -0.181, 0.109, 0.156, gear);
    for (let i = 0; i < 3; i++)
      box(
        body,
        -0.095 + i * 0.035,
        1.034,
        -0.16,
        0.016,
        0.165,
        0.015,
        0xb08f59,
        0,
        0.005,
      );
  } else {
    box(body, 0, 1.224, -0.139, 0.373, 0.34, 0.066, gear, 0, 0.047);
    box(body, 0, 1.215, 0.153, 0.332, 0.37, 0.102, gear, 0, 0.05);
    for (const s of [-1, 1]) {
      box(body, s * 0.147, 1.431, 0, 0.063, 0.049, 0.29, gear, 0, 0.013);
      pouch(body, s * 0.179, 1.19, 0.195, 0.105, 0.19, gear);
    }
    for (let i = -1; i <= 1; i++)
      pouch(body, i * 0.112, 1.19, -0.202, 0.096, 0.156, gear);
    for (let row = 0; row < 2; row++)
      for (let col = -2; col <= 2; col++)
        box(
          body,
          col * 0.059,
          1.344 - row * 0.035,
          -0.178,
          0.047,
          0.014,
          0.012,
          0xa1aa7e,
          0,
          0.003,
        );
    box(body, -0.2, 1.359, 0.075, 0.062, 0.116, 0.067, dark, 0, 0.01);
    cylinder(body, -0.2, 1.486, 0.072, 0.008, 0.21, 0x354635);
    const grenade = grenadeModel("he");
    grenade.position.set(0.244, 1.05, 0.025);
    grenade.scale.setScalar(0.62);
    body.add(grenade);
  }
  box(body, 0, 0.96, 0, 0.461, 0.05, 0.315, dark, 0, 0.018);
  box(body, 0, 0.958, -0.177, 0.069, 0.047, 0.015, 0xa0a580, 0.65, 0.004);
  pouch(body, -0.23, 0.914, 0.012, 0.092, 0.13, gear);
  const head = j(body, "head", 0, 1.604, 0);
  face(head, terrorist);
  if (terrorist) {
    const wrap = new THREE.Mesh(
      new THREE.SphereGeometry(1, 32, 18, 0, Math.PI * 2, 0, Math.PI * 0.57),
      scarfMaterial(),
    );
    wrap.scale.set(0.2, 0.161, 0.184);
    wrap.position.set(0, 0.107, 0.014);
    wrap.rotation.z = 0.19;
    wrap.userData.ownedGeometry = true;
    head.add(wrap);
    const band = garment(
      head,
      0,
      0.126,
      -0.066,
      0.198,
      0.044,
      0.139,
      scarfMaterial(),
    );
    band.rotation.z = 0.14;
    const knot = garment(
      head,
      0.167,
      -0.014,
      0.128,
      0.06,
      0.126,
      0.06,
      scarfMaterial(),
    );
    knot.rotation.z = -0.5;
  } else {
    const helmet = new THREE.Mesh(
      new THREE.SphereGeometry(1, 32, 18, 0, Math.PI * 2, 0, Math.PI * 0.59),
      material(0x849976, 0.17),
    );
    helmet.scale.set(0.204, 0.173, 0.188);
    helmet.position.set(0, 0.098, 0.014);
    helmet.userData.ownedGeometry = true;
    head.add(helmet);
    const rim = ring(head, 0, 0.06, 0.015, 0.195, 0.012, 0x546c4e, "y");
    rim.scale.z = 0.97;
    for (const s of [-1, 1]) {
      box(head, s * 0.169, -0.019, 0.044, 0.041, 0.087, 0.068, dark, 0, 0.012);
      wire(
        head,
        [
          [s * 0.17, 0.029, -0.01],
          [s * 0.142, -0.151, -0.03],
          [s * 0.074, -0.18, -0.085],
        ],
        0x677755,
        0.009,
      );
      const goggles = j(head, `goggle-${s}`, s * 0.092, 0.17, -0.144);
      goggles.rotation.y = s * -0.2;
      box(goggles, 0, 0, 0, 0.157, 0.106, 0.042, 0x465646, 0, 0.021);
      box(
        goggles,
        0,
        0.003,
        -0.024,
        0.132,
        0.079,
        0.012,
        material(0x5f999b, 0.79),
        0,
        0.018,
      );
      wire(
        goggles,
        [
          [-0.05, 0.026, -0.032],
          [-0.015, 0.034, -0.032],
          [0.012, 0.032, -0.032],
        ],
        0xc3ddd0,
        0.003,
      );
    }
    box(head, 0, 0.165, -0.153, 0.039, 0.052, 0.036, 0x9a9f7f, 0, 0.01);
  }
  for (const [i, s] of [-1, 1].entries()) {
    const leg = j(body, `leg${i}`, s * 0.122, 0.874, 0);
    garment(leg, 0, -0.171, 0, 0.106, 0.221, 0.119, pants);
    pouch(leg, s * 0.079, -0.135, -0.053, 0.065, 0.127, gear);
    const knee = j(leg, `knee${i}`, 0, -0.365, 0);
    garment(knee, 0, -0.158, 0.01, 0.087, 0.199, 0.09, pants);
    if (!terrorist) {
      box(knee, 0, -0.015, -0.085, 0.13, 0.153, 0.048, dark, 0, 0.033);
      for (const y of [-0.061, 0.032])
        box(knee, 0, y, 0, 0.18, 0.028, 0.18, gear, 0, 0.006);
    } else {
      for (let n = 0; n < 4; n++)
        box(
          knee,
          0,
          -0.181 - n * 0.025,
          0.006,
          0.165,
          0.018,
          0.162,
          0xaca284,
          0,
          0.006,
        );
      box(leg, 0, -0.1, -0.116, 0.093, 0.126, 0.011, 0x8f8871, 0, 0.022);
    }
    const boot = material(terrorist ? 0x67543b : 0x526745),
      sole = material(0x303a2c);
    box(knee, 0, -0.351, -0.051, 0.191, 0.193, 0.304, boot, 0, 0.047);
    box(knee, 0, -0.411, -0.06, 0.2, 0.038, 0.316, sole, 0, 0.009);
    box(knee, 0, -0.344, -0.172, 0.17, 0.075, 0.08, 0x91a17a, 0, 0.025);
    for (let n = 0; n < 5; n++)
      wire(
        knee,
        [
          [-0.055, -0.281 - n * 0.016, -0.15],
          [0.051, -0.279 - n * 0.016, -0.152],
        ],
        0xb8b49b,
        0.0035,
      );
    const arm = j(body, `arm${i}`, s * 0.274, 1.402, 0);
    garment(arm, 0, -0.118, -0.015, 0.092, 0.16, 0.095, uniform);
    if (!terrorist) {
      box(
        arm,
        s * 0.068,
        -0.075,
        -0.028,
        0.035,
        0.101,
        0.119,
        0x67a0a5,
        0,
        0.012,
      );
      for (let n = 0; n < 2; n++)
        box(
          arm,
          s * 0.088,
          -0.063 + n * 0.024,
          -0.028,
          0.002,
          0.008,
          0.064,
          0xe6ebcb,
          0,
          0.002,
        );
    }
    const elbow = j(arm, `elbow${i}`, 0, -0.225, -0.023);
    garment(elbow, 0, -0.089, -0.052, 0.067, 0.13, 0.071, skin);
    box(elbow, 0, -0.18, -0.091, 0.13, 0.049, 0.14, dark, 0, 0.009);
    glove(elbow, 0, -0.228, -0.12, terrorist);
  }
  j(body, "weaponPivot", 0.156, 1.18, -0.355).scale.setScalar(0.66);
  bake(body);
  return root;
}
export function characterClips() {
  const rotation = (name, times, angles) =>
    new THREE.QuaternionKeyframeTrack(
      name + ".quaternion",
      times,
      angles.flatMap((a) =>
        new THREE.Quaternion()
          .setFromAxisAngle(new THREE.Vector3(1, 0, 0), a)
          .toArray(),
      ),
    );
  const tracks = (amp, seconds) =>
    [0, 1].flatMap((i) => [
      rotation(
        `leg${i}`,
        [0, seconds * 0.25, seconds * 0.5, seconds * 0.75, seconds],
        [0, amp * (i ? -1 : 1), 0, amp * (i ? 1 : -1), 0],
      ),
      rotation(
        `knee${i}`,
        [0, seconds * 0.25, seconds * 0.5, seconds * 0.75, seconds],
        [0, i ? 0.55 : 0, 0, i ? 0 : 0.55, 0],
      ),
    ]);
  return [
    new THREE.AnimationClip("walk", 0.8, tracks(0.52, 0.8)),
    new THREE.AnimationClip("run", 0.52, tracks(0.8, 0.52)),
    new THREE.AnimationClip("idle", 2, [
      new THREE.VectorKeyframeTrack(
        "body.position",
        [0, 1, 2],
        [0, 0, 0, 0, 0.008, 0, 0, 0, 0],
      ),
    ]),
  ];
}
