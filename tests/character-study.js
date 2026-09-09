import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { chromium } from "@playwright/test";
import { createGameServer } from "../server/index.js";

// This isolated viewer test never installs the study or enters a live game room.
const asset = await readFile(
  new URL("../art/character-study/soldier-study.glb", import.meta.url),
);
assert.equal(
  asset.readUInt32LE(0),
  0x46546c67,
  "The study must be a real binary glTF asset",
);
assert.equal(asset.readUInt32LE(4), 2, "Expected glTF 2");
assert.equal(
  asset.readUInt32LE(8),
  asset.length,
  "GLB length matches its header",
);
const directory = new URL("../test-results/character-study/", import.meta.url);
await mkdir(directory, { recursive: true });
const server = await createGameServer();
let browser;
try {
  await new Promise((resolve) => server.http.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${server.http.address().port}`;
  browser = await chromium.launch({
    channel: "chrome",
    headless: true,
    args: ["--enable-webgl", "--ignore-gpu-blocklist"],
  });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  const modelResponse = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname ===
        "/art/character-study/soldier-study.glb" && response.ok(),
  );
  await page.goto(`${origin}/tools/character-study/viewer.html`);
  await page.waitForFunction(() => window.ready || window.studyError, null, {
    timeout: 90000,
  });
  assert.equal(
    await page.evaluate(() => window.studyError),
    null,
    "Study loaded successfully",
  );
  assert.equal(await page.evaluate(() => window.ready), true);
  assert.deepEqual(
    await (await modelResponse).body(),
    asset,
    "The inspected browser asset matches the reported file (rerun if a rebuild occurred during this check)",
  );
  const stats = await page.evaluate(() => window.modelStats);
  assert.equal(stats.finite, true);
  assert.ok(stats.meshes > 0 && stats.triangles > 0 && stats.vertices > 0);
  assert.ok(
    stats.bounds.size.every((number) => Number.isFinite(number) && number > 0),
  );
  assert.ok(
    stats.bounds.size[1] > 1 && stats.bounds.size[1] < 5,
    "Study is plausibly metre-scaled, not an accidental unit conversion",
  );
  assert.ok(stats.render.calls > 0 && stats.render.triangles > 0);
  await page
    .getByText("Unrigged preview · not installed in multiplayer", {
      exact: false,
    })
    .waitFor();
  for (const view of ["front", "three-quarter", "face"]) {
    const camera = await page.evaluate((name) => window.view(name), view);
    assert.equal(camera.view, view);
    assert.ok([...camera.position, ...camera.target].every(Number.isFinite));
    assert.equal(
      await page.locator(`[data-view="${view}"]`).getAttribute("aria-pressed"),
      "true",
      "Camera button reflects the active preset",
    );
    await page.evaluate(
      () =>
        new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve)),
        ),
    );
    await page.screenshot({
      path: new URL(`${view}.png`, directory).pathname,
      animations: "disabled",
    });
  }
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  assert.equal(
    await page
      .getByRole("button", { name: "Three-quarter", exact: true })
      .getAttribute("aria-pressed"),
    "true",
  );
  await page.getByRole("button", { name: "Front", exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
    "No horizontal overflow on a narrow viewport",
  );
  await page.screenshot({
    path: new URL("mobile.png", directory).pathname,
    animations: "disabled",
  });
  assert.deepEqual(errors, [], "No browser or shader errors");
  assert.equal(server.game.rooms.size, 0, "Art inspection creates no rooms");

  // A missing asset must never show a success state or enable camera buttons.
  const failedPage = await browser.newPage();
  await failedPage.route("**/art/character-study/soldier-study.glb", (route) =>
    route.fulfill({ status: 404, body: "Study missing" }),
  );
  await failedPage.goto(`${origin}/tools/character-study/viewer.html`);
  await failedPage.waitForFunction(() => window.studyError, null, {
    timeout: 30000,
  });
  assert.equal(await failedPage.evaluate(() => window.ready), false);
  assert.equal(
    await failedPage
      .getByRole("button", { name: "Front", exact: true })
      .isDisabled(),
    true,
  );
  await failedPage.getByRole("alert").waitFor();
  const report = {
    assetBytes: asset.length,
    sha256: createHash("sha256").update(asset).digest("hex"),
    ...stats,
    note: "Unoptimized, unrigged art study. These are reported counts, not an in-game performance certification.",
  };
  await writeFile(
    new URL("stats.json", directory),
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(
    "Character study viewer verified:",
    JSON.stringify(report, null, 2),
  );
} finally {
  await browser?.close();
  await server.close();
}
