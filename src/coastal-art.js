import * as THREE from "three";
import { box, cylinder, ellipsoid, joint, material } from "./geometry.js";
import { wire, ring } from "./equipment.js";
import { coastalMaterial } from "./coastal-materials.js";

const limestone = coastalMaterial("stone"),
  ivory = material(0xe1d1a8),
  darkStone = material(0x8d8267),
  iron = material(0x32494c, 0.55),
  wood = coastalMaterial("wood"),
  blue = material(0x326f8d),
  clay = material(0xc26b45),
  leaves = [material(0x3b7246), material(0x588b44), material(0x769b49)];
const clothMaterials = new Map();
const foliageGeometry = (() => {
  const p = [],
    uv = [],
    indices = [],
    rows = 10,
    cols = 4;
  // A curled, pointed blade with a raised central vein, not a scaled sphere.
  for (const face of [-1, 1])
    for (let row = 0; row <= rows; row++) {
      const t = row / rows,
        width = Math.pow(Math.sin(t * Math.PI), 0.8);
      for (let col = 0; col <= cols; col++) {
        const x = (col / cols) * 2 - 1;
        p.push(
          x * width,
          t * 2 - 1,
          0.3 * t * t + 0.2 * width * (1 - Math.abs(x)) + face * 0.016,
        );
        uv.push(col / cols, t);
      }
    }
  const count = (rows + 1) * (cols + 1);
  for (let face = 0; face < 2; face++)
    for (let row = 0; row < rows; row++)
      for (let col = 0; col < cols; col++) {
        const a = face * count + row * (cols + 1) + col,
          b = a + 1,
          c = a + cols + 1,
          d = c + 1;
        if (face) indices.push(a, b, c, b, d, c);
        else indices.push(a, c, b, b, c, d);
      }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(p, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
})();
export function foliage(parent, x, y, z, w, h, d, color) {
  const leaf = new THREE.Mesh(
    foliageGeometry,
    typeof color === "number" ? material(color) : color,
  );
  leaf.position.set(x, y, z);
  leaf.scale.set(w, h, d);
  leaf.castShadow = leaf.receiveShadow = true;
  parent.add(leaf);
  return leaf;
}
const blossomGeometry = (() => {
  const p = [],
    indices = [];
  for (let i = 0; i < 5; i++) {
    const a = (i * Math.PI * 2) / 5,
      k = p.length / 3;
    p.push(
      0,
      0,
      -0.01,
      Math.cos(a - 0.42) * 0.048,
      Math.sin(a - 0.42) * 0.048,
      0,
      Math.cos(a) * 0.079,
      Math.sin(a) * 0.079,
      -0.009,
      Math.cos(a + 0.42) * 0.048,
      Math.sin(a + 0.42) * 0.048,
      0,
    );
    indices.push(k, k + 2, k + 1, k, k + 3, k + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(p, 3));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
})();
function blossom(parent, x, y, z) {
  const mat = material(0xc8658e);
  mat.side = THREE.DoubleSide;
  const flower = new THREE.Mesh(blossomGeometry, mat);
  flower.position.set(x, y, z);
  flower.rotation.z = x * 13;
  flower.castShadow = flower.receiveShadow = true;
  parent.add(flower);
}

function mesh(parent, geometry, mat, x = 0, y = 0, z = 0) {
  const o = new THREE.Mesh(geometry, mat);
  o.position.set(x, y, z);
  o.castShadow = o.receiveShadow = true;
  o.userData.ownedGeometry = true;
  parent.add(o);
  return o;
}

function fittedSign(draw, parent, text, ...args) {
  // Keep the existing sign frame/material, but size lettering to its inner area.
  const board = draw(parent, "", ...args),
    texture = board.material.map,
    canvas = texture.image,
    ctx = canvas.getContext("2d"),
    available = canvas.width - 64;
  ctx.save();
  let size = 54;
  ctx.font = `bold ${size}px Arial`;
  while (size > 12 && ctx.measureText(text).width > available) {
    ctx.font = `bold ${--size}px Arial`;
  }
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, canvas.width / 2, canvas.height / 2 + 1, available);
  ctx.restore();
  texture.needsUpdate = true;
  return board;
}

export function buildingMaterial(group) {
  return coastalMaterial(
    {
      "house--29--8": "warm",
      "house-29--8": "blue",
      "house--14--27": "coral",
      "house-14--27": "ivory",
      "house--15-5": "ivory",
      "house-15-5": "blue",
      "house--29-17": "sage",
      "house-29-17": "warm",
      "house--13-27": "warm",
      "house-13-27": "ivory",
    }[group] || "plaster",
  );
}

export function coastalPalm(parent, x, z, height = 6) {
  const tree = joint(parent, x, 0, z);
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0.1, height * 0.38, 0.04),
    new THREE.Vector3(0.44, height * 0.75, -0.07),
    new THREE.Vector3(0.64, height, 0),
  ]);
  mesh(
    tree,
    new THREE.TubeGeometry(curve, 12, 0.2, 9, false),
    coastalMaterial("wood"),
  ).userData.keepSilhouette = true;
  for (let i = 1; i < 24; i++) {
    const p = curve.getPoint(i / 24);
    const collar = cylinder(
      tree,
      p.x,
      p.y,
      p.z,
      0.209,
      0.055,
      i % 2 ? 0x8e7049 : 0xa28a5e,
    );
    collar.rotation.z = -0.06;
  }
  for (let frond = 0; frond < 14; frond++) {
    const angle = frond * 2.399,
      length = frond > 9 ? 2.45 : 3.5;
    const up = frond > 9 ? 1.7 : 0.85;
    const positions = [],
      indices = [],
      uvs = [];
    const forward = new THREE.Vector3(Math.sin(angle), 0, Math.cos(angle));
    const across = new THREE.Vector3(Math.cos(angle), 0, -Math.sin(angle));
    const center = (t) =>
      new THREE.Vector3(
        0.64 + forward.x * t * length,
        height + Math.sin(t * Math.PI) * up - t * 0.98,
        forward.z * t * length,
      );
    const add = (a, b, c, d) => {
      const k = positions.length / 3;
      positions.push(
        ...a.toArray(),
        ...b.toArray(),
        ...c.toArray(),
        ...d.toArray(),
      );
      uvs.push(0, 0, 1, 0, 0.5, 1, 0.5, 0.4);
      indices.push(k, k + 1, k + 3, k + 1, k + 2, k + 3, k + 2, k, k + 3);
    };
    for (let i = 0; i < 11; i++) {
      const t = 0.1 + i * 0.077,
        width = Math.sin(t * Math.PI) * 0.85;
      for (const side of [-1, 1]) {
        const a = center(t),
          b = center(t + 0.07),
          tip = center(t + 0.14).addScaledVector(across, side * width),
          ridge = center(t + 0.07).addScaledVector(across, side * width * 0.46);
        tip.y -= 0.21 + t * 0.09;
        ridge.y += 0.06;
        add(a, b, tip, ridge);
      }
    }
    const tip = center(1.035),
      a = center(0.87).addScaledVector(across, -0.09),
      b = center(0.87).addScaledVector(across, 0.09);
    add(a, b, tip, center(0.94));
    const geo = new THREE.BufferGeometry();
    geo.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3),
    );
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    const mat = leaves[frond % 3];
    mat.side = THREE.DoubleSide;
    mesh(tree, geo, mat);
    wire(
      tree,
      [
        center(0).toArray(),
        center(0.32).toArray(),
        center(0.66).toArray(),
        center(0.98).toArray(),
      ],
      0x839b4c,
      0.02,
    );
  }
  for (let i = 0; i < 4; i++)
    ellipsoid(
      tree,
      0.64 + Math.sin(i * 2.4) * 0.22,
      height - 0.24,
      Math.cos(i * 2.4) * 0.22,
      0.16,
      0.22,
      0.16,
      0x9b8a4f,
    );
  return tree;
}

