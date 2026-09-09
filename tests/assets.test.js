import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { WEAPONS } from "../shared/weapons.js";

test("shipped GLBs match the manifest, preserve animation pivots, and stay within download budget", async () => {
  const base = new URL("../public/models/", import.meta.url);
  const manifest = JSON.parse(
    await readFile(new URL("manifest.json", base), "utf8"),
  );
  const expected = [
    ...Object.keys(WEAPONS),
    "soldier",
    "terrorist",
    "soldier-lod",
    "terrorist-lod",
  ].sort();
  assert.deepEqual(manifest.models.map((m) => m.id).sort(), expected);
  let total = 0;
  for (const { id, bytes } of manifest.models) {
    const file = await readFile(new URL(`${id}.glb`, base));
    assert.equal(file.readUInt32LE(0), 0x46546c67, id);
    assert.equal(file.readUInt32LE(8), file.length, id);
    assert.equal(file.length, bytes, id);
    const json = JSON.parse(
      file.subarray(20, 20 + file.readUInt32LE(12)).toString("utf8"),
    );
    assert.ok(json.extensionsUsed.includes("EXT_meshopt_compression"), id);
    if (/^(soldier|terrorist)/.test(id)) {
      const names = new Set(json.nodes.map((n) => n.name));
      for (const joint of [
        "body",
        "head",
        "arm0",
        "arm1",
        "elbow0",
        "elbow1",
        "wrist0",
        "wrist1",
        "leg0",
        "leg1",
        "knee0",
        "knee1",
        "ankle0",
        "ankle1",
        "weaponPivot",
      ])
        assert.ok(names.has(joint), `${id}: ${joint}`);
      assert.ok(json.skins?.length > 0, `${id}: real skinned character`);
      assert.ok(json.nodes.some((n) => n.extras?.crosslineRig?.version === 1), `${id}: imported rig metadata`);
      assert.ok(json.materials.length <= 2, `${id}: atlas draw-call budget`);
      for (const mesh of json.meshes)
        for (const primitive of mesh.primitives) {
          assert.ok(primitive.attributes.JOINTS_0 !== undefined, `${id}: joint weights`);
          assert.ok(primitive.attributes.WEIGHTS_0 !== undefined, `${id}: vertex weights`);
          assert.ok(primitive.attributes.TEXCOORD_0 !== undefined, `${id}: baked atlas UVs`);
        }
      assert.ok(json.materials.every((m) => m.normalTexture && m.pbrMetallicRoughness?.baseColorTexture), `${id}: baked material maps`);
      assert.deepEqual(json.animations.map((a) => a.name).sort(), [
        "idle",
        "run",
        "walk",
      ]);
    }
    for (const node of json.nodes)
      for (const key of ["translation", "rotation", "scale", "matrix"]) {
        if (node[key])
          assert.ok(
            node[key].every(Number.isFinite),
            `${id}: ${node.name} transform`,
          );
      }
    total += bytes;
  }
  assert.ok(total < 20 * 1024 * 1024, `43-model pack exceeded 20 MB: ${total}`);
});
