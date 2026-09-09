import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { createGameServer } from "../server/index.js";
import { WEAPONS } from "../shared/weapons.js";
const server = await createGameServer();
await new Promise((resolve) => server.http.listen(0, "127.0.0.1", resolve));
const browser = await chromium.launch({ channel: "chrome", headless: true });
const errors = [],
  results = [];
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
  });
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(
    `http://127.0.0.1:${server.http.address().port}/tests/visual.html`,
  );
  await page.waitForFunction(() => window.ready, {}, { timeout: 90000 });
  await mkdir("test-results/first-person", { recursive: true });
  const ids = process.env.WEAPONS?.split(",") || Object.keys(WEAPONS);
  for (const id of ids)
    for (const phase of [0, 0.45, 0.89]) {
      if (phase && !WEAPONS[id].reload) continue;
      const result = await page.evaluate(
        async ({ id, phase }) => {
          const { WEAPONS } = await import("/shared/weapons.js");
          await window.firstPerson(
            id,
            phase ? WEAPONS[id].reload * (1 - phase) : 0,
          );
          const g = window.graphics.gun;
          g.updateMatrixWorld(true);
          let finite = true;
          g.traverse((o) => {
            finite &&= o.matrixWorld.elements.every(Number.isFinite);
          });
          let nearClipVertices = 0,
            checkedHandVertices = 0;
          const camera = window.graphics.gunCamera;
          const point = g.position.clone(),
            slope = Math.tan((camera.fov * Math.PI) / 360);
          // Check actual palm/finger vertices, excluding the intentionally
          // off-screen forearm anchors. A hand must not cross the visible near plane.
          for (const { hand } of g.userData.viewHands)
            hand.traverse((o) => {
              const position = o.geometry?.attributes.position;
              if (!position) return;
              for (let i = 0; i < position.count; i++) {
                point
                  .fromBufferAttribute(position, i)
                  .applyMatrix4(o.matrixWorld);
                checkedHandVertices++;
                if (
                  point.z < 0 &&
                  point.z >= -camera.near &&
                  Math.abs(point.x) < -point.z * slope * camera.aspect &&
                  Math.abs(point.y) < -point.z * slope
                )
                  nearClipVertices++;
              }
            });
          return {
            finite,
            nearClipVertices,
            checkedHandVertices,
            calls: window.graphics.renderer.info.render.calls,
            hands: !!g.userData.triggerHand && !!g.userData.supportRest,
          };
        },
        { id, phase },
      );
      assert.equal(result.finite, true, id);
      assert.equal(result.hands, true, id);
      assert.ok(
        result.checkedHandVertices > 1000,
        `${id}: real hand geometry checked`,
      );
      assert.equal(
        result.nearClipVertices,
        0,
        `${id}: no visible palm/finger near-plane cut`,
      );
      await page.screenshot({
        path: `test-results/first-person/${id}-${phase}.png`,
      });
      results.push({ id, phase, ...result });
    }
  assert.deepEqual(errors, []);
  await writeFile(
    "test-results/first-person/report.json",
    JSON.stringify(results, null, 2),
  );
  console.log(
    `First-person: ${results.length} real GLB rest/reload renders; no browser errors.`,
  );
} finally {
  await browser.close();
  await server.close();
}
