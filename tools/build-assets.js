import { chromium } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createGameServer } from "../server/index.js";
import { WEAPONS } from "../shared/weapons.js";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS, EXTTextureWebP } from "@gltf-transform/extensions";
import { createHash } from "node:crypto";
import sharp from "sharp";
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
  const models = [],
    compressedTextures = new Map();
  async function compressTextures(document, maxSize = 512) {
    for (const texture of document.getRoot().listTextures()) {
      const source = texture.getImage();
      if (
        !source ||
        !["image/png", "image/jpeg"].includes(texture.getMimeType())
      )
        continue;
      const hash = createHash("sha256").update(source).digest("hex");
      texture.setName(`surface-${hash.slice(0, 20)}`);
      if (
        !document
          .getRoot()
          .listMaterials()
          .some(
            (m) =>
              m.getBaseColorTexture() === texture ||
              m.getEmissiveTexture() === texture,
          )
      ) {
        if (!compressedTextures.has(hash))
          compressedTextures.set(
            hash,
            await sharp(source).webp({ lossless: true, effort: 6 }).toBuffer(),
          );
        const bytes = compressedTextures.get(hash);
        if (bytes.length < source.length) {
          texture.setImage(bytes).setMimeType("image/webp");
          document.createExtension(EXTTextureWebP).setRequired(true);
        }
        continue;
      }
      if (!compressedTextures.has(hash)) {
        const data = await page.evaluate(
          async ({ data, mime, maxSize }) => {
            const bytes = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
            const bitmap = await createImageBitmap(
              new Blob([bytes], { type: mime }),
            );
            const canvas = document.createElement("canvas");
            const ratio = Math.min(
              1,
              maxSize / Math.max(bitmap.width, bitmap.height),
            );
            canvas.width = Math.max(1, Math.round(bitmap.width * ratio));
            canvas.height = Math.max(1, Math.round(bitmap.height * ratio));
            canvas
              .getContext("2d")
              .drawImage(bitmap, 0, 0, canvas.width, canvas.height);
            bitmap.close();
            return canvas
              .toDataURL("image/webp", maxSize > 512 ? 0.98 : 0.94)
              .split(",")[1];
          },
          {
            data: Buffer.from(source).toString("base64"),
            mime: texture.getMimeType(),
            maxSize,
          },
        );
        compressedTextures.set(hash, Buffer.from(data, "base64"));
      }
      const compressed = compressedTextures.get(hash);
      if (compressed.length < source.length) {
        texture.setImage(compressed).setMimeType("image/webp");
        document.createExtension(EXTTextureWebP).setRequired(true);
      }
    }
  }
  for (const id of [...Object.keys(WEAPONS), "soldier", "terrorist"]) {
    const character = ["soldier", "terrorist"].includes(id);
    // Never silently regenerate the approved characters with the retired builder.
    const original = character
      ? await readFile(`art/characters/${id}-rigged.glb`)
      : Buffer.from(
          await page.evaluate((id) => window.compileAsset(id), id),
          "base64",
        );
    for (const lod of ["soldier", "terrorist"].includes(id)
      ? [false, true]
      : [false]) {
      const document = await io.readBinary(original);
      document.setLogger({
        debug() {},
        info() {},
        // Repeating UVs intentionally extend beyond 0–1; retaining them is correct.
        warn(message) {
          if (!message.includes("Skipping TEXCOORD_0; out of [0,1] range"))
            console.warn(message);
        },
        error: (message) => console.error(message),
      });
      await document.transform(dedup(), weld());
      await compressTextures(document, character ? 2048 : 512);
      if (character)
        await document.transform(
          simplify({
            simplifier: MeshoptSimplifier,
            ratio: lod ? 0.24 : 0.8,
            error: lod ? 0.003 : 0.0004,
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
          "Original Crossline geometry; weapons/equipment in src; skinned characters from tools/character-study and tools/build-characters.js",
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
