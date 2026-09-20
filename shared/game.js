import { getMap, groundAt } from "./maps.js";
export {
  WEAPONS,
  PRIMARIES,
  PISTOLS,
  GRENADES,
  FIREARMS,
  isFirearm,
} from "./weapons.js";
export const TICK = 1 / 60;
export const MATCH_SECONDS = 600;
// Original map geometry. The server and renderer share every solid collider.
export const BOXES = getMap("coastline").boxes;
export const SPAWNS = getMap("coastline").spawns;
// Static broadphase shared by prediction and authority. Each 4 m cell includes
// a 1 m apron for swept movement; custom/mutable test maps use the exact scan.
const collisionCells = new Map();
export function collisionCandidates(x, z, boxes = BOXES) {
  if (boxes !== BOXES) return boxes;
  const cx = Math.floor(x / 4),
    cz = Math.floor(z / 4),
    key = `${cx}/${cz}`;
  if (!collisionCells.has(key))
    collisionCells.set(
      key,
      boxes.filter(
        (b) =>
          b.x + b.w / 2 >= cx * 4 - 1 &&
          b.x - b.w / 2 <= cx * 4 + 5 &&
          b.z + b.d / 2 >= cz * 4 - 1 &&
          b.z - b.d / 2 <= cz * 4 + 5,
      ),
    );
  return collisionCells.get(key);
}
export const eyeHeight = (p) => (p.crouch ? 1.03 : 1.62);
export const playerHeight = (p) => (p.crouch ? 1.25 : 1.85);
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export function direction(yaw, pitch) {
  return {
    x: -Math.sin(yaw) * Math.cos(pitch),
    y: Math.sin(pitch),
    z: -Math.cos(yaw) * Math.cos(pitch),
  };
}
export function overlaps(p, box, h = playerHeight(p)) {
  return (
    p.x + 0.32 > box.x - box.w / 2 &&
    p.x - 0.32 < box.x + box.w / 2 &&
    p.z + 0.32 > box.z - box.d / 2 &&
    p.z - 0.32 < box.z + box.d / 2 &&
    p.y + h > box.y - box.h / 2 + 0.001 &&
    p.y < box.y + box.h / 2 - 0.001
  );
}
export function move(p, input, dt, boxes = BOXES) {
  if (Math.max(7.5, Math.abs(p.vx), Math.abs(p.vz)) * dt < 0.65)
    boxes = collisionCandidates(p.x, p.z, boxes);
  const wasGrounded = p.grounded;
  p.yaw = input.yaw;
  p.pitch = input.pitch;
  if (input.crouch) p.crouch = true;
  else if (!boxes.some((b) => overlaps(p, b, 1.85))) p.crouch = false;
  const speed =
    (p.crouch ? 2.6 : input.aim ? 3.3 : input.run ? 7.5 : 5.2) *
    (p.y < -0.4 ? 0.7 : 1);
  let f = (input.forward ? 1 : 0) - (input.back ? 1 : 0),
    s = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  const len = Math.hypot(f, s) || 1;
  f /= len;
  s /= len;
  const tx = (-Math.sin(p.yaw) * f + Math.cos(p.yaw) * s) * speed;
  const tz = (-Math.cos(p.yaw) * f - Math.sin(p.yaw) * s) * speed;
  const accel = wasGrounded ? Math.min(1, 18 * dt) : Math.min(1, 3 * dt);
  p.vx += (tx - p.vx) * accel;
  p.vz += (tz - p.vz) * accel;
  if (input.jump && !p.jumpHeld && p.grounded) {
    p.vy = 7;
    p.grounded = false;
  }
  p.jumpHeld = !!input.jump;
  p.vy -= 20 * dt;
  for (const axis of ["x", "z"]) {
    const old = p[axis];
    p[axis] += p[axis === "x" ? "vx" : "vz"] * dt;
    let top = -Infinity;
    for (const b of boxes)
      if (overlaps(p, b)) top = Math.max(top, b.y + b.h / 2);
    if (top !== -Infinity) {
      const step = { ...p, y: top };
      if (
        wasGrounded &&
        top - p.y <= 0.3 &&
        !boxes.some((b) => overlaps(step, b))
      ) {
        p.y = top;
        p.vy = 0;
      } else {
        p[axis] = old;
        p[axis === "x" ? "vx" : "vz"] = 0;
      }
    }
  }
  const oldY = p.y;
  p.y += p.vy * dt;
  p.grounded = false;
  for (const b of boxes)
    if (overlaps(p, b)) {
      if (p.vy <= 0 && oldY >= b.y + b.h / 2 - 0.06) {
        p.y = b.y + b.h / 2;
        p.grounded = true;
      } else p.y = oldY;
      p.vy = 0;
    }
  const floor = groundAt(p.x, p.z);
  if (p.y <= floor) {
    p.y = floor;
    p.vy = 0;
    p.grounded = true;
  }
  p.x = clamp(p.x, -42.6, 42.6);
  p.z = clamp(p.z, -35.8, 35.8);
}
export function rayBox(o, d, b) {
  let near = 0,
    far = Infinity;
  for (let index = 0; index < 3; index++) {
    const axis = index === 0 ? "x" : index === 1 ? "y" : "z",
      size = index === 0 ? "w" : index === 1 ? "h" : "d";
    const min = b[axis] - b[size] / 2,
      max = b[axis] + b[size] / 2;
    if (Math.abs(d[axis]) < 1e-8) {
      if (o[axis] < min || o[axis] > max) return Infinity;
      continue;
    }
    let a = (min - o[axis]) / d[axis],
      c = (max - o[axis]) / d[axis];
    if (a > c) [a, c] = [c, a];
    near = Math.max(near, a);
    far = Math.min(far, c);
    if (near > far) return Infinity;
  }
  return near;
}
export function wallDistance(o, d, boxes = BOXES) {
  let distance = d.y < 0 ? (-1.3 - o.y) / d.y : Infinity;
  for (const box of boxes) distance = Math.min(distance, rayBox(o, d, box));
  return distance;
}
export function emptyInput() {
  return {
    forward: false,
    back: false,
    left: false,
    right: false,
    jump: false,
    run: false,
    crouch: false,
    shoot: false,
    aim: false,
    yaw: 0,
    pitch: 0,
  };
}
