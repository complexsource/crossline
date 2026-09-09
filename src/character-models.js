import * as THREE from "three";
import { box, cylinder, ellipsoid, joint, material, bake } from "./geometry.js";
import { grenadeModel } from "./equipment.js";
import {
  loft,
  panel,
  seam,
  ribbon,
  textile,
  scarfSurface,
  mesh,
  consolidatePalette,
} from "./character-surfaces.js";

function j(parent, name, x, y, z) {
  const g = joint(parent, x, y, z);
  g.name = name;
  return g;
}
const clothEdge = () => textile(0xb7b297);
const hardware = () => material(0x929584, 0.62);

function pouch(
  parent,
  x,
  y,
  z,
  w,
  h,
  cloth,
  { ammo = false, flap = true } = {},
) {
  const g = joint(parent, x, y, z);
  loft(
    g,
    [
      [-h * 0.5, w * 0.33, 0.021, 0, 0.004],
      [-h * 0.43, w * 0.46, 0.033],
      [0, w * 0.49, 0.037],
      [h * 0.38, w * 0.46, 0.03],
      [h * 0.5, w * 0.38, 0.02],
    ],
    cloth,
    { rows: 14, segments: 16, square: 3.6, folds: 0.025 },
  );
  seam(
    g,
    [
      [-w * 0.44, h * 0.38, -0.032],
      [-w * 0.46, -h * 0.29, -0.036],
      [-w * 0.29, -h * 0.45, -0.026],
      [w * 0.31, -h * 0.45, -0.026],
      [w * 0.46, -h * 0.29, -0.036],
      [w * 0.44, h * 0.38, -0.032],
    ],
    clothEdge(),
    0.0018,
    20,
  );
  if (flap) {
    const f = panel(
      g,
      [
        [-w * 0.47, h * 0.45],
        [w * 0.47, h * 0.45],
        [w * 0.45, h * 0.18],
        [w * 0.25, h * 0.1],
        [-w * 0.32, h * 0.13],
      ],
      0.014,
      cloth,
      0.003,
    );
    f.position.z = -0.047;
    seam(
      g,
      [
        [-w * 0.4, h * 0.22, -0.051],
        [0, h * 0.14, -0.053],
        [w * 0.38, h * 0.24, -0.051],
      ],
      clothEdge(),
      0.0018,
    );
    box(
      g,
      0,
      h * 0.07,
      -0.06,
      0.018,
      h * 0.27,
      0.008,
      textile(0x414c3b),
      0,
      0.003,
    );
    box(g, 0, -h * 0.055, -0.064, 0.029, 0.021, 0.008, hardware(), 0, 0.003);
    box(
      g,
      0,
      -h * 0.055,
      -0.07,
      0.015,
      0.008,
      0.003,
      material(0x394234),
      0,
      0.001,
    );
  } else {
    seam(
      g,
      [
        [-w * 0.42, h * 0.42, -0.034],
        [0, h * 0.37, -0.046],
        [w * 0.42, h * 0.42, -0.034],
      ],
      textile(0x4b5440),
      0.004,
    );
    if (ammo) {
      box(
        g,
        0,
        h * 0.48,
        -0.004,
        w * 0.7,
        0.042,
        0.037,
        material(0x3c453e, 0.24),
        0,
        0.005,
      );
      for (const sx of [-1, 1])
        seam(
          g,
          [
            [sx * w * 0.37, h * 0.5, -0.028],
            [0, h * 0.25, -0.046],
            [sx * w * 0.3, h * 0.05, -0.04],
          ],
          textile(0x323c2e),
          0.003,
        );
    }
  }
  return g;
}

function strap(parent, points, width, cloth, edge = true) {
  const r = ribbon(parent, points, width, cloth, { ripple: 0.0015 });
  if (edge)
    for (const side of [-1, 1])
      seam(
        parent,
        points.map(([x, y, z]) => [x + side * width * 0.39, y, z - 0.002]),
        clothEdge(),
        0.0015,
      );
  return r;
}

export function glove(parent, x, y, z, terrorist = false, grip = "grip") {
  const g = joint(parent, x, y, z),
    fabric = textile(terrorist ? 0x635440 : 0x617263),
    rubber = material(terrorist ? 0x332f29 : 0x354137),
    skin = material(0xbd895d),
    edge = textile(terrorist ? 0x958367 : 0x8c9d7d);
  loft(
    g,
    [
      [-0.056, 0.025, 0.026, 0, 0.005],
      [-0.037, 0.042, 0.03],
      [-0.006, 0.046, 0.027],
      [0.035, 0.041, 0.022],
      [0.055, 0.03, 0.02],
    ],
    fabric,
    { rows: 14, segments: 16, square: 3, folds: 0.017 },
  );
  const pad = panel(
    g,
    [
      [-0.032, 0.023],
      [0.03, 0.025],
      [0.037, 0.008],
      [0.027, -0.018],
      [0, -0.025],
      [-0.032, -0.014],
      [-0.036, 0.008],
    ],
    0.01,
    rubber,
    0.004,
  );
  pad.position.z = -0.031;
  seam(
    g,
    [
      [-0.035, 0.035, -0.024],
      [-0.04, -0.01, -0.028],
      [-0.027, -0.039, -0.028],
    ],
    edge,
    0.0016,
  );
  for (let i = 0; i < 4; i++) {
    const sx = -0.032 + i * 0.021,
      length = [0.057, 0.069, 0.066, 0.05][i],
      bend = grip === "relaxed" ? 0.01 : grip === "support" ? 0.022 : 0.037;
    seam(
      g,
      [
        [sx, -0.029, -0.009],
        [sx, -0.049, -0.014],
        [sx, -0.03 - length * 0.7, bend * 0.35],
        [sx, -0.027 - length * 0.7, bend],
      ],
      fabric,
      0.0095,
      11,
    );
    for (let k = 0; k < 2; k++)
      box(
        g,
        sx,
        -0.041 - k * 0.018,
        -0.018 + k * 0.012,
        0.014,
        0.011,
        0.008,
        rubber,
        0,
        0.003,
      );
    ellipsoid(
      g,
      sx,
      -0.028 - length * 0.7,
      bend,
      0.0095,
      0.01,
      0.0095,
      terrorist ? skin : fabric,
    );
  }
  seam(
    g,
    [
      [0.033, 0.017, -0.001],
      [0.055, -0.004, 0.001],
      [0.052, -0.031, 0.016],
      [0.034, -0.043, 0.033],
    ],
    fabric,
    0.013,
    12,
  );
  box(g, 0, 0.047, 0, 0.074, 0.022, 0.055, rubber, 0, 0.007);
  box(g, -0.012, 0.049, -0.031, 0.045, 0.016, 0.007, edge, 0, 0.003);
  consolidatePalette(g);
  bake(g);
  return g;
}

