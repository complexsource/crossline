import test from "node:test";
import assert from "node:assert/strict";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { MeshoptDecoder } from "meshoptimizer";
import sharp from "sharp";

test("shipped character normal/ORM atlases preserve source pixel data losslessly", async () => {
  await MeshoptDecoder.ready;
  const io = new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ "meshopt.decoder": MeshoptDecoder });
  for (const character of ["soldier", "terrorist"]) {
    const doc = await io.read(
      new URL(`../public/models/${character}.glb`, import.meta.url).pathname,
    );
    const material = doc.getRoot().listMaterials()[0];
    assert.equal(
      material.getOcclusionTexture(),
      material.getMetallicRoughnessTexture(),
    );
    for (const [kind, texture] of [
      ["normal", material.getNormalTexture()],
      ["orm", material.getMetallicRoughnessTexture()],
    ]) {
      const source = await sharp(
        new URL(`../art/characters/${character}-${kind}.png`, import.meta.url)
          .pathname,
      )
        .removeAlpha()
        .raw()
        .toBuffer();
      const shipped = await sharp(texture.getImage())
        .removeAlpha()
        .raw()
        .toBuffer();
      assert.deepEqual(
        shipped,
        source,
        `${character}/${kind}: no lossy colour/chroma changes`,
      );
    }
  }
});
