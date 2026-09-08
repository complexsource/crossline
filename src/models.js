import * as THREE from "three";
import { WEAPONS } from "../shared/weapons.js";
import { TEAMS } from "../shared/teams.js";
import { instance } from "./assets.js";
import {
  radialTexture,
  joint,
  garment,
  material,
  disposeModel,
} from "./geometry.js";
import { glove } from "./character-models.js";
export { material, radialTexture, disposeModel };
export const makeGrenade = (kind = "he") => instance(kind);
export function makeGun(id, firstPerson = false) {
  const g = instance(id),
    muzzle = g.getObjectByName("muzzle"),
    flash = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: radialTexture("flash"),
        color: 0xffd29b,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
  flash.scale.set(0.27, 0.27, 1);
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
  let supportRest;
  if (firstPerson) {
    const pistol = WEAPONS[id].type === "PISTOL",
      equipment = ["GRENADE", "OBJECTIVE"].includes(WEAPONS[id].type);
    glove(g, 0.018, -0.157, 0.14);
    garment(
      g,
      0.1,
      -0.24,
      0.36,
      0.067,
      0.23,
      0.073,
      material(0x879975),
    ).rotation.set(Math.PI / 2, 0, 0.26);
    support.position.set(
      equipment ? -0.17 : pistol ? 0.01 : -0.06,
      equipment ? -0.04 : pistol ? -0.21 : -0.085,
      equipment ? 0 : pistol ? 0.14 : -0.3,
    );
    supportRest = support.position.clone();
    glove(support, 0, 0, 0);
    garment(
      support,
      -0.074,
      -0.072,
      0.14,
      0.06,
      0.19,
      0.066,
      material(0x82956d),
    ).rotation.set(Math.PI / 2, 0, -0.55);
    if (id === "dualberettas") support.position.set(-0.13, -0.145, 0.14);
    g.traverse((o) => {
      o.layers.set(1);
      if (o.isMesh) o.castShadow = o.receiveShadow = false;
    });
    flash.layers.set(1);
  }
  g.userData = {
    flash,
    magazines,
    bolts,
    pump: g.getObjectByName("pump"),
    support,
    supportRest,
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
    progress = reload > 0 ? 1 - reload / w.reload : 0,
    drop =
      progress > 0.1 && progress < 0.74
        ? Math.sin(((progress - 0.1) / 0.64) * Math.PI)
        : 0;
  for (const m of u.magazines) {
    m.position.y = -drop * 0.38;
    m.rotation.x = drop * 0.23;
  }
  for (const b of u.bolts) b.position.z = kick * 0.065;
  if (u.pump) u.pump.position.z = kick * 0.09;
  if (u.supportRest) {
    u.support.position.copy(u.supportRest);
    u.support.position.y -= drop * 0.22;
    u.support.position.z += drop * 0.24;
    if (action === "throw") {
      u.support.position.y -= 0.1;
      u.support.position.z += actionTime * 0.4;
    }
  }
  u.draw = Math.max(0, u.draw - dt * 4.5);
  if (u.led) u.led.visible = Math.sin(performance.now() / 160) > 0;
}
export function makePlayer(name, team, lowDetail = false) {
  const root = instance(TEAMS[team].model + (lowDetail ? "-lod" : "")),
    find = (n) => root.getObjectByName(n),
    body = find("body"),
    mixer = new THREE.AnimationMixer(root),
    actions = {};
  for (const clip of root.animations) {
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
  label.position.y = 2.14;
  label.scale.set(1.3, 0.2, 1);
  root.add(label);
  root.userData = {
    lowDetail,
    body,
    head: find("head"),
    legs: [find("leg0"), find("leg1")],
    knees: [find("knee0"), find("knee1")],
    arms: [find("arm0"), find("arm1")],
    elbows: [find("elbow0"), find("elbow1")],
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
    lodMeshes: [],
  };
  return root;
}
export function animatePlayer(m, p, t, dt) {
  const u = m.userData,
    speed = Math.hypot(p.vx, p.vz),
    blend = 1 - Math.exp(-12 * dt),
    running = speed > 6.4,
    walk = p.grounded && p.hp > 0 ? Math.min(1, speed / 2) : 0;
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
  u.crouch += (Number(p.crouch) - u.crouch) * blend;
  const c = u.crouch;
  if (!u.wasGrounded && p.grounded) u.land = 0.045;
  u.wasGrounded = p.grounded;
  u.land *= Math.exp(-12 * dt);
  u.body.position.y -= c * 0.5 + u.land;
  u.body.rotation.x = c * 0.17;
  const lateral = (p.vx * Math.cos(p.yaw) - p.vz * Math.sin(p.yaw)) / 8;
  u.body.rotation.z = -lateral * 0.055;
  u.legs.forEach((leg, i) => {
    leg.rotation.x -= c * 0.78;
    leg.rotation.z +=
      (i ? 1 : -1) * c * 0.06 + Math.sin(t * 10 + i * Math.PI) * lateral * 0.2;
    u.knees[i].rotation.x += c * 1.46 + (p.grounded ? 0 : 0.6);
  });
  u.head.rotation.x = p.pitch * 0.38;
  u.weaponPivot.rotation.x = p.pitch;
  u.weaponPivot.position.y = 1.18 - c * 0.07;
  u.arms[0].rotation.set(-1.0 - p.pitch * 0.48, -0.35, 0.16);
  u.arms[1].rotation.set(-0.86 - p.pitch * 0.48, 0.12, -0.12);
  u.elbows[0].rotation.set(-0.33, -0.38, 0);
  u.elbows[1].rotation.set(-0.62, 0.05, 0);
  if (p.reload > 0) {
    const amount = Math.sin(
      Math.PI * (1 - p.reload / WEAPONS[p.weapon].reload),
    );
    u.arms[0].rotation.x += amount * 0.6;
    u.elbows[0].rotation.x += amount * 0.45;
  }
  if (p.action === "throw") {
    u.arms[1].rotation.x = -2.4 + p.actionTime * 2;
    u.weaponPivot.rotation.x -= 0.4;
  }
  if (p.action === "slash")
    u.weaponPivot.rotation.y = Math.sin((p.actionTime / 0.32) * Math.PI) * -0.9;
  else u.weaponPivot.rotation.y *= Math.exp(-18 * dt);
  if (p.action === "draw") u.weaponPivot.rotation.z = p.actionTime * 1.6;
  else u.weaponPivot.rotation.z = 0;
  if (p.hp <= 0) {
    u.death = Math.min(1, u.death + dt * 2.5);
    u.body.rotation.z = u.death * 1.5;
    u.body.position.y = -u.death * 0.05;
    u.label.visible = false;
    u.legs.forEach((l) => (l.rotation.x = 0.2));
  } else {
    u.label.visible = true;
    u.label.position.y = 2.14 - c * 0.5;
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