function face(head, terrorist) {
  const skin = material(terrorist ? 0xc9966f : 0xdfae83),
    warm = material(terrorist ? 0xb18461 : 0xca9a76),
    lips = material(terrorist ? 0xa47555 : 0xc29371),
    hair = material(terrorist ? 0x302b25 : 0x3d382d),
    pale = material(0xe0dfcb),
    iris = material(terrorist ? 0x7b5939 : 0x657760),
    pupil = material(0x202824);
  loft(
    head,
    [
      [-0.28, 0.071, 0.067, 0, 0.017],
      [-0.19, 0.077, 0.07, 0, 0.014],
      [-0.13, 0.081, 0.077, 0, 0.012],
    ],
    skin,
    { rows: 10, segments: 20 },
  );
  const face = loft(
    head,
    [
      [-0.202, 0.024, 0.048, 0, -0.012],
      [-0.187, 0.071, 0.073, 0, -0.018],
      [-0.151, 0.115, 0.109, 0, -0.008],
      [-0.09, 0.142, 0.139],
      [-0.019, 0.159, 0.145],
      [0.061, 0.158, 0.145],
      [0.138, 0.147, 0.136],
      [0.205, 0.102, 0.1],
      [0.231, 0.001, 0.001],
    ],
    skin,
    { rows: 38, segments: 64, square: 2.22, uvScale: 1 },
  );
  const p = face.geometry.attributes.position,
    colors = [],
    gauss = (x, y, cx, cy, w, h) =>
      Math.exp(-(((x - cx) / w) ** 2) - ((y - cy) / h) ** 2);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i),
      y = p.getY(i);
    let z = p.getZ(i);
    const front = THREE.MathUtils.smoothstep(-z, 0.04, 0.125);
    z -=
      front *
      (gauss(x, y, 0, -0.01, 0.028, 0.062) * 0.03 +
        gauss(x, y, 0, -0.047, 0.038, 0.023) * 0.02 +
        gauss(Math.abs(x), y, 0.102, -0.052, 0.04, 0.036) * 0.018 +
        gauss(x, y, 0, -0.125, 0.065, 0.024) * 0.008);
    z += front * gauss(Math.abs(x), y, 0.063, 0.027, 0.039, 0.027) * 0.006;
    p.setZ(i, z);
    const c = skin.color.clone();
    if (front > 0.5)
      c.lerp(
        warm.color,
        gauss(Math.abs(x), y, 0.105, -0.045, 0.046, 0.043) * 0.2 +
          gauss(x, y, 0, -0.05, 0.03, 0.032) * 0.13,
      );
    if (terrorist) {
      const jawline =
        THREE.MathUtils.smoothstep(-y, 0.116, 0.137) *
        (1 - THREE.MathUtils.smoothstep(z, 0.07, 0.13));
      const sides =
        THREE.MathUtils.smoothstep(Math.abs(x), 0.123, 0.142) *
        (1 - THREE.MathUtils.smoothstep(y, 0.019, 0.05)) *
        THREE.MathUtils.smoothstep(y, -0.19, -0.15);
      const cheek =
        THREE.MathUtils.smoothstep(-y, 0.083, 0.118) *
        THREE.MathUtils.smoothstep(Math.abs(x), 0.068, 0.088) *
        (1 - THREE.MathUtils.smoothstep(z, -0.08, -0.03));
      c.lerp(hair.color, Math.max(jawline, sides, cheek) * 0.94);
    }
    colors.push(c.r, c.g, c.b);
  }
  face.geometry.setAttribute(
    "color",
    new THREE.Float32BufferAttribute(colors, 3),
  );
  face.geometry.computeVertexNormals();
  face.material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.72,
  });
  face.userData.ownedMaterial = true;
  for (const s of [-1, 1]) {
    loft(
      head,
      [
        [-0.078, 0.012, 0.009, s * 0.161, 0.004],
        [-0.06, 0.027, 0.019, s * 0.166, 0.001],
        [0.002, 0.03, 0.025, s * 0.17, 0.008],
        [0.04, 0.021, 0.017, s * 0.17, 0.005],
        [0.053, 0.005, 0.003, s * 0.16, 0.006],
      ],
      skin,
      { rows: 12, segments: 16, square: 2 },
    );
    seam(
      head,
      [
        [s * 0.174, 0.033, -0.015],
        [s * 0.187, 0.014, -0.021],
        [s * 0.184, -0.031, -0.018],
        [s * 0.172, -0.043, -0.011],
      ],
      warm,
      0.004,
      10,
    );
    const eye = joint(head, s * 0.063, 0.026, -0.153),
      outline = new THREE.Shape();
    outline.moveTo(-0.035, 0);
    outline.quadraticCurveTo(-0.01, 0.019, 0.023, 0.012);
    outline.quadraticCurveTo(0.036, 0.008, 0.037, 0);
    outline.quadraticCurveTo(0.002, -0.014, -0.035, 0);
    mesh(eye, new THREE.ShapeGeometry(outline, 16), pale).rotation.y = Math.PI;
    ellipsoid(eye, 0, 0.001, -0.002, 0.0135, 0.013, 0.005, iris);
    ellipsoid(eye, 0, 0.001, -0.007, 0.006, 0.009, 0.003, pupil);
    ellipsoid(
      eye,
      -0.004,
      0.006,
      -0.01,
      0.002,
      0.0024,
      0.0015,
      material(0xf7f6df),
    );
    seam(
      head,
      [
        [s * 0.027, 0.028, -0.151],
        [s * 0.05, 0.039, -0.16],
        [s * 0.076, 0.041, -0.157],
        [s * 0.097, 0.029, -0.147],
      ],
      skin,
      0.0056,
      16,
    );
    seam(
      head,
      [
        [s * 0.027, 0.024, -0.151],
        [s * 0.05, 0.013, -0.16],
        [s * 0.077, 0.012, -0.159],
        [s * 0.098, 0.027, -0.148],
      ],
      skin,
      0.0046,
      16,
    );
    seam(
      head,
      [
        [s * 0.033, 0.067, -0.151],
        [s * 0.065, 0.078, -0.156],
        [s * 0.098, 0.069, -0.148],
        [s * 0.122, 0.055, -0.13],
      ],
      hair,
      0.008,
      18,
    );
  }
  seam(
    head,
    [
      [-0.037, -0.104, -0.143],
      [0, -0.11, -0.15],
      [0.038, -0.102, -0.143],
    ],
    lips,
    0.0024,
    18,
  );
  if (terrorist) {
    for (const s of [-1, 1])
      seam(
        head,
        [
          [s * 0.008, -0.079, -0.16],
          [s * 0.03, -0.081, -0.154],
          [s * 0.049, -0.09, -0.144],
        ],
        hair,
        0.0065,
        14,
      );
    for (let i = 0; i < 7; i++)
      seam(
        head,
        [
          [-0.072 + i * 0.024, -0.151, -0.119],
          [-0.061 + i * 0.021, -0.177, -0.096],
        ],
        material(0x514235),
        0.0019,
        4,
      );
  }
  const cap = mesh(
    head,
    new THREE.SphereGeometry(1, 28, 16, 0, Math.PI * 2, 0, Math.PI * 0.58),
    hair,
  );
  cap.scale.set(0.16, 0.148, 0.145);
  cap.position.set(0, 0.083, 0.009);
  for (let i = 0; i < 5; i++)
    loft(
      head,
      [
        [0.065, 0.018, 0.006, -0.115 + i * 0.045, -0.125],
        [0.092, 0.024, 0.01, -0.1 + i * 0.044, -0.124],
        [0.127, 0.016, 0.01, -0.09 + i * 0.044, -0.11],
      ],
      hair,
      { rows: 8, segments: 10 },
    ).rotation.z = -0.15;
}

