import { WEAPONS, isFirearm } from "./weapons.js";
import { actionBlocksFire } from "./actions.js";
// One eligibility rule for scope overlay, camera, sensitivity and server input.
export function canAim(player, now) {
  return !!player && isFirearm(player.weapon) && !actionBlocksFire(player, now);
}
export function aimFov(player, requested, base = 78) {
  return requested && canAim(player)
    ? Math.min(base, WEAPONS[player.weapon].aimFov)
    : base;
}