function gable(parent, x, y, z, width, depth, height, cool = false) {
  const mat = coastalMaterial(cool ? "slate" : "tiles");
  for (const s of [-1, 1]) {
    const half = depth / 2,
      slope = Math.hypot(half, height);
    const part = box(
      parent,
      x,
      y + height / 2,
      z + (s * depth) / 4,
      width,
      0.12,
      slope,
      mat,
    );
    part.rotation.x = s * Math.atan2(height, half);
    // Rounded ridge caps and eave ends cast a clean stylized roof edge.
    for (let i = 0; s === 1 && i < Math.ceil(width / 0.72); i++) {
      const cap = cylinder(
        parent,
        x - width / 2 + 0.35 + i * 0.72,
        y + height + 0.07,
        z,
        0.135,
        0.7,
        cool ? blue : clay,
      );
      cap.rotation.z = Math.PI / 2;
    }
    box(
      parent,
      x,
      y - 0.03,
      z + s * half,
      width + 0.15,
      0.16,
      0.16,
      cool ? blue : clay,
      0,
      0.025,
    );
  }
  for (const side of [-1, 1]) {
    const shape = new THREE.Shape();
    shape.moveTo(-depth / 2, 0);
    shape.lineTo(0, height);
    shape.lineTo(depth / 2, 0);
    shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: 0.16,
      bevelEnabled: false,
    });
    const end = mesh(
      parent,
      geo,
      coastalMaterial("ivory"),
      x + side * (width / 2 - 0.15),
      y,
      z,
    );
    end.rotation.y = Math.PI / 2;
    for (const s of [-1, 1]) {
      const beam = box(
        parent,
        x + (side * width) / 2,
        y + height / 2,
        z + (s * depth) / 4,
        0.19,
        0.18,
        Math.hypot(depth / 2, height) + 0.15,
        cool ? blue : clay,
        0,
        0.025,
      );
      beam.rotation.x = s * Math.atan2(height, depth / 2);
    }
  }
}