function helmet(head, gear, dark) {
  const shell = material(0x7f9176, 0.12),
    rim = material(0x46594a),
    strapMat = textile(0x677763),
    glass = new THREE.MeshStandardMaterial({
      color: 0x649b9a,
      metalness: 0.42,
      roughness: 0.17,
    });
  loft(
    head,
    [
      [0.04, 0.183, 0.174, 0, 0.012],
      [0.075, 0.2, 0.182, 0, 0.012],
      [0.14, 0.196, 0.18, 0, 0.012],
      [0.21, 0.151, 0.147, 0, 0.018],
      [0.256, 0.073, 0.078, 0, 0.018],
      [0.266, 0.001, 0.001, 0, 0.015],
    ],
    shell,
    { rows: 22, segments: 36, square: 2.1 },
  );
  for (const side of [-1, 1]) {
    seam(
      head,
      [
        [side * 0.195, 0.065, -0.055],
        [side * 0.178, 0.154, -0.089],
        [side * 0.12, 0.221, -0.106],
        [side * 0.039, 0.251, -0.054],
      ],
      material(0x9ba58b, 0.1),
      0.0032,
    );
    const rail = panel(
      head,
      [
        [-0.052, -0.01],
        [0.046, -0.008],
        [0.06, 0.035],
        [0.035, 0.05],
        [-0.043, 0.05],
      ],
      0.016,
      dark,
      0.006,
    );
    rail.position.set(side * 0.192, 0.07, 0.017);
    rail.rotation.y = Math.PI / 2;
    for (let n = 0; n < 4; n++)
      box(
        head,
        side * 0.207,
        0.09,
        0.045 - n * 0.027,
        0.01,
        0.012,
        0.014,
        hardware(),
        0,
        0.002,
      );
    seam(
      head,
      [
        [side * 0.19, 0.056, -0.073],
        [side * 0.18, -0.086, -0.012],
        [side * 0.107, -0.177, -0.074],
        [side * 0.04, -0.177, -0.091],
      ],
      strapMat,
      0.009,
    );
    loft(
      head,
      [
        [-0.195, 0.015, 0.01, side * 0.029, -0.093],
        [-0.176, 0.045, 0.015, side * 0.028, -0.096],
        [-0.162, 0.041, 0.01, side * 0.023, -0.095],
      ],
      strapMat,
      { rows: 6, segments: 12 },
    );
    box(
      head,
      side * 0.145,
      -0.127,
      -0.048,
      0.026,
      0.032,
      0.012,
      hardware(),
      0,
      0.004,
    );
    const goggles = j(head, `goggle-${side}`, side * 0.083, 0.178, -0.139);
    goggles.rotation.y = side * -0.18;
    goggles.rotation.x = -0.16;
    const frame = panel(
      goggles,
      [
        [-0.069, -0.031],
        [-0.048, -0.047],
        [0.045, -0.044],
        [0.068, -0.025],
        [0.064, 0.027],
        [0.043, 0.043],
        [-0.049, 0.038],
        [-0.072, 0.019],
      ],
      0.031,
      material(0x424e41),
      0.009,
    );
    frame.position.z = -0.016;
    const lens = panel(
      goggles,
      [
        [-0.056, -0.023],
        [-0.04, -0.032],
        [0.038, -0.032],
        [0.053, -0.019],
        [0.051, 0.019],
        [0.034, 0.029],
        [-0.041, 0.026],
        [-0.059, 0.012],
      ],
      0.005,
      glass,
      0.004,
    );
    lens.position.z = -0.026;
    seam(
      goggles,
      [
        [-0.043, 0.018, -0.034],
        [-0.011, 0.023, -0.034],
        [0.02, 0.022, -0.034],
      ],
      material(0xb9d5c9, 0.3),
      0.0022,
    );
  }
  seam(
    head,
    [
      [-0.176, 0.048, -0.071],
      [-0.11, 0.054, -0.169],
      [0, 0.06, -0.183],
      [0.11, 0.054, -0.169],
      [0.176, 0.048, -0.071],
    ],
    rim,
    0.009,
    28,
  );
  box(head, 0, 0.168, -0.162, 0.032, 0.044, 0.039, gear, 0, 0.007);
  for (const side of [-1, 1]) {
    loft(
      head,
      [
        [-0.101, 0.012, 0.026, side * 0.18, 0.038],
        [-0.085, 0.036, 0.046, side * 0.19, 0.041],
        [-0.018, 0.034, 0.046, side * 0.19, 0.043],
        [0.006, 0.013, 0.026, side * 0.18, 0.04],
      ],
      dark,
      { rows: 12, segments: 16, square: 2.8 },
    );
    seam(
      head,
      [
        [side * 0.194, -0.083, 0.045],
        [side * 0.192, -0.02, 0.047],
      ],
      gear,
      0.004,
    );
  }
  seam(
    head,
    [
      [-0.188, -0.064, -0.002],
      [-0.163, -0.14, -0.068],
      [-0.076, -0.133, -0.175],
    ],
    material(0x39463c, 0.22),
    0.0037,
  );
  ellipsoid(head, -0.069, -0.133, -0.178, 0.016, 0.008, 0.012, dark);
}

