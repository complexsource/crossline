import test from "node:test";
import assert from "node:assert/strict";
import { Game } from "../server/game.js";
import {
  getBotNavigation,
  PATROL_POINTS,
  walkSegment,
} from "../server/bot-navigation.js";
import { canSeeEnemy, planBotGrenade, resetBot } from "../server/bots.js";
import { BOT_DIFFICULTIES } from "../shared/bots.js";
import { COASTLINE, spawnHeight } from "../shared/maps.js";
import { WEAPONS } from "../shared/weapons.js";
import { emptyInput } from "../shared/game.js";
import { packSnapshot, unpackSnapshot } from "../shared/snapshot.js";
import { matchAssetIds } from "../src/assets.js";

function fixture(options = {}) {
  let now = 100,
    seed = 321;
  const events = [],
    game = new Game(
      (target, type, data) => events.push({ target, type, data }),
      {
        now: () => now,
        random: () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296,
        loadHandshake: false,
        openingBuySeconds: 0,
        duration: 300,
        ...options,
      },
    );
  const room = game.enter("human", "Host");
  const add = (difficulty = "normal", team = "auto") =>
    game.player(game.addBot("human", { difficulty, team }).id);
  const tick = (seconds) => {
    for (let i = 0; i < Math.ceil(seconds * 60); i++) {
      now += 1 / 60;
      game.tick();
    }
  };
  const start = () => {
    game.choose("human", { ready: true });
    game.start("human");
  };
  return {
    game,
    room,
    events,
    add,
    tick,
    start,
    now: () => now,
    human: game.player("human"),
  };
}
function stage(f, p, position) {
  Object.assign(p, {
    ...position,
    vx: 0,
    vy: 0,
    vz: 0,
    grounded: true,
    crouch: false,
    hp: 100,
    protectedUntil: 0,
    action: "idle",
    actionUntil: 0,
    nextFire: 0,
    shotCooldownUntil: 0,
    pitch: 0,
    input: emptyInput(),
  });
  if (p.bot) resetBot(p, f.now());
}
test("only the human host manages bots, validates difficulty/team and obeys room capacity", () => {
  const f = fixture();
  f.game.enter("peer", "Peer", f.room.code);
  assert.throws(() => f.game.addBot("peer"), /host/);
  for (const difficulty of ["impossible", "__proto__", null, 4, ["hard"]])
    assert.throws(() => f.game.addBot("human", { difficulty }), /Choose/);
  assert.throws(() => f.game.addBot("human", { team: "purple" }), /valid team/);
  const bot = f.add("hard");
  assert.equal(bot.bot, true);
  assert.match(bot.name, /\[BOT\]/);
  assert.equal(bot.hp, undefined);
  assert.equal(bot.ready, true);
  assert.equal(bot.difficulty, "hard");
  assert.throws(
    () => f.game.configureBot("peer", { botId: bot.id, difficulty: "easy" }),
    /host/,
  );
  assert.throws(
    () => f.game.removeBot("human", { botId: "peer" }),
    /not found/,
  );
  const other = f.game.enter("other", "Other");
  assert.throws(
    () => f.game.configureBot("other", { botId: bot.id, team: "soldiers" }),
    /not found/,
  );
  f.game.configureBot("human", {
    botId: bot.id,
    difficulty: "easy",
    team: "soldiers",
  });
  assert.equal(bot.primary, "m4a4");
  assert.equal(bot.difficulty, "easy");
  f.game.configure("human", { playerLimit: 3 });
  assert.throws(() => f.add(), /full/);
  f.game.removeBot("human", { botId: bot.id });
  assert.equal(f.game.members.has(bot.id), false);
  f.game.enter("friend", "Friend", f.room.code);
  assert.equal(f.room.players.size, 3);
  assert.equal(other.players.size, 1);
});
test("one human plus a bot completes readiness/load handshake; bot does not wait for a socket", () => {
  const f = fixture({ loadHandshake: true, countdown: 0.1 }),
    bot = f.add();
  assert.throws(() => f.game.start("human"), /ready/);
  f.start();
  assert.equal(f.room.state, "loading");
  assert.equal(bot.loaded, true);
  assert.throws(() => f.add(), /waiting room/);
  assert.throws(
    () => f.game.removeBot("human", { botId: bot.id }),
    /waiting room/,
  );
  f.game.loaded("human", f.room.loadEpoch);
  assert.equal(f.room.state, "countdown");
  f.tick(0.2);
  assert.equal(f.room.state, "playing");
  assert.equal(bot.hp, 100);
  assert.notEqual(bot.team, f.human.team);
  for (const id of [bot.primary, bot.secondary])
    assert.equal(bot.ammo[id].mag, WEAPONS[id].mag);
  assert.deepEqual(bot.grenades, { he: 1, flash: 1, smoke: 1 });
});
test("bot buy cooldown and rejected selections cannot interrupt the room simulation", () => {
  const f = fixture(),
    bot = f.add("hard");
  f.start();
  f.game.spawn(f.room, bot);
  bot.nextBuy = f.now() + 0.25;
  let attempts = 0;
  f.game.buy = () => {
    attempts++;
    throw Error("Please wait for your equipment selection.");
  };
  f.tick(0.15);
  assert.equal(attempts, 0);
  assert.doesNotThrow(() => f.tick(0.25));
  assert.equal(attempts, 1);
  assert.equal(bot.botState.bought, true);
  assert.ok(WEAPONS[bot.weapon]);
  assert.equal(f.room.state, "playing");
});

