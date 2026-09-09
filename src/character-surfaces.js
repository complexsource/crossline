import * as THREE from "three";

const surfaces = new Map();
const vertexSurfaces = new Map();
let weave, leather, scarf;

// Small, shared, original material tiles. Mesh UVs carry scale so every item of
// clothing can share the same GPU texture and still have a believable weave.
function tile(kind) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#cccccc";
  ctx.fillRect(0, 0, 128, 128);
  let seed = 271;
  for (let y = 0; y < 128; y += 2)
    for (let x = 0; x < 128; x += 2) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      const n =
        kind === "leather"
          ? 183 + ((seed >>> 24) % 42)
          : 195 + ((x + y) % 4 ? 6 : 20);
      ctx.fillStyle = `rgb(${n},${n},${n})`;
      ctx.fillRect(x, y, 2, kind === "leather" ? 2 : 1);
    }
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

export function textile(color, kind = "cloth") {
  const key = `${color}/${kind}`;
  if (surfaces.has(key)) return surfaces.get(key);
  weave ||= tile("cloth");
  leather ||= tile("leather");
  const m = new THREE.MeshStandardMaterial({
    color,
    map: kind === "leather" ? leather : weave,
    roughness: kind === "leather" ? 0.64 : 0.94,
    metalness: 0,
  });
  surfaces.set(key, m);
  return m;
}

export function scarfSurface() {
  if (scarf) return scarf;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#bdb095";
  ctx.fillRect(0, 0, 256, 256);
  ctx.strokeStyle = "#655c48";
  ctx.lineWidth = 2;
  for (let i = -8; i < 17; i++) {
    ctx.beginPath();
    ctx.moveTo(i * 32, 0);
    ctx.lineTo(i * 32 + 256, 256);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(i * 32, 0);
    ctx.lineTo(i * 32 - 256, 256);
    ctx.stroke();
  }
  ctx.fillStyle = "#81745d";
  for (let y = 0; y < 256; y += 32)
    for (let x = 0; x < 256; x += 32) {
      ctx.save();
      ctx.translate(x + 16, y + 16);
      ctx.rotate(Math.PI / 4);
      ctx.fillRect(-5, -5, 10, 10);
      ctx.restore();
    }
  ctx.globalAlpha = 0.15;
  ctx.fillStyle = "#eee5cf";
  for (let y = 0; y < 256; y += 3) ctx.fillRect(0, y, 256, 1);
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.anisotropy = 4;
  scarf = new THREE.MeshStandardMaterial({ map, roughness: 0.98 });
  return scarf;
}

export function mesh(parent, geometry, material) {
  const m = new THREE.Mesh(geometry, material);
  m.castShadow = m.receiveShadow = true;
  m.userData.ownedGeometry = true;
  parent.add(m);
  return m;
}

