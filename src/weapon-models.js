import * as THREE from "three";
import { WEAPONS } from "../shared/weapons.js";
import { box, cylinder, ellipsoid, joint, bake } from "./geometry.js";
import {
  ring,
  wire,
  grenadeModel,
  bombModel,
  knifeModel,
} from "./equipment.js";
import { finish, stamp } from "./weapon-surfaces.js";

// Original receiver length, barrel extent, stock extent, furniture and mag sweep.
const blueprints = {
  glock18: [0.29, 0.29, 0, 0xb9aa8d, 0],
  usps: [0.31, 0.49, 0, 0x51605a, 0],
  p2000: [0.275, 0.28, 0, 0x878d76, 0],
  dualberettas: [0.335, 0.33, 0, 0x9b6248, 0],
  p250: [0.275, 0.29, 0, 0xb4a081, 0],
  fiveseven: [0.315, 0.325, 0, 0x687b78, 0],
  tec9: [0.34, 0.43, 0, 0x929674, 0],
  cz75: [0.29, 0.31, 0, 0x985a49, 0],
  deagle: [0.365, 0.405, 0, 0xbfa786, 0],
  r8: [0.31, 0.425, 0, 0x9d6844, 0],
  mac10: [0.315, 0.4, 0.4, 0x7d8478, 0],
  mp9: [0.355, 0.48, 0.455, 0xb6a180, 0],
  mp7: [0.365, 0.47, 0.45, 0xb4a385, 0],
  mp5sd: [0.435, 0.7, 0.56, 0x515f5b, 0.065],
  ump45: [0.435, 0.54, 0.59, 0x63716d, 0.035],
  p90: [0.54, 0.49, 0.435, 0x90998d, 0],
  bizon: [0.435, 0.59, 0.555, 0x576b63, 0],
  nova: [0.37, 0.88, 0.65, 0xa79b7d, 0],
  mag7: [0.45, 0.56, 0.37, 0x687870, 0],
  sawedoff: [0.32, 0.595, 0.32, 0x986442, 0],
  xm1014: [0.41, 0.89, 0.64, 0x596963, 0],
  m249: [0.54, 0.93, 0.7, 0x929975, 0],
  negev: [0.55, 0.86, 0.65, 0x7b886d, 0],
  ak47: [0.435, 0.81, 0.63, 0xa57643, 0.135],
  m4a4: [0.435, 0.755, 0.635, 0xb5a180, 0.046],
  m4a1s: [0.435, 0.92, 0.635, 0x5d7066, 0.046],
  galil: [0.48, 0.835, 0.6, 0x939775, 0.073],
  famas: [0.46, 0.675, 0.455, 0x657871, 0],
  sg553: [0.445, 0.82, 0.62, 0xb29c7c, 0.045],
  aug: [0.535, 0.82, 0.445, 0x99a879, 0],
  ssg08: [0.455, 1.03, 0.67, 0x99aaa1, 0],
  awp: [0.58, 1.09, 0.695, 0x8c9e6a, 0],
  g3sg1: [0.54, 0.985, 0.69, 0x748474, 0.029],
  scar20: [0.52, 0.95, 0.66, 0xc0a47c, 0.029],
};
const palette = () => ({
  steel: finish("metal", 0x455453),
  edge: finish("edge", 0x8e9c97),
  dark: finish("polymer", 0x263632),
  black: finish("metal", 0x182724),
  rubber: finish("polymer", 0x35443d),
  brass: finish("edge", 0xb7a26c),
});

