import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { createGameServer } from "../server/index.js";
import { FIREARMS } from "../shared/weapons.js";
const server = await createGameServer();
await new Promise((resolve) => server.http.listen(0, "127.0.0.1", resolve));
const url = `http://127.0.0.1:${server.http.address().port}`;
const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
  args: [
    "--enable-webgl",
    "--ignore-gpu-blocklist",
    ...(process.env.UNCAPPED_BENCHMARK === "1"
      ? ["--disable-frame-rate-limit"]
      : []),
  ],
});
await mkdir("test-results", { recursive: true });
await mkdir("public/previews", { recursive: true });
try {
  const page = await browser.newPage({
      viewport: { width: 1440, height: 900 },
    }),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("response", (r) => {
    if (r.status() >= 400) console.log("Failed request", r.status(), r.url());
  });
  await page.goto(`${url}/tests/visual.html`);
  await page.waitForFunction(() => window.ready, {}, { timeout: 90000 });
  for (const name of ["coastline", "coastline-hero", "soldier", "terrorist"]) {
    const data = await page.evaluate((name) => window.preview(name), name);
    await writeFile(
      `public/previews/${name}.webp`,
      Buffer.from(data.split(",")[1], "base64"),
    );
    await page.screenshot({ path: `test-results/${name}.png` });
  }
  for (const site of ["mid", "a", "b", "market", "water", "roof"]) {
    console.log(
      site,
      await page.evaluate((site) => window.sample({ site }), site),
    );
    await page.screenshot({ path: `test-results/coastline-${site}.png` });
  }
  for (const weapon of [
    ...(process.env.ALL_WEAPONS
      ? FIREARMS
      : ["ak47", "m4a4", "awp", "p90", "glock18"]),
    "knife",
    "he",
    "flash",
    "smoke",
    "bomb",
  ]) {
    console.log(
      weapon,
      await page.evaluate(
        (weapon) => window.sample({ mode: "weapon", weapon }),
        weapon,
      ),
    );
    await page.screenshot({ path: `test-results/weapon-${weapon}.png` });
  }
  for (const team of ["soldiers", "terrorists"]) {
    for (const pose of ["hold", "crouch"]) {
      await page.evaluate(
        ({ team, pose }) =>
          window.sample({
            mode: "character",
            team,
            pose,
            weapon: team === "soldiers" ? "m4a4" : "ak47",
          }),
        { team, pose },
      );
      await page.screenshot({ path: `test-results/${team}-${pose}.png` });
    }
  }
  for (const weapon of ["m4a4", "ak47", "glock18", "he", "bomb"]) {
    console.log(
      "first-person",
      weapon,
      await page.evaluate((weapon) => window.firstPerson(weapon), weapon),
    );
    await page.screenshot({ path: `test-results/first-person-${weapon}.png` });
  }
  const animation = await page.evaluate(() => window.animationCheck());
  assert.ok(animation.crouch < -0.45);
  assert.ok(animation.mag < 0);
  assert.equal(animation.death, 1);
  assert.equal(animation.idleCrouch.length, 4);
  for (const pose of animation.idleCrouch) {
    const label = `${pose.team} ${pose.lowDetail ? "LOD" : "full rig"}`;
    assert.deepEqual(
      pose.missing,
      [],
      `${label}: required animated joints survive GLB export`,
    );
    assert.equal(
      pose.finite,
      true,
      `${label}: joint transforms remain finite after 120 idle crouch frames`,
    );
    assert.ok(
      pose.maxRotation <= Math.PI + 0.001,
      `${label}: rotations must not accumulate between frames (${pose.maxRotation})`,
    );
    assert.ok(
      pose.maxPosition < 2.5,
      `${label}: local joint positions stay bounded (${pose.maxPosition})`,
    );
    assert.ok(
      pose.maxQuaternionError < 0.001,
      `${label}: rotation quaternions stay normalized`,
    );
    assert.ok(
      pose.maxLegDrift < 0.025,
      `${label}: settled idle crouch must not drift (${pose.maxLegDrift})`,
    );
    assert.ok(
      pose.bodyY < -0.45 && pose.bodyY > -0.54,
      `${label}: crouch reaches the intended height (${pose.bodyY})`,
    );
    assert.ok(
      pose.minFootY > -0.025,
      `${label}: boot soles must not sink through the floor (${pose.minFootY})`,
    );
    assert.ok(
      pose.maxFootY < 0.09,
      `${label}: boot soles stay close to the floor (${pose.maxFootY})`,
    );
    assert.ok(
      pose.maxFootTilt < 0.015,
      `${label}: ankles keep boots level while crouched (${pose.maxFootTilt})`,
    );
    assert.ok(
      Math.abs(pose.standingBodyY) < 0.02,
      `${label}: releasing crouch restores standing height`,
    );
    assert.ok(
      pose.standingFootY.every((y) => y > -0.025 && y < 0.12),
      `${label}: boots recover valid standing contact`,
    );
  }
  console.log(
    "Animation regression: both teams and LOD rigs hold a stable, grounded idle crouch and return to standing.",
  );
  const grenadePresentation = await page.evaluate(() =>
    window.grenadePresentationCheck(),
  );
  assert.equal(
    grenadePresentation.grenadeThroughRifleSnapshot,
    "he",
    "throw animation keeps its grenade when the server has already re-equipped a rifle",
  );
  assert.equal(
    grenadePresentation.boundSpawn,
    4,
    "throw presentation binds to the current spawn",
  );
  for (const key of ["expired", "dead", "respawn", "caughtUp", "shotExpired"])
    assert.equal(
      grenadePresentation[key],
      true,
      `grenade presentation clears correctly: ${key}`,
    );
  assert.equal(
    grenadePresentation.shotBridge,
    "m4a4",
    "firing event keeps the rifle visible until the delayed snapshot catches up",
  );
  assert.equal(
    grenadePresentation.snapshotUnchanged,
    true,
    "presentation never mutates authoritative player snapshots",
  );
  assert.equal(
    grenadePresentation.localCancelled,
    true,
    "local rifle shot cancels a remaining grenade flourish",
  );
  assert.equal(
    grenadePresentation.localFlash,
    true,
    "rifle flash/recoil still plays after flourish cancellation",
  );
  assert.deepEqual(
    grenadePresentation.equips,
    [["m4a4", "terrorists"]],
    "flourish cancellation equips the actual firing weapon with the correct team arms",
  );
  console.log(
    "Grenade presentation regression: throw/shot event bridges, lifecycle cleanup and local flourish cancellation pass.",
  );
  const benchmarks = [];
  if (process.env.BENCHMARK)
    for (const q of ["medium", "high"]) {
      const result = await page.evaluate((q) => window.benchmark(q), q);
      result.framePacing =
        process.env.UNCAPPED_BENCHMARK === "1"
          ? "uncapped diagnostic"
          : "browser default";
      benchmarks.push(result);
      console.log("Nine-player render sample:", result);
    }
  if (benchmarks.length)
    await writeFile(
      process.env.UNCAPPED_BENCHMARK === "1"
        ? "test-results/benchmark-uncapped.json"
        : "test-results/benchmark.json",
      JSON.stringify(benchmarks, null, 2),
    );
  assert.deepEqual(errors, []);
  console.log(
    "V2 visual harness: compiled GLB loading, six map perspectives, weapon samples and animation checks passed.",
  );
} finally {
  await browser.close();
  await server.close();
}