// Tailor-made cross-section loft: each ring is [height, half-width, half-depth,
// x-offset, z-offset]. Rounded rectangle sections produce real chest, boot and
// clothing silhouettes, instead of a stack of scaled sphere primitives.
export function loft(
  parent,
  rings,
  mat,
  {
    segments = 24,
    rows = 28,
    square = 2.3,
    folds = 0,
    uvScale = 2,
    caps = true,
  } = {},
) {
  const positions = [],
    uvs = [],
    indices = [];
  // Interpolate the profile by row, preserving the authored height ordering.
  for (let row = 0; row <= rows; row++) {
    const t = row / rows,
      f = t * (rings.length - 1),
      k = Math.min(rings.length - 2, Math.floor(f)),
      a = f - k;
    const values = [0, 1, 2, 3, 4].map((axis) => {
      const p0 = rings[Math.max(0, k - 1)][axis] || 0,
        p1 = rings[k][axis] || 0;
      const p2 = rings[k + 1][axis] || 0,
        p3 = rings[Math.min(rings.length - 1, k + 2)][axis] || 0;
      return (
        (2 * p1 +
          (-p0 + p2) * a +
          (2 * p0 - 5 * p1 + 4 * p2 - p3) * a * a +
          (-p0 + 3 * p1 - 3 * p2 + p3) * a * a * a) /
        2
      );
    });
    const [y, rx, rz, cx, cz] = values;
    for (let s = 0; s <= segments; s++) {
      const u = s / segments,
        angle = u * Math.PI * 2;
      const co = Math.cos(angle),
        si = Math.sin(angle);
      const fold =
        1 +
        folds *
          Math.sin(t * Math.PI) *
          (Math.sin(angle * 5 + t * 27) * 0.65 +
            Math.sin(angle * 9 - t * 17) * 0.35);
      positions.push(
        cx +
          Math.sign(co) *
            Math.abs(co) ** (2 / square) *
            Math.max(0.001, rx) *
            fold,
        y,
        cz +
          Math.sign(si) *
            Math.abs(si) ** (2 / square) *
            Math.max(0.001, rz) *
            fold,
      );
      uvs.push(u * uvScale, t * uvScale);
      if (row < rows && s < segments) {
        const i = row * (segments + 1) + s;
        indices.push(
          i,
          i + segments + 1,
          i + 1,
          i + 1,
          i + segments + 1,
          i + segments + 2,
        );
      }
    }
  }
  if (caps) {
    const ascending = rings[rings.length - 1][0] >= rings[0][0];
    for (const end of [0, rows]) {
      const source = end * (segments + 1);
      const profile = rings[end === 0 ? 0 : rings.length - 1];
      const center = positions.length / 3;
      const cx = profile[3] || 0,
        cz = profile[4] || 0;
      positions.push(cx, profile[0], cz);
      uvs.push(0.5, 0.5);
      // Independent rim vertices give the cap a planar normal without turning
      // the smoothly shaded cloth wall into a bevel at its open profile ends.
      for (let s = 0; s <= segments; s++) {
        const i = (source + s) * 3;
        const x = positions[i],
          y = positions[i + 1],
          z = positions[i + 2];
        positions.push(x, y, z);
        uvs.push(
          0.5 + (x - cx) / (2 * Math.max(0.001, profile[1])),
          0.5 + (z - cz) / (2 * Math.max(0.001, profile[2])),
        );
      }
      const positiveY = end === 0 ? !ascending : ascending;
      for (let s = 0; s < segments; s++) {
        const current = center + 1 + s;
        if (positiveY) indices.push(center, current + 1, current);
        else indices.push(center, current, current + 1);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(indices);
  g.computeVertexNormals();
  return mesh(parent, g, mat);
}

export function panel(parent, points, depth, mat, bevel = 0.006) {
  const shape = new THREE.Shape();
  points.forEach(([x, y], i) => (i ? shape.lineTo(x, y) : shape.moveTo(x, y)));
  shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, {
    depth,
    steps: 1,
    bevelEnabled: bevel > 0,
    bevelSegments: 2,
    bevelSize: bevel,
    bevelThickness: bevel,
    curveSegments: 8,
  });
  return mesh(parent, g, mat);
}

export function seam(parent, points, mat, radius = 0.0024, segments = 18) {
  const curve = new THREE.CatmullRomCurve3(
    points.map((v) => new THREE.Vector3(...v)),
  );
  return mesh(
    parent,
    new THREE.TubeGeometry(curve, segments, radius, 5, false),
    mat,
  );
}

// A broad cloth strip with a softly undulating center, used for collars,
// straps and scarf tails. Width and taper follow the strip's profile.
export function ribbon(
  parent,
  points,
  width,
  mat,
  { taper = 1, ripple = 0.004 } = {},
) {
  const curve = new THREE.CatmullRomCurve3(
    points.map((v) => new THREE.Vector3(...v)),
  );
  const p = [],
    uv = [],
    ix = [];
  for (let y = 0; y <= 24; y++) {
    const t = y / 24,
      center = curve.getPoint(t),
      tangent = curve.getTangent(t);
    let sideways = new THREE.Vector3(1, 0, 0);
    if (Math.abs(tangent.x) > 0.6) sideways.set(0, 1, 0);
    for (let x = 0; x <= 8; x++) {
      const u = x / 8,
        side = (u - 0.5) * width * (1 + (taper - 1) * t);
      const v = center.clone().addScaledVector(sideways, side);
      v.z += Math.sin(u * Math.PI * 5 + t * 7) * ripple * Math.sin(u * Math.PI);
      p.push(v.x, v.y, v.z);
      uv.push(u, t * 1.8);
      if (y < 24 && x < 8) {
        const i = y * 9 + x;
        ix.push(i, i + 9, i + 1, i + 1, i + 9, i + 10);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(p, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(ix);
  g.computeVertexNormals();
  const m = mesh(parent, g, mat);
  m.material.side = THREE.DoubleSide;
  return m;
}

// Palette colors are vertex data, not an extra draw for every buckle/thread.
// Cloth and leather retain their shared texture tile; roughness and metalness
// remain genuinely distinct. The face already has sculpted vertex colors.
export function consolidatePalette(root) {
  root.traverse((o) => {
    if (!o.isMesh || Array.isArray(o.material) || o.material.vertexColors)
      return;
    const old = o.material;
    if (old.transparent || old.emissiveIntensity > 1 || old.normalMap) return;
    const key = [
      old.map?.uuid || "none",
      old.roughness,
      old.metalness,
      old.side,
      old.emissive?.getHex() || 0,
    ].join("/");
    let mat = vertexSurfaces.get(key);
    if (!mat) {
      mat = old.clone();
      mat.color.set(0xffffff);
      mat.vertexColors = true;
      vertexSurfaces.set(key, mat);
    }
    const g = o.geometry.clone(),
      count = g.attributes.position.count,
      colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      colors[i * 3] = old.color.r;
      colors[i * 3 + 1] = old.color.g;
      colors[i * 3 + 2] = old.color.b;
    }
    g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    if (o.userData.ownedGeometry) o.geometry.dispose();
    o.geometry = g;
    o.material = mat;
    o.userData.ownedGeometry = true;
  });
}
