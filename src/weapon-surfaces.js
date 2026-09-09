import * as THREE from "three";

// Original compact surface library. These are deliberately quiet manufactured
// finishes rather than photo textures: all weapons share one material language.
const materials = new Map(),
  textures = new Map(),
  labels = new Map();
const normals = new Map();
function grain(kind) {
  if (textures.has(kind)) return textures.get(kind);
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d"),
    data = ctx.createImageData(128, 128);
  let seed = 5179;
  const random = () =>
    (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
  for (let y = 0; y < 128; y++)
    for (let x = 0; x < 128; x++) {
      const n = random(),
        wave = Math.sin(
          y * 0.39 + Math.sin(x * 0.045) * 2.6 + Math.sin(x * 0.12 + y * 0.05),
        );
      const v =
        kind === "wood"
          ? 232 + wave * 10 + n * 6
          : kind === "metal"
            ? 236 + Math.sin(y * 7.4) * 4 + n * 10
            : 244 + n * 9;
      const i = (y * 128 + x) * 4;
      data.data[i] = data.data[i + 1] = data.data[i + 2] = v;
      data.data[i + 3] = 255;
    }
  ctx.putImageData(data, 0, 0);
  if (kind === "fabric") {
    ctx.strokeStyle = "rgba(20,20,20,.13)";
    for (let i = 0; i < 128; i += 4) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, 128);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(128, i);
      ctx.stroke();
    }
  }
  const map = new THREE.CanvasTexture(c);
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(kind === "wood" ? 2 : 6, kind === "wood" ? 2 : 6);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 4;
  textures.set(kind, map);
  return map;
}
function normalGrain(kind) {
  if (normals.has(kind)) return normals.get(kind);
  const source = grain(kind)
    .image.getContext("2d")
    .getImageData(0, 0, 128, 128).data;
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d"),
    data = ctx.createImageData(128, 128);
  for (let y = 0; y < 128; y++)
    for (let x = 0; x < 128; x++) {
      const i = (y * 128 + x) * 4,
        sx =
          source[(y * 128 + ((x + 1) % 128)) * 4] -
          source[(y * 128 + ((x + 127) % 128)) * 4];
      const sy =
        source[(((y + 1) % 128) * 128 + x) * 4] -
        source[(((y + 127) % 128) * 128 + x) * 4];
      data.data[i] = 128 - sx * 0.6;
      data.data[i + 1] = 128 - sy * 0.6;
      data.data[i + 2] = 254;
      data.data[i + 3] = 255;
    }
  ctx.putImageData(data, 0, 0);
  const map = new THREE.CanvasTexture(c);
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(kind === "wood" ? 2 : 6, kind === "wood" ? 2 : 6);
  normals.set(kind, map);
  return map;
}
export function finish(kind = "metal", color = 0x455253) {
  const key = `${kind}/${color}`;
  if (!materials.has(key)) {
    const map = grain(kind),
      metal = kind === "metal" || kind === "edge";
    materials.set(
      key,
      new THREE.MeshStandardMaterial({
        name: `Crossline ${kind} ${color.toString(16)}`,
        color,
        map,
        roughness:
          kind === "edge" ? 0.29 : metal ? 0.43 : kind === "wood" ? 0.42 : 0.74,
        metalness: kind === "edge" ? 0.78 : metal ? 0.62 : 0.03,
        normalMap: kind === "edge" ? null : normalGrain(kind),
        normalScale: new THREE.Vector2(
          kind === "polymer" ? 0.24 : 0.13,
          kind === "polymer" ? 0.24 : 0.13,
        ),
      }),
    );
  }
  return materials.get(key);
}

// A small shared ink texture supplies legible invented factory marks, rather
// than hundreds of tiny extruded text meshes in the first-person view.
export function stampMaterial(
  title,
  subtitle = "CROSSLINE  /  FIELD SYSTEMS",
  color = "#b8c1b8",
  background = null,
) {
  const key = [title, subtitle, color, background].join("/");
  if (labels.has(key)) return labels.get(key);
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 64;
  const ctx = c.getContext("2d");
  if (background) {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, 256, 64);
  }
  ctx.fillStyle = color;
  ctx.font = "bold 27px Arial";
  ctx.fillText(title, 9, 28);
  ctx.font = "10px Arial";
  ctx.fillText(subtitle, 10, 47);
  ctx.fillRect(10, 55, 118, 2);
  for (let i = 0; i < 25; i++) ctx.fillRect(168 + i * 3, 39, i % 3 ? 1 : 2, 18);
  const map = new THREE.CanvasTexture(c);
  map.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshStandardMaterial({
    name: `Factory mark ${title}`,
    map,
    transparent: !background,
    roughness: 0.65,
    metalness: 0.1,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    depthWrite: !!background,
  });
  labels.set(key, mat);
  return mat;
}
export function stamp(
  parent,
  text,
  subtitle,
  position,
  width,
  height,
  rotation = [0, 0, 0],
  color,
  background,
) {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(width, height),
    stampMaterial(text, subtitle, color, background),
  );
  m.position.set(...position);
  m.rotation.set(...rotation);
  m.userData.ownedGeometry = true;
  parent.add(m);
  return m;
}
