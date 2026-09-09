import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { createGameServer } from "../server/index.js";

// Production-only, isolated server: never touch a room on the development port.
const server = await createGameServer({ production: true });
await new Promise((resolve) => server.http.listen(0, "127.0.0.1", resolve));
const url = `http://127.0.0.1:${server.http.address().port}`;
const browser = await chromium.launch({ channel: "chrome", headless: true });
await mkdir("test-results/homepage", { recursive: true });
try {
  const page = await browser.newPage(),
    errors = [],
    heavy = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    if (/\/(models|textures)\//.test(request.url())) heavy.push(request.url());
  });
  for (const [width, height] of [
    [1440, 900],
    [1280, 720],
    [1024, 768],
    [900, 700],
    [768, 1024],
    [390, 844],
    [320, 720],
    [2560, 1080],
  ]) {
    await page.setViewportSize({ width, height });
    await page.goto(url);
    await page.locator(".online i:not(.offline)").waitFor();
    await page.evaluate(() => document.fonts.ready);
    const layout = await page.evaluate(() => {
      const shell = document.querySelector(".home-shell");
      const selectors = [
        "header",
        ".intro",
        ".intro h1",
        ".mode-tag",
        ".entry",
        "#name",
        "#code",
        "#create",
        "#join",
        "#settings",
        "#how",
        "footer",
      ];
      return {
        overflow: shell.scrollWidth - shell.clientWidth,
        clipped: selectors.filter((selector) => {
          const el = document.querySelector(selector),
            rect = el.getBoundingClientRect();
          return (
            rect.left < -1 ||
            rect.right > innerWidth + 1 ||
            el.scrollWidth > el.clientWidth + 1
          );
        }),
      };
    });
    assert.ok(
      layout.overflow <= 1,
      `${width}px: horizontal overflow ${layout.overflow}`,
    );
    assert.deepEqual(layout.clipped, [], `${width}px: clipped content`);
    await page.screenshot({
      path: `test-results/homepage/${width}x${height}.png`,
    });
    await page.locator("#how").scrollIntoViewIfNeeded();
    assert.ok(await page.locator("#how").isVisible());
    console.log(`Homepage layout: ${width}×${height} passes`);
  }
  assert.deepEqual(heavy, [], "homepage must not load the game asset pack");
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(url);

  // Check the actual background pixels, not merely the existence of a gradient.
  // The original horizon was at y≈183; blank upper-right sky should be continuous.
  const screenshot = await page.screenshot();
  const seam = await page.evaluate(async (base64) => {
    const image = new Image();
    image.src = `data:image/png;base64,${base64}`;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(image, 0, 0);
    let max = 0,
      last;
    for (let y = 145; y <= 190; y++) {
      const pixels = ctx.getImageData(1150, y, 200, 1).data;
      const mean = [0, 0, 0];
      for (let x = 0; x < pixels.length; x += 4)
        for (let c = 0; c < 3; c++) mean[c] += pixels[x + c] / 200;
      if (last)
        max = Math.max(max, ...mean.map((v, c) => Math.abs(v - last[c])));
      last = mean;
    }
    return max;
  }, screenshot.toString("base64"));
  assert.ok(seam < 2, `hard background seam: adjacent-row difference ${seam}`);

  for (const [trigger, dialog, close] of [
    ["#settings", "#settings-modal", "#settings-close"],
    ["#how", "#guide", "#guide-close"],
  ]) {
    await page.locator(trigger).click();
    assert.equal(await page.locator(dialog).getAttribute("aria-modal"), "true");
    assert.equal(
      await page.evaluate(
        (selector) =>
          document.querySelector(selector).contains(document.activeElement),
        dialog,
      ),
      true,
    );
    for (const key of ["Shift+Tab", "Tab", "Tab"])
      await page.keyboard.press(key);
    assert.equal(
      await page.evaluate(
        (selector) =>
          document.querySelector(selector).contains(document.activeElement),
        dialog,
      ),
      true,
      "focus stays inside dialog",
    );
    await page.screenshot({
      path: `test-results/homepage/${dialog.slice(1)}.png`,
    });
    await page.keyboard.press("Escape");
    assert.equal(await page.locator(dialog).count(), 0, "Escape closes dialog");
    assert.equal(
      await page.evaluate(
        (selector) =>
          document.activeElement === document.querySelector(selector),
        trigger,
      ),
      true,
      "focus returns to opener",
    );
    await page.locator(trigger).click();
    await page.locator(close).click();
    assert.equal(await page.locator(dialog).count(), 0);
  }
  await page.locator("#settings").click();
  await page.locator('[data-category="graphics"]').click();
  await page.keyboard.press("Escape");
  assert.equal(await page.locator("#settings-modal").count(), 0);
  assert.equal(
    await page
      .locator("#settings")
      .evaluate((el) => el === document.activeElement),
    true,
  );
  await page.locator("#settings").click();
  await page.locator('[data-bind="forward"]').click();
  await page.keyboard.press("Escape");
  assert.equal(
    await page.locator("#settings-modal").count(),
    1,
    "Escape cancels rebinding before closing settings",
  );
  await page.keyboard.press("Escape");
  assert.equal(await page.locator("#settings-modal").count(), 0);

  await page.goto(`${url}/?room=ABC123`);
  await page.locator("#name").fill("Invite keyboard test");
  await page.locator("#name").press("Enter");
  await page.locator("#toast.show").waitFor();
  assert.equal(
    await page.locator("#confirm-create").count(),
    0,
    "Enter with an invitation must join, not create",
  );
  await page.locator("#code").fill("");
  await page.locator("#name").press("Enter");
  await page.locator("#confirm-create").waitFor();
  await page.locator("#back-home").click();

  let releaseConnection;
  const connectionGate = new Promise((resolve) => {
    releaseConnection = resolve;
  });
  await page.route("**/socket.io/**", async (route) => {
    await connectionGate;
    await route.continue();
  });
  await page.goto(url);
  await page.locator("#name").fill("Keep my draft");
  await page.locator("#code").fill("DEF456");
  releaseConnection();
  await page.locator(".online i:not(.offline)").waitFor();
  assert.equal(
    await page.locator("#name").inputValue(),
    "Keep my draft",
    "initial connect preserves the name draft",
  );
  assert.equal(
    await page.locator("#code").inputValue(),
    "DEF456",
    "initial connect preserves the room code draft",
  );
  assert.equal(
    await page.locator("#code").evaluate((el) => document.activeElement === el),
    true,
    "status updates do not steal input focus",
  );
  await page.unroute("**/socket.io/**");

  await page.emulateMedia({ reducedMotion: "reduce" });
  assert.equal(
    await page
      .locator("#create")
      .evaluate((el) => getComputedStyle(el).transitionDuration),
    "0s",
  );
  assert.deepEqual(errors, []);
  assert.deepEqual(heavy, []);
  console.log(
    "Homepage checks pass: smooth background, responsive layout, keyboard dialogs, invite Enter routing, preserved connection drafts, reduced motion and no heavy asset downloads.",
  );
} finally {
  await browser.close();
  await server.close();
}