function roundedPath(points, ratio = 0.16) {
  const shape = new THREE.Shape();
  for (let i = 0; i < points.length; i++) {
    const p = points[i],
      prev = points[(i + points.length - 1) % points.length],
      next = points[(i + 1) % points.length];
    const a = [
        p[0] + (prev[0] - p[0]) * ratio,
        p[1] + (prev[1] - p[1]) * ratio,
      ],
      b = [p[0] + (next[0] - p[0]) * ratio, p[1] + (next[1] - p[1]) * ratio];
    if (!i) shape.moveTo(...a);
    else shape.lineTo(...a);
    shape.quadraticCurveTo(...p, ...b);
  }
  shape.closePath();
  return shape;
}
function profile(
  parent,
  points,
  thickness,
  mat,
  { holes = [], x = 0, bevel = 0.0045, round = 0.15 } = {},
) {
  const shape = roundedPath(points, round);
  holes.forEach((h) => shape.holes.push(roundedPath(h, 0.2)));
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: bevel > 0,
    bevelSegments: 2,
    curveSegments: 4,
    steps: 1,
    bevelSize: bevel,
    bevelThickness: bevel * 0.7,
  });
  geo.rotateY(-Math.PI / 2);
  geo.translate(thickness / 2 + x, 0, 0);
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = m.receiveShadow = true;
  m.userData.ownedGeometry = true;
  parent.add(m);
  return m;
}
// Varying-section machined parts: actual taper, shoulder and upper/lower chamfers.
function loft(parent, sections, mat) {
  const positions = [],
    uvs = [],
    indices = [],
    points = [];
  for (const [z, width, top, bottom] of sections) {
    const h = top - bottom,
      w = width / 2,
      b = Math.min(width * 0.19, h * 0.23);
    points.push(
      [
        [-w + b, top],
        [w - b, top],
        [w, top - b],
        [w, bottom + b],
        [w - b, bottom],
        [-w + b, bottom],
        [-w, bottom + b],
        [-w, top - b],
      ].map(([x, y]) => [x, y, z]),
    );
  }
  const z0 = sections[0][0],
    length = sections.at(-1)[0] - z0;
  for (let k = 0; k < points.length - 1; k++)
    for (let j = 0; j < 8; j++) {
      const next = (j + 1) % 8,
        o = positions.length / 3;
      positions.push(
        ...points[k][j],
        ...points[k][next],
        ...points[k + 1][next],
        ...points[k + 1][j],
      );
      uvs.push(
        j / 8,
        (sections[k][0] - z0) / length,
        next / 8,
        (sections[k][0] - z0) / length,
        next / 8,
        (sections[k + 1][0] - z0) / length,
        j / 8,
        (sections[k + 1][0] - z0) / length,
      );
      indices.push(o, o + 2, o + 1, o, o + 3, o + 2);
    }
  for (const [side, reverse] of [
    [0, false],
    [points.length - 1, true],
  ]) {
    const o = positions.length / 3;
    points[side].forEach((p) => {
      positions.push(...p);
      uvs.push(p[0] * 4 + 0.5, p[1] * 4 + 0.5);
    });
    for (let j = 1; j < 7; j++)
      indices.push(o, o + (reverse ? j + 1 : j), o + (reverse ? j : j + 1));
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = m.receiveShadow = true;
  m.userData.ownedGeometry = true;
  parent.add(m);
  return m;
}
function pin(p, x, y, z, mat, r = 0.007) {
  cylinder(p, x, y, z, r, 0.004, mat).rotation.z = Math.PI / 2;
  box(
    p,
    x + (Math.sign(x) || 1) * 0.0025,
    y,
    z,
    0.0015,
    0.0015,
    r * 1.05,
    finish("metal", 0x263632),
  );
}
function rail(p, z, len, y, mat, width = 0.073) {
  loft(
    p,
    [
      [z, width * 0.65, y, y - 0.018],
      [z + len, width * 0.65, y, y - 0.018],
    ],
    mat,
  );
  for (let i = 0; i < Math.max(2, Math.floor(len / 0.026)); i++)
    loft(
      p,
      [
        [z + i * 0.026, width, y + 0.011, y],
        [z + i * 0.026 + 0.013, width, y + 0.011, y],
      ],
      mat,
    );
}
function grip(p, z, y, mat, scale = 1, style = "polymer") {
  const a = joint(p, 0, y, z);
  a.scale.setScalar(scale);
  profile(
    a,
    [
      [-0.05, 0.1],
      [0.05, 0.095],
      [0.067, 0.037],
      [0.096, -0.108],
      [0.06, -0.139],
      [-0.005, -0.126],
      [-0.006, -0.044],
      [-0.042, 0.008],
    ],
    0.082,
    mat,
    { round: 0.27, bevel: 0.008 },
  );
  for (const s of [-1, 1]) {
    profile(
      a,
      [
        [0.002, 0.019],
        [0.046, 0.047],
        [0.079, -0.1],
        [0.034, -0.119],
        [0.019, -0.054],
      ],
      0.003,
      finish(style, style === "wood" ? 0x87522f : 0x475548),
      { x: s * 0.046, bevel: 0.0015, round: 0.3 },
    );
    pin(a, s * 0.049, -0.04, 0.04, finish("edge", 0x7f8b7b), 0.005);
    if (style !== "wood")
      for (let i = 0; i < 5; i++)
        wire(
          a,
          [
            [s * 0.049, -0.047 - i * 0.012, 0.023 + i * 0.004],
            [s * 0.05, -0.045 - i * 0.012, 0.059 + i * 0.004],
          ],
          0x26392f,
          0.0018,
        );
  }
  loft(
    a,
    [
      [0.004, 0.091, -0.116, -0.13],
      [0.082, 0.089, -0.103, -0.119],
    ],
    finish("polymer", 0x334239),
  );
  return a;
}
function guard(p, z, y, mat) {
  profile(
    p,
    [
      [z - 0.071, y + 0.04],
      [z + 0.064, y + 0.04],
      [z + 0.06, y - 0.041],
      [z + 0.018, y - 0.06],
      [z - 0.05, y - 0.044],
    ],
    0.025,
    mat,
    {
      bevel: 0.003,
      round: 0.23,
      holes: [
        [
          [z - 0.052, y + 0.022],
          [z - 0.037, y - 0.026],
          [z + 0.018, y - 0.04],
          [z + 0.044, y - 0.023],
          [z + 0.047, y + 0.022],
        ],
      ],
    },
  );
  profile(
    p,
    [
      [z + 0.012, y + 0.037],
      [z - 0.002, y + 0.009],
      [z + 0.007, y - 0.015],
      [z - 0.003, y - 0.023],
      [z - 0.017, y + 0.004],
      [z - 0.005, y + 0.037],
    ],
    0.014,
    finish("edge", 0x7f8e88),
    { bevel: 0.0015, round: 0.3 },
  );
}
function bore(p, z, y, r, mat) {
  cylinder(
    p,
    0,
    y,
    z - 0.001,
    r * 0.78,
    0.002,
    finish("metal", 0x101b18),
    true,
  );
  ring(p, 0, y, z, r * 0.79, r * 0.17, mat);
}
function optic(p, z, mat, large = false, compact = false) {
  const y = large ? 0.242 : 0.206,
    r = large ? 0.036 : 0.029,
    len = large ? 0.345 : compact ? 0.18 : 0.23;
  const glass = new THREE.MeshStandardMaterial({
    color: 0x2e828b,
    emissive: 0x092b32,
    roughness: 0.17,
    metalness: 0.76,
  });
  for (const at of [z - len * 0.25, z + len * 0.27]) {
    loft(
      p,
      [
        [at - 0.026, 0.065, y - 0.02, 0.12],
        [at + 0.026, 0.065, y - 0.02, 0.12],
      ],
      mat,
    );
    ring(p, 0, y, at, r + 0.006, 0.007, 0x56665b);
    for (const s of [-1, 1])
      pin(p, s * 0.041, y, at, finish("edge", 0xa4afa2), 0.004);
  }
  cylinder(p, 0, y, z, r, len, mat, true);
  for (const [at, l, rad, top] of [
    [z - len * 0.5, 0.095, r * 1.6, r],
    [z + len * 0.54, 0.07, r * 1.21, r],
  ]) {
    cylinder(p, 0, y, at, rad, l, mat, true, top);
    ring(p, 0, y, at - l * 0.47, rad, 0.004, 0x68756a);
  }
  const front = z - len * 0.5 - 0.048,
    back = z + len * 0.54 + 0.035;
  cylinder(p, 0, y, front - 0.001, r * 1.42, 0.002, glass, true);
  ring(p, 0, y, front, r * 1.47, 0.006, 0x253a34);
  cylinder(p, 0, y, back + 0.003, r * 0.94, 0.003, glass, true);
  ring(p, 0, y, back + 0.006, r * 0.99, 0.003, 0x52665d);
  for (let i = 0; i < 12; i++)
    ring(p, 0, y, z + len * 0.29 + i * 0.006, r * 1.1, 0.0019, 0x374b43);
  cylinder(p, 0, y + r + 0.012, z, 0.023, 0.03, mat);
  ring(p, 0, y + r + 0.027, z, 0.022, 0.0035, 0x899587, "y");
  cylinder(p, 0.044, y, z, 0.021, 0.025, mat).rotation.z = Math.PI / 2;
  pin(p, 0.06, y, z, finish("edge", 0x93a197), 0.01);
  for (let i = -1; i <= 1; i++)
    box(p, i * 0.007, y + r + 0.029, z, 0.002, 0.001, 0.012, 0xd4d9bc);
  stamp(
    p,
    large ? "CR / 08" : "CR / 04",
    "COAST OPTICS",
    [-r - 0.004, y, z - 0.028],
    0.1,
    0.026,
    [0, -Math.PI / 2, 0],
    "#aebcaf",
  );
}
function sight(p, z, y, mat, hood = true) {
  loft(
    p,
    [
      [z - 0.018, 0.052, y + 0.007, y - 0.052],
      [z + 0.025, 0.062, y + 0.007, y - 0.052],
    ],
    mat,
  );
  if (hood) ring(p, 0, y + 0.008, z, 0.027, 0.005, 0x334b3f);
  else
    for (const s of [-1, 1])
      profile(
        p,
        [
          [z - 0.017, y - 0.008],
          [z - 0.007, y + 0.045],
          [z + 0.013, y + 0.045],
          [z + 0.022, y - 0.008],
        ],
        0.009,
        mat,
        { x: s * 0.025, bevel: 0.002 },
      );
  box(p, 0, y + 0.003, z, 0.008, 0.032, 0.012, mat, 0, 0.002);
  box(p, 0, y + 0.021, z + 0.008, 0.008, 0.006, 0.003, 0xc9d5a2);
}
function magazine(p, z, len, curve, mat, style = "metal") {
  profile(
    p,
    [
      [z - 0.057, -0.071],
      [z + 0.055, -0.071],
      [z + 0.067 + curve * 0.17, -0.16],
      [z + 0.051 + curve, -0.071 - len],
      [z - 0.058 + curve, -0.086 - len],
      [z - 0.068 + curve * 0.19, -0.16],
    ],
    0.071,
    mat,
    { round: 0.28, bevel: 0.004 },
  );
  const base = z + curve,
    bottom = -0.071 - len;
  loft(
    p,
    [
      [base - 0.064, 0.088, bottom + 0.01, bottom - 0.007],
      [base + 0.057, 0.088, bottom + 0.023, bottom + 0.007],
    ],
    finish("polymer", 0x34443a),
  );
  for (const s of [-1, 1]) {
    for (let i = 0; i < 3; i++)
      wire(
        p,
        [
          [s * 0.041, -0.119, z - 0.033 + i * 0.03],
          [s * 0.041, -0.15 - len * 0.28, z - 0.03 + i * 0.03 + curve * 0.3],
          [s * 0.041, -0.065 - len, z - 0.033 + i * 0.03 + curve * 0.87],
        ],
        style === "polymer" ? 0x283e30 : 0x76877b,
        0.003,
      );
    if (style === "polymer")
      for (let i = 0; i < 3; i++)
        box(
          p,
          s * 0.043,
          -0.18 - i * 0.045,
          z + 0.005 + (curve * i) / 4,
          0.003,
          0.009,
          0.07,
          0x384e3d,
          0,
          0.002,
        );
  }
}
function stock(p, len, furniture, mat, style, id) {
  const rubber = finish("polymer", 0x2c3b32);
  if (style === "wire" || ["mac10", "bizon"].includes(id)) {
    for (const x of [-0.036, 0.036])
      wire(
        p,
        [
          [x, 0.031, 0.12],
          [x, 0.045, len - 0.04],
          [x, -0.137, len],
        ],
        0x6d7f70,
        0.008,
      );
    wire(
      p,
      [
        [-0.043, -0.13, len],
        [0, -0.15, len + 0.006],
        [0.043, -0.13, len],
      ],
      0x3a5041,
      0.012,
    );
    return;
  }
  const telescope = ["m4a4", "m4a1s", "xm1014", "scar20", "mp7"].includes(id),
    skeleton = [
      "mp9",
      "ump45",
      "sg553",
      "galil",
      "ssg08",
      "m4a4",
      "m4a1s",
      "xm1014",
    ].includes(id);
  if (telescope) {
    cylinder(p, 0, 0.025, 0.29, 0.031, 0.28, mat, true);
    for (const z of [0.21, 0.24]) ring(p, 0, 0.025, z, 0.033, 0.004, 0x7b8979);
  }
  const pts =
    style === "wood"
      ? [
          [0.15, 0.041],
          [0.25, 0.056],
          [0.34, 0.1],
          [len, 0.09],
          [len + 0.015, -0.186],
          [len - 0.052, -0.198],
          [0.37, -0.099],
          [0.3, -0.056],
          [0.19, -0.044],
        ]
      : [
          [telescope ? 0.32 : 0.18, 0.064],
          [0.38, 0.094],
          [len, 0.071],
          [len + 0.015, -0.19],
          [len - 0.071, -0.2],
          [0.4, -0.1],
          [0.3, -0.07],
          [telescope ? 0.32 : 0.18, -0.04],
        ];
  const holes = skeleton
    ? [
        [
          [0.34, 0.035],
          [0.39, -0.043],
          [len - 0.07, -0.126],
          [len - 0.05, 0.025],
        ],
      ]
    : [];
  profile(p, pts, id === "ssg08" ? 0.097 : 0.108, furniture, {
    holes,
    round: 0.22,
    bevel: 0.008,
  });
  if (style !== "wood") {
    loft(
      p,
      [
        [0.355, 0.11, 0.105, 0.076],
        [len - 0.045, 0.12, 0.102, 0.065],
      ],
      finish("polymer", 0x3f4e42),
    );
    for (const s of [-1, 1]) {
      pin(p, s * 0.06, -0.02, len - 0.078, mat, 0.006);
      if (!skeleton)
        profile(
          p,
          [
            [len - 0.18, 0.007],
            [len - 0.077, 0.014],
            [len - 0.063, -0.092],
            [len - 0.1, -0.104],
            [len - 0.185, -0.065],
          ],
          0.004,
          rubber,
          { x: s * 0.059, round: 0.2, bevel: 0.0015 },
        );
    }
    if (telescope)
      profile(
        p,
        [
          [0.34, -0.076],
          [0.43, -0.079],
          [0.45, -0.105],
          [0.375, -0.101],
        ],
        0.04,
        rubber,
        { bevel: 0.002 },
      );
  } else
    for (const s of [-1, 1]) {
      pin(p, s * 0.06, -0.05, len - 0.045, mat, 0.006);
      ring(p, s * 0.064, -0.122, len - 0.08, 0.02, 0.004, 0x586550).rotation.y =
        Math.PI / 2;
    }
  loft(
    p,
    [
      [len, 0.124, 0.071, -0.192],
      [len + 0.025, 0.126, 0.065, -0.19],
    ],
    rubber,
  );
  for (let i = 0; i < 7; i++)
    box(p, 0, -0.157 + i * 0.032, len + 0.027, 0.11, 0.004, 0.003, 0x6c7765);
}
function controls(p, bolt, start, width, m, id) {
  for (const s of [-1, 1]) {
    const x = s * (width / 2 + 0.004),
      z = ["ak47", "bizon"].includes(id) ? 0.09 : 0.073;
    pin(p, x, -0.014, 0.122, m.edge, 0.0065);
    pin(p, x, -0.043, -0.001, m.edge, 0.006);
    pin(p, x, 0.013, start + 0.03, m.edge, 0.005);
    pin(p, x, -0.028, z, m.steel, 0.01);
    profile(
      p,
      [
        [z - 0.044, -0.026],
        [z + 0.006, -0.034],
        [z + 0.01, -0.021],
        [z - 0.044, -0.019],
      ],
      0.005,
      m.edge,
      { x: x + s * 0.003, bevel: 0.001, round: 0.25 },
    );
    for (let i = 0; i < 2; i++)
      box(
        p,
        x + s * 0.004,
        -0.013 + i * 0.02,
        z + 0.024,
        0.002,
        0.003,
        0.005,
        i ? 0xb36b50 : 0x9ba997,
      );
    stamp(
      p,
      id.toUpperCase(),
      "CROSSLINE  /  02–17",
      [x + s * 0.003, 0.003, start + 0.11],
      0.118,
      0.03,
      [0, (s * Math.PI) / 2, 0],
    );
  }
  box(
    p,
    width / 2 + 0.003,
    0.039,
    0.015,
    0.005,
    0.035,
    0.112,
    m.black,
    0,
    0.006,
  );
  box(
    bolt,
    width / 2 + 0.008,
    0.036,
    0.017,
    0.01,
    0.027,
    0.1,
    m.edge,
    0,
    0.003,
  );
  box(
    bolt,
    width / 2 + 0.02,
    0.036,
    0.006,
    0.022,
    0.013,
    0.075,
    m.steel,
    0,
    0.004,
  );
  pin(p, -width / 2 - 0.007, -0.017, -0.042, m.edge, 0.009);
}
function frontFurniture(p, id, start, barrel, furniture, m) {
  const wood = id === "ak47",
    tube = ["mp5sd", "bizon", "g3sg1"].includes(id),
    modern = [
      "m4a4",
      "m4a1s",
      "sg553",
      "scar20",
      "galil",
      "m249",
      "negev",
    ].includes(id);
  const rear = start + 0.035,
    front = Math.max(-barrel + 0.22, start - 0.31),
    width = ["m249", "negev"].includes(id) ? 0.155 : 0.128;
  if (tube) {
    cylinder(
      p,
      0,
      0.018,
      (front + rear) / 2,
      0.07,
      rear - front,
      furniture,
      true,
    );
    for (let i = 0; i < 10; i++)
      ring(
        p,
        0,
        0.018,
        front + 0.014 + (i * (rear - front - 0.03)) / 9,
        0.07,
        0.003,
        0x334a3f,
      );
  } else if (wood) {
    loft(
      p,
      [
        [front, 0.108, 0.038, -0.05],
        [front + 0.045, 0.139, 0.035, -0.073],
        [rear - 0.025, 0.13, 0.03, -0.06],
        [rear, 0.105, 0.036, -0.034],
      ],
      furniture,
    );
    cylinder(
      p,
      0,
      0.085,
      (front + rear) / 2,
      0.043,
      rear - front - 0.024,
      furniture,
      true,
    );
    for (const z of [front + 0.018, rear - 0.012]) {
      ring(p, 0, 0.079, z, 0.043, 0.005, 0x354b3e);
      loft(
        p,
        [
          [z - 0.006, 0.14, 0.033, -0.063],
          [z + 0.006, 0.14, 0.033, -0.063],
        ],
        m.steel,
      );
    }
    for (const s of [-1, 1])
      for (let i = 0; i < 3; i++)
        box(
          p,
          s * 0.041,
          0.085,
          front + 0.09 + i * 0.043,
          0.006,
          0.016,
          0.024,
          m.black,
          0,
          0.004,
        );
  } else {
    loft(
      p,
      [
        [front, width * 0.84, 0.078, -0.044],
        [front + 0.025, width, 0.086, -0.066],
        [rear - 0.02, width, 0.081, -0.057],
        [rear, width * 0.78, 0.064, -0.04],
      ],
      furniture,
    );
    const count = Math.max(3, Math.floor((rear - front) / 0.039));
    for (const s of [-1, 1])
      for (let i = 0; i < count; i++) {
        const z =
          front + 0.032 + (i * (rear - front - 0.06)) / Math.max(1, count - 1);
        profile(
          p,
          [
            [z - 0.012, 0.047],
            [z + 0.009, 0.047],
            [z + 0.015, 0.02],
            [z - 0.009, 0.02],
          ],
          0.002,
          m.black,
          { x: s * (width / 2 + 0.002), bevel: 0.002, round: 0.17 },
        );
        if (modern && i % 2 === 0)
          box(
            p,
            s * (width / 2 + 0.003),
            -0.018,
            z,
            0.003,
            0.012,
            0.028,
            m.black,
            0,
            0.004,
          );
      }
    if (modern) {
      rail(p, front + 0.022, rear - front - 0.04, 0.095, m.steel, 0.077);
      rail(p, front + 0.026, rear - front - 0.065, -0.071, m.dark, 0.07);
    }
    for (const s of [-1, 1])
      for (const z of [front + 0.018, rear - 0.016])
        pin(p, s * (width / 2 + 0.005), 0.002, z, m.edge, 0.006);
  }
  return front;
}
function barrelAssembly(p, id, barrel, front, m) {
  const suppressed = WEAPONS[id].suppressed,
    z = -barrel - (suppressed ? 0.055 : 0),
    y = 0.048;
  cylinder(p, 0, y, (z + front) / 2, 0.018, front - z, m.steel, true);
  if (["ak47", "galil", "bizon", "sg553"].includes(id)) {
    cylinder(p, 0, 0.098, front - 0.058, 0.018, 0.15, m.steel, true);
    loft(
      p,
      [
        [front - 0.115, 0.046, 0.11, 0.018],
        [front - 0.08, 0.046, 0.11, 0.018],
      ],
      m.steel,
    );
  }
  for (const at of [front - 0.018, z + 0.105])
    ring(p, 0, y, at, 0.025, 0.007, 0x667768);
  if (suppressed) {
    cylinder(p, 0, y, z + 0.104, 0.041, 0.205, m.dark, true);
    for (const at of [z + 0.012, z + 0.16, z + 0.198])
      ring(p, 0, y, at, 0.042, 0.0045, 0x6d7c6d);
    for (let i = 0; i < 8; i++)
      ring(p, 0, y, z + 0.055 + i * 0.011, 0.042, 0.0014, 0x475f4d);
    stamp(
      p,
      "HUSH / 02",
      "CROSSLINE",
      [-0.042, y, z + 0.119],
      0.13,
      0.025,
      [0, -Math.PI / 2, 0],
      "#98a89b",
    );
    bore(p, z - 0.003, y, 0.04, 0x7b8a7c);
  } else {
    cylinder(
      p,
      0,
      y,
      z + 0.031,
      id === "awp" ? 0.035 : 0.029,
      0.068,
      m.steel,
      true,
    );
    for (const s of [-1, 1])
      for (let i = 0; i < 3; i++)
        box(
          p,
          s * 0.028,
          y,
          z + 0.012 + i * 0.018,
          0.004,
          0.027,
          0.008,
          m.black,
          0,
          0.002,
        );
    ring(p, 0, y, z + 0.065, 0.029, 0.005, 0x809082);
    bore(p, z - 0.005, y, id === "awp" ? 0.034 : 0.029, 0x718477);
  }
  return z - 0.01;
}
function singlePistol(id) {
  const [length, barrel, , color] = blueprints[id],
    g = new THREE.Group(),
    m = palette();
  const wood = ["dualberettas", "r8"].includes(id),
    furniture = finish(wood ? "wood" : "polymer", color),
    big = id === "deagle" ? 1.15 : 1;
  const mag = joint(g, 0, 0, 0),
    bolt = joint(g, 0, 0, 0);
  mag.name = "magazine";
  bolt.name = "bolt";
  const muzzle =
    id === "usps" ? -0.48 : id === "tec9" ? -0.399 : -barrel + 0.045;
  profile(
    g,
    [
      [0.145, 0.034],
      [-length + 0.11, 0.022],
      [-length + 0.1, -0.029],
      [-0.072, -0.053],
      [-0.023, -0.077],
      [0.07, -0.098],
      [0.14, -0.056],
    ],
    0.078 * big,
    furniture,
    { round: 0.25, bevel: 0.006 },
  );
  const pistolGrip = grip(
    g,
    0.077,
    -0.103,
    furniture,
    big,
    wood ? "wood" : "polymer",
  );
  // Keep the web under the slide while bringing the heel/floorplate up to a
  // believable hand-length. The previous rifle-sized grip dwarfed the palm.
  pistolGrip.scale.y *= 0.76;
  mag.scale.y = 0.78;
  mag.position.y = -0.0154;
  guard(g, -0.008, -0.09, id === "deagle" || wood ? m.steel : furniture);
  if (id === "r8") {
    profile(
      g,
      [
        [0.102, 0.106],
        [-0.13, 0.104],
        [-0.167, 0.065],
        [-0.137, -0.029],
        [0.071, -0.02],
        [0.117, 0.033],
      ],
      0.046,
      m.steel,
      {
        holes: [
          [
            [-0.1, 0.071],
            [0.037, 0.071],
            [0.051, 0.009],
            [-0.098, 0.009],
          ],
        ],
        bevel: 0.004,
      },
    );
    cylinder(bolt, 0, 0.036, -0.03, 0.058, 0.108, m.edge, true);
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3;
      cylinder(
        bolt,
        Math.sin(a) * 0.049,
        0.036 + Math.cos(a) * 0.049,
        -0.03,
        0.012,
        0.093,
        m.steel,
        true,
      );
      cylinder(
        bolt,
        Math.sin(a) * 0.032,
        0.036 + Math.cos(a) * 0.032,
        0.026,
        0.01,
        0.003,
        m.brass,
        true,
      );
    }
    loft(
      g,
      [
        [-0.38, 0.06, 0.088, 0.013],
        [-0.145, 0.074, 0.103, -0.016],
      ],
      m.steel,
    );
    cylinder(g, 0, 0.037, -0.25, 0.027, 0.266, m.steel, true);
    cylinder(g, 0, -0.02, -0.2, 0.013, 0.22, m.edge, true);
    profile(
      g,
      [
        [0.08, 0.077],
        [0.103, 0.15],
        [0.134, 0.155],
        [0.142, 0.141],
        [0.111, 0.118],
        [0.107, 0.07],
      ],
      0.022,
      m.steel,
      { bevel: 0.002 },
    );
    for (const s of [-1, 1]) pin(g, s * 0.048, -0.025, 0.09, m.edge);
  } else if (id === "tec9") {
    cylinder(bolt, 0, 0.06, -0.084, 0.046, 0.275, m.steel, true);
    cylinder(g, 0, 0.061, -0.265, 0.045, 0.237, m.steel, true);
    for (const a of [0, Math.PI / 2, Math.PI, Math.PI * 1.5])
      for (let i = 0; i < 5; i++) {
        const port = cylinder(
          g,
          Math.sin(a) * 0.044,
          0.06 + Math.cos(a) * 0.044,
          -0.18 - i * 0.037,
          0.011,
          0.003,
          m.black,
        );
        port.rotation.z = -a;
      }
    magazine(mag, 0.07, 0.33, 0.008, m.steel);
    box(bolt, 0.06, 0.061, 0.003, 0.034, 0.018, 0.046, m.edge, 0, 0.003);
  } else {
    const front = -length + 0.11,
      steel =
        id === "deagle"
          ? finish("edge", 0xb5b6a9)
          : id === "dualberettas"
            ? finish("edge", 0x939e93)
            : m.steel;
    loft(
      bolt,
      [
        [front, 0.072 * big, 0.107 * big, 0.021],
        [front + 0.029, 0.089 * big, 0.111 * big, 0.012],
        [0.089, 0.089 * big, 0.112 * big, 0.014],
        [0.143, 0.075 * big, 0.097 * big, 0.01],
      ],
      steel,
    );
    for (const s of [-1, 1]) {
      profile(
        bolt,
        [
          [front + 0.04, 0.082],
          [-0.028, 0.084],
          [-0.018, 0.043],
          [front + 0.035, 0.043],
        ],
        0.002,
        id === "p250" ? furniture : m.edge,
        { x: s * 0.047 * big, round: 0.2, bevel: 0.001 },
      );
      const n = id === "glock18" ? 7 : id === "deagle" ? 6 : 9;
      for (let i = 0; i < n; i++)
        profile(
          bolt,
          [
            [0.026 + i * 0.011, 0.096],
            [0.03 + i * 0.011, 0.096],
            [0.018 + i * 0.011, 0.03],
            [0.014 + i * 0.011, 0.03],
          ],
          0.002,
          m.black,
          { x: s * 0.047 * big, bevel: 0.0007, round: 0.03 },
        );
      if (["p2000", "p250", "fiveseven"].includes(id))
        for (let i = 0; i < 4; i++)
          box(
            bolt,
            s * 0.047,
            0.064,
            front + 0.031 + i * 0.011,
            0.002,
            0.035,
            0.003,
            m.black,
          );
      pin(g, s * 0.047, -0.015, 0.052, m.edge, 0.005);
      profile(
        g,
        [
          [0.08, 0.002],
          [0.026, -0.002],
          [0.02, -0.013],
          [0.081, -0.013],
        ],
        0.007,
        m.edge,
        { x: s * 0.047, bevel: 0.001 },
      );
      stamp(
        bolt,
        id === "dualberettas" ? "DB / 02" : id.toUpperCase(),
        "CROSSLINE ARMORY",
        [s * 0.049 * big, 0.061, front + 0.1],
        0.124,
        0.025,
        [0, (s * Math.PI) / 2, 0],
        "#526458",
      );
    }
    box(bolt, 0, 0.113 * big, -0.015, 0.049, 0.004, 0.068, m.black, 0, 0.004);
    cylinder(g, 0, 0.064, -0.071, 0.02, 0.156, m.edge, true);
    if (id === "dualberettas") {
      loft(
        bolt,
        [
          [front + 0.011, 0.064, 0.11, 0.06],
          [front + 0.174, 0.064, 0.11, 0.06],
        ],
        m.black,
      );
      cylinder(g, 0, 0.09, front + 0.095, 0.016, 0.17, m.edge, true);
    }
    cylinder(
      g,
      0,
      0.051,
      (muzzle + front + 0.022) / 2,
      0.02 * big,
      Math.abs(muzzle - front - 0.022) + 0.014,
      m.edge,
      true,
    );
    loft(
      mag,
      [
        [0.04, 0.096 * big, -0.252 * big, -0.272 * big],
        [0.151, 0.093 * big, -0.237 * big, -0.26 * big],
      ],
      m.dark,
    );
    // Full removable magazine, not just a floorplate moving out of a solid grip.
    profile(
      mag,
      [
        [0.045, -0.086],
        [0.102, -0.072],
        [0.143, -0.235],
        [0.075, -0.257],
      ],
      0.058 * big,
      m.steel,
      { bevel: 0.003, round: 0.12 },
    );
    for (const side of [-1, 1])
      for (let n = 0; n < 5; n++)
        pin(
          mag,
          side * 0.031,
          -0.115 - n * 0.026,
          0.075 + n * 0.008,
          m.black,
          0.003,
        );
    if (id === "usps") {
      cylinder(g, 0, 0.05, -0.365, 0.037, 0.227, m.dark, true);
      for (const z of [-0.47, -0.444, -0.287, -0.263])
        ring(g, 0, 0.05, z, 0.037, 0.0035, 0x68786a);
      stamp(g, "HUSH / P", "CROSSLINE", [-0.038, 0.05, -0.36], 0.15, 0.024, [
        0,
        -Math.PI / 2,
        0,
      ]);
    }
    if (id === "cz75") grip(g, -0.17, -0.129, m.dark, 0.66);
    if (id === "deagle")
      loft(
        bolt,
        [
          [front - 0.012, 0.052, 0.127, 0.09],
          [front + 0.141, 0.052, 0.132, 0.09],
        ],
        steel,
      );
  }
  bore(
    g,
    muzzle - 0.003,
    0.05,
    id === "usps"
      ? 0.037
      : id === "r8"
        ? 0.026
        : id === "tec9"
          ? 0.04
          : 0.021 * big,
    m.edge,
  );
  loft(
    bolt,
    [
      [0.098, 0.067, 0.139, 0.111],
      [0.136, 0.061, 0.141, 0.109],
    ],
    m.dark,
  );
  for (const x of [-0.02, 0.02])
    box(bolt, x, 0.138, 0.137, 0.009, 0.008, 0.002, 0xc4d9a0);
  box(bolt, 0, 0.137, -length + 0.145, 0.014, 0.026, 0.027, m.dark, 0, 0.003);
  box(bolt, 0, 0.144, -length + 0.16, 0.008, 0.009, 0.002, 0xdce5ae);
  g.userData.muzzle = muzzle;
  return g;
}
function bullpup(p, id, furniture, m, mag) {
  const p90 = id === "p90";
  profile(
    p,
    p90
      ? [
          [-0.33, 0.046],
          [-0.17, 0.075],
          [0.395, 0.066],
          [0.426, -0.08],
          [0.37, -0.183],
          [0.188, -0.19],
          [0.069, -0.085],
          [-0.121, -0.055],
          [-0.153, -0.192],
          [-0.229, -0.215],
          [-0.313, -0.146],
        ]
      : [
          [-0.345, 0.038],
          [-0.218, 0.063],
          [0.4, 0.073],
          [0.413, -0.19],
          [0.32, -0.22],
          [0.223, -0.142],
          [0.109, -0.121],
          [-0.014, -0.065],
          [-0.279, -0.091],
        ],
    p90 ? 0.157 : 0.138,
    furniture,
    {
      bevel: 0.012,
      round: 0.25,
      holes: p90
        ? [
            [
              [-0.275, -0.051],
              [-0.27, -0.135],
              [-0.224, -0.173],
              [-0.191, -0.143],
              [-0.167, -0.051],
            ],
          ]
        : id === "aug"
          ? [
              [
                [-0.047, -0.046],
                [0.041, -0.089],
                [0.033, -0.172],
                [-0.009, -0.184],
                [-0.098, -0.09],
              ],
            ]
          : [],
    },
  );
  loft(
    p,
    [
      [0.388, 0.168, 0.073, -0.185],
      [0.425, 0.169, 0.063, -0.181],
    ],
    m.rubber,
  );
  for (const s of [-1, 1]) {
    profile(
      p,
      [
        [0.15, 0.043],
        [0.364, 0.044],
        [0.376, -0.093],
        [0.322, -0.116],
        [0.188, -0.066],
      ],
      0.003,
      m.rubber,
      { x: s * 0.076, round: 0.2, bevel: 0.002 },
    );
    pin(p, s * 0.081, -0.01, 0.326, m.edge, 0.008);
    if (p90) pin(p, s * 0.081, -0.08, 0.199, m.edge, 0.009);
  }
  if (p90) {
    loft(
      mag,
      [
        [-0.32, 0.112, 0.145, 0.104],
        [-0.28, 0.135, 0.159, 0.102],
        [0.155, 0.133, 0.159, 0.102],
        [0.185, 0.105, 0.143, 0.104],
      ],
      finish("polymer", 0x817d55),
    );
    loft(
      mag,
      [
        [-0.279, 0.127, 0.164, 0.151],
        [0.126, 0.127, 0.164, 0.151],
      ],
      m.dark,
    );
    for (let i = 0; i < 14; i++) {
      const z = -0.265 + i * 0.028;
      cylinder(mag, 0, 0.164, z, 0.009, 0.093, m.brass).rotation.z =
        Math.PI / 2;
      box(mag, 0, 0.164, z, 0.024, 0.024, 0.014, 0x5a6243, 0, 0.003);
    }
    profile(
      p,
      [
        [-0.272, 0.166],
        [-0.26, 0.265],
        [-0.1, 0.275],
        [-0.057, 0.178],
      ],
      0.085,
      m.dark,
      {
        holes: [
          [
            [-0.24, 0.184],
            [-0.107, 0.19],
            [-0.129, 0.245],
            [-0.221, 0.24],
          ],
        ],
        bevel: 0.005,
      },
    );
    sight(p, -0.18, 0.288, m.dark, true);
    cylinder(p, 0, 0.047, -0.399, 0.021, 0.183, m.steel, true);
  } else {
    magazine(
      mag,
      0.256,
      0.224,
      id === "aug" ? -0.026 : 0,
      finish("polymer", id === "aug" ? 0x687b51 : 0x536359),
      "polymer",
    );
    if (id === "aug") grip(p, -0.344, -0.126, furniture, 0.66);
    if (id === "famas") {
      profile(
        p,
        [
          [-0.307, 0.102],
          [-0.284, 0.26],
          [0.163, 0.251],
          [0.2, 0.09],
        ],
        0.07,
        m.dark,
        {
          holes: [
            [
              [-0.259, 0.122],
              [0.155, 0.119],
              [0.136, 0.217],
              [-0.24, 0.224],
            ],
          ],
          bevel: 0.005,
          round: 0.18,
        },
      );
      sight(p, -0.244, 0.272, m.dark, false);
      box(p, 0, 0.269, 0.12, 0.048, 0.03, 0.028, m.steel, 0, 0.004);
      for (const s of [-1, 1])
        wire(
          p,
          [
            [s * 0.063, 0.009, -0.308],
            [s * 0.088, -0.173, -0.363],
          ],
          0x526853,
          0.008,
        );
    }
  }
}
function shotgun(p, id, barrel, furniture, m, pump) {
  const double = id === "sawedoff",
    front = -barrel + 0.005;
  if (double) {
    for (const x of [-0.031, 0.031]) {
      cylinder(
        p,
        x,
        0.048,
        (front - 0.135) / 2,
        0.03,
        Math.abs(front + 0.135),
        m.steel,
        true,
      );
      bore(joint(p, x, 0, 0), front - 0.01, 0.048, 0.03, m.edge);
    }
    loft(
      p,
      [
        [front, 0.017, 0.086, 0.07],
        [-0.132, 0.017, 0.088, 0.07],
      ],
      m.edge,
    );
    loft(
      pump,
      [
        [-0.45, 0.09, 0.018, -0.067],
        [-0.23, 0.109, 0.027, -0.089],
        [-0.175, 0.094, 0.022, -0.047],
      ],
      furniture,
    );
    profile(
      p,
      [
        [0.1, -0.065],
        [0.29, -0.17],
        [0.318, -0.23],
        [0.24, -0.254],
        [0.158, -0.2],
        [0.051, -0.131],
      ],
      0.093,
      furniture,
      { round: 0.3, bevel: 0.008 },
    );
    for (const s of [-1, 1]) pin(p, s * 0.051, -0.173, 0.212, m.edge);
    profile(
      p,
      [
        [0.062, 0.104],
        [0.107, 0.134],
        [0.142, 0.135],
        [0.157, 0.11],
        [0.1, 0.089],
      ],
      0.026,
      m.edge,
      { bevel: 0.002 },
    );
  } else {
    cylinder(
      p,
      0,
      0.048,
      (front - 0.17) / 2,
      0.028,
      Math.abs(front + 0.17),
      m.steel,
      true,
    );
    cylinder(
      p,
      0,
      -0.027,
      (front + 0.09 - 0.16) / 2,
      0.027,
      Math.abs(front + 0.25),
      m.dark,
      true,
    );
    const z = id === "nova" ? -0.46 : -0.42;
    loft(
      pump,
      [
        [z - 0.128, 0.1, 0.021, -0.085],
        [z - 0.105, 0.135, 0.029, -0.09],
        [z + 0.1, 0.135, 0.036, -0.09],
        [z + 0.13, 0.096, 0.014, -0.064],
      ],
      furniture,
    );
    for (let i = 0; i < 10; i++)
      loft(
        pump,
        [
          [z - 0.105 + i * 0.024, 0.141, 0.029, -0.09],
          [z - 0.098 + i * 0.024, 0.141, 0.029, -0.09],
        ],
        m.rubber,
      );
    for (const x of [-0.025, 0.025])
      cylinder(p, x, -0.01, -0.25, 0.005, 0.32, m.edge, true);
    bore(p, front - 0.011, 0.048, 0.029, m.edge);
    sight(p, front + 0.105, 0.104, m.dark, false);
    for (let i = 0; i < (id === "nova" ? 4 : 5); i++) {
      cylinder(
        p,
        -0.067,
        -0.003,
        -0.135 + i * 0.042,
        0.017,
        0.08,
        finish("polymer", 0x8f473d),
      );
      cylinder(p, -0.067, -0.046, -0.135 + i * 0.042, 0.017, 0.016, m.brass);
      box(
        p,
        -0.069,
        -0.014,
        -0.135 + i * 0.042,
        0.036,
        0.023,
        0.039,
        m.dark,
        0,
        0.004,
      );
    }
  }
  return front - 0.018;
}
function heavyParts(p, id, mag, barrel, furniture, m) {
  profile(
    mag,
    [
      [-0.17, -0.075],
      [0.075, -0.075],
      [0.094, -0.291],
      [0.067, -0.356],
      [-0.16, -0.349],
      [-0.195, -0.291],
    ],
    0.22,
    furniture,
    { bevel: 0.012, round: 0.16 },
  );
  loft(
    mag,
    [
      [-0.18, 0.246, -0.087, -0.117],
      [0.074, 0.246, -0.087, -0.117],
    ],
    m.dark,
  );
  for (const s of [-1, 1]) {
    profile(
      mag,
      [
        [-0.141, -0.153],
        [0.043, -0.151],
        [0.051, -0.287],
        [-0.14, -0.29],
      ],
      0.003,
      finish("fabric", id === "m249" ? 0x849064 : 0x6d7f58),
      { x: s * 0.116, bevel: 0.002 },
    );
    stamp(
      mag,
      id === "m249" ? "BX / 100" : "BX / 150",
      "CROSSLINE FIELD BELT",
      [s * 0.121, -0.207, -0.045],
      0.155,
      0.039,
      [0, (s * Math.PI) / 2, 0],
      "#d0c9a7",
    );
  }
  for (let i = 0; i < 8; i++) {
    const x = 0.106 + Math.sin(i * 0.35) * 0.055,
      y = 0.021 - i * 0.028;
    cylinder(mag, x, y, -0.079, 0.011, 0.096, m.brass, true);
    cylinder(
      mag,
      x,
      y,
      -0.137,
      0.011,
      0.024,
      finish("edge", 0xab7653),
      true,
      0.001,
    );
    box(mag, x, y, -0.071, 0.022, 0.021, 0.025, m.dark, 0, 0.003);
  }
  wire(
    p,
    [
      [0, 0.12, -0.19],
      [0, 0.254, -0.172],
      [0, 0.269, -0.033],
      [0, 0.145, 0.028],
    ],
    0x293e32,
    0.014,
  );
  for (let i = 0; i < 7; i++)
    box(
      p,
      0,
      0.263,
      -0.14 + i * 0.014,
      0.045,
      0.026,
      0.006,
      0x576548,
      0,
      0.002,
    );
  for (const s of [-1, 1]) {
    const hinge = joint(p, s * 0.061, 0.01, -barrel * 0.66);
    wire(
      hinge,
      [
        [0, 0, 0],
        [s * 0.092, -0.271, -0.091],
        [s * 0.108, -0.282, -0.117],
      ],
      0x63765c,
      0.011,
    );
    box(hinge, s * 0.096, -0.278, -0.111, 0.04, 0.015, 0.074, m.dark, 0, 0.003);
    pin(hinge, s * 0.005, -0.013, 0.002, m.edge, 0.011);
  }
}
function longGun(id) {
  const w = WEAPONS[id],
    [length, barrel, stockLength, color, curve] = blueprints[id],
    g = new THREE.Group(),
    m = palette();
  const smg = w.type === "SMG",
    heavy = w.type === "HEAVY",
    sniper = w.type === "SNIPER",
    wood = ["ak47", "sawedoff"].includes(id),
    furniture = finish(wood ? "wood" : "polymer", color);
  const mag = joint(g, 0, 0, 0),
    bolt = joint(g, 0, 0, 0);
  mag.name = "magazine";
  bolt.name = "bolt";
  const bull = ["p90", "famas", "aug"].includes(id),
    pump = ["nova", "xm1014", "sawedoff"].includes(id),
    start = -length + 0.17,
    width = heavy ? 0.148 : id === "mac10" ? 0.116 : 0.098;
  profile(
    g,
    [
      [start + 0.016, 0.041],
      [start - 0.006, -0.026],
      [start + 0.025, -0.066],
      [-0.192, -0.069],
      [-0.181, -0.112],
      [-0.071, -0.112],
      [-0.045, -0.058],
      [0.12, -0.079],
      [0.191, -0.033],
      [0.171, 0.058],
    ],
    width,
    m.steel,
    { round: 0.15, bevel: 0.0045 },
  );
  if (["ak47", "bizon", "mp5sd", "g3sg1"].includes(id)) {
    cylinder(
      g,
      0,
      0.07,
      (start + 0.139) / 2,
      0.047,
      0.139 - start,
      m.steel,
      true,
    );
    loft(
      g,
      [
        [start, 0.099, 0.071, 0.01],
        [0.155, 0.099, 0.069, 0.013],
      ],
      m.steel,
    );
    for (const z of [start + 0.024, 0.121])
      ring(g, 0, 0.067, z, 0.047, 0.0025, 0x647467);
    if (id === "ak47")
      for (const s of [-1, 1]) {
        profile(
          g,
          [
            [start + 0.02, 0.031],
            [0.101, 0.032],
            [0.114, -0.03],
            [-0.129, -0.039],
          ],
          0.002,
          m.dark,
          { x: s * 0.055, bevel: 0.001 },
        );
        for (const z of [start + 0.04, -0.079, 0.089])
          pin(g, s * 0.059, -0.007, z, m.edge, 0.005);
      }
  } else {
    const top = heavy ? joint(g, 0, 0, 0) : g;
    if (heavy) top.name = "topCover";
    loft(
      top,
      [
        [start - 0.015, width * 0.8, 0.091, 0.011],
        [start + 0.029, width * 1.1, 0.116, 0.006],
        [0.068, width * 1.08, 0.113, 0.008],
        [0.171, width * 0.8, 0.091, 0.014],
      ],
      ["scar20", "mp9", "mp7"].includes(id) ? furniture : m.steel,
    );
  }
  if (!bull && id !== "sawedoff") {
    grip(
      g,
      0.095,
      -0.167,
      furniture,
      heavy ? 1.08 : 0.98,
      wood ? "wood" : "polymer",
    );
    stock(g, stockLength, furniture, m.steel, wood ? "wood" : w.model, id);
  }
  if (id !== "p90") guard(g, 0.009, -0.099, m.steel);
  if (bull) bullpup(g, id, furniture, m, mag);
  let muzzle;
  if (pump) {
    const p = joint(g, 0, 0, 0);
    p.name = "pump";
    muzzle = shotgun(g, id, barrel, furniture, m, p);
  } else {
    const front =
      id === "p90"
        ? -0.318
        : frontFurniture(g, id, start, barrel, furniture, m);
    muzzle = barrelAssembly(g, id, barrel, front, m);
  }
  if (heavy) heavyParts(g, id, mag, barrel, furniture, m);
  else if (id === "bizon") {
    cylinder(mag, 0, -0.124, -0.22, 0.064, 0.45, furniture, true);
    for (const z of [-0.439, -0.411, -0.024, -0.005])
      ring(mag, 0, -0.124, z, 0.066, 0.006, 0x324938);
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI) / 6;
      wire(
        mag,
        [
          [Math.sin(a) * 0.065, -0.124 + Math.cos(a) * 0.065, -0.403],
          [Math.sin(a) * 0.065, -0.124 + Math.cos(a) * 0.065, -0.04],
        ],
        0x748064,
        0.0025,
      );
    }
    stamp(
      mag,
      "HX / 64",
      "CROSSLINE HELIX",
      [-0.066, -0.124, -0.23],
      0.21,
      0.04,
      [0, -Math.PI / 2, 0],
    );
  } else if (!bull && !pump)
    magazine(
      mag,
      smg && ["mac10", "mp9", "mp7"].includes(id) ? 0.112 : -0.13,
      id === "mag7" ? 0.255 : smg ? 0.305 : sniper ? 0.16 : 0.282,
      curve,
      id === "ak47" ? m.steel : finish("polymer", 0x4f6051),
      id === "ak47" ? "metal" : "polymer",
    );
  if (w.scoped)
    optic(
      g,
      sniper ? -0.045 : id === "aug" ? -0.18 : -0.13,
      m.dark,
      sniper,
      id === "aug",
    );
  else if (!bull) {
    if (id !== "ak47" && !pump)
      rail(g, start + 0.021, length - 0.045, 0.124, m.steel);
    else if (id === "ak47") {
      loft(
        g,
        [
          [start + 0.052, 0.039, 0.138, 0.09],
          [start + 0.15, 0.037, 0.139, 0.09],
        ],
        m.steel,
      );
      for (let i = 0; i < 6; i++)
        box(
          g,
          -0.022,
          0.129,
          start + 0.058 + i * 0.013,
          0.003,
          0.008,
          0.003,
          m.edge,
        );
    }
    sight(
      g,
      pump ? 0.125 : -barrel * 0.71,
      pump ? 0.151 : 0.158,
      m.dark,
      !["m4a4", "m4a1s", "mag7", "m249", "negev"].includes(id),
    );
    if (!pump) {
      loft(
        g,
        [
          [0.097, 0.088, 0.16, 0.119],
          [0.139, 0.085, 0.16, 0.119],
        ],
        m.dark,
      );
      ring(g, 0, 0.158, 0.127, 0.012, 0.003, 0x7c8979);
    }
  }
  if (id === "mp7") grip(g, -0.256, -0.145, m.dark, 0.67);
  if (id === "mp9") grip(g, -0.274, -0.125, furniture, 0.58);
  if (id === "mac10") {
    wire(
      g,
      [
        [0, 0.111, -0.075],
        [0, 0.166, -0.064],
        [0, 0.169, -0.02],
      ],
      0x697967,
      0.008,
    );
    ring(g, 0, 0.117, -0.279, 0.018, 0.006, 0x2d4835);
    for (const s of [-1, 1])
      profile(
        g,
        [
          [-0.18, 0.005],
          [0.09, 0.005],
          [0.1, -0.053],
          [-0.18, -0.046],
        ],
        0.002,
        furniture,
        { x: s * 0.063, bevel: 0.0015 },
      );
  }
  if (sniper) {
    for (const s of [-1, 1]) {
      profile(
        g,
        [
          [0.19, 0.044],
          [0.29, 0.062],
          [0.49, 0.096],
          [0.61, 0.07],
          [0.59, -0.06],
          [0.39, -0.086],
          [0.26, -0.12],
          [0.19, -0.075],
        ],
        0.005,
        furniture,
        { x: s * 0.061, bevel: 0.003 },
      );
      pin(g, s * 0.069, -0.053, 0.307, m.edge, 0.01);
    }
    if (["awp", "ssg08"].includes(id)) {
      const handle = joint(bolt, 0, 0, 0);
      handle.name = "chargingHandle";
      wire(
        handle,
        [
          [0.054, 0.06, 0.104],
          [0.086, 0.049, 0.104],
          [0.116, -0.019, 0.104],
          [0.146, -0.033, 0.104],
        ],
        0x8e9c8b,
        0.008,
      );
      ellipsoid(handle, 0.144, -0.033, 0.104, 0.023, 0.022, 0.025, m.dark);
      cylinder(g, 0, 0.081, -0.005, 0.026, 0.272, m.edge, true);
      for (const s of [-1, 1]) {
        wire(
          g,
          [
            [s * 0.047, -0.041, -barrel * 0.59],
            [s * 0.084, -0.063, -barrel * 0.37],
          ],
          0x5f7560,
          0.01,
        );
        ring(
          g,
          s * 0.061,
          -0.062,
          -barrel * 0.5,
          0.014,
          0.004,
          0x9aa58d,
        ).rotation.y = Math.PI / 2;
      }
    }
  }
  controls(g, bolt, start, width, m, id);
  g.userData.muzzle = muzzle;
  return g;
}
export function weaponModel(id) {
  if (id === "knife") return knifeModel();
  if (id === "bomb") return bombModel();
  if (["he", "flash", "smoke"].includes(id)) return grenadeModel(id);
  if (!WEAPONS[id]) throw new Error(`Unknown model ${id}`);
  let g;
  if (id === "dualberettas") {
    g = new THREE.Group();
    for (const s of [-1, 1]) {
      const p = singlePistol(id);
      p.position.set(s * 0.126, 0, s * 0.018);
      p.rotation.z = -s * 0.045;
      g.add(p);
    }
    g.userData.muzzle = -0.288;
  } else g = WEAPONS[id].type === "PISTOL" ? singlePistol(id) : longGun(id);
  g.name = id;
  const m = palette();
  if (
    WEAPONS[id].type === "PISTOL" &&
    id !== "dualberettas" &&
    id !== "r8" &&
    id !== "tec9"
  ) {
    // Rear-facing detail matters most at FPS distance: recessed striker plate,
    // separate extractor and a rounded beavertail above the firing hand.
    box(g, 0, 0.035, 0.155, 0.054, 0.051, 0.008, m.black, 0, 0.006);
    box(g, 0, 0.035, 0.161, 0.037, 0.029, 0.005, m.steel, 0, 0.003);
    for (const x of [-0.012, 0, 0.012])
      box(g, x, 0.034, 0.165, 0.003, 0.017, 0.002, m.edge, 0, 0.001);
    profile(
      g,
      [
        [0.113, -0.035],
        [0.168, -0.039],
        [0.175, -0.052],
        [0.136, -0.069],
        [0.11, -0.062],
      ],
      0.074,
      m.dark,
      { bevel: 0.003, round: 0.28 },
    );
    box(g, 0.047, 0.037, 0.077, 0.008, 0.016, 0.058, m.edge, 0, 0.003);
  } else if (WEAPONS[id].type !== "PISTOL") {
    // Captured fasteners, rear sling eye and vented charging latch are shared
    // manufacturing details; the existing category-specific silhouettes remain.
    for (const x of [-0.042, 0.042]) pin(g, x, 0.081, 0.151, m.edge, 0.005);
    ring(g, 0.063, -0.061, 0.2, 0.016, 0.004, 0x89938b, "y");
    box(g, 0, 0.122, 0.138, 0.073, 0.014, 0.037, m.dark, 0, 0.004);
    for (const x of [-0.025, -0.012, 0, 0.012, 0.025])
      box(g, x, 0.131, 0.144, 0.004, 0.003, 0.026, m.edge, 0, 0.001);
  }
  const muzzle = joint(g, 0, 0.048, g.userData.muzzle);
  muzzle.name = "muzzle";
  bake(g);
  return g;
}