function dome(parent, x, y, z, radius = 1.8) {
  cylinder(parent, x, y + 0.23, z, radius * 1.02, 0.46, ivory);
  cylinder(
    parent,
    x,
    y + 0.58,
    z,
    radius * 0.87,
    0.56,
    coastalMaterial("ivory"),
  );
  mesh(
    parent,
    new THREE.SphereGeometry(radius, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2),
    blue,
    x,
    y + 0.86,
    z,
  );
  ring(parent, x, y + 0.87, z, radius, 0.06, 0x76a8bc, "y");
  for (let i = 0; i < 12; i++) {
    const a = (i * Math.PI) / 6;
    const points = [];
    for (let j = 0; j < 9; j++) {
      const t = (j * Math.PI) / 16;
      points.push([
        x + Math.sin(a) * Math.cos(t) * (radius + 0.008),
        y + 0.86 + Math.sin(t) * radius,
        z + Math.cos(a) * Math.cos(t) * (radius + 0.008),
      ]);
    }
    wire(parent, points, 0x4c8fa7, 0.016);
  }
  cylinder(parent, x, y + radius + 1, z, 0.07, 0.38, material(0xae8c45, 0.65));
  ellipsoid(parent, x, y + radius + 1.22, z, 0.12, 0.15, 0.12, 0xc69e51);
}

function reliefArch(parent, arch, x, y, z, width, height, accent) {
  // Blind arcades sit on authoritative solid walls, never across playable openings.
  const shape = new THREE.Shape(),
    r = width / 2;
  shape.moveTo(-r, 0);
  shape.lineTo(r, 0);
  shape.lineTo(r, height);
  shape.absarc(0, height, r, 0, Math.PI);
  shape.closePath();
  mesh(
    parent,
    new THREE.ExtrudeGeometry(shape, {
      depth: 0.035,
      bevelEnabled: false,
      curveSegments: 12,
    }),
    material(accent),
    x,
    y,
    z - 0.03,
  );
  // Closed arched timber storefronts, with recessed planks and real hardware.
  for (let i = 0; i < 11; i++) {
    const xx = -r + ((i + 0.5) * width) / 11,
      top = height + Math.sqrt(Math.max(0, r * r - xx * xx));
    box(
      parent,
      x + xx,
      top / 2,
      z - 0.047,
      width / 11 - 0.018,
      top - 0.04,
      0.022,
      wood,
    );
  }
  box(
    parent,
    x,
    0.35,
    z - 0.075,
    width - 0.13,
    0.075,
    0.035,
    0x68533b,
    0,
    0.012,
  );
  box(
    parent,
    x,
    1.28,
    z - 0.075,
    width - 0.13,
    0.075,
    0.035,
    0x68533b,
    0,
    0.012,
  );
  box(parent, x, 1.05, z - 0.09, 0.028, 2.1, 0.035, 0x443d30);
  for (const side of [-1, 1]) {
    ring(parent, x + side * 0.15, 0.96, z - 0.1, 0.069, 0.015, 0x354c4d);
    for (const yy of [0.36, 1.29])
      box(
        parent,
        x + side * (r - 0.2),
        yy,
        z - 0.1,
        0.17,
        0.045,
        0.033,
        iron,
        0,
        0.01,
      );
  }
  arch(parent, x, height, z - 0.035, width, height, 0.09, 0xe3d2ac);
  for (const s of [-1, 1]) {
    box(
      parent,
      x + s * (width / 2 + 0.1),
      height / 2,
      z - 0.1,
      0.24,
      height,
      0.18,
      ivory,
      0,
      0.025,
    );
    box(
      parent,
      x + s * (width / 2 + 0.1),
      0.19,
      z - 0.12,
      0.35,
      0.35,
      0.24,
      limestone,
      0,
      0.025,
    );
    box(
      parent,
      x + s * (width / 2 + 0.1),
      height,
      z - 0.12,
      0.34,
      0.15,
      0.25,
      ivory,
      0,
      0.025,
    );
  }
}

function fabricAwning(parent, x, y, z, width, projection, tint) {
  if (!clothMaterials.has(tint)) {
    const mat = coastalMaterial("fabric").clone();
    mat.color.setHex(tint);
    mat.side = THREE.DoubleSide;
    clothMaterials.set(tint, mat);
  }
  const cloth = clothMaterials.get(tint);
  const positions = [],
    uvs = [],
    indices = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12,
      yy = y - 0.48 * t + 0.1 * Math.sin(t * Math.PI);
    positions.push(
      x - width / 2,
      yy,
      z - t * projection,
      x + width / 2,
      yy,
      z - t * projection,
    );
    uvs.push(0, t, width / 2, t);
    if (i < 12)
      indices.push(
        i * 2,
        i * 2 + 2,
        i * 2 + 1,
        i * 2 + 1,
        i * 2 + 2,
        i * 2 + 3,
      );
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  mesh(parent, geo, cloth);
  for (let i = 0; i < Math.ceil(width / 0.36); i++) {
    const fringe = box(
      parent,
      x - width / 2 + 0.18 + i * 0.36,
      y - 0.57,
      z - projection,
      0.35,
      0.23,
      0.018,
      i % 2 ? ivory : tint,
      0,
      0.03,
    );
  }
  for (const s of [-1, 1])
    wire(
      parent,
      [
        [x + s * (width / 2 - 0.1), y - 0.6, z],
        [x + s * (width / 2 - 0.1), y - 0.5, z - projection],
      ],
      0x586755,
      0.025,
    );
}

