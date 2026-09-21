import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { createGameServer } from "../server/index.js";
import { emptyInput } from "../shared/game.js";
import { resetBot } from "../server/bots.js";

// Real production client and authoritative server; never touches live rooms.
const server = await createGameServer({
  production: true,
  countdown: 0.15,
  openingBuySeconds: 0,
});
await new Promise((resolve) => server.http.listen(0, "127.0.0.1", resolve));
const url = `http://127.0.0.1:${server.http.address().port}`;
const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
  args: ["--enable-webgl", "--ignore-gpu-blocklist"],
});
const errors = [],
  report = { generatedAt: new Date().toISOString() };
let a, b;
await mkdir("test-results", { recursive: true });
try {
  a = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  a.setDefaultTimeout(15000);
  const listen = (page) => {
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
  };
  listen(a);
  const heavy = [];
  a.on("request", (r) => {
    if (r.url().includes("/models/")) heavy.push(r.url());
  });
  await a.goto(url);
  await a.locator("#name").fill("Bot host");
  await a.locator("#create").click();
  await a.locator("#confirm-create").click();
  await a.locator("#add-bot").waitFor();
  assert.deepEqual(
    await a.locator("#bot-difficulty option").allTextContents(),
    ["Easy", "Normal", "Hard"],
  );
  await a.locator("#bot-difficulty").selectOption("hard");
  await a.locator("#add-bot").click();
  await expect(a.locator(".bot-row")).toHaveCount(1);
  const code = (await a.locator("#copy").innerText()).slice(0, 6),
    room = server.game.rooms.get(code);
  const bot = [...room.players.values()].find((p) => p.bot),
    human = [...room.players.values()].find((p) => !p.bot);
  assert.equal(bot.difficulty, "hard");
  assert.equal(bot.ready, true);
  assert.equal(
    heavy.length,
    0,
    "adding bots does not load 3D assets on the lobby",
  );
  await a.locator("#ready").click();
  await expect(a.locator("#start")).toBeEnabled();
  await a.locator("#start").click();
  await a.locator("#enter").waitFor({ timeout: 120000 });
  assert.equal(room.state, "playing");
  assert.equal(room.players.size, 2);
  const start = { x: bot.x, z: bot.z };
  await a.waitForTimeout(1200);
  assert.ok(
    Math.hypot(bot.x - start.x, bot.z - start.z) > 0.1,
    "bot moves without a fake browser",
  );
  await a.locator("#enter").click();
  await a.locator("#hide-guide").check();
  await a.locator("#guide-close").click();
  await a.waitForFunction(
    () => document.pointerLockElement === document.querySelector("#game"),
  );
  await a.keyboard.down("Tab");
  await expect(a.locator("#board")).toContainText("[BOT]");
  await a.screenshot({ path: "test-results/bots-scoreboard.png" });
  await a.keyboard.up("Tab");
  function stage(p, z, yaw) {
    Object.assign(p, {
      x: -10,
      y: 0,
      z,
      yaw,
      pitch: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      hp: 100,
      grounded: true,
      crouch: false,
      stance: 0,
      protectedUntil: 0,
      input: { ...emptyInput(), yaw },
      action: "idle",
      actionUntil: 0,
      nextFire: 0,
      shotCooldownUntil: 0,
      reloadAt: 0,
      weapon: p.primary,
    });
    p.spawnId++;
    if (p.bot) resetBot(p, server.game.now());
  }
  // The preceding free-roaming smoke/HE demo must not obstruct a staged aim test.
  room.grenades.length = room.smokes.length = 0;
  stage(human, -14, 0);
  stage(bot, -18, Math.PI);
  bot.botState.nextThink = Infinity;
  server.game.snapshot(room);
  await a.waitForTimeout(350);
  await a.mouse.down();
  await expect.poll(() => bot.deaths, { timeout: 5000 }).toBe(1);
  await a.mouse.up();
  assert.equal(human.kills, 1);
  await expect.poll(() => bot.hp, { timeout: 6000 }).toBe(100);
  await a.keyboard.press("Escape");
  stage(bot, -14, 0);
  stage(human, -18, Math.PI);
  server.game.snapshot(room);
  await expect.poll(() => human.deaths, { timeout: 10000 }).toBe(1);
  assert.equal(bot.kills, 1);
  await expect.poll(() => human.hp, { timeout: 6000 }).toBe(100);
  console.log(
    "Passed: solo lobby, loading, visible bot, human/bot combat and respawns.",
  );
  room.endsAt = server.game.now() - 0.1;
  await a.locator("#again").waitFor();
  await expect(a.locator(".results")).toContainText("[BOT]");
  await a.locator("#again").click();
  await a.locator("#enter").waitFor({ timeout: 60000 });
  assert.equal(bot.kills, 0);
  assert.equal(bot.deaths, 0);
  room.endsAt = server.game.now() - 0.1;
  await a.locator("#back").click();
  await a.locator("#add-bot").waitFor();
  await a.locator("[data-bot-difficulty]").selectOption("easy");
  await expect.poll(() => bot.difficulty).toBe("easy");
  for (const difficulty of ["normal", "hard"]) {
    await a.locator("#bot-difficulty").selectOption(difficulty);
    await a.locator("#add-bot").click();
    await expect(a.locator(".bot-row")).toHaveCount(
      difficulty === "normal" ? 2 : 3,
    );
  }
  await a.locator(".bot-panel").scrollIntoViewIfNeeded();
  await a.screenshot({ path: "test-results/bots-lobby.png" });
  for (const width of [390, 768]) {
    await a.setViewportSize({ width, height: 900 });
    await a.locator(".bot-panel").scrollIntoViewIfNeeded();
    assert.ok(
      await a.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
      `no horizontal overflow at ${width}`,
    );
    await a.screenshot({ path: `test-results/bots-lobby-${width}.png` });
  }
  await a.setViewportSize({ width: 1440, height: 900 });
  b = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  listen(b);
  await b.goto(`${url}/?room=${code}`);
  await b.locator("#name").fill("Bot peer");
  await b.locator("#join").click();
  await b.locator("#ready").waitFor();
  assert.equal(await b.locator("#add-bot").count(), 0);
  assert.equal(await b.locator("[data-remove-bot]").count(), 0);
  const peer = [...room.players.values()].find((p) => p.name === "Bot peer");
  await a.bringToFront();
  for (let i = 4; i <= 8; i++) {
    await a.locator("#add-bot").click();
    await expect(a.locator(".bot-row")).toHaveCount(i);
  }
  await expect(a.locator("#add-bot")).toBeDisabled();
  assert.equal(room.players.size, 10);
  await expect(a.locator(".bot-note").last()).toContainText("Room full");
  await a.locator("[data-remove-bot]").last().click();
  await expect(a.locator(".bot-row")).toHaveCount(7);
  await a.locator("#add-bot").click();
  await expect(a.locator(".bot-row")).toHaveCount(8);
  assert.equal(server.io.sockets.sockets.size, 2);
  await b.locator("#ready").click();
  await a.locator("#ready").click();
  await a.locator("#start").click();
  await a.locator("#enter").waitFor({ timeout: 90000 });
  await b.locator("#enter").waitFor({ timeout: 90000 });
  await a.bringToFront();
  await a.locator("#enter").click();
  const ticks = [],
    events = [];
  const originalTick = server.game.tick.bind(server.game),
    originalEmit = server.game.emit;
  server.game.tick = () => {
    const start = performance.now();
    originalTick();
    ticks.push(performance.now() - start);
  };
  server.game.emit = (target, type, data) => {
    if (type === "fx") events.push(data.type);
    originalEmit(target, type, data);
  };
  report.browser = await a.evaluate(async () => {
    const intervals = [];
    let last = performance.now();
    const end = last + 25000;
    while (performance.now() < end) {
      await new Promise(requestAnimationFrame);
      const now = performance.now();
      intervals.push(now - last);
      last = now;
    }
    intervals.sort((a, b) => a - b);
    const gl = document.querySelector("#game").getContext("webgl2");
    return {
      samples: intervals.length,
      rafMedianMs: intervals[Math.floor(intervals.length * 0.5)],
      rafP95Ms: intervals[Math.floor(intervals.length * 0.95)],
      heapMiB: performance.memory?.usedJSHeapSize / 1048576,
      contextLost: gl.isContextLost(),
      glError: gl.getError(),
      recoveryVisible: !!document.querySelector("#graphics-recovery"),
      hud: document.querySelector("#connection-stats").textContent,
    };
  });
  server.game.tick = originalTick;
  server.game.emit = originalEmit;
  assert.ok(
    events.includes("shot"),
    "bots fight autonomously during a real ten-player match",
  );
  assert.ok(events.includes("kill"), "bot combat updates the real scoreboard");
  assert.equal(report.browser.contextLost, false);
  assert.equal(report.browser.glError, 0);
  assert.equal(report.browser.recoveryVisible, false);
  ticks.sort((a, b) => a - b);
  report.server = {
    ticks: ticks.length,
    p95TickMs: ticks[Math.floor(ticks.length * 0.95)],
    worstTickMs: Math.max(...ticks),
    shots: events.filter((e) => e === "shot").length,
    kills: events.filter((e) => e === "kill").length,
  };
  await a.screenshot({ path: "test-results/bots-match.png" });
  room.endsAt = server.game.now() - 0.1;
  await a.locator("#back").click();
  await a.locator("#add-bot").waitFor();
  await a.close();
  await expect(b.locator("#add-bot")).toBeVisible();
  assert.equal(room.host, peer.id);
  await b.reload();
  await b.locator("#create").waitFor();
  await expect.poll(() => server.game.rooms.size).toBe(0);
  assert.equal(server.game.members.size, 0);
  assert.deepEqual(errors, []);
  report.errors = errors;
  await writeFile(
    "test-results/bots-browser.json",
    JSON.stringify(report, null, 2),
  );
  console.log("Bot browser E2E passed:", JSON.stringify(report));
} catch (error) {
  await a
    ?.screenshot({ path: "test-results/bots-failure.png" })
    .catch(() => {});
  console.error("Browser errors:", errors);
  throw error;
} finally {
  await browser.close();
  await server.close();
}
