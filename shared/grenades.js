import { direction, eyeHeight, rayBox, collisionCandidates } from "./game.js";
import { groundAt, COASTLINE } from "./maps.js";
export const GRENADE_FUSE = Object.freeze({ he: 2, flash: 1.7, smoke: 2.3 });
export const GRENADE_RADIUS = 0.12;
export function grenadeLaunch(p, boxes = COASTLINE.boxes) {
  const dir = direction(p.yaw, p.pitch),
    origin = { x: p.x, y: p.y + eyeHeight(p) - 0.08, z: p.z };
  const delta = {
    x: dir.x * 0.35 + Math.cos(p.yaw) * 0.12,
    y: dir.y * 0.35,
    z: dir.z * 0.35 - Math.sin(p.yaw) * 0.12,
  };
  const length = Math.hypot(delta.x, delta.y, delta.z),
    ray = { x: delta.x / length, y: delta.y / length, z: delta.z / length };
  let travel = length;
  for (const b of collisionCandidates(p.x, p.z, boxes))
    travel = Math.min(
      travel,
      Math.max(0, rayBox(origin, ray, b, GRENADE_RADIUS) - 0.002),
    );
  return {
    x: origin.x + ray.x * travel,
    y: origin.y + ray.y * travel,
    z: origin.z + ray.z * travel,
    vx: dir.x * 13,
    vy: dir.y * 13 + 4,
    vz: dir.z * 13,
  };
}
// Shared by real projectiles and the bounded bot trajectory preview. Sweeping
// the sphere per axis prevents fast throws tunnelling into thin walls/cover.
export function stepGrenade(g, dt, boxes = COASTLINE.boxes) {
  let impact = 0;
  g.vy -= 16 * dt;
  const nearby = collisionCandidates(g.x, g.z, boxes);
  for (const axis of ["x", "y", "z"]) {
    const velocity = g["v" + axis],
      sign = Math.sign(velocity),
      distance = Math.abs(velocity * dt);
    if (!sign) continue;
    const ray = { x: 0, y: 0, z: 0 };
    ray[axis] = sign;
    let travel = distance,
      hit = false;
    for (const b of nearby) {
      const entry = rayBox(g, ray, b, GRENADE_RADIUS);
      if (entry <= travel) {
        travel = Math.max(0, entry - 0.001);
        hit = true;
      }
    }
    g[axis] += sign * travel;
    if (hit) {
      impact = Math.max(impact, Math.abs(velocity));
      g["v" + axis] = -velocity * 0.46;
      if (axis === "y" && velocity < 0) {
        g.vx *= 0.94;
        g.vz *= 0.94;
        if (Math.abs(g.vy) < 0.8) g.vy = 0;
      }
    }
  }
  const floor = groundAt(g.x, g.z) + GRENADE_RADIUS;
  if (g.y <= floor) {
    g.y = floor;
    impact = Math.max(impact, Math.abs(g.vy));
    g.vy = Math.abs(g.vy) * 0.35;
    if (g.vy < 0.8) g.vy = 0;
    g.vx *= 0.94;
    g.vz *= 0.94;
  }
  if (Math.abs(g.vx) < 0.025) g.vx = 0;
  if (Math.abs(g.vz) < 0.025) g.vz = 0;
  return impact;
}
