import test from "node:test";
import assert from "node:assert/strict";
import { fixture, lineUp } from "./helpers.js";
import { blastDamage } from "../server/explosions.js";
import { wallDistance } from "../shared/game.js";
import { TICK } from "../shared/game.js";

test("HE close radius kills, distance falls off, kill feed and team points agree", () => {
  const damage = [];
  for (const distance of [1, 2, 4, 6, 9]) {
    const f = fixture(),
      { a, b } = lineUp(f);
    f.game.detonate(f.room, {
      kind: "he",
      owner: a.id,
      team: a.team,
      ownerName: a.name,
      x: b.x + distance,
      y: 0.12,
      z: b.z,
    });
    damage.push(100 - b.hp);
    if (distance <= 2) {
      assert.equal(b.hp, 0);
      assert.equal(a.kills, 1);
      assert.equal(f.room.scores[a.team], 1);
      assert.equal(
        f.events.find((e) => e.data?.type === "kill").data.weapon,
        "he",
      );
    }
  }
  assert.ok(damage[2] > damage[3] && damage[3] > 0);
  assert.equal(damage[4], 0);
});
test("HE respects whole-body solid cover and detects exposed lower body", () => {
  const p = { x: 0, y: 0, z: -2, crouch: false };
  const origin = { x: 0, y: 0.12, z: 0 };
  const los = (boxes) => (a, b) => {
    const length = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
    return (
      wallDistance(
        a,
        {
          x: (b.x - a.x) / length,
          y: (b.y - a.y) / length,
          z: (b.z - a.z) / length,
        },
        boxes,
      ) >=
      length - 0.01
    );
  };
  assert.equal(
    blastDamage(origin, p, los([{ x: 0, y: 1, z: -1, w: 4, h: 2, d: 0.4 }])),
    0,
  );
  assert.equal(
    blastDamage(origin, p, los([{ x: 0, y: 1.5, z: -1, w: 4, h: 1, d: 0.4 }])),
    120,
  );
});
test("two concurrent explosions damage multiple enemies once each, not teammates", () => {
  const f = fixture();
  f.game.enter("c", "Charlie", f.room.code);
  f.game.enter("d", "Delta", f.room.code);
  const { a, b } = lineUp(f),
    c = f.game.player("c"),
    d = f.game.player("d");
  Object.assign(a, { x: -15, z: -14 });
  Object.assign(b, { x: -10, z: -17 });
  Object.assign(d, { x: -10, z: -18, protectedUntil: 0 });
  Object.assign(c, { x: -10, z: -16, protectedUntil: 0 });
  for (const owner of [a, c])
    f.game.detonate(f.room, {
      kind: "he",
      owner: owner.id,
      team: owner.team,
      x: -9,
      y: 0.12,
      z: -17,
    });
  assert.equal(b.hp, 0);
  assert.equal(d.hp, 0);
  assert.equal(a.kills, 2);
  assert.equal(c.kills, 0);
  assert.equal(f.room.scores.soldiers, 2);
  assert.equal(
    f.events.filter(
      (e) => e.data?.type === "kill" && ["b", "d"].includes(e.data.id),
    ).length,
    2,
  );
});
test("two real thrown projectiles bounce, finish their fuse and kill nearby enemies", () => {
  const f = fixture();
  f.game.enter("c", "Charlie", f.room.code);
  f.game.enter("d", "Delta", f.room.code);
  const { a, b } = lineUp(f),
    c = f.game.player("c"),
    d = f.game.player("d");
  Object.assign(a, { x: -40, z: 2, pitch: -0.55, yaw: 0 });
  Object.assign(b, { x: 40, z: 2, pitch: -0.55, yaw: 0 });
  Object.assign(c, { x: 40, z: -10.2, protectedUntil: 0 });
  Object.assign(d, { x: -40, z: -10.2, protectedUntil: 0 });
  for (const p of [a, b]) f.game.action(p.id, "switch", "he");
  f.advance(0.21);
  for (const p of [a, b]) f.game.throwGrenade(f.room, p);
  for (let i = 0; i < 125; i++) {
    f.advance(TICK);
    f.game.tick();
  }
  assert.equal(f.room.grenades.length, 0);
  assert.equal(c.hp, 0);
  assert.equal(d.hp, 0);
  assert.equal(a.kills, 1);
  assert.equal(b.kills, 1);
  assert.equal(f.events.filter((e) => e.data?.type === "explosion").length, 2);
  assert.ok(f.events.some((e) => e.data?.type === "grenadeBounce"));
});
