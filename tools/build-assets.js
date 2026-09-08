import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { createGameServer } from "../server/index.js";
import { WEAPONS } from "../shared/weapons.js";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { dedup, weld, meshopt, simplify } from "@gltf-transform/functions";
import {
  MeshoptEncoder,
  MeshoptDecoder,
  MeshoptSimplifier,
} from "meshoptimizer";

const server = await createGameServer();
await new Promise((resolve) => server.http.listen(0, "127.0.0.1", resolve));
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  await mkdir("public/models", { recursive: true });
  const page = await browser.newPage();
  page.on("pageerror", (e) => console.error(e));
  await page.goto(
    `http://127.0.0.1:${server.http.address().port}/tools/asset-builder.html`,
  );
  await page.waitForFunction(() => window.ready);
  await Promise.all([MeshoptEncoder.ready, MeshoptSimplifier.ready]);
  const io = new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({
      "meshopt.encoder": MeshoptEncoder,
      "meshopt.decoder": MeshoptDecoder,
    });
  const models = [];
  for (const id of [...Object.keys(WEAPONS), "soldier", "terrorist"]) {
    const encoded = await page.evaluate((id) => window.compileAsset(id), id),
      original = Buffer.from(encoded, "base64");
    for (const lod of ["soldier", "terrorist"].includes(id)
      ? [false, true]
      : [false]) {
      const document = await io.readBinary(original);
      await document.transform(dedup(), weld());
      if (lod)
        await document.transform(
          simplify({
            simplifier: MeshoptSimplifier,
            ratio: 0.35,
            error: 0.002,
          }),
        );
      await document.transform(
        meshopt({ encoder: MeshoptEncoder, level: "high" }),
      );
      const buffer = await io.writeBinary(document),
        key = id + (lod ? "-lod" : "");
      await writeFile(`public/models/${key}.glb`, buffer);
      models.push({ id: key, bytes: buffer.length });
      console.log(key, Math.round(buffer.length / 1024) + " KB");
    }
  }
  await writeFile(
    "public/models/manifest.json",
    JSON.stringify(
      {
        version: 2,
        source:
          "Original Crossline geometry; see src/weapon-models.js, character-models.js, equipment.js",
        models,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(
    "Compiled",
    models.length,
    "original models; total",
    Math.round((models.reduce((n, m) => n + m.bytes, 0) / 1024 / 1024) * 10) /
      10,
    "MB",
  );
} finally {
  await browser.close();
  await server.close();
}
