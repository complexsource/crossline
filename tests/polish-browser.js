import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { createGameServer } from "../server/index.js";

const prod = await createGameServer({ production: true });
const dev = await createGameServer();
for (const server of [prod, dev])
  await new Promise((resolve) => server.http.listen(0, "127.0.0.1", resolve));
const origin = (server) => `http://127.0.0.1:${server.http.address().port}`;
const browser = await chromium.launch({ channel: "chrome", headless: true });
const errors = [],
  report = {};
await mkdir("test-results/polish", { recursive: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
  });
  page.on("pageerror", (e) => errors.push(e.message));
  const external = [];
  page.on("request", (r) => {
    if (!r.url().startsWith(origin(prod))) external.push(r.url());
  });
  let release;
  const gate = new Promise((resolve) => (release = resolve));
  await page.route("**/assets/*.css", async (route) => {
    await gate;
    await route.continue();
  });
  await page.goto(origin(prod), { waitUntil: "commit" });
  await page.locator("#boot-screen").waitFor();
  await page.waitForTimeout(250);
  assert.equal(
    await page
      .locator("#app")
      .evaluate((el) => getComputedStyle(el).visibility),
    "hidden",
  );
  assert.equal(
    await page
      .locator("#boot-screen")
      .evaluate((el) => getComputedStyle(el).position),
    "fixed",
  );
  await page.screenshot({ path: "test-results/polish/cold-loader.png" });
  await page.emulateMedia({ reducedMotion: "reduce" });
  assert.equal(
    await page
      .locator(".boot-orbit")
      .evaluate((el) => getComputedStyle(el, "::before").animationName),
    "none",
  );
  release();
  await page.waitForSelector("html:not(.booting)");
  await page.waitForSelector("#boot-screen", { state: "detached" });
  assert.deepEqual(
    external,
    [],
    "no font CDN or other third-party boot requests",
  );
  assert.ok(await page.locator("#create").isVisible());
  report.loading =
    "CSS-delayed cold boot hides unstyled app, reduced motion, local fonts and successful reveal";
  const failed = await browser.newPage();
  await failed.route("**/assets/*.css", (route) => route.abort());
  await failed.goto(`${origin(prod)}/?room=ABC123`, {
    waitUntil: "domcontentloaded",
  });
  await failed.locator("#boot-retry").waitFor({ state: "visible" });
  assert.equal(
    await failed
      .locator("#app")
      .evaluate((el) => getComputedStyle(el).visibility),
    "hidden",
  );
  assert.ok(
    (await failed.locator("#boot-retry").getAttribute("href")).endsWith(
      "?room=ABC123",
    ),
  );
  await failed.close();
  await page.close();

  const view = await browser.newPage({
    viewport: { width: 1440, height: 900 },
  });
  view.on("pageerror", (e) => errors.push(e.message));
  // Reproduce a valid remote weapon arriving before its lazy-loaded GLB.
  await view.route("**/models/manifest.json", async (route) => {
    const response = await route.fetch(),
      manifest = await response.json();
    manifest.models = manifest.models.filter((m) => m.id !== "awp");
    await route.fulfill({ response, json: manifest });
  });
  await view.goto(`${origin(dev)}/tests/visual.html`);
  await view.waitForFunction(() => window.ready, {}, { timeout: 90000 });
  report.lazyWeapon = await view.evaluate(async () => {
    await window.sample({ mode: "map", quality: "low" });
    const r = window.graphics;
    const local = {
      x: -40,
      y: 0,
      z: 2,
      vx: 0,
      vy: 0,
      vz: 0,
      yaw: 0,
      pitch: 0,
      grounded: true,
      crouch: false,
      stance: 0,
      hp: 100,
      spawnId: 1,
      weapon: "m4a4",
      team: "soldiers",
      reload: 0,
      action: "idle",
      actionTime: 0,
    };
    window.polishLocal = local;
    const enemy = {
      ...local,
      id: "scope-target",
      name: "TARGET",
      weapon: "awp",
      team: "terrorists",
      z: -30,
      yaw: Math.PI,
    };
    window.polishState = {
      players: [enemy],
      grenades: [],
      smokes: [],
      drops: [],
    };
    r.camera.position.set(local.x, 1.62, local.z);
    r.sync(window.polishState, "local");
    for (let i = 0; i < 4; i++) r.render(1 / 60, local, true, false);
    return {
      missing: !r.players.get(enemy.id).userData.gun,
      glError: r.renderer.getContext().getError(),
    };
  });
  assert.equal(report.lazyWeapon.missing, true);
  assert.equal(report.lazyWeapon.glError, 0);
  await view.unroute("**/models/manifest.json");
  await view.evaluate(async () => {
    const { loadAssets } = await import("/src/assets.js");
    await loadAssets(() => {}, { ids: ["awp"] });
  });
  report.aim = await view.evaluate(async () => {
    const { WEAPONS } = await import("/shared/weapons.js"),
      r = window.graphics,
      p = window.polishLocal,
      results = [];
    for (const [id, w] of Object.entries(WEAPONS)) {
      p.weapon = id;
      for (let i = 0; i < 45; i++) {
        r.render(1 / 60, p, true, true);
        if (i % 3 === 0) r.sync(window.polishState, "local");
      }
      let finite = r.camera.projectionMatrix.elements.every(Number.isFinite);
      r.gun.traverse((o) => {
        finite &&= o.matrixWorld.elements.every(Number.isFinite);
      });
      results.push({
        id,
        fov: r.camera.fov,
        expected: w.aimFov || 78,
        finite,
        gunVisible: r.gun.visible,
        targetLow: r.players.get("scope-target").userData.lowDetail,
      });
    }
    return results;
  });
  for (const item of report.aim) {
    assert.ok(item.finite, item.id);
    assert.ok(Math.abs(item.fov - item.expected) < 0.1, item.id);
    if (["aug", "sg553", "ssg08", "awp", "g3sg1", "scar20"].includes(item.id)) {
      assert.equal(
        item.gunVisible,
        false,
        `${item.id} scope not blocked by gun mesh`,
      );
      assert.equal(
        item.targetLow,
        false,
        `${item.id} scoped target retains high detail at 32m`,
      );
    }
  }
  report.throws = [];
  for (const weapon of ["he", "flash", "smoke"]) {
    await view.evaluate((weapon) => {
      const r = window.graphics,
        p = window.polishLocal;
      p.weapon = weapon;
      r.throwUntil = 0;
      for (let i = 0; i < 30; i++) r.render(1 / 60, p, true, false);
      r.fx({ type: "throw", id: "local", weapon }, "local");
    }, weapon);
    for (const beat of ["pin", "release", "follow-through"]) {
      const result = await view.evaluate((beat) => {
        const r = window.graphics,
          p = window.polishLocal;
        for (let i = 0; i < (beat === "pin" ? 10 : 14); i++)
          r.render(1 / 60, p, true, false);
        let finite = true;
        r.gun.traverse((o) => {
          finite &&= o.matrixWorld.elements.every(Number.isFinite);
        });
        return {
          finite,
          payloadVisible: r.gun.userData.payloadMeshes.some((m) => m.visible),
          hands: r.gun.userData.viewHands.every(({ hand }) => hand.visible),
        };
      }, beat);
      assert.equal(result.finite, true);
      assert.equal(result.hands, true);
      assert.equal(result.payloadVisible, beat === "pin");
      await view.screenshot({
        path: `test-results/polish/${weapon}-${beat}.png`,
      });
      report.throws.push({ weapon, beat, ...result });
    }
  }
  report.effects = await view.evaluate(() => {
    const r = window.graphics,
      p = window.polishLocal;
    p.weapon = "m4a4";
    for (let i = 0; i < 30; i++)
      r.fx(
        { type: i % 2 ? "explosion" : "flashbang", x: p.x, y: 1, z: p.z - 4 },
        "local",
      );
    const count = r.effects.length,
      budget = r.settings.particles;
    for (let i = 0; i < 800; i++) r.render(1 / 60, p, true, false);
    return {
      count,
      budget,
      remaining: r.effects.length,
      glError: r.renderer.getContext().getError(),
    };
  });
  assert.ok(report.effects.count <= report.effects.budget);
  assert.equal(report.effects.remaining, 0);
  assert.equal(report.effects.glError, 0);
  assert.deepEqual(errors, []);
  await writeFile(
    "test-results/polish/report.json",
    JSON.stringify(report, null, 2),
  );
  console.log(
    "Polish browser checks passed: delayed/failed boot, local fonts, 39 finite ADS renders, six zoom-aware scopes, missing remote GLB, all grenade release beats, bounded effects; no page/WebGL errors.",
  );
} finally {
  await browser.close();
  await prod.close();
  await dev.close();
}