test("balance prefers moving bots, retains human team and resets bots on same-room replay", () => {
  const f = fixture();
  for (let i = 0; i < 4; i++) f.add("normal", "soldiers");
  f.start();
  assert.equal(f.human.team, "soldiers");
  const teams = [...f.room.players.values()].reduce(
    (sum, p) => (sum[p.team]++, sum),
    { soldiers: 0, terrorists: 0 },
  );
  assert.ok(Math.abs(teams.soldiers - teams.terrorists) <= 1);
  const bot = [...f.room.players.values()].find((p) => p.bot);
  bot.kills = 5;
  bot.deaths = 3;
  f.game.finish(f.room);
  assert.equal(f.room.results.players.find((p) => p.id === bot.id).bot, true);
  const code = f.room.code;
  f.game.start("human");
  assert.equal(bot.kills, 0);
  assert.equal(bot.deaths, 0);
  assert.equal(f.room.code, code);
  assert.equal(bot.hp, 100);
  f.game.finish(f.room);
  f.game.returnRoom("human");
  assert.equal(bot.ready, true);
  assert.equal(f.human.ready, false);
});
test("host transfer skips bots and last-human departure destroys all bot room state in every phase", () => {
  for (const phase of ["lobby", "loading", "countdown", "playing", "results"]) {
    const f = fixture({ loadHandshake: true, countdown: 0.1 }),
      bot = f.add();
    if (phase !== "lobby") f.start();
    if (["countdown", "playing", "results"].includes(phase))
      f.game.loaded("human", f.room.loadEpoch);
    if (["playing", "results"].includes(phase)) f.tick(0.2);
    if (phase === "results") f.game.finish(f.room);
    assert.equal(f.room.state, phase);
    f.game.leave("human");
    assert.equal(f.game.rooms.size, 0);
    assert.equal(f.game.members.size, 0);
    assert.equal(f.room.players.size, 0);
    assert.equal(f.game.player(bot.id), undefined);
  }
  const f = fixture();
  f.add();
  f.game.enter("peer", "Peer", f.room.code);
  f.game.leave("human");
  assert.equal(f.room.host, "peer");
  f.game.addBot("peer");
  assert.equal(f.room.players.size, 3);
});
test("bot count is at most nine and loading timeout preserves bot readiness", () => {
  const f = fixture({ loadHandshake: true });
  for (let i = 0; i < 9; i++) f.add();
  assert.equal(
    new Set([...f.room.players.values()].map((p) => p.name)).size,
    10,
  );
  assert.throws(() => f.add(), /full/);
  assert.throws(() => f.game.enter("new", "New", f.room.code), /full/);
  f.start();
  f.tick(121);
  assert.equal(f.room.state, "lobby");
  assert.ok(
    [...f.room.players.values()].filter((p) => p.bot).every((p) => p.ready),
  );
  assert.equal(f.human.ready, false);
});
test("navigation connects all spawns and tactical routes without wall shortcuts", () => {
  const nav = getBotNavigation(),
    from = { x: -38, y: 0, z: 29 };
  assert.ok(nav.nodes.length < 10000);
  for (const goal of [
    ...Object.values(COASTLINE.spawns)
      .flat()
      .map((p) => ({ ...p, y: spawnHeight(p.x, p.z) })),
    ...PATROL_POINTS,
  ]) {
    const path = nav.path(from, goal);
    assert.ok(path.length, JSON.stringify(goal));
    for (let i = 1; i < path.length; i++)
      assert.ok(walkSegment(path[i - 1], path[i]), "every edge is traversable");
  }
  assert.equal(
    walkSegment({ x: -36, y: 0, z: -8 }, { x: -22, y: 0, z: -8 }),
    null,
    "cannot cut through house walls",
  );
});
test("real bot input walks across the map, climbs roof/tower stairs and crouches through the underpass", () => {
  for (const [from, to, needsCrouch] of [
    [{ x: -38, y: 0, z: 29 }, { x: 38, y: 0, z: 20 }, false],
    [{ x: -36.65, y: 0, z: -14.5 }, { x: -29, y: 4.56, z: -8 }, false],
    [{ x: -14, y: 0, z: -32 }, { x: 0, y: 5.3, z: -32 }, false],
    [{ x: -7, y: 0, z: 8 }, { x: 0, y: -1.3, z: -6 }, true],
  ]) {
    const f = fixture(),
      bot = f.add();
    f.start();
    f.human.hp = 0;
    f.human.respawnAt = Infinity;
    stage(f, bot, { ...from, yaw: 0 });
    bot.botState.nextThink = Infinity;
    bot.botState.path = getBotNavigation().path(from, to);
    bot.botState.goal = to;
    let reached = false,
      crouched = false;
    for (let i = 0; i < 2400; i++) {
      f.tick(1 / 60);
      crouched ||= bot.crouch;
      if (Math.hypot(bot.x - to.x, bot.y - to.y, bot.z - to.z) < 0.7) {
        reached = true;
        break;
      }
    }
    assert.ok(reached, JSON.stringify({ to, x: bot.x, y: bot.y, z: bot.z }));
    if (needsCrouch) assert.ok(crouched);
  }
});
test("perception respects field of view, distance, walls, smoke, flash blindness and teammates", () => {
  const f = fixture(),
    bot = f.add("hard");
  f.start();
  stage(f, bot, { x: -10, y: 0, z: -14, yaw: 0 });
  stage(f, f.human, { x: -10, y: 0, z: -20, yaw: Math.PI });
  assert.equal(canSeeEnemy(f.game, f.room, bot, f.human), true);
  bot.yaw = Math.PI;
  assert.equal(canSeeEnemy(f.game, f.room, bot, f.human), false);
  bot.yaw = 0;
  f.room.smokes = [
    { x: -10, y: 0, z: -17, radius: 4.6, start: f.now() - 2, end: f.now() + 5 },
  ];
  assert.equal(canSeeEnemy(f.game, f.room, bot, f.human), false);
  f.room.smokes = [];
  bot.flashUntil = f.now() + 2;
  bot.flashStrength = 1;
  assert.equal(canSeeEnemy(f.game, f.room, bot, f.human), false);
  bot.flashUntil = 0;
  const original = f.human.team;
  f.human.team = bot.team;
  assert.equal(canSeeEnemy(f.game, f.room, bot, f.human), false);
  f.human.team = original;
  stage(f, bot, { x: -36, y: 0, z: -8, yaw: -Math.PI / 2 });
  stage(f, f.human, { x: -23, y: 0, z: -8, yaw: 0 });
  assert.equal(canSeeEnemy(f.game, f.room, bot, f.human), false);
  stage(f, f.human, { x: 35, y: 0, z: -8, yaw: 0 });
  assert.equal(canSeeEnemy(f.game, f.room, bot, f.human), false);
});
test("bots have a real reaction delay and server-controlled damage, kills and three-second respawn", () => {
  for (const difficulty of Object.keys(BOT_DIFFICULTIES)) {
    const f = fixture(),
      bot = f.add(difficulty);
    f.start();
    stage(f, bot, { x: -10, y: 0, z: -14, yaw: 0 });
    stage(f, f.human, { x: -10, y: 0, z: -18, yaw: Math.PI });
    bot.botState.nextThink = f.now();
    const initial = bot.ammo[bot.weapon].mag;
    f.tick(BOT_DIFFICULTIES[difficulty].reaction * 0.7);
    assert.equal(bot.ammo[bot.weapon].mag, initial, difficulty);
    for (let i = 0; i < 900 && f.human.hp > 0; i++) f.tick(1 / 60);
    assert.equal(f.human.hp, 0, difficulty);
    assert.equal(f.human.deaths, 1);
    assert.equal(bot.kills, 1);
    assert.equal(f.room.scores[bot.team], 1);
    const spawn = f.human.spawnId;
    f.tick(2.8);
    assert.equal(f.human.spawnId, spawn);
    f.tick(0.3);
    assert.equal(f.human.spawnId, spawn + 1);
    assert.equal(f.human.hp, 100);
  }
});
test("normal/hard bots reload sensibly, seek cover and switch to real backup ammunition", () => {
  const f = fixture(),
    bot = f.add("normal");
  f.start();
  stage(f, bot, { x: -17, y: 0, z: -17, yaw: 0 });
  stage(f, f.human, { x: -17, y: 0, z: -23, yaw: Math.PI });
  bot.ammo[bot.weapon].mag = 0;
  f.tick(0.2);
  assert.ok(bot.reloadAt > f.now());
  assert.ok(
    bot.botState.coverUntil > f.now(),
    "seeks collision-based cover while reloading",
  );
  f.human.hp = 0;
  f.human.respawnAt = Infinity;
  bot.botState.target = null;
  bot.botState.memory = null;
  const reload = WEAPONS[bot.weapon].reload;
  f.tick(reload + 0.2);
  assert.ok(bot.ammo[bot.weapon].mag > 0);
  bot.ammo[bot.weapon] = { mag: 0, reserve: 0 };
  f.tick(0.1);
  assert.equal(bot.weapon, bot.secondary);
  assert.equal(bot.ammo[bot.weapon].mag, WEAPONS[bot.secondary].mag);
});
test("bot metadata survives compact snapshots without exposing private perception/path state", () => {
  const f = fixture(),
    bot = f.add("hard");
  f.start();
  f.tick(1);
  f.game.snapshot(f.room);
  const state = f.events.at(-1).data,
    packet = packSnapshot(state),
    decoded = unpackSnapshot(JSON.parse(JSON.stringify(packet)));
  const p = decoded.players.find((p) => p.id === bot.id);
  assert.equal(p.bot, true);
  assert.equal(p.difficulty, "hard");
  assert.equal(p.botState, undefined);
  assert.ok(!JSON.stringify(packet).includes("nextThink"));
  const assets = matchAssetIds(f.game.lobby(f.room).players);
  assert.ok(assets.includes(bot.primary) && assets.includes(bot.secondary));
});
test("normal bots follow moving teammates without following hidden enemies through walls", () => {
  const f = fixture(),
    bot = f.add("normal", "soldiers");
  f.add("easy", "terrorists");
  f.start();
  for (const p of f.room.players.values())
    if (p.bot && p !== bot) {
      p.hp = 0;
      p.respawnAt = Infinity;
    }
  stage(f, bot, { x: -10, y: 0, z: -14, yaw: 0 });
  stage(f, f.human, { x: -10, y: 0, z: -24, yaw: 0 });
  f.human.vz = -4;
  f.tick(1 / 60);
  assert.deepEqual(bot.botState.goal, {
    x: f.human.x,
    y: f.human.y,
    z: f.human.z,
  });
  f.human.team = "terrorists";
  stage(f, bot, { x: -10, y: 0, z: -14, yaw: 0 });
  stage(f, f.human, { x: -10, y: 0, z: -20, yaw: Math.PI });
  f.tick(0.2);
  assert.equal(bot.botState.target.id, f.human.id);
  const observed = { ...bot.botState.target };
  stage(f, f.human, { x: -30, y: 0, z: -8, yaw: 0 });
  f.tick(0.25);
  assert.equal(bot.botState.target, null);
  assert.deepEqual(
    bot.botState.memory,
    observed,
    "memory stores only the last visible observation",
  );
  assert.notEqual(bot.botState.memory.x, f.human.x);
  f.tick(3);
  assert.equal(bot.botState.memory, null, "hidden-target memory expires");
});
test("Hard bots throw real HE, flash and defensive smoke through the normal equipment pipeline", () => {
  for (const kind of ["he", "flash", "smoke"]) {
    const f = fixture(),
      bot = f.add("hard");
    f.start();
    stage(f, bot, { x: -10, y: 0, z: -14, yaw: Math.PI });
    stage(f, f.human, { x: -10, y: 0, z: 0, yaw: 0 });
    bot.grenades = {
      he: kind === "he" ? 1 : 0,
      flash: kind === "flash" ? 1 : 0,
      smoke: kind === "smoke" ? 1 : 0,
    };
    if (kind === "smoke") bot.hp = 40;
    // Seed an already observed target; exercise actual update/action/flight/detonation.
    Object.assign(bot.botState, {
      nextThink: Infinity,
      nextGrenade: 0,
      reactAt: 0,
      target: {
        id: f.human.id,
        x: f.human.x,
        y: 0,
        z: f.human.z,
        vx: 0,
        vz: 0,
        crouch: false,
        seenAt: f.now(),
      },
    });
    const primary = bot.weapon;
    for (let i = 0; i < 90 && bot.grenades[kind]; i++) f.tick(1 / 60);
    assert.equal(bot.grenades[kind], 0, kind);
    assert.equal(bot.action, "throw");
    assert.ok(
      f.events.some(
        (e) =>
          e.type === "fx" && e.data.type === "throw" && e.data.weapon === kind,
      ),
    );
    assert.equal(f.room.grenades.length, 1);
    bot.botState.target = null;
    bot.botState.nextThink = Infinity; // Observe the complete fuse without follow-up rifle fire.
    f.tick(3);
    assert.equal(bot.weapon, primary);
    assert.equal(f.room.grenades.length, 0);
    const event =
      kind === "he" ? "explosion" : kind === "flash" ? "flashbang" : "smoke";
    assert.ok(
      f.events.some((e) => e.type === "fx" && e.data.type === event),
      kind,
    );
    if (kind === "smoke") assert.equal(f.room.smokes.length, 1);
    if (kind === "flash")
      assert.ok(
        f.events.some(
          (e) =>
            e.type === "flash" &&
            e.target === f.human.id &&
            e.data.duration > 0,
        ),
      );
    if (kind === "he") assert.ok(f.human.hp < 100);
  }
});
test("grenade planning respects difficulty, inventory, cooldown, live effects and nearby friendlies", () => {
  const f = fixture(),
    bot = f.add("hard", "soldiers"),
    friend = f.add("normal", "soldiers");
  f.game.choose("human", { team: "terrorists", ready: true });
  f.start();
  stage(f, bot, { x: -10, y: 0, z: -14, yaw: Math.PI });
  stage(f, f.human, { x: -10, y: 0, z: 0, yaw: 0 });
  stage(f, friend, { x: 30, y: 0, z: 20, yaw: 0 });
  const setup = () =>
    Object.assign(bot.botState, {
      target: { ...f.human, seenAt: f.now() },
      reactAt: 0,
      nextGrenade: 0,
    });
  setup();
  bot.botState.reactAt = f.now() + 0.2;
  assert.equal(planBotGrenade(f.game, f.room, bot), null);
  assert.equal(
    bot.botState.nextGrenade,
    0,
    "reaction delay must not spend the grenade-search cooldown",
  );
  setup();
  assert.equal(planBotGrenade(f.game, f.room, bot).kind, "he");
  assert.equal(
    planBotGrenade(f.game, f.room, bot),
    null,
    "failed and successful searches are throttled",
  );
  for (const difficulty of ["easy", "normal"]) {
    setup();
    bot.difficulty = difficulty;
    assert.equal(planBotGrenade(f.game, f.room, bot), null);
  }
  bot.difficulty = "hard";
  setup();
  bot.grenades = { he: 0, flash: 0, smoke: 0 };
  assert.equal(planBotGrenade(f.game, f.room, bot), null);
  bot.grenades.he = 1;
  setup();
  f.room.grenades = [{}, {}, {}];
  assert.equal(planBotGrenade(f.game, f.room, bot), null);
  f.room.grenades = [];
  setup();
  stage(f, friend, { x: -10, y: 0, z: 0, yaw: 0 });
  assert.equal(
    planBotGrenade(f.game, f.room, bot),
    null,
    "no HE toss beside a teammate",
  );
  setup();
  bot.flashUntil = f.now() + 2;
  assert.equal(planBotGrenade(f.game, f.room, bot), null);
});
test("flash blindness stops bot fire and smoke stops reacquisition", () => {
  const f = fixture(),
    bot = f.add("hard");
  f.start();
  stage(f, bot, { x: -10, y: 0, z: -14, yaw: 0 });
  stage(f, f.human, { x: -10, y: 0, z: -20, yaw: Math.PI });
  f.tick(0.2);
  bot.flashUntil = f.now() + 2;
  bot.flashStrength = 1;
  const mag = bot.ammo[bot.weapon].mag;
  f.tick(1);
  assert.equal(bot.ammo[bot.weapon].mag, mag);
  assert.equal(bot.botState.target, null);
  stage(f, bot, { x: -10, y: 0, z: -14, yaw: 0 });
  f.room.smokes = [
    { x: -10, y: 0, z: -17, radius: 4.6, start: f.now() - 2, end: f.now() + 5 },
  ];
  f.tick(0.2);
  assert.equal(bot.botState.target, null);
  assert.equal(bot.ammo[bot.weapon].mag, mag);
});
test("simultaneous planned throws recheck projectile and smoke budgets at release", () => {
  for (const kind of ["he", "smoke"]) {
    const f = fixture(),
      bots = Array.from({ length: 4 }, () => f.add("hard"));
    f.start();
    f.human.hp = 0;
    f.human.respawnAt = Infinity;
    if (kind === "smoke")
      f.room.smokes = [0, 1].map((i) => ({
        id: String(i),
        x: 30,
        y: 0,
        z: 20 + i * 8,
        radius: 4.6,
        start: f.now(),
        end: f.now() + 15,
      }));
    for (const [index, bot] of bots.entries()) {
      stage(f, bot, { x: -10 + index, y: 0, z: -14, yaw: Math.PI });
      Object.assign(bot.botState, {
        nextThink: Infinity,
        nextGrenade: Infinity,
        grenade: { kind, yaw: Math.PI, pitch: 0.48, expires: f.now() + 1.5 },
      });
      f.game.action(bot.id, "switch", kind);
    }
    f.tick(0.5);
    assert.equal(f.room.grenades.length, kind === "he" ? 3 : 1);
    const throws = f.events.filter(
      (e) => e.type === "fx" && e.data.type === "throw",
    ).length;
    f.tick(2);
    assert.equal(
      f.events.filter((e) => e.type === "fx" && e.data.type === "throw").length,
      throws,
      "blocked plans expire instead of spamming throws",
    );
    if (kind === "smoke")
      assert.ok(f.room.smokes.length + f.room.grenades.length <= 3);
  }
});
test("90-second ten-player simulation stays finite, fights autonomously, and bounds expensive AI decisions", (t) => {
  const f = fixture();
  for (let i = 0; i < 9; i++) f.add(["easy", "normal", "hard"][i % 3]);
  f.start();
  const samples = [];
  let decisions = 0,
    paths = 0;
  for (let i = 0; i < 5400; i++) {
    const before = [...f.room.players.values()]
      .filter((p) => p.bot)
      .map((p) => ({
        p,
        ai: p.botState,
        d: p.botState.decisions,
        n: p.botState.paths,
      }));
    const start = performance.now();
    f.tick(1 / 60);
    samples.push(performance.now() - start);
    for (const old of before) {
      if (old.ai === old.p.botState) {
        decisions += old.ai.decisions - old.d;
        paths += old.ai.paths - old.n;
      }
    }
    for (const p of f.room.players.values())
      for (const k of ["x", "y", "z", "hp", "yaw", "pitch"])
        assert.ok(Number.isFinite(p[k]));
  }
  assert.ok(f.room.scores.soldiers + f.room.scores.terrorists > 10);
  assert.ok(decisions < 9 * 90 * 11, "expensive decisions do not run at 60 Hz");
  assert.ok(paths < 9 * 90 * 1.3);
  assert.ok(f.events.some((e) => e.type === "fx" && e.data.type === "reload"));
  assert.ok(f.events.some((e) => e.type === "fx" && e.data.type === "throw"));
  samples.sort((a, b) => a - b);
  t.diagnostic(
    JSON.stringify({
      decisions,
      paths,
      tickP95Ms: samples[Math.floor(samples.length * 0.95)],
      kills: f.room.scores,
    }),
  );
});
test("full ten-minute match with nine Hard bots stays bounded and replays cleanly", (t) => {
  const f = fixture({ duration: 600 });
  for (let i = 0; i < 9; i++) f.add("hard");
  f.start();
  let peakDrops = 0,
    peakGrenades = 0,
    peakSmokes = 0;
  for (let i = 0; i < 36001; i++) {
    f.tick(1 / 60);
    peakDrops = Math.max(peakDrops, f.room.drops.length);
    peakGrenades = Math.max(peakGrenades, f.room.grenades.length);
    peakSmokes = Math.max(peakSmokes, f.room.smokes.length);
    if (i % 60 === 0)
      for (const p of f.room.players.values()) {
        for (const key of ["x", "y", "z", "hp", "yaw", "pitch"])
          assert.ok(Number.isFinite(p[key]));
        if (p.bot) assert.ok(p.botState.path.length < 1000);
      }
  }
  assert.equal(f.room.state, "results");
  assert.equal(f.room.results.players.length, 10);
  assert.ok(f.room.scores.soldiers + f.room.scores.terrorists > 50);
  assert.ok(peakDrops <= 40);
  assert.ok(peakGrenades <= 3);
  assert.ok(peakSmokes <= 3);
  const kills = { ...f.room.scores };
  f.game.start("human");
  f.tick(10);
  assert.equal(f.room.state, "playing");
  assert.equal(f.room.players.size, 10);
  f.game.leave("human");
  assert.equal(f.game.rooms.size, 0);
  assert.equal(f.game.members.size, 0);
  t.diagnostic(JSON.stringify({ kills, peakDrops, peakGrenades, peakSmokes }));
});
