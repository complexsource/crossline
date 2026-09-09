import { randomBytes } from "node:crypto";
import { WEAPONS, GRENADES, isFirearm } from "../shared/weapons.js";
import { beginAction, fireBarrier } from "./actions.js";
export function resetInventory(p) {
  p.slots = { primary: p.primary, secondary: p.secondary, knife: "knife" };
  p.ammo = {};
  for (const id of Object.values(p.slots))
    p.ammo[id] = { mag: WEAPONS[id].mag, reserve: WEAPONS[id].reserve };
  p.grenades = { he: 1, flash: 1, smoke: 1 };
  p.weapon = p.primary;
  p.previousWeapon = p.secondary;
  p.reloadAt = 0;
  p.returnWeapon = null;
  fireBarrier(p);
}
export const owned = (p) => [
  ...Object.values(p.slots).filter(Boolean),
  ...GRENADES.filter((id) => p.grenades[id] > 0),
];
export function equip(p, id, now) {
  if (!owned(p).includes(id) || p.weapon === id) return false;
  if (GRENADES.includes(id) && !GRENADES.includes(p.weapon))
    p.returnWeapon = p.weapon;
  p.previousWeapon = p.weapon;
  p.weapon = id;
  p.reloadAt = 0;
  beginAction(p, "draw", now, 0.2);
  return true;
}
export function drop(room, p, now, { death = false } = {}) {
  if (!isFirearm(p.weapon)) return false;
  const id = p.weapon,
    slot = WEAPONS[id].slot;
  const item = {
    id: randomBytes(5).toString("hex"),
    weapon: id,
    ammo: { ...p.ammo[id] },
    x: p.x,
    y: p.y + 0.08,
    z: p.z,
    yaw: p.yaw,
    expiresAt: now + 75,
  };
  room.drops.push(item);
  if (room.drops.length > 40) room.drops.shift();
  delete p.ammo[id];
  p.slots[slot] = null;
  p.weapon = p.slots.primary || p.slots.secondary || "knife";
  p.reloadAt = 0;
  beginAction(p, death ? "death" : "drop", now, death ? 3 : 0.2);
  return item;
}
export function nearestPickup(room, p, canSee = () => true) {
  return room.drops
    .filter(
      (d) =>
        Math.hypot(d.x - p.x, d.z - p.z) < 2 &&
        Math.abs(d.y - p.y) < 1.8 &&
        canSee(d),
    )
    .sort(
      (a, b) =>
        Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z),
    )[0];
}
export function pickup(room, p, id, now, canSee) {
  const item = nearestPickup(room, p, canSee);
  if (!item || item.id !== id) return false;
  // Remove synchronously before assigning: two players cannot acquire one item.
  room.drops.splice(room.drops.indexOf(item), 1);
  const slot = WEAPONS[item.weapon].slot;
  if (p.slots[slot]) {
    p.weapon = p.slots[slot];
    drop(room, p, now);
  }
  p.slots[slot] = item.weapon;
  p.ammo[item.weapon] = { ...item.ammo };
  equip(p, item.weapon, now);
  beginAction(p, "pickup", now, 0.2);
  return true;
}
