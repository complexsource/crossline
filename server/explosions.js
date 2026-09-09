import { clamp, playerHeight } from "../shared/game.js";

// Game balance in metres. Distance is to the player's capsule, not their eyes:
// a grenade beside someone's boots must not acquire an artificial 1.5 m penalty.
export const HE_RADIUS = 8;
export const HE_CLOSE_RADIUS = 2;
export function blastDamage(origin, player, visible) {
  const h = playerHeight(player),
    radius = 0.31;
  const nearestY = clamp(origin.y, player.y + radius, player.y + h - radius);
  const distance = Math.max(
    0,
    Math.hypot(origin.x - player.x, origin.y - nearestY, origin.z - player.z) -
      radius,
  );
  if (distance >= HE_RADIUS) return 0;
  // All probes are inside the hit capsule. Partial cover can expose legs/torso;
  // a solid wall covering the entire body blocks every probe and all damage.
  const probes = [
    [0, radius, 0],
    [0, h * 0.5, 0],
    [0, h - radius, 0],
    [-0.22, h * 0.55, 0],
    [0.22, h * 0.55, 0],
    [0, h * 0.55, -0.22],
    [0, h * 0.55, 0.22],
  ];
  if (
    !probes.some(([x, y, z]) =>
      visible(origin, {
        x: player.x + x,
        y: player.y + y,
        z: player.z + z,
      }),
    )
  )
    return 0;
  return Math.round(
    120 *
      (1 -
        clamp(
          (distance - HE_CLOSE_RADIUS) / (HE_RADIUS - HE_CLOSE_RADIUS),
          0,
          1,
        )),
  );
}
