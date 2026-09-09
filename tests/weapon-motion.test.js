import test from "node:test";
import assert from "node:assert/strict";
import { WEAPONS, FIREARMS } from "../shared/weapons.js";
import { weaponPose, reloadPose, equipmentPose } from "../src/weapon-motion.js";

test("all firearm presentation curves are finite, rest when idle, and return at reload completion", () => {
  for (const id of FIREARMS) {
    assert.ok(weaponPose(id).scale > 0);
    for (const progress of [0, 0.1, 0.3, 0.5, 0.8, 0.95, 1]) {
      const pose = reloadPose(id, WEAPONS[id].reload * (1 - progress));
      assert.ok(
        [...pose.magazine, ...pose.support, pose.tilt, pose.bolt].every(
          Number.isFinite,
        ),
        id,
      );
    }
    assert.ok(reloadPose(id, 0).magazine.every((v) => v === 0));
  }
});
test("top-loading and tubular weapons have different reload choreography", () => {
  assert.ok(reloadPose("p90", WEAPONS.p90.reload * 0.5).magazine[1] > 0);
  assert.ok(reloadPose("ak47", WEAPONS.ak47.reload * 0.5).magazine[1] < 0);
  assert.equal(reloadPose("nova", 1).tube, true);
});
test("objective visual states do not require or modify a game room", () => {
  assert.equal(equipmentPose("planted").pulse, 1);
  assert.equal(equipmentPose("dropped").pulse, 0);
  assert.equal(equipmentPose("pickup", 1).lower, 0);
  assert.ok(equipmentPose("planting", 1).lower > 0);
});