function vine(parent, x, y, z, size = 1, flowers = false) {
  wire(
    parent,
    [
      [x, y, z],
      [x + 0.1, y - size * 0.6, z - 0.04],
      [x - 0.08, y - size, z - 0.08],
    ],
    0x657b43,
    0.025,
  );
  for (let i = 0; i < 13; i++) {
    const xx = x + Math.sin(i * 2.4) * size * 0.18,
      yy = y - (i / 13) * size;
    const leaf = foliage(
      parent,
      xx,
      yy,
      z - 0.04 - (i % 3) * 0.018,
      0.115,
      0.06,
      0.033,
      leaves[i % 3],
    );
    leaf.rotation.z = Math.sin(i) * 0.6;
    if (flowers && i % 4 === 0) blossom(parent, xx, yy, z - 0.09);
  }
}

function balcony(parent, x, y, z, accent) {
  box(parent, x, y, z - 0.22, 1.75, 0.15, 0.55, limestone, 0, 0.035);
  box(parent, x, y + 0.53, z - 0.47, 1.75, 0.065, 0.055, iron, 0, 0.012);
  box(parent, x, y + 0.13, z - 0.47, 1.75, 0.04, 0.045, iron);
  for (let i = 0; i < 9; i++) {
    box(
      parent,
      x - 0.78 + i * 0.195,
      y + 0.32,
      z - 0.47,
      0.025,
      0.44,
      0.025,
      iron,
    );
    if (i % 2 === 0)
      ring(
        parent,
        x - 0.78 + i * 0.195,
        y + 0.35,
        z - 0.47,
        0.1,
        0.012,
        0x32494c,
      );
  }
  for (const s of [-1, 1]) {
    const bracket = box(
      parent,
      x + s * 0.55,
      y - 0.16,
      z - 0.18,
      0.08,
      0.35,
      0.1,
      iron,
    );
    bracket.rotation.x = -0.6;
  }
  box(parent, x + 0.3, y + 0.17, z - 0.27, 0.9, 0.21, 0.23, accent, 0, 0.035);
  for (let i = 0; i < 4; i++)
    vine(
      parent,
      x - 0.02 + i * 0.2,
      y + 0.31,
      z - 0.4,
      0.35 + (i % 2) * 0.28,
      true,
    );
}

export function decorateBuilding(parent, data, helpers) {
  const { x, z, w, d, height, accent } = data;
  const { arch, lamp } = helpers;
  const sign = (...args) => fittedSign(helpers.sign, ...args);
  const accessible = Math.abs(x) === 29 && z === -8;
  const cool = x > 0;
  // Cornices, quoins, exposed foundation courses and service details create scale.
  for (const s of [-1, 1]) {
    const face = joint(parent, x, 0, z + s * (d / 2 + 0.25));
    if (s === 1) face.rotation.y = Math.PI;
    box(face, 0, 0.17, -0.045, w, 0.3, 0.09, limestone);
    box(face, 0, height - 0.04, -0.09, w + 0.15, 0.13, 0.25, ivory, 0, 0.025);
    box(face, 0, height - 0.24, -0.07, w + 0.02, 0.1, 0.12, darkStone);
    for (const side of [-1, 1]) {
      for (let i = 0; i < Math.floor(height / 0.48); i++)
        box(
          face,
          side * (w / 2 - 0.15),
          0.38 + i * 0.46,
          -0.1,
          i % 2 ? 0.37 : 0.56,
          0.4,
          0.18,
          i % 2 ? ivory : limestone,
          0,
          0.03,
        );
      cylinder(
        face,
        side * (w / 2 - 0.75),
        height / 2,
        -0.11,
        0.042,
        height - 0.2,
        iron,
      );
      for (const yy of [0.65, 2.4, height - 0.6])
        ring(
          face,
          side * (w / 2 - 0.75),
          yy,
          -0.11,
          0.049,
          0.014,
          0x405457,
          "y",
        );
    }
    for (let i = 0; i < Math.floor(w / 2.5); i++) {
      const xx = -w / 2 + 1.3 + i * 2.5;
      // Sills, shutters and glazing are in world.js; add alternating balcony detail.
      if ((i + Math.floor(z)) % 2 === 0)
        balcony(face, xx, height * 0.6 - 0.71, -0.03, accent);
      else {
        box(
          face,
          xx,
          height * 0.6 + 0.69,
          -0.06,
          1.3,
          0.12,
          0.22,
          ivory,
          0,
          0.025,
        );
        for (const side of [-1, 1])
          box(
            face,
            xx + side * 0.45,
            height * 0.6 - 0.7,
            -0.035,
            0.1,
            0.25,
            0.2,
            limestone,
            0,
            0.02,
          );
      }
    }
    if (accessible) {
      // Blind arcades are wholly backed by the existing long-side collision wall.
      if (cool) {
        for (const xx of [-3.75, 0, 3.75]) {
          box(face, xx, 1.02, -0.16, 2.16, 1.94, 0.1, 0x437589, 0, 0.04);
          for (const side of [-1, 1])
            box(
              face,
              xx + side * 1.15,
              1.14,
              -0.22,
              0.18,
              2.2,
              0.23,
              ivory,
              0,
              0.025,
            );
          box(face, xx, 2.22, -0.2, 2.48, 0.17, 0.23, ivory, 0, 0.025);
          for (let row = 0; row < 7; row++)
            box(face, xx, 0.32 + row * 0.25, -0.22, 2.02, 0.04, 0.05, 0x2e5a71);
          box(face, xx, 0.84, -0.255, 0.48, 0.075, 0.065, iron, 0, 0.016);
          for (const side of [-1, 1])
            ellipsoid(
              face,
              xx + side * 0.17,
              0.84,
              -0.3,
              0.022,
              0.022,
              0.012,
              0xc3b58d,
            );
        }
      } else
        for (const xx of [-3.75, 0, 3.75])
          reliefArch(face, arch, xx, 0, -0.11, 2.18, 1.43, 0xb8855d);
      sign(
        face,
        cool ? "DOGANA  /  MARINA" : "PIAZZA  DEL  SOLE",
        0,
        3.68,
        -0.27,
        cool ? 0x275f7b : 0x9f543f,
        1.1,
      ).rotation.y = Math.PI;
      for (const xx of [-4.7, 4.7]) lamp(face, xx, 3, -0.04);
    } else if (z > 10) {
      const tint =
        z > 23 ? (cool ? 0x497b91 : 0xc1854f) : cool ? 0xab6350 : 0x4d8582;
      fabricAwning(face, 0, 2.8, -0.08, w * 0.48, 1.15, tint);
      sign(
        face,
        z > 23
          ? cool
            ? "CASA MARINA"
            : "PANE & OLIO"
          : cool
            ? "PESCHERIA"
            : "MERCATO",
        0,
        3.45,
        -0.11,
        cool ? 0x376b7e : 0x776644,
        0.7,
      ).rotation.y = Math.PI;
    }
    if (s === -1 && z !== -8)
      for (const side of [-1, 1])
        for (let i = 0; i < 4; i++)
          vine(
            face,
            side * (w / 2 - 0.28) - i * side * 0.17,
            height - 0.1,
            -0.14,
            0.65 + i * 0.18,
            true,
          );
  }
  // These roofs have no stairs or reachable roof-to-roof links. The two rooftop
  // combat terraces remain flat and clear; their silhouette is dressed at edges.
  if (!accessible) {
    gable(
      parent,
      x,
      height + 0.3,
      z,
      w + 0.55,
      d + 0.6,
      z < -20 ? 2.0 : 1.45,
      cool && z === 5,
    );
    if (cool && z === -27) dome(parent, x + 1.7, height + 1.8, z, 1.65);
    else {
      const chimneyX = x + w * 0.28;
      box(
        parent,
        chimneyX,
        height + 1.58,
        z + 0.4,
        0.66,
        1.4,
        0.66,
        limestone,
        0,
        0.035,
      );
      box(
        parent,
        chimneyX,
        height + 2.32,
        z + 0.4,
        0.84,
        0.15,
        0.84,
        ivory,
        0,
        0.025,
      );
      box(parent, chimneyX, height + 2.42, z + 0.4, 0.55, 0.04, 0.55, iron);
    }
  } else {
    // The original roof coping footprint is retained; lattice is a wall relief.
    for (const s of [-1, 1]) {
      const parapet = joint(parent, x, height + 0.3, z + s * (d / 2 + 0.1));
      for (let i = 0; i < 7; i++)
        box(
          parapet,
          -w / 2 + 0.5 + i * 1.85,
          -0.03,
          0,
          0.52,
          0.2,
          0.19,
          accent,
          0,
          0.025,
        );
    }
  }
}

