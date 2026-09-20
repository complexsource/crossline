import test from "node:test";
import assert from "node:assert/strict";
import { WEAPONS, FIREARMS, emptyInput, TICK, move } from "../shared/game.js";
import { fixture, lineUp } from "./helpers.js";

test("room codes, names, capacity, host-only control, ready state and auto-balance", () => {
  const f = fixture(),
    { game, room } = f;
  assert.match(room.code, /^[A-Z0-9]{6}$/);
  assert.throws(() => game.start("b"), /host/);
  assert.throws(() => game.start("a"), /ready/);
  assert.throws(() => game.enter("z", "\u0001"), /name/);
  assert.throws(() => game.enter("z", "z", "BAD123"), /not found/);
  assert.throws(() => game.enter("a", "duplicate"), /Leave/);
  for (let i = 2; i < 10; i++) game.enter(String(i), "Player " + i, room.code);
  assert.throws(() => game.enter("extra", "Extra", room.code), /full/);
  for (const p of room.players.values())
    game.choose(p.id, { team: "soldiers", ready: true });
  game.start("a");
  assert.equal(
    [...room.players.values()].filter((p) => p.team === "soldiers").length,
    5,
  );
  assert.equal(room.state, "playing");
  assert.throws(() => game.choose("a", { team: "terrorists" }), /waiting/);
  assert.throws(() => game.enter("late", "Late", room.code), /started/);
});
test("load handshake excludes asset loading from match clock and rejects stale epochs", () => {
  const f = fixture({ loadHandshake: true }),
    { game, room } = f;
  f.ready();
  game.start("a");
  assert.equal(room.state, "loading");
  assert.equal(room.endsAt, undefined);
  game.loaded("a", "old");
  assert.equal(game.player("a").loaded, false);
  game.loaded("a", room.loadEpoch);
  f.advance(20);
  game.tick();
  assert.equal(room.state, "loading");
  game.loaded("b", room.loadEpoch);
  assert.equal(room.state, "countdown");
  f.advance(2.99);
  game.tick();
  assert.equal(room.state, "countdown");
  f.advance(0.02);
  game.tick();
  assert.equal(room.state, "playing");
  assert.equal(room.endsAt - game.now(), 60);
});
test("loading timeout and disconnect return safely to the same room", () => {
  const f = fixture({ loadHandshake: true });
  f.ready();
  f.game.start("a");
  f.advance(121);
  f.game.tick();
  assert.equal(f.room.state, "lobby");
  assert.ok(f.room.notice);
  f.ready();
  f.game.start("a");
  f.game.leave("b");
  assert.equal(f.room.state, "lobby");
  assert.equal(f.room.players.size, 1);
});
test("headshot, damage, cadence, kill, score and three-second respawn are server owned", () => {
  const f = fixture(),
    { a, b } = lineUp(f),
    w = WEAPONS[a.weapon];
  f.game.fire(f.room, a);
  assert.equal(b.hp, 100 - Math.round(w.damage * w.headshot));
  const hp = b.hp;
  f.game.fire(f.room, a);
  assert.equal(b.hp, hp);
  f.advance(w.interval + 0.01);
  f.game.fire(f.room, a);
  assert.equal(b.hp, 0);
  assert.equal(a.kills, 1);
  assert.equal(a.headshots, 1);
  assert.equal(a.damage, 100);
  assert.equal(b.deaths, 1);
  assert.equal(f.room.scores.soldiers, 1);
  assert.equal(f.room.drops.length, 1);
  f.advance(2.9);
  f.game.tick();
  assert.equal(b.hp, 0);
  f.advance(0.11);
  f.game.tick();
  assert.equal(b.hp, 100);
  assert.equal(b.spawnId, 2);
  assert.equal(b.deaths, 1);
  assert.deepEqual(b.grenades, { he: 1, flash: 1, smoke: 1 });
});
test("body hits, walls, friendly fire and spawn protection", () => {
  const f = fixture(),
    { a, b } = lineUp(f);
  a.pitch = -0.2;
  f.game.fire(f.room, a);
  assert.equal(b.hp, 100 - WEAPONS[a.weapon].damage);
  const hp = b.hp;
  f.advance(0.3);
  a.pitch = 0;
  b.protectedUntil = 1000;
  f.game.fire(f.room, a);
  assert.equal(b.hp, hp);
  b.protectedUntil = 0;
  f.advance(0.3);
  b.team = a.team;
  f.game.fire(f.room, a);
  assert.equal(b.hp, hp);
  b.team = "terrorists";
  f.advance(0.3);
  Object.assign(a, { x: -29, z: 0 });
  Object.assign(b, { x: -29, z: -8 });
  f.game.fire(f.room, a);
  assert.equal(b.hp, hp, "building blocks hits");
});
test("all 34 firearms and the range-limited knife use configured damage and ammo", () => {
  assert.equal(FIREARMS.length, 34);
  for (const id of [...FIREARMS, "knife"]) {
    const f = fixture(),
      { a, b } = lineUp(f);
    a.weapon = id;
    a.ammo[id] = { mag: WEAPONS[id].mag, reserve: WEAPONS[id].reserve };
    if (id === "knife") b.z = -15.5;
    f.game.fire(f.room, a);
    assert.ok(b.hp < 100, id);
    if (id !== "knife") assert.equal(a.ammo[id].mag, WEAPONS[id].mag - 1);
  }
  const f = fixture(),
    { a, b } = lineUp(f);
  a.weapon = "knife";
  b.z = -20;
  f.game.fire(f.room, a);
  assert.equal(b.hp, 100);
});
test("reload completion, ammo conservation, cancellation, previous and owned-only switches", () => {
  const f = fixture(),
    { a } = lineUp(f),
    id = a.weapon;
  a.ammo[id].mag = 0;
  f.game.action("a", "reload");
  f.advance(WEAPONS[id].reload + 0.01);
  f.game.tick();
  assert.equal(a.ammo[id].mag, WEAPONS[id].mag);
  assert.equal(a.ammo[id].reserve, WEAPONS[id].reserve - WEAPONS[id].mag);
  a.ammo[id].mag = 10;
  f.game.action("a", "reload");
  f.game.action("a", "switch", "secondary");
  assert.equal(a.reloadAt, 0);
  assert.equal(a.weapon, a.secondary);
  f.game.action("a", "switch", "awp");
  assert.equal(a.weapon, a.secondary);
  f.game.action("a", "switch", "previous");
  assert.equal(a.weapon, id);
  f.game.action("a", "switch", "grenade");
  assert.equal(a.weapon, "he");
  f.game.action("a", "switch", "grenade");
  assert.equal(a.weapon, "flash");
  f.game.action("a", "switch", "grenade");
  assert.equal(a.weapon, "smoke");
});
test("HE, Flash and Smoke inventory, effects and lifetime are authoritative", () => {
  const f = fixture(),
    { a, b } = lineUp(f);
  f.game.action("a", "switch", "grenade");
  f.advance(0.21);
  f.game.throwGrenade(f.room, a);
  assert.equal(a.grenades.he, 0);
  assert.equal(f.room.grenades.length, 1);
  assert.equal(a.weapon, "he", "throw keeps grenade until animation ends");
  f.advance(0.56);
  f.game.tick();
  assert.equal(a.weapon, a.primary);
  b.hp = 10;
  f.game.detonate(f.room, {
    kind: "he",
    owner: "a",
    team: "soldiers",
    x: b.x,
    y: 1,
    z: b.z,
  });
  assert.equal(b.hp, 0);
  assert.equal(a.kills, 1);
  f.game.spawn(f.room, b);
  Object.assign(b, { x: -10, y: 0, z: -17, protectedUntil: 0 });
  f.game.detonate(f.room, {
    kind: "smoke",
    id: "smoke1",
    x: -10,
    y: 0,
    z: -17,
  });
  assert.equal(f.room.smokes[0].radius, 4.6);
  f.advance(15.1);
  f.game.tick();
  assert.equal(f.room.smokes.length, 0);
});
test("flash exposure respects facing, distance and wall obstruction", () => {
  const f = fixture(),
    { a, b } = lineUp(f),
    g = {
      kind: "flash",
      owner: "a",
      team: "soldiers",
      x: -10,
      y: 1.62,
      z: -14,
    };
  b.yaw = Math.PI;
  f.game.detonate(f.room, g);
  const forward = f.events
    .filter((e) => e.target === "b" && e.type === "flash")
    .at(-1).data.strength;
  b.yaw = 0;
  f.game.detonate(f.room, g);
  const behind = f.events
    .filter((e) => e.target === "b" && e.type === "flash")
    .at(-1).data.strength;
  assert.ok(forward > behind * 3);
  const n = f.events.length;
  Object.assign(b, { x: -29, z: -8 });
  f.game.detonate(f.room, { ...g, x: -29, z: 0 });
  assert.equal(
    f.events.slice(n).filter((e) => e.type === "flash" && e.target === "b")
      .length,
    0,
  );
});
test("input rejects tampered state, nonfinite values, stale sequence and old spawn packets", () => {
  const f = fixture(),
    { a } = lineUp(f);
  f.game.input("a", {
    ...emptyInput(),
    seq: 1,
    spawnId: a.spawnId,
    yaw: NaN,
    x: 999,
    hp: 999,
  });
  assert.equal(a.receivedSeq, 0);
  f.game.input("a", {
    ...emptyInput(),
    seq: 1,
    spawnId: a.spawnId,
    x: 999,
    hp: 999,
  });
  f.game.tick();
  assert.notEqual(a.x, 999);
  assert.equal(a.hp, 100);
  assert.equal(a.ack, 1);
  f.game.input("a", {
    ...emptyInput(),
    seq: 1,
    spawnId: a.spawnId,
    forward: true,
  });
  assert.equal(a.input.forward, false);
  f.game.input("a", {
    ...emptyInput(),
    seq: 2,
    spawnId: a.spawnId - 1,
    forward: true,
  });
  assert.equal(a.input.forward, false);
});
test("a short click between simulation ticks fires once without bypassing cadence", () => {
  const f = fixture(),
    { a, b } = lineUp(f);
  const mag = a.ammo[a.weapon].mag;
  f.game.action("a", "fire", {
    yaw: 0,
    pitch: 0,
    aim: false,
    spawnId: a.spawnId,
    fireEpoch: a.fireEpoch, weapon: a.weapon, pressId: 1,
  });
  f.game.tick();
  assert.equal(a.ammo[a.weapon].mag, mag - 1);
  f.game.action("a", "fire", {
    yaw: 0,
    pitch: 0,
    aim: false,
    spawnId: a.spawnId,
    fireEpoch: a.fireEpoch, weapon: a.weapon, pressId: 2,
  });
  f.game.tick();
  assert.equal(a.ammo[a.weapon].mag, mag - 1);
  assert.ok(b.hp < 100);
});
test("results save exactly once, keep stats, replay resets, host transfer and cleanup", () => {
  const f = fixture();
  f.ready();
  f.game.start("a");
  f.room.scores.terrorists = 3;
  f.advance(61);
  f.game.tick();
  f.game.finish(f.room);
  assert.equal(f.saved.length, 1);
  assert.equal(f.room.results.winner, "terrorists");
  assert.equal(f.room.results.players.length, 2);
  assert.throws(() => f.game.returnRoom("b"), /host/);
  f.game.returnRoom("a");
  f.ready();
  f.game.start("a");
  assert.equal(f.room.scores.terrorists, 0);
  f.game.leave("a");
  assert.equal(f.room.host, "b");
  assert.equal(f.room.state, "results");
  f.game.leave("b");
  assert.equal(f.game.rooms.size, 0);
});
