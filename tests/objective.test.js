import test from "node:test";
import assert from "node:assert/strict";
import { BombObjective } from "../server/objective.js";
const site = { id: "A", x: 0, z: 0, radius: 4 };
function fixture() {
  let time = 0;
  const events = [],
    bomb = new BombObjective({
      enabled: true,
      now: () => time,
      onEvent: (type) => events.push(type),
    }),
    t = {
      id: "t",
      team: "terrorists",
      x: 0,
      y: 0,
      z: 0,
      hp: 100,
      grounded: true,
      using: true,
    },
    s = { ...t, id: "s", team: "soldiers" },
    players = new Map([
      ["t", t],
      ["s", s],
    ]);
  return {
    bomb,
    t,
    s,
    players,
    events,
    advance: (n) => {
      time += n;
      bomb.tick(players);
    },
  };
}
test("objective is mode-gated; carrier, drop, pickup and planting work only for eligible players", () => {
  const f = fixture();
  assert.equal(new BombObjective().give(f.t), false);
  assert.equal(f.bomb.give(f.s), false);
  assert.equal(f.bomb.give(f.t), true);
  assert.equal(f.bomb.drop(f.t), true);
  assert.equal(f.bomb.pickup(f.s), false);
  assert.equal(f.bomb.pickup(f.t), true);
  assert.equal(f.bomb.plant(f.t, site), true);
  f.advance(2.9);
  assert.equal(f.bomb.state, "carried");
  f.advance(0.11);
  assert.equal(f.bomb.state, "planted");
  assert.equal(f.bomb.site, "A");
});
test("movement, death, releasing use and disconnect interrupt objective interactions", () => {
  for (const key of ["x", "hp", "using", "disconnect"]) {
    const f = fixture();
    f.bomb.give(f.t);
    f.bomb.plant(f.t, site);
    if (key === "disconnect") f.players.delete("t");
    else f.t[key] = key === "x" ? 1 : key === "hp" ? 0 : false;
    f.advance(3.2);
    assert.equal(
      f.bomb.state,
      key === "hp" || key === "disconnect" ? "dropped" : "carried",
    );
    assert.equal(f.bomb.progress, null);
  }
});
test("defuse succeeds after five seconds and cancels explosion", () => {
  const f = fixture();
  f.bomb.give(f.t);
  f.bomb.plant(f.t, site);
  f.advance(3);
  assert.equal(f.bomb.defuse(f.s), true);
  f.advance(5);
  assert.equal(f.bomb.state, "defused");
  assert.equal(f.bomb.result, "soldiers");
  f.advance(50);
  assert.equal(f.bomb.state, "defused");
});
test("planted device beeps and explodes once after forty seconds", () => {
  const f = fixture();
  f.bomb.give(f.t);
  f.bomb.plant(f.t, site);
  f.advance(3);
  assert.ok(f.events.includes("beep"));
  f.advance(40);
  assert.equal(f.bomb.state, "exploded");
  assert.equal(f.bomb.result, "terrorists");
  f.advance(10);
  assert.equal(f.events.filter((e) => e === "explosion").length, 1);
});
