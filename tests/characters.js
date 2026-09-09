import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { createGameServer } from "../server/index.js";

// Separate ephemeral development server: this never opens or mutates a live room.
const server = await createGameServer();
await new Promise((resolve) => server.http.listen(0, "127.0.0.1", resolve));
const url = `http://127.0.0.1:${server.http.address().port}`;
const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
  args: ["--enable-webgl", "--ignore-gpu-blocklist"],
});
const candidateDirectory = process.env.CHARACTER_ASSET_DIR
  ? resolve(process.env.CHARACTER_ASSET_DIR)
  : null;
const output = candidateDirectory
  ? "test-results/characters-candidate"
  : "test-results/characters";
await mkdir(output, { recursive: true });
const report = {
  generatedAt: new Date().toISOString(),
  assetSource: candidateDirectory || "public/models (shipped assets)",
  assetHashes: {},
  rigs: [],
  benchmarks: [],
};
try {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 900 },
  });
  const errors = [],
    requestFailures = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("response", (response) => {
    if (response.status() >= 400)
      requestFailures.push(`${response.status()} ${response.url()}`);
  });
  if (candidateDirectory) {
    for (const id of ["soldier", "soldier-lod", "terrorist", "terrorist-lod"]) {
      const bytes = await readFile(resolve(candidateDirectory, `${id}.glb`));
      report.assetHashes[id] = createHash("sha256").update(bytes).digest("hex");
      await page.route(`**/models/${id}.glb`, (route) =>
        route.fulfill({ contentType: "model/gltf-binary", body: bytes }),
      );
    }
  }
  await page.goto(`${url}/tests/characters.html`);
  await page.waitForFunction(
    () => window.characterReady || window.characterError,
    {},
    { timeout: 120000 },
  );
  assert.equal(
    await page.evaluate(() => window.characterError),
    undefined,
    "Compiled character assets load successfully",
  );
  for (const team of ["soldiers", "terrorists"]) {
    for (const lowDetail of [false, true]) {
      const label = `${team} ${lowDetail ? "LOD" : "full"}`;
      const rig = await page.evaluate(
        (options) => window.auditCharacter(options),
        { team, lowDetail },
      );
      report.rigs.push(rig);
      await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2));
      assert.equal(
        rig.notReady,
        undefined,
        `${label}: ${rig.notReady || "new assets ready"}`,
      );
      const m = rig.metadata;
      assert.ok(
        m.skinnedMeshes > 0,
        `${label}: actual skinned meshes, not rigid-object animation`,
      );
      assert.ok(m.bones >= 14, `${label}: full character rig exists`);
      assert.deepEqual(
        m.missingJoints,
        [],
        `${label}: required rig and hand sockets preserved`,
      );
      assert.ok(
        m.vertices > 1000 && m.triangles > 500,
        `${label}: character geometry is nonempty`,
      );
      assert.ok(
        m.maxWeightError < 0.025,
        `${label}: normalized skin weights (${m.maxWeightError})`,
      );
      for (const key of [
        "invalidWeights",
        "invalidBoneIndices",
        "invalidVertices",
        "bonesOutsideRoot",
        "missingUV",
      ])
        assert.equal(m[key], 0, `${label}: ${key}`);
      assert.ok(m.texturedMeshes > 0, `${label}: textured skin is present`);
      for (const clip of ["idle", "walk", "run"])
        assert.ok(m.clips.includes(clip), `${label}: ${clip} clip`);
      assert.equal(
        rig.independence.independentSkeletons,
        true,
        `${label}: instances own independent skeletons`,
      );
      assert.equal(
        rig.independence.independentBones,
        true,
        `${label}: instances own independent bones`,
      );
      assert.equal(
        rig.independence.sharedGeometry,
        true,
        `${label}: immutable geometry remains shared`,
      );
      assert.ok(
        rig.independence.untouchedCloneDrift < 1e-7,
        `${label}: animating clone A must not move clone B`,
      );
      assert.ok(
        rig.independence.changedFirstClone > 0.05,
        `${label}: first clone actually animates during independence test`,
      );
      assert.equal(rig.poses.length, 19);
      const idle = rig.poses.find((pose) => pose.pose === "idle");
      for (const p of rig.poses) {
        const poseLabel = `${label} ${p.pose}`;
        assert.equal(
          p.finite,
          true,
          `${poseLabel}: finite world transforms and deformed bounds`,
        );
        assert.ok(
          p.maxQuaternionError < 0.002,
          `${poseLabel}: normalized rotations`,
        );
        assert.ok(
          p.maxExtent < 3.5,
          `${poseLabel}: no exploding skin (${p.maxExtent} m)`,
        );
        assert.ok(
          p.minBoundsY > -0.65,
          `${poseLabel}: character does not fall through the floor (${p.minBoundsY})`,
        );
        assert.ok(
          p.footVertices.every((n) => n > 0),
          `${poseLabel}: test observes actual ankle-weighted foot vertices`,
        );
        if (["idle", "crouch"].includes(p.pose)) {
          assert.ok(
            p.minSupportAlignment > 0.9,
            `${poseLabel}: support fingers face along the muzzle instead of twisting the wrist backward (${p.minSupportAlignment})`,
          );
          assert.equal(
            p.strain.flaggedEdges,
            0,
            `${poseLabel}: local skin tears (deformed edge >.05m and >10× bind length): ${JSON.stringify(p.strain.examples)}`,
          );
          assert.ok(
            p.minFootY >= -0.045,
            `${poseLabel}: soles do not sink (${p.minFootY})`,
          );
          assert.ok(
            p.maxFootY <= 0.12,
            `${poseLabel}: feet do not hover (${p.maxFootY})`,
          );
          assert.ok(
            p.maxSettledLegDrift <= 0.025,
            `${poseLabel}: settled leg rotations do not accumulate (${p.maxSettledLegDrift})`,
          );
        }
        if (!["death", "throw"].includes(p.pose))
          assert.ok(
            p.maxGripGap <= 0.09,
            `${poseLabel}: wrists stay on weapon grips (${p.maxGripGap} m)`,
          );
        if (p.pose !== "idle") {
          const difference = Math.max(
            ...p.jointPose.map((value, i) =>
              Math.abs(value - idle.jointPose[i]),
            ),
          );
          assert.ok(
            difference > 0.003,
            `${poseLabel}: requested pose visibly changes its rig`,
          );
        }
        await page.evaluate((options) => window.characterScreenshot(options), {
          team,
          lowDetail,
          pose: p.pose,
        });
        await page.screenshot({
          path: `${output}/${team}-${lowDetail ? "lod" : "full"}-${p.pose}.png`,
        });
      }
      const crouch = rig.poses.find((pose) => pose.pose === "crouch");
      assert.ok(
        crouch.bounds.max[1] < idle.bounds.max[1] - 0.2,
        `${label}: crouching materially lowers the silhouette`,
      );
      for (const back of [false, true]) {
        await page.evaluate((options) => window.characterScreenshot(options), {
          team,
          lowDetail,
          pose: "idle",
          back,
        });
        await page.screenshot({
          path: `${output}/${team}-${lowDetail ? "lod" : "full"}-${back ? "back" : "front"}.png`,
        });
      }
      console.log(
        `${label}: skin, textures, independent clones, 19 runtime poses, ground contact and grip alignment passed.`,
      );
    }
  }
  for (const team of ["soldiers", "terrorists"]) {
    const full = report.rigs.find((rig) => rig.team === team && !rig.lowDetail),
      lod = report.rigs.find((rig) => rig.team === team && rig.lowDetail);
    assert.ok(
      lod.metadata.triangles < full.metadata.triangles * 0.8,
      `${team}: LOD reduces character triangles materially`,
    );
  }
  report.disposal = await page.evaluate(() => window.characterDisposalCheck());
  for (const sample of report.disposal.samples) {
    assert.ok(
      sample.textures <= report.disposal.baseline.textures,
      "Repeated rendered player removal releases per-instance skeleton and label textures",
    );
    assert.ok(
      sample.geometries <= report.disposal.baseline.geometries,
      "Repeated rendered player removal does not grow geometry allocations",
    );
    assert.ok(
      sample.programs <= report.disposal.baseline.programs,
      "Repeated rendered player removal does not grow shader programs",
    );
  }
  console.log(
    "Rendered disposal regression: 72 player lifecycles leave stable GPU resource counts.",
  );
  if (process.env.CHARACTER_BENCHMARK !== "0") {
    for (const lowDetail of [false, true]) {
      const benchmark = await page.evaluate(
        (options) => window.characterBenchmark(options),
        { lowDetail },
      );
      report.benchmarks.push(benchmark);
      console.log("Nine-character render benchmark:", benchmark);
      assert.equal(
        benchmark.samples,
        150,
        "Bounded benchmark completes its sample window",
      );
      assert.equal(
        benchmark.renderedCharacters,
        9,
        "All nine animated character skins are actually submitted to the camera",
      );
      assert.ok(
        Number.isFinite(benchmark.medianFrameMs),
        "Benchmark produces finite timing",
      );
      if (process.env.REQUIRE_CHARACTER_60FPS === "1")
        assert.equal(
          benchmark.met60FpsTarget,
          true,
          "60 FPS target (median ≤18 ms; p95 ≤25 ms) on this hardware",
        );
    }
  }
  assert.deepEqual(errors, [], "No browser runtime errors");
  assert.deepEqual(requestFailures, [], "No failed asset requests");
  report.passed = true;
  console.log(
    "Compiled character verification passed. Character-only timing is not a multiplayer or complete-map performance certification.",
  );
} catch (error) {
  report.passed = false;
  report.failure = error.stack || error.message;
  throw error;
} finally {
  await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2));
  await browser.close();
  await server.close();
}