function headwrap(head) {
  const fabric = scarfSurface(),
    edging = textile(0xbcb09a),
    crown = mesh(
      head,
      new THREE.SphereGeometry(1, 32, 18, 0, Math.PI * 2, 0, Math.PI * 0.56),
      fabric,
    );
  crown.scale.set(0.199, 0.158, 0.187);
  crown.position.set(0, 0.112, 0.015);
  crown.rotation.z = 0.06;
  for (let n = 0; n < 3; n++) {
    const y = 0.093 + n * 0.031,
      wrap = loft(
        head,
        [
          [y - 0.016, 0.19, 0.169, 0, 0.009],
          [y, 0.199, 0.18, 0, 0.006],
          [y + 0.022, 0.188, 0.167, 0, 0.009],
        ],
        fabric,
        { rows: 8, segments: 30, square: 2.1, folds: 0.016 },
      );
    wrap.rotation.z = 0.055 - n * 0.025;
    seam(
      head,
      [
        [-0.164, y, -0.085],
        [-0.084, y + 0.017, -0.159],
        [0.013, y + 0.02, -0.169],
        [0.128, y - 0.005, -0.12],
      ],
      edging,
      0.0025,
      20,
    );
  }
  loft(
    head,
    [
      [-0.07, 0.019, 0.022, 0.168, 0.113],
      [0, 0.044, 0.036, 0.184, 0.12],
      [0.055, 0.031, 0.02, 0.171, 0.12],
    ],
    fabric,
    { rows: 10, segments: 16, folds: 0.03 },
  );
  ribbon(
    head,
    [
      [0.175, 0.011, 0.132],
      [0.198, -0.1, 0.137],
      [0.23, -0.231, 0.17],
      [0.208, -0.28, 0.18],
    ],
    0.097,
    fabric,
    { taper: 0.65, ripple: 0.009 },
  );
  for (let i = 0; i < 5; i++)
    seam(
      head,
      [
        [0.18 + i * 0.014, -0.272, 0.182],
        [0.178 + i * 0.014, -0.293 - (i % 2) * 0.008, 0.188],
      ],
      edging,
      0.002,
      5,
    );
}

function boot(knee, terrorist) {
  const upper = textile(terrorist ? 0x675540 : 0x536453, "leather"),
    dark = textile(terrorist ? 0x403a31 : 0x303d35, "leather"),
    sole = material(terrorist ? 0x49453c : 0x343e36),
    trim = textile(terrorist ? 0xa08c68 : 0x97a18a),
    toe = textile(terrorist ? 0x7b6a51 : 0x697a62, "leather");
  loft(
    knee,
    [
      [-0.465, 0.067, 0.097, 0, -0.048],
      [-0.455, 0.098, 0.157, 0, -0.051],
      [-0.437, 0.102, 0.161, 0, -0.048],
      [-0.422, 0.094, 0.15, 0, -0.044],
    ],
    sole,
    { rows: 10, segments: 24, square: 2.9 },
  );
  loft(
    knee,
    [
      [-0.424, 0.095, 0.148, 0, -0.047],
      [-0.397, 0.098, 0.153, 0, -0.047],
      [-0.372, 0.094, 0.15, 0, -0.044],
      [-0.335, 0.083, 0.119, 0, -0.02],
      [-0.287, 0.075, 0.086, 0, 0.011],
      [-0.211, 0.081, 0.079, 0, 0.014],
      [-0.188, 0.074, 0.071, 0, 0.015],
    ],
    upper,
    { rows: 25, segments: 28, square: 2.65, folds: 0.006 },
  );
  loft(
    knee,
    [
      [-0.415, 0.073, 0.076, 0, -0.118],
      [-0.393, 0.095, 0.087, 0, -0.116],
      [-0.37, 0.089, 0.081, 0, -0.115],
      [-0.348, 0.07, 0.065, 0, -0.104],
      [-0.34, 0.055, 0.05, 0, -0.092],
    ],
    toe,
    { rows: 12, segments: 24, square: 2.6 },
  );
  seam(
    knee,
    [
      [-0.086, -0.398, -0.112],
      [-0.074, -0.358, -0.17],
      [0, -0.35, -0.18],
      [0.074, -0.358, -0.17],
      [0.086, -0.398, -0.112],
    ],
    trim,
    0.0027,
    24,
  );
  loft(
    knee,
    [
      [-0.249, 0.081, 0.08, 0, 0.014],
      [-0.223, 0.086, 0.085, 0, 0.016],
      [-0.189, 0.081, 0.077, 0, 0.014],
    ],
    dark,
    { rows: 9, segments: 24, square: 2.4 },
  );
  const tongue = panel(
    knee,
    [
      [-0.044, -0.326],
      [0.044, -0.326],
      [0.04, -0.219],
      [0.023, -0.193],
      [-0.028, -0.193],
      [-0.044, -0.218],
    ],
    0.014,
    dark,
    0.005,
  );
  tongue.position.z = -0.071;
  tongue.rotation.x = 0.12;
  for (let n = 0; n < 6; n++) {
    const y = -0.231 - n * 0.024,
      z = -0.083 - Math.max(0, n - 1) * 0.019;
    for (const s of [-1, 1]) {
      cylinder(knee, s * 0.043, y, z, 0.0045, 0.004, hardware(), true);
      seam(
        knee,
        [
          [s * 0.043, y, z - 0.004],
          [-s * 0.035, y - 0.019, z - 0.016],
        ],
        trim,
        0.0027,
        6,
      );
    }
  }
  for (const s of [-1, 1]) {
    seam(
      knee,
      [
        [s * 0.076, -0.218, 0.008],
        [s * 0.076, -0.286, 0.038],
        [s * 0.087, -0.37, 0.066],
        [s * 0.079, -0.416, 0.077],
      ],
      trim,
      0.0024,
    );
    for (let n = 0; n < 5; n++)
      box(
        knee,
        s * 0.095,
        -0.444,
        -0.16 + n * 0.065,
        0.018,
        0.019,
        0.037,
        sole,
        0,
        0.003,
      );
  }
  box(knee, 0, -0.204, 0.086, 0.043, 0.069, 0.012, upper, 0, 0.003);
  seam(
    knee,
    [
      [-0.089, -0.427, -0.15],
      [0, -0.426, -0.207],
      [0.09, -0.427, -0.15],
    ],
    trim,
    0.0024,
    24,
  );
}

