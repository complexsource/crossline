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
  args: ["--enable-webgl", "--ignore-gpu-blocklist"],
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
  for (const name of ["coastline", "soldier", "terrorist"]) {
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
  for (const weapon of process.env.ALL_WEAPONS
    ? FIREARMS
    : ["ak47", "m4a4", "awp", "p90", "glock18", "bomb"]) {
    console.log(
      weapon,
      await page.evaluate(
        (weapon) => window.sample({ mode: "weapon", weapon }),
        weapon,
      ),
    );
    await page.screenshot({ path: `test-results/weapon-${weapon}.png` });
  }
  const animation = await page.evaluate(() => window.animationCheck());
  assert.ok(animation.crouch < -0.45);
  assert.ok(animation.mag < 0);
  assert.equal(animation.death, 1);
  const benchmarks = [];
  if (process.env.BENCHMARK)
    for (const q of ["medium", "high"]) {
      const result = await page.evaluate((q) => window.benchmark(q), q);
      benchmarks.push(result);
      console.log("Nine-player render sample:", result);
    }
  if (benchmarks.length)
    await writeFile(
      "test-results/benchmark.json",
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
