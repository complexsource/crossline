// Every inventory/action boundary invalidates queued clicks AND volatile held
// packets. Only a fresh press bearing the current epoch may start automatic fire.
export function fireBarrier(p) {
  p.fireEpoch = (p.fireEpoch || 0) + 1;
  p.fireArmed = false;
  p.pendingShot = null;
  p.wasShooting = false;
  if (p.input) p.input.shoot = false;
}
export function beginAction(p, action, now, duration) {
  fireBarrier(p);
  p.action = action;
  p.actionUntil = now + duration;
  p.nextFire = Math.max(p.shotCooldownUntil || 0, p.actionUntil);
}
