import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";

const models = new Map();
let pending;
export function loadAssets(onProgress = () => {}) {
  if (pending) return pending.then(() => onProgress(1));
  pending = (async () => {
    const response = await fetch("/models/manifest.json");
    if (!response.ok)
      throw Error("Model assets are missing. Run npm run assets.");
    const manifest = await response.json(),
      total = manifest.models.reduce((n, m) => n + m.bytes, 0);
    let received = 0;
    const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder),
      queue = [...manifest.models];
    await Promise.all(
      Array.from({ length: 4 }, async () => {
        while (queue.length) {
          const item = queue.shift(),
            res = await fetch(`/models/${item.id}.glb`);
          if (!res.ok) throw Error(`Could not load ${item.id}`);
          const reader = res.body.getReader(),
            chunks = [];
          let size = 0;
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
            size += value.length;
            received += value.length;
            onProgress(Math.min(0.99, received / total));
          }
          const bytes = new Uint8Array(size);
          let offset = 0;
          for (const chunk of chunks) {
            bytes.set(chunk, offset);
            offset += chunk.length;
          }
          const gltf = await loader.parseAsync(bytes.buffer, "/models/");
          gltf.scene.traverse((o) => {
            if (o.isMesh) {
              o.castShadow = o.receiveShadow = true;
              o.userData.sharedAsset = true;
            }
          });
          models.set(item.id, gltf);
        }
      }),
    );
    onProgress(1);
  })().catch((e) => {
    pending = null;
    throw e;
  });
  return pending;
}
export function instance(id) {
  const asset = models.get(id);
  if (!asset) throw Error(`Model ${id} has not been loaded`);
  const root = asset.scene.clone(true);
  root.animations = asset.animations;
  return root;
}
export function assetMaterials() {
  const materials = new Set();
  for (const { scene } of models.values())
    scene.traverse((o) => {
      if (o.isMesh) materials.add(o.material);
    });
  return materials;
}
