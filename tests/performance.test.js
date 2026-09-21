import test from "node:test";
import assert from "node:assert/strict";
import {
  AdaptiveResolution,
  effectiveQuality,
  pixelRatio,
  QUALITY,
} from "../src/performance.js";
import { readSettings } from "../src/settings.js";
import {
  BOXES,
  move,
  emptyInput,
  collisionCandidates,
} from "../shared/game.js";
import { packSnapshot, unpackSnapshot } from "../shared/snapshot.js";
import { matchAssetIds } from "../src/assets.js";

test("automatic graphics and resolution respect bounded GPU pixel budgets", () => {
  assert.equal(effectiveQuality("auto", { hardwareConcurrency: 8 }), "medium");
  assert.equal(effectiveQuality("auto", { hardwareConcurrency: 4 }), "low");
  assert.equal(effectiveQuality("ultra"), "ultra");
  for (const q of Object.values(QUALITY)) {
    const ratio = pixelRatio(3840, 2160, 2, q, 1.5);
    assert.ok(3840 * 2160 * ratio ** 2 <= q.pixels + 0.01);
  }
  const stored = readSettings({
    getItem: () =>
      JSON.stringify({
        quality: "invalid",
        resolution: 999,
        fov: -1,
        master: 99,
      }),
  });
  assert.equal(stored.quality, "auto");
  assert.equal(stored.resolution, 1.5);
  assert.equal(stored.fov, 65);
  assert.equal(stored.master, 1);
});
test("adaptive resolution reacts to sustained load, ignores suspension and recovers gradually", () => {
  const a = new AdaptiveResolution();
  for (let i = 0; i < 89; i++) assert.equal(a.sample(33), false);
  assert.equal(a.scale, 1);
  assert.equal(a.sample(33), true);
  assert.equal(a.scale, 0.9);
  for (let i = 0; i < 1000; i++) a.sample(1000);
  assert.equal(a.scale, 0.9);
  for (let i = 0; i < 2000; i++) a.sample(40);
  assert.equal(a.scale, 0.6);
  for (let i = 0; i < 4000; i++) a.sample(16.67);
  assert.equal(a.scale, 1);
  a.reset();
  for (let i = 0; i < 500; i++) a.sample(33.34, 1000 / 30);
  assert.equal(a.scale, 1, "an intentional 30 FPS cap is not overload");
});
test("static collision broadphase matches full scans exactly across random movement and stairs", () => {
  let seed = 91;
  const rand = () => (seed = (1664525 * seed + 1013904223) >>> 0) / 4294967296;
  const full = [...BOXES];
  for (let scenario = 0; scenario < 150; scenario++) {
    const p = {
      x: rand() * 82 - 41,
      z: rand() * 68 - 34,
      y: rand() * 4,
      vx: 0,
      vy: 0,
      vz: 0,
      grounded: true,
      crouch: false,
    };
    const q = { ...p };
    for (let frame = 0; frame < 90; frame++) {
      const input = {
        ...emptyInput(),
        yaw: rand() * Math.PI * 2,
        forward: rand() > 0.3,
        right: rand() > 0.7,
        run: rand() > 0.4,
        crouch: rand() > 0.7,
        jump: rand() > 0.9,
      };
      move(p, input, 1 / 60);
      move(q, input, 1 / 60, full);
      assert.deepEqual(p, q, `scenario ${scenario}, tick ${frame}`);
    }
  }
  assert.ok(collisionCandidates(0, 0).length < BOXES.length / 3);
});
test("wire snapshots preserve authority fields without depending on previous packets", () => {
  const p = {
    id: "abc",
    bot: false,
    difficulty: null,
    name: "Player",
    team: "soldiers",
    x: 1.23456,
    y: 0,
    z: -5,
    vx: 1,
    vy: 2,
    vz: 3,
    yaw: 0.01,
    pitch: -0.3,
    crouch: false,
    stance: 0,
    grounded: true,
    jumpHeld: false,
    hp: 78,
    armor: 3,
    weapon: "m4a4",
    primary: "m4a4",
    secondary: "usps",
    slots: { primary: "m4a4", secondary: "usps" },
    grenades: { he: 1, flash: 1, smoke: 1 },
    ammo: { mag: 21, reserve: 40 },
    reload: 0,
    respawn: 0,
    protected: false,
    kills: 3,
    deaths: 2,
    headshots: 1,
    damage: 205,
    ping: 40,
    ack: 104,
    spawnId: 4,
    fireEpoch: 6,
    actionState: "ready",
    action: "idle",
    actionTime: 0,
    buyRemaining: 0,
    previousLoadout: null,
  };
  const state = {
    time: 30,
    remaining: 250,
    scores: { soldiers: 3, terrorists: 2 },
    players: Array.from({ length: 10 }, (_, i) => ({ ...p, id: `player${i}` })),
    grenades: [],
    smokes: [],
    drops: [],
  };
  const packet = packSnapshot(state),
    decoded = unpackSnapshot(JSON.parse(JSON.stringify(packet)));
  assert.ok(
    JSON.stringify(packet).length < JSON.stringify(state).length * 0.65,
  );
  for (let i = 0; i < 10; i++)
    assert.deepEqual(decoded.players[i], { ...state.players[i], x: 1.235 });
  assert.equal(
    state.players[0].x,
    1.23456,
    "server simulation remains unquantised",
  );
  assert.deepEqual(unpackSnapshot(state), state);
});
test("match loading includes all room loadouts and excludes unused arsenal", () => {
  const ids = matchAssetIds([
    { primary: "m4a4", secondary: "usps" },
    { primary: "awp", secondary: "glock18" },
  ]);
  assert.equal(ids.length, 13);
  assert.ok(
    ids.includes("awp") &&
      ids.includes("smoke") &&
      ids.includes("terrorist-lod"),
  );
  assert.ok(!ids.includes("bomb") && !ids.includes("negev"));
});