function clothes(body, terrorist, uniform, pants, gear, dark) {
  loft(
    body,
    [
      [0.895, 0.175, 0.121],
      [0.94, 0.195, 0.127],
      [1.045, 0.201, 0.131],
      [1.18, 0.221, 0.148],
      [1.315, 0.248, 0.149],
      [1.386, 0.233, 0.13],
      [1.423, 0.174, 0.109],
      [1.445, 0.087, 0.07],
    ],
    uniform,
    { rows: 32, segments: 28, square: 2.8, folds: 0.018 },
  );
  loft(
    body,
    [
      [0.805, 0.146, 0.106],
      [0.842, 0.182, 0.139],
      [0.904, 0.209, 0.149],
      [0.973, 0.199, 0.131],
      [1.009, 0.182, 0.115],
    ],
    pants,
    { rows: 18, segments: 24, square: 2.8, folds: 0.019 },
  );
  for (const s of [-1, 1])
    seam(
      body,
      [
        [s * 0.193, 1.02, -0.11],
        [s * 0.215, 1.168, -0.127],
        [s * 0.231, 1.305, -0.092],
      ],
      textile(terrorist ? 0x867b62 : 0x626e56),
      0.0027,
    );
  if (terrorist) {
    loft(
      body,
      [
        [0.837, 0.216, 0.145],
        [0.878, 0.231, 0.159],
        [0.971, 0.226, 0.151],
        [1.043, 0.208, 0.141],
      ],
      uniform,
      { rows: 20, segments: 28, square: 2.8, folds: 0.025 },
    );
    seam(
      body,
      [
        [-0.222, 0.878, -0.115],
        [-0.14, 0.848, -0.162],
        [0, 0.86, -0.163],
        [0.144, 0.842, -0.16],
        [0.23, 0.875, -0.102],
      ],
      clothEdge(),
      0.0025,
      28,
    );
    strap(
      body,
      [
        [0, 0.897, -0.155],
        [0.016, 1.125, -0.155],
        [0, 1.362, -0.145],
      ],
      0.031,
      textile(0xb0a184),
      false,
    );
    for (const y of [1.0, 1.11, 1.22, 1.32])
      cylinder(body, 0, y, -0.176, 0.0047, 0.006, material(0x73684e), true);
  }
  loft(
    body,
    [
      [1.365, 0.096, 0.075],
      [1.434, 0.104, 0.081],
      [1.463, 0.088, 0.069],
    ],
    uniform,
    { rows: 12, segments: 24, square: 2.5 },
  );
  for (const s of [-1, 1]) {
    const collar = panel(
      body,
      [
        [0, 0],
        [s * 0.07, -0.071],
        [s * 0.091, -0.003],
        [s * 0.043, 0.019],
      ],
      0.016,
      uniform,
      0.004,
    );
    collar.position.set(s * 0.027, 1.435, -0.105);
  }
  loft(
    body,
    [
      [0.956, 0.201, 0.14],
      [0.974, 0.213, 0.148],
      [1.001, 0.206, 0.142],
    ],
    dark,
    { rows: 7, segments: 28, square: 3 },
  );
  for (const x of [-0.17, -0.1, 0.1, 0.17])
    box(body, x, 0.986, -0.15, 0.022, 0.061, 0.014, gear, 0, 0.004);
  box(body, 0, 0.982, -0.162, 0.071, 0.043, 0.015, hardware(), 0, 0.006);
  box(body, 0, 0.982, -0.172, 0.046, 0.022, 0.007, dark, 0, 0.003);
  box(body, 0.013, 0.982, -0.179, 0.011, 0.031, 0.004, hardware(), 0, 0.002);
  pouch(body, -0.236, 0.956, 0.025, 0.09, 0.125, gear);
  loft(
    body,
    [
      [0.767, 0.039, 0.039, 0.237, -0.01],
      [0.799, 0.06, 0.05, 0.24, -0.01],
      [0.928, 0.057, 0.051, 0.237, 0.001],
      [0.958, 0.044, 0.043, 0.232, 0.012],
    ],
    dark,
    { rows: 14, segments: 16, square: 3.1 },
  );
  box(
    body,
    0.233,
    0.959,
    0.014,
    0.053,
    0.086,
    0.046,
    material(0x3f443d, 0.18),
    0,
    0.008,
  );
  box(
    body,
    0.236,
    0.988,
    0.027,
    0.037,
    0.088,
    0.043,
    material(0x393e36),
    0,
    0.007,
  ).rotation.x = -0.25;
  seam(
    body,
    [
      [0.209, 0.842, -0.05],
      [0.233, 0.811, -0.066],
      [0.268, 0.829, -0.03],
    ],
    clothEdge(),
    0.0021,
  );
}

