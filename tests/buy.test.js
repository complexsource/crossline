import test from "node:test";
import assert from "node:assert/strict";
import { stat } from "node:fs/promises";
import sharp from "sharp";
import { fixture } from "./helpers.js";
import {
  BUY_ITEMS,
  BUY_CATEGORIES,
  OPENING_BUY_SECONDS,
  RESPAWN_BUY_SECONDS,
} from "../shared/buy.js";
import { WEAPONS, FIREARMS, GRENADES } from "../shared/weapons.js";
import { emptyInput } from "../shared/game.js";
import { drop, pickup } from "../server/inventory.js";
import { packSnapshot, unpackSnapshot } from "../shared/snapshot.js";

function setup(options = {}) {
  const f = fixture({ openingBuySeconds: 20, ...options });
  f.ready();
  f.game.start("a");
  const a = f.game.player("a"),
    b = f.game.player("b");
  const buy = (itemId, p = a) =>
    f.game.buy(p.id, { itemId, spawnId: p.spawnId, epoch: f.room.loadEpoch });
  return { ...f, a, b, buy };
}
test("the complete 39-item catalog has eight categories and optimized real-model thumbnails", async () => {
  assert.equal(BUY_ITEMS.length, 39);
  assert.equal(BUY_CATEGORIES.length, 8);
  assert.deepEqual(
    BUY_ITEMS.map((i) => i.id).sort(),
    Object.keys(WEAPONS).sort(),
  );
  assert.equal(BUY_ITEMS.filter((i) => i.available).length, 38);
  assert.deepEqual(
    BUY_ITEMS.filter((i) => !i.available).map((i) => i.id),
    ["bomb"],
  );
  let bytes = 0;
  for (const item of BUY_ITEMS) {
    assert.ok(BUY_CATEGORIES.some((c) => c.id === item.category));
    const path = `public${item.image}`,
      meta = await sharp(path).metadata();
    assert.equal(meta.width, 640);
    assert.equal(meta.height, 360);
    assert.equal(meta.format, "webp");
    bytes += (await stat(path)).size;
  }
  assert.ok(bytes < 600 * 1024, "entire thumbnail catalog stays below 600 KiB");
});
test("20-second opening starts after loading, holds movement/combat and does not consume match time", () => {
  assert.equal(OPENING_BUY_SECONDS, 20);
  assert.equal(RESPAWN_BUY_SECONDS, 10);
  const f = setup({ loadHandshake: true });
  f.game.loaded("a", f.room.loadEpoch);
  f.advance(30);
  f.game.tick();
  assert.equal(f.room.state, "loading");
  f.game.loaded("b", f.room.loadEpoch);
  f.advance(3.01);
  f.game.tick();
  assert.equal(f.room.state, "playing");
  assert.equal(f.a.buyUntil - f.game.now(), 20);
  assert.equal(f.room.endsAt - f.game.now(), 80);
  const mag = f.a.ammo[f.a.weapon].mag,
    position = { x: f.a.x, z: f.a.z };
  f.a.protectedUntil = f.b.protectedUntil = 0;
  f.game.input("a", {
    ...emptyInput(),
    seq: 1,
    spawnId: f.a.spawnId,
    yaw: 1,
    pitch: 0.2,
    forward: true,
  });
  f.advance(0.01);
  f.game.tick(); // Consume input before the normal stale-input timeout.
  f.advance(19.98);
  f.game.tick();
  assert.equal(f.a.x, position.x);
  assert.equal(f.a.z, position.z);
  assert.equal(f.a.yaw, 1, "looking around remains possible");
  f.game.fire(f.room, f.a);
  f.game.damage(f.room, f.b, 1000, f.a, "he");
  assert.equal(f.a.ammo[f.a.weapon].mag, mag);
  assert.equal(f.b.hp, 100);
  f.game.action("a", "switch", "he");
  f.game.throwGrenade(f.room, f.a);
  assert.equal(f.room.grenades.length, 0);
  f.game.snapshot(f.room);
  const state = f.events.at(-1).data;
  assert.equal(state.remaining, 60);
  assert.ok(state.openingRemaining > 0);
  f.advance(0.02);
  f.game.tick();
  assert.equal(f.room.combatStarted, true);
  assert.throws(() => f.buy("awp"), /ended/);
  f.game.damage(f.room, f.b, 25, f.a, "m4a4");
  assert.equal(f.b.hp, 75);
});
test("all playable items select into valid slots; mode-locked, malformed and lobby purchases are rejected", () => {
  const f = setup();
  assert.throws(() => f.game.choose("a", { primary: "awp" }), /waiting/);
  for (const item of BUY_ITEMS.filter((i) => i.available)) {
    f.advance(0.21);
    f.buy(item.id);
    assert.equal(f.a.weapon, item.id);
    if (FIREARMS.includes(item.id))
      assert.equal(f.a.slots[WEAPONS[item.id].slot], item.id);
    assert.equal(f.a.hp, 100);
    assert.equal(f.a.armor, 0);
  }
  f.advance(0.21);
  for (const id of [
    "bomb",
    "__proto__",
    "constructor",
    "unknown",
    null,
    ["awp"],
  ])
    assert.throws(() => f.buy(id), /unavailable/);
  f.game.finish(f.room);
  assert.throws(() => f.buy("awp"), /match/);
  f.game.returnRoom("a");
  assert.throws(() => f.game.choose("a", { primary: "awp" }), /Buy Menu/);
  assert.throws(() => f.game.choose("a", { secondary: "deagle" }), /Buy Menu/);
  f.game.choose("a", { team: "terrorists" });
  assert.equal(f.a.primary, "ak47");
  assert.throws(() => f.buy("awp"), /match/);
});
test("A-B-A swaps, repeated selection, previous loadout and drops never duplicate ammunition", () => {
  const f = setup();
  f.a.ammo.m4a4 = { mag: 7, reserve: 41 };
  f.buy("awp");
  f.advance(0.21);
  f.buy("m4a4");
  assert.deepEqual(f.a.ammo.m4a4, { mag: 7, reserve: 41 });
  f.advance(0.21);
  f.buy("m4a4");
  assert.deepEqual(f.a.ammo.m4a4, { mag: 7, reserve: 41 });
  assert.equal(
    f.room.drops.length,
    0,
    "menu replacements are not free dropped weapons",
  );
  const item = drop(f.room, f.a, f.game.now());
  f.advance(0.21);
  f.buy("m4a4");
  assert.deepEqual(item.ammo, { mag: 7, reserve: 41 });
  assert.deepEqual(f.a.ammo.m4a4, { mag: 0, reserve: 0 });
  assert.ok(pickup(f.room, f.a, item.id, f.game.now()));
  f.advance(0.21);
  f.buy("awp");
  f.advance(0.21);
  f.buy("m4a4");
  assert.deepEqual(f.a.ammo.m4a4, { mag: 7, reserve: 41 });
  assert.equal(
    f.room.drops.reduce((sum, d) => sum + d.ammo.mag + d.ammo.reserve, 0),
    0,
  );
});
test("buying cancels reload/queued fire, keeps shot cadence, and does not replenish spent grenades", () => {
  const f = setup();
  f.a.ammo.m4a4.mag = 6;
  f.game.action("a", "reload");
  const epoch = f.a.fireEpoch;
  f.a.shotCooldownUntil = f.game.now() + 1.5;
  f.a.pendingShot = { weapon: "m4a4" };
  f.a.fireArmed = true;
  f.buy("awp");
  assert.equal(f.a.reloadAt, 0);
  assert.equal(f.a.pendingShot, null);
  assert.equal(f.a.fireArmed, false);
  assert.ok(f.a.fireEpoch > epoch);
  assert.ok(f.a.nextFire >= f.a.shotCooldownUntil);
  f.advance(0.21);
  f.buy("m4a4");
  assert.equal(f.a.ammo.m4a4.mag, 6);
  for (const id of GRENADES) {
    f.a.grenades[id] = 0;
    f.advance(0.21);
    assert.throws(() => f.buy(id), /spent/);
    assert.equal(f.a.grenades[id], 0);
  }
  f.a.action = "throw";
  f.a.actionUntil = f.game.now() + 0.5;
  assert.throws(() => f.buy("awp"), /throwing/);
});
test("respawn grants exactly ten seconds, restores a valid default kit and remembers the previous selection", () => {
  const f = setup();
  f.buy("negev");
  f.advance(0.21);
  f.buy("deagle");
  const oldSpawn = f.a.spawnId;
  f.advance(20);
  f.game.tick();
  f.a.protectedUntil = 0;
  f.game.damage(f.room, f.a, 100, f.b, "ak47");
  assert.throws(() => f.buy("awp"), /alive/);
  f.advance(3.01);
  f.game.tick();
  assert.equal(f.a.spawnId, oldSpawn + 1);
  assert.equal(f.a.buyUntil - f.game.now(), 10);
  assert.equal(f.a.weapon, "m4a4");
  assert.deepEqual(f.a.previousLoadout, {
    primary: "negev",
    secondary: "deagle",
  });
  assert.throws(
    () =>
      f.game.buy("a", {
        itemId: "awp",
        spawnId: oldSpawn,
        epoch: f.room.loadEpoch,
      }),
    /earlier/,
  );
  f.buy("previous");
  assert.equal(f.a.weapon, "negev");
  assert.equal(f.a.slots.secondary, "deagle");
  const until = f.a.protectedUntil;
  f.advance(2);
  f.game.tick();
  assert.ok(f.a.buyUntil > f.game.now());
  assert.ok(f.a.protectedUntil < f.game.now());
  f.game.damage(f.room, f.a, 10, f.b, "ak47");
  assert.equal(f.a.hp, 90, "buy window is not ten seconds of invincibility");
  f.buy("awp");
  assert.equal(
    f.a.protectedUntil,
    until,
    "purchase does not extend protection",
  );
  f.advance(7.99);
  f.buy("m4a4");
  f.advance(0.01);
  assert.throws(() => f.buy("awp"), /ended/);
});
test("late, old-match, excessive and dead-player purchases do not mutate inventory", () => {
  const f = setup(),
    before = JSON.stringify(f.a.slots);
  assert.throws(
    () =>
      f.game.buy("a", { itemId: "awp", spawnId: f.a.spawnId, epoch: "old" }),
    /earlier/,
  );
  assert.equal(JSON.stringify(f.a.slots), before);
  f.buy("awp");
  assert.throws(() => f.buy("negev"), /wait/);
  assert.equal(f.a.weapon, "awp");
  f.advance(20);
  assert.throws(() => f.buy("negev"), /ended/);
  f.game.finish(f.room);
  assert.throws(() => f.buy("negev"), /match/);
});
test("private ammo ledgers stay off the wire while timers and previous selection round-trip", () => {
  const f = setup();
  f.buy("awp");
  f.game.snapshot(f.room);
  const state = unpackSnapshot(
    JSON.parse(JSON.stringify(packSnapshot(f.events.at(-1).data))),
  );
  assert.equal(state.openingRemaining, 20);
  assert.equal(state.remaining, 60);
  assert.equal(state.players[0].buyRemaining, 20);
  assert.equal(state.players[0].previousLoadout, null);
  assert.equal(state.players[0].buyAmmo, undefined);
  assert.equal(state.players[0].weapon, "awp");
});
test("bots use the same protected opening and server buy rules then resume normal combat", () => {
  const f = fixture({ openingBuySeconds: 20 }),
    bot = f.game.player(f.game.addBot("a", { difficulty: "hard" }).id);
  f.ready();
  f.game.start("a");
  const pos = { x: bot.x, z: bot.z },
    ammo = bot.ammo[bot.weapon].mag;
  for (let i = 0; i < 1199; i++) {
    f.advance(1 / 60);
    f.game.tick();
  }
  assert.equal(bot.x, pos.x);
  assert.equal(bot.z, pos.z);
  assert.equal(bot.ammo[bot.weapon].mag, ammo);
  assert.equal(f.room.grenades.length, 0);
  assert.equal(bot.botState.bought, true);
  f.advance(0.1);
  f.game.tick();
  for (let i = 0; i < 120; i++) {
    f.advance(1 / 60);
    f.game.tick();
  }
  assert.ok(Math.hypot(bot.x - pos.x, bot.z - pos.z) > 0.5);
});
