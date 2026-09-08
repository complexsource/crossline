import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { surface } from "./materials.js";
const materials = new Map(),
  geometries = new Map();
export function material(color, metalness = 0) {
  const key = `${color}-${metalness}`;
  if (!materials.has(key))
    materials.set(
      key,
      new THREE.MeshStandardMaterial({
        color,
        roughness: 0.68 - metalness * 0.3,
        metalness,
      }),
    );
  return materials.get(key);
}
const mat = (v) => (typeof v === "number" ? material(v) : v);
function geo(key, make) {
  if (!geometries.has(key)) geometries.set(key, make());
  return geometries.get(key);
}
export function box(parent, x, y, z, w, h, d, color, metalness = 0, r = 0) {
  const g = r
    ? geo(
        `r${w}/${h}/${d}/${r}`,
        () =>
          new RoundedBoxGeometry(w, h, d, 1, Math.min(r, w / 3, h / 3, d / 3)),
      )
    : geo("box", () => new THREE.BoxGeometry());
  const m = new THREE.Mesh(
    g,
    typeof color === "number" ? material(color, metalness) : color,
  );
  m.position.set(x, y, z);
  if (!r) m.scale.set(w, h, d);
  m.castShadow = m.receiveShadow = true;
  parent.add(m);
  return m;
}
export function cylinder(
  parent,
  x,
  y,
  z,
  r,
  length,
  color,
  alongZ = false,
  top = r,
) {
  const m = new THREE.Mesh(
    geo(
      `c${r}/${length}/${top}`,
      () => new THREE.CylinderGeometry(top, r, length, 16),
    ),
    mat(color),
  );
  m.position.set(x, y, z);
  if (alongZ) m.rotation.x = Math.PI / 2;
  m.castShadow = m.receiveShadow = true;
  parent.add(m);
  return m;
}
export function ellipsoid(parent, x, y, z, w, h, d, color) {
  const m = new THREE.Mesh(
    geo("sphere", () => new THREE.SphereGeometry(1, 20, 14)),
    mat(color),
  );
  m.position.set(x, y, z);
  m.scale.set(w, h, d);
  m.castShadow = m.receiveShadow = true;
  parent.add(m);
  return m;
}
// Contoured garment rings avoid disconnected spherical limbs. Subtle radial folds
// provide a continuous cloth silhouette at the elbow, thigh and ankle.
export function garment(parent, x, y, z, w, h, d, color) {
  const profile = [
    [0, -1],
    [0.58, -0.98],
    [0.79, -0.86],
    [0.85, -0.62],
    [0.92, -0.35],
    [1, 0],
    [0.96, 0.32],
    [0.85, 0.68],
    [0.65, 0.9],
    [0, 1],
  ];
  const key = "cloth";
  const geometry = geo(key, () => {
    const g = new THREE.LatheGeometry(
      profile.map(([r, y]) => new THREE.Vector2(r, y)),
      20,
    );
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const v = new THREE.Vector3().fromBufferAttribute(p, i),
        fold = 1 + Math.sin(v.y * 24 + Math.atan2(v.z, v.x) * 3) * 0.027;
      v.x *= fold;
      v.z *= fold;
      p.setXYZ(i, v.x, v.y, v.z);
    }
    g.computeVertexNormals();
    return g;
  });
  const m = new THREE.Mesh(geometry, mat(color));
  m.userData.highGeometry = geometry;
  m.userData.lowGeometry = geo(
    "cloth-low",
    () =>
      new THREE.LatheGeometry(
        profile.map(([r, y]) => new THREE.Vector2(r, y)),
        8,
      ),
  );
  m.position.set(x, y, z);
  m.scale.set(w, h, d);
  m.castShadow = m.receiveShadow = true;
  parent.add(m);
  return m;
}
export function joint(parent, x, y, z) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  parent.add(g);
  return g;
}
// Merge each rigid joint independently, preserving articulation with fewer draws.
export function bake(group) {
  for (const child of [...group.children]) if (child.isGroup) bake(child);
  const batches = new Map();
  for (const m of [...group.children])
    if (m.isMesh && !m.userData.dynamic && !m.userData.lowGeometry) {
      m.updateMatrix();
      const a = batches.get(m.material) || [];
      a.push(m);
      batches.set(m.material, a);
    }
  for (const [material, meshes] of batches) {
    if (meshes.length < 2) continue;
    const parts = meshes.map((m) =>
      (m.geometry.index
        ? m.geometry.toNonIndexed()
        : m.geometry.clone()
      ).applyMatrix4(m.matrix),
    );
    const geometry = mergeGeometries(parts);
    parts.forEach((g) => g.dispose());
    if (!geometry) continue;
    const merged = new THREE.Mesh(geometry, material);
    merged.castShadow = merged.receiveShadow = true;
    merged.userData.ownedGeometry = true;
    group.add(merged);
    meshes.forEach((m) => {
      group.remove(m);
      if (m.userData.ownedGeometry) m.geometry.dispose();
    });
  }
}
export function disposeModel(group) {
  group.traverse((o) => {
    if (o.userData.ownedGeometry) o.geometry?.dispose();
    if (o.userData.ownedMaterial) o.material?.dispose();
  });
}
export function silhouette(parent, points, thickness, material) {
  const shape = new THREE.Shape();
  points.forEach(([z, y], i) => (i ? shape.lineTo(z, y) : shape.moveTo(z, y)));
  shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: true,
    bevelSegments: 2,
    steps: 1,
    bevelSize: 0.005,
    bevelThickness: 0.003,
  });
  g.rotateY(-Math.PI / 2);
  g.translate(thickness / 2, 0, 0);
  const m = new THREE.Mesh(g, material);
  m.castShadow = true;
  m.userData.ownedGeometry = true;
  parent.add(m);
  return m;
}
export function hand(parent, x, y, z) {
  const g = joint(parent, x, y, z),
    glove = surface("leather", 0x68715e);
  ellipsoid(g, 0, 0, 0, 0.049, 0.063, 0.044, glove);
  for (let i = 0; i < 4; i++) {
    box(
      g,
      -0.03 + i * 0.02,
      -0.032,
      -0.032,
      0.017,
      0.075,
      0.029,
      glove,
      0,
      0.009,
    ).rotation.x = -0.3;
    box(
      g,
      -0.03 + i * 0.02,
      0.017,
      -0.038,
      0.016,
      0.019,
      0.019,
      surface("rubber", 0x707866),
      0,
      0.006,
    );
  }
  ellipsoid(g, 0.047, 0, -0.014, 0.019, 0.039, 0.021, glove);
  return g;
}
export function legacyGrenade() {
  const g = new THREE.Group();
  ellipsoid(g, 0, 0, 0, 0.095, 0.13, 0.095, surface("gun", 0x738151));
  for (let i = 0; i < 4; i++) {
    const ring = new THREE.Mesh(
      geo("grenadeRing", () => new THREE.TorusGeometry(0.09, 0.006, 5, 18)),
      material(0x263125),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = -0.07 + i * 0.046;
    g.add(ring);
  }
  cylinder(g, 0, 0.137, 0, 0.035, 0.035, 0x252d27);
  box(g, 0.049, 0.09, 0, 0.017, 0.19, 0.042, 0x979982, 0.7, 0.007);
  const pin = new THREE.Mesh(
    geo("pin", () => new THREE.TorusGeometry(0.029, 0.004, 5, 12)),
    material(0xb2b4a0, 0.75),
  );
  pin.position.set(-0.04, 0.16, 0);
  g.add(pin);
  bake(g);
  return g;
}
const radials = new Map();
export function radialTexture(kind) {
  if (radials.has(kind)) return radials.get(kind);
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const x = c.getContext("2d"),
    gradient = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(
    0,
    kind === "impact" ? "rgba(9,9,8,.9)" : "rgba(255,255,255,.9)",
  );
  gradient.addColorStop(
    0.18,
    kind === "impact" ? "rgba(10,10,9,.8)" : "rgba(255,230,160,.8)",
  );
  gradient.addColorStop(1, "rgba(100,100,90,0)");
  x.fillStyle = gradient;
  x.fillRect(0, 0, 128, 128);
  if (kind === "impact") {
    x.strokeStyle = "rgba(35,30,24,.65)";
    for (let i = 0; i < 11; i++) {
      x.beginPath();
      x.moveTo(64, 64);
      x.lineTo(64 + Math.sin(i * 12) * 48, 64 + Math.cos(i * 12) * 48);
      x.stroke();
    }
  }
  const tex = new THREE.CanvasTexture(c);
  radials.set(kind, tex);
  return tex;
}