function tacticalVest(body, gear, dark) {
  const trim = textile(0x8c9878),
    reinforced = textile(0x56654f);
  const plate = panel(
    body,
    [
      [-0.189, 1.072],
      [-0.175, 1.332],
      [-0.13, 1.414],
      [0.13, 1.414],
      [0.175, 1.332],
      [0.189, 1.072],
      [0.155, 1.045],
      [-0.155, 1.045],
    ],
    0.06,
    gear,
    0.015,
  );
  plate.position.z = -0.19;
  const inset = panel(
    body,
    [
      [-0.135, 1.281],
      [-0.126, 1.379],
      [0.126, 1.379],
      [0.135, 1.281],
    ],
    0.014,
    reinforced,
    0.006,
  );
  inset.position.z = -0.214;
  seam(
    body,
    [
      [-0.159, 1.097, -0.204],
      [-0.156, 1.323, -0.212],
      [-0.117, 1.39, -0.203],
      [0.117, 1.39, -0.203],
      [0.156, 1.323, -0.212],
      [0.159, 1.097, -0.204],
    ],
    trim,
    0.0027,
    32,
  );
  const back = panel(
    body,
    [
      [-0.177, 1.071],
      [-0.183, 1.319],
      [-0.122, 1.407],
      [0.122, 1.407],
      [0.183, 1.319],
      [0.177, 1.071],
    ],
    0.074,
    reinforced,
    0.015,
  );
  back.position.z = 0.106;
  loft(
    body,
    [
      [1.081, 0.217, 0.162],
      [1.112, 0.229, 0.17],
      [1.19, 0.23, 0.168],
      [1.222, 0.217, 0.154],
    ],
    gear,
    { rows: 10, segments: 28, square: 3 },
  );
  for (const s of [-1, 1]) {
    strap(
      body,
      [
        [s * 0.135, 1.311, -0.214],
        [s * 0.145, 1.44, -0.114],
        [s * 0.139, 1.465, 0.03],
        [s * 0.142, 1.404, 0.137],
      ],
      0.066,
      gear,
    );
    box(
      body,
      s * 0.143,
      1.397,
      -0.135,
      0.07,
      0.043,
      0.025,
      hardware(),
      0,
      0.006,
    );
    box(body, s * 0.143, 1.397, -0.15, 0.041, 0.02, 0.012, dark, 0, 0.002);
    for (const y of [1.13, 1.177])
      seam(
        body,
        [
          [s * 0.19, y, -0.129],
          [s * 0.232, y, -0.041],
          [s * 0.226, y, 0.096],
        ],
        reinforced,
        0.009,
        16,
      );
  }
  for (let i = -1; i <= 1; i++)
    pouch(body, i * 0.115, 1.166, -0.224, 0.101, 0.175, gear, {
      ammo: true,
      flap: false,
    });
  for (let row = 0; row < 2; row++)
    for (let col = -2; col <= 2; col++)
      box(
        body,
        col * 0.051,
        1.31 + row * 0.035,
        -0.232,
        0.043,
        0.012,
        0.009,
        trim,
        0,
        0.0025,
      );
  const patch = panel(
    body,
    [
      [-0.049, 1.358],
      [-0.047, 1.39],
      [0.047, 1.39],
      [0.049, 1.358],
    ],
    0.005,
    textile(0x3f6667),
    0.004,
  );
  patch.position.z = -0.229;
  for (const s of [-1, 1])
    seam(
      body,
      [
        [s * 0.027, 1.365, -0.237],
        [0, 1.376, -0.239],
        [s * 0.027, 1.383, -0.237],
      ],
      material(0xc6d5be),
      0.0025,
      5,
    );
  pouch(body, -0.209, 1.274, 0.052, 0.067, 0.177, dark, { flap: false });
  box(body, -0.208, 1.362, 0.055, 0.061, 0.065, 0.041, dark, 0, 0.006);
  cylinder(body, -0.218, 1.49, 0.059, 0.005, 0.24, material(0x333e33));
  seam(
    body,
    [
      [-0.205, 1.39, 0.043],
      [-0.205, 1.468, -0.006],
      [-0.177, 1.438, -0.108],
      [-0.118, 1.346, -0.236],
    ],
    dark,
    0.0037,
    26,
  );
  pouch(body, 0, 1.232, 0.215, 0.223, 0.271, reinforced);
  for (const s of [-1, 1])
    pouch(body, s * 0.167, 1.189, 0.164, 0.089, 0.152, gear);
  const he = grenadeModel("he");
  he.position.set(0.236, 1.088, 0.055);
  he.scale.setScalar(0.55);
  he.rotation.z = -0.12;
  body.add(he);
}

function ruggedGear(body, gear, dark) {
  const edge = textile(0xb09a76),
    vest = textile(0x685842, "leather"),
    scarf = scarfSurface();
  for (const s of [-1, 1]) {
    const p = panel(
      body,
      [
        [s * 0.052, 1.025],
        [s * 0.221, 1.055],
        [s * 0.209, 1.31],
        [s * 0.133, 1.401],
        [s * 0.049, 1.353],
      ],
      0.025,
      vest,
      0.008,
    );
    p.position.z = -0.147;
    seam(
      body,
      [
        [s * 0.074, 1.046, -0.165],
        [s * 0.084, 1.264, -0.174],
        [s * 0.062, 1.336, -0.158],
        [s * 0.139, 1.382, -0.146],
      ],
      edge,
      0.0028,
    );
    pouch(body, s * 0.164, 1.097, -0.176, 0.115, 0.166, gear);
    pouch(body, s * 0.17, 1.287, -0.154, 0.108, 0.115, vest);
  }
  strap(
    body,
    [
      [-0.18, 1.4, -0.09],
      [-0.119, 1.34, -0.179],
      [0, 1.224, -0.187],
      [0.165, 1.041, -0.174],
      [0.206, 0.993, -0.121],
    ],
    0.055,
    dark,
  );
  box(
    body,
    -0.064,
    1.285,
    -0.204,
    0.044,
    0.052,
    0.019,
    hardware(),
    0,
    0.005,
  ).rotation.z = -0.67;
  for (let i = 0; i < 3; i++) {
    cylinder(
      body,
      -0.057 + i * 0.033,
      1.09,
      -0.196,
      0.011,
      0.126,
      material(0xa99058, 0.45),
    );
    cylinder(
      body,
      -0.057 + i * 0.033,
      1.169,
      -0.196,
      0.009,
      0.03,
      material(0x746744, 0.38),
      false,
      0.002,
    );
    box(
      body,
      -0.057 + i * 0.033,
      1.057,
      -0.207,
      0.025,
      0.038,
      0.014,
      gear,
      0,
      0.004,
    );
  }
  const wrap = loft(
    body,
    [
      [1.376, 0.116, 0.098, 0, -0.003],
      [1.405, 0.181, 0.141, 0, -0.025],
      [1.439, 0.193, 0.151, 0, -0.017],
      [1.481, 0.165, 0.117, 0, -0.009],
      [1.494, 0.093, 0.077],
    ],
    scarf,
    { rows: 20, segments: 30, square: 2.3, folds: 0.05 },
  );
  wrap.rotation.z = 0.035;
  ribbon(
    body,
    [
      [-0.128, 1.441, -0.11],
      [-0.078, 1.357, -0.187],
      [0.066, 1.271, -0.203],
      [0.121, 1.211, -0.2],
    ],
    0.22,
    scarf,
    { taper: 0.27, ripple: 0.011 },
  );
  seam(
    body,
    [
      [-0.185, 1.443, -0.077],
      [-0.096, 1.423, -0.164],
      [0.011, 1.409, -0.174],
      [0.164, 1.45, -0.104],
    ],
    edge,
    0.003,
  );
  ribbon(
    body,
    [
      [0.159, 1.451, 0.019],
      [0.223, 1.37, 0.127],
      [0.224, 1.195, 0.177],
      [0.19, 1.14, 0.181],
    ],
    0.095,
    scarf,
    { taper: 0.72, ripple: 0.008 },
  );
  for (let i = 0; i < 6; i++)
    seam(
      body,
      [
        [0.08 + i * 0.013, 1.231, -0.208],
        [0.079 + i * 0.013, 1.201 - (i % 2) * 0.015, -0.209],
      ],
      edge,
      0.002,
      5,
    );
  pouch(body, -0.127, 1.11, 0.187, 0.18, 0.238, vest);
  strap(
    body,
    [
      [0.146, 1.412, 0.092],
      [0.101, 1.33, 0.183],
      [-0.036, 1.219, 0.198],
      [-0.172, 1.052, 0.192],
    ],
    0.046,
    dark,
    false,
  );
}

