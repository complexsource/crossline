import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { createGameServer } from "../server/index.js";
import { WEAPONS } from "../shared/weapons.js";

// Render the shipped GLBs once. No model changes, third-party art or image API.
const server = await createGameServer();
await new Promise((resolve) => server.http.listen(0, "127.0.0.1", resolve));
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  await mkdir("public/previews/weapons", { recursive: true });
  const page = await browser.newPage();
  page.on("pageerror", (error) => {
    throw error;
  });
  await page.goto(
    `http://127.0.0.1:${server.http.address().port}/tools/buy-thumbnails.html`,
  );
  await page.waitForFunction(() => window.ready, {}, { timeout: 120000 });
  let total = 0;
  for (const id of Object.keys(WEAPONS)) {
    const bytes = Buffer.from(
      await page.evaluate((id) => window.thumbnail(id), id),
      "base64",
    );
    await writeFile(`public/previews/weapons/${id}.webp`, bytes);
    total += bytes.length;
  }
  console.log(
    `Rendered ${Object.keys(WEAPONS).length} catalog thumbnails: ${Math.round(total / 1024)} KiB total.`,
  );
} finally {
  await browser.close();
  await server.close();
}
