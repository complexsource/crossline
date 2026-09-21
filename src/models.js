import * as THREE from "three";
import { WEAPONS } from "../shared/weapons.js";
import { stanceBlend } from "../shared/game.js";
import { TEAMS } from "../shared/teams.js";
import { instance, worldWeaponInstance } from "./assets.js";
import {
  radialTexture,
  joint,
  material,
  disposeModel as disposeGeometryModel,
} from "./geometry.js";
import { viewHand, updateViewArms } from "./view-hands.js";
import {
  weaponPose,
  reloadPose,
  equipmentPose,
  throwPose,
  smooth,
} from "./weapon-motion.js";
export { material, radialTexture };
export function disposeModel(group) {
  // SkeletonUtils clones own GPU bone textures, unlike the shared model meshes.
  // Dispose once per skeleton (several material meshes can use the same rig).
  const skeletons = new Set();
  group.traverse((node) => {
    if (node.isSkinnedMesh) skeletons.add(node.skeleton);
  });
  for (const skeleton of skeletons) skeleton.dispose();
  disposeGeometryModel(group);
}
export const makeGrenade = (kind = "he") => {
  const model = instance(kind);
  for (const name of ["pin", "pullRing", "spoon"]) {
    const part = model.getObjectByName(name);
    if (part) part.visible = false;
  }
  return model;
};
export function makeGun(id, firstPerson = false, team = "soldiers") {
  const g = firstPerson ? instance(id) : worldWeaponInstance(id),
    muzzle = g.getObjectByName("muzzle"),
    flash = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: radialTexture("flash"),
        color: 0xffd29b,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
  flash.scale.setScalar(
    WEAPONS[id].suppressed
      ? 0.11
      : WEAPONS[id].type === "SHOTGUN"
        ? 0.38
        : 0.24,
  );
  flash.visible = false;
  flash.userData.ownedMaterial = true;
  if (muzzle) {
    muzzle.add(flash);
  } else g.add(flash);
  const magazines = [],
    bolts = [];
  g.traverse((o) => {
    if (o.name === "magazine") magazines.push(o);
    if (o.name === "bolt") bolts.push(o);
  });
  const support = joint(g, 0, 0, 0);
  const payloadMeshes = [];
  g.traverse((o) => {
    if (o.isMesh) payloadMeshes.push(o);
  });
  let supportRest, triggerHand;
  const viewHands = [];
  if (firstPerson) {
    const pose = weaponPose(id),
      rugged = team === "terrorists";
    // A controller is carried screen-in, unlike a rifle's forward-facing muzzle.
    const payload = g.getObjectByName(id);
    if (id === "bomb" && payload && payload !== g)
      payload.rotation.y += Math.PI;
    triggerHand = joint(g, ...pose.grip);
    if (pose.equipment)
      triggerHand.position.set(
        id === "bomb" ? 0.19 : 0.021,
        id === "bomb" ? -0.08 : -0.028,
        0.052,
      );
    const rightHand = viewHand(triggerHand, {
      rugged,
      kind: pose.equipment ? "equipment" : "grip",
    });
    viewHands.push({ hand: rightHand, left: false });
    g.add(rightHand.userData.arm);
    support.position.set(...pose.support);
    if (pose.equipment)
      support.position.set(
        id === "bomb" ? -0.19 : -0.12,
        id === "bomb" ? -0.08 : 0.11,
        0.038,
      );
    if (id === "dualberettas") support.position.set(-0.13, -0.12, 0.09);
    if (id === "knife") support.position.set(-0.25, -0.025, -0.15);
    supportRest = support.position.clone();
    const supportHand = viewHand(support, {
      left: true,
      rugged,
      kind:
        id === "dualberettas"
          ? "grip"
          : id === "knife"
            ? "open"
            : pose.pistol
              ? "pistolSupport"
              : pose.equipment
                ? "equipment"
                : "under",
    });
    support.userData.hand = supportHand;
    support.userData.handRest = supportHand.rotation.clone();
    viewHands.push({ hand: supportHand, left: true });
    g.add(supportHand.userData.arm);
    g.traverse((o) => {
      o.layers.set(1);
      if (o.isMesh) o.castShadow = o.receiveShadow = false;
    });
    flash.layers.set(1);
  }
  g.userData = {
    flash,
    muzzle,
    magazines,
    bolts,
    pump: g.getObjectByName("pump"),
    support,
    supportRest,
    triggerHand,
    viewHands,
    topCover: g.getObjectByName("topCover"),
    chargingHandle: g.getObjectByName("chargingHandle"),
    pin: g.getObjectByName("pullRing") || g.getObjectByName("pin"),
    spoon: g.getObjectByName("spoon"),
    payloadMeshes,
    draw: 1,
    led: g.getObjectByName("led"),
  };
  return g;
}
export function animateGun(
  g,
  id,
  reload,
  kick,
  dt = 1 / 60,
  action = "idle",
  actionTime = 0,
) {
  const u = g.userData,
    w = WEAPONS[id],
    pose = reloadPose(id, reload);
  for (const m of u.magazines) {
    if (!m.userData.restPosition) m.userData.restPosition = m.position.clone();
    m.position.copy(m.userData.restPosition);
    if (!pose.tube) {
      m.position.x += pose.magazine[0];
      m.position.y += pose.magazine[1];
      m.position.z += pose.magazine[2];
    }
    m.rotation.x = pose.tube ? 0 : pose.magazineAngle;
  }
  for (const b of u.bolts) {
    b.position.z = id === "r8" ? 0 : Math.max(kick, pose.bolt) * 0.065;
    if (id === "r8") {
      b.position.x = -pose.cylinder * 0.085;
      b.rotation.z = pose.cylinder * 0.55;
    }
  }
  if (u.pump) u.pump.position.z = kick * 0.12;
  if (u.topCover) u.topCover.rotation.x = pose.cover;
  if (u.chargingHandle) u.chargingHandle.position.z = pose.bolt * 0.07;
  if (u.supportRest) {
    u.support.position.copy(u.supportRest);
    u.support.position.add(new THREE.Vector3(...pose.support));
    u.support.rotation.set(pose.tilt * -0.15, 0, pose.seat * -0.12);
    if (u.support.userData.hand) {
      u.support.userData.hand.rotation.copy(u.support.userData.handRest);
      u.support.userData.hand.rotation.x *= 1 - Math.max(pose.grab, pose.rack);
    }
    if (w.type === "GRENADE") {
      const motion = action === "throw" ? throwPose(actionTime) : null;
      const reach = motion?.reach || 0;
      u.support.position.x -= 0.12 * (1 - reach) + (motion?.pin || 0) * 0.05;
      u.support.position.y -= 0.22 * (1 - reach);
      u.support.position.z += 0.06 * (1 - reach);
      if (u.pin) {
        u.pin.userData.restPosition ||= u.pin.position.clone();
        u.pin.position.copy(u.pin.userData.restPosition);
        u.pin.position.x -= (motion?.pin || 0) * 0.1;
        u.pin.visible = !motion?.released;
      }
    }
    if (id === "bomb" && ["planting", "pickup"].includes(action)) {
      const device = equipmentPose(action, 1 - actionTime);
      u.support.position.y -= device.lower;
      u.support.position.z += device.tap;
    }
  }
  if (w.type === "GRENADE") {
    const motion = action === "throw" ? throwPose(actionTime) : null;
    const released = !!motion?.released;
    for (const mesh of u.payloadMeshes) mesh.visible = !released;
    if (u.spoon) u.spoon.visible = !released;
    const opening = smooth(((motion?.phase || 0) - 0.43) / 0.17);
    for (const { hand, left } of u.viewHands) {
      if (left) continue;
      for (const finger of hand.userData.fingers) {
        const angle = -0.8 * opening;
        finger.rotation.y = angle;
        // Rotate about the authored knuckle, not the wrist/group origin.
        finger.position.x =
          0.058 - (Math.cos(angle) * 0.058 + Math.sin(angle) * 0.013);
        finger.position.z =
          0.013 - (-Math.sin(angle) * 0.058 + Math.cos(angle) * 0.013);
      }
    }
  }
  u.draw = Math.max(0, u.draw - dt * 4.5);
  updateViewArms(g);
  if (u.led) u.led.visible = Math.sin(performance.now() / 160) > 0;
}
export function makePlayer(name, team, lowDetail = false) {
  const root = instance(TEAMS[team].model + (lowDetail ? "-lod" : "")),
    find = (n) => root.getObjectByName(n),
    body = find("body"),
    mixer = new THREE.AnimationMixer(root),
    actions = {};
  let rigMetadata = body?.userData.crosslineRig || root.userData.crosslineRig;
  root.traverse((node) => {
    rigMetadata ||= node.userData.crosslineRig;
  });
  const importedRig = rigMetadata?.version === 1;
  if (importedRig) {
    for (const joint of [
      "body",
      "head",
      "weaponPivot",
      ...[0, 1].flatMap((side) =>
        ["arm", "elbow", "wrist", "leg", "knee", "ankle"].map(
          (part) => part + side,
        ),
      ),
    ])
      if (!find(joint))
        throw new Error(`Character ${team} is missing rig joint ${joint}`);
  }
  for (const clip of root.animations) {
    // Combat poses are layered by animatePlayer; unknown authored clips must
    // never accidentally receive the walk blend weight.
    if (!["idle", "walk", "run"].includes(clip.name)) continue;
    actions[clip.name] = mixer.clipAction(clip);
    actions[clip.name].play();
    actions[clip.name].setEffectiveWeight(clip.name === "idle" ? 1 : 0);
  }
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 80;
  const x = c.getContext("2d");
  x.fillStyle = "rgba(11,35,38,.7)";
  x.roundRect(4, 4, 504, 70, 12);
  x.fill();
  x.font = "600 32px Arial";
  x.textAlign = "center";
  x.fillStyle = TEAMS[team].color;
  x.fillText(name, 256, 49);
  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  const label = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: texture, depthTest: true }),
  );
  label.position.y = rigMetadata?.labelHeight ?? 2.14;
  label.scale.set(1.3, 0.2, 1);
  root.add(label);
  root.userData = {
    lowDetail,
    body,
    head: find("head"),
    legs: [find("leg0"), find("leg1")],
    knees: [find("knee0"), find("knee1")],
    ankles: [find("ankle0"), find("ankle1")],
    arms: [find("arm0"), find("arm1")],
    elbows: [find("elbow0"), find("elbow1")],
    wrists: [find("wrist0"), find("wrist1")],
    fingers: [0, 1].map((side) =>
      [0, 1, 2, 3]
        .map((finger) => find(`finger${side}_${finger}`))
        .filter(Boolean),
    ),
    weaponPivot: find("weaponPivot"),
    label,
    labelTexture: texture,
    gun: null,
    weapon: null,
    death: 0,
    flashAt: 0,
    crouch: 0,
    land: 0,
    wasGrounded: true,
    mixer,
    actions,
    locomotion: 0,
    recoil: 0,
    lodMeshes: [],
    rig: importedRig ? rigMetadata : null,
    labelHeight: label.position.y,
    weaponPosition: new THREE.Vector3(
      ...(rigMetadata?.weaponPosition || [0.08, 1.31, -0.18]),
    ),
  };
  root.updateMatrixWorld(true);
  const u = root.userData;
  u.armDirections = u.elbows.map((elbow, side) => ({
    upper: elbow.position.clone(),
    lower:
      u.wrists[side]?.position.clone() || new THREE.Vector3(0, -0.228, -0.12),
  }));
  u.legDirections = u.knees.map((knee, side) => ({
    upper: knee.position.clone(),
    lower: u.ankles[side]?.position.clone() || new THREE.Vector3(0, -0.36, 0),
    foot: u.ankles[side]
      ?.getWorldPosition(new THREE.Vector3())
      .applyMatrix4(root.matrixWorld.clone().invert()),
  }));
  root.userData.restPose = [
    body,
    find("head"),
    ...root.userData.legs,
    ...root.userData.knees,
    ...root.userData.ankles,
    ...root.userData.arms,
    ...root.userData.elbows,
    ...root.userData.wrists,
    ...root.userData.fingers.flat(),
  ]
    .filter(Boolean)
    .map((node) => ({
      node,
      position: node.position.clone(),
      quaternion: node.quaternion.clone(),
    }));
  return root;
}
const ikDirection = new THREE.Vector3(),
  ikBend = new THREE.Vector3(),
  ikElbow = new THREE.Vector3(),
  ikTarget = new THREE.Vector3(),
  ikUpper = new THREE.Vector3(),
  ikLower = new THREE.Vector3(),
  ikInverse = new THREE.Quaternion();
