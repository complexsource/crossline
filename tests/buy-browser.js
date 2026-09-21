import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { createGameServer } from "../server/index.js";
import { BUY_CATEGORIES, BUY_ITEMS } from "../shared/buy.js";
import { WEAPONS } from "../shared/weapons.js";

// Production UI, isolated rooms, real Chrome. A controllable server clock makes
// catalog/layout checks deterministic without changing the shipping 20/10 rules.
const server = await createGameServer({ production: true, countdown: 0.1 });
await new Promise((resolve) => server.http.listen(0, "127.0.0.1", resolve));
const url = `http://127.0.0.1:${server.http.address().port}`;
const browser = await chromium.launch({ channel: "chrome", headless: true });
const errors = [],
  models = [],
  remoteModels = [];
let a, b;
await mkdir("test-results", { recursive: true });
try {
  a = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  b = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  for (const p of [a, b]) {
    p.setDefaultTimeout(15000);
    p.on("pageerror", (e) => errors.push(e.message));
    p.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    await p.addInitScript(() =>
      localStorage.setItem(
        "crossline-v2-settings",
        JSON.stringify({ hideGuide: true, quality: "low" }),
      ),
    );
  }
  a.on("request", (r) => {
    if (r.url().endsWith(".glb")) models.push(r.url());
  });
  b.on("requestfinished", (r) => {
    if (r.url().endsWith(".glb")) remoteModels.push(r.url());
  });
  await a.goto(url, { waitUntil: "domcontentloaded" });
  await a.locator("#name").fill("Armory host");
  await a.locator("#create").click();
  await a.locator("#confirm-create").click();
  const code = (await a.locator("#copy").innerText()).slice(0, 6);
  assert.equal(await a.locator("#primary, #secondary").count(), 0);
  assert.equal(models.length, 0, "home and room remain lightweight");
  await b.goto(`${url}/?room=${code}`, { waitUntil: "domcontentloaded" });
  await b.locator("#name").fill("Armory peer");
  await b.locator("#join").click();
  await a.locator("#ready").click();
  await b.locator("#ready").click();
  await a.locator("#start").click();
  await a.locator("#enter").waitFor({ timeout: 90000 });
  await b.locator("#enter").waitFor({ timeout: 90000 });
  const room = server.game.rooms.get(code),
    pa = [...room.players.values()].find((p) => p.name === "Armory host"),
    pb = [...room.players.values()].find((p) => p.name === "Armory peer");
  let time = server.game.now();
  server.game.now = () => time;
  assert.ok(pa.buyUntil - time > 10 && pa.buyUntil - time <= 20);
  assert.equal(room.endsAt - room.buyEndsAt, 600);
  await expect(a.locator("#timer")).toHaveText("10:00");
  assert.ok(
    !models.some((x) => x.endsWith("/awp.glb")),
    "unused sniper is not preloaded",
  );
  await a.locator("#enter").click();
  await a.waitForFunction(() => !!document.pointerLockElement);
  const origin = { x: pa.x, z: pa.z },
    mag = pa.ammo[pa.weapon].mag;
  await a.keyboard.down("KeyW");
  await a.mouse.down();
  await a.waitForTimeout(250);
  await a.keyboard.press("KeyB");
  await expect(a.locator("#buy-menu")).toBeVisible();
  await a.keyboard.up("KeyW");
  await a.mouse.up();
  assert.equal(pa.x, origin.x);
  assert.equal(pa.z, origin.z);
  assert.equal(pa.ammo[pa.weapon].mag, mag);
  assert.equal(await a.evaluate(() => !!document.pointerLockElement), false);
  await expect(a.locator("#buy-safety")).toContainText("protected");
  const seen = [];
  for (const category of BUY_CATEGORIES) {
    await a.locator(`[data-buy-tab="${category.id}"]`).click();
    const cards = a.locator(".buy-card");
    assert.equal(
      await cards.count(),
      BUY_ITEMS.filter((i) => i.category === category.id).length,
    );
    for (const card of await cards.all()) {
      await card.scrollIntoViewIfNeeded();
      await expect(card.locator("img")).toHaveJSProperty("naturalWidth", 640);
      seen.push(await card.getAttribute("data-item"));
      const box = await card.boundingBox(),
        button = await card.locator("button").boundingBox();
      assert.ok(
        button.x >= box.x && button.x + button.width <= box.x + box.width + 1,
        "button aligns inside card",
      );
    }
  }
  assert.deepEqual(seen.sort(), BUY_ITEMS.map((i) => i.id).sort());
  await expect(a.locator('[data-buy="bomb"]')).toBeDisabled();
  await a.locator('[data-buy-tab="RIFLE"]').click();
  await expect(a.locator('[data-buy-tab="RIFLE"]')).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await a.waitForTimeout(180);
  await a.screenshot({ path: "test-results/buy-desktop.png" });
  for (const [width, height] of [
    [1280, 720],
    [1024, 768],
    [768, 900],
    [390, 844],
    [320, 640],
  ]) {
    await a.setViewportSize({ width, height });
    const layout = await a.locator("#buy-menu").evaluate((el) => {
      const r = el.getBoundingClientRect();
      return {
        left: r.left,
        right: r.right,
        top: r.top,
        bottom: r.bottom,
        width: innerWidth,
        height: innerHeight,
        overflow: el.scrollWidth - el.clientWidth,
      };
    });
    assert.ok(
      layout.left >= 0 &&
        layout.right <= width + 1 &&
        layout.top >= 0 &&
        layout.bottom <= height + 1,
      JSON.stringify(layout),
    );
    assert.ok(
      layout.overflow <= 1,
      `no outer horizontal overflow: ${JSON.stringify(layout)} ${JSON.stringify(await a.locator(".buy-shell, .buy-header, .buy-tabs, .buy-layout, .buy-footer").evaluateAll((els) => els.map((el) => ({ name: el.className, width: el.getBoundingClientRect().width, left: el.getBoundingClientRect().left, scroll: el.scrollWidth, client: el.clientWidth }))))}`,
    );
    if (width === 390)
      await a.screenshot({ path: "test-results/buy-narrow.png" });
  }
  await a.setViewportSize({ width: 1440, height: 900 });
  // Real on-demand purchases and remote streaming without another load screen.
  await a.locator('[data-buy-tab="SNIPER"]').click();
  time += 0.3;
  await a.locator('[data-buy="awp"]').click();
  await expect(a.locator("#weapon-name")).toHaveText("AWP");
  assert.equal(pa.slots.primary, "awp");
  await expect
    .poll(() => remoteModels.some((x) => x.endsWith("/awp.glb")))
    .toBe(true);
  await a.locator('[data-buy-tab="PISTOL"]').click();
  time += 0.3;
  await a.locator('[data-buy="deagle"]').click();
  await expect(a.locator("#weapon-name")).toHaveText("DESERT EAGLE");
  assert.equal(pa.slots.secondary, "deagle");
  await a.locator('[data-buy-tab="PISTOL"]').focus();
  await a.keyboard.press("ArrowRight");
  await expect(a.locator('[data-buy-tab="GRENADE"]')).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await a.keyboard.press("Escape");
  await expect(a.locator("#buy-menu")).toHaveCount(0);
  await expect(a.locator("#enter")).toBeVisible();
  await a.keyboard.press("KeyB");
  await expect(a.locator("#buy-menu")).toBeVisible();
  await a.keyboard.press("KeyB");
  await expect(a.locator("#buy-menu")).toHaveCount(0);
  await a.waitForFunction(() => !!document.pointerLockElement);
  await a.keyboard.press("KeyB");
  // Exact expiry closes the menu. Neither pointer lock nor firing is forced.
  time = room.buyEndsAt + 0.01;
  server.game.snapshot(room);
  await expect(a.locator("#buy-menu")).toHaveCount(0);
  await a.keyboard.press("KeyB");
  await expect(a.locator("#buy-menu")).toHaveCount(0);
  assert.throws(
    () =>
      server.game.buy(pa.id, {
        itemId: "negev",
        spawnId: pa.spawnId,
        epoch: room.loadEpoch,
      }),
    /ended/,
  );
  console.log(
    "Passed: all 39 cards, responsive armory, input isolation, opening phase, real purchases and remote downloads.",
  );
  // Death -> default kit -> ten-second window -> one-click previous loadout.
  pa.protectedUntil = 0;
  server.game.damage(room, pa, 1000, pb, "ak47");
  server.game.snapshot(room);
  await expect(a.locator("#death")).toBeVisible();
  time += 3.1;
  server.game.tick();
  server.game.snapshot(room);
  await expect(a.locator("#health")).toHaveText("100");
  assert.ok(Math.abs(pa.buyUntil - time - 10) < 1e-8);
  await a.keyboard.press("KeyB");
  await expect(a.locator("#buy-menu")).toBeVisible();
  await expect(a.locator("#buy-safety")).toContainText("MATCH IS LIVE");
  await a.locator("#buy-previous").click();
  await expect(a.locator("#weapon-name")).toHaveText("AWP");
  assert.equal(pa.slots.secondary, "deagle");
  time += 2;
  server.game.damage(room, pa, 10, pb, "ak47");
  server.game.snapshot(room);
  await expect(a.locator("#health")).toHaveText("90");
  assert.ok(pa.buyUntil > time, "shopping does not extend protection");
  // Delayed model completes after the life/window changes: it must not buy.
  let releaseDownload;
  const blocked = new Promise((resolve) => (releaseDownload = resolve));
  await a.route("**/negev.glb", async (route) => {
    await blocked;
    await route.continue();
  });
  await a.locator('[data-buy-tab="HEAVY"]').click();
  await a.locator('[data-buy="negev"]').click();
  await expect(a.locator("#buy-status")).toContainText("Preparing");
  const current = pa.weapon;
  time = pa.buyUntil + 0.1;
  server.game.snapshot(room);
  await expect(a.locator("#buy-menu")).toHaveCount(0);
  releaseDownload();
  await a.waitForTimeout(800);
  assert.equal(pa.weapon, current);
  await a.unroute("**/negev.glb");
  // An unavailable model leaves the current kit/world alive and can be retried.
  server.game.spawn(room, pa);
  server.game.snapshot(room);
  await expect(a.locator("#health")).toHaveText("100");
  await a.keyboard.press("KeyB");
  await expect(a.locator("#buy-menu")).toBeVisible();
  await a.locator('[data-buy-tab="SMG"]').click();
  const beforeFailure = errors.length,
    defaultWeapon = pa.weapon;
  await a.route("**/p90.glb", (route) =>
    route.fulfill({ status: 503, body: "Intentional test asset failure" }),
  );
  await a.locator('[data-buy="p90"]').click();
  await expect(a.locator("#buy-status")).toContainText(
    "Could not prepare equipment",
  );
  assert.equal(pa.weapon, defaultWeapon);
  const expectedErrors = errors.splice(beforeFailure);
  assert.ok(
    expectedErrors.every((e) => /503|Service Unavailable/.test(e)),
    expectedErrors.join("\n"),
  );
  await a.unroute("**/p90.glb");
  time += 0.3;
  await a.locator('[data-buy="p90"]').click();
  await expect(a.locator("#weapon-name")).toHaveText("P90");
  assert.equal(await a.locator(".graphics-recovery").count(), 0);
  // Every optic uses the actual production Buy Menu, input bindings and HUD.
  Object.assign(pa, { x: -40, y: 0, z: 2, yaw: 0, pitch: 0, vx: 0, vz: 0 });
  Object.assign(pb, {
    x: -40,
    y: 0,
    z: -10,
    yaw: Math.PI,
    pitch: 0,
    vx: 0,
    vz: 0,
  });
  for (const [id, w] of Object.entries(WEAPONS).filter(([, w]) => w.scoped)) {
    console.log("Checking production scope", id);
    await a.locator(`[data-buy-tab="${w.type}"]`).click();
    time += 0.3;
    await a.locator(`[data-buy="${id}"]`).click();
    await expect(a.locator("#weapon-name")).toHaveText(w.name.toUpperCase());
    time += 0.3;
    server.game.tick();
    server.game.snapshot(room);
    // Chrome rate-limits native capture requests within a two-second window.
    // Exercise real capture without racing that browser security restriction.
    await a.waitForTimeout(2100);
    await a.locator("#buy-resume").click();
    await a.waitForFunction(
      () =>
        !!document.pointerLockElement &&
        document.querySelector("#pause").style.display === "none",
    );
    await a.waitForTimeout(150);
    await a.mouse.down({ button: "right" });
    await a.waitForTimeout(200);
    await expect(a.locator("#scope")).toHaveClass(
      w.type === "SNIPER" ? "visible" : "optic visible",
    );
    await a.waitForTimeout(300);
    await a.screenshot({ path: `test-results/scope-${id}.png` });
    await a.mouse.up({ button: "right" });
    await expect(a.locator("#scope")).not.toHaveClass(/visible/);
    await a.keyboard.press("KeyB");
    await expect(a.locator("#buy-menu")).toBeVisible();
  }
  console.log(
    "All six scopes: production purchase, pointer-lock aim, correct HUD reticle and release passed.",
  );
  // Finish/replay retains room, gives a new 20-second preparation phase.
  server.game.finish(room);
  await a.locator("#again").click();
  await expect.poll(() => room.state).toBe("countdown");
  time += 0.2;
  server.game.tick();
  await a.locator("#enter").waitFor();
  assert.ok(Math.abs(room.buyEndsAt - time - 20) < 1e-8);
  assert.equal(room.code, code);
  assert.equal(room.players.size, 2);
  server.game.finish(room);
  await a.locator("#back").click();
  await a.locator("#copy").waitFor();
  assert.equal(await a.locator("#primary, #secondary").count(), 0);
  assert.deepEqual(errors, []);
  console.log(
    "Buy-menu E2E passed: 20/10 windows, safe defaults, previous kit, live-combat vulnerability, stale-download rejection, replay and room continuity. No browser errors.",
  );
} catch (error) {
  await a?.screenshot({ path: "test-results/buy-failure.png" }).catch(() => {});
  console.log("Browser errors:", errors);
  throw error;
} finally {
  await browser.close();
  await server.close();
}