function paintedCircle(parent, x, z, radius, cool = false) {
  const geo = new THREE.RingGeometry(radius - 0.09, radius, 80);
  const m = mesh(
    parent,
    geo,
    material(cool ? 0x72909a : 0xb9875b),
    x,
    0.014,
    z,
  );
  m.rotation.x = -Math.PI / 2;
  m.castShadow = false;
  for (let i = 0; i < 16; i++) {
    const a = (i * Math.PI) / 8;
    const inlay = box(
      parent,
      x + Math.sin(a) * (radius + 0.25),
      0.016,
      z + Math.cos(a) * (radius + 0.25),
      0.16,
      0.008,
      0.36,
      cool ? 0x7394a0 : 0xb58f65,
    );
    inlay.rotation.y = a;
  }
}

export function tacticalLandmark(parent, b) {
  const cool = b.x > 0;
  box(parent, b.x, b.y, b.z, b.w, b.h, b.d, limestone, 0, 0.04);
  const trim = cool ? blue : clay;
  for (const s of [-1, 1]) {
    box(
      parent,
      b.x,
      b.h - 0.09,
      b.z + s * (b.d / 2 + 0.018),
      b.w,
      0.16,
      0.06,
      trim,
      0,
      0.012,
    );
    box(
      parent,
      b.x + s * (b.w / 2 + 0.018),
      b.h - 0.09,
      b.z,
      0.06,
      0.16,
      b.d,
      trim,
      0,
      0.012,
    );
    box(
      parent,
      b.x,
      b.h * 0.38,
      b.z + s * (b.d / 2 + 0.01),
      b.w - 0.23,
      0.055,
      0.027,
      darkStone,
      0,
      0.01,
    );
  }
  if (b.type === "courtyardFountain") {
    const wet = new THREE.MeshStandardMaterial({
      color: 0x329b95,
      roughness: 0.17,
      metalness: 0.32,
    });
    const pool = mesh(
      parent,
      new THREE.PlaneGeometry(1.85, 1.85),
      wet,
      b.x,
      b.h + 0.012,
      b.z,
    );
    pool.rotation.x = -Math.PI / 2;
    pool.userData.ownedMaterial = true;
    cylinder(parent, b.x, 1.04, b.z, 0.23, 0.16, limestone);
    const bowl = mesh(
      parent,
      new THREE.LatheGeometry(
        [
          new THREE.Vector2(0.08, 0),
          new THREE.Vector2(0.14, 0.17),
          new THREE.Vector2(0.42, 0.22),
          new THREE.Vector2(0.44, 0.26),
          new THREE.Vector2(0.38, 0.24),
          new THREE.Vector2(0.11, 0.15),
        ],
        24,
      ),
      limestone,
      b.x,
      1.06,
      b.z,
    );
    for (const a of [0, Math.PI / 2, Math.PI, Math.PI * 1.5])
      ring(
        parent,
        b.x + Math.sin(a) * 0.72,
        0.53,
        b.z + Math.cos(a) * 1.12,
        0.12,
        0.028,
        0xb5a06d,
      ).rotation.y = a;
  } else if (b.type === "harborMonument") {
    // A blue ceramic compass relief is mounted on solid cover, not a phantom obstacle.
    const face = joint(parent, b.x, 0.7, b.z - b.d / 2 - 0.05);
    ring(face, 0, 0, 0, 0.42, 0.025, 0xcbb988);
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      const shape = new THREE.Shape();
      shape.moveTo(0, 0);
      shape.lineTo(-0.045, 0.12);
      shape.lineTo(0, 0.37);
      shape.lineTo(0.045, 0.12);
      shape.closePath();
      const ray = mesh(
        face,
        new THREE.ShapeGeometry(shape),
        i % 2 ? ivory : blue,
      );
      ray.rotation.z = a;
      ray.rotation.y = Math.PI;
    }
    box(parent, b.x, 1.34, b.z, 2.32, 0.08, 1.72, ivory, 0, 0.025);
  }
}
export function decorateCoast(parent, helpers) {
  const { arch, lamp, planter, boat } = helpers;
  const sign = (...args) => fittedSign(helpers.sign, ...args);
  // Cohesive, readable landmarks on the existing site facades. They are flat
  // wall decorations so collision and bullets still meet the original walls.
  for (const [x, color, title] of [
    [-29, 0xad563f, "A / COURTYARD"],
    [29, 0x2e668b, "B / HARBOR"],
  ]) {
    const front = joint(parent, x, 2.8, -13.27);
    front.rotation.y = Math.PI;
    // The existing large building sign remains the single label; banners sit
    // between windows without adding a second sign behind shutters/balconies.
    for (const s of [-1, 1]) {
      const flag = joint(front, s * 3.8, 0, 0);
      box(flag, 0, 0.12, 0, 0.64, 1.58, 0.022, color, 0, 0.008);
      box(flag, 0, 0.94, 0.02, 0.82, 0.055, 0.08, iron, 0, 0.01);
      for (const xx of [-0.24, 0.24])
        box(flag, xx, 0.12, 0.018, 0.024, 1.45, 0.01, ivory);
      ring(flag, 0, 0.13, 0.025, 0.18, 0.026, 0xdcc99d);
    }
  }
  // Recessed ground treatments do not add obstacles or change authoritative cover.
  for (const x of [-24, 25])
    paintedCircle(parent, x, x < 0 ? -18 : -19, 5.9, x > 0);
  for (const s of [-1, 1]) {
    box(parent, s * 4.3, 0.012, 0, 1.8, 0.015, 55.5, limestone);
    for (const x of [s * 3.4, s * 5.2])
      box(parent, x, 0.027, 0, 0.08, 0.018, 55.5, darkStone);
    for (let row = 0; row < 3; row++)
      for (let i = 0; i < 38; i++) {
        // Quay blocks are mounted on the solid bank, never narrowing the canal.
        box(
          parent,
          s * 2.992,
          -0.19 - row * 0.35,
          -27.1 + i * 1.45,
          0.035,
          0.32,
          1.4,
          (i + row) % 3 ? limestone : darkStone,
          0,
          0.018,
        );
      }
    for (const z of [-24, -14, 4, 13, 24]) {
      ring(parent, s * 2.94, -0.33, z, 0.17, 0.035, 0x55665f).rotation.y =
        Math.PI / 2;
    }
    // Base course, pilasters and inset cap panels dress existing perimeter walls.
    for (let z = -34; z < 35; z += 3.5) {
      box(parent, s * 43.04, 1.1, z, 0.12, 1.7, 0.36, limestone, 0, 0.028);
      box(parent, s * 42.99, 1.88, z, 0.18, 0.14, 0.55, ivory, 0, 0.025);
    }
    for (let x = -41; x < 43; x += 3.5)
      box(parent, x, 1.1, s * 36.22, 0.36, 1.7, 0.1, limestone, 0, 0.025);
  }
  // A clock mosaic on the existing sniper tower makes MID immediately legible.
  const clockCanvas = document.createElement("canvas");
  clockCanvas.width = clockCanvas.height = 256;
  const ctx = clockCanvas.getContext("2d");
  ctx.fillStyle = "#eadbb9";
  ctx.beginPath();
  ctx.arc(128, 128, 119, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#476674";
  ctx.lineWidth = 8;
  ctx.stroke();
  for (let i = 0; i < 12; i++) {
    const a = (i * Math.PI) / 6;
    ctx.beginPath();
    ctx.moveTo(128 + Math.sin(a) * 96, 128 - Math.cos(a) * 96);
    ctx.lineTo(128 + Math.sin(a) * 110, 128 - Math.cos(a) * 110);
    ctx.lineWidth = 5;
    ctx.stroke();
  }
  ctx.lineWidth = 8;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(80, 95);
  ctx.lineTo(128, 128);
  ctx.lineTo(170, 73);
  ctx.stroke();
  const clockMap = new THREE.CanvasTexture(clockCanvas);
  clockMap.colorSpace = THREE.SRGBColorSpace;
  const clock = mesh(
    parent,
    new THREE.CircleGeometry(1.0, 48),
    new THREE.MeshStandardMaterial({ map: clockMap, roughness: 0.7 }),
    0,
    3.25,
    -29.47,
  );
  clock.userData.ownedMaterial = true;
  ring(parent, 0, 3.25, -29.43, 1.04, 0.07, 0xc7ad73);
  sign(parent, "PORTO  DEL  SOLE", 0, 1.66, -29.46, 0x326779, 0.94);
  for (const s of [-1, 1]) {
    box(parent, s * 2.3, 2.5, -29.44, 0.36, 5, 0.18, limestone, 0, 0.03);
    lamp(parent, s * 1.75, 2.55, -29.42);
  }
  // Canal-side low relief arches and medallions below the existing tower deck.
  arch(parent, 0, 3.7, -34.59, 3.4, 3.7, 0.14, 0xd8bd8d);
  box(parent, 0, 4.72, -29.42, 5.3, 0.18, 0.28, ivory, 0, 0.04);
  // Open rear-edge belfry leaves the original sniper deck and stair landing clear.
  // Slender uprights are ornamental, like existing rope railings, not new cover.
  for (const x of [-1.32, 1.32]) {
    box(parent, x, 6.55, -34.91, 0.22, 2.5, 0.23, ivory, 0, 0.035);
    box(parent, x, 5.47, -34.91, 0.33, 0.25, 0.33, limestone, 0, 0.035);
    box(parent, x, 7.7, -34.91, 0.35, 0.2, 0.35, ivory, 0, 0.035);
  }
  arch(parent, 0, 7.35, -34.91, 2.44, 0.2, 0.22, 0xe1d1a8);
  gable(parent, 0, 8.1, -34.91, 3.45, 1.18, 0.7);
  const bellProfile = [
    [0, 0.44],
    [0.12, 0.44],
    [0.14, 0.32],
    [0.17, 0.05],
    [0.26, -0.23],
    [0.45, -0.37],
    [0.46, -0.44],
    [0.33, -0.44],
    [0.25, -0.28],
    [0.14, 0.04],
    [0.09, 0.3],
    [0, 0.3],
  ];
  mesh(
    parent,
    new THREE.LatheGeometry(
      bellProfile.map((p) => new THREE.Vector2(...p)),
      20,
    ),
    material(0xb69a4b, 0.65),
    0,
    6.89,
    -34.91,
  );
  box(parent, 0, 7.61, -34.91, 2.6, 0.15, 0.2, wood, 0, 0.025);
  cylinder(parent, 0, 7.36, -34.91, 0.045, 0.6, iron);
  ellipsoid(parent, 0, 6.48, -34.91, 0.07, 0.14, 0.07, 0x5b634a);
  // Cables cross high above the firefight, leaving the existing tower platform open.
  for (const s of [-1, 1]) {
    wire(
      parent,
      [
        [s * 14, 6.8, -23.5],
        [s * 11.5, 5.4, -12],
        [s * 10, 5.8, 1],
      ],
      0x4d5750,
      0.019,
    );
    cylinder(parent, s * 14, 6.04, -23.5, 0.043, 1.65, iron);
    cylinder(parent, s * 10, 5.05, 1, 0.043, 1.55, iron);
    wire(
      parent,
      [
        [s * 18, 5.3, 9],
        [s * 15, 4.2, 16],
        [s * 14, 5.2, 23.5],
      ],
      0x4d5750,
      0.021,
    );
    for (let i = 0; i < 7; i++) {
      const t = i / 6,
        z = 9 + t * 14.5,
        x = s * (18 - t * 4),
        y = 5.3 - Math.sin(t * Math.PI) * 0.94;
      cylinder(parent, x, y - 0.04, z, 0.038, 0.1, iron);
      ellipsoid(parent, x, y - 0.12, z, 0.065, 0.085, 0.065, 0xe8c783);
    }
  }
  // Boats and shoreline furniture are outside playable boundary walls.
  for (const [x, z, a, color] of [
    [46, 17, -0.3, 0x456f8a],
    [-47, 13, 0.4, 0xc17d53],
    [57, -27, 0.6, 0x477d7d],
  ])
    boat(parent, x, -0.88, z, a, color);
  for (const [x, z, rotation] of [
    [-46, 25, -0.4],
    [-46, 17, 0.2],
    [46, 29, 0],
  ]) {
    const pier = joint(parent, x, -0.04, z);
    pier.rotation.y = rotation;
    for (let i = 0; i < 14; i++)
      box(pier, 0, -0.12, -2.5 + i * 0.37, 2.8, 0.18, 0.35, wood, 0, 0.014);
    for (const xx of [-1.2, 1.2])
      for (const zz of [-2.3, 2.3]) {
        cylinder(pier, xx, -0.36, zz, 0.13, 2.7, wood);
        ring(pier, xx, 0.45, zz, 0.14, 0.026, 0xbcab7a, "y");
      }
  }
  for (const [x, z, rotation] of [
    [-45.4, 24, 0.4],
    [44.6, -10, -Math.PI / 2],
    [-44.7, -8, Math.PI / 2],
  ]) {
    const bench = joint(parent, x, 0.06, z);
    bench.rotation.y = rotation;
    for (let i = 0; i < 4; i++)
      box(bench, 0, 0.52, -0.28 + i * 0.18, 1.9, 0.1, 0.15, wood, 0, 0.025);
    for (let i = 0; i < 3; i++)
      box(bench, 0, 0.89 + i * 0.16, 0.4, 1.9, 0.13, 0.08, wood, 0, 0.024);
    for (const s of [-1, 1]) {
      wire(
        bench,
        [
          [s * 0.72, 0.05, -0.26],
          [s * 0.72, 0.49, -0.2],
          [s * 0.72, 0.52, 0.31],
          [s * 0.72, 1.2, 0.44],
        ],
        0x405851,
        0.055,
      );
      cylinder(bench, s * 0.72, 0.25, 0.3, 0.045, 0.5, iron);
    }
  }
  // Sandy coves and rock stratum define an island rather than a rectangular slab.
  const sand = coastalMaterial("sand"),
    rock = coastalMaterial("rock");
  for (const [x, z, sx, sz] of [
    [-46, 24, 6, 11],
    [-47, 5, 4, 6],
    [45, -26, 4, 7],
  ]) {
    const beach = mesh(
      parent,
      new THREE.SphereGeometry(1, 24, 10),
      sand,
      x,
      -1.06,
      z,
    );
    beach.scale.set(sx, 0.7, sz);
  }
  for (let i = 0; i < 26; i++) {
    const a = (i * Math.PI * 2) / 26,
      x = Math.sin(a) * 46.5,
      z = Math.cos(a) * 40;
    for (let layer = 0; layer < 3; layer++) {
      const geo = new THREE.DodecahedronGeometry(1, 0);
      const outcrop = mesh(parent, geo, rock, x, -1.15 - layer * 0.7, z);
      outcrop.scale.set(
        2.3 + (i % 3) * 0.6 + layer * 0.3,
        0.8,
        2 + (i % 4) * 0.3,
      );
      outcrop.rotation.y = i * 0.7;
    }
  }
  // Distant sculpted islets carry layered silhouettes beyond the local parapet.
  for (const [x, z, scale] of [
    [-89, -56, 1.5],
    [85, -71, 1.7],
    [-78, 67, 1.1],
    [105, 42, 0.9],
  ]) {
    const isle = joint(parent, x, -2.0, z);
    const foundation = mesh(
      isle,
      new THREE.DodecahedronGeometry(1, 1),
      rock,
      0,
      0.1 * scale,
      0,
    );
    foundation.scale.set(5.2 * scale, 3.1 * scale, 4.6 * scale);
    for (let i = 0; i < 6; i++) {
      const ridge = mesh(
        isle,
        new THREE.DodecahedronGeometry(1, 1),
        rock,
        Math.sin(i * 2.4) * 5 * scale,
        (i % 3) * 1.1 * scale,
        Math.cos(i * 2.4) * 4 * scale,
      );
      ridge.scale.set(
        (3 + (i % 2)) * scale,
        (2.6 + (i % 3)) * scale,
        (2.9 + (i % 2)) * scale,
      );
      ridge.rotation.set(0.1, i * 0.5, 0.15);
    }
    const top = mesh(
      isle,
      new THREE.SphereGeometry(1, 14, 8),
      material(0x7a8a4d),
      0,
      3 * scale,
      0,
    );
    top.scale.set(4.8 * scale, 0.55 * scale, 3.8 * scale);
    coastalPalm(isle, 1.5 * scale, 0, 4.7 * scale).position.y = 3 * scale;
  }
  // Compact native shrubs cling to cliff tops, not movement lanes.
  for (let i = 0; i < 25; i++) {
    const a = i * 2.399,
      x = Math.sin(a) * 46,
      z = Math.cos(a) * 39;
    for (let j = 0; j < 4; j++)
      foliage(
        parent,
        x + Math.sin(j * 2.4) * 0.45,
        -0.02 + (j % 2) * 0.22,
        z + Math.cos(j * 2.4) * 0.5,
        0.62,
        0.38,
        0.54,
        leaves[(i + j) % 3],
      );
  }
  // Navigation tiles on solid perimeter walls. No floating signs in firing lanes.
  const west = joint(parent, -42.89, 0, 0);
  west.rotation.y = Math.PI / 2;
  sign(west, "SPIAGGIA  ←", -24, 1.48, 0, 0x367780, 0.75);
  const east = joint(parent, 42.89, 0, 0);
  east.rotation.y = -Math.PI / 2;
  sign(east, "MARINA  →", 25, 1.48, 0, 0x326b83, 0.75);
}
