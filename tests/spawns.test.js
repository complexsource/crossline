import test from "node:test";
import assert from "node:assert/strict";
import { fixture, lineUp } from "./helpers.js";
import { chooseSpawn } from "../server/spawns.js";
import { COASTLINE } from "../shared/maps.js";

test("both teams rotate through ten valid spawns across 25 respawns, even with constant randomness", () => {
  for (const team of ["soldiers", "terrorists"]) {
    const f = fixture(),
      { a, b } = lineUp(f);
    a.team = team;
    b.hp = 0;
    const positions = [];
    for (let i = 0; i < 25; i++) {
      f.advance(3.1);
      f.game.spawn(f.room, a);
      positions.push(`${a.x},${a.z}`);
      assert.ok(a.protectedUntil > f.game.now());
    }
    assert.equal(new Set(positions).size, 10);
    for (let i = 1; i < positions.length; i++)
      assert.notEqual(positions[i], positions[i - 1]);
    assert.equal(COASTLINE.spawns[team].length, 10);
    f.game.fire(f.room, a);
    assert.equal(a.protectedUntil, 0);
  }
});
test("safe spawns prefer concealment, distance, and avoid occupied/recent points", () => {
  const f = fixture(),
    { a, b } = lineUp(f);
  Object.assign(b, { x: -38, z: 29 });
  const pick = chooseSpawn(
    f.room,
    a,
    105,
    () => 0,
    (_enemy, spot) => spot.x !== -23,
  );
  assert.equal(pick.x, -23, "the concealed candidate wins over exposed ones");
  for (let i = 0; i < 25; i++) {
    f.game.spawn(f.room, a);
    f.advance(3);
    assert.ok(Math.hypot(a.x - b.x, a.z - b.z) >= 10);
  }
});
test("ten simultaneous players never share an occupied spawn", () => {
  const f = fixture();
  for (let i = 2; i < 10; i++)
    f.game.enter(String(i), `Player ${i}`, f.room.code);
  f.ready();
  f.game.start("a");
  const positions = [...f.room.players.values()].map((p) => `${p.x},${p.z}`);
  assert.equal(new Set(positions).size, 10);
});
