// Convert baked art sources into independent, genuinely skinned game characters.
// No server state is involved. --install replaces only the four character GLBs.
import { readFile, writeFile, mkdir, rename } from "node:fs/promises";
import { createHash } from "node:crypto";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS, EXTTextureWebP } from "@gltf-transform/extensions";
import {
  dedup,
  weld,
  simplify,
  meshopt,
  prune,
} from "@gltf-transform/functions";
import {
  MeshoptEncoder,
  MeshoptDecoder,
  MeshoptSimplifier,
} from "meshoptimizer";
import { chromium } from "@playwright/test";
import { Matrix4, Vector3 } from "three";
import sharp from "sharp";

const ROOT = new URL("../", import.meta.url);
const S = 1.85 / (3.27 - 0.0241);
const game = ([x, y, z]) => [-x * S, (z - 0.0241) * S, y * S];
const native = { body: [0, 0, 0.0241], head: [0, 0, 2.55] };
const parent = { head: "body" };
for (let side = 0; side < 2; side++) {
  const sign = side === 0 ? 1 : -1;
  for (const [key, point] of Object.entries({
    arm: [0.435, 0.025, 1.995],
    elbow: [0.566, 0.015, 1.58],
    wrist: [0.647, -0.045, 1.105],
    leg: [0.2, 0.027, 1.2],
    knee: [0.235, -0.014, 0.765],
    ankle: [0.288, 0.018, 0.275],
  })) {
    native[key + side] = [point[0] * sign, point[1], point[2]];
  }
  Object.assign(parent, {
    ["arm" + side]: "body",
    ["elbow" + side]: "arm" + side,
    ["wrist" + side]: "elbow" + side,
    ["leg" + side]: "body",
    ["knee" + side]: "leg" + side,
    ["ankle" + side]: "knee" + side,
  });
  for (let f = 0; f < 4; f++) {
    native[`finger${side}_${f}`] = [
      sign * (0.659 + f * 0.039) * 0.9,
      -0.065,
      1.079,
    ];
    parent[`finger${side}_${f}`] = "wrist" + side;
  }
}
const world = Object.fromEntries(
  Object.entries(native).map(([k, v]) => [k, game(v)]),
);
await Promise.all([
  MeshoptEncoder.ready,
  MeshoptDecoder.ready,
  MeshoptSimplifier.ready,
]);
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({
    "meshopt.encoder": MeshoptEncoder,
    "meshopt.decoder": MeshoptDecoder,
  });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage();
await mkdir(new URL("art/characters/", ROOT), { recursive: true });
await mkdir(new URL("test-results/character-candidate/", ROOT), {
  recursive: true,
});
const reports = [];
const requested = process.argv.indexOf("--only");
const characters =
  requested < 0 ? ["soldier", "terrorist"] : [process.argv[requested + 1]];
if (characters.some((id) => !["soldier", "terrorist"].includes(id)))
  throw Error("Unknown character");
