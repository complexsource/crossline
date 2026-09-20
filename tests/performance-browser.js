import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { createGameServer } from "../server/index.js";

// Isolated server/profile. No existing rooms or browser settings are touched.
const server = await createGameServer({ countdown: 0.1 });
await new Promise((resolve) => server.http.listen(0, "127.0.0.1", resolve));
const url = `http://127.0.0.1:${server.http.address().port}`;
const browser = await chromium.launch({ channel: "chrome", headless: true });
const report = { generatedAt: new Date().toISOString(), benchmarks: [] };
const errors = [];
await mkdir("test-results", { recursive: true });
try {
  if (!process.env.RECOVERY_ONLY) {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 900 },
    });
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    await page.goto(`${url}/tests/visual.html`);
    await page.waitForFunction(() => window.ready, {}, { timeout: 120000 });
    for (const quality of ["low", "high"]) {
      const data = await page.evaluate((q) => window.benchmark(q), quality);
      report.benchmarks.push(data);
      console.log("Benchmark", JSON.stringify(data));
    }
    report.combat = await page.evaluate(async () => {
      const r = window.graphics;
      const { makeGun, disposeModel } = await import("/src/models.js");
      const full = makeGun("awp", true),
        remote = makeGun("awp");
      const count = (root) => {
        let n = 0;
        root.traverse((o) => {
          if (o.isMesh) n++;
        });
        return n;
      };
      const weapons = {
        firstPersonMeshes: count(full),
        worldMeshes: count(remote),
      };
      disposeModel(full);
      disposeModel(remote);
      const state = {
        players: [...r.players.values()].map((m) => ({ ...m.userData.state })),
        grenades: [],
        drops: [],
        smokes: [],
      };
      const original = new Map(r.players);
      for (let i = 0; i < 30; i++) {
        r.camera.position.set(i % 2 ? -21 : 100, 1.6, i % 2 ? -29 : 100);
        r.sync(state, "self");
      }
      const stableLod = [...r.players].every(
        ([id, mesh]) => original.get(id) === mesh,
      );
      const local = {
        ...state.players[0],
        id: "self",
        team: "soldiers",
        x: -21,
        z: -29,
        yaw: 2.44685,
        pitch: -0.05,
      };
      r.camera.position.set(local.x, 1.62, local.z);
      r.sync(state, "self");
      await r.warmup(["m4a4", "awp", "knife", "he", "flash", "smoke"]);
      r.render(1 / 60, local, true, false);
      const shadow = r.world.sun.shadow.map;
      r.options = { ...r.options, master: 0.3 };
      r.setQuality("high");
      const audioKeepsShadow = r.world.sun.shadow.map === shadow;
      const programsBefore = r.renderer.info.programs.length;
      state.smokes = [0, 1, 2].map((i) => ({
        id: `smoke${i}`,
        x: -27 + i * 3,
        y: 0,
        z: -23,
        radius: 4.6,
        age: 3,
        remaining: 30,
      }));
      r.sync(state, "self");
      const times = [],
        calls = [],
        gpu = [],
        gl = r.renderer.getContext();
      const ext = gl.getExtension("EXT_disjoint_timer_query_webgl2"),
        queries = [];
      const memory = [];
      const burst = () => {
        for (let i = 0; i < 3; i++)
          r.fx({ type: "explosion", x: -25 + i * 2, y: 1, z: -23 }, "self");
        r.fx({ type: "flashbang", x: -23, y: 1, z: -22 }, "self");
        for (let i = 0; i < 10; i++)
          r.fx(
            {
              type: "shot",
              id: "bench0",
              weapon: "m4a4",
              origin: { x: -24, y: 1.6, z: -24 },
              ends: [{ x: -22, y: 1, z: -22, normal: { x: 0, y: 1, z: 0 } }],
            },
            "self",
          );
      };
      for (let cycle = 0; cycle < 5; cycle++) {
        burst();
        for (let frame = 0; frame < 100; frame++) {
          await new Promise(requestAnimationFrame);
          const q = ext && gl.createQuery();
          if (q) gl.beginQuery(ext.TIME_ELAPSED_EXT, q);
          const start = performance.now();
          r.render(1 / 60, local, true, false);
          times.push(performance.now() - start);
          calls.push(r.renderer.info.render.calls);
          if (q) {
            gl.endQuery(ext.TIME_ELAPSED_EXT);
            queries.push(q);
          }
          while (
            queries.length &&
            gl.getQueryParameter(queries[0], gl.QUERY_RESULT_AVAILABLE)
          ) {
            const done = queries.shift();
            if (!gl.getParameter(ext.GPU_DISJOINT_EXT))
              gpu.push(gl.getQueryParameter(done, gl.QUERY_RESULT) / 1e6);
            gl.deleteQuery(done);
          }
        }
        r.clearEffects();
        memory.push({ ...r.renderer.info.memory });
      }
      for (const q of queries) gl.deleteQuery(q);
      const percentile = (values, p) =>
        [...values].sort((a, b) => a - b)[Math.floor((values.length - 1) * p)];
      return {
        weapons,
        stableLod,
        audioKeepsShadow,
        programsBefore,
        programsAfter: r.renderer.info.programs.length,
        cpuMedianMs: percentile(times, 0.5),
        cpuP95Ms: percentile(times, 0.95),
        cpuWorstMs: Math.max(...times),
        gpuMedianMs: percentile(gpu, 0.5),
        gpuP95Ms: percentile(gpu, 0.95),
        gpuSamples: gpu.length,
        averageCalls: calls.reduce((a, b) => a + b, 0) / calls.length,
        memory,
        decorativeBatches: r.world.decorative.length,
        visibleDecoration: r.world.decorative.filter((x) => x.mesh.visible)
          .length,
      };
    });
    assert.ok(
      report.combat.weapons.worldMeshes <
        report.combat.weapons.firstPersonMeshes / 2,
    );
    assert.ok(
      report.combat.stableLod,
      "LOD swaps keep the character, skeleton and label alive",
    );
    assert.ok(
      report.combat.audioKeepsShadow,
      "unrelated settings must not rebuild shadow targets",
    );
    assert.ok(
      report.combat.memory.at(-1).geometries <=
        report.combat.memory[1].geometries + 4,
      "pooled effects plateau after warmup",
    );
    assert.equal(
      report.combat.programsAfter,
      report.combat.programsBefore,
      "combat reuses prewarmed shader programs",
    );
    await page.screenshot({ path: "test-results/performance-combat.png" });
    assert.deepEqual(errors, []);
    console.log("Combat", JSON.stringify(report.combat));
    await page.close();
  }

  // Exercise the real app's recovery, not just a standalone Three.js canvas.
  const a = await browser.newPage(),
    b = await browser.newPage();
  for (const p of [a, b]) p.on("pageerror", (e) => errors.push(e.message));
  await a.goto(url);
  await a.locator("#name").fill("Recovery A");
  await a.locator("#create").click();
  await a.locator("#confirm-create").click();
  const code = (await a.locator("#copy").innerText()).slice(0, 6);
  await b.goto(`${url}/?room=${code}`);
  await b.locator("#name").fill("Recovery B");
  await b.locator("#join").click();
  await b.locator("#ready").click();
  await a.locator("#ready").click();
  await a.locator("#start").click();
  await a.locator("#enter").waitFor({ timeout: 120000 });
  await b.locator("#enter").waitFor({ timeout: 120000 });
  await a.bringToFront();
  await a.evaluate(async () => {
    const { Renderer } = await import("/src/renderer.js");
    const original = Renderer.prototype.render;
    Renderer.prototype.render = function (...args) {
      Renderer.prototype.render = original;
      throw Error("Injected one-shot rendering failure");
    };
  });
  await a.locator("#graphics-recovery").waitFor();
  const timer = await a.locator("#timer").innerText();
  await a.waitForFunction(
    (before) => document.querySelector("#timer").textContent !== before,
    timer,
  );
  await a.locator(".recovery-retry").click();
  await a
    .locator("#graphics-recovery")
    .waitFor({ state: "detached", timeout: 30000 });
  assert.equal(server.game.rooms.get(code).state, "playing");
  await a.evaluate(() => {
    const gl = document.querySelector("#game").getContext("webgl2");
    window.testLoss = gl.getExtension("WEBGL_lose_context");
    window.testLoss.loseContext();
  });
  await a.locator("#graphics-recovery").waitFor();
  await a.waitForTimeout(250);
  await a.evaluate(() => window.testLoss.restoreContext());
  await a
    .locator("#graphics-recovery")
    .waitFor({ state: "detached", timeout: 45000 });
  await a.waitForTimeout(1000);
  assert.equal(await a.locator("#graphics-recovery").count(), 0);
  assert.equal(server.game.rooms.get(code).state, "playing");
  assert.deepEqual(errors, []);
  report.recovery = {
    renderException: true,
    hudContinues: true,
    contextLoss: true,
    contextRestoration: true,
    roomPreserved: true,
  };
  await a.screenshot({ path: "test-results/performance-recovered.png" });
  console.log(
    "Recovery passed: thrown render error and real WebGL loss/restore; same room remains playable.",
  );
} finally {
  await writeFile(
    process.env.RECOVERY_ONLY ? "test-results/performance-recovery.json" : "test-results/performance.json",
    JSON.stringify(report, null, 2),
  );
  await browser.close();
  await server.close();
}
