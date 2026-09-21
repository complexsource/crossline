import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { clone as cloneSkeleton } from "three/addons/utils/SkeletonUtils.js";
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { TEAMS } from "../shared/teams.js";

const models = new Map();
const worldWeapons = new Map();
const sharedTextures = new Map(),
  sharedMaterials = new Map();
let pending;
export function matchAssetIds(players = []) {
  return [
    ...new Set([
      "soldier",
      "soldier-lod",
      "terrorist",
      "terrorist-lod",
      "knife",
      "he",
      "flash",
      "smoke",
      ...Object.values(TEAMS).flatMap((t) => [t.primary, t.secondary]),
      ...players.flatMap((p) => [p.primary, p.secondary]).filter(Boolean),
    ]),
  ];
}
export const hasAsset = (id) => models.has(id);
export function loadAssets(
  onProgress = () => {},
  { ids, textureLimit = 2048 } = {},
) {
  if (pending)
    return pending.then(() => loadAssets(onProgress, { ids, textureLimit }));
  pending = (async () => {
    const response = await fetch("/models/manifest.json", {
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok)
      throw Error("Model assets are missing. Run npm run assets.");
    const manifest = await response.json(),
      requested = manifest.models.filter(
        (m) => (!ids || ids.includes(m.id)) && !models.has(m.id),
      ),
      total = requested.reduce((n, m) => n + m.bytes, 0);
    let received = 0;
    const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder),
      queue = [...requested];
    const results = await Promise.allSettled(
      Array.from({ length: 2 }, async () => {
        while (queue.length) {
          const item = queue.shift(),
            res = await fetch(`/models/${item.id}.glb`, {
              signal: AbortSignal.timeout(60000),
            });
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
          // WebP reduces transfer size, not GPU memory. Resize decoded surfaces
          // before upload on budget devices; full-quality source files stay intact.
          const textures = new Set();
          gltf.scene.traverse((o) => {
            if (o.isMesh)
              for (const value of Object.values(o.material))
                if (value?.isTexture) textures.add(value);
          });
          const resized = new Map();
          for (const texture of textures) {
            const image = texture.image;
            if (!image || Math.max(image.width, image.height) <= textureLimit)
              continue;
            let small = resized.get(image);
            if (!small) {
              const ratio = textureLimit / Math.max(image.width, image.height);
              small = await createImageBitmap(image, {
                resizeWidth: Math.max(1, Math.round(image.width * ratio)),
                resizeHeight: Math.max(1, Math.round(image.height * ratio)),
                resizeQuality: "high",
                colorSpaceConversion: "none",
                premultiplyAlpha: "none",
              });
              resized.set(image, small);
            }
            texture.image = small;
          }
          for (const original of resized.keys()) original.close?.();
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
                  texture.image?.width,
                  texture.image?.height,
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
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
      }),
    );
    const failed = results.find((result) => result.status === "rejected");
    if (failed) throw failed.reason;
    onProgress(1);
  })().finally(() => {
    pending = null;
  });
  return pending;
}
export function instance(id) {
  const asset = models.get(id);
  if (!asset) throw Error(`Model ${id} has not been loaded`);
  return cloneAssetScene(asset.scene, asset.animations);
}
export function setCharacterDetail(root, id) {
  const source = models.get(id)?.scene;
  if (!source) return false;
  root.traverse((node) => {
    if (!node.isSkinnedMesh) return;
    const part = source.getObjectByName(node.name);
    if (
      !part?.isSkinnedMesh ||
      node.skeleton.bones.some(
        (b, i) => b.name !== part.skeleton.bones[i]?.name,
      )
    )
      throw Error(`Incompatible character LOD: ${id}`);
    node.geometry = part.geometry;
    node.material = part.material;
    node.position.copy(part.position);
    node.quaternion.copy(part.quaternion);
    node.scale.copy(part.scale);
    node.bindMatrix.copy(part.bindMatrix);
    node.bindMatrixInverse.copy(part.bindMatrixInverse);
    node.skeleton.boneInverses = part.skeleton.boneInverses;
    node.boundingSphere = part.boundingSphere.clone();
  });
  return true;
}
export function worldWeaponInstance(id) {
  if (!worldWeapons.has(id)) {
    const root = instance(id),
      buckets = new Map(),
      meshes = [];
    root.updateMatrixWorld(true);
    root.traverse((node) => {
      if (node.isMesh) meshes.push(node);
    });
    for (const node of meshes) {
      const m = node.material;
      // Preserve textured/equipment surfaces and animated parent pivots.
      if (m.map || m.transparent || m.emissive?.getHex() || Array.isArray(m))
        continue;
      const movingParts = new Set([
        "magazine",
        "bolt",
        "pump",
        "topCover",
        "chargingHandle",
        "pin",
        "pullRing",
        "spoon",
        "led",
      ]);
      if (movingParts.has(node.name)) continue;
      let parent = node.parent;
      while (parent !== root && !movingParts.has(parent.name))
        parent = parent.parent;
      const metal = m.metalness > 0.45;
      const key = `${parent.uuid}/${metal}`;
      if (!buckets.has(key)) buckets.set(key, { parent, metal, list: [] });
      buckets.get(key).list.push(node);
    }
    for (const { parent, metal, list } of buckets.values()) {
      if (list.length < 2) continue;
      const parts = list.map((node) => {
        const transform = parent.matrixWorld
          .clone()
          .invert()
          .multiply(node.matrixWorld);
        const g = (
          node.geometry.index
            ? node.geometry.toNonIndexed()
            : node.geometry.clone()
        ).applyMatrix4(transform);
        for (const name of Object.keys(g.attributes))
          if (!["position", "normal"].includes(name)) g.deleteAttribute(name);
        const colors = new Float32Array(g.attributes.position.count * 3),
          c = node.material.color;
        for (let i = 0; i < colors.length; i += 3) {
          colors[i] = c.r;
          colors[i + 1] = c.g;
          colors[i + 2] = c.b;
        }
        g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
        return g;
      });
      const geometry = mergeGeometries(parts);
      parts.forEach((g) => g.dispose());
      if (!geometry) continue;
      const mesh = new THREE.Mesh(
        geometry,
        new THREE.MeshStandardMaterial({
          vertexColors: true,
          metalness: metal ? 0.65 : 0.05,
          roughness: metal ? 0.4 : 0.78,
        }),
      );
      mesh.castShadow = mesh.receiveShadow = true;
      mesh.userData.sharedAsset = true;
      parent.add(mesh);
      list.forEach((node) => node.removeFromParent());
    }
    worldWeapons.set(id, root);
  }
  return worldWeapons.get(id).clone(true);
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
