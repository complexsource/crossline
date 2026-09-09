import test from "node:test";
import assert from "node:assert/strict";
import { fixture, lineUp } from "./helpers.js";
import { FireButton, actionState } from "../shared/actions.js";
import { emptyInput, TICK } from "../shared/game.js";
import { WEAPONS } from "../shared/weapons.js";

function click(f, p, extra = {}) {
  return f.game.action(p.id, "fire", {
    yaw: p.yaw,
    pitch: p.pitch,
    spawnId: p.spawnId,
    weapon: p.weapon,
    fireEpoch: p.fireEpoch,
    pressId: (p.lastPressId || 0) + 1,
    ...extra,
  });
}
function hold(f, p, seconds, epoch = p.fireEpoch, weapon = p.weapon) {
  for (let i = 0; i < Math.ceil(seconds / TICK); i++) {
    f.advance(TICK);
    f.game.input(p.id, {
      ...emptyInput(),
      shoot: true,
      yaw: p.yaw,
      pitch: p.pitch,
      seq: p.receivedSeq + 1,
      spawnId: p.spawnId,
      fireEpoch: epoch,
      weapon,
    });
    f.game.tick();
  }
}
test("grenade click never fires returned pistol/rifle; throw rejects incompatible actions", () => {
  for (const initial of ["primary", "secondary", "knife"]) {
    const f = fixture(),
      { a } = lineUp(f);
    f.game.action(a.id, "switch", initial);
    hold(f, a, 0.25);
    const previous = a.weapon;
    f.game.action(a.id, "switch", "he");
    hold(f, a, 0.25);
    click(f, a);
    f.game.tick();
    assert.equal(actionState(a, f.game.now()), "THROWING_GRENADE");
    for (const [type, value] of [
      ["switch", "primary"],
      ["cycle", 1],
      ["drop"],
      ["pickup"],
      ["reload"],
    ])
      assert.equal(f.game.action(a.id, type, value), false, type);
    const oldEpoch = a.fireEpoch;
    hold(f, a, 1.2, oldEpoch, "he");
    assert.equal(a.weapon, previous);
    assert.equal(
      f.events.filter((e) => e.data?.type === "shot" && e.data?.id === a.id)
        .length,
      0,
    );
    if (previous !== "knife")
      assert.equal(a.ammo[previous].mag, WEAPONS[previous].mag);
    assert.equal(click(f, a), true);
    f.game.tick();
    assert.equal(
      f.events.filter((e) => e.data?.type === "shot" && e.data?.id === a.id)
        .length,
      1,
    );
  }
});
test("held fire, pending clicks and reordered packets do not survive switch/drop/pickup/reload/death", () => {
  for (const transition of ["switch", "drop", "pickup", "reload", "death"]) {
    const f = fixture(),
      { a, b } = lineUp(f);
    a.pitch = 1;
    click(f, a);
    f.game.tick();
    const oldEpoch = a.fireEpoch,
      oldWeapon = a.weapon;
    f.advance(0.15);
    click(f, a); // Queued, not yet simulated.
    if (transition === "switch") f.game.action(a.id, "switch", "secondary");
    if (transition === "drop") f.game.action(a.id, "drop");
    if (transition === "pickup") {
      Object.assign(b, { x: a.x, z: a.z });
      f.game.action(b.id, "drop");
      f.game.action(a.id, "pickup");
    }
    if (transition === "reload") f.game.action(a.id, "reload");
    if (transition === "death") {
      f.game.damage(f.room, a, 100, b, "ak47");
      f.game.spawn(f.room, a);
    }
    hold(f, a, 6, oldEpoch, oldWeapon);
    assert.equal(
      f.events.filter((e) => e.data?.type === "shot" && e.data?.id === a.id)
        .length,
      1,
      transition,
    );
    assert.equal(click(f, a, { fireEpoch: oldEpoch }), false);
    assert.equal(click(f, a), true, transition);
    f.game.tick();
    assert.equal(
      f.events.filter((e) => e.data?.type === "shot" && e.data?.id === a.id)
        .length,
      2,
      transition,
    );
  }
});
test("physical mouse/key hold must release before a new action can fire", () => {
  const button = new FireButton();
  assert.equal(button.press(true), true);
  button.cancel();
  assert.equal(button.press(true), false);
  assert.equal(button.active, false);
  button.release();
  assert.equal(button.press(false), false);
  assert.equal(
    button.press(true),
    false,
    "press during animation is consumed, not buffered",
  );
  button.release();
  assert.equal(button.press(true), true);
});
test("a held rifle press cannot leak through grenade selection, throw or return", () => {
  const f = fixture(),
    { a } = lineUp(f),
    button = new FireButton();
  a.pitch = 1;
  assert.equal(button.press(true), true);
  click(f, a);
  f.game.tick();
  const rifleEpoch = a.fireEpoch,
    rifle = a.weapon;
  f.game.action(a.id, "switch", "he");
  button.cancel();
  hold(f, a, 0.25, rifleEpoch, rifle);
  assert.equal(
    button.press(true),
    false,
    "still-held physical press is consumed",
  );
  assert.equal(click(f, a, { weapon: rifle, fireEpoch: rifleEpoch }), false);
  button.release();
  assert.equal(button.press(true), true);
  click(f, a);
  f.game.tick();
  button.cancel();
  const grenadeEpoch = a.fireEpoch;
  hold(f, a, 1.2, grenadeEpoch, "he");
  assert.equal(a.weapon, rifle);
  assert.equal(
    button.press(true),
    false,
    "throw press cannot become a rifle press",
  );
  assert.equal(a.ammo[rifle].mag, WEAPONS[rifle].mag - 1);
  button.release();
  assert.equal(button.press(true), true);
  assert.equal(click(f, a), true);
  f.game.tick();
  assert.equal(a.ammo[rifle].mag, WEAPONS[rifle].mag - 2);
});
test("switch cancels reload lock without shortening the last shot's fire cadence", () => {
  const f = fixture(),
    { a } = lineUp(f);
  a.ammo[a.weapon].mag = 1;
  f.game.action(a.id, "reload");
  f.game.action(a.id, "switch", "secondary");
  hold(f, a, 0.25);
  assert.equal(
    click(f, a),
    true,
    "sidearm need not wait for cancelled rifle reload",
  );
  f.game.tick();
});

test("every firearm refills at its own reload deadline and fires without extra delay", () => {
  for (const [id, weapon] of Object.entries(WEAPONS)) {
    if (!weapon.reload) continue;
    const f = fixture(),
      { a } = lineUp(f);
    a.weapon = id;
    a.ammo[id] = { mag: 1, reserve: weapon.mag * 2 };
    assert.equal(f.game.action(a.id, "reload"), true, id);
    const epoch = a.fireEpoch;
    f.advance(weapon.reload - 0.001);
    f.game.tick();
    assert.equal(a.ammo[id].mag, 1, `${id}: no early refill`);
    assert.equal(click(f, a), false, `${id}: no shot during reload`);
    f.advance(0.002);
    f.game.tick();
    assert.equal(a.ammo[id].mag, weapon.mag, `${id}: refill at deadline`);
    assert.equal(a.ammo[id].reserve, weapon.mag + 1, `${id}: ammo conserved`);
    assert.ok(a.fireEpoch > epoch, `${id}: old held input invalidated`);
    assert.equal(click(f, a), true, `${id}: immediately ready after refill`);
    f.game.tick();
    assert.equal(a.ammo[id].mag, weapon.mag - 1, `${id}: new press fires`);
  }
});
