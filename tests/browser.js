import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { createGameServer } from "../server/index.js";
import { emptyInput } from "../shared/game.js";

// Independent production server: never alter a user's live room.
const server = await createGameServer({
  production: true,
  countdown: 0.3,
  openingBuySeconds: 0,
});
await new Promise((resolve) => server.http.listen(0, "127.0.0.1", resolve));
const url = `http://127.0.0.1:${server.http.address().port}`;
const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
  args: ["--enable-webgl", "--ignore-gpu-blocklist"],
});
const errors = [];
let debugPage;
await mkdir("test-results", { recursive: true });
try {
  const ctx1 = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    }),
    ctx2 = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const a = await ctx1.newPage(),
    b = await ctx2.newPage();
  debugPage = a;
  const heavy = [];
  a.on("request", (r) => {
    if (r.url().includes("/models/") || r.url().includes("/textures/"))
      heavy.push(r.url());
  });
  for (const page of [a, b]) {
    page.setDefaultTimeout(15000);
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
  }
  await a.goto(url);
  await a.waitForSelector(".online i:not(.offline)");
  assert.equal(heavy.length, 0, "homepage does not request heavy assets");
  assert.equal(await a.locator("#map-create").count(), 0);
  await a.screenshot({ path: "test-results/home.png" });
  await a.locator("#settings").click();
  await a.locator('[data-setting="sensitivity"]').fill("0.0025");
  await a.locator('[data-category="gameplay"]').click();
  await a.locator('[data-setting="crossSize"]').fill("9");
  await a.locator("#settings-close").click();
  await a.locator("#name").fill("Alpha");
  await a.locator("#create").click();
  await a.locator("#player-limit").selectOption("6");
  await a.locator("#room-name").fill("Coastal test squad");
  await a.screenshot({ path: "test-results/create-room.png" });
  await a.locator("#confirm-create").click();
  await a.locator("#copy").waitFor();
  const code = (await a.locator("#copy").innerText()).slice(0, 6);
  assert.match(code, /^[A-Z0-9]{6}$/);
  assert.equal(await a.locator("#start").isDisabled(), true);
  await b.goto(`${url}/?room=${code}`);
  await b.locator("#name").fill("Bravo");
  await b.locator("#join").click();
  await b.locator("#ready").waitFor();
  await b.locator('[data-team="soldiers"]').click();
  assert.equal(await a.locator("#primary, #secondary").count(), 0);
  await b.locator("#ready").click();
  await a.locator("#ready").click();
  await a.waitForFunction(() => !document.querySelector("#start").disabled);
  await a.screenshot({ path: "test-results/room.png" });
  await a.locator("#start").click();
  await a.locator(".loading-page").waitFor();
  await a.screenshot({ path: "test-results/loading.png" });
  await a.locator("#enter").waitFor({ timeout: 90000 });
  await b.locator("#enter").waitFor({ timeout: 90000 });
  const loadedModels = heavy
    .filter((url) => url.endsWith(".glb"))
    .map((url) => url.split("/").pop());
  for (const id of [
    "soldier",
    "terrorist",
    "soldier-lod",
    "terrorist-lod",
    "m4a4",
    "ak47",
    "glock18",
    "usps",
    "knife",
    "he",
    "flash",
    "smoke",
  ])
    assert.ok(
      loadedModels.includes(`${id}.glb`),
      `match asset ${id} was loaded`,
    );
  assert.ok(
    !loadedModels.includes("negev.glb") && !loadedModels.includes("bomb.glb"),
    "unused loadouts/equipment are not downloaded",
  );
  assert.ok(
    loadedModels.length < 18,
    "room loads a subset, not the full arsenal",
  );
  const room = server.game.rooms.get(code),
    pa = [...room.players.values()].find((p) => p.name === "Alpha"),
    pb = [...room.players.values()].find((p) => p.name === "Bravo");
  assert.notEqual(pa.team, pb.team);
  assert.equal(room.mapId, "coastline");
  assert.equal(room.playerLimit, 6);
  function stage() {
    for (const [p, z, yaw] of [
      [pa, -14, 0],
      [pb, -17, Math.PI],
    ]) {
      Object.assign(p, {
        x: -10,
        z,
        y: 0,
        yaw,
        pitch: 0,
        vx: 0,
        vz: 0,
        vy: 0,
        grounded: true,
        protectedUntil: 0,
      });
      p.input = { ...emptyInput(), yaw };
      p.spawnId++;
    }
    server.game.snapshot(room);
  }
  stage();
  await a.locator("#enter").click();
  await a.locator("#hide-guide").check();
  await a.locator("#guide-close").click();
  await a.waitForFunction(
    () => document.pointerLockElement === document.querySelector("#game"),
  );
  await a.waitForTimeout(350);
  await a.screenshot({ path: "test-results/match.png" });
  await a.mouse.down();
  await a.waitForTimeout(360);
  await a.mouse.up();
  await a.waitForFunction(
    () => Number(document.querySelector("#soldiers-score").textContent) > 0,
    {},
    { timeout: 5000 },
  );
  assert.equal(pa.kills, 1);
  assert.equal(pb.deaths, 1);
  console.log(
    "Passed: readiness, load handshake, balance, pointer lock, authoritative kill.",
  );
  await b.waitForFunction(
    () => document.querySelector("#health").textContent === "100",
    {},
    { timeout: 6000 },
  );
  await a.bringToFront();
  if (await a.locator("#enter").isVisible()) await a.locator("#enter").click();
  await a.waitForFunction(
    () => document.pointerLockElement === document.querySelector("#game"),
  );
  await a.keyboard.press("Digit2");
  await a.waitForFunction(
    () => document.querySelector("#weapon-name").textContent === "USP-S",
  );
  await a.waitForTimeout(300);
  await a.mouse.click(700, 450);
  await a.waitForFunction(
    () => Number(document.querySelector("#ammo").textContent) < 12,
  );
  await a.keyboard.press("KeyR");
  await a.waitForFunction(() =>
    document.querySelector("#reload-prompt").textContent.includes("RELOADING"),
  );
  await a.waitForFunction(
    () => document.querySelector("#ammo").textContent === "12",
    {},
    { timeout: 4000 },
  );
  await a.keyboard.press("Digit1");
  await a.waitForFunction(
    () => document.querySelector("#weapon-name").textContent === "M4A4",
  );
  const ammo = { ...pa.ammo.m4a4 };
  await a.keyboard.press("KeyG");
  await a.waitForFunction(() =>
    document.querySelector("#pickup-prompt").textContent.includes("M4A4"),
  );
  assert.equal(pa.slots.primary, null);
  await a.keyboard.press("KeyE");
  await a.waitForFunction(
    () => document.querySelector("#weapon-name").textContent === "M4A4",
  );
  assert.deepEqual(pa.ammo.m4a4, ammo);
  console.log(
    "Passed: reload, drop, actual 3D pickup prompt, ammo preservation.",
  );
  await a.keyboard.press("Digit4");
  await a.waitForFunction(
    () => document.querySelector("#weapon-name").textContent === "HE GRENADE",
  );
  await a.waitForTimeout(320);
  const beforeThrowAmmo = pa.ammo.m4a4.mag;
  await a.mouse.down();
  await a.waitForFunction(() =>
    document.querySelector("#weapon-slots").textContent.includes("HE 0"),
  );
  await a.waitForTimeout(750);
  await a.waitForFunction(
    () => document.querySelector("#weapon-name").textContent === "M4A4",
  );
  await a.waitForTimeout(350);
  assert.equal(
    pa.ammo.m4a4.mag,
    beforeThrowAmmo,
    "holding grenade click must not fire returned rifle",
  );
  await a.mouse.up();
  await a.mouse.click(700, 450);
  await expect.poll(() => pa.ammo.m4a4.mag).toBe(beforeThrowAmmo - 1);
  console.log(
    "Passed: real held grenade click returns rifle idle; a fresh click fires exactly once.",
  );
  await a.keyboard.press("Digit4");
  await a.waitForFunction(
    () =>
      document.querySelector("#weapon-name").textContent === "FLASH GRENADE",
  );
  await a.waitForTimeout(250);
  await a.mouse.click(700, 450);
  await a.waitForFunction(() =>
    document.querySelector("#weapon-slots").textContent.includes("FLASH 0"),
  );
  // Input during an active throw is deliberately rejected. Wait for the
  // authoritative return to reach the HUD, not a wall-clock guess that can
  // race a delayed simulation tick/snapshot on a busy rendering machine.
  await a.waitForFunction(
    () => document.querySelector("#weapon-name").textContent === "M4A4",
  );
  await expect.poll(() => server.game.now() >= pa.actionUntil).toBe(true);
  await a.keyboard.press("Digit4");
  await a.waitForFunction(
    () =>
      document.querySelector("#weapon-name").textContent === "SMOKE GRENADE",
  );
  await a.waitForTimeout(250);
  await a.mouse.click(700, 450);
  await a.waitForFunction(() =>
    document.querySelector("#weapon-slots").textContent.includes("SMOKE 0"),
  );
  // Observe authoritative detonation, not one wall-clock sample only 300 ms
  // after the fuse; concurrent rendering can delay browser/server scheduling.
  await expect
    .poll(() => room.smokes.length, {
      message: "server creates smoke after its authoritative grenade fuse",
      timeout: 8000,
    })
    .toBe(1);
  await a.keyboard.down("Tab");
  await a.locator("#board.visible").waitFor();
  await a.screenshot({ path: "test-results/scoreboard.png" });
  await a.keyboard.up("Tab");
  const oldZ = pa.z;
  await a.keyboard.down("KeyS");
  await a.waitForTimeout(400);
  await a.keyboard.up("KeyS");
  assert.ok(pa.z > oldZ + 0.3);
  await a.keyboard.press("Escape");
  await a.locator('[data-settings="graphics"]').click();
  await a.locator('[data-setting="quality"]').selectOption("low");
  await a.screenshot({ path: "test-results/settings.png" });
  await a.locator("#settings-close").click();
  assert.equal(room.smokes.length, 1, "quality cannot remove server smoke");
  room.endsAt = server.game.now() - 0.1;
  await a.locator(".results").waitFor();
  await a.screenshot({ path: "test-results/results.png" });
  await a.locator("#again").click();
  await a.locator("#enter").waitFor({ timeout: 30000 });
  assert.equal(room.scores.soldiers, 0);
  room.endsAt = server.game.now() - 0.1;
  await a.locator("#back").waitFor();
  await a.locator("#back").click();
  await a.locator("#copy").waitFor();
  assert.equal(room.players.size, 2);
  assert.equal(room.code, code);
  // A new loadout in the same room must load on demand after the first match.
  server.game.openingBuySeconds = 20;
  await a.locator("#ready").click();
  await b.locator("#ready").click();
  await a.locator("#start").click();
  await a.locator("#enter").waitFor({ timeout: 45000 });
  await a.locator("#pause-buy").click();
  await a.locator('[data-buy-tab="HEAVY"]').click();
  await a.locator('[data-buy="negev"]').click();
  await a.waitForFunction(
    () => document.querySelector("#weapon-name").textContent === "NEGEV",
  );
  assert.ok(heavy.some((url) => url.endsWith("/negev.glb")));
  assert.equal(room.code, code);
  room.endsAt = server.game.now() - 0.1;
  await a.locator("#back").click();
  await a.locator("#copy").waitFor();
  await ctx1.close();
  await b.waitForFunction(() =>
    document.querySelector(".host-name")?.textContent.includes("Bravo"),
  );
  assert.equal(room.host, pb.id);
  await b.reload();
  await b.locator("#create").waitFor();
  await b.waitForTimeout(250);
  assert.equal(server.game.rooms.has(code), false);
  assert.deepEqual(errors, []);
  console.log(
    "V2 E2E passed: two real browsers, full room flow, combat, respawn, inventory, three grenades, settings, scoreboard, replay, return, disconnect.",
  );
} catch (error) {
  await debugPage
    ?.screenshot({ path: "test-results/failure.png" })
    .catch(() => {});
  console.log("Browser errors:", errors);
  console.log(
    "Rooms:",
    JSON.stringify(
      [...server.game.rooms.values()].map((r) => ({
        state: r.state,
        players: [...r.players.values()].map((p) => ({
          name: p.name,
          hp: p.hp,
          x: p.x,
          z: p.z,
          weapon: p.weapon,
          action: p.action,
          actionTime: p.actionUntil - server.game.now(),
          grenades: p.grenades,
          input: p.input,
        })),
      })),
      null,
      2,
    ),
  );
  throw error;
} finally {
  await browser.close();
  await server.close();
}
