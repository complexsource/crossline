import test from "node:test";
import assert from "node:assert/strict";
import { WEAPONS, FIREARMS, GRENADES } from "../shared/weapons.js";
import { canAim, aimFov } from "../shared/aim.js";
import {
  move,
  emptyInput,
  TICK,
  eyeHeight,
  playerHeight,
  overlaps,
} from "../shared/game.js";
import {
  grenadeLaunch,
  stepGrenade,
  GRENADE_FUSE,
} from "../shared/grenades.js";
import {
  GRENADE_RELEASE_SECONDS,
  GRENADE_THROW_SECONDS,
} from "../shared/actions.js";
import { CameraMotion } from "../src/camera-motion.js";
import { throwPose } from "../src/weapon-motion.js";
import { requestMouseCapture } from "../src/pointer-lock.js";
import { fixture, lineUp } from "./helpers.js";

const player = (extra = {}) => ({
  x: -10,
  y: 0,
  z: -14,
  vx: 0,
  vy: 0,
  vz: 0,
  yaw: 0,
  pitch: 0,
  grounded: true,
  crouch: false,
  stance: 0,
  hp: 100,
  spawnId: 1,
  weapon: "m4a4",
  reload: 0,
  action: "idle",
  actionTime: 0,
  ...extra,
});
const snapshot = (f) => {
  f.game.snapshot(f.room);
  return f.events.findLast((e) => e.type === "state").data;
};

test("mouse capture only falls back when raw input is unsupported", async () => {
  const calls = [];
  await requestMouseCapture({
    requestPointerLock(options) {
      calls.push(options);
      return Promise.resolve();
    },
  });
  assert.deepEqual(calls, [{ unadjustedMovement: true }]);
  calls.length = 0;
  await requestMouseCapture({
    requestPointerLock(options) {
      calls.push(options);
      return options
        ? Promise.reject(new DOMException("No raw input", "NotSupportedError"))
        : Promise.resolve();
    },
  });
  assert.deepEqual(calls, [{ unadjustedMovement: true }, undefined]);
});

test("mouse capture does not retry browser permission or rate-limit denials", async () => {
  for (const message of [
    "Permission denied",
    "Too many pointer lock requests in a short window of time.",
  ]) {
    let calls = 0;
    const error = new DOMException(message, "NotAllowedError");
    await assert.rejects(
      requestMouseCapture({
        requestPointerLock() {
          calls++;
          return Promise.reject(error);
        },
      }),
      (actual) => actual === error,
    );
    assert.equal(calls, 1);
  }
});

test("all weapons have finite ADS; all six optics zoom; equipment/death/actions cannot aim", () => {
  const scoped = [];
  for (const [id, w] of Object.entries(WEAPONS)) {
    const p = player({ weapon: id }),
      fov = aimFov(p, true);
    assert.ok(Number.isFinite(fov), id);
    assert.equal(canAim(p), FIREARMS.includes(id));
    if (w.scoped) {
      scoped.push(id);
      assert.ok(fov <= 42, id);
    }
    if (!FIREARMS.includes(id)) assert.equal(fov, 78, id);
  }
  assert.deepEqual(scoped.sort(), [
    "aug",
    "awp",
    "g3sg1",
    "scar20",
    "sg553",
    "ssg08",
  ]);
  for (const extra of [
    { hp: 0 },
    { reload: 1 },
    { action: "draw", actionTime: 0.1 },
    { action: "throw", actionTime: 0.4 },
  ])
    assert.equal(aimFov(player(extra), true), 78);
});

test("crouch/stand interpolates shared eye and capsule monotonically and obeys headroom", () => {
  const p = player();
  let previous = eyeHeight(p);
  for (let i = 0; i < 12; i++) {
    move(p, { ...emptyInput(), crouch: true }, TICK, []);
    const eye = eyeHeight(p);
    assert.ok(eye <= previous + 1e-8);
    assert.ok(previous - eye < 0.09);
    previous = eye;
    assert.ok(playerHeight(p) >= 1.25);
  }
  assert.equal(p.stance, 1);
  const ceiling = { x: -10, y: 1.5, z: -14, w: 3, h: 0.3, d: 3 };
  for (let i = 0; i < 20; i++) move(p, emptyInput(), TICK, [ceiling]);
  assert.equal(p.stance, 1);
  assert.equal(overlaps(p, ceiling), false);
  for (let i = 0; i < 12; i++) {
    move(p, emptyInput(), TICK, []);
    const eye = eyeHeight(p);
    assert.ok(eye >= previous - 1e-8);
    assert.ok(eye - previous < 0.09);
    previous = eye;
  }
  assert.equal(p.stance, 0);
});

test("ascending and descending shallow stairs keeps grounded; camera softens step edges", () => {
  const boxes = Array.from({ length: 6 }, (_, i) => ({
    x: -10,
    y: (i + 1) * 0.1,
    z: -14 - i * 0.6,
    w: 3,
    h: (i + 1) * 0.2,
    d: 0.6,
  }));
  const p = player({ z: -13 }),
    camera = new CameraMotion();
  let maxCameraDelta = 0,
    previous = camera.update(p, TICK).y,
    steps = 0;
  for (const forward of [true, false]) {
    for (let i = 0; i < 45; i++) {
      const before = p.y;
      move(p, { ...emptyInput(), forward, back: !forward }, TICK, boxes);
      const y = camera.update(p, TICK).y;
      maxCameraDelta = Math.max(maxCameraDelta, Math.abs(y - previous));
      previous = y;
      if (before !== p.y) steps++;
      assert.equal(p.grounded, true, JSON.stringify(p));
      assert.ok(!boxes.some((b) => overlaps(p, b)));
    }
  }
  assert.ok(steps >= 10);
  assert.ok(maxCameraDelta < 0.13, `camera delta ${maxCameraDelta}`);
  assert.ok(Math.abs(camera.step) <= 0.3);
  move(p, { ...emptyInput(), jump: true }, TICK, boxes);
  assert.ok(p.vy > 0 && !p.grounded, "step snap never cancels jumping");
});

