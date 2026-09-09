import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { cloneAssetScene } from "../src/assets.js";

function skinFixture() {
  const scene = new THREE.Group();
  const body = new THREE.Bone();
  body.name = "body";
  const head = new THREE.Bone();
  head.name = "head";
  head.position.y = 1;
  body.add(head);
  scene.add(body);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute([-0.1, 1, 0, 0.1, 1, 0, 0, 1.2, 0], 3),
  );
  geometry.setAttribute(
    "skinIndex",
    new THREE.Uint16BufferAttribute([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], 4),
  );
  geometry.setAttribute(
    "skinWeight",
    new THREE.Float32BufferAttribute([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], 4),
  );
  const mesh = new THREE.SkinnedMesh(
    geometry,
    new THREE.MeshStandardMaterial(),
  );
  mesh.name = "characterSkin";
  scene.add(mesh);
  scene.updateMatrixWorld(true);
  mesh.bind(new THREE.Skeleton([body, head]));
  mesh.computeBoundingSphere();
  const clips = [
    new THREE.AnimationClip("idle", 1, [
      new THREE.NumberKeyframeTrack("head.position[y]", [0, 1], [1, 1.1]),
    ]),
  ];
  return { scene, mesh, clips };
}

test("character instances own independent bones and skeleton matrices", () => {
  const { scene, mesh, clips } = skinFixture();
  const a = cloneAssetScene(scene, clips);
  const b = cloneAssetScene(scene, clips);
  const skinA = a.getObjectByName("characterSkin");
  const skinB = b.getObjectByName("characterSkin");
  assert.notEqual(skinA.skeleton, skinB.skeleton);
  assert.notEqual(skinA.skeleton.boneMatrices, skinB.skeleton.boneMatrices);
  assert.equal(skinA.skeleton.bones[1], a.getObjectByName("head"));
  assert.equal(skinB.skeleton.bones[1], b.getObjectByName("head"));
  const originalB = skinB.getVertexPosition(2, new THREE.Vector3()).clone();
  a.getObjectByName("head").rotation.z = 0.7;
  a.updateMatrixWorld(true);
  skinA.skeleton.update();
  const movedA = skinA.getVertexPosition(2, new THREE.Vector3());
  const stationaryB = skinB.getVertexPosition(2, new THREE.Vector3());
  assert.ok(movedA.distanceTo(originalB) > 0.05);
  assert.ok(stationaryB.distanceTo(originalB) < 1e-8);
  assert.equal(scene.getObjectByName("head").rotation.z, 0);
  // GPU-heavy immutable data is still shared across the ten-player room.
  assert.equal(skinA.geometry, mesh.geometry);
  assert.equal(skinB.material, mesh.material);
  assert.equal(a.animations, clips);
  mesh.geometry.dispose();
  mesh.material.dispose();
});

test("animation mixers cannot animate another character instance", () => {
  const { scene, mesh, clips } = skinFixture();
  const a = cloneAssetScene(scene, clips);
  const b = cloneAssetScene(scene, clips);
  const mixer = new THREE.AnimationMixer(a);
  mixer.clipAction(clips[0]).play();
  mixer.update(0.5);
  assert.ok(a.getObjectByName("head").position.y > 1.04);
  assert.equal(b.getObjectByName("head").position.y, 1);
  assert.equal(scene.getObjectByName("head").position.y, 1);
  mixer.stopAllAction();
  mixer.uncacheRoot(a);
  mesh.geometry.dispose();
  mesh.material.dispose();
});

test("material meshes share one skeleton inside a player, never between players", () => {
  const { scene, mesh, clips } = skinFixture();
  const gear = mesh.clone();
  gear.name = "gearSkin";
  scene.add(gear);
  const a = cloneAssetScene(scene, clips);
  const b = cloneAssetScene(scene, clips);
  assert.equal(
    a.getObjectByName("characterSkin").skeleton,
    a.getObjectByName("gearSkin").skeleton,
  );
  assert.notEqual(
    a.getObjectByName("gearSkin").skeleton,
    b.getObjectByName("gearSkin").skeleton,
  );
  mesh.geometry.dispose();
  mesh.material.dispose();
});

test("plain weapon scene cloning remains compatible and keeps material sharing", () => {
  const scene = new THREE.Group();
  const bolt = new THREE.Mesh(
    new THREE.BoxGeometry(),
    new THREE.MeshBasicMaterial(),
  );
  bolt.name = "bolt";
  scene.add(bolt);
  const a = cloneAssetScene(scene),
    b = cloneAssetScene(scene);
  a.getObjectByName("bolt").position.z = 0.04;
  assert.equal(b.getObjectByName("bolt").position.z, 0);
  assert.equal(b.getObjectByName("bolt").geometry, bolt.geometry);
  assert.deepEqual(a.animations, []);
  bolt.geometry.dispose();
  bolt.material.dispose();
});