const footRotation = new THREE.Quaternion(),
  limbTarget = new THREE.Vector3(),
  bendAxis = new THREE.Vector3(),
  bodyInverse = new THREE.Matrix4(),
  wristRotation = new THREE.Quaternion(),
  handRotation = new THREE.Quaternion(),
  axisX = new THREE.Vector3(1, 0, 0),
  axisY = new THREE.Vector3(0, 1, 0);
function solveLimb(arm, elbow, target, directions, bend) {
  const upper = directions.upper.length(),
    lower = directions.lower.length();
  ikUpper.copy(directions.upper).normalize();
  ikLower.copy(directions.lower).normalize();
  ikDirection.copy(target).sub(arm.position);
  const distance = Math.min(
    upper + lower - 0.001,
    Math.max(Math.abs(upper - lower) + 0.001, ikDirection.length()),
  );
  if (ikDirection.lengthSq() < 1e-10) ikDirection.copy(ikUpper);
  else ikDirection.normalize();
  const along =
    (upper * upper - lower * lower + distance * distance) / (2 * distance);
  ikBend
    .copy(bend)
    .addScaledVector(ikDirection, -ikBend.dot(ikDirection))
    .normalize();
  if (ikBend.lengthSq() < 1e-10)
    ikBend
      .copy(Math.abs(ikDirection.x) > 0.8 ? axisY : axisX)
      .cross(ikDirection)
      .normalize();
  ikElbow
    .copy(ikDirection)
    .multiplyScalar(along)
    .addScaledVector(
      ikBend,
      Math.sqrt(Math.max(0, upper * upper - along * along)),
    );
  arm.quaternion.setFromUnitVectors(
    ikUpper,
    ikTarget.copy(ikElbow).normalize(),
  );
  ikTarget.copy(ikDirection).multiplyScalar(distance).sub(ikElbow);
  ikInverse.copy(arm.quaternion).invert();
  ikTarget.applyQuaternion(ikInverse).normalize();
  elbow.quaternion.setFromUnitVectors(ikLower, ikTarget);
}
export function animatePlayer(m, p, t, dt) {
  const u = m.userData,
    speed = Math.hypot(p.vx, p.vz),
    blend = 1 - Math.exp(-12 * dt),
    running = speed > 6.4,
    walk = p.grounded && p.hp > 0 ? Math.min(1, speed / 2) : 0;
  const forward =
    speed > 0.1
      ? -(p.vx * Math.sin(p.yaw) + p.vz * Math.cos(p.yaw)) / speed
      : 1;
  const strafe =
    speed > 0.1 ? (p.vx * Math.cos(p.yaw) - p.vz * Math.sin(p.yaw)) / speed : 0;
  // Locomotion clips do not own every joint at zero blend weight. Always start
  // overlays from bind pose, never from last frame's already-bent crouch.
  for (const { node, position, quaternion } of u.restPose) {
    node.position.copy(position);
    node.quaternion.copy(quaternion);
  }
  for (const [name, a] of Object.entries(u.actions)) {
    const target =
      name === "idle"
        ? 1 - walk
        : name === "run"
          ? walk * (running ? 1 : 0)
          : walk * (running ? 0 : 1);
    a.setEffectiveWeight(
      THREE.MathUtils.lerp(a.getEffectiveWeight(), target, blend),
    );
    if (name !== "idle")
      a.setEffectiveTimeScale(Math.max(0.25, speed / (running ? 8.5 : 5.3)));
  }
  u.mixer.update(dt);
  u.crouch += (stanceBlend(p) - u.crouch) * blend;
  u.air = (u.air || 0) + ((p.grounded ? 0 : 1) - (u.air || 0)) * blend;
  u.stridePhase = (u.stridePhase || 0) + speed * dt * 3;
  const c = u.crouch;
  if (!u.wasGrounded && p.grounded && u.fallSpeed < -2)
    u.landTarget = Math.min(0.045, -u.fallSpeed * 0.004);
  u.wasGrounded = p.grounded;
  u.fallSpeed = p.vy || 0;
  u.land += ((u.landTarget || 0) - u.land) * (1 - Math.exp(-22 * dt));
  u.landTarget = (u.landTarget || 0) * Math.exp(-12 * dt);
  const crouchDrop = u.rig?.crouchDrop ?? 0.5;
  // Fade pelvis breathing/gait bob out of a planted imported crouch. A few
  // millimetres of root motion otherwise keep its short-leg IK rocking at rest.
  if (u.rig && p.grounded) u.body.position.y *= 1 - c;
  u.body.position.y -= c * crouchDrop + u.land;
  u.body.rotation.x = c * 0.17;
  const lateral = (p.vx * Math.cos(p.yaw) - p.vz * Math.sin(p.yaw)) / 8;
  u.body.rotation.z = -lateral * 0.055;
  u.body.updateMatrix();
  if (u.rig) bodyInverse.copy(u.body.matrix).invert();
  u.legs.forEach((leg, i) => {
    if (u.rig) {
      const directions = u.legDirections[i];
      if (p.grounded && c > 0.0001) {
        // Resolve the planted ankle from the actual imported limb lengths.
        // The approved characters have shorter legs than the old art rig.
        limbTarget
          .copy(directions.lower)
          .applyQuaternion(u.knees[i].quaternion)
          .add(directions.upper)
          .applyQuaternion(leg.quaternion)
          .add(leg.position)
          .lerp(directions.foot, c);
        const step =
          Math.sin(u.stridePhase + i * Math.PI) * Math.min(1, speed / 2) * c;
        limbTarget.z += step * 0.12 * forward;
        limbTarget.x += step * 0.12 * strafe;
        limbTarget.y += Math.max(0, step) * 0.04;
        limbTarget.applyMatrix4(bodyInverse);
        bendAxis.set((i ? 1 : -1) * 0.09, 0, -1);
        solveLimb(leg, u.knees[i], limbTarget, directions, bendAxis);
      } else {
        const stride = leg.rotation.x;
        leg.rotation.x *= forward;
        leg.rotation.z -= stride * strafe * 0.72;
        u.knees[i].rotation.x -= u.air * 0.6;
      }
    } else {
      leg.rotation.x = leg.rotation.x * (1 - c * 0.7) + c * 1.22;
      leg.rotation.z +=
        (i ? 1 : -1) * c * 0.06 +
        Math.sin(t * 10 + i * Math.PI) * lateral * 0.2;
      u.knees[i].rotation.x =
        u.knees[i].rotation.x * (1 - c * 0.8) - c * 2.44 - u.air * 0.6;
    }
    if (u.ankles[i]) {
      footRotation
        .copy(u.body.quaternion)
        .multiply(leg.quaternion)
        .multiply(u.knees[i].quaternion)
        .invert();
      u.ankles[i].quaternion.identity().slerp(footRotation, c);
    }
  });
  u.head.rotation.x = p.pitch * 0.38;
  u.recoil += ((t < u.flashAt ? 1 : 0) - u.recoil) * (1 - Math.exp(-24 * dt));
  const visualWeapon = u.weapon || p.weapon,
    handPose = weaponPose(visualWeapon),
    reload = reloadPose(visualWeapon, p.reload),
    heldThrow =
      u.rig && p.action === "throw" && WEAPONS[visualWeapon].type === "GRENADE";
  if (u.gun) u.gun.visible = true;
  u.weaponPivot.rotation.x = p.pitch - reload.tilt * 0.17 + u.recoil * 0.055;
  if (p.action === "respawn") u.weaponPivot.rotation.x += p.actionTime * 0.32;
  u.weaponPivot.position.set(
    u.weaponPosition.x,
    u.weaponPosition.y - c * 0.07 + Math.sin(t * 2.2) * 0.003,
    u.weaponPosition.z + u.recoil * 0.018,
  );
  // Resolve every weapon transform before IK, including switching/knife arcs.
  // Applying draw rotations afterwards left hands on last frame's gun pose.
  if (p.action === "slash")
    u.weaponPivot.rotation.y = Math.sin((p.actionTime / 0.32) * Math.PI) * -0.9;
  else if (!heldThrow) u.weaponPivot.rotation.y *= Math.exp(-18 * dt);
  if (["draw", "drop", "pickup"].includes(p.action))
    u.weaponPivot.rotation.z = p.actionTime * 1.6;
  else if (!heldThrow) u.weaponPivot.rotation.z = 0;
  // Two-bone presentation IK keeps palms on each weapon instead of floating beside it.
  u.weaponPivot.updateMatrix();
  for (const i of [0, 1]) {
    const point = i === 1 ? handPose.grip : [...handPose.support];
    if (i === 0 && !u.rig) point[2] = Math.max(-0.28, point[2]);
    limbTarget.set(...point);
    if (i === 0) limbTarget.add(ikTarget.set(...reload.support));
    limbTarget.applyMatrix4(u.weaponPivot.matrix);
    bendAxis.set(i === 0 ? -1 : 1, -0.18, 0.35);
    solveLimb(u.arms[i], u.elbows[i], limbTarget, u.armDirections[i], bendAxis);
    if (u.wrists[i]) {
      // Counter-rotate the palm: forearms reach the socket while hands keep a
      // weapon-appropriate grip instead of pointing their fingers downrange.
      const supportUnderBarrel =
        i === 0 &&
        !handPose.pistol &&
        !handPose.equipment &&
        visualWeapon !== "knife";
      handRotation.setFromAxisAngle(
        supportUnderBarrel ? axisX : axisY,
        // +X turns the resting downward fingers toward the -Z muzzle. The
        // opposite sign twists the support wrist almost 180° and collapses skin.
        supportUnderBarrel ? Math.PI / 2 : ((i === 0 ? 1 : -1) * Math.PI) / 2,
      );
      wristRotation
        .copy(u.arms[i].quaternion)
        .multiply(u.elbows[i].quaternion)
        .invert()
        .multiply(u.weaponPivot.quaternion)
        .multiply(handRotation);
      u.wrists[i].quaternion.copy(wristRotation);
    }
    for (const [finger, node] of u.fingers[i].entries())
      node.rotation.x -= i === 1 && finger === 0 ? 0.55 : 1.12;
  }
  if (p.action === "throw" && (!u.rig || heldThrow)) {
    const motion = throwPose(p.actionTime),
      phase = motion.phase;
    u.arms[1].rotation.x = THREE.MathUtils.lerp(
      u.arms[1].rotation.x,
      -2.35 + motion.swing * 1.7,
      motion.arm,
    );
    u.arms[1].rotation.z = THREE.MathUtils.lerp(
      u.arms[1].rotation.z,
      -0.16,
      motion.arm,
    );
    u.elbows[1].rotation.x = THREE.MathUtils.lerp(
      u.elbows[1].rotation.x,
      -0.8 * (1 - motion.swing),
      motion.arm,
    );
    if (u.wrists[1])
      u.wrists[1].quaternion.slerp(wristRotation.identity(), motion.arm);
    for (const finger of u.fingers[1])
      finger.rotation.x = THREE.MathUtils.lerp(
        finger.rotation.x,
        -(1 - smooth((phase - 0.43) / 0.17)) * 1.12,
        motion.arm,
      );
    u.weaponPivot.rotation.x -= 0.4 * motion.arm;
    if (heldThrow) {
      // Keep the prop on the palm until the authoritative release beat.
      u.weaponPivot.quaternion
        .copy(u.arms[1].quaternion)
        .multiply(u.elbows[1].quaternion);
      limbTarget
        .copy(u.wrists[1].position)
        .applyQuaternion(u.elbows[1].quaternion)
        .add(u.elbows[1].position)
        .applyQuaternion(u.arms[1].quaternion)
        .add(u.arms[1].position);
      ikTarget
        .set(...handPose.grip)
        .multiply(u.weaponPivot.scale)
        .applyQuaternion(u.weaponPivot.quaternion);
      u.weaponPivot.position.copy(limbTarget).sub(ikTarget);
      if (u.gun) u.gun.visible = !motion.released;
    }
  }
  if (p.hp <= 0) {
    u.death = Math.min(1, u.death + dt * 2.5);
    const fall = smooth(u.death);
    u.body.rotation.z = THREE.MathUtils.lerp(u.body.rotation.z, 1.5, fall);
    u.body.position.y = THREE.MathUtils.lerp(
      u.body.position.y,
      u.rig ? 0.2 : -0.05,
      fall,
    );
    u.label.visible = false;
    u.legs.forEach((l, i) => {
      l.rotation.x = THREE.MathUtils.lerp(l.rotation.x, 0.18 + i * 0.2, fall);
      u.knees[i].rotation.x = THREE.MathUtils.lerp(
        u.knees[i].rotation.x,
        0.36 + i * 0.2,
        fall,
      );
      u.ankles[i]?.quaternion.slerp(wristRotation.identity(), fall);
    });
    for (const [i, target] of [
      [0, [-0.3, 0.2, -0.25]],
      [1, [0.3, -0.1, 0.4]],
    ])
      for (const [j, axis] of ["x", "y", "z"].entries())
        u.arms[i].rotation[axis] = THREE.MathUtils.lerp(
          u.arms[i].rotation[axis],
          target[j],
          fall,
        );
    for (const wrist of u.wrists)
      wrist?.quaternion.slerp(wristRotation.identity(), fall);
    for (const finger of u.fingers.flat())
      finger.rotation.x = THREE.MathUtils.lerp(finger.rotation.x, -0.25, fall);
  } else {
    u.label.visible = true;
    u.label.position.y = u.labelHeight - c * crouchDrop;
  }
  if (u.gun) {
    u.gun.userData.flash.visible =
      t < u.flashAt && !!WEAPONS[u.weapon].damage && u.weapon !== "knife";
    animateGun(
      u.gun,
      u.weapon,
      p.reload,
      t < u.flashAt ? 1 : 0,
      dt,
      p.action,
      p.actionTime,
    );
  }
}