test("camera settles without bob at rest and resets offsets on respawn", () => {
  const p = player(),
    camera = new CameraMotion();
  camera.update(p, TICK);
  p.y = 0.2;
  camera.update(p, TICK);
  for (let i = 0; i < 120; i++) camera.update(p, TICK);
  assert.ok(
    Math.abs(camera.update(p, TICK).y - (p.y + eyeHeight(p))) < 0.00001,
  );
  p.hp = 0;
  camera.update(p, TICK);
  assert.ok(camera.death > 0 && camera.death < 0.5);
  p.spawnId++;
  p.hp = 100;
  p.y = 0;
  assert.equal(camera.update(p, TICK).y, eyeHeight(p));
});

test("throw curve is continuous, bounded and releases at the shared authoritative beat", () => {
  let previous = throwPose(GRENADE_THROW_SECONDS),
    maxDelta = 0;
  for (
    let elapsed = 0.001;
    elapsed <= GRENADE_THROW_SECONDS;
    elapsed += 0.001
  ) {
    const pose = throwPose(GRENADE_THROW_SECONDS - elapsed);
    for (const value of [
      ...pose.position,
      pose.pitch,
      pose.arm,
      pose.pin,
      pose.reach,
    ])
      assert.ok(Number.isFinite(value));
    maxDelta = Math.max(
      maxDelta,
      ...pose.position.map((v, i) => Math.abs(v - previous.position[i])),
      Math.abs(pose.pitch - previous.pitch),
    );
    assert.equal(pose.released, elapsed >= GRENADE_RELEASE_SECONDS);
    previous = pose;
  }
  assert.ok(maxDelta < 0.03);
});

test("all three grenades reserve once, stay held until release, then finish exactly one fuse", () => {
  for (const kind of GRENADES) {
    const f = fixture(),
      { a } = lineUp(f);
    f.game.action(a.id, "switch", kind);
    f.advance(0.21);
    f.game.throwGrenade(f.room, a);
    f.game.throwGrenade(f.room, a);
    assert.equal(f.room.grenades.length, 1);
    assert.equal(a.grenades[kind], 0);
    const g = f.room.grenades[0],
      start = { x: g.x, y: g.y, z: g.z };
    for (let i = 0; i < 20; i++) {
      f.advance(TICK);
      f.game.tick();
    }
    assert.equal(g.released, false);
    assert.equal(snapshot(f).grenades.length, 0);
    assert.deepEqual({ x: g.x, y: g.y, z: g.z }, start);
    for (let i = 0; i < 3; i++) {
      f.advance(TICK);
      f.game.tick();
    }
    assert.equal(g.released, true);
    assert.equal(snapshot(f).grenades.length, 1);
    assert.equal(
      f.events.filter((e) => e.data?.type === "grenadeRelease").length,
      1,
    );
    assert.ok(g.explodeAt > f.game.now() + GRENADE_FUSE[kind] - 0.04);
    for (let i = 0; i < 160; i++) {
      f.advance(TICK);
      f.game.tick();
    }
    assert.equal(f.room.grenades.length, 0);
    const effect = { he: "explosion", flash: "flashbang", smoke: "smoke" }[
      kind
    ];
    assert.equal(f.events.filter((e) => e.data?.type === effect).length, 1);
  }
});

test("grenade launches from current position and aim at release, not an obsolete click direction", () => {
  const f = fixture(),
    { a } = lineUp(f);
  f.game.action(a.id, "switch", "he");
  f.advance(0.21);
  f.game.throwGrenade(f.room, a);
  a.input.yaw = Math.PI / 2;
  for (let i = 0; i < 23; i++) {
    f.advance(TICK);
    f.game.tick();
  }
  const g = f.room.grenades[0];
  assert.equal(g.released, true);
  assert.ok(g.vx < -10);
  assert.ok(Math.abs(g.vz) < 0.01);
});

test("death during windup drops the primed grenade instead of deleting or throwing it", () => {
  const f = fixture(),
    { a } = lineUp(f);
  f.game.action(a.id, "switch", "he");
  f.advance(0.21);
  f.game.throwGrenade(f.room, a);
  a.hp = 0;
  f.advance(TICK);
  f.game.tick();
  const g = f.room.grenades[0];
  assert.equal(g.released, true);
  assert.equal(g.vx, 0);
  assert.equal(g.vz, 0);
  for (let i = 0; i < 130; i++) {
    f.advance(TICK);
    f.game.tick();
  }
  assert.equal(f.room.grenades.length, 0);
  assert.ok(f.events.some((e) => e.data?.type === "explosion"));
});

test("grenades sweep against thin walls and launches beside cover never begin inside it", () => {
  const wall = { x: -10, y: 2, z: -14.38, w: 4, h: 4, d: 0.02 };
  const g = grenadeLaunch(player(), [wall]);
  assert.ok(g.z > -14.25);
  Object.assign(g, { x: -10, y: 1.5, z: -14, vx: 0, vy: 0, vz: -100 });
  const impact = stepGrenade(g, TICK, [wall]);
  assert.ok(impact >= 100);
  assert.ok(g.z > -14.25);
  assert.ok(g.vz > 0);
});