try {
  for (const character of characters) {
    const document = await io.read(
      new URL(`art/characters/${character}-source.glb`, ROOT).pathname,
    );
    const metadata = JSON.parse(
      await readFile(
        new URL(`art/characters/${character}-source.json`, ROOT),
        "utf8",
      ),
    );
    const root = document.getRoot(),
      buffer = root.listBuffers()[0],
      scene = root.listScenes()[0];
    for (const material of root.listMaterials()) {
      const orm = material.getMetallicRoughnessTexture();
      if (orm) material.setOcclusionTexture(orm).setOcclusionStrength(0.65);
    }
    const joints = {};
    for (const name of metadata.jointOrder)
      joints[name] = document.createNode(name);
    for (const name of metadata.jointOrder) {
      const p = parent[name];
      joints[name].setTranslation(
        world[name].map((v, i) => v - (p ? world[p][i] : 0)),
      );
      if (p) joints[p].addChild(joints[name]);
      else scene.addChild(joints[name]);
    }
    joints.body.setExtras({
      crosslineRig: {
        version: 1,
        weaponPosition: [0.045, 1.1, -0.13],
        crouchDrop: 0.46,
        labelHeight: 2.05,
        source: "approved-reference-character",
        height: 1.85,
      },
    });
    const weapon = document
      .createNode("weaponPivot")
      .setTranslation([0.045, 1.1, -0.13])
      .setScale([0.66, 0.66, 0.66])
      .setExtras({ crosslineAttachment: "weapon" });
    joints.body.addChild(weapon);
    const matrices = [];
    for (const name of metadata.jointOrder) {
      const m = new Matrix4().makeTranslation(...world[name]).invert();
      matrices.push(...m.elements);
    }
    const inverse = document
      .createAccessor("inverse bind matrices", buffer)
      .setType("MAT4")
      .setArray(new Float32Array(matrices));
    const skin = document
      .createSkin(character + " skeleton")
      .setSkeleton(joints.body)
      .setInverseBindMatrices(inverse);
    for (const name of metadata.jointOrder) skin.addJoint(joints[name]);
    let triangles = 0;
    for (const node of root.listNodes()) {
      const mesh = node.getMesh();
      if (!mesh) continue;
      for (const primitive of mesh.listPrimitives()) {
        const position = primitive.getAttribute("POSITION"),
          normal = primitive.getAttribute("NORMAL");
        const a = primitive.getAttribute("_RIG_A"),
          b = primitive.getAttribute("_RIG_B"),
          blend = primitive.getAttribute("_RIG_BLEND");
        if (!a || !b || !blend)
          throw Error(`${character}: missing baked binding tags`);
        const count = position.getCount(),
          ji = new Uint16Array(count * 4),
          weights = new Float32Array(count * 4);
        for (let i = 0; i < count; i++) {
          const p = position.getElement(i, []);
          // Blender GLTF is already Y-up, facing +Z. Rotate 180 degrees around Y.
          position.setElement(i, [-p[0] * S, (p[1] - 0.0241) * S, -p[2] * S]);
          const n = normal.getElement(i, []);
          normal.setElement(i, [-n[0], n[1], -n[2]]);
          const ja = Math.round(a.getScalar(i)),
            jb = Math.round(b.getScalar(i)),
            t = blend.getScalar(i);
          if (
            ja < 0 ||
            jb < 0 ||
            ja >= metadata.jointOrder.length ||
            jb >= metadata.jointOrder.length ||
            !Number.isFinite(t) ||
            t < 0 ||
            t > 1
          )
            throw Error("Invalid skin weights");
          ji[i * 4] = ja;
          ji[i * 4 + 1] = jb;
          weights[i * 4] = 1 - t;
          weights[i * 4 + 1] = t;
        }
        primitive.setAttribute(
          "JOINTS_0",
          document
            .createAccessor("skin joints", buffer)
            .setType("VEC4")
            .setArray(ji),
        );
        primitive.setAttribute(
          "WEIGHTS_0",
          document
            .createAccessor("skin weights", buffer)
            .setType("VEC4")
            .setArray(weights),
        );
        for (const semantic of ["_RIG_A", "_RIG_B", "_RIG_BLEND"])
          primitive.setAttribute(semantic, null);
        triangles += (primitive.getIndices()?.getCount() || count) / 3;
      }
      node
        .setSkin(skin)
        .setName(character + " skinned body")
        .setExtras({ sharedAsset: true });
    }
    function track(animation, name, times, values, path = "rotation") {
      const sampler = document
        .createAnimationSampler()
        .setInput(
          document
            .createAccessor("", buffer)
            .setType("SCALAR")
            .setArray(new Float32Array(times)),
        )
        .setOutput(
          document
            .createAccessor("", buffer)
            .setType(path === "rotation" ? "VEC4" : "VEC3")
            .setArray(new Float32Array(values)),
        )
        .setInterpolation("LINEAR");
      const channel = document
        .createAnimationChannel()
        .setTargetNode(joints[name])
        .setTargetPath(path)
        .setSampler(sampler);
      animation.addSampler(sampler).addChannel(channel);
    }
    for (const [name, seconds, amplitude] of [
      ["walk", 0.84, 0.43],
      ["run", 0.55, 0.67],
    ]) {
      const animation = document.createAnimation(name);
      for (let side = 0; side < 2; side++) {
        const times = [0, 0.25, 0.5, 0.75, 1].map((t) => t * seconds),
          sign = side ? -1 : 1;
        track(
          animation,
          "leg" + side,
          times,
          [0, amplitude * sign, 0, -amplitude * sign, 0].flatMap((a) => [
            Math.sin(a / 2),
            0,
            0,
            Math.cos(a / 2),
          ]),
        );
        track(
          animation,
          "knee" + side,
          times,
          [
            -0.04,
            side ? -0.5 : -0.05,
            -0.04,
            side ? -0.05 : -0.5,
            -0.04,
          ].flatMap((a) => [Math.sin(a / 2), 0, 0, Math.cos(a / 2)]),
        );
      }
    }
    const idle = document.createAnimation("idle");
    track(
      idle,
      "body",
      [0, 0.7, 1.4, 2.1, 2.8],
      [0, 0, 0, 0, 0.003, 0, 0, 0.006, 0, 0, 0.003, 0, 0, 0, 0],
      "translation",
    );
    await document.transform(prune({ keepLeaves: true }), dedup(), weld());
    await io.write(
      new URL(`art/characters/${character}-rigged.glb`, ROOT).pathname,
      document,
    );
    // Embedded WebP atlases are shared by hash between full/LOD assets at runtime.
    for (const texture of root.listTextures()) {
      const source = texture.getImage();
      if (!source) continue;
      const hash = createHash("sha256").update(source).digest("hex");
      texture.setName("surface-" + hash.slice(0, 20));
      // Normal/ORM values are data, not display colours: lossy chroma compression
      // can introduce shading bands. Encode their pixels as lossless WebP.
      if (
        !root.listMaterials().some((m) => m.getBaseColorTexture() === texture)
      ) {
        const bytes = await sharp(source)
          .webp({ lossless: true, effort: 6 })
          .toBuffer();
        if (bytes.length < source.length) {
          texture.setImage(bytes).setMimeType("image/webp");
          document.createExtension(EXTTextureWebP).setRequired(true);
        }
        continue;
      }
      const compressed = await page.evaluate(
        async ({ data, mime }) => {
          const bitmap = await createImageBitmap(
            new Blob([Uint8Array.from(atob(data), (c) => c.charCodeAt(0))], {
              type: mime,
            }),
          );
          const canvas = document.createElement("canvas");
          canvas.width = bitmap.width;
          canvas.height = bitmap.height;
          canvas.getContext("2d").drawImage(bitmap, 0, 0);
          bitmap.close();
          return canvas.toDataURL("image/webp", 0.98).split(",")[1];
        },
        {
          data: Buffer.from(source).toString("base64"),
          mime: texture.getMimeType(),
        },
      );
      const bytes = Buffer.from(compressed, "base64");
      if (bytes.length < source.length) {
        texture.setImage(bytes).setMimeType("image/webp");
        document.createExtension(EXTTextureWebP).setRequired(true);
      }
    }
    const prepared = await io.writeBinary(document);
    for (const lod of [false, true]) {
      const doc = await io.readBinary(prepared);
      await doc.transform(
        simplify({
          simplifier: MeshoptSimplifier,
          ratio: lod ? 0.24 : 0.8,
          error: lod ? 0.003 : 0.0004,
        }),
        meshopt({ encoder: MeshoptEncoder, level: "high" }),
      );
      const bytes = await io.writeBinary(doc),
        id = character + (lod ? "-lod" : "");
      await writeFile(
        new URL(`test-results/character-candidate/${id}.glb`, ROOT),
        bytes,
      );
      const out = await io.readBinary(bytes);
      const tris = out
        .getRoot()
        .listMeshes()
        .reduce(
          (n, m) =>
            n +
            m
              .listPrimitives()
              .reduce(
                (n, p) =>
                  n +
                  (p.getIndices()?.getCount() ||
                    p.getAttribute("POSITION").getCount()) /
                    3,
                0,
              ),
          0,
        );
      reports.push({
        id,
        bytes: bytes.length,
        triangles: tris,
        materials: out.getRoot().listMaterials().length,
        skins: out.getRoot().listSkins().length,
      });
    }
  }
  if (process.argv.includes("--install")) {
    const manifestURL = new URL("public/models/manifest.json", ROOT),
      manifest = JSON.parse(await readFile(manifestURL, "utf8"));
    for (const item of reports) {
      const bytes = await readFile(
        new URL(`test-results/character-candidate/${item.id}.glb`, ROOT),
      );
      const url = new URL(`public/models/${item.id}.glb`, ROOT),
        temp = new URL(`public/models/${item.id}.glb.next`, ROOT);
      await writeFile(temp, bytes);
      await rename(temp, url);
      Object.assign(
        manifest.models.find((m) => m.id === item.id),
        { bytes: item.bytes },
      );
    }
    manifest.characterSource =
      "Baked, skinned original reference characters; tools/character-study and tools/build-characters.js";
    await writeFile(manifestURL, JSON.stringify(manifest, null, 2) + "\n");
  }
  await writeFile(
    new URL("art/characters/build-report.json", ROOT),
    JSON.stringify({ rig: world, models: reports }, null, 2) + "\n",
  );
  console.log(JSON.stringify(reports, null, 2));
} finally {
  await browser.close();
}
