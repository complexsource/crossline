import test from "node:test";
import assert from "node:assert/strict";
import { MAPS, COASTLINE, spawnHeight, groundAt } from "../shared/maps.js";
import {
  overlaps,
  move,
  emptyInput,
  TICK,
  wallDistance,
} from "../shared/game.js";
import { fixture } from "./helpers.js";
const player = (x, z, y = 0) => ({
  x,
  y,
  z,
  vx: 0,
  vy: 0,
  vz: 0,
  grounded: true,
  crouch: false,
});
test("only COASTLINE, 15 named locations and collision-free team spawns", () => {
  assert.equal(MAPS.length, 1);
  assert.equal(COASTLINE.locations.length, 15);
  for (const s of Object.values(COASTLINE.spawns).flat())
    assert.equal(
      COASTLINE.boxes.some((b) =>
        overlaps({ ...s, y: spawnHeight(s.x, s.z) }, b),
      ),
      false,
      JSON.stringify(s),
    );
});
test("both banks, bridges and all spawns connect by traversable ground routes", () => {
  const free = (x, z) =>
    Math.abs(x) < 42 &&
    Math.abs(z) < 35 &&
    !COASTLINE.boxes.some((b) => overlaps({ x, z, y: spawnHeight(x, z) }, b));
  const visited = new Set(),
    queue = [[-38, 29]];
  for (let i = 0; i < queue.length; i++) {
    const [x, z] = queue[i],
      key = `${x}/${z}`;
    if (visited.has(key) || !free(x, z)) continue;
    visited.add(key);
    for (const [dx, dz] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ])
      queue.push([x + dx, z + dz]);
  }
  for (const p of Object.values(COASTLINE.spawns).flat())
    assert.ok(visited.has(`${p.x}/${p.z}`), JSON.stringify(p));
  assert.ok(visited.has("0/-2"));
  assert.ok(visited.has("0/8"));
});
test("room configuration excludes legacy maps and enforces limits", () => {
  const f = fixture();
  assert.throws(() => f.game.configure("a", { mapId: "port" }), /Invalid/);
  assert.throws(() => f.game.configure("b", { playerLimit: 3 }), /host/);
  f.game.configure("a", { playerLimit: 2 });
  assert.throws(() => f.game.enter("c", "Charlie", f.room.code), /full/);
});
test("rooftop and tower staircases are climbable with real movement", () => {
  const roof = player(-36.65, -14.5);
  for (let i = 0; i < 110; i++)
    move(roof, { ...emptyInput(), back: true }, TICK);
  assert.ok(roof.y >= 4.5, JSON.stringify(roof));
  for (let i = 0; i < 22; i++)
    move(roof, { ...emptyInput(), right: true }, TICK);
  assert.ok(roof.y >= 4.5, "stairs connect to the roof");
  const tower = player(-14, -32);
  for (let i = 0; i < 160; i++)
    move(tower, { ...emptyInput(), right: true }, TICK);
  assert.ok(tower.y >= 5.2, JSON.stringify(tower));
});
test("canal is below datum, bridge blocks above, jump and crouch remain valid", () => {
  const p = player(0, 8, -1.3);
  move(p, { ...emptyInput(), jump: true }, TICK);
  assert.ok(p.y > -1.3);
  for (let i = 0; i < 130; i++) move(p, emptyInput(), TICK);
  assert.equal(p.y, -1.3);
  move(p, { ...emptyInput(), crouch: true }, TICK);
  assert.equal(p.crouch, true);
  assert.equal(groundAt(0, 8), -1.3);
  assert.ok(wallDistance({ x: 0, y: -0.8, z: -2 }, { x: 0, y: 1, z: 0 }) < 1.1);
});
