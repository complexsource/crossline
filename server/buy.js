import {
  WEAPONS,
  PRIMARIES,
  PISTOLS,
  GRENADES,
  isFirearm,
} from "../shared/weapons.js";
import { beginAction } from "./actions.js";
import { equip } from "./inventory.js";

// A per-life ledger shares the live ammo objects. Switching A -> B -> A never
// replenishes ammunition; dropping transfers it out of the ledger entirely.
export function beginBuyLife(p) {
  p.buyAmmo = { ...p.ammo };
  p.buyRevision = 0;
  p.nextBuy = 0;
}
export function selectItem(p, id, now) {
  if (typeof id !== "string" || !Object.hasOwn(WEAPONS, id) || id === "bomb")
    throw Error("That equipment is unavailable in Team Deathmatch.");
  if (GRENADES.includes(id)) {
    if (!p.grenades[id])
      throw Error("That grenade was spent. Equipment refills on respawn.");
    equip(p, id, now);
  } else if (isFirearm(id)) {
    const slot = WEAPONS[id].slot,
      old = p.slots[slot];
    if (old && p.ammo[old]) p.buyAmmo[old] = p.ammo[old];
    if (!p.buyAmmo[id])
      p.buyAmmo[id] = { mag: WEAPONS[id].mag, reserve: WEAPONS[id].reserve };
    if (old && old !== id) delete p.ammo[old];
    p.slots[slot] = id;
    p.ammo[id] = p.buyAmmo[id];
    p[slot] = id;
    p.loadout = { primary: p.primary, secondary: p.secondary };
    p.weapon = id;
    p.previousWeapon = slot === "primary" ? p.slots.secondary : p.slots.primary;
    p.returnWeapon = null;
    p.reloadAt = 0;
    beginAction(p, "draw", now, 0.2);
  } else equip(p, "knife", now);
  p.buyRevision++;
}
export function previousItems(p) {
  const previous = p.previousLoadout;
  if (
    !previous ||
    !PRIMARIES.includes(previous.primary) ||
    !PISTOLS.includes(previous.secondary)
  )
    throw Error(
      "Your previous loadout becomes available after your first life.",
    );
  return [previous.secondary, previous.primary];
}
