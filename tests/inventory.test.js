import test from "node:test";
import assert from "node:assert/strict";
import { drop, pickup, owned } from "../server/inventory.js";
import { fixture, lineUp } from "./helpers.js";
import { TICK } from "../shared/game.js";
test("a firearm dropped in the air settles on the ground", () => {
  const f = fixture(),
    { a } = lineUp(f);
  a.y = 2;
  const item = drop(f.room, a, 100);
  for (let i = 0; i < 90; i++) {
    f.advance(TICK);
    f.game.tick();
  }
  assert.equal(item.y, 0.08);
  assert.equal(item.vy, 0);
});
test("dropped weapons preserve remaining ammo and atomic pickup replaces the same slot", () => {
  const f = fixture(),
    { a, b } = lineUp(f);
  a.ammo[a.weapon].mag = 7;
  a.ammo[a.weapon].reserve = 41;
  const item = drop(f.room, a, 100);
  assert.equal(a.slots.primary, null);
  assert.deepEqual(item.ammo, { mag: 7, reserve: 41 });
  Object.assign(b, { x: item.x, y: item.y, z: item.z });
  assert.equal(pickup(f.room, b, item.id, 100), true);
  assert.equal(b.weapon, item.weapon);
  assert.deepEqual(b.ammo[item.weapon], { mag: 7, reserve: 41 });
  assert.equal(pickup(f.room, a, item.id, 100), false);
  assert.equal(f.room.drops.length, 1, "old primary is left on the ground");
});
test("pickup checks range and visibility; knife and objective cannot be dropped in TDM", () => {
  const f = fixture(),
    { a, b } = lineUp(f);
  const item = drop(f.room, a, 100);
  assert.equal(pickup(f.room, b, item.id, 100), false);
  Object.assign(b, { x: item.x, z: item.z });
  assert.equal(
    pickup(f.room, b, item.id, 100, () => false),
    false,
  );
  a.weapon = "knife";
  assert.equal(drop(f.room, a, 100), false);
  assert.equal(owned(a).includes("bomb"), false);
  f.game.action("a", "switch", "bomb");
  assert.equal(a.weapon, "knife");
});
test("drop count is bounded and stale world items expire", () => {
  const f = fixture(),
    { a } = lineUp(f);
  for (let i = 0; i < 50; i++) {
    a.weapon = a.primary;
    a.slots.primary = a.primary;
    a.ammo[a.primary] = { mag: 3, reserve: 0 };
    drop(f.room, a, 100);
  }
  assert.equal(f.room.drops.length, 40);
  f.advance(76);
  f.room.endsAt = 300;
  f.game.tick();
  assert.equal(f.room.drops.length, 0);
});