export function characterModel(team) {
  const terrorist = team === "terrorists",
    root = new THREE.Group(),
    body = j(root, "body", 0, 0, 0),
    uniform = textile(terrorist ? 0xb4a88c : 0x899879),
    pants = textile(terrorist ? 0x726b55 : 0x727e61),
    gear = textile(terrorist ? 0x817055 : 0x758167),
    dark = textile(terrorist ? 0x473f32 : 0x424e3c),
    skin = material(terrorist ? 0xc9966f : 0xdfae83);
  root.name = terrorist ? "terrorist" : "soldier";
  clothes(body, terrorist, uniform, pants, gear, dark);
  if (terrorist) ruggedGear(body, gear, dark);
  else tacticalVest(body, gear, dark);
  const head = j(body, "head", 0, 1.604, 0);
  face(head, terrorist);
  if (terrorist) headwrap(head);
  else helmet(head, gear, dark);
  for (const [i, s] of [-1, 1].entries()) {
    const leg = j(body, `leg${i}`, s * 0.122, 0.874, 0);
    loft(
      leg,
      [
        [-0.376, 0.075, 0.085, 0, 0.003],
        [-0.336, 0.091, 0.096, 0, 0.008],
        [-0.242, 0.107, 0.105, 0, 0.005],
        [-0.149, 0.113, 0.118],
        [0, 0.104, 0.111],
        [0.064, 0.075, 0.084],
      ],
      pants,
      { rows: 28, segments: 24, square: 2.6, folds: 0.023 },
    );
    seam(
      leg,
      [
        [s * 0.085, 0.02, 0.059],
        [s * 0.109, -0.113, 0.058],
        [s * 0.095, -0.287, 0.05],
      ],
      textile(terrorist ? 0xada087 : 0x9ba58a),
      0.0022,
    );
    pouch(leg, s * 0.074, -0.152, -0.057, 0.086, 0.162, gear).rotation.y =
      s * -0.53;
    for (const y of [-0.246, -0.295])
      seam(
        leg,
        [
          [-0.068, y, -0.076],
          [-0.012, y + 0.018, -0.108],
          [0.078, y - 0.009, -0.076],
        ],
        pants,
        0.0055,
        14,
      );
    const knee = j(leg, `knee${i}`, 0, -0.365, 0);
    loft(
      knee,
      [
        [-0.289, 0.07, 0.07, 0, 0.014],
        [-0.249, 0.083, 0.079, 0, 0.016],
        [-0.187, 0.088, 0.087, 0, 0.02],
        [-0.11, 0.087, 0.088, 0, 0.017],
        [-0.023, 0.089, 0.086],
        [0.046, 0.078, 0.083],
      ],
      pants,
      { rows: 23, segments: 24, square: 2.5, folds: 0.03 },
    );
    if (terrorist) {
      const patch = panel(
        leg,
        [
          [-0.055, -0.213],
          [-0.063, -0.09],
          [0.04, -0.082],
          [0.057, -0.209],
        ],
        0.007,
        textile(0x948970),
        0.004,
      );
      patch.position.z = -0.114;
      patch.rotation.z = -0.08;
      seam(
        leg,
        [
          [-0.055, -0.207, -0.122],
          [-0.056, -0.095, -0.127],
          [0.037, -0.091, -0.13],
          [0.049, -0.204, -0.122],
        ],
        clothEdge(),
        0.0018,
      );
      for (let n = 0; n < 3; n++)
        loft(
          knee,
          [
            [-0.214 - n * 0.023, 0.084, 0.082, 0, 0.014],
            [-0.204 - n * 0.023, 0.089, 0.086, 0, 0.014],
            [-0.194 - n * 0.023, 0.085, 0.081, 0, 0.014],
          ],
          textile(0xb2a98d),
          { rows: 5, segments: 24, square: 2.4, folds: 0.018 },
        );
    } else {
      for (const y of [-0.067, 0.021])
        loft(
          knee,
          [
            [y - 0.012, 0.089, 0.093],
            [y, 0.096, 0.099],
            [y + 0.012, 0.09, 0.093],
          ],
          gear,
          { rows: 5, segments: 20, square: 2.7 },
        );
      const pad = panel(
        knee,
        [
          [-0.064, -0.082],
          [-0.074, -0.028],
          [-0.055, 0.045],
          [0, 0.061],
          [0.055, 0.045],
          [0.074, -0.028],
          [0.064, -0.082],
          [0, -0.102],
        ],
        0.027,
        dark,
        0.009,
      );
      pad.position.z = -0.101;
      const inset = panel(
        knee,
        [
          [-0.039, -0.061],
          [-0.047, -0.016],
          [-0.032, 0.027],
          [0.032, 0.027],
          [0.047, -0.016],
          [0.039, -0.061],
          [0, -0.075],
        ],
        0.014,
        material(0x737e66),
        0.006,
      );
      inset.position.z = -0.117;
      seam(
        knee,
        [
          [-0.033, -0.039, -0.139],
          [0, -0.048, -0.145],
          [0.033, -0.039, -0.139],
        ],
        dark,
        0.0031,
      );
    }
    // A dedicated foot pivot lets presentation IK keep the sole level while
    // the shin bends. The counter-offset preserves the neutral boot position.
    const ankle = j(knee, `ankle${i}`, 0, -0.36, 0);
    const bootBind = joint(ankle, 0, 0.36, 0);
    boot(bootBind, terrorist);
    const arm = j(body, `arm${i}`, s * 0.274, 1.402, 0);
    loft(
      arm,
      [
        [-0.227, 0.068, 0.073, 0, -0.012],
        [-0.198, 0.088, 0.085, 0, -0.009],
        [-0.121, 0.101, 0.101, 0, -0.002],
        [-0.05, 0.099, 0.103],
        [0.017, 0.062, 0.074],
        [0.043, 0.032, 0.047],
        [0.051, 0.001, 0.001],
      ],
      uniform,
      { rows: 24, segments: 24, square: 2.3, folds: 0.02 },
    );
    loft(
      arm,
      [
        [-0.224, 0.08, 0.082, 0, -0.012],
        [-0.198, 0.088, 0.09, 0, -0.009],
        [-0.18, 0.082, 0.085, 0, -0.007],
      ],
      textile(terrorist ? 0x978d76 : 0x718064),
      { rows: 9, segments: 24, square: 2.4, folds: 0.028 },
    );
    seam(
      arm,
      [
        [s * 0.055, -0.001, -0.058],
        [s * 0.096, -0.068, -0.039],
        [s * 0.084, -0.153, -0.04],
      ],
      clothEdge(),
      0.0021,
    );
    for (let n = 0; n < 2; n++)
      seam(
        arm,
        [
          [-0.062, -0.127 - n * 0.029, -0.072],
          [0, -0.109 - n * 0.03, -0.104],
          [0.063, -0.121 - n * 0.03, -0.074],
        ],
        uniform,
        0.0042,
        12,
      );
    if (!terrorist) {
      const patch = panel(
        arm,
        [
          [-0.042, -0.099],
          [-0.044, -0.026],
          [0, -0.014],
          [0.044, -0.026],
          [0.042, -0.099],
          [0, -0.118],
        ],
        0.012,
        textile(0x42767b),
        0.006,
      );
      patch.position.set(s * 0.089, -0.011, 0);
      patch.rotation.y = (s * Math.PI) / 2;
      for (let n = 0; n < 2; n++)
        seam(
          arm,
          [
            [s * 0.106, -0.061 + n * 0.026, -0.029],
            [s * 0.11, -0.05 + n * 0.026, 0],
            [s * 0.106, -0.061 + n * 0.026, 0.029],
          ],
          material(0xd8dfc8),
          0.003,
          6,
        );
    }
    const elbow = j(arm, `elbow${i}`, 0, -0.225, -0.023);
    loft(
      elbow,
      [
        [-0.192, 0.04, 0.049, 0, -0.091],
        [-0.15, 0.048, 0.055, 0, -0.074],
        [-0.084, 0.061, 0.062, 0, -0.045],
        [-0.014, 0.067, 0.067, 0, -0.012],
        [0.029, 0.057, 0.057, 0, -0.009],
      ],
      skin,
      { rows: 22, segments: 24, square: 2.15 },
    );
    seam(
      elbow,
      [
        [s * 0.033, -0.025, -0.07],
        [s * 0.034, -0.086, -0.093],
      ],
      material(terrorist ? 0xb3815b : 0xc9976f),
      0.0017,
      9,
    );
    loft(
      elbow,
      [
        [-0.206, 0.044, 0.051, 0, -0.094],
        [-0.177, 0.052, 0.058, 0, -0.086],
        [-0.151, 0.05, 0.056, 0, -0.077],
      ],
      dark,
      { rows: 9, segments: 20, square: 2.7 },
    );
    if (i === 0) {
      box(elbow, -0.004, -0.175, -0.146, 0.052, 0.042, 0.019, dark, 0, 0.008);
      box(
        elbow,
        -0.004,
        -0.174,
        -0.158,
        0.036,
        0.026,
        0.008,
        material(0x467579, 0.5),
        0,
        0.004,
      );
      seam(
        elbow,
        [
          [-0.013, -0.174, -0.164],
          [0.001, -0.174, -0.164],
          [0.001, -0.165, -0.164],
        ],
        material(0xb4d2b2),
        0.0015,
        3,
      );
    }
    glove(elbow, 0, -0.228, -0.12, terrorist);
  }
  j(body, "weaponPivot", 0.156, 1.18, -0.355).scale.setScalar(0.66);
  // Rigid detail groups are authoring conveniences, not separate GPU draws.
  // Attach their meshes directly to the nearest animated joint before baking.
  const animated = new Set([
    "body",
    "head",
    "arm0",
    "arm1",
    "elbow0",
    "elbow1",
    "leg0",
    "leg1",
    "knee0",
    "knee1",
    "ankle0",
    "ankle1",
    "weaponPivot",
  ]);
  root.updateMatrixWorld(true);
  const meshes = [];
  root.traverse((o) => {
    if (o.isMesh) meshes.push(o);
  });
  for (const m of meshes) {
    let p = m.parent;
    while (p !== root && !animated.has(p.name)) p = p.parent;
    if (p !== m.parent) p.attach(m);
  }
  consolidatePalette(body);
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
  const tracks = (amp, seconds, run = false) =>
    [0, 1].flatMap((i) => [
      rotation(
        `leg${i}`,
        [0, seconds * 0.25, seconds * 0.5, seconds * 0.75, seconds],
        [0, amp * (i ? -1 : 1), 0, amp * (i ? 1 : -1), 0],
      ),
      rotation(
        `knee${i}`,
        [0, seconds * 0.2, seconds * 0.45, seconds * 0.7, seconds],
        [
          -0.05,
          i ? (run ? -0.95 : -0.65) : -0.03,
          -0.05,
          i ? -0.03 : run ? -0.95 : -0.65,
          -0.05,
        ],
      ),
    ]);
  return [
    new THREE.AnimationClip("walk", 0.84, tracks(0.48, 0.84)),
    new THREE.AnimationClip("run", 0.55, tracks(0.73, 0.55, true)),
    new THREE.AnimationClip("idle", 2.8, [
      new THREE.VectorKeyframeTrack(
        "body.position",
        [0, 0.7, 1.4, 2.1, 2.8],
        [0, 0, 0, 0, 0.005, 0, 0, 0.009, 0, 0, 0.005, 0, 0, 0, 0],
      ),
    ]),
  ];
}
