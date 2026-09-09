import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { clone as cloneSkeleton } from "three/addons/utils/SkeletonUtils.js";

const models = new Map();
const sharedTextures = new Map(),
  sharedMaterials = new Map();
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
          gltf.scene.updateMatrixWorld(true);
          gltf.scene.traverse((o) => {
            if (o.isMesh) {
              const material = o.material;
              // Compiler-assigned content names let separate GLBs share GPU textures.
              for (const slot of [
                "map",
                "normalMap",
                "roughnessMap",
                "metalnessMap",
                "aoMap",
                "emissiveMap",
              ]) {
                const texture = material[slot];
                if (!texture || !texture.name.startsWith("surface-")) continue;
                const key = [
                  texture.name,
                  texture.colorSpace,
                  texture.wrapS,
                  texture.wrapT,
                  ...texture.repeat.toArray(),
                  ...texture.offset.toArray(),
                  texture.rotation,
                ].join("/");
                const cached = sharedTextures.get(key);
                if (cached && cached !== texture) {
                  material[slot] = cached;
                  texture.dispose();
                } else sharedTextures.set(key, texture);
              }
              const key = JSON.stringify([
                material.type,
                material.color?.getHex(),
                material.metalness,
                material.roughness,
                material.opacity,
                material.transparent,
                material.side,
                material.vertexColors,
                material.emissive?.getHex(),
                material.emissiveIntensity,
                material.normalScale?.toArray(),
                material.clearcoat,
                material.clearcoatRoughness,
                material.transmission,
                material.ior,
                material.alphaTest,
                material.aoMapIntensity,
                ...[
                  "map",
                  "normalMap",
                  "roughnessMap",
                  "metalnessMap",
                  "aoMap",
                  "emissiveMap",
                ].map((slot) => material[slot]?.uuid),
              ]);
              const cached = sharedMaterials.get(key);
              if (cached && cached !== material) o.material = cached;
              else sharedMaterials.set(key, material);
              o.castShadow = o.receiveShadow = true;
              o.userData.sharedAsset = true;
              if (o.isSkinnedMesh) {
                // A conservative bind-pose sphere covers crouching, jumping and
                // falling without CPU-skinning every vertex on every frame.
                o.skeleton.update();
                o.computeBoundingSphere();
                o.boundingSphere.radius *= 2.5;
              }
            }
          });
          models.set(item.id, {
            scene: gltf.scene,
            animations: gltf.animations,
          });
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
  return cloneAssetScene(asset.scene, asset.animations);
}
export function cloneAssetScene(scene, animations = []) {
  // Object3D.clone shares skeleton bones. Each remote player needs independent
  // bones and bone matrices, while immutable geometry/materials remain shared.
  const root = cloneSkeleton(scene);
  const sourceSkins = [],
    localSkins = new Map();
  scene.traverse((node) => {
    if (node.isSkinnedMesh) sourceSkins.push(node.skeleton);
  });
  let skinIndex = 0;
  root.traverse((node) => {
    if (!node.isSkinnedMesh) return;
    // SkeletonUtils creates one skeleton per material mesh. A single source
    // skin can safely share one cloned skeleton inside this player only.
    const sourceSkin = sourceSkins[skinIndex++];
    if (localSkins.has(sourceSkin)) node.skeleton = localSkins.get(sourceSkin);
    else localSkins.set(sourceSkin, node.skeleton);
  });
  root.animations = animations;
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
